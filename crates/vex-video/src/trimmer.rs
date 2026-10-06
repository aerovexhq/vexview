use std::path::Path;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum VideoProcessError {
    #[error("FFmpeg execution failed: {0}")]
    FfmpegFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Trims video with selected compression/quality level.
/// quality: "original" (stream copy), "high" (CRF 18), "medium" (CRF 24), "small" (CRF 30)
pub fn trim_video<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    start_sec: f64,
    end_sec: f64,
    quality: Option<&str>,
) -> Result<(), VideoProcessError> {
    let q = quality.unwrap_or("original").to_lowercase();
    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-ss",
        &format!("{:.3}", start_sec),
        "-to",
        &format!("{:.3}", end_sec),
        "-i",
    ])
    .arg(input.as_ref());

    match q.as_str() {
        "high" => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-c:a", "aac",
                "-b:a", "192k",
                "-pix_fmt", "yuv420p",
                "-y",
            ]);
        }
        "medium" | "balanced" => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "24",
                "-c:a", "aac",
                "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-y",
            ]);
        }
        "small" | "low" | "compressed" => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "30",
                "-c:a", "aac",
                "-b:a", "96k",
                "-pix_fmt", "yuv420p",
                "-y",
            ]);
        }
        _ => {
            // Stream copy / original quality
            cmd.args(["-c", "copy", "-avoid_negative_ts", "make_zero", "-y"]);
        }
    }

    cmd.arg(output.as_ref());
    let status = cmd.status()?;

    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed("Video trim failed".into()))
    }
}

/// Performs lossless video trimming without re-encoding using stream copy.
pub fn trim_video_lossless<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    start_sec: f64,
    end_sec: f64,
) -> Result<(), VideoProcessError> {
    trim_video(input, output, start_sec, end_sec, Some("original"))
}

/// Captures a single video frame at the specified timestamp and saves it as an image.
pub fn capture_frame<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    timestamp_sec: f64,
) -> Result<(), VideoProcessError> {
    let status = Command::new("ffmpeg")
        .args(["-ss", &format!("{:.3}", timestamp_sec), "-i"])
        .arg(input.as_ref())
        .args(["-frames:v", "1", "-update", "1", "-q:v", "2", "-y"])
        .arg(output.as_ref())
        .status()?;

    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed(
            "Frame capture failed".into(),
        ))
    }
}

/// Converts a video clip to an optimized animated GIF with two-pass palette generation.
pub fn export_gif<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    start_sec: f64,
    duration_sec: f64,
    fps: u32,
    scale_width: u32,
) -> Result<(), VideoProcessError> {
    let filter = format!(
        "fps={},scale={}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        fps, scale_width
    );

    let status = Command::new("ffmpeg")
        .args([
            "-ss",
            &format!("{:.3}", start_sec),
            "-t",
            &format!("{:.3}", duration_sec),
            "-i",
        ])
        .arg(input.as_ref())
        .args(["-vf", &filter, "-y"])
        .arg(output.as_ref())
        .status()?;

    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed("GIF export failed".into()))
    }
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCropParams {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorGradingParams {
    #[serde(default)]
    pub brightness: f32,
    #[serde(default = "default_one")]
    pub contrast: f32,
    #[serde(default = "default_one")]
    pub saturation: f32,
    #[serde(default = "default_one")]
    pub gamma: f32,
}

fn default_one() -> f32 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AdvancedVideoParams {
    pub start_sec: Option<f64>,
    pub end_sec: Option<f64>,
    pub crop: Option<VideoCropParams>,
    pub speed: Option<f32>,
    pub rotation: Option<u32>,
    pub flip_h: bool,
    pub flip_v: bool,
    pub mute_audio: bool,
    pub volume: Option<f32>,
    pub color_grading: Option<ColorGradingParams>,
    pub grayscale: bool,
    pub sepia: bool,
    pub invert: bool,
    pub reverse: bool,
    pub timecode_burn_in: bool,
    pub telemetry_text: Option<String>,
    pub quality: Option<String>,
}

fn build_atempo_filter(mut speed: f32) -> String {
    let mut filters = Vec::new();
    while speed > 2.0 {
        filters.push("atempo=2.0".to_string());
        speed /= 2.0;
    }
    while speed < 0.5 {
        filters.push("atempo=0.5".to_string());
        speed /= 0.5;
    }
    filters.push(format!("atempo={:.3}", speed));
    filters.join(",")
}

/// Applies advanced transforms, speed ramping, color grading, and telemetry overlays to a video.
pub fn process_video_advanced<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    params: AdvancedVideoParams,
) -> Result<(), VideoProcessError> {
    let mut cmd = Command::new("ffmpeg");

    if let Some(start) = params.start_sec {
        cmd.args(["-ss", &format!("{:.3}", start)]);
    }
    if let Some(end) = params.end_sec {
        cmd.args(["-to", &format!("{:.3}", end)]);
    }

    cmd.arg("-i").arg(input.as_ref());

    let mut vf_filters: Vec<String> = Vec::new();
    let mut af_filters: Vec<String> = Vec::new();

    // 1. Crop
    if let Some(ref c) = params.crop {
        vf_filters.push(format!("crop={}:{}:{}:{}", c.width, c.height, c.x, c.y));
    }

    // 2. Speed ramping
    if let Some(s) = params.speed {
        if (s - 1.0).abs() > 0.01 && s > 0.05 {
            let pts = 1.0 / s;
            vf_filters.push(format!("setpts={:.4}*PTS", pts));
            if !params.mute_audio {
                af_filters.push(build_atempo_filter(s));
            }
        }
    }

    // 3. Rotation
    if let Some(deg) = params.rotation {
        match deg {
            90 => vf_filters.push("transpose=1".to_string()),
            180 => vf_filters.push("hflip,vflip".to_string()),
            270 => vf_filters.push("transpose=2".to_string()),
            _ => {}
        }
    }

    // 4. Flips
    if params.flip_h {
        vf_filters.push("hflip".to_string());
    }
    if params.flip_v {
        vf_filters.push("vflip".to_string());
    }

    // 5. Color grading
    if let Some(ref cg) = params.color_grading {
        let b = cg.brightness.clamp(-1.0, 1.0);
        let c = cg.contrast.clamp(0.0, 3.0);
        let s = cg.saturation.clamp(0.0, 3.0);
        let g = cg.gamma.clamp(0.1, 10.0);
        if b.abs() > 0.001 || (c - 1.0).abs() > 0.001 || (s - 1.0).abs() > 0.001 || (g - 1.0).abs() > 0.001 {
            vf_filters.push(format!(
                "eq=brightness={:.3}:contrast={:.3}:saturation={:.3}:gamma={:.3}",
                b, c, s, g
            ));
        }
    }

    // 6. Color effects
    if params.grayscale {
        vf_filters.push("hue=s=0".to_string());
    }
    if params.sepia {
        vf_filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131".to_string());
    }
    if params.invert {
        vf_filters.push("negate".to_string());
    }

    // 7. Reverse
    if params.reverse {
        vf_filters.push("reverse".to_string());
        if !params.mute_audio {
            af_filters.push("areverse".to_string());
        }
    }

    // 8. Timecode burn-in
    if params.timecode_burn_in {
        vf_filters.push("drawtext=text='%{pts\\:hms}':x=(w-tw)-16:y=(h-th)-16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4:fontsize=20".to_string());
    }

    // 9. Telemetry text
    if let Some(ref text) = params.telemetry_text {
        if !text.trim().is_empty() {
            let sanitized = text.replace('\'', "").replace(':', "\\:");
            vf_filters.push(format!(
                "drawtext=text='{}':x=16:y=16:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4:fontsize=18",
                sanitized
            ));
        }
    }

    // Attach video filters
    if !vf_filters.is_empty() {
        cmd.args(["-vf", &vf_filters.join(",")]);
    }

    // Audio handling
    if params.mute_audio {
        cmd.arg("-an");
    } else {
        if let Some(vol) = params.volume {
            if (vol - 1.0).abs() > 0.01 && vol >= 0.0 {
                af_filters.push(format!("volume={:.2}", vol));
            }
        }
        if !af_filters.is_empty() {
            cmd.args(["-af", &af_filters.join(",")]);
        }
    }

    // Quality encoding
    let q = params.quality.unwrap_or_else(|| "medium".to_string()).to_lowercase();
    match q.as_str() {
        "high" => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
            ]);
            if !params.mute_audio {
                cmd.args(["-c:a", "aac", "-b:a", "192k"]);
            }
        }
        "small" | "low" => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "30",
                "-pix_fmt", "yuv420p",
            ]);
            if !params.mute_audio {
                cmd.args(["-c:a", "aac", "-b:a", "96k"]);
            }
        }
        _ => {
            cmd.args([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "24",
                "-pix_fmt", "yuv420p",
            ]);
            if !params.mute_audio {
                cmd.args(["-c:a", "aac", "-b:a", "128k"]);
            }
        }
    }

    cmd.args(["-y"]).arg(output.as_ref());

    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed(
            "Advanced video processing failed".into(),
        ))
    }
}

/// Extracts standalone audio track from a video file into MP3, AAC, or WAV format.
pub fn extract_audio_track<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    format: &str,
) -> Result<(), VideoProcessError> {
    let mut cmd = Command::new("ffmpeg");
    cmd.args(["-i"]).arg(input.as_ref()).arg("-vn");

    match format.to_lowercase().as_str() {
        "mp3" => {
            cmd.args(["-c:a", "libmp3lame", "-b:a", "320k"]);
        }
        "wav" => {
            cmd.args(["-c:a", "pcm_s16le"]);
        }
        _ => {
            // Default to AAC
            cmd.args(["-c:a", "aac", "-b:a", "256k"]);
        }
    }

    cmd.args(["-y"]).arg(output.as_ref());
    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed("Audio extraction failed".into()))
    }
}

/// Extracts a burst sequence of still frames evenly spaced across the specified time window.
pub fn extract_burst_frames<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output_dir: Q,
    start_sec: f64,
    duration_sec: f64,
    count: u32,
) -> Result<Vec<String>, VideoProcessError> {
    let out_dir = output_dir.as_ref();
    std::fs::create_dir_all(out_dir)?;

    let valid_count = count.clamp(1, 100);
    let step = if valid_count > 1 {
        duration_sec.max(0.0) / (valid_count - 1) as f64
    } else {
        0.0
    };

    let mut generated_paths = Vec::with_capacity(valid_count as usize);

    for i in 0..valid_count {
        let t = start_sec + (i as f64 * step);
        let frame_name = format!("burst_frame_{:03}.png", i + 1);
        let frame_path = out_dir.join(&frame_name);

        let status = Command::new("ffmpeg")
            .args(["-ss", &format!("{:.3}", t), "-i"])
            .arg(input.as_ref())
            .args(["-frames:v", "1", "-update", "1", "-q:v", "2", "-y"])
            .arg(&frame_path)
            .status()?;

        if status.success() && frame_path.exists() {
            generated_paths.push(frame_path.to_string_lossy().to_string());
        }
    }

    if generated_paths.is_empty() {
        Err(VideoProcessError::FfmpegFailed("No frames extracted".into()))
    } else {
        Ok(generated_paths)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn generate_test_video(path: &Path) -> bool {
        Command::new("ffmpeg")
            .args([
                "-f", "lavfi",
                "-i", "testsrc=duration=2:size=160x120:rate=25",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-y",
            ])
            .arg(path)
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    #[test]
    fn test_trim_and_capture_and_gif() {
        let temp_dir = std::env::temp_dir();
        let input_video = temp_dir.join("vex_test_input.mp4");
        let trimmed_video = temp_dir.join("vex_test_trimmed.mp4");
        let captured_frame = temp_dir.join("vex_test_frame.png");
        let exported_gif = temp_dir.join("vex_test_anim.gif");

        if generate_test_video(&input_video) {
            // Test trim
            let trim_res = trim_video_lossless(&input_video, &trimmed_video, 0.5, 1.5);
            assert!(trim_res.is_ok(), "trim should succeed: {:?}", trim_res);
            assert!(trimmed_video.exists());

            // Test capture frame
            let cap_res = capture_frame(&input_video, &captured_frame, 0.5);
            assert!(cap_res.is_ok(), "frame capture should succeed: {:?}", cap_res);
            assert!(captured_frame.exists());

            // Test export GIF
            let gif_res = export_gif(&input_video, &exported_gif, 0.0, 1.0, 10, 160);
            assert!(gif_res.is_ok(), "gif export should succeed: {:?}", gif_res);
            assert!(exported_gif.exists());

            // Test advanced video processing (crop, speed, color grading, sepia)
            let adv_output = temp_dir.join("vex_test_adv.mp4");
            let adv_params = AdvancedVideoParams {
                start_sec: Some(0.0),
                end_sec: Some(1.0),
                crop: Some(VideoCropParams {
                    x: 10,
                    y: 10,
                    width: 100,
                    height: 80,
                }),
                speed: Some(2.0),
                rotation: Some(90),
                flip_h: true,
                flip_v: false,
                mute_audio: true,
                volume: None,
                color_grading: Some(ColorGradingParams {
                    brightness: 0.1,
                    contrast: 1.2,
                    saturation: 1.1,
                    gamma: 1.0,
                }),
                grayscale: false,
                sepia: true,
                invert: false,
                reverse: false,
                timecode_burn_in: false,
                telemetry_text: None,
                quality: Some("small".into()),
            };
            let adv_res = process_video_advanced(&input_video, &adv_output, adv_params);
            assert!(adv_res.is_ok(), "advanced video processing should succeed: {:?}", adv_res);
            assert!(adv_output.exists());

            // Test burst frame extraction
            let burst_dir = temp_dir.join("vex_test_burst");
            let burst_res = extract_burst_frames(&input_video, &burst_dir, 0.0, 1.0, 3);
            assert!(burst_res.is_ok(), "burst extraction should succeed: {:?}", burst_res);
            let burst_files = burst_res.unwrap();
            assert_eq!(burst_files.len(), 3);
            for f in &burst_files {
                assert!(Path::new(f).exists());
            }

            // Clean up
            let _ = std::fs::remove_file(input_video);
            let _ = std::fs::remove_file(trimmed_video);
            let _ = std::fs::remove_file(captured_frame);
            let _ = std::fs::remove_file(exported_gif);
            let _ = std::fs::remove_file(adv_output);
            let _ = std::fs::remove_dir_all(burst_dir);
        }
    }
}
