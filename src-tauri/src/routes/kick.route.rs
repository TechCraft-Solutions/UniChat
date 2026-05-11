use log;
use serde::Deserialize;
use serde::Serialize;

use crate::helpers::http_client::shared_client;
use crate::utils::validation::{validate_channel_slug, validate_message_id, validate_oauth_token};

#[derive(Debug, Deserialize)]
pub struct KickChannelResponse {
  pub id: Option<i64>,
  pub chatroom: Option<KickChatroom>,
  #[serde(rename = "user")]
  pub user: Option<KickUser>,
}

#[derive(Debug, Deserialize)]
pub struct KickChatroom {
  pub id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct KickUser {
  pub id: Option<i64>,
  pub username: Option<String>,
  pub bio: Option<String>,
  #[serde(rename = "profile_pic")]
  pub profile_pic: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct KickChannelInfo {
  pub chatroomId: i64,
  pub broadcasterUserId: i64,
}

#[tauri::command]
pub async fn kickFetchChatroomId(
  channelSlug: String,
  accessToken: Option<String>,
) -> Result<KickChannelInfo, String> {
  log::info!("Fetching chatroom ID for channel: {}", channelSlug);
  validate_channel_slug(&channelSlug).map_err(|e| {
    log::error!("Invalid channel slug '{}': {}", channelSlug, e);
    format!("Invalid channel slug: {}", e)
  })?;

  if let Some(ref token) = accessToken {
    validate_oauth_token(token).map_err(|e| {
      log::error!("Invalid access token: {}", e);
      format!("Invalid access token: {}", e)
    })?;
  }

  let client = shared_client();

  let url = format!("https://kick.com/api/v2/channels/{}", channelSlug);

  let mut request = client
    .get(&url)
    .header("Accept", "application/json, text/plain, */*")
    .header("Referer", "https://kick.com/")
    .header("User-Agent", "UniChat/1.0 (https://github.com/uni-chat)");

  if let Some(token) = &accessToken {
    request = request.header("Authorization", format!("Bearer {}", token));
  }

  let response = request.send().await.map_err(|e| {
    log::error!(
      "Network error fetching chatroom ID for '{}': {}",
      channelSlug,
      e
    );
    format!("Network error: {}", e)
  })?;

  let status = response.status();

  if status == 404 {
    log::warn!("Channel '{}' not found on Kick", channelSlug);
    return Err(format!("Channel '{}' not found on Kick", channelSlug));
  } else if status == 429 {
    log::warn!("Rate limit exceeded for channel '{}'", channelSlug);
    return Err("Rate limit exceeded. Please try again later.".to_string());
  } else if status == 401 || status == 403 {
    log::error!("Auth failed for channel '{}': {}", channelSlug, status);
    return Err(format!(
      "Kick API returned {}. Authentication may be required.",
      status
    ));
  } else if !status.is_success() {
    log::error!("Kick API error for channel '{}': {}", channelSlug, status);
    return Err(format!("Kick API error: {}", status));
  }

  let data = response.json::<KickChannelResponse>().await.map_err(|e| {
    log::error!("JSON parse error for channel '{}': {}", channelSlug, e);
    format!("Failed to parse response: {}", e)
  })?;

  let chatroom_id = data
    .chatroom
    .and_then(|c| c.id)
    .or(data.id)
    .ok_or_else(|| {
      log::error!(
        "Chatroom ID not found in response for channel '{}'",
        channelSlug
      );
      "Chatroom ID not found in response".to_string()
    })?;

  let broadcaster_user_id = data.user.and_then(|u| u.id).ok_or_else(|| {
    log::error!(
      "User ID not found in response for channel '{}'",
      channelSlug
    );
    "User ID not found in response".to_string()
  })?;

  log::info!(
    "Successfully fetched chatroom ID for channel: {}",
    channelSlug
  );
  Ok(KickChannelInfo {
    chatroomId: chatroom_id,
    broadcasterUserId: broadcaster_user_id,
  })
}

#[tauri::command]
pub async fn kickFetchUserInfo(username: String) -> Result<KickUserInfo, String> {
  let client = shared_client();

  let url = format!("https://kick.com/api/v2/channels/{}", username);

  let response = client
    .get(&url)
    .header("Accept", "application/json, text/plain, */*")
    .header("Referer", "https://kick.com/")
    .send()
    .await
    .map_err(|e| e.to_string())?;

  let status = response.status();

  if status == 404 {
    return Err("User not found".to_string());
  } else if !status.is_success() {
    return Err(format!("Kick API error: {}", status));
  }

  let data = response
    .json::<KickChannelResponse>()
    .await
    .map_err(|e| e.to_string())?;

  let user = data
    .user
    .ok_or_else(|| "User data not found in response".to_string())?;

  Ok(KickUserInfo {
    id: user.id.unwrap_or(0).to_string(),
    username: user.username.unwrap_or_else(|| username.clone()),
    bio: user.bio.unwrap_or_default(),
    profile_pic_url: user.profile_pic.unwrap_or_default(),
  })
}

#[tauri::command]
pub async fn kickFetchRecentMessages(
  channelSlug: String,
  chatroomId: i64,
) -> Result<String, String> {
  log::info!(
    "Fetching recent messages for chatroom: {} (channel: {})",
    chatroomId,
    channelSlug
  );
  let client = shared_client();

  let url = format!(
    "https://api.kick.com/public/v1/chatrooms/{}/messages",
    chatroomId
  );

  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .send()
    .await;

  if let Ok(response) = response {
    if response.status().is_success() {
      if let Ok(body) = response.text().await {
        if !body.trim().is_empty() {
          log::debug!(
            "Fetched messages from primary endpoint for chatroom {}",
            chatroomId
          );
          return Ok(body);
        }
      }
    }
  }

  let urls = [
    format!("https://kick.com/api/v2/chatrooms/{}/messages", chatroomId),
    format!("https://kick.com/api/v1/chatrooms/{}/messages", chatroomId),
    format!("https://kick.com/api/v2/channels/{}/messages", channelSlug),
  ];

  for url in urls {
    let response = client
      .get(&url)
      .header("Accept", "application/json, text/plain, */*")
      .header("Referer", format!("https://kick.com/{}", channelSlug))
      .send()
      .await;

    let Ok(response) = response else {
      continue;
    };

    if !response.status().is_success() {
      continue;
    }

    let body = response
      .text()
      .await
      .map_err(|e| format!("Failed to read response: {}", e))?;

    if !body.trim().is_empty() {
      log::debug!(
        "Fetched messages from fallback endpoint for chatroom {}",
        chatroomId
      );
      return Ok(body);
    }
  }

  log::debug!(
    "No messages found for chatroom {}, returning empty array",
    chatroomId
  );
  Ok("[]".to_string())
}

#[derive(Debug, Serialize)]
struct KickSendMessageRequest {
  broadcaster_user_id: i64,
  content: String,
  #[serde(rename = "type")]
  message_type: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  reply_to_message_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KickSendMessageResponse {
  data: KickSendMessageData,
  #[allow(dead_code)]
  message: String,
}

#[derive(Debug, Deserialize)]
struct KickSendMessageData {
  is_sent: bool,
  message_id: String,
}

#[tauri::command]
pub async fn kickSendChatMessage(
  _chatroom_id: i64,
  content: String,
  access_token: String,
  broadcaster_user_id: i64,
  reply_to_message_id: Option<String>,
) -> Result<KickSendMessageResponseData, String> {
  log::info!(
    "Sending chat message for broadcaster: {}, content length: {}",
    broadcaster_user_id,
    content.len()
  );
  let client = shared_client();

  let request_body = KickSendMessageRequest {
    broadcaster_user_id,
    content,
    message_type: "user".to_string(),
    reply_to_message_id,
  };

  let response = client
    .post("https://api.kick.com/public/v1/chat")
    .bearer_auth(&access_token)
    .json(&request_body)
    .send()
    .await
    .map_err(|e| {
      log::error!("Network error sending chat message: {}", e);
      format!("Network error: {}", e)
    })?;

  let status = response.status();

  if status == 429 {
    log::warn!(
      "Rate limit exceeded when sending message for broadcaster: {}",
      broadcaster_user_id
    );
    return Err("Rate limit exceeded. Please wait before sending more messages.".to_string());
  }

  if !status.is_success() {
    let error_text = response.text().await.unwrap_or_default();
    log::error!(
      "Kick API error sending message ({}): {}",
      status,
      error_text
    );
    return Err(format!("Kick API error ({}): {}", status, error_text));
  }

  let data = response
    .json::<KickSendMessageResponse>()
    .await
    .map_err(|e| {
      log::error!("JSON parse error for send message response: {}", e);
      format!("Failed to parse response: {}", e)
    })?;

  log::info!(
    "Message sent successfully for broadcaster: {}, message_id: {}",
    broadcaster_user_id,
    data.data.message_id
  );
  Ok(KickSendMessageResponseData {
    is_sent: data.data.is_sent,
    message_id: data.data.message_id,
  })
}

#[derive(Debug, Clone, Serialize)]
pub struct KickSendMessageResponseData {
  pub is_sent: bool,
  pub message_id: String,
}

#[tauri::command]
pub async fn kickDeleteChatMessage(
  message_id: String,
  access_token: String,
) -> Result<KickDeleteMessageResponseData, String> {
  log::info!("Deleting chat message: {}", message_id);
  validate_message_id(&message_id).map_err(|e| {
    log::error!("Invalid message ID '{}': {}", message_id, e);
    format!("Invalid message ID: {}", e)
  })?;
  validate_oauth_token(&access_token).map_err(|e| {
    log::error!("Invalid access token for message deletion: {}", e);
    format!("Invalid access token: {}", e)
  })?;

  let client = shared_client();

  let response = client
    .delete(format!("https://api.kick.com/public/v1/chat/{message_id}"))
    .bearer_auth(&access_token)
    .send()
    .await
    .map_err(|e| {
      log::error!("Network error deleting message {}: {}", message_id, e);
      format!("Network error: {e}")
    })?;

  let status = response.status();

  if status == 429 {
    log::warn!("Rate limit exceeded when deleting message: {}", message_id);
    return Err("Rate limit exceeded. Please try again later.".to_string());
  }

  if !status.is_success() {
    let error_text = response.text().await.unwrap_or_default();
    log::error!(
      "Kick API error deleting message {} ({}): {}",
      message_id,
      status,
      error_text
    );
    return Err(format!("Kick API error {}: {}", status, error_text));
  }

  log::info!("Message deleted successfully: {}", message_id);
  Ok(KickDeleteMessageResponseData {
    is_deleted: true,
    message_id,
  })
}

#[derive(Debug, Clone, Serialize)]
pub struct KickDeleteMessageResponseData {
  pub is_deleted: bool,
  pub message_id: String,
}

#[derive(Debug, Deserialize)]
struct KickEmoteResponse {
  data: Option<Vec<KickEmoteData>>,
}

#[derive(Debug, Deserialize, Clone)]
struct KickEmoteData {
  id: Option<i64>,
  name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KickEmoteArrayResponse {
  id: Option<i64>,
  name: Option<String>,
  #[allow(dead_code)]
  channel_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct KickEmoteInfo {
  pub id: i64,
  pub name: String,
}

#[tauri::command]
pub async fn kickFetchChannelEmotes(channelSlug: String) -> Result<Vec<KickEmoteInfo>, String> {
  log::info!("Fetching channel emotes for: {}", channelSlug);
  let client = shared_client();

  let urls = [
    format!("https://kick.com/api/v2/channels/{}/emotes", channelSlug),
    format!("https://kick.com/api/v1/channels/{}/emotes", channelSlug),
  ];

  for url in urls {
    let response = client
      .get(&url)
      .header("Accept", "application/json")
      .header("User-Agent", "UniChat/1.0 (https://github.com/uni-chat)")
      .send()
      .await;

    if let Ok(response) = response {
      if response.status().is_success() {
        let text = response.text().await.unwrap_or_default();

        if let Ok(emotes_data) = serde_json::from_str::<Vec<KickEmoteArrayResponse>>(&text) {
          let emotes: Vec<KickEmoteInfo> = emotes_data
            .into_iter()
            .filter_map(|e| {
              e.id
                .and_then(|id| e.name.map(|name| KickEmoteInfo { id, name }))
            })
            .collect();

          if !emotes.is_empty() {
            log::debug!(
              "Fetched {} emotes for channel: {}",
              emotes.len(),
              channelSlug
            );
            return Ok(emotes);
          }
        }

        if let Ok(data_response) = serde_json::from_str::<KickEmoteResponse>(&text) {
          let emotes: Vec<KickEmoteInfo> = data_response
            .data
            .unwrap_or_default()
            .into_iter()
            .filter_map(|e| {
              e.id
                .and_then(|id| e.name.map(|name| KickEmoteInfo { id, name }))
            })
            .collect();

          if !emotes.is_empty() {
            log::debug!(
              "Fetched {} emotes for channel: {}",
              emotes.len(),
              channelSlug
            );
            return Ok(emotes);
          }
        }

        return Ok(vec![]);
      }
    }
  }

  log::debug!("No emotes found for channel: {}", channelSlug);
  Ok(vec![])
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct KickUserInfo {
  pub id: String,
  pub username: String,
  pub bio: String,
  pub profile_pic_url: String,
}

#[derive(Debug, serde::Serialize)]
pub struct KickChannelInfoWithImage {
  pub id: i64,
  pub user_id: i64,
  pub username: String,
  pub profile_pic_url: Option<String>,
}

#[tauri::command]
pub async fn kickFetchChannelInfo(channelSlug: String) -> Result<KickChannelInfoWithImage, String> {
  log::info!("Fetching channel info for: {}", channelSlug);
  let client = shared_client();

  let url = format!("https://kick.com/api/v1/channels/{}", channelSlug);

  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| {
      log::error!(
        "Network error fetching channel info for '{}': {}",
        channelSlug,
        e
      );
      format!("Network error: {}", e)
    })?;

  let status = response.status();

  if status == 404 {
    log::warn!("Channel '{}' not found on Kick", channelSlug);
    return Err(format!("Channel '{}' not found on Kick", channelSlug));
  } else if !status.is_success() {
    log::error!(
      "Kick API error fetching channel info for '{}': {}",
      channelSlug,
      status
    );
    return Err(format!("Kick API error: {}", status));
  }

  let data = response.json::<KickChannelResponse>().await.map_err(|e| {
    log::error!("JSON parse error for channel info '{}': {}", channelSlug, e);
    format!("Failed to parse response: {}", e)
  })?;

  let user = data.user.ok_or_else(|| {
    log::error!(
      "User data not found in response for channel '{}'",
      channelSlug
    );
    "User info not found in response"
  })?;
  let user_id = user.id.ok_or_else(|| {
    log::error!("User ID not found for channel '{}'", channelSlug);
    "User ID not found"
  })?;
  let username = user.username.unwrap_or_else(|| channelSlug.clone());
  let profile_pic_url = user.profile_pic;

  let channel_id = data
    .chatroom
    .and_then(|c| c.id)
    .or(data.id)
    .ok_or_else(|| {
      log::error!("Channel ID not found in response for '{}'", channelSlug);
      "Channel ID not found in response"
    })?;

  log::info!("Successfully fetched channel info for: {}", channelSlug);
  Ok(KickChannelInfoWithImage {
    id: channel_id,
    user_id,
    username,
    profile_pic_url,
  })
}
