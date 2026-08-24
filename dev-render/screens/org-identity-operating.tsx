/**
 * M01 Organizacja — redesign v1, ekran „Tożsamość i model działania".
 *
 * Montuje REALNY `OrganizationView` (nie replikę) w realnym drzewie
 * `AppProviders`, z flagą `orgRedesignV1` włączoną z URL-a
 * (`?ff_org_redesign_v1=1` — `isOrgRedesignV1Enabled()` czyta window.location).
 * Dzięki temu zrzut pokazuje dokładnie to, co zobaczy użytkownik po włączeniu
 * flagi: nawigację 11 ekranów, Menu 2/Menu 3 ze `StandardModuleBar`, karty
 * treści i prawy panel stanu.
 *
 * CLAUDE.md §7: to JA renderuję i zrzucam ekran zanim zobaczy go właściciel.
 *
 * Dane: `Api.get('/organization-profiles/:id')` i `Api.organizationContextGet()`
 * są podmienione na realistyczny profil doradczy + dwa realne konflikty
 * twierdzeń (`profile.description`, `profile.industry`), żeby panel „Wymaga
 * decyzji" pokazywał ścieżkę, którą faktycznie liczy kod, a nie atrapę.
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import OrganizationView from '../../src/views/OrganizationView';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const MOCK_PROFILE = {
  name: 'Northstar Advisory Group',
  organization_type: 'SERVICES',
  industry: 'Professional Services',
  industry_code: '',
  industry_subsector: 'Doradztwo strategiczne i operacyjne',
  companySize: 'SMB',
  employee_count: 180,
  annual_revenue: null,
  founding_year: 2011,
  headquarters_country: 'Polska',
  currency: 'PLN',
  revenue_model: '',
  delivery_model: '',
  core_systems: ['SAP ERP', 'Salesforce CRM', 'Jira / Confluence'],
  strategic_priorities: ['Skalowanie praktyki operacyjnej'],
  competitive_position: 'CHALLENGER',
  growth_stage: 'SCALE_UP',
  mission_statement: '',
  vision_statement: '',
  digital_maturity_overall: null,
  technology_stack: [],
  cloud_adoption_level: '',
  digital_budget_percent: null,
  primary_markets: ['Polska', 'DACH', 'Nordics'],
  customer_segments: ['Przemysł', 'Energetyka'],
  key_competitors: [],
  market_share_estimate: null,
  regulatory_environment: [],
  risk_appetite: '',
  budget_constraints: '',
  timeline_constraints: '',
  description:
    'Niezależna firma usług profesjonalnych realizująca programy strategii, modelu operacyjnego i transformacji dla klientów przemysłowych.',
  website: '',
  communication_style: '',
  industry_jargon_level: '',
  production_archetype: '',
  shift_pattern: '',
  automation_level: '',
  profile_completeness: 71,
};

/**
 * DWA surowe `fetch`-e omijają obiekt `Api`, więc samo podmienienie `Api.*`
 * ich nie łapie — a bez backendu vite oddaje im `index.html`, co kończy się
 * „Unexpected token '<'" i żółtym banerem „Changes are stored locally…":
 *   - `useOrgContextSync` → GET/PUT `/api/organization-context-store`
 *     (src/hooks/useOrgContextSync.ts) — to ON zapala baner,
 *   - `OrgContext` → GET `/api/organizations/current` (błąd w konsoli).
 * Oba to WYŁĄCZNIE brak backendu w harnessie, nie ścieżka zapisu nowego ekranu
 * (ta idzie przez `Api.put('/organization-profiles/:id')`, podmienione niżej).
 * Reszta `/api/**` celowo leci dalej — żeby prawdziwe błędy nadal było widać.
 */
// M01 FAZA 2 (DEC-2026-08-24-15): stan w pamięci, TAK JAK realna trasa
// `/api/organization-context-store` (GET zwraca to, co ostatni PUT zapisał;
// PUT nadpisuje TYLKO klucze przysłane w body — patrz `server/src/routes/
// organization-context-store.routes.ts`). Bez tego „Zapisz zmiany" na pięciu
// ekranach etapu B zawsze wyglądałoby na nieudane w harnessie (GET zawsze
// zwracałby puste `{}`, readback nigdy by się nie zgadzał).
const orgContextStoreState: { goals: unknown; challenges: unknown; synthesis: unknown } = {
  goals: {},
  challenges: {},
  synthesis: {},
};
let orgContextStoreVersion = 0;

const originalFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  if (url.includes('/api/organization-context-store')) {
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET') {
      return json({
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
    return json({ ok: true, version: String(orgContextStoreVersion) });
  }
  if (url.includes('/api/organizations/current')) {
    return json({
      organizations: [
        { id: 'org-dbr77-demo', name: 'Northstar Advisory Group', is_current: true },
      ],
    });
  }
  return originalFetch(input as RequestInfo, init);
}) as typeof window.fetch;

/**
 * Etap B (10 dalszych ekranów): „Źródła i twierdzenia" i „Gotowość organizacji"
 * osadzają REALNE `GovernedContextWorkspace`/`OrganizationDecisionQualityPanel`,
 * które wołają `organizationGovernedContextApi.listClaims/listVersions` →
 * `Api.get('/organization-context/governed/claims|versions')`. Bez mocka te
 * dwa ekrany renderują banery błędu w harnessie (brak backendu) — to WYŁĄCZNIE
 * luka danych harnessu, nie wada UI (patrz `org-identity-operating` §3 wyżej
 * dla tej samej zasady przy `/organization-context-store`). Realistyczne
 * dane poniżej, żeby zrzut pokazywał docelowy wygląd, nie pusty stan błędu.
 */
const MOCK_CLAIMS = [
  {
    claimId: 'claim-1',
    itemId: 'item-1',
    claimPath: 'profile.description',
    value: 'Niezależna firma usług profesjonalnych.',
    confidence: 0.86,
    sourceType: 'interview',
    visibilityScope: 'organization',
    reviewState: 'approved' as const,
    approved: true,
    approvalSource: 'explicit_review' as const,
    decidedBy: 'owner-1',
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
    organizationId: 'org-dbr77-demo',
    version: 1,
    schemaVersion: 1,
    contentHash: 'sha256-mock',
    claimCount: 201,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdBy: 'owner-1',
  },
];

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
  return (originalGet as any)(path, ...rest);
};

(Api as any).put = async () => ({ ok: true });

(Api as any).kgGetStats = async () => ({
  totalEntities: 42,
  totalRelations: 87,
  entityTypes: { Organization: 1, Person: 12, System: 8, Process: 21 },
  avgConfidence: 0.82,
  staleEntities: 3,
  redactedEntities: 0,
});

(Api as any).organizationContextGet = async () => ({
  organizationId: 'org-dbr77-demo',
  schemaVersion: 1,
  snapshotUpdatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  counts: { items: 8, claims: 201, conflicts: 2 },
  conflicts: [
    {
      claimPath: 'profile.description',
      values: Array.from({ length: 7 }, (_, index) => `wariant ${index + 1}`),
      sourceTypes: ['interview', 'document'],
    },
    {
      claimPath: 'profile.industry',
      values: Array.from({ length: 8 }, (_, index) => `branża ${index + 1}`),
      sourceTypes: ['document'],
    },
  ],
});

export default function OrgIdentityOperatingScreen() {
  return (
    <AppProviders>
      <OrganizationView />
    </AppProviders>
  );
}
