import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

export interface KpiShadowFieldDifference {
  field: 'value' | 'target' | 'unit' | 'status' | 'visibility';
  sourceValue: string | number | null;
  canonicalValue: string | number | null;
}

export interface KpiShadowPair {
  organizationId: string;
  sourceId: string;
  canonicalKpiId: string;
  differences: KpiShadowFieldDifference[];
}

export interface KpiShadowReadResult {
  comparedPairs: number;
  matchingPairs: number;
  divergentPairs: number;
  pairs: KpiShadowPair[];
}

interface ShadowRow extends QueryResultRow {
  organization_id: string;
  source_id: string;
  canonical_kpi_id: string;
  source_value: string | number | null;
  canonical_value: string | number | null;
  source_target: string | number | null;
  canonical_target: string | number | null;
  source_unit: string | null;
  canonical_unit: string | null;
  source_status: string | null;
  canonical_status: string | null;
  canonical_visibility: string | null;
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

function comparable(value: string | number | null): string | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && String(value).trim() !== '' ? String(numeric) : String(value);
}

/** Read-only comparison. This function is deliberately not mounted on a route. */
export async function runInitiativeKpiShadowRead(
  organizationId: string
): Promise<KpiShadowReadResult> {
  const rows = await withClient(async (client) => {
    const result = await client.query<ShadowRow>(
      `SELECT
         cw.organization_id,
         source.id AS source_id,
         canonical.kpi_id::text AS canonical_kpi_id,
         source.current_value AS source_value,
         latest.actual_value AS canonical_value,
         source.target_value AS source_target,
         version.target_value AS canonical_target,
         source.unit AS source_unit,
         version.unit AS canonical_unit,
         source.status AS source_status,
         canonical.status AS canonical_status,
         visibility.visibility_mode AS canonical_visibility
       FROM kpi_crosswalk cw
       JOIN initiative_kpis source
         ON source.organization_id = cw.organization_id
        AND source.id = cw.source_id
       JOIN rvn_kpi_definitions canonical
         ON canonical.organization_id = cw.organization_id
        AND canonical.kpi_id = cw.canonical_kpi_id
       LEFT JOIN rvn_kpi_definition_versions version
         ON version.definition_version_id = canonical.current_definition_version_id
        AND version.organization_id = canonical.organization_id
       LEFT JOIN LATERAL (
         SELECT measurement.actual_value
           FROM rvn_kpi_measurements measurement
          WHERE measurement.organization_id = canonical.organization_id
            AND measurement.kpi_id = canonical.kpi_id
          ORDER BY measurement.period_end DESC, measurement.recorded_at DESC
          LIMIT 1
       ) latest ON TRUE
       LEFT JOIN rvn_platform_resource_visibility visibility
         ON visibility.organization_id = canonical.organization_id
        AND visibility.resource_type = 'kpi'
        AND visibility.resource_id = canonical.kpi_id::text
       WHERE cw.organization_id = $1
         AND cw.source_system = 'initiative_kpis'
       ORDER BY source.id`,
      [organizationId]
    );
    return result.rows;
  });

  const pairs = rows.map<KpiShadowPair>((row) => {
    const candidates: Array<
      [KpiShadowFieldDifference['field'], string | number | null, string | number | null]
    > = [
      ['value', row.source_value, row.canonical_value],
      ['target', row.source_target, row.canonical_target],
      ['unit', row.source_unit, row.canonical_unit],
      ['status', row.source_status, row.canonical_status],
      // initiative_kpis has no visibility column: NULL is explicit UNKNOWN.
      ['visibility', null, row.canonical_visibility],
    ];
    const differences = candidates
      .filter(
        ([, sourceValue, canonicalValue]) => comparable(sourceValue) !== comparable(canonicalValue)
      )
      .map(([field, sourceValue, canonicalValue]) => ({ field, sourceValue, canonicalValue }));
    return {
      organizationId: row.organization_id,
      sourceId: row.source_id,
      canonicalKpiId: row.canonical_kpi_id,
      differences,
    };
  });

  const divergentPairs = pairs.filter((pair) => pair.differences.length > 0).length;
  return {
    comparedPairs: pairs.length,
    matchingPairs: pairs.length - divergentPairs,
    divergentPairs,
    pairs,
  };
}
