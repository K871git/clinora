use crate::error::AppResult;
use crate::state::AppState;
use serde_json::{json, Value};
use sqlx::mysql::MySqlPoolOptions;
use std::fs;
use tauri::{AppHandle, State};

fn config_path() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()?
        .parent()
        .map(|d| d.join("data").join("clinora.cfg"))
}

#[tauri::command]
pub async fn get_setup_status(state: State<'_, AppState>) -> AppResult<Value> {
    Ok(json!({ "configured": state.is_configured }))
}

#[tauri::command]
pub async fn test_db_connection(db_url: String) -> AppResult<Value> {
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(8))
        .connect(&db_url)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("Access denied") {
                "Access denied — wrong username or password.".to_string()
            } else if msg.contains("Connection refused") || msg.contains("connection refused") {
                "Connection refused — MySQL is not running or port 3306 is blocked.".to_string()
            } else if msg.contains("timed out") || msg.contains("timeout") {
                "Connection timed out — check the IP address and firewall.".to_string()
            } else {
                format!("Connection failed: {}", msg)
            }
        })?;

    sqlx::query("SELECT 1")
        .execute(&pool)
        .await
        .map_err(|e| format!("Connected but query failed: {}", e))?;

    pool.close().await;
    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn save_setup_config(db_url: String, role: String) -> AppResult<Value> {
    let path = config_path().ok_or("Cannot determine config path.")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot create data directory.")?;
    }

    let cfg = json!({
        "db_url": db_url,
        "role": role,
        "configured": true
    });

    fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|_| "Cannot save config file. Check folder permissions.")?;

    Ok(json!({ "ok": true }))
}

#[tauri::command]
pub async fn restart_app(app_handle: AppHandle) -> AppResult<()> {
    let exe = std::env::current_exe().map_err(|_| "Cannot find executable path.")?;
    std::process::Command::new(exe)
        .spawn()
        .map_err(|_| "Cannot restart application.")?;
    app_handle.exit(0);
    Ok(())
}
