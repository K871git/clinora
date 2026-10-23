use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn get_patient_timeline(patient_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let ok: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(patient_id).bind(session.clinic_id)
    .fetch_one(&state.db).await?;
    if ok == 0 { return Err("Patient not found.".into()); }

    let mut events: Vec<Value> = vec![];

    // Visits
    let visits = sqlx::query(
        "SELECT id, DATE_FORMAT(visited_at, '%Y-%m-%dT%H:%i:%s') as event_date,
                consultation_notes, status, consultation_fee * 1e0 as fee
         FROM visits WHERE patient_id = ? AND deleted_at IS NULL
         ORDER BY visited_at DESC LIMIT 50"
    )
    .bind(patient_id)
    .fetch_all(&state.db).await?;
    for r in &visits {
        events.push(json!({
            "type":   "visit",
            "id":     r.get::<u64, _>("id"),
            "date":   r.get::<Option<String>, _>("event_date"),
            "detail": r.get::<Option<String>, _>("consultation_notes"),
            "status": r.get::<String, _>("status"),
            "fee":    r.get::<f64, _>("fee"),
        }));
    }

    // Vitals
    let vitals = sqlx::query(
        "SELECT id, DATE_FORMAT(recorded_at, '%Y-%m-%dT%H:%i:%s') as event_date, notes
         FROM vital_signs WHERE patient_id = ?
         ORDER BY recorded_at DESC LIMIT 30"
    )
    .bind(patient_id)
    .fetch_all(&state.db).await?;
    for r in &vitals {
        events.push(json!({
            "type":   "vital",
            "id":     r.get::<u64, _>("id"),
            "date":   r.get::<Option<String>, _>("event_date"),
            "detail": r.get::<Option<String>, _>("notes"),
        }));
    }

    // Lab Reports
    let labs = sqlx::query(
        "SELECT id, report_name, lab_name, status,
                DATE_FORMAT(COALESCE(received_at, ordered_at, created_at), '%Y-%m-%dT%H:%i:%s') as event_date
         FROM lab_reports WHERE patient_id = ?
         ORDER BY event_date DESC LIMIT 30"
    )
    .bind(patient_id)
    .fetch_all(&state.db).await?;
    for r in &labs {
        events.push(json!({
            "type":   "lab",
            "id":     r.get::<u64, _>("id"),
            "date":   r.get::<Option<String>, _>("event_date"),
            "name":   r.get::<String, _>("report_name"),
            "lab":    r.get::<Option<String>, _>("lab_name"),
            "status": r.get::<String, _>("status"),
        }));
    }

    // Appointments
    let appts = sqlx::query(
        "SELECT id, DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%s') as event_date,
                title, type as appt_type, status
         FROM appointments WHERE patient_id = ?
         ORDER BY scheduled_at DESC LIMIT 20"
    )
    .bind(patient_id)
    .fetch_all(&state.db).await?;
    for r in &appts {
        events.push(json!({
            "type":      "appointment",
            "id":        r.get::<u64, _>("id"),
            "date":      r.get::<Option<String>, _>("event_date"),
            "title":     r.get::<Option<String>, _>("title"),
            "appt_type": r.get::<String, _>("appt_type"),
            "status":    r.get::<String, _>("status"),
        }));
    }

    // Sort all events by date descending
    events.sort_by(|a, b| {
        let da = a["date"].as_str().unwrap_or("");
        let db = b["date"].as_str().unwrap_or("");
        db.cmp(da)
    });

    Ok(json!(events))
}
