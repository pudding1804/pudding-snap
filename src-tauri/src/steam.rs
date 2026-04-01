use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::time::{Duration, Instant};

static LAST_REQUEST_TIME: Lazy<Mutex<Instant>> = Lazy::new(|| Mutex::new(Instant::now() - Duration::from_secs(2)));
const REQUEST_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamGame {
    #[serde(alias = "id")]
    pub appid: u32,
    #[serde(alias = "name")]
    pub name: String,
    #[serde(default)]
    pub tiny_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SteamSearchResponse {
    #[serde(default)]
    total: Option<u32>,
    #[serde(default)]
    items: Option<Vec<SteamGame>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamGameInfo {
    pub appid: u32,
    pub name: String,
    pub header_image: Option<String>,
    pub capsule_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamSearchResult {
    pub appid: u32,
    pub name: String,
    pub tiny_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SteamAppDetailsResponse {
    #[serde(default)]
    success: bool,
    data: Option<SteamAppDetails>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SteamAppDetails {
    #[serde(rename = "steam_appid")]
    pub appid: u32,
    pub name: String,
    pub header_image: Option<String>,
    pub capsule_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SteamMatchStatus {
    NotSearched,
    NotFound,
    Found,
    Mismatch,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamMatchResult {
    pub status: SteamMatchStatus,
    pub game_info: Option<SteamGameInfo>,
    pub searched_name: String,
}

fn wait_for_rate_limit() {
    let mut last_time = LAST_REQUEST_TIME.lock().unwrap();
    let elapsed = last_time.elapsed();
    if elapsed < REQUEST_INTERVAL {
        std::thread::sleep(REQUEST_INTERVAL - elapsed);
    }
    *last_time = Instant::now();
}

pub fn search_steam_game(game_name: &str, language: &str) -> Result<Vec<SteamGame>, String> {
    wait_for_rate_limit();
    
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("PuddingSnapper/1.0")
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    let url = format!(
        "https://store.steampowered.com/api/storesearch/?term={}&cc=CN&l={}",
        urlencoding::encode(game_name),
        language
    );
    
    println!("[Steam] 搜索游戏: {}", game_name);
    
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Steam API请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Steam API返回错误状态: {}", response.status()));
    }
    
    let text = response.text()
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    let search_result: SteamSearchResponse = serde_json::from_str(&text)
        .map_err(|e| {
            println!("[Steam] 响应内容: {}", &text[..text.len().min(500)]);
            format!("解析Steam响应失败: {}", e)
        })?;
    
    let games = search_result.items.unwrap_or_default();
    println!("[Steam] 找到 {} 个结果", games.len());
    
    Ok(games)
}

pub fn search_steam_games_with_images(game_name: &str, language: &str) -> Result<Vec<SteamSearchResult>, String> {
    let games = search_steam_game(game_name, language)?;
    
    let results: Vec<SteamSearchResult> = games.into_iter().map(|game| {
        SteamSearchResult {
            appid: game.appid,
            name: game.name,
            tiny_image: game.tiny_image,
        }
    }).collect();
    
    Ok(results)
}

pub fn get_steam_app_details(appid: u32, language: &str) -> Result<Option<SteamGameInfo>, String> {
    wait_for_rate_limit();
    
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("PuddingSnapper/1.0")
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&cc=CN&l={}",
        appid,
        language
    );
    
    println!("[Steam] 获取游戏详情: {}", appid);
    
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Steam API请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Steam API返回错误状态: {}", response.status()));
    }
    
    let details_response: serde_json::Value = response
        .json()
        .map_err(|e| format!("解析Steam响应失败: {}", e))?;
    
    if let Some(app_data) = details_response.get(&appid.to_string()) {
        if app_data.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
            if let Some(data) = app_data.get("data") {
                let info = SteamGameInfo {
                    appid: data.get("steam_appid").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    name: data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    header_image: data.get("header_image").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    capsule_image: data.get("capsule_image").and_then(|v| v.as_str()).map(|s| s.to_string()),
                };
                return Ok(Some(info));
            }
        }
    }
    
    Ok(None)
}

pub fn match_game_name(process_name: &str, language: &str) -> SteamMatchResult {
    let clean_name = clean_process_name(process_name);
    
    match search_steam_game(&clean_name, language) {
        Ok(games) => {
            if games.is_empty() {
                return SteamMatchResult {
                    status: SteamMatchStatus::NotFound,
                    game_info: None,
                    searched_name: clean_name,
                };
            }
            
            let search_name_lower = clean_name.to_lowercase();
            
            for game in &games {
                let game_name_lower = game.name.to_lowercase();
                
                if game_name_lower == search_name_lower {
                    println!("[Steam] 完全匹配: {} -> {}", clean_name, game.name);
                    
                    if let Ok(Some(info)) = get_steam_app_details(game.appid, language) {
                        return SteamMatchResult {
                            status: SteamMatchStatus::Found,
                            game_info: Some(info),
                            searched_name: clean_name,
                        };
                    }
                }
            }
            
            if games.len() == 1 {
                let game = &games[0];
                println!("[Steam] 唯一结果自动匹配: {} -> {}", clean_name, game.name);
                
                if let Ok(Some(info)) = get_steam_app_details(game.appid, language) {
                    return SteamMatchResult {
                        status: SteamMatchStatus::Found,
                        game_info: Some(info),
                        searched_name: clean_name,
                    };
                }
            }
            
            println!("[Steam] 无完全匹配: {} (找到{}个结果)", clean_name, games.len());
            
            SteamMatchResult {
                status: SteamMatchStatus::Mismatch,
                game_info: None,
                searched_name: clean_name,
            }
        }
        Err(e) => {
            println!("[Steam] 搜索失败: {}", e);
            SteamMatchResult {
                status: SteamMatchStatus::NotFound,
                game_info: None,
                searched_name: clean_name,
            }
        }
    }
}

fn clean_process_name(name: &str) -> String {
    let name = name.trim();
    let name = name.trim_end_matches(".exe");
    let name = name.trim_end_matches(".EXE");
    
    let common_suffixes = [
        " - Steam", " Steam", " (Steam)", " Steam版",
        " 简体中文版", " 繁体中文版", " 中文版",
        " 正式版", " 完整版", " 破解版",
        " v1.0", " v1.", " Ver", " ver",
    ];
    
    let mut result = name.to_string();
    for suffix in &common_suffixes {
        if result.to_lowercase().ends_with(&suffix.to_lowercase()) {
            result = result[..result.len() - suffix.len()].to_string();
        }
    }
    
    result.trim().to_string()
}

pub fn download_steam_image(url: &str, save_path: &PathBuf) -> Result<(), String> {
    if save_path.exists() {
        println!("[Steam] 图片已存在: {:?}", save_path);
        return Ok(());
    }
    
    wait_for_rate_limit();
    
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("PuddingSnapper/1.0")
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    println!("[Steam] 下载图片: {}", url);
    
    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("下载图片失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("下载图片失败，状态码: {}", response.status()));
    }
    
    let bytes = response
        .bytes()
        .map_err(|e| format!("读取图片数据失败: {}", e))?;
    
    if let Some(parent) = save_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    fs::write(save_path, &bytes)
        .map_err(|e| format!("保存图片失败: {}", e))?;
    
    println!("[Steam] 图片已保存: {:?}", save_path);
    Ok(())
}

pub fn get_steam_logos_dir() -> PathBuf {
    let data_dir = crate::database::get_data_dir();
    let logos_dir = data_dir.join("steam_logos");
    if !logos_dir.exists() {
        let _ = fs::create_dir_all(&logos_dir);
    }
    logos_dir
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
