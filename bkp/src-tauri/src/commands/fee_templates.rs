use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

// ── Fee Templates ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct FeeTemplatePayload {
    pub name:   String,
    pub amount: f64,
}

#[tauri::command]
pub async fn list_fee_templates(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT id, name, amount * 1e0 as amount FROM fee_templates WHERE clinic_id = ? ORDER BY name ASC"
    )
    .bind(session.clinic_id)
    .fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id":     r.get::<u64, _>("id"),
        "name":   r.get::<String, _>("name"),
        "amount": r.get::<f64, _>("amount"),
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn save_fee_template(
    id:    Option<u64>,
    data:  FeeTemplatePayload,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    if data.name.trim().is_empty() {
        return Err("Template name is required.".into());
    }
    if data.amount < 0.0 {
        return Err("Amount cannot be negative.".into());
    }

    if let Some(tid) = id {
        sqlx::query(
            "UPDATE fee_templates SET name=?, amount=?, updated_at=NOW() WHERE id=? AND clinic_id=?"
        )
        .bind(data.name.trim()).bind(data.amount).bind(tid).bind(session.clinic_id)
        .execute(&state.db).await?;

        let row = sqlx::query(
            "SELECT id, name, amount * 1e0 as amount FROM fee_templates WHERE id=? AND clinic_id=?"
        )
        .bind(tid).bind(session.clinic_id)
        .fetch_one(&state.db).await?;

        return Ok(json!({
            "id":     row.get::<u64, _>("id"),
            "name":   row.get::<String, _>("name"),
            "amount": row.get::<f64, _>("amount"),
        }));
    }

    let res = sqlx::query(
        "INSERT INTO fee_templates (clinic_id, name, amount, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(data.name.trim()).bind(data.amount)
    .execute(&state.db).await?;

    Ok(json!({
        "id":     res.last_insert_id(),
        "name":   data.name.trim(),
        "amount": data.amount,
    }))
}

#[tauri::command]
pub async fn delete_fee_template(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query("DELETE FROM fee_templates WHERE id=? AND clinic_id=?")
        .bind(id).bind(session.clinic_id)
        .execute(&state.db).await?;
    Ok(json!({ "ok": true }))
}

// ── Visit Charges ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct VisitChargePayload {
    pub description: String,
    pub amount:      f64,
}

#[tauri::command]
pub async fn list_visit_charges(visit_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query("SELECT id FROM visits WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(visit_id).bind(session.clinic_id)
        .fetch_optional(&state.db).await?
        .ok_or("Visit not found.")?;

    let rows = sqlx::query(
        "SELECT id, description, amount * 1e0 as amount FROM visit_charges WHERE visit_id=? ORDER BY id ASC"
    )
    .bind(visit_id)
    .fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id":          r.get::<u64, _>("id"),
        "description": r.get::<String, _>("description"),
        "amount":      r.get::<f64, _>("amount"),
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn add_visit_charge(
    visit_id: u64,
    data:     VisitChargePayload,
    state:    State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    if data.description.trim().is_empty() {
        return Err("Description is required.".into());
    }
    if data.amount <= 0.0 {
        return Err("Amount must be greater than 0.".into());
    }
    sqlx::query("SELECT id FROM visits WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(visit_id).bind(session.clinic_id)
        .fetch_optional(&state.db).await?
        .ok_or("Visit not found.")?;

    let res = sqlx::query(
        "INSERT INTO visit_charges (visit_id, description, amount, created_at) VALUES (?, ?, ?, NOW())"
    )
    .bind(visit_id).bind(data.description.trim()).bind(data.amount)
    .execute(&state.db).await?;

    Ok(json!({
        "data": {
            "id":          res.last_insert_id(),
            "description": data.description.trim(),
            "amount":      data.amount,
        }
    }))
}

#[tauri::command]
pub async fn delete_visit_charge(id: u64, visit_id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query(
        "DELETE vc FROM visit_charges vc JOIN visits v ON v.id = vc.visit_id WHERE vc.id=? AND vc.visit_id=? AND v.clinic_id=?"
    )
    .bind(id).bind(visit_id).bind(session.clinic_id)
    .execute(&state.db).await?;
    Ok(json!({ "ok": true }))
}
