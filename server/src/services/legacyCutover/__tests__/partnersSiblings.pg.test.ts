/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T4 — the Partner routers the cutover never saw.
 *
 * `partners.routes.ts` exports four routers. `partnerLegacyCutoverGuard` was
 * applied to one (partners.routes.ts:229), so writes on the public router and on
 * the two superadmin routers — settlement approval, payout processing,
 * commission rates — have been invisible to the Partner cutover since it began.
 *
 * These tests pin the generic-kernel side of the contract. W18-W27 are
 * domain-enforced disabled writers: the generic kernel deliberately does not
 * add a second rollback gate, while the production economics policy guard
 * refuses them before their leaf handlers.
 * PRT-W17 is deliberately different: the production public router is not mounted
 * behind the generic guard. Its retained canonical command resolves the owner
 * tenant and records telemetry in the same transaction as the click. This file
 * therefore pins registry authority only and must not manufacture synthetic
 * unresolved "production" telemetry for the public ingress.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupLegacyCutoverTestIntents } from './legacyCutoverTestCleanup.js';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import {
  PARTNERS_CONFIG_CUTOVER,
  PARTNERS_PUBLIC_CUTOVER,
  PARTNERS_SUPERADMIN_CUTOVER,
} from '../registry/partnersSiblings.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `prtsib-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const user = `${prefix}-user`;

describe.skipIf(!REAL_PG)('Partner sibling routers (fresh real PostgreSQL)', () => {
  let pool: Pool;

  function app(config: any, mount: string, authenticated: boolean): express.Express {
    const instance = express();
    instance.use(express.json());
    if (authenticated) {
      instance.use((request_: any, _res, next) => {
        request_.user = { id: user, organizationId: request_.headers['x-test-org'], role: 'ADMIN' };
        request_.userId = user;
        request_.organizationId = request_.headers['x-test-org'];
        next();
      });
    }
    instance.use(mount, createLegacyCutoverGuard(config), (_req, res) =>
      res.status(200).json({ reachedLeaf: true })
    );
    return instance;
  }

  async function rows(requestId: string) {
    const result = await pool.query(
      `SELECT writer_id, access_kind, route_path, organization_id, tenant_resolution
         FROM legacy_cutover_usage_events
        WHERE request_id = $1
        ORDER BY route_path`,
      [requestId]
    );
    return result.rows;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const now = new Date().toISOString();
    for (const org of [orgA, orgB]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
        [org, org, now]
      );
    }
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupLegacyCutoverTestIntents(pool, {
      organizationIds: [orgA, orgB],
      requestIdPrefix: prefix,
    });
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE request_id LIKE $1`, [
      `${prefix}%`,
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('classifies PRT-W17 as retained canonical ingress without claiming a generic guard mount', async () => {
    expect(PARTNERS_PUBLIC_CUTOVER.recordUnmatchedReads).toBe(false);
    expect(PARTNERS_PUBLIC_CUTOVER.writers).toHaveLength(1);
    expect(PARTNERS_PUBLIC_CUTOVER.writers[0]).toMatchObject({
      writerId: 'PRT-W17',
      method: 'POST',
      state: 'owner-blocked',
      successor: null,
    });
    expect(PARTNERS_PUBLIC_CUTOVER.writers[0].reason).toContain(
      'RETAINED_CURRENT_CANONICAL_PUBLIC_INGRESS'
    );

    // This registry suite must not synthesize anonymous cutover events. The
    // mounted production command and its resolved tenant telemetry are proven
    // in partner-legacy-cutover.realdb.test.ts.
    expect(await rows(`${prefix}-public`)).toHaveLength(0);
    expect(await rows(`${prefix}-public-write`)).toHaveLength(0);
  });

  it('classifies W18-W27 as immutable decision-enforced disabled writers', () => {
    const economics = [
      ...PARTNERS_SUPERADMIN_CUTOVER.writers,
      ...PARTNERS_CONFIG_CUTOVER.writers,
    ].filter((writer) => /^PRT-W(?:1[89]|2[0-7])$/.test(writer.writerId));

    expect(economics).toHaveLength(10);
    for (const writer of economics) {
      expect(writer).toMatchObject({
        state: 'disabled',
        successor: null,
        enforcedBy: 'domain',
        enforcedByDecision: 'AMD-PRT-ECONOMICS-002',
      });
      expect(writer.enforcedByEnv).toBeUndefined();
      expect(writer.reason).toContain('AMD-PRT-ECONOMICS-002');
    }
  });

  it('leaves domain-enforced payout refusal to the production policy guard', async () => {
    const instance = app(PARTNERS_SUPERADMIN_CUTOVER, '/api/superadmin/partner-settlements', true);
    const response = await request(instance)
      .post('/api/superadmin/partner-settlements/process-payout/payout-1')
      .set('x-test-org', orgA)
      .set('x-request-id', `${prefix}-payout`)
      .send({});
    expect(response.status).toBe(200);

    expect(await rows(`${prefix}-payout`)).toEqual([
      {
        writer_id: 'PRT-W19',
        access_kind: 'legacy_uncovered_writer',
        route_path: '/api/superadmin/partner-settlements/process-payout/payout-1',
        organization_id: orgA,
        tenant_resolution: 'resolved',
      },
    ]);
  });

  it('keeps two disabled writers that share a router-local path separable by mount', async () => {
    // PRT-W08 (kernel-enforced) and PRT-W27 (domain-enforced) are both
    // `PUT /payout-settings`. Only the full path distinguishes them.
    const response = await request(
      app(PARTNERS_CONFIG_CUTOVER, '/api/superadmin/partner-config', true)
    )
      .put('/api/superadmin/partner-config/payout-settings')
      .set('x-test-org', orgA)
      .set('x-request-id', `${prefix}-collision`)
      .send({});
    // The generic kernel must not pretend it can reopen the immutable domain
    // policy. The production composition blocks this route one layer earlier.
    expect(response.status).toBe(200);

    expect(await rows(`${prefix}-collision`)).toEqual([
      {
        writer_id: 'PRT-W27',
        access_kind: 'legacy_uncovered_writer',
        route_path: '/api/superadmin/partner-config/payout-settings',
        organization_id: orgA,
        tenant_resolution: 'resolved',
      },
    ]);
  });

  it('deduplicates retries and separates tenants sharing one request identity', async () => {
    const instance = app(PARTNERS_CONFIG_CUTOVER, '/api/superadmin/partner-config', true);
    const fire = (org: string) =>
      request(instance)
        .put('/api/superadmin/partner-config/commission-rates')
        .set('x-test-org', org)
        .set('x-request-id', `${prefix}-shared`)
        .send({});

    await fire(orgA);
    await fire(orgA);
    await Promise.all([fire(orgA), fire(orgA), fire(orgA)]);
    await fire(orgB);

    const observed = await rows(`${prefix}-shared`);
    expect(observed).toHaveLength(2);
    expect(observed.every((row) => row.writer_id === 'PRT-W25')).toBe(true);
    expect(new Set(observed.map((row) => row.organization_id))).toEqual(new Set([orgA, orgB]));
  });
});
