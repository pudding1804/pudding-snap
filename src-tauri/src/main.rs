#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod windows_utils;
mod screenshot;
mod audio;

use std::sync::{Arc, Mutex};
use tauri::{Manager, State, Emitter, AppHandle, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}};
use rdev::{listen, Event, EventType, Key};
use database as db;
use models::*;
use windows_utils::*;
use screenshot::*;
use audio::play_shutter_sound;

#[cfg(debug_assertions)]
const DEBUG_MODE: bool = true;

#[cfg(not(debug_assertions))]
const DEBUG_MODE: bool = false;

struct AppState {
    db: Arc<Mutex<rusqlite::Connection>>,
    window_shown: Arc<Mutex<bool>>,
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
    };
    
    db::set_game_cache(&conn, &cache).map_err(|e| e.to_string())?;
    
    Ok(icon_path_str)
}

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    println!("[通知] {}: {}", title, body);
    let _ = app.emit("show-notification", serde_json::json!({
        "title": title,
        "body": body
    }));
}

fn take_screenshot(app_handle: AppHandle, db: Arc<Mutex<rusqlite::Connection>>) {
    println!("[截图] 开始截图...");
    
    let _ = play_shutter_sound();
    
    let capture_mouse = {
        let conn = db.lock().unwrap();
        db::get_capture_mouse(&conn)
    };
    println!("[截图] 捕捉鼠标: {}", capture_mouse);
    
    let app_handle_clone = app_handle.clone();
    let db_clone = db.clone();
    
    std::thread::spawn(move || {
        match capture_screenshot(capture_mouse) {
            Ok(image) => {
                println!("[截图] 屏幕捕获成功");
                
                let process_name = get_foreground_process_name();
                println!("[截图] 检测到进程: {}", process_name);
                
                let game_id = db::generate_game_id(&process_name);
                let game_dir = db::get_game_dir(&game_id);
                let thumbnails_dir = db::get_thumbnails_dir();
                println!("[截图] 游戏ID: {}, 目录: {:?}", game_id, game_dir);
                
                let filename = generate_filename();
                let thumbnail_filename = generate_thumbnail_filename();
                
                let filepath = game_dir.join(&filename);
                let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);
                
                println!("[截图] 文件名: {}, 缩略图: {}", filename, thumbnail_filename);
                
                match save_as_webp(&image, &filepath, 80.0) {
                    Ok(_) => {
                        println!("[截图] WebP保存成功: {:?}", filepath);
                        
                        let thumbnail = create_thumbnail(&image, 320);
                        match save_as_webp(&thumbnail, &thumbnail_path, 70.0) {
                            Ok(_) => println!("[截图] 缩略图保存成功: {:?}", thumbnail_path),
                            Err(e) => println!("[截图] 缩略图保存失败: {}", e),
                        }
                        
                        let timestamp = chrono::Utc::now().timestamp();
                        
                        let conn = db_clone.lock().unwrap();
                        if let (Some(file_path_str), Some(thumb_path_str)) = (filepath.to_str(), thumbnail_path.to_str()) {
                            match db::insert_screenshot(&conn, file_path_str, thumb_path_str, &game_id, &process_name, timestamp) {
                                Ok(id) => {
                                    println!("[截图] 数据库记录成功! ID: {}", id);
                                    
                                    let has_icon = db::get_game_cache(&conn, &game_id)
                                        .and_then(|c| c.icon_path)
                                        .map(|p| std::path::Path::new(&p).exists())
                                        .unwrap_or(false);
                                    
                                    if !has_icon {
                                        drop(conn);
                                        let db_for_icon = db_clone.clone();
                                        std::thread::spawn(move || {
                                            if let Some(exe_path) = get_process_exe_path() {
                                                let icons_dir = db::get_icons_dir();
                                                let icon_path = icons_dir.join(format!("{}.png", game_id));
                                                
                                                if let Ok(_) = extract_icon_from_exe(&exe_path, &icon_path) {
                                                    let icon_path_str = icon_path.to_string_lossy().to_string();
                                                    let conn = db_for_icon.lock().unwrap();
                                                    let cache = GameCache {
                                                        game_id: game_id.clone(),
                                                        exe_path: Some(exe_path),
                                                        icon_path: Some(icon_path_str),
                                                        display_title: None,
                                                        last_updated: chrono::Utc::now().timestamp(),
                                                    };
                                                    let _ = db::set_game_cache(&conn, &cache);
                                                    println!("[图标] 游戏图标提取成功: {}", game_id);
                                                }
                                            }
                                        });
                                    }
                                    
                                    let _ = app_handle_clone.emit("screenshot-taken", ());
                                    
                                    if DEBUG_MODE {
                                        show_notification(&app_handle_clone, "截图成功!", &format!("已保存到: {}", filepath.display()));
                                    }
                                }
                                Err(e) => {
                                    println!("[截图] 数据库插入失败: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("[截图] WebP保存失败: {}", e);
                        if DEBUG_MODE {
                            show_notification(&app_handle_clone, "截图失败", &format!("WebP保存失败: {}", e));
                        }
                    }
                }
            }
            Err(e) => {
                println!("[截图] 屏幕捕获失败: {}", e);
                if DEBUG_MODE {
                    show_notification(&app_handle_clone, "截图失败", &format!("屏幕捕获失败: {}", e));
                }
            }
        }
    });
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
    let db_clone = db_arc.clone();
    let window_shown = Arc::new(Mutex::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(AppState { db: db_arc, window_shown })
        .setup(move |app| {
            println!("[启动] Tauri应用设置中...");
            
            let app_handle = app.app_handle().clone();
            let db = db_clone.clone();

            if let Some(window) = app.get_webview_window("main") {
                println!("[启动] 初始隐藏窗口...");
                let _ = window.hide();
            }

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

            std::thread::spawn(move || {
                println!("[启动] 热键监听线程启动");
                
                let callback = move |event: Event| {
                    if let EventType::KeyPress(key) = event.event_type {
                        if key == Key::PrintScreen {
                            println!("[热键] 检测到PrintScreen按键!");
                            take_screenshot(app_handle.clone(), db.clone());
                        }
                        
                        if DEBUG_MODE {
                            if key == Key::F12 {
                                println!("[调试] 检测到F12测试按键!");
                                take_screenshot(app_handle.clone(), db.clone());
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
            open_in_explorer,
            get_game_icon,
            extract_game_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
