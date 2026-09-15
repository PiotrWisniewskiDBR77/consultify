import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import {
  type ActionContext,
  getActionsForSurface,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
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

import { EMPTY_SELECTION } from './ideaSelectionTypes';

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
const buildColumns = (t: TFunction): TableColumn[] => [
  {
    id: 'caseId',
    label: t('myWork.effectivenessClosureQueue.columnEffectivenessCase', 'Effectiveness Case'),
    sortable: true,
  },
  {
    id: 'initiative',
    label: t('myWork.effectivenessClosureQueue.columnInitiative', 'Initiative'),
    sortable: true,
  },
  {
    id: 'lineage',
    label: t('myWork.effectivenessClosureQueue.columnResultsLineage', 'Exact results lineage'),
    sortable: true,
  },
  {
    id: 'owner',
    label: t('myWork.effectivenessClosureQueue.columnCurrentAuthority', 'Current authority'),
    sortable: true,
  },
  { id: 'status', label: t('myWork.effectivenessClosureQueue.columnStatus', 'Status'), sortable: true },
];
const displayValue = (value: number | null, knowledge: Knowledge) =>
  knowledge === 'UNKNOWN' || value === null ? 'UNKNOWN' : String(value);

export const EffectivenessClosureQueue = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
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
        title: t('myWork.effectivenessClosureQueue.rowTitle', 'Effectiveness {{initiativeId}}', {
          initiativeId: x.initiativeId,
        }),
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
    [items, t]
  );
  const selected = rows.find((x) => x.id === selectedId) ?? null;

  // TRI-OBS-17 (2026-08-25, R10 traceability): same `runAction(id, run)`
  // wrapper as `WhiteboardToolbar.tsx`/`ProcessFlowToolbar.tsx` — checks the
  // real central Idea Workspace registry first (this screen isn't an Idea
  // canvas surface, so today it never matches, exactly like an unmigrated
  // toolbar action) and otherwise runs the original callback unchanged. Zero
  // behaviour change; makes this command mechanically traceable and ready to
  // pick up a real registry entry later without touching the call site again.
  const registryActionsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActionsForSurface>[number]>();
    for (const entry of getActionsForSurface('panel', { tool: 'table' })) {
      map.set(entry.def.id, entry);
    }
    return map;
  }, []);

  const runAction = useCallback(
    (id: string, run: () => void) => {
      if (!registryActionsById.has(id)) {
        run();
        return;
      }
      const ctx: ActionContext = {
        ideaId: '',
        tool: 'table',
        selection: EMPTY_SELECTION,
        surface: 'panel',
        source: 'ui',
        params: { run },
      };
      void runIdeaAction(id, ctx);
    },
    [registryActionsById]
  );

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

  const benefitsAndClosureLabel = t(
    'myWork.effectivenessClosureQueue.title',
    'Benefits and Closure'
  );

  if (state === 'LOADING')
    return (
      <section aria-label={benefitsAndClosureLabel} role="status" className="p-4">
        {t('myWork.effectivenessClosureQueue.loading', 'Loading benefits work')}
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={benefitsAndClosureLabel} role="alert" className="p-4">
        {t('myWork.effectivenessClosureQueue.unavailable', 'Benefits work unavailable.')}{' '}
        <button className="btn-secondary" onClick={() => void load()}>
          {t('myWork.effectivenessClosureQueue.retry', 'Retry')}
        </button>
      </section>
    );

  const creationCards = [
    {
      key: 'finance',
      label: t('myWork.effectivenessClosureQueue.financeReconciliation', 'Finance reconciliation'),
      id: financeId,
      setId: setFinanceId as React.Dispatch<React.SetStateAction<string>>,
      json: financeJson,
      setJson: setFinanceJson as React.Dispatch<React.SetStateAction<string>>,
      action: createFinance,
    },
    {
      key: 'observation',
      label: t('myWork.effectivenessClosureQueue.resultsKpiObservation', 'Results KPI observation'),
      id: observationId,
      setId: setObservationId as React.Dispatch<React.SetStateAction<string>>,
      json: observationJson,
      setJson: setObservationJson as React.Dispatch<React.SetStateAction<string>>,
      action: createObservation,
    },
    {
      key: 'effectiveness',
      label: t('myWork.effectivenessClosureQueue.effectivenessCase', 'Effectiveness Case'),
      id: effectivenessId,
      setId: setEffectivenessId as React.Dispatch<React.SetStateAction<string>>,
      json: effectivenessJson,
      setJson: setEffectivenessJson as React.Dispatch<React.SetStateAction<string>>,
      action: createEffectiveness,
    },
  ];

  return (
    <section aria-label={benefitsAndClosureLabel} className="border-b border-c-border p-4">
      <h3 className="font-semibold">
        {t('myWork.effectivenessClosureQueue.pageTitle', 'Benefits, Effectiveness and Closure')}
      </h3>
      <p className="text-xs text-c-text-muted">
        {t(
          'myWork.effectivenessClosureQueue.subtitle',
          'Measurement, independent review, closure and archive are separate canonical gates.'
        )}
      </p>
      {receipt && (
        <div role="status" className="my-3 rounded border border-c-success/40 p-3 text-sm">
          <strong>
            {t('myWork.effectivenessClosureQueue.receiptHeading', '{{type}} receipt', {
              type: String(receipt.type),
            })}
          </strong>
          {'snapshotId' in receipt && (
            <div>
              {String(receipt.type) === 'EFFECTIVENESS_SNAPSHOT'
                ? t(
                    'myWork.effectivenessClosureQueue.receiptEffectivenessSnapshot',
                    'Effectiveness Snapshot {{snapshotId}} · {{outcome}} · lifecycle EFFECTIVENESS_REVIEWED',
                    { snapshotId: String(receipt.snapshotId), outcome: String(receipt.outcome) }
                  )
                : t(
                    'myWork.effectivenessClosureQueue.receiptClosureSnapshot',
                    'Closure Snapshot {{snapshotId}} · CLOSED',
                    { snapshotId: String(receipt.snapshotId) }
                  )}
            </div>
          )}
          {'archiveId' in receipt && (
            <div>
              {t(
                'myWork.effectivenessClosureQueue.receiptArchive',
                'Archive Manifest {{archiveId}} · read-only',
                { archiveId: String(receipt.archiveId) }
              )}
            </div>
          )}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert" className="text-c-danger">
          {write === 'CONFLICT'
            ? t('myWork.effectivenessClosureQueue.conflict', 'Source version changed. Reload before acting.')
            : t('myWork.effectivenessClosureQueue.failed', 'No canonical transition was saved.')}
        </p>
      )}
      <section
        aria-label={t(
          'myWork.effectivenessClosureQueue.observationsAriaLabel',
          'Results KPI observations'
        )}
        className="my-4 rounded border border-c-border p-4"
      >
        <h4 className="font-medium">
          {t(
            'myWork.effectivenessClosureQueue.observationsTitle',
            'Canonical Results KPI observations'
          )}
        </h4>
        <ul className="mt-2 space-y-2">
          {observations.map((observation) => (
            <li
              key={observation.observationId}
              className="rounded border border-c-border p-2 text-xs"
            >
              <label className="flex items-start gap-2">
                <input
                  aria-label={t(
                    'myWork.effectivenessClosureQueue.selectObservationAriaLabel',
                    'Select observation {{id}}',
                    { id: observation.observationId }
                  )}
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
                  ·{' '}
                  {t(
                    'myWork.effectivenessClosureQueue.observationSummary',
                    '{{measurementState}} · observed {{observedValue}} · {{knowledgeState}} · Finance {{finance}}',
                    {
                      measurementState: observation.measurementState,
                      observedValue: observation.observedValue ?? 'UNKNOWN',
                      knowledgeState: observation.knowledgeState,
                      finance: observation.financeReconciliationRef
                        ? `${observation.financeReconciliationRef.reconciliationId} v${observation.financeReconciliationRef.version}`
                        : t(
                            'myWork.effectivenessClosureQueue.notMeasuredNone',
                            'NOT_MEASURED / none'
                          ),
                    }
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {creationCards.map((card) => (
            <section key={card.key} className="rounded border border-c-border p-3">
              <h5 className="text-sm font-semibold">{card.label}</h5>
              <input
                aria-label={t('myWork.effectivenessClosureQueue.cardIdAriaLabel', '{{label}} ID', {
                  label: card.label,
                })}
                value={card.id}
                onChange={(event) => card.setId(event.target.value)}
                className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
              />
              <textarea
                aria-label={t(
                  'myWork.effectivenessClosureQueue.cardContractJsonAriaLabel',
                  '{{label}} contract JSON',
                  { label: card.label }
                )}
                value={card.json}
                onChange={(event) => card.setJson(event.target.value)}
                className="mt-2 block min-h-28 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
              />
              <button className="btn-secondary mt-2" onClick={() => void card.action()}>
                {card.key === 'effectiveness'
                  ? t(
                      'myWork.effectivenessClosureQueue.createWithSelectedObservations',
                      'Create with selected exact observations'
                    )
                  : t('myWork.effectivenessClosureQueue.createCard', 'Create {{label}}', {
                      label: card.label,
                    })}
              </button>
            </section>
          ))}
        </div>
        <p className="mt-2 text-xs text-c-text-muted">
          {t(
            'myWork.effectivenessClosureQueue.measurementNote',
            'MEASURED financial observations require an exact AVAILABLE reconciliation. NOT_MEASURED is forced to null + UNKNOWN and cannot invent a value.'
          )}
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
            <div
              className="space-y-3 p-4 text-sm"
              aria-label={t(
                'myWork.effectivenessClosureQueue.workbenchAriaLabel',
                'Effectiveness Workbench'
              )}
            >
              <p>
                {t('myWork.effectivenessClosureQueue.effectivenessCaseId', 'Effectiveness Case {{id}}', {
                  id: row.id,
                })}
              </p>
              <p>
                {t(
                  'myWork.effectivenessClosureQueue.resultsCase',
                  'Results Case {{resultsCaseId}} v{{version}}',
                  {
                    resultsCaseId: row.source.resultsAcceptanceRef.resultsCaseId,
                    version: row.source.resultsAcceptanceRef.version,
                  }
                )}
              </p>
              <p>
                {t(
                  'myWork.effectivenessClosureQueue.benefitsHandoffPack',
                  'Benefits Handoff Pack {{packId}} v{{version}}',
                  {
                    packId: row.source.benefitsHandoffPackRef.packId,
                    version: row.source.benefitsHandoffPackRef.version,
                  }
                )}
              </p>
              {row.source.measurements.map((m) => (
                <article key={m.measurementId} className="rounded border border-c-border p-2">
                  <strong>{m.measurementId}</strong>
                  <p>
                    {t(
                      'myWork.effectivenessClosureQueue.kpiSource',
                      'KPI {{contractRef}} v{{contractVersion}} · source {{sourceRef}} v{{sourceVersion}}',
                      {
                        contractRef: m.contractRef.ref,
                        contractVersion: m.contractRef.version,
                        sourceRef: m.sourceRef.ref,
                        sourceVersion: m.sourceRef.version,
                      }
                    )}
                  </p>
                  <p>
                    {t(
                      'myWork.effectivenessClosureQueue.baselineCurrentTarget',
                      'Baseline {{baseline}} · current {{current}} · target {{target}} {{unit}}{{currency}}',
                      {
                        baseline: displayValue(m.baseline, m.knowledgeState),
                        current: displayValue(m.current, m.knowledgeState),
                        target: displayValue(m.target, m.knowledgeState),
                        unit: m.unit,
                        currency: m.currency ? ` ${m.currency}` : '',
                      }
                    )}
                  </p>
                  <p>
                    {m.formula} · {m.window.start} → {m.window.end} ·{' '}
                    {t('myWork.effectivenessClosureQueue.asOf', 'asOf {{asOf}}', { asOf: m.asOf })}
                  </p>
                  <p>
                    {t(
                      'myWork.effectivenessClosureQueue.knowledgeConfidenceEvidence',
                      '{{knowledgeState}} · confidence {{confidence}} · evidence {{evidence}}',
                      {
                        knowledgeState: m.knowledgeState,
                        confidence: m.confidence,
                        evidence: m.evidenceRefs.join(', ') || 'EVIDENCE_MISSING',
                      }
                    )}
                  </p>
                </article>
              ))}
              {row.source.status === 'PENDING_REVIEW' && (
                <label className="block">
                  {t('myWork.effectivenessClosureQueue.rationale', 'Rationale')}
                  <textarea
                    aria-label={t(
                      'myWork.effectivenessClosureQueue.rationaleAriaLabel',
                      'Effectiveness rationale'
                    )}
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
                      aria-label={t('myWork.effectivenessClosureQueue.legalHoldAriaLabel', 'Legal hold')}
                      type="checkbox"
                      checked={legalHold}
                      onChange={(e) => setLegalHold(e.target.checked)}
                    />{' '}
                    {t('myWork.effectivenessClosureQueue.activeLegalHold', 'Active legal hold')}
                  </label>
                  {legalHold && (
                    <p role="alert">
                      {t(
                        'myWork.effectivenessClosureQueue.archiveBlocked',
                        'Archive blocked: active legal hold.'
                      )}
                    </p>
                  )}
                  <label>
                    {t('myWork.effectivenessClosureQueue.retentionPolicyRef', 'Retention policy ref')}
                    <input
                      aria-label={t(
                        'myWork.effectivenessClosureQueue.retentionPolicyRefAriaLabel',
                        'Retention policy ref'
                      )}
                      value={archive.retentionRef}
                      onChange={(e) => setArchive((x) => ({ ...x, retentionRef: e.target.value }))}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                  <label>
                    {t('myWork.effectivenessClosureQueue.exportRef', 'Export ref')}
                    <input
                      aria-label={t(
                        'myWork.effectivenessClosureQueue.exportRefAriaLabel',
                        'Archive export ref'
                      )}
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
                    {t('myWork.effectivenessClosureQueue.requestReview', 'Request review')}
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
                  onClick={() => runAction('effectiveness.archive.create', () => void archiveCase())}
                >
                  {t('myWork.effectivenessClosureQueue.createArchiveManifest', 'Create Archive Manifest')}
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
