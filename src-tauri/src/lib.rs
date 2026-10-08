use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

// Save a JSON file (a world backup) where the user chooses with a native Save
// dialog. Returns the chosen path, or None when the dialog was cancelled.
// The webview's own downloads are unreliable on desktop, so the frontend calls
// this instead (web/src/lib/saveFile.ts).
#[tauri::command]
async fn save_json_file(
  app: tauri::AppHandle,
  default_name: String,
  contents: String,
) -> Result<Option<String>, String> {
  // Blocking is fine here: async commands run off the main thread
  let Some(chosen) = app
    .dialog()
    .file()
    .set_file_name(&default_name)
    .add_filter("JSON backup", &["json"])
    .blocking_save_file()
  else {
    return Ok(None);
  };
  let path = chosen
    .into_path()
    .map_err(|e| format!("Could not use the chosen location: {e}"))?;
  std::fs::write(&path, contents)
    .map_err(|e| format!("Could not write {}: {e}", path.display()))?;
  Ok(Some(path.display().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![save_json_file])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
