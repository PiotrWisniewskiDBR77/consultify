/**
 * M08 (Harvard M16) — Mock host for the REAL `FinanceHub`
 * (src/components/Economics/FinanceHub.tsx), mounted inside the real
 * `AppProviders` tree so the acceptance screenshots show the ACTUAL Finance
 * module surface: StandardModuleBar (Menu 2/3) + StandardTable + StandardPreview
 * across the 5 canonical tabs (Statements / Analysis / Models / Prediction /
 * Enterprise valuation).
 *
 * Why a fetch-level mock (not an `Api.get` method patch like the assessment
 * stories): FinanceHub reads through TWO transports — legacy `Api.get(...)`
 * AND `V8FinanceApi.*` → `v8Get()` → `fetchWithRetry()`. Both funnel into the
 * shared baseClient `fetch`, so intercepting there is the single point that
 * covers the dual-runtime path (useFinanceData.ts:63-159) without having to
 * patch ~20 V8 methods individually.
 *
 * URL params (in addition to the harness-wide ?lang= & ?theme=):
 *   &state=populated|empty|error   default: populated
 *
 * No backend, no DB, no login — CLAUDE.md rule #7 (Piotr is never the first
 * visual tester).
 */
import React from 'react';

import { FinanceHub } from '../../src/components/Economics/FinanceHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// AppProviders' <ThemeSync> re-applies the store theme on mount and would
// override main.tsx's URL-driven `.dark` toggle — sync it to ?theme=.
const QS = new URLSearchParams(window.location.search);
useAppStore.setState({ theme: QS.get('theme') === 'dark' ? 'dark' : 'light' } as any);

const STATE = (QS.get('state') || 'populated') as 'populated' | 'empty' | 'error';

// ── Realistic rows shaped exactly like the API payloads useFinanceData maps
// (snake_case, as the server returns them). DBR77-scale manufacturing numbers.
const STATEMENT_PACKS = [
  {
    id: 'pack-1',
    entity_name: 'DBR77 Robotics sp. z o.o.',
    period_label: 'FY2025',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    currency: 'PLN',
    scaling: 'thousands',
    pack_status: 'approved',
    validation_status: 'passed',
    pack_readiness_status: 'ready',
    readiness_score: 96,
    pl_count: 1,
    bs_count: 1,
    cf_count: 1,
    total_line_count: 148,
    updated_at: '2026-07-28T09:15:00Z',
    statements: [
      {
        id: 'st-1',
        statement_type: 'P&L',
        status: 'approved',
        readiness_status: 'ready',
        readiness_score: 98,
        validation_status: 'passed',
        mapped_line_count: 62,
        total_line_count: 62,
        unmapped_line_count: 0,
        source_file_name: 'DBR77_RZiS_2025.xlsx',
        updated_at: '2026-07-28T09:15:00Z',
      },
      {
        id: 'st-2',
        statement_type: 'BS',
        status: 'approved',
        readiness_status: 'ready',
        readiness_score: 95,
        validation_status: 'passed',
        mapped_line_count: 54,
        total_line_count: 54,
        unmapped_line_count: 0,
        source_file_name: 'DBR77_Bilans_2025.xlsx',
        updated_at: '2026-07-28T09:15:00Z',
      },
      {
        id: 'st-3',
        statement_type: 'CF',
        status: 'approved',
        readiness_status: 'ready',
        readiness_score: 94,
        validation_status: 'passed',
        mapped_line_count: 32,
        total_line_count: 32,
        unmapped_line_count: 0,
        source_file_name: 'DBR77_CF_2025.xlsx',
        updated_at: '2026-07-28T09:15:00Z',
      },
    ],
  },
  {
    id: 'pack-2',
    entity_name: 'Elkomtech S.A.',
    period_label: 'FY2025',
    period_start: '2025-01-01',
    period_end: '2025-12-31',
    currency: 'PLN',
    scaling: 'thousands',
    pack_status: 'in_review',
    validation_status: 'warnings',
    pack_readiness_status: 'recoverable',
    readiness_score: 71,
    pl_count: 1,
    bs_count: 1,
    cf_count: 0,
    total_line_count: 97,
    missing_statement_types: ['CF'],
    pack_quality_reason_codes: ['MISSING_CF', 'UNMAPPED_LINES'],
    updated_at: '2026-07-30T14:02:00Z',
    statements: [
      {
        id: 'st-4',
        statement_type: 'P&L',
        status: 'in_review',
        readiness_status: 'recoverable',
        readiness_score: 74,
        validation_status: 'warnings',
        mapped_line_count: 48,
        total_line_count: 58,
        unmapped_line_count: 10,
        source_file_name: 'Elkomtech_RZiS_2025.xlsx',
        updated_at: '2026-07-30T14:02:00Z',
      },
      {
        id: 'st-5',
        statement_type: 'BS',
        status: 'draft',
        readiness_status: 'pending',
        readiness_score: 41,
        validation_status: 'pending',
        mapped_line_count: 21,
        total_line_count: 39,
        unmapped_line_count: 18,
        source_file_name: 'Elkomtech_Bilans_2025.xlsx',
        updated_at: '2026-07-30T14:02:00Z',
      },
    ],
  },
  {
    id: 'pack-3',
    entity_name: 'Nowa Fabryka sp. z o.o.',
    period_label: 'H1 2026',
    period_start: '2026-01-01',
    period_end: '2026-06-30',
    currency: 'PLN',
    scaling: 'units',
    pack_status: 'draft',
    validation_status: 'pending',
    pack_readiness_status: 'pending',
    readiness_score: 22,
    pl_count: 1,
    bs_count: 0,
    cf_count: 0,
    total_line_count: 44,
    missing_statement_types: ['BS', 'CF'],
    pack_quality_reason_codes: ['MISSING_BS', 'MISSING_CF'],
    updated_at: '2026-08-02T08:40:00Z',
    statements: [
      {
        id: 'st-6',
        statement_type: 'P&L',
        status: 'draft',
        readiness_status: 'pending',
        readiness_score: 22,
        validation_status: 'pending',
        mapped_line_count: 12,
        total_line_count: 44,
        unmapped_line_count: 32,
        source_file_name: 'NowaFabryka_PL_H1.xlsx',
        updated_at: '2026-08-02T08:40:00Z',
      },
    ],
  },
];

const MODELS = [
  {
    id: 'model-1',
    name: 'DBR77 — Business Case: linia zrobotyzowana',
    model_type: 'investment_case',
    status: 'approved',
    scenario: 'base',
    currency: 'PLN',
    version: 4,
    is_baseline: true,
    forecast_months: 60,
    created_at: '2026-05-11T10:00:00Z',
    updated_at: '2026-07-29T16:30:00Z',
    owner_name: 'Piotr Wiśniewski',
    npv: 3_480_000,
    irr: 0.276,
    payback_months: 29,
  },
  {
    id: 'model-2',
    name: 'Elkomtech — Model operacyjny 2026',
    model_type: 'operating',
    status: 'in_review',
    scenario: 'upside',
    currency: 'PLN',
    version: 2,
    is_baseline: false,
    forecast_months: 36,
    created_at: '2026-06-20T09:10:00Z',
    updated_at: '2026-07-31T11:05:00Z',
    owner_name: 'Anna Kowalska',
    npv: 1_120_000,
    irr: 0.181,
    payback_months: 41,
  },
  {
    id: 'model-3',
    name: 'Nowa Fabryka — CAPEX hala 2',
    model_type: 'capex',
    status: 'draft',
    scenario: 'downside',
    currency: 'PLN',
    version: 1,
    is_baseline: false,
    forecast_months: 24,
    created_at: '2026-07-30T13:00:00Z',
    updated_at: '2026-08-03T07:45:00Z',
    owner_name: 'Marek Nowak',
    npv: -240_000,
    irr: 0.041,
    payback_months: null,
  },
];

const ANALYSES = [
  {
    id: 'an-1',
    name: 'DBR77 — Analiza wskaźnikowa FY2025',
    analysis_type: 'ratio',
    status: 'completed',
    created_at: '2026-06-02T08:00:00Z',
    updated_at: '2026-07-25T10:00:00Z',
    owner_name: 'Piotr Wiśniewski',
    statement_pack_id: 'pack-1',
  },
  {
    id: 'an-2',
    name: 'Elkomtech — Analiza inwestycyjna (investment case)',
    analysis_type: 'investment_case',
    status: 'in_review',
    created_at: '2026-07-01T08:00:00Z',
    updated_at: '2026-07-30T15:20:00Z',
    owner_name: 'Anna Kowalska',
    statement_pack_id: 'pack-2',
  },
  {
    id: 'an-3',
    name: 'Nowa Fabryka — Analiza pionowa/pozioma',
    analysis_type: 'vertical_horizontal',
    status: 'draft',
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-03T09:00:00Z',
    owner_name: 'Marek Nowak',
    statement_pack_id: 'pack-3',
  },
];

const VALUATIONS = [
  {
    id: 'val-1',
    name: 'DBR77 Robotics — wycena DCF',
    method: 'dcf',
    status: 'approved',
    currency: 'PLN',
    equity_value: 42_800_000,
    enterprise_value: 47_300_000,
    wacc: 0.104,
    terminal_method: 'gordon',
    created_at: '2026-06-15T08:00:00Z',
    updated_at: '2026-07-27T12:00:00Z',
    owner_name: 'Piotr Wiśniewski',
  },
  {
    id: 'val-2',
    name: 'Elkomtech — wycena mnożnikowa',
    method: 'multiples',
    status: 'in_review',
    currency: 'PLN',
    equity_value: 18_200_000,
    enterprise_value: 21_500_000,
    wacc: 0.118,
    terminal_method: 'exit_multiple',
    created_at: '2026-07-05T08:00:00Z',
    updated_at: '2026-08-01T09:30:00Z',
    owner_name: 'Anna Kowalska',
  },
];

const BUDGETS = [
  {
    id: 'bud-1',
    name: 'Budżet operacyjny 2026 — Produkcja',
    period: '2026',
    status: 'active',
    currency: 'PLN',
    planned_amount: 12_400_000,
    actual_amount: 7_180_000,
    variance_pct: -3.2,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-08-01T08:00:00Z',
    owner_name: 'Piotr Wiśniewski',
  },
  {
    id: 'bud-2',
    name: 'Budżet CAPEX 2026 — Robotyzacja',
    period: '2026',
    status: 'active',
    currency: 'PLN',
    planned_amount: 5_600_000,
    actual_amount: 5_940_000,
    variance_pct: 6.1,
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-08-02T08:00:00Z',
    owner_name: 'Marek Nowak',
  },
];

const INITIATIVES = [
  {
    id: 'ini-1',
    name: 'Automatyzacja zamówień',
    status: 'in_progress',
    expected_value: 1_200_000,
    npv: 940_000,
    risk_score: 0.2,
    effort: 3,
  },
  {
    id: 'ini-2',
    name: 'Konsolidacja systemów ERP',
    status: 'in_progress',
    expected_value: 820_000,
    npv: 610_000,
    risk_score: 0.55,
    effort: 6,
  },
  {
    id: 'ini-3',
    name: 'Optymalizacja energii',
    status: 'committed',
    expected_value: 460_000,
    npv: 300_000,
    risk_score: 0.35,
    effort: 2,
  },
];

// ── Fetch interception ──────────────────────────────────────────────────────
// Matches on pathname so both `/api/v8/finance/*` (V8 runtime, envelope
// `{data:...}`) and the legacy `/api/finance-statements|financial-modeling|
// economics/*` fallbacks resolve. Anything unmatched returns an empty 200 so a
// stray call never wedges the screen in a spinner.
const EMPTY = STATE === 'empty';

function v8(body: unknown) {
  return { data: body };
}

function route(path: string): unknown | undefined {
  // V8 runtime
  if (path.endsWith('/api/v8/finance/statement-packs'))
    return v8({ statementPacks: EMPTY ? [] : STATEMENT_PACKS, count: EMPTY ? 0 : 3 });
  if (path.endsWith('/api/v8/finance/models'))
    return v8({ models: EMPTY ? [] : MODELS, count: EMPTY ? 0 : 3 });
  if (path.endsWith('/api/v8/finance/analyses'))
    return v8({ analyses: EMPTY ? [] : ANALYSES, count: EMPTY ? 0 : 3 });
  if (path.endsWith('/api/v8/finance/valuations'))
    return v8({ valuations: EMPTY ? [] : VALUATIONS, count: EMPTY ? 0 : 2 });
  if (path.endsWith('/api/v8/finance/budgets'))
    return v8({ budgets: EMPTY ? [] : BUDGETS, count: EMPTY ? 0 : 2 });
  if (path.includes('/api/v8/finance/dashboard'))
    return v8({
      dashboard: {
        ingestionPipeline: {
          totalCount: EMPTY ? 0 : 3,
          byState: {},
          confidenceBands: { high: 1, medium: 1, low: 1, unknown: 0 },
          averageConfidence: 0.74,
        },
        linkageHealth: { totalLinkages: 3, byLinkageType: {}, unlinkedInitiativesCount: 1 },
        unresolvedEscalationsCount: 0,
        staleSourceRefreshesCount: 1,
        promotionGatePassRate: 0.82,
      },
    });
  // Legacy fallbacks
  if (path.includes('/api/finance-statements/packs')) return EMPTY ? [] : STATEMENT_PACKS;
  if (path.includes('/api/financial-modeling/models')) return EMPTY ? [] : MODELS;
  if (path.includes('/api/economics/financial-analyses')) return EMPTY ? [] : ANALYSES;
  if (path.includes('/api/economics/valuations/sources')) return [];
  if (path.includes('/api/economics/valuations')) return EMPTY ? [] : VALUATIONS;
  if (path.includes('/api/economics/budgets')) return { budgets: EMPTY ? [] : BUDGETS };
  if (path.includes('/api/initiatives')) return EMPTY ? [] : INITIATIVES;
  return undefined;
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: any, init?: any) => {
  const url = typeof input === 'string' ? input : input?.url || String(input);
  let path = url;
  try {
    path = new URL(url, window.location.origin).pathname;
  } catch {
    /* keep raw */
  }

  if (path.startsWith('/api/')) {
    // `error` state: make the finance reads fail so the hub's honest error
    // state (useFinanceData -> loadError -> "real source failed") is exercised
    // instead of a silent empty table.
    if (STATE === 'error' && path.includes('finance')) {
      return new Response(JSON.stringify({ error: 'upstream_unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const body = route(path);
    return new Response(JSON.stringify(body === undefined ? { data: null } : body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input, init);
}) as typeof window.fetch;

export default function FinanceHubScreen() {
  return (
    <AppProviders>
      <div className="h-screen w-full overflow-auto bg-c-bg">
        <FinanceHub />
      </div>
    </AppProviders>
  );
}
