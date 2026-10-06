import React, { useState, useEffect } from 'react';
import { useViewerStore, EditorState } from '../stores/useViewerStore';
import {
  applyTransforms,
  applyImageAnnotations,
  pickAudioFile,
  composeVideoSequence,
  saveFileDialog,
  ComposeRequest,
  processVideoAdvanced,
  extractVideoAudio,
  extractBurstFrames,
} from '../lib/ipc';
import { Select, SelectOption } from './ui/Select';
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

const SCALE_OPTIONS: SelectOption<number>[] = [
  { value: 1.0, label: '100% (Original Resolution)' },
  { value: 0.75, label: '75% (Scaled)' },
  { value: 0.5, label: '50% (Half Size)' },
  { value: 0.25, label: '25% (Quarter Size)' },
  { value: -1, label: 'Custom Dimensions...' },
];

const SEQUENCE_QUALITY_OPTIONS: SelectOption<'high' | 'medium' | 'small'>[] = [
  { value: 'high', label: 'High Fidelity (CRF 18 / 256k)' },
  { value: 'medium', label: 'Balanced (CRF 22 / 192k)' },
  { value: 'small', label: 'Small File / Fast Web (CRF 28 / 128k)' },
];

const VIDEO_QUALITY_OPTIONS: SelectOption<'high' | 'medium' | 'small'>[] = [
  { value: 'high', label: 'High Fidelity (CRF 18 / 192k AAC)' },
  { value: 'medium', label: 'Balanced (CRF 24 / 128k AAC)' },
  { value: 'small', label: 'Small Size (CRF 30 / 96k AAC)' },
];

const SPEED_PRESETS = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0, 8.0];

export const EditorDrawer: React.FC = () => {
  const {
    items,
    currentIndex,
    activeMode,
    setActiveMode,
    editor,
    updateEditor,
    resetEditor,
    videoParams,
    updateVideoParams,
    resetVideoParams,
    setActiveSubTool,
    sequence,
    addCurrentToSequence,
    removeClipFromSequence,
    moveClipInSequence,
    clearSequence,
    audioTrack,
    setAudioTrack,
    updateAudioVolume,
    setAudioMode,
    openTargetFile,
    imageDetail,
    annotations,
  } = useViewerStore();

  const current = items[currentIndex];
  const isVideo = current?.media_type === 'Video';

  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'sequence'>(
    isVideo ? 'video' : 'image'
  );
  const [sequenceQuality, setSequenceQuality] = useState<'high' | 'medium' | 'small'>('medium');
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'small'>('medium');
  const [isRendering, setIsRendering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const origW = imageDetail?.width || 1920;
  const origH = imageDetail?.height || 1080;
  const effectiveW = editor.crop ? editor.crop.width : origW;
  const effectiveH = editor.crop ? editor.crop.height : origH;
  const aspect = effectiveW > 0 && effectiveH > 0 ? effectiveW / effectiveH : 1.0;

  const [widthInput, setWidthInput] = useState<string>(
    (editor.customWidth || Math.round(effectiveW * (editor.exportScale > 0 ? editor.exportScale : 1.0))).toString()
  );
  const [heightInput, setHeightInput] = useState<string>(
    (editor.customHeight || Math.round(effectiveH * (editor.exportScale > 0 ? editor.exportScale : 1.0))).toString()
  );

  useEffect(() => {
    if (editor.customWidth) {
      setWidthInput(editor.customWidth.toString());
    } else {
      const scale = editor.exportScale > 0 ? editor.exportScale : 1.0;
      setWidthInput(Math.round(effectiveW * scale).toString());
    }
    if (editor.customHeight) {
      setHeightInput(editor.customHeight.toString());
    } else {
      const scale = editor.exportScale > 0 ? editor.exportScale : 1.0;
      setHeightInput(Math.round(effectiveH * scale).toString());
    }
  }, [editor.customWidth, editor.customHeight, editor.exportScale, effectiveW, effectiveH]);

  const handleCustomWidthChange = (valStr: string) => {
    setWidthInput(valStr);
    const w = parseInt(valStr, 10);
    if (!isNaN(w) && w > 0) {
      const h = Math.max(1, Math.round(w / aspect));
      setHeightInput(h.toString());
      updateEditor({ customWidth: w, customHeight: h, exportScale: -1 });
    }
  };

  const handleCustomHeightChange = (valStr: string) => {
    setHeightInput(valStr);
    const h = parseInt(valStr, 10);
    if (!isNaN(h) && h > 0) {
      const w = Math.max(1, Math.round(h * aspect));
      setWidthInput(w.toString());
      updateEditor({ customWidth: w, customHeight: h, exportScale: -1 });
    }
  };

  if (activeMode !== 'edit' || !current) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSaveImage = async (customPath?: string) => {
    setIsSaving(true);
    try {
      const format = editor.exportFormat === 'same' ? undefined : editor.exportFormat;
      let targetW: number | undefined;
      let targetH: number | undefined;

      if (editor.exportScale === -1) {
        if (editor.customWidth && editor.customHeight) {
          targetW = Math.round(editor.customWidth);
          targetH = Math.round(editor.customHeight);
        }
      } else if (editor.exportScale !== 1.0) {
        targetW = origW ? Math.round(origW * editor.exportScale) : undefined;
        targetH = origH ? Math.round(origH * editor.exportScale) : undefined;
      }

      let res: string;
      if (annotations && annotations.length > 0) {
        res = await applyImageAnnotations({
          path: current.path,
          annotations,
          destination: customPath,
          overwrite: !customPath && editor.overwrite,
          format,
          quality: editor.quality,
          save: true,
          width: targetW,
          height: targetH,
        });
      } else {
        res = await applyTransforms({
          path: current.path,
          rotation: editor.rotation,
          flip_h: editor.flipH,
          flip_v: editor.flipV,
          crop: editor.crop || undefined,
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
          width: targetW,
          height: targetH,
        });
      }

      if (editor.overwrite && !customPath) {
        showStatus(`Overwritten original file: ${res}`);
      } else {
        showStatus(`Saved copy next to original: ${res}`);
        await openTargetFile(res);
      }
    } catch (e) {
      showStatus(`Image export error: ${e}`);
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
      showStatus(`Save As error: ${e}`);
    }
  };

  const handleProcessVideo = async () => {
    setIsRendering(true);
    try {
      const baseDir = current.path.substring(0, current.path.lastIndexOf('/')) || '.';
      const stem = current.file_name.replace(/\.[^.]+$/, '');
      const timestamp = Date.now().toString().slice(-6);
      const destination = `${baseDir}/${stem}_processed_${timestamp}.mp4`;

      const res = await processVideoAdvanced(current.path, destination, {
        crop: videoParams.crop,
        speed: videoParams.speed,
        rotation: videoParams.rotation > 0 ? videoParams.rotation : null,
        flip_h: videoParams.flipH,
        flip_v: videoParams.flipV,
        mute_audio: videoParams.muteAudio,
        volume: videoParams.volume,
        color_grading: {
          brightness: videoParams.brightness,
          contrast: videoParams.contrast,
          saturation: videoParams.saturation,
          gamma: videoParams.gamma,
        },
        grayscale: videoParams.grayscale,
        sepia: videoParams.sepia,
        invert: videoParams.invert,
        reverse: videoParams.reverse,
        timecode_burn_in: videoParams.timecodeBurnIn,
        telemetry_text: videoParams.telemetryText || null,
        quality: videoQuality,
      });

      showStatus(`Video processed successfully: ${res}`);
      await openTargetFile(res);
    } catch (e) {
      showStatus(`Video processing error: ${e}`);
    } finally {
      setIsRendering(false);
    }
  };

  const handleExtractAudio = async (format: 'mp3' | 'wav' | 'aac') => {
    try {
      const res = await extractVideoAudio(current.path, null, format);
      showStatus(`Audio track extracted: ${res}`);
    } catch (e) {
      showStatus(`Audio extraction error: ${e}`);
    }
  };

  const handleExtractBurst = async () => {
    try {
      const paths = await extractBurstFrames(current.path, null, 0, 2, 5);
      showStatus(`Extracted ${paths.length} burst frames.`);
    } catch (e) {
      showStatus(`Burst extraction error: ${e}`);
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
      showStatus(`Audio picker error: ${e}`);
    }
  };

  const handleRenderSequence = async () => {
    if (sequence.length === 0) {
      showStatus('Please add at least one clip to the sequence before rendering.');
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
      showStatus(`Sequence rendered successfully: ${destination}`);
      await openTargetFile(destination);
    } catch (e) {
      showStatus(`Rendering error: ${e}`);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <aside className={styles.drawer} data-drawer="true">
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

      {statusMessage && (
        <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.2)', borderBottom: '1px solid rgba(59, 130, 246, 0.4)', fontSize: '11px', color: '#93c5fd' }}>
          {statusMessage}
        </div>
      )}

      {/* Mode / Feature Tabs */}
      <div className={styles.tabBar}>
        {isVideo ? (
          <button
            className={`${styles.tabBtn} ${activeTab === 'video' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('video')}
          >
            Video Studio
          </button>
        ) : (
          <button
            className={`${styles.tabBtn} ${activeTab === 'image' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('image')}
          >
            Image Studio
          </button>
        )}
        <button
          className={`${styles.tabBtn} ${activeTab === 'sequence' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sequence')}
        >
          Sequencer & Music
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'image' ? (
          /* TAB 1: IMAGE STUDIO */
          <>
            {/* Presets & Filters */}
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
              <div className={styles.sectionTitle}>Orientation & Crop</div>
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
                <button
                  className={styles.toolBtn}
                  onClick={() => setActiveSubTool('crop')}
                  title="Interactive Crop Box"
                >
                  Crop Box
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

              {/* Output Resolution & Aspect-Preserving Scaling */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Output Resolution</span>
                  {imageDetail && (
                    <span className={`${styles.sliderValue} tabular-nums`}>
                      {editor.exportScale === -1 && editor.customWidth && editor.customHeight
                        ? `${editor.customWidth} × ${editor.customHeight}`
                        : `${Math.round(imageDetail.width * (editor.exportScale > 0 ? editor.exportScale : 1.0))} × ${Math.round(imageDetail.height * (editor.exportScale > 0 ? editor.exportScale : 1.0))}`}
                    </span>
                  )}
                </div>
                <Select<number>
                  value={editor.exportScale}
                  options={SCALE_OPTIONS}
                  onChange={(scale) => {
                    if (scale === -1) {
                      const initW = editor.customWidth || effectiveW;
                      const initH = editor.customHeight || effectiveH;
                      updateEditor({ exportScale: -1, customWidth: initW, customHeight: initH });
                    } else {
                      updateEditor({
                        exportScale: scale,
                        customWidth: Math.round(effectiveW * scale),
                        customHeight: Math.round(effectiveH * scale),
                      });
                    }
                  }}
                  ariaLabel="Output resolution scale"
                />

                {editor.exportScale === -1 && (
                  <div className={styles.customDimRow}>
                    <div className={styles.dimInputGroup}>
                      <span className={styles.dimLabel}>Width (px)</span>
                      <input
                        type="number"
                        min="1"
                        max="32000"
                        value={widthInput}
                        onChange={(e) => handleCustomWidthChange(e.target.value)}
                        className={styles.dimInput}
                        placeholder="Width"
                      />
                    </div>

                    <div className={styles.aspectLock} title="Aspect ratio locked">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </div>

                    <div className={styles.dimInputGroup}>
                      <span className={styles.dimLabel}>Height (px)</span>
                      <input
                        type="number"
                        min="1"
                        max="32000"
                        value={heightInput}
                        onChange={(e) => handleCustomHeightChange(e.target.value)}
                        className={styles.dimInput}
                        placeholder="Height"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Target Format</span>
                </div>
                <Select<EditorState['exportFormat']>
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
                      Notice: Saving will replace the original file on disk.
                    </div>
                  ) : (
                    <span>Default: Saves a copy next to the original file (e.g. <code>_edited</code>) without modifying the source.</span>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'video' ? (
          /* TAB 2: VIDEO STUDIO */
          <>
            {/* Speed Ramping */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Speed Ramping</div>
              <div className={styles.filterGrid}>
                {SPEED_PRESETS.map((s) => (
                  <button
                    key={s}
                    className={`${styles.filterBtn} ${videoParams.speed === s ? styles.active : ''}`}
                    onClick={() => updateVideoParams({ speed: s })}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Video Orientation & Visual Crop */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Transform & Crop</div>
              <div className={styles.btnGroup}>
                <button
                  className={styles.toolBtn}
                  onClick={() => updateVideoParams({ rotation: (videoParams.rotation + 90) % 360 })}
                  title="Rotate Right 90°"
                >
                  ↻ 90°
                </button>
                <button
                  className={`${styles.toolBtn} ${videoParams.flipH ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ flipH: !videoParams.flipH })}
                  title="Flip Horizontal"
                >
                  ⇄
                </button>
                <button
                  className={`${styles.toolBtn} ${videoParams.flipV ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ flipV: !videoParams.flipV })}
                  title="Flip Vertical"
                >
                  ⇅
                </button>
                <button
                  className={styles.toolBtn}
                  onClick={() => setActiveSubTool('crop')}
                  title="Interactive Video Crop"
                >
                  {videoParams.crop ? 'Recrop' : 'Crop Area'}
                </button>
              </div>
              {videoParams.crop && (
                <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '6px' }}>
                  Cropped: {videoParams.crop.width}x{videoParams.crop.height} at ({videoParams.crop.x}, {videoParams.crop.y})
                </div>
              )}
            </div>

            {/* Audio Dynamics & Extraction */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Audio Tools</div>
              <div className={styles.checkboxContainer}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={videoParams.muteAudio}
                    onChange={(e) => updateVideoParams({ muteAudio: e.target.checked })}
                    className={styles.checkboxInput}
                  />
                  <span>Mute Audio Track</span>
                </label>
              </div>

              {!videoParams.muteAudio && (
                <div className={styles.sliderRow} style={{ marginTop: '8px' }}>
                  <div className={styles.sliderHeader}>
                    <span>Volume Gain</span>
                    <span className={`${styles.sliderValue} tabular-nums`}>
                      {(videoParams.volume * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.05"
                    value={videoParams.volume}
                    onChange={(e) => updateVideoParams({ volume: parseFloat(e.target.value) })}
                    className={styles.rangeInput}
                  />
                </div>
              )}

              <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                <button
                  className={styles.toolBtn}
                  style={{ flex: 1 }}
                  onClick={() => handleExtractAudio('mp3')}
                  title="Extract Audio to 320 kbps MP3"
                >
                  Extract MP3
                </button>
                <button
                  className={styles.toolBtn}
                  style={{ flex: 1 }}
                  onClick={() => handleExtractAudio('wav')}
                  title="Extract Audio to Uncompressed WAV"
                >
                  Extract WAV
                </button>
                <button
                  className={styles.toolBtn}
                  style={{ flex: 1 }}
                  onClick={() => handleExtractAudio('aac')}
                  title="Extract Audio to AAC"
                >
                  Extract AAC
                </button>
              </div>
            </div>

            {/* Color Grading & Filters */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Color Grading & FX</div>
              <div className={styles.filterGrid}>
                <button
                  className={`${styles.filterBtn} ${!videoParams.grayscale && !videoParams.sepia && !videoParams.invert && !videoParams.reverse ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ grayscale: false, sepia: false, invert: false, reverse: false })}
                >
                  Normal
                </button>
                <button
                  className={`${styles.filterBtn} ${videoParams.grayscale ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ grayscale: !videoParams.grayscale })}
                >
                  B&W
                </button>
                <button
                  className={`${styles.filterBtn} ${videoParams.sepia ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ sepia: !videoParams.sepia })}
                >
                  Sepia
                </button>
                <button
                  className={`${styles.filterBtn} ${videoParams.invert ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ invert: !videoParams.invert })}
                >
                  Invert
                </button>
                <button
                  className={`${styles.filterBtn} ${videoParams.reverse ? styles.active : ''}`}
                  onClick={() => updateVideoParams({ reverse: !videoParams.reverse })}
                >
                  Reverse
                </button>
              </div>

              {/* Brightness */}
              <div className={styles.sliderRow} style={{ marginTop: '10px' }}>
                <div className={styles.sliderHeader}>
                  <span>Brightness</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {videoParams.brightness.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.8"
                  max="0.8"
                  step="0.05"
                  value={videoParams.brightness}
                  onChange={(e) => updateVideoParams({ brightness: parseFloat(e.target.value) })}
                  className={styles.rangeInput}
                />
              </div>

              {/* Contrast */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Contrast</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {videoParams.contrast.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={videoParams.contrast}
                  onChange={(e) => updateVideoParams({ contrast: parseFloat(e.target.value) })}
                  className={styles.rangeInput}
                />
              </div>

              {/* Saturation */}
              <div className={styles.sliderRow}>
                <div className={styles.sliderHeader}>
                  <span>Saturation</span>
                  <span className={`${styles.sliderValue} tabular-nums`}>
                    {videoParams.saturation.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.05"
                  value={videoParams.saturation}
                  onChange={(e) => updateVideoParams({ saturation: parseFloat(e.target.value) })}
                  className={styles.rangeInput}
                />
              </div>
            </div>

            {/* Telemetry Overlays & Burst */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Telemetry & Overlays</div>
              <div className={styles.checkboxContainer}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={videoParams.timecodeBurnIn}
                    onChange={(e) => updateVideoParams({ timecodeBurnIn: e.target.checked })}
                    className={styles.checkboxInput}
                  />
                  <span>Burn-In Timecode (HH:MM:SS.mmm)</span>
                </label>
              </div>

              <div className={styles.sliderRow} style={{ marginTop: '8px' }}>
                <div className={styles.sliderHeader}>
                  <span>Telemetry Watermark Tag</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Flight Mission A-101"
                  value={videoParams.telemetryText}
                  onChange={(e) => updateVideoParams({ telemetryText: e.target.value })}
                  className={styles.rangeInput}
                  style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff' }}
                />
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  className={styles.toolBtn}
                  style={{ width: '100%' }}
                  onClick={handleExtractBurst}
                  title="Extract burst of 5 still frames"
                >
                  Extract Burst Frames (Stills)
                </button>
              </div>
            </div>

            {/* Video Export Quality */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Output Quality</div>
              <Select<'high' | 'medium' | 'small'>
                value={videoQuality}
                options={VIDEO_QUALITY_OPTIONS}
                onChange={(q) => setVideoQuality(q)}
                ariaLabel="Video quality"
              />
            </div>
          </>
        ) : (
          /* TAB 3: SEQUENCE STORYBOARD & MUSIC */
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
                      {audioTrack.fileName}
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
                    <Select<'mix' | 'replace'>
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
              <Select<'high' | 'medium' | 'small'>
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
        ) : activeTab === 'video' ? (
          <>
            <button className={styles.revertBtn} onClick={resetVideoParams} title="Reset all video adjustments">
              Reset
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleProcessVideo}
              disabled={isRendering}
            >
              {isRendering ? 'Processing...' : 'Export Video'}
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
