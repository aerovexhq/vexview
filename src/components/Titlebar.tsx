import React, { useState, useEffect } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import {
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  isWindowMaximized,
  startWindowDragging,
} from '../lib/ipc';
import styles from './Titlebar.module.css';

interface TitlebarProps {
  onOpenSettings?: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({ onOpenSettings }) => {
  const {
    items,
    currentIndex,
    imageDetail,
    videoDetail,
    activeMode,
    setActiveMode,
    toggleInspector,
    showInspector,
    openMediaFile,
  } = useViewerStore();

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    isWindowMaximized().then(setIsMaximized).catch(() => {});

    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized).catch(() => {});
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const next = await toggleMaximizeWindow();
    setIsMaximized(next);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    minimizeWindow();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeWindow();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, select, textarea, [data-no-drag="true"]')) {
      return;
    }
    startWindowDragging().catch(() => {});
  };

  const current = items[currentIndex];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <header
      className={styles.titlebar}
      data-tauri-drag-region="deep"
      onPointerDown={handlePointerDown}
    >
      <div className={styles.leftSection} data-tauri-drag-region="deep">
        <div className={styles.appBrand} data-tauri-drag-region="deep">
          <svg
            width="15"
            height="15"
            viewBox="0 0 512 512"
            fill="none"
            className={styles.brandIcon}
          >
            <defs>
              <linearGradient
                id="tbHexGrad"
                x1="144"
                y1="62"
                x2="368"
                y2="450"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <polygon
              points="480,256 368,450 144,450 32,256 144,62 368,62"
              fill="url(#tbHexGrad)"
              stroke="#fbbf24"
              strokeWidth="24"
              strokeLinejoin="round"
            />
          </svg>
          <span>vexview</span>
        </div>
        <button
          className={styles.actionBtn}
          onClick={openMediaFile}
          data-no-drag="true"
          data-tauri-drag-region="false"
          title="Open Media File (Ctrl+O)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Open...
        </button>
        {current && (
          <span className={styles.fileName} data-tauri-drag-region="deep">
            {current.file_name}
          </span>
        )}
      </div>

      <div className={styles.centerSection} data-tauri-drag-region="deep">
        {imageDetail && (
          <div className={`${styles.metaBadge} tabular-nums`} data-tauri-drag-region="deep">
            {imageDetail.width} × {imageDetail.height}
          </div>
        )}
        {videoDetail && (
          <div className={`${styles.metaBadge} tabular-nums`} data-tauri-drag-region="deep">
            {videoDetail.width} × {videoDetail.height}
            {videoDetail.frame_rate ? ` • ${videoDetail.frame_rate.toFixed(0)} FPS` : ''}
            {videoDetail.video_codec ? ` • ${videoDetail.video_codec.toUpperCase()}` : ''}
          </div>
        )}
        {current && (
          <div className={`${styles.metaBadge} tabular-nums`} data-tauri-drag-region="deep">
            {formatFileSize(current.file_size)}
          </div>
        )}
      </div>

      <div className={styles.rightSection} data-tauri-drag-region="deep">
        {current?.media_type !== 'Video' && (
          <button
            className={`${styles.actionBtn} ${activeMode === 'edit' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'edit' ? 'view' : 'edit')}
            data-no-drag="true"
            data-tauri-drag-region="false"
            title="Studio Image Adjustments (E)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edit
          </button>
        )}

        {current?.media_type === 'Video' && (
          <button
            className={`${styles.actionBtn} ${activeMode === 'trim' ? styles.active : ''}`}
            onClick={() => setActiveMode(activeMode === 'trim' ? 'view' : 'trim')}
            data-no-drag="true"
            data-tauri-drag-region="false"
            title="Lossless Trimmer (T)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
            Trim
          </button>
        )}

        <button
          className={`${styles.actionBtn} ${showInspector ? styles.active : ''}`}
          onClick={toggleInspector}
          data-no-drag="true"
          data-tauri-drag-region="false"
          title="EXIF & Media Inspector (I)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Info
        </button>

        <button
          className={styles.actionBtn}
          onClick={onOpenSettings}
          data-no-drag="true"
          data-tauri-drag-region="false"
          title="Settings & Preferences (Ctrl+,)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>

        <div className={styles.divider} data-tauri-drag-region="false" />

        {/* Custom Window Frame Controls */}
        <div className={styles.windowControls} data-no-drag="true" data-tauri-drag-region="false">
          <button
            className={styles.windowControlBtn}
            onClick={handleMinimize}
            data-no-drag="true"
            data-tauri-drag-region="false"
            title="Minimize"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
          </button>
          <button
            className={styles.windowControlBtn}
            onClick={handleToggleMaximize}
            data-no-drag="true"
            data-tauri-drag-region="false"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="7" y="3" width="14" height="14" rx="2" />
                <path d="M3 7v14h14" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            )}
          </button>
          <button
            className={`${styles.windowControlBtn} ${styles.closeBtn}`}
            onClick={handleClose}
            data-no-drag="true"
            data-tauri-drag-region="false"
            title="Close"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="5" y1="19" x2="19" y2="5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
