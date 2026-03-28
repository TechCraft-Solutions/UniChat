use regex::Regex;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::helpers::message_sanitizer_helper::{cap_string, escape_html, strip_urls};
use crate::models::chat_message_model::ChatMessageModel;

/// Filter configuration snapshot for atomic config access
struct FilterConfig {
  blocked_words: HashSet<String>,
  strip_urls_enabled: bool,
  max_length: usize,
}

// Lazy regex compilation for word boundary matching
static WORD_REGEX: once_cell::sync::Lazy<Regex> =
  once_cell::sync::Lazy::new(|| Regex::new(r"(?i)\b\w+\b").unwrap());

/// MessageFilterService - Safety filters for chat messages
///
/// This service provides canonical sanitization and filtering:
/// 1. Blocked words filtering
/// 2. URL/link stripping
/// 3. HTML escaping for overlay safety
/// 4. Message length capping
///
/// All platform connectors should pass messages through this service
/// before routing to ensure consistent safety across all sources.
pub struct MessageFilterService {
  /// Filter configuration (atomic snapshot for reduced lock contention)
  config: Arc<RwLock<FilterConfig>>,
}

impl MessageFilterService {
  /// Create a new MessageFilterService with default settings
  pub fn new() -> Self {
    Self {
      config: Arc::new(RwLock::new(FilterConfig {
        blocked_words: HashSet::new(),
        strip_urls_enabled: true,
        max_length: 260,
      })),
    }
  }

  /// Create with custom settings
  pub fn with_config(blocked_words: HashSet<String>, strip_urls: bool, max_len: usize) -> Self {
    Self {
      config: Arc::new(RwLock::new(FilterConfig {
        blocked_words,
        strip_urls_enabled: strip_urls,
        max_length: max_len,
      })),
    }
  }

  /// Get a snapshot of current filter configuration (reduces lock contention)
  async fn get_config_snapshot(&self) -> FilterConfig {
    let config = self.config.read().await;
    FilterConfig {
      blocked_words: config.blocked_words.clone(),
      strip_urls_enabled: config.strip_urls_enabled,
      max_length: config.max_length,
    }
  }

  /// Apply all filters to a message text
  ///
  /// This is the canonical sanitization path - all messages should flow through here.
  ///
  /// # Arguments
  /// * `text` - Raw message text from platform
  ///
  /// # Returns
  /// Filtered and sanitized text safe for overlay display
  pub async fn sanitize_message(&self, text: &str) -> String {
    // Get config snapshot in single lock acquisition (reduces lock contention)
    let config = self.get_config_snapshot().await;

    let mut result = text.to_string();

    // 1. Apply blocked words
    result = Self::apply_blocked_words_with_config(&config.blocked_words, &result);

    // 2. Strip URLs if enabled
    if config.strip_urls_enabled {
      result = strip_urls(&result);
    }

    // 3. Escape HTML for safety
    result = escape_html(&result);

    // 4. Cap length
    result = cap_string(&result, config.max_length);

    result
  }

  /// Apply blocked words filter to text (static helper for use with config snapshot)
  fn apply_blocked_words_with_config(blocked: &HashSet<String>, text: &str) -> String {
    let mut result = text.to_string();
    for word in blocked.iter() {
      if contains_word(&result, word) {
        result = replace_word(&result, word, "*");
      }
    }
    result
  }

  /// Apply blocked words filter to text
  ///
  /// # Arguments
  /// * `text` - Message text to filter
  ///
  /// # Returns
  /// Text with blocked words replaced with asterisks
  pub async fn apply_blocked_words(&self, text: &str) -> String {
    let config = self.get_config_snapshot().await;
    Self::apply_blocked_words_with_config(&config.blocked_words, text)
  }

  /// Strip URLs from text
  ///
  /// # Arguments
  /// * `text` - Message text
  ///
  /// # Returns
  /// Text with URLs removed
  pub fn strip_urls_from_message(&self, text: &str) -> String {
    strip_urls(text)
  }

  /// Check if a message contains blocked words
  pub async fn contains_blocked_words(&self, text: &str) -> bool {
    let config = self.get_config_snapshot().await;
    config
      .blocked_words
      .iter()
      .any(|word| contains_word(text, word))
  }

  /// Add a word to the blocked list
  pub async fn add_blocked_word(&self, word: String) {
    let mut config = self.config.write().await;
    config.blocked_words.insert(word.to_lowercase());
  }

  /// Add multiple words to the blocked list
  pub async fn add_blocked_words(&self, words: Vec<String>) {
    let mut config = self.config.write().await;
    for word in words {
      config.blocked_words.insert(word.to_lowercase());
    }
  }

  /// Remove a word from the blocked list
  pub async fn remove_blocked_word(&self, word: &str) {
    let mut config = self.config.write().await;
    config.blocked_words.remove(&word.to_lowercase());
  }

  /// Clear all blocked words
  pub async fn clear_blocked_words(&self) {
    let mut config = self.config.write().await;
    config.blocked_words.clear();
  }

  /// Get all blocked words
  pub async fn get_blocked_words(&self) -> HashSet<String> {
    self.config.read().await.blocked_words.clone()
  }

  /// Enable or disable URL stripping
  pub async fn set_strip_urls_enabled(&self, enabled: bool) {
    let mut config = self.config.write().await;
    config.strip_urls_enabled = enabled;
  }

  /// Check if URL stripping is enabled
  pub async fn is_strip_urls_enabled(&self) -> bool {
    self.config.read().await.strip_urls_enabled
  }

  /// Set maximum message length
  pub async fn set_max_length(&self, length: usize) {
    let mut config = self.config.write().await;
    config.max_length = length;
  }

  /// Get current maximum message length
  pub async fn get_max_length(&self) -> usize {
    self.config.read().await.max_length
  }

  /// Sanitize a ChatMessageModel in place
  ///
  /// # Arguments
  /// * `message` - Message to sanitize
  ///
  /// # Returns
  /// New message with sanitized text
  pub async fn sanitize_chat_message(&self, message: &ChatMessageModel) -> ChatMessageModel {
    let mut sanitized = message.clone();
    sanitized.text = self.sanitize_message(&message.text).await;
    sanitized
  }
}

impl Default for MessageFilterService {
  fn default() -> Self {
    Self::new()
  }
}

// --- Helper Functions ---
// Note: escape_html, strip_urls, cap_string are now imported from message_sanitizer_helper

/// Check if text contains a word (case-insensitive, word boundary aware)
fn contains_word(text: &str, word: &str) -> bool {
  let word_lower = word.to_lowercase();
  WORD_REGEX.is_match(text) && {
    WORD_REGEX
      .find_iter(text)
      .any(|m: regex::Match| m.as_str().to_lowercase() == word_lower)
  }
}

/// Replace all occurrences of a word with replacement (case-insensitive)
fn replace_word(text: &str, word: &str, _replacement: &str) -> String {
  let word_lower = word.to_lowercase();
  let replacement_stars = "*".repeat(word.len());

  WORD_REGEX
    .replace_all(text, |caps: &regex::Captures| {
      let matched = caps.get(0).unwrap().as_str();
      if matched.to_lowercase() == word_lower {
        replacement_stars.clone()
      } else {
        matched.to_string()
      }
    })
    .to_string()
}
