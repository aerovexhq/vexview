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
    resetView,
    isPlaying,
    setIsPlaying,
    showFilmstrip,
    toggleFilmstrip,
    activeMode,
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
  if (!current) return null;

  const isVideo = current.media_type === 'Video';

  return (
    <div className={`${styles.hudWrapper} ${visible ? '' : styles.hidden}`}>
      <div className={styles.hudContainer}>
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

        {isVideo && (
          <button
            className={`${styles.hudBtn} ${isPlaying ? styles.active : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
        )}

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
          onClick={resetView}
          title="Click to Reset 100% (0)"
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

        <div className={styles.divider} />

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
