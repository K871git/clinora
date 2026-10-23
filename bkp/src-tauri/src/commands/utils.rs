/// Lightweight DB health check — used by the frontend to detect reconnection.
#[tauri::command]
pub async fn ping_db(state: tauri::State<'_, crate::state::AppState>) -> Result<bool, String> {
    sqlx::query("SELECT 1")
        .execute(&state.db)
        .await
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Parse any datetime string the frontend might send into MySQL DATETIME format (YYYY-MM-DD HH:MM:SS).
/// Handles: ISO 8601 with Z/offset ("2026-09-09T08:27:00.000Z"), local ISO ("2026-09-09T08:27:00"),
/// datetime-local without seconds ("2026-09-09T08:27"), and already-correct MySQL format.
pub fn parse_datetime(s: &str) -> String {
    // ISO 8601 with timezone/Z suffix — most common from JS Date.toISOString()
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return dt.naive_utc().format("%Y-%m-%d %H:%M:%S").to_string();
    }
    // ISO with T separator, no timezone
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
        return dt.format("%Y-%m-%d %H:%M:%S").to_string();
    }
    // datetime-local input without seconds ("2026-09-09T08:27")
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M") {
        return dt.format("%Y-%m-%d %H:%M:%S").to_string();
    }
    // Already in MySQL format or date-only — return as-is
    s.to_string()
}

#[allow(dead_code)]
/// Convert an empty (or whitespace-only) Option<String> to None.
/// Prevents empty strings from being bound to ENUM/DATE columns in MySQL strict mode,
/// which rejects "" with "Data truncated" even though the column is nullable.
pub fn empty_to_null(s: Option<String>) -> Option<String> {
    s.filter(|v| !v.trim().is_empty())
}

/// Encode raw bytes as a base64 string.
pub fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        out.push(CHARS[(b0 >> 2) as usize] as char);
        out.push(CHARS[((b0 & 0x3) << 4 | b1 >> 4) as usize] as char);
        out.push(if chunk.len() > 1 { CHARS[((b1 & 0xF) << 2 | b2 >> 6) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[(b2 & 0x3F) as usize] as char } else { '=' });
    }
    out
}

/// Decode a base64 string (with or without data URL prefix) to raw bytes.
pub fn base64_decode(input: &str) -> crate::error::AppResult<Vec<u8>> {
    let clean = input.split(',').last().unwrap_or(input).trim();
    let mut out = Vec::new();
    let mut buf = 0u32;
    let mut bits = 0u8;
    for &c in clean.as_bytes() {
        let v: u8 = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\n' | b'\r' | b' ' => continue,
            _ => continue,
        };
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8 & 0xFF);
        }
    }
    Ok(out)
}
