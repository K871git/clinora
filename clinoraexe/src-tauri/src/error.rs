use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError(pub String);

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        // Log full detail server-side only; never expose internal DB messages to the client
        eprintln!("[db-error] {:?}", e);
        let msg = match &e {
            sqlx::Error::RowNotFound  => "Record not found.",
            sqlx::Error::PoolTimedOut => "Database is busy — please try again.",
            sqlx::Error::PoolClosed   => "Database connection is closed.",
            _                         => "A database error occurred.",
        };
        AppError(msg.to_string())
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(e: bcrypt::BcryptError) -> Self {
        eprintln!("[auth-error] {:?}", e);
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
