use super::utils::parse_datetime;
use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

fn rx_pdf_output_dir(clinic_id: u64) -> std::path::PathBuf {
    std::env::current_exe()
        .unwrap_or_default()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default()
        .join("data")
        .join("generated_prescriptions")
        .join(clinic_id.to_string())
}

/// Generate a filled prescription PDF in the background (best-effort; errors are silently ignored).
async fn maybe_generate_pdf(
    prescription_id: u64,
    clinic_id: u64,
    db: &sqlx::MySqlPool,
) {
    // Fetch prescription + patient + doctor + items
    let row = match sqlx::query(
        "SELECT pr.doctor_notes, pr.prescribed_at,
                p.name AS patient_name,
                u.name AS doctor_name,
                cs.prescription_template
         FROM prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         JOIN users u    ON u.id = pr.doctor_id
         LEFT JOIN clinic_settings cs ON cs.clinic_id = pr.clinic_id
         WHERE pr.id = ? AND pr.clinic_id = ?"
    ).bind(prescription_id).bind(clinic_id)
     .fetch_optional(db).await
    {
        Ok(Some(r)) => r,
        _ => return,
    };

    let tpl_name: Option<String> = row.get("prescription_template");
    let tpl_name = match tpl_name { Some(n) if !n.trim().is_empty() => n, _ => return };

    // Build template path
    let tpl_dir = match super::settings::templates_dir_pub(clinic_id) {
        Ok(d) => d,
        Err(_) => return,
    };
    let tpl_path = tpl_dir.join(&tpl_name);
    if !tpl_path.exists() { return; }
    let tpl_str = tpl_path.to_string_lossy().to_string();

    // Only PDF templates get scanned; for images use fallback layout
    let ext = tpl_name.rsplit('.').next().unwrap_or("").to_lowercase();
    if ext != "pdf" { return; }

    // Scan layout
    let layout_json = super::settings::pdf_scan_layout(&tpl_str);
    let layout = super::rx_pdf::Layout::from_scan(&layout_json);

    // Fetch medicines
    let items = match sqlx::query(
        "SELECT medicine_name, dosage, duration, instructions FROM prescription_items
         WHERE prescription_id = ? AND deleted_at IS NULL ORDER BY sort_order"
    ).bind(prescription_id).fetch_all(db).await {
        Ok(rows) => rows,
        Err(_) => return,
    };

    let medicines: Vec<super::rx_pdf::MedItem> = items.iter().enumerate().map(|(i, r)| {
        super::rx_pdf::MedItem {
            num: i + 1,
            name: r.get::<String, _>("medicine_name"),
            dosage: r.get::<Option<String>, _>("dosage"),
            duration: r.get::<Option<String>, _>("duration"),
            instructions: r.get::<Option<String>, _>("instructions"),
        }
    }).collect();

    // Parse date
    let prescribed_at: String = row.get::<Option<String>, _>("prescribed_at").unwrap_or_default();
    let (dd, mm, yyyy) = parse_date_parts(&prescribed_at);

    let rx = super::rx_pdf::RxData {
        patient_name: row.get("patient_name"),
        date_dd: dd, date_mm: mm, date_yyyy: yyyy,
        medicines,
        doctor_notes: row.get("doctor_notes"),
        doctor_name: row.get("doctor_name"),
    };

    // Output path
    let out_dir = rx_pdf_output_dir(clinic_id);
    let out_path = out_dir.join(format!("rx_{}.pdf", prescription_id));
    let out_str  = out_path.to_string_lossy().to_string();

    if let Ok(()) = super::rx_pdf::generate(&tpl_str, &out_str, &layout, &rx) {
        // Update pdf_path in DB (ignore errors)
        let _ = sqlx::query("UPDATE prescriptions SET pdf_path=? WHERE id=?")
            .bind(&out_str.replace('\\', "/"))
            .bind(prescription_id)
            .execute(db).await;
    }
}

fn parse_date_parts(s: &str) -> (u32, u32, i32) {
    // "2026-10-06T..." → (6, 10, 2026)
    let date_part = s.split('T').next().unwrap_or("");
    let parts: Vec<&str> = date_part.split('-').collect();
    let yyyy = parts.first().and_then(|v| v.parse().ok()).unwrap_or(2026);
    let mm   = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(1);
    let dd   = parts.get(2).and_then(|v| v.parse().ok()).unwrap_or(1);
    (dd, mm, yyyy)
}

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

    if !data.items.is_empty() {
        let rows = data.items.iter().map(|_| "(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())").collect::<Vec<_>>().join(", ");
        let sql = format!(
            "INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions, sort_order, created_at, updated_at) VALUES {}",
            rows
        );
        let mut q = sqlx::query(&sql);
        for (i, item) in data.items.iter().enumerate() {
            q = q.bind(prescription_id).bind(&item.medicine_name).bind(&item.dosage)
                 .bind(&item.frequency).bind(&item.duration).bind(&item.instructions)
                 .bind(item.sort_order.unwrap_or(i as u32));
        }
        q.execute(&state.db).await?;
    }

    crate::commands::audit::log_audit(
        &state.db, session.clinic_id, session.id, "create", "prescription", prescription_id, None
    ).await;

    // Generate PDF in background (best-effort)
    let db2 = state.db.clone();
    let cid = session.clinic_id;
    tokio::spawn(async move { maybe_generate_pdf(prescription_id, cid, &db2).await });

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
                v.consultation_notes, v.diagnosis
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
        "visit": { "id": row.get::<u64, _>("visit_id"), "visited_at": row.get::<Option<String>, _>("visited_at"), "consultation_notes": row.get::<Option<String>, _>("consultation_notes"), "diagnosis": row.get::<Option<String>, _>("diagnosis") }
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

    if !data.items.is_empty() {
        let rows = data.items.iter().map(|_| "(?, ?, ?, ?, ?, ?, ?, NOW(), NOW())").collect::<Vec<_>>().join(", ");
        let sql = format!(
            "INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration, instructions, sort_order, created_at, updated_at) VALUES {}",
            rows
        );
        let mut q = sqlx::query(&sql);
        for (i, item) in data.items.iter().enumerate() {
            q = q.bind(id).bind(&item.medicine_name).bind(&item.dosage)
                 .bind(&item.frequency).bind(&item.duration).bind(&item.instructions)
                 .bind(item.sort_order.unwrap_or(i as u32));
        }
        q.execute(&state.db).await?;
    }

    crate::commands::audit::log_audit(
        &state.db, session.clinic_id, session.id, "update", "prescription", id, None
    ).await;

    // Regenerate PDF in background
    let db2 = state.db.clone();
    let cid = session.clinic_id;
    tokio::spawn(async move { maybe_generate_pdf(id, cid, &db2).await });

    get_prescription(id, state).await
}

/// Open the stored prescription PDF in the system viewer (for printing from list pages).
#[tauri::command]
pub async fn open_rx_pdf(id: u64, state: State<'_, AppState>) -> AppResult<String> {
    let session = get_session(&state)?;
    let row = sqlx::query("SELECT pdf_path FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id)
        .fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;

    let path: Option<String> = row.get("pdf_path");
    let path = path.ok_or("No PDF generated for this prescription yet.")?;

    // Return the path; frontend uses convertFileSrc or tauri-plugin-opener
    Ok(path)
}

/// Re-generate the PDF for a prescription (e.g. if template changed).
#[tauri::command]
pub async fn regenerate_rx_pdf(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;
    let db2 = state.db.clone();
    // Run synchronously so the frontend gets a result
    maybe_generate_pdf(id, cid, &db2).await;
    // Return updated prescription
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
    crate::commands::audit::log_audit(
        &state.db, session.clinic_id, session.id, "delete", "prescription", id, None
    ).await;
    Ok(())
}

#[tauri::command]
pub async fn get_patient_prescriptions_list(patient_id: u64, page: Option<u32>, state: State<'_, AppState>) -> AppResult<Value> {
    super::patients::get_patient_prescriptions(patient_id, page, state).await
}
