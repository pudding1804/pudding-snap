use image::{DynamicImage, ImageBuffer, Rgba};
use std::path::PathBuf;
use chrono::Utc;
use scrap::{Capturer, Display};

pub fn capture_screenshot() -> Result<DynamicImage, Box<dyn std::error::Error>> {
    let display = Display::primary()?;
    let mut capturer = Capturer::new(display)?;
    
    let (width, height) = (capturer.width(), capturer.height());
    
    let buffer = loop {
        if let Ok(buffer) = capturer.frame() {
            break buffer;
        }
    };

    let mut img_buffer = ImageBuffer::new(width as u32, height as u32);
    let stride = buffer.len() / height;
    
    for y in 0..height {
        for x in 0..width {
            let idx = y * stride + x * 4;
            img_buffer.put_pixel(x as u32, y as u32, Rgba([
                buffer[idx + 2],
                buffer[idx + 1],
                buffer[idx],
                255
            ]));
        }
    }

    Ok(DynamicImage::ImageRgba8(img_buffer))
}

pub fn save_as_webp(image: &DynamicImage, path: &PathBuf, quality: f32) -> Result<(), Box<dyn std::error::Error>> {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    
    let encoder = webp::Encoder::new(&rgba, width, height);
    let webp_data = encoder.encode(quality);
    
    std::fs::write(path, &*webp_data)?;
    Ok(())
}

pub fn generate_filename() -> String {
    let now = Utc::now();
    format!("{}.webp", now.format("%Y%m%d_%H%M%S"))
}
