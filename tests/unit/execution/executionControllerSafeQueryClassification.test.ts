/**
 * DEC-120 A5 (same disease as DEC-112) — ExecutionController.getActionQueue's
 * safeQueryAll() used to silence any error whose message included the
 * substring 'does not exist', which ALSO matches Postgres' 42703
 * "column \"x\" does not exist" — a real schema/query bug, not a benign
 * missing-optional-table case. It now delegates to
 * DbPromise.isSilenceableMissingRelationError, which only allows a
 * genuinely missing relation (or uninitialized DB) to go quiet; a missing
 * column must stay loud and propagate.
 */
import { describe, expect, it } from 'vitest';

import { isSilenceableMissingRelationError } from '../../../server/src/utils/DbPromise.js';

describe('ExecutionController safeQueryAll classification (DEC-120 A5)', () => {
  it('silences a genuinely missing table/relation', () => {
    expect(isSilenceableMissingRelationError('no such table: decisions')).toBe(true);
    expect(
      isSilenceableMissingRelationError('relation "decisions" does not exist')
    ).toBe(true);
    expect(isSilenceableMissingRelationError('Database not initialized')).toBe(true);
  });

  it('does NOT silence a missing-column error even though it contains "does not exist"', () => {
    // This is the exact Postgres 42703 shape the old bare .includes() check
    // wrongly treated as "table missing" and swallowed into an empty array.
    expect(
      isSilenceableMissingRelationError('column "sla_deadline" does not exist')
    ).toBe(false);
    expect(
      isSilenceableMissingRelationError(
        'error: column d.escalation_deadline does not exist'
      )
    ).toBe(false);
  });

  it('does not silence unrelated database errors', () => {
    expect(isSilenceableMissingRelationError('connection terminated unexpectedly')).toBe(
      false
    );
    expect(isSilenceableMissingRelationError('syntax error at or near "SELECT"')).toBe(
      false
    );
  });
});
