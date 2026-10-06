import React from 'react';
import { useViewerStore, ActiveSubTool } from '../stores/useViewerStore';
import { applyImageAnnotations } from '../lib/ipc';
import styles from './ToolPalette.module.css';

const COLOR_PRESETS: Array<{ label: string; rgba: [number, number, number, number]; hex: string }> = [
  { label: 'Safety Red', rgba: [239, 68, 68, 255], hex: '#ef4444' },
  { label: 'Cyber Amber', rgba: [245, 158, 11, 255], hex: '#f59e0b' },
  { label: 'Electric Lime', rgba: [34, 197, 94, 255], hex: '#22c55e' },
  { label: 'Sky Blue', rgba: [59, 130, 246, 255], hex: '#3b82f6' },
  { label: 'Neon Magenta', rgba: [236, 72, 153, 255], hex: '#ec4899' },
  { label: 'Pure White', rgba: [255, 255, 255, 255], hex: '#ffffff' },
  { label: 'Dark Slate', rgba: [30, 41, 59, 255], hex: '#1e293b' },
];

export const ToolPalette: React.FC = () => {
  const {
    activeSubTool,
    setActiveSubTool,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    annotations,
    annotationHistory,
    annotationRedoHistory,
    undoAnnotation,
    redoAnnotation,
    clearAnnotations,
    items,
    currentIndex,
    openTargetFile,
  } = useViewerStore();

  const current = items[currentIndex];
  const isImage = current && current.media_type !== 'Video';

  const handleBakeAndSave = async () => {
    if (!current || annotations.length === 0) return;
    try {
      const savedPath = await applyImageAnnotations({
        path: current.path,
        annotations,
        save: true,
      });
      if (savedPath) {
        clearAnnotations();
        setActiveSubTool('select');
        await openTargetFile(savedPath);
      }
    } catch (e) {
      console.error('Failed to bake annotations:', e);
    }
  };

  const isCurrentColor = (rgba: [number, number, number, number]) =>
    strokeColor[0] === rgba[0] &&
    strokeColor[1] === rgba[1] &&
    strokeColor[2] === rgba[2];

  const tools: Array<{ id: ActiveSubTool; label: string; icon: React.ReactNode }> = [
    {
      id: 'select',
      label: 'Pan and Zoom (V)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7 18 3-7 7-3L3 3z" />
        </svg>
      ),
    },
    {
      id: 'crop',
      label: 'Interactive Crop (C)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
          <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
        </svg>
      ),
    },
    {
      id: 'pen',
      label: 'Freehand Pen (P)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
        </svg>
      ),
    },
    {
      id: 'highlighter',
      label: 'Highlighter Brush (H)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l-6 6v3h3l6-6" />
          <path d="M22 2l-7 7-3-3 7-7 3 3z" />
        </svg>
      ),
    },
    {
      id: 'line',
      label: 'Straight Line (L)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="4" />
        </svg>
      ),
    },
    {
      id: 'arrow',
      label: 'Directional Arrow (A)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="19" x2="19" y2="5" />
          <polyline points="10 5 19 5 19 14" />
        </svg>
      ),
    },
    {
      id: 'rect',
      label: 'Rectangle (R)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
    },
    {
      id: 'ellipse',
      label: 'Ellipse (O)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
    },
    {
      id: 'badge',
      label: 'Step Badge (1, 2, 3...) (B)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor">
            1
          </text>
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Text Callout (T)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
    },
    {
      id: 'blur_rect',
      label: 'Regional Blur (Redact)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      id: 'mosaic_rect',
      label: 'Mosaic Pixelation (Redact)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: 'eraser',
      label: 'Eraser (E)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" />
          <line x1="18" y1="13" x2="11" y2="20" />
        </svg>
      ),
    },
    {
      id: 'eyedropper',
      label: 'Eyedropper Color Picker (I)',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 22l5-5" />
          <path d="M19 11l-8-8-2 2 8 8 2-2z" />
          <path d="M15 15l-3 3-3-3" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.toolPalette}>
      {/* Tool selector buttons */}
      {tools.map((t) => (
        <button
          key={t.id}
          className={`${styles.toolButton} ${activeSubTool === t.id ? styles.active : ''}`}
          onClick={() => setActiveSubTool(t.id)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      <div className={styles.divider} />

      {/* Color swatches */}
      {COLOR_PRESETS.map((c) => (
        <div
          key={c.hex}
          className={`${styles.colorSwatch} ${isCurrentColor(c.rgba) ? styles.activeSwatch : ''}`}
          style={{ backgroundColor: c.hex }}
          onClick={() => setStrokeColor(c.rgba)}
          title={c.label}
        />
      ))}

      <div className={styles.divider} />

      {/* Stroke width selector */}
      <select
        className={styles.strokeWidthSelect}
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        title="Stroke Width"
      >
        <option value={2}>2px</option>
        <option value={4}>4px</option>
        <option value={8}>8px</option>
        <option value={16}>16px</option>
        <option value={24}>24px</option>
      </select>

      <div className={styles.divider} />

      {/* Undo / Redo */}
      <button
        className={styles.toolButton}
        onClick={undoAnnotation}
        disabled={annotationHistory.length === 0}
        title="Undo (Ctrl+Z)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>

      <button
        className={styles.toolButton}
        onClick={redoAnnotation}
        disabled={annotationRedoHistory.length === 0}
        title="Redo (Ctrl+Y)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </button>

      {/* Clear all */}
      {annotations.length > 0 && (
        <button
          className={styles.toolButton}
          onClick={clearAnnotations}
          title="Clear Annotations"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}

      {/* Bake and Save button */}
      {isImage && annotations.length > 0 && (
        <>
          <div className={styles.divider} />
          <button
            className={styles.bakeButton}
            onClick={handleBakeAndSave}
            title="Bake and save annotations to new file"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            Save
          </button>
        </>
      )}
    </div>
  );
};
