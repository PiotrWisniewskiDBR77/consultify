/**
 * CanvasZoomControls — unified viewport controls for all canvases.
 *
 * Shared across all canvas tools (mind map, whiteboard, process flow).
 * Provides: zoom in/out, visible zoom level, fit view, fullscreen, optional focus/restore,
 * and a toggle link for opening the full-field mini map.
 */
import { Focus, Grid3x3, Maximize2, Minimize2, Minus, Plus, RotateCcw } from 'lucide-react';
import React, { useCallback } from 'react';
import { useReactFlow } from 'reactflow';

interface CanvasZoomControlsProps {
  isPolish?: boolean;
  savedViewport?: { x: number; y: number; zoom: number } | null;
  selectedNodeId?: string | null;
  className?: string;
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
  /** When provided, Maximize2 toggles fullscreen instead of fit view */
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  /**
   * M06 Fala 3.1 (mind map only): when `onToggleSnap` is provided, render a
   * snap-to-grid toggle button. Other canvases omit these props entirely, so
   * the control never appears for them.
   */
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
}

const ZOOM_DURATION = 220;
const FIT_PADDING = 0.3;

const ZoomBtn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] active:scale-95 transition-all duration-150"
    title={title}
  >
    {children}
  </button>
);

const Divider = () => <div className="w-px h-5 bg-slate-200/60 dark:bg-white/[0.06] mx-0.5" />;

export const CanvasZoomControls: React.FC<CanvasZoomControlsProps> = ({
  isPolish,
  savedViewport,
  selectedNodeId,
  className = '',
  showMiniMap = false,
  onToggleMiniMap,
  onFullscreenToggle,
  isFullscreen = false,
  snapEnabled = false,
  onToggleSnap,
}) => {
  const { zoomIn, zoomOut, fitView, setViewport, getZoom } = useReactFlow();

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: ZOOM_DURATION });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: ZOOM_DURATION });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ padding: FIT_PADDING, duration: ZOOM_DURATION + 80 });
  }, [fitView]);

  const handleFocusSelected = useCallback(() => {
    if (!selectedNodeId) return;
    fitView({
      nodes: [{ id: selectedNodeId } as any],
      padding: 0.5,
      duration: ZOOM_DURATION + 160,
    });
  }, [fitView, selectedNodeId]);

  const handleRestore = useCallback(() => {
    if (!savedViewport) return;
    setViewport(savedViewport, { duration: ZOOM_DURATION + 80 });
  }, [savedViewport, setViewport]);

  const zoomPercent = `${Math.round(getZoom() * 100)}%`;

  return (
    <div className="absolute bottom-3 right-3 z-dropdown pointer-events-auto">
      <div
        className={`flex items-center gap-0.5 px-1.5 py-1 bg-white/90 dark:bg-navy-950/90 backdrop-blur-md dark:backdrop-blur-xl rounded-2xl border border-slate-200/40 dark:border-white/[0.06] shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.35)] ${className}`}
      >
        <ZoomBtn onClick={handleZoomOut} title={isPolish ? 'Oddal' : 'Zoom out'}>
          <Minus size={15} />
        </ZoomBtn>
        <div className="min-w-[48px] px-1 text-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {zoomPercent}
        </div>
        <ZoomBtn onClick={handleZoomIn} title={isPolish ? 'Przybliż' : 'Zoom in'}>
          <Plus size={15} />
        </ZoomBtn>
        <Divider />
        {onFullscreenToggle ? (
          <ZoomBtn
            onClick={onFullscreenToggle}
            title={
              isFullscreen
                ? isPolish
                  ? 'Wyłącz pełny ekran'
                  : 'Exit fullscreen'
                : isPolish
                  ? 'Pełny ekran'
                  : 'Fullscreen'
            }
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ZoomBtn>
        ) : (
          <ZoomBtn onClick={handleFitView} title={isPolish ? 'Dopasuj widok' : 'Fit view'}>
            <Maximize2 size={14} />
          </ZoomBtn>
        )}
        {selectedNodeId && (
          <ZoomBtn
            onClick={handleFocusSelected}
            title={isPolish ? 'Fokus na zaznaczeniu' : 'Focus selected'}
          >
            <Focus size={14} />
          </ZoomBtn>
        )}
        {savedViewport && (
          <ZoomBtn
            onClick={handleRestore}
            title={isPolish ? 'Przywróć zapisany widok' : 'Restore saved viewport'}
          >
            <RotateCcw size={13} />
          </ZoomBtn>
        )}
        {onToggleSnap && (
          <>
            <Divider />
            <button
              type="button"
              onClick={onToggleSnap}
              aria-pressed={snapEnabled}
              className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 ${
                snapEnabled
                  ? 'bg-c-surface-raised text-c-focus dark:bg-c-surface'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.06]'
              }`}
              title={
                snapEnabled
                  ? isPolish
                    ? 'Wyłącz przyciąganie do siatki'
                    : 'Disable snap to grid'
                  : isPolish
                    ? 'Przyciągaj do siatki'
                    : 'Snap to grid'
              }
            >
              <Grid3x3 size={14} />
            </button>
          </>
        )}
        {onToggleMiniMap && (
          <>
            <Divider />
            <button
              type="button"
              onClick={onToggleMiniMap}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              title={
                showMiniMap
                  ? isPolish
                    ? 'Ukryj mini mapę'
                    : 'Hide mini map'
                  : isPolish
                    ? 'Pokaż mini mapę'
                    : 'Show mini map'
              }
            >
              {showMiniMap
                ? isPolish
                  ? 'Ukryj mini mapę'
                  : 'Hide mini map'
                : isPolish
                  ? 'Mini mapa'
                  : 'Mini map'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasZoomControls;
