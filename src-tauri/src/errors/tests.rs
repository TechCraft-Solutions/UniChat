//! Error type tests

use crate::errors::UniChatError;

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
