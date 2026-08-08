import { ExternalLink } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import {
  type Initiative,
  InitiativeApi,
  type InitiativeLineageChain,
} from '@/services/api/initiatives.api';
import { formatListDate } from '@/utils/listDateFormat';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

/**
 * T27 R11 — canonical Observability table + preview, built directly against
 * `InitiativeApi.getInitiatives()` (the same real call
 * `InitiativeObservabilityPanel.tsx` already uses) and `InitiativeApi.getLineage(id)`
 * for the row preview. The dashboard widgets (conversion funnel, cycle time,
 * lineage picker) stay in `InitiativeObservabilityPanel.tsx`, rendered
 * alongside this table by `InitiativesHub.tsx` — nothing here duplicates
 * or removes them (relocateFromList: ['observability-dashboard'],
 * surfaceRegister.ts T27).
 *
 * The live `getInitiatives()` response carries `name` (not the stale
 * `Initiative.title` the TS client declares — confirmed against
 * InitiativeController.ts's hand-built response shape); this table follows
 * the same defensive `title || name || id` fallback already proven in
 * InitiativeObservabilityPanel.tsx rather than trusting either type alone.
 */

type RealInitiativeRow = Initiative & {
  name?: string;
  area?: string;
  axis?: string;
  riskLevel?: string | null;
};

export interface InitiativeObservabilityTableProps {
  /** Truthful full-open — routes to the real initiative document (hub-provided). */
  onOpenInitiative?: (id: string, title: string) => void;
}

function rowTitle(row: RealInitiativeRow): string {
  return String(row.title || row.name || row.id);
}

export const InitiativeObservabilityTable: React.FC<InitiativeObservabilityTableProps> = ({
  onOpenInitiative,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<RealInitiativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineage, setLineage] = useState<InitiativeLineageChain | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    InitiativeApi.getInitiatives()
      .then((rows) => {
        if (cancelled) return;
        setItems(rows as RealInitiativeRow[]);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setHasLoadError(true);
        // eslint-disable-next-line no-console -- fixed diagnostic only, no raw exception surfaced to the UI.
        console.error('[InitiativeObservabilityTable] failed to load initiatives');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  // Mirrors InitiativeObservabilityPanel's own lineage effect — same real
  // per-id endpoint, independent fetch (the two components don't share state).
  useEffect(() => {
    if (!selectedId) {
      setLineage(null);
      return;
    }
    let cancelled = false;
    setLineageLoading(true);
    InitiativeApi.getLineage(selectedId)
      .then((chain) => {
        if (!cancelled) setLineage(chain);
      })
      .finally(() => {
        if (!cancelled) setLineageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  // Factual, whitelisted, <=140-word prose — only fields the real lineage
  // endpoint returns (source.type, initiative.title/status,
  // downstream.executionStatus, downstream.benefits.length). No raw object
  // leakage: `lineage` itself is never interpolated wholesale.
  const previewDetailsText = useMemo(() => {
    if (lineageLoading) {
      return isPolish ? 'Wczytywanie łańcucha powiązań…' : 'Loading lineage chain…';
    }
    if (!lineage) {
      return isPolish
        ? 'Brak łańcucha powiązań dla tej inicjatywy.'
        : 'No lineage chain for this initiative.';
    }
    const sourceLabel = lineage.source ? lineage.source.type : isPolish ? 'ręcznie' : 'manual';
    const executionLabel = lineage.downstream.executionStatus || (isPolish ? 'brak' : 'none');
    const resultsCount = lineage.downstream.benefits?.length ?? 0;
    return isPolish
      ? `Źródło: ${sourceLabel}. Inicjatywa: ${lineage.initiative.title} (${lineage.initiative.status}). ` +
          `Realizacja: ${executionLabel}. Wyniki: ${resultsCount} KPI.`
      : `Source: ${sourceLabel}. Initiative: ${lineage.initiative.title} (${lineage.initiative.status}). ` +
          `Execution: ${executionLabel}. Results: ${resultsCount} KPI.`;
  }, [lineage, lineageLoading, isPolish]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('initiatives.observabilityTable.name', 'Initiative'),
        sortable: true,
        render: (row) => rowTitle(row as RealInitiativeRow),
      },
      {
        id: 'status',
        label: t('initiatives.observabilityTable.status', 'Status'),
        width: '140px',
        sortable: true,
        render: (row) => <EntityStatusChip status={String((row as RealInitiativeRow).status)} />,
      },
      {
        id: 'priority',
        label: t('initiatives.observabilityTable.priority', 'Priority'),
        width: '110px',
        sortable: true,
        render: (row) => String((row as RealInitiativeRow).priority || '—'),
      },
      {
        id: 'area',
        label: t('initiatives.observabilityTable.area', 'Area'),
        width: '140px',
        sortable: true,
        render: (row) => String((row as RealInitiativeRow).area || '—'),
      },
      {
        id: 'updatedAt',
        label: t('initiatives.observabilityTable.updated', 'Updated'),
        width: '120px',
        sortable: true,
        render: (row) => {
          const value = (row as RealInitiativeRow).updatedAt;
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

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const r = row as unknown as RealInitiativeRow;
      return {
        primary: onOpenInitiative
          ? [
              {
                id: 'open-initiative',
                label: t('initiatives.observabilityTable.openInitiative', 'Open initiative'),
                icon: ExternalLink,
                onClick: () => onOpenInitiative(r.id, rowTitle(r)),
              },
            ]
          : undefined,
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
          surfaceId="T27"
          columns={columns}
          data={items as unknown as TableRow[]}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać inicjatyw. Spróbuj ponownie.'
                : 'Failed to load initiatives. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="initiatives.observability"
          defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('initiatives.observabilityTable.emptyTitle', 'No initiatives yet'),
            description: t(
              'initiatives.observabilityTable.emptyDescription',
              'Initiatives will appear here once created.'
            ),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={rowTitle(selected)}
            onClose={() => setSelectedId(null)}
            onOpenFull={
              onOpenInitiative ? () => onOpenInitiative(selected.id, rowTitle(selected)) : undefined
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

export default InitiativeObservabilityTable;
