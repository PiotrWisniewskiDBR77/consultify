import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  INITIATIVE_CARD_KEYS,
  INITIATIVE_CARD_REGISTRY,
  type InitiativeCardKey,
  isInitiativeCardKey,
} from '@/contracts/initiatives-execution/cardRegistry';
import { INITIATIVE_LIFECYCLE } from '@/contracts/initiatives-execution/foundation';
import {
  type AnalysisReadinessReadModel,
  createAIAnalysisProposal,
  createDefinitionRemediationWork,
  createMaterialChange,
  decideDefinition,
  type DefinitionReadinessReadModel,
  type InitiativeCapabilitiesReadModel,
  type InitiativeCardVersionReadModel,
  listMyAnalysisDecisions,
  listMyDefinitionDecisions,
  type PendingAnalysisDecisionReadModel,
  type PendingDefinitionDecisionReadModel,
  publishInitiativeCard,
  readAnalysisReadiness,
  readDefinitionReadiness,
  readExecutionCaseByInitiative,
  readInitiativeCapabilities,
  readInitiativeCards,
  readRegisteredInitiative,
  refreshInitiativeSource,
  requestAnalysisDecision,
  requestDefinitionDecision,
  requestScheduleDecision,
  reviewInitiativeCard,
  RuntimeApiError,
  startInitiativeAnalysis,
} from '@/services/initiatives-execution/runtimeApi';

interface Props {
  initiativeId: string;
  onBack: () => void;
  onOpenExecution?: (executionCaseId: string, initiativeId: string) => void;
  initialCardKey?: string | null;
  initialFindingId?: string | null;
  onContextChange?: (context: {
    initiativeId: string;
    cardKey: InitiativeCardKey;
    findingId: string | null;
  }) => void;
}

interface CardRow {
  id: InitiativeCardKey;
  title: string;
  label: string;
  group: string;
  completion: string;
  quality: string;
  freshness: string;
  version: number;
  current: InitiativeCardVersionReadModel | null;
}

const GROUP_LABELS = {
  'definition-value': 'Definition & value',
  'organization-feasibility': 'Organization & feasibility',
  'plan-governance': 'Plan & governance',
  'adoption-evidence-learning': 'Adoption, evidence & learning',
} as const;

const editableFields: Partial<Record<InitiativeCardKey, readonly string[]>> = {
  'summary-scope': ['problem', 'outcome', 'inScope', 'outOfScope'],
  'strategic-fit': ['objectives', 'rationale'],
  'success-criteria': ['successCriteria', 'measurementPlan'],
  'outcomes-benefits': ['outcomes', 'benefits'],
  options: ['doNothing', 'alternatives'],
  'people-team': ['team', 'capacityAssumptions'],
  'roles-raci': ['accountableOwnerId', 'roles'],
  stakeholders: ['ownerId', 'sponsorId', 'beneficiaries'],
};

const listFields = new Set([
  'inScope',
  'outOfScope',
  'successCriteria',
  'outcomes',
  'benefits',
  'alternatives',
  'team',
  'roles',
  'beneficiaries',
]);

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.join('\n');
  return typeof value === 'string' ? value : '';
}

export const CanonicalInitiativeCardWorkspace: React.FC<Props> = ({
  initiativeId,
  onBack,
  onOpenExecution,
  initialCardKey,
  initialFindingId,
  onContextChange,
}) => {
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [initiativeVersion, setInitiativeVersion] = useState(0);
  const [title, setTitle] = useState('Initiative');
  const [lifecycleState, setLifecycleState] = useState('REGISTERED_DRAFT');
  const [definitionDecisionId, setDefinitionDecisionId] = useState<string | null>(null);
  const [analysisDecisionId, setAnalysisDecisionId] = useState<string | null>(null);
  const [scheduleDecisionId, setScheduleDecisionId] = useState<string | null>(null);
  const [handoffPackage, setHandoffPackage] = useState<{ id: string; version: number } | null>(
    null
  );
  const [linkedExecutionCase, setLinkedExecutionCase] = useState<{
    executionCaseId: string;
    state: string;
  } | null>(null);
  const [cards, setCards] = useState<InitiativeCardVersionReadModel[]>([]);
  const [definitionReadiness, setDefinitionReadiness] =
    useState<DefinitionReadinessReadModel | null>(null);
  const [analysisReadiness, setAnalysisReadiness] = useState<AnalysisReadinessReadModel | null>(
    null
  );
  const [capabilities, setCapabilities] = useState<InitiativeCapabilitiesReadModel | null>(null);
  const initialSelection =
    initialCardKey && isInitiativeCardKey(initialCardKey) ? initialCardKey : 'summary-scope';
  const [selectedId, setSelectedId] = useState<InitiativeCardKey>(initialSelection);
  const [activeFindingId, setActiveFindingId] = useState<string | null>(initialFindingId ?? null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftCompletion, setDraftCompletion] = useState<'EMPTY' | 'IN_PROGRESS' | 'COMPLETE'>(
    'EMPTY'
  );
  const [draftQuality, setDraftQuality] = useState<
    'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER'
  >('UNKNOWN');
  const [draftFreshness, setDraftFreshness] = useState<'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE'>(
    'CURRENT'
  );
  const [reviewRationale, setReviewRationale] = useState('');
  const [materialChangeAuthorityId, setMaterialChangeAuthorityId] = useState('');
  const [aiProposal, setAiProposal] = useState({
    reviewerId: '',
    sourceType: '',
    sourceId: '',
    sourceVersion: 1,
    provider: '',
    model: '',
    modelVersion: '',
    promptId: '',
    promptVersion: 1,
    templateId: '',
    templateVersion: 1,
    inputHash: '',
    evidence: '',
    counterEvidence: '',
    confidence: 'UNKNOWN' as 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN',
  });
  const [decisionRationale, setDecisionRationale] = useState('');
  const [definitionAuthorityId, setDefinitionAuthorityId] = useState('');
  const [definitionDueAt, setDefinitionDueAt] = useState('');
  const [workRefs, setWorkRefs] = useState<
    Array<{ findingId: string; taskId: string; decisionId: string }>
  >([]);
  const [financeAssigneeId, setFinanceAssigneeId] = useState('');
  const [technicalAuthorityId, setTechnicalAuthorityId] = useState('');
  const [remediationDueAt, setRemediationDueAt] = useState('');
  const [myDefinitionDecision, setMyDefinitionDecision] =
    useState<PendingDefinitionDecisionReadModel | null>(null);
  const [myAnalysisDecision, setMyAnalysisDecision] =
    useState<PendingAnalysisDecisionReadModel | null>(null);
  const [analysisAuthorityId, setAnalysisAuthorityId] = useState('');
  const [analysisDueAt, setAnalysisDueAt] = useState('');
  const [scheduleAuthorityId, setScheduleAuthorityId] = useState('');
  const [executionManagerId, setExecutionManagerId] = useState('');
  const [scheduleDueAt, setScheduleDueAt] = useState('');
  const [portfolioRef, setPortfolioRef] = useState('');
  const [planRef, setPlanRef] = useState('');
  const [capacityRef, setCapacityRef] = useState('');
  const [commitmentIds, setCommitmentIds] = useState('');
  const [criticalPeriodIds, setCriticalPeriodIds] = useState('');
  const [writeState, setWriteState] = useState<'IDLE' | 'SAVING' | 'CONFLICT' | 'FAILED'>('IDLE');
  const [writeAction, setWriteAction] = useState('Update');
  const commandIds = useRef(new Map<string, string>());
  const definitionRequestIds = useRef(
    new Map<number, { clientRequestId: string; decisionId: string }>()
  );
  const remediationIds = useRef(
    new Map<string, { clientRequestId: string; taskId: string; decisionId: string }>()
  );
  const sourceRefreshIds = useRef(new Map<string, string>());
  const analysisCommandIds = useRef(new Map<string, string>());
  const analysisRequestIds = useRef(
    new Map<number, { clientRequestId: string; decisionId: string }>()
  );
  const scheduleCommandIds = useRef(
    new Map<string, { clientRequestId: string; decisionId: string }>()
  );
  const canvasRef = useRef<HTMLElement>(null);
  const focusCanvasAfterSelection = useRef(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [
        initiative,
        cardResult,
        readiness,
        analysis,
        effectiveCapabilities,
        myDecisions,
        myAnalysis,
      ] = await Promise.all([
        readRegisteredInitiative(initiativeId, signal),
        readInitiativeCards(initiativeId, signal),
        readDefinitionReadiness(initiativeId, signal),
        readAnalysisReadiness(initiativeId, signal),
        readInitiativeCapabilities(initiativeId, signal),
        listMyDefinitionDecisions(signal),
        listMyAnalysisDecisions(signal),
      ]);
      setTitle(initiative.initiative.title);
      setLifecycleState(initiative.initiative.lifecycleState);
      setDefinitionDecisionId(initiative.initiative.definitionDecisionId ?? null);
      setAnalysisDecisionId(
        (initiative.initiative as typeof initiative.initiative & { analysisDecisionId?: string })
          .analysisDecisionId ?? null
      );
      const scheduleState = initiative.initiative as typeof initiative.initiative & {
        scheduleDecisionId?: string;
        handoffPackageId?: string;
        handoffPackageVersion?: number;
      };
      setScheduleDecisionId(scheduleState.scheduleDecisionId ?? null);
      setHandoffPackage(
        scheduleState.handoffPackageId
          ? {
              id: scheduleState.handoffPackageId,
              version: scheduleState.handoffPackageVersion ?? 1,
            }
          : null
      );
      if (initiative.initiative.lifecycleState === 'SCHEDULED') {
        const linked = (await readExecutionCaseByInitiative(initiativeId, signal)) as {
          executionCaseId: string;
          detail: { state: string };
        };
        setLinkedExecutionCase({
          executionCaseId: linked.executionCaseId,
          state: linked.detail.state,
        });
      } else {
        setLinkedExecutionCase(null);
      }
      setWorkRefs(initiative.initiative.workRefs ?? []);
      setInitiativeVersion(cardResult.initiativeVersion);
      setCards(cardResult.cards);
      setDefinitionReadiness(readiness);
      setAnalysisReadiness(analysis);
      setCapabilities(effectiveCapabilities);
      setMyDefinitionDecision(
        myDecisions.find((decision) => decision.initiativeId === initiativeId) ?? null
      );
      setMyAnalysisDecision(
        myAnalysis.find((decision) => decision.initiativeId === initiativeId) ?? null
      );
      setState('READY');
    },
    [initiativeId]
  );

  useEffect(() => {
    const controller = new AbortController();
    setState('LOADING');
    load(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState('ERROR');
    });
    return () => controller.abort();
  }, [load]);

  const rows = useMemo<CardRow[]>(
    () =>
      INITIATIVE_CARD_KEYS.map((cardKey) => {
        const current = cards.find((card) => card.cardKey === cardKey) ?? null;
        const definition = INITIATIVE_CARD_REGISTRY[cardKey];
        return {
          id: cardKey,
          title: definition.label,
          label: definition.label,
          group: definition.group,
          completion: current?.completion ?? 'EMPTY',
          quality: current?.quality ?? 'UNKNOWN',
          freshness: current?.freshness ?? 'UNKNOWN',
          version: current?.cardVersion ?? 0,
          current,
        };
      }),
    [cards]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const selectedFindings = useMemo(
    () => definitionReadiness?.findings.filter((finding) => finding.cardKey === selectedId) ?? [],
    [definitionReadiness, selectedId]
  );
  const selectedAnalysisFindings = useMemo(
    () => analysisReadiness?.findings.filter((finding) => finding.cardKey === selectedId) ?? [],
    [analysisReadiness, selectedId]
  );
  const groupedRows = useMemo(
    () =>
      Object.entries(GROUP_LABELS).map(([group, label]) => ({
        group,
        label,
        rows: rows.filter((row) => row.group === group),
      })),
    [rows]
  );

  const openCard = useCallback(
    (cardKey: InitiativeCardKey, findingId: string | null = null, focusCanvas = true) => {
      setSelectedId(cardKey);
      setActiveFindingId(findingId);
      onContextChange?.({ initiativeId, cardKey, findingId });
      focusCanvasAfterSelection.current = focusCanvas;
      if (focusCanvas) queueMicrotask(() => canvasRef.current?.focus());
    },
    [initiativeId, onContextChange]
  );

  useEffect(() => {
    if (!initialCardKey || !isInitiativeCardKey(initialCardKey)) return;
    setSelectedId(initialCardKey);
    setActiveFindingId(initialFindingId ?? null);
  }, [initialCardKey, initialFindingId]);

  useEffect(() => {
    if (!focusCanvasAfterSelection.current) return;
    focusCanvasAfterSelection.current = false;
    canvasRef.current?.focus();
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const fields = editableFields[selected.id] ?? [];
    setDraft(
      Object.fromEntries(
        fields.map((field) => [field, textValue(selected.current?.content[field])])
      )
    );
    setDraftCompletion(selected.current?.completion ?? 'EMPTY');
    setDraftQuality(selected.current?.quality ?? 'UNKNOWN');
    setDraftFreshness(selected.current?.freshness ?? 'CURRENT');
    setWriteState('IDLE');
    setReviewRationale('');
  }, [selected]);

  const save = async () => {
    if (
      !selected ||
      !editableFields[selected.id] ||
      !capabilities?.canUpdate ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction(selected.version > 0 ? 'Material change request' : 'Card publish');
    setWriteState('SAVING');
    const commandKey = `${selected.id}:${selected.version}:${initiativeVersion}`;
    const clientRequestId = commandIds.current.get(commandKey) ?? crypto.randomUUID();
    commandIds.current.set(commandKey, clientRequestId);
    const content = Object.fromEntries(
      Object.entries(draft).map(([field, value]) => [
        field,
        listFields.has(field)
          ? value
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean)
          : value.trim(),
      ])
    );
    try {
      if (selected.version > 0) {
        if (
          draftFreshness !== 'CURRENT' ||
          draftQuality === 'UNKNOWN' ||
          !materialChangeAuthorityId.trim()
        ) {
          setWriteState('FAILED');
          return;
        }
        const oldSnapshot = selected.current?.content ?? {};
        const paths = new Set([...Object.keys(oldSnapshot), ...Object.keys(content)]);
        const diff = [...paths]
          .filter((path) => JSON.stringify(oldSnapshot[path]) !== JSON.stringify(content[path]))
          .map((path) => ({ path, oldValue: oldSnapshot[path], newValue: content[path] }));
        const proposalId = `material-${initiativeId}-${selected.id}-${selected.version + 1}`;
        const impact = {
          knowledgeState: 'KNOWN' as const,
          refs: [{ ref: `${initiativeId}:${selected.id}`, version: selected.version }],
        };
        await createMaterialChange(proposalId, {
          expectedVersion: 0,
          clientRequestId,
          target: {
            kind: 'INITIATIVE_CARD',
            initiativeId,
            cardKey: selected.id,
            version: selected.version,
            initiativeVersion,
          },
          oldSnapshot,
          newSnapshot: content,
          diff,
          classification: 'MATERIAL',
          tolerance: {
            policyRef: 'initiative-card-materiality',
            policyVersion: 1,
            withinTolerance: false,
            rationale: 'Published truth requires independent approval',
          },
          blastRadius: {
            tasks: impact,
            decisions: impact,
            milestones: impact,
            risks: impact,
            capacity: impact,
            approvals: impact,
            handoff: impact,
          },
          reversibility: 'REVERSIBLE',
          ownerId: capabilities.actorId,
          authorityId: materialChangeAuthorityId.trim(),
        });
        setWriteState('IDLE');
        return;
      }
      await publishInitiativeCard(initiativeId, selected.id, {
        expectedVersion: initiativeVersion,
        expectedCardVersion: selected.version,
        clientRequestId,
        applicability: 'REQUIRED',
        completion: draftCompletion,
        quality: draftQuality,
        freshness: draftFreshness,
        reviewState: 'NOT_REQUESTED',
        content,
        evidenceRefs: selected.current?.evidenceRefs ?? [],
        waiverDecisionId: null,
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };
  const proposeAIAnalysis = async () => {
    if (
      !selected?.current ||
      aiProposal.confidence === 'UNKNOWN' ||
      !aiProposal.reviewerId ||
      !aiProposal.sourceType ||
      !aiProposal.sourceId ||
      !aiProposal.inputHash ||
      !aiProposal.evidence
    )
      return;
    setWriteAction('AI analysis proposal');
    setWriteState('SAVING');
    const proposalId = `ai-analysis-${initiativeId}-${selected.id}-${selected.version}`;
    const versioned = (value: string) =>
      value
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const [ref, v] = x.split('@');
          return { ref, version: Number(v) };
        });
    try {
      await createAIAnalysisProposal(proposalId, {
        expectedVersion: 0,
        clientRequestId: crypto.randomUUID(),
        initiativeId,
        initiativeVersion,
        cardKey: selected.id,
        cardVersion: selected.version,
        sourceRef: {
          aggregateType: aiProposal.sourceType,
          aggregateId: aiProposal.sourceId,
          version: aiProposal.sourceVersion,
        },
        model: {
          provider: aiProposal.provider,
          model: aiProposal.model,
          version: aiProposal.modelVersion,
        },
        prompt: { promptId: aiProposal.promptId, version: aiProposal.promptVersion },
        template: { templateId: aiProposal.templateId, version: aiProposal.templateVersion },
        inputHash: aiProposal.inputHash,
        output: Object.fromEntries(
          Object.entries(draft).map(([k, v]) => [
            k,
            listFields.has(k) ? v.split('\n').filter(Boolean) : v.trim(),
          ])
        ),
        evidenceRefs: versioned(aiProposal.evidence),
        counterEvidenceRefs: versioned(aiProposal.counterEvidence),
        confidence: aiProposal.confidence,
        requestedBy: capabilities?.actorId,
        authorizedReviewerId: aiProposal.reviewerId,
      });
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const performReview = async (outcome: 'CHANGES_REQUESTED' | 'ACCEPTED') => {
    if (
      !selected?.current ||
      !capabilities?.canReview ||
      !reviewRationale.trim() ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Card review');
    setWriteState('SAVING');
    const commandKey = `review:${selected.id}:${selected.version}:${initiativeVersion}:${outcome}`;
    const clientRequestId = commandIds.current.get(commandKey) ?? crypto.randomUUID();
    commandIds.current.set(commandKey, clientRequestId);
    try {
      await reviewInitiativeCard(initiativeId, selected.id, {
        expectedVersion: initiativeVersion,
        expectedCardVersion: selected.version,
        clientRequestId,
        outcome,
        rationale: reviewRationale.trim(),
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const requestDefinition = async () => {
    if (
      definitionReadiness?.readiness !== 'READY' ||
      !capabilities?.canUpdate ||
      !definitionAuthorityId.trim() ||
      !definitionDueAt ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Definition decision request');
    setWriteState('SAVING');
    const cachedRequest = definitionRequestIds.current.get(initiativeVersion);
    const requestIds = cachedRequest ?? {
      clientRequestId: crypto.randomUUID(),
      decisionId: definitionDecisionId ?? crypto.randomUUID(),
    };
    definitionRequestIds.current.set(initiativeVersion, requestIds);
    try {
      await requestDefinitionDecision(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId: requestIds.clientRequestId,
        decisionId: requestIds.decisionId,
        authorityId: definitionAuthorityId.trim(),
        dueAt: new Date(definitionDueAt).toISOString(),
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const decideCurrentDefinition = async (outcome: 'APPROVED' | 'RETURNED') => {
    if (!myDefinitionDecision || !decisionRationale.trim() || writeState === 'SAVING') return;
    setWriteAction('Definition decision');
    setWriteState('SAVING');
    const commandKey = `definition-decision:${myDefinitionDecision.decisionId}:${outcome}`;
    const clientRequestId = commandIds.current.get(commandKey) ?? crypto.randomUUID();
    commandIds.current.set(commandKey, clientRequestId);
    try {
      await decideDefinition(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId,
        decisionId: myDefinitionDecision.decisionId,
        outcome,
        rationale: decisionRationale.trim(),
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const createRemediation = async (findingId: string) => {
    if (
      !capabilities?.canUpdate ||
      !financeAssigneeId.trim() ||
      !technicalAuthorityId.trim() ||
      !remediationDueAt ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Remediation work creation');
    setWriteState('SAVING');
    const key = `${findingId}:${initiativeVersion}`;
    const ids = remediationIds.current.get(key) ?? {
      clientRequestId: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      decisionId: crypto.randomUUID(),
    };
    remediationIds.current.set(key, ids);
    try {
      await createDefinitionRemediationWork(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId: ids.clientRequestId,
        findingId,
        financeTask: {
          taskId: ids.taskId,
          title: 'Provide reconciled Finance evidence',
          assigneeId: financeAssigneeId.trim(),
          dueAt: new Date(remediationDueAt).toISOString(),
        },
        technicalDecision: {
          decisionId: ids.decisionId,
          title: 'Select technical option',
          authorityId: technicalAuthorityId.trim(),
          dueAt: new Date(remediationDueAt).toISOString(),
          options: ['Do nothing', 'Proceed with proposed technical option'],
        },
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const refreshSource = async () => {
    const source = definitionReadiness?.sourceStatus;
    if (
      !source ||
      source.currentProposalVersion === null ||
      source.currentSourceVersion === null ||
      !capabilities?.canUpdate ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Source refresh');
    setWriteState('SAVING');
    const key = `${initiativeVersion}:${source.currentProposalVersion}:${source.currentSourceVersion}`;
    const clientRequestId = sourceRefreshIds.current.get(key) ?? crypto.randomUUID();
    sourceRefreshIds.current.set(key, clientRequestId);
    try {
      await refreshInitiativeSource(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId,
        expectedProposalVersion: source.currentProposalVersion,
        expectedSourceVersion: source.currentSourceVersion,
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const startAnalysis = async () => {
    if (lifecycleState !== 'DEFINED' || !capabilities?.canUpdate || writeState === 'SAVING') return;
    setWriteAction('Analysis start');
    setWriteState('SAVING');
    const key = `analysis-start:${initiativeVersion}`;
    const clientRequestId = analysisCommandIds.current.get(key) ?? crypto.randomUUID();
    analysisCommandIds.current.set(key, clientRequestId);
    try {
      await startInitiativeAnalysis(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId,
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const requestAnalysis = async () => {
    if (
      lifecycleState !== 'ANALYZING' ||
      analysisReadiness?.readiness !== 'READY' ||
      analysisDecisionId ||
      !analysisAuthorityId.trim() ||
      !analysisDueAt ||
      !capabilities?.canUpdate ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Analysis decision request');
    setWriteState('SAVING');
    // A lost HTTP response must be retryable as the exact same command. Keeping
    // only clientRequestId while minting a new decisionId changes the payload
    // behind an idempotency key, so the canonical writer correctly rejects the
    // retry as a collision instead of replaying the already-created decision.
    const ids = analysisRequestIds.current.get(initiativeVersion) ?? {
      clientRequestId: crypto.randomUUID(),
      decisionId: crypto.randomUUID(),
    };
    analysisRequestIds.current.set(initiativeVersion, ids);
    try {
      await requestAnalysisDecision(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId: ids.clientRequestId,
        decisionId: ids.decisionId,
        authorityId: analysisAuthorityId.trim(),
        dueAt: new Date(analysisDueAt).toISOString(),
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  const requestSchedule = async () => {
    const parseRef = (value: string) => {
      const [id, versionText] = value.trim().split('@');
      const version = Number(versionText);
      return id && Number.isInteger(version) && version > 0 ? { id, version } : null;
    };
    const portfolio = parseRef(portfolioRef);
    const plan = parseRef(planRef);
    const capacity = parseRef(capacityRef);
    if (
      lifecycleState !== 'APPROVED_BACKLOG' ||
      scheduleDecisionId ||
      !portfolio ||
      !plan ||
      !capacity ||
      !scheduleAuthorityId.trim() ||
      !executionManagerId.trim() ||
      !scheduleDueAt ||
      !capabilities?.canUpdate ||
      writeState === 'SAVING'
    )
      return;
    setWriteAction('Schedule decision request');
    setWriteState('SAVING');
    const key = `schedule-request:${initiativeVersion}`;
    const ids = scheduleCommandIds.current.get(key) ?? {
      clientRequestId: crypto.randomUUID(),
      decisionId: crypto.randomUUID(),
    };
    scheduleCommandIds.current.set(key, ids);
    const content = (cardKey: InitiativeCardKey) =>
      cards.find((card) => card.cardKey === cardKey)?.content ?? {};
    try {
      await requestScheduleDecision(initiativeId, {
        expectedVersion: initiativeVersion,
        clientRequestId: ids.clientRequestId,
        decisionId: ids.decisionId,
        authorityId: scheduleAuthorityId.trim(),
        executionManagerId: executionManagerId.trim(),
        dueAt: new Date(scheduleDueAt).toISOString(),
        portfolioScenarioId: portfolio.id,
        portfolioScenarioVersion: portfolio.version,
        planScenarioId: plan.id,
        planScenarioVersion: plan.version,
        capacityScenarioId: capacity.id,
        capacityScenarioVersion: capacity.version,
        commitmentIds: commitmentIds
          .split('\n')
          .map((id) => id.trim())
          .filter(Boolean),
        criticalPeriodIds: criticalPeriodIds
          .split('\n')
          .map((id) => id.trim())
          .filter(Boolean),
        criticalDependencies: [],
        handoff: {
          scope: content('summary-scope'),
          selectedOptions: content('options'),
          success: content('success-criteria'),
          baseline: { milestones: content('milestones'), timeline: content('timeline') },
          openWork: workRefs.map((ref) => ({ ...ref })),
          raid: [content('risk-raid')],
          outcomeRefs: cards.flatMap((card) => card.evidenceRefs),
          sourceVersions: { initiative: initiativeVersion },
        },
      });
      await load();
      setWriteState('IDLE');
    } catch (error) {
      setWriteState(
        error instanceof RuntimeApiError && error.status === 409 ? 'CONFLICT' : 'FAILED'
      );
    }
  };

  if (state === 'LOADING') {
    return (
      <div role="status" className="flex items-center gap-2 p-6">
        <Loader2 className="animate-spin" size={16} /> Loading Initiative Card
      </div>
    );
  }
  if (state === 'ERROR') {
    return (
      <div role="alert" className="m-6 rounded-md border border-c-danger/30 p-4 text-c-danger">
        Initiative Card is unavailable. No change was made.
      </div>
    );
  }

  const fields = selected ? editableFields[selected.id] : undefined;
  const canIndependentlyReview = Boolean(
    capabilities?.canReview &&
    selected?.current &&
    (capabilities.canSelfApprove || selected.current.publishedBy !== capabilities.actorId)
  );
  const lifecycleIndex = Math.max(0, INITIATIVE_LIFECYCLE.indexOf(lifecycleState as never));
  const nextFinding =
    lifecycleState === 'ANALYZING'
      ? (analysisReadiness?.findings[0] ?? null)
      : (definitionReadiness?.findings[0] ?? null);
  const nextAction = nextFinding
    ? {
        label: `Resolve ${nextFinding.message}`,
        cardKey: nextFinding.cardKey,
        findingId: nextFinding.findingId,
      }
    : definitionReadiness?.readiness === 'READY'
      ? {
          label: 'Request Definition Decision',
          cardKey: 'gates-approvals' as InitiativeCardKey,
          findingId: null,
        }
      : {
          label: `Complete ${selected?.label ?? 'required card'}`,
          cardKey: selectedId,
          findingId: null,
        };

  return (
    <section aria-label="Initiative Card" className="flex h-full min-h-0 flex-col bg-c-background">
      <header className="flex items-center gap-3 border-b border-c-border px-4 py-3">
        <button type="button" className="btn-secondary" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} /> Back
        </button>
        <div className="min-w-0">
          <div className="text-xs uppercase text-c-text-muted">Registered Initiative</div>
          <h2 className="truncate font-semibold text-c-text-primary">{title}</h2>
        </div>
        <div className="ml-auto text-right text-xs text-c-text-muted">
          <div>{lifecycleState}</div>
          <div>Aggregate v{initiativeVersion}</div>
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-c-border bg-c-surface px-4 py-2 text-sm">
        <span className="text-xs font-semibold uppercase text-c-text-muted">Next action</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 font-medium text-c-text-primary"
          onClick={() => openCard(nextAction.cardKey as InitiativeCardKey, nextAction.findingId)}
        >
          {nextAction.label}
          <ChevronRight aria-hidden="true" size={15} />
        </button>
        <span className="ml-auto text-xs text-c-text-muted">
          {lifecycleState === 'ANALYZING' || lifecycleState === 'DEFINED'
            ? `Analysis · ${analysisReadiness?.readiness ?? 'NOT_EVALUATED'}`
            : `Definition · ${definitionReadiness?.readiness ?? 'NOT_EVALUATED'}`}
        </span>
      </div>

      <nav
        aria-label="Initiative lifecycle"
        className="overflow-x-auto border-b border-c-border px-4 py-2"
      >
        <ol className="flex min-w-max items-center gap-1 text-xs">
          {INITIATIVE_LIFECYCLE.map((step, index) => (
            <li
              key={step}
              aria-current={index === lifecycleIndex ? 'step' : undefined}
              className={`rounded-full border px-2 py-1 ${index === lifecycleIndex ? 'border-c-focus-solid bg-c-surface-raised font-semibold text-c-text-primary' : index < lifecycleIndex ? 'border-c-success/40 text-c-text-secondary' : 'border-c-border text-c-text-muted'}`}
            >
              {index + 1}. {step.replaceAll('_', ' ')}
            </li>
          ))}
        </ol>
      </nav>

      {writeState === 'CONFLICT' || writeState === 'FAILED' ? (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-c-danger/30 p-3 text-sm text-c-danger"
        >
          <AlertTriangle aria-hidden="true" size={15} />
          <span>
            {writeState === 'CONFLICT'
              ? `${writeAction} conflicted with newer truth. Reload before trying again.`
              : `${writeAction} failed. The previous durable state remains current.`}
          </span>
          <button
            type="button"
            className="btn-secondary ml-auto"
            onClick={() => {
              setState('LOADING');
              void load().catch(() => setState('ERROR'));
            }}
          >
            Reload current truth
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <nav aria-label="Initiative cards" className="overflow-y-auto border-r border-c-border p-3">
          {groupedRows.map((group) => (
            <section
              key={group.group}
              className="mb-4"
              aria-labelledby={`card-group-${group.group}`}
            >
              <h3
                id={`card-group-${group.group}`}
                className="mb-1 px-2 text-xs font-semibold uppercase text-c-text-muted"
              >
                {group.label}
              </h3>
              <ul className="space-y-1">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      aria-current={row.id === selectedId ? 'page' : undefined}
                      className={`w-full rounded-md px-2 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus ${row.id === selectedId ? 'bg-c-surface-raised text-c-text-primary' : 'text-c-text-secondary hover:bg-c-surface'}`}
                      onClick={() => openCard(row.id, null, false)}
                      onDoubleClick={() => openCard(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          openCard(row.id);
                        }
                      }}
                    >
                      <span className="block font-medium">{row.label}</span>
                      <span className="block text-xs text-c-text-muted">
                        {row.completion} · {row.quality} · {row.freshness}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <main
          ref={canvasRef}
          tabIndex={-1}
          aria-labelledby="selected-card-title"
          className="overflow-y-auto p-5 focus:outline-none"
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-c-border pb-3">
            <div>
              <div className="text-xs uppercase text-c-text-muted">Selected card</div>
              <h3 id="selected-card-title" className="text-lg font-semibold">
                {selected?.label}
              </h3>
            </div>
            <div className="text-right text-xs text-c-text-muted">
              v{selected?.version ?? 0}
              <br />
              {selected?.completion} · {selected?.quality} · {selected?.freshness}
            </div>
          </div>
          {fields ? (
            fields.map((field) => (
              <label key={field} className="mb-4 block">
                <span className="mb-1 block text-sm text-c-text-muted">{field}</span>
                <textarea
                  aria-label={field}
                  className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-3"
                  disabled={!capabilities?.canUpdate}
                  value={draft[field] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field]: event.target.value }))
                  }
                />
              </label>
            ))
          ) : (
            <p className="rounded-md border border-c-border bg-c-surface p-4 text-sm text-c-text-muted">
              This canonical capability is present. Its governed editor activates when its runtime
              adapter is available.
            </p>
          )}
          {fields && (
            <div className="grid gap-3 border-t border-c-border pt-4 sm:grid-cols-3">
              <label className="text-sm">
                Completion
                <select
                  aria-label="Completion"
                  className="mt-1 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={draftCompletion}
                  onChange={(e) => setDraftCompletion(e.target.value as typeof draftCompletion)}
                >
                  <option value="EMPTY">Empty</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETE">Complete</option>
                </select>
              </label>
              <label className="text-sm">
                Quality
                <select
                  aria-label="Quality"
                  className="mt-1 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={draftQuality}
                  onChange={(e) => setDraftQuality(e.target.value as typeof draftQuality)}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="SUFFICIENT">Sufficient</option>
                  <option value="WARNING">Warning</option>
                  <option value="BLOCKER">Blocker</option>
                </select>
              </label>
              <label className="text-sm">
                Freshness
                <select
                  aria-label="Freshness"
                  className="mt-1 w-full rounded-md border border-c-border bg-c-surface p-2"
                  value={draftFreshness}
                  onChange={(e) => setDraftFreshness(e.target.value as typeof draftFreshness)}
                >
                  <option value="CURRENT">Current</option>
                  <option value="STALE">Stale</option>
                  <option value="SOURCE_UNAVAILABLE">Source unavailable</option>
                </select>
              </label>
            </div>
          )}
          {fields && selected && selected.version > 0 && (
            <section className="mt-4 rounded-md border border-c-warning/40 p-3">
              <h4 className="font-medium">Material change proposal</h4>
              <p className="text-xs text-c-text-muted">
                Published truth is not edited in place. The old version stays visible until an
                independent authority approves and the owner publishes the proposal.
              </p>
              <label className="mt-2 block text-sm">
                Independent authority
                <input
                  aria-label="Material change authority"
                  value={materialChangeAuthorityId}
                  onChange={(event) => setMaterialChangeAuthorityId(event.target.value)}
                  className="mt-1 block w-full rounded border border-c-border bg-c-surface p-2"
                />
              </label>
              {(draftFreshness !== 'CURRENT' || draftQuality === 'UNKNOWN') && (
                <p role="alert" className="mt-2 text-c-danger">
                  UNKNOWN or stale truth blocks a material-change request.
                </p>
              )}
            </section>
          )}
          {fields && selected?.current && (
            <section className="mt-4 rounded-md border border-c-border p-3">
              <h4 className="font-medium">Propose AI Analysis</h4>
              <p className="text-xs text-c-text-muted">
                Proposal only. Complete provenance and independent human review are mandatory; stale
                source or Card blocks publication.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['reviewerId', 'Reviewer'],
                    ['sourceType', 'Source aggregate type'],
                    ['sourceId', 'Source aggregate ID'],
                    ['provider', 'Provider'],
                    ['model', 'Model'],
                    ['modelVersion', 'Model version'],
                    ['promptId', 'Prompt ID'],
                    ['templateId', 'Template ID'],
                    ['inputHash', 'Input hash'],
                    ['evidence', 'Evidence refs ref@version'],
                    ['counterEvidence', 'Counter-evidence refs ref@version'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs">
                    {label}
                    <input
                      aria-label={`AI ${label}`}
                      value={aiProposal[key]}
                      onChange={(e) => setAiProposal((x) => ({ ...x, [key]: e.target.value }))}
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                ))}
                <label className="text-xs">
                  Confidence
                  <select
                    aria-label="AI Confidence"
                    value={aiProposal.confidence}
                    onChange={(e) =>
                      setAiProposal((x) => ({
                        ...x,
                        confidence: e.target.value as typeof x.confidence,
                      }))
                    }
                    className="block w-full rounded border border-c-border bg-c-surface p-2"
                  >
                    <option>UNKNOWN</option>
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                  </select>
                </label>
                {(
                  [
                    ['sourceVersion', 'Source version'],
                    ['promptVersion', 'Prompt version'],
                    ['templateVersion', 'Template version'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs">
                    {label}
                    <input
                      aria-label={`AI ${label}`}
                      type="number"
                      min={1}
                      value={aiProposal[key]}
                      onChange={(e) =>
                        setAiProposal((x) => ({ ...x, [key]: Number(e.target.value) }))
                      }
                      className="block w-full rounded border border-c-border bg-c-surface p-2"
                    />
                  </label>
                ))}
              </div>
              {aiProposal.confidence === 'UNKNOWN' && (
                <p role="alert" className="mt-2 text-c-danger">
                  UNKNOWN confidence blocks proposal creation.
                </p>
              )}
              <button
                type="button"
                className="btn-secondary mt-3"
                disabled={writeState === 'SAVING' || aiProposal.confidence === 'UNKNOWN'}
                onClick={() => void proposeAIAnalysis()}
              >
                Send AI proposal to independent review
              </button>
            </section>
          )}
          {canIndependentlyReview && selected?.current?.reviewState === 'REQUESTED' && (
            <label className="mt-4 block">
              <span className="mb-1 block text-sm text-c-text-muted">
                Independent review rationale
              </span>
              <textarea
                className="min-h-20 w-full rounded-md border border-c-border bg-c-surface p-2"
                value={reviewRationale}
                onChange={(e) => setReviewRationale(e.target.value)}
              />
            </label>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-c-border bg-c-background py-3 sm:sticky sm:bottom-0">
            {canIndependentlyReview && selected?.current?.reviewState === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!reviewRationale.trim() || writeState === 'SAVING'}
                  onClick={() => performReview('CHANGES_REQUESTED')}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!reviewRationale.trim() || writeState === 'SAVING'}
                  onClick={() => performReview('ACCEPTED')}
                >
                  Accept review
                </button>
              </>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={!fields || !capabilities?.canUpdate || writeState === 'SAVING'}
              onClick={save}
            >
              {writeState === 'SAVING' ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <Save size={15} />
              )}{' '}
              {selected && selected.version > 0
                ? 'Create change proposal'
                : 'Publish first version'}
            </button>
          </div>
        </main>

        <aside
          aria-label="Card context"
          className="overflow-y-auto border-l border-c-border bg-c-surface p-4 text-sm"
        >
          <h3 className="font-semibold">Context</h3>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-c-text-muted">Truth owner</dt>
              <dd>{selected ? INITIATIVE_CARD_REGISTRY[selectedId].truthOwner : '—'}</dd>
            </div>
            <div>
              <dt className="text-c-text-muted">Readiness</dt>
              <dd>{definitionReadiness?.readiness ?? 'NOT_EVALUATED'}</dd>
            </div>
          </dl>
          {(lifecycleState === 'APPROVED_BACKLOG' || lifecycleState === 'SCHEDULED') && (
            <section aria-label="Schedule readiness" className="mt-5 border-t border-c-border pt-4">
              <h4 className="font-medium">Schedule readiness</h4>
              <p className="mt-1 text-xs text-c-text-muted">
                Exact published inputs only. References use <code>canonical-id@version</code>.
                Scheduling freezes a handoff; it never starts Execution.
              </p>
              {lifecycleState === 'SCHEDULED' ? (
                <div
                  role="status"
                  className="mt-3 rounded-md border border-c-success/40 p-3 text-xs"
                >
                  <strong>SCHEDULED</strong>
                  <div className="mt-1 break-all">
                    Frozen Handoff Package{' '}
                    {handoffPackage
                      ? `${handoffPackage.id} v${handoffPackage.version}`
                      : 'read-back pending'}
                  </div>
                  {linkedExecutionCase ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span>
                        Execution {linkedExecutionCase.executionCaseId} ·{' '}
                        {linkedExecutionCase.state}
                      </span>
                      {onOpenExecution ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            onOpenExecution(linkedExecutionCase.executionCaseId, initiativeId)
                          }
                        >
                          Open Execution
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : scheduleDecisionId ? (
                <p role="status" className="mt-3 text-xs text-c-text-muted">
                  Schedule Decision {scheduleDecisionId} is pending with its named authority.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs">
                    Portfolio Scenario
                    <input
                      aria-label="Schedule Portfolio reference"
                      placeholder="portfolio-id@version"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={portfolioRef}
                      onChange={(event) => setPortfolioRef(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Plan Scenario
                    <input
                      aria-label="Schedule Plan reference"
                      placeholder="plan-id@version"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={planRef}
                      onChange={(event) => setPlanRef(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Capacity Scenario
                    <input
                      aria-label="Schedule Capacity reference"
                      placeholder="capacity-id@version"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={capacityRef}
                      onChange={(event) => setCapacityRef(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Confirmed commitment IDs
                    <textarea
                      aria-label="Schedule commitment IDs"
                      placeholder="One canonical ID per line"
                      className="mt-1 min-h-16 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={commitmentIds}
                      onChange={(event) => setCommitmentIds(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Critical Capacity period IDs
                    <textarea
                      aria-label="Schedule critical period IDs"
                      placeholder="One exact period ID per line"
                      className="mt-1 min-h-16 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={criticalPeriodIds}
                      onChange={(event) => setCriticalPeriodIds(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Schedule authority
                    <input
                      aria-label="Schedule authority"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={scheduleAuthorityId}
                      onChange={(event) => setScheduleAuthorityId(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Execution Manager
                    <input
                      aria-label="Schedule Execution Manager"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={executionManagerId}
                      onChange={(event) => setExecutionManagerId(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs">
                    Decision due
                    <input
                      aria-label="Schedule Decision due"
                      type="datetime-local"
                      className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                      value={scheduleDueAt}
                      onChange={(event) => setScheduleDueAt(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={
                      !portfolioRef.trim() ||
                      !planRef.trim() ||
                      !capacityRef.trim() ||
                      !scheduleAuthorityId.trim() ||
                      !executionManagerId.trim() ||
                      !scheduleDueAt ||
                      writeState === 'SAVING'
                    }
                    onClick={() => void requestSchedule()}
                  >
                    Request Schedule Decision
                  </button>
                </div>
              )}
            </section>
          )}
          <section aria-label="Card findings" className="mt-5">
            <h4 className="font-medium">Findings ({selectedFindings.length})</h4>
            <div className="mt-2 space-y-2">
              {selectedFindings.length ? (
                selectedFindings.map((finding) => {
                  const linked = workRefs.find((ref) => ref.findingId === finding.findingId);
                  return (
                    <button
                      type="button"
                      key={finding.findingId}
                      aria-current={activeFindingId === finding.findingId ? 'true' : undefined}
                      className={`w-full rounded-md border p-3 text-left ${activeFindingId === finding.findingId ? 'border-c-focus-solid' : 'border-c-border'}`}
                      onClick={() =>
                        openCard(finding.cardKey as InitiativeCardKey, finding.findingId, false)
                      }
                    >
                      <span className="block font-medium">
                        {finding.severity}: {finding.message}
                      </span>
                      <span className="block break-all text-xs text-c-text-muted">
                        {finding.findingId}
                      </span>
                      {linked && (
                        <span className="mt-1 block text-xs">
                          Task {linked.taskId} · Decision {linked.decisionId}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-c-text-muted">No findings for this card.</p>
              )}
            </div>
          </section>
          {(lifecycleState === 'DEFINED' || lifecycleState === 'ANALYZING') && (
            <section aria-label="Analysis readiness" className="mt-4 border-t border-c-border pt-3">
              <h4 className="font-medium">Analysis readiness</h4>
              <p className="mt-1 text-xs text-c-text-muted">
                {analysisReadiness?.readiness ?? 'NOT_EVALUATED'} ·{' '}
                {analysisReadiness?.findings.length ?? 0} findings across 10 analysis cards
              </p>
              {selectedAnalysisFindings.length > 0 && (
                <div className="mt-2 space-y-2">
                  {selectedAnalysisFindings.map((finding) => (
                    <button
                      key={finding.findingId}
                      type="button"
                      className={`w-full rounded-md border p-3 text-left ${activeFindingId === finding.findingId ? 'border-c-focus-solid' : 'border-c-border'}`}
                      aria-current={activeFindingId === finding.findingId ? 'true' : undefined}
                      onClick={() =>
                        openCard(finding.cardKey as InitiativeCardKey, finding.findingId, false)
                      }
                    >
                      <span className="block font-medium">
                        {finding.severity}: {finding.message}
                      </span>
                      <span className="block break-all text-xs text-c-text-muted">
                        {finding.findingId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {lifecycleState === 'DEFINED' && (
                <button
                  type="button"
                  className="btn-primary mt-3 w-full"
                  disabled={!capabilities?.canUpdate || writeState === 'SAVING'}
                  onClick={() => void startAnalysis()}
                >
                  Start analysis
                </button>
              )}
              {lifecycleState === 'ANALYZING' &&
                analysisReadiness?.readiness === 'READY' &&
                !analysisDecisionId && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs">
                      Analysis authority
                      <input
                        className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                        value={analysisAuthorityId}
                        onChange={(event) => setAnalysisAuthorityId(event.target.value)}
                      />
                    </label>
                    <label className="block text-xs">
                      Decision due
                      <input
                        className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                        type="datetime-local"
                        value={analysisDueAt}
                        onChange={(event) => setAnalysisDueAt(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={
                        !analysisAuthorityId.trim() || !analysisDueAt || writeState === 'SAVING'
                      }
                      onClick={() => void requestAnalysis()}
                    >
                      Request Analysis Decision
                    </button>
                  </div>
                )}
              {analysisDecisionId && !myAnalysisDecision && (
                <p role="status" className="mt-3 text-xs text-c-text-muted">
                  Analysis Decision is waiting for its named authority. Canonical ID{' '}
                  {analysisDecisionId}.
                </p>
              )}
              {myAnalysisDecision && (
                <p role="status" className="mt-3 text-xs text-c-text-muted">
                  Analysis Decision {myAnalysisDecision.decisionId} is assigned to you in My Work.
                </p>
              )}
            </section>
          )}
          {selectedFindings.some(
            (finding) => !workRefs.some((ref) => ref.findingId === finding.findingId)
          ) && (
            <section
              aria-label="Finding remediation"
              className="mt-4 space-y-2 border-t border-c-border pt-3"
            >
              <h4 className="font-medium">Create remediation work</h4>
              <label className="block text-xs">
                Finance assignee
                <input
                  className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                  value={financeAssigneeId}
                  onChange={(event) => setFinanceAssigneeId(event.target.value)}
                />
              </label>
              <label className="block text-xs">
                Technical authority
                <input
                  className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                  value={technicalAuthorityId}
                  onChange={(event) => setTechnicalAuthorityId(event.target.value)}
                />
              </label>
              <label className="block text-xs">
                Due
                <input
                  className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                  type="datetime-local"
                  value={remediationDueAt}
                  onChange={(event) => setRemediationDueAt(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={
                  !capabilities?.canUpdate ||
                  !financeAssigneeId.trim() ||
                  !technicalAuthorityId.trim() ||
                  !remediationDueAt ||
                  writeState === 'SAVING'
                }
                onClick={() => {
                  const finding = selectedFindings.find(
                    (item) => !workRefs.some((ref) => ref.findingId === item.findingId)
                  );
                  if (finding) void createRemediation(finding.findingId);
                }}
              >
                Create Task and Decision
              </button>
            </section>
          )}
          {lifecycleState === 'REGISTERED_DRAFT' &&
            definitionReadiness?.readiness === 'READY' &&
            capabilities?.canUpdate &&
            !definitionDecisionId && (
              <section
                aria-label="Definition decision request"
                className="mt-4 space-y-2 border-t border-c-border pt-3"
              >
                <h4 className="font-medium">Definition decision</h4>
                <label className="block text-xs">
                  Authority
                  <input
                    className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                    value={definitionAuthorityId}
                    onChange={(event) => setDefinitionAuthorityId(event.target.value)}
                  />
                </label>
                <label className="block text-xs">
                  Due
                  <input
                    className="mt-1 w-full rounded-md border border-c-border bg-c-background p-2"
                    type="datetime-local"
                    value={definitionDueAt}
                    onChange={(event) => setDefinitionDueAt(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={
                    !definitionAuthorityId.trim() || !definitionDueAt || writeState === 'SAVING'
                  }
                  onClick={requestDefinition}
                >
                  Request Definition Decision
                </button>
              </section>
            )}
          {definitionDecisionId &&
            !myDefinitionDecision &&
            lifecycleState === 'REGISTERED_DRAFT' && (
              <p
                role="status"
                className="mt-4 border-t border-c-border pt-3 text-xs text-c-text-muted"
              >
                Definition Decision is waiting for its named authority.
              </p>
            )}
          {myDefinitionDecision && (
            <section
              aria-label="Definition decision"
              className="mt-4 space-y-2 border-t border-c-border pt-3"
            >
              <label className="block text-xs">
                Decision rationale
                <textarea
                  className="mt-1 min-h-16 w-full rounded-md border border-c-border bg-c-background p-2"
                  value={decisionRationale}
                  onChange={(event) => setDecisionRationale(event.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  disabled={!decisionRationale.trim() || writeState === 'SAVING'}
                  onClick={() => decideCurrentDefinition('RETURNED')}
                >
                  Return
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={!decisionRationale.trim() || writeState === 'SAVING'}
                  onClick={() => decideCurrentDefinition('APPROVED')}
                >
                  Approve Definition
                </button>
              </div>
            </section>
          )}
          {definitionReadiness?.sourceStatus?.freshness === 'STALE' && (
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              disabled={!capabilities?.canUpdate || writeState === 'SAVING'}
              onClick={() => void refreshSource()}
            >
              Refresh source v{definitionReadiness.sourceStatus.currentSourceVersion ?? '?'}
            </button>
          )}
          <p className="mt-5 border-t border-c-border pt-3 text-xs text-c-text-muted">
            Initiative {initiativeId}
            <br />
            Card {selectedId}
            {activeFindingId ? (
              <>
                <br />
                Finding {activeFindingId}
              </>
            ) : null}
          </p>
        </aside>
      </div>
    </section>
  );
};
