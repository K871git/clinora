// ─── Clinora License Keygen ──────────────────────────────────────────────────
// PRIVATE TOOL — Do NOT share this binary or its source with anyone.
// Protected by: master password + machine GUID whitelist.
// ─────────────────────────────────────────────────────────────────────────────

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey};
use sha2::{Digest, Sha256};
use std::io::{self, Write};

// ── Private key seed (32 bytes) — KEEP THIS SECRET ───────────────────────────
const PRIVATE_SEED: [u8; 32] = [
    0x6c, 0x85, 0x8a, 0x78, 0x94, 0xa8, 0x9f, 0x27,
    0xce, 0x67, 0xa4, 0x7b, 0x11, 0x50, 0x16, 0xc9,
    0x3f, 0xdc, 0x7a, 0x0e, 0x50, 0x47, 0x95, 0x23,
    0x8f, 0x64, 0x68, 0x92, 0x20, 0x1d, 0x2b, 0xa5,
];

// ── Master password SHA-256 hash ─────────────────────────────────────────────
// Default password: ClinoraKeygen@2025!
// To change: update this hash with SHA-256 of your new password.
const PASSWORD_HASH: &str = "043d84bd9b375185e25ed181911dc279bfbbad05b8dd92647d0aa70de6d189cd";

// ── Allowed machine GUIDs (add your developer PC GUIDs here) ─────────────────
const ALLOWED_MACHINE_GUIDS: &[&str] = &[
    "ab0c747a-0e3d-4323-bfe4-6f3240846a9e", // Developer PC (Kishor)
    // Add more GUIDs here if you have multiple dev machines:
    // "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
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

fn prompt(label: &str, hidden: bool) -> String {
    print!("{}", label);
    io::stdout().flush().unwrap();
    if hidden {
        rpassword_read()
    } else {
        let mut s = String::new();
        io::stdin().read_line(&mut s).unwrap();
        s.trim().to_string()
    }
}

fn rpassword_read() -> String {
    // Simple hidden input: read line (password will be visible on Windows console
    // unless rpassword crate is added — acceptable for a dev-only tool)
    let mut s = String::new();
    io::stdin().read_line(&mut s).unwrap();
    s.trim().to_string()
}

fn hash_password(pass: &str) -> String {
    let mut h = Sha256::new();
    h.update(pass.as_bytes());
    format!("{:x}", h.finalize())
}

fn generate_license(clinic_id: &str) -> String {
    let signing_key = SigningKey::from_bytes(&PRIVATE_SEED);
    let message = format!("CLINORA-LICENSE-v1:{}", clinic_id);
    let signature = signing_key.sign(message.as_bytes());
    let sig_b64 = B64.encode(signature.to_bytes());
    format!("{}:{}", clinic_id, sig_b64)
}

fn main() {
    println!("╔══════════════════════════════════════╗");
    println!("║     Clinora License Key Generator     ║");
    println!("╚══════════════════════════════════════╝");
    println!();

    // ── Step 1: Machine GUID check ────────────────────────────────────────────
    if !check_machine() {
        eprintln!("ERROR: This tool is not authorized to run on this machine.");
        eprintln!("Contact the developer to add this machine to the allowed list.");
        wait_and_exit(1);
    }

    // ── Step 2: Password check ────────────────────────────────────────────────
    let password = prompt("Enter master password: ", false);
    if hash_password(&password) != PASSWORD_HASH {
        eprintln!("ERROR: Incorrect password.");
        wait_and_exit(1);
    }

    println!("✓ Authenticated");
    println!();

    // ── Step 3: Generate key ──────────────────────────────────────────────────
    loop {
        let clinic_id = prompt("Enter Clinic ID (e.g. CLINIC-001 or clinic name): ", false);
        if clinic_id.is_empty() {
            eprintln!("Clinic ID cannot be empty.");
            continue;
        }

        let license_key = generate_license(&clinic_id);

        println!();
        println!("══════════════════════════════════════════════════");
        println!("  Clinic  : {}", clinic_id);
        println!("  License Key:");
        println!("  {}", license_key);
        println!("══════════════════════════════════════════════════");
        println!();
        println!("Send the entire line above to the client.");
        println!("They paste it into the Clinora license screen.");
        println!();

        let again = prompt("Generate another key? (y/n): ", false);
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
