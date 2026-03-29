use rusqlite::{params, Connection, Result};
use crate::models::{ScreenshotRecord, GameSummary};
use std::path::PathBuf;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub fn get_data_dir() -> PathBuf {
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

pub fn get_db_path() -> PathBuf {
    get_data_dir().join("screenshots_v2.db")
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
    let sql = if game_id.is_some() {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots WHERE game_id = ?1 ORDER BY timestamp {}",
            sort_order
        )
    } else {
        format!(
            "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots ORDER BY timestamp {}",
            sort_order
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

pub fn get_games(conn: &Connection) -> Result<Vec<GameSummary>> {
    let mut stmt = conn.prepare(
        "SELECT game_id, game_title, COALESCE(display_title, game_title), game_banner_url, COUNT(*) as count, MAX(timestamp) as last_timestamp
         FROM screenshots GROUP BY game_id ORDER BY last_timestamp DESC",
    )?;

    let iter = stmt.query_map([], |row| {
        Ok(GameSummary {
            game_id: row.get(0)?,
            game_title: row.get(1)?,
            display_title: row.get(2)?,
            game_banner_url: row.get(3)?,
            count: row.get(4)?,
            last_timestamp: row.get(5)?,
        })
    })?;

    iter.collect()
}

pub fn delete_screenshot(conn: &Connection, id: i32) -> Result<()> {
    conn.execute("DELETE FROM screenshots WHERE id = ?1", params![id])?;
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
