#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod windows_utils;
mod screenshot;
mod audio;
mod steam;

use std::sync::{Arc, Mutex};
use std::collections::VecDeque;
use image::DynamicImage;
use tauri::{Manager, State, Emitter, AppHandle, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
use rdev::{listen, Event, EventType, Key};
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
}

struct AppState {
    db: Arc<Mutex<rusqlite::Connection>>,
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
fn delete_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    if let Ok(ss_list) = db::get_screenshots(&conn, None, "desc") {
        if let Some(ss) = ss_list.iter().find(|s| s.id == id) {
            println!("[删除] 删除截图文件: {:?}", ss.file_path);
            if let Err(e) = std::fs::remove_file(&ss.file_path) {
                println!("[删除] 删除截图文件失败: {}", e);
            }
            println!("[删除] 删除缩略图文件: {:?}", ss.thumbnail_path);
            if let Err(e) = std::fs::remove_file(&ss.thumbnail_path) {
                println!("[删除] 删除缩略图文件失败: {}", e);
            }
        } else {
            println!("[删除] 未找到ID为 {} 的截图记录", id);
        }
    }

    db::delete_screenshot(&conn, id).map_err(|e| e.to_string())
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
    state: State<AppState>,
) -> Result<PaginationResult, String> {
    let conn = state.db.lock().unwrap();
    let gid_ref = game_id.as_deref();
    db::get_screenshots_with_pagination(&conn, gid_ref, &sort_order, page, page_size).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_screenshots(ids: Vec<i32>, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    
    if let Ok(ss_list) = db::get_screenshots(&conn, None, "desc") {
        for id in &ids {
            if let Some(ss) = ss_list.iter().find(|s| s.id == *id) {
                println!("[批量删除] 删除截图文件: {:?}", ss.file_path);
                if let Err(e) = std::fs::remove_file(&ss.file_path) {
                    println!("[批量删除] 删除截图文件失败: {}", e);
                }
                println!("[批量删除] 删除缩略图文件: {:?}", ss.thumbnail_path);
                if let Err(e) = std::fs::remove_file(&ss.thumbnail_path) {
                    println!("[批量删除] 删除缩略图文件失败: {}", e);
                }
            }
        }
    }

    db::delete_screenshots(&conn, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_storage_path() -> Result<String, String> {
    Ok(db::get_storage_path())
}

#[tauri::command]
async fn migrate_data(app: AppHandle, new_path: String, state: State<'_, AppState>) -> Result<MigrationResult, String> {
    let old_data_dir = db::get_data_dir();
    let new_data_dir = std::path::PathBuf::from(&new_path);
    
    println!("[迁移] 从 {:?} 迁移到 {:?}", old_data_dir, new_data_dir);
    
    if !new_data_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&new_data_dir) {
            return Ok(MigrationResult {
                success: false,
                error: Some(format!("无法创建新目录: {}", e)),
                stats: None,
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
        });
    }
    
    let _ = app.emit("migration-progress", MigrationProgress { current: stats.copied_files, total: stats.total_files, status: "迁移完成".to_string() });
    
    db::save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 迁移完成: {} 文件, {} 字节", stats.copied_files, stats.total_size);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: Some(stats),
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
fn check_data_directory(path: String) -> Result<db::DirectoryCheckResult, String> {
    Ok(db::check_data_directory(&path))
}

#[tauri::command]
fn switch_data_directory(new_path: String) -> Result<MigrationResult, String> {
    db::switch_data_directory(&new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_capture_mouse(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().unwrap();
    Ok(db::get_capture_mouse(&conn))
}

#[tauri::command]
fn set_capture_mouse(enabled: bool, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    db::set_capture_mouse(&conn, enabled).map_err(|e| e.to_string())
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
    let conn = state.db.lock().unwrap();
    db::set_setting(&conn, &key, &value).map_err(|e| e.to_string())
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
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.emit("window-shown", ());
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
fn search_steam_game_info(game_id: String, game_title: String, language: String, state: State<AppState>) -> Result<SteamMatchResult, String> {
    println!("[Steam] 搜索游戏信息: {} ({}) (语言: {})", game_title, game_id, language);
    
    let result = steam::match_game_name(&game_title, &language);
    
    if result.status == SteamMatchStatus::Found {
        if let Some(ref info) = result.game_info {
            let conn = state.db.lock().unwrap();
            
            let logos_dir = steam::get_steam_logos_dir();
            let logo_filename = format!("steam_{}.jpg", info.appid);
            let logo_path = logos_dir.join(&logo_filename);
            
            let logo_url = info.header_image.as_ref()
                .or(info.capsule_image.as_ref())
                .map(|s| s.as_str());
            
            let mut logo_path_str = None;
            if let Some(url) = logo_url {
                if let Err(e) = steam::download_steam_image(url, &logo_path) {
                    println!("[Steam] 下载logo失败: {}", e);
                } else {
                    logo_path_str = Some(logo_path.to_string_lossy().to_string());
                }
            }
            
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
    let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or(GameCache {
        game_id: game_id.clone(),
        exe_path: None,
        icon_path: None,
        display_title: None,
        last_updated: chrono::Utc::now().timestamp(),
        steam_appid: None,
        steam_name: None,
        steam_logo_path: None,
        steam_match_status: Some(result.status.clone().to_string()),
    });
    
    cache.steam_match_status = Some(result.status.clone().to_string());
    cache.last_updated = chrono::Utc::now().timestamp();
    
    if let Err(e) = db::set_game_cache(&conn, &cache) {
        println!("[Steam] 保存缓存失败: {}", e);
    }
    
    Ok(result)
}

#[tauri::command]
fn search_steam_games(search_term: String, language: String) -> Result<Vec<SteamSearchResult>, String> {
    println!("[Steam] 手动搜索游戏: {} (语言: {})", search_term, language);
    steam::search_steam_games_with_images(&search_term, &language)
}

#[tauri::command]
fn apply_steam_game_info(game_id: String, appid: u32, language: String, state: State<AppState>) -> Result<SteamGameInfo, String> {
    println!("[Steam] 应用游戏信息: {} -> {} (语言: {})", game_id, appid, language);
    
    let info = steam::get_steam_app_details(appid, &language)?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let conn = state.db.lock().unwrap();
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    let mut logo_path_str = None;
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image(url, &logo_path) {
            println!("[Steam] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
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
fn create_game_from_steam(
    appid: u32,
    game_name: String,
    language: String,
    state: State<AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 从Steam创建游戏: {} ({})", game_name, appid);
    
    let game_id = format!("steam_{}", appid);
    
    let conn = state.db.lock().unwrap();
    
    if db::get_game_cache(&conn, &game_id).is_some() {
        return Err("游戏已存在".to_string());
    }
    
    let info = steam::get_steam_app_details(appid, &language)?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image(url, &logo_path) {
            println!("[游戏] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
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
    })
}

#[tauri::command]
fn update_game_steam_info(
    game_id: String,
    appid: u32,
    game_name: String,
    language: String,
    state: State<AppState>,
) -> Result<GameSummary, String> {
    println!("[游戏] 更新游戏Steam信息: {} -> {} ({})", game_id, game_name, appid);
    
    let conn = state.db.lock().unwrap();
    
    let info = steam::get_steam_app_details(appid, &language)?
        .ok_or_else(|| format!("未找到 Steam 游戏: {}", appid))?;
    
    let logos_dir = steam::get_steam_logos_dir();
    let logo_filename = format!("steam_{}.jpg", info.appid);
    let logo_path = logos_dir.join(&logo_filename);
    
    let mut logo_path_str = None;
    let logo_url = info.header_image.as_ref()
        .or(info.capsule_image.as_ref())
        .map(|s| s.as_str());
    
    if let Some(url) = logo_url {
        if let Err(e) = steam::download_steam_image(url, &logo_path) {
            println!("[游戏] 下载logo失败: {}", e);
        } else {
            logo_path_str = Some(logo_path.to_string_lossy().to_string());
        }
    }
    
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
    })
}

#[tauri::command]
fn delete_game(game_id: String, state: State<AppState>) -> Result<(), String> {
    println!("[游戏] 删除游戏: {}", game_id);
    
    let conn = state.db.lock().unwrap();
    
    if let Ok(ss_list) = db::get_screenshots(&conn, Some(&game_id), "desc") {
        for ss in ss_list {
            let _ = std::fs::remove_file(&ss.file_path);
            let _ = std::fs::remove_file(&ss.thumbnail_path);
        }
    }
    
    db::delete_game(&conn, &game_id).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_games(game_ids: Vec<String>, state: State<AppState>) -> Result<(), String> {
    println!("[游戏] 批量删除 {} 个游戏", game_ids.len());
    
    let conn = state.db.lock().unwrap();
    
    for game_id in &game_ids {
        if let Ok(ss_list) = db::get_screenshots(&conn, Some(game_id), "desc") {
            for ss in ss_list {
                let _ = std::fs::remove_file(&ss.file_path);
                let _ = std::fs::remove_file(&ss.thumbnail_path);
            }
        }
    }
    
    db::delete_games(&conn, &game_ids).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn get_game_screenshot_count(game_id: String, state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    db::get_game_screenshot_count(&conn, &game_id).map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct ImportFileInfo {
    path: String,
    name: String,
    size: u64,
    created: i64,
}

#[derive(Debug, serde::Serialize)]
struct ImportResult {
    success: bool,
    imported_count: u32,
    skipped_count: u32,
    failed_count: u32,
    duration_ms: u64,
    error: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
struct ImportProgress {
    current: u32,
    total: u32,
    current_file: String,
    status: String,
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
fn import_screenshots(
    game_id: String,
    display_title: String,
    files: Vec<ImportFileInfo>,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<ImportResult, String> {
    use std::time::Instant;
    let start_time = Instant::now();
    
    println!("[导入] 导入截图到游戏: {} ({} 个文件)", game_id, files.len());
    
    let total = files.len() as u32;
    
    let existing_filenames: std::collections::HashSet<String> = {
        let conn = state.db.lock().unwrap();
        let mut filenames = std::collections::HashSet::new();
        if let Ok(existing) = db::get_screenshots(&conn, Some(&game_id), "desc") {
            for ss in existing {
                if let Some(filename) = std::path::PathBuf::from(&ss.file_path).file_name() {
                    filenames.insert(filename.to_string_lossy().to_string());
                }
            }
        }
        filenames
    };
    println!("[导入] 已有 {} 个文件", existing_filenames.len());
    
    let game_dir = db::get_game_dir(&game_id);
    let thumbnails_dir = game_dir.join("thumbnails");
    if !thumbnails_dir.exists() {
        let _ = std::fs::create_dir_all(&thumbnails_dir);
    }
    
    let mut current = 0u32;
    let mut imported_count = 0u32;
    let mut skipped_count = 0u32;
    let mut failed_count = 0u32;
    
    for file in &files {
        current += 1;
        
        let _ = app.emit("import-progress", ImportProgress {
            current,
            total,
            current_file: file.name.clone(),
            status: "处理中".to_string(),
        });
        
        let src_path = std::path::PathBuf::from(&file.path);
        
        if !src_path.exists() {
            failed_count += 1;
            continue;
        }
        
        let timestamp = file.created;
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
        let thumbnail_filename = format!("{}_{:03}_thumb.webp", timestamp, millis);
        
        if existing_filenames.contains(&filename) {
            println!("[导入] 跳过重复文件: {}", filename);
            skipped_count += 1;
            continue;
        }
        
        let dest_path = game_dir.join(&filename);
        let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);
        
        match process_and_save_image(&src_path, &dest_path, &thumbnail_path) {
            Ok(_) => {
                if let (Some(file_path_str), Some(thumb_path_str)) = 
                    (dest_path.to_str(), thumbnail_path.to_str()) {
                    let conn = state.db.lock().unwrap();
                    if db::insert_screenshot(&conn, file_path_str, thumb_path_str, &game_id, &display_title, timestamp, None).is_ok() {
                        imported_count += 1;
                    } else {
                        failed_count += 1;
                    }
                } else {
                    failed_count += 1;
                }
            }
            Err(e) => {
                println!("[导入] 处理图片失败: {} - {}", file.name, e);
                failed_count += 1;
            }
        }
    }
    
    let duration_ms = start_time.elapsed().as_millis() as u64;
    println!("[导入] 导入完成: {} 成功, {} 跳过, {} 失败, 耗时 {}ms", imported_count, skipped_count, failed_count, duration_ms);
    
    let _ = app.emit("import-progress", ImportProgress {
        current: total,
        total,
        current_file: String::new(),
        status: "完成".to_string(),
    });
    
    Ok(ImportResult {
        success: true,
        imported_count,
        skipped_count,
        failed_count,
        duration_ms,
        error: None,
    })
}

fn process_and_save_image(src: &std::path::PathBuf, dest: &std::path::PathBuf, thumbnail_path: &std::path::PathBuf) -> Result<(), String> {
    std::fs::copy(src, dest)
        .map_err(|e| format!("复制图片失败: {}", e))?;
    
    let img = image::open(src)
        .map_err(|e| format!("无法打开图片生成缩略图: {}", e))?;
    
    let thumbnail = create_thumbnail(&img, 320);
    save_as_webp(&thumbnail, thumbnail_path, 50.0)
        .map_err(|e| format!("保存缩略图失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn get_all_games_with_empty(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT gc.game_id, COALESCE(gc.display_title, gc.game_id) as display_title, 
                gc.steam_logo_path, gc.icon_path,
                COALESCE(s.count, 0) as count,
                COALESCE(s.last_timestamp, gc.last_updated) as last_timestamp
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
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            // 更新窗口显示状态
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
                            // 更新窗口显示状态
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

            std::thread::spawn(move || {
                println!("[启动] 热键监听线程启动");
                
                let callback = move |event: Event| {
                    if let EventType::KeyPress(key) = event.event_type {
                        if key == Key::PrintScreen {
                            println!("[热键] 检测到PrintScreen按键!");
                            
                            let shutter_sound = {
                                let conn = db_for_hotkey.lock().unwrap();
                                db::get_shutter_sound(&conn)
                            };
                            let _ = play_shutter_sound_with_type(&shutter_sound);
                            
                            let capture_mouse = {
                                let conn = db_for_hotkey.lock().unwrap();
                                db::get_capture_mouse(&conn)
                            };
                            
                            let process_info = get_foreground_process_info();
                            println!("[截图] 进程: {}, exe: {:?}", process_info.process_name, process_info.exe_path);
                            
                            match capture_screenshot(capture_mouse) {
                                Ok(image) => {
                                    println!("[截图] 屏幕捕获成功");
                                    
                                    let task = ScreenshotTask {
                                        image,
                                        exe_path: process_info.exe_path,
                                        process_name: process_info.process_name,
                                    };
                                    
                                    {
                                        let mut queue = queue_clone.lock().unwrap();
                                        queue.push_back(task);
                                        println!("[队列] 任务已加入队列，当前队列长度: {}", queue.len());
                                    }
                                    
                                    let app_h = app_handle.clone();
                                    let db_h = db_for_hotkey.clone();
                                    let queue_h = queue_clone.clone();
                                    let processing_h = processing_clone.clone();
                                    let window_shown_h = window_shown_clone.clone();
                                    let unread_count_h = unread_count_clone.clone();
                                    
                                    let mut processing = processing_h.lock().unwrap();
                                    if *processing {
                                        println!("[队列] 已有任务在处理中，跳过");
                                        return;
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
                                                let (game_id, is_existing) = db::find_existing_game_id(&conn_for_id, &task.process_name, exe_path_ref);
                                                drop(conn_for_id);
                                                println!("[队列] 使用游戏ID: {} (进程名: {}, 已存在: {})", game_id, task.process_name, is_existing);
                                                
                                                let game_dir = db::get_game_dir(&game_id);
                                                let thumbnails_dir = game_dir.join("thumbnails");
                                                if !thumbnails_dir.exists() {
                                                    let _ = std::fs::create_dir_all(&thumbnails_dir);
                                                }
                                                
                                                let db_for_settings = db_h.clone();
                                                let conn_for_settings = db_for_settings.lock().unwrap();
                                                let screenshot_format = db::get_setting(&conn_for_settings, "screenshot_format")
                                                    .unwrap_or_else(|| "webp".to_string());
                                                let screenshot_quality = db::get_setting(&conn_for_settings, "screenshot_quality")
                                                    .unwrap_or_else(|| "medium".to_string());
                                                drop(conn_for_settings);
                                                
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
                                                                    
                                                                    let has_steam_info = db::get_game_cache(&conn, &game_id)
                                                                        .and_then(|c| c.steam_match_status)
                                                                        .map(|s| s == "found" || s == "skipped" || s == "NotFound")
                                                                        .unwrap_or(false);
                                                                    println!("[Steam] 检查Steam信息: game_id={}, has_steam_info={}", game_id, has_steam_info);
                                                                    
                                                                    drop(conn);
                                                                    
                                                                    // 更新未读数量和托盘图标
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
                                                                    
                                                                    // 立即发送事件通知前端刷新
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
                                                                        println!("[事件] 窗口未显示，跳过事件发送");
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
                                                                                    };
                                                                                    let _ = db::set_game_cache(&conn, &cache);
                                                                                    println!("[图标] 游戏图标提取成功: {}", game_id_for_icon);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                    
                                                                    if !has_steam_info {
                                                                        let db_for_steam = db_clone.clone();
                                                                        let game_id_for_steam = game_id.clone();
                                                                        let process_name_for_steam = task.process_name.clone();
                                                                        std::thread::spawn(move || {
                                                                        println!("[Steam] 自动匹配游戏信息: {}", process_name_for_steam);
                                                                        let result = steam::match_game_name(&process_name_for_steam, "schinese");
                                                                        
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
                                                                                let mut cache = db::get_game_cache(&conn, &game_id_for_steam).unwrap_or(GameCache {
                                                                                    game_id: game_id_for_steam.clone(),
                                                                                    exe_path: None,
                                                                                    icon_path: None,
                                                                                    display_title: Some(info.name.clone()),
                                                                                    last_updated: chrono::Utc::now().timestamp(),
                                                                                    steam_appid: Some(info.appid),
                                                                                    steam_name: Some(info.name.clone()),
                                                                                    steam_logo_path: logo_path_str.clone(),
                                                                                    steam_match_status: Some("found".to_string()),
                                                                                });
                                                                                
                                                                                cache.display_title = Some(info.name.clone());
                                                                                cache.steam_appid = Some(info.appid);
                                                                                cache.steam_name = Some(info.name.clone());
                                                                                cache.steam_logo_path = logo_path_str;
                                                                                cache.steam_match_status = Some("found".to_string());
                                                                                cache.last_updated = chrono::Utc::now().timestamp();
                                                                                
                                                                                if let Err(e) = db::set_game_cache(&conn, &cache) {
                                                                                    println!("[Steam] 自动保存缓存失败: {}", e);
                                                                                }
                                                                                
                                                                                if let Err(e) = db::update_game_display_title(&conn, &game_id_for_steam, &info.name) {
                                                                                    println!("[Steam] 自动更新显示标题失败: {}", e);
                                                                                }
                                                                                
                                                                                println!("[Steam] 自动匹配成功: {} -> {}", process_name_for_steam, info.name);
                                                                            }
                                                                        } else {
                                                                            let conn = db_for_steam.lock().unwrap();
                                                                            let mut cache = db::get_game_cache(&conn, &game_id_for_steam).unwrap_or(GameCache {
                                                                                game_id: game_id_for_steam.clone(),
                                                                                exe_path: None,
                                                                                icon_path: None,
                                                                                display_title: Some(process_name_for_steam.clone()),
                                                                                last_updated: chrono::Utc::now().timestamp(),
                                                                                steam_appid: None,
                                                                                steam_name: None,
                                                                                steam_logo_path: None,
                                                                                steam_match_status: Some("NotFound".to_string()),
                                                                            });
                                                                            
                                                                            cache.display_title = Some(process_name_for_steam.clone());
                                                                            cache.steam_match_status = Some("NotFound".to_string());
                                                                            cache.last_updated = chrono::Utc::now().timestamp();
                                                                            
                                                                            if let Err(e) = db::set_game_cache(&conn, &cache) {
                                                                                println!("[Steam] 保存状态失败: {}", e);
                                                                            }
                                                                            
                                                                            if let Err(e) = db::update_game_display_title(&conn, &game_id_for_steam, &process_name_for_steam) {
                                                                                println!("[Steam] 更新显示标题失败: {}", e);
                                                                            }
                                                                            
                                                                            println!("[Steam] 自动匹配结果: {} -> NotFound (使用进程名作为标题)", process_name_for_steam);
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
                        }
                        
                        if DEBUG_MODE {
                            if key == Key::F12 {
                                println!("[调试] 检测到F12测试按键!");
                            }
                        }
                    }
                };
                
                if let Err(e) = listen(callback) {
                    eprintln!("[错误] 热键监听失败: {:?}", e);
                }
            });

            println!("[启动] 应用设置完成!");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screenshots,
            get_screenshots_with_pagination,
            get_games,
            delete_screenshot,
            delete_screenshots,
            update_note,
            get_storage_path,
            migrate_data,
            check_data_directory,
            switch_data_directory,
            get_capture_mouse,
            set_capture_mouse,
            get_shutter_sound,
            set_shutter_sound,
            play_sound_preview,
            get_setting,
            set_setting,
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
            delete_game,
            delete_games,
            get_game_screenshot_count,
            import_screenshots,
            get_all_games_with_empty,
            get_file_metadata,
            save_share_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
