use tauri::{State, Emitter, AppHandle};
use crate::models::*;
use crate::AppState;
use database as db;

#[derive(Clone, serde::Serialize)]
pub struct MigrationProgress {
    pub current: u32,
    pub total: u32,
    pub status: String,
}

#[tauri::command]
pub async fn migrate_data(app: AppHandle, new_path: String, state: State<'_, AppState>) -> Result<MigrationResult, String> {
    let old_data_dir = db::get_data_dir();
    let new_data_dir = std::path::PathBuf::from(&new_path);
    
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
    
    let _ = app.emit("migration-progress", MigrationProgress { 
        current: 0, 
        total: 0, 
        status: "开始迁移...".to_string() 
    });
    
    let mut stats = MigrationStats {
        total_files: 0,
        copied_files: 0,
        failed_files: 0,
        total_size: 0,
    };
    
    let old_dir_str = old_data_dir.to_string_lossy().to_string();
    let new_dir_str = new_data_dir.to_string_lossy().to_string();
    
    {
        let conn = state.db.lock().unwrap();
        if let Err(e) = db::update_paths_after_migration(&conn, &old_dir_str, &new_dir_str) {
            println!("[迁移] 更新路径失败: {}", e);
        }
    }
    
    let copy_result = copy_dir_with_progress(&app, &old_data_dir, &new_data_dir, &mut stats);
    if let Err(e) = copy_result {
        return Ok(MigrationResult {
            success: false,
            error: Some(format!("复制文件失败: {}", e)),
            stats: Some(stats),
        });
    }
    
    let _ = app.emit("migration-progress", MigrationProgress { 
        current: stats.copied_files, 
        total: stats.total_files, 
        status: "迁移完成".to_string() 
    });
    
    db::save_custom_data_dir(&new_data_dir);
    
    println!("[迁移] 迁移完成: {} 文件, {} 字节", stats.copied_files, stats.total_size);
    
    Ok(MigrationResult {
        success: true,
        error: None,
        stats: Some(stats),
    })
}

fn copy_dir_with_progress(app: &AppHandle, src: &std::path::PathBuf, dst: &std::path::PathBuf, stats: &mut MigrationStats) -> std::io::Result<()> {
    use std::fs;
    
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_with_progress(app, &path, &dst_path, stats)?;
        } else {
            stats.total_files += 1;
            
            if let Ok(metadata) = fs::metadata(&path) {
                stats.total_size += metadata.len();
            }
            
            match fs::copy(&path, &dst_path) {
                Ok(_) => {
                    stats.copied_files += 1;
                    let _ = app.emit("migration-progress", MigrationProgress {
                        current: stats.copied_files,
                        total: stats.total_files,
                        status: format!("复制: {:?}", path.file_name().unwrap_or_default()),
                    });
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

#[tauri::command]
pub fn switch_data_directory(new_path: String) -> Result<MigrationResult, String> {
    db::switch_data_directory(&new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_data_directory(path: String) -> Result<db::DirectoryCheckResult, String> {
    Ok(db::check_data_directory(&path))
}

#[tauri::command]
pub fn get_storage_path() -> Result<String, String> {
    Ok(db::get_storage_path())
}
