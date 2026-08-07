export interface EditableMetricStripItem {
  label: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat' | 'stable';
  change?: string;
}

const TRENDS = new Set<EditableMetricStripItem['trend']>(['up', 'down', 'flat', 'stable']);

export function serializeMetricStrip(metrics: unknown): string {
  if (!Array.isArray(metrics)) return '';
  return metrics
    .map((metric) => {
      if (!metric || typeof metric !== 'object') return '';
      const item = metric as Record<string, unknown>;
      return [item.label, item.value, item.unit, item.trend, item.change]
        .map((value) => String(value ?? '').trim())
        .join(' | ')
        .replace(/(?:\s*\|\s*)+$/, '');
    })
    .filter(Boolean)
    .join('\n');
}

export function parseMetricStrip(value: string): EditableMetricStripItem[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = '', metricValue = '', unit = '', rawTrend = '', change = ''] = line
        .split('|')
        .map((part) => part.trim());
      const trend = rawTrend.toLowerCase() as EditableMetricStripItem['trend'];
      return {
        label: label || 'Metric',
        value: metricValue,
        ...(unit ? { unit } : {}),
        ...(TRENDS.has(trend) ? { trend } : {}),
        ...(change ? { change } : {}),
      };
    });
}
