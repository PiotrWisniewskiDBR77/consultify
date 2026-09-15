/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { publishInitiativeCard } from '../publishInitiativeCard';
import { reviewInitiativeCard } from '../reviewInitiativeCard';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork';

const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/UNASSIGNED');
if (url.hostname !== '127.0.0.1' || url.port !== '6459' || url.pathname !== '/cx8_e0') {
  throw new Error('A1_ASSIGNED_LOCAL_DATABASE_REQUIRED');
}
const pool = new Pool({ connectionString: url.toString(), max: 2 });
const uow = new PostgresMaterialCommandUnitOfWork(pool);
const cleanup: Array<{ organizationId: string; initiativeId: string }> = [];

const envelope = (
  organizationId: string,
  initiativeId: string,
  actorId: string,
  expectedVersion: number,
  commandType: 'initiative.card.publish' | 'initiative.card.review'
) => ({
  organizationId,
  actorId,
  aggregateType: 'initiative',
  aggregateId: initiativeId,
  expectedVersion,
  clientRequestId: randomUUID(),
  correlationId: randomUUID(),
  policyId: 'a1-local-policy',
  policyVersion: 1,
  commandType,
});

afterEach(async () => {
  for (const { organizationId, initiativeId } of cleanup.splice(0)) {
    await pool.query(
      'DELETE FROM ie_initiative_card_versions WHERE organization_id=$1 AND initiative_id=$2',
      [organizationId, initiativeId]
    );
    for (const table of ['ie_command_receipts', 'ie_audit_events', 'ie_outbox_events', 'ie_aggregate_state']) {
      await pool.query(
        `DELETE FROM ${table} WHERE organization_id=$1 AND aggregate_id=$2`,
        [organizationId, initiativeId]
      );
    }
  }
});
afterAll(async () => pool.end());

describe('A-1 canonical initiative card estimate on real PostgreSQL', () => {
  it('keeps the estimate receipt fully null for a card published without an estimate', async () => {
    const organizationId = randomUUID();
    const initiativeId = `a1-no-estimate-${randomUUID()}`;
    const authorId = randomUUID();
    cleanup.push({ organizationId, initiativeId });
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', $2, 1, $3::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: randomUUID(),
          lifecycleState: 'REGISTERED_DRAFT',
        }),
      ]
    );

    await publishInitiativeCard(uow, {
      ...envelope(organizationId, initiativeId, authorId, 1, 'initiative.card.publish'),
      payload: {
        cardKey: 'kpi',
        expectedCardVersion: 0,
        applicability: 'REQUIRED',
        completion: 'COMPLETE',
        quality: 'SUFFICIENT',
        freshness: 'CURRENT',
        reviewState: 'REQUESTED',
        content: { kpiRefs: ['kpi-without-estimate'] },
        evidenceRefs: [],
        waiverDecisionId: null,
      },
    });

    const published = await pool.query(
      `SELECT estimate_text, estimate_basis, estimated_by, estimated_at
         FROM ie_initiative_card_versions
        WHERE organization_id=$1 AND initiative_id=$2 AND card_version=1`,
      [organizationId, initiativeId]
    );
    expect(published.rows[0]).toEqual({
      estimate_text: null,
      estimate_basis: null,
      estimated_by: null,
      estimated_at: null,
    });
  });

  it('persists author/time and carries the same estimate into the independent accepted version', async () => {
    const organizationId = randomUUID();
    const initiativeId = `a1-estimate-${randomUUID()}`;
    const authorId = randomUUID();
    const reviewerId = randomUUID();
    cleanup.push({ organizationId, initiativeId });
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', $2, 1, $3::jsonb)`,
      [organizationId, initiativeId, JSON.stringify({ initiativeId, projectId: randomUUID(), lifecycleState: 'REGISTERED_DRAFT' })]
    );

    await publishInitiativeCard(uow, {
      ...envelope(organizationId, initiativeId, authorId, 1, 'initiative.card.publish'),
      payload: {
        cardKey: 'summary-scope',
        expectedCardVersion: 0,
        applicability: 'REQUIRED',
        completion: 'COMPLETE',
        quality: 'SUFFICIENT',
        freshness: 'CURRENT',
        reviewState: 'REQUESTED',
        content: { problem: 'Measured setup loss', outcome: 'Reduce setup loss' },
        evidenceRefs: ['local:a1-realpg'],
        waiverDecisionId: null,
        estimate: { value: '40–60 h', basis: 'Four workshops and synthesis' },
      },
    });

    const published = await pool.query(
      `SELECT estimate_text, estimate_basis, estimated_by, estimated_at, review_state
         FROM ie_initiative_card_versions
        WHERE organization_id=$1 AND initiative_id=$2 AND card_version=1`,
      [organizationId, initiativeId]
    );
    expect(published.rows[0]).toMatchObject({
      estimate_text: '40–60 h',
      estimate_basis: 'Four workshops and synthesis',
      estimated_by: authorId,
      review_state: 'REQUESTED',
    });
    expect(published.rows[0].estimated_at).toBeInstanceOf(Date);

    await reviewInitiativeCard(uow, {
      ...envelope(organizationId, initiativeId, reviewerId, 2, 'initiative.card.review'),
      payload: {
        cardKey: 'summary-scope',
        expectedCardVersion: 1,
        outcome: 'ACCEPTED',
        rationale: 'Estimate checked against the scope and team',
        selfApprovalAllowed: false,
      },
    });

    const accepted = await pool.query(
      `SELECT estimate_text, estimate_basis, estimated_by, estimated_at, reviewed_by, review_state
         FROM ie_initiative_card_versions
        WHERE organization_id=$1 AND initiative_id=$2 AND card_version=2`,
      [organizationId, initiativeId]
    );
    expect(accepted.rows[0]).toMatchObject({
      estimate_text: '40–60 h',
      estimate_basis: 'Four workshops and synthesis',
      estimated_by: authorId,
      reviewed_by: reviewerId,
      review_state: 'ACCEPTED',
    });
    expect(accepted.rows[0].estimated_at.toISOString()).toBe(
      published.rows[0].estimated_at.toISOString()
    );
  });
});
