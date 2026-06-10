/**
 * @vitest-environment jsdom
 *
 * Smoke test for PortfolioAnalysisView (Module 05 — Portfolio Analysis workspace).
 * Renders each analysis subview with an empty portfolio and asserts it mounts
 * without throwing (honest empty state, no crash).
 */

import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => (typeof opts === 'string' ? opts : (opts?.defaultValue ?? k)),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({ dependencies: [] })),
    post: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
  shouldAllowDemoData: () => false,
}));

import { PortfolioAnalysisView } from '../PortfolioAnalysisView';
import type { AnalysisSubview } from '../types';

const SUBVIEWS: AnalysisSubview[] = [
  'resources',
  'feasibility',
  'logic',
  'timeline',
  'completeness',
];

const renderSubview = (subview: AnalysisSubview) =>
  render(
    <MemoryRouter>
      <PortfolioAnalysisView
        initiatives={[]}
        subview={subview}
        onOpenInitiative={vi.fn()}
        onQuickUpdate={vi.fn(async () => {})}
      />
    </MemoryRouter>
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe('PortfolioAnalysisView smoke', () => {
  for (const subview of SUBVIEWS) {
    it(`renders the "${subview}" subview with an empty portfolio without crashing`, async () => {
      const { container } = renderSubview(subview);
      await waitFor(() => expect(container.firstChild).toBeTruthy());
    });
  }
});
