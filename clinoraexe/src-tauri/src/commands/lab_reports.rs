use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct LabReportPayload {
    pub visit_id:    Option<u64>,
    pub report_name: String,
    pub lab_name:    Option<String>,
    pub notes:       Option<String>,
    pub status:      Option<String>,
    pub ordered_at:  Option<String>,
    pub received_at: Option<String>,
}

#[derive(Deserialize)]
pub struct LabReportUpdatePayload {
    pub report_name: Option<String>,
    pub lab_name:    Option<String>,
    pub notes:       Option<String>,
    pub status:      Option<String>,
    pub ordered_at:  Option<String>,
    pub received_at: Option<String>,
}

fn lab_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":          r.get::<u64, _>("id"),
        "patient_id":  r.get::<u64, _>("patient_id"),
        "visit_id":    r.get::<Option<u64>, _>("visit_id"),
        "report_name": r.get::<String, _>("report_name"),
        "lab_name":    r.get::<Option<String>, _>("lab_name"),
        "notes":       r.get::<Option<String>, _>("notes"),
        "status":      r.get::<String, _>("status"),
        "ordered_at":  r.get::<Option<String>, _>("ordered_at"),
        "received_at": r.get::<Option<String>, _>("received_at"),
        "created_at":  r.get::<Option<String>, _>("created_at").unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn list_lab_reports(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT lr.* FROM lab_reports lr
         JOIN patients p ON p.id = lr.patient_id
         WHERE lr.patient_id = ? AND p.clinic_id = ?
         ORDER BY lr.created_at DESC LIMIT 100"
    )
    .bind(patient_id).bind(session.clinic_id)
    .fetch_all(&state.db).await?;

    Ok(json!(rows.iter().map(lab_row).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn create_lab_report(
    patient_id: u64,
    data: LabReportPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(patient_id).bind(session.clinic_id)
    .fetch_one(&state.db).await?;
    if count == 0 { return Err("Patient not found.".into()); }

    let result = sqlx::query(
        "INSERT INTO lab_reports
         (patient_id, visit_id, report_name, lab_name, notes, status, ordered_at, received_at)
         VALUES (?,?,?,?,?,?,?,?)"
    )
    .bind(patient_id)
    .bind(data.visit_id)
    .bind(&data.report_name)
    .bind(&data.lab_name)
    .bind(&data.notes)
    .bind(data.status.as_deref().unwrap_or("ordered"))
    .bind(&data.ordered_at)
    .bind(&data.received_at)
    .execute(&state.db).await?;

    let row = sqlx::query("SELECT * FROM lab_reports WHERE id = ?")
        .bind(result.last_insert_id())
        .fetch_one(&state.db).await?;

    Ok(lab_row(&row))
}

#[tauri::command]
pub async fn update_lab_report(
    id: u64,
    data: LabReportUpdatePayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let mut sets: Vec<&str> = vec![];
    if data.report_name.is_some() { sets.push("lr.report_name = ?") }
    if data.lab_name.is_some()    { sets.push("lr.lab_name = ?") }
    if data.notes.is_some()       { sets.push("lr.notes = ?") }
    if data.status.is_some()      { sets.push("lr.status = ?") }
    if data.ordered_at.is_some()  { sets.push("lr.ordered_at = ?") }
    if data.received_at.is_some() { sets.push("lr.received_at = ?") }

    if sets.is_empty() { return Err("Nothing to update.".into()); }

    let sql = format!(
        "UPDATE lab_reports lr
         JOIN patients p ON p.id = lr.patient_id
         SET {}
         WHERE lr.id = ? AND p.clinic_id = ?",
        sets.join(", ")
    );

    let mut q = sqlx::query(&sql);
    if let Some(ref v) = data.report_name { q = q.bind(v) }
    if let Some(ref v) = data.lab_name    { q = q.bind(v) }
    if let Some(ref v) = data.notes       { q = q.bind(v) }
    if let Some(ref v) = data.status      { q = q.bind(v) }
    if let Some(ref v) = data.ordered_at  { q = q.bind(v) }
    if let Some(ref v) = data.received_at { q = q.bind(v) }
    q.bind(id).bind(session.clinic_id).execute(&state.db).await?;

    let row = sqlx::query("SELECT * FROM lab_reports WHERE id = ?")
        .bind(id).fetch_one(&state.db).await?;

    Ok(lab_row(&row))
}

#[tauri::command]
pub async fn delete_lab_report(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "DELETE lr FROM lab_reports lr
         JOIN patients p ON p.id = lr.patient_id
         WHERE lr.id = ? AND p.clinic_id = ?"
    )
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    Ok(json!({"message": "Deleted"}))
}
