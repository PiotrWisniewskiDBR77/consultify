/**
 * Level 4: Structure Edit (Block C · EPIC-T10 · Sprint C-S2 · live handler).
 *
 * Proposes schema changes (add / rename / retype / drop a field) on the
 * target table. Operations match the contract consumed by
 * `chatToSchema.MutationExecutor` so when `applyProposal` finally wires
 * the executor (C-S5+), structure-level proposals flow through the same
 * battle-tested mutation pipeline as chat-to-schema.
 *
 * C-S2 scope: proposal only, no mutation. Apply path remains a stub.
 *
 * Inputs from `context`: none required — the prompt is the directive.
 *
 * Cross-tenant defense: `assertTableInOrganization` runs first.
 *
 * Note on retype/drop: the LLM is told to surface a `warning` for any
 * destructive operation so the UI can show a "this will lose data"
 * confirmation. Final confirmation lives at apply time.
 */

import type { LevelHandler, LevelStubOutput } from './index.js';
import {
  assertTableInOrganization,
  clampConfidence,
  fenceUntrusted,
  loadTableFields,
  logHandlerError,
  safeJson,
} from './handlerHelpers.js';
import { getLlmProvider } from './llmProvider.js';
import {
  opSchemaAddField,
  opSchemaDropField,
  opSchemaRenameField,
  opSchemaRetypeField,
  type OpSchemaAddField,
  type OpSchemaDropField,
  type OpSchemaRenameField,
  type OpSchemaRetypeField,
} from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: propose SCHEMA changes on ONE table — add, rename, retype, or drop fields.
You return a JSON object that strictly matches:
{
  "operations": [
    {
      "type": "op_schema_add_field" | "op_schema_rename_field" | "op_schema_retype_field" | "op_schema_drop_field",
      "id": "<unique_string>",
      "fieldId": "<existing_field_id_for_rename/retype/drop>",
      "name": "<new_field_name_for_add>",
      "fieldType": "<for add or retype>",
      "options": <optional_field_options>,
      "from": "<old_name_for_rename>",
      "to":   "<new_name_for_rename>",
      "fromType": "<old_type_for_retype>",
      "toType":   "<new_type_for_retype>"
    }
  ],
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - One table only. Do NOT propose changes to other tables.
  - For DROP and RETYPE, ALWAYS surface a warning describing data risk.
  - For ADD, choose a sensible field type from the supported set
    (singleLineText, longText, number, currency, percent, date, dateTime,
    checkbox, singleSelect, multiSelect, email, phone, url, attachment,
    linkedRecord, lookup, formula, count, rollup, autoNumber, barcode,
    risk_score, priority, ai_generated_summary, ai_classification,
    source_reference).
  - Reuse existing field IDs verbatim for rename/retype/drop. Do NOT
    invent IDs that are not in the supplied schema.`;

export const proposeStructureEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, organizationId, workspaceId, llmProvider } = input;

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[structure] tenant violation; refusing to load schema.',
      operations: [],
      warnings: ['structure_tenant_violation'],
      confidence: 0,
    };
  }

  const fields = await loadTableFields(tableId);
  const userMessage = buildStructureUserMessage(prompt, tableId, fields);

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
    logHandlerError('structure', e, { tableId });
    return {
      handlerStatus: 'live',
      summary: '[structure] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['structure_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    operations?: unknown[];
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[structure] ${prompt.slice(0, 200)}`;
  const warningsArr = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);

  const knownFieldIds = new Set(fields.map((f) => f.id));
  const operations: Array<
    OpSchemaAddField | OpSchemaRenameField | OpSchemaRetypeField | OpSchemaDropField
  > = [];

  let opCounter = 0;
  for (const candidate of parsed.operations ?? []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const c = candidate as Record<string, unknown>;
    const type = String(c.type ?? '');
    const id = typeof c.id === 'string' && c.id.length > 0 ? c.id : `op_struct_${++opCounter}`;

    if (type === 'op_schema_add_field') {
      const result = opSchemaAddField.safeParse({
        type,
        id,
        target: { tableId },
        payload: {
          name: String(c.name ?? ''),
          fieldType: String(c.fieldType ?? ''),
          options:
            c.options && typeof c.options === 'object'
              ? (c.options as Record<string, unknown>)
              : undefined,
        },
      });
      if (result.success) operations.push(result.data);
      continue;
    }

    if (type === 'op_schema_rename_field') {
      const fieldId = String(c.fieldId ?? '');
      if (!knownFieldIds.has(fieldId)) {
        warningsArr.push(`structure_unknown_field_id:${fieldId}`);
        continue;
      }
      const result = opSchemaRenameField.safeParse({
        type,
        id,
        target: { tableId, fieldId },
        payload: { from: String(c.from ?? ''), to: String(c.to ?? '') },
      });
      if (result.success) operations.push(result.data);
      continue;
    }

    if (type === 'op_schema_retype_field') {
      const fieldId = String(c.fieldId ?? '');
      if (!knownFieldIds.has(fieldId)) {
        warningsArr.push(`structure_unknown_field_id:${fieldId}`);
        continue;
      }
      const result = opSchemaRetypeField.safeParse({
        type,
        id,
        target: { tableId, fieldId },
        payload: {
          from: String(c.fromType ?? ''),
          to: String(c.toType ?? ''),
          options:
            c.options && typeof c.options === 'object'
              ? (c.options as Record<string, unknown>)
              : undefined,
        },
      });
      if (result.success) {
        operations.push(result.data);
        warningsArr.push('structure_retype_data_risk');
      }
      continue;
    }

    if (type === 'op_schema_drop_field') {
      const fieldId = String(c.fieldId ?? '');
      if (!knownFieldIds.has(fieldId)) {
        warningsArr.push(`structure_unknown_field_id:${fieldId}`);
        continue;
      }
      const result = opSchemaDropField.safeParse({
        type,
        id,
        target: { tableId, fieldId },
      });
      if (result.success) {
        operations.push(result.data);
        warningsArr.push('structure_drop_data_loss_risk');
      }
      continue;
    }
  }

  return {
    handlerStatus: 'live',
    summary,
    operations,
    warnings: warningsArr,
    confidence,
  };
};

function buildStructureUserMessage(
  userPrompt: string,
  tableId: string,
  fields: Array<{ id: string; name: string; fieldType: string }>
): string {
  const fieldList = fields
    .map((f) => `  - id="${f.id}" name="${f.name}" type="${f.fieldType}"`)
    .join('\n');
  return [
    `Table id="${tableId}".`,
    `Existing fields:\n${fieldList || '  (no fields yet)'}`,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}
