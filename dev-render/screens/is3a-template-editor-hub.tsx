/**
 * dev-render host — IS-3a (Wpis 95 / DEC-533, U-07): the REAL production
 * <InterviewHub /> on its Templates tab with the interview template editor open
 * as a document, exactly the path a user takes (Templates → open template).
 *
 * Nothing is re-implemented: the hub, its rail/tabs and the <TemplateBuilder />
 * are the production components. The document is opened the way a user opens
 * it — Templates list row → StandardPreview "Open" (onOpenFull →
 * handleViewTemplate) — driven by the shot tool's --click sequence, because the
 * hub clears any sessionStorage-seeded activeDocumentId on mount/tab change.
 *
 * The rollout flag is read at transform time (`import.meta.env.
 * VITE_INTERVIEW_TEMPLATE_FULLPAGE === 'true'`), so the harness server is
 * started per variant:
 *   OFF (default): npx vite --config dev-render/vite.config.ts --port 5412
 *   ON:            VITE_INTERVIEW_TEMPLATE_FULLPAGE=true npx vite ... --port 5413
 *
 * URL: ?screen=is3a-template-editor-hub &lang=en|pl &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InterviewHub } from '../../src/components/Interview/InterviewHub';
import { createInterviewDemoDataset } from '../../src/components/Interview/interviewDemoData';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const DEMO = createInterviewDemoDataset();

useAppStore.setState({
  currentUser: {
    id: 'user-piotr-1',
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

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Object.assign(Api, {
  get: async (path: string) => {
    if (path === '/interview/templates') return DEMO.templates;
    if (path.startsWith('/initiatives?') || path === '/initiatives') return [];
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

(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(input);
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
  if (url.includes('/initiatives/candidates')) {
    return jsonResponse({ candidates: [], total: 0 });
  }
  return jsonResponse({});
};

export default function Is3aTemplateEditorHubScreen() {
  return (
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <MemoryRouter initialEntries={['/interview?tab=templates']}>
        <div className="h-screen w-screen overflow-auto bg-c-surface">
          <InterviewHub />
        </div>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );
}
