//! OAuth Provider Service
//! Facade that delegates to OAuthFlowService, AccountService, and TokenVaultService

use log;
use reqwest::Client;
use url::Url;

use crate::helpers::config_helper::SharedConfig;
use crate::helpers::oauth_config_helper::get_oauth_provider_config;
use crate::models::auth_account_model::AuthAccountModel;
use crate::models::auth_oauth_model::OAuthTokenModel;
use crate::models::platform_type_model::PlatformTypeModel;
use crate::services::auth::account_service::AccountService;
use crate::services::auth::oauth_flow_service::OAuthFlowService;
use crate::services::auth::token_vault_service::TokenVaultService;

pub struct OAuthProviderService {
  http: Client,
  oauth_flow_service: OAuthFlowService,
  account_service: AccountService,
  token_vault_service: TokenVaultService,
}

impl Default for OAuthProviderService {
  fn default() -> Self {
    Self::new()
  }
}

impl OAuthProviderService {
  pub fn new() -> Self {
    Self {
      http: Client::new(),
      oauth_flow_service: OAuthFlowService::new(),
      account_service: AccountService::new(),
      token_vault_service: TokenVaultService::new(),
    }
  }

  pub fn new_with_config(config: SharedConfig) -> Self {
    Self {
      http: Client::new(),
      oauth_flow_service: OAuthFlowService::new_with_config(config.clone()),
      account_service: AccountService::new_with_config(config.clone()),
      token_vault_service: TokenVaultService::new(),
    }
  }

  pub fn start_auth(&self, platform: PlatformTypeModel) -> Result<String, String> {
    self.oauth_flow_service.start_auth(platform)
  }

  pub async fn await_loopback_and_complete(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<AuthAccountModel, String> {
    log::debug!("Waiting for OAuth callback for {:?}", platform);
    let callback_url = self
      .oauth_flow_service
      .wait_for_callback(platform.clone())?;
    self.complete_auth(platform, callback_url).await
  }

  pub async fn complete_auth(
    &self,
    platform: PlatformTypeModel,
    callback_url: String,
  ) -> Result<AuthAccountModel, String> {
    let callback = Url::parse(&callback_url).map_err(|e| format!("invalid callback url: {e}"))?;
    let params: std::collections::HashMap<String, String> =
      callback.query_pairs().into_owned().collect();
    let state_param = params.get("state").ok_or("missing state parameter")?;
    self
      .oauth_flow_service
      .get_state_service()
      .consume_session(state_param)?;
    let account = self
      .oauth_flow_service
      .complete_auth(platform.clone(), callback_url)
      .await?;
    self.account_service.upsert_account(&account)?;
    self.token_vault_service.save_token(
      &account,
      &OAuthTokenModel {
        access_token: account.access_token.clone().unwrap_or_default(),
        refresh_token: account.refresh_token.clone(),
        expires_in_seconds: None,
      },
    )?;
    Ok(account)
  }

  pub fn get_auth_status(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    self.account_service.get_auth_status(platform)
  }

  pub async fn validate_auth_status(
    &self,
    platform: PlatformTypeModel,
  ) -> Result<Vec<AuthAccountModel>, String> {
    self.account_service.validate_auth_status(platform).await
  }

  pub async fn refresh_token(
    &self,
    platform: &PlatformTypeModel,
    account_id: &str,
  ) -> Result<AuthAccountModel, String> {
    self
      .account_service
      .refresh_token(platform, account_id)
      .await
  }

  pub async fn disconnect(
    &self,
    platform: PlatformTypeModel,
    account_id: String,
  ) -> Result<(), String> {
    log::info!("Disconnecting account {} on {:?}", account_id, platform);
    let token = self
      .token_vault_service
      .read_token(&platform, &account_id)?;
    if let Some(saved_token) = token {
      let config = get_oauth_provider_config(&platform, &SharedConfig::default())?;
      if let Some(revoke_url) = config.revoke_url {
        log::debug!(
          "Revoking token for account {} on {:?}",
          account_id,
          platform
        );
        let mut form: Vec<(&str, &str)> = vec![
          ("client_id", &config.client_id),
          ("token", &saved_token.access_token),
        ];
        if let Some(ref secret) = config.client_secret {
          form.push(("client_secret", secret));
        }
        match self.http.post(revoke_url).form(&form).send().await {
          Ok(response) => {
            if !response.status().is_success() {
              log::warn!("Token revoke request failed for account {}", account_id);
            }
          }
          Err(e) => {
            log::warn!(
              "Token revoke request error for account {}: {}",
              account_id,
              e
            );
          }
        }
      }
    }

    self
      .token_vault_service
      .delete_token(&platform, &account_id)?;
    self
      .token_vault_service
      .remove_account(&platform, &account_id)?;
    log::info!("Account {} disconnected successfully", account_id);
    Ok(())
  }

  pub fn validate_token_for_role(&self, token: &str, role: &str) -> Result<(), String> {
    self
      .token_vault_service
      .validate_token_for_role(token, role)
  }
}
