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
import {
  executionLocalReviewEnabled,
  executionReviewInterventions,
  executionReviewSignals,
} from './executionLocalReviewData';

const interventionFieldLabels: Record<string, string> = {
  interventionId: 'Identyfikator interwencji',
  ownerId: 'Właściciel',
  authorityId: 'Niezależny zatwierdzający',
  slaAt: 'Termin decyzji',
  hypotheses: 'Hipotezy',
  evidenceRefs: 'Dowody',
  counterEvidenceRefs: 'Kontrdowody',
  unknowns: 'Niewiadome',
  blastRadiusRefs: 'Wpływ na powiązane obiekty',
  doNothingLabel: 'Opcja bez działania',
  doNothingImpacts: 'Skutki braku działania',
  actionOptionId: 'Identyfikator wariantu',
  actionLabel: 'Nazwa działania',
  actionImpacts: 'Skutki działania',
  actionConfidence: 'Pewność',
  actionReversibility: 'Odwracalność',
};

const applyFieldLabels: Record<string, string> = {
  receiptId: 'Potwierdzenie komendy',
  aggregateType: 'Typ obiektu',
  aggregateId: 'Obiekt docelowy',
  version: 'Wersja',
  state: 'Oczekiwany stan',
  verifyBy: 'Termin weryfikacji',
  expectedEffect: 'Oczekiwany efekt',
  measurementRef: 'Źródło pomiaru',
  measurementVersion: 'Wersja pomiaru',
};
interface SignalRow extends TableRow {
  id: string;
  title: string;
  rule: string;
  source: string;
  severity: string;
  rawSeverity: string;
  occurrences: number;
  updatedAt: string;
  version: number;
  signal: any;
}
interface Row extends TableRow {
  id: string;
  title: string;
  status: string;
  rawStatus: string;
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
const actorBusinessLabel = (value: string | null | undefined, fallback: string) =>
  value
    ? value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : fallback;
const interventionBusinessTitle = (intervention: any) =>
  intervention.title ||
  intervention.options?.find((option: any) => option.optionId === intervention.selectedOptionId)
    ?.label ||
  intervention.hypotheses?.[0] ||
  `Interwencja operacyjna · ${intervention.interventionId}`;
const interventionStatusLabel = (value: string) =>
  ({
    DRAFT: 'Szkic',
    PENDING_DECISION: 'Oczekuje na decyzję',
    APPROVED: 'Zatwierdzona',
    APPLIED: 'Zastosowana',
    ESCALATED: 'Eskalowana',
    CLOSED: 'Zamknięta',
  })[value] ?? value;
const signalRuleLabel = (value: string) =>
  ({ STALE_MILESTONE: 'Nieaktualny kamień milowy', CAPACITY_CONFLICT: 'Konflikt obciążenia' })[
    value
  ] ?? value;
const severityLabel = (value: string) =>
  ({ WARNING: 'Ostrzeżenie', CRITICAL: 'Krytyczna' })[value] ?? value;
const verificationOutcomeLabel = (value: string) =>
  ({
    EFFECTIVE: 'Skuteczna',
    PARTIAL: 'Częściowo skuteczna',
    INEFFECTIVE: 'Nieskuteczna',
    NOT_VERIFIED: 'Niezweryfikowana',
  })[value] ?? value;
const signalFieldLabels: Record<string, string> = {
  sourceId: 'Źródło sygnału',
  sourceVersionKey: 'Rodzaj wersji źródła',
  sourceVersion: 'Wersja źródła',
  snapshotRef: 'Dowód / migawka źródła',
  ruleId: 'Reguła wykrycia',
  severity: 'Ważność',
  occurredAt: 'Czas wystąpienia',
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
    [interventionComposerOpen, setInterventionComposerOpen] = useState(false),
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
    [governedPlanOpen, setGovernedPlanOpen] = useState(false),
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
      const interventionItems =
        (b.items ?? []).length > 0
          ? b.items ?? []
          : executionLocalReviewEnabled
            ? executionReviewInterventions
            : [];
      const signalItems =
        (s.items ?? []).length > 0
          ? s.items ?? []
          : executionLocalReviewEnabled
            ? executionReviewSignals
            : [];
      setCapacityOptions(
        (capacity.items ?? []).filter((comparison) =>
          comparison.options?.some(
            (option: any) =>
              option.optionId === comparison.selectedOptionId && option.kind === 'RESEQUENCE'
          )
        )
      );
      setRows(
        interventionItems.map((x) => ({
          id: x.interventionId,
          title: interventionBusinessTitle(x),
          status: interventionStatusLabel(x.status),
          rawStatus: x.status,
          owner: actorBusinessLabel(x.ownerName || x.ownerId, 'Nieprzypisany'),
          authority: actorBusinessLabel(x.authorityName || x.authorityId, 'Nieustalony'),
          slaAt: formatDateTime(x.verifyBy ?? x.slaAt),
          rawSlaAt: x.verifyBy ?? x.slaAt ?? null,
          version: x.version,
          source: x,
        }))
      );
      setSignalRows(
        signalItems.map((x) => ({
          id: x.signalId,
          title: x.signalId,
          rule: signalRuleLabel(x.ruleId),
          source: `${x.sourceType}:${x.sourceId}`,
          severity: severityLabel(x.severity),
          rawSeverity: x.severity,
          occurrences: x.occurrences?.length ?? 0,
          updatedAt: x.updatedAt,
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
    } catch {
      if (!executionLocalReviewEnabled) {
        setState('ERROR');
        return;
      }
      setCapacityOptions([]);
      setRows(
        executionReviewInterventions.map((x) => ({
          id: x.interventionId,
          title: interventionBusinessTitle(x),
          status: interventionStatusLabel(x.status),
          rawStatus: x.status,
          owner: actorBusinessLabel(x.ownerId, 'Nieprzypisany'),
          authority: actorBusinessLabel(x.authorityId, 'Nieustalony'),
          slaAt: formatDateTime(x.verifyBy ?? x.slaAt),
          rawSlaAt: x.verifyBy ?? x.slaAt ?? null,
          version: x.version,
          source: x,
        }))
      );
      setSignalRows(
        executionReviewSignals.map((x) => ({
          id: x.signalId,
          title: x.signalId,
          rule: signalRuleLabel(x.ruleId),
          source: `${x.sourceId} · v${x.sourceVersion}`,
          severity: severityLabel(x.severity),
          rawSeverity: x.severity,
          occurrences: x.occurrences.length,
          updatedAt: formatDateTime(x.updatedAt),
          version: x.version,
          signal: x,
        }))
      );
      setState('READY');
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
    const status = String(
      (item.row as any).rawStatus ?? (item.row as any).status ?? ''
    ).toUpperCase();
    if (preset === 'needs-action') return !['RESOLVED', 'CLOSED', 'EFFECTIVE'].includes(status);
    if (preset === 'critical')
      return (
        String((item.row as any).rawSeverity ?? (item.row as any).severity ?? '').toUpperCase() ===
        'CRITICAL'
      );
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
      setGovernedPlanOpen(false);
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
              setInterventionComposerOpen(false);
              setShowInterventionForm(true);
              setShowSignalForm(true);
            }}
          >
            Dodaj sygnał
          </button>
          <button
            className="btn-secondary"
            disabled={draftSignalIds.length === 0}
            onClick={() => {
              setShowInterventionForm(true);
              setInterventionComposerOpen(true);
            }}
          >
            Przygotuj interwencję
          </button>
        </div>
      </div>
      {state === 'LOADING' && <p role="status">Ładowanie interwencji…</p>}
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
                  Rodzaj sygnału
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
                    <option value="STALE_MILESTONE">Nieaktualny kamień milowy</option>
                    <option value="CAPACITY_CONFLICT">Konflikt obciążenia</option>
                  </select>
                </label>
                {Object.keys(signalForm)
                  .filter((key) => key !== 'kind')
                  .map((key) => (
                    <label key={key} className="text-xs">
                      {signalFieldLabels[key] ?? key}
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
                          <option value="WARNING">Ostrzeżenie</option>
                          <option value="CRITICAL">Krytyczna</option>
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
              setShowInterventionForm(true);
              setInterventionComposerOpen(true);
              setDraftSignalIds((current) => (current.includes(id) ? current : [...current, id]));
              setSelectedSignalId(null);
            }}
            itemIds={signalRows.map((row) => row.id)}
            getItemById={(id) => signalRows.find((row) => row.id === id) ?? null}
            previewOpen={!interventionComposerOpen && Boolean(selectedSignalId)}
            renderPreview={(row) => (
              <StandardPreview
                embedded
                title={row.title}
                onClose={() => setSelectedSignalId(null)}
                onOpenFull={() => {
                  setShowInterventionForm(true);
                  setInterventionComposerOpen(true);
                  setDraftSignalIds((current) =>
                    current.includes(row.id) ? current : [...current, row.id]
                  );
                  setSelectedSignalId(null);
                }}
                openLabel="Otwórz przygotowanie"
                meta={{
                  pills: [
                    {
                      label: row.severity,
                      tone: row.rawSeverity === 'CRITICAL' ? 'danger' : 'warning',
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
                        setSelectedSignalId(null);
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
                setShowInterventionForm(true);
                setInterventionComposerOpen(true);
                setDraftSignalIds((current) =>
                  current.includes(row.id) ? current : [...current, row.id]
                );
                setSelectedSignalId(null);
              }}
              rowMenu={(row) => ({
                primary: [
                  {
                    id: 'prepare-intervention',
                    label: 'Przygotuj interwencję',
                    onClick: () => {
                      setShowInterventionForm(true);
                      setInterventionComposerOpen(true);
                      setDraftSignalIds((current) =>
                        current.includes(row.id) ? current : [...current, row.id]
                      );
                      setSelectedSignalId(null);
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
          setInterventionComposerOpen(true);
        }}
        itemIds={rows.map((r) => r.id)}
        getItemById={(id) => rows.find((r) => r.id === id) ?? null}
        previewOpen={!interventionComposerOpen && Boolean(selectedId)}
        renderPreview={(r) => (
          <StandardPreview
            embedded
            title={r.title}
            onClose={() => setSelectedId(null)}
            onOpenFull={() => {
              setShowInterventionForm(true);
              setInterventionComposerOpen(true);
            }}
            openLabel="Otwórz interwencję"
            meta={{
              pills: [
                { label: r.status, tone: r.rawStatus === 'ESCALATED' ? 'danger' : 'neutral' },
              ],
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
            setInterventionComposerOpen(true);
          }}
          rowMenu={(r) => ({
            primary: [
              {
                id: 'open-intervention',
                label: 'Otwórz interwencję',
                onClick: () => {
                  setSelectedId(r.id);
                  setShowInterventionForm(true);
                  setInterventionComposerOpen(true);
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
      {interventionComposerOpen && (
        <section
          aria-label="Intervention Workbench"
          className="mt-4 rounded border border-c-border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Projekt interwencji</h3>
            <button className="btn-secondary" onClick={() => setInterventionComposerOpen(false)}>
              Zamknij
            </button>
          </div>
          {(!selected || selected.source.status === 'DRAFT') && (
            <>
              <p className="text-xs text-c-text-muted">Wybrane sygnały: {draftSignalIds.length}</p>
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
                      {interventionFieldLabels[key] ?? key}
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
                <summary className="cursor-pointer text-sm">Zaawansowany kontrakt JSON</summary>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={advancedJson}
                    onChange={(event) => setAdvancedJson(event.target.checked)}
                  />
                  Użyj kontraktu JSON zamiast formularza
                </label>
                <textarea
                  aria-label="Intervention draft JSON"
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  disabled={!advancedJson}
                  className="mt-2 min-h-32 w-full rounded border border-c-border bg-c-surface p-2 font-mono text-xs"
                />
              </details>
              <button className="btn-primary mt-3" onClick={() => void draft()}>
                Zapisz lub połącz sprawę interwencyjną
              </button>
            </>
          )}
          {(!selected || ['DRAFT', 'PENDING_DECISION'].includes(selected.source.status)) && (
            <section className="mt-4 rounded border border-c-border p-3">
              <h4 className="font-medium">Niezależna decyzja</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_2fr_auto]">
                <button className="btn-secondary" onClick={() => void transition('REQUEST')}>
                  Poproś o decyzję
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
                  Zatwierdź wariant
                </button>
              </div>
            </section>
          )}
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">Zastosowanie zatwierdzonej komendy</h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.keys(apply).map((k) => (
                <label key={k} className="text-xs">
                  {applyFieldLabels[k] ?? k}
                  <input
                    aria-label={`Intervention ${k}`}
                    type={k === 'verifyBy' ? 'datetime-local' : 'text'}
                    value={(apply as any)[k]}
                    onChange={(e) => setApply((v) => ({ ...v, [k]: e.target.value }))}
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded border border-c-border p-3">
              <div>
                <h4 className="font-medium">Zarządzana zmiana planu</h4>
                <p className="text-xs text-c-text-muted">
                  Zmiana kolejności przechodzi przez kontrolowaną zmianę planu i niezależne
                  zatwierdzenie.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGovernedPlanOpen((open) => !open)}
              >
                {governedPlanOpen ? 'Zamknij zmianę planu' : 'Przygotuj zmianę planu'}
              </button>
            </div>
            {governedPlanOpen && (
              <section
                aria-label="Governed Plan resequence"
                className="mt-3 rounded border border-c-border p-3"
              >
                <h4 className="font-medium">Zarządzana zmiana kolejności</h4>
                <p className="text-xs text-c-text-muted">
                  Wybrana opcja zmiany kolejności tworzy jedną kontrolowaną zmianę bazowego planu.
                  Przegląd i publikacja odbywają się w Mojej pracy, a zastosowanie wymaga dokładnego
                  potwierdzenia komendy.
                </p>
                <label className="block text-xs">
                  Wybrane porównanie obciążenia
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
                    <option value="">Wybierz dokładną opcję zmiany kolejności</option>
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
                <button
                  className="btn-secondary mt-2"
                  onClick={() => void createGovernedPlanChange()}
                >
                  Utwórz zarządzaną zmianę planu
                </button>
              </section>
            )}
            <button className="btn-primary mt-3" onClick={() => void transition('APPLY')}>
              Zastosuj potwierdzoną komendę
            </button>
          </section>
          <section className="mt-4 rounded border border-c-border p-3">
            <h4 className="font-medium">Weryfikacja efektu</h4>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
              <select
                aria-label="Intervention verification outcome"
                value={verifyOutcome}
                onChange={(e) => setVerifyOutcome(e.target.value)}
                className="block w-full rounded border border-c-border bg-c-surface p-2"
              >
                {['EFFECTIVE', 'PARTIAL', 'INEFFECTIVE', 'NOT_VERIFIED'].map((x) => (
                  <option key={x} value={x}>
                    {verificationOutcomeLabel(x)}
                  </option>
                ))}
              </select>
              <textarea
                aria-label="Intervention verification evidence"
                value={verificationEvidence}
                onChange={(e) => setVerificationEvidence(e.target.value)}
                className="min-h-20 w-full rounded border border-c-border bg-c-surface p-2"
              />
              <button className="btn-secondary" onClick={() => void transition('VERIFY')}>
                Zweryfikuj interwencję
              </button>
            </div>
          </section>
          {write === 'FAILED' && <p role="alert">Nie zastosowano zmiany.</p>}
          {receipt && (
            <div role="status" className="rounded border border-c-success/40 p-3">
              <strong>{interventionStatusLabel(receipt.status)}</strong>
              {receipt.targetCommand && (
                <p>
                  Potwierdzenie komendy docelowej {receipt.targetCommand.clientRequestId} ·{' '}
                  {receipt.targetCommand.aggregateType}/{receipt.targetCommand.aggregateId} v
                  {receipt.targetCommand.aggregateVersion}
                </p>
              )}
              {receipt.oldHash && (
                <p>
                  Hash planu przed zmianą {receipt.oldHash} → po zmianie {receipt.newHash}
                </p>
              )}
              {receipt.verification && (
                <p>
                  {receipt.verification.outcome === 'EFFECTIVE'
                    ? 'Skuteczna · zamknięta'
                    : `${verificationOutcomeLabel(receipt.verification.outcome)} · eskalowana`}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
};
