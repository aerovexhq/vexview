use image::{DynamicImage, ImageError, ImageFormat};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Png,
    Jpeg,
    WebP,
}

impl ExportFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            ExportFormat::Png => "png",
            ExportFormat::Jpeg => "jpg",
            ExportFormat::WebP => "webp",
        }
    }
}

/// Saves an edited image to the specified path in the chosen format.
pub fn export_image<P: AsRef<Path>>(
    img: &DynamicImage,
    destination: P,
    format: ExportFormat,
) -> Result<(), ImageError> {
    let file = File::create(destination.as_ref())?;
    let mut writer = BufWriter::new(file);

    let img_format = match format {
        ExportFormat::Png => ImageFormat::Png,
        ExportFormat::Jpeg => ImageFormat::Jpeg,
        ExportFormat::WebP => ImageFormat::WebP,
    };

    img.write_to(&mut writer, img_format)?;
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

        let res = export_image(&img, &target, ExportFormat::Png);
        assert!(res.is_ok());
        assert!(target.exists());

        let _ = std::fs::remove_file(target);
    }
}
