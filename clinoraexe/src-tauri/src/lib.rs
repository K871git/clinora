mod commands;
mod error;
mod state;

#[cfg(windows)]
extern crate windows;

use state::AppState;
use sqlx::mysql::MySqlPoolOptions;
use tauri::Manager;

fn fatal_error(msg: &str) -> ! {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
        let title: Vec<u16> = "Clinora — Error\0".encode_utf16().collect();
        let text: Vec<u16> = format!("{}\0", msg).encode_utf16().collect();
        unsafe {
            MessageBoxW(None, PCWSTR(text.as_ptr()), PCWSTR(title.as_ptr()), MB_OK | MB_ICONERROR);
        }
    }
    #[cfg(not(windows))]
    eprintln!("FATAL: {}", msg);
    std::process::exit(1);
}

/// Returns true if clinora.cfg has "configured": true
fn is_configured() -> bool {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let cfg = dir.join("data").join("clinora.cfg");
            if let Ok(contents) = std::fs::read_to_string(&cfg) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                    return val.get("configured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                }
            }
        }
    }
    false
}

fn load_db_url() -> String {
    if let Ok(url) = std::env::var("CLINORA_DB_URL") {
        if !url.trim().is_empty() {
            return url.trim().to_string();
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let cfg = dir.join("data").join("clinora.cfg");
            if let Ok(contents) = std::fs::read_to_string(&cfg) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&contents) {
                    if let Some(url) = val.get("db_url").and_then(|v| v.as_str()) {
                        if !url.trim().is_empty() {
                            return url.trim().to_string();
                        }
                    }
                }
            }
        }
    }
    fatal_error("Cannot load database URL from config.");
}

#[cfg(windows)]
fn show_error_dialog(msg: &str) {
    use windows::core::PCWSTR;
    use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    let title: Vec<u16> = "Clinora — Error\0".encode_utf16().collect();
    let text: Vec<u16> = format!("{}\0", msg).encode_utf16().collect();
    unsafe {
        MessageBoxW(None, PCWSTR(text.as_ptr()), PCWSTR(title.as_ptr()), MB_OK | MB_ICONERROR);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Catch every Rust panic and show it as a dialog instead of silently exiting.
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Clinora encountered an unexpected error and must close.\n\n{}", info);
        #[cfg(windows)]
        show_error_dialog(&msg);
        #[cfg(not(windows))]
        eprintln!("CRASH: {}", msg);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let configured = is_configured();

            let pool = if configured {
                // Full connection + migrations
                tauri::async_runtime::block_on(async {
                    let db_url = load_db_url();
                    let pool = MySqlPoolOptions::new()
                        .max_connections(5)
                        .connect(&db_url)
                        .await
                        .unwrap_or_else(|e| fatal_error(&format!(
                            "Cannot connect to the database.\n\nError: {}\n\n\
                             Check that:\n\
                             • MySQL is running\n\
                             • Credentials in data/clinora.cfg are correct\n\
                             • The database 'clinoradb' exists", e
                        )));

                    sqlx::migrate!("./migrations")
                        .run(&pool)
                        .await
                        .unwrap_or_else(|e| fatal_error(&format!(
                            "Database setup failed.\n\nError: {}", e
                        )));

                    pool
                })
            } else {
                // Not yet configured — create a lazy placeholder pool.
                // connect_lazy still needs a Tokio context even though it never connects.
                tauri::async_runtime::block_on(async {
                    MySqlPoolOptions::new()
                        .max_connections(1)
                        .connect_lazy("mysql://setup:setup@127.0.0.1:3306/setup")
                        .unwrap_or_else(|e| fatal_error(&format!("Internal error: {}", e)))
                })
            };

            if configured {
                app.manage(AppState::new(pool));
            } else {
                app.manage(AppState::unconfigured(pool));
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Setup wizard
            commands::setup::get_setup_status,
            commands::setup::test_db_connection,
            commands::setup::save_setup_config,
            commands::setup::restart_app,
            // Auth
            commands::auth::login,
            commands::auth::logout,
            commands::auth::get_me,
            // Dashboard
            commands::dashboard::get_dashboard_stats,
            commands::dashboard::get_today_patients,
            commands::dashboard::get_pending_rx,
            commands::dashboard::get_revenue,
            commands::dashboard::get_revenue_transactions,
            // Patients
            commands::patients::list_patients,
            commands::patients::get_patient,
            commands::patients::create_patient,
            commands::patients::update_patient,
            commands::patients::get_patient_visits,
            commands::patients::get_patient_prescriptions,
            // Visits
            commands::visits::list_visits,
            commands::visits::create_visit,
            commands::visits::get_visit,
            commands::visits::update_visit,
            commands::visits::update_visit_fee,
            commands::visits::complete_visit,
            commands::visits::record_visit_payment,
            // Prescriptions
            commands::prescriptions::list_prescriptions,
            commands::prescriptions::create_prescription,
            commands::prescriptions::get_prescription,
            commands::prescriptions::update_prescription,
            commands::prescriptions::send_prescription,
            commands::prescriptions::delete_prescription,
            commands::prescriptions::get_patient_prescriptions_list,
            // Pharmacy
            commands::pharmacy::get_pharmacy_stats,
            commands::pharmacy::list_pharmacy_prescriptions,
            commands::pharmacy::get_pharmacy_prescription,
            commands::pharmacy::start_dispensing,
            commands::pharmacy::complete_pharmacy_prescription,
            commands::pharmacy::get_pharmacy_history,
            commands::pharmacy::record_prescription_payment,
            commands::pharmacy::get_pharmacy_revenue,
            commands::pharmacy::get_pharmacy_revenue_transactions,
            // Stock Items
            commands::stock_items::list_stock_items,
            commands::stock_items::create_stock_item,
            commands::stock_items::update_stock_item,
            commands::stock_items::delete_stock_item,
            // Medicines
            commands::medicines::list_medicines,
            commands::medicines::create_medicine,
            commands::medicines::update_medicine,
            commands::medicines::delete_medicine,
            commands::medicines::import_medicines,
            commands::medicines::parse_medicine_document,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_clinic,
            commands::settings::update_prescription_settings,
            commands::settings::update_clinic_name,
            commands::settings::list_templates,
            commands::settings::upload_template,
            commands::settings::delete_template,
            commands::settings::set_active_template,
            commands::settings::read_template_file,
            commands::settings::scan_template_layout,
            // Downloads
            commands::downloads::write_text_to_downloads,
            commands::downloads::write_bytes_to_downloads,
            // License
            commands::license::get_license_status,
            commands::license::activate_license,
            // Profile
            commands::profile::get_profile,
            commands::profile::update_profile,
            commands::profile::update_password,
            commands::profile::upload_avatar,
            commands::profile::remove_avatar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
