import React, { useState, useEffect, useRef } from 'react';
import { useViewerStore, CropAspectRatio } from '../stores/useViewerStore';
import styles from './CropOverlay.module.css';

interface CropOverlayProps {
  mediaWidth: number;
  mediaHeight: number;
  onApply?: () => void;
  onCancel?: () => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  mediaWidth,
  mediaHeight,
}) => {
  const {
    cropBox,
    setCropBox,
    cropAspectRatio,
    zoom,
  } = useViewerStore();

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const startDragRef = useRef<{ clientX: number; clientY: number; box: { x: number; y: number; width: number; height: number } }>({
    clientX: 0,
    clientY: 0,
    box: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Initialize cropBox to 100% full image if null
  useEffect(() => {
    if (!cropBox && mediaWidth > 0 && mediaHeight > 0) {
      setCropBox({ x: 0, y: 0, width: mediaWidth, height: mediaHeight });
    }
  }, [mediaWidth, mediaHeight, cropBox, setCropBox]);

  if (!cropBox || mediaWidth <= 0 || mediaHeight <= 0) {
    return null;
  }

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

  const handlePointerDown = (handle: string, e: React.PointerEvent) => {
    if (e.button !== 0) return; // Allow middle-click and right-click to pan
    e.stopPropagation();
    setActiveHandle(handle);
    startDragRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      box: { ...cropBox },
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle) return;
    e.stopPropagation();

    // Divide screen cursor delta by current zoom so crop box tracks 1:1 in media coordinates
    const effectiveZoom = zoom > 0 ? zoom : 1.0;
    const dx = (e.clientX - startDragRef.current.clientX) / effectiveZoom;
    const dy = (e.clientY - startDragRef.current.clientY) / effectiveZoom;
    const orig = startDragRef.current.box;
    const ratio = getTargetRatio(cropAspectRatio);

    let newX = orig.x;
    let newY = orig.y;
    let newW = orig.width;
    let newH = orig.height;

    if (activeHandle === 'move') {
      newX = Math.max(0, Math.min(orig.x + dx, mediaWidth - orig.width));
      newY = Math.max(0, Math.min(orig.y + dy, mediaHeight - orig.height));
    } else {
      const origLeft = orig.x;
      const origTop = orig.y;
      const origRight = orig.x + orig.width;
      const origBottom = orig.y + orig.height;

      let newLeft = origLeft;
      let newRight = origRight;
      let newTop = origTop;
      let newBottom = origBottom;

      if (activeHandle.includes('l')) {
        newLeft = Math.max(0, Math.min(origLeft + dx, origRight - 20));
      }
      if (activeHandle.includes('r')) {
        newRight = Math.min(mediaWidth, Math.max(origRight + dx, newLeft + 20));
      }
      if (activeHandle.includes('t')) {
        newTop = Math.max(0, Math.min(origTop + dy, origBottom - 20));
      }
      if (activeHandle.includes('b')) {
        newBottom = Math.min(mediaHeight, Math.max(origBottom + dy, newTop + 20));
      }

      newW = newRight - newLeft;
      newH = newBottom - newTop;

      // Constrain aspect ratio if locked
      if (ratio !== null) {
        if (activeHandle === 'tl') {
          newH = Math.round(newW / ratio);
          newTop = origBottom - newH;
          if (newTop < 0) {
            newTop = 0;
            newH = origBottom;
            newW = Math.round(newH * ratio);
            newLeft = origRight - newW;
          }
        } else if (activeHandle === 'tr') {
          newH = Math.round(newW / ratio);
          newTop = origBottom - newH;
          if (newTop < 0) {
            newTop = 0;
            newH = origBottom;
            newW = Math.round(newH * ratio);
            newRight = origLeft + newW;
          }
        } else if (activeHandle === 'bl') {
          newH = Math.round(newW / ratio);
          if (newTop + newH > mediaHeight) {
            newH = mediaHeight - newTop;
            newW = Math.round(newH * ratio);
          }
          newLeft = origRight - newW;
        } else if (activeHandle === 'br') {
          newH = Math.round(newW / ratio);
          if (newTop + newH > mediaHeight) {
            newH = mediaHeight - newTop;
            newW = Math.round(newH * ratio);
          }
        } else if (activeHandle === 't' || activeHandle === 'b') {
          newW = Math.round(newH * ratio);
          newLeft = Math.max(0, Math.min(origLeft + Math.round((orig.width - newW) / 2), mediaWidth - newW));
        } else if (activeHandle === 'l' || activeHandle === 'r') {
          newH = Math.round(newW / ratio);
          newTop = Math.max(0, Math.min(origTop + Math.round((orig.height - newH) / 2), mediaHeight - newH));
        }
      }

      newX = newLeft;
      newY = newTop;
    }

    // Keep clamped inside media boundaries
    newX = Math.max(0, Math.min(newX, mediaWidth - 20));
    newY = Math.max(0, Math.min(newY, mediaHeight - 20));
    newW = Math.max(20, Math.min(newW, mediaWidth - newX));
    newH = Math.max(20, Math.min(newH, mediaHeight - newY));

    setCropBox({
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      e.stopPropagation();
      setActiveHandle(null);
    }
  };

  // Coordinates converted to percentages for responsive overlay
  const leftPct = (cropBox.x / mediaWidth) * 100;
  const topPct = (cropBox.y / mediaHeight) * 100;
  const widthPct = (cropBox.width / mediaWidth) * 100;
  const heightPct = (cropBox.height / mediaHeight) * 100;

  return (
    <div
      className={styles.cropContainer}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 4 Mask overlays covering outer regions */}
      <div className={styles.maskArea} style={{ top: 0, left: 0, right: 0, height: `${topPct}%` }} />
      <div
        className={styles.maskArea}
        style={{
          top: `${topPct + heightPct}%`,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <div
        className={styles.maskArea}
        style={{
          top: `${topPct}%`,
          left: 0,
          width: `${leftPct}%`,
          height: `${heightPct}%`,
        }}
      />
      <div
        className={styles.maskArea}
        style={{
          top: `${topPct}%`,
          left: `${leftPct + widthPct}%`,
          right: 0,
          height: `${heightPct}%`,
        }}
      />

      {/* Interactive Crop Box */}
      <div
        className={styles.cropBox}
        style={{
          top: `${topPct}%`,
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
        }}
        onPointerDown={(e) => handlePointerDown('move', e)}
      >
        {/* Rule of Thirds Grid Lines */}
        <div className={styles.gridLineH} style={{ top: '33.33%' }} />
        <div className={styles.gridLineH} style={{ top: '66.66%' }} />
        <div className={styles.gridLineV} style={{ left: '33.33%' }} />
        <div className={styles.gridLineV} style={{ left: '66.66%' }} />

        {/* 8 Drag Handles */}
        <div
          className={`${styles.handle} ${styles.handleTL}`}
          onPointerDown={(e) => handlePointerDown('tl', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleTR}`}
          onPointerDown={(e) => handlePointerDown('tr', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleBL}`}
          onPointerDown={(e) => handlePointerDown('bl', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleBR}`}
          onPointerDown={(e) => handlePointerDown('br', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleT}`}
          onPointerDown={(e) => handlePointerDown('t', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleB}`}
          onPointerDown={(e) => handlePointerDown('b', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleL}`}
          onPointerDown={(e) => handlePointerDown('l', e)}
        />
        <div
          className={`${styles.handle} ${styles.handleR}`}
          onPointerDown={(e) => handlePointerDown('r', e)}
        />

      </div>
    </div>
  );
};
