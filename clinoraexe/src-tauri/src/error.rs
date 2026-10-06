use serde::Serialize;
use std::io::Write as _;

#[derive(Debug, Serialize)]
pub struct AppError(pub String);

// Safe log: discards BrokenPipe instead of panicking (Windows closes stderr)
macro_rules! safe_log {
    ($($arg:tt)*) => {
        let _ = writeln!(std::io::stderr(), $($arg)*);
    };
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        safe_log!("[db-error] {:?}", e);
        let msg = match &e {
            sqlx::Error::RowNotFound  => "Record not found.",
            sqlx::Error::PoolTimedOut => "Database is busy — please try again.",
            sqlx::Error::PoolClosed   => "Database connection is closed.",
            sqlx::Error::Database(db_err) => {
                let detail = format!("DB: {} (code {:?})", db_err.message(), db_err.code());
                safe_log!("[db-error-detail] {}", detail);
                return AppError(detail);
            },
            _                         => "A database error occurred.",
        };
        AppError(msg.to_string())
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(e: bcrypt::BcryptError) -> Self {
        safe_log!("[auth-error] {:?}", e);
        AppError("Authentication error.".to_string())
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError(s.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
