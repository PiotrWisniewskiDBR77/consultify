import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';

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
import { EMPTY_SELECTION } from './ideaSelectionTypes';

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
const buildColumns = (t: TFunction): TableColumn[] => [
  {
    id: 'title',
    label: t('myWork.closureDecisionQueue.columnClosureCase', 'Closure Case'),
    sortable: true,
    width: '240px',
  },
  {
    id: 'initiative',
    label: t('myWork.closureDecisionQueue.columnInitiative', 'Initiative'),
    sortable: true,
  },
  {
    id: 'executionCase',
    label: t('myWork.closureDecisionQueue.columnExecutionCase', 'Execution Case'),
    sortable: true,
  },
  {
    id: 'snapshot',
    label: t('myWork.closureDecisionQueue.columnEffectivenessSnapshot', 'Effectiveness Snapshot'),
    sortable: true,
  },
  {
    id: 'authority',
    label: t('myWork.closureDecisionQueue.columnIndependentAuthority', 'Independent authority'),
    sortable: true,
  },
  {
    id: 'status',
    label: t('myWork.closureDecisionQueue.columnStatus', 'Status'),
    sortable: true,
    filterable: true,
  },
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
  const { t } = useTranslation();
  const columns = useMemo(() => buildColumns(t), [t]);
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

  // TRI-OBS-17 (2026-08-25, R10 traceability): same `runAction(id, run)`
  // wrapper as `WhiteboardToolbar.tsx`/`ProcessFlowToolbar.tsx` — checks the
  // real central Idea Workspace registry first (this screen isn't an Idea
  // canvas surface, so today it never matches, exactly like an
  // unmigrated toolbar action) and otherwise runs the original callback
  // unchanged. Zero behaviour change; makes these commands mechanically
  // traceable and ready to pick up a real registry entry later without
  // touching call sites again.
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

  const closureCasesLabel = t('myWork.closureDecisionQueue.title', 'Closure Cases');

  if (state === 'LOADING')
    return (
      <section aria-label={closureCasesLabel} role="status">
        {t('myWork.closureDecisionQueue.loading', 'Loading Closure Cases')}
      </section>
    );
  if (state === 'ERROR')
    return (
      <section aria-label={closureCasesLabel} role="alert">
        {t('myWork.closureDecisionQueue.unavailable', 'Closure Cases unavailable.')}
      </section>
    );
  return (
    <section aria-label={closureCasesLabel} className="border-b border-c-border p-4">
      <h3 className="font-semibold">{closureCasesLabel}</h3>
      <p className="text-xs text-c-text-muted">
        {t(
          'myWork.closureDecisionQueue.subtitle',
          'Independent Closure decision after immutable Effectiveness Snapshot. Archive remains separate.'
        )}
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
              {t('myWork.closureDecisionQueue.previewClosureCase', 'Closure Case {{id}} v{{version}}', {
                id: row.id,
                version: row.version,
              })}
            </p>
            <p>
              {t('myWork.closureDecisionQueue.previewEffectivenessSnapshot', 'Effectiveness Snapshot {{snapshot}}', {
                snapshot: row.snapshot,
              })}
            </p>
            <p>
              {t(
                'myWork.closureDecisionQueue.previewInitiativeExecution',
                'Initiative {{initiative}} · Execution Case {{executionCase}}',
                { initiative: row.initiative, executionCase: row.executionCase }
              )}
            </p>
            <p>
              {t('myWork.closureDecisionQueue.previewLessons', 'Lessons {{lessons}}', {
                lessons: row.source.lessons.join(', '),
              })}
            </p>
            <p>
              {t('myWork.closureDecisionQueue.previewLineage', 'Lineage {{lineage}}', {
                lineage: row.source.lineageRefs
                  .map((ref: any) => `${ref.ref} v${ref.version}`)
                  .join(', '),
              })}
            </p>
            <p>
              {t('myWork.closureDecisionQueue.previewFollowUps', 'Follow-ups {{followUps}}', {
                followUps: row.source.followUps
                  .map((item: any) =>
                    item.kind === 'TASK_REF'
                      ? `${item.taskId} v${item.version}`
                      : `${item.itemId} · ${item.ownerId} · ${item.dueAt}`
                  )
                  .join(', '),
              })}
            </p>
            <p>
              {t(
                'myWork.closureDecisionQueue.previewRetention',
                'Retention {{classification}} · {{ref}} v{{version}} · legal hold {{legalHold}}',
                {
                  classification: row.source.retention.classification,
                  ref: row.source.retention.policyRef.ref,
                  version: row.source.retention.policyRef.version,
                  legalHold: String(row.source.retention.legalHold),
                }
              )}
            </p>
            {policyEnforced && !gate.quorumRef && (
              <p role="alert">
                {t(
                  'myWork.closureDecisionQueue.quorumNotSatisfied',
                  'CLOSURE GateSignoff quorum is not satisfied.'
                )}
              </p>
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
        aria-label={t('myWork.closureDecisionQueue.requestWorkbenchAriaLabel', 'Closure request workbench')}
        className="mt-4 rounded border border-c-border p-4"
      >
        <h4 className="font-medium">
          {t('myWork.closureDecisionQueue.requestTitle', 'Request Closure Case')}
        </h4>
        <label className="text-xs">
          {t('myWork.closureDecisionQueue.reviewedEffectiveness', 'Reviewed Effectiveness')}
          <select
            aria-label={t(
              'myWork.closureDecisionQueue.effectivenessCaseAriaLabel',
              'Closure Effectiveness Case'
            )}
            value={request.effectivenessCaseId}
            onChange={(event) =>
              setRequest((current) => ({ ...current, effectivenessCaseId: event.target.value }))
            }
            className="block w-full rounded border border-c-border bg-c-surface p-2"
          >
            <option value="">
              {t(
                'myWork.closureDecisionQueue.selectEffectivenessSnapshot',
                'Select immutable Effectiveness Snapshot'
              )}
            </option>
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
                  aria-label={t(
                    'myWork.closureDecisionQueue.requestFieldAriaLabel',
                    'Closure request {{field}}',
                    { field: key }
                  )}
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
              aria-label={t(
                'myWork.closureDecisionQueue.requestLegalHoldAriaLabel',
                'Closure request legalHold'
              )}
              type="checkbox"
              checked={request.legalHold}
              onChange={(event) =>
                setRequest((current) => ({ ...current, legalHold: event.target.checked }))
              }
            />{' '}
            {t('myWork.closureDecisionQueue.legalHoldLabel', 'Legal hold')}
          </label>
        </div>
        <button
          className="btn-secondary mt-3"
          onClick={() => runAction('closure.request.submit', () => void submitRequest())}
        >
          {t('myWork.closureDecisionQueue.requestSubmit', 'Request independent Closure')}
        </button>
      </section>
      {selected?.status === 'PENDING' && (
        <section
          aria-label={t(
            'myWork.closureDecisionQueue.decisionWorkbenchAriaLabel',
            'Closure decision workbench'
          )}
          className="mt-4 rounded border border-c-border p-4"
        >
          <select
            aria-label={t('myWork.closureDecisionQueue.outcomeAriaLabel', 'Closure outcome')}
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
            aria-label={t('myWork.closureDecisionQueue.rationaleAriaLabel', 'Closure rationale')}
            value={decision.rationale}
            onChange={(event) =>
              setDecision((current) => ({ ...current, rationale: event.target.value }))
            }
            className="mt-2 block w-full rounded border border-c-border bg-c-surface p-2"
          />
          {decision.outcome === 'CLOSE' && (
            <input
              aria-label={t('myWork.closureDecisionQueue.snapshotIdAriaLabel', 'Closure Snapshot ID')}
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
            {t('myWork.closureDecisionQueue.decide', 'Decide Closure')}
          </button>
        </section>
      )}
      {selected?.status === 'CLOSED' && (
        <section
          aria-label={t('myWork.closureDecisionQueue.archiveWorkbenchAriaLabel', 'Archive workbench')}
          className="mt-4 rounded border border-c-border p-4"
        >
          <h4 className="font-medium">
            {t('myWork.closureDecisionQueue.archiveTitle', 'Archive closed Initiative')}
          </h4>
          <label className="block text-xs">
            <input
              aria-label={t('myWork.closureDecisionQueue.legalHoldAriaLabel', 'Legal hold')}
              type="checkbox"
              checked={legalHold}
              onChange={(event) => setLegalHold(event.target.checked)}
            />{' '}
            {t('myWork.closureDecisionQueue.activeLegalHold', 'Active legal hold')}
          </label>
          {legalHold && (
            <p role="alert">
              {t('myWork.closureDecisionQueue.archiveBlocked', 'Archive blocked: active legal hold.')}
            </p>
          )}
          <label className="mt-2 block text-xs">
            {t('myWork.closureDecisionQueue.retentionPolicyRef', 'Retention policy ref')}
            <input
              aria-label={t(
                'myWork.closureDecisionQueue.retentionPolicyRefAriaLabel',
                'Retention policy ref'
              )}
              value={archive.retentionRef}
              onChange={(event) =>
                setArchive((current) => ({ ...current, retentionRef: event.target.value }))
              }
              className="block w-full rounded border border-c-border bg-c-surface p-2"
            />
          </label>
          <label className="mt-2 block text-xs">
            {t('myWork.closureDecisionQueue.exportRef', 'Export ref')}
            <input
              aria-label={t('myWork.closureDecisionQueue.exportRefAriaLabel', 'Archive export ref')}
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
            onClick={() => runAction('closure.archive.create', () => void archiveSelected())}
          >
            {t('myWork.closureDecisionQueue.createArchiveManifest', 'Create Archive Manifest')}
          </button>
        </section>
      )}
      {receipt && (
        <div role="status" className="mt-3 rounded border border-c-success/40 p-3">
          {receipt.type === 'ARCHIVE'
            ? t('myWork.closureDecisionQueue.receiptArchive', 'Archive Manifest {{id}} · read-only', {
                id: String(receipt.archiveId),
              })
            : `${String(receipt.type)} · ${String(receipt.snapshotId ?? receipt.closureCaseId)} · ${String(receipt.status ?? (receipt.type === 'CLOSURE_SNAPSHOT' ? 'CLOSED' : ''))}`}
        </div>
      )}
      {(write === 'CONFLICT' || write === 'FAILED') && (
        <p role="alert">
          {write === 'CONFLICT'
            ? t('myWork.closureDecisionQueue.conflict', 'Closure source changed. Reload.')
            : t('myWork.closureDecisionQueue.failed', 'Closure command failed.')}
        </p>
      )}
    </section>
  );
};
