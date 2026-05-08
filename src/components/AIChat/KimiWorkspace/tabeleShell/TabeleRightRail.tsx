/**
 * TabeleRightRail — module tools strip + panel registry for the
 * Tabele lane (EPIC-T16 D5).
 *
 * Provides:
 *   * `buildTabeleRightRailTools(args)` — descriptor list for the
 *     `<RightRail>` icon strip in the documented MELS order:
 *     Search → AI Editor → QA Report → Source Pack → Layout →
 *     Share → Analytics.
 *   * `<TabeleRightRailPanel>` — caller-driven panel content host that
 *     renders the matching panel for `activeToolId`.
 *
 * Caller supplies handlers and panel renderers; this module owns the
 * tool taxonomy, icon mapping, default labels, and ordering. This
 * keeps shell + Tabele integration loose-coupled.
 *
 * Constraint (MELS § 2.D + .cursor/rules/ai-actions-menu3.mdc): all
 * AI buttons (AI Editor 8 levels, QA Report) live ONLY in the right
 * rail — never beside the canvas, never as a separate toolbar.
 */

import {
  Activity,
  BookOpen,
  LayoutGrid,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import React from 'react';

import { type RightRailToolDescriptor } from '@/components/shared/ExecutiveModuleShell/RightRail';

export type TabeleRightRailToolId =
  | 'search'
  | 'ai-editor'
  | 'qa-report'
  | 'source-pack'
  | 'layout'
  | 'share'
  | 'analytics';

export interface TabeleRightRailLabels {
  search?: string;
  aiEditor?: string;
  qaReport?: string;
  sourcePack?: string;
  layout?: string;
  share?: string;
  analytics?: string;
}

const DEFAULT_LABELS: Required<TabeleRightRailLabels> = {
  search: 'Search records',
  aiEditor: 'AI Editor',
  qaReport: 'QA Report',
  sourcePack: 'Source Pack',
  layout: 'Layout',
  share: 'Share',
  analytics: 'Analytics',
};

export interface TabeleRightRailState {
  /** Total count of QA findings — drives the badge on the QA tool icon. */
  qaFindingsCount?: number;
  /** Source Pack item count. */
  sourcePackCount?: number;
  /** When false, AI Editor icon is rendered disabled. */
  aiEditorEnabled?: boolean;
  /** Source Pack tone (warning when low coverage). */
  sourcePackTone?: 'success' | 'warning' | 'danger' | null;
}

export function buildTabeleRightRailTools(args: {
  state?: TabeleRightRailState;
  labels?: TabeleRightRailLabels;
}): RightRailToolDescriptor[] {
  const { state = {}, labels = {} } = args;
  const L = { ...DEFAULT_LABELS, ...labels };

  const qaBadge =
    typeof state.qaFindingsCount === 'number' && state.qaFindingsCount > 0
      ? state.qaFindingsCount
      : undefined;

  return [
    { id: 'search', label: L.search, icon: Search },
    {
      id: 'ai-editor',
      label: L.aiEditor,
      icon: Sparkles,
      disabled: state.aiEditorEnabled === false,
    },
    {
      id: 'qa-report',
      label: L.qaReport,
      icon: ShieldCheck,
      ...(qaBadge !== undefined ? { badge: qaBadge } : {}),
      ...(qaBadge !== undefined ? { dotTone: 'warning' as const } : {}),
    },
    {
      id: 'source-pack',
      label: L.sourcePack,
      icon: BookOpen,
      ...(state.sourcePackCount !== undefined ? { badge: state.sourcePackCount } : {}),
      ...(state.sourcePackTone ? { dotTone: state.sourcePackTone } : {}),
    },
    { id: 'layout', label: L.layout, icon: LayoutGrid },
    { id: 'share', label: L.share, icon: Share2 },
    { id: 'analytics', label: L.analytics, icon: Activity },
  ];
}

export interface TabeleRightRailPanelRenderers {
  search?: React.ReactNode;
  aiEditor?: React.ReactNode;
  qaReport?: React.ReactNode;
  sourcePack?: React.ReactNode;
  layout?: React.ReactNode;
  share?: React.ReactNode;
  analytics?: React.ReactNode;
}

interface TabeleRightRailPanelProps {
  activeToolId: TabeleRightRailToolId | string | null;
  panels: TabeleRightRailPanelRenderers;
  /** Optional fallback when no panel matches. */
  fallback?: React.ReactNode;
}

const PANEL_KEY: Record<TabeleRightRailToolId, keyof TabeleRightRailPanelRenderers> = {
  search: 'search',
  'ai-editor': 'aiEditor',
  'qa-report': 'qaReport',
  'source-pack': 'sourcePack',
  layout: 'layout',
  share: 'share',
  analytics: 'analytics',
};

export const TabeleRightRailPanel: React.FC<TabeleRightRailPanelProps> = ({
  activeToolId,
  panels,
  fallback,
}) => {
  if (!activeToolId) return null;
  const key = PANEL_KEY[activeToolId as TabeleRightRailToolId];
  if (!key) return <>{fallback ?? null}</>;
  const node = panels[key];
  return <>{node ?? fallback ?? null}</>;
};

export default TabeleRightRailPanel;
