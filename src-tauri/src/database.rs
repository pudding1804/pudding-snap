use rusqlite::{params, Connection, Result};
use crate::models::{ScreenshotRecord, GameSummary, PaginationResult, MigrationResult, GameCache};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::fs;
use std::io;
use std::sync::{Arc, Mutex};

static CUSTOM_DATA_DIR: once_cell::sync::Lazy<Arc<Mutex<Option<PathBuf>>>> = 
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

pub fn get_config_file_path() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .expect("Could not get exe path")
        .parent()
        .expect("Could not get parent dir")
        .to_path_buf();
    exe_dir.join("screenshot-config.txt")
}

fn load_custom_data_dir() -> Option<PathBuf> {
    if let Some(custom_dir) = CUSTOM_DATA_DIR.lock().unwrap().as_ref() {
        return Some(custom_dir.clone());
    }
    
    let config_path = get_config_file_path();
    if config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            let path = PathBuf::from(content.trim());
            if path.exists() {
                println!("[配置] 从配置文件加载数据目录: {:?}", path);
                *CUSTOM_DATA_DIR.lock().unwrap() = Some(path.clone());
                return Some(path);
            }
        }
    }
    None
}

pub fn save_custom_data_dir(path: &PathBuf) {
    let config_path = get_config_file_path();
    if let Err(e) = std::fs::write(&config_path, path.to_string_lossy().as_bytes()) {
        println!("[配置] 保存配置文件失败: {}", e);
    } else {
        println!("[配置] 配置文件已保存: {:?}", config_path);
    }
    *CUSTOM_DATA_DIR.lock().unwrap() = Some(path.clone());
}

pub fn get_data_dir() -> PathBuf {
    if let Some(custom_dir) = load_custom_data_dir() {
        return custom_dir;
    }
    
    let exe_dir = std::env::current_exe()
        .expect("Could not get exe path")
        .parent()
        .expect("Could not get parent dir")
        .to_path_buf();
    
    let default_path = exe_dir.join("screenshot-data");
    
    let db_path = default_path.join("screenshots_v2.db");
    if db_path.exists() {
        println!("[数据目录] 检测到便携模式数据目录: {:?}", default_path);
        *CUSTOM_DATA_DIR.lock().unwrap() = Some(default_path.clone());
        return default_path;
    }
    
    if !default_path.exists() {
        let _ = std::fs::create_dir_all(&default_path);
    }
    
    default_path
}

pub fn get_screenshots_dir() -> PathBuf {
    get_data_dir()
}

pub fn get_thumbnails_dir() -> PathBuf {
    let path = get_data_dir().join("thumbnails");
    if !path.exists() {
        let _ = std::fs::create_dir_all(&path);
    }
    path
}

pub fn get_db_path() -> PathBuf {
    get_data_dir().join("screenshots_v2.db")
}

pub fn get_storage_path() -> String {
    get_data_dir().to_string_lossy().to_string()
}

pub fn generate_game_id(process_name: &str, exe_path: Option<&str>) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    
    if let Some(exe) = exe_path {
        if let Some(rpg_title) = crate::windows_utils::get_rpg_maker_game_title(exe) {
            let folder_name = crate::windows_utils::get_game_folder_name(exe)
                .unwrap_or_else(|| process_name.to_string());
            let unique_key = format!("{}:{}", rpg_title, folder_name);
            println!("[游戏ID] RPG Maker游戏: {} -> {}", process_name, unique_key);
            unique_key.hash(&mut hasher);
            return format!("{:x}", hasher.finish());
        }
        
        if let Some(folder_name) = crate::windows_utils::get_game_folder_name(exe) {
            let unique_key = format!("{}:{}", process_name, folder_name);
            println!("[游戏ID] 使用文件夹名: {} -> {}", process_name, unique_key);
            unique_key.hash(&mut hasher);
            return format!("{:x}", hasher.finish());
        }
    }
    
    process_name.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn find_existing_game_id(conn: &Connection, process_name: &str, exe_path: Option<&str>) -> Option<String> {
    let game_id = generate_game_id(process_name, exe_path);
    
    let mut stmt = conn.prepare(
        "SELECT game_id FROM screenshots WHERE game_id = ?1 LIMIT 1"
    ).ok()?;
    
    if stmt.query_row(params![&game_id], |row| row.get::<_, String>(0)).ok().is_some() {
        return Some(game_id);
    }
    
    let mut stmt = conn.prepare(
        "SELECT game_id FROM screenshots WHERE game_title = ?1 LIMIT 1"
    ).ok()?;
    
    stmt.query_row(params![process_name], |row| row.get(0)).ok()
}

pub fn init_db() -> Result<Connection> {
    let data_dir = get_data_dir();
    let db_path = get_db_path();
    
    println!("[数据库] 数据目录: {:?}", data_dir);
    println!("[数据库] 数据库路径: {:?}", db_path);
    
    if !data_dir.exists() {
        println!("[数据库] 数据目录不存在，正在创建...");
        std::fs::create_dir_all(&data_dir)
            .map_err(|e| rusqlite::Error::InvalidPath(format!("无法创建目录: {}", e).into()))?;
        println!("[数据库] 数据目录创建成功");
    }
    
    let conn = Connection::open(&db_path)?;
    println!("[数据库] 数据库连接成功");

    let tx = conn.unchecked_transaction()?;
    
    let table_exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='screenshots')",
        [],
        |row| row.get(0)
    ).unwrap_or(false);

    if table_exists {
        let has_game_id: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('screenshots') WHERE name='game_id')",
            [],
            |row| row.get(0)
        ).unwrap_or(false);

        if !has_game_id {
            println!("[数据库] 旧表结构，重建表...");
            tx.execute("DROP TABLE screenshots", [])?;
            tx.execute(
                "CREATE TABLE screenshots (
                    id INTEGER PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    thumbnail_path TEXT NOT NULL,
                    game_id TEXT NOT NULL,
                    game_title TEXT NOT NULL,
                    display_title TEXT,
                    timestamp INTEGER NOT NULL,
                    note TEXT,
                    game_banner_url TEXT
                )",
                [],
            )?;
        }
    } else {
        tx.execute(
            "CREATE TABLE screenshots (
                id INTEGER PRIMARY KEY,
                file_path TEXT NOT NULL,
                thumbnail_path TEXT NOT NULL,
                game_id TEXT NOT NULL,
                game_title TEXT NOT NULL,
                display_title TEXT,
                timestamp INTEGER NOT NULL,
                note TEXT,
                game_banner_url TEXT
            )",
            [],
        )?;
    }

    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_game_id ON screenshots(game_id)",
        [],
    )?;

    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_timestamp ON screenshots(timestamp)",
        [],
    )?;

    tx.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )",
        [],
    )?;

    tx.execute(
        "CREATE TABLE IF NOT EXISTS game_cache (
            game_id TEXT PRIMARY KEY,
            exe_path TEXT,
            icon_path TEXT,
            display_title TEXT,
            last_updated INTEGER,
            steam_appid INTEGER,
            steam_name TEXT,
            steam_logo_path TEXT,
            steam_match_status TEXT
        )",
        [],
    )?;

    let has_steam_appid: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('game_cache') WHERE name='steam_appid')",
        [],
        |row| row.get(0)
    ).unwrap_or(false);

    if !has_steam_appid {
        println!("[数据库] 添加Steam相关字段...");
        tx.execute("ALTER TABLE game_cache ADD COLUMN steam_appid INTEGER", [])?;
        tx.execute("ALTER TABLE game_cache ADD COLUMN steam_name TEXT", [])?;
        tx.execute("ALTER TABLE game_cache ADD COLUMN steam_logo_path TEXT", [])?;
        tx.execute("ALTER TABLE game_cache ADD COLUMN steam_match_status TEXT", [])?;
    }

    tx.commit()?;

    println!("[数据库] 数据库初始化成功");
    
    fix_paths_on_startup(&conn)?;
    
    Ok(conn)
}

pub fn fix_paths_on_startup(conn: &Connection) -> Result<()> {
    let current_data_dir = get_data_dir();
    let current_dir_str = current_data_dir.to_string_lossy().to_string();
    
    let sample_path: Option<String> = conn.query_row(
        "SELECT file_path FROM screenshots LIMIT 1",
        [],
        |row| row.get(0)
    ).ok();
    
    if let Some(path) = sample_path {
        if !path.starts_with(&current_dir_str) {
            println!("[路径修复] 检测到路径不匹配，尝试自动修复...");
            println!("[路径修复] 样本路径: {}", path);
            println!("[路径修复] 当前数据目录: {}", current_dir_str);
            
            let path_obj = std::path::Path::new(&path);
            if let Some(parent) = path_obj.parent() {
                let mut old_dir = parent.to_string_lossy().to_string();
                
                if let Some(game_dir_name) = parent.file_name() {
                    let game_dir_str = game_dir_name.to_string_lossy();
                    if game_dir_str.len() == 16 && game_dir_str.chars().all(|c| c.is_ascii_hexdigit()) {
                        if let Some(data_dir) = parent.parent() {
                            old_dir = data_dir.to_string_lossy().to_string();
                            println!("[路径修复] 检测到game_id子目录，使用数据目录: {}", old_dir);
                        }
                    }
                }
                
                if old_dir != current_dir_str {
                    println!("[路径修复] 旧目录: {}", old_dir);
                    println!("[路径修复] 新目录: {}", current_dir_str);
                    
                    conn.execute(
                        "UPDATE screenshots SET file_path = REPLACE(file_path, ?1, ?2)",
                        params![&old_dir, &current_dir_str],
                    )?;
                    
                    conn.execute(
                        "UPDATE screenshots SET thumbnail_path = REPLACE(thumbnail_path, ?1, ?2)",
                        params![&old_dir, &current_dir_str],
                    )?;
                    
                    conn.execute(
                        "UPDATE game_cache SET icon_path = REPLACE(icon_path, ?1, ?2) WHERE icon_path IS NOT NULL",
                        params![&old_dir, &current_dir_str],
                    )?;
                    
                    conn.execute(
                        "UPDATE game_cache SET steam_logo_path = REPLACE(steam_logo_path, ?1, ?2) WHERE steam_logo_path IS NOT NULL",
                        params![&old_dir, &current_dir_str],
                    )?;
                    
                    println!("[路径修复] 路径修复完成");
                }
            }
        }
    }
    
    Ok(())
}

pub fn get_game_dir(game_id: &str) -> PathBuf {
    let path = get_data_dir().join(game_id);
    if !path.exists() {
        let _ = std::fs::create_dir_all(&path);
    }
    path
}

pub fn insert_screenshot(
    conn: &Connection,
    file_path: &str,
    thumbnail_path: &str,
    game_id: &str,
    game_title: &str,
    timestamp: i64,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO screenshots (file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, '', '')",
        params![file_path, thumbnail_path, game_id, game_title, timestamp],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_screenshots(
    conn: &Connection,
    game_id: Option<&str>,
    sort_order: &str,
) -> Result<Vec<ScreenshotRecord>> {
    let order = if sort_order.to_lowercase() == "asc" { "ASC" } else { "DESC" };
    let sql = if game_id.is_some() {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots WHERE game_id = ?1 ORDER BY timestamp {}",
            order
        )
    } else {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots ORDER BY timestamp {}",
            order
        )
    };

    let mut stmt = conn.prepare(&sql)?;

    let screenshots: Vec<ScreenshotRecord> = if let Some(gid) = game_id {
        stmt.query_map(params![gid], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                game_id: row.get(3)?,
                game_title: row.get(4)?,
                display_title: row.get(5)?,
                timestamp: row.get(6)?,
                note: row.get(7)?,
                game_banner_url: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?
    } else {
        stmt.query_map([], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                game_id: row.get(3)?,
                game_title: row.get(4)?,
                display_title: row.get(5)?,
                timestamp: row.get(6)?,
                note: row.get(7)?,
                game_banner_url: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?
    };

    Ok(screenshots)
}

pub fn get_screenshots_with_pagination(
    conn: &Connection,
    game_id: Option<&str>,
    sort_order: &str,
    page: i32,
    page_size: i32,
) -> Result<PaginationResult> {
    let offset = (page - 1) * page_size;
    
    let count_sql = if game_id.is_some() {
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1"
    } else {
        "SELECT COUNT(*) FROM screenshots"
    };
    
    let total_count: i32 = if let Some(gid) = game_id {
        conn.query_row(count_sql, params![gid], |row| row.get(0))?
    } else {
        conn.query_row(count_sql, [], |row| row.get(0))?
    };
    
    let total_pages = if total_count == 0 {
        1
    } else {
        (total_count + page_size - 1) / page_size
    };
    
    let order = if sort_order.to_lowercase() == "asc" { "ASC" } else { "DESC" };
    let sql = if game_id.is_some() {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots WHERE game_id = ?1 ORDER BY timestamp {} LIMIT ?2 OFFSET ?3",
            order
        )
    } else {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots ORDER BY timestamp {} LIMIT ?1 OFFSET ?2",
            order
        )
    };

    let mut stmt = conn.prepare(&sql)?;

    let screenshots: Vec<ScreenshotRecord> = if let Some(gid) = game_id {
        stmt.query_map(params![gid, page_size, offset], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                game_id: row.get(3)?,
                game_title: row.get(4)?,
                display_title: row.get(5)?,
                timestamp: row.get(6)?,
                note: row.get(7)?,
                game_banner_url: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?
    } else {
        stmt.query_map(params![page_size, offset], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                thumbnail_path: row.get(2)?,
                game_id: row.get(3)?,
                game_title: row.get(4)?,
                display_title: row.get(5)?,
                timestamp: row.get(6)?,
                note: row.get(7)?,
                game_banner_url: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>>>()?
    };

    Ok(PaginationResult {
        screenshots,
        total_pages,
    })
}

pub fn get_games(conn: &Connection) -> Result<Vec<GameSummary>> {
    let mut stmt = conn.prepare(
        "SELECT s.game_id, s.game_title, COALESCE(s.display_title, s.game_title), s.game_banner_url, COUNT(*) as count, MAX(s.timestamp) as last_timestamp,
                gc.icon_path, gc.steam_logo_path
         FROM screenshots s
         LEFT JOIN game_cache gc ON s.game_id = gc.game_id
         GROUP BY s.game_id ORDER BY last_timestamp DESC",
    )?;

    let iter = stmt.query_map([], |row| {
        Ok(GameSummary {
            game_id: row.get(0)?,
            game_title: row.get(1)?,
            display_title: row.get(2)?,
            game_banner_url: row.get(3)?,
            count: row.get(4)?,
            last_timestamp: row.get(5)?,
            game_icon_path: row.get(6)?,
            steam_logo_path: row.get(7)?,
        })
    })?;

    iter.collect()
}

pub fn delete_screenshot(conn: &Connection, id: i32) -> Result<()> {
    conn.execute("DELETE FROM screenshots WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_screenshots(conn: &Connection, ids: &[i32]) -> Result<()> {
    if ids.is_empty() {
        return Ok(());
    }
    
    let placeholders = (0..ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!("DELETE FROM screenshots WHERE id IN ({})", placeholders);
    
    let mut stmt = conn.prepare(&sql)?;
    stmt.execute(rusqlite::params_from_iter(ids))?;
    
    Ok(())
}

pub fn update_note(conn: &Connection, id: i32, note: &str) -> Result<()> {
    conn.execute(
        "UPDATE screenshots SET note = ?1 WHERE id = ?2",
        params![note, id],
    )?;
    Ok(())
}

pub fn update_display_title(conn: &Connection, game_id: &str, display_title: &str) -> Result<()> {
    conn.execute(
        "UPDATE screenshots SET display_title = ?1 WHERE game_id = ?2",
        params![display_title, game_id],
    )?;
    Ok(())
}

pub fn migrate_data(new_path: &str) -> Result<MigrationResult> {
    use crate::models::MigrationStats;
    
    let old_data_dir = get_data_dir();
    let new_data_dir = PathBuf::from(new_path);
    
    println!("[迁移] 从 {:?} 迁移到 {:?}", old_data_dir, new_data_dir);
    
    if !new_data_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&new_data_dir) {
            return Ok(MigrationResult {
                success: false,
                error: Some(format!("无法创建新目录: {}", e)),
                stats: None,
            });
        }
    }
    
    let mut stats = MigrationStats {
        total_files: 0,
        copied_files: 0,
        failed_files: 0,
        total_size: 0,
    };
    
    let copy_result = copy_dir_with_stats(&old_data_dir, &new_data_dir, &mut stats);
    if let Err(e) = copy_result {
        return Ok(MigrationResult {
            success: false,
            error: Some(format!("复制文件失败: {}", e)),
            stats: Some(stats),
        });
    }
    
    save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 迁移完成: {} 文件, {} 字节", stats.copied_files, stats.total_size);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: Some(stats),
    })
}

fn copy_dir_with_stats(src: &PathBuf, dst: &PathBuf, stats: &mut crate::models::MigrationStats) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_with_stats(&path, &dst_path, stats)?;
        } else {
            stats.total_files += 1;
            
            if let Ok(metadata) = fs::metadata(&path) {
                stats.total_size += metadata.len();
            }
            
            match fs::copy(&path, &dst_path) {
                Ok(_) => {
                    stats.copied_files += 1;
                    println!("[迁移] 复制: {:?}", path.file_name().unwrap_or_default());
                }
                Err(e) => {
                    stats.failed_files += 1;
                    println!("[迁移] 失败: {:?} - {}", path.file_name().unwrap_or_default(), e);
                }
            }
        }
    }
    
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryCheckResult {
    pub valid: bool,
    pub message: Option<String>,
}

pub fn check_data_directory(path: &str) -> DirectoryCheckResult {
    let data_dir = PathBuf::from(path);
    
    if !data_dir.exists() {
        return DirectoryCheckResult {
            valid: false,
            message: Some("目录不存在".to_string()),
        };
    }
    
    if !data_dir.is_dir() {
        return DirectoryCheckResult {
            valid: false,
            message: Some("路径不是目录".to_string()),
        };
    }
    
    let db_path = data_dir.join("screenshots_v2.db");
    if !db_path.exists() {
        return DirectoryCheckResult {
            valid: false,
            message: Some("目录中没有找到数据库文件 (screenshots_v2.db)".to_string()),
        };
    }
    
    DirectoryCheckResult {
        valid: true,
        message: Some(format!("有效数据目录，数据库大小: {} 字节", 
            std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0))),
    }
}

pub fn switch_data_directory(new_path: &str) -> Result<MigrationResult> {
    let new_data_dir = PathBuf::from(new_path);
    let old_data_dir = get_data_dir();
    
    let check_result = check_data_directory(new_path);
    if !check_result.valid {
        return Ok(MigrationResult {
            success: false,
            error: check_result.message,
            stats: None,
        });
    }
    
    let old_dir_str = old_data_dir.to_string_lossy().to_string();
    let new_dir_str = new_data_dir.to_string_lossy().to_string();
    
    save_custom_data_dir(&new_data_dir);
    
    println!("[切换] 数据目录已切换到: {:?}", new_data_dir);
    println!("[切换] 旧目录: {:?}", old_data_dir);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: None,
    })
}

pub fn update_paths_for_import(conn: &Connection, old_dir: &str, new_dir: &str) -> Result<()> {
    println!("[导入] 更新数据库路径: {} -> {}", old_dir, new_dir);
    
    conn.execute(
        "UPDATE screenshots SET file_path = REPLACE(file_path, ?1, ?2) WHERE file_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE screenshots SET thumbnail_path = REPLACE(thumbnail_path, ?1, ?2) WHERE thumbnail_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE game_cache SET icon_path = REPLACE(icon_path, ?1, ?2) WHERE icon_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE game_cache SET steam_logo_path = REPLACE(steam_logo_path, ?1, ?2) WHERE steam_logo_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    println!("[导入] 数据库路径更新完成");
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    ).ok()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_capture_mouse(conn: &Connection) -> bool {
    get_setting(conn, "capture_mouse")
        .map(|v| v == "true")
        .unwrap_or(false)
}

pub fn set_capture_mouse(conn: &Connection, enabled: bool) -> Result<()> {
    set_setting(conn, "capture_mouse", if enabled { "true" } else { "false" })
}

pub fn get_game_cache(conn: &Connection, game_id: &str) -> Option<GameCache> {
    conn.query_row(
        "SELECT exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status FROM game_cache WHERE game_id = ?1",
        params![game_id],
        |row| {
            Ok(GameCache {
                game_id: game_id.to_string(),
                exe_path: row.get(0)?,
                icon_path: row.get(1)?,
                display_title: row.get(2)?,
                last_updated: row.get(3)?,
                steam_appid: row.get(4)?,
                steam_name: row.get(5)?,
                steam_logo_path: row.get(6)?,
                steam_match_status: row.get(7)?,
            })
        },
    ).ok()
}

pub fn set_game_cache(conn: &Connection, cache: &GameCache) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO game_cache (game_id, exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![cache.game_id, cache.exe_path, cache.icon_path, cache.display_title, cache.last_updated, cache.steam_appid, cache.steam_name, cache.steam_logo_path, cache.steam_match_status],
    )?;
    Ok(())
}

pub fn update_game_display_title(conn: &Connection, game_id: &str, display_title: &str) -> Result<()> {
    conn.execute(
        "UPDATE screenshots SET display_title = ?1 WHERE game_id = ?2",
        params![display_title, game_id],
    )?;
    println!("[数据库] 更新游戏 {} 的显示标题为: {}", game_id, display_title);
    Ok(())
}

pub fn update_paths_after_migration(conn: &Connection, old_dir: &str, new_dir: &str) -> Result<()> {
    println!("[迁移] 更新数据库路径: {} -> {}", old_dir, new_dir);
    
    conn.execute(
        "UPDATE screenshots SET file_path = REPLACE(file_path, ?1, ?2) WHERE file_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE screenshots SET thumbnail_path = REPLACE(thumbnail_path, ?1, ?2) WHERE thumbnail_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE game_cache SET icon_path = REPLACE(icon_path, ?1, ?2) WHERE icon_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    conn.execute(
        "UPDATE game_cache SET steam_logo_path = REPLACE(steam_logo_path, ?1, ?2) WHERE steam_logo_path LIKE ?3",
        params![old_dir, new_dir, format!("{}%", old_dir)],
    )?;
    
    println!("[迁移] 数据库路径更新完成");
    Ok(())
}

pub fn get_icons_dir() -> PathBuf {
    let path = get_data_dir().join("icons");
    if !path.exists() {
        let _ = std::fs::create_dir_all(&path);
    }
    path
}
