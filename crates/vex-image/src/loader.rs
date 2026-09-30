use crate::metadata::{extract_metadata, ImageMetadata};
use crate::vector::render_svg;
use fast_image_resize as fr;
use fast_image_resize::images::Image as FrImage;
use image::{DynamicImage, GenericImageView, ImageReader, RgbaImage};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ImageLoadError {
    #[error("Failed to open or decode image: {0}")]
    ImageError(#[from] image::ImageError),
    #[error("Vector rendering error: {0}")]
    VectorError(#[from] crate::vector::SvgError),
    #[error("Resizing error: {0}")]
    ResizeError(#[from] fr::ResizeError),
    #[error("Buffer error: {0}")]
    BufferError(#[from] fr::ImageBufferError),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Clone)]
pub struct LoadedImage {
    pub path: PathBuf,
    pub image: DynamicImage,
    pub metadata: ImageMetadata,
}

/// Loads an image file, normalizing orientation based on EXIF tags.
pub fn load_image<P: AsRef<Path>>(path: P) -> Result<LoadedImage, ImageLoadError> {
    let path_ref = path.as_ref();
    let ext = path_ref
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let (mut img, meta) = if ext == "svg" || ext == "svgz" {
        let rgba = render_svg(path_ref, None, None)?;
        let (w, h) = (rgba.width(), rgba.height());
        let meta = ImageMetadata {
            width: w,
            height: h,
            orientation: 1,
            ..Default::default()
        };
        (DynamicImage::ImageRgba8(rgba), meta)
    } else {
        let reader = ImageReader::open(path_ref)?.with_guessed_format()?;
        let dyn_img = reader.decode()?;
        let (w, h) = dyn_img.dimensions();
        let meta = extract_metadata(path_ref, w, h);
        (dyn_img, meta)
    };

    // Apply EXIF orientation
    img = apply_orientation(img, meta.orientation);

    Ok(LoadedImage {
        path: path_ref.to_path_buf(),
        image: img,
        metadata: meta,
    })
}

/// Corrects image rotation and flipping according to standard EXIF orientation tag (1-8).
pub fn apply_orientation(img: DynamicImage, orientation: u32) -> DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate270().fliph(),
        8 => img.rotate270(),
        _ => img, // Orientation 1 is normal
    }
}

/// Generates a fast, high-quality thumbnail using SIMD Lanczos3 algorithm.
pub fn generate_thumbnail(
    img: &DynamicImage,
    max_width: u32,
    max_height: u32,
) -> Result<RgbaImage, ImageLoadError> {
    let (src_w, src_h) = img.dimensions();
    if src_w == 0 || src_h == 0 {
        return Ok(RgbaImage::new(1, 1));
    }

    let scale = (max_width as f64 / src_w as f64)
        .min(max_height as f64 / src_h as f64)
        .min(1.0);
    let dst_w = ((src_w as f64 * scale).round() as u32).max(1);
    let dst_h = ((src_h as f64 * scale).round() as u32).max(1);

    let rgba = img.to_rgba8();
    let src_image = FrImage::from_vec_u8(src_w, src_h, rgba.into_raw(), fr::PixelType::U8x4)?;

    let mut dst_image = FrImage::new(dst_w, dst_h, fr::PixelType::U8x4);
    let mut resizer = fr::Resizer::new();
    resizer.resize(&src_image, &mut dst_image, &fr::ResizeOptions::default())?;

    let output_rgba = RgbaImage::from_raw(dst_w, dst_h, dst_image.into_vec())
        .unwrap_or_else(|| RgbaImage::new(1, 1));
    Ok(output_rgba)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn test_orientation_transformations() {
        let mut img = RgbaImage::new(10, 20);
        img.put_pixel(0, 0, Rgba([255, 0, 0, 255]));
        let dyn_img = DynamicImage::ImageRgba8(img);

        // Orientation 6: rotate 90 degrees clockwise -> 10x20 becomes 20x10
        let transformed = apply_orientation(dyn_img.clone(), 6);
        assert_eq!(transformed.dimensions(), (20, 10));

        // Orientation 3: rotate 180 degrees -> 10x20 remains 10x20
        let rotated180 = apply_orientation(dyn_img.clone(), 3);
        assert_eq!(rotated180.dimensions(), (10, 20));

        // Orientation 1: normal -> unchanged
        let normal = apply_orientation(dyn_img, 1);
        assert_eq!(normal.dimensions(), (10, 20));
    }

    #[test]
    fn test_thumbnail_scaling() {
        let img = DynamicImage::ImageRgba8(RgbaImage::new(1000, 500));
        let thumb =
            generate_thumbnail(&img, 200, 200).expect("thumbnail generation should succeed");
        assert_eq!(thumb.dimensions(), (200, 100));
    }

    #[test]
    fn test_svg_rendering() {
        let svg_data = r#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="red"/></svg>"#;
        let temp_dir = std::env::temp_dir();
        let svg_path = temp_dir.join("vex_test_rect.svg");
        std::fs::write(&svg_path, svg_data).expect("write svg");

        let loaded = load_image(&svg_path).expect("svg should render to dynamic image");
        assert_eq!(loaded.image.dimensions(), (100, 80));
        let _ = std::fs::remove_file(svg_path);
    }
}
