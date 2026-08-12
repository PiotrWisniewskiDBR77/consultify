/**
 * DeckBuilderMelsView — `ExecutiveModuleShell` adapter for the DeckBuilder
 * lane (EE / Deliverables unification WS-A4 phase 2).
 *
 * Mounted by `<DeckBuilder>` when `isMelsDeckBuilderEnabled()` is true.
 * It is PRESENTATIONAL ONLY — DeckBuilder retains all deck state, effects,
 * autosave, collaboration, version history and handlers, and forwards them
 * here as primitives + ready-made React nodes. This mirrors the proven
 * `TabeleMelsView` pattern so the three editors (Wordy / Tabele /
 * Prezentacje) share one shell with identical chrome.
 *
 * Layout:
 *   - TopBar chips      → buildDeckBuilderTopBarChips (MELS canonical order)
 *   - Left rail         → SlideSorter (supplied as `leftRail`)
 *   - Canvas            → CardCanvas (supplied as `canvas`)
 *   - Right rail        → Blocks / Media / Activity (supplied per tool)
 *   - Teresa            → canonised as the shell's `aiEntrySlot` (docked
 *                         aside on the RIGHT of the shell body), per
 *                         editor-shell-canon §6 Agent E. Previously rendered
 *                         as a bespoke `<aside>` to the LEFT of the shell,
 *                         outside its contract — now passed straight through
 *                         to `ExecutiveModuleShell`'s `aiEntrySlot` prop.
 *   - Banner / overlays → agent-edit proposal banner, modals, command
 *                         palette, share modal, bottom bar (supplied verbatim).
 */

import { ChevronDown, Play } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ExecutiveModuleShell } from '@/components/shared/ExecutiveModuleShell';

import {
  buildDeckBuilderTopBarChips,
  type DeckBuilderTopBarChipsHandlers,
  type DeckBuilderTopBarChipsLabels,
  type DeckBuilderTopBarChipsState,
} from './DeckBuilderMelsChips';
import {
  buildDeckBuilderRightRailTools,
  type DeckBuilderRightRailLabels,
  DeckBuilderRightRailPanel,
  type DeckBuilderRightRailPanelRenderers,
  type DeckBuilderRightRailState,
  type DeckBuilderRightRailToolId,
} from './DeckBuilderMelsRightRail';

export interface DeckBuilderMelsViewProps {
  /** Enables the staged Artifact Studio shell contract. */
  artifactStudioMode?: boolean;
  /** Breadcrumb title (deck title). */
  title: string;
  onTitleChange?: (next: string) => void;
  onBack?: () => void;
  backLabel?: string;
  moduleLabel?: string;

  /** Top-bar chip handlers + state (forwarded verbatim from DeckBuilder). */
  topBarHandlers: DeckBuilderTopBarChipsHandlers;
  topBarState?: DeckBuilderTopBarChipsState;
  topBarLabels?: DeckBuilderTopBarChipsLabels;

  /** Right-rail tool state + per-tool panel content. */
  rightRailState?: DeckBuilderRightRailState;
  rightRailLabels?: DeckBuilderRightRailLabels;
  rightRailPanels?: DeckBuilderRightRailPanelRenderers;
  /** Controlled active right-rail tool (so the top-bar can toggle a panel). */
  activeRightRailToolId?: string | null;
  onActiveRightRailToolChange?: (toolId: string | null) => void;

  /** Core slots. */
  leftRail: React.ReactNode;
  canvas: React.ReactNode;
  leftRailTitle?: string;
  /** Single contextual Artifact Studio work bar (Menu 3). */
  menu3Slot?: React.ReactNode;
  /** Unified QA and approval workflow rendered in the single left panel. */
  reviewPanel?: React.ReactNode;

  /**
   * Teresa split-chat aside — forwarded verbatim to the shell's canonical
   * `aiEntrySlot` (docked on the RIGHT of the shell body). Pass `null`/omit
   * when Teresa is closed.
   */
  aiEntrySlot?: React.ReactNode;
  /** Full-width banner above the shell (e.g. the agent-edit proposal banner). */
  bannerSlot?: React.ReactNode;
  /** Full-width bar below the shell (e.g. the deck bottom bar). */
  bottomBarSlot?: React.ReactNode;
  /** Modals / command palette / share modal rendered as floating siblings. */
  overlays?: React.ReactNode;
  /** Collaboration presence indicators for the top bar. */
  presenceSlot?: React.ReactNode;
  /** Artifact identity metadata rendered directly after the editable title. */
  titleTrailingSlot?: React.ReactNode;

  /** Shortcut registry hooks. */
  onRunPrimary?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => boolean | void;

  /** Persistence opt-out for tests. */
  persistRailState?: boolean;
}

const PresentMenu: React.FC<{
  enabled: boolean;
  onCurrent?: () => void;
  onStart?: () => void;
  onPresenter?: () => void;
  labels?: DeckBuilderTopBarChipsLabels;
}> = ({ enabled, onCurrent, onStart, onPresenter, labels }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        window.setTimeout(() => optionsButtonRef.current?.focus(), 0);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const run = (handler?: () => void): void => {
    setOpen(false);
    handler?.();
  };

  return (
    <div ref={ref} className="relative flex shrink-0" data-testid="artifact-present-menu">
      <button
        type="button"
        disabled={!enabled || !onCurrent}
        onClick={() => run(onCurrent)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-l-lg bg-c-text px-3 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play size={14} aria-hidden="true" />
        {labels?.run ?? 'Present'}
      </button>
      <button
        ref={optionsButtonRef}
        type="button"
        disabled={!enabled}
        aria-label="Presentation options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-r-lg border-l border-c-bg/20 bg-c-text text-c-bg transition-colors hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Presentation options"
          className="absolute right-0 top-[calc(100%+6px)] z-dropdown min-w-56 rounded-lg border border-c-border bg-c-surface p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onCurrent)}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised"
          >
            From current slide
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onStart)}
            disabled={!onStart}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised disabled:opacity-40"
          >
            {labels?.runFromStart ?? 'From beginning'}
          </button>
          <div className="my-1 border-t border-c-border-subtle" />
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onPresenter)}
            disabled={!onPresenter}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-c-text hover:bg-c-surface-raised disabled:opacity-40"
          >
            {labels?.presenter ?? 'Presenter view'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const DeckBuilderMelsView: React.FC<DeckBuilderMelsViewProps> = ({
  artifactStudioMode = false,
  title,
  onTitleChange,
  onBack,
  backLabel,
  moduleLabel = 'Prezentacje',
  topBarHandlers,
  topBarState,
  topBarLabels,
  rightRailState,
  rightRailLabels,
  rightRailPanels = {},
  activeRightRailToolId,
  onActiveRightRailToolChange,
  leftRail,
  canvas,
  leftRailTitle = 'Slides',
  menu3Slot,
  reviewPanel,
  aiEntrySlot,
  bannerSlot,
  bottomBarSlot,
  overlays,
  presenceSlot,
  titleTrailingSlot,
  onRunPrimary,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
}) => {
  const [artifactLeftMode, setArtifactLeftMode] = useState<
    'structure' | 'comments' | 'sources' | 'review'
  >('structure');
  const chips = useMemo(() => {
    const descriptors = buildDeckBuilderTopBarChips({
      handlers: { ...topBarHandlers, onRun: topBarHandlers.onRun ?? onRunPrimary },
      state: topBarState,
      labels: topBarLabels,
    });
    if (!artifactStudioMode) return descriptors;

    // Artifact Studio keeps Menu 2 artifact-scoped and one-line. Theme belongs
    // to contextual Menu 3; Comments previously toggled the now-suppressed
    // local right rail; Teresa is global. Retain the working artifact actions
    // and existing workflow overlays until their common workflows replace
    // them, so the rollout does not trade visual cleanup for lost capability.
    const artifactMenu2Ids = new Set([
      'internal',
      'history',
      'qa',
      'analytics',
      'audit',
      'share',
    ]);
    return descriptors
      .filter((descriptor) => artifactMenu2Ids.has(descriptor.id))
      .map((descriptor) => {
        switch (descriptor.id) {
          case 'qa':
            return {
              ...descriptor,
              label: 'QA i przegląd',
              overflowSection: 'QA i przegląd',
              onClick: () => setArtifactLeftMode('review'),
            };
          case 'history':
            return {
              ...descriptor,
              label: 'Historia',
              overflowSection: 'Historia',
            };
          case 'audit':
            return {
              ...descriptor,
              label: 'Dziennik audytu',
              overflowSection: 'Historia',
            };
          case 'analytics':
            return {
              ...descriptor,
              label: 'Analityka udostępniania',
              overflowSection: 'Udostępnianie',
            };
          default:
            return descriptor;
        }
      });
  }, [artifactStudioMode, topBarHandlers, onRunPrimary, topBarState, topBarLabels]);

  // HP-17: narzędzie „Źródła i założenia" pojawia się na pasku TYLKO gdy
  // wołający dostarczył jego panel (DeckBuilder robi to za flagą ff_evidencePanel,
  // default OFF). Brak panelu → pasek 1:1 jak przed HP-17.
  const includeEvidence = rightRailPanels.evidence != null;
  // J12-S3 (Honest-UI): „Media" na pasku TYLKO gdy wołający dostarczył panel.
  const includeMedia = rightRailPanels.media != null;
  const rightTools = useMemo(
    () =>
      buildDeckBuilderRightRailTools({
        state: rightRailState,
        labels: rightRailLabels,
        includeEvidence,
        includeMedia,
      }),
    [rightRailState, rightRailLabels, includeEvidence, includeMedia]
  );

  const artifactLeftRail = artifactStudioMode ? (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-1 border-b border-c-border-subtle p-2"
        role="tablist"
        aria-label="Narzędzia prezentacji"
      >
        {(
          [
            ['structure', 'Slajdy'],
            ...(rightRailPanels.comments ? [['comments', 'Komentarze']] : []),
            ...(rightRailPanels.evidence || rightRailPanels.relations
              ? [['sources', 'Źródła']]
              : []),
            ...(reviewPanel ? [['review', 'QA i przegląd']] : []),
          ] as Array<[typeof artifactLeftMode, string]>
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={artifactLeftMode === mode}
            onClick={() => setArtifactLeftMode(mode)}
            className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${
              artifactLeftMode === mode
                ? 'bg-c-focus/10 text-c-focus-solid ring-1 ring-inset ring-c-focus'
                : 'text-c-text-secondary hover:bg-c-surface-hover hover:text-c-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {artifactLeftMode === 'structure'
          ? leftRail
          : artifactLeftMode === 'comments'
            ? rightRailPanels.comments
            : artifactLeftMode === 'sources'
              ? rightRailPanels.evidence || rightRailPanels.relations
              : reviewPanel}
      </div>
    </div>
  ) : (
    leftRail
  );

  const shell = (
    <ExecutiveModuleShell
      moduleKey="prezentacje"
      moduleLabel={moduleLabel}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={backLabel}
      topBarChips={chips}
      topBarPrimaryActionSlot={
        artifactStudioMode ? (
          <PresentMenu
            enabled={topBarState?.runEnabled !== false}
            onCurrent={topBarHandlers.onRun ?? onRunPrimary}
            onStart={topBarHandlers.onRunFromStart}
            onPresenter={topBarHandlers.onPresenter}
            labels={topBarLabels}
          />
        ) : undefined
      }
      artifactStudioMode={artifactStudioMode}
      globalTeresaSlot={artifactStudioMode ? aiEntrySlot : undefined}
      bottomBar={artifactStudioMode ? bottomBarSlot : undefined}
      secondBar={artifactStudioMode ? menu3Slot : undefined}
      presenceSlot={presenceSlot}
      topBarTitleTrailingSlot={artifactStudioMode ? titleTrailingSlot : undefined}
      leftRailTitle={artifactStudioMode ? 'Struktura prezentacji' : leftRailTitle}
      leftRailContent={artifactLeftRail}
      rightRailTools={artifactStudioMode ? [] : rightTools}
      activeRightRailToolId={activeRightRailToolId}
      onActiveRightRailToolChange={onActiveRightRailToolChange}
      renderRightRailPanel={(activeToolId) => (
        <DeckBuilderRightRailPanel
          activeToolId={activeToolId as DeckBuilderRightRailToolId | null}
          panels={rightRailPanels}
        />
      )}
      canvas={canvas}
      aiEntrySlot={artifactStudioMode ? undefined : aiEntrySlot}
      onRunPrimary={onRunPrimary}
      onToggleAgent={topBarHandlers.onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      testId="deck-builder-mels-view"
    />
  );

  return (
    <div
      className="h-full flex flex-col bg-c-surface overflow-hidden"
      data-testid="deck-builder-mels-root"
    >
      {bannerSlot}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">{shell}</div>
      </div>
      {!artifactStudioMode ? bottomBarSlot : null}
      {overlays}
    </div>
  );
};

export default DeckBuilderMelsView;
