use tauri::State;
use crate::AppState;
use database as db;

#[tauri::command]
pub fn get_capture_mouse(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_capture_mouse(&conn))
}

#[tauri::command]
pub fn set_capture_mouse(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::set_capture_mouse(&conn, enabled).map_err(|e| e.to_string())
}
