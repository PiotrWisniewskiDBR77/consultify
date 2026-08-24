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

const originalGet = Api.get.bind(Api);
(Api as any).get = async (path: string, ...rest: unknown[]) => {
  if (path.startsWith('/organization-profiles/')) {
    return { exists: true, profile: MOCK_PROFILE };
  }
  return (originalGet as any)(path, ...rest);
};

(Api as any).put = async () => ({ ok: true });

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
