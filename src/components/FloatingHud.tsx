import React, { useState, useEffect } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './FloatingHud.module.css';

export const FloatingHud: React.FC = () => {
  const {
    items,
    currentIndex,
    nextItem,
    prevItem,
    zoom,
    setZoom,
    centerView,
    showFilmstrip,
    toggleFilmstrip,
    activeMode,
    setActiveMode,
    copyCurrentToClipboard,
  } = useViewerStore();

  const [visible, setVisible] = useState(true);

  // Auto-hide timer on mouse idle
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleActivity = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeMode === 'view') {
          setVisible(false);
        }
      }, 2500);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timer);
    };
  }, [activeMode]);

  const current = items[currentIndex];
  // Videos have their own unified control deck (VideoTimeline) to prevent overlapping
  if (!current || current.media_type === 'Video') return null;

  return (
    <div className={`${styles.hudWrapper} ${visible ? '' : styles.hidden}`}>
      <div className={styles.hudContainer} data-role="floating-hud">
        {/* Navigation */}
        <button
          className={styles.hudBtn}
          onClick={prevItem}
          title="Previous Item (Left Arrow / [)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <button
          className={styles.hudBtn}
          onClick={nextItem}
          title="Next Item (Right Arrow / ])"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div className={styles.divider} />

        {/* Zoom Controls */}
        <button
          className={styles.hudBtn}
          onClick={() => setZoom(zoom * 0.8)}
          title="Zoom Out (-)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <div
          className={`${styles.zoomIndicator} tabular-nums`}
          onClick={centerView}
          title="Click to Center and Fit (0 / F)"
        >
          {(zoom * 100).toFixed(0)}%
        </div>

        <button
          className={styles.hudBtn}
          onClick={() => setZoom(zoom * 1.25)}
          title="Zoom In (+)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Center and Fit Button */}
        <button
          className={styles.hudBtn}
          onClick={centerView}
          title="Center in Safe Viewport (0 / F)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </button>

        {/* Copy Image to Clipboard Button */}
        <button
          className={styles.hudBtn}
          onClick={copyCurrentToClipboard}
          title="Copy to Clipboard (Ctrl+C)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        <div className={styles.divider} />

        {/* Edit Mode Toggle */}
        <button
          className={`${styles.hudBtn} ${activeMode === 'edit' ? styles.active : ''}`}
          onClick={() => setActiveMode(activeMode === 'edit' ? 'view' : 'edit')}
          title="Toggle Adjustments Drawer (E)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>

        {/* Filmstrip Toggle */}
        <button
          className={`${styles.hudBtn} ${showFilmstrip ? styles.active : ''}`}
          onClick={toggleFilmstrip}
          title="Toggle Bottom Filmstrip (B)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="10" rx="2" />
            <line x1="8" y1="7" x2="8" y2="17" />
            <line x1="16" y1="7" x2="16" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
};
