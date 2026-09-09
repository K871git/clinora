use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct MedicinePayload {
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<u32>,
    pub price: Option<f64>,
}

const MEDICINE_COLS: &str =
    "id, clinic_id, name, generic_name, category, unit, quantity, price * 1e0 as price";

fn medicine_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.get::<u64, _>("id"),
        "name": r.get::<String, _>("name"),
        "generic_name": r.get::<Option<String>, _>("generic_name"),
        "category": r.get::<Option<String>, _>("category"),
        "unit": r.get::<Option<String>, _>("unit"),
        "quantity": r.get::<u32, _>("quantity"),
        "price": r.get::<Option<f64>, _>("price")
    })
}

#[tauri::command]
pub async fn list_medicines(q: Option<String>, per_page: Option<u32>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let per_page = per_page.unwrap_or(500).min(1000);
    let has_q = q.as_ref().map(|q| !q.trim().is_empty()).unwrap_or(false);

    let sql = if has_q {
        format!("SELECT {} FROM medicines WHERE clinic_id=? AND (name LIKE ? OR generic_name LIKE ?) ORDER BY name ASC LIMIT {}", MEDICINE_COLS, per_page)
    } else {
        format!("SELECT {} FROM medicines WHERE clinic_id=? ORDER BY name ASC LIMIT {}", MEDICINE_COLS, per_page)
    };

    let mut query = sqlx::query(&sql).bind(session.clinic_id);
    if has_q {
        let like = format!("%{}%", q.unwrap().trim());
        query = query.bind(like.clone()).bind(like);
    }

    let rows = query.fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(medicine_row).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn create_medicine(data: MedicinePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let generic_name = data.generic_name.filter(|s| !s.trim().is_empty());
    let category     = data.category.filter(|s| !s.trim().is_empty());
    let unit         = data.unit.filter(|s| !s.trim().is_empty());
    let result = sqlx::query(
        "INSERT INTO medicines (clinic_id, name, generic_name, category, unit, quantity, price, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(&data.name).bind(&generic_name)
    .bind(&category).bind(&unit).bind(data.quantity.unwrap_or(0)).bind(data.price)
    .execute(&state.db).await?;

    let row = sqlx::query(&format!("SELECT {} FROM medicines WHERE id=?", MEDICINE_COLS))
        .bind(result.last_insert_id()).fetch_one(&state.db).await?;
    Ok(medicine_row(&row))
}

#[tauri::command]
pub async fn update_medicine(id: u64, data: MedicinePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let generic_name = data.generic_name.filter(|s| !s.trim().is_empty());
    let category     = data.category.filter(|s| !s.trim().is_empty());
    let unit         = data.unit.filter(|s| !s.trim().is_empty());
    sqlx::query(
        "UPDATE medicines SET name=?, generic_name=?, category=?, unit=?, quantity=?, price=?, updated_at=NOW()
         WHERE id=? AND clinic_id=?"
    )
    .bind(&data.name).bind(&generic_name).bind(&category)
    .bind(&unit).bind(data.quantity.unwrap_or(0)).bind(data.price)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    let row = sqlx::query(&format!("SELECT {} FROM medicines WHERE id=?", MEDICINE_COLS))
        .bind(id).fetch_one(&state.db).await?;
    Ok(medicine_row(&row))
}

#[tauri::command]
pub async fn delete_medicine(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    sqlx::query("DELETE FROM medicines WHERE id=? AND clinic_id=?")
        .bind(id).bind(session.clinic_id).execute(&state.db).await?;
    Ok(())
}

#[derive(Deserialize)]
pub struct MedicineImportItem {
    pub name: String,
    pub generic_name: Option<String>,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub quantity: Option<u32>,
    pub price: Option<f64>,
}

#[tauri::command]
pub async fn import_medicines(items: Vec<MedicineImportItem>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let mut imported = 0u32;
    let mut skipped = 0u32;

    let existing_rows = sqlx::query("SELECT LOWER(name) as lname FROM medicines WHERE clinic_id=?")
        .bind(session.clinic_id).fetch_all(&state.db).await?;
    let existing: std::collections::HashSet<String> = existing_rows.iter()
        .map(|r| r.get::<String, _>("lname")).collect();

    for item in &items {
        let name = item.name.trim();
        if name.is_empty() || existing.contains(&name.to_lowercase()) { skipped += 1; continue; }
        let generic_name = item.generic_name.as_deref().filter(|s| !s.trim().is_empty());
        let category     = item.category.as_deref().filter(|s| !s.trim().is_empty());
        let unit         = item.unit.as_deref().filter(|s| !s.trim().is_empty());
        sqlx::query(
            "INSERT INTO medicines (clinic_id, name, generic_name, category, unit, quantity, price, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
        )
        .bind(session.clinic_id).bind(name).bind(generic_name)
        .bind(category).bind(unit).bind(item.quantity.unwrap_or(0)).bind(item.price)
        .execute(&state.db).await?;
        imported += 1;
    }

    Ok(json!({ "imported": imported, "skipped": skipped }))
}
