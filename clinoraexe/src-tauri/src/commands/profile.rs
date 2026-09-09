use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

#[derive(Deserialize)]
pub struct ProfilePayload {
    pub name: Option<String>,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub gender: Option<String>,
    pub dob: Option<String>,
    pub address: Option<String>,
}

#[derive(Deserialize)]
pub struct PasswordPayload {
    pub current_password: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct AvatarPayload {
    pub data: String,
    pub ext: Option<String>,
}

fn user_to_json(r: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id": r.get::<u64, _>("id"),
        "name": r.get::<String, _>("name"),
        "email": r.get::<String, _>("email"),
        "role": r.get::<String, _>("role"),
        "username": r.get::<Option<String>, _>("username"),
        "phone": r.get::<Option<String>, _>("phone"),
        "gender": r.get::<Option<String>, _>("gender"),
        "dob": r.get::<Option<String>, _>("dob"),
        "address": r.get::<Option<String>, _>("address"),
        "avatar": r.get::<Option<String>, _>("avatar")
    })
}

#[tauri::command]
pub async fn get_profile(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    let row = sqlx::query("SELECT * FROM users WHERE id=?")
        .bind(session.id).fetch_one(&state.db).await?;
    Ok(user_to_json(&row))
}

#[tauri::command]
pub async fn update_profile(data: ProfilePayload, state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;

    // Sanitize: empty string → NULL for ENUM (gender) and DATE (dob) columns.
    let username = data.username.filter(|s| !s.trim().is_empty());
    let phone    = data.phone.filter(|s| !s.trim().is_empty());
    let gender   = data.gender.filter(|s| !s.trim().is_empty());
    let dob      = data.dob.filter(|s| !s.trim().is_empty());
    let address  = data.address.filter(|s| !s.trim().is_empty());

    sqlx::query(
        "UPDATE users SET name=COALESCE(?,name), username=?, phone=?, gender=?, dob=?, address=?, updated_at=NOW() WHERE id=?"
    )
    .bind(&data.name).bind(&username).bind(&phone)
    .bind(&gender).bind(&dob).bind(&address)
    .bind(session.id)
    .execute(&state.db).await?;

    let row = sqlx::query("SELECT * FROM users WHERE id=?").bind(session.id).fetch_one(&state.db).await?;
    let updated = user_to_json(&row);

    let mut lock = state.session.lock().unwrap();
    if let Some(ref mut u) = *lock {
        u.name = updated["name"].as_str().unwrap_or(&u.name).to_string();
    }

    Ok(json!({ "user": updated }))
}

#[tauri::command]
pub async fn update_password(data: PasswordPayload, state: State<'_, AppState>) -> AppResult<()> {
    let session = get_session(&state)?;
    let row = sqlx::query("SELECT password FROM users WHERE id=?")
        .bind(session.id).fetch_one(&state.db).await?;
    let hash: String = row.get("password");

    let valid = bcrypt::verify(&data.current_password, &hash)?;
    if !valid { return Err("Current password is incorrect.".into()); }

    let new_hash = bcrypt::hash(&data.password, bcrypt::DEFAULT_COST)?;
    sqlx::query("UPDATE users SET password=?, updated_at=NOW() WHERE id=?")
        .bind(new_hash).bind(session.id).execute(&state.db).await?;
    Ok(())
}

#[tauri::command]
pub async fn upload_avatar(data: AvatarPayload, state: State<'_, AppState>) -> AppResult<Value> {
    use std::io::Write;
    let session = get_session(&state)?;
    let ext = data.ext.unwrap_or_else(|| "jpg".to_string());

    let bytes = base64_decode(&data.data)?;
    let exe_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent().ok_or("Cannot determine exe directory")?
        .to_path_buf();
    let dir = exe_dir.join("data").join("avatars");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let filename = format!("avatar_{}_{}.{}", session.id, chrono::Local::now().timestamp(), ext);
    let abs_path = dir.join(&filename);
    let mut file = std::fs::File::create(&abs_path).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;

    let avatar_path = abs_path.to_string_lossy().replace('\\', "/");
    sqlx::query("UPDATE users SET avatar=?, updated_at=NOW() WHERE id=?")
        .bind(&avatar_path).bind(session.id).execute(&state.db).await?;

    {
        let mut lock = state.session.lock().unwrap();
        if let Some(ref mut u) = *lock { u.avatar = Some(avatar_path.clone()); }
    }

    let row = sqlx::query("SELECT * FROM users WHERE id=?").bind(session.id).fetch_one(&state.db).await?;
    Ok(json!({ "user": user_to_json(&row) }))
}

#[tauri::command]
pub async fn remove_avatar(state: State<'_, AppState>) -> AppResult<Value> {
    let session = get_session(&state)?;
    sqlx::query("UPDATE users SET avatar=NULL, updated_at=NOW() WHERE id=?")
        .bind(session.id).execute(&state.db).await?;
    {
        let mut lock = state.session.lock().unwrap();
        if let Some(ref mut u) = *lock { u.avatar = None; }
    }
    let row = sqlx::query("SELECT * FROM users WHERE id=?").bind(session.id).fetch_one(&state.db).await?;
    Ok(json!({ "user": user_to_json(&row) }))
}

fn base64_decode(input: &str) -> AppResult<Vec<u8>> {
    let clean = input.split(',').last().unwrap_or(input);
    use std::collections::HashMap;
    let chars: Vec<u8> = clean.bytes().collect();
    let table: HashMap<u8, u8> = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        .iter().enumerate().map(|(i, &c)| (c, i as u8)).collect();
    let mut out = Vec::new();
    let mut buf = 0u32;
    let mut bits = 0u8;
    for &c in &chars {
        if c == b'=' { break; }
        if let Some(&v) = table.get(&c) {
            buf = (buf << 6) | v as u32;
            bits += 6;
            if bits >= 8 { bits -= 8; out.push((buf >> bits) as u8 & 0xFF); }
        }
    }
    Ok(out)
}
