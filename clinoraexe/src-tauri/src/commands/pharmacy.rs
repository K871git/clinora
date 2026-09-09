use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct DispenseItem {
    pub id: u64,
    pub unit_price: Option<f64>,
}

#[derive(Deserialize)]
pub struct PaymentPayload {
    pub payment_status: String,
    pub amount_paid: Option<f64>,
    pub payment_notes: Option<String>,
}

async fn get_pharmacy_prescription_detail(id: u64, clinic_id: u64, db: &sqlx::MySqlPool) -> AppResult<Value> {
    let row = sqlx::query(
        "SELECT pr.id, pr.status, pr.doctor_notes, pr.payment_status, pr.payment_notes,
                pr.amount_paid * 1e0 as amount_paid,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                DATE_FORMAT(pr.sent_to_pharmacy_at, '%Y-%m-%dT%H:%i:%s') as sent_to_pharmacy_at,
                DATE_FORMAT(pr.dispensed_at, '%Y-%m-%dT%H:%i:%s') as dispensed_at,
                DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at,
                p.name as patient_name, p.mobile as patient_mobile, p.age, p.gender,
                u.name as doctor_name,
                DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
                v.consultation_notes
         FROM prescriptions pr
         JOIN patients p ON p.id=pr.patient_id
         JOIN users u ON u.id=pr.doctor_id
         JOIN visits v ON v.id=pr.visit_id
         WHERE pr.id=? AND pr.clinic_id=? AND pr.deleted_at IS NULL"
    ).bind(id).bind(clinic_id).fetch_optional(db).await?.ok_or("Prescription not found.")?;

    let items = sqlx::query(
        "SELECT id, medicine_name, dosage, frequency, duration, instructions, sort_order, unit_price * 1e0 as unit_price
         FROM prescription_items WHERE prescription_id=? AND deleted_at IS NULL ORDER BY sort_order ASC"
    ).bind(id).fetch_all(db).await?;

    let items_json: Vec<Value> = items.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "medicine_name": r.get::<String, _>("medicine_name"),
        "dosage": r.get::<Option<String>, _>("dosage"),
        "frequency": r.get::<Option<String>, _>("frequency"),
        "duration": r.get::<Option<String>, _>("duration"),
        "instructions": r.get::<Option<String>, _>("instructions"),
        "unit_price": r.get::<Option<f64>, _>("unit_price")
    })).collect();

    let total_amount: f64 = items_json.iter()
        .filter_map(|i| i["unit_price"].as_f64())
        .sum();

    Ok(json!({
        "id": row.get::<u64, _>("id"),
        "status": row.get::<String, _>("status"),
        "prescribed_at": row.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "sent_to_pharmacy_at": row.get::<Option<String>, _>("sent_to_pharmacy_at"),
        "dispensed_at": row.get::<Option<String>, _>("dispensed_at"),
        "completed_at": row.get::<Option<String>, _>("completed_at"),
        "doctor_notes": row.get::<Option<String>, _>("doctor_notes"),
        "payment_status": row.get::<String, _>("payment_status"),
        "amount_paid": row.get::<f64, _>("amount_paid"),
        "payment_notes": row.get::<Option<String>, _>("payment_notes"),
        "total_amount": total_amount,
        "items": items_json,
        "patient": {
            "name": row.get::<String, _>("patient_name"),
            "mobile": row.get::<Option<String>, _>("patient_mobile"),
            "age": row.get::<Option<u32>, _>("age"),
            "gender": row.get::<Option<String>, _>("gender")
        },
        "doctor": { "name": row.get::<String, _>("doctor_name") },
        "visit": { "visited_at": row.get::<Option<String>, _>("visited_at") }
    }))
}

#[tauri::command]
pub async fn get_pharmacy_stats(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;
    let db = &state.db;

    let pending: i64 = sqlx::query("SELECT COUNT(*) FROM prescriptions WHERE clinic_id=? AND status='sent_to_pharmacy' AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);
    let dispensing: i64 = sqlx::query("SELECT COUNT(*) FROM prescriptions WHERE clinic_id=? AND status='dispensing' AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);
    let today_done: i64 = sqlx::query("SELECT COUNT(*) FROM prescriptions WHERE clinic_id=? AND status='completed' AND DATE(completed_at)=CURDATE() AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    Ok(json!({ "data": { "pending": pending, "dispensing": dispensing, "today_done": today_done } }))
}

#[tauri::command]
pub async fn list_pharmacy_prescriptions(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT pr.id, pr.status,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                DATE_FORMAT(pr.sent_to_pharmacy_at, '%Y-%m-%dT%H:%i:%s') as sent_to_pharmacy_at,
                DATE_FORMAT(pr.dispensed_at, '%Y-%m-%dT%H:%i:%s') as dispensed_at,
                p.name as patient_name, p.mobile as patient_mobile, u.name as doctor_name
         FROM prescriptions pr
         JOIN patients p ON p.id=pr.patient_id
         JOIN users u ON u.id=pr.doctor_id
         WHERE pr.clinic_id=? AND pr.status IN ('sent_to_pharmacy','dispensing') AND pr.deleted_at IS NULL
         ORDER BY pr.sent_to_pharmacy_at ASC"
    ).bind(session.clinic_id).fetch_all(&state.db).await?;

    if rows.is_empty() {
        return Ok(json!({ "data": [] }));
    }

    let ids: Vec<u64> = rows.iter().map(|r| r.get::<u64, _>("id")).collect();
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let items_sql = format!(
        "SELECT prescription_id, id, medicine_name, dosage, frequency, duration, unit_price * 1e0 as unit_price \
         FROM prescription_items WHERE prescription_id IN ({}) AND deleted_at IS NULL \
         ORDER BY prescription_id, sort_order ASC",
        placeholders
    );
    let mut items_q = sqlx::query(&items_sql);
    for id in &ids { items_q = items_q.bind(*id); }
    let all_items = items_q.fetch_all(&state.db).await?;

    let mut items_map: std::collections::HashMap<u64, Vec<Value>> = std::collections::HashMap::new();
    for item in &all_items {
        let pid: u64 = item.get("prescription_id");
        items_map.entry(pid).or_default().push(json!({
            "id": item.get::<u64, _>("id"),
            "medicine_name": item.get::<String, _>("medicine_name"),
            "dosage": item.get::<Option<String>, _>("dosage"),
            "frequency": item.get::<Option<String>, _>("frequency"),
            "duration": item.get::<Option<String>, _>("duration"),
            "unit_price": item.get::<Option<f64>, _>("unit_price")
        }));
    }

    let data: Vec<Value> = rows.iter().map(|r| {
        let id = r.get::<u64, _>("id");
        let items = items_map.remove(&id).unwrap_or_default();
        json!({
            "id": id,
            "status": r.get::<String, _>("status"),
            "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
            "sent_to_pharmacy_at": r.get::<Option<String>, _>("sent_to_pharmacy_at"),
            "dispensed_at": r.get::<Option<String>, _>("dispensed_at"),
            "items": items,
            "patient": { "name": r.get::<String, _>("patient_name"), "mobile": r.get::<Option<String>, _>("patient_mobile") },
            "doctor": { "name": r.get::<String, _>("doctor_name") }
        })
    }).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn get_pharmacy_prescription(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    get_pharmacy_prescription_detail(id, session.clinic_id, &state.db).await
}

#[tauri::command]
pub async fn start_dispensing(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let current = sqlx::query("SELECT status FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;
    if current.get::<String, _>("status") != "sent_to_pharmacy" {
        return Err("Only pending prescriptions can be started.".into());
    }
    sqlx::query("UPDATE prescriptions SET status='dispensing', dispensed_at=NOW(), updated_at=NOW() WHERE id=?")
        .bind(id).execute(&state.db).await?;
    get_pharmacy_prescription_detail(id, session.clinic_id, &state.db).await
}

#[tauri::command]
pub async fn complete_pharmacy_prescription(
    id: u64,
    items: Vec<DispenseItem>,
    payment_status: Option<String>,
    amount_paid: Option<f64>,
    payment_notes: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let current = sqlx::query("SELECT status FROM prescriptions WHERE id=? AND clinic_id=? AND deleted_at IS NULL")
        .bind(id).bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Prescription not found.")?;
    let status = current.get::<String, _>("status");
    if status != "sent_to_pharmacy" && status != "dispensing" {
        return Err("Only pending or dispensing prescriptions can be completed.".into());
    }

    // Update item prices first so they exist before completing
    for item in &items {
        if let Some(price) = item.unit_price {
            sqlx::query("UPDATE prescription_items SET unit_price=? WHERE id=? AND prescription_id=?")
                .bind(price).bind(item.id).bind(id).execute(&state.db).await?;
        }
    }

    // Mark prescription complete — include payment fields if payment_status is provided
    if let Some(ps) = &payment_status {
        sqlx::query(
            "UPDATE prescriptions SET status='completed', completed_at=NOW(), completed_by=?,
             payment_status=?, amount_paid=?, payment_notes=?, updated_at=NOW() WHERE id=?"
        ).bind(session.id).bind(ps).bind(amount_paid.unwrap_or(0.0)).bind(&payment_notes).bind(id)
        .execute(&state.db).await?;
    } else {
        sqlx::query(
            "UPDATE prescriptions SET status='completed', completed_at=NOW(), completed_by=?, updated_at=NOW() WHERE id=?"
        ).bind(session.id).bind(id).execute(&state.db).await?;
    }

    // Decrement medicine stock quantity for each dispensed item (match PHP)
    let dispensed = sqlx::query(
        "SELECT medicine_name FROM prescription_items WHERE prescription_id=? AND deleted_at IS NULL"
    ).bind(id).fetch_all(&state.db).await?;
    for row in &dispensed {
        let name: String = row.get("medicine_name");
        sqlx::query(
            "UPDATE medicines SET quantity=GREATEST(0, quantity-1), updated_at=NOW()
             WHERE clinic_id=? AND LOWER(name)=LOWER(?) AND quantity>0"
        ).bind(session.clinic_id).bind(&name).execute(&state.db).await?;
    }

    get_pharmacy_prescription_detail(id, session.clinic_id, &state.db).await
}

#[tauri::command]
pub async fn get_pharmacy_history(q: Option<String>, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let mut sql = "SELECT pr.id, pr.status,
                          DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                          DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at,
                          pr.payment_status, pr.amount_paid * 1e0 as amount_paid,
                          p.name as patient_name, p.mobile as patient_mobile,
                          u.name as doctor_name, COUNT(pi.id) as item_count
                   FROM prescriptions pr
                   JOIN patients p ON p.id=pr.patient_id
                   JOIN users u ON u.id=pr.doctor_id
                   LEFT JOIN prescription_items pi ON pi.prescription_id=pr.id AND pi.deleted_at IS NULL
                   WHERE pr.clinic_id=? AND pr.status='completed' AND pr.deleted_at IS NULL".to_string();

    let has_q = q.as_ref().map(|q| !q.trim().is_empty()).unwrap_or(false);
    if has_q { sql.push_str(" AND (p.name LIKE ? OR p.mobile LIKE ?)"); }
    sql.push_str(" GROUP BY pr.id ORDER BY pr.completed_at DESC LIMIT 100");

    let mut query = sqlx::query(&sql).bind(session.clinic_id);
    if has_q {
        let like = format!("%{}%", q.unwrap().trim());
        query = query.bind(like.clone()).bind(like);
    }

    let rows = query.fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "status": r.get::<String, _>("status"),
        "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "completed_at": r.get::<Option<String>, _>("completed_at"),
        "payment_status": r.get::<String, _>("payment_status"),
        "amount_paid": r.get::<f64, _>("amount_paid"),
        "item_count": r.get::<i64, _>("item_count"),
        "patient": { "name": r.get::<String, _>("patient_name"), "mobile": r.get::<Option<String>, _>("patient_mobile") },
        "doctor": { "name": r.get::<String, _>("doctor_name") }
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn record_prescription_payment(id: u64, data: PaymentPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query(
        "UPDATE prescriptions SET payment_status=?, amount_paid=?, payment_notes=?, updated_at=NOW()
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(&data.payment_status).bind(data.amount_paid.unwrap_or(0.0))
    .bind(&data.payment_notes).bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;
    get_pharmacy_prescription_detail(id, session.clinic_id, &state.db).await
}

#[tauri::command]
pub async fn get_pharmacy_revenue(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query(
        "SELECT
            COALESCE(SUM(CASE WHEN DATE(pr.completed_at)=CURDATE() THEN it.total ELSE 0 END),0) * 1e0 as t_rev,
            COUNT(CASE WHEN DATE(pr.completed_at)=CURDATE() THEN 1 END) as t_count,
            COALESCE(SUM(CASE WHEN DATE(pr.completed_at)=CURDATE() AND pr.payment_status='paid' THEN pr.amount_paid ELSE 0 END),0) * 1e0 as t_coll,
            COUNT(CASE WHEN DATE(pr.completed_at)=CURDATE() AND pr.payment_status='paid' THEN 1 END) as t_paid,
            COUNT(CASE WHEN DATE(pr.completed_at)=CURDATE() AND pr.payment_status!='paid' THEN 1 END) as t_unpaid,
            COALESCE(SUM(CASE WHEN YEARWEEK(pr.completed_at)=YEARWEEK(CURDATE()) THEN it.total ELSE 0 END),0) * 1e0 as w_rev,
            COUNT(CASE WHEN YEARWEEK(pr.completed_at)=YEARWEEK(CURDATE()) THEN 1 END) as w_count,
            COALESCE(SUM(CASE WHEN YEARWEEK(pr.completed_at)=YEARWEEK(CURDATE()) AND pr.payment_status='paid' THEN pr.amount_paid ELSE 0 END),0) * 1e0 as w_coll,
            COUNT(CASE WHEN YEARWEEK(pr.completed_at)=YEARWEEK(CURDATE()) AND pr.payment_status='paid' THEN 1 END) as w_paid,
            COUNT(CASE WHEN YEARWEEK(pr.completed_at)=YEARWEEK(CURDATE()) AND pr.payment_status!='paid' THEN 1 END) as w_unpaid,
            COALESCE(SUM(CASE WHEN MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE()) THEN it.total ELSE 0 END),0) * 1e0 as m_rev,
            COUNT(CASE WHEN MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE()) THEN 1 END) as m_count,
            COALESCE(SUM(CASE WHEN MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE()) AND pr.payment_status='paid' THEN pr.amount_paid ELSE 0 END),0) * 1e0 as m_coll,
            COUNT(CASE WHEN MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE()) AND pr.payment_status='paid' THEN 1 END) as m_paid,
            COUNT(CASE WHEN MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE()) AND pr.payment_status!='paid' THEN 1 END) as m_unpaid,
            COALESCE(SUM(it.total),0) * 1e0 as a_rev,
            COUNT(*) as a_count,
            COALESCE(SUM(CASE WHEN pr.payment_status='paid' THEN pr.amount_paid ELSE 0 END),0) * 1e0 as a_coll,
            COUNT(CASE WHEN pr.payment_status='paid' THEN 1 END) as a_paid,
            COUNT(CASE WHEN pr.payment_status!='paid' THEN 1 END) as a_unpaid
         FROM prescriptions pr
         LEFT JOIN (
             SELECT prescription_id, COALESCE(SUM(unit_price),0) as total
             FROM prescription_items WHERE deleted_at IS NULL GROUP BY prescription_id
         ) it ON it.prescription_id = pr.id
         WHERE pr.clinic_id=? AND pr.status='completed' AND pr.deleted_at IS NULL"
    ).bind(session.clinic_id).fetch_one(&state.db).await?;

    Ok(json!({ "data": {
        "today": {
            "revenue": row.get::<f64, _>("t_rev"), "total_dispensed": row.get::<i64, _>("t_count"),
            "amount_collected": row.get::<f64, _>("t_coll"), "paid_count": row.get::<i64, _>("t_paid"),
            "unpaid_count": row.get::<i64, _>("t_unpaid")
        },
        "this_week": {
            "revenue": row.get::<f64, _>("w_rev"), "total_dispensed": row.get::<i64, _>("w_count"),
            "amount_collected": row.get::<f64, _>("w_coll"), "paid_count": row.get::<i64, _>("w_paid"),
            "unpaid_count": row.get::<i64, _>("w_unpaid")
        },
        "this_month": {
            "revenue": row.get::<f64, _>("m_rev"), "total_dispensed": row.get::<i64, _>("m_count"),
            "amount_collected": row.get::<f64, _>("m_coll"), "paid_count": row.get::<i64, _>("m_paid"),
            "unpaid_count": row.get::<i64, _>("m_unpaid")
        },
        "all_time": {
            "revenue": row.get::<f64, _>("a_rev"), "total_dispensed": row.get::<i64, _>("a_count"),
            "amount_collected": row.get::<f64, _>("a_coll"), "paid_count": row.get::<i64, _>("a_paid"),
            "unpaid_count": row.get::<i64, _>("a_unpaid")
        }
    }}))
}

#[tauri::command]
pub async fn get_pharmacy_revenue_transactions(
    period: Option<String>,
    filter: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let period = period.unwrap_or_else(|| "this_month".to_string());

    let date_filter = match period.as_str() {
        "today" => "AND DATE(pr.completed_at) = CURDATE()".to_string(),
        "this_week" => "AND YEARWEEK(pr.completed_at) = YEARWEEK(CURDATE())".to_string(),
        "all_time" => String::new(),
        _ => "AND MONTH(pr.completed_at)=MONTH(CURDATE()) AND YEAR(pr.completed_at)=YEAR(CURDATE())".to_string(),
    };

    let payment_filter = match filter.unwrap_or_default().as_str() {
        "paid" | "collected" => "AND pr.payment_status = 'paid'",
        "unpaid" | "outstanding" => "AND pr.payment_status != 'paid'",
        _ => "",
    };

    let sql = format!(
        "SELECT pr.id, DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at, pr.payment_status, pr.payment_notes,
                pr.amount_paid * 1e0 as amount_paid,
                p.name as patient_name, p.id as patient_id,
                COALESCE(it.total, 0) * 1e0 as total_amount
         FROM prescriptions pr
         JOIN patients p ON p.id=pr.patient_id
         LEFT JOIN (
             SELECT prescription_id, COALESCE(SUM(unit_price),0) as total
             FROM prescription_items WHERE deleted_at IS NULL GROUP BY prescription_id
         ) it ON it.prescription_id = pr.id
         WHERE pr.clinic_id=? AND pr.status='completed' AND pr.deleted_at IS NULL {} {}
         ORDER BY pr.completed_at DESC LIMIT 200",
        date_filter, payment_filter
    );

    let rows = sqlx::query(&sql).bind(session.clinic_id).fetch_all(&state.db).await?;
    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "patient_name": r.get::<String, _>("patient_name"),
        "patient_id": r.get::<u64, _>("patient_id"),
        "completed_at": r.get::<Option<String>, _>("completed_at"),
        "total_amount": r.get::<f64, _>("total_amount"),
        "amount_paid": r.get::<f64, _>("amount_paid"),
        "payment_status": r.get::<String, _>("payment_status"),
        "payment_notes": r.get::<Option<String>, _>("payment_notes")
    })).collect();

    Ok(json!({ "data": data }))
}
