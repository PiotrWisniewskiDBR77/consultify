import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_EXPORT_MVP_TABLES } from '../organizationExportMvpContract.js';
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
const contracts = [
  root,
  ...ORGANIZATION_EXPORT_MVP_TABLES,
  ...ORGANIZATION_EXPORT_CANONICAL_TABLES,
];
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
function manualFixture() {
  const proposal = {
    organization_id: 'org-a',
    aggregate_type: 'source_proposal',
    aggregate_id: 'proposal-1',
    version: 1,
    payload_json: {
      proposalId: 'proposal-1',
      proposalVersion: 1,
      sourceType: 'MANUAL_HUB',
      sourceId: 'manual-source-1',
      sourceVersion: 1,
      title: 'VISIBLE_MANUAL_CONTENT',
      problem: 'VISIBLE_MANUAL_CONTENT',
      projectId: 'project-1',
      initiativeOwnerId: 'owner-1',
      visibility: 'PROJECT',
      provenance: {
        system: 'consultify.initiatives-hub',
        recordType: 'manual-initiative-proposal',
        capturedAt: '2026-09-12T00:00:00Z',
        evidenceRefs: ['consultify://initiatives/source-proposals/proposal-1'],
      },
    },
  };
  const initiative = {
    organization_id: 'org-a',
    aggregate_type: 'initiative',
    aggregate_id: 'initiative-1',
    version: 23,
    payload_json: {
      initiativeId: 'initiative-1',
      title: 'VISIBLE_MANUAL_CONTENT',
      problem: 'VISIBLE_MANUAL_CONTENT',
      projectId: 'project-1',
      visibility: 'PROJECT',
      source: {
        proposalId: 'proposal-1',
        proposalVersion: 2,
        sourceType: 'MANUAL_HUB',
        sourceId: 'manual-source-1',
        sourceVersion: 1,
        freshness: 'CURRENT',
      },
      apiToken: secret,
    },
  };
  const relation = {
    organization_id: 'org-a',
    relation_type: 'SOURCE_REGISTRATION',
    source_type: 'MANUAL_HUB',
    source_id: 'manual-source-1',
    source_version: 1,
    target_type: 'initiative',
    target_id: 'initiative-1',
    payload_json: { proposalId: 'proposal-1', proposalVersion: 1, disposition: 'REGISTER' },
  };
  const project = { id: 'project-1', organization_id: 'org-a', name: 'Project' };
  return {
    proposal,
    initiative,
    relation,
    project,
    data: {
      ie_aggregate_state: [proposal, initiative],
      ie_aggregate_relations: [relation],
      projects: [project],
    },
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
  it('verified manual Hub provenance plus registration preserves current content and two distinct proposal version meanings', async () => {
    const f = manualFixture();
    const before = JSON.stringify(f.data);
    const { client } = mockClient(f.data);
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(result.tables.ie_aggregate_state.map((r) => r.export_payload_scope)).toEqual([
      'verified_manual_hub_content',
      'verified_manual_hub_content',
    ]);
    expect(result.tables.ie_aggregate_state[1]).toMatchObject({
      version: 23,
      payload_json: {
        title: 'VISIBLE_MANUAL_CONTENT',
        source: { proposalVersion: 2, sourceVersion: 1 },
      },
    });
    expect(result.tables.ie_aggregate_state[0]).toMatchObject({
      version: 1,
      payload_json: { proposalVersion: 1 },
    });
    for (const output of [JSON.stringify(result), organizationExportToCsv(result)]) {
      expect(output).toContain('VISIBLE_MANUAL_CONTENT');
      expect(output).not.toContain(secret);
    }
    expect(
      result.securityManifest.unresolvedTables.some((e) => e.table === 'ie_aggregate_state')
    ).toBe(false);
    expect(result.securityManifest.complete).toBe(false); // relation content still pending
    expect(JSON.stringify(f.data)).toBe(before);
  });
  it.each([
    'source-backed',
    'private-reference',
    'missing-registration',
    'foreign-registration',
    'wrong-source-version',
    'wrong-proposal-version',
    'foreign-project',
  ])('manual source label alone does not authorize content: %s', async (reason) => {
    const f = manualFixture();
    if (reason === 'source-backed')
      f.proposal.payload_json.provenance.recordType = 'source-backed-initiative-proposal';
    if (reason === 'private-reference')
      f.proposal.payload_json.provenance.evidenceRefs.push(
        'consultify://interview/private-session'
      );
    if (reason === 'missing-registration') f.data.ie_aggregate_relations = [];
    if (reason === 'foreign-registration') f.relation.organization_id = 'org-b';
    if (reason === 'wrong-source-version') f.initiative.payload_json.source.sourceVersion = 2;
    if (reason === 'wrong-proposal-version') f.initiative.payload_json.source.proposalVersion = 1;
    if (reason === 'foreign-project') f.project.organization_id = 'org-b';
    const { client } = mockClient(f.data);
    const result = await exportOrganizationData(client, 'org-a', contracts);
    const initiative = result.tables.ie_aggregate_state.find(
      (r) => r.aggregate_type === 'initiative'
    )!;
    expect(initiative.export_payload_scope).toBe('lineage_only_content_unresolved');
    expect(initiative.payload_json).not.toHaveProperty('title');
    expect(result.securityManifest.unresolvedTables).toContainEqual({
      table: 'ie_aggregate_state',
      reason: 'canonical_content_privacy_unresolved_lineage_only',
    });
  });
  it('current manual parent cannot grant historical or typed child payload authority', async () => {
    const f = manualFixture();
    const { client } = mockClient({
      ...f.data,
      ie_audit_events: [
        {
          organization_id: 'org-a',
          id: 1,
          aggregate_type: 'initiative',
          aggregate_id: 'initiative-1',
          aggregate_version: 2,
          payload_json: { after: { source: { sourceType: 'interview' }, problem: secret } },
        },
      ],
      ie_initiative_card_versions: [
        {
          organization_id: 'org-a',
          initiative_id: 'initiative-1',
          card_key: 'problem',
          card_version: 1,
          aggregate_version: 2,
          content_json: { problem: secret },
        },
      ],
      ie_aggregate_state: [
        ...f.data.ie_aggregate_state,
        {
          ...state('execution_task', 3),
          payload_json: { taskId: 't1', initiativeId: 'initiative-1', description: secret },
        },
      ],
    });
    const result = await exportOrganizationData(client, 'org-a', contracts);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(
      result.tables.ie_aggregate_state.find((r) => r.aggregate_type === 'execution_task')!
        .export_payload_scope
    ).toBe('lineage_only_content_unresolved');
    expect(result.securityManifest.complete).toBe(false);
  });
});
