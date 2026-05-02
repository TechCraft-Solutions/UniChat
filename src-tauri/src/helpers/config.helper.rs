//! Application Configuration Helper
//! Centralized config loading from environment variables and .env files
//! Inspired by TaskFlow's approach with runtime fallback support

use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct AppConfig {
  // App metadata
  pub name: String,
  pub version: String,

  // OAuth settings
  pub oauth_redirect_uri: String,

  // Platform credentials (all Optional for graceful degradation)
  pub twitch_client_id: Option<String>,
  pub twitch_client_secret: Option<String>,
  pub kick_client_id: Option<String>,
  pub kick_client_secret: Option<String>,
  pub youtube_client_id: Option<String>,
  pub youtube_client_secret: Option<String>,
  pub youtube_data_api_key: Option<String>,

  // Feature flags
  pub enable_debug_logging: bool,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self::new()
  }
}

impl AppConfig {
  pub fn new() -> Self {
    eprintln!("[Config] Loading application configuration...");

    // Load environment variables from all sources
    let env_vars = Self::load_env_vars();

    let config = AppConfig {
      // App metadata
      name: "UniChat".to_string(),
      version: env!("CARGO_PKG_VERSION").to_string(),

      // OAuth settings
      oauth_redirect_uri: env_vars
        .get("UNICHAT_OAUTH_REDIRECT_URI")
        .cloned()
        .unwrap_or_else(|| {
          eprintln!("[Config] UNICHAT_OAUTH_REDIRECT_URI not set, using default");
          "http://localhost:3456/callback".to_string()
        }),

      // Platform credentials
      twitch_client_id: env_vars.get("TWITCH_CLIENT_ID").cloned(),
      twitch_client_secret: env_vars.get("TWITCH_CLIENT_SECRET").cloned(),
      kick_client_id: env_vars.get("KICK_CLIENT_ID").cloned(),
      kick_client_secret: env_vars.get("KICK_CLIENT_SECRET").cloned(),
      youtube_client_id: env_vars.get("YOUTUBE_CLIENT_ID").cloned(),
      youtube_client_secret: env_vars.get("YOUTUBE_CLIENT_SECRET").cloned(),
      youtube_data_api_key: env_vars.get("YOUTUBE_DATA_API_KEY").cloned(),

      // Feature flags
      enable_debug_logging: env_vars
        .get("UNICHAT_DEBUG")
        .map(|s| s.to_lowercase() == "true")
        .unwrap_or(false),
    };

    config.log_status();
    config
  }

  /// Log which platforms are configured
  fn log_status(&self) {
    eprintln!("[Config] === Configuration Status ===");
    eprintln!("[Config] App: {} v{}", self.name, self.version);
    eprintln!(
      "[Config] Twitch OAuth: {}",
      if self.twitch_client_id.is_some() {
        "configured"
      } else {
        "NOT configured (set TWITCH_CLIENT_ID)"
      }
    );
    eprintln!(
      "[Config] Kick OAuth: {}",
      if self.kick_client_id.is_some() {
        "configured"
      } else {
        "NOT configured (set KICK_CLIENT_ID)"
      }
    );
    eprintln!(
      "[Config] YouTube OAuth: {}",
      if self.youtube_client_id.is_some() {
        "configured"
      } else {
        "NOT configured (set YOUTUBE_CLIENT_ID)"
      }
    );
    eprintln!(
      "[Config] YouTube Data API: {}",
      if self.youtube_data_api_key.is_some() {
        "configured"
      } else {
        "NOT configured (set YOUTUBE_DATA_API_KEY)"
      }
    );
    eprintln!("[Config] Debug logging: {}", self.enable_debug_logging);
    eprintln!("[Config] ================================");
  }

  /// Load environment variables from multiple sources
  fn load_env_vars() -> HashMap<String, String> {
    let mut env_vars = HashMap::new();

    // First: try actual environment variables (highest priority)
    for (key, value) in std::env::vars() {
      if key.contains("TWITCH")
        || key.contains("KICK")
        || key.contains("YOUTUBE")
        || key.contains("UNICHAT")
      {
        env_vars.insert(key, value);
      }
    }

    // Second: try embedded .env (compile-time, like TaskFlow)
    let embedded = Self::load_embedded_env();
    for (key, value) in embedded {
      env_vars.entry(key).or_insert(value);
    }

    // Third: try runtime .env files (for production)
    let runtime = Self::load_runtime_env_files();
    for (key, value) in runtime {
      env_vars.entry(key).or_insert(value);
    }

    env_vars
  }

  /// Load .env embedded at compile time (TaskFlow approach)
  fn load_embedded_env() -> HashMap<String, String> {
    let mut result = HashMap::new();

    // Try to include .env from the source directory (compile time)
    // This makes the .env file part of the binary
    let embedded_content = include_str!("../../.env");
    if !embedded_content.trim().is_empty() {
      eprintln!("[Config] Loaded embedded .env (compile-time)");
      result = Self::parse_dotenv(embedded_content);
    }

    result
  }

  /// Load .env from runtime file paths (for production builds)
  fn load_runtime_env_files() -> HashMap<String, String> {
    let mut result = HashMap::new();
    let paths = Self::collect_env_paths();

    for path in paths {
      if let Ok(content) = std::fs::read_to_string(&path) {
        eprintln!("[Config] Loaded .env from {:?}", path);
        let parsed = Self::parse_dotenv(&content);
        // Only insert keys that don't already exist (first found wins)
        for (key, value) in parsed {
          result.entry(key).or_insert(value);
        }
        break; // Use first found file
      }
    }

    result
  }

  /// Collect possible .env file locations
  fn collect_env_paths() -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();

    // 1. Next to executable
    if let Ok(exe_path) = std::env::current_exe() {
      if let Some(exe_dir) = exe_path.parent() {
        paths.push(exe_dir.join(".env"));
      }
    }

    // 2. Current working directory
    if let Ok(cwd) = std::env::current_dir() {
      paths.push(cwd.join(".env"));
    }

    // 3. Home directory with custom name
    if let Ok(home) = std::env::var("HOME") {
      paths.push(std::path::Path::new(&home).join(".unichat.env"));
    }

    // 4. Windows AppData
    #[cfg(target_os = "windows")]
    if let Ok(app_data) = std::env::var("APPDATA") {
      paths.push(std::path::Path::new(&app_data).join("UniChat").join(".env"));
    }

    // 5. Tauri resource directory (if available at runtime)
    // Note: This requires tauri::Manager which isn't available in helper
    // Can be loaded separately in lib.rs setup

    paths
  }

  /// Parse .env file content
  pub fn parse_dotenv(content: &str) -> HashMap<String, String> {
    content
      .lines()
      .filter_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
          return None;
        }

        let mut parts = trimmed.splitn(2, '=');
        let key = parts.next()?.trim().to_string();
        let raw_value = parts.next()?.trim();
        let value = raw_value.trim_matches('"').trim_matches('\'').to_string();
        Some((key, value))
      })
      .collect()
  }
}

/// Type alias for shared config
pub type SharedConfig = Arc<AppConfig>;
