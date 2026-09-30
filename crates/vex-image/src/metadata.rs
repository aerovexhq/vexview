use exif::{In, Reader, Tag};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub orientation: u32,
    pub make: Option<String>,
    pub model: Option<String>,
    pub date_time: Option<String>,
    pub exposure_time: Option<String>,
    pub f_number: Option<String>,
    pub iso: Option<String>,
}

pub fn extract_metadata<P: AsRef<Path>>(path: P, width: u32, height: u32) -> ImageMetadata {
    let mut meta = ImageMetadata {
        width,
        height,
        orientation: 1, // Normal orientation
        ..Default::default()
    };

    let file = match File::open(path.as_ref()) {
        Ok(f) => f,
        Err(_) => return meta,
    };

    let mut bufreader = BufReader::new(file);
    let exifreader = Reader::new();
    if let Ok(exif_data) = exifreader.read_from_container(&mut bufreader) {
        if let Some(field) = exif_data.get_field(Tag::Orientation, In::PRIMARY) {
            if let Some(val) = field.value.get_uint(0) {
                meta.orientation = val;
            }
        }
        if let Some(field) = exif_data.get_field(Tag::Make, In::PRIMARY) {
            meta.make = Some(field.display_value().to_string());
        }
        if let Some(field) = exif_data.get_field(Tag::Model, In::PRIMARY) {
            meta.model = Some(field.display_value().to_string());
        }
        if let Some(field) = exif_data.get_field(Tag::DateTime, In::PRIMARY) {
            meta.date_time = Some(field.display_value().to_string());
        }
        if let Some(field) = exif_data.get_field(Tag::ExposureTime, In::PRIMARY) {
            meta.exposure_time = Some(field.display_value().to_string());
        }
        if let Some(field) = exif_data.get_field(Tag::FNumber, In::PRIMARY) {
            meta.f_number = Some(field.display_value().to_string());
        }
        if let Some(field) = exif_data.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
            meta.iso = Some(field.display_value().to_string());
        }
    }

    meta
}
