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

interface EditorState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  blur: number;
  splitPosition: number; // 0 to 100% for before/after comparison
  previewUrl: string | null;
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
  openMediaFolder: () => Promise<void>;
}

const initialEditorState: EditorState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  blur: 0,
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

  openMediaFile: async () => {
    try {
      const selectedPath = await openFileDialog();
      if (!selectedPath) return;

      const parentDir = selectedPath.substring(0, selectedPath.lastIndexOf('/')) || '.';
      set({ loading: true, error: null, folderPath: parentDir });
      const items = await scanFolder(parentDir);
      const targetIdx = items.findIndex((it) => it.path === selectedPath);
      set({ items, currentIndex: targetIdx >= 0 ? targetIdx : 0 });
      await get().selectIndex(targetIdx >= 0 ? targetIdx : 0);
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
}));
