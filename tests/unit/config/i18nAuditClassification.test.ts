import { describe, expect, it } from 'vitest';

import { justification } from '../../../scripts/dev/i18n-pl-audyt.mjs';

describe('i18n PL semantic classification', () => {
  it('separates justified shared terms from untranslated interface concepts', () => {
    expect(justification('Status')).toBeTruthy();
    expect(justification('Tempo')).toBeTruthy();
    expect(justification('Owner')).toBeNull();
  });
});
