pub mod composer;
pub mod metadata;
pub mod trimmer;

pub use composer::{
    compose_video_sequence, AudioTrackInput, ComposeRequest, SequenceClipInput,
};
pub use metadata::{probe_video, VideoMetadata};
pub use trimmer::{capture_frame, export_gif, trim_video, trim_video_lossless, VideoProcessError};
