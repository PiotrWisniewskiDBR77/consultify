import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  aiInputHash,
  createAIAnalysisProposal,
  reviewAIAnalysisProposal,
} from '../../../server/src/domain/initiatives-execution/aiEvidenceGovernance';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('AI Evidence Governance realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-aco17',
    initiativeId = 'initiative-aco17',
    cardKey = 'summary-scope',
    sourceId = 'source-aco17';
  const env = (
    id: string,
    actor: string,
    v: number,
    key: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: 'ai_analysis_proposal',
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'ai-evidence',
    policyVersion: 1,
    commandType: create ? 'ai-analysis.create' : 'ai-analysis.review',
    createIfMissing: create,
    payload,
  });
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ie_initiative_card_versions WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,5,$3::jsonb),($1,'analysis_source',$4,2,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'ANALYZING' }),
        sourceId,
        JSON.stringify({ facts: ['fact-1'] }),
      ]
    );
    await pool.query(
      `INSERT INTO ie_initiative_card_versions(organization_id,initiative_id,card_key,card_version,aggregate_version,applicability,completion,quality,freshness,review_state,content_json,evidence_refs_json,published_by)VALUES($1,$2,$3,1,5,'REQUIRED','IN_PROGRESS','WARNING','CURRENT','NOT_REQUESTED',$4::jsonb,'[]'::jsonb,'human')`,
      [org, initiativeId, cardKey, JSON.stringify({ summary: 'Original human truth' })]
    );
  });
  afterAll(async () => pool.end());
  const draft = {
    initiativeId,
    initiativeVersion: 5,
    cardKey,
    cardVersion: 1,
    sourceRef: { aggregateType: 'analysis_source', aggregateId: sourceId, version: 2 },
    model: { provider: 'openai', model: 'gpt-x', version: '2026-08' },
    prompt: { promptId: 'analysis', version: 4 },
    template: { templateId: 'summary', version: 3 },
    inputHash: aiInputHash({ sourceId, version: 2 }),
    output: { summary: 'AI suggested truth', assumption: 'Needs review' },
    evidenceRefs: [{ ref: 'evidence:1', version: 1 }],
    counterEvidenceRefs: [{ ref: 'counter:1', version: 1 }],
    confidence: 'MEDIUM' as const,
    requestedBy: 'requester',
    authorizedReviewerId: 'reviewer',
  };
  it('keeps rejected output outside truth and publishes only human-edited fragment with lineage', async () => {
    await createAIAnalysisProposal(
      uow,
      env('reject-proposal', 'requester', 0, 'reject-create', draft, true)
    );
    expect(await reader.listMyAIAnalysisReviews(org, 'reviewer')).toHaveLength(1);
    await reviewAIAnalysisProposal(
      uow,
      env('reject-proposal', 'reviewer', 1, 'reject-review', {
        outcome: 'REJECT',
        rationale: 'Unsupported assumption',
        editedFragment: null,
      })
    );
    let cards = await pool.query(
      `SELECT card_version,content_json FROM ie_initiative_card_versions WHERE organization_id=$1 AND initiative_id=$2 AND card_key=$3 ORDER BY card_version`,
      [org, initiativeId, cardKey]
    );
    expect(cards.rows).toHaveLength(1);
    expect(cards.rows[0].content_json.summary).toBe('Original human truth');
    await createAIAnalysisProposal(
      uow,
      env('edit-proposal', 'requester', 0, 'edit-create', draft, true)
    );
    const payload = {
      outcome: 'EDIT' as const,
      rationale: 'Accepted after correction',
      editedFragment: { summary: 'Human corrected truth' },
    };
    const edited = await reviewAIAnalysisProposal(
        uow,
        env('edit-proposal', 'reviewer', 1, 'edit-review', payload)
      ),
      replay = await reviewAIAnalysisProposal(
        uow,
        env('edit-proposal', 'reviewer', 1, 'edit-review', payload)
      );
    expect(replay.status).toBe('REPLAYED');
    expect((edited.response as any).publishedCardVersion).toBe(2);
    cards = await pool.query(
      `SELECT card_version,content_json FROM ie_initiative_card_versions WHERE organization_id=$1 AND initiative_id=$2 AND card_key=$3 ORDER BY card_version`,
      [org, initiativeId, cardKey]
    );
    expect(cards.rows).toHaveLength(2);
    expect(cards.rows[0].content_json.summary).toBe('Original human truth');
    expect(cards.rows[1].content_json).toMatchObject({
      summary: 'Human corrected truth',
      _aiLineage: { proposalId: 'edit-proposal', outcome: 'EDIT', reviewerId: 'reviewer' },
    });
    expect(cards.rows[1].content_json.assumption).toBeUndefined();
    expect(await reader.listAIAnalysisProposals('foreign')).toEqual([]);
    await expect(
      createAIAnalysisProposal(uow, env('stale', 'requester', 0, 'stale-create', draft, true))
    ).rejects.toThrow('Stale Initiative Card');
  });
});
