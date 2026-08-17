/**
 * tool_output as closure evidence — THROUGH THE REAL PRODUCER.
 *
 * Every other test of this source type writes the `tool_outputs` row itself and
 * then asks the reader to verify it. That proves the reader agrees with the test
 * fixture; it does not prove the reader agrees with the system. The digest, the
 * payload shape, the freeze semantics and the version identity all come from
 * production code here:
 *
 *   POST /api/tools/:id/promote   (tools.routes.ts → ToolController.promoteToOutput
 *                                  → ensureToolOutputSnapshot → tool_outputs)
 *   POST /api/initiatives/:id/closure-requests/:requestId/evidence
 *                                 (initiativeClosure.routes.ts → addEvidence
 *                                  → closureEvidenceSourceReader)
 *
 * and the assertions below only read what those two produced.
 *
 * The point of the chain is the mismatch it exposes: the producer's
 * `content_hash` is FNV-1a over 64 BITS — sixteen hex characters, documented in
 * sharedRuntime/toolOutputs/contentHash.ts as non-cryptographic — while the
 * evidence ledger needs a real identity. So the reader verifies the producer's
 * digest as the change detector it is, and mints its own sha256 over a snapshot
 * it stores. Both halves are asserted against a row this test never wrote.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56904/cc_main" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/closure-evidence/tool-output-producer-flow.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 */
// Fixture MUST be imported first — it pins JWT_SECRET and deletes E2E_MODE.
import {
  bearer,
  buildTenantPair,
  cleanupFixture,
  coldPoolRead,
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

const { a: TENANT_A, b: TENANT_B } = buildTenantPair('producer');

const INITIATIVE = fxId('prod-initiative', 'main');
const SESSION_A = fxId('prod-toolsession', 'alpha');
const SESSION_B = fxId('prod-toolsession', 'beta');
/** Carrier session for the forged-digest row — `tool_session_id` is NOT NULL. */
const SESSION_FORGED = fxId('prod-toolsession', 'forged');

/**
 * A SWOT session that genuinely clears the engine's gates.
 *
 * Not decoration: `buildSwotOutput` drops unaccepted items, drops tensions whose
 * links do not survive that, and puts a move into `conclusions` only if it has a
 * rationale, live links, a complete trade-off and a named rejected alternative
 * (swotTensionEngine.validateRecommendedMove). A session that fails any of those
 * produces an output with zero conclusions, which the freeze path refuses
 * outright. Getting a real artefact out of the real producer means satisfying
 * the real contract.
 */
const swotAnswers = (suffix: string) => ({
  items: [
    {
      id: `item-strength-${suffix}`,
      text: 'Established delivery team',
      quadrant: 'strengths',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceType: 'fact',
    },
    {
      id: `item-threat-${suffix}`,
      text: 'Incumbent undercuts on price',
      quadrant: 'threats',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceType: 'observation',
    },
  ],
  tensions: [
    {
      id: `tension-${suffix}`,
      type: 'defend',
      title: 'Quality position versus price pressure',
      linkedItemIds: [`item-strength-${suffix}`, `item-threat-${suffix}`],
    },
  ],
  recommendedMoves: [
    {
      id: `move-${suffix}`,
      title: 'Move upmarket on delivery guarantees',
      rationale: 'The delivery record is the one asset price competition cannot copy quickly.',
      linkedItemIds: [`item-strength-${suffix}`],
      linkedTensionIds: [`tension-${suffix}`],
      firstStep: 'Publish a delivery SLA with penalties',
      ownerRole: 'Delivery Director',
      expectedImpact: 'high',
      tradeoff: {
        chosen: 'Compete on guaranteed delivery',
        deferred: 'Matching the incumbent on list price',
        cost: 'Short-term win rate in price-led tenders',
      },
      rejectedAlternative: {
        option: 'Across-the-board discount',
        reason: 'Concedes the only durable differentiator to buy a temporary win rate.',
      },
    },
  ],
});

let client: pg.Client;
let toolsApp: Express;
let closureApp: Express;
let toolsServer: import('node:http').Server;
let closureServer: import('node:http').Server;

const createdClosureRequests: string[] = [];
const producedOutputIds: string[] = [];

const evidenceUrl = (requestId: string) =>
  `/api/initiatives/${INITIATIVE}/closure-requests/${requestId}/evidence`;

async function createClosureRequest(): Promise<string> {
  const id = fxId('prod-closure', String(createdClosureRequests.length));
  await client.query(
    `INSERT INTO initiative_closure_requests (id, organization_id, initiative_id, requested_by, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [id, TENANT_A.id, INITIATIVE, TENANT_A.owner.id]
  );
  createdClosureRequests.push(id);
  return id;
}

async function seedToolSession(id: string, orgId: string, projectId: string, suffix: string) {
  await client.query(
    `INSERT INTO tool_sessions
       (id, organization_id, project_id, tool_type, name, status, completion_percent,
        confidence_avg, answers_json, created_by, version)
     VALUES ($1, $2, $3, 'dynamic-swot', 'Producer flow SWOT', 'APPROVED', 100, 5, $4, $5, 1)
     ON CONFLICT (id) DO UPDATE SET answers_json = EXCLUDED.answers_json`,
    [id, orgId, projectId, JSON.stringify(swotAnswers(suffix)), TENANT_A.owner.id]
  );
}

/** Drives the REAL promotion endpoint and returns the row it produced. */
async function promote(
  sessionId: string,
  actor: typeof TENANT_A.owner
): Promise<{ status: number; output: Record<string, unknown> | undefined }> {
  const res = await request(toolsServer)
    .post(`/api/tools/${sessionId}/promote`)
    .set('Authorization', bearer(actor))
    .send({ outputType: 'idea', title: 'Producer flow output' });

  const row = await coldRead((c) =>
    c.query<Record<string, unknown>>(
      `SELECT id, content_hash, frozen_at, payload_json, tool_type, method_pack_version, status
         FROM tool_outputs WHERE tool_session_id = $1 ORDER BY version DESC LIMIT 1`,
      [sessionId]
    )
  );
  const output = row.rows[0];
  if (output?.id) producedOutputIds.push(String(output.id));
  return { status: res.status, output };
}

beforeAll(async () => {
  await requireDatabase();
  client = newClient();
  await client.connect();
  await seedTenants(client, [TENANT_A, TENANT_B]);

  await client.query(
    `INSERT INTO initiatives (id, organization_id, project_id, name, status)
     VALUES ($1, $2, $3, 'Producer flow initiative', 'EXECUTING')
     ON CONFLICT (id) DO UPDATE SET project_id = EXCLUDED.project_id`,
    [INITIATIVE, TENANT_A.id, TENANT_A.projectId]
  );

  await seedToolSession(SESSION_A, TENANT_A.id, TENANT_A.projectId, 'a');
  await seedToolSession(SESSION_B, TENANT_B.id, TENANT_B.projectId, 'b');

  const toolsRoutes = (await import('../../../server/src/routes/tools.routes.js')).default;
  toolsApp = express();
  toolsApp.use(express.json());
  toolsApp.use('/api/tools', toolsRoutes);
  toolsServer = toolsApp.listen(0);
  await new Promise<void>((resolve) => toolsServer.once('listening', () => resolve()));

  const closureRoutes = (await import('../../../server/src/routes/pmo/initiativeClosure.routes.js'))
    .default;
  closureApp = express();
  closureApp.use(express.json());
  closureApp.use('/api/initiatives', closureRoutes);
  closureServer = closureApp.listen(0);
  await new Promise<void>((resolve) => closureServer.once('listening', () => resolve()));
}, 180_000);

afterAll(async () => {
  for (const s of [toolsServer, closureServer]) {
    if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
  }
  if (!client) return;
  await cleanupFixture(client, {
    closureRequestIds: createdClosureRequests,
    initiativeIds: [INITIATIVE],
    meetingIds: [],
    notebookPageIds: [],
    toolOutputIds: producedOutputIds,
    tenants: [TENANT_A, TENANT_B],
    extra: [
      { table: 'tool_initiative_links', ids: [] },
      { table: 'tool_sessions', ids: [SESSION_A, SESSION_B, SESSION_FORGED] },
    ],
  });
  await client.end();
});

describe('tool_output evidence, end to end through the real producer', () => {
  let outputId: string;
  let producerDigest: string;
  let ledgerHash: string;

  it('the promotion endpoint freezes a real tool output', async () => {
    const { status, output } = await promote(SESSION_A, TENANT_A.owner);
    outputId = String(output?.id ?? '');
    producerDigest = String(output?.content_hash ?? '');

    const payload = output?.payload_json as Record<string, unknown> | undefined;
    expect({
      httpStatus: status,
      rowExists: Boolean(output),
      frozen: Boolean(output?.frozen_at),
      // The finding that reclassified this source: sixteen hex characters, not
      // sixty-four. Asserted on a value production code computed.
      digestLength: producerDigest.length,
      digestIsHex: /^[0-9a-f]+$/.test(producerDigest),
      digestIsSha256Shaped: /^[0-9a-f]{64}$/.test(producerDigest),
      hasItems: Array.isArray(payload?.items),
      hasTensions: Array.isArray(payload?.tensions),
      // Zero conclusions is refused upstream, so a frozen row proves the W2
      // gate actually passed.
      conclusionCount: (payload?.conclusions as unknown[] | undefined)?.length,
    }).toEqual({
      httpStatus: 200,
      rowExists: true,
      frozen: true,
      digestLength: 16,
      digestIsHex: true,
      digestIsSha256Shaped: false,
      hasItems: true,
      hasTensions: true,
      conclusionCount: 1,
    });
  });

  it('the ledger mints its own sha256 and stores the snapshot that produced it', async () => {
    const requestId = await createClosureRequest();
    const res = await request(closureServer)
      .post(evidenceUrl(requestId))
      .set('Authorization', bearer(TENANT_A.owner))
      .send({
        evidenceType: 'tool_output',
        evidenceRefId: outputId,
        initiativeId: INITIATIVE,
        idempotencyKey: 'prod-attach-0001',
      });
    ledgerHash = String(res.body.sourceHash ?? '');

    const stored = await coldRead((c) =>
      c.query<{
        source_hash: string;
        source_version_id: string;
        source_snapshot_json: Record<string, string>;
        snapshot_exempt: boolean;
      }>(
        `SELECT source_hash, source_version_id, source_snapshot_json, snapshot_exempt
           FROM initiative_closure_evidence WHERE id = $1`,
        [res.body.id]
      )
    );
    const row = stored.rows[0];

    expect({
      status: res.status,
      ledgerHashIsSha256: /^[0-9a-f]{64}$/.test(row.source_hash),
      ledgerHashIsProducerDigest: row.source_hash === producerDigest,
      // The producer's digest is not discarded — it is preserved inside the
      // snapshot, so the cross-check the reader performed stays reconstructable.
      snapshotCarriesProducerDigest: row.source_snapshot_json.producerDigest === producerDigest,
      pinnedVersion: row.source_version_id,
      exempt: row.snapshot_exempt,
    }).toEqual({
      status: 201,
      ledgerHashIsSha256: true,
      ledgerHashIsProducerDigest: false,
      snapshotCarriesProducerDigest: true,
      pinnedVersion: outputId,
      exempt: false,
    });
  });

  it('the pinned identity reads back identically through a brand-new pool', async () => {
    const read = await coldPoolRead((p) =>
      p.query<{ source_hash: string; source_version_id: string }>(
        `SELECT source_hash, source_version_id FROM initiative_closure_evidence
          WHERE evidence_type = 'tool_output' AND source_version_id = $1`,
        [outputId]
      )
    );
    expect({
      rows: read.rowCount,
      hash: read.rows[0]?.source_hash,
      version: read.rows[0]?.source_version_id,
    }).toEqual({ rows: 1, hash: ledgerHash, version: outputId });
  });

  describe('negative controls, all fail-closed', () => {
    it('a forged producer digest on an otherwise genuine payload is refused', async () => {
      // Copy the real payload the producer wrote, change only the digest. This
      // is what a corrupted or hand-edited row looks like, and it is the case
      // the conditional recompute used to wave through.
      const forgedId = fxId('prod-toolout', 'forged-digest');
      await seedToolSession(SESSION_FORGED, TENANT_A.id, TENANT_A.projectId, 'forged');
      await client.query(
        `INSERT INTO tool_outputs
           (id, organization_id, project_id, tool_session_id, tool_type, method_pack_version,
            version, title, payload_json, content_hash, status, created_by, created_at, frozen_at)
         SELECT $1, organization_id, project_id, $4, tool_type, method_pack_version,
                version, title, payload_json, $2, status, created_by, created_at, frozen_at
           FROM tool_outputs WHERE id = $3`,
        [forgedId, 'deadbeefdeadbeef', outputId, SESSION_FORGED]
      );
      producedOutputIds.push(forgedId);

      const requestId = await createClosureRequest();
      const res = await request(closureServer)
        .post(evidenceUrl(requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: forgedId,
          initiativeId: INITIATIVE,
          idempotencyKey: 'prod-forged-0001',
        });
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`, [
          requestId,
        ])
      );
      expect({
        status: res.status,
        state: (res.body.details as { state?: string } | undefined)?.state,
        rows: rows.rowCount,
      }).toEqual({ status: 409, state: 'content_hash_mismatch', rows: 0 });
    });

    it('a client-supplied sourceHash cannot become the ledger identity', async () => {
      const requestId = await createClosureRequest();
      const res = await request(closureServer)
        .post(evidenceUrl(requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: outputId,
          initiativeId: INITIATIVE,
          idempotencyKey: 'prod-fakesha-0001',
          sourceHash: 'f'.repeat(64),
          sourceVersionId: 'attacker-chosen',
          snapshotExempt: true,
        });
      const stored = await coldRead((c) =>
        c.query<{ source_hash: string; source_version_id: string; snapshot_exempt: boolean }>(
          `SELECT source_hash, source_version_id, snapshot_exempt
             FROM initiative_closure_evidence WHERE id = $1`,
          [res.body.id]
        )
      );
      expect({
        status: res.status,
        hash: stored.rows[0].source_hash,
        version: stored.rows[0].source_version_id,
        exempt: stored.rows[0].snapshot_exempt,
      }).toEqual({
        status: 201,
        hash: ledgerHash,
        version: outputId,
        exempt: false,
      });
    });

    it('a tool output frozen in another tenant is simply not there', async () => {
      const { status } = await promote(SESSION_B, TENANT_B.owner);
      expect(status).toBe(200);
      const foreign = await coldRead((c) =>
        c.query<{ id: string }>(
          `SELECT id FROM tool_outputs WHERE tool_session_id = $1 ORDER BY version DESC LIMIT 1`,
          [SESSION_B]
        )
      );

      const requestId = await createClosureRequest();
      const res = await request(closureServer)
        .post(evidenceUrl(requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: foreign.rows[0].id,
          initiativeId: INITIATIVE,
          idempotencyKey: 'prod-foreign-0001',
        });
      expect({ status: res.status, code: res.body.code }).toEqual({
        status: 404,
        code: 'EVIDENCE_REF_NOT_FOUND',
      });
    });

    it('source drift after the pin is a conflict, and the pinned evidence does not move', async () => {
      const requestId = await createClosureRequest();
      const first = await request(closureServer)
        .post(evidenceUrl(requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: outputId,
          initiativeId: INITIATIVE,
          idempotencyKey: 'prod-drift-0001',
        });
      expect(first.status).toBe(201);

      // Rewrite the source's content AND its digest so the row stays internally
      // consistent — the reader has no way to notice by inspection alone, which
      // is exactly why the ledger pins a hash instead of a reference.
      const drifted = await coldRead((c) =>
        c.query<{ payload_json: Record<string, unknown> }>(
          `SELECT payload_json FROM tool_outputs WHERE id = $1`,
          [outputId]
        )
      );
      const payload = drifted.rows[0].payload_json;
      const { computeOutputHash } = await import(
        '../../../server/src/sharedRuntime/toolOutputs/outputLifecycle.js'
      );
      const items = [
        ...(payload.items as unknown[]),
        { id: 'item-added', label: 'Added after the pin', bucket: 'strengths' },
      ];
      const newDigest = computeOutputHash({
        toolType: 'dynamic-swot',
        methodPackVersion: '1.0.0',
        items,
        tensions: payload.tensions,
        conclusions: payload.conclusions,
      } as Parameters<typeof computeOutputHash>[0]);
      await client.query(
        `UPDATE tool_outputs SET payload_json = $1::jsonb, content_hash = $2 WHERE id = $3`,
        [JSON.stringify({ ...payload, items }), newDigest, outputId]
      );

      const second = await request(closureServer)
        .post(evidenceUrl(requestId))
        .set('Authorization', bearer(TENANT_A.owner))
        .send({
          evidenceType: 'tool_output',
          evidenceRefId: outputId,
          initiativeId: INITIATIVE,
          idempotencyKey: 'prod-drift-0002',
        });
      const stillPinned = await coldRead((c) =>
        c.query<{ source_hash: string }>(
          `SELECT source_hash FROM initiative_closure_evidence WHERE id = $1`,
          [first.body.id]
        )
      );

      expect({
        status: second.status,
        code: second.body.code,
        pinnedUnchanged: stillPinned.rows[0].source_hash === first.body.sourceHash,
      }).toEqual({
        status: 409,
        code: 'EVIDENCE_SOURCE_VERSION_CONFLICT',
        pinnedUnchanged: true,
      });
    });
  });
});
