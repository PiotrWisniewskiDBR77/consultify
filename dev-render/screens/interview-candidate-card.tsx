/**
 * dev-render host — ST-2 (DEC-540 / U-09), etap 1: Interview candidate card.
 *
 * Wpis 75 P1: mounts the REAL production <InterviewHub /> on its "Initiatives"
 * tab (`?tab=initiatives`) with the rollout flag ON — the exact shell the owner
 * will see, StandardModuleBar / rail / tabs and all. Nothing about the hub, the
 * inbox or the card is re-implemented or hand-drawn here (the previous revision
 * faked a shell header — that was the P1 defect this replaces).
 *
 * The flag is turned ON the way the app reads it: `import.meta.env.
 * VITE_ST2_CANDIDATE_CARD === 'true'` (isSt2CandidateCardEnabled). Because Vite
 * inlines `import.meta.env` per module at transform time, a runtime assignment
 * inside this file cannot reach the helper — so the HARNESS SERVER is started
 * with the flag: `VITE_ST2_CANDIDATE_CARD=true npx vite --config
 * dev-render/vite.config.ts --port <port>`. That is the harness equivalent of
 * the server-start env var, with zero edits to the flag helper or the hub.
 *
 * Data: the hub's own reads go through `Api.get` (overridden below); the
 * candidate inbox uses raw `fetch` against the EXISTING endpoints
 * (GET /api/initiatives/candidates?status=pending, POST .../:id/accept), stubbed
 * on globalThis.fetch. Three interview candidates are returned — two authored by
 * the signed-in member (rendered) and one by someone else (filtered out), which
 * is what makes the author-only visibility rule visible in the shot. Approving
 * materializes a draft via the accept receipt shape (no jump to the module).
 *
 * URL: ?screen=interview-candidate-card &tab=initiatives &lang=en|pl &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InterviewHub } from '../../src/components/Interview/InterviewHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const CURRENT_USER_ID = 'user-piotr-1';

// TEAM_MEMBER (non-admin) so the inbox applies the author-only filter, plus an
// explicit INTERVIEW_INSIGHTS_VIEW permission read synchronously from the store
// so the "Initiatives" deep-link is honored on first render (no async race).
useAppStore.setState({
  currentUser: {
    id: CURRENT_USER_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@dbr77.com',
    role: 'TEAM_MEMBER',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    organizationId: 'org-northwind',
    permissions: ['INTERVIEW_INSIGHTS_VIEW'],
  } as any,
  currentOrganization: {
    id: 'org-northwind',
    name: 'Northwind',
  } as any,
});

const NOW = Date.now();
const hoursAgo = (n: number) => new Date(NOW - n * 3600000).toISOString();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

// Interview-sourced initiative drafts already in the tab's table (the inbox sits
// above them; approving a candidate adds a new draft here).
const INTERVIEW_INITIATIVES = [
  {
    id: 'init-line-1',
    title: 'Standardize packing-line changeover',
    name: 'Standardize packing-line changeover',
    description: 'Draft promoted from an interview finding on the packing cell.',
    status: 'DRAFT',
    priority: 'high',
    source: 'interview_insight',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
  },
  {
    id: 'init-scrap-1',
    title: 'Welding-cell scrap reduction',
    name: 'Welding-cell scrap reduction',
    description: 'Draft promoted from two corroborating interview submissions.',
    status: 'PENDING_REVIEW',
    priority: 'medium',
    source: 'interview_insight',
    createdAt: daysAgo(9),
    updatedAt: daysAgo(3),
  },
];

const CANDIDATES = [
  {
    id: 'cand-changeover-1',
    title: 'Packing line changeover standard work',
    rationale:
      'Interview with the packing lead surfaced a recurring 40-minute changeover with no documented standard; captured as an initiative candidate.',
    sourceType: 'interview_insight_finding',
    sourceId: 'finding-88',
    status: 'pending',
    createdBy: CURRENT_USER_ID,
    createdAt: hoursAgo(5),
  },
  {
    id: 'cand-scrap-2',
    title: 'Reduce scrap on the welding cell',
    rationale:
      'Two interviewees independently flagged welding-cell scrap as the top weekly loss driver.',
    sourceType: 'interview_submission',
    sourceId: 'sub-14',
    status: 'pending',
    createdBy: CURRENT_USER_ID,
    createdAt: hoursAgo(9),
  },
  {
    // Authored by someone else — must NOT render for the signed-in member.
    id: 'cand-other-3',
    title: "Another user's candidate (must stay hidden)",
    rationale: 'This candidate belongs to a different author and is filtered out.',
    sourceType: 'interview_insight',
    sourceId: 'ins-3',
    status: 'pending',
    createdBy: 'user-someone-else',
    createdAt: hoursAgo(11),
  },
];

// The hub's own reads (Api.*). Kept permissive so no load path rejects and the
// console stays clean (bledyKonsoli=0).
Object.assign(Api, {
  get: async (path: string) => {
    if (path.startsWith('/initiatives?') || path === '/initiatives') return INTERVIEW_INITIATIVES;
    if (path === '/pmo/projects/my-memberships') return { memberships: [] };
    if (path === '/access/effective') return { effectiveAccess: { capabilities: ['*'] } };
    if (path.startsWith('/interview/')) return [];
    if (path.startsWith('/my-work/')) return [];
    return {};
  },
  post: async () => ({}),
  put: async () => ({}),
  patch: async () => ({}),
  delete: async () => ({}),
});

// The candidate inbox uses raw fetch against the existing candidate endpoints.
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(input);
  const method = String(init?.method ?? 'GET').toUpperCase();
  if (method === 'POST' && url.includes('/accept')) {
    return jsonResponse({
      accepted: true,
      receiptPersisted: true,
      initiativeId: 'init-new-1',
      filled: true,
      payload: {},
    });
  }
  if (url.includes('/initiatives/candidates')) {
    return jsonResponse({ candidates: CANDIDATES, total: CANDIDATES.length });
  }
  // V8 capability reads (assignments / insights / sessions) go through raw fetch
  // and downstream code does `.assignments.map` / `.insights` etc. Return a
  // permissive empty shape so no load path throws (bledyKonsoli=0).
  if (url.includes('/api/v8/')) {
    return jsonResponse({
      assignments: [],
      insights: [],
      sessions: [],
      documents: [],
      items: [],
      data: [],
    });
  }
  return jsonResponse({});
};

export default function InterviewCandidateCardScreen() {
  return (
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <MemoryRouter initialEntries={['/interview?tab=initiatives']}>
        <div className="h-screen w-screen overflow-auto bg-c-surface">
          <InterviewHub />
        </div>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );
}
