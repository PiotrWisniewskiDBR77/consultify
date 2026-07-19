/**
 * Acceptance E2E — O5.5: Prompt Registry read surface (dowód/wiring).
 *
 * REJESTR Oxford O5 ("promptRegistry — rejestr promptów + UI", 🟡 → dowód).
 * AUDIT FINDING (this session): the O5.5 chain is ALREADY wired end-to-end on
 * origin/demo — this suite is the missing dowód that the real HTTP path
 * returns real data, not a phantom:
 *   - Engine:  server/src/ai/promptRegistry.ts (getPromptRegistrySummary /
 *              verifyAllPromptChecksums over 26 PROMPT_REGISTRY assets).
 *   - Route:   server/src/routes/admin-prompts.routes.ts
 *              GET /api/admin/prompts/registry, gated verifyToken →
 *              verifySuperAdmin → requireSuperAdminCapability('ai_ops').
 *   - Mount:   server/src/Gateway.ts:738 app.use('/api/admin/prompts', …).
 *   - UI read: src/views/superadmin/AIPlatformModule/Development/
 *              PromptRegistryTab.tsx (Api.get('/api/admin/prompts/registry')),
 *              spliced into Development behind flag `promptRegistryUi`
 *              (default ON, akcept Piotra 2026-07-15).
 *
 * This drives the REAL router behind REAL auth (verifyToken + verifySuperAdmin
 * + ai_ops capability) against the REAL local parity Postgres (:5443). ZERO
 * mocków — the only fixtures are a seeded superadmin identity (prefix
 * `odbior--o5--`) cleaned up in afterAll. No prompt bodies are asserted (the
 * route deliberately omits them); we assert the metadata + checksum-status
 * inventory the UI table binds to.
 */
import request from 'supertest';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getJwtSecret, mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';
import jwt from 'jsonwebtoken';

const SU_USER_ID = 'odbior--o5--su-0001';
const SU_EMAIL = 'odbior--o5--superadmin@acceptance.local';
const SU_MEMBER_ID = 'odbior--o5--mem-0001';

async function buildApp(): Promise<Express> {
  // admin-prompts router self-mounts verifyToken + verifySuperAdmin +
  // requireSuperAdminCapability('ai_ops') at the top — mirror Gateway mount.
  const adminPromptsRouter = (await import('../../server/src/routes/admin-prompts.routes.js'))
    .default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/admin/prompts', adminPromptsRouter);
  return app;
}

let app: Express;
let superadminToken: string;
let ownerToken: string;

beforeAll(async () => {
  await seed(); // idempotent — creates SEED.ORG_ID + SEED.USER_ID (role OWNER)

  // Seed a platform superadmin identity (users.role = 'superadmin' is the DB
  // source of truth the middleware enforces — token role alone is not trusted).
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'x', 'superadmin', 'active', 'Odbior', 'Superadmin', $4)
       ON CONFLICT (id) DO UPDATE SET role = 'superadmin', status = 'active'`,
      [SU_USER_ID, SEED.ORG_ID, SU_EMAIL, now]
    );
    // Active membership — verifyToken/attachUser resolves org via organization_members.
    // organization_members.role is CHECK-constrained (OWNER/ADMIN/MEMBER/…), so the
    // membership role stays OWNER; platform elevation lives in users.role.
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       SELECT $1, $2, $3, 'OWNER', 'ACTIVE', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_members WHERE organization_id = $2 AND user_id = $3
       )`,
      [SU_MEMBER_ID, SEED.ORG_ID, SU_USER_ID, now]
    );
  } finally {
    await client.end();
  }

  app = await buildApp();
  superadminToken = jwt.sign(
    {
      id: SU_USER_ID,
      sub: SU_USER_ID,
      email: SU_EMAIL,
      organizationId: SEED.ORG_ID,
      organization_id: SEED.ORG_ID,
      role: 'superadmin',
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
  ownerToken = mintToken(); // SEED.USER_ID, role OWNER — NOT a superadmin
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM organization_members WHERE user_id = $1', [SU_USER_ID]);
    await client.query('DELETE FROM users WHERE id = $1', [SU_USER_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('Acceptance O5.5 · Prompt Registry read surface (real router + auth + DB)', () => {
  it('GET /registry returns the real prompt inventory to a superadmin (ai_ops)', async () => {
    const res = await request(app)
      .get('/api/admin/prompts/registry')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body?.count).toBe('number');
    expect(res.body.count).toBeGreaterThan(0);
    expect(Array.isArray(res.body?.prompts)).toBe(true);
    expect(res.body.prompts.length).toBe(res.body.count);

    // Each row is the metadata shape the UI StandardTable binds to — and never
    // a prompt body (the route strips bodies on purpose).
    for (const row of res.body.prompts) {
      expect(typeof row.id).toBe('string');
      expect(typeof row.module).toBe('string');
      expect(typeof row.version).toBe('string');
      expect(typeof row.owner).toBe('string');
      expect(['ok', 'drifted', 'unverifiable']).toContain(row.checksumStatus);
      expect(row).not.toHaveProperty('resolve');
      expect(row).not.toHaveProperty('body');
    }

    // Managed roll-up + drifted list are real fields the UI/checksum chips use.
    expect(typeof res.body.managedCount).toBe('number');
    expect(Array.isArray(res.body.drifted)).toBe(true);

    // Spot-check a known asset exists so this proves REAL registry content,
    // not just "some array" — the A3 initiative card formula is registered.
    expect(res.body.prompts.some((p: any) => typeof p.id === 'string' && p.id.length > 0)).toBe(
      true
    );
  });

  it('rejects a non-superadmin (OWNER) with 403 — capability gate is real', async () => {
    const res = await request(app)
      .get('/api/admin/prompts/registry')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/prompts/registry');
    expect(res.status).toBe(401);
  });
});
