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
