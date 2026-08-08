import { ExternalLink } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import { type PortfolioHealth, usePortfolioHealth } from './PortfolioHealthView';

/**
 * T29 R11 — canonical Portfolio health table + preview, built on the same
 * `usePortfolioHealth()` hook `PortfolioHealthView.tsx` already uses
 * (real GET /api/initiatives/portfolio-health).
 *
 * `PortfolioHealth` is one aggregate object per org, not a row list —
 * `healthStatus`/`trend`/`owner`/`evaluatedAt` (the old T29 contract's
 * columns) never existed on any response. `readyToLaunch` (id/title/status)
 * is the only per-initiative identity array the aggregate carries
 * (portfolioAnalysisService.ts), so it is this table's real row source.
 * Everything else (KPI tiles, coverage/gaps, effort×impact balance,
 * byStatus, duplicate clusters) stays in `PortfolioHealthView.tsx`,
 * rendered alongside this table by `InitiativesHub.tsx` — that component is
 * left untouched. Known, disclosed overlap: `PortfolioHealthView.tsx`'s own
 * "Ready to launch" list section still renders the same rows the table now
 * also renders; deduplicating that section is left to a follow-up package
 * rather than editing an already-tested file in this one.
 */

export interface PortfolioHealthTableProps {
  endpoint?: string;
  /** Injected data (tests) — skips fetch, mirrors PortfolioHealthView's own prop. */
  health?: PortfolioHealth | null;
  onOpenInitiative?: (id: string, title: string) => void;
}

export const PortfolioHealthTable: React.FC<PortfolioHealthTableProps> = ({
  endpoint,
  health: injected,
  onOpenInitiative,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const hook = usePortfolioHealth(endpoint);
  const health = injected !== undefined ? injected : hook.data;
  const loading = injected !== undefined ? false : hook.loading;
  const hasLoadError = injected === undefined && !hook.loading && !hook.data && !!hook.error;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => health?.readyToLaunch ?? [], [health]);

  const selected = useMemo(
    () => rows.find((item) => item.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('initiatives.portfolioHealthTable.title', 'Initiative'),
        sortable: true,
        render: (row) => row.title || t('initiatives.portfolioHealthTable.untitled', '(untitled)'),
      },
      {
        id: 'status',
        label: t('initiatives.portfolioHealthTable.status', 'Status'),
        width: '140px',
        sortable: true,
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    return [{ label: selected.status, tone: 'neutral' }];
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    return isPolish
      ? `Inicjatywa: ${selected.title || '(bez tytułu)'}. Status: ${selected.status}. Gotowa do uruchomienia (pełny kompletny brief, brak duplikatu).`
      : `Initiative: ${selected.title || '(untitled)'}. Status: ${selected.status}. Ready to launch (complete charter, no duplicate).`;
  }, [selected, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => ({
      primary: onOpenInitiative
        ? [
            {
              id: 'open-initiative',
              label: t('initiatives.portfolioHealthTable.openInitiative', 'Open initiative'),
              icon: ExternalLink,
              onClick: () => onOpenInitiative(String(row.id), String(row.title || '')),
            },
          ]
        : undefined,
      universalHandlers: {
        preview: () => setSelectedId(String(row.id)),
      },
    }),
    [onOpenInitiative, t]
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          surfaceId="T29"
          columns={columns}
          data={rows as unknown as TableRow[]}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać danych zdrowia portfela. Spróbuj ponownie.'
                : 'Failed to load portfolio health data. Please try again.'
              : null
          }
          persistKey="initiatives.portfolio-health"
          defaultSort={{ columnId: 'title', direction: 'asc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t(
              'initiatives.portfolioHealthTable.emptyTitle',
              'No ready-to-launch initiatives'
            ),
            description: t(
              'initiatives.portfolioHealthTable.emptyDescription',
              'No pre-launch initiative has a complete charter (owner + sizing + timeline) without a duplicate yet.'
            ),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.title || t('initiatives.portfolioHealthTable.untitled', '(untitled)')}
            onClose={() => setSelectedId(null)}
            onOpenFull={
              onOpenInitiative
                ? () => onOpenInitiative(selected.id, selected.title || '')
                : undefined
            }
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

export default PortfolioHealthTable;
