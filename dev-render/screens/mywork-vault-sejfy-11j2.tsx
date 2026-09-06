/**
 * ZLECENIE 1.1-J2 (DEC-408, przejście właściciela 06.09) — Menu 2 zakładka
 * „Sejf klienta" → „Sejfy" (en: "Vaults"), okruszek „Moja Praca › Sejfy".
 *
 * Mounts the REAL `<MyWorkHub>` on the `vault` tab (`?tab=vault`,
 * `isClientVaultEnabled()` defaults ON — see `src/utils/clientVaultFlag.ts`)
 * so the Menu 2 pill label and the topbar breadcrumb both come from the
 * REAL production code path (`MyWorkHub.tsx` — both now read the same
 * `myWork.hub.vault` i18n key), same "no login, no real fetch" recipe as
 * `mywork-tasks.tsx` (My Work safety-net mock) combined with the vault
 * fetch mocks from `vault-safes-table.tsx` (so `<ClientDocumentsVault>`
 * mounts cleanly instead of erroring on real `/api/knowledge/vault-safes`).
 *
 * URL: ?screen=mywork-vault-sejfy-11j2[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api, type DataContextSummary } from '../../src/services/api';
import { V8MyWorkApi } from '../../src/services/api/v8/my-work';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Same easing as mywork-calendar.tsx/mywork-decisions.tsx/mywork-tasks.tsx —
// the hub transiently mounts InboxContent on first paint regardless of the
// requested tab; give it an empty, non-throwing shape.
V8MyWorkApi.getCanonicalInboxTable = (async () => ({
  items: [],
})) as typeof V8MyWorkApi.getCanonicalInboxTable;
V8MyWorkApi.getCanonicalInboxStats = (async () => ({
  total: 0,
  byPriority: {},
  bySection: {},
  byStatus: {},
  bySlaStatus: {},
})) as typeof V8MyWorkApi.getCanonicalInboxStats;
V8MyWorkApi.materializeCanonicalInbox = (async () => ({
  success: true,
  upserted: 0,
})) as typeof V8MyWorkApi.materializeCanonicalInbox;

const ME = 'user-piotr-demo';

Api.getPersonalTasks = (async () => []) as typeof Api.getPersonalTasks;
Api.getDataContext = (async (): Promise<DataContextSummary> => ({
  status: 'ok',
  generatedAt: new Date().toISOString(),
  database: { source: 'dev-render-mock', host: null, name: null, readonly: true },
  organization: { activeOrganizationId: 'org-dbr77-demo', userOrganizationId: 'org-dbr77-demo' },
  user: { id: ME, email: 'piotr@dbr77.com' },
  demo: { enabled: true, organizationId: 'org-dbr77-demo', headerActive: true },
})) as typeof Api.getDataContext;
Api.get = (async (url: string) => {
  if (url.includes('/my-work/focus/state')) return { data: { items: [] } };
  return { data: [], items: [] };
}) as typeof Api.get;

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

// Minimal vault content — one own doc, one org doc — just enough for
// `<ClientDocumentsVault>`/`VaultSafesTable` to render real rows instead of
// an empty/error state; the counts don't matter for this screen (DEC-408 is
// about the Menu 2 label + breadcrumb, not the vault's own contents).
const VAULT_DOCS = [
  {
    id: 'doc-priv-1',
    filename: 'Notatki własne — draft.docx',
    category: 'Other',
    tags: [],
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
    id: 'doc-org-1',
    filename: 'Standardy raportowania — organizacja.pdf',
    category: 'Standards',
    tags: [],
    status: 'indexed',
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    chunk_count: 9,
    file_size_bytes: 640_000,
    scope: 'organization',
    project_id: null,
    owner_id: 'user-anna-demo',
  },
];

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __MYWORK_VAULT_11J2_FETCH__?: boolean };
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'mywork-vault-sejfy-11j2';
if (__tenEkran && !g.__MYWORK_VAULT_11J2_FETCH__) {
  g.__MYWORK_VAULT_11J2_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    try {
      if (url.includes('/knowledge/vault-safes') && method === 'GET') {
        return jsonResponse({
          safes: [
            { id: 'safe-user', type: 'user', name: null, projectId: null },
            { id: 'safe-org', type: 'organization', name: null, projectId: null },
          ],
        });
      }
      if (url.includes('/projects/my-memberships') && method === 'GET') {
        return jsonResponse({ memberships: [] });
      }
      if (url.includes('/knowledge/documents') && method === 'GET') {
        const u = new URL(url, window.location.origin);
        const scope = u.searchParams.get('scope');
        const filtered = scope ? VAULT_DOCS.filter((d) => d.scope === scope) : VAULT_DOCS;
        return jsonResponse(filtered);
      }
    } catch {
      /* fall through */
    }
    if (url.includes('/api/') || url.includes('/my-work/')) {
      return jsonResponse({ data: [], items: [] });
    }
    return realFetch(input as RequestInfo, init);
  };
}

// `?tab=vault` is only resolved ONCE, in `getInitialMyWorkTab`'s
// `useState(() => ...)` initializer (MyWorkHub.tsx:880) — unlike the path
// segments (`/my-work/tasks`, etc.), there is no reactive `useEffect` that
// re-derives `activeTab` from a later `tab=` query-param change (that only
// exists for `parseMyWorkPathIntent`, which doesn't handle `vault` at all).
// A post-mount `useNavigate()` call (the `mywork-tasks.tsx` pattern) would
// therefore land on the DEFAULT tab, not vault. Fix: rewrite
// `window.location` synchronously, BEFORE `<BrowserRouter>` (inside
// `<AppProviders>`) ever reads it — dev-render/main.tsx has already
// resolved ITS OWN `?screen=` param at its own module top level by the time
// this lazy-loaded screen module runs, so mutating history here doesn't
// affect which screen got selected.
if (!window.location.pathname.startsWith('/my-work')) {
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', `/my-work?tab=vault&${params.toString()}`);
}

// DEC-408 acceptance asks for a screenshot of the topbar breadcrumb ("Moja
// Praca › Sejfy"), but that bar is rendered by `AppRoutes.tsx` — the shared
// app shell OUTSIDE `<MyWorkHub>` — which this no-login harness deliberately
// doesn't mount (too much of the app's own routing/auth plumbing for a
// label check). `<MyWorkHub>` writes the crumbs into the SAME store
// (`useAppStore().myWorkBreadcrumbs`) that shell reads from, so surfacing
// that exact value here — harness-only debug strip, never shipped — is
// honest proof of the real breadcrumb content without re-mounting the shell.
function BreadcrumbDebugStrip(): React.ReactElement {
  const crumbs = useAppStore((s) => s.myWorkBreadcrumbs);
  return (
    <div
      data-testid="dev-render-breadcrumb-debug"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '6px 12px',
        background: '#0f172a',
        color: '#e2e8f0',
        fontSize: 12,
        fontFamily: 'monospace',
        borderBottom: '1px solid #334155',
      }}
    >
      {crumbs && crumbs.length > 0 ? crumbs.join(' › ') : '(brak okruszków)'}
    </div>
  );
}

export function MyWorkVaultSejfyScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <BreadcrumbDebugStrip />
        <MyWorkHub />
      </div>
    </AppProviders>
  );
}

export default MyWorkVaultSejfyScreen;
