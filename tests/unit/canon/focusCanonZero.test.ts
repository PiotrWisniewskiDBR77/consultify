import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const violationPattern = [
  'focus(-visible)?:(ring|outline)-(primary|crimson)',
  'ring-offset-(primary|crimson)',
].join('|');

describe('focus canon zero guard', () => {
  it('keeps the baseline and tracked src debt at zero', () => {
    const baseline = readFileSync(
      resolve(root, 'scripts/check-focus-canon.baseline.txt'),
      'utf8'
    );
    expect(baseline).toMatch(/RAZEM: 0 wystapien w 0 plikach/);

    expect(() =>
      execFileSync(
        'git',
        ['grep', '-nE', violationPattern, '--', 'src'],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
      )
    ).toThrow();
  });
});
