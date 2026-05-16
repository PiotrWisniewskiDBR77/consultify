/**
 * Level 5: View Edit (Block C · EPIC-T10 · Sprint C-S3 · live handler).
 *
 * Proposes view configuration changes — create a new view or patch an
 * existing view's filter / sort / grouping / hidden columns / kanban
 * board key. Operates per-view; never touches table primary data, so
 * apply is safe without schema-level review.
 *
 * Inputs from `context`:
 *   - `viewId` (optional). If present, the handler emits an
 *     `op_view_update` patch. If absent, an `op_view_create`.
 *
 * Cross-tenant defense: `assertTableInOrganization` runs first.
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
import { opViewCreate, opViewUpdate } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: propose ONE view configuration change. Either create a new view
or patch a single existing view. Never propose changes to records, fields,
or other views.
You return a JSON object that strictly matches:
{
  "mode": "create" | "update",
  "name": "<for create>",
  "viewType": "grid" | "kanban" | "calendar" | "gallery" | "form",   // for create
  "config": <view-config-object>,
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
View config rules:
  - "filter": optional { conditions: [{ fieldId, op, value }], logic: "and"|"or" }
  - "sort":   optional [{ fieldId, direction: "asc"|"desc" }]
  - "groupBy": optional fieldId
  - "hiddenFields": optional fieldId[]
  - For kanban view: "stackingFieldId": fieldId (singleSelect required).
  - For calendar view: "startFieldId" + "endFieldId" (date types).`;

export const proposeViewEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;
  const viewId = asString(context.viewId);

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[view] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['view_tenant_violation'],
      confidence: 0,
    };
  }

  const fields = await loadTableFields(tableId);
  const userMessage = buildViewUserMessage(prompt, fields, viewId);

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
    logHandlerError('view', e, { tableId, viewId });
    return {
      handlerStatus: 'live',
      summary: '[view] LLM provider failed; no operation proposed.',
      operations: [],
      warnings: ['view_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    mode?: unknown;
    name?: unknown;
    viewType?: unknown;
    config?: unknown;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[view] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);
  const config =
    parsed.config && typeof parsed.config === 'object'
      ? (parsed.config as Record<string, unknown>)
      : {};

  const mode = parsed.mode === 'update' ? 'update' : 'create';

  if (mode === 'update') {
    if (!viewId) {
      return {
        handlerStatus: 'live',
        summary: '[view] update mode requires context.viewId.',
        operations: [],
        warnings: [...warnings, 'view_update_missing_viewId'],
        confidence: 0,
      };
    }
    const result = opViewUpdate.safeParse({
      type: 'op_view_update',
      id: `op_view_update_${viewId}`,
      target: { tableId, viewId },
      payload: { config },
    });
    if (!result.success) {
      return {
        handlerStatus: 'live',
        summary: '[view] LLM produced invalid update envelope.',
        operations: [],
        warnings: [...warnings, 'view_invalid_update_envelope'],
        confidence: 0,
      };
    }
    return { handlerStatus: 'live', summary, operations: [result.data], warnings, confidence };
  }

  const name = asString(parsed.name);
  const vt = String(parsed.viewType ?? 'grid');
  if (!name) {
    return {
      handlerStatus: 'live',
      summary: '[view] create mode requires a non-empty name.',
      operations: [],
      warnings: [...warnings, 'view_create_missing_name'],
      confidence: 0,
    };
  }
  const result = opViewCreate.safeParse({
    type: 'op_view_create',
    id: `op_view_create_${Date.now()}`,
    target: { tableId },
    payload: { name, viewType: vt, config },
  });
  if (!result.success) {
    return {
      handlerStatus: 'live',
      summary: '[view] LLM produced invalid create envelope.',
      operations: [],
      warnings: [...warnings, 'view_invalid_create_envelope'],
      confidence: 0,
    };
  }
  return { handlerStatus: 'live', summary, operations: [result.data], warnings, confidence };
};

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function buildViewUserMessage(
  userPrompt: string,
  fields: Array<{ id: string; name: string; fieldType: string }>,
  viewId: string | null
): string {
  const fieldList = fields
    .map((f) => `  - id="${f.id}" name="${f.name}" type="${f.fieldType}"`)
    .join('\n');
  const intro = viewId
    ? `Update the existing view (id="${viewId}"). Set "mode":"update".`
    : `No view id supplied. Create a new view. Set "mode":"create".`;
  return [
    intro,
    `Available fields:\n${fieldList || '  (none)'}`,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}
