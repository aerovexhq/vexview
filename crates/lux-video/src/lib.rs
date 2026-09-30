pub mod metadata;
pub mod trimmer;

pub use metadata::{probe_video, VideoMetadata};
pub use trimmer::{capture_frame, export_gif, trim_video_lossless, VideoProcessError};
