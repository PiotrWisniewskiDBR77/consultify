import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

export type KpiCrosswalkMatchBasis = 'manual' | 'owner_confirmed';

export interface ConfirmedKpiMapping {
  sourceId: string;
  canonicalKpiId: string;
  matchBasis: KpiCrosswalkMatchBasis;
}

export interface KpiCrosswalkReadback {
  organizationId: string;
  sourceSystem: 'initiative_kpis';
  sourceRows: number;
  mappedRows: number;
  unmappedRows: number;
  unmappedReason: 'no_confirmed_mapping';
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Registers only caller-supplied, explicitly confirmed identities. There is
 * intentionally no discovery by name, unit, code, or any other heuristic.
 * The INSERT ... SELECT also makes tenant equality a write-time invariant.
 */
export async function registerConfirmedInitiativeKpiMappings(params: {
  organizationId: string;
  createdBy: string;
  mappings: ConfirmedKpiMapping[];
}): Promise<{ requested: number; inserted: number; rejected: number }> {
  return withClient(async (client) => {
    let inserted = 0;
    for (const mapping of params.mappings) {
      const result = await client.query(
        `INSERT INTO kpi_crosswalk (
           organization_id, source_system, source_id, canonical_kpi_id, match_basis, created_by
         )
         SELECT source.organization_id, 'initiative_kpis', source.id, canonical.kpi_id, $3, $4
           FROM initiative_kpis source
           JOIN rvn_kpi_definitions canonical
             ON canonical.kpi_id = $2::uuid
            AND canonical.organization_id = source.organization_id
          WHERE source.id = $1
            AND source.organization_id = $5
         ON CONFLICT (organization_id, source_system, source_id) DO NOTHING`,
        [
          mapping.sourceId,
          mapping.canonicalKpiId,
          mapping.matchBasis,
          params.createdBy,
          params.organizationId,
        ]
      );
      inserted += result.rowCount ?? 0;
    }
    return {
      requested: params.mappings.length,
      inserted,
      rejected: params.mappings.length - inserted,
    };
  });
}

export async function readInitiativeKpiCrosswalkCounts(
  organizationId: string
): Promise<KpiCrosswalkReadback> {
  return withClient(async (client) => {
    const result = await client.query<
      QueryResultRow & { source_rows: string; mapped_rows: string; unmapped_rows: string }
    >(
      `SELECT
         COUNT(*)::text AS source_rows,
         COUNT(cw.crosswalk_id)::text AS mapped_rows,
         (COUNT(*) - COUNT(cw.crosswalk_id))::text AS unmapped_rows
       FROM initiative_kpis source
       LEFT JOIN kpi_crosswalk cw
         ON cw.organization_id = source.organization_id
        AND cw.source_system = 'initiative_kpis'
        AND cw.source_id = source.id
       WHERE source.organization_id = $1`,
      [organizationId]
    );
    const row = result.rows[0];
    return {
      organizationId,
      sourceSystem: 'initiative_kpis',
      sourceRows: Number(row?.source_rows ?? 0),
      mappedRows: Number(row?.mapped_rows ?? 0),
      unmappedRows: Number(row?.unmapped_rows ?? 0),
      unmappedReason: 'no_confirmed_mapping',
    };
  });
}
