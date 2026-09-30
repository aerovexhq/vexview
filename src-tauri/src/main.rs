// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::prelude::*;
use vex_core::{MediaItem, ScanFilter};
use vex_edit::ExportFormat;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::path::Path;

#[derive(Serialize, Deserialize)]
pub struct ImageDetailResponse {
    pub width: u32,
    pub height: u32,
    pub orientation: u32,
    pub make: Option<String>,
    pub model: Option<String>,
    pub date_time: Option<String>,
    pub data_url: String,
}

#[derive(Deserialize)]
pub struct TransformRequest {
    pub path: String,
    pub rotation: i32,
    pub flip_h: bool,
    pub flip_v: bool,
    pub crop: Option<CropParams>,
    pub brightness: i32,
    pub contrast: f32,
    pub blur: f32,
    pub saturation: Option<f32>,
    pub warmth: Option<f32>,
    pub filter: Option<String>,
    pub destination: Option<String>,
    pub format: Option<String>,
    pub quality: Option<u8>,
    pub save: Option<bool>,
    pub overwrite: Option<bool>,
}

#[derive(Deserialize)]
pub struct CropParams {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn clean_file_path(path: &str) -> String {
    let mut p = path.trim();
    if let Some(stripped) = p.strip_prefix("file://") {
        p = stripped;
    }
    let mut result = Vec::new();
    let bytes = p.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16) {
                result.push(val);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| p.to_string())
}

fn get_non_colliding_path(
    original_path: &Path,
    suffix: &str,
    new_ext: Option<&str>,
) -> std::path::PathBuf {
    let parent = original_path.parent().unwrap_or_else(|| Path::new("."));
    let stem = original_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("media");
    let ext = new_ext
        .or_else(|| original_path.extension().and_then(|e| e.to_str()))
        .unwrap_or("png");

    let base_name = format!("{}_{}.{}", stem, suffix, ext);
    let mut candidate = parent.join(&base_name);
    if !candidate.exists() {
        return candidate;
    }

    let mut counter = 1;
    loop {
        let name = format!("{}_{}_{}.{}", stem, suffix, counter, ext);
        candidate = parent.join(&name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<MediaItem>, String> {
    let clean = clean_file_path(&folder_path);
    let p = Path::new(&clean);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", clean));
    }
    let items = vex_core::scan_directory(p, ScanFilter::AllMedia);
    Ok(items)
}

#[tauri::command]
fn load_image_detail(file_path: String) -> Result<ImageDetailResponse, String> {
    let clean = clean_file_path(&file_path);
    let path_ref = Path::new(&clean);
    let ext = path_ref
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if ext == "svg" || ext == "svgz" {
        let loaded = vex_image::load_image(&clean)
            .map_err(|e| format!("Failed to render SVG: {}", e))?;
        let mut buffer = Cursor::new(Vec::new());
        loaded
            .image
            .write_to(&mut buffer, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode rendered SVG: {}", e))?;
        let b64 = BASE64_STANDARD.encode(buffer.into_inner());
        let data_url = format!("data:image/png;base64,{}", b64);
        return Ok(ImageDetailResponse {
            width: loaded.metadata.width,
            height: loaded.metadata.height,
            orientation: 1,
            make: None,
            model: None,
            date_time: None,
            data_url,
        });
    }

    // For raster images: extract metadata quickly without recompressing
    let loaded = vex_image::load_image(&clean)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    // Read original raw file bytes directly for instant <1ms base64 response
    let raw_bytes = std::fs::read(&clean)
        .map_err(|e| format!("Failed to read image file: {}", e))?;
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "tif" | "tiff" => "image/tiff",
        _ => "image/png",
    };
    let b64 = BASE64_STANDARD.encode(&raw_bytes);
    let data_url = format!("data:{};base64,{}", mime, b64);

    Ok(ImageDetailResponse {
        width: loaded.metadata.width,
        height: loaded.metadata.height,
        orientation: loaded.metadata.orientation,
        make: loaded.metadata.make,
        model: loaded.metadata.model,
        date_time: loaded.metadata.date_time,
        data_url,
    })
}

#[tauri::command]
fn get_thumbnail_base64(file_path: String, max_size: u32) -> Result<String, String> {
    let clean = clean_file_path(&file_path);
    let loaded =
        vex_image::load_image(&clean).map_err(|e| format!("Failed to load image: {}", e))?;
    let thumb = vex_image::generate_thumbnail(&loaded.image, max_size, max_size)
        .map_err(|e| format!("Failed to resize thumbnail: {}", e))?;

    let mut buffer = Cursor::new(Vec::new());
    thumb
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let b64 = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
fn probe_video(file_path: String) -> Result<vex_video::VideoMetadata, String> {
    let clean = clean_file_path(&file_path);
    vex_video::probe_video(&clean)
        .ok_or_else(|| "Failed to probe video streams with ffprobe".to_string())
}

#[tauri::command]
fn apply_image_transforms(req: TransformRequest) -> Result<String, String> {
    let clean = clean_file_path(&req.path);
    let path_ref = Path::new(&clean);
    let loaded =
        vex_image::load_image(&clean).map_err(|e| format!("Failed to load image: {}", e))?;
    let mut current = loaded.image;

    // Apply rotation
    match req.rotation % 360 {
        90 | -270 => current = vex_edit::rotate_90(&current),
        180 | -180 => current = vex_edit::rotate_180(&current),
        270 | -90 => current = vex_edit::rotate_270(&current),
        _ => {}
    }

    if req.flip_h {
        current = vex_edit::flip_h(&current);
    }
    if req.flip_v {
        current = vex_edit::flip_v(&current);
    }

    if let Some(crop) = req.crop {
        current = vex_edit::crop(&current, crop.x, crop.y, crop.width, crop.height);
    }

    if req.brightness != 0 {
        current = vex_edit::adjust_brightness(&current, req.brightness);
    }
    if (req.contrast - 0.0).abs() > 0.01 {
        current = vex_edit::adjust_contrast(&current, req.contrast);
    }
    if let Some(sat) = req.saturation {
        if sat.abs() > 0.01 {
            current = vex_edit::adjust_saturation(&current, sat);
        }
    }
    if let Some(w) = req.warmth {
        if w.abs() > 0.01 {
            current = vex_edit::adjust_warmth(&current, w);
        }
    }
    if let Some(ref filter_name) = req.filter {
        match filter_name.as_str() {
            "grayscale" => current = vex_edit::grayscale(&current),
            "invert" => current = vex_edit::invert(&current),
            "sepia" => current = vex_edit::sepia(&current),
            _ => {}
        }
    }
    if req.blur > 0.0 {
        current = vex_edit::blur(&current, req.blur);
    }

    let target_ext = req.format.as_deref().or_else(|| path_ref.extension().and_then(|e| e.to_str()));
    let fmt = target_ext
        .and_then(ExportFormat::from_ext_or_name)
        .unwrap_or(ExportFormat::Png);

    let is_save = req.save.unwrap_or(false) || req.destination.is_some() || req.overwrite.unwrap_or(false);

    if is_save {
        let dest = if let Some(d) = req.destination.filter(|s| !s.trim().is_empty()) {
            clean_file_path(&d)
        } else if req.overwrite.unwrap_or(false) {
            clean.clone()
        } else {
            let next_to = get_non_colliding_path(path_ref, "edited", Some(fmt.extension()));
            next_to.to_string_lossy().to_string()
        };

        vex_edit::export_image(&current, &dest, fmt, req.quality)
            .map_err(|e| format!("Failed to export image: {}", e))?;
        return Ok(dest);
    }

    // Otherwise return preview base64 data URL
    let mut buffer = Cursor::new(Vec::new());
    current
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode preview: {}", e))?;
    let b64 = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
fn trim_video_clip(
    input: String,
    output: Option<String>,
    start_sec: f64,
    end_sec: f64,
    quality: Option<String>,
    overwrite: Option<bool>,
) -> Result<String, String> {
    let clean_in = clean_file_path(&input);
    let in_path = Path::new(&clean_in);

    let is_overwrite = overwrite.unwrap_or(false);
    let dest = if let Some(out) = output.filter(|s| !s.trim().is_empty()) {
        clean_file_path(&out)
    } else if is_overwrite {
        clean_in.clone()
    } else {
        let candidate = get_non_colliding_path(in_path, "trimmed", None);
        candidate.to_string_lossy().to_string()
    };

    if is_overwrite {
        let temp_dest = format!("{}.vex_tmp.mp4", clean_in);
        vex_video::trim_video(&clean_in, &temp_dest, start_sec, end_sec, quality.as_deref())
            .map_err(|e| format!("Trim failed: {}", e))?;
        std::fs::rename(&temp_dest, &clean_in)
            .map_err(|e| format!("Failed to overwrite original video: {}", e))?;
        Ok(clean_in)
    } else {
        vex_video::trim_video(&clean_in, &dest, start_sec, end_sec, quality.as_deref())
            .map_err(|e| format!("Trim failed: {}", e))?;
        Ok(dest)
    }
}

#[tauri::command]
fn capture_video_snapshot(input: String, output: String, timestamp: f64) -> Result<(), String> {
    vex_video::capture_frame(&input, &output, timestamp)
        .map_err(|e| format!("Snapshot failed: {}", e))
}

#[tauri::command]
fn export_video_to_gif(
    input: String,
    output: String,
    start_sec: f64,
    duration_sec: f64,
    fps: u32,
    width: u32,
) -> Result<(), String> {
    vex_video::export_gif(&input, &output, start_sec, duration_sec, fps, width)
        .map_err(|e| format!("GIF export failed: {}", e))
}

#[tauri::command]
async fn open_file_dialog() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter(
            "Media Files",
            &[
                "png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "ico", "tiff", "mp4",
                "mkv", "webm", "avi", "mov", "flv", "wmv",
            ],
        )
        .add_filter(
            "Images",
            &[
                "png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "ico", "tiff",
            ],
        )
        .add_filter(
            "Videos",
            &["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv"],
        )
        .set_title("Open Media File")
        .pick_file()
        .await;

    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn open_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Open Media Folder")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn pick_audio_file() -> Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter(
            "Audio Files",
            &["mp3", "wav", "aac", "m4a", "ogg", "flac", "wma"],
        )
        .set_title("Select Background Audio / Music Track")
        .pick_file()
        .await;

    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
async fn compose_video_sequence(req: vex_video::ComposeRequest) -> Result<String, String> {
    let dest = req.destination.clone();
    tauri::async_runtime::spawn_blocking(move || vex_video::compose_video_sequence(req))
        .await
        .map_err(|e| format!("Task spawn error: {}", e))?
        .map_err(|e| format!("Composition failed: {}", e))?;
    Ok(dest)
}

#[tauri::command]
async fn convert_media_file(
    input_path: String,
    output_path: String,
    format: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    quality: Option<u8>,
) -> Result<String, String> {
    let out = output_path.clone();
    let fmt = format.as_deref().and_then(ExportFormat::from_ext_or_name);
    tauri::async_runtime::spawn_blocking(move || {
        vex_edit::convert_image_file(&input_path, &out, fmt, width, height, quality)
    })
    .await
    .map_err(|e| format!("Task spawn error: {}", e))?
    .map_err(|e| format!("Conversion failed: {}", e))?;

    Ok(output_path)
}

#[tauri::command]
async fn save_file_dialog(
    default_name: String,
    filter_name: String,
    extensions: Vec<String>,
) -> Result<Option<String>, String> {
    let ext_slices: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let mut dialog = rfd::AsyncFileDialog::new().set_file_name(&default_name);
    if !ext_slices.is_empty() {
        dialog = dialog.add_filter(&filter_name, &ext_slices);
    }
    let file = dialog.save_file().await;
    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

#[tauri::command]
fn set_default_media_viewer() -> Result<(), String> {
    let mimes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
        "image/gif",
        "image/bmp",
        "image/avif",
        "image/tiff",
        "video/mp4",
        "video/x-matroska",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
    ];

    let mut args = vec!["default", "vexview.desktop"];
    args.extend(mimes.iter());

    let status = std::process::Command::new("xdg-mime")
        .args(&args)
        .status()
        .map_err(|e| format!("Failed to run xdg-mime: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("xdg-mime command failed".into())
    }
}

fn sync_autostart_file(enable: bool) {
    if let Some(home) = std::env::var_os("HOME") {
        let autostart_dir = std::path::PathBuf::from(home)
            .join(".config")
            .join("autostart");
        let autostart_file = autostart_dir.join("vexview.desktop");

        if enable {
            let _ = std::fs::create_dir_all(&autostart_dir);
            let desktop_content = "[Desktop Entry]\n\
                Type=Application\n\
                Name=vexview\n\
                Comment=Modern & Minimalistic Image and Video Viewer\n\
                Exec=vexview\n\
                Icon=vexview\n\
                Terminal=false\n\
                Categories=Graphics;Viewer;\n\
                X-GNOME-Autostart-enabled=true\n";
            let _ = std::fs::write(autostart_file, desktop_content);
        } else {
            let _ = std::fs::remove_file(autostart_file);
        }
    }
}

#[tauri::command]
fn get_viewer_config() -> Result<vex_core::ViewerConfig, String> {
    Ok(vex_core::ViewerConfig::load())
}

#[tauri::command]
fn save_viewer_config(config: vex_core::ViewerConfig) -> Result<(), String> {
    sync_autostart_file(config.autostart_at_boot);
    config
        .save()
        .map_err(|e| format!("Failed to save config: {}", e))
}

#[tauri::command]
fn get_cli_target() -> Option<String> {
    std::env::args().skip(1).find(|arg| !arg.starts_with('-'))
}

#[tauri::command]
fn exit_application(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let config = vex_core::ViewerConfig::load();
                if config.keep_running_in_background {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            load_image_detail,
            get_thumbnail_base64,
            probe_video,
            apply_image_transforms,
            trim_video_clip,
            capture_video_snapshot,
            export_video_to_gif,
            open_file_dialog,
            open_folder_dialog,
            pick_audio_file,
            compose_video_sequence,
            convert_media_file,
            save_file_dialog,
            set_default_media_viewer,
            get_cli_target,
            get_viewer_config,
            save_viewer_config,
            exit_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
