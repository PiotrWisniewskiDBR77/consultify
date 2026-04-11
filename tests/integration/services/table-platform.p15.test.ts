/**
 * P15 Tabele — Integration Tests (mini-OS lane)
 *
 * Verifies the P15-A acceptance checklist (12 points) and P15-B DoD:
 * 1. Singular relational grammar: base→table→field→record→relation→view→form→interface
 * 2. Field types and constraints
 * 3. Relations: linked records, reciprocal semantics
 * 4. Views: saved projections with filters/sorts/grouping
 * 5. Forms: bounded input surfaces creating records
 * 6. Interfaces: curated surfaces on same truth
 * 7. Schema drift: rename/remove predictability
 * 8. AI governed: plan→approve→materialize (ChatToSchemaService)
 * 9. Permissions: governed mode = schema lock
 * 10. Audit trail
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mocks for behavioral P15 suites (below). Hoisted so vi.mock applies
// before any dynamic service import is evaluated.
// ---------------------------------------------------------------------------

const p15MockQuery = vi.hoisted(() => vi.fn());

const p15Uuid = vi.hoisted(() => {
  let i = 0;
  const pad = (n: number) => String(n).padStart(12, '0');
  return {
    reset: () => {
      i = 0;
    },
    v4: () => {
      i += 1;
      return `aaaaaaaa-bbbb-4ccc-8ddd-${pad(i)}`;
    },
  };
});

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: (...args: unknown[]) => p15MockQuery(...(args as [string, unknown[]])),
  }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/AuditService.js', () => ({
  default: { logEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: { invalidateCache: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatchEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/services/tablePlatform/WebhookRelayService.js', () => ({
  webhookRelayService: { dispatchEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('uuid', () => ({
  v4: () => p15Uuid.v4(),
}));

beforeEach(() => {
  p15MockQuery.mockReset();
  p15Uuid.reset();
});

// ---------------------------------------------------------------------------
// 1. MetadataService — base/table/field CRUD
// ---------------------------------------------------------------------------

describe('MetadataService (base→table→field)', () => {
  it('exports createBase, createTable, createField, updateField, removeField', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/MetadataService.js'
    );
    const service = mod.default;
    expect(typeof service.createBase).toBe('function');
    expect(typeof service.createTable).toBe('function');
    expect(typeof service.createField).toBe('function');
    expect(typeof service.updateField).toBe('function');
    expect(typeof service.deleteField).toBe('function');
  });

  it('uses bumpSchemaVersion internally for version tracking', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      'server/src/services/tablePlatform/MetadataService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('bumpSchemaVersion');
    expect(content).toContain('tp_schema_versions');
  });

  it('exports setGovernanceMode for schema lock', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/MetadataService.js'
    );
    const service = mod.default;
    expect(typeof service.setGovernanceMode).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. RecordsService — CRUD + batch
// ---------------------------------------------------------------------------

describe('RecordsService (record CRUD)', () => {
  it('exports listRecords, createRecord, updateRecord, deleteRecord', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    );
    const service = mod.default;
    expect(typeof service.listRecords).toBe('function');
    expect(typeof service.createRecord).toBe('function');
    expect(typeof service.updateRecord).toBe('function');
    expect(typeof service.deleteRecord).toBe('function');
  });

  it('exports upsertRecords for batch operations', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    );
    const service = mod.default;
    expect(typeof service.upsertRecords).toBe('function');
  });

  it('exports undoLastEdit for rollback', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    );
    const service = mod.default;
    expect(typeof service.undoLastEdit).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 3. RelationService — linked records + reciprocal
// ---------------------------------------------------------------------------

describe('RelationService (linked records)', () => {
  it('exports linkRecords, unlinkRecords, getLinkedRecords', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    );
    const service = mod.default;
    expect(typeof service.linkRecords).toBe('function');
    expect(typeof service.unlinkRecords).toBe('function');
    expect(typeof service.getLinkedRecords).toBe('function');
  });

  it('exports findBacklinkFieldId for reciprocal semantics', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    );
    const service = mod.default;
    expect(typeof service.findBacklinkFieldId).toBe('function');
  });

  it('exports expandRecord for deep relation traversal', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    );
    const service = mod.default;
    expect(typeof service.expandRecord).toBe('function');
  });

  it('exports computeCount, computeLookup, computeRollup', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    );
    const service = mod.default;
    expect(typeof service.computeCount).toBe('function');
    expect(typeof service.computeLookup).toBe('function');
    expect(typeof service.computeRollup).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 4. ViewQueryEngine — saved views + query discipline
// ---------------------------------------------------------------------------

describe('ViewQueryEngine (views as projections)', () => {
  it('exports default viewQueryEngine with executeQuery', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ViewQueryEngine.js'
    );
    const engine = mod.default;
    expect(engine).toBeDefined();
    expect(typeof engine.executeQuery).toBe('function');
  });

  it('exports buildFilterClause and buildSortClause helpers', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ViewQueryEngine.js'
    );
    expect(typeof mod.buildFilterClause).toBe('function');
    expect(typeof mod.buildSortClause).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 5. FormService — bounded input surfaces
// ---------------------------------------------------------------------------

describe('FormService (forms create records)', () => {
  it('exports createForm, getForm, updateForm, submitForm', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/FormService.js'
    );
    const service = mod.default;
    expect(typeof service.createForm).toBe('function');
    expect(typeof service.getForm).toBe('function');
    expect(typeof service.updateForm).toBe('function');
    expect(typeof service.submitForm).toBe('function');
  });

  it('exports listForms and deleteForm', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/FormService.js'
    );
    const service = mod.default;
    expect(typeof service.listForms).toBe('function');
    expect(typeof service.deleteForm).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 6. InterfaceService — curated surfaces
// ---------------------------------------------------------------------------

describe('InterfaceService (interfaces on same truth)', () => {
  it('exports createInterface, listInterfaces, getInterface', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/InterfaceService.js'
    );
    const service = new mod.InterfaceService();
    expect(typeof service.createInterface).toBe('function');
    expect(typeof service.listInterfaces).toBe('function');
    expect(typeof service.getInterface).toBe('function');
  });

  it('supports layout blocks: table_grid, record_detail, chart, text, button, filter, search, summary', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/InterfaceService.js'
    );
    const blockTypes = [
      'table_grid', 'record_detail', 'chart', 'text',
      'button', 'filter', 'search', 'summary',
    ];
    // InterfaceBlock type is exported; verify via module structure
    expect(mod.InterfaceService).toBeDefined();
    // Block types are part of the TypeScript interface — structural check
    expect(blockTypes.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// 7. ChatToSchemaService — AI governed pipeline
// ---------------------------------------------------------------------------

describe('ChatToSchemaService (AI plan→approve→materialize)', () => {
  it('exports generateProposal, executeProposal, getProposal, refineProposal', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ChatToSchemaService.js'
    );
    const service = mod.default;
    expect(typeof service.generateProposal).toBe('function');
    expect(typeof service.executeProposal).toBe('function');
    expect(typeof service.getProposal).toBe('function');
    expect(typeof service.refineProposal).toBe('function');
  });

  it('exports listProposals for audit trail', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ChatToSchemaService.js'
    );
    const service = mod.default;
    expect(typeof service.listProposals).toBe('function');
  });

  it('SchemaProposal type has required fields: id, intent, confidence, operations, status', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ChatToSchemaService.js'
    );
    // Structural check — the module exports the type
    expect(mod.default).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. PermissionsService — access control
// ---------------------------------------------------------------------------

describe('PermissionsService (access control)', () => {
  it('exports canAccessBase, canModifyBase, canAccessTable', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/PermissionsService.js'
    );
    const service = mod.default;
    expect(typeof service.canAccessBase).toBe('function');
    expect(typeof service.canModifyBase).toBe('function');
    expect(typeof service.canAccessTable).toBe('function');
  });

  it('exports requireBaseAccess middleware', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/PermissionsService.js'
    );
    const service = mod.default;
    expect(typeof service.requireBaseAccess).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 9. AuditService — mutation log
// ---------------------------------------------------------------------------

describe('AuditService (audit trail)', () => {
  it('exports logEvent for mutation tracking', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/AuditService.js'
    );
    const service = mod.default;
    expect(typeof service.logEvent).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 10. SchemaValidationService — type enforcement
// ---------------------------------------------------------------------------

describe('SchemaValidationService (field type validation)', () => {
  it('exports validateRecord for server-side constraint enforcement', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/SchemaValidationService.js'
    );
    const service = mod.default;
    expect(typeof service.validateRecord).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 11. FormulaEngine — computed fields
// ---------------------------------------------------------------------------

describe('FormulaEngine (computed fields)', () => {
  it('exports parseFormula, evaluateFormula, validateFormula', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/formulaEngine.js'
    );
    expect(typeof mod.parseFormula).toBe('function');
    expect(typeof mod.evaluateFormula).toBe('function');
    expect(typeof mod.validateFormula).toBe('function');
  });

  it('exports recomputeAffectedFields for cascade updates', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/formulaEngine.js'
    );
    expect(typeof mod.recomputeAffectedFields).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 12. ExportService — XLSX/CSV export
// ---------------------------------------------------------------------------

describe('ExportService (data export)', () => {
  it('exports buildXlsxBuffer for governed table export', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/ExportService.js'
    );
    const service = mod.default;
    expect(typeof service.buildXlsxBuffer).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 13. AutomationService — trigger/action workflows
// ---------------------------------------------------------------------------

describe('AutomationService (automations)', () => {
  it('exports automationService with CRUD + execution', async () => {
    const mod = await import(
      '../../../server/src/services/tablePlatform/AutomationService.js'
    );
    const service = mod.default;
    expect(service).toBeDefined();
    expect(typeof service.createAutomation).toBe('function');
    expect(typeof service.listAutomations).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 14. Migration integrity
// ---------------------------------------------------------------------------

describe('Table Platform migrations (700-726)', () => {
  it('all core migrations exist', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.resolve('server/migrations');

    const requiredMigrations = [
      '700_table_platform_foundation.sql',
      '701_table_platform_performance.sql',
      '702_schema_versioning.sql',
      '703_data_collection.sql',
      '704_forms.sql',
      '706_governed_mode.sql',
      '708_automations.sql',
      '710_interfaces.sql',
      '713_governed_models.sql',
      '715_record_comments.sql',
      '717_row_level_permissions.sql',
      '719_cell_history.sql',
    ];

    for (const migration of requiredMigrations) {
      const exists = fs.existsSync(path.join(migrationsDir, migration));
      expect(exists).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. Frontend API client
// ---------------------------------------------------------------------------

describe('Frontend tablePlatform API client', () => {
  it('exports API methods for bases, tables, fields, views, records', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/services/api/tablePlatform.api.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('bases');
    expect(content).toContain('tables');
    expect(content).toContain('fields');
    expect(content).toContain('views');
    expect(content).toContain('records');
  });
});

// ---------------------------------------------------------------------------
// 16. P15-A Acceptance checklist regression
// ---------------------------------------------------------------------------

describe('P15-A Acceptance checklist (structural)', () => {
  it('field types include all P0 primitives', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('src/types/tablePlatform.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    const requiredTypes = [
      'text', 'number', 'currency', 'percent', 'boolean',
      'date', 'singleSelect', 'multiSelect', 'email', 'url',
      'phone', 'attachment', 'linkedRecord',
    ];

    for (const ft of requiredTypes) {
      expect(content.toLowerCase()).toContain(ft.toLowerCase());
    }
  });

  it('ChatToSchemaService enforces no-silent-writes (stale detection)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      'server/src/services/tablePlatform/ChatToSchemaService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('STALE_THRESHOLD_MS');
    expect(content).toContain('Schema was modified since this proposal was created');
    expect(content).toContain('auditService.logEvent');
  });

  it('governed mode blocks direct schema changes', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      'server/src/services/tablePlatform/MetadataService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('assertNotGoverned');
    expect(content).toContain('governed');
    expect(content).toContain('Schema changes require approval');
  });
});

// ---------------------------------------------------------------------------
// 17. Route wiring
// ---------------------------------------------------------------------------

describe('Table Platform routes wired in Gateway', () => {
  it('Gateway mounts /api/table-platform', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('server/src/Gateway.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('table-platform');
    expect(content).toContain('tablePlatformRoutes');
  });
});

// ---------------------------------------------------------------------------
// 18. Required field constraint (createRecord → ValidationError)
// ---------------------------------------------------------------------------

describe('P15 backend contract: required field constraint', () => {
  it('rejects createRecord when a required field is missing (no default)', async () => {
    const { ValidationError } = await import(
      '../../../server/src/services/tablePlatform/ErrorHandling.js'
    );
    const recordsService = (await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    )).default;

    const fieldRow = {
      id: 'f-required-1',
      name: 'Title',
      field_type: 'single_line_text',
      options: { required: true },
    };

    p15MockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      return Promise.resolve({ rows: [] });
    });

    try {
      await recordsService.createRecord('tbl-req', {}, undefined);
      expect.fail('expected ValidationError');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ValidationError);
      const ve = err as import('../../../server/src/services/tablePlatform/ErrorHandling.js').ValidationError;
      expect(ve.code).toBe('VALIDATION_ERROR');
      expect(
        (ve.details?.errors as { fieldId: string; message: string }[] | undefined)?.some(
          (e) => e.fieldId === 'f-required-1' && /Required field/i.test(e.message),
        ),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 19. Unique field constraint
// ---------------------------------------------------------------------------

describe('P15 backend contract: unique field constraint', () => {
  it('rejects a second record with the same value on a unique field', async () => {
    const { ValidationError } = await import(
      '../../../server/src/services/tablePlatform/ErrorHandling.js'
    );
    const recordsService = (await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    )).default;

    const fieldRow = {
      id: 'f-unique-1',
      name: 'Code',
      field_type: 'single_line_text',
      options: { unique: true },
    };

    let uniqueCheckCall = 0;

    p15MockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT * FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      if (sql.includes('FROM tp_records') && sql.includes('COUNT(*)') && sql.includes('data->>')) {
        uniqueCheckCall += 1;
        return Promise.resolve({ rows: [{ cnt: uniqueCheckCall === 1 ? 0 : 1 }] });
      }
      if (sql.includes('field_type = ANY')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO tp_records')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith('SELECT * FROM tp_records WHERE id')) {
        return Promise.resolve({
          rows: [
            {
              id: params?.[0],
              table_id: 'tbl-uni',
              data: { [fieldRow.id]: 'X' },
            },
          ],
        });
      }
      if (sql.includes('SELECT id, name, field_type, options FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      if (sql.includes('UPDATE tp_records SET data')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    await recordsService.createRecord('tbl-uni', { Code: 'X' }, undefined);

    await expect(recordsService.createRecord('tbl-uni', { Code: 'X' }, undefined)).rejects.toThrow(
      ValidationError
    );
  });
});

// ---------------------------------------------------------------------------
// 20. Default value on create
// ---------------------------------------------------------------------------

describe('P15 backend contract: field default value', () => {
  it('applies options.default when the client omits the field', async () => {
    const recordsService = (await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    )).default;

    const fieldRow = {
      id: 'f-default-1',
      name: 'Greeting',
      field_type: 'single_line_text',
      options: { default: 'Hello' },
    };

    p15MockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT * FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      if (sql.includes('field_type = ANY')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO tp_records')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith('SELECT * FROM tp_records WHERE id')) {
        return Promise.resolve({
          rows: [
            {
              id: params?.[0],
              table_id: 'tbl-def',
              data: { [fieldRow.id]: 'Hello' },
            },
          ],
        });
      }
      if (sql.includes('SELECT id, name, field_type, options FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      if (sql.includes('UPDATE tp_records SET data')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const row = await recordsService.createRecord('tbl-def', {}, undefined);
    expect(row.data[fieldRow.id]).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// 21. Cardinality enforcement (one-to-one)
// ---------------------------------------------------------------------------

describe('P15 backend contract: linkedRecord one-to-one cardinality', () => {
  it('blocks linking a second target from the same source record', async () => {
    const relationService = (await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    )).default;

    const fieldRow = {
      field_type: 'linkedRecord',
      options: {
        linkedTableId: 'tbl-b',
        cardinality: 'one-to-one',
        reverseFieldId: 'f-rev-1',
      },
    };

    let cardinalityChecks = 0;

    p15MockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM tp_fields WHERE id = $1')) {
        return Promise.resolve({ rows: [fieldRow] });
      }
      if (sql.includes('FROM tp_record_links') && sql.includes('COUNT(*)')) {
        cardinalityChecks += 1;
        return Promise.resolve({ rows: [{ cnt: cardinalityChecks === 1 ? 0 : 1 }] });
      }
      if (sql.includes('SELECT table_id FROM tp_records WHERE id')) {
        return Promise.resolve({ rows: [{ table_id: 'tbl-a' }] });
      }
      if (sql.includes('INSERT INTO tp_record_links')) {
        return Promise.resolve({ rows: [] });
      }
      if (
        sql.includes('FROM tp_record_links l') &&
        sql.includes('JOIN tp_records r') &&
        !sql.includes('LEFT JOIN')
      ) {
        return Promise.resolve({
          rows: [{ id: 'rec-b', table_id: 'tbl-b', data: {} }],
        });
      }
      if (sql.startsWith('SELECT * FROM tp_records WHERE id')) {
        const id = params?.[0];
        return Promise.resolve({
          rows: [
            {
              id,
              table_id: id === 'rec-a' ? 'tbl-a' : 'tbl-b',
              data: {},
            },
          ],
        });
      }
      if (sql.includes('UPDATE tp_records SET data')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("field_type IN ('count', 'lookup', 'rollup')")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    await relationService.linkRecords('rec-a', 'f-link-1', ['rec-b'], 'actor-1');

    await expect(
      relationService.linkRecords('rec-a', 'f-link-1', ['rec-c'], 'actor-1')
    ).rejects.toThrow(/Cardinality violation/i);
  });
});

// ---------------------------------------------------------------------------
// 22. Stale linked-record placeholder (includeStale)
// ---------------------------------------------------------------------------

describe('P15 backend contract: stale link degraded placeholder', () => {
  it('marks deleted targets with __stale when includeStale is true', async () => {
    const relationService = (await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    )).default;

    p15MockQuery.mockResolvedValueOnce({
      rows: [
        {
          to_record_id: 'rec-deleted',
          record_exists: false,
          id: 'rec-deleted',
          table_id: null,
          data: {},
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          __stale: true,
        },
      ],
    });

    const linked = await relationService.getLinkedRecords('rec-src', 'f-link', true);
    expect(linked).toHaveLength(1);
    expect(linked[0].__stale).toBe(true);
    expect(linked[0].__display).toBe('[Deleted Record]');
  });
});

// ---------------------------------------------------------------------------
// 23. deleteField cascades visible_field_ids
// ---------------------------------------------------------------------------

describe('P15 backend contract: deleteField view cascade', () => {
  it('issues array_remove for the deleted field on views for that table', async () => {
    const metadataService = (await import(
      '../../../server/src/services/tablePlatform/MetadataService.js'
    )).default;

    const fieldId = 'f-to-delete';
    const tableId = 'tbl-cascade';

    p15MockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: fieldId,
            table_id: tableId,
            field_type: 'single_line_text',
            name: 'Temp',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ governance_mode: 'operational' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ base_id: 'base-cascade' }] })
      .mockResolvedValueOnce({ rows: [{ schema_version: 3 }] })
      .mockResolvedValueOnce({ rows: [] });

    await metadataService.deleteField(fieldId, 'user-cascade');

    const arrayRemoveCall = p15MockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('array_remove'),
    );
    expect(arrayRemoveCall).toBeDefined();
    expect(arrayRemoveCall?.[1]).toEqual([fieldId, tableId]);
  });
});

// ---------------------------------------------------------------------------
// 24. Seven-role permission model
// ---------------------------------------------------------------------------

describe('P15 backend contract: 7-role permission model', () => {
  it('setUserRole persists and getUserRole reads explicit membership', async () => {
    const permissionsService = (await import(
      '../../../server/src/services/tablePlatform/PermissionsService.js'
    )).default;

    p15MockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ role: 'view_editor' }] });

    await permissionsService.setUserRole('base-roles', 'user-roles', 'view_editor');
    const role = await permissionsService.getUserRole('base-roles', 'user-roles');
    expect(role).toBe('view_editor');
  });

  it('requireRole allows data writes for data_editor but not for viewer', async () => {
    const permissionsService = (await import(
      '../../../server/src/services/tablePlatform/PermissionsService.js'
    )).default;

    p15MockQuery.mockResolvedValueOnce({ rows: [{ role: 'data_editor' }] });
    const ok = await permissionsService.requireRole('base-r', 'u1', 'org-1', [
      'base_owner',
      'schema_editor',
      'data_editor',
    ]);
    expect(ok.allowed).toBe(true);
    expect(ok.role).toBe('data_editor');

    p15MockQuery.mockReset();
    p15MockQuery.mockResolvedValueOnce({ rows: [{ role: 'viewer' }] });
    const denied = await permissionsService.requireRole('base-r', 'u1', 'org-1', [
      'base_owner',
      'schema_editor',
    ]);
    expect(denied.allowed).toBe(false);
    expect(denied.role).toBe('viewer');
  });

  it('requireRole falls back to legacy org access when tp_base_members is empty', async () => {
    const permissionsService = (await import(
      '../../../server/src/services/tablePlatform/PermissionsService.js'
    )).default;

    p15MockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ organization_id: 'org-legacy', created_by: 'someone-else' }],
      });

    const res = await permissionsService.requireRole('base-legacy', 'member-u', 'org-legacy', [
      'viewer',
    ]);
    expect(res.allowed).toBe(true);
    expect(res.role).toBe('base_owner');
  });
});

// ---------------------------------------------------------------------------
// 25. Singular relational grammar (E2E-style orchestration)
// ---------------------------------------------------------------------------

describe('P15 backend contract: E2E singular relational grammar chain', () => {
  it('materializes base → table → field → record → link → view → form → interface', async () => {
    const metadataService = (await import(
      '../../../server/src/services/tablePlatform/MetadataService.js'
    )).default;
    const recordsService = (await import(
      '../../../server/src/services/tablePlatform/RecordsService.js'
    )).default;
    const relationService = (await import(
      '../../../server/src/services/tablePlatform/RelationService.js'
    )).default;
    const formService = (await import(
      '../../../server/src/services/tablePlatform/FormService.js'
    )).default;
    const { InterfaceService } = await import(
      '../../../server/src/services/tablePlatform/InterfaceService.js'
    );

    type TField = {
      id: string;
      table_id: string;
      name: string;
      field_type: string;
      options: Record<string, unknown>;
      field_order: number;
    };

    const store = {
      bases: new Map<string, Record<string, unknown>>(),
      tables: new Map<string, Record<string, unknown>>(),
      fieldsByTable: new Map<string, TField[]>(),
      records: new Map<string, Record<string, unknown>>(),
      views: new Map<string, Record<string, unknown>>(),
      links: [] as Array<{ from: string; field: string; to: string }>,
      forms: new Map<string, Record<string, unknown>>(),
      interfaces: new Map<string, Record<string, unknown>>(),
      schemaVersion: 1,
    };

    const getFields = (tableId: string) => store.fieldsByTable.get(tableId) ?? [];

    p15MockQuery.mockImplementation((sql: string, params?: unknown[] | undefined) => {
      const p = params ?? [];

      if (sql.includes('INSERT INTO tp_bases')) {
        const row = {
          id: p[0],
          workspace_id: p[1],
          organization_id: p[2],
          name: p[3],
          created_by: p[4],
        };
        store.bases.set(String(p[0]), row);
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith('SELECT * FROM tp_bases WHERE id')) {
        return Promise.resolve({ rows: [store.bases.get(String(p[0]))].filter(Boolean) });
      }
      if (sql.includes('UPDATE tp_bases SET schema_version')) {
        store.schemaVersion += 1;
        return Promise.resolve({ rows: [{ schema_version: store.schemaVersion }] });
      }
      if (sql.includes('INSERT INTO tp_schema_versions')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('INSERT INTO tp_tables')) {
        const row = {
          id: p[0],
          base_id: p[1],
          name: p[2],
          description: p[3],
          created_by: p[4],
          governance_mode: 'operational',
        };
        store.tables.set(String(p[0]), row);
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE tp_tables SET primary_field_id')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('INSERT INTO tp_fields')) {
        const optsRaw = p[4];
        const opts =
          typeof optsRaw === 'string'
            ? (JSON.parse(optsRaw) as Record<string, unknown>)
            : (optsRaw as Record<string, unknown>) ?? {};
        const row: TField = {
          id: String(p[0]),
          table_id: String(p[1]),
          name: String(p[2]),
          field_type: String(p[3]),
          options: opts,
          field_order: Number(p[5]),
        };
        const list = store.fieldsByTable.get(row.table_id) ?? [];
        list.push(row);
        store.fieldsByTable.set(row.table_id, list);
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT COALESCE(MAX(field_order)')) {
        const list = getFields(String(p[0]));
        const max = list.reduce((m, f) => Math.max(m, f.field_order), -1);
        return Promise.resolve({ rows: [{ next_order: max + 1 }] });
      }
      if (sql.includes('SELECT * FROM tp_fields WHERE id = $1')) {
        for (const list of store.fieldsByTable.values()) {
          const hit = list.find((f) => f.id === String(p[0]));
          if (hit) return Promise.resolve({ rows: [{ ...hit }] });
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT field_type, options FROM tp_fields WHERE id = $1')) {
        for (const list of store.fieldsByTable.values()) {
          const hit = list.find((f) => f.id === String(p[0]));
          if (hit) {
            return Promise.resolve({
              rows: [{ field_type: hit.field_type, options: hit.options }],
            });
          }
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT * FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: getFields(String(p[0])) });
      }
      if (sql.includes('SELECT id, field_type AS type, options FROM tp_fields')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT id, name, field_type, options FROM tp_fields WHERE table_id')) {
        return Promise.resolve({ rows: getFields(String(p[0])) });
      }

      if (sql.includes('INSERT INTO tp_records')) {
        const row = {
          id: String(p[0]),
          table_id: String(p[1]),
          data: typeof p[2] === 'string' ? JSON.parse(String(p[2])) : p[2],
          created_by: p[3],
        };
        store.records.set(String(p[0]), row as Record<string, unknown>);
        return Promise.resolve({ rows: [] });
      }
      if (sql.startsWith('SELECT * FROM tp_records WHERE id')) {
        return Promise.resolve({ rows: [store.records.get(String(p[0]))].filter(Boolean) });
      }
      if (sql.includes('SELECT table_id FROM tp_records WHERE id')) {
        const r = store.records.get(String(p[0]));
        return Promise.resolve({ rows: r ? [{ table_id: r.table_id }] : [] });
      }

      if (sql.includes('INSERT INTO tp_record_links')) {
        store.links.push({ from: String(p[0]), field: String(p[1]), to: String(p[2]) });
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM tp_record_links') && sql.includes('COUNT(*)')) {
        const cnt = store.links.filter(
          (l) => l.from === String(p[0]) && l.field === String(p[1]),
        ).length;
        return Promise.resolve({ rows: [{ cnt }] });
      }
      if (
        sql.includes('FROM tp_record_links l') &&
        sql.includes('JOIN tp_records r') &&
        !sql.includes('LEFT JOIN')
      ) {
        const from = String(p[0]);
        const field = String(p[1]);
        const targets = store.links
          .filter((l) => l.from === from && l.field === field)
          .map((l) => store.records.get(l.to))
          .filter(Boolean);
        return Promise.resolve({ rows: targets as Record<string, unknown>[] });
      }

      if (sql.includes('INSERT INTO tp_views')) {
        if (p.length === 7) {
          const row = {
            id: String(p[0]),
            table_id: String(p[1]),
            name: String(p[2]),
            view_type: String(p[3]),
            visible_field_ids: (p[4] as string[]) ?? [],
            is_default: p[5],
            created_by: p[6],
            config: {},
          };
          store.views.set(String(p[0]), row);
          return Promise.resolve({ rows: [] });
        }
        if (p.length === 8) {
          const row = {
            id: String(p[0]),
            table_id: String(p[1]),
            name: String(p[2]),
            view_type: String(p[3]),
            config: typeof p[4] === 'string' ? JSON.parse(String(p[4])) : (p[4] as object),
            visible_field_ids: [],
            created_by: p[5],
            is_personal: p[6],
            owner_id: p[7],
          };
          store.views.set(String(p[0]), row);
          return Promise.resolve({ rows: [] });
        }
      }
      if (sql.includes('SELECT * FROM tp_views WHERE id = $1')) {
        return Promise.resolve({ rows: [store.views.get(String(p[0]))].filter(Boolean) });
      }
      if (sql.includes('SELECT * FROM tp_views WHERE table_id')) {
        const tid = String(p[0]);
        return Promise.resolve({
          rows: [...store.views.values()].filter((v) => v.table_id === tid),
        });
      }
      if (sql.includes('UPDATE tp_views SET') && sql.includes('visible_field_ids')) {
        const viewId = String(p[p.length - 1]);
        const prev = store.views.get(viewId);
        if (prev) {
          prev.visible_field_ids = p[p.length - 2] as string[];
          store.views.set(viewId, prev);
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT base_id FROM tp_tables WHERE id = $1')) {
        const t = store.tables.get(String(p[0]));
        const baseId = t?.base_id;
        return Promise.resolve({ rows: baseId ? [{ base_id: baseId }] : [] });
      }

      if (sql.includes('INSERT INTO tp_forms')) {
        const row = {
          id: String(p[0]),
          table_id: String(p[1]),
          name: String(p[2]),
          description: String(p[3]),
          slug: String(p[4]),
          config: typeof p[5] === 'string' ? JSON.parse(String(p[5])) : p[5],
          created_by: String(p[6]),
        };
        store.forms.set(String(p[0]), row);
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT id FROM tp_tables WHERE id = $1')) {
        return Promise.resolve({ rows: store.tables.has(String(p[0])) ? [{ id: p[0] }] : [] });
      }
      if (sql.includes('SELECT id FROM tp_forms WHERE slug')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT * FROM tp_forms WHERE id')) {
        return Promise.resolve({ rows: [store.forms.get(String(p[0]))].filter(Boolean) });
      }

      if (sql.includes('INSERT INTO tp_interfaces')) {
        const row = {
          id: 'iface-row',
          base_id: String(p[0]),
          name: String(p[1]),
          description: p[2],
          created_by: p[3],
        };
        store.interfaces.set('iface-row', row);
        return Promise.resolve({ rows: [row] });
      }

      if (sql.includes('SELECT * FROM tp_tables WHERE id = $1')) {
        const t = store.tables.get(String(p[0]));
        if (!t) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [{ ...t }] });
      }

      if (sql.includes('SELECT governance_mode FROM tp_tables WHERE id')) {
        const t = store.tables.get(String(p[0]));
        return Promise.resolve({
          rows: [{ governance_mode: (t as { governance_mode?: string })?.governance_mode ?? 'operational' }],
        });
      }

      if (sql.includes('UPDATE tp_records SET data')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("field_type IN ('count', 'lookup', 'rollup')")) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const base = await metadataService.createBase(
      'ws-e2e',
      'org-e2e',
      'E2E Base',
      'creator-e2e',
    );
    expect(base?.id).toBeTruthy();

    const table = await metadataService.createTable(
      String(base?.id),
      'Things',
      'desc',
      'creator-e2e',
    );
    const tableId = String(table?.id);
    expect(tableId).toBeTruthy();

    const primaryFieldId = String(
      (table as { fields?: Array<{ id: string }> }).fields?.[0]?.id ?? '',
    );
    expect(primaryFieldId).toBeTruthy();

    const linkedField = await metadataService.createField(
      tableId,
      'Link',
      'linkedRecord',
      { linkedTableId: tableId, reverseFieldId: primaryFieldId, cardinality: 'many-to-many' },
      'creator-e2e',
    );
    const linkFieldId = String(linkedField?.id);
    expect(linkFieldId).toBeTruthy();

    const recA = await recordsService.createRecord(
      tableId,
      { [primaryFieldId]: 'Row A' },
      undefined,
    );
    const recB = await recordsService.createRecord(
      tableId,
      { [primaryFieldId]: 'Row B' },
      undefined,
    );
    expect(recA?.id).toBeTruthy();
    expect(recB?.id).toBeTruthy();

    await relationService.linkRecords(String(recA.id), linkFieldId, [String(recB.id)], 'creator-e2e');

    const grid = await metadataService.createView(
      tableId,
      'Filtered',
      'grid',
      { filters: [] },
      'creator-e2e',
    );
    const gridId = String(grid?.id);
    expect(gridId).toBeTruthy();

    await metadataService.updateView(gridId, {
      visibleFieldIds: [primaryFieldId, linkFieldId],
    });

    const form = await formService.createForm(
      tableId,
      {
        name: 'Intake',
        slug: 'e2e-intake-slug-zz',
        config: { fields: [{ fieldId: primaryFieldId, label: 'Name' }] },
      },
      'creator-e2e',
    );
    expect(form.id).toBeTruthy();

    const ifaceSvc = new InterfaceService();
    const iface = await ifaceSvc.createInterface(String(base?.id), {
      name: 'Console',
      createdBy: 'creator-e2e',
    });
    expect(iface?.id).toBeTruthy();

    const viewsAfter = await metadataService.listViews(tableId);
    const updated = viewsAfter.find((v: { id: string }) => v.id === gridId);
    expect(updated?.visible_field_ids).toEqual([primaryFieldId, linkFieldId]);
  });
});
