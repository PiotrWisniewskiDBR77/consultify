/**
 * OPS-DEMO-003 — the public health surface must not fork processes, and must not
 * disclose internals.
 *
 * `HealthCheckController` used to fall back to `execSync('git rev-parse …')`
 * whenever the deploy env vars were absent, on an UNAUTHENTICATED endpoint. Two
 * synchronous forks per anonymous request is a remote event-loop-exhaustion
 * vector, and the branch name it published is internal information.
 *
 * The suite runs against the REAL Express app (`server/src/index`), so the
 * assertions cover the real middleware chain and the real route wiring
 * (`app.get('/ping')` in index.ts + `app.use('/api/health', healthRoutes)`),
 * not a hand-built router that could diverge from production.
 *
 * The `child_process` spies wrap the REAL implementations (pass-through), so the
 * counters observe genuine fork attempts rather than suppressing them — that is
 * what makes the negative control (restore the old controller ⇒ this suite goes
 * red) meaningful.
 */
import path from 'path';
import fs from 'fs';

import request from 'supertest';
import express from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/** Fork counters, hoisted so the `vi.mock` factories below can close over them. */
const cp = vi.hoisted(() => ({
  execSync: 0,
  exec: 0,
  execFile: 0,
  execFileSync: 0,
  spawn: 0,
  spawnSync: 0,
  fork: 0,
  total(): number {
    return (
      this.execSync +
      this.exec +
      this.execFile +
      this.execFileSync +
      this.spawn +
      this.spawnSync +
      this.fork
    );
  },
  reset(): void {
    this.execSync = 0;
    this.exec = 0;
    this.execFile = 0;
    this.execFileSync = 0;
    this.spawn = 0;
    this.spawnSync = 0;
    this.fork = 0;
  },
}));

vi.hoisted(() => {
  // Reproduce the vulnerable condition: the git metadata env vars are ABSENT, so
  // the old implementation reaches its `execSync` fallback. If any of these leaks
  // in from CI (GITHUB_SHA on GitHub Actions) the old code short-circuits on env
  // and the negative control would pass for the wrong reason.
  for (const key of [
    'RAILWAY_GIT_COMMIT_SHA',
    'GITHUB_SHA',
    'GIT_SHA',
    'RAILWAY_GIT_BRANCH',
    'GITHUB_REF_NAME',
    'GIT_BRANCH',
  ]) {
    delete process.env[key];
  }

  // Hermetic: NODE_ENV=test with MOCK_DB left unset makes `getDatabase()` hand
  // back the in-process mock, and MOCK_REDIS short-circuits the redis probe.
  // Nothing here may open a socket to a real Postgres — the endpoint under test
  // is about forks and disclosure, not about database behaviour.
  process.env.NODE_ENV = 'test';
  process.env.MOCK_REDIS = 'true';
  delete process.env.MOCK_DB;
  delete process.env.RUN_DB_TESTS;
});

// `vi.mock` calls are hoisted above every const, so the shared factory has to be
// hoisted too — otherwise it is still in its temporal dead zone when the mock runs.
const childProcessMockFactory = vi.hoisted(() => async (): Promise<Record<string, unknown>> => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  const counters = cp as unknown as Record<string, number>;
  const count =
    (name: keyof typeof import('node:child_process'), key: string) =>
    (...args: unknown[]) => {
      counters[key] = counters[key] + 1;
      return (actual[name] as unknown as (...a: unknown[]) => unknown)(...args);
    };

  const wrapped = {
    ...actual,
    execSync: count('execSync', 'execSync'),
    exec: count('exec', 'exec'),
    execFile: count('execFile', 'execFile'),
    execFileSync: count('execFileSync', 'execFileSync'),
    spawn: count('spawn', 'spawn'),
    spawnSync: count('spawnSync', 'spawnSync'),
    fork: count('fork', 'fork'),
  };

  return { ...wrapped, default: wrapped };
});

vi.mock('node:child_process', childProcessMockFactory);
vi.mock('child_process', childProcessMockFactory);

import app from '../../../server/src/index';

/** Resolve the checked-out branch WITHOUT forking (reads .git, worktree-aware). */
function currentBranchName(): string | undefined {
  try {
    const repoRoot = path.resolve(__dirname, '../../..');
    const dotGit = path.join(repoRoot, '.git');
    const stat = fs.statSync(dotGit);
    let gitDir = dotGit;
    if (stat.isFile()) {
      const pointer = fs.readFileSync(dotGit, 'utf8').trim();
      const match = /^gitdir:\s*(.+)$/.exec(pointer);
      if (!match) return undefined;
      gitDir = path.resolve(repoRoot, match[1]);
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    return ref ? ref[1] : undefined;
  } catch {
    return undefined;
  }
}

describe('public health surface: no child processes, no internals disclosed', () => {
  const branch = currentBranchName();

  beforeAll(() => {
    // Module-load side effects of importing the whole app (if any process ever
    // forks at import time) must not be attributed to a request.
    cp.reset();
  });

  beforeEach(() => {
    cp.reset();
  });

  it('the spies are wired to the module the controller would import', async () => {
    // Guard against a silently inert spy: if this fails, every "zero forks"
    // assertion below is vacuous and the negative control cannot be trusted.
    const mocked = await import('node:child_process');
    expect(cp.total()).toBe(0);
    mocked.execSync('exit 0', { stdio: 'ignore' });
    expect(cp.execSync).toBe(1);
    cp.reset();
  });

  it('GET /ping returns pong and forks nothing', async () => {
    const res = await request(app).get('/ping');

    expect(res.status).toBe(200);
    expect(res.text).toBe('pong');
    expect(cp.total()).toBe(0);
  });

  it('GET /api/health forks nothing (this is the endpoint that reached execSync)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBeTruthy();
    expect(cp.execSync).toBe(0);
    expect(cp.total()).toBe(0);
  });

  it('20 concurrent anonymous requests trigger zero child-process invocations', async () => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => request(app).get('/api/health'))
    );

    expect(responses).toHaveLength(20);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    // The DoS property: request volume must not translate into fork volume.
    expect(cp.execSync).toBe(0);
    expect(cp.total()).toBe(0);
  });

  it('the public body discloses no branch name and no filesystem path', async () => {
    const res = await request(app).get('/api/health');
    const body = JSON.stringify(res.body);

    expect(res.body).not.toHaveProperty('gitBranch');
    expect(res.body).not.toHaveProperty('gitSource');

    if (branch) {
      expect(body).not.toContain(branch);
    }

    // Compare against the real runtime values, not a hardcoded string.
    for (const p of [__dirname, process.cwd(), path.resolve(__dirname, '../../..')]) {
      expect(body).not.toContain(p);
    }
    // No path-shaped value at all (an absolute POSIX path or a Windows drive path).
    expect(body).not.toMatch(/(^|["\s])\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+/);
    expect(body).not.toMatch(/[A-Za-z]:\\\\/);
  });

  it('the git metadata is resolved at most once, not per request', async () => {
    // The controller resolves PUBLIC_GIT_SHA once at module load, so repeated
    // requests must be byte-stable on that field and must never do work for it.
    const first = await request(app).get('/api/health');
    const many = await Promise.all(
      Array.from({ length: 25 }, () => request(app).get('/api/health'))
    );

    for (const res of many) {
      expect(res.body.gitSha).toEqual(first.body.gitSha);
    }
    expect(cp.total()).toBe(0);
  });

  it('publishes gitSha from the deploy env, and still hides the branch when the branch env IS set', async () => {
    // Re-import the controller in a fresh module registry with the deploy env
    // populated the way Railway populates it. This proves the surviving public
    // field (gitSha, which deploy verification curls for) still works, and that a
    // present RAILWAY_GIT_BRANCH is deliberately dropped rather than merely absent.
    const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
    const secretBranch = 'internal/unreleased-customer-name';

    vi.resetModules();
    process.env.RAILWAY_GIT_COMMIT_SHA = sha;
    process.env.RAILWAY_GIT_BRANCH = secretBranch;

    try {
      const { HealthCheckController } = await import(
        '../../../server/src/controllers/HealthCheckController'
      );
      const probe = express();
      probe.get('/api/health', (req, res) => {
        void HealthCheckController.checkHealth(req, res);
      });

      cp.reset();
      const res = await request(probe).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.gitSha).toBe(sha);
      expect(JSON.stringify(res.body)).not.toContain(secretBranch);
      expect(res.body).not.toHaveProperty('gitBranch');
      expect(cp.total()).toBe(0);
    } finally {
      delete process.env.RAILWAY_GIT_COMMIT_SHA;
      delete process.env.RAILWAY_GIT_BRANCH;
    }
  });
});
