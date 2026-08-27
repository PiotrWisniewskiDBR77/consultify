import type { Pool } from 'pg';

export interface CanonicalBudgetEntryProjection {
  id: string;
  entryId: string;
  initiativeId: string;
  entryType: string;
  costType: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  periodMonth: number | null;
  periodYear: number | null;
  source: string;
  createdBy: string | null;
  createdAt: string;
  version: number;
  origin: 'CANONICAL';
}

export class CanonicalExecutionReadProjections {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async listBudgetEntries(
    organizationId: string,
    initiativeId: string
  ): Promise<CanonicalBudgetEntryProjection[]> {
    const result = await this.pool.query<{
      aggregate_id: string;
      version: number;
      payload_json: Record<string, unknown>;
      updated_at: Date | string;
    }>(
      `SELECT aggregate_id,version,payload_json,updated_at
         FROM ie_aggregate_state
        WHERE organization_id=$1
          AND aggregate_type='execution_budget_entry'
          AND payload_json->>'initiativeId'=$2
          AND COALESCE(payload_json->>'status','') <> 'VOIDED'
        ORDER BY (payload_json->>'periodYear')::int DESC NULLS LAST,
                 (payload_json->>'periodMonth')::int DESC NULLS LAST,
                 updated_at DESC`,
      [organizationId, initiativeId]
    );
    return result.rows.map((row) => {
      const payload = row.payload_json;
      return {
        id: row.aggregate_id,
        entryId: row.aggregate_id,
        initiativeId: String(payload.initiativeId),
        entryType: String(payload.entryType),
        costType: String(payload.costType),
        category: String(payload.category),
        amount: Number(payload.amount),
        currency: String(payload.currency),
        description: typeof payload.description === 'string' ? payload.description : null,
        periodMonth: typeof payload.periodMonth === 'number' ? payload.periodMonth : null,
        periodYear: typeof payload.periodYear === 'number' ? payload.periodYear : null,
        source: String(payload.source),
        createdBy:
          typeof payload.recordedBy === 'string'
            ? payload.recordedBy
            : typeof payload.createdBy === 'string'
              ? payload.createdBy
              : null,
        createdAt:
          typeof payload.recordedAt === 'string'
            ? payload.recordedAt
            : row.updated_at instanceof Date
              ? row.updated_at.toISOString()
              : String(row.updated_at),
        version: row.version,
        origin: 'CANONICAL' as const,
      };
    });
  }
}
