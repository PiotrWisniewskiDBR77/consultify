import type {
  DocumentBlock,
  DocumentConfidentiality,
  DocumentSchema,
} from '../documentStudio/documentStudioTypes.js';
import type { AuditReportDocument, ReportSection } from './reportRenderer.js';

export const AUDIT_REPORT_DOCUMENT_PLACEHOLDERS = Object.freeze({
  missing: (field: string) => `[Brak danych: ${field}]`,
});

const TABLE_COLUMNS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  objective_evidence_references: ['findingId', 'evidenceIds', 'evidenceTitles'],
  corrective_action_plan: [
    'id',
    'findingId',
    'actionKind',
    'title',
    'ownerUserId',
    'dueDate',
    'status',
  ],
  verification_plan: [
    'id',
    'correctiveActionId',
    'findingId',
    'verificationKind',
    'method',
    'plannedDate',
    'performedAt',
    'result',
  ],
  traceability_matrix: [
    'criterionRef',
    'criterionTitle',
    'evidenceTitles',
    'testPerformed',
    'testResult',
    'auditorConclusion',
    'findingStatement',
    'actionTitles',
    'verificationResults',
  ],
});

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(display).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return /^(usr|aout|arep|afnd|acrit|aev|aca|avp)_/i.test(text) ? `«ID: ${text}»` : text;
}

function heading(id: string, text: string, level: 1 | 2 | 3): DocumentBlock {
  return { blockId: id, type: 'heading', content: { text, level } };
}

function paragraph(id: string, text: string): DocumentBlock {
  return { blockId: id, type: 'paragraph', content: { text } };
}

function table(id: string, headers: string[], rows: unknown[][]): DocumentBlock {
  return { blockId: id, type: 'table', content: { headers, rows } };
}

function rowsFor(section: ReportSection): { headers: string[]; rows: unknown[][] } {
  const values = Array.isArray(section.content) ? section.content : [];
  const objects = values.filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  );
  const headers = [...(TABLE_COLUMNS[section.id] ?? Object.keys(objects[0] ?? {}).sort())];
  return { headers, rows: objects.map((row) => headers.map((key) => display(row[key]))) };
}

function sectionBlocks(section: ReportSection): DocumentBlock[] {
  const prefix = `audit-${section.id}`;
  const blocks: DocumentBlock[] = [heading(`${prefix}-heading`, section.title, 2)];
  if (section.kind === 'text') {
    blocks.push(
      paragraph(
        `${prefix}-text`,
        display(section.content) === '—'
          ? AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing(section.title)
          : display(section.content)
      )
    );
  } else if (section.kind === 'list') {
    const items = Array.isArray(section.content) ? section.content.map(display) : [];
    blocks.push(
      items.length
        ? { blockId: `${prefix}-list`, type: 'bullet_list', content: { items } }
        : paragraph(`${prefix}-missing`, AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing(section.title))
    );
  } else if (section.kind === 'table') {
    const mapped = rowsFor(section);
    blocks.push(
      mapped.rows.length
        ? table(`${prefix}-table`, mapped.headers, mapped.rows)
        : paragraph(`${prefix}-missing`, AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing(section.title))
    );
  } else if (section.kind === 'keyValue') {
    const entries =
      section.content && typeof section.content === 'object'
        ? Object.entries(section.content as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b)
          )
        : [];
    blocks.push(
      entries.length
        ? table(
            `${prefix}-properties`,
            ['Właściwość', 'Wartość'],
            entries.map(([key, value]) => [key, display(value)])
          )
        : paragraph(`${prefix}-missing`, AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing(section.title))
    );
  } else {
    const groups =
      section.content && typeof section.content === 'object'
        ? Object.entries(section.content as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b)
          )
        : [];
    for (const [group, value] of groups) {
      blocks.push(heading(`${prefix}-${group}-heading`, group, 3));
      const items = Array.isArray(value) ? value.map(display) : [display(value)];
      blocks.push({ blockId: `${prefix}-${group}-list`, type: 'bullet_list', content: { items } });
    }
    if (!groups.length)
      blocks.push(
        paragraph(`${prefix}-missing`, AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing(section.title))
      );
  }
  return blocks;
}

function confidentiality(value: string | null): DocumentConfidentiality {
  if (
    value === 'public' ||
    value === 'internal' ||
    value === 'client_confidential' ||
    value === 'restricted'
  )
    return value;
  return 'restricted';
}

export function buildAuditReportDocumentSchema(
  report: {
    id: string;
    title: string;
    version: number;
    reportKind: string;
    language: string | null;
    audience: string | null;
    confidentiality: string | null;
    contentHash: string | null;
    generatedAt: string | null;
  },
  document: AuditReportDocument,
  context: { programName: string | null; organizationName: string | null }
): DocumentSchema {
  const timestamp = report.generatedAt ?? document.generatedAt ?? '1970-01-01T00:00:00.000Z';
  const seal = `Raport v${report.version} · hash: ${report.contentHash ?? AUDIT_REPORT_DOCUMENT_PLACEHOLDERS.missing('content_hash')}`;
  return {
    documentId: `audit-report-${report.id}`,
    artifactId: report.id,
    title: report.title,
    documentType: 'ai_audit_report',
    language: report.language === 'en' ? 'en' : 'pl',
    audience: report.audience ? [report.audience] : [],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'comprehensive',
    languageStyle: 'formal',
    confidentiality: confidentiality(report.confidentiality),
    formattingSchema: {
      fonts: { body: 'Aptos', heading: 'Aptos Display' },
      headingStyles: { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: {
        enabled: true,
        content: context.organizationName ?? context.programName ?? report.title,
      },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true, content: seal },
      toc: true,
      coverPage: true,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: document.sections.map((section, index) => ({
      sectionId: section.id,
      orderIndex: index,
      level: 1,
      title: section.title,
      blocks: sectionBlocks(section),
      sourceRefs: [],
      kind: section.id === 'appendices' ? 'appendix' : 'body',
    })),
    sourceRefs: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const auditReportDocumentSchemaService = Object.freeze({
  build: buildAuditReportDocumentSchema,
});
