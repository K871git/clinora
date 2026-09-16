use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct MedHistPayload {
    pub r#type:       String,
    pub title:        String,
    pub description:  Option<String>,
    pub severity:     Option<String>,
    pub diagnosed_at: Option<String>,
    pub is_active:    Option<bool>,
}

#[derive(Deserialize)]
pub struct MedHistUpdatePayload {
    pub r#type:       Option<String>,
    pub title:        Option<String>,
    pub description:  Option<String>,
    pub severity:     Option<String>,
    pub diagnosed_at: Option<String>,
    pub is_active:    Option<bool>,
}

fn hist_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":           r.get::<u64, _>("id"),
        "patient_id":   r.get::<u64, _>("patient_id"),
        "type":         r.get::<String, _>("type"),
        "title":        r.get::<String, _>("title"),
        "description":  r.get::<Option<String>, _>("description"),
        "severity":     r.get::<Option<String>, _>("severity"),
        "diagnosed_at": r.get::<Option<String>, _>("diagnosed_at"),
        "is_active":    r.get::<bool, _>("is_active"),
        "created_at":   r.get::<Option<String>, _>("created_at").unwrap_or_default(),
    })
}

fn verify_patient_sql() -> &'static str {
    "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
}

#[tauri::command]
pub async fn list_medical_history(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT mh.* FROM medical_histories mh
         JOIN patients p ON p.id = mh.patient_id
         WHERE mh.patient_id = ? AND p.clinic_id = ?
         ORDER BY mh.is_active DESC, mh.diagnosed_at DESC, mh.created_at DESC"
    )
    .bind(patient_id)
    .bind(session.clinic_id)
    .fetch_all(&state.db)
    .await?;

    Ok(json!(rows.iter().map(hist_row).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn create_medical_history(
    patient_id: u64,
    data: MedHistPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let count: i64 = sqlx::query_scalar(verify_patient_sql())
        .bind(patient_id).bind(session.clinic_id)
        .fetch_one(&state.db).await?;
    if count == 0 { return Err("Patient not found.".into()); }

    let is_active = data.is_active.unwrap_or(true);
    let result = sqlx::query(
        "INSERT INTO medical_histories
         (patient_id, type, title, description, severity, diagnosed_at, is_active)
         VALUES (?,?,?,?,?,?,?)"
    )
    .bind(patient_id)
    .bind(&data.r#type)
    .bind(&data.title)
    .bind(&data.description)
    .bind(&data.severity)
    .bind(&data.diagnosed_at)
    .bind(is_active)
    .execute(&state.db)
    .await?;

    let row = sqlx::query("SELECT * FROM medical_histories WHERE id = ?")
        .bind(result.last_insert_id())
        .fetch_one(&state.db).await?;

    Ok(hist_row(&row))
}

#[tauri::command]
pub async fn update_medical_history(
    id: u64,
    data: MedHistUpdatePayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    // Build dynamic SET clause
    let mut sets: Vec<&str> = vec![];
    if data.r#type.is_some()       { sets.push("type = ?") }
    if data.title.is_some()        { sets.push("title = ?") }
    if data.description.is_some()  { sets.push("description = ?") }
    if data.severity.is_some()     { sets.push("severity = ?") }
    if data.diagnosed_at.is_some() { sets.push("diagnosed_at = ?") }
    if data.is_active.is_some()    { sets.push("is_active = ?") }

    if sets.is_empty() { return Err("Nothing to update.".into()); }

    let sql = format!(
        "UPDATE medical_histories mh
         JOIN patients p ON p.id = mh.patient_id
         SET {}
         WHERE mh.id = ? AND p.clinic_id = ?",
        sets.join(", ")
    );

    let mut q = sqlx::query(&sql);
    if let Some(v) = &data.r#type       { q = q.bind(v) }
    if let Some(v) = &data.title        { q = q.bind(v) }
    if let Some(v) = &data.description  { q = q.bind(v) }
    if let Some(v) = &data.severity     { q = q.bind(v) }
    if let Some(v) = &data.diagnosed_at { q = q.bind(v) }
    if let Some(v) = data.is_active     { q = q.bind(v) }
    q.bind(id).bind(session.clinic_id).execute(&state.db).await?;

    let row = sqlx::query("SELECT * FROM medical_histories WHERE id = ?")
        .bind(id).fetch_one(&state.db).await?;

    Ok(hist_row(&row))
}

#[tauri::command]
pub async fn delete_medical_history(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "DELETE mh FROM medical_histories mh
         JOIN patients p ON p.id = mh.patient_id
         WHERE mh.id = ? AND p.clinic_id = ?"
    )
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    Ok(json!({"message": "Deleted"}))
}

#[tauri::command]
pub async fn get_patient_allergies(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let ok: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(patient_id).bind(session.clinic_id)
    .fetch_one(&state.db).await?;
    if ok == 0 { return Err("Patient not found.".into()); }

    let rows = sqlx::query(
        "SELECT id, title, severity, description
         FROM medical_histories
         WHERE patient_id = ? AND type = 'allergy' AND is_active = 1"
    )
    .bind(patient_id)
    .fetch_all(&state.db).await?;

    let allergies: Vec<Value> = rows.iter().map(|r| json!({
        "id":          r.get::<u64, _>("id"),
        "title":       r.get::<String, _>("title"),
        "severity":    r.get::<Option<String>, _>("severity"),
        "description": r.get::<Option<String>, _>("description"),
    })).collect();

    Ok(json!(allergies))
}
