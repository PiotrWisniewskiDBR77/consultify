import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import { buildAuditReportDocumentSchema } from '../auditReportDocumentSchemaService.js';
import type { AuditReportDocument, ReportSectionKind } from '../reportRenderer.js';

const kinds: ReportSectionKind[] = [
  'text',
  'keyValue',
  'text',
  'list',
  'text',
  'group',
  'group',
  'table',
  'list',
  'table',
  'table',
  'group',
  'table',
];
const ids = [
  'executive_summary',
  'scope',
  'methodology',
  'limitations',
  'overall_conclusion',
  'findings_by_severity',
  'findings_by_area',
  'objective_evidence_references',
  'systemic_conclusions',
  'corrective_action_plan',
  'verification_plan',
  'appendices',
  'traceability_matrix',
];

function content(kind: ReportSectionKind): unknown {
  if (kind === 'text') return 'Treść raportu';
  if (kind === 'list') return ['Pozycja'];
  if (kind === 'keyValue') return { program: 'Program A' };
  if (kind === 'group') return { Grupa: ['Wartość'] };
  return [{ findingId: 'afnd_1', evidenceTitles: ['Dowód'] }];
}

const document: AuditReportDocument = {
  reportKind: 'audit_report',
  generatedAt: '2026-08-28T10:00:00.000Z',
  sections: ids.map((id, index) => ({
    id,
    title: `Sekcja ${index + 1}`,
    kind: kinds[index]!,
    content: content(kinds[index]!),
  })),
};

const report = {
  id: 'arep_1',
  title: 'Raport audytu',
  version: 2,
  reportKind: 'audit_report',
  language: 'pl',
  audience: 'Zarząd',
  confidentiality: null,
  contentHash: 'abc123',
  generatedAt: '2026-08-28T10:00:00.000Z',
};
const context = { programName: 'Program A', organizationName: 'Organizacja A' };

describe('audit report DocumentSchema adapter', () => {
  it('keeps all 13 sections in payload order', () => {
    expect(
      buildAuditReportDocumentSchema(report, document, context).sections.map(
        (section) => section.sectionId
      )
    ).toEqual(ids);
  });

  it.each(['paragraph', 'bullet_list', 'table'] as const)(
    'maps content to a supported %s block',
    (type) => {
      expect(
        buildAuditReportDocumentSchema(report, document, context)
          .sections.flatMap((section) => section.blocks)
          .some((block) => block.type === type)
      ).toBe(true);
    }
  );

  it('is deterministic', () => {
    expect(buildAuditReportDocumentSchema(report, document, context)).toEqual(
      buildAuditReportDocumentSchema(report, document, context)
    );
  });

  it('uses a named placeholder for empty content', () => {
    const empty = {
      ...document,
      sections: [{ id: 'empty', title: 'Pusta sekcja', kind: 'list' as const, content: [] }],
    };
    expect(JSON.stringify(buildAuditReportDocumentSchema(report, empty, context))).toContain(
      '[Brak danych: Pusta sekcja]'
    );
  });

  it('puts report version and hash in footer metadata', () => {
    const schema = buildAuditReportDocumentSchema(report, document, context);
    expect(JSON.stringify(schema.formattingSchema.footers)).toContain('v2');
    expect(JSON.stringify(schema.formattingSchema.footers)).toContain('abc123');
  });

  it('maps a remediation progress payload', () => {
    const remediation = {
      ...document,
      reportKind: 'remediation_progress' as const,
      sections: document.sections.slice(0, 6),
    };
    expect(
      buildAuditReportDocumentSchema(
        { ...report, reportKind: 'remediation_progress' },
        remediation,
        context
      ).sections
    ).toHaveLength(6);
  });

  it('uses the supplied generated timestamp without reading the clock', () => {
    expect(buildAuditReportDocumentSchema(report, document, context).createdAt).toBe(
      report.generatedAt
    );
  });

  it('renders through the existing DOCX engine to a non-empty buffer', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(
      buildAuditReportDocumentSchema(report, document, context)
    );
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
