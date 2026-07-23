/**
 * Dev-render host for the REAL `<DocumentsRAGTab variant="client" />` (Client
 * Vault) — VLT-003: selektor poziomu przy uploadzie, badge poziomu na kafelku,
 * filtr poziomu, ostrzeżenie zmiany zakresu prywatny→organizacja.
 *
 * No re-implementation: the component fetches through `Api.*` (services/api.ts,
 * backed by `fetch('/api/...')`), so we stub `window.fetch` with mock JSON
 * keyed by URL path (pattern from dev-render/screens/assessment-reports-panel.tsx).
 * `useAppStore` is set directly so `currentUser.id` matches the mock private
 * document's `owner_id` — this is what gates the scope-change UI (mirrors the
 * backend's `canEditOwnPrivateDocument`).
 */
import React from 'react';

import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { DocumentsRAGTab } from '../../src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab';

const ME = 'user-piotr-1';

const PROJECTS = [
  { id: 'proj-1', name: 'DBR77 — Digital Readiness Diagnosis' },
  { id: 'proj-2', name: 'Manufacturing Segment — Ops Review' },
];

// ★ dev-render/screens/karta-task.tsx unconditionally overwrites `Api.getProjects`
// to `async () => []` as a top-level side effect (its own "safety net" for a
// heavy component) — since main.tsx statically imports EVERY screen module
// regardless of `?screen=`, that assignment always runs and clobbers the real
// getProjects for the whole harness session. Re-assign it back here (this
// import is last in main.tsx, so it wins) so the project selector has data.
(Api as any).getProjects = async () => PROJECTS;

useAppStore.setState({
  currentUser: {
    id: ME,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@dbr77.com',
    companyName: 'DBR77',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    organizationId: 'org-dbr77',
  } as any,
});

let docs = [
  {
    id: 'doc-priv-1',
    filename: 'Moje notatki z wywiadu — draft.docx',
    category: 'Other',
    tags: ['prywatne'],
    status: 'indexed',
    created_at: '2026-07-20T09:00:00Z',
    chunk_count: 4,
    scope: 'user',
    project_id: null,
    owner_id: ME,
  },
  {
    id: 'doc-proj-1',
    filename: 'DBR77 — Diagnoza cyfrowa v2.pdf',
    category: 'Methodology',
    tags: ['diagnoza', 'q3'],
    status: 'indexed',
    created_at: '2026-07-18T09:00:00Z',
    chunk_count: 22,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: 'user-anna-2',
  },
  {
    id: 'doc-org-1',
    filename: 'Standardy raportowania — organizacja.pdf',
    category: 'Standards',
    tags: [],
    status: 'indexed',
    created_at: '2026-06-01T09:00:00Z',
    chunk_count: 11,
    scope: 'organization',
    project_id: null,
    owner_id: 'user-anna-2',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __VAULT_SCOPE_FETCH__?: boolean };
if (!g.__VAULT_SCOPE_FETCH__) {
  g.__VAULT_SCOPE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/knowledge/documents') && url.includes('/scope-impact')) {
        const u = new URL(url, window.location.origin);
        const scope = u.searchParams.get('scope');
        return jsonResponse({
          previousScope: 'user',
          requestedScope: scope,
          becameOrgVisibleCount: scope === 'organization' ? 1 : 0,
        });
      }
      if (url.includes('/knowledge/documents') && url.includes('/scope') && method === 'PATCH') {
        const id = url.split('/knowledge/documents/')[1]?.split('/')[0];
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        docs = docs.map((d) =>
          d.id === id ? { ...d, scope: body.scope, project_id: body.project_id || null } : d
        );
        return jsonResponse({
          success: true,
          becameOrgVisibleCount: body.scope === 'organization' ? 1 : 0,
        });
      }
      if (url.includes('/knowledge/documents/') && method === 'PUT') {
        return jsonResponse({ success: true });
      }
      if (url.includes('/knowledge/documents') && method === 'POST') {
        const newDoc = {
          id: `doc-new-${docs.length + 1}`,
          filename: 'Nowy dokument.pdf',
          category: null,
          tags: [],
          status: 'indexed',
          created_at: new Date().toISOString(),
          chunk_count: 3,
          scope: 'organization',
          project_id: null,
          owner_id: ME,
        };
        docs = [newDoc, ...docs];
        return jsonResponse({
          message: 'Document uploaded and indexed',
          docId: newDoc.id,
          chunkCount: 3,
        });
      }
      if (url.includes('/knowledge/documents') && method === 'GET') {
        const u = new URL(url, window.location.origin);
        const scope = u.searchParams.get('scope');
        const filtered = scope ? docs.filter((d) => d.scope === scope) : docs;
        return jsonResponse(filtered);
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function VaultScopeSelectorScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <DocumentsRAGTab variant="client" />
    </div>
  );
}
