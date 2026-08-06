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

import './deckBuilderResponsive.css';

import React, { useMemo } from 'react';

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

  /** Shortcut registry hooks. */
  onRunPrimary?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => boolean | void;

  /** Persistence opt-out for tests. */
  persistRailState?: boolean;
}

export const DeckBuilderMelsView: React.FC<DeckBuilderMelsViewProps> = ({
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
  aiEntrySlot,
  bannerSlot,
  bottomBarSlot,
  overlays,
  presenceSlot,
  onRunPrimary,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
}) => {
  const chips = useMemo(
    () =>
      buildDeckBuilderTopBarChips({
        handlers: { ...topBarHandlers, onRun: topBarHandlers.onRun ?? onRunPrimary },
        state: topBarState,
        labels: topBarLabels,
      }),
    [topBarHandlers, onRunPrimary, topBarState, topBarLabels]
  );

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

  const shell = (
    <ExecutiveModuleShell
      moduleKey="prezentacje"
      moduleLabel={moduleLabel}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={backLabel}
      topBarChips={chips}
      presenceSlot={presenceSlot}
      leftRailTitle={leftRailTitle}
      leftRailContent={leftRail}
      rightRailTools={rightTools}
      activeRightRailToolId={activeRightRailToolId}
      onActiveRightRailToolChange={onActiveRightRailToolChange}
      renderRightRailPanel={(activeToolId) => (
        <DeckBuilderRightRailPanel
          activeToolId={activeToolId as DeckBuilderRightRailToolId | null}
          panels={rightRailPanels}
        />
      )}
      canvas={canvas}
      aiEntrySlot={aiEntrySlot}
      onRunPrimary={onRunPrimary}
      onToggleAgent={topBarHandlers.onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      className="deck-builder-responsive-shell"
      testId="deck-builder-mels-view"
    />
  );

  return (
    <div
      className="h-screen flex flex-col bg-c-surface overflow-hidden"
      data-testid="deck-builder-mels-root"
    >
      {bannerSlot}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">{shell}</div>
      </div>
      {bottomBarSlot}
      {overlays}
    </div>
  );
};

export default DeckBuilderMelsView;
