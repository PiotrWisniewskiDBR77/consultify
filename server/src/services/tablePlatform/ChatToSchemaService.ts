/**
 * Chat-to-Schema Service
 * Turns natural language into structured schema proposals via LLM,
 * validates them, and executes approved operations.
 *
 * Pipeline: IntentParser → SchemaGrounder → ProposalGenerator → SchemaValidator → MutationExecutor
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import type { ParsedIntent } from '../chatToSchema/intentParser.js';
import { parseIntent } from '../chatToSchema/intentParser.js';
import type { MutationResult } from '../chatToSchema/mutationExecutor.js';
import { MutationExecutor } from '../chatToSchema/mutationExecutor.js';
import type { SchemaOperation as PipelineSchemaOperation } from '../chatToSchema/proposalGenerator.js';
import { generateProposal as pipelineGenerateProposal } from '../chatToSchema/proposalGenerator.js';
import {
  checkRateLimit,
  validateProposalLimits,
  validateSchemaOperations,
} from '../chatToSchema/safetyGuardrails.js';
import { groundSchema } from '../chatToSchema/schemaGrounder.js';
import { getStack } from '../chatToSchema/undoRedoStack.js';
import auditService from './AuditService.js';
import { TablePlatformError } from './ErrorHandling.js';
import metadataService from './MetadataService.js';
import recordsService from './RecordsService.js';
import schemaValidationService from './SchemaValidationService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaProposal {
  id: string;
  workspaceId: string;
  intent: string;
  confidence: number;
  summary: string;
  operations: SchemaOperation[];
  warnings: Array<{ message: string; operationId?: string }>;
  status: string;
  createdBy?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface SchemaOperation {
  id: string;
  operationType: string;
  dependsOn?: string[];
  target?: Record<string, string>;
  payload?: Record<string, unknown>;
  /** LLM responses may use alternative keys; these are handled at runtime */
  [key: string]: unknown;
}

export interface ExecutionResult {
  success: boolean;
  createdIds: Record<string, string>;
  failedOperations: Array<{ operationId: string; error: string }>;
  status: 'executed' | 'failed';
  /** Set when the mutation transaction rolled back and nothing persisted */
  message?: string;
}

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  try {
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
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '{}';
  } catch (e) {
    logger.error('[ChatToSchema] LLM call failed', { error: (e as Error).message });
    throw new Error('AI service unavailable');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSystemPrompt(existingSchema: any, language: string): string {
  const schemaContext =
    existingSchema && typeof existingSchema === 'object'
      ? JSON.stringify(existingSchema, null, 2)
      : 'No existing schema. User is creating from scratch.';

  return `You are a database schema planner for Consultify.
Given a user's description, generate a structured schema proposal.

RULES:
- Output ONLY valid JSON matching the SchemaProposal format
- Field types must be one of: singleLineText, longText, number, currency, percent, checkbox, date, singleSelect, multiSelect, url, email, phone, attachment, linkedRecord
- For singleSelect/multiSelect, always include options with id, name, color
- For linkedRecord, specify linkedTableId (use op_N placeholder if the table is created in the same proposal)
- Set a primary field (first text field)
- Create a default grid view for each table
- Generate operation IDs as op_1, op_2, etc.
- Set dependencies correctly (field creation depends on table creation)
- Confidence: 0.9+ for clear requests, 0.7-0.9 for ambiguous, <0.7 for unclear

EXISTING SCHEMA:
${schemaContext}

USER LANGUAGE: ${language}

Respond in JSON format:
{
  "intent": "create_table|create_tables|add_field|...",
  "summary": "Human-readable summary in user's language",
  "confidence": 0.95,
  "operations": [...],
  "warnings": [...]
}`;
}

function parseAIResponse(response: string): {
  intent: string;
  operations: SchemaOperation[];
  summary: string;
  confidence: number;
  warnings: Array<{ message: string; operationId?: string }>;
} {
  try {
    const parsed = JSON.parse(response) as Record<string, unknown>;
    const operations = (parsed.operations as SchemaOperation[]) || [];
    const warnings = (parsed.warnings as Array<{ message: string; operationId?: string }>) || [];

    return {
      intent: String(parsed.intent ?? 'unknown'),
      summary: String(parsed.summary ?? ''),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0.5))),
      operations: Array.isArray(operations) ? operations : [],
      warnings: Array.isArray(warnings) ? warnings : [],
    };
  } catch (e) {
    logger.error('[ChatToSchema] parseAIResponse failed', {
      error: (e as Error).message,
      response: response?.slice?.(0, 200),
    });
    return {
      intent: 'unknown',
      summary: 'Failed to parse AI response',
      confidence: 0,
      operations: [],
      warnings: [{ message: 'AI response was invalid JSON' }],
    };
  }
}

function resolveOperationDependencies(operations: SchemaOperation[]): SchemaOperation[] {
  const byId = new Map<string, SchemaOperation>();
  for (const op of operations) {
    const id = op.id ?? op.operationType;
    byId.set(id, op);
  }

  const visited = new Set<string>();
  const result: SchemaOperation[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const op = byId.get(id);
    if (!op) return;
    const deps = op.dependsOn ?? [];
    for (const dep of deps) {
      visit(dep);
    }
    result.push(op);
  }

  for (const op of operations) {
    const id = op.id ?? op.operationType;
    visit(id);
  }

  return result;
}

function inferFieldType(description: string): string {
  const d = (description || '').toLowerCase();
  if (/\b(email|e-mail|mail)\b/.test(d)) return 'email';
  if (/\b(phone|tel|mobile)\b/.test(d)) return 'phone';
  if (/\b(url|link|website|http)\b/.test(d)) return 'url';
  if (/\b(date|deadline|due)\b/.test(d)) return 'date';
  if (/\b(number|amount|count|quantity)\b/.test(d)) return 'number';
  if (/\b(percent|percentage)\b/.test(d)) return 'percent';
  if (/\b(currency|money|price|cost)\b/.test(d)) return 'currency';
  if (/\b(checkbox|boolean|yes\/no|tak\/nie)\b/.test(d)) return 'checkbox';
  if (/\b(select|dropdown|option|status)\b/.test(d)) return 'singleSelect';
  if (/\b(attachment|file|upload)\b/.test(d)) return 'attachment';
  return 'singleLineText';
}

function resolveId(id: string, createdIds: Record<string, string>): string | undefined {
  if (createdIds[id]) return createdIds[id];
  return id;
}

/** Convert camelCase field type to snake_case for DB consistency */
function normalizeFieldType(ft: string): string {
  const map: Record<string, string> = {
    singleLineText: 'single_line_text',
    longText: 'long_text',
    singleSelect: 'single_select',
    multiSelect: 'multi_select',
    linkedRecord: 'linked_record',
    createdTime: 'created_time',
    createdBy: 'created_by',
    lastModifiedTime: 'last_modified_time',
    lastModifiedBy: 'last_modified_by',
    autoNumber: 'auto_number',
  };
  return map[ft] ?? ft;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const chatToSchemaService = {
  /**
   * Pipeline-based proposal generation:
   *   1. IntentParser  — classify the user message
   *   2. SchemaGrounder — build textual schema context from DB
   *   3. ProposalGenerator — LLM call with few-shot examples
   *   4. SchemaValidator — validate the resulting operations
   *   5. Persist to DB
   *
   * Falls back to the legacy prompt path when no baseId is available
   * (e.g. refinement calls that pass existingSchema directly).
   */
  async generateProposal(
    workspaceId: string,
    userMessage: string,
    existingSchema?: unknown,
    language = 'en',
    createdBy?: string,
    context?: { baseId?: string; tableId?: string }
  ): Promise<SchemaProposal> {
    const db = getDatabase();
    let parsedIntent: ParsedIntent | undefined;
    let parsed: ReturnType<typeof parseAIResponse>;

    try {
      // --- Step 1: Intent classification ---
      parsedIntent = parseIntent(userMessage, {
        tableId: context?.tableId,
        baseId: context?.baseId,
      });

      logger.debug('[ChatToSchema] Intent parsed', {
        intent: parsedIntent.intent,
        confidence: parsedIntent.confidence,
        entities: parsedIntent.entities,
      });

      // --- Step 1b: Short-circuit for describe_schema ---
      if (parsedIntent.intent === 'describe_schema' && context?.baseId) {
        const schemaText = await groundSchema(context.baseId, context.tableId);
        const id = uuidv4();
        await db.query(
          `INSERT INTO tp_schema_proposals (id, workspace_id, intent, confidence, summary, operations, warnings, status, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'executed', $8)`,
          [id, workspaceId, 'describe_schema', 0.95, schemaText, '[]', '[]', createdBy ?? null]
        );
        const row = (await db.query('SELECT * FROM tp_schema_proposals WHERE id = $1', [id]))
          .rows[0];
        return row as unknown as SchemaProposal;
      }

      // --- Step 2: Schema grounding ---
      let schemaContext: string;
      if (context?.baseId) {
        schemaContext = await groundSchema(context.baseId, context.tableId);
      } else if (existingSchema && typeof existingSchema === 'object') {
        schemaContext = JSON.stringify(existingSchema, null, 2);
      } else {
        schemaContext = 'No existing schema. User is creating from scratch.';
      }

      // --- Step 3: Proposal generation via pipeline ---
      const llmStartTime = Date.now();
      const proposal = await pipelineGenerateProposal(parsedIntent, schemaContext, userMessage, {
        tableId: context?.tableId,
      });
      const llmDurationMs = Date.now() - llmStartTime;

      const estimatedInputTokens = Math.ceil((schemaContext.length + userMessage.length) / 4);
      const estimatedOutputTokens = Math.ceil(JSON.stringify(proposal.operations).length / 4);

      try {
        await auditService.logEvent(
          'ai_call',
          'schema_proposal',
          proposal.proposal_id,
          createdBy,
          undefined,
          {
            intent: parsedIntent.intent,
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            model: process.env.AI_MODEL || 'gpt-4o-mini',
            durationMs: llmDurationMs,
          } as unknown as Record<string, unknown>,
          undefined
        );
      } catch (auditErr) {
        logger.warn('[ChatToSchema] Cost tracking audit failed', {
          error: (auditErr as Error).message,
        });
      }

      // Convert pipeline proposal format to legacy internal format
      parsed = {
        intent: proposal.intent,
        summary: proposal.summary,
        confidence: proposal.confidence,
        operations: proposal.operations.map((op) => ({
          id: op.id,
          operationType: op.operation_type,
          dependsOn: op.dependencies,
          target: op.target as Record<string, string>,
          payload: op.payload,
        })),
        warnings: proposal.warnings.map((w) => ({
          message: w.message,
          operationId: undefined,
        })),
      };
    } catch (e) {
      logger.error('[ChatToSchema] generateProposal pipeline failed, using legacy fallback', {
        workspaceId,
        error: (e as Error).message,
      });

      // Legacy fallback
      try {
        const systemPrompt = buildSystemPrompt(existingSchema, language);
        const rawResponse = await callLLM(systemPrompt, userMessage);
        parsed = parseAIResponse(rawResponse);
      } catch (fallbackErr) {
        logger.error('[ChatToSchema] Legacy fallback also failed', {
          error: (fallbackErr as Error).message,
        });
        parsed = {
          intent: 'error',
          summary: 'AI service unavailable. Please try again.',
          confidence: 0,
          operations: [],
          warnings: [{ message: (fallbackErr as Error).message }],
        };
      }
    }

    // --- Step 3b: Confidence enforcement (WS-D §10.3) ---
    if (parsed.confidence < 0.3) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO tp_schema_proposals (id, workspace_id, intent, confidence, summary, operations, warnings, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'clarification_needed', $8)`,
        [
          id,
          workspaceId,
          parsed.intent,
          parsed.confidence,
          "I couldn't understand your request clearly. Could you try rephrasing? For example: 'Add a Priority column' or 'Create a contacts table'.",
          '[]',
          JSON.stringify(parsed.warnings),
          createdBy ?? null,
        ]
      );
      const row = (await db.query('SELECT * FROM tp_schema_proposals WHERE id = $1', [id])).rows[0];
      return row as unknown as SchemaProposal;
    }
    if (parsed.confidence < 0.5) {
      parsed.warnings.push({
        message: 'Please verify this proposal carefully — some details were inferred.',
      });
    } else if (parsed.confidence < 0.7) {
      parsed.warnings.push({
        message: 'AI inferred some details. Review before approving.',
      });
    }

    // --- Step 4: Validation ---
    const operations = parsed.operations;
    const validation = await schemaValidationService.validateSchemaProposal(operations);
    if (!validation.valid) {
      parsed.warnings.push(...validation.errors.map((e) => ({ message: e })));
    }

    // --- Step 5: Capture current schema_version for stale detection ---
    let schemaVersionAtCreation: number | null = null;
    const resolvedBaseId = context?.baseId ?? workspaceId;
    if (resolvedBaseId) {
      try {
        const svResult = await db.query('SELECT schema_version FROM tp_bases WHERE id = $1', [
          resolvedBaseId,
        ]);
        schemaVersionAtCreation =
          (svResult.rows[0] as { schema_version?: number })?.schema_version ?? null;
      } catch {
        // Non-critical: fall back to time-based stale detection
      }
    }

    // --- Step 6: Persist ---
    const id = uuidv4();
    const warningsWithVersion = [
      ...parsed.warnings,
      ...(schemaVersionAtCreation != null
        ? [{ message: `__schema_version_at_creation:${schemaVersionAtCreation}` }]
        : []),
    ];
    await db.query(
      `INSERT INTO tp_schema_proposals (id, workspace_id, intent, confidence, summary, operations, warnings, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [
        id,
        workspaceId,
        parsed.intent,
        parsed.confidence,
        parsed.summary,
        JSON.stringify(operations),
        JSON.stringify(warningsWithVersion),
        createdBy ?? null,
      ]
    );

    const row = (await db.query('SELECT * FROM tp_schema_proposals WHERE id = $1', [id])).rows[0];
    if (row && schemaVersionAtCreation != null) {
      (row as Record<string, unknown>).schema_version_at_creation = schemaVersionAtCreation;
    }
    return row as unknown as SchemaProposal;
  },

  async executeProposal(
    proposalId: string,
    approvedOperationIds?: string[],
    executedBy?: string,
    context?: { organizationId?: string }
  ): Promise<ExecutionResult> {
    const db = getDatabase();
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    if (proposal.status !== 'pending' && proposal.status !== 'approved') {
      throw new TablePlatformError(
        `Proposal status is '${proposal.status}', cannot execute`,
        'PROPOSAL_ALREADY_EXECUTED',
        409,
        { status: proposal.status }
      );
    }

    // --- Stale proposal detection (WS-D §6.3) ---
    // Primary: compare schema_version at proposal creation vs current version
    const proposalSchemaVersion = (proposal as Record<string, unknown>).schema_version_at_creation;
    const workspaceId = proposal.workspace_id;
    if (proposalSchemaVersion != null) {
      try {
        const baseIdForCheck =
          (proposal.operations as SchemaOperation[])?.[0]?.target?.baseId ??
          (proposal.operations as SchemaOperation[])?.[0]?.target?.base_id ??
          workspaceId;
        if (baseIdForCheck) {
          const currentVersion = await db.query(
            'SELECT schema_version FROM tp_bases WHERE id = $1',
            [baseIdForCheck]
          );
          const currentSV = (currentVersion.rows[0] as { schema_version?: number })?.schema_version;
          if (currentSV != null && Number(proposalSchemaVersion) !== currentSV) {
            throw new Error(
              `Schema was modified since this proposal was created (proposal version: ${proposalSchemaVersion}, current: ${currentSV}). Please regenerate.`
            );
          }
        }
      } catch (e) {
        if ((e as Error).message.includes('Schema was modified')) throw e;
        logger.warn('[ChatToSchema] schema version stale check failed', {
          error: (e as Error).message,
        });
      }
    }

    // Fallback: time-based stale detection
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const proposalAge = Date.now() - new Date(proposal.created_at).getTime();
    if (proposalAge > STALE_THRESHOLD_MS) {
      throw new Error(
        'Schema was modified since this proposal was created. Please regenerate. ' +
          `Proposal is ${Math.round(proposalAge / 1000)}s old (max ${STALE_THRESHOLD_MS / 1000}s).`
      );
    }

    const orgId = context?.organizationId;
    const operations = (proposal.operations as SchemaOperation[]) || [];
    const resolved = resolveOperationDependencies(operations);
    const toExecute = approvedOperationIds?.length
      ? resolved.filter((op) => approvedOperationIds.includes(op.id))
      : resolved;

    const pipelineOps: PipelineSchemaOperation[] = toExecute.map((op) => ({
      id: op.id,
      operation_type: String(
        op.operationType ??
          (op as unknown as Record<string, unknown>).op ??
          (op as unknown as Record<string, unknown>).type ??
          ''
      ),
      target: (op.target ?? {}) as {
        type: string;
        base_id?: string;
        table_id?: string;
        field_id?: string;
      },
      payload: (op.payload ?? (op as unknown as Record<string, unknown>).data ?? {}) as Record<
        string,
        unknown
      >,
      dependencies: op.dependsOn,
      reversible: true,
    }));

    const baseId = this.extractBaseId(pipelineOps, workspaceId);

    // Wrap execution in a SQL transaction for atomicity
    const executor = new MutationExecutor();
    let outcome: any;
    try {
      await db.query('BEGIN');
      outcome = await executor.executeOperations(
        pipelineOps,
        baseId,
        executedBy,
        orgId,
        workspaceId
      );
      if ((outcome as any).allSucceeded) {
        await db.query('COMMIT');
      } else {
        await db.query('ROLLBACK');
      }
    } catch (txErr) {
      await db.query('ROLLBACK').catch(() => {});
      logger.error('[ChatToSchema] executeProposal transaction failed', {
        proposalId,
        error: (txErr as Error).message,
      });
      throw txErr;
    }

    const createdIds: Record<string, string> = {};
    for (const [key, value] of (outcome as any).createdEntities) {
      createdIds[key] = value;
    }
    const failedOperations = (outcome as any).results
      .filter((r: any) => !r.success)
      .map((r: any) => ({ operationId: r.operationId, error: r.error ?? 'Unknown error' }));

    const status: 'executed' | 'failed' =
      (outcome as any).allSucceeded && failedOperations.length === 0 ? 'executed' : 'failed';
    const rollbackMessage = 'Execution failed — all changes rolled back';
    const message = status === 'failed' ? rollbackMessage : undefined;

    await db.query(
      `UPDATE tp_schema_proposals SET status = $2, resolved_by = $3, resolved_at = NOW() WHERE id = $1`,
      [proposalId, status, executedBy ?? null]
    );

    if ((outcome as any).allSucceeded && baseId) {
      const stack = getStack(baseId);
      stack.push({
        proposalId,
        baseId,
        timestamp: new Date().toISOString(),
        operations: (outcome as any).results,
        originalOperations: pipelineOps,
        description: String(proposal.summary ?? proposal.intent ?? ''),
        userId: executedBy,
      });
    }

    await auditService.logEvent(
      'execute',
      'schema_proposal',
      proposalId,
      executedBy,
      undefined,
      {
        createdIds,
        failedOperations,
        status,
        ...(message ? { message } : {}),
      } as unknown as Record<string, unknown>,
      undefined
    );

    return {
      success: failedOperations.length === 0,
      createdIds,
      failedOperations,
      status,
      ...(message ? { message } : {}),
    };
  },

  extractBaseId(operations: PipelineSchemaOperation[], fallback: string): string {
    for (const op of operations) {
      const target = op.target as Record<string, string> | undefined;
      if (target?.base_id && !target.base_id.startsWith('@ref:')) return target.base_id;
      if (target?.baseId && !(target.baseId as string).startsWith('@ref:'))
        return target.baseId as string;
    }
    return fallback;
  },

  async undoProposal(
    proposalId: string,
    baseId: string
  ): Promise<{ success: boolean; error?: string }> {
    const stack = getStack(baseId);
    if (!stack.canUndo()) {
      return { success: false, error: 'Nothing to undo' };
    }
    const history = stack.getUndoStack();
    const entry = history.find((e) => e.proposalId === proposalId);
    if (!entry) {
      return { success: false, error: `Proposal ${proposalId} not found in undo history` };
    }
    try {
      await stack.undo();
      const db = getDatabase();
      await db.query(
        `UPDATE tp_schema_proposals SET status = 'undone', resolved_at = NOW() WHERE id = $1`,
        [proposalId]
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async redoProposal(
    proposalId: string,
    baseId: string
  ): Promise<{ success: boolean; error?: string }> {
    const stack = getStack(baseId);
    if (!stack.canRedo()) {
      return { success: false, error: 'Nothing to redo' };
    }
    const history = stack.getRedoStack();
    const entry = history.find((e) => e.proposalId === proposalId);
    if (!entry) {
      return { success: false, error: `Proposal ${proposalId} not found in redo history` };
    }
    try {
      await stack.redo();
      const db = getDatabase();
      await db.query(
        `UPDATE tp_schema_proposals SET status = 'executed', resolved_at = NOW() WHERE id = $1`,
        [proposalId]
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  getSchemaHistory(baseId: string) {
    const stack = getStack(baseId);
    return stack.getHistory();
  },

  async rejectProposal(proposalId: string, rejectedBy?: string, reason?: string): Promise<void> {
    const db = getDatabase();
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }
    await db.query(
      `UPDATE tp_schema_proposals SET status = 'rejected', resolved_by = $2, resolved_at = NOW() WHERE id = $1`,
      [proposalId, rejectedBy ?? null]
    );
    await auditService.logEvent(
      'reject',
      'schema_proposal',
      proposalId,
      rejectedBy,
      undefined,
      { reason } as unknown as Record<string, unknown>,
      undefined
    );
  },

  async refineProposal(
    proposalId: string,
    refinementMessage: string,
    createdBy?: string
  ): Promise<SchemaProposal> {
    const db = getDatabase();
    const original = await this.getProposal(proposalId);
    if (!original) {
      throw new Error('Proposal not found');
    }

    const refinementCount = original.refinement_count ?? 0;
    if (refinementCount >= 3) {
      throw new Error(
        'Maximum refinements reached. Please approve, reject, or start a new proposal.'
      );
    }

    await db.query(
      'UPDATE tp_schema_proposals SET refinement_count = COALESCE(refinement_count, 0) + 1 WHERE id = $1',
      [proposalId]
    );

    const existingSchema = original.operations;
    const combinedMessage = `Original request context: ${JSON.stringify(original.summary)}\n\nRefinement: ${refinementMessage}`;
    return this.generateProposal(
      original.workspace_id,
      combinedMessage,
      existingSchema,
      'en',
      createdBy
    );
  },

  async getProposal(proposalId: string): Promise<any> {
    const db = getDatabase();
    try {
      const result = await db.query('SELECT * FROM tp_schema_proposals WHERE id = $1', [
        proposalId,
      ]);
      return result.rows[0] ?? null;
    } catch (e) {
      logger.error('[ChatToSchema] getProposal failed', {
        proposalId,
        error: (e as Error).message,
      });
      throw e;
    }
  },

  async listProposals(workspaceId: string, status?: string): Promise<any[]> {
    const db = getDatabase();
    try {
      let sql = 'SELECT * FROM tp_schema_proposals WHERE workspace_id = $1';
      const params: unknown[] = [workspaceId];
      if (status) {
        sql += ' AND status = $2';
        params.push(status);
      }
      sql += ' ORDER BY created_at DESC';
      const result = await db.query(sql, params);
      return result.rows;
    } catch (e) {
      logger.error('[ChatToSchema] listProposals failed', {
        workspaceId,
        status,
        error: (e as Error).message,
      });
      throw e;
    }
  },
};

export default chatToSchemaService;
