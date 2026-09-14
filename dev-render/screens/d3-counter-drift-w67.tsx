import React from 'react';

import { countAuditCriteriaTree } from '@/components/Audit/method/tabs/AuditLibraryTab';
import { countUnrepresentedStatuses } from '@/components/ReportsAndPresentations/statusCounts';

const mode = new URLSearchParams(window.location.search).get('state') === 'before' ? 'before' : 'after';
const statusCounts = { draft: 8, ready: 34, generated: 1 };
const nestedCriteria: any[] = Array.from({ length: 3 }, (_, root) => ({
  id: `root-${root}`, children: Array.from({ length: 2 }, (_, child) => ({ id: `child-${root}-${child}`, children: [] })),
}));
const other = countUnrepresentedStatuses(statusCounts, ['draft', 'ready']);
const criteriaDetail = mode === 'before' ? nestedCriteria.length : countAuditCriteriaTree(nestedCriteria);

function CounterCard({ code, title, children }: React.PropsWithChildren<{ code: string; title: string }>) {
  return <section className="rounded-2xl border border-c-border bg-c-surface p-5 shadow-sm">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">{code}</div>
    <h2 className="mt-1 text-lg font-semibold text-c-text">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>;
}
function Pill({ children }: React.PropsWithChildren) { return <span className="inline-flex h-8 items-center rounded-full border border-c-border-subtle bg-c-surface-raised px-3 text-sm text-c-text">{children}</span>; }

export default function D3CounterDriftW67Screen() {
  return <main className="min-h-screen bg-c-app p-8 text-c-text" data-testid={`counter-drift-${mode}`}>
    <header className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">D-3 · W67 · behavioral evidence</div><h1 className="mt-1 text-2xl font-semibold">Counter consistency — {mode === 'before' ? 'BEFORE' : 'AFTER'}</h1><p className="mt-2 text-sm text-c-text-secondary">Same measured fixtures; the after state exposes every denominator.</p></header>
    <div className="grid gap-4 lg:grid-cols-3">
      <CounterCard code="N1 · Materials / Presentations" title="Status categories"><div className="flex flex-wrap gap-2"><Pill>All 43</Pill><Pill>Draft 8</Pill><Pill>Ready 34</Pill>{mode === 'after' ? <Pill>Other statuses {other}</Pill> : null}</div><p className={`mt-3 text-sm font-medium ${mode === 'before' ? 'text-c-danger' : 'text-[var(--c-success)]'}`}>{mode === 'before' ? 'Visible categories add up to 42 of 43.' : '8 + 34 + 1 = 43. No status is hidden.'}</p></CounterCard>
      <CounterCard code="N2 · Audits" title="Criteria count"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-c-surface-raised p-3"><div className="text-xs text-c-text-muted">List</div><div className="mt-1 text-2xl font-semibold">9</div></div><div className="rounded-xl bg-c-surface-raised p-3"><div className="text-xs text-c-text-muted">Details</div><div className="mt-1 text-2xl font-semibold">{criteriaDetail}</div></div></div><p className={`mt-3 text-sm font-medium ${mode === 'before' ? 'text-c-danger' : 'text-[var(--c-success)]'}`}>{mode === 'before' ? 'Details counted only three root criteria.' : 'Details count the full nine-node criteria tree.'}</p></CounterCard>
      <CounterCard code="N4 · Organization / Claims" title="Paged result"><div className="rounded-xl bg-c-surface-raised p-3"><div className="text-2xl font-semibold">Claims ({mode === 'before' ? 200 : 727})</div>{mode === 'after' ? <div className="mt-1 text-sm text-c-text-secondary">Showing 200 of 727</div> : null}</div><p className={`mt-3 text-sm font-medium ${mode === 'before' ? 'text-c-danger' : 'text-[var(--c-success)]'}`}>{mode === 'before' ? 'LIMIT 200 was presented as the total.' : 'Server total and visible page size are both explicit.'}</p></CounterCard>
    </div>
  </main>;
}
