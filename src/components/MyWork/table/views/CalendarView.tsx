/**
 * CalendarView (Platform) — Month/week calendar renderer for the Table Platform.
 * Built from scratch with CSS Grid, no external calendar library.
 * Supports navigation, record chips, click-to-add, drag-to-reschedule.
 */
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
import { SELECT_COLORS } from '../tableTypes';

export interface CalendarViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  dateFieldId: string;
  colorByFieldId?: string;
  visibleFieldIds: string[];
  onRecordUpdate: (recordId: string, fieldId: string, value: unknown) => void;
  onRecordClick: (recordId: string) => void;
  onAddRecord: (defaultValues?: Record<string, unknown>) => void;
}

type CalendarMode = 'month' | 'week';

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const MAX_VISIBLE_PER_DAY = 3;

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; date: string; isCurrentMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({
      day: d,
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const d = cells.length - startDow - daysInMonth + 1;
    const m = month === 11 ? 1 : month + 2;
    const y = month === 11 ? year + 1 : year;
    cells.push({
      day: d,
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  return cells;
}

function getWeekDates(refDate: Date) {
  const d = new Date(refDate);
  let dow = d.getDay() - 1;
  if (dow < 0) dow = 6;
  d.setDate(d.getDate() - dow);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function parseDateStr(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

const RecordChip = React.memo<{
  record: TableNode;
  color?: string;
  onDragStart: (id: string) => void;
  onClick: (id: string) => void;
}>(({ record, color, onDragStart, onClick }) => (
  <div
    draggable
    onDragStart={(e) => {
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(record.id);
    }}
    onClick={(e) => {
      e.stopPropagation();
      onClick(record.id);
    }}
    className="truncate text-[9px] font-medium text-c-text-muted cursor-pointer hover:text-c-accent px-1.5 py-0.5 rounded bg-c-surface-raised mb-0.5 transition-colors"
    style={color ? { borderLeft: `2px solid ${color}` } : undefined}
  >
    {record.data?.label || record.id}
  </div>
));

RecordChip.displayName = 'RecordChip';

export const CalendarView: React.FC<CalendarViewProps> = ({
  records,
  columns,
  dateFieldId,
  colorByFieldId,
  onRecordUpdate,
  onRecordClick,
  onAddRecord,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const weekdays = isPl ? WEEKDAYS_PL : WEEKDAYS_EN;

  const [mode, setMode] = useState<CalendarMode>('month');
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [dragRecordId, setDragRecordId] = useState<string | null>(null);

  const dateCol = useMemo(() => columns.find((c) => c.key === dateFieldId), [columns, dateFieldId]);

  const colorCol = useMemo(
    () => (colorByFieldId ? columns.find((c) => c.key === colorByFieldId) : null),
    [columns, colorByFieldId]
  );

  const getRecordColor = useCallback(
    (record: TableNode): string | undefined => {
      if (!colorCol) return record.data?.color;
      const val = String(record.data?.[colorCol.key] || '');
      if (!val) return undefined;
      return (
        colorCol.optionColors?.[val] ||
        SELECT_COLORS[(colorCol.options || []).indexOf(val) % SELECT_COLORS.length]
      );
    },
    [colorCol]
  );

  const cells = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const recordsByDate = useMemo(() => {
    const map: Record<string, TableNode[]> = {};
    for (const record of records) {
      const dateStr = parseDateStr(record.data?.[dateFieldId]);
      if (!dateStr) continue;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(record);
    }
    return map;
  }, [dateFieldId, records]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const weekDates = useMemo(
    () => getWeekDates(new Date(viewYear, viewMonth, 1)),
    [viewYear, viewMonth]
  );

  const prevPeriod = useCallback(() => {
    if (mode === 'month') {
      setViewMonth((m) => {
        if (m === 0) {
          setViewYear((y) => y - 1);
          return 11;
        }
        return m - 1;
      });
    } else {
      const d = new Date(viewYear, viewMonth, 1);
      d.setDate(d.getDate() - 7);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [mode, viewMonth, viewYear]);

  const nextPeriod = useCallback(() => {
    if (mode === 'month') {
      setViewMonth((m) => {
        if (m === 11) {
          setViewYear((y) => y + 1);
          return 0;
        }
        return m + 1;
      });
    } else {
      const d = new Date(viewYear, viewMonth, 1);
      d.setDate(d.getDate() + 7);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [mode, viewMonth, viewYear]);

  const goToday = useCallback(() => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  }, [now]);

  const handleDrop = useCallback(
    (dateStr: string) => {
      if (!dragRecordId || !dateCol) return;
      onRecordUpdate(dragRecordId, dateFieldId, dateStr);
      setDragRecordId(null);
    },
    [dateCol, dateFieldId, dragRecordId, onRecordUpdate]
  );

  const periodLabel = useMemo(() => {
    if (mode === 'month') {
      return new Date(viewYear, viewMonth).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    const start = new Date(weekDates[0] + 'T12:00:00');
    const end = new Date(weekDates[6] + 'T12:00:00');
    return `${start.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [isPl, mode, viewMonth, viewYear, weekDates]);

  if (!dateCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-2 p-8">
        <Calendar size={32} />
        <span className="text-sm font-medium">{isPl ? 'Widok kalendarza' : 'Calendar View'}</span>
        <span className="text-xs text-c-text-secondary">
          {isPl
            ? 'Skonfiguruj pole daty w ustawieniach widoku'
            : 'Configure a date field in view settings'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <ChevronLeft size={16} className="text-c-text-muted" />
          </button>
          <span className="text-sm font-bold text-c-text capitalize min-w-[160px]">
            {periodLabel}
          </span>
          <button
            onClick={nextPeriod}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <ChevronRight size={16} className="text-c-text-muted" />
          </button>
          <button
            onClick={goToday}
            className="px-2 py-1 rounded-lg text-[10px] font-medium text-c-accent hover:bg-c-accent-soft transition-colors"
          >
            {isPl ? 'Dziś' : 'Today'}
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-0.5 rounded-lg border border-c-border-subtle p-0.5">
          {(['month', 'week'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                mode === m
                  ? 'bg-c-accent-soft text-c-accent'
                  : 'text-c-text-muted hover:bg-c-surface-raised'
              }`}
            >
              {m === 'month' ? (isPl ? 'Miesiąc' : 'Month') : isPl ? 'Tydzień' : 'Week'}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-[9px] font-bold text-center text-c-text-muted uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      {mode === 'month' && (
        <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
          {cells.map((cell, i) => {
            const dayRecords = recordsByDate[cell.date] || [];
            const isToday = cell.date === todayStr;

            return (
              <div
                key={i}
                className={`min-h-[60px] rounded-lg border p-1 transition-colors ${
                  cell.isCurrentMonth
                    ? isToday
                      ? 'border-c-accent bg-c-accent-soft'
                      : 'border-c-border-subtle bg-c-surface bg-[color-mix(in_srgb,var(--c-surface)_50%25,transparent)]'
                    : 'border-c-border-subtle bg-[color-mix(in_srgb,var(--c-surface-raised)_30%25,transparent)] bg-[color-mix(in_srgb,var(--c-bg)_30%25,transparent)]'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(cell.date)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-[10px] font-bold ${
                      isToday
                        ? 'text-c-accent'
                        : cell.isCurrentMonth
                          ? 'text-c-text-muted'
                          : 'text-c-text-muted'
                    }`}
                  >
                    {cell.day}
                  </span>
                </div>

                {dayRecords.slice(0, MAX_VISIBLE_PER_DAY).map((r) => (
                  <RecordChip
                    key={r.id}
                    record={r}
                    color={getRecordColor(r)}
                    onDragStart={setDragRecordId}
                    onClick={onRecordClick}
                  />
                ))}
                {dayRecords.length > MAX_VISIBLE_PER_DAY && (
                  <div className="text-[7px] text-c-text-muted px-1 font-medium">
                    +{dayRecords.length - MAX_VISIBLE_PER_DAY} {isPl ? 'więcej' : 'more'}
                  </div>
                )}

                {/* Click to add */}
                {cell.isCurrentMonth && dayRecords.length === 0 && (
                  <button
                    onClick={() => onAddRecord({ [dateFieldId]: cell.date })}
                    className="mt-0.5 flex items-center gap-0.5 text-[8px] text-c-accent hover:text-c-accent font-medium opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Plus size={8} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Week grid */}
      {mode === 'week' && (
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDates.map((dateStr) => {
            const dayRecords = recordsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`rounded-lg border p-2 transition-colors ${
                  isToday
                    ? 'border-c-accent bg-c-accent-soft'
                    : 'border-c-border-subtle bg-c-surface bg-[color-mix(in_srgb,var(--c-surface)_50%25,transparent)]'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(dateStr)}
              >
                <div className="text-[10px] font-bold mb-2 text-center text-c-text-muted">
                  {new Date(dateStr + 'T12:00:00').toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
                    weekday: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="space-y-1">
                  {dayRecords.map((r) => (
                    <RecordChip
                      key={r.id}
                      record={r}
                      color={getRecordColor(r)}
                      onDragStart={setDragRecordId}
                      onClick={onRecordClick}
                    />
                  ))}
                  <button
                    onClick={() => onAddRecord({ [dateFieldId]: dateStr })}
                    className="w-full flex items-center justify-center gap-0.5 py-1 rounded border border-dashed border-c-border-subtle text-[8px] text-c-text-secondary hover:text-c-accent hover:border-c-accent transition-colors"
                  >
                    <Plus size={8} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
