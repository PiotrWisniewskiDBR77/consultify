/**
 * ViewConfigPanel — Configuration panel for view-specific settings.
 * Allows configuring Kanban group-by, Calendar date field, Gallery cover/size,
 * visible fields, and common sort/filter rules.
 */
import {
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  GanttChartSquare,
  Grid3X3,
  Image,
  KanbanSquare,
  Settings2,
  Table2,
  Timer,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { FormatRule } from '../ConditionalFormatting';
import { ConditionalFormattingConfig } from '../ConditionalFormatting';
import type { RowColorRule } from '../RowColoringConfig';
import { RowColoringConfig } from '../RowColoringConfig';
import type { ColumnDef } from '../tableTypes';
import type { CardSize } from './GalleryView';
import type { GanttZoom } from './GanttView';
import type { TimelineZoom } from './TimelineView';

export type PlatformViewType =
  | 'grid'
  | 'kanban'
  | 'calendar'
  | 'gallery'
  | 'timeline'
  | 'gantt'
  | 'form'
  | 'chart';

export interface ViewConfigState {
  viewType: PlatformViewType;
  groupByFieldId?: string;
  cardFieldIds?: string[];
  dateFieldId?: string;
  colorByFieldId?: string;
  coverImageFieldId?: string;
  galleryCardSize?: CardSize;
  visibleFieldIds: string[];
  startDateFieldId?: string;
  endDateFieldId?: string;
  titleFieldId?: string;
  timelineZoom?: TimelineZoom;
  dependencyFieldId?: string;
  progressFieldId?: string;
  ganttZoom?: GanttZoom;
  formLayout?: 'single-column' | 'two-column';
  chartType?: 'bar' | 'line' | 'pie' | 'donut';
  chartXFieldId?: string;
  chartYFieldId?: string;
  chartAggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  rowColorRules?: RowColorRule[];
  conditionalFormatRules?: FormatRule[];
}

export interface ViewConfigPanelProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  config: ViewConfigState;
  onChange: (config: ViewConfigState) => void;
  onSave: () => void;
}

const VIEW_TYPES: {
  id: PlatformViewType;
  icon: React.FC<{ size?: number; className?: string }>;
  labelEn: string;
  labelPl: string;
}[] = [
  { id: 'grid', icon: Table2, labelEn: 'Grid', labelPl: 'Tabela' },
  { id: 'kanban', icon: KanbanSquare, labelEn: 'Kanban', labelPl: 'Kanban' },
  { id: 'calendar', icon: Calendar, labelEn: 'Calendar', labelPl: 'Kalendarz' },
  { id: 'gallery', icon: Grid3X3, labelEn: 'Gallery', labelPl: 'Galeria' },
  { id: 'timeline', icon: Timer, labelEn: 'Timeline', labelPl: 'Oś czasu' },
  { id: 'gantt', icon: GanttChartSquare, labelEn: 'Gantt', labelPl: 'Gantt' },
  { id: 'form', icon: ClipboardList, labelEn: 'Form', labelPl: 'Formularz' },
  { id: 'chart', icon: BarChart3, labelEn: 'Chart', labelPl: 'Wykres' },
];

const CARD_SIZES: { id: CardSize; labelEn: string; labelPl: string }[] = [
  { id: 'small', labelEn: 'Small', labelPl: 'Mały' },
  { id: 'medium', labelEn: 'Medium', labelPl: 'Średni' },
  { id: 'large', labelEn: 'Large', labelPl: 'Duży' },
];

export const ViewConfigPanel: React.FC<ViewConfigPanelProps> = ({
  open,
  onClose,
  columns,
  config,
  onChange,
  onSave,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expandedSection, setExpandedSection] = useState<string | null>('type');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef });

  const selectFields = useMemo(
    () =>
      columns.filter((c) => c.type === 'select' || c.type === 'multiselect' || c.type === 'status'),
    [columns]
  );

  const dateFields = useMemo(
    () =>
      columns.filter(
        (c) => c.type === 'date' || c.type === 'created_time' || c.type === 'last_edited_time'
      ),
    [columns]
  );

  const attachmentFields = useMemo(
    () => columns.filter((c) => c.type === 'file' || c.type === 'url'),
    [columns]
  );

  const numberFields = useMemo(
    () =>
      columns.filter((c) => c.type === 'number' || c.type === 'progress' || c.type === 'currency'),
    [columns]
  );

  const relationFields = useMemo(() => columns.filter((c) => c.type === 'relation'), [columns]);

  const textLikeFields = useMemo(
    () => columns.filter((c) => c.type === 'text' || c.key === 'label'),
    [columns]
  );

  const updateConfig = useCallback(
    (patch: Partial<ViewConfigState>) => {
      onChange({ ...config, ...patch });
    },
    [config, onChange]
  );

  const toggleVisibleField = useCallback(
    (fieldId: string) => {
      const current = new Set(config.visibleFieldIds);
      if (current.has(fieldId)) {
        current.delete(fieldId);
      } else {
        current.add(fieldId);
      }
      updateConfig({ visibleFieldIds: Array.from(current) });
    },
    [config.visibleFieldIds, updateConfig]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-end" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-config-panel-title"
        tabIndex={-1}
        className="w-80 h-full bg-c-surface border-l border-c-border-subtle shadow-2xl overflow-auto outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
          <div className="flex items-center gap-2">
            <Settings2 size={14} className="text-c-text-muted" />
            <span id="view-config-panel-title" className="text-xs font-bold text-c-text">
              {t('myWorkTable.viewConfigPanel.viewConfiguration')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* View type selector */}
          <Section
            title={t('myWorkTable.viewConfigPanel.viewType')}
            id="type"
            expanded={expandedSection}
            onToggle={setExpandedSection}
          >
            <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-auto">
              {VIEW_TYPES.map((vt) => {
                const Icon = vt.icon;
                const isActive = config.viewType === vt.id;
                return (
                  <button
                    key={vt.id}
                    onClick={() => updateConfig({ viewType: vt.id })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'bg-c-surface-raised text-c-text border border-c-border'
                        : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                    }`}
                  >
                    <Icon size={14} />
                    {isPl ? vt.labelPl : vt.labelEn}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Group by (grid view) */}
          {config.viewType === 'grid' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.groupBy')}
              id="groupBy"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.groupByField')}
                  value={config.groupByFieldId}
                  options={columns}
                  onChange={(id) => updateConfig({ groupByFieldId: id || undefined })}
                  isPl={isPl}
                  allowEmpty
                />
              </div>
            </Section>
          )}

          {/* Kanban config */}
          {config.viewType === 'kanban' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.kanbanSettings')}
              id="kanban"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.groupBy2')}
                  value={config.groupByFieldId}
                  options={selectFields}
                  onChange={(id) => updateConfig({ groupByFieldId: id })}
                  isPl={isPl}
                />
                <FieldMultiSelect
                  label={t('myWorkTable.viewConfigPanel.cardFields')}
                  selected={config.cardFieldIds || []}
                  options={columns.filter((c) => c.key !== 'label' && c.key !== 'type')}
                  onChange={(ids) => updateConfig({ cardFieldIds: ids })}
                  isPl={isPl}
                />
              </div>
            </Section>
          )}

          {/* Calendar config */}
          {config.viewType === 'calendar' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.calendarSettings')}
              id="calendar"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.dateField')}
                  value={config.dateFieldId}
                  options={dateFields}
                  onChange={(id) => updateConfig({ dateFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.colorBy')}
                  value={config.colorByFieldId}
                  options={selectFields}
                  onChange={(id) => updateConfig({ colorByFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
              </div>
            </Section>
          )}

          {/* Gallery config */}
          {config.viewType === 'gallery' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.gallerySettings')}
              id="gallery"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.coverImageField')}
                  value={config.coverImageFieldId}
                  options={attachmentFields}
                  onChange={(id) => updateConfig({ coverImageFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.cardSize')}
                  </label>
                  <div className="flex gap-1">
                    {CARD_SIZES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => updateConfig({ galleryCardSize: s.id })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          config.galleryCardSize === s.id
                            ? 'bg-c-surface-raised text-c-text border border-c-border'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        {isPl ? s.labelPl : s.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
                <FieldMultiSelect
                  label={t('myWorkTable.viewConfigPanel.cardFields')}
                  selected={config.cardFieldIds || []}
                  options={columns.filter((c) => c.key !== 'label' && c.key !== 'type')}
                  onChange={(ids) => updateConfig({ cardFieldIds: ids })}
                  isPl={isPl}
                />
              </div>
            </Section>
          )}

          {/* Timeline config */}
          {config.viewType === 'timeline' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.timelineSettings')}
              id="timeline"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.startDateField')}
                  value={config.startDateFieldId}
                  options={dateFields}
                  onChange={(id) => updateConfig({ startDateFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.endDateField')}
                  value={config.endDateFieldId}
                  options={dateFields}
                  onChange={(id) => updateConfig({ endDateFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.titleField')}
                  value={config.titleFieldId}
                  options={textLikeFields}
                  onChange={(id) => updateConfig({ titleFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.colorBy')}
                  value={config.colorByFieldId}
                  options={selectFields}
                  onChange={(id) => updateConfig({ colorByFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.zoom')}
                  </label>
                  <div className="flex gap-1">
                    {(['day', 'week', 'month'] as const).map((z) => (
                      <button
                        key={z}
                        onClick={() => updateConfig({ timelineZoom: z })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          (config.timelineZoom || 'week') === z
                            ? 'bg-c-surface-raised text-c-text border border-c-border'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        {z === 'day'
                          ? t('myWorkTable.viewConfigPanel.day')
                          : z === 'week'
                            ? t('myWorkTable.viewConfigPanel.week')
                            : t('myWorkTable.viewConfigPanel.month')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Gantt config */}
          {config.viewType === 'gantt' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.ganttSettings')}
              id="gantt"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.startDateField')}
                  value={config.startDateFieldId}
                  options={dateFields}
                  onChange={(id) => updateConfig({ startDateFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.endDateField')}
                  value={config.endDateFieldId}
                  options={dateFields}
                  onChange={(id) => updateConfig({ endDateFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.titleField')}
                  value={config.titleFieldId}
                  options={textLikeFields}
                  onChange={(id) => updateConfig({ titleFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.dependencyField')}
                  value={config.dependencyFieldId}
                  options={relationFields}
                  onChange={(id) => updateConfig({ dependencyFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.progressField')}
                  value={config.progressFieldId}
                  options={numberFields}
                  onChange={(id) => updateConfig({ progressFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.zoom')}
                  </label>
                  <div className="flex gap-1">
                    {(['day', 'week', 'month'] as const).map((z) => (
                      <button
                        key={z}
                        onClick={() => updateConfig({ ganttZoom: z })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          (config.ganttZoom || 'week') === z
                            ? 'bg-c-surface-raised text-c-text border border-c-border'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        {z === 'day'
                          ? t('myWorkTable.viewConfigPanel.day')
                          : z === 'week'
                            ? t('myWorkTable.viewConfigPanel.week')
                            : t('myWorkTable.viewConfigPanel.month')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* Form config */}
          {config.viewType === 'form' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.formSettings')}
              id="form"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.layout')}
                  </label>
                  <div className="flex gap-1">
                    {(['single-column', 'two-column'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => updateConfig({ formLayout: l })}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          (config.formLayout || 'single-column') === l
                            ? 'bg-c-surface-raised text-c-text border border-c-border'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        {l === 'single-column'
                          ? t('myWorkTable.viewConfigPanel.n1Column')
                          : t('myWorkTable.viewConfigPanel.n2Columns')}
                      </button>
                    ))}
                  </div>
                </div>
                <FieldMultiSelect
                  label={t('myWorkTable.viewConfigPanel.visibleFields')}
                  selected={config.visibleFieldIds}
                  options={columns}
                  onChange={(ids) => updateConfig({ visibleFieldIds: ids })}
                  isPl={isPl}
                />
              </div>
            </Section>
          )}

          {/* Chart config */}
          {config.viewType === 'chart' && (
            <Section
              title={t('myWorkTable.viewConfigPanel.chartSettings')}
              id="chart"
              expanded={expandedSection}
              onToggle={setExpandedSection}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.chartType')}
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {(['bar', 'line', 'pie', 'donut'] as const).map((ct) => (
                      <button
                        key={ct}
                        onClick={() => updateConfig({ chartType: ct })}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors capitalize ${
                          (config.chartType || 'bar') === ct
                            ? 'bg-c-surface-raised text-c-text border border-c-border'
                            : 'text-c-text-muted hover:bg-c-surface-raised border border-transparent'
                        }`}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.xAxisField')}
                  value={config.chartXFieldId}
                  options={columns}
                  onChange={(id) => updateConfig({ chartXFieldId: id })}
                  isPl={isPl}
                />
                <FieldSelect
                  label={t('myWorkTable.viewConfigPanel.yAxisFieldNumeric')}
                  value={config.chartYFieldId}
                  options={numberFields}
                  onChange={(id) => updateConfig({ chartYFieldId: id })}
                  isPl={isPl}
                  allowEmpty
                />
                <div>
                  <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
                    {t('myWorkTable.viewConfigPanel.aggregation')}
                  </label>
                  <select
                    value={config.chartAggregation || 'count'}
                    onChange={(e) =>
                      updateConfig({
                        chartAggregation: e.target.value as 'count' | 'sum' | 'avg' | 'min' | 'max',
                      })
                    }
                    className="w-full h-8 px-2 rounded-lg text-[11px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-c-focus"
                  >
                    <option value="count">{t('myWorkTable.chartConfigPanel.aggCount', 'Count')}</option>
                    <option value="sum">{t('myWorkTable.chartConfigPanel.aggSum', 'Sum')}</option>
                    <option value="avg">{t('myWorkTable.chartConfigPanel.aggAverage', 'Average')}</option>
                    <option value="min">{t('myWorkTable.chartConfigPanel.aggMin', 'Min')}</option>
                    <option value="max">{t('myWorkTable.chartConfigPanel.aggMax', 'Max')}</option>
                  </select>
                </div>
              </div>
            </Section>
          )}

          {/* Row coloring */}
          <Section
            title={t('myWorkTable.viewConfigPanel.rowColoring')}
            id="rowColoring"
            expanded={expandedSection}
            onToggle={setExpandedSection}
          >
            <RowColoringConfig
              rules={config.rowColorRules || []}
              fields={columns}
              onChange={(rules) => updateConfig({ rowColorRules: rules })}
            />
          </Section>

          {/* Conditional formatting */}
          <Section
            title={t('myWorkTable.viewConfigPanel.conditionalFormatting')}
            id="conditionalFormatting"
            expanded={expandedSection}
            onToggle={setExpandedSection}
          >
            <ConditionalFormattingConfig
              rules={config.conditionalFormatRules || []}
              fields={columns}
              onChange={(rules) => updateConfig({ conditionalFormatRules: rules })}
            />
          </Section>

          {/* Visible fields */}
          <Section
            title={t('myWorkTable.viewConfigPanel.visibleFields')}
            id="fields"
            expanded={expandedSection}
            onToggle={setExpandedSection}
          >
            <div className="space-y-0.5 max-h-[200px] overflow-auto">
              {columns.map((col) => {
                const isVisible = config.visibleFieldIds.includes(col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleVisibleField(col.key)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text hover:bg-c-surface-raised transition-colors"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        isVisible ? 'bg-c-surface border-c-border-strong' : 'border-c-border-subtle'
                      }`}
                    >
                      {isVisible && <Check size={10} className="text-c-text" />}
                    </div>
                    <span className="flex-1 text-left truncate">{col.header}</span>
                    <span className="text-[9px] text-c-text-secondary">{col.type}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-4 py-3 border-t border-c-border-subtle bg-c-surface">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors"
            >
              {t('myWorkTable.viewConfigPanel.cancel')}
            </button>
            <button
              onClick={() => {
                onSave();
                onClose();
              }}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-surface hover:opacity-90 transition-colors"
            >
              {t('myWorkTable.viewConfigPanel.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Helper sub-components ─────────────────────────────────────────────── */

const Section: React.FC<{
  title: string;
  id: string;
  expanded: string | null;
  onToggle: (id: string | null) => void;
  children: React.ReactNode;
}> = ({ title, id, expanded, onToggle, children }) => {
  const isOpen = expanded === id;
  return (
    <div className="border border-c-border-subtle rounded-xl overflow-hidden">
      <button
        onClick={() => onToggle(isOpen ? null : id)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-c-text-muted hover:bg-c-surface-raised transition-colors"
      >
        {title}
        <ChevronDown
          size={12}
          className={`text-c-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
};

const FieldSelect: React.FC<{
  label: string;
  value?: string;
  options: ColumnDef[];
  onChange: (id: string) => void;
  isPl: boolean;
  allowEmpty?: boolean;
}> = ({ label, value, options, onChange, isPl, allowEmpty }) => {
  const { t } = useTranslation();
  return (
    <div>
      <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2 rounded-lg text-[11px] bg-c-surface-raised border border-c-border-subtle text-c-text outline-none focus:ring-2 focus:ring-c-focus"
      >
        {allowEmpty && <option value="">{t('myWorkTable.viewConfigPanel.none')}</option>}
        {options.map((col) => (
          <option key={col.key} value={col.key}>
            {col.header}
          </option>
        ))}
      </select>
    </div>
  );
};

const FieldMultiSelect: React.FC<{
  label: string;
  selected: string[];
  options: ColumnDef[];
  onChange: (ids: string[]) => void;
  isPl: boolean;
}> = ({ label, selected, options, onChange, isPl }) => {
  const toggle = (key: string) => {
    const set = new Set(selected);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    onChange(Array.from(set));
  };

  return (
    <div>
      <label className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <div className="space-y-0.5 max-h-[120px] overflow-auto rounded-lg border border-c-border-subtle p-1">
        {options.map((col) => {
          const isSelected = selected.includes(col.key);
          return (
            <button
              key={col.key}
              onClick={() => toggle(col.key)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] text-c-text-muted hover:bg-c-surface-raised transition-colors"
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  isSelected ? 'bg-c-surface border-c-border-strong' : 'border-c-border-subtle'
                }`}
              >
                {isSelected && <Check size={8} className="text-c-text" />}
              </div>
              <span className="truncate">{col.header}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ViewConfigPanel;
