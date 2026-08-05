/**
 * ExecutiveModuleShell — composed three-zone layout for executive
 * modules (Wordy / Tabele / Prezentacje).
 *
 * MELS § 2 (Zones A/B/C/D) + EPIC-T16 D1.
 *
 * The shell is intentionally module-agnostic. Modules pass:
 *   - `topBar` chips + presence
 *   - `leftRail` content (outline / list)
 *   - `rightRail` tools + panel content (per active tool)
 *   - `canvas` — the Word-document idiom authoring surface
 *
 * State machinery:
 *   - Rail collapse + width persistence: `useRailState`
 *   - Keyboard shortcuts: `useMelsShortcuts`
 *
 * The shell deliberately does NOT introduce per-module logic — that
 * belongs to the module-specific wrappers (e.g. `TabeleArtifactView`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type TopBarChipDescriptor } from './ChipDescriptor';
import { LeftRail } from './LeftRail';
import { RightRail, type RightRailToolDescriptor } from './RightRail';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { buildMelsShortcuts, useMelsShortcuts } from './shortcuts';
import { TopBar } from './TopBar';
import { useRailState } from './useRailState';

export interface ExecutiveModuleShellProps {
  /** Stable identifier — gates rail-state persistence. */
  moduleKey: string;

  /** Top bar configuration. */
  moduleLabel: string;
  title: string;
  onTitleChange?: (next: string) => void;
  onBack?: () => void;
  backLabel?: string;
  topBarChips: TopBarChipDescriptor[];
  presenceSlot?: React.ReactNode;
  /**
   * Optional top-bar identity/command slots (editor-shell-canon Menu 1). All
   * ADDITIVE — existing adopters omit them and the top bar is byte-identical.
   *   - `topBarTitleIconSlot`     → between breadcrumb chevron and title.
   *   - `topBarTitleTrailingSlot` → right after the title (stage chip / save).
   *   - `topBarPrimaryActionSlot` → prominent action in the right cluster.
   *   - `topBarLeadingActionSlot` → FIRST inside the chip cluster, ahead of
   *     every chip (e.g. a "Plik ▾" File menu — Word convention: File is
   *     leftmost). Shares the chip row's width budget rather than adding a
   *     separate flex item (see `TopBar.tsx`'s own doc for why that matters).
   */
  topBarTitleIconSlot?: React.ReactNode;
  topBarTitleTrailingSlot?: React.ReactNode;
  topBarPrimaryActionSlot?: React.ReactNode;
  topBarLeadingActionSlot?: React.ReactNode;
  /**
   * Opcjonalne SCALENIE górnego paska w jedną linię — DOM id węzła, do którego
   * `TopBar` ma przenieść portalem swój klaster poleceń zamiast renderować
   * własny rząd (patrz `TopBar.mergeSlotId`). ADDITIVE: pomiń dla domyślnego
   * układu; gdy węzła nie ma w DOM, pasek renderuje się bez zmian.
   */
  topBarMergeSlotId?: string;
  /**
   * Optional second command bar (Menu 3) rendered as a full-width row directly
   * BELOW the top bar. ADDITIVE — omit to keep the single-row top bar. The node
   * brings its own border/height/background.
   */
  secondBar?: React.ReactNode;

  /** Left rail configuration. */
  leftRailTitle?: string;
  leftRailToolsSlot?: React.ReactNode;
  leftRailBottomSlot?: React.ReactNode;
  leftRailContent: React.ReactNode;

  /** Right rail configuration. */
  rightRailTools: RightRailToolDescriptor[];
  /** Caller-supplied renderer for active tool — returns panel content. */
  renderRightRailPanel?: (activeToolId: string | null) => React.ReactNode;
  /**
   * Optional CONTROLLED active right-rail tool. When provided the shell
   * renders this tool instead of its internal state, and reports user
   * selections via `onActiveRightRailToolChange`. ADDITIVE + backward
   * compatible: callers that omit both keep the shell's own internal
   * uncontrolled state (today's behaviour for every existing adopter).
   */
  activeRightRailToolId?: string | null;
  onActiveRightRailToolChange?: (toolId: string | null) => void;
  /**
   * Czy prawy pasek ikon wolno schować do 16-pikselowego słupka (domyślnie
   * TAK = dzisiejsze zachowanie wszystkich modułów). `false` → pasek ikon jest
   * ZAWSZE widoczny. ADDITIVE — pomijające go powłoki nie zmieniają się.
   */
  rightRailCollapsible?: boolean;

  /** Center canvas. */
  canvas: React.ReactNode;

  /**
   * Center archetype (editor-shell-canon — EditorShell W pattern).
   *   - `'chrome'` (default): left rail lives in the chrome column beside
   *     the canvas — today's behaviour (Document Studio / Deck Builder).
   *   - `'canvas'`: Miro-style. The columnar left rail is suppressed and
   *     `floatingLeftRail` floats ABOVE the canvas instead; `canvasOverlaySlot`
   *     (zoom / minimap) pins to a corner.
   * ADDITIVE — existing callers omit this and keep `'chrome'` unchanged.
   */
  centerMode?: 'chrome' | 'canvas';
  /**
   * `centerMode==='canvas'` only: floating tool rail (cursor / shapes /
   * undo / zoom) rendered ABSOLUTELY over the canvas, not in a column.
   */
  floatingLeftRail?: React.ReactNode;
  /**
   * `centerMode==='canvas'` only: floating zoom / minimap overlay pinned
   * to the bottom-right corner of the canvas.
   */
  canvasOverlaySlot?: React.ReactNode;
  /**
   * Unified AI entry slot — "Discuss with Teresa". Rendered as a docked
   * aside on the right of the shell body (canonises what Deck does today
   * via a bespoke `<aside>`). Works in both center modes; omit to hide.
   */
  aiEntrySlot?: React.ReactNode;

  /** Optional shortcut handlers (run / agent / command palette). */
  onRunPrimary?: () => void;
  onToggleAgent?: () => void;
  onOpenCommandPalette?: () => void;
  /**
   * When supplied, the shell calls this BEFORE opening the built-in
   * shortcut-help modal. Useful for analytics or for hosts that want
   * to drive their own modal. Returning `false` cancels the built-in
   * modal.
   */
  onOpenShortcutHelp?: () => boolean | void;
  /**
   * Localised strings for the shortcut-help modal. Caller may also
   * pass `null` for `helpModalTitle` to disable the built-in modal
   * entirely (e.g. when supplying their own via `onOpenShortcutHelp`).
   */
  helpModalTitle?: string | null;
  helpModalDescription?: string;

  /** Defaults forwarded to `useRailState`. */
  defaultLeftCollapsed?: boolean;
  defaultRightCollapsed?: boolean;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  /** Persist rail state to localStorage (default: true). */
  persistRailState?: boolean;

  /** Optional className for the outermost shell. */
  className?: string;

  /** Optional `data-testid` override. */
  testId?: string;
}

export const ExecutiveModuleShell: React.FC<ExecutiveModuleShellProps> = ({
  moduleKey,
  moduleLabel,
  title,
  onTitleChange,
  onBack,
  backLabel,
  topBarChips,
  presenceSlot,
  topBarTitleIconSlot,
  topBarTitleTrailingSlot,
  topBarPrimaryActionSlot,
  topBarMergeSlotId,
  topBarLeadingActionSlot,
  secondBar,
  leftRailTitle,
  leftRailToolsSlot,
  leftRailBottomSlot,
  leftRailContent,
  rightRailTools,
  renderRightRailPanel,
  activeRightRailToolId,
  onActiveRightRailToolChange,
  rightRailCollapsible = true,
  canvas,
  centerMode = 'chrome',
  floatingLeftRail,
  canvasOverlaySlot,
  aiEntrySlot,
  onRunPrimary,
  onToggleAgent,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  helpModalTitle,
  helpModalDescription,
  defaultLeftCollapsed,
  defaultRightCollapsed,
  defaultLeftWidth,
  defaultRightWidth,
  persistRailState = true,
  className,
  testId,
}) => {
  const rail = useRailState({
    moduleKey,
    defaultLeftCollapsed,
    defaultRightCollapsed,
    defaultLeftWidth,
    defaultRightWidth,
    ephemeral: !persistRailState,
  });

  const [internalActiveToolId, setInternalActiveToolId] = useState<string | null>(null);
  // Controlled when `activeRightRailToolId` is supplied (undefined = uncontrolled).
  const isRailControlled = activeRightRailToolId !== undefined;
  const activeToolId = isRailControlled ? activeRightRailToolId! : internalActiveToolId;
  const setActiveToolId = useCallback(
    (next: string | null) => {
      if (!isRailControlled) setInternalActiveToolId(next);
      onActiveRightRailToolChange?.(next);
    },
    [isRailControlled, onActiveRightRailToolChange]
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const builtInModalEnabled = helpModalTitle !== null;

  const handleOpenHelp = useCallback(() => {
    const callerVerdict = onOpenShortcutHelp?.();
    if (callerVerdict === false) return;
    if (builtInModalEnabled) setHelpOpen(true);
  }, [onOpenShortcutHelp, builtInModalEnabled]);

  const shortcuts = useMemo(
    () =>
      buildMelsShortcuts({
        onToggleLeftRail: rail.toggleLeft,
        onOpenHelp: handleOpenHelp,
        onOpenCommandPalette,
        onRunPrimary,
        onToggleAgent,
      }),
    [rail.toggleLeft, handleOpenHelp, onOpenCommandPalette, onRunPrimary, onToggleAgent]
  );

  useMelsShortcuts(shortcuts);

  const panelContent = useMemo(
    () => (renderRightRailPanel ? renderRightRailPanel(activeToolId) : null),
    [renderRightRailPanel, activeToolId]
  );

  // Szerokosc rynny pod plywajacy lewy rail. Mierzona, nie zgadywana: rail
  // zmienia szerokosc (popovery, inny zestaw narzedzi), a przede wszystkim
  // pozycjonuje sie `position: fixed` wzgledem plotna — czyli WYCHODZI poza
  // swoje opakowanie w drzewie. Zmierzenie opakowania dawaloby zero i rynna
  // bylaby pozorna. Liczymy realny prawy brzeg railа wzgledem lewej krawedzi
  // plotna.
  const leftRailRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const [railGutter, setRailGutter] = useState(0);
  useEffect(() => {
    if (!floatingLeftRail) {
      setRailGutter(0);
      return;
    }
    let zywy = true;
    const zmierz = () => {
      if (!zywy) return;
      const plotno = canvasRef.current;
      if (!plotno) return;
      // Rail bywa renderowany przez `createPortal` do document.body (tak robi
      // CanvasLeftToolbar), wiec NIE jest potomkiem swojego opakowania i pomiar
      // po drzewie zwracalby zero. Szukamy go po jawnym atrybucie-kontrakcie.
      const rail = document.querySelector<HTMLElement>('[data-mels-floating-rail-surface]');
      if (!rail) return;
      const rr = rail.getBoundingClientRect();
      if (rr.width === 0) return;
      const pr = plotno.getBoundingClientRect();
      setRailGutter(Math.max(0, Math.ceil(rr.right - pr.left + 8)));
    };
    zmierz();
    const obs = new ResizeObserver(zmierz);
    const rail = document.querySelector<HTMLElement>('[data-mels-floating-rail-surface]');
    if (rail) obs.observe(rail);
    if (canvasRef.current) obs.observe(canvasRef.current);
    // Rail dolicza swoja pozycje po pierwszym pomiarze plotna — jedno domkniecie
    // po nastepnej klatce wystarcza, zeby rynna zgadzala sie od razu.
    const id = requestAnimationFrame(zmierz);
    return () => {
      zywy = false;
      cancelAnimationFrame(id);
      obs.disconnect();
    };
  }, [floatingLeftRail, centerMode]);

  const isCanvasMode = centerMode === 'canvas';

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-navy-950 ${className ?? ''}`}
      data-testid={testId ?? 'mels-shell'}
      data-mels-module={moduleKey}
    >
      <TopBar
        moduleLabel={moduleLabel}
        title={title}
        onTitleChange={onTitleChange}
        onBack={onBack}
        backLabel={backLabel}
        chips={topBarChips}
        presenceSlot={presenceSlot}
        titleIconSlot={topBarTitleIconSlot}
        titleTrailingSlot={topBarTitleTrailingSlot}
        primaryActionSlot={topBarPrimaryActionSlot}
        mergeSlotId={topBarMergeSlotId}
        leadingActionSlot={topBarLeadingActionSlot}
      />

      {secondBar}

      <div className="flex flex-1 min-h-0">
        {/*
         * 'chrome' mode: columnar left rail beside the canvas (today's
         * behaviour). 'canvas' mode: the column is suppressed and the
         * floating rail is layered over the canvas instead.
         */}
        {!isCanvasMode ? (
          <LeftRail
            width={rail.leftWidth}
            collapsed={rail.leftCollapsed}
            onToggleCollapse={rail.toggleLeft}
            title={leftRailTitle}
            toolsSlot={leftRailToolsSlot}
            bottomSlot={leftRailBottomSlot}
            onResize={rail.setLeftWidth}
          >
            {leftRailContent}
          </LeftRail>
        ) : null}

        {isCanvasMode ? (
          <main
            ref={canvasRef}
            className="relative flex-1 min-w-0 overflow-hidden bg-slate-50 dark:bg-navy-950"
            data-testid="mels-canvas"
            data-center-mode="canvas"
            aria-label={`${moduleLabel} canvas`}
          >
            {/*
              Rail plywa NAD plotnem, wiec bez rezerwacji miejsca zaslania wlasne
              paski reprezentacji — widoczne jako ucieta tresc („Klasyczny
              przeplyw" → „…czny przeplyw", „Framework" → „mework"). Rezerwujemy
              rynne o szerokosci railа na zawartosci, a sam rail zostawiamy przy
              krawedzi: padding jest na WEWNETRZNYM opakowaniu, nie na <main> —
              padding na <main> przesunalby takze absolutnie pozycjonowany rail
              (jego `left:0` liczy sie od krawedzi padding-boxa).
            */}
            <div
              className="h-full w-full"
              style={floatingLeftRail ? { paddingLeft: railGutter } : undefined}
              data-testid="mels-canvas-content"
            >
              {canvas}
            </div>
            {floatingLeftRail ? (
              <div
                ref={leftRailRef}
                className="pointer-events-none absolute inset-y-0 left-0 z-sticky flex items-center"
                data-testid="mels-floating-left-rail"
              >
                <div className="pointer-events-auto">{floatingLeftRail}</div>
              </div>
            ) : null}
            {canvasOverlaySlot ? (
              <div
                className="pointer-events-none absolute bottom-4 right-4 z-sticky"
                data-testid="mels-canvas-overlay"
              >
                <div className="pointer-events-auto">{canvasOverlaySlot}</div>
              </div>
            ) : null}
          </main>
        ) : (
          <main
            className="flex-1 min-w-0 overflow-auto bg-slate-50 dark:bg-navy-950"
            data-testid="mels-canvas"
            aria-label={`${moduleLabel} canvas`}
          >
            {canvas}
          </main>
        )}

        <RightRail
          tools={rightRailTools}
          activeToolId={activeToolId}
          onSelectTool={setActiveToolId}
          panelContent={panelContent}
          panelWidth={rail.rightWidth}
          collapsed={rail.rightCollapsed}
          onToggleCollapse={rail.toggleRight}
          onResize={rail.setRightWidth}
          collapsible={rightRailCollapsible}
        />

        {aiEntrySlot ? (
          <aside
            className="hidden sm:flex flex-shrink-0 border-l border-c-border-subtle bg-c-surface"
            data-testid="mels-ai-entry"
            aria-label="Discuss with Teresa"
          >
            {aiEntrySlot}
          </aside>
        ) : null}
      </div>

      {builtInModalEnabled ? (
        <ShortcutHelpModal
          isOpen={helpOpen}
          onClose={() => setHelpOpen(false)}
          shortcuts={shortcuts}
          title={helpModalTitle ?? undefined}
          description={helpModalDescription}
        />
      ) : null}
    </div>
  );
};

export {
  MELS_CHIP_ORDER,
  type MelsChipId,
  resolveChipGroup,
  sortChipsByMelsOrder,
  type TopBarChipDescriptor,
  type TopBarChipDotTone,
  type TopBarChipGroup,
  type TopBarChipKind,
} from './ChipDescriptor';
export { LeftRail } from './LeftRail';
export { RailResizeHandle } from './RailResizeHandle';
export type { RightRailToolDescriptor } from './RightRail';
export { RightRail } from './RightRail';
export { ShortcutHelpModal } from './ShortcutHelpModal';
export {
  buildMelsShortcuts,
  type ShortcutDescriptor,
  type ShortcutId,
  useMelsShortcuts,
} from './shortcuts';
export { TopBar } from './TopBar';
export type { RailDimensions, UseRailStateOptions, UseRailStateResult } from './useRailState';
export { RAIL_WIDTH_BOUNDS, useRailState } from './useRailState';

/**
 * Canonical `EditorShell` alias (editor-shell-canon — Wave W). Subsequent
 * agents/tools import `EditorShell`/`EditorShellProps` rather than the
 * legacy `ExecutiveModuleShell*` names. Same component, same (now extended)
 * contract — the additive canvas props (`centerMode`, `floatingLeftRail`,
 * `canvasOverlaySlot`, `aiEntrySlot`) live on `ExecutiveModuleShellProps`,
 * so `EditorShellProps` is a straight alias.
 */
export type EditorShellProps = ExecutiveModuleShellProps;
export const EditorShell = ExecutiveModuleShell;

export default ExecutiveModuleShell;
