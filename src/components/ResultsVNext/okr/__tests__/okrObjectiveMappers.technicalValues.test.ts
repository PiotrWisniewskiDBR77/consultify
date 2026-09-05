import { describe, expect, it } from 'vitest';

import { getOkrSetChildEditLock } from '../okrObjectiveMappers';

describe('OKR edit lock copy', () => {
  it('keeps the user message in Polish and the diagnostic code in the tooltip', () => {
    const lock = getOkrSetChildEditLock('active');
    expect(lock?.reason.pl).toContain('Cele i Kluczowe Rezultaty');
    expect(lock?.reason.pl).not.toMatch(/assertSet|server rule/i);
    expect(lock?.diagnosticTitle.pl).toBe('Kod diagnostyczny: SET_NOT_EDITABLE');
  });
});
