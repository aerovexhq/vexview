import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Film,
} from 'lucide-react';
import { HudPill, Button } from '@aerovex/strata-ui';
import { useViewerStore } from '../stores/useViewerStore';

export const FloatingHud: React.FC = () => {
  const {
    items,
    currentIndex,
    nextItem,
    prevItem,
    zoom,
    setZoom,
    centerView,
    showFilmstrip,
    toggleFilmstrip,
    activeMode,
    copyCurrentToClipboard,
  } = useViewerStore();

  const [visible, setVisible] = useState(true);
  const current = items[currentIndex];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handleActivity = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeMode === 'view') {
          setVisible(false);
        }
      }, 2500);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearTimeout(timer);
    };
  }, [activeMode]);

  if (!current || current.media_type === 'Video' || current.media_type === 'Audio') return null;

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <HudPill dragRegion={false} className="gap-1 px-2.5 py-1.5 h-10 select-none shadow-xl border-border/80">
        <Button
          variant="ghost"
          onClick={prevItem}
          title="Previous Item (Left Arrow / [)"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <span className="text-xs font-mono text-muted px-1.5 tabular-nums select-none">
          {currentIndex + 1} / {items.length}
        </span>

        <Button
          variant="ghost"
          onClick={nextItem}
          title="Next Item (Right Arrow / ])"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <Button
          variant="ghost"
          onClick={() => setZoom(zoom * 0.8)}
          title="Zoom Out (-)"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>

        <button
          type="button"
          onClick={centerView}
          title="Click to Center and Fit (0 / F)"
          className="text-xs font-mono text-fg px-1.5 py-0.5 rounded hover:bg-raised transition-colors cursor-pointer tabular-nums select-none"
        >
          {(zoom * 100).toFixed(0)}%
        </button>

        <Button
          variant="ghost"
          onClick={() => setZoom(zoom * 1.25)}
          title="Zoom In (+)"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          onClick={centerView}
          title="Center and Fit (0 / F)"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>

        <div className="h-4 w-[1px] bg-border mx-1" />

        <Button
          variant="ghost"
          onClick={copyCurrentToClipboard}
          title="Copy Image to Clipboard (Ctrl+C)"
          className="h-7 w-7 p-0 justify-center text-muted hover:text-fg"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant={showFilmstrip ? "primary" : "ghost"}
          onClick={toggleFilmstrip}
          title="Toggle Bottom Filmstrip (B)"
          className={`h-7 w-7 p-0 justify-center ${
            showFilmstrip ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
          }`}
        >
          <Film className="w-3.5 h-3.5" />
        </Button>
      </HudPill>
    </div>
  );
};
