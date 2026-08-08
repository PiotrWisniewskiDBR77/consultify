/**
 * Level 3: Column Edit (Block C · EPIC-T10 · Sprint C-S2 · live handler).
 *
 * Bulk-fills one column across many records. Always operates on a
 * caller-supplied `visibleRecordIds` list — we never iterate the full
 * table here because that would expose ACL-filtered records to the LLM.
 *
 * Inputs from `context`:
 *   - `fieldId`           (required)
 *   - `visibleRecordIds`  (required, length 1..200)
 *
 * Output: a single `op_column_fill` operation whose `cells[]` contains
 * one entry per record the LLM proposes to change. Records the LLM
 * decides not to change are silently dropped (no noisy "no-op" entries).
 *
 * Cap: max 200 visible records (defends prompt token budget). If the
 * caller passes more, we truncate and add a warning.
 */

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
import { opColumnFill } from './operations.js';

const MAX_VISIBLE_RECORDS = 200;

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: fill values for ONE column across the supplied list of records.
You return a JSON object that strictly matches:
{
  "cells": [
    { "recordId": "<id>", "after": <new_value> }
  ],
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - Only return entries for records you ACTUALLY want to change. Skip the
    rest; do not emit no-op entries.
  - Respect the field type. Dates as ISO 8601, numbers as plain numbers,
    enum values from select options.
  - If you cannot infer values for any record, return {"cells": [], "confidence": 0}.`;

export const proposeColumnEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;
  const fieldId = asString(context.fieldId);
  const rawIds = Array.isArray(context.visibleRecordIds)
    ? context.visibleRecordIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];

  if (!fieldId) {
    return {
      handlerStatus: 'live',
      summary: '[column] context.fieldId is required.',
      operations: [],
      warnings: ['column_context_missing_field'],
      confidence: 0,
    };
  }
  if (rawIds.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[column] context.visibleRecordIds is required and non-empty.',
      operations: [],
      warnings: ['column_context_no_visible_records'],
      confidence: 0,
    };
  }

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[column] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['column_tenant_violation'],
      confidence: 0,
    };
  }

  const truncated = rawIds.length > MAX_VISIBLE_RECORDS;
  const visibleIds = truncated ? rawIds.slice(0, MAX_VISIBLE_RECORDS) : rawIds;

  const [fields, records] = await Promise.all([
    loadTableFields(tableId),
    loadRecords(tableId, visibleIds),
  ]);
  const field = fields.find((f) => f.id === fieldId);
  if (!field) {
    return {
      handlerStatus: 'live',
      summary: '[column] target field not found in this table.',
      operations: [],
      warnings: ['column_field_not_found'],
      confidence: 0,
    };
  }
  if (records.length === 0) {
    return {
      handlerStatus: 'live',
      summary: '[column] no records found from the supplied visible-record IDs.',
      operations: [],
      warnings: ['column_no_records_loaded'],
      confidence: 0,
    };
  }

  const userMessage = buildColumnUserMessage(prompt, field, records);

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
    logHandlerError('column', e, { tableId, fieldId, recordCount: records.length });
    return {
      handlerStatus: 'live',
      summary: '[column] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['column_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    cells?: Array<{ recordId?: unknown; after?: unknown }>;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[column] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  if (truncated) warnings.push('column_visible_records_truncated_to_200');
  const confidence = clampConfidence(parsed.confidence);

  const recordsById = new Map(records.map((r) => [r.id, r]));
  const cells = (parsed.cells ?? [])
    .map((c) => {
      const rid = asString(c.recordId);
      if (!rid) return null;
      const record = recordsById.get(rid);
      if (!record) return null; // LLM tried to mutate a record outside the visible set
      const before = record.data[fieldId] ?? null;
      const after = c.after ?? null;
      if (after === null || after === undefined) return null;
      return { recordId: rid, before, after };
    })
    .filter((c) => c !== null);

  if (cells.length === 0) {
    return {
      handlerStatus: 'live',
      summary,
      operations: [],
      warnings: [...warnings, 'column_no_cells_proposed'],
      confidence,
    };
  }

  const operationCandidate = {
    id: `op_column_${fieldId}`,
    type: 'op_column_fill' as const,
    target: { tableId, fieldId },
    cells,
  };

  const result = opColumnFill.safeParse(operationCandidate);
  if (!result.success) {
    return {
      handlerStatus: 'live',
      summary: '[column] LLM produced invalid operation envelope.',
      operations: [],
      warnings: [...warnings, 'column_invalid_envelope'],
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

function buildColumnUserMessage(
  userPrompt: string,
  field: { id: string; name: string; fieldType: string; options: Record<string, unknown> },
  records: Array<{ id: string; data: Record<string, unknown> }>
): string {
  const fieldHeader = `Target column: name="${field.name}", id="${field.id}", type="${field.fieldType}"`;
  const optionsBlob =
    Object.keys(field.options).length > 0
      ? `\nField options: ${JSON.stringify(field.options).slice(0, 1500)}`
      : '';
  const recordsList = records
    .map((r) => {
      const current = r.data[field.id];
      const otherFields = Object.entries(r.data)
        .filter(([k]) => k !== field.id)
        .slice(0, 8)
        .map(([k, v]) => `${k}=${shorten(JSON.stringify(v))}`)
        .join(', ');
      return `  - id="${r.id}" current=${JSON.stringify(current ?? null)} ${otherFields}`;
    })
    .join('\n');

  return [
    fieldHeader + optionsBlob,
    `Records (${records.length}):\n${recordsList}`,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}

function shorten(s: string): string {
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}
