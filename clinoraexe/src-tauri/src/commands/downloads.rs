use crate::error::AppResult;

fn downloads_dir() -> std::path::PathBuf {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(|h| std::path::PathBuf::from(h).join("Downloads"))
        .unwrap_or_else(|_| std::env::temp_dir())
}

fn safe_filename(name: &str) -> String {
    let s: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.' | ' '))
        .collect();
    if s.trim().is_empty() { "export.csv".to_string() } else { s }
}

/// Write UTF-8 text to the user's Downloads folder. Returns the saved filename.
#[tauri::command]
pub async fn write_text_to_downloads(content: String, filename: String) -> AppResult<String> {
    let dir = downloads_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = safe_filename(&filename);
    let path = dir.join(&name);
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(name)
}

/// Write base64-encoded binary to the user's Downloads folder. Returns the saved filename.
#[tauri::command]
pub async fn write_bytes_to_downloads(b64: String, filename: String) -> AppResult<String> {
    let bytes = super::utils::base64_decode(&b64)?;
    let dir = downloads_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let name = safe_filename(&filename);
    let path = dir.join(&name);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(name)
}
