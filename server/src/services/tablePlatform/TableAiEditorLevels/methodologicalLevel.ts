/**
 * Level 7: Methodological Edit (Block C · EPIC-T10 · Sprint C-S3 · live handler).
 *
 * Compares table data against template `governance_rules` from Block A
 * and emits a list of `op_methodological_flag` proposals — one per
 * deviation. This level NEVER mutates data; the user reviews flags and
 * decides whether to fix the data or amend the rule.
 *
 * Super-admin-only (orchestrator gates this before dispatch).
 *
 * Inputs from `context`:
 *   - `governanceRules` (optional). When present, used directly. When
 *     absent, the handler attempts to look up the template attached to
 *     the table's base; if none exists, the handler still runs a
 *     baseline schema-mismatch scan.
 *   - `recordIds` (optional). Subset of records to scan; defaults to all.
 *
 * Output: zero or more `op_methodological_flag` operations, each with a
 * `severity` and `message` ready for the UI to render.
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
import { opMethodologicalFlag } from './operations.js';

const SYSTEM_PROMPT = `You are an AI Editor for Consultify Table Studio.
Your job: COMPARE table data against governance rules and report deviations.
You return a JSON object that strictly matches:
{
  "flags": [
    {
      "recordId": "<id_or_null>",
      "fieldId":  "<id_or_null>",
      "deviationKind": "missing_required_field" | "invalid_value"
                      | "rule_violated" | "schema_mismatch" | "other",
      "ruleId":  "<id_or_null>",
      "message": "<human readable>",
      "severity": "info" | "warn" | "error"
    }
  ],
  "summary": "<one-sentence summary>",
  "warnings": ["..."],
  "confidence": <0..1>
}
Rules:
  - Each flag is read-only — DO NOT propose data mutations.
  - If a record violates a rule but the rule itself is ambiguous, set
    severity to "warn" and explain in message.`;

const MAX_RECORDS_FOR_SCAN = 100;

export const proposeMethodologicalEdit: LevelHandler = async (input): Promise<LevelStubOutput> => {
  const { tableId, prompt, context, organizationId, workspaceId, llmProvider } = input;

  try {
    await assertTableInOrganization(tableId, organizationId, workspaceId);
  } catch {
    return {
      handlerStatus: 'live',
      summary: '[methodological] tenant violation; refusing to load context.',
      operations: [],
      warnings: ['methodological_tenant_violation'],
      confidence: 0,
    };
  }

  const fields = await loadTableFields(tableId);
  const ruleSource = await resolveRules(context, tableId);

  // Pick records to scan.
  const askedIds = Array.isArray(context.recordIds)
    ? context.recordIds.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  let scannedRecordIds: string[] = askedIds;
  if (scannedRecordIds.length === 0) {
    const db = getDatabase();
    const { rows } = await db.query(`SELECT id FROM tp_records WHERE table_id = $1 LIMIT $2`, [
      tableId,
      MAX_RECORDS_FOR_SCAN,
    ]);
    scannedRecordIds = rows.map((r: any) => String(r.id));
  } else if (scannedRecordIds.length > MAX_RECORDS_FOR_SCAN) {
    scannedRecordIds = scannedRecordIds.slice(0, MAX_RECORDS_FOR_SCAN);
  }
  const records = await loadRecords(tableId, scannedRecordIds);

  const userMessage = buildMethodologicalUserMessage(prompt, fields, records, ruleSource);

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
    logHandlerError('methodological', e, { tableId });
    return {
      handlerStatus: 'live',
      summary: '[methodological] LLM provider failed; no flags produced.',
      operations: [],
      warnings: ['methodological_llm_failure'],
      confidence: 0,
    };
  }

  const parsed = safeJson(llmText) as {
    flags?: Array<Record<string, unknown>>;
    summary?: unknown;
    warnings?: unknown;
    confidence?: unknown;
  };

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.length > 0
      ? parsed.summary
      : `[methodological] ${prompt.slice(0, 200)}`;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  const confidence = clampConfidence(parsed.confidence);

  const knownRecordIds = new Set(records.map((r) => r.id));
  const knownFieldIds = new Set(fields.map((f) => f.id));

  const operations = (parsed.flags ?? [])
    .map((flag, idx) => {
      const c = flag as Record<string, unknown>;
      const recordId = asString(c.recordId);
      const fieldId = asString(c.fieldId);
      // Drop flags referencing IDs outside the scanned set.
      if (recordId && !knownRecordIds.has(recordId)) {
        warnings.push(`methodological_unknown_record_id:${recordId}`);
        return null;
      }
      if (fieldId && !knownFieldIds.has(fieldId)) {
        warnings.push(`methodological_unknown_field_id:${fieldId}`);
        return null;
      }
      const result = opMethodologicalFlag.safeParse({
        type: 'op_methodological_flag',
        id: `op_methflag_${idx}`,
        target: {
          tableId,
          ...(recordId ? { recordId } : {}),
          ...(fieldId ? { fieldId } : {}),
        },
        payload: {
          deviationKind: String(c.deviationKind ?? 'other'),
          ...(asString(c.ruleId) ? { ruleId: String(c.ruleId) } : {}),
          message: String(c.message ?? '').slice(0, 1000) || 'unspecified',
          severity: String(c.severity ?? 'warn'),
        },
      });
      return result.success ? result.data : null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);

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

interface RuleSource {
  source: 'context' | 'template' | 'none';
  rules: unknown;
}

async function resolveRules(
  context: Record<string, unknown>,
  tableId: string
): Promise<RuleSource> {
  if (context.governanceRules && typeof context.governanceRules === 'object') {
    return { source: 'context', rules: context.governanceRules };
  }
  // Look up `tp_base_templates.governance_rules` for the base of this table,
  // when the column exists. Best-effort only — schema may not yet carry the
  // template column in older deployments.
  try {
    const db = getDatabase();
    const { rows } = await db.query(
      `SELECT bt.governance_rules
         FROM tp_tables t
         JOIN tp_bases  b ON t.base_id = b.id
         LEFT JOIN tp_base_templates bt ON bt.id = b.applied_template_id
        WHERE t.id = $1
        LIMIT 1`,
      [tableId]
    );
    const row = rows?.[0] as { governance_rules?: unknown } | undefined;
    if (row?.governance_rules) {
      return { source: 'template', rules: row.governance_rules };
    }
  } catch {
    // Schema variant without `applied_template_id` — silent fallback.
  }
  return { source: 'none', rules: null };
}

function buildMethodologicalUserMessage(
  userPrompt: string,
  fields: Array<{ id: string; name: string; fieldType: string }>,
  records: Array<{ id: string; data: Record<string, unknown> }>,
  ruleSource: RuleSource
): string {
  const fieldList = fields
    .map((f) => `  - id="${f.id}" name="${f.name}" type="${f.fieldType}"`)
    .join('\n');
  const recordsBlock = records
    .slice(0, 50)
    .map((r) => `  - id="${r.id}" data=${shorten(JSON.stringify(r.data))}`)
    .join('\n');
  const rulesBlock =
    ruleSource.source === 'none'
      ? '  (no template applied; perform a baseline schema-vs-data scan)'
      : JSON.stringify(ruleSource.rules).slice(0, 4000);
  return [
    `Schema fields:\n${fieldList || '  (none)'}`,
    `Records (${records.length}):\n${recordsBlock || '  (none)'}`,
    `Governance rules (source: ${ruleSource.source}):\n${rulesBlock}`,
    fenceUntrusted('USER REQUEST', userPrompt),
    'Return JSON only.',
  ].join('\n\n');
}

function shorten(s: string): string {
  return s.length > 300 ? `${s.slice(0, 300)}…` : s;
}
