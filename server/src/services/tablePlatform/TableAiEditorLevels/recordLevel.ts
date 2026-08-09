/**
 * Level 2: Record Edit (Block C · EPIC-T10 · Sprint C-S2 · live handler).
 *
 * Fills missing fields on a single record using the LLM. Produces an
 * `op_record_update` envelope with one entry per changed field. Empty
 * proposals (no fields needed filling) return `{operations: []}` so the
 * UI can show "nothing to do" without writing a noisy proposal row.
 *
 * Inputs from `context`:
 *   - `recordId`     (required)
 *   - `targetFields` (optional array of field IDs to fill; defaults to "all empty")
 *
 * Cross-tenant defense + stub fallback identical to cell handler.
 */

import {
  assertTableInOrganization,
  clampConfidence,
  fenceUntrusted,
  loadRecord,
  loadTableFields,
  logHandlerError,
  safeJson,
} from './handlerHelpers.js';
import type { LevelHandler, LevelStubOutput } from './index.js';
import { getLlmProvider } from './llmProvider.js';
import { opRecordUpdate } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: fill missing fields on ONE record. Other records are out of scope.
You return a JSON object that strictly matches:
{
  "fieldChanges": [
    { "fieldId": "<id>", "after": <new_value> }
  ],
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - Only include fieldChanges for fields whose current value is null/empty
    or where the user explicitly asks to overwrite.
  - Respect the field type: dates as ISO 8601, numbers as plain numbers.
  - If nothing should change, return {"fieldChanges": [], "confidence": 0}.`;

export const proposeRecordEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;
  const recordId = asString(context.recordId);
  const requestedFieldIds = Array.isArray(context.targetFields)
    ? context.targetFields.filter((f): f is string => typeof f === 'string')
    : null;

  if (!recordId) {
    return {
      handlerStatus: 'live',
      summary: '[record] context.recordId is required.',
      operations: [],
      warnings: ['record_context_missing_id'],
      confidence: 0,
    };
  }

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[record] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['record_tenant_violation'],
      confidence: 0,
    };
  }

  const [fields, record] = await Promise.all([
    loadTableFields(tableId),
    loadRecord(tableId, recordId),
  ]);
  if (!record) {
    return {
      handlerStatus: 'live',
      summary: '[record] target record not found in this table.',
      operations: [],
      warnings: ['record_not_found'],
      confidence: 0,
    };
  }

  // Determine candidate fields: explicit list OR fields with null/missing values.
  const candidateFields =
    requestedFieldIds && requestedFieldIds.length > 0
      ? fields.filter((f) => requestedFieldIds.includes(f.id))
      : fields.filter((f) => {
          const v = record.data[f.id];
          return v === undefined || v === null || v === '';
        });

  if (candidateFields.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[record] no candidate fields to fill on this record.',
      operations: [],
      warnings: ['record_no_candidate_fields'],
      confidence: 0,
    };
  }

  const userMessage = buildRecordUserMessage(prompt, candidateFields, record);

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
    logHandlerError('record', e, { tableId, recordId });
    return {
      handlerStatus: 'live',
      summary: '[record] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['record_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    fieldChanges?: Array<{ fieldId?: unknown; after?: unknown }>;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[record] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);

  const fieldChanges = (parsed.fieldChanges ?? [])
    .map((c) => {
      const fid = asString(c.fieldId);
      if (!fid) return null;
      const fld = candidateFields.find((f) => f.id === fid);
      if (!fld) return null; // LLM tried to mutate a field outside the candidate set
      const before = record.data[fid] ?? null;
      const after = c.after ?? null;
      if (after === null || after === undefined) return null;
      return { fieldId: fid, before, after };
    })
    .filter((c) => c !== null);

  if (fieldChanges.length === 0) {
    return {
      handlerStatus: 'live',
      summary,
      operations: [],
      warnings: [...warnings, 'record_no_changes'],
      confidence,
    };
  }

  const operationCandidate = {
    id: `op_record_${recordId}`,
    type: 'op_record_update' as const,
    target: { tableId, recordId },
    fieldChanges,
  };

  const result = opRecordUpdate.safeParse(operationCandidate);
  if (!result.success) {
    return {
      handlerStatus: 'live',
      summary: '[record] LLM produced invalid operation envelope.',
      operations: [],
      warnings: [...warnings, 'record_invalid_envelope'],
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

function buildRecordUserMessage(
  userPrompt: string,
  candidateFields: Array<{ id: string; name: string; fieldType: string }>,
  record: { id: string; data: Record<string, unknown> }
): string {
  const candidateList = candidateFields
    .map((f) => `  - ${f.name} (id="${f.id}", type="${f.fieldType}")`)
    .join('\n');
  const filledList = Object.entries(record.data)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 20)
    .map(([k, v]) => `  - ${k}: ${shorten(JSON.stringify(v))}`)
    .join('\n');
  return [
    `Candidate fields to fill on record id="${record.id}":\n${candidateList}`,
    filledList.length > 0 ? `Already-filled fields on this record:\n${filledList}` : '',
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function shorten(s: string): string {
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}
