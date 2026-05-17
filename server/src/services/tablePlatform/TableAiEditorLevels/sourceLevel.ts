/**
 * Level 8: Source Edit (Block C · EPIC-T10 · Sprint C-S3 · live handler).
 *
 * For records missing required sources (`tp_record_sources`), suggests
 * candidate sources (URLs / internal record refs / documents). The user
 * reviews the suggestion list; actual `tp_record_sources` rows are
 * created by C-S6 SourcePackBuilderService at apply time. C-S3 emits the
 * proposal envelope only.
 *
 * Super-admin-only (orchestrator gates this before dispatch).
 *
 * Inputs from `context`:
 *   - `recordIds` (optional). Subset to scan; defaults to all records on
 *     the table that have ZERO entries in `tp_record_sources`.
 *   - `requireFieldId` (optional). When present, the suggestion is
 *     scoped to that specific cell — the UI uses this for "Add source to
 *     this cell" workflows.
 */

import { getDatabase } from '../../../database/Database.js';
import {
  assertTableInOrganization,
  clampConfidence,
  fenceUntrusted,
  loadRecords,
  loadTableFields,
  logHandlerError,
  safeJson,
} from './handlerHelpers.js';
import type { LevelHandler, LevelStubOutput } from './index.js';
import { getLlmProvider } from './llmProvider.js';
import { opSourceSuggest } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: suggest CANDIDATE sources for records that are missing them.
You DO NOT create sources directly — you only propose candidates the user
will review and confirm.
You return a JSON object that strictly matches:
{
  "suggestions": [
    {
      "recordId": "<id>",
      "fieldId":  "<id_or_null>",
      "candidates": [
        {
          "kind": "url" | "internal_record" | "document",
          "ref":  "<url_or_record_id_or_doc_id>",
          "label": "<optional_human_readable>",
          "confidence": <0..1>
        }
      ]
    }
  ],
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - Each candidate MUST have a non-empty "ref".
  - At most 5 candidates per record (UI fan-out cap).
  - Confidence must be 0..1.`;

const MAX_RECORDS_FOR_SCAN = 50;
const MAX_CANDIDATES_PER_RECORD = 5;

export const proposeSourceEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[source] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['source_tenant_violation'],
      confidence: 0,
    };
  }

  const fields = await loadTableFields(tableId);
  const requireFieldId = asString(context.requireFieldId);

  // Resolve scan set: explicit list, or "records missing required sources".
  const askedIds = Array.isArray(context.recordIds)
    ? context.recordIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];

  let scannedIds: string[];
  if (askedIds.length > 0) {
    scannedIds = askedIds.slice(0, MAX_RECORDS_FOR_SCAN);
  } else {
    scannedIds = await listRecordsMissingSources(tableId, MAX_RECORDS_FOR_SCAN);
  }

  if (scannedIds.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[source] no records require source suggestions on this table.',
      operations: [],
      warnings: ['source_no_records_to_scan'],
      confidence: 0,
    };
  }

  const records = await loadRecords(tableId, scannedIds);
  if (records.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[source] could not load any records for scan.',
      operations: [],
      warnings: ['source_no_records_loaded'],
      confidence: 0,
    };
  }

  const userMessage = buildSourceUserMessage(prompt, fields, records, requireFieldId);

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
    logHandlerError('source', e, { tableId });
    return {
      handlerStatus: 'live',
      summary: '[source] LLM provider failed; no suggestions produced.',
      operations: [],
      warnings: ['source_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    suggestions?: Array<Record<string, unknown>>;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[source] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);

  const knownRecordIds = new Set(records.map((r) => r.id));
  const knownFieldIds = new Set(fields.map((f) => f.id));

  const operations = (parsed.suggestions ?? [])
    .map((suggestion, idx) => {
      const c = suggestion as Record<string, unknown>;
      const recordId = asString(c.recordId);
      if (!recordId || !knownRecordIds.has(recordId)) {
        if (recordId) warnings.push(`source_unknown_record_id:${recordId}`);
        return null;
      }
      const fieldId = asString(c.fieldId);
      if (fieldId && !knownFieldIds.has(fieldId)) {
        warnings.push(`source_unknown_field_id:${fieldId}`);
        return null;
      }
      const candidatesRaw = Array.isArray(c.candidates) ? c.candidates : [];
      const candidates = (candidatesRaw as Array<Record<string, unknown>>)
        .slice(0, MAX_CANDIDATES_PER_RECORD)
        .map((cand) => ({
          kind: String(cand.kind ?? 'url'),
          ref: String(cand.ref ?? ''),
          ...(asString(cand.label) ? { label: String(cand.label) } : {}),
          confidence: clampConfidence(cand.confidence),
        }))
        .filter((cand) => cand.ref.length > 0);
      if (candidates.length === 0) return null;

      const result = opSourceSuggest.safeParse({
        type: 'op_source_suggest',
        id: `op_src_${idx}`,
        target: { tableId, recordId },
        payload: { candidates, ...(fieldId ? { fieldId } : {}) },
      });
      return result.success ? result.data : null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

  if (operations.length === 0) {
    return {
      handlerStatus: 'live',
      summary,
      operations: [],
      warnings: [...warnings, 'source_no_suggestions'],
      confidence,
    };
  }

  return {
    handlerStatus: 'live',
    summary,
    operations,
    warnings,
    confidence,
  };
};

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

async function listRecordsMissingSources(tableId: string, limit: number): Promise<string[]> {
  // Best-effort lookup. Schema variant: tp_record_sources may not exist
  // on every deployment yet, so fall back gracefully.
  try {
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT r.id
         FROM tp_records r
         LEFT JOIN tp_record_sources s ON s.record_id = r.id
        WHERE r.table_id = $1
        GROUP BY r.id
       HAVING COUNT(s.id) = 0
        LIMIT $2`,
      [tableId, limit]
    );
    return rows.map((r: any) => String(r.id));
  } catch {
    const db = getDatabase();
    const { rows } = await db.query(`SELECT id FROM tp_records WHERE table_id = $1 LIMIT $2`, [
      tableId,
      limit,
    ]);
    return rows.map((r: any) => String(r.id));
  }
}

function buildSourceUserMessage(
  userPrompt: string,
  fields: Array<{ id: string; name: string; fieldType: string }>,
  records: Array<{ id: string; data: Record<string, unknown> }>,
  requireFieldId: string | null
): string {
  const fieldList = fields
    .slice(0, 30)
    .map((f) => `  - id="${f.id}" name="${f.name}" type="${f.fieldType}"`)
    .join('\n');
  const recordsBlock = records
    .map((r) => `  - id="${r.id}" data=${shorten(JSON.stringify(r.data))}`)
    .join('\n');
  return [
    `Table fields:\n${fieldList || '  (none)'}`,
    `Records lacking sources (${records.length}):\n${recordsBlock || '  (none)'}`,
    requireFieldId ? `Source must attach to fieldId="${requireFieldId}".` : '',
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function shorten(s: string): string {
  return s.length > 240 ? `${s.slice(0, 240)}…` : s;
}
