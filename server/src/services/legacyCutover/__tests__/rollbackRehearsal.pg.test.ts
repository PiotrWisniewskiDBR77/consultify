/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T14 — rollback rehearsal for every disabled tranche.
 *
 * A rollback lever that has never been pulled is a claim, not a capability. This
 * suite pulls it, for EVERY writer currently registered as `disabled` — it is
 * driven off the registry itself, so a future tranche cannot be disabled without
 * automatically acquiring a rehearsal here.
 *
 * For each disabled writer it proves the four properties the Definition of Done
 * asks for:
 *   EXPLICIT — it refuses by default, and nothing but a named environment
 *              variable re-opens it.
 *   NARROW   — naming one writer re-opens THAT writer and no other.
 *   NON-DESTRUCTIVE — no observation recorded before the rollback is removed or
 *              altered by it; the rollback restores a route, not data.
 *   REVERSIBLE — removing the variable returns the writer to refusing, with no
 *              residual state.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import {
  createLegacyCutoverGuard,
  type LegacyCutoverDomainConfig,
} from '../legacyCutoverKernel.js';
import { CUTOVER_REGISTRY } from '../registry.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `rehearse-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const user = `${prefix}-user`;

/**
 * A concrete request path for each rule's regex. Regexes are not invertible, so
 * these are written by hand and then CHECKED against the rule below — a sample
 * that stops matching its rule fails the suite instead of silently skipping it.
 */
const SAMPLE_PATHS: Record<string, string> = {
  'FIN-W01': '/models/rehearsal-model/approve',
  'FIN-W02': '/models/rehearsal-model/approve',
  'PRT-W01': '/payouts/request',
  'PRT-W02': '/campaign-links',
  'PRT-W03': '/campaign-links/rehearsal-link',
  'PRT-W04': '/organization',
  'PRT-W05': '/organization/specializations',
  'PRT-W06': '/organization/regions',
  'PRT-W07': '/organization/listing',
  'PRT-W08': '/payout-settings',
  'PRT-W09': '/connect',
  'PRT-W10': '/clients',
  'PRT-W11': '/employees',
  'PRT-W12': '/access-links',
  'PRT-W13': '/certifications/rehearsal-cert/modules/rehearsal-module/progress',
  'PRT-W14': '/certifications/rehearsal-cert/exam/start',
  'PRT-W15': '/certifications/rehearsal-cert/exam/submit',
  'PRT-W16': '/licenses/order',
};

interface Tranche {
  configKey: string;
  config: LegacyCutoverDomainConfig;
  writerId: string;
  method: string;
  samplePath: string;
  rollbackWritersEnv: string;
}

const TRANCHES: Tranche[] = Object.entries(CUTOVER_REGISTRY).flatMap(([configKey, config]) =>
  config.writers
    // Writers whose refusal is enforced by their own domain mechanism are
    // excluded here on purpose: the kernel's lever cannot restore them, so
    // rehearsing it would prove a rollback that does not work. They are covered
    // by the separate assertion below, which requires them to name their lever.
    .filter((writer) => writer.state === 'disabled' && (writer.enforcedBy ?? 'kernel') === 'kernel')
    .map((writer) => ({
      configKey,
      config,
      writerId: writer.writerId,
      method: writer.method,
      samplePath: SAMPLE_PATHS[writer.writerId] ?? '',
      rollbackWritersEnv: config.rollbackWritersEnv,
    }))
);

describe.skipIf(!REAL_PG)('Rollback rehearsal for every disabled writer', () => {
  let pool: Pool;

  /** A minimal app that mounts ONLY the guard, so the leaf route cannot mask it. */
  function guardedApp(config: LegacyCutoverDomainConfig, mount: string): express.Express {
    const app = express();
    app.use(express.json());
    app.use((request_: any, _res, next) => {
      request_.user = { id: user, organizationId: org, role: 'ADMIN' };
      request_.userId = user;
      request_.organizationId = org;
      request_.v8Context = { organizationId: org, userId: user, userRole: 'ADMIN' };
      next();
    });
    app.use(mount, createLegacyCutoverGuard(config), (_req, res) =>
      res.status(200).json({ reachedLeaf: true })
    );
    return app;
  }

  async function rowsFor(requestId: string) {
    const result = await pool.query(
      `SELECT writer_id, access_kind FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND request_id = $2`,
      [org, requestId]
    );
    return result.rows;
  }

  function send(app: express.Express, method: string, url: string, requestId: string) {
    const agent = request(app) as any;
    return agent[method.toLowerCase()](url).set('x-request-id', requestId).send({});
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
       VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
      [org, org, new Date().toISOString()]
    );
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, {
      organizationIds: [org],
      requestIdPrefix: prefix,
    });
    for (const tranche of TRANCHES) delete process.env[tranche.rollbackWritersEnv];
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = $1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    await pool.end();
  });

  it('requires every domain-enforced disabled writer to name exactly one real authority', () => {
    const domainEnforced = Object.values(CUTOVER_REGISTRY).flatMap((config) =>
      config.writers.filter(
        (writer) => writer.state === 'disabled' && writer.enforcedBy === 'domain'
      )
    );
    for (const writer of domainEnforced) {
      const authorities = [writer.enforcedByEnv, writer.enforcedByDecision].filter(Boolean);
      expect(authorities, `${writer.writerId} must name exactly one domain authority`).toHaveLength(
        1
      );
      expect(writer.reason).toContain(String(authorities[0]));
    }
  });

  it('has at least one disabled writer to rehearse, and a sample path for each', () => {
    expect(TRANCHES.length).toBeGreaterThan(0);
    for (const tranche of TRANCHES) {
      expect(tranche.samplePath, `missing sample path for ${tranche.writerId}`).not.toBe('');
      const rule = tranche.config.writers.find((writer) => writer.writerId === tranche.writerId);
      // The sample must still match the rule it stands for, or the rehearsal
      // below would pass by never reaching the writer at all.
      expect(
        rule?.path.test(tranche.samplePath),
        `sample path no longer matches ${tranche.writerId}`
      ).toBe(true);
    }
  });

  it.each(TRANCHES.map((tranche) => [tranche.writerId, tranche] as const))(
    'rehearses %s: refuses, re-opens narrowly, keeps evidence, then refuses again',
    async (_writerId, tranche) => {
      const mount = `/mount-${tranche.writerId.toLowerCase()}`;
      const app = guardedApp(tranche.config, mount);
      const url = `${mount}${tranche.samplePath}`;

      // 1. EXPLICIT — refuses with no environment variable set.
      delete process.env[tranche.rollbackWritersEnv];
      delete process.env[tranche.config.rollbackEnv];
      const refused = await send(app, tranche.method, url, `${prefix}-${tranche.writerId}-before`);
      expect([409, 410]).toContain(refused.status);
      expect(refused.body.writerId).toBe(tranche.writerId);
      expect(refused.body.reachedLeaf).toBeUndefined();

      const beforeRows = await rowsFor(`${prefix}-${tranche.writerId}-before`);
      expect(beforeRows).toHaveLength(1);

      // 2. NARROW — naming this one writer re-opens exactly this one.
      process.env[tranche.rollbackWritersEnv] = tranche.writerId;
      try {
        const reopened = await send(
          app,
          tranche.method,
          url,
          `${prefix}-${tranche.writerId}-during`
        );
        expect(reopened.status).toBe(200);
        expect(reopened.body.reachedLeaf).toBe(true);

        const duringRows = await rowsFor(`${prefix}-${tranche.writerId}-during`);
        expect(duringRows).toEqual([
          { writer_id: tranche.writerId, access_kind: 'rollback_writer' },
        ]);

        // Every OTHER disabled writer of the same domain config stays refused
        // while this one is open.
        const neighbours = tranche.config.writers.filter(
          (writer) =>
            writer.state === 'disabled' &&
            (writer.enforcedBy ?? 'kernel') === 'kernel' &&
            writer.writerId !== tranche.writerId
        );
        for (const neighbour of neighbours) {
          const neighbourApp = guardedApp(tranche.config, mount);
          const neighbourResponse = await send(
            neighbourApp,
            neighbour.method,
            `${mount}${SAMPLE_PATHS[neighbour.writerId]}`,
            `${prefix}-${tranche.writerId}-neighbour-${neighbour.writerId}`
          );
          expect(
            [409, 410],
            `${neighbour.writerId} must stay refused while ${tranche.writerId} is rolled back`
          ).toContain(neighbourResponse.status);
        }
      } finally {
        delete process.env[tranche.rollbackWritersEnv];
      }

      // 3. NON-DESTRUCTIVE — the observation taken before the rollback is intact.
      expect(await rowsFor(`${prefix}-${tranche.writerId}-before`)).toEqual(beforeRows);

      // 4. REVERSIBLE — removing the variable returns it to refusing.
      const refusedAgain = await send(
        app,
        tranche.method,
        url,
        `${prefix}-${tranche.writerId}-after`
      );
      expect([409, 410]).toContain(refusedAgain.status);
      expect(refusedAgain.body.reachedLeaf).toBeUndefined();
    }
  );

  it('does not re-open a writer merely because another writer id is named', async () => {
    const tranche = TRANCHES[0];
    const mount = '/mount-unrelated';
    const app = guardedApp(tranche.config, mount);
    process.env[tranche.rollbackWritersEnv] = 'SOME-OTHER-WRITER-ID';
    try {
      const response = await send(
        app,
        tranche.method,
        `${mount}${tranche.samplePath}`,
        `${prefix}-unrelated`
      );
      expect([409, 410]).toContain(response.status);
    } finally {
      delete process.env[tranche.rollbackWritersEnv];
    }
  });
});
