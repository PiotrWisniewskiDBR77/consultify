import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import type { ROIInitiativeItem } from './ROITrackingView';

/**
 * T37 R15 — canonical ROI Reviews table + preview.
 *
 * ENTITY: real `ROIInitiativeItem[]` rows from the portfolio-summary
 * `.items` array — the SAME real per-row data `ROITrackingView.tsx` already
 * fetches (`V8ResultsApi.getRoiPortfolioSummary()`, falling back to
 * `GET /benefits/roi/portfolio/summary` on `shouldFallbackToLegacyResults`).
 * `ROITrackingView.tsx` itself (bespoke sort/filter table, KPI summary
 * cards, inline row menu, `ROIDetailDrawer`) is preserved unchanged as the
 * relocated tool below/alongside this table (surfaceRegister.ts T37
 * relocateFromList: roi-summary-cards) — not replaced or duplicated.
 *
 * No aggregate reviews/approvals endpoint exists — "reviewedAt"/"status"
 * (approved/draft) from the old T37 registry entry never had a real
 * source; this table shows only the real fields the portfolio-summary
 * endpoint returns (name/status/priority/projected/realized/variance).
 */

interface RoiRow extends TableRow {
  id: string;
  initiativeName: string;
  status: string;
  priority: string;
  projectedBenefit: number;
  realizedBenefit: number;
  variance: number;
  hasRealized: boolean;
  ownerName?: string;
}

function deriveRoiStatus(item: RoiRow): 'on-track' | 'below' | 'above' {
  if (!item.hasRealized || item.projectedBenefit === 0) return 'on-track';
  const pct =
    ((item.realizedBenefit - item.projectedBenefit) / Math.abs(item.projectedBenefit)) * 100;
  if (pct > 10) return 'above';
  if (pct < -10) return 'below';
  return 'on-track';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export const ResultsRoiReviewsTable: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<RoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    (async () => {
      try {
        let rawItems: ROIInitiativeItem[] = [];
        try {
          const payload: any = await V8ResultsApi.getRoiPortfolioSummary();
          rawItems = Array.isArray(payload?.items) ? payload.items : [];
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) throw error;
          const res: any = await Api.get('/benefits/roi/portfolio/summary');
          const data = res?.data || res;
          rawItems = Array.isArray(data?.items) ? data.items : [];
        }
        if (!cancelled) {
          setItems(
            rawItems.map((item) => ({
              id: item.initiativeId,
              initiativeName: item.initiativeName,
              status: item.status,
              priority: item.priority,
              projectedBenefit: item.projectedBenefit,
              realizedBenefit: item.realizedBenefit,
              variance: item.variance,
              hasRealized: item.hasRealized,
              ownerName: item.ownerName,
            }))
          );
        }
      } catch {
        if (cancelled) return;
        setItems([]);
        setHasLoadError(true);
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw exception surfaced to the UI.
        console.error('[ResultsRoiReviewsTable] failed to load ROI portfolio summary');
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
        id: 'initiativeName',
        label: t('results.roiTable.initiative', 'Initiative'),
        sortable: true,
      },
      {
        id: 'status',
        label: t('results.roiTable.status', 'Status'),
        width: '130px',
        sortable: true,
      },
      {
        id: 'projectedBenefit',
        label: t('results.roiTable.projected', 'Projected'),
        width: '120px',
        align: 'right',
        sortable: true,
        render: (row) => formatCurrency((row as unknown as RoiRow).projectedBenefit || 0),
      },
      {
        id: 'realizedBenefit',
        label: t('results.roiTable.realized', 'Realized'),
        width: '120px',
        align: 'right',
        sortable: true,
        render: (row) => formatCurrency((row as unknown as RoiRow).realizedBenefit || 0),
      },
      {
        id: 'variance',
        label: t('results.roiTable.variance', 'Variance'),
        width: '110px',
        align: 'right',
        sortable: true,
        render: (row) => {
          const v = (row as unknown as RoiRow).variance || 0;
          return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
        },
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const roiStatus = deriveRoiStatus(selected);
    return [
      { label: selected.status, tone: 'neutral' },
      {
        label:
          roiStatus === 'above' ? 'Above plan' : roiStatus === 'below' ? 'Below plan' : 'On track',
        tone: roiStatus === 'above' ? 'success' : roiStatus === 'below' ? 'danger' : 'neutral',
      },
    ];
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    return isPolish
      ? `Inicjatywa: ${selected.initiativeName}. Status: ${selected.status}. Priorytet: ${selected.priority}. Planowana korzyść: ${formatCurrency(selected.projectedBenefit)}. Zrealizowana: ${formatCurrency(selected.realizedBenefit)}. Odchylenie: ${selected.variance.toFixed(1)}%. Właściciel: ${selected.ownerName || 'brak'}.`
      : `Initiative: ${selected.initiativeName}. Status: ${selected.status}. Priority: ${selected.priority}. Projected benefit: ${formatCurrency(selected.projectedBenefit)}. Realized: ${formatCurrency(selected.realizedBenefit)}. Variance: ${selected.variance.toFixed(1)}%. Owner: ${selected.ownerName || 'none'}.`;
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
          surfaceId="T37"
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać przeglądów ROI. Spróbuj ponownie.'
                : 'Failed to load ROI reviews. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="results.roi-reviews"
          defaultSort={{ columnId: 'initiativeName', direction: 'asc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('results.roiTable.emptyTitle', 'No ROI-tracked initiatives yet'),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.initiativeName}
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

export default ResultsRoiReviewsTable;
