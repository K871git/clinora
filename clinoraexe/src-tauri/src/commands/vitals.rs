use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct VitalPayload {
    pub visit_id:         Option<u64>,
    pub bp_systolic:      Option<u16>,
    pub bp_diastolic:     Option<u16>,
    pub pulse:            Option<u16>,
    pub temperature:      Option<f64>,
    pub weight:           Option<f64>,
    pub height:           Option<f64>,
    pub spo2:             Option<u8>,
    pub respiratory_rate: Option<u16>,
    pub blood_group:      Option<String>,
    pub notes:            Option<String>,
    pub recorded_at:      Option<String>,
}

fn vital_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":               r.get::<u64, _>("id"),
        "patient_id":       r.get::<u64, _>("patient_id"),
        "visit_id":         r.get::<Option<u64>, _>("visit_id"),
        "bp_systolic":      r.get::<Option<u16>, _>("bp_systolic"),
        "bp_diastolic":     r.get::<Option<u16>, _>("bp_diastolic"),
        "pulse":            r.get::<Option<u16>, _>("pulse"),
        "temperature":      r.get::<Option<f64>, _>("temperature"),
        "weight":           r.get::<Option<f64>, _>("weight"),
        "height":           r.get::<Option<f64>, _>("height"),
        "spo2":             r.get::<Option<u8>,  _>("spo2"),
        "respiratory_rate": r.get::<Option<u16>, _>("respiratory_rate"),
        "blood_group":      r.get::<Option<String>, _>("blood_group"),
        "notes":            r.get::<Option<String>, _>("notes"),
        "recorded_at":      r.get::<Option<String>, _>("recorded_at").unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn list_vitals(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT vs.* FROM vital_signs vs
         JOIN patients p ON p.id = vs.patient_id
         WHERE vs.patient_id = ? AND p.clinic_id = ?
         ORDER BY vs.recorded_at DESC
         LIMIT 100"
    )
    .bind(patient_id)
    .bind(session.clinic_id)
    .fetch_all(&state.db)
    .await?;

    Ok(json!(rows.iter().map(vital_row).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn get_latest_vitals(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query(
        "SELECT vs.* FROM vital_signs vs
         JOIN patients p ON p.id = vs.patient_id
         WHERE vs.patient_id = ? AND p.clinic_id = ?
         ORDER BY vs.recorded_at DESC LIMIT 1"
    )
    .bind(patient_id)
    .bind(session.clinic_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(row.as_ref().map(vital_row).unwrap_or(Value::Null))
}

#[tauri::command]
pub async fn create_vital(
    patient_id: u64,
    data: VitalPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    // Verify patient belongs to clinic
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(patient_id)
    .bind(session.clinic_id)
    .fetch_one(&state.db)
    .await?;
    if count == 0 { return Err("Patient not found.".into()); }

    let recorded_at = data.recorded_at.unwrap_or_else(|| {
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
    });

    let result = sqlx::query(
        "INSERT INTO vital_signs
         (patient_id, visit_id, bp_systolic, bp_diastolic, pulse, temperature,
          weight, height, spo2, respiratory_rate, blood_group, notes, recorded_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    )
    .bind(patient_id)
    .bind(data.visit_id)
    .bind(data.bp_systolic)
    .bind(data.bp_diastolic)
    .bind(data.pulse)
    .bind(data.temperature)
    .bind(data.weight)
    .bind(data.height)
    .bind(data.spo2)
    .bind(data.respiratory_rate)
    .bind(&data.blood_group)
    .bind(&data.notes)
    .bind(&recorded_at)
    .execute(&state.db)
    .await?;

    let id = result.last_insert_id();
    let row = sqlx::query("SELECT * FROM vital_signs WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    Ok(vital_row(&row))
}

#[tauri::command]
pub async fn update_vital(
    id: u64,
    data: VitalPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "UPDATE vital_signs vs
         JOIN patients p ON p.id = vs.patient_id
         SET vs.bp_systolic=?, vs.bp_diastolic=?, vs.pulse=?, vs.temperature=?,
             vs.weight=?, vs.height=?, vs.spo2=?, vs.respiratory_rate=?,
             vs.blood_group=?, vs.notes=?
         WHERE vs.id = ? AND p.clinic_id = ?"
    )
    .bind(data.bp_systolic).bind(data.bp_diastolic).bind(data.pulse)
    .bind(data.temperature).bind(data.weight).bind(data.height)
    .bind(data.spo2).bind(data.respiratory_rate)
    .bind(&data.blood_group).bind(&data.notes)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db)
    .await?;

    let row = sqlx::query("SELECT * FROM vital_signs WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    Ok(vital_row(&row))
}

#[tauri::command]
pub async fn delete_vital(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "DELETE vs FROM vital_signs vs
         JOIN patients p ON p.id = vs.patient_id
         WHERE vs.id = ? AND p.clinic_id = ?"
    )
    .bind(id).bind(session.clinic_id)
    .execute(&state.db)
    .await?;

    Ok(json!({"message": "Deleted"}))
}
