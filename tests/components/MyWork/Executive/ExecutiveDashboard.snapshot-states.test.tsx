/**
 * ExecutiveDashboard — snapshot-driven states (M02-008 / M02-011).
 *
 * Asserts the three outcomes the Manager surface previously had no vocabulary
 * for:
 *   403           → the shared `forbidden` state, no retry button (retrying a
 *                   permission failure cannot succeed)
 *   transport err → an alert WITH a retry, not a silent empty dashboard
 *   incoherent    → the numbers still render, but the surface says out loud
 *                   that they failed their consistency check
 *
 * The dashboard is mounted for real; only the network boundary is faked.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const raw =
        typeof fallback === 'string'
          ? fallback
          : ((fallback as Record<string, unknown>)?.defaultValue as string) ?? _key;
      const params = (opts ?? (typeof fallback === 'object' ? fallback : null)) as Record<
        string,
        unknown
      > | null;
      if (!params) return raw;
      return raw.replace(/\{\{(\w+)\}\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
    },
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => {
        const { children, ...rest } = props ?? {};
        return React.createElement('div', rest, children);
      },
    }
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector({ currentUser: { id: 'user-1', firstName: 'Piotr' } }),
}));

const apiGet = vi.fn();
vi.mock('../../../../src/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGet(...args),
    getTasks: vi.fn().mockResolvedValue([]),
    getExecutiveAnalytics: vi.fn().mockResolvedValue({ initiativeBreakdown: [] }),
    getAIOperatorOverview: vi.fn().mockResolvedValue(null),
    decideDecision: vi.fn(),
    proposeAIOperatorIntervention: vi.fn(),
    acceptAIOperatorIntervention: vi.fn(),
    executeAIOperatorIntervention: vi.fn(),
    rejectAIOperatorIntervention: vi.fn(),
  },
}));

import { ExecutiveDashboard } from '../../../../src/components/MyWork/Executive/ExecutiveDashboard';
import { makeSnapshot } from './__fixtures__/managerSnapshot';

/** Route Api.get by URL; the snapshot handler is supplied per test. */
const routeApi = (snapshotHandler: () => unknown) => {
  apiGet.mockImplementation(async (url: string) => {
    if (String(url).includes('/manager/snapshot')) return snapshotHandler();
    if (String(url).includes('/decisions')) return [];
    if (String(url).includes('/team-workload')) return [];
    if (String(url).includes('/signals')) return { signals: [] };
    return null;
  });
};

const httpError = (status: number) => {
  const err = new Error(`HTTP ${status}`) as Error & { status: number };
  err.status = status;
  return err;
};

describe('ExecutiveDashboard — snapshot states', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('shows the shared forbidden state (and no retry) on 403', async () => {
    routeApi(() => {
      throw httpError(403);
    });

    render(<ExecutiveDashboard />);

    await waitFor(() =>
      expect(
        screen.getByText('Manager view is not available for your role')
      ).toBeInTheDocument()
    );
    // Retrying a permission refusal cannot help, so no retry affordance.
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    // And no KPI numbers leak past the gate.
    expect(screen.queryByTestId('kpi-tasks')).not.toBeInTheDocument();
  });

  it('shows a retryable error — not an empty dashboard — on a transport failure', async () => {
    routeApi(() => {
      throw httpError(500);
    });

    render(<ExecutiveDashboard />);

    await waitFor(() =>
      expect(
        screen.getByText('Could not read the manager snapshot for this period.')
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('renders the scope bar with one read time when the snapshot loads', async () => {
    routeApi(() => makeSnapshot());

    render(<ExecutiveDashboard />);

    await waitFor(() => expect(screen.getByTestId('manager-scope-bar')).toBeInTheDocument());
    const bar = screen.getByTestId('manager-scope-bar');
    expect(bar).toHaveTextContent('Last 7 days');
    expect(bar).toHaveTextContent('Each figure is labelled Mine or Organization');
    expect(screen.queryByTestId('manager-coherence-warning')).not.toBeInTheDocument();
  });

  it('flags an incoherent snapshot instead of publishing it silently', async () => {
    // Reproduces the finding: 71 overdue reported against 1 open task.
    const broken = makeSnapshot();
    broken.owner.tasks.openTotal = 1;
    routeApi(() => broken);

    render(<ExecutiveDashboard />);

    await waitFor(() =>
      expect(screen.getByTestId('manager-coherence-warning')).toBeInTheDocument()
    );
    expect(screen.getByTestId('manager-coherence-warning')).toHaveTextContent(
      'failed their consistency check'
    );
  });
});
