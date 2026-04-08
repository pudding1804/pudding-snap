use tauri::{Manager, State, Emitter, AppHandle};
use crate::models::*;
use crate::AppState;
use database as db;

#[tauri::command]
pub fn show_window(app: AppHandle, state: State<AppState>) -> Result<(), String> {
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
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
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

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
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
pub fn delete_all_data(state: State<AppState>) -> Result<(), String> {
    println!("[删除] 开始删除所有数据...");
    
    {
        let mut db = state.db.lock().unwrap();
        *db = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
        println!("[删除] 数据库连接已关闭");
    }
    
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    let data_dir = db::get_data_dir();
    if data_dir.exists() {
        println!("[删除] 删除数据目录: {:?}", data_dir);
        if let Err(e) = std::fs::remove_dir_all(&data_dir) {
            return Err(format!("删除数据目录失败: {}", e));
        }
    }
    
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
