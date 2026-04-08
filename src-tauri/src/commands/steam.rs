use tauri::State;
use crate::models::*;
use crate::AppState;
use database as db;
use steam::{SteamMatchStatus, SteamMatchResult, SteamGameInfo, SteamSearchResult};

#[tauri::command]
pub fn search_steam_game_info(game_id: String, game_title: String, language: String, state: State<AppState>) -> Result<SteamMatchResult, String> {
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
            
            let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or_else(|| GameCache {
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
    let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or_else(|| GameCache {
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
pub fn search_steam_games(search_term: String, language: String) -> Result<Vec<SteamSearchResult>, String> {
    println!("[Steam] 手动搜索游戏: {} (语言: {})", search_term, language);
    steam::search_steam_games_with_images(&search_term, &language)
}

#[tauri::command]
pub fn apply_steam_game_info(game_id: String, appid: u32, language: String, state: State<AppState>) -> Result<SteamGameInfo, String> {
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
    
    let mut cache = db::get_game_cache(&conn, &game_id).unwrap_or_else(|| GameCache {
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
