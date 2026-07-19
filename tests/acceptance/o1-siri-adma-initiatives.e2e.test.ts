/**
 * O1 · element 8 — Assessment → Initiatives generator, PER FRAMEWORK (SIRI, ADMA).
 * REAL runtime (local Postgres :5443, real AssessmentWorkbenchService, real DB,
 * zero business-logic mocks).
 *
 * CONTEXT / FINDING
 * -----------------
 * The rejestr entry reads "generator inicjatyw z wyniku assessmentu — DRD ma
 * ścieżkę (impact×effort), SIRI/ADMA ⬜". The DRD path proven by h1-chain.e2e is
 * NOT DRD-specific: the H1.3 auto-materializer
 * (AssessmentWorkbenchService.transition → createInitiativesFromAssessmentRecommendations)
 * reads ONLY state.interpretationProposal.nextActions (fallback: keyFindings) and
 * NEVER inspects assessment_type / methodologyId. It is therefore fully
 * framework-agnostic — the exact same completion gate materializes DRAFT
 * initiatives for SIRI and ADMA. This suite is the DOWÓD.
 *
 * The "recommendation source" per framework (SIRI: building-block gaps; ADMA:
 * pillar gaps) is the caller-supplied interpretation proposal — identical
 * mechanism for every framework. Case C below additionally proves the
 * keyFindings fallback source path (nextActions empty → keyFindings drive the
 * initiatives), so a framework that only surfaces findings still generates.
 *
 * Every incidental row carries the reversible `odbior--o1g--` prefix. The probe
 * cleans up after itself (initiatives, links, batches, assessments).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

beforeAll(async () => {
  await seed(); // idempotent
}, 60_000);

/**
 * Build a completion-ready P28 workbench state (runState=interpretation_reviewed,
 * review accepted) with the supplied recommendation shape. Mirrors the DRD
 * fixture in h1-chain.e2e.test.ts exactly, parameterised by framework +
 * recommendation source so the ONLY variable across cases is the framework.
 */
function completionReadyWorkbench(params: {
  assessmentId: string;
  methodologyId: string;
  summary: string;
  keyFindings: string[];
  nextActions: string[];
}) {
  const now = new Date().toISOString();
  return {
    contractVersion: 'p28_workbench_v1',
    assessmentDefinitionRef: {
      definitionId: `odbior--o1g--def-${params.methodologyId}`,
      methodologyId: params.methodologyId,
      version: '1',
      status: 'published',
      readOnly: true,
    },
    assessmentRunId: params.assessmentId,
    orgId: SEED.ORG_ID,
    runState: 'interpretation_reviewed',
    startedBy: SEED.USER_ID,
    startedAt: now,
    evidencePointers: [],
    scoreProposal: null,
    scoreReview: null,
    interpretationProposal: {
      id: `odbior--o1g--interp-${params.methodologyId}`,
      status: 'proposal',
      summary: params.summary,
      keyFindings: params.keyFindings,
      limits: 'Bounded — assessment proposal, wymaga przeglądu przed wdrożeniem.',
      nextActions: params.nextActions,
      linksToScoreProposalId: `odbior--o1g--score-${params.methodologyId}`,
      proposedAt: now,
      proposedBy: SEED.USER_ID,
    },
    interpretationReview: { status: 'accepted', decidedAt: now, decidedBy: SEED.USER_ID },
    promotionTraces: [],
    audit: [],
  };
}

async function seedAssessment(
  assessmentId: string,
  methodologyId: string,
  workbench: unknown
): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO assessments (id, organization_id, assessment_type, name, created_by, p28_workbench_v1)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET p28_workbench_v1 = EXCLUDED.p28_workbench_v1`,
      [
        assessmentId,
        SEED.ORG_ID,
        methodologyId,
        `odbior--o1g-- ${methodologyId} Assessment`,
        SEED.USER_ID,
        JSON.stringify(workbench),
      ]
    );
  } finally {
    await client.end();
  }
}

async function cleanupAssessment(assessmentId: string, createdInitiativeIds: string[]): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM assessment_initiative_links WHERE assessment_id = $1`, [
      assessmentId,
    ]);
    await client.query(`DELETE FROM assessment_initiative_batches WHERE assessment_id = $1`, [
      assessmentId,
    ]);
    if (createdInitiativeIds.length) {
      await client.query(`DELETE FROM initiatives WHERE id = ANY($1)`, [createdInitiativeIds]);
    }
    await client.query(`DELETE FROM assessments WHERE id = $1`, [assessmentId]);
  } finally {
    await client.end();
  }
}

/** Assert the completion produced N DRAFT, back-referenced, linked initiatives. */
async function assertMaterialized(
  assessmentId: string,
  expectedTitles: string[],
  sink: string[]
): Promise<void> {
  const verify = pgClient();
  await verify.connect();
  try {
    const { rows } = await verify.query(
      `SELECT i.id, i.name, i.status, i.source_type, i.source_id, i.source_assessment_id, i.created_from
       FROM initiatives i
       JOIN assessment_initiative_links l ON l.initiative_id = i.id
       WHERE l.assessment_id = $1
       ORDER BY i.created_at ASC`,
      [assessmentId]
    );
    for (const r of rows) sink.push(r.id);

    expect(rows.length).toBe(expectedTitles.length);
    for (const r of rows) {
      expect(String(r.status).toUpperCase()).toBe('DRAFT');
      expect(r.source_type).toBe('assessment');
      expect(r.source_id).toBe(assessmentId);
      expect(r.created_from).toBe('assessment');
    }
    const titles = rows.map((r) => r.name);
    for (const t of expectedTitles) expect(titles).toContain(t.slice(0, 200));

    const { rows: batchRows } = await verify.query(
      `SELECT initiatives_count FROM assessment_initiative_batches WHERE assessment_id = $1`,
      [assessmentId]
    );
    expect(batchRows).toHaveLength(1);
    expect(Number(batchRows[0].initiatives_count)).toBe(expectedTitles.length);
  } finally {
    await verify.end();
  }
}

// ---------------------------------------------------------------------------
// Case A — SIRI completion auto-creates initiatives from building-block gaps.
// ---------------------------------------------------------------------------
describe('O1.8 — SIRI assessment completion auto-creates DRAFT initiatives (real runtime)', () => {
  const assessmentId = `odbior--o1g--siri-${Date.now()}`;
  const createdInitiativeIds: string[] = [];
  // Recommendation source = building-block gap → action (SIRI: Operations/
  // Supply-chain dimensions, gap = target − current).
  const rec1 = `odbior--o1g-- Podnieś automatyzację operacji z poziomu 1 do 3 ${Date.now()}`;
  const rec2 = `odbior--o1g-- Zintegruj łańcuch dostaw (connectivity 1→3) ${Date.now()}`;

  afterAll(() => cleanupAssessment(assessmentId, createdInitiativeIds));

  it('materializes DRAFT initiatives from SIRI recommendations, linked + back-referenced', async () => {
    await seedAssessment(
      assessmentId,
      'SIRI',
      completionReadyWorkbench({
        assessmentId,
        methodologyId: 'SIRI',
        summary: 'Dojrzałość Industry 4.0 poniżej celu w wymiarach Operations i Supply Chain.',
        keyFindings: ['Operations 1/5 vs cel 3/5', 'Connectivity 1/5 vs cel 3/5'],
        nextActions: [rec1, rec2],
      })
    );

    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    const state = await AssessmentWorkbenchService.transition(
      assessmentId,
      SEED.ORG_ID,
      SEED.USER_ID,
      'completed'
    );
    expect(state.runState).toBe('completed');
    expect(
      state.audit.some((a: { action: string }) => a.action === 'initiatives_auto_created')
    ).toBe(true);

    await assertMaterialized(assessmentId, [rec1, rec2], createdInitiativeIds);
  }, 45_000);

  it('is idempotent — re-completing a SIRI run does not double-create', async () => {
    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    await expect(
      AssessmentWorkbenchService.transition(assessmentId, SEED.ORG_ID, SEED.USER_ID, 'completed')
    ).rejects.toBeTruthy();

    const verify = pgClient();
    await verify.connect();
    try {
      const { rows } = await verify.query(
        `SELECT COUNT(*)::int AS n FROM assessment_initiative_links WHERE assessment_id = $1`,
        [assessmentId]
      );
      expect(rows[0].n).toBe(2);
    } finally {
      await verify.end();
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Case B — ADMA completion auto-creates initiatives from pillar gaps.
// ---------------------------------------------------------------------------
describe('O1.8 — ADMA assessment completion auto-creates DRAFT initiatives (real runtime)', () => {
  const assessmentId = `odbior--o1g--adma-${Date.now()}`;
  const createdInitiativeIds: string[] = [];
  // Recommendation source = pillar gap → action (ADMA: advanced_manufacturing /
  // operational_excellence pillars, gap = target − current).
  const rec1 = `odbior--o1g-- Wdroż zaawansowaną produkcję (pillar 2→4) ${Date.now()}`;
  const rec2 = `odbior--o1g-- Program doskonałości operacyjnej (pillar 1→3) ${Date.now()}`;
  const rec3 = `odbior--o1g-- Podnieś dojrzałość cyfrową (pillar 2→4) ${Date.now()}`;

  afterAll(() => cleanupAssessment(assessmentId, createdInitiativeIds));

  it('materializes DRAFT initiatives from ADMA recommendations, linked + back-referenced', async () => {
    await seedAssessment(
      assessmentId,
      'ADMA',
      completionReadyWorkbench({
        assessmentId,
        methodologyId: 'ADMA',
        summary: 'Luki dojrzałości w filarach zaawansowanej produkcji i doskonałości operacyjnej.',
        keyFindings: ['Advanced manufacturing 2/5 vs cel 4/5'],
        nextActions: [rec1, rec2, rec3],
      })
    );

    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    const state = await AssessmentWorkbenchService.transition(
      assessmentId,
      SEED.ORG_ID,
      SEED.USER_ID,
      'completed'
    );
    expect(state.runState).toBe('completed');
    expect(
      state.audit.some((a: { action: string }) => a.action === 'initiatives_auto_created')
    ).toBe(true);

    await assertMaterialized(assessmentId, [rec1, rec2, rec3], createdInitiativeIds);
  }, 45_000);
});

// ---------------------------------------------------------------------------
// Case C — recommendation-source fallback: nextActions empty → keyFindings drive
// the initiatives (proves the source is framework-agnostic AND resilient when a
// framework surfaces findings but no explicit next actions).
// ---------------------------------------------------------------------------
describe('O1.8 — keyFindings fallback source materializes initiatives (real runtime)', () => {
  const assessmentId = `odbior--o1g--adma-kf-${Date.now()}`;
  const createdInitiativeIds: string[] = [];
  const finding1 = `odbior--o1g-- Braki w integracji danych produkcyjnych ${Date.now()}`;
  const finding2 = `odbior--o1g-- Niska automatyzacja kontroli jakości ${Date.now()}`;

  afterAll(() => cleanupAssessment(assessmentId, createdInitiativeIds));

  it('uses keyFindings when nextActions is empty', async () => {
    await seedAssessment(
      assessmentId,
      'ADMA',
      completionReadyWorkbench({
        assessmentId,
        methodologyId: 'ADMA',
        summary: 'Wnioski bez jawnych działań następczych.',
        keyFindings: [finding1, finding2],
        nextActions: [], // empty → materializer falls back to keyFindings
      })
    );

    const { default: AssessmentWorkbenchService } = await import(
      '../../server/src/services/assessment/AssessmentWorkbenchService.js'
    );
    const state = await AssessmentWorkbenchService.transition(
      assessmentId,
      SEED.ORG_ID,
      SEED.USER_ID,
      'completed'
    );
    expect(state.runState).toBe('completed');

    await assertMaterialized(assessmentId, [finding1, finding2], createdInitiativeIds);
  }, 45_000);
});
