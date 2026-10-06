use image::{DynamicImage, GenericImageView};
use imageproc::filter::gaussian_blur_f32;

/// Adjusts brightness (-100 to 100).
pub fn adjust_brightness(img: &DynamicImage, value: i32) -> DynamicImage {
    img.brighten(value)
}

/// Adjusts contrast (-100.0 to 100.0, where 0.0 is unchanged).
pub fn adjust_contrast(img: &DynamicImage, value: f32) -> DynamicImage {
    img.adjust_contrast(value)
}

/// Converts image to grayscale.
pub fn grayscale(img: &DynamicImage) -> DynamicImage {
    img.grayscale()
}

/// Inverts colors.
pub fn invert(img: &DynamicImage) -> DynamicImage {
    let mut cloned = img.clone();
    cloned.invert();
    cloned
}

/// Applies Gaussian blur with radius sigma.
pub fn blur(img: &DynamicImage, sigma: f32) -> DynamicImage {
    if sigma <= 0.0 {
        return img.clone();
    }
    let rgba = img.to_rgba8();
    let blurred = gaussian_blur_f32(&rgba, sigma);
    DynamicImage::ImageRgba8(blurred)
}

/// Sharpens the image.
pub fn sharpen(img: &DynamicImage, sigma: f32, threshold: i32) -> DynamicImage {
    img.unsharpen(sigma, threshold)
}

/// Adjusts saturation (-100.0 to 100.0, where 0.0 is unchanged).
pub fn adjust_saturation(img: &DynamicImage, value: f32) -> DynamicImage {
    if value.abs() < 0.01 {
        return img.clone();
    }
    let factor = (1.0 + value / 100.0).max(0.0);
    let mut rgba = img.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        pixel[0] = (gray + (r - gray) * factor).clamp(0.0, 255.0) as u8;
        pixel[1] = (gray + (g - gray) * factor).clamp(0.0, 255.0) as u8;
        pixel[2] = (gray + (b - gray) * factor).clamp(0.0, 255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgba)
}

/// Adjusts color warmth / temperature (-100.0 to 100.0).
pub fn adjust_warmth(img: &DynamicImage, value: f32) -> DynamicImage {
    if value.abs() < 0.01 {
        return img.clone();
    }
    let shift = value * 0.5;
    let mut rgba = img.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let r = pixel[0] as f32 + shift;
        let b = pixel[2] as f32 - shift;
        pixel[0] = r.clamp(0.0, 255.0) as u8;
        pixel[2] = b.clamp(0.0, 255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgba)
}

/// Applies classic vintage sepia tone.
pub fn sepia(img: &DynamicImage) -> DynamicImage {
    let mut rgba = img.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let r = pixel[0] as f32;
        let g = pixel[1] as f32;
        let b = pixel[2] as f32;
        let tr = 0.393 * r + 0.769 * g + 0.189 * b;
        let tg = 0.349 * r + 0.686 * g + 0.168 * b;
        let tb = 0.272 * r + 0.534 * g + 0.131 * b;
        pixel[0] = tr.min(255.0) as u8;
        pixel[1] = tg.min(255.0) as u8;
        pixel[2] = tb.min(255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgba)
}

/// Applies pixelation / mosaic effect to a specified rectangular region.
pub fn pixelate_region(
    img: &DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    block_size: u32,
) -> DynamicImage {
    let (img_w, img_h) = img.dimensions();
    if width == 0 || height == 0 || x >= img_w || y >= img_h {
        return img.clone();
    }
    let b = block_size.max(2);
    let x_end = (x + width).min(img_w);
    let y_end = (y + height).min(img_h);

    let mut rgba = img.to_rgba8();

    for by in (y..y_end).step_by(b as usize) {
        for bx in (x..x_end).step_by(b as usize) {
            let bw = (bx + b).min(x_end) - bx;
            let bh = (by + b).min(y_end) - by;
            let total_pixels = (bw * bh) as u64;
            if total_pixels == 0 {
                continue;
            }

            let mut sum_r: u64 = 0;
            let mut sum_g: u64 = 0;
            let mut sum_b: u64 = 0;
            let mut sum_a: u64 = 0;

            for py in by..(by + bh) {
                for px in bx..(bx + bw) {
                    let p = rgba.get_pixel(px, py);
                    sum_r += p[0] as u64;
                    sum_g += p[1] as u64;
                    sum_b += p[2] as u64;
                    sum_a += p[3] as u64;
                }
            }

            let avg_pixel = image::Rgba([
                (sum_r / total_pixels) as u8,
                (sum_g / total_pixels) as u8,
                (sum_b / total_pixels) as u8,
                (sum_a / total_pixels) as u8,
            ]);

            for py in by..(by + bh) {
                for px in bx..(bx + bw) {
                    rgba.put_pixel(px, py, avg_pixel);
                }
            }
        }
    }

    DynamicImage::ImageRgba8(rgba)
}

/// Applies Gaussian blur specifically within a rectangular region.
pub fn blur_region(
    img: &DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    sigma: f32,
) -> DynamicImage {
    let (img_w, img_h) = img.dimensions();
    if width == 0 || height == 0 || x >= img_w || y >= img_h || sigma <= 0.0 {
        return img.clone();
    }
    let x_end = (x + width).min(img_w);
    let y_end = (y + height).min(img_h);
    let actual_w = x_end - x;
    let actual_h = y_end - y;

    let sub_img = img.crop_imm(x, y, actual_w, actual_h);
    let sub_rgba = sub_img.to_rgba8();
    let blurred_sub = gaussian_blur_f32(&sub_rgba, sigma);

    let mut result_rgba = img.to_rgba8();
    for py in 0..actual_h {
        for px in 0..actual_w {
            let p = blurred_sub.get_pixel(px, py);
            result_rgba.put_pixel(x + px, y + py, *p);
        }
    }

    DynamicImage::ImageRgba8(result_rgba)
}

/// Applies subtle or strong vignette darkening around corners.
pub fn vignette(img: &DynamicImage, intensity: f32, radius: f32) -> DynamicImage {
    if intensity <= 0.0 {
        return img.clone();
    }
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 {
        return img.clone();
    }
    let cx = w as f32 / 2.0;
    let cy = h as f32 / 2.0;
    let max_dist = (cx * cx + cy * cy).sqrt() * radius.clamp(0.1, 2.0);

    let mut rgba = img.to_rgba8();
    for y in 0..h {
        for x in 0..w {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let factor = (1.0 - (dist / max_dist) * intensity.clamp(0.0, 1.0)).clamp(0.0, 1.0);

            let p = rgba.get_pixel_mut(x, y);
            p[0] = ((p[0] as f32) * factor) as u8;
            p[1] = ((p[1] as f32) * factor) as u8;
            p[2] = ((p[2] as f32) * factor) as u8;
        }
    }
    DynamicImage::ImageRgba8(rgba)
}

/// Automatically enhances image contrast via min/max histogram stretching.
pub fn auto_contrast(img: &DynamicImage) -> DynamicImage {
    let mut rgba = img.to_rgba8();
    let mut min_val = 255u8;
    let mut max_val = 0u8;

    for p in rgba.pixels() {
        let lum = ((0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32).round() as u8).min(255);
        if lum < min_val {
            min_val = lum;
        }
        if lum > max_val {
            max_val = lum;
        }
    }

    if max_val <= min_val {
        return img.clone();
    }

    let range = (max_val - min_val) as f32;
    for p in rgba.pixels_mut() {
        p[0] = (((p[0].saturating_sub(min_val)) as f32 / range) * 255.0).clamp(0.0, 255.0) as u8;
        p[1] = (((p[1].saturating_sub(min_val)) as f32 / range) * 255.0).clamp(0.0, 255.0) as u8;
        p[2] = (((p[2].saturating_sub(min_val)) as f32 / range) * 255.0).clamp(0.0, 255.0) as u8;
    }
    DynamicImage::ImageRgba8(rgba)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GenericImageView, Rgba, RgbaImage};

    #[test]
    fn test_filters_execution() {
        let mut img = RgbaImage::new(10, 10);
        img.put_pixel(5, 5, Rgba([100, 150, 200, 255]));
        let dyn_img = DynamicImage::ImageRgba8(img);

        let brightened = adjust_brightness(&dyn_img, 20);
        assert_eq!(brightened.dimensions(), (10, 10));

        let contrast = adjust_contrast(&dyn_img, 10.0);
        assert_eq!(contrast.dimensions(), (10, 10));

        let gray = grayscale(&dyn_img);
        assert_eq!(gray.dimensions(), (10, 10));

        let inv = invert(&dyn_img);
        assert_eq!(inv.dimensions(), (10, 10));

        let blurred = blur(&dyn_img, 1.0);
        assert_eq!(blurred.dimensions(), (10, 10));

        let sharp = sharpen(&dyn_img, 1.0, 5);
        assert_eq!(sharp.dimensions(), (10, 10));
    }
}
