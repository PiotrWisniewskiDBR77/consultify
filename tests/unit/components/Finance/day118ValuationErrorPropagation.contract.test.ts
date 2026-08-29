import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Day 118 valuation 409 propagation boundary', () => {
  it('does not replace APPROVED_VERSION_IMMUTABLE guidance with the generic DCF failure toast', () => {
    const source = fs.readFileSync(
      'src/components/Economics/hooks/useFinanceRowActions.ts',
      'utf8'
    );

    expect(source).not.toContain(
      "t('finance.toast.computeDcfFailed', 'Nie udało się obliczyć DCF')"
    );
    expect(source).toContain('APPROVED_VERSION_IMMUTABLE');
  });
});
