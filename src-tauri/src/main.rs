#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod database;
mod windows_utils;
mod screenshot;
mod audio;

use std::sync::{Arc, Mutex};
use tauri::{Manager, State, Emitter};
use rdev::{listen, Event, EventType, Key};
use database::*;
use models::*;
use windows_utils::*;
use screenshot::*;
use audio::*;

struct AppState {
    db: Arc<Mutex<rusqlite::Connection>>,
}

#[tauri::command]
fn get_screenshots(
    game_title: Option<String>,
    sort_order: String,
    state: State<AppState>,
) -> Result<Vec<ScreenshotRecord>, String> {
    let conn = state.db.lock().unwrap();
    let gt_ref = game_title.as_deref();
    get_screenshots(&conn, gt_ref, &sort_order).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_games(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
    let conn = state.db.lock().unwrap();
    get_games(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_screenshot(id: i32, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    
    if let Ok(ss_list) = get_screenshots(&conn, None, "desc") {
        if let Some(ss) = ss_list.iter().find(|s| s.id == id) {
            let _ = std::fs::remove_file(&ss.file_path);
        }
    }
    
    delete_screenshot(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_note(id: i32, note: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    update_note(&conn, id, &note).map_err(|e| e.to_string())
}

fn take_screenshot(app_handle: tauri::AppHandle, db: Arc<Mutex<rusqlite::Connection>>) {
    match capture_screenshot() {
        Ok(image) => {
            let screenshots_dir = get_screenshots_dir();
            let filename = generate_filename();
            let filepath = screenshots_dir.join(filename);
            
            if save_as_webp(&image, &filepath, 80.0).is_ok() {
                let process_name = get_foreground_process_name();
                let timestamp = chrono::Utc::now().timestamp();
                
                let conn = db.lock().unwrap();
                if let Ok(file_path_str) = filepath.to_str() {
                    let _ = insert_screenshot(&conn, file_path_str, &process_name, timestamp);
                    let _ = app_handle.emit("screenshot-taken", ());
                }
                
                play_shutter_sound();
            }
        }
        Err(e) => eprintln!("Screenshot failed: {}", e),
    }
}

fn main() {
    let db = init_db().expect("Failed to initialize database");
    let db_arc = Arc::new(Mutex::new(db));
    let db_clone = db_arc.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { db: db_arc })
        .setup(|app| {
            let app_handle = app.app_handle().clone();
            let db = db_clone.clone();
            
            std::thread::spawn(move || {
                let callback = move |event: Event| {
                    if let EventType::KeyPress(Key::PrintScreen) = event.event_type {
                        take_screenshot(app_handle.clone(), db.clone());
                    }
                };
                
                if let Err(e) = listen(callback) {
                    eprintln!("Error listening for hotkeys: {:?}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screenshots,
            get_games,
            delete_screenshot,
            update_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
