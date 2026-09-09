use super::utils::parse_datetime;
use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct PrescriptionItem {
    pub medicine_name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub duration: Option<String>,
    pub instructions: Option<String>,
    pub sort_order: Option<u32>,
}

#[derive(Deserialize)]
pub struct PrescriptionPayload {
    pub prescribed_at: Option<String>,
    pub doctor_notes: Option<String>,
    pub items: Vec<PrescriptionItem>,
}

async fn get_prescription_items(prescription_id: u64, db: &sqlx::MySqlPool) -> AppResult<Vec<Value>> {
    let rows = sqlx::query(
        "SELECT id, medicine_name, dosage, frequency, duration, instructions, sort_order, unit_price * 1e0 as unit_price
         FROM prescription_items WHERE prescription_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC"
    ).bind(prescription_id).fetch_all(db).await?;

    Ok(rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "medicine_name": r.get::<String, _>("medicine_name"),
        "dosage": r.get::<Option<String>, _>("dosage"),
        "frequency": r.get::<Option<String>, _>("frequency"),
        "duration": r.get::<Option<String>, _>("duration"),
        "instructions": r.get::<Option<String>, _>("instructions"),
        "sort_order": r.get::<u32, _>("sort_order"),
        "unit_price": r.get::<Option<f64>, _>("unit_price")
    })).collect())
}

#[tauri::command]
pub async fn list_prescriptions(
    status: Option<String>,
    q: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(15).min(200);
    let offset = (page - 1) * per_page;

    let mut conditions = vec!["pr.clinic_id = ?".to_string(), "pr.deleted_at IS NULL".to_string()];
    let mut binds: Vec<String> = vec![session.clinic_id.to_string()];

    if let Some(ref s) = status {
        if !s.is_empty() {
            conditions.push("pr.status = ?".to_string());
            binds.push(s.clone());
        }
    }
    if let Some(ref q) = q {
        if !q.trim().is_empty() {
            conditions.push("(p.name LIKE ? OR p.mobile LIKE ?)".to_string());
            let like = format!("%{}%", q.trim());
            binds.push(like.clone()); binds.push(like);
        }
    }

    let where_clause = conditions.join(" AND ");
    let count_sql = format!(
        "SELECT COUNT(*) FROM prescriptions pr JOIN patients p ON p.id=pr.patient_id WHERE {}", where_clause
    );
    let list_sql = format!(
        "SELECT pr.id, pr.visit_id, pr.status, pr.doctor_notes, pr.payment_status,
                pr.amount_paid * 1e0 as amount_paid,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                DATE_FORMAT(pr.sent_to_pharmacy_at, '%Y-%m-%dT%H:%i:%s') as sent_to_pharmacy_at,
                DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at,
                p.name as patient_name, p.mobile as patient_mobile, u.name as doctor_name,
                COUNT(pi.id) as item_count
         FROM prescriptions pr
         JOIN patients p ON p.id=pr.patient_id
         JOIN users u ON u.id=pr.doctor_id
         LEFT JOIN prescription_items pi ON pi.prescription_id=pr.id AND pi.deleted_at IS NULL
         WHERE {} GROUP BY pr.id ORDER BY pr.prescribed_at DESC LIMIT {} OFFSET {}",
        where_clause, per_page, offset
    );

    let mut cq = sqlx::query(&count_sql);
    let mut lq = sqlx::query(&list_sql);
    for b in &binds { cq = cq.bind(b); lq = lq.bind(b); }

    let total: i64 = cq.fetch_one(&state.db).await?.get(0);
    let rows = lq.fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "status": r.get::<String, _>("status"),
        "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "sent_to_pharmacy_at": r.get::<Option<String>, _>("sent_to_pharmacy_at"),
        "completed_at": r.get::<Option<String>, _>("completed_at"),
        "doctor_notes": r.get::<Option<String>, _>("doctor_notes"),
        "payment_status": r.get::<String, _>("payment_status"),
        "item_count": r.get::<i64, _>("item_count"),
        "patient": { "name": r.get::<String, _>("patient_name"), "mobile": r.get::<Option<String>, _>("patient_mobile") },
        "doctor": { "name": r.get::<String, _>("doctor_name") }
    })).collect();

    let last_page = ((total as f64) / (per_page as f64)).ceil() as u32;
    Ok(json!({ "data": data, "total": total, "per_page": per_page, "current_page": page, "last_page": last_page.max(1) }))
}

#[tauri::command]
pub async fn create_prescription(
    visit_id: u64,
    data: PrescriptionPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let visit = sqlx::query("SELECT patient_id, clinic_id FROM visits WHERE id=? AND clinic_id=?")
        .bind(visit_id).bind(session.clinic_id)
        .fetch_optional(&state.db).await?.ok_or("Visit not found.")?;

    let patient_id: u64 = visit.get("patient_id");

    let prescribed_at = data.prescribed_at
        .as_deref()
        .map(parse_datetime)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());

    let result = sqlx::query(
        "INSERT INTO prescriptions (clinic_id, patient_id, visit_id, doctor_id, prescribed_at, doctor_notes, status, payment_status, amount_paid, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', 'unpaid', 0, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(patient_id).bind(visit_id).bind(session.id)
    .bind(&prescribed_at).bind(&data.doctor_notes)
    .execute(&state.db).await?;

    let prescription_id = result.last_insert_id();

    for (i, item) in data.items.iter().enumerate() {
        sqlx::query(
            "INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
        )
        .bind(prescription_id).bind(&item.medicine_name).bind(&item.dosage)
        .bind(&item.frequency).bind(&item.duration).bind(&item.instructions)
        .bind(item.sort_order.unwrap_or(i as u32))
        .execute(&state.db).await?;
    }

    get_prescription(prescription_id, state).await
}

#[tauri::command]
pub async fn get_prescription(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query(
        "SELECT pr.id, pr.visit_id, pr.status, pr.doctor_notes, pr.payment_status,
                pr.amount_paid * 1e0 as amount_paid,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                DATE_FORMAT(pr.sent_to_pharmacy_at, '%Y-%m-%dT%H:%i:%s') as sent_to_pharmacy_at,
                DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at,
                p.name as patient_name, p.mobile as patient_mobile,
                u.name as doctor_name,
                DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
                v.consultation_notes
         FROM prescriptions pr
         JOIN patients p ON p.id=pr.patient_id
         JOIN users u ON u.id=pr.doctor_id
         JOIN visits v ON v.id=pr.visit_id
         WHERE pr.id=? AND pr.clinic_id=? AND pr.deleted_at IS NULL"
    ).bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;

    let items = get_prescription_items(id, &state.db).await?;

    Ok(json!({
        "id": row.get::<u64, _>("id"),
        "visit_id": row.get::<u64, _>("visit_id"),
        "status": row.get::<String, _>("status"),
        "prescribed_at": row.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "sent_to_pharmacy_at": row.get::<Option<String>, _>("sent_to_pharmacy_at"),
        "completed_at": row.get::<Option<String>, _>("completed_at"),
        "doctor_notes": row.get::<Option<String>, _>("doctor_notes"),
        "payment_status": row.get::<String, _>("payment_status"),
        "amount_paid": row.get::<f64, _>("amount_paid"),
        "items": items,
        "patient": { "name": row.get::<String, _>("patient_name"), "mobile": row.get::<Option<String>, _>("patient_mobile") },
        "doctor": { "name": row.get::<String, _>("doctor_name") },
        "visit": { "id": row.get::<u64, _>("visit_id"), "visited_at": row.get::<Option<String>, _>("visited_at"), "consultation_notes": row.get::<Option<String>, _>("consultation_notes") }
    }))
}

#[tauri::command]
pub async fn update_prescription(id: u64, data: PrescriptionPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let current = sqlx::query("SELECT status FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;
    if current.get::<String, _>("status") != "draft" {
        return Err("Only draft prescriptions can be updated.".into());
    }

    let prescribed_at = data.prescribed_at.as_deref().map(parse_datetime);

    sqlx::query("UPDATE prescriptions SET prescribed_at=COALESCE(?,prescribed_at), doctor_notes=?, updated_at=NOW() WHERE id=?")
        .bind(prescribed_at).bind(&data.doctor_notes).bind(id)
        .execute(&state.db).await?;

    // Soft-delete existing items to match PHP behavior
    sqlx::query("UPDATE prescription_items SET deleted_at=NOW() WHERE prescription_id=? AND deleted_at IS NULL")
        .bind(id).execute(&state.db).await?;

    for (i, item) in data.items.iter().enumerate() {
        sqlx::query(
            "INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
        )
        .bind(id).bind(&item.medicine_name).bind(&item.dosage)
        .bind(&item.frequency).bind(&item.duration).bind(&item.instructions)
        .bind(item.sort_order.unwrap_or(i as u32))
        .execute(&state.db).await?;
    }

    get_prescription(id, state).await
}

#[tauri::command]
pub async fn send_prescription(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let current = sqlx::query("SELECT status FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;
    if current.get::<String, _>("status") != "draft" {
        return Err("Only draft prescriptions can be sent.".into());
    }
    sqlx::query("UPDATE prescriptions SET status='sent_to_pharmacy', sent_to_pharmacy_at=NOW(), updated_at=NOW() WHERE id=?")
        .bind(id).execute(&state.db).await?;
    get_prescription(id, state).await
}

#[tauri::command]
pub async fn delete_prescription(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    let current = sqlx::query("SELECT status FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;
    if current.get::<String, _>("status") != "draft" {
        return Err("Only draft prescriptions can be deleted.".into());
    }
    // Soft-delete items first (match PHP)
    sqlx::query("UPDATE prescription_items SET deleted_at=NOW() WHERE prescription_id=? AND deleted_at IS NULL")
        .bind(id).execute(&state.db).await?;
    sqlx::query("UPDATE prescriptions SET deleted_at=NOW() WHERE id=?")
        .bind(id).execute(&state.db).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_patient_prescriptions_list(patient_id: u64, page: Option<u32>, state: State<'_, AppState>) -> AppResult<Value> {
    super::patients::get_patient_prescriptions(patient_id, page, state).await
}
