/**
 * FLOW-CLOSURE-EVIDENCE-INTEGRITY-002 — authorization across the WHOLE
 * denominator.
 *
 * The membership and ownership checks were added to one writer, and the earlier
 * suites exercised them on the source types that writer was built for. That is
 * not the same claim. `initiative_closure_evidence.evidence_type` admits eight
 * values, three of them predating this work, and a rule that holds for five of
 * eight is a rule with three holes in it. Every type is driven here through the
 * real router with real signed tokens, against a real Postgres.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56904/consultinity" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/closure-evidence/authorization-matrix.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 */
// Fixture MUST be imported first — it pins JWT_SECRET and deletes E2E_MODE.
import {
  bearer,
  buildTenantPair,
  cleanupFixture,
  coldRead,
  fxId,
  newClient,
  requireDatabase,
  seedTenants,
} from './evidenceFixture.js';

import type { Express } from 'express';
import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { computeOutputHash } from '../../../server/src/sharedRuntime/toolOutputs/outputLifecycle.js';

const { a: TENANT_A, b: TENANT_B } = buildTenantPair('authz');

const INITIATIVE = fxId('authz-initiative', 'main');
const MEETING = fxId('authz-meeting', 'main');

/** One eligible source per evidence type — the full denominator, nothing sampled. */
const REF = {
  task: fxId('authz-task', 'done'),
  decision: fxId('authz-decision', 'approved'),
  milestone: fxId('authz-milestone', 'completed'),
  meeting_note: fxId('authz-note', 'approved'),
  meeting_follow_up: fxId('authz-followup', 'done'),
  notebook_page: fxId('authz-page', 'verified'),
  tool_output: fxId('authz-toolout', 'frozen'),
  method_output: fxId('authz-methodout', 'frozen'),
} as const;

const ALL_TYPES = Object.keys(REF) as Array<keyof typeof REF>;
/** The five types that pin a hash and a version; the other three are row-backed. */
const PINNED = new Set<keyof typeof REF>([
  'meeting_note',
  'meeting_follow_up',
  'notebook_page',
  'tool_output',
  'method_output',
]);

const TOOL_PAYLOAD = {
  items: [{ label: 'Authz item', evidenceKind: 'observation' }],
  tensions: [{ posture: 'defend', title: 'Authz tension', priority: 1 }],
  conclusions: [{ statement: 'Authz conclusion' }],
};
const TOOL_TYPE = 'dynamic-swot';
const TOOL_PACK_VERSION = 'v1';

let client: pg.Client;
let app: Express;
let server: import('node:http').Server;
const agent = () => request(server);

const createdClosureRequests: string[] = [];
let keyCounter = 0;
const nextKey = () => `authz-${String(keyCounter++).padStart(10, '0')}`;

const evidenceUrl = (initiativeId: string, requestId: string) =>
  `/api/initiatives/${initiativeId}/closure-requests/${requestId}/evidence`;

/**
 * The requester is deliberately the plain MEMBER, not the owner.
 *
 * With an OWNER requester the "requester may attach" and "OWNER may attach"
 * branches are the same branch, and a matrix that cannot tell them apart proves
 * neither.
 */
async function createClosureRequest(requestedBy: string): Promise<string> {
  const id = fxId('authz-closure', String(createdClosureRequests.length));
  await client.query(
    `INSERT INTO initiative_closure_requests (id, organization_id, initiative_id, requested_by, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [id, TENANT_A.id, INITIATIVE, requestedBy]
  );
  createdClosureRequests.push(id);
  return id;
}

beforeAll(async () => {
  await requireDatabase();
  client = newClient();
  await client.connect();
  await seedTenants(client, [TENANT_A, TENANT_B]);

  await client.query(
    `INSERT INTO initiatives (id, organization_id, project_id, name, status)
     VALUES ($1, $2, $3, 'Authorization matrix initiative', 'EXECUTING')
     ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id`,
    [INITIATIVE, TENANT_A.id, TENANT_A.projectId]
  );

  // --- legacy row-backed types, each seeded in its terminal state ---
  await client.query(
    `INSERT INTO tasks (id, organization_id, initiative_id, project_id, title, status, created_by)
     VALUES ($1, $2, $3, $4, 'Authz task', 'done', $5)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [REF.task, TENANT_A.id, INITIATIVE, TENANT_A.projectId, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO decisions (id, organization_id, initiative_id, project_id, title, status, created_by)
     VALUES ($1, $2, $3, $4, 'Authz decision', 'approved', $5)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [REF.decision, TENANT_A.id, INITIATIVE, TENANT_A.projectId, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO initiative_milestones (id, organization_id, initiative_id, name, status)
     VALUES ($1, $2, $3, 'Authz milestone', 'COMPLETED')
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    [REF.milestone, TENANT_A.id, INITIATIVE]
  );

  // --- meeting + notebook sources ---
  await client.query(
    `INSERT INTO meetings (id, organization_id, project_id, title, start_at, end_at, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, 'Authz meeting', $5, $5, 'held', $4, $5, $5)
     ON CONFLICT (id) DO NOTHING`,
    [MEETING, TENANT_A.id, TENANT_A.projectId, TENANT_A.owner.id, new Date().toISOString()]
  );
  await client.query(
    `INSERT INTO meeting_notes (id, organization_id, meeting_id, source, transcript_hash, status, summary, created_by)
     VALUES ($1, $2, $3, 'heuristic', $4, 'approved', 'Authz minutes', $5)
     ON CONFLICT (id) DO NOTHING`,
    [REF.meeting_note, TENANT_A.id, MEETING, `transcript-${REF.meeting_note}`, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO meeting_follow_ups (id, meeting_id, title, owner, status, created_at, updated_at)
     VALUES ($1, $2, 'Authz follow-up', $3, 'done', $4, $4)
     ON CONFLICT (id) DO NOTHING`,
    [REF.meeting_follow_up, MEETING, TENANT_A.owner.id, new Date().toISOString()]
  );
  await client.query(
    `INSERT INTO notebook_pages (id, owner_user_id, organization_id, project_id, title, content_text, status, verification_status)
     VALUES ($1, $2, $3, $4, 'Authz page', 'authz body', 'active', 'verified')
     ON CONFLICT (id) DO NOTHING`,
    [REF.notebook_page, TENANT_A.owner.id, TENANT_A.id, TENANT_A.projectId]
  );
  await client.query(
    `INSERT INTO notebook_page_versions (id, page_id, organization_id, title, content_text, created_by)
     VALUES ($1, $2, $3, 'Authz page', 'authz body', $4)
     ON CONFLICT (id) DO NOTHING`,
    [fxId('authz-pagever', 'v1'), REF.notebook_page, TENANT_A.id, TENANT_A.owner.id]
  );

  // --- governed artefacts ---
  await client.query(
    `INSERT INTO tool_outputs
       (id, organization_id, project_id, tool_session_id, tool_type, method_pack_version,
        version, title, payload_json, content_hash, status, frozen_at, created_by)
     VALUES ($1, $2, $3, $10, $4, $5, 1, 'Authz SWOT', CAST($6 AS jsonb), $7, 'draft', $8, $9)
     ON CONFLICT (id) DO NOTHING`,
    [
      REF.tool_output,
      TENANT_A.id,
      TENANT_A.projectId,
      TOOL_TYPE,
      TOOL_PACK_VERSION,
      JSON.stringify(TOOL_PAYLOAD),
      computeOutputHash({
        toolType: TOOL_TYPE,
        methodPackVersion: TOOL_PACK_VERSION,
        items: TOOL_PAYLOAD.items,
        tensions: TOOL_PAYLOAD.tensions,
        conclusions: TOOL_PAYLOAD.conclusions,
      } as Parameters<typeof computeOutputHash>[0]),
      new Date().toISOString(),
      TENANT_A.owner.id,
      fxId('authz-toolsess', 'main'),
    ]
  );
  await seedMethodOutput();

  const router = (await import('../../../server/src/routes/pmo/initiativeClosure.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/initiatives', router);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
}, 180_000);

/**
 * `method_outputs` needs a session and a snapshot; both carry NOT NULL columns
 * and a mode CHECK, so they are written out rather than guessed at.
 */
async function seedMethodOutput(): Promise<void> {
  const sessionId = fxId('authz-methodsession', 'main');
  const snapshotId = fxId('authz-methodsnapshot', 'main');
  await client.query(
    `INSERT INTO method_sessions
       (id, organization_id, project_id, module, method_pack_id, method_pack_version, mode, owner_user_id)
     VALUES ($1, $2, $3, 'assessment', 'drd', 'v1', 'guided_manual', $4)
     ON CONFLICT (id) DO NOTHING`,
    [sessionId, TENANT_A.id, TENANT_A.projectId, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO method_snapshots (id, organization_id, session_id, method_pack_version, content_hash)
     VALUES ($1, $2, $3, 'v1', $4)
     ON CONFLICT (id) DO NOTHING`,
    [snapshotId, TENANT_A.id, sessionId, 'f'.repeat(64)]
  );
  await client.query(
    `INSERT INTO method_outputs
       (id, organization_id, session_id, snapshot_id, module, method_pack_id, method_pack_version,
        output_version, scope, content_hash)
     VALUES ($1, $2, $3, $4, 'assessment', 'drd', 'v1', 1, 'organization', $5)
     ON CONFLICT (id) DO NOTHING`,
    [REF.method_output, TENANT_A.id, sessionId, snapshotId, 'f'.repeat(64)]
  );
}

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!client) return;
  await cleanupFixture(client, {
    closureRequestIds: createdClosureRequests,
    initiativeIds: [INITIATIVE],
    meetingIds: [MEETING],
    notebookPageIds: [REF.notebook_page],
    toolOutputIds: [REF.tool_output],
    methodOutputIds: [REF.method_output],
    tenants: [TENANT_A, TENANT_B],
    extra: [
      { table: 'tasks', ids: [REF.task] },
      { table: 'decisions', ids: [REF.decision] },
      { table: 'initiative_milestones', ids: [REF.milestone] },
      { table: 'method_snapshots', ids: [fxId('authz-methodsnapshot', 'main')] },
      { table: 'method_sessions', ids: [fxId('authz-methodsession', 'main')] },
      { table: 'tool_sessions', ids: [fxId('authz-toolsess', 'main')] },
    ],
  });
  await client.end();
});

interface Attempt {
  status: number;
  code: string | undefined;
  rows: number;
}

async function attempt(
  type: keyof typeof REF,
  token: string,
  requestId: string,
  overrides: Record<string, unknown> = {},
  pathInitiative = INITIATIVE
): Promise<Attempt> {
  const res = await agent()
    .post(evidenceUrl(pathInitiative, requestId))
    .set('Authorization', token)
    .send({
      evidenceType: type,
      evidenceRefId: REF[type],
      initiativeId: INITIATIVE,
      idempotencyKey: nextKey(),
      ...overrides,
    });
  const rows = await coldRead((c) =>
    c.query(
      `SELECT id FROM initiative_closure_evidence
        WHERE closure_request_id = $1 AND evidence_type = $2`,
      [requestId, type]
    )
  );
  return { status: res.status, code: res.body?.code, rows: rows.rowCount ?? 0 };
}

describe('Closure evidence authorization, across all 8 evidence types', () => {
  it('the matrix covers the entire schema denominator, not a sample of it', async () => {
    const check = await coldRead((c) =>
      c.query<{ def: string }>(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conname = 'initiative_closure_evidence_evidence_type_check'`
      )
    );
    const schemaTypes = (check.rows[0].def.match(/'([a-z_]+)'::text/g) ?? []).map((m) =>
      m.replace(/'|::text/g, '')
    );
    expect(ALL_TYPES.slice().sort()).toEqual(schemaTypes.sort());
  });

  describe('who may attach', () => {
    for (const type of ALL_TYPES) {
      it(`${type}: the requester may, and the attachment lands`, async () => {
        const requestId = await createClosureRequest(TENANT_A.member.id);
        expect(await attempt(type, bearer(TENANT_A.member), requestId)).toEqual({
          status: 201,
          code: undefined,
          rows: 1,
        });
      });

      it(`${type}: an organization OWNER may act above the requester`, async () => {
        const requestId = await createClosureRequest(TENANT_A.member.id);
        expect(await attempt(type, bearer(TENANT_A.owner), requestId)).toEqual({
          status: 201,
          code: undefined,
          rows: 1,
        });
      });

      it(`${type}: an organization ADMIN may act above the requester`, async () => {
        const requestId = await createClosureRequest(TENANT_A.member.id);
        expect(await attempt(type, bearer(TENANT_A.admin), requestId)).toEqual({
          status: 201,
          code: undefined,
          rows: 1,
        });
      });
    }
  });

  describe('who may not', () => {
    for (const type of ALL_TYPES) {
      it(`${type}: an ACTIVE member who did not raise the request is refused`, async () => {
        // The request belongs to the OWNER here, so the actor is a member in
        // good standing attaching to somebody else's request — the case that
        // knowing an id must not be enough for.
        const requestId = await createClosureRequest(TENANT_A.owner.id);
        expect(await attempt(type, bearer(TENANT_A.member), requestId)).toEqual({
          status: 403,
          code: 'CLOSURE_REQUEST_NOT_OWNED',
          rows: 0,
        });
      });

      it(`${type}: a revoked member is refused even though the token still verifies`, async () => {
        // `requireOrgAccess()` only inspects the token's shape, so this actor
        // walks past the middleware; the writer's own membership check is what
        // stops it.
        const requestId = await createClosureRequest(TENANT_A.revoked.id);
        expect(await attempt(type, bearer(TENANT_A.revoked), requestId)).toEqual({
          status: 403,
          code: 'MEMBERSHIP_NOT_ACTIVE',
          rows: 0,
        });
      });

      it(`${type}: an actor from another tenant learns only that nothing is there`, async () => {
        const requestId = await createClosureRequest(TENANT_A.member.id);
        const res = await attempt(type, bearer(TENANT_B.owner), requestId);
        expect(res).toEqual({ status: 404, code: 'INITIATIVE_NOT_FOUND', rows: 0 });
      });

      it(`${type}: a body that disagrees with the path cannot redirect the write`, async () => {
        const requestId = await createClosureRequest(TENANT_A.member.id);
        const res = await attempt(type, bearer(TENANT_A.member), requestId, {
          initiativeId: fxId('authz-initiative', 'someone-elses'),
        });
        const landed = await coldRead((c) =>
          c.query<{ initiative_id: string }>(
            `SELECT initiative_id FROM initiative_closure_evidence
              WHERE closure_request_id = $1 AND evidence_type = $2`,
            [requestId, type]
          )
        );

        if (PINNED.has(type)) {
          // Pinned sources are reachable from several initiatives in one
          // project, so the target must be stated and a disagreement is a
          // client error rather than a silent pick.
          expect({ status: res.status, code: res.code, rows: res.rows }).toEqual({
            status: 400,
            code: 'INITIATIVE_ID_MISMATCH',
            rows: 0,
          });
        } else {
          // Row-backed legacy types are found through the path initiative and
          // the body field is not read at all. The write therefore succeeds —
          // but it must land on the initiative in the PATH, which is the claim
          // that actually matters and is asserted rather than assumed.
          expect({ status: res.status, landedOn: landed.rows[0]?.initiative_id }).toEqual({
            status: 201,
            landedOn: INITIATIVE,
          });
        }
      });
    }
  });
});
