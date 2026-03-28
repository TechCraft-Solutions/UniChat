//! Integration tests for message filter service

use std::collections::HashSet;
use unichat_lib::services::message_filter_service::MessageFilterService;

#[tokio::test]
async fn test_filter_service_default_config() {
  let service = MessageFilterService::new();

  assert!(service.is_strip_urls_enabled().await);
  assert_eq!(service.get_max_length().await, 260);
  assert!(service.get_blocked_words().await.is_empty());
}

#[tokio::test]
async fn test_filter_service_custom_config() {
  let mut blocked_words = HashSet::new();
  blocked_words.insert("spam".to_string());

  let service = MessageFilterService::with_config(blocked_words, false, 100);

  assert!(!service.is_strip_urls_enabled().await);
  assert_eq!(service.get_max_length().await, 100);
  assert_eq!(service.get_blocked_words().await.len(), 1);
}

#[tokio::test]
async fn test_filter_service_add_blocked_word() {
  let service = MessageFilterService::new();

  service.add_blocked_word("test".to_string()).await;

  assert_eq!(service.get_blocked_words().await.len(), 1);
  assert!(service.get_blocked_words().await.contains("test"));
}

#[tokio::test]
async fn test_filter_service_add_blocked_words_case_insensitive() {
  let service = MessageFilterService::new();

  service.add_blocked_word("TEST".to_string()).await;

  // Should be stored as lowercase
  assert!(service.get_blocked_words().await.contains("test"));
}

#[tokio::test]
async fn test_filter_service_remove_blocked_word() {
  let service = MessageFilterService::new();
  service.add_blocked_word("remove".to_string()).await;

  service.remove_blocked_word("remove").await;

  assert!(service.get_blocked_words().await.is_empty());
}

#[tokio::test]
async fn test_filter_service_clear_blocked_words() {
  let service = MessageFilterService::new();
  service.add_blocked_word("word1".to_string()).await;
  service.add_blocked_word("word2".to_string()).await;

  service.clear_blocked_words().await;

  assert!(service.get_blocked_words().await.is_empty());
}

#[tokio::test]
async fn test_filter_service_contains_blocked_words() {
  let service = MessageFilterService::new();
  service.add_blocked_word("blocked".to_string()).await;

  assert!(
    service
      .contains_blocked_words("This contains blocked word")
      .await
  );
  assert!(!service.contains_blocked_words("This is clean").await);
}

#[tokio::test]
async fn test_filter_service_sanitize_message_blocked() {
  let service = MessageFilterService::new();
  service.add_blocked_word("badword".to_string()).await;

  let input = "This contains badword in the message";
  let output = service.sanitize_message(input).await;

  assert!(!output.contains("badword"));
  assert!(output.contains("***"));
}

#[tokio::test]
async fn test_filter_service_sanitize_message_url_strip() {
  let service = MessageFilterService::new();

  let input = "Check out https://example.com";
  let output = service.sanitize_message(input).await;

  assert!(!output.contains("https://"));
  assert!(!output.contains("example.com"));
}

#[tokio::test]
async fn test_filter_service_sanitize_message_html_escape() {
  let service = MessageFilterService::new();

  let input = "<script>alert('xss')</script>";
  let output = service.sanitize_message(input).await;

  assert!(!output.contains("<script>"));
  assert!(output.contains("&lt;"));
  assert!(output.contains("&gt;"));
}

#[tokio::test]
async fn test_filter_service_sanitize_message_length_cap() {
  let service = MessageFilterService::new();

  let input = "a".repeat(300);
  let output = service.sanitize_message(&input).await;

  assert!(output.len() <= 260);
}

#[tokio::test]
async fn test_filter_service_set_strip_urls_enabled() {
  let service = MessageFilterService::new();

  service.set_strip_urls_enabled(false).await;

  assert!(!service.is_strip_urls_enabled().await);
}

#[tokio::test]
async fn test_filter_service_set_max_length() {
  let service = MessageFilterService::new();

  service.set_max_length(50).await;

  assert_eq!(service.get_max_length().await, 50);
}

#[tokio::test]
async fn test_filter_service_sanitize_chat_message() {
  use unichat_lib::models::chat_message_model::ChatMessageModel;

  let service = MessageFilterService::new();
  service.add_blocked_word("spam".to_string()).await;

  let message = ChatMessageModel {
    id: "test-1".to_string(),
    platform: unichat_lib::models::provider_contract_model::PlatformTypeModel::Twitch,
    author: "TestUser".to_string(),
    text: "This is spam message".to_string(),
    timestamp: "2024-01-01T00:00:00Z".to_string(),
    is_supporter: false,
    source_channel_id: "channel-1".to_string(),
    source_user_id: "user-1".to_string(),
    author_avatar_url: None,
    badges: vec![],
    emotes: None,
    raw_payload: None,
    is_deleted: false,
    reply_to_message_id: None,
  };

  let sanitized = service.sanitize_chat_message(&message).await;

  assert!(!sanitized.text.contains("spam"));
}

#[tokio::test]
async fn test_filter_service_multiple_blocked_words() {
  let service = MessageFilterService::new();
  service.add_blocked_word("word1".to_string()).await;
  service.add_blocked_word("word2".to_string()).await;
  service.add_blocked_word("word3".to_string()).await;

  assert_eq!(service.get_blocked_words().await.len(), 3);

  let input = "Contains word1 and word2 and word3";
  let output = service.sanitize_message(input).await;

  assert!(!output.contains("word1"));
  assert!(!output.contains("word2"));
  assert!(!output.contains("word3"));
}
