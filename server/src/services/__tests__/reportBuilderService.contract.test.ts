/**
 * Contract tests for reportBuilderService (3139 lines)
 *
 * Uses the service's setDependencies() to inject a mock DB.
 * Tests verify the public API contract:
 *   - Report definition & creation
 *   - Section management
 *   - Status transitions
 *   - Template CRUD
 *   - Version management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBlockType,
  createReport,
  listBlockTypes,
  setDependencies,
} from '../reportBuilderService.js';

type DbCallback<T> = (err: Error | null, result: T) => void;

function createMockDb() {
  const state: Record<string, unknown[]> = {};
  return {
    all: vi.fn((_sql: string, _params: unknown[], cb: DbCallback<unknown[]>) => {
      cb(null, []);
    }),
    get: vi.fn((_sql: string, _params: unknown[], cb: DbCallback<unknown>) => {
      cb(null, null);
    }),
    run: vi.fn(function (
      this: { lastID?: number; changes?: number },
      _sql: string,
      _params: unknown[],
      cb: DbCallback<void>
    ) {
      cb.call({ lastID: 1, changes: 1 }, null, undefined as any);
    }),
    _state: state,
  };
}

describe('reportBuilderService — contract tests', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    setDependencies({ db: mockDb as any });
  });

  describe('createReport', () => {
    it('creates a report with a supplied templateId', async () => {
      const templateRow = {
        id: 'tpl-1',
        name: 'Default',
        source_type: 'MANUAL',
        report_type: null,
        sections_json: JSON.stringify([
          { key: 'intro', title: 'Introduction', contentType: 'text' },
        ]),
        is_active: 1,
      };

      mockDb.get.mockImplementation((_sql: string, _params: unknown[], cb: DbCallback<unknown>) => {
        if (String(_sql).includes('report_builder_templates')) {
          cb(null, templateRow);
        } else {
          cb(null, null);
        }
      });
      mockDb.all.mockImplementation(
        (_sql: string, _params: unknown[], cb: DbCallback<unknown[]>) => {
          cb(null, []);
        }
      );
      mockDb.run.mockImplementation(function (
        this: any,
        _sql: string,
        _params: unknown[],
        cb: any
      ) {
        if (typeof cb === 'function') cb.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await createReport({
        organizationId: 'org-1',
        createdBy: 'user-1',
        sourceType: 'MANUAL',
        sourceId: 'src-1',
        title: 'Test Report',
        templateId: 'tpl-1',
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('report');
      expect(result).toHaveProperty('sections');
      expect(result.report.title).toBe('Test Report');
    });

    // R1 Library „Użyj wzorca" (raport, 2026-07-26) — PRODUCTION entry point
    // proof: `POST /report-builder` (the route both `NewAssessmentReportModal`
    // and the new Library create flow call) with a `templateId` that came from
    // `POST /report-builder/templates/resolve` (canonical id, NOT the
    // Library's index id) must produce a report whose sections come FROM the
    // template's `sections_json` — not an empty/no-template draft. This is the
    // exact bug the audit found downstream of `/wordy`: a template silently
    // never being applied. Asserting only "has a sections array" (as the test
    // above does) would pass even if sections were empty; this test pins the
    // actual content.
    it('creates report sections FAITHFULLY from the resolved template sections_json (R1 Library "Użyj wzorca")', async () => {
      const templateRow = {
        id: 'rbt-canonical-42',
        name: 'DRD Assessment Report',
        source_type: 'ASSESSMENT',
        report_type: 'ASSESSMENT_DRD',
        sections_json: JSON.stringify([
          {
            key: 'exec_summary',
            type: 'narrative',
            title: 'Podsumowanie zarządcze',
            required: true,
            order: 0,
          },
          { key: 'findings', type: 'narrative', title: 'Ustalenia', required: true, order: 1 },
        ]),
        is_active: 1,
      };

      const approvedAssessmentRow = {
        id: 'assessment-1',
        name: 'DRD Assessment — Acme Corp',
        assessment_type: 'DRD',
        status: 'APPROVED',
        organization_id: 'org-1',
        answers_json: '{}',
        score_summary: '{}',
        context_snapshot: '{}',
        approved_at: '2026-07-20T00:00:00.000Z',
        created_by: 'user-1',
      };

      mockDb.get.mockImplementation((_sql: string, _params: unknown[], cb: DbCallback<unknown>) => {
        if (String(_sql).includes('report_builder_templates')) {
          cb(null, templateRow);
        } else if (String(_sql).includes('FROM assessments')) {
          cb(null, approvedAssessmentRow);
        } else {
          cb(null, null);
        }
      });
      mockDb.all.mockImplementation(
        (_sql: string, _params: unknown[], cb: DbCallback<unknown[]>) => {
          cb(null, []);
        }
      );
      mockDb.run.mockImplementation(function (
        this: any,
        _sql: string,
        _params: unknown[],
        cb: any
      ) {
        if (typeof cb === 'function') cb.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await createReport({
        organizationId: 'org-1',
        createdBy: 'user-1',
        sourceType: 'ASSESSMENT',
        sourceId: 'assessment-1',
        title: 'Report from Library template',
        // A canonical id, as returned by `resolveDocumentTemplateForCreation`
        // via `POST /report-builder/templates/resolve` — never the Library's
        // artifact-index id.
        templateId: 'rbt-canonical-42',
      });

      expect(result.report.templateId).toBe('rbt-canonical-42');
      expect(result.sections).toHaveLength(2);
      expect(result.sections.map((s) => s.sectionKey)).toEqual(['exec_summary', 'findings']);
      expect(result.sections.map((s) => s.title)).toEqual(['Podsumowanie zarządcze', 'Ustalenia']);
      expect(result.sections.every((s) => s.required === true)).toBe(true);
    });
  });

  describe('listBlockTypes', () => {
    it('returns an array of block types', async () => {
      mockDb.all.mockImplementation(
        (_sql: string, _params: unknown[], cb: DbCallback<unknown[]>) => {
          cb(null, [
            { id: 'bt-1', name: 'Text', category: 'basic', is_active: 1 },
            { id: 'bt-2', name: 'Chart', category: 'visual', is_active: 1 },
          ]);
        }
      );

      const result = await listBlockTypes('org-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
    });
  });

  describe('createBlockType', () => {
    it('creates a block type and returns it', async () => {
      const blockData = {
        organizationId: 'org-1',
        name: 'Custom Table',
        category: 'data',
        schema: { columns: ['A', 'B'] },
        defaultConfig: {},
      };

      mockDb.get.mockImplementation((_sql: string, _params: unknown[], cb: DbCallback<unknown>) => {
        cb(null, null);
      });
      mockDb.run.mockImplementation(function (
        this: any,
        _sql: string,
        _params: unknown[],
        cb: any
      ) {
        if (typeof cb === 'function') cb.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await createBlockType(blockData);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Custom Table');
    });
  });
});
