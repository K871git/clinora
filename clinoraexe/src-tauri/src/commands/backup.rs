use crate::error::AppResult;
use crate::state::{get_session, AppState};
use serde_json::{json, Value};
use tauri::State;
use std::process::Command;

fn parse_db_url(url: &str) -> Option<(String, String, String, u16, String)> {
    // mysql://user:pass@host:port/dbname
    let url = url.trim_start_matches("mysql://");
    let (userinfo, rest) = url.split_once('@')?;
    let (user, pass) = userinfo.split_once(':')?;
    let (hostport, dbname) = rest.split_once('/')?;
    let (host, port) = if hostport.contains(':') {
        let (h, p) = hostport.split_once(':')?;
        (h.to_string(), p.parse::<u16>().ok().unwrap_or(3306))
    } else {
        (hostport.to_string(), 3306)
    };
    let dbname = dbname.split('?').next().unwrap_or(dbname);
    Some((user.to_string(), pass.to_string(), host, port, dbname.to_string()))
}

fn load_db_url() -> Option<String> {
    if let Ok(url) = std::env::var("CLINORA_DB_URL") {
        if !url.trim().is_empty() { return Some(url.trim().to_string()) }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let cfg = dir.join("data").join("clinora.cfg");
            if let Ok(contents) = std::fs::read_to_string(&cfg) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                    if let Some(url) = val.get("db_url").and_then(|v| v.as_str()) {
                        if !url.trim().is_empty() { return Some(url.trim().to_string()) }
                    }
                }
            }
        }
    }
    None
}

fn downloads_dir() -> Option<std::path::PathBuf> {
    // Windows: USERPROFILE\Downloads
    if let Ok(home) = std::env::var("USERPROFILE") {
        let dl = std::path::PathBuf::from(&home).join("Downloads");
        if dl.exists() { return Some(dl) }
        let docs = std::path::PathBuf::from(&home).join("Documents");
        if docs.exists() { return Some(docs) }
    }
    // Unix fallback
    if let Ok(home) = std::env::var("HOME") {
        let dl = std::path::PathBuf::from(&home).join("Downloads");
        if dl.exists() { return Some(dl) }
    }
    None
}

fn load_backup_path() -> Option<std::path::PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let cfg = dir.join("data").join("clinora.cfg");
            if let Ok(contents) = std::fs::read_to_string(&cfg) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                    if let Some(p) = val.get("backup_path").and_then(|v| v.as_str()) {
                        if !p.trim().is_empty() {
                            let path = std::path::PathBuf::from(p.trim());
                            if path.exists() { return Some(path) }
                        }
                    }
                }
            }
        }
    }
    None
}

fn write_cfg_key(key: &str, value: &str) -> AppResult<()> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("Cannot determine exe directory")?;
    let cfg_path = dir.join("data").join("clinora.cfg");
    let contents = std::fs::read_to_string(&cfg_path).unwrap_or_else(|_| "{}".to_string());
    let mut val: serde_json::Value = serde_json::from_str(&contents).unwrap_or(serde_json::json!({}));
    val[key] = serde_json::Value::String(value.to_string());
    std::fs::write(&cfg_path, serde_json::to_string_pretty(&val).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_backup_path(path: String, state: State<'_, AppState>) -> AppResult<Value> {
    get_session(&state)?;
    let trimmed = path.trim().to_string();
    if trimmed.is_empty() {
        // Clear the saved path
        write_cfg_key("backup_path", "")?;
        return Ok(serde_json::json!({ "backup_path": null }));
    }
    let p = std::path::Path::new(&trimmed);
    if !p.exists() {
        return Err(crate::error::AppError(format!("Path does not exist: {}", trimmed)));
    }
    if !p.is_dir() {
        return Err(crate::error::AppError("Backup path must be a folder, not a file.".into()));
    }
    write_cfg_key("backup_path", &trimmed)?;
    Ok(serde_json::json!({ "backup_path": trimmed }))
}

#[tauri::command]
pub async fn get_backup_path(state: State<'_, AppState>) -> AppResult<Value> {
    get_session(&state)?;
    let saved = load_backup_path().map(|p| p.to_string_lossy().to_string());
    let default = downloads_dir().map(|p| p.to_string_lossy().to_string());
    Ok(serde_json::json!({
        "backup_path": saved,
        "default_path": default,
    }))
}

#[tauri::command]
pub async fn backup_database(state: State<'_, AppState>) -> AppResult<Value> {
    // Require auth
    let _session = get_session(&state)?;

    let db_url = load_db_url()
        .ok_or_else(|| crate::error::AppError("Cannot read database config.".into()))?;

    let (user, pass, host, port, dbname) = parse_db_url(&db_url)
        .ok_or_else(|| crate::error::AppError("Cannot parse database URL.".into()))?;

    let dl_dir = load_backup_path()
        .or_else(downloads_dir)
        .ok_or_else(|| crate::error::AppError("Cannot find backup folder — please set a backup path in Settings.".into()))?;

    // Timestamp filename
    let now = chrono::Local::now();
    let filename = format!("clinora_backup_{}.sql", now.format("%Y%m%d_%H%M%S"));
    let out_path = dl_dir.join(&filename);

    // Try mysqldump from PATH
    let mut cmd = Command::new("mysqldump");
    cmd.args([
        &format!("--host={}", host),
        &format!("--port={}", port),
        &format!("--user={}", user),
        &format!("--password={}", pass),
        "--single-transaction",
        "--routines",
        "--triggers",
        "--add-drop-table",
        "--set-gtid-purged=OFF",
        &dbname,
    ]);

    let output = cmd.output()
        .map_err(|e| crate::error::AppError(format!(
            "mysqldump not found or failed to run.\n\
             Make sure MySQL is installed and mysqldump is in your PATH.\n\
             Error: {e}"
        )))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(crate::error::AppError(format!(
            "mysqldump failed:\n{}", stderr.trim()
        )));
    }

    std::fs::write(&out_path, &output.stdout)
        .map_err(|e| crate::error::AppError(format!("Could not write backup file: {e}")))?;

    let size_kb = output.stdout.len() / 1024;

    Ok(json!({
        "filename": filename,
        "path":     out_path.to_string_lossy(),
        "size_kb":  size_kb,
    }))
}

#[tauri::command]
pub async fn restore_database(path: String, state: State<'_, AppState>) -> AppResult<Value> {
    let _session = get_session(&state)?;

    let db_url = load_db_url()
        .ok_or_else(|| crate::error::AppError("Cannot read database config.".into()))?;

    let (user, pass, host, port, dbname) = parse_db_url(&db_url)
        .ok_or_else(|| crate::error::AppError("Cannot parse database URL.".into()))?;

    let path = path.trim().to_string();
    let file_path = std::path::Path::new(&path);

    if !file_path.exists() {
        return Err(crate::error::AppError(format!("File not found: {}", path)));
    }
    if !file_path.is_file() {
        return Err(crate::error::AppError("Path must point to a .sql backup file.".into()));
    }

    let file = std::fs::File::open(file_path)
        .map_err(|e| crate::error::AppError(format!("Cannot read backup file: {e}")))?;

    let mut cmd = Command::new("mysql");
    cmd.args([
        &format!("--host={}", host),
        &format!("--port={}", port),
        &format!("--user={}", user),
        &format!("--password={}", pass),
        &dbname,
    ]);
    cmd.stdin(file);

    let output = cmd.output().map_err(|e| {
        crate::error::AppError(format!(
            "mysql client not found or failed to run.\n\
             Make sure MySQL is installed and mysql is in your PATH.\n\
             Error: {e}"
        ))
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(crate::error::AppError(format!(
            "Restore failed:\n{}",
            stderr.trim()
        )));
    }

    Ok(json!({ "restored": true }))
}
