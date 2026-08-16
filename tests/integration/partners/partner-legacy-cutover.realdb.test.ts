/** PRT-MVP-LEGACY-CUTOVER-001 — real PostgreSQL cutover/rollback telemetry. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';

import {
  PARTNER_LEGACY_WRITER_ROLLBACK_ENV,
  PROTECTED_PARTNER_LEGACY_WRITERS,
  partnerLegacyCutoverGuard,
} from '../../../server/src/services/partnerLegacyCutover.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const REQUEST_PREFIX = 'prt-cutover-proof-';
let sql: Client;

function request(method: string, path: string, suffix: string): any {
  return {
    method,
    path,
    headers: { 'x-request-id': `${REQUEST_PREFIX}${suffix}` },
    user: { id: 'f1000000-0000-4000-8000-000000000099' },
  };
}

function response() {
  const state: { status?: number; body?: any } = {};
  return {
    state,
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: any) {
      state.body = body;
      return this;
    },
  } as any;
}

async function event(suffix: string) {
  const result = await sql.query(
    `SELECT method,route_path,access_kind,successor_path
     FROM partner_legacy_usage_events WHERE request_id=$1`,
    [`${REQUEST_PREFIX}${suffix}`]
  );
  return result.rows[0];
}

beforeAll(async () => {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required for Partner cutover realDB proof');
  sql = new Client({ connectionString: DATABASE_URL });
  await sql.connect();
  expect((await sql.query(`SELECT version() AS version`)).rows[0].version).toMatch(/PostgreSQL/);
  await sql.query(`DELETE FROM partner_legacy_usage_events WHERE request_id LIKE $1`, [
    `${REQUEST_PREFIX}%`,
  ]);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  if (sql) {
    await sql.query(`DELETE FROM partner_legacy_usage_events WHERE request_id LIKE $1`, [
      `${REQUEST_PREFIX}%`,
    ]);
    await sql.end();
  }
});

describe.sequential('Partner legacy cutover guard (real PG)', () => {
  it('declares every V8-owned legacy writer in the zero-writer guard', () => {
    expect(PROTECTED_PARTNER_LEGACY_WRITERS).toHaveLength(8);
    expect(PROTECTED_PARTNER_LEGACY_WRITERS.map((entry) => entry.successor).sort()).toEqual(
      [
        '/api/v8/partner/campaign-links',
        '/api/v8/partner/campaign-links/:linkId',
        '/api/v8/partner/organization',
        '/api/v8/partner/organization/listing',
        '/api/v8/partner/organization/regions',
        '/api/v8/partner/organization/specializations',
        '/api/v8/partner/payout-settings',
        '/api/v8/partner/payouts/request',
      ].sort()
    );
  });

  it('blocks a V8-owned legacy writer by default and persists telemetry', async () => {
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
    const res = response();
    const next = vi.fn();
    await partnerLegacyCutoverGuard(request('PUT', '/organization/listing', 'blocked'), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.state.status).toBe(410);
    expect(res.state.body).toEqual(
      expect.objectContaining({
        code: 'PARTNER_LEGACY_WRITER_DISABLED',
        successor: '/api/v8/partner/organization/listing',
      })
    );
    expect(await event('blocked')).toEqual({
      method: 'PUT',
      route_path: '/organization/listing',
      access_kind: 'legacy_writer_blocked',
      successor_path: '/api/v8/partner/organization/listing',
    });
  });

  it('exercises the explicit rollback switch and records rollback usage', async () => {
    process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV] = 'true';
    const res = response();
    const next = vi.fn();
    await partnerLegacyCutoverGuard(request('POST', '/campaign-links', 'rollback'), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.state.status).toBeUndefined();
    expect(await event('rollback')).toEqual({
      method: 'POST',
      route_path: '/campaign-links',
      access_kind: 'rollback_writer',
      successor_path: '/api/v8/partner/campaign-links',
    });
    delete process.env[PARTNER_LEGACY_WRITER_ROLLBACK_ENV];
  });

  it('keeps uncovered legacy surfaces visible in telemetry without misrepresenting cutover', async () => {
    const readNext = vi.fn();
    await partnerLegacyCutoverGuard(request('GET', '/certifications', 'read'), response(), readNext);
    expect(readNext).toHaveBeenCalledOnce();
    expect((await event('read')).access_kind).toBe('legacy_read');

    const writeNext = vi.fn();
    await partnerLegacyCutoverGuard(
      request('POST', '/certifications/cert/modules/module/progress', 'uncovered'),
      response(),
      writeNext
    );
    expect(writeNext).toHaveBeenCalledOnce();
    expect((await event('uncovered')).access_kind).toBe('legacy_uncovered_writer');
  });

  it('proves the identity backfill left no connected partner without a V8 referral identity', async () => {
    const missing = await sql.query(
      `SELECT count(*)::int AS count FROM partner_organizations
       WHERE referral_code IS NULL OR referral_link_slug IS NULL`
    );
    expect(missing.rows[0].count).toBe(0);
  });
});
