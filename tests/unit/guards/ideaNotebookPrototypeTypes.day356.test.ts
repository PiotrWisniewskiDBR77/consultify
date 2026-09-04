import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Day 356 idea/notebook prototype type guard', () => {
  it('type-checks the explicit prototype test target with a fixed 8192 MB heap', () => {
    const run = spawnSync(process.execPath, ['scripts/check-idea-notebook-prototype-types.mjs'], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    expect(`${run.stdout}\n${run.stderr}`).toContain('analyzedFiles=1');
    expect(`${run.stdout}\n${run.stderr}`).toContain('heapMb=8192');
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, 120_000);
});
