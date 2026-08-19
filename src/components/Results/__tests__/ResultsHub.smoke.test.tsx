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

// Observe the exact local Menu 2 contract passed to the shared renderer.
vi.mock('../../standard/StandardModuleBar', () => ({
  StandardModuleBar: ({
    tabs,
    activeTab,
    onTabChange,
    viewModes,
    primaryCta,
    chips,
    children,
  }: any) => (
    <div
      data-testid="results-module-bar"
      data-active-tab={activeTab}
      data-view-modes={(viewModes || []).join(',')}
      data-primary-cta={primaryCta?.label || ''}
      data-menu3={(chips || []).map((chip: any) => chip.id).join(',')}
    >
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
      {children}
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
vi.mock('../resultsFeatureFlags', () => ({ isResultsFlagEnabled: () => false }));

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
    expect(tabs.map((tab) => tab.textContent)).toEqual(['KPI', 'ROI', 'OKR']);
    expect(tabs.every((tab) => tab.getAttribute('data-count') === '')).toBe(true);
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute(
      'data-view-modes',
      'table,grid'
    );
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute(
      'data-primary-cta',
      'New KPI scorecard'
    );
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute(
      'data-menu3',
      'all,active,draft,closed'
    );

    fireEvent.click(screen.getByTestId('results-tab-roi'));
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute('data-active-tab', 'roi');
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute(
      'data-primary-cta',
      'New ROI analysis'
    );
    expect(screen.getByTestId('results-module-bar')).toHaveAttribute(
      'data-menu3',
      'all,active,at-risk,completed'
    );
  });
});
