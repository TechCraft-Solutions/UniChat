use crate::helpers::auth_twitch_helper::{twitch_app_access_token, twitch_client_credentials};

/// Global chat badges via Helix (`api.twitch.tv`). Replaces legacy `badges.twitch.tv` which may not
/// resolve on some networks.
#[tauri::command]
pub async fn twitchFetchGlobalBadges() -> Result<String, String> {
  let (client_id, client_secret) = twitch_client_credentials()?;
  let token = twitch_app_access_token(&client_id, client_secret.as_deref()).await?;
  let client = reqwest::Client::new();
  let response = client
    .get("https://api.twitch.tv/helix/chat/badges/global")
    .header("Client-Id", &client_id)
    .header("Authorization", format!("Bearer {token}"))
    .send()
    .await
    .map_err(|e| format!("request failed: {e}"))?;

  if !response.status().is_success() {
    return Err(format!("Twitch global badges HTTP {}", response.status()));
  }

  response
    .text()
    .await
    .map_err(|e| format!("response parse failed: {e}"))
}

/// Channel-specific chat badges (subscriber, etc.). `broadcaster_id` is the Twitch IRC `room-id`.
#[tauri::command]
pub async fn twitchFetchChannelBadges(broadcasterId: String) -> Result<String, String> {
  if broadcasterId.trim().is_empty() {
    return Err("broadcasterId required".to_string());
  }
  let (client_id, client_secret) = twitch_client_credentials()?;
  let token = twitch_app_access_token(&client_id, client_secret.as_deref()).await?;
  let client = reqwest::Client::new();
  let response = client
    .get("https://api.twitch.tv/helix/chat/badges")
    .query(&[("broadcaster_id", broadcasterId.as_str())])
    .header("Client-Id", &client_id)
    .header("Authorization", format!("Bearer {token}"))
    .send()
    .await
    .map_err(|e| e.to_string())?;

  if !response.status().is_success() {
    return Err(format!("Twitch channel badges HTTP {}", response.status()));
  }

  response.text().await.map_err(|e| e.to_string())
}
