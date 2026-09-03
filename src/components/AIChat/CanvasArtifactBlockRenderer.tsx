import { Copy, Download, Search } from 'lucide-react';
import React from 'react';

import type { CanvasArtifactBlock } from '@/types/canvasWorkspace';

import { CanvasMarkdownRenderer } from './CanvasMarkdownRenderer';

interface CanvasArtifactBlockRendererProps {
  block: CanvasArtifactBlock;
  onFeedback?: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function tableShape(block: CanvasArtifactBlock): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  const data = isRecord(block.data) ? block.data : {};
  const rawRows = Array.isArray(data.rows) ? data.rows : [];
  const columns = Array.isArray(data.columns)
    ? data.columns.map((column) =>
        isRecord(column)
          ? text(column.label, text(column.name, text(column.id, 'Column')))
          : String(column)
      )
    : rawRows.length > 0 && isRecord(rawRows[0])
      ? Object.keys(rawRows[0])
      : [];
  const rows = rawRows.map((row) => (isRecord(row) ? row : { Item: row }));
  return { columns: columns.length > 0 ? columns : ['Item'], rows };
}

function chartShape(block: CanvasArtifactBlock): Array<{ label: string; value: number }> {
  const data = isRecord(block.data) ? block.data : {};
  const rawMetrics = Array.isArray(data.metrics)
    ? data.metrics
    : Array.isArray(data.series)
      ? data.series
      : [];
  return rawMetrics
    .map((metric, index) => {
      if (!isRecord(metric)) return { label: `Metric ${index + 1}`, value: Number(metric) || 0 };
      return {
        label: text(metric.label, text(metric.name, `Metric ${index + 1}`)),
        value: Number(metric.value ?? metric.y ?? metric.count ?? 0) || 0,
      };
    })
    .filter((metric) => Number.isFinite(metric.value));
}

function chartSpecShape(block: CanvasArtifactBlock): Record<string, unknown> | null {
  const data = isRecord(block.data) ? block.data : {};
  const spec = isRecord(data.vegaLiteSpec)
    ? data.vegaLiteSpec
    : isRecord(data.spec)
      ? data.spec
      : null;
  if (!spec) return null;
  return spec.mark || spec.encoding || spec.data ? spec : null;
}

function diagramShape(block: CanvasArtifactBlock): {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
} {
  const data = isRecord(block.data) ? block.data : {};
  const nodes = Array.isArray(data.nodes)
    ? data.nodes.map((node, index) => {
        const record = isRecord(node) ? node : {};
        return {
          id: text(record.id, `node-${index + 1}`),
          label: text(record.label, text(record.title, String(node))),
        };
      })
    : [];
  const edges = Array.isArray(data.edges)
    ? data.edges
        .map((edge) => {
          const record = isRecord(edge) ? edge : {};
          const from = text(record.from, text(record.source, ''));
          const to = text(record.to, text(record.target, ''));
          return from && to ? { from, to, label: text(record.label, '') } : null;
        })
        .filter((edge): edge is { from: string; to: string; label: string } => edge !== null)
    : [];
  return { nodes, edges };
}

function mermaidSource(block: CanvasArtifactBlock): string {
  const data = isRecord(block.data) ? block.data : {};
  const source = text(data.mermaid, text(data.mermaidSource, text(data.source, '')));
  if (!source) return '';
  if (/<\s*script|javascript:|<\s*iframe/i.test(source)) return '';
  return source;
}

function arrayFrom(data: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(data[key]) ? data[key] : [];
}

function provenanceLabel(block: CanvasArtifactBlock): string {
  const source = block.provenance?.source || 'user';
  const conversation = block.provenance?.conversationId
    ? ` · ${block.provenance.conversationId}`
    : '';
  return `${source}${conversation}`;
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(title: string, extension: string): string {
  const base = title
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'canvas-artifact'}.${extension}`;
}

export function CanvasArtifactBlockRenderer({
  block,
  onFeedback,
}: CanvasArtifactBlockRendererProps) {
  const [filter, setFilter] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(() => new Set());

  const copyProjection = async () => {
    await navigator.clipboard?.writeText(block.markdownProjection);
    onFeedback?.(`${block.title} copied as Markdown.`);
  };

  const downloadCsv = () => {
    const { columns, rows } = tableShape(block);
    const csv = [
      columns.join(','),
      ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${block.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'canvas-table'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    onFeedback?.(`${block.title} exported as CSV.`);
  };

  if (block.markdownProjectionStatus === 'failed' || block.markdownProjectionStatus === 'missing') {
    return (
      <section
        className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
        data-testid={`canvas-artifact-block-${block.id}`}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.18em]">Renderer fallback</div>
        <h3 className="mt-2 text-lg font-semibold">{block.title}</h3>
        <p className="mt-2">
          {block.projectionError || 'This block does not have a healthy Markdown projection yet.'}
        </p>
        <div className="mt-4 rounded-xl bg-white/70 p-4 dark:bg-black/20">
          <CanvasMarkdownRenderer text={block.markdownProjection || `### ${block.title}`} />
        </div>
      </section>
    );
  }

  if (block.kind === 'table') {
    const { columns, rows } = tableShape(block);
    const rowKey = (row: Record<string, unknown>, index: number) =>
      `${index}:${columns.map((column) => String(row[column] ?? '')).join('::')}`;
    const filteredRows = rows
      .map((row, index) => ({ row, index, key: rowKey(row, index) }))
      .filter(({ row }) =>
        filter
          ? columns.some((column) =>
              String(row[column] ?? '')
                .toLowerCase()
                .includes(filter.toLowerCase())
            )
          : true
      )
      .sort((a, b) => {
        if (!sortColumn) return 0;
        const left = String(a.row[sortColumn] ?? '');
        const right = String(b.row[sortColumn] ?? '');
        const result = left.localeCompare(right);
        return sortDirection === 'asc' ? result : -result;
      });
    const exportRows = (rowEntries: Array<{ row: Record<string, unknown> }>, suffix: string) => {
      const csv = [
        columns.join(','),
        ...rowEntries.map((entry) =>
          columns.map((column) => escapeCsvCell(entry.row[column])).join(',')
        ),
      ].join('\n');
      downloadTextFile(
        safeFilename(`${block.title}-${suffix}`, 'csv'),
        csv,
        'text/csv;charset=utf-8'
      );
      onFeedback?.(
        `${block.title} ${suffix === 'selected' ? 'selected rows' : 'rows'} exported as CSV.`
      );
    };

    return (
      <section
        className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
        data-testid={`canvas-artifact-block-${block.id}`}
      >
        <BlockHeader block={block} onCopy={copyProjection} onExport={downloadCsv} />
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-navy-950/40">
          <label className="flex min-w-[220px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            <Search size={14} />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter rows"
              className="min-w-0 flex-1 bg-transparent outline-none"
              aria-label={`Filter ${block.title}`}
            />
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {filteredRows.length} rows · {selectedRows.size} selected
          </span>
          <button
            type="button"
            onClick={() => exportRows(filteredRows, 'filtered')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            Export filtered
          </button>
          <button
            type="button"
            onClick={() => {
              const selected = filteredRows.filter((entry) => selectedRows.has(entry.key));
              exportRows(selected.length > 0 ? selected : filteredRows, 'selected');
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            Export selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedRows(new Set())}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            Clear selection
          </button>
        </div>
        <div className="overflow-x-auto">
          <table
            /* §27-exempt: renderer artefaktu AI/markdown read-only, poza zakresem 1.2 */ className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10"
          >
            <thead>
              <tr>
                <th className="w-10 bg-slate-100 px-3 py-3 dark:bg-white/[0.04]" />
                {columns.map((column) => (
                  <th
                    key={column}
                    className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 dark:bg-white/[0.04] dark:text-slate-200"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-c-text"
                      onClick={() => {
                        setSortColumn((current) => {
                          if (current === column) {
                            setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
                            return current;
                          }
                          setSortDirection('asc');
                          return column;
                        });
                      }}
                    >
                      {column}
                      {sortColumn === column ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-white/10 dark:bg-navy-900">
              {filteredRows.map((entry) => (
                <tr key={`${block.id}-${entry.key}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${entry.index + 1}`}
                      checked={selectedRows.has(entry.key)}
                      onChange={(event) => {
                        setSelectedRows((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(entry.key);
                          else next.delete(entry.key);
                          return next;
                        });
                      }}
                    />
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="px-4 py-3 align-top text-slate-700 dark:text-slate-300"
                    >
                      {String(entry.row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (block.kind === 'chart') {
    return <ChartBlockView block={block} onCopy={copyProjection} />;
  }

  if (block.kind === 'diagram') {
    return <DiagramBlockView block={block} onCopy={copyProjection} onFeedback={onFeedback} />;
  }

  if (block.kind === 'research') {
    const data = isRecord(block.data) ? block.data : {};
    const confidence = text(data.confidence, 'unknown');
    const sources = arrayFrom(data, 'sources');
    const findings = arrayFrom(data, 'findings');
    const facts = arrayFrom(data, 'facts');
    const contradictions = arrayFrom(data, 'contradictions');
    const gaps = arrayFrom(data, 'gaps');
    const recommendations = arrayFrom(data, 'recommendations');
    return (
      <section
        className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
        data-testid={`canvas-artifact-block-${block.id}`}
      >
        <BlockHeader block={block} onCopy={copyProjection} />
        <div className="mt-4 rounded-2xl border border-c-border bg-c-surface-raised p-4 dark:border-c-border dark:bg-c-surface-raised">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:text-c-text-secondary">
            Research question
          </div>
          <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
            {text(data.question, text(data.researchQuestion, 'Question not specified'))}
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            Confidence: <strong>{confidence}</strong>
          </div>
          {sources.length === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100">
              Evidence degraded: no sources are attached to this research block yet.
            </div>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EvidenceList title="Findings" items={[...facts, ...findings]} />
          <EvidenceList title="Sources" items={sources} />
          <EvidenceList title="Limitations / contradictions" items={contradictions} />
          <EvidenceList title="Gaps" items={gaps} />
          <EvidenceList title="Recommendations" items={recommendations} className="md:col-span-2" />
        </div>
      </section>
    );
  }

  if (block.kind === 'decision') {
    const data = isRecord(block.data) ? block.data : {};
    const options = arrayFrom(data, 'options');
    const criteria = arrayFrom(data, 'criteria');
    const risks = arrayFrom(data, 'risks');
    const assumptions = arrayFrom(data, 'assumptions');
    return (
      <section
        className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
        data-testid={`canvas-artifact-block-${block.id}`}
      >
        <BlockHeader block={block} onCopy={copyProjection} />
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            Recommendation
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {text(data.recommendation, 'Recommendation not set')}
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            Approval status: <strong>{text(data.approvalStatus, 'draft')}</strong>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EvidenceList title="Options" items={options} />
          <EvidenceList title="Criteria" items={criteria} />
          <EvidenceList title="Risks" items={risks} />
          <EvidenceList title="Assumptions" items={assumptions} />
        </div>
      </section>
    );
  }

  if (block.kind === 'dashboard') {
    const data = isRecord(block.data) ? block.data : {};
    const kpis = arrayFrom(data, 'kpis');
    const charts = arrayFrom(data, 'charts');
    const insights = arrayFrom(data, 'insights');
    const actions = arrayFrom(data, 'recommendedActions');
    const limitations = arrayFrom(data, 'limitations');
    return (
      <section
        className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
        data-testid={`canvas-artifact-block-${block.id}`}
      >
        <BlockHeader block={block} onCopy={copyProjection} />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {kpis.map((kpi, index) => {
            const record = isRecord(kpi) ? kpi : {};
            return (
              <div
                key={`kpi-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {text(record.label, `KPI ${index + 1}`)}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {String(record.value ?? '')}
                </div>
              </div>
            );
          })}
        </div>
        {charts.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {charts.map((chart, index) => {
              const record = isRecord(chart) ? chart : {};
              const metrics = Array.isArray(record.metrics) ? record.metrics : [];
              const normalized = metrics
                .map((metric, metricIndex) => {
                  const item = isRecord(metric) ? metric : {};
                  return {
                    label: text(item.label, `Metric ${metricIndex + 1}`),
                    value: Number(item.value ?? 0) || 0,
                  };
                })
                .filter((metric) => Number.isFinite(metric.value));
              const max = Math.max(...normalized.map((metric) => metric.value), 1);
              return (
                <div
                  key={`dashboard-chart-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {text(record.title, `Chart ${index + 1}`)}
                  </div>
                  <div className="mt-4 space-y-3">
                    {normalized.map((metric) => (
                      <div key={metric.label}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                          <span>{metric.label}</span>
                          <strong>{metric.value}</strong>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-2 rounded-full bg-navy-900"
                            style={{ width: `${Math.max(6, (metric.value / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <EvidenceList title="Narrative insights" items={insights} />
          <EvidenceList title="Recommended actions" items={actions} />
          <EvidenceList title="Data limitations" items={limitations} className="md:col-span-2" />
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8" data-testid={`canvas-artifact-block-${block.id}`}>
      <CanvasMarkdownRenderer text={block.markdownProjection} />
    </section>
  );
}

function ChartBlockView({
  block,
  onCopy,
}: {
  block: CanvasArtifactBlock;
  onCopy: () => Promise<void>;
}) {
  const metrics = chartShape(block);
  const spec = React.useMemo(() => chartSpecShape(block), [block]);
  const data = isRecord(block.data) ? block.data : {};
  const insight = text(data.insight, text(data.summary, ''));
  const max = Math.max(...metrics.map((metric) => metric.value), 1);
  const chartRef = React.useRef<HTMLDivElement | null>(null);
  const [vegaStatus, setVegaStatus] = React.useState<'idle' | 'rendering' | 'rendered' | 'failed'>(
    spec ? 'rendering' : 'idle'
  );
  const [vegaError, setVegaError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!spec || !chartRef.current) {
      setVegaStatus(spec ? 'rendering' : 'idle');
      return undefined;
    }

    setVegaStatus('rendering');
    setVegaError(null);
    void import('vega-embed')
      .then(async (module) => {
        if (!chartRef.current) return;
        const embed = module.default as any;
        await embed(chartRef.current, spec, { actions: false, renderer: 'svg' });
        if (!cancelled) setVegaStatus('rendered');
      })
      .catch((error) => {
        if (!cancelled) {
          setVegaStatus('failed');
          setVegaError(error instanceof Error ? error.message : 'Vega-Lite render failed');
        }
      });

    return () => {
      cancelled = true;
      if (chartRef.current) chartRef.current.innerHTML = '';
    };
  }, [block.id, spec]);

  return (
    <section
      className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
      data-testid={`canvas-artifact-block-${block.id}`}
      data-renderer={spec ? 'vega-lite-compatible' : 'fallback-bar-chart'}
    >
      <BlockHeader block={block} onCopy={onCopy} />
      {spec ? (
        <div className="mt-4 rounded-2xl border border-c-border bg-c-surface-raised p-4 text-sm text-c-text-secondary dark:border-c-border dark:bg-c-surface-raised dark:text-c-text-secondary">
          <div className="text-xs font-semibold uppercase tracking-[0.16em]">Vega-Lite runtime</div>
          <div className="mt-2">Status: {vegaStatus}</div>
          <div className="mt-2 text-xs opacity-80">
            Mark: {String(spec.mark || 'not specified')} · Encoding fields:{' '}
            {isRecord(spec.encoding) ? Object.keys(spec.encoding).join(', ') || 'none' : 'none'}
          </div>
          <div
            ref={chartRef}
            className="mt-4 overflow-auto rounded-xl bg-white p-3 text-slate-900"
            data-testid={`canvas-vega-render-${block.id}`}
          />
          {vegaError ? (
            <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
              Vega render failed: {vegaError}. Fallback chart remains visible.
            </div>
          ) : null}
        </div>
      ) : null}
      {insight ? (
        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 dark:bg-navy-900 dark:text-slate-300">
          {insight}
        </div>
      ) : null}
      {metrics.length > 0 ? (
        <div className="mt-5 space-y-3" data-testid={`canvas-chart-fallback-${block.id}`}>
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-3 rounded-full bg-navy-900"
                  style={{ width: `${Math.max(6, (metric.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          No chart metrics are available. Showing the Markdown projection instead.
          <div className="mt-3 rounded-lg bg-white/70 p-3 dark:bg-black/20">
            <CanvasMarkdownRenderer text={block.markdownProjection || `### ${block.title}`} />
          </div>
        </div>
      )}
    </section>
  );
}

function DiagramBlockView({
  block,
  onCopy,
  onFeedback,
}: {
  block: CanvasArtifactBlock;
  onCopy: () => Promise<void>;
  onFeedback?: (message: string) => void;
}) {
  const { nodes, edges } = diagramShape(block);
  const source = mermaidSource(block);
  const [renderedSvg, setRenderedSvg] = React.useState<string | null>(null);
  const [renderError, setRenderError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRenderedSvg(null);
    setRenderError(null);
    if (!source) return undefined;

    void import('mermaid')
      .then(async (module) => {
        const mermaid = module.default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const result = await mermaid.render(`canvas-diagram-${block.id}`, source);
        if (!cancelled) setRenderedSvg(result.svg);
      })
      .catch((error) => {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : 'Diagram rendering failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [block.id, source]);

  const copySource = async () => {
    await navigator.clipboard?.writeText(source || block.markdownProjection);
    onFeedback?.(`${block.title} diagram source copied.`);
  };

  const exportDiagram = () => {
    if (renderedSvg) {
      downloadTextFile(
        safeFilename(block.title, 'svg'),
        renderedSvg,
        'image/svg+xml;charset=utf-8'
      );
      onFeedback?.(`${block.title} exported as SVG.`);
      return;
    }
    downloadTextFile(
      safeFilename(block.title, source ? 'mmd' : 'md'),
      source || block.markdownProjection,
      'text/plain;charset=utf-8'
    );
    onFeedback?.(`${block.title} diagram source exported.`);
  };

  return (
    <section
      className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-white/10 dark:bg-white/[0.03]"
      data-testid={`canvas-artifact-block-${block.id}`}
      data-renderer={source && !renderError ? 'mermaid' : 'node-edge-fallback'}
    >
      <BlockHeader block={block} onCopy={onCopy} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copySource()}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
        >
          Copy source
        </button>
        <button
          type="button"
          onClick={exportDiagram}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
        >
          Export diagram
        </button>
      </div>
      {source ? (
        <div className="mt-4 rounded-2xl border border-c-border bg-c-surface-raised p-4 dark:border-c-border dark:bg-c-surface-raised">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:text-c-text-secondary">
            Mermaid diagram source
          </div>
          {renderedSvg ? (
            <div
              className="mt-4 overflow-auto rounded-xl bg-white p-4 dark:bg-white"
              data-testid={`canvas-mermaid-render-${block.id}`}
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
          ) : (
            <div className="mt-2 text-sm text-c-text-secondary dark:text-c-text-secondary">
              {renderError
                ? `Mermaid render failed: ${renderError}. Fallback view is shown below.`
                : 'Rendering Mermaid diagram...'}
            </div>
          )}
        </div>
      ) : null}
      <div
        className="mt-5 grid gap-3 md:grid-cols-2"
        data-testid={`canvas-diagram-fallback-${block.id}`}
      >
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Nodes
          </div>
          <div className="space-y-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
              >
                {node.label}
              </div>
            ))}
            {nodes.length === 0 ? (
              <div className="text-sm text-slate-500">No nodes defined.</div>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Flow
          </div>
          <div className="space-y-2">
            {edges.map((edge, index) => (
              <div
                key={`${edge.from}-${edge.to}-${index}`}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
              >
                {edge.from} → {edge.to}
                {edge.label ? <span className="text-slate-500"> · {edge.label}</span> : null}
              </div>
            ))}
            {edges.length === 0 ? (
              <div className="text-sm text-slate-500">No connections defined yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceList({
  title,
  items,
  className = '',
}: {
  title: string;
  items: unknown[];
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-navy-900 ${className}`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {items.map((item, index) => {
            const record = isRecord(item) ? item : null;
            const label = record
              ? text(
                  record.label,
                  text(record.title, text(record.claim, text(record.source, String(item))))
                )
              : String(item);
            const score = record?.score === undefined ? '' : ` · score ${String(record.score)}`;
            return <li key={`${title}-${index}`}>{`${label}${score}`}</li>;
          })}
        </ul>
      ) : (
        <div className="mt-3 text-sm text-slate-500">Not specified yet.</div>
      )}
    </div>
  );
}

function BlockHeader({
  block,
  onCopy,
  onExport,
}: {
  block: CanvasArtifactBlock;
  onCopy: () => void;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-1">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-text-secondary dark:text-c-text-secondary">
          {block.kind} block
        </div>
        <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{block.title}</h3>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {block.status} · projection {block.markdownProjectionStatus} · {provenanceLabel(block)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Copy size={13} />
          Copy
        </button>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <Download size={13} />
            CSV
          </button>
        ) : null}
      </div>
    </div>
  );
}
