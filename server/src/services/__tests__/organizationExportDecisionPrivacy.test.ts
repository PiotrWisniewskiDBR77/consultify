import { describe, expect, it } from 'vitest';

import {
  createFindingGenerationReceiptPayload,
  findingGenerationReceiptId,
} from '../interviewInsightFindingGenerationReceipt.js';
import { canExportInterviewDecisionContent } from '../organizationExportDecisionPrivacy.js';
function fixture() {
  const at = '2026-09-12T10:00:00Z',
    later = '2026-09-12T11:00:00Z';
  const pointer = {
    pointerId: 'p',
    type: 'question_answer',
    sourceRef: 'answer:q',
    sourceFingerprint: 'answer:q',
    capturedExcerpt: 'ANSWER',
    capturedAt: at,
    isTombstone: false,
  };
  const payload = {
    source_finding_id: 'f',
    source_insight_artifact_id: 'i',
    finding_statement: 'FINDING',
    limits: 'LIMIT',
    next_action: 'ACTION',
    evidence_pointers: [pointer],
  };
  const decision = {
    id: 'd',
    organization_id: 'a',
    source_type: 'interview_insight',
    source_id: 'f',
    title: 'FINDING',
    description:
      'FINDING\n\nLimits: LIMIT\n\nRecommended next action: ACTION\n\nEvidence (1):\n- ANSWER',
  };
  const sources = {
    handoffs: [
      {
        id: 'h',
        organization_id: 'a',
        target_id: 'd',
        finding_id: 'f',
        insight_id: 'i',
        target_kind: 'decision',
        status: 'linked',
        target_ref_type: 'linked',
        created_at: later,
        payload_json: JSON.stringify(payload),
      },
    ],
    findings: [
      {
        id: 'f',
        organization_id: 'a',
        insight_id: 'i',
        created_at: at,
        source_section_type: 'theme',
        source_section_index: 0,
        source_key: 'theme:0',
        confidence_level: 'high',
        limits_json: '["LIMIT"]',
        next_action_json: '["ACTION"]',
        created_by: 'admin',
        updated_at: at,
        readback_status: 'confirmed_by_client',
        finding_statement: 'FINDING',
        limits_text: 'LIMIT',
        next_action_text: 'ACTION',
      },
    ],
    insights: [
      {
        id: 'i',
        organization_id: 'a',
        status: 'completed',
        error_message: null as unknown,
        updated_at: at,
        context_mode: 'selected_interview_material_only',
        filters: null as unknown,
        topic_focus_json: '[]',
        source_session_ids: '["s"]',
        analysis_scope_json: JSON.stringify({
          source_session_ids: ['s'],
          context_mode: 'selected_interview_material_only',
          source_scope_status: 'approved_only',
          topic_focus: [],
        }),
        generation_context_json: JSON.stringify({
          createdAt: '2026-09-12T09:59:00Z',
          generationRun: {
            version: 1,
            runId: 'run-current',
            status: 'completed',
            startedAt: '2026-09-12T09:59:00Z',
            completedAt: at,
          },
          contextMode: 'selected_interview_material_only',
          topicFocus: [],
          evidenceEnrichment: {
            version: 1,
            lookupComplete: true,
            questionIds: ['q'],
            evidenceIds: [],
            knowledgeDocumentIds: [],
          },
          approvedOrgKnowledgePack: { included: false, sourceCount: 0, sources: [] },
          contextDocuments: { selectedIds: [], documents: [] },
        }),
      },
    ],
    pointers: [
      {
        id: 'p',
        organization_id: 'a',
        insight_id: 'i',
        finding_id: 'f',
        updated_at: at,
        pointer_state: 'active',
        pointer_type: 'question_answer',
        source_ref: 'answer:q',
        source_fingerprint: 'answer:q',
        captured_excerpt: 'ANSWER',
        captured_at: at,
        created_at: at,
        created_by: 'admin',
        duplicate_observed_count: 0,
        metadata_json: '{}',
      },
    ],
    questions: [{ id: 'q', organization_id: 'a', session_id: 's', updated_at: at }],
    sessions: [
      {
        id: 's',
        organization_id: 'a',
        updated_at: at,
        is_anonymous: false as unknown,
        owner_id: 'respondent',
      },
    ],
  };
  const payloadReceipt = createFindingGenerationReceiptPayload({
    organizationId: 'a',
    insightId: 'i',
    findingId: 'f',
    generationRunId: 'run-current',
    generationStartedAt: '2026-09-12T09:59:00Z',
    generationCompletedAt: at,
    generationContextJson: sources.insights[0].generation_context_json,
    finding: sources.findings[0],
    pointers: sources.pointers,
  });
  return {
    decision,
    sources: {
      ...sources,
      findingReceiptSnapshotVerified: true,
      findingReceiptInvalidations: [] as Record<string, unknown>[],
      findingReceipts: [
        {
          id: findingGenerationReceiptId('f'),
          organization_id: 'a',
          insight_id: 'i',
          finding_id: 'f',
          entity_type: 'finding_generation_receipt',
          entity_id: 'f',
          action: 'finding_generation_bound_v1',
          detail_json: JSON.stringify(payloadReceipt),
          created_at: at,
        },
      ],
    },
  };
}

it('denies timestamp-compatible Finding content without an immutable generation receipt', () => {
  const f = fixture();
  const sources = { ...f.sources, findingReceipts: [] };
  expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', sources)).toBe(false);
});
it('denies a creation receipt whose snapshot collection was not verified', () => {
  const f = fixture();
  f.sources.findingReceiptSnapshotVerified = false;
  expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
});
it('denies edit then restore when a permanent invalidation marker remains', () => {
  const f = fixture();
  const original = f.sources.findings[0].finding_statement;
  f.sources.findings[0].finding_statement = 'edited';
  f.sources.findings[0].finding_statement = original;
  f.sources.findingReceiptInvalidations.push({
    id: 'finding-generation-invalidated-v1:f',
    organization_id: 'a',
    insight_id: 'i',
    finding_id: 'f',
    entity_id: 'f',
    entity_type: 'finding_generation_receipt',
    action: 'finding_generation_invalidated_v1',
    created_at: f.sources.findings[0].created_at,
  });
  expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
});
it('denies a foreign generation receipt even with matching Finding and run identifiers', () => {
  const f = fixture();
  f.sources.findingReceipts[0].organization_id = 'b';
  expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
});
describe('Interview Decision content authority', () => {
  it('permits unchanged nonanonymous snapshot without mutating source', () => {
    const f = fixture(),
      before = JSON.stringify(f);
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(true);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('permits anonymous respondent but denies other admin', () => {
    const f = fixture();
    f.sources.sessions[0].is_anonymous = true;
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'respondent', f.sources)).toBe(true);
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
  });
  const cases: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
    [
      'foreign question',
      (f) => {
        f.sources.questions[0].organization_id = 'b';
      },
    ],
    [
      'foreign session',
      (f) => {
        f.sources.sessions[0].organization_id = 'b';
      },
    ],
    [
      'foreign finding',
      (f) => {
        f.sources.findings[0].organization_id = 'b';
      },
    ],
    [
      'foreign insight',
      (f) => {
        f.sources.insights[0].organization_id = 'b';
      },
    ],
    [
      'missing receipt',
      (f) => {
        f.sources.handoffs = [];
      },
    ],
    [
      'ambiguous receipt',
      (f) => {
        f.sources.handoffs.push({ ...f.sources.handoffs[0] });
      },
    ],
    [
      'receipt without target kind',
      (f) => {
        delete f.sources.handoffs[0].target_kind;
      },
    ],
    [
      'cross-kind initiative receipt for Decision target',
      (f) => {
        f.sources.handoffs[0].target_kind = 'initiative';
      },
    ],
    [
      'changed copied body',
      (f) => {
        f.decision.description = 'OTHER_PRIVATE_BODY';
      },
    ],
    [
      'changed source after handoff',
      (f) => {
        f.sources.questions[0].updated_at = '2026-09-12T12:00:00Z';
      },
    ],
    [
      'unknown anonymity',
      (f) => {
        f.sources.sessions[0].is_anonymous = null;
      },
    ],
    [
      'NULL provenance',
      (f) => {
        f.decision.source_type = '';
      },
    ],
    [
      'unconfirmed readback',
      (f) => {
        f.sources.findings[0].readback_status = 'draft';
      },
    ],
    [
      'malformed generation metadata',
      (f) => {
        f.sources.insights[0].generation_context_json = '{}';
      },
    ],
    [
      'approved organization knowledge',
      (f) => {
        const c = JSON.parse(f.sources.insights[0].generation_context_json);
        c.approvedOrgKnowledgePack.included = true;
        f.sources.insights[0].generation_context_json = JSON.stringify(c);
      },
    ],
    [
      'selected context document',
      (f) => {
        const c = JSON.parse(f.sources.insights[0].generation_context_json);
        c.contextDocuments.selectedIds = ['private'];
        f.sources.insights[0].generation_context_json = JSON.stringify(c);
      },
    ],
    [
      'unlisted source session',
      (f) => {
        f.sources.questions[0].session_id = 'missing';
      },
    ],
    [
      'literal fingerprint with changed excerpt',
      (f) => {
        f.sources.pointers[0].captured_excerpt = 'PRIVATE';
      },
    ],
    [
      'tombstoned source',
      (f) => {
        f.sources.pointers[0].pointer_state = 'removed';
      },
    ],
    [
      'unknown pointer',
      (f) => {
        const p = JSON.parse(f.sources.handoffs[0].payload_json);
        p.evidence_pointers[0].type = 'operator_note';
        f.sources.handoffs[0].payload_json = JSON.stringify(p);
      },
    ],
  ];
  it.each(cases)('denies %s', (_name, mutate) => {
    const f = fixture();
    mutate(f);
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
  });
});

describe('Interview Decision generation-to-finding provenance', () => {
  it('denies failed insight retaining an older complete enrichment stamp', () => {
    const f = fixture();
    f.sources.insights[0].status = 'failed';
    f.sources.insights[0].error_message = 'controlled regeneration failure';
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
  });

  it('denies generating insight retaining an older complete enrichment stamp', () => {
    const f = fixture();
    f.sources.insights[0].status = 'generating';
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
  });

  it('denies a stale finding created before the current completed generation', () => {
    const f = fixture();
    f.sources.findings[0].created_at = '2026-09-12T09:00:00Z';
    f.sources.findings[0].updated_at = '2026-09-12T10:30:00Z';
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(false);
  });

  it('permits a confirmed finding created from the current completed generation', () => {
    const f = fixture();
    expect(canExportInterviewDecisionContent(f.decision, 'a', 'admin', f.sources)).toBe(true);
  });
});

import type { PoolClient } from 'pg';

import type { OrganizationExportTableContract } from '../organizationExportContract.js';
import { ORGANIZATION_EXPORT_DECISION_TABLES } from '../organizationExportDecisionContract.js';
import { ORGANIZATION_EXPORT_INTERVIEW_TABLES } from '../organizationExportInterviewContract.js';
import { exportOrganizationData } from '../organizationExportService.js';
import { organizationExportToCsv } from '../organizationLifecycleService.js';
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
  source: 'unit',
};
const contracts = [
  root,
  ...ORGANIZATION_EXPORT_DECISION_TABLES,
  ...ORGANIZATION_EXPORT_INTERVIEW_TABLES,
];
function engineClient(f: ReturnType<typeof fixture>) {
  // Actual ten-column audit catalog, deliberately absent from export contracts.
  const auditCatalog = {
    schema: 'public',
    table: 'interview_insight_audit_log',
    primaryKey: ['id'],
    columnTypes: {
      id: 'text',
      organization_id: 'text',
      insight_id: 'text',
      finding_id: 'text',
      entity_type: 'text',
      entity_id: 'text',
      action: 'text',
      actor_user_id: 'text',
      detail_json: 'text',
      created_at: 'timestamp without time zone',
    },
  };
  const discovered = [...contracts, auditCatalog];
  const data: Record<string, unknown[]> = {
    decisions: [
      { ...f.decision, options: 'SUPPLEMENTAL_PRIVATE' },
      { ...f.decision, id: 'foreign', organization_id: 'b', title: 'FOREIGN_PRIVATE' },
    ],
    interview_insights: f.sources.insights,
    interview_insight_findings: f.sources.findings,
    interview_insight_handoffs: f.sources.handoffs,
    interview_insight_evidence_pointers: f.sources.pointers,
    interview_sessions: f.sources.sessions,
    interview_questions: f.sources.questions,
  };
  return {
    query: async (sql: string, args: unknown[]) => {
      if (sql.includes('format_type('))
        return {
          rows: discovered.flatMap((p) =>
            Object.entries(p.columnTypes).map(([column_name, data_type]) => ({
              schema_name: p.schema,
              table_name: p.table,
              column_name,
              data_type,
            }))
          ),
        };
      if (sql.includes("con.contype='p'"))
        return {
          rows: discovered
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
      if (sql.includes('FROM "public"."organizations"')) return { rows: [{ id: 'a' }] };
      if (sql.includes('FROM public.interview_insight_audit_log')) {
        expect(sql).toContain('organization_id = $1');
        expect(sql).toContain('finding_id = ANY($2::text[])');
        expect(sql).toContain("created_at AT TIME ZONE 'UTC' AS created_at");
        const rows = [...f.sources.findingReceipts, ...f.sources.findingReceiptInvalidations];
        return {
          rows: rows.filter(
            (row) =>
              row.organization_id === args[0] &&
              (args[1] as string[]).includes(String(row.finding_id)) &&
              row.entity_type === args[2] &&
              (args[3] as string[]).includes(String(row.action))
          ),
        };
      }
      const p = contracts.find((p) => sql.includes(`FROM "public"."${p.table}"`));
      if (!p) throw Error('Unexpected SQL');
      expect(sql).toContain('"organization_id"::text=$1');
      expect(sql).not.toMatch(/SELECT\s+\*/i);
      if (['finding', 'pointer', 'handoff'].includes(String(p.decisionPrivacyKind))) {
        for (const column of p.projection.filter(
          (column) => p.columnTypes[column] === 'timestamp without time zone'
        )) {
          expect(sql).toContain(`"${column}" AT TIME ZONE 'UTC' AS "${column}"`);
        }
      }
      expect(args).toEqual(['a']);
      return {
        rows: (data[p.table] || [])
          .filter((r: any) => r.organization_id === 'a')
          .map((r: any) =>
            Object.fromEntries(p.projection.filter((k) => k in r).map((k) => [k, r[k]]))
          ),
      };
    },
  } as unknown as PoolClient;
}
describe('Decision source-aware export JSON CSV', () => {
  it.each([
    ['public', false, 'admin', true],
    ['respondent', true, 'respondent', true],
    ['other admin', true, 'admin', true],
  ] as const)(
    'exports %s with actor-scoped body and private supplemental exclusion',
    async (_name, anonymous, actor, allowed) => {
      const f = fixture();
      f.sources.sessions[0].is_anonymous = anonymous;
      const before = JSON.stringify(f);
      const r = await exportOrganizationData(engineClient(f), 'a', contracts, { actorId: actor });
      for (const output of [JSON.stringify(r), organizationExportToCsv(r)]) {
        expect(output.includes('FINDING')).toBe(allowed);
        expect(output).not.toContain('SUPPLEMENTAL_PRIVATE');
        expect(output).not.toContain('FOREIGN_PRIVATE');
        expect(output).not.toContain('findingSnapshotSha256');
        expect(output).not.toContain('generationContextSha256');
      }
      expect(r.tables.decisions).toHaveLength(1);
      expect(r.securityManifest.complete).toBe(false);
      expect(r.tables.interview_insight_audit_log).toBeUndefined();
      expect(r.securityManifest.unresolvedTables).toContainEqual({
        table: 'interview_insight_audit_log',
        reason: 'ownership_contract_unresolved',
      });
      expect(JSON.stringify(f)).toBe(before);
    }
  );
});

// Parent source finding: unrestricted prompt inputs can influence a copied finding
// even when every evidence pointer references an otherwise public session.
describe('Decision prompt-input privacy', () => {
  const inputs: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
    [
      'private customPrompt',
      (f) => {
        f.sources.insights[0].filters = JSON.stringify({ customPrompt: 'PRIVATE_PROMPT_SENTINEL' });
      },
    ],
    [
      'malformed filters',
      (f) => {
        f.sources.insights[0].filters = '{';
      },
    ],
    [
      'wrong customPrompt type',
      (f) => {
        f.sources.insights[0].filters = JSON.stringify({
          customPrompt: { private: 'PRIVATE_PROMPT_SENTINEL' },
        });
      },
    ],
    [
      'filters topicFocus',
      (f) => {
        f.sources.insights[0].filters = JSON.stringify({ topicFocus: ['PRIVATE_PROMPT_SENTINEL'] });
      },
    ],
    [
      'scope topic_focus',
      (f) => {
        const s = JSON.parse(f.sources.insights[0].analysis_scope_json);
        s.topic_focus = ['PRIVATE_PROMPT_SENTINEL'];
        f.sources.insights[0].analysis_scope_json = JSON.stringify(s);
      },
    ],
    [
      'stored topic_focus_json',
      (f) => {
        f.sources.insights[0].topic_focus_json = '["PRIVATE_PROMPT_SENTINEL"]';
      },
    ],
    [
      'generation topicFocus',
      (f) => {
        const c = JSON.parse(f.sources.insights[0].generation_context_json);
        c.topicFocus = ['PRIVATE_PROMPT_SENTINEL'];
        f.sources.insights[0].generation_context_json = JSON.stringify(c);
      },
    ],
    [
      'missing topic provenance',
      (f) => {
        f.sources.insights[0].topic_focus_json = '';
      },
    ],
  ];
  it.each(inputs)(
    'excludes copied content influenced by %s from JSON and CSV',
    async (_name, mutate) => {
      const f = fixture();
      mutate(f);
      const before = JSON.stringify(f);
      const result = await exportOrganizationData(engineClient(f), 'a', contracts, {
        actorId: 'admin',
      });
      for (const serialized of [JSON.stringify(result), organizationExportToCsv(result)]) {
        expect(serialized).toContain('FINDING');
        expect(serialized).not.toContain('PRIVATE_PROMPT_SENTINEL');
      }
      expect(result.tables.decisions).toHaveLength(1);
      expect(JSON.stringify(f)).toBe(before);
    }
  );
  it('preserves legal empty prompt inputs and unchanged source', async () => {
    const f = fixture();
    f.sources.insights[0].filters = JSON.stringify({ customPrompt: '  ', topicFocus: [] });
    const before = JSON.stringify(f);
    const result = await exportOrganizationData(engineClient(f), 'a', contracts, {
      actorId: 'admin',
    });
    for (const serialized of [JSON.stringify(result), organizationExportToCsv(result)])
      expect(serialized).toContain('FINDING');
    expect(JSON.stringify(f)).toBe(before);
  });
});

describe('Decision evidence-linked KB privacy', () => {
  it.each(['private KB', 'unresolved evidence', 'lookup failure', 'historical missing stamp'])(
    'excludes copied body with %s despite empty contextDocuments',
    async (variant) => {
      const f = fixture();
      const c = JSON.parse(f.sources.insights[0].generation_context_json);
      if (variant === 'private KB') {
        c.evidenceEnrichment.evidenceIds = ['e'];
        c.evidenceEnrichment.knowledgeDocumentIds = ['private-doc'];
      }
      if (variant === 'unresolved evidence') c.evidenceEnrichment.evidenceIds = ['e'];
      if (variant === 'lookup failure') c.evidenceEnrichment.lookupComplete = false;
      if (variant === 'historical missing stamp') delete c.evidenceEnrichment;
      f.sources.insights[0].generation_context_json = JSON.stringify(c);
      const before = JSON.stringify(f);
      const result = await exportOrganizationData(engineClient(f), 'a', contracts, {
        actorId: 'admin',
      });
      for (const serialized of [JSON.stringify(result), organizationExportToCsv(result)]) {
        expect(serialized).toContain('FINDING');
        expect(serialized).not.toContain('private-doc');
      }
      expect(result.tables.decisions).toHaveLength(1);
      expect(JSON.stringify(f)).toBe(before);
    }
  );
});
