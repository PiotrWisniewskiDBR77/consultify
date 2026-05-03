export type CanonicalFormat = 'markdown' | 'json';
export type MarkdownProjectionStatus = 'synced' | 'stale' | 'failed' | 'missing';

export interface ArtifactContentEnvelope {
  canonicalFormat: CanonicalFormat;
  artifactType: string;
  contentMd: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
  markdownProjectionStatus: MarkdownProjectionStatus;
  markdownProjectedAt?: string;
  projectionError?: string;
}

export interface ProjectionResult {
  contentMd: string;
  status: MarkdownProjectionStatus;
  projectedAt?: string;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function titleFrom(value: Record<string, unknown>, fallback: string): string {
  return text(value.title, text(value.name, fallback));
}

function projectTable(value: unknown): string {
  const table = isRecord(value) ? value : {};
  const title = titleFrom(table, 'Table');
  const rows = Array.isArray(table.rows) ? table.rows : Array.isArray(table.data) ? table.data : [];
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const columnNames =
    columns.length > 0
      ? columns.map((column) => (isRecord(column) ? text(column.label, text(column.name, text(column.id, 'Column'))) : String(column)))
      : rows.length > 0 && isRecord(rows[0])
        ? Object.keys(rows[0])
        : ['Item'];

  const lines = [`# ${title}`, '', `Rows: ${rows.length}`, '', `| ${columnNames.join(' | ')} |`, `| ${columnNames.map(() => '---').join(' | ')} |`];

  rows.slice(0, 50).forEach((row) => {
    const record = isRecord(row) ? row : { Item: row };
    lines.push(`| ${columnNames.map((column) => String(record[column] ?? '')).join(' | ')} |`);
  });

  if (rows.length > 50) lines.push('', `_Projection truncated to first 50 rows._`);
  return lines.join('\n');
}

function projectDeck(value: unknown): string {
  const deck = isRecord(value) ? value : {};
  const slides = Array.isArray(deck.slides) ? deck.slides : [];
  const lines = [`# ${titleFrom(deck, 'Presentation Deck')}`, '', `Slides: ${slides.length}`];

  slides.forEach((slide, index) => {
    const record = isRecord(slide) ? slide : {};
    lines.push('', `## Slide ${index + 1}: ${titleFrom(record, `Untitled ${index + 1}`)}`);
    const body = text(record.body, text(record.content, ''));
    if (body) lines.push('', body);
    const bullets = Array.isArray(record.bullets) ? record.bullets : [];
    bullets.forEach((bullet) => lines.push(`- ${String(bullet)}`));
    const notes = text(record.notes, '');
    if (notes) lines.push('', `Speaker notes: ${notes}`);
  });

  return lines.join('\n');
}

function projectOutline(value: unknown, label: string): string {
  const root = isRecord(value) ? value : {};
  const nodes = Array.isArray(root.nodes) ? root.nodes : Array.isArray(root.items) ? root.items : [];
  const lines = [`# ${titleFrom(root, label)}`];

  const visit = (node: unknown, depth: number) => {
    const record = isRecord(node) ? node : {};
    const prefix = '  '.repeat(depth);
    lines.push(`${prefix}- ${titleFrom(record, String(node))}`);
    const children = Array.isArray(record.children) ? record.children : [];
    children.forEach((child) => visit(child, depth + 1));
  };

  nodes.forEach((node) => visit(node, 0));
  return lines.join('\n');
}

function projectProcess(value: unknown): string {
  const process = isRecord(value) ? value : {};
  const steps = Array.isArray(process.steps) ? process.steps : Array.isArray(process.nodes) ? process.nodes : [];
  const lines = [`# ${titleFrom(process, 'Process')}`, '', '| Step | Owner | Description |', '|---|---|---|'];

  steps.forEach((step, index) => {
    const record = isRecord(step) ? step : {};
    lines.push(`| ${index + 1}. ${titleFrom(record, `Step ${index + 1}`)} | ${text(record.owner, '-')} | ${text(record.description, text(record.summary, ''))} |`);
  });

  return lines.join('\n');
}

function projectWhiteboard(value: unknown): string {
  const board = isRecord(value) ? value : {};
  const frames = Array.isArray(board.frames) ? board.frames : [];
  const stickies = Array.isArray(board.stickies) ? board.stickies : Array.isArray(board.notes) ? board.notes : [];
  const lines = [`# ${titleFrom(board, 'Whiteboard')}`, '', `Frames: ${frames.length}`, `Notes: ${stickies.length}`];

  frames.forEach((frame, index) => {
    const record = isRecord(frame) ? frame : {};
    lines.push('', `## Frame ${index + 1}: ${titleFrom(record, `Frame ${index + 1}`)}`);
    const summary = text(record.summary, text(record.description, ''));
    if (summary) lines.push(summary);
  });

  if (stickies.length > 0) {
    lines.push('', '## Notes');
    stickies.forEach((sticky) => {
      const record = isRecord(sticky) ? sticky : {};
      lines.push(`- ${text(record.text, text(record.content, String(sticky)))}`);
    });
  }

  return lines.join('\n');
}

function projectResearch(value: unknown): string {
  const research = isRecord(value) ? value : {};
  const report = text(research.contentMarkdown, text(research.content_markdown, text(research.report, '')));
  if (report) return report;

  const findings = Array.isArray(research.findings) ? research.findings : [];
  const lines = [`# ${titleFrom(research, 'Research Report')}`];
  findings.forEach((finding) => lines.push(`- ${String(finding)}`));
  return lines.join('\n');
}

export function projectArtifactToMarkdown(artifactType: string, content: unknown): ProjectionResult {
  try {
    const normalizedType = artifactType.toLowerCase();
    const projectedAt = new Date().toISOString();

    if (typeof content === 'string') {
      return { contentMd: content, status: content.trim() ? 'synced' : 'missing', projectedAt };
    }

    let contentMd: string;
    if (normalizedType.includes('table') || normalizedType.includes('sheet')) {
      contentMd = projectTable(content);
    } else if (normalizedType.includes('deck') || normalizedType.includes('presentation')) {
      contentMd = projectDeck(content);
    } else if (normalizedType.includes('mind')) {
      contentMd = projectOutline(content, 'Mind Map');
    } else if (normalizedType.includes('process')) {
      contentMd = projectProcess(content);
    } else if (normalizedType.includes('whiteboard')) {
      contentMd = projectWhiteboard(content);
    } else if (normalizedType.includes('research')) {
      contentMd = projectResearch(content);
    } else {
      contentMd = projectOutline(content, titleFrom(isRecord(content) ? content : {}, 'Document'));
    }

    return { contentMd, status: contentMd.trim() ? 'synced' : 'missing', projectedAt };
  } catch (error) {
    return {
      contentMd: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Projection failed',
    };
  }
}

export function createArtifactContentEnvelope(params: {
  artifactType: string;
  canonicalFormat?: CanonicalFormat;
  contentMd?: string;
  contentJson?: unknown;
  contentSchemaVersion?: string;
}): ArtifactContentEnvelope {
  if (params.canonicalFormat === 'json' || params.contentJson !== undefined) {
    const projection = projectArtifactToMarkdown(params.artifactType, params.contentMd || params.contentJson);
    return {
      canonicalFormat: 'json',
      artifactType: params.artifactType,
      contentJson: params.contentJson,
      contentMd: params.contentMd || projection.contentMd,
      contentSchemaVersion: params.contentSchemaVersion,
      markdownProjectionStatus: projection.status,
      markdownProjectedAt: projection.projectedAt,
      projectionError: projection.error,
    };
  }

  return {
    canonicalFormat: 'markdown',
    artifactType: params.artifactType,
    contentMd: params.contentMd || '',
    contentSchemaVersion: params.contentSchemaVersion,
    markdownProjectionStatus: params.contentMd?.trim() ? 'synced' : 'missing',
    markdownProjectedAt: new Date().toISOString(),
  };
}

