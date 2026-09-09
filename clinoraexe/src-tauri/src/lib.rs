mod commands;
mod error;
mod state;

use state::AppState;
use sqlx::mysql::MySqlPoolOptions;
use tauri::Manager;

pub const DB_URL: &str = "mysql://root:npav@127.0.0.1:3306/clinoradb";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(async {
                MySqlPoolOptions::new()
                    .max_connections(5)
                    .connect(DB_URL)
                    .await
                    .expect("Failed to connect to MySQL. Is it running?")
            });
            app.manage(AppState::new(pool));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
            // Settings
            commands::settings::get_settings,
            commands::settings::update_clinic,
            commands::settings::update_prescription_settings,
            commands::settings::update_clinic_name,
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
