import React, { useRef } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { trimVideo, exportGif } from '../lib/ipc';
import styles from './VideoTimeline.module.css';

export const VideoTimeline: React.FC = () => {
  const {
    items,
    currentIndex,
    currentTime,
    duration,
    trimRange,
    setTrimRange,
    activeMode,
  } = useViewerStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const current = items[currentIndex];

  if (!current || current.media_type !== 'Video') return null;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(2);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(5, '0')}`;
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;

    // In trim mode, clicking updates In/Out range depending on distance
    if (activeMode === 'trim') {
      const [start, end] = trimRange;
      const distToStart = Math.abs(targetTime - start);
      const distToEnd = Math.abs(targetTime - end);

      if (distToStart < distToEnd) {
        setTrimRange([Math.min(targetTime, end - 0.5), end]);
      } else {
        setTrimRange([start, Math.max(targetTime, start + 0.5)]);
      }
    }
  };

  const handleLosslessTrim = async () => {
    const [start, end] = trimRange;
    const dest = current.path.replace(/(\.[^.]+)$/, `_trimmed${formatTime(start).replace(':', '_')}$1`);
    try {
      await trimVideo(current.path, dest, start, end);
      alert(`Lossless video trimmed successfully:\n${dest}`);
    } catch (e) {
      alert(`Trim error: ${e}`);
    }
  };

  const handleGifExport = async () => {
    const [start, end] = trimRange;
    const dest = current.path.replace(/\.[^.]+$/, '_clip.gif');
    try {
      await exportGif(current.path, dest, start, Math.max(0.5, end - start));
      alert(`GIF exported successfully:\n${dest}`);
    } catch (e) {
      alert(`GIF export error: ${e}`);
    }
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartPercent = duration > 0 ? (trimRange[0] / duration) * 100 : 0;
  const trimWidthPercent = duration > 0 ? ((trimRange[1] - trimRange[0]) / duration) * 100 : 100;

  return (
    <div className={styles.timelineWrapper}>
      <div className={styles.topRow}>
        <div className={`${styles.timeDisplay} tabular-nums`}>
          {formatTime(currentTime)} / {formatTime(duration)}
          {activeMode === 'trim' && (
            <span>
              {' '}• Selected: {formatTime(trimRange[0])} → {formatTime(trimRange[1])} (
              {(trimRange[1] - trimRange[0]).toFixed(2)}s)
            </span>
          )}
        </div>

        {activeMode === 'trim' && (
          <div className={styles.actionRow}>
            <button className={styles.gifBtn} onClick={handleGifExport}>
              Export GIF
            </button>
            <button className={styles.trimBtn} onClick={handleLosslessTrim}>
              Lossless Cut
            </button>
          </div>
        )}
      </div>

      <div ref={trackRef} className={styles.trackContainer} onClick={handleTrackClick}>
        <div
          className={styles.playheadProgress}
          style={{ width: `${playheadPercent}%` }}
        />
        {activeMode === 'trim' && (
          <div
            className={styles.trimZone}
            style={{
              left: `${trimStartPercent}%`,
              width: `${trimWidthPercent}%`,
            }}
          />
        )}
        <div
          className={styles.scrubHandle}
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
    </div>
  );
};
