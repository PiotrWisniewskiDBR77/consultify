import { AlertTriangle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  listMyDefinitionRemediation,
  type PendingDefinitionRemediationReadModel,
  resolveDefinitionRemediation,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

interface WorkRow extends TableRow {
  id: string;
  title: string;
  workType: string;
  initiativeId: string;
  findingId: string;
  dueAt: string;
  status: string;
  source: PendingDefinitionRemediationReadModel;
}

const columns: TableColumn[] = [
  { id: 'title', label: 'Definition remediation', sortable: true, width: '28%' },
  { id: 'workType', label: 'Type', sortable: true, filterable: true },
  { id: 'initiativeId', label: 'Initiative', sortable: true },
  { id: 'findingId', label: 'Finding', sortable: true },
  { id: 'dueAt', label: 'Due', sortable: true },
  { id: 'status', label: 'Status', sortable: true, filterable: true },
];

export const DefinitionRemediationQueue: React.FC = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [items, setItems] = useState<PendingDefinitionRemediationReadModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidenceRefs, setEvidenceRefs] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [rationale, setRationale] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const commandIds = useRef(new Map<string, string>());

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await listMyDefinitionRemediation(signal);
      setItems(next);
      setSelectedId((current) =>
        current && next.some((item) => item.aggregateId === current) ? current : null
      );
      setState('READY');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState('ERROR');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const rows = useMemo<WorkRow[]>(
    () =>
      items.map((item) => ({
        id: item.aggregateId,
        title: item.title,
        workType: item.workType,
        initiativeId: item.initiativeId,
        findingId: item.findingId,
        dueAt: item.dueAt,
        status: item.status,
        source: item,
      })),
    [items]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const resolve = async () => {
    if (!selected || writeState === 'SAVING') return;
    const isTask = selected.source.workType === 'FINANCE_EVIDENCE';
    const refs = evidenceRefs
      .split('\n')
      .map((ref) => ref.trim())
      .filter(Boolean);
    if ((isTask && refs.length === 0) || (!isTask && (!selectedOption || !rationale.trim())))
      return;
    setWriteState('SAVING');
    const key = `${selected.id}:${selected.source.version}`;
    const clientRequestId = commandIds.current.get(key) ?? crypto.randomUUID();
    commandIds.current.set(key, clientRequestId);
    try {
      await resolveDefinitionRemediation(
        selected.source.aggregateType,
        selected.id,
        isTask
          ? {
              expectedVersion: selected.source.version,
              clientRequestId,
              workType: 'FINANCE_EVIDENCE',
              evidenceRefs: refs,
            }
          : {
              expectedVersion: selected.source.version,
              clientRequestId,
              workType: 'TECHNICAL_OPTION',
              selectedOption,
              rationale: rationale.trim(),
            }
      );
      setWriteState('IDLE');
      setEvidenceRefs('');
      setSelectedOption('');
      setRationale('');
      await load();
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  if (state === 'LOADING') {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-c-border p-4 text-sm">
        <Loader2 aria-hidden="true" className="animate-spin" size={16} /> Loading Definition work
      </div>
    );
  }
  if (state === 'ERROR') {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 border-b border-c-border p-4 text-sm text-c-danger"
      >
        <AlertTriangle aria-hidden="true" size={16} /> Definition remediation projection is
        unavailable.
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <section aria-label="Definition remediation work" className="border-b border-c-border p-4">
      <h3 className="mb-2 font-semibold text-c-text-primary">
        Definition remediation assigned to you
      </h3>
      {(writeState === 'CONFLICT' || writeState === 'FAILED') && (
        <div role="alert" className="mb-2 text-sm text-c-danger">
          {writeState === 'CONFLICT'
            ? 'This work item changed. Reload before resolving it.'
            : 'The work item was not changed.'}
        </div>
      )}
      <TableWithPreviewLayout<WorkRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={(id) => setSelectedId(id)}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => (
          <div className="space-y-3 p-4 text-sm">
            <div className="text-xs text-c-text-muted">
              {row.findingId} · canonical ID {row.id}
            </div>
            {row.source.workType === 'FINANCE_EVIDENCE' ? (
              <label className="block">
                <span className="mb-1 block text-c-text-muted">Evidence references</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={evidenceRefs}
                  onChange={(event) => setEvidenceRefs(event.target.value)}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-c-text-muted">Selected option</span>
                  <select
                    className="w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={selectedOption}
                    onChange={(event) => setSelectedOption(event.target.value)}
                  >
                    <option value="">Select</option>
                    {row.source.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-c-text-muted">Decision rationale</span>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-c-border bg-c-surface p-2"
                    value={rationale}
                    onChange={(event) => setRationale(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        )}
        renderPreviewFooter={(row) => (
          <div className="flex w-full justify-end p-3">
            <button
              type="button"
              className="btn-primary"
              disabled={writeState === 'SAVING'}
              onClick={() => void resolve()}
            >
              {row.source.workType === 'FINANCE_EVIDENCE' ? 'Complete Task' : 'Publish Decision'}
            </button>
          </div>
        )}
      >
        <StandardTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          persistKey="my-work.definition-remediation.v1"
        />
      </TableWithPreviewLayout>
    </section>
  );
};
