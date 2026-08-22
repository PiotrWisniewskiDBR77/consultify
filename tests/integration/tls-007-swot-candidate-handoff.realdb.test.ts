import fs from 'node:fs/promises';

import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://consultinity:consultinity@localhost:5442/consultinity';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';
const RUN_REAL_DB = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');
const describeRealDb = RUN_REAL_DB ? describe : describe.skip;

const PREFIX = `tls007-${Date.now()}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const ACTOR = `${PREFIX}actor`;
const SESSION = `${PREFIX}swot`;
const UNAPPROVED_SESSION = `${PREFIX}swot-draft`;
const NON_SWOT = `${PREFIX}other`;

let handoffSwotRecommendation: (typeof import('../../server/src/services/tools/swotCandidateHandoffService.js'))['handoffSwotRecommendation'];
let setFault: (typeof import('../../server/src/services/tools/swotCandidateHandoffService.js'))['setSwotCandidateHandoffFaultInjectorForTests'];
let app: Express;

async function client(): Promise<Client> {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  return db;
}

beforeAll(async () => {
  if (!RUN_REAL_DB) return;
  const db = await client();
  try {
    const migration = await fs.readFile(
      'server/migrations/20260802_tls007_swot_candidate_handoff.sql',
      'utf8'
    );
    await db.query(migration);
    await db.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, created_by, updated_by, created_at, updated_at)
       VALUES
         ($1, $2, NULL, 'dynamic-swot', 'TLS-07 SWOT', 'APPROVED', 100, 4, $3, $3, NOW(), NOW()),
         ($4, $2, NULL, 'dynamic-swot', 'TLS-07 unapproved SWOT', 'DRAFT', 100, 4, $3, $3, NOW(), NOW()),
         ($5, $2, NULL, 'business-model-canvas', 'Not SWOT', 'APPROVED', 100, 4, $3, $3, NOW(), NOW())`,
      [SESSION, ORG_A, ACTOR, UNAPPROVED_SESSION, NON_SWOT]
    );
    await db.query(
      `INSERT INTO tool_outputs
         (id, organization_id, tool_session_id, tool_type, method_pack_version, version,
          title, payload_json, content_hash, status, created_by, approved_by, approved_at, frozen_at)
       VALUES ($1, $2, $3, 'dynamic-swot', 'dynamic-swot@1', 1, 'Approved SWOT output',
               $4::jsonb, $5, 'approved', $6, $6, NOW(), NOW())`,
      [
        `${PREFIX}output`,
        ORG_A,
        SESSION,
        JSON.stringify({
          sourceRevision: 1,
          conclusions: [
            { id: 'rec-1', k3Actions: ['Capture the market opportunity'] },
            { id: 'rec-2', k3Actions: ['Concurrent recommendation'] },
            { id: 'rec-4', k3Actions: ['HTTP recommendation'] },
            { id: 'rec-9', k3Actions: ['Rollback recommendation'] },
          ],
        }),
        'a'.repeat(16),
        ACTOR,
      ]
    );
  } finally {
    await db.end();
  }
  const service = await import('../../server/src/services/tools/swotCandidateHandoffService.js');
  handoffSwotRecommendation = service.handoffSwotRecommendation;
  setFault = service.setSwotCandidateHandoffFaultInjectorForTests;
  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || ACTOR,
      organizationId: req.header('x-test-org') || ORG_A,
      role: 'admin',
      email: `${PREFIX}user@example.test`,
    };
    next();
  });
  app.post('/api/tools/:toolId/swot-candidates', ToolController.handoffSwotCandidate);
}, 30_000);

afterAll(async () => {
  if (!RUN_REAL_DB) return;
  setFault?.(null);
  const db = await client();
  try {
    const databaseName = new URL(DATABASE_URL).pathname.slice(1);
    if (
      process.env.FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1' ||
      !databaseName.startsWith(process.env.FLOW_DISPOSABLE_DB_PREFIX || 'never-match')
    ) {
      throw new Error('SWOT source-adapter cleanup requires an explicitly guarded flow_* database');
    }
    await db.query('BEGIN');
    await db.query(`SET LOCAL session_replication_role = 'replica'`);
    await db.query(`DELETE FROM swot_candidate_handoffs WHERE organization_id IN ($1, $2)`, [
      ORG_A,
      ORG_B,
    ]);
    await db.query(`DELETE FROM initiative_candidates WHERE organization_id IN ($1, $2)`, [
      ORG_A,
      ORG_B,
    ]);
    await db.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
    await db.query(`DELETE FROM tool_sessions WHERE id IN ($1, $2, $3)`, [
      SESSION,
      UNAPPROVED_SESSION,
      NON_SWOT,
    ]);
    await db.query('COMMIT');
    const readback = await db.query<{ residue: string; disabled: string }>(
      `SELECT
         ((SELECT count(*) FROM swot_candidate_handoffs WHERE organization_id IN ($1, $2)) +
          (SELECT count(*) FROM initiative_candidates WHERE organization_id IN ($1, $2)) +
          (SELECT count(*) FROM tool_outputs WHERE organization_id IN ($1, $2)) +
          (SELECT count(*) FROM tool_sessions WHERE id IN ($3, $4, $5)))::text AS residue,
         (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') AS disabled`,
      [ORG_A, ORG_B, SESSION, UNAPPROVED_SESSION, NON_SWOT]
    );
    expect(readback.rows[0]).toEqual({ residue: '0', disabled: '0' });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
});

describeRealDb('TLS-07 — SWOT recommendation to canonical Candidate', () => {
  it('rejects a DRAFT or REVIEW SWOT before any Candidate or receipt write', async () => {
    for (const [status, recommendationId] of [
      ['DRAFT', 'rec-7'],
      ['REVIEW', 'rec-8'],
    ] as const) {
      const db = await client();
      try {
        await db.query(`UPDATE tool_sessions SET status=$1 WHERE id=$2`, [
          status,
          UNAPPROVED_SESSION,
        ]);
      } finally {
        await db.end();
      }
      await expect(
        handoffSwotRecommendation({
          organizationId: ORG_A,
          toolSessionId: UNAPPROVED_SESSION,
          recommendationId,
          actorId: ACTOR,
        })
      ).rejects.toMatchObject({ code: 'SWOT_SESSION_NOT_APPROVED', status: 409 });
    }
    const db = await client();
    try {
      const residue = await db.query(
        `SELECT
           (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND source_type='swot_recommendation' AND source_id LIKE $2) candidates,
           (SELECT count(*)::int FROM swot_candidate_handoffs WHERE organization_id=$1 AND tool_session_id=$3) receipts`,
        [ORG_A, `${UNAPPROVED_SESSION}:%`, UNAPPROVED_SESSION]
      );
      expect(residue.rows[0]).toEqual({ candidates: 0, receipts: 0 });
    } finally {
      await db.end();
    }
  });

  it('creates one pending Candidate and durable lineage receipt', async () => {
    const result = await handoffSwotRecommendation({
      organizationId: ORG_A,
      toolSessionId: SESSION,
      recommendationId: 'rec-1',
      actorId: ACTOR,
    });
    expect(result.created).toBe(true);
    expect(result.candidate.status).toBe('pending');

    const db = await client();
    try {
      const stored = await db.query(
        `SELECT c.source_type, c.source_id, h.candidate_id
         FROM swot_candidate_handoffs h
         JOIN initiative_candidates c ON c.id = h.candidate_id
         WHERE h.organization_id = $1 AND h.tool_session_id = $2 AND h.recommendation_id = 'rec-1'`,
        [ORG_A, SESSION]
      );
      expect(stored.rows).toHaveLength(1);
      expect(stored.rows[0]).toMatchObject({
        source_type: 'swot_recommendation',
        source_id: `${PREFIX}output:rec-1`,
        candidate_id: result.candidate.id,
      });
    } finally {
      await db.end();
    }
  });

  it('retry returns the same Candidate and does not overwrite its accepted snapshot', async () => {
    const first = await handoffSwotRecommendation({
      organizationId: ORG_A,
      toolSessionId: SESSION,
      recommendationId: 'rec-1',
      actorId: ACTOR,
    });
    expect(first.created).toBe(false);
    expect(first.candidate.title).toBe('Capture the market opportunity');
  });

  it('serializes concurrent retries to exactly one Candidate and one receipt', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        handoffSwotRecommendation({
          organizationId: ORG_A,
          toolSessionId: SESSION,
          recommendationId: 'rec-2',
          actorId: ACTOR,
        })
      )
    );
    expect(results.filter((row) => row.created)).toHaveLength(1);
    expect(new Set(results.map((row) => row.candidate.id)).size).toBe(1);
  });

  it('does not reveal or write through a foreign tenant', async () => {
    await expect(
      handoffSwotRecommendation({
        organizationId: ORG_B,
        toolSessionId: SESSION,
        recommendationId: 'rec-3',
        actorId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'SWOT_SESSION_NOT_FOUND', status: 404 });
  });

  it('rejects a non-SWOT tool session', async () => {
    await expect(
      handoffSwotRecommendation({
        organizationId: ORG_A,
        toolSessionId: NON_SWOT,
        recommendationId: 'rec-1',
        actorId: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'NOT_SWOT_SESSION', status: 409 });
  });

  it('HTTP endpoint returns 201 then idempotent 200 with the same receipt', async () => {
    const first = await request(app)
      .post(`/api/tools/${SESSION}/swot-candidates`)
      .send({ id: 'rec-4', title: 'HTTP recommendation', rationale: 'Route proof.' });
    expect(first.status).toBe(201);
    const retry = await request(app)
      .post(`/api/tools/${SESSION}/swot-candidates`)
      .send({ id: 'rec-4', title: 'Forged retry title', rationale: 'Must not overwrite.' });
    expect(retry.status).toBe(200);
    expect(retry.body.receiptId).toBe(first.body.receiptId);
    expect(retry.body.candidate.id).toBe(first.body.candidate.id);
    expect(retry.body.candidate.title).toBe('HTTP recommendation');
  });

  it('HTTP endpoint maps a foreign-tenant lookup to indistinguishable 404', async () => {
    const response = await request(app)
      .post(`/api/tools/${SESSION}/swot-candidates`)
      .set('x-test-org', ORG_B)
      .send({ id: 'rec-5', title: 'Foreign recommendation', rationale: 'Must fail.' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SWOT_SESSION_NOT_FOUND');
  });

  it('rolls Candidate back when receipt creation fails after the insert', async () => {
    setFault((stage) => {
      if (stage === 'candidate-created') throw new Error('tls007 injected failure');
    });
    await expect(
      handoffSwotRecommendation({
        organizationId: ORG_A,
        toolSessionId: SESSION,
        recommendationId: 'rec-9',
        actorId: ACTOR,
      })
    ).rejects.toThrow('tls007 injected failure');
    setFault(null);

    const db = await client();
    try {
      const candidates = await db.query(
        `SELECT id FROM initiative_candidates
         WHERE organization_id = $1 AND source_type = 'swot_recommendation' AND source_id = $2`,
        [ORG_A, `${SESSION}:rec-9`]
      );
      const receipts = await db.query(
        `SELECT id FROM swot_candidate_handoffs
         WHERE organization_id = $1 AND tool_session_id = $2 AND recommendation_id = 'rec-9'`,
        [ORG_A, SESSION]
      );
      expect(candidates.rows).toHaveLength(0);
      expect(receipts.rows).toHaveLength(0);
    } finally {
      await db.end();
    }
  });
});
