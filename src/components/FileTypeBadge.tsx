import React, { useState, useMemo } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { convertMediaFile, saveFileDialog } from '../lib/ipc';
import styles from './FileTypeBadge.module.css';

interface FormatConfig {
  name: string;
  accent: string;
  glow: string;
  icon: React.ReactNode;
}

export const FileTypeBadge: React.FC = () => {
  const { items, currentIndex, activeMode } = useViewerStore();
  const current = items[currentIndex];

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [targetFormat, setTargetFormat] = useState<'png' | 'jpg' | 'webp' | 'bmp' | 'ico' | 'tiff'>('png');
  const [targetSize, setTargetSize] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fileExt = useMemo(() => {
    if (!current?.path) return '';
    const parts = current.path.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  }, [current?.path]);

  const config: FormatConfig = useMemo(() => {
    switch (fileExt) {
      case 'png':
        return {
          name: 'PNG',
          accent: '#10b981',
          glow: 'rgba(16, 185, 129, 0.15)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeOpacity="0.4" />
              <circle cx="9" cy="9" r="2" fill="#10b981" />
            </svg>
          ),
        };
      case 'jpg':
      case 'jpeg':
        return {
          name: 'JPEG',
          accent: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.15)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="#f59e0b" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          ),
        };
      case 'webp':
        return {
          name: 'WEBP',
          accent: '#6366f1',
          glow: 'rgba(99, 102, 241, 0.15)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          ),
        };
      case 'svg':
      case 'svgz':
        return {
          name: 'SVG',
          accent: '#a855f7',
          glow: 'rgba(168, 85, 247, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" fill="#a855f7" />
            </svg>
          ),
        };
      case 'gif':
        return {
          name: 'GIF',
          accent: '#ec4899',
          glow: 'rgba(236, 72, 153, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2.2">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <circle cx="8" cy="12" r="2" fill="#ec4899" />
              <path d="M14 9v6M17 12h3" />
            </svg>
          ),
        };
      case 'avif':
        return {
          name: 'AVIF',
          accent: '#14b8a6',
          glow: 'rgba(20, 184, 166, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          ),
        };
      case 'bmp':
        return {
          name: 'BMP',
          accent: '#64748b',
          glow: 'rgba(100, 116, 139, 0.15)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2">
              <rect x="3" y="3" width="18" height="18" rx="1" />
              <path d="M7 8h4a2 2 0 0 1 0 4H7V8zM7 12h4a2 2 0 0 1 0 4H7v-4z" />
            </svg>
          ),
        };
      case 'tiff':
      case 'tif':
        return {
          name: 'TIFF',
          accent: '#8b5cf6',
          glow: 'rgba(139, 92, 246, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="12" y2="14" />
            </svg>
          ),
        };
      case 'ico':
        return {
          name: 'ICO',
          accent: '#eab308',
          glow: 'rgba(234, 179, 8, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.2">
              <rect x="3" y="3" width="8" height="8" rx="1" fill="#eab308" fillOpacity="0.4" />
              <rect x="13" y="3" width="8" height="8" rx="1" />
              <rect x="3" y="13" width="8" height="8" rx="1" />
              <rect x="13" y="13" width="8" height="8" rx="1" />
            </svg>
          ),
        };
      case 'mp4':
        return {
          name: 'MP4',
          accent: '#f43f5e',
          glow: 'rgba(244, 63, 94, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2">
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
            </svg>
          ),
        };
      case 'mkv':
        return {
          name: 'MKV',
          accent: '#f97316',
          glow: 'rgba(249, 115, 22, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          ),
        };
      case 'webm':
        return {
          name: 'WEBM',
          accent: '#0ea5e9',
          glow: 'rgba(14, 165, 233, 0.18)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="#0ea5e9" />
            </svg>
          ),
        };
      default:
        return {
          name: fileExt ? fileExt.toUpperCase() : 'FILE',
          accent: '#94a3b8',
          glow: 'rgba(148, 163, 184, 0.15)',
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ),
        };
    }
  }, [fileExt]);

  // Format file size (must be called unconditionally before any early return)
  const formattedSize = useMemo(() => {
    if (!current?.file_size) return '';
    const kb = current.file_size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }, [current?.file_size]);

  if (!current || activeMode !== 'view') return null;

  const handleConvert = async () => {
    if (!current?.path) return;
    try {
      const baseName = current.path.split('/').pop()?.split('.')[0] || 'converted';
      const defaultName = `${baseName}_converted.${targetFormat}`;
      const dest = await saveFileDialog(
        defaultName,
        `${targetFormat.toUpperCase()} Image`,
        [targetFormat],
      );

      if (!dest) return;

      setStatusMsg('Converting...');
      await convertMediaFile(
        current.path,
        dest,
        targetFormat,
        targetSize || undefined,
        targetSize || undefined,
        90,
      );

      setStatusMsg('Saved!');
      setTimeout(() => {
        setStatusMsg(null);
        setIsConvertOpen(false);
      }, 1500);
    } catch (err) {
      setStatusMsg(`Error: ${err}`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div className={styles.badgeWrapper}>
      <div className={styles.badgePill}>
        <div
          className={styles.iconBox}
          style={{ background: config.glow, borderColor: config.accent }}
        >
          {config.icon}
        </div>
        <div className={styles.typeTextGroup}>
          <span className={styles.formatLabel} style={{ color: config.accent }}>
            {config.name}
          </span>
          <span className={styles.metaSubtext}>
            {formattedSize || 'Media'}
          </span>
        </div>

        {/* Built-in format conversion trigger */}
        {current.media_type !== 'Video' && (
          <button
            className={styles.convertTriggerBtn}
            onClick={() => setIsConvertOpen(!isConvertOpen)}
            title="Convert image format..."
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
              <polyline points="10 9 15 4 20 9" />
              <line x1="15" y1="4" x2="15" y2="16" />
            </svg>
            Convert
          </button>
        )}
      </div>

      {/* Built-in Format Conversion Panel */}
      {isConvertOpen && (
        <div className={styles.convertModal}>
          <div className={styles.convertHeader}>
            <span className={styles.convertTitle}>Convert Format</span>
            <button
              className={styles.closeSmallBtn}
              onClick={() => setIsConvertOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Target Format</span>
            <div className={styles.formatPills}>
              {(['png', 'jpg', 'webp', 'bmp', 'ico', 'tiff'] as const).map((fmt) => (
                <button
                  key={fmt}
                  className={`${styles.formatPill} ${targetFormat === fmt ? styles.active : ''}`}
                  onClick={() => setTargetFormat(fmt)}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Size presets especially great for SVGs / Icons */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Resolution</span>
            <div className={styles.formatPills}>
              {[
                { label: 'Native', size: null },
                { label: '512×512', size: 512 },
                { label: '256×256', size: 256 },
                { label: '128×128', size: 128 },
                { label: '64×64', size: 64 },
                { label: '32×32', size: 32 },
              ].map(({ label, size }) => (
                <button
                  key={label}
                  className={`${styles.formatPill} ${targetSize === size ? styles.active : ''}`}
                  onClick={() => setTargetSize(size)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {statusMsg && <div className={styles.statusToast}>{statusMsg}</div>}

          <div className={styles.actionRow}>
            <button className={styles.exportBtn} onClick={handleConvert}>
              Export {targetFormat.toUpperCase()}...
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
