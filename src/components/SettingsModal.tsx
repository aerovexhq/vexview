import React, { useState, useEffect } from 'react';
import {
  ViewerConfig,
  getViewerConfig,
  saveViewerConfig,
  exitApplication,
  setDefaultMediaViewer,
} from '../lib/ipc';
import { Select, SelectOption } from './ui/Select';
import { ToggleSwitch } from './common/ToggleSwitch';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ZOOM_OPTIONS: SelectOption<'FitToWindow' | 'OriginalSize' | 'Stretch'>[] = [
  { value: 'FitToWindow', label: 'Fit to Window' },
  { value: 'OriginalSize', label: '100% Original (1:1)' },
  { value: 'Stretch', label: 'Fill Window' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<ViewerConfig>({
    auto_play_videos: true,
    loop_videos: true,
    default_volume: 1.0,
    wrap_navigation: true,
    default_zoom_mode: 'FitToWindow',
    cache_capacity: 10,
    background_dark: true,
    show_filmstrip: true,
    autostart_at_boot: true,
    keep_running_in_background: true,
  });

  const [associated, setAssociated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getViewerConfig().then(setConfig);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof ViewerConfig) => {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    saveViewerConfig(updated);
  };

  const handleChangeZoom = (mode: 'FitToWindow' | 'OriginalSize' | 'Stretch') => {
    const updated = { ...config, default_zoom_mode: mode };
    setConfig(updated);
    saveViewerConfig(updated);
  };

  const handleQuit = async () => {
    await exitApplication();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Preferences
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* System & File Associations */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>System & File Associations</div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Default System Media Viewer</span>
                <span className={styles.settingDesc}>
                  Register vexview as default application for all images and videos
                </span>
              </div>
              <button
                style={{
                  background: associated ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  color: associated ? '#042f2e' : '#f1f5f9',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                onClick={async () => {
                  await setDefaultMediaViewer();
                  setAssociated(true);
                  setTimeout(() => setAssociated(false), 3000);
                }}
              >
                {associated ? '✓ Associated as Default' : 'Set as Default Viewer'}
              </button>
            </div>
          </div>

          {/* Media Behavior */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Media Playback</div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Auto-play Videos</span>
                <span className={styles.settingDesc}>
                  Begin video playback immediately upon opening
                </span>
              </div>
              <ToggleSwitch
                checked={config.auto_play_videos}
                onChange={() => handleToggle('auto_play_videos')}
                ariaLabel="Auto-play Videos"
              />
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Loop Playback</span>
                <span className={styles.settingDesc}>
                  Continuously loop videos when they reach the end
                </span>
              </div>
              <ToggleSwitch
                checked={config.loop_videos}
                onChange={() => handleToggle('loop_videos')}
                ariaLabel="Loop Playback"
              />
            </div>
          </div>

          {/* Viewport Preferences */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Display & Navigation</div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Default Zoom</span>
                <span className={styles.settingDesc}>
                  Initial sizing mode when media opens
                </span>
              </div>
              <Select<'FitToWindow' | 'OriginalSize' | 'Stretch'>
                value={config.default_zoom_mode}
                options={ZOOM_OPTIONS}
                onChange={handleChangeZoom}
                ariaLabel="Default Zoom Mode"
                style={{ width: '180px' }}
              />
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Show Filmstrip</span>
                <span className={styles.settingDesc}>
                  Display the bottom thumbnail carousel
                </span>
              </div>
              <ToggleSwitch
                checked={config.show_filmstrip}
                onChange={() => handleToggle('show_filmstrip')}
                ariaLabel="Show Filmstrip"
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.quitBtn} onClick={handleQuit} title="Exit process entirely">
            Quit vexview
          </button>
          <button className={styles.saveBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
