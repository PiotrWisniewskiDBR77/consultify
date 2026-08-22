/** @vitest-environment node */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
const script = path.resolve(process.cwd(), 'scripts/dev/start-wave3-owner-runtime.mjs'),
  artifacts: string[] = [];
let runSequence = 0;
const fingerprint = () =>
  JSON.parse(
    spawnSync(process.execPath, [script, 'fingerprint'], { cwd: process.cwd(), encoding: 'utf8' })
      .stdout
  );
function env(name = 'guard') {
  const fp = fingerprint();
  return {
    ...process.env,
    WAVE3_RUNTIME_CONFIRM: 'YES',
    WAVE3_RUNTIME_EXPECTED_SHA: fp.sha,
    WAVE3_RUNTIME_DIRTY_FINGERPRINT: fp.dirtyFingerprint,
    WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_runtime_${name}`,
    WAVE3_RUNTIME_MANIFEST: `/tmp/consultify-wave3-runtime-manifest-${name}.json`,
    WAVE3_RUNTIME_STATE_DIR: `/tmp/consultify-wave3-runtime-${name}`,
    WAVE3_RUNTIME_SERVER_PORT: '3960',
    WAVE3_RUNTIME_CLIENT_PORT: '3961',
  };
}
function run(command = 'start', overrides: Record<string, string> = {}) {
  const invocation = `guard_${process.pid}_${++runSequence}`;
  const invocationEnv = env(invocation);
  artifacts.push(
    invocationEnv.WAVE3_RUNTIME_MANIFEST,
    invocationEnv.WAVE3_RUNTIME_STATE_DIR
  );
  return spawnSync(process.execPath, [script, command], {
    cwd: process.cwd(),
    env: { ...invocationEnv, ...overrides },
    encoding: 'utf8',
    timeout: 30000,
  });
}
function adoptedEnv(name: string, manifestPath: string) {
  return {
    ...env(name),
    WAVE3_RUNTIME_MODE: 'adopt-existing',
    WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_organization_owner_${name}`,
    WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
  };
}
const ownershipNonce = 'a'.repeat(64);
function fixtureManifestValue(
  databaseName: string,
  fixtureId = 'W3-ORGANIZATION-OWNER-v1',
  fixture = fixtureId
) {
  return {
    databaseName,
    fixture,
    fixtureId,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId, ownershipNonce },
  };
}
async function installFixtureMarker(
  databaseUrl: string,
  databaseName: string,
  fixtureId = 'W3-ORGANIZATION-OWNER-v1'
) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(
    `create table wave3_owner_fixture_markers(
       fixture_id text primary key, ownership_nonce text not null, database_name text not null)`
  );
  await client.query(
    `insert into wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name)
     values($1,$2,$3)`,
    [fixtureId, ownershipNonce, databaseName]
  );
  await client.end();
}
afterEach(() => {
  for (const p of artifacts.splice(0)) fs.rmSync(p, { recursive: true, force: true });
});
describe('Wave3 owner runtime guards', () => {
  it('reports exact fingerprint', () =>
    expect(fingerprint().dirtyFingerprint).toMatch(/^[a-f0-9]{64}$/));
  it('rejects wrong SHA before mutation', () => {
    const r = run('start', { WAVE3_RUNTIME_EXPECTED_SHA: 'bad' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('must equal current HEAD');
  });
  it('rejects protected ports and remote DB', () => {
    expect(run('start', { WAVE3_RUNTIME_SERVER_PORT: '3940' }).stderr).toContain('not 3940/3941');
    expect(
      run('start', {
        WAVE3_RUNTIME_DATABASE_URL: 'postgresql://u:p@example.com/consultify_w3_runtime_guard',
      }).stderr
    ).toContain('runtime DB must be local');
  });
  it('guards adopt-existing mode, closed DB prefixes and fixture manifest identity', () => {
    expect(run('start', { WAVE3_RUNTIME_MODE: 'other' }).stderr).toContain(
      'must be create or adopt-existing'
    );
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_unknown_owner_guard',
      }).stderr
    ).toContain('closed Wave3 owner prefix allowlist');
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@example.com/consultify_w3_organization_owner_guard',
      }).stderr
    ).toContain('adopted DB must be local');
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_admin_owner_guard',
        WAVE3_RUNTIME_FIXTURE_MANIFEST: '/tmp/consultify-wave3-admin-owner-missing.json',
      }).stderr
    ).toContain('fixture manifest must exist');
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_organization_owner_guard',
        WAVE3_RUNTIME_FIXTURE_MANIFEST: '/tmp/consultify-wave3-fixture-manifest-missing.json',
      }).stderr
    ).toContain('fixture manifest must exist');
    const manifestPath = '/tmp/consultify-wave3-fixture-manifest-guard.json';
    artifacts.push(manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifestValue('wrong')), { mode: 0o600 });
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_organization_owner_guard',
        WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      }).stderr
    ).toContain('databaseName differs');
    fs.chmodSync(manifestPath, 0o644);
    expect(
      run('start', {
        WAVE3_RUNTIME_MODE: 'adopt-existing',
        WAVE3_RUNTIME_DATABASE_URL:
          'postgresql://consultinity:consultinity@127.0.0.1:34940/consultify_w3_organization_owner_guard',
        WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      }).stderr
    ).toContain('regular 0600 file');
  });
  it('rejects a provisional fixture receipt even when its ownership tuple is syntactically complete', () => {
    const name = `adopt_provisional_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`;
    artifacts.push(manifestPath);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        ...fixtureManifestValue(dbName),
        ownershipState: undefined,
        state: 'PROVISIONAL',
      }),
      { mode: 0o600 }
    );

    const result = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('finalized owner-fixture receipt');
  });
  it('rejects a FINAL marker from a different fixture family under the Organization DB prefix', () => {
    const name = `adopt_wrong_family_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`;
    artifacts.push(manifestPath);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(fixtureManifestValue(dbName, 'W3-SETTINGS-OWNER-v1')),
      { mode: 0o600 }
    );

    const result = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ownership marker contract is invalid');
  });
  it('binds the Finance prefix to the exact FINAL Finance fixture family', () => {
    const name = `adopt_finance_family_${process.pid}`,
      dbName = `consultify_w3_finance_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`,
      runtimeManifest = `/tmp/consultify-wave3-runtime-manifest-${name}.json`,
      runtimeState = `/tmp/consultify-wave3-runtime-${name}`;
    artifacts.push(manifestPath, runtimeManifest, runtimeState);
    fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifestValue(dbName)), { mode: 0o600 });

    const wrongFamily = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      WAVE3_RUNTIME_MANIFEST: runtimeManifest,
      WAVE3_RUNTIME_STATE_DIR: runtimeState,
    });
    expect(wrongFamily.status).not.toBe(0);
    expect(wrongFamily.stderr).toContain('ownership marker contract is invalid');

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        fixtureManifestValue(dbName, 'W3-FINANCE-OWNER-v1', 'wave3-finance-owner-review-v1')
      ),
      { mode: 0o600 }
    );
    const exactFamily = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      WAVE3_RUNTIME_MANIFEST: runtimeManifest,
      WAVE3_RUNTIME_STATE_DIR: runtimeState,
    });
    expect(exactFamily.status).not.toBe(0);
    expect(exactFamily.stderr).not.toContain('ownership marker contract is invalid');
    expect(exactFamily.stderr).toContain('adopted runtime database does not exist');
  });
  it('binds the Audits prefix to the exact FINAL Audits fixture family', () => {
    const dbName = `consultify_w3_audits_owner_guard_${process.pid}`;
    const manifestPath = `/tmp/consultify-wave3-fixture-manifest-audits-${process.pid}.json`;
    const runtimeManifest = `/tmp/consultify-wave3-runtime-manifest-audits-${process.pid}.json`;
    const runtimeState = `/tmp/consultify-wave3-runtime-audits-${process.pid}`;
    artifacts.push(manifestPath, runtimeManifest, runtimeState);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        fixtureManifestValue(dbName, 'W3-AUDITS-OWNER-v1', 'wave3-audits-owner-review-v1')
      ),
      { mode: 0o600 }
    );
    const result = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      WAVE3_RUNTIME_MANIFEST: runtimeManifest,
      WAVE3_RUNTIME_STATE_DIR: runtimeState,
    });
    expect(result.stderr).not.toContain('closed Wave3 owner prefix allowlist');
    expect(result.stderr).not.toContain('ownership marker contract is invalid');
    expect(result.stderr).toContain('adopted runtime database does not exist');
  });
  it('binds the Execution prefix to the exact FINAL Execution fixture family', () => {
    const dbName = `consultify_w3_execution_owner_guard_${process.pid}`;
    const manifestPath = `/tmp/consultify-wave3-fixture-manifest-execution-${process.pid}.json`;
    const runtimeManifest = `/tmp/consultify-wave3-runtime-manifest-execution-${process.pid}.json`;
    const runtimeState = `/tmp/consultify-wave3-runtime-execution-${process.pid}`;
    artifacts.push(manifestPath, runtimeManifest, runtimeState);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        fixtureManifestValue(dbName, 'W3-EXECUTION-OWNER-v1', 'wave3-execution-owner-review-v1')
      ),
      { mode: 0o600 }
    );
    const result = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      WAVE3_RUNTIME_MANIFEST: runtimeManifest,
      WAVE3_RUNTIME_STATE_DIR: runtimeState,
    });
    expect(result.stderr).not.toContain('closed Wave3 owner prefix allowlist');
    expect(result.stderr).not.toContain('ownership marker contract is invalid');
    expect(result.stderr).toContain('adopted runtime database does not exist');
  });
  it('binds the Settings prefix to the exact FINAL Settings fixture family', () => {
    const dbName = `consultify_w3_settings_owner_guard_${process.pid}`;
    const manifestPath = `/tmp/consultify-wave3-fixture-manifest-settings-${process.pid}.json`;
    const runtimeManifest = `/tmp/consultify-wave3-runtime-manifest-settings-${process.pid}.json`;
    const runtimeState = `/tmp/consultify-wave3-runtime-settings-${process.pid}`;
    artifacts.push(manifestPath, runtimeManifest, runtimeState);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(fixtureManifestValue(dbName, 'W3-SETTINGS-OWNER-v1')),
      { mode: 0o600 }
    );
    const result = run('start', {
      WAVE3_RUNTIME_MODE: 'adopt-existing',
      WAVE3_RUNTIME_DATABASE_URL: `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      WAVE3_RUNTIME_FIXTURE_MANIFEST: manifestPath,
      WAVE3_RUNTIME_MANIFEST: runtimeManifest,
      WAVE3_RUNTIME_STATE_DIR: runtimeState,
    });
    expect(result.stderr).not.toContain('closed Wave3 owner prefix allowlist');
    expect(result.stderr).not.toContain('ownership marker contract is invalid');
    expect(result.stderr).toContain('adopted runtime database does not exist');
  });
  it('adopted start failure preserves the existing DB and fixture rows', async () => {
    const name = `adopt_fail_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`,
      e = adoptedEnv(name, manifestPath),
      admin = new pg.Client({
        connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
      });
    artifacts.push(manifestPath, e.WAVE3_RUNTIME_STATE_DIR);
    fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifestValue(dbName)), { mode: 0o600 });
    await admin.connect();
    await admin.query(`create database "${dbName}"`);
    await installFixtureMarker(e.WAVE3_RUNTIME_DATABASE_URL, dbName);
    const marker = new pg.Client({ connectionString: e.WAVE3_RUNTIME_DATABASE_URL });
    await marker.connect();
    await marker.query(`update wave3_owner_fixture_markers set ownership_nonce=$1`, [
      'b'.repeat(64),
    ]);
    let r = spawnSync(process.execPath, [script, 'start'], {
      cwd: process.cwd(),
      env: {
        ...e,
        WAVE3_RUNTIME_FAIL_AT: 'after-db',
        WAVE3_RUNTIME_SERVER_PORT: '4010',
        WAVE3_RUNTIME_CLIENT_PORT: '4011',
      },
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('ownership marker does not exactly match');
    fs.rmSync(e.WAVE3_RUNTIME_STATE_DIR, { recursive: true, force: true });
    await marker.query(`update wave3_owner_fixture_markers set ownership_nonce=$1`, [
      ownershipNonce,
    ]);
    await marker.end();
    const fixture = new pg.Client({ connectionString: e.WAVE3_RUNTIME_DATABASE_URL });
    await fixture.connect();
    await fixture.query('create table fixture_sentinel(value text)');
    await fixture.query("insert into fixture_sentinel values('preserve-me')");
    await fixture.end();
    r = spawnSync(process.execPath, [script, 'start'], {
      cwd: process.cwd(),
      env: {
        ...e,
        WAVE3_RUNTIME_FAIL_AT: 'after-db',
        WAVE3_RUNTIME_SERVER_PORT: '4010',
        WAVE3_RUNTIME_CLIENT_PORT: '4011',
      },
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(r.status).not.toBe(0);
    const check = new pg.Client({ connectionString: e.WAVE3_RUNTIME_DATABASE_URL });
    await check.connect();
    expect((await check.query('select value from fixture_sentinel')).rows[0].value).toBe(
      'preserve-me'
    );
    await check.end();
    await admin.query(`drop database "${dbName}" with (force)`);
    await admin.end();
  });
  it('adopted stop preserves DB and refuses fixture-state mismatch before signal', async () => {
    const name = `adopt_stop_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`,
      e = adoptedEnv(name, manifestPath),
      statePath = path.join(e.WAVE3_RUNTIME_STATE_DIR, 'state.json'),
      admin = new pg.Client({
        connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
      });
    artifacts.push(manifestPath, e.WAVE3_RUNTIME_STATE_DIR);
    fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifestValue(dbName)), { mode: 0o600 });
    const manifestSha = crypto
      .createHash('sha256')
      .update(fs.readFileSync(manifestPath))
      .digest('hex');
    await admin.connect();
    await admin.query(`create database "${dbName}"`);
    await installFixtureMarker(e.WAVE3_RUNTIME_DATABASE_URL, dbName);
    const fixture = new pg.Client({ connectionString: e.WAVE3_RUNTIME_DATABASE_URL });
    await fixture.connect();
    await fixture.query('create table fixture_sentinel(value text)');
    await fixture.query("insert into fixture_sentinel values('preserve-on-stop')");
    await fixture.end();
    fs.mkdirSync(e.WAVE3_RUNTIME_STATE_DIR, { mode: 0o700 });
    const state = {
      schema: 'W3-RUNTIME-STATE-v2',
      sha: e.WAVE3_RUNTIME_EXPECTED_SHA,
      fingerprint: e.WAVE3_RUNTIME_DIRTY_FINGERPRINT,
      mode: 'adopt-existing',
      fixture: { path: fs.realpathSync(manifestPath), sha256: 'bad' },
      database: {
        configured: { host: '127.0.0.1', port: 34940, user: 'consultinity', name: dbName },
        preserved: true,
      },
      server: null,
      client: null,
    };
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    let r = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: e,
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('fixture manifest identity/hash differs');
    state.fixture.sha256 = manifestSha;
    fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
    r = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: e,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"databasePreserved": true');
    expect(r.stdout).toContain('"catalogPresentAndPreserved": true');
    expect(
      Number(
        (await admin.query('select count(*)::int n from pg_database where datname=$1', [dbName]))
          .rows[0].n
      )
    ).toBe(1);
    const preserved = new pg.Client({ connectionString: e.WAVE3_RUNTIME_DATABASE_URL });
    await preserved.connect();
    expect((await preserved.query('select value from fixture_sentinel')).rows[0].value).toBe(
      'preserve-on-stop'
    );
    await preserved.end();
    await admin.query(`drop database "${dbName}" with (force)`);
    await admin.end();
  });
  it('adopted stop fails closed when the bound DB is missing', () => {
    const name = `adopt_missing_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      manifestPath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`,
      e = adoptedEnv(name, manifestPath),
      statePath = path.join(e.WAVE3_RUNTIME_STATE_DIR, 'state.json');
    artifacts.push(manifestPath, e.WAVE3_RUNTIME_STATE_DIR);
    fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifestValue(dbName)), { mode: 0o600 });
    fs.mkdirSync(e.WAVE3_RUNTIME_STATE_DIR, { mode: 0o700 });
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        sha: e.WAVE3_RUNTIME_EXPECTED_SHA,
        fingerprint: e.WAVE3_RUNTIME_DIRTY_FINGERPRINT,
        mode: 'adopt-existing',
        fixture: {
          path: fs.realpathSync(manifestPath),
          sha256: crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex'),
        },
        database: {
          configured: { host: '127.0.0.1', port: 34940, user: 'consultinity', name: dbName },
        },
        server: null,
        client: null,
      }),
      { mode: 0o600 }
    );
    const r = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: e,
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('owned database absent before stop; refusing process signal');
  });
  it('adopted SIGINT and SIGTERM terminate owned stages but preserve marker, sentinel and catalog', async () => {
    const name = `adopt_signal_${process.pid}`,
      dbName = `consultify_w3_organization_owner_${name}`,
      databaseUrl = `postgresql://consultinity:consultinity@127.0.0.1:34940/${dbName}`,
      fixturePath = `/tmp/consultify-wave3-fixture-manifest-${name}.json`,
      admin = new pg.Client({
        connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
      });
    let activeRuntime: ReturnType<typeof spawn> | null = null;
    artifacts.push(fixturePath);
    fs.writeFileSync(fixturePath, JSON.stringify(fixtureManifestValue(dbName)), { mode: 0o600 });
    await admin.connect();
    try {
      await admin.query(`create database "${dbName}"`);
      const migrated = spawnSync('npm', ['run', 'db:migrate:strict'], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl, DB_TYPE: 'postgres', NODE_ENV: 'test' },
        encoding: 'utf8',
        timeout: 180000,
      });
      expect(migrated.status, migrated.stderr || migrated.stdout).toBe(0);
      await installFixtureMarker(databaseUrl, dbName);
      const fixture = new pg.Client({ connectionString: databaseUrl });
      await fixture.connect();
      await fixture.query('create table fixture_sentinel(value text)');
      await fixture.query("insert into fixture_sentinel values('preserve-on-signal')");
      await fixture.end();
      for (const [signal, expectedCode, suffix, serverPort, clientPort] of [
        ['SIGINT', 130, 'int', 4012, 4013],
        ['SIGTERM', 143, 'term', 4014, 4015],
      ] as const) {
        const e = adoptedEnv(name, fixturePath),
          stateDir = `/tmp/consultify-wave3-runtime-${name}_${suffix}`,
          runtimeManifest = `/tmp/consultify-wave3-runtime-manifest-${name}_${suffix}.json`,
          statePath = path.join(stateDir, 'state.json');
        artifacts.push(stateDir, runtimeManifest);
        Object.assign(e, {
          WAVE3_RUNTIME_STATE_DIR: stateDir,
          WAVE3_RUNTIME_MANIFEST: runtimeManifest,
          WAVE3_RUNTIME_SERVER_PORT: String(serverPort),
          WAVE3_RUNTIME_CLIENT_PORT: String(clientPort),
        });
        activeRuntime = spawn(process.execPath, [script, 'start'], {
          cwd: process.cwd(),
          env: e,
          stdio: 'ignore',
        });
        const runtime = activeRuntime;
        const deadline = Date.now() + 90000;
        let staged: any = null;
        while (Date.now() < deadline) {
          if (fs.existsSync(statePath)) {
            staged = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (staged.server?.pgid) break;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        expect(staged?.server?.pgid).toBeTruthy();
        runtime.kill(signal);
        const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (resolve) => runtime.once('exit', (code, received) => resolve({ code, signal: received }))
        );
        activeRuntime = null;
        expect(exit).toEqual({ code: expectedCode, signal: null });
        const finalState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        expect(finalState.cleanupProof?.processGroupsVerifiedTerminated).toBe(true);
        for (const proc of [finalState.server, finalState.client].filter(Boolean))
          expect(
            spawnSync('pgrep', ['-g', String(proc.pgid)], { encoding: 'utf8' }).stdout.trim()
          ).toBe('');
        for (const port of [serverPort, clientPort])
          expect(
            spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
              encoding: 'utf8',
            }).stdout.trim()
          ).toBe('');
        const check = new pg.Client({ connectionString: databaseUrl });
        await check.connect();
        expect((await check.query('select value from fixture_sentinel')).rows[0].value).toBe(
          'preserve-on-signal'
        );
        expect(
          (
            await check.query(
              'select count(*)::int n from public.wave3_owner_fixture_markers where fixture_id=$1 and ownership_nonce=$2',
              ['W3-ORGANIZATION-OWNER-v1', ownershipNonce]
            )
          ).rows[0].n
        ).toBe(1);
        await check.end();
      }
      expect(
        Number(
          (await admin.query('select count(*)::int n from pg_database where datname=$1', [dbName]))
            .rows[0].n
        )
      ).toBe(1);
    } finally {
      if (activeRuntime && activeRuntime.exitCode === null) {
        const stopped = new Promise<void>((resolve) =>
          activeRuntime?.once('exit', () => resolve())
        );
        activeRuntime.kill('SIGTERM');
        await Promise.race([stopped, new Promise<void>((resolve) => setTimeout(resolve, 15000))]);
        if (activeRuntime.exitCode === null) activeRuntime.kill('SIGKILL');
      }
      await admin.query(
        'select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()',
        [dbName]
      );
      await admin.query(`drop database if exists "${dbName}" with (force)`);
      await admin.end();
    }
  }, 240000);
  it('rejects traversal and symlink state paths', () => {
    expect(
      run('start', { WAVE3_RUNTIME_STATE_DIR: '/tmp/../tmp/consultify-wave3-runtime-x' }).stderr
    ).toContain('normalized');
    const target = '/tmp/consultify-wave3-runtime-target',
      link = '/tmp/consultify-wave3-runtime-link';
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(target, link);
    artifacts.push(link, target);
    expect(run('status', { WAVE3_RUNTIME_STATE_DIR: link }).stderr).toContain(
      'must not be a symlink'
    );
  });
  it('refuses full DB identity mismatch before process action', () => {
    const e = env('identity'),
      dir = e.WAVE3_RUNTIME_STATE_DIR;
    fs.mkdirSync(dir, { mode: 0o700 });
    artifacts.push(dir);
    fs.writeFileSync(
      path.join(dir, 'state.json'),
      JSON.stringify({
        sha: e.WAVE3_RUNTIME_EXPECTED_SHA,
        fingerprint: e.WAVE3_RUNTIME_DIRTY_FINGERPRINT,
        database: {
          configured: {
            host: '127.0.0.1',
            port: 34940,
            user: 'different',
            name: 'consultify_w3_runtime_identity',
          },
        },
        server: null,
        client: null,
      }),
      { mode: 0o600 }
    );
    const r = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: e,
      encoding: 'utf8',
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('database host/port/user/name differs');
  });
  it('staged after-db failure cleans the created database', async () => {
    const name = `fail_${process.pid}`,
      e = env(name),
      dir = e.WAVE3_RUNTIME_STATE_DIR;
    artifacts.push(dir);
    const r = spawnSync(process.execPath, [script, 'start'], {
      cwd: process.cwd(),
      env: {
        ...e,
        WAVE3_RUNTIME_FAIL_AT: 'after-db',
        WAVE3_RUNTIME_SERVER_PORT: '3962',
        WAVE3_RUNTIME_CLIENT_PORT: '3963',
      },
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('injected after-db failure');
    const c = new pg.Client({
      connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
    });
    await c.connect();
    const q = await c.query('select count(*)::int n from pg_database where datname=$1', [
      `consultify_w3_runtime_${name}`,
    ]);
    await c.end();
    expect(q.rows[0].n).toBe(0);
  });
  it('uses allowlisted child env, staged process groups, exact code checks and secret scans', () => {
    const s = fs.readFileSync(script, 'utf8');
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SHELL', 'TERM'])
      expect(s).toContain(`'${key}'`);
    expect(s).toMatch(/stageProcess\(server,\s*'server'/);
    expect(s).toMatch(/stageProcess\(client,\s*'client'/);
    expect(s).toContain('signalGroup(p.pgid');
    expect(s).toMatch(/processGroup\(p\.pid\)\s*!==\s*p\.pgid/);
    expect(s).toContain('DOTENV_DISABLED');
    expect(s).toContain('VITE_DOTENV_DISABLED');
    expect(s).toContain("ENABLE_V8_GLOBAL: 'true'");
    expect(s).toContain("ENABLE_V8_SHADOW_MODE: 'false'");
    expect(s).toContain("case 'W3-FINANCE-OWNER-v1'");
    expect(s).toContain("VITE_WAVE3_FINANCE_OWNER_REVIEW: 'true'");
    expect(s).toContain("case 'W3-RESULTS-OWNER-v1'");
    expect(s).toContain("VITE_WAVE3_RESULTS_OWNER_REVIEW: 'true'");
    expect(s).toContain('...fixtureClientEnvironment(c.fixture)');
    expect(s).toContain('fixtureBoundClientFlags: fixtureClientEnvironment(c.fixture)');
    expect(s).toContain('v8GlobalEnabled: true');
    expect(s).toContain('/api/ready');
    expect(s).not.toMatch(
      /waitHttp\(`http:\/\/127\.0\.0\.1:\$\{c\.serverPort\}\/api\/health\/ready`\)/
    );
    expect(s).toMatch(/hj\.gitSha\s*!==\s*c\.sha/);
    expect(s).toMatch(/rj\.buildSha\s*!==\s*c\.sha/);
    expect(s).toContain("rj.migrations?.state !== 'ok'");
    expect(s).toContain("rj.sqlMigrations?.state !== 'ok'");
    expect(s).toContain('marker.body.includes(c.sha)');
    expect(s).toMatch(/currentDirtyFingerprint\(\)\s*!==\s*c\.fingerprint/);
    expect(s).toMatch(/scan\(\[sl,\s*cl,\s*stateFile,\s*c\.manifestPath\]\)/);
    const clientEnvBlock = s.match(/const clientEnv = childEnv\((\{[\s\S]*?\})\);/)?.[1] || '';
    expect(clientEnvBlock).not.toContain('DATABASE_URL');
    expect(clientEnvBlock).not.toContain('JWT_SECRET');
    expect(s).toContain('serverOnlyCredentialsAbsentFromViteGroup: true');
  });
  it('executable migration/server/client/readiness failures leave no DB, PID, PGID or listener and preserve protected ports', async () => {
    const protectedBefore = [3940, 3941].map((p) =>
      spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN', '-t'], {
        encoding: 'utf8',
      }).stdout.trim()
    );
    const cases = [
      ['migration', 3984, 3985],
      ['server-spawn', 3986, 3987],
      ['client-spawn', 3988, 3989],
      ['readiness', 3990, 3991],
    ] as const;
    const admin = new pg.Client({
      connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
    });
    await admin.connect();
    for (const [failure, serverPort, clientPort] of cases) {
      const name = `exec_${failure.replace('-', '_')}_${process.pid}`,
        e = env(name),
        dir = e.WAVE3_RUNTIME_STATE_DIR;
      artifacts.push(dir);
      const r = spawnSync(process.execPath, [script, 'start'], {
        cwd: process.cwd(),
        env: {
          ...e,
          WAVE3_RUNTIME_FAIL_AT: failure,
          WAVE3_RUNTIME_SERVER_PORT: String(serverPort),
          WAVE3_RUNTIME_CLIENT_PORT: String(clientPort),
        },
        encoding: 'utf8',
        timeout: 90000,
      });
      expect(r.status, `${failure} must fail`).not.toBe(0);
      expect(r.stderr).toContain('injected');
      expect(
        Number(
          (
            await admin.query('select count(*)::int n from pg_database where datname=$1', [
              `consultify_w3_runtime_${name}`,
            ])
          ).rows[0].n
        )
      ).toBe(0);
      for (const port of [serverPort, clientPort])
        expect(
          spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
            encoding: 'utf8',
          }).stdout.trim()
        ).toBe('');
      const statePath = path.join(dir, 'state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        expect(state.cleanupProof?.processGroupsVerifiedTerminated).toBe(true);
        expect(state.stage).toBe('PROCESSES_TERMINATED');
        for (const proc of [state.server, state.client].filter(Boolean)) {
          expect(
            spawnSync('ps', ['-p', String(proc.pid), '-o', 'pid='], {
              encoding: 'utf8',
            }).stdout.trim()
          ).toBe('');
          expect(
            spawnSync('pgrep', ['-g', String(proc.pgid)], { encoding: 'utf8' }).stdout.trim()
          ).toBe('');
        }
      }
    }
    await admin.end();
    expect(
      [3940, 3941].map((p) =>
        spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN', '-t'], {
          encoding: 'utf8',
        }).stdout.trim()
      )
    ).toEqual(protectedBefore);
  }, 180000);
  it('executable PGID tamper refuses signal and DB drop, then exact restored state cleans safely', async () => {
    const name = `pgid_${process.pid}`,
      e = env(name),
      dir = e.WAVE3_RUNTIME_STATE_DIR,
      statePath = path.join(dir, 'state.json'),
      admin = new pg.Client({
        connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
      });
    artifacts.push(dir);
    await admin.connect();
    await admin.query(`create database "consultify_w3_runtime_${name}"`);
    fs.mkdirSync(dir, { mode: 0o700 });
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    await new Promise((r) => setTimeout(r, 300));
    const pgid = Number(
        spawnSync('ps', ['-p', String(child.pid), '-o', 'pgid='], {
          encoding: 'utf8',
        }).stdout.trim()
      ),
      identity = spawnSync(
        'ps',
        ['-p', String(child.pid), '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='],
        { encoding: 'utf8' }
      ).stdout.trim(),
      base = {
        schema: 'W3-RUNTIME-STATE-v2',
        sha: e.WAVE3_RUNTIME_EXPECTED_SHA,
        fingerprint: e.WAVE3_RUNTIME_DIRTY_FINGERPRINT,
        database: {
          configured: {
            host: '127.0.0.1',
            port: 34940,
            user: 'consultinity',
            name: `consultify_w3_runtime_${name}`,
          },
        },
        server: { pid: child.pid, pgid: pgid + 1, identity },
        client: null,
        stage: 'SERVER_OWNED',
      };
    fs.writeFileSync(statePath, JSON.stringify(base, null, 2), { mode: 0o600 });
    const blocked = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: { ...e, WAVE3_RUNTIME_SERVER_PORT: '3994', WAVE3_RUNTIME_CLIENT_PORT: '3995' },
      encoding: 'utf8',
    });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toContain('PID identity/PGID missing or changed; refusing signal');
    expect(
      spawnSync('ps', ['-p', String(child.pid), '-o', 'pid='], { encoding: 'utf8' }).stdout.trim()
    ).toBe(String(child.pid));
    expect(
      Number(
        (
          await admin.query('select count(*)::int n from pg_database where datname=$1', [
            `consultify_w3_runtime_${name}`,
          ])
        ).rows[0].n
      )
    ).toBe(1);
    base.server.pgid = pgid;
    fs.writeFileSync(statePath, JSON.stringify(base, null, 2), { mode: 0o600 });
    const cleaned = spawnSync(process.execPath, [script, 'stop'], {
      cwd: process.cwd(),
      env: { ...e, WAVE3_RUNTIME_SERVER_PORT: '3994', WAVE3_RUNTIME_CLIENT_PORT: '3995' },
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(cleaned.status).toBe(0);
    const finalState = spawnSync('ps', ['-p', String(child.pid), '-o', 'stat='], {
      encoding: 'utf8',
    }).stdout.trim();
    expect(finalState === '' || finalState.startsWith('Z')).toBe(true);
    expect(
      Number(
        (
          await admin.query('select count(*)::int n from pg_database where datname=$1', [
            `consultify_w3_runtime_${name}`,
          ])
        ).rows[0].n
      )
    ).toBe(0);
    await admin.end();
  }, 60000);
  it('SIGINT and SIGTERM serialize owned cleanup, persist proof, and preserve protected ports', async () => {
    const protectedBefore = [3940, 3941].map((port) =>
      spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
        encoding: 'utf8',
      }).stdout.trim()
    );
    const admin = new pg.Client({
      connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
    });
    await admin.connect();
    for (const [signal, expectedCode, serverPort, clientPort] of [
      ['SIGINT', 130, 4000, 4001],
      ['SIGTERM', 143, 4002, 4003],
    ] as const) {
      const name = `signal_${signal.toLowerCase()}_${process.pid}`,
        e = env(name),
        dir = e.WAVE3_RUNTIME_STATE_DIR,
        statePath = path.join(dir, 'state.json');
      artifacts.push(dir);
      const runtime = spawn(process.execPath, [script, 'start'], {
        cwd: process.cwd(),
        env: {
          ...e,
          WAVE3_RUNTIME_SERVER_PORT: String(serverPort),
          WAVE3_RUNTIME_CLIENT_PORT: String(clientPort),
        },
        stdio: 'ignore',
      });
      const deadline = Date.now() + 90000;
      let staged = false;
      while (Date.now() < deadline) {
        if (fs.existsSync(statePath)) {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          if (state.server?.pgid) {
            staged = true;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(staged).toBe(true);
      runtime.kill(signal);
      const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) =>
          runtime.once('exit', (code, receivedSignal) => resolve({ code, signal: receivedSignal }))
      );
      expect(exit).toEqual({ code: expectedCode, signal: null });
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      expect(state.cleanupProof?.processGroupsVerifiedTerminated).toBe(true);
      expect(state.stage).toBe('PROCESSES_TERMINATED');
      for (const proc of [state.server, state.client].filter(Boolean)) {
        const liveMembers = spawnSync('pgrep', ['-g', String(proc.pgid)], {
          encoding: 'utf8',
        })
          .stdout.split('\n')
          .filter(Boolean)
          .filter((pid) => {
            const stat = spawnSync('ps', ['-p', pid, '-o', 'stat='], {
              encoding: 'utf8',
            }).stdout.trim();
            return stat && !stat.startsWith('Z');
          });
        expect(liveMembers).toEqual([]);
      }
      for (const port of [serverPort, clientPort])
        expect(
          spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
            encoding: 'utf8',
          }).stdout.trim()
        ).toBe('');
      expect(
        Number(
          (
            await admin.query('select count(*)::int n from pg_database where datname=$1', [
              `consultify_w3_runtime_${name}`,
            ])
          ).rows[0].n
        )
      ).toBe(0);
    }
    await admin.end();
    expect(
      [3940, 3941].map((port) =>
        spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
          encoding: 'utf8',
        }).stdout.trim()
      )
    ).toEqual(protectedBefore);
  }, 180000);
  it('signals during DB ownership and a failing DB stage still await shared cleanup', async () => {
    const protectedBefore = [3940, 3941].map((port) =>
      spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
        encoding: 'utf8',
      }).stdout.trim()
    );
    const admin = new pg.Client({
      connectionString: 'postgresql://consultinity:consultinity@127.0.0.1:34940/postgres',
    });
    await admin.connect();
    for (const [suffix, signal, expectedCode, shouldFail, serverPort, clientPort] of [
      ['pre_server', 'SIGINT', 130, false, 4004, 4005],
      ['failing_stage', 'SIGTERM', 143, true, 4006, 4007],
    ] as const) {
      const name = `early_${suffix}_${process.pid}`,
        e = env(name),
        dir = e.WAVE3_RUNTIME_STATE_DIR,
        statePath = path.join(dir, 'state.json');
      artifacts.push(dir);
      const runtime = spawn(process.execPath, [script, 'start'], {
        cwd: process.cwd(),
        env: {
          ...e,
          WAVE3_RUNTIME_SERVER_PORT: String(serverPort),
          WAVE3_RUNTIME_CLIENT_PORT: String(clientPort),
          WAVE3_RUNTIME_TEST_DB_STAGE_DELAY_MS: '2000',
          WAVE3_RUNTIME_TEST_DB_STAGE_FAIL: shouldFail ? '1' : '0',
        },
        stdio: 'ignore',
      });
      const deadline = Date.now() + 30000;
      let databaseObserved = false;
      while (Date.now() < deadline) {
        databaseObserved =
          Number(
            (
              await admin.query('select count(*)::int n from pg_database where datname=$1', [
                `consultify_w3_runtime_${name}`,
              ])
            ).rows[0].n
          ) === 1;
        if (databaseObserved) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(databaseObserved).toBe(true);
      runtime.kill(signal);
      const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) =>
          runtime.once('exit', (code, receivedSignal) => resolve({ code, signal: receivedSignal }))
      );
      expect(exit).toEqual({ code: expectedCode, signal: null });
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      expect(state.cleanupProof?.processGroupsVerifiedTerminated).toBe(true);
      expect(state.stage).toBe('PROCESSES_TERMINATED');
      expect(state.server).toBeNull();
      expect(state.client).toBeNull();
      expect(
        Number(
          (
            await admin.query('select count(*)::int n from pg_database where datname=$1', [
              `consultify_w3_runtime_${name}`,
            ])
          ).rows[0].n
        )
      ).toBe(0);
      for (const port of [serverPort, clientPort])
        expect(
          spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
            encoding: 'utf8',
          }).stdout.trim()
        ).toBe('');
    }
    await admin.end();
    expect(
      [3940, 3941].map((port) =>
        spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
          encoding: 'utf8',
        }).stdout.trim()
      )
    ).toEqual(protectedBefore);
  }, 90000);
});
