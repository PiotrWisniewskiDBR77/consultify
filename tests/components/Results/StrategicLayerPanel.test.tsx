/**
 * @vitest-environment jsdom
 *
 * M15 Seria T / T2 — FE component tests for StrategicLayerPanel.
 * Covers: render with realistic strategic/adoption/sustainment/benefit-profiles/okr payloads,
 * empty-state placeholders, key sections (BSC, adoption dataSource badge, benefit profiles, OKR, sustainment).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any, opts?: any) => {
      let str = typeof fallback === 'string' ? fallback : _key;
      if (opts && typeof opts === 'object') {
        str = str.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => String(opts[k] ?? ''));
      }
      return str;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn() },
}));

import StrategicLayerPanel from '@/components/Results/StrategicLayerPanel';
import { Api } from '@/services/api';

const STRATEGIC = {
  bsc: {
    perspectives: {
      financial: { count: 4, onTarget: 3, below: 1, noData: 0, healthPct: 0.75 },
      customer: { count: 3, onTarget: 1, below: 1, noData: 1, healthPct: 0.5 },
      process: { count: 2, onTarget: 0, below: 2, noData: 0, healthPct: 0.2 },
      learning: { count: 1, onTarget: 1, below: 0, noData: 0, healthPct: 1 },
    },
    overallHealthPct: 0.62,
    balanced: false,
  },
  bdn: { stats: { nodeCount: 12, edgeCount: 9, byType: { benefit: 4, enabler: 3, change: 2, objective: 3 } } },
  narrative: { executiveSummary: 'Portfel realizuje 62% celów strategicznych.' },
};

const ADOPTION = {
  flags: [
    {
      id: 'init-aaaaaaaa-1',
      name: 'Automatyzacja faktur',
      adoptionScore: 0.45,
      diceScore: 18,
      diceZone: 'worry',
      sentimentTrend: 'declining',
      championCoveragePct: 30,
      risk: 'high',
      riskReasons: ['Niska adopcja', 'Spadający nastrój'],
      atRisk: true,
    },
  ],
  total: 5,
  atRiskCount: 1,
  dataSource: 'change-management',
};

const SUSTAINMENT = {
  statuses: [
    { id: 's1', name: 'Inicjatywa A', status: 'at-risk', reasons: ['brak właściciela'] },
    { id: 's2', name: 'Inicjatywa B', status: 'sustained', reasons: [] },
  ],
  summary: { total: 6, sustained: 4, atRisk: 1, unowned: 1 },
};

const BENEFIT_PROFILES = {
  profiles: [
    {
      kpiId: 'kpi-1',
      name: 'Redukcja kosztów',
      type: 'financial',
      category: 'cost',
      isDisBenefit: false,
      businessOwner: 'CFO',
      hasTarget: true,
      realizationPct: 0.8,
    },
  ],
  summary: { total: 3, financial: 1, nonFinancial: 1, strategic: 1, withTarget: 2, disBenefits: 0 },
};

const OKR = {
  objectives: [
    {
      id: 'obj-parent',
      label: 'Wzrost rentowności',
      parentId: null,
      keyResults: [{ id: 'kr-1', label: 'EBITDA margin', baseline: 10, target: 20, current: 15, weight: 1 }],
      score: 0.5,
      rollupScore: 0.55,
    },
    {
      id: 'obj-child',
      label: 'Obniż koszty operacyjne',
      parentId: 'obj-parent',
      keyResults: [],
      score: 0.6,
      rollupScore: 0.6,
    },
  ],
  summary: { total: 2, onTrack: 1, atRisk: 1, offTrack: 0, avgScore: 0.55 },
};

function mockEndpoints(map: Record<string, any>) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    for (const [suffix, value] of Object.entries(map)) {
      if (url.endsWith(suffix)) return { data: value } as any;
    }
    throw new Error(`Unexpected GET ${url}`);
  });
}

const FULL = {
  '/strategic': STRATEGIC,
  '/adoption': ADOPTION,
  '/sustainment': SUSTAINMENT,
  '/benefit-profiles': BENEFIT_PROFILES,
  '/okr': OKR,
};

describe('StrategicLayerPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the panel without crashing for a realistic payload', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
  });

  it('renders the Balanced Scorecard section with all four perspectives', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText('Balanced Scorecard')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Processes')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
  });

  it('shows the unbalanced-scorecard warning when bsc.balanced is false', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText(/Scorecard unbalanced/)).toBeInTheDocument();
  });

  it('renders the adoption dataSource badge (change-management)', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText(/Source: change management/)).toBeInTheDocument();
    expect(screen.getByText('Automatyzacja faktur')).toBeInTheDocument();
  });

  it('renders the benefit-profiles section with a profile row', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText('Benefit profile')).toBeInTheDocument();
    expect(screen.getByText('Redukcja kosztów')).toBeInTheDocument();
  });

  it('renders the OKR cascade with parent and child objectives', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText('OKR — objective cascade')).toBeInTheDocument();
    expect(screen.getByText('Wzrost rentowności')).toBeInTheDocument();
    expect(screen.getByText('Obniż koszty operacyjne')).toBeInTheDocument();
  });

  it('renders the sustainment summary section', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText('Value sustainment')).toBeInTheDocument();
    // at-risk (non-sustained) status surfaces
    expect(screen.getByText('Inicjatywa A')).toBeInTheDocument();
  });

  it('renders the executive narrative when present', async () => {
    mockEndpoints(FULL);
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText(/Portfel realizuje 62% celów/)).toBeInTheDocument();
  });

  it('renders empty-state placeholders when all endpoints return empty payloads (no crash)', async () => {
    mockEndpoints({
      '/strategic': { bsc: { perspectives: {}, overallHealthPct: 0, balanced: true }, bdn: { stats: { nodeCount: 0, edgeCount: 0 } }, narrative: {} },
      '/adoption': { flags: [], total: 0, atRiskCount: 0 },
      '/sustainment': { statuses: [], summary: { total: 0, sustained: 0, atRisk: 0, unowned: 0 } },
      '/benefit-profiles': { profiles: [], summary: { total: 0, financial: 0, nonFinancial: 0, strategic: 0, withTarget: 0, disBenefits: 0 } },
      '/okr': { objectives: [], summary: { total: 0, onTrack: 0, atRisk: 0, offTrack: 0, avgScore: 0 } },
    });
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
    expect(screen.getByText(/No initiatives at risk/)).toBeInTheDocument();
    expect(screen.getByText(/No benefit profiles/)).toBeInTheDocument();
    expect(screen.getByText('No OKRs defined')).toBeInTheDocument();
  });

  it('survives all endpoints rejecting (Promise.allSettled) without crashing', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('boom'));
    render(<StrategicLayerPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('strategic-layer-panel')).toBeInTheDocument());
  });
});
