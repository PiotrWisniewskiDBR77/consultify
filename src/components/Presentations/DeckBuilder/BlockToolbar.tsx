import { BarChart3, Image, LayoutGrid, Search, Share2, Type } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ToolbarPanel =
  | 'search'
  | 'basic'
  | 'images'
  | 'layouts'
  | 'diagrams'
  | 'charts'
  | null;

interface BlockToolbarProps {
  onInsertBlock?: (blockType: string, content?: Record<string, unknown>) => void;
  onOpenMediaLibrary?: () => void;
}

const TOOLBAR_ITEMS: { id: ToolbarPanel; icon: React.FC<{ size?: number }>; labelKey: string }[] = [
  { id: 'search', icon: Search, labelKey: 'presentations.builder.toolbar.search' },
  { id: 'basic', icon: Type, labelKey: 'presentations.builder.toolbar.basicBlocks' },
  { id: 'images', icon: Image, labelKey: 'presentations.builder.toolbar.images' },
  { id: 'layouts', icon: LayoutGrid, labelKey: 'presentations.builder.toolbar.smartLayouts' },
  { id: 'diagrams', icon: Share2, labelKey: 'presentations.builder.toolbar.diagrams' },
  { id: 'charts', icon: BarChart3, labelKey: 'presentations.builder.toolbar.chartsData' },
];

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  onInsertBlock,
  onOpenMediaLibrary,
}) => {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState<ToolbarPanel>(null);

  const togglePanel = (panel: ToolbarPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="flex flex-shrink-0">
      {/* Icon strip */}
      <div className="w-14 border-l border-c-border-subtle bg-c-surface flex flex-col items-center py-3 gap-1">
        {TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => togglePanel(item.id)}
              title={t(item.labelKey, item.id || '')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-c-accent-soft0 text-c-accent'
                  : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-secondary'
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Expanded Panel */}
      {activePanel && (
        <div className="w-64 border-l border-c-border-subtle bg-c-surface overflow-y-auto">
          <div className="p-3">
            <h3 className="text-sm font-semibold text-c-text mb-3">
              {t(TOOLBAR_ITEMS.find((i) => i.id === activePanel)?.labelKey || '', activePanel)}
            </h3>

            {activePanel === 'basic' && <BasicBlocksPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'images' && <ImagesPanel onOpenMediaLibrary={onOpenMediaLibrary} />}
            {activePanel === 'layouts' && <LayoutsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'diagrams' && <DiagramsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'charts' && <ChartsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'search' && <SearchPanel />}
          </div>
        </div>
      )}
    </div>
  );
};

const PanelButton: React.FC<{
  label: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, description, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={disabled ? 'Coming soon' : undefined}
    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-c-surface-raised'
    }`}
  >
    <p className="text-xs font-medium text-c-text">{label}</p>
    {description && <p className="text-[10px] text-c-text-secondary mt-0.5">{description}</p>}
  </button>
);

const BasicBlocksPanel: React.FC<{
  onInsertBlock?: (type: string, content?: Record<string, unknown>) => void;
}> = ({ onInsertBlock }) => {
  const { t } = useTranslation();
  const blocks = [
    { type: 'heading', label: t('presentations.builder.blocks.heading', 'Heading') },
    { type: 'paragraph', label: t('presentations.builder.blocks.paragraph', 'Paragraph') },
    { type: 'bullet_list', label: t('presentations.builder.blocks.bulletList', 'Bullet list') },
    {
      type: 'numbered_list',
      label: t('presentations.builder.blocks.numberedList', 'Numbered list'),
    },
    { type: 'table', label: t('presentations.builder.blocks.table', 'Table') },
    { type: 'callout', label: t('presentations.builder.blocks.callout', 'Callout') },
    { type: 'divider', label: t('presentations.builder.blocks.divider', 'Divider') },
  ];

  return (
    <div className="space-y-0.5">
      {blocks.map((b) => (
        <PanelButton key={b.type} label={b.label} onClick={() => onInsertBlock?.(b.type)} />
      ))}
    </div>
  );
};

const LayoutsPanel: React.FC<{
  onInsertBlock?: (type: string, content?: Record<string, unknown>) => void;
}> = ({ onInsertBlock }) => {
  const layouts = [
    { label: '2 Columns', type: 'smart_layout', content: { layoutType: '2col' } },
    { label: '3 Columns', type: 'smart_layout', content: { layoutType: '3col' } },
    { label: '4 Columns', type: 'smart_layout', content: { layoutType: '4col' } },
    { label: 'Boxes', type: 'smart_layout', content: { layoutType: 'boxes' } },
    { label: 'Cards', type: 'smart_layout', content: { layoutType: 'cards' } },
  ];

  return (
    <div className="space-y-0.5">
      {layouts.map((l, i) => (
        <PanelButton key={i} label={l.label} onClick={() => onInsertBlock?.(l.type, l.content)} />
      ))}
    </div>
  );
};

const DiagramsPanel: React.FC<{
  onInsertBlock?: (type: string, content?: Record<string, unknown>) => void;
}> = ({ onInsertBlock }) => {
  const diagrams = [
    { label: 'Process Steps', kind: 'process_steps' },
    { label: 'Funnel', kind: 'funnel' },
    { label: 'Timeline', kind: 'timeline_horizontal' },
    { label: 'Matrix 2x2', kind: 'matrix_2x2' },
    { label: 'SWOT', kind: 'swot' },
    { label: 'Pyramid', kind: 'pyramid' },
    { label: 'Venn (2)', kind: 'venn_2' },
    { label: 'Venn (3)', kind: 'venn_3' },
    { label: 'Cycle', kind: 'cycle' },
    { label: 'Now/Next/Later', kind: 'roadmap_now_next_later' },
    { label: 'Hierarchy', kind: 'org_hierarchy' },
    { label: 'Decision Tree', kind: 'decision_tree_light' },
  ];

  return (
    <div className="space-y-0.5">
      {diagrams.map((d) => (
        <PanelButton
          key={d.kind}
          label={d.label}
          onClick={() => onInsertBlock?.('smart_diagram', { diagram_kind: d.kind })}
        />
      ))}
    </div>
  );
};

const ChartsPanel: React.FC<{
  onInsertBlock?: (type: string, content?: Record<string, unknown>) => void;
}> = ({ onInsertBlock }) => {
  const charts = [
    { label: 'Bar Chart', chartType: 'bar' },
    { label: 'Line Chart', chartType: 'line' },
    { label: 'Pie Chart', chartType: 'pie' },
    { label: 'KPI Widget', type: 'kpi_widget' },
    { label: 'Metric Strip', type: 'metric_strip' },
  ];

  return (
    <div className="space-y-0.5">
      {charts.map((c, i) => (
        <PanelButton
          key={i}
          label={c.label}
          onClick={() =>
            onInsertBlock?.(c.type || 'chart', c.chartType ? { chartType: c.chartType } : {})
          }
        />
      ))}
    </div>
  );
};

const ImagesPanel: React.FC<{ onOpenMediaLibrary?: () => void }> = ({ onOpenMediaLibrary }) => (
  <div className="space-y-3">
    <div className="space-y-0.5">
      <PanelButton
        label="Organization Library"
        description="Browse your org images"
        onClick={() => onOpenMediaLibrary?.()}
      />
      {/* "AI Generate" and "Upload" buttons return in P2.2 */}
    </div>
  </div>
);

const SearchPanel: React.FC = () => (
  <div>
    <input
      type="text"
      placeholder="Search deck content..."
      className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface-raised text-sm"
    />
    <p className="text-[10px] text-c-text-secondary mt-2">Type to search across all cards</p>
  </div>
);

