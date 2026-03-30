use rusqlite::{params, Connection, Result};
use crate::models::{ScreenshotRecord, GameSummary, PaginationResult, MigrationResult, GameCache};
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

fn save_custom_data_dir(path: &PathBuf) {
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
    
    let path = exe_dir.join("screenshot-data");
    
    if !path.exists() {
        let _ = std::fs::create_dir_all(&path);
    }
    
    path
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

pub fn generate_game_id(game_title: &str) -> String {
    let mut hasher = DefaultHasher::new();
    game_title.hash(&mut hasher);
    format!("{:x}", hasher.finish())
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
            last_updated INTEGER
        )",
        [],
    )?;

    tx.commit()?;

    println!("[数据库] 数据库初始化成功");
    Ok(conn)
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
                gc.icon_path
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
    let old_data_dir = get_data_dir();
    let new_data_dir = PathBuf::from(new_path);
    
    println!("[迁移] 从 {:?} 迁移到 {:?}", old_data_dir, new_data_dir);
    
    if !new_data_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&new_data_dir) {
            return Ok(MigrationResult {
                success: false,
                error: Some(format!("无法创建新目录: {}", e)),
            });
        }
    }
    
    let copy_result = copy_dir(&old_data_dir, &new_data_dir);
    if let Err(e) = copy_result {
        return Ok(MigrationResult {
            success: false,
            error: Some(format!("复制文件失败: {}", e)),
        });
    }
    
    save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 迁移完成，新数据目录已保存到配置文件");
    
    Ok(MigrationResult {
        success: true,
        error: None,
    })
}

fn copy_dir(src: &PathBuf, dst: &PathBuf) -> io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir(&path, &dst_path)?;
        } else {
            fs::copy(&path, &dst_path)?;
        }
    }
    
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
        "SELECT exe_path, icon_path, display_title, last_updated FROM game_cache WHERE game_id = ?1",
        params![game_id],
        |row| {
            Ok(GameCache {
                game_id: game_id.to_string(),
                exe_path: row.get(0)?,
                icon_path: row.get(1)?,
                display_title: row.get(2)?,
                last_updated: row.get(3)?,
            })
        },
    ).ok()
}

pub fn set_game_cache(conn: &Connection, cache: &GameCache) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO game_cache (game_id, exe_path, icon_path, display_title, last_updated)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![cache.game_id, cache.exe_path, cache.icon_path, cache.display_title, cache.last_updated],
    )?;
    Ok(())
}

pub fn get_icons_dir() -> PathBuf {
    let path = get_data_dir().join("icons");
    if !path.exists() {
        let _ = std::fs::create_dir_all(&path);
    }
    path
}
