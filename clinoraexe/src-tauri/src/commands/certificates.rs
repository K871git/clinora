use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;
use crate::{error::AppResult, state::{get_session, AppState}};

#[derive(Deserialize)]
pub struct CertPayload {
    pub patient_id: u64,
    pub visit_id:   Option<u64>,
    pub cert_type:  String,
    pub purpose:    Option<String>,
    pub valid_from: Option<String>,
    pub valid_until: Option<String>,
    pub notes:      Option<String>,
}

fn row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":          r.get::<u64, _>("id"),
        "clinic_id":   r.get::<u64, _>("clinic_id"),
        "patient_id":  r.get::<u64, _>("patient_id"),
        "visit_id":    r.get::<Option<u64>, _>("visit_id"),
        "doctor_id":   r.get::<u64, _>("doctor_id"),
        "cert_type":   r.get::<String, _>("cert_type"),
        "purpose":     r.get::<Option<String>, _>("purpose"),
        "valid_from":  r.get::<Option<String>, _>("valid_from"),
        "valid_until": r.get::<Option<String>, _>("valid_until"),
        "notes":       r.get::<Option<String>, _>("notes"),
        "created_at":  r.get::<Option<String>, _>("created_at").unwrap_or_default(),
        "patient_name":   r.get::<Option<String>, _>("patient_name").unwrap_or_default(),
        "patient_age":    r.get::<Option<u32>, _>("patient_age"),
        "patient_gender": r.get::<Option<String>, _>("patient_gender"),
        "patient_mobile": r.get::<Option<String>, _>("patient_mobile"),
        "doctor_name":    r.get::<Option<String>, _>("doctor_name").unwrap_or_default(),
    })
}

static CERT_SELECT: &str =
    "SELECT mc.id, mc.clinic_id, mc.patient_id, mc.visit_id, mc.doctor_id,
            mc.cert_type, mc.purpose, mc.notes,
            DATE_FORMAT(mc.valid_from,  '%Y-%m-%d') as valid_from,
            DATE_FORMAT(mc.valid_until, '%Y-%m-%d') as valid_until,
            DATE_FORMAT(mc.created_at,  '%Y-%m-%dT%H:%i:%s') as created_at,
            p.name   as patient_name,
            p.age    as patient_age,
            p.gender as patient_gender,
            p.mobile as patient_mobile,
            u.name   as doctor_name
     FROM medical_certificates mc
     JOIN patients p ON p.id = mc.patient_id
     JOIN users   u ON u.id = mc.doctor_id";

#[tauri::command]
pub async fn create_certificate(data: CertPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let cert_type = data.cert_type.trim().to_lowercase();
    let valid_types = ["fitness", "sick_leave", "medico_legal", "custom"];
    if !valid_types.contains(&cert_type.as_str()) {
        return Err("Invalid certificate type.".into());
    }

    let result = sqlx::query(
        "INSERT INTO medical_certificates
         (clinic_id, patient_id, visit_id, doctor_id, cert_type, purpose, valid_from, valid_until, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id)
    .bind(data.patient_id)
    .bind(data.visit_id)
    .bind(session.id)
    .bind(&cert_type)
    .bind(data.purpose.as_deref().filter(|s| !s.trim().is_empty()))
    .bind(data.valid_from.as_deref().filter(|s| !s.trim().is_empty()))
    .bind(data.valid_until.as_deref().filter(|s| !s.trim().is_empty()))
    .bind(data.notes.as_deref().filter(|s| !s.trim().is_empty()))
    .execute(&state.db)
    .await?;

    let cert_id = result.last_insert_id();
    get_certificate(cert_id, state).await
}

#[tauri::command]
pub async fn get_certificate(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let query = format!(
        "{} WHERE mc.id=? AND mc.clinic_id=? AND mc.deleted_at IS NULL",
        CERT_SELECT
    );
    let row = sqlx::query(&query)
        .bind(id)
        .bind(session.clinic_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or("Certificate not found.")?;
    Ok(row_to_json(&row))
}

#[tauri::command]
pub async fn list_patient_certificates(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let query = format!(
        "{} WHERE mc.patient_id=? AND mc.clinic_id=? AND mc.deleted_at IS NULL ORDER BY mc.created_at DESC",
        CERT_SELECT
    );
    let rows = sqlx::query(&query)
        .bind(patient_id)
        .bind(session.clinic_id)
        .fetch_all(&state.db)
        .await?;
    let data: Vec<Value> = rows.iter().map(row_to_json).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn delete_certificate(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query(
        "UPDATE medical_certificates SET deleted_at=NOW() WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(id)
    .bind(session.clinic_id)
    .execute(&state.db)
    .await?;
    Ok(json!({ "ok": true }))
}
