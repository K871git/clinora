use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;
    let db = &state.db;

    let total_patients: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM patients WHERE clinic_id = ? AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let today_visits: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM visits WHERE clinic_id = ? AND DATE(visited_at) = CURDATE() AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let yesterday_visits: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM visits WHERE clinic_id = ? AND DATE(visited_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let total_visits: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM visits WHERE clinic_id = ? AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let pending_rx: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM prescriptions WHERE clinic_id = ? AND status = 'sent_to_pharmacy' AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let draft_rx: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM prescriptions WHERE clinic_id = ? AND status = 'draft' AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let completed_today: i64 = sqlx::query("SELECT COUNT(*) as cnt FROM visits WHERE clinic_id = ? AND status = 'completed' AND DATE(invoiced_at) = CURDATE() AND deleted_at IS NULL")
        .bind(cid).fetch_one(db).await?.get(0);

    let week_rows = sqlx::query(
        "SELECT DATE_FORMAT(DATE(visited_at), '%Y-%m-%d') as day, COUNT(*) as cnt FROM visits
         WHERE clinic_id = ? AND visited_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND deleted_at IS NULL
         GROUP BY DATE(visited_at) ORDER BY day ASC"
    ).bind(cid).fetch_all(db).await?;

    let week_activity: Vec<Value> = week_rows.iter().map(|r| {
        let day: String = r.get::<Option<String>, _>("day").unwrap_or_default();
        let cnt: i64 = r.get(1);
        json!({ "label": day, "count": cnt, "is_today": false })
    }).collect();

    Ok(json!({ "data": {
        "total_patients": total_patients,
        "today_visits": today_visits,
        "yesterday_visits": yesterday_visits,
        "total_visits": total_visits,
        "pending_rx": pending_rx,
        "draft_rx": draft_rx,
        "completed_today": completed_today,
        "week_activity": week_activity
    }}))
}

#[tauri::command]
pub async fn get_today_patients(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT v.id, v.patient_id, DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
                CAST(v.consultation_fee AS DOUBLE) as consultation_fee, v.status, p.name as patient_name, p.mobile
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
         WHERE v.clinic_id = ? AND DATE(v.visited_at) = CURDATE() AND v.deleted_at IS NULL
         ORDER BY v.visited_at DESC LIMIT 20"
    ).bind(session.clinic_id).fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "patient_id": r.get::<u64, _>("patient_id"),
        "visited_at": r.get::<Option<String>, _>("visited_at").unwrap_or_default(),
        "consultation_fee": r.get::<Option<f64>, _>("consultation_fee").unwrap_or(0.0),
        "status": r.get::<String, _>("status"),
        "patient": { "name": r.get::<String, _>("patient_name") }
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn get_pending_rx(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT pr.id, pr.patient_id, pr.status,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                p.name as patient_name,
                COUNT(pi.id) as item_count
         FROM prescriptions pr
         JOIN patients p ON p.id = pr.patient_id
         LEFT JOIN prescription_items pi ON pi.prescription_id = pr.id AND pi.deleted_at IS NULL
         WHERE pr.clinic_id = ? AND pr.status = 'sent_to_pharmacy' AND pr.deleted_at IS NULL
         GROUP BY pr.id ORDER BY pr.prescribed_at ASC LIMIT 20"
    ).bind(session.clinic_id).fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "patient_id": r.get::<u64, _>("patient_id"),
        "status": r.get::<String, _>("status"),
        "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "patient": { "name": r.get::<String, _>("patient_name") },
        "items": (0..r.get::<i64, _>("item_count")).map(|_| json!({})).collect::<Vec<_>>()
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn get_revenue(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;
    let db = &state.db;

    let row = sqlx::query(
        "SELECT
            CAST(COALESCE(SUM(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' THEN consultation_fee ELSE 0 END),0) AS DOUBLE) as t_rev,
            COUNT(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' THEN 1 END) as t_visits,
            CAST(COALESCE(SUM(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' AND payment_status='paid' THEN amount_paid ELSE 0 END),0) AS DOUBLE) as t_coll,
            COUNT(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' AND payment_status='paid' THEN 1 END) as t_paid,
            CAST(COALESCE(SUM(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' AND payment_status!='paid' THEN GREATEST(0,consultation_fee-amount_paid) ELSE 0 END),0) AS DOUBLE) as t_debt,
            COUNT(CASE WHEN DATE(invoiced_at)=CURDATE() AND status='completed' AND payment_status!='paid' THEN 1 END) as t_unpaid,
            CAST(COALESCE(SUM(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' THEN consultation_fee ELSE 0 END),0) AS DOUBLE) as w_rev,
            COUNT(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' THEN 1 END) as w_visits,
            CAST(COALESCE(SUM(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' AND payment_status='paid' THEN amount_paid ELSE 0 END),0) AS DOUBLE) as w_coll,
            COUNT(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' AND payment_status='paid' THEN 1 END) as w_paid,
            CAST(COALESCE(SUM(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' AND payment_status!='paid' THEN GREATEST(0,consultation_fee-amount_paid) ELSE 0 END),0) AS DOUBLE) as w_debt,
            COUNT(CASE WHEN YEARWEEK(invoiced_at)=YEARWEEK(CURDATE()) AND status='completed' AND payment_status!='paid' THEN 1 END) as w_unpaid,
            CAST(COALESCE(SUM(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' THEN consultation_fee ELSE 0 END),0) AS DOUBLE) as m_rev,
            COUNT(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' THEN 1 END) as m_visits,
            CAST(COALESCE(SUM(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' AND payment_status='paid' THEN amount_paid ELSE 0 END),0) AS DOUBLE) as m_coll,
            COUNT(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' AND payment_status='paid' THEN 1 END) as m_paid,
            CAST(COALESCE(SUM(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' AND payment_status!='paid' THEN GREATEST(0,consultation_fee-amount_paid) ELSE 0 END),0) AS DOUBLE) as m_debt,
            COUNT(CASE WHEN MONTH(invoiced_at)=MONTH(CURDATE()) AND YEAR(invoiced_at)=YEAR(CURDATE()) AND status='completed' AND payment_status!='paid' THEN 1 END) as m_unpaid,
            CAST(COALESCE(SUM(CASE WHEN status='completed' THEN consultation_fee ELSE 0 END),0) AS DOUBLE) as a_rev,
            COUNT(CASE WHEN status='completed' THEN 1 END) as a_visits,
            CAST(COALESCE(SUM(CASE WHEN status='completed' AND payment_status='paid' THEN amount_paid ELSE 0 END),0) AS DOUBLE) as a_coll,
            COUNT(CASE WHEN status='completed' AND payment_status='paid' THEN 1 END) as a_paid,
            CAST(COALESCE(SUM(CASE WHEN status='completed' AND payment_status!='paid' THEN GREATEST(0,consultation_fee-amount_paid) ELSE 0 END),0) AS DOUBLE) as a_debt,
            COUNT(CASE WHEN status='completed' AND payment_status!='paid' THEN 1 END) as a_unpaid,
            CAST(COALESCE(AVG(CASE WHEN status='completed' THEN consultation_fee END),0) AS DOUBLE) as a_avg
         FROM visits WHERE clinic_id = ? AND deleted_at IS NULL"
    ).bind(cid).fetch_one(db).await?;

    Ok(json!({ "data": {
        "today": {
            "revenue": row.get::<f64, _>("t_rev"), "total_visits": row.get::<i64, _>("t_visits"),
            "amount_collected": row.get::<f64, _>("t_coll"), "paid_visits": row.get::<i64, _>("t_paid"),
            "debt_amount": row.get::<f64, _>("t_debt"), "unpaid_count": row.get::<i64, _>("t_unpaid")
        },
        "this_week": {
            "revenue": row.get::<f64, _>("w_rev"), "total_visits": row.get::<i64, _>("w_visits"),
            "amount_collected": row.get::<f64, _>("w_coll"), "paid_visits": row.get::<i64, _>("w_paid"),
            "debt_amount": row.get::<f64, _>("w_debt"), "unpaid_count": row.get::<i64, _>("w_unpaid")
        },
        "this_month": {
            "revenue": row.get::<f64, _>("m_rev"), "total_visits": row.get::<i64, _>("m_visits"),
            "amount_collected": row.get::<f64, _>("m_coll"), "paid_visits": row.get::<i64, _>("m_paid"),
            "debt_amount": row.get::<f64, _>("m_debt"), "unpaid_count": row.get::<i64, _>("m_unpaid")
        },
        "all_time": {
            "revenue": row.get::<f64, _>("a_rev"), "total_visits": row.get::<i64, _>("a_visits"),
            "amount_collected": row.get::<f64, _>("a_coll"), "paid_visits": row.get::<i64, _>("a_paid"),
            "debt_amount": row.get::<f64, _>("a_debt"), "unpaid_count": row.get::<i64, _>("a_unpaid"),
            "avg_fee": row.get::<f64, _>("a_avg")
        }
    }}))
}

#[tauri::command]
pub async fn get_revenue_transactions(
    period: Option<String>,
    filter: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let period = period.unwrap_or_else(|| "this_month".to_string());

    let date_filter = match period.as_str() {
        "today" => "AND DATE(v.invoiced_at) = CURDATE()".to_string(),
        "this_week" => "AND YEARWEEK(v.invoiced_at) = YEARWEEK(CURDATE())".to_string(),
        _ => "AND MONTH(v.invoiced_at) = MONTH(CURDATE()) AND YEAR(v.invoiced_at) = YEAR(CURDATE())".to_string(),
    };

    let payment_filter = match filter.unwrap_or_default().as_str() {
        "paid" | "collected" => "AND v.payment_status = 'paid'",
        "unpaid" | "outstanding" => "AND v.payment_status != 'paid'",
        _ => "",
    };

    let sql = format!(
        "SELECT v.id, DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
                DATE_FORMAT(v.invoiced_at, '%Y-%m-%dT%H:%i:%s') as invoiced_at,
                CAST(v.consultation_fee AS DOUBLE) as consultation_fee,
                CAST(v.amount_paid AS DOUBLE) as amount_paid,
                v.payment_status, p.name as patient_name
         FROM visits v
         JOIN patients p ON p.id = v.patient_id
         WHERE v.clinic_id = ? AND v.status = 'completed' AND v.deleted_at IS NULL
         {} {}
         ORDER BY v.invoiced_at DESC LIMIT 200",
        date_filter, payment_filter
    );

    let rows = sqlx::query(&sql).bind(session.clinic_id).fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "visited_at": r.get::<Option<String>, _>("visited_at").unwrap_or_default(),
        "invoiced_at": r.get::<Option<String>, _>("invoiced_at").unwrap_or_default(),
        "consultation_fee": r.get::<Option<f64>, _>("consultation_fee").unwrap_or(0.0),
        "payment_status": r.get::<String, _>("payment_status"),
        "amount_paid": r.get::<f64, _>("amount_paid"),
        "patient": { "name": r.get::<String, _>("patient_name") }
    })).collect();

    Ok(json!({ "data": data }))
}
