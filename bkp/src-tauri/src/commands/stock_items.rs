use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct StockItemPayload {
    pub name: String,
    pub category: Option<String>,
    pub unit: Option<String>,
    pub selling_price: Option<f64>,
    pub stock_quantity: Option<u32>,
    pub description: Option<String>,
}

const STOCK_COLS: &str =
    "id, clinic_id, name, category, unit, selling_price * 1e0 as selling_price, stock_quantity, description";

fn stock_row(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.get::<u64, _>("id"),
        "name": r.get::<String, _>("name"),
        "category": r.get::<Option<String>, _>("category"),
        "unit": r.get::<Option<String>, _>("unit"),
        "selling_price": r.get::<Option<f64>, _>("selling_price"),
        "stock_quantity": r.get::<u32, _>("stock_quantity"),
        "description": r.get::<Option<String>, _>("description")
    })
}

#[tauri::command]
pub async fn list_stock_items(q: Option<String>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let has_q = q.as_ref().map(|q| !q.trim().is_empty()).unwrap_or(false);

    let sql = if has_q {
        format!("SELECT {} FROM stock_items WHERE clinic_id=? AND name LIKE ? ORDER BY name ASC", STOCK_COLS)
    } else {
        format!("SELECT {} FROM stock_items WHERE clinic_id=? ORDER BY name ASC", STOCK_COLS)
    };

    let mut query = sqlx::query(&sql).bind(session.clinic_id);
    if has_q { query = query.bind(format!("%{}%", q.unwrap().trim())); }

    let rows = query.fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(|r| stock_row(r)).collect();
    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn create_stock_item(data: StockItemPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let category    = data.category.filter(|s| !s.trim().is_empty());
    let unit        = data.unit.filter(|s| !s.trim().is_empty());
    let description = data.description.filter(|s| !s.trim().is_empty());
    let result = sqlx::query(
        "INSERT INTO stock_items (clinic_id, name, category, unit, selling_price, stock_quantity, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(&data.name).bind(&category)
    .bind(&unit).bind(data.selling_price).bind(data.stock_quantity.unwrap_or(0)).bind(&description)
    .execute(&state.db).await?;

    let row = sqlx::query(&format!("SELECT {} FROM stock_items WHERE id=?", STOCK_COLS))
        .bind(result.last_insert_id()).fetch_one(&state.db).await?;
    Ok(stock_row(&row))
}

#[tauri::command]
pub async fn update_stock_item(id: u64, data: StockItemPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let category    = data.category.filter(|s| !s.trim().is_empty());
    let unit        = data.unit.filter(|s| !s.trim().is_empty());
    let description = data.description.filter(|s| !s.trim().is_empty());

    // Capture old qty before update for audit log
    let old_qty_row = sqlx::query("SELECT stock_quantity FROM stock_items WHERE id=? AND clinic_id=?")
        .bind(id).bind(session.clinic_id)
        .fetch_optional(&state.db).await?;
    let old_qty = old_qty_row.as_ref()
        .map(|r| r.get::<u32, _>("stock_quantity") as i32)
        .unwrap_or(0);

    sqlx::query(
        "UPDATE stock_items SET name=?, category=?, unit=?, selling_price=?, stock_quantity=?, description=?, updated_at=NOW()
         WHERE id=? AND clinic_id=?"
    )
    .bind(&data.name).bind(&category).bind(&unit)
    .bind(data.selling_price).bind(data.stock_quantity.unwrap_or(0)).bind(&description)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    let new_qty = data.stock_quantity.unwrap_or(0) as i32;
    if new_qty != old_qty {
        let _ = sqlx::query(
            "INSERT INTO stock_audit_log
               (clinic_id, item_type, item_id, item_name, old_qty, new_qty, change_delta, reason, created_at)
             VALUES (?, 'stock_item', ?, ?, ?, ?, ?, 'manual_edit', NOW())"
        )
        .bind(session.clinic_id).bind(id).bind(&data.name)
        .bind(old_qty).bind(new_qty).bind(new_qty - old_qty)
        .execute(&state.db).await;
    }

    let row = sqlx::query(&format!("SELECT {} FROM stock_items WHERE id=?", STOCK_COLS))
        .bind(id).fetch_one(&state.db).await?;
    Ok(stock_row(&row))
}

#[tauri::command]
pub async fn delete_stock_item(id: u64, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    sqlx::query("DELETE FROM stock_items WHERE id=? AND clinic_id=?")
        .bind(id).bind(session.clinic_id).execute(&state.db).await?;
    Ok(())
}
