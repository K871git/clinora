use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClinicBasic {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionUser {
    pub id: u64,
    pub clinic_id: u64,
    pub name: String,
    pub email: String,
    pub role: String,
    pub is_active: i8,
    pub avatar: Option<String>,
    pub clinic: ClinicBasic,
}

pub struct AppState {
    pub db: MySqlPool,
    pub session: Mutex<Option<SessionUser>>,
    /// Tracks (failure_count, time_of_first_failure) per email for login rate-limiting.
    pub login_attempts: Mutex<HashMap<String, (u32, Instant)>>,
}

impl AppState {
    pub fn new(db: MySqlPool) -> Self {
        AppState {
            db,
            session: Mutex::new(None),
            login_attempts: Mutex::new(HashMap::new()),
        }
    }
}

pub fn get_session(state: &AppState) -> crate::error::AppResult<SessionUser> {
    state
        .session
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .ok_or("Not authenticated.".into())
}
