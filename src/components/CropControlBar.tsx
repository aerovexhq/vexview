import React from 'react';
import { useViewerStore, CropAspectRatio } from '../stores/useViewerStore';
import styles from './CropControlBar.module.css';

const getTargetRatio = (ratio: CropAspectRatio): number | null => {
  switch (ratio) {
    case '1:1':
      return 1.0;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case '4:3':
      return 4 / 3;
    case '3:2':
      return 3 / 2;
    case '21:9':
      return 21 / 9;
    default:
      return null;
  }
};

export const CropControlBar: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    cropBox,
    setCropBox,
    cropAspectRatio,
    setCropAspectRatio,
    setActiveSubTool,
    updateEditor,
    updateVideoParams,
  } = useViewerStore();

  const current = items[currentIndex];
  const isVideo = current?.media_type === 'Video';

  const mediaWidth = isVideo
    ? (videoDetail?.width || 1920)
    : (imageDetail?.width || 1920);

  const mediaHeight = isVideo
    ? (videoDetail?.height || 1080)
    : (imageDetail?.height || 1080);

  const handleSetRatio = (ratio: CropAspectRatio) => {
    setCropAspectRatio(ratio);
    const target = getTargetRatio(ratio);
    if (target !== null && cropBox) {
      let w = cropBox.width;
      let h = Math.round(w / target);
      if (h > mediaHeight) {
        h = mediaHeight;
        w = Math.round(h * target);
      }
      const x = Math.max(0, Math.min(cropBox.x, mediaWidth - w));
      const y = Math.max(0, Math.min(cropBox.y, mediaHeight - h));
      setCropBox({ x, y, width: w, height: h });
    }
  };

  const handleApply = () => {
    if (cropBox) {
      if (isVideo) {
        updateVideoParams({ crop: cropBox });
      } else {
        updateEditor({ crop: cropBox });
      }
    }
    setActiveSubTool('select');
  };

  const handleCancel = () => {
    setCropBox(null);
    setActiveSubTool('select');
  };

  return (
    <div
      className={styles.barWrapper}
      data-role="crop-control-bar"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className={styles.barContainer}>
        {/* Preset aspect ratio buttons */}
        <div className={styles.presetGroup}>
          {(['free', '1:1', '16:9', '9:16', '4:3', '3:2', '21:9'] as CropAspectRatio[]).map((r) => (
            <button
              key={r}
              className={`${styles.ratioBtn} ${cropAspectRatio === r ? styles.active : ''}`}
              onClick={() => handleSetRatio(r)}
            >
              {r === 'free' ? 'Free' : r}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Live crop pixel dimensions */}
        {cropBox && (
          <div className={`${styles.dimensionBadge} tabular-nums`}>
            {Math.round(cropBox.width)} × {Math.round(cropBox.height)}
          </div>
        )}

        <div className={styles.divider} />

        {/* Apply & Cancel actions */}
        <button className={styles.applyBtn} onClick={handleApply} title="Apply Crop (Enter)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Apply
        </button>

        <button className={styles.cancelBtn} onClick={handleCancel} title="Cancel Crop (Esc)">
          ✕
        </button>
      </div>
    </div>
  );
};
