/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = path.resolve(process.cwd(), 'scripts/dev/seed-wave3-initiatives-scenarios.mjs');

function run(baseUrl: string, fixtureManifest = '') {
  return spawnSync(process.execPath, [script, 'readback'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      INITIATIVES_SCENARIOS_BASE_URL: baseUrl,
      INITIATIVES_SCENARIOS_FIXTURE_MANIFEST: fixtureManifest,
      INITIATIVES_SCENARIOS_EMAIL: 'owner@local.test',
      INITIATIVES_SCENARIOS_PASSWORD: 'not-a-real-secret',
    },
    encoding: 'utf8',
  });
}

describe('Wave 3 Initiatives scenario seeder guard', () => {
  it('rejects a non-local runtime', () => {
    const result = run('https://demo.consultify.ai', '/tmp/fixture.json');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('runtime host demo.consultify.ai is not local');
  });

  it('requires an absolute fixture manifest path', () => {
    const result = run('http://127.0.0.1:3986', 'fixture.json');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'INITIATIVES_SCENARIOS_FIXTURE_MANIFEST must be an absolute local filesystem path',
    );
  });

  it('rejects a manifest outside the owner fixture boundary', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-ini-scenario-guard-'));
    const manifest = path.join(dir, 'fixture.json');
    fs.writeFileSync(manifest, JSON.stringify({ fixtureId: 'OTHER', productionWrites: false }));
    try {
      const result = run('http://127.0.0.1:3986', manifest);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('fixture manifest is not the guarded Wave 3 owner fixture');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects any fixture manifest marked as production-writing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-ini-scenario-guard-'));
    const manifest = path.join(dir, 'fixture.json');
    fs.writeFileSync(
      manifest,
      JSON.stringify({ fixtureId: 'W3-INITIATIVES-OWNER-v1', productionWrites: true }),
    );
    try {
      const result = run('http://127.0.0.1:3986', manifest);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('fixture manifest is not the guarded Wave 3 owner fixture');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
