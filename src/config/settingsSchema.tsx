import {
  Monitor,
  Play,
  Layers,
  Power,
  Check,
} from "lucide-react";
import {
  SettingRow,
  Switch,
  Select,
  Range,
  Button,
  type SettingsSectionGroup,
} from "@aerovex/strata-ui";
import type { ViewerConfig } from "../lib/ipc";

export type ConfigUpdater = <K extends keyof ViewerConfig>(
  key: K,
  value: ViewerConfig[K]
) => void;

export interface SettingsSchemaHandlers {
  onSetDefaultViewer?: () => void;
  associated?: boolean;
  onQuit?: () => void;
}

export function getVexviewSettingsSchema(
  config: ViewerConfig,
  updateConfig: ConfigUpdater,
  handlers: SettingsSchemaHandlers = {}
): SettingsSectionGroup[] {
  return [
    {
      label: "System & Integration",
      items: [
        {
          id: "system",
          label: "Desktop Integration",
          description: "Default file associations, background daemon, and autostart",
          icon: <Monitor className="w-4 h-4 text-accent" />,
          keywords: ["system", "daemon", "default", "association", "autostart", "mime"],
          content: (
            <div className="space-y-1">
              <SettingRow
                title="Default System Media Viewer"
                subtitle="Register vexview as the primary application for images, videos, and audio"
              >
                <Button
                  variant={handlers.associated ? "primary" : "secondary"}
                  onClick={handlers.onSetDefaultViewer}
                  className="h-8 px-3 text-xs"
                >
                  {handlers.associated ? (
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      <span>Associated as Default</span>
                    </span>
                  ) : (
                    <span>Set as Default Viewer</span>
                  )}
                </Button>
              </SettingRow>

              <SettingRow
                title="Instant Launch Daemon"
                subtitle="Retain background Unix socket service on window close for sub-15ms startup"
              >
                <Switch
                  checked={config.keep_running_in_background}
                  onCheckedChange={(checked) =>
                    updateConfig("keep_running_in_background", checked)
                  }
                  label="Instant Launch Daemon"
                />
              </SettingRow>

              <SettingRow
                title="Start Service on System Login"
                subtitle="Pre-warm media inspection cache and background daemon during user session start"
              >
                <Switch
                  checked={config.autostart_at_boot}
                  onCheckedChange={(checked) =>
                    updateConfig("autostart_at_boot", checked)
                  }
                  label="Start Service on System Login"
                />
              </SettingRow>
            </div>
          ),
        },
      ],
    },
    {
      label: "Playback & Audio",
      items: [
        {
          id: "playback",
          label: "Media Playback",
          description: "Autoplay behavior, audio volume baseline, and loop playback",
          icon: <Play className="w-4 h-4 text-accent" />,
          keywords: ["video", "audio", "autoplay", "loop", "volume", "sound"],
          content: (
            <div className="space-y-4 pt-1">
              <SettingRow
                title="Auto-play Videos"
                subtitle="Automatically commence video playback upon opening or advancing"
              >
                <Switch
                  checked={config.auto_play_videos}
                  onCheckedChange={(checked) =>
                    updateConfig("auto_play_videos", checked)
                  }
                  label="Auto-play Videos"
                />
              </SettingRow>

              <SettingRow
                title="Loop Video Playback"
                subtitle="Continuously loop video streams seamlessly without stopping"
              >
                <Switch
                  checked={config.loop_videos}
                  onCheckedChange={(checked) =>
                    updateConfig("loop_videos", checked)
                  }
                  label="Loop Video Playback"
                />
              </SettingRow>

              <div className="px-1 py-1">
                <Range
                  label="Default Audio Volume"
                  value={config.default_volume}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onValueChange={(val) =>
                    updateConfig("default_volume", val)
                  }
                />
              </div>

              <SettingRow
                title="Deep Black Background"
                subtitle="Render media canvas with high-contrast obsidian background"
              >
                <Switch
                  checked={config.background_dark}
                  onCheckedChange={(checked) =>
                    updateConfig("background_dark", checked)
                  }
                  label="Deep Black Background"
                />
              </SettingRow>
            </div>
          ),
        },
      ],
    },
    {
      label: "Viewport & Display",
      items: [
        {
          id: "display",
          label: "Display & Navigation",
          description: "Default zoom sizing, carousel filmstrip, and pre-cache memory limit",
          icon: <Layers className="w-4 h-4 text-accent" />,
          keywords: ["zoom", "display", "filmstrip", "cache", "carousel", "navigation"],
          content: (
            <div className="space-y-4 pt-1">
              <SettingRow
                title="Default Zoom Mode"
                subtitle="Initial geometry scaling applied when media is loaded"
              >
                <Select
                  label="Default Zoom Mode"
                  value={config.default_zoom_mode}
                  onValueChange={(val) =>
                    updateConfig(
                      "default_zoom_mode",
                      val as "FitToWindow" | "OriginalSize" | "Stretch"
                    )
                  }
                  options={[
                    { value: "FitToWindow", label: "Fit to Window", subtitle: "Scale down to viewable area" },
                    { value: "OriginalSize", label: "100% 1:1 Pixel Mapping", subtitle: "Native sensor resolution" },
                    { value: "Stretch", label: "Fill Window", subtitle: "Edge-to-edge frame expansion" },
                  ]}
                />
              </SettingRow>

              <SettingRow
                title="Show Thumbnail Filmstrip"
                subtitle="Display bottom thumbnail carousel on initial media launch"
              >
                <Switch
                  checked={config.show_filmstrip}
                  onCheckedChange={(checked) =>
                    updateConfig("show_filmstrip", checked)
                  }
                  label="Show Thumbnail Filmstrip"
                />
              </SettingRow>

              <SettingRow
                title="Continuous Wrap Navigation"
                subtitle="Wrap from the last image to first image when scrolling forward"
              >
                <Switch
                  checked={config.wrap_navigation}
                  onCheckedChange={(checked) =>
                    updateConfig("wrap_navigation", checked)
                  }
                  label="Continuous Wrap Navigation"
                />
              </SettingRow>

              <div className="px-1 py-1">
                <Range
                  label="Image Pre-Cache Capacity"
                  value={config.cache_capacity}
                  min={2}
                  max={50}
                  step={1}
                  format={(v) => `${v} items`}
                  onValueChange={(val) =>
                    updateConfig("cache_capacity", val)
                  }
                />
              </div>
            </div>
          ),
        },
        {
          id: "process",
          label: "Process & Daemon",
          description: "Control execution runtime and terminate background daemon",
          icon: <Power className="w-4 h-4 text-accent" />,
          keywords: ["quit", "exit", "process", "kill", "daemon"],
          content: (
            <div className="space-y-2 py-1">
              <SettingRow
                title="Terminate Background Daemon"
                subtitle="Fully shutdown the Vexview daemon socket and release all shared memory"
              >
                <Button
                  variant="secondary"
                  onClick={handlers.onQuit}
                  className="h-8 px-4 text-xs text-danger hover:bg-danger/10 border-danger/30"
                >
                  Quit Vexview
                </Button>
              </SettingRow>
            </div>
          ),
        },
      ],
    },
  ];
}
