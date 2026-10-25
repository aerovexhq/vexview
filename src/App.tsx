import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Titlebar } from './components/Titlebar';
import { Viewport } from './components/Viewport';
import { FloatingHud } from './components/FloatingHud';
import { Filmstrip } from './components/Filmstrip';
import { EditorDrawer } from './components/EditorDrawer';
import { VideoTimeline } from './components/VideoTimeline';
import { InspectorModal } from './components/InspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { FileTypeBadge } from './components/FileTypeBadge';
import {
  ShortcutLegendModal,
  useKeyboardShortcuts,
  type ShortcutDefinition,
} from '@aerovex/strata-ui';
import { useViewerStore } from './stores/useViewerStore';
import { getCliOptions, startWindowResize, isWindowMaximized, getMediaServerPort } from './lib/ipc';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import styles from './App.module.css';

export const App: React.FC = () => {
  const {
    loadFolder,
    nextItem,
    prevItem,
    centerView,
    setZoom,
    zoom,
    items,
    currentIndex,
    isPlaying,
    setIsPlaying,
    activeMode,
    setActiveMode,
    toggleFilmstrip,
    toggleInspector,
    openMediaFile,
    openTargetFiles,
    stopAllPlayback,
    copyCurrentToClipboard,
    isSlideshowActive,
    setSlideshow,
    toggleSlideshow,
  } = useViewerStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    isWindowMaximized().then(setIsMaximized).catch(() => {});
    const handleResize = () => {
      isWindowMaximized().then(setIsMaximized).catch(() => {});
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load CLI options or current directory on initial mount
  useEffect(() => {
    getMediaServerPort().catch(() => {});
    getCliOptions()
      .then((opts) => {
        const targets =
          opts.targets && opts.targets.length > 0
            ? opts.targets
            : opts.target
              ? [opts.target]
              : [];
        const loadPromise =
          targets.length > 0 ? openTargetFiles(targets, true) : loadFolder('.');
        loadPromise.finally(() => {
          if (opts.edit) {
            setActiveMode('edit');
          }
          if (opts.slideshow) {
            setSlideshow(true);
          }
        });
      })
      .catch(() => {
        loadFolder('.');
      });
  }, [loadFolder, openTargetFiles, setActiveMode, setSlideshow]);

  // Slideshow auto-advance interval
  useEffect(() => {
    if (!isSlideshowActive) return;
    const interval = setInterval(() => {
      nextItem();
    }, 3500);
    return () => clearInterval(interval);
  }, [isSlideshowActive, nextItem]);

  // Listen to open-settings event from system tray
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('open-settings', () => {
      setIsSettingsOpen(true);
    })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Listen to incoming target files forwarded by CLI single-instance or warm background service
  useEffect(() => {
    let unlistenTarget: (() => void) | undefined;
    listen<{
      target?: string;
      targets?: string[];
      edit?: boolean;
      fullscreen?: boolean;
      slideshow?: boolean;
    }>('cli-open-target', (event) => {
      const payload = event.payload;
      const targets =
        payload.targets && payload.targets.length > 0
          ? payload.targets
          : payload.target
            ? [payload.target]
            : [];
      if (targets.length > 0) {
        openTargetFiles(targets, true);
      }
      if (payload.edit) {
        setActiveMode('edit');
      }
      if (payload.slideshow) {
        setSlideshow(true);
      }
    })
      .then((u) => {
        unlistenTarget = u;
      })
      .catch(() => {});

    return () => {
      if (unlistenTarget) unlistenTarget();
    };
  }, [openTargetFiles, setActiveMode, setSlideshow]);

  // Stop playback when window close is requested by window manager or system
  useEffect(() => {
    let unlistenStop: (() => void) | undefined;
    listen('vexview:stop-playback', () => {
      stopAllPlayback();
    })
      .then((u) => {
        unlistenStop = u;
      })
      .catch(() => {});

    const appWindow = getCurrentWebviewWindow();
    const unlistenClosePromise = appWindow.onCloseRequested(() => {
      stopAllPlayback();
    });

    const handleBeforeUnload = () => {
      stopAllPlayback();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (unlistenStop) unlistenStop();
      unlistenClosePromise.then((u) => u()).catch(() => {});
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [stopAllPlayback]);

  // Support drag-and-drop of multiple files into viewer
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDragOver);

    const appWindow = getCurrentWebviewWindow();
    const unlistenDropPromise = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          openTargetFiles(paths, true);
        }
      }
    });

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDragOver);
      unlistenDropPromise.then((u) => u()).catch(() => {});
    };
  }, [openTargetFiles]);

  const current = items[currentIndex];

  const handleTogglePlay = useCallback(() => {
    if (current?.media_type === 'Video' || current?.media_type === 'Audio') {
      setIsPlaying(!isPlaying);
    }
  }, [current, isPlaying, setIsPlaying]);

  const handleToggleEdit = useCallback(() => {
    if (current?.media_type !== 'Video') {
      setActiveMode(activeMode === 'edit' ? 'view' : 'edit');
    }
  }, [current, activeMode, setActiveMode]);

  const handleToggleTrim = useCallback(() => {
    if (current?.media_type === 'Video' || current?.media_type === 'Audio') {
      setActiveMode(activeMode === 'trim' ? 'view' : 'trim');
    }
  }, [current, activeMode, setActiveMode]);

  const shortcutDefs = useMemo<ShortcutDefinition[]>(
    () => [
      {
        id: 'nav.next',
        category: 'Navigation',
        description: 'Next Media Item',
        defaultKey: 'ArrowRight',
        action: nextItem,
      },
      {
        id: 'nav.prev',
        category: 'Navigation',
        description: 'Previous Media Item',
        defaultKey: 'ArrowLeft',
        action: prevItem,
      },
      {
        id: 'view.center',
        category: 'View',
        description: 'Center and Fit Viewport',
        defaultKey: '0',
        action: centerView,
      },
      {
        id: 'view.zoom_in',
        category: 'View',
        description: 'Zoom In',
        defaultKey: '=',
        action: () => setZoom(zoom * 1.25),
      },
      {
        id: 'view.zoom_out',
        category: 'View',
        description: 'Zoom Out',
        defaultKey: '-',
        action: () => setZoom(zoom * 0.8),
      },
      {
        id: 'play.toggle',
        category: 'Playback',
        description: 'Play / Pause Video or Audio',
        defaultKey: 'Space',
        action: handleTogglePlay,
      },
      {
        id: 'tool.edit',
        category: 'Tools',
        description: 'Toggle Image Annotation Editor',
        defaultKey: 'E',
        action: handleToggleEdit,
      },
      {
        id: 'tool.trim',
        category: 'Tools',
        description: 'Toggle Lossless Stream Trimmer',
        defaultKey: 'T',
        action: handleToggleTrim,
      },
      {
        id: 'view.inspector',
        category: 'View',
        description: 'Toggle Media Inspector Drawer',
        defaultKey: 'I',
        action: toggleInspector,
      },
      {
        id: 'view.filmstrip',
        category: 'View',
        description: 'Toggle Thumbnail Filmstrip',
        defaultKey: 'B',
        action: toggleFilmstrip,
      },
      {
        id: 'view.slideshow',
        category: 'View',
        description: 'Toggle Fullscreen Slideshow',
        defaultKey: 'F5',
        action: toggleSlideshow,
      },
      {
        id: 'file.open',
        category: 'File',
        description: 'Open Media File Dialog',
        defaultKey: 'Mod+O',
        action: openMediaFile,
      },
      {
        id: 'file.copy',
        category: 'File',
        description: 'Copy Media to Clipboard',
        defaultKey: 'Mod+C',
        action: copyCurrentToClipboard,
      },
      {
        id: 'app.preferences',
        category: 'Preferences',
        description: 'Open Preferences Dialog',
        defaultKey: 'Mod+,',
        action: () => setIsSettingsOpen(true),
      },
      {
        id: 'app.shortcuts',
        category: 'Help',
        description: 'Show Keyboard Shortcuts Legend',
        defaultKey: '?',
        action: () => setIsShortcutsOpen((prev) => !prev),
      },
    ],
    [
      nextItem,
      prevItem,
      centerView,
      setZoom,
      zoom,
      handleTogglePlay,
      handleToggleEdit,
      handleToggleTrim,
      toggleInspector,
      toggleFilmstrip,
      toggleSlideshow,
      openMediaFile,
      copyCurrentToClipboard,
    ]
  );

  useKeyboardShortcuts(shortcutDefs);

  return (
    <div className={`${styles.appContainer} ${isMaximized ? styles.maximized : ''}`}>
      {!isMaximized && (
        <>
          <div className={styles.resizeTop} onPointerDown={() => startWindowResize('top')} />
          <div className={styles.resizeBottom} onPointerDown={() => startWindowResize('bottom')} />
          <div className={styles.resizeLeft} onPointerDown={() => startWindowResize('left')} />
          <div className={styles.resizeRight} onPointerDown={() => startWindowResize('right')} />
          <div className={styles.resizeTopLeft} onPointerDown={() => startWindowResize('top-left')} />
          <div className={styles.resizeTopRight} onPointerDown={() => startWindowResize('top-right')} />
          <div className={styles.resizeBottomLeft} onPointerDown={() => startWindowResize('bottom-left')} />
          <div className={styles.resizeBottomRight} onPointerDown={() => startWindowResize('bottom-right')} />
        </>
      )}
      <Titlebar onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className={styles.mainArea}>
        <Viewport />
        <FileTypeBadge />
        <FloatingHud />
        <VideoTimeline />
        <EditorDrawer />
        <InspectorModal />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <ShortcutLegendModal
          open={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
          definitions={shortcutDefs}
          title="Vexview Keyboard Shortcuts"
        />
      </div>
      <Filmstrip />
    </div>
  );
};

export default App;
