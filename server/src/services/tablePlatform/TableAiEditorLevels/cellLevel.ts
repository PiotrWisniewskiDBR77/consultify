/**
 * Level 1: Cell Edit (Block C · EPIC-T10 · Sprint C-S2 · live handler).
 *
 * Refines a single cell value: one record × one field. The LLM proposes
 * a new value; the handler builds an `op_cell_set` envelope with explicit
 * before/after diff. Manual override flag is always `false` here — that
 * flag is only flipped when a human later edits the AI-derived value.
 *
 * Inputs from `context`:
 *   - `recordId` (required)
 *   - `fieldId`  (required)
 *   - any additional sibling field hints to anchor the proposal
 *
 * Cross-tenant defense: `assertTableInOrganization` runs before any LLM
 * call so a forged `tableId` from a compromised JWT cannot leak data.
 *
 * If the LLM provider is the deterministic stub, the handler returns
 * `{operations: [], summary: '[stub:cell] …', confidence: 0}` so the
 * audit/budget pipeline is exercisable without a network roundtrip.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';
import {
  assertTableInOrganization,
  clampConfidence,
  fenceUntrusted,
  loadRecord,
  loadTableFields,
  logHandlerError,
  safeJson,
} from './handlerHelpers.js';
import { getLlmProvider } from './llmProvider.js';
import { opCellSet } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: refine the value of ONE cell (one record, one field) in a table.
You return a JSON object that strictly matches:
{
  "after": <new_value>,           // primitive matching the field type, or null
  "summary": "<one-sentence summary>",
  "warnings": ["..."],            // optional
  "confidence": <0..1>
}
Rules:
  - Do NOT propose changes to other cells.
  - If the requested value cannot be inferred from the supplied context,
    return {"after": null, "summary": "Cannot infer value", "confidence": 0}.
  - Respect the field type: dates as ISO 8601, numbers as plain JSON numbers,
    enum values from select options.`;

export const proposeCellEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;
  const recordId = asString(context.recordId);
  const fieldId = asString(context.fieldId);

  if (!recordId || !fieldId) {
    return {
      handlerStatus: 'live',
      summary: '[cell] context.recordId and context.fieldId are required.',
      operations: [],
      warnings: ['cell_context_missing_record_or_field'],
      confidence: 0,
    };
  }

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[cell] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['cell_tenant_violation'],
      confidence: 0,
    };
  }

  const [fields, record] = await Promise.all([loadTableFields(tableId), loadRecord(tableId, recordId)]);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) {
    return {
      handlerStatus: 'live',
      summary: '[cell] target field not found in this table.',
      operations: [],
      warnings: ['cell_field_not_found'],
      confidence: 0,
    };
  }
  if (!record) {
    return {
      handlerStatus: 'live',
      summary: '[cell] target record not found in this table.',
      operations: [],
      warnings: ['cell_record_not_found'],
      confidence: 0,
    };
  }

  const before = record.data[fieldId] ?? null;
  const userMessage = buildCellUserMessage(prompt, field, before, record);

  const provider = llmProvider ?? getLlmProvider();
  let llmText = '{}';
  let providerSource: 'live' | 'stub' = 'stub';
  try {
    const out = await provider.generate({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      responseFormat: 'json_object',
    });
    llmText = out.text;
    providerSource = out.source;
  } catch (e) {
    logHandlerError('cell', e, { tableId, recordId, fieldId });
    return {
      handlerStatus: 'live',
      summary: '[cell] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['cell_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    after?: unknown;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const after = parsed.after ?? null;
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[cell] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? (parsed.warnings.filter((w): w is string => typeof w === 'string'))
    : [];
  const confidence = clampConfidence(parsed.confidence);

  if (after === null || after === undefined) {
    return {
      handlerStatus: 'live',
      summary,
      operations: [],
      warnings: providerSource === 'stub' ? ['cell_stub_no_operation'] : warnings,
      confidence,
    };
  }

  const operationCandidate = {
    id: `op_cell_${fieldId}_${recordId}`,
    type: 'op_cell_set' as const,
    target: { tableId, recordId, fieldId },
    before,
    after,
    manualOverride: false as const,
  };

  const result = opCellSet.safeParse(operationCandidate);
  if (!result.success) {
    return {
      handlerStatus: 'live',
      summary: '[cell] LLM produced invalid operation envelope.',
      operations: [],
      warnings: [...warnings, 'cell_invalid_envelope'],
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

function buildCellUserMessage(
  userPrompt: string,
  field: { id: string; name: string; fieldType: string; options: Record<string, unknown> },
  before: unknown,
  record: { id: string; data: Record<string, unknown> }
): string {
  const fieldHeader = `Target field: name="${field.name}", id="${field.id}", type="${field.fieldType}"`;
  const optionsBlob =
    Object.keys(field.options).length > 0
      ? `\nField options: ${JSON.stringify(field.options).slice(0, 1500)}`
      : '';
  const beforeBlob = `\nCurrent value: ${JSON.stringify(before)}`;
  // Sibling fields, capped to keep context small.
  const siblings = Object.entries(record.data)
    .filter(([k]) => k !== field.id)
    .slice(0, 12)
    .map(([k, v]) => `  - ${k}: ${shorten(JSON.stringify(v))}`)
    .join('\n');
  const siblingBlob = siblings.length > 0 ? `\nOther fields on this record:\n${siblings}` : '';

  return [
    fieldHeader + optionsBlob + beforeBlob + siblingBlob,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}

function shorten(s: string): string {
  return s.length > 200 ? `${s.slice(0, 200)}…` : s;
}
