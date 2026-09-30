import React, { useRef, useState, useEffect } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './Viewport.module.css';

export const Viewport: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    zoom,
    pan,
    setZoom,
    setPan,
    resetView,
    activeMode,
    editor,
    updateEditor,
    isPlaying,
    setCurrentTime,
    loadFolder,
  } = useViewerStore();

  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSplitting, setIsSplitting] = useState(false);

  const current = items[currentIndex];

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(zoom * factor);
  };

  // Mouse pan drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSplitting && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      updateEditor({ splitPosition: pos });
      return;
    }

    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsSplitting(false);
  };

  // Double click toggles between fit (1.0) and 2.5x zoom
  const handleDoubleClick = () => {
    if (zoom === 1.0) {
      setZoom(2.0);
    } else {
      resetView();
    }
  };

  // Sync video play/pause
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  const handleOpenFolderPrompt = () => {
    loadFolder('.');
  };

  if (!current) {
    return (
      <div className={styles.viewport}>
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div>No media loaded</div>
          <button className={styles.openFolderBtn} onClick={handleOpenFolderPrompt}>
            Scan Current Workspace
          </button>
        </div>
      </div>
    );
  }

  const isVideo = current.media_type === 'Video';
  const displaySrc = editor.previewUrl || imageDetail?.data_url || '';

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={styles.canvasContainer}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={current.path}
            className={styles.videoElement}
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
            loop
            playsInline
          />
        ) : activeMode === 'edit' && editor.previewUrl ? (
          /* Split comparison mode */
          <div className={styles.splitContainer}>
            <img
              src={imageDetail?.data_url}
              alt="Original"
              className={styles.splitOriginal}
            />
            <div
              className={styles.splitEdited}
              style={{ width: `${editor.splitPosition}%` }}
            >
              <img
                src={editor.previewUrl}
                alt="Edited"
                style={{
                  transform: `rotate(${editor.rotation}deg) scaleX(${editor.flipH ? -1 : 1}) scaleY(${editor.flipV ? -1 : 1})`,
                  filter: `brightness(${100 + editor.brightness}%) contrast(${100 + editor.contrast}%) blur(${editor.blur}px)`,
                }}
              />
            </div>
            <div
              className={styles.splitHandle}
              style={{ left: `${editor.splitPosition}%` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsSplitting(true);
              }}
            >
              <div className={styles.handleGrip}>↔</div>
            </div>
          </div>
        ) : (
          <img
            src={displaySrc}
            alt={current.file_name}
            className={styles.imageElement}
            style={{
              transform: `rotate(${editor.rotation}deg) scaleX(${editor.flipH ? -1 : 1}) scaleY(${editor.flipV ? -1 : 1})`,
              filter: `brightness(${100 + editor.brightness}%) contrast(${100 + editor.contrast}%) blur(${editor.blur}px)`,
            }}
          />
        )}
      </div>
    </div>
  );
};
