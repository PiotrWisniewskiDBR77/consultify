/** @vitest-environment node */

/**
 * D-47 — the client-final cover of a Report Builder DOCX names the organization
 * the report belongs to.
 *
 * WHY THIS SUITE EXISTS: the cover carried three pieces of scaffolding into a
 * client deliverable — a hardcoded `Consultify · DBR77` brand line and
 * `PREPARED BY` value (a consultancy from another tenant on the client's own
 * document), the literal `Client` wherever the tenant name was missing, the
 * authoring placeholder `[ CLIENT LOGO ]`, and a raw tool-session uuid in
 * `SOURCE`. These assertions run on the real bytes of the rendered DOCX, not on
 * a mirror of the schema, so a hardcoded literal coming back turns them RED.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../../documentStudio/documentDocxRenderer.js';
import {
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentTemplate,
} from '../../../documentStudio/documentStudioTypes.js';
import { applyDocBaseThemeContract } from '../docBaseThemePostprocessor.js';
import {
  buildReportBuilderDocumentSchema,
  DOC_BASE_TEMPLATE_ID,
  type ReportBuilderDocxInput,
} from '../ReportBuilderDocxExportService.js';

const ORG_ID = 'northwind';
const ORG_NAME = 'Northwind Manufacturing Ltd.';
const SESSION_UUID = 'f9df8e14-2f1b-4c56-9a2a-7b0d3c1e5f60';

const template: DocumentTemplate = {
  templateId: DOC_BASE_TEMPLATE_ID,
  organizationId: '__system__',
  name: '[System] Client final report (EN)',
  category: 'report',
  documentType: 'client_final_report',
  purpose: 'Client final report',
  audience: ['Client Sponsor', 'Executive Team'],
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

function input(overrides: Partial<ReportBuilderDocxInput> = {}): ReportBuilderDocxInput {
  return {
    organizationId: ORG_ID,
    generatedAt: '2026-09-16T12:00:00.000Z',
    report: {
      id: 'report-1',
      title: 'Operational maturity review',
      language: 'en',
      sourceRefs: [
        {
          artifact_id: SESSION_UUID,
          artifact_type: 'tool_session',
          artifact_name: 'Tool session',
        },
      ],
    },
    sections: [
      {
        id: 'summary',
        enabled: true,
        orderIndex: 0,
        title: 'Executive summary',
        generatedContent: 'Recovery is measurable.',
      },
    ],
    ...overrides,
  };
}

async function render(
  docInput: ReportBuilderDocxInput,
  options?: Parameters<typeof renderDocumentSchemaToDocxBuffer>[1]
): Promise<{ documentXml: string; headerXml: string[]; media: string[] }> {
  const schema = buildReportBuilderDocumentSchema(docInput, template);
  const buffer = await applyDocBaseThemeContract(
    await renderDocumentSchemaToDocxBuffer(schema, options)
  );
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const headerXml = await Promise.all(
    Object.keys(zip.files)
      .filter((name) => /^word\/header\d*\.xml$/.test(name))
      .map((name) => zip.file(name)!.async('string'))
  );
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  return { documentXml, headerXml, media };
}

describe('D-47 client-final cover — organization from the report context', () => {
  it('★ names the tenant on the cover instead of the hardcoded consultancy brand', async () => {
    const { documentXml } = await render(input({ organizationName: ORG_NAME }));

    expect(documentXml).not.toContain('Consultify · DBR77');
    // Brand line above the logo + the PREPARED BY metadata cell.
    expect(documentXml.split(ORG_NAME).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('★ stops calling the client "Client" when the tenant name reaches the export', async () => {
    const { documentXml, headerXml } = await render(input({ organizationName: ORG_NAME }));

    expect(documentXml).not.toContain('>Client<');
    expect(headerXml.join('\n')).toContain(ORG_NAME);
    expect(headerXml.join('\n')).not.toContain('· Client');
  });

  it('keeps the name stored on the report itself as the stronger source', async () => {
    const reportInput = input({ organizationName: 'Some Other Tenant' });
    reportInput.report = { ...reportInput.report, organizationName: ORG_NAME };

    const { documentXml } = await render(reportInput);

    expect(documentXml).toContain(ORG_NAME);
    expect(documentXml).not.toContain('Some Other Tenant');
  });

  it('★ prints no tool-session uuid in the cover SOURCE field', async () => {
    const { documentXml } = await render(input({ organizationName: ORG_NAME }));
    // The trailing "Sources & traceability" citation list keeps source ids by
    // design; D-47 is about the cover metadata row a client reads first.
    const cover = documentXml.split('Table of Contents')[0];

    expect(cover).toContain('>Tool session<');
    expect(cover).not.toContain(SESSION_UUID);
  });

  it('leaves no "[ CLIENT LOGO ]" scaffolding on the deliverable when the tenant has no logo', async () => {
    const { documentXml, media } = await render(input({ organizationName: ORG_NAME }), {
      coverLogoPlaceholder: false,
    });

    expect(documentXml).not.toContain('CLIENT LOGO');
    expect(media).toHaveLength(0);
  });

  it('keeps the placeholder box for the default render path (Document Studio drafts)', async () => {
    const { documentXml } = await render(input({ organizationName: ORG_NAME }));

    expect(documentXml).toContain('CLIENT LOGO');
  });

  it('embeds the tenant logo when the asset bytes reach the renderer', async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa,
      0xcf, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const { documentXml, media } = await render(input({ organizationName: ORG_NAME }), {
      coverLogoAsset: { mimeType: 'image/png', dataBase64: png.toString('base64') },
      coverLogoPlaceholder: false,
    });

    expect(media.length).toBeGreaterThan(0);
    expect(documentXml).toContain('w:drawing');
    expect(documentXml).not.toContain('CLIENT LOGO');
  });
});
