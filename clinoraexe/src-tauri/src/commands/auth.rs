use crate::error::AppResult;
use crate::state::{get_session, AppState, ClinicBasic, SessionUser};
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
pub struct LoginPayload {
    pub email: String,
    pub password: String,
    pub role: String,
}

#[derive(sqlx::FromRow)]
struct UserRow {
    id: u64,
    clinic_id: u64,
    name: String,
    email: String,
    password: String,
    role: String,
    is_active: i8,
    avatar: Option<String>,
    clinic_name: String,
}

#[tauri::command]
pub async fn login(
    payload: LoginPayload,
    state: State<'_, AppState>,
) -> AppResult<SessionUser> {
    let row = sqlx::query_as::<_, UserRow>(
        "SELECT u.id, u.clinic_id, u.name, u.email, u.password, u.role,
                u.is_active, u.avatar, c.name as clinic_name
         FROM users u
         JOIN clinics c ON c.id = u.clinic_id
         WHERE u.email = ? AND u.role = ?
         LIMIT 1",
    )
    .bind(&payload.email)
    .bind(&payload.role)
    .fetch_optional(&state.db)
    .await?
    .ok_or("Invalid email or password.")?;

    if row.is_active == 0 {
        return Err("Your account is inactive.".into());
    }

    let valid = bcrypt::verify(&payload.password, &row.password)?;
    if !valid {
        return Err("Invalid email or password.".into());
    }

    let user = SessionUser {
        id: row.id,
        clinic_id: row.clinic_id,
        name: row.name,
        email: row.email,
        role: row.role,
        is_active: row.is_active,
        avatar: row.avatar,
        clinic: ClinicBasic {
            id: row.clinic_id,
            name: row.clinic_name,
        },
    };

    *state.session.lock().unwrap() = Some(user.clone());
    Ok(user)
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> AppResult<()> {
    *state.session.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn get_me(state: State<'_, AppState>) -> AppResult<SessionUser> {
    get_session(&state)
}
