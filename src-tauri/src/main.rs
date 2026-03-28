// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Initialize structured logging
  tracing_subscriber::fmt()
    .with_env_filter(
      tracing_subscriber::EnvFilter::from_default_env()
        .add_directive("unichat=debug".parse().unwrap())
        .add_directive("tauri=info".parse().unwrap()),
    )
    .with_target(false)
    .with_thread_ids(false)
    .with_file(false)
    .with_line_number(false)
    .init();

  tracing::info!("🚀 UniChat starting...");

  unichat_lib::run()
}
