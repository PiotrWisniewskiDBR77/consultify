/**
 * GalleryView (Platform) — Responsive card gallery renderer for the Table Platform.
 * Shows records as visual cards with optional cover image, title, metadata fields,
 * and status badge. Supports configurable card sizes, plus sort and filter controls
 * reusing the same `FilterPanel` UI and `filterEval` evaluator as the Grid view.
 */
import { ArrowDownAZ, ArrowUpAZ, Filter, Image, Star } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { evaluateFilterRule } from '../filterEval';
import { FilterPanel } from '../FilterPanel';
import type { ColumnDef, FilterGroup, TableNode } from '../tableTypes';
import { SELECT_COLORS } from '../tableTypes';

export type CardSize = 'small' | 'medium' | 'large';

export interface GalleryViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  visibleFieldIds: string[];
  coverImageFieldId?: string;
  cardSize: CardSize;
  onRecordClick: (recordId: string) => void;
}

const EMPTY_FILTERS: FilterGroup = { logic: 'and', rules: [] };

const GRID_CLASSES: Record<CardSize, string> = {
  small: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  medium: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

const COVER_HEIGHT: Record<CardSize, string> = {
  small: 'h-16',
  medium: 'h-24',
  large: 'h-36',
};

const GalleryCard = React.memo<{
  record: TableNode;
  displayColumns: ColumnDef[];
  coverImageFieldId?: string;
  cardSize: CardSize;
  onClick: (id: string) => void;
}>(({ record, displayColumns, coverImageFieldId, cardSize, onClick }) => {
  const coverUrl = coverImageFieldId
    ? record.data?.[coverImageFieldId]
    : record.data?.coverImage || record.data?.thumbnail;
  const emoji = record.data?.icon || record.data?.emoji;
  const color = record.data?.color;

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface-raised overflow-hidden cursor-pointer hover:shadow-lg hover:border-c-accent hover:-translate-y-0.5 transition-all group"
      onClick={() => onClick(record.id)}
    >
      {/* Cover area */}
      {coverUrl ? (
        <div
          className={`${COVER_HEIGHT[cardSize]} bg-cover bg-center`}
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      ) : (
        <div
          className={`${cardSize === 'small' ? 'h-12' : cardSize === 'medium' ? 'h-16' : 'h-20'} flex items-center justify-center`}
          style={{
            background: color
              ? `linear-gradient(135deg, ${color}30, ${color}10)`
              : 'linear-gradient(135deg, color-mix(in srgb, var(--c-tag-2) 18%, transparent), color-mix(in srgb, var(--c-tag-3) 14%, transparent))',
          }}
        >
          {emoji ? (
            <span className={cardSize === 'large' ? 'text-3xl' : 'text-2xl'}>{emoji}</span>
          ) : (
            <span
              className={`${cardSize === 'large' ? 'text-xl' : 'text-lg'} font-bold opacity-30`}
              style={{ color: color || 'var(--c-tag-2)' }}
            >
              {(record.data?.label || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cardSize === 'small' ? 'p-2' : 'p-3'}>
        <div
          className={`font-bold text-c-text truncate mb-1.5 group-hover:text-c-accent transition-colors ${
            cardSize === 'small' ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {record.data?.label || record.id}
        </div>

        {/* Property pills */}
        <div className="flex flex-wrap gap-1">
          {displayColumns.map((col) => {
            const val = record.data?.[col.key];
            if (val == null || val === '') return null;

            if (col.type === 'select' || col.type === 'status') {
              const bgColor =
                col.optionColors?.[String(val)] ||
                SELECT_COLORS[(col.options || []).indexOf(String(val)) % SELECT_COLORS.length] ||
                'color-mix(in srgb, var(--c-tag-2) 18%, transparent)';
              return (
                <span
                  key={col.key}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold"
                  style={{ backgroundColor: bgColor, color: 'var(--c-text-secondary)' }}
                >
                  {String(val)}
                </span>
              );
            }

            if (col.type === 'rating') {
              return (
                <span key={col.key} className="inline-flex items-center gap-0.5 text-c-warning">
                  <Star size={8} className="fill-amber-400" />
                  <span className="text-[8px] font-bold">{val}</span>
                </span>
              );
            }

            if (col.type === 'progress') {
              const pct = Math.min(Number(val) || 0, 100);
              return (
                <div key={col.key} className="flex items-center gap-1">
                  <div className="w-10 h-1 rounded-full bg-c-surface-raised overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-c-success' : pct >= 40 ? 'bg-c-warning' : 'bg-c-danger'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-c-text-secondary">{pct}%</span>
                </div>
              );
            }

            if (col.type === 'checkbox') {
              return val ? (
                <span key={col.key} className="text-[8px] text-c-success font-bold">
                  ✓
                </span>
              ) : null;
            }

            if (col.type === 'date') {
              const dateStr = String(val).slice(0, 10);
              return (
                <span key={col.key} className="text-[8px] text-c-text-muted">
                  {dateStr}
                </span>
              );
            }

            return (
              <span
                key={col.key}
                className="text-[8px] text-c-text-muted truncate max-w-[80px]"
              >
                {String(val)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
});

GalleryCard.displayName = 'GalleryCard';

export const GalleryView: React.FC<GalleryViewProps> = ({
  records,
  columns,
  visibleFieldIds,
  coverImageFieldId,
  cardSize,
  onRecordClick,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [filters, setFilters] = useState<FilterGroup>(EMPTY_FILTERS);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const displayColumns = useMemo(() => {
    const visible = new Set(visibleFieldIds);
    return columns
      .filter(
        (c) =>
          visible.has(c.key) && c.key !== 'label' && c.key !== 'type' && c.key !== coverImageFieldId
      )
      .slice(0, 5);
  }, [columns, coverImageFieldId, visibleFieldIds]);

  const sortableColumns = useMemo(() => {
    const hasLabel = columns.some((c) => c.key === 'label');
    return hasLabel
      ? columns
      : [{ key: 'label', header: isPl ? 'Nazwa' : 'Name' } as ColumnDef, ...columns];
  }, [columns, isPl]);

  const filteredRecords = useMemo(() => {
    if (filters.rules.length === 0) return records;
    return records.filter((record) => {
      const results = filters.rules.map((rule) => evaluateFilterRule(rule, record));
      return filters.logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    });
  }, [records, filters]);

  const sortedRecords = useMemo(() => {
    if (!sortKey) return filteredRecords;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredRecords].sort((a, b) => {
      const av = a.data?.[sortKey] ?? a.data?.label ?? '';
      const bv = b.data?.[sortKey] ?? b.data?.label ?? '';
      const an = Number(av);
      const bn = Number(bv);
      if (Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== '') {
        return (an - bn) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [filteredRecords, sortKey, sortDir]);

  const activeFilterCount = filters.rules.length;

  const toolbar = (
    <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-wrap">
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowFilterPanel((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
            activeFilterCount > 0
              ? 'bg-c-accent-soft text-c-accent'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
        >
          <Filter size={12} />
          {isPl ? 'Filtruj' : 'Filter'}
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-c-accent text-white text-[9px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <FilterPanel
          open={showFilterPanel}
          onClose={() => setShowFilterPanel(false)}
          filters={filters}
          onChange={setFilters}
          columns={columns}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Sortuj' : 'Sort'}
        </span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="text-[11px] font-medium px-2 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary"
        >
          <option value="">{isPl ? 'Brak' : 'None'}</option>
          {sortableColumns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.header}
            </option>
          ))}
        </select>
        {sortKey && (
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 rounded-lg text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            title={
              sortDir === 'asc'
                ? isPl
                  ? 'Rosnąco'
                  : 'Ascending'
                : isPl
                  ? 'Malejąco'
                  : 'Descending'
            }
          >
            {sortDir === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />}
          </button>
        )}
      </div>
    </div>
  );

  if (records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-3 p-8">
        <div className="w-16 h-16 rounded-2xl bg-c-surface-raised flex items-center justify-center">
          <Image size={28} className="text-c-text-muted" />
        </div>
        <span className="text-sm font-medium">{isPl ? 'Brak elementów' : 'No records'}</span>
        <span className="text-xs text-c-text-secondary">
          {isPl ? 'Dodaj pierwszy rekord, aby zobaczyć galerię' : 'Add a record to see the gallery'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {toolbar}
      <div className="flex-1 overflow-auto p-4 pt-2">
        {sortedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-c-text-muted gap-2 p-8">
            <span className="text-sm font-medium">
              {isPl ? 'Brak wyników dla tych filtrów' : 'No results for these filters'}
            </span>
          </div>
        ) : (
          <div className={`grid ${GRID_CLASSES[cardSize]} gap-3`}>
            {sortedRecords.map((record) => (
              <GalleryCard
                key={record.id}
                record={record}
                displayColumns={displayColumns}
                coverImageFieldId={coverImageFieldId}
                cardSize={cardSize}
                onClick={onRecordClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryView;
