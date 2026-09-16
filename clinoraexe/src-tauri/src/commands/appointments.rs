use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct AppointmentPayload {
    pub patient_id:       u64,
    pub title:            Option<String>,
    pub scheduled_at:     String,
    pub duration_minutes: Option<u16>,
    pub status:           Option<String>,
    pub r#type:           Option<String>,
    pub notes:            Option<String>,
}

#[derive(Deserialize)]
pub struct AppointmentUpdatePayload {
    pub title:            Option<String>,
    pub scheduled_at:     Option<String>,
    pub duration_minutes: Option<u16>,
    pub status:           Option<String>,
    pub r#type:           Option<String>,
    pub notes:            Option<String>,
}

fn appt_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":               r.get::<u64, _>("id"),
        "patient_id":       r.get::<u64, _>("patient_id"),
        "title":            r.get::<Option<String>, _>("title"),
        "scheduled_at":     r.get::<Option<String>, _>("scheduled_at").unwrap_or_default(),
        "duration_minutes": r.get::<u16, _>("duration_minutes"),
        "status":           r.get::<String, _>("status"),
        "type":             r.get::<String, _>("type"),
        "notes":            r.get::<Option<String>, _>("notes"),
        "patient": {
            "id":     r.get::<u64, _>("patient_id"),
            "name":   r.get::<String, _>("patient_name"),
            "mobile": r.get::<Option<String>, _>("patient_mobile"),
        }
    })
}

static APPT_COLS: &str =
    "a.id, a.patient_id, a.title, a.duration_minutes, a.status, a.type, a.notes,
     DATE_FORMAT(a.scheduled_at,'%Y-%m-%dT%H:%i:%s') as scheduled_at,
     p.name as patient_name, p.mobile as patient_mobile";

#[tauri::command]
pub async fn list_appointments(
    date:   Option<String>,
    month:  Option<String>,
    status: Option<String>,
    state:  State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let mut conditions = vec![
        "a.user_id = ?".to_string(),
        "p.clinic_id = ?".to_string(),
        "p.deleted_at IS NULL".to_string(),
    ];
    let mut binds: Vec<String> = vec![
        session.id.to_string(),
        session.clinic_id.to_string(),
    ];

    if let Some(ref d) = date {
        conditions.push("DATE(a.scheduled_at) = ?".to_string());
        binds.push(d.clone());
    } else if let Some(ref m) = month {
        conditions.push("DATE_FORMAT(a.scheduled_at,'%Y-%m') = ?".to_string());
        binds.push(m.clone());
    } else {
        conditions.push("DATE(a.scheduled_at) >= CURDATE()".to_string());
    }

    if let Some(ref s) = status {
        if !s.is_empty() {
            conditions.push("a.status = ?".to_string());
            binds.push(s.clone());
        }
    }

    let sql = format!(
        "SELECT {} FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE {}
         ORDER BY a.scheduled_at ASC
         LIMIT 200",
        APPT_COLS,
        conditions.join(" AND ")
    );

    let mut q = sqlx::query(&sql);
    for b in &binds { q = q.bind(b) }
    let rows = q.fetch_all(&state.db).await?;

    Ok(json!(rows.iter().map(appt_row).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn get_appointment_calendar_days(
    month: String,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT DISTINCT DATE_FORMAT(a.scheduled_at,'%Y-%m-%d') as day
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.user_id = ? AND p.clinic_id = ?
           AND DATE_FORMAT(a.scheduled_at,'%Y-%m') = ?
           AND a.status IN ('scheduled','confirmed')
         ORDER BY day"
    )
    .bind(session.id)
    .bind(session.clinic_id)
    .bind(&month)
    .fetch_all(&state.db)
    .await?;

    let days: Vec<String> = rows.iter()
        .map(|r| r.get::<String, _>("day"))
        .collect();

    Ok(json!(days))
}

#[tauri::command]
pub async fn create_appointment(
    data:  AppointmentPayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(data.patient_id).bind(session.clinic_id)
    .fetch_one(&state.db).await?;
    if count == 0 { return Err("Patient not found.".into()); }

    let result = sqlx::query(
        "INSERT INTO appointments
         (patient_id, user_id, title, scheduled_at, duration_minutes, status, type, notes)
         VALUES (?,?,?,?,?,?,?,?)"
    )
    .bind(data.patient_id)
    .bind(session.id)
    .bind(&data.title)
    .bind(&data.scheduled_at)
    .bind(data.duration_minutes.unwrap_or(15))
    .bind(data.status.as_deref().unwrap_or("scheduled"))
    .bind(data.r#type.as_deref().unwrap_or("consultation"))
    .bind(&data.notes)
    .execute(&state.db).await?;

    let id = result.last_insert_id();
    let row = sqlx::query(&format!(
        "SELECT {} FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?",
        APPT_COLS
    ))
    .bind(id)
    .fetch_one(&state.db).await?;

    Ok(appt_row(&row))
}

#[tauri::command]
pub async fn update_appointment(
    id:    u64,
    data:  AppointmentUpdatePayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let mut sets: Vec<String> = vec![];
    let mut binds: Vec<String> = vec![];

    if let Some(ref v) = data.title            { sets.push("a.title = ?".into());            binds.push(v.clone()) }
    if let Some(ref v) = data.scheduled_at     { sets.push("a.scheduled_at = ?".into());     binds.push(v.clone()) }
    if let Some(v)     = data.duration_minutes { sets.push("a.duration_minutes = ?".into()); binds.push(v.to_string()) }
    if let Some(ref v) = data.status           { sets.push("a.status = ?".into());           binds.push(v.clone()) }
    if let Some(ref v) = data.r#type           { sets.push("a.type = ?".into());             binds.push(v.clone()) }
    if let Some(ref v) = data.notes            { sets.push("a.notes = ?".into());            binds.push(v.clone()) }

    if sets.is_empty() { return Err("Nothing to update.".into()); }

    let sql = format!(
        "UPDATE appointments a
         JOIN patients p ON p.id = a.patient_id
         SET {}
         WHERE a.id = ? AND a.user_id = ? AND p.clinic_id = ?",
        sets.join(", ")
    );

    let mut q = sqlx::query(&sql);
    for b in &binds { q = q.bind(b) }
    q.bind(id).bind(session.id).bind(session.clinic_id)
     .execute(&state.db).await?;

    let row = sqlx::query(&format!(
        "SELECT {} FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?",
        APPT_COLS
    ))
    .bind(id).fetch_one(&state.db).await?;

    Ok(appt_row(&row))
}

#[tauri::command]
pub async fn delete_appointment(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "DELETE a FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.id = ? AND a.user_id = ? AND p.clinic_id = ?"
    )
    .bind(id).bind(session.id).bind(session.clinic_id)
    .execute(&state.db).await?;

    Ok(json!({"message": "Deleted"}))
}

#[tauri::command]
pub async fn list_patient_appointments(
    patient_id: u64,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(&format!(
        "SELECT {} FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.patient_id = ? AND a.user_id = ? AND p.clinic_id = ?
         ORDER BY a.scheduled_at DESC LIMIT 20",
        APPT_COLS
    ))
    .bind(patient_id).bind(session.id).bind(session.clinic_id)
    .fetch_all(&state.db).await?;

    Ok(json!(rows.iter().map(appt_row).collect::<Vec<_>>()))
}
