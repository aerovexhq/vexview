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
import { getCliTarget } from './lib/ipc';
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
  } = useViewerStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load CLI target or current directory on initial mount
  useEffect(() => {
    getCliTarget()
      .then((target) => {
        if (target) {
          openTargetFile(target);
        } else {
          loadFolder('.');
        }
      })
      .catch(() => {
        loadFolder('.');
      });
  }, [loadFolder, openTargetFile]);

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
        case 'Escape':
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
