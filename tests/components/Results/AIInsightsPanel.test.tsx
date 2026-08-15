/**
 * @vitest-environment jsdom
 *
 * M15 Seria T / T2 — FE component tests for AIInsightsPanel.
 * Covers: render with narrative + counterfactual payloads, empty-state placeholders,
 * static premium sections (anomaly/forecast/RCA), and all-reject resilience.
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

import AIInsightsPanel from '@/components/Results/AIInsightsPanel';
import { Api } from '@/services/api';

const NARRATIVE = {
  executiveSummary: 'Inicjatywy realizują 70% planowanych korzyści.',
  narrative: {
    executiveSummary: 'Inicjatywy realizują 70% planowanych korzyści.',
    headline: 'Wartość pod kontrolą',
    bodySentences: ['Trzy inicjatywy przekroczyły cel.', 'Jedna jest zagrożona.'],
    statusLabel: 'Na torze',
  },
};

const COUNTERFACTUAL = {
  attributable: 1_800_000,
  confidenceLabel: 'medium',
  totalTarget: 3_000_000,
  totalRealized: 2_200_000,
  counterfactualProjected: 400_000,
};

function mockEndpoints(map: Record<string, any>) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    for (const [suffix, value] of Object.entries(map)) {
      // Wrap real payloads in { data } (mirrors API envelope); pass null/empty raw
      // so the component's `(v)?.data ?? v` resolves to a falsy value (true empty state).
      if (url.endsWith(suffix)) return (value == null ? value : { data: value }) as any;
    }
    throw new Error(`Unexpected GET ${url}`);
  });
}

describe('AIInsightsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the panel without crashing for a realistic payload', async () => {
    mockEndpoints({ '/narrative': NARRATIVE, '/counterfactual': COUNTERFACTUAL });
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
  });

  it('renders the value-narrative section with headline and body', async () => {
    mockEndpoints({ '/narrative': NARRATIVE, '/counterfactual': COUNTERFACTUAL });
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Value narrative')).toBeInTheDocument();
    expect(screen.getByText('Wartość pod kontrolą')).toBeInTheDocument();
    expect(screen.getByText('Trzy inicjatywy przekroczyły cel.')).toBeInTheDocument();
  });

  it('renders the counterfactual attribution section with formatted values', async () => {
    mockEndpoints({ '/narrative': NARRATIVE, '/counterfactual': COUNTERFACTUAL });
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('Attribution — what happens without the initiative?')).toBeInTheDocument();
    expect(screen.getByText('Attributable to the initiative')).toBeInTheDocument();
    // The canonical Results formatter uses the product currency contract.
    expect(screen.getByText('€1.8M')).toBeInTheDocument();
  });

  it('always renders the static premium sections (anomaly / forecast / RCA)', async () => {
    mockEndpoints({ '/narrative': NARRATIVE, '/counterfactual': COUNTERFACTUAL });
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('KPI anomaly detection')).toBeInTheDocument();
    expect(screen.getByText('KPI trajectory forecast')).toBeInTheDocument();
    expect(screen.getByText('RCA / corrective action suggestion')).toBeInTheDocument();
    // premium badge appears (3 sections)
    expect(screen.getAllByText('AI premium').length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty-state placeholders when narrative and counterfactual are absent', async () => {
    mockEndpoints({ '/narrative': {}, '/counterfactual': null });
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
    expect(screen.getByText(/No data for the narrative/)).toBeInTheDocument();
    expect(screen.getByText(/No historical measurements/)).toBeInTheDocument();
  });

  it('survives both endpoints rejecting without crashing (still shows premium sections)', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('boom'));
    render(<AIInsightsPanel projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('ai-insights-panel')).toBeInTheDocument());
    expect(screen.getByText('KPI anomaly detection')).toBeInTheDocument();
  });
});
