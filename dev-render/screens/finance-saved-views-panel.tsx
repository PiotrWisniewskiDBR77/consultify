/**
 * AP-CLIENT (Gate J) — dev-render host for the REAL `<FinanceSavedViewsPanel>`
 * (`src/components/Finance/savedViews/FinanceSavedViewsPanel.tsx`). Priorytet #4.
 *
 * URL: ?screen=finance-saved-views-panel[&lang=pl|en][&theme=light|dark]
 *   &scene=default|off
 */
import React from 'react';

import { FinanceSavedViewsPanel } from '../../src/components/Finance/savedViews/FinanceSavedViewsPanel';
import { FINANCE_SAVED_VIEWS_FLAG_ID } from '../../src/hooks/useFinanceSavedViewsFlag';
import { emptyGridViewStateSnapshot } from '../../src/services/api/financeV2.types';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'default' | 'off' | null) ?? 'default';

// Explicit true/false (not "skip when off") — localStorage persists across page.goto()
// within the same browser context. See finance-lineage-navigator.tsx for the bug this fixes.
{
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[FINANCE_SAVED_VIEWS_FLAG_ID] = scene !== 'off';
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const ARTIFACT_ID = 'art-dbr77-analysis-1';

let views = [
  {
    id: 'view-team-1',
    artifactId: ARTIFACT_ID,
    artifactType: 'HISTORICAL_ANALYSIS',
    scope: 'TEAM',
    ownerUserId: 'analityk.dbr77',
    name: 'Widok zespołu — tylko rentowność',
    viewState: {
      schemaVersion: 1,
      gridViewState: emptyGridViewStateSnapshot(),
      filters: [{ type: 'category', values: ['PROFITABILITY'] }],
    },
    shareToken: 'share-team-1',
    createdBy: 'analityk.dbr77',
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
  },
  {
    id: 'view-personal-1',
    artifactId: ARTIFACT_ID,
    artifactType: 'HISTORICAL_ANALYSIS',
    scope: 'PERSONAL',
    ownerUserId: 'piotr.wisniewski',
    name: 'Mój widok — braki danych',
    viewState: {
      schemaVersion: 1,
      gridViewState: emptyGridViewStateSnapshot(),
      filters: [{ type: 'missing', onlyMissing: true }],
    },
    shareToken: 'share-personal-1',
    createdBy: 'piotr.wisniewski',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
  },
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __SAVED_VIEWS_PANEL_FETCH__?: boolean };
if (!g.__SAVED_VIEWS_PANEL_FETCH__) {
  g.__SAVED_VIEWS_PANEL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/saved-views') && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const created = {
        id: `view-${views.length + 1}`,
        artifactId: ARTIFACT_ID,
        artifactType: 'HISTORICAL_ANALYSIS',
        scope: body.scope ?? 'PERSONAL',
        ownerUserId: 'piotr.wisniewski',
        name: body.name ?? '',
        viewState: {
          schemaVersion: 1,
          gridViewState: body.gridViewState,
          filters: body.filters ?? [],
        },
        shareToken: `share-${views.length + 1}`,
        createdBy: 'piotr.wisniewski',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      views = [...views, created];
      return json(created, 201);
    }
    if (url.includes('/saved-views') && method === 'DELETE') {
      const id = url.split('/saved-views/')[1];
      views = views.filter((v) => v.id !== id);
      return new Response(null, { status: 204 });
    }
    if (url.includes('/saved-views') && method === 'GET') return json(views);

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

export default function FinanceSavedViewsPanelScreen(): React.ReactElement {
  return (
    <div
      className="min-h-screen bg-c-bg p-6"
      data-testid="finance-saved-views-panel-screen"
      data-scene={scene}
    >
      <SimulatedMenu1 />
      <div className="mx-auto mt-4 max-w-md">
        <FinanceSavedViewsPanel artifactId={ARTIFACT_ID} onApplyView={() => {}} />
      </div>
    </div>
  );
}
