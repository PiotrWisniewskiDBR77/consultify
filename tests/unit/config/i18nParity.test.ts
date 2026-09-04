import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const BASELINE = {
  plLeaves: 34310,
  enLeaves: 32321,
  defects: 134,
  defektEn: 17,
};

describe('i18n locale parity baseline', () => {
  it('prevents locale leaf loss and growth of classified language defects', () => {
    const stdout = execFileSync(
      process.execPath,
      [path.join(process.cwd(), 'scripts/dev/i18n-pl-audyt.mjs')],
      { cwd: process.cwd(), encoding: 'utf8' }
    );
    const result = JSON.parse(stdout);

    expect(result.plLeaves).toBeGreaterThanOrEqual(BASELINE.plLeaves);
    expect(result.enLeaves).toBeGreaterThanOrEqual(BASELINE.enLeaves);
    expect(result.defects).toBeLessThanOrEqual(BASELINE.defects);
    expect(result.defektEn).toBeLessThanOrEqual(BASELINE.defektEn);
  });
});
