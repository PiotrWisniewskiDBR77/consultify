/**
 * @vitest-environment jsdom
 *
 * RN-G5 polish — component tests for the REAL
 * `src/components/ResultsVNext/legacy/ResultsVNextLegacyArchivePanel.tsx`
 * (no stand-in — same component the dev-render harness at
 * `dev-render/screens/results-vnext-legacy-archive.tsx` mounts), covering
 * two fixes:
 *
 *  1. TASK 2 (this package): a failed `listLegacyArchiveIndex` used to
 *     render `LegacyArchiveApiError.message` verbatim (`body.error`, the
 *     RAW backend string — e.g. "Internal server error", always English).
 *     It now renders a fixed, translated, retryable message instead — the
 *     raw detail still reaches `console.error` (telemetry), never the
 *     screen.
 *  2. TASK 1 (this package, escalated — see `spawn_task` "Fix
 *     disabled-danger kebab item still reading as active"): the
 *     `destructive` ("Usuń"/"Delete") kebab item on a read-only row has no
 *     `onClick`, so `StandardTable`'s `buildSections` marks it
 *     `disabled: true` with the D06 reason (`readOnlyReason`). The actual
 *     dimmed/muted COLOR treatment lives in the shared, out-of-allowlist
 *     `RowActionsMenu.tsx` — this test only pins the contract this package
 *     OWNS: disabled attribute + reason text present, so a future change
 *     cannot silently drop the reason or re-enable the action.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const listLegacyArchiveIndexMock = vi.fn();

vi.mock('../../../src/components/ResultsVNext/legacy/legacyArchiveApi', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/components/ResultsVNext/legacy/legacyArchiveApi')
  >('../../../src/components/ResultsVNext/legacy/legacyArchiveApi');
  return {
    ...actual,
    listLegacyArchiveIndex: (...args: unknown[]) => listLegacyArchiveIndexMock(...args),
  };
});

import { ResultsVNextLegacyArchivePanel } from '../../../src/components/ResultsVNext/legacy/ResultsVNextLegacyArchivePanel';
import { LegacyArchiveApiError } from '../../../src/components/ResultsVNext/legacy/legacyArchiveApi';

describe('ResultsVNextLegacyArchivePanel · błąd wczytywania (RN-G5 Zadanie 2)', () => {
  beforeEach(() => {
    listLegacyArchiveIndexMock.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('NIE pokazuje surowego `body.error` z backendu — pokazuje przetłumaczalny, ogólny komunikat z retry', async () => {
    listLegacyArchiveIndexMock.mockRejectedValue(
      new LegacyArchiveApiError('Internal server error', 500, 'KPI_LEGACY_ARCHIVE_INTERNAL_ERROR')
    );

    render(<ResultsVNextLegacyArchivePanel domain="kpi" />);

    // The OLD bug: this exact backend string on screen. Assert it is gone.
    await waitFor(() => {
      expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
    });

    // The NEW, correct behaviour: fixed, translated, honest copy + retry CTA.
    expect(
      screen.getByText('Nie udało się wykonać tej operacji. Spróbuj ponownie.')
    ).toBeInTheDocument();
    // The retry BUTTON label itself comes from the shared `ErrorState`
    // component's own `t('common.retry', …)` (src/components/shared/states/
    // ErrorState.tsx) — out of this package's allowlist. This test's local
    // i18n mock (matching the established convention, see
    // KpiToolPage.test.tsx) does not simulate real translation-resource
    // lookup, so it deterministically renders the English `defaultValue`
    // regardless of `i18n.language` — the real app's PL locale file (proven
    // in the dev-render harness screenshots) overrides it correctly. Match
    // either so this test does not depend on that unrelated mock gap.
    expect(screen.getByRole('button', { name: /spróbuj ponownie|try again/i })).toBeInTheDocument();
  });

  it('retry (Spróbuj ponownie) faktycznie ponawia wywołanie', async () => {
    listLegacyArchiveIndexMock.mockRejectedValue(new LegacyArchiveApiError('boom', 500));

    render(<ResultsVNextLegacyArchivePanel domain="kpi" />);

    await waitFor(() => {
      expect(listLegacyArchiveIndexMock).toHaveBeenCalledTimes(1);
    });

    const retryButton = await screen.findByRole('button', { name: /spróbuj ponownie|try again/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(listLegacyArchiveIndexMock).toHaveBeenCalledTimes(2);
    });
  });

  it('a 403 (ABAC-style denial) dostaje ten sam OGÓLNY komunikat D06 — nie ujawnia szczegółu backendu', async () => {
    listLegacyArchiveIndexMock.mockRejectedValue(
      new LegacyArchiveApiError('table_platform_live is restricted for org-999', 403)
    );

    render(<ResultsVNextLegacyArchivePanel domain="roi" />);

    await waitFor(() => {
      expect(
        screen.getByText('Dostęp ograniczony — nie masz uprawnień do tej operacji.')
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/org-999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/table_platform_live is restricted/)).not.toBeInTheDocument();
  });
});

describe('ResultsVNextLegacyArchivePanel · kebab „Usuń" na wierszu tylko-do-odczytu (RN-G5 Zadanie 1)', () => {
  beforeEach(() => {
    listLegacyArchiveIndexMock.mockReset();
    listLegacyArchiveIndexMock.mockResolvedValue({
      data: [{ sourceTable: 'kpis', originDomain: 'results_legacy', label: 'Legacy archive — read-only', count: 12 }],
      meta: { label: 'x', readOnly: true, organizationId: 'org-1', fetchedAt: new Date().toISOString() },
    });
  });

  it('pozycja „Usuń" jest widoczna, DISABLED, i ma podany powód (D06) — nigdy ukryta ani aktywna', async () => {
    render(<ResultsVNextLegacyArchivePanel domain="kpi" />);

    const kebab = await screen.findByRole('button', { name: /row actions/i });
    await userEvent.click(kebab);

    const deleteItem = await screen.findByRole('menuitem', { name: /usuń/i });
    expect(deleteItem).toBeDisabled();
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
    expect(deleteItem).toHaveTextContent('Archiwum tylko do odczytu — brak zapisów w tej powierzchni.');
  });

  it('kliknięcie DISABLED „Usuń" nic nie robi (żadnego wywołania usuwania)', async () => {
    render(<ResultsVNextLegacyArchivePanel domain="kpi" />);

    const kebab = await screen.findByRole('button', { name: /row actions/i });
    await userEvent.click(kebab);

    const deleteItem = await screen.findByRole('menuitem', { name: /usuń/i });
    // A real HTML `disabled` button does not dispatch a click at all — the
    // menu should still be open afterwards (no accidental close/action).
    fireEvent.click(deleteItem);
    expect(screen.getByRole('menuitem', { name: /usuń/i })).toBeInTheDocument();
  });
});
