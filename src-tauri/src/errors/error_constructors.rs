//! Error constructors and predicates
//! Provides convenient error creation and checking methods

use crate::errors::error_types::UniChatError;

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
