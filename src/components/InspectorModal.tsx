import React from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './InspectorModal.module.css';

export const InspectorModal: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    showInspector,
    toggleInspector,
  } = useViewerStore();

  const current = items[currentIndex];
  if (!showInspector || !current) return null;

  return (
    <aside className={styles.inspector}>
      <div className={styles.header}>
        <span className={styles.title}>Media Inspector</span>
        <button className={styles.closeBtn} onClick={toggleInspector}>
          ✕
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.itemGroup}>
          <div className={styles.groupLabel}>File Info</div>
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Name</span>
            <span className={styles.metaValue}>{current.file_name}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Path</span>
            <span className={styles.metaValue}>{current.path}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Type</span>
            <span className={styles.metaValue}>{current.media_type}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>Size</span>
            <span className={`${styles.metaValue} tabular-nums`}>
              {(current.file_size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
        </div>

        {imageDetail && (
          <div className={styles.itemGroup}>
            <div className={styles.groupLabel}>Image & Camera</div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Resolution</span>
              <span className={`${styles.metaValue} tabular-nums`}>
                {imageDetail.width} × {imageDetail.height}
              </span>
            </div>
            {imageDetail.make && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Make</span>
                <span className={styles.metaValue}>{imageDetail.make}</span>
              </div>
            )}
            {imageDetail.model && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Model</span>
                <span className={styles.metaValue}>{imageDetail.model}</span>
              </div>
            )}
            {imageDetail.date_time && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Date / Time</span>
                <span className={styles.metaValue}>{imageDetail.date_time}</span>
              </div>
            )}
          </div>
        )}

        {videoDetail && (
          <div className={styles.itemGroup}>
            <div className={styles.groupLabel}>Video Stream</div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Resolution</span>
              <span className={`${styles.metaValue} tabular-nums`}>
                {videoDetail.width} × {videoDetail.height}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaKey}>Duration</span>
              <span className={`${styles.metaValue} tabular-nums`}>
                {videoDetail.duration_seconds.toFixed(2)}s
              </span>
            </div>
            {videoDetail.video_codec && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Video Codec</span>
                <span className={styles.metaValue}>{videoDetail.video_codec}</span>
              </div>
            )}
            {videoDetail.audio_codec && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Audio Codec</span>
                <span className={styles.metaValue}>{videoDetail.audio_codec}</span>
              </div>
            )}
            {videoDetail.frame_rate && (
              <div className={styles.metaRow}>
                <span className={styles.metaKey}>Framerate</span>
                <span className={`${styles.metaValue} tabular-nums`}>
                  {videoDetail.frame_rate.toFixed(1)} fps
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
