/**
 * PrezentacjeRightRail — module-tools strip + panel registry for the
 * Prezentacje (deck GENERATOR) lane under the MELS shell.
 *
 * Scope note (no phantom controls): `DeckBuilderMelsRightRail` exposes
 * Blocks / Media / Comments / Activity because `DeckBuilder` owns LIVE
 * slide editing (block insertion, media library, comment threads).
 * `PrezentacjeView` is the chat GENERATOR screen upstream of the
 * builder — it does not have block insertion, a media library, or a
 * comment thread. The ONLY canvas-adjacent, genuinely-existing signal
 * on this screen is the generation task timeline
 * (`useKimiArtifactPipeline`'s `taskSteps` / `onReplay` / `onRemix`,
 * rendered inline by the legacy `KimiWorkspaceShell`'s `TaskProgressBar`)
 * — so this rail exposes ONLY `activity` for that. Blocks / Media /
 * Comments are deliberately NOT included here; they belong to the
 * DeckBuilder lane's own MELS rail, not this one.
 *
 * Panel CONTENT wiring is deferred (S4, same as `TabeleMelsView` /
 * `DeckBuilderMelsView`) — callers may pass `rightRailPanels={{}}`.
 */

import { Activity } from 'lucide-react';
import React from 'react';

import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';

export type PrezentacjeRightRailToolId = 'activity';

export interface PrezentacjeRightRailLabels {
  activity?: string;
}

const DEFAULT_LABELS: Required<PrezentacjeRightRailLabels> = {
  activity: 'Activity',
};

export interface PrezentacjeRightRailState {
  /** Count of in-flight/completed task steps — drives the Activity badge. */
  taskStepCount?: number;
  /** Activity dot tone (info while generating). */
  activityTone?: 'success' | 'warning' | 'danger' | 'info' | null;
}

export function buildPrezentacjeRightRailTools(args: {
  state?: PrezentacjeRightRailState;
  labels?: PrezentacjeRightRailLabels;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {} } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const activityBadge =
    typeof state.taskStepCount === 'number' && state.taskStepCount > 0
      ? state.taskStepCount
      : undefined;

  return [
    {
      id: 'activity',
      label: L.activity,
      icon: Activity,
      ...(activityBadge !== undefined ? { badge: activityBadge } : {}),
      ...(state.activityTone ? { dotTone: state.activityTone } : {}),
    },
  ];
}

export interface PrezentacjeRightRailPanelRenderers {
  activity?: React.ReactNode;
}

interface PrezentacjeRightRailPanelProps {
  activeToolId: PrezentacjeRightRailToolId | string | null;
  panels: PrezentacjeRightRailPanelRenderers;
  fallback?: React.ReactNode;
}

const PANEL_KEY: Record<PrezentacjeRightRailToolId, keyof PrezentacjeRightRailPanelRenderers> = {
  activity: 'activity',
};

export const PrezentacjeRightRailPanel: React.FC<PrezentacjeRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
}) => {
  if (!activeToolId) return null;
  const key = PANEL_KEY[activeToolId as PrezentacjeRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default PrezentacjeRightRailPanel;
