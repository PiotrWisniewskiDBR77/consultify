/**
 * AuditOutputsTab — U7 Outputs surface: zatwierdzone, NIEZMIENNE wyniki audytu
 * (`AuditOutput`, powstaje przy finalizacji programu — `finalizedAt`/`hash`).
 *
 * Uczciwy stan pusty: dopóki żaden program nie doszedł do finalizacji, ta
 * lista JEST pusta z definicji — EmptyState mówi to wprost zamiast udawać
 * błąd ładowania.
 *
 * Hash treści (`contentHash`) NIE jest informacją pierwszego rzutu oka —
 * dowód integralności czyta się przy weryfikacji, nie przy skanowaniu listy.
 * Żyje wyłącznie w panelu podglądu (klik wiersza / kebab „Podgląd").
 */
import { Package } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import {
  type StandardRowMenu,
  StandardPreview,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { ErrorState } from '@/components/shared/states';
import { formatListDate } from '@/utils/listDateFormat';

import { listOutputs, type AuditOutputSummary } from '../auditsMethodApi';

export interface AuditOutputsTabProps {
  isPolish: boolean;
}

export const AuditOutputsTab: React.FC<AuditOutputsTabProps> = ({ isPolish }) => {
  const [items, setItems] = useState<AuditOutputSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOutputs()
      .then((result) => setItems(result.items))
      .catch((e: any) => setError(e?.message || (isPolish ? 'Nie udało się wczytać Outputów' : 'Failed to load Outputs')))
      .finally(() => setLoading(false));
  }, [isPolish]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: isPolish ? 'Tytuł' : 'Title',
      render: (row: AuditOutputSummary) => (
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-c-text">{row.title}</span>
          <span className="text-[11px] text-c-text-muted">{row.programName || '—'}</span>
        </div>
      ),
    },
    { id: 'version', label: isPolish ? 'Wersja' : 'Version', width: '90px' },
    {
      id: 'finalizedAt',
      label: isPolish ? 'Data finalizacji' : 'Finalized at',
      width: '160px',
      sortable: true,
      render: (row: AuditOutputSummary) => (
        <span className="text-xs text-c-text-secondary tabular-nums">{formatListDate(row.finalizedAt)}</span>
      ),
    },
    {
      id: 'finalizedByName',
      label: isPolish ? 'Kto' : 'By',
      width: '160px',
      render: (row: AuditOutputSummary) => (
        <span className="text-sm text-c-text truncate">
          {row.finalizedByName || <span className="text-slate-400">—</span>}
        </span>
      ),
    },
  ];

  // Podgląd (klik wiersza / kebab) — to tu, a NIE w kolumnie, żyje `contentHash`
  // (§C6: hash treści nie jest informacją pierwszego rzutu oka).
  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as AuditOutputSummary;
    return { universalHandlers: { preview: () => setSelectedId(row.id) } };
  };

  const selected = items.find((o) => o.id === selectedId) || null;
  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'program',
          label: isPolish ? 'Program' : 'Program',
          value: selected.programName || '—',
        },
        {
          id: 'version',
          label: isPolish ? 'Wersja' : 'Version',
          value: String(selected.version),
          mono: true,
        },
        {
          id: 'finalizedAt',
          label: isPolish ? 'Data finalizacji' : 'Finalized at',
          value: formatListDate(selected.finalizedAt),
        },
        {
          id: 'finalizedBy',
          label: isPolish ? 'Kto' : 'By',
          value: selected.finalizedByName || '—',
        },
        {
          id: 'contentHash',
          label: isPolish ? 'Hash treści' : 'Content hash',
          value: (
            <span className="font-mono text-[11px] text-c-text-muted break-all">
              {selected.contentHash || '—'}
            </span>
          ),
        },
      ]
    : undefined;

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać Outputów' : 'Could not load Outputs'}
          description={error}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={items}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => setSelectedId(String(row.id))}
          selectedRowId={selectedId}
          persistKey="audits.method.outputs"
          empty={{
            icon: Package,
            title: isPolish ? 'Brak Outputów' : 'No Outputs yet',
            description: isPolish
              ? 'Output powstaje automatycznie przy finalizacji programu audytowego (zamknięcie etapu closure) — jest wtedy niezmienny i wersjonowany. Żaden program nie doszedł jeszcze do tego etapu.'
              : 'An Output is created automatically when an audit program is finalized (closure stage) — it is then immutable and versioned. No program has reached that stage yet.',
          }}
        />
      </div>
      {selected ? (
        <div className="w-[380px] shrink-0 border-l border-c-border-subtle">
          <StandardPreview
            title={selected.title}
            onClose={() => setSelectedId(null)}
            details={{
              properties: selectedProperties,
              label: isPolish ? 'Szczegóły' : 'Details',
              propertyLabel: isPolish ? 'Właściwość' : 'Property',
              valueLabel: isPolish ? 'Wartość' : 'Value',
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default AuditOutputsTab;
