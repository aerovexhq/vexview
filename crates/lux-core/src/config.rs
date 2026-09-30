use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZoomMode {
    FitToWindow,
    OriginalSize,
    Stretch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewerConfig {
    pub auto_play_videos: bool,
    pub loop_videos: bool,
    pub default_volume: f64,
    pub wrap_navigation: bool,
    pub default_zoom_mode: ZoomMode,
    pub cache_capacity: usize,
    pub background_dark: bool,
    pub show_filmstrip: bool,
    pub autostart_at_boot: bool,
    pub keep_running_in_background: bool,
}

impl Default for ViewerConfig {
    fn default() -> Self {
        Self {
            auto_play_videos: true,
            loop_videos: true,
            default_volume: 1.0,
            wrap_navigation: true,
            default_zoom_mode: ZoomMode::FitToWindow,
            cache_capacity: 10,
            background_dark: true,
            show_filmstrip: true,
            autostart_at_boot: true,
            keep_running_in_background: true,
        }
    }
}

impl ViewerConfig {
    fn config_path() -> Option<PathBuf> {
        ProjectDirs::from("org", "luxviewer", "luxviewer")
            .map(|dirs| dirs.config_dir().join("config.json"))
    }

    /// Loads configuration from disk, or returns default if not present or corrupt.
    pub fn load() -> Self {
        if let Some(path) = Self::config_path() {
            if path.exists() {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str::<ViewerConfig>(&content) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    /// Saves the current configuration to disk.
    pub fn save(&self) -> Result<(), std::io::Error> {
        if let Some(path) = Self::config_path() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent)?;
            }
            let serialized = serde_json::to_string_pretty(self).map_err(std::io::Error::other)?;
            fs::write(path, serialized)?;
        }
        Ok(())
    }
}
