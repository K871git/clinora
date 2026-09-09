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
