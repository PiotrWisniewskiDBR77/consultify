/**
 * @vitest-environment jsdom
 *
 * Smoke test for ResultsHub (Module 07 — Rezultaty).
 * ResultsHub composes the ModuleHub shell with many heavy subviews; this test
 * mocks the ModuleHub shell + the KPI runtime + the app store so the hub mounts
 * deterministically offline and we assert it renders without crashing and wires
 * its tab configuration into the shell.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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

// Mock the ModuleHub shell to a deterministic marker that exposes the tab count.
vi.mock('../../shared/ModuleHub/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab }: any) => (
    <div data-testid="results-module-hub" data-active-tab={activeTab} data-tab-count={tabs?.length}>
      {(tabs || []).map((tab: any) => (
        <span key={tab.id} data-testid="results-tab">
          {tab.label}
        </span>
      ))}
    </div>
  ),
}));

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
  it('mounts the ModuleHub shell with a non-empty tab configuration', async () => {
    loadResultsKpis.mockResolvedValue({ kpis: [], initiatives: [], mappings: [] });
    render(
      <MemoryRouter initialEntries={['/benefits']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('results-module-hub')).toBeInTheDocument();
    });
    const hub = screen.getByTestId('results-module-hub');
    expect(Number(hub.getAttribute('data-tab-count'))).toBeGreaterThan(0);
  });
});
