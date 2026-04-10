use rodio::Sink;

pub fn play_shutter_sound() -> Result<(), String> {
    play_shutter_sound_with_type("default")
}

pub fn play_shutter_sound_with_type(sound_type: &str) -> Result<(), String> {
    if sound_type == "none" {
        return Ok(());
    }
    
    let (_stream, stream_handle) = rodio::OutputStream::try_default()
        .map_err(|e| format!("无法获取音频输出: {}", e))?;
    
    let sink = Sink::try_new(&stream_handle)
        .map_err(|e| format!("无法创建音频Sink: {}", e))?;
    
    let sample_rate = 44100u32;
    let samples: Vec<i16> = match sound_type {
        "default" => generate_default_sound(sample_rate),
        "camera1" => generate_camera_sound(sample_rate),
        "camera2" => generate_camera2_sound(sample_rate),
        "click" => generate_click_sound(sample_rate),
        "soft" => generate_soft_sound(sample_rate),
        "digital" => generate_digital_sound(sample_rate),
        _ => generate_default_sound(sample_rate),
    };
    
    let source = rodio::buffer::SamplesBuffer::new(1, sample_rate, samples);
    sink.append(source);
    sink.sleep_until_end();
    
    Ok(())
}

fn generate_default_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 8;
    let freq = 1200.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample = (t * freq * 2.0 * std::f32::consts::PI).sin();
            let fade = 1.0 - (i as f32 / duration as f32);
            (sample * fade * i16::MAX as f32 * 0.3) as i16
        })
        .collect()
}

fn generate_camera_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 10;
    let freq1 = 800.0;
    let freq2 = 1600.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample1 = (t * freq1 * 2.0 * std::f32::consts::PI).sin();
            let sample2 = (t * freq2 * 2.0 * std::f32::consts::PI).sin();
            let envelope = if i < duration / 4 {
                i as f32 / (duration / 4) as f32
            } else {
                1.0 - (i as f32 - duration as f32 / 4.0) / (duration as f32 * 3.0 / 4.0)
            };
            ((sample1 * 0.5 + sample2 * 0.5) * envelope * i16::MAX as f32 * 0.25) as i16
        })
        .collect()
}

fn generate_camera2_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 6;
    let freq = 1000.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample = (t * freq * 2.0 * std::f32::consts::PI).sin();
            let click = if i < sample_rate as usize / 100 { 1.0 } else { 0.0 };
            let envelope = if i < duration / 3 {
                1.0
            } else {
                1.0 - (i as f32 - duration as f32 / 3.0) / (duration as f32 * 2.0 / 3.0)
            };
            ((sample * 0.7 + click * 0.3) * envelope * i16::MAX as f32 * 0.3) as i16
        })
        .collect()
}

fn generate_click_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 20;
    let freq = 2000.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample = (t * freq * 2.0 * std::f32::consts::PI).sin();
            let fade = (1.0 - i as f32 / duration as f32).powf(2.0);
            (sample * fade * i16::MAX as f32 * 0.35) as i16
        })
        .collect()
}

fn generate_soft_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 5;
    let freq = 600.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample = (t * freq * 2.0 * std::f32::consts::PI).sin();
            let envelope = (1.0 - i as f32 / duration as f32).powf(0.5);
            (sample * envelope * i16::MAX as f32 * 0.2) as i16
        })
        .collect()
}

fn generate_digital_sound(sample_rate: u32) -> Vec<i16> {
    let duration = sample_rate as usize / 8;
    let freq1 = 1500.0;
    let freq2 = 2000.0;
    
    (0..duration)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let sample1 = (t * freq1 * 2.0 * std::f32::consts::PI).sin();
            let sample2 = (t * freq2 * 2.0 * std::f32::consts::PI).sin();
            let envelope = if i < duration / 2 {
                i as f32 / (duration / 2) as f32
            } else {
                1.0 - (i as f32 - duration as f32 / 2.0) / (duration as f32 / 2.0)
            };
            let mixed = if (i / 100) % 2 == 0 { sample1 } else { sample2 };
            (mixed * envelope * i16::MAX as f32 * 0.25) as i16
        })
        .collect()
}
