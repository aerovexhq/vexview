import React, { useRef, useState, useEffect, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useViewerStore } from '../stores/useViewerStore';
import { CropOverlay } from './CropOverlay';
import { AnnotationLayer } from './AnnotationLayer';
import { ToolPalette } from './ToolPalette';
import styles from './Viewport.module.css';

const getSafeArea = (viewportEl: HTMLElement) => {
  const viewportRect = viewportEl.getBoundingClientRect();

  // Find top bar element
  const topEl = (viewportEl.querySelector('[data-role="tool-palette"]') ||
    document.querySelector('[data-role="tool-palette"]')) as HTMLElement | null;
  let topBarrier = 0;
  if (topEl) {
    const topRect = topEl.getBoundingClientRect();
    topBarrier = Math.max(0, topRect.bottom - viewportRect.top);
  }

  // Find bottom bar element (FloatingHud or VideoTimeline)
  const bottomHudEl = document.querySelector('[data-role="floating-hud"]') as HTMLElement | null;
  const bottomTimelineEl = document.querySelector('[data-role="video-timeline"]') as HTMLElement | null;
  const bottomBar = bottomTimelineEl || bottomHudEl;

  let bottomBarrier = 126;
  if (bottomBar) {
    const bottomRect = bottomBar.getBoundingClientRect();
    if (bottomRect.top < viewportRect.bottom && bottomRect.bottom > viewportRect.top) {
      bottomBarrier = Math.max(0, viewportRect.bottom - bottomRect.top);
    }
  }

  const verticalPadding = 24; // Padding from top and bottom bars
  const horizontalPadding = 32;

  const effectiveTop = Math.max(16, topBarrier + verticalPadding);
  const effectiveBottom = Math.max(16, bottomBarrier + verticalPadding);

  const availableWidth = Math.max(100, viewportRect.width - (horizontalPadding * 2));
  const availableHeight = Math.max(100, viewportRect.height - effectiveTop - effectiveBottom);

  const safeCenterY = effectiveTop + availableHeight / 2;
  const viewportCenterY = viewportRect.height / 2;
  const targetPanY = Math.round(safeCenterY - viewportCenterY);
  const targetPanX = 0;

  return {
    availableWidth,
    availableHeight,
    targetPanX,
    targetPanY,
  };
};

export const Viewport: React.FC = () => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    loading,
    error,
    zoom,
    pan,
    setPan,
    setZoomAndPan,
    setCenterViewAction,
    activeMode,
    editor,
    updateEditor,
    isPlaying,
    setCurrentTime,
    setDuration,
    seekTime,
    openMediaFile,
    openMediaFolder,
    activeSubTool,
    setActiveSubTool,
    cropBox,
    setCropBox,
    updateVideoParams,
    undoAnnotation,
    redoAnnotation,
    copyNotice,
    copyCurrentToClipboard,
  } = useViewerStore();

  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const wheelRafRef = useRef<number | null>(null);

  const [isSplitting, setIsSplitting] = useState(false);

  const current = items[currentIndex];
  const isVideo = current?.media_type === 'Video';

  // Synchronize internal refs with store coordinates
  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
    if (canvasRef.current && !isDraggingRef.current) {
      canvasRef.current.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`;
    }
  }, [pan, zoom]);

  // Tactile keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copyCurrentToClipboard();
          return;
        }
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            redoAnnotation();
          } else {
            undoAnnotation();
          }
          return;
        }
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redoAnnotation();
          return;
        }
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setActiveSubTool('select');
            break;
          case 'c':
            setActiveSubTool('crop');
            break;
          case 'p':
            setActiveSubTool('pen');
            break;
          case 'h':
            setActiveSubTool('highlighter');
            break;
          case 'l':
            setActiveSubTool('line');
            break;
          case 'a':
            setActiveSubTool('arrow');
            break;
          case 'r':
            setActiveSubTool('rect');
            break;
          case 'o':
            setActiveSubTool('ellipse');
            break;
          case 'b':
            setActiveSubTool('badge');
            break;
          case 't':
            setActiveSubTool('text');
            break;
          case 'e':
            setActiveSubTool('eraser');
            break;
          case 'i':
            setActiveSubTool('eyedropper');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSubTool, undoAnnotation, redoAnnotation]);

  // Center and fit media in the safe area between top tools and bottom bar with padding
  const centerAndFitMedia = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !current) return;

    const mw = isVideo
      ? (videoDetail?.width || videoRef.current?.videoWidth || 1920)
      : (imageDetail?.width || imgRef.current?.naturalWidth || 1920);

    const mh = isVideo
      ? (videoDetail?.height || videoRef.current?.videoHeight || 1080)
      : (imageDetail?.height || imgRef.current?.naturalHeight || 1080);

    if (mw <= 0 || mh <= 0) return;

    const { availableWidth, availableHeight, targetPanX, targetPanY } = getSafeArea(el);

    const scaleX = availableWidth / mw;
    const scaleY = availableHeight / mh;
    const fitScale = Math.min(scaleX, scaleY);

    const targetZoom = Number((fitScale < 1.0 ? fitScale : Math.min(fitScale, 1.0)).toFixed(4));
    const newPan = { x: targetPanX, y: targetPanY };

    panRef.current = newPan;
    zoomRef.current = targetZoom;

    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0px) scale(${targetZoom})`;
    }

    setZoomAndPan(targetZoom, newPan);
  }, [current, isVideo, videoDetail, imageDetail, setZoomAndPan]);

  // Expose centerAndFitMedia to store
  useEffect(() => {
    setCenterViewAction(centerAndFitMedia);
    return () => setCenterViewAction(null);
  }, [centerAndFitMedia, setCenterViewAction]);

  // Initial auto-centering on media change or mode change
  useEffect(() => {
    if (current) {
      const timer = setTimeout(() => {
        centerAndFitMedia();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [current?.path, activeMode, centerAndFitMedia]);

  // Re-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      centerAndFitMedia();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [centerAndFitMedia]);

  // Window-level non-passive wheel listener:
  // - Ctrl+Scroll / Alt+Scroll / Trackpad pinch: cursor-anchored zoom in and out
  // - Normal scroll: 2D panning (vertical dy pans up/down, horizontal dx pans left/right, Shift+wheel pans horizontal)
  useEffect(() => {
    const handleWheelNative = (e: WheelEvent) => {
      // Allow native scrolling inside form controls, drawers, modals, titlebars, and filmstrip
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [data-no-wheel="true"]') ||
        target?.closest('[data-modal="true"], .modal') ||
        target?.closest('[data-drawer="true"], aside') ||
        target?.closest('header, [data-role="titlebar"]') ||
        target?.closest('[data-role="filmstrip"]')
      ) {
        return;
      }

      // If no media loaded, do not capture wheel
      if (!current) return;

      e.preventDefault();

      // Normalize deltas across platforms, browsers, and deltaMode
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        // Line delta mode (WebKitGTK on Linux)
        dx *= 24;
        dy *= 24;
      } else if (e.deltaMode === 2) {
        // Page delta mode
        dx *= 400;
        dy *= 400;
      }

      const isZoom = e.ctrlKey || e.metaKey || e.altKey;

      if (isZoom) {
        // Zoom in/out anchored to mouse cursor
        const absDy = Math.abs(dy);
        if (absDy < 1) return;

        let factor: number;
        if (absDy < 30) {
          // Smooth continuous trackpad pinch
          factor = Math.exp(-dy * 0.01);
        } else {
          // Discrete mouse wheel tick: scroll up (negative) zooms in, scroll down (positive) zooms out
          factor = dy < 0 ? 1.15 : 0.85;
        }

        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        const newZoom = Math.max(0.05, Math.min(currentZoom * factor, 32.0));

        if (newZoom !== currentZoom) {
          const el = viewportRef.current || document.body;
          const rect = el.getBoundingClientRect();
          const cursorX = e.clientX - (rect.left + rect.width / 2);
          const cursorY = e.clientY - (rect.top + rect.height / 2);
          const scaleRatio = newZoom / currentZoom;
          const newPanX = cursorX - (cursorX - currentPan.x) * scaleRatio;
          const newPanY = cursorY - (cursorY - currentPan.y) * scaleRatio;

          const updatedPan = { x: Math.round(newPanX), y: Math.round(newPanY) };
          panRef.current = updatedPan;
          zoomRef.current = newZoom;

          if (canvasRef.current) {
            canvasRef.current.style.transform = `translate3d(${updatedPan.x}px, ${updatedPan.y}px, 0px) scale(${newZoom})`;
          }

          if (wheelRafRef.current === null) {
            wheelRafRef.current = requestAnimationFrame(() => {
              wheelRafRef.current = null;
              setZoomAndPan(zoomRef.current, panRef.current);
            });
          }
        }
      } else {
        // Normal scroll: pan up/down or left/right depending on scroll type
        let panDeltaX = 0;
        let panDeltaY = 0;

        if (e.shiftKey) {
          // Shift + Scroll: horizontal pan
          panDeltaX = dy !== 0 ? dy : dx;
          panDeltaY = 0;
        } else {
          // Normal 2D pan: dy for vertical (up/down), dx for horizontal (left/right)
          panDeltaX = dx;
          panDeltaY = dy;
        }

        if (panDeltaX === 0 && panDeltaY === 0) return;

        const newPanX = Math.round(panRef.current.x - panDeltaX);
        const newPanY = Math.round(panRef.current.y - panDeltaY);
        const updatedPan = { x: newPanX, y: newPanY };

        panRef.current = updatedPan;

        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0px) scale(${zoomRef.current})`;
        }

        if (wheelRafRef.current === null) {
          wheelRafRef.current = requestAnimationFrame(() => {
            wheelRafRef.current = null;
            setPan(panRef.current);
          });
        }
      }
    };

    window.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheelNative);
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
    };
  }, [current, setZoomAndPan, setPan]);

  // Pointer drag pan: left-click in view mode or select tool; right-click in any mode (including edit mode)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isRightClick = e.button === 2;
    const isLeftClick = e.button === 0;

    const canPan = isRightClick || (isLeftClick && (activeMode !== 'edit' || activeSubTool === 'select'));
    if (!canPan) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, select, textarea, [data-role="tool-palette"], [data-role="floating-hud"], [data-role="video-timeline"], [data-no-pan="true"], [class*="toolPalette"], [class*="hud"]'
      )
    ) {
      return;
    }
    if (target?.closest(`.${styles.splitHandle}`)) return;
    if (target?.closest(`.${styles.buttonGroup}`)) return;

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

  // Double click toggles between fit (1.0) and 2.5x zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeSubTool !== 'select') return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, input, select, textarea, [data-role="tool-palette"], [data-role="floating-hud"], [data-role="video-timeline"], [data-no-pan="true"], [class*="toolPalette"], [class*="hud"]'
      )
    ) {
      return;
    }
    if (target?.closest(`.${styles.splitHandle}`)) return;
    if (target?.closest(`.${styles.buttonGroup}`)) return;

    if (zoom <= 1.05 && viewportRef.current) {
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
      centerAndFitMedia();
    }
  };

  // Synchronize HTML5 video element with isPlaying state
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
      <div ref={viewportRef} className={styles.viewport}>
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

  const assetUrl = convertFileSrc(current.path);
  const displaySrc =
    editor.previewUrl ||
    (current.media_type === 'Svg' && imageDetail?.data_url ? imageDetail.data_url : (imageDetail?.data_url || assetUrl));

  const mediaWidth = isVideo
    ? (videoDetail?.width || 1920)
    : (imageDetail?.width || imgRef.current?.naturalWidth || 1920);

  const mediaHeight = isVideo
    ? (videoDetail?.height || 1080)
    : (imageDetail?.height || imgRef.current?.naturalHeight || 1080);

  const getFilterStyle = () => {
    let filterStr = `brightness(${100 + editor.brightness}%) contrast(${100 + editor.contrast}%) blur(${editor.blur}px) saturate(${100 + editor.saturation}%)`;
    if (editor.filter === 'grayscale') {
      filterStr += ' grayscale(100%)';
    } else if (editor.filter === 'invert') {
      filterStr += ' invert(100%)';
    } else if (editor.filter === 'sepia') {
      filterStr += ' sepia(85%)';
    }
    if (editor.warmth > 0) {
      filterStr += ` sepia(${editor.warmth * 0.4}%)`;
    } else if (editor.warmth < 0) {
      filterStr += ` hue-rotate(${editor.warmth * 0.3}deg)`;
    }
    return filterStr;
  };

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Floating Studio Tool Palette: only visible in edit mode */}
      {activeMode === 'edit' && !isVideo && <ToolPalette />}

      {/* Copy to Clipboard Notification Toast */}
      {copyNotice && (
        <div className={styles.copyToast}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied image to clipboard</span>
        </div>
      )}

      {loading && !displaySrc && (
        <div style={{ position: 'absolute', color: '#94a3b8', fontSize: '12px' }}>
          Loading media...
        </div>
      )}
      {error && !displaySrc && (
        <div style={{ position: 'absolute', color: '#ef4444', fontSize: '13px', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '8px' }}>
          Failed to load media: {error}
        </div>
      )}

      <div
        ref={canvasRef}
        className={styles.canvasContainer}
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {isVideo ? (
            <video
              ref={videoRef}
              src={assetUrl}
              className={styles.videoElement}
              onLoadedMetadata={(e) => {
                const d = (e.target as HTMLVideoElement).duration;
                if (d > 0) setDuration(d);
                centerAndFitMedia();
              }}
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
              loop
              playsInline
            />
          ) : activeMode === 'edit' && editor.previewUrl ? (
            /* Split comparison mode */
            <div className={styles.splitContainer}>
              <img
                ref={imgRef}
                src={imageDetail?.data_url || assetUrl}
                alt="Original"
                className={styles.splitOriginal}
                onLoad={() => centerAndFitMedia()}
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
                    filter: getFilterStyle(),
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
              ref={imgRef}
              src={displaySrc}
              alt={current.file_name}
              className={styles.imageElement}
              onLoad={() => centerAndFitMedia()}
              style={{
                transform: `rotate(${editor.rotation}deg) scaleX(${editor.flipH ? -1 : 1}) scaleY(${editor.flipV ? -1 : 1})`,
                filter: getFilterStyle(),
              }}
            />
          )}

          {/* High-DPI Vector Annotation Layer */}
          <AnnotationLayer
            mediaWidth={mediaWidth}
            mediaHeight={mediaHeight}
            imageElement={imgRef.current}
          />

          {/* Interactive 8-Anchor Crop Overlay */}
          {activeSubTool === 'crop' && (
            <CropOverlay
              mediaWidth={mediaWidth}
              mediaHeight={mediaHeight}
              onApply={() => {
                if (cropBox) {
                  if (isVideo) {
                    updateVideoParams({ crop: cropBox });
                  } else {
                    updateEditor({ crop: cropBox });
                  }
                }
              }}
              onCancel={() => {
                setCropBox(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
