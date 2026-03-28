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

// Conversion helpers
impl From<reqwest::Error> for UniChatError {
  fn from(err: reqwest::Error) -> Self {
    UniChatError::Network(err.to_string())
  }
}

impl From<serde_json::Error> for UniChatError {
  fn from(err: serde_json::Error) -> Self {
    UniChatError::Internal(format!("JSON serialization failed: {err}"))
  }
}

impl From<url::ParseError> for UniChatError {
  fn from(err: url::ParseError) -> Self {
    UniChatError::Validation(format!("Invalid URL: {err}"))
  }
}

impl From<keyring::Error> for UniChatError {
  fn from(err: keyring::Error) -> Self {
    UniChatError::Storage(format!("Keyring operation failed: {err}"))
  }
}

// Specific error constructors
impl UniChatError {
  /// Create an OAuth error
  pub fn oauth(msg: impl Into<String>) -> Self {
    UniChatError::OAuth(msg.into())
  }

  /// Create a network error
  pub fn network(msg: impl Into<String>) -> Self {
    UniChatError::Network(msg.into())
  }

  /// Create a configuration error
  pub fn configuration(msg: impl Into<String>) -> Self {
    UniChatError::Configuration(msg.into())
  }

  /// Create an auth error
  pub fn auth(msg: impl Into<String>) -> Self {
    UniChatError::Auth(msg.into())
  }

  /// Create a platform-specific error
  pub fn platform(platform: impl Into<String>, message: impl Into<String>) -> Self {
    UniChatError::Platform {
      platform: platform.into(),
      message: message.into(),
    }
  }

  /// Create a validation error
  pub fn validation(msg: impl Into<String>) -> Self {
    UniChatError::Validation(msg.into())
  }

  /// Check if this is an authentication error
  pub fn is_auth_error(&self) -> bool {
    matches!(self, UniChatError::Auth(_) | UniChatError::OAuth(_))
  }

  /// Check if this is a network error
  pub fn is_network_error(&self) -> bool {
    matches!(self, UniChatError::Network(_))
  }

  /// Check if this is a configuration error
  pub fn is_configuration_error(&self) -> bool {
    matches!(self, UniChatError::Configuration(_))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_error_display() {
    let err = UniChatError::oauth("token expired");
    assert_eq!(err.to_string(), "OAuth error: token expired");

    let err = UniChatError::network("connection timeout");
    assert_eq!(err.to_string(), "Network error: connection timeout");

    let err = UniChatError::platform("twitch", "rate limited");
    assert_eq!(err.to_string(), "Platform error (twitch): rate limited");
  }

  #[test]
  fn test_error_predicates() {
    let auth_err = UniChatError::auth("invalid credentials");
    assert!(auth_err.is_auth_error());
    assert!(!auth_err.is_network_error());

    let network_err = UniChatError::network("timeout");
    assert!(network_err.is_network_error());
    assert!(!network_err.is_auth_error());
  }

  #[test]
  fn test_error_conversions() {
    // Test serde_json error conversion
    let json_err = serde_json::from_str::<String>("invalid json");
    assert!(json_err.is_err());
    let unichat_err: UniChatError = json_err.unwrap_err().into();
    assert!(matches!(unichat_err, UniChatError::Internal(_)));
  }
}
