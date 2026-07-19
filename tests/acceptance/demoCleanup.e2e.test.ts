/**
 * Acceptance E2E — Demo cleanup (real runtime, real Postgres).
 *
 * Proves the REAL `demoService.cleanupExpiredDemos` (root-cause fix for the
 * growing orphan-org problem, REJESTR T7b-1) both FINDS the right expired demo
 * scaffolding AND deletes ONLY that — never a fresh, whitelisted, or
 * human-owned org. Zero business-logic mocks: the service runs its genuine SQL
 * against the LOCAL parity Postgres; every assertion reads the row state back
 * with a direct SQL client.
 *
 * Seed (all ids carry the `odbior--t7b1--` marker for self-cleanup):
 *   A, B — ephemeral DEMO, created 3 days ago, no users            -> candidates
 *   C    — ephemeral DEMO, created NOW (fresh)                     -> kept
 *   W    — ephemeral DEMO, created 3 days ago, name 'Atelier'      -> kept (whitelist)
 *   P    — ephemeral DEMO, created 3 days ago, real human member   -> kept (guard)
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import demoService from '../../server/src/services/demoService.js';

function requireLocalDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`Acceptance harness requires a LOCAL DATABASE_URL. Got: ${url || '(unset)'}`);
  }
  return url;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: requireLocalDbUrl() });
}

const MARK = 'odbior--t7b1--';
const ID_A = `demo-org-session-${MARK}a`;
const ID_B = `demo-org-session-${MARK}b`;
const ID_C = `demo-org-session-${MARK}c-fresh`;
const ID_W = `demo-org-session-${MARK}w-whitelisted`;
const ID_P = `demo-org-session-${MARK}p-hasuser`;
const USER_P = `${MARK}user-p`;

const ALL_IDS = [ID_A, ID_B, ID_C, ID_W, ID_P];

async function purgeFixtures(): Promise<void> {
  const c = client();
  await c.connect();
  try {
    await c.query(`DELETE FROM users WHERE id LIKE $1`, [`${MARK}%`]);
    await c.query(`DELETE FROM organizations WHERE id LIKE $1`, [`demo-org-session-${MARK}%`]);
  } finally {
    await c.end();
  }
}

async function orgExists(id: string): Promise<boolean> {
  const c = client();
  await c.connect();
  try {
    const { rows } = await c.query(`SELECT 1 FROM organizations WHERE id = $1`, [id]);
    return rows.length > 0;
  } finally {
    await c.end();
  }
}

// Force the deterministic knobs for candidate selection (24h TTL, ample limit).
const BASE_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  DEMO_CLEANUP_TTL_HOURS: '24',
  DEMO_CLEANUP_LIMIT: '50',
};
const DRY_ENV: NodeJS.ProcessEnv = { ...BASE_ENV, DEMO_CLEANUP_ENABLED: '' };
const ENABLED_ENV: NodeJS.ProcessEnv = { ...BASE_ENV, DEMO_CLEANUP_ENABLED: 'true' };

beforeAll(async () => {
  await purgeFixtures();
  const c = client();
  await c.connect();
  try {
    const insOrg = `
      INSERT INTO organizations (id, name, plan, status, billing_status, organization_type, is_active, created_at)
      VALUES ($1, $2, 'demo', 'active', $3, 'DEMO', 1, $4)`;
    // A, B — expired ephemeral DEMO, no users -> candidates
    await c.query(insOrg, [ID_A, `${MARK}Expired A`, 'PENDING', new Date(Date.now() - 3 * 864e5)]);
    await c.query(insOrg, [ID_B, `${MARK}Expired B`, null, new Date(Date.now() - 3 * 864e5)]);
    // C — fresh -> kept
    await c.query(insOrg, [ID_C, `${MARK}Fresh C`, null, new Date()]);
    // W — expired but whitelisted by name 'Atelier' -> kept
    await c.query(insOrg, [ID_W, 'Atelier', 'PENDING', new Date(Date.now() - 3 * 864e5)]);
    // P — expired but has a REAL human member -> kept
    await c.query(insOrg, [ID_P, `${MARK}HasUser P`, null, new Date(Date.now() - 3 * 864e5)]);
    await c.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1, $2, $3, 'Real', 'Person', 'owner', 'active')`,
      [USER_P, ID_P, 'real.person@acme-corp.com']
    );
  } finally {
    await c.end();
  }
}, 60_000);

afterAll(async () => {
  await purgeFixtures();
});

describe('Acceptance: demoService.cleanupExpiredDemos (real runtime)', () => {
  it('DRY-RUN lists exactly the 2 expired candidates and deletes NOTHING', async () => {
    const candidates = await demoService.findExpiredDemoCandidates(50, DRY_ENV);
    const ids = candidates.map((c) => c.id).sort();
    expect(ids).toEqual([ID_A, ID_B].sort());

    const deleted = await demoService.cleanupExpiredDemos(DRY_ENV);
    expect(deleted).toBe(0);

    // Nothing removed — every seed org still present.
    for (const id of ALL_IDS) {
      expect(await orgExists(id)).toBe(true);
    }
  }, 30_000);

  it('ENABLED deletes exactly the 2 candidates, keeps fresh / whitelisted / human-owned', async () => {
    const deleted = await demoService.cleanupExpiredDemos(ENABLED_ENV);
    expect(deleted).toBe(2);

    expect(await orgExists(ID_A)).toBe(false);
    expect(await orgExists(ID_B)).toBe(false);
    // Protected orgs survive.
    expect(await orgExists(ID_C)).toBe(true);
    expect(await orgExists(ID_W)).toBe(true);
    expect(await orgExists(ID_P)).toBe(true);
  }, 30_000);

  it('is IDEMPOTENT — a second enabled run finds nothing and deletes 0', async () => {
    const candidates = await demoService.findExpiredDemoCandidates(50, ENABLED_ENV);
    expect(candidates.map((c) => c.id)).not.toContain(ID_A);
    expect(candidates.map((c) => c.id)).not.toContain(ID_B);

    const deleted = await demoService.cleanupExpiredDemos(ENABLED_ENV);
    expect(deleted).toBe(0);
  }, 30_000);
});
