use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

/// Write one audit entry — fire-and-forget.
/// Audit failure must never block or surface to the user.
pub async fn log_audit(
    db:        &sqlx::MySqlPool,
    clinic_id: u64,
    actor_id:  u64,
    action:    &str,
    entity:    &str,
    entity_id: u64,
    detail:    Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO audit_log (clinic_id, actor_id, action, entity, entity_id, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())"
    )
    .bind(clinic_id)
    .bind(actor_id)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(detail)
    .execute(db)
    .await;
}

#[tauri::command]
pub async fn list_audit_log(
    entity:    Option<String>,
    entity_id: Option<u64>,
    limit:     Option<u32>,
    state:     State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let lim = limit.unwrap_or(50).min(200) as u64;

    // Use different query shapes to avoid format!() with user-controlled strings.
    let rows = match (&entity, entity_id) {
        (Some(e), Some(eid)) => sqlx::query(
            "SELECT a.id, a.action, a.entity, a.entity_id, a.detail,
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                    u.name as actor_name
             FROM audit_log a JOIN users u ON u.id = a.actor_id
             WHERE a.clinic_id = ? AND a.entity = ? AND a.entity_id = ?
             ORDER BY a.created_at DESC LIMIT ?"
        ).bind(session.clinic_id).bind(e).bind(eid).bind(lim)
         .fetch_all(&state.db).await?,

        (Some(e), None) => sqlx::query(
            "SELECT a.id, a.action, a.entity, a.entity_id, a.detail,
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                    u.name as actor_name
             FROM audit_log a JOIN users u ON u.id = a.actor_id
             WHERE a.clinic_id = ? AND a.entity = ?
             ORDER BY a.created_at DESC LIMIT ?"
        ).bind(session.clinic_id).bind(e).bind(lim)
         .fetch_all(&state.db).await?,

        _ => sqlx::query(
            "SELECT a.id, a.action, a.entity, a.entity_id, a.detail,
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                    u.name as actor_name
             FROM audit_log a JOIN users u ON u.id = a.actor_id
             WHERE a.clinic_id = ?
             ORDER BY a.created_at DESC LIMIT ?"
        ).bind(session.clinic_id).bind(lim)
         .fetch_all(&state.db).await?,
    };

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id":         r.get::<u64, _>("id"),
        "action":     r.get::<String, _>("action"),
        "entity":     r.get::<String, _>("entity"),
        "entity_id":  r.get::<u64, _>("entity_id"),
        "detail":     r.get::<Option<String>, _>("detail"),
        "created_at": r.get::<Option<String>, _>("created_at"),
        "actor_name": r.get::<String, _>("actor_name"),
    })).collect();

    Ok(json!({ "data": data }))
}
