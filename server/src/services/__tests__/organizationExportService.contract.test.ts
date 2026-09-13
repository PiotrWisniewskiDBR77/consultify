import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { exportOrganizationData } from '../organizationExportService.js';
import {
  ORGANIZATION_EXPORT_CSV_MANIFEST_TABLE,
  organizationExportToCsv,
} from '../organizationLifecycleService.js';
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
    /** K3b: per-table catalog surgery, so column drift can be aimed at the tenant root. */
    dropColumns?: Record<string, string[]>;
    addColumns?: Record<string, string[]>;
    retypeColumns?: Record<string, Record<string, string>>;
  } = {}
) {
  const queries: string[] = [];
  const catalog = policies.map((p) => ({ p, columns: [...p.projection, ...p.excludedColumns] }));
  for (const entry of catalog) {
    const dropped = options.dropColumns?.[entry.p.table];
    if (dropped) entry.columns = entry.columns.filter((column) => !dropped.includes(column));
    const added = options.addColumns?.[entry.p.table];
    if (added) entry.columns = [...entry.columns, ...added];
  }
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
                options.retypeColumns?.[p.table]?.[column_name] ??
                (options.changedType && p.table !== 'organizations' && column_name === 'payload'
                  ? 'jsonb'
                  : 'text'),
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
  // K3b: an undeclared column stays unexportable, but it no longer deletes the
  // whole tenant table from the file. The approval it invalidates is the
  // COLUMN's, recorded in `skipped`, and completeness still drops to false.
  it('new schema column is never exported and degrades only that column', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client, queries } = fixture(policies, { extraColumn: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_column_drift_partial_export',
    });
    expect(result.skipped).toContainEqual({
      tabela: 'v8.business',
      kolumna: 'new_private_column',
      reason: 'undeclared_column_not_exported',
    });
    const businessQueries = queries.filter((sql) => sql.includes('FROM "v8"."business"'));
    expect(businessQueries).toHaveLength(1);
    expect(businessQueries[0]).not.toContain('new_private_column');
    expect(JSON.stringify(result.tables['v8.business'])).not.toContain('new_private_column');
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
  // K3b: the retyped column is no longer the column the policy classified, so
  // it is dropped from the projection and never serialized; its siblings stay.
  it('changed column type drops that column from the projection, not the table', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client, queries } = fixture(policies, { changedType: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_column_drift_partial_export',
    });
    expect(result.skipped).toContainEqual({
      tabela: 'v8.business',
      kolumna: 'payload',
      reason: 'declared_column_type_drift',
    });
    const businessQueries = queries.filter((sql) => sql.includes('FROM "v8"."business"'));
    expect(businessQueries).toHaveLength(1);
    // Dowód jest na WYSŁANYM SQL: atrapa zwraca stały wiersz niezależnie od
    // projekcji, więc tylko treść zapytania mówi, czego naprawdę nie czytamy.
    expect(businessQueries[0]).not.toContain('payload');
  });

  it('removed excluded column is schema drift, not a silently changed complete contract', async () => {
    const policies = [root, policy('v8', 'business')];
    const { client } = fixture(policies, { removedExcluded: true });
    const result = await exportOrganizationData(client, 'org-a', policies);
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'v8.business',
      reason: 'schema_column_drift_partial_export',
    });
    expect(result.skipped).toContainEqual({
      tabela: 'v8.business',
      kolumna: 'access_token',
      reason: 'declared_column_missing_in_schema',
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
    // K3b: drift in a parent column the predicate never reads (here: an
    // undeclared column on `projects`) is recorded on the parent and must not
    // delete the child table from the tenant's file.
    const tolerated = fixture(policies, { extraColumn: true });
    const partial = await exportOrganizationData(tolerated.client, 'org-a', policies);
    expect(partial.securityManifest.unresolvedTables).not.toContainEqual({
      table: 'members',
      reason: 'indirect_owner_edge_unresolved',
    });
    expect(partial.skipped).toContainEqual({
      tabela: 'projects',
      kolumna: 'new_private_column',
      reason: 'undeclared_column_not_exported',
    });
    expect(
      tolerated.queries.filter((sql) => sql.includes('FROM "public"."members"'))
    ).toHaveLength(1);

    // The ownership proof itself still fails closed: a parent primary key that
    // no longer matches the contract leaves the child unexported.
    const broken = fixture(policies, { dropColumns: { projects: ['id'] } });
    const closed = await exportOrganizationData(broken.client, 'org-a', policies);
    expect(closed.securityManifest.unresolvedTables).toContainEqual({
      table: 'members',
      reason: 'indirect_owner_edge_unresolved',
    });
    expect(broken.queries.filter((sql) => sql.includes('FROM "public"."members"'))).toHaveLength(0);
  });
});

/**
 * K3b — REGRESJA PARYTETU: eksport organizacji 200 -> 500 `ORG_EXPORT_FAILED`.
 *
 * Zmierzone na żywym stanowisku (dwa API, jedna baza ze ścisłego migratora):
 * kontrakt deklaruje 59 kolumn `organizations`, baza ma 56 — brakuje
 * `trial_extension_count`, `trial_warning_sent_at`,
 * `onboarding_accept_idempotency_key` (żyją tylko w nigdy niewykonywanym
 * `000_initdb_core_tables.sql`). Stary, całotabelowy test rozjazdu pomijał
 * KORZEŃ dzierżawcy, `result.organization` zostawał `null`, a trasa zwracała
 * 500 zamiast pliku. Poniższe przypadki mierzą OBA układy bazy: z tymi
 * kolumnami (żywe staging/demo, gdzie dokłada je runtime DDL) i bez nich.
 */
describe('K3b: rozjazd kolumn korzenia daje eksport częściowy, nie 500', () => {
  const TRIAL_COLUMNS = [
    'trial_extension_count',
    'trial_warning_sent_at',
    'onboarding_accept_idempotency_key',
  ];
  const wideRoot: OrganizationExportTableContract = {
    ...root,
    columnTypes: {
      id: 'text',
      name: 'text',
      ...Object.fromEntries(TRIAL_COLUMNS.map((column) => [column, 'text'])),
    },
    projection: ['id', 'name', ...TRIAL_COLUMNS],
  };

  it('układ A — kolumny SĄ w bazie: pełny eksport, kontrakt kompletny', async () => {
    const { client, queries } = fixture([wideRoot]);
    const result = await exportOrganizationData(client, 'org-a', [wideRoot]);
    expect(result.organization).not.toBeNull();
    expect(result.skipped).toEqual([]);
    expect(result.securityManifest.complete).toBe(true);
    const rootQuery = queries.find((sql) => sql.includes('FROM "public"."organizations"'))!;
    for (const column of TRIAL_COLUMNS) expect(rootQuery).toContain(column);
  });

  it('układ B — kolumn NIE MA w bazie: eksport częściowy z jawnym wpisem, bez wyjątku', async () => {
    const { client, queries } = fixture([wideRoot], {
      dropColumns: { organizations: TRIAL_COLUMNS },
    });
    const result = await exportOrganizationData(client, 'org-a', [wideRoot]);
    // Sedno regresji: korzeń MUSI się wyeksportować, inaczej trasa daje 500.
    expect(result.organization).not.toBeNull();
    expect(result.organization).toMatchObject({ name: 'Organization A' });
    for (const column of TRIAL_COLUMNS) {
      expect(result.skipped).toContainEqual({
        tabela: 'organizations',
        kolumna: column,
        reason: 'declared_column_missing_in_schema',
      });
    }
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'organizations',
      reason: 'schema_column_drift_partial_export',
    });
    // Częściowy = jawnie NIEkompletny; nikt nie ogłasza pełnego eksportu.
    expect(result.securityManifest.complete).toBe(false);
    const rootQuery = queries.find((sql) => sql.includes('FROM "public"."organizations"'))!;
    for (const column of TRIAL_COLUMNS) expect(rootQuery).not.toContain(column);
  });

  it('korzeń bez kolumny właściciela nadal zawodzi zamknięciem (fail-closed)', async () => {
    const { client } = fixture([wideRoot], { dropColumns: { organizations: ['id'] } });
    await expect(exportOrganizationData(client, 'org-a', [wideRoot])).rejects.toThrow(
      /root contract could not be verified/i
    );
  });
});

describe('CSV durable export scope', () => {
  it('retains the exact manifest, omitted scope and business counts without changing business records', async () => {
    const policies = [root, policy('public', 'business')];
    const result = await exportOrganizationData(
      fixture(policies, { unknown: true }).client,
      'org-a',
      policies
    );
    result.securityManifest.scope = 'Scope with comma, newline\nand "quotes"';
    const before = JSON.stringify(result);
    const csv = organizationExportToCsv(result);
    // Decode using Python standard-library CSV, independently of the producer's escaping.
    const { spawnSync } = await import('node:child_process');
    const parsed = spawnSync(
      'python3',
      ['-c', 'import csv,sys,json; print(json.dumps(list(csv.DictReader(sys.stdin))))'],
      { input: csv, encoding: 'utf8' }
    );
    expect(parsed.status).toBe(0);
    const rows = JSON.parse(parsed.stdout);
    expect(rows[0].table).toBe(ORGANIZATION_EXPORT_CSV_MANIFEST_TABLE);
    const metadata = JSON.parse(rows[0].data_json);
    expect(metadata.securityManifest).toEqual(result.securityManifest);
    expect(metadata.securityManifest.complete).toBe(false);
    expect(metadata.skipped).toEqual(result.skipped);
    expect(metadata.totalRows).toBe(result.totalRows);
    expect(metadata.rowCounts).toEqual(result.rowCounts);
    expect(JSON.parse(rows.find((row: any) => row.table === 'business').data_json)).toEqual(
      result.tables.business[0]
    );
    expect(rows.filter((row: any) => row.table === 'business')).toHaveLength(1);
    expect(JSON.stringify(result)).toBe(before);
  });
  it('rejects reserved metadata identity collisions', async () => {
    const result = await exportOrganizationData(fixture([root]).client, 'org-a', [root]);
    result.tables[ORGANIZATION_EXPORT_CSV_MANIFEST_TABLE] = [];
    expect(() => organizationExportToCsv(result)).toThrow('reserved CSV manifest identity');
  });
});
