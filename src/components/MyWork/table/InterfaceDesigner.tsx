import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';

interface InterfaceBlock {
  id: string;
  type:
    | 'table_grid'
    | 'record_detail'
    | 'chart'
    | 'text'
    | 'button'
    | 'filter'
    | 'search'
    | 'summary';
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

interface InterfaceDesignerProps {
  interfaceId: string;
  baseId: string;
  layout: { blocks: InterfaceBlock[]; theme?: Record<string, unknown> };
  tables: Array<{ id: string; name: string; fields: Array<{ id: string; name: string }> }>;
  onSave: (layout: { blocks: InterfaceBlock[]; theme?: Record<string, unknown> }) => void;
}

const BLOCK_TYPES = [
  {
    type: 'table_grid',
    labelKey: 'table.interfaceDesigner.blockTypes.tableGrid',
    labelDefault: 'Table Grid',
    icon: '📊',
  },
  {
    type: 'record_detail',
    labelKey: 'table.interfaceDesigner.blockTypes.recordDetail',
    labelDefault: 'Record Detail',
    icon: '📋',
  },
  {
    type: 'chart',
    labelKey: 'table.interfaceDesigner.blockTypes.chart',
    labelDefault: 'Chart',
    icon: '📈',
  },
  {
    type: 'text',
    labelKey: 'table.interfaceDesigner.blockTypes.textBlock',
    labelDefault: 'Text Block',
    icon: '📝',
  },
  {
    type: 'button',
    labelKey: 'table.interfaceDesigner.blockTypes.actionButton',
    labelDefault: 'Action Button',
    icon: '🔘',
  },
  {
    type: 'filter',
    labelKey: 'table.interfaceDesigner.blockTypes.filterControl',
    labelDefault: 'Filter Control',
    icon: '🔍',
  },
  {
    type: 'search',
    labelKey: 'table.interfaceDesigner.blockTypes.searchBar',
    labelDefault: 'Search Bar',
    icon: '🔎',
  },
  {
    type: 'summary',
    labelKey: 'table.interfaceDesigner.blockTypes.summaryCard',
    labelDefault: 'Summary Card',
    icon: '📊',
  },
] as const;

function getBlockTypeLabel(type: string): string {
  const bt = BLOCK_TYPES.find((b) => b.type === type);
  if (!bt) return type.replace(/_/g, ' ');
  return i18n.t(bt.labelKey, bt.labelDefault);
}

function getDefaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case 'table_grid':
      return { tableId: '', viewId: '', visibleFieldIds: [], maxRows: 50 };
    case 'record_detail':
      return { tableId: '', recordId: '', visibleFieldIds: [] };
    case 'chart':
      return { tableId: '', chartType: 'bar', xFieldId: '', yFieldId: '', aggregation: 'count' };
    case 'text':
      return {
        content: i18n.t('table.interfaceDesigner.defaults.textContent', 'Enter text here...'),
        fontSize: 14,
      };
    case 'button':
      return {
        label: i18n.t('table.interfaceDesigner.defaults.buttonLabel', 'Click me'),
        action: 'none',
        url: '',
      };
    case 'filter':
      return { tableId: '', fieldId: '' };
    case 'search':
      return {
        tableId: '',
        placeholder: i18n.t('table.interfaceDesigner.defaults.searchPlaceholder', 'Search...'),
      };
    case 'summary':
      return {
        tableId: '',
        fieldId: '',
        aggregation: 'count',
        label: i18n.t('table.interfaceDesigner.defaults.summaryLabel', 'Total'),
      };
    default:
      return {};
  }
}

const BlockPreview: React.FC<{
  block: InterfaceBlock;
  tables: InterfaceDesignerProps['tables'];
}> = ({ block, tables }) => {
  const { t } = useTranslation();
  switch (block.type) {
    case 'text':
      return (
        <p style={{ fontSize: (block.config.fontSize as number) || 14 }}>
          {String(block.config.content || '')}
        </p>
      );
    case 'table_grid': {
      const table = tables.find((t2) => t2.id === block.config.tableId);
      return (
        <div className="bg-c-surface-raised rounded p-3 text-sm text-c-text-muted">
          {table
            ? t('table.interfaceDesigner.preview.tableName', 'Table: {{name}}', {
                name: table.name,
              })
            : t('table.interfaceDesigner.preview.selectATable', 'Select a table')}
        </div>
      );
    }
    case 'chart':
      return (
        <div className="bg-c-surface-raised rounded p-6 text-center text-sm text-c-text-muted">
          {t('table.interfaceDesigner.preview.chart', 'Chart: {{type}}', {
            type: String(block.config.chartType || 'bar'),
          })}
        </div>
      );
    case 'button':
      return (
        <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
          {String(block.config.label || t('table.interfaceDesigner.preview.button', 'Button'))}
        </button>
      );
    case 'summary':
      return (
        <div className="bg-blue-50 rounded p-3">
          <span className="text-2xl font-bold text-blue-700">—</span>
          <br />
          <span className="text-xs text-c-text-muted">
            {String(block.config.label || t('table.interfaceDesigner.preview.summary', 'Summary'))}
          </span>
        </div>
      );
    case 'record_detail':
      return (
        <div className="bg-c-surface-raised rounded p-3 text-sm text-c-text-muted">
          {t('table.interfaceDesigner.preview.recordDetail', 'Record Detail')}
        </div>
      );
    case 'filter':
      return (
        <div className="bg-c-surface-raised rounded p-3 text-sm text-c-text-muted">
          {t('table.interfaceDesigner.preview.filterControl', 'Filter Control')}
        </div>
      );
    case 'search':
      return (
        <div className="bg-c-surface-raised rounded p-2">
          <input
            type="text"
            placeholder={String(
              block.config.placeholder ||
                t('table.interfaceDesigner.defaults.searchPlaceholder', 'Search...')
            )}
            className="w-full px-3 py-1.5 border rounded text-sm bg-c-surface"
            readOnly
          />
        </div>
      );
    default:
      return (
        <div className="bg-c-surface-raised rounded p-3 text-sm text-c-text-muted">
          {block.type}
        </div>
      );
  }
};

const BlockConfigPanel: React.FC<{
  block: InterfaceBlock;
  tables: InterfaceDesignerProps['tables'];
  onUpdate: (updates: Partial<InterfaceBlock>) => void;
}> = ({ block, tables, onUpdate }) => {
  const { t } = useTranslation();
  const updateConfig = (key: string, value: unknown) => {
    onUpdate({ config: { ...block.config, [key]: value } });
  };

  const hasTableSelector = [
    'table_grid',
    'record_detail',
    'chart',
    'filter',
    'search',
    'summary',
  ].includes(block.type);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-c-text">
        {t('table.interfaceDesigner.config.heading', '{{type}} Config', {
          type: getBlockTypeLabel(block.type),
        })}
      </h3>

      {hasTableSelector && (
        <div>
          <label className="text-xs text-c-text-muted">
            {t('table.interfaceDesigner.config.table', 'Table')}
          </label>
          <select
            value={String(block.config.tableId || '')}
            onChange={(e) => updateConfig('tableId', e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          >
            <option value="">
              {t('table.interfaceDesigner.config.selectTable', 'Select table...')}
            </option>
            {tables.map((tbl) => (
              <option key={tbl.id} value={tbl.id}>
                {tbl.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {block.type === 'text' && (
        <>
          <div>
            <label className="text-xs text-c-text-muted">
              {t('table.interfaceDesigner.config.content', 'Content')}
            </label>
            <textarea
              value={String(block.config.content || '')}
              onChange={(e) => updateConfig('content', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs text-c-text-muted">
              {t('table.interfaceDesigner.config.fontSize', 'Font Size')}
            </label>
            <input
              type="number"
              value={Number(block.config.fontSize || 14)}
              onChange={(e) => updateConfig('fontSize', Number(e.target.value))}
              className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
            />
          </div>
        </>
      )}

      {block.type === 'chart' && (
        <div>
          <label className="text-xs text-c-text-muted">
            {t('table.interfaceDesigner.config.chartType', 'Chart Type')}
          </label>
          <select
            value={String(block.config.chartType || 'bar')}
            onChange={(e) => updateConfig('chartType', e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          >
            <option value="bar">{t('table.interfaceDesigner.config.bar', 'Bar')}</option>
            <option value="line">{t('table.interfaceDesigner.config.line', 'Line')}</option>
            <option value="pie">{t('table.interfaceDesigner.config.pie', 'Pie')}</option>
            <option value="donut">{t('table.interfaceDesigner.config.donut', 'Donut')}</option>
          </select>
        </div>
      )}

      {block.type === 'button' && (
        <div>
          <label className="text-xs text-c-text-muted">
            {t('table.interfaceDesigner.config.label', 'Label')}
          </label>
          <input
            type="text"
            value={String(block.config.label || '')}
            onChange={(e) => updateConfig('label', e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          />
        </div>
      )}

      {block.type === 'summary' && (
        <>
          <div>
            <label className="text-xs text-c-text-muted">
              {t('table.interfaceDesigner.config.label', 'Label')}
            </label>
            <input
              type="text"
              value={String(block.config.label || '')}
              onChange={(e) => updateConfig('label', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-c-text-muted">
              {t('table.interfaceDesigner.config.aggregation', 'Aggregation')}
            </label>
            <select
              value={String(block.config.aggregation || 'count')}
              onChange={(e) => updateConfig('aggregation', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
            >
              <option value="count">{t('table.interfaceDesigner.config.count', 'Count')}</option>
              <option value="sum">{t('table.interfaceDesigner.config.sum', 'Sum')}</option>
              <option value="avg">{t('table.interfaceDesigner.config.average', 'Average')}</option>
              <option value="min">{t('table.interfaceDesigner.config.min', 'Min')}</option>
              <option value="max">{t('table.interfaceDesigner.config.max', 'Max')}</option>
            </select>
          </div>
        </>
      )}

      {block.type === 'search' && (
        <div>
          <label className="text-xs text-c-text-muted">
            {t('table.interfaceDesigner.config.placeholder', 'Placeholder')}
          </label>
          <input
            type="text"
            value={String(block.config.placeholder || '')}
            onChange={(e) => updateConfig('placeholder', e.target.value)}
            className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
          />
        </div>
      )}
    </div>
  );
};

export const InterfaceDesigner: React.FC<InterfaceDesignerProps> = ({ layout, tables, onSave }) => {
  const { t } = useTranslation();
  const [blocks, setBlocks] = useState<InterfaceBlock[]>(layout.blocks);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addBlock = useCallback(
    (type: InterfaceBlock['type']) => {
      const newBlock: InterfaceBlock = {
        id: crypto.randomUUID(),
        type,
        config: getDefaultConfig(type),
        position: { x: 0, y: blocks.length * 4, w: 12, h: 4 },
      };
      setBlocks((prev) => [...prev, newBlock]);
    },
    [blocks.length]
  );

  const updateBlock = useCallback((blockId: string, updates: Partial<InterfaceBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b)));
  }, []);

  const removeBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setSelectedBlock((prev) => (prev === blockId ? null : prev));
  }, []);

  const handleSave = () => {
    onSave({ blocks, theme: layout.theme });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setBlocks((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex h-full">
      {/* Left: Block palette */}
      <div className="w-60 border-r bg-c-surface-raised p-4 flex flex-col gap-2 shrink-0">
        <h3 className="text-sm font-semibold text-c-text mb-2">
          {t('table.interfaceDesigner.addBlock', 'Add Block')}
        </h3>
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => addBlock(bt.type as InterfaceBlock['type'])}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-blue-50 text-left transition-colors"
          >
            <span>{bt.icon}</span>
            <span>{t(bt.labelKey, bt.labelDefault)}</span>
          </button>
        ))}
        <div className="mt-auto pt-4">
          <button
            onClick={handleSave}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('table.interfaceDesigner.saveLayout', 'Save Layout')}
          </button>
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 p-6 overflow-auto bg-c-surface min-w-0">
        <div className="max-w-4xl mx-auto space-y-4">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedBlock === block.id
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-c-border-subtle hover:border-c-border-subtle'
              } ${draggedIndex === index ? 'opacity-50' : ''}`}
              onClick={() => setSelectedBlock(block.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="cursor-grab text-c-text-secondary hover:text-c-text-secondary"
                    title={t('table.interfaceDesigner.dragToReorder', 'Drag to reorder')}
                  >
                    ⋮⋮
                  </span>
                  <span className="text-xs font-medium text-c-text-muted uppercase">
                    {getBlockTypeLabel(block.type)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBlock(block.id);
                  }}
                  className="text-c-text-secondary hover:text-danger-500 text-sm transition-colors"
                >
                  ×
                </button>
              </div>
              <BlockPreview block={block} tables={tables} />
            </div>
          ))}
          {blocks.length === 0 && (
            <div className="text-center py-20 text-c-text-secondary">
              <p className="text-lg">
                {t('table.interfaceDesigner.emptyTitle', 'Empty interface')}
              </p>
              <p className="text-sm mt-1">
                {t(
                  'table.interfaceDesigner.emptyBody',
                  'Add blocks from the left panel to build your interface'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Config panel */}
      {selectedBlock && blocks.find((b) => b.id === selectedBlock) && (
        <div className="w-72 border-l bg-c-surface-raised p-4 shrink-0 overflow-y-auto">
          <BlockConfigPanel
            block={blocks.find((b) => b.id === selectedBlock)!}
            tables={tables}
            onUpdate={(updates) => updateBlock(selectedBlock, updates)}
          />
        </div>
      )}
    </div>
  );
};

export default InterfaceDesigner;
