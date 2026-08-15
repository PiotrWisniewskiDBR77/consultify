/**
 * @vitest-environment jsdom
 *
 * VEGAS V7.8 — hub smoke suite.
 *
 * One lightweight test per top-level module hub. Each asserts:
 *   (a) the hub mounts without throwing (render() does not reject), and
 *   (b) it surfaces its header — a known tab label or heading string.
 *
 * This is a tripwire for import-time and first-render regressions across the 7
 * primary hubs, so a broken shared dependency (a store, a context, a barrel
 * import) fails fast here instead of silently white-screening in production.
 *
 * Shared mocks (i18n / router / ModuleHub / fetch) live in ./hubSmokeHarness.
 */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFetchStub, renderHub, SMOKE_USER } from './hubSmokeHarness';

beforeEach(() => {
  installFetchStub();
  // Hubs log expected empty-state / network noise; keep the smoke output clean
  // but still fail on real render crashes (which throw, not log).
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VEGAS V7.8 — hub smoke suite', () => {
  it('MyWork (MyWorkHub) renders with its header', async () => {
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');
    renderHub(<MyWorkHub />, '/my-work');
    // MyWorkHub renders its own shell (not ModuleHub); anchor on its tab strip.
    await waitFor(() => {
      expect(document.querySelector('[data-testid^="mywork-tab-"]')).toBeTruthy();
    });
  });

  it('Initiatives (InitiativesHub) renders with the canonical portfolio tab', async () => {
    const { InitiativesHub } = await import('@/components/Initiatives/InitiativesHub');
    renderHub(<InitiativesHub />, '/initiatives');
    await waitFor(() => {
      expect(screen.getByText('Portfel')).toBeInTheDocument();
    });
  });

  it('Outputs (ReportsAndPresentationsHub) renders its hub shell', async () => {
    const { ReportsAndPresentationsHub } = await import(
      '@/components/ReportsAndPresentations/ReportsAndPresentationsHub'
    );
    renderHub(<ReportsAndPresentationsHub />, '/outputs');
    await waitFor(() => {
      expect(screen.getByTestId('reports-presentations-hub')).toBeInTheDocument();
    });
  });

  it('Finance (FinanceHub) renders with the Statements tab', async () => {
    const { FinanceHub } = await import('@/components/Economics/FinanceHub');
    renderHub(<FinanceHub />, '/finance');
    await waitFor(() => {
      expect(screen.getByText('Statements')).toBeInTheDocument();
    });
  });

  it('Results (ResultsHub) renders with the canonical KPI tab', async () => {
    const { ResultsHub } = await import('@/components/Results/ResultsHub');
    renderHub(<ResultsHub />, '/results');
    await waitFor(() => {
      expect(screen.getByTestId('results-pair-tab-kpi')).toBeInTheDocument();
    });
  });

  it('Assessment (AssessmentHub) renders with the Assessment tab', async () => {
    const { AssessmentHub } = await import('@/components/assessment/AssessmentHub');
    renderHub(<AssessmentHub />, '/assessment');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Assessment', selected: true })).toBeInTheDocument();
    });
  });

  it('Admin/Settings (AdminSettingsModule) renders a section header', async () => {
    const { AdminSettingsModule } = await import('@/views/admin/AdminSettingsModule');
    renderHub(<AdminSettingsModule currentUser={SMOKE_USER} />, '/admin/people');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });
});
