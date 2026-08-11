import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  archiveClosedInitiative,
  decideClosureCase,
  getClosureSnapshot,
  getEffectivenessSnapshot,
  listArchiveManifests,
  listClosureCases,
  listEffectivenessCases,
  readExecutionCase,
  readRegisteredInitiative,
  requestClosureCase,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

import { useGateSignoffGuard } from './gateSignoffProjection';

interface ClosureRow extends TableRow {
  id: string;
  title: string;
  initiative: string;
  executionCase: string;
  snapshot: string;
  authority: string;
  status: string;
  version: number;
  source: any;
}
const columns: TableColumn[] = [
  { id: 'title', label: 'Closure Case', sortable: true, width: '240px' },
  { id: 'initiative', label: 'Initiative', sortable: true },
  { id: 'executionCase', label: 'Execution Case', sortable: true },
  { id: 'snapshot', label: 'Effectiveness Snapshot', sortable: true },
  { id: 'authority', label: 'Independent authority', sortable: true },
  { id: 'status', label: 'Status', sortable: true, filterable: true },
];
const lines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const refs = (value: string) =>
  lines(value).map((item) => {
    const [ref, version] = item.split('@');
    return { ref, version: Number(version) };
  });

export const ClosureDecisionQueue = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [rows, setRows] = useState<ClosureRow[]>([]);
  const [effectiveness, setEffectiveness] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [request, setRequest] = useState({
    closureCaseId: '',
    effectivenessCaseId: '',
    authorityId: '',
    lessons: '',
    lineageRefs: '',
    followUpKind: 'TASK_REF',
    followUpTaskId: '',
    followUpTaskVersion: '1',
    followUpItemId: '',
    followUpDescription: '',
    followUpOwnerId: '',
    followUpDueAt: '',
    retentionClassification: '',
    retentionPolicyRef: '',
    retentionPolicyVersion: '1',
    legalHold: false,
  });
  const [decision, setDecision] = useState({ outcome: 'CLOSE', rationale: '', snapshotId: '' });
  const [legalHold, setLegalHold] = useState(false);
  const [archive, setArchive] = useState({ retentionRef: '', exportRef: '' });
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const [write, setWrite] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const ids = useRef(new Map<string, string>());
  const commandId = (key: string) => {
    const prior = ids.current.get(key);
    if (prior) return prior;
    const next = crypto.randomUUID();
    ids.current.set(key, next);
    return next;
  };
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const [closures, effects] = (await Promise.all([
        listClosureCases(),
        listEffectivenessCases(),
      ])) as Array<{ items?: any[] }>;
      setRows(
        (closures.items ?? []).map((item) => ({
          id: item.closureCaseId,
          title: item.closureCaseId,
          initiative: item.initiativeId,
          executionCase: item.executionCaseId,
          snapshot: `${item.effectivenessSnapshotRef.snapshotId} v${item.effectivenessSnapshotRef.version}`,
          authority: item.authorityId,
          status: item.status,
          version: item.version,
          source: item,
        }))
      );
      setEffectiveness((effects.items ?? []).filter((item) => item.status === 'REVIEWED'));
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => void load(), [load]);
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );
  const gate = useGateSignoffGuard('CLOSURE', selectedId);
  const policyEnforced = gate.projection?.effectivePolicy.policyEnforced ?? true;
  const canDecide = Boolean(selected && (!policyEnforced || gate.quorumRef));

  const submitRequest = async () => {
    const effect = effectiveness.find(
      (item) => item.effectivenessCaseId === request.effectivenessCaseId
    );
    if (!effect?.effectivenessSnapshotId) return;
    setWrite('SAVING');
    try {
      const [initiative, execution, snapshot] = (await Promise.all([
        readRegisteredInitiative(effect.initiativeId),
        readExecutionCase(effect.executionCaseId),
        getEffectivenessSnapshot(effect.effectivenessSnapshotId),
      ])) as any[];
      const followUps =
        request.followUpKind === 'TASK_REF'
          ? [
              {
                kind: 'TASK_REF',
                taskId: request.followUpTaskId,
                version: Number(request.followUpTaskVersion),
              },
            ]
          : [
              {
                kind: 'OWNED_ITEM',
                itemId: request.followUpItemId,
                description: request.followUpDescription,
                ownerId: request.followUpOwnerId,
                dueAt: new Date(request.followUpDueAt).toISOString(),
              },
            ];
      const result = (await requestClosureCase(request.closureCaseId, {
        expectedVersion: 0,
        clientRequestId: commandId(`closure:request:${request.closureCaseId}`),
        initiativeId: effect.initiativeId,
        executionCaseId: effect.executionCaseId,
        expectedInitiativeVersion: initiative.version,
        expectedExecutionCaseVersion: execution.version,
        effectivenessSnapshotRef: {
          snapshotId: snapshot.snapshotId,
          version: snapshot.version ?? 1,
        },
        authorityId: request.authorityId,
        lessons: lines(request.lessons),
        lineageRefs: refs(request.lineageRefs),
        followUps,
        retention: {
          classification: request.retentionClassification,
          policyRef: {
            ref: request.retentionPolicyRef,
            version: Number(request.retentionPolicyVersion),
          },
          legalHold: request.legalHold,
        },
      })) as any;
      setReceipt({ type: 'CLOSURE_REQUEST', ...result.response });
      await load();
      setWrite('IDLE');
    } catch (error) {
      setWrite(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };

  const decide = async () => {
    if (!selected || !canDecide) return;
    setWrite('SAVING');
    try {
      const [initiative, execution] = (await Promise.all([
        readRegisteredInitiative(selected.source.initiativeId),
        readExecutionCase(selected.source.executionCaseId),
      ])) as any[];
      const result = (await decideClosureCase(selected.id, {
        expectedVersion: selected.version,
        clientRequestId: commandId(
          `closure:decide:${selected.id}:${selected.version}:${decision.outcome}`
        ),
        outcome: decision.outcome,
        rationale: decision.rationale,
        snapshotId: decision.outcome === 'CLOSE' ? decision.snapshotId : '',
        expectedInitiativeVersion: initiative.version,
        expectedExecutionCaseVersion: execution.version,
        governanceQuorumRequired: policyEnforced,
        ...(gate.quorumRef ? { governanceQuorumRef: gate.quorumRef } : {}),
      })) as any;
      if (decision.outcome === 'CLOSE') {
        const snapshot = (await getClosureSnapshot(decision.snapshotId)) as Record<string, unknown>;
        setReceipt({ type: 'CLOSURE_SNAPSHOT', ...snapshot });
      } else setReceipt({ type: 'CLOSURE_DECISION', ...result.response });
      await load();
      setWrite('IDLE');
    } catch (error) {
      setWrite(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };

  const archiveSelected = async () => {
    if (!selected || selected.status !== 'CLOSED' || !selected.source.closureSnapshotId) return;
    setWrite('SAVING');
    try {
      const initiative = (await readRegisteredInitiative(selected.initiative)) as any;
      const archiveId = `archive-${selected.initiative}`;
      const created = (await archiveClosedInitiative(archiveId, {
        expectedVersion: 0,
        clientRequestId: commandId(`archive:${archiveId}:${initiative.version}`),
        initiativeId: selected.initiative,
        expectedInitiativeVersion: initiative.version,
        closureSnapshotRef: { snapshotId: selected.source.closureSnapshotId, version: 1 },
        retentionPolicyRef: { ref: archive.retentionRef, version: 1 },
        legalHold: false,
        exportRefs: [{ ref: archive.exportRef, version: 1 }],
      })) as any;
      const manifests = (await listArchiveManifests()) as { items?: Array<Record<string, any>> };
      setReceipt({
        type: 'ARCHIVE',
        ...(manifests.items ?? []).find((item) => item.archiveId === archiveId),
        ...created.response,
      });
      await load();
      setWrite('IDLE');
    } catch (error) {
      setWrite(error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };

  if (state === 'LOADING')
    return (
      <section aria-label="Closure Cases" role="status">
        Loading Closure Cases
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Closure Cases" role="alert">
        Closure Cases unavailable.
      </section>
    );
  return (
    <section aria-label="Closure Cases" className="border-b border-c-border p-4">
      <h3 className="font-semibold">Closure Cases</h3>
      <p className="text-xs text-c-text-muted">
        Independent Closure decision after immutable Effectiveness Snapshot. Archive remains
        separate.
      </p>
      <TableWithPreviewLayout<ClosureRow>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={setSelectedId}
        itemIds={rows.map((row) => row.id)}
        getItemById={(id) => rows.find((row) => row.id === id) ?? null}
        renderPreview={(row) => (
          <div className="space-y-2 p-4 text-sm">
            <p>
              Closure Case {row.id} v{row.version}
            </p>
            <p>Effectiveness Snapshot {row.snapshot}</p>
            <p>
              Initiative {row.initiative} · Execution Case {row.executionCase}
            </p>
            <p>Lessons {row.source.lessons.join(', ')}</p>
            <p>
              Lineage{' '}
              {row.source.lineageRefs.map((ref: any) => `${ref.ref} v${ref.version}`).join(', ')}
            </p>
            <p>
              Follow-ups{' '}
              {row.source.followUps
                .map((item: any) =>
                  item.kind === 'TASK_REF'
                    ? `${item.taskId} v${item.version}`
                    : `${item.itemId} · ${item.ownerId} · ${item.dueAt}`
                )
                .join(', ')}
            </p>
            <p>
              Retention {row.source.retention.classification} · {row.source.retention.policyRef.ref}{' '}
              v{row.source.retention.policyRef.version} · legal hold{' '}
              {String(row.source.retention.legalHold)}
            </p>
            {policyEnforced && !gate.quorumRef && (
              <p role="alert">CLOSURE GateSignoff quorum is not satisfied.</p>
            )}
          </div>
        )}
      >
        <StandardTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          persistKey="my-work.closure-cases.v1"
        />
      </TableWithPreviewLayout>
      <section
        aria-label="Closure request workbench"
        className="mt-4 rounded border border-c-border p-4"
      >
        <h4 className="font-medium">Request Closure Case</h4>
        <label className="text-xs">
          Reviewed Effectiveness
          <select
            aria-label="Closure Effectiveness Case"
            value={request.effectivenessCaseId}
            onChange={(event) =>
              setRequest((current) => ({ ...current, effectivenessCaseId: event.target.value }))
            }
            className="block w-full rounded border border-c-border bg-c-surface p-2"
          >
            <option value="">Select immutable Effectiveness Snapshot</option>
            {effectiveness.map((item) => (
              <option key={item.effectivenessCaseId} value={item.effectivenessCaseId}>
                {item.effectivenessCaseId} · {item.effectivenessSnapshotId} · {item.reviewOutcome}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Object.keys(request)
            .filter((key) => !['effectivenessCaseId', 'legalHold'].includes(key))
            .map((key) => (
              <label key={key} className="text-xs">
                {key}
                <input
                  aria-label={`Closure request ${key}`}
                  type={key === 'followUpDueAt' ? 'datetime-local' : 'text'}
                  value={String(request[key as keyof typeof request])}
                  onChange={(event) =>
                    setRequest((current) => ({ ...current, [key]: event.target.value }))
                  }
                  className="block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
            ))}
          <label className="text-xs">
            <input
              aria-label="Closure request legalHold"
              type="checkbox"
              checked={request.legalHold}
              onChange={(event) =>
                setRequest((current) => ({ ...current, legalHold: event.target.checked }))
              }
            />{' '}
            Legal hold
          </label>
        </div>
        <button className="btn-secondary mt-3" onClick={() => void submitRequest()}>
          Request independent Closure
        </button>
      </section>
      {selected?.status === 'PENDING' && (
        <section
          aria-label="Closure decision workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <select
            aria-label="Closure outcome"
            value={decision.outcome}
            onChange={(event) =>
              setDecision((current) => ({ ...current, outcome: event.target.value }))
            }
            className="rounded border border-c-border bg-c-surface p-2"
          >
            {['CLOSE', 'RETURN', 'CORRECTIVE', 'CANCEL'].map((outcome) => (
              <option key={outcome}>{outcome}</option>
            ))}
          </select>
          <textarea
            aria-label="Closure rationale"
            value={decision.rationale}
            onChange={(event) =>
              setDecision((current) => ({ ...current, rationale: event.target.value }))
            }
            className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
          />
          {decision.outcome === 'CLOSE' && (
            <input
              aria-label="Closure Snapshot ID"
              value={decision.snapshotId}
              onChange={(event) =>
                setDecision((current) => ({ ...current, snapshotId: event.target.value }))
              }
              className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
            />
          )}
          <button
            className="btn-primary mt-3"
            disabled={
              !canDecide ||
              !decision.rationale ||
              (decision.outcome === 'CLOSE' && !decision.snapshotId)
            }
            onClick={() => void decide()}
          >
            Decide Closure
          </button>
        </section>
      )}
      {selected?.status === 'CLOSED' && (
        <section aria-label="Archive workbench" className="mt-4 rounded border border-c-border p-4">
          <h4 className="font-medium">Archive closed Initiative</h4>
          <label className="block text-xs">
            <input
              aria-label="Legal hold"
              type="checkbox"
              checked={legalHold}
              onChange={(event) => setLegalHold(event.target.checked)}
            />{' '}
            Active legal hold
          </label>
          {legalHold && <p role="alert">Archive blocked: active legal hold.</p>}
          <label className="mt-2 block text-xs">
            Retention policy ref
            <input
              aria-label="Retention policy ref"
              value={archive.retentionRef}
              onChange={(event) =>
                setArchive((current) => ({ ...current, retentionRef: event.target.value }))
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
          <label className="mt-2 block text-xs">
            Export ref
            <input
              aria-label="Archive export ref"
              value={archive.exportRef}
              onChange={(event) =>
                setArchive((current) => ({ ...current, exportRef: event.target.value }))
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
          <button
            className="btn-primary mt-3"
            disabled={legalHold || !archive.retentionRef || !archive.exportRef}
            onClick={() => void archiveSelected()}
          >
            Create Archive Manifest
          </button>
        </section>
      )}
      {receipt && (
        <div role="status" className="mt-3 rounded border border-c-success/40 p-3">
          {receipt.type === 'ARCHIVE'
            ? `Archive Manifest ${String(receipt.archiveId)} · read-only`
            : `${String(receipt.type)} · ${String(receipt.snapshotId ?? receipt.closureCaseId)} · ${String(receipt.status ?? (receipt.type === 'CLOSURE_SNAPSHOT' ? 'CLOSED' : ''))}`}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert">
          {write === 'CONFLICT' ? 'Closure source changed. Reload.' : 'Closure command failed.'}
        </p>
      )}
    </section>
  );
};
