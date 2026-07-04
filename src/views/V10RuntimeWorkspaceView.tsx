import React from 'react';
import { useLocation } from 'react-router-dom';

function readinessBadge(readiness: 'ready' | 'partial' | 'flagged_off') {
  if (readiness === 'ready')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  if (readiness === 'partial')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300';
}

export function V10RuntimeWorkspaceView() {
  const location = useLocation();
  const rolloutSummary = {
    totalBlocks: 0,
    readyBlocks: 0,
    partialBlocks: 0,
    totalFunctions: 0,
    readyFunctions: 0,
    flaggedOffFunctions: 0,
    defaultOffFlags: 0,
    totalFlags: 0,
  };
  const rolloutBlocks: Array<{
    block: string;
    title: string;
    description: string;
    readiness: 'ready' | 'partial' | 'flagged_off';
    enabledGateFlags: number;
    totalGateFlags: number;
    functions: Array<{
      id: string;
      phase: string | number;
      title: string;
      readiness: 'ready' | 'partial' | 'flagged_off';
    }>;
  }> = [];

  return (
    <div className="space-y-6 p-4 lg:p-6" data-testid="v10-runtime-entrypoint">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-c-border-subtle dark:bg-white/5">
        <div className="max-w-4xl">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Internal V10 QA Workspace
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Wewnetrzny host QA do sprawdzania V10 jako calego systemu: 8 blokow, readiness, flagi i
            smoke surface pod testy integracyjne. Ten ekran nie jest czescia normalnej nawigacji
            produktu.
          </p>
        </div>

        <div
          className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
          data-testid="v10-runtime-smoke-surface"
          aria-label="V10 runtime smoke surface"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-c-border-subtle dark:bg-black/20">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Route
            </div>
            <div className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">
              {location.pathname}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-c-border-subtle dark:bg-black/20">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Block rollout
            </div>
            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
              {rolloutSummary.totalBlocks} total · {rolloutSummary.readyBlocks} ready ·{' '}
              {rolloutSummary.partialBlocks} partial
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-c-border-subtle dark:bg-black/20">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Function rollout
            </div>
            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
              {rolloutSummary.totalFunctions} functions · {rolloutSummary.readyFunctions} ready ·{' '}
              {rolloutSummary.flaggedOffFunctions} flagged off
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-c-border-subtle dark:bg-black/20">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Default-off hygiene
            </div>
            <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
              {rolloutSummary.defaultOffFlags} / {rolloutSummary.totalFlags} flags ship default-off
            </div>
          </div>
        </div>

        <div className="mt-4" data-testid="v10-runtime-rollout-summary">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-500">
            Rollout Summary
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {rolloutBlocks.map((block) => (
              <div
                key={block.block}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-c-border-subtle dark:bg-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{block.title}</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {block.description}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${readinessBadge(
                      block.readiness
                    )}`}
                  >
                    {block.readiness.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Gate flags: {block.enabledGateFlags}/{block.totalGateFlags} on
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {block.functions.map((feature) => (
                    <span
                      key={feature.id}
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${readinessBadge(feature.readiness)}`}
                    >
                      P{feature.phase}: {feature.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default V10RuntimeWorkspaceView;
