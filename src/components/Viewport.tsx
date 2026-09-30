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
    setPan,
    setZoomAndPan,
    resetView,
    activeMode,
    editor,
    updateEditor,
    isPlaying,
    setCurrentTime,
    setDuration,
    seekTime,
    openMediaFile,
    openMediaFolder,
  } = useViewerStore();

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const [isSplitting, setIsSplitting] = useState(false);

  const current = items[currentIndex];

  // Keep refs synchronized with external store changes (navigation, reset, HUD clicks)
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
    if (canvasRef.current && !isDraggingRef.current) {
      canvasRef.current.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`;
    }
  }, [pan, zoom]);

  // Non-passive wheel listener for smooth cursor-centered zoom without browser scroll lag
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const newZoom = Math.max(0.1, Math.min(currentZoom * factor, 32.0));

      if (newZoom !== currentZoom && el) {
        const rect = el.getBoundingClientRect();
        const offsetX = e.clientX - (rect.left + rect.width / 2);
        const offsetY = e.clientY - (rect.top + rect.height / 2);
        const scaleRatio = newZoom / currentZoom;
        const newPanX = offsetX - (offsetX - currentPan.x) * scaleRatio;
        const newPanY = offsetY - (offsetY - currentPan.y) * scaleRatio;

        const updatedPan = { x: Math.round(newPanX), y: Math.round(newPanY) };
        panRef.current = updatedPan;
        zoomRef.current = newZoom;

        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate3d(${updatedPan.x}px, ${updatedPan.y}px, 0px) scale(${newZoom})`;
        }

        setZoomAndPan(newZoom, updatedPan);
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, [setZoomAndPan]);

  // Pointer drag pan with direct GPU RAF pipeline for zero-lag tracking
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(`.${styles.splitHandle}`)) return;
    if ((e.target as HTMLElement).closest(`.${styles.buttonGroup}`)) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };

    if (viewportRef.current) {
      viewportRef.current.dataset.dragging = 'true';
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSplitting && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      updateEditor({ splitPosition: pos });
      return;
    }

    if (!isDraggingRef.current) return;

    panRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0px) scale(${zoomRef.current})`;
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSplitting) {
      setIsSplitting(false);
    }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;

      if (viewportRef.current) {
        viewportRef.current.dataset.dragging = 'false';
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0px) scale(${zoomRef.current})`;
      }

      setPan(panRef.current);
    }
  };

  // Double click toggles between fit (1.0) and 2.5x zoom centered on click
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.splitHandle}`)) return;
    if ((e.target as HTMLElement).closest(`.${styles.buttonGroup}`)) return;

    if (zoom === 1.0 && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const offsetX = e.clientX - (rect.left + rect.width / 2);
      const offsetY = e.clientY - (rect.top + rect.height / 2);
      const newZoom = 2.5;
      const scaleRatio = newZoom / zoom;
      const newPanX = offsetX - (offsetX - panRef.current.x) * scaleRatio;
      const newPanY = offsetY - (offsetY - panRef.current.y) * scaleRatio;
      const updatedPan = { x: Math.round(newPanX), y: Math.round(newPanY) };

      panRef.current = updatedPan;
      zoomRef.current = newZoom;

      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${updatedPan.x}px, ${updatedPan.y}px, 0px) scale(${newZoom})`;
      }

      setZoomAndPan(newZoom, updatedPan);
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

  // Handle seeking from timeline
  useEffect(() => {
    if (seekTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  }, [seekTime]);

  if (!current) {
    return (
      <div className={styles.viewport}>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div className={styles.emptyTitle}>No media loaded</div>
          <div className={styles.emptySubtitle}>
            Select an image or video to preview and edit
          </div>
          <div className={styles.buttonGroup}>
            <button
              className={styles.primaryBtn}
              onClick={openMediaFile}
              title="Open File (Ctrl+O)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              Open Media...
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={openMediaFolder}
              title="Open Folder"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Open Folder...
            </button>
          </div>
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        ref={canvasRef}
        className={styles.canvasContainer}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
        }}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={current.path}
            className={styles.videoElement}
            onLoadedMetadata={(e) => {
              const d = (e.target as HTMLVideoElement).duration;
              if (d > 0) setDuration(d);
            }}
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
              onPointerDown={(e) => {
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
