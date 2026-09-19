/** @vitest-environment node */

/**
 * D-47 — `exportReportBuilderDocx` hydrates the tenant logo and tells the
 * renderer that a client deliverable carries no authoring scaffolding.
 *
 * WHY THIS SUITE EXISTS: the cover used to print a bordered `[ CLIENT LOGO ]`
 * box on every exported report because nothing ever asked the asset registry for
 * the tenant's logo. This asserts the wiring on the real exported bytes: the
 * registry is queried with the report's own organization, the logo lands in
 * `word/media/` when one exists, and the placeholder is gone either way.
 */

import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetActiveOrgLogo = vi.fn();
const mockGetTemplate = vi.fn();

vi.mock('../../../documentStudio/documentAssetRegistryService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, getActiveOrgLogo: (...a: unknown[]) => mockGetActiveOrgLogo(...a) };
});

vi.mock('../../../documentStudio/documentTemplateService.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    ensureTemplateRegistryHydrated: async () => undefined,
    getTemplate: (...a: unknown[]) => mockGetTemplate(...a),
  };
});

import {
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentTemplate,
} from '../../../documentStudio/documentStudioTypes.js';
import { DOC_BASE_TEMPLATE_ID, exportReportBuilderDocx } from '../ReportBuilderDocxExportService.js';

const ORG_ID = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const ORG_NAME = 'Northwind Manufacturing Ltd.';

const template: DocumentTemplate = {
  templateId: DOC_BASE_TEMPLATE_ID,
  organizationId: '__system__',
  name: '[System] Client final report (EN)',
  category: 'report',
  documentType: 'client_final_report',
  purpose: 'Client final report',
  audience: ['Client Sponsor'],
  language: 'en',
  languageStyle: 'consulting',
  communicationRegister: 'executive',
  density: 'comprehensive',
  confidentiality: 'client_confidential',
  requiredInputs: [],
  sectionBlueprint: [],
  formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: true },
  status: 'approved',
  version: '1.0',
  createdBy: 'system',
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

// Smallest well-formed 1×1 PNG.
const PNG_BASE64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]).toString('base64');

function exportInput() {
  return {
    organizationId: ORG_ID,
    organizationName: ORG_NAME,
    generatedAt: '2026-09-16T12:00:00.000Z',
    report: { id: 'report-1', title: 'Operational maturity review', language: 'en' },
    sections: [
      {
        id: 'summary',
        enabled: true,
        orderIndex: 0,
        title: 'Executive summary',
        generatedContent: 'Recovery is measurable.',
      },
    ],
  };
}

async function unzip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return {
    documentXml: await zip.file('word/document.xml')!.async('string'),
    media: Object.keys(zip.files).filter((name) => name.startsWith('word/media/')),
  };
}

describe('exportReportBuilderDocx — cover logo hydration (D-47)', () => {
  beforeEach(() => {
    mockGetActiveOrgLogo.mockReset();
    mockGetTemplate.mockReset();
    mockGetTemplate.mockReturnValue(template);
  });

  it('★ asks the asset registry for the report organization and embeds its logo', async () => {
    mockGetActiveOrgLogo.mockReturnValue({
      assetId: 'asset-1',
      organizationId: ORG_ID,
      kind: 'logo',
      status: 'active',
      mimeType: 'image/png',
      dataBase64: PNG_BASE64,
      byteLength: 68,
      createdBy: 'user-1',
      createdAt: '2026-09-16T00:00:00.000Z',
    });

    const { documentXml, media } = await unzip(await exportReportBuilderDocx(exportInput()));

    expect(mockGetActiveOrgLogo).toHaveBeenCalledWith(ORG_ID);
    expect(media.length).toBeGreaterThan(0);
    expect(documentXml).toContain('w:drawing');
    expect(documentXml).not.toContain('CLIENT LOGO');
  });

  it('★ renders no placeholder box when the tenant has no logo', async () => {
    mockGetActiveOrgLogo.mockReturnValue(null);

    const { documentXml, media } = await unzip(await exportReportBuilderDocx(exportInput()));

    expect(mockGetActiveOrgLogo).toHaveBeenCalledWith(ORG_ID);
    expect(media).toHaveLength(0);
    expect(documentXml).not.toContain('CLIENT LOGO');
  });

  it('names the tenant on the cover of the exported document', async () => {
    mockGetActiveOrgLogo.mockReturnValue(null);

    const { documentXml } = await unzip(await exportReportBuilderDocx(exportInput()));

    expect(documentXml).toContain(ORG_NAME);
    expect(documentXml).not.toContain('Consultify · DBR77');
  });
});
