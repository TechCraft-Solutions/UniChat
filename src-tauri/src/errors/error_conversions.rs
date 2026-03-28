//! Error type conversions
//! Implements From traits for external error types

use crate::errors::error_types::UniChatError;

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
