use crate::error::{AppError, AppResult};
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;
use std::path::PathBuf;

fn io_err(e: impl std::fmt::Display) -> AppError { AppError(format!("IO error: {e}")) }

fn note_attach_dir(note_id: u64) -> AppResult<PathBuf> {
    let exe = std::env::current_exe().map_err(io_err)?;
    let dir = exe
        .parent().ok_or(AppError("no parent dir".into()))?
        .join("data")
        .join("notes_attachments")
        .join(note_id.to_string());
    std::fs::create_dir_all(&dir).map_err(io_err)?;
    Ok(dir)
}

fn parse_attachments(row: &sqlx::mysql::MySqlRow) -> Value {
    let raw: Option<String> = row.get("attachments");
    raw.and_then(|s| serde_json::from_str(&s).ok())
       .unwrap_or(Value::Array(vec![]))
}

fn note_row(row: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "id":          row.get::<u64, _>("id"),
        "user_id":     row.get::<u64, _>("user_id"),
        "patient_id":  row.get::<Option<u64>, _>("patient_id"),
        "role":        row.get::<String, _>("role"),
        "title":       row.get::<String, _>("title"),
        "body":        row.get::<Option<String>, _>("body"),
        "tags":        row.get::<Option<String>, _>("tags"),
        "attachments": parse_attachments(row),
        "created_at":  row.get::<Option<String>, _>("created_at"),
        "updated_at":  row.get::<Option<String>, _>("updated_at"),
    })
}

/* ── list ──────────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn list_notes(
    state: State<'_, AppState>,
    role:  Option<String>,
) -> AppResult<Value> {
    let session     = get_session(&state)?;
    let filter_role = role.unwrap_or(session.role);

    let rows = sqlx::query(
        "SELECT id, user_id, patient_id, role, title, tags, attachments,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') as created_at,
                DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%dT%H:%i:%S') as updated_at,
                SUBSTRING(body, 1, 160) as body
         FROM notes
         WHERE clinic_id = ? AND user_id = ? AND role = ? AND patient_id IS NULL
         ORDER BY COALESCE(updated_at, created_at) DESC
         LIMIT 200"
    )
    .bind(session.clinic_id)
    .bind(session.id)
    .bind(&filter_role)
    .fetch_all(&state.db)
    .await?;

    Ok(json!({ "data": rows.iter().map(note_row).collect::<Vec<_>>() }))
}

/* ── get single ────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn get_note(
    state: State<'_, AppState>,
    id:    u64,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let row = sqlx::query(
        "SELECT id, user_id, patient_id, role, title, body, tags, attachments,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') as created_at,
                DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%dT%H:%i:%S') as updated_at
         FROM notes WHERE id = ? AND clinic_id = ? AND user_id = ?
         LIMIT 1"
    )
    .bind(id)
    .bind(session.clinic_id)
    .bind(session.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError("Note not found".into()))?;

    Ok(json!({ "data": note_row(&row) }))
}

/* ── create ────────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn create_note(
    state:      State<'_, AppState>,
    title:      Option<String>,
    body:       Option<String>,
    tags:       Option<String>,
    role:       Option<String>,
    patient_id: Option<u64>,
) -> AppResult<Value> {
    let session     = get_session(&state)?;
    let final_role  = role.unwrap_or(session.role);
    let final_title = title.unwrap_or_default();

    let res = sqlx::query(
        "INSERT INTO notes (clinic_id, user_id, patient_id, role, title, body, tags, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())"
    )
    .bind(session.clinic_id)
    .bind(session.id)
    .bind(patient_id)
    .bind(&final_role)
    .bind(&final_title)
    .bind(&body)
    .bind(&tags)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id, user_id, patient_id, role, title, body, tags, attachments,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') as created_at,
                DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%dT%H:%i:%S') as updated_at
         FROM notes WHERE id = ? LIMIT 1"
    )
    .bind(res.last_insert_id())
    .fetch_one(&state.db)
    .await?;

    Ok(json!({ "data": note_row(&row) }))
}

/* ── update ────────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn update_note(
    state: State<'_, AppState>,
    id:    u64,
    title: Option<String>,
    body:  Option<String>,
    tags:  Option<String>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    sqlx::query(
        "UPDATE notes SET title = ?, body = ?, tags = ?, updated_at = NOW()
         WHERE id = ? AND clinic_id = ? AND user_id = ?"
    )
    .bind(title.unwrap_or_default())
    .bind(&body)
    .bind(&tags)
    .bind(id)
    .bind(session.clinic_id)
    .bind(session.id)
    .execute(&state.db)
    .await?;

    let row = sqlx::query(
        "SELECT id, user_id, patient_id, role, title, body, tags, attachments,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') as created_at,
                DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-%dT%H:%i:%S') as updated_at
         FROM notes WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(json!({ "data": note_row(&row) }))
}

/* ── delete ────────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn delete_note(
    state: State<'_, AppState>,
    id:    u64,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    if let Ok(dir) = note_attach_dir(id) {
        let _ = std::fs::remove_dir_all(&dir);
    }

    sqlx::query("DELETE FROM notes WHERE id = ? AND clinic_id = ? AND user_id = ?")
        .bind(id)
        .bind(session.clinic_id)
        .bind(session.id)
        .execute(&state.db)
        .await?;

    Ok(json!({ "ok": true }))
}

/* ── save attachment ───────────────────────────────────────────────── */

#[tauri::command]
pub async fn save_note_attachment(
    state:    State<'_, AppState>,
    note_id:  u64,
    filename: String,
    bytes:    Vec<u8>,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notes WHERE id = ? AND clinic_id = ? AND user_id = ?"
    )
    .bind(note_id)
    .bind(session.clinic_id)
    .bind(session.id)
    .fetch_one(&state.db)
    .await?;

    if count == 0 {
        return Err(AppError("Note not found".into()));
    }

    let safe_name: String = filename
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
        .collect();

    let dir = note_attach_dir(note_id)?;
    std::fs::write(dir.join(&safe_name), &bytes).map_err(io_err)?;

    let row = sqlx::query("SELECT attachments FROM notes WHERE id = ? LIMIT 1")
        .bind(note_id)
        .fetch_one(&state.db)
        .await?;

    let raw: Option<String> = row.get("attachments");
    let mut list: Vec<String> = raw
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default();

    if !list.contains(&safe_name) {
        list.push(safe_name.clone());
    }

    sqlx::query("UPDATE notes SET attachments = ?, updated_at = NOW() WHERE id = ?")
        .bind(serde_json::to_string(&list).unwrap_or_default())
        .bind(note_id)
        .execute(&state.db)
        .await?;

    Ok(json!({ "filename": safe_name }))
}

/* ── delete attachment ─────────────────────────────────────────────── */

#[tauri::command]
pub async fn delete_note_attachment(
    state:    State<'_, AppState>,
    note_id:  u64,
    filename: String,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let row = sqlx::query(
        "SELECT attachments FROM notes WHERE id = ? AND clinic_id = ? AND user_id = ? LIMIT 1"
    )
    .bind(note_id)
    .bind(session.clinic_id)
    .bind(session.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError("Note not found".into()))?;

    let raw: Option<String> = row.get("attachments");
    let mut list: Vec<String> = raw
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default();

    list.retain(|f| f != &filename);

    if let Ok(dir) = note_attach_dir(note_id) {
        let _ = std::fs::remove_file(dir.join(&filename));
    }

    sqlx::query("UPDATE notes SET attachments = ?, updated_at = NOW() WHERE id = ?")
        .bind(serde_json::to_string(&list).unwrap_or_default())
        .bind(note_id)
        .execute(&state.db)
        .await?;

    Ok(json!({ "ok": true }))
}

/* ── read attachment bytes ─────────────────────────────────────────── */

#[tauri::command]
pub async fn read_note_attachment(
    _state:   State<'_, AppState>,
    note_id:  u64,
    filename: String,
) -> AppResult<Vec<u8>> {
    let dir = note_attach_dir(note_id)?;
    std::fs::read(dir.join(&filename)).map_err(io_err)
}

/* ── list notes for a patient (all clinic users) ───────────────────── */

#[tauri::command]
pub async fn list_patient_notes(
    state:      State<'_, AppState>,
    patient_id: u64,
) -> AppResult<Value> {
    let session = get_session(&state)?;

    let rows = sqlx::query(
        "SELECT n.id, n.user_id, n.patient_id, n.role, n.title, n.tags, n.attachments,
                DATE_FORMAT(n.created_at, '%Y-%m-%dT%H:%i:%S') as created_at,
                DATE_FORMAT(COALESCE(n.updated_at, n.created_at), '%Y-%m-%dT%H:%i:%S') as updated_at,
                SUBSTRING(n.body, 1, 200) as body,
                u.name as author_name
         FROM notes n
         JOIN users u ON u.id = n.user_id
         WHERE n.clinic_id = ? AND n.patient_id = ?
         ORDER BY COALESCE(n.updated_at, n.created_at) DESC
         LIMIT 100"
    )
    .bind(session.clinic_id)
    .bind(patient_id)
    .fetch_all(&state.db)
    .await?;

    let data: Vec<Value> = rows.iter().map(|row| {
        let mut v = note_row(row);
        if let Some(obj) = v.as_object_mut() {
            obj.insert("author_name".to_string(),
                serde_json::Value::String(row.get::<String, _>("author_name")));
        }
        v
    }).collect();

    Ok(json!({ "data": data }))
}
