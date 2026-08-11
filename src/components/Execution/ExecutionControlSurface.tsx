import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  createMaterialChange,
  draftIntervention,
  ingestManagementSignal,
  listCapacityOptions,
  listInterventions,
  listManagementSignals,
  transitionIntervention,
} from '@/services/initiatives-execution/runtimeApi';

import { countExecutionPresets, type ExecutionMenu3Contract } from './canonicalMenu3';
interface SignalRow extends TableRow {
  id: string;
  title: string;
  rule: string;
  source: string;
  severity: string;
  occurrences: number;
  updatedAt: string;
  version: number;
  signal: any;
}
interface Row extends TableRow {
  id: string;
  title: string;
  status: string;
  owner: string;
  authority: string;
  slaAt: string;
  rawSlaAt: string | null;
  version: number;
  source: any;
}
const columns: TableColumn[] = [
  { id: 'title', label: 'Interwencja', sortable: true, width: '240px' },
  { id: 'status', label: 'Status', sortable: true, filterable: true },
  { id: 'owner', label: 'Właściciel', sortable: true },
  { id: 'authority', label: 'Osoba zatwierdzająca', sortable: true },
  { id: 'slaAt', label: 'Termin weryfikacji', sortable: true },
];
const signalColumns: TableColumn[] = [
  { id: 'title', label: 'Sygnał', sortable: true, width: '240px' },
  { id: 'rule', label: 'Rodzaj', sortable: true, filterable: true },
  { id: 'source', label: 'Źródło', sortable: true },
  { id: 'severity', label: 'Ważność', sortable: true, filterable: true },
  { id: 'occurrences', label: 'Wystąpienia', sortable: true },
  { id: 'updatedAt', label: 'Aktualizacja', sortable: true },
];
const lines = (value: string) =>
  value
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const versionedRefs = (value: string) =>
  lines(value).map((entry) => {
    const [ref, version] = entry.split('@');
    return { ref, version: Number(version) };
  });
const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'UNKNOWN';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};
const controlPresets = [
  'needs-action',
  'critical',
  'decisions',
  'schedule',
  'resources',
  'cost',
  'risk',
  'dependencies',
  'adoption',
  'outcome-risk',
  'verification-overdue',
  'resolved',
] as const;
export const ExecutionControlSurface = ({
  activePreset,
  onCountsChange,
}: ExecutionMenu3Contract) => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING'),
    [rows, setRows] = useState<Row[]>([]),
    [signalRows, setSignalRows] = useState<SignalRow[]>([]),
    [selectedSignalId, setSelectedSignalId] = useState<string | null>(null),
    [draftSignalIds, setDraftSignalIds] = useState<string[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [draftJson, setDraftJson] = useState(''),
    [advancedJson, setAdvancedJson] = useState(false),
    [showSignalForm, setShowSignalForm] = useState(false),
    [showInterventionForm, setShowInterventionForm] = useState(false),
    [signalForm, setSignalForm] = useState({
      kind: 'STALE_MILESTONE',
      sourceId: '',
      sourceVersionKey: 'milestoneVersion',
      sourceVersion: '1',
      snapshotRef: '',
      ruleId: 'STALE_MILESTONE',
      severity: 'WARNING',
      occurredAt: '',
    }),
    [guided, setGuided] = useState({
      interventionId: '',
      ownerId: '',
      authorityId: '',
      slaAt: '',
      hypotheses: '',
      evidenceRefs: '',
      counterEvidenceRefs: '',
      unknowns: '',
      blastRadiusRefs: '',
      doNothingLabel: 'Do nothing',
      doNothingImpacts: '',
      actionOptionId: 'action-1',
      actionLabel: '',
      actionImpacts: '',
      actionConfidence: 'UNKNOWN',
      actionReversibility: 'UNKNOWN',
    }),
    [rationale, setRationale] = useState(''),
    [selectedOption, setSelectedOption] = useState(''),
    [capacityOptions, setCapacityOptions] = useState<any[]>([]),
    [governed, setGoverned] = useState({
      proposalId: '',
      comparisonId: '',
      planScenarioId: '',
      oldSnapshot: '{}',
      newSnapshot: '{}',
      affected: '{"initiatives":[],"executionCases":[],"tasks":[]}',
      ownerId: '',
      authorityId: '',
      policyRef: '',
      policyVersion: '1',
      blastRadius:
        '{"tasks":{"knowledgeState":"KNOWN","refs":[]},"decisions":{"knowledgeState":"KNOWN","refs":[]},"milestones":{"knowledgeState":"KNOWN","refs":[]},"risks":{"knowledgeState":"KNOWN","refs":[]},"capacity":{"knowledgeState":"KNOWN","refs":[]},"approvals":{"knowledgeState":"KNOWN","refs":[]},"handoff":{"knowledgeState":"KNOWN","refs":[]}}',
    }),
    [apply, setApply] = useState({
      receiptId: '',
      aggregateType: 'execution_task',
      aggregateId: '',
      version: '1',
      state: '',
      verifyBy: '',
      expectedEffect: '',
      measurementRef: '',
      measurementVersion: '1',
    }),
    [verifyOutcome, setVerifyOutcome] = useState('EFFECTIVE'),
    [verificationEvidence, setVerificationEvidence] = useState(''),
    [receipt, setReceipt] = useState<any | null>(null),
    [write, setWrite] = useState<'IDLE' | 'FAILED'>('IDLE');
  const ids = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    setState('LOADING');
    try {
      const [b, s, capacity] = (await Promise.all([
        listInterventions(),
        listManagementSignals(),
        listCapacityOptions(),
      ])) as Array<{
        items?: any[];
      }>;
      setCapacityOptions(
        (capacity.items ?? []).filter((comparison) =>
          comparison.options?.some(
            (option: any) =>
              option.optionId === comparison.selectedOptionId && option.kind === 'RESEQUENCE'
          )
        )
      );
      setRows(
        (b.items ?? []).map((x) => ({
          id: x.interventionId,
          title: x.interventionId,
          status: x.status,
          owner: x.ownerId,
          authority: x.authorityId,
          slaAt: formatDateTime(x.verifyBy ?? x.slaAt),
          rawSlaAt: x.verifyBy ?? x.slaAt ?? null,
          version: x.version,
          source: x,
        }))
      );
      setSignalRows(
        (s.items ?? []).map((x) => ({
          id: x.signalId,
          title: x.signalId,
          rule: x.ruleId,
          source: `${x.sourceType}:${x.sourceId}`,
          severity: x.severity,
          occurrences: x.occurrences?.length ?? 0,
          updatedAt: x.updatedAt,
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
    } catch {
      setState('ERROR');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);
  const selectedSignal = useMemo(
    () => signalRows.find((row) => row.id === selectedSignalId) ?? null,
    [selectedSignalId, signalRows]
  );
  const controlItems = useMemo(
    () => [
      ...signalRows.map((row) => ({ kind: 'SIGNAL' as const, row })),
      ...rows.map((row) => ({ kind: 'INTERVENTION' as const, row })),
    ],
    [rows, signalRows]
  );
  const matches = useCallback((item: (typeof controlItems)[number], preset: string) => {
    const raw = JSON.stringify(item.row).toUpperCase();
    const status = String((item.row as any).status ?? '').toUpperCase();
    if (preset === 'needs-action') return !['RESOLVED', 'CLOSED', 'EFFECTIVE'].includes(status);
    if (preset === 'critical')
      return String((item.row as any).severity ?? '').toUpperCase() === 'CRITICAL';
    if (preset === 'decisions') return /DECISION|APPROV/.test(raw);
    if (preset === 'schedule') return /SCHEDULE|MILESTONE|RESEQUENCE/.test(raw);
    if (preset === 'resources') return /RESOURCE|CAPACITY|ALLOCATION/.test(raw);
    if (preset === 'cost') return /COST|BUDGET|FINANCE/.test(raw);
    if (preset === 'risk') return /RISK/.test(raw);
    if (preset === 'dependencies') return /DEPENDENC/.test(raw);
    if (preset === 'adoption') return /ADOPTION|CHANGE/.test(raw);
    if (preset === 'outcome-risk') return /OUTCOME/.test(raw) && /RISK/.test(raw);
    if (preset === 'verification-overdue')
      return (
        Boolean((item.row as any).rawSlaAt) &&
        Date.parse((item.row as any).rawSlaAt) < Date.now() &&
        !['RESOLVED', 'CLOSED', 'EFFECTIVE'].includes(status)
      );
    if (preset === 'resolved') return ['RESOLVED', 'CLOSED', 'EFFECTIVE'].includes(status);
    return false;
  }, []);
  const visibleSignals = signalRows.filter((row) =>
    matches({ kind: 'SIGNAL', row }, activePreset ?? 'needs-action')
  );
  const visibleInterventions = rows.filter((row) =>
    matches({ kind: 'INTERVENTION', row }, activePreset ?? 'needs-action')
  );
  useEffect(
    () => onCountsChange?.(countExecutionPresets(controlItems, controlPresets, matches)),
    [controlItems, matches, onCountsChange]
  );
  const cid = (key: string) => {
    const value = ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, value);
    return value;
  };
  const ingestSignal = async () => {
    const sourceType =
      signalForm.kind === 'STALE_MILESTONE' ? 'execution_milestone' : 'capacity_scenario';
    const existing = signalRows.find(
      (row) =>
        row.signal.ruleId === signalForm.ruleId &&
        row.signal.sourceType === sourceType &&
        row.signal.sourceId === signalForm.sourceId
    );
    await ingestManagementSignal({
      expectedVersion: existing?.version ?? 0,
      clientRequestId: cid(
        `signal:${signalForm.ruleId}:${signalForm.sourceId}:${existing?.version ?? 0}`
      ),
      ruleId: signalForm.ruleId,
      sourceType,
      sourceId: signalForm.sourceId,
      sourceVersions: { [signalForm.sourceVersionKey]: Number(signalForm.sourceVersion) },
      severity: signalForm.severity,
      occurredAt: new Date(signalForm.occurredAt).toISOString(),
      evidenceRef: signalForm.snapshotRef,
    });
    await load();
  };
  const impactRefs = (value: string) =>
    lines(value).map((entry) => {
      const [targetRef, effect = 'UNKNOWN'] = entry.split('|');
      return { targetRef, effect };
    });
  const draft = async () => {
    const chosen = signalRows.filter((row) => draftSignalIds.includes(row.id));
    const p = advancedJson
      ? JSON.parse(draftJson)
      : {
          interventionId: guided.interventionId,
          signalRefs: chosen.map((row) => ({
            signalId: row.id,
            signalVersion: row.version,
            fingerprint: row.signal.fingerprint,
          })),
          ownerId: guided.ownerId,
          authorityId: guided.authorityId,
          slaAt: new Date(guided.slaAt).toISOString(),
          hypotheses: lines(guided.hypotheses),
          evidenceRefs: lines(guided.evidenceRefs),
          counterEvidenceRefs: lines(guided.counterEvidenceRefs),
          unknowns: lines(guided.unknowns),
          blastRadiusRefs: versionedRefs(guided.blastRadiusRefs),
          options: [
            {
              optionId: 'do-nothing',
              kind: 'DO_NOTHING',
              label: guided.doNothingLabel,
              impacts: impactRefs(guided.doNothingImpacts),
              confidence: 'UNKNOWN',
              reversibility: 'REVERSIBLE',
            },
            ...(guided.actionLabel
              ? [
                  {
                    optionId: guided.actionOptionId,
                    kind: 'ACTION',
                    label: guided.actionLabel,
                    impacts: impactRefs(guided.actionImpacts),
                    confidence: guided.actionConfidence,
                    reversibility: guided.actionReversibility,
                  },
                ]
              : []),
          ],
        };
    if (!p.options?.some((o: any) => o.kind === 'DO_NOTHING'))
      throw new Error('DO_NOTHING required');
    const prior = rows.find((row) => row.id === p.interventionId);
    await draftIntervention(p.interventionId, {
      ...p,
      expectedVersion: prior?.version ?? 0,
      clientRequestId: cid(`draft:${p.interventionId}`),
    });
    await load();
  };
  const transition = async (action: string) => {
    if (!selected) return;
    try {
      let command: any = {
        expectedVersion: selected.version,
        clientRequestId: cid(`${selected.id}:${selected.version}:${action}`),
        action,
      };
      if (action === 'DECIDE')
        command = { ...command, outcome: 'APPROVED', selectedOptionId: selectedOption, rationale };
      if (action === 'APPLY')
        command = {
          ...command,
          targetReceiptClientRequestId: apply.receiptId,
          targetAggregateType: apply.aggregateType,
          targetAggregateId: apply.aggregateId,
          expectedTargetVersion: Number(apply.version),
          expectedTargetState: apply.state,
          verifyBy: new Date(apply.verifyBy).toISOString(),
          expectedEffect: apply.expectedEffect,
          measurementSource: {
            ref: apply.measurementRef,
            version: Number(apply.measurementVersion),
          },
          ...(apply.aggregateType === 'material_change'
            ? { planChange: JSON.parse(governed.affected) }
            : {}),
        };
      if (action === 'VERIFY')
        command = {
          ...command,
          outcome: verifyOutcome,
          evidenceRefs: verificationEvidence.split('\n').filter(Boolean),
        };
      const result = (await transitionIntervention(selected.id, command)) as any;
      setReceipt(result.response);
      setWrite('IDLE');
      await load();
    } catch {
      setWrite('FAILED');
    }
  };
  const createGovernedPlanChange = async () => {
    try {
      const comparison = capacityOptions.find(
        (item) => item.comparisonId === governed.comparisonId
      );
      const option = comparison?.options?.find(
        (item: any) => item.optionId === comparison.selectedOptionId && item.kind === 'RESEQUENCE'
      );
      if (!comparison || !option || comparison.planRef?.scenarioId !== governed.planScenarioId)
        throw new Error('Exact selected RESEQUENCE option required');
      const oldSnapshot = JSON.parse(governed.oldSnapshot),
        newSnapshot = JSON.parse(governed.newSnapshot);
      if (JSON.stringify(oldSnapshot) === JSON.stringify(newSnapshot))
        throw new Error('Exact Plan diff required');
      const result = (await createMaterialChange(governed.proposalId, {
        expectedVersion: 0,
        clientRequestId: cid(`plan-change:${governed.proposalId}`),
        target: {
          kind: 'PLANNING_BASELINE',
          aggregateType: 'plan_scenario',
          aggregateId: governed.planScenarioId,
          version: comparison.planRef.version,
        },
        oldSnapshot,
        newSnapshot,
        diff: [
          {
            path: 'windows',
            oldValue: oldSnapshot.windows,
            newValue: newSnapshot.windows,
          },
        ],
        classification: 'MATERIAL',
        tolerance: {
          policyRef: governed.policyRef,
          policyVersion: Number(governed.policyVersion),
          withinTolerance: false,
          rationale: 'Governed RESEQUENCE changes Plan order',
        },
        blastRadius: JSON.parse(governed.blastRadius),
        reversibility: 'REVERSIBLE',
        ownerId: governed.ownerId,
        authorityId: governed.authorityId,
        governedInputRef: {
          kind: 'CAPACITY_OPTION',
          comparisonId: comparison.comparisonId,
          comparisonVersion: comparison.version,
          optionId: option.optionId,
        },
      })) as any;
      setReceipt({
        status: 'MATERIAL_CHANGE_DRAFTED',
        oldHash: result.response?.oldHash,
        newHash: result.response?.newHash,
        governedInputRef: result.response?.governedInputRef,
        targetCommand: {
          aggregateType: 'material_change',
          aggregateId: governed.proposalId,
          clientRequestId: cid(`plan-change:${governed.proposalId}`),
          aggregateVersion: result.aggregateVersion ?? 1,
        },
      });
      setWrite('IDLE');
    } catch {
      setWrite('FAILED');
    }
  };
  if (state === 'ERROR')
    return (
      <div role="alert" className="m-4 rounded-xl border border-c-danger/40 p-4 text-sm">
        <p>Nie udało się załadować rejestru sterowania.</p>
        <button type="button" className="btn-secondary mt-3" onClick={() => void load()}>
          Spróbuj ponownie
        </button>
      </div>
    );
  return (
    <section aria-label="Execution Control" className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Sterowanie</h2>
          <p className="text-sm text-c-text-muted">
            Sygnały wymagające reakcji, decyzje zarządcze i kontrola skuteczności interwencji.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              setShowInterventionForm(true);
              setShowSignalForm(true);
            }}
          >
            Dodaj sygnał
          </button>
          <button
            className="btn-secondary"
            disabled={draftSignalIds.length === 0}
            onClick={() => setShowInterventionForm(true)}
          >
            Przygotuj interwencję
          </button>
        </div>
      </div>
      {state === 'LOADING' && <p role="status">Loading interventions</p>}
      {showInterventionForm && (
        <section aria-label="Intervention Signal Workbench" className="mt-4">
          <h3 className="font-semibold">Sygnały zarządcze</h3>
          {showSignalForm && (
            <div className="mt-3 rounded-lg border border-c-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <strong>Nowy sygnał</strong>
                <button className="btn-secondary" onClick={() => setShowSignalForm(false)}>
                  Zamknij
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs">
                  Signal kind
                  <select
                    aria-label="Management signal kind"
                    value={signalForm.kind}
                    onChange={(event) => {
                      const kind = event.target.value;
                      setSignalForm((current) => ({
                        ...current,
                        kind,
                        ruleId: kind,
                        sourceVersionKey:
                          kind === 'STALE_MILESTONE'
                            ? 'milestoneVersion'
                            : 'capacityScenarioVersion',
                      }));
                    }}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  >
                    <option value="STALE_MILESTONE">Stale Milestone</option>
                    <option value="CAPACITY_CONFLICT">Capacity conflict</option>
                  </select>
                </label>
                {Object.keys(signalForm)
                  .filter((key) => key !== 'kind')
                  .map((key) => (
                    <label key={key} className="text-xs">
                      {key}
                      {key === 'severity' ? (
                        <select
                          aria-label={`Management signal ${key}`}
                          value={signalForm.severity}
                          onChange={(event) =>
                            setSignalForm((current) => ({
                              ...current,
                              severity: event.target.value,
                            }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        >
                          <option>WARNING</option>
                          <option>CRITICAL</option>
                        </select>
                      ) : (
                        <input
                          aria-label={`Management signal ${key}`}
                          type={
                            key === 'occurredAt'
                              ? 'datetime-local'
                              : key === 'sourceVersion'
                                ? 'number'
                                : 'text'
                          }
                          value={signalForm[key as keyof typeof signalForm]}
                          onChange={(event) =>
                            setSignalForm((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className="block w-full rounded border border-c-border bg-c-surface p-2"
                        />
                      )}
                    </label>
                  ))}
              </div>
              <button
                type="button"
                className="btn-secondary mt-3"
                onClick={() => void ingestSignal()}
              >
                Zapisz sygnał
              </button>
            </div>
          )}
          <TableWithPreviewLayout<SignalRow>
            selectedId={selectedSignalId}
            selectedItem={selectedSignal}
            onSelect={setSelectedSignalId}
            onOpenFull={(id) => {
              setSelectedSignalId(id);
              setShowInterventionForm(true);
              setDraftSignalIds((current) => (current.includes(id) ? current : [...current, id]));
            }}
            itemIds={signalRows.map((row) => row.id)}
            getItemById={(id) => signalRows.find((row) => row.id === id) ?? null}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.title}
                onClose={() => setSelectedSignalId(null)}
                onOpenFull={() => {
                  setShowInterventionForm(true);
                  setDraftSignalIds((current) =>
                    current.includes(row.id) ? current : [...current, row.id]
                  );
                }}
                openLabel="Otwórz przygotowanie"
                meta={{
                  pills: [
                    {
                      label: row.severity,
                      tone: row.severity === 'CRITICAL' ? 'danger' : 'warning',
                    },
                  ],
                  recommendation: `Project ${row.signal.projectId ?? 'UNKNOWN'} · Reguła ${row.rule}`,
                }}
                details={{
                  label: 'Sygnał zarządczy',
                  text: `${row.signal.sourceType}:${row.signal.sourceId}`,
                  properties: [
                    { id: 'project', label: 'Projekt', value: row.signal.projectId ?? 'UNKNOWN' },
                    { id: 'fingerprint', label: 'Fingerprint', value: row.signal.fingerprint },
                    { id: 'occurrences', label: 'Wystąpienia', value: String(row.occurrences) },
                    { id: 'updated', label: 'Aktualizacja', value: row.updatedAt },
                  ],
                }}
                relations={[
                  { label: `Project ${row.signal.projectId ?? 'UNKNOWN'}` },
                  ...Object.entries(row.signal.sourceVersions ?? {}).map(([key, value]) => ({
                    label: `${key} v${value}`,
                  })),
                  ...(row.signal.occurrences ?? []).map((occurrence: any) => ({
                    label: occurrence.evidenceRef || 'EVIDENCE_MISSING',
                    value: occurrence.occurredAt,
                  })),
                ]}
                relationsEmptyLabel="Brak wersjonowanych źródeł"
                actions={{
                  informational: [
                    {
                      id: 'add-to-intervention',
                      variant: 'neutral',
                      label: 'Dodaj do przygotowywanej interwencji',
                      onClick: () => {
                        setShowInterventionForm(true);
                        setDraftSignalIds((current) =>
                          current.includes(row.id) ? current : [...current, row.id]
                        );
                      },
                    },
                  ],
                }}
              />
            )}
          >
            <StandardTable
              columns={signalColumns}
              data={visibleSignals}
              selectedRowId={selectedSignalId}
              onRowClick={(row) => setSelectedSignalId(row.id)}
              onRowDoubleClick={(row) => {
                setSelectedSignalId(row.id);
                setShowInterventionForm(true);
                setDraftSignalIds((current) =>
                  current.includes(row.id) ? current : [...current, row.id]
                );
              }}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'prepare-intervention',
                    label: 'Przygotuj interwencję',
                    onClick: () => {
                      setSelectedSignalId(row.id);
                      setShowInterventionForm(true);
                      setDraftSignalIds((current) =>
                        current.includes(row.id) ? current : [...current, row.id]
                      );
                    },
                  },
                ],
                universalHandlers: { preview: () => setSelectedSignalId(row.id) },
              })}
              persistKey="execution.management-signals.v1"
            />
          </TableWithPreviewLayout>
        </section>
      )}
      <TableWithPreviewLayout<Row>
        selectedId={selectedId}
        selectedItem={selected}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          setSelectedId(id);
          setShowInterventionForm(true);
        }}
        itemIds={rows.map((r) => r.id)}
        getItemById={(id) => rows.find((r) => r.id === id) ?? null}
        renderPreview={(r) => (
          <StandardPreview
            embedded
            title={r.title}
            onClose={() => setSelectedId(null)}
            onOpenFull={() => setShowInterventionForm(true)}
            openLabel="Otwórz interwencję"
            meta={{
              pills: [{ label: r.status, tone: r.status === 'ESCALATED' ? 'danger' : 'neutral' }],
              recommendation: r.source.selectedOptionId
                ? `Wybrana opcja: ${r.source.selectedOptionId}`
                : 'Wymaga wyboru ograniczonej interwencji',
            }}
            details={{
              label: 'Uzasadnienie i skutek',
              text: r.source.hypotheses?.join(', ') || 'UNKNOWN',
              properties: [
                { id: 'owner', label: 'Właściciel', value: r.owner || 'UNASSIGNED' },
                { id: 'authority', label: 'Zatwierdzający', value: r.authority || 'UNKNOWN' },
                { id: 'sla', label: 'Termin weryfikacji', value: r.slaAt || 'UNKNOWN' },
                {
                  id: 'unknowns',
                  label: 'Niewiadome',
                  value: r.source.unknowns?.join(', ') || 'Brak',
                },
              ],
            }}
            relations={[
              ...(r.source.signalRefs ?? []).map((signal: any) => ({
                label: `${signal.signalId} v${signal.signalVersion}`,
              })),
              ...(r.source.options ?? []).map((option: any) => ({
                label: `${option.kind}: ${option.label}`,
                value: `${option.confidence ?? 'UNKNOWN'} · ${option.reversibility ?? 'UNKNOWN'}`,
              })),
            ]}
            relationsEmptyLabel="Brak powiązanych sygnałów"
          />
        )}
      >
        <StandardTable
          columns={columns}
          data={visibleInterventions}
          selectedRowId={selectedId}
          onRowClick={(r) => setSelectedId(r.id)}
          onRowDoubleClick={(r) => {
            setSelectedId(r.id);
            setShowInterventionForm(true);
          }}
          rowMenu={(r) => ({
            primary: [
              {
                id: 'open-intervention',
                label: 'Otwórz interwencję',
                onClick: () => {
                  setSelectedId(r.id);
                  setShowInterventionForm(true);
                },
              },
            ],
            universalHandlers: { preview: () => setSelectedId(r.id) },
          })}
          persistKey="execution.control.v1"
          empty={{
            title: 'Brak spraw interwencyjnych',
            description:
              'Dodaj wersjonowany sygnał, aby przygotować pierwszą sprawę interwencyjną.',
          }}
        />
      </TableWithPreviewLayout>
      {showInterventionForm && (
        <section
          aria-label="Intervention Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Projekt interwencji</h3>
            <button className="btn-secondary" onClick={() => setShowInterventionForm(false)}>
              Zamknij
            </button>
          </div>
          <p className="text-xs text-c-text-muted">
            Selected exact signals: {draftSignalIds.join(', ') || 'None'}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.keys(guided).map((key) => {
              const long = [
                'hypotheses',
                'evidenceRefs',
                'counterEvidenceRefs',
                'unknowns',
                'blastRadiusRefs',
                'doNothingImpacts',
                'actionImpacts',
              ].includes(key);
              return (
                <label key={key} className="text-xs">
                  {key}
                  {key === 'actionConfidence' || key === 'actionReversibility' ? (
                    <select
                      aria-label={`Intervention draft ${key}`}
                      value={guided[key as keyof typeof guided]}
                      onChange={(event) =>
                        setGuided((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    >
                      {(key === 'actionConfidence'
                        ? ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH']
                        : ['UNKNOWN', 'REVERSIBLE', 'PARTIALLY_REVERSIBLE', 'IRREVERSIBLE']
                      ).map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : long ? (
                    <textarea
                      aria-label={`Intervention draft ${key}`}
                      value={guided[key as keyof typeof guided]}
                      onChange={(event) =>
                        setGuided((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="block min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  ) : (
                    <input
                      aria-label={`Intervention draft ${key}`}
                      type={key === 'slaAt' ? 'datetime-local' : 'text'}
                      value={guided[key as keyof typeof guided]}
                      onChange={(event) =>
                        setGuided((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  )}
                </label>
              );
            })}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm">Advanced JSON</summary>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={advancedJson}
                onChange={(event) => setAdvancedJson(event.target.checked)}
              />
              Use advanced JSON instead of guided fields
            </label>
            <textarea
              aria-label="Intervention draft JSON"
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              disabled={!advancedJson}
              className="mt-2 min-h-32 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
            />
          </details>
          <button className="btn-secondary" onClick={() => void draft()}>
            Draft or merge Intervention Case
          </button>
          <div className="mt-3 flex gap-2">
            <button className="btn-secondary" onClick={() => void transition('REQUEST')}>
              Request independent Decision
            </button>
            <input
              aria-label="Intervention selected option"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            />
            <textarea
              aria-label="Intervention rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => void transition('DECIDE')}>
              Approve option
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Object.keys(apply).map((k) => (
              <label key={k} className="text-xs">
                {k}
                <input
                  aria-label={`Intervention ${k}`}
                  type={k === 'verifyBy' ? 'datetime-local' : 'text'}
                  value={(apply as any)[k]}
                  onChange={(e) => setApply((v) => ({ ...v, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <section
            aria-label="Governed Plan resequence"
            className="mt-4 rounded border border-c-border p-3"
          >
            <h4 className="font-medium">Governed Plan resequence</h4>
            <p className="text-xs text-c-text-muted">
              A selected Capacity Option RESEQUENCE creates one PLANNING_BASELINE Material Change.
              Review and publish happen in My Work; APPLY consumes its exact receipt.
            </p>
            <label className="block text-xs">
              Selected Capacity comparison
              <select
                aria-label="Governed comparison"
                value={governed.comparisonId}
                onChange={(e) =>
                  setGoverned((v) => ({
                    ...v,
                    comparisonId: e.target.value,
                    planScenarioId:
                      capacityOptions.find((x) => x.comparisonId === e.target.value)?.planRef
                        ?.scenarioId ?? '',
                  }))
                }
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              >
                <option value="">Select exact RESEQUENCE</option>
                {capacityOptions.map((x) => (
                  <option key={x.comparisonId} value={x.comparisonId}>
                    {x.comparisonId} v{x.version} · {x.selectedOptionId} · Plan{' '}
                    {x.planRef.scenarioId} v{x.planRef.version}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(governed)
                .filter(([key]) => key !== 'comparisonId')
                .map(([key, value]) => (
                  <label key={key} className="text-xs">
                    {key}
                    {['oldSnapshot', 'newSnapshot', 'affected', 'blastRadius'].includes(key) ? (
                      <textarea
                        aria-label={`Governed ${key}`}
                        className="block min-h-24 w-full rounded border border-c-border bg-c-surface p-2 font-mono"
                        value={value}
                        onChange={(e) => setGoverned((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        aria-label={`Governed ${key}`}
                        className="block w-full rounded border border-c-border bg-c-surface p-2"
                        value={value}
                        readOnly={key === 'planScenarioId'}
                        onChange={(e) => setGoverned((v) => ({ ...v, [key]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
            </div>
            <button className="btn-secondary mt-2" onClick={() => void createGovernedPlanChange()}>
              Create governed Plan Material Change
            </button>
          </section>
          <button className="btn-primary" onClick={() => void transition('APPLY')}>
            Apply canonical receipt
          </button>
          <div>
            <select
              aria-label="Intervention verification outcome"
              value={verifyOutcome}
              onChange={(e) => setVerifyOutcome(e.target.value)}
            >
              {['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_VERIFIED'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <textarea
              aria-label="Intervention verification evidence"
              value={verificationEvidence}
              onChange={(e) => setVerificationEvidence(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => void transition('VERIFY')}>
              Verify intervention
            </button>
          </div>
          {write === 'FAILED' && <p role="alert">No transition was applied.</p>}
          {receipt && (
            <div role="status" className="rounded border border-c-success/40 p-3">
              <strong>{receipt.status}</strong>
              {receipt.targetCommand && (
                <p>
                  Canonical target receipt {receipt.targetCommand.clientRequestId} ·{' '}
                  {receipt.targetCommand.aggregateType}/{receipt.targetCommand.aggregateId} v
                  {receipt.targetCommand.aggregateVersion}
                </p>
              )}
              {receipt.oldHash && (
                <p>
                  Plan before hash {receipt.oldHash} → proposed hash {receipt.newHash}
                </p>
              )}
              {receipt.verification && (
                <p>
                  {receipt.verification.outcome === 'EFFECTIVE'
                    ? 'EFFECTIVE · CLOSED'
                    : `${receipt.verification.outcome} · ESCALATED`}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
};
