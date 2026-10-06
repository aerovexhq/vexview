import { create } from 'zustand';
import {
  MediaItem,
  ImageDetailResponse,
  VideoMetadata,
  AnnotationItem,
  scanFolder,
  loadImageDetail,
  probeVideo,
  openFileDialog,
  openFolderDialog,
  copyImageToClipboard,
} from '../lib/ipc';

export type ActiveSubTool =
  | 'select'
  | 'select_lasso'
  | 'select_polygon'
  | 'crop'
  | 'pen'
  | 'highlighter'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'blur_rect'
  | 'mosaic_rect'
  | 'blur_heavy'
  | 'eraser'
  | 'eyedropper';

export interface ActiveSelection {
  type: 'rect' | 'lasso' | 'polygon';
  points: { x: number; y: number }[];
  box: { x: number; y: number; width: number; height: number };
}

export type CropAspectRatio = 'free' | '1:1' | '16:9' | '9:16' | '4:3' | '3:2' | '21:9';

export interface EditorState {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  crop: { x: number; y: number; width: number; height: number } | null;
  brightness: number;
  contrast: number;
  blur: number;
  saturation: number;
  warmth: number;
  filter: 'none' | 'grayscale' | 'invert' | 'sepia';
  quality: number;
  exportFormat: 'same' | 'png' | 'jpg' | 'webp' | 'bmp' | 'tiff';
  exportScale: number;
  customWidth: number | null;
  customHeight: number | null;
  overwrite: boolean;
  splitPosition: number;
  previewUrl: string | null;
}

export interface VideoStudioParams {
  speed: number;
  crop: { x: number; y: number; width: number; height: number } | null;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  muteAudio: boolean;
  volume: number;
  brightness: number;
  contrast: number;
  saturation: number;
  gamma: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  reverse: boolean;
  timecodeBurnIn: boolean;
  telemetryText: string;
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
  isSlideshowActive: boolean;

  // Video playback & trim
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  seekTime: number | null;
  trimRange: [number, number];

  // Image editing (parametric)
  editor: EditorState;

  // Annotations & Tools
  activeSubTool: ActiveSubTool;
  activeSelection: ActiveSelection | null;
  strokeColor: [number, number, number, number];
  fillColor: [number, number, number, number] | null;
  strokeWidth: number;
  fontSize: number;
  badgeNumber: number;
  annotations: AnnotationItem[];
  annotationHistory: AnnotationItem[][];
  annotationRedoHistory: AnnotationItem[][];

  // Crop & Straighten
  cropBox: { x: number; y: number; width: number; height: number } | null;
  cropAspectRatio: CropAspectRatio;
  straightenAngle: number;

  // Video Studio Parameters
  videoParams: VideoStudioParams;

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
  centerView: () => void;
  setCenterViewAction: (fn: (() => void) | null) => void;
  centerViewAction: (() => void) | null;
  setActiveMode: (mode: 'view' | 'edit' | 'trim') => void;
  toggleFilmstrip: () => void;
  toggleInspector: () => void;
  setSlideshow: (active: boolean) => void;
  toggleSlideshow: () => void;
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
  copyNotice: boolean;
  copyCurrentToClipboard: () => Promise<void>;

  // Annotation Actions
  setActiveSubTool: (tool: ActiveSubTool) => void;
  setActiveSelection: (selection: ActiveSelection | null) => void;
  applyBlurToSelection: (blurType?: 'blur_rect' | 'mosaic_rect' | 'blur_heavy') => void;
  setStrokeColor: (color: [number, number, number, number]) => void;
  setFillColor: (color: [number, number, number, number] | null) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setBadgeNumber: (num: number) => void;
  incrementBadgeNumber: () => void;
  addAnnotation: (item: AnnotationItem) => void;
  undoAnnotation: () => void;
  redoAnnotation: () => void;
  clearAnnotations: () => void;
  setAnnotations: (items: AnnotationItem[]) => void;

  // Crop Actions
  setCropBox: (box: { x: number; y: number; width: number; height: number } | null) => void;
  setCropAspectRatio: (ratio: CropAspectRatio) => void;
  setStraightenAngle: (angle: number) => void;

  // Video Studio Actions
  updateVideoParams: (partial: Partial<VideoStudioParams>) => void;
  resetVideoParams: () => void;

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
  crop: null,
  brightness: 0,
  contrast: 0,
  blur: 0,
  saturation: 0,
  warmth: 0,
  filter: 'none',
  quality: 90,
  exportFormat: 'same',
  exportScale: 1.0,
  customWidth: null,
  customHeight: null,
  overwrite: false,
  splitPosition: 50,
  previewUrl: null,
};

const initialVideoParams: VideoStudioParams = {
  speed: 1.0,
  crop: null,
  rotation: 0,
  flipH: false,
  flipV: false,
  muteAudio: false,
  volume: 1.0,
  brightness: 0.0,
  contrast: 1.0,
  saturation: 1.0,
  gamma: 1.0,
  grayscale: false,
  sepia: false,
  invert: false,
  reverse: false,
  timecodeBurnIn: false,
  telemetryText: '',
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
  isSlideshowActive: false,

  isPlaying: false,
  currentTime: 0,
  duration: 0,
  seekTime: null,
  trimRange: [0, 0],

  editor: initialEditorState,

  activeSubTool: 'select',
  activeSelection: null,
  strokeColor: [239, 68, 68, 255], // default red
  fillColor: null,
  strokeWidth: 4,
  fontSize: 18,
  badgeNumber: 1,
  annotations: [],
  annotationHistory: [],
  annotationRedoHistory: [],

  cropBox: null,
  cropAspectRatio: 'free',
  straightenAngle: 0,

  videoParams: initialVideoParams,

  sequence: [],
  audioTrack: null,
  centerViewAction: null,

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
      annotations: [],
      annotationHistory: [],
      annotationRedoHistory: [],
      cropBox: null,
      straightenAngle: 0,
      videoParams: initialVideoParams,
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
    set({ zoom: Math.max(0.05, Math.min(zoom, 32.0)), pan }),
  setCenterViewAction: (centerViewAction) => set({ centerViewAction }),
  centerView: () => {
    const fn = get().centerViewAction;
    if (fn) {
      fn();
    } else {
      set({ zoom: 1.0, pan: { x: 0, y: 0 } });
    }
  },
  resetView: () => {
    const fn = get().centerViewAction;
    if (fn) {
      fn();
    } else {
      set({ zoom: 1.0, pan: { x: 0, y: 0 } });
    }
  },

  setActiveMode: (activeMode) => set({ activeMode }),
  toggleFilmstrip: () => set((s) => ({ showFilmstrip: !s.showFilmstrip })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
  setSlideshow: (isSlideshowActive) => set({ isSlideshowActive }),
  toggleSlideshow: () => set((s) => ({ isSlideshowActive: !s.isSlideshowActive })),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  seekTo: (seekTime) => set({ seekTime, currentTime: seekTime }),
  setTrimRange: (trimRange) => set({ trimRange }),

  updateEditor: (partial) =>
    set((s) => ({ editor: { ...s.editor, ...partial } })),
  resetEditor: () => set({ editor: initialEditorState }),

  copyNotice: false,
  copyCurrentToClipboard: async () => {
    const { items, currentIndex, activeMode, editor } = get();
    const current = items[currentIndex];
    if (!current || current.media_type === 'Video') return;
    try {
      await copyImageToClipboard(
        current.path,
        activeMode === 'edit' && editor.previewUrl ? editor.previewUrl : undefined,
      );
      set({ copyNotice: true });
      setTimeout(() => {
        set({ copyNotice: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  },

  // Annotation Actions
  setActiveSubTool: (activeSubTool) => set({ activeSubTool }),
  setActiveSelection: (activeSelection) => set({ activeSelection }),
  applyBlurToSelection: (blurType = 'blur_rect') => {
    const { activeSelection, addAnnotation, setActiveSelection } = get();
    if (!activeSelection) return;
    const { box, points, type } = activeSelection;
    if (box.width <= 0 || box.height <= 0) return;

    const polyPts = type !== 'rect' && points.length >= 3 ? points : undefined;
    if (blurType === 'mosaic_rect') {
      addAnnotation({
        type: 'MosaicRect',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        block_size: 14,
        polygon_points: polyPts,
      });
    } else if (blurType === 'blur_heavy') {
      addAnnotation({
        type: 'BlurRect',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        sigma: 28.0,
        polygon_points: polyPts,
      });
    } else {
      addAnnotation({
        type: 'BlurRect',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        sigma: 12.0,
        polygon_points: polyPts,
      });
    }
    setActiveSelection(null);
  },
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth: Math.max(1, strokeWidth) }),
  setFontSize: (fontSize) => set({ fontSize: Math.max(8, fontSize) }),
  setBadgeNumber: (badgeNumber) => set({ badgeNumber }),
  incrementBadgeNumber: () => set((s) => ({ badgeNumber: s.badgeNumber + 1 })),

  addAnnotation: (item) =>
    set((s) => ({
      annotationHistory: [...s.annotationHistory, s.annotations],
      annotationRedoHistory: [],
      annotations: [...s.annotations, item],
    })),

  undoAnnotation: () =>
    set((s) => {
      if (s.annotationHistory.length === 0) return s;
      const prev = s.annotationHistory[s.annotationHistory.length - 1];
      const newHistory = s.annotationHistory.slice(0, -1);
      return {
        annotations: prev,
        annotationHistory: newHistory,
        annotationRedoHistory: [...s.annotationRedoHistory, s.annotations],
      };
    }),

  redoAnnotation: () =>
    set((s) => {
      if (s.annotationRedoHistory.length === 0) return s;
      const next = s.annotationRedoHistory[s.annotationRedoHistory.length - 1];
      const newRedo = s.annotationRedoHistory.slice(0, -1);
      return {
        annotations: next,
        annotationHistory: [...s.annotationHistory, s.annotations],
        annotationRedoHistory: newRedo,
      };
    }),

  clearAnnotations: () =>
    set((s) => ({
      annotationHistory: [...s.annotationHistory, s.annotations],
      annotationRedoHistory: [],
      annotations: [],
    })),

  setAnnotations: (annotations) => set({ annotations }),

  // Crop Actions
  setCropBox: (cropBox) => set({ cropBox }),
  setCropAspectRatio: (cropAspectRatio) => set({ cropAspectRatio }),
  setStraightenAngle: (straightenAngle) => set({ straightenAngle }),

  // Video Studio Actions
  updateVideoParams: (partial) =>
    set((s) => ({ videoParams: { ...s.videoParams, ...partial } })),
  resetVideoParams: () => set({ videoParams: initialVideoParams }),

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
