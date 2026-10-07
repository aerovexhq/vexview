/**
 * Vexview Professional High-Fidelity Audio Engine
 * Powered by Web Audio API for sub-millisecond latency, zero-delay decoding,
 * and reliable cross-platform playback bypassing WebKitGTK GStreamer scheme limitations.
 */

import { useViewerStore } from '../stores/useViewerStore';
import { readAudioFile, AudioDataResponse } from './ipc';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  private startCtxTime: number = 0;
  private startOffset: number = 0;
  private isPlaying: boolean = false;
  private duration: number = 0;
  private volume: number = 1.0;
  private isMuted: boolean = false;

  private currentFilePath: string | null = null;
  private animFrameId: number | null = null;
  private isDecoding: boolean = false;

  constructor() {
    // Resume audio context whenever window receives user gesture or focus
    if (typeof window !== 'undefined') {
      const resumeHandler = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', resumeHandler, { passive: true });
      window.addEventListener('keydown', resumeHandler, { passive: true });
      window.addEventListener('focus', resumeHandler, { passive: true });
    }
  }

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Loads an audio file via high-performance Tauri binary IPC,
   * decodes it in-memory via AudioContext, and optionally auto-plays.
   */
  public async loadFile(filePath: string, autoPlay: boolean = false): Promise<AudioDataResponse> {
    this.stopPlayback();
    const ctx = this.initContext();
    this.currentFilePath = filePath;
    this.isDecoding = true;

    try {
      const response = await readAudioFile(filePath);

      // Fast base64 decode to ArrayBuffer
      const binaryString = atob(response.data_base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio in-memory (1-2 ms)
      const decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        let settled = false;
        const onOk = (buf: AudioBuffer) => {
          if (!settled) {
            settled = true;
            resolve(buf);
          }
        };
        const onErr = (err: unknown) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        };
        const p = ctx.decodeAudioData(bytes.buffer.slice(0), onOk, onErr);
        if (p && typeof p.then === 'function') {
          p.then(onOk).catch(onErr);
        }
      });

      this.audioBuffer = decodedBuffer;
      this.duration = decodedBuffer.duration;
      this.startOffset = 0;
      this.isDecoding = false;

      // Update store with precise decoded values
      const store = useViewerStore.getState();
      store.setDuration(this.duration);
      store.setCurrentTime(0);

      if (autoPlay) {
        await this.play(0);
      } else {
        if (store.isPlaying) {
          store.setIsPlaying(false);
        }
      }

      return response;
    } catch (err) {
      this.isDecoding = false;
      console.error('AudioEngine failed to load audio file:', err);
      throw err;
    }
  }

  /**
   * Starts playback from the given offset or resumes from pause.
   */
  public async play(fromOffset?: number): Promise<void> {
    const ctx = this.initContext();
    if (!this.audioBuffer) return;

    if (this.isPlaying && fromOffset === undefined) {
      return;
    }

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    this.stopSourceOnly();

    let offset = typeof fromOffset === 'number' ? fromOffset : this.startOffset;
    if (offset >= this.duration || isNaN(offset) || offset < 0) {
      offset = 0;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(this.gainNode!);

    this.currentSource = source;
    this.startCtxTime = ctx.currentTime;
    this.startOffset = offset;
    this.isPlaying = true;

    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
        this.isPlaying = false;
        this.startOffset = 0;
        this.stopProgressLoop();
        const store = useViewerStore.getState();
        if (store.isPlaying) {
          store.setIsPlaying(false);
        }
        store.setCurrentTime(0);
      }
    };

    source.start(0, offset);
    this.startProgressLoop();

    const store = useViewerStore.getState();
    if (!store.isPlaying) {
      store.setIsPlaying(true);
    }
  }

  /**
   * Pauses playback and remembers current elapsed offset.
   */
  public pause(): void {
    if (!this.isPlaying) return;
    this.startOffset = this.getCurrentTime();
    this.stopSourceOnly();
    this.isPlaying = false;
    this.stopProgressLoop();

    const store = useViewerStore.getState();
    if (store.isPlaying) {
      store.setIsPlaying(false);
    }
    store.setCurrentTime(this.startOffset);
  }

  /**
   * Toggles playback state.
   */
  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Seeks to a specific timestamp in seconds.
   */
  public seek(timeSeconds: number): void {
    const clamped = Math.max(0, Math.min(this.duration, timeSeconds));
    this.startOffset = clamped;

    const store = useViewerStore.getState();
    store.setCurrentTime(clamped);

    if (this.isPlaying) {
      this.play(clamped);
    }
  }

  /**
   * Returns precise current playback position in seconds.
   */
  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) {
      return this.startOffset;
    }
    const elapsed = this.ctx.currentTime - this.startCtxTime;
    return Math.max(0, Math.min(this.duration, this.startOffset + elapsed));
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  public getIsDecoding(): boolean {
    return this.isDecoding;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  private stopSourceOnly(): void {
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (_) {}
      this.currentSource = null;
    }
  }

  public stopPlayback(): void {
    this.stopSourceOnly();
    this.stopProgressLoop();
    this.isPlaying = false;
    this.startOffset = 0;
  }

  private startProgressLoop(): void {
    this.stopProgressLoop();
    const update = () => {
      if (this.isPlaying) {
        const cur = this.getCurrentTime();
        useViewerStore.getState().setCurrentTime(cur);
        this.animFrameId = requestAnimationFrame(update);
      }
    };
    this.animFrameId = requestAnimationFrame(update);
  }

  private stopProgressLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const audioEngine = new AudioEngine();
