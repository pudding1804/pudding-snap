use tauri::{State, AppHandle, Emitter};
use crate::models::*;
use crate::services::AppState;
use database as db;

#[tauri::command]
pub fn get_screenshots(
    game_id: Option<String>,
    sort_order: String,
    state: State<AppState>,
) -> Result<Vec<ScreenshotRecord>, String> {
    let conn = state.db.lock().unwrap();
    let gid_ref = game_id.as_deref();
    db::get_screenshots(&conn, gid_ref, &sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_screenshots_with_pagination(
    game_id: Option<String>,
    sort_order: String,
    page: i32,
    page_size: i32,
    state: State<AppState>,
) -> Result<PaginationResult, String> {
    let conn = state.db.lock().unwrap();
    let gid_ref = game_id.as_deref();
    db::get_screenshots_with_pagination(&conn, gid_ref, &sort_order, page, page_size).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_games(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    db::get_games(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    if let Ok(ss_list) = db::get_screenshots(&conn, None, "desc") {
        if let Some(ss) = ss_list.iter().find(|s| s.id == id) {
            println!("[删除] 删除截图文件: {:?}", ss.file_path);
            let _ = std::fs::remove_file(&ss.file_path);
            println!("[删除] 删除缩略图文件: {:?}", ss.thumbnail_path);
            let _ = std::fs::remove_file(&ss.thumbnail_path);
        }
    }

    db::delete_screenshot(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_screenshots(ids: Vec<i32>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    
    if let Ok(ss_list) = db::get_screenshots(&conn, None, "desc") {
        for id in &ids {
            if let Some(ss) = ss_list.iter().find(|s| s.id == *id) {
                let _ = std::fs::remove_file(&ss.file_path);
                let _ = std::fs::remove_file(&ss.thumbnail_path);
            }
        }
    }

    db::delete_screenshots(&conn, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(id: i32, note: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::update_note(&conn, id, &note).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_game_icon(game_id: String, state: State<AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().unwrap();
    
    if let Some(cache) = db::get_game_cache(&conn, &game_id) {
        if let Some(icon_path) = &cache.icon_path {
            if std::path::Path::new(icon_path).exists() {
                return Ok(Some(icon_path.clone()));
            }
        }
    }
    
    Ok(None)
}

#[tauri::command]
pub fn extract_game_icon(game_id: String, exe_path: String, state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    
    if let Some(cache) = db::get_game_cache(&conn, &game_id) {
        if let Some(icon_path) = &cache.icon_path {
            if std::path::Path::new(icon_path).exists() {
                return Ok(icon_path.clone());
            }
        }
    }
    
    let icons_dir = db::get_icons_dir();
    let icon_path = icons_dir.join(format!("{}.png", game_id));
    
    crate::screenshot::extract_icon_from_exe(&exe_path, &icon_path)?;
    
    let icon_path_str = icon_path.to_string_lossy().to_string();
    let timestamp = chrono::Utc::now().timestamp();
    
    let cache = GameCache {
        game_id: game_id.clone(),
        exe_path: Some(exe_path),
        icon_path: Some(icon_path_str.clone()),
        display_title: None,
        last_updated: timestamp,
        steam_appid: None,
        steam_name: None,
        steam_logo_path: None,
        steam_match_status: None,
    };
    
    db::set_game_cache(&conn, &cache).map_err(|e| e.to_string())?;
    
    Ok(icon_path_str)
}

#[tauri::command]
pub fn open_in_explorer(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }
    
    let _ = std::process::Command::new("explorer")
        .args(["/select,", &file_path])
        .spawn()
        .map_err(|e| format!("无法打开文件夹: {}", e))?;
    
    println!("[打开文件夹] 已打开: {}", file_path);
    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct FileMetadata {
    pub size: u64,
    pub created: i64,
    pub modified: i64,
}

#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("无法获取文件信息: {}", e))?;
    
    let size = metadata.len();
    
    let created = metadata.created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|| chrono::Utc::now().timestamp());
    
    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|| chrono::Utc::now().timestamp());
    
    Ok(FileMetadata {
        size,
        created,
        modified,
    })
}
