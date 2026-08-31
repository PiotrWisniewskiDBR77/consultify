/**
 * Organizacja — 20 brakujących ekranów wariantu DOMYŚLNEGO (dyżur odbioru
 * grafiki, runda 150-ustawienia-organizacja, 2026-08-31).
 *
 * PROBLEM: rejestr odbioru miał dla modułu 14-organizacja tylko
 * `org-identity-operating` (i to renderujące wariant ZA FLAGĄ
 * `ff_org_redesign_v1=1` — patrz `dev-render/screens/org-identity-operating.tsx`)
 * plus historyczny, zmigrowany wiersz bez zrzutu w tym drzewie. Realny
 * DOMYŚLNY stan (flaga `orgRedesignV1` OFF od 2026-08-29 —
 * `src/utils/orgRedesignFlag.ts` linia ~64: „domyślną wartością jest OFF")
 * to `OrganizationSidebar.tsx` → `ORGANIZATION_MODULES`: 6 grup, 21 ekranów.
 * `identity-scale` ma już wpis (choć błędnie pokazuje wariant ON — zgłoszone
 * w raporcie, NIE naprawiane tutaj). Ten plik montuje REALNY
 * `<OrganizationView>` (nie replikę) BEZ flagi (domyślnie OFF) dla
 * pozostałych 20 ekranów.
 *
 * MECHANIZM NAWIGACJI: `OrganizationView` czyta trasę z prawdziwego
 * `BrowserRouter` (wewnątrz `AppProviders`), więc — inaczej niż w ekranach
 * osadzonych w `MemoryRouter` — nie można podać `initialEntries`. Zamiast
 * tego USTAWIAMY `window.history.replaceState` na docelową ścieżkę PRZED
 * montowaniem (moduł ładuje się raz na świeżą nawigację `page.goto`
 * w `grafika-zrzuty.mjs` — nie ma ryzyka kolizji z inną sesją w tej samej
 * karcie).
 *
 * DANE/MOCK — zweryfikowane grepem, nie zgadywane:
 *   profile/*                 → `OrganizationProfileModule` → jedno wołanie:
 *     `Api.get('/organization-profiles/:orgId')` (już mockowane niżej)
 *   goals/*, challenges/*, strategy/* → `GoalsExpectationsModule` /
 *     `ChallengeMapModule` / `StrategicSynthesisModule` — ZERO wołań API,
 *     czysto lokalny `useContextBuilderStore` (zustand, bez sieci)
 *   sources/files              → `OrganizationFilesBoundary` — statyczny
 *     komunikat "Pliki organizacji: NIEZWERYFIKOWANE", zero wołań
 *   sources/claims-sources,
 *   sources/source-conflicts   → `GovernedContextWorkspace` →
 *     `organizationGovernedContextApi.listClaims/listVersions` → przechodzi
 *     przez `Api.get('/organization-context/governed/claims|versions')`
 *   sources/knowledge-graph    → `KnowledgeGraphExplorer` → `Api.kgGetStats`
 *   readiness/summary          → `OrganizationDecisionQualityPanel` →
 *     `organizationGovernedContextApi.listClaims/listVersions`
 *
 * Dwa surowe `fetch` (nie przez `Api`) potwierdzone w
 * `org-identity-operating.tsx` (ten sam moduł, ten sam kod ścieżki):
 * `/api/organization-context-store` (auto-save `useOrgContextSync`) i
 * `/api/organizations/current` — oba mockowane niżej identycznie.
 *
 * Dane demo: Piotr Wiśniewski, właściciel „Atelier Toys Sp. z o.o." — spójne
 * z `dev-render/screens/admin-team.tsx` (org-atelier-toys-0001).
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import OrganizationView from '../../src/views/OrganizationView';
import type { OrganizationModule, OrganizationScreen } from '../../src/components/Organization/OrganizationSidebar';

const ORG_ID = 'org-atelier-toys-0001';
const PIOTR_ID = 'usr-piotr';

export interface OrgLegacyLocation {
  module: OrganizationModule;
  screen: OrganizationScreen;
}

// --- Route: ustawiona PRZED montowaniem, BrowserRouter (w AppProviders)
// czyta prawdziwy window.location przy pierwszym renderze.
const requestedModule = new URLSearchParams(window.location.search).get('org-module');
const requestedScreen = new URLSearchParams(window.location.search).get('org-screen');

// --- Store seed: Atelier Toys, Piotr jako OWNER (spójne z admin-team.tsx) --
useAppStore.setState({
  currentUser: {
    id: PIOTR_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@atelier-toys.pl',
    role: 'OWNER',
    organizationId: ORG_ID,
    isAuthenticated: true,
  } as any,
  currentOrganization: {
    id: ORG_ID,
    name: 'Atelier Toys Sp. z o.o.',
    plan: 'enterprise',
    status: 'active',
  } as any,
  isDemoMode: true,
} as any);

const MOCK_PROFILE = {
  name: 'Atelier Toys Sp. z o.o.',
  organization_type: 'SERVICES',
  industry: 'Professional Services',
  industry_code: '',
  industry_subsector: 'Doradztwo strategiczne i operacyjne',
  companySize: 'SMB',
  employee_count: 62,
  annual_revenue: null,
  founding_year: 2014,
  headquarters_country: 'Polska',
  currency: 'PLN',
  revenue_model: '',
  delivery_model: '',
  core_systems: ['SAP ERP', 'Salesforce CRM', 'Jira / Confluence'],
  strategic_priorities: ['Skalowanie praktyki konsultingowej', 'Wejście na rynek DACH'],
  competitive_position: 'CHALLENGER',
  growth_stage: 'SCALE_UP',
  mission_statement: '',
  vision_statement: '',
  digital_maturity_overall: null,
  technology_stack: [],
  cloud_adoption_level: '',
  digital_budget_percent: null,
  primary_markets: ['Polska', 'DACH'],
  customer_segments: ['Handel detaliczny', 'Produkcja'],
  key_competitors: [],
  market_share_estimate: null,
  regulatory_environment: [],
  risk_appetite: '',
  budget_constraints: '',
  timeline_constraints: '',
  description:
    'Niezależna firma doradcza realizująca programy strategii, modelu operacyjnego i transformacji dla klientów z sektora handlu i produkcji.',
  website: '',
  communication_style: '',
  industry_jargon_level: '',
  production_archetype: '',
  shift_pattern: '',
  automation_level: '',
  profile_completeness: 68,
};

const MOCK_CLAIMS = [
  {
    claimId: 'claim-1',
    itemId: 'item-1',
    claimPath: 'profile.description',
    value: 'Niezależna firma doradcza z sektora handlu i produkcji.',
    confidence: 0.86,
    sourceType: 'interview',
    visibilityScope: 'organization',
    reviewState: 'approved' as const,
    approved: true,
    approvalSource: 'explicit_review' as const,
    decidedBy: PIOTR_ID,
    decidedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    claimId: 'claim-2',
    itemId: 'item-2',
    claimPath: 'profile.industry',
    value: 'Professional Services',
    confidence: 0.91,
    sourceType: 'document',
    visibilityScope: 'organization',
    reviewState: 'pending' as const,
    approved: false,
    approvalSource: 'legacy_auto_accept' as const,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
const MOCK_VERSIONS = [
  {
    snapshotId: 'snap-1',
    organizationId: ORG_ID,
    version: 3,
    schemaVersion: 1,
    contentHash: 'sha256-mock',
    claimCount: 87,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdBy: PIOTR_ID,
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const orgContextStoreState: { goals: unknown; challenges: unknown; synthesis: unknown } = {
  goals: {},
  challenges: {},
  synthesis: {},
};
let orgContextStoreVersion = 0;

const g = window as unknown as { __ORG_LEGACY_FETCH__?: boolean };
if (!g.__ORG_LEGACY_FETCH__) {
  g.__ORG_LEGACY_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/organization-context-store')) {
      const method = (init?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        return jsonResponse({
          goals: orgContextStoreState.goals,
          challenges: orgContextStoreState.challenges,
          synthesis: orgContextStoreState.synthesis,
          version: String(orgContextStoreVersion),
        });
      }
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (Object.prototype.hasOwnProperty.call(body, 'goals')) orgContextStoreState.goals = body.goals;
      if (Object.prototype.hasOwnProperty.call(body, 'challenges'))
        orgContextStoreState.challenges = body.challenges;
      if (Object.prototype.hasOwnProperty.call(body, 'synthesis'))
        orgContextStoreState.synthesis = body.synthesis;
      orgContextStoreVersion += 1;
      return jsonResponse({ ok: true, version: String(orgContextStoreVersion) });
    }
    if (url.includes('/api/organizations/current')) {
      return jsonResponse({
        organizations: [{ id: ORG_ID, name: 'Atelier Toys Sp. z o.o.', is_current: true }],
      });
    }
    return realFetch(input as RequestInfo, init);
  }) as typeof window.fetch;
}

const originalGet = Api.get.bind(Api);
(Api as any).get = async (path: string, ...rest: unknown[]) => {
  if (path.startsWith('/organization-profiles/')) {
    return { exists: true, profile: MOCK_PROFILE };
  }
  if (path.startsWith('/organization-context/governed/claims')) {
    return { claims: MOCK_CLAIMS };
  }
  if (path.startsWith('/organization-context/governed/versions')) {
    return { versions: MOCK_VERSIONS };
  }
  if (path === '/organization-context') {
    return { profile: { defaultLanguage: 'pl', defaultTimezone: 'Europe/Warsaw', currency: 'PLN' } };
  }
  return (originalGet as any)(path, ...rest);
};
(Api as any).put = async () => ({ ok: true });
(Api as any).kgGetStats = async () => ({
  totalEntities: 38,
  totalRelations: 74,
  entityTypes: { Organization: 1, Person: 9, System: 6, Process: 18 },
  avgConfidence: 0.79,
  staleEntities: 2,
  redactedEntities: 0,
});
(Api as any).kgSearchEntities = async () => [];

class DebugBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 16, color: 'red', whiteSpace: 'pre-wrap' }}>
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

export default function OrgLegacyScreen(props: OrgLegacyLocation): React.ReactElement {
  const module = (requestedModule as OrganizationModule) || props.module;
  const screen = (requestedScreen as OrganizationScreen) || props.screen;
  // Ustaw ścieżkę PRZED montowaniem — BrowserRouter czyta window.location raz
  // przy inicjalizacji; ta sama sztuczka co realny link „Wróć" nawigujący
  // wewnątrz aplikacji, tu tylko podana z wyprzedzeniem.
  window.history.replaceState(null, '', `/organization/${module}/${screen}`);

  return (
    <DebugBoundary>
      <AppProviders>
        <OrganizationView />
      </AppProviders>
    </DebugBoundary>
  );
}
