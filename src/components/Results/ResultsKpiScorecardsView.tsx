import { Flag, Link2, MessageCircle, Milestone, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsTrackedInitiative } from './kpiDomain';
import { createResultsShowcaseGoals, shouldUseResultsShowcaseData } from './resultsShowcaseData';

interface ResultsKpiScorecardsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  initiatives?: ResultsTrackedInitiative[];
}

type GoalApiRow = {
  id: string;
  parent_goal_id?: string | null;
  goal_type?: string | null;
  title?: string | null;
  description?: string | null;
  owner_id?: string | null;
  time_frame?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  progress?: number | null;
  target_value?: number | null;
  current_value?: number | null;
  unit?: string | null;
};

type GoalRollup = {
  linkedInitiatives?: number;
  childGoals?: number;
  initiativeProgressCount?: number;
  rollupProgress?: number;
};

type GoalItem = PreviewableItem & {
  goalType: string;
  title: string;
  description: string;
  ownerId: string | null;
  timeFrame: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  progress: number;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  parentGoalId: string | null;
  linkedInitiativesCount: number;
  rollupProgress: number;
  childGoals: number;
};

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus';

const normalizeGoal = (goal: GoalApiRow, rollup?: GoalRollup): GoalItem => ({
  id: goal.id,
  title: goal.title || 'Untitled scorecard',
  goalType: String(goal.goal_type || 'objective'),
  description: goal.description || '',
  ownerId: goal.owner_id || null,
  timeFrame: goal.time_frame || null,
  startDate: goal.start_date || null,
  endDate: goal.end_date || null,
  status: String(goal.status || 'active'),
  progress: Number(goal.progress || 0),
  targetValue: goal.target_value != null ? Number(goal.target_value) : null,
  currentValue: goal.current_value != null ? Number(goal.current_value) : null,
  unit: goal.unit || null,
  parentGoalId: goal.parent_goal_id || null,
  linkedInitiativesCount: Number(rollup?.linkedInitiatives || 0),
  rollupProgress: Number(rollup?.rollupProgress || 0),
  childGoals: Number(rollup?.childGoals || 0),
});

const formatGoalType = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === 'scorecard') return 'Scorecard';
  if (normalized === 'key_result') return 'Key result';
  return 'Objective';
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

export const ResultsKpiScorecardsView: React.FC<ResultsKpiScorecardsViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  initiatives = [],
}) => {
  const { t } = useTranslation();
  const openChatWithContext = useOpenChatWithContext();
  const [items, setItems] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkedInitiatives, setSelectedLinkedInitiatives] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [goalType, setGoalType] = useState('scorecard');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeFrame, setTimeFrame] = useState('Q2 2026');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('%');
  const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await Api.goalsGet();
      const rawGoals = (response?.goals || []) as GoalApiRow[];
      if (rawGoals.length === 0 && shouldUseResultsShowcaseData()) {
        setItems(
          createResultsShowcaseGoals().map((goal) => ({
            id: goal.id,
            title: goal.title,
            goalType: goal.goalType,
            description: goal.description || '',
            ownerId: goal.ownerId || null,
            timeFrame: goal.timeFrame || null,
            startDate: goal.startDate || null,
            endDate: goal.endDate || null,
            status: goal.status,
            progress: goal.progress,
            targetValue: goal.targetValue || null,
            currentValue: goal.currentValue || null,
            unit: goal.unit || null,
            parentGoalId: goal.parentGoalId || null,
            linkedInitiativesCount: goal.linkedInitiativesCount,
            rollupProgress: goal.rollupProgress,
            childGoals: 0,
          }))
        );
        return;
      }

      const withRollups = await Promise.all(
        rawGoals.map(async (goal) => {
          try {
            const rollup = await Api.goalsGetRollup(goal.id);
            return normalizeGoal(goal, rollup);
          } catch {
            return normalizeGoal(goal);
          }
        })
      );

      setItems(withRollups);
    } catch {
      setItems(
        shouldUseResultsShowcaseData()
          ? createResultsShowcaseGoals().map((goal) => ({
              id: goal.id,
              title: goal.title,
              goalType: goal.goalType,
              description: goal.description || '',
              ownerId: goal.ownerId || null,
              timeFrame: goal.timeFrame || null,
              startDate: goal.startDate || null,
              endDate: goal.endDate || null,
              status: goal.status,
              progress: goal.progress,
              targetValue: goal.targetValue || null,
              currentValue: goal.currentValue || null,
              unit: goal.unit || null,
              parentGoalId: goal.parentGoalId || null,
              linkedInitiativesCount: goal.linkedInitiativesCount,
              rollupProgress: goal.rollupProgress,
              childGoals: 0,
            }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    setGoalType('scorecard');
    setTitle('');
    setDescription('');
    setTimeFrame('Q2 2026');
    setTargetValue('');
    setUnit('%');
    setSelectedInitiativeIds([]);
  }, [createOpen]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedLinkedInitiatives([]);
      return;
    }

    const selected = items.find((item) => item.id === selectedId);
    if (!selected) return;

    let cancelled = false;
    (async () => {
      try {
        const response: any = await Api.goalsGetInitiatives(selected.id);
        if (!cancelled) {
          setSelectedLinkedInitiatives(response?.initiatives || []);
        }
      } catch {
        if (!cancelled) {
          setSelectedLinkedInitiatives(
            initiatives
              .filter((initiative) => selected.linkedInitiativesCount > 0)
              .slice(0, selected.linkedInitiativesCount)
              .map((initiative) => ({
                initiative_id: initiative.initiativeId,
                initiative_name: initiative.initiativeName,
                initiative_status: initiative.initiativeStatus,
              }))
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiatives, items, selectedId]);

  const selectedItem = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const rows: TableRow[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.goalType,
        progress: item.progress,
        rollup: item.rollupProgress,
        linkedInitiatives: item.linkedInitiativesCount,
        status: item.status,
        _raw: item,
      })),
    [items]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('results.kpi.scorecards.name', 'Scorecard'),
        width: '38%',
        render: (row) => {
          const item = row._raw as GoalItem;
          return (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatGoalType(item.goalType)}
                {item.parentGoalId ? ' · child' : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'progress',
        label: t('common.progress', 'Progress'),
        width: '16%',
        render: (row) => `${Math.round(Number(row.progress || 0))}%`,
      },
      {
        id: 'rollup',
        label: t('results.kpi.scorecards.rollup', 'Rollup'),
        width: '16%',
        render: (row) => `${Math.round(Number(row.rollup || 0))}%`,
      },
      {
        id: 'linkedInitiatives',
        label: t('results.tabs.initiatives', 'Initiatives'),
        width: '14%',
      },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
    ],
    [t]
  );

  const initiativeOptions = useMemo(
    () =>
      initiatives.map((initiative) => ({
        id: initiative.initiativeId,
        label: initiative.initiativeName,
        sublabel: initiative.initiativeStatus,
      })),
    [initiatives]
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status.toLowerCase() === 'active').length,
      scorecards: items.filter((item) => item.goalType.toLowerCase() === 'scorecard').length,
    }),
    [items]
  );

  const toggleInitiative = (id: string) => {
    setSelectedInitiativeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Provide a scorecard title.');
      return;
    }
    setCreating(true);
    try {
      const created: any = await Api.goalsCreate({
        goalType,
        title: title.trim(),
        description: description.trim() || undefined,
        timeFrame: timeFrame.trim() || undefined,
        targetValue: targetValue.trim() ? Number(targetValue) : undefined,
        unit: unit.trim() || undefined,
      });

      const goalId = created?.id;
      if (goalId && selectedInitiativeIds.length > 0) {
        await Promise.all(
          selectedInitiativeIds.map((initiativeId) => Api.goalsLinkInitiative(goalId, initiativeId))
        );
      }

      toast.success('Scorecard created');
      setCreateOpen(false);
      await fetchGoals();
    } catch {
      toast.error('Failed to create scorecard');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (item: GoalItem, status: string, progress?: number) => {
    setUpdatingId(item.id);
    try {
      await Api.goalsUpdate(item.id, {
        status,
        progress: progress ?? item.progress,
      });
      toast.success('Scorecard updated');
      await fetchGoals();
    } catch {
      toast.error('Failed to update scorecard');
    } finally {
      setUpdatingId(null);
    }
  };

  const actions = (item: GoalItem): ActionRow[] => [
    {
      id: 'discuss',
      label: t('results.kpi.scorecards.discuss', 'Discuss goal'),
      onClick: async () => {
        try {
          await openChatWithContext({
            entityType: 'kpi',
            entityId: item.id,
            entityName: item.title,
            contextData: item as unknown as Record<string, unknown>,
            pmoContext: { kpiId: item.id },
          });
          toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
        } catch {
          toast.error(t('common.chatOpenError', 'Failed to open chat'));
        }
      },
      variant: 'secondary',
    },
    {
      id: 'activate',
      label:
        updatingId === item.id
          ? t('common.loading', 'Loading...')
          : t('results.kpi.scorecards.setActive', 'Set active'),
      onClick: () => void updateStatus(item, 'active'),
      variant: 'secondary',
    },
    {
      id: 'complete',
      label:
        updatingId === item.id
          ? t('common.loading', 'Loading...')
          : t('results.kpi.scorecards.markDone', 'Mark done'),
      onClick: () =>
        void updateStatus(
          item,
          'done',
          item.targetValue && item.currentValue != null && item.targetValue !== 0
            ? Math.min(100, Math.round((item.currentValue / item.targetValue) * 100))
            : 100
        ),
      variant: 'primary',
    },
  ];

  const metaPills = (item: GoalItem): MetaPill[] => [
    { label: t('common.type', 'Type'), value: formatGoalType(item.goalType), tone: 'info' },
    { label: t('common.status', 'Status'), value: item.status, tone: 'neutral' },
    {
      label: t('common.progress', 'Progress'),
      value: `${Math.round(item.progress)}%`,
      tone: 'success',
    },
  ];

  const relationItems = (item: GoalItem): RelationItem[] => [
    {
      id: `${item.id}-initiatives`,
      label: t('results.tabs.initiatives', 'Initiatives'),
      value: String(item.linkedInitiativesCount),
      icon: <Link2 size={14} />,
    },
    {
      id: `${item.id}-children`,
      label: t('results.kpi.scorecards.childGoals', 'Child goals'),
      value: String(item.childGoals),
      icon: <Milestone size={14} />,
    },
    {
      id: `${item.id}-target`,
      label: t('common.target', 'Target'),
      value:
        item.targetValue != null
          ? `${item.targetValue}${item.unit ? ` ${item.unit}` : ''}`
          : t('common.none', '—'),
      icon: <Target size={14} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('results.kpi.scorecards.total', 'Scorecards')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(
              'results.kpi.scorecards.totalHint',
              'Managed goal and scorecard artifacts in Results.'
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('common.active', 'Active')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.active}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(
              'results.kpi.scorecards.activeHint',
              'Scorecards currently tracking delivery or benefits.'
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('results.kpi.scorecards.scorecardsOnly', 'Formal scorecards')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.scorecards}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(
              'results.kpi.scorecards.scorecardsOnlyHint',
              'Explicit operator scorecards backed by goals API.'
            )}
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('results.kpi.scorecards.createTitle', 'Create scorecard')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'results.kpi.scorecards.createHint',
                  'Goals and scorecards organize KPI truth into explicit business commitments.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.type', 'Type')}
              </span>
              <select
                value={goalType}
                onChange={(event) => setGoalType(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="scorecard">Scorecard</option>
                <option value="objective">Objective</option>
                <option value="key_result">Key result</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.name', 'Name')}
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.description', 'Description')}
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={`${INPUT_CLASS} min-h-[92px]`}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.period', 'Time frame')}
              </span>
              <input
                value={timeFrame}
                onChange={(event) => setTimeFrame(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.target', 'Target')}
              </span>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                  className={INPUT_CLASS}
                />
                <input
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </label>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('results.tabs.initiatives', 'Initiatives')}
            </div>
            <div className="mt-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 max-h-44 overflow-y-auto space-y-2">
              {initiativeOptions.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'results.kpi.scorecards.noInitiatives',
                    'No initiatives available in current scope.'
                  )}
                </div>
              ) : (
                initiativeOptions.map((initiative) => (
                  <label
                    key={initiative.id}
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInitiativeIds.includes(initiative.id)}
                      onChange={() => toggleInitiative(initiative.id)}
                      className="mt-0.5 rounded border-slate-300 dark:border-white/[0.1]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-700 dark:text-slate-200">
                        {initiative.label}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {initiative.sublabel}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-navy-800"
            >
              {creating ? t('common.loading', 'Loading...') : t('common.create', 'Create')}
            </button>
          </div>
        </div>
      )}

      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        itemIds={items.map((item) => item.id)}
        getItemById={(id) => items.find((item) => item.id === id) ?? null}
        renderPreview={(item) => (
          <div className="space-y-4">
            <PreviewMetaCard
              title={item.title}
              subtitle={
                item.description ||
                t(
                  'results.kpi.scorecards.previewSubtitle',
                  'Governed scorecard built on KPI truth.'
                )
              }
              metaPills={metaPills(item)}
            />
            <PreviewDetailsSection
              title={t('common.details', 'Details')}
              detailsText={[
                `Type: ${formatGoalType(item.goalType)}`,
                `Time frame: ${item.timeFrame || '—'}`,
                `Progress: ${Math.round(item.progress)}%`,
                `Rollup: ${Math.round(item.rollupProgress)}%`,
                `Target: ${item.targetValue != null ? `${item.targetValue}${item.unit ? ` ${item.unit}` : ''}` : '—'}`,
                `Current: ${item.currentValue != null ? `${item.currentValue}${item.unit ? ` ${item.unit}` : ''}` : '—'}`,
                `Start / End: ${formatDate(item.startDate)} → ${formatDate(item.endDate)}`,
              ]}
            />
            <PreviewRelations
              title={t('common.relations', 'Relations')}
              items={[
                ...relationItems(item),
                ...selectedLinkedInitiatives.map((initiative: any) => ({
                  id: `${item.id}-${initiative.initiative_id}`,
                  label: initiative.initiative_status || 'initiative',
                  value: initiative.initiative_name || initiative.initiative_id,
                  icon: <Flag size={14} />,
                })),
              ]}
            />
          </div>
        )}
        renderPreviewFooter={(item) => <PreviewActionBar actions={actions(item)} />}
      >
        <FilterableTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={
            loading
              ? t('common.loading', 'Loading...')
              : t('results.kpi.scorecards.empty', 'No scorecards yet.')
          }
          hideRowActions
        />
      </TableWithPreviewLayout>
    </div>
  );
};
