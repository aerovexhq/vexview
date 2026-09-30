use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Represents the high-level category of a media file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MediaType {
    /// Static raster image (PNG, JPEG, WebP, AVIF, BMP, ICO, TIFF)
    Image,
    /// Animated image (GIF, animated WebP, APNG)
    AnimatedImage,
    /// Scalable Vector Graphic (SVG)
    Svg,
    /// Video file (MP4, MKV, WebM, AVI, MOV, FLV, WMV)
    Video,
    /// Unsupported or unknown media format
    Unknown,
}

impl MediaType {
    pub fn is_image(&self) -> bool {
        matches!(
            self,
            MediaType::Image | MediaType::AnimatedImage | MediaType::Svg
        )
    }

    pub fn is_video(&self) -> bool {
        matches!(self, MediaType::Video)
    }
}

/// Represents a media file discovered in the filesystem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaItem {
    pub path: PathBuf,
    pub file_name: String,
    pub media_type: MediaType,
    pub file_size: u64,
    pub modified: Option<SystemTime>,
}

impl MediaItem {
    /// Detects media type and creates a `MediaItem` from a file path.
    pub fn from_path<P: AsRef<Path>>(path: P) -> Option<Self> {
        let path = path.as_ref();
        if !path.is_file() {
            return None;
        }

        let media_type = detect_media_type(path);
        if media_type == MediaType::Unknown {
            return None;
        }

        let file_name = path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| "unnamed".to_string());

        let metadata = path.metadata().ok();
        let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = metadata.and_then(|m| m.modified().ok());

        Some(Self {
            path: path.to_path_buf(),
            file_name,
            media_type,
            file_size,
            modified,
        })
    }
}

/// Detects the `MediaType` of a file using both extension and MIME guess.
pub fn detect_media_type<P: AsRef<Path>>(path: P) -> MediaType {
    let path = path.as_ref();

    if let Some(ext) = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
    {
        match ext.as_str() {
            "svg" | "svgz" => return MediaType::Svg,
            "gif" => return MediaType::AnimatedImage,
            "png" | "jpg" | "jpeg" | "jpe" | "jif" | "jfif" | "webp" | "bmp" | "ico" | "tiff"
            | "tif" | "avif" | "heic" | "heif" | "hdr" | "exr" | "qoi" => {
                return MediaType::Image;
            }
            "mp4" | "m4v" | "mkv" | "webm" | "avi" | "mov" | "flv" | "wmv" | "ogv" | "ts" => {
                return MediaType::Video;
            }
            _ => {}
        }
    }

    // Fallback to MIME type detection
    let mime = mime_guess::from_path(path).first();
    if let Some(m) = mime {
        let type_str = m.type_().as_str();
        let subtype = m.subtype().as_str();

        if type_str == "image" {
            if subtype == "svg+xml" {
                return MediaType::Svg;
            }
            if subtype == "gif" {
                return MediaType::AnimatedImage;
            }
            return MediaType::Image;
        } else if type_str == "video" {
            return MediaType::Video;
        }
    }

    MediaType::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_media_type_detection() {
        assert_eq!(detect_media_type("sample.png"), MediaType::Image);
        assert_eq!(detect_media_type("sample.jpg"), MediaType::Image);
        assert_eq!(detect_media_type("sample.svg"), MediaType::Svg);
        assert_eq!(detect_media_type("sample.gif"), MediaType::AnimatedImage);
        assert_eq!(detect_media_type("sample.mp4"), MediaType::Video);
        assert_eq!(detect_media_type("sample.mkv"), MediaType::Video);
        assert_eq!(detect_media_type("unknown.xyz"), MediaType::Unknown);
    }
}
