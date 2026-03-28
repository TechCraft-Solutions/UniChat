use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PlatformTypeModel {
  Twitch,
  Kick,
  Youtube,
}

/// PlatformKey trait for converting PlatformTypeModel to string key
/// Consolidated from multiple duplicate definitions (March 2026 refactoring)
pub trait PlatformKey {
  fn asKey(&self) -> &'static str;
}

impl PlatformKey for PlatformTypeModel {
  fn asKey(&self) -> &'static str {
    match self {
      PlatformTypeModel::Twitch => "twitch",
      PlatformTypeModel::Kick => "kick",
      PlatformTypeModel::Youtube => "youtube",
    }
  }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionModeModel {
  Account,
  ChannelWatch,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageReferenceModel {
  pub source_message_id: String,
  pub source_channel_id: String,
  pub source_user_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCapabilitiesModel {
  pub can_listen: bool,
  pub can_reply: bool,
  pub can_delete: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCommandResultModel {
  pub platform: PlatformTypeModel,
  pub connection_mode: Option<ConnectionModeModel>,
  pub summary: String,
  pub capabilities: ProviderCapabilitiesModel,
}
