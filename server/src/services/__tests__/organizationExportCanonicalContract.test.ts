import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_EXPORT_CANONICAL_TABLES } from '../organizationExportCanonicalContract.js';
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
  source: 'unit root',
};
const contracts = [root, ...ORGANIZATION_EXPORT_CANONICAL_TABLES];
const secret = 'PRIVATE_SOURCE_BODY_DO_NOT_EXPORT';
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
                data_type: p.table === drift && column_name === 'payload_json' ? 'text' : data_type,
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
function state(type: string, version: number) {
  return {
    organization_id: 'org-a',
    aggregate_type: type,
    aggregate_id: 'same-id',
    version,
    payload_json: {
      initiativeId: 'initiative-1',
      decisionId: 'decision-1',
      executionCaseId: 'case-1',
      parentId: 'initiative-1',
      documentOrigin: 'runtime-v1',
      source: {
        proposalId: 'proposal-1',
        proposalVersion: 2,
        sourceType: 'interview',
        sourceId: 'source-1',
        sourceVersion: 7,
        rawAnswer: secret,
      },
      title: secret,
      problem: secret,
      accessToken: secret,
    },
    updated_at: '2026-09-12T00:00:00Z',
  };
}
describe('canonical export source contracts, mock client only', () => {
  it('keeps org/type/id/version and source lineage distinct while deferring private payload in JSON and CSV', async () => {
    const rows = [
      state('initiative', 3),
      state('decision', 4),
      { ...state('initiative', 99), organization_id: 'org-b', aggregate_id: 'FOREIGN_ID' },
    ];
    const before = JSON.stringify(rows);
    const { client } = mockClient({ ie_aggregate_state: rows });
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(result.tables.ie_aggregate_state).toHaveLength(2);
    expect(
      result.tables.ie_aggregate_state.map((r) => [r.aggregate_type, r.aggregate_id, r.version])
    ).toEqual([
      ['initiative', 'same-id', 3],
      ['decision', 'same-id', 4],
    ]);
    expect(result.tables.ie_aggregate_state[0].payload_json).toMatchObject({
      initiativeId: 'initiative-1',
      source: {
        proposalId: 'proposal-1',
        proposalVersion: 2,
        sourceType: 'interview',
        sourceId: 'source-1',
        sourceVersion: 7,
      },
    });
    for (const output of [JSON.stringify(result), organizationExportToCsv(result)]) {
      expect(output).not.toContain(secret);
      expect(output).not.toContain('FOREIGN_ID');
    }
    expect(result.securityManifest.complete).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'ie_aggregate_state',
      reason: 'canonical_content_privacy_unresolved_lineage_only',
    });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('keeps audit/card/receipt/relation versions and typed task linkage without copying free text', async () => {
    const data = {
      ie_audit_events: [
        {
          organization_id: 'org-a',
          id: 1,
          aggregate_type: 'execution_task',
          aggregate_id: 't1',
          aggregate_version: 5,
          payload_json: {
            taskId: 't1',
            initiativeId: 'i1',
            executionCaseId: 'c1',
            fromVersion: 4,
            toVersion: 5,
            description: secret,
          },
        },
      ],
      ie_command_receipts: [
        {
          organization_id: 'org-a',
          client_request_id: 'request-1',
          aggregate_type: 'execution_decision',
          aggregate_id: 'd1',
          aggregate_version: 6,
          request_fingerprint: secret,
          response_json: {
            decisionId: 'd1',
            executionCaseId: 'c1',
            initiativeId: 'i1',
            version: 6,
            rationale: secret,
          },
        },
      ],
      ie_aggregate_relations: [
        {
          organization_id: 'org-a',
          relation_type: 'SOURCE_INTERVIEW',
          source_type: 'source_proposal',
          source_id: 'p1',
          source_version: 2,
          target_type: 'initiative',
          target_id: 'i1',
          payload_json: { problem: secret },
        },
      ],
      ie_initiative_card_versions: [
        {
          organization_id: 'org-a',
          initiative_id: 'i1',
          card_key: 'tasks',
          card_version: 3,
          aggregate_version: 9,
          content_json: { initiativeId: 'i1', description: secret },
          evidence_refs_json: [secret],
          review_rationale: secret,
        },
      ],
    };
    const { client } = mockClient(data);
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(result.tables.ie_audit_events[0]).toMatchObject({
      aggregate_version: 5,
      payload_json: {
        taskId: 't1',
        executionCaseId: 'c1',
        initiativeId: 'i1',
        fromVersion: 4,
        toVersion: 5,
      },
    });
    expect(result.tables.ie_command_receipts[0]).toMatchObject({
      aggregate_version: 6,
      response_json: { decisionId: 'd1', executionCaseId: 'c1', initiativeId: 'i1', version: 6 },
    });
    expect(result.tables.ie_aggregate_relations[0]).toMatchObject({
      source_version: 2,
      source_id: 'p1',
      target_id: 'i1',
    });
    expect(result.tables.ie_initiative_card_versions[0]).toMatchObject({
      card_version: 3,
      aggregate_version: 9,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(organizationExportToCsv(result)).not.toContain(secret);
    expect(result.securityManifest.complete).toBe(false);
  });
  it('unknown generic aggregate type never gains payload authority from organization ownership', async () => {
    const row = state('future_private_aggregate', 1);
    const { client } = mockClient({ ie_aggregate_state: [row] });
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(result.tables.ie_aggregate_state[0].payload_json).toEqual({});
    expect(result.tables.ie_aggregate_state[0].export_payload_scope).toBe(
      'lineage_only_content_unresolved'
    );
    expect(result.securityManifest.complete).toBe(false);
  });
  it('schema mismatch blocks the provisional source contract before any row query', async () => {
    const { client, calls } = mockClient(
      { ie_aggregate_state: [state('initiative', 1)] },
      'ie_aggregate_state'
    );
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(result.tables.ie_aggregate_state).toBeUndefined();
    expect(calls.some((sql) => sql.includes('FROM "public"."ie_aggregate_state"'))).toBe(false);
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'ie_aggregate_state',
      reason: 'schema_projection_or_primary_key_drift',
    });
  });
});
