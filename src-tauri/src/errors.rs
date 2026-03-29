use serde::Serialize;
use std::fmt;

/// 统一错误类型，覆盖架构文档 §3.2 的全部错误码
#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl AppError {
    pub fn not_found(msg: &str) -> Self {
        Self { code: "NOT_FOUND".into(), message: msg.into(), details: None }
    }

    pub fn validation(msg: &str) -> Self {
        Self { code: "VALIDATION_ERROR".into(), message: msg.into(), details: None }
    }

    pub fn internal(msg: &str) -> Self {
        Self { code: "INTERNAL_ERROR".into(), message: msg.into(), details: None }
    }

    pub fn db_connection(msg: &str) -> Self {
        Self { code: "DB_CONNECTION_ERROR".into(), message: msg.into(), details: None }
    }

    pub fn db_query(msg: &str) -> Self {
        Self { code: "DB_QUERY_ERROR".into(), message: msg.into(), details: None }
    }

    pub fn db_migration(msg: &str) -> Self {
        Self { code: "DB_MIGRATION_ERROR".into(), message: msg.into(), details: None }
    }

    pub fn already_exists(msg: &str) -> Self {
        Self { code: "ALREADY_EXISTS".into(), message: msg.into(), details: None }
    }
}

/// 统一 API 响应包装，所有 Tauri Command 返回此类型
#[derive(Debug, Clone, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AppError>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }

    pub fn err(error: AppError) -> Self {
        Self { success: false, data: None, error: Some(error) }
    }
}
