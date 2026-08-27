import type { Pool } from 'pg';

export interface ComputedControlKpi {
  numerator: number;
  denominator: number;
  ids: string[];
  sourceVersion: number;
}

export type OwnerIndependentKpis = Record<
  'plan-delivery' | 'blocked-work' | 'milestone' | 'dependency' | 'intervention-effectiveness',
  ComputedControlKpi
>;

type AggregateRow = {
  aggregate_type: string;
  aggregate_id: string;
  version: number;
  payload_json: Record<string, any>;
  initiative_id: string | null;
};

const metric = (
  rows: AggregateRow[],
  denominator: (row: AggregateRow) => boolean,
  numerator: (row: AggregateRow) => boolean
): ComputedControlKpi => {
  const population = rows.filter(denominator);
  const counted = population.filter(numerator);
  return {
    numerator: counted.length,
    denominator: population.length,
    ids: [...new Set(counted.map((row) => row.initiative_id).filter(Boolean) as string[])].sort(),
    sourceVersion: population.reduce((max, row) => Math.max(max, row.version), 0),
  };
};

export class OwnerIndependentKpiReader {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async read(organizationId: string, weekStart: string): Promise<OwnerIndependentKpis> {
    const aggregates = await this.pool.query<AggregateRow>(
      `SELECT item.aggregate_type,item.aggregate_id,item.version,item.payload_json,
              COALESCE(item.payload_json->>'initiativeId',execution_case.payload_json->>'initiativeId') AS initiative_id
         FROM ie_aggregate_state item
         LEFT JOIN ie_aggregate_state execution_case
           ON execution_case.organization_id=item.organization_id
          AND execution_case.aggregate_type='execution_case'
          AND execution_case.aggregate_id=item.payload_json->>'executionCaseId'
        WHERE item.organization_id=$1
          AND item.aggregate_type IN ('execution_task','execution_milestone','intervention_case')
          AND CASE item.aggregate_type
                WHEN 'execution_task' THEN item.payload_json->>'dueAt'
                WHEN 'execution_milestone' THEN item.payload_json->>'targetAt'
                WHEN 'intervention_case' THEN COALESCE(
                  item.payload_json->>'verifyBy',
                  item.payload_json->>'slaAt'
                )
              END ~ '^\\d{4}-\\d{2}-\\d{2}'
          AND (CASE item.aggregate_type
                 WHEN 'execution_task' THEN item.payload_json->>'dueAt'
                 WHEN 'execution_milestone' THEN item.payload_json->>'targetAt'
                 WHEN 'intervention_case' THEN COALESCE(
                   item.payload_json->>'verifyBy',
                   item.payload_json->>'slaAt'
                 )
               END)::timestamptz >= $2::date
          AND (CASE item.aggregate_type
                 WHEN 'execution_task' THEN item.payload_json->>'dueAt'
                 WHEN 'execution_milestone' THEN item.payload_json->>'targetAt'
                 WHEN 'intervention_case' THEN COALESCE(
                   item.payload_json->>'verifyBy',
                   item.payload_json->>'slaAt'
                 )
               END)::timestamptz < $2::date + INTERVAL '7 days'`,
      [organizationId, weekStart]
    );
    const dependencies = await this.pool.query<{
      id: string;
      from_initiative_id: string;
      to_initiative_id: string;
      from_exists: boolean;
      to_exists: boolean;
    }>(
      `SELECT dependency.id,dependency.from_initiative_id,dependency.to_initiative_id,
              (source.id IS NOT NULL) AS from_exists,(target.id IS NOT NULL) AS to_exists
         FROM initiative_dependencies dependency
         LEFT JOIN initiatives source
           ON source.id=dependency.from_initiative_id AND source.organization_id=dependency.organization_id
         LEFT JOIN initiatives target
           ON target.id=dependency.to_initiative_id AND target.organization_id=dependency.organization_id
        WHERE dependency.organization_id=$1
          AND dependency.created_at >= $2::date
          AND dependency.created_at < $2::date + INTERVAL '7 days'`,
      [organizationId, weekStart]
    );
    const rows = aggregates.rows;
    const taskRows = rows.filter((row) => row.aggregate_type === 'execution_task');
    const milestoneRows = rows.filter((row) => row.aggregate_type === 'execution_milestone');
    const interventionRows = rows.filter((row) => row.aggregate_type === 'intervention_case');
    const dependencyPopulation = dependencies.rows;
    const validDependencies = dependencyPopulation.filter(
      (row) => row.from_exists && row.to_exists
    );
    return {
      'plan-delivery': metric(
        taskRows,
        (row) => typeof row.payload_json.dueAt === 'string',
        (row) => row.payload_json.status === 'COMPLETED'
      ),
      'blocked-work': metric(
        taskRows,
        (row) => ['OPEN', 'BLOCKED', 'COMPLETED'].includes(String(row.payload_json.status)),
        (row) => row.payload_json.status === 'BLOCKED'
      ),
      milestone: metric(
        milestoneRows,
        () => true,
        (row) => ['ACHIEVED', 'COMPLETED'].includes(String(row.payload_json.status))
      ),
      dependency: {
        numerator: validDependencies.length,
        denominator: dependencyPopulation.length,
        ids: [...new Set(validDependencies.map((row) => row.from_initiative_id))].sort(),
        sourceVersion: dependencyPopulation.length > 0 ? 1 : 0,
      },
      'intervention-effectiveness': metric(
        interventionRows,
        (row) => Boolean(row.payload_json.verification?.outcome),
        (row) => row.payload_json.verification?.outcome === 'EFFECTIVE'
      ),
    };
  }
}
