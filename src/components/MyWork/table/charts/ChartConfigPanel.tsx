import React from 'react';

type ChartType = 'bar' | 'line' | 'pie' | 'donut';
type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ChartConfig {
  chartType: ChartType;
  xFieldId: string;
  yFieldId?: string;
  aggregation: Aggregation;
  title?: string;
}

interface ChartConfigPanelProps {
  config: ChartConfig;
  fields: Array<{ id: string; name: string; type: string }>;
  onChange: (config: ChartConfig) => void;
}

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
];

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const NUMERIC_TYPES = new Set(['number', 'currency', 'rating', 'progress']);

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({ config, fields, onChange }) => {
  const numericFields = fields.filter((f) => NUMERIC_TYPES.has(f.type));

  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-c-text-muted">Title</label>
        <input
          type="text"
          value={config.title || ''}
          onChange={(e) => update('title', e.target.value || undefined)}
          placeholder="Chart title..."
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">Chart Type</label>
        <div className="grid grid-cols-4 gap-1 mt-1">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => update('chartType', ct.value)}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                config.chartType === ct.value
                  ? 'bg-c-info text-c-text border-c-info'
                  : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:border-c-info'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">X-Axis Field</label>
        <select
          value={config.xFieldId}
          onChange={(e) => update('xFieldId', e.target.value)}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        >
          <option value="">Select field...</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">
          Y-Axis Field <span className="text-c-text-secondary">(numeric, optional)</span>
        </label>
        <select
          value={config.yFieldId || ''}
          onChange={(e) => update('yFieldId', e.target.value || undefined)}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        >
          <option value="">None (count only)</option>
          {numericFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">Aggregation</label>
        <select
          value={config.aggregation}
          onChange={(e) => update('aggregation', e.target.value as Aggregation)}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        >
          {AGGREGATIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ChartConfigPanel;
