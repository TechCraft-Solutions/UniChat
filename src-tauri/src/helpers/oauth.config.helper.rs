use crate::helpers::config_helper::AppConfig;
use crate::models::platform_type_model::PlatformTypeModel;

#[derive(Clone)]
pub struct OAuthProviderConfig {
  pub client_id: String,
  pub client_secret: Option<String>,
  pub authorize_url: String,
  pub token_url: String,
  pub userinfo_url: String,
  pub revoke_url: Option<String>,
  pub scopes: Vec<String>,
  pub redirect_uri: String,
}

pub fn get_oauth_provider_config(
  platform: &PlatformTypeModel,
  config: &AppConfig,
) -> Result<OAuthProviderConfig, String> {
  eprintln!("[OAuth] Getting config for {:?}", platform);
  match platform {
    PlatformTypeModel::Twitch => {
      eprintln!("[OAuth] Loading Twitch config...");
      let client_id = config
        .twitch_client_id
        .clone()
        .ok_or_else(|| {
          eprintln!("[OAuth] Twitch OAuth not configured: TWITCH_CLIENT_ID not set");
          "Twitch OAuth not configured. Please set TWITCH_CLIENT_ID in your .env file or environment variables.".to_string()
        })?;
      eprintln!(
        "[OAuth] Twitch client_id loaded (length: {})",
        client_id.len()
      );
      let client_secret = config.twitch_client_secret.clone();
      if client_secret.is_some() {
        eprintln!("[OAuth] Twitch client_secret loaded");
      } else {
        eprintln!("[OAuth] Twitch client_secret not set (optional)");
      }

      Ok(OAuthProviderConfig {
        client_id,
        client_secret,
        authorize_url: "https://id.twitch.tv/oauth2/authorize".to_string(),
        token_url: "https://id.twitch.tv/oauth2/token".to_string(),
        userinfo_url: "https://api.twitch.tv/helix/users".to_string(),
        revoke_url: Some("https://id.twitch.tv/oauth2/revoke".to_string()),
        scopes: vec![
          "chat:read".to_string(),
          "chat:edit".to_string(),
          "moderator:manage:banned_users".to_string(),
        ],
        redirect_uri: config.oauth_redirect_uri.clone(),
      })
    }
    PlatformTypeModel::Kick => {
      eprintln!("[OAuth] Loading Kick config...");
      let client_id = config
        .kick_client_id
        .clone()
        .ok_or_else(|| {
          eprintln!("[OAuth] Kick OAuth not configured: KICK_CLIENT_ID not set");
          "Kick OAuth not configured. Please set KICK_CLIENT_ID in your .env file or environment variables.".to_string()
        })?;
      eprintln!(
        "[OAuth] Kick client_id loaded (length: {})",
        client_id.len()
      );
      let client_secret = config.kick_client_secret.clone();
      if client_secret.is_some() {
        eprintln!("[OAuth] Kick client_secret loaded");
      }

      Ok(OAuthProviderConfig {
        client_id,
        client_secret,
        authorize_url: config
          .kick_client_id
          .as_ref()
          .map(|_| "https://id.kick.com/oauth/authorize".to_string())
          .unwrap_or_else(|| "https://id.kick.com/oauth/authorize".to_string()),
        token_url: "https://id.kick.com/oauth/token".to_string(),
        userinfo_url: "https://api.kick.com/public/v1/users".to_string(),
        revoke_url: Some("https://id.kick.com/oauth/revoke".to_string()),
        scopes: vec![
          "user:read".to_string(),
          "chat:read".to_string(),
          "chat:write".to_string(),
          "moderation:chat_message:manage".to_string(),
        ],
        redirect_uri: config.oauth_redirect_uri.clone(),
      })
    }
    PlatformTypeModel::Youtube => {
      eprintln!("[OAuth] Loading YouTube config...");
      let client_id = config
        .youtube_client_id
        .clone()
        .ok_or_else(|| {
          eprintln!("[OAuth] YouTube OAuth not configured: YOUTUBE_CLIENT_ID not set");
          "YouTube OAuth not configured. Please set YOUTUBE_CLIENT_ID in your .env file or environment variables.".to_string()
        })?;
      eprintln!(
        "[OAuth] YouTube client_id loaded (length: {})",
        client_id.len()
      );
      let client_secret = config.youtube_client_secret.clone();
      if client_secret.is_some() {
        eprintln!("[OAuth] YouTube client_secret loaded");
      }

      Ok(OAuthProviderConfig {
        client_id,
        client_secret,
        authorize_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
        token_url: "https://oauth2.googleapis.com/token".to_string(),
        userinfo_url: "https://www.googleapis.com/oauth2/v2/userinfo".to_string(),
        revoke_url: Some("https://oauth2.googleapis.com/revoke".to_string()),
        scopes: vec![
          "https://www.googleapis.com/auth/youtube.readonly".to_string(),
          "https://www.googleapis.com/auth/youtube.force-ssl".to_string(),
        ],
        redirect_uri: config.oauth_redirect_uri.clone(),
      })
    }
  }
}
