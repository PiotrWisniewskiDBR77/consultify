import type { Pool } from 'pg';

type CommitmentRow = {
  aggregate_type: 'execution_task' | 'execution_decision';
  aggregate_id: string;
  payload_json: Record<string, unknown>;
};

const knownDimension = (missingIds: string[], denominator: number) => ({
  knowledgeState: 'KNOWN' as const,
  numerator: missingIds.length,
  denominator,
  ids: missingIds,
  reason: null,
});

export class GovernanceDataQualityReadModel {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async read(organizationId: string) {
    const result = await this.pool.query<CommitmentRow>(
      `SELECT aggregate_type, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id=$1
          AND aggregate_type IN ('execution_task','execution_decision')
        ORDER BY aggregate_type, aggregate_id`,
      [organizationId]
    );
    const tasks = result.rows.filter((row) => row.aggregate_type === 'execution_task');
    const decisions = result.rows.filter((row) => row.aggregate_type === 'execution_decision');
    const all = result.rows;
    const missingOwner = all
      .filter((row) => {
        const owner =
          row.aggregate_type === 'execution_task'
            ? row.payload_json.ownerId
            : row.payload_json.authorityId;
        return typeof owner !== 'string' || owner.trim() === '';
      })
      .map((row) => row.aggregate_id);
    const missingDueDate = all
      .filter(
        (row) => typeof row.payload_json.dueAt !== 'string' || row.payload_json.dueAt.trim() === ''
      )
      .map((row) => row.aggregate_id);
    const missingTaskEvidence = tasks
      .filter(
        (row) =>
          !Array.isArray(row.payload_json.evidenceRefs) ||
          row.payload_json.evidenceRefs.length === 0
      )
      .map((row) => row.aggregate_id);

    return {
      commitmentCount: all.length,
      commitmentsByType: { tasks: tasks.length, decisions: decisions.length },
      dimensions: {
        missingOwner: knownDimension(missingOwner, all.length),
        missingDueDate: knownDimension(missingDueDate, all.length),
        missingEvidence: {
          tasks: knownDimension(missingTaskEvidence, tasks.length),
          decisions: {
            knowledgeState: 'UNKNOWN' as const,
            numerator: null,
            denominator: null,
            ids: null,
            reason: 'DECISION_EVIDENCE_CARRIER_UNAVAILABLE',
          },
        },
      },
    };
  }
}
