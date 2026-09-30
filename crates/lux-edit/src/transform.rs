use image::{DynamicImage, GenericImageView};

/// Rotates the image 90 degrees clockwise.
pub fn rotate_90(img: &DynamicImage) -> DynamicImage {
    img.rotate90()
}

/// Rotates the image 180 degrees.
pub fn rotate_180(img: &DynamicImage) -> DynamicImage {
    img.rotate180()
}

/// Rotates the image 270 degrees clockwise (90 degrees counter-clockwise).
pub fn rotate_270(img: &DynamicImage) -> DynamicImage {
    img.rotate270()
}

/// Flips the image horizontally.
pub fn flip_h(img: &DynamicImage) -> DynamicImage {
    img.fliph()
}

/// Flips the image vertically.
pub fn flip_v(img: &DynamicImage) -> DynamicImage {
    img.flipv()
}

/// Crops the image to the specified bounding box (clamped to image dimensions).
pub fn crop(img: &DynamicImage, x: u32, y: u32, width: u32, height: u32) -> DynamicImage {
    let (img_w, img_h) = img.dimensions();
    let clamped_x = x.min(img_w.saturating_sub(1));
    let clamped_y = y.min(img_h.saturating_sub(1));
    let clamped_w = width.min(img_w - clamped_x).max(1);
    let clamped_h = height.min(img_h - clamped_y).max(1);

    img.crop_imm(clamped_x, clamped_y, clamped_w, clamped_h)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn test_crop_and_rotate() {
        let mut img = RgbaImage::new(100, 100);
        img.put_pixel(10, 10, Rgba([255, 0, 0, 255]));
        let dyn_img = DynamicImage::ImageRgba8(img);

        let cropped = crop(&dyn_img, 10, 10, 20, 20);
        assert_eq!(cropped.dimensions(), (20, 20));

        let rotated = rotate_90(&cropped);
        assert_eq!(rotated.dimensions(), (20, 20));
    }
}
