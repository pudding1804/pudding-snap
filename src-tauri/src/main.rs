#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod windows_utils;
mod screenshot;
mod audio;
mod steam;
mod bangumi;
mod retroarch;

mod raw_input;
mod keyboard_hook;

use std::sync::{Arc, Mutex, mpsc, RwLock};
use std::collections::{VecDeque, HashMap};
use std::time::Instant;
use image::DynamicImage;
use tauri::{Manager, State, Emitter, AppHandle, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
use rusqlite::params;
use database as db;
use models::*;
use windows_utils::*;
use screenshot::*;
use audio::play_shutter_sound_with_type;
use steam::{SteamMatchStatus, SteamMatchResult, SteamGameInfo, SteamSearchResult};

#[cfg(debug_assertions)]
const DEBUG_MODE: bool = true;

#[cfg(not(debug_assertions))]
const DEBUG_MODE: bool = false;

struct ScreenshotTask {
    image: DynamicImage,
    exe_path: Option<String>,
    process_name: String,
    steam_appid: Option<u32>,
    window_title: Option<String>,
    window_title_match_enabled: bool,
    retroarch_screenshot_path: Option<String>,
}

#[derive(Debug)]
enum HotkeyEvent {
    PrintScreen,
    F11,
    F12,
}

struct AppState {
    db: Arc<Mutex<rusqlite::Connection>>,
    settings_cache: Arc<RwLock<HashMap<String, String>>>,
    window_shown: Arc<Mutex<bool>>,
    screenshot_queue: Arc<Mutex<VecDeque<ScreenshotTask>>>,
    is_processing: Arc<Mutex<bool>>,
    unread_count: Arc<Mutex<u32>>,
}

#[tauri::command]
fn get_screenshots(
    game_id: Option<String>,
    sort_order: String,
    state: State<AppState>,
) -> Result<Vec<ScreenshotRecord>, String> {
    let conn = state.db.lock().unwrap();
    let gid_ref = game_id.as_deref();
    db::get_screenshots(&conn, gid_ref, &sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_games(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    db::get_games(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_games_with_pagination(page: i32, page_size: i32, state: State<AppState>) -> Result<PaginatedGames, String> {
    let conn = state.db.lock().unwrap();
    db::get_games_with_pagination(&conn, page, page_size).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_all_games(search_term: String, state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    db::search_all_games(&conn, &search_term).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::soft_delete_screenshot(&conn, id)
}

#[tauri::command]
fn update_note(id: i32, note: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::update_note(&conn, id, &note).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screenshots_with_pagination(
    game_id: Option<String>,
    sort_order: String,
    page: i32,
    page_size: i32,
    date_start: Option<i64>,
    date_end: Option<i64>,
    note_search: Option<String>,
    state: State<AppState>,
) -> Result<PaginationResult, String> {
    let conn = state.db.lock().unwrap();
    let gid_ref = game_id.as_deref();
    let ns_ref = note_search.as_deref();
    db::get_screenshots_with_pagination(&conn, gid_ref, &sort_order, page, page_size, date_start, date_end, ns_ref).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_screenshots(ids: Vec<i32>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::soft_delete_screenshots(&conn, &ids)
}

#[tauri::command]
fn get_deleted_screenshots(sort_order: String, page: i32, page_size: i32, state: State<AppState>) -> Result<PaginationResult, String> {
    let conn = state.db.lock().unwrap();
    db::get_deleted_screenshots_with_pagination(&conn, &sort_order, page, page_size)
}

#[tauri::command]
fn restore_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::restore_screenshot(&conn, id)
}

#[tauri::command]
fn restore_screenshots(ids: Vec<i32>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::restore_screenshots(&conn, &ids)
}

#[tauri::command]
fn permanent_delete_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::permanent_delete_screenshot(&conn, id)
}

#[tauri::command]
fn get_all_deleted_screenshot_ids(state: State<AppState>) -> Result<Vec<i32>, String> {
    let conn = state.db.lock().unwrap();
    db::get_all_deleted_screenshot_ids(&conn)
}

#[tauri::command]
fn permanent_delete_screenshots(ids: Vec<i32>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::permanent_delete_screenshots(&conn, &ids)
}

#[tauri::command]
fn cleanup_expired_deleted(state: State<AppState>) -> Result<usize, String> {
    let conn = state.db.lock().unwrap();
    db::cleanup_expired_deleted(&conn)
}

#[tauri::command]
fn get_deleted_screenshots_count(state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_deleted_screenshots_count(&conn))
}

#[tauri::command]
fn get_storage_path() -> Result<String, String> {
    Ok(db::get_storage_path())
}

#[tauri::command]
fn perform_backup(_state: State<AppState>) -> Result<String, String> {
    db::perform_backup().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_last_backup_time() -> Result<Option<i64>, String> {
    Ok(db::get_last_backup_time())
}

#[tauri::command]
fn get_backup_enabled(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_setting(&conn, "backup_enabled").unwrap_or_else(|| "false".to_string()) == "true")
}

#[tauri::command]
fn set_backup_enabled(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::set_setting(&conn, "backup_enabled", if enabled { "true" } else { "false" })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screenshot_notification(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_screenshot_notification(&conn))
}

#[tauri::command]
fn set_screenshot_notification(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::set_screenshot_notification(&conn, enabled).map_err(|e| e.to_string())
}

#[tauri::command]
async fn migrate_data(app: AppHandle, new_path: String, state: State<'_, AppState>) -> Result<MigrationResult, String> {
    let old_data_dir = db::get_data_dir();
    let new_data_dir = std::path::PathBuf::from(&new_path);
    
    println!("[迁移] 从 {:?} 迁移到 {:?}", old_data_dir, new_data_dir);
    
    if old_data_dir == new_data_dir {
        return Ok(MigrationResult {
            success: false,
            error: Some("新路径与原路径相同".to_string()),
            stats: None,
            old_dir_deleted: false,
            old_dir_pending_delete: None,
        });
    }
    
    if !new_data_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&new_data_dir) {
            return Ok(MigrationResult {
                success: false,
                error: Some(format!("无法创建新目录: {}", e)),
                stats: None,
                old_dir_deleted: false,
                old_dir_pending_delete: None,
            });
        }
    }
    
    let _ = app.emit("migration-progress", MigrationProgress { current: 0, total: 0, status: "开始迁移...".to_string() });
    
    let mut stats = MigrationStats {
        total_files: 0,
        copied_files: 0,
        failed_files: 0,
        total_size: 0,
    };
    
    let old_dir_str = old_data_dir.to_string_lossy().to_string();
    let new_dir_str = new_data_dir.to_string_lossy().to_string();
    
    {
        let conn = state.db.lock().unwrap();
        if let Err(e) = db::update_paths_after_migration(&conn, &old_dir_str, &new_dir_str) {
            println!("[迁移] 更新路径失败: {}", e);
        }
    }
    
    let copy_result = copy_dir_with_progress(&app, &old_data_dir, &new_data_dir, &mut stats);
    if let Err(e) = copy_result {
        return Ok(MigrationResult {
            success: false,
            error: Some(format!("复制文件失败: {}", e)),
            stats: Some(stats),
            old_dir_deleted: false,
            old_dir_pending_delete: None,
        });
    }
    
    let _ = app.emit("migration-progress", MigrationProgress { current: stats.copied_files, total: stats.total_files, status: "清理原目录...".to_string() });
    
    db::save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 检查原目录是否可以删除...");
    println!("[迁移] 原目录路径: {:?}", old_data_dir);
    
    let is_valid_data_dir = old_data_dir.join("screenshots.db").exists() 
        || old_data_dir.join("screenshots_v2.db").exists()
        || old_data_dir.join("screenshots").exists()
        || old_data_dir.join("thumbnails").exists();
    
    println!("[迁移] 原目录有效性检查:");
    println!("[迁移]   - screenshots.db 存在: {}", old_data_dir.join("screenshots.db").exists());
    println!("[迁移]   - screenshots_v2.db 存在: {}", old_data_dir.join("screenshots_v2.db").exists());
    println!("[迁移]   - screenshots 目录存在: {}", old_data_dir.join("screenshots").exists());
    println!("[迁移]   - thumbnails 目录存在: {}", old_data_dir.join("thumbnails").exists());
    println!("[迁移]   - is_valid_data_dir: {}", is_valid_data_dir);
    
    let is_safe_to_delete = {
        let old_str = old_data_dir.to_string_lossy().to_lowercase();
        let old_str_trimmed = old_str.trim_end_matches(|c| c == '/' || c == '\\');
        
        println!("[迁移] 原目录路径(小写): {}", old_str);
        println!("[迁移] 原目录路径(去除尾部斜杠): {}", old_str_trimmed);
        
        let dangerous_paths = [
            "c:", "d:", "e:", "f:", "g:", "h:",
            "c:\\", "d:\\", "e:\\", "f:\\", "g:\\", "h:\\",
            "c:/", "d:/", "e:/", "f:/", "g:/", "h:/",
            "/", "\\",
            "c:\\windows", "c:\\program files", "c:\\program files (x86)",
            "c:\\users", "c:\\documents and settings",
        ];
        
        let mut safe = true;
        for dangerous in dangerous_paths.iter() {
            let dangerous_trimmed = dangerous.trim_end_matches(|c| c == '/' || c == '\\');
            if old_str_trimmed == dangerous_trimmed {
                println!("[迁移] 警告: 原目录匹配危险路径: {}", dangerous);
                safe = false;
                break;
            }
        }
        
        if safe && old_str_trimmed.len() <= 3 {
            println!("[迁移] 警告: 原目录路径过短，可能是根目录");
            safe = false;
        }
        
        println!("[迁移]   - is_safe_to_delete: {}", safe);
        safe
    };
    
    let mut old_dir_deleted = false;
    let mut old_dir_pending_delete: Option<String> = None;
    
    if is_valid_data_dir && is_safe_to_delete {
        println!("[迁移] 开始删除原数据目录: {:?}", old_data_dir);
        match std::fs::remove_dir_all(&old_data_dir) {
            Ok(_) => {
                println!("[迁移] 原目录删除成功");
                old_dir_deleted = true;
            }
            Err(e) => {
                println!("[迁移] 删除原目录失败: {} (kind: {:?})", e, e.kind());
                println!("[迁移] 将在下次启动时删除原目录");
                let pending_delete_file = new_data_dir.join(".pending_delete");
                if let Err(write_err) = std::fs::write(&pending_delete_file, old_data_dir.to_string_lossy().as_ref()) {
                    println!("[迁移] 无法写入待删除标记文件: {}", write_err);
                } else {
                    old_dir_pending_delete = Some(old_data_dir.to_string_lossy().to_string());
                }
            }
        }
    } else {
        println!("[迁移] 跳过删除原目录 (valid={}, safe={})", is_valid_data_dir, is_safe_to_delete);
    }
    
    let _ = app.emit("migration-progress", MigrationProgress { current: stats.copied_files, total: stats.total_files, status: "迁移完成".to_string() });
    
    println!("[迁移] 迁移完成: {} 文件, {} 字节", stats.copied_files, stats.total_size);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: Some(stats),
        old_dir_deleted,
        old_dir_pending_delete,
    })
}

#[derive(Clone, serde::Serialize)]
struct MigrationProgress {
    current: u32,
    total: u32,
    status: String,
}

fn copy_dir_with_progress(app: &AppHandle, src: &std::path::PathBuf, dst: &std::path::PathBuf, stats: &mut MigrationStats) -> std::io::Result<()> {
    use std::fs;
    
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_with_progress(app, &path, &dst_path, stats)?;
        } else {
            stats.total_files += 1;
            
            if let Ok(metadata) = fs::metadata(&path) {
                stats.total_size += metadata.len();
            }
            
            match fs::copy(&path, &dst_path) {
                Ok(_) => {
                    stats.copied_files += 1;
                    let _ = app.emit("migration-progress", MigrationProgress {
                        current: stats.copied_files,
                        total: stats.total_files,
                        status: format!("复制: {:?}", path.file_name().unwrap_or_default()),
                    });
                }
                Err(e) => {
                    stats.failed_files += 1;
                    println!("[迁移] 失败: {:?} - {}", path.file_name().unwrap_or_default(), e);
                }
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
fn get_cjk_font_base64() -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose};
    let font_candidates = [
        std::path::PathBuf::from("C:\\Windows\\Fonts\\simhei.ttf"),
        std::path::PathBuf::from("C:\\Windows\\Fonts\\msyh.ttf"),
        std::path::PathBuf::from("C:\\Windows\\Fonts\\simsun.ttf"),
        std::path::PathBuf::from("C:\\Windows\\Fonts\\malgun.ttf"),
        std::path::PathBuf::from("C:\\Windows\\Fonts\\msgothic.ttf"),
    ];
    for path in &font_candidates {
        if path.exists() {
            let data = std::fs::read(path)
                .map_err(|e| format!("读取字体文件失败: {}", e))?;
            return Ok(general_purpose::STANDARD.encode(&data));
        }
    }
    Err("未找到系统CJK字体文件".to_string())
}

#[tauri::command]
fn check_data_directory(path: String) -> Result<db::DirectoryCheckResult, String> {
    Ok(db::check_data_directory(&path))
}

#[tauri::command]
fn switch_data_directory(new_path: String) -> Result<MigrationResult, String> {
    db::switch_data_directory(&new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_shutter_sound(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_shutter_sound(&conn))
}

#[tauri::command]
fn set_shutter_sound(sound_type: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::set_shutter_sound(&conn, &sound_type).map_err(|e| e.to_string())
}

#[tauri::command]
fn play_sound_preview(sound_type: String) -> Result<(), String> {
    play_shutter_sound_with_type(&sound_type)
}

#[tauri::command]
fn get_setting(key: String, state: State<AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_setting(&conn, &key))
}

#[tauri::command]
fn set_setting(key: String, value: String, state: State<AppState>) -> Result<(), String> {
    println!("[设置] 保存设置: {} = {}", key, value);
    let conn = state.db.lock().unwrap();
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())?;
    drop(conn);
    {
        let mut cache = state.settings_cache.write().unwrap();
        cache.insert(key.clone(), value.clone());
    }
    if key == "emulator_keywords" {
        let emulator_names: Vec<String> = value.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        windows_utils::set_custom_emulator_names(emulator_names);
    }
    Ok(())
}

#[tauri::command]
fn log_debug(msg: String) {
    println!("[前端] {}", msg);
}

#[tauri::command]
fn show_window(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let mut window_shown = state.window_shown.lock().unwrap();
    *window_shown = true;
    drop(window_shown);

    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_window(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let mut window_shown = state.window_shown.lock().unwrap();
    *window_shown = false;
    drop(window_shown);
    
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let mut window_shown = state.window_shown.lock().unwrap();
    *window_shown = true;
    drop(window_shown);
    
    if let Some(window) = app.get_webview_window("main") {
        println!("[窗口] 准备显示主窗口...");
        
        let conn = state.db.lock().unwrap();
        let saved_width = db::get_setting(&conn, "window_width");
        let saved_height = db::get_setting(&conn, "window_height");
        let saved_x = db::get_setting(&conn, "window_x");
        let saved_y = db::get_setting(&conn, "window_y");
        drop(conn);
        
        println!("[窗口] 读取到的窗口状态: size={:?}x{:?}, pos={:?},{:?}", 
            saved_width, saved_height, saved_x, saved_y);
        
        if let (Some(w), Some(h)) = (&saved_width, &saved_height) {
            if let (Ok(width), Ok(height)) = (w.parse::<u32>(), h.parse::<u32>()) {
                use tauri::Size::Physical;
                println!("[窗口] 设置窗口大小为: {}x{}", width, height);
                let _ = window.set_size(Physical(tauri::PhysicalSize { width, height }));
            }
        }
        
        if let (Some(x), Some(y)) = (&saved_x, &saved_y) {
            if let (Ok(pos_x), Ok(pos_y)) = (x.parse::<i32>(), y.parse::<i32>()) {
                use tauri::Position::Physical;
                println!("[窗口] 设置窗口位置为: {},{}", pos_x, pos_y);
                let _ = window.set_position(Physical(tauri::PhysicalPosition { x: pos_x, y: pos_y }));
            }
        }
        
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.emit("window-shown", ());
        println!("[窗口] 主窗口已显示");
    }
    Ok(())
}

#[tauri::command]
fn minimize_to_tray(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let mut window_shown = state.window_shown.lock().unwrap();
    *window_shown = false;
    drop(window_shown);
    
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    println!("[窗口] 最小化到系统托盘");
    Ok(())
}

#[tauri::command]
fn reset_unread_count(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let mut count = state.unread_count.lock().unwrap();
    *count = 0;
    println!("[托盘] 未读数量已重置");
    
    let icon_bytes = include_bytes!("../icons/32x32.png");
    let base_icon = image::load_from_memory(icon_bytes)
        .map_err(|e| format!("无法加载图标: {}", e))?;
    let img = base_icon.to_rgba8();
    let (width, height) = img.dimensions();
    let rgba = img.as_raw().clone();
    let icon = tauri::image::Image::new_owned(rgba, width, height);
    
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(icon));
    }
    
    Ok(())
}

#[tauri::command]
fn close_app(app: AppHandle) -> Result<(), String> {
    println!("[窗口] 关闭应用");
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn open_in_explorer(file_path: String) -> Result<(), String> {
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

#[tauri::command]
fn get_game_icon(game_id: String, state: State<AppState>) -> Result<Option<String>, String> {
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
fn extract_game_icon(game_id: String, exe_path: String, state: State<AppState>) -> Result<String, String> {
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
    
    extract_icon_from_exe(&exe_path, &icon_path)?;
    
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
        rating: Some(-1),
    };
    
    db::set_game_cache(&conn, &cache).map_err(|e| e.to_string())?;
    
    Ok(icon_path_str)
}

#[tauri::command]
fn delete_all_data(state: State<AppState>) -> Result<(), String> {
    println!("[删除] 开始删除所有数据...");
    
    // 首先关闭数据库连接
    {
        let mut db = state.db.lock().unwrap();
        // 丢弃数据库连接
        *db = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
        println!("[删除] 数据库连接已关闭");
    }
    
    // 等待一小段时间确保文件句柄释放
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    // 删除数据目录
    let data_dir = db::get_data_dir();
    if data_dir.exists() {
        println!("[删除] 删除数据目录: {:?}", data_dir);
        if let Err(e) = std::fs::remove_dir_all(&data_dir) {
            return Err(format!("删除数据目录失败: {}", e));
        }
    }
    
    // 删除配置文件
    let config_path = db::get_config_file_path();
    if config_path.exists() {
        println!("[删除] 删除配置文件: {:?}", config_path);
        if let Err(e) = std::fs::remove_file(&config_path) {
            return Err(format!("删除配置文件失败: {}", e));
        }
    }
    
    println!("[删除] 所有数据已删除");
    Ok(())
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    println!("[重启] 重启应用...");
    
    {
        let mut db = state.db.lock().unwrap();
        *db = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
        println!("[重启] 数据库连接已关闭");
    }
    
    std::thread::sleep(std::time::Duration::from_millis(300));
    
    app.restart();
    
    Ok(())
}

#[tauri::command]
async fn search_steam_game_info(game_id: String, game_title: String, language: String, state: State<'_, AppState>) -> Result<SteamMatchResult, String> {
    println!("[Steam] 搜索游戏信息: {} ({}) (语言: {})", game_title, game_id, language);
    
    let result = steam::match_game_name_async(&game_title, &language).await;
    
    if result.status == SteamMatchStatus::Found {
        if let Some(ref info) = result.game_info {
            let logos_dir = steam::get_steam_logos_dir();
            let logo_filename = format!("steam_{}.jpg", info.appid);
            let logo_path = logos_dir.join(&logo_filename);
            
            let logo_url = info.header_image.as_ref()
                .or(info.capsule_image.as_ref())
                .map(|s| s.as_str());
            
            let mut logo_path_str = None;
            if let Some(url) = logo_url {
                if let Err(e) = steam::download_steam_image_async(url, &logo_path).await {
                    println!("[Steam] 下载logo失败: {}", e);
                } else {
                    logo_path_str = Some(logo_path.to_string_lossy().to_string());
                }
            }
            
            let conn = state.db.lock().unwrap();
            let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or(GameCache {
                game_id: game_id.clone(),
                exe_path: None,
                icon_path: None,
                display_title: Some(info.name.clone()),
                last_updated: chrono::Utc::now().timestamp(),
                steam_appid: Some(info.appid),
                steam_name: Some(info.name.clone()),
                steam_logo_path: logo_path_str.clone(),
                steam_match_status: Some("found".to_string()),
                rating: Some(-1),
            });
            
            cache.display_title = Some(info.name.clone());
            cache.steam_appid = Some(info.appid);
            cache.steam_name = Some(info.name.clone());
            cache.steam_logo_path = logo_path_str;
            cache.steam_match_status = Some("found".to_string());
            cache.last_updated = chrono::Utc::now().timestamp();
            
            if let Err(e) = db::set_game_cache(&conn, &cache) {
                println!("[Steam] 保存缓存失败: {}", e);
            }
            
            if let Err(e) = db::update_game_display_title(&conn, &game_id, &info.name) {
                println!("[Steam] 更新显示标题失败: {}", e);
            }
            
            return Ok(SteamMatchResult {
                status: SteamMatchStatus::Found,
                game_info: Some(SteamGameInfo {
                    appid: info.appid,
                    name: info.name.clone(),
                    header_image: info.header_image.clone(),
                    capsule_image: info.capsule_image.clone(),
                }),
                searched_name: result.searched_name,
            });
        }
    }
    
    let conn = state.db.lock().unwrap();
    let mut cache = match db::get_game_cache(&conn, &game_id) {
        Some(existing) => existing,
        None => GameCache {
            game_id: game_id.clone(),
            exe_path: None,
            icon_path: None,
            display_title: Some(game_title.clone()),
            last_updated: chrono::Utc::now().timestamp(),
            steam_appid: None,
            steam_name: None,
            steam_logo_path: None,
            steam_match_status: Some(result.status.clone().to_string()),
            rating: Some(-1),
        }
    };
    
    cache.steam_match_status = Some(result.status.clone().to_string());
    cache.last_updated = chrono::Utc::now().timestamp();
    
    if let Err(e) = db::set_game_cache(&conn, &cache) {
        println!("[Steam] 保存缓存失败: {}", e);
    }
    
    Ok(result)
}

#[tauri::command]
async fn search_steam_games(search_term: String, language: String) -> Result<Vec<SteamSearchResult>, String> {
    println!("[Steam] 手动搜索游戏: {} (语言: {})", search_term, language);
    steam::search_steam_games_with_images_async(&search_term, &language).await
}

#[tauri::command]
async fn apply_steam_game_info(game_id: String, appid: u32, language: String, state: State<'_, AppState>) -> Result<SteamGameInfo, String> {
    println!("[Steam] 应用游戏信息: {} -> {} (语言: {})", game_id, appid, language);
    
    let info = steam::get_steam_app_details_async(appid, &language).await?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    let mut logo_path_str = None;
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image_async(url, &logo_path).await {
            println!("[Steam] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
    let conn = state.db.lock().unwrap();
    let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or(GameCache {
        game_id: game_id.clone(),
        exe_path: None,
        icon_path: None,
        display_title: Some(info.name.clone()),
        last_updated: chrono::Utc::now().timestamp(),
        steam_appid: Some(info.appid),
        steam_name: Some(info.name.clone()),
        steam_logo_path: logo_path_str.clone(),
        steam_match_status: Some("found".to_string()),
        rating: Some(-1),
    });
    
    cache.display_title = Some(info.name.clone());
    cache.steam_appid = Some(info.appid);
    cache.steam_name = Some(info.name.clone());
    cache.steam_logo_path = logo_path_str;
    cache.steam_match_status = Some("found".to_string());
    cache.last_updated = chrono::Utc::now().timestamp();
    
    if let Err(e) = db::set_game_cache(&conn, &cache) {
        println!("[Steam] 保存缓存失败: {}", e);
    }
    
    if let Err(e) = db::update_game_display_title(&conn, &game_id, &info.name) {
        println!("[Steam] 更新显示标题失败: {}", e);
    }
    
    Ok(info)
}

#[tauri::command]
async fn create_game_from_steam(
    appid: u32,
    game_name: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 从Steam创建游戏: {} ({})", game_name, appid);
    
    let game_id = format!("steam_{}", appid);
    
    {
        let conn = state.db.lock().unwrap();
        if db::get_game_cache(&conn, &game_id).is_some() {
            return Err("游戏已存在".to_string());
        }
    }
    
    let info = steam::get_steam_app_details_async(appid, &language).await?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image_async(url, &logo_path).await {
            println!("[游戏] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
    let conn = state.db.lock().unwrap();
    db::create_empty_game(
        &conn,
        &game_id,
        &info.name,
        Some(info.appid),
        Some(info.name.clone()),
        logo_path_str.clone(),
    ).map_err(|e| e.to_string())?;
    
    Ok(GameSummary {
        game_id: game_id.clone(),
        game_title: info.name.clone(),
        display_title: info.name.clone(),
        game_banner_url: String::new(),
        count: 0,
        last_timestamp: chrono::Utc::now().timestamp(),
        game_icon_path: None,
        steam_logo_path: logo_path_str,
        rating: Some(-1),
    })
}

#[tauri::command]
async fn update_game_steam_info(
    game_id: String,
    appid: u32,
    game_name: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 更新游戏Steam信息: {} -> {} ({})", game_id, game_name, appid);
    
    let info = steam::get_steam_app_details_async(appid, &language).await?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image_async(url, &logo_path).await {
            println!("[游戏] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
    let conn = state.db.lock().unwrap();
    
    db::update_game_cache(&conn, &game_id, Some(info.appid), Some(info.name.clone()), logo_path_str.clone())
        .map_err(|e| e.to_string())?;
    
    db::update_game_display_title(&conn, &game_id, &info.name)
        .map_err(|e| e.to_string())?;
    
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let last_timestamp: i64 = conn.query_row(
        "SELECT COALESCE(MAX(timestamp), 0) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get::<_, i32>(0).map(|v| v as i64)
    ).unwrap_or(0);
    
    Ok(GameSummary {
        game_id: game_id.clone(),
        game_title: info.name.clone(),
        display_title: info.name.clone(),
        game_banner_url: String::new(),
        count,
        last_timestamp,
        game_icon_path: None,
        steam_logo_path: logo_path_str,
        rating: db::get_game_cache(&conn, &game_id).and_then(|c| c.rating).or(Some(-1)),
    })
}

#[tauri::command]
fn update_game_rating(game_id: String, rating: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::update_game_rating(&conn, &game_id, rating).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_manual_game_info(
    game_id: String,
    display_name: String,
    image_source: Option<String>,
    image_data: Option<String>,
    state: State<AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 手动设置游戏信息: {} -> {}", game_id, display_name);

    let mut logo_path_str: Option<String> = None;

    if let Some(source) = image_source {
        if let Some(data) = image_data {
            let img_result: Result<image::DynamicImage, String> = if source == "file" {
                image::open(&data)
                    .map_err(|e| format!("无法打开图片文件: {}", e))
            } else {
                use base64::{Engine as _, engine::general_purpose};
                let decoded = general_purpose::STANDARD
                    .decode(&data)
                    .map_err(|e| format!("Base64解码失败: {}", e))?;
                image::load_from_memory(&decoded)
                    .map_err(|e| format!("无法解析图片数据: {}", e))
            };

            match img_result {
                Ok(img) => {
                    let logos_dir = steam::get_steam_logos_dir();
                    let logo_filename = format!("manual_{}.jpg", game_id);
                    let logo_path = logos_dir.join(&logo_filename);

                    let max_width = 460u32;
                    let max_height = 215u32;
                    let (width, height) = (img.width(), img.height());
                    let resized = if width > max_width || height > max_height {
                        let ratio = (max_width as f64 / width as f64)
                            .min(max_height as f64 / height as f64);
                        let new_w = (width as f64 * ratio) as u32;
                        let new_h = (height as f64 * ratio) as u32;
                        img.thumbnail(new_w, new_h)
                    } else {
                        img
                    };

                    resized.save(&logo_path)
                        .map_err(|e| format!("保存缩略图失败: {}", e))?;
                    logo_path_str = Some(logo_path.to_string_lossy().to_string());
                    println!("[游戏] 手动缩略图已保存: {:?}", logo_path);
                }
                Err(e) => {
                    println!("[游戏] 处理图片失败: {}", e);
                }
            }
        }
    }

    let conn = state.db.lock().unwrap();

    db::set_manual_game_info(&conn, &game_id, &display_name, logo_path_str.as_deref())
        .map_err(|e| e.to_string())?;

    db::update_game_display_title(&conn, &game_id, &display_name)
        .map_err(|e| e.to_string())?;

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0)
    ).unwrap_or(0);

    let last_timestamp: i64 = conn.query_row(
        "SELECT COALESCE(MAX(timestamp), 0) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get::<_, i32>(0).map(|v| v as i64)
    ).unwrap_or(0);

    let existing_logo: Option<String> = db::get_game_cache(&conn, &game_id)
        .and_then(|c| c.steam_logo_path);
    let final_logo = logo_path_str.or(existing_logo);

    Ok(GameSummary {
        game_id: game_id.clone(),
        game_title: display_name.clone(),
        display_title: display_name,
        game_banner_url: String::new(),
        count,
        last_timestamp,
        game_icon_path: final_logo.clone(),
        steam_logo_path: final_logo,
        rating: db::get_game_cache(&conn, &game_id).and_then(|c| c.rating).or(Some(-1)),
    })
}

#[tauri::command]
fn save_bangumi_auth(access_token: Option<String>, cookie: Option<String>) -> Result<(), String> {
    let auth = bangumi::BangumiAuth {
        access_token,
        cookie,
    };
    bangumi::save_bangumi_auth(&auth)
}

#[tauri::command]
fn get_bangumi_auth() -> Result<bangumi::BangumiAuth, String> {
    bangumi::load_bangumi_auth()
}

#[tauri::command]
async fn search_bangumi_games(search_term: String) -> Result<Vec<bangumi::BangumiSearchResult>, String> {
    println!("[Bangumi] 手动搜索游戏: {}", search_term);
    bangumi::search_bangumi_games_async(&search_term).await
}

#[tauri::command]
async fn create_game_from_bangumi(
    subject_id: u32,
    game_name: String,
    language: String,
    state: State<'_, AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 从Bangumi创建游戏: {} ({}) (语言: {})", game_name, subject_id, language);
    
    let game_id = format!("bangumi_{}", subject_id);
    
    {
        let conn = state.db.lock().unwrap();
        if db::get_game_cache(&conn, &game_id).is_some() {
            return Err("游戏已存在".to_string());
        }
    }
    
    let info = bangumi::get_bangumi_subject_details_async(subject_id).await?
        .ok_or_else(|| format!("未找到 Bangumi 游戏: {}", subject_id))?;
    
    let logos_dir = bangumi::get_bangumi_logos_dir();
    let logo_filename = format!("bangumi_{}.jpg", info.id);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    if let Some(url) = &info.image {
        if let Err(e) = bangumi::download_bangumi_image_async(url, &logo_path).await {
            println!("[游戏] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
    let display_title = if language == "zh" {
        info.name_cn.as_ref().filter(|s| !s.is_empty()).unwrap_or(&info.name)
    } else {
        &info.name
    };
    
    let conn = state.db.lock().unwrap();
    db::create_empty_game(
        &conn,
        &game_id,
        display_title,
        None,
        Some(info.name.clone()),
        logo_path_str.clone(),
    ).map_err(|e| e.to_string())?;
    
    Ok(GameSummary {
        game_id: game_id.clone(),
        game_title: info.name.clone(),
        display_title: display_title.clone(),
        game_banner_url: String::new(),
        count: 0,
        last_timestamp: chrono::Utc::now().timestamp(),
        game_icon_path: None,
        steam_logo_path: logo_path_str,
        rating: Some(-1),
    })
}

#[tauri::command]
async fn apply_bangumi_game_info(game_id: String, subject_id: u32, language: String, state: State<'_, AppState>) -> Result<GameSummary, String> {
    println!("[Bangumi] 应用游戏信息: {} -> {} (语言: {})", game_id, subject_id, language);
    
    let info = bangumi::get_bangumi_subject_details_async(subject_id).await?
        .ok_or_else(|| format!("未找到 Bangumi 游戏: {}", subject_id))?;
    
    let logos_dir = bangumi::get_bangumi_logos_dir();
    let logo_filename = format!("bangumi_{}.jpg", info.id);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    if let Some(url) = &info.image {
        if let Err(e) = bangumi::download_bangumi_image_async(url, &logo_path).await {
            println!("[Bangumi] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
    let display_title = if language == "zh" {
        info.name_cn.as_ref().filter(|s| !s.is_empty()).unwrap_or(&info.name)
    } else {
        &info.name
    };
    
    let conn = state.db.lock().unwrap();
    db::update_game_cache(&conn, &game_id, None, Some(info.name.clone()), logo_path_str.clone())
        .map_err(|e| e.to_string())?;
    
    db::update_game_display_title(&conn, &game_id, display_title)
        .map_err(|e| e.to_string())?;
    
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0)
    ).unwrap_or(0);
    
    let last_timestamp: i64 = conn.query_row(
        "SELECT COALESCE(MAX(timestamp), 0) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0)
    ).unwrap_or(0);
    
    Ok(GameSummary {
        game_id: game_id.clone(),
        game_title: info.name.clone(),
        display_title: display_title.clone(),
        game_banner_url: String::new(),
        count,
        last_timestamp,
        game_icon_path: None,
        steam_logo_path: logo_path_str,
        rating: db::get_game_cache(&conn, &game_id).and_then(|c| c.rating).or(Some(-1)),
    })
}

#[tauri::command]
fn delete_game(game_id: String, state: State<AppState>) -> Result<(), String> {
    println!("[游戏] 软删除游戏: {}", game_id);
    let conn = state.db.lock().unwrap();
    db::delete_game(&conn, &game_id)
}

#[tauri::command]
fn delete_games(game_ids: Vec<String>, state: State<AppState>) -> Result<(), String> {
    println!("[游戏] 批量软删除 {} 个游戏", game_ids.len());
    let conn = state.db.lock().unwrap();
    db::delete_games(&conn, &game_ids)
}

#[tauri::command]
fn get_game_screenshot_count(game_id: String, state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    db::get_game_screenshot_count(&conn, &game_id).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ImportFileInfo {
    path: String,
    name: String,
    size: u64,
    created: i64,
    modified: i64,
}

#[derive(Debug, serde::Serialize)]
struct ImportResult {
    success: bool,
    imported_count: u32,
    skipped_count: u32,
    failed_count: u32,
    duration_ms: u64,
    error: Option<String>,
    imported_ids: Vec<i32>,
}

#[derive(Debug, serde::Serialize, Clone)]
struct ImportProgress {
    current: u32,
    total: u32,
    current_file: String,
    status: String,
}

static TIMESTAMP_PATTERNS: once_cell::sync::Lazy<Vec<regex::Regex>> = once_cell::sync::Lazy::new(|| {
    let pattern_strs = [
        r"^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})",
        r"^(\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})",
        r"^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})",
        r"^(\d{4})\.(\d{2})\.(\d{2})[ _](\d{2})\.(\d{2})\.(\d{2})",
        r"^Screenshot[_\s](\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})",
        r"^Screenshot[_\s](\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})",
    ];
    pattern_strs.iter().filter_map(|p| regex::Regex::new(p).ok()).collect()
});

fn parse_filename_timestamp(filename: &str) -> Option<i64> {
    use chrono::{NaiveDate, NaiveTime, TimeZone, Local};
    
    for re in TIMESTAMP_PATTERNS.iter() {
        if let Some(caps) = re.captures(filename) {
            let year: i32 = caps.get(1)?.as_str().parse().ok()?;
            let month: u32 = caps.get(2)?.as_str().parse().ok()?;
            let day: u32 = caps.get(3)?.as_str().parse().ok()?;
            let hour: u32 = caps.get(4)?.as_str().parse().ok()?;
            let minute: u32 = caps.get(5)?.as_str().parse().ok()?;
            let second: u32 = caps.get(6)?.as_str().parse().ok()?;
            
            if month < 1 || month > 12 || day < 1 || day > 31 
               || hour > 23 || minute > 59 || second > 59 {
                continue;
            }
            
            let naive_dt = chrono::NaiveDateTime::new(
                NaiveDate::from_ymd_opt(year, month, day)?,
                NaiveTime::from_hms_opt(hour, minute, second)?
            );
            
            let local_dt = Local.from_local_datetime(&naive_dt).single()?;
            return Some(local_dt.timestamp());
        }
    }
    
    None
}

fn calculate_file_hash(path: &std::path::PathBuf) -> Result<String, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::io::Read;
    
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("无法打开文件: {}", e))?;
    
    let mut hasher = DefaultHasher::new();
    let mut buffer = [0u8; 8192];
    
    loop {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("读取文件失败: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        buffer[..bytes_read].hash(&mut hasher);
    }
    
    Ok(format!("{:x}", hasher.finish()))
}

#[tauri::command]
async fn import_screenshots(
    game_id: String,
    display_title: String,
    files: Vec<ImportFileInfo>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<ImportResult, String> {
    println!("[导入] 导入截图到游戏: {} ({} 个文件)", game_id, files.len());
    
    let total = files.len() as u32;
    let app_handle = app.clone();
    let db = state.db.clone();
    let game_id_clone = game_id.clone();
    let display_title_clone = display_title.clone();
    let files_clone = files.clone();
    
    let (tx, rx) = tokio::sync::oneshot::channel::<ImportResult>();
    
    std::thread::spawn(move || {
        use std::time::Instant;
        let start_time = Instant::now();
        
        let existing_filenames: std::collections::HashSet<String> = {
            let conn = db.lock().unwrap();
            let mut filenames = std::collections::HashSet::new();
            if let Ok(existing) = db::get_screenshots(&conn, Some(&game_id_clone), "desc") {
                for ss in existing {
                    if let Some(filename) = std::path::PathBuf::from(&ss.file_path).file_name() {
                        filenames.insert(filename.to_string_lossy().to_string());
                    }
                }
            }
            filenames
        };
        println!("[导入] 已有 {} 个文件", existing_filenames.len());
        
        let game_dir = db::get_game_dir(&game_id_clone);
        let thumbnails_dir = game_dir.join("thumbnails");
        if !thumbnails_dir.exists() {
            let _ = std::fs::create_dir_all(&thumbnails_dir);
        }
        
        let mut current = 0u32;
        let mut imported_count = 0u32;
        let mut skipped_count = 0u32;
        let mut failed_count = 0u32;
        
        let mut pending_db_inserts: Vec<(String, String, i64)> = Vec::new();

        for file in &files_clone {
            current += 1;
            
            let _ = app_handle.emit("import-progress", ImportProgress {
                current,
                total,
                current_file: file.name.clone(),
                status: "处理中".to_string(),
            });
            
            let file_start = std::time::Instant::now();
            let src_path = std::path::PathBuf::from(&file.path);
            
            if !src_path.exists() {
                failed_count += 1;
                continue;
            }
            
            let timestamp = parse_filename_timestamp(&file.name)
                .unwrap_or(file.modified);
            
            let original_ext = src_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png")
                .to_lowercase();
            let millis = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_millis();
            let filename = format!("{}_{:03}.{}", timestamp, millis, original_ext);
            let thumbnail_filename = format!("{}_{:03}_thumb.jpg", timestamp, millis);
            
            if existing_filenames.contains(&filename) {
                println!("[导入] 跳过重复文件: {}", filename);
                skipped_count += 1;
                continue;
            }
            
            let dest_path = game_dir.join(&filename);
            let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);
            
            match process_and_save_image_fast(&src_path, &dest_path) {
                Ok(_) => {
                    if let (Some(file_path_str), Some(thumb_path_str)) = 
                        (dest_path.to_str(), thumbnail_path.to_str()) {
                        pending_db_inserts.push((file_path_str.to_string(), thumb_path_str.to_string(), timestamp));
                    } else {
                        failed_count += 1;
                    }
                }
                Err(e) => {
                    println!("[导入] 处理图片失败: {} - {}", file.name, e);
                    failed_count += 1;
                }
            }
            println!("[导入] 文件 {} 总耗时: {}ms", file.name, file_start.elapsed().as_millis());
        }

        let mut imported_ids: Vec<i32> = Vec::new();

        if !pending_db_inserts.is_empty() {
            let conn = db.lock().unwrap();
            conn.execute_batch("BEGIN TRANSACTION").map_err(|e| format!("开启事务失败: {}", e)).ok();
            for (file_path_str, thumb_path_str, ts) in &pending_db_inserts {
                match db::insert_screenshot(&conn, file_path_str, thumb_path_str, &game_id_clone, &display_title_clone, *ts, None) {
                    Ok(id) => {
                        imported_count += 1;
                        imported_ids.push(id as i32);
                    }
                    Err(_) => {
                        failed_count += 1;
                    }
                }
            }
            conn.execute_batch("COMMIT").map_err(|e| format!("提交事务失败: {}", e)).ok();
        }
        
        let duration_ms = start_time.elapsed().as_millis() as u64;
        println!("[导入] 导入完成: {} 成功, {} 跳过, {} 失败, 耗时 {}ms", imported_count, skipped_count, failed_count, duration_ms);
        
        let _ = app_handle.emit("import-progress", ImportProgress {
            current: total,
            total,
            current_file: String::new(),
            status: "完成".to_string(),
        });
        
        let result = ImportResult {
            success: true,
            imported_count,
            skipped_count,
            failed_count,
            duration_ms,
            error: None,
            imported_ids,
        };
        
        let _ = tx.send(result);
    });
    
    rx.await.map_err(|_| "导入过程中发生错误".to_string())
}

#[tauri::command]
fn generate_thumbnails(screenshot_ids: Vec<i32>, app: AppHandle, state: State<AppState>) -> Result<(), String> {
    if screenshot_ids.is_empty() {
        return Ok(());
    }

    let db = state.db.clone();
    let total = screenshot_ids.len() as u32;
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let mut current = 0u32;
        let mut generated = 0u32;

        for id in &screenshot_ids {
            current += 1;
            let file_path: Option<String>;
            let thumbnail_path: Option<String>;
            {
                let conn = db.lock().unwrap();
                file_path = conn.query_row(
                    "SELECT file_path FROM screenshots WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                ).ok();
                thumbnail_path = conn.query_row(
                    "SELECT thumbnail_path FROM screenshots WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                ).ok();
            }

            if file_path.is_none() || thumbnail_path.is_none() {
                println!("[缩略图] 截图ID {} 查询失败: file_path={:?}, thumbnail_path={:?}", id, file_path, thumbnail_path);
                let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                    "current": current,
                    "total": total,
                    "screenshot_id": id,
                    "status": "failed"
                }));
                continue;
            }

            let fp = file_path.unwrap();
            let tp = thumbnail_path.unwrap();

            let thumb_pb = std::path::PathBuf::from(&tp);
            if thumb_pb.exists() {
                let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                    "current": current,
                    "total": total,
                    "screenshot_id": id,
                    "status": "skipped"
                }));
                continue;
            }

            let src_pb = std::path::PathBuf::from(&fp);
            if !src_pb.exists() {
                println!("[缩略图] 源文件不存在: {}", fp);
                let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                    "current": current,
                    "total": total,
                    "screenshot_id": id,
                    "status": "failed"
                }));
                continue;
            }

            if let Some(parent) = thumb_pb.parent() {
                if !parent.exists() {
                    let _ = std::fs::create_dir_all(parent);
                }
            }

            match image::open(&src_pb) {
                Ok(img) => {
                    let thumbnail = create_thumbnail(&img, 320);
                    match save_as_jpg(&thumbnail, &thumb_pb, 75) {
                        Ok(_) => {
                            generated += 1;
                            let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                                "current": current,
                                "total": total,
                                "screenshot_id": id,
                                "status": "done"
                            }));
                        }
                        Err(e) => {
                            println!("[缩略图] 保存缩略图失败: {} - {}", tp, e);
                            let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                                "current": current,
                                "total": total,
                                "screenshot_id": id,
                                "status": "failed"
                            }));
                        }
                    }
                }
                Err(e) => {
                    println!("[缩略图] 打开图片失败: {} - {}", fp, e);
                    let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
                        "current": current,
                        "total": total,
                        "screenshot_id": id,
                        "status": "failed"
                    }));
                }
            }
        }

        println!("[缩略图] 后台生成完成: {}/{} 成功", generated, total);
        let _ = app_handle.emit("thumbnail-progress", serde_json::json!({
            "current": total,
            "total": total,
            "screenshot_id": null,
            "status": "complete"
        }));
    });

    Ok(())
}

#[tauri::command]
fn resume_thumbnail_generation(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let ids: Vec<i32> = {
        let conn = state.db.lock().unwrap();
        db::get_screenshots_with_missing_thumbnails(&conn)
            .map_err(|e| format!("查询缺失缩略图失败: {}", e))?
    };
    
    if ids.is_empty() {
        println!("[缩略图] 没有需要恢复生成的缩略图");
        return Ok(());
    }
    
    println!("[缩略图] 发现 {} 个缺失缩略图，开始恢复生成", ids.len());
    generate_thumbnails(ids, app, state)
}

fn process_and_save_image_fast(src: &std::path::PathBuf, dest: &std::path::PathBuf) -> Result<u128, String> {
    let t1 = std::time::Instant::now();
    std::fs::copy(src, dest)
        .map_err(|e| format!("复制图片失败: {}", e))?;
    Ok(t1.elapsed().as_millis())
}

#[tauri::command]
fn get_all_games_with_empty(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT gc.game_id, COALESCE(gc.display_title, gc.game_id) as display_title, 
                gc.steam_logo_path, gc.icon_path,
                COALESCE(s.count, 0) as count,
                COALESCE(s.last_timestamp, gc.last_updated) as last_timestamp,
                COALESCE(gc.rating, -1) as rating
         FROM game_cache gc
         LEFT JOIN (
             SELECT game_id, COUNT(*) as count, MAX(timestamp) as last_timestamp
             FROM screenshots GROUP BY game_id
         ) s ON gc.game_id = s.game_id
         ORDER BY last_timestamp DESC",
    ).map_err(|e| e.to_string())?;

    let iter = stmt.query_map([], |row| {
        Ok(GameSummary {
            game_id: row.get(0)?,
            game_title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            display_title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            game_banner_url: String::new(),
            count: row.get(4)?,
            last_timestamp: row.get(5)?,
            game_icon_path: row.get(3)?,
            steam_logo_path: row.get(2)?,
            rating: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize)]
struct FileMetadata {
    size: u64,
    created: i64,
    modified: i64,
}

#[tauri::command]
fn save_share_image(image_path: String, image_data: String, format: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose};
    
    let decoded = general_purpose::STANDARD
        .decode(&image_data)
        .map_err(|e| format!("Base64解码失败: {}", e))?;
    
    let path = std::path::Path::new(&image_path);
    
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    std::fs::write(path, decoded)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    println!("[分享] 图片已保存: {}", image_path);
    Ok(())
}

#[tauri::command]
fn get_all_screenshot_ids(game_id: Option<String>, state: State<AppState>) -> Result<Vec<i32>, String> {
    let conn = state.db.lock().unwrap();
    db::get_all_screenshot_ids(&conn, game_id.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screenshots_by_ids(ids: Vec<i32>, state: State<AppState>) -> Result<Vec<ScreenshotRecord>, String> {
    let conn = state.db.lock().unwrap();
    db::get_screenshots_by_ids(&conn, &ids)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screenshot_counts_by_date(game_id: String, year: i32, state: State<AppState>) -> Result<std::collections::HashMap<String, i32>, String> {
    let conn = state.db.lock().unwrap();
    db::get_screenshot_counts_by_date(&conn, &game_id, year)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_latest_screenshot_year(game_id: String, state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    db::get_latest_screenshot_year(&conn, &game_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_screenshot_counts_by_date(year: i32, state: State<AppState>) -> Result<std::collections::HashMap<String, i32>, String> {
    let conn = state.db.lock().unwrap();
    db::get_all_screenshot_counts_by_date(&conn, year)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_latest_screenshot_year(state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    db::get_all_latest_screenshot_year(&conn)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn read_files_as_base64(paths: Vec<String>) -> Result<Vec<String>, String> {
    use base64::{Engine as _, engine::general_purpose};
    let mut results = Vec::new();
    for path in paths {
        let data = std::fs::read(&path)
            .map_err(|e| format!("读取文件失败 {}: {}", path, e))?;
        let b64 = general_purpose::STANDARD.encode(&data);
        results.push(b64);
    }
    Ok(results)
}

#[tauri::command]
async fn read_images_for_export(paths: Vec<String>, app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use base64::{Engine as _, engine::general_purpose};
    use std::io::Cursor;

    let total = paths.len();
    let mut results = Vec::with_capacity(total);
    for (i, path_str) in paths.iter().enumerate() {
        let path = std::path::PathBuf::from(path_str);

        let b64 = tokio::task::spawn_blocking(move || {
            use image::imageops::FilterType;
            let img = image::open(&path)
                .map_err(|e| format!("打开图片失败 {}: {}", path.display(), e))?;

            let (w, h) = (img.width(), img.height());
            let max_dim = 1600u32;
            let resized = if w > max_dim || h > max_dim {
                if w >= h {
                    let new_w = max_dim;
                    let new_h = (h as u64 * max_dim as u64 / w as u64) as u32;
                    img.resize_exact(new_w.max(1), new_h.max(1), FilterType::Lanczos3)
                } else {
                    let new_h = max_dim;
                    let new_w = (w as u64 * max_dim as u64 / h as u64) as u32;
                    img.resize_exact(new_w.max(1), new_h.max(1), FilterType::Lanczos3)
                }
            } else {
                img
            };

            let mut buf = Cursor::new(Vec::new());
            resized.write_to(&mut buf, image::ImageFormat::Jpeg)
                .map_err(|e| format!("JPEG编码失败: {}", e))?;
            let jpeg_data = buf.into_inner();
            Ok::<String, String>(general_purpose::STANDARD.encode(&jpeg_data))
        }).await.map_err(|e| format!("图片处理任务失败: {}", e))??;

        results.push(b64);

        let _ = app.emit("export-progress", serde_json::json!({
            "current": i + 1,
            "total": total
        }));
    }
    Ok(results)
}

#[tauri::command]
fn save_export_file(file_path: String, content: String, format: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    if format == "pdf" {
        use base64::{Engine as _, engine::general_purpose};
        let decoded = general_purpose::STANDARD.decode(&content)
            .map_err(|e| format!("Base64解码失败: {}", e))?;
        std::fs::write(path, decoded)
            .map_err(|e| format!("写入文件失败: {}", e))?;
    } else {
        std::fs::write(path, content.as_bytes())
            .map_err(|e| format!("写入文件失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
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

impl std::fmt::Display for SteamMatchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SteamMatchStatus::NotSearched => write!(f, "not_searched"),
            SteamMatchStatus::NotFound => write!(f, "not_found"),
            SteamMatchStatus::Found => write!(f, "found"),
            SteamMatchStatus::Mismatch => write!(f, "mismatch"),
        }
    }
}

fn generate_badge_icon(count: u32, base_icon_bytes: &[u8]) -> Result<tauri::image::Image<'static>, String> {
    use image::{Rgba, DynamicImage};
    use imageproc::drawing::draw_filled_circle_mut;
    use ab_glyph::{FontArc, PxScale, Font, ScaleFont};
    use std::fs;
    
    let base_icon = image::load_from_memory(base_icon_bytes)
        .map_err(|e| format!("无法加载基础图标: {}", e))?;
    
    let mut img = base_icon.to_rgba8();
    let (width, height) = img.dimensions();
    
    if count == 0 {
        let rgba = img.as_raw().clone();
        return Ok(tauri::image::Image::new_owned(rgba, width, height));
    }
    
    let badge_radius = (width as f32 * 0.35) as i32;
    let badge_x = width as i32 - badge_radius - 2;
    let badge_y = badge_radius + 2;
    
    draw_filled_circle_mut(
        &mut img,
        (badge_x as i32, badge_y as i32),
        badge_radius,
        Rgba([220, 38, 38, 255])
    );
    
    let count_str = if count > 99 { "99+".to_string() } else { count.to_string() };
    
    let font = fs::read("C:\\Windows\\Fonts\\arialbd.ttf")
        .ok()
        .and_then(|bytes| FontArc::try_from_vec(bytes).ok())
        .or_else(|| {
            fs::read("C:\\Windows\\Fonts\\arial.ttf")
                .ok()
                .and_then(|bytes| FontArc::try_from_vec(bytes).ok())
        })
        .ok_or_else(|| "无法加载字体".to_string())?;
    
    let scale = PxScale::from(badge_radius as f32 * 1.2);
    let scaled_font = font.as_scaled(scale);
    
    let text_width = count_str.chars().map(|c| {
        scaled_font.h_advance(scaled_font.glyph_id(c))
    }).sum::<f32>();
    
    let text_x = badge_x as f32 - text_width / 2.0;
    let text_y = badge_y as f32 - badge_radius as f32 * 0.4;
    
    imageproc::drawing::draw_text_mut(
        &mut img,
        Rgba([255, 255, 255, 255]),
        text_x as i32,
        text_y as i32,
        scale,
        &font,
        &count_str,
    );
    
    let rgba = img.as_raw().clone();
    Ok(tauri::image::Image::new_owned(rgba, width, height))
}

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    println!("[通知] {}: {}", title, body);
    let _ = app.emit("show-notification", serde_json::json!({
        "title": title,
        "body": body
    }));
}

fn main() {
    println!("[启动] PuddingSnap 启动中...");
    if DEBUG_MODE {
        println!("[调试] 调试模式已开启 - 按 F12 进行测试截图");
    }
    
    // 检查是否有待删除的旧数据目录
    let data_dir = db::get_data_dir();
    let pending_delete_file = data_dir.join(".pending_delete");
    if pending_delete_file.exists() {
        if let Ok(old_dir_path) = std::fs::read_to_string(&pending_delete_file) {
            println!("[启动] 发现待删除的旧目录: {}", old_dir_path);
            let old_dir = std::path::PathBuf::from(&old_dir_path);
            if old_dir.exists() {
                match std::fs::remove_dir_all(&old_dir) {
                    Ok(_) => println!("[启动] 旧目录删除成功: {}", old_dir_path),
                    Err(e) => println!("[启动] 删除旧目录失败: {}", e),
                }
            }
            let _ = std::fs::remove_file(&pending_delete_file);
        }
    }
    
    let db_conn = match db::init_db() {
        Ok(conn) => {
            println!("[启动] 数据库初始化成功");
            conn
        }
        Err(e) => {
            eprintln!("[启动] 数据库初始化失败: {}", e);
            panic!("数据库初始化失败");
        }
    };
    
    let db_arc = Arc::new(Mutex::new(db_conn));
    let settings_cache = {
        let conn = db_arc.lock().unwrap();
        let mut cache = HashMap::new();
        for key in &["shutter_sound", "screenshot_format", "screenshot_quality", "screenshot_notification", "theme", "sort_order", "game_sort_order", "backup_enabled", "data_dir", "emulator_keywords", "window_title_match", "active_hotkeys"] {
            if let Some(value) = db::get_setting(&conn, key) {
                if *key == "emulator_keywords" {
                    let emulator_names: Vec<String> = value.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                    windows_utils::set_custom_emulator_names(emulator_names);
                }
                cache.insert(key.to_string(), value);
            }
        }
        Arc::new(RwLock::new(cache))
    };
    let window_shown = Arc::new(Mutex::new(false));
    let screenshot_queue = Arc::new(Mutex::new(VecDeque::new()));
    let is_processing = Arc::new(Mutex::new(false));
    let unread_count = Arc::new(Mutex::new(0u32));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            println!("[单实例] 检测到另一个实例尝试启动，聚焦当前窗口");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("single-instance-activated", ());
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .manage(AppState { 
            db: db_arc, 
            settings_cache,
            window_shown,
            screenshot_queue,
            is_processing,
            unread_count,
        })
        .setup(move |app| {
            println!("[启动] Tauri应用设置中...");
            
            let app_handle = app.app_handle().clone();
            let state_ref = app.state::<AppState>();
            let window_shown_for_menu = state_ref.window_shown.clone();

            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "关闭", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &settings_item, &quit_item])?;

            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon_image = match image::load_from_memory(icon_bytes) {
                Ok(img) => {
                    println!("[启动] 图标加载成功");
                    img
                }
                Err(e) => {
                    eprintln!("[启动] 图标加载失败: {}", e);
                    panic!("图标加载失败");
                }
            }.to_rgba8();
            let icon_data = icon_image.as_raw();
            let icon = tauri::image::Image::new_owned(icon_data.to_vec(), icon_image.width(), icon_image.height());

            let window_shown_for_tray = window_shown_for_menu.clone();
            let _ = TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            {
                                let mut shown = window_shown_for_menu.lock().unwrap();
                                *shown = true;
                            }
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "settings" => {
                            {
                                let mut shown = window_shown_for_menu.lock().unwrap();
                                *shown = true;
                            }
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("navigate-to-settings", ());
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        {
                            let mut shown = window_shown_for_tray.lock().unwrap();
                            *shown = true;
                        }
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("window-shown", ());
                        }
                    }
                })
                .build(app)?;
            
            println!("[启动] 系统托盘创建成功");

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            let _ = window_clone.emit("close-requested", ());
                        }
                        tauri::WindowEvent::Focused(focused) => {
                            if *focused {
                                let _ = window_clone.emit("window-focused", ());
                            }
                        }
                        _ => {}
                    }
                });
            }

            let state = app.state::<AppState>();
            let queue_clone = state.screenshot_queue.clone();
            let processing_clone = state.is_processing.clone();
            let db_for_hotkey = state.db.clone();
            let window_shown_clone = state.window_shown.clone();
            let unread_count_clone = state.unread_count.clone();
            let settings_cache_for_hotkey = state.settings_cache.clone();

            let (hotkey_tx, hotkey_rx) = mpsc::channel::<HotkeyEvent>();

            {
                let tx = hotkey_tx.clone();
                raw_input::start_raw_input_listener(move |event| {
                    let hotkey = match event {
                        raw_input::RawHotkeyEvent::PrintScreen => HotkeyEvent::PrintScreen,
                        raw_input::RawHotkeyEvent::F11 => HotkeyEvent::F11,
                        raw_input::RawHotkeyEvent::F12 => HotkeyEvent::F12,
                    };
                    let _ = tx.send(hotkey);
                });
            }

            {
                let tx = hotkey_tx.clone();
                keyboard_hook::start_keyboard_hook(move || {
                    let _ = tx.send(HotkeyEvent::PrintScreen);
                });
            }

            let app_handle_hotkey = app_handle.clone();
            let last_hotkey_time = Arc::new(Mutex::new(Instant::now()));
            std::thread::spawn(move || {
                println!("[启动] 热键处理线程启动");

                loop {
                    match hotkey_rx.recv() {
                        Ok(hotkey) => {
                            {
                                let mut last = last_hotkey_time.lock().unwrap();
                                if last.elapsed().as_millis() < 100 {
                                    println!("[去重] 忽略重复热键事件 ({:?})", hotkey);
                                    continue;
                                }
                                *last = Instant::now();
                            }

                            let key_name = match hotkey {
                                HotkeyEvent::PrintScreen => "PrintScreen",
                                HotkeyEvent::F11 => "F11",
                                HotkeyEvent::F12 => "F12",
                            };
                            let total_start = Instant::now();
                            println!("[热键] 检测到{}按键!", key_name);

                            {
                                let cache = settings_cache_for_hotkey.read().unwrap();
                                let active_hotkeys = cache.get("active_hotkeys").cloned().unwrap_or_default();
                                if !active_hotkeys.is_empty() && !active_hotkeys.to_lowercase().split(',').any(|k| k.trim() == key_name.to_lowercase()) {
                                    println!("[热键] {} 未被启用，跳过", key_name);
                                    continue;
                                }
                            }

                            let t = Instant::now();
                            let shutter_sound = {
                                let cache = settings_cache_for_hotkey.read().unwrap();
                                cache.get("shutter_sound").cloned().unwrap_or_else(|| "default".to_string())
                            };
                            println!("[耗时] 读取快门音效设置: {:.2}ms", t.elapsed().as_secs_f64() * 1000.0);

                            let t = Instant::now();
                            let _ = play_shutter_sound_with_type(&shutter_sound);
                            println!("[耗时] 播放快门音效: {:.2}ms", t.elapsed().as_secs_f64() * 1000.0);

                            let t = Instant::now();
                            let process_info = get_foreground_process_info();
                            println!("[耗时] 获取前台进程信息: {:.2}ms", t.elapsed().as_secs_f64() * 1000.0);
                            println!("[截图] 进程: {}, exe: {:?}", process_info.process_name, process_info.exe_path);

                            let window_title_match_enabled = {
                                let cache = settings_cache_for_hotkey.read().unwrap();
                                cache.get("window_title_match")
                                    .and_then(|v| v.parse::<bool>().ok())
                                    .unwrap_or(true)
                            };

                            let window_title = {
                                let title = windows_utils::get_foreground_window_title();
                                if let Some(ref t) = title {
                                    println!("[截图] 窗口标题: {}", t);
                                }
                                if window_title_match_enabled {
                                    title
                                } else {
                                    if title.is_some() && windows_utils::is_emulator_process(&process_info.process_name) {
                                        title
                                    } else {
                                        if title.is_some() {
                                            println!("[截图] 窗口标题匹配未启用，继续捕获窗口标题(用于界面命名)");
                                            title
                                        } else {
                                            None
                                        }
                                    }
                                }
                            };

                            let t = Instant::now();
                            let steam_appid = get_steam_running_appid();
                            println!("[耗时] 获取Steam RunningAppID: {:.2}ms", t.elapsed().as_secs_f64() * 1000.0);
                            let steam_appid = if let Some(appid) = steam_appid {
                                let matches = if let Some(ref exe_path) = process_info.exe_path {
                                    windows_utils::verify_steam_appid_for_process(appid, exe_path)
                                } else {
                                    false
                                };
                                if matches {
                                    println!("[Steam] 检测到Steam运行游戏, AppID: {}", appid);
                                    Some(appid)
                                } else {
                                    println!("[Steam] 检测到Steam RunningAppID={} 但前台进程不匹配，忽略", appid);
                                    None
                                }
                            } else {
                                None
                            };

                            let t = Instant::now();
                            let is_retroarch = retroarch::is_retroarch_process(&process_info.process_name);
                            let (capture_result, retroarch_screenshot_path, retroarch_game_title) = if is_retroarch {
                                if let Some(ref exe_path) = process_info.exe_path {
                                    println!("[RetroArch] 检测到RetroArch进程，使用RetroArch自带截图 (PID: {})", process_info.pid);
                                    match retroarch::capture_retroarch_screenshot(exe_path, process_info.pid) {
                                        Ok(result) => {
                                            let game_title = retroarch::parse_game_title_from_filename(&result.screenshot_path);
                                            (Ok(result.image), Some(result.screenshot_path.to_string_lossy().to_string()), game_title)
                                        }
                                        Err(e) => (Err(e), None, None),
                                    }
                                } else {
                                    println!("[RetroArch] 检测到RetroArch进程但无法获取exe路径，回退到系统截图");
                                    (capture_screenshot(false).map_err(|e| e.to_string()), None, None)
                                }
                            } else {
                                (capture_screenshot(false).map_err(|e| e.to_string()), None, None)
                            };

                            let window_title = if is_retroarch {
                                retroarch_game_title.or(window_title)
                            } else {
                                window_title
                            };

                            let steam_appid = if is_retroarch { None } else { steam_appid };

                            match capture_result {
                                Ok(image) => {
                                    println!("[耗时] 屏幕捕获: {:.2}ms (RetroArch模式: {})", t.elapsed().as_secs_f64() * 1000.0, is_retroarch);

                                    let task = ScreenshotTask {
                                        image,
                                        exe_path: process_info.exe_path,
                                        process_name: process_info.process_name,
                                        steam_appid,
                                        window_title,
                                        window_title_match_enabled,
                                        retroarch_screenshot_path,
                                    };

                                    {
                                        let mut queue = queue_clone.lock().unwrap();
                                        queue.push_back(task);
                                        println!("[队列] 任务已加入队列，当前队列长度: {}", queue.len());
                                    }

                                    let app_h = app_handle_hotkey.clone();
                                    let db_h = db_for_hotkey.clone();
                                    let queue_h = queue_clone.clone();
                                    let processing_h = processing_clone.clone();
                                    let window_shown_h = window_shown_clone.clone();
                                    let unread_count_h = unread_count_clone.clone();
                                    let settings_cache_h = settings_cache_for_hotkey.clone();
                                    let settings_cache_for_notify = settings_cache_for_hotkey.clone();

                                    let mut processing = processing_h.lock().unwrap();
                                    if *processing {
                                        println!("[队列] 已有任务在处理中，跳过");
                                        continue;
                                    }
                                    *processing = true;
                                    drop(processing);

                                    std::thread::spawn(move || {
                                        loop {
                                            let task = {
                                                let mut q = queue_h.lock().unwrap();
                                                q.pop_front()
                                            };

                                            if let Some(task) = task {
                                                println!("[队列] 处理任务: {}", task.process_name);

                                                let exe_path_ref = task.exe_path.as_deref();

                                                let db_clone_for_id = db_h.clone();
                                                let conn_for_id = db_clone_for_id.lock().unwrap();
                                                let (game_id, is_existing) = db::find_existing_game_id(&conn_for_id, &task.process_name, exe_path_ref, task.steam_appid, task.window_title.as_deref());
                                                drop(conn_for_id);
                                                println!("[队列] 使用游戏ID: {} (进程名: {}, 已存在: {})", game_id, task.process_name, is_existing);

                                                let game_dir = db::get_game_dir(&game_id);
                                                let thumbnails_dir = game_dir.join("thumbnails");
                                                if !thumbnails_dir.exists() {
                                                    let _ = std::fs::create_dir_all(&thumbnails_dir);
                                                }

                                                let screenshot_format = {
                                                    let cache = settings_cache_h.read().unwrap();
                                                    cache.get("screenshot_format").cloned().unwrap_or_else(|| "webp".to_string())
                                                };
                                                let screenshot_quality = {
                                                    let cache = settings_cache_h.read().unwrap();
                                                    cache.get("screenshot_quality").cloned().unwrap_or_else(|| "medium".to_string())
                                                };

                                                let filename = generate_filename_with_format(&screenshot_format);
                                                let thumbnail_filename = generate_thumbnail_filename();

                                                let filepath = game_dir.join(&filename);
                                                let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);

                                                match save_image(&task.image, &filepath, &screenshot_format, &screenshot_quality) {
                                                    Ok(_) => {
                                                        println!("[截图] 图片保存成功: {:?}", filepath);
                                                        println!("[截图] 文件大小: {} bytes", std::fs::metadata(&filepath).map(|m| m.len()).unwrap_or(0));

                                                        let thumbnail = create_thumbnail(&task.image, 320);
                                                        match save_as_webp(&thumbnail, &thumbnail_path, 70.0) {
                                                            Ok(_) => println!("[截图] 缩略图保存成功: {:?}", thumbnail_path),
                                                            Err(e) => println!("[截图] 缩略图保存失败: {}", e),
                                                        }

                                                        let timestamp = chrono::Utc::now().timestamp();

                                                        let db_clone = db_h.clone();
                                                        let conn = db_clone.lock().unwrap();

                                                        let cached_display_title = db::get_game_cache(&conn, &game_id)
                                                            .and_then(|c| c.display_title)
                                                            .filter(|t| !t.is_empty() && t != &game_id);

                                                        let display_title = if let Some(title) = cached_display_title {
                                                            title
                                                        } else if let Some(ref wt) = task.window_title {
                                                            if windows_utils::is_emulator_process(&task.process_name) {
                                                                let extracted = windows_utils::extract_game_name_from_title(wt, &task.process_name);
                                                                println!("[游戏名] 模拟器窗口标题提取: {} -> {}", wt, extracted);
                                                                extracted
                                                            } else {
                                                                let cleaned = windows_utils::clean_window_title(wt);
                                                                if cleaned.is_empty() {
                                                                    task.process_name.clone()
                                                                } else {
                                                                    println!("[游戏名] 窗口标题清理: {} -> {}", wt, cleaned);
                                                                    cleaned
                                                                }
                                                            }
                                                        } else if let Some(ref exe_path) = task.exe_path {
                                                            if let Some(folder_name) = windows_utils::get_game_folder_name(exe_path) {
                                                                let cleaned = windows_utils::clean_game_name(&folder_name);
                                                                println!("[游戏名] 清理文件夹名: {} -> {}", folder_name, cleaned);
                                                                cleaned
                                                            } else {
                                                                task.process_name.clone()
                                                            }
                                                        } else {
                                                            task.process_name.clone()
                                                        };

                                                        if let (Some(file_path_str), Some(thumb_path_str)) = (filepath.to_str(), thumbnail_path.to_str()) {
                                                            println!("[数据库] 准备插入截图记录: game_id={}, display_title={}", game_id, display_title);
                                                            match db::insert_screenshot(&conn, file_path_str, thumb_path_str, &game_id, &display_title, timestamp, None) {
                                                                Ok(id) => {
                                                                    println!("[数据库] 截图记录插入成功: id={}, game_id={}", id, game_id);

                                                                    let has_icon = db::get_game_cache(&conn, &game_id)
                                                                        .and_then(|c| c.icon_path)
                                                                        .map(|p| std::path::Path::new(&p).exists())
                                                                        .unwrap_or(false);

                                                                    let should_skip_steam = db::get_game_cache(&conn, &game_id)
                                                                        .and_then(|c| c.steam_match_status)
                                                                        .map(|s| s == "manual" || s == "found")
                                                                        .unwrap_or(false);

                                                                    drop(conn);

                                                                    {
                                                                         let mut count = unread_count_h.lock().unwrap();
                                                                         *count += 1;
                                                                         let current_count = *count;
                                                                         println!("[托盘] 未读数量更新: {}", current_count);

                                                                         let icon_bytes = include_bytes!("../icons/32x32.png");
                                                                         match generate_badge_icon(current_count, icon_bytes) {
                                                                             Ok(badge_icon) => {
                                                                                 if let Some(tray) = app_h.tray_by_id("main") {
                                                                                     match tray.set_icon(Some(badge_icon)) {
                                                                                         Ok(_) => println!("[托盘] 图标更新成功"),
                                                                                         Err(e) => println!("[托盘] 图标更新失败: {}", e),
                                                                                     }
                                                                                 } else {
                                                                                     println!("[托盘] 未找到托盘图标");
                                                                                 }
                                                                             }
                                                                             Err(e) => println!("[托盘] 生成徽章图标失败: {}", e),
                                                                         }
                                                                     }

                                                                    {
                                                                        let notify_enabled = {
                                                                            let cache = settings_cache_for_notify.read().unwrap();
                                                                            cache.get("screenshot_notification")
                                                                                .and_then(|v| v.parse::<bool>().ok())
                                                                                .unwrap_or(true)
                                                                        };
                                                                        if notify_enabled {
                                                                            use tauri_plugin_notification::NotificationExt;
                                                                            let _ = app_h.notification().builder()
                                                                                .title("截图成功")
                                                                                .body("截图已保存到本地")
                                                                                .show();
                                                                            println!("[通知] 系统通知已发送");
                                                                        }
                                                                    }

                                                                    let is_window_shown = {
                                                                        let shown = window_shown_h.lock().unwrap();
                                                                        *shown
                                                                    };
                                                                    println!("[事件] 窗口显示状态: {}", is_window_shown);
                                                                    if is_window_shown {
                                                                        println!("[事件] 发送screenshot-taken事件, game_id={}", game_id);
                                                                        match app_h.emit("screenshot-taken", serde_json::json!({
                                                                            "game_id": game_id
                                                                        })) {
                                                                            Ok(_) => println!("[事件] 事件发送成功"),
                                                                            Err(e) => println!("[事件] 事件发送失败: {}", e),
                                                                        }
                                                                    } else {
                                                                        println!("[事件] 窗口未显示，跳过前端事件发送");
                                                                    }

                                                                    if !has_icon {
                                                                        let db_for_icon = db_clone.clone();
                                                                        let exe_path_for_icon = task.exe_path.clone();
                                                                        let game_id_for_icon = game_id.clone();
                                                                        std::thread::spawn(move || {
                                                                            if let Some(exe_path) = exe_path_for_icon {
                                                                                let icons_dir = db::get_icons_dir();
                                                                                let icon_path = icons_dir.join(format!("{}.png", game_id_for_icon));

                                                                                if let Ok(_) = extract_icon_from_exe(&exe_path, &icon_path) {
                                                                                    let icon_path_str = icon_path.to_string_lossy().to_string();
                                                                                    let conn = db_for_icon.lock().unwrap();
                                                                                    if db::get_game_cache(&conn, &game_id_for_icon).is_some() {
                                                                                        let _ = db::update_game_icon(&conn, &game_id_for_icon, Some(&exe_path), Some(&icon_path_str));
                                                                                    } else {
                                                                                        let cache = GameCache {
                                                                                            game_id: game_id_for_icon.clone(),
                                                                                            exe_path: Some(exe_path),
                                                                                            icon_path: Some(icon_path_str),
                                                                                            display_title: None,
                                                                                            last_updated: chrono::Utc::now().timestamp(),
                                                                                            steam_appid: None,
                                                                                            steam_name: None,
                                                                                            steam_logo_path: None,
                                                                                            steam_match_status: None,
                                                                                            rating: Some(-1),
                                                                                        };
                                                                                        let _ = db::set_game_cache(&conn, &cache);
                                                                                    }
                                                                                    println!("[图标] 游戏图标提取成功: {}", game_id_for_icon);
                                                                                }
                                                                            }
                                                                        });
                                                                    }

                                                                    if task.retroarch_screenshot_path.is_some() && !is_existing {
                                                                        let img = &task.image;
                                                                        let logos_dir = steam::get_steam_logos_dir();
                                                                        let logo_filename = format!("manual_{}.jpg", game_id);
                                                                        let logo_path = logos_dir.join(&logo_filename);

                                                                        let max_width = 460u32;
                                                                        let max_height = 215u32;
                                                                        let (width, height) = (img.width(), img.height());
                                                                        let resized = if width > max_width || height > max_height {
                                                                            let ratio = (max_width as f64 / width as f64)
                                                                                .min(max_height as f64 / height as f64);
                                                                            let new_w = (width as f64 * ratio) as u32;
                                                                            let new_h = (height as f64 * ratio) as u32;
                                                                            img.thumbnail(new_w, new_h)
                                                                        } else {
                                                                            img.clone()
                                                                        };

                                                                        if let Ok(_) = resized.save(&logo_path) {
                                                                            let logo_path_str = logo_path.to_string_lossy().to_string();
                                                                            let conn = db_clone.lock().unwrap();
                                                                            if db::get_game_cache(&conn, &game_id).is_some() {
                                                                                let _ = db::set_manual_game_info(&conn, &game_id, &display_title, Some(&logo_path_str));
                                                                            } else {
                                                                                let cache = GameCache {
                                                                                    game_id: game_id.clone(),
                                                                                    exe_path: task.exe_path.clone(),
                                                                                    icon_path: None,
                                                                                    display_title: Some(display_title.clone()),
                                                                                    last_updated: chrono::Utc::now().timestamp(),
                                                                                    steam_appid: None,
                                                                                    steam_name: Some(display_title.clone()),
                                                                                    steam_logo_path: Some(logo_path_str),
                                                                                    steam_match_status: Some("manual".to_string()),
                                                                                    rating: Some(-1),
                                                                                };
                                                                                let _ = db::set_game_cache(&conn, &cache);
                                                                            }
                                                                            let _ = db::update_game_display_title(&conn, &game_id, &display_title);
                                                                            drop(conn);
                                                                            println!("[RetroArch] 截图缩略图已生成: {:?}", logo_path);
                                                                        }
                                                                    } else if !is_existing && !should_skip_steam {
                                                                        let db_for_steam = db_clone.clone();
                                                                        let game_id_for_steam = game_id.clone();
                                                                        let process_name_for_steam = task.process_name.clone();
                                                                        let steam_appid_for_steam = task.steam_appid;
                                                                        let window_title_for_steam = task.window_title.clone();
                                                                        let window_title_match_for_steam = task.window_title_match_enabled;
                                                                        std::thread::spawn(move || {
                                                                        if let Some(appid) = steam_appid_for_steam {
                                                                            if appid > 0 {
                                                                                println!("[Steam] 阶段A: 通过RunningAppID直接匹配, AppID={}", appid);
                                                                                match steam::get_steam_app_details(appid, "schinese") {
                                                                                    Ok(Some(info)) => {
                                                                                        let logos_dir = steam::get_steam_logos_dir();
                                                                                        let logo_filename = format!("steam_{}.jpg", info.appid);
                                                                                        let logo_path = logos_dir.join(&logo_filename);

                                                                                        let logo_url = info.header_image.as_ref()
                                                                                            .or(info.capsule_image.as_ref())
                                                                                            .map(|s| s.as_str());

                                                                                        let mut logo_path_str = None;
                                                                                        if let Some(url) = logo_url {
                                                                                            if let Err(e) = steam::download_steam_image(url, &logo_path) {
                                                                                                println!("[Steam] 自动下载logo失败: {}", e);
                                                                                            } else {
                                                                                                logo_path_str = Some(logo_path.to_string_lossy().to_string());
                                                                                            }
                                                                                        }

                                                                                        let conn = db_for_steam.lock().unwrap();
                                                                                        if db::get_game_cache(&conn, &game_id_for_steam).is_some() {
                                                                                            let _ = db::update_game_steam_info_auto(
                                                                                                &conn, &game_id_for_steam,
                                                                                                Some(info.appid), Some(&info.name),
                                                                                                logo_path_str.as_deref(), Some("found"),
                                                                                                Some(&info.name),
                                                                                            );
                                                                                        } else {
                                                                                            let existing_icon = db::get_game_icon_path(&conn, &game_id_for_steam);
                                                                                            let cache = GameCache {
                                                                                                game_id: game_id_for_steam.clone(),
                                                                                                exe_path: None,
                                                                                                icon_path: existing_icon,
                                                                                                display_title: Some(info.name.clone()),
                                                                                                last_updated: chrono::Utc::now().timestamp(),
                                                                                                steam_appid: Some(info.appid),
                                                                                                steam_name: Some(info.name.clone()),
                                                                                                steam_logo_path: logo_path_str.clone(),
                                                                                                steam_match_status: Some("found".to_string()),
                                                                                                rating: Some(-1),
                                                                                            };
                                                                                            let _ = db::set_game_cache(&conn, &cache);
                                                                                        }

                                                                                        if let Err(e) = db::update_game_display_title(&conn, &game_id_for_steam, &info.name) {
                                                                                            println!("[Steam] 自动更新显示标题失败: {}", e);
                                                                                        }

                                                                                        println!("[Steam] 阶段A匹配成功: AppID={} -> {}", appid, info.name);
                                                                                        return;
                                                                                    }
                                                                                    _ => {
                                                                                        println!("[Steam] 阶段A: RunningAppID={} 但API未找到详情，回退到阶段B", appid);
                                                                                    }
                                                                                }
                                                                            }
                                                                        }

                                                                        let steam_search_name = if let Some(ref wt) = window_title_for_steam {
                                                                            if windows_utils::is_emulator_process(&process_name_for_steam) {
                                                                                let extracted = windows_utils::extract_game_name_from_title(wt, &process_name_for_steam);
                                                                                println!("[Steam] 阶段B: 模拟器窗口标题提取: {} -> {}", wt, extracted);
                                                                                extracted
                                                                            } else if window_title_match_for_steam {
                                                                                let cleaned = windows_utils::clean_window_title(wt);
                                                                                if cleaned.is_empty() {
                                                                                    println!("[Steam] 阶段B: 窗口标题清理后为空，使用进程名: {}", process_name_for_steam);
                                                                                    process_name_for_steam.clone()
                                                                                } else {
                                                                                    println!("[Steam] 阶段B: 窗口标题匹配: {} -> {}", wt, cleaned);
                                                                                    cleaned
                                                                                }
                                                                            } else {
                                                                                println!("[Steam] 阶段B: 窗口标题匹配未启用，使用进程名: {}", process_name_for_steam);
                                                                                process_name_for_steam.clone()
                                                                            }
                                                                        } else {
                                                                            process_name_for_steam.clone()
                                                                        };

                                                                        println!("[Steam] 阶段B: 匹配名称: {}", steam_search_name);
                                                                        let result = steam::match_game_name(&steam_search_name, "schinese");

                                                                        if result.status == SteamMatchStatus::Found {
                                                                            if let Some(ref info) = result.game_info {
                                                                                let logos_dir = steam::get_steam_logos_dir();
                                                                                let logo_filename = format!("steam_{}.jpg", info.appid);
                                                                                let logo_path = logos_dir.join(&logo_filename);

                                                                                let logo_url = info.header_image.as_ref()
                                                                                    .or(info.capsule_image.as_ref())
                                                                                    .map(|s| s.as_str());

                                                                                let mut logo_path_str = None;
                                                                                if let Some(url) = logo_url {
                                                                                    if let Err(e) = steam::download_steam_image(url, &logo_path) {
                                                                                        println!("[Steam] 自动下载logo失败: {}", e);
                                                                                    } else {
                                                                                        logo_path_str = Some(logo_path.to_string_lossy().to_string());
                                                                                    }
                                                                                }

                                                                                let conn = db_for_steam.lock().unwrap();
                                                                                if db::get_game_cache(&conn, &game_id_for_steam).is_some() {
                                                                                    let _ = db::update_game_steam_info_auto(
                                                                                        &conn, &game_id_for_steam,
                                                                                        Some(info.appid), Some(&info.name),
                                                                                        logo_path_str.as_deref(), Some("found"),
                                                                                        Some(&info.name),
                                                                                    );
                                                                                } else {
                                                                                    let existing_icon = db::get_game_icon_path(&conn, &game_id_for_steam);
                                                                                    let cache = GameCache {
                                                                                        game_id: game_id_for_steam.clone(),
                                                                                        exe_path: None,
                                                                                        icon_path: existing_icon,
                                                                                        display_title: Some(info.name.clone()),
                                                                                        last_updated: chrono::Utc::now().timestamp(),
                                                                                        steam_appid: Some(info.appid),
                                                                                        steam_name: Some(info.name.clone()),
                                                                                        steam_logo_path: logo_path_str.clone(),
                                                                                        steam_match_status: Some("found".to_string()),
                                                                                        rating: Some(-1),
                                                                                    };
                                                                                    let _ = db::set_game_cache(&conn, &cache);
                                                                                }

                                                                                if let Err(e) = db::update_game_display_title(&conn, &game_id_for_steam, &info.name) {
                                                                                    println!("[Steam] 自动更新显示标题失败: {}", e);
                                                                                }

                                                                                println!("[Steam] 阶段B匹配成功: {} -> {}", steam_search_name, info.name);
                                                                            }
                                                                        } else {
                                                                            let conn = db_for_steam.lock().unwrap();
                                                                            let match_status_str = result.status.to_string();
                                                                            let fallback_title = if let Some(ref wt) = window_title_for_steam {
                                                                                let cleaned = windows_utils::clean_window_title(wt);
                                                                                if cleaned.is_empty() { process_name_for_steam.clone() } else { cleaned }
                                                                            } else {
                                                                                process_name_for_steam.clone()
                                                                            };
                                                                            if db::get_game_cache(&conn, &game_id_for_steam).is_some() {
                                                                                let _ = db::update_game_steam_info_auto(
                                                                                    &conn, &game_id_for_steam,
                                                                                    None, None, None,
                                                                                    Some(&match_status_str),
                                                                                    Some(&fallback_title),
                                                                                );
                                                                            } else {
                                                                                let existing_icon = db::get_game_icon_path(&conn, &game_id_for_steam);
                                                                                let cache = GameCache {
                                                                                    game_id: game_id_for_steam.clone(),
                                                                                    exe_path: None,
                                                                                    icon_path: existing_icon,
                                                                                    display_title: Some(fallback_title.clone()),
                                                                                    last_updated: chrono::Utc::now().timestamp(),
                                                                                    steam_appid: None,
                                                                                    steam_name: None,
                                                                                    steam_logo_path: None,
                                                                                    steam_match_status: Some(match_status_str.clone()),
                                                                                    rating: Some(-1),
                                                                                };
                                                                                let _ = db::set_game_cache(&conn, &cache);
                                                                            }

                                                                            if let Err(e) = db::update_game_display_title(&conn, &game_id_for_steam, &fallback_title) {
                                                                                println!("[Steam] 更新显示标题失败: {}", e);
                                                                            }

                                                                            println!("[Steam] 阶段B匹配结果: {} -> {} (使用标题作为显示名)", steam_search_name, match_status_str);
                                                                        }
                                                                    });
                                                                    }
                                                                }
                                                                Err(e) => {
                                                                    println!("[数据库] 截图记录插入失败: {}", e);
                                                                }
                                                            }
                                                        }
                                                    }
                                                    Err(e) => {
                                                        println!("[截图] WebP保存失败: {}", e);
                                                    }
                                                }
                                            } else {
                                                break;
                                            }
                                        }

                                        let mut processing = processing_h.lock().unwrap();
                                        *processing = false;
                                        println!("[队列] 处理完成");
                                    });
                                }
                                Err(e) => {
                                    println!("[截图] 屏幕捕获失败: {}", e);
                                }
                            }

                            println!("[耗时] 本次热键处理总耗时: {:.2}ms", total_start.elapsed().as_secs_f64() * 1000.0);
                        }
                        Err(e) => {
                            eprintln!("[热键] 处理通道断开: {:?}", e);
                            break;
                        }
                    }
                }
                println!("[热键] 处理线程退出");
            });

            println!("[启动] 应用设置完成!");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screenshots,
            get_screenshots_with_pagination,
            get_games,
            get_games_with_pagination,
            search_all_games,
            delete_screenshot,
            delete_screenshots,
            update_note,
            get_storage_path,
            migrate_data,
            check_data_directory,
            switch_data_directory,
            get_shutter_sound,
            set_shutter_sound,
            play_sound_preview,
            get_setting,
            set_setting,
            log_debug,
            show_window,
            hide_window,
            show_main_window,
            minimize_to_tray,
            close_app,
            reset_unread_count,
            open_in_explorer,
            get_game_icon,
            extract_game_icon,
            delete_all_data,
            restart_app,
            search_steam_game_info,
            search_steam_games,
            apply_steam_game_info,
            create_game_from_steam,
            update_game_steam_info,
            save_manual_game_info,
            update_game_rating,
            search_bangumi_games,
            create_game_from_bangumi,
            apply_bangumi_game_info,
            save_bangumi_auth,
            get_bangumi_auth,
            delete_game,
            delete_games,
            get_game_screenshot_count,
            import_screenshots,
            get_all_games_with_empty,
            get_file_metadata,
            save_share_image,
            perform_backup,
            get_last_backup_time,
            get_backup_enabled,
            set_backup_enabled,
            get_deleted_screenshots,
            restore_screenshot,
            restore_screenshots,
            permanent_delete_screenshot,
            permanent_delete_screenshots,
            cleanup_expired_deleted,
            get_deleted_screenshots_count,
            get_screenshot_notification,
            set_screenshot_notification,
            generate_thumbnails,
            resume_thumbnail_generation,
            get_all_deleted_screenshot_ids,
            get_all_screenshot_ids,
            get_screenshots_by_ids,
            get_screenshot_counts_by_date,
            get_latest_screenshot_year,
            get_all_screenshot_counts_by_date,
            get_all_latest_screenshot_year,
            read_files_as_base64,
            read_images_for_export,
            save_export_file,
            get_cjk_font_base64
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
