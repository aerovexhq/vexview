import React, { useState } from 'react';
import { useViewerStore, EditorState } from '../stores/useViewerStore';
import {
  applyTransforms,
  pickAudioFile,
  composeVideoSequence,
  saveFileDialog,
  ComposeRequest,
} from '../lib/ipc';
import { CustomSelect, SelectOption } from './common/CustomSelect';
import styles from './EditorDrawer.module.css';

const AUDIO_MODE_OPTIONS: SelectOption<'mix' | 'replace'>[] = [
  { value: 'mix', label: 'Mix with Video Audio' },
  { value: 'replace', label: 'Replace Video Audio' },
];

const FORMAT_OPTIONS: SelectOption<EditorState['exportFormat']>[] = [
  { value: 'same', label: 'Same as Original' },
  { value: 'png', label: 'PNG (Lossless)' },
  { value: 'jpg', label: 'JPEG' },
  { value: 'webp', label: 'WebP (Modern Compact)' },
  { value: 'bmp', label: 'BMP (Bitmap)' },
  { value: 'tiff', label: 'TIFF' },
];

const SEQUENCE_QUALITY_OPTIONS: SelectOption<'high' | 'medium' | 'small'>[] = [
  { value: 'high', label: 'High Fidelity (CRF 18 / 256k)' },
  { value: 'medium', label: 'Balanced (CRF 22 / 192k)' },
  { value: 'small', label: 'Small File / Fast Web (CRF 28 / 128k)' },
];

export const EditorDrawer: React.FC = () => {
  const {
    items,
    currentIndex,
    activeMode,
    setActiveMode,
    editor,
    updateEditor,
    resetEditor,
    sequence,
    addCurrentToSequence,
    removeClipFromSequence,
    moveClipInSequence,
    clearSequence,
    audioTrack,
    setAudioTrack,
    updateAudioVolume,
    setAudioMode,
  } = useViewerStore();

  const current = items[currentIndex];
  const isVideo = current?.media_type === 'Video';

  const [activeTab, setActiveTab] = useState<'image' | 'sequence'>(
    isVideo ? 'sequence' : 'image'
  );
  const [sequenceQuality, setSequenceQuality] = useState<'high' | 'medium' | 'small'>('medium');
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (activeMode !== 'edit' || !current) return null;

  const handleSaveImage = async (customPath?: string) => {
    setIsSaving(true);
    try {
      const format = editor.exportFormat === 'same' ? undefined : editor.exportFormat;
      const res = await applyTransforms({
        path: current.path,
        rotation: editor.rotation,
        flip_h: editor.flipH,
        flip_v: editor.flipV,
        brightness: editor.brightness,
        contrast: editor.contrast,
        blur: editor.blur,
        saturation: editor.saturation,
        warmth: editor.warmth,
        filter: editor.filter === 'none' ? undefined : editor.filter,
        format,
        quality: editor.quality,
        save: true,
        overwrite: !customPath && editor.overwrite,
        destination: customPath,
      });

      if (editor.overwrite && !customPath) {
        alert(`Successfully overwritten original file:\n${res}`);
      } else {
        alert(`Saved copy next to original:\n${res}`);
      }
    } catch (e) {
      alert(`Image export error: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsImage = async () => {
    try {
      const ext =
        editor.exportFormat === 'same'
          ? current.path.split('.').pop() || 'png'
          : editor.exportFormat;
      const baseName = current.file_name.replace(/\.[^.]+$/, `_edited.${ext}`);
      const picked = await saveFileDialog(baseName, `${ext.toUpperCase()} File`, [ext]);
      if (!picked) return;
      await handleSaveImage(picked);
    } catch (e) {
      alert(`Save As error: ${e}`);
    }
  };

  const handleChooseMusic = async () => {
    try {
      const path = await pickAudioFile();
      if (!path) return;
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      setAudioTrack({
        path,
        fileName,
        volume: 1.0,
        mode: 'mix',
      });
    } catch (e) {
      alert(`Audio picker error: ${e}`);
    }
  };

  const handleRenderSequence = async () => {
    if (sequence.length === 0) {
      alert('Please add at least one clip to the sequence before rendering.');
      return;
    }

    setIsRendering(true);
    try {
      const baseDir = current.path.substring(0, current.path.lastIndexOf('/')) || '.';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const destination = `${baseDir}/vex_sequence_${timestamp}.mp4`;

      const req: ComposeRequest = {
        clips: sequence.map((c) => ({
          path: c.path,
          start_sec: c.trimStart,
          end_sec: c.trimEnd,
        })),
        audio_track: audioTrack
          ? {
              path: audioTrack.path,
              volume: audioTrack.volume,
              mode: audioTrack.mode,
            }
          : null,
        destination,
        quality: sequenceQuality,
      };

      await composeVideoSequence(req);
      alert(`Sequence rendered successfully!\nSaved to:\n${destination}`);
    } catch (e) {
      alert(`Rendering error: ${e}`);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <aside className={styles.drawer}>
      <div className={styles.header}>
        <span className={styles.title}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Studio Editor
        </span>
        <button
          className={styles.closeBtn}
          onClick={() => setActiveMode('view')}
          title="Close Editor (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Mode / Feature Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'image' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('image')}
        >
          🎨 Image Studio
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'sequence' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sequence')}
        >
          🎬 Sequencer & Music
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'image' ? (
          /* TAB 1: IMAGE STUDIO */
          <>
            {/* Quick Filters */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Presets & Filters</div>
              <div className={styles.filterGrid}>
                <button
                  className={`${styles.filterBtn} ${editor.filter === 'none' ? styles.active : ''}`}
                  onClick={() => updateEditor({ filter: 'none' })}
                >
                  Original
                </button>
                <button
                  className={`${styles.filterBtn} ${editor.filter === 'grayscale' ? styles.active : ''}`}
                  onClick={() => updateEditor({ filter: 'grayscale' })}
                >
                  B&W
                </button>
                <button
                  className={`${styles.filterBtn} ${editor.filter === 'sepia' ? styles.active : ''}`}
                  onClick={() => updateEditor({ filter: 'sepia' })}
                >
                  Sepia
                </button>
                <button
                  className={`${styles.filterBtn} ${editor.filter === 'invert' ? styles.active : ''}`}
                  onClick={() => updateEditor({ filter: 'invert' })}
                >
                  Invert
                </button>
              </div>
            </div>

            {/* Geometry & Orientation */}
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

            {/* Tone & Light Adjustments */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Color & Light</div>

              {/* Exposure */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Exposure / Brightness</span>
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

              {/* Contrast */}
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

              {/* Saturation */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Saturation</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {editor.saturation > 0 ? `+${editor.saturation}` : editor.saturation}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={editor.saturation}
                  onChange={(e) => updateEditor({ saturation: parseInt(e.target.value, 10) })}
                  className={styles.rangeInput}
                />
              </div>

              {/* Warmth / Color Temperature */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Warmth / Temp</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {editor.warmth > 0 ? `+${editor.warmth}` : editor.warmth}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={editor.warmth}
                  onChange={(e) => updateEditor({ warmth: parseInt(e.target.value, 10) })}
                  className={styles.rangeInput}
                />
              </div>

              {/* Blur & Soften */}
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

            {/* Export Format & Compression */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Export & Quality</div>

              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Target Format</span>
                </div>
                <CustomSelect<EditorState['exportFormat']>
                  value={editor.exportFormat}
                  options={FORMAT_OPTIONS}
                  onChange={(fmt) => updateEditor({ exportFormat: fmt })}
                  ariaLabel="Image format"
                />
              </div>

              {/* Compression / Quality */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Quality / Compression</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {editor.quality}% {editor.quality >= 95 ? '(Lossless / Original)' : editor.quality >= 85 ? '(High)' : editor.quality >= 70 ? '(Balanced)' : '(Small Size)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={editor.quality}
                  onChange={(e) => updateEditor({ quality: parseInt(e.target.value, 10) })}
                  className={styles.rangeInput}
                />
                <div className={styles.qualityPresetGroup}>
                  <button
                    className={`${styles.qualityPresetBtn} ${editor.quality === 100 ? styles.qualityActive : ''}`}
                    onClick={() => updateEditor({ quality: 100 })}
                  >
                    100% Orig
                  </button>
                  <button
                    className={`${styles.qualityPresetBtn} ${editor.quality === 90 ? styles.qualityActive : ''}`}
                    onClick={() => updateEditor({ quality: 90 })}
                  >
                    90% High
                  </button>
                  <button
                    className={`${styles.qualityPresetBtn} ${editor.quality === 75 ? styles.qualityActive : ''}`}
                    onClick={() => updateEditor({ quality: 75 })}
                  >
                    75% Balanced
                  </button>
                  <button
                    className={`${styles.qualityPresetBtn} ${editor.quality === 50 ? styles.qualityActive : ''}`}
                    onClick={() => updateEditor({ quality: 50 })}
                  >
                    50% Compact
                  </button>
                </div>
              </div>

              {/* Overwrite or Save Next To Original */}
              <div className={styles.checkboxContainer}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={editor.overwrite}
                    onChange={(e) => updateEditor({ overwrite: e.target.checked })}
                    className={styles.checkboxInput}
                  />
                  <span>Overwrite original file</span>
                </label>
                <div className={styles.checkboxDesc}>
                  {editor.overwrite ? (
                    <div className={styles.warningNotice}>
                      ⚠️ Warning: Saving will replace the original file on disk.
                    </div>
                  ) : (
                    <span>Default: Saves a copy next to the original file (e.g. <code>_edited</code>) without modifying the source.</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* TAB 2: SEQUENCE STORYBOARD & MUSIC */
          <>
            {/* Clips Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Clips Sequence ({sequence.length})</span>
                <button
                  className={styles.actionLink}
                  onClick={addCurrentToSequence}
                  title="Add currently viewed file to the composition sequence"
                >
                  + Add Current
                </button>
              </div>

              {sequence.length === 0 ? (
                <div className={styles.emptySequence}>
                  <div>Your sequence timeline is currently empty.</div>
                  <button className={styles.addPromptBtn} onClick={addCurrentToSequence}>
                    + Add Current Media
                  </button>
                </div>
              ) : (
                <div className={styles.clipList}>
                  {sequence.map((clip, idx) => (
                    <div key={clip.id} className={styles.clipCard}>
                      <div className={styles.clipInfo}>
                        <div className={styles.clipHeaderRow}>
                          <span className={styles.clipBadge}>#{idx + 1} {clip.mediaType}</span>
                          <span className={styles.clipName} title={clip.fileName}>
                            {clip.fileName}
                          </span>
                        </div>
                        <div className={`${styles.clipMeta} tabular-nums`}>
                          {clip.trimEnd ? `${clip.trimEnd.toFixed(1)}s` : '3.0s'}
                        </div>
                      </div>

                      <div className={styles.clipActions}>
                        <button
                          className={styles.clipMiniBtn}
                          disabled={idx === 0}
                          onClick={() => moveClipInSequence(idx, idx - 1)}
                          title="Move Earlier in Sequence"
                        >
                          ▲
                        </button>
                        <button
                          className={styles.clipMiniBtn}
                          disabled={idx === sequence.length - 1}
                          onClick={() => moveClipInSequence(idx, idx + 1)}
                          title="Move Later in Sequence"
                        >
                          ▼
                        </button>
                        <button
                          className={styles.deleteClipBtn}
                          onClick={() => removeClipFromSequence(clip.id)}
                          title="Remove Clip from Sequence"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Soundtrack & Audio Track Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Soundtrack & Music</span>
                {audioTrack && (
                  <button
                    className={styles.actionLink}
                    onClick={() => setAudioTrack(null)}
                  >
                    Clear
                  </button>
                )}
              </div>

              {audioTrack ? (
                <div className={styles.audioCard}>
                  <div className={styles.audioHeader}>
                    <span className={styles.audioTitle} title={audioTrack.fileName}>
                      🎵 {audioTrack.fileName}
                    </span>
                    <button
                      className={styles.removeAudioBtn}
                      onClick={() => setAudioTrack(null)}
                      title="Remove audio track"
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.sliderRow}>
                    <div className={styles.sliderHeader}>
                      <span>Track Volume</span>
                      <span className={`${styles.sliderValue} tabular-nums`}>
                        {(audioTrack.volume * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={audioTrack.volume}
                      onChange={(e) => updateAudioVolume(parseFloat(e.target.value))}
                      className={styles.rangeInput}
                    />
                  </div>

                  <div className={styles.sliderRow}>
                    <div className={styles.sliderHeader}>
                      <span>Audio Mode</span>
                    </div>
                    <CustomSelect<'mix' | 'replace'>
                      value={audioTrack.mode}
                      options={AUDIO_MODE_OPTIONS}
                      onChange={(mode) => setAudioMode(mode)}
                      ariaLabel="Audio mix mode"
                    />
                  </div>
                </div>
              ) : (
                <button
                  className={styles.chooseAudioBtn}
                  onClick={handleChooseMusic}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  + Add Background Music Track...
                </button>
              )}
            </div>

            {/* Sequence Quality & Compression */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Render Quality</div>
              <CustomSelect<'high' | 'medium' | 'small'>
                value={sequenceQuality}
                options={SEQUENCE_QUALITY_OPTIONS}
                onChange={(q) => setSequenceQuality(q)}
                ariaLabel="Sequence render quality"
              />
            </div>

            {/* Render Composition Button */}
            <div className={styles.section}>
              <button
                className={styles.renderBtn}
                onClick={handleRenderSequence}
                disabled={isRendering || sequence.length === 0}
              >
                {isRendering ? (
                  <>Rendering Video with FFmpeg...</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Render & Export Sequence
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {activeTab === 'image' ? (
          <>
            <button className={styles.revertBtn} onClick={resetEditor} title="Reset all adjustments">
              Reset
            </button>
            <button className={styles.saveAsBtn} onClick={handleSaveAsImage} title="Choose destination folder and name">
              Save As...
            </button>
            <button
              className={styles.saveBtn}
              onClick={() => handleSaveImage()}
              disabled={isSaving}
              style={
                editor.overwrite
                  ? { backgroundColor: '#ef4444', color: '#ffffff' }
                  : undefined
              }
            >
              {isSaving
                ? 'Saving...'
                : editor.overwrite
                ? 'Overwrite File'
                : 'Save Copy'}
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.revertBtn}
              onClick={clearSequence}
              disabled={sequence.length === 0}
            >
              Clear
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleRenderSequence}
              disabled={isRendering || sequence.length === 0}
            >
              Export Video
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
