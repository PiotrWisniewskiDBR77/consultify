/**
 * DecisionsTimelineView — V3-C05
 *
 * Timeline view for MyWork Decisions module. Renders decisions as horizontal bars
 * on a time axis with zoom levels and priority filters.
 *
 * V3-C05 NOTE: This component replaces the "queue view" (DecisionReviewNext) from
 * view-modes. The canonical view-modes for Decisions are: table + kanban + timeline.
 * No queue/review-next.
 *
 * Preview pane compatibility: single click → select (preview), Enter/double-click → open full.
 * DBR77 "Tech Sexy": monochromatic, navy-900 dark bg, subtle borders.
 */

import { ChevronDown, GanttChart } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { DecisionPreviewPanel } from './DecisionPreviewPanel';

/* ─── Types ─── */

export interface DecisionTimelineItem {
  id: string;
  title: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  createdAt: string;
  assignee?: string;
  decisionOwnerId?: string;
  requestedById?: string;
}

export type TimelineZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export interface DecisionsTimelineViewProps {
  decisions: DecisionTimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenFull: (id: string) => void;
  zoomLevel: TimelineZoomLevel;
  onZoomChange: (zoom: TimelineZoomLevel) => void;
  priorityFilter: string[];
  onPriorityFilterChange: (priorities: string[]) => void;
}

/* ─── Integration props (for container) ─── */

type DecisionFilter = 'all' | 'my' | 'awaiting';

export interface DecisionsTimelineContainerProps {
  viewMode: DecisionFilter;
  searchQuery: string;
  onDecisionClick?: (id: string, decisionData?: any) => void;
  onCountsChange: (counts: { total: number; my: number; awaiting: number }) => void;
  refreshTrigger?: number;
}

/* ─── Priority bar styles (muted, DBR77) ─── */

const PRIORITY_STYLES: Record<string, { bg: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'bg-danger-500/20', border: 'border-danger-500/40', dot: 'bg-danger-500' },
  HIGH: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', dot: 'bg-amber-500' },
  MEDIUM: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', dot: 'bg-amber-500' },
  LOW: { bg: 'bg-slate-500/20', border: 'border-slate-500/40', dot: 'bg-slate-400' },
};

const getPriorityStyle = (priority?: string) =>
  PRIORITY_STYLES[String(priority || 'MEDIUM').toUpperCase()] || PRIORITY_STYLES.MEDIUM;

/* ─── Status badge config ─── */

const getStatusBadge = (status?: string) => {
  const s = String(status || 'PENDING').toUpperCase();
  switch (s) {
    case 'APPROVED':
      return { label: 'Approved', cls: 'bg-emerald-500/20 text-emerald-400' };
    case 'REJECTED':
      return { label: 'Rejected', cls: 'bg-danger-500/20 text-danger-400' };
    case 'DEFERRED':
      return { label: 'Deferred', cls: 'bg-amber-500/20 text-amber-400' };
    case 'ESCALATED':
      return { label: 'Escalated', cls: 'bg-amber-500/20 text-amber-400' };
    default:
      return { label: 'Pending', cls: 'bg-slate-500/20 text-slate-600' };
  }
};

/* ─── Time range helpers ─── */

const getRangeForZoom = (zoom: TimelineZoomLevel): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (zoom) {
    case 'day':
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);
      break;
    case 'week':
      start.setDate(start.getDate() - 28);
      end.setDate(end.getDate() + 28);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 3);
      end.setMonth(end.getMonth() + 3);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 6);
      end.setMonth(end.getMonth() + 6);
      break;
  }
  return { start, end };
};

const getXForDate = (date: Date, rangeStart: number, rangeEnd: number, width: number) => {
  const p = (date.getTime() - rangeStart) / (rangeEnd - rangeStart);
  return Math.max(0, Math.min(width, p * width));
};

/* ─── Presentational Timeline View ─── */

export const DecisionsTimelineView: React.FC<DecisionsTimelineViewProps> = ({
  decisions,
  selectedId,
  onSelect,
  onOpenFull,
  zoomLevel,
  onZoomChange,
  priorityFilter,
  onPriorityFilterChange,
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(600);

  const { start: rangeStart, end: rangeEnd } = getRangeForZoom(zoomLevel);
  const rangeStartTs = rangeStart.getTime();
  const rangeEndTs = rangeEnd.getTime();

  const zoomOptions: { id: TimelineZoomLevel; label: string }[] = [
    { id: 'day', label: t('myWork.decisions.timeline.zoomDay', 'Day') },
    { id: 'week', label: t('myWork.decisions.timeline.zoomWeek', 'Week') },
    { id: 'month', label: t('myWork.decisions.timeline.zoomMonth', 'Month') },
    { id: 'quarter', label: t('myWork.decisions.timeline.zoomQuarter', 'Quarter') },
  ];

  const priorityOptions = [
    { id: 'CRITICAL', label: t('priority.critical', 'Critical') },
    { id: 'HIGH', label: t('priority.high', 'High') },
    { id: 'MEDIUM', label: t('priority.medium', 'Medium') },
    { id: 'LOW', label: t('priority.low', 'Low') },
  ];

  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);

  const togglePriority = (p: string) => {
    const next = priorityFilter.includes(p)
      ? priorityFilter.filter((x) => x !== p)
      : [...priorityFilter, p];
    onPriorityFilterChange(next);
  };

  const filteredDecisions = useMemo(() => {
    if (priorityFilter.length === 0) return decisions;
    return decisions.filter((d) =>
      priorityFilter.includes(String(d.priority || 'MEDIUM').toUpperCase())
    );
  }, [decisions, priorityFilter]);

  const barHeight = 36;
  const barGap = 8;
  const rowHeight = barHeight + barGap;

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 600;
      setTimelineWidth(Math.max(200, w - 140)); // subtract title column (w-32 + gap)
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && selectedId) {
        e.preventDefault();
        onOpenFull(selectedId);
      }
    },
    [selectedId, onOpenFull]
  );

  return (
    <div className="flex h-full overflow-hidden bg-c-bg" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-c-border-subtle bg-c-surface">
          {/* Zoom controls — pill button group */}
          <div
            className="inline-flex rounded-full border border-c-border-subtle bg-c-surface-raised p-0.5"
            role="group"
          >
            {zoomOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onZoomChange(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  zoomLevel === opt.id
                    ? 'bg-c-accent-soft text-c-text'
                    : 'text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Priority filter — checkboxes in dropdown */}
          <div className="relative">
            <button
              onClick={() => setPriorityDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised transition-colors"
            >
              <GanttChart size={14} />
              {t('myWork.decisions.timeline.priorityFilter', 'Priority')}
              {priorityFilter.length > 0 && (
                <span className="rounded-full bg-c-accent-soft px-1.5 py-0.5 text-[10px] text-c-accent">
                  {priorityFilter.length}
                </span>
              )}
              <ChevronDown size={12} className="text-c-text-muted" />
            </button>
            {priorityDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPriorityDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-lg border border-c-border-subtle bg-c-surface py-2 shadow-xl">
                  {priorityOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-c-surface-raised"
                    >
                      <input
                        type="checkbox"
                        checked={priorityFilter.includes(opt.id)}
                        onChange={() => togglePriority(opt.id)}
                        className="rounded border-c-border-subtle bg-c-surface-raised text-c-accent focus:ring-c-focus"
                      />
                      <span className="text-sm text-c-text-secondary">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-auto p-4" ref={chartRef}>
          <div className="min-h-[400px] rounded-xl border border-c-border-subtle bg-c-surface">
            {/* X-axis labels */}
            <div className="flex justify-between px-4 py-2 text-[10px] uppercase tracking-wider text-c-text-muted border-b border-c-border-subtle">
              <span>
                {rangeStart.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit',
                })}
              </span>
              <span>
                {rangeEnd.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit',
                })}
              </span>
            </div>

            {/* Timeline grid + bars */}
            <div
              className="relative"
              style={{ minHeight: filteredDecisions.length * rowHeight + 40 }}
            >
              {filteredDecisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-c-text-muted">
                  <GanttChart size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">
                    {t('myWork.decisions.timeline.empty', 'No decisions in range')}
                  </p>
                </div>
              ) : (
                filteredDecisions.map((item, idx) => {
                  const created = new Date(item.createdAt);
                  const endDate = item.dueDate
                    ? new Date(item.dueDate)
                    : new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);
                  const startX = getXForDate(created, rangeStartTs, rangeEndTs, timelineWidth - 32);
                  const endX = getXForDate(endDate, rangeStartTs, rangeEndTs, timelineWidth - 32);
                  const barWidth = Math.max(60, endX - startX);
                  const style = getPriorityStyle(item.priority);
                  const statusBadge = getStatusBadge(item.status);
                  const isSelected = selectedId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2"
                      style={{ height: rowHeight }}
                    >
                      <div
                        className="w-32 shrink-0 text-xs text-c-text-secondary truncate"
                        title={item.title}
                      >
                        {item.title.slice(0, 20)}
                        {item.title.length > 20 ? '…' : ''}
                      </div>
                      <div className="flex-1 relative h-9">
                        <button
                          type="button"
                          onClick={() => onSelect(item.id)}
                          onDoubleClick={() => onOpenFull(item.id)}
                          className={`absolute top-0 h-9 rounded-lg border flex items-center gap-2 px-2 min-w-[60px] transition-all ${style.bg} ${style.border} ${
                            isSelected
                              ? 'ring-2 ring-c-focus ring-offset-2 ring-offset-c-surface'
                              : 'hover:brightness-110'
                          }`}
                          style={{
                            left: startX,
                            width: barWidth,
                          }}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                          <span className="text-xs font-medium text-c-text truncate flex-1 text-left">
                            {item.title}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Container (fetches data, manages state) ─── */

export const DecisionsTimelineContainer: React.FC<DecisionsTimelineContainerProps> = ({
  viewMode,
  searchQuery,
  onDecisionClick,
  onCountsChange,
  refreshTrigger,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const [decisions, setDecisions] = useState<DecisionTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>('week');
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);

  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getDecisions();
      const raw = Array.isArray(data) ? data : [];
      const mapped: DecisionTimelineItem[] = raw.map((d: any) => ({
        id: d.id,
        title: d.title || 'Untitled',
        status: d.status || 'PENDING',
        priority: (d.priority || 'MEDIUM').toUpperCase() as DecisionTimelineItem['priority'],
        dueDate: d.dueDate || d.deadline,
        createdAt: d.createdAt || d.created_at || new Date().toISOString(),
        assignee: d.ownerName || d.owner_name,
        decisionOwnerId: d.decisionOwnerId || d.decision_maker_id,
        requestedById: d.requestedById || d.requested_by_id,
      }));
      setDecisions(mapped);
    } catch (e) {
      console.error('Failed to fetch decisions:', e);
      const msg = t('myWork.decisions.fetchFailed', 'Failed to load decisions');
      toast.error(msg);
      setLoadError(msg);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions, refreshTrigger]);

  const filteredDecisions = useMemo(() => {
    let result = decisions;
    const userId = currentUser?.id;
    const isMine = (d: DecisionTimelineItem) => Boolean(userId) && d.decisionOwnerId === userId;
    const isAwaiting = (d: DecisionTimelineItem) =>
      Boolean(userId) && d.requestedById === userId && d.decisionOwnerId !== userId;

    if (viewMode === 'my') result = result.filter(isMine);
    else if (viewMode === 'awaiting') result = result.filter(isAwaiting);
    else result = result.filter((d) => isMine(d) || isAwaiting(d));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.title?.toLowerCase().includes(q));
    }
    return result;
  }, [decisions, viewMode, searchQuery, currentUser?.id]);

  useEffect(() => {
    const myCount = decisions.filter(
      (d) => currentUser?.id && d.decisionOwnerId === currentUser.id
    ).length;
    const awaitingCount = decisions.filter(
      (d) =>
        currentUser?.id &&
        d.requestedById === currentUser.id &&
        d.decisionOwnerId !== currentUser.id
    ).length;
    onCountsChange({ total: myCount + awaitingCount, my: myCount, awaiting: awaitingCount });
  }, [decisions, currentUser?.id, onCountsChange]);

  const handleOpenFull = useCallback(
    (id: string) => {
      onDecisionClick?.(id);
    },
    [onDecisionClick]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center h-64 bg-c-bg">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center h-full bg-c-bg">
        <ErrorState message={loadError} retry={fetchDecisions} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex-1 min-w-0">
        <DecisionsTimelineView
          decisions={filteredDecisions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onOpenFull={handleOpenFull}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
        />
      </div>
      <DecisionPreviewPanel
        decisionId={selectedId}
        mode={viewMode === 'awaiting' ? 'requests_pending' : viewMode === 'my' ? 'my' : 'all'}
        onClose={() => setSelectedId(null)}
        onDidMutate={fetchDecisions}
        onOpenFullDetail={(id) => handleOpenFull(id)}
      />
    </div>
  );
};

export default DecisionsTimelineView;
