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
use database as db;
use models::*;
use windows_utils::*;
use screenshot::*;
use audio::play_shutter_sound;
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
fn migrate_data(new_path: String) -> Result<MigrationResult, String> {
    db::migrate_data(&new_path).map_err(|e| e.to_string())
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
fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
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
fn restart_app(app: tauri::AppHandle) {
    println!("[重启] 重启应用...");
    app.restart();
}

#[tauri::command]
fn search_steam_game_info(game_id: String, game_title: String, state: State<AppState>) -> Result<SteamMatchResult, String> {
    println!("[Steam] 搜索游戏信息: {} ({})", game_title, game_id);
    
    let result = steam::match_game_name(&game_title);
    
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
fn search_steam_games(search_term: String) -> Result<Vec<SteamSearchResult>, String> {
    println!("[Steam] 手动搜索游戏: {}", search_term);
    steam::search_steam_games_with_images(&search_term)
}

#[tauri::command]
fn apply_steam_game_info(game_id: String, appid: u32, state: State<AppState>) -> Result<SteamGameInfo, String> {
    println!("[Steam] 应用游戏信息: {} -> {}", game_id, appid);
    
    let info = steam::get_steam_app_details(appid)?
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

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    println!("[通知] {}: {}", title, body);
    let _ = app.emit("show-notification", serde_json::json!({
        "title": title,
        "body": body
    }));
}

fn main() {
    println!("[启动] 截图管理器启动中...");
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

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
        })
        .setup(move |app| {
            println!("[启动] Tauri应用设置中...");
            
            let app_handle = app.app_handle().clone();

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

            let _ = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "settings" => {
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
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let _ = tray.app_handle().emit("tray-click", ());
                    }
                })
                .build(app)?;
            
            println!("[启动] 系统托盘创建成功");

            let state = app.state::<AppState>();
            let queue_clone = state.screenshot_queue.clone();
            let processing_clone = state.is_processing.clone();
            let db_for_hotkey = state.db.clone();
            let window_shown_clone = state.window_shown.clone();

            std::thread::spawn(move || {
                println!("[启动] 热键监听线程启动");
                
                let callback = move |event: Event| {
                    if let EventType::KeyPress(key) = event.event_type {
                        if key == Key::PrintScreen {
                            println!("[热键] 检测到PrintScreen按键!");
                            
                            let _ = play_shutter_sound();
                            
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
                                                let game_id = db::find_existing_game_id(&conn_for_id, &task.process_name, exe_path_ref)
                                                    .unwrap_or_else(|| {
                                                        db::generate_game_id(&task.process_name, exe_path_ref)
                                                    });
                                                drop(conn_for_id);
                                                println!("[队列] 使用游戏ID: {} (进程名: {})", game_id, task.process_name);
                                                
                                                let game_dir = db::get_game_dir(&game_id);
                                                let thumbnails_dir = db::get_thumbnails_dir();
                                                
                                                let filename = generate_filename();
                                                let thumbnail_filename = generate_thumbnail_filename();
                                                
                                                let filepath = game_dir.join(&filename);
                                                let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);
                                                
                                                match save_as_webp(&task.image, &filepath, 80.0) {
                                                    Ok(_) => {
                                                        let thumbnail = create_thumbnail(&task.image, 320);
                                                        let _ = save_as_webp(&thumbnail, &thumbnail_path, 70.0);
                                                        
                                                        let timestamp = chrono::Utc::now().timestamp();
                                                        
                                                        let db_clone = db_h.clone();
                                                        let conn = db_clone.lock().unwrap();
                                                        
                                                        let cached_display_title = db::get_game_cache(&conn, &game_id)
                                                            .and_then(|c| c.display_title);
                                                        
                                                        let display_title = if let Some(ref title) = cached_display_title {
                                                            title.clone()
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
                                                            if let Ok(_id) = db::insert_screenshot(&conn, file_path_str, thumb_path_str, &game_id, &display_title, timestamp) {
                                                                let has_icon = db::get_game_cache(&conn, &game_id)
                                                                    .and_then(|c| c.icon_path)
                                                                    .map(|p| std::path::Path::new(&p).exists())
                                                                    .unwrap_or(false);
                                                                
                                                                let has_steam_info = db::get_game_cache(&conn, &game_id)
                                                                    .and_then(|c| c.steam_match_status)
                                                                    .map(|s| !s.is_empty())
                                                                    .unwrap_or(false);
                                                                println!("[Steam] 检查Steam信息: game_id={}, has_steam_info={}", game_id, has_steam_info);
                                                                
                                                                drop(conn);
                                                                
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
                                                                        let result = steam::match_game_name(&process_name_for_steam);
                                                                        
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
                                                                                println!("[Steam] 保存状态失败: {}", e);
                                                                            }
                                                                            
                                                                            println!("[Steam] 自动匹配结果: {} -> {:?}", process_name_for_steam, result.status);
                                                                        }
                                                                    });
                                                                }
                                                                
                                                                let is_window_shown = {
                                                                    let shown = window_shown_h.lock().unwrap();
                                                                    *shown
                                                                };
                                                                if is_window_shown {
                                                                    let _ = app_h.emit("screenshot-taken", ());
                                                                } else {
                                                                    use tauri_plugin_notification::NotificationExt;
                                                                    let _ = app_h.notification()
                                                                        .builder()
                                                                        .title("截图成功")
                                                                        .body("已保存到本地")
                                                                        .show();
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
            get_capture_mouse,
            set_capture_mouse,
            show_window,
            hide_window,
            show_main_window,
            open_in_explorer,
            get_game_icon,
            extract_game_icon,
            delete_all_data,
            restart_app,
            search_steam_game_info,
            search_steam_games,
            apply_steam_game_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
