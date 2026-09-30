import React from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import { applyTransforms } from '../lib/ipc';
import styles from './EditorDrawer.module.css';

export const EditorDrawer: React.FC = () => {
  const {
    items,
    currentIndex,
    activeMode,
    setActiveMode,
    editor,
    updateEditor,
    resetEditor,
  } = useViewerStore();

  const current = items[currentIndex];
  if (activeMode !== 'edit' || !current) return null;

  const handleSave = async () => {
    try {
      const destination = current.path.replace(/(\.[^.]+)$/, '_edited$1');
      await applyTransforms({
        path: current.path,
        rotation: editor.rotation,
        flip_h: editor.flipH,
        flip_v: editor.flipV,
        brightness: editor.brightness,
        contrast: editor.contrast,
        blur: editor.blur,
        destination,
      });
      alert(`Exported successfully to:\n${destination}`);
    } catch (e) {
      alert(`Export error: ${e}`);
    }
  };

  return (
    <aside className={styles.drawer}>
      <div className={styles.header}>
        <span className={styles.title}>Studio Adjustments</span>
        <button
          className={styles.closeBtn}
          onClick={() => setActiveMode('view')}
          title="Close Editor (Esc)"
        >
          ✕
        </button>
      </div>

      <div className={styles.content}>
        {/* Orientation Controls */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Orientation</div>
          <div className={styles.btnGroup}>
            <button
              className={styles.toolBtn}
              onClick={() => updateEditor({ rotation: (editor.rotation - 90) % 360 })}
              title="Rotate Left 90°"
            >
              ↺ 90°
            </button>
            <button
              className={styles.toolBtn}
              onClick={() => updateEditor({ rotation: (editor.rotation + 90) % 360 })}
              title="Rotate Right 90°"
            >
              ↻ 90°
            </button>
            <button
              className={`${styles.toolBtn} ${editor.flipH ? styles.active : ''}`}
              onClick={() => updateEditor({ flipH: !editor.flipH })}
              title="Flip Horizontal"
            >
              ⇄
            </button>
            <button
              className={`${styles.toolBtn} ${editor.flipV ? styles.active : ''}`}
              onClick={() => updateEditor({ flipV: !editor.flipV })}
              title="Flip Vertical"
            >
              ⇅
            </button>
          </div>
        </div>

        {/* Color Tuning */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Tone & Contrast</div>

          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <span>Exposure</span>
              <span className={`${styles.sliderValue} tabular-nums`}>
                {editor.brightness > 0 ? `+${editor.brightness}` : editor.brightness}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={editor.brightness}
              onChange={(e) => updateEditor({ brightness: parseInt(e.target.value, 10) })}
              className={styles.rangeInput}
            />
          </div>

          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <span>Contrast</span>
              <span className={`${styles.sliderValue} tabular-nums`}>
                {editor.contrast > 0 ? `+${editor.contrast}` : editor.contrast}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={editor.contrast}
              onChange={(e) => updateEditor({ contrast: parseFloat(e.target.value) })}
              className={styles.rangeInput}
            />
          </div>

          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <span>Blur & Soften</span>
              <span className={`${styles.sliderValue} tabular-nums`}>
                {editor.blur.toFixed(1)}px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={editor.blur}
              onChange={(e) => updateEditor({ blur: parseFloat(e.target.value) })}
              className={styles.rangeInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.revertBtn} onClick={resetEditor}>
          Revert
        </button>
        <button className={styles.saveBtn} onClick={handleSave}>
          Export Copy
        </button>
      </div>
    </aside>
  );
};
