use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct ClinicPayload {
    pub name: Option<String>,
    pub doctor_name: Option<String>,
    pub qualification: Option<String>,
    pub address: Option<String>,
    pub contact: Option<String>,
}

#[derive(Deserialize)]
pub struct PrescriptionSettingsPayload {
    pub prescription_header: Option<String>,
    pub prescription_footer: Option<String>,
    pub show_doctor_contact: Option<bool>,
    pub show_clinic_contact: Option<bool>,
    pub prescription_template: Option<String>,
}

#[derive(Deserialize)]
pub struct ClinicNamePayload {
    pub name: String,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let clinic = sqlx::query("SELECT * FROM clinics WHERE id=?")
        .bind(session.clinic_id).fetch_optional(&state.db).await?.ok_or("Clinic not found.")?;

    let settings = sqlx::query("SELECT * FROM clinic_settings WHERE clinic_id=?")
        .bind(session.clinic_id).fetch_optional(&state.db).await?;

    let mut result = json!({
        "clinic": {
            "id": clinic.get::<u64, _>("id"),
            "name": clinic.get::<String, _>("name"),
            "doctor_name": clinic.get::<String, _>("doctor_name"),
            "qualification": clinic.get::<Option<String>, _>("qualification"),
            "address": clinic.get::<Option<String>, _>("address"),
            "contact": clinic.get::<Option<String>, _>("contact")
        },
        "prescription_header": Value::Null,
        "prescription_footer": Value::Null,
        "show_doctor_contact": true,
        "show_clinic_contact": true,
        "prescription_template": Value::Null
    });

    if let Some(s) = settings {
        result["prescription_header"] = json!(s.get::<Option<String>, _>("prescription_header"));
        result["prescription_footer"] = json!(s.get::<Option<String>, _>("prescription_footer"));
        result["show_doctor_contact"] = json!(s.get::<i8, _>("show_doctor_contact") == 1);
        result["show_clinic_contact"] = json!(s.get::<i8, _>("show_clinic_contact") == 1);
        result["prescription_template"] = json!(s.get::<Option<String>, _>("prescription_template"));
    }

    Ok(result)
}

#[tauri::command]
pub async fn update_clinic(data: ClinicPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query(
        "UPDATE clinics SET name=COALESCE(?,name), doctor_name=COALESCE(?,doctor_name),
         qualification=?, address=?, contact=?, updated_at=NOW() WHERE id=?"
    )
    .bind(&data.name).bind(&data.doctor_name).bind(&data.qualification)
    .bind(&data.address).bind(&data.contact).bind(session.clinic_id)
    .execute(&state.db).await?;
    get_settings(state).await
}

#[tauri::command]
pub async fn update_prescription_settings(data: PrescriptionSettingsPayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let count: i64 = sqlx::query("SELECT COUNT(*) FROM clinic_settings WHERE clinic_id=?")
        .bind(session.clinic_id).fetch_one(&state.db).await?.get(0);

    if count == 0 {
        sqlx::query(
            "INSERT INTO clinic_settings (clinic_id, prescription_header, prescription_footer, show_doctor_contact, show_clinic_contact, prescription_template, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())"
        )
        .bind(session.clinic_id).bind(&data.prescription_header).bind(&data.prescription_footer)
        .bind(data.show_doctor_contact.unwrap_or(true) as i8)
        .bind(data.show_clinic_contact.unwrap_or(true) as i8)
        .bind(&data.prescription_template)
        .execute(&state.db).await?;
    } else {
        sqlx::query(
            "UPDATE clinic_settings SET prescription_header=?, prescription_footer=?,
             show_doctor_contact=?, show_clinic_contact=?, prescription_template=?, updated_at=NOW()
             WHERE clinic_id=?"
        )
        .bind(&data.prescription_header).bind(&data.prescription_footer)
        .bind(data.show_doctor_contact.unwrap_or(true) as i8)
        .bind(data.show_clinic_contact.unwrap_or(true) as i8)
        .bind(&data.prescription_template)
        .bind(session.clinic_id)
        .execute(&state.db).await?;
    }
    get_settings(state).await
}

#[tauri::command]
pub async fn update_clinic_name(data: ClinicNamePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query("UPDATE clinics SET name=?, updated_at=NOW() WHERE id=?")
        .bind(&data.name).bind(session.clinic_id).execute(&state.db).await?;
    get_settings(state).await
}
