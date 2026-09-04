import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const probe = path.resolve('src/__day297_reachability_probe__.ts');

afterEach(() => {
  if (fs.existsSync(probe)) fs.unlinkSync(probe);
});

describe('reachability from product roots', () => {
  it('rejects a newly added file that is unreachable from app, harness, and tests', () => {
    fs.writeFileSync(probe, 'export const unreachableProbe = true;\n');
    expect(() => execFileSync(process.execPath, ['scripts/dev/reachability-from-root.mjs', '--check-baseline'], { stdio: 'pipe' })).toThrow();
  }, 30_000);

  it('accepts the measured baseline after the mutation is removed', () => {
    expect(execFileSync(process.execPath, ['scripts/dev/reachability-from-root.mjs', '--check-baseline'], { encoding: 'utf8' })).toContain('Reachability baseline OK');
  }, 30_000);
});
