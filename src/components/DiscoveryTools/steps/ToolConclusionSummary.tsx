/**
 * ToolConclusionSummary — WNIOSKOWA (conclusive) presentation block for a
 * tool session's summary screen (OXFORD O2.3, CONCLUSION_LAYER_STANDARD W2).
 *
 * Renders the verdict headline, rationale, top-3 "co robić najpierw" moves
 * (ranked impact×effort — see `toolConclusion.ts`), the mandatory trade-off,
 * and the expected effect with its horizon — produced by
 * `buildToolConclusionModel`. This component holds no numbers of its own;
 * every value is pre-computed by the generator (numbers only from the
 * engine/session, never invented here).
 *
 * Design tokens: c.* only (bg-c-surface, text-c-text, border-c-border-subtle,
 * bg-c-accent-soft…). ZERO crimson — no bg-primary/text-primary/crimson-*.
 * Mirrors `src/components/assessment/reports/ConclusionSummary.tsx` (O2.2).
 *
 * The caller (SummaryStep.tsx) MUST only render this when
 * `model.isPublishable` is true — a conclusion that fails the §4.4 hard gate
 * must fall back to the legacy summary view, never render half-broken.
 */

import React from 'react';

import type { ToolConclusionModel } from '@/services/report/toolConclusion';

const LABELS = {
  pl: {
    verdict: 'Wniosek',
    rationale: 'Uzasadnienie',
    whatFirst: 'Co robić najpierw',
    tradeoffs: 'Trade-off',
    effect: 'Jaki efekt',
    impact: 'Wpływ',
    effort: 'Wysiłek',
    owner: 'Odpowiedzialny',
    chosen: 'Wybieramy',
    rejected: 'Kosztem',
    why: 'Dlaczego',
    confidence: 'Pewność wniosku',
    aiNote: 'wniosek AI (zweryfikowany)',
    deterministicNote: 'wniosek deterministyczny (bez AI)',
  },
  en: {
    verdict: 'Conclusion',
    rationale: 'Rationale',
    whatFirst: 'What to do first',
    tradeoffs: 'Trade-off',
    effect: 'Expected effect',
    impact: 'Impact',
    effort: 'Effort',
    owner: 'Owner',
    chosen: 'We choose',
    rejected: 'At the cost of',
    why: 'Why',
    confidence: 'Conclusion confidence',
    aiNote: 'AI conclusion (validated)',
    deterministicNote: 'deterministic conclusion (no AI)',
  },
} as const;

const LEVEL_BADGE: Record<string, string> = {
  high: 'bg-c-accent-soft text-c-accent',
  medium: 'bg-c-border-subtle text-c-text-secondary',
  low: 'bg-c-border-subtle text-c-text-muted',
};

export const ToolConclusionSummary: React.FC<{ model: ToolConclusionModel }> = ({ model }) => {
  const L = LABELS[model.language];

  return (
    <div className="rounded-xl border border-c-border-subtle bg-c-surface p-6">
      {/* Verdict headline — answer-first thesis */}
      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-accent">
          {L.verdict}
          <span className="rounded-full bg-c-border-subtle px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-c-text-muted">
            {model.source === 'llm' ? L.aiNote : L.deterministicNote}
          </span>
        </div>
        <h3 className="text-lg font-bold leading-snug text-c-text">{model.headline}</h3>
      </div>

      <div className="border-t border-c-border-subtle pt-4">
        <div className="mb-4">
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {L.rationale}
          </div>
          <p className="text-sm leading-relaxed text-c-text-secondary">{model.rationale}</p>
        </div>

        {model.k3Actions.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              {L.whatFirst}
            </div>
            <ol className="space-y-2">
              {model.k3Actions.map((a, idx) => (
                <li
                  key={idx}
                  className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-c-text">{a.action}</p>
                    <div className="flex shrink-0 gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_BADGE[a.impact]}`}
                      >
                        {L.impact}: {a.impact}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${LEVEL_BADGE[a.effort]}`}
                      >
                        {L.effort}: {a.effort}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-c-text-muted">{a.whyFirst}</p>
                  <p className="mt-1 text-xs text-c-text-muted">
                    {L.owner}:{' '}
                    <span className="font-medium text-c-text-secondary">{a.ownerRole}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {model.tradeoffs.length > 0 && (
          <div className="mb-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              {L.tradeoffs}
            </div>
            {model.tradeoffs.map((t, idx) => (
              <p key={idx} className="text-sm leading-relaxed text-c-text-secondary">
                <span className="font-medium text-c-text">{L.chosen}:</span> {t.chosen} —{' '}
                <span className="font-medium text-c-text">{L.rejected}:</span> {t.rejected} (
                {L.why.toLowerCase()}: {t.why})
              </p>
            ))}
          </div>
        )}

        {model.effect && (
          <div>
            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
              {L.effect} ({model.effect.horizon})
            </div>
            <p className="text-sm leading-relaxed text-c-text-secondary">{model.effect.text}</p>
          </div>
        )}
      </div>

      <div className="mt-3 text-xs text-c-text-muted">
        {L.confidence}:{' '}
        <span className="font-medium text-c-text-secondary">{model.confidence}</span>
      </div>
    </div>
  );
};

export default ToolConclusionSummary;
