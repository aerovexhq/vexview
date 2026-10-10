import React, { useState, useEffect } from 'react';
import { Titlebar } from './components/Titlebar';
import { Viewport } from './components/Viewport';
import { FloatingHud } from './components/FloatingHud';
import { Filmstrip } from './components/Filmstrip';
import { EditorDrawer } from './components/EditorDrawer';
import { VideoTimeline } from './components/VideoTimeline';
import { InspectorModal } from './components/InspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { FileTypeBadge } from './components/FileTypeBadge';
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
    resetView,
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

  // Global tactile keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copyCurrentToClipboard();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        openMediaFile();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      const current = items[currentIndex];

      switch (e.key) {
        case 'ArrowRight':
        case ']':
          nextItem();
          break;
        case 'ArrowLeft':
        case '[':
          prevItem();
          break;
        case ' ':
          if (current?.media_type === 'Video' || current?.media_type === 'Audio') {
            e.preventDefault();
            setIsPlaying(!isPlaying);
          }
          break;
        case '0':
        case 'f':
        case 'F':
          centerView();
          break;
        case '+':
        case '=':
          setZoom(zoom * 1.25);
          break;
        case '-':
        case '_':
          setZoom(zoom * 0.8);
          break;
        case 'e':
        case 'E':
          if (current?.media_type !== 'Video') {
            setActiveMode(activeMode === 'edit' ? 'view' : 'edit');
          }
          break;
        case 't':
        case 'T':
          if (current?.media_type === 'Video' || current?.media_type === 'Audio') {
            setActiveMode(activeMode === 'trim' ? 'view' : 'trim');
          }
          break;
        case 'i':
        case 'I':
          toggleInspector();
          break;
        case 'b':
        case 'B':
          toggleFilmstrip();
          break;
        case 's':
        case 'S':
        case 'F5':
          toggleSlideshow();
          break;
        case 'Escape':
          if (isSlideshowActive) {
            setSlideshow(false);
          }
          setActiveMode('view');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    nextItem,
    prevItem,
    resetView,
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
    toggleSlideshow,
    isSlideshowActive,
    setSlideshow,
  ]);

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
      </div>
      <Filmstrip />
    </div>
  );
};

export default App;
