// ─── Clinora License Keygen ──────────────────────────────────────────────────
// PRIVATE TOOL — Do NOT share this binary or its source with anyone.
// Protected by: master password + machine GUID whitelist.
// ─────────────────────────────────────────────────────────────────────────────

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};
use std::io::{self, Write};
use std::time::{SystemTime, UNIX_EPOCH};

// ── Private key seed (32 bytes) — KEEP THIS SECRET ───────────────────────────
const PRIVATE_SEED: [u8; 32] = [
    0x6c, 0x85, 0x8a, 0x78, 0x94, 0xa8, 0x9f, 0x27,
    0xce, 0x67, 0xa4, 0x7b, 0x11, 0x50, 0x16, 0xc9,
    0x3f, 0xdc, 0x7a, 0x0e, 0x50, 0x47, 0x95, 0x23,
    0x8f, 0x64, 0x68, 0x92, 0x20, 0x1d, 0x2b, 0xa5,
];

// ── Master password SHA-256 hash ─────────────────────────────────────────────
// Default password: ClinoraKeygen@2025!
const PASSWORD_HASH: &str = "043d84bd9b375185e25ed181911dc279bfbbad05b8dd92647d0aa70de6d189cd";

// ── Allowed machine GUIDs ─────────────────────────────────────────────────────
const ALLOWED_MACHINE_GUIDS: &[&str] = &[
    "ab0c747a-0e3d-4323-bfe4-6f3240846a9e", // Developer PC (Kishor)
];

fn get_machine_guid() -> Result<String, String> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let key = hklm
            .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
            .map_err(|e| e.to_string())?;
        let guid: String = key.get_value("MachineGuid").map_err(|e| e.to_string())?;
        Ok(guid.to_lowercase())
    }
    #[cfg(not(windows))]
    {
        Err("Only supported on Windows".to_string())
    }
}

fn check_machine() -> bool {
    match get_machine_guid() {
        Ok(guid) => ALLOWED_MACHINE_GUIDS.contains(&guid.as_str()),
        Err(_) => false,
    }
}

fn prompt(label: &str) -> String {
    print!("{}", label);
    io::stdout().flush().unwrap();
    let mut s = String::new();
    io::stdin().read_line(&mut s).unwrap();
    s.trim().to_string()
}

fn hash_password(pass: &str) -> String {
    let mut h = Sha256::new();
    h.update(pass.as_bytes());
    format!("{:x}", h.finalize())
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn days_from_now(days: u64) -> u64 {
    now_unix() + days * 86_400
}

fn fmt_date(ts: u64) -> String {
    // Simple date display: days remaining or "Lifetime"
    if ts == 0 {
        return "Lifetime (no expiry)".to_string();
    }
    let now = now_unix();
    if ts <= now {
        return "ALREADY EXPIRED".to_string();
    }
    let days = (ts - now) / 86_400;
    // Format as approximate date
    let secs_since_epoch = ts;
    // Days since 1970-01-01
    let total_days = secs_since_epoch / 86_400;
    let (y, m, d) = days_to_ymd(total_days);
    format!("{:04}-{:02}-{:02}  ({} days from now)", y, m, d, days)
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    // Gregorian calendar approximation
    let mut y = 1970u64;
    loop {
        let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year { break; }
        days -= days_in_year;
        y += 1;
    }
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let month_days: [u64; 12] = [31, if leap {29} else {28}, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1u64;
    for &md in &month_days {
        if days < md { break; }
        days -= md;
        m += 1;
    }
    (y, m, days + 1)
}

// ── Key generation (v2 format) ─────────────────────────────────────────────────
// Payload:  {clinic_id}|{tier}|{expiry_unix}
// Signed:   CLINORA-LICENSE-v2:{payload}
// Key:      {payload}:{base64_signature}
fn generate_license(clinic_id: &str, tier: &str, expiry_unix: u64) -> String {
    let signing_key = SigningKey::from_bytes(&PRIVATE_SEED);
    let payload = format!("{}|{}|{}", clinic_id, tier, expiry_unix);
    let message = format!("CLINORA-LICENSE-v2:{}", payload);
    let signature = signing_key.sign(message.as_bytes());
    let sig_b64 = B64.encode(signature.to_bytes());
    format!("{}:{}", payload, sig_b64)
}

fn main() {
    println!("╔══════════════════════════════════════════╗");
    println!("║   Clinora License Key Generator  v2.0    ║");
    println!("╚══════════════════════════════════════════╝");
    println!();

    if !check_machine() {
        eprintln!("ERROR: This tool is not authorized to run on this machine.");
        eprintln!("Contact the developer to add this machine to the allowed list.");
        wait_and_exit(1);
    }

    let password = prompt("Enter master password: ");
    if hash_password(&password) != PASSWORD_HASH {
        eprintln!("ERROR: Incorrect password.");
        wait_and_exit(1);
    }

    println!("✓ Authenticated");
    println!();

    loop {
        println!("─── Select License Tier ───────────────────");
        println!("  1. Monthly      (30 days)   ₹1,199/mo");
        println!("  2. Annual       (365 days)  ₹9,999/yr");
        println!("  3. Lifetime     (no expiry) ₹27,999");
        println!("  4. Custom       (enter days manually)");
        println!("───────────────────────────────────────────");

        let tier_choice = prompt("Choose tier (1-4): ");

        let (tier_label, expiry_unix) = match tier_choice.as_str() {
            "1" => ("monthly".to_string(), days_from_now(32)),   // 2-day buffer
            "2" => ("annual".to_string(),  days_from_now(368)),  // 3-day buffer
            "3" => ("lifetime".to_string(), 0u64),
            "4" => {
                let days_str = prompt("Enter number of days from today: ");
                let days: u64 = match days_str.parse() {
                    Ok(d) if d > 0 => d,
                    _ => { eprintln!("Invalid number of days."); continue; }
                };
                (format!("custom-{}d", days), days_from_now(days))
            }
            _ => {
                eprintln!("Invalid choice. Enter 1, 2, 3, or 4.");
                continue;
            }
        };

        println!();
        let clinic_id = prompt("Enter Clinic ID (e.g. CLINIC-DR-SHARMA-001): ");
        if clinic_id.is_empty() {
            eprintln!("Clinic ID cannot be empty.");
            continue;
        }
        if clinic_id.contains('|') || clinic_id.contains(':') {
            eprintln!("Clinic ID must not contain '|' or ':'.");
            continue;
        }

        let license_key = generate_license(&clinic_id, &tier_label, expiry_unix);

        println!();
        println!("╔══════════════════════════════════════════════════════════════╗");
        println!("  Clinic  : {}", clinic_id);
        println!("  Tier    : {}", tier_label.to_uppercase());
        println!("  Expiry  : {}", fmt_date(expiry_unix));
        println!();
        println!("  LICENSE KEY:");
        println!("  {}", license_key);
        println!("╚══════════════════════════════════════════════════════════════╝");
        println!();
        println!("  → Send the LICENSE KEY line to the client.");
        println!("  → They paste it in the Clinora activation screen.");
        println!();

        let again = prompt("Generate another key? (y/n): ");
        if again.to_lowercase() != "y" {
            break;
        }
        println!();
    }

    println!("Done. Exiting.");
    wait_and_exit(0);
}

fn wait_and_exit(code: i32) -> ! {
    println!();
    println!("Press Enter to exit...");
    let mut s = String::new();
    io::stdin().read_line(&mut s).unwrap();
    std::process::exit(code);
}
