import type { Pool } from 'pg';

type CoverageRow = {
  commitment_count: number;
  mapped_commitment_count: number;
  mapped_to_declared_perspective_count: number;
  goal_count: number;
  assigned_goal_count: number;
};

export class ReportClassificationReadModel {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async read(organizationId: string) {
    const result = await this.pool.query<CoverageRow>(
      `WITH commitments AS (
         SELECT aggregate_id, NULLIF(payload_json->>'initiativeId','') initiative_id
           FROM ie_aggregate_state
          WHERE organization_id=$1
            AND aggregate_type IN ('execution_task','execution_decision')
       ), coverage AS (
         SELECT c.aggregate_id commitment_id,
                COUNT(DISTINCT g.id)::int goal_count,
                COUNT(DISTINCT g.id) FILTER (WHERE g.perspective IS NOT NULL)::int assigned_goal_count
           FROM commitments c
           LEFT JOIN initiatives i
             ON i.organization_id=$1 AND i.id=c.initiative_id
           LEFT JOIN goal_initiative_links gil
             ON gil.initiative_id=i.id
           LEFT JOIN goals g
             ON g.organization_id=$1 AND g.id=gil.goal_id
          GROUP BY c.aggregate_id
       )
       SELECT
         (SELECT COUNT(*)::int FROM commitments) commitment_count,
         COUNT(*) FILTER (WHERE goal_count > 0)::int mapped_commitment_count,
         COUNT(*) FILTER (WHERE assigned_goal_count > 0)::int mapped_to_declared_perspective_count,
         COALESCE(SUM(goal_count),0)::int goal_count,
         COALESCE(SUM(assigned_goal_count),0)::int assigned_goal_count
       FROM coverage`,
      [organizationId]
    );
    const coverage = result.rows[0] ?? {
      commitment_count: 0,
      mapped_commitment_count: 0,
      mapped_to_declared_perspective_count: 0,
      goal_count: 0,
      assigned_goal_count: 0,
    };
    const strategic =
      coverage.commitment_count > 0 &&
      coverage.mapped_to_declared_perspective_count === coverage.commitment_count;
    return {
      reportClass: strategic ? ('STRATEGIC' as const) : ('OPERATIONAL' as const),
      reason: {
        criterion: 'EVERY_COMMITMENT_MAPS_TO_A_HUMAN_DECLARED_PERSPECTIVE',
        commitmentCount: coverage.commitment_count,
        mappedCommitmentCount: coverage.mapped_commitment_count,
        mappedToDeclaredPerspectiveCount: coverage.mapped_to_declared_perspective_count,
        goalCount: coverage.goal_count,
        assignedGoalCount: coverage.assigned_goal_count,
      },
    };
  }
}
