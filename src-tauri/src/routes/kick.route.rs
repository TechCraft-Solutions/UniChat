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

/// Response structure for kickFetchChatroomId that includes both chatroom and user info
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
  // Validate channel slug to prevent injection attacks
  validate_channel_slug(&channelSlug).map_err(|e| format!("Invalid channel slug: {}", e))?;

  // Validate access token if provided
  if let Some(ref token) = accessToken {
    validate_oauth_token(token).map_err(|e| format!("Invalid access token: {}", e))?;
  }

  let client = shared_client();

  let url = format!("https://kick.com/api/v2/channels/{}", channelSlug);

  let mut request = client
    .get(&url)
    .header("Accept", "application/json, text/plain, */*")
    .header("Referer", "https://kick.com/")
    .header("User-Agent", "UniChat/1.0 (https://github.com/uni-chat)");

  // Add OAuth token if available for authenticated requests
  if let Some(token) = &accessToken {
    request = request.header("Authorization", format!("Bearer {}", token));
  }

  let response = request
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  let status = response.status();

  if status == 404 {
    return Err(format!("Channel '{}' not found on Kick", channelSlug));
  } else if status == 429 {
    return Err("Rate limit exceeded. Please try again later.".to_string());
  } else if status == 401 || status == 403 {
    return Err(format!(
      "Kick API returned {}. Authentication may be required.",
      status
    ));
  } else if !status.is_success() {
    return Err(format!("Kick API error: {}", status));
  }

  let data = response
    .json::<KickChannelResponse>()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  // Try to get chatroom ID from the response
  let chatroom_id = data
    .chatroom
    .and_then(|c| c.id)
    .or(data.id)
    .ok_or("Chatroom ID not found in response".to_string())?;

  // Get the channel owner's user ID (broadcaster_user_id)
  let broadcaster_user_id = data
    .user
    .and_then(|u| u.id)
    .ok_or("User ID not found in response".to_string())?;

  println!(
    "[Kick API] Fetched channel info: chatroomId={}, broadcasterUserId={}",
    chatroom_id, broadcaster_user_id
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
  let client = shared_client();

  // Try official Kick API first
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
          return Ok(body);
        }
      }
    }
  }

  // Fallback to unofficial endpoints
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

    if let Ok(body) = response.text().await {
      if !body.trim().is_empty() {
        return Ok(body);
      }
    }
  }

  Ok("[]".to_string())
}

/// Request payload for sending a chat message via Kick's official API
#[derive(Debug, Serialize)]
struct KickSendMessageRequest {
  broadcaster_user_id: i64,
  content: String,
  #[serde(rename = "type")]
  message_type: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  reply_to_message_id: Option<String>,
}

/// Response from Kick's official chat message API
#[derive(Debug, Deserialize)]
struct KickSendMessageResponse {
  data: KickSendMessageData,
  message: String,
}

#[derive(Debug, Deserialize)]
struct KickSendMessageData {
  is_sent: bool,
  message_id: String,
}

/// Send a chat message using Kick's official API
/// Requires OAuth token with chat:write scope
/// Note: broadcaster_user_id is the channel owner's user ID (not the chatroom ID)
#[tauri::command]
pub async fn kickSendChatMessage(
  chatroom_id: i64,
  content: String,
  access_token: String,
  broadcaster_user_id: i64,
  reply_to_message_id: Option<String>,
) -> Result<KickSendMessageResponseData, String> {
  let client = shared_client();

  let request_body = KickSendMessageRequest {
    broadcaster_user_id,
    content,
    message_type: "user".to_string(),
    reply_to_message_id,
  };

  println!(
    "[Kick API] Sending message to chatroom {} with broadcaster_user_id {}",
    chatroom_id, broadcaster_user_id
  );

  let response = client
    .post("https://api.kick.com/public/v1/chat")
    .bearer_auth(&access_token)
    .json(&request_body)
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  let status = response.status();

  // Handle rate limiting
  if status == 429 {
    return Err("Rate limit exceeded. Please try again later.".to_string());
  }

  if !status.is_success() {
    let error_text = response.text().await.unwrap_or_default();
    println!(
      "[Kick API] Send failed with status {}: {}",
      status, error_text
    );
    return Err(format!("Kick API error {}: {}", status, error_text));
  }

  let data = response
    .json::<KickSendMessageResponse>()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  println!(
    "[Kick API] Message sent successfully! message_id={}",
    data.data.message_id
  );

  Ok(KickSendMessageResponseData {
    is_sent: data.data.is_sent,
    message_id: data.data.message_id,
  })
}

/// Response data for kickSendChatMessage command
#[derive(Debug, Clone, Serialize)]
pub struct KickSendMessageResponseData {
  pub is_sent: bool,
  pub message_id: String,
}

/// Delete a chat message using Kick's official API
/// Requires OAuth token with moderation:chat_message:manage scope
#[tauri::command]
pub async fn kickDeleteChatMessage(
  message_id: String,
  access_token: String,
) -> Result<KickDeleteMessageResponseData, String> {
  // Validate message ID to prevent injection attacks
  validate_message_id(&message_id).map_err(|e| format!("Invalid message ID: {}", e))?;

  // Validate access token
  validate_oauth_token(&access_token).map_err(|e| format!("Invalid access token: {}", e))?;

  let client = shared_client();

  let response = client
    .delete(&format!(
      "https://api.kick.com/public/v1/chat/{}",
      message_id
    ))
    .bearer_auth(&access_token)
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  let status = response.status();

  // Handle rate limiting
  if status == 429 {
    return Err("Rate limit exceeded. Please try again later.".to_string());
  }

  if !status.is_success() {
    let error_text = response.text().await.unwrap_or_default();
    return Err(format!("Kick API error {}: {}", status, error_text));
  }

  Ok(KickDeleteMessageResponseData {
    is_deleted: true,
    message_id,
  })
}

/// Response data for kickDeleteChatMessage command
#[derive(Debug, Clone, Serialize)]
pub struct KickDeleteMessageResponseData {
  pub is_deleted: bool,
  pub message_id: String,
}

/// Kick emote response structure
#[derive(Debug, Deserialize)]
struct KickEmoteResponse {
  data: Option<Vec<KickEmoteData>>,
}

#[derive(Debug, Deserialize, Clone)]
struct KickEmoteData {
  id: Option<i64>,
  name: Option<String>,
}

/// Alternative response structure - some Kick API endpoints return emotes directly
#[derive(Debug, Deserialize)]
struct KickEmoteArrayResponse {
  id: Option<i64>,
  name: Option<String>,
  channel_id: Option<i64>,
}

/// Public emote info returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct KickEmoteInfo {
  pub id: i64,
  pub name: String,
}

/// Fetch channel emotes from Kick API
/// Returns list of emotes available for the channel
#[tauri::command]
pub async fn kickFetchChannelEmotes(channelSlug: String) -> Result<Vec<KickEmoteInfo>, String> {
  let client = shared_client();

  // Try multiple Kick API endpoints for emotes
  let urls = [
    // Unofficial API that's commonly used
    format!("https://kick.com/api/v2/channels/{}/emotes", channelSlug),
    // Alternative endpoint
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
        // Get response text first, then try to parse
        let text = response.text().await.unwrap_or_default();

        // Try to parse as array of emotes directly
        if let Ok(emotes_data) = serde_json::from_str::<Vec<KickEmoteArrayResponse>>(&text) {
          let emotes: Vec<KickEmoteInfo> = emotes_data
            .into_iter()
            .filter_map(|e| {
              e.id
                .and_then(|id| e.name.map(|name| KickEmoteInfo { id, name }))
            })
            .collect();

          if !emotes.is_empty() {
            println!(
              "[Kick API] Fetched {} emotes for channel {} (array format)",
              emotes.len(),
              channelSlug
            );
            return Ok(emotes);
          }
        }

        // Try to parse as { data: [...] } structure
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
            println!(
              "[Kick API] Fetched {} emotes for channel {} (object format)",
              emotes.len(),
              channelSlug
            );
            return Ok(emotes);
          }
        }

        // If we got a successful response but couldn't parse emotes, return empty
        println!(
          "[Kick API] Got successful response but no emotes for {}",
          channelSlug
        );
        return Ok(vec![]);
      }
    }
  }

  // If all endpoints fail, return empty list (not an error)
  println!(
    "[Kick API] All emote endpoints failed for {}, returning empty",
    channelSlug
  );
  Ok(vec![])
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct KickUserInfo {
  pub id: String,
  pub username: String,
  pub bio: String,
  pub profile_pic_url: String,
}

/// Response structure for kickFetchChannelInfo
#[derive(Debug, serde::Serialize)]
pub struct KickChannelInfoWithImage {
  pub id: i64,
  pub user_id: i64,
  pub username: String,
  pub profile_pic_url: Option<String>,
}

/// Fetch channel info including profile image URL
#[tauri::command]
pub async fn kickFetchChannelInfo(channelSlug: String) -> Result<KickChannelInfoWithImage, String> {
  let client = shared_client();

  let url = format!("https://kick.com/api/v1/channels/{}", channelSlug);

  let response = client
    .get(&url)
    .header("Accept", "application/json")
    .send()
    .await
    .map_err(|e| format!("Network error: {}", e))?;

  let status = response.status();

  if status == 404 {
    return Err(format!("Channel '{}' not found on Kick", channelSlug));
  } else if !status.is_success() {
    return Err(format!("Kick API error: {}", status));
  }

  let data = response
    .json::<KickChannelResponse>()
    .await
    .map_err(|e| format!("Failed to parse response: {}", e))?;

  // Extract user info
  let user = data.user.ok_or("User info not found in response")?;
  let user_id = user.id.ok_or("User ID not found")?;
  let username = user.username.unwrap_or_else(|| channelSlug.clone());
  let profile_pic_url = user.profile_pic;

  // Get channel ID
  let channel_id = data
    .chatroom
    .and_then(|c| c.id)
    .or(data.id)
    .ok_or("Channel ID not found in response")?;

  println!(
    "[Kick API] Fetched channel info: id={}, user_id={}, username={}, profile_pic={}",
    channel_id,
    user_id,
    username,
    profile_pic_url.as_deref().unwrap_or("none")
  );

  Ok(KickChannelInfoWithImage {
    id: channel_id,
    user_id,
    username,
    profile_pic_url,
  })
}
