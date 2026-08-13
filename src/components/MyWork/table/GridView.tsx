/**
 * GridView — Platform-native data grid for the Table Platform (gallery layout slot).
 *
 * Virtualized body, sticky header/first data column, resizable columns, row selection
 * with shift-range, footer aggregations, and double-click inline editing.
 */
import { AlertTriangle, Image, X } from 'lucide-react';
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldType, LinkedRecordFieldOptions } from '@/types/tablePlatform';

import { CellEditor } from './CellEditor';
import { type FormatRule, getConditionalStyle } from './ConditionalFormatting';
import { LinkedRecordDisplay } from './LinkedRecordDisplay';
import { PlatformCellRenderer } from './PlatformCellRenderer';
import { RowGutterIndicator } from './provenance/RowGutterIndicator';
import { TableDataContext, useTableData } from './TableDataProvider';
import { PROVENANCE_DATA_KEYS } from './tablePlatformMappers';
import type { ColumnDef, TableNode } from './tableTypes';
import {
  computeAggregation,
  DEFAULT_COLUMN_WIDTH,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
} from './tableTypes';

// ── Layout constants ─────────────────────────────────────────────────────────

const CHECK_COL_PX = 44;
const ROW_HEIGHT_PX = 36;
const GROUP_ROW_HEIGHT_PX = 32;
const VIRTUAL_BUFFER = 10;

const headerCell =
  'bg-c-surface-raised text-xs uppercase tracking-wider text-c-text-muted border-b border-c-border-subtle font-semibold text-left whitespace-nowrap select-none';

const bodyCell = 'border-b border-c-border-subtle h-9 px-3 align-middle text-sm text-c-text';

const stickyTop = 'sticky top-0 z-10';

function cellId(rowId: string, fieldId: string): string {
  return `${rowId}:${fieldId}`;
}

export function isMissingField(
  fieldId: string,
  viewConfig?: { missing_fields?: string[] }
): boolean {
  return viewConfig?.missing_fields?.includes(fieldId) ?? false;
}

function columnTypeToFieldType(col: ColumnDef): FieldType {
  switch (col.type) {
    case 'number':
    case 'currency':
      return 'number';
    case 'checkbox':
      return 'checkbox';
    case 'date':
    case 'created_time':
    case 'last_edited_time':
      return 'date';
    case 'select':
    case 'status':
      return 'singleSelect';
    case 'multiselect':
      return 'multiSelect';
    case 'url':
      return 'url';
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'rating':
      return 'rating';
    case 'file':
      return 'attachment';
    case 'relation':
      return 'linkedRecord';
    case 'rollup':
      return 'rollup';
    case 'formula':
    case 'ai_generated':
      return 'formula';
    default:
      return 'singleLineText';
  }
}

function selectOptionsFromColumn(col: ColumnDef): Record<string, unknown> {
  if (!col.options?.length) return {};
  return {
    options: col.options.map((name, i) => ({
      id: `opt-${i}`,
      name,
      color: col.optionColors?.[name],
    })),
  };
}

type FlatItem = { kind: 'group'; label: string } | { kind: 'row'; row: TableNode };

function flattenRows(
  processedRows: TableNode[],
  groupedRows: Record<string, TableNode[]> | null
): FlatItem[] {
  if (!groupedRows || Object.keys(groupedRows).length === 0) {
    return processedRows.map((row) => ({ kind: 'row' as const, row }));
  }
  const out: FlatItem[] = [];
  for (const [label, rows] of Object.entries(groupedRows)) {
    out.push({ kind: 'group', label });
    for (const row of rows) out.push({ kind: 'row', row });
  }
  return out;
}

function itemHeight(item: FlatItem): number {
  return item.kind === 'group' ? GROUP_ROW_HEIGHT_PX : ROW_HEIGHT_PX;
}

/** `starts[i]` = y-offset of item i; `ends[i]` = y-offset just below item i. */
function cumulativeStartsAndEnds(items: FlatItem[]): {
  starts: number[];
  ends: number[];
  total: number;
} {
  const starts: number[] = [];
  const ends: number[] = [];
  let y = 0;
  for (const it of items) {
    starts.push(y);
    y += itemHeight(it);
    ends.push(y);
  }
  return { starts, ends, total: y };
}

/** Smallest index i such that ends[i] > scrollTop (first row intersecting viewport from top). */
function findStartIndex(ends: number[], scrollTop: number): number {
  if (ends.length === 0) return 0;
  let lo = 0;
  let hi = ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid]! <= scrollTop) lo = mid + 1;
    else hi = mid;
  }
  return lo >= ends.length ? ends.length - 1 : lo;
}

// ── Shared grid (used with provider data or legacy props) ────────────────────

interface PlatformFieldMeta {
  fieldType: FieldType;
  options: Record<string, unknown>;
  isComputed: boolean;
}

interface DataGridProps {
  processedRows: TableNode[];
  groupedRows: Record<string, TableNode[]> | null;
  visibleColumns: ColumnDef[];
  platformFieldById: Map<string, PlatformFieldMeta>;
  locked: boolean;
  selectedRowIds: Set<string>;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRowSelection: (id: string) => void;
  handleFieldChange: (nodeId: string, field: string, value: unknown) => void;
  editingCellId: string | null;
  setEditingCellId: (id: string | null) => void;
  onOpenDetail: (rowId: string) => void;
  onOpenLinkedRecord: (recordId: string, tableId: string) => void;
  viewConfig?: { missing_fields?: string[]; missing_field_names?: Record<string, string> };
  onRemoveMissingField?: (fieldId: string) => void;
  /** R5: conditional-formatting rules applied per-cell. */
  formatRules?: FormatRule[];
}

const DataGrid: React.FC<DataGridProps> = ({
  processedRows,
  groupedRows,
  visibleColumns,
  platformFieldById,
  locked,
  selectedRowIds,
  setSelectedRowIds,
  toggleRowSelection,
  handleFieldChange,
  editingCellId,
  setEditingCellId,
  onOpenDetail,
  onOpenLinkedRecord,
  viewConfig,
  onRemoveMissingField,
  formatRules,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const lastAnchorIndex = useRef<number | null>(null);

  const [widthByKey, setWidthByKey] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const c of visibleColumns) m[c.key] = c.width || DEFAULT_COLUMN_WIDTH;
    return m;
  });

  useEffect(() => {
    setWidthByKey((prev) => {
      const next = { ...prev };
      for (const c of visibleColumns) {
        if (next[c.key] == null) next[c.key] = c.width || DEFAULT_COLUMN_WIDTH;
      }
      return next;
    });
  }, [visibleColumns]);

  const flatItems = useMemo(
    () => flattenRows(processedRows, groupedRows),
    [processedRows, groupedRows]
  );

  const {
    starts: rowStarts,
    ends: rowEnds,
    total: totalScrollHeight,
  } = useMemo(() => cumulativeStartsAndEnds(flatItems), [flatItems]);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(400);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportH(el.clientHeight || 400);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onBodyScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    if (footerScrollRef.current) footerScrollRef.current.scrollLeft = el.scrollLeft;
  }, []);

  const onFooterScroll = useCallback(() => {
    const body = scrollRef.current;
    const foot = footerScrollRef.current;
    if (!body || !foot) return;
    body.scrollLeft = foot.scrollLeft;
  }, []);

  const { start, end } = useMemo(() => {
    if (flatItems.length === 0) return { start: 0, end: 0 };
    const st = scrollTop;
    const startIdx = findStartIndex(rowEnds, st);
    const viewBottom = st + viewportH + ROW_HEIGHT_PX * VIRTUAL_BUFFER;
    let endIdx = startIdx;
    while (endIdx < flatItems.length && (rowStarts[endIdx] ?? 0) < viewBottom) {
      endIdx++;
    }
    const s = Math.max(0, startIdx - VIRTUAL_BUFFER);
    const e = Math.min(flatItems.length, endIdx + VIRTUAL_BUFFER);
    return { start: s, end: e };
  }, [flatItems, rowEnds, rowStarts, scrollTop, viewportH]);

  const paddingTop = start > 0 ? (rowStarts[start] ?? 0) : 0;
  let paddingBottom = 0;
  if (end < flatItems.length) {
    paddingBottom = totalScrollHeight - (rowStarts[end] ?? totalScrollHeight);
  }

  const allRowIds = useMemo(
    () =>
      flatItems
        .filter((x): x is Extract<FlatItem, { kind: 'row' }> => x.kind === 'row')
        .map((x) => x.row.id),
    [flatItems]
  );

  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedRowIds.has(id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(allRowIds));
  }, [allRowIds, allSelected, setSelectedRowIds]);

  const onCheckboxChange = useCallback(
    (rowId: string, indexInFlat: number, shiftKey: boolean) => {
      if (shiftKey && lastAnchorIndex.current != null) {
        const a = Math.min(lastAnchorIndex.current, indexInFlat);
        const b = Math.max(lastAnchorIndex.current, indexInFlat);
        const slice = flatItems
          .slice(a, b + 1)
          .filter((x): x is Extract<FlatItem, { kind: 'row' }> => x.kind === 'row');
        setSelectedRowIds(new Set(slice.map((r) => r.row.id)));
      } else {
        lastAnchorIndex.current = indexInFlat;
        toggleRowSelection(rowId);
      }
    },
    [flatItems, setSelectedRowIds, toggleRowSelection]
  );

  const resizeState = useRef<{ colKey: string; startX: number; startW: number } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent, colKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        colKey,
        startX: e.clientX,
        startW: widthByKey[colKey] ?? DEFAULT_COLUMN_WIDTH,
      };
      const onMove = (ev: MouseEvent) => {
        const st = resizeState.current;
        if (!st) return;
        const delta = ev.clientX - st.startX;
        const w = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, st.startW + delta));
        setWidthByKey((prev) => ({ ...prev, [st.colKey]: w }));
      };
      const onUp = () => {
        resizeState.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [widthByKey]
  );

  const footerValues = useMemo(
    () =>
      visibleColumns.map((col) => {
        const agg = col.aggregation;
        if (!agg || agg === 'none') return '';
        const vals = processedRows.map(
          (r) => r.data?.[col.key] as string | number | null | undefined
        );
        return computeAggregation(agg, vals);
      }),
    [processedRows, visibleColumns]
  );

  const colSpan = visibleColumns.length + 1;

  const renderCell = useCallback(
    (row: TableNode, col: ColumnDef) => {
      if (isMissingField(col.key, viewConfig)) {
        return (
          <div className="text-xs text-c-warning italic select-none" aria-hidden>
            —
          </div>
        );
      }
      const id = cellId(row.id, col.key);
      const isEditing = !locked && editingCellId === id;
      const pf = platformFieldById.get(col.key);
      const fieldType = (pf?.fieldType ?? columnTypeToFieldType(col)) as FieldType;
      const fieldOptions =
        (pf?.options as Record<string, unknown>) ||
        (fieldType === 'singleSelect' || fieldType === 'multiSelect'
          ? selectOptionsFromColumn(col)
          : {});
      const rawValue = row.data?.[col.key];
      const isLinked = fieldType === 'linkedRecord';
      const linkedTableId =
        (fieldOptions as unknown as LinkedRecordFieldOptions | undefined)?.linkedTableId ?? '';

      if (isEditing) {
        return (
          <div className="min-w-0 py-0.5" onClick={(e) => e.stopPropagation()}>
            <CellEditor
              value={rawValue}
              fieldType={fieldType}
              fieldOptions={fieldOptions}
              linkedRecordContext={
                isLinked ? { recordId: row.id, fieldId: col.key, linkedTableId } : undefined
              }
              onSave={(v) => {
                handleFieldChange(row.id, col.key, v);
                setEditingCellId(null);
              }}
              onCancel={() => setEditingCellId(null)}
            />
          </div>
        );
      }

      const readOnly =
        isLinked && linkedTableId ? (
          <LinkedRecordDisplay
            recordId={row.id}
            fieldId={col.key}
            linkedTableId={linkedTableId}
            locked={locked}
            onOpenRecord={(rid, tid) => onOpenLinkedRecord(rid, tid)}
            onOpenPicker={() => {
              if (!locked) setEditingCellId(id);
            }}
          />
        ) : (
          <PlatformCellRenderer
            value={rawValue}
            fieldType={fieldType}
            fieldOptions={fieldOptions}
            record={{ data: row.data as Record<string, unknown> | undefined }}
          />
        );

      return (
        <div
          role="gridcell"
          tabIndex={0}
          className="min-w-0 min-h-[36px] flex items-center outline-none focus-visible:ring-1 focus-visible:ring-c-focus cursor-text"
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (locked || pf?.isComputed) return;
            setEditingCellId(id);
          }}
          onKeyDown={(e) => {
            if (locked || pf?.isComputed) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              setEditingCellId(id);
            }
          }}
        >
          {readOnly}
        </div>
      );
    },
    [
      locked,
      editingCellId,
      platformFieldById,
      handleFieldChange,
      setEditingCellId,
      onOpenLinkedRecord,
      viewConfig,
    ]
  );

  if (processedRows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-c-text-muted">
        <Image size={32} />
        <span className="text-sm font-medium">{t('myWorkTable.gridView.noItems')}</span>
      </div>
    );
  }

  const stickyPrimaryLeft = CHECK_COL_PX;

  return (
    <div
      data-testid="table-grid"
      className="flex h-full min-h-0 flex-1 flex-col rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface"
    >
      <div
        ref={scrollRef}
        className="min-h-[320px] flex-1 overflow-y-auto overflow-x-auto"
        onScroll={onBodyScroll}
      >
        <table
          /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-max min-w-full border-collapse text-left"
        >
          <thead className={stickyTop}>
            <tr>
              <th
                style={{ width: CHECK_COL_PX, minWidth: CHECK_COL_PX }}
                className={`${headerCell} sticky left-0 z-20 border-r border-c-border-subtle px-2 py-2`}
              >
                <input
                  type="checkbox"
                  className="rounded border-c-border-subtle"
                  checked={allSelected}
                  disabled={locked}
                  onChange={toggleSelectAll}
                  aria-label={t('myWorkTable.gridView.selectAll')}
                />
              </th>
              {visibleColumns.map((col, colIdx) => {
                const w = widthByKey[col.key] ?? col.width ?? DEFAULT_COLUMN_WIDTH;
                const isPrimary = colIdx === 0;
                const missing = isMissingField(col.key, viewConfig);
                const missingFieldName =
                  viewConfig?.missing_field_names?.[col.key] ?? col.header ?? 'Unknown';
                if (missing) {
                  return (
                    <th
                      key={col.key}
                      data-testid={`table-col-header-${col.key}`}
                      style={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        ...(isPrimary ? { left: stickyPrimaryLeft } : {}),
                      }}
                      className={`relative border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] text-c-warning text-xs px-3 py-2 border-b border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)] font-semibold text-left whitespace-nowrap select-none ${
                        isPrimary
                          ? `sticky z-[15] border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)]`
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5 pr-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">
                          {t('ideas.table.viewRouter.missingField', '[Missing: {{name}}]', {
                            name: missingFieldName,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveMissingField?.(col.key)}
                          className="ml-auto shrink-0 text-c-warning hover:brightness-110"
                          title={t('myWorkTable.gridView.removeFromView')}
                          aria-label={t('myWorkTable.gridView.removeFromView')}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={t('myWorkTable.gridView.resizeColumn')}
                        className="absolute right-0 top-0 z-30 h-full w-1 cursor-col-resize hover:bg-[color-mix(in_srgb,var(--c-focus-solid)_50%,transparent)]"
                        onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                      />
                    </th>
                  );
                }
                return (
                  <th
                    key={col.key}
                    data-testid={`table-col-header-${col.key}`}
                    style={{
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      ...(isPrimary ? { left: stickyPrimaryLeft } : {}),
                    }}
                    className={`${headerCell} relative border-r border-c-border-subtle px-3 py-2 ${
                      isPrimary
                        ? `sticky z-[15] border-r border-c-border-subtle bg-c-surface-raised`
                        : ''
                    }`}
                  >
                    <span className="block truncate pr-2">{col.header}</span>
                    <button
                      type="button"
                      aria-label={t('myWorkTable.gridView.resizeColumn')}
                      className="absolute right-0 top-0 z-30 h-full w-1 cursor-col-resize hover:bg-[color-mix(in_srgb,var(--c-focus-solid)_50%,transparent)]"
                      onMouseDown={(e) => onResizeMouseDown(e, col.key)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden className="pointer-events-none">
                <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            )}
            {flatItems.slice(start, end).map((item, j) => {
              const i = start + j;
              if (item.kind === 'group') {
                return (
                  <tr key={`g-${item.label}-${i}`} className="bg-c-surface-raised">
                    <td
                      colSpan={colSpan}
                      className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-c-text-muted border-b border-c-border-subtle"
                    >
                      {item.label}
                    </td>
                  </tr>
                );
              }
              const row = item.row;
              const selected = selectedRowIds.has(row.id);
              const rowConfidenceRaw = row?.data?.[PROVENANCE_DATA_KEYS.confidenceScore];
              const rowConfidence =
                typeof rowConfidenceRaw === 'number'
                  ? rowConfidenceRaw
                  : rowConfidenceRaw == null
                    ? null
                    : Number(rowConfidenceRaw);
              const rowValidationRaw = row?.data?.[PROVENANCE_DATA_KEYS.validationStatus];
              const rowValidation =
                rowValidationRaw === 'verified' ||
                rowValidationRaw === 'flagged' ||
                rowValidationRaw === 'unverified'
                  ? rowValidationRaw
                  : null;
              return (
                <tr
                  key={row.id}
                  data-testid={`table-row-${row.id}`}
                  className={`${selected ? 'bg-c-surface-raised' : ''} hover:bg-c-surface-raised`}
                  onClick={() => onOpenDetail(row.id)}
                >
                  <td
                    style={{ width: CHECK_COL_PX, minWidth: CHECK_COL_PX }}
                    className={`${bodyCell} sticky left-0 z-[8] border-r border-c-border-subtle bg-c-surface ${
                      selected ? 'bg-c-surface-raised' : ''
                    } text-center relative`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowGutterIndicator
                      confidenceScore={Number.isFinite(rowConfidence) ? rowConfidence : null}
                      validationStatus={rowValidation}
                    />
                    <input
                      type="checkbox"
                      className="rounded border-c-border-subtle"
                      checked={selected}
                      disabled={locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onCheckboxChange(row.id, i, e.shiftKey);
                      }}
                      aria-label={t('myWorkTable.gridView.selectRow')}
                    />
                  </td>
                  {visibleColumns.map((col, colIdx) => {
                    const w = widthByKey[col.key] ?? col.width ?? DEFAULT_COLUMN_WIDTH;
                    const isPrimary = colIdx === 0;
                    const missing = isMissingField(col.key, viewConfig);
                    // R5: conditional formatting — only on real (non-missing) cells.
                    // CF inline style is spread LAST so a rule's backgroundColor
                    // intentionally overrides the sticky-primary className bg.
                    const cfStyle =
                      missing || !formatRules?.length
                        ? undefined
                        : getConditionalStyle(formatRules, col.key, row.data?.[col.key]);
                    return (
                      <td
                        key={col.key}
                        style={{
                          width: w,
                          minWidth: w,
                          maxWidth: w,
                          ...(isPrimary ? { left: stickyPrimaryLeft } : {}),
                          ...(cfStyle ?? {}),
                        }}
                        className={[
                          missing
                            ? 'bg-[color-mix(in_srgb,var(--c-warning)_8%,transparent)] border-b border-[color-mix(in_srgb,var(--c-warning)_20%,transparent)] px-3 py-2 text-xs text-c-warning italic h-9 align-middle'
                            : bodyCell,
                          !missing && 'border-r border-c-border-subtle min-w-0',
                          missing &&
                            'border-r border-[color-mix(in_srgb,var(--c-warning)_20%,transparent)] min-w-0',
                          isPrimary && !missing && 'sticky z-[5] border-r border-c-border-subtle',
                          isPrimary &&
                            missing &&
                            'sticky z-[5] border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)]',
                          isPrimary &&
                            !missing &&
                            (selected ? 'bg-c-surface-raised' : 'bg-c-surface'),
                          isPrimary &&
                            missing &&
                            (selected
                              ? 'bg-c-surface-raised'
                              : 'bg-[color-mix(in_srgb,var(--c-warning)_8%,transparent)]'),
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {renderCell(row, col)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden className="pointer-events-none">
                <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        ref={footerScrollRef}
        className="shrink-0 overflow-x-auto border-t border-c-border-subtle bg-c-surface-raised"
        onScroll={onFooterScroll}
      >
        <table className="w-max min-w-full border-collapse text-left text-xs text-c-text-secondary">
          <tbody>
            <tr>
              <td
                style={{ width: CHECK_COL_PX, minWidth: CHECK_COL_PX }}
                className="sticky left-0 z-[8] border-r border-c-border-subtle bg-c-surface-raised px-3 py-2 font-semibold uppercase tracking-wider text-c-text-muted"
              >
                {t('myWorkTable.gridView.totals')}
              </td>
              {visibleColumns.map((col, colIdx) => {
                const w = widthByKey[col.key] ?? col.width ?? DEFAULT_COLUMN_WIDTH;
                const isPrimary = colIdx === 0;
                const missing = isMissingField(col.key, viewConfig);
                const fv = footerValues[colIdx] ?? '';
                const label =
                  col.aggregation && col.aggregation !== 'none'
                    ? `${col.aggregation.toUpperCase()}`
                    : '';
                return (
                  <td
                    key={col.key}
                    style={{
                      width: w,
                      minWidth: w,
                      maxWidth: w,
                      ...(isPrimary ? { left: stickyPrimaryLeft } : {}),
                    }}
                    className={`${
                      missing
                        ? 'border-r border-[color-mix(in_srgb,var(--c-warning)_20%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_6%,transparent)] px-3 py-2 text-xs text-c-warning'
                        : 'border-r border-c-border-subtle px-3 py-2 tabular-nums'
                    } ${
                      isPrimary
                        ? missing
                          ? 'sticky z-[5] border-r border-[color-mix(in_srgb,var(--c-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--c-warning)_6%,transparent)]'
                          : 'sticky z-[5] bg-c-surface-raised border-r border-c-border-subtle'
                        : ''
                    }`}
                  >
                    {missing ? '' : label && fv ? `${label}: ${fv}` : fv}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Connected: inside TableDataProvider ─────────────────────────────────────

const GridViewConnected: React.FC = () => {
  const {
    processedRows,
    groupedRows,
    visibleColumns,
    platformFields,
    locked,
    selectedRowIds,
    setSelectedRowIds,
    toggleRowSelection,
    handleFieldChange,
    ui,
    uiDispatch,
    activeViewConfig,
    removeMissingFieldFromView,
    formatRules,
  } = useTableData();

  const platformFieldById = useMemo(() => {
    const m = new Map<string, PlatformFieldMeta>();
    for (const f of platformFields) {
      m.set(f.id, {
        fieldType: f.fieldType as FieldType,
        options: (f.options ?? {}) as Record<string, unknown>,
        isComputed: Boolean(f.isComputed),
      });
    }
    return m;
  }, [platformFields]);

  const setEditingCellId = useCallback(
    (id: string | null) => {
      uiDispatch({ type: 'SET_EDITING_CELL', id });
    },
    [uiDispatch]
  );

  const onOpenDetail = useCallback(
    (rowId: string) => {
      uiDispatch({ type: 'SET_DETAIL_RECORD', id: rowId });
    },
    [uiDispatch]
  );

  const onOpenLinkedRecord = useCallback(
    (recordId: string, _tableId: string) => {
      void _tableId;
      uiDispatch({ type: 'SET_EXPANDED_RECORD', id: recordId });
    },
    [uiDispatch]
  );

  return (
    <DataGrid
      processedRows={processedRows}
      groupedRows={groupedRows}
      visibleColumns={visibleColumns}
      platformFieldById={platformFieldById}
      locked={locked}
      selectedRowIds={selectedRowIds}
      setSelectedRowIds={setSelectedRowIds}
      toggleRowSelection={toggleRowSelection}
      handleFieldChange={handleFieldChange}
      editingCellId={ui.editingCellId}
      setEditingCellId={setEditingCellId}
      onOpenDetail={onOpenDetail}
      onOpenLinkedRecord={onOpenLinkedRecord}
      viewConfig={activeViewConfig}
      onRemoveMissingField={removeMissingFieldFromView}
      formatRules={formatRules}
    />
  );
};

// ── Legacy: no TableDataProvider (props only) ────────────────────────────────

export interface GridViewProps {
  rows?: TableNode[];
  columns?: ColumnDef[];
  onNodeClick?: (nodeId: string) => void;
  onFieldChange?: (nodeId: string, field: string, value: unknown) => void;
  locked?: boolean;
}

const GridViewStandalone: React.FC<
  Required<Pick<GridViewProps, 'rows' | 'columns'>> & GridViewProps
> = ({ rows, columns, onNodeClick, onFieldChange, locked = false }) => {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [editingCellId, setEditingCellId] = useState<string | null>(null);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleFieldChange = useCallback(
    (nodeId: string, field: string, value: unknown) => {
      onFieldChange?.(nodeId, field, value);
    },
    [onFieldChange]
  );

  const platformFieldById = useMemo(() => new Map<string, PlatformFieldMeta>(), []);

  return (
    <DataGrid
      processedRows={rows}
      groupedRows={null}
      visibleColumns={visibleColumns}
      platformFieldById={platformFieldById}
      locked={locked}
      selectedRowIds={selectedRowIds}
      setSelectedRowIds={setSelectedRowIds}
      toggleRowSelection={toggleRowSelection}
      handleFieldChange={handleFieldChange}
      editingCellId={editingCellId}
      setEditingCellId={setEditingCellId}
      onOpenDetail={(id) => onNodeClick?.(id)}
      onOpenLinkedRecord={() => {}}
    />
  );
};

// ── Public entry ────────────────────────────────────────────────────────────

export const GridView: React.FC<GridViewProps> = (props) => {
  const { t } = useTranslation();
  const ctx = useContext(TableDataContext);
  /**
   * Explicit `rows`/`columns` WIN over the provider.
   *
   * Bug (widok "Galeria" pusty przy pełnej tabeli): `IdeaTableTool` renders
   * `<GridView rows={processedRowsWithRollups} columns={_cols} />` from *inside*
   * its own `<TableDataProvider>`. In legacy (non-platform) mode that provider
   * carries nothing — measured live: `processedRows: 0, visibleColumns: 0` — but
   * the context-first check below hijacked the render into `GridViewConnected`
   * and threw the passed rows away, so a table with rows showed "Brak elementów".
   * The platform path (`table/ViewRouter` → `<GridView />`, no props) still gets
   * the connected variant.
   */
  if (props.rows && props.columns) {
    return (
      <GridViewStandalone
        rows={props.rows}
        columns={props.columns}
        onNodeClick={props.onNodeClick}
        onFieldChange={props.onFieldChange}
        locked={props.locked}
      />
    );
  }
  if (ctx) {
    return <GridViewConnected />;
  }
  if (!props.rows || !props.columns) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-c-text-muted">
        {t('myWorkTable.gridView.requiresProvider')}
      </div>
    );
  }
  return (
    <GridViewStandalone
      rows={props.rows}
      columns={props.columns}
      onNodeClick={props.onNodeClick}
      onFieldChange={props.onFieldChange}
      locked={props.locked}
    />
  );
};

export default GridView;
