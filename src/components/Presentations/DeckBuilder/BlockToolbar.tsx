import { BarChart3, Image, LayoutGrid, Redo2, Search, Share2, Type, Undo2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CardBlock, DeckCard } from '../wizard/types';
import type { HorizontalAlignment, VerticalAlignment } from './geometryOps';
import { parseMetricStrip, serializeMetricStrip } from './metricStripEditor';

type ToolbarPanel = 'search' | 'basic' | 'images' | 'layouts' | 'diagrams' | 'charts' | null;

interface BlockToolbarProps {
  onInsertBlock?: (blockType: string, content?: Record<string, unknown>) => void;
  onOpenMediaLibrary?: () => void;
  /**
   * P2.2 — "AI Generate" in the Images panel. Reuses the existing R4
   * per-slide rewrite mechanism (regenerateSlide) with an image-focused
   * instruction rather than building a new generation pipeline.
   */
  onGenerateAiImage?: () => void;
  /** True while an AI image-generation rewrite is in flight. */
  isGeneratingAiImage?: boolean;
  /**
   * P2.2 — "Upload" in the Images panel. Opens the same Media Library
   * panel, which already has a real file-upload flow built in.
   */
  onUpload?: () => void;
  cards?: DeckCard[];
  selectedBlock?: CardBlock | null;
  selectedBlocks?: CardBlock[];
  onSelectedBlockUpdate?: (updates: Partial<CardBlock>) => void;
  onSelectCard?: (index: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  onAlign?: (alignment: HorizontalAlignment | VerticalAlignment) => void;
  onDistribute?: (axis: 'horizontal' | 'vertical') => void;
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
  onGenerateAiImage,
  isGeneratingAiImage,
  onUpload,
  cards = [],
  selectedBlock,
  selectedBlocks = [],
  onSelectedBlockUpdate,
  onSelectCard,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute,
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
        <button
          aria-label="Cofnij"
          title="Cofnij (⌘Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-30"
        >
          <Undo2 size={18} />
        </button>
        <button
          aria-label="Ponów"
          title="Ponów (⇧⌘Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-30"
        >
          <Redo2 size={18} />
        </button>
        {TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => togglePanel(item.id)}
              title={t(item.labelKey, item.id || '')}
              aria-label={t(item.labelKey, item.id || '')}
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
      {(activePanel || selectedBlock) && (
        <div className="w-64 border-l border-c-border-subtle bg-c-surface overflow-y-auto">
          <div className="p-3">
            {activePanel && (
              <h3 className="text-sm font-semibold text-c-text mb-3">
                {t(TOOLBAR_ITEMS.find((i) => i.id === activePanel)?.labelKey || '', activePanel)}
              </h3>
            )}

            {activePanel === 'basic' && <BasicBlocksPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'images' && (
              <ImagesPanel
                onOpenMediaLibrary={onOpenMediaLibrary}
                onGenerateAiImage={onGenerateAiImage}
                isGeneratingAiImage={isGeneratingAiImage}
                onUpload={onUpload}
              />
            )}
            {activePanel === 'layouts' && <LayoutsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'diagrams' && <DiagramsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'charts' && <ChartsPanel onInsertBlock={onInsertBlock} />}
            {activePanel === 'search' && <SearchPanel cards={cards} onSelectCard={onSelectCard} />}
            {selectedBlocks.length > 1 && (
              <SelectionTools
                blocks={selectedBlocks}
                onGroup={onGroup}
                onUngroup={onUngroup}
                onAlign={onAlign}
                onDistribute={onDistribute}
              />
            )}
            {selectedBlock && onSelectedBlockUpdate && (
              <BlockInspector block={selectedBlock} onUpdate={onSelectedBlockUpdate} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SelectionTools: React.FC<{
  blocks: CardBlock[];
  onGroup?: () => void;
  onUngroup?: () => void;
  onAlign?: (alignment: HorizontalAlignment | VerticalAlignment) => void;
  onDistribute?: (axis: 'horizontal' | 'vertical') => void;
}> = ({ blocks, onGroup, onUngroup, onAlign, onDistribute }) => {
  const { t } = useTranslation();
  const geometryCount = blocks.filter((block) => block.geometry).length;
  const hasGroup = blocks.some((block) => block.group_id);
  const buttonClass =
    'rounded-md border border-c-border-subtle px-2 py-1.5 text-[10px] font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-35';
  return (
    <section
      aria-label={t('presentations.builder.selection.tools', 'Multiple block selection tools')}
      className="mb-4 space-y-2"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-c-text">
          {t('presentations.builder.selection.count', '{{count}} blocks selected', {
            count: blocks.length,
          })}
        </h3>
        <span className="text-[10px] text-c-text-secondary">
          {t('presentations.builder.selection.clickHint', 'Shift/⌘ click')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          className={buttonClass}
          onClick={onGroup}
          aria-label={t('presentations.builder.selection.groupAria', 'Group selected blocks')}
        >
          {t('presentations.builder.selection.group', 'Group')}
        </button>
        <button
          className={buttonClass}
          onClick={onUngroup}
          disabled={!hasGroup}
          aria-label={t('presentations.builder.selection.ungroupAria', 'Ungroup selected blocks')}
        >
          {t('presentations.builder.selection.ungroup', 'Ungroup')}
        </button>
      </div>
      <div
        className="grid grid-cols-3 gap-1"
        aria-label={t('presentations.builder.selection.alignTools', 'Align selected blocks')}
      >
        {(['left', 'center', 'right', 'top', 'middle', 'bottom'] as const).map((alignment) => (
          <button
            key={alignment}
            className={buttonClass}
            disabled={geometryCount < 2}
            onClick={() => onAlign?.(alignment)}
            aria-label={t(
              `presentations.builder.selection.align.${alignment}`,
              `Align ${alignment}`
            )}
          >
            {t(`presentations.builder.selection.position.${alignment}`, alignment)}
          </button>
        ))}
      </div>
      <div
        className="grid grid-cols-2 gap-1"
        aria-label={t(
          'presentations.builder.selection.distributeTools',
          'Distribute selected blocks'
        )}
      >
        <button
          className={buttonClass}
          disabled={geometryCount < 3}
          onClick={() => onDistribute?.('horizontal')}
          aria-label={t(
            'presentations.builder.selection.distributeHorizontal',
            'Distribute horizontally'
          )}
        >
          {t('presentations.builder.selection.distributeH', 'Distribute H')}
        </button>
        <button
          className={buttonClass}
          disabled={geometryCount < 3}
          onClick={() => onDistribute?.('vertical')}
          aria-label={t(
            'presentations.builder.selection.distributeVertical',
            'Distribute vertically'
          )}
        >
          {t('presentations.builder.selection.distributeV', 'Distribute V')}
        </button>
      </div>
      {geometryCount < 2 && (
        <p className="text-[10px] text-c-text-secondary">
          {t(
            'presentations.builder.selection.alignmentHint',
            'Alignment becomes available for freeform-positioned blocks.'
          )}
        </p>
      )}
    </section>
  );
};

const PanelButton: React.FC<{
  label: string;
  description?: string;
  disabled?: boolean;
  disabledTitle?: string;
  onClick: () => void;
}> = ({ label, description, disabled, disabledTitle, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={disabled ? (disabledTitle ?? 'Coming soon') : undefined}
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

const ImagesPanel: React.FC<{
  onOpenMediaLibrary?: () => void;
  onGenerateAiImage?: () => void;
  isGeneratingAiImage?: boolean;
  onUpload?: () => void;
}> = ({ onOpenMediaLibrary, onGenerateAiImage, isGeneratingAiImage, onUpload }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <PanelButton
          label={t('presentations.builder.toolbar.orgLibrary', 'Organization Library')}
          description={t(
            'presentations.builder.toolbar.orgLibraryDescription',
            'Browse your org images'
          )}
          onClick={() => onOpenMediaLibrary?.()}
        />
        <PanelButton
          label={
            isGeneratingAiImage
              ? t('presentations.builder.toolbar.aiGenerating', 'Generating…')
              : t('presentations.builder.toolbar.aiGenerate', 'AI Generate')
          }
          description={t(
            'presentations.builder.toolbar.aiGenerateDescription',
            'Regenerate this slide with an AI image'
          )}
          disabled={isGeneratingAiImage || !onGenerateAiImage}
          disabledTitle={
            isGeneratingAiImage
              ? t('presentations.builder.toolbar.aiGenerating', 'Generating…')
              : undefined
          }
          onClick={() => onGenerateAiImage?.()}
        />
        <PanelButton
          label={t('presentations.builder.toolbar.upload', 'Upload')}
          description={t(
            'presentations.builder.toolbar.uploadDescription',
            'Upload an image from your device'
          )}
          disabled={!onUpload}
          onClick={() => onUpload?.()}
        />
      </div>
    </div>
  );
};

const SearchPanel: React.FC<{ cards: DeckCard[]; onSelectCard?: (index: number) => void }> = ({
  cards,
  onSelectCard,
}) => {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? cards.flatMap((card, cardIndex) => {
        const haystack = [card.title, ...card.blocks.map((b) => JSON.stringify(b.content))]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalized) ? [{ card, cardIndex }] : [];
      })
    : [];
  return (
    <div>
      <input
        type="text"
        placeholder="Szukaj w prezentacji…"
        aria-label="Szukaj w prezentacji"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface-raised text-sm"
      />
      {!normalized && (
        <p className="text-[10px] text-c-text-secondary mt-2">
          Wpisz tekst, aby przeszukać wszystkie slajdy
        </p>
      )}
      {normalized && matches.length === 0 && (
        <p className="text-xs text-c-text-secondary mt-3">Brak pasujących slajdów</p>
      )}
      <div className="mt-2 space-y-1">
        {matches.map(({ card, cardIndex }) => (
          <button
            key={card.card_id}
            onClick={() => onSelectCard?.(cardIndex)}
            className="w-full rounded-lg px-2 py-2 text-left hover:bg-c-surface-raised"
            aria-label={`Go to slide ${cardIndex + 1}: ${card.title}`}
          >
            <span className="text-[10px] text-c-text-muted">Slide {cardIndex + 1}</span>
            <p className="text-xs font-medium text-c-text truncate">{card.title || 'Untitled'}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const InspectorField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}> = ({ label, value, onChange, multiline }) => (
  <label className="block text-[10px] text-c-text-secondary">
    <span>{label}</span>
    {multiline ? (
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-20 w-full rounded border border-c-border-subtle bg-c-surface-raised p-2 text-xs text-c-text"
      />
    ) : (
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs text-c-text"
      />
    )}
  </label>
);

const BlockInspector: React.FC<{
  block: CardBlock;
  onUpdate: (updates: Partial<CardBlock>) => void;
}> = ({ block, onUpdate }) => {
  const content = block.content || {};
  const textStyle = ((content.style as Record<string, unknown>) || {}) as Record<string, unknown>;
  const frameStyle = block.style_overrides || {};
  const patchContent = (patch: Record<string, unknown>) =>
    onUpdate({ content: { ...content, ...patch } });
  const dataText = Array.isArray(content.data) ? JSON.stringify(content.data, null, 2) : '';
  const items = Array.isArray(content.items) ? content.items : [];
  return (
    <div
      className="mt-4 border-t border-c-border-subtle pt-3 space-y-2"
      data-testid="block-inspector"
    >
      <h4 className="text-xs font-semibold text-c-text">
        Selected {block.type.replace(/_/g, ' ')}
      </h4>
      {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'callout') && (
        <InspectorField
          label="Tekst"
          multiline
          value={String(content.text || '')}
          onChange={(text) => patchContent({ text })}
        />
      )}
      {(block.type === 'bullet_list' ||
        block.type === 'numbered_list' ||
        block.type === 'smart_diagram') && (
        <InspectorField
          label="Elementy (po jednym w wierszu)"
          multiline
          value={items
            .map((x: unknown) =>
              typeof x === 'string' ? x : String((x as any)?.label || (x as any)?.title || '')
            )
            .join('\n')}
          onChange={(value) =>
            patchContent({
              items: value
                .split('\n')
                .filter(Boolean)
                .map((label) => (block.type === 'smart_diagram' ? { label } : label)),
            })
          }
        />
      )}
      {block.type === 'metric_strip' && (
        <InspectorField
          label="Miary (po jednej w wierszu: etykieta | wartość | jednostka | kierunek | zmiana)"
          multiline
          value={serializeMetricStrip(content.metrics)}
          onChange={(value) => patchContent({ metrics: parseMetricStrip(value) })}
        />
      )}
      {block.type === 'table' && (
        <>
          <InspectorField
            label="Nagłówki (oddzielone przecinkami)"
            value={(Array.isArray(content.headers) ? content.headers : []).join(', ')}
            onChange={(value) => patchContent({ headers: value.split(',').map((x) => x.trim()) })}
          />
          <InspectorField
            label="Wiersze CSV (po jednym w wierszu)"
            multiline
            value={(Array.isArray(content.rows) ? content.rows : [])
              .map((r: unknown) => (Array.isArray(r) ? r.join(', ') : ''))
              .join('\n')}
            onChange={(value) =>
              patchContent({
                rows: value
                  .split('\n')
                  .filter(Boolean)
                  .map((row) => row.split(',').map((x) => x.trim())),
              })
            }
          />
        </>
      )}
      {block.type === 'chart' && (
        <>
          <InspectorField
            label="Tytuł wykresu"
            value={String(content.title || '')}
            onChange={(title) => patchContent({ title })}
          />
          <label className="block text-[10px] text-c-text-secondary">
            Chart type
            <select
              aria-label="Typ wykresu"
              value={String(content.chartType || 'bar')}
              onChange={(e) => patchContent({ chartType: e.target.value })}
              className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
            >
              <option value="bar">Słupkowy</option>
              <option value="line">Liniowy</option>
              <option value="area">Warstwowy</option>
              <option value="pie">Kołowy</option>
              <option value="donut">Pierścieniowy</option>
            </select>
          </label>
          <InspectorField
            label="Dane wykresu (JSON)"
            multiline
            value={dataText}
            onChange={(value) => {
              try {
                patchContent({ data: JSON.parse(value) });
              } catch {
                /* keep editing until valid */
              }
            }}
          />
        </>
      )}
      {block.type === 'kpi_widget' && (
        <>
          <InspectorField
            label="Etykieta wskaźnika"
            value={String(content.label || '')}
            onChange={(label) => patchContent({ label })}
          />
          <InspectorField
            label="Wartość wskaźnika"
            value={String(content.value || '')}
            onChange={(value) => patchContent({ value })}
          />
          <InspectorField
            label="Kierunek zmiany"
            value={String(content.trend || '')}
            onChange={(trend) => patchContent({ trend })}
          />
        </>
      )}
      {block.type === 'image' && (
        <>
          <InspectorField
            label="Adres URL obrazu"
            value={String(content.url || '')}
            onChange={(url) => patchContent({ url })}
          />
          <InspectorField
            label="Tekst alternatywny"
            value={String(content.alt || '')}
            onChange={(alt) => patchContent({ alt })}
          />
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <InspectorField
          label="Rozmiar pisma"
          value={String((content.style as any)?.fontSize || '')}
          onChange={(fontSize) =>
            patchContent({ style: { ...((content.style as any) || {}), fontSize } })
          }
        />
        <InspectorField
          label="Kolor tekstu"
          value={String((content.style as any)?.color || '')}
          onChange={(color) =>
            patchContent({ style: { ...((content.style as any) || {}), color } })
          }
        />
      </div>
      <label className="block text-[10px] text-c-text-secondary">
        Font family
        <select
          aria-label="Krój pisma"
          value={String(textStyle.fontFamily || '')}
          onChange={(e) => patchContent({ style: { ...textStyle, fontFamily: e.target.value } })}
          className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
        >
          <option value="">Domyślny dla motywu</option>
          <option value="Inter">Inter</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] text-c-text-secondary">
          Font weight
          <select
            aria-label="Grubość pisma"
            value={String(textStyle.fontWeight || 'normal')}
            onChange={(e) => patchContent({ style: { ...textStyle, fontWeight: e.target.value } })}
            className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
          >
            <option value="normal">Zwykłe</option>
            <option value="500">Średnie</option>
            <option value="600">Pogrubione</option>
            <option value="700">Grube</option>
          </select>
        </label>
        <InspectorField
          label="Interlinia"
          value={String(textStyle.lineHeight || '')}
          onChange={(lineHeight) => patchContent({ style: { ...textStyle, lineHeight } })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <InspectorField
          label="Odstępy między literami"
          value={String(textStyle.letterSpacing || '')}
          onChange={(letterSpacing) => patchContent({ style: { ...textStyle, letterSpacing } })}
        />
        <div className="flex items-end gap-3 pb-1">
          <label className="flex items-center gap-1 text-[10px] text-c-text-secondary">
            <input
              aria-label="Kursywa"
              type="checkbox"
              checked={textStyle.fontStyle === 'italic'}
              onChange={(e) =>
                patchContent({
                  style: { ...textStyle, fontStyle: e.target.checked ? 'italic' : 'normal' },
                })
              }
            />
            Italic
          </label>
          <label className="flex items-center gap-1 text-[10px] text-c-text-secondary">
            <input
              aria-label="Podkreślenie"
              type="checkbox"
              checked={textStyle.textDecoration === 'underline'}
              onChange={(e) =>
                patchContent({
                  style: {
                    ...textStyle,
                    textDecoration: e.target.checked ? 'underline' : 'none',
                  },
                })
              }
            />
            Underline
          </label>
        </div>
      </div>
      <label className="block text-[10px] text-c-text-secondary">
        Alignment
        <select
          aria-label="Wyrównanie"
          value={String((content.style as any)?.textAlign || 'left')}
          onChange={(e) =>
            patchContent({
              style: { ...((content.style as any) || {}), textAlign: e.target.value },
            })
          }
          className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
        >
          <option value="left">Do lewej</option>
          <option value="center">Do środka</option>
          <option value="right">Do prawej</option>
        </select>
      </label>
      <div className="mt-3 border-t border-c-border-subtle pt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
          Position and size
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] text-c-text-secondary">
            Layout region
            <select
              aria-label="Obszar układu"
              value={block.position.area}
              onChange={(e) =>
                onUpdate({
                  position: {
                    ...block.position,
                    area: e.target.value as CardBlock['position']['area'],
                  },
                })
              }
              className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
            >
              <option value="full">Całość</option>
              <option value="left">Lewa strona</option>
              <option value="right">Prawa strona</option>
              <option value="top">Góra</option>
              <option value="bottom">Dół</option>
              <option value="overlay">Nakładka</option>
            </select>
          </label>
          <InspectorField
            label="Kolejność warstw"
            value={String(block.position.order)}
            onChange={(value) =>
              onUpdate({
                position: { ...block.position, order: Math.max(0, Number(value) || 0) },
              })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <InspectorField
            label="Szerokość (%)"
            value={String(frameStyle.widthPercent || 100)}
            onChange={(widthPercent) =>
              onUpdate({ style_overrides: { ...frameStyle, widthPercent } })
            }
          />
          <InspectorField
            label="Minimalna wysokość (px)"
            value={String(frameStyle.minHeight || '')}
            onChange={(minHeight) => onUpdate({ style_overrides: { ...frameStyle, minHeight } })}
          />
        </div>
        <label className="block text-[10px] text-c-text-secondary">
          Horizontal placement
          <select
            aria-label="Położenie w poziomie"
            value={String(frameStyle.alignSelf || 'stretch')}
            onChange={(e) =>
              onUpdate({ style_overrides: { ...frameStyle, alignSelf: e.target.value } })
            }
            className="mt-1 w-full rounded border border-c-border-subtle bg-c-surface-raised px-2 py-1.5 text-xs"
          >
            <option value="stretch">Rozciągnij</option>
            <option value="flex-start">Do lewej</option>
            <option value="center">Do środka</option>
            <option value="flex-end">Do prawej</option>
          </select>
        </label>
      </div>
    </div>
  );
};
