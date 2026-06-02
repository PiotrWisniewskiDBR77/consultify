/**
 * Level 6: Relational Edit (Block C · EPIC-T10 · Sprint C-S3 · live handler).
 *
 * Proposes a new linkedRecord relation between two tables. Cross-tenant
 * invariant: BOTH endpoint tables MUST belong to the same workspace +
 * organization. The handler verifies both endpoints itself; the dispatcher
 * has already verified the source `tableId`.
 *
 * Inputs from `context`:
 *   - `candidateTargetTableIds` (optional): hints from the UI of nearby
 *     tables the LLM may reference. If absent, the handler queries
 *     `tp_tables` scoped to the same base for safety.
 *
 * Output: a single `op_relation_create` envelope. We never propose a
 * relation back to the same table (`fromTableId === toTableId`) since
 * those should be modeled with a self-reference (out of scope for v1).
 */

import { getDatabase } from '../../../database/Database.js';
import {
  assertTableInOrganization,
  clampConfidence,
  fenceUntrusted,
  loadTableFields,
  logHandlerError,
  safeJson,
} from './handlerHelpers.js';
import type { LevelHandler, LevelStubOutput } from './index.js';
import { getLlmProvider } from './llmProvider.js';
import { opRelationCreate } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: propose ONE new relation (linkedRecord) between two tables.
Never propose changes to records, fields beyond the new linkedRecord,
or other tables.
You return a JSON object that strictly matches:
{
  "fromTableId": "<source_table_id>",
  "toTableId":   "<target_table_id>",
  "fromFieldName": "<name_of_new_linkedRecord_field>",
  "bidirectional": true | false,
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - The source table is the one currently in scope.
  - Both ids must come from the supplied list of candidate tables.
  - Field name should be a singular noun (e.g. "Owner", "Project").`;

export const proposeRelationalEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[relational] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['relational_tenant_violation'],
      confidence: 0,
    };
  }

  // Resolve candidate target tables. Either trust the caller-supplied
  // list (frontend hint) or fall back to the same-base scan.
  const supplied = Array.isArray(context.candidateTargetTableIds)
    ? context.candidateTargetTableIds.filter(
        (s): s is string => typeof s === 'string' && s.length > 0
      )
    : null;
  const candidates =
    supplied && supplied.length > 0
      ? await filterCandidatesInTenant(supplied, organizationId, workspaceId)
      : await listSameBaseTables(tableId, organizationId, workspaceId);
  const candidateIds = candidates.map((c) => c.id).filter((id) => id !== tableId);

  if (candidateIds.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[relational] no candidate target tables in this base/workspace.',
      operations: [],
      warnings: ['relational_no_candidates'],
      confidence: 0,
    };
  }

  const fields = await loadTableFields(tableId);
  const userMessage = buildRelationalUserMessage(prompt, tableId, fields, candidates);

  const provider = llmProvider ?? getLlmProvider();
  let llmText = '{}';
  try {
    const out = await provider.generate({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      responseFormat: 'json_object',
    });
    llmText = out.text;
  } catch (e) {
    logHandlerError('relational', e, { tableId });
    return {
      handlerStatus: 'live',
      summary: '[relational] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['relational_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    fromTableId?: unknown;
    toTableId?: unknown;
    fromFieldName?: unknown;
    bidirectional?: unknown;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[relational] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);

  const fromTableId = String(parsed.fromTableId ?? tableId);
  const toTableId = String(parsed.toTableId ?? '');
  const fromFieldName = asString(parsed.fromFieldName);
  const bidirectional = parsed.bidirectional === true;

  if (fromTableId !== tableId) {
    warnings.push('relational_from_table_overridden');
  }
  if (!fromFieldName) {
    return {
      handlerStatus: 'live',
      summary: '[relational] missing fromFieldName.',
      operations: [],
      warnings: [...warnings, 'relational_missing_field_name'],
      confidence,
    };
  }
  if (!candidateIds.includes(toTableId)) {
    return {
      handlerStatus: 'live',
      summary: '[relational] toTableId not in candidate set (cross-tenant or unrelated).',
      operations: [],
      warnings: [...warnings, 'relational_target_not_in_candidates'],
      confidence,
    };
  }
  if (toTableId === tableId) {
    return {
      handlerStatus: 'live',
      summary: '[relational] self-reference not supported.',
      operations: [],
      warnings: [...warnings, 'relational_self_reference'],
      confidence,
    };
  }

  const result = opRelationCreate.safeParse({
    type: 'op_relation_create',
    id: `op_rel_${tableId}_${toTableId}`,
    target: { tableId },
    payload: { fromTableId: tableId, toTableId, fromFieldName, bidirectional },
  });
  if (!result.success) {
    return {
      handlerStatus: 'live',
      summary: '[relational] LLM produced invalid envelope.',
      operations: [],
      warnings: [...warnings, 'relational_invalid_envelope'],
      confidence: 0,
    };
  }

  return {
    handlerStatus: 'live',
    summary,
    operations: [result.data],
    warnings,
    confidence,
  };
};

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

interface CandidateTable {
  id: string;
  name: string;
}

async function filterCandidatesInTenant(
  candidateIds: string[],
  organizationId: string,
  workspaceId: string
): Promise<CandidateTable[]> {
  if (candidateIds.length === 0) return [];
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT t.id, t.name
       FROM tp_tables t
       JOIN tp_bases  b ON t.base_id = b.id
      WHERE b.organization_id = $1
        AND b.workspace_id    = $2
        AND t.id = ANY($3::uuid[])`,
    [organizationId, workspaceId, candidateIds]
  );
  return rows.map((r: any) => ({ id: String(r.id), name: String(r.name) }));
}

async function listSameBaseTables(
  tableId: string,
  organizationId: string,
  workspaceId: string
): Promise<CandidateTable[]> {
  const db = getDatabase();
  const { rows } = await db.query(
    `SELECT t2.id, t2.name
       FROM tp_tables t1
       JOIN tp_bases  b ON t1.base_id = b.id
       JOIN tp_tables t2 ON t2.base_id = t1.base_id
      WHERE t1.id = $1
        AND b.organization_id = $2
        AND b.workspace_id    = $3
        AND t2.id <> t1.id`,
    [tableId, organizationId, workspaceId]
  );
  return rows.map((r: any) => ({ id: String(r.id), name: String(r.name) }));
}

function buildRelationalUserMessage(
  userPrompt: string,
  sourceTableId: string,
  sourceFields: Array<{ id: string; name: string; fieldType: string }>,
  candidates: CandidateTable[]
): string {
  const fieldList = sourceFields
    .slice(0, 30)
    .map((f) => `  - ${f.name} (${f.fieldType})`)
    .join('\n');
  const candidateList = candidates.map((c) => `  - id="${c.id}" name="${c.name}"`).join('\n');
  return [
    `Source table id="${sourceTableId}".`,
    `Source-table fields:\n${fieldList || '  (none)'}`,
    `Candidate target tables:\n${candidateList || '  (none)'}`,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}
