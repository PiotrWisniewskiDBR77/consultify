import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import type { ResultsSearchKind } from '../../../validators/resultsVnextSearch.validators.js';
import { buildVisibilityScopedCte } from './visibilityScopedQuery.js';
import { resultsTextMatchPattern, resultsTextMatchSql } from './textMatch.js';

export interface ResultsSearchHit {
  kind: ResultsSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  updatedAt: string;
  matchedField: 'title' | 'code' | 'description';
  href: string;
}

interface SearchRow extends QueryResultRow {
  kind: ResultsSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  updated_at: Date | string;
  matched_field: 'title' | 'code' | 'description';
}

interface SearchCursor {
  updatedAt: string;
  id: string;
}

const KIND_CONFIG: Record<
  ResultsSearchKind,
  {
    table: string;
    alias: string;
    id: string;
    title: string;
    subtitle: string;
    status: string;
    updatedAt: string;
    fields: ReadonlyArray<{ name: 'title' | 'code' | 'description'; sql: string }>;
    href: (id: string) => string;
  }
> = {
  kpi: {
    table: 'rvn_kpi_definitions',
    alias: 'r',
    id: 'r.kpi_id',
    title: 'COALESCE(v.name, r.kpi_code)',
    subtitle: 'r.kpi_code',
    status: 'r.status',
    updatedAt: 'r.updated_at',
    fields: [
      { name: 'title', sql: 'v.name' },
      { name: 'code', sql: 'r.kpi_code' },
      { name: 'description', sql: 'v.description' },
    ],
    href: (id) => `/results/kpi/${id}`,
  },
  okr_set: {
    table: 'okr_vnext_sets',
    alias: 'r',
    id: 'r.set_id',
    title: 'r.title',
    subtitle: 'NULL::text',
    status: 'r.status',
    updatedAt: 'r.updated_at',
    fields: [{ name: 'title', sql: 'r.title' }],
    href: (id) => `/results/okr/sets/${id}`,
  },
  roi_case: {
    table: 'rvn_roi_cases',
    alias: 'r',
    id: 'r.case_id',
    title: 'r.title',
    subtitle: 'r.status',
    status: 'r.status',
    updatedAt: 'r.updated_at',
    fields: [{ name: 'title', sql: 'r.title' }],
    href: (id) => `/results/roi/cases/${id}`,
  },
};

function decodeCursor(value: string | undefined): SearchCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<SearchCursor>;
    if (
      typeof decoded.updatedAt !== 'string' ||
      Number.isNaN(Date.parse(decoded.updatedAt)) ||
      typeof decoded.id !== 'string' ||
      !decoded.id
    )
      throw new Error();
    return { updatedAt: decoded.updatedAt, id: decoded.id };
  } catch {
    throw new Error('INVALID_SEARCH_CURSOR');
  }
}

function encodeCursor(hit: ResultsSearchHit): string {
  return Buffer.from(JSON.stringify({ updatedAt: hit.updatedAt, id: hit.id }), 'utf8').toString(
    'base64url'
  );
}

async function queryKind(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    query: string;
    kind: ResultsSearchKind;
    cursor: SearchCursor | null;
    limit: number;
  }
): Promise<ResultsSearchHit[]> {
  const config = KIND_CONFIG[params.kind];
  const cte = await buildVisibilityScopedCte({
    userId: params.userId,
    organizationId: params.organizationId,
    resourceType: params.kind,
  });
  const values: unknown[] = [...cte.values, resultsTextMatchPattern(params.query)];
  const matchParam = `$${values.length}`;
  const cursorFilter = params.cursor
    ? (() => {
        values.push(params.cursor.updatedAt, params.cursor.id);
        return `AND (${config.updatedAt} < $${values.length - 1} OR (${config.updatedAt} = $${values.length - 1} AND ${config.id}::text > $${values.length}))`;
      })()
    : '';
  values.push(params.limit + 1);
  const versionJoin =
    params.kind === 'kpi'
      ? 'LEFT JOIN rvn_kpi_definition_versions v ON v.definition_version_id = r.current_definition_version_id AND v.organization_id = r.organization_id'
      : '';
  const matchedField = `CASE ${config.fields.map((field) => `WHEN ${field.sql} ILIKE ${matchParam} ESCAPE E'\\\\' THEN '${field.name}'`).join(' ')} END`;
  const sql = `${cte.sql}
    SELECT '${params.kind}'::text AS kind, ${config.id}::text AS id, ${config.title} AS title,
           ${config.subtitle} AS subtitle, ${config.status} AS status, ${config.updatedAt} AS updated_at,
           ${matchedField} AS matched_field
      FROM ${config.table} ${config.alias}
      ${versionJoin}
      INNER JOIN rvn_visible_resources vr ON vr.resource_type = '${params.kind}' AND vr.resource_id = ${config.id}::text
     WHERE r.organization_id = $1
       AND ${resultsTextMatchSql(
         config.fields.map((field) => field.sql),
         matchParam
       )}
       ${cursorFilter}
     ORDER BY ${config.updatedAt} DESC, ${config.id}::text ASC
     LIMIT $${values.length}`;
  const rows = (await client.query<SearchRow>(sql, values)).rows;
  return rows.map((row) => ({
    kind: row.kind,
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    updatedAt: new Date(row.updated_at).toISOString(),
    matchedField: row.matched_field,
    href: config.href(row.id),
  }));
}

export async function searchResults(params: {
  userId: string;
  organizationId: string;
  query: string;
  kinds: ResultsSearchKind[];
  limit: number;
  cursor?: string;
}): Promise<{ results: ResultsSearchHit[]; nextCursor: string | null }> {
  const cursor = decodeCursor(params.cursor);
  const client = await acquirePgClient();
  try {
    const groups = await Promise.all(
      params.kinds.map((kind) => queryKind(client, { ...params, kind, cursor }))
    );
    const ordered = groups
      .flat()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    const results = ordered.slice(0, params.limit);
    return {
      results,
      nextCursor:
        ordered.length > params.limit && results.length
          ? encodeCursor(results[results.length - 1])
          : null,
    };
  } finally {
    client.release();
  }
}
