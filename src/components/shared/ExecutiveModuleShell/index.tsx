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

import React, { useMemo, useState } from 'react';

import { LeftRail } from './LeftRail';
import { RightRail, type RightRailToolDescriptor } from './RightRail';
import { TopBar } from './TopBar';
import { type TopBarChipDescriptor } from './ChipDescriptor';
import { buildMelsShortcuts, useMelsShortcuts } from './shortcuts';
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
  onOpenShortcutHelp?: () => void;

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

  const shortcuts = useMemo(
    () =>
      buildMelsShortcuts({
        onToggleLeftRail: rail.toggleLeft,
        onOpenHelp: onOpenShortcutHelp,
        onOpenCommandPalette,
        onRunPrimary,
        onToggleAgent,
      }),
    [
      rail.toggleLeft,
      onOpenShortcutHelp,
      onOpenCommandPalette,
      onRunPrimary,
      onToggleAgent,
    ]
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
        />
      </div>
    </div>
  );
};

export { LeftRail } from './LeftRail';
export { RightRail } from './RightRail';
export type { RightRailToolDescriptor } from './RightRail';
export { TopBar } from './TopBar';
export {
  type TopBarChipDescriptor,
  type TopBarChipKind,
  type TopBarChipDotTone,
  type MelsChipId,
  MELS_CHIP_ORDER,
  sortChipsByMelsOrder,
} from './ChipDescriptor';
export { useRailState, RAIL_WIDTH_BOUNDS } from './useRailState';
export type {
  UseRailStateOptions,
  UseRailStateResult,
  RailDimensions,
} from './useRailState';
export {
  buildMelsShortcuts,
  useMelsShortcuts,
  type ShortcutDescriptor,
  type ShortcutId,
} from './shortcuts';

export default ExecutiveModuleShell;
