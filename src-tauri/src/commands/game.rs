use tauri::State;
use crate::models::*;
use crate::AppState;
use database as db;
use std::path::PathBuf;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Read;

fn calculate_file_hash(path: &PathBuf) -> Result<String, String> {
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
pub fn create_game_from_steam(
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
pub fn delete_game(game_id: String, state: State<AppState>) -> Result<(), String> {
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
pub fn delete_games(game_ids: Vec<String>, state: State<AppState>) -> Result<(), String> {
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
pub fn get_game_screenshot_count(game_id: String, state: State<AppState>) -> Result<i32, String> {
    let conn = state.db.lock().unwrap();
    db::get_game_screenshot_count(&conn, &game_id).map_err(|e| e.to_string())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ImportFileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub created: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub imported_count: u32,
    pub skipped_count: u32,
    pub failed_count: u32,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct ImportProgress {
    pub current: u32,
    pub total: u32,
    pub current_file: String,
    pub status: String,
}

#[tauri::command]
pub fn import_screenshots(
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
                if let Some(filename) = PathBuf::from(&ss.file_path).file_name() {
                    filenames.insert(filename.to_string_lossy().to_string());
                }
            }
        }
        filenames
    };
    println!("[导入] 已有 {} 个文件", existing_filenames.len());
    
    let game_dir = db::get_game_dir(&game_id);
    let thumbnails_dir = db::get_thumbnails_dir();
    
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
        
        let src_path = PathBuf::from(&file.path);
        
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
        let filename = format!("{}.{}", timestamp, original_ext);
        let thumbnail_filename = format!("thumb_{}.webp", timestamp);
        
        if existing_filenames.contains(&filename) {
            println!("[导入] 跳过重复文件: {}", filename);
            skipped_count += 1;
            continue;
        }
        
        let dest_path = game_dir.join(&filename);
        let thumbnail_path = thumbnails_dir.join(&thumbnail_filename);
        
        match process_and_save_image(&src_path, &dest_path, &thumbnail_path) {
            Ok(_) => {
                if let (Ok(file_path_str), Ok(thumb_path_str)) = 
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

fn process_and_save_image(src: &PathBuf, dest: &PathBuf, thumbnail_path: &PathBuf) -> Result<(), String> {
    std::fs::copy(src, dest)
        .map_err(|e| format!("复制图片失败: {}", e))?;
    
    let img = image::open(src)
        .map_err(|e| format!("无法打开图片生成缩略图: {}", e))?;
    
    let thumbnail = crate::screenshot::create_thumbnail(&img, 320);
    crate::screenshot::save_as_webp(&thumbnail, thumbnail_path, 50.0)
        .map_err(|e| format!("保存缩略图失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_all_games_with_empty(state: State<AppState>) -> Result<Vec<GameSummary>, String> {
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
