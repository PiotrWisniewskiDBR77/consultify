/**
 * GalleryView (Platform) — Responsive card gallery renderer for the Table Platform.
 * Shows records as visual cards with optional cover image, title, metadata fields,
 * and status badge. Supports configurable card sizes.
 */
import { Image, Star } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
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
      className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-800 overflow-hidden cursor-pointer hover:shadow-lg hover:border-violet-300/60 dark:hover:border-violet-500/30 hover:-translate-y-0.5 transition-all group"
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
              : 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
          }}
        >
          {emoji ? (
            <span className={cardSize === 'large' ? 'text-3xl' : 'text-2xl'}>{emoji}</span>
          ) : (
            <span
              className={`${cardSize === 'large' ? 'text-xl' : 'text-lg'} font-bold opacity-30`}
              style={{ color: color || '#6366f1' }}
            >
              {(record.data?.label || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className={cardSize === 'small' ? 'p-2' : 'p-3'}>
        <div
          className={`font-bold text-slate-800 dark:text-slate-200 truncate mb-1.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors ${
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
                '#e0e7ff';
              return (
                <span
                  key={col.key}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold"
                  style={{ backgroundColor: bgColor, color: '#334155' }}
                >
                  {String(val)}
                </span>
              );
            }

            if (col.type === 'rating') {
              return (
                <span key={col.key} className="inline-flex items-center gap-0.5 text-amber-500">
                  <Star size={8} className="fill-amber-400" />
                  <span className="text-[8px] font-bold">{val}</span>
                </span>
              );
            }

            if (col.type === 'progress') {
              const pct = Math.min(Number(val) || 0, 100);
              return (
                <div key={col.key} className="flex items-center gap-1">
                  <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-slate-400">{pct}%</span>
                </div>
              );
            }

            if (col.type === 'checkbox') {
              return val ? (
                <span key={col.key} className="text-[8px] text-emerald-500 font-bold">
                  ✓
                </span>
              ) : null;
            }

            if (col.type === 'date') {
              const dateStr = String(val).slice(0, 10);
              return (
                <span key={col.key} className="text-[8px] text-slate-400 dark:text-slate-500">
                  {dateStr}
                </span>
              );
            }

            return (
              <span
                key={col.key}
                className="text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]"
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

  const displayColumns = useMemo(() => {
    const visible = new Set(visibleFieldIds);
    return columns
      .filter(
        (c) =>
          visible.has(c.key) && c.key !== 'label' && c.key !== 'type' && c.key !== coverImageFieldId
      )
      .slice(0, 5);
  }, [columns, coverImageFieldId, visibleFieldIds]);

  if (records.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3 p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
          <Image size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <span className="text-sm font-medium">{isPl ? 'Brak elementów' : 'No records'}</span>
        <span className="text-xs text-slate-400/70">
          {isPl ? 'Dodaj pierwszy rekord, aby zobaczyć galerię' : 'Add a record to see the gallery'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className={`grid ${GRID_CLASSES[cardSize]} gap-3`}>
        {records.map((record) => (
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
    </div>
  );
};

export default GalleryView;
