use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use image::DynamicImage;
use notify::{Watcher, RecommendedWatcher, RecursiveMode, Event, EventKind, Config};
use winapi::shared::windef::HWND;
use winapi::shared::minwindef::{LPARAM, BOOL};
use winapi::um::winuser::{
    EnumWindows, GetWindowThreadProcessId, IsWindowVisible,
    SetForegroundWindow, AttachThreadInput, BringWindowToTop,
    ShowWindow, SW_RESTORE, GetForegroundWindow,
    MapVirtualKeyW, GetClassNameW, GetWindowTextW,
    keybd_event, KEYEVENTF_KEYUP,
};
use winapi::um::processthreadsapi::GetCurrentThreadId;

pub struct RetroArchConfig {
    pub screenshot_directory: PathBuf,
    pub screenshot_key: String,
}

pub fn is_retroarch_process(process_name: &str) -> bool {
    let name_lower = process_name.to_lowercase();
    name_lower == "retroarch" || name_lower == "retroarch.exe"
}

pub fn find_retroarch_cfg(exe_path: &str) -> Option<PathBuf> {
    let exe = Path::new(exe_path);
    let dir = exe.parent()?;
    let cfg_path = dir.join("retroarch.cfg");
    if cfg_path.exists() {
        println!("[RetroArch] 找到配置文件: {:?}", cfg_path);
        Some(cfg_path)
    } else {
        println!("[RetroArch] 配置文件不存在: {:?}", cfg_path);
        None
    }
}

pub fn read_retroarch_config(cfg_path: &Path, retroarch_dir: &Path) -> Result<RetroArchConfig, String> {
    let content = std::fs::read_to_string(cfg_path)
        .map_err(|e| format!("读取 retroarch.cfg 失败: {}", e))?;

    let mut screenshot_directory: Option<String> = None;
    let mut screenshot_key: Option<String> = None;

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim();
            let value = line[eq_pos + 1..].trim();
            let unquoted = value.trim_matches('"').trim();

            match key {
                "screenshot_directory" => {
                    println!("[RetroArch] 配置项 screenshot_directory 原始值: {:?}", unquoted);
                    if !unquoted.is_empty() && unquoted != ":" {
                        let expanded = expand_retroarch_path(unquoted, retroarch_dir);
                        println!("[RetroArch] 截图目录: {}", expanded);
                        screenshot_directory = Some(expanded);
                    } else {
                        println!("[RetroArch] 截图目录为空或默认(:)，将使用默认路径");
                    }
                }
                "input_screenshot" => {
                    if !unquoted.is_empty() {
                        screenshot_key = Some(unquoted.to_string());
                        println!("[RetroArch] 截图快捷键: {}", unquoted);
                    }
                }
                _ => {}
            }
        }
    }

    let screenshot_directory = screenshot_directory.unwrap_or_else(|| {
        let default_dir = retroarch_dir.join("screenshots");
        println!("[RetroArch] 未配置截图目录，使用默认: {:?}", default_dir);
        default_dir.to_string_lossy().to_string()
    });

    let screenshot_key = screenshot_key.unwrap_or_else(|| "f8".to_string());

    // 兜底检查：如果目录不存在且 retroarch_dir/screenshots 目录存在，优先使用后者
    let screenshot_dir_path = PathBuf::from(&screenshot_directory);
    let default_dir = retroarch_dir.join("screenshots");
    if !screenshot_dir_path.exists() && default_dir.exists() {
        println!("[RetroArch] 配置的截图目录不存在({:?})，回退到默认目录({:?})",
            screenshot_dir_path, default_dir);
        std::fs::create_dir_all(&default_dir)
            .map_err(|e| format!("创建截图目录失败: {}", e))?;
        return Ok(RetroArchConfig {
            screenshot_directory: default_dir,
            screenshot_key,
        });
    }

    if !screenshot_dir_path.exists() {
        std::fs::create_dir_all(&screenshot_dir_path)
            .map_err(|e| format!("创建截图目录失败: {}", e))?;
    } else {
        println!("[RetroArch] 截图目录已存在: {:?}", screenshot_dir_path);
    }

    Ok(RetroArchConfig {
        screenshot_directory: screenshot_dir_path,
        screenshot_key,
    })
}

fn expand_retroarch_path(path: &str, retroarch_dir: &Path) -> String {
    if path.starts_with(':') {
        // RetroArch 中 : 代表程序目录。去掉 : 后再去掉前导的 \ 或 /
        // 这里不能用 trim_start_matches 一刀切，需要用 strip_prefix + 手动处理斜杠
        let relative = path.strip_prefix(':').unwrap_or(path);
        let relative = relative.strip_prefix('\\').unwrap_or(relative);
        let relative = relative.strip_prefix('/').unwrap_or(relative);

        let result = retroarch_dir.join(relative);
        println!("[RetroArch] 路径展开: {:?} + {:?} = {:?}", retroarch_dir, relative, result);
        return result.to_string_lossy().to_string();
    }

    if path.starts_with('~') {
        let relative = path.strip_prefix('~').unwrap_or(path);
        let relative = relative.strip_prefix('\\').unwrap_or(relative);
        let relative = relative.strip_prefix('/').unwrap_or(relative);
        if let Some(home) = dirs::home_dir() {
            let result = home.join(relative);
            println!("[RetroArch] 路径展开(~): {:?} + {:?} = {:?}", home, relative, result);
            return result.to_string_lossy().to_string();
        }
    }

    let expanded = path.replace("%USERPROFILE%", &std::env::var("USERPROFILE").unwrap_or_default());
    let expanded = expanded.replace("%APPDATA%", &std::env::var("APPDATA").unwrap_or_default());
    let expanded = expanded.replace("%LOCALAPPDATA%", &std::env::var("LOCALAPPDATA").unwrap_or_default());

    expanded
}

struct FindWindowData {
    target_pid: u32,
    result_hwnd: HWND,
}

unsafe extern "system" fn find_window_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let data = &mut *(lparam as *mut FindWindowData);
    let mut pid: u32 = 0;
    GetWindowThreadProcessId(hwnd, &mut pid);

    if pid == data.target_pid && IsWindowVisible(hwnd) != 0 {
        data.result_hwnd = hwnd;
        return 0;
    }

    1
}

fn find_window_by_pid(target_pid: u32) -> Option<(HWND, String, String)> {
    let mut data = FindWindowData {
        target_pid,
        result_hwnd: std::ptr::null_mut(),
    };

    unsafe {
        EnumWindows(
            Some(find_window_callback),
            &mut data as *mut _ as LPARAM,
        );
    }

    if data.result_hwnd.is_null() {
        None
    } else {
        let hwnd = data.result_hwnd;
        let (class_name, title) = unsafe { get_window_info(hwnd) };
        Some((hwnd, class_name, title))
    }
}

unsafe fn get_window_info(hwnd: HWND) -> (String, String) {
    let mut class_buf: [u16; 256] = [0; 256];
    let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), 256);
    let class_name = if class_len > 0 {
        String::from_utf16_lossy(&class_buf[..class_len as usize])
    } else {
        "N/A".to_string()
    };

    let mut title_buf: [u16; 256] = [0; 256];
    let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 256);
    let title = if title_len > 0 {
        String::from_utf16_lossy(&title_buf[..title_len as usize])
    } else {
        "N/A".to_string()
    };

    (class_name, title)
}

fn force_set_foreground_window(hwnd: HWND) -> Result<(), String> {
    unsafe {
        let foreground_hwnd = GetForegroundWindow();
        if foreground_hwnd == hwnd {
            println!("[RetroArch] 窗口已是前台");
            return Ok(());
        }

        let foreground_tid = GetWindowThreadProcessId(foreground_hwnd, std::ptr::null_mut());
        let our_tid = GetCurrentThreadId();

        let attached = if foreground_tid != 0 && foreground_tid != our_tid {
            let result = AttachThreadInput(our_tid, foreground_tid, 1);
            if result == 0 {
                println!("[RetroArch] AttachThreadInput 失败 (错误码: {}), 尝试继续",
                    winapi::um::errhandlingapi::GetLastError());
            } else {
                println!("[RetroArch] AttachThreadInput 成功 (our_tid={}, fg_tid={})", our_tid, foreground_tid);
            }
            result != 0
        } else {
            false
        };

        ShowWindow(hwnd, SW_RESTORE);
        let sfw_result = SetForegroundWindow(hwnd);
        println!("[RetroArch] SetForegroundWindow 返回: {}, GetLastError: {}",
            sfw_result, winapi::um::errhandlingapi::GetLastError());
        BringWindowToTop(hwnd);

        std::thread::sleep(Duration::from_millis(50));

        if attached {
            AttachThreadInput(our_tid, foreground_tid, 0);
        }

        let new_fg = GetForegroundWindow();
        if new_fg == hwnd {
            println!("[RetroArch] 成功设置前台窗口");
        } else {
            println!("[RetroArch] 警告: 未能将RetroArch设为前台窗口 (目标={:?}, 实际前台={:?})", hwnd, new_fg);
        }

        Ok(())
    }
}

pub fn send_screenshot_key(key_name: &str, pid: u32) -> Result<(), String> {
    let (hwnd, class_name, window_title) = find_window_by_pid(pid)
        .ok_or_else(|| format!("找不到RetroArch窗口 (PID: {})", pid))?;

    println!(
        "[RetroArch] 窗口详情: HWND={:?}, class=\"{}\", title=\"{}\", PID={}",
        hwnd, class_name, window_title, pid
    );

    let target_tid = unsafe { GetWindowThreadProcessId(hwnd, std::ptr::null_mut()) };
    let our_tid = unsafe { GetCurrentThreadId() };
    println!("[RetroArch] 窗口线程ID: {}, 当前线程ID: {}", target_tid, our_tid);

    force_set_foreground_window(hwnd)?;

    let (vk, scan_code) = parse_key_name(key_name)?;

    unsafe {
        keybd_event(vk as u8, scan_code as u8, 0, 0);
        std::thread::sleep(Duration::from_millis(50));
        keybd_event(vk as u8, scan_code as u8, KEYEVENTF_KEYUP, 0);
    }

    println!("[RetroArch] 已通过 keybd_event 发送截图按键: {} (vk=0x{:02X}, scan=0x{:02X})", key_name, vk, scan_code);

    Ok(())
}

fn parse_key_name(key_name: &str) -> Result<(u16, u16), String> {
    let key_lower = key_name.to_lowercase();

    let vk: u16 = match key_lower.as_str() {
        "f1" => 0x70,
        "f2" => 0x71,
        "f3" => 0x72,
        "f4" => 0x73,
        "f5" => 0x74,
        "f6" => 0x75,
        "f7" => 0x76,
        "f8" => 0x77,
        "f9" => 0x78,
        "f10" => 0x79,
        "f11" => 0x7A,
        "f12" => 0x7B,
        "printscreen" | "print" | "prtsc" | "prtscn" => 0x2C,
        "scrolllock" => 0x91,
        "pause" => 0x13,
        "insert" => 0x2D,
        "delete" => 0x2E,
        "home" => 0x24,
        "end" => 0x23,
        "pageup" => 0x21,
        "pagedown" => 0x22,
        "numpad0" => 0x60,
        "numpad1" => 0x61,
        "numpad2" => 0x62,
        "numpad3" => 0x63,
        "numpad4" => 0x64,
        "numpad5" => 0x65,
        "numpad6" => 0x66,
        "numpad7" => 0x67,
        "numpad8" => 0x68,
        "numpad9" => 0x69,
        s if s.len() == 1 => {
            let c = s.chars().next().unwrap();
            c.to_uppercase().next().unwrap() as u16
        }
        _ => return Err(format!("不支持的按键: {}", key_name)),
    };

    let scan_code = unsafe { MapVirtualKeyW(vk as u32, 0) as u16 };
    if scan_code == 0 {
        return Err(format!("无法获取按键 {} 的扫描码 (vk=0x{:02X})", key_name, vk));
    }

    println!("[RetroArch] 按键映射: {} -> vk=0x{:02X}, scan=0x{:02X}", key_name, vk, scan_code);
    Ok((vk, scan_code))
}

pub fn wait_for_screenshot_file(
    screenshot_dir: &Path,
    timeout_ms: u64,
) -> Result<PathBuf, String> {
    let existing_files = list_image_files(screenshot_dir);
    println!("[RetroArch] 开始监听截图目录: {:?}, 已有文件数: {}, 超时: {}ms",
        screenshot_dir, existing_files.len(), timeout_ms);

    let (tx, rx) = std::sync::mpsc::channel::<PathBuf>();

    let tx_clone = tx.clone();

    let mut watcher: RecommendedWatcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) => {
                        for path in &event.paths {
                            if is_image_file(path) {
                                println!("[RetroArch] 检测到文件事件: {:?} -> {:?}", event.kind, path);
                                let _ = tx_clone.send(path.clone());
                            }
                        }
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    ).map_err(|e| format!("创建文件监听器失败: {}", e))?;

    watcher.watch(screenshot_dir, RecursiveMode::NonRecursive)
        .map_err(|e| format!("监听目录失败: {}", e))?;

    let start = Instant::now();
    let timeout = Duration::from_millis(timeout_ms);

    loop {
        let remaining = timeout.saturating_sub(start.elapsed());
        if remaining.is_zero() {
            break;
        }

        match rx.recv_timeout(remaining) {
            Ok(new_path) => {
                if !existing_files.contains(&new_path) {
                    if wait_for_file_ready(&new_path, 5) {
                        println!("[RetroArch] 获取到新截图文件: {:?}", new_path);
                        drop(watcher);
                        return Ok(new_path);
                    }
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => break,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }

    drop(watcher);

    println!("[RetroArch] 目录监听超时，尝试扫描目录查找新文件...");
    let new_files = list_image_files(screenshot_dir);
    for new_file in &new_files {
        if !existing_files.contains(new_file) {
            if wait_for_file_ready(new_file, 3) {
                println!("[RetroArch] 在目录扫描中找到新文件: {:?}", new_file);
                return Ok(new_file.clone());
            }
        }
    }

    Err(format!("等待RetroArch截图超时 (目录: {:?}, 超时: {}ms, 初始文件数: {}, 当前文件数: {})",
        screenshot_dir, timeout_ms, existing_files.len(), list_image_files(screenshot_dir).len()))
}

fn wait_for_file_ready(path: &Path, max_retries: u32) -> bool {
    for i in 0..max_retries {
        match std::fs::File::open(path) {
            Ok(file) => {
                if let Ok(metadata) = file.metadata() {
                    if metadata.len() > 0 {
                        return true;
                    }
                }
            }
            Err(_) => {}
        }
        if i < max_retries - 1 {
            std::thread::sleep(Duration::from_millis(100));
        }
    }
    false
}

fn list_image_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && is_image_file(&path) {
                files.push(path);
            }
        }
    }
    files
}

fn is_image_file(path: &Path) -> bool {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "bmp" | "webp" | "tga")
}

fn read_image_with_retry(path: &Path, max_retries: u32) -> Result<DynamicImage, String> {
    for i in 0..max_retries {
        match image::open(path) {
            Ok(img) => return Ok(img),
            Err(e) => {
                if i < max_retries - 1 {
                    println!("[RetroArch] 读取图片失败 (尝试 {}/{}): {}, 重试中...", i + 1, max_retries, e);
                    std::thread::sleep(Duration::from_millis(100));
                } else {
                    return Err(format!("读取RetroArch截图失败: {} (路径: {:?})", e, path));
                }
            }
        }
    }
    Err("读取图片失败".to_string())
}

pub fn parse_game_title_from_filename(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let re_timestamp = regex::Regex::new(r"-\d{6}-\d{6}$").ok()?;
    let after_timestamp = re_timestamp.replace(stem, "").to_string();
    let re_tags = regex::Regex::new(r"(\s*\([^)]*\))+$").ok()?;
    let title = re_tags.replace(&after_timestamp, "").to_string().trim().to_string();
    if title.is_empty() {
        None
    } else {
        println!("[RetroArch] 从文件名解析游戏标题: {} -> {}", stem, title);
        Some(title)
    }
}

pub struct RetroArchScreenshotResult {
    pub image: DynamicImage,
    pub screenshot_path: PathBuf,
}

pub fn capture_retroarch_screenshot(exe_path: &str, pid: u32) -> Result<RetroArchScreenshotResult, String> {
    let cfg_path = find_retroarch_cfg(exe_path)
        .ok_or_else(|| format!("找不到 retroarch.cfg (exe路径: {})", exe_path))?;

    let retroarch_dir = Path::new(exe_path).parent()
        .ok_or_else(|| "无法获取RetroArch目录".to_string())?;

    let config = read_retroarch_config(&cfg_path, retroarch_dir)?;

    let existing_count = list_image_files(&config.screenshot_directory).len();

    send_screenshot_key(&config.screenshot_key, pid)?;

    let screenshot_path = wait_for_screenshot_file(&config.screenshot_directory, 2000)?;

    let current_files = list_image_files(&config.screenshot_directory);
    if current_files.len() <= existing_count {
        println!("[RetroArch] 警告: 截图文件数未增加，可能截图未成功");
    }

    let img = read_image_with_retry(&screenshot_path, 5)?;

    println!("[RetroArch] RetroArch截图成功: {:?}, 尺寸: {}x{}",
        screenshot_path, img.width(), img.height());

    Ok(RetroArchScreenshotResult {
        image: img,
        screenshot_path,
    })
}
