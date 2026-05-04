import type {
  CanvasArtifactBlock,
  CanvasArtifactBlockCapability,
  CanvasArtifactBlockKind,
  CanvasArtifactBlockStatus,
  CanvasProjectionStatus,
} from '@/types/canvasWorkspace';

const blockKinds: CanvasArtifactBlockKind[] = [
  'table',
  'chart',
  'diagram',
  'decision',
  'research',
  'dashboard',
];
const blockStatuses: CanvasArtifactBlockStatus[] = ['draft', 'ready', 'stale', 'failed'];
const projectionStatuses: CanvasProjectionStatus[] = ['synced', 'stale', 'failed', 'missing'];
const capabilities: CanvasArtifactBlockCapability[] = [
  'view',
  'edit',
  'filter',
  'sort',
  'export',
  'rerun',
  'convert',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function escapeTableCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br />');
}

function projectTableBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const columns = Array.isArray(data.columns) ? data.columns : [];
  const columnNames =
    columns.length > 0
      ? columns.map((column) =>
          isRecord(column)
            ? nonEmptyString(
                column.label,
                nonEmptyString(column.name, nonEmptyString(column.id, 'Column'))
              )
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
  const chartType = nonEmptyString(data.chartType, nonEmptyString(data.type, 'chart'));
  const insight = nonEmptyString(data.insight, nonEmptyString(data.summary, ''));
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
        `- ${nonEmptyString(metric.label, nonEmptyString(metric.name, 'Metric'))}: ${String(metric.value ?? '')}`
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
    lines.push(`- ${nonEmptyString(record.label, nonEmptyString(record.title, String(node)))}`);
  });
  return lines.join('\n');
}

function projectDecisionBlock(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const options = Array.isArray(data.options) ? data.options : [];
  const risks = Array.isArray(data.risks) ? data.risks : [];
  const assumptions = Array.isArray(data.assumptions) ? data.assumptions : [];
  const recommendation = nonEmptyString(data.recommendation, '');
  const question = nonEmptyString(data.question, nonEmptyString(data.decisionQuestion, ''));
  const approvalStatus = nonEmptyString(data.approvalStatus, 'draft');
  const lines = [`### ${block.title}`];
  if (question) lines.push('', `Decision question: ${question}`);
  if (recommendation) lines.push('', `Recommendation: ${recommendation}`);
  lines.push('', `Approval status: ${approvalStatus}`);
  if (options.length > 0) lines.push('', 'Options:');
  options.forEach((option) => {
    const record = isRecord(option) ? option : {};
    const score = record.score === undefined ? '' : ` (score: ${String(record.score)})`;
    lines.push(
      `- ${nonEmptyString(record.label, nonEmptyString(record.title, String(option)))}${score}`
    );
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
  const question = nonEmptyString(data.question, nonEmptyString(data.researchQuestion, ''));
  const hypotheses = Array.isArray(data.hypotheses) ? data.hypotheses : [];
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const contradictions = Array.isArray(data.contradictions) ? data.contradictions : [];
  const gaps = Array.isArray(data.gaps) ? data.gaps : [];
  const implications = Array.isArray(data.implications) ? data.implications : [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  const confidence = nonEmptyString(data.confidence, 'unknown');
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
      lines.push(`- ${nonEmptyString(record.label, String(kpi))}: ${String(record.value ?? '')}`);
    });
  }
  if (charts.length > 0) {
    lines.push('', 'Charts:');
    charts.forEach((chart) => {
      const record = isRecord(chart) ? chart : {};
      lines.push(`- ${nonEmptyString(record.title, nonEmptyString(record.label, 'Chart'))}`);
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

  return value
    .map((item): CanvasArtifactBlock | null => {
      if (!isRecord(item)) return null;
      const id = nonEmptyString(item.id, '');
      const kind = blockKinds.includes(item.kind as CanvasArtifactBlockKind)
        ? (item.kind as CanvasArtifactBlockKind)
        : null;
      if (!id || !kind) return null;
      if (item.schemaVersion && item.schemaVersion !== 'canvas-block/v1') return null;

      const block: CanvasArtifactBlock = {
        id,
        kind,
        schemaVersion: 'canvas-block/v1',
        title: nonEmptyString(item.title, kind),
        status: blockStatuses.includes(item.status as CanvasArtifactBlockStatus)
          ? (item.status as CanvasArtifactBlockStatus)
          : 'draft',
        capabilities: stringArray(item.capabilities).filter(
          (capability): capability is CanvasArtifactBlockCapability =>
            capabilities.includes(capability as CanvasArtifactBlockCapability)
        ),
        data: item.data,
        provenance: isRecord(item.provenance)
          ? {
              source:
                item.provenance.source === 'assistant' ||
                item.provenance.source === 'import' ||
                item.provenance.source === 'system'
                  ? item.provenance.source
                  : 'user',
              conversationId: nonEmptyString(item.provenance.conversationId, ''),
              draftId: nonEmptyString(item.provenance.draftId, ''),
              operationId: nonEmptyString(item.provenance.operationId, ''),
              createdBy: nonEmptyString(item.provenance.createdBy, ''),
              createdAt: nonEmptyString(item.provenance.createdAt, ''),
              updatedAt: nonEmptyString(item.provenance.updatedAt, ''),
            }
          : { source: 'user' },
        markdownProjection: nonEmptyString(item.markdownProjection, ''),
        markdownProjectionStatus: projectionStatuses.includes(
          item.markdownProjectionStatus as CanvasProjectionStatus
        )
          ? (item.markdownProjectionStatus as CanvasProjectionStatus)
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
