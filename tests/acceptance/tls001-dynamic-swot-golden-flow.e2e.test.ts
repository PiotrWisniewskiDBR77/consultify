/**
 * TLS-001 — one executable Dynamic SWOT MVP golden flow on real PostgreSQL.
 *
 * This intentionally composes the current production router/controller/services
 * instead of introducing another SWOT implementation. It proves one source
 * session through CAS, governance, immutable Output, report, presentation and
 * Initiative promotion, including tenant isolation and replay/race cardinality.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';
import { SEED, seed } from './seed.mjs';

process.env.DB_TYPE = 'postgres';
process.env.INITIATIVE_FUNNEL_ENABLED = 'false';

const PREFIX = `tls001-${Date.now()}-`;
const ORG_B = `${PREFIX}org-b`;
const USER_B = `${PREFIX}user-b`;
const EMAIL_B = `${PREFIX}owner-b@example.test`;

let app: Express;
let tokenA: string;
let tokenB: string;
let sessionId = '';

const answers = {
  items: [
    {
      id: 's1',
      text: 'Silny zespół wdrożeniowy z udokumentowaną retencją klientów',
      quadrant: 'strengths',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 'o1',
      text: 'Rosnący popyt na automatyzację w regionie DACH',
      quadrant: 'opportunities',
      impact: 'high',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 'w1',
      text: 'Ręczne raportowanie ogranicza skalowanie wdrożeń',
      quadrant: 'weaknesses',
      impact: 'medium',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
    {
      id: 't1',
      text: 'Konkurenci obniżają ceny kosztem jakości wdrożenia',
      quadrant: 'threats',
      impact: 'medium',
      proposalStatus: 'accepted',
      evidenceStatus: 'confirmed',
    },
  ],
  tensions: [
    {
      id: 'tn1',
      title: 'Skalowanie DACH kontra ręczne raportowanie',
      type: 'attack',
      linkedItemIds: ['o1', 'w1'],
      linkedCorrelationIds: [],
      insight: 'Wzrost wymaga automatyzacji raportowania przed ekspansją.',
    },
  ],
  recommendedMoves: [
    {
      id: 'm1',
      title: 'Uruchomić pilota automatyzacji raportowania dla DACH',
      category: 'quick-win',
      rationale: 'Usuwa ograniczenie skalowania przy wykorzystaniu silnego zespołu.',
      linkedTensionIds: ['tn1'],
      linkedItemIds: ['s1', 'o1', 'w1'],
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      firstStep: 'Wybrać klienta pilotażowego i właściciela wyniku.',
      ownerRole: 'Dyrektor operacyjny',
      tradeoff: {
        chosen: 'Automatyzacja raportowania',
        deferred: 'Ekspansja na drugi region',
        cost: 'Przesunięcie ekspansji o jeden kwartał',
      },
      rejectedAlternative: {
        option: 'Zwiększyć zatrudnienie analityków',
        reason: 'Nie usuwa systemowego ograniczenia skalowania',
      },
    },
  ],
  summary: {
    verdict: 'Automatyzować raportowanie przed skalowaniem DACH.',
    executiveSummary:
      'Silny zespół może wykorzystać popyt DACH po usunięciu ręcznego raportowania.',
    tradeoffs: ['Ekspansja do drugiego regionu zostaje przesunięta o kwartał.'],
  },
};

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = pgClient();
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  requireLocalDbUrl();
  await seed();

  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1,$2,'enterprise','active',1,$3)`,
      [ORG_B, `${PREFIX}Tenant B`, now]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1,$2,$3,'not-used','ADMIN','active','TLS001','TenantB',$4)`,
      [USER_B, ORG_B, EMAIL_B, now]
    );
    await client.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,'OWNER','ACTIVE',$4)`,
      [`${PREFIX}membership-b`, ORG_B, USER_B, now]
    );
  } finally {
    await client.end();
  }

  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/tools', toolsRouter);

  tokenA = mintToken();
  tokenB = mintToken({
    id: USER_B,
    email: EMAIL_B,
    organizationId: ORG_B,
    organization_id: ORG_B,
    role: 'OWNER',
  });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client
      .query(
        `DELETE FROM v8_output_artifacts WHERE organization_id = $1 AND artifact_id IN
           (SELECT artifact_id FROM v8_artifact_origin_links
            WHERE organization_id = $1 AND origin_record_id IN
              (SELECT initiative_id FROM tool_initiative_links WHERE tool_session_id = $2))`,
        [SEED.ORG_ID, sessionId]
      )
      .catch(() => undefined);
    await client
      .query(
        `DELETE FROM v8_artifact_origin_links WHERE organization_id = $1 AND origin_record_id IN
           (SELECT initiative_id FROM tool_initiative_links WHERE tool_session_id = $2)`,
        [SEED.ORG_ID, sessionId]
      )
      .catch(() => undefined);
    await client.query(
      `DELETE FROM presentation_cards WHERE deck_id IN
         (SELECT id FROM presentation_decks WHERE source_id = $1)`,
      [sessionId]
    );
    await client.query(`DELETE FROM presentation_decks WHERE source_id = $1`, [sessionId]);
    await client.query(
      `DELETE FROM report_builder_sections WHERE report_id IN
         (SELECT id FROM report_builder_reports WHERE source_type = 'TOOL' AND source_id = $1)`,
      [sessionId]
    );
    await client.query(
      `DELETE FROM report_builder_reports WHERE source_type = 'TOOL' AND source_id = $1`,
      [sessionId]
    );
    await client.query(
      `DELETE FROM tool_output_initiative_proposals WHERE tool_output_id IN
         (SELECT id FROM tool_outputs WHERE tool_session_id = $1)`,
      [sessionId]
    );
    await client.query(
      `DELETE FROM tool_report_sources WHERE tool_output_id IN
         (SELECT id FROM tool_outputs WHERE tool_session_id = $1)`,
      [sessionId]
    );
    await client.query(
      `DELETE FROM tool_reports WHERE id NOT IN (SELECT tool_report_id FROM tool_report_sources) AND organization_id = $1`,
      [SEED.ORG_ID]
    );
    await client.query(
      `DELETE FROM tool_output_approvals WHERE tool_output_id IN (SELECT id FROM tool_outputs WHERE tool_session_id = $1)`,
      [sessionId]
    );
    await client.query(`DELETE FROM tool_session_events WHERE tool_session_id = $1`, [sessionId]);
    await client.query(`DELETE FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
    await client.query(`DELETE FROM initiatives WHERE source_type = 'tool' AND source_id = $1`, [
      sessionId,
    ]);
    await client.query(`DELETE FROM tool_initiative_links WHERE tool_session_id = $1`, [sessionId]);
    await client.query(`DELETE FROM tool_decisions WHERE tool_session_id = $1`, [sessionId]);
    await client.query(`DELETE FROM audit_log WHERE resource_id = $1`, [sessionId]);
    await client
      .query(`DELETE FROM conclusions WHERE source_id = $1`, [sessionId])
      .catch(() => undefined);
    await client.query(`DELETE FROM tool_sessions WHERE id = $1`, [sessionId]);
    await client
      .query(`DELETE FROM decisions WHERE title LIKE $1`, [`%${PREFIX}%`])
      .catch(() => undefined);
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_B]);
    await client.query(`DELETE FROM users WHERE id = $1`, [USER_B]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_B]);
  } finally {
    await client.end();
  }
}, 60_000);

describe('TLS-001 Dynamic SWOT golden flow', () => {
  it('creates, reopens, governs and promotes one immutable source into all MVP outputs', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toolType: 'dynamic-swot', name: `${PREFIX}Golden SWOT` });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    sessionId = created.body.id;
    expect(created.body.version).toBe(1);

    const prematurePromotion = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ outputType: 'initiative', title: `${PREFIX}premature` });
    expect(prematurePromotion.status).toBe(409);

    const saved = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        status: 'IN_PROGRESS',
        completionPercent: 100,
        confidenceAvg: 4.5,
        missingItems: [],
        answers,
        expectedVersion: 1,
      });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.version).toBe(2);

    const reopened = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(reopened.status).toBe(200);
    expect(reopened.body.answers.recommendedMoves[0].id).toBe('m1');

    const stale = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ completionPercent: 99, expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');

    const foreignRead = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(foreignRead.status).toBe(404);

    const firstReview = await request(app)
      .post(`/api/tools/${sessionId}/request-review`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ priority: 'high' });
    expect(firstReview.status, JSON.stringify(firstReview.body)).toBe(200);
    expect(firstReview.body.status).toBe('REVIEW');

    const sentBack = await request(app)
      .post(`/api/tools/${sessionId}/send-back`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ comment: 'Doprecyzować właściciela pierwszego kroku.' });
    expect(sentBack.status, JSON.stringify(sentBack.body)).toBe(200);
    expect(sentBack.body.status).toBe('DRAFT');

    const secondReview = await request(app)
      .post(`/api/tools/${sessionId}/request-review`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ priority: 'high' });
    expect(secondReview.status, JSON.stringify(secondReview.body)).toBe(200);

    const approved = await request(app)
      .post(`/api/tools/${sessionId}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    const reportTitle = `${PREFIX}SWOT report`;
    const report = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ outputType: 'report', title: reportTitle, idempotencyKey: 'tls001-report' });
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body.id).toBeTruthy();

    const presentationTitle = `${PREFIX}SWOT deck`;
    const presentation = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        outputType: 'presentation',
        title: presentationTitle,
        idempotencyKey: 'tls001-presentation',
      });
    expect(presentation.status, JSON.stringify(presentation.body)).toBe(200);

    const initiativeTitle = `${PREFIX}SWOT initiative`;
    const initiativeAttempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app)
          .post(`/api/tools/${sessionId}/promote`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({
            outputType: 'initiative',
            title: initiativeTitle,
            idempotencyKey: 'tls001-initiative',
          })
      )
    );
    expect(initiativeAttempts.every((result) => result.status === 200)).toBe(true);
    expect(new Set(initiativeAttempts.map((result) => result.body.id)).size).toBe(1);
    const initiativeId = initiativeAttempts[0].body.id;

    const reportRetry = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ outputType: 'report', title: reportTitle, idempotencyKey: 'tls001-report' });
    expect(reportRetry.body).toMatchObject({ id: report.body.id, deduplicated: true });

    const presentationRetry = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        outputType: 'presentation',
        title: presentationTitle,
        idempotencyKey: 'tls001-presentation',
      });
    expect(presentationRetry.body).toMatchObject({
      id: presentation.body.id,
      deduplicated: true,
    });

    const outputRows = await query<{
      id: string;
      payload_json: Record<string, unknown>;
      content_hash: string;
      frozen_at: string;
    }>(
      `SELECT id, payload_json, content_hash, frozen_at FROM tool_outputs
       WHERE organization_id = $1 AND tool_session_id = $2`,
      [SEED.ORG_ID, sessionId]
    );
    expect(outputRows).toHaveLength(1);
    expect(outputRows[0].content_hash).toBeTruthy();
    expect(outputRows[0].frozen_at).toBeTruthy();
    expect((outputRows[0].payload_json as any).items.length).toBeGreaterThan(0);
    expect((outputRows[0].payload_json as any).conclusions.length).toBeGreaterThan(0);

    const reportSections = await query<{ generated_content: string }>(
      `SELECT generated_content FROM report_builder_sections WHERE report_id = $1`,
      [report.body.id]
    );
    expect(reportSections.length).toBeGreaterThan(0);
    expect(reportSections.some((row) => String(row.generated_content || '').length > 20)).toBe(
      true
    );

    const deckRows = await query<{ id: string; slide_count: number; deck_json: unknown }>(
      `SELECT id, slide_count, deck_json FROM presentation_decks
       WHERE id = $1 AND organization_id = $2`,
      [presentation.body.id, SEED.ORG_ID]
    );
    expect(deckRows).toHaveLength(1);
    expect(Number(deckRows[0].slide_count)).toBeGreaterThan(0);
    expect(deckRows[0].deck_json).toBeTruthy();

    const artifactRows = await query<{ artifact_id: string }>(
      `SELECT a.artifact_id FROM v8_output_artifacts a
       JOIN v8_artifact_origin_links l
         ON l.artifact_id = a.artifact_id AND l.organization_id = a.organization_id
       WHERE a.organization_id = $1 AND l.origin_record_id = $2
         AND l.origin_runtime = 'presentation'`,
      [SEED.ORG_ID, presentation.body.id]
    );
    expect(artifactRows).toHaveLength(1);

    const initiatives = await query<{ id: string }>(
      `SELECT id FROM initiatives
       WHERE organization_id = $1 AND source_type = 'tool' AND source_id = $2 AND name = $3`,
      [SEED.ORG_ID, sessionId, initiativeTitle]
    );
    expect(initiatives).toEqual([{ id: initiativeId }]);

    const initiativeLedger = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tool_initiative_links
       WHERE organization_id = $1 AND tool_session_id = $2
         AND output_type = 'initiative' AND idempotency_key = 'tls001-initiative'`,
      [SEED.ORG_ID, sessionId]
    );
    expect(Number(initiativeLedger[0].count)).toBe(1);

    const foreignPromotion = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ outputType: 'initiative', title: `${PREFIX}foreign` });
    expect(foreignPromotion.status).toBe(404);

    const immutableEdit = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: { ...answers, items: [] }, expectedVersion: 2 });
    expect(immutableEdit.status).toBe(409);
  }, 120_000);
});
