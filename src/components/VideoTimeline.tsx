import React, { useRef, useState, useEffect } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { trimVideo, trimAudioClip, exportGif } from '../lib/ipc';
import { Select, SelectOption } from './ui/Select';
import styles from './VideoTimeline.module.css';

const VIDEO_TRIM_QUALITY_OPTIONS: SelectOption<'original' | 'high' | 'medium' | 'small'>[] = [
  { value: 'original', label: 'Original (Stream Copy)' },
  { value: 'high', label: 'High Quality (CRF 18)' },
  { value: 'medium', label: 'Balanced (CRF 24)' },
  { value: 'small', label: 'Small Size (CRF 30)' },
];

export const VideoTimeline: React.FC = () => {
  const {
    items,
    currentIndex,
    prevItem,
    nextItem,
    currentTime,
    duration,
    seekTo,
    isPlaying,
    setIsPlaying,
    zoom,
    setZoom,
    resetView,
    centerView,
    activeMode,
    setActiveMode,
    trimRange,
    setTrimRange,
    showFilmstrip,
    toggleFilmstrip,
    showInspector,
    toggleInspector,
    addCurrentToSequence,
  } = useViewerStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingScrubRef = useRef(false);

  const [visible, setVisible] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosPercent, setHoverPosPercent] = useState<number>(0);
  const [trimQuality, setTrimQuality] = useState<'original' | 'high' | 'medium' | 'small'>('original');
  const [trimOverwrite, setTrimOverwrite] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);

  const current = items[currentIndex];

  // Auto-hide when actively playing and in view mode
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleActivity = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeMode === 'view' && isPlaying) {
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
  }, [activeMode, isPlaying]);

  if (!current || (current.media_type !== 'Video' && current.media_type !== 'Audio')) return null;
  const isAudio = current.media_type === 'Audio';

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) secs = 0;
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(2);
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(5, '0')}`;
  };

  const getTimeFromPointerEvent = (e: React.PointerEvent | PointerEvent) => {
    if (!trackRef.current || duration <= 0) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDownTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || duration <= 0) return;
    isDraggingScrubRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}

    const targetTime = getTimeFromPointerEvent(e);

    if (activeMode === 'trim') {
      const [start, end] = trimRange;
      const distToStart = Math.abs(targetTime - start);
      const distToEnd = Math.abs(targetTime - end);
      if (distToStart < distToEnd) {
        setTrimRange([Math.min(targetTime, end - 0.5), end]);
      } else {
        setTrimRange([start, Math.max(targetTime, start + 0.5)]);
      }
    } else {
      seekTo(targetTime);
    }
  };

  const handlePointerMoveTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosPercent(ratio * 100);
    setHoverTime(ratio * duration);

    if (isDraggingScrubRef.current) {
      const targetTime = ratio * duration;
      if (activeMode !== 'trim') {
        seekTo(targetTime);
      }
    }
  };

  const handlePointerUpTrack = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingScrubRef.current) {
      isDraggingScrubRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handlePointerLeaveTrack = () => {
    if (!isDraggingScrubRef.current) {
      setHoverTime(null);
    }
  };

  const handleTrimMedia = async () => {
    const [start, end] = trimRange;
    setIsTrimming(true);
    try {
      const saved = isAudio
        ? await trimAudioClip(
            current.path,
            null,
            start,
            end,
            trimQuality,
            trimOverwrite,
          )
        : await trimVideo(
            current.path,
            null,
            start,
            end,
            trimQuality,
            trimOverwrite,
          );
      const label = isAudio ? 'audio' : 'video';
      if (trimOverwrite) {
        alert(`Successfully overwritten original ${label}:\n${saved}`);
      } else {
        alert(`Trimmed ${label} saved next to original:\n${saved}`);
      }
    } catch (e) {
      alert(`Trim error: ${e}`);
    } finally {
      setIsTrimming(false);
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
    <div
      className={`${styles.timelineWrapper} ${visible ? '' : styles.hidden}`}
      data-role="video-timeline"
      onMouseEnter={() => setVisible(true)}
    >
      {/* 1. Precision Timeline Scrubber */}
      <div
        ref={trackRef}
        className={styles.trackContainer}
        onPointerDown={handlePointerDownTrack}
        onPointerMove={handlePointerMoveTrack}
        onPointerUp={handlePointerUpTrack}
        onPointerCancel={handlePointerUpTrack}
        onPointerLeave={handlePointerLeaveTrack}
      >
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

        {hoverTime !== null && (
          <div
            className={`${styles.hoverTooltip} tabular-nums`}
            style={{ left: `${hoverPosPercent}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>

      {/* 2. Unified Controls Bar */}
      <div className={styles.controlsRow}>
        {/* Playback & Navigation (Left) */}
        <div className={styles.leftGroup}>
          <button
            className={styles.controlBtn}
            onClick={prevItem}
            title="Previous Item (Left Arrow / [)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button
            className={styles.controlBtn}
            onClick={nextItem}
            title="Next Item (Right Arrow / ])"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div className={`${styles.timeDisplay} tabular-nums`}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Trim Mode Actions (Center) */}
        {activeMode === 'trim' && (
          <div className={styles.centerGroup}>
            <div className={`${styles.trimSpanText} tabular-nums`}>
              In: {formatTime(trimRange[0])} → Out: {formatTime(trimRange[1])} (
              {(trimRange[1] - trimRange[0]).toFixed(2)}s)
            </div>

            <div className={styles.trimOptionsRow}>
              <Select<'original' | 'high' | 'medium' | 'small'>
                size="sm"
                placement="up"
                value={trimQuality}
                onChange={(val) => setTrimQuality(val)}
                options={VIDEO_TRIM_QUALITY_OPTIONS}
                title="Select compression or original quality"
                className={styles.qualitySelectWrapper}
                menuWidth={180}
              />

              <label
                className={`${styles.overwriteLabel} ${trimOverwrite ? styles.warning : ''}`}
                title={trimOverwrite ? 'Will replace original video file on disk' : 'Saves next to original'}
              >
                <input
                  type="checkbox"
                  checked={trimOverwrite}
                  onChange={(e) => setTrimOverwrite(e.target.checked)}
                  className={styles.overwriteCheckbox}
                />
                Overwrite
              </label>
            </div>

            <button
              className={styles.gifBtn}
              onClick={addCurrentToSequence}
              title="Add this trimmed segment to Storyboard Sequencer"
            >
              + Clip
            </button>
            {!isAudio && (
              <button className={styles.gifBtn} onClick={handleGifExport} title="Export selected clip as GIF">
                GIF
              </button>
            )}
            <button
              className={`${styles.trimBtn} ${trimOverwrite ? styles.overwrite : ''}`}
              onClick={handleTrimMedia}
              disabled={isTrimming}
              title={trimOverwrite ? `Overwrites original ${isAudio ? 'audio' : 'video'}` : `Cuts and saves a copy next to original ${isAudio ? 'audio' : 'video'}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              {isTrimming ? 'Processing...' : trimOverwrite ? 'Overwrite' : 'Cut'}
            </button>
          </div>
        )}

        {/* View & Tool Toggles (Right) */}
        <div className={styles.rightGroup}>
          <button
            className={styles.controlBtn}
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
            className={styles.controlBtn}
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
            className={styles.controlBtn}
            onClick={centerView}
            title="Center in Safe Viewport (0 / F)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </button>

          <div className={styles.divider} />

          {/* Trim Mode Toggle */}
          <button
            className={`${styles.controlBtn} ${activeMode === 'trim' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'trim' ? 'view' : 'trim')}
            title="Toggle Trimming Mode (T)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>

          {/* Sequencer & Editor Drawer Toggle */}
          <button
            className={`${styles.controlBtn} ${activeMode === 'edit' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'edit' ? 'view' : 'edit')}
            title="Open Sequencer Storyboard & Music Editor (E)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          {/* Filmstrip Toggle */}
          <button
            className={`${styles.controlBtn} ${showFilmstrip ? styles.active : ''}`}
            onClick={toggleFilmstrip}
            title="Toggle Bottom Filmstrip (B)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="10" rx="2" />
              <line x1="8" y1="7" x2="8" y2="17" />
              <line x1="16" y1="7" x2="16" y2="17" />
            </svg>
          </button>

          {/* Inspector Toggle */}
          <button
            className={`${styles.controlBtn} ${showInspector ? styles.active : ''}`}
            onClick={toggleInspector}
            title="Toggle Media Inspector (I)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
