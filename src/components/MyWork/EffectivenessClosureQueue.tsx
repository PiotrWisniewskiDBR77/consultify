import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  archiveClosedInitiative,
  createEffectivenessCase,
  createFinanceReconciliation,
  createResultsKpiObservation,
  getEffectivenessSnapshot,
  listArchiveManifests,
  listEffectivenessCases,
  listMyEffectivenessWork,
  listResultsKpiObservations,
  readRegisteredInitiative,
  RuntimeApiError,
  transitionEffectiveness,
} from '@/services/initiatives-execution/runtimeApi';

type Knowledge = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
type Measurement = {
  measurementId: string;
  contractRef: { ref: string; version: number };
  sourceRef: { ref: string; version: number };
  baseline: number | null;
  current: number | null;
  target: number | null;
  formula: string;
  unit: string;
  currency: string | null;
  window: { start: string; end: string };
  confidence: Confidence;
  knowledgeState: Knowledge;
  asOf: string;
  evidenceRefs: string[];
};
type Effectiveness = {
  version: number;
  effectivenessCaseId: string;
  initiativeId: string;
  executionCaseId: string;
  benefitsHandoffPackRef: { packId: string; version: number };
  resultsAcceptanceRef: { resultsCaseId: string; version: number };
  benefitOwnerId: string;
  reviewerId: string;
  closureAuthorityId: string;
  status:
    | 'TRACKING'
    | 'PENDING_REVIEW'
    | 'EFFECTIVE'
    | 'PARTIAL'
    | 'INEFFECTIVE'
    | 'NOT_VERIFIED'
    | 'REVIEWED'
    | 'CLOSED';
  measurements: Measurement[];
  closureSnapshotId: string | null;
  effectivenessSnapshotId?: string | null;
  reviewOutcome?: 'CONFIRMED' | 'PARTIAL' | 'NOT_ACHIEVED' | 'RETURN_FOR_MEASUREMENT';
};
interface Row extends TableRow {
  id: string;
  title: string;
  caseId: string;
  initiative: string;
  lineage: string;
  owner: string;
  status: string;
  source: Effectiveness;
}
const columns: TableColumn[] = [
  { id: 'caseId', label: 'Effectiveness Case', sortable: true },
  { id: 'initiative', label: 'Initiative', sortable: true },
  { id: 'lineage', label: 'Exact results lineage', sortable: true },
  { id: 'owner', label: 'Current authority', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
];
const displayValue = (value: number | null, knowledge: Knowledge) =>
  knowledge === 'UNKNOWN' || value === null ? 'UNKNOWN' : String(value);

export const EffectivenessClosureQueue = () => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [items, setItems] = useState<Effectiveness[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [selectedObservationIds, setSelectedObservationIds] = useState<string[]>([]);
  const [financeId, setFinanceId] = useState('');
  const [financeJson, setFinanceJson] = useState('');
  const [observationId, setObservationId] = useState('');
  const [observationJson, setObservationJson] = useState('');
  const [effectivenessId, setEffectivenessId] = useState('');
  const [effectivenessJson, setEffectivenessJson] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [legalHold, setLegalHold] = useState(false);
  const [archive, setArchive] = useState({
    retentionRef: '',
    retentionVersion: 1,
    exportRef: '',
    exportVersion: 1,
  });
  const [write, setWrite] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const ids = useRef(new Map<string, string>());
  const commandId = (key: string) => {
    const prior = ids.current.get(key);
    if (prior) return prior;
    const id = crypto.randomUUID();
    ids.current.set(key, id);
    return id;
  };
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const [mine, all, observationList] = (await Promise.all([
        listMyEffectivenessWork(),
        listEffectivenessCases(),
        listResultsKpiObservations(),
      ])) as [{ items?: Effectiveness[] }, { items?: Effectiveness[] }, { items?: any[] }];
      const merged = new Map<string, Effectiveness>();
      [...(mine.items ?? []), ...(all.items ?? []).filter((x) => x.status === 'CLOSED')].forEach(
        (x) => merged.set(x.effectivenessCaseId, x)
      );
      setItems([...merged.values()]);
      setObservations(observationList.items ?? []);
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo<Row[]>(
    () =>
      items.map((x) => ({
        id: x.effectivenessCaseId,
        title: `Effectiveness ${x.initiativeId}`,
        caseId: x.effectivenessCaseId,
        initiative: x.initiativeId,
        lineage: `${x.resultsAcceptanceRef.resultsCaseId} v${x.resultsAcceptanceRef.version} · ${x.benefitsHandoffPackRef.packId} v${x.benefitsHandoffPackRef.version}`,
        owner:
          x.status === 'TRACKING'
            ? x.benefitOwnerId
            : x.status === 'PENDING_REVIEW'
              ? x.reviewerId
              : x.closureAuthorityId,
        status: x.status,
        source: x,
      })),
    [items]
  );
  const selected = rows.find((x) => x.id === selectedId) ?? null;
  const createFinance = async () => {
    const payload = JSON.parse(financeJson);
    await createFinanceReconciliation(financeId, {
      ...payload,
      expectedVersion: 0,
      clientRequestId: commandId(`finance:${financeId}`),
    });
  };
  const createObservation = async () => {
    const payload = JSON.parse(observationJson);
    if (payload.measurementState === 'NOT_MEASURED') {
      payload.observedValue = null;
      payload.knowledgeState = 'UNKNOWN';
      payload.confidence = 'UNKNOWN';
      payload.financeReconciliationRef = null;
    }
    if (
      payload.measurementState === 'MEASURED' &&
      payload.currency &&
      !payload.financeReconciliationRef
    )
      throw new Error('Exact AVAILABLE Finance reconciliation required');
    await createResultsKpiObservation(observationId, {
      ...payload,
      expectedVersion: 0,
      clientRequestId: commandId(`observation:${observationId}`),
    });
    await load();
  };
  const createEffectiveness = async () => {
    const payload = JSON.parse(effectivenessJson);
    const refs = observations
      .filter((item) => selectedObservationIds.includes(item.observationId))
      .map((item) => ({ observationId: item.observationId, version: item.version }));
    if (!refs.length) return;
    await createEffectivenessCase(effectivenessId, {
      ...payload,
      observationRefs: refs,
      expectedVersion: 0,
      clientRequestId: commandId(`effectiveness:create:${effectivenessId}`),
    });
    await load();
  };
  const transition = async (action: Record<string, unknown>) => {
    if (!selected) return;
    setWrite('SAVING');
    try {
      let exactAction = action;
      let snapshotId: string | null = null;
      if (action.action === 'DECIDE') {
        const initiative = (await readRegisteredInitiative(selected.source.initiativeId)) as {
          version: number;
        };
        snapshotId = `effectiveness-${selected.id}-v${selected.source.version}`;
        exactAction = {
          ...action,
          expectedInitiativeVersion: initiative.version,
          snapshotId,
        };
      }
      const result = (await transitionEffectiveness(selected.id, {
        expectedVersion: selected.source.version,
        clientRequestId: commandId(
          `${selected.id}:${selected.source.version}:${String(action.action)}`
        ),
        ...exactAction,
      })) as any;
      if (snapshotId) {
        const snapshot = (await getEffectivenessSnapshot(snapshotId)) as Record<string, unknown>;
        setReceipt({ type: 'EFFECTIVENESS_SNAPSHOT', ...snapshot });
      } else {
        setReceipt({
          type: 'EFFECTIVENESS',
          action: action.action,
          caseId: selected.id,
          ...result.response,
        });
      }
      await load();
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  const archiveCase = async () => {
    if (
      !selected ||
      selected.source.status !== 'CLOSED' ||
      legalHold ||
      !archive.retentionRef ||
      !archive.exportRef
    )
      return;
    setWrite('SAVING');
    try {
      const initiative = (await readRegisteredInitiative(selected.source.initiativeId)) as {
        version: number;
      };
      const archiveId = `archive-${selected.source.initiativeId}`;
      await archiveClosedInitiative(archiveId, {
        expectedVersion: 0,
        clientRequestId: commandId(`${archiveId}:${initiative.version}`),
        initiativeId: selected.source.initiativeId,
        expectedInitiativeVersion: initiative.version,
        closureSnapshotRef: { snapshotId: selected.source.closureSnapshotId, version: 1 },
        retentionPolicyRef: { ref: archive.retentionRef, version: archive.retentionVersion },
        legalHold: false,
        exportRefs: [{ ref: archive.exportRef, version: archive.exportVersion }],
      });
      const manifests = (await listArchiveManifests()) as {
        items?: Array<Record<string, unknown>>;
      };
      setReceipt({
        type: 'ARCHIVE',
        ...(manifests.items ?? []).find((x) => x.archiveId === archiveId),
      });
      setWrite('IDLE');
    } catch (e) {
      setWrite(e instanceof RuntimeApiError && e.status === 409 ? 'CONFLICT' : 'FAILED');
    }
  };
  if (state === 'LOADING')
    return (
      <section aria-label="Benefits and Closure" role="status" className="p-4">
        Loading benefits work
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label="Benefits and Closure" role="alert" className="p-4">
        Benefits work unavailable.{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          Retry
        </button>
      </section>
    );
  return (
    <section aria-label="Benefits and Closure" className="border-b border-c-border p-4">
      <h3 className="font-semibold">Benefits, Effectiveness and Closure</h3>
      <p className="text-xs text-c-text-muted">
        Measurement, independent review, closure and archive are separate canonical gates.
      </p>
      {receipt && (
        <div role="status" className="my-3 rounded border border-c-success/40 p-3 text-sm">
          <strong>{String(receipt.type)} receipt</strong>
          {'snapshotId' in receipt && (
            <div>
              {String(receipt.type) === 'EFFECTIVENESS_SNAPSHOT'
                ? `Effectiveness Snapshot ${String(receipt.snapshotId)} · ${String(receipt.outcome)} · lifecycle EFFECTIVENESS_REVIEWED`
                : `Closure Snapshot ${String(receipt.snapshotId)} · CLOSED`}
            </div>
          )}
          {'archiveId' in receipt && (
            <div>Archive Manifest {String(receipt.archiveId)} · read-only</div>
          )}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? 'Source version changed. Reload before acting.'
            : 'No canonical transition was saved.'}
        </p>
      )}
      <section
        aria-label="Results KPI observations"
        className="my-4 rounded border border-c-border p-4"
      >
        <h4 className="font-medium">Canonical Results KPI observations</h4>
        <ul className="mt-2 space-y-2">
          {observations.map((observation) => (
            <li
              key={observation.observationId}
              className="rounded border border-c-border p-2 text-xs"
            >
              <label className="flex items-start gap-2">
                <input
                  aria-label={`Select observation ${observation.observationId}`}
                  type="checkbox"
                  checked={selectedObservationIds.includes(observation.observationId)}
                  onChange={(event) =>
                    setSelectedObservationIds((current) =>
                      event.target.checked
                        ? [...current, observation.observationId]
                        : current.filter((id) => id !== observation.observationId)
                    )
                  }
                />
                <span>
                  <strong>
                    {observation.observationId} v{observation.version}
                  </strong>{' '}
                  · {observation.measurementState} · observed{' '}
                  {observation.observedValue ?? 'UNKNOWN'} · {observation.knowledgeState} · Finance{' '}
                  {observation.financeReconciliationRef
                    ? `${observation.financeReconciliationRef.reconciliationId} v${observation.financeReconciliationRef.version}`
                    : 'NOT_MEASURED / none'}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[
            [
              'Finance reconciliation',
              financeId,
              setFinanceId,
              financeJson,
              setFinanceJson,
              createFinance,
            ],
            [
              'Results KPI observation',
              observationId,
              setObservationId,
              observationJson,
              setObservationJson,
              createObservation,
            ],
            [
              'Effectiveness Case',
              effectivenessId,
              setEffectivenessId,
              effectivenessJson,
              setEffectivenessJson,
              createEffectiveness,
            ],
          ].map(([label, id, setId, json, setJson, action]) => (
            <section key={String(label)} className="rounded border border-c-border p-3">
              <h5 className="text-sm font-semibold">{String(label)}</h5>
              <input
                aria-label={`${String(label)} ID`}
                value={String(id)}
                onChange={(event) =>
                  (setId as React.Dispatch<React.SetStateAction<string>>)(event.target.value)
                }
                className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
              />
              <textarea
                aria-label={`${String(label)} contract JSON`}
                value={String(json)}
                onChange={(event) =>
                  (setJson as React.Dispatch<React.SetStateAction<string>>)(event.target.value)
                }
                className="mt-2 block min-h-28 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
              />
              <button
                className="btn-secondary mt-2"
                onClick={() => void (action as () => Promise<void>)()}
              >
                {String(label).startsWith('Effectiveness')
                  ? 'Create with selected exact observations'
                  : `Create ${String(label)}`}
              </button>
            </section>
          ))}
        </div>
        <p className="mt-2 text-xs text-c-text-muted">
          MEASURED financial observations require an exact AVAILABLE reconciliation. NOT_MEASURED is
          forced to null + UNKNOWN and cannot invent a value.
        </p>
      </section>
      {rows.length > 0 && (
        <TableWithPreviewLayout<Row>
          selectedId={selectedId}
          selectedItem={selected}
          onSelect={setSelectedId}
          onOpenFull={setSelectedId}
          itemIds={rows.map((x) => x.id)}
          getItemById={(id) => rows.find((x) => x.id === id) ?? null}
          renderPreview={(row) => (
            <div className="space-y-3 p-4 text-sm" aria-label="Effectiveness Workbench">
              <p>Effectiveness Case {row.id}</p>
              <p>
                Results Case {row.source.resultsAcceptanceRef.resultsCaseId} v
                {row.source.resultsAcceptanceRef.version}
              </p>
              <p>
                Benefits Handoff Pack {row.source.benefitsHandoffPackRef.packId} v
                {row.source.benefitsHandoffPackRef.version}
              </p>
              {row.source.measurements.map((m) => (
                <article key={m.measurementId} className="rounded border border-c-border p-2">
                  <strong>{m.measurementId}</strong>
                  <p>
                    KPI {m.contractRef.ref} v{m.contractRef.version} · source {m.sourceRef.ref} v
                    {m.sourceRef.version}
                  </p>
                  <p>
                    Baseline {displayValue(m.baseline, m.knowledgeState)} · current{' '}
                    {displayValue(m.current, m.knowledgeState)} · target{' '}
                    {displayValue(m.target, m.knowledgeState)} {m.unit}
                    {m.currency ? ` ${m.currency}` : ''}
                  </p>
                  <p>
                    {m.formula} · {m.window.start} → {m.window.end} · asOf {m.asOf}
                  </p>
                  <p>
                    {m.knowledgeState} · confidence {m.confidence} · evidence{' '}
                    {m.evidenceRefs.join(', ') || 'EVIDENCE_MISSING'}
                  </p>
                </article>
              ))}
              {row.source.status === 'PENDING_REVIEW' && (
                <label className="block">
                  Rationale
                  <textarea
                    aria-label="Effectiveness rationale"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              )}
              {row.source.status === 'CLOSED' && (
                <div className="grid gap-2 md:grid-cols-2">
                  <label>
                    <input
                      aria-label="Legal hold"
                      type="checkbox"
                      checked={legalHold}
                      onChange={(e) => setLegalHold(e.target.checked)}
                    />{' '}
                    Active legal hold
                  </label>
                  {legalHold && <p role="alert">Archive blocked: active legal hold.</p>}
                  <label>
                    Retention policy ref
                    <input
                      aria-label="Retention policy ref"
                      value={archive.retentionRef}
                      onChange={(e) => setArchive((x) => ({ ...x, retentionRef: e.target.value }))}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                  <label>
                    Export ref
                    <input
                      aria-label="Archive export ref"
                      value={archive.exportRef}
                      onChange={(e) => setArchive((x) => ({ ...x, exportRef: e.target.value }))}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
          renderPreviewFooter={(row) => (
            <div className="flex flex-wrap gap-2 p-3">
              {row.source.status === 'TRACKING' && (
                <>
                  <button
                    className="btn-primary"
                    onClick={() => void transition({ action: 'REQUEST_REVIEW' })}
                  >
                    Request review
                  </button>
                </>
              )}
              {row.source.status === 'PENDING_REVIEW' && (
                <>
                  {(
                    ['RETURN_FOR_MEASUREMENT', 'NOT_ACHIEVED', 'PARTIAL', 'CONFIRMED'] as const
                  ).map((outcome) => (
                    <button
                      key={outcome}
                      className={outcome === 'CONFIRMED' ? 'btn-primary' : 'btn-secondary'}
                      onClick={() =>
                        void transition({
                          action: 'DECIDE',
                          outcome,
                          rationale: rationale.trim(),
                        })
                      }
                    >
                      {outcome}
                    </button>
                  ))}
                </>
              )}
              {row.source.status === 'CLOSED' && (
                <button
                  className="btn-primary"
                  disabled={legalHold || !archive.retentionRef || !archive.exportRef}
                  onClick={() => void archiveCase()}
                >
                  Create Archive Manifest
                </button>
              )}
            </div>
          )}
        >
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedId}
            onRowClick={(x) => setSelectedId(x.id)}
            persistKey="my-work.effectiveness-closure.v1"
          />
        </TableWithPreviewLayout>
      )}
    </section>
  );
};
