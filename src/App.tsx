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
import { getCliOptions } from './lib/ipc';
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
    openTargetFile,
    copyCurrentToClipboard,
    isSlideshowActive,
    setSlideshow,
    toggleSlideshow,
  } = useViewerStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load CLI options or current directory on initial mount
  useEffect(() => {
    getCliOptions()
      .then((opts) => {
        const loadPromise = opts.target
          ? openTargetFile(opts.target)
          : loadFolder('.');
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
  }, [loadFolder, openTargetFile, setActiveMode, setSlideshow]);

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
    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('open-settings', () => {
          setIsSettingsOpen(true);
        }).then((u) => {
          unlisten = u;
        });
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

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
          if (current?.media_type === 'Video') {
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
          if (current?.media_type === 'Video') {
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
    <div className={styles.appContainer}>
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
