import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// `files` to PODŁOGA, nie równość: równość dokładna czerwieniła bezpiecznik przy każdym
// dodanym pliku testu (5384 -> 5399), czyli z powodu niezwiązanego z tym, czego broni.
// Podłoga chroni przed odwrotnym fałszem: skaner, który nagle nic nie widzi, przechodziłby
// bezwarunkowo (brak pomiaru nie jest wynikiem).
const BASELINE = {
  files: 5403,
  candidates: 17,
  skipped: 0,
};

describe('empty assertion baseline', () => {
  it('rejects growth in weak-only network/database assertion blocks', () => {
    const stdout = execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/dev/testy-puste-skan.mjs')], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout);
    expect(result.files).toBeGreaterThanOrEqual(BASELINE.files);
    expect(result.candidates).toBeLessThanOrEqual(BASELINE.candidates);
    expect(result.skipped).toBe(BASELINE.skipped);
  });
});
