/**
 * @vitest-environment jsdom
 *
 * Pakiet I (Dostępność) — dialog „Podaj powód" w `BaselineWorkspace.tsx`.
 *
 * PRZED naprawą: `role="alertdialog"` istniał, ale bez pułapki fokusa Tab
 * (Tab uciekał pod przyciemnione tło), bez `Escape` i bez przywrócenia
 * fokusa na wyzwalacz (trigger lifecycle menu odmontowuje się, ZANIM
 * callback otwiera dialog — patrz komentarz w `FinanceWorkspaceBar.tsx`
 * przy `data-testid="finance-workspace-bar-lifecycle-trigger"`).
 *
 * PO naprawie (`useDialogA11y`): Escape zamyka i czyści `reasonDraft`, focus
 * wraca na trigger lifecycle, Tab z ostatniego widocznego elementu
 * fokusowalnego wraca na pierwszy (pułapka).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFeatureFlagOverrides,
  setFeatureFlagOverrides,
} from '@/test-utils/featureFlagOverrides';

// jsdom never computes layout, so `offsetParent` is always null — the
// `useDialogA11y` focus-trap uses it to skip hidden elements. Stub it (same
// convention as `useDialogA11y.test.tsx`) so the visible-element filter
// behaves as it would in a real browser.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('@/services/api/financeV2.api', () => ({
  approveFinanceModel: vi.fn(),
  reopenFinanceModel: vi.fn(),
  renameFinanceArtifact: vi.fn(),
  transitionFinanceVersion: vi.fn().mockResolvedValue({ status: 'NEEDS_CHANGES', version: 2 }),
  listBaselineAssumptions: vi.fn().mockResolvedValue([]),
  upsertBaselineAssumptions: vi.fn(),
  computeBaseline: vi.fn(),
  listBaselineOutputs: vi.fn().mockResolvedValue([]),
}));

import { BaselineWorkspace, type BaselineWorkspaceProps } from '../../BaselineWorkspace';
import type { AssumptionRowSpec } from '../AssumptionsView';
import type { PeriodMeta } from '../CalculationsView';

const FORECAST_PERIODS: PeriodMeta[] = [
  { periodId: 'per-2026-01', label: '01/2026', yearMonth: '2026-01' },
];
const ASSUMPTION_ROW_ORDER: AssumptionRowSpec[] = [
  {
    scheduleType: 'revenue_pvm',
    driverCode: 'REVENUE_GROWTH_YOY',
    entityId: 'ent-1',
    periodId: 'per-2026-01',
  },
];

function baseProps(overrides: Partial<BaselineWorkspaceProps> = {}): BaselineWorkspaceProps {
  return {
    artifactId: 'art-1',
    businessVersionId: 'bv-1',
    entityId: 'ent-1',
    name: 'DBR77 — Model bazowy FY2026',
    status: 'IN_REVIEW',
    freshness: 'CURRENT',
    version: 1,
    role: 'preparer',
    forecastPeriods: FORECAST_PERIODS,
    openingBalanceSheetPeriodId: 'per-2025-12',
    assumptionRowOrder: ASSUMPTION_ROW_ORDER,
    contextValues: { type: 'Model bazowy (Baseline)', period: 'FY2026' },
    onNavigateBack: vi.fn(),
    ...overrides,
  };
}

async function openReasonDialog(): Promise<void> {
  await screen.findByRole('tablist');
  const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
  fireEvent.click(lifecycleTrigger);
  const menuItem = await screen.findByRole('menuitem', { name: 'Poproś o zmiany' });
  fireEvent.click(menuItem);
  await screen.findByTestId('baseline-reason-dialog');
}

describe('BaselineWorkspace — dialog „Podaj powód" (a11y, Pakiet I)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFeatureFlagOverrides({ financeBaselineWorkspaceV1: true });
  });
  afterEach(() => {
    clearFeatureFlagOverrides();
  });

  it('otwiera się z rolą alertdialog i fokusem na polu tekstowym', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await openReasonDialog();
    const dialog = screen.getByTestId('baseline-reason-dialog');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    await waitFor(() => expect(screen.getByTestId('baseline-reason-input')).toHaveFocus());
  });

  it('Escape zamyka dialog i przywraca fokus na trigger lifecycle', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    const lifecycleTrigger = screen.getByTestId('finance-workspace-bar-lifecycle-trigger');
    await openReasonDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByTestId('baseline-reason-dialog')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(lifecycleTrigger).toHaveFocus());
  });

  it('Tab z ostatniego widocznego elementu fokusowalnego (Anuluj — Potwierdź jest disabled) wraca na pierwszy (pole tekstowe) — pułapka fokusa', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await openReasonDialog();

    const textarea = screen.getByTestId('baseline-reason-input');
    const cancelButton = screen.getByRole('button', { name: 'Anuluj' });
    // "Potwierdź" jest disabled dopóki reasonDraft jest puste — nie jest
    // częścią tab-order, więc pułapka po Tab powinna wrócić na `textarea`
    // (pierwszy fokusowalny), nie na disabled przycisk.
    expect(screen.getByTestId('baseline-reason-submit')).toBeDisabled();

    cancelButton.focus();
    expect(cancelButton).toHaveFocus();
    fireEvent.keyDown(cancelButton, { key: 'Tab' });
    await waitFor(() => expect(textarea).toHaveFocus());
  });

  it('drugi Escape (dialog już zamknięty) jest no-opem — stan `pendingReasonFor` faktycznie wrócił do null, listener hooka nie utknął otwarty', async () => {
    render(<BaselineWorkspace {...baseProps()} />);
    await openReasonDialog();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('baseline-reason-dialog')).not.toBeInTheDocument()
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('baseline-reason-dialog')).not.toBeInTheDocument();
  });
});
