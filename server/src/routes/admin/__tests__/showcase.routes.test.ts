/**
 * Route tests for POST /api/admin/showcase/roll (SR-1 part 2 — Wpis 32).
 *
 * Proves the route is wired behind verifyToken + verifySuperAdmin and the
 * ENABLE_SHOWCASE_DATE_ROLL flag gate:
 *   - 403 for a non-superadmin (the route MUST sit behind verifySuperAdmin),
 *   - 409 when the flag is OFF (checked before any roll work),
 *   - 200 + the bare ShowcaseRollResult[] array when superadmin + flag ON,
 *   - orgIds fall back to SHOWCASE_ORG_IDS when the body omits them,
 *   - 400 on a malformed orgIds body,
 *   - 403 SHOWCASE_ORG_NOT_ALLOWED when a body org is outside SHOWCASE_ORG_IDS,
 *     all-or-nothing so nothing is rolled (Wpis 58 / P2).
 *
 * The DB-touching roll is mocked here; the real SQL is proven by the sibling
 * RealPG suite (showcaseDateRoll.pg.test.ts).
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    actor: null as { id: string; role: string; organizationId?: string } | null,
    enabled: false,
    configuredOrgIds: [] as string[],
    rollResult: [] as unknown[],
    rollCalls: [] as Array<{ today: Date; orgIds: string[]; dryRun?: boolean }>,
  },
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!state.actor) return res.status(401).json({ error: 'No token' });
    req.user = state.actor;
    next();
  },
}));

vi.mock('../../../middleware/superAdmin.middleware.js', () => ({
  // Mirrors the real gate: only a SUPERADMIN principal passes; anything else 403.
  verifySuperAdmin: (req: any, res: any, next: () => void) =>
    String(req.user?.role || '').toLowerCase() === 'superadmin'
      ? next()
      : res.status(403).json({ error: 'Requires Super Admin privileges' }),
}));

vi.mock('../../../services/showcase/showcaseDateRollScheduler.js', () => ({
  isShowcaseDateRollEnabled: () => state.enabled,
  parseShowcaseOrgIds: (raw: string | undefined) =>
    raw ? Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))) : [],
}));

vi.mock('../../../services/showcase/showcaseDateRollService.js', () => ({
  rollShowcaseDates: (input: { today: Date; orgIds: string[]; dryRun?: boolean }) => {
    state.rollCalls.push(input);
    return Promise.resolve(state.rollResult);
  },
}));

async function buildApp() {
  const { default: router } = await import('../showcase.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/admin/showcase', router);
  return instance;
}

describe('POST /api/admin/showcase/roll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.actor = { id: 'sa-1', role: 'SUPERADMIN', organizationId: 'org-platform' };
    state.enabled = true;
    state.configuredOrgIds = [];
    state.rollResult = [
      { orgId: 'org-a', lastRolledOn: '2026-09-17', deltaDays: 7, perTable: { tasks: 1 } },
    ];
    state.rollCalls = [];
    delete process.env.SHOWCASE_ORG_IDS;
  });

  it('401 without a token', async () => {
    state.actor = null;
    const res = await request(await buildApp()).post('/api/admin/showcase/roll').send({});
    expect(res.status).toBe(401);
  });

  it('403 for a non-superadmin (route must sit behind verifySuperAdmin)', async () => {
    state.actor = { id: 'admin-1', role: 'ADMIN', organizationId: 'org-a' };
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a'] });
    expect(res.status).toBe(403);
    expect(state.rollCalls).toHaveLength(0);
  });

  it('409 when ENABLE_SHOWCASE_DATE_ROLL is OFF (checked before any roll)', async () => {
    state.enabled = false;
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a'] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHOWCASE_ROLL_DISABLED');
    expect(state.rollCalls).toHaveLength(0);
  });

  it('200 + the bare ShowcaseRollResult[] array for a superadmin with the flag ON', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-a, org-b';
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a', 'org-b'] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(state.rollResult);
    expect(state.rollCalls).toHaveLength(1);
    expect(state.rollCalls[0].orgIds).toEqual(['org-a', 'org-b']);
    expect(state.rollCalls[0].dryRun).toBe(false);
    expect(state.rollCalls[0].today).toBeInstanceOf(Date);
  });

  it('passes dryRun through to the service', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-a';
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a'], dryRun: true });
    expect(res.status).toBe(200);
    expect(state.rollCalls[0].dryRun).toBe(true);
  });

  it('falls back to SHOWCASE_ORG_IDS when the body omits orgIds', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-cfg-1, org-cfg-2';
    const res = await request(await buildApp()).post('/api/admin/showcase/roll').send({});
    expect(res.status).toBe(200);
    expect(state.rollCalls[0].orgIds).toEqual(['org-cfg-1', 'org-cfg-2']);
  });

  it('400 when orgIds is present but not a usable array', async () => {
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: 'org-a' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHOWCASE_ORG_IDS_INVALID');
    expect(state.rollCalls).toHaveLength(0);
  });

  it('400 when no org is resolvable (empty body list, no configured list)', async () => {
    const res = await request(await buildApp()).post('/api/admin/showcase/roll').send({ orgIds: [] });
    expect(res.status).toBe(400);
    expect(['SHOWCASE_ORG_IDS_INVALID', 'SHOWCASE_NO_ORGS']).toContain(res.body.code);
    expect(state.rollCalls).toHaveLength(0);
  });

  // Wpis 58 (P2): a manual roll that names orgs in the body is confined to the
  // configured SHOWCASE_ORG_IDS. Removing the intersection in the route turns
  // test (a) red (it would roll an arbitrary org and answer 200).
  it('403 SHOWCASE_ORG_NOT_ALLOWED when a body org is outside SHOWCASE_ORG_IDS (service not called)', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-a, org-b';
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['evil-tester-org'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SHOWCASE_ORG_NOT_ALLOWED');
    expect(res.body.rejected).toEqual(['evil-tester-org']);
    expect(state.rollCalls).toHaveLength(0);
  });

  it('403 all-or-nothing: a mix of allowed + outside orgs rolls NOTHING and lists only the outside ids', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-a, org-b';
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a', 'evil-tester-org', 'org-b'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SHOWCASE_ORG_NOT_ALLOWED');
    expect(res.body.rejected).toEqual(['evil-tester-org']);
    expect(state.rollCalls).toHaveLength(0);
  });

  it('200 when the body orgIds are a subset of SHOWCASE_ORG_IDS', async () => {
    process.env.SHOWCASE_ORG_IDS = 'org-a, org-b, org-c';
    const res = await request(await buildApp())
      .post('/api/admin/showcase/roll')
      .send({ orgIds: ['org-a', 'org-c'] });
    expect(res.status).toBe(200);
    expect(state.rollCalls).toHaveLength(1);
    expect(state.rollCalls[0].orgIds).toEqual(['org-a', 'org-c']);
  });
});
