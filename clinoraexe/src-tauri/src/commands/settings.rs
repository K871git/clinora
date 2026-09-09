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

#[derive(Deserialize)]
pub struct TemplateUpload {
    pub data: String,
    pub filename: String,
}

fn templates_dir(clinic_id: u64) -> AppResult<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent().ok_or("Cannot determine exe directory")?
        .to_path_buf();
    Ok(exe_dir.join("data").join("prescription_templates").join(clinic_id.to_string()))
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
        "prescription_template": Value::Null,
        "prescription_template_path": Value::Null
    });

    if let Some(s) = settings {
        result["prescription_header"] = json!(s.get::<Option<String>, _>("prescription_header"));
        result["prescription_footer"] = json!(s.get::<Option<String>, _>("prescription_footer"));
        result["show_doctor_contact"] = json!(s.get::<i8, _>("show_doctor_contact") == 1);
        result["show_clinic_contact"] = json!(s.get::<i8, _>("show_clinic_contact") == 1);
        let template_name = s.get::<Option<String>, _>("prescription_template");
        result["prescription_template"] = json!(&template_name);
        if let Some(ref name) = template_name {
            if let Ok(dir) = templates_dir(session.clinic_id) {
                let abs = dir.join(name);
                result["prescription_template_path"] =
                    json!(abs.to_string_lossy().replace('\\', "/"));
            }
        }
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

#[tauri::command]
pub async fn list_templates(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;

    let active: Option<String> = sqlx::query(
        "SELECT prescription_template FROM clinic_settings WHERE clinic_id=?"
    ).bind(cid).fetch_optional(&state.db).await?
     .and_then(|r| r.get::<Option<String>, _>("prescription_template"));

    let dir = templates_dir(cid)?;
    let mut templates: Vec<Value> = Vec::new();

    if dir.exists() {
        let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() { continue; }
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
            if !["pdf", "png", "jpg", "jpeg", "webp"].contains(&ext.as_str()) { continue; }
            let file_type = if ext == "pdf" { "pdf" } else { "image" };
            let label = name.split('.').next().unwrap_or(&name).replace(['_', '-'], " ");
            let abs_path = path.to_string_lossy().replace('\\', "/");
            let is_active = active.as_deref() == Some(&name);
            templates.push(json!({
                "name": name,
                "label": label,
                "path": abs_path,
                "type": file_type,
                "is_active": is_active
            }));
        }
    }

    Ok(json!({ "data": templates }))
}

#[tauri::command]
pub async fn upload_template(data: TemplateUpload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    let ext = data.filename.rsplit('.').next().unwrap_or("").to_lowercase();
    if !["pdf", "png", "jpg", "jpeg", "webp"].contains(&ext.as_str()) {
        return Err("Invalid file type. Allowed: PDF, PNG, JPG, JPEG, WEBP.".into());
    }

    // Sanitize: keep only safe characters
    let safe_name: String = data.filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_')
        .collect();
    if safe_name.is_empty() || safe_name.starts_with('.') {
        return Err("Invalid filename.".into());
    }

    let dir = templates_dir(session.clinic_id)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let abs_path = dir.join(&safe_name);
    let bytes = super::utils::base64_decode(&data.data)?;
    std::fs::write(&abs_path, &bytes).map_err(|e| e.to_string())?;

    let abs_str = abs_path.to_string_lossy().replace('\\', "/");
    let label = safe_name.split('.').next().unwrap_or(&safe_name).replace(['_', '-'], " ");
    let file_type = if ext == "pdf" { "pdf" } else { "image" };

    Ok(json!({
        "name": safe_name,
        "label": label,
        "path": abs_str,
        "type": file_type,
        "is_active": false
    }))
}

#[tauri::command]
pub async fn delete_template(name: String, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;

    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Invalid template name.".into());
    }

    let active: Option<String> = sqlx::query(
        "SELECT prescription_template FROM clinic_settings WHERE clinic_id=?"
    ).bind(cid).fetch_optional(&state.db).await?
     .and_then(|r| r.get::<Option<String>, _>("prescription_template"));

    if active.as_deref() == Some(&name) {
        sqlx::query("UPDATE clinic_settings SET prescription_template=NULL, updated_at=NOW() WHERE clinic_id=?")
            .bind(cid).execute(&state.db).await?;
    }

    let path = templates_dir(cid)?.join(&name);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn set_active_template(name: String, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let cid = session.clinic_id;

    let count: i64 = sqlx::query("SELECT COUNT(*) FROM clinic_settings WHERE clinic_id=?")
        .bind(cid).fetch_one(&state.db).await?.get(0);

    if count == 0 {
        sqlx::query(
            "INSERT INTO clinic_settings (clinic_id, show_doctor_contact, show_clinic_contact, prescription_template, created_at, updated_at)
             VALUES (?, 1, 1, ?, NOW(), NOW())"
        ).bind(cid).bind(&name).execute(&state.db).await?;
    } else {
        sqlx::query("UPDATE clinic_settings SET prescription_template=?, updated_at=NOW() WHERE clinic_id=?")
            .bind(&name).bind(cid).execute(&state.db).await?;
    }

    Ok(json!({ "prescription_template": name }))
}
