/**
 * ideaPreviewMeta — wspólne meta Idei (etap · narzędzie · data) dla WSZYSTKICH
 * renderujących Ideę: tabeli (`IdeasTableContent`), listy/kart
 * (`MyIdeasListContent`) i wspólnego podglądu (`IdeaPreview`).
 *
 * ── PO CO OSOBNY PLIK ──────────────────────────────────────────────────────
 * Te definicje żyły WEWNĄTRZ `IdeasTableContent.tsx` (nieeksportowane), więc
 * drugi renderer Idei — `MyIdeasListContent.tsx` — budował własne pigułki meta
 * z `getToolConfig` i BEZ badge'y. Efekt widoczny gołym okiem: ten sam rekord
 * miał w widoku tabeli kolorową pigułkę etapu, a w widoku listy szarą. Kanon
 * (`TABLE_AND_PREVIEW_CANON.md` §7.3 pkt 2) mówi o JEDNEJ anatomii meta dla
 * wszystkich podglądów — nie o dwóch wyglądach tego samego bloku.
 *
 * Wyciągnięcie tu jest przeniesieniem 1:1 (bez zmiany wartości), żeby wspólny
 * `IdeaPreview` mógł ich użyć bez cyklu importów `IdeaPreview ↔ IdeasTableContent`.
 *
 * @module components/MyWork/ideaPreviewMeta
 */
import {
  CheckCircle2,
  Lightbulb,
  Network,
  PenTool,
  Rocket,
  Sprout,
  Table2,
  TreePine,
  Workflow,
} from 'lucide-react';
import React from 'react';

import { CHIP_TONE_VAR } from '@/components/ui/primitives/chips/chipBase';
import { formatListDate } from '@/utils/listDateFormat';

import type { IdeaStage, MyIdea } from './myIdeasTypes';

export const STAGE_META: Record<
  IdeaStage,
  {
    icon: React.ElementType;
    badge: string;
  }
> = {
  spark: {
    icon: Lightbulb,
    badge:
      'border border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
  },
  incubating: {
    icon: Sprout,
    badge:
      'border border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
  },
  shaping: {
    icon: TreePine,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
  },
  ready: {
    icon: CheckCircle2,
    badge:
      'border border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
  },
  promoted: {
    icon: Rocket,
    // Canon §4.0: "Promoted" = pozytywny stan końcowy (idea → inicjatywa), NIE alarm.
    // Crimson-leak fix (VF1-11): was raw `primary-*` (bypassed the design tokens AND
    // read as brand-crimson on a non-critical status badge). Neutral shell — same
    // treatment as TOOL_META below — color signal lives in STAGE_DOT_VAR's dot only
    // (canon §4.0a), never in the badge fill/text/border.
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
  },
};

/** Stage → signal-tone dot color (canon §4.0a: neutral chip shell, color only in dot).
 * `promoted` was the brand accent (crimson) — crimson-leak fix (VF1-11): "promoted"
 * is a positive terminal state (idea → initiative), not a brand/CTA moment, so it
 * takes the same success signal as `incubating` rather than the brand token. */
export const STAGE_DOT_VAR: Record<IdeaStage, string | undefined> = {
  spark: CHIP_TONE_VAR.warning,
  incubating: CHIP_TONE_VAR.success,
  shaping: CHIP_TONE_VAR.info,
  ready: CHIP_TONE_VAR.info,
  promoted: CHIP_TONE_VAR.success,
};

// Icon/badge styling only — label TEXT comes from the single SSOT
// `getIdeaWorkspaceToolLabel` (IdeaWorkspaceToolbar.tsx), so this table agrees
// with the list's card/grid views and the canvas rail (2026-07-24: was
// "Recommendation map"/"Mapa rekomendacji" here, drifted from other copies).
export const TOOL_META: Record<
  string,
  {
    icon: React.ElementType;
    badge: string;
    /** Canonical ToolChip icon color — semantic `c.*` var. */
    iconColorVar: string;
  }
> = {
  mindmap: {
    icon: Network,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    // Crimson-leak fix (VF1-11): tool identity is a DATA category, not a brand/CTA
    // moment — tailwind.config.js data-palette guide bans the brand token here
    // ("crimson w danych = dług"). Use the tag category palette instead (violet, tag 3).
    iconColorVar: 'var(--c-tag-3)',
  },
  table: {
    icon: Table2,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-info)',
  },
  process_flow: {
    icon: Workflow,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-success)',
  },
  whiteboard: {
    icon: PenTool,
    badge: 'border border-c-border bg-c-surface-raised text-c-text-secondary',
    iconColorVar: 'var(--c-warning)',
  },
};

export function getStageMeta(stage?: IdeaStage) {
  return STAGE_META[(stage || 'spark') as IdeaStage] || STAGE_META.spark;
}

export function getToolMeta(tool?: string | null) {
  const key = String(tool || 'mindmap').toLowerCase();
  return TOOL_META[key] || TOOL_META.mindmap;
}

export function formatIdeaDate(idea: MyIdea) {
  const value = idea.updatedAt || idea.createdAt;
  if (!value) return '—';
  return formatListDate(value);
}
