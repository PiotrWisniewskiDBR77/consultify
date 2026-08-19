/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';

const run = process.env.RUN_DB_TESTS === '1' && process.env.DATABASE_URL ? describe : describe.skip;

run('Portfolio gate exact cold readback (real PostgreSQL)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = `ini-portfolio-${randomUUID()}`;
  const foreignOrganizationId = `ini-portfolio-foreign-${randomUUID()}`;
  const initiativeId = `initiative-${randomUUID()}`;
  const decisionId = `decision-${randomUUID()}`;

  beforeAll(async () => {
    const initiative = {
      initiativeId,
      lifecycleState: 'READY_FOR_DECISION',
      title: 'Canonical initiative',
      problem: 'Portfolio prioritization',
      proposedOutcome: 'Approved backlog',
      projectId: 'project-portfolio',
      visibility: 'PROJECT',
      initiativeOwnerId: 'owner-1',
      source: {
        proposalId: 'proposal-1',
        proposalVersion: 2,
        sourceType: 'candidate',
        sourceId: 'candidate-1',
        sourceVersion: 1,
        freshness: 'CURRENT',
        refreshedAt: '2026-08-19T12:00:00.000Z',
      },
      governance: { policyId: 'policy-1', policyVersion: 3 },
      readiness: 'NOT_EVALUATED',
      portfolioDecisionId: decisionId,
    };
    const decision = {
      decisionId,
      initiativeId,
      status: 'PENDING',
      requesterId: 'owner-1',
      authorityId: 'board-1',
      scenarioId: 'portfolio-q4',
      scenarioVersion: 2,
      initiativeVersion: 7,
      cardVersions: {},
      membershipSnapshot: { initiativeId, initiativeVersion: 7 },
      conditions: [],
      mergeTargetInitiativeId: null,
      rationale: null,
      requestedAt: '2026-08-19T12:00:00.000Z',
      dueAt: '2026-08-20T12:00:00.000Z',
      decidedAt: null,
      policy: { policyId: 'policy-1', policyVersion: 3 },
    };
    await pool.query(
      `INSERT INTO ie_aggregate_state
         (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ($1, 'initiative', $2, 8, $3::jsonb),
              ($1, 'decision', $4, 1, $5::jsonb)`,
      [organizationId, initiativeId, JSON.stringify(initiative), decisionId, JSON.stringify(decision)]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id = $1`, [organizationId]);
    await pool.end();
  });

  it('reopens the exact pinned decision and conceals it from a foreign tenant', async () => {
    const coldPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const coldReader = new PostgresInitiativeReader(coldPool);
      const readback = await coldReader.findPortfolioDecisionForInitiative(
        organizationId,
        initiativeId
      );
      expect(readback).toMatchObject({
        version: 1,
        decision: {
          decisionId,
          initiativeId,
          status: 'PENDING',
          scenarioId: 'portfolio-q4',
          scenarioVersion: 2,
          initiativeVersion: 7,
        },
      });
      await expect(
        coldReader.findPortfolioDecisionForInitiative(foreignOrganizationId, initiativeId)
      ).resolves.toBeNull();
    } finally {
      await coldPool.end();
    }
  });
});
