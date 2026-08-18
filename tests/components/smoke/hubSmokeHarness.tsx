/**
 * VEGAS V7.8 — hub smoke-suite shared harness.
 *
 * Goal: render each top-level module hub (MyWork, Initiatives, Outputs, Finance,
 * Results, Assessment, Admin/Settings) with a MINIMAL, shared mock surface and
 * assert only "renders without crashing + shows its header". This is a tripwire
 * against import-time / first-render regressions, NOT a behavioural test.
 *
 * Mock philosophy (mirrors tests/components/MyWork/* Notebook conventions):
 *   - react-i18next  → t() returns the string/defaultValue fallback (so header
 *                      text is the readable English label the hubs pass in).
 *   - react-router   → real MemoryRouter (routing hooks work), useNavigate no-op.
 *   - ModuleHub      → light stub that surfaces the tab labels + children, so the
 *                      hub's own header/tab config is what we assert on. 6 of 7
 *                      hubs compose ModuleHub; Admin renders its own <h1>.
 *   - network        → global.fetch stubbed to a benign empty-OK response so no
 *                      real request fires and data hooks settle to empty state.
 *
 * NOTE: this file is imported by the suite; it MUST be imported before the hub
 * modules so the vi.mock() hoisting applies. Vitest hoists vi.mock to the top of
 * the importing module, so re-exporting the mocks here + calling installHubMocks()
 * at module scope of the test file keeps ordering correct.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';

import { AccessPolicyProvider } from '@/contexts/AccessPolicyContext';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';

// ── i18n: return the human-readable fallback so header assertions are stable ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'defaultValue' in (fallback as any)) {
        return (fallback as any).defaultValue as string;
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// ── react-router: keep real behaviour but silence navigation ──────────────────
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// ── ModuleHub stub: render tabs (labels) + command rows + children ────────────
// Path used by every hub is '@/components/shared/ModuleHub/ModuleHub'.
vi.mock('@/components/shared/ModuleHub/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, commandRowContent, commandRowRightContent, children }: any) => (
    <div data-testid="module-hub">
      <nav data-testid="module-hub-tabs">
        {(tabs || []).map((tab: any) => (
          <button key={tab.id} type="button" data-active={activeTab === tab.id}>
            {tab.label}
          </button>
        ))}
      </nav>
      <div data-testid="module-hub-command-row">
        {commandRowContent}
        {commandRowRightContent}
      </div>
      <div data-testid="module-hub-body">{children}</div>
    </div>
  ),
}));

vi.mock('@/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

// ── Heavy document-editor leaf views ──────────────────────────────────────────
// Several hubs eagerly import a rich-text/notebook document view whose module
// graph pulls `lowlight` + `highlight.js` (not installed in the test env). These
// leaves are NOT part of the "hub shell renders" contract, so stub them to a
// trivial element. Mirrors tests/components/MyWork/NotebookContent.*'s approach of
// mocking `notebook/extensions`.
vi.mock('@/components/MyWork/NotebookContent', () => ({
  NotebookContent: ({ notebookTitle }: { notebookTitle?: string }) => (
    <div data-testid="stub-notebook-content">{notebookTitle}</div>
  ),
}));
vi.mock('@/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => <div data-testid="stub-initiative-document-view" />,
}));
// Results ValueDriverTree self-fetches and eagerly iterates payload.nodes; it's a
// leaf viz, not part of the hub-shell contract. Stub it to avoid the async render.
vi.mock('@/components/Results/ValueDriverTree', () => ({
  __esModule: true,
  default: () => <div data-testid="stub-value-driver-tree" />,
}));

// ── useAppStore: superset mock ────────────────────────────────────────────────
// tests/setup.ts installs a global useAppStore mock with only a handful of fields.
// Several hubs (notably MyWorkHub) destructure the whole store and call many
// setters (setChatSystemPrompt, setMyWorkBreadcrumbs, …) that the global mock
// omits → "x is not a function" in a passive effect. Override it here with a
// Proxy that returns a no-op vi.fn() for any missing key, and stable defaults for
// the known state fields. Selector and bare-call forms both supported.
const APP_STORE_STATE: Record<string, unknown> = {
  currentUser: {
    id: 'smoke-user',
    email: 'smoke@example.com',
    name: 'Smoke User',
    role: 'admin',
    isAuthenticated: true,
    organizationId: 'smoke-org',
  },
  currentProjectId: null,
  currentOrganization: { id: 'smoke-org', name: 'Smoke Org' },
  organization: { id: 'smoke-org', name: 'Smoke Org' },
  aiConfig: { selectedTier: 'STANDARD', selectedModelId: null, autoMode: false },
  theme: 'light',
  language: 'en',
  isAuthenticated: true,
  isDemoMode: false,
  isChatCollapsed: false,
  isSidebarCollapsed: false,
  notifications: [],
  myWorkIntent: null,
  myWorkEvent: null,
};
const appStoreProxy = new Proxy(APP_STORE_STATE, {
  get(target, prop: string) {
    if (prop in target) return (target as any)[prop];
    // Unknown key → assume it's an action; return a stable no-op fn.
    const fn = vi.fn();
    (target as any)[prop] = fn;
    return fn;
  },
});
function mockedUseAppStore(selector?: (s: any) => unknown) {
  return selector ? selector(appStoreProxy) : appStoreProxy;
}
(mockedUseAppStore as any).getState = () => appStoreProxy;
(mockedUseAppStore as any).setState = vi.fn();
(mockedUseAppStore as any).subscribe = vi.fn(() => vi.fn());
vi.mock('@/store/useAppStore', () => ({ useAppStore: mockedUseAppStore }));

// ── network: no real requests; benign empty-OK for anything the hubs fetch ────
export function installFetchStub(): void {
  // A benign empty payload with the common collection keys pre-set to [] so that
  // views which eagerly destructure `payload.nodes` / `.items` / `.data` etc.
  // (e.g. Results ValueDriverTree does `for (const n of data.nodes)`) don't throw
  // on an empty-state fetch. Extra keys are harmless.
  // NOTE: deliberately no `data` key — some callers do `res?.data ?? res` and a
  // `data: []` would shadow the real body (making `payload.nodes` undefined).
  const EMPTY_BODY = {
    nodes: [],
    edges: [],
    items: [],
    results: [],
    rows: [],
    entries: [],
    list: [],
    total: 0,
    success: true,
  };
  const okEmpty = () =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ...EMPTY_BODY }),
      text: async () => JSON.stringify(EMPTY_BODY),
      clone() {
        return this as any;
      },
    } as unknown as Response);
  vi.stubGlobal('fetch', vi.fn(okEmpty));
}

// A minimal current user for hubs that require one (AdminSettingsModule).
export const SMOKE_USER = {
  id: 'smoke-user',
  email: 'smoke@example.com',
  name: 'Smoke User',
  firstName: 'Smoke',
  lastName: 'User',
  role: 'admin',
  organizationId: 'smoke-org',
} as any;

/** Render a hub element inside the router + react-query harness. */
export function renderHub(element: React.ReactElement, initialPath = '/'): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <AccessPolicyProvider>
          <MemoryRouter initialEntries={[initialPath]}>{element}</MemoryRouter>
        </AccessPolicyProvider>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}
