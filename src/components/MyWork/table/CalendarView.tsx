/**
 * CalendarView — Monthly/weekly/daily calendar showing rows on their date.
 * Supports month/week/day modes, navigation, click-to-detail, drag-to-reschedule, add event on slot click.
 */
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

type CalendarMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  rows: TableNode[];
  columns: ColumnDef[];
  locked?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onFieldChange?: (nodeId: string, field: string, value: any) => void;
  onAddEventAtDate?: (dateStr: string) => void;
}

const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_PL = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { day: number | null; date: string | null }[] = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, date: null });
  return cells;
}

function getWeekDates(year: number, month: number, day: number) {
  const d = new Date(year, month, day);
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

function parseDateStr(val: any): string | null {
  if (!val) return null;
  const s = String(val).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseHour(val: any): number {
  if (!val) return 8;
  const s = String(val);
  if (s.length <= 10) return 8;
  const d = new Date(val);
  if (isNaN(d.getTime())) return 8;
  return d.getHours();
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  rows,
  columns,
  locked = false,
  onNodeClick,
  onFieldChange,
  onAddEventAtDate,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const weekdays = isPl ? WEEKDAYS_PL : WEEKDAYS_EN;

  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewDay, setViewDay] = useState(now.getDate());
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<{ date: string; hour?: number } | null>(null);

  const dateCol = useMemo(
    () =>
      columns.find((c) => c.type === 'date' && c.visible) ?? columns.find((c) => c.type === 'date'),
    [columns]
  );

  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const rowsByDate = useMemo(() => {
    const map: Record<string, TableNode[]> = {};
    if (!dateCol) return map;
    for (const row of rows) {
      const dateStr = parseDateStr(row.data?.[dateCol.key]);
      if (!dateStr) continue;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(row);
    }
    return map;
  }, [dateCol, rows]);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const weekDates = useMemo(
    () => getWeekDates(viewYear, viewMonth, viewDay),
    [viewYear, viewMonth, viewDay]
  );

  const prevPeriod = useCallback(() => {
    if (calendarMode === 'month') {
      setViewMonth((m) => {
        if (m === 0) {
          setViewYear((y) => y - 1);
          return 11;
        }
        return m - 1;
      });
    } else {
      const d = new Date(viewYear, viewMonth, viewDay);
      d.setDate(d.getDate() - (calendarMode === 'week' ? 7 : 1));
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setViewDay(d.getDate());
    }
  }, [calendarMode, viewDay, viewMonth, viewYear]);

  const nextPeriod = useCallback(() => {
    if (calendarMode === 'month') {
      setViewMonth((m) => {
        if (m === 11) {
          setViewYear((y) => y + 1);
          return 0;
        }
        return m + 1;
      });
    } else {
      const d = new Date(viewYear, viewMonth, viewDay);
      d.setDate(d.getDate() + (calendarMode === 'week' ? 7 : 1));
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setViewDay(d.getDate());
    }
  }, [calendarMode, viewDay, viewMonth, viewYear]);

  const handleDrop = useCallback(
    (dateStr: string) => {
      if (!dragNodeId || !dateCol || locked) return;
      onFieldChange?.(dragNodeId, dateCol.key, dateStr);
      setDragNodeId(null);
    },
    [dateCol, dragNodeId, locked, onFieldChange]
  );

  const handleSlotClick = useCallback(
    (dateStr: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (locked || !onAddEventAtDate) return;
      onAddEventAtDate(dateStr);
      setHoverSlot(null);
    },
    [locked, onAddEventAtDate]
  );

  const periodLabel = useMemo(() => {
    if (calendarMode === 'month') {
      return new Date(viewYear, viewMonth).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (calendarMode === 'week') {
      const start = new Date(viewYear, viewMonth, viewDay);
      let dow = start.getDay() - 1;
      if (dow < 0) dow = 6;
      start.setDate(start.getDate() - dow);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
        day: 'numeric',
        month: 'short',
      })} – ${end.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }
    return new Date(viewYear, viewMonth, viewDay).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [calendarMode, isPl, viewDay, viewMonth, viewYear]);

  const modeButtons = useMemo(
    () => (
      <div className="flex gap-0.5 rounded-lg border border-c-border-subtle p-0.5">
        {(['month', 'week', 'day'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setCalendarMode(mode)}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              calendarMode === mode
                ? 'bg-c-surface-raised text-c-text'
                : 'text-c-text-muted hover:bg-c-surface-raised'
            }`}
          >
            {mode === 'month'
              ? t('myWorkTable.calendarView.month')
              : mode === 'week'
                ? t('myWorkTable.calendarView.week')
                : t('myWorkTable.calendarView.day')}
          </button>
        ))}
      </div>
    ),
    [calendarMode, isPl]
  );

  if (!dateCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-2 p-8">
        <Calendar size={32} />
        <span className="text-sm font-medium">{t('myWorkTable.calendarView.calendarView')}</span>
        <span className="text-xs text-c-text-muted">
          {t('myWorkTable.calendarView.addADateColumnTo')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <ChevronLeft size={16} className="text-c-text-muted" />
          </button>
          <span className="text-sm font-bold text-c-text-secondary capitalize min-w-[140px]">
            {periodLabel}
          </span>
          <button
            onClick={nextPeriod}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <ChevronRight size={16} className="text-c-text-muted" />
          </button>
        </div>
        {modeButtons}
      </div>

      {calendarMode === 'month' && (
        <>
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
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
            {cells.map((cell, i) => {
              const dayRows = cell.date ? rowsByDate[cell.date] || [] : [];
              const isToday = cell.date === todayStr;
              const canAdd =
                cell.date &&
                !locked &&
                onAddEventAtDate &&
                (hoverSlot?.date === cell.date || dayRows.length === 0);
              return (
                <div
                  key={i}
                  className={`min-h-[60px] rounded-lg border p-1 transition-colors ${
                    cell.day != null
                      ? isToday
                        ? 'border-[color-mix(in_srgb,var(--c-info)_50%,transparent)] bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)]'
                        : 'border-c-border-subtle bg-c-surface'
                      : 'border-transparent'
                  }`}
                  onDragOver={(e) => {
                    if (cell.date) e.preventDefault();
                  }}
                  onDrop={() => cell.date && handleDrop(cell.date)}
                  onMouseEnter={() => cell.date && setHoverSlot({ date: cell.date! })}
                  onMouseLeave={() => setHoverSlot(null)}
                >
                  {cell.day != null && (
                    <>
                      <div
                        className={`text-[10px] font-bold mb-0.5 ${
                          isToday ? 'text-c-info' : 'text-c-text-muted'
                        }`}
                      >
                        {cell.day}
                      </div>
                      {dayRows.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          draggable={!locked}
                          onDragStart={() => setDragNodeId(r.id)}
                          onClick={() => onNodeClick?.(r.id)}
                          className="truncate text-[8px] font-medium text-c-text-secondary cursor-pointer hover:text-c-info px-1 py-0.5 rounded bg-c-surface-raised mb-0.5 transition-colors"
                          style={
                            r.data?.color ? { borderLeft: `2px solid ${r.data.color}` } : undefined
                          }
                        >
                          {r.data?.label || r.id}
                        </div>
                      ))}
                      {dayRows.length > 3 && (
                        <div className="text-[7px] text-c-text-muted px-1">
                          +{dayRows.length - 3}
                        </div>
                      )}
                      {canAdd && (
                        <button
                          onClick={(e) => cell.date && handleSlotClick(cell.date, e)}
                          className="mt-1 flex items-center gap-1 text-[8px] text-c-info hover:brightness-110 font-medium"
                        >
                          <Plus size={10} />
                          {t('myWorkTable.calendarView.addEvent')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {calendarMode === 'week' && (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-[48px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-px min-w-[600px]">
            <div className="row-span-1" />
            {weekDates.map((dateStr) => (
              <div
                key={dateStr}
                className={`text-[9px] font-bold text-center py-1 ${
                  dateStr === todayStr
                    ? 'text-c-info bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)]'
                    : 'text-c-text-muted'
                }`}
              >
                {new Date(dateStr + 'T12:00:00').toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </div>
            ))}
            {HOURS.map((hour) => (
              <React.Fragment key={hour}>
                <div className="text-[9px] text-c-text-muted py-0.5 pr-1 text-right">{hour}:00</div>
                {weekDates.map((dateStr) => {
                  const dayRows = rowsByDate[dateStr] || [];
                  const isToday = dateStr === todayStr;
                  const slotKey = `${dateStr}-${hour}`;
                  const isHovered = hoverSlot?.date === dateStr && hoverSlot?.hour === hour;
                  const canAdd = !locked && onAddEventAtDate && (isHovered || dayRows.length === 0);
                  return (
                    <div
                      key={slotKey}
                      className={`min-h-[32px] rounded border transition-colors ${
                        isToday
                          ? 'border-[color-mix(in_srgb,var(--c-info)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-info)_6%,transparent)]'
                          : 'border-c-border-subtle bg-c-surface'
                      } ${canAdd ? 'hover:bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)]' : ''}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(dateStr)}
                      onMouseEnter={() => setHoverSlot({ date: dateStr, hour })}
                      onMouseLeave={() => setHoverSlot(null)}
                      onClick={(e) => {
                        if (canAdd) handleSlotClick(dateStr, e);
                      }}
                    >
                      {hour === 8 &&
                        dayRows.map((r) => (
                          <div
                            key={r.id}
                            draggable={!locked}
                            onDragStart={() => setDragNodeId(r.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onNodeClick?.(r.id);
                            }}
                            className="truncate text-[9px] font-medium text-c-text-secondary cursor-pointer hover:text-c-info px-1.5 py-0.5 rounded bg-c-surface-raised mb-0.5 transition-colors border-l-2"
                            style={
                              r.data?.color
                                ? { borderLeftColor: r.data.color }
                                : { borderLeftColor: 'transparent' }
                            }
                          >
                            {r.data?.label || r.id}
                          </div>
                        ))}
                      {canAdd && hour === 8 && dayRows.length === 0 && (
                        <button
                          onClick={(e) => handleSlotClick(dateStr, e)}
                          className="flex items-center gap-1 text-[8px] text-c-info hover:brightness-110 font-medium p-1"
                        >
                          <Plus size={10} />
                          {t('myWorkTable.calendarView.addEvent')}
                        </button>
                      )}
                      {canAdd && hour !== 8 && isHovered && (
                        <button
                          onClick={(e) => handleSlotClick(dateStr, e)}
                          className="flex items-center gap-1 text-[8px] text-c-info hover:brightness-110 font-medium p-1"
                        >
                          <Plus size={10} />
                          {t('myWorkTable.calendarView.addEvent')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {calendarMode === 'day' && (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-[48px_1fr] gap-px min-w-[200px]">
            <div className="row-span-1" />
            <div
              className={`text-sm font-bold py-2 ${
                todayStr ===
                `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(viewDay).padStart(2, '0')}`
                  ? 'text-c-info'
                  : 'text-c-text-secondary'
              }`}
            >
              {periodLabel}
            </div>
            {HOURS.map((hour) => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(viewDay).padStart(2, '0')}`;
              const dayRows = rowsByDate[dateStr] || [];
              const rowsAtHour = dayRows.filter((r) => parseHour(r.data?.[dateCol.key]) === hour);
              const isToday = dateStr === todayStr;
              const isHovered = hoverSlot?.date === dateStr && hoverSlot?.hour === hour;
              const canAdd = !locked && onAddEventAtDate && (isHovered || rowsAtHour.length === 0);
              return (
                <React.Fragment key={hour}>
                  <div className="text-[9px] text-c-text-muted py-1 pr-1 text-right">{hour}:00</div>
                  <div
                    className={`min-h-[40px] rounded border transition-colors ${
                      isToday
                        ? 'border-[color-mix(in_srgb,var(--c-info)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-info)_6%,transparent)]'
                        : 'border-c-border-subtle bg-c-surface'
                    } ${canAdd ? 'hover:bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)]' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(dateStr)}
                    onMouseEnter={() => setHoverSlot({ date: dateStr, hour })}
                    onMouseLeave={() => setHoverSlot(null)}
                    onClick={(e) => {
                      if (canAdd) handleSlotClick(dateStr, e);
                    }}
                  >
                    {rowsAtHour.map((r) => (
                      <div
                        key={r.id}
                        draggable={!locked}
                        onDragStart={() => setDragNodeId(r.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNodeClick?.(r.id);
                        }}
                        className="truncate text-[10px] font-medium text-c-text-secondary cursor-pointer hover:text-c-info px-2 py-1 rounded bg-c-surface-raised mb-0.5 transition-colors border-l-2"
                        style={
                          r.data?.color
                            ? { borderLeftColor: r.data.color }
                            : { borderLeftColor: 'transparent' }
                        }
                      >
                        {r.data?.label || r.id}
                      </div>
                    ))}
                    {canAdd && (
                      <button
                        onClick={(e) => handleSlotClick(dateStr, e)}
                        className="flex items-center gap-1 text-[9px] text-c-info hover:brightness-110 font-medium p-1.5"
                      >
                        <Plus size={12} />
                        {t('myWorkTable.calendarView.addEvent')}
                      </button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
