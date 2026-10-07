pub mod composer;
pub mod metadata;
pub mod trimmer;

pub use composer::{
    compose_audio_sequence, compose_video_sequence, AudioTrackInput, ComposeAudioRequest,
    ComposeRequest, SequenceClipInput,
};
pub use metadata::{probe_audio, probe_video, AudioMetadata, VideoMetadata};
pub use trimmer::{
    capture_frame, convert_audio, export_gif, extract_audio_track, extract_burst_frames,
    process_video_advanced, trim_audio, trim_video, trim_video_lossless, AdvancedVideoParams,
    ColorGradingParams, VideoCropParams, VideoProcessError,
};
