/**
 * Dev-render host for VLT-005 — Client Vault: warstwa tabeli sejfów.
 *
 * Mounts the REAL `<ClientDocumentsVault>` (which now renders `VaultSafesTable`
 * first, then `DocumentsRAGTab` filtered to the clicked safe) — no
 * re-implementation. The component fetches through `Api.*` (services/api.ts,
 * backed by `fetch('/api/...')`), so we stub `window.fetch` with mock JSON
 * keyed by URL path (pattern from dev-render/screens/vault-scope-selector.tsx).
 *
 * Mock data: [Mój sejf] (2 docs, owned by ME) + [Sejf organizacji] (1 doc) +
 * 2 project safes from `my-memberships` (3 docs / 0 docs — exercises the
 * empty-safe case too).
 *
 * Render-verify: `npx vite --config dev-render/vite.config.ts --port 3410`,
 * then `?screen=vault-safes-table&theme=light|dark`.
 */
import React from 'react';

import { useAppStore } from '../../src/store/useAppStore';
import { ClientDocumentsVault } from '../../src/views/vault/ClientDocumentsVault';

const ME = 'user-piotr-1';
const OTHER = 'user-anna-2';

const MEMBERSHIPS = [
  { projectId: 'proj-1', projectName: 'DBR77 — Digital Readiness Diagnosis' },
  { projectId: 'proj-2', projectName: 'Manufacturing Segment — Ops Review' },
];

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

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

let docs = [
  {
    id: 'doc-priv-1',
    filename: 'Moje notatki z wywiadu — draft.docx',
    category: 'Other',
    tags: ['prywatne'],
    status: 'indexed',
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    chunk_count: 4,
    file_size_bytes: 84_000,
    scope: 'user',
    project_id: null,
    owner_id: ME,
  },
  {
    id: 'doc-priv-2',
    filename: 'Prywatny brief — nie do udostępnienia.pdf',
    category: 'Other',
    tags: [],
    status: 'indexing',
    created_at: daysAgo(9),
    updated_at: daysAgo(9),
    chunk_count: 0,
    file_size_bytes: 512_000,
    scope: 'user',
    project_id: null,
    owner_id: ME,
  },
  {
    id: 'doc-org-1',
    filename: 'Standardy raportowania — organizacja.pdf',
    category: 'Standards',
    tags: [],
    status: 'indexed',
    created_at: daysAgo(30),
    updated_at: daysAgo(30),
    chunk_count: 11,
    file_size_bytes: 1_240_000,
    scope: 'organization',
    project_id: null,
    owner_id: OTHER,
  },
  {
    id: 'doc-proj1-1',
    filename: 'DBR77 — Diagnoza cyfrowa v2.pdf',
    category: 'Methodology',
    tags: ['diagnoza', 'q3'],
    status: 'indexed',
    created_at: daysAgo(4),
    updated_at: daysAgo(1),
    chunk_count: 22,
    file_size_bytes: 3_400_000,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: OTHER,
  },
  {
    id: 'doc-proj1-2',
    filename: 'DBR77 — Wywiady runda 1.docx',
    category: 'Templates',
    tags: [],
    status: 'indexed',
    created_at: daysAgo(20),
    updated_at: daysAgo(20),
    chunk_count: 9,
    file_size_bytes: 960_000,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: ME,
  },
  {
    id: 'doc-proj1-3',
    filename: 'DBR77 — Kontrakt.pdf',
    category: 'Other',
    tags: [],
    // ★ Celowo status='error' — jedyny dokument w mocku ćwiczący kolumnę
    // „Błędy indeksowania" (chip danger, kanon §3 crimson=semantyka krytyczna).
    status: 'error',
    created_at: daysAgo(45),
    updated_at: daysAgo(45),
    chunk_count: 0,
    file_size_bytes: 210_000,
    scope: 'project',
    project_id: 'proj-1',
    owner_id: OTHER,
  },
  // proj-2 celowo BEZ dokumentów — sejf z licznikiem 0 i „—" w Ostatniej zmianie.
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mirrors the GROUP BY aggregation in knowledge.routes.ts `/vault-safes`,
 *  teraz też z sizeBytes/indexedCount/errorCount (3 nowe kolumny). */
const sumBytes = (list: typeof docs) => list.reduce((sum, d) => sum + (d.file_size_bytes || 0), 0);
const countIndexed = (list: typeof docs) => list.filter((d) => (d.chunk_count || 0) > 0).length;
const countErrors = (list: typeof docs) => list.filter((d) => d.status === 'error').length;

function buildSafes() {
  const myDocs = docs.filter((d) => d.scope === 'user' && d.owner_id === ME);
  const myLast = myDocs
    .map((d) => d.updated_at)
    .sort()
    .at(-1);
  const orgDocs = docs.filter((d) => d.scope === 'organization');
  const orgLast = orgDocs
    .map((d) => d.updated_at)
    .sort()
    .at(-1);

  return {
    safes: [
      {
        id: 'user',
        type: 'user',
        projectId: null,
        name: 'Mój sejf',
        documentCount: myDocs.length,
        lastModified: myLast || null,
        sizeBytes: sumBytes(myDocs),
        indexedCount: countIndexed(myDocs),
        errorCount: countErrors(myDocs),
      },
      {
        id: 'organization',
        type: 'organization',
        projectId: null,
        name: 'Sejf organizacji',
        documentCount: orgDocs.length,
        lastModified: orgLast || null,
        sizeBytes: sumBytes(orgDocs),
        indexedCount: countIndexed(orgDocs),
        errorCount: countErrors(orgDocs),
      },
      ...MEMBERSHIPS.map((m) => {
        const projDocs = docs.filter((d) => d.scope === 'project' && d.project_id === m.projectId);
        const last = projDocs
          .map((d) => d.updated_at)
          .sort()
          .at(-1);
        return {
          id: `project:${m.projectId}`,
          type: 'project',
          projectId: m.projectId,
          name: m.projectName,
          documentCount: projDocs.length,
          lastModified: last || null,
          sizeBytes: sumBytes(projDocs),
          indexedCount: countIndexed(projDocs),
          errorCount: countErrors(projDocs),
        };
      }),
    ],
  };
}

const g = window as unknown as { __VAULT_SAFES_FETCH__?: boolean };
if (!g.__VAULT_SAFES_FETCH__) {
  g.__VAULT_SAFES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes('/knowledge/vault-safes') && method === 'GET') {
        return jsonResponse(buildSafes());
      }
      if (url.includes('/projects/my-memberships') && method === 'GET') {
        return jsonResponse({ memberships: MEMBERSHIPS });
      }
      if (url.includes('/knowledge/documents') && url.includes('/scope-impact')) {
        return jsonResponse({
          previousScope: 'user',
          requestedScope: 'organization',
          becameOrgVisibleCount: 0,
        });
      }
      if (url.includes('/knowledge/documents') && method === 'POST') {
        const newDoc = {
          id: `doc-new-${docs.length + 1}`,
          filename: 'Nowy dokument.pdf',
          category: null,
          tags: [],
          status: 'indexed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
      if (url.includes('/knowledge/documents/') && method === 'PUT') {
        return jsonResponse({ success: true });
      }
      if (url.includes('/knowledge/documents') && method === 'GET') {
        const u = new URL(url, window.location.origin);
        const scope = u.searchParams.get('scope');
        const projectId = u.searchParams.get('project_id');
        let filtered = scope ? docs.filter((d) => d.scope === scope) : docs;
        if (scope === 'project' && projectId) {
          filtered = filtered.filter((d) => d.project_id === projectId);
        }
        return jsonResponse(filtered);
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function VaultSafesTableScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', height: '80vh' }}>
      <ClientDocumentsVault />
    </div>
  );
}
