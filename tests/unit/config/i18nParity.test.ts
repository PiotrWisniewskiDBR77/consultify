import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const BASELINE = {
  plLeaves: 34310,
  enLeaves: 32321,
  defects: 134,
  // 17 -> 0 po usunieciu galezi koncowek fleksyjnych (17/17 falszywych alarmow na
  // angielskim 'approach'/'outreach'/'Overreach'). Ratchet zaciska sie do zera: kazdy
  // NOWY polski napis w pliku EN czerwieni bramke natychmiast.
  defektEn: 0,
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
