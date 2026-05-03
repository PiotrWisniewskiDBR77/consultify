import type { ArtifactContentEnvelope } from '@/types/artifactContent';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function getTitle(value: Record<string, unknown>, fallback: string): string {
  return cleanText(value.title, cleanText(value.name, fallback));
}

export function projectToMarkdown(artifactType: string, content: unknown): string {
  if (typeof content === 'string') return content;

  const record = isRecord(content) ? content : {};
  const type = artifactType.toLowerCase();

  if (type.includes('deck') || type.includes('presentation')) {
    const slides = Array.isArray(record.slides) ? record.slides : [];
    return [`# ${getTitle(record, 'Presentation Deck')}`, '', ...slides.flatMap((slide, index) => {
      const item = isRecord(slide) ? slide : {};
      const body = cleanText(item.body, cleanText(item.content, ''));
      return ['', `## Slide ${index + 1}: ${getTitle(item, `Untitled ${index + 1}`)}`, body].filter(Boolean);
    })].join('\n');
  }

  if (type.includes('table') || type.includes('sheet')) {
    const rows = Array.isArray(record.rows) ? record.rows : Array.isArray(record.data) ? record.data : [];
    const columns = rows.length > 0 && isRecord(rows[0]) ? Object.keys(rows[0]) : ['Item'];
    const lines = [`# ${getTitle(record, 'Table')}`, '', `| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`];
    rows.slice(0, 50).forEach((row) => {
      const rowRecord = isRecord(row) ? row : { Item: row };
      lines.push(`| ${columns.map((column) => String(rowRecord[column] ?? '')).join(' | ')} |`);
    });
    return lines.join('\n');
  }

  const nodes = Array.isArray(record.nodes) ? record.nodes : Array.isArray(record.items) ? record.items : [];
  const lines = [`# ${getTitle(record, 'Document')}`];
  nodes.forEach((node) => {
    const item = isRecord(node) ? node : {};
    lines.push(`- ${getTitle(item, String(node))}`);
  });
  return lines.join('\n');
}

export function envelopeToMarkdown(envelope: ArtifactContentEnvelope | undefined, fallback = ''): string {
  if (!envelope) return fallback;
  return envelope.contentMd || projectToMarkdown(envelope.artifactType, envelope.contentJson) || fallback;
}

