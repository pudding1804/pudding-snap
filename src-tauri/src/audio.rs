use rodio::{Sink, Source};
use std::io::Cursor;

pub fn play_shutter_sound() {
    if let Ok((_stream, stream_handle)) = rodio::OutputStream::try_default() {
        if let Ok(sink) = Sink::try_new(&stream_handle) {
            let sample_rate = 44100;
            let duration = sample_rate / 8;
            let freq = 1200.0;
            
            let samples: Vec<i16> = (0..duration)
                .map(|i| {
                    let t = i as f32 / sample_rate as f32;
                    let sample = (t * freq * 2.0 * std::f32::consts::PI).sin();
                    let fade = 1.0 - (i as f32 / duration as f32);
                    (sample * fade * i16::MAX as f32 * 0.3) as i16
                })
                .collect();
            
            let source = rodio::buffer::SamplesBuffer::new(1, sample_rate as u32, samples);
            sink.append(source);
            sink.sleep_until_end();
        }
    }
}
