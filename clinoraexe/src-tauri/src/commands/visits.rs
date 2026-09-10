use super::utils::parse_datetime;
use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct VisitPayload {
    pub visited_at: Option<String>,
    pub consultation_notes: Option<String>,
    pub consultation_fee: Option<f64>,
}

#[derive(Deserialize)]
pub struct PaymentPayload {
    pub payment_status: String,
    pub amount_paid: Option<f64>,
    pub payment_notes: Option<String>,
}

fn visit_row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.get::<u64, _>("id"),
        "patient_id": r.get::<u64, _>("patient_id"),
        "visited_at": r.get::<Option<String>, _>("visited_at").unwrap_or_default(),
        "consultation_notes": r.get::<Option<String>, _>("consultation_notes"),
        "consultation_fee": r.get::<Option<f64>, _>("consultation_fee").unwrap_or(0.0),
        "status": r.get::<String, _>("status"),
        "invoiced_at": r.get::<Option<String>, _>("invoiced_at"),
        "payment_status": r.get::<String, _>("payment_status"),
        "amount_paid": r.get::<f64, _>("amount_paid"),
        "payment_notes": r.get::<Option<String>, _>("payment_notes"),
        "patient": {
            "id": r.get::<u64, _>("patient_id"),
            "name": r.get::<String, _>("patient_name"),
            "mobile": r.get::<Option<String>, _>("patient_mobile")
        },
        "doctor": {
            "name": r.get::<String, _>("doctor_name")
        }
    })
}

static VISIT_COLS: &str =
    "v.id, v.patient_id, v.consultation_notes, v.status,
     v.payment_status, v.payment_notes,
     v.consultation_fee * 1e0 as consultation_fee,
     v.amount_paid * 1e0 as amount_paid,
     DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
     DATE_FORMAT(v.invoiced_at, '%Y-%m-%dT%H:%i:%s') as invoiced_at,
     p.name as patient_name, p.mobile as patient_mobile, u.name as doctor_name";

#[tauri::command]
pub async fn list_visits(
    q: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(20).min(200);
    let offset = (page - 1) * per_page;

    let mut conditions = vec![
        "v.clinic_id = ?".to_string(),
        "v.deleted_at IS NULL".to_string(),
        "p.deleted_at IS NULL".to_string(),
    ];
    let mut binds: Vec<String> = vec![session.clinic_id.to_string()];

    if let Some(ref s) = status {
        if !s.is_empty() {
            conditions.push("v.status = ?".to_string());
            binds.push(s.clone());
        }
    }
    if let Some(ref q) = q {
        if !q.trim().is_empty() {
            conditions.push("(p.name LIKE ? OR u.name LIKE ? OR v.consultation_notes LIKE ?)".to_string());
            let like = format!("%{}%", q.trim());
            binds.push(like.clone()); binds.push(like.clone()); binds.push(like);
        }
    }

    let where_clause = conditions.join(" AND ");
    let count_sql = format!(
        "SELECT COUNT(*) FROM visits v JOIN patients p ON p.id=v.patient_id JOIN users u ON u.id=v.doctor_id WHERE {}",
        where_clause
    );
    let list_sql = format!(
        "SELECT {} FROM visits v JOIN patients p ON p.id=v.patient_id JOIN users u ON u.id=v.doctor_id
         WHERE {} ORDER BY v.visited_at DESC LIMIT {} OFFSET {}",
        VISIT_COLS, where_clause, per_page, offset
    );

    let mut cq = sqlx::query(&count_sql);
    let mut lq = sqlx::query(&list_sql);
    for b in &binds { cq = cq.bind(b); lq = lq.bind(b); }

    let total: i64 = cq.fetch_one(&state.db).await?.get(0);
    let rows = lq.fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(visit_row_to_json).collect();
    let last_page = ((total as f64) / (per_page as f64)).ceil() as u32;

    Ok(json!({ "data": data, "total": total, "per_page": per_page, "current_page": page, "last_page": last_page.max(1) }))
}

#[tauri::command]
pub async fn create_visit(patient_id: u64, data: VisitPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    // Normalize any ISO 8601 datetime string to MySQL DATETIME format
    let visited_at = data.visited_at
        .as_deref()
        .map(parse_datetime)
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());

    let result = sqlx::query(
        "INSERT INTO visits (clinic_id, patient_id, doctor_id, visited_at, consultation_notes, consultation_fee, status, payment_status, amount_paid, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', 'unpaid', 0, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(patient_id).bind(session.id)
    .bind(&visited_at).bind(&data.consultation_notes).bind(data.consultation_fee.unwrap_or(0.0))
    .execute(&state.db).await?;

    get_visit(result.last_insert_id(), state).await
}

#[tauri::command]
pub async fn get_visit(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query(&format!(
        "SELECT {} FROM visits v JOIN patients p ON p.id=v.patient_id JOIN users u ON u.id=v.doctor_id
         WHERE v.id=? AND v.clinic_id=? AND v.deleted_at IS NULL",
        VISIT_COLS
    )).bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Visit not found.")?;

    let mut visit = visit_row_to_json(&row);

    let prx = sqlx::query(
        "SELECT id, status, DATE_FORMAT(prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at, doctor_notes
         FROM prescriptions WHERE visit_id=? AND deleted_at IS NULL"
    ).bind(id).fetch_all(&state.db).await?;

    let prescriptions: Vec<Value> = prx.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "status": r.get::<String, _>("status"),
        "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "doctor_notes": r.get::<Option<String>, _>("doctor_notes")
    })).collect();

    visit["prescriptions"] = json!(prescriptions);
    Ok(visit)
}

#[tauri::command]
pub async fn update_visit(id: u64, data: VisitPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let visited_at = data.visited_at.as_deref().map(parse_datetime);

    sqlx::query(
        "UPDATE visits SET visited_at=COALESCE(?,visited_at), consultation_notes=?, updated_at=NOW()
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(visited_at).bind(&data.consultation_notes)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    get_visit(id, state).await
}

#[tauri::command]
pub async fn update_visit_fee(id: u64, consultation_fee: f64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query("UPDATE visits SET consultation_fee=?, updated_at=NOW() WHERE id=? AND clinic_id=?")
        .bind(consultation_fee).bind(id).bind(session.clinic_id)
        .execute(&state.db).await?;
    get_visit(id, state).await
}

#[tauri::command]
pub async fn complete_visit(id: u64, consultation_fee: Option<f64>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query(
        "UPDATE visits SET status='completed', invoiced_at=NOW(), updated_at=NOW(),
         consultation_fee = COALESCE(?, consultation_fee)
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(consultation_fee).bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;
    get_visit(id, state).await
}

#[tauri::command]
pub async fn record_visit_payment(id: u64, data: PaymentPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    if !["paid", "partial", "unpaid"].contains(&data.payment_status.as_str()) {
        return Err("Invalid payment status.".into());
    }
    sqlx::query(
        "UPDATE visits SET payment_status=?, amount_paid=?, payment_notes=?, updated_at=NOW()
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(&data.payment_status).bind(data.amount_paid.unwrap_or(0.0))
    .bind(&data.payment_notes).bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;
    get_visit(id, state).await
}
