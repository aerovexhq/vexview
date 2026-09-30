use crate::trimmer::VideoProcessError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceClipInput {
    pub path: String,
    pub start_sec: Option<f64>,
    pub end_sec: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTrackInput {
    pub path: String,
    pub volume: f64,
    pub mode: String, // "mix" or "replace"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeRequest {
    pub clips: Vec<SequenceClipInput>,
    pub audio_track: Option<AudioTrackInput>,
    pub destination: String,
    pub quality: Option<String>,
}

/// Composes, rearranges, and renders a sequence of clips with optional background music.
pub fn compose_video_sequence(req: ComposeRequest) -> Result<(), VideoProcessError> {
    if req.clips.is_empty() {
        return Err(VideoProcessError::FfmpegFailed(
            "No clips provided in sequence".into(),
        ));
    }

    if let Some(parent) = Path::new(&req.destination).parent() {
        let _ = fs::create_dir_all(parent);
    }

    let mut cmd = Command::new("ffmpeg");

    for clip in &req.clips {
        if let Some(start) = clip.start_sec {
            cmd.args(["-ss", &format!("{:.3}", start)]);
        }
        if let Some(end) = clip.end_sec {
            if let Some(start) = clip.start_sec {
                let duration = (end - start).max(0.1);
                cmd.args(["-t", &format!("{:.3}", duration)]);
            } else {
                cmd.args(["-to", &format!("{:.3}", end)]);
            }
        }
        cmd.args(["-i", &clip.path]);
    }

    let clip_count = req.clips.len();
    let audio_track_index = clip_count;

    if let Some(ref audio) = req.audio_track {
        cmd.args(["-i", &audio.path]);
    }

    let mut filter_complex = String::new();

    // Scale each clip to standard 1080p canvas with letterboxing/pillarboxing
    for i in 0..clip_count {
        filter_complex.push_str(&format!(
            "[{}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{}];",
            i, i
        ));
    }
    for i in 0..clip_count {
        filter_complex.push_str(&format!("[v{}]", i));
    }
    filter_complex.push_str(&format!("concat=n={}:v=1:a=0[v_out];", clip_count));

    if let Some(ref audio) = req.audio_track {
        let vol = if audio.volume <= 0.0 { 1.0 } else { audio.volume };
        filter_complex.push_str(&format!("[{}:a]volume={:.2}[a_out]", audio_track_index, vol));
        cmd.args(["-filter_complex", &filter_complex]);
        cmd.args(["-map", "[v_out]", "-map", "[a_out]", "-shortest"]);
    } else {
        let fc = filter_complex.trim_end_matches(';');
        cmd.args(["-filter_complex", fc]);
        cmd.args(["-map", "[v_out]"]);
    }

    let (crf, preset, audio_bitrate) = match req.quality.as_deref() {
        Some("high") | Some("original") => ("18", "medium", "256k"),
        Some("small") | Some("compressed") => ("28", "veryfast", "128k"),
        _ => ("22", "fast", "192k"),
    };

    cmd.args([
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        audio_bitrate,
        "-y",
    ]);
    cmd.arg(&req.destination);

    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(VideoProcessError::FfmpegFailed(
            "Sequence composition render failed".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compose_sequence_with_music() {
        let temp_dir = std::env::temp_dir();
        let clip1 = temp_dir.join("vex_compose_c1.mp4");
        let clip2 = temp_dir.join("vex_compose_c2.mp4");
        let music = temp_dir.join("vex_compose_m.mp3");
        let output = temp_dir.join("vex_compose_out.mp4");

        // Generate synthetic clip 1
        let _ = Command::new("ffmpeg")
            .args([
                "-f", "lavfi", "-i", "testsrc=duration=1:size=320x240:rate=25",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y",
            ])
            .arg(&clip1)
            .status();

        // Generate synthetic clip 2
        let _ = Command::new("ffmpeg")
            .args([
                "-f", "lavfi", "-i", "testsrc=duration=1:size=320x240:rate=25",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y",
            ])
            .arg(&clip2)
            .status();

        // Generate synthetic music track
        let _ = Command::new("ffmpeg")
            .args([
                "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-c:a", "libmp3lame", "-y",
            ])
            .arg(&music)
            .status();

        if clip1.exists() && clip2.exists() && music.exists() {
            let req = ComposeRequest {
                clips: vec![
                    SequenceClipInput {
                        path: clip1.to_string_lossy().to_string(),
                        start_sec: Some(0.0),
                        end_sec: Some(1.0),
                    },
                    SequenceClipInput {
                        path: clip2.to_string_lossy().to_string(),
                        start_sec: Some(0.0),
                        end_sec: Some(1.0),
                    },
                ],
                audio_track: Some(AudioTrackInput {
                    path: music.to_string_lossy().to_string(),
                    volume: 0.8,
                    mode: "mix".into(),
                }),
                destination: output.to_string_lossy().to_string(),
                quality: None,
            };

            let res = compose_video_sequence(req);
            assert!(res.is_ok(), "composition render should succeed: {:?}", res);
            assert!(output.exists());

            let _ = fs::remove_file(clip1);
            let _ = fs::remove_file(clip2);
            let _ = fs::remove_file(music);
            let _ = fs::remove_file(output);
        }
    }
}
