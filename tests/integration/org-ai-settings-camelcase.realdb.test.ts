/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

/**
 * FIX-AISET-ORG — Admin > AI Control Center > Governance > "Ustawienia AI
 * organizacji" (OrgAISettingsView.tsx) reports the field as saved but the
 * value never survives a reload.
 *
 * Root cause, confirmed by direct reading of the MOUNTED route file
 * (server/src/routes/ai/ai-settings.routes.ts — Gateway.ts:54 imports it,
 * Gateway.ts:744 mounts it at /api/ai-settings; the sibling file
 * server/src/routes/ai-settings.routes.ts with no `ai/` prefix is dead code,
 * imported nowhere):
 *
 *  - GET /org/:orgId returned the raw organization_ai_settings row
 *    (snake_case: policy_level, max_tokens_per_month, ...) straight from
 *    aiSettingsService.getOrgSettings(); OrgAISettingsView.tsx's
 *    normalizeOrgAISettings() only ever reads camelCase keys, so every field
 *    silently fell back to its UI default regardless of what was in the DB.
 *  - PUT /org/:orgId passed req.body (camelCase, exactly what
 *    OrgAISettingsView.tsx's saveSettings()/AdminApi.updateOrganizationAISettings
 *    send) straight into aiSettingsService.updateOrgSettings(), whose SQL
 *    parameters are `settings.policy_level ?? current.policy_level` etc. Every
 *    lookup missed, so the `??` fallback re-wrote the OLD value on every save.
 *
 * The superadmin tier in the SAME file (transformSettingsToCamelCase /
 * transformSettingsToSnakeCase, ~60-93 lines above the org handlers) already
 * had the correct two-way mapping; this test exercises the org tier that was
 * missing it, through the real, mounted HTTP route — not a mock.
 *
 * IMPORTANT (measured independently, not assumed): a naive "did the UPDATE
 * run" or "did updated_at change" check is USELESS for this defect. The
 * broken code still executes a real `INSERT ... ON CONFLICT DO UPDATE`,
 * still reports the row as touched, and `updated_at` genuinely advances,
 * because the `??` fallback re-writes the OLD value through a real SQL
 * write. Every assertion below compares only the actual VALUES read back
 * through an independent GET (and, for the write proof, an independent raw
 * SQL SELECT) — never row counts, never timestamps, never the save
 * response's own echo.
 */
describe('FIX-AISET-ORG ustawienia AI organizacji: camelCase <-> snake_case', NO_RETRY, () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();

  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let authA = '';
  let authB = '';

  const seeded = {
    policy_level: 'PROACTIVE',
    max_policy_level: 'AUTOPILOT',
    default_proactivity_mode: 'PROACTIVE',
    active_roles: JSON.stringify(['ADVISOR', 'EXECUTOR']),
    default_role: 'EXECUTOR',
    enabled_model_ids: JSON.stringify(['model-x']),
    max_ai_calls_per_day: 777,
    max_tokens_per_month: 1234567,
    monthly_budget_usd: 42.5,
    hard_limit_usd: 999.9,
    freeze_on_limit: 1,
    web_search_enabled: 0,
    artifacts_enabled: 0,
    thinking_steps_enabled: 0,
    focus_modes_enabled: 0,
    voice_enabled: 1,
    audit_all_requests: 1,
    audit_policy_changes: 0,
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    // Z31: no `expectedDatabase` argument — a disposable per-worktree database
    // name is not a stable identity to pin against; allowHost covers running
    // this against a local, exclusive Postgres container.
    await assertRealPostgresTestEnvironment({ allowHost: 'localhost' });
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json({ limit: '10mb' }));
    ApiGateway.getInstance().initializeRoutes(app);

    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'FIX-AISET org A','active')`, [orgA]);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,'FIX-AISET org B','active')`, [orgB]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userA, orgA, `fix-aiset-a-${userA}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userB, orgB, `fix-aiset-b-${userB}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgA, userA]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgB, userB]
    );

    await pool.query(
      `INSERT INTO organization_ai_settings (
         organization_id, policy_level, max_policy_level, default_proactivity_mode,
         active_roles, default_role, enabled_model_ids,
         max_ai_calls_per_day, max_tokens_per_month, monthly_budget_usd, hard_limit_usd, freeze_on_limit,
         web_search_enabled, artifacts_enabled, thinking_steps_enabled, focus_modes_enabled, voice_enabled,
         audit_all_requests, audit_policy_changes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        orgA,
        seeded.policy_level,
        seeded.max_policy_level,
        seeded.default_proactivity_mode,
        seeded.active_roles,
        seeded.default_role,
        seeded.enabled_model_ids,
        seeded.max_ai_calls_per_day,
        seeded.max_tokens_per_month,
        seeded.monthly_budget_usd,
        seeded.hard_limit_usd,
        seeded.freeze_on_limit,
        seeded.web_search_enabled,
        seeded.artifacts_enabled,
        seeded.thinking_steps_enabled,
        seeded.focus_modes_enabled,
        seeded.voice_enabled,
        seeded.audit_all_requests,
        seeded.audit_policy_changes,
      ]
    );

    const sign = (userId: string, organizationId: string) =>
      `Bearer ${jwt.sign(
        {
          id: userId,
          userId,
          organizationId,
          organization_id: organizationId,
          role: 'OWNER',
          email: `fix-aiset-${userId}@test.invalid`,
        },
        config.JWT_SECRET,
        { expiresIn: '30m', jwtid: randomUUID() }
      )}`;
    authA = sign(userA, orgA);
    authB = sign(userB, orgB);
  }, 180_000);

  afterAll(async () => {
    // admin_audit_logs.admin_id -> users.id has no CASCADE; the PUT /org/:orgId
    // handler's best-effort admin-audit mirror (adminAuditService.logAction)
    // inserts a row keyed by the actor, so it must be cleared before users.
    await pool.query(`DELETE FROM admin_audit_logs WHERE admin_id IN ($1,$2)`, [userA, userB]);
    await pool.query(`DELETE FROM organization_ai_settings WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [userA, userB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  it('ODCZYT: wartości zapisane wprost w bazie (snake_case) pojawiają się na ekranie (camelCase)', async () => {
    const res = await request(app)
      .get(`/api/ai-settings/org/${orgA}`)
      .set('Authorization', authA);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.policyLevel).toBe('PROACTIVE');
    expect(res.body.maxPolicyLevel).toBe('AUTOPILOT');
    expect(res.body.defaultProactivityMode).toBe('PROACTIVE');
    expect(res.body.activeRoles).toEqual(['ADVISOR', 'EXECUTOR']);
    expect(res.body.defaultRole).toBe('EXECUTOR');
    expect(res.body.enabledModelIds).toEqual(['model-x']);
    expect(res.body.maxAICallsPerDay).toBe(777);
    expect(res.body.maxTokensPerMonth).toBe(1234567);
    expect(res.body.monthlyBudgetUSD).toBe(42.5);
    expect(res.body.hardLimitUSD).toBe(999.9);
    expect(res.body.freezeOnLimit).toBe(true);
    expect(res.body.webSearchEnabled).toBe(false);
    expect(res.body.artifactsEnabled).toBe(false);
    expect(res.body.thinkingStepsEnabled).toBe(false);
    expect(res.body.focusModesEnabled).toBe(false);
    expect(res.body.voiceEnabled).toBe(true);
    expect(res.body.auditAllRequests).toBe(true);
    expect(res.body.auditPolicyChanges).toBe(false);
    // Nie odziedziczono wartości domyślnych z normalizeOrgAISettings() —
    // byłyby to ADVISORY/ASSISTED/REACTIVE/[ADVISOR]/0/0/0/0/false.
    expect(res.body.policyLevel).not.toBe('ADVISORY');
  });

  it('para ZAPIS: PUT ciałem camelCase (dokładnie tak, jak wysyła OrgAISettingsView.tsx), niezależny ponowny GET widzi NOWE wartości', async () => {
    const putBody = {
      organizationId: orgA,
      policyLevel: 'ASSISTED',
      maxPolicyLevel: 'AUTOPILOT',
      defaultProactivityMode: 'REACTIVE',
      activeRoles: ['ADVISOR'],
      defaultRole: 'ADVISOR',
      enabledModelIds: [],
      maxAICallsPerDay: 314,
      maxTokensPerMonth: 271828,
      monthlyBudgetUSD: 77.7,
      hardLimitUSD: 888.8,
      freezeOnLimit: false,
      webSearchEnabled: true,
      artifactsEnabled: true,
      thinkingStepsEnabled: true,
      focusModesEnabled: true,
      voiceEnabled: false,
      auditAllRequests: false,
      auditPolicyChanges: true,
    };

    const before = await pool.query(`SELECT updated_at FROM organization_ai_settings WHERE organization_id=$1`, [
      orgA,
    ]);

    const putRes = await request(app)
      .put(`/api/ai-settings/org/${orgA}`)
      .set('Authorization', authA)
      .send(putBody);
    expect(putRes.status, JSON.stringify(putRes.body)).toBe(200);

    // Dowód WYŁĄCZNIE przez porównanie WARTOŚCI po niezależnym ponownym
    // odczycie — nie po tym, że PUT zwrócił 200, nie po tym, że wiersz
    // "zmieniono", nie po samym fakcie, że updated_at posunął się naprzód
    // (atrapa bazy i zwykły UPSERT z `??` na starą wartość OBA dają ruch
    // updated_at bez zmiany właściwej wartości).
    const getRes = await request(app)
      .get(`/api/ai-settings/org/${orgA}`)
      .set('Authorization', authA);
    expect(getRes.status, JSON.stringify(getRes.body)).toBe(200);

    expect(getRes.body.policyLevel).toBe('ASSISTED');
    expect(getRes.body.defaultProactivityMode).toBe('REACTIVE');
    expect(getRes.body.maxAICallsPerDay).toBe(314);
    expect(getRes.body.maxTokensPerMonth).toBe(271828);
    expect(getRes.body.monthlyBudgetUSD).toBe(77.7);
    expect(getRes.body.hardLimitUSD).toBe(888.8);
    expect(getRes.body.freezeOnLimit).toBe(false);
    expect(getRes.body.webSearchEnabled).toBe(true);
    expect(getRes.body.artifactsEnabled).toBe(true);
    expect(getRes.body.auditAllRequests).toBe(false);
    expect(getRes.body.auditPolicyChanges).toBe(true);

    // Musiało się realnie ZMIENIĆ względem seeda (nie zostać przy starej
    // wartości pod inną maską).
    expect(getRes.body.policyLevel).not.toBe(seeded.policy_level);
    expect(getRes.body.maxTokensPerMonth).not.toBe(seeded.max_tokens_per_month);

    // Kontrola niezależna od aplikacji: surowe kolumny snake_case w bazie,
    // odczytane bezpośrednio SQL-em, muszą nosić te same nowe wartości.
    const raw = (
      await pool.query(
        `SELECT policy_level, default_proactivity_mode, max_ai_calls_per_day, max_tokens_per_month,
                monthly_budget_usd, hard_limit_usd, freeze_on_limit, web_search_enabled, artifacts_enabled,
                audit_all_requests, audit_policy_changes, updated_at
           FROM organization_ai_settings WHERE organization_id=$1`,
        [orgA]
      )
    ).rows[0];
    expect(raw.policy_level).toBe('ASSISTED');
    expect(raw.default_proactivity_mode).toBe('REACTIVE');
    expect(Number(raw.max_ai_calls_per_day)).toBe(314);
    expect(Number(raw.max_tokens_per_month)).toBe(271828);
    expect(Number(raw.monthly_budget_usd)).toBeCloseTo(77.7, 5);
    expect(Number(raw.hard_limit_usd)).toBeCloseTo(888.8, 5);
    expect(Number(raw.freeze_on_limit)).toBe(0);
    expect(Number(raw.web_search_enabled)).toBe(1);
    expect(Number(raw.artifacts_enabled)).toBe(1);
    expect(Number(raw.audit_all_requests)).toBe(0);
    expect(Number(raw.audit_policy_changes)).toBe(1);
    expect(new Date(raw.updated_at).getTime()).toBeGreaterThan(new Date(before.rows[0].updated_at).getTime());
  });

  it('para UPRAWNIEŃ: administrator OBCEJ organizacji nie zmienia (403, wartości org A bez zmian) · administrator WŁASNEJ zmienia normalnie', async () => {
    const beforeRaw = (
      await pool.query(`SELECT policy_level, max_tokens_per_month FROM organization_ai_settings WHERE organization_id=$1`, [
        orgA,
      ])
    ).rows[0];

    // Człon 1: obcy administrator (org B) nie może czytać ani pisać org A.
    const foreignGet = await request(app).get(`/api/ai-settings/org/${orgA}`).set('Authorization', authB);
    expect(foreignGet.status).toBe(403);

    const foreignPut = await request(app)
      .put(`/api/ai-settings/org/${orgA}`)
      .set('Authorization', authB)
      .send({ policyLevel: 'AUTOPILOT', maxTokensPerMonth: 999999999 });
    expect(foreignPut.status).toBe(403);

    const afterForeignAttempt = (
      await pool.query(`SELECT policy_level, max_tokens_per_month FROM organization_ai_settings WHERE organization_id=$1`, [
        orgA,
      ])
    ).rows[0];
    expect(afterForeignAttempt.policy_level).toBe(beforeRaw.policy_level);
    expect(Number(afterForeignAttempt.max_tokens_per_month)).toBe(Number(beforeRaw.max_tokens_per_month));

    // Człon 2 (krytyczny — sama odmowa dla wszystkich też dałaby "zielono"):
    // administrator WŁASNEJ organizacji nadal zmienia ustawienia normalnie.
    const ownPut = await request(app)
      .put(`/api/ai-settings/org/${orgA}`)
      .set('Authorization', authA)
      .send({ policyLevel: 'AUTOPILOT', maxTokensPerMonth: 4242424 });
    expect(ownPut.status, JSON.stringify(ownPut.body)).toBe(200);

    const ownGet = await request(app).get(`/api/ai-settings/org/${orgA}`).set('Authorization', authA);
    expect(ownGet.status).toBe(200);
    expect(ownGet.body.policyLevel).toBe('AUTOPILOT');
    expect(ownGet.body.maxTokensPerMonth).toBe(4242424);
  });
});
