use image::DynamicImage;
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
