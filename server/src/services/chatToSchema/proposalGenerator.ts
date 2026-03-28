/**
 * ProposalGenerator — builds an LLM prompt from parsed intent + grounded schema,
 * calls the model, and returns a validated SchemaProposal.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import type { ParsedIntent, ProposalIntent } from './intentParser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaProposal {
  proposal_id: string;
  intent: string;
  confidence: number;
  summary: string;
  operations: SchemaOperation[];
  warnings: Array<{ code: string; message: string; severity: 'info' | 'warn' }>;
  estimated_impact: {
    tables_created?: number;
    fields_added?: number;
    fields_modified?: number;
    fields_removed?: number;
    records_added?: number;
    views_created?: number;
  };
}

export interface SchemaOperation {
  id: string;
  operation_type: string;
  target: { type: string; base_id?: string; table_id?: string; field_id?: string };
  payload: Record<string, unknown>;
  dependencies?: string[];
  reversible: boolean;
}

// ---------------------------------------------------------------------------
// LLM caller (shared utility extracted from ChatToSchemaService)
// ---------------------------------------------------------------------------

export async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const baseUrl = process.env.AI_API_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || '{}';
}

// ---------------------------------------------------------------------------
// Few-shot examples keyed by intent category
// ---------------------------------------------------------------------------

function getFewShotExamples(intent: ProposalIntent): string {
  const examples: Partial<Record<ProposalIntent, string>> = {
    create_table: `
Example — "Create a Risks table with name, status, impact":
{
  "intent": "create_table",
  "confidence": 0.95,
  "summary": "Create Risks table with 3 fields",
  "operations": [
    { "id": "op_1", "operation_type": "create_table", "target": { "type": "table", "base_id": "BASE" }, "payload": { "name": "Risks" }, "reversible": true },
    { "id": "op_2", "operation_type": "create_field", "target": { "type": "field", "table_id": "op_1" }, "payload": { "name": "Name", "fieldType": "singleLineText" }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_3", "operation_type": "create_field", "target": { "type": "field", "table_id": "op_1" }, "payload": { "name": "Status", "fieldType": "singleSelect", "options": { "choices": [{"name":"To Do","color":"gray"},{"name":"In Progress","color":"blue"},{"name":"Done","color":"green"}] } }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_4", "operation_type": "create_field", "target": { "type": "field", "table_id": "op_1" }, "payload": { "name": "Impact", "fieldType": "number" }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_5", "operation_type": "create_view", "target": { "type": "view", "table_id": "op_1" }, "payload": { "name": "Grid view", "viewType": "grid" }, "dependencies": ["op_1"], "reversible": true }
  ],
  "warnings": [],
  "estimated_impact": { "tables_created": 1, "fields_added": 3, "views_created": 1 }
}`,
    create_tables: `
Example — "Build a CRM with Leads, Contacts, and Deals":
{
  "intent": "create_tables",
  "confidence": 0.95,
  "summary": "Create CRM system with Leads, Contacts, and Deals tables with cross-table references",
  "operations": [
    { "id": "op_1", "operation_type": "create_table", "target": { "type": "table", "base_id": "BASE" }, "payload": { "name": "Contacts" }, "reversible": true },
    { "id": "op_2", "operation_type": "create_table", "target": { "type": "table", "base_id": "BASE" }, "payload": { "name": "Leads" }, "reversible": true },
    { "id": "op_3", "operation_type": "create_table", "target": { "type": "table", "base_id": "BASE" }, "payload": { "name": "Deals" }, "reversible": true },
    { "id": "op_4", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Contacts" }, "payload": { "name": "Email", "fieldType": "email" }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_5", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Contacts" }, "payload": { "name": "Phone", "fieldType": "phone" }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_6", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Leads" }, "payload": { "name": "Status", "fieldType": "singleSelect", "options": { "choices": [{"name":"New","color":"blue"},{"name":"Qualified","color":"green"},{"name":"Lost","color":"red"}] } }, "dependencies": ["op_2"], "reversible": true },
    { "id": "op_7", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Leads" }, "payload": { "name": "Contact", "fieldType": "linkedRecord", "options": { "linkedTableId": "@ref:Contacts" } }, "dependencies": ["op_1", "op_2"], "reversible": true },
    { "id": "op_8", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Deals" }, "payload": { "name": "Value", "fieldType": "currency" }, "dependencies": ["op_3"], "reversible": true },
    { "id": "op_9", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Deals" }, "payload": { "name": "Lead", "fieldType": "linkedRecord", "options": { "linkedTableId": "@ref:Leads" } }, "dependencies": ["op_2", "op_3"], "reversible": true },
    { "id": "op_10", "operation_type": "create_field", "target": { "type": "field", "table_id": "@ref:Deals" }, "payload": { "name": "Stage", "fieldType": "singleSelect", "options": { "choices": [{"name":"Prospecting","color":"gray"},{"name":"Negotiation","color":"blue"},{"name":"Closed Won","color":"green"},{"name":"Closed Lost","color":"red"}] } }, "dependencies": ["op_3"], "reversible": true },
    { "id": "op_11", "operation_type": "create_view", "target": { "type": "view", "table_id": "@ref:Contacts" }, "payload": { "name": "Grid view", "viewType": "grid" }, "dependencies": ["op_1"], "reversible": true },
    { "id": "op_12", "operation_type": "create_view", "target": { "type": "view", "table_id": "@ref:Leads" }, "payload": { "name": "Grid view", "viewType": "grid" }, "dependencies": ["op_2"], "reversible": true },
    { "id": "op_13", "operation_type": "create_view", "target": { "type": "view", "table_id": "@ref:Deals" }, "payload": { "name": "Grid view", "viewType": "grid" }, "dependencies": ["op_3"], "reversible": true }
  ],
  "warnings": [],
  "estimated_impact": { "tables_created": 3, "fields_added": 7, "views_created": 3 }
}`,
    add_field: `
Example — "Add a deadline date column to Risks":
{
  "intent": "add_field",
  "confidence": 0.95,
  "summary": "Add deadline field (date) to Risks table",
  "operations": [
    { "id": "op_1", "operation_type": "create_field", "target": { "type": "field", "table_id": "TABLE_ID" }, "payload": { "name": "Deadline", "fieldType": "date" }, "reversible": true }
  ],
  "warnings": [],
  "estimated_impact": { "fields_added": 1 }
}`,
    seed_records: `
Example — "Add 3 sample rows to Risks":
{
  "intent": "seed_records",
  "confidence": 0.9,
  "summary": "Insert 3 sample records into Risks",
  "operations": [
    { "id": "op_1", "operation_type": "create_record", "target": { "type": "record", "table_id": "TABLE_ID" }, "payload": { "data": { "Name": "Data breach risk", "Status": "To Do", "Impact": 8 } }, "reversible": true },
    { "id": "op_2", "operation_type": "create_record", "target": { "type": "record", "table_id": "TABLE_ID" }, "payload": { "data": { "Name": "Budget overrun", "Status": "In Progress", "Impact": 6 } }, "reversible": true },
    { "id": "op_3", "operation_type": "create_record", "target": { "type": "record", "table_id": "TABLE_ID" }, "payload": { "data": { "Name": "Vendor delay", "Status": "Done", "Impact": 4 } }, "reversible": true }
  ],
  "warnings": [],
  "estimated_impact": { "records_added": 3 }
}`,
  };

  return examples[intent] ?? examples.create_table ?? '';
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  intent: ProposalIntent,
  schemaContext: string,
  budgetMode = false
): string {
  const fewShot = budgetMode ? '' : getFewShotExamples(intent);

  return `You are a schema design assistant for Consultify Table Platform.
Given a user's request, generate a structured schema proposal as JSON.

RULES:
- Output ONLY valid JSON matching the SchemaProposal format below.
- Field types must be one of: singleLineText, longText, number, currency, percent, checkbox, date, singleSelect, multiSelect, url, email, phone, attachment, linkedRecord
- For singleSelect/multiSelect, always include options with choices array [{name, color}].
- For linkedRecord, specify linkedTableId. Use "@ref:TableName" or an op_N placeholder if the table is created in the same proposal.
- Set a primary field (first text field) for new tables.
- Create a default grid view for each new table.
- Generate operation IDs as op_1, op_2, etc.
- Set dependencies correctly (field creation depends on table creation).
- Confidence: 0.9+ for clear requests, 0.7-0.9 for ambiguous, <0.7 for unclear.
- Keep the proposal minimal — only what the user asked for.

MULTI-TABLE PROPOSALS:
- When the user describes a system with multiple entities (e.g. "CRM with leads, contacts, deals", "project tracker with tasks, milestones, team members"), generate operations for ALL tables in a single proposal.
- Use "@ref:TableName" syntax for cross-table references. The MutationExecutor resolves these to actual IDs at execution time.
- Order operations: 1) create all tables first, 2) then create fields (including linkedRecord fields that reference other tables), 3) then create views.
- Set dependencies correctly: a linkedRecord field that references another table must depend on BOTH its own table creation AND the referenced table creation.
- Each table should get its own default grid view.

NL-to-type inference:
- amount/price/cost/budget/revenue/PLN/EUR/USD → currency
- date/deadline/termin/when → date
- yes/no/true/false/checkbox → checkbox
- status/stage/phase/priority/category → singleSelect
- list of/multiple/tags/many → multiSelect
- email → email, phone → phone, url/link → url
- description/notes/long → longText
- number/quantity/count → number, percent → percent
- Default → singleLineText

CURRENT SCHEMA:
${schemaContext}

${fewShot ? `EXAMPLE:\n${fewShot}` : ''}

Respond with a JSON object containing: intent, confidence, summary, operations, warnings, estimated_impact.`;
}

// ---------------------------------------------------------------------------
// JSON parsing with retry
// ---------------------------------------------------------------------------

function parseProposalJSON(raw: string): SchemaProposal | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.operations || !Array.isArray(parsed.operations)) return null;

    const operations = (parsed.operations as SchemaOperation[]).map((op, i) => ({
      id: op.id ?? `op_${i + 1}`,
      operation_type:
        op.operation_type ??
        ((op as unknown as Record<string, unknown>).operationType as string) ??
        'unknown',
      target: op.target ?? { type: 'unknown' },
      payload: op.payload ?? {},
      dependencies: op.dependencies,
      reversible: op.reversible ?? true,
    }));

    return {
      proposal_id: uuidv4(),
      intent: String(parsed.intent ?? 'unknown'),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      summary: String(parsed.summary ?? ''),
      operations,
      warnings: Array.isArray(parsed.warnings)
        ? (parsed.warnings as Array<Record<string, unknown>>).map((w) => ({
            code: String(w.code ?? 'GENERAL'),
            message: String(w.message ?? ''),
            severity: (w.severity === 'warn' ? 'warn' : 'info') as 'info' | 'warn',
          }))
        : [],
      estimated_impact: (parsed.estimated_impact as SchemaProposal['estimated_impact']) ?? {},
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token budget management (WS-D §9.6)
// ---------------------------------------------------------------------------

const TOKEN_BUDGET_THRESHOLD = 2000;
const CHARS_PER_TOKEN = 4;
const MAX_OUTPUT_TOKENS = 4096;

function applyTokenBudget(
  schemaContext: string,
  intent: ProposalIntent,
  tableId?: string
): { trimmedContext: string; budgetMode: boolean } {
  const estimatedTokens = Math.ceil(schemaContext.length / CHARS_PER_TOKEN);

  if (estimatedTokens <= TOKEN_BUDGET_THRESHOLD) {
    return { trimmedContext: schemaContext, budgetMode: false };
  }

  const lines = schemaContext.split('\n');
  const headerLines: string[] = [];
  const currentTableLines: string[] = [];
  const otherTableNames: string[] = [];
  let inCurrentTable = false;

  for (const line of lines) {
    if (line.startsWith('Base:') || line === 'Tables:') {
      headerLines.push(line);
      continue;
    }

    const isTableLine = /^- .+ \(id: .+\)$/.test(line);
    if (isTableLine) {
      if (tableId && line.includes(tableId)) {
        inCurrentTable = true;
        currentTableLines.push(line);
      } else {
        inCurrentTable = false;
        const tableName = line.replace(/^- /, '').replace(/ \(id: .+\)$/, '');
        otherTableNames.push(tableName);
      }
      continue;
    }

    if (inCurrentTable) {
      currentTableLines.push(line);
    }
  }

  const trimmed = [
    ...headerLines,
    '(Schema is large. Showing current table details only.)',
    ...currentTableLines,
    otherTableNames.length > 0 ? `Other tables: ${otherTableNames.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { trimmedContext: trimmed, budgetMode: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;

export async function generateProposal(
  intent: ParsedIntent,
  schemaContext: string,
  userMessage: string,
  options?: { tableId?: string }
): Promise<SchemaProposal> {
  const { trimmedContext, budgetMode } = applyTokenBudget(
    schemaContext,
    intent.intent,
    options?.tableId
  );

  const systemPrompt = buildSystemPrompt(intent.intent, trimmedContext, budgetMode);

  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const prompt =
        attempt === 0
          ? userMessage
          : `${userMessage}\n\n[SYSTEM: Previous response was invalid JSON. Error: ${lastError}. Please output ONLY valid JSON.]`;

      const raw = await callLLM(systemPrompt, prompt);
      const proposal = parseProposalJSON(raw);

      if (proposal) {
        if (proposal.operations.length === 0) {
          proposal.warnings.push({
            code: 'EMPTY_OPS',
            message: 'No operations generated. The request may be too vague.',
            severity: 'warn',
          });
        }
        return proposal;
      }

      lastError = 'Response did not contain a valid operations array';
      logger.warn('[ProposalGenerator] Parse failed, retrying', {
        attempt,
        rawSnippet: raw.slice(0, 200),
      });
    } catch (e) {
      lastError = (e as Error).message;
      logger.error('[ProposalGenerator] LLM call failed', {
        attempt,
        error: lastError,
      });
      if (attempt === MAX_RETRIES) break;
    }
  }

  return {
    proposal_id: uuidv4(),
    intent: intent.intent,
    confidence: 0,
    summary: 'Failed to generate proposal after retries.',
    operations: [],
    warnings: [{ code: 'LLM_FAILURE', message: lastError, severity: 'warn' }],
    estimated_impact: {},
  };
}
