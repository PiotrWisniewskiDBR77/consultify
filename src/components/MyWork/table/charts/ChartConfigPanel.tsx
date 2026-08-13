import React from 'react';
import { useTranslation } from 'react-i18next';

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

const NUMERIC_TYPES = new Set(['number', 'currency', 'rating', 'progress']);

export const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({ config, fields, onChange }) => {
  const { t } = useTranslation();
  const numericFields = fields.filter((f) => NUMERIC_TYPES.has(f.type));

  const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
    { value: 'bar', label: t('myWorkTable.chartConfigPanel.chartTypeBar', 'Bar') },
    { value: 'line', label: t('myWorkTable.chartConfigPanel.chartTypeLine', 'Line') },
    { value: 'pie', label: t('myWorkTable.chartConfigPanel.chartTypePie', 'Pie') },
    { value: 'donut', label: t('myWorkTable.chartConfigPanel.chartTypeDonut', 'Donut') },
  ];

  const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
    { value: 'count', label: t('myWorkTable.chartConfigPanel.aggCount', 'Count') },
    { value: 'sum', label: t('myWorkTable.chartConfigPanel.aggSum', 'Sum') },
    { value: 'avg', label: t('myWorkTable.chartConfigPanel.aggAverage', 'Average') },
    { value: 'min', label: t('myWorkTable.chartConfigPanel.aggMin', 'Min') },
    { value: 'max', label: t('myWorkTable.chartConfigPanel.aggMax', 'Max') },
  ];

  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-c-text-muted">
          {t('myWorkTable.chartConfigPanel.title', 'Title')}
        </label>
        <input
          type="text"
          value={config.title || ''}
          onChange={(e) => update('title', e.target.value || undefined)}
          placeholder={t('myWorkTable.chartConfigPanel.titlePlaceholder', 'Chart title...')}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">
          {t('myWorkTable.chartConfigPanel.chartType', 'Chart Type')}
        </label>
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
        <label className="text-xs font-medium text-c-text-muted">
          {t('myWorkTable.chartConfigPanel.xAxisField', 'X-Axis Field')}
        </label>
        <select
          value={config.xFieldId}
          onChange={(e) => update('xFieldId', e.target.value)}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        >
          <option value="">{t('myWorkTable.chartConfigPanel.selectField', 'Select field...')}</option>
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">
          {t('myWorkTable.chartConfigPanel.yAxisField', 'Y-Axis Field')}{' '}
          <span className="text-c-text-secondary">
            {t('myWorkTable.chartConfigPanel.yAxisFieldHint', '(numeric, optional)')}
          </span>
        </label>
        <select
          value={config.yFieldId || ''}
          onChange={(e) => update('yFieldId', e.target.value || undefined)}
          className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
        >
          <option value="">{t('myWorkTable.chartConfigPanel.noneCountOnly', 'None (count only)')}</option>
          {numericFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-c-text-muted">
          {t('myWorkTable.chartConfigPanel.aggregation', 'Aggregation')}
        </label>
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
