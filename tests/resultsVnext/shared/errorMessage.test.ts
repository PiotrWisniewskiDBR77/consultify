/**
 * RN-G5 polish — unit tests for
 * `src/components/ResultsVNext/shared/errorMessage.ts`'s
 * `toUserFacingErrorMessage`.
 *
 * THE BUG THIS GUARDS: every `*ApiError` in this domain
 * (`LegacyArchiveApiError`, `RoiApiError`, `OkrApiError`, …) puts the RAW
 * backend string on `.message` (`body.error`, always English, sometimes a
 * driver/DB-level string). ~60 call sites across ResultsVNext used to do
 * `err instanceof Error ? err.message : String(err)` and render that
 * straight to the screen regardless of the app's PL/EN locale. This helper
 * is the single place that now stands between a caught error and the
 * screen — these tests pin its three branches (security / network /
 * generic) and its telemetry side-channel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toUserFacingErrorMessage } from '../../../src/components/ResultsVNext/shared/errorMessage';

class FakeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FakeApiError';
    this.status = status;
  }
}

describe('toUserFacingErrorMessage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('never returns the raw backend `.message` verbatim — PL', () => {
    const err = new FakeApiError('relation "kpi_definitions_legacy" does not exist', 500);
    const message = toUserFacingErrorMessage(err, true);
    expect(message).not.toContain('relation');
    expect(message).not.toContain('does not exist');
    expect(message).toBe('Nie udało się wykonać tej operacji. Spróbuj ponownie.');
  });

  it('never returns the raw backend `.message` verbatim — EN', () => {
    const err = new FakeApiError('Internal server error', 500);
    const message = toUserFacingErrorMessage(err, false);
    expect(message).toBe('Something went wrong completing this action. Please try again.');
  });

  it('D06: a 403 gets the GENERIC security message, not the backend detail — PL', () => {
    // Backend detail deliberately names the record — the helper must not
    // let that reach the screen (D06's "must not reveal object existence").
    const err = new FakeApiError('KPI kpi-42 is private, owned by user-7', 403);
    const message = toUserFacingErrorMessage(err, true);
    expect(message).not.toContain('kpi-42');
    expect(message).not.toContain('user-7');
    expect(message).toBe('Dostęp ograniczony — nie masz uprawnień do tej operacji.');
  });

  it('D06: a 401 gets the same generic security message as 403 — EN', () => {
    const err = new FakeApiError('token expired for session sess-99', 401);
    const message = toUserFacingErrorMessage(err, false);
    expect(message).not.toContain('sess-99');
    expect(message).toBe('Access restricted — you do not have permission for this action.');
  });

  it('a network-level TypeError (fetch throw, no response) gets the network copy — PL', () => {
    const err = new TypeError('Failed to fetch');
    const message = toUserFacingErrorMessage(err, true);
    expect(message).toBe('Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.');
  });

  it('status 0 (this domain\'s network-error convention, see legacyArchiveApi.ts) gets the network copy — EN', () => {
    const err = new FakeApiError('Network error contacting /vnext/results/kpi/legacy: Failed to fetch', 0);
    const message = toUserFacingErrorMessage(err, false);
    expect(message).toBe('Could not reach the server. Check your connection and try again.');
  });

  it('a non-Error thrown value (String(err) case) still gets a safe, translated message', () => {
    const message = toUserFacingErrorMessage('a raw string was thrown', true);
    expect(message).toBe('Nie udało się wykonać tej operacji. Spróbuj ponownie.');
  });

  it('logs the raw detail to console.error for telemetry — the screen message never depends on it', () => {
    const err = new FakeApiError('super secret backend stack trace', 500);
    toUserFacingErrorMessage(err, true);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const loggedArgs = consoleErrorSpy.mock.calls[0];
    expect(loggedArgs.some((a) => a === err)).toBe(true);
  });
});
