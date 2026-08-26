import type { Pool } from 'pg';

export interface AsOfSourceVersion {
  sourceType: string;
  sourceId: string;
  version: number;
  eventCreatedAt: string;
}

export class PostgresAsOfVersionReader {
  constructor(private readonly pool: Pool) {}

  async resolve(
    organizationId: string,
    sources: Array<{ sourceType: string; sourceId: string }>,
    asOf: string
  ): Promise<AsOfSourceVersion[]> {
    if (sources.length === 0) return [];
    const values: unknown[] = [organizationId, asOf];
    const tuples = sources
      .map((source, index) => {
        values.push(source.sourceType, source.sourceId);
        const offset = 3 + index * 2;
        return `($${offset}::text,$${offset + 1}::text)`;
      })
      .join(',');
    const result = await this.pool.query<{
      aggregate_type: string;
      aggregate_id: string;
      aggregate_version: number;
      created_at: Date | string;
    }>(
      `SELECT DISTINCT ON (audit.aggregate_type,audit.aggregate_id)
              audit.aggregate_type,audit.aggregate_id,audit.aggregate_version,audit.created_at
         FROM ie_audit_events audit
         JOIN (VALUES ${tuples}) AS wanted(source_type,source_id)
           ON wanted.source_type=audit.aggregate_type AND wanted.source_id=audit.aggregate_id
        WHERE audit.organization_id=$1 AND audit.created_at <= $2::timestamptz
        ORDER BY audit.aggregate_type,audit.aggregate_id,audit.aggregate_version DESC`,
      values
    );
    return result.rows.map((row) => ({
      sourceType: row.aggregate_type,
      sourceId: row.aggregate_id,
      version: row.aggregate_version,
      eventCreatedAt: new Date(row.created_at).toISOString(),
    }));
  }
}
