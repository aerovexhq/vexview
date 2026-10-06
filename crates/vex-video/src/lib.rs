pub mod composer;
pub mod metadata;
pub mod trimmer;

pub use composer::{
    compose_video_sequence, AudioTrackInput, ComposeRequest, SequenceClipInput,
};
pub use metadata::{probe_video, VideoMetadata};
pub use trimmer::{
    capture_frame, export_gif, extract_audio_track, extract_burst_frames, process_video_advanced,
    trim_video, trim_video_lossless, AdvancedVideoParams, ColorGradingParams, VideoCropParams,
    VideoProcessError,
};
