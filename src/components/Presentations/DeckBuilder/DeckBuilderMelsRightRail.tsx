/**
 * DeckBuilderMelsRightRail — module-tools strip + panel registry for the
 * DeckBuilder lane under the MELS shell (EE / Deliverables unification
 * WS-A4).
 *
 * Provides:
 *   * `buildDeckBuilderRightRailTools(args)` — descriptor list for the
 *     `<RightRail>` icon strip: Blocks → Media → Activity.
 *   * `<DeckBuilderRightRailPanel>` — caller-driven panel host that
 *     renders the matching panel for `activeToolId`.
 *
 * Mirrors `TabeleRightRail` so the canvas-adjacent tooling lives in the
 * right rail (never floating beside the canvas), consistent with the
 * MELS § 2.D constraint shared across the three editors.
 *
 * Note: governance / audit / version / quality / analytics for the deck
 * are surfaced via the TOP-BAR chips (as overlays) to preserve current
 * DeckBuilder behaviour; only the genuinely canvas-adjacent tools
 * (block insertion, media library, agent activity) live in the rail.
 */

import { Activity, FileSearch, Image, LayoutGrid, Link2, MessageSquare } from 'lucide-react';
import React from 'react';

import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';

export type DeckBuilderRightRailToolId =
  | 'blocks'
  | 'media'
  | 'comments'
  | 'activity'
  | 'relations'
  | 'evidence';

export interface DeckBuilderRightRailLabels {
  blocks?: string;
  media?: string;
  comments?: string;
  activity?: string;
  relations?: string;
  evidence?: string;
}

const DEFAULT_LABELS: Required<DeckBuilderRightRailLabels> = {
  blocks: 'Blocks',
  media: 'Media',
  comments: 'Comments',
  activity: 'Activity',
  relations: 'Relations',
  evidence: 'Sources & assumptions',
};

export interface DeckBuilderRightRailState {
  /** Count of runtime/agent events — drives the badge on the Activity icon. */
  agentActivityCount?: number;
  /** Activity dot tone (info when the agent is live). */
  activityTone?: 'success' | 'warning' | 'danger' | 'info' | null;
  /** Count of open comment threads — drives the badge on the Comments icon. */
  openCommentCount?: number;
}

export function buildDeckBuilderRightRailTools(args: {
  state?: DeckBuilderRightRailState;
  labels?: DeckBuilderRightRailLabels;
  /**
   * HP-17: gdy true, dokłada narzędzie „Źródła i założenia" (evidence) na
   * końcu paska. Wołający włącza je TYLKO za flagą ff_evidencePanel (default
   * OFF) — patrz DeckBuilder.tsx. false/undefined → pasek 1:1 jak przed HP-17.
   */
  includeEvidence?: boolean;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {}, includeEvidence = false } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const activityBadge =
    typeof state.agentActivityCount === 'number' && state.agentActivityCount > 0
      ? state.agentActivityCount
      : undefined;
  const commentsBadge =
    typeof state.openCommentCount === 'number' && state.openCommentCount > 0
      ? state.openCommentCount
      : undefined;

  const tools: RightRailToolDescriptor[] = [
    { id: 'blocks', label: L.blocks, icon: LayoutGrid },
    { id: 'media', label: L.media, icon: Image },
    {
      id: 'comments',
      label: L.comments,
      icon: MessageSquare,
      ...(commentsBadge !== undefined ? { badge: commentsBadge } : {}),
    },
    {
      id: 'activity',
      label: L.activity,
      icon: Activity,
      ...(activityBadge !== undefined ? { badge: activityBadge } : {}),
      ...(state.activityTone ? { dotTone: state.activityTone } : {}),
    },
    { id: 'relations', label: L.relations, icon: Link2 },
  ];
  if (includeEvidence) {
    tools.push({ id: 'evidence', label: L.evidence, icon: FileSearch });
  }
  return tools;
}

export interface DeckBuilderRightRailPanelRenderers {
  blocks?: React.ReactNode;
  media?: React.ReactNode;
  comments?: React.ReactNode;
  activity?: React.ReactNode;
  relations?: React.ReactNode;
  evidence?: React.ReactNode;
}

interface DeckBuilderRightRailPanelProps {
  activeToolId: DeckBuilderRightRailToolId | string | null;
  panels: DeckBuilderRightRailPanelRenderers;
  /** Optional fallback when no panel matches. */
  fallback?: React.ReactNode;
}

const PANEL_KEY: Record<DeckBuilderRightRailToolId, keyof DeckBuilderRightRailPanelRenderers> = {
  blocks: 'blocks',
  media: 'media',
  comments: 'comments',
  activity: 'activity',
  relations: 'relations',
  evidence: 'evidence',
};

export const DeckBuilderRightRailPanel: React.FC<DeckBuilderRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
}) => {
  if (!activeToolId) return null;
  const key = PANEL_KEY[activeToolId as DeckBuilderRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default DeckBuilderRightRailPanel;
