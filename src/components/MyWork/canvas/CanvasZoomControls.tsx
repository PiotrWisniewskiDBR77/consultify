/**
 * CanvasZoomControls — unified viewport controls for all canvases.
 *
 * Shared across all canvas tools (mind map, whiteboard, process flow).
 * Provides: zoom in/out, visible zoom level, fit view, fullscreen, optional focus/restore,
 * and a toggle link for opening the full-field mini map.
 */
import {
  Focus,
  Grid3x3,
  Map,
  Maximize,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import React, { useCallback } from 'react';
// ★ Zawsze z barrela 'reactflow' — import z '@reactflow/core' podpina DRUGĄ
//   instancję magazynu i płótno przestaje startować.
import { useReactFlow, useStore } from 'reactflow';

import {
  IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID,
  isIdeaBottomBarUnifiedEnabled,
} from '../../../utils/ideaBottomBarUnifiedFlag';

interface CanvasZoomControlsProps {
  isPolish?: boolean;
  savedViewport?: { x: number; y: number; zoom: number } | null;
  selectedNodeId?: string | null;
  className?: string;
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  /**
   * PF-P3-01: override for the Fit view button's click handler. The default
   * (`fitView()` from `useReactFlow`) only bounds actual React Flow nodes —
   * Process Flow's swimlanes are painted OUTSIDE the node graph (see
   * `LaneSystem`), so a plain `fitView()` can crop an empty/tall lane that
   * has no nodes in it. Hosts with lane-aware (or otherwise custom) bounds
   * pass their own handler here; hosts without one (Mind Map, Whiteboard)
   * omit it and get the plain node-bounds behavior.
   */
  onFitView?: () => void;
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

// Unified with the tool-switcher pill next door (IdeaViewSwitcher): same
// 32px square, same corner radius and same `c-*` tokens, so the two clusters
// read as one connected set instead of two mismatched groups glued together
// (Piotr 2026-07-26: "zrob to na jednej wysokosci i tej samej wielkosci").
const ZoomBtn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-8 w-8 items-center justify-center rounded-hig-xl text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface dark:hover:bg-c-surface-raised active:scale-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
    title={title}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-5 bg-c-border-subtle dark:bg-c-border-subtle mx-0.5" />
);

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
  onFitView,
}) => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  /**
   * ★ Defekt zgłoszony przez Piotra (2026-07-28): „procent nie aktualizuje się
   * przy zoomie kółkiem — pokazywał 100% przy realnym 57%".
   *
   * Przyczyna: poprzednia wersja czytała `getZoom()` PODCZAS renderu. To zwykły
   * odczyt imperatywny — nic go nie subskrybuje, więc pigułka pokazywała skalę
   * z chwili OSTATNIEGO renderu wymuszonego z zewnątrz (zmiana zaznaczenia,
   * przeciągnięcie węzła…), a nie skalę bieżącą. Zmierzone na żywo przed
   * naprawą: Mapa myśli po `fitView` miała realnie 53%, a pasek 100%.
   *
   * `useStore` subskrybuje transform płótna, więc procent idzie za KAŻDĄ zmianą
   * skali — kółkiem, gestem, +/−, fitView. Naprawa jest POZA flagą układu:
   * to skłamana liczba, nie zmiana wyglądu.
   */
  const zoomLevel = useStore((s) => s.transform[2]);
  const bottomBarUnified = isIdeaBottomBarUnifiedEnabled();

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: ZOOM_DURATION });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: ZOOM_DURATION });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    if (onFitView) {
      onFitView();
      return;
    }
    fitView({ padding: FIT_PADDING, duration: ZOOM_DURATION + 80 });
  }, [fitView, onFitView]);

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

  const zoomPercent = `${Math.round((zoomLevel || 1) * 100)}%`;

  return (
    <div className="absolute bottom-3 right-3 z-dropdown pointer-events-auto">
      <div
        className={`flex items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-1 ${className}`}
      >
        {/* Gniazdo przełącznika czterech reprezentacji (flaga `ideaBottomBarUnified`).
            Puste, dopóki `IdeaViewSwitcher` się do niego nie sportaluje; własny
            separator dokłada sam przełącznik, więc pusty węzeł nie zostawia
            sierocej kreski. OFF => gniazda nie ma i układ jest dzisiejszy. */}
        {bottomBarUnified && (
          <div
            id={IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID}
            data-testid={IDEA_BOTTOM_BAR_SWITCHER_SLOT_ID}
            className="flex items-center gap-0.5 empty:hidden"
          />
        )}
        <ZoomBtn onClick={handleZoomOut} title={isPolish ? 'Oddal' : 'Zoom out'}>
          <Minus size={15} />
        </ZoomBtn>
        <div className="min-w-[42px] px-1 text-center text-[11px] font-semibold text-c-text dark:text-c-text">
          {zoomPercent}
        </div>
        <ZoomBtn onClick={handleZoomIn} title={isPolish ? 'Przybliż' : 'Zoom in'}>
          <Plus size={15} />
        </ZoomBtn>
        <Divider />
        {/*
         * PF-P3-01: Fit view MUST be its own, always-visible control next to
         * zoom in/out — it was previously rendered only when the host did NOT
         * pass `onFullscreenToggle`. All three canvas hosts (Mind Map,
         * Whiteboard, Process Flow) always pass `onFullscreenToggle` (it
         * falls back to an internal toggle when the host has no external
         * one), so Fit view was DEAD — permanently replaced by the
         * Fullscreen button, unreachable from this control cluster.
         * `Shift+1` already exists per-canvas as the keyboard shortcut for
         * fit-to-view; the tooltip now names it so the affordance is
         * discoverable from the button itself.
         */}
        <ZoomBtn
          onClick={handleFitView}
          title={isPolish ? 'Dopasuj widok (Shift+1)' : 'Fit view (Shift+1)'}
        >
          <Maximize size={14} />
        </ZoomBtn>
        {onFullscreenToggle && (
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
              className={`flex h-8 w-8 items-center justify-center rounded-hig-xl transition-all duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                snapEnabled
                  ? 'bg-c-surface dark:bg-c-surface-raised text-c-focus'
                  : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface dark:hover:bg-c-surface-raised'
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
            {/* K2 (decyzja D2, rozdz. 03 §7): minimapa jako IKONA, nie tekst
                „Mini mapa" — spójnie z resztą kontrolek rogu, ktore sa ikonami.
                Nazwa idzie do tooltipa i aria-label, stan aktywny podswietla. */}
            <button
              type="button"
              onClick={onToggleMiniMap}
              aria-pressed={showMiniMap}
              className={`flex h-8 w-8 items-center justify-center rounded-hig-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                showMiniMap
                  ? 'bg-c-surface dark:bg-c-surface-raised text-c-text dark:text-c-text'
                  : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface dark:hover:bg-c-surface-raised'
              }`}
              title={
                showMiniMap
                  ? isPolish
                    ? 'Ukryj mini mapę'
                    : 'Hide mini map'
                  : isPolish
                    ? 'Pokaż mini mapę'
                    : 'Show mini map'
              }
              aria-label={
                showMiniMap
                  ? isPolish
                    ? 'Ukryj mini mapę'
                    : 'Hide mini map'
                  : isPolish
                    ? 'Pokaż mini mapę'
                    : 'Show mini map'
              }
            >
              <Map size={14} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasZoomControls;
