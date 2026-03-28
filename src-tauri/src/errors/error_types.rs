//! UniChat error types
//! Provides structured error handling across the application

use thiserror::Error;

/// Main application error type
#[derive(Error, Debug)]
pub enum UniChatError {
  /// OAuth authentication errors
  #[error("OAuth error: {0}")]
  OAuth(String),

  /// Network/HTTP errors
  #[error("Network error: {0}")]
  Network(String),

  /// Configuration errors
  #[error("Configuration error: {0}")]
  Configuration(String),

  /// Authentication/authorization errors
  #[error("Auth error: {0}")]
  Auth(String),

  /// Data persistence errors
  #[error("Storage error: {0}")]
  Storage(String),

  /// Platform-specific errors
  #[error("Platform error ({platform}): {message}")]
  Platform { platform: String, message: String },

  /// Validation errors
  #[error("Validation error: {0}")]
  Validation(String),

  /// Internal errors (should not happen)
  #[error("Internal error: {0}")]
  Internal(String),
}

/// Result type alias for UniChat operations
pub type UniChatResult<T> = Result<T, UniChatError>;
