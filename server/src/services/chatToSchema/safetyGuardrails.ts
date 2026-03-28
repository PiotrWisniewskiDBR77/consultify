/**
 * Safety guardrails for Chat-to-Schema pipeline (WS-D §10).
 * Proposal limits, rate limiting, and schema validation checks.
 */

import type { SchemaProposal } from './proposalGenerator.js';

// ---------------------------------------------------------------------------
// Proposal limits (WS-D §10.1)
// ---------------------------------------------------------------------------

export const PROPOSAL_LIMITS = {
  MAX_TABLES_PER_PROPOSAL: 5,
  MAX_FIELDS_PER_TABLE: 25,
  MAX_FIELDS_ADDED: 10,
  MAX_RECORDS_SEEDED: 50,
  MAX_VIEWS_PER_PROPOSAL: 5,
  MAX_OPERATIONS_TOTAL: 30,
};

export function validateProposalLimits(proposal: SchemaProposal): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const tableOps = proposal.operations.filter((op) => op.operation_type === 'create_table');
  if (tableOps.length > PROPOSAL_LIMITS.MAX_TABLES_PER_PROPOSAL) {
    errors.push(
      `Proposal creates ${tableOps.length} tables (max ${PROPOSAL_LIMITS.MAX_TABLES_PER_PROPOSAL})`
    );
  }

  for (const op of tableOps) {
    const fields = (op.payload as Record<string, unknown>)?.fields;
    if (Array.isArray(fields) && fields.length > PROPOSAL_LIMITS.MAX_FIELDS_PER_TABLE) {
      errors.push(
        `Table "${(op.payload as Record<string, unknown>)?.name}" has ${fields.length} fields (max ${PROPOSAL_LIMITS.MAX_FIELDS_PER_TABLE})`
      );
    }
  }

  const fieldOps = proposal.operations.filter(
    (op) => op.operation_type === 'add_field' || op.operation_type === 'create_field'
  );
  if (fieldOps.length > PROPOSAL_LIMITS.MAX_FIELDS_ADDED) {
    errors.push(
      `Proposal adds ${fieldOps.length} fields (max ${PROPOSAL_LIMITS.MAX_FIELDS_ADDED})`
    );
  }

  const recordOps = proposal.operations.filter(
    (op) =>
      op.operation_type === 'create_record' ||
      op.operation_type === 'batch_create_records' ||
      op.operation_type === 'seed_records'
  );
  let totalRecords = 0;
  for (const op of recordOps) {
    if (op.operation_type === 'batch_create_records') {
      totalRecords +=
        ((op.payload as Record<string, unknown>)?.records as unknown[] | undefined)?.length ?? 0;
    } else {
      totalRecords += 1;
    }
  }
  if (totalRecords > PROPOSAL_LIMITS.MAX_RECORDS_SEEDED) {
    errors.push(
      `Proposal seeds ${totalRecords} records (max ${PROPOSAL_LIMITS.MAX_RECORDS_SEEDED})`
    );
  }

  const viewOps = proposal.operations.filter(
    (op) => op.operation_type === 'create_view' || op.operation_type === 'add_view'
  );
  if (viewOps.length > PROPOSAL_LIMITS.MAX_VIEWS_PER_PROPOSAL) {
    errors.push(
      `Proposal creates ${viewOps.length} views (max ${PROPOSAL_LIMITS.MAX_VIEWS_PER_PROPOSAL})`
    );
  }

  if (proposal.operations.length > PROPOSAL_LIMITS.MAX_OPERATIONS_TOTAL) {
    errors.push(
      `Proposal has ${proposal.operations.length} operations (max ${PROPOSAL_LIMITS.MAX_OPERATIONS_TOTAL})`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Rate limiting — in-memory (WS-D §10.5)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const HOUR_MS = 3_600_000;
const USER_LIMIT_PER_HOUR = 30;
const ORG_LIMIT_PER_HOUR = 60;

export function checkRateLimit(
  userId: string,
  orgId: string
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const userKey = `user:${userId}`;
  const orgKey = `org:${orgId}`;

  const userEntry = rateLimitStore.get(userKey);
  if (userEntry && userEntry.resetAt > now) {
    if (userEntry.count >= USER_LIMIT_PER_HOUR) {
      return { allowed: false, retryAfterMs: userEntry.resetAt - now };
    }
    userEntry.count++;
  } else {
    rateLimitStore.set(userKey, { count: 1, resetAt: now + HOUR_MS });
  }

  const orgEntry = rateLimitStore.get(orgKey);
  if (orgEntry && orgEntry.resetAt > now) {
    if (orgEntry.count >= ORG_LIMIT_PER_HOUR) {
      return { allowed: false, retryAfterMs: orgEntry.resetAt - now };
    }
    orgEntry.count++;
  } else {
    rateLimitStore.set(orgKey, { count: 1, resetAt: now + HOUR_MS });
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Schema validation checks (WS-D §7)
// ---------------------------------------------------------------------------

const RESERVED_FIELD_KEYS = new Set(['id', 'created_at', 'updated_at', 'version', 'table_id']);

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateSchemaOperations(
  operations: Array<{
    operation_type: string;
    target?: Record<string, string>;
    payload?: Record<string, unknown>;
  }>,
  getFieldsForTable: (tableId: string) => Promise<Array<{ key: string; name: string }>>,
  getTableCountForBase: (baseId: string) => Promise<number>
): Promise<SchemaValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const op of operations) {
    const payload = op.payload ?? {};
    const fieldKey = (payload.key ?? payload.name ?? '') as string;
    const fieldKeyLower = fieldKey.toLowerCase().replace(/\s+/g, '_');

    if (op.operation_type === 'create_field' || op.operation_type === 'add_field') {
      if (RESERVED_FIELD_KEYS.has(fieldKeyLower)) {
        errors.push(`Field key "${fieldKey}" is reserved and cannot be used`);
      }

      const tableId = op.target?.table_id ?? op.target?.tableId;
      if (tableId && !tableId.startsWith('op_') && !tableId.startsWith('@ref:')) {
        try {
          const existingFields = await getFieldsForTable(tableId);
          const duplicate = existingFields.find(
            (f) =>
              f.name.toLowerCase() === fieldKey.toLowerCase() ||
              f.key.toLowerCase() === fieldKeyLower
          );
          if (duplicate) {
            errors.push(`Field "${fieldKey}" already exists in table ${tableId}`);
          }
          if (existingFields.length >= 100) {
            errors.push(`Table ${tableId} already has ${existingFields.length} fields (max 100)`);
          }
        } catch {
          // Table may not exist yet (created in same proposal)
        }
      }

      if (
        (payload.fieldType === 'linkedRecord' || payload.fieldType === 'linked_record') &&
        payload.options
      ) {
        const opts = payload.options as Record<string, unknown>;
        const linkedTableId = (opts.linkedTableId ?? opts.linked_table_id) as string | undefined;
        const currentTableId = op.target?.table_id ?? op.target?.tableId;
        if (linkedTableId && currentTableId && linkedTableId === currentTableId) {
          warnings.push(
            `Field "${fieldKey}" creates a self-referencing link on table ${currentTableId}`
          );
        }
      }
    }

    if (op.operation_type === 'create_table' || op.operation_type === 'add_table') {
      const baseId = op.target?.base_id ?? op.target?.baseId;
      if (baseId && !baseId.startsWith('op_') && !baseId.startsWith('@ref:')) {
        try {
          const tableCount = await getTableCountForBase(baseId);
          if (tableCount >= 50) {
            errors.push(`Base ${baseId} already has ${tableCount} tables (max 50)`);
          }
        } catch {
          // Base may not exist yet
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
