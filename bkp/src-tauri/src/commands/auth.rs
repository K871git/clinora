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

const MAX_ATTEMPTS: u32 = 5;
const LOCKOUT_SECS: u64 = 300; // 5 minutes

#[tauri::command]
pub async fn login(
    payload: LoginPayload,
    state: State<'_, AppState>,
) -> AppResult<SessionUser> {
    // ── Rate limiting ────────────────────────────────────────────────────────
    {
        let mut attempts = state.login_attempts.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((count, since)) = attempts.get(&payload.email) {
            if *count >= MAX_ATTEMPTS {
                let elapsed = since.elapsed().as_secs();
                if elapsed < LOCKOUT_SECS {
                    let remaining_mins = ((LOCKOUT_SECS - elapsed) + 59) / 60;
                    return Err(format!(
                        "Too many failed attempts. Try again in {} minute(s).",
                        remaining_mins
                    ).into());
                } else {
                    attempts.remove(&payload.email);
                }
            }
        }
    }

    // ── Lookup user ──────────────────────────────────────────────────────────
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
    .await?;

    let fail = || -> AppResult<SessionUser> {
        let mut attempts = state.login_attempts.lock().unwrap_or_else(|e| e.into_inner());
        let entry = attempts
            .entry(payload.email.clone())
            .or_insert((0, std::time::Instant::now()));
        entry.0 += 1;
        Err("Invalid email or password.".into())
    };

    let row = match row {
        Some(r) => r,
        None => return fail(),
    };

    if row.is_active == 0 {
        return Err("Your account is inactive.".into());
    }

    let valid = bcrypt::verify(&payload.password, &row.password)?;
    if !valid {
        return fail();
    }

    // ── Success — clear attempts ─────────────────────────────────────────────
    {
        let mut attempts = state.login_attempts.lock().unwrap_or_else(|e| e.into_inner());
        attempts.remove(&payload.email);
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

    *state.session.lock().unwrap_or_else(|e| e.into_inner()) = Some(user.clone());
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
