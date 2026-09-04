import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryFiles: string[] = [];

function fixture(source: string): string {
  const file = path.join(os.tmpdir(), `day356-flag-${process.pid}-${temporaryFiles.length}.ts`);
  fs.writeFileSync(file, source);
  temporaryFiles.push(file);
  return file;
}

function run(file?: string) {
  return spawnSync(process.execPath, ['scripts/check-static-vite-flag-access.mjs', ...(file ? [file] : [])], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const file of temporaryFiles.splice(0)) fs.rmSync(file, { force: true });
});

describe('Day 356 static Vite flag access guard', () => {
  it('accepts the explicit production flag list with static access', () => {
    const result = run();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('analyzedFiles=3 violations=0');
  });

  it('rejects meta.env optional computed access', () => {
    const result = run(fixture('const value = meta.env?.[ENV_KEY];\n'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(':1 computed import.meta.env access is forbidden');
  });

  it('rejects meta optional env optional computed access', () => {
    const result = run(fixture('const value = meta?.env?.[ENV_KEY];\n'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(':1 computed import.meta.env access is forbidden');
  });
});
