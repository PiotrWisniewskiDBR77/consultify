/**
 * AP-CLIENT (Gate J) — dev-render host for the REAL `<FinanceCommentsPanel>`
 * (`src/components/Finance/comments/FinanceCommentsPanel.tsx`). Priorytet #3.
 *
 * Komponent SAMODZIELNY, nie montowany w żadnym workspace produkcyjnym w tym
 * pakiecie. Mock na `window.fetch` (nazwane eksporty).
 *
 * URL: ?screen=finance-comments-panel[&lang=pl|en][&theme=light|dark]
 *   &scene=default|off
 */
import React from 'react';

import { FinanceCommentsPanel } from '../../src/components/Finance/comments/FinanceCommentsPanel';
import { FINANCE_COMMENTS_FLAG_ID } from '../../src/hooks/useFinanceCommentsFlag';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'default' | 'off' | null) ?? 'default';

if (scene !== 'off') {
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[FINANCE_COMMENTS_FLAG_ID] = true;
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const ARTIFACT_ID = 'art-dbr77-baseline-1';
const BV_ID = 'bv-dbr77-baseline-1';

let comments = [
  {
    id: 'c-1',
    artifactId: ARTIFACT_ID,
    businessVersionId: BV_ID,
    anchor: null,
    authorId: 'piotr.wisniewski',
    body: 'Sprawdź, czy DSO 45 dni jest realne wobec historii 42 dni — różnica 3 dni ma spory wpływ na kapitał obrotowy.',
    mentions: ['analityk.dbr77'],
    isBlocking: true,
    resolvedBy: null,
    resolvedAt: null,
    createdBy: 'piotr.wisniewski',
    createdAt: '2026-08-11T10:15:00.000Z',
    updatedAt: '2026-08-11T10:15:00.000Z',
  },
  {
    id: 'c-2',
    artifactId: ARTIFACT_ID,
    businessVersionId: BV_ID,
    anchor: null,
    authorId: 'analityk.dbr77',
    body: 'COGS % przychodu 58% wygląda spójnie z Q4 2025 — potwierdzone.',
    mentions: [],
    isBlocking: false,
    resolvedBy: 'analityk.dbr77',
    resolvedAt: '2026-08-11T12:00:00.000Z',
    createdBy: 'analityk.dbr77',
    createdAt: '2026-08-11T11:00:00.000Z',
    updatedAt: '2026-08-11T12:00:00.000Z',
  },
];

let checklist = [
  { id: 'item-1', businessVersionId: BV_ID, item: 'Zweryfikuj sumy kontrolne wobec pakietu sprawozdań FY2025', required: true, checkedBy: 'analityk.dbr77', checkedAt: '2026-08-11T12:05:00.000Z', createdBy: 'piotr.wisniewski', createdAt: '2026-08-10T09:00:00.000Z' },
  { id: 'item-2', businessVersionId: BV_ID, item: 'Potwierdź, że model nie ma ujemnej gotówki bez plugu', required: true, checkedBy: null, checkedAt: null, createdBy: 'piotr.wisniewski', createdAt: '2026-08-10T09:00:00.000Z' },
  { id: 'item-3', businessVersionId: BV_ID, item: 'Sprawdź spójność stawki podatkowej z założeniami', required: false, checkedBy: null, checkedAt: null, createdBy: 'piotr.wisniewski', createdAt: '2026-08-10T09:00:00.000Z' },
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
}

const g = window as unknown as { __COMMENTS_PANEL_FETCH__?: boolean };
if (!g.__COMMENTS_PANEL_FETCH__) {
  g.__COMMENTS_PANEL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/comments/') && url.endsWith('/resolve')) {
      const id = url.split('/comments/')[1].split('/resolve')[0];
      comments = comments.map((c) => (c.id === id ? { ...c, resolvedBy: 'piotr.wisniewski', resolvedAt: new Date().toISOString() } : c));
      return json(comments.find((c) => c.id === id));
    }
    if (url.includes('/comments/') && url.endsWith('/reopen')) {
      const id = url.split('/comments/')[1].split('/reopen')[0];
      comments = comments.map((c) => (c.id === id ? { ...c, resolvedBy: null, resolvedAt: null } : c));
      return json(comments.find((c) => c.id === id));
    }
    if (url.includes('/has-unresolved-blocking-comments')) {
      return json({ hasUnresolvedBlockingComments: comments.some((c) => c.isBlocking && !c.resolvedAt) });
    }
    if (url.includes('/comments') && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const created = {
        id: `c-${comments.length + 1}`,
        artifactId: ARTIFACT_ID,
        businessVersionId: BV_ID,
        anchor: null,
        authorId: 'piotr.wisniewski',
        body: body.body ?? '',
        mentions: body.mentions ?? [],
        isBlocking: Boolean(body.isBlocking),
        resolvedBy: null,
        resolvedAt: null,
        createdBy: 'piotr.wisniewski',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      comments = [created, ...comments];
      return json(created, 201);
    }
    if (url.includes('/comments') && method === 'GET') return json(comments);

    if (url.includes('/review-checklist/') && url.endsWith('/check')) {
      const id = url.split('/review-checklist/')[1].split('/check')[0];
      checklist = checklist.map((i) => (i.id === id ? { ...i, checkedBy: 'piotr.wisniewski', checkedAt: new Date().toISOString() } : i));
      return json(checklist.find((i) => i.id === id));
    }
    if (url.includes('/review-checklist/') && url.endsWith('/uncheck')) {
      const id = url.split('/review-checklist/')[1].split('/uncheck')[0];
      checklist = checklist.map((i) => (i.id === id ? { ...i, checkedBy: null, checkedAt: null } : i));
      return json(checklist.find((i) => i.id === id));
    }
    if (url.includes('/review-checklist') && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const created = { id: `item-${checklist.length + 1}`, businessVersionId: BV_ID, item: body.item ?? '', required: Boolean(body.required), checkedBy: null, checkedAt: null, createdBy: 'piotr.wisniewski', createdAt: new Date().toISOString() };
      checklist = [...checklist, created];
      return json(created, 201);
    }
    if (url.includes('/review-checklist') && method === 'GET') return json(checklist);

    if (url.includes('/api/')) return json([]);
    return realFetch(input as RequestInfo, init);
  };
}

function SimulatedMenu1(): React.ReactElement {
  return (
    <div className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(symulowane Menu 1 — nie część tego pakietu)</span>
    </div>
  );
}

export default function FinanceCommentsPanelScreen(): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-bg p-6" data-testid="finance-comments-panel-screen" data-scene={scene}>
      <SimulatedMenu1 />
      <div className="mx-auto mt-4 max-w-xl">
        <FinanceCommentsPanel artifactId={ARTIFACT_ID} businessVersionId={BV_ID} />
      </div>
    </div>
  );
}
