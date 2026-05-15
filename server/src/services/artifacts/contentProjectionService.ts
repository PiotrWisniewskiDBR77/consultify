export type CanonicalFormat = 'markdown' | 'json';

export type CanvasArtifactBlockKind =
  | 'text'
  | 'table'
  | 'chart'
  | 'checklist'
  | 'code'
  | 'insight'
  | 'kpi'
  | 'heading'
  | 'list'
  | 'quote'
  | 'image'
  | 'unknown';

export interface CanvasArtifactBlock {
  id: string;
  kind: CanvasArtifactBlockKind;
  order?: number;
  title?: string;
  data?: Record<string, unknown>;
}

export type MarkdownProjectionStatus = 'ready' | 'stale' | 'failed';

export interface ArtifactContentEnvelope {
  canonicalFormat: CanonicalFormat;
  contentMd: string;
  contentJson: unknown;
  blocks: CanvasArtifactBlock[];
  contentSchemaVersion: string | null;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt: string | null;
  projectionError: string | null;
}

type CreateEnvelopeInput = {
  artifactType?: string;
  canonicalFormat?: CanonicalFormat;
  contentMd?: string | null;
  contentJson?: unknown;
  blocks?: unknown;
  contentSchemaVersion?: string | null;
};

function asPlainObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function normalizeBlockKind(kind: unknown): CanvasArtifactBlockKind {
  const value = String(kind || '')
    .trim()
    .toLowerCase();
  const allowed: CanvasArtifactBlockKind[] = [
    'text',
    'table',
    'chart',
    'checklist',
    'code',
    'insight',
    'kpi',
    'heading',
    'list',
    'quote',
    'image',
  ];
  return allowed.includes(value as CanvasArtifactBlockKind)
    ? (value as CanvasArtifactBlockKind)
    : 'unknown';
}

export function normalizeCanvasArtifactBlocks(blocks: unknown): CanvasArtifactBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block, index) => {
      const source = asPlainObject(block);
      const blockId = String(source.id || '').trim() || `block-${index + 1}`;
      const order =
        typeof source.order === 'number' && Number.isFinite(source.order) ? source.order : index;
      return {
        id: blockId,
        kind: normalizeBlockKind(source.kind),
        order,
        title: typeof source.title === 'string' ? source.title : undefined,
        data: asPlainObject(source.data),
      } satisfies CanvasArtifactBlock;
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function projectCanvasArtifactBlockToMarkdown(block: CanvasArtifactBlock): string {
  const title = typeof block.title === 'string' && block.title.trim() ? block.title.trim() : null;
  const data = asPlainObject(block.data);
  const lines: string[] = [];

  if (title) {
    lines.push(`## ${title}`);
  }

  if (block.kind === 'table' && Array.isArray(data.rows)) {
    const rows = data.rows as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      const headers = Object.keys(rows[0] || {});
      if (headers.length > 0) {
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
        for (const row of rows) {
          lines.push(`| ${headers.map((h) => String((row as any)?.[h] ?? '')).join(' | ')} |`);
        }
      }
    }
  } else if (typeof data.text === 'string') {
    lines.push(data.text);
  } else if (typeof data.summary === 'string') {
    lines.push(data.summary);
  } else {
    const compact = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    if (compact) lines.push(compact);
  }

  return lines.join('\n').trim();
}

export function createArtifactContentEnvelope(
  input: CreateEnvelopeInput = {}
): ArtifactContentEnvelope {
  const canonicalFormat: CanonicalFormat =
    input.canonicalFormat === 'json' || input.canonicalFormat === 'markdown'
      ? input.canonicalFormat
      : 'markdown';
  const normalizedBlocks = normalizeCanvasArtifactBlocks(input.blocks);
  const contentMd = String(input.contentMd || '').trim();
  const contentJson = input.contentJson === undefined ? null : input.contentJson;

  return {
    canonicalFormat,
    contentMd,
    contentJson,
    blocks: normalizedBlocks,
    contentSchemaVersion: input.contentSchemaVersion || null,
    markdownProjectionStatus: 'ready',
    markdownProjectedAt: null,
    projectionError: null,
  };
}
