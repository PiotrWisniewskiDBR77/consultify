/**
 * NFR-PERF-001 mounted steady-load runner.
 *
 * Release invocation must set NFR_PERF_RELEASE_GATE=1; that mode refuses
 * anything below 30 minutes or fewer than 50 signed-JWT users. The artifact
 * is rewritten atomically throughout the run, so a killed process leaves a
 * restart-safe partial checkpoint instead of no evidence.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

import { apiGateway } from '../../../../Gateway.js';
import config from '../../../../config/Config.js';
import verifyToken, { validateOrgMembership } from '../../../../middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../../../middleware/v8Auth.middleware.js';
import casesRoutes from '../../../../routes/caseWorkspace/cases.routes.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import {
  evaluateSteadyLoadGate,
  NFR_PERF_WORKLOADS,
  type NfrPerfWorkload,
  type WorkloadGateInput,
} from './lib/steadyLoadGate.js';

const databaseUrl = process.env.DATABASE_URL || '';
const durationMs = Number(process.env.NFR_PERF_DURATION_MS || 60_000);
const userCount = Number(process.env.NFR_PERF_USERS || 50);
const releaseGate = process.env.NFR_PERF_RELEASE_GATE === '1';
const artifactPath = process.env.NFR_PERF_ARTIFACT || '/tmp/nfr-perf-steady-load.json';
const requestIntervalMs = Number(process.env.NFR_PERF_REQUEST_INTERVAL_MS || 1000);
const writeEvery = Number(process.env.NFR_PERF_WRITE_EVERY || 25);
const sampleEveryMs = Number(process.env.NFR_PERF_HEAP_SAMPLE_MS || 10_000);

type Checkpoint = Record<string, unknown>;

function assertConfiguration(): void {
  if (!databaseUrl.startsWith('postgres')) throw new Error('DATABASE_URL real PostgreSQL required');
  if (process.env.RUN_DB_TESTS !== '1' || process.env.MOCK_DB !== 'false') {
    throw new Error('RUN_DB_TESTS=1 and MOCK_DB=false required');
  }
  if (releaseGate && (durationMs < 30 * 60_000 || userCount < 50)) {
    throw new Error('release gate requires >=30 minutes and >=50 authenticated users');
  }
  if (
    ![durationMs, userCount, requestIntervalMs, writeEvery, sampleEveryMs].every(
      (n) => Number.isFinite(n) && n > 0
    )
  ) {
    throw new Error('positive finite load configuration required');
  }
}

function atomicCheckpoint(value: Checkpoint): void {
  const temporary = `${artifactPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, artifactPath);
}

function extendCheckpoint(value: Checkpoint): void {
  let previous: Checkpoint = {};
  try {
    previous = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Checkpoint;
  } catch {
    // The first checkpoint may not exist yet; atomicCheckpoint remains authoritative.
  }
  atomicCheckpoint({ ...previous, ...value });
}

function heapMb(): number {
  return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  assertConfiguration();
  const tag = randomUUID();
  const org = `nfr-perf-${tag}`;
  const foreignOrg = `nfr-perf-foreign-${tag}`;
  const project = `nfr-perf-project-${tag}`;
  const users = Array.from({ length: userCount }, (_, index) => `nfr-perf-user-${index}-${tag}`);
  const foreignUser = `nfr-perf-foreign-user-${tag}`;
  const pool = new Pool({ connectionString: databaseUrl, max: 12 });
  const readLatencyMs: number[] = [];
  const writeLatencyMs: number[] = [];
  const workloads = NFR_PERF_WORKLOADS.reduce(
    (result, name) => {
      result[name] = { latencyMs: [], totalRequests: 0, errors: 0 };
      return result;
    },
    {} as Record<NfrPerfWorkload, WorkloadGateInput>
  );
  const expectedWriteIds: string[] = [];
  const heapSamples: Array<{ atMs: number; heapMb: number }> = [];
  let totalRequests = 0;
  let errors = 0;
  let crossTenantAttempts = 0;
  let crossTenantFalseSuccesses = 0;
  const baselineCaseIds: string[] = [];
  let server: http.Server | undefined;
  const startedAt = Date.now();
  const endAt = startedAt + durationMs;
  const warmAt = startedAt + Math.min(5 * 60_000, Math.max(10_000, durationMs * 0.2));
  let warmHeapMb = 0;

  try {
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [org, foreignOrg]);
    await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      project,
      org,
    ]);
    for (const user of [...users, foreignUser]) {
      const userOrg = user === foreignUser ? foreignOrg : org;
      await pool.query(
        `INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'ADMIN','active')`,
        [user, userOrg, `${user}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
        [`membership-${user}`, userOrg, user]
      );
    }

    const sign = (userId: string, organizationId: string) =>
      jwt.sign(
        { id: userId, organizationId, role: 'ADMIN', email: `${userId}@example.test` },
        config.JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '45m',
        }
      );
    const tokens = users.map((user) => sign(user, org));
    const foreignToken = sign(foreignUser, foreignOrg);

    const app = express();
    app.use(express.json());
    app.use(verifyToken);
    app.use(validateOrgMembership);
    app.use(requireV8OrgContext);
    app.use(attachV8Context);
    app.use('/api/v8/case-workspace', casesRoutes);
    apiGateway.initializeRoutes(app);
    app.use(errorHandlerMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('ephemeral HTTP listener unavailable');
    const origin = `http://127.0.0.1:${address.port}`;
    const caseBase = `${origin}/api/v8/case-workspace`;

    const requestJson = async (token: string, path: string, init?: RequestInit) => {
      const started = performance.now();
      const response = await fetch(
        path.startsWith('/api/') ? `${origin}${path}` : `${caseBase}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
          },
        }
      );
      const latency = performance.now() - started;
      return { response, latency };
    };

    for (let index = 0; index < tokens.length; index += 1) {
      const baseline = await requestJson(tokens[index]!, '/cases', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project,
          caseName: `NFR baseline ${index} ${tag}`,
          contractedClosureType: 'DELIVERY_COMPLETED',
        }),
      });
      if (baseline.response.status !== 201) {
        throw new Error(`baseline create ${index} failed ${baseline.response.status}`);
      }
      const baselineCaseId = String(((await baseline.response.json()) as any).data.caseId);
      baselineCaseIds.push(baselineCaseId);
      expectedWriteIds.push(baselineCaseId);
    }

    const heapTimer = setInterval(() => {
      if (typeof global.gc === 'function') global.gc();
      const sample = { atMs: Date.now() - startedAt, heapMb: heapMb() };
      heapSamples.push(sample);
      if (!warmHeapMb && Date.now() >= warmAt) warmHeapMb = sample.heapMb;
      atomicCheckpoint({
        status: 'RUNNING',
        startedAt: new Date(startedAt).toISOString(),
        durationMs,
        userCount,
        totalRequests,
        errors,
        crossTenantAttempts,
        crossTenantFalseSuccesses,
        heapSamples,
      });
    }, sampleEveryMs);

    const worker = async (index: number) => {
      let operation = 0;
      while (Date.now() < endAt) {
        const loopAt = Date.now();
        operation += 1;
        const isWrite = operation % writeEvery === 0;
        const workload: NfrPerfWorkload = isWrite
          ? 'case'
          : NFR_PERF_WORKLOADS[(index + operation) % NFR_PERF_WORKLOADS.length]!;
        try {
          const result = isWrite
            ? await requestJson(tokens[index], '/cases', {
                method: 'POST',
                body: JSON.stringify({
                  projectId: project,
                  caseName: `NFR ${index}-${operation}-${tag}`,
                  contractedClosureType: 'DELIVERY_COMPLETED',
                }),
              })
            : await requestJson(
                tokens[index],
                workload === 'case'
                  ? `/cases/${baselineCaseIds[index]}`
                  : workload === 'my_work'
                    ? `/api/my-work/my-ideas?limit=20`
                    : workload === 'settings'
                      ? `/api/settings/preferences/regional`
                      : workload === 'initiatives'
                        ? `/api/initiatives`
                        : `/api/economics/stats`
              );
          totalRequests += 1;
          apiLatencyMs.push(result.latency);
          workloads[workload].totalRequests += 1;
          workloads[workload].latencyMs.push(result.latency);
          if (isWrite) writeLatencyMs.push(result.latency);
          if (result.response.status < 200 || result.response.status >= 300) {
            errors += 1;
            workloads[workload].errors += 1;
          }
          if (isWrite && result.response.status === 201) {
            const payload = (await result.response.json()) as { data?: { caseId?: string } };
            const id = String(payload.data?.caseId || '');
            if (!id) throw new Error('case write returned no caseId');
            expectedWriteIds.push(id);
          } else {
            await result.response.arrayBuffer();
          }
        } catch {
          totalRequests += 1;
          errors += 1;
          workloads[workload].errors += 1;
        }
        await sleep(Math.max(0, requestIntervalMs - (Date.now() - loopAt)));
      }
    };

    const negativeWorker = async () => {
      while (Date.now() < endAt) {
        try {
          const result = await requestJson(foreignToken, `/cases/${baselineCaseIds[0]}`);
          crossTenantAttempts += 1;
          if (result.response.status !== 404) crossTenantFalseSuccesses += 1;
          await result.response.arrayBuffer();
        } catch {
          crossTenantAttempts += 1;
          errors += 1;
        }
        await sleep(requestIntervalMs);
      }
    };

    await Promise.all([...tokens.map((_, index) => worker(index)), negativeWorker()]);
    clearInterval(heapTimer);
    if (typeof global.gc === 'function') global.gc();
    const finalHeapMb = heapMb();
    if (!warmHeapMb) warmHeapMb = heapSamples[0]?.heapMb || finalHeapMb;
    const lastTenMinuteHeapMb = heapSamples
      .filter((sample) => sample.atMs >= Math.max(0, durationMs - 10 * 60_000))
      .map((sample) => sample.heapMb);
    const persistedWrites = expectedWriteIds.length
      ? await pool.query<{ id: string }>(
          `SELECT case_id AS id FROM case_core
           WHERE organization_id=$1 AND case_id = ANY($2::text[]) ORDER BY case_id`,
          [org, expectedWriteIds]
        )
      : { rows: [] as Array<{ id: string }> };
    const gate = evaluateSteadyLoadGate({
      apiLatencyMs,
      writeLatencyMs,
      totalRequests,
      errors,
      crossTenantFalseSuccesses,
      heapWarmMb: warmHeapMb,
      heapFinalMb: finalHeapMb,
      lastTenMinuteHeapMb,
      workloads,
      expectedWriteIds,
      persistedWriteIds: persistedWrites.rows.map((row) => row.id),
    });
    const positiveControl = evaluateSteadyLoadGate({
      apiLatencyMs: [2000, 2500],
      writeLatencyMs: [1300, 1600],
      totalRequests: 100,
      errors: 2,
      crossTenantFalseSuccesses: 1,
      heapWarmMb: 100,
      heapFinalMb: 125,
      lastTenMinuteHeapMb: [100, 110, 120],
    });
    if (positiveControl.pass) throw new Error('positive control failed to breach the gate');
    atomicCheckpoint({
      status: gate.pass ? 'PASS' : 'FAIL',
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMsRequested: durationMs,
      durationMsActual: Date.now() - startedAt,
      userCount,
      totalRequests,
      errors,
      crossTenantAttempts,
      crossTenantFalseSuccesses,
      warmHeapMb,
      finalHeapMb,
      heapSamples,
      workloads,
      gate,
      positiveControlDetected: !positiveControl.pass,
      productSha: process.env.NFR_PERF_PRODUCT_SHA || 'WORKTREE',
    });
    if (!gate.pass) process.exitCode = 1;
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await pool.query('BEGIN').catch(() => undefined);
    try {
      // The outbox is deliberately append-only and has no FK to organizations:
      // immutable performance evidence survives while every mutable fixture is removed.
      await pool.query(`DELETE FROM case_core WHERE organization_id = ANY($1)`, [
        [org, foreignOrg],
      ]);
      await pool.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [org, foreignOrg],
      ]);
      await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[org, foreignOrg]]);
      await pool.query('COMMIT');
      const immutableResidue = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_workspace_event_outbox WHERE organization_id = ANY($1)`,
        [[org, foreignOrg]]
      );
      extendCheckpoint({
        cleanup: {
          immutableOutboxRowsPreserved: immutableResidue.rows[0]?.n || 0,
          mutableFixtureRowsRemoved: true,
          completedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      await pool.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await pool.end();
    }
  }
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((error) => {
    atomicCheckpoint({
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    });
    console.error('[NFR-PERF-001]', error);
    process.exit(1);
  });
