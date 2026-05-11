//! Account Service
//! Handles account management and authentication status validation

use reqwest::Client;

use log;

use crate::helpers::config_helper::SharedConfig;
use crate::helpers::oauth_config_helper::get_oauth_provider_config;
use crate::models::auth_account_model::{AuthAccountModel, AuthStatusModel};
use crate::models::platform_type_model::PlatformTypeModel;
use crate::services::auth::oauth_token_exchange::refresh_access_token;
use crate::services::auth::token_vault_service::TokenVaultService;

pub struct AccountService {
  http: Client,
  token_vault_service: TokenVaultService,
  config: SharedConfig,
}

impl Default for AccountService {
  fn default() -> Self {
    Self::new()
  }
}

impl AccountService {
  pub fn new() -> Self {
    Self {
      http: Client::new(),
      token_vault_service: TokenVaultService::new(),
      config: SharedConfig::default(),
    }
  }

  pub fn new_with_config(config: SharedConfig) -> Self {
    Self {
      http: Client::new(),
      token_vault_service: TokenVaultService::new(),
      config,
    }
  }

  pub fn list_accounts(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    self.token_vault_service.read_accounts(&platform)
  }

  pub fn upsert_account(&self, account: &AuthAccountModel) -> Result<(), String> {
    self.token_vault_service.upsert_account(account)
  }

  pub fn remove_account(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<(), String> {
    self
      .token_vault_service
      .remove_account(platform, account_id)
  }

  pub fn get_auth_status(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    self.token_vault_service.read_accounts(&platform)
  }

  pub async fn validate_auth_status(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    log::debug!("Validating auth status for {:?}", platform);
    let mut accounts = self.get_auth_status(platform.clone())?;
    let config = get_oauth_provider_config(&platform, &self.config)?;
    let now = chrono::Utc::now();

    for account in &mut accounts {
      if let Some(expires_at_str) = &account.token_expires_at {
        if let Ok(expires_at) = chrono::DateTime::parse_from_rfc3339(expires_at_str) {
          if now >= expires_at {
            if account.refresh_token.is_some() {
              log::debug!("Token expired for account {} on {:?}", account.id, platform);
              account.auth_status = AuthStatusModel::TokenExpired;
            } else {
              log::debug!(
                "Token expired without refresh for account {} on {:?}",
                account.id,
                platform
              );
              account.auth_status = AuthStatusModel::TokenExpired;
            }
          }
        }
      }

      if account.auth_status == AuthStatusModel::Authorized {
        match self
          .validate_token_with_api(&platform, &account.access_token, &config)
          .await
        {
          Ok(true) => {
            account.auth_status = AuthStatusModel::Authorized;
          }
          Ok(false) => {
            log::warn!("Token revoked for account {} on {:?}", account.id, platform);
            account.auth_status = AuthStatusModel::Revoked;
          }
          Err(_) => {}
        }
      }
    }

    Ok(accounts)
  }

  async fn validate_token_with_api(
    &self,
    platform: &PlatformTypeModel,
    access_token: &Option<String>,
    config: &crate::helpers::oauth_config_helper::OAuthProviderConfig,
  ) -> Result<bool, String> {
    let token = access_token
      .as_ref()
      .ok_or_else(|| "No access token available".to_string())?;

    let mut request = self.http.get(&config.userinfo_url).bearer_auth(token);

    if matches!(platform, PlatformTypeModel::Twitch) {
      request = request.header("Client-Id", &config.client_id);
    }

    let response = request
      .send()
      .await
      .map_err(|e| format!("Validation request failed: {e}"))?;

    let status = response.status();

    if status.is_success() {
      return Ok(true);
    }

    if status == 401 || status == 403 {
      return Ok(false);
    }

    Err(format!("API error {status}, not marking as revoked"))
  }

  pub async fn refresh_token(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<AuthAccountModel, String> {
    log::info!(
      "Refreshing token for account {} on {:?}",
      account_id,
      platform
    );
    let saved_token = self
      .token_vault_service
      .read_token(platform, account_id)?
      .ok_or_else(|| "No saved token found".to_string())?;

    let refresh_token = saved_token
      .refresh_token
      .ok_or_else(|| "No refresh token available. Please re-authenticate.".to_string())?;

    #[allow(clippy::needless_borrow)]
    let config = get_oauth_provider_config(&platform, &self.config)?;

    log::debug!("Performing token refresh for account {}", account_id);
    let new_token = refresh_access_token(&self.http, platform, &refresh_token, &config).await?;

    let accounts = self.token_vault_service.read_accounts(platform)?;
    let mut account = accounts
      .into_iter()
      .find(|acc| acc.id == account_id)
      .ok_or_else(|| "Account not found".to_string())?;

    let expires_at = new_token
      .expires_in_seconds
      .map(|seconds| (chrono::Utc::now() + chrono::Duration::seconds(seconds)).to_rfc3339());
    account.access_token = Some(new_token.access_token.clone());
    account.refresh_token = new_token.refresh_token.clone();
    account.token_expires_at = expires_at;
    account.auth_status = AuthStatusModel::Authorized;

    self.token_vault_service.upsert_account(&account)?;
    self.token_vault_service.save_token(&account, &new_token)?;

    log::info!(
      "Token refreshed successfully for account {} on {:?}",
      account_id,
      platform
    );
    Ok(account)
  }

  pub fn save_token(
    &self,
    account: &AuthAccountModel,
    token: &crate::models::auth_oauth_model::OAuthTokenModel,
  ) -> Result<(), String> {
    self.token_vault_service.save_token(account, token)
  }

  pub fn read_token(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<Option<crate::models::auth_oauth_model::OAuthTokenModel>, String> {
    self.token_vault_service.read_token(platform, account_id)
  }

  pub fn delete_token(&self, platform: &PlatformTypeModel, account_id: &str) -> Result<(), String> {
    self.token_vault_service.delete_token(platform, account_id)
  }

  pub fn get_token_vault(&self) -> &TokenVaultService {
    &self.token_vault_service
  }
}
