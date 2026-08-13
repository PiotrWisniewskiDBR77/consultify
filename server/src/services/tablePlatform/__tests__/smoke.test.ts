import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../AuditService.js', () => ({
  default: { logEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../ProjectionService.js', () => ({
  default: { invalidateCache: vi.fn(), clearCache: vi.fn() },
}));

vi.mock('../WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatchEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../RealtimeService.js', () => ({
  tablePlatformRealtime: {
    notifyRecordCreated: vi.fn(),
    notifyRecordUpdated: vi.fn(),
    notifyRecordDeleted: vi.fn(),
  },
  TablePlatformRealtimeService: vi.fn(),
}));

vi.mock('../AutomationService.js', () => ({
  automationService: { evaluateTriggers: vi.fn().mockResolvedValue(undefined) },
}));

const mockValidateRecord = vi.fn();
const mockValidateRecordSize = vi.fn();
vi.mock('../SchemaValidationService.js', () => ({
  default: {
    validateRecord: (...args: unknown[]) => mockValidateRecord(...args),
    validateRecordSize: (...args: unknown[]) => mockValidateRecordSize(...args),
    validateSchemaProposal: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
  },
}));

const mockOnRecordDeleted = vi.fn();
vi.mock('../RelationService.js', () => ({
  default: { onRecordDeleted: (...args: unknown[]) => mockOnRecordDeleted(...args) },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'smoke-uuid-001'),
}));

vi.mock('../../chatToSchema/intentParser.js', () => ({
  parseIntent: vi.fn(() => ({
    intent: 'create_table',
    confidence: 0.95,
    entities: { tableName: 'Tasks' },
  })),
}));

vi.mock('../../chatToSchema/schemaGrounder.js', () => ({
  groundSchema: vi.fn().mockResolvedValue('No existing schema.'),
}));

vi.mock('../../chatToSchema/proposalGenerator.js', () => ({
  generateProposal: vi.fn().mockResolvedValue({
    proposal_id: 'smoke-uuid-001',
    intent: 'create_table',
    summary: 'Create Tasks table',
    confidence: 0.95,
    operations: [
      {
        id: 'op_1',
        operation_type: 'create_table',
        target: { type: 'table', base_id: 'b-1' },
        payload: { name: 'Tasks' },
        dependencies: [],
        reversible: true,
      },
    ],
    warnings: [],
  }),
}));

vi.mock('../../chatToSchema/safetyGuardrails.js', () => ({
  validateProposalLimits: vi.fn(),
  checkRateLimit: vi.fn(),
  validateSchemaOperations: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

vi.mock('../../chatToSchema/undoRedoStack.js', () => ({
  getStack: vi.fn(() => ({
    push: vi.fn(),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    getUndoStack: vi.fn(() => []),
    getRedoStack: vi.fn(() => []),
    getHistory: vi.fn(() => []),
  })),
}));

import chatToSchemaService from '../ChatToSchemaService.js';
import governedModelService from '../GovernedModelService.js';
import metadataService from '../MetadataService.js';
import recordsService from '../RecordsService.js';

describe('Table Platform Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockValidateRecord.mockResolvedValue({ valid: true, errors: [] });
    mockValidateRecordSize.mockReturnValue(undefined);
    mockOnRecordDeleted.mockResolvedValue(undefined);
  });

  // =========================================================================
  // 1. MetadataService CRUD smoke
  // =========================================================================

  describe('MetadataService CRUD smoke', () => {
    it('createBase returns base with id and name', async () => {
      const baseRow = {
        id: 'smoke-uuid-001',
        name: 'Smoke Base',
        workspace_id: 'ws-1',
        organization_id: 'org-1',
      };
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [baseRow] });

      const base = await metadataService.createBase('ws-1', 'org-1', 'Smoke Base', 'user-1');
      expect(base.id).toBe('smoke-uuid-001');
      expect(base.name).toBe('Smoke Base');
    });

    it('createTable returns table with id, name, base_id', async () => {
      const tableRow = { id: 'smoke-uuid-001', name: 'Tasks', base_id: 'b-1' };
      const fieldsRows = [{ id: 'smoke-uuid-001', name: 'Name', field_type: 'single_line_text' }];
      const viewsRows = [{ id: 'smoke-uuid-001', name: 'Grid view', view_type: 'grid' }];
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [tableRow] })
        .mockResolvedValueOnce({ rows: fieldsRows })
        .mockResolvedValueOnce({ rows: viewsRows })
        .mockResolvedValueOnce({ rows: [{ schema_version: 2 }] })
        .mockResolvedValueOnce({ rows: [] });

      const table = await metadataService.createTable('b-1', 'Tasks', undefined, 'user-1');
      expect(table.id).toBe('smoke-uuid-001');
      expect(table.name).toBe('Tasks');
      expect(table.base_id).toBe('b-1');
    });

    it('createField returns field with correct type', async () => {
      const fieldRow = {
        id: 'smoke-uuid-001',
        name: 'Status',
        field_type: 'singleSelect',
        table_id: 't-1',
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ governance_mode: 'operational' }] }) // assertNotGoverned
        .mockResolvedValueOnce({ rows: [{ next_order: 1 }] }) // MAX order
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [fieldRow] }) // SELECT field
        .mockResolvedValueOnce({ rows: [{ base_id: 'b-1' }] }) // SELECT table for base_id
        .mockResolvedValueOnce({ rows: [{ schema_version: 3 }] }) // bumpSchemaVersion UPDATE
        .mockResolvedValueOnce({ rows: [] }); // bumpSchemaVersion INSERT

      const field = await metadataService.createField(
        't-1',
        'Status',
        'singleSelect',
        { options: [{ value: 'Done' }] },
        'user-1'
      );
      expect(field.name).toBe('Status');
      expect(field.field_type).toBe('singleSelect');
    });

    it('createView returns view object', async () => {
      const viewRow = {
        id: 'smoke-uuid-001',
        name: 'Kanban',
        view_type: 'kanban',
        table_id: 't-1',
      };
      mockQuery.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO tp_views'))
          return Promise.resolve({ rows: [] });
        if (typeof sql === 'string' && sql.includes('SELECT * FROM tp_views WHERE id'))
          return Promise.resolve({ rows: [viewRow] });
        if (typeof sql === 'string' && sql.includes('SELECT base_id FROM tp_tables'))
          return Promise.resolve({ rows: [{ base_id: 'b-1' }] });
        if (typeof sql === 'string' && sql.includes('schema_version = schema_version + 1'))
          return Promise.resolve({ rows: [{ schema_version: 4 }] });
        if (typeof sql === 'string' && sql.includes('tp_schema_versions'))
          return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [] });
      });

      const view = await metadataService.createView('t-1', 'Kanban', 'kanban', {}, 'user-1');
      expect(view).not.toBeNull();
      expect(view?.name).toBe('Kanban');
      expect(view?.view_type).toBe('kanban');
    });

    it('listBases returns array of bases', async () => {
      const baseRow = { id: 'b-1', name: 'Smoke Base', workspace_id: 'ws-1' };
      mockQuery.mockResolvedValueOnce({ rows: [baseRow] });

      const bases = await metadataService.listBases('ws-1', 'org-1');
      expect(bases).toHaveLength(1);
      expect(bases[0].name).toBe('Smoke Base');
    });

    it('deleteBase returns true when base exists', async () => {
      const baseRow = { id: 'b-1', name: 'Smoke Base' };
      mockQuery.mockResolvedValueOnce({ rows: [baseRow] }).mockResolvedValueOnce({ rows: [] });

      const deleted = await metadataService.deleteBase('b-1', 'user-1');
      expect(deleted).toBe(true);
    });

    it('deleteBase returns false when base does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const deleted = await metadataService.deleteBase('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  // =========================================================================
  // 2. RecordsService CRUD smoke
  // =========================================================================

  describe('RecordsService CRUD smoke', () => {
    it('createRecord calls validation, inserts, and returns record', async () => {
      const recordRow = { id: 'smoke-uuid-001', table_id: 't-1', data: { Name: 'Smoke Item' } };
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // SELECT tp_fields for default values
        .mockResolvedValueOnce({ rows: [] }) // loadAutoFields
        .mockResolvedValueOnce({ rows: [{ display_name: 'user-1' }] }) // resolveUserName
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [recordRow] }) // SELECT after insert
        .mockResolvedValueOnce({
          rows: [{ id: 'f1', name: 'Name', field_type: 'single_line_text', options: {} }],
        }) // recomputeAffectedFields tp_fields
        .mockResolvedValueOnce({ rows: [recordRow] }); // re-fetch after recompute

      const created = await recordsService.createRecord('t-1', { Name: 'Smoke Item' }, 'user-1');

      expect(mockValidateRecord).toHaveBeenCalledWith('t-1', { Name: 'Smoke Item' });
      expect(created).toEqual(recordRow);
    });

    it('getRecord returns record with data', async () => {
      const recordRow = { id: 'r-1', table_id: 't-1', data: { Name: 'Smoke Item' } };
      mockQuery
        .mockResolvedValueOnce({ rows: [recordRow] }) // SELECT record
        .mockResolvedValueOnce({ rows: [] }); // getAttachmentFieldIds

      const fetched = await recordsService.getRecord('r-1');
      expect(fetched).not.toBeNull();
      expect(fetched!.data.Name).toBe('Smoke Item');
    });

    it('getRecord returns null for missing record', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await recordsService.getRecord('nonexistent');
      expect(result).toBeNull();
    });

    it('updateRecord calls validation and updates record', async () => {
      const before = { id: 'r-1', table_id: 't-1', data: { Name: 'Old' } };
      const after = { id: 'r-1', table_id: 't-1', data: { Name: 'New' } };
      mockQuery
        .mockResolvedValueOnce({ rows: [before] }) // SELECT before
        .mockResolvedValueOnce({ rows: [] }) // loadAutoFields
        .mockResolvedValueOnce({ rows: [{ display_name: 'user-1' }] }) // resolveUserName
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [after] }) // SELECT after
        .mockResolvedValueOnce({
          rows: [{ id: 'f1', name: 'Name', field_type: 'single_line_text', options: {} }],
        }) // recomputeAffectedFields tp_fields
        .mockResolvedValueOnce({ rows: [after] }); // re-fetch after recompute

      const updated = await recordsService.updateRecord('r-1', { Name: 'New' }, 'user-1');
      expect(updated).toEqual(after);
    });

    it('listRecords returns paginated results', async () => {
      const records = [
        { id: 'r-1', table_id: 't-1', data: { Name: 'A' }, created_at: '2024-01-01' },
        { id: 'r-2', table_id: 't-1', data: { Name: 'B' }, created_at: '2024-01-02' },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // COUNT
        .mockResolvedValueOnce({ rows: records }) // SELECT records
        .mockResolvedValueOnce({ rows: [] }); // getAttachmentFieldIds

      const result = await recordsService.listRecords('t-1', { pageSize: 10 });
      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('deleteRecord calls onRecordDeleted and then deletes', async () => {
      const before = { id: 'r-1', table_id: 't-1', data: {} };
      mockQuery
        .mockResolvedValueOnce({ rows: [before] }) // SELECT before
        .mockResolvedValueOnce({ rows: [] }); // DELETE

      const deleted = await recordsService.deleteRecord('r-1', 'user-1');
      expect(mockOnRecordDeleted).toHaveBeenCalledWith('r-1');
      expect(deleted).toBe(true);
    });

    it('deleteRecord returns false when record does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await recordsService.deleteRecord('nonexistent');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // 3. ChatToSchemaService smoke
  // =========================================================================

  describe('ChatToSchemaService smoke', () => {
    it('generateProposal returns a valid proposal structure', async () => {
      const proposalRow = {
        id: 'smoke-uuid-001',
        workspace_id: 'ws-1',
        intent: 'create_table',
        confidence: 0.95,
        summary: 'Create Tasks table',
        operations: JSON.stringify([
          {
            id: 'op_1',
            operationType: 'create_table',
            target: { type: 'table', base_id: 'b-1' },
            payload: { name: 'Tasks' },
          },
        ]),
        warnings: '[]',
        status: 'pending',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // SELECT schema_version from tp_bases
        .mockResolvedValueOnce({ rows: [] }) // INSERT tp_schema_proposals
        .mockResolvedValueOnce({ rows: [proposalRow] }); // SELECT after insert

      const proposal = await chatToSchemaService.generateProposal(
        'ws-1',
        'Create a tasks table with name and status columns',
        undefined,
        'en',
        'user-1',
        { baseId: 'b-1' }
      );

      expect(proposal).toBeDefined();
      expect(proposal.id).toBe('smoke-uuid-001');
      // `generateProposal` returns the raw `tp_schema_proposals` row (snake_case)
      // while `SchemaProposal` declares camelCase — see ChatToSchemaService.ts:467.
      // Assert against the shape actually returned.
      expect((proposal as unknown as { workspace_id: string }).workspace_id).toBe('ws-1');
      expect(proposal.intent).toBeTruthy();
      expect(typeof proposal.confidence).toBe('number');
      expect(proposal.status).toBeTruthy();
    });

    it('getProposal returns null for missing proposal', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await chatToSchemaService.getProposal('nonexistent');
      expect(result).toBeNull();
    });

    it('listProposals returns array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await chatToSchemaService.listProposals('ws-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // =========================================================================
  // 4. GovernedModelService smoke
  // =========================================================================

  describe('GovernedModelService smoke', () => {
    it('full lifecycle: createModel → addKpi → computeKpi → deleteModel', async () => {
      // --- createModel ---
      const modelRow = {
        model_id: 'smoke-uuid-001',
        base_id: 'b-1',
        name: 'Revenue Model',
        description: 'Smoke test model',
      };
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [modelRow] });

      const model = await governedModelService.createModel(
        'b-1',
        'Revenue Model',
        'Smoke test model',
        'user-1'
      );
      expect(model.model_id).toBe('smoke-uuid-001');
      expect(model.name).toBe('Revenue Model');

      // --- addKpi ---
      const kpiRow = {
        kpi_id: 'smoke-uuid-001',
        model_id: 'smoke-uuid-001',
        code: 'total_revenue',
        label_en: 'Total Revenue',
        formula_type: 'field_sum',
        source_table_id: 't-1',
        source_field_id: 'f-revenue',
      };
      mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [kpiRow] });

      const kpi = await governedModelService.addKpi('smoke-uuid-001', {
        code: 'total_revenue',
        labelEn: 'Total Revenue',
        formulaType: 'field_sum',
        sourceTableId: 't-1',
        sourceFieldId: 'f-revenue',
        unit: 'USD',
      });
      expect(kpi.kpi_id).toBe('smoke-uuid-001');
      expect(kpi.code).toBe('total_revenue');

      // --- computeKpi (field_sum) ---
      mockQuery
        .mockResolvedValueOnce({ rows: [kpiRow] })
        .mockResolvedValueOnce({ rows: [{ val: 42500 }] });

      const computed = await governedModelService.computeKpi('smoke-uuid-001');
      expect(computed.kpiId).toBe('smoke-uuid-001');
      expect(computed.value).toBe(42500);
      expect(computed.computedAt).toBeTruthy();

      // --- deleteModel ---
      mockQuery.mockResolvedValueOnce({ rows: [modelRow] }).mockResolvedValueOnce({ rows: [] });

      const deleted = await governedModelService.deleteModel('smoke-uuid-001');
      expect(deleted).toBe(true);
    });

    it('computeKpi with field_count formula', async () => {
      const kpiRow = {
        kpi_id: 'count-kpi',
        model_id: 'm-1',
        code: 'record_count',
        formula_type: 'field_count',
        source_table_id: 't-1',
        source_field_id: null,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [kpiRow] })
        .mockResolvedValueOnce({ rows: [{ val: 15 }] });

      const result = await governedModelService.computeKpi('count-kpi');
      expect(result.value).toBe(15);
    });

    it('computeKpi throws for missing KPI', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(governedModelService.computeKpi('nonexistent')).rejects.toThrow(
        'KPI nonexistent not found'
      );
    });

    it('getModel returns model with kpis, dimensions, sources', async () => {
      const modelRow = { model_id: 'm-1', base_id: 'b-1', name: 'Test Model' };
      mockQuery
        .mockResolvedValueOnce({ rows: [modelRow] })
        .mockResolvedValueOnce({ rows: [{ kpi_id: 'k-1', code: 'revenue' }] })
        .mockResolvedValueOnce({ rows: [{ dimension_id: 'd-1', name: 'Region' }] })
        .mockResolvedValueOnce({ rows: [{ id: 's-1', table_id: 't-1', trusted: true }] });

      const result = await governedModelService.getModel('m-1');
      expect(result).not.toBeNull();
      expect(result!.model_id).toBe('m-1');
      expect(result!.kpis).toHaveLength(1);
      expect(result!.dimensions).toHaveLength(1);
      expect(result!.sources).toHaveLength(1);
    });

    it('getModel returns null for missing model', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await governedModelService.getModel('nonexistent');
      expect(result).toBeNull();
    });

    it('deleteModel returns false for missing model', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await governedModelService.deleteModel('nonexistent');
      expect(result).toBe(false);
    });
  });
});
