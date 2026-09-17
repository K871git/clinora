use crate::error::AppResult;
use serde_json::{json, Value};
use std::fs;

pub const TERMS_VERSION: &str = "1.0";

fn config_path() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()?
        .parent()
        .map(|d| d.join("data").join("clinora.cfg"))
}

fn read_config() -> Value {
    config_path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(json!({}))
}

fn write_config(cfg: &Value) -> Result<(), String> {
    let path = config_path().ok_or("Cannot determine config path.")?;
    fs::write(&path, serde_json::to_string_pretty(cfg).unwrap())
        .map_err(|_| "Cannot write config file.")?;
    Ok(())
}

/// Returns whether the current user has accepted the active Terms version.
#[tauri::command]
pub async fn check_consent() -> AppResult<Value> {
    let cfg = read_config();
    let stored = cfg
        .get("consent_version")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    Ok(json!({
        "consented":      stored == TERMS_VERSION,
        "terms_version":  TERMS_VERSION,
    }))
}

/// Persists the user's acceptance of the current Terms version.
#[tauri::command]
pub async fn record_consent() -> AppResult<Value> {
    let mut cfg = read_config();
    let obj = cfg.as_object_mut().ok_or("Invalid config format.")?;
    obj.insert("consent_version".to_string(), json!(TERMS_VERSION));
    write_config(&cfg)?;
    Ok(json!({ "ok": true }))
}
