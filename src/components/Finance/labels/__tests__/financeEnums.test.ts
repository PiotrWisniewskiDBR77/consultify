import { describe, expect, it } from 'vitest';

import { statementReadinessLabel, statementReadinessLabelEntries } from '../financeEnums';

describe('statementReadinessLabel', () => {
  const codes = Object.keys(statementReadinessLabelEntries) as Array<
    keyof typeof statementReadinessLabelEntries
  >;

  it('covers all 4 real per-statement readiness codes emitted by financeTypes.ts#deriveStatementReadinessStatus', () => {
    expect(codes.sort()).toEqual(['pending', 'ready', 'recoverable', 'rejected']);
  });

  it('never renders a code equal to its own translation, in either language', () => {
    for (const code of codes) {
      expect(statementReadinessLabel(code, true)).not.toBe(code);
      expect(statementReadinessLabel(code, false)).not.toBe(code);
    }
  });

  it('maps every code to distinct Polish and English text', () => {
    expect(statementReadinessLabel('pending', true)).toBe('Oczekujące');
    expect(statementReadinessLabel('pending', false)).toBe('Pending');
    expect(statementReadinessLabel('recoverable', true)).toBe('Do poprawy');
    expect(statementReadinessLabel('recoverable', false)).toBe('Recoverable');
    expect(statementReadinessLabel('ready', true)).toBe('Gotowe');
    expect(statementReadinessLabel('ready', false)).toBe('Ready');
    expect(statementReadinessLabel('rejected', true)).toBe('Odrzucone');
    expect(statementReadinessLabel('rejected', false)).toBe('Rejected');
  });

  it('normalizes casing/whitespace instead of falling through to unknown', () => {
    expect(statementReadinessLabel(' READY ', true)).toBe('Gotowe');
  });

  it('never exposes a raw/unrecognized code — falls back to a generic label', () => {
    expect(statementReadinessLabel('SOME_FUTURE_CODE', true)).toBe('Nieznany stan');
    expect(statementReadinessLabel('SOME_FUTURE_CODE', false)).toBe('Unknown status');
    expect(statementReadinessLabel(null, true)).toBe('Nieznany stan');
    expect(statementReadinessLabel(undefined, false)).toBe('Unknown status');
  });
});
