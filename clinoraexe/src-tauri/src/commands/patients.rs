use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct PatientPayload {
    pub name:                    String,
    pub mobile:                  Option<String>,
    pub date_of_birth:           Option<String>,
    pub age:                     Option<u32>,
    pub gender:                  Option<String>,
    pub address:                 Option<String>,
    pub emergency_contact_name:  Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub consent_obtained:        Option<bool>,
    pub consent_date:            Option<String>,
}

#[tauri::command]
pub async fn list_patients(
    q: Option<String>,
    page: Option<u32>,
    per_page: Option<u32>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    gender: Option<String>,
    is_new: Option<bool>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let page = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(15).min(1000);
    let offset = (page - 1) * per_page;
    let sort_col = match sort_by.as_deref() {
        Some("mobile") => "p.mobile",
        Some("created_at") => "p.created_at",
        _ => "p.name",
    };
    let sort_dir = if sort_dir.as_deref() == Some("desc") { "DESC" } else { "ASC" };

    let mut conditions = vec!["p.clinic_id = ?".to_string(), "p.deleted_at IS NULL".to_string()];
    let mut binds: Vec<String> = vec![session.clinic_id.to_string()];

    if let Some(ref q) = q {
        if !q.trim().is_empty() {
            conditions.push("(p.name LIKE ? OR p.mobile LIKE ?)".to_string());
            let like = format!("%{}%", q.trim());
            binds.push(like.clone());
            binds.push(like);
        }
    }
    if let Some(ref g) = gender {
        if !g.is_empty() {
            conditions.push("p.gender = ?".to_string());
            binds.push(g.clone());
        }
    }
    if is_new.unwrap_or(false) {
        conditions.push("p.created_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)".to_string());
    }

    let where_clause = conditions.join(" AND ");
    let count_sql = format!("SELECT COUNT(*) as cnt FROM patients p WHERE {}", where_clause);
    let list_sql = format!(
        "SELECT p.id, p.clinic_id, p.name, p.mobile,
                DATE_FORMAT(p.date_of_birth, '%Y-%m-%d') as date_of_birth,
                p.age, p.gender, p.address,
                DATE_FORMAT(p.created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                DATE_FORMAT(
                    (SELECT MAX(v.visited_at) FROM visits v WHERE v.patient_id = p.id AND v.deleted_at IS NULL),
                    '%Y-%m-%dT%H:%i:%s'
                ) as last_visit_at
         FROM patients p WHERE {} ORDER BY {} {} LIMIT {} OFFSET {}",
        where_clause, sort_col, sort_dir, per_page, offset
    );

    let mut count_q = sqlx::query(&count_sql);
    let mut list_q = sqlx::query(&list_sql);
    for b in &binds {
        count_q = count_q.bind(b);
        list_q = list_q.bind(b);
    }

    let total: i64 = count_q.fetch_one(&state.db).await?.get(0);
    let rows = list_q.fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "name": r.get::<String, _>("name"),
        "mobile": r.get::<Option<String>, _>("mobile"),
        "age": r.get::<Option<u32>, _>("age"),
        "gender": r.get::<Option<String>, _>("gender"),
        "address": r.get::<Option<String>, _>("address"),
        "date_of_birth": r.get::<Option<String>, _>("date_of_birth"),
        "created_at": r.get::<Option<String>, _>("created_at").unwrap_or_default(),
        "last_visit_at": r.get::<Option<String>, _>("last_visit_at")
    })).collect();

    let last_page = ((total as f64) / (per_page as f64)).ceil() as u32;
    Ok(json!({
        "data": data,
        "total": total,
        "per_page": per_page,
        "current_page": page,
        "last_page": last_page.max(1)
    }))
}

#[tauri::command]
pub async fn get_patient(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query(
        "SELECT id, clinic_id, name, mobile, age, gender, address,
                emergency_contact_name, emergency_contact_phone,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s') as created_at,
                DATE_FORMAT(date_of_birth, '%Y-%m-%d') as date_of_birth,
                consent_obtained,
                DATE_FORMAT(consent_date, '%Y-%m-%d') as consent_date
         FROM patients WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL"
    )
    .bind(id).bind(session.clinic_id)
    .fetch_optional(&state.db).await?
    .ok_or("Patient not found.")?;

    Ok(json!({
        "id":                        row.get::<u64, _>("id"),
        "name":                      row.get::<String, _>("name"),
        "mobile":                    row.get::<Option<String>, _>("mobile"),
        "age":                       row.get::<Option<u32>, _>("age"),
        "gender":                    row.get::<Option<String>, _>("gender"),
        "address":                   row.get::<Option<String>, _>("address"),
        "emergency_contact_name":    row.get::<Option<String>, _>("emergency_contact_name"),
        "emergency_contact_phone":   row.get::<Option<String>, _>("emergency_contact_phone"),
        "date_of_birth":             row.get::<Option<String>, _>("date_of_birth"),
        "created_at":                row.get::<Option<String>, _>("created_at").unwrap_or_default(),
        "consent_obtained":          row.get::<i8, _>("consent_obtained") == 1,
        "consent_date":              row.get::<Option<String>, _>("consent_date"),
    }))
}

#[tauri::command]
pub async fn create_patient(data: PatientPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let name = data.name;
    let mobile = data.mobile;
    let date_of_birth = data.date_of_birth.filter(|s| !s.trim().is_empty());
    let age = data.age;
    let gender = data.gender.filter(|s| !s.trim().is_empty());
    let address = data.address.filter(|s| !s.trim().is_empty());
    let ec_name  = data.emergency_contact_name.filter(|s| !s.trim().is_empty());
    let ec_phone = data.emergency_contact_phone.filter(|s| !s.trim().is_empty());
    let consent_obtained = data.consent_obtained.unwrap_or(false) as i8;
    let consent_date = data.consent_date.filter(|s| !s.trim().is_empty());

    let result = sqlx::query(
        "INSERT INTO patients (clinic_id, name, mobile, date_of_birth, age, gender, address, emergency_contact_name, emergency_contact_phone, consent_obtained, consent_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())"
    )
    .bind(session.clinic_id).bind(&name).bind(&mobile)
    .bind(&date_of_birth).bind(age).bind(&gender).bind(&address)
    .bind(&ec_name).bind(&ec_phone)
    .bind(consent_obtained).bind(&consent_date)
    .execute(&state.db).await?;

    get_patient(result.last_insert_id(), state).await
}

#[tauri::command]
pub async fn update_patient(id: u64, data: PatientPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let name = data.name;
    let mobile = data.mobile;
    let date_of_birth = data.date_of_birth.filter(|s| !s.trim().is_empty());
    let age = data.age;
    let gender = data.gender.filter(|s| !s.trim().is_empty());
    let address = data.address.filter(|s| !s.trim().is_empty());
    let ec_name  = data.emergency_contact_name.filter(|s| !s.trim().is_empty());
    let ec_phone = data.emergency_contact_phone.filter(|s| !s.trim().is_empty());
    let consent_obtained = data.consent_obtained.unwrap_or(false) as i8;
    let consent_date = data.consent_date.filter(|s| !s.trim().is_empty());

    sqlx::query(
        "UPDATE patients SET name=?, mobile=?, date_of_birth=?, age=?, gender=?, address=?,
         emergency_contact_name=?, emergency_contact_phone=?,
         consent_obtained=?, consent_date=?, updated_at=NOW()
         WHERE id=? AND clinic_id=? AND deleted_at IS NULL"
    )
    .bind(&name).bind(&mobile).bind(&date_of_birth)
    .bind(age).bind(&gender).bind(&address)
    .bind(&ec_name).bind(&ec_phone)
    .bind(consent_obtained).bind(&consent_date)
    .bind(id).bind(session.clinic_id)
    .execute(&state.db).await?;

    get_patient(id, state).await
}

#[tauri::command]
pub async fn get_patient_visits(id: u64, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let rows = sqlx::query(
        "SELECT v.id, DATE_FORMAT(v.visited_at, '%Y-%m-%dT%H:%i:%s') as visited_at,
                v.consultation_notes, v.consultation_fee * 1e0 as consultation_fee,
                v.status, v.payment_status, u.name as doctor_name
         FROM visits v
         JOIN users u ON u.id = v.doctor_id
         WHERE v.patient_id = ? AND v.clinic_id = ? AND v.deleted_at IS NULL
         ORDER BY v.visited_at DESC"
    ).bind(id).bind(session.clinic_id).fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "visited_at": r.get::<Option<String>, _>("visited_at").unwrap_or_default(),
        "consultation_notes": r.get::<Option<String>, _>("consultation_notes"),
        "consultation_fee": r.get::<Option<f64>, _>("consultation_fee").unwrap_or(0.0),
        "status": r.get::<String, _>("status"),
        "payment_status": r.get::<String, _>("payment_status"),
        "doctor": { "name": r.get::<String, _>("doctor_name") }
    })).collect();

    Ok(json!({ "data": data }))
}

#[tauri::command]
pub async fn get_patient_prescriptions(
    id: u64,
    page: Option<u32>,
    state: State<'_, AppState>,
) -> AppResult<Value> {
    let session = get_session(&state)?;
    let page = page.unwrap_or(1).max(1);
    let per_page = 15u32;
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM prescriptions WHERE patient_id = ? AND clinic_id = ? AND deleted_at IS NULL"
    ).bind(id).bind(session.clinic_id).fetch_one(&state.db).await?.get(0);

    let rows = sqlx::query(
        "SELECT pr.id, pr.status,
                DATE_FORMAT(pr.prescribed_at, '%Y-%m-%dT%H:%i:%s') as prescribed_at,
                DATE_FORMAT(pr.sent_to_pharmacy_at, '%Y-%m-%dT%H:%i:%s') as sent_to_pharmacy_at,
                DATE_FORMAT(pr.completed_at, '%Y-%m-%dT%H:%i:%s') as completed_at,
                COUNT(pi.id) as item_count
         FROM prescriptions pr
         LEFT JOIN prescription_items pi ON pi.prescription_id = pr.id AND pi.deleted_at IS NULL
         WHERE pr.patient_id = ? AND pr.clinic_id = ? AND pr.deleted_at IS NULL
         GROUP BY pr.id ORDER BY pr.prescribed_at DESC LIMIT ? OFFSET ?"
    ).bind(id).bind(session.clinic_id).bind(per_page).bind(offset)
    .fetch_all(&state.db).await?;

    let data: Vec<Value> = rows.iter().map(|r| json!({
        "id": r.get::<u64, _>("id"),
        "status": r.get::<String, _>("status"),
        "prescribed_at": r.get::<Option<String>, _>("prescribed_at").unwrap_or_default(),
        "sent_to_pharmacy_at": r.get::<Option<String>, _>("sent_to_pharmacy_at"),
        "completed_at": r.get::<Option<String>, _>("completed_at"),
        "item_count": r.get::<i64, _>("item_count")
    })).collect();

    let last_page = ((total as f64) / (per_page as f64)).ceil() as u32;
    Ok(json!({ "data": data, "total": total, "per_page": per_page, "current_page": page, "last_page": last_page.max(1) }))
}
