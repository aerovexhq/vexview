import React, { useState } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import {
  applyTransforms,
  pickAudioFile,
  composeVideoSequence,
  ComposeRequest,
} from '../lib/ipc';
import { CustomSelect, SelectOption } from './common/CustomSelect';
import styles from './EditorDrawer.module.css';

const AUDIO_MODE_OPTIONS: SelectOption<'mix' | 'replace'>[] = [
  { value: 'mix', label: 'Mix with Video Audio' },
  { value: 'replace', label: 'Replace Video Audio' },
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
  const [isRendering, setIsRendering] = useState(false);

  if (activeMode !== 'edit' || !current) return null;

  const handleSaveImage = async () => {
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
      alert(`Exported image copy successfully:\n${destination}`);
    } catch (e) {
      alert(`Image export error: ${e}`);
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
      const destination = `${baseDir}/lux_sequence_${timestamp}.mp4`;

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
          🎨 Image Tone
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
                    Render & Export Video
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
            <button className={styles.revertBtn} onClick={resetEditor}>
              Revert
            </button>
            <button className={styles.saveBtn} onClick={handleSaveImage}>
              Export Copy
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.revertBtn}
              onClick={clearSequence}
              disabled={sequence.length === 0}
            >
              Clear Timeline
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
