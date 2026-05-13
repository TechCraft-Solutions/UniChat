#![allow(non_snake_case)]

use crate::services::update_service::{
  check_for_update, download_update_with_progress, get_temp_download_path, UpdateInfo,
};
use crate::AppState;
use tauri::{AppHandle, State};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, serde::Serialize)]
pub struct CheckUpdateResult {
  pub has_update: bool,
  pub update_info: Option<UpdateInfo>,
  pub error: Option<String>,
}

#[tauri::command]
pub async fn checkForUpdate(state: State<'_, AppState>) -> Result<CheckUpdateResult, String> {
  let current_version = state.config.version.clone();

  match check_for_update(&current_version).await {
    Ok(update_info) => Ok(CheckUpdateResult {
      has_update: true,
      update_info: Some(update_info),
      error: None,
    }),
    Err(e) => {
      if e.contains("You are running the latest version") {
        Ok(CheckUpdateResult {
          has_update: false,
          update_info: None,
          error: None,
        })
      } else {
        Ok(CheckUpdateResult {
          has_update: false,
          update_info: None,
          error: Some(e),
        })
      }
    }
  }
}

#[tauri::command]
pub async fn downloadUpdate(url: String, app_handle: AppHandle) -> Result<String, String> {
  let url_clone = url.clone();
  let asset_name = url_clone
    .split('/')
    .last()
    .unwrap_or("update.bin")
    .to_string();

  let dest_path = get_temp_download_path(&asset_name)?;

  let _downloaded = download_update_with_progress(&url, &dest_path, app_handle).await?;

  Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn installUpdate(installer_path: String, app_handle: AppHandle) -> Result<bool, String> {
  let path = std::path::Path::new(&installer_path);
  if !path.exists() {
    return Err("Installer file not found".to_string());
  }

  let extension = path
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_lowercase();

  #[cfg(target_os = "windows")]
  {
    if extension == "msi" {
      let shell = app_handle.shell();
      let _child = shell
        .command("msiexec")
        .args(["/i", &installer_path])
        .spawn()
        .map_err(|e| format!("Failed to run installer: {}", e))?;
    } else {
      let shell = app_handle.shell();
      let _child = shell
        .command(&installer_path)
        .spawn()
        .map_err(|e| format!("Failed to run installer: {}", e))?;
    }
  }

  #[cfg(target_os = "macos")]
  {
    let shell = app_handle.shell();
    let _child = shell
      .command("open")
      .args(["-W", &installer_path])
      .spawn()
      .map_err(|e| format!("Failed to open installer: {}", e))?;
  }

  #[cfg(target_os = "linux")]
  {
    let shell = app_handle.shell();
    if extension == "AppImage" {
      let _child = shell
        .command("chmod")
        .args(["+x", &installer_path])
        .spawn()
        .map_err(|e| format!("Failed to make executable: {}", e))?;
      let _child = shell
        .command(&installer_path)
        .spawn()
        .map_err(|e| format!("Failed to run installer: {}", e))?;
    } else if extension == "deb" {
      let _child = shell
        .command("dpkg")
        .args(["-i", &installer_path])
        .spawn()
        .map_err(|e| format!("Failed to install .deb: {}", e))?;
    } else if extension == "rpm" {
      let _child = shell
        .command("rpm")
        .args(["-U", &installer_path])
        .spawn()
        .map_err(|e| format!("Failed to install .rpm: {}", e))?;
    } else {
      return Err(format!("Unsupported installer format: {}", extension));
    }
  }

  Ok(true)
}

#[tauri::command]
pub fn getCurrentVersion(state: State<'_, AppState>) -> String {
  state.config.version.clone()
}
