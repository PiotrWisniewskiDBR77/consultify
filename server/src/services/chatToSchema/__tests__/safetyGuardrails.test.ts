import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  validateProposalLimits,
  checkRateLimit,
  validateSchemaOperations,
  PROPOSAL_LIMITS,
} from '../safetyGuardrails.js';

import type { SchemaProposal } from '../proposalGenerator.js';

function makeProposal(overrides: Partial<SchemaProposal> = {}): SchemaProposal {
  return {
    proposal_id: 'prop-1',
    intent: 'create_table',
    confidence: 0.95,
    summary: 'Test proposal',
    operations: [],
    warnings: [],
    estimated_impact: {},
    ...overrides,
  };
}

function makeOp(type: string, payload: Record<string, unknown> = {}, target: Record<string, string> = {}) {
  return {
    id: `op-${Math.random().toString(36).slice(2, 8)}`,
    operation_type: type,
    target: { type: 'table', ...target },
    payload,
    reversible: true,
  };
}

describe('SafetyGuardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // validateProposalLimits
  // -----------------------------------------------------------------------

  describe('validateProposalLimits', () => {
    it('rejects too many tables (>5)', () => {
      const ops = Array.from({ length: 6 }, (_, i) =>
        makeOp('create_table', { name: `Table${i}`, fields: [] })
      );
      const proposal = makeProposal({ operations: ops });

      const result = validateProposalLimits(proposal);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('6 tables'))).toBe(true);
    });

    it('rejects too many fields per table (>25)', () => {
      const fields = Array.from({ length: 26 }, (_, i) => ({ name: `Field${i}`, type: 'text' }));
      const ops = [makeOp('create_table', { name: 'BigTable', fields })];
      const proposal = makeProposal({ operations: ops });

      const result = validateProposalLimits(proposal);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('26 fields'))).toBe(true);
    });

    it('rejects too many operations (>30)', () => {
      const ops = Array.from({ length: 31 }, () => makeOp('add_field', { name: 'f' }));
      const proposal = makeProposal({ operations: ops });

      const result = validateProposalLimits(proposal);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('31 operations'))).toBe(true);
    });

    it('accepts valid proposal within all limits', () => {
      const ops = [
        makeOp('create_table', { name: 'Tasks', fields: [{ name: 'Name', type: 'text' }] }),
        makeOp('add_field', { name: 'Status' }),
        makeOp('create_view', { name: 'Kanban' }),
      ];
      const proposal = makeProposal({ operations: ops });

      const result = validateProposalLimits(proposal);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts proposal at exact limits', () => {
      const fields = Array.from({ length: 25 }, (_, i) => ({ name: `F${i}`, type: 'text' }));
      const ops = [
        ...Array.from({ length: 5 }, (_, i) =>
          makeOp('create_table', { name: `T${i}`, fields: i === 0 ? fields : [] })
        ),
      ];
      const proposal = makeProposal({ operations: ops });

      const result = validateProposalLimits(proposal);

      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // checkRateLimit
  // -----------------------------------------------------------------------

  describe('checkRateLimit', () => {
    it('allows first request', () => {
      const result = checkRateLimit('unique-user-1', 'unique-org-1');
      expect(result.allowed).toBe(true);
    });

    it('blocks after 30 requests per user', () => {
      const userId = `user-rate-${Date.now()}`;
      const orgId = `org-rate-${Date.now()}`;

      for (let i = 0; i < 30; i++) {
        const r = checkRateLimit(userId, orgId);
        expect(r.allowed).toBe(true);
      }

      const blocked = checkRateLimit(userId, orgId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });

    it('blocks after 60 requests per org', () => {
      const orgId = `org-limit-${Date.now()}`;

      for (let i = 0; i < 60; i++) {
        const userId = `user-${i}-${Date.now()}`;
        const r = checkRateLimit(userId, orgId);
        expect(r.allowed).toBe(true);
      }

      const blocked = checkRateLimit(`user-overflow-${Date.now()}`, orgId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // validateSchemaOperations
  // -----------------------------------------------------------------------

  describe('validateSchemaOperations', () => {
    const mockGetFields = vi.fn<(tableId: string) => Promise<Array<{ key: string; name: string }>>>();
    const mockGetTableCount = vi.fn<(baseId: string) => Promise<number>>();

    beforeEach(() => {
      mockGetFields.mockResolvedValue([]);
      mockGetTableCount.mockResolvedValue(0);
    });

    it('rejects reserved field names', async () => {
      const ops = [
        {
          operation_type: 'create_field',
          target: { table_id: 't-1' },
          payload: { name: 'id' },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('reserved'))).toBe(true);
    });

    it('rejects duplicate field keys', async () => {
      mockGetFields.mockResolvedValue([
        { key: 'email', name: 'Email' },
      ]);

      const ops = [
        {
          operation_type: 'add_field',
          target: { table_id: 't-1' },
          payload: { name: 'Email' },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('already exists'))).toBe(true);
    });

    it('accepts valid field creation', async () => {
      mockGetFields.mockResolvedValue([
        { key: 'name', name: 'Name' },
      ]);

      const ops = [
        {
          operation_type: 'create_field',
          target: { table_id: 't-1' },
          payload: { name: 'Priority', key: 'priority' },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects when table has too many fields (>=100)', async () => {
      const existingFields = Array.from({ length: 100 }, (_, i) => ({
        key: `field_${i}`, name: `Field ${i}`,
      }));
      mockGetFields.mockResolvedValue(existingFields);

      const ops = [
        {
          operation_type: 'create_field',
          target: { table_id: 't-1' },
          payload: { name: 'OneMore', key: 'one_more' },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('100 fields'))).toBe(true);
    });

    it('warns on self-referencing linked record', async () => {
      const ops = [
        {
          operation_type: 'create_field',
          target: { table_id: 't-1' },
          payload: {
            name: 'Parent',
            key: 'parent',
            fieldType: 'linkedRecord',
            options: { linkedTableId: 't-1' },
          },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.warnings.some((w) => w.includes('self-referencing'))).toBe(true);
    });

    it('rejects when base has too many tables (>=50)', async () => {
      mockGetTableCount.mockResolvedValue(50);

      const ops = [
        {
          operation_type: 'create_table',
          target: { base_id: 'b-1' },
          payload: { name: 'NewTable' },
        },
      ];

      const result = await validateSchemaOperations(ops, mockGetFields, mockGetTableCount);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('50 tables'))).toBe(true);
    });
  });
});
