use crate::media_item::MediaItem;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanFilter {
    AllMedia,
    ImagesOnly,
    VideosOnly,
    AudioOnly,
}

/// Scans a directory for supported media items and returns them sorted naturally.
pub fn scan_directory<P: AsRef<Path>>(dir: P, filter: ScanFilter) -> Vec<MediaItem> {
    let dir = dir.as_ref();
    if !dir.is_dir() {
        return Vec::new();
    }

    let mut items = Vec::new();
    // Only scan immediate children of the directory (non-recursive) for standard gallery view
    for entry in WalkDir::new(dir)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() {
            if let Some(item) = MediaItem::from_path(path) {
                let matches_filter = match filter {
                    ScanFilter::AllMedia => true,
                    ScanFilter::ImagesOnly => item.media_type.is_image(),
                    ScanFilter::VideosOnly => item.media_type.is_video(),
                    ScanFilter::AudioOnly => item.media_type.is_audio(),
                };

                if matches_filter {
                    items.push(item);
                }
            }
        }
    }

    // Natural sort by filename (e.g. 1.png, 2.png, 10.png)
    items.sort_by(|a, b| natord::compare(&a.file_name, &b.file_name));
    items
}

/// Finds the index of a file path in an items slice.
pub fn find_item_index(items: &[MediaItem], target: &Path) -> Option<usize> {
    let canonical_target = target
        .canonicalize()
        .ok()
        .unwrap_or_else(|| target.to_path_buf());
    items.iter().position(|item| {
        item.path == target || item.path.canonicalize().ok().as_ref() == Some(&canonical_target)
    })
}

/// Returns the previous and next media items relative to the current index (with optional wrapping).
pub fn get_adjacent_items(
    items: &[MediaItem],
    current_index: usize,
    wrap: bool,
) -> (Option<&MediaItem>, Option<&MediaItem>) {
    if items.is_empty() {
        return (None, None);
    }

    let prev = if current_index > 0 {
        items.get(current_index - 1)
    } else if wrap && items.len() > 1 {
        items.last()
    } else {
        None
    };

    let next = if current_index + 1 < items.len() {
        items.get(current_index + 1)
    } else if wrap && items.len() > 1 {
        items.first()
    } else {
        None
    };

    (prev, next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_item::MediaType;
    use std::path::PathBuf;

    #[test]
    fn test_adjacent_navigation() {
        let item1 = MediaItem {
            path: PathBuf::from("/a/1.png"),
            file_name: "1.png".to_string(),
            media_type: MediaType::Image,
            file_size: 100,
            modified: None,
        };
        let item2 = MediaItem {
            path: PathBuf::from("/a/2.png"),
            file_name: "2.png".to_string(),
            media_type: MediaType::Image,
            file_size: 200,
            modified: None,
        };
        let item3 = MediaItem {
            path: PathBuf::from("/a/3.png"),
            file_name: "3.png".to_string(),
            media_type: MediaType::Image,
            file_size: 300,
            modified: None,
        };

        let list = vec![item1.clone(), item2.clone(), item3.clone()];

        // Middle item
        let (prev, next) = get_adjacent_items(&list, 1, false);
        assert_eq!(prev, Some(&item1));
        assert_eq!(next, Some(&item3));

        // First item with wrap
        let (prev_wrap, next_wrap) = get_adjacent_items(&list, 0, true);
        assert_eq!(prev_wrap, Some(&item3));
        assert_eq!(next_wrap, Some(&item2));
    }
}
