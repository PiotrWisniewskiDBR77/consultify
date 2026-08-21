/** @vitest-environment node */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
const script = path.resolve(process.cwd(), 'scripts/dev/start-wave3-owner-runtime.mjs'),
  artifacts: string[] = [];
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
  return spawnSync(process.execPath, [script, command], {
    cwd: process.cwd(),
    env: { ...env(), ...overrides },
    encoding: 'utf8',
    timeout: 30000,
  });
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
    expect(s).toMatch(/hj\.gitSha\s*!==\s*c\.sha/);
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
