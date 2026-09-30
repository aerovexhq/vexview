import { invoke } from '@tauri-apps/api/core';

export interface MediaItem {
  path: string;
  file_name: string;
  media_type: 'Image' | 'AnimatedImage' | 'Svg' | 'Video' | 'Unknown';
  file_size: number;
  modified?: { secs_since_epoch: number; nanos_since_epoch: number };
}

export interface ImageDetailResponse {
  width: u32;
  height: u32;
  orientation: number;
  make?: string;
  model?: string;
  date_time?: string;
  data_url: string;
}

export type u32 = number;

export interface VideoMetadata {
  duration_seconds: number;
  width: number;
  height: number;
  video_codec?: string;
  audio_codec?: string;
  frame_rate?: number;
  bit_rate?: number;
}

export interface TransformParams {
  path: string;
  rotation: number;
  flip_h: boolean;
  flip_v: boolean;
  crop?: { x: number; y: number; width: number; height: number };
  brightness: number;
  contrast: number;
  blur: number;
  destination?: string;
  format?: string;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function scanFolder(folderPath: string): Promise<MediaItem[]> {
  if (!isTauri) {
    // Development browser mock
    return [
      {
        path: '/mock/mountain_sunset.jpg',
        file_name: 'mountain_sunset.jpg',
        media_type: 'Image',
        file_size: 4820120,
      },
      {
        path: '/mock/cinematic_drone.mp4',
        file_name: 'cinematic_drone.mp4',
        media_type: 'Video',
        file_size: 28410290,
      },
      {
        path: '/mock/vector_diagram.svg',
        file_name: 'vector_diagram.svg',
        media_type: 'Svg',
        file_size: 142100,
      },
    ];
  }
  return await invoke<MediaItem[]>('scan_folder', { folderPath });
}

export async function loadImageDetail(filePath: string): Promise<ImageDetailResponse> {
  if (!isTauri) {
    return {
      width: 3840,
      height: 2160,
      orientation: 1,
      make: 'Sony',
      model: 'ILCE-7RM4',
      date_time: '2026:09:30 14:22:10',
      data_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
    };
  }
  return await invoke<ImageDetailResponse>('load_image_detail', { filePath });
}

export async function getThumbnail(filePath: string, maxSize = 120): Promise<string> {
  if (!isTauri) {
    return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&auto=format&fit=crop&q=60';
  }
  return await invoke<string>('get_thumbnail_base64', { filePath, maxSize });
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  if (!isTauri) {
    return {
      duration_seconds: 142.5,
      width: 3840,
      height: 2160,
      video_codec: 'h264',
      audio_codec: 'aac',
      frame_rate: 60.0,
      bit_rate: 24000000,
    };
  }
  return await invoke<VideoMetadata>('probe_video', { filePath });
}

export async function applyTransforms(req: TransformParams): Promise<string> {
  if (!isTauri) {
    return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80';
  }
  return await invoke<string>('apply_image_transforms', { req });
}

export async function trimVideo(
  input: string,
  output: string,
  startSec: number,
  endSec: number,
): Promise<void> {
  if (!isTauri) return;
  return await invoke<void>('trim_video_clip', {
    input,
    output,
    startSec,
    endSec,
  });
}

export async function exportGif(
  input: string,
  output: string,
  startSec: number,
  durationSec: number,
  fps = 15,
  width = 640,
): Promise<void> {
  if (!isTauri) return;
  return await invoke<void>('export_video_to_gif', {
    input,
    output,
    startSec,
    durationSec,
    fps,
    width,
  });
}
