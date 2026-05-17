/**
 * Document Schema Renderer — MVP-1 (Mode 1 only).
 *
 * Renders a Document Schema into a markdown payload that the V8.1 substrate
 * stores as the artifact `content` field, and into a small set of derived
 * formats for export (markdown text by default).
 *
 * MVP-1 boundary: the Word-quality DOCX export and PDF rendering with stable
 * TOC, headers/footers and page numbering are scheduled for MVP-4. MVP-1
 * markdown export honors the existing wave5 export manifest format and the
 * report-builder DOCX export pipeline can later be wired in by the renderer
 * adapter.
 */

import type { DocumentBlock, DocumentSchema, DocumentSection } from './documentStudioTypes.js';

function renderBlock(block: DocumentBlock): string {
  switch (block.type) {
    case 'heading': {
      const content = block.content as { level?: number; text?: string };
      const level = Math.min(Math.max(content.level ?? 2, 1), 6);
      return `${'#'.repeat(level)} ${content.text ?? ''}`;
    }
    case 'paragraph': {
      const content = block.content as { text?: string };
      const text = content.text ?? '';
      const assumptionTag = block.isAssumption ? ' _[Assumption]_' : '';
      return `${text}${assumptionTag}`;
    }
    case 'bullet_list': {
      const content = block.content as { items?: string[] };
      const items = content.items ?? [];
      return items.map((item) => `- ${item}`).join('\n');
    }
    case 'numbered_list': {
      const content = block.content as { items?: string[] };
      const items = content.items ?? [];
      return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
    }
    case 'callout': {
      const content = block.content as { variant?: string; text?: string };
      const variant = content.variant ?? 'note';
      return `> **${variant.toUpperCase()}:** ${content.text ?? ''}`;
    }
    case 'quote': {
      const content = block.content as { text?: string };
      return `> ${content.text ?? ''}`;
    }
    case 'table':
    case 'risk_table':
    case 'kpi_strip': {
      const content = block.content as { columns?: string[]; rows?: string[][] };
      const columns = content.columns ?? [];
      const rows = content.rows ?? [];
      const header = `| ${columns.join(' | ')} |`;
      const separator = `| ${columns.map(() => '---').join(' | ')} |`;
      const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
      return [header, separator, body].filter(Boolean).join('\n');
    }
    case 'image': {
      const content = block.content as { url?: string; alt?: string };
      return `![${content.alt ?? ''}](${content.url ?? ''})`;
    }
    case 'footnote':
    case 'citation': {
      const content = block.content as { text?: string };
      return content.text ?? '';
    }
    default: {
      return '';
    }
  }
}

function renderSection(section: DocumentSection): string {
  const headingMarker = '#'.repeat(Math.min(Math.max(section.level + 1, 2), 6));
  const blocks = section.blocks
    .map((block) => renderBlock(block))
    .filter((rendered) => rendered.length > 0)
    .join('\n\n');
  const purposeNote = section.purpose ? `\n\n_Purpose: ${section.purpose}_` : '';
  return [`${headingMarker} ${section.title}`, purposeNote.trim(), blocks]
    .filter((part) => part.length > 0)
    .join('\n\n');
}

function renderHeader(schema: DocumentSchema): string {
  const meta: string[] = [];
  meta.push(`# ${schema.title}`);
  meta.push('');
  const labels: Array<[string, string]> = [
    ['Document type', schema.documentType],
    ['Audience', schema.audience.join(', ') || 'Unspecified'],
    ['Goal', schema.goal],
    ['Register', schema.communicationRegister],
    ['Density', schema.density],
    ['Language style', schema.languageStyle],
    ['Confidentiality', schema.confidentiality],
  ];
  const lines = labels.map(([label, value]) => `- **${label}:** ${value}`);
  meta.push(...lines);
  meta.push('');
  return meta.join('\n');
}

function renderSources(schema: DocumentSchema): string {
  if (schema.sourceRefs.length === 0) {
    return '\n## Sources\n\n_No sources attached. Analytical claims are marked as assumptions._';
  }
  const items = schema.sourceRefs.map((ref) => {
    const title = ref.sourceTitle ?? ref.sourceId;
    return `- ${ref.sourceType}: ${title} (${ref.sourceId})`;
  });
  return ['', '## Sources', '', ...items].join('\n');
}

export function renderSchemaToMarkdown(schema: DocumentSchema): string {
  const header = renderHeader(schema);
  const sections = schema.sections.map(renderSection).join('\n\n');
  const sources = renderSources(schema);
  return [header, sections, sources].join('\n\n');
}
