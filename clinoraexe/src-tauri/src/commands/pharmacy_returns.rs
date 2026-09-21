use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct ReturnItem {
    pub medicine_name: String,
    pub quantity: u32,
    pub unit_price: f64,
}

#[tauri::command]
pub async fn create_pharmacy_return(
    prescription_id: u64,
    items: Vec<ReturnItem>,
    reason: Option<String>,
    notes: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let db = &state.db;

    if items.is_empty() {
        return Err("Select at least one item to return.".into());
    }
    for item in &items {
        if item.quantity == 0 {
            return Err("Return quantity must be at least 1.".into());
        }
        if !item.unit_price.is_finite() || item.unit_price < 0.0 {
            return Err("Invalid item price.".into());
        }
    }

    let rx = sqlx::query(
        "SELECT id, patient_id, status FROM prescriptions
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL",
    )
    .bind(prescription_id)
    .bind(session.clinic_id)
    .fetch_optional(db)
    .await?
    .ok_or("Prescription not found.")?;

    if rx.get::<String, _>("status") != "completed" {
        return Err("Only completed prescriptions can be returned.".into());
    }

    let patient_id: u64 = rx.get("patient_id");

    let count: i64 = sqlx::query(
        "SELECT COUNT(*) FROM pharmacy_returns WHERE clinic_id=?",
    )
    .bind(session.clinic_id)
    .fetch_one(db)
    .await?
    .get(0);
    let return_number = format!("RET-{:04}", count + 1);

    let total_amount: f64 = items
        .iter()
        .map(|i| i.unit_price * i.quantity as f64)
        .sum();

    let result = sqlx::query(
        "INSERT INTO pharmacy_returns
           (clinic_id, prescription_id, patient_id, pharmacist_id,
            return_number, reason, total_amount, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
    )
    .bind(session.clinic_id)
    .bind(prescription_id)
    .bind(patient_id)
    .bind(session.id)
    .bind(&return_number)
    .bind(reason.as_deref().filter(|s| !s.trim().is_empty()))
    .bind(total_amount)
    .bind(notes.as_deref().filter(|s| !s.trim().is_empty()))
    .execute(db)
    .await?;

    let return_id = result.last_insert_id();

    for item in &items {
        sqlx::query(
            "INSERT INTO pharmacy_return_items
               (return_id, medicine_name, quantity, unit_price, total, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())",
        )
        .bind(return_id)
        .bind(&item.medicine_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(item.unit_price * item.quantity as f64)
        .execute(db)
        .await?;

        if let Ok(Some(med_row)) = sqlx::query(
            "SELECT id, quantity FROM medicines
             WHERE clinic_id=? AND LOWER(name)=LOWER(?) LIMIT 1",
        )
        .bind(session.clinic_id)
        .bind(&item.medicine_name)
        .fetch_optional(db)
        .await
        {
            let med_id: u64 = med_row.get("id");
            let old_qty: i32 = med_row.get::<u32, _>("quantity") as i32;
            let new_qty: i32 = old_qty + item.quantity as i32;

            sqlx::query("UPDATE medicines SET quantity=?, updated_at=NOW() WHERE id=?")
                .bind(new_qty)
                .bind(med_id)
                .execute(db)
                .await?;

            let _ = sqlx::query(
                "INSERT INTO stock_audit_log
                   (clinic_id, item_type, item_id, item_name, old_qty, new_qty,
                    change_delta, reason, prescription_id, created_at)
                 VALUES (?, 'medicine', ?, ?, ?, ?, ?, 'pharmacy_return', ?, NOW())",
            )
            .bind(session.clinic_id)
            .bind(med_id)
            .bind(&item.medicine_name)
            .bind(old_qty)
            .bind(new_qty)
            .bind(item.quantity as i32)
            .bind(prescription_id)
            .execute(db)
            .await;
        }
    }

    Ok(json!({
        "id":              return_id,
        "return_number":   return_number,
        "prescription_id": prescription_id,
        "total_amount":    total_amount,
    }))
}

#[tauri::command]
pub async fn list_pharmacy_returns(
    page: Option<u32>,
    per_page: Option<u32>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(30).min(100);
    let offset = (page - 1) * per_page;

    let rows = sqlx::query(
        "SELECT r.id, r.return_number, r.reason, r.total_amount * 1e0 as total_amount,
                DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                p.name as patient_name, r.prescription_id,
                u.name as pharmacist_name
         FROM pharmacy_returns r
         JOIN patients p ON p.id = r.patient_id
         JOIN prescriptions pr ON pr.id = r.prescription_id
         JOIN users u ON u.id = r.pharmacist_id
         WHERE r.clinic_id=?
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?",
    )
    .bind(session.clinic_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id":              r.get::<u64, _>("id"),
                "return_number":   r.get::<String, _>("return_number"),
                "reason":          r.get::<Option<String>, _>("reason"),
                "total_amount":    r.get::<f64, _>("total_amount"),
                "created_at":      r.get::<Option<String>, _>("created_at"),
                "patient_name":    r.get::<String, _>("patient_name"),
                "prescription_id": r.get::<u64, _>("prescription_id"),
                "pharmacist_name": r.get::<String, _>("pharmacist_name"),
            })
        })
        .collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn get_pharmacy_return(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let row = sqlx::query(
        "SELECT r.id, r.return_number, r.reason, r.notes,
                r.total_amount * 1e0 as total_amount,
                DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                p.name as patient_name, r.prescription_id,
                u.name as pharmacist_name
         FROM pharmacy_returns r
         JOIN patients p ON p.id = r.patient_id
         JOIN users u ON u.id = r.pharmacist_id
         WHERE r.id=? AND r.clinic_id=?",
    )
    .bind(id)
    .bind(session.clinic_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or("Return not found.")?;

    let items = sqlx::query(
        "SELECT id, medicine_name, quantity,
                unit_price * 1e0 as unit_price,
                total * 1e0 as total
         FROM pharmacy_return_items WHERE return_id=? ORDER BY id ASC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let items_json: Vec<Value> = items
        .iter()
        .map(|r| {
            json!({
                "id":            r.get::<u64, _>("id"),
                "medicine_name": r.get::<String, _>("medicine_name"),
                "quantity":      r.get::<u32, _>("quantity"),
                "unit_price":    r.get::<f64, _>("unit_price"),
                "total":         r.get::<f64, _>("total"),
            })
        })
        .collect();

    Ok(json!({
        "id":              row.get::<u64, _>("id"),
        "return_number":   row.get::<String, _>("return_number"),
        "reason":          row.get::<Option<String>, _>("reason"),
        "notes":           row.get::<Option<String>, _>("notes"),
        "total_amount":    row.get::<f64, _>("total_amount"),
        "created_at":      row.get::<Option<String>, _>("created_at"),
        "patient_name":    row.get::<String, _>("patient_name"),
        "prescription_id": row.get::<u64, _>("prescription_id"),
        "pharmacist_name": row.get::<String, _>("pharmacist_name"),
        "items":           items_json,
    }))
}
