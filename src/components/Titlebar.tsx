import React from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './Titlebar.module.css';

interface TitlebarProps {
  onOpenSettings?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ onOpenSettings }) => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    activeMode,
    setActiveMode,
    toggleInspector,
    showInspector,
    openMediaFile,
  } = useViewerStore();

  const current = items[currentIndex];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <header className={styles.titlebar} data-tauri-drag-region>
      <div className={styles.leftSection}>
        <div className={styles.appBrand}>
          <span className={styles.brandDot} />
          vexview
        </div>
        <button
          className={styles.actionBtn}
          onClick={openMediaFile}
          title="Open Media File (Ctrl+O)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Open...
        </button>
        {current && <span className={styles.fileName}>{current.file_name}</span>}
      </div>

      <div className={styles.centerSection}>
        {imageDetail && (
          <div className={`${styles.metaBadge} tabular-nums`}>
            {imageDetail.width} × {imageDetail.height}
          </div>
        )}
        {videoDetail && (
          <div className={`${styles.metaBadge} tabular-nums`}>
            {videoDetail.width} × {videoDetail.height}
            {videoDetail.frame_rate ? ` • ${videoDetail.frame_rate.toFixed(0)} FPS` : ''}
            {videoDetail.video_codec ? ` • ${videoDetail.video_codec.toUpperCase()}` : ''}
          </div>
        )}
        {current && (
          <div className={`${styles.metaBadge} tabular-nums`}>
            {formatFileSize(current.file_size)}
          </div>
        )}
      </div>

      <div className={styles.rightSection}>
        {current?.media_type !== 'Video' && (
          <button
            className={`${styles.actionBtn} ${activeMode === 'edit' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'edit' ? 'view' : 'edit')}
            title="Studio Image Adjustments (E)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit
          </button>
        )}

        {current?.media_type === 'Video' && (
          <button
            className={`${styles.actionBtn} ${activeMode === 'trim' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'trim' ? 'view' : 'trim')}
            title="Lossless Trimmer (T)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
            Trim
          </button>
        )}

        <button
          className={`${styles.actionBtn} ${showInspector ? styles.active : ''}`}
          onClick={toggleInspector}
          title="EXIF & Media Inspector (I)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Info
        </button>

        <button
          className={styles.actionBtn}
          onClick={onOpenSettings}
          title="Settings & Preferences (Ctrl+,)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>
    </header>
  );
};
