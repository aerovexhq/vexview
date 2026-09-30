import React from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './Titlebar.module.css';

export const Titlebar: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    activeMode,
    setActiveMode,
    toggleInspector,
    showInspector,
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
          luxviewer
        </div>
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
      </div>
    </header>
  );
};
