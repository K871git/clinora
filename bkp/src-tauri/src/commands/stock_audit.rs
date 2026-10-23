use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn get_stock_audit_log(
    item_type: String,
    item_id: u64,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT id, item_type, item_id, item_name, old_qty, new_qty, change_delta,
                reason, prescription_id, notes,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') as created_at
         FROM stock_audit_log
         WHERE clinic_id=? AND item_type=? AND item_id=?
         ORDER BY created_at DESC
         LIMIT 100"
    )
    .bind(session.clinic_id)
    .bind(&item_type)
    .bind(item_id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id":              r.get::<u64, _>("id"),
        "item_type":       r.get::<String, _>("item_type"),
        "item_id":         r.get::<u64, _>("item_id"),
        "item_name":       r.get::<String, _>("item_name"),
        "old_qty":         r.get::<i32, _>("old_qty"),
        "new_qty":         r.get::<i32, _>("new_qty"),
        "change_delta":    r.get::<i32, _>("change_delta"),
        "reason":          r.get::<String, _>("reason"),
        "prescription_id": r.get::<Option<u64>, _>("prescription_id"),
        "notes":           r.get::<Option<String>, _>("notes"),
        "created_at":      r.get::<String, _>("created_at"),
    })).collect();

    Ok(json!({ "data": data }))
}
