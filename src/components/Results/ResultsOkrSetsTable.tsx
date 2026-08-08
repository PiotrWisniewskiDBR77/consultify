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
 * T38 R15 — canonical OKR Sets table + preview.
 *
 * ENTITY: real Objectives from `GET /results-strategic/:projectId/okr` —
 * the SAME endpoint `StrategicLayerPanel.tsx` and ResultsHub's "para 3"
 * three-pairs widget already use (response shape `{ objectives:
 * [{ id, label, rollupScore, keyResults: [{id,label,baseline,target,
 * current}] }] }`, confirmed against both existing call sites). Key
 * results are real, structured, per-objective data — shown as this
 * table's Relations block, not invented.
 *
 * `StrategicLayerPanel.tsx` (behind the `strategicLayer` flag) is
 * preserved unchanged as the relocated dashboard below/alongside this
 * table (surfaceRegister.ts T38 relocateFromList: okr-summary-cards) — not
 * replaced or duplicated.
 */

interface KeyResultRow {
  id: string;
  label: string;
  baseline: number;
  target: number;
  current: number;
}

interface ObjectiveRow extends TableRow {
  id: string;
  label: string;
  rollupScore: number;
  keyResults: KeyResultRow[];
}

export interface ResultsOkrSetsTableProps {
  projectId?: string;
}

export const ResultsOkrSetsTable: React.FC<ResultsOkrSetsTableProps> = ({ projectId = 'all' }) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<ObjectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    (async () => {
      try {
        const res: any = await Api.get(`/results-strategic/${projectId}/okr`);
        const data: any = res?.data ?? res;
        const objectives: any[] = Array.isArray(data?.objectives) ? data.objectives : [];
        if (!cancelled) {
          setItems(
            objectives.map((o) => ({
              id: o.id,
              label: o.label,
              rollupScore: Number(o.rollupScore ?? o.score ?? 0),
              keyResults: Array.isArray(o.keyResults)
                ? o.keyResults.map((kr: any) => ({
                    id: kr.id,
                    label: kr.label,
                    baseline: Number(kr.baseline ?? 0),
                    target: Number(kr.target ?? 0),
                    current: Number(kr.current ?? 0),
                  }))
                : [],
            }))
          );
        }
      } catch {
        if (cancelled) return;
        setItems([]);
        setHasLoadError(true);
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw exception surfaced to the UI.
        console.error('[ResultsOkrSetsTable] failed to load OKR objectives');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
        id: 'label',
        label: t('results.okrTable.objective', 'Objective'),
        sortable: true,
      },
      {
        id: 'rollupScore',
        label: t('results.okrTable.score', 'Score'),
        width: '110px',
        align: 'right',
        sortable: true,
        render: (row) => `${Math.round((row as unknown as ObjectiveRow).rollupScore || 0)}%`,
      },
      {
        id: 'keyResultCount',
        label: t('results.okrTable.keyResults', 'Key results'),
        width: '110px',
        align: 'right',
        sortable: true,
        render: (row) => String((row as unknown as ObjectiveRow).keyResults?.length ?? 0),
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    return [{ label: `${Math.round(selected.rollupScore)}%`, tone: 'neutral' }];
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    return isPolish
      ? `Cel: ${selected.label}. Wynik zbiorczy: ${Math.round(selected.rollupScore)}%. Kluczowe rezultaty: ${selected.keyResults.length}.`
      : `Objective: ${selected.label}. Rollup score: ${Math.round(selected.rollupScore)}%. Key results: ${selected.keyResults.length}.`;
  }, [selected, isPolish]);

  const relations: RelationItem[] = useMemo(() => {
    if (!selected) return [];
    return selected.keyResults.map((kr) => ({
      id: kr.id,
      label: kr.label,
      value: `${kr.current}/${kr.target}${kr.baseline ? ` (baseline ${kr.baseline})` : ''}`,
    }));
  }, [selected]);

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
          surfaceId="T38"
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać celów OKR. Spróbuj ponownie.'
                : 'Failed to load OKR objectives. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="results.okr-sets"
          defaultSort={{ columnId: 'label', direction: 'asc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('results.okrTable.emptyTitle', 'No OKR objectives yet'),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.label}
            onClose={() => setSelectedId(null)}
            meta={{ pills: metaPills }}
            details={{
              text: previewDetailsText,
              onCopy: () => {
                void navigator.clipboard?.writeText(previewDetailsText);
              },
            }}
            relations={relations}
            relationsEmptyLabel={t('results.okrTable.noKeyResults', 'No key results yet.')}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default ResultsOkrSetsTable;
