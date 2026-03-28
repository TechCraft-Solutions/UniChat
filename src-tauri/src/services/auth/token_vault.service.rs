use keyring::Entry;
use serde::{Deserialize, Serialize};

use crate::models::auth_account_model::AuthAccountModel;
use crate::models::auth_oauth_model::OAuthTokenModel;
use crate::models::provider_contract_model::PlatformTypeModel;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountVaultRecord {
  account: AuthAccountModel,
  token: OAuthTokenModel,
}

pub struct TokenVaultService {
  service_name: String,
}

impl TokenVaultService {
  pub fn new() -> Self {
    Self {
      service_name: "unichat".to_string(),
    }
  }

  pub fn saveToken(
    &self,
    account: &AuthAccountModel,
    token: &OAuthTokenModel,
  ) -> Result<(), String> {
    let entry = Entry::new(&self.service_name, &self.account_key(account))
      .map_err(|e| format!("keyring init failed: {e}"))?;
    let serialized = serde_json::to_string(&AccountVaultRecord {
      account: account.clone(),
      token: token.clone(),
    })
    .map_err(|e| format!("token serialize failed: {e}"))?;
    entry
      .set_password(&serialized)
      .map_err(|e| format!("token save failed: {e}"))
  }

  pub fn readToken(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<Option<OAuthTokenModel>, String> {
    let entry = Entry::new(
      &self.service_name,
      &format!("oauth-{}-{}", platform.asKey(), account_id),
    )
    .map_err(|e| format!("keyring init failed: {e}"))?;

    match entry.get_password() {
      Ok(raw) => {
        let record = serde_json::from_str::<AccountVaultRecord>(&raw)
          .map_err(|e| format!("token parse failed: {e}"))?;
        Ok(Some(record.token))
      }
      Err(keyring::Error::NoEntry) => Ok(None),
      Err(e) => Err(format!("token read failed: {e}")),
    }
  }

  pub fn deleteToken(&self, platform: &PlatformTypeModel, account_id: &str) -> Result<(), String> {
    let entry = Entry::new(
      &self.service_name,
      &format!("oauth-{}-{}", platform.asKey(), account_id),
    )
    .map_err(|e| format!("keyring init failed: {e}"))?;
    match entry.delete_credential() {
      Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
      Err(e) => Err(format!("token delete failed: {e}")),
    }
  }

  pub fn readAccounts(
    &self,
    platform: &PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    let account_ids = self.read_account_index(platform)?;
    let mut accounts = Vec::new();

    for account_id in account_ids {
      let entry = Entry::new(
        &self.service_name,
        &format!("oauth-{}-{}", platform.asKey(), account_id),
      )
      .map_err(|e| format!("keyring init failed: {e}"))?;
      match entry.get_password() {
        Ok(raw) => {
          let record = serde_json::from_str::<AccountVaultRecord>(&raw)
            .map_err(|e| format!("token parse failed: {e}"))?;
          accounts.push(record.account);
        }
        Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(format!("token read failed: {e}")),
      }
    }

    Ok(accounts)
  }

  pub fn upsertAccount(&self, account: &AuthAccountModel) -> Result<(), String> {
    let mut account_ids = self.read_account_index(&account.platform)?;
    if !account_ids.iter().any(|id| id == &account.id) {
      account_ids.push(account.id.clone());
      self.write_account_index(&account.platform, &account_ids)?;
    }
    Ok(())
  }

  pub fn removeAccount(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<(), String> {
    let mut account_ids = self.read_account_index(platform)?;
    account_ids.retain(|id| id != account_id);
    self.write_account_index(platform, &account_ids)
  }

  fn account_key(&self, account: &AuthAccountModel) -> String {
    format!("oauth-{}-{}", account.platform.asKey(), account.id)
  }

  fn index_key(&self, platform: &PlatformTypeModel) -> String {
    format!("oauth-{}-index", platform.asKey())
  }

  fn read_account_index(&self, platform: &PlatformTypeModel) -> Result<Vec<String>, String> {
    let entry = Entry::new(&self.service_name, &self.index_key(platform))
      .map_err(|e| format!("keyring init failed: {e}"))?;

    match entry.get_password() {
      Ok(raw) => serde_json::from_str::<Vec<String>>(&raw)
        .map_err(|e| format!("token index parse failed: {e}")),
      Err(keyring::Error::NoEntry) => Ok(Vec::new()),
      Err(e) => Err(format!("token index read failed: {e}")),
    }
  }

  fn write_account_index(
    &self,
    platform: &PlatformTypeModel,
    account_ids: &[String],
  ) -> Result<(), String> {
    let entry = Entry::new(&self.service_name, &self.index_key(platform))
      .map_err(|e| format!("keyring init failed: {e}"))?;
    let serialized = serde_json::to_string(account_ids)
      .map_err(|e| format!("token index serialize failed: {e}"))?;
    entry
      .set_password(&serialized)
      .map_err(|e| format!("token index save failed: {e}"))
  }
}

trait PlatformKey {
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
