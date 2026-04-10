use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotRecord {
    pub id: i32,
    pub file_path: String,
    pub thumbnail_path: String,
    pub game_id: String,
    pub game_title: String,
    pub display_title: String,
    pub timestamp: i64,
    pub note: String,
    pub game_banner_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameSummary {
    pub game_id: String,
    pub game_title: String,
    pub display_title: String,
    pub game_banner_url: String,
    pub game_icon_path: Option<String>,
    pub steam_logo_path: Option<String>,
    pub count: i32,
    pub last_timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationResult {
    pub screenshots: Vec<ScreenshotRecord>,
    pub total: i32,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedGames {
    pub games: Vec<GameSummary>,
    pub total: i32,
    pub page: i32,
    pub page_size: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationStats {
    pub total_files: u32,
    pub copied_files: u32,
    pub failed_files: u32,
    pub total_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationResult {
    pub success: bool,
    pub error: Option<String>,
    pub stats: Option<MigrationStats>,
    pub old_dir_deleted: bool,
    pub old_dir_pending_delete: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameCache {
    pub game_id: String,
    pub exe_path: Option<String>,
    pub icon_path: Option<String>,
    pub display_title: Option<String>,
    pub last_updated: i64,
    pub steam_appid: Option<u32>,
    pub steam_name: Option<String>,
    pub steam_logo_path: Option<String>,
    pub steam_match_status: Option<String>,
}
