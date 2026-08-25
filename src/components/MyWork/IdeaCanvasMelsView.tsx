/**
 * IdeaCanvasMelsView — `EditorShell` (`ExecutiveModuleShell`) adapter for the
 * four Ideas canvases (Mind Map / Process Flow / Idea Table / Whiteboard),
 * EditorShell Wave W-1.
 *
 * Canonical shell mounted by `<IdeaMapWorkspace>` for every Ideas canvas.
 *
 * PRESENTATIONAL ONLY — exactly like `DeckBuilderMelsView`. IdeaMapWorkspace
 * retains ALL canvas state, effects, autosave, collaboration, refs and
 * handlers, and forwards ready-made React nodes + chip descriptors here. This
 * adapter never lifts state; it only composes the shell in `centerMode='canvas'`
 * (Miro-style): the floating left rail floats over the canvas, the four tools
 * render as the canvas, and the right rail hosts the workspace inspector.
 *
 * Layout (editor-shell-canon Wave W · Z7 Menu 1/Menu 3):
 *   - Menu 1 (TopBar)   → clean identity row. Chips (ghost Teresa + kebab `⋯`)
 *                         built by the host via `buildIdeaMenu1Chips`; identity
 *                         slots (`titleIconSlot`/`titleTrailingSlot`) + sole
 *                         primary `primaryActionSlot` ("Konwertuj ▾") are
 *                         ready-made nodes forwarded from the host.
 *   - Menu 3 (secondBar)→ per-tool view actions (`buildIdeaMenu3Actions`),
 *                         rendered by `IdeaCanvasSecondBar`, forwarded here.
 *   - floatingLeftRail  → canvas editing tools, physically docked on the RIGHT.
 *   - canvas            → the active tool's canvas (switch content), supplied
 *                         verbatim; its own in-flow zoom controls / overlays
 *                         stay inside it (they need the ReactFlow context).
 *   - rightRailTools    → semantic information sections rendered on the LEFT;
 *                         the historical prop name is retained during migration.
 *   - renderRightRailPanel → the host renders the matching existing panel.
 *   - siblings          → all existing modals / drawers / popovers / voting
 *                         overlay, rendered verbatim as floating siblings.
 */

import React, { useMemo } from 'react';

import {
  EditorShell,
  type RightRailToolDescriptor,
  type TopBarChipDescriptor,
} from '@/components/shared/ExecutiveModuleShell';

export interface IdeaCanvasMelsViewProps {
  /** Breadcrumb title (idea title). */
  title: string;
  onTitleChange?: (next: string) => void;
  onBack?: () => void;
  backLabel?: string;
  moduleLabel?: string;

  /** Command-row chips (already built with per-tool primary hierarchy). */
  topBarChips: TopBarChipDescriptor[];

  /** Menu 1 identity/command slots (Z7 anatomy) — ready-made nodes from host. */
  titleIconSlot?: React.ReactNode;
  titleTrailingSlot?: React.ReactNode;
  primaryActionSlot?: React.ReactNode;
  /** Menu 3 (second bar) — per-tool view actions, ready-made node from host. */
  secondBar?: React.ReactNode;
  /**
   * Scalenie Menu 1 w rząd pilli hosta (jedna linia) — DOM id slotu. Podawane
   * przez `IdeaMapWorkspace` tylko przy fladze `ff_ideaTopBarOneLine`; gdy
   * slotu nie ma w DOM, powłoka renderuje pasek po staremu.
   */
  mergeTopBarSlotId?: string;

  /** Right-rail inspector tabs + active id + selection + panel renderer. */
  rightRailTools: RightRailToolDescriptor[];
  activeRightToolId?: string | null;
  onSelectRightTool?: (id: string | null) => void;
  renderRightRailPanel?: (activeToolId: string | null) => React.ReactNode;
  /** DEC-27 additive element inspector, rendered independently on the right. */
  elementInspectorRail?: React.ReactNode;
  /**
   * Czy pasek ikon prawego panelu wolno schować do 16-pikselowego słupka.
   * Domyślnie TAK (dzisiejsze zachowanie). Idea w układzie 6 sekcji podaje
   * `false` — decyzja właściciela: pasek ikon ma być zawsze widoczny.
   */
  rightRailCollapsible?: boolean;
  /**
   * IDE-025: przelotka do TRYBU STEROWANEGO prawego paska powłoki.
   * Gospodarz musi móc otworzyć sekcję „Właściwości" programowo — inaczej
   * dwuklik w element nie ma gdzie pokazać szczegółów i drawer spada do
   * nakładki (czyli dokładnie do problemu, który likwidujemy). Powłoka ma
   * ten tryb od dawna, po prostu nie był tu przepuszczony.
   */
  activeRightRailToolId?: string | null;
  onActiveRightRailToolChange?: (next: string | null) => void;

  /** Core canvas-mode slots. */
  canvas: React.ReactNode;
  /** Floating tool rail over the canvas (CanvasLeftToolbar). */
  floatingLeftRail?: React.ReactNode;
  /** Optional floating overlay pinned to the canvas corner. Usually omitted
   *  because the canvases render their own zoom controls INSIDE the ReactFlow
   *  context (they can't be hoisted out of it). */
  canvasOverlaySlot?: React.ReactNode;

  /** Unified AI entry ("Discuss with Teresa") — docked aside. Omit to hide. */
  aiEntrySlot?: React.ReactNode;

  /** Collaboration presence indicators for the top bar. */
  presenceSlot?: React.ReactNode;

  /**
   * All existing modals / drawers / popovers / voting overlay, rendered
   * verbatim as floating siblings of the shell (unchanged behaviour).
   */
  siblings?: React.ReactNode;

  /** Shortcut registry hooks. */
  onRunPrimary?: () => void;
  onToggleAgent?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenShortcutHelp?: () => boolean | void;

  /** Persistence opt-out for tests. */
  persistRailState?: boolean;
}

export const IdeaCanvasMelsView: React.FC<IdeaCanvasMelsViewProps> = ({
  title,
  onTitleChange,
  onBack,
  backLabel,
  moduleLabel = 'Ideas',
  topBarChips,
  titleIconSlot,
  titleTrailingSlot,
  primaryActionSlot,
  secondBar,
  mergeTopBarSlotId,
  rightRailTools,
  activeRightToolId,
  onSelectRightTool,
  renderRightRailPanel,
  elementInspectorRail,
  rightRailCollapsible = true,
  activeRightRailToolId,
  onActiveRightRailToolChange,
  canvas,
  floatingLeftRail,
  canvasOverlaySlot,
  aiEntrySlot,
  presenceSlot,
  siblings,
  onRunPrimary,
  onToggleAgent,
  onOpenCommandPalette,
  onOpenShortcutHelp,
  persistRailState = true,
}) => {
  // The shell owns its own `activeToolId` state internally. When the host
  // supplies `onSelectRightTool`, we surface selections to it (so it can drive
  // the existing panel state); otherwise the shell keeps its internal state.
  const rightPanelRenderer = useMemo(
    () =>
      renderRightRailPanel
        ? (activeToolId: string | null) => renderRightRailPanel(activeToolId)
        : undefined,
    [renderRightRailPanel]
  );

  const shell = (
    <EditorShell
      moduleKey="ideas-canvas"
      moduleLabel={moduleLabel}
      title={title}
      onTitleChange={onTitleChange}
      onBack={onBack}
      backLabel={backLabel}
      topBarChips={topBarChips}
      presenceSlot={presenceSlot}
      topBarTitleIconSlot={titleIconSlot}
      topBarTitleTrailingSlot={titleTrailingSlot}
      topBarPrimaryActionSlot={primaryActionSlot}
      topBarMergeSlotId={mergeTopBarSlotId}
      secondBar={secondBar}
      centerMode="canvas"
      inspectorRailSide="left"
      floatingToolRailSide="right"
      canvas={canvas}
      floatingLeftRail={floatingLeftRail}
      canvasOverlaySlot={canvasOverlaySlot}
      aiEntrySlot={aiEntrySlot}
      // Canvas mode suppresses the columnar left rail; leftRailContent is unused
      // but required by the contract, so we pass an empty fragment.
      leftRailContent={<></>}
      rightRailTools={rightRailTools}
      renderRightRailPanel={rightPanelRenderer}
      elementInspectorRail={elementInspectorRail}
      rightRailCollapsible={rightRailCollapsible}
      activeRightRailToolId={activeRightRailToolId}
      onActiveRightRailToolChange={onActiveRightRailToolChange}
      onRunPrimary={onRunPrimary}
      onToggleAgent={onToggleAgent}
      onOpenCommandPalette={onOpenCommandPalette}
      onOpenShortcutHelp={onOpenShortcutHelp}
      persistRailState={persistRailState}
      testId="idea-canvas-mels-view"
    />
  );

  // Note: `activeRightToolId` / `onSelectRightTool` are accepted for hosts that
  // want to mirror selection into their own panel state. The shell manages the
  // strip selection internally; the host drives panel content via
  // `renderRightRailPanel`. Kept in the signature for forward-compat parity
  // with the Deck adapter without forcing state-lifting today.
  void activeRightToolId;
  void onSelectRightTool;

  return (
    <div
      className="h-full w-full flex flex-col bg-c-surface overflow-hidden"
      data-testid="idea-canvas-mels-root"
    >
      <div className="flex-1 min-h-0 flex flex-col">{shell}</div>
      {siblings}
    </div>
  );
};

export default IdeaCanvasMelsView;
