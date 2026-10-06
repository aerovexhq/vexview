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
  onApply,
  onCancel,
}) => {
  const {
    cropBox,
    setCropBox,
    cropAspectRatio,
    setCropAspectRatio,
    setActiveSubTool,
  } = useViewerStore();

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const startDragRef = useRef<{ clientX: number; clientY: number; box: { x: number; y: number; width: number; height: number } }>({
    clientX: 0,
    clientY: 0,
    box: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Initialize cropBox to 90% centered if null
  useEffect(() => {
    if (!cropBox && mediaWidth > 0 && mediaHeight > 0) {
      const w = Math.round(mediaWidth * 0.85);
      const h = Math.round(mediaHeight * 0.85);
      const x = Math.round((mediaWidth - w) / 2);
      const y = Math.round((mediaHeight - h) / 2);
      setCropBox({ x, y, width: w, height: h });
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
    e.stopPropagation();
    setActiveHandle(handle);
    startDragRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      box: { ...cropBox },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle) return;
    e.stopPropagation();

    const dx = e.clientX - startDragRef.current.clientX;
    const dy = e.clientY - startDragRef.current.clientY;
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
      // Handle resize
      if (activeHandle.includes('r')) {
        newW = Math.max(20, Math.min(orig.width + dx, mediaWidth - orig.x));
      }
      if (activeHandle.includes('l')) {
        const potentialW = Math.max(20, orig.width - dx);
        const shiftX = orig.width - potentialW;
        if (orig.x + shiftX >= 0) {
          newX = orig.x + shiftX;
          newW = potentialW;
        }
      }
      if (activeHandle.includes('b')) {
        newH = Math.max(20, Math.min(orig.height + dy, mediaHeight - orig.y));
      }
      if (activeHandle.includes('t')) {
        const potentialH = Math.max(20, orig.height - dy);
        const shiftY = orig.height - potentialH;
        if (orig.y + shiftY >= 0) {
          newY = orig.y + shiftY;
          newH = potentialH;
        }
      }

      // Constrain aspect ratio if locked
      if (ratio !== null) {
        if (activeHandle === 'e' || activeHandle === 'w' || activeHandle === 'r' || activeHandle === 'l') {
          newH = Math.round(newW / ratio);
        } else {
          newW = Math.round(newH * ratio);
        }
      }
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

        {/* Live Pixel Dimensions */}
        <div className={styles.dimensionChip}>
          {Math.round(cropBox.width)} x {Math.round(cropBox.height)} px
        </div>

        {/* Controls Pill */}
        <div className={styles.cropControls} onPointerDown={(e) => e.stopPropagation()}>
          <button
            className={`${styles.aspectButton} ${cropAspectRatio === 'free' ? styles.active : ''}`}
            onClick={() => handleSetRatio('free')}
          >
            Free
          </button>
          <button
            className={`${styles.aspectButton} ${cropAspectRatio === '1:1' ? styles.active : ''}`}
            onClick={() => handleSetRatio('1:1')}
          >
            1:1
          </button>
          <button
            className={`${styles.aspectButton} ${cropAspectRatio === '16:9' ? styles.active : ''}`}
            onClick={() => handleSetRatio('16:9')}
          >
            16:9
          </button>
          <button
            className={`${styles.aspectButton} ${cropAspectRatio === '9:16' ? styles.active : ''}`}
            onClick={() => handleSetRatio('9:16')}
          >
            9:16
          </button>
          <button
            className={`${styles.aspectButton} ${cropAspectRatio === '4:3' ? styles.active : ''}`}
            onClick={() => handleSetRatio('4:3')}
          >
            4:3
          </button>

          <button
            className={styles.applyButton}
            onClick={() => {
              if (onApply) onApply();
              setActiveSubTool('select');
            }}
          >
            Apply
          </button>
          <button
            className={styles.actionButton}
            onClick={() => {
              if (onCancel) onCancel();
              setCropBox(null);
              setActiveSubTool('select');
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
