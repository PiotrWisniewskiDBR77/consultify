/** @vitest-environment node */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const tsx = path.resolve(process.cwd(), 'node_modules/.bin/tsx');
const script = path.resolve(process.cwd(), 'server/scripts/seed-wave3-admin-owner-review.ts');

function run(command: string, url: string, confirm?: string, manifest?: string) {
  return spawnSync(tsx, [script, command], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_OWNER_FIXTURE_DATABASE_URL: url,
      ...(confirm ? { ADMIN_OWNER_FIXTURE_CONFIRM: confirm } : {}),
      ...(manifest ? { ADMIN_OWNER_FIXTURE_MANIFEST: manifest } : {}),
    },
    encoding: 'utf8',
  });
}

describe('Wave 3 Admin owner fixture guard', () => {
  it('rejects non-local database hosts before connecting', () => {
    const result = run('readback', 'postgresql://user:pass@example.com/consultify_w3_admin_owner_x');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('database host example.com is not local');
  });

  it('rejects a database outside the exact disposable prefix', () => {
    const result = run('readback', 'postgresql://user:pass@127.0.0.1/consultify');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('database name must match consultify_w3_admin_owner_');
  });

  it('requires literal YES before seed or whole-database reset', () => {
    for (const command of ['seed', 'reset']) {
      const manifest = path.join(os.tmpdir(), `w3-admin-never-written-${process.pid}-${command}.json`);
      const result = run(command, 'postgresql://user:pass@127.0.0.1/consultify_w3_admin_owner_guard_test', undefined, manifest);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('requires ADMIN_OWNER_FIXTURE_CONFIRM=YES');
    }
  });

  it('requires an absolute manifest path for seed', () => {
    const result = run('seed', 'postgresql://user:pass@127.0.0.1/consultify_w3_admin_owner_guard_test', 'YES');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ADMIN_OWNER_FIXTURE_MANIFEST is required for seed');
  });

  it('refuses to overwrite an existing manifest before database access', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-admin-manifest-'));
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifest, '{"existing":true}\n', { mode: 0o600 });
    try {
      const result = run('seed', 'postgresql://user:pass@127.0.0.1/consultify_w3_admin_owner_guard_test', 'YES', manifest);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('manifest path already exists; overwrite is refused');
      expect(fs.readFileSync(manifest, 'utf8')).toBe('{"existing":true}\n');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
