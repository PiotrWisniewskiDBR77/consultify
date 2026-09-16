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
} from '../ReportBuilderDocxExportService.js';

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

describe('ReportBuilderDocxExportService', () => {
  it('projects Report Builder content onto approved DOC-BASE and the canonical renderer', async () => {
    const schema = buildReportBuilderDocumentSchema(
      {
        organizationId: 'northwind',
        generatedAt: '2026-09-16T12:00:00.000Z',
        report: {
          id: 'report-1',
          title: 'Northwind transformation report',
          organizationName: 'Northwind Manufacturing Ltd.',
          language: 'en',
          sourceRefs: [
            {
              artifact_id: 'source-pack-1',
              artifact_type: 'source_pack',
              artifact_name: 'Northwind steering pack',
            },
          ],
        },
        sections: [
          {
            id: 'summary',
            enabled: true,
            orderIndex: 0,
            title: 'Executive summary',
            generatedContent:
              '## Key message\nRecovery is measurable.\n\n- Protect milestones\n- Name owners',
          },
          {
            id: 'roadmap',
            enabled: true,
            orderIndex: 1,
            title: 'Roadmap',
            sourceRefs: [
              {
                artifact_id: 'decision-log-1',
                artifact_type: 'decision_log',
                artifact_name: 'Decision log',
              },
            ],
            generatedContent: '| Initiative | Owner |\n| --- | --- |\n| MES pilot | COO |',
          },
        ],
      },
      template
    );

    expect(schema.templateRef).toEqual({
      templateId: DOC_BASE_TEMPLATE_ID,
      templateVersion: '1.0',
    });
    expect(schema.formattingSchema.page.marginsCm).toEqual({
      top: 2,
      bottom: 2,
      left: 2.3,
      right: 2.3,
    });
    expect(schema.formattingSchema.footers.content).toContain('Consultify · DBR77 · Northwind');
    expect(schema.sections[0].blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bullet_list',
    ]);
    expect(schema.sections[1].blocks[0]).toMatchObject({
      type: 'table',
      content: { headers: ['Initiative', 'Owner'], rows: [['MES pilot', 'COO']] },
    });
    expect(schema.sourceRefs).toEqual([
      {
        sourceType: 'source_pack',
        sourceId: 'source-pack-1',
        sourceTitle: 'Northwind steering pack',
      },
      {
        sourceType: 'decision_log',
        sourceId: 'decision-log-1',
        sourceTitle: 'Decision log',
      },
    ]);

    const zip = await JSZip.loadAsync(
      await applyDocBaseThemeContract(await renderDocumentSchemaToDocxBuffer(schema))
    );
    const [documentXml, stylesXml, fontTableXml, themeXml] = await Promise.all([
      zip.file('word/document.xml')!.async('string'),
      zip.file('word/styles.xml')!.async('string'),
      zip.file('word/fontTable.xml')!.async('string'),
      zip.file('word/theme/theme1.xml')!.async('string'),
    ]);
    expect(documentXml).toContain('Northwind transformation report');
    expect(documentXml).toContain('MES pilot');
    expect(documentXml).toContain('w:tbl');
    expect(documentXml).toContain('Table of Contents');
    expect(documentXml).toContain('w:br w:type="page"');
    expect(documentXml).toContain('w:titlePg');
    expect(documentXml).toContain('w:headerReference w:type="first"');
    expect(documentXml).toContain('w:footerReference w:type="first"');
    expect(documentXml).toContain('Northwind steering pack');
    expect(stylesXml).toContain('Aptos');
    expect(stylesXml).toContain('minorHAnsi');
    expect(fontTableXml).toContain('w:altName w:val="Arial"');
    expect(themeXml).toContain('typeface="Aptos"');
  });

  it('fails closed when the supplied DOC-BASE template is not approved', () => {
    expect(() =>
      buildReportBuilderDocumentSchema(
        { organizationId: 'northwind', report: {}, sections: [] },
        { ...template, status: 'draft' }
      )
    ).toThrow('DOC_BASE_E_STATUS');
  });
});
