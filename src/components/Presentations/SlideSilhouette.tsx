/**
 * Deterministic mini layout preview for a deck outline row (Gen. Deck /
 * Deck Template Architect, `ff_deck_architect`).
 *
 * Renders a tiny SHAPE — header bar + a handful of content blocks — implied
 * by the slide's `intent`. It is a pure function of `intent` alone: same
 * intent always yields the same silhouette, and it never reads or invents
 * slide content/data. Purpose is purely to give the eye a sense of the
 * layout while scanning the outline list, not to preview real content.
 */
import React from 'react';

type SilhouetteKind = 'title' | 'list' | 'kpi' | 'chart' | 'quote' | 'default';

/**
 * intent → silhouette kind. Grouped by what the layout actually looks like,
 * not by exact intent name:
 *   - title   : cover / section divider — big centered header + short subtitle
 *   - list    : narrative bullet-style intents — header + 3 content lines
 *   - kpi     : number/score-driven intents — header + 3 metric tiles
 *   - chart   : analytical/visual intents — header + one chart/plot block
 *   - quote   : a single highlighted statement — quote mark + one line
 *   - default : anything unmapped (incl. free-text custom intents) — header + 2 lines
 */
const INTENT_TO_SILHOUETTE: Record<string, SilhouetteKind> = {
  cover: 'title',
  section_intro: 'title',
  executive_summary: 'list',
  key_messages: 'list',
  next_steps: 'list',
  risk_management: 'list',
  appendix: 'list',
  performance_overview: 'kpi',
  single_insight: 'kpi',
  assessment: 'kpi',
  recommendation_portfolio: 'kpi',
  initiative_portfolio: 'kpi',
  comparison: 'chart',
  root_cause: 'chart',
  prioritization_matrix: 'chart',
  roadmap: 'chart',
  recommendation_single: 'quote',
};

function silhouetteKindForIntent(intent: string): SilhouetteKind {
  return INTENT_TO_SILHOUETTE[intent] ?? 'default';
}

export interface SlideSilhouetteProps {
  intent: string;
  className?: string;
}

/** Tiny (~80×48px) deterministic layout thumbnail, sized for an outline row. */
export const SlideSilhouette: React.FC<SlideSilhouetteProps> = ({ intent, className = '' }) => {
  const kind = silhouetteKindForIntent(intent);
  return (
    <div
      aria-hidden="true"
      className={`flex h-12 w-20 shrink-0 flex-col justify-start gap-1 rounded-md border border-c-border-subtle bg-c-surface-raised p-1.5 ${className}`}
    >
      <SilhouetteBody kind={kind} />
    </div>
  );
};

const SilhouetteBody: React.FC<{ kind: SilhouetteKind }> = ({ kind }) => {
  switch (kind) {
    case 'title':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1">
          <div className="h-2 w-4/5 rounded-sm bg-c-text-muted/40" />
          <div className="h-1 w-2/5 rounded-sm bg-c-text-muted/25" />
        </div>
      );
    case 'list':
      return (
        <div className="flex h-full flex-col gap-1">
          <div className="h-1.5 w-3/5 rounded-sm bg-c-text-muted/40" />
          <div className="flex flex-1 flex-col justify-between gap-0.5">
            <div className="h-1 w-full rounded-sm bg-c-text-muted/25" />
            <div className="h-1 w-full rounded-sm bg-c-text-muted/25" />
            <div className="h-1 w-4/5 rounded-sm bg-c-text-muted/25" />
          </div>
        </div>
      );
    case 'kpi':
      return (
        <div className="flex h-full flex-col gap-1">
          <div className="h-1.5 w-3/5 rounded-sm bg-c-text-muted/40" />
          <div className="flex flex-1 items-stretch gap-1">
            <div className="flex-1 rounded-sm bg-c-text-muted/20" />
            <div className="flex-1 rounded-sm bg-c-text-muted/20" />
            <div className="flex-1 rounded-sm bg-c-text-muted/20" />
          </div>
        </div>
      );
    case 'chart':
      return (
        <div className="flex h-full flex-col gap-1">
          <div className="h-1.5 w-3/5 rounded-sm bg-c-text-muted/40" />
          <div className="flex-1 rounded-sm border border-c-border-subtle bg-c-text-muted/10" />
        </div>
      );
    case 'quote':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-1">
          <div className="leading-none text-c-text-muted/50" style={{ fontSize: 10 }}>
            &ldquo;
          </div>
          <div className="h-1 w-4/5 rounded-sm bg-c-text-muted/30" />
        </div>
      );
    case 'default':
    default:
      return (
        <div className="flex h-full flex-col gap-1">
          <div className="h-1.5 w-3/5 rounded-sm bg-c-text-muted/40" />
          <div className="flex flex-1 flex-col justify-center gap-1">
            <div className="h-1 w-full rounded-sm bg-c-text-muted/25" />
            <div className="h-1 w-4/5 rounded-sm bg-c-text-muted/25" />
          </div>
        </div>
      );
  }
};

export default SlideSilhouette;
