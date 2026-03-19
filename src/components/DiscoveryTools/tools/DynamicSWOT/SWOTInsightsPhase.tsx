import { AlertTriangle, ArrowRight, Lightbulb, Link2, Sparkles } from 'lucide-react';
import React from 'react';

import { SWOTData, ToolSession } from '@/store/useToolStore';

const TENSION_TONE: Record<string, string> = {
  attack: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  repair: 'border-sky-200 bg-sky-50 text-sky-700',
  defend: 'border-amber-200 bg-amber-50 text-amber-700',
  protect: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function SWOTInsightsPhase({
  session,
  isPolish,
}: {
  session: ToolSession;
  isPolish: boolean;
}) {
  const swotData = session.inputData as SWOTData;
  const tensions = swotData.tensions || [];
  const correlations = swotData.correlations || [];
  const moves = swotData.recommendedMoves || [];
  const appliedConclusions = swotData.summary?.appliedConclusions || [];
  const deferredMoves = moves.filter(
    (move) => move.estimatedEffort === 'high' && move.expectedImpact !== 'high'
  );

  const getItemText = (itemId: string) =>
    swotData.items.find((item) => item.id === itemId)?.text || itemId;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
        <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {isPolish
            ? 'To jest faza, w której SWOT przestaje być tabelą i staje się narzędziem decyzji. Tutaj budujemy napięcia, trade-offy, ruchy i rzeczy, których nie warto robić teraz.'
            : 'This is the phase where SWOT stops being a table and becomes a decision tool. Here we build tensions, trade-offs, moves, and what should not be done now.'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Tensions' : 'Tensions'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {tensions.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Correlations' : 'Correlations'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {correlations.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Moves' : 'Moves'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {moves.length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">
            {isPolish ? 'Applied conclusions' : 'Applied conclusions'}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {appliedConclusions.length}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Strategiczne napięcia' : 'Strategic tensions'}
              </h2>
            </div>
            {tensions.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-navy-700 dark:text-slate-400">
                {isPolish
                  ? 'Wygeneruj analizę AI, aby zobaczyć napięcia między elementami SWOT.'
                  : 'Run AI analysis to surface tensions between SWOT elements.'}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {tensions.map((tension) => (
                  <div
                    key={tension.id}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/40"
                  >
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${
                        TENSION_TONE[tension.type] || 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {tension.type}
                    </span>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {tension.title}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {tension.insight}
                    </div>
                    {tension.whyNow && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Dlaczego teraz:' : 'Why now:'} {tension.whyNow}
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {(tension.linkedItemIds || []).slice(0, 2).map(getItemText).join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Powiązania i interpretacja' : 'Correlations & interpretation'}
              </h2>
            </div>
            {correlations.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak korelacji do pokazania.' : 'No correlations to show yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {correlations.map((correlation) => (
                  <div
                    key={correlation.id}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-navy-700/70 dark:bg-navy-950/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="rounded-full border border-slate-200 px-2 py-1 dark:border-navy-700">
                        {correlation.type}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {correlation.items.map((itemId, index) => (
                          <React.Fragment key={`${correlation.id}-${itemId}`}>
                            {index > 0 && <ArrowRight className="h-3 w-3" />}
                            <span>{getItemText(itemId)}</span>
                          </React.Fragment>
                        ))}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {correlation.insight}
                    </div>
                    {correlation.initiativeProposal && (
                      <div className="mt-2 rounded-lg bg-slate-100/80 px-3 py-2 text-xs text-slate-600 dark:bg-navy-950/40 dark:text-slate-400">
                        {isPolish ? 'Move hypothesis:' : 'Move hypothesis:'}{' '}
                        {correlation.initiativeProposal}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Wnioski aplikowalne' : 'Applied conclusions'}
              </h2>
            </div>
            {appliedConclusions.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak wniosków aplikowalnych.' : 'No applied conclusions yet.'}
              </div>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {appliedConclusions.map((conclusion, index) => (
                  <li key={`${conclusion}-${index}`} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary-500" />
                    <span>{conclusion}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Ruchy strategiczne' : 'Strategic moves'}
              </h2>
            </div>
            {moves.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish ? 'Brak ruchów strategicznych.' : 'No strategic moves yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {moves.map((move) => (
                  <div
                    key={move.id}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-navy-700/70 dark:bg-navy-950/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {move.title}
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {move.category}
                        </div>
                      </div>
                      <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500 dark:border-navy-700 dark:text-slate-400">
                        {isPolish ? 'Wpływ' : 'Impact'}: {move.expectedImpact}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {move.rationale}
                    </div>
                    {move.firstStep && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Pierwszy ruch:' : 'First move:'} {move.firstStep}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-navy-700/70 dark:bg-navy-900/40">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? 'Not now / defer' : 'Not now / defer'}
              </h2>
            </div>
            {deferredMoves.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Brak ruchów, które obecnie wyglądają na zbyt ciężkie względem efektu.'
                  : 'No moves currently look too heavy relative to their upside.'}
              </div>
            ) : (
              <div className="space-y-2">
                {deferredMoves.map((move) => (
                  <div
                    key={move.id}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-300"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {move.title}
                    </div>
                    <div className="mt-1">
                      {isPolish
                        ? 'Odłóż lub doprecyzuj, bo wysiłek jest wysoki względem obecnej pewności.'
                        : 'Defer or tighten the case because effort is high relative to current confidence.'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default SWOTInsightsPhase;
