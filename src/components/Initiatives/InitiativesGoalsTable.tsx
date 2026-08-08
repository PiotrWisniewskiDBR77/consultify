import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { type MetaPill, type RelationItem, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

/**
 * T30 R13-CORRECTION — canonical Initiatives Goals table + preview.
 *
 * ENTITY: real Goal records from `Api.goalsGet()` → GET
 * /initiatives-v4/goals (the same API `ResultsKpiScorecardsView.tsx`
 * already consumes — Results-module reuse of an Initiatives-owned entity,
 * not a fictional one). No demo/showcase fallback and no invented rows —
 * an honest empty/error state is used instead when the API returns
 * nothing or fails.
 *
 * Rollup (`Api.goalsGetRollup(id)`) is fetched only for the selected row's
 * preview, not per-row in the list (avoids an N+1 fan-out on every
 * render). Relations come only from `Api.goalsGetInitiatives(id)` — real
 * linked-initiative rows (`{initiative_id, initiative_name,
 * initiative_status}`), fetched on selection; on failure the relations
 * block is honestly empty, never substituted with fabricated data.
 *
 * No KPI cards or dashboard exist for Goals in the Initiatives module
 * today (the audited "kpi-cards" reference in the old T30 registry entry
 * had nothing to relocate) — this table is the entire surface, no
 * dashboard is invented alongside it.
 *
 * `goalsUpdate` (PUT) exists server-side but no edit form is built here,
 * so `edit` stays not-applicable, matching the T36 precedent. No delete
 * endpoint exists in the goals API at all.
 */

interface GoalRow extends TableRow {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  targetValue: number | null;
  unit: string | null;
  currentValue: number | null;
  endDate: string | null;
  timeFrame: string | null;
  progress: number;
}

export const InitiativesGoalsTable: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rollupProgress, setRollupProgress] = useState<number | null>(null);
  const [relations, setRelations] = useState<RelationItem[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    (async () => {
      try {
        const response: any = await Api.goalsGet();
        const rawGoals: any[] = Array.isArray(response?.goals) ? response.goals : [];
        if (!cancelled) {
          setItems(
            rawGoals.map((goal) => ({
              id: goal.id,
              title: goal.title || 'Untitled goal',
              status: String(goal.status || 'active'),
              ownerId: goal.owner_id || null,
              targetValue: goal.target_value != null ? Number(goal.target_value) : null,
              unit: goal.unit || null,
              currentValue: goal.current_value != null ? Number(goal.current_value) : null,
              endDate: goal.end_date || null,
              timeFrame: goal.time_frame || null,
              progress: Number(goal.progress || 0),
            }))
          );
        }
      } catch {
        if (cancelled) return;
        setItems([]);
        setHasLoadError(true);
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw exception surfaced to the UI.
        console.error('[InitiativesGoalsTable] failed to load goals');
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

  useEffect(() => {
    if (!selectedId) {
      setRollupProgress(null);
      setRelations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rollup: any = await Api.goalsGetRollup(selectedId);
        if (!cancelled) setRollupProgress(Number(rollup?.rollupProgress ?? 0));
      } catch {
        if (!cancelled) setRollupProgress(null);
      }
      try {
        const response: any = await Api.goalsGetInitiatives(selectedId);
        const linked: any[] = Array.isArray(response?.initiatives) ? response.initiatives : [];
        if (!cancelled) {
          setRelations(
            linked.map((initiative) => ({
              id: String(initiative.initiative_id),
              label: initiative.initiative_status || 'initiative',
              value: initiative.initiative_name || initiative.initiative_id,
            }))
          );
        }
      } catch {
        if (!cancelled) setRelations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('initiatives.goalsTable.title', 'Goal'),
        sortable: true,
      },
      {
        id: 'status',
        label: t('initiatives.goalsTable.status', 'Status'),
        width: '110px',
        sortable: true,
      },
      {
        id: 'ownerId',
        label: t('initiatives.goalsTable.owner', 'Owner'),
        width: '140px',
        sortable: true,
        render: (row) =>
          (row as unknown as GoalRow).ownerId ||
          t('initiatives.goalsTable.unassigned', 'Unassigned'),
      },
      {
        id: 'targetValue',
        label: t('initiatives.goalsTable.target', 'Target'),
        width: '120px',
        align: 'right',
        sortable: true,
        render: (row) => {
          const r = row as unknown as GoalRow;
          return r.targetValue != null ? `${r.targetValue}${r.unit ? ` ${r.unit}` : ''}` : '—';
        },
      },
      {
        id: 'endDate',
        label: t('initiatives.goalsTable.endDate', 'End date'),
        width: '120px',
        sortable: true,
        render: (row) => {
          const value = (row as unknown as GoalRow).endDate;
          if (!value) return '—';
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
        },
      },
      {
        id: 'progress',
        label: t('initiatives.goalsTable.progress', 'Progress'),
        width: '100px',
        align: 'right',
        sortable: true,
        render: (row) => `${Math.round((row as unknown as GoalRow).progress || 0)}%`,
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [{ label: selected.status, tone: 'neutral' }];
    if (selected.ownerId) pills.push({ label: selected.ownerId, tone: 'neutral' });
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
    const endDate = selected.endDate
      ? (() => {
          const date = new Date(selected.endDate as string);
          return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
        })()
      : '—';
    const rollup =
      rollupProgress != null ? `${Math.round(rollupProgress)}%` : isPolish ? 'brak' : 'none';
    return isPolish
      ? `Cel: ${selected.title}. Status: ${selected.status}. Właściciel: ${selected.ownerId || 'brak'}. Cel liczbowy: ${target}. Aktualnie: ${current}. Termin: ${endDate}. Postęp: ${Math.round(selected.progress)}%. Rollup: ${rollup}.`
      : `Goal: ${selected.title}. Status: ${selected.status}. Owner: ${selected.ownerId || 'none'}. Target: ${target}. Current: ${current}. End date: ${endDate}. Progress: ${Math.round(selected.progress)}%. Rollup: ${rollup}.`;
  }, [selected, rollupProgress, isPolish]);

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
          surfaceId="T30"
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać celów. Spróbuj ponownie.'
                : 'Failed to load goals. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="initiatives.goals"
          defaultSort={{ columnId: 'title', direction: 'asc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('initiatives.goalsTable.emptyTitle', 'No goals yet'),
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
            relations={relations}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default InitiativesGoalsTable;
