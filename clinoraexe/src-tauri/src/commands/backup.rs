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

#[tauri::command]
pub async fn backup_database(state: State<'_, AppState>) -> AppResult<Value> {
    // Require auth
    let _session = get_session(&state)?;

    let db_url = load_db_url()
        .ok_or_else(|| crate::error::AppError("Cannot read database config.".into()))?;

    let (user, pass, host, port, dbname) = parse_db_url(&db_url)
        .ok_or_else(|| crate::error::AppError("Cannot parse database URL.".into()))?;

    let dl_dir = downloads_dir()
        .ok_or_else(|| crate::error::AppError("Cannot find Downloads folder.".into()))?;

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
