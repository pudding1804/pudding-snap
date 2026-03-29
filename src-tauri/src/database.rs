use rusqlite::{params, Connection, Result};
use crate::models::{ScreenshotRecord, GameSummary};
use std::path::PathBuf;
use dirs::home_dir;

pub fn init_db() -> Result<Connection> {
    let mut path = home_dir().expect("Could not find home directory");
    path.push(".screenshot-manager");
    std::fs::create_dir_all(&path).ok();
    path.push("screenshots.db");

    let conn = Connection::open(path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS screenshots (
            id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            game_title TEXT NOT NULL,
            display_title TEXT,
            timestamp INTEGER NOT NULL,
            note TEXT,
            game_banner_url TEXT
        )",
        [],
    )?;

    Ok(conn)
}

pub fn insert_screenshot(
    conn: &Connection,
    file_path: &str,
    game_title: &str,
    timestamp: i64,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO screenshots (file_path, game_title, display_title, timestamp, note, game_banner_url)
         VALUES (?1, ?2, ?2, ?3, '', '')",
        params![file_path, game_title, timestamp],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_screenshots(
    conn: &Connection,
    game_title: Option<&str>,
    sort_order: &str,
) -> Result<Vec<ScreenshotRecord>> {
    let mut stmt = if let Some(gt) = game_title {
        conn.prepare(&format!(
            "SELECT id, file_path, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots WHERE game_title = ?1 ORDER BY timestamp {}",
            sort_order
        ))?
    } else {
        conn.prepare(&format!(
            "SELECT id, file_path, game_title, display_title, timestamp, note, game_banner_url
             FROM screenshots ORDER BY timestamp {}",
            sort_order
        ))?
    };

    let iter = if let Some(gt) = game_title {
        stmt.query_map(params![gt], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                game_title: row.get(2)?,
                display_title: row.get(3)?,
                timestamp: row.get(4)?,
                note: row.get(5)?,
                game_banner_url: row.get(6)?,
            })
        })?
    } else {
        stmt.query_map([], |row| {
            Ok(ScreenshotRecord {
                id: row.get(0)?,
                file_path: row.get(1)?,
                game_title: row.get(2)?,
                display_title: row.get(3)?,
                timestamp: row.get(4)?,
                note: row.get(5)?,
                game_banner_url: row.get(6)?,
            })
        })?
    };

    iter.collect()
}

pub fn get_games(conn: &Connection) -> Result<Vec<GameSummary>> {
    let mut stmt = conn.prepare(
        "SELECT game_title, display_title, game_banner_url, COUNT(*) as count
         FROM screenshots GROUP BY game_title ORDER BY count DESC",
    )?;

    let iter = stmt.query_map([], |row| {
        Ok(GameSummary {
            game_title: row.get(0)?,
            display_title: row.get(1)?,
            game_banner_url: row.get(2)?,
            count: row.get(3)?,
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

pub fn get_screenshots_dir() -> PathBuf {
    let mut path = home_dir().expect("Could not find home directory");
    path.push("Pictures");
    path.push("ScreenshotManager");
    std::fs::create_dir_all(&path).ok();
    path
}
