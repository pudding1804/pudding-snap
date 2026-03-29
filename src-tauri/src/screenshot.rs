use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use std::path::PathBuf;
use chrono::Utc;
use webp::PixelLayout;
use winapi::um::winuser::{GetForegroundWindow, GetWindowRect, GetClientRect, GetDC, ReleaseDC, GetDesktopWindow, GetCursorInfo, CURSORINFO, DrawIconEx, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
use winapi::um::wingdi::{BitBlt, SRCCOPY, CreateCompatibleDC, CreateCompatibleBitmap, SelectObject, DeleteDC, DeleteObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, GetDIBits};
use winapi::shared::minwindef::UINT;
use std::mem::size_of;

const DI_NORMAL: UINT = 0x0001;

pub fn capture_window(capture_mouse: bool) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return Err("Failed to get foreground window".into());
        }

        let mut client_rect = std::mem::zeroed();
        if GetClientRect(hwnd, &mut client_rect) == 0 {
            return Err("Failed to get client rect".into());
        }

        let width = (client_rect.right - client_rect.left) as u32;
        let height = (client_rect.bottom - client_rect.top) as u32;

        if width == 0 || height == 0 {
            return Err("Window has zero size".into());
        }

        let mut window_rect = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut window_rect) == 0 {
            return Err("Failed to get window rect".into());
        }

        let client_left = window_rect.left + (window_rect.right - window_rect.left - client_rect.right + client_rect.left) / 2;
        let client_top = window_rect.top + (window_rect.bottom - window_rect.top - client_rect.bottom + client_rect.top) - ((window_rect.right - window_rect.left - client_rect.right + client_rect.left) / 2);

        let desktop_hwnd = GetDesktopWindow();
        let screen_dc = GetDC(desktop_hwnd);
        if screen_dc.is_null() {
            return Err("Failed to get screen DC".into());
        }

        let mem_dc = CreateCompatibleDC(screen_dc);
        let hbitmap = CreateCompatibleBitmap(screen_dc, width as i32, height as i32);
        let old_bitmap = SelectObject(mem_dc, hbitmap as *mut _);

        let result = BitBlt(
            mem_dc, 
            0, 
            0, 
            width as i32, 
            height as i32, 
            screen_dc, 
            client_left, 
            client_top, 
            SRCCOPY
        );

        if result == 0 {
            SelectObject(mem_dc, old_bitmap);
            DeleteObject(hbitmap as *mut _);
            DeleteDC(mem_dc);
            ReleaseDC(desktop_hwnd, screen_dc);
            return Err("BitBlt failed".into());
        }

        if capture_mouse {
            let mut cursor_info: CURSORINFO = std::mem::zeroed();
            cursor_info.cbSize = size_of::<CURSORINFO>() as UINT;
            
            if GetCursorInfo(&mut cursor_info) != 0 && cursor_info.flags != 0 {
                let cursor_x = cursor_info.ptScreenPos.x - client_left;
                let cursor_y = cursor_info.ptScreenPos.y - client_top;
                
                DrawIconEx(
                    mem_dc,
                    cursor_x,
                    cursor_y,
                    cursor_info.hCursor,
                    0,
                    0,
                    0,
                    std::ptr::null_mut(),
                    DI_NORMAL,
                );
            }
        }

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as UINT;
        bmi.bmiHeader.biWidth = width as i32;
        bmi.bmiHeader.biHeight = -(height as i32);
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];
        
        let get_result = GetDIBits(
            mem_dc,
            hbitmap,
            0,
            height,
            pixels.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, old_bitmap);
        DeleteObject(hbitmap as *mut _);
        DeleteDC(mem_dc);
        ReleaseDC(desktop_hwnd, screen_dc);

        if get_result == 0 {
            return Err("GetDIBits failed".into());
        }

        let mut img_buffer = ImageBuffer::new(width, height);
        for y in 0..height as usize {
            for x in 0..width as usize {
                let idx = (y * width as usize + x) * 4;
                img_buffer.put_pixel(x as u32, y as u32, Rgba([
                    pixels[idx + 2],
                    pixels[idx + 1],
                    pixels[idx],
                    255
                ]));
            }
        }

        println!("[截图] 窗口截图成功: {}x{}", width, height);
        Ok(DynamicImage::ImageRgba8(img_buffer))
    }
}

pub fn capture_screenshot(capture_mouse: bool) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    if let Ok(window_capture) = capture_window(capture_mouse) {
        let (w, h) = window_capture.dimensions();
        if w > 100 && h > 100 {
            println!("[截图] 使用窗口截图模式");
            return Ok(window_capture);
        }
    }

    println!("[截图] 使用全屏截图模式 (GDI)");
    capture_fullscreen(capture_mouse)
}

pub fn capture_fullscreen(capture_mouse: bool) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);

        if width <= 0 || height <= 0 {
            return Err("Failed to get screen dimensions".into());
        }

        let width = width as u32;
        let height = height as u32;

        let desktop_hwnd = GetDesktopWindow();
        let screen_dc = GetDC(desktop_hwnd);
        if screen_dc.is_null() {
            return Err("Failed to get screen DC".into());
        }

        let mem_dc = CreateCompatibleDC(screen_dc);
        let hbitmap = CreateCompatibleBitmap(screen_dc, width as i32, height as i32);
        let old_bitmap = SelectObject(mem_dc, hbitmap as *mut _);

        let result = BitBlt(
            mem_dc,
            0,
            0,
            width as i32,
            height as i32,
            screen_dc,
            0,
            0,
            SRCCOPY
        );

        if result == 0 {
            SelectObject(mem_dc, old_bitmap);
            DeleteObject(hbitmap as *mut _);
            DeleteDC(mem_dc);
            ReleaseDC(desktop_hwnd, screen_dc);
            return Err("BitBlt failed".into());
        }

        if capture_mouse {
            let mut cursor_info: CURSORINFO = std::mem::zeroed();
            cursor_info.cbSize = size_of::<CURSORINFO>() as UINT;
            
            if GetCursorInfo(&mut cursor_info) != 0 && cursor_info.flags != 0 {
                DrawIconEx(
                    mem_dc,
                    cursor_info.ptScreenPos.x,
                    cursor_info.ptScreenPos.y,
                    cursor_info.hCursor,
                    0,
                    0,
                    0,
                    std::ptr::null_mut(),
                    DI_NORMAL,
                );
            }
        }

        let mut bmi: BITMAPINFO = std::mem::zeroed();
        bmi.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as UINT;
        bmi.bmiHeader.biWidth = width as i32;
        bmi.bmiHeader.biHeight = -(height as i32);
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB;

        let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];
        
        let get_result = GetDIBits(
            mem_dc,
            hbitmap,
            0,
            height,
            pixels.as_mut_ptr() as *mut _,
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, old_bitmap);
        DeleteObject(hbitmap as *mut _);
        DeleteDC(mem_dc);
        ReleaseDC(desktop_hwnd, screen_dc);

        if get_result == 0 {
            return Err("GetDIBits failed".into());
        }

        let mut img_buffer = ImageBuffer::new(width, height);
        for y in 0..height as usize {
            for x in 0..width as usize {
                let idx = (y * width as usize + x) * 4;
                img_buffer.put_pixel(x as u32, y as u32, Rgba([
                    pixels[idx + 2],
                    pixels[idx + 1],
                    pixels[idx],
                    255
                ]));
            }
        }

        println!("[截图] 全屏截图成功: {}x{}", width, height);
        Ok(DynamicImage::ImageRgba8(img_buffer))
    }
}

pub fn create_thumbnail(image: &DynamicImage, max_size: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    
    if width <= max_size && height <= max_size {
        return image.clone();
    }
    
    let ratio = if width > height {
        max_size as f64 / width as f64
    } else {
        max_size as f64 / height as f64
    };
    
    let new_width = (width as f64 * ratio) as u32;
    let new_height = (height as f64 * ratio) as u32;
    
    image.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
}

pub fn save_as_webp(image: &DynamicImage, path: &PathBuf, quality: f32) -> Result<(), Box<dyn std::error::Error>> {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    
    let encoder = webp::Encoder::new(&rgba, PixelLayout::Rgba, width, height);
    let webp_data = encoder.encode(quality);
    
    std::fs::write(path, &*webp_data)?;
    Ok(())
}

pub fn generate_filename() -> String {
    let now = Utc::now();
    format!("{}.webp", now.format("%Y%m%d_%H%M%S"))
}

pub fn generate_thumbnail_filename() -> String {
    let now = Utc::now();
    format!("{}_thumb.webp", now.format("%Y%m%d_%H%M%S"))
}
