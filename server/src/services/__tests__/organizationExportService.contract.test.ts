import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { exportOrganizationData } from '../organizationExportService.js';
import { organizationExportToCsv } from '../organizationLifecycleService.js';
import type { OrganizationExportTableContract } from '../organizationExportContract.js';

const root: OrganizationExportTableContract = {
  schema: 'public',
  table: 'organizations',
  category: 'EXPORT',
  columnTypes: { id: 'text', name: 'text' },
  primaryKey: ['id'],
  foreignKeys: [],
  ownerColumn: 'id',
  counterpartyColumns: [],
  projection: ['id', 'name'],
  excludedColumns: [],
  source: 'test-owned root',
};
function policy(schema: 'public' | 'v8', table: string): OrganizationExportTableContract {
  return {
    schema,
    table,
    category: 'EXPORT',
    columnTypes: {
      id: 'text',
      owner_organization_id: 'text',
      counterparty_organization_id: 'text',
      payload: 'text',
      access_token: 'text',
    },
    primaryKey: ['id'],
    foreignKeys: [],
    ownerColumn: 'owner_organization_id',
    counterpartyColumns: ['counterparty_organization_id'],
    projection: ['id', 'owner_organization_id', 'counterparty_organization_id', 'payload'],
    excludedColumns: ['access_token'],
    source: 'explicit disposable test contract',
  };
}
function fixture(
  policies: OrganizationExportTableContract[],
  options: {
    extraColumn?: boolean;
    unknown?: boolean;
    catalogFailure?: boolean;
    changedType?: boolean;
    removedExcluded?: boolean;
  } = {}
) {
  const queries: string[] = [];
  const catalog = policies.map((p) => ({ p, columns: [...p.projection, ...p.excludedColumns] }));
  if (options.extraColumn) catalog[1].columns.push('new_private_column');
  if (options.removedExcluded)
    catalog[1].columns = catalog[1].columns.filter((column) => column !== 'access_token');
  if (options.unknown)
    catalog.push({
      p: policy('v8', 'unclassified'),
      columns: ['id', 'owner_organization_id', 'payload'],
    });
  const client = {
    query: async (sql: string, args: unknown[]) => {
      queries.push(sql);
      if (sql.includes('format_type(')) {
        if (options.catalogFailure) throw new Error('catalog failed');
        return {
          rows: catalog.flatMap(({ p, columns }) =>
            columns.map((column_name) => ({
              schema_name: p.schema,
              table_name: p.table,
              column_name,
              data_type:
                options.changedType && p.table !== 'organizations' && column_name === 'payload'
                  ? 'jsonb'
                  : 'text',
            }))
          ),
        };
      }
      if (sql.includes("con.contype='p'"))
        return {
          rows: catalog.map(({ p }) => ({
            schema_name: p.schema,
            table_name: p.table,
            columns: p.primaryKey,
          })),
        };
      if (sql.includes("con.contype='f'"))
        return {
          rows: catalog.flatMap(({ p }) =>
            p.foreignKeys.map((fk) => ({
              child_schema: p.schema,
              child_table: p.table,
              parent_schema: fk.parentSchema,
              parent_table: fk.parentTable,
              child_columns: fk.columns,
              parent_columns: fk.parentColumns,
              delete_action: fk.deleteAction,
            }))
          ),
        };
      if (sql.includes('FROM "public"."organizations"'))
        return { rows: [{ id: args[0], name: 'Organization A' }] };
      const table = catalog.find(({ p }) => sql.includes(`FROM "${p.schema}"."${p.table}"`))?.p;
      if (!table) throw new Error('unexpected query');
      const rows = [
        {
          id: `${table.schema}-own`,
          owner_organization_id: 'org-a',
          counterparty_organization_id: 'org-b',
          payload: {
            label: 'kept',
            clientSecret: 'secret',
            nested: { refresh_token: 'secret', value: 4 },
          },
        },
        {
          id: `${table.schema}-foreign`,
          owner_organization_id: 'org-b',
          counterparty_organization_id: 'org-a',
          payload: { label: 'foreign' },
        },
      ];
      const selected = sql.includes(' OR ')
        ? rows
        : rows.filter((row) => row.owner_organization_id === args[0]);
      return { rows: selected };
    },
  } as unknown as PoolClient;
  return { client, queries };
}

describe('schema qualified export policy behavior', () => {
  it('keeps same-name public and v8 records separate in JSON and CSV with exact counts', async () => {
    const policies = [root, policy('public', 'business'), policy('v8', 'business')];
    const { client } = fixture(policies);
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(Object.keys(result.tables)).toEqual(['business', 'v8.business']);
    expect(result.tables.business[0].id).toBe('public-own');
    expect(result.tables['v8.business'][0].id).toBe('v8-own');
    expect(result.rowCounts).toEqual({ business: 1, 'v8.business': 1 });
    expect(result.totalRows).toBe(2);
    const csv = organizationExportToCsv(result);
    expect(csv.split('\n')[0]).toBe('table,row_index,data_json');
    expect(csv).toContain('"v8.business",0,');
    expect(csv).toContain('"business",0,');
    expect(result.securityManifest.complete).toBe(true);
  });
  it('owner-only selection does not export counterparty rows and recursively strips credentials', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client, queries } = fixture(policies);
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(JSON.stringify(result)).not.toContain('foreign');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.tables['v8.business'][0].payload).toEqual({
      label: 'kept',
      nested: { value: 4 },
    });
    expect(queries.find((sql) => sql.includes('FROM "v8"."business"'))).not.toContain(
      'access_token'
    );
  });
  it('unknown relation is not queried and makes completeness false', async () => {
    const { client, queries } = fixture([root], { unknown: true });
    const result = await exportOrganizationData(client, 'org-a', [root]);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.unclassified',
      reason: 'ownership_contract_unresolved',
    });
    expect(queries.filter((sql) => sql.includes('FROM "v8"."unclassified"'))).toHaveLength(0);
  });
  it('new schema column invalidates approval instead of silently exporting or omitting it', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client, queries } = fixture(policies, { extraColumn: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_projection_or_primary_key_drift',
    });
    expect(queries.filter((sql) => sql.includes('FROM "v8"."business"'))).toHaveLength(0);
  });
  it('security exclusions are never queried and do not imply truncation', async () => {
    const excluded = { ...policy('v8', 'secrets'), category: 'EXCLUDE_SECURITY' as const };
    const policies = [root, excluded];
    const { client, queries } = fixture(policies);
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.excludedTables[0].table).toBe('v8.secrets');
    expect(result.securityManifest.truncated).toBe(false);
    expect(queries.filter((sql) => sql.includes('FROM "v8"."secrets"'))).toHaveLength(0);
  });
  it('catalog failure produces no successful file or completeness claim', async () => {
    const { client } = fixture([root], { catalogFailure: true });
    await expect(exportOrganizationData(client, 'org-a', [root])).rejects.toThrow('catalog failed');
  });
  it('changed column type invalidates approval before serializing any row', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client, queries } = fixture(policies, { changedType: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_projection_or_primary_key_drift',
    });
    expect(queries.filter((sql) => sql.includes('FROM "v8"."business"'))).toHaveLength(0);
  });

  it('removed excluded column is schema drift, not a silently changed complete contract', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client } = fixture(policies, { removedExcluded: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_projection_or_primary_key_drift',
    });
  });
  it('indirect child cannot use a parent whose approved schema drifted', async () => {
    const parent = policy('public', 'projects');
    const child: OrganizationExportTableContract = {
      schema: 'public',
      table: 'members',
      category: 'EXPORT',
      columnTypes: { id: 'text', project_id: 'text' },
      primaryKey: ['id'],
      foreignKeys: [
        {
          columns: ['project_id'],
          parentSchema: 'public',
          parentTable: 'projects',
          parentColumns: ['id'],
          deleteAction: 'CASCADE',
        },
      ],
      counterpartyColumns: [],
      projection: ['id', 'project_id'],
      excludedColumns: [],
      source: 'explicit fixture edge',
      ownerVia: {
        parentSchema: 'public',
        parentTable: 'projects',
        childColumn: 'project_id',
        parentColumn: 'id',
      },
    };
    const policies = [root, parent, child];
    const { client, queries } = fixture(policies, { extraColumn: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'members',
      reason: 'indirect_owner_edge_unresolved',
    });
    expect(queries.filter((sql) => sql.includes('FROM "public"."members"'))).toHaveLength(0);
  });
});
