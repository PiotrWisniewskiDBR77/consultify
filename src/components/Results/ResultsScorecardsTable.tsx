import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

/**
 * T36 R15 — canonical KPI Scorecards table + preview.
 *
 * ENTITY: real Goal records (`Api.goalsGet()` → GET /initiatives-v4/goals,
 * `Api.goalsGetRollup(id)` → GET /initiatives-v4/goals/:id/rollup) — the
 * SAME persisted entity + endpoints `ResultsKpiScorecardsView.tsx` already
 * uses, not a re-derivation of flat KPI catalog rows. `goal_type` values
 * ('scorecard'/'key_result'/'objective') are shown as-is, matching the
 * existing view's own unfiltered rendering — no client-side reclassification
 * of KPI records into scorecards.
 *
 * `ResultsKpiScorecardsView.tsx` itself (creation form, inline status
 * update, linked-initiatives management) is preserved unchanged as the
 * relocated tool below/alongside this table (surfaceRegister.ts T36
 * relocateFromList: kpi-summary-cards) — this component does not replace or
 * duplicate its mutation capabilities. `goalsUpdate` (PUT) exists but no
 * edit form is built here, so `edit` stays not-applicable for this layer;
 * there is no delete endpoint in the goals API at all.
 */

interface GoalRow extends TableRow {
  id: string;
  title: string;
  goalType: string;
  status: string;
  progress: number;
  rollupProgress: number;
  timeFrame: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  linkedInitiativesCount: number;
}

function formatGoalType(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'scorecard') return 'Scorecard';
  if (normalized === 'key_result') return 'Key result';
  return 'Objective';
}

export const ResultsScorecardsTable: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    (async () => {
      try {
        const response: any = await Api.goalsGet();
        const rawGoals: any[] = Array.isArray(response?.goals) ? response.goals : [];
        const withRollups = await Promise.all(
          rawGoals.map(async (goal) => {
            let rollup: any = null;
            try {
              rollup = await Api.goalsGetRollup(goal.id);
            } catch {
              rollup = null;
            }
            return {
              id: goal.id,
              title: goal.title || 'Untitled scorecard',
              goalType: String(goal.goal_type || 'objective'),
              status: String(goal.status || 'active'),
              progress: Number(goal.progress || 0),
              rollupProgress: Number(rollup?.rollupProgress || 0),
              timeFrame: goal.time_frame || null,
              targetValue: goal.target_value != null ? Number(goal.target_value) : null,
              currentValue: goal.current_value != null ? Number(goal.current_value) : null,
              unit: goal.unit || null,
              linkedInitiativesCount: Number(rollup?.linkedInitiatives || 0),
            } as GoalRow;
          })
        );
        if (!cancelled) setItems(withRollups);
      } catch {
        if (cancelled) return;
        setItems([]);
        setHasLoadError(true);
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw exception surfaced to the UI.
        console.error('[ResultsScorecardsTable] failed to load goals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('results.scorecardsTable.name', 'Scorecard'),
        sortable: true,
      },
      {
        id: 'goalType',
        label: t('results.scorecardsTable.type', 'Type'),
        width: '120px',
        sortable: true,
        render: (row) => formatGoalType(String((row as unknown as GoalRow).goalType)),
      },
      {
        id: 'status',
        label: t('results.scorecardsTable.status', 'Status'),
        width: '110px',
        sortable: true,
      },
      {
        id: 'progress',
        label: t('results.scorecardsTable.progress', 'Progress'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row) => `${Math.round((row as unknown as GoalRow).progress || 0)}%`,
      },
      {
        id: 'rollupProgress',
        label: t('results.scorecardsTable.rollup', 'Rollup'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row) => `${Math.round((row as unknown as GoalRow).rollupProgress || 0)}%`,
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [{ label: formatGoalType(selected.goalType), tone: 'neutral' }];
    if (selected.status) pills.push({ label: selected.status, tone: 'neutral' });
    return pills;
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    const target =
      selected.targetValue != null
        ? `${selected.targetValue}${selected.unit ? ` ${selected.unit}` : ''}`
        : '—';
    const current =
      selected.currentValue != null
        ? `${selected.currentValue}${selected.unit ? ` ${selected.unit}` : ''}`
        : '—';
    return isPolish
      ? `Scorecard: ${selected.title}. Typ: ${formatGoalType(selected.goalType)}. Status: ${selected.status}. Postęp: ${Math.round(selected.progress)}%. Rollup: ${Math.round(selected.rollupProgress)}%. Cel: ${target}. Aktualnie: ${current}. Powiązane inicjatywy: ${selected.linkedInitiativesCount}.`
      : `Scorecard: ${selected.title}. Type: ${formatGoalType(selected.goalType)}. Status: ${selected.status}. Progress: ${Math.round(selected.progress)}%. Rollup: ${Math.round(selected.rollupProgress)}%. Target: ${target}. Current: ${current}. Linked initiatives: ${selected.linkedInitiativesCount}.`;
  }, [selected, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => ({
      universalHandlers: {
        preview: () => setSelectedId(String(row.id)),
      },
    }),
    []
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          surfaceId="T36"
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać scorecardów. Spróbuj ponownie.'
                : 'Failed to load scorecards. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="results.kpi-scorecards"
          defaultSort={{ columnId: 'title', direction: 'asc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('results.scorecardsTable.emptyTitle', 'No scorecards yet'),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.title}
            onClose={() => setSelectedId(null)}
            meta={{ pills: metaPills }}
            details={{
              text: previewDetailsText,
              onCopy: () => {
                void navigator.clipboard?.writeText(previewDetailsText);
              },
            }}
            relations={[]}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default ResultsScorecardsTable;
