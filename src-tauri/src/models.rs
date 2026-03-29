use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotRecord {
    pub id: i32,
    pub file_path: String,
    pub game_title: String,
    pub display_title: String,
    pub timestamp: i64,
    pub note: String,
    pub game_banner_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GameSummary {
    pub game_title: String,
    pub display_title: String,
    pub game_banner_url: String,
    pub count: i32,
}
