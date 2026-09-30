use image::RgbaImage;
use resvg::tiny_skia::{Pixmap, Transform};
use resvg::usvg::{Options, Tree};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SvgError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Failed to parse SVG: {0}")]
    Parse(#[from] resvg::usvg::Error),
    #[error("Failed to allocate pixmap buffer")]
    Allocation,
}

/// Renders an SVG file to an RGBA pixel buffer at the specified target dimensions.
pub fn render_svg<P: AsRef<Path>>(
    path: P,
    target_width: Option<u32>,
    target_height: Option<u32>,
) -> Result<RgbaImage, SvgError> {
    let svg_data = fs::read(path)?;
    let opt = Options::default();
    let rtree = Tree::from_data(&svg_data, &opt)?;

    let svg_size = rtree.size();
    let (width, height) = match (target_width, target_height) {
        (Some(w), Some(h)) => (w, h),
        (Some(w), None) => {
            let scale = w as f32 / svg_size.width();
            (w, (svg_size.height() * scale).round() as u32)
        }
        (None, Some(h)) => {
            let scale = h as f32 / svg_size.height();
            ((svg_size.width() * scale).round() as u32, h)
        }
        (None, None) => (
            svg_size.width().round() as u32,
            svg_size.height().round() as u32,
        ),
    };

    let mut pixmap = Pixmap::new(width.max(1), height.max(1)).ok_or(SvgError::Allocation)?;

    let sx = width as f32 / svg_size.width();
    let sy = height as f32 / svg_size.height();
    let transform = Transform::from_scale(sx, sy);

    resvg::render(&rtree, transform, &mut pixmap.as_mut());

    let raw = pixmap.take();
    RgbaImage::from_raw(width.max(1), height.max(1), raw).ok_or(SvgError::Allocation)
}
