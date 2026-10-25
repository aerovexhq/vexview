import { bridge as strataBridge } from "@aerovex/strata-bridge";
import type {
  MediaItem,
  ImageDetailResponse,
  ViewerConfig,
} from "../lib/ipc";

/**
 * Enterprise IPC transport layer for Vexview.
 * Built on @aerovex/strata-bridge for cross-platform IPC dispatch.
 */
export class VexviewBridge {
  static get platform() {
    return strataBridge.platform;
  }

  static get isNative() {
    return strataBridge.isNative;
  }

  static async invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
    return strataBridge.invoke<T>(command, args);
  }

  static listen<T = unknown>(event: string, handler: (payload: T) => void): () => void {
    return strataBridge.listen<T>(event, handler);
  }

  static async scanFolder(folderPath: string): Promise<MediaItem[]> {
    return strataBridge.invoke<MediaItem[]>("scan_folder", { folderPath });
  }

  static async loadImageDetail(filePath: string): Promise<ImageDetailResponse> {
    return strataBridge.invoke<ImageDetailResponse>("load_image_detail", { filePath });
  }

  static async getViewerConfig(): Promise<ViewerConfig> {
    return strataBridge.invoke<ViewerConfig>("get_viewer_config");
  }

  static async saveViewerConfig(config: ViewerConfig): Promise<void> {
    return strataBridge.invoke<void>("save_viewer_config", { config });
  }

  static async setDefaultMediaViewer(): Promise<void> {
    return strataBridge.invoke<void>("set_default_media_viewer");
  }

  static async exitApplication(): Promise<void> {
    return strataBridge.invoke<void>("exit_application");
  }
}

export const bridge = VexviewBridge;
