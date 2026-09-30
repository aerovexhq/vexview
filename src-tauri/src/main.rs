// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::prelude::*;
use lux_core::{MediaItem, ScanFilter};
use lux_edit::ExportFormat;
use lux_image::LoadedImage;
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
    pub destination: Option<String>,
    pub format: Option<String>,
}

#[derive(Deserialize)]
pub struct CropParams {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<MediaItem>, String> {
    let p = Path::new(&folder_path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }
    let items = lux_core::scan_directory(p, ScanFilter::AllMedia);
    Ok(items)
}

#[tauri::command]
fn load_image_detail(file_path: String) -> Result<ImageDetailResponse, String> {
    let loaded: LoadedImage =
        lux_image::load_image(&file_path).map_err(|e| format!("Failed to load image: {}", e))?;

    let mut buffer = Cursor::new(Vec::new());
    loaded
        .image
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode preview: {}", e))?;

    let base64_str = BASE64_STANDARD.encode(buffer.into_inner());
    let data_url = format!("data:image/png;base64,{}", base64_str);

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
    let loaded =
        lux_image::load_image(&file_path).map_err(|e| format!("Failed to load image: {}", e))?;
    let thumb = lux_image::generate_thumbnail(&loaded.image, max_size, max_size)
        .map_err(|e| format!("Failed to resize thumbnail: {}", e))?;

    let mut buffer = Cursor::new(Vec::new());
    thumb
        .write_to(&mut buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let b64 = BASE64_STANDARD.encode(buffer.into_inner());
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
fn probe_video(file_path: String) -> Result<lux_video::VideoMetadata, String> {
    lux_video::probe_video(&file_path)
        .ok_or_else(|| "Failed to probe video streams with ffprobe".to_string())
}

#[tauri::command]
fn apply_image_transforms(req: TransformRequest) -> Result<String, String> {
    let loaded =
        lux_image::load_image(&req.path).map_err(|e| format!("Failed to load image: {}", e))?;
    let mut current = loaded.image;

    // Apply rotation
    match req.rotation % 360 {
        90 | -270 => current = lux_edit::rotate_90(&current),
        180 | -180 => current = lux_edit::rotate_180(&current),
        270 | -90 => current = lux_edit::rotate_270(&current),
        _ => {}
    }

    if req.flip_h {
        current = lux_edit::flip_h(&current);
    }
    if req.flip_v {
        current = lux_edit::flip_v(&current);
    }

    if let Some(crop) = req.crop {
        current = lux_edit::crop(&current, crop.x, crop.y, crop.width, crop.height);
    }

    if req.brightness != 0 {
        current = lux_edit::adjust_brightness(&current, req.brightness);
    }
    if (req.contrast - 0.0).abs() > 0.01 {
        current = lux_edit::adjust_contrast(&current, req.contrast);
    }
    if req.blur > 0.0 {
        current = lux_edit::blur(&current, req.blur);
    }

    // If destination provided, save to disk
    if let Some(dest) = req.destination {
        let fmt = match req.format.as_deref() {
            Some("jpg") | Some("jpeg") => ExportFormat::Jpeg,
            Some("webp") => ExportFormat::WebP,
            _ => ExportFormat::Png,
        };
        lux_edit::export_image(&current, &dest, fmt)
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
    output: String,
    start_sec: f64,
    end_sec: f64,
) -> Result<(), String> {
    lux_video::trim_video_lossless(&input, &output, start_sec, end_sec)
        .map_err(|e| format!("Lossless trim failed: {}", e))
}

#[tauri::command]
fn capture_video_snapshot(input: String, output: String, timestamp: f64) -> Result<(), String> {
    lux_video::capture_frame(&input, &output, timestamp)
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
    lux_video::export_gif(&input, &output, start_sec, duration_sec, fps, width)
        .map_err(|e| format!("GIF export failed: {}", e))
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            load_image_detail,
            get_thumbnail_base64,
            probe_video,
            apply_image_transforms,
            trim_video_clip,
            capture_video_snapshot,
            export_video_to_gif,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
