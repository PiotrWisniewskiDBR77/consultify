import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentTemplate,
} from '../src/services/documentStudio/documentStudioTypes.js';
import {
  buildReportBuilderDocumentSchema,
  DOC_BASE_TEMPLATE_ID,
} from '../src/services/export/docx/ReportBuilderDocxExportService.js';
import { PDFParse } from 'pdf-parse';

import { exportCanonicalDocumentPdf } from '../src/services/export/pdf/CanonicalPdfExportService.js';

const outputDir = path.resolve('docs/program/EXPORT_1_PDF_20260916/dowody');
await mkdir(outputDir, { recursive: true });

const template: DocumentTemplate = {
  templateId: DOC_BASE_TEMPLATE_ID,
  organizationId: '__system__',
  name: '[System] Client final report (EN)',
  category: 'report',
  documentType: 'client_final_report',
  purpose: 'Final client report',
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

const section = (title: string, generatedContent: string, orderIndex: number) => ({
  id: `section-${orderIndex + 1}`,
  enabled: true,
  orderIndex,
  title,
  generatedContent,
});

const schema = buildReportBuilderDocumentSchema(
  {
    organizationId: 'northwind',
    generatedAt: '2026-09-16T12:00:00.000Z',
    report: {
      id: 'northwind-client-final-report',
      title: 'Northwind transformation report',
      organizationName: 'Northwind Manufacturing Ltd.',
      language: 'en',
      sourceRefs: [
        {
          artifact_id: 'northwind-steering-snapshot',
          artifact_type: 'source_pack',
          artifact_name: 'Northwind steering snapshot',
        },
        {
          artifact_id: 'northwind-decision-log',
          artifact_type: 'decision_log',
          artifact_name: 'Northwind decision log',
        },
      ],
    },
    sections: [
      section(
        'Executive summary',
        '## Key message\nDelivery confidence can recover within four weeks when capacity and blockers are reviewed weekly.\n\n| Measure | Current | Target |\n| --- | --- | --- |\n| OEE | 76.2% | 78.0% |\n| Critical milestones protected | 5 | 7 |',
        0
      ),
      section(
        'Context and scope',
        'The review covers Line 3 delivery, capacity and weekly steering evidence.',
        1
      ),
      section('Methodology', 'Review milestones and validate capacity by person and week.', 2),
      section(
        'Findings by axis',
        'Delivery risk is concentrated in two work cells; three blockers need sponsor decisions.',
        3
      ),
      section(
        'Maturity matrix',
        '| Axis | Current | Target |\n| --- | --- | --- |\n| Delivery governance | 2.8 | 3.5 |\n| Data discipline | 3.1 | 3.8 |',
        4
      ),
      section(
        'Recommendations',
        '- Protect the seven customer milestones.\n- Review capacity constraints every Friday.',
        5
      ),
      section(
        'Roadmap',
        '| Initiative | Owner | Timing |\n| --- | --- | --- |\n| MES Line 3 pilot | COO | Weeks 1–4 |\n| Capacity review | PMO | Weekly |\n| Evidence readback | Quality Lead | Week 2 |',
        6
      ),
      section(
        'Appendix',
        '## Decision log\nThe steering team approved the four-week recovery sequence.\n\n## Sources\nNorthwind steering snapshot and decision log.',
        7
      ),
    ],
  },
  template
);

const result = await exportCanonicalDocumentPdf(schema, 'assessment_drd');
const output = path.join(outputDir, 'northwind-client-final-report.pdf');
await writeFile(output, result.buffer);

const parser = new PDFParse({ data: result.buffer });
const parsed = await parser.getText();
const info = await parser.getInfo();
await parser.destroy();
const sectionTitles = schema.sections.map((section) => section.title);
const missingSections = sectionTitles.filter((title) => !parsed.text.includes(title));
if (missingSections.length > 0) {
  throw new Error(`PDF_PARITY_MISSING_SECTIONS:${missingSections.join(',')}`);
}
if (!parsed.text.includes('Consultify · DBR77 · Northwind Manufacturing Ltd.')) {
  throw new Error('PDF_PARITY_MISSING_COBRANDING');
}
const receipt = {
  output,
  pages: info.total,
  sections: schema.sections.length,
  missingSections,
  ...result.receipt,
};
await writeFile(
  path.join(outputDir, 'receipt.json'),
  `${JSON.stringify(receipt, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(receipt));
