import React, { useState, useEffect } from 'react';
import {
  ViewerConfig,
  getViewerConfig,
  saveViewerConfig,
  exitApplication,
  setDefaultMediaViewer,
} from '../lib/ipc';
import { CategorySettingsModal } from '@aerovex/strata-ui';
import { getVexviewSettingsSchema, type ConfigUpdater } from '../config/settingsSchema';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<ViewerConfig>({
    auto_play_videos: true,
    loop_videos: true,
    default_volume: 1.0,
    wrap_navigation: true,
    default_zoom_mode: 'FitToWindow',
    cache_capacity: 10,
    background_dark: true,
    show_filmstrip: true,
    autostart_at_boot: true,
    keep_running_in_background: true,
  });

  const [associated, setAssociated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getViewerConfig().then(setConfig);
    }
  }, [isOpen]);

  const updateConfig: ConfigUpdater = (key, value) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      saveViewerConfig(next);
      return next;
    });
  };

  const handleSetDefaultViewer = async () => {
    await setDefaultMediaViewer();
    setAssociated(true);
    setTimeout(() => setAssociated(false), 3000);
  };

  const handleQuit = async () => {
    await exitApplication();
  };

  const groups = getVexviewSettingsSchema(config, updateConfig, {
    onSetDefaultViewer: handleSetDefaultViewer,
    associated,
    onQuit: handleQuit,
  });

  return (
    <CategorySettingsModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Vexview Preferences"
      groups={groups}
      searchPlaceholder="Search playback, display, and daemon settings..."
      footer={
        <div className="flex items-center justify-between text-[11px] text-muted w-full font-mono">
          <span>Industrial Media Inspector Kernel</span>
          <span className="text-fg">v0.1.0</span>
        </div>
      }
    />
  );
};
