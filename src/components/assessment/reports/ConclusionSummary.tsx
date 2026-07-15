/**
 * ConclusionSummary — shared WNIOSKOWA (conclusive) presentation blocks for assessment reports.
 *
 * Renders the answer-first executive summary (verdict headline + K1→K2→K3→K4) and the
 * top-3 gap cards ("co jest → co znaczy → co robić → efekt") produced by the deterministic
 * conclusion builders (`siriConclusion` / `admaConclusion`).
 *
 * Design tokens: c.* only (bg-c-surface, text-c-text, border-c-border-subtle, bg-c-accent-soft…).
 * ZERO crimson in visualizations — no bg-primary / text-primary / crimson-* here.
 * This component holds no numbers of its own; every value comes pre-computed from the engine.
 */

import React from 'react';

import i18n from '@/i18n';

export interface ConclusionExecutiveSummaryVM {
  headline: string;
  k1_state: string;
  k2_meaning: string;
  k3_threeGaps: string;
  k4_whatFirst: string;
  k5_effect: string;
  confidence: string;
}

export interface ConclusionGapCardVM {
  title: string; // "Dimension (Block/Pillar)"
  badge: string; // current → target · gap
  whatIs: string;
  whatItMeans: string;
  whatToDo: string;
  effect: string;
}

const LABELS = {
  pl: {
    verdict: 'Werdykt',
    state: 'Co jest',
    meaning: 'Co to znaczy',
    threeGaps: 'Trzy największe luki',
    whatFirst: 'Co najpierw',
    effect: 'Jaki efekt',
    confidence: 'Pewność wniosku',
    gaps: 'Kluczowe luki — co jest → co znaczy → co robić → efekt',
    gWhatIs: 'Co jest',
    gWhatItMeans: 'Co to znaczy',
    gWhatToDo: 'Co robić',
    gEffect: 'Efekt',
  },
  en: {
    verdict: 'Verdict',
    state: 'What is',
    meaning: 'What it means',
    threeGaps: 'Three largest gaps',
    whatFirst: 'What first',
    effect: 'Expected effect',
    confidence: 'Conclusion confidence',
    gaps: 'Key gaps — what is → what it means → what to do → effect',
    gWhatIs: 'What is',
    gWhatItMeans: 'What it means',
    gWhatToDo: 'What to do',
    gEffect: 'Effect',
  },
} as const;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-3 last:mb-0">
    <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-0.5">
      {label}
    </div>
    <p className="text-sm text-c-text-secondary leading-relaxed">{children}</p>
  </div>
);

export const ConclusionExecutiveSummary: React.FC<{
  vm: ConclusionExecutiveSummaryVM;
  language?: 'pl' | 'en';
}> = ({ vm, language = 'pl' }) => {
  const L = LABELS[language];
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
      {/* Verdict headline — answer-first thesis */}
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-c-accent mb-1">
          {L.verdict}
        </div>
        <h3 className="text-lg font-bold text-c-text leading-snug">{vm.headline}</h3>
      </div>

      <div className="border-t border-c-border-subtle pt-4">
        <Row label={L.state}>{vm.k1_state}</Row>
        <Row label={L.meaning}>{vm.k2_meaning}</Row>
        <Row label={L.threeGaps}>{vm.k3_threeGaps}</Row>
        <Row label={L.whatFirst}>{vm.k4_whatFirst}</Row>
        <Row label={L.effect}>{vm.k5_effect}</Row>
      </div>

      <div className="mt-2 text-xs text-c-text-muted">
        {L.confidence}: <span className="font-medium text-c-text-secondary">{vm.confidence}</span>
      </div>
    </div>
  );
};

export interface FoFRoadItemVM {
  name: string;
  current: number | null;
  gapToFoF: number | null;
  atOrAboveFoF: boolean;
}

/**
 * ADMA-only: explicit "road to Factory of the Future (FoF≥4)" bar.
 * Shows which transformations are below the benchmark and by how much.
 * Colors: c.accent (progress) + c.warning (distance) + c.success (at/above). No crimson.
 */
export const FoFRoadBar: React.FC<{
  benchmark: number;
  items: FoFRoadItemVM[];
  summary: string;
  language?: 'pl' | 'en';
}> = ({ benchmark, items, summary, language = 'pl' }) => {
  const label = (key: string, pl: string, en: string) =>
    i18n.t(`assessment.fofRoadBar.${key}`, {
      lng: language,
      defaultValue: language === 'pl' ? pl : en,
    });
  const scaleMax = 5;
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
      <p className="mb-4 text-sm font-medium text-c-text">{summary}</p>
      <div className="space-y-3">
        {items.map((it, idx) => {
          const cur = it.current ?? 0;
          const curPct = Math.max(0, Math.min(100, (cur / scaleMax) * 100));
          const benchPct = Math.max(0, Math.min(100, (benchmark / scaleMax) * 100));
          const gapLabel =
            it.gapToFoF === null
              ? '—'
              : it.gapToFoF <= 0
                ? '✓ FoF'
                : i18n.t('assessment.fofRoadBar.gapValue', {
                    lng: language,
                    defaultValue: language === 'pl' ? 'brak {{value}}' : '−{{value}}',
                    value: Math.round(it.gapToFoF * 10) / 10,
                  });
          return (
            <div key={idx}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-c-text">{it.name}</span>
                <span
                  className={
                    it.atOrAboveFoF
                      ? 'font-semibold text-c-success'
                      : 'font-semibold text-c-warning'
                  }
                >
                  {it.current === null ? '—' : `${Math.round(cur * 10) / 10}/${scaleMax}`} ·{' '}
                  {gapLabel}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-c-border-subtle overflow-hidden">
                <div
                  className={`h-full rounded-full ${it.atOrAboveFoF ? 'bg-c-success' : 'bg-c-warning'}`}
                  style={{ width: `${curPct}%` }}
                />
                {/* FoF benchmark marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-c-text"
                  style={{ left: `${benchPct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-c-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-c-warning" />
          {label('currentLevel', 'Poziom obecny', 'Current level')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-c-text" />
          {i18n.t('assessment.fofRoadBar.fofThreshold', {
            lng: language,
            defaultValue: language === 'pl' ? 'Próg FoF ({{benchmark}})' : 'FoF threshold ({{benchmark}})',
            benchmark,
          })}
        </span>
      </div>
    </div>
  );
};

export const ConclusionGapCards: React.FC<{
  cards: ConclusionGapCardVM[];
  language?: 'pl' | 'en';
}> = ({ cards, language = 'pl' }) => {
  const L = LABELS[language];
  if (!cards.length) return null;
  return (
    <div className="space-y-4">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h4 className="font-bold text-c-text">{card.title}</h4>
            <span className="shrink-0 rounded-md bg-c-accent-soft px-2 py-0.5 text-xs font-semibold text-c-accent">
              {card.badge}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-0.5">
                {L.gWhatIs}
              </div>
              <p className="text-sm text-c-text-secondary leading-relaxed">{card.whatIs}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-0.5">
                {L.gWhatItMeans}
              </div>
              <p className="text-sm text-c-text-secondary leading-relaxed">{card.whatItMeans}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-0.5">
                {L.gWhatToDo}
              </div>
              <p className="text-sm text-c-text-secondary leading-relaxed">{card.whatToDo}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-0.5">
                {L.gEffect}
              </div>
              <p className="text-sm text-c-text-secondary leading-relaxed">{card.effect}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
