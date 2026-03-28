//! Integration tests for OAuth helpers

use unichat_lib::services::auth::oauth_helpers::{
  extract_callback_params, parse_loopback_redirect, pkce_challenge,
};
use url::Url;

#[test]
fn test_pkce_challenge_generates_valid_hash() {
  let verifier = "test_verifier_123456";
  let challenge = pkce_challenge(verifier);

  // PKCE challenge should be base64url encoded (no padding)
  assert!(!challenge.contains('+'));
  assert!(!challenge.contains('/'));
  assert!(!challenge.ends_with('='));
  assert!(!challenge.is_empty());
}

#[test]
fn test_pkce_challenge_deterministic() {
  let verifier = "same_verifier";
  let challenge1 = pkce_challenge(verifier);
  let challenge2 = pkce_challenge(verifier);

  assert_eq!(challenge1, challenge2);
}

#[test]
fn test_parse_loopback_redirect_valid() {
  let redirect_uri = "http://localhost:3456/callback";
  let (host, port, path) = parse_loopback_redirect(redirect_uri).unwrap();

  assert_eq!(host, "localhost");
  assert_eq!(port, 3456);
  assert_eq!(path, "/callback");
}

#[test]
fn test_parse_loopback_redirect_default_path() {
  let redirect_uri = "http://localhost:8080";
  let (_, _, path) = parse_loopback_redirect(redirect_uri).unwrap();

  assert_eq!(path, "/");
}

#[test]
fn test_parse_loopback_redirect_https() {
  let redirect_uri = "https://example.com:443/oauth/callback";
  let (host, port, path) = parse_loopback_redirect(redirect_uri).unwrap();

  assert_eq!(host, "example.com");
  assert_eq!(port, 443);
  assert_eq!(path, "/oauth/callback");
}

#[test]
fn test_parse_loopback_redirect_invalid_scheme() {
  let redirect_uri = "ftp://localhost:21/callback";
  let result = parse_loopback_redirect(redirect_uri);

  assert!(result.is_err());
  assert!(result.unwrap_err().contains("http/https"));
}

#[test]
fn test_parse_loopback_redirect_missing_port() {
  // URL without explicit port and no default
  let redirect_uri = "http://localhost/callback";
  let result = parse_loopback_redirect(redirect_uri);

  // Should work with default port 80
  assert!(result.is_ok());
  let (_, port, _) = result.unwrap();
  assert_eq!(port, 80);
}

#[test]
fn test_extract_callback_params_from_query() {
  let url = Url::parse("http://localhost:3456/callback?code=abc123&state=xyz789").unwrap();
  let params = extract_callback_params(&url);

  assert_eq!(params.get("code"), Some(&"abc123".to_string()));
  assert_eq!(params.get("state"), Some(&"xyz789".to_string()));
}

#[test]
fn test_extract_callback_params_from_fragment() {
  // Implicit flow uses fragment instead of query params
  let url = Url::parse("http://localhost:3456/callback#code=abc123&state=xyz789").unwrap();
  let params = extract_callback_params(&url);

  assert_eq!(params.get("code"), Some(&"abc123".to_string()));
  assert_eq!(params.get("state"), Some(&"xyz789".to_string()));
}

#[test]
fn test_extract_callback_params_empty() {
  let url = Url::parse("http://localhost:3456/callback").unwrap();
  let params = extract_callback_params(&url);

  assert!(params.is_empty());
}

#[test]
fn test_extract_callback_params_with_error() {
  let url = Url::parse(
    "http://localhost:3456/callback?error=access_denied&error_description=User+denied+access",
  )
  .unwrap();
  let params = extract_callback_params(&url);

  assert_eq!(params.get("error"), Some(&"access_denied".to_string()));
  assert_eq!(
    params.get("error_description"),
    Some(&"User denied access".to_string())
  );
}
