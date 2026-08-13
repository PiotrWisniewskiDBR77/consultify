/**
 * AuditOutputsTab — U7 Outputs surface: zatwierdzone, NIEZMIENNE wyniki audytu
 * (`AuditOutput`, powstaje przy finalizacji programu — `finalizedAt`/`hash`).
 *
 * Uczciwy stan pusty: dopóki żaden program nie doszedł do finalizacji, ta
 * lista JEST pusta z definicji — EmptyState mówi to wprost zamiast udawać
 * błąd ładowania.
 */
import { Package } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn } from '@/components/standard';
import { ErrorState } from '@/components/shared/states';

import { listOutputs, type AuditOutputSummary } from '../auditsMethodApi';

export interface AuditOutputsTabProps {
  isPolish: boolean;
}

export const AuditOutputsTab: React.FC<AuditOutputsTabProps> = ({ isPolish }) => {
  const [items, setItems] = useState<AuditOutputSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    { id: 'finalizedAt', label: isPolish ? 'Data finalizacji' : 'Finalized at', width: '160px', sortable: true },
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
    {
      id: 'contentHash',
      label: isPolish ? 'Hash' : 'Hash',
      width: '140px',
      render: (row: AuditOutputSummary) => (
        <span className="font-mono text-[11px] text-c-text-muted truncate block max-w-[120px]">
          {row.contentHash || '—'}
        </span>
      ),
    },
  ];

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
    <div className="p-4">
      <StandardTable
        columns={columns}
        data={items}
        loading={loading}
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
  );
};

export default AuditOutputsTab;
