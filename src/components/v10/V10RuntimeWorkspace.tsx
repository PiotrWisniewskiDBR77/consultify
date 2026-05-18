import React, { Children, isValidElement, useEffect, useMemo, useState } from 'react';

import { cn } from '@/utils/cn';

export type V10RuntimeReadiness = 'ready' | 'partial' | 'flagged_off';

export type V10RuntimeWorkspaceBlock = {
  readonly id:
    | 'artifact'
    | 'agent'
    | 'onboarding'
    | 'reasoning'
    | 'learning'
    | 'research'
    | 'connectors'
    | 'outcome';
  readonly title: string;
  readonly description: string;
  readonly readiness: V10RuntimeReadiness;
  readonly flags: readonly string[];
  readonly sections: readonly string[];
};

type V10RuntimeWorkspaceFilter = 'all' | 'issues' | 'ready' | 'partial' | 'flagged_off';
const V10_RUNTIME_FILTER_QUERY_KEY = 'v10Filter';

function readinessBadge(readiness: V10RuntimeReadiness) {
  if (readiness === 'ready') {
    return {
      label: 'Ready',
      tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    };
  }
  if (readiness === 'partial') {
    return {
      label: 'Partial',
      tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    };
  }
  return {
    label: 'Flagged off',
    tone: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
  };
}

function matchesFilter(
  block: V10RuntimeWorkspaceBlock,
  filter: V10RuntimeWorkspaceFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'issues')
    return block.readiness === 'partial' || block.readiness === 'flagged_off';
  return block.readiness === filter;
}

function parseFilter(input: string | null | undefined): V10RuntimeWorkspaceFilter {
  if (input === 'issues' || input === 'ready' || input === 'partial' || input === 'flagged_off') {
    return input;
  }
  return 'all';
}

function readFilterFromUrl(): V10RuntimeWorkspaceFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    return parseFilter(
      new URLSearchParams(window.location.search).get(V10_RUNTIME_FILTER_QUERY_KEY)
    );
  } catch {
    return 'all';
  }
}

export function V10RuntimeWorkspace({
  blocks,
  children,
}: {
  readonly blocks: readonly V10RuntimeWorkspaceBlock[];
  readonly children: React.ReactNode;
}) {
  const [showFlags, setShowFlags] = useState(false);
  const [filter, setFilter] = useState<V10RuntimeWorkspaceFilter>(() => readFilterFromUrl());

  const counts = useMemo(
    () => ({
      ready: blocks.filter((block) => block.readiness === 'ready').length,
      partial: blocks.filter((block) => block.readiness === 'partial').length,
      flaggedOff: blocks.filter((block) => block.readiness === 'flagged_off').length,
    }),
    [blocks]
  );

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => matchesFilter(block, filter)),
    [blocks, filter]
  );
  const firstIssueBlock = useMemo(
    () =>
      blocks.find((block) => block.readiness === 'partial' || block.readiness === 'flagged_off') ??
      null,
    [blocks]
  );

  const visibleChildren = useMemo(
    () =>
      Children.toArray(children).filter((child) => {
        if (!isValidElement(child)) return true;
        const block = (child.props as { block?: V10RuntimeWorkspaceBlock }).block;
        if (!block) return true;
        return matchesFilter(block, filter);
      }),
    [children, filter]
  );

  useEffect(() => {
    setFilter((current) => {
      const fromUrl = readFilterFromUrl();
      return current === fromUrl ? current : fromUrl;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (filter === 'all') {
        url.searchParams.delete(V10_RUNTIME_FILTER_QUERY_KEY);
      } else {
        url.searchParams.set(V10_RUNTIME_FILTER_QUERY_KEY, filter);
      }
      window.history.replaceState(
        window.history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {
      // ignore best-effort URL sync failures
    }
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              V10RuntimeWorkspace
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Wspolny host dla 8 blokow V10 z kanoniczna kolejnoscia, podgladem flag i statusami
              gotowosci.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
              ready: {counts.ready}
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              partial: {counts.partial}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
              flagged off: {counts.flaggedOff}
            </span>
            <button
              type="button"
              onClick={() => setShowFlags((value) => !value)}
              className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {showFlags ? 'Hide flags' : 'Show flags'}
            </button>
            {firstIssueBlock ? (
              <a
                href={`#v10-block-${firstIssueBlock.id}`}
                className="rounded-full border border-amber-200 px-3 py-1 font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/20"
              >
                Jump to first issue
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="v10-runtime-filterbar">
          {[
            ['all', `All (${blocks.length})`],
            ['issues', `Issues (${counts.partial + counts.flaggedOff})`],
            ['ready', `Ready (${counts.ready})`],
            ['partial', `Partial (${counts.partial})`],
            ['flagged_off', `Flagged off (${counts.flaggedOff})`],
          ].map(([value, label]) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as V10RuntimeWorkspaceFilter)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  active
                    ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2" data-testid="v10-runtime-toolbar">
          {visibleBlocks.map((block, index) => {
            const badge = readinessBadge(block.readiness);
            return (
              <a
                key={block.id}
                href={`#v10-block-${block.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <span className="text-slate-400 dark:text-slate-500">{index + 1}.</span>
                <span>{block.title}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', badge.tone)}>
                  {badge.label}
                </span>
              </a>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleBlocks.map((block, index) => {
            const badge = readinessBadge(block.readiness);
            return (
              <div
                key={block.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Block {index + 1}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {block.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {block.description}
                    </div>
                  </div>
                  <span
                    className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', badge.tone)}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {block.sections.map((section) => (
                    <span
                      key={section}
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      {section}
                    </span>
                  ))}
                </div>
                {showFlags ? (
                  <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {block.flags.map((flag) => (
                      <div key={flag} className="truncate font-mono">
                        {flag}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {visibleBlocks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-400">
            No V10 blocks match the current readiness filter.
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">{visibleChildren}</div>
    </div>
  );
}

export function V10RuntimeWorkspaceBlock({
  block,
  children,
  className,
}: {
  readonly block: V10RuntimeWorkspaceBlock;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const badge = readinessBadge(block.readiness);

  return (
    <section
      id={`v10-block-${block.id}`}
      className={cn(
        'space-y-3 rounded-3xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/10 dark:bg-white/[0.03]',
        className
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-white">
            {block.title}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{block.description}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', badge.tone)}>
            {badge.label}
          </span>
          {block.sections.map((section) => (
            <span
              key={section}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-black/20 dark:text-slate-300"
            >
              {section}
            </span>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
