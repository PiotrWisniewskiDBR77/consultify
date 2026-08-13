/**
 * @vitest-environment jsdom
 *
 * E09 FinancialCaseDialog — POSITIVE persistence test. Stream S6-E09.
 *
 * ── WHAT THIS REPLACES, AND WHY IT IS NOT A DELETION ───────────────────────
 * `FinancialCaseDialog.noPersistence.test.tsx` pinned the ABSENCE of a save
 * path: it asserted zero `fetch` calls across add→close→reopen and that a
 * typed driver was GONE after reopening. That test was correct when written
 * (RISK-12 verdict (c)) and is now factually wrong — the save path exists, so
 * a test asserting "zero network calls" would fail, and worse, keeping it
 * would mean the suite actively defends the defect. It is replaced here rather
 * than dropped: every claim it made has an inverted counterpart below, so the
 * behaviour it described is still under test — just with the opposite expected
 * outcome.
 *
 *   old: zero fetches on edit           → new: Save issues a real save call
 *   old: driver GONE after reopen       → new: driver SURVIVES a reopen
 *   old: sanity — marker present first  → new: kept (still defeats a vacuous pass)
 *
 * The API module is mocked at the module boundary (not `global.fetch`) so the
 * assertions are about what the dialog ASKS the transport to do. The real HTTP
 * path, the real routes and the real physical row are covered by
 * tests/integration/e09-financial-case-persistence.realdb.test.ts.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchIdeaFinancialCase = vi.fn();
const saveIdeaFinancialCase = vi.fn();

class MockConflictError extends Error {
  current: unknown;
  currentVersion: number | null;
  constructor(current: unknown, currentVersion: number | null) {
    super('conflict');
    this.name = 'IdeaFinancialCaseConflictError';
    this.current = current;
    this.currentVersion = currentVersion;
  }
}

vi.mock('@/services/api/ideaFinancialCase.api', () => ({
  fetchIdeaFinancialCase: (...a: unknown[]) => fetchIdeaFinancialCase(...a),
  saveIdeaFinancialCase: (...a: unknown[]) => saveIdeaFinancialCase(...a),
  IdeaFinancialCaseConflictError: MockConflictError,
}));

const { FinancialCaseDialog } = await import(
  '../../../../../src/components/MyWork/table/financial/FinancialCaseDialog'
);

const IDEA_ID = 'idea_e09_persist';
const MARKER = 'E09_PERSIST_MARKER_9c2b71';
const SERVER_MARKER = 'E09_FROM_SERVER_4ad03e';

function storedCase(label: string) {
  return {
    currency: 'PLN',
    discountRatePct: 10,
    startPeriod: '2026-01',
    horizonMonths: 12,
    scenarios: ['base', 'upside', 'downside'],
    drivers: [
      {
        id: 'drv_stored_1',
        kind: 'benefit',
        benefitType: 'cash',
        label,
        category: 'Savings',
        unit: 'PLN',
        monthlyValues: { '2026-02': 1000 },
        scenarioMultipliers: {},
        confidence: 'medium',
        evidence: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function storedRow(label: string, version = 3) {
  return {
    id: 'fc_1',
    ideaId: IDEA_ID,
    organizationId: 'org_1',
    payload: { input: storedCase(label), result: null, lastComputedAt: null },
    version,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
  fetchIdeaFinancialCase.mockReset();
  saveIdeaFinancialCase.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * `noIdea` is a boolean rather than an `ideaId?: string` prop with a default:
 * passing `ideaId={undefined}` to a parameter with a default value silently
 * re-applies the default, so the "no idea context" case would never actually
 * be exercised and the test would pass against the wrong render. (Caught by
 * this suite going red — worth keeping the reason written down.)
 */
function Harness({ noIdea = false }: { noIdea?: boolean }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        reopen-trigger
      </button>
      <FinancialCaseDialog
        open={open}
        onClose={() => setOpen(false)}
        readOnly={false}
        ideaId={noIdea ? undefined : IDEA_ID}
      />
    </div>
  );
}

async function openedDialog() {
  return await screen.findByRole('dialog', { name: /Financial case/i });
}

describe('E09 FinancialCaseDialog — persistence (RISK-12 closed)', () => {
  it('loads the stored case on open — server drivers are rendered, not an empty case', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => {
      expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument();
    });
    expect(fetchIdeaFinancialCase).toHaveBeenCalledWith(IDEA_ID);
  });

  it('editing a driver then pressing Save sends the whole case with the loaded version', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 3));
    saveIdeaFinancialCase.mockResolvedValue(storedRow(MARKER, 4));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());

    // Save is disabled until something actually changes — an unchanged case
    // must not bump `version` and invalidate other editors.
    const saveBtn = within(dialog).getByRole('button', { name: /^Save$/i });
    expect(saveBtn).toBeDisabled();

    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    await waitFor(() => expect(saveBtn).toBeEnabled());

    fireEvent.click(saveBtn);

    await waitFor(() => expect(saveIdeaFinancialCase).toHaveBeenCalledTimes(1));
    const [sentIdeaId, sentPayload, sentVersion] = saveIdeaFinancialCase.mock.calls[0];
    expect(sentIdeaId).toBe(IDEA_ID);
    expect(sentVersion, 'must send the version it loaded, for OCC').toBe(3);
    expect(JSON.stringify(sentPayload.input)).toContain(MARKER);

    // Only NOW may the UI claim success.
    expect(await within(dialog).findByText(/^Saved$/i)).toBeInTheDocument();
  });

  it('the edited case SURVIVES close and reopen (the exact behaviour RISK-12 said was lost)', async () => {
    // First open serves the old label; after the save the server serves the new
    // one — i.e. the reopen reads through the transport, not a local cache.
    fetchIdeaFinancialCase
      .mockResolvedValueOnce(storedRow(SERVER_MARKER, 3))
      .mockResolvedValue(storedRow(MARKER, 4));
    saveIdeaFinancialCase.mockResolvedValue(storedRow(MARKER, 4));

    render(<Harness />);
    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());

    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    // SANITY (defeats a vacuous pass): the marker is genuinely present now, so
    // "still present after reopen" cannot pass because it was never typed.
    expect(within(dialog).getByDisplayValue(MARKER)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(saveIdeaFinancialCase).toHaveBeenCalledTimes(1));
    await within(dialog).findByText(/^Saved$/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /Close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'reopen-trigger' }));
    const reopened = await openedDialog();
    await waitFor(() => {
      expect(within(reopened).getByDisplayValue(MARKER)).toBeInTheDocument();
    });
  });

  it('a failed save NEVER shows "Saved" — it shows the real error', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 1));
    saveIdeaFinancialCase.mockRejectedValue(new Error('network is down'));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));

    expect(await within(dialog).findByText(/Save failed/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/network is down/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Saved$/i)).not.toBeInTheDocument();
    // The user's work is still on screen — a failed save must not clear it.
    expect(within(dialog).getByDisplayValue(MARKER)).toBeInTheDocument();
  });

  it('after a failed save the work is RECOVERABLE — retry saves again, it does not refetch over the edits', async () => {
    // REGRESSION GUARD. The first version of this feature derived `dirty` from
    // `status` alone, so a failed save (status 'error') disabled Save AND made
    // the error bar's button call reload() — refetching the server copy over
    // the user's unsent edits. That is RISK-12's silent discard reached through
    // the error path. Found by looking at the `error` screenshot.
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 1));
    saveIdeaFinancialCase.mockRejectedValueOnce(new Error('network is down'));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));
    await within(dialog).findByText(/Save failed/i);

    const loadsBefore = fetchIdeaFinancialCase.mock.calls.length;

    // 1. Save must still be reachable.
    expect(within(dialog).getByRole('button', { name: /^Save$/i })).toBeEnabled();

    // 2. The recovery button retries the SAVE, and does NOT refetch.
    saveIdeaFinancialCase.mockResolvedValue(storedRow(MARKER, 2));
    fireEvent.click(within(dialog).getByRole('button', { name: /Try saving again/i }));

    await waitFor(() => expect(saveIdeaFinancialCase).toHaveBeenCalledTimes(2));
    expect(
      fetchIdeaFinancialCase.mock.calls.length,
      'retrying a failed SAVE must not refetch over the local edits'
    ).toBe(loadsBefore);
    expect(await within(dialog).findByText(/^Saved$/i)).toBeInTheDocument();
  });

  it('closing after a FAILED save still warns instead of discarding silently', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 1));
    saveIdeaFinancialCase.mockRejectedValue(new Error('network is down'));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));
    await within(dialog).findByText(/Save failed/i);

    fireEvent.click(within(dialog).getByRole('button', { name: /Close/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Financial case/i })).toBeInTheDocument();
  });

  it('a 409 surfaces as a recoverable conflict, keeping local work and offering the server copy', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 1));
    saveIdeaFinancialCase.mockRejectedValue(new MockConflictError(storedRow('THEIRS', 7), 7));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Save$/i }));

    expect(await within(dialog).findByText(/Changed by someone else/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Saved$/i)).not.toBeInTheDocument();
    // Local work preserved, and a way out is offered.
    expect(within(dialog).getByDisplayValue(MARKER)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Reload theirs/i })).toBeInTheDocument();
  });

  it('a load failure shows an error, NOT a silently empty case', async () => {
    fetchIdeaFinancialCase.mockRejectedValue(new Error('backend exploded'));
    render(<Harness />);

    const dialog = await openedDialog();
    expect(await within(dialog).findByText(/backend exploded/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('closing with unsaved work asks first instead of discarding silently', async () => {
    fetchIdeaFinancialCase.mockResolvedValue(storedRow(SERVER_MARKER, 1));
    render(<Harness />);

    const dialog = await openedDialog();
    await waitFor(() => expect(within(dialog).getByDisplayValue(SERVER_MARKER)).toBeInTheDocument());
    fireEvent.change(within(dialog).getByDisplayValue(SERVER_MARKER), {
      target: { value: MARKER },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Close/i }));

    // Dialog is STILL open, with an explicit choice — this is the anti-silent-
    // discard guard that pays for choosing an explicit Save button.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Financial case/i })).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue(MARKER)).toBeInTheDocument();

    // Discarding is allowed — but only as a deliberate, named act.
    fireEvent.click(screen.getByRole('button', { name: /Discard changes/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('without an ideaId the dialog says it will not save instead of offering a dead Save button', async () => {
    render(<Harness noIdea />);
    const dialog = await openedDialog();
    expect(within(dialog).getByText(/no idea context/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
    expect(fetchIdeaFinancialCase).not.toHaveBeenCalled();
  });
});
