use image::{DynamicImage, ImageError, ImageFormat};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Png,
    Jpeg,
    WebP,
    Bmp,
    Ico,
    Tiff,
}

impl ExportFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::Png => "png",
            ExportFormat::Jpeg => "jpg",
            ExportFormat::WebP => "webp",
            ExportFormat::Bmp => "bmp",
            ExportFormat::Ico => "ico",
            ExportFormat::Tiff => "tiff",
        }
    }

    pub fn from_ext_or_name(s: &str) -> Option<Self> {
        let clean = s.trim().trim_start_matches('.').to_lowercase();
        match clean.as_str() {
            "png" => Some(ExportFormat::Png),
            "jpg" | "jpeg" => Some(ExportFormat::Jpeg),
            "webp" => Some(ExportFormat::WebP),
            "bmp" => Some(ExportFormat::Bmp),
            "ico" => Some(ExportFormat::Ico),
            "tif" | "tiff" => Some(ExportFormat::Tiff),
            _ => None,
        }
    }
}

/// Saves an edited image to the specified path in the chosen format with optional quality/compression.
pub fn export_image<P: AsRef<Path>>(
    img: &DynamicImage,
    destination: P,
    format: ExportFormat,
    quality: Option<u8>,
) -> Result<(), ImageError> {
    let file = File::create(destination.as_ref())?;
    let mut writer = BufWriter::new(file);
    let q = quality.unwrap_or(90).clamp(1, 100);

    match format {
        ExportFormat::Jpeg => {
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, q);
            encoder.encode_image(img)?;
        }
        ExportFormat::Png => {
            let compression = if q >= 95 {
                image::codecs::png::CompressionType::Best
            } else if q >= 65 {
                image::codecs::png::CompressionType::Default
            } else {
                image::codecs::png::CompressionType::Fast
            };
            let encoder = image::codecs::png::PngEncoder::new_with_quality(
                &mut writer,
                compression,
                image::codecs::png::FilterType::Adaptive,
            );
            img.write_with_encoder(encoder)?;
        }
        ExportFormat::WebP => {
            img.write_to(&mut writer, ImageFormat::WebP)?;
        }
        ExportFormat::Bmp => {
            img.write_to(&mut writer, ImageFormat::Bmp)?;
        }
        ExportFormat::Ico => {
            img.write_to(&mut writer, ImageFormat::Ico)?;
        }
        ExportFormat::Tiff => {
            img.write_to(&mut writer, ImageFormat::Tiff)?;
        }
    }
    Ok(())
}

/// Converts any supported image or vector SVG file into target format and dimensions with optional quality.
pub fn convert_image_file<P: AsRef<Path>, Q: AsRef<Path>>(
    input_path: P,
    output_path: Q,
    format: Option<ExportFormat>,
    target_width: Option<u32>,
    target_height: Option<u32>,
    quality: Option<u8>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let in_ref = input_path.as_ref();
    let out_ref = output_path.as_ref();

    let ext = in_ref
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let dyn_img = if ext == "svg" || ext == "svgz" {
        let rgba = lux_image::render_svg(in_ref, target_width, target_height)?;
        DynamicImage::ImageRgba8(rgba)
    } else {
        let loaded = lux_image::load_image(in_ref)?;
        let mut img = loaded.image;
        if target_width.is_some() || target_height.is_some() {
            let (orig_w, orig_h) = image::GenericImageView::dimensions(&img);
            let w = target_width.unwrap_or(orig_w);
            let h = target_height.unwrap_or(orig_h);
            img = img.resize_exact(w, h, image::imageops::FilterType::Lanczos3);
        }
        img
    };

    let target_fmt = format
        .or_else(|| {
            out_ref
                .extension()
                .and_then(|e| e.to_str())
                .and_then(ExportFormat::from_ext_or_name)
        })
        .unwrap_or(ExportFormat::Png);

    export_image(&dyn_img, out_ref, target_fmt, quality)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::RgbaImage;

    #[test]
    fn test_export_png() {
        let temp_dir = std::env::temp_dir();
        let target = temp_dir.join("test_lux_export.png");
        let img = DynamicImage::ImageRgba8(RgbaImage::new(4, 4));

        let res = export_image(&img, &target, ExportFormat::Png, Some(80));
        assert!(res.is_ok());
        assert!(target.exists());

        let _ = std::fs::remove_file(target);
    }
}
