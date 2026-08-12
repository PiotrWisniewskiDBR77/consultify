/**
 * @vitest-environment jsdom
 *
 * `AnalysisWorkspace` — AP_MOUNT §E (OWN-FIN-004): entering/exiting focus
 * mode must not fire any NEW `reload()` call and must preserve UI state
 * (here: an open Creator wizard, since this workspace has one view / no
 * tabs).
 *
 * ★ Pakiet I (Dostępność): `AnalysisCreatorWizard` now really closes on
 * Escape (it previously had zero keyboard handling — see
 * `AnalysisCreatorWizard.a11y.test.tsx`). `useFinanceFocusMode` already had
 * a documented Escape-precedence contract for exactly this case
 * (`escapeContext.modalOpen` — "modal/command-palette/popover/cell-editing
 * win over focus mode"), it just was never wired up here because until now
 * there was no real modal Escape handler to conflict with. `AnalysisWorkspace.tsx`
 * now passes `escapeContext: { modalOpen: wizardOpen }`, so a SINGLE Escape
 * with both the wizard and focus mode open closes the wizard FIRST (the
 * topmost layer) and leaves focus mode active — a SECOND Escape (now that no
 * modal blocks it) exits focus mode. This is the correct behavior (Escape
 * acts on the nearest enclosing context), not a regression: the old
 * single-Escape-does-both assumption only held because the wizard used to be
 * keyboard-inert.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

const apiMocks = vi.hoisted(() => ({
  getFinanceArtifact: vi.fn(),
  getFinanceBusinessVersion: vi.fn(),
  getAnalysisKpiValues: vi.fn(),
  getAnalysisKpiCatalog: vi.fn(),
  computeAnalysisKpis: vi.fn(),
  createFinanceArtifact: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn(),
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
}));
vi.mock('../../../../services/api/financeV2.api', () => apiMocks);

import { AnalysisWorkspace } from '../AnalysisWorkspace';

afterEach(() => {
  clearFeatureFlagOverrides();
  vi.clearAllMocks();
});

describe('AnalysisWorkspace — Focus Mode no-refetch (AP_MOUNT §E)', () => {
  it('entering focus mode with the wizard open calls reload() zero additional times and preserves it; Escape closes the wizard (modal precedence) before a second Escape exits focus mode', async () => {
    apiMocks.getFinanceArtifact.mockResolvedValue({
      artifactId: 'art-1',
      naturalKey: 'Analiza',
      currentBusinessVersion: null,
    });
    apiMocks.getFinanceBusinessVersion.mockResolvedValue({
      businessVersionId: 'bv-1',
      artifactId: 'art-1',
      versionNo: 1,
      version: 1,
      status: 'DRAFT',
      freshness: 'NEVER_COMPUTED',
    });
    apiMocks.getAnalysisKpiValues.mockResolvedValue([]);
    apiMocks.getAnalysisKpiCatalog.mockResolvedValue([]);
    setFeatureFlagOverrides({ financeAnalysisWorkspaceV1: true });

    render(
      <AnalysisWorkspace
        artifactId="art-1"
        businessVersionId="bv-1"
        role="preparer"
        onNavigateBack={() => {}}
      />
    );
    await waitFor(() => expect(apiMocks.getFinanceArtifact).toHaveBeenCalledTimes(1));

    // Open the wizard (UI state that must survive focus-mode toggling). Two
    // elements share this text (bar primary CTA + StandardTable empty-state
    // action) — same disambiguation as AnalysisWorkspace.smoke.test.tsx.
    const ctaButtons = await screen.findAllByText('Skonfiguruj wskaźniki');
    fireEvent.click(ctaButtons[ctaButtons.length - 1]!);
    await waitFor(() => expect(screen.getByTestId('analysis-creator-wizard')).toBeInTheDocument());

    const callsBefore =
      apiMocks.getFinanceArtifact.mock.calls.length +
      apiMocks.getAnalysisKpiValues.mock.calls.length;

    fireEvent.click(screen.getByTestId('finance-workspace-bar-fullscreen'));
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true)
    );

    expect(
      apiMocks.getFinanceArtifact.mock.calls.length +
        apiMocks.getAnalysisKpiValues.mock.calls.length
    ).toBe(callsBefore);
    expect(screen.getByTestId('analysis-creator-wizard')).toBeInTheDocument();

    // First Escape: the wizard (modal) is the topmost layer — it closes,
    // focus mode is UNCHANGED (still active). This is the a11y-correct
    // precedence, not the focus-mode exit.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('analysis-creator-wizard')).not.toBeInTheDocument()
    );
    expect(document.body.classList.contains('finance-focus-mode-active')).toBe(true);
    expect(
      apiMocks.getFinanceArtifact.mock.calls.length +
        apiMocks.getAnalysisKpiValues.mock.calls.length
    ).toBe(callsBefore);

    // Second Escape: no modal left to consume it — NOW focus mode exits.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(document.body.classList.contains('finance-focus-mode-active')).toBe(false)
    );
    expect(
      apiMocks.getFinanceArtifact.mock.calls.length +
        apiMocks.getAnalysisKpiValues.mock.calls.length
    ).toBe(callsBefore);
  });
});
