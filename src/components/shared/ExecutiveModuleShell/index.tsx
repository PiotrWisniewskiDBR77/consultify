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

import React, { useCallback, useMemo, useState } from 'react';

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

  /** Left rail configuration. */
  leftRailTitle?: string;
  leftRailToolsSlot?: React.ReactNode;
  leftRailBottomSlot?: React.ReactNode;
  leftRailContent: React.ReactNode;

  /** Right rail configuration. */
  rightRailTools: RightRailToolDescriptor[];
  /** Caller-supplied renderer for active tool — returns panel content. */
  renderRightRailPanel?: (activeToolId: string | null) => React.ReactNode;

  /** Center canvas. */
  canvas: React.ReactNode;

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
  leftRailTitle,
  leftRailToolsSlot,
  leftRailBottomSlot,
  leftRailContent,
  rightRailTools,
  renderRightRailPanel,
  canvas,
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

  const [activeToolId, setActiveToolId] = useState<string | null>(null);
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
      />

      <div className="flex flex-1 min-h-0">
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

        <main
          className="flex-1 min-w-0 overflow-auto bg-slate-50 dark:bg-navy-950"
          data-testid="mels-canvas"
          aria-label={`${moduleLabel} canvas`}
        >
          {canvas}
        </main>

        <RightRail
          tools={rightRailTools}
          activeToolId={activeToolId}
          onSelectTool={setActiveToolId}
          panelContent={panelContent}
          panelWidth={rail.rightWidth}
          collapsed={rail.rightCollapsed}
          onToggleCollapse={rail.toggleRight}
          onResize={rail.setRightWidth}
        />
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

export default ExecutiveModuleShell;
