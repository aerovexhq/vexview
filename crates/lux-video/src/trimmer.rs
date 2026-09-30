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

/// Performs lossless video trimming without re-encoding using stream copy.
pub fn trim_video_lossless<P: AsRef<Path>, Q: AsRef<Path>>(
    input: P,
    output: Q,
    start_sec: f64,
    end_sec: f64,
) -> Result<(), VideoProcessError> {
    let status = Command::new("ffmpeg")
        .args([
            "-ss",
            &format!("{:.3}", start_sec),
            "-to",
            &format!("{:.3}", end_sec),
            "-i",
        ])
        .arg(input.as_ref())
        .args(["-c", "copy", "-avoid_negative_ts", "make_zero", "-y"])
        .arg(output.as_ref())
        .status()?;

    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed(
            "Lossless video trim failed".into(),
        ))
    }
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
        .args(["-vframes", "1", "-q:v", "2", "-y"])
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
        let input_video = temp_dir.join("lux_test_input.mp4");
        let trimmed_video = temp_dir.join("lux_test_trimmed.mp4");
        let captured_frame = temp_dir.join("lux_test_frame.png");
        let exported_gif = temp_dir.join("lux_test_anim.gif");

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

            // Clean up
            let _ = std::fs::remove_file(input_video);
            let _ = std::fs::remove_file(trimmed_video);
            let _ = std::fs::remove_file(captured_frame);
            let _ = std::fs::remove_file(exported_gif);
        }
    }
}
