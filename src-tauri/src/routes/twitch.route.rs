use log;

use crate::helpers::http_client::shared_client;
use crate::helpers::oauth_config_helper::get_oauth_provider_config;
use crate::models::platform_type_model::PlatformTypeModel;
use crate::AppState;

/// Delete a message from Twitch chat
/// Requires moderator or broadcaster OAuth token
#[tauri::command]
pub async fn twitchDeleteMessage(
  state: tauri::State<'_, AppState>,
  _channel_id: String,
  message_id: String,
  access_token: String,
) -> Result<bool, String> {
  log::info!("Deleting Twitch message: {}", message_id);
  let client = shared_client();
  let config =
    get_oauth_provider_config(&PlatformTypeModel::Twitch, &state.config).map_err(|e| {
      log::error!("OAuth config error for Twitch: {}", e);
      format!("OAuth config error: {}", e)
    })?;

  // Get user ID from token (we need it for the API call)
  // First, validate the token and get user info
  let user_info_response = client
    .get("https://api.twitch.tv/helix/users")
    .header("Client-Id", &config.client_id)
    .header("Authorization", format!("Bearer {}", access_token))
    .send()
    .await
    .map_err(|e| {
      log::error!("Network error validating token: {}", e);
      format!("Failed to get user info: {}", e)
    })?;

  if !user_info_response.status().is_success() {
    log::error!(
      "Token validation failed with status: {}",
      user_info_response.status()
    );
    return Err(format!(
      "Token validation failed: {}",
      user_info_response.status()
    ));
  }

  let user_info: serde_json::Value = user_info_response.json().await.map_err(|e| {
    log::error!("JSON parse error for user info: {}", e);
    format!("Failed to parse user info: {}", e)
  })?;

  let user_id = user_info["data"]
    .as_array()
    .and_then(|arr| arr.first())
    .and_then(|user| user["id"].as_str())
    .ok_or_else(|| {
      log::error!("Failed to get user ID from token response");
      "Failed to get user ID from token".to_string()
    })?;

  // Delete the message
  let url = format!(
    "https://api.twitch.tv/helix/moderation/chat?broadcaster_id={}&message_id={}",
    user_id, message_id
  );

  let response = client
    .delete(&url)
    .header("Client-Id", &config.client_id)
    .header("Authorization", format!("Bearer {}", access_token))
    .send()
    .await
    .map_err(|e| {
      log::error!("Network error deleting message: {}", e);
      format!("Delete request failed: {}", e)
    })?;

  let status = response.status();

  if status.is_success() {
    log::info!("Successfully deleted Twitch message: {}", message_id);
    Ok(true)
  } else if status == 404 {
    // Message already deleted or not found - treat as success
    log::debug!("Message {} not found, treating as success", message_id);
    Ok(true)
  } else if status == 403 {
    log::warn!(
      "Missing permissions to delete message {} in channel {}",
      message_id,
      _channel_id
    );
    Err(
      "Missing permissions: You must be a moderator or broadcaster to delete messages".to_string(),
    )
  } else {
    let error_text = response.text().await.unwrap_or_default();
    log::error!(
      "Delete failed for message {} ({}): {}",
      message_id,
      status,
      error_text
    );
    Err(format!("Delete failed ({}): {}", status, error_text))
  }
}
