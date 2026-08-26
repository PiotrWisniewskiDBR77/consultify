/**
 * GateReadinessPill — small gate-AI readiness badge for placement next to a gate CTA.
 *
 * PURE presentational (M13 Depth · Fala 1 · §6). Props in, callbacks out, NO data fetching.
 * Color: GREEN when verdict==='ready', AMBER (warning, NOT danger) when 'below',
 * subtle/neutral when null or loading.
 *
 * @see docs/product/INITIATIVE_GATE_AI_SPEC.md §6
 */

import { AlertTriangle, Check, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { GateAiReadiness } from '@/types/gateAi';

export interface GateReadinessPillProps {
  readiness: GateAiReadiness | null;
  loading?: boolean;
  onClick?: () => void;
}

export const GateReadinessPill: React.FC<GateReadinessPillProps> = ({
  readiness,
  loading = false,
  onClick,
}) => {
  const { t } = useTranslation();

  // Loading / subtle state — no verdict yet.
  if (loading || !readiness) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={t('initiatives.gateAi.pill.ariaLoading')}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold
          bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20
          disabled:cursor-default enabled:hover:bg-slate-500/15 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        <span>
          {loading ? t('initiatives.gateAi.pill.loading') : t('initiatives.gateAi.pill.label')}
        </span>
      </button>
    );
  }

  const isReady = readiness.verdict === 'ready';
  // DEC-104: the reviewer fell back to a deterministic word-count heuristic
  // (no AI model configured, or its output was unparseable) — the score is a
  // structural estimate, not something a model actually judged. Never show
  // it identically to a real AI-reviewed score.
  const isDegraded = !!readiness.degraded;

  const cls = isReady
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 enabled:hover:bg-emerald-500/15'
    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 enabled:hover:bg-amber-500/15';

  const degradedLabel = t('initiatives.gateAi.pill.degraded', 'szacunek bez modelu AI');

  const ariaLabel = [
    isReady
      ? t('initiatives.gateAi.pill.ariaReady', { score: readiness.score })
      : t('initiatives.gateAi.pill.ariaBelow', { score: readiness.score }),
    isDegraded ? degradedLabel : null,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={ariaLabel}
      title={isDegraded ? degradedLabel : undefined}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold
        disabled:cursor-default transition-colors ${cls}`}
    >
      {isReady ? <Check size={12} /> : <AlertTriangle size={12} />}
      <span>
        {readiness.score}
        {t('initiatives.gateAi.pill.scoreSuffix')}
      </span>
      {isDegraded && (
        <span
          className="inline-flex items-center gap-0.5 rounded border border-current/30 px-1 text-[9px] font-semibold uppercase tracking-wide opacity-80"
          aria-hidden="true"
        >
          <HelpCircle size={10} />
          {t('initiatives.gateAi.pill.degradedBadge', 'bez AI')}
        </span>
      )}
    </button>
  );
};

export default GateReadinessPill;
