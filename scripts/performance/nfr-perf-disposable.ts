#!/usr/bin/env npx tsx
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { chromium, devices } from 'playwright';

import { createFreshDatabase, dropDatabase, runMigrations, withDatabase } from '../../server/src/services/caseWorkspace/__tests__/performance/lib/dbLifecycle.js';

const adminUrl = process.env.NFR_PERF_ADMIN_DATABASE_URL || '';
const evidenceDir = process.env.NFR_PERF_EVIDENCE_DIR || '';
const productSha = process.env.NFR_PERF_PRODUCT_SHA || '';
const durationMs = Number(process.env.NFR_PERF_DURATION_MS || 30 * 60_000);
const release = process.env.NFR_PERF_RELEASE_GATE === '1';
const dbName = `cwperfprofile_nfr_${Date.now()}_${randomUUID().slice(0, 6)}`.toLowerCase();
const databaseUrl = withDatabase(adminUrl, dbName);

function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function runGate(env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(path.resolve('node_modules/.bin/tsx'), [path.resolve('scripts/performance/nfr-perf-mounted-gate.ts')], { cwd: process.cwd(), env, stdio: 'inherit' });
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function jsonCall(baseUrl: string, token: string, method: string, route: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${route}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  const value = text ? JSON.parse(text) : {};
  if (response.status < 200 || response.status >= 300) throw new Error(`${method} ${route} fixture failed ${response.status}: ${text.slice(0, 500)}`);
  return value;
}

async function captureColdVitals(baseUrl: string, token: string, sha: string) {
  const browser = await chromium.launch({ headless: true });
  const samples: Array<{ productSha: string; device: 'desktop' | 'mobile'; cold: true; route: string; LCP: number; CLS: number; INP: number }> = [];
  const routes = ['/my-work', '/settings', '/initiatives', '/finance', '/zlecenia'];
  const extraMyWorkSamples = Math.max(0, Number(process.env.NFR_PERF_EXTRA_MY_WORK_COLD_SAMPLES || 0));
  const routeBatch = [...routes, ...Array.from({ length: extraMyWorkSamples }, () => '/my-work')];
  try {
    for (const device of ['desktop', 'mobile'] as const) {
      for (const route of routeBatch) {
        let measured: { LCP: number; CLS: number; INP: number } | undefined;
        for (let attempt = 1; attempt <= 3; attempt++) {
        const context = await browser.newContext(device === 'mobile' ? devices['Pixel 7'] : { viewport: { width: 1440, height: 900 } });
        await context.addInitScript(({ authToken }) => {
          localStorage.setItem('token', authToken);
          localStorage.setItem('authToken', authToken);
          (window as any).__nfrVitals = { LCP: 0, CLS: 0, INP: 0 };
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) (window as any).__nfrVitals.LCP = Math.max((window as any).__nfrVitals.LCP, entry.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
          new PerformanceObserver((list) => { for (const entry of list.getEntries() as any) if (!entry.hadRecentInput) (window as any).__nfrVitals.CLS += entry.value; }).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver((list) => { for (const entry of list.getEntries() as any) (window as any).__nfrVitals.INP = Math.max((window as any).__nfrVitals.INP, entry.duration || 0); }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
        }, { authToken: token });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 60_000 });
        // LCP collection ends on the first user interaction. Allow the SPA to
        // hydrate and paint its route before generating the interaction used
        // for INP, otherwise slower routes can truthfully have no LCP entry.
        await page.waitForTimeout(2500);
        const beforeInteraction = await page.evaluate(() => {
          const observed = (window as any).__nfrVitals as { LCP: number; CLS: number; INP: number };
          const bufferedLcp = performance.getEntriesByType('largest-contentful-paint').reduce((max, entry) => Math.max(max, entry.startTime), 0);
          return { ...observed, LCP: Math.max(observed.LCP, bufferedLcp) };
        });
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        measured = await page.evaluate(() => {
          const observed = (window as any).__nfrVitals as { LCP: number; CLS: number; INP: number };
          const bufferedLcp = performance.getEntriesByType('largest-contentful-paint').reduce((max, entry) => Math.max(max, entry.startTime), 0);
          return { ...observed, LCP: Math.max(observed.LCP, bufferedLcp) };
        });
        measured = { ...measured, LCP: Math.max(beforeInteraction.LCP, measured.LCP), CLS: Math.max(beforeInteraction.CLS, measured.CLS) };
        await context.close();
        if (measured.LCP > 0) break;
        }
        samples.push({ productSha: sha, device, cold: true, route, LCP: measured?.LCP || -1, CLS: measured?.CLS || 0, INP: measured?.INP || 16 });
      }
    }
  } finally { await browser.close(); }
  return samples;
}

async function main() {
  if (!adminUrl.startsWith('postgres')) throw new Error('NFR_PERF_ADMIN_DATABASE_URL required');
  if (!evidenceDir) throw new Error('NFR_PERF_EVIDENCE_DIR required');
  if (!/^[0-9a-f]{40}$/.test(productSha)) throw new Error('NFR_PERF_PRODUCT_SHA exact 40-hex required');
  fs.mkdirSync(evidenceDir, { recursive: true });
  await createFreshDatabase(adminUrl, dbName);
  let server: http.Server | undefined;
  try {
    const migration = await runMigrations(process.cwd(), databaseUrl);
    atomicJson(path.join(evidenceDir, 'migration.json'), { database: dbName, ok: migration.ok, exitCode: migration.exitCode, durationMs: migration.durationMs, stderrTail: migration.stderr.slice(-3000) });
    if (!migration.ok) throw new Error(`fresh migration failed: ${migration.stderr.slice(-1000)}`);
    process.env.DATABASE_URL = databaseUrl;
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    process.env.RUN_DB_TESTS = '1';
    process.env.NODE_ENV = 'test';
    process.env.GIT_SHA = productSha;

    const [{ default: config }, auth, v8Auth, cases, myWork, settings, initiatives, roi, errors] = await Promise.all([
      import('../../server/src/config/Config.js'),
      import('../../server/src/middleware/auth.middleware.js'),
      import('../../server/src/middleware/v8Auth.middleware.js'),
      import('../../server/src/routes/caseWorkspace/cases.routes.js'),
      import('../../server/src/routes/my-work.routes.js'),
      import('../../server/src/routes/settings.routes.js'),
      import('../../server/src/routes/pmo/initiatives.routes.js'),
      import('../../server/src/routes/resultsVnext/roi.routes.js'),
      import('../../server/src/utils/ErrorHandler.js'),
    ]);
    const pool = new Pool({ connectionString: databaseUrl, max: 8 });
    const tag = randomUUID();
    const org = `nfr-org-${tag}`, foreignOrg = `nfr-foreign-${tag}`, project = `nfr-project-${tag}`;
    const users = Array.from({ length: 50 }, (_, i) => `nfr-user-${i}-${tag}`);
    const foreignUser = `nfr-foreign-user-${tag}`;
    const settingsTarget = `nfr-settings-target-${tag}`;
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$1,'enterprise','active'),($2,$2,'enterprise','active')`, [org, foreignOrg]);
    await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [project, org]);
    for (const user of [...users, settingsTarget, foreignUser]) {
      const ownerOrg = user === foreignUser ? foreignOrg : org;
      await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'ADMIN','active')`, [user, ownerOrg, `${user}@example.test`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [`membership-${user}`, ownerOrg, user]);
    }
    const visibility = await import('../../server/src/services/resultsVnext/platform/visibilityResolver.js');
    await visibility.publishRoiGovernedVisibilityPolicy({ organizationId: org, actorUserId: users[0], policyKey: visibility.ROI_GOVERNED_VISIBILITY_POLICY.key, policyDigest: visibility.ROI_GOVERNED_VISIBILITY_POLICY.digest, idempotencyKey: `nfr-visibility-${tag}` });
    const sign = (id: string, organizationId: string) => jwt.sign({ id, organizationId, role: 'OWNER', email: `${id}@example.test` }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '45m' });
    const tokens = users.map((id) => sign(id, org));
    const foreignToken = sign(foreignUser, foreignOrg);

    const app = express();
    app.use(express.json());
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', gitSha: productSha }));
    const signed = [auth.default, auth.validateOrgMembership];
    app.use('/api/v8/case-workspace', ...signed, v8Auth.requireV8OrgContext, v8Auth.attachV8Context, cases.default);
    app.use('/api/my-work', ...signed, myWork.default);
    app.use('/api/settings', ...signed, settings.default);
    app.use('/api/initiatives', ...signed, initiatives.default);
    app.use('/api/vnext/results/roi', ...signed, roi.default);
    app.use(errors.errorHandlerMiddleware);
    if (!fs.existsSync(path.resolve('dist/index.html'))) throw new Error('dist/index.html required; run npm run build before disposable gate');
    app.use(express.static(path.resolve('dist')));
    app.use((req, res, next) => req.method === 'GET' && req.accepts('html') ? res.sendFile(path.resolve('dist/index.html')) : next());
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('listener unavailable');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const ownerToken = tokens[0];
    const caseBody = await jsonCall(baseUrl, ownerToken, 'POST', '/api/v8/case-workspace/cases', { projectId: project, caseName: `NFR Case ${tag}`, contractedClosureType: 'DELIVERY_COMPLETED' });
    const caseId = String(caseBody.data.caseId);
    const initiativeBody = await jsonCall(baseUrl, ownerToken, 'POST', '/api/initiatives', { projectId: project, name: `NFR Initiative ${tag}`, title: `NFR Initiative ${tag}`, status: 'DRAFT', sourceType: 'manual' });
    const initiativeId = String(initiativeBody.id || initiativeBody.data?.id);
    const roiBody = await jsonCall(baseUrl, ownerToken, 'POST', '/api/vnext/results/roi/cases', { initiativeId, ownerUserId: users[0], title: `NFR ROI ${tag}`, currency: 'USD', idempotencyKey: `roi-${tag}` });
    const roiCaseId = String(roiBody.roiCase?.caseId || roiBody.case?.caseId || roiBody.caseId);
    const taskBody = await jsonCall(baseUrl, ownerToken, 'POST', '/api/my-work/personal-tasks', { title: `NFR tenant target ${tag}`, idempotencyKey: `target-task-${tag}` });
    const taskId = String(taskBody.id || taskBody.task?.id);
    const settingsMarker = `marker-${tag}`;
    await jsonCall(baseUrl, sign(settingsTarget, org), 'PUT', '/api/settings/preferences/notifications', { preferences: { email: true, push: true, inApp: true, digest: 'daily', nfrMarker: settingsMarker } });
    if (![caseId, initiativeId, roiCaseId, taskId].every((id) => id && id !== 'undefined')) throw new Error('fixture IDs missing');

    const example = JSON.parse(fs.readFileSync(path.resolve('scripts/performance/nfr-perf-profile.example.json'), 'utf8'));
    const profile = { ...example, productSha, baseUrl, variables: { ...example.variables, CASE_ID: caseId, PRIMARY_ORG_ID: org, PRIMARY_TASK_ID: taskId, PRIMARY_INITIATIVE_ID: initiativeId, PRIMARY_ROI_CASE_ID: roiCaseId, TARGET_SETTINGS_USER_ID: settingsTarget, PRIMARY_SETTINGS_MARKER: settingsMarker } };
    const privateDir = path.join(evidenceDir, '.private');
    fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
    const profilePath = path.join(privateDir, 'profile.json'), tokensPath = path.join(privateDir, 'tokens.json');
    atomicJson(profilePath, profile);
    atomicJson(tokensPath, { primary: tokens, foreign: foreignToken });
    let vitalsPath = process.env.NFR_PERF_WEB_VITALS || '';
    if (!vitalsPath) {
      vitalsPath = path.join(evidenceDir, 'web-vitals.json');
      atomicJson(vitalsPath, await captureColdVitals(baseUrl, ownerToken, productSha));
    }
    if (!fs.existsSync(vitalsPath)) throw new Error('NFR_PERF_WEB_VITALS real cold browser batch required');
    const exitCode = await runGate({ ...process.env, NFR_PERF_PROFILE: profilePath, NFR_PERF_TOKENS: tokensPath, NFR_PERF_WEB_VITALS: vitalsPath, NFR_PERF_EVIDENCE_DIR: evidenceDir, NFR_PERF_DURATION_MS: String(durationMs), NFR_PERF_USERS: '50', NFR_PERF_RELEASE_GATE: release ? '1' : '0' });
    fs.rmSync(privateDir, { recursive: true, force: true });
    await pool.end();
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await dropDatabase(adminUrl, dbName);
  }
}

main().then(() => process.exit(process.exitCode || 0)).catch((error) => { console.error('[NFR-PERF-DISPOSABLE]', error); process.exit(1); });
