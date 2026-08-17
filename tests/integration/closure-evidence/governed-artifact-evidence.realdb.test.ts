/**
 * FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001, second wave — the hash-BEARING
 * evidence sources.
 *
 * `tool_output` and `method_output` already carry a content identity produced by
 * the system that froze them, so this suite proves the pinned hash is the
 * source's OWN declared hash rather than something this code invented, on top of
 * the tenancy / explicit-assignment / eligibility / immutability guarantees the
 * first wave established.
 *
 * `gate_decision` was evaluated and WITHDRAWN — see the reasoning block in
 * `closureEvidenceSourceReader.ts`.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56904/consultinity" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/closure-evidence/governed-artifact-evidence.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 */
// Fixture MUST be imported first — it pins JWT_SECRET and deletes E2E_MODE.
import {
  bearer,
  buildTenantPair,
  coldPoolRead,
  coldRead,
  forgedE2EBearer,
  fxId,
  newClient,
  raceExactly,
  requireDatabase,
  seedTenants,
  truncateEvidenceLedgerForFixture,
} from './evidenceFixture.js';

import { PINNED_EVIDENCE_TYPES } from '../../../server/src/services/initiative/closureEvidenceSourceReader.js';
import { computeOutputHash } from '../../../server/src/sharedRuntime/toolOutputs/outputLifecycle.js';

import type { Express } from 'express';
import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * This suite owns its OWN tenant namespace. Sharing one with the sibling suite
 * meant the first teardown deleted users the second suite's rows still
 * referenced, so teardown aborted half-done and the next run started from
 * corrupted state.
 */
const { a: TENANT_A, b: TENANT_B } = buildTenantPair('governed-artifact');
const ALL_TENANTS = [TENANT_A, TENANT_B];

const INITIATIVE_A = fxId('ga-initiative', 'alpha');
const INITIATIVE_B = fxId('ga-initiative', 'beta');

const HASH_METHOD = 'd'.repeat(64);

/**
 * A REAL tool-output payload and its REAL digest, produced by the same exported
 * function the reader verifies with.
 *
 * The previous fixture used `payload_json = {"k":"v"}` next to an invented
 * `'c'.repeat(64)` hash and still passed — because verification was skipped
 * whenever the payload did not contain the expected arrays. That fixture was
 * proof of nothing; this one cannot pass unless the digest genuinely matches.
 */
const TOOL_PAYLOAD = {
  items: [{ label: 'Strength A', evidenceKind: 'observation' }],
  tensions: [{ posture: 'defend', title: 'Tension A', priority: 1 }],
  conclusions: [{ statement: 'Conclusion A' }],
};
const TOOL_TYPE = 'dynamic-swot';
const TOOL_PACK_VERSION = 'v1';
/**
 * The digest the PRODUCER stores in `tool_outputs.content_hash`.
 *
 * Not a sha256 — `computeOutputHash` is FNV-1a over 64 bits, so this is sixteen
 * hex characters. Asserted below rather than described, because the whole
 * hash-bearing classification of this source rested on it being cryptographic.
 */
const PRODUCER_DIGEST_TOOL = computeOutputHash({
  toolType: TOOL_TYPE,
  methodPackVersion: TOOL_PACK_VERSION,
  items: TOOL_PAYLOAD.items,
  tensions: TOOL_PAYLOAD.tensions,
  conclusions: TOOL_PAYLOAD.conclusions,
} as Parameters<typeof computeOutputHash>[0]);

const TOOL_FROZEN = fxId('toolout', 'frozen');
const TOOL_DRAFT = fxId('toolout', 'draft');
const TOOL_B = fxId('toolout', 'tenant-b');
/** Valid payload, digest that does not describe it. */
const TOOL_WRONG_HASH = fxId('toolout', 'wrong-hash');
/** Payload with no items/tensions/conclusions at all. */
const TOOL_NO_ARRAYS = fxId('toolout', 'no-arrays');
/** `items` present but an object rather than an array. */
const TOOL_ITEMS_NOT_ARRAY = fxId('toolout', 'items-not-array');
/** Identity incomplete: empty method_pack_version. */
const TOOL_NO_VERSION = fxId('toolout', 'no-version');
const METHOD_FROZEN = fxId('methodout', 'frozen');
const METHOD_SESSION = fxId('methodsess', 'alpha');

let client: pg.Client;
let app: Express;
let server: import('node:http').Server;
const agent = () => request(server);
const createdClosureRequests: string[] = [];

const evidenceUrl = (initiativeId: string, requestId: string) =>
  `/api/initiatives/${initiativeId}/closure-requests/${requestId}/evidence`;

async function createClosureRequest(initiativeId: string, orgId: string): Promise<string> {
  const id = fxId('ga-closure', initiativeId, String(createdClosureRequests.length));
  await client.query(
    `INSERT INTO initiative_closure_requests (id, organization_id, initiative_id, requested_by, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [id, orgId, initiativeId, TENANT_A.owner.id]
  );
  createdClosureRequests.push(id);
  return id;
}

const attach = (evidenceType: string, evidenceRefId: string, requestId: string, key: string) =>
  agent()
    .post(evidenceUrl(INITIATIVE_A, requestId))
    .set('Authorization', bearer(TENANT_A.owner))
    .send({ evidenceType, evidenceRefId, initiativeId: INITIATIVE_A, idempotencyKey: key });

beforeAll(async () => {
  await requireDatabase();
  client = newClient();
  await client.connect();
  await seedTenants(client, ALL_TENANTS);

  for (const [id, tenant] of [
    [INITIATIVE_A, TENANT_A],
    [INITIATIVE_B, TENANT_B],
  ] as const) {
    await client.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, status)
       VALUES ($1, $2, $3, 'Governed artifact evidence', 'EXECUTING')
       ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id`,
      [id, tenant.id, tenant.projectId]
    );
  }

  const toolOut = async (
    id: string,
    tenant: typeof TENANT_A,
    frozen: boolean,
    opts: { payload?: unknown; hash?: string; packVersion?: string } = {}
  ) =>
    client.query(
      `INSERT INTO tool_outputs
         (id, organization_id, project_id, tool_session_id, tool_type, method_pack_version,
          version, title, payload_json, content_hash, status, created_by, frozen_at)
       VALUES ($1, $2, $3, $4, $7, $8, 1, 'Frozen SWOT', CAST($9 AS jsonb), $5,
               'draft', $6, ${frozen ? 'NOW()' : 'NULL'})
       ON CONFLICT (id) DO UPDATE SET frozen_at = EXCLUDED.frozen_at,
                                      content_hash = EXCLUDED.content_hash,
                                      payload_json = EXCLUDED.payload_json,
                                      method_pack_version = EXCLUDED.method_pack_version`,
      [
        id,
        tenant.id,
        tenant.projectId,
        fxId('toolsess', id),
        opts.hash ?? PRODUCER_DIGEST_TOOL,
        tenant.owner.id,
        TOOL_TYPE,
        opts.packVersion ?? TOOL_PACK_VERSION,
        JSON.stringify(opts.payload ?? TOOL_PAYLOAD),
      ]
    );
  await toolOut(TOOL_FROZEN, TENANT_A, true);
  await toolOut(TOOL_DRAFT, TENANT_A, false);
  await toolOut(TOOL_B, TENANT_B, true);
  await toolOut(TOOL_WRONG_HASH, TENANT_A, true, { hash: 'e'.repeat(64) });
  await toolOut(TOOL_NO_ARRAYS, TENANT_A, true, { payload: { k: 'v' } });
  await toolOut(TOOL_ITEMS_NOT_ARRAY, TENANT_A, true, {
    payload: { ...TOOL_PAYLOAD, items: { nope: true } },
  });
  await toolOut(TOOL_NO_VERSION, TENANT_A, true, { packVersion: '' });

  await client.query(
    `INSERT INTO method_sessions
       (id, organization_id, project_id, module, method_pack_id, method_pack_version, mode, owner_user_id)
     VALUES ($1, $2, $3, 'assessment', 'drd', 'v1', 'guided_manual', $4)
     ON CONFLICT (id) DO NOTHING`,
    [METHOD_SESSION, TENANT_A.id, TENANT_A.projectId, TENANT_A.owner.id]
  );
  // `method_outputs.snapshot_id` is a RESTRICT foreign key onto the frozen
  // session state the output was derived from — seeding it is what makes the
  // output's own content hash meaningful.
  await client.query(
    `INSERT INTO method_snapshots (id, organization_id, session_id, method_pack_version, content_hash)
     VALUES ($1, $2, $3, 'v1', $4)
     ON CONFLICT (id) DO NOTHING`,
    [fxId('snap', METHOD_FROZEN), TENANT_A.id, METHOD_SESSION, HASH_METHOD]
  );
  await client.query(
    `INSERT INTO method_outputs
       (id, organization_id, session_id, snapshot_id, module, method_pack_id, method_pack_version,
        output_version, scope, content_hash)
     VALUES ($1, $2, $3, $4, 'assessment', 'drd', 'v1', 1, 'organization', $5)
     ON CONFLICT (id) DO NOTHING`,
    [METHOD_FROZEN, TENANT_A.id, METHOD_SESSION, fxId('snap', METHOD_FROZEN), HASH_METHOD]
  );

  const router = (await import('../../../server/src/routes/pmo/initiativeClosure.routes.js'))
    .default;
  app = express();
  app.use(express.json());
  app.use('/api/initiatives', router);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
}, 180_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!client) return;
  const orgs = ALL_TENANTS.map((t) => t.id);

  // Teardown is by id, children first — except the evidence ledger, which
  // admits no scoped delete at all. TRUNCATE is DDL and needs ownership of the
  // table, which is the only reason a test can do it and a runtime role cannot.
  await truncateEvidenceLedgerForFixture(client);
  await client.query(`DELETE FROM initiative_closure_requests WHERE id = ANY($1::text[])`, [
    createdClosureRequests,
  ]);
  await client.query(`DELETE FROM method_outputs WHERE id = $1`, [METHOD_FROZEN]);
  await client.query(`DELETE FROM method_snapshots WHERE id = $1`, [fxId('snap', METHOD_FROZEN)]);
  await client.query(`DELETE FROM method_sessions WHERE id = $1`, [METHOD_SESSION]);
  await client.query(`DELETE FROM tool_outputs WHERE id = ANY($1::text[])`, [
    [
      TOOL_FROZEN,
      TOOL_DRAFT,
      TOOL_B,
      TOOL_WRONG_HASH,
      TOOL_NO_ARRAYS,
      TOOL_ITEMS_NOT_ARRAY,
      TOOL_NO_VERSION,
    ],
  ]);
  await client.query(`DELETE FROM initiatives WHERE id = ANY($1::text[])`, [
    [INITIATIVE_A, INITIATIVE_B],
  ]);
  await client.query(
    `DELETE FROM audit_events WHERE org_id = ANY($1::text[]) AND action = 'INITIATIVE_CLOSURE_EVIDENCE_ADDED'`,
    [orgs]
  );
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
    orgs,
  ]);
  await client.query(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [orgs]);
  await client.query(`DELETE FROM projects WHERE organization_id = ANY($1::text[])`, [orgs]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [orgs]);

  const residue = await client.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM initiative_closure_evidence WHERE organization_id = ANY($1::text[]))
           + (SELECT count(*) FROM initiatives    WHERE organization_id = ANY($1::text[]))
           + (SELECT count(*) FROM tool_outputs   WHERE organization_id = ANY($1::text[]))
           + (SELECT count(*) FROM method_outputs WHERE organization_id = ANY($1::text[]))
           + (SELECT count(*) FROM organizations  WHERE id = ANY($1::text[])))::text AS n`,
    [orgs]
  );
  await client.end();
  if (residue.rows[0].n !== '0') {
    throw new Error(`fixture left ${residue.rows[0].n} residual rows behind`);
  }
}, 120_000);

describe('Hash-bearing sources as closure evidence (real Postgres, mounted signed auth)', () => {
  describe('0a. the denominator is 8, in the schema AND in TypeScript', () => {
    it('the CHECK constraint and the type unions agree on exactly 3 legacy + 5 pinned', async () => {
      // Stated literally because the number was previously reported as 9: a
      // withdrawn candidate (`gate_decision`) was still inflating the count.
      // Asserting both sides means neither can drift from the other or from the
      // claim made in the evidence record.
      const check = await coldRead((c) =>
        c.query<{ def: string }>(
          `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
            WHERE conname = 'initiative_closure_evidence_evidence_type_check'`
        )
      );
      const schemaTypes = (check.rows[0].def.match(/'([a-z_]+)'::text/g) ?? []).map((m) =>
        m.replace(/'|::text/g, '')
      );

      expect(schemaTypes.sort()).toEqual(
        [
          'decision',
          'meeting_follow_up',
          'meeting_note',
          'method_output',
          'milestone',
          'notebook_page',
          'task',
          'tool_output',
        ].sort()
      );
      expect(schemaTypes).toHaveLength(8);
      expect(PINNED_EVIDENCE_TYPES).toHaveLength(5);
      expect(schemaTypes).not.toContain('gate_decision');
    });
  });

  describe('0. auth is real', () => {
    it('an unsigned {alg:none} e2e token is rejected', async () => {
      expect(process.env.E2E_MODE).not.toBe('true');
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', forgedE2EBearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: TOOL_FROZEN,
          initiativeId: INITIATIVE_A,
        });
      expect(res.status).toBe(401);
    });

    it('a revoked membership cannot attach', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await agent()
        .post(evidenceUrl(INITIATIVE_A, requestId))
        .set('Authorization', bearer(TENANT_A.revoked))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: TOOL_FROZEN,
          initiativeId: INITIATIVE_A,
        });
      expect({ status: res.status, code: res.body.code }).toEqual({
        status: 403,
        code: 'MEMBERSHIP_NOT_ACTIVE',
      });
    });
  });

  describe('1. both sources attach and pin THEIR OWN declared hash', () => {
    it('a frozen tool output and a frozen method output attach with the source hash verbatim', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const tool = await attach('tool_output', TOOL_FROZEN, requestId, 'k-tool-000001');
      const method = await attach('method_output', METHOD_FROZEN, requestId, 'k-method-0001');

      const stored = await coldRead((c) =>
        c.query<{ evidence_type: string; source_hash: string; source_version_id: string | null }>(
          `SELECT evidence_type, source_hash, source_version_id
             FROM initiative_closure_evidence WHERE closure_request_id = $1
            ORDER BY evidence_type`,
          [requestId]
        )
      );
      const byType = Object.fromEntries(stored.rows.map((r) => [r.evidence_type, r]));

      expect({
        toolStatus: tool.status,
        methodStatus: method.status,
        rows: stored.rowCount,
        // The decisive assertion: the pin is the SOURCE's own hash, not a
        // recomputation this code invented for the same artefact.
        methodHash: byType.method_output?.source_hash,
        // The ledger's own sha256 — deliberately NOT the producer's 64-bit
        // change detector, which is checked separately below.
        toolHashIsSha256: /^[0-9a-f]{64}$/.test(byType.tool_output?.source_hash ?? ''),
        toolHashIsProducerDigest: byType.tool_output?.source_hash === PRODUCER_DIGEST_TOOL,
        methodVersion: byType.method_output?.source_version_id,
        toolVersion: byType.tool_output?.source_version_id,
      }).toEqual({
        toolStatus: 201,
        methodStatus: 201,
        rows: 2,
        methodHash: HASH_METHOD,
        toolHashIsSha256: true,
        toolHashIsProducerDigest: false,
        methodVersion: METHOD_FROZEN,
        toolVersion: TOOL_FROZEN,
      });
    });
  });

  describe('2. eligibility', () => {
    it('an unfrozen tool output is refused — there is no settled content to pin', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await attach('tool_output', TOOL_DRAFT, requestId, 'k-tool-draft01');
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({ status: res.status, code: res.body.code, rows: rows.rowCount }).toEqual({
        status: 409,
        code: 'EVIDENCE_NOT_TERMINAL',
        rows: 0,
      });
    });

    it('method_output has NO ineligible state — the schema makes every row frozen and hashed', async () => {
      // Asserted rather than assumed: it is the reason this source qualifies at
      // all, and the reason its runtime guards can never fire.
      const cols = await coldRead((c) =>
        c.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
          `SELECT column_name, is_nullable, column_default
             FROM information_schema.columns
            WHERE table_name = 'method_outputs' AND column_name IN ('frozen_at', 'content_hash')
            ORDER BY column_name`
        )
      );
      expect(
        cols.rows.map(
          (r) => `${r.column_name}:${r.is_nullable}:${r.column_default ? 'default' : 'none'}`
        )
      ).toEqual(['content_hash:NO:none', 'frozen_at:NO:default']);
    });
  });

  describe('2b. tool_output verification is unconditional — no fallback to "looks like a sha256"', () => {
    const cases: Array<[string, string, string]> = [
      [
        'a 64-hex hash that does not describe the payload',
        TOOL_WRONG_HASH,
        'content_hash_mismatch',
      ],
      [
        'a payload with none of the required arrays',
        TOOL_NO_ARRAYS,
        'payload_missing_or_malformed:items+tensions+conclusions',
      ],
      [
        '`items` present but an object instead of an array',
        TOOL_ITEMS_NOT_ARRAY,
        'payload_missing_or_malformed:items',
      ],
      [
        'an incomplete identity (empty method_pack_version)',
        TOOL_NO_VERSION,
        'tool_output_identity_incomplete',
      ],
    ];

    for (const [label, refId, expectedState] of cases) {
      it(`rejects ${label}`, async () => {
        const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
        const res = await attach('tool_output', refId, requestId, `k-bad-${refId.slice(-8)}`);
        const rows = await coldRead((c) =>
          c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
            requestId,
          ])
        );
        expect({
          status: res.status,
          code: res.body.code,
          state: (res.body.details as { state?: string } | undefined)?.state,
          rows: rows.rowCount,
        }).toEqual({
          status: 409,
          code: 'EVIDENCE_NOT_TERMINAL',
          state: expectedState,
          rows: 0,
        });
      });
    }

    it('accepts the one payload whose digest genuinely matches', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const res = await attach('tool_output', TOOL_FROZEN, requestId, 'k-tool-genuine1');
      const stored = await coldRead((c) =>
        c.query<{ source_hash: string; source_snapshot_json: Record<string, string> }>(
          `SELECT source_hash, source_snapshot_json FROM initiative_closure_evidence WHERE id = $1`,
          [res.body.id]
        )
      );
      expect({
        status: res.status,
        producerDigestLength: PRODUCER_DIGEST_TOOL.length,
        ledgerHashIsSha256: /^[0-9a-f]{64}$/.test(stored.rows[0].source_hash),
        // The producer's digest is preserved INSIDE the snapshot, so the
        // cross-check is reconstructable, but it is not the ledger's identity.
        snapshotCarriesProducerDigest:
          stored.rows[0].source_snapshot_json.producerDigest === PRODUCER_DIGEST_TOOL,
        snapshotCarriesItems:
          stored.rows[0].source_snapshot_json.items === JSON.stringify(TOOL_PAYLOAD.items),
      }).toEqual({
        status: 201,
        producerDigestLength: 16,
        ledgerHashIsSha256: true,
        snapshotCarriesProducerDigest: true,
        snapshotCarriesItems: true,
      });
    });
  });

  describe('3. tenancy and explicit assignment', () => {
    it("tenant B's tool output and a nonexistent id are indistinguishable to tenant A", async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const foreign = await attach('tool_output', TOOL_B, requestId, 'k-tool-xten001');
      const missing = await attach(
        'tool_output',
        fxId('toolout', 'never'),
        requestId,
        'k-tool-miss001'
      );

      expect(foreign.status).toBe(missing.status);
      expect(foreign.status).toBe(404);
      const body = JSON.stringify(foreign.body);
      expect(body).not.toContain(TENANT_B.id);
      expect(body).not.toContain(INITIATIVE_B);
    });

    it('a missing initiativeId is refused for both types', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const results = await Promise.all(
        (['tool_output', 'method_output'] as const).map((evidenceType) =>
          agent()
            .post(evidenceUrl(INITIATIVE_A, requestId))
            .set('Authorization', bearer(TENANT_A.owner))
            .send({ evidenceType, evidenceRefId: TOOL_FROZEN })
        )
      );
      expect(results.map((r) => `${r.status}:${r.body.code}`)).toEqual([
        '400:INITIATIVE_ID_REQUIRED',
        '400:INITIATIVE_ID_REQUIRED',
      ]);
    });
  });

  describe('4. idempotency and concurrency', () => {
    it('8 concurrent attachments of one method output create exactly one evidence row', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const ATTEMPTS = 8;
      const race = await raceExactly(ATTEMPTS, () =>
        attach('method_output', METHOD_FROZEN, requestId, 'k-method-race1')
      );
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      const created = race.fulfilled.filter((r: any) => r.status === 201).length;
      const replayed = race.fulfilled.filter((r: any) => r.status === 200).length;

      expect({
        attempts: race.attempts,
        transportRejected: race.rejected.length,
        rejectionReasons: race.rejected,
        created,
        replayed,
        rows: rows.rowCount,
      }).toEqual({
        attempts: ATTEMPTS,
        transportRejected: 0,
        rejectionReasons: [],
        created: 1,
        replayed: ATTEMPTS - 1,
        rows: 1,
      });
    }, 60_000);
  });

  describe('5. immutability, source deletion and cold reopen', () => {
    it('a direct UPDATE is refused and the pin reads back identically from a new Pool', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await attach('method_output', METHOD_FROZEN, requestId, 'k-method-cold1');
      expect(attached.status).toBe(201);

      const update = await client
        .query(`UPDATE initiative_closure_evidence SET notes = 'x' WHERE id = $1`, [
          attached.body.id,
        ])
        .then(() => 'ALLOWED')
        .catch((e: Error) => e.message);

      const cold = await coldPoolRead((pool) =>
        pool.query<{ source_hash: string; source_version_id: string | null }>(
          `SELECT source_hash, source_version_id FROM initiative_closure_evidence WHERE id = $1`,
          [attached.body.id]
        )
      );

      expect({
        updateRefused: String(update).includes('append-only'),
        rows: cold.rowCount,
        hash: cold.rows[0].source_hash,
        versionId: cold.rows[0].source_version_id,
      }).toEqual({
        updateRefused: true,
        rows: 1,
        hash: HASH_METHOD,
        versionId: METHOD_FROZEN,
      });
    });

    it('deleting the SOURCE does not remove the evidence that cites it', async () => {
      const requestId = await createClosureRequest(INITIATIVE_A, TENANT_A.id);
      const attached = await attach('tool_output', TOOL_FROZEN, requestId, 'k-tool-srcdel1');
      expect(attached.status).toBe(201);

      await client.query(`DELETE FROM tool_outputs WHERE id = $1`, [TOOL_FROZEN]);

      const survives = await coldRead((c) =>
        c.query<{ source_hash: string }>(
          `SELECT source_hash FROM initiative_closure_evidence WHERE id = $1`,
          [attached.body.id]
        )
      );
      expect({ rows: survives.rowCount, hash: survives.rows[0]?.source_hash }).toEqual({
        rows: 1,
        hash: attached.body.sourceHash,
      });
    });
  });
});
