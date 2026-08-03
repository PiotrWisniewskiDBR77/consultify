import {
  type ArtifactCanonicalFormat as CanonicalFormat,
  type ArtifactContentEnvelopeV1 as ArtifactContentEnvelope,
  type ArtifactProjectionStatus as MarkdownProjectionStatus,
  normalizeArtifactContentEnvelope,
} from '../../types/artifactContent.js';

export type { ArtifactContentEnvelope, CanonicalFormat, MarkdownProjectionStatus };
export type CanvasArtifactBlockKind =
  | 'table'
  | 'chart'
  | 'diagram'
  | 'decision'
  | 'research'
  | 'dashboard';
export type CanvasArtifactBlockStatus = 'draft' | 'ready' | 'stale' | 'failed';
export type CanvasArtifactBlockCapability =
  | 'view'
  | 'edit'
  | 'filter'
  | 'sort'
  | 'export'
  | 'rerun'
  | 'convert';

export interface CanvasArtifactBlock {
  id: string;
  kind: CanvasArtifactBlockKind;
  schemaVersion: 'canvas-block/v1';
  title: string;
  status: CanvasArtifactBlockStatus;
  capabilities: CanvasArtifactBlockCapability[];
  data: unknown;
  provenance: Record<string, unknown>;
  markdownProjection: string;
  markdownProjectionStatus: MarkdownProjectionStatus;
  projectionError?: string | null;
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function escapeTableCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />');
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
      ? columns.map((column) =>
          isRecord(column)
            ? text(column.label, text(column.name, text(column.id, 'Column')))
            : String(column)
        )
      : rows.length > 0 && isRecord(rows[0])
        ? Object.keys(rows[0])
        : ['Item'];

  const lines = [
    `# ${title}`,
    '',
    `Rows: ${rows.length}`,
    '',
    `| ${columnNames.join(' | ')} |`,
    `| ${columnNames.map(() => '---').join(' | ')} |`,
  ];

  rows.slice(0, 50).forEach((row) => {
    const record: Record<string, unknown> = isRecord(row) ? row : { Item: row };
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
  const nodes = Array.isArray(root.nodes)
    ? root.nodes
    : Array.isArray(root.items)
      ? root.items
      : [];
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
  const steps = Array.isArray(process.steps)
    ? process.steps
    : Array.isArray(process.nodes)
      ? process.nodes
      : [];
  const lines = [
    `# ${titleFrom(process, 'Process')}`,
    '',
    '| Step | Owner | Description |',
    '|---|---|---|',
  ];

  steps.forEach((step, index) => {
    const record = isRecord(step) ? step : {};
    lines.push(
      `| ${index + 1}. ${titleFrom(record, `Step ${index + 1}`)} | ${text(record.owner, '-')} | ${text(record.description, text(record.summary, ''))} |`
    );
  });

  return lines.join('\n');
}

function projectWhiteboard(value: unknown): string {
  const board = isRecord(value) ? value : {};
  const frames = Array.isArray(board.frames) ? board.frames : [];
  const stickies = Array.isArray(board.stickies)
    ? board.stickies
    : Array.isArray(board.notes)
      ? board.notes
      : [];
  const lines = [
    `# ${titleFrom(board, 'Whiteboard')}`,
    '',
    `Frames: ${frames.length}`,
    `Notes: ${stickies.length}`,
  ];

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
  const report = text(
    research.contentMarkdown,
    text(research.content_markdown, text(research.report, ''))
  );
  if (report) return report;

  const findings = Array.isArray(research.findings) ? research.findings : [];
  const lines = [`# ${titleFrom(research, 'Research Report')}`];
  findings.forEach((finding) => lines.push(`- ${String(finding)}`));
  return lines.join('\n');
}

function projectTableBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const columns = Array.isArray(data.columns) ? data.columns : [];
  const columnNames =
    columns.length > 0
      ? columns.map((column) =>
          isRecord(column)
            ? text(column.label, text(column.name, text(column.id, 'Column')))
            : String(column)
        )
      : rows.length > 0 && isRecord(rows[0])
        ? Object.keys(rows[0])
        : ['Item'];
  const lines = [
    `### ${block.title}`,
    '',
    `| ${columnNames.join(' | ')} |`,
    `| ${columnNames.map(() => '---').join(' | ')} |`,
  ];
  rows.slice(0, 50).forEach((row) => {
    const record: Record<string, unknown> = isRecord(row) ? row : { Item: row };
    lines.push(`| ${columnNames.map((column) => escapeTableCell(record[column])).join(' | ')} |`);
  });
  if (rows.length > 50) lines.push('', '_Projection truncated to first 50 rows._');
  return lines.join('\n');
}

function projectChartBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const chartType = text(data.chartType, text(data.type, 'chart'));
  const insight = text(data.insight, text(data.summary, ''));
  const metrics = Array.isArray(data.metrics)
    ? data.metrics
    : Array.isArray(data.series)
      ? data.series
      : [];
  const lines = [`### ${block.title}`, '', `Chart type: ${chartType}`];
  if (insight) lines.push('', insight);
  metrics.slice(0, 20).forEach((metric) => {
    if (isRecord(metric)) {
      lines.push(
        `- ${text(metric.label, text(metric.name, 'Metric'))}: ${String(metric.value ?? '')}`
      );
    } else {
      lines.push(`- ${String(metric)}`);
    }
  });
  return lines.join('\n');
}

function projectDiagramBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const lines = [
    `### ${block.title}`,
    '',
    `Nodes: ${nodes.length}`,
    `Connections: ${edges.length}`,
  ];
  nodes.slice(0, 25).forEach((node) => {
    const record = isRecord(node) ? node : {};
    lines.push(`- ${text(record.label, text(record.title, String(node)))}`);
  });
  return lines.join('\n');
}

function projectDecisionBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const options = Array.isArray(data.options) ? data.options : [];
  const risks = Array.isArray(data.risks) ? data.risks : [];
  const assumptions = Array.isArray(data.assumptions) ? data.assumptions : [];
  const recommendation = text(data.recommendation, '');
  const question = text(data.question, text(data.decisionQuestion, ''));
  const approvalStatus = text(data.approvalStatus, 'draft');
  const lines = [`### ${block.title}`];
  if (question) lines.push('', `Decision question: ${question}`);
  if (recommendation) lines.push('', `Recommendation: ${recommendation}`);
  lines.push('', `Approval status: ${approvalStatus}`);
  if (options.length > 0) lines.push('', 'Options:');
  options.forEach((option) => {
    const record = isRecord(option) ? option : {};
    const score = record.score === undefined ? '' : ` (score: ${String(record.score)})`;
    lines.push(`- ${text(record.label, text(record.title, String(option)))}${score}`);
  });
  if (risks.length > 0) {
    lines.push('', 'Risks:');
    risks.forEach((risk) => lines.push(`- ${String(risk)}`));
  }
  if (assumptions.length > 0) {
    lines.push('', 'Assumptions:');
    assumptions.forEach((assumption) => lines.push(`- ${String(assumption)}`));
  }
  return lines.join('\n');
}

function projectResearchBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const question = text(data.question, text(data.researchQuestion, ''));
  const hypotheses = Array.isArray(data.hypotheses) ? data.hypotheses : [];
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const contradictions = Array.isArray(data.contradictions) ? data.contradictions : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];
  const implications = Array.isArray(data.implications) ? data.implications : [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const confidence = text(data.confidence, 'unknown');
  const lines = [`### ${block.title}`];
  if (question) lines.push('', `Research question: ${question}`);
  lines.push('', `Confidence: ${confidence}`);
  if (hypotheses.length > 0) {
    lines.push('', 'Hypotheses:');
    hypotheses.forEach((hypothesis) => lines.push(`- ${String(hypothesis)}`));
  }
  if (facts.length > 0) {
    lines.push('', 'Facts:');
    facts.forEach((fact) => lines.push(`- ${String(fact)}`));
  }
  if (findings.length > 0) lines.push('', 'Findings:');
  findings.forEach((finding) => lines.push(`- ${String(finding)}`));
  if (contradictions.length > 0) {
    lines.push('', 'Contradictions / limitations:');
    contradictions.forEach((contradiction) => lines.push(`- ${String(contradiction)}`));
  }
  if (gaps.length > 0) {
    lines.push('', 'Gaps:');
    gaps.forEach((gap) => lines.push(`- ${String(gap)}`));
  }
  if (implications.length > 0) {
    lines.push('', 'Implications:');
    implications.forEach((implication) => lines.push(`- ${String(implication)}`));
  }
  if (recommendations.length > 0) {
    lines.push('', 'Recommendations:');
    recommendations.forEach((recommendation) => lines.push(`- ${String(recommendation)}`));
  }
  if (sources.length > 0) {
    lines.push('', 'Sources:');
    sources.slice(0, 20).forEach((source) => lines.push(`- ${String(source)}`));
  }
  return lines.join('\n');
}

function projectDashboardBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const charts = Array.isArray(data.charts) ? data.charts : [];
  const insights = Array.isArray(data.insights) ? data.insights : [];
  const limitations = Array.isArray(data.limitations) ? data.limitations : [];
  const actions = Array.isArray(data.recommendedActions) ? data.recommendedActions : [];
  const lines = [`### ${block.title}`];
  if (kpis.length > 0) {
    lines.push('', 'KPIs:');
    kpis.forEach((kpi) => {
      const record = isRecord(kpi) ? kpi : {};
      lines.push(`- ${text(record.label, String(kpi))}: ${String(record.value ?? '')}`);
    });
  }
  if (charts.length > 0) {
    lines.push('', 'Charts:');
    charts.forEach((chart) => {
      const record = isRecord(chart) ? chart : {};
      lines.push(`- ${text(record.title, text(record.label, 'Chart'))}`);
    });
  }
  if (insights.length > 0) {
    lines.push('', 'Narrative insights:');
    insights.forEach((insight) => lines.push(`- ${String(insight)}`));
  }
  if (actions.length > 0) {
    lines.push('', 'Recommended actions:');
    actions.forEach((action) => lines.push(`- ${String(action)}`));
  }
  if (limitations.length > 0) {
    lines.push('', 'Data limitations:');
    limitations.forEach((limitation) => lines.push(`- ${String(limitation)}`));
  }
  return lines.join('\n');
}

export function projectCanvasArtifactBlockToMarkdown(block: CanvasArtifactBlock): string {
  if (block.markdownProjectionStatus === 'failed') {
    return `### ${block.title}\n\n_Projection unavailable: ${block.projectionError || 'projection failed'}_`;
  }
  if (block.markdownProjectionStatus === 'missing') {
    return `### ${block.title}\n\n_Projection is missing._`;
  }
  if (block.markdownProjection?.trim()) return block.markdownProjection;
  if (block.kind === 'table') return projectTableBlock(block);
  if (block.kind === 'chart') return projectChartBlock(block);
  if (block.kind === 'diagram') return projectDiagramBlock(block);
  if (block.kind === 'decision') return projectDecisionBlock(block);
  if (block.kind === 'research') return projectResearchBlock(block);
  return projectDashboardBlock(block);
}

export function normalizeCanvasArtifactBlocks(value: unknown): CanvasArtifactBlock[] {
  if (!Array.isArray(value)) return [];
  const blockKinds: CanvasArtifactBlockKind[] = [
    'table',
    'chart',
    'diagram',
    'decision',
    'research',
    'dashboard',
  ];
  const blockStatuses: CanvasArtifactBlockStatus[] = ['draft', 'ready', 'stale', 'failed'];
  const projectionStatuses: MarkdownProjectionStatus[] = ['synced', 'stale', 'failed', 'missing'];
  const capabilities: CanvasArtifactBlockCapability[] = [
    'view',
    'edit',
    'filter',
    'sort',
    'export',
    'rerun',
    'convert',
  ];

  return value
    .map((item): CanvasArtifactBlock | null => {
      if (!isRecord(item)) return null;
      const id = text(item.id, '');
      const kind = blockKinds.includes(item.kind as CanvasArtifactBlockKind)
        ? (item.kind as CanvasArtifactBlockKind)
        : null;
      if (!id || !kind) return null;
      if (item.schemaVersion && item.schemaVersion !== 'canvas-block/v1') return null;

      const block: CanvasArtifactBlock = {
        id,
        kind,
        schemaVersion: 'canvas-block/v1',
        title: text(item.title, kind),
        status: blockStatuses.includes(item.status as CanvasArtifactBlockStatus)
          ? (item.status as CanvasArtifactBlockStatus)
          : 'draft',
        capabilities: stringArray(item.capabilities).filter(
          (capability): capability is CanvasArtifactBlockCapability =>
            capabilities.includes(capability as CanvasArtifactBlockCapability)
        ),
        data: item.data,
        provenance: isRecord(item.provenance) ? item.provenance : { source: 'user' },
        markdownProjection: text(item.markdownProjection, ''),
        markdownProjectionStatus: projectionStatuses.includes(
          item.markdownProjectionStatus as MarkdownProjectionStatus
        )
          ? (item.markdownProjectionStatus as MarkdownProjectionStatus)
          : 'missing',
        projectionError: typeof item.projectionError === 'string' ? item.projectionError : null,
      };

      return {
        ...block,
        markdownProjection: projectCanvasArtifactBlockToMarkdown(block),
      };
    })
    .filter((block): block is CanvasArtifactBlock => Boolean(block));
}

function combineProjectionStatus(
  documentStatus: MarkdownProjectionStatus,
  blocks: CanvasArtifactBlock[]
): MarkdownProjectionStatus {
  if (blocks.some((block) => block.markdownProjectionStatus === 'failed')) return 'failed';
  if (documentStatus === 'failed') return 'failed';
  if (blocks.some((block) => block.markdownProjectionStatus === 'stale')) return 'stale';
  if (documentStatus === 'stale') return 'stale';
  if (documentStatus === 'missing' && blocks.length === 0) return 'missing';
  if (blocks.some((block) => block.markdownProjectionStatus === 'missing')) return 'missing';
  return documentStatus;
}

export function projectArtifactToMarkdown(
  artifactType: string,
  content: unknown
): ProjectionResult {
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
  blocks?: unknown;
  contentSchemaVersion?: string;
}): ArtifactContentEnvelope {
  const blocks = normalizeCanvasArtifactBlocks(params.blocks);
  if (params.canonicalFormat === 'json' || params.contentJson !== undefined) {
    const projection = projectArtifactToMarkdown(
      params.artifactType,
      params.contentMd || params.contentJson
    );
    return normalizeArtifactContentEnvelope({
      canonicalFormat: 'json',
      artifactType: params.artifactType,
      contentJson: params.contentJson,
      blocks,
      contentMd: params.contentMd || projection.contentMd,
      contentSchemaVersion: params.contentSchemaVersion,
      markdownProjectionStatus: combineProjectionStatus(projection.status, blocks),
      markdownProjectedAt: projection.projectedAt,
      projectionError:
        projection.error ||
        blocks.find((block) => block.markdownProjectionStatus === 'failed')?.projectionError ||
        undefined,
    });
  }

  const markdownStatus: MarkdownProjectionStatus = params.contentMd?.trim() ? 'synced' : 'missing';
  return normalizeArtifactContentEnvelope({
    canonicalFormat: 'markdown',
    artifactType: params.artifactType,
    contentMd: params.contentMd || '',
    blocks,
    contentSchemaVersion: params.contentSchemaVersion,
    markdownProjectionStatus: combineProjectionStatus(markdownStatus, blocks),
    markdownProjectedAt: new Date().toISOString(),
  });
}
