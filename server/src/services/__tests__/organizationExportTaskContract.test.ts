import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_EXPORT_TASK_TABLES } from '../organizationExportTaskContract.js';
import { exportOrganizationData } from '../organizationExportService.js';
import { organizationExportToCsv } from '../organizationLifecycleService.js';
import type { OrganizationExportTableContract } from '../organizationExportContract.js';
const root: OrganizationExportTableContract = {
  schema: 'public',
  table: 'organizations',
  category: 'EXPORT',
  columnTypes: { id: 'text' },
  primaryKey: ['id'],
  foreignKeys: [],
  ownerColumn: 'id',
  counterpartyColumns: [],
  projection: ['id'],
  excludedColumns: [],
  source: 'test root',
};
const contracts = [root, ...ORGANIZATION_EXPORT_TASK_TABLES];
function mockClient(data: Record<string, Record<string, unknown>[]>, drift?: string) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      query: async (sql: string, args: unknown[]) => {
        calls.push(sql);
        if (sql.includes('format_type('))
          return {
            rows: contracts.flatMap((p) =>
              Object.entries(p.columnTypes).map(([column_name, data_type]) => ({
                schema_name: p.schema,
                table_name: p.table,
                column_name,
                data_type: p.table === drift && column_name === 'description' ? 'jsonb' : data_type,
              }))
            ),
          };
        if (sql.includes("con.contype='p'"))
          return {
            rows: contracts
              .filter((p) => p.primaryKey.length)
              .map((p) => ({ schema_name: p.schema, table_name: p.table, columns: p.primaryKey })),
          };
        if (sql.includes("con.contype='f'"))
          return {
            rows: contracts.flatMap((p) =>
              p.foreignKeys.map((f) => ({
                child_schema: p.schema,
                child_table: p.table,
                parent_schema: f.parentSchema,
                parent_table: f.parentTable,
                child_columns: f.columns,
                parent_columns: f.parentColumns,
                delete_action: f.deleteAction,
              }))
            ),
          };
        if (sql.includes('FROM "public"."organizations"')) return { rows: [{ id: args[0] }] };
        const table = contracts.find((p) => sql.includes(`FROM "public"."${p.table}"`));
        if (!table) throw new Error('Unexpected SQL');
        expect(sql).toContain('"organization_id"::text=$1');
        expect(args).toEqual(['org-a']);
        expect(sql).not.toMatch(/SELECT\s+\*/i);
        const rows = (data[table.table] || []).filter((r) => r.organization_id === args[0]);
        return {
          rows: rows.map((r) =>
            Object.fromEntries(table.projection.filter((k) => k in r).map((k) => [k, r[k]]))
          ),
        };
      },
    } as unknown as PoolClient,
  };
}

const secret = 'PRIVATE_LINKED_CONTENT';
function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-a',
    organization_id: 'org-a',
    task_type: 'personal',
    source: 'manual',
    source_type: null,
    source_id: null,
    title: 'OWN_MANUAL_TITLE',
    description: 'OWN_MANUAL_DESCRIPTION',
    tags: '["owned"]',
    status: 'todo',
    priority: 'medium',
    assignee_id: 'user-a',
    reporter_id: 'user-a',
    created_at: '2026-09-12T00:00:00Z',
    ...overrides,
  };
}
describe('organization export personal task content boundary', () => {
  it('exports manual writer fields in JSON and CSV without exporting supplemental payloads or foreign rows', async () => {
    const rows = [
      task({ risks: { body: secret }, attachments: secret, custom_fields_json: secret }),
      task({ id: 'foreign', organization_id: 'org-b', title: secret }),
    ];
    const before = JSON.stringify(rows);
    const m = mockClient({ tasks: rows });
    const result = await exportOrganizationData(m.client, 'org-a', contracts);
    expect(result.tables.tasks).toHaveLength(1);
    for (const output of [JSON.stringify(result), organizationExportToCsv(result)]) {
      expect(output).toContain('OWN_MANUAL_TITLE');
      expect(output).toContain('OWN_MANUAL_DESCRIPTION');
      expect(output).not.toContain(secret);
    }
    expect(result.tables.tasks[0].export_payload_scope).toBe(
      'manual_personal_fields_supplemental_unresolved'
    );
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'tasks',
      reason: 'task_source_or_supplemental_content_privacy_unresolved',
    });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it.each([
    ['AI proposal', { source_type: 'ai_chat_proposal', source_id: 'proposal-a' }],
    ['private notebook', { source_type: 'notebook', source_id: 'private-note' }],
    ['partial provenance', { source_type: null, source_id: 'private-note' }],
    ['legacy source', { source: 'interview' }],
    ['missing source', { source: null }],
    ['linked initiative', { initiative_id: 'initiative-a' }],
    ['linked project', { project_id: 'project-a' }],
    ['typed execution task', { task_type: 'execution_task' }],
  ] as const)('keeps %s lineage without copied body', async (_label, patch) => {
    const m = mockClient({
      tasks: [task({ ...patch, title: secret, description: secret, tags: secret })],
    });
    const result = await exportOrganizationData(m.client, 'org-a', contracts);
    for (const output of [JSON.stringify(result), organizationExportToCsv(result)])
      expect(output).not.toContain(secret);
    expect(result.tables.tasks[0].id).toBe('task-a');
    expect(result.tables.tasks[0].export_payload_scope).toBe(
      'task_lineage_source_content_unresolved'
    );
    expect(result.securityManifest.complete).toBe(false);
  });
  it('does not query tasks after description type drift', async () => {
    const m = mockClient({ tasks: [task()] }, 'tasks');
    const result = await exportOrganizationData(m.client, 'org-a', contracts);
    expect(result.tables.tasks).toBeUndefined();
    expect(m.calls.some((s) => s.includes('FROM "public"."tasks"'))).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'tasks',
      reason: 'schema_projection_or_primary_key_drift',
    });
  });
});
