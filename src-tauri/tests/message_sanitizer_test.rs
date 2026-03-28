//! Integration tests for message sanitizer helpers

use unichat_lib::helpers::message_sanitizer_helper::{
  cap_string, escape_html, sanitize_for_overlay, strip_urls,
};

#[test]
fn test_escape_html_basic() {
  let input = "Hello <world> & \"friends\"";
  let output = escape_html(input);

  assert_eq!(output, "Hello &lt;world&gt; &amp; &quot;friends&quot;");
}

#[test]
fn test_escape_html_apostrophe() {
  let input = "It's a test";
  let output = escape_html(input);

  assert_eq!(output, "It&#x27;s a test");
}

#[test]
fn test_escape_html_no_escaping_needed() {
  let input = "Plain text without special chars";
  let output = escape_html(input);

  assert_eq!(output, input);
}

#[test]
fn test_escape_html_all_special_chars() {
  let input = "<>&\"'";
  let output = escape_html(input);

  assert_eq!(output, "&lt;&gt;&amp;&quot;&#x27;");
}

#[test]
fn test_strip_urls_basic() {
  let input = "Check out https://example.com and www.test.com";
  let output = strip_urls(input);

  assert_eq!(output, "Check out  and ");
}

#[test]
fn test_strip_urls_http_only() {
  let input = "Visit http://google.com for more";
  let output = strip_urls(input);

  assert_eq!(output, "Visit  for more");
}

#[test]
fn test_strip_urls_no_urls() {
  let input = "This message has no URLs";
  let output = strip_urls(input);

  assert_eq!(output, input);
}

#[test]
fn test_cap_string_within_limit() {
  let input = "Short text";
  let output = cap_string(input, 100);

  assert_eq!(output, input);
}

#[test]
fn test_cap_string_exceeds_limit() {
  let input = "This is a longer text that should be capped";
  let output = cap_string(input, 10);

  assert_eq!(output, "This is a ");
  assert_eq!(output.len(), 10);
}

#[test]
fn test_cap_string_utf8_boundary() {
  let input = "Hello 世界";
  let output = cap_string(input, 8);

  // Should preserve UTF-8 integrity (takes 8 characters)
  assert_eq!(output, "Hello 世界");
}

#[test]
fn test_sanitize_for_overlay_full_pipeline() {
  let input = "Check out <script>alert('xss')</script> https://malicious.com";
  let output = sanitize_for_overlay(input);

  // Should escape HTML and strip URLs
  assert!(!output.contains("<script>"));
  assert!(!output.contains("https://"));
  assert!(output.contains("&lt;"));
  assert!(output.contains("&gt;"));
}

#[test]
fn test_sanitize_for_overlay_length_cap() {
  let input = "a".repeat(300);
  let output = sanitize_for_overlay(&input);

  assert!(output.len() <= 260);
}

#[test]
fn test_sanitize_for_overlay_empty() {
  let input = "";
  let output = sanitize_for_overlay(input);

  assert_eq!(output, "");
}

#[test]
fn test_strip_urls_multiple() {
  let input = "Link1: https://a.com Link2: http://b.com Link3: www.c.com";
  let output = strip_urls(input);

  assert!(!output.contains("https://"));
  assert!(!output.contains("http://"));
  assert!(!output.contains("www."));
}

#[test]
fn test_escape_html_performance() {
  // Test with larger input to ensure no performance issues
  let input = "Test ".repeat(1000);
  let output = escape_html(&input);

  assert_eq!(output.len(), input.len());
}
