use crate::error::AppResult;
use crate::state::AppState;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use serde_json::{json, Value};
use std::fs;
use tauri::State;

// ── Embedded public key — private key never leaves clinora-keygen.exe ─────────
const PUBLIC_KEY_BYTES: [u8; 32] = [
    0x5d, 0xdc, 0xe3, 0x61, 0x6b, 0x71, 0x5d, 0xdb,
    0xd4, 0xab, 0xf4, 0xd7, 0x3f, 0xf5, 0xaa, 0x29,
    0x9e, 0x93, 0x30, 0x2b, 0x76, 0x93, 0x65, 0xdb,
    0x3c, 0xb4, 0x26, 0xdc, 0xf1, 0x3c, 0x1e, 0xe0,
];

fn license_file_path() -> Option<std::path::PathBuf> {
    std::env::current_exe()
        .ok()?
        .parent()
        .map(|d| d.join("data").join("license.key"))
}

fn verify_license_key(key: &str) -> bool {
    let key = key.trim();

    // Format: "CLINIC-ID:base64signature" — split on last colon
    let last_colon = match key.rfind(':') {
        Some(i) => i,
        None => return false,
    };

    let clinic_id = &key[..last_colon];
    let sig_b64 = &key[last_colon + 1..];

    if clinic_id.is_empty() || sig_b64.is_empty() {
        return false;
    }

    let sig_bytes = match B64.decode(sig_b64) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let sig_array: [u8; 64] = match sig_bytes.try_into() {
        Ok(a) => a,
        Err(_) => return false,
    };

    let verifying_key = match VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES) {
        Ok(k) => k,
        Err(_) => return false,
    };

    let signature = Signature::from_bytes(&sig_array);
    let message = format!("CLINORA-LICENSE-v1:{}", clinic_id);

    verifying_key.verify(message.as_bytes(), &signature).is_ok()
}

#[tauri::command]
pub async fn get_license_status(_state: State<'_, AppState>) -> AppResult<Value> {
    let path = match license_file_path() {
        Some(p) => p,
        None => return Ok(json!({ "licensed": false })),
    };

    if let Ok(stored) = fs::read_to_string(&path) {
        if verify_license_key(stored.trim()) {
            return Ok(json!({ "licensed": true }));
        }
    }

    Ok(json!({ "licensed": false }))
}

#[tauri::command]
pub async fn activate_license(key: String, _state: State<'_, AppState>) -> AppResult<Value> {
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err("Please enter a license key.".into());
    }

    if !verify_license_key(&key) {
        return Err("Invalid license key. Please check your key and try again.".into());
    }

    let path = match license_file_path() {
        Some(p) => p,
        None => return Err("Cannot determine installation directory.".into()),
    };

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|_| "Cannot create data directory.")?;
    }

    fs::write(&path, &key).map_err(|_| "Cannot save license. Check folder permissions.")?;

    Ok(json!({ "licensed": true, "message": "Clinora activated successfully!" }))
}
