/**
 * @vitest-environment jsdom
 *
 * RISK-12 (P1, EVIDENCE_MISSING) settlement — G4-E09-FINANCE, 2026-08-11.
 *
 * This is the honest negative the DoD asks for: E09's financial case has NO
 * persistence path, flag-on or flag-off. Verdict (c) — see
 * docs/qa/ideas-complete-transformation-2026-08-09/10_FINANCIAL_CASE_ACCEPTANCE.md
 * for the full trace (flag → FinancialCaseDialog → FinancialCaseView →
 * useFinancialCase → engineAdapter, terminating with zero references to any
 * HTTP client anywhere in `src/components/MyWork/table/financial/` or
 * `src/services/ideaFinance/`).
 *
 * This test proves it at the ONLY real mount point
 * (`IdeaTableTool.tsx:4654-4661` renders exactly `<FinancialCaseDialog
 * open={showFinancialCase} onClose={...} readOnly={locked}
 * onStatusChange={...} />` — no `initialCase`, no `onCaseChange`, matching
 * this test's props exactly) two ways:
 *
 *   1. NEGATIVE CONTROL ON THE NETWORK: `global.fetch` is spied for the
 *      entire test. Every HTTP call in this codebase's frontend eventually
 *      goes through `fetchWithRetry` in `src/services/api/baseClient.ts`,
 *      which calls the real, un-mocked `fetch`. If any save path existed —
 *      wired or merely reachable — driver edits would produce at least one
 *      call. Zero calls across add/edit/close/reopen is the code-path-
 *      terminates-without-a-request proof the task asks for.
 *   2. DATA LOSS ON CLOSE/REOPEN: a distinctive marker typed into a driver's
 *      label is present after adding it, and gone after close+reopen — the
 *      component genuinely discards the user's work (matches
 *      `FinancialCaseDialog.tsx`'s own header comment: "resets on
 *      close/reopen"), it does not silently keep it in some hidden cache.
 *
 * Sabotage/restore semantics for this negative control: the "sabotage" a
 * positive persistence test would restore from is not applicable here (there
 * is nothing to disable — there was never a write). The equivalent rigor
 * check is the reverse: proving the assertion is not vacuously true because
 * the marker was never actually entered. `it('sanity: marker IS present
 * before close')` below is that check — it fails loudly if the driver-add
 * interaction stops working, which would otherwise let the "gone after
 * reopen" assertion pass for the wrong reason (nothing was ever there to
 * begin with).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FinancialCaseDialog } from '../../../../../src/components/MyWork/table/financial/FinancialCaseDialog';

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

/** Mirrors the ONLY real mount site: IdeaTableTool.tsx:4654-4661. */
function Harness() {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        reopen-trigger
      </button>
      <FinancialCaseDialog open={open} onClose={() => setOpen(false)} readOnly={false} />
    </div>
  );
}

const MARKER = 'RISK12_NOPERSIST_MARKER_7f3a1c';

describe('E09 FinancialCaseDialog — RISK-12 negative control: no save path exists', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Real fetch is left in place (not replaced by a resolving mock) — a
    // resolving mock would make "the call happened but we didn't check the
    // response" indistinguishable from "no call happened". Spying without
    // reimplementing observes calls while letting jsdom's fetch stub (or
    // absence thereof) behave however it already does in this project's
    // test environment; either way, `fetchSpy.mock.calls.length` is the
    // ground truth this test cares about.
    fetchSpy = vi.spyOn(global, 'fetch' as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('adding a driver, closing, and reopening the dialog never calls fetch, and the driver does not survive', async () => {
    render(<Harness />);

    // --- 1. Dialog is open (matches IdeaTableTool's showFinancialCase=true) ---
    // Two empty-state rows: cost-drivers table and benefit-drivers table.
    const dialog = screen.getByRole('dialog', { name: /Financial case/i });
    expect(within(dialog).getAllByText(/No drivers yet\./i)).toHaveLength(2);

    // --- 2. Add a benefit driver and type a distinctive label ---
    fireEvent.click(within(dialog).getByRole('button', { name: /Add benefit driver/i }));
    const labelInputs = within(dialog).getAllByPlaceholderText('Untitled driver');
    expect(labelInputs).toHaveLength(1);
    fireEvent.change(labelInputs[0], { target: { value: MARKER } });

    // --- 3. SANITY (defeats vacuous negative): marker genuinely present now ---
    expect(within(dialog).getByDisplayValue(MARKER)).toBeInTheDocument();

    // --- 4. NEGATIVE CONTROL: no network call was made by adding/editing a driver ---
    expect(fetchSpy).not.toHaveBeenCalled();

    // --- 5. Close the dialog (IdeaTableTool: setShowFinancialCase(false)) ---
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Still no network call — closing doesn't flush anything to a server either.
    expect(fetchSpy).not.toHaveBeenCalled();

    // --- 6. Reopen (IdeaTableTool: setShowFinancialCase(true)) ---
    fireEvent.click(screen.getByRole('button', { name: 'reopen-trigger' }));
    const reopened = screen.getByRole('dialog', { name: /Financial case/i });

    // --- 7. DATA LOSS: the marker is gone. Case reset to empty, exactly as
    //     FinancialCaseDialog.tsx's own header comment states ("resets on
    //     close/reopen") — not a bug this test is discovering, but the
    //     documented gap this test makes runtime-verifiable. ---
    expect(within(reopened).queryByDisplayValue(MARKER)).not.toBeInTheDocument();
    expect(within(reopened).getAllByText(/No drivers yet\./i)).toHaveLength(2);

    // --- 8. Across the entire add → close → reopen lifecycle: zero requests. ---
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
