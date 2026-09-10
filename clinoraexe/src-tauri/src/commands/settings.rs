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

/// Verify the path is inside the prescription_templates directory (prevents path traversal).
fn validate_template_path(path: &str) -> AppResult<std::path::PathBuf> {
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent().ok_or("Cannot determine exe directory")?
        .to_path_buf();
    let templates_root = exe_dir.join("data").join("prescription_templates");
    std::fs::create_dir_all(&templates_root).ok();
    let root_canon = templates_root.canonicalize()
        .map_err(|_| "Templates directory unavailable")?;
    let requested = std::path::Path::new(path).canonicalize()
        .map_err(|_| "File not found or invalid path")?;
    if !requested.starts_with(&root_canon) {
        return Err("Access denied: path is outside the templates directory.".into());
    }
    Ok(requested)
}

#[tauri::command]
pub async fn read_template_file(path: String, state: State<'_, AppState>) -> AppResult<String> {
    get_session(&state)?;
    let safe = validate_template_path(&path)?;
    let bytes = std::fs::read(&safe).map_err(|e| e.to_string())?;
    Ok(super::utils::base64_encode(&bytes))
}

/// Scan a PDF template and return the mm coordinates of patient Name, Date, and Rx fields.
#[tauri::command]
pub async fn scan_template_layout(path: String, state: State<'_, AppState>) -> AppResult<Value> {
    get_session(&state)?;
    let safe = validate_template_path(&path)?;
    Ok(pdf_scan_layout(&safe.to_string_lossy()))
}

fn pdf_scan_layout(path: &str) -> Value {
    const A4_H_PT: f64 = 841.89;   // A4 height in points
    const PT_MM: f64 = 25.4 / 72.0; // 1pt → mm
    const BASELINE: f64 = 5.0;      // FPDF Cell top-to-baseline offset
    const NAME_LW: f64 = 20.0;      // label width for "Name -"
    const DATE_LW: f64 = 14.0;      // label width for "Date :"

    let fallback = json!({
        "name_x": 38.0, "name_y": 68.0,
        "date_x": 155.0, "date_y": 68.0,
        "date_slot_w": 10.5,
        "meds_x": 18.0, "meds_start_y": 96.0,
        "meds_w": 130.0
    });

    let doc = match lopdf::Document::load(path) {
        Ok(d) => d,
        Err(_) => return fallback,
    };

    let page_id = match doc.get_pages().get(&1).copied() {
        Some(id) => id,
        None => return fallback,
    };

    let raw = match doc.get_page_content(page_id) {
        Ok(b) => b,
        Err(_) => return fallback,
    };

    let content = match lopdf::content::Content::decode(&raw) {
        Ok(c) => c,
        Err(_) => return fallback,
    };

    let mut cx = 0.0_f64;
    let mut cy = 0.0_f64;
    let mut name_lx: Option<f64> = None;
    let mut name_by: Option<f64> = None;
    let mut date_lx: Option<f64> = None;
    let mut date_by: Option<f64> = None;
    let mut rx_lx: Option<f64> = None;
    let mut rx_by: Option<f64> = None;

    for op in &content.operations {
        match op.operator.as_str() {
            "Tm" if op.operands.len() == 6 => {
                cx = pdf_num(&op.operands[4]);
                cy = pdf_num(&op.operands[5]);
            }
            "Tj" | "TJ" => {
                let text = pdf_op_text(op);
                let tl = text.to_lowercase().trim().to_string();
                let xm = cx * PT_MM;
                let ym = (A4_H_PT - cy) * PT_MM;

                // Match name label on left side of page (x < 120mm) below header (y > 58mm).
                // Take LAST match so header occurrences get overwritten by the actual field label.
                let is_name = tl == "name" || tl == "name -" || tl == "name:" || tl.starts_with("name -") || tl.starts_with("name:");
                if is_name && xm < 120.0 && ym > 58.0 {
                    name_lx = Some(xm);
                    name_by = Some(ym);
                }

                // Date label is typically on the right side of the same line (x > 70mm).
                let is_date = tl == "date" || tl == "date:" || tl == "date -" || tl.starts_with("date :") || tl.starts_with("date:");
                if is_date && xm > 70.0 && ym > 58.0 {
                    date_lx = Some(xm);
                    date_by = Some(ym);
                }

                // Rx symbol — take first match below the header.
                if rx_by.is_none() && ym > 58.0 && (tl == "rx" || text.contains("Rx") || text.contains('\u{211E}')) {
                    rx_lx = Some(xm);
                    rx_by = Some(ym);
                }
            }
            _ => {}
        }
    }

    // Medicines start just below Rx.
    let meds_y = rx_by.map(|y| y - BASELINE + 14.0).unwrap_or(96.0);

    // If name/date were not found (or scan found only header hits), derive from Rx position.
    // Name and Date are typically on the same line, ~12–16mm above Rx.
    let rx_ref = rx_by.unwrap_or(meds_y - 14.0 + BASELINE);
    let name_y = match name_by {
        Some(y) if y > 58.0 && y < rx_ref + 2.0 => y - BASELINE,
        _ => rx_ref - 13.0,
    };
    let date_y = match date_by {
        Some(y) if y > 58.0 && y < rx_ref + 2.0 => y - BASELINE,
        _ => name_y,
    };
    let name_x = name_lx.unwrap_or(18.0) + NAME_LW;
    let date_x = date_lx.unwrap_or(148.0) + DATE_LW;
    let meds_x = rx_lx.or(name_lx).unwrap_or(18.0);

    json!({
        "name_x": name_x, "name_y": name_y,
        "date_x": date_x, "date_y": date_y,
        "date_slot_w": 10.5,
        "meds_x": meds_x, "meds_start_y": meds_y,
        "meds_w": 130.0
    })
}

fn pdf_num(obj: &lopdf::Object) -> f64 {
    match obj {
        lopdf::Object::Integer(i) => *i as f64,
        lopdf::Object::Real(f) => *f as f64,
        _ => 0.0,
    }
}

fn pdf_op_text(op: &lopdf::content::Operation) -> String {
    op.operands.first()
        .map(|o| match o {
            lopdf::Object::String(b, _) => String::from_utf8_lossy(b).into_owned(),
            lopdf::Object::Array(arr) => arr.iter()
                .filter_map(|item| {
                    if let lopdf::Object::String(b, _) = item {
                        Some(String::from_utf8_lossy(b).into_owned())
                    } else {
                        None
                    }
                })
                .collect(),
            _ => String::new(),
        })
        .unwrap_or_default()
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
