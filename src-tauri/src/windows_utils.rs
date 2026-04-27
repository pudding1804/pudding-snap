use winapi::um::winuser::{GetForegroundWindow, GetWindowThreadProcessId, GetDC, ReleaseDC, GetWindowTextW, GetWindowTextLengthW};
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::psapi::{GetModuleBaseNameW, GetModuleFileNameExW};
use winapi::um::winnt::PROCESS_QUERY_INFORMATION;
use winapi::um::winnt::PROCESS_VM_READ;
use winapi::um::shellapi::ExtractIconExW;
use winapi::um::wingdi::{GetDIBits, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, CreateCompatibleDC, DeleteDC, DeleteObject, BITMAP, GetObjectW};
use winapi::shared::windef::HICON;
use std::path::PathBuf;
use std::ptr;
use std::mem::size_of;
use image::{ImageBuffer, Rgba};

pub struct ForegroundProcessInfo {
    pub process_name: String,
    pub exe_path: Option<String>,
    pub pid: u32,
}

pub fn get_steam_running_appid() -> Option<u32> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu
        .open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ)
        .ok()?;

    let appid: u32 = steam_key.get_value("RunningAppID").ok()?;

    if appid > 0 {
        Some(appid)
    } else {
        None
    }
}

pub fn get_foreground_process_info() -> ForegroundProcessInfo {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return ForegroundProcessInfo {
                process_name: "Unknown".to_string(),
                exe_path: None,
                pid: 0,
            };
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return ForegroundProcessInfo {
                process_name: "Unknown".to_string(),
                exe_path: None,
                pid,
            };
        }

        let mut name: [u16; 1024] = [0; 1024];
        let name_len = GetModuleBaseNameW(handle, std::ptr::null_mut(), name.as_mut_ptr(), name.len() as u32);
        
        let process_name = if name_len > 0 {
            let name = String::from_utf16_lossy(&name[..name_len as usize]);
            name.trim_end_matches(".exe").to_string()
        } else {
            "Unknown".to_string()
        };

        let mut path: [u16; 1024] = [0; 1024];
        let path_len = GetModuleFileNameExW(handle, std::ptr::null_mut(), path.as_mut_ptr(), path.len() as u32);
        
        let exe_path = if path_len > 0 {
            Some(String::from_utf16_lossy(&path[..path_len as usize]))
        } else {
            None
        };

        ForegroundProcessInfo {
            process_name,
            exe_path,
            pid,
        }
    }
}

#[allow(dead_code)]
pub fn get_foreground_process_name() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return "Unknown".to_string();
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return "Unknown".to_string();
        }

        let mut name: [u16; 1024] = [0; 1024];
        let len = GetModuleBaseNameW(handle, std::ptr::null_mut(), name.as_mut_ptr(), name.len() as u32);
        
        if len > 0 {
            let name = String::from_utf16_lossy(&name[..len as usize]);
            let name = name.trim_end_matches(".exe");
            return name.to_string();
        }
        
        "Unknown".to_string()
    }
}

#[allow(dead_code)]
pub fn get_process_exe_path() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return None;
        }

        let mut path: [u16; 1024] = [0; 1024];
        let len = GetModuleFileNameExW(handle, std::ptr::null_mut(), path.as_mut_ptr(), path.len() as u32);
        
        if len > 0 {
            let path_str = String::from_utf16_lossy(&path[..len as usize]);
            return Some(path_str);
        }
        
        None
    }
}

pub fn extract_icon_from_exe(exe_path: &str, output_path: &PathBuf) -> Result<(), String> {
    unsafe {
        let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
        
        let mut hicon_large: HICON = ptr::null_mut();
        let result = ExtractIconExW(wide_path.as_ptr(), 0, &mut hicon_large, ptr::null_mut(), 1);
        
        if result == 0 || hicon_large.is_null() {
            return Err(format!("无法从 {} 提取图标", exe_path));
        }
        
        let icon_data = hicon_to_rgba(hicon_large)?;
        
        let img = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(
            icon_data.0,
            icon_data.1,
            icon_data.2,
        ).ok_or("无法创建图像缓冲区")?;
        
        img.save(output_path)
            .map_err(|e| format!("保存图标失败: {}", e))?;
        
        winapi::um::winuser::DestroyIcon(hicon_large);
        
        Ok(())
    }
}

unsafe fn hicon_to_rgba(hicon: HICON) -> Result<(u32, u32, Vec<u8>), String> {
    use winapi::um::winuser::{GetIconInfo, ICONINFO};
    
    let mut icon_info: ICONINFO = std::mem::zeroed();
    if GetIconInfo(hicon, &mut icon_info) == 0 {
        return Err("GetIconInfo 失败".to_string());
    }
    
    let hbmColor = icon_info.hbmColor;
    let hbmMask = icon_info.hbmMask;
    
    if hbmColor.is_null() {
        DeleteObject(hbmMask as *mut _);
        return Err("hbmColor 为空".to_string());
    }
    
    let mut bm: BITMAP = std::mem::zeroed();
    let obj_result = GetObjectW(hbmColor as *mut _, size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut _);
    if obj_result == 0 {
        DeleteObject(hbmColor as *mut _);
        DeleteObject(hbmMask as *mut _);
        return Err("GetObjectW(hbmColor) 失败".to_string());
    }
    
    let width = bm.bmWidth as u32;
    let height = bm.bmHeight as u32;
    
    if width == 0 || height == 0 {
        DeleteObject(hbmColor as *mut _);
        DeleteObject(hbmMask as *mut _);
        return Err(format!("图标尺寸无效: {}x{}", width, height));
    }
    
    let hdc = GetDC(ptr::null_mut());
    let mem_dc = CreateCompatibleDC(hdc);
    
    let mut bmi: BITMAPINFO = std::mem::zeroed();
    bmi.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as u32;
    bmi.bmiHeader.biWidth = width as i32;
    bmi.bmiHeader.biHeight = -(height as i32);
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;
    
    let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];
    
    let result = GetDIBits(
        mem_dc,
        hbmColor,
        0,
        height,
        pixels.as_mut_ptr() as *mut _,
        &mut bmi,
        DIB_RGB_COLORS,
    );
    
    let mask_bits = get_mask_bits(hbmMask as *mut _, width, height);

    DeleteDC(mem_dc);
    ReleaseDC(ptr::null_mut(), hdc);
    DeleteObject(hbmColor as *mut _);
    DeleteObject(hbmMask as *mut _);
    
    if result == 0 {
        return Err("GetDIBits 失败".to_string());
    }
    
    let total_pixels = (width * height) as usize;
    let mut zero_alpha = 0u32;
    
    let mut rgba: Vec<u8> = Vec::with_capacity(total_pixels * 4);
    for y in 0..height as usize {
        for x in 0..width as usize {
            let idx = (y * width as usize + x) * 4;
            rgba.push(pixels[idx + 2]);
            rgba.push(pixels[idx + 1]);
            rgba.push(pixels[idx]);
            if pixels[idx + 3] == 0 {
                zero_alpha += 1;
            }
            rgba.push(pixels[idx + 3]);
        }
    }
    
    let all_alpha_zero = zero_alpha == total_pixels as u32;
    
    if all_alpha_zero {
        println!("[图标] Alpha全部为0，从mask位图推导透明度 ({}x{})", width, height);
        for y in 0..height as usize {
            for x in 0..width as usize {
                let idx = (y * width as usize + x) * 4;
                let mask_visible = mask_bits.as_ref()
                    .map(|mb| !is_masked(mb, x, y, width as usize))
                    .unwrap_or(true);
                rgba[idx + 3] = if mask_visible { 255 } else { 0 };
            }
        }
    } else if zero_alpha > 0 {
        println!("[图标] Alpha部分为0: {}/{} 像素", zero_alpha, total_pixels);
    }
    
    println!("[图标] 图标提取: {}x{}, 尺寸={}bytes, alpha_zero={}/{}", width, height, pixels.len(), zero_alpha, total_pixels);
    
    Ok((width, height, rgba))
}

unsafe fn get_mask_bits(hbmMask: *mut std::ffi::c_void, width: u32, height: u32) -> Option<Vec<u8>> {
    if hbmMask.is_null() {
        return None;
    }
    
    let mask_hdc = CreateCompatibleDC(ptr::null_mut());
    let mut mask_bmi: BITMAPINFO = std::mem::zeroed();
    mask_bmi.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as u32;
    mask_bmi.bmiHeader.biWidth = width as i32;
    mask_bmi.bmiHeader.biHeight = -(height as i32);
    mask_bmi.bmiHeader.biPlanes = 1;
    mask_bmi.bmiHeader.biBitCount = 1;
    mask_bmi.bmiHeader.biCompression = BI_RGB;
    
    let row_bytes = ((width + 31) / 32) as usize * 4;
    let mut mask_pixels = vec![0u8; row_bytes * height as usize];
    
    let mr = GetDIBits(
        mask_hdc,
        hbmMask as *mut _,
        0,
        height,
        mask_pixels.as_mut_ptr() as *mut _,
        &mut mask_bmi,
        DIB_RGB_COLORS,
    );
    
    DeleteDC(mask_hdc);
    
    if mr == 0 {
        return None;
    }
    
    Some(mask_pixels)
}

fn is_masked(mask_bits: &[u8], x: usize, y: usize, width: usize) -> bool {
    let row_bytes = ((width + 31) / 32) * 4;
    let byte_idx = y * row_bytes + x / 8;
    let bit_idx = 7 - (x % 8);
    if byte_idx < mask_bits.len() {
        (mask_bits[byte_idx] >> bit_idx) & 1 == 1
    } else {
        false
    }
}

pub fn get_rpg_maker_game_title(exe_path: &str) -> Option<String> {
    let exe_path = std::path::Path::new(exe_path);
    let game_dir = exe_path.parent()?;
    
    let game_ini = game_dir.join("Game.ini");
    if game_ini.exists() {
        if let Ok(content) = std::fs::read_to_string(&game_ini) {
            let mut in_game_section = false;
            for line in content.lines() {
                let line = line.trim();
                if line == "[Game]" {
                    in_game_section = true;
                    continue;
                }
                if line.starts_with('[') && line.ends_with(']') {
                    in_game_section = false;
                    continue;
                }
                if in_game_section && line.starts_with("Title=") {
                    if let Some(title) = line.strip_prefix("Title=") {
                        if !title.is_empty() {
                            println!("[游戏ID] 从Game.ini读取标题: {}", title);
                            return Some(title.to_string());
                        }
                    }
                }
            }
        }
    }
    
    let system_json = game_dir.join("data").join("System.json");
    if system_json.exists() {
        if let Ok(content) = std::fs::read_to_string(&system_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(title) = json.get("gameTitle").and_then(|t| t.as_str()) {
                    if !title.is_empty() {
                        println!("[游戏ID] 从System.json读取标题: {}", title);
                        return Some(title.to_string());
                    }
                }
            }
        }
    }
    
    None
}

pub fn get_game_folder_name(exe_path: &str) -> Option<String> {
    let exe_path = std::path::Path::new(exe_path);
    let game_dir = exe_path.parent()?;
    game_dir.file_name().map(|n| n.to_string_lossy().to_string())
}

pub fn clean_game_name(folder_name: &str) -> String {
    let mut name = folder_name.to_string();
    
    let patterns = [
        (r"\.Build\.\d+$", ""),
        (r"\.v?\d+\.\d+\.\d+.*$", ""),
        (r"\.v?\d+\.\d+.*$", ""),
        (r"\s+Build\s*\d+.*$", ""),
        (r"\s+v\d+.*$", ""),
        (r"\s*\[.*?\]$", ""),
        (r"\s*\(.*?\)$", ""),
        (r"\.REPACK.*$", ""),
        (r"\.GOG.*$", ""),
        (r"\.Steam.*$", ""),
        (r"\.FINAL.*$", ""),
        (r"\.UPDATE.*$", ""),
        (r"\.DLC.*$", ""),
        (r"\.Complete.*$", ""),
        (r"\.Collection.*$", ""),
        (r"\.Edition.*$", ""),
        (r"\.Win64.*$", ""),
        (r"\.x64.*$", ""),
        (r"\.MULTi.*$", ""),
        (r"\-PLAZA$", ""),
        (r"\-CODEX$", ""),
        (r"\-SKIDROW$", ""),
        (r"\-FLT$", ""),
        (r"\-RELOADED$", ""),
        (r"\-PROPHET$", ""),
        (r"\-TiNYiSO$", ""),
        (r"\-HOODLUM$", ""),
        (r"\-DARKZER$", ""),
        (r"\-I_KnoW$", ""),
        (r"\-SiMPLEX$", ""),
        (r"\-DOGE$", ""),
        (r"\-GOG$", ""),
        (r"\-STEAM$", ""),
    ];
    
    for (pattern, replacement) in patterns {
        let re = regex::Regex::new(pattern).unwrap();
        name = re.replace(&name, replacement).to_string();
    }
    
    name = name.replace(".", " ");
    name = name.replace("_", " ");
    name = name.replace("  ", " ");
    name = name.trim().to_string();
    
    let words_to_capitalize = ["of", "the", "and", "a", "an", "to", "for", "in", "on", "at", "by", "with", "from"];
    let words: Vec<&str> = name.split_whitespace().collect();
    let result: Vec<String> = words.into_iter().enumerate().map(|(i, word)| {
        if i == 0 || !words_to_capitalize.contains(&word.to_lowercase().as_str()) {
            let mut chars = word.chars();
            match chars.next() {
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str().to_lowercase().as_str(),
                None => String::new(),
            }
        } else {
            word.to_lowercase()
        }
    }).collect();
    
    result.join(" ")
}

pub fn get_foreground_window_title() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let length = GetWindowTextLengthW(hwnd);
        if length == 0 {
            return None;
        }

        let mut buffer: Vec<u16> = vec![0; (length as usize) + 1];
        let copied = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        
        if copied > 0 {
            let title = String::from_utf16_lossy(&buffer[..copied as usize]);
            let trimmed = title.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        } else {
            None
        }
    }
}

const EMULATOR_PROCESS_NAMES: &[&str] = &[
    "dosbox", "dosbox-x", "dosbox-staging",
    "retroarch",
    "pcsx2", "pcsx2-qt",
    "rpcs3",
    "cemu",
    "yuzu", "suyu",
    "ryujinx",
    "dolphin",
    "ppsspp", "ppssppwindows",
    "mame", "mame64", "mameui",
    "snes9x", "snes9x-x64",
    "fusion", "kega-fusion", "kega",
    "mednafen",
    "flycast",
    "melonds", "melonds",
    "desmume",
    "vba", "visualboyadvance", "visualboyadvance-m", "vbam",
    "citra",
    "xemu",
    "project64", "project64c",
    "bsnes",
    "mesen",
    "nestopia",
    "fceux",
    "gens",
    "nullDC", "nulldc",
    "redream",
];

use std::sync::RwLock;
static CUSTOM_EMULATOR_NAMES: RwLock<Vec<String>> = RwLock::new(Vec::new());

pub fn set_custom_emulator_names(names: Vec<String>) {
    if let Ok(mut custom) = CUSTOM_EMULATOR_NAMES.write() {
        *custom = names;
        println!("[模拟器] 自定义模拟器列表已更新: {:?}", custom);
    }
}

pub fn get_custom_emulator_names() -> Vec<String> {
    CUSTOM_EMULATOR_NAMES.read().map(|c| c.clone()).unwrap_or_default()
}

fn is_emulator_by_name(name_lower: &str, emu: &str) -> bool {
    name_lower == emu || name_lower.starts_with(&format!("{}-", emu)) || name_lower.starts_with(&format!("{}_", emu))
}

pub fn is_emulator_process(process_name: &str) -> bool {
    let name_lower = process_name.to_lowercase();
    
    if EMULATOR_PROCESS_NAMES.iter().any(|&emu| is_emulator_by_name(&name_lower, emu)) {
        return true;
    }
    
    if let Ok(custom) = CUSTOM_EMULATOR_NAMES.read() {
        if custom.iter().any(|emu| is_emulator_by_name(&name_lower, emu)) {
            return true;
        }
    }
    
    false
}

pub fn extract_game_name_from_title(title: &str, process_name: &str) -> String {
    let name_lower = process_name.to_lowercase();
    if (name_lower == "retroarch" || name_lower == "retroarch.exe")
        && !title.contains("RetroArch") && !title.contains("retroarch") {
        return title.to_string();
    }

    let mut name = title.to_string();
    
    let mut emulator_to_check: Vec<String> = EMULATOR_PROCESS_NAMES.iter()
        .filter(|&&emu| is_emulator_by_name(&process_name.to_lowercase(), emu))
        .map(|&s| s.to_string())
        .collect();
    
    if let Ok(custom) = CUSTOM_EMULATOR_NAMES.read() {
        for emu in custom.iter() {
            if is_emulator_by_name(&process_name.to_lowercase(), emu) {
                emulator_to_check.push(emu.clone());
            }
        }
    }
    
    let emulator_suffixes: Vec<String> = emulator_to_check.iter()
        .flat_map(|emu| {
            let emu_str = emu.as_str();
            vec![
                format!(" - {}", emu_str),
                format!(" — {}", emu_str),
                format!(" | {}", emu_str),
                format!(" [{}]", emu_str),
                format!("({})", emu_str),
                format!(" - {}", emu_str.to_uppercase()),
                format!(" — {}", emu_str.to_uppercase()),
                format!(" | {}", emu_str.to_uppercase()),
                format!(" - {}", capitalize_first(emu_str)),
                format!(" — {}", capitalize_first(emu_str)),
                format!(" | {}", capitalize_first(emu_str)),
            ]
        }).collect();

    for suffix in &emulator_suffixes {
        if let Some(pos) = name.to_lowercase().find(&suffix.to_lowercase()) {
            let candidate = name[..pos].trim();
            if !candidate.is_empty() {
                name = candidate.to_string();
                break;
            }
        }
    }

    let generic_suffixes = [
        " - Emulator", " — Emulator", " | Emulator",
        " - ROM", " — ROM",
    ];
    for suffix in &generic_suffixes {
        if let Some(pos) = name.find(suffix) {
            let candidate = name[..pos].trim();
            if !candidate.is_empty() {
                name = candidate.to_string();
                break;
            }
        }
    }

    clean_window_title(&name)
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

pub fn clean_window_title(title: &str) -> String {
    let mut name = title.to_string();
    
    let remove_patterns = [
        r"\s*-\s*加载中\.+$",
        r"\s*-\s*Loading\.+$",
        r"\s*\[加载中\]$",
        r"\s*\[Loading\]$",
        r"\s*\[暂停\]$",
        r"\s*\[Paused\]$",
        r"\s*-\s*暂停$",
        r"\s*-\s*Paused$",
        r"\s*\[已暂停\]$",
        r"\s*\(Paused\)$",
        r"\s*\[\d+x\d+\]$",
        r"\s*\(\d+x\d+\)$",
        r"\s*\(Steam\)$",
        r"\s*\[Steam\]$",
        r"\s*\(GOG\)$",
        r"\s*\[GOG\]$",
        r"\s*\(Epic\)$",
        r"\s*\[Epic\]$",
        r"\s*v\d+\.\d+.*$",
        r"\s*Build\s*\d+.*$",
        r"\s*64-bit$",
        r"\s*32-bit$",
    ];
    
    for pattern in &remove_patterns {
        let re = regex::Regex::new(pattern).unwrap();
        name = re.replace(&name, "").to_string();
    }
    
    name.trim().to_string()
}

pub fn verify_steam_appid_for_process(appid: u32, foreground_exe_path: &str) -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_reg_key = match hkcu.open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ) {
        Ok(key) => key,
        Err(_) => return true,
    };

    let steam_path: String = match steam_reg_key.get_value("SteamPath") {
        Ok(p) => p,
        Err(_) => return true,
    };

    let mut library_paths = vec![steam_path.clone()];
    library_paths.extend(get_steam_library_folders(&steam_path));

    for lib_path in &library_paths {
        let acf_path = format!("{}\\steamapps\\appmanifest_{}.acf", lib_path, appid);
        let content = match std::fs::read_to_string(&acf_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if let Some(install_dir) = parse_acf_installdir(&content) {
            let game_dir = format!("{}\\steamapps\\common\\{}", lib_path, install_dir);
            if foreground_exe_path.to_lowercase().contains(&game_dir.to_lowercase()) {
                return true;
            }
        }
    }

    false
}

fn get_steam_library_folders(steam_path: &str) -> Vec<String> {
    let vdf_path = format!("{}\\steamapps\\libraryfolders.vdf", steam_path);
    let content = match std::fs::read_to_string(&vdf_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let mut folders = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(path_str) = trimmed.strip_prefix("\"path\"") {
            let path_val = path_str.trim();
            if let Some(p) = path_val.strip_prefix('"') {
                if let Some(end) = p.find('"') {
                    let lib_path = &p[..end];
                    let normalized = lib_path.replace("\\\\", "\\");
                    if !folders.contains(&normalized) && normalized != steam_path {
                        folders.push(normalized);
                    }
                }
            }
        }
    }

    folders
}

fn parse_acf_installdir(content: &str) -> Option<String> {
    let marker = "\"installdir\"";
    let pos = content.find(marker)?;
    let rest = &content[pos + marker.len()..];
    let quote_start = rest.find('"')?;
    let after_quote = &rest[quote_start + 1..];
    let quote_end = after_quote.find('"')?;
    Some(after_quote[..quote_end].to_string())
}
