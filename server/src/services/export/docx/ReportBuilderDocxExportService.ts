import { randomUUID } from 'node:crypto';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import {
  type DocumentBlock,
  type DocumentSchema,
  type DocumentSection,
  type DocumentSourceRef,
  type DocumentTemplate,
} from '../../documentStudio/documentStudioTypes.js';
import {
  ensureTemplateRegistryHydrated,
  getTemplate,
} from '../../documentStudio/documentTemplateService.js';
import { applyDocBaseThemeContract } from './docBaseThemePostprocessor.js';

export const DOC_BASE_TEMPLATE_ID = 'doc-template-system-en-client_final_report';

export interface ReportBuilderDocxInput {
  organizationId: string;
  report: Record<string, unknown>;
  sections: Array<Record<string, unknown>>;
  generatedAt?: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sourceRefs(value: unknown): DocumentSourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const ref = raw as Record<string, unknown>;
    const sourceId = text(ref.sourceId) || text(ref.artifact_id) || text(ref.id);
    if (!sourceId) return [];
    return [
      {
        sourceType: text(ref.sourceType) || text(ref.artifact_type) || 'artifact',
        sourceId,
        sourceTitle: text(ref.sourceTitle) || text(ref.artifact_name) || undefined,
        sourceExcerpt: text(ref.sourceExcerpt) || undefined,
        sourceVersion: text(ref.sourceVersion) || undefined,
        sourceSnapshotId: text(ref.sourceSnapshotId) || undefined,
      },
    ];
  });
}

function markdownTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim())
  );
  if (rows.length < 2 || !rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
  return { headers: rows[0], rows: rows.slice(2) };
}

export function reportBuilderMarkdownToBlocks(
  markdown: string,
  sectionIndex: number
): DocumentBlock[] {
  const lines = String(markdown || '').split(/\r?\n/);
  const blocks: DocumentBlock[] = [];
  let cursor = 0;
  let blockIndex = 0;
  const nextId = () => `rb-${sectionIndex}-${blockIndex++}`;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (!line.trim()) {
      cursor += 1;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const tableLines: string[] = [];
      while (cursor < lines.length && /^\s*\|.*\|\s*$/.test(lines[cursor])) {
        tableLines.push(lines[cursor]);
        cursor += 1;
      }
      const table = markdownTable(tableLines);
      if (table) blocks.push({ blockId: nextId(), type: 'table', content: table });
      continue;
    }
    const bulletItems: string[] = [];
    while (cursor < lines.length && /^\s*[-*]\s+/.test(lines[cursor])) {
      bulletItems.push(lines[cursor].replace(/^\s*[-*]\s+/, '').trim());
      cursor += 1;
    }
    if (bulletItems.length) {
      blocks.push({ blockId: nextId(), type: 'bullet_list', content: { items: bulletItems } });
      continue;
    }
    const numberedItems: string[] = [];
    while (cursor < lines.length && /^\s*\d+\.\s+/.test(lines[cursor])) {
      numberedItems.push(lines[cursor].replace(/^\s*\d+\.\s+/, '').trim());
      cursor += 1;
    }
    if (numberedItems.length) {
      blocks.push({
        blockId: nextId(),
        type: 'numbered_list',
        content: { style: 'numbered', items: numberedItems },
      });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      blocks.push({
        blockId: nextId(),
        type: 'heading',
        content: { text: heading[2].trim(), level: Math.min(3, heading[1].length + 1) },
      });
      cursor += 1;
      continue;
    }
    const paragraphLines = [line.trim()];
    cursor += 1;
    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !/^\s*(?:[-*]\s+|\d+\.\s+|#{1,3}\s+|\|.*\|\s*$)/.test(lines[cursor])
    ) {
      paragraphLines.push(lines[cursor].trim());
      cursor += 1;
    }
    blocks.push({
      blockId: nextId(),
      type: 'paragraph',
      content: { text: paragraphLines.join(' ') },
    });
  }

  return blocks.length
    ? blocks
    : [{ blockId: `rb-${sectionIndex}-empty`, type: 'paragraph', content: { text: '' } }];
}

export function buildReportBuilderDocumentSchema(
  input: ReportBuilderDocxInput,
  template: DocumentTemplate
): DocumentSchema {
  if (template.status !== 'approved') {
    throw new Error(`DOC_BASE_E_STATUS:${template.templateId}`);
  }
  const report = input.report;
  const generatedAt = input.generatedAt || new Date().toISOString();
  const title = text(report.title) || text(report.name) || 'Client report';
  const organizationName = text(report.organizationName) || 'Client';
  const reportLanguage =
    text(report.language) ||
    input.sections.map((section) => text(section.language)).find(Boolean) ||
    template.language;
  const language = reportLanguage.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  const enabled = input.sections
    .filter((section) => section && section.enabled !== false)
    .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
  const reportSourceRefs = sourceRefs(report.sourceRefs ?? report.source_refs);
  const sections: DocumentSection[] = enabled.map((section, index) => {
    const sectionTitle = text(section.title) || text(section.sectionKey) || `Section ${index + 1}`;
    const content = text(section.editedContent) || text(section.generatedContent);
    return {
      sectionId: text(section.id) || `rb-section-${index}`,
      orderIndex: index,
      level: 1,
      title: sectionTitle,
      purpose: text(section.purpose) || undefined,
      blocks: reportBuilderMarkdownToBlocks(content, index),
      sourceRefs: sourceRefs(section.sourceRefs ?? section.source_refs),
      kind: /^(appendix|annex)/i.test(sectionTitle) ? 'appendix' : 'body',
    };
  });

  return {
    documentId: text(report.id) || randomUUID(),
    artifactId: text(report.artifactId) || text(report.id) || randomUUID(),
    title,
    documentType: template.documentType,
    language,
    audience: template.audience.length ? template.audience : ['Client Sponsor'],
    goal: 'recommend',
    communicationRegister: template.communicationRegister,
    density: template.density,
    languageStyle: template.languageStyle,
    confidentiality: template.confidentiality,
    formattingSchema: {
      ...template.formattingSchema,
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
      headers: { enabled: true, content: `${title} · ${organizationName}` },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        content: `Consultify · DBR77 · ${organizationName}`,
        pageNumberingFormat: language === 'pl' ? 'Strona {N} z {M}' : 'Page {N} of {M}',
      },
      toc: true,
      tocConfig: { enabled: true, maxDepth: 2, nativeField: false },
      coverPage: true,
      coverPageDetailed: {
        enabled: true,
        includeLogo: true,
        includeStatus: true,
        includeConfidentiality: true,
      },
      colorTemplateId: 'consultify-client-final',
    },
    sections,
    sourceRefs: Array.from(
      new Map(
        [...reportSourceRefs, ...sections.flatMap((section) => section.sourceRefs)].map((ref) => [
          `${ref.sourceType}:${ref.sourceId}`,
          ref,
        ])
      ).values()
    ),
    createdAt: generatedAt,
    updatedAt: generatedAt,
    templateRef: { templateId: template.templateId, templateVersion: template.version },
  };
}

export async function exportReportBuilderDocx(input: ReportBuilderDocxInput): Promise<Buffer> {
  await ensureTemplateRegistryHydrated(input.organizationId);
  const template = getTemplate(DOC_BASE_TEMPLATE_ID, input.organizationId);
  if (!template) throw new Error(`DOC_BASE_E_LOOKUP:${DOC_BASE_TEMPLATE_ID}`);
  const rendered = await renderDocumentSchemaToDocxBuffer(
    buildReportBuilderDocumentSchema(input, template)
  );
  return applyDocBaseThemeContract(rendered);
}
