use crate::error::AppResult;
use crate::state::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use serde_json::{json, Value};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

// ── Embedded public key — private key never leaves clinora-keygen.exe ─────────
const PUBLIC_KEY_BYTES: [u8; 32] = [
    0x5d, 0xdc, 0xe3, 0x61, 0x6b, 0x71, 0x5d, 0xdb,
    0xd4, 0xab, 0xf4, 0xd7, 0x3f, 0xf5, 0xaa, 0x29,
    0x9e, 0x93, 0x30, 0x2b, 0x76, 0x93, 0x65, 0xdb,
    0x3c, 0xb4, 0x26, 0xdc, 0xf1, 0x3c, 0x1e, 0xe0,
];

// Grace period after subscription expiry before locking out (seconds)
const GRACE_SECONDS: u64 = 3 * 86_400; // 3 days

fn license_file_path() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()?
        .parent()
        .map(|d| d.join("data").join("license.key"))
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

struct LicenseInfo {
    clinic_id: String,
    tier: String,
    expiry_unix: u64, // 0 = lifetime
}

/// Parse and verify a license key.
/// Supports v2 format:  {clinic_id}|{tier}|{expiry_unix}:{sig_b64}
/// Supports v1 (legacy): {clinic_id}:{sig_b64}  — treated as lifetime
fn verify_and_parse(key: &str) -> Option<LicenseInfo> {
    let key = key.trim();

    // Split payload from signature on the LAST ':'
    let last_colon = key.rfind(':')?;
    let payload = &key[..last_colon];
    let sig_b64 = &key[last_colon + 1..];

    if payload.is_empty() || sig_b64.is_empty() {
        return None;
    }

    let sig_bytes = B64.decode(sig_b64).ok()?;
    let sig_array: [u8; 64] = sig_bytes.try_into().ok()?;
    let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES).ok()?;
    let signature = Signature::from_bytes(&sig_array);

    // Try v2 format first
    if payload.contains('|') {
        let message = format!("CLINORA-LICENSE-v2:{}", payload);
        if verifying_key.verify(message.as_bytes(), &signature).is_err() {
            return None;
        }
        let parts: Vec<&str> = payload.splitn(3, '|').collect();
        if parts.len() != 3 {
            return None;
        }
        let clinic_id = parts[0].to_string();
        let tier = parts[1].to_string();
        let expiry_unix: u64 = parts[2].parse().ok()?;
        return Some(LicenseInfo { clinic_id, tier, expiry_unix });
    }

    // Legacy v1 format — permanent, no tier
    let message = format!("CLINORA-LICENSE-v1:{}", payload);
    if verifying_key.verify(message.as_bytes(), &signature).is_err() {
        return None;
    }
    Some(LicenseInfo {
        clinic_id: payload.to_string(),
        tier: "lifetime".to_string(),
        expiry_unix: 0,
    })
}

fn is_active(info: &LicenseInfo) -> bool {
    if info.expiry_unix == 0 {
        return true; // lifetime
    }
    let now = now_unix();
    now < info.expiry_unix + GRACE_SECONDS
}

fn days_remaining(info: &LicenseInfo) -> Option<i64> {
    if info.expiry_unix == 0 {
        return None; // lifetime — no countdown
    }
    let now = now_unix() as i64;
    let expiry = info.expiry_unix as i64;
    Some(((expiry - now) / 86_400).max(-1))
}

#[tauri::command]
pub async fn get_license_status(_state: State<'_, AppState>) -> AppResult<Value> {
    let path = match license_file_path() {
        Some(p) => p,
        None => return Ok(json!({ "licensed": false, "reason": "no_path" })),
    };

    let stored = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(json!({ "licensed": false, "reason": "no_file" })),
    };

    let info = match verify_and_parse(stored.trim()) {
        Some(i) => i,
        None => return Ok(json!({ "licensed": false, "reason": "invalid_key" })),
    };

    if !is_active(&info) {
        return Ok(json!({
            "licensed": false,
            "reason": "expired",
            "tier": info.tier,
            "clinic_id": info.clinic_id,
        }));
    }

    let days = days_remaining(&info);
    let expiring_soon = days.map(|d| d <= 7).unwrap_or(false);

    Ok(json!({
        "licensed": true,
        "tier": info.tier,
        "clinic_id": info.clinic_id,
        "expiry_unix": info.expiry_unix,
        "days_remaining": days,
        "expiring_soon": expiring_soon,
    }))
}

#[tauri::command]
pub async fn activate_license(key: String, _state: State<'_, AppState>) -> AppResult<Value> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("Please enter a license key.".into());
    }

    let info = verify_and_parse(&key)
        .ok_or("Invalid license key. Please check and try again.")?;

    if !is_active(&info) {
        return Err("This license key has expired. Please contact Clinora for renewal.".into());
    }

    let path = license_file_path()
        .ok_or("Cannot determine installation directory.")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot create data directory.")?;
    }

    fs::write(&path, &key).map_err(|_| "Cannot save license. Check folder permissions.")?;

    let tier_label = match info.tier.as_str() {
        "lifetime" => "Lifetime".to_string(),
        "monthly"  => "Monthly".to_string(),
        "annual"   => "Annual".to_string(),
        other      => other.to_string(),
    };

    Ok(json!({
        "licensed": true,
        "tier": info.tier,
        "clinic_id": info.clinic_id,
        "days_remaining": days_remaining(&info),
        "message": format!("Clinora {} activated successfully!", tier_label),
    }))
}
