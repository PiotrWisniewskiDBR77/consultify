/**
 * Document Studio — Slice E14.persistence DAO wiring tests.
 *
 * Verifies that the 8 product fields on `DocumentTemplate` survive
 * the in-memory ↔ Postgres round-trip via `documentTemplateRegistryDao`:
 *
 *   - `usageCount`, `lastUsedAt`, `feedbackQualityScore`,
 *     `feedbackSampleSize`, `personaTags`, `regionTags`, `brandTags`,
 *     `dependencyTags`.
 *
 * The actual database layer (`utils/DbPromise`) is mocked so these
 * specs run without a Postgres backend. We assert:
 *   1. `loadTemplatesForOrg` materializes product fields from DB rows
 *      back into the `DocumentTemplate` object shape.
 *   2. `persistTemplate` passes product fields into the SQL parameters
 *      (positional binding survives every column).
 *   3. NULL DB values map to `undefined` on the way out so legacy
 *      pre-migration rows continue to read cleanly.
 *   4. Empty arrays round-trip as empty arrays (`[]` JSONB ↔ `[]`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const dbGetMock = vi.fn();
const dbRunMock = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
  get: (...args: unknown[]) => dbGetMock(...args),
  run: (...args: unknown[]) => dbRunMock(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const { loadTemplatesForOrg, persistTemplate } = await import(
  '../documentTemplateRegistryDao.js'
);

const baseRow = {
  template_id: 'tpl-1',
  organization_id: 'org-1',
  name: 'T',
  category: 'memo',
  document_type: 'executive_memo',
  purpose: 'p',
  audience: '[]',
  language: 'en',
  language_style: 'consulting',
  communication_register: 'professional',
  density: 'standard',
  confidentiality: 'internal',
  required_inputs: '[]',
  section_blueprint: '[]',
  formatting_schema: '{}',
  export_rules: '{}',
  status: 'approved' as const,
  version: '1.0',
  created_by: 'u',
  created_at: '2026-05-09T00:00:00Z',
  updated_at: '2026-05-09T00:00:00Z',
  approved_by: null,
  approved_at: null,
  deprecated_by: null,
  deprecated_at: null,
  notes: null,
  is_system: false,
};

describe('Slice E14.persistence — DAO product field round-trip', () => {
  beforeEach(() => {
    dbAllMock.mockReset();
    dbGetMock.mockReset();
    dbRunMock.mockReset();
    dbRunMock.mockResolvedValue({ success: true, lastID: 1, changes: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadTemplatesForOrg — read path', () => {
    it('materializes the 8 product fields from DB rows', async () => {
      dbAllMock.mockResolvedValue([
        {
          ...baseRow,
          usage_count: 17,
          last_used_at: '2026-05-08T12:00:00Z',
          feedback_quality_score: 4.25,
          feedback_sample_size: 12,
          persona_tags: '["cto","cfo"]',
          region_tags: '["EU","PL"]',
          brand_tags: '["fintech"]',
          dependency_tags: '["requires_financial_data"]',
        },
      ]);
      const [tpl] = await loadTemplatesForOrg('org-1');
      expect(tpl).toBeDefined();
      expect(tpl?.usageCount).toBe(17);
      expect(tpl?.lastUsedAt).toBe('2026-05-08T12:00:00.000Z');
      expect(tpl?.feedbackQualityScore).toBeCloseTo(4.25);
      expect(tpl?.feedbackSampleSize).toBe(12);
      expect(tpl?.personaTags).toEqual(['cto', 'cfo']);
      expect(tpl?.regionTags).toEqual(['EU', 'PL']);
      expect(tpl?.brandTags).toEqual(['fintech']);
      expect(tpl?.dependencyTags).toEqual(['requires_financial_data']);
    });

    it('handles legacy NULL columns (pre-migration rows) gracefully', async () => {
      // Pre-migration rows simply omit the new columns. The DAO must
      // not crash and must surface them as `undefined`.
      dbAllMock.mockResolvedValue([{ ...baseRow }]);
      const [tpl] = await loadTemplatesForOrg('org-1');
      expect(tpl?.usageCount).toBeUndefined();
      expect(tpl?.lastUsedAt).toBeUndefined();
      expect(tpl?.feedbackQualityScore).toBeUndefined();
      expect(tpl?.feedbackSampleSize).toBeUndefined();
      expect(tpl?.personaTags).toEqual([]);
      expect(tpl?.regionTags).toEqual([]);
      expect(tpl?.brandTags).toEqual([]);
      expect(tpl?.dependencyTags).toEqual([]);
    });

    it('parses JSONB tag arrays returned as native arrays (skip JSON.parse path)', async () => {
      dbAllMock.mockResolvedValue([
        {
          ...baseRow,
          persona_tags: ['cto'],
          region_tags: ['EU'],
          brand_tags: ['fintech'],
          dependency_tags: [],
        },
      ]);
      const [tpl] = await loadTemplatesForOrg('org-1');
      expect(tpl?.personaTags).toEqual(['cto']);
      expect(tpl?.regionTags).toEqual(['EU']);
      expect(tpl?.brandTags).toEqual(['fintech']);
      expect(tpl?.dependencyTags).toEqual([]);
    });
  });

  describe('persistTemplate — write path', () => {
    it('binds the 8 product fields as the trailing positional parameters', async () => {
      const payload = {
        templateId: 'tpl-2',
        organizationId: 'org-2',
        name: 'T2',
        category: 'memo',
        documentType: 'executive_memo',
        purpose: 'p',
        audience: ['Board'],
        language: 'en' as const,
        languageStyle: 'consulting',
        communicationRegister: 'executive',
        density: 'standard',
        confidentiality: 'internal',
        requiredInputs: [],
        sectionBlueprint: [],
        formattingSchema: {},
        exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
        status: 'approved',
        version: '1.0',
        createdBy: 'u',
        createdAt: '2026-05-09T00:00:00Z',
        updatedAt: '2026-05-09T00:00:00Z',
        usageCount: 5,
        lastUsedAt: '2026-05-08T12:00:00Z',
        feedbackQualityScore: 4.5,
        feedbackSampleSize: 10,
        personaTags: ['cto'],
        regionTags: ['EU'],
        brandTags: ['fintech'],
        dependencyTags: ['requires_financial_data'],
      };
      const result = await persistTemplate(payload as never);
      expect(result.ok).toBe(true);
      expect(dbRunMock).toHaveBeenCalledTimes(1);
      const params = dbRunMock.mock.calls[0]?.[1] as unknown[];
      expect(params).toBeDefined();
      // The 8 product fields are the trailing positional params after
      // the 27 legacy ones. We assert positional indices to lock the
      // column order against accidental SQL reordering.
      expect(params[27]).toBe(5); // usage_count
      expect(params[28]).toBe('2026-05-08T12:00:00Z'); // last_used_at
      expect(params[29]).toBe(4.5); // feedback_quality_score
      expect(params[30]).toBe(10); // feedback_sample_size
      expect(params[31]).toBe(JSON.stringify(['cto']));
      expect(params[32]).toBe(JSON.stringify(['EU']));
      expect(params[33]).toBe(JSON.stringify(['fintech']));
      expect(params[34]).toBe(JSON.stringify(['requires_financial_data']));
    });

    it('passes NULL for undefined product fields (legacy templates persist cleanly)', async () => {
      const payload = {
        templateId: 'tpl-3',
        organizationId: 'org-3',
        name: 'T3',
        category: 'memo',
        documentType: 'executive_memo',
        purpose: 'p',
        audience: [],
        language: 'en' as const,
        languageStyle: 'consulting',
        communicationRegister: 'executive',
        density: 'standard',
        confidentiality: 'internal',
        requiredInputs: [],
        sectionBlueprint: [],
        formattingSchema: {},
        exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
        status: 'approved',
        version: '1.0',
        createdBy: 'u',
        createdAt: '2026-05-09T00:00:00Z',
        updatedAt: '2026-05-09T00:00:00Z',
      };
      await persistTemplate(payload as never);
      const params = dbRunMock.mock.calls[0]?.[1] as unknown[];
      expect(params[27]).toBeNull();
      expect(params[28]).toBeNull();
      expect(params[29]).toBeNull();
      expect(params[30]).toBeNull();
      expect(params[31]).toBe('[]');
      expect(params[32]).toBe('[]');
      expect(params[33]).toBe('[]');
      expect(params[34]).toBe('[]');
    });
  });
});
