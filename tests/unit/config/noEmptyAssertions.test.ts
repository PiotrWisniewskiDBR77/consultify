import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const BASELINE = {
  files: 5384,
  candidates: 21,
  skipped: 0,
};

describe('empty assertion baseline', () => {
  it('rejects growth in weak-only network/database assertion blocks', () => {
    const stdout = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/dev/testy-puste-skan.mjs')], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);
    expect(result.files).toBe(BASELINE.files);
    expect(result.candidates).toBeLessThanOrEqual(BASELINE.candidates);
    expect(result.skipped).toBe(BASELINE.skipped);
  });
});
