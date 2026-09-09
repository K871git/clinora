use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;
use std::sync::Mutex;

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
}

impl AppState {
    pub fn new(db: MySqlPool) -> Self {
        AppState {
            db,
            session: Mutex::new(None),
        }
    }
}

pub fn get_session(state: &AppState) -> crate::error::AppResult<SessionUser> {
    state
        .session
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated.".into())
}
