import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  createPortfolioAnalysis,
  decidePortfolioDecision,
  listGovernedOrganizationContextVersions,
  listPortfolioScenarioRegister,
  type PortfolioConsultingAnalysisItem,
  type PortfolioConsultingAnalysisReadModel,
  type PortfolioScenarioRegisterItem,
  readInitiativeCapabilities,
  readPortfolioAnalysis,
  readPortfolioDecision,
  requestPortfolioDecision,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

type Disposition = 'IN' | 'PARKING' | 'ARCHIVE';
interface AnalysisRow extends TableRow {
  id: string;
  title: string;
  kind: PortfolioConsultingAnalysisItem['kind'];
  kindLabel: string;
  criterionLabel: string;
  confidenceLabel: string;
  source: string;
  item: PortfolioConsultingAnalysisItem;
}

const kindOrder = { OBSERVATION: 0, RECOMMENDATION: 1, DECISION: 2 } as const;
const columns: TableColumn[] = [
  { id: 'kindLabel', label: 'Type', sortable: true, width: '150px' },
  { id: 'criterionLabel', label: 'Criterion', sortable: true, width: '180px' },
  { id: 'title', label: 'Analysis item', sortable: true },
  { id: 'confidenceLabel', label: 'Confidence', sortable: true, width: '130px' },
  { id: 'source', label: 'Source / provenance', width: '230px' },
];

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random()}`;
}

function asDecisionId(analysisId: string, itemId: string, initiativeId: string) {
  return `portfolio-analysis:${analysisId}:${itemId}:${initiativeId}`;
}

export function InitiativeConsultingAnalysisView({
  scopeKey,
  authorityId,
  onNavigatePlan,
  onNavigateCapacity,
}: {
  scopeKey: string;
  authorityId: string;
  onNavigatePlan?: () => void;
  onNavigateCapacity: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const [scenarios, setScenarios] = useState<PortfolioScenarioRegisterItem[]>([]);
  const [contexts, setContexts] = useState<
    Awaited<ReturnType<typeof listGovernedOrganizationContextVersions>>
  >([]);
  const [scenarioId, setScenarioId] = useState('');
  const [contextRef, setContextRef] = useState('');
  const [analysisState, setAnalysis] = useState<PortfolioConsultingAnalysisReadModel | null>(null);
  const [analysisScopeKey, setAnalysisScopeKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [disposition, setDisposition] = useState<Disposition>('IN');
  const [reason, setReason] = useState('');
  const [returnCondition, setReturnCondition] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [selfApprovalByInitiative, setSelfApprovalByInitiative] = useState<Record<string, boolean>>(
    {}
  );
  const [approvalState, setApprovalState] = useState<'IDLE' | 'LOADING' | 'READY' | 'ERROR'>(
    'IDLE'
  );
  const [state, setState] = useState<'LOADING' | 'READY' | 'GENERATING' | 'DECIDING' | 'ERROR'>(
    'LOADING'
  );
  const [message, setMessage] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const analysisRequest = useRef<{ analysisId: string; clientRequestId: string } | null>(null);
  const decisionRequests = useRef(new Map<string, string>());
  const approvalGeneration = useRef(0);
  const renderedScopeKey = useRef(scopeKey);

  if (renderedScopeKey.current !== scopeKey) {
    renderedScopeKey.current = scopeKey;
    requestGeneration.current += 1;
    analysisRequest.current = null;
  }

  const analysis = analysisScopeKey === scopeKey ? analysisState : null;

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const controller = new AbortController();
    setState('LOADING');
    setMessage(null);
    setDecisionSaved(false);
    setSelfApprovalByInitiative({});
    setApprovalState('IDLE');
    setAnalysis(null);
    setAnalysisScopeKey(null);
    setSelectedId(null);
    setSelectedIds(new Set());
    setScenarioId('');
    setContextRef('');
    analysisRequest.current = null;
    Promise.all([
      listPortfolioScenarioRegister(controller.signal),
      listGovernedOrganizationContextVersions(controller.signal),
    ])
      .then(([scenarioBody, contextRows]) => {
        if (generation !== requestGeneration.current) return;
        const published = Array.isArray((scenarioBody as { scenarios?: unknown })?.scenarios)
          ? (
              (scenarioBody as { scenarios: PortfolioScenarioRegisterItem[] }).scenarios ?? []
            ).filter((item) => item.state === 'PUBLISHED')
          : [];
        setScenarios(published);
        setContexts(contextRows);
        setScenarioId(published[0]?.id ?? '');
        setContextRef(
          contextRows[0] ? `${contextRows[0].snapshotId}:${contextRows[0].version}` : ''
        );
        setState('READY');
      })
      .catch((error) => {
        if (controller.signal.aborted || generation !== requestGeneration.current) return;
        setState('ERROR');
        setMessage(error instanceof RuntimeApiError ? error.code : 'OPTIONS_UNAVAILABLE');
      });
    return () => controller.abort();
  }, [scopeKey]);

  useEffect(() => {
    const initiativeIds = Array.from(
      new Set(
        (analysis?.items ?? [])
          .filter((item) => item.kind === 'DECISION')
          .flatMap((item) => item.initiativeIds)
      )
    );
    const generation = ++approvalGeneration.current;
    if (!initiativeIds.length) {
      setSelfApprovalByInitiative({});
      setApprovalState('IDLE');
      return;
    }
    setApprovalState('LOADING');
    Promise.all(
      initiativeIds.map(
        async (initiativeId) =>
          [initiativeId, await readInitiativeCapabilities(initiativeId)] as const
      )
    )
      .then((entries) => {
        if (generation !== approvalGeneration.current) return;
        setSelfApprovalByInitiative(
          Object.fromEntries(
            entries.map(([initiativeId, capabilities]) => [
              initiativeId,
              capabilities.canReview && capabilities.canSelfApprove,
            ])
          )
        );
        setApprovalState('READY');
      })
      .catch(() => {
        if (generation !== approvalGeneration.current) return;
        setSelfApprovalByInitiative({});
        setApprovalState('ERROR');
      });
  }, [analysis]);

  const rows = useMemo<AnalysisRow[]>(
    () =>
      [...(analysis?.items ?? [])]
        .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.position - b.position)
        .map((item) => ({
          id: item.itemId,
          title: item.rationale,
          kind: item.kind,
          kindLabel: t(`initiatives.analysis.kinds.${item.kind}`, item.kind),
          criterionLabel: t(`initiatives.analysis.criteria.${item.criterion}`, item.criterion),
          confidenceLabel: t(`initiatives.analysis.confidence.${item.confidence}`, item.confidence),
          source: item.evidence.map((entry) => `${entry.source} · ${entry.field}`).join(', '),
          item,
        })),
    [analysis, t]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const decisionIds = useMemo(
    () => new Set(rows.filter((row) => row.kind === 'DECISION').map((row) => row.id)),
    [rows]
  );
  const initiativeLabel = useCallback(
    (initiativeId: string) => {
      const snapshot = analysis?.snapshot.initiatives.find(
        (entry) => entry.initiativeId === initiativeId
      );
      const name = snapshot?.facts.name ?? snapshot?.facts.title;
      return typeof name === 'string' && name.trim()
        ? name.trim()
        : t('initiatives.analysis.unnamedInitiative', 'Unnamed Initiative');
    },
    [analysis, t]
  );

  const runAnalysis = useCallback(async () => {
    const context = contexts.find((item) => `${item.snapshotId}:${item.version}` === contextRef);
    if (!scenarioId || !context || state === 'GENERATING') return;
    setState('GENERATING');
    setMessage(null);
    setDecisionSaved(false);
    const stable =
      analysisRequest.current ??
      (analysisRequest.current = { analysisId: requestId(), clientRequestId: requestId() });
    const generation = requestGeneration.current;
    try {
      await createPortfolioAnalysis({
        analysisId: stable.analysisId,
        scenarioId,
        contextSnapshotId: context.snapshotId,
        contextVersion: context.version,
        expectedVersion: 0,
        clientRequestId: stable.clientRequestId,
        rubricVersion: 'portfolio-consulting-v1',
      });
      if (generation !== requestGeneration.current) return;
      const persisted = await readPortfolioAnalysis(stable.analysisId);
      if (generation !== requestGeneration.current) return;
      setAnalysis(persisted.analysis);
      setAnalysisScopeKey(scopeKey);
      setSelectedId(persisted.analysis.items[0]?.itemId ?? null);
      setState('READY');
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setState('ERROR');
      setMessage(
        error instanceof RuntimeApiError &&
          [
            'PORTFOLIO_ANALYSIS_MODEL_NOT_CONFIGURED',
            'PORTFOLIO_ANALYSIS_REAL_MODEL_REQUIRED',
          ].includes(error.code)
          ? t(
              'initiatives.analysis.modelUnavailable',
              'Portfolio analysis is unavailable because no approved model is configured.'
            )
          : error instanceof RuntimeApiError
            ? error.code
            : 'PORTFOLIO_ANALYSIS_FAILED'
      );
    }
  }, [contextRef, contexts, scenarioId, scopeKey, state, t]);

  const invalidateAnalysisInput = useCallback(() => {
    requestGeneration.current += 1;
    analysisRequest.current = null;
    decisionRequests.current.clear();
    setAnalysis(null);
    setAnalysisScopeKey(null);
    setSelectedId(null);
    setSelectedIds(new Set());
    setDecisionSaved(false);
    setMessage(null);
    setState('READY');
  }, []);

  const decideItems = useCallback(
    async (items: AnalysisRow[]) => {
      if (!analysis || !authorityId || !dueDate || !reason.trim() || state === 'DECIDING') return;
      if (disposition !== 'IN' && !returnCondition.trim()) return;
      setState('DECIDING');
      setMessage(null);
      setDecisionSaved(false);
      try {
        for (const row of items) {
          if (row.kind !== 'DECISION') continue;
          for (const initiativeId of row.item.initiativeIds) {
            const initiative = analysis.snapshot.initiatives.find(
              (entry) => entry.initiativeId === initiativeId
            );
            if (!initiative) throw new Error('INITIATIVE_SNAPSHOT_MISSING');
            const decisionId = asDecisionId(analysis.analysisId, row.id, initiativeId);
            const requestKey = `${decisionId}:request`;
            const decideKey = `${decisionId}:decide`;
            const requestClientId = decisionRequests.current.get(requestKey) ?? requestId();
            const decideClientId = decisionRequests.current.get(decideKey) ?? requestId();
            decisionRequests.current.set(requestKey, requestClientId);
            decisionRequests.current.set(decideKey, decideClientId);
            await requestPortfolioDecision(initiativeId, {
              expectedVersion: initiative.initiativeVersion,
              clientRequestId: requestClientId,
              decisionId,
              authorityId,
              scenarioId: analysis.snapshot.portfolio.scenarioId,
              scenarioVersion: analysis.snapshot.portfolio.scenarioVersion,
              dueAt: `${dueDate}T23:59:59.000Z`,
            });
            await decidePortfolioDecision(initiativeId, {
              expectedVersion: initiative.initiativeVersion + 1,
              clientRequestId: decideClientId,
              decisionId,
              outcome: disposition === 'IN' ? 'APPROVED' : 'REJECTED',
              rationale: reason.trim(),
              conditions: [],
              mergeTargetInitiativeId: null,
              disposition: {
                kind: disposition,
                reason: reason.trim(),
                returnCondition: disposition === 'IN' ? null : returnCondition.trim(),
                inputSnapshot: {
                  analysisId: analysis.analysisId,
                  analysisVersion: analysis.aggregateVersion,
                  itemId: row.id,
                  asOf: analysis.snapshot.asOf,
                },
              },
            });
            const readback = await readPortfolioDecision(initiativeId);
            if (
              readback.decision.decisionId !== decisionId ||
              readback.decision.disposition?.inputSnapshot.itemId !== row.id
            )
              throw new Error('DECISION_READBACK_MISMATCH');
          }
        }
        setSelectedIds((current) => {
          const next = new Set(current);
          items.forEach((item) => next.delete(item.id));
          return next;
        });
        setMessage(t('initiatives.analysis.decisionSaved', 'The selected decisions were saved.'));
        setDecisionSaved(true);
        setState('READY');
      } catch (error) {
        setState('ERROR');
        setMessage(
          error instanceof RuntimeApiError && error.status === 409
            ? t(
                'initiatives.analysis.conflict',
                'The Initiative changed. Reload the analysis before deciding.'
              )
            : t('initiatives.analysis.decisionFailed', 'The decision was not saved.')
        );
      }
    },
    [analysis, authorityId, disposition, dueDate, reason, returnCondition, state, t]
  );

  const decisionForm = (items: AnalysisRow[]) => (
    <div className="space-y-3" data-testid="initiatives-analysis-decision-form">
      {approvalState === 'LOADING' ? (
        <p className="text-xs text-c-text-muted" role="status">
          {t('initiatives.analysis.authorityChecking', 'Checking decision authority…')}
        </p>
      ) : items.some((item) =>
          item.item.initiativeIds.some((initiativeId) => !selfApprovalByInitiative[initiativeId])
        ) ? (
        <p className="text-xs text-c-text-secondary" role="status">
          {t(
            'initiatives.analysis.authorityRequired',
            'Approval authority configuration is required before this decision can be saved.'
          )}
        </p>
      ) : null}
      <label className="block text-xs text-c-text-secondary">
        {t('initiatives.analysis.disposition', 'Disposition')}
        <select
          className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
          value={disposition}
          onChange={(event) => setDisposition(event.target.value as Disposition)}
        >
          <option value="IN">{t('initiatives.analysis.in', 'In')}</option>
          <option value="PARKING">{t('initiatives.analysis.parking', 'Parking')}</option>
          <option value="ARCHIVE">{t('initiatives.analysis.archive', 'Archive')}</option>
        </select>
      </label>
      <label className="block text-xs text-c-text-secondary">
        {t('initiatives.analysis.reason', 'Decision reason')}
        <textarea
          className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {disposition !== 'IN' ? (
        <label className="block text-xs text-c-text-secondary">
          {t('initiatives.analysis.returnCondition', 'Return condition')}
          <textarea
            className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
            value={returnCondition}
            onChange={(event) => setReturnCondition(event.target.value)}
          />
        </label>
      ) : null}
      <label className="block text-xs text-c-text-secondary">
        {t('initiatives.analysis.dueDate', 'Decision due date')}
        <input
          type="date"
          className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn-primary"
        disabled={
          !items.length ||
          approvalState !== 'READY' ||
          items.some((item) =>
            item.item.initiativeIds.some((initiativeId) => !selfApprovalByInitiative[initiativeId])
          ) ||
          !reason.trim() ||
          !dueDate ||
          (disposition !== 'IN' && !returnCondition.trim()) ||
          state === 'DECIDING'
        }
        onClick={() => void decideItems(items)}
      >
        {items.length > 1
          ? t('initiatives.analysis.decideSelected', 'Decide selected items')
          : t('initiatives.analysis.decideItem', 'Decide item')}
      </button>
    </div>
  );

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={t('initiatives.analysis.title', 'Initiative analysis')}
    >
      <div className="grid gap-3 border-b border-c-border p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs text-c-text-secondary">
          {t('initiatives.analysis.scenario', 'Published portfolio scenario')}
          <select
            aria-label={t('initiatives.analysis.scenario', 'Published portfolio scenario')}
            className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
            value={scenarioId}
            onChange={(event) => {
              invalidateAnalysisInput();
              setScenarioId(event.target.value);
            }}
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · v{item.version} ·{' '}
                {new Date(item.scope.asOf).toLocaleDateString(locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-c-text-secondary">
          {t('initiatives.analysis.context', 'Organization context snapshot')}
          <select
            aria-label={t('initiatives.analysis.context', 'Organization context snapshot')}
            className="mt-1 w-full rounded border border-c-border bg-c-surface p-2"
            value={contextRef}
            onChange={(event) => {
              invalidateAnalysisInput();
              setContextRef(event.target.value);
            }}
          >
            {contexts.map((item) => (
              <option
                key={`${item.snapshotId}:${item.version}`}
                value={`${item.snapshotId}:${item.version}`}
              >
                v{item.version} · {new Date(item.createdAt).toLocaleDateString(locale)} ·{' '}
                {item.claimCount} {t('initiatives.analysis.claims', 'claims')}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary self-end"
          disabled={!scenarioId || !contextRef || state === 'GENERATING'}
          onClick={() => void runAnalysis()}
        >
          {t('initiatives.analysis.run', 'Run portfolio analysis')}
        </button>
      </div>
      {!scenarios.length || !contexts.length ? (
        <p className="p-4 text-sm text-c-text-muted" role="status">
          {t(
            'initiatives.analysis.inputsUnavailable',
            'Publish a portfolio scenario and an organization context snapshot before running analysis.'
          )}
        </p>
      ) : null}
      {message ? (
        <p
          className="px-4 py-2 text-sm text-c-text-secondary"
          role={state === 'ERROR' ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
      <div
        className="flex min-h-0 flex-1"
        data-testid="initiatives-analysis-table"
        data-selected-count={selectedIds.size}
      >
        <div className="min-w-0 flex-1">
          <TableWithPreviewLayout<AnalysisRow>
            key={scopeKey}
            selectedId={selectedId}
            selectedItem={selected}
            onSelect={setSelectedId}
            previewOpen={selectedIds.size > 1 ? false : undefined}
            itemIds={rows.map((row) => row.id)}
            getItemById={(id) => rows.find((row) => row.id === id) ?? null}
            renderPreview={(row) => (
              <div data-testid="initiatives-analysis-preview">
                <StandardPreview
                  embedded
                  title={`${row.kindLabel} · ${row.criterionLabel}`}
                  meta={{
                    pills:
                      row.item.confidence === 'UNKNOWN'
                        ? []
                        : [{ label: row.confidenceLabel, tone: 'neutral' }],
                    trailing: (
                      <span>
                        {analysis ? new Date(analysis.snapshot.asOf).toLocaleString(locale) : ''}
                      </span>
                    ),
                  }}
                  details={{
                    text: row.item.rationale,
                    properties: [
                      {
                        id: 'evidence',
                        label: t('initiatives.analysis.evidence', 'Evidence'),
                        value:
                          row.item.evidence
                            .map((entry) => `${entry.field} · ${entry.sourceRef}`)
                            .join('\n') || '—',
                      },
                      {
                        id: 'alternatives',
                        label: t('initiatives.analysis.alternatives', 'Alternatives'),
                        value: row.item.alternatives.join('\n') || '—',
                      },
                      {
                        id: 'missingData',
                        label: t('initiatives.analysis.missingData', 'Missing data'),
                        value: row.item.missingData.join('\n') || '—',
                      },
                      {
                        id: 'initiatives',
                        label: t('initiatives.analysis.initiatives', 'Initiatives'),
                        value: row.item.initiativeIds.map(initiativeLabel).join(', ') || '—',
                      },
                      // A2: „dlaczego" dla parkingu i archiwum. Propozycja byla
                      // utrwalana, ale niewidoczna — decydent nie mial jej skad
                      // przeczytac przed podjeciem decyzji.
                      ...(row.item.proposedDisposition
                        ? [
                            {
                              id: 'proposedDisposition',
                              label: t(
                                'initiatives.analysis.proposedDisposition',
                                'Proposed disposition'
                              ),
                              value: `${t(
                                `initiatives.analysis.${row.item.proposedDisposition.kind.toLowerCase()}`,
                                row.item.proposedDisposition.kind
                              )} — ${row.item.proposedDisposition.reason}`,
                            },
                            {
                              id: 'proposedReturnCondition',
                              label: t(
                                'initiatives.analysis.proposedReturnCondition',
                                'Return condition proposed'
                              ),
                              value: row.item.proposedDisposition.returnCondition ?? '—',
                            },
                          ]
                        : []),
                      {
                        id: 'provenance',
                        label: t('initiatives.analysis.provenance', 'Model provenance'),
                        value: analysis
                          ? `${analysis.model.provider} · ${analysis.model.modelId} · ${analysis.model.promptVersion}`
                          : '—',
                      },
                    ],
                  }}
                  relations={row.item.initiativeIds.map((initiativeId) => ({
                    id: initiativeId,
                    label: initiativeLabel(initiativeId),
                    type: 'initiative',
                  }))}
                >
                  {row.kind === 'DECISION' ? decisionForm([row]) : null}
                </StandardPreview>
              </div>
            )}
          >
            <StandardTable
              columns={columns.map((column) => ({
                ...column,
                label: t(`initiatives.analysis.columns.${column.id}`, column.label),
              }))}
              data={rows}
              loading={state === 'LOADING' || state === 'GENERATING'}
              error={state === 'ERROR' && !analysis ? message : null}
              selectedRowId={selectedId}
              onRowClick={(row) => setSelectedId(row.id)}
              persistKey="initiatives.analysis.items"
              selection={{
                selectedIds,
                onChange: (ids) =>
                  setSelectedIds(new Set([...ids].filter((id) => decisionIds.has(id)))),
              }}
              empty={{
                title: t('initiatives.analysis.empty', 'No persisted analysis items'),
                description: t(
                  'initiatives.analysis.emptyDescription',
                  'Run a governed analysis to create a review queue.'
                ),
              }}
            />
          </TableWithPreviewLayout>
        </div>
        {selectedIds.size > 1 ? (
          <aside
            className="w-[min(34%,420px)] shrink-0 border-l border-c-border bg-c-surface p-3"
            data-testid="initiatives-analysis-batch-preview"
          >
            <h3 className="mb-2 text-sm font-semibold text-c-text-primary">
              {t('initiatives.analysis.selectedDecisions', 'Selected decisions')}
            </h3>
            <StandardPreview
              embedded
              title={t('initiatives.analysis.selectedDecisions', 'Selected decisions')}
              details={{ text: `${selectedIds.size}` }}
            >
              {decisionForm(
                rows.filter((row) => selectedIds.has(row.id) && row.kind === 'DECISION')
              )}
            </StandardPreview>
          </aside>
        ) : null}
      </div>
      {analysis && disposition === 'IN' && decisionSaved ? (
        <div className="flex gap-2 border-t border-c-border p-3">
          {onNavigatePlan ? (
            <button type="button" className="btn-secondary" onClick={onNavigatePlan}>
              {t('initiatives.analysis.openPlan', 'Open Plan')}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={onNavigateCapacity}>
            {t('initiatives.analysis.openCapacity', 'Open Capacity')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
