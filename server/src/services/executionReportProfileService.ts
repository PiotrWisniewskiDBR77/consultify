import { unifiedExportService } from './export/UnifiedExportService.js';

type ExecutionSnapshot = {
  title?: string;
  subtitle?: string;
  rag?: string;
  ragReason?: string;
  period?: { start?: string; end?: string };
  asOf?: string;
  metrics?: Array<{ label?: string; value?: string }>;
  sections?: Array<{
    title?: string;
    narrative?: string;
    bullets?: string[];
    table?: {
      columns?: Array<{ id?: string; label?: string }>;
      rows?: Array<Record<string, string>>;
    };
    empty?: string;
  }>;
};

const clean = (value: unknown): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ');

export function executionSnapshotMarkdown(snapshot: ExecutionSnapshot): string {
  const lines = [
    snapshot.subtitle ? `_${clean(snapshot.subtitle)}_` : '',
    `**RAG:** ${clean(snapshot.rag || 'GREY')}${snapshot.ragReason ? ` — ${clean(snapshot.ragReason)}` : ''}`,
    `**Period:** ${clean(snapshot.period?.start)} – ${clean(snapshot.period?.end)}`,
    `**Data as of:** ${clean(snapshot.asOf)}`,
    '',
  ].filter((line, index) => line || index > 0);
  if (snapshot.metrics?.length) {
    lines.push('| KPI | Result |', '| --- | --- |');
    for (const metric of snapshot.metrics)
      lines.push(`| ${clean(metric.label)} | ${clean(metric.value)} |`);
    lines.push('');
  }
  for (const section of snapshot.sections ?? []) {
    lines.push(`## ${clean(section.title || 'Section')}`, '');
    if (section.narrative) lines.push(clean(section.narrative), '');
    for (const bullet of section.bullets ?? []) lines.push(`- ${clean(bullet)}`);
    if (section.bullets?.length) lines.push('');
    const columns = section.table?.columns ?? [];
    const rows = section.table?.rows ?? [];
    if (columns.length && rows.length) {
      lines.push(`| ${columns.map((column) => clean(column.label)).join(' | ')} |`);
      lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
      for (const row of rows)
        lines.push(
          `| ${columns.map((column) => clean(row[String(column.id)] ?? '—')).join(' | ')} |`
        );
      lines.push('');
    }
    if (!section.narrative && !section.bullets?.length && !rows.length)
      lines.push(clean(section.empty || 'No data for this period.'), '');
  }
  return lines.join('\n');
}

export async function renderExecutionReportPdf(content: Record<string, unknown>): Promise<Buffer> {
  const snapshot = content as ExecutionSnapshot;
  return unifiedExportService.exportPdf({
    title: clean(snapshot.title || 'Execution report'),
    markdown: executionSnapshotMarkdown(snapshot),
    sourceLabel: 'Consultify · Execution',
  });
}
