import { ExternalLink } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MetaPill, StandardPreview } from '@/components/standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import type { PortfolioInitiative } from '@/types';
import { formatListDate } from '@/utils/listDateFormat';

/**
 * T26 R13 — canonical Portfolio Analysis table + preview.
 *
 * ENTITY: rows are the real `PortfolioInitiative[]` already passed into
 * `PortfolioAnalysisView` (the same list every one of the five analysis
 * subviews — Resources/Feasibility/Logic/Timeline/Completeness — derives
 * its own per-lens rows from via `usePortfolioAnalysisData`/
 * `useCompletenessRows`). This table adds ONE canonical, entity-level list
 * on top; the five subviews stay exactly as they are, relocated below it
 * (surfaceRegister.ts T26 relocateFromList: kpi-cards/portfolio-charts),
 * not rebuilt — each subview's own bespoke per-lens table (resource
 * allocations, feasibility scores, dependency graph, timeline bars,
 * completeness rows) is a distinct, derived view and out of this table's
 * scope.
 *
 * The one real row action is `onOpenInitiative(id)` — the same callback
 * `PortfolioAnalysisView` already requires as a prop (in InitiativesHub.tsx
 * it resolves to a preview-select, not a full navigation; this table does
 * not assume or rename what it does, only that it is real). Preview here is
 * this table's own, independent of `TableWithPreviewLayout`'s preview state
 * used by the five subviews — no shared/mutated state between them.
 */

export interface PortfolioAnalysisTableProps {
  initiatives: PortfolioInitiative[];
  onOpenInitiative: (id: string) => void;
}

function rowTitle(row: PortfolioInitiative): string {
  return String(row.name || row.title || row.id);
}

export const PortfolioAnalysisTable: React.FC<PortfolioAnalysisTableProps> = ({
  initiatives,
  onOpenInitiative,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => initiatives.find((item) => item.id === selectedId) ?? null,
    [initiatives, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('initiatives.analysisTable.name', 'Initiative'),
        sortable: true,
        render: (row) => rowTitle(row as unknown as PortfolioInitiative),
      },
      {
        id: 'status',
        label: t('initiatives.analysisTable.status', 'Status'),
        width: '130px',
        sortable: true,
      },
      {
        id: 'priority',
        label: t('initiatives.analysisTable.priority', 'Priority'),
        width: '100px',
        sortable: true,
      },
      {
        id: 'axis',
        label: t('initiatives.analysisTable.axis', 'Axis'),
        width: '140px',
        sortable: true,
        render: (row) => String((row as unknown as PortfolioInitiative).axis || '—'),
      },
      {
        id: 'updatedAt',
        label: t('initiatives.analysisTable.updated', 'Updated'),
        width: '120px',
        sortable: true,
        render: (row) => {
          const value = (row as unknown as PortfolioInitiative).updatedAt;
          return value ? formatListDate(value) : '—';
        },
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [];
    if (selected.status) pills.push({ label: String(selected.status), tone: 'neutral' });
    if (selected.priority) pills.push({ label: String(selected.priority), tone: 'neutral' });
    return pills;
  }, [selected]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    const updated = selected.updatedAt
      ? formatListDate(selected.updatedAt)
      : isPolish
        ? 'brak'
        : 'none';
    return isPolish
      ? `Inicjatywa: ${rowTitle(selected)}. Status: ${selected.status}. Priorytet: ${selected.priority || 'brak'}. Oś: ${selected.axis || 'brak'}. Aktualizacja: ${updated}.`
      : `Initiative: ${rowTitle(selected)}. Status: ${selected.status}. Priority: ${selected.priority || 'none'}. Axis: ${selected.axis || 'none'}. Updated: ${updated}.`;
  }, [selected, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const r = row as unknown as PortfolioInitiative;
      return {
        primary: [
          {
            id: 'open-initiative',
            label: t('initiatives.analysisTable.openInitiative', 'Open initiative'),
            icon: ExternalLink,
            onClick: () => onOpenInitiative(r.id),
          },
        ],
        universalHandlers: {
          preview: () => setSelectedId(String(row.id)),
        },
      };
    },
    [onOpenInitiative, t]
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          surfaceId="T26"
          columns={columns}
          data={initiatives as unknown as TableRow[]}
          persistKey="initiatives.analysis"
          defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('initiatives.analysisTable.emptyTitle', 'No initiatives yet'),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={rowTitle(selected)}
            onClose={() => setSelectedId(null)}
            onOpenFull={() => onOpenInitiative(selected.id)}
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

export default PortfolioAnalysisTable;
