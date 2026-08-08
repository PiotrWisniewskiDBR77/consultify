/**
 * Document Studio — System Template Seeder (Epic E1, Slice 1.3).
 *
 * Verifies:
 *   1. The seed catalogue covers all 22 `DocumentTypeKey` values.
 *   2. PL + EN copies are produced for every catalogue entry → 44 rows.
 *   3. `seedSystemDocumentTemplates` is idempotent (running twice does
 *      not double-write).
 *   4. Seeded templates carry `status = 'approved'`, `is_system = true`
 *      flag at the DAO layer, `organizationId = SYSTEM_ORG_ID`, and a
 *      deterministic `templateId` shape.
 *   5. Each seeded template has a non-empty section blueprint, derived
 *      from `documentNarrativePlanner` so the catalogue stays in lock-
 *      step with live Mode 1 / Mode 3 generation.
 *
 * The DAO is mocked at the module boundary so the test runs without a
 * live Postgres backing store.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface PersistedRecord {
  template: Record<string, unknown>;
  options?: { isSystem?: boolean };
}

const persistTemplateMock = vi.fn(async (template: unknown, options?: { isSystem?: boolean }) => {
  const stored: PersistedRecord = { template: template as Record<string, unknown>, options };
  persistTemplateMock.records.push(stored);
  return { ok: true };
}) as unknown as ReturnType<typeof vi.fn> & { records: PersistedRecord[] };
persistTemplateMock.records = [];

const loadTemplatesForOrgMock = vi.fn(async (_orgId: string) => {
  return persistTemplateMock.records.map((r) => r.template) as unknown as never[];
});

vi.mock('../documentTemplateRegistryDao.js', () => ({
  SYSTEM_ORG_ID: '__system__',
  persistTemplate: (template: unknown, options?: { isSystem?: boolean }) =>
    persistTemplateMock(template, options),
  persistAuditEntry: vi.fn(async () => ({ ok: true })),
  loadTemplatesForOrg: (orgId: string) => loadTemplatesForOrgMock(orgId),
  loadAuditForTemplate: vi.fn(async () => []),
  __resetTemplateRegistryDaoForTests: async () => undefined,
}));

const { __resetSystemTemplateSeederForTests, getSystemSeedCatalogue, seedSystemDocumentTemplates } =
  await import('../documentTemplateSeeder.js');

describe('documentTemplateSeeder — system catalogue', () => {
  beforeEach(() => {
    persistTemplateMock.records.length = 0;
    persistTemplateMock.mockClear();
    loadTemplatesForOrgMock.mockClear();
    __resetSystemTemplateSeederForTests();
  });

  it('catalogue covers exactly 22 distinct DocumentTypeKey values', () => {
    const catalogue = getSystemSeedCatalogue();
    expect(catalogue).toHaveLength(22);
    const types = new Set(catalogue.map((c) => c.documentType));
    expect(types.size).toBe(22);
  });

  it('every spec carries non-empty PL + EN purpose, audience and at least one required input', () => {
    const catalogue = getSystemSeedCatalogue();
    for (const spec of catalogue) {
      expect(spec.purposeEn.length).toBeGreaterThan(10);
      expect(spec.purposePl.length).toBeGreaterThan(10);
      expect(spec.audienceEn.length).toBeGreaterThan(0);
      expect(spec.audiencePl.length).toBeGreaterThan(0);
      expect(spec.requiredInputs.length).toBeGreaterThan(0);
    }
  });

  it('seedSystemDocumentTemplates persists 22 × 2 = 44 templates on first call', async () => {
    const summary = await seedSystemDocumentTemplates();
    expect(summary.total).toBe(44);
    expect(summary.inserted).toBe(44);
    expect(summary.skipped).toBe(0);
    expect(persistTemplateMock).toHaveBeenCalledTimes(44);
  });

  it('seeded templates are tenanted under SYSTEM_ORG_ID, approved, and is_system = true', async () => {
    await seedSystemDocumentTemplates();
    for (const record of persistTemplateMock.records) {
      expect(record.template.organizationId).toBe('__system__');
      expect(record.template.status).toBe('approved');
      expect(record.template.createdBy).toBe('system');
      expect(record.template.approvedBy).toBe('system');
      expect(record.options?.isSystem).toBe(true);
    }
  });

  it('every seeded template has a deterministic templateId and a non-empty section blueprint', async () => {
    await seedSystemDocumentTemplates();
    const idPattern = /^doc-template-system-(pl|en)-[a-z_]+$/;
    for (const record of persistTemplateMock.records) {
      const id = record.template.templateId as string;
      const blueprint = record.template.sectionBlueprint as Array<unknown>;
      expect(id).toMatch(idPattern);
      expect(Array.isArray(blueprint)).toBe(true);
      expect(blueprint.length).toBeGreaterThan(0);
    }
    const ids = persistTemplateMock.records.map((r) => r.template.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('PL and EN renditions are produced for every documentType', async () => {
    await seedSystemDocumentTemplates();
    const byLang: Record<string, Set<string>> = { pl: new Set(), en: new Set() };
    for (const record of persistTemplateMock.records) {
      const lang = record.template.language as 'pl' | 'en';
      byLang[lang]?.add(record.template.documentType as string);
    }
    expect(byLang.pl.size).toBe(22);
    expect(byLang.en.size).toBe(22);
    expect(byLang.pl).toEqual(byLang.en);
  });

  it('gives board-grade templates a rich visual and evidence contract', async () => {
    await seedSystemDocumentTemplates();
    for (const type of ['business_case', 'board_report', 'project_status_report']) {
      const template = persistTemplateMock.records.find(
        (r) => r.template.documentType === type && r.template.language === 'en'
      )?.template as any;
      expect(template).toBeTruthy();
      expect(template.formattingSchema.coverPageDetailed).toMatchObject({
        enabled: true,
        includeLogo: true,
        includeConfidentiality: true,
      });
      expect(template.formattingSchema.tocConfig).toEqual({ enabled: true, maxDepth: 2 });
      const richSections = template.sectionBlueprint.filter(
        (section: any) => section.formattingStyle && section.requiredData?.length
      );
      expect(richSections.length).toBeGreaterThanOrEqual(2);
      expect(richSections.some((section: any) => /kpi/i.test(section.formattingStyle))).toBe(true);
    }
  });

  it('seedSystemDocumentTemplates is idempotent across consecutive calls in the same process', async () => {
    await seedSystemDocumentTemplates();
    persistTemplateMock.mockClear();
    const second = await seedSystemDocumentTemplates();
    // Re-entrancy guard short-circuits — no extra writes.
    expect(persistTemplateMock).toHaveBeenCalledTimes(0);
    expect(second.inserted).toBe(0);
  });

  it('after the seeder fully populates the DAO, a fresh process sees zero new inserts', async () => {
    await seedSystemDocumentTemplates();
    __resetSystemTemplateSeederForTests();
    persistTemplateMock.mockClear();

    const summary = await seedSystemDocumentTemplates();
    expect(summary.skipped).toBe(44);
    expect(summary.inserted).toBe(0);
    expect(persistTemplateMock).toHaveBeenCalledTimes(0);
  });
});
