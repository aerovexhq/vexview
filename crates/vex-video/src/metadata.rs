use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration_seconds: f64,
    pub width: u32,
    pub height: u32,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub frame_rate: Option<f64>,
    pub bit_rate: Option<u64>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub stream_url: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub duration_seconds: f64,
    pub audio_codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub bit_rate: Option<u64>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
}

/// Probes a video or media file using ffprobe if available.
pub fn probe_video<P: AsRef<Path>>(path: P) -> Option<VideoMetadata> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(path.as_ref())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;
    let mut meta = VideoMetadata::default();

    if let Some(format) = json_val.get("format") {
        if let Some(dur_str) = format.get("duration").and_then(|d| d.as_str()) {
            meta.duration_seconds = dur_str.parse().unwrap_or(0.0);
        }
        if let Some(br_str) = format.get("bit_rate").and_then(|b| b.as_str()) {
            meta.bit_rate = br_str.parse().ok();
        }
        if let Some(tags) = format.get("tags") {
            meta.title = tags
                .get("title")
                .or_else(|| tags.get("TITLE"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.artist = tags
                .get("artist")
                .or_else(|| tags.get("ARTIST"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            meta.album = tags
                .get("album")
                .or_else(|| tags.get("ALBUM"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
    }

    if let Some(streams) = json_val.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            let codec_type = s.get("codec_type").and_then(|c| c.as_str());
            if codec_type == Some("video") && meta.width == 0 {
                meta.width = s.get("width").and_then(|w| w.as_u64()).unwrap_or(0) as u32;
                meta.height = s.get("height").and_then(|h| h.as_u64()).unwrap_or(0) as u32;
                meta.video_codec = s
                    .get("codec_name")
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                if let Some(r_fps) = s.get("r_frame_rate").and_then(|f| f.as_str()) {
                    let parts: Vec<&str> = r_fps.split('/').collect();
                    if parts.len() == 2 {
                        let num: f64 = parts[0].parse().unwrap_or(0.0);
                        let den: f64 = parts[1].parse().unwrap_or(1.0);
                        if den > 0.0 {
                            meta.frame_rate = Some(num / den);
                        }
                    }
                }
            } else if codec_type == Some("audio") && meta.audio_codec.is_none() {
                meta.audio_codec = s
                    .get("codec_name")
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                if let Some(sr) = s.get("sample_rate").and_then(|v| v.as_str()) {
                    meta.sample_rate = sr.parse().ok();
                }
                if let Some(ch) = s.get("channels").and_then(|v| v.as_u64()) {
                    meta.channels = Some(ch as u32);
                }
                if meta.bit_rate.is_none() {
                    if let Some(br) = s.get("bit_rate").and_then(|v| v.as_str()) {
                        meta.bit_rate = br.parse().ok();
                    }
                }
            }
        }
    }

    Some(meta)
}

/// Probes an audio file using ffprobe.
pub fn probe_audio<P: AsRef<Path>>(path: P) -> Option<AudioMetadata> {
    let vm = probe_video(path)?;
    Some(AudioMetadata {
        duration_seconds: vm.duration_seconds,
        audio_codec: vm.audio_codec,
        sample_rate: vm.sample_rate,
        channels: vm.channels,
        bit_rate: vm.bit_rate,
        title: vm.title,
        artist: vm.artist,
        album: vm.album,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn test_probe_generated_video() {
        let temp_dir = std::env::temp_dir();
        let test_video = temp_dir.join("vex_test_probe.mp4");

        // Generate a 1.5-second synthetic video with ffmpeg
        let status = Command::new("ffmpeg")
            .args([
                "-f", "lavfi",
                "-i", "testsrc=duration=1.5:size=320x240:rate=25",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-y",
            ])
            .arg(&test_video)
            .status();

        if let Ok(st) = status {
            if st.success() {
                let meta = probe_video(&test_video).expect("probe should succeed");
                assert_eq!(meta.width, 320);
                assert_eq!(meta.height, 240);
                assert!(meta.duration_seconds >= 1.0);
                assert_eq!(meta.video_codec.as_deref(), Some("h264"));
                let _ = std::fs::remove_file(test_video);
            }
        }
    }
}
