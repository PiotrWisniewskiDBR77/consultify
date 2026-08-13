import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ANALYSIS_CARD_KEYS } from '../../../server/src/domain/initiatives-execution/analysisReadiness';
import {
  decideAnalysis,
  requestAnalysisDecision,
  startAnalysis,
} from '../../../server/src/domain/initiatives-execution/analysisDecision';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Analysis Gate realDB', () => {
  const pool = new Pool({ connectionString: url, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const id = 'analysis-gate-ie041c';
  const env = (
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: any
  ) => ({
    organizationId: 'org-analysis',
    actorId,
    aggregateType: 'initiative',
    aggregateId: id,
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: 'standard-industrial',
    policyVersion: 3,
    commandType,
    payload,
  });
  beforeAll(async () => {
    for (const name of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', name), 'utf8'));
  });
  beforeEach(async () => {
    await pool.query(
      "DELETE FROM ie_aggregate_relations WHERE organization_id='org-analysis'; DELETE FROM ie_command_receipts WHERE organization_id='org-analysis'; DELETE FROM ie_audit_events WHERE organization_id='org-analysis'; DELETE FROM ie_outbox_events WHERE organization_id='org-analysis'; DELETE FROM ie_initiative_card_versions WHERE organization_id='org-analysis'; DELETE FROM ie_aggregate_state WHERE organization_id='org-analysis'"
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES('org-analysis','initiative',$1,1,$2::jsonb)`,
      [
        id,
        JSON.stringify({
          initiativeId: id,
          projectId: 'p1',
          lifecycleState: 'DEFINED',
          cardRefs: {},
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  it('moves only DEFINED to ANALYZING, snapshots reviewed truth, and independent authority approves READY_FOR_DECISION', async () => {
    await startAnalysis(uow, env('owner', 1, 'start-1', 'initiative.analysis.start', {}));
    for (const [i, key] of ANALYSIS_CARD_KEYS.entries()) {
      const values: any = {
        options: { doNothing: 'Continue', alternatives: ['SMED'], recommendedOption: 'SMED' },
        'financial-analysis': { financeRef: 'finance:1', scenarioVersion: 1 },
        kpi: { kpiRefs: ['kpi:1'], measurementPlan: 'Weekly' },
        'resources-capacity': { capacityEstimate: 2, confidence: 'MEDIUM' },
        dependencies: { dependencies: ['d1'] },
        'risk-raid': { risks: ['r1'], accountableOwners: ['o1'] },
        'technical-specification': { technicalAssessment: 'Viable' },
        'change-adoption': { changeImpact: 'Training' },
        stakeholders: { ownerId: 'o1', sponsorId: 's1' },
        'feasibility-completeness': { feasibilityConclusion: 'Feasible' },
      };
      await pool.query(
        `INSERT INTO ie_initiative_card_versions(organization_id,initiative_id,card_key,card_version,aggregate_version,applicability,completion,quality,freshness,review_state,content_json,evidence_refs_json,published_by,published_at) VALUES('org-analysis',$1,$2,1,2,'REQUIRED','COMPLETE','SUFFICIENT','CURRENT','ACCEPTED',$3::jsonb,$4::jsonb,'analyst',NOW())`,
        [
          id,
          key,
          JSON.stringify({
            ...values[key],
            challenge: 'Falsifier?',
            counterEvidence: ['counter:1'],
            acceptedHumanTruth: 'Accepted by reviewer',
          }),
          JSON.stringify([`evidence:${key}`]),
        ]
      );
    }
    const requested = await requestAnalysisDecision(
      uow,
      env('owner', 2, 'request-1', 'initiative.analysis.request', {
        decisionId: 'analysis-decision-1',
        authorityId: 'authority',
        dueAt: '2026-08-20T12:00:00Z',
        selfApprovalAllowed: false,
      })
    );
    expect(requested.response.cardVersions).toEqual(
      Object.fromEntries(ANALYSIS_CARD_KEYS.map((k) => [k, 1]))
    );
    const replay = await requestAnalysisDecision(
      uow,
      env('owner', 2, 'request-1', 'initiative.analysis.request', {
        decisionId: 'analysis-decision-1',
        authorityId: 'authority',
        dueAt: '2026-08-20T12:00:00Z',
        selfApprovalAllowed: false,
      })
    );
    expect(replay.status).toBe('REPLAYED');
    await expect(
      decideAnalysis(
        uow,
        env('owner', 3, 'approve-self', 'initiative.analysis.decide', {
          decisionId: 'analysis-decision-1',
          outcome: 'APPROVED',
          rationale: 'approve',
          selfApprovalAllowed: false,
        })
      )
    ).rejects.toThrow();
    await decideAnalysis(
      uow,
      env('authority', 3, 'approve-1', 'initiative.analysis.decide', {
        decisionId: 'analysis-decision-1',
        outcome: 'APPROVED',
        rationale: 'Evidence accepted',
        selfApprovalAllowed: false,
      })
    );
    const row = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id='org-analysis' AND aggregate_type='initiative' AND aggregate_id=$1`,
      [id]
    );
    expect(row.rows[0].payload_json.lifecycleState).toBe('READY_FOR_DECISION');
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM ie_audit_events WHERE organization_id='org-analysis'`
        )
      ).rows[0].n
    ).toBe(3);
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM ie_outbox_events WHERE organization_id='org-analysis'`
        )
      ).rows[0].n
    ).toBe(3);
  });
});
