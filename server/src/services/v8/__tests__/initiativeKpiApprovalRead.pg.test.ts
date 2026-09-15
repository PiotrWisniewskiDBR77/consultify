/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { PostgresMaterialCommandUnitOfWork } from '../../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { publishInitiativeCard } from '../../../domain/initiatives-execution/publishInitiativeCard';
import { reviewInitiativeCard } from '../../../domain/initiatives-execution/reviewInitiativeCard';
import { getInitiativeKpisRead } from '../planningPortfolioReadService';

const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/UNASSIGNED');
if (url.hostname !== '127.0.0.1' || url.port !== '6459' || url.pathname !== '/cx8_e0') {
  throw new Error('A2_ASSIGNED_LOCAL_DATABASE_REQUIRED');
}

const pool = new Pool({ connectionString: url.toString(), max: 2 });
const uow = new PostgresMaterialCommandUnitOfWork(pool);
const cleanup: Array<{ organizationId: string; initiativeId: string; kpiId: string }> = [];

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
  policyId: 'a2-local-policy',
  policyVersion: 1,
  commandType,
});

afterEach(async () => {
  for (const { organizationId, initiativeId, kpiId } of cleanup.splice(0)) {
    await pool.query(
      'DELETE FROM ie_initiative_card_versions WHERE organization_id=$1 AND initiative_id=$2',
      [organizationId, initiativeId]
    );
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1 AND aggregate_id=$2`, [
        organizationId,
        initiativeId,
      ]);
    }
    await pool.query('DELETE FROM initiative_kpi_mappings WHERE kpi_id=$1', [kpiId]);
    await pool.query('DELETE FROM initiative_kpis WHERE id=$1', [kpiId]);
    await pool.query('DELETE FROM initiatives WHERE id=$1 AND organization_id=$2', [
      initiativeId,
      organizationId,
    ]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
  }
});

afterAll(async () => pool.end());

describe('A-2 approved KPI visibility in Execution on real PostgreSQL', () => {
  it('changes the same canonical KPI from pending to approved-for-execution after independent ACCEPT', async () => {
    const organizationId = randomUUID();
    const initiativeId = `a2-kpi-${randomUUID()}`;
    const kpiId = randomUUID();
    const authorId = randomUUID();
    const reviewerId = randomUUID();
    cleanup.push({ organizationId, initiativeId, kpiId });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,'A2 local proof')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, name, title, status)
       VALUES ($1,$2,'A2 KPI proof','A2 KPI proof','DRAFT')`,
      [initiativeId, organizationId]
    );
    await pool.query(
      `INSERT INTO initiative_kpis
        (id, initiative_id, organization_id, name, unit, baseline_value, target_value,
         current_value, measurement_frequency, archived_at)
       VALUES ($1,$2,$3,'Cycle time','days',10,6,9,'WEEKLY',NULL)`,
      [kpiId, initiativeId, organizationId]
    );
    await pool.query(
      `INSERT INTO initiative_kpi_mappings
        (id, initiative_id, kpi_id, organization_id, definition_source,
         observation_phase, tracked_in_realization, tracked_post_implementation)
       VALUES ($1,$2,$3,$4,'initiative-custom','realization',1,0)`,
      [randomUUID(), initiativeId, kpiId, organizationId]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1,'initiative',$2,1,$3::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify({ initiativeId, projectId: randomUUID(), lifecycleState: 'REGISTERED_DRAFT' }),
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
        content: {
          kpiRefs: [kpiId],
          measurementPlan: [{ kpiId, cadence: 'WEEKLY', realizationTarget: '6' }],
          challenge: 'Independent challenge required',
          counterEvidence: 'Baseline source checked',
          acceptedHumanTruth: 'Only accepted snapshot enters execution',
        },
        evidenceRefs: [`initiative-kpi:${kpiId}`],
        waiverDecisionId: null,
      },
    });

    const pending = await getInitiativeKpisRead(initiativeId, organizationId);
    expect(pending).toHaveLength(1);
    expect(pending?.[0]).toMatchObject({
      id: kpiId,
      approvedForExecution: false,
      approvalReceipt: { state: 'REQUESTED', cardVersion: 1 },
    });

    await reviewInitiativeCard(uow, {
      ...envelope(organizationId, initiativeId, reviewerId, 2, 'initiative.card.review'),
      payload: {
        cardKey: 'kpi',
        expectedCardVersion: 1,
        outcome: 'ACCEPTED',
        rationale: 'Target and cadence checked against the operating baseline',
        selfApprovalAllowed: false,
      },
    });

    const accepted = await getInitiativeKpisRead(initiativeId, organizationId);
    expect(accepted).toHaveLength(1);
    expect(accepted?.[0]).toMatchObject({
      id: kpiId,
      name: 'Cycle time',
      trackedInRealization: true,
      approvedForExecution: true,
      approvalReceipt: {
        state: 'ACCEPTED',
        cardVersion: 2,
        reviewedBy: reviewerId,
        publishedBy: authorId,
      },
    });
  });
});
