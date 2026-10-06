use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct MedicineTplPayload {
    pub name: String,
    pub morning: bool,
    pub afternoon: bool,
    pub evening: bool,
    pub meal: String,
    pub days: Option<i32>,
    pub quantity: Option<String>,
    pub notes: Option<String>,
    pub language: Option<String>,
}

fn row_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":        r.get::<u64, _>("id"),
        "name":      r.get::<String, _>("name"),
        "morning":   r.get::<i8, _>("morning") != 0,
        "afternoon": r.get::<i8, _>("afternoon") != 0,
        "evening":   r.get::<i8, _>("evening") != 0,
        "meal":      r.get::<String, _>("meal"),
        "days":      r.get::<Option<u16>, _>("days"),
        "quantity":  r.get::<Option<String>, _>("quantity"),
        "notes":     r.get::<Option<String>, _>("notes"),
        "language":  r.get::<String, _>("language"),
    })
}

#[tauri::command]
pub async fn search_medicine_templates(q: String, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let pattern = format!("%{}%", q.trim());
    let rows = sqlx::query(
        "SELECT id, name, morning, afternoon, evening, meal, days, quantity, notes, language
         FROM medicine_templates
         WHERE clinic_id=? AND name LIKE ?
         ORDER BY name ASC LIMIT 20"
    )
    .bind(session.clinic_id)
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<Value> = rows.iter().map(row_to_json).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn list_medicine_templates(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT id, name, morning, afternoon, evening, meal, days, quantity, notes, language
         FROM medicine_templates WHERE clinic_id=? ORDER BY name ASC"
    )
    .bind(session.clinic_id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<Value> = rows.iter().map(row_to_json).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn save_medicine_template(data: MedicineTplPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let name = data.name.trim().to_string();
    if name.is_empty() {
        return Err("Medicine name is required.".into());
    }
    let meal = match data.meal.as_str() {
        "before" | "after" | "both" => data.meal.clone(),
        _ => "none".to_string(),
    };
    let lang = data.language.as_deref().unwrap_or("en").to_string();

    let result = sqlx::query(
        "INSERT INTO medicine_templates
         (clinic_id, name, morning, afternoon, evening, meal, days, quantity, notes, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id)
    .bind(&name)
    .bind(data.morning as i8)
    .bind(data.afternoon as i8)
    .bind(data.evening as i8)
    .bind(&meal)
    .bind(data.days)
    .bind(&data.quantity)
    .bind(&data.notes)
    .bind(&lang)
    .execute(&state.db)
    .await?;

    let id = result.last_insert_id();
    let row = sqlx::query(
        "SELECT id, name, morning, afternoon, evening, meal, days, quantity, notes, language
         FROM medicine_templates WHERE id=?"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(row_to_json(&row))
}

#[tauri::command]
pub async fn delete_medicine_template(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    sqlx::query("DELETE FROM medicine_templates WHERE id=? AND clinic_id=?")
        .bind(id)
        .bind(session.clinic_id)
        .execute(&state.db)
        .await?;
    Ok(())
}
