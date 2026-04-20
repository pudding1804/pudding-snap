use rusqlite::{params, Connection, Result};
use crate::models::{ScreenshotRecord, GameSummary, PaginationResult, PaginatedGames, MigrationResult, GameCache};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
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
            unique_key.hash(&mut hasher);
            return format!("{:x}", hasher.finish());
        }
        
        if let Some(folder_name) = crate::windows_utils::get_game_folder_name(exe) {
            let unique_key = format!("{}:{}", process_name, folder_name);
            unique_key.hash(&mut hasher);
            return format!("{:x}", hasher.finish());
        }
    }
    
    process_name.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn find_existing_game_id(conn: &Connection, process_name: &str, exe_path: Option<&str>) -> (String, bool) {
    let game_id = generate_game_id(process_name, exe_path);
    
    let mut stmt = match conn.prepare("SELECT game_id FROM screenshots WHERE game_id = ?1 LIMIT 1") {
        Ok(s) => s,
        Err(_) => return (game_id, false),
    };
    
    if stmt.query_row(params![&game_id], |row| row.get::<_, String>(0)).ok().is_some() {
        return (game_id, true);
    }
    
    let mut stmt = match conn.prepare("SELECT game_id FROM screenshots WHERE game_title = ?1 LIMIT 1") {
        Ok(s) => s,
        Err(_) => return (game_id, false),
    };
    
    if let Some(existing_id) = stmt.query_row(params![process_name], |row| row.get(0)).ok() {
        return (existing_id, true);
    }
    
    (game_id, false)
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

    let has_file_hash: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('screenshots') WHERE name='file_hash')",
        [],
        |row| row.get(0)
    ).unwrap_or(false);

    if !has_file_hash {
        println!("[数据库] 添加 file_hash 字段...");
        tx.execute("ALTER TABLE screenshots ADD COLUMN file_hash TEXT", [])?;
        tx.execute("CREATE INDEX IF NOT EXISTS idx_file_hash ON screenshots(file_hash)", [])?;
    }

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

    tx.execute(
        "CREATE TABLE IF NOT EXISTS deleted_screenshots (
            id INTEGER PRIMARY KEY,
            original_id INTEGER,
            file_path TEXT NOT NULL,
            thumbnail_path TEXT NOT NULL,
            original_file_path TEXT NOT NULL,
            original_thumbnail_path TEXT NOT NULL,
            game_id TEXT NOT NULL,
            game_title TEXT NOT NULL,
            display_title TEXT,
            timestamp INTEGER NOT NULL,
            note TEXT,
            game_banner_url TEXT,
            file_hash TEXT,
            deleted_at INTEGER NOT NULL
        )",
        [],
    )?;

    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_deleted_at ON deleted_screenshots(deleted_at)",
        [],
    )?;

    tx.execute(
        "CREATE TABLE IF NOT EXISTS deleted_games (
            game_id TEXT PRIMARY KEY,
            exe_path TEXT,
            icon_path TEXT,
            display_title TEXT,
            last_updated INTEGER,
            steam_appid INTEGER,
            steam_name TEXT,
            steam_logo_path TEXT,
            steam_match_status TEXT,
            deleted_at INTEGER NOT NULL
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
    verify_and_fix_paths(&conn)?;
    
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
            
            let old_dir = extract_data_dir_from_path(&path);
            
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
    
    Ok(())
}

pub fn verify_and_fix_paths(conn: &Connection) -> Result<()> {
    let data_dir = get_data_dir();
    let data_dir_str = data_dir.to_string_lossy().to_string();
    
    let mut broken_paths: Vec<(i64, String, String, String)> = Vec::new();
    
    {
        let mut stmt = conn.prepare(
            "SELECT id, file_path, thumbnail_path, game_id FROM screenshots"
        )?;
        
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?;
        
        for row in rows {
            if let Ok((id, file_path, thumb_path, game_id)) = row {
                let file_exists = std::path::Path::new(&file_path).exists();
                let thumb_exists = std::path::Path::new(&thumb_path).exists();
                
                if !file_exists || !thumb_exists {
                    broken_paths.push((id, file_path, thumb_path, game_id));
                }
            }
        }
    }
    
    if broken_paths.is_empty() {
        println!("[路径验证] 所有路径正常");
        return Ok(());
    }
    
    println!("[路径验证] 发现 {} 条损坏路径，尝试修复...", broken_paths.len());
    
    for (id, file_path, thumb_path, game_id) in broken_paths {
        let mut new_file_path = file_path.clone();
        let mut new_thumb_path = thumb_path.clone();
        
        let game_dir = data_dir.join(&game_id);
        
        if !std::path::Path::new(&file_path).exists() {
            if let Some(filename) = std::path::Path::new(&file_path).file_name() {
                let correct_path = game_dir.join(filename);
                if correct_path.exists() {
                    new_file_path = correct_path.to_string_lossy().to_string();
                    println!("[路径修复] 截图: {} -> {}", file_path, new_file_path);
                }
            }
        }
        
        if !std::path::Path::new(&thumb_path).exists() {
            if let Some(filename) = std::path::Path::new(&thumb_path).file_name() {
                let thumb_dir = game_dir.join("thumbnails");
                let correct_path = thumb_dir.join(filename);
                if correct_path.exists() {
                    new_thumb_path = correct_path.to_string_lossy().to_string();
                    println!("[路径修复] 缩略图: {} -> {}", thumb_path, new_thumb_path);
                }
            }
        }
        
        if new_file_path != file_path || new_thumb_path != thumb_path {
            conn.execute(
                "UPDATE screenshots SET file_path = ?1, thumbnail_path = ?2 WHERE id = ?3",
                params![&new_file_path, &new_thumb_path, id],
            )?;
        }
    }
    
    println!("[路径验证] 修复完成");
    Ok(())
}

fn extract_data_dir_from_path(path: &str) -> String {
    let path_obj = std::path::Path::new(path);
    let mut current = path_obj;
    
    while let Some(parent) = current.parent() {
        if let Some(dir_name) = parent.file_name() {
            let dir_str = dir_name.to_string_lossy();
            if dir_str.len() == 16 && dir_str.chars().all(|c| c.is_ascii_hexdigit()) {
                if let Some(data_dir) = parent.parent() {
                    println!("[路径提取] 找到game_id目录: {}, 数据目录: {:?}", dir_str, data_dir);
                    return data_dir.to_string_lossy().to_string();
                }
            }
        }
        current = parent;
    }
    
    if let Some(parent) = path_obj.parent() {
        return parent.to_string_lossy().to_string();
    }
    
    path.to_string()
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
    file_hash: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO screenshots (file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, '', '', ?6)",
        params![file_path, thumbnail_path, game_id, game_title, timestamp, file_hash],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_existing_hashes(conn: &Connection, game_id: &str) -> Result<std::collections::HashSet<String>> {
    let mut hashes = std::collections::HashSet::new();
    let mut stmt = conn.prepare(
        "SELECT file_hash FROM screenshots WHERE game_id = ?1 AND file_hash IS NOT NULL"
    )?;
    
    let iter = stmt.query_map(params![game_id], |row| {
        row.get::<_, Option<String>>(0)
    })?;
    
    for hash in iter {
        if let Some(h) = hash? {
            hashes.insert(h);
        }
    }
    
    Ok(hashes)
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
    date_start: Option<i64>,
    date_end: Option<i64>,
    note_search: Option<&str>,
) -> Result<PaginationResult> {
    let offset = (page - 1) * page_size;
    
    let mut where_clauses: Vec<String> = Vec::new();
    let mut param_index = 1;
    
    if game_id.is_some() {
        where_clauses.push(format!("game_id = ?{}", param_index));
        param_index += 1;
    }
    
    if date_start.is_some() {
        where_clauses.push(format!("timestamp >= ?{}", param_index));
        param_index += 1;
    }
    
    if date_end.is_some() {
        where_clauses.push(format!("timestamp <= ?{}", param_index));
        param_index += 1;
    }
    
    if note_search.is_some() {
        where_clauses.push(format!("note LIKE ?{}", param_index));
        param_index += 1;
    }
    
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };
    
    let count_sql = format!("SELECT COUNT(*) FROM screenshots{}", where_sql);
    
    let total_count: i32 = if game_id.is_some() || date_start.is_some() || date_end.is_some() || note_search.is_some() {
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(gid) = game_id {
            params_vec.push(Box::new(gid.to_string()));
        }
        if let Some(start) = date_start {
            params_vec.push(Box::new(start));
        }
        if let Some(end) = date_end {
            params_vec.push(Box::new(end));
        }
        if let Some(ns) = note_search {
            params_vec.push(Box::new(format!("%{}%", ns)));
        }
        
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        
        conn.query_row(&count_sql, params_refs.as_slice(), |row| row.get(0))?
    } else {
        conn.query_row(&count_sql, [], |row| row.get(0))?
    };
    
    let total_pages = if total_count == 0 {
        1
    } else {
        (total_count + page_size - 1) / page_size
    };
    
    let order = if sort_order.to_lowercase() == "asc" { "ASC" } else { "DESC" };
    let sql = format!(
        "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url
         FROM screenshots{} ORDER BY timestamp {} LIMIT ?{} OFFSET ?{}",
        where_sql, order, param_index, param_index + 1
    );

    let mut stmt = conn.prepare(&sql)?;
    
    let screenshots: Vec<ScreenshotRecord> = if game_id.is_some() || date_start.is_some() || date_end.is_some() || note_search.is_some() {
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(gid) = game_id {
            params_vec.push(Box::new(gid.to_string()));
        }
        if let Some(start) = date_start {
            params_vec.push(Box::new(start));
        }
        if let Some(end) = date_end {
            params_vec.push(Box::new(end));
        }
        if let Some(ns) = note_search {
            params_vec.push(Box::new(format!("%{}%", ns)));
        }
        params_vec.push(Box::new(page_size));
        params_vec.push(Box::new(offset));
        
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        
        stmt.query_map(params_refs.as_slice(), |row| {
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
        total: total_count,
        page,
        page_size,
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

pub fn get_backup_dir() -> PathBuf {
    let exe_dir = std::env::current_exe()
        .expect("Could not get exe path")
        .parent()
        .expect("Could not get parent dir")
        .to_path_buf();
    exe_dir.join("db-backup")
}

pub fn perform_backup() -> std::result::Result<String, String> {
    let db_path = get_db_path();
    if !db_path.exists() {
        return Err("数据库文件不存在".to_string());
    }
    
    let backup_dir = get_backup_dir();
    if !backup_dir.exists() {
        std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    }
    
    let now = chrono::Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S").to_string();
    let backup_file_name = format!("screenshots_v2_{}.db", timestamp);
    let backup_path = backup_dir.join(&backup_file_name);
    
    std::fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    
    println!("[备份] 数据库已备份到: {:?}", backup_path);
    
    cleanup_old_backups(&backup_dir, 3).map_err(|e| e.to_string())?;
    
    Ok(backup_path.to_string_lossy().to_string())
}

fn cleanup_old_backups(backup_dir: &PathBuf, keep_count: usize) -> std::result::Result<(), String> {
    let mut backups: Vec<(String, std::time::SystemTime)> = Vec::new();
    
    let entries = std::fs::read_dir(backup_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with("screenshots_v2_") && file_name.ends_with(".db") {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    backups.push((file_name, modified));
                }
            }
        }
    }
    
    backups.sort_by(|a, b| b.1.cmp(&a.1));
    
    if backups.len() > keep_count {
        for old_backup in &backups[keep_count..] {
            let old_path = backup_dir.join(&old_backup.0);
            println!("[备份] 删除旧备份: {:?}", old_path);
            let _ = std::fs::remove_file(old_path);
        }
    }
    
    Ok(())
}

pub fn get_last_backup_time() -> Option<i64> {
    let backup_dir = get_backup_dir();
    if !backup_dir.exists() {
        return None;
    }
    
    let mut latest: Option<std::time::SystemTime> = None;
    
    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with("screenshots_v2_") && file_name.ends_with(".db") {
                if let Ok(metadata) = entry.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        latest = Some(match latest {
                            Some(current) => if modified > current { modified } else { current },
                            None => modified,
                        });
                    }
                }
            }
        }
    }
    
    latest.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64)
}

pub fn get_games_with_pagination(conn: &Connection, page: i32, page_size: i32) -> Result<PaginatedGames> {
    let offset = (page - 1) * page_size;
    
    let total: i32 = conn.query_row(
        "SELECT COUNT(*) FROM (
            SELECT game_id FROM screenshots GROUP BY game_id
            UNION
            SELECT game_id FROM game_cache
        )",
        [],
        |row| row.get(0)
    )?;
    let total_pages = if total == 0 { 1 } else { (total + page_size - 1) / page_size };
    
    let mut stmt = conn.prepare(
        "SELECT game_id, game_title, display_title, game_banner_url, screenshot_count, last_timestamp, icon_path, steam_logo_path
         FROM (
             SELECT 
                 s.game_id, 
                 s.game_title, 
                 COALESCE(s.display_title, s.game_title) as display_title, 
                 COALESCE(s.game_banner_url, '') as game_banner_url, 
                 COUNT(*) as screenshot_count, 
                 MAX(s.timestamp) as last_timestamp,
                 gc.icon_path,
                 gc.steam_logo_path
             FROM screenshots s
             LEFT JOIN game_cache gc ON s.game_id = gc.game_id
             GROUP BY s.game_id
             
             UNION ALL
             
             SELECT 
                 gc.game_id, 
                 COALESCE(gc.steam_name, gc.display_title, gc.game_id) as game_title, 
                 COALESCE(gc.display_title, '') as display_title, 
                 '' as game_banner_url, 
                 0 as screenshot_count, 
                 0 as last_timestamp,
                 gc.icon_path,
                 gc.steam_logo_path
             FROM game_cache gc
             WHERE gc.game_id NOT IN (SELECT DISTINCT game_id FROM screenshots)
         )
         ORDER BY last_timestamp DESC
         LIMIT ?1 OFFSET ?2",
    )?;

    let iter = stmt.query_map(params![page_size, offset], |row| {
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

    let games: Vec<GameSummary> = iter.collect::<Result<Vec<_>>>()?;
    
    Ok(PaginatedGames {
        games,
        total,
        page,
        page_size,
        total_pages,
    })
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

fn get_trash_dir() -> PathBuf {
    let data_dir = get_data_dir();
    let trash_dir = data_dir.join(".trash");
    if !trash_dir.exists() {
        let _ = std::fs::create_dir_all(&trash_dir);
    }
    let thumb_dir = trash_dir.join("thumbnails");
    if !thumb_dir.exists() {
        let _ = std::fs::create_dir_all(&thumb_dir);
    }
    trash_dir
}

fn move_file_to_trash(file_path: &str) -> std::result::Result<String, String> {
    let src = PathBuf::from(file_path);
    if !src.exists() {
        return Ok(file_path.to_string());
    }
    let trash_dir = get_trash_dir();
    let file_name = src.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut dest = trash_dir.join(&file_name);
    let mut counter = 1;
    while dest.exists() {
        let stem = src.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = src.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let new_name = format!("{}_{}{}", stem, counter, ext);
        dest = trash_dir.join(&new_name);
        counter += 1;
    }
    std::fs::rename(&src, &dest).map_err(|e| format!("移动文件失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

fn move_thumbnail_to_trash(thumbnail_path: &str) -> std::result::Result<String, String> {
    let src = PathBuf::from(thumbnail_path);
    if !src.exists() {
        return Ok(thumbnail_path.to_string());
    }
    let trash_dir = get_trash_dir().join("thumbnails");
    if !trash_dir.exists() {
        let _ = std::fs::create_dir_all(&trash_dir);
    }
    let file_name = src.file_name().unwrap_or_default().to_string_lossy().to_string();
    let mut dest = trash_dir.join(&file_name);
    let mut counter = 1;
    while dest.exists() {
        let stem = src.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = src.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let new_name = format!("{}_{}{}", stem, counter, ext);
        dest = trash_dir.join(&new_name);
        counter += 1;
    }
    std::fs::rename(&src, &dest).map_err(|e| format!("移动缩略图失败: {}", e))?;
    Ok(dest.to_string_lossy().to_string())
}

pub fn soft_delete_screenshot(conn: &Connection, id: i32) -> std::result::Result<(), String> {
    let ss = conn.query_row(
        "SELECT id, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash FROM screenshots WHERE id = ?1",
        params![id],
        |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                row.get::<_, i64>(6)?,
                row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                row.get::<_, Option<String>>(9)?,
            ))
        }
    ).map_err(|e| format!("查询截图失败: {}", e))?;

    let (_, file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash) = ss;
    let original_file_path = file_path.clone();
    let original_thumbnail_path = thumbnail_path.clone();

    let new_file_path = move_file_to_trash(&file_path)?;
    let new_thumbnail_path = move_thumbnail_to_trash(&thumbnail_path)?;

    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO deleted_screenshots (original_id, file_path, thumbnail_path, original_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![id, new_file_path, new_thumbnail_path, original_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash, now],
    ).map_err(|e| format!("插入回收站记录失败: {}", e))?;

    conn.execute("DELETE FROM screenshots WHERE id = ?1", params![id])
        .map_err(|e| format!("删除原记录失败: {}", e))?;

    Ok(())
}

pub fn soft_delete_screenshots(conn: &Connection, ids: &[i32]) -> std::result::Result<(), String> {
    for id in ids {
        soft_delete_screenshot(conn, *id)?;
    }
    Ok(())
}

pub fn get_deleted_screenshots_with_pagination(
    conn: &Connection,
    sort_order: &str,
    page: i32,
    page_size: i32,
) -> std::result::Result<crate::models::PaginationResult, String> {
    let offset = (page - 1) * page_size;
    let order = if sort_order == "original_asc" { "timestamp ASC" } else if sort_order == "original_desc" { "timestamp DESC" } else if sort_order == "asc" { "deleted_at ASC" } else { "deleted_at DESC" };

    let total_count: i32 = conn.query_row("SELECT COUNT(*) FROM deleted_screenshots", [], |row| row.get(0))
        .map_err(|e| format!("统计失败: {}", e))?;

    let total_pages = if total_count == 0 { 1 } else { (total_count + page_size - 1) / page_size };

    let sql = format!(
        "SELECT id, original_id, file_path, thumbnail_path, original_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash, deleted_at
         FROM deleted_screenshots ORDER BY {} LIMIT ?1 OFFSET ?2",
        order
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("准备查询失败: {}", e))?;
    let screenshots: Vec<crate::models::ScreenshotRecord> = stmt.query_map(params![page_size, offset], |row| {
        Ok(crate::models::ScreenshotRecord {
            id: row.get(0)?,
            file_path: row.get::<_, String>(2)?,
            thumbnail_path: row.get::<_, String>(3)?,
            game_id: row.get::<_, String>(6)?,
            game_title: row.get::<_, String>(7)?,
            display_title: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            timestamp: row.get::<_, i64>(13)?,
            note: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            game_banner_url: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
        })
    }).map_err(|e| format!("查询失败: {}", e))?.collect::<Result<Vec<_>, _>>().map_err(|e| format!("解析失败: {}", e))?;

    Ok(crate::models::PaginationResult {
        screenshots,
        total: total_count,
        page,
        page_size,
        total_pages,
    })
}

pub fn restore_screenshot(conn: &Connection, id: i32) -> std::result::Result<(), String> {
    let record = conn.query_row(
        "SELECT id, file_path, thumbnail_path, original_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash FROM deleted_screenshots WHERE id = ?1",
        params![id],
        |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                row.get::<_, i64>(8)?,
                row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                row.get::<_, Option<String>>(11)?,
            ))
        }
    ).map_err(|e| format!("查询回收站记录失败: {}", e))?;

    let (_, file_path, thumbnail_path, original_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash) = record;

    let mut restored_file_path = original_file_path.clone();
    let original_dir = PathBuf::from(&original_file_path).parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
    if !original_dir.exists() {
        let _ = std::fs::create_dir_all(&original_dir);
    }
    if PathBuf::from(&original_file_path).exists() {
        let stem = PathBuf::from(&original_file_path).file_stem().unwrap_or_default().to_string_lossy().to_string();
        let ext = PathBuf::from(&original_file_path).extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
        let data_dir = get_data_dir();
        let game_dir = data_dir.join(&game_id);
        let _ = std::fs::create_dir_all(&game_dir);
        let mut counter = 1;
        let mut new_path = game_dir.join(&original_file_path);
        loop {
            let new_name = format!("{}_{}{}", stem, counter, ext);
            new_path = game_dir.join(&new_name);
            if !new_path.exists() { break; }
            counter += 1;
        }
        restored_file_path = new_path.to_string_lossy().to_string();
    } else {
        if let Err(e) = std::fs::rename(&file_path, &original_file_path) {
            println!("[恢复] 移动文件失败: {}, 尝试复制", e);
            std::fs::copy(&file_path, &original_file_path).map_err(|e2| format!("复制文件失败: {}", e2))?;
            let _ = std::fs::remove_file(&file_path);
        }
    }

    if !PathBuf::from(&original_thumbnail_path).exists() {
        if PathBuf::from(&thumbnail_path).exists() {
            let thumb_dir = PathBuf::from(&original_thumbnail_path).parent().unwrap_or(&PathBuf::from(".")).to_path_buf();
            if !thumb_dir.exists() {
                let _ = std::fs::create_dir_all(&thumb_dir);
            }
            let _ = std::fs::rename(&thumbnail_path, &original_thumbnail_path);
        }
    }

    conn.execute(
        "INSERT INTO screenshots (file_path, thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![restored_file_path, original_thumbnail_path, game_id, game_title, display_title, timestamp, note, game_banner_url, file_hash],
    ).map_err(|e| format!("恢复记录失败: {}", e))?;

    conn.execute("DELETE FROM deleted_screenshots WHERE id = ?1", params![id])
        .map_err(|e| format!("删除回收站记录失败: {}", e))?;

    let game_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM game_cache WHERE game_id = ?1)",
        params![game_id],
        |row| row.get(0),
    ).unwrap_or(false);

    if !game_exists {
        conn.execute(
            "INSERT OR IGNORE INTO game_cache (game_id, exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status) SELECT game_id, exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status FROM deleted_games WHERE game_id = ?1",
            params![game_id],
        ).map_err(|e| format!("恢复游戏记录失败: {}", e))?;

        conn.execute("DELETE FROM deleted_games WHERE game_id = ?1", params![game_id])
            .map_err(|e| format!("删除回收站游戏记录失败: {}", e))?;
    }

    Ok(())
}

pub fn restore_screenshots(conn: &Connection, ids: &[i32]) -> std::result::Result<(), String> {
    for id in ids {
        restore_screenshot(conn, *id)?;
    }
    Ok(())
}

pub fn permanent_delete_screenshot(conn: &Connection, id: i32) -> std::result::Result<(), String> {
    let record = conn.query_row(
        "SELECT file_path, thumbnail_path, game_id FROM deleted_screenshots WHERE id = ?1",
        params![id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    ).map_err(|e| format!("查询回收站记录失败: {}", e))?;

    let (file_path, thumbnail_path, game_id) = record;
    let _ = std::fs::remove_file(&file_path);
    let _ = std::fs::remove_file(&thumbnail_path);

    conn.execute("DELETE FROM deleted_screenshots WHERE id = ?1", params![id])
        .map_err(|e| format!("删除回收站记录失败: {}", e))?;

    let remaining: i32 = conn.query_row(
        "SELECT COUNT(*) FROM deleted_screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0),
    ).unwrap_or(0);

    let in_screenshots: i32 = conn.query_row(
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0),
    ).unwrap_or(0);

    if remaining == 0 && in_screenshots == 0 {
        conn.execute("DELETE FROM deleted_games WHERE game_id = ?1", params![game_id])
            .map_err(|e| format!("清理回收站游戏记录失败: {}", e))?;
    }

    Ok(())
}

pub fn permanent_delete_screenshots(conn: &Connection, ids: &[i32]) -> std::result::Result<(), String> {
    for id in ids {
        permanent_delete_screenshot(conn, *id)?;
    }
    Ok(())
}

pub fn cleanup_expired_deleted(conn: &Connection) -> std::result::Result<usize, String> {
    let now = chrono::Utc::now().timestamp();
    let thirty_days_ago = now - 30 * 24 * 60 * 60;

    let mut stmt = conn.prepare(
        "SELECT id, file_path, thumbnail_path FROM deleted_screenshots WHERE deleted_at < ?1"
    ).map_err(|e| format!("查询过期记录失败: {}", e))?;

    let expired: Vec<(i32, String, String)> = stmt.query_map(params![thirty_days_ago], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).map_err(|e| format!("查询失败: {}", e))?.collect::<Result<Vec<_>, _>>().map_err(|e| format!("解析失败: {}", e))?;

    let count = expired.len();
    for (id, file_path, thumbnail_path) in &expired {
        let _ = std::fs::remove_file(file_path);
        let _ = std::fs::remove_file(thumbnail_path);
        conn.execute("DELETE FROM deleted_screenshots WHERE id = ?1", params![id])
            .map_err(|e| format!("删除记录失败: {}", e))?;
    }

    conn.execute(
        "DELETE FROM deleted_games WHERE deleted_at < ?1 AND game_id NOT IN (SELECT DISTINCT game_id FROM deleted_screenshots)",
        params![thirty_days_ago],
    ).map_err(|e| format!("清理过期游戏记录失败: {}", e))?;

    Ok(count)
}

pub fn get_deleted_screenshots_count(conn: &Connection) -> i32 {
    conn.query_row("SELECT COUNT(*) FROM deleted_screenshots", [], |row| row.get(0))
        .unwrap_or(0)
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
                old_dir_deleted: false,
                old_dir_pending_delete: None,
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
            old_dir_deleted: false,
            old_dir_pending_delete: None,
        });
    }
    
    save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 迁移完成: {} 文件, {} 字节", stats.copied_files, stats.total_size);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: Some(stats),
        old_dir_deleted: false,
        old_dir_pending_delete: None,
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
            old_dir_deleted: false,
            old_dir_pending_delete: None,
        });
    }
    
    let new_dir_str = new_data_dir.to_string_lossy().to_string();
    
    let db_path = new_data_dir.join("screenshots_v2.db");
    match Connection::open(&db_path) {
        Ok(conn) => {
            let sample_path: Option<String> = conn.query_row(
                "SELECT file_path FROM screenshots LIMIT 1",
                [],
                |row| row.get(0)
            ).ok();
            
            if let Some(path) = sample_path {
                if !path.starts_with(&new_dir_str) {
                    println!("[切换] 检测到路径不匹配，更新数据库路径...");
                    
                    let old_dir = extract_data_dir_from_path(&path);
                    
                    if old_dir != new_dir_str {
                        println!("[切换] 旧目录: {}", old_dir);
                        println!("[切换] 新目录: {}", new_dir_str);
                        
                        let _ = conn.execute(
                            "UPDATE screenshots SET file_path = REPLACE(file_path, ?1, ?2)",
                            params![&old_dir, &new_dir_str],
                        );
                        
                        let _ = conn.execute(
                            "UPDATE screenshots SET thumbnail_path = REPLACE(thumbnail_path, ?1, ?2)",
                            params![&old_dir, &new_dir_str],
                        );
                        
                        let _ = conn.execute(
                            "UPDATE game_cache SET icon_path = REPLACE(icon_path, ?1, ?2) WHERE icon_path IS NOT NULL",
                            params![&old_dir, &new_dir_str],
                        );
                        
                        let _ = conn.execute(
                            "UPDATE game_cache SET steam_logo_path = REPLACE(steam_logo_path, ?1, ?2) WHERE steam_logo_path IS NOT NULL",
                            params![&old_dir, &new_dir_str],
                        );
                        
                        println!("[切换] 路径更新完成");
                    }
                }
            }
        }
        Err(e) => {
            println!("[切换] 无法打开数据库: {}", e);
        }
    }
    
    save_custom_data_dir(&new_data_dir);
    
    println!("[切换] 数据目录已切换到: {:?}", new_data_dir);
    println!("[切换] 旧目录: {:?}", old_data_dir);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: None,
        old_dir_deleted: false,
        old_dir_pending_delete: Some(old_data_dir.to_string_lossy().to_string()),
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

pub fn get_shutter_sound(conn: &Connection) -> String {
    get_setting(conn, "shutter_sound")
        .unwrap_or_else(|| "default".to_string())
}

pub fn set_shutter_sound(conn: &Connection, sound_type: &str) -> Result<()> {
    set_setting(conn, "shutter_sound", sound_type)
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
    conn.execute(
        "UPDATE game_cache SET display_title = ?1 WHERE game_id = ?2",
        params![display_title, game_id],
    )?;
    println!("[数据库] 更新游戏 {} 的显示标题为: {}", game_id, display_title);
    Ok(())
}

pub fn update_game_cache(conn: &Connection, game_id: &str, steam_appid: Option<u32>, steam_name: Option<String>, steam_logo_path: Option<String>) -> Result<()> {
    let timestamp = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE game_cache SET steam_appid = ?1, steam_name = ?2, steam_logo_path = ?3, steam_match_status = 'manual', last_updated = ?4 WHERE game_id = ?5",
        params![steam_appid, steam_name, steam_logo_path, timestamp, game_id],
    )?;
    println!("[数据库] 更新游戏 {} 的Steam信息", game_id);
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

pub fn create_empty_game(conn: &Connection, game_id: &str, display_title: &str, steam_appid: Option<u32>, steam_name: Option<String>, steam_logo_path: Option<String>) -> Result<()> {
    let timestamp = chrono::Utc::now().timestamp();
    
    let cache = GameCache {
        game_id: game_id.to_string(),
        exe_path: None,
        icon_path: None,
        display_title: Some(display_title.to_string()),
        last_updated: timestamp,
        steam_appid,
        steam_name,
        steam_logo_path,
        steam_match_status: Some("manual".to_string()),
    };
    
    set_game_cache(conn, &cache)?;
    
    println!("[数据库] 创建空白游戏: {} ({})", display_title, game_id);
    Ok(())
}

pub fn delete_game(conn: &Connection, game_id: &str) -> std::result::Result<(), String> {
    let screenshot_ids: Vec<i32> = {
        let mut stmt = conn.prepare("SELECT id FROM screenshots WHERE game_id = ?1").map_err(|e| format!("查询失败: {}", e))?;
        let rows = stmt.query_map(params![game_id], |row| row.get(0)).map_err(|e| format!("查询失败: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("解析失败: {}", e))?
    };
    
    for id in &screenshot_ids {
        soft_delete_screenshot(conn, *id)?;
    }
    
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT OR IGNORE INTO deleted_games (game_id, exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status, deleted_at) SELECT game_id, exe_path, icon_path, display_title, last_updated, steam_appid, steam_name, steam_logo_path, steam_match_status, ?2 FROM game_cache WHERE game_id = ?1",
        params![game_id, now],
    ).map_err(|e| format!("移动游戏缓存到回收站失败: {}", e))?;
    
    conn.execute("DELETE FROM game_cache WHERE game_id = ?1", params![game_id])
        .map_err(|e| format!("删除游戏缓存失败: {}", e))?;
    println!("[数据库] 软删除游戏及其所有截图: {}", game_id);
    Ok(())
}

pub fn delete_games(conn: &Connection, game_ids: &[String]) -> std::result::Result<(), String> {
    if game_ids.is_empty() {
        return Ok(());
    }
    
    for game_id in game_ids {
        delete_game(conn, game_id)?;
    }
    
    println!("[数据库] 批量软删除 {} 个游戏", game_ids.len());
    Ok(())
}

pub fn get_game_screenshot_count(conn: &Connection, game_id: &str) -> Result<i32> {
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0)
    )?;
    Ok(count)
}

pub fn import_screenshot(
    conn: &Connection,
    file_path: &str,
    thumbnail_path: &str,
    game_id: &str,
    game_title: &str,
    timestamp: i64,
) -> Result<i64> {
    insert_screenshot(conn, file_path, thumbnail_path, game_id, game_title, timestamp, None)
}

pub fn get_all_games(conn: &Connection) -> Result<Vec<GameSummary>> {
    let mut stmt = conn.prepare(
        "SELECT gc.game_id, gc.display_title, gc.steam_logo_path, gc.icon_path
         FROM game_cache gc
         ORDER BY gc.last_updated DESC",
    )?;

    let iter = stmt.query_map([], |row| {
        Ok(GameSummary {
            game_id: row.get(0)?,
            game_title: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
            display_title: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            game_banner_url: String::new(),
            count: 0,
            last_timestamp: 0,
            game_icon_path: row.get(3)?,
            steam_logo_path: row.get(2)?,
        })
    })?;

    iter.collect()
}
