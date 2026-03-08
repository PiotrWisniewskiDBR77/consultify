/**
 * CanvasZoomControls — V5-IDEA-45 Unified zoom / focus / fit / restore controls.
 *
 * Shared across all canvas tools (mind map, whiteboard, process flow).
 * Provides: zoom in/out, fit view, focus selected, restore saved viewport.
 */
import { Focus, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import React, { useCallback } from 'react';
import { useReactFlow } from 'reactflow';

interface CanvasZoomControlsProps {
  isPolish?: boolean;
  savedViewport?: { x: number; y: number; zoom: number } | null;
  selectedNodeId?: string | null;
  className?: string;
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

  return (
    <div
      className={`flex items-center gap-0.5 px-1.5 py-1 bg-white/90 dark:bg-navy-900/85 backdrop-blur-md rounded-2xl border border-slate-200/40 dark:border-white/[0.04] shadow-lg ${className}`}
    >
      <ZoomBtn onClick={handleZoomIn} title={isPolish ? 'Przybliż' : 'Zoom in'}>
        <Plus size={15} />
      </ZoomBtn>
      <ZoomBtn onClick={handleZoomOut} title={isPolish ? 'Oddal' : 'Zoom out'}>
        <Minus size={15} />
      </ZoomBtn>
      <Divider />
      <ZoomBtn onClick={handleFitView} title={isPolish ? 'Dopasuj widok' : 'Fit view'}>
        <Maximize2 size={14} />
      </ZoomBtn>
      {selectedNodeId && (
        <ZoomBtn
          onClick={handleFocusSelected}
          title={isPolish ? 'Fokus na zaznaczeniu' : 'Focus selected'}
        >
          <Focus size={14} />
        </ZoomBtn>
      )}
      {savedViewport && (
        <>
          <Divider />
          <ZoomBtn
            onClick={handleRestore}
            title={isPolish ? 'Przywróć zapisany widok' : 'Restore saved viewport'}
          >
            <RotateCcw size={13} />
          </ZoomBtn>
        </>
      )}
    </div>
  );
};

export default CanvasZoomControls;
