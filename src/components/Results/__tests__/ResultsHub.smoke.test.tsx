/**
 * @vitest-environment jsdom
 *
 * Smoke test for ResultsHub (Module 07 — Rezultaty).
 * ResultsHub composes the ModuleHub shell with many heavy subviews; this test
 * mocks the ModuleHub shell + the KPI runtime + the app store so the hub mounts
 * deterministically offline and we assert it renders without crashing and wires
 * its tab configuration into the shell.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any, opts?: any) => {
      const def = typeof optsOrDefault === 'string' ? optsOrDefault : optsOrDefault?.defaultValue;
      const interp = typeof optsOrDefault === 'object' ? optsOrDefault : opts;
      let out = def ?? k;
      if (interp && typeof out === 'string') {
        out = out.replace(/\{\{(\w+)\}\}/g, (_m, key) =>
          interp[key] != null ? String(interp[key]) : ''
        );
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

// Observe the exact local Menu 2 contract passed to the shared renderer.
vi.mock('../../standard/StandardModuleBar', () => ({
  StandardModuleBar: ({ tabs, activeTab, onTabChange, commandRowContent, children }: any) => (
    <div data-testid="results-module-bar" data-active-tab={activeTab}>
      {(tabs || []).map((tab: any) => (
        <button
          key={tab.id}
          data-testid={`results-tab-${tab.id}`}
          data-count={tab.count == null ? '' : String(tab.count)}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <div data-testid="results-command-row">{commandRowContent}</div>
      {children}
    </div>
  ),
}));

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

const { loadResultsKpis } = vi.hoisted(() => ({ loadResultsKpis: vi.fn() }));
vi.mock('../kpiRuntime', () => ({ loadResultsKpis }));
vi.mock('../resultsFeatureFlags', () => ({ isResultsFlagEnabled: () => false }));

const resultsVNextFlags = vi.hoisted(() => ({ kpiRegistry: false }));
vi.mock('../../ResultsVNext/resultsVNextFeatureFlags', () => ({
  isResultsVNextFlagEnabled: (flag: string) =>
    flag === 'kpiRegistry' && resultsVNextFlags.kpiRegistry,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' } }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})) },
}));

vi.mock('@/services/initiativeWriteTruth', () => ({
  updateInitiativeStatusWriteTruth: vi.fn(async () => ({})),
}));

import { ResultsHub } from '../ResultsHub';

describe('ResultsHub smoke', () => {
  beforeEach(() => {
    resultsVNextFlags.kpiRegistry = false;
    loadResultsKpis.mockReset();
    navigate.mockReset();
  });

  it('passes clean Menu 2 names without counts and preserves tab navigation', async () => {
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/benefits']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('results-module-bar')).toBeInTheDocument();
    });

    const tabs = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('data-testid')?.startsWith('results-tab-'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'KPI',
      'Reports',
      'Incoming benefits',
      'ROI',
      'ROI Analysis',
    ]);
    expect(tabs.every((tab) => tab.getAttribute('data-count') === '')).toBe(true);

    fireEvent.click(screen.getByTestId('results-tab-roi'));
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute('data-active-tab', 'roi');
  });

  it('keeps the legacy KPI workspace unchanged and hides the registry link while its flag is OFF', async () => {
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('results-module-bar')).toBeInTheDocument());
    expect(screen.getByTestId('results-tab-results_kpi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open KPI registry (preview)' })).toBeNull();
  });

  it('shows the neutral registry link only when enabled and navigates to the exact governed route', async () => {
    resultsVNextFlags.kpiRegistry = true;
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    const link = await screen.findByRole('button', { name: 'Open KPI registry (preview)' });
    expect(screen.getByTestId('results-tab-results_kpi')).toBeInTheDocument();
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/results/kpi');
  });

  // RES-UI-CANON-001 closed blocker: the link used to vanish in queue mode,
  // because that submode's early return composed its own action row before the
  // link existed. Discoverability must be invariant across every KPI submode.
  it('keeps the registry link reachable in queue mode and still navigates exactly to /results/kpi', async () => {
    resultsVNextFlags.kpiRegistry = true;
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    // Default submode ('catalog') — present.
    await screen.findByRole('button', { name: 'Open KPI registry (preview)' });

    // Switch to the queue submode ("Corrective Action" chip).
    fireEvent.click(screen.getByRole('button', { name: 'Corrective Action' }));

    // Queue mode keeps its OWN action ("Add sheet") — this fix is additive, it
    // must not displace the submode's existing affordance.
    expect(await screen.findByRole('button', { name: 'Add sheet' })).toBeInTheDocument();

    const queueLink = await screen.findByRole('button', {
      name: 'Open KPI registry (preview)',
    });
    fireEvent.click(queueLink);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/results/kpi');
  });

  it('hides the registry link in queue mode too while the flag is OFF', async () => {
    // Flag OFF is the default (see beforeEach) — absence must hold in EVERY
    // submode, not just the default one, or "default-OFF" is not a real claim.
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('results-module-bar')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Corrective Action' }));

    expect(await screen.findByRole('button', { name: 'Add sheet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open KPI registry (preview)' })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
