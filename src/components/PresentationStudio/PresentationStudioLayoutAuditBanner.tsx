/**
 * Presentation Studio Layout Audit Banner (Sprint S11).
 *
 * Pre-flight, non-blocking banner that surfaces the backend layout audit
 * findings (overflow, missing-source, PPTX/PDF parity) to the user as
 * advisory signal **next to** the deck preview, never inside Menu 3 —
 * the workspace rule reserves Menu 3 for AI action buttons. This banner
 * is canvas-resident status, not an action.
 *
 * Honest UI rules applied:
 *   - When `audit.warnings.length === 0` the banner renders an emerald
 *     "no findings" tile so the user can see the audit ran.
 *   - When findings exist, we render an amber banner with the aggregate
 *     count and a per-flag breakdown. The banner is collapsible so it
 *     never dominates the canvas, but the count is always visible.
 *   - The component is purely presentational — all state lives in the
 *     parent. This makes it trivial to test and to reuse later (e.g.
 *     for a dedicated layout-audit drawer).
 *
 * The component does NOT block any user action. Findings are advisory.
 * They never disable Generate; they only inform the reviewer.
 */

import { AlertTriangle, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import type {
  PresentationStudioLayoutAuditFlag,
  PresentationStudioOutlineLayoutAudit,
} from '../../services/api/presentationStudio.api';

const FLAG_DISPLAY_LABEL: Record<PresentationStudioLayoutAuditFlag, string> = {
  layout_overflow_title: 'Title overflow',
  layout_overflow_key_message: 'Key message overflow',
  layout_overflow_blocks: 'Too many blocks',
  missing_source_for_evidence_intent: 'Missing source on evidence slide',
  unsupported_intent_for_pptx_export: 'Unsupported intent (PPTX)',
  unsupported_intent_for_pdf_export: 'Unsupported intent (PDF)',
};

const FLAG_ORDER: PresentationStudioLayoutAuditFlag[] = [
  // Sprint S12 — surface high-priority flags first so the breakdown row
  // order matches the auto-expand priority. Reviewers always see the
  // high-priority class on the first row when expanded.
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
  'missing_source_for_evidence_intent',
  'layout_overflow_title',
  'layout_overflow_key_message',
  'layout_overflow_blocks',
];

/**
 * Sprint S12 — flag classes that warrant auto-expansion of the breakdown.
 * `unsupported_intent_*` indicates the renderer would silently fall back
 * (the user almost certainly wants to see exactly which slides), and
 * `missing_source_for_evidence_intent` is an evidence-discipline issue
 * that the reviewer must read before approving generation.
 *
 * The other flags (overflow_*) are advisory typographic hints; a single
 * overflow does not need to dominate the canvas. The reviewer can always
 * expand manually.
 */
const HIGH_PRIORITY_FLAGS: ReadonlySet<PresentationStudioLayoutAuditFlag> = new Set([
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
  'missing_source_for_evidence_intent',
]);

function hasHighPriorityFlags(audit: PresentationStudioOutlineLayoutAudit): boolean {
  for (const flag of HIGH_PRIORITY_FLAGS) {
    if ((audit.flagCounts[flag] ?? 0) > 0) return true;
  }
  return false;
}

function flagToneClass(flag: PresentationStudioLayoutAuditFlag): string {
  if (HIGH_PRIORITY_FLAGS.has(flag)) {
    return 'border-danger-300 bg-danger-100 text-danger-900 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-100';
  }
  return 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/40 dark:text-amber-100';
}

export interface PresentationStudioLayoutAuditBannerProps {
  /**
   * Audit payload from the latest `/generate/preview` response. When null
   * the banner renders nothing — the page should not show audit summaries
   * before a preview has run.
   */
  audit: PresentationStudioOutlineLayoutAudit | null;
  /**
   * Optional initial expanded state. Defaults to false (collapsed) when
   * findings exist; ignored when there are no findings.
   */
  defaultExpanded?: boolean;
  /** Test hook for stable assertions. */
  'data-testid'?: string;
}

export function PresentationStudioLayoutAuditBanner({
  audit,
  defaultExpanded = false,
  'data-testid': dataTestId = 'presentation-studio-layout-audit',
}: PresentationStudioLayoutAuditBannerProps): React.ReactElement | null {
  const highPriority = useMemo<boolean>(
    () => (audit ? hasHighPriorityFlags(audit) : false),
    [audit]
  );

  // Sprint S12 — auto-expand the breakdown when a high-priority flag is
  // present. The reviewer can still collapse manually; we never collapse
  // automatically. The rule is "if a high-priority flag appears, surface
  // the breakdown by default".
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded || highPriority);

  // When the audit changes (e.g. a new preview adds a high-priority flag
  // where there was none) we re-expand. We never auto-collapse — that
  // would override the reviewer's deliberate "Hide" click.
  useEffect(() => {
    if (highPriority) setExpanded(true);
  }, [highPriority]);

  const totalFindings = useMemo<number>(() => {
    if (!audit) return 0;
    return audit.warnings.length;
  }, [audit]);

  const breakdown = useMemo<
    Array<{ flag: PresentationStudioLayoutAuditFlag; count: number }>
  >(() => {
    if (!audit) return [];
    return FLAG_ORDER.map((flag) => ({ flag, count: audit.flagCounts[flag] ?? 0 })).filter(
      (entry) => entry.count > 0
    );
  }, [audit]);

  const slideDrilldown = useMemo(() => {
    if (!audit) return [];
    return audit.slideAudits.map((slide) => ({
      ...slide,
      flags: [...slide.flags].sort(
        (a, b) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b)
      ) as PresentationStudioLayoutAuditFlag[],
    }));
  }, [audit]);

  if (!audit) return null;

  if (totalFindings === 0) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        role="status"
        data-testid={dataTestId}
        data-state="clean"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">Layout audit: no findings</div>
          <div className="mt-1">
            Outline fits canonical PPTX 16:9 capacities, every evidence slide is grounded, and all
            intents are renderable by the PPTX and PDF pipelines.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        highPriority
          ? 'flex flex-col gap-2 rounded-xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-900 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-200'
          : 'flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
      }
      role="status"
      data-testid={dataTestId}
      data-state="warnings"
      data-priority={highPriority ? 'high' : 'normal'}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span>
              Layout audit: {totalFindings} {totalFindings === 1 ? 'finding' : 'findings'}
            </span>
            {highPriority ? (
              <span
                className="inline-flex items-center rounded-full border border-danger-300 bg-danger-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-danger-900 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-100"
                data-testid={`${dataTestId}-priority-badge`}
              >
                High priority
              </span>
            ) : null}
          </div>
          <div className="mt-1">
            Findings are advisory and never block generation. Review the breakdown below before
            confirming.
          </div>
        </div>
        <button
          type="button"
          className={
            highPriority
              ? 'ml-auto inline-flex items-center gap-1 rounded-lg border border-danger-300 bg-white/60 px-2 py-1 text-xs font-medium text-danger-900 hover:bg-white dark:border-danger-900/60 dark:bg-danger-900/20 dark:text-danger-100 dark:hover:bg-danger-900/40'
              : 'ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/60 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/40'
          }
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          aria-controls={`${dataTestId}-details`}
          data-testid={`${dataTestId}-toggle`}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          )}
          {expanded ? 'Hide' : 'Show'} breakdown
        </button>
      </div>

      {expanded ? (
        <div
          id={`${dataTestId}-details`}
          className="mt-1 space-y-3"
          data-testid={`${dataTestId}-details`}
        >
          <div className="grid gap-2 sm:grid-cols-2" data-testid={`${dataTestId}-flag-breakdown`}>
            {breakdown.map(({ flag, count }) => (
              <div
                key={flag}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs dark:border-amber-900/60 dark:bg-amber-900/20"
                data-testid={`${dataTestId}-flag-${flag}`}
              >
                <span className="font-medium">{FLAG_DISPLAY_LABEL[flag]}</span>
                <span
                  className="rounded-full bg-amber-200 px-2 py-0.5 font-mono text-[11px] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                  data-testid={`${dataTestId}-flag-${flag}-count`}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300"
            data-testid={`${dataTestId}-slide-drilldown`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                Per-slide drill-down
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {slideDrilldown.length} slides checked
              </span>
            </div>
            <div className="space-y-2">
              {slideDrilldown.map((slide) => (
                <div
                  key={`${slide.index}-${slide.intent}`}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-950/50"
                  data-testid={`${dataTestId}-slide-${slide.index}`}
                  data-state={slide.flags.length > 0 ? 'flagged' : 'clean'}
                >
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    Slide {slide.index + 1}
                  </span>
                  <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-200">
                    {slide.intent || 'unknown'}
                  </span>
                  {slide.flags.length > 0 ? (
                    slide.flags.map((flag) => (
                      <span
                        key={flag}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${flagToneClass(flag)}`}
                        data-testid={`${dataTestId}-slide-${slide.index}-flag-${flag}`}
                      >
                        {FLAG_DISPLAY_LABEL[flag]}
                      </span>
                    ))
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                      data-testid={`${dataTestId}-slide-${slide.index}-clean`}
                    >
                      No findings
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {expanded && audit.warnings.length > 0 ? (
        <ul
          className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-900 dark:text-amber-100"
          data-testid={`${dataTestId}-warnings`}
        >
          {audit.warnings.map((warning, idx) => (
            <li key={idx} className="break-words">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PresentationStudioLayoutAuditBanner;
