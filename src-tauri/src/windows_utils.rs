use winapi::um::winuser::{GetForegroundWindow, GetWindowThreadProcessId, GetDC, ReleaseDC};
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
}

pub fn get_foreground_process_info() -> ForegroundProcessInfo {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return ForegroundProcessInfo {
                process_name: "Unknown".to_string(),
                exe_path: None,
            };
        }

        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);

        let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
        if handle.is_null() {
            return ForegroundProcessInfo {
                process_name: "Unknown".to_string(),
                exe_path: None,
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
        }
    }
}

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
    
    let mut bm: BITMAP = std::mem::zeroed();
    GetObjectW(icon_info.hbmColor as *mut _, size_of::<BITMAP>() as i32, &mut bm as *mut _ as *mut _);
    
    let width = bm.bmWidth as u32;
    let height = bm.bmHeight as u32;
    
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
        icon_info.hbmColor,
        0,
        height,
        pixels.as_mut_ptr() as *mut _,
        &mut bmi,
        DIB_RGB_COLORS,
    );
    
    DeleteDC(mem_dc);
    ReleaseDC(ptr::null_mut(), hdc);
    DeleteObject(icon_info.hbmColor as *mut _);
    DeleteObject(icon_info.hbmMask as *mut _);
    
    if result == 0 {
        return Err("GetDIBits 失败".to_string());
    }
    
    let mut rgba: Vec<u8> = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height as usize {
        for x in 0..width as usize {
            let idx = (y * width as usize + x) * 4;
            rgba.push(pixels[idx + 2]);
            rgba.push(pixels[idx + 1]);
            rgba.push(pixels[idx]);
            rgba.push(pixels[idx + 3]);
        }
    }
    
    Ok((width, height, rgba))
}

pub fn get_rpg_maker_game_title(exe_path: &str) -> Option<String> {
    let exe_path = std::path::Path::new(exe_path);
    let game_dir = exe_path.parent()?;
    
    let game_ini = game_dir.join("Game.ini");
    if !game_ini.exists() {
        return None;
    }
    
    let content = std::fs::read_to_string(&game_ini).ok()?;
    
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
            let title = line.strip_prefix("Title=")?;
            if !title.is_empty() {
                return Some(title.to_string());
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
