import { create } from 'zustand';
import {
  MediaItem,
  ImageDetailResponse,
  VideoMetadata,
  scanFolder,
  loadImageDetail,
  probeVideo,
  openFileDialog,
  openFolderDialog,
} from '../lib/ipc';

export interface EditorState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  blur: number;
  saturation: number;
  warmth: number;
  filter: 'none' | 'grayscale' | 'invert' | 'sepia';
  quality: number;
  exportFormat: 'same' | 'png' | 'jpg' | 'webp' | 'bmp' | 'tiff';
  overwrite: boolean;
  splitPosition: number; // 0 to 100% for before/after comparison
  previewUrl: string | null;
}

export interface SequenceClip {
  id: string;
  path: string;
  fileName: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  mediaType: 'Image' | 'Video';
}

export interface AudioTrackConfig {
  path: string;
  fileName: string;
  volume: number;
  mode: 'mix' | 'replace';
}

interface ViewerStore {
  folderPath: string;
  items: MediaItem[];
  currentIndex: number;
  imageDetail: ImageDetailResponse | null;
  videoDetail: VideoMetadata | null;
  loading: boolean;
  error: string | null;

  // Viewport
  zoom: number;
  pan: { x: number; y: number };
  activeMode: 'view' | 'edit' | 'trim';
  showFilmstrip: boolean;
  showInspector: boolean;

  // Video playback & trim
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  seekTime: number | null;
  trimRange: [number, number]; // [startSec, endSec]

  // Image editing
  editor: EditorState;

  // Sequence Storyboard & Audio Track
  sequence: SequenceClip[];
  audioTrack: AudioTrackConfig | null;

  // Actions
  loadFolder: (path: string) => Promise<void>;
  selectIndex: (index: number) => Promise<void>;
  nextItem: () => Promise<void>;
  prevItem: () => Promise<void>;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoomAndPan: (zoom: number, pan: { x: number; y: number }) => void;
  resetView: () => void;
  setActiveMode: (mode: 'view' | 'edit' | 'trim') => void;
  toggleFilmstrip: () => void;
  toggleInspector: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  setTrimRange: (range: [number, number]) => void;
  updateEditor: (partial: Partial<EditorState>) => void;
  resetEditor: () => void;
  openMediaFile: () => Promise<void>;
  openTargetFile: (filePath: string) => Promise<void>;
  openMediaFolder: () => Promise<void>;

  // Sequence Actions
  addCurrentToSequence: () => void;
  removeClipFromSequence: (id: string) => void;
  moveClipInSequence: (fromIndex: number, toIndex: number) => void;
  clearSequence: () => void;
  setAudioTrack: (track: AudioTrackConfig | null) => void;
  updateAudioVolume: (volume: number) => void;
  setAudioMode: (mode: 'mix' | 'replace') => void;
}

const initialEditorState: EditorState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  blur: 0,
  saturation: 0,
  warmth: 0,
  filter: 'none',
  quality: 90,
  exportFormat: 'same',
  overwrite: false,
  splitPosition: 50,
  previewUrl: null,
};

export const useViewerStore = create<ViewerStore>((set, get) => ({
  folderPath: '',
  items: [],
  currentIndex: 0,
  imageDetail: null,
  videoDetail: null,
  loading: false,
  error: null,

  zoom: 1.0,
  pan: { x: 0, y: 0 },
  activeMode: 'view',
  showFilmstrip: true,
  showInspector: false,

  isPlaying: false,
  currentTime: 0,
  duration: 0,
  seekTime: null,
  trimRange: [0, 0],

  editor: initialEditorState,
  sequence: [],
  audioTrack: null,

  loadFolder: async (path: string) => {
    set({ loading: true, error: null, folderPath: path });
    try {
      const items = await scanFolder(path);
      set({ items, currentIndex: 0, loading: false });
      if (items.length > 0) {
        await get().selectIndex(0);
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  selectIndex: async (index: number) => {
    const { items } = get();
    if (index < 0 || index >= items.length) return;

    const current = items[index];
    set({
      currentIndex: index,
      loading: true,
      error: null,
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      editor: initialEditorState,
      isPlaying: false,
      currentTime: 0,
      seekTime: null,
    });

    try {
      if (current.media_type === 'Video') {
        const videoDetail = await probeVideo(current.path);
        set({
          videoDetail,
          imageDetail: null,
          duration: videoDetail.duration_seconds,
          trimRange: [0, videoDetail.duration_seconds],
          loading: false,
        });
      } else {
        const imageDetail = await loadImageDetail(current.path);
        set({
          imageDetail,
          videoDetail: null,
          loading: false,
        });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  nextItem: async () => {
    const { items, currentIndex } = get();
    if (items.length === 0) return;
    const next = (currentIndex + 1) % items.length;
    await get().selectIndex(next);
  },

  prevItem: async () => {
    const { items, currentIndex } = get();
    if (items.length === 0) return;
    const prev = (currentIndex - 1 + items.length) % items.length;
    await get().selectIndex(prev);
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(zoom, 32.0)) }),
  setPan: (pan) => set({ pan }),
  setZoomAndPan: (zoom, pan) =>
    set({ zoom: Math.max(0.1, Math.min(zoom, 32.0)), pan }),
  resetView: () => set({ zoom: 1.0, pan: { x: 0, y: 0 } }),

  setActiveMode: (activeMode) => set({ activeMode }),
  toggleFilmstrip: () => set((s) => ({ showFilmstrip: !s.showFilmstrip })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  seekTo: (seekTime) => set({ seekTime, currentTime: seekTime }),
  setTrimRange: (trimRange) => set({ trimRange }),

  updateEditor: (partial) =>
    set((s) => ({ editor: { ...s.editor, ...partial } })),
  resetEditor: () => set({ editor: initialEditorState }),

  openTargetFile: async (filePath: string) => {
    try {
      const cleanPath = filePath.replace(/^file:\/\//, '');
      const parentDir = cleanPath.substring(0, cleanPath.lastIndexOf('/')) || '.';
      set({ loading: true, error: null, folderPath: parentDir });

      let items: MediaItem[] = [];
      try {
        items = await scanFolder(parentDir);
      } catch {
        items = [];
      }

      let targetIdx = items.findIndex((it) => it.path === cleanPath || it.path === filePath);
      if (targetIdx === -1) {
        const fileName = cleanPath.split('/').pop() || 'media';
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const isVid = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv'].includes(ext);
        const isSvg = ext === 'svg' || ext === 'svgz';
        const singleItem: MediaItem = {
          path: cleanPath,
          file_name: fileName,
          media_type: isVid ? 'Video' : isSvg ? 'Svg' : 'Image',
          file_size: 0,
        };
        items = [singleItem, ...items];
        targetIdx = 0;
      }

      set({ items, currentIndex: targetIdx, loading: false });
      await get().selectIndex(targetIdx);
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  openMediaFile: async () => {
    try {
      const selectedPath = await openFileDialog();
      if (!selectedPath) return;
      await get().openTargetFile(selectedPath);
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  openMediaFolder: async () => {
    try {
      const selectedDir = await openFolderDialog();
      if (!selectedDir) return;
      await get().loadFolder(selectedDir);
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addCurrentToSequence: () => {
    const { items, currentIndex, duration, trimRange } = get();
    const current = items[currentIndex];
    if (!current) return;
    const isVid = current.media_type === 'Video';
    const newClip: SequenceClip = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      path: current.path,
      fileName: current.file_name,
      duration: isVid ? duration : 3.0,
      trimStart: isVid && trimRange[1] > 0 ? trimRange[0] : 0,
      trimEnd: isVid && trimRange[1] > 0 ? trimRange[1] : (isVid ? duration : 3.0),
      mediaType: current.media_type as 'Image' | 'Video',
    };
    set((s) => ({ sequence: [...s.sequence, newClip] }));
  },

  removeClipFromSequence: (id) =>
    set((s) => ({ sequence: s.sequence.filter((c) => c.id !== id) })),

  moveClipInSequence: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex < 0 || fromIndex >= s.sequence.length) return s;
      if (toIndex < 0 || toIndex >= s.sequence.length) return s;
      const nextSeq = [...s.sequence];
      const [moved] = nextSeq.splice(fromIndex, 1);
      nextSeq.splice(toIndex, 0, moved);
      return { sequence: nextSeq };
    }),

  clearSequence: () => set({ sequence: [] }),

  setAudioTrack: (audioTrack) => set({ audioTrack }),

  updateAudioVolume: (volume) =>
    set((s) => (s.audioTrack ? { audioTrack: { ...s.audioTrack, volume } } : s)),

  setAudioMode: (mode) =>
    set((s) => (s.audioTrack ? { audioTrack: { ...s.audioTrack, mode } } : s)),
}));
