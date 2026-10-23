use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct RxTemplatePayload {
    pub name: String,
    pub medicines: Value,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn get_rx_templates(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT id, name, medicines, notes,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') as created_at
         FROM rx_prescription_templates
         WHERE clinic_id=? ORDER BY name ASC"
    ).bind(session.clinic_id).fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| {
        let medicines_str: String = r.get("medicines");
        let medicines: Value = serde_json::from_str(&medicines_str).unwrap_or(Value::Array(vec![]));
        json!({
            "id":         r.get::<u64, _>("id"),
            "name":       r.get::<String, _>("name"),
            "medicines":  medicines,
            "notes":      r.get::<Option<String>, _>("notes"),
            "created_at": r.get::<Option<String>, _>("created_at").unwrap_or_default(),
        })
    }).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn save_rx_template(data: RxTemplatePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let name = data.name.trim().to_string();
    if name.is_empty() {
        return Err("Template name is required.".into());
    }
    let medicines_str = serde_json::to_string(&data.medicines)
        .map_err(|_| "Invalid medicines data.")?;

    let result = sqlx::query(
        "INSERT INTO rx_prescription_templates (clinic_id, name, medicines, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())"
    ).bind(session.clinic_id).bind(&name).bind(&medicines_str).bind(&data.notes)
    .execute(&state.db).await?;

    let id = result.last_insert_id();
    let row = sqlx::query(
        "SELECT id, name, medicines, notes,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') as created_at
         FROM rx_prescription_templates WHERE id=?"
    ).bind(id).fetch_one(&state.db).await?;

    let medicines_str2: String = row.get("medicines");
    let medicines: Value = serde_json::from_str(&medicines_str2).unwrap_or(Value::Array(vec![]));

    Ok(json!({
        "id":         row.get::<u64, _>("id"),
        "name":       row.get::<String, _>("name"),
        "medicines":  medicines,
        "notes":      row.get::<Option<String>, _>("notes"),
        "created_at": row.get::<Option<String>, _>("created_at").unwrap_or_default(),
    }))
}

#[tauri::command]
pub async fn delete_rx_template(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    sqlx::query(
        "DELETE FROM rx_prescription_templates WHERE id=? AND clinic_id=?"
    ).bind(id).bind(session.clinic_id).execute(&state.db).await?;
    Ok(())
}
