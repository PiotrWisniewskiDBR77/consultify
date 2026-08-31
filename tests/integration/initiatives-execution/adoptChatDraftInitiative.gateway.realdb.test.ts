/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day214 chat-draft adoption via production ApiGateway and real PostgreSQL', () => {
  const run = randomUUID();
  const organizationId = `day214-gateway-org-${run}`;
  const userId = `day214-gateway-user-${run}`;
  const projectId = `day214-gateway-project-${run}`;
  const blockedId = `day214-gateway-blocked-${run}`;
  const readyId = `day214-gateway-ready-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,'Day214 Gateway')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$2,$3,'unused','Day','214','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [`day214-gateway-member-${run}`, organizationId, userId]
    );
    await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Day214')`, [
      projectId,
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'INITIATIVE_OWNER')`,
      [`day214-gateway-project-member-${run}`, projectId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,name,title,problem_statement,source_type,source_id)
       VALUES($1,$2,'Blocked','Blocked','Measured problem','teresa_chat',$1)`,
      [blockedId, organizationId]
    );
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,project_id,name,title,problem_statement,source_type,source_id,owner_execution_id)
       VALUES($1,$2,$3,'Ready','Ready','Measured problem','teresa_chat',$1,$4)`,
      [readyId, organizationId, projectId, userId]
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: userId, organizationId, email: `${userId}@example.test`, role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../../server/src/Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  const auth = () => ({ Authorization: authorization, 'x-organization-id': organizationId });
  const body = (initiativeId: string, requestId: string) => ({
    chatInitiativeId: initiativeId,
    expectedVersion: 0,
    clientRequestId: requestId,
    projectId,
    visibility: 'PROJECT',
    initiativeOwnerId: userId,
  });

  it('binds the route proof to the complete realDB/auth feature environment', () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT).toBe('true');
  });

  it('keeps the new route fail-closed while its dedicated flag is OFF', async () => {
    const previous = process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT;
    process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT = 'false';
    try {
      const response = await request(app)
        .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
        .set(auth())
        .send(body(readyId, `day214-gateway-flag-off-${run}`));
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
    } finally {
      process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT = previous;
    }
  });

  it('rejects a direct POST that bypasses the card while the draft is blocked', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set(auth())
      .send(body(blockedId, `day214-gateway-blocked-${run}`));
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [organizationId, blockedId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 0, receipts: 0 });
  });

  it('returns 201, one SQL receipt, canonical readback and definition readiness', async () => {
    const created = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set(auth())
      .send(body(readyId, `day214-gateway-ready-${run}`));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      status: 'APPLIED',
      response: { initiativeId: readyId, lifecycleState: 'REGISTERED_DRAFT' },
    });
    const canonical = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${readyId}`)
      .set(auth());
    expect(canonical.status, JSON.stringify(canonical.body)).toBe(200);
    expect(canonical.body).toMatchObject({
      initiative: { initiativeId: readyId, lifecycleState: 'REGISTERED_DRAFT' },
    });
    const readiness = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${readyId}/gates/definition/readiness`)
      .set(auth());
    expect(readiness.status, JSON.stringify(readiness.body)).toBe(200);
    expect(readiness.body.readiness).toMatch(/^(NOT_READY|BLOCKED)$/);
    expect(Array.isArray(readiness.body.findings)).toBe(true);
    expect(new Set(readiness.body.findings.map((finding: any) => finding.cardKey)).size).toBe(8);
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [organizationId, readyId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 1, receipts: 1 });
  });
});

// FIX-214 pkt 1 (ODBIOR_214.md §4/§8) — bramka omijająca. Żaden z 11 testów
// dostarczonych z dyżurem 214 wywołuje trasę aktorem BEZ capability
// `initiative.create`, BEZ auth, ani z niekwalifikowanym właścicielem — audytor
// zmutował `initiativesExecutionRuntime.routes.ts:1834` na `if (false)` i CAŁY
// dostarczony pakiet pozostał 8/8 zielony. Ten describe montuje router
// BEZPOŚREDNIO (nie przez pełny ApiGateway) z REALNYM silnikiem uprawnień
// (`resolveEffectiveAccess`/`hasEffectiveCapability`, dokładnie ta sama funkcja
// `authorize`, którą production wiring podłącza na dole
// `initiativesExecutionRuntime.routes.ts`), bo pełny `ApiGateway` stosuje
// `verifyToken` PRZED tą trasą (`initiatives.routes.ts:146`) i przy braku
// tokenu odpowiada własnym `401 {error:'No token provided'}` zanim żądanie
// dotrze do `actorFromRequest`/`AUTH_REQUIRED` na `:1826` — to uczyniłoby
// mutację tej linii niewykrywalną przez pełny gateway. Montaż bezpośredni
// pozwala każdemu z trzech testów trafić dokładnie w bramkę, którą ma dowodzić.
describe('Day214 chat-draft adoption authorization gate — bypass proof (real capability engine, direct router mount)', () => {
  const run = randomUUID();
  const organizationId = `day214-authgate-org-${run}`;
  const projectId = `day214-authgate-project-${run}`;
  const privilegedUserId = `day214-authgate-admin-${run}`;
  const observerUserId = `day214-authgate-observer-${run}`;
  const strangerUserId = `day214-authgate-stranger-${run}`;
  const capabilityDraftId = `day214-authgate-cap-draft-${run}`;
  const authDraftId = `day214-authgate-auth-draft-${run}`;
  const ownerDraftId = `day214-authgate-owner-draft-${run}`;
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,'Day214 AuthGate')`, [
      organizationId,
    ]);

    // Privileged actor: ADMIN org role (grants the ADMIN capability sentinel,
    // which covers initiative.create) + INITIATIVE_OWNER project role. Used as
    // the requesting actor for the 422 test (actor IS authorized; the OWNER
    // named in the payload is not eligible) and as a control.
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$2,$3,'unused','Priv','Admin','ADMIN','active')`,
      [privilegedUserId, organizationId, `${privilegedUserId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'ADMIN','ACTIVE')`,
      [`day214-authgate-member-priv-${run}`, organizationId, privilegedUserId]
    );

    // Observer actor: qualified project member (org role USER, no wildcard;
    // project role OBSERVER — template capabilities are read-only, no
    // initiative.create). This is the actor the audit used to prove the
    // capability gate is real: without it, this exact actor gets 201.
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$2,$3,'unused','Chatty','Observer','USER','active')`,
      [observerUserId, organizationId, `${observerUserId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'USER','ACTIVE')`,
      [`day214-authgate-member-obs-${run}`, organizationId, observerUserId]
    );

    // Stranger: a real, ACTIVE organization member, but never added to
    // project_members for this project — isEligibleInitiativeOwner requires
    // BOTH an active org membership AND a project_members row, so naming this
    // user as initiativeOwnerId is the ineligible-owner case for 422.
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$2,$3,'unused','Out','Sider','USER','active')`,
      [strangerUserId, organizationId, `${strangerUserId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'USER','ACTIVE')`,
      [`day214-authgate-member-str-${run}`, organizationId, strangerUserId]
    );

    await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Day214 AuthGate')`, [
      projectId,
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'INITIATIVE_OWNER')`,
      [`day214-authgate-pm-priv-${run}`, projectId, privilegedUserId]
    );
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'OBSERVER')`,
      [`day214-authgate-pm-obs-${run}`, projectId, observerUserId]
    );
    // strangerUserId is deliberately NEVER added to project_members.

    for (const draftId of [capabilityDraftId, authDraftId, ownerDraftId]) {
      await pool.query(
        `INSERT INTO initiatives
         (id,organization_id,project_id,name,title,problem_statement,source_type,source_id,owner_execution_id)
         VALUES($1,$2,$3,'Draft','Draft','Measured problem','teresa_chat',$1,$4)`,
        [draftId, organizationId, projectId, privilegedUserId]
      );
    }

    const { createInitiativesExecutionRuntimeRouter } = await import(
      '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes.js'
    );
    const { resolveEffectiveAccess, hasEffectiveCapability } = await import(
      '../../../server/src/services/effectiveAccessService.js'
    );
    const { PostgresInitiativeReader } = await import(
      '../../../server/src/domain/initiatives-execution/postgresInitiativeReader.js'
    );
    const { PostgresMaterialCommandUnitOfWork } = await import(
      '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js'
    );
    const { PostgresGovernancePolicyResolver } = await import(
      '../../../server/src/domain/initiatives-execution/postgresGovernancePolicyResolver.js'
    );

    app = express();
    app.use(express.json());
    // Deliberately NOT verifyToken: sets req.user only when the test supplies
    // an x-test-user header, so the 401 test can exercise actorFromRequest's
    // own `if (!actor)` branch at routes.ts:1826 with no upstream middleware
    // pre-empting it (unlike the full ApiGateway, see comment above).
    app.use((req, _res, next) => {
      const testUser = req.header('x-test-user');
      if (testUser) {
        (req as any).user = {
          id: testUser,
          organizationId: req.header('x-test-org') || organizationId,
        };
      }
      next();
    });
    app.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
        reader: new PostgresInitiativeReader(pool),
        resolvePolicy: (resolveOrgId: string, resolveProjectId: string, initiativeId?: string | null) =>
          new PostgresGovernancePolicyResolver(pool).resolve(resolveOrgId, resolveProjectId, initiativeId),
        // Byte-for-byte the production wiring at the bottom of
        // initiativesExecutionRuntime.routes.ts (:6665) — real capability
        // resolution against the rows inserted above, not a stub.
        authorize: async (actor: any, authorizeProjectId: string, capability: string) => {
          const access = await resolveEffectiveAccess({
            userId: actor.userId,
            organizationId: actor.organizationId,
            applicationRole: actor.applicationRole,
            projectId: authorizeProjectId,
            isImpersonating: actor.isImpersonating,
          });
          return hasEffectiveCapability(access, capability);
        },
      })
    );
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  const bodyFor = (initiativeId: string, requestId: string, ownerId: string = privilegedUserId) => ({
    chatInitiativeId: initiativeId,
    expectedVersion: 0,
    clientRequestId: requestId,
    projectId,
    visibility: 'PROJECT',
    initiativeOwnerId: ownerId,
  });

  const countsFor = async (initiativeId: string) => {
    const result = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [organizationId, initiativeId]
    );
    return result.rows[0];
  };

  it('blocks adoption with 403 CAPABILITY_REQUIRED for a qualified project OBSERVER without initiative.create — bypass proof for routes.ts:1834', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set('x-test-user', observerUserId)
      .set('x-test-org', organizationId)
      .send(bodyFor(capabilityDraftId, `day214-authgate-403-${run}`));
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'CAPABILITY_REQUIRED' } });
    expect(await countsFor(capabilityDraftId)).toEqual({ aggregates: 0, receipts: 0 });
  });

  it('blocks adoption with 401 AUTH_REQUIRED when the request carries no actor — bypass proof for routes.ts:1826', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .send(bodyFor(authDraftId, `day214-authgate-401-${run}`));
    expect(response.status, JSON.stringify(response.body)).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    expect(await countsFor(authDraftId)).toEqual({ aggregates: 0, receipts: 0 });
  });

  it('blocks adoption with 422 INITIATIVE_OWNER_INELIGIBLE for an owner without project membership — bypass proof for routes.ts:1838-1845', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set('x-test-user', privilegedUserId)
      .set('x-test-org', organizationId)
      .send(bodyFor(ownerDraftId, `day214-authgate-422-${run}`, strangerUserId));
    expect(response.status, JSON.stringify(response.body)).toBe(422);
    expect(response.body).toMatchObject({ error: { code: 'INITIATIVE_OWNER_INELIGIBLE' } });
    expect(await countsFor(ownerDraftId)).toEqual({ aggregates: 0, receipts: 0 });
  });
});
