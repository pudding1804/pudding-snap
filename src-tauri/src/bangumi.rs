use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::fs;
use std::io::{Read, Write};

static LAST_REQUEST_TIME: Lazy<Mutex<Instant>> = Lazy::new(|| Mutex::new(Instant::now() - Duration::from_secs(2)));
const REQUEST_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BangumiAuth {
    pub access_token: Option<String>,
    pub cookie: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BangumiSubject {
    pub id: u32,
    pub name: String,
    pub name_cn: Option<String>,
    pub images: Option<BangumiImages>,
    #[serde(rename = "type")]
    pub subject_type: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BangumiImages {
    pub small: Option<String>,
    pub grid: Option<String>,
    pub large: Option<String>,
    pub medium: Option<String>,
    pub common: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BangumiSearchResult {
    pub id: u32,
    pub name: String,
    pub name_cn: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BangumiGameInfo {
    pub id: u32,
    pub name: String,
    pub name_cn: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct BangumiSearchResponse {
    data: Vec<BangumiSubject>,
    total: Option<u32>,
    limit: Option<u32>,
    offset: Option<u32>,
}

fn wait_for_rate_limit() {
    let mut last_time = LAST_REQUEST_TIME.lock().unwrap();
    let elapsed = last_time.elapsed();
    if elapsed < REQUEST_INTERVAL {
        std::thread::sleep(REQUEST_INTERVAL - elapsed);
    }
    *last_time = Instant::now();
}

fn get_auth_file_path() -> PathBuf {
    let data_dir = crate::db::get_data_dir();
    data_dir.join("bangumi_auth.json")
}

pub fn save_bangumi_auth(auth: &BangumiAuth) -> Result<(), String> {
    let auth_path = get_auth_file_path();
    let json = serde_json::to_string_pretty(auth)
        .map_err(|e| format!("序列化认证信息失败: {}", e))?;
    
    let mut file = fs::File::create(&auth_path)
        .map_err(|e| format!("创建认证文件失败: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("写入认证文件失败: {}", e))?;
    
    println!("[Bangumi] 认证信息已保存到: {:?}", auth_path);
    Ok(())
}

pub fn load_bangumi_auth() -> Result<BangumiAuth, String> {
    let auth_path = get_auth_file_path();
    
    if !auth_path.exists() {
        return Ok(BangumiAuth {
            access_token: None,
            cookie: None,
        });
    }
    
    let mut file = fs::File::open(&auth_path)
        .map_err(|e| format!("打开认证文件失败: {}", e))?;
    
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| format!("读取认证文件失败: {}", e))?;
    
    let auth: BangumiAuth = serde_json::from_str(&content)
        .map_err(|e| format!("解析认证文件失败: {}", e))?;
    
    println!("[Bangumi] 已加载认证信息");
    Ok(auth)
}

fn build_async_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))
}

fn add_auth_headers_async(request_builder: reqwest::RequestBuilder, auth: &BangumiAuth) -> reqwest::RequestBuilder {
    let mut builder = request_builder
        .header("User-Agent", "PuddingSnap/1.0 (https://github.com/pudding1804/pudding-snap)")
        .header("Accept", "application/json");
    
    if let Some(token) = &auth.access_token {
        println!("[Bangumi] 使用 Access Token 认证");
        builder = builder.header("Authorization", format!("Bearer {}", token));
    }
    
    if let Some(cookie) = &auth.cookie {
        println!("[Bangumi] 使用 Cookie 认证");
        builder = builder.header("Cookie", cookie);
    }
    
    builder
}

pub async fn search_bangumi_games_async(search_term: &str) -> Result<Vec<BangumiSearchResult>, String> {
    wait_for_rate_limit();
    
    let auth = load_bangumi_auth()?;
    let client = build_async_client()?;
    
    let url = "https://api.bgm.tv/v0/search/subjects";
    
    println!("[Bangumi] 搜索游戏: {}", search_term);
    
    let body = serde_json::json!({
        "keyword": search_term,
        "type": [4]
    });
    
    let request_builder = client.post(url).json(&body);
    let request_builder = add_auth_headers_async(request_builder, &auth);
    
    let response = request_builder.send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API返回错误状态: {}", response.status()));
    }
    
    let search_response: BangumiSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    let total = search_response.total.unwrap_or(0);
    println!("[Bangumi] 找到 {} 个结果", total);
    
    let results: Vec<BangumiSearchResult> = search_response.data
        .into_iter()
        .filter(|subject| {
            if let Some(subject_type) = subject.subject_type {
                if subject_type != 4 {
                    println!("[Bangumi] 过滤非游戏结果: {} (type={})", 
                        subject.name_cn.as_ref().unwrap_or(&subject.name), subject_type);
                    return false;
                }
            }
            true
        })
        .map(|subject| {
            let image_url = subject.images.as_ref().and_then(|img| {
                img.small.as_ref().or(img.medium.as_ref()).or(img.grid.as_ref())
            });
            
            if let Some(url) = &image_url {
                let size_type = if url.contains("/grid/") {
                    "grid (小图)"
                } else if url.contains("/medium/") {
                    "medium (中图)"
                } else if url.contains("/small/") {
                    "small (小图)"
                } else if url.contains("/large/") {
                    "large (大图)"
                } else {
                    "未知尺寸"
                };
                println!("[Bangumi] 游戏: {} - 图片: {} ({})", 
                    subject.name_cn.as_ref().unwrap_or(&subject.name),
                    url, size_type);
            } else {
                println!("[Bangumi] 游戏: {} - 无图片", 
                    subject.name_cn.as_ref().unwrap_or(&subject.name));
            }
            
            BangumiSearchResult {
                id: subject.id,
                name: subject.name,
                name_cn: subject.name_cn,
                image: image_url.map(|s| s.to_string()),
            }
        })
        .collect();
    
    Ok(results)
}

pub async fn get_bangumi_subject_details_async(subject_id: u32) -> Result<Option<BangumiGameInfo>, String> {
    wait_for_rate_limit();
    
    let auth = load_bangumi_auth()?;
    let client = build_async_client()?;
    
    let url = format!("https://api.bgm.tv/v0/subjects/{}", subject_id);
    
    println!("[Bangumi] 获取游戏详情: {}", subject_id);
    
    let request_builder = client.get(&url);
    let request_builder = add_auth_headers_async(request_builder, &auth);
    
    let response = request_builder.send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("API返回错误状态: {}", response.status()));
    }
    
    let subject: BangumiSubject = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    
    let image_url = subject.images.as_ref().and_then(|img| {
        img.small.as_ref().or(img.medium.as_ref()).or(img.grid.as_ref())
    });
    
    if let Some(url) = &image_url {
        let size_type = if url.contains("/grid/") {
            "grid (小图)"
        } else if url.contains("/medium/") {
            "medium (中图)"
        } else if url.contains("/small/") {
            "small (小图)"
        } else if url.contains("/large/") {
            "large (大图)"
        } else {
            "未知尺寸"
        };
        println!("[Bangumi] 选择图片: {} - 类型: {}", url, size_type);
    }
    
    let info = BangumiGameInfo {
        id: subject.id,
        name: subject.name,
        name_cn: subject.name_cn,
        image: image_url.map(|s| s.to_string()),
    };
    
    Ok(Some(info))
}

pub async fn download_bangumi_image_async(url: &str, save_path: &PathBuf) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
    
    println!("[Bangumi] 下载图片(异步): {}", url);
    
    let response = client
        .get(url)
        .header("User-Agent", "PuddingSnap/1.0 (https://github.com/pudding1804/pudding-snap)")
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("下载失败，状态码: {}", response.status()));
    }
    
    let bytes = response.bytes().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    let mut file = std::fs::File::create(save_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    
    std::io::Write::write_all(&mut file, &bytes)
        .map_err(|e| format!("保存文件失败: {}", e))?;
    
    println!("[Bangumi] 图片保存成功: {:?}", save_path);
    Ok(())
}

pub fn get_bangumi_logos_dir() -> PathBuf {
    let data_dir = crate::db::get_data_dir();
    let logos_dir = data_dir.join("bangumi-logos");
    
    if !logos_dir.exists() {
        let _ = std::fs::create_dir_all(&logos_dir);
    }
    
    logos_dir
}

mod urlencoding {
    pub fn encode(s: &str) -> String {
        url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
    }
}
