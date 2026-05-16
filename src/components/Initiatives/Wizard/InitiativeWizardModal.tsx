import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { createInitiativeWriteTruth } from '@/services/initiativeWriteTruth';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';

import { InitiativeStatus, type PortfolioInitiative } from '../../../types';

type WizardStep = 'intent' | 'candidates' | 'governance' | 'result';

type CandidateStatus =
  | 'new_candidate'
  | 'accepted_for_shortlist'
  | 'rejected'
  | 'needs_evidence'
  | 'needs_split'
  | 'needs_merge'
  | 'needs_rewrite'
  | 'already_covered'
  | 'ready_for_charter';

interface WizardCandidate {
  id: string;
  title: string;
  problemStatement: string;
  opportunityStatement: string;
  rationale: string;
  confidenceLevel: string;
  limits: string[];
  impactScore: number;
  effortScore: number;
  riskScore: number;
  timeToValueScore: number;
  strategicFitScore: number;
  suggestedKpi?: string | null;
  firstStep?: string | null;
  initiativeLevel: string;
  triageStatus: CandidateStatus;
  triageReason?: string | null;
  linkedInitiativeId?: string | null;
  sourceRefs: unknown[];
  evidenceRefs: string[];
}

interface WizardAuditEvent {
  id: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  actorId: string | null;
  candidateId: string | null;
  createdAt: string;
}

const AUDIT_EVENT_LABELS: Record<
  string,
  { label: string; tone: 'info' | 'success' | 'warn' | 'block' }
> = {
  wizard_session_created: { label: 'Sesja kreatora utworzona', tone: 'info' },
  wizard_candidates_generated: { label: 'Wygenerowano kandydatow', tone: 'info' },
  wizard_candidate_triaged: { label: 'Decyzja triage', tone: 'info' },
  wizard_shortlist_gate_blocked: { label: 'Shortlist gate zablokowal promote', tone: 'block' },
  wizard_drafts_created: { label: 'Utworzono drafty inicjatyw', tone: 'success' },
};

function formatAuditTimestamp(value: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function describeAuditEvent(event: WizardAuditEvent): string {
  const payload = event.eventPayload || {};
  switch (event.eventType) {
    case 'wizard_candidates_generated': {
      const total = Number(payload.candidateCount ?? 0);
      const evidence = Number(payload.evidenceCount ?? 0);
      const hygiene = Number(payload.hygieneCount ?? 0);
      const mode = String(payload.generationMode ?? 'unknown');
      return `Lacznie ${total} kandydatow (${evidence} z evidence, ${hygiene} hygieny). Tryb: ${mode}.`;
    }
    case 'wizard_candidate_triaged': {
      const status = String(payload.triageStatus ?? '');
      const reason = String(payload.triageReason ?? '');
      return reason ? `Status: ${status}. Powod: ${reason}` : `Status: ${status}.`;
    }
    case 'wizard_shortlist_gate_blocked': {
      const blocked = Number(payload.blockedCount ?? 0);
      const total = Number(payload.shortlistCount ?? 0);
      return `Blokada: ${blocked} z ${total} kandydatow nie przeszlo gate evidence.`;
    }
    case 'wizard_drafts_created': {
      const drafts = Number(payload.draftCount ?? 0);
      return `Utworzono ${drafts} draftow inicjatyw na podstawie zaakceptowanych kandydatow.`;
    }
    case 'wizard_session_created': {
      const mode = String(payload.mode ?? '');
      const sources = Number(payload.sourceCount ?? 0);
      return `Tryb: ${mode}. Zrodel w basket: ${sources}.`;
    }
    default:
      return JSON.stringify(payload);
  }
}

type ExistingInitiativeMatch = Pick<PortfolioInitiative, 'id' | 'name' | 'status'> & {
  title?: string;
};

interface InitiativeWizardModalProps {
  isOpen: boolean;
  projectId?: string | null;
  existingInitiatives: ExistingInitiativeMatch[];
  initialMode?: string;
  initialBusinessPriorities?: string[];
  initialTargetCount?: number;
  initialTimeHorizon?: string;
  initialRiskAppetite?: string;
  initialManualNotes?: string;
  initialSourceBasket?: unknown[];
  creationSourceType?: string;
  creationSourceId?: string | null;
  onClose: () => void;
  onCreated: (created: PortfolioInitiative[]) => void;
}

const BUSINESS_PRIORITIES = [
  { id: 'margin', label: 'Marza / EBITDA' },
  { id: 'quality', label: 'Jakosc' },
  { id: 'speed', label: 'Terminowosc' },
  { id: 'automation', label: 'Automatyzacja' },
  { id: 'governance', label: 'Governance' },
  { id: 'risk', label: 'Redukcja ryzyka' },
];

const STATUS_LABELS: Record<CandidateStatus, string> = {
  new_candidate: 'Nowy',
  accepted_for_shortlist: 'Zaakceptowany',
  rejected: 'Odrzucony',
  needs_evidence: 'Brak evidence',
  needs_split: 'Do podzialu',
  needs_merge: 'Do scalenia',
  needs_rewrite: 'Do przepisania',
  already_covered: 'Juz pokryty',
  ready_for_charter: 'Gotowy do charteru',
};

function findExistingMatch(candidate: WizardCandidate, existing: ExistingInitiativeMatch[]) {
  const duplicateTitle = checkDuplicateInitiative(candidate.title, existing);
  if (!duplicateTitle) return null;
  return (
    existing.find((item) => (item.name || item.title || '').trim() === duplicateTitle.trim()) ||
    existing.find((item) =>
      (item.name || item.title || '').toLowerCase().includes(duplicateTitle.toLowerCase())
    ) ||
    null
  );
}

const ANCHORED_SOURCE_TYPES = new Set([
  'interview_insight',
  'interview_finding',
  'interview_session',
  'tools_session',
  'assessment_result',
  'canvas_artifact',
  'kpi_finding',
  'finance_insight',
  'manual_note',
]);

interface AnchoredSource {
  type: string;
  id: string;
}

function extractCandidateAnchoredSource(candidate: WizardCandidate): AnchoredSource | null {
  const refs = Array.isArray(candidate.sourceRefs) ? candidate.sourceRefs : [];
  for (const raw of refs) {
    if (!raw || typeof raw !== 'object') continue;
    const ref = raw as Record<string, unknown>;
    const type = typeof ref.type === 'string' ? ref.type : null;
    const id = typeof ref.id === 'string' ? ref.id : null;
    if (!type || !id) continue;
    if (ANCHORED_SOURCE_TYPES.has(type)) {
      return { type, id };
    }
  }
  return null;
}

export const InitiativeWizardModal: React.FC<InitiativeWizardModalProps> = ({
  isOpen,
  projectId,
  existingInitiatives,
  initialMode = 'create_first_portfolio',
  initialBusinessPriorities = ['margin', 'quality'],
  initialTargetCount = 5,
  initialTimeHorizon = '90_days',
  initialRiskAppetite = 'balanced',
  initialManualNotes = '',
  initialSourceBasket = [],
  creationSourceType = 'initiative_wizard',
  creationSourceId,
  onClose,
  onCreated,
}) => {
  const [step, setStep] = useState<WizardStep>('intent');
  const [mode, setMode] = useState(initialMode);
  const [targetCount, setTargetCount] = useState(initialTargetCount);
  const [timeHorizon, setTimeHorizon] = useState(initialTimeHorizon);
  const [riskAppetite, setRiskAppetite] = useState(initialRiskAppetite);
  const [businessPriorities, setBusinessPriorities] = useState<string[]>(initialBusinessPriorities);
  const [manualNotes, setManualNotes] = useState(initialManualNotes);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WizardCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [createdInitiatives, setCreatedInitiatives] = useState<PortfolioInitiative[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [auditEvents, setAuditEvents] = useState<WizardAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) || candidates[0],
    [candidates, selectedCandidateId]
  );

  const actionableCandidates = candidates.filter((candidate) =>
    ['accepted_for_shortlist', 'ready_for_charter'].includes(candidate.triageStatus)
  );

  // Shortlist gate (P0 #7): mirrors backend evaluateShortlistGate so the user
  // sees a clear blocker BEFORE clicking Utworz drafty. Backend remains the
  // source of truth and emits an audit event on attempted bypass.
  const shortlistGateBlockers = useMemo(() => {
    const blockers: Array<{
      candidateId: string;
      title: string;
      reason: 'contradicted_confidence' | 'missing_evidence' | 'needs_evidence_status';
      message: string;
    }> = [];
    for (const candidate of actionableCandidates) {
      const confidence = String(candidate.confidenceLevel || '').toLowerCase();
      const evidenceCount = Array.isArray(candidate.evidenceRefs)
        ? candidate.evidenceRefs.length
        : 0;
      const sourceCount = Array.isArray(candidate.sourceRefs) ? candidate.sourceRefs.length : 0;
      if (confidence === 'contradicted') {
        blockers.push({
          candidateId: candidate.id,
          title: candidate.title,
          reason: 'contradicted_confidence',
          message:
            'Confidence ze zrodla "contradicted" - rozstrzygnij sprzeczne obserwacje przed promote.',
        });
        continue;
      }
      if (candidate.triageStatus === 'needs_evidence') {
        blockers.push({
          candidateId: candidate.id,
          title: candidate.title,
          reason: 'needs_evidence_status',
          message:
            'Kandydat oznaczony jako "Brak evidence" - uzupelnij evidence przed utworzeniem draftu.',
        });
        continue;
      }
      // Evidence-anchored candidates must carry evidenceRefs. Hygiene candidates
      // (no sourceRefs) are explicit consultant hypotheses and are allowed
      // without evidenceRefs - they passed proposal -> approval -> execution.
      if (sourceCount > 0 && evidenceCount === 0) {
        blockers.push({
          candidateId: candidate.id,
          title: candidate.title,
          reason: 'missing_evidence',
          message: 'Kandydat ma sourceRefs ale brak evidenceRefs - zlamana lineage do zrodla.',
        });
      }
    }
    return blockers;
  }, [actionableCandidates]);

  const shortlistGateOk = shortlistGateBlockers.length === 0;

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setStep('intent');
    setMode(initialMode);
    setTargetCount(initialTargetCount);
    setTimeHorizon(initialTimeHorizon);
    setRiskAppetite(initialRiskAppetite);
    setBusinessPriorities(initialBusinessPriorities);
    setManualNotes(initialManualNotes);
    setSessionId(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setCreatedInitiatives([]);
    setAuditEvents([]);
    setAuditError(null);
    setAuditLoading(false);
  }, [
    initialBusinessPriorities,
    initialManualNotes,
    initialMode,
    initialRiskAppetite,
    initialTargetCount,
    initialTimeHorizon,
    isOpen,
  ]);

  useEffect(() => {
    if (step !== 'result' || !sessionId) return;
    let cancelled = false;
    const loadAudit = async () => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const response = await Api.get(`/initiatives/wizard/sessions/${sessionId}/audit-events`);
        const events = Array.isArray(response?.events)
          ? (response.events as WizardAuditEvent[])
          : [];
        if (!cancelled) {
          setAuditEvents(events);
        }
      } catch (error) {
        console.error('[InitiativeWizardModal] Failed to load audit timeline:', error);
        if (!cancelled) {
          setAuditError(
            'Nie udalo sie pobrac sladu audytu sesji. Inicjatywy zostaly utworzone, ale timeline jest niedostepny.'
          );
        }
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    };
    void loadAudit();
    return () => {
      cancelled = true;
    };
  }, [step, sessionId]);

  if (!isOpen) return null;

  const togglePriority = (priority: string) => {
    setBusinessPriorities((prev) =>
      prev.includes(priority) ? prev.filter((item) => item !== priority) : [...prev, priority]
    );
  };

  const startWizard = async () => {
    setIsWorking(true);
    try {
      const sessionResponse = await Api.post('/initiatives/wizard/sessions', {
        projectId: projectId || undefined,
        mode,
        businessPriorities,
        targetCount,
        timeHorizon,
        riskAppetite,
        manualNotes,
        sourceBasket:
          initialSourceBasket.length > 0
            ? initialSourceBasket
            : [{ type: 'manual_note', label: 'Consultant wizard input' }],
      });
      const nextSessionId = sessionResponse?.session?.id;
      if (!nextSessionId) throw new Error('Wizard session was not created');
      setSessionId(nextSessionId);

      const candidateResponse = await Api.post(
        `/initiatives/wizard/sessions/${nextSessionId}/candidates/generate`,
        {}
      );
      const nextCandidates = candidateResponse?.candidates || [];
      setCandidates(nextCandidates);
      setSelectedCandidateId(nextCandidates[0]?.id || null);
      setStep('candidates');
      toast.success('Kandydaci inicjatyw sa gotowi do triage.', { duration: 1800 });
    } catch (error) {
      console.error('[InitiativeWizardModal] Failed to start wizard:', error);
      toast.error('Nie udalo sie uruchomic kreatora inicjatyw.');
    } finally {
      setIsWorking(false);
    }
  };

  const triageCandidate = async (
    candidate: WizardCandidate,
    triageStatus: CandidateStatus,
    linkedInitiativeId?: string | null
  ) => {
    setIsWorking(true);
    try {
      const response = await Api.patch(`/initiatives/wizard/candidates/${candidate.id}/triage`, {
        triageStatus,
        linkedInitiativeId: linkedInitiativeId || null,
      });
      const updated = response?.candidate;
      if (!updated) throw new Error('Candidate was not updated');
      setCandidates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedCandidateId(updated.id);
      const label = STATUS_LABELS[triageStatus] || triageStatus;
      toast.success(`Decyzja zapisana: ${label}.`, { duration: 1500 });
    } catch (error) {
      console.error('[InitiativeWizardModal] Candidate triage failed:', error);
      toast.error('Nie udalo sie zapisac decyzji dla kandydata.');
    } finally {
      setIsWorking(false);
    }
  };

  const createDrafts = async () => {
    if (!sessionId) return;
    if (!shortlistGateOk) {
      const firstBlocker = shortlistGateBlockers[0];
      toast.error(`Nie mozna utworzyc draftow: ${firstBlocker?.message || 'wymagane evidence'}.`, {
        duration: 4000,
      });
      return;
    }
    const toCreate = actionableCandidates.filter((candidate) => !candidate.linkedInitiativeId);
    if (toCreate.length === 0) {
      setStep('result');
      return;
    }

    setIsWorking(true);
    const created: PortfolioInitiative[] = [];
    try {
      for (const candidate of toCreate) {
        const anchored = extractCandidateAnchoredSource(candidate);
        const candidateSourceType = anchored?.type || creationSourceType;
        const candidateSourceId = anchored?.id || creationSourceId || sessionId;
        const result = await createInitiativeWriteTruth({
          projectId: projectId || undefined,
          title: candidate.title,
          summary: candidate.opportunityStatement,
          description: candidate.rationale,
          problemStatement: candidate.problemStatement,
          axis: 'transformational',
          status: 'DRAFT',
          priority:
            candidate.impactScore >= 5 ? 'high' : candidate.impactScore >= 4 ? 'medium' : 'low',
          impact: String(candidate.impactScore),
          effort: String(candidate.effortScore),
          confidenceLevel: candidate.confidenceLevel === 'high' ? 'high' : 'medium',
          sourceType: candidateSourceType,
          sourceId: candidateSourceId,
          sourcePack: {
            wizardSessionId: sessionId,
            candidateId: candidate.id,
            sourceRefs: candidate.sourceRefs,
            anchoredSource: anchored,
            limits: candidate.limits,
          },
          actionContract: {
            target: 'initiative',
            mode,
            proposalOnly: true,
            approvedCandidateStatus: candidate.triageStatus,
          },
          evidenceRefs: candidate.evidenceRefs,
          tags: ['initiative-wizard', candidate.initiativeLevel],
          successCriteria: candidate.suggestedKpi ? [candidate.suggestedKpi] : [],
          keyRisks: candidate.limits,
        });
        const initiative = result.truth?.initiative || result.created?.initiative || result.created;
        if (initiative?.id) {
          created.push({
            id: initiative.id,
            name: initiative.name || initiative.title || candidate.title,
            summary: initiative.summary || candidate.opportunityStatement,
            description: initiative.description || candidate.rationale,
            axis: initiative.axis || 'transformational',
            status: initiative.status || InitiativeStatus.DRAFT,
            priority: initiative.priority || 'MEDIUM',
            progress: initiative.progress || 0,
            budget: initiative.budget || 0,
            createdAt: initiative.createdAt || initiative.created_at || new Date().toISOString(),
            updatedAt: initiative.updatedAt || initiative.updated_at || new Date().toISOString(),
          } as PortfolioInitiative);
        }
      }
      setCreatedInitiatives(created);
      onCreated(created);
      try {
        await Api.post(`/initiatives/wizard/sessions/${sessionId}/drafts-created`, {
          draftCount: created.length,
          candidateIds: toCreate.map((candidate) => candidate.id),
        });
      } catch (auditError) {
        console.warn(
          '[InitiativeWizardModal] Failed to record drafts-created audit event:',
          auditError
        );
      }
      setStep('result');
      toast.success(`Utworzono drafty inicjatyw: ${created.length}`, { duration: 1800 });
    } catch (error) {
      console.error('[InitiativeWizardModal] Draft creation failed:', error);
      toast.error('Nie udalo sie utworzyc draftow inicjatyw.');
    } finally {
      setIsWorking(false);
    }
  };

  const renderIntent = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          Decyzja transformacyjna
        </label>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        >
          <option value="create_first_portfolio">Stwórz pierwsze portfolio</option>
          <option value="generate_from_evidence">Wygeneruj z wybranych evidence</option>
          <option value="prioritize_by_goal">Priorytetyzuj wg celu biznesowego</option>
          <option value="match_existing">Dopasuj do istniejących inicjatyw</option>
          <option value="refresh_portfolio">Odśwież portfolio nowymi evidence</option>
          <option value="build_waves">Buduj fale (sekwencja w roadmapę)</option>
          <option value="improve_portfolio">Popraw istniejące portfolio (gap closure)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          Priorytety biznesowe
        </label>
        <div className="flex flex-wrap gap-1.5">
          {BUSINESS_PRIORITIES.map((priority) => {
            const active = businessPriorities.includes(priority.id);
            return (
              <button
                key={priority.id}
                type="button"
                onClick={() => togglePriority(priority.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-primary-500/50 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-primary-500/40 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-300'
                }`}
              >
                {priority.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Liczba
          <input
            type="number"
            min={1}
            max={10}
            value={targetCount}
            onChange={(event) => setTargetCount(Number(event.target.value))}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
          />
        </label>
        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Horyzont
          <select
            value={timeHorizon}
            onChange={(event) => setTimeHorizon(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
          >
            <option value="30_days">30 dni</option>
            <option value="90_days">90 dni</option>
            <option value="6_months">6 miesięcy</option>
            <option value="12_months">12 miesięcy</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Ryzyko
          <select
            value={riskAppetite}
            onChange={(event) => setRiskAppetite(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
          >
            <option value="conservative">Szybkie i pewne</option>
            <option value="balanced">Mieszany portfel</option>
            <option value="bold">Strategic bets</option>
          </select>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          Notatka konsultanta / kontekst
        </label>
        <textarea
          value={manualNotes}
          onChange={(event) => setManualNotes(event.target.value)}
          rows={4}
          placeholder="Np. po assessment chcemy wybrać 3 inicjatywy o największym efekcie na marżę, terminowość i jakość danych..."
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>
    </div>
  );

  const renderCandidates = () => (
    <div className="grid min-h-[440px] grid-cols-[minmax(0,1fr)_360px] gap-3">
      <div className="space-y-1.5 overflow-auto pr-1">
        {candidates.length === 0 && (
          <div
            data-testid="initiative-wizard-empty-candidates"
            className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/[0.1] dark:bg-navy-900/50"
          >
            <Sparkles className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Brak kandydatów do triage
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              Wróć do kroku Intencja i wygeneruj kandydatów. Jeżeli sourceBasket jest pusty, system
              zaproponuje kandydatów z portfolio hygieny (oznaczonych niższym confidence).
            </p>
          </div>
        )}
        {candidates.map((candidate) => {
          const match = findExistingMatch(candidate, existingInitiatives);
          const active = selectedCandidate?.id === candidate.id;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedCandidateId(candidate.id)}
              className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                active
                  ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {candidate.problemStatement}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                  {STATUS_LABELS[candidate.triageStatus]}
                </span>
              </div>
              {match && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Podobna inicjatywa: {match.name || match.title}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCandidate && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-navy-900/50">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Szczegóły kandydata
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            {selectedCandidate.title}
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {selectedCandidate.opportunityStatement}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-xl bg-white px-2.5 py-1.5 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
              Impact: {selectedCandidate.impactScore}/5
            </div>
            <div className="rounded-xl bg-white px-2.5 py-1.5 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
              Effort: {selectedCandidate.effortScore}/5
            </div>
            <div className="rounded-xl bg-white px-2.5 py-1.5 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
              Risk: {selectedCandidate.riskScore}/5
            </div>
            <div className="rounded-xl bg-white px-2.5 py-1.5 text-slate-700 dark:bg-white/[0.04] dark:text-slate-200">
              Confidence: {selectedCandidate.confidenceLevel}
            </div>
          </div>

          {selectedCandidate.suggestedKpi && (
            <div className="mt-2.5 rounded-xl border border-primary-300/60 bg-primary-50 px-2.5 py-1.5 text-xs text-primary-800 dark:border-primary-400/20 dark:bg-primary-500/10 dark:text-primary-100">
              KPI: {selectedCandidate.suggestedKpi}
            </div>
          )}

          {selectedCandidate.limits.length > 0 && (
            <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
              Limits: {selectedCandidate.limits.join(' ')}
            </div>
          )}

          {(selectedCandidate.evidenceRefs.length > 0 ||
            (Array.isArray(selectedCandidate.sourceRefs) &&
              selectedCandidate.sourceRefs.length > 0)) && (
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Evidence trail
              </div>
              {selectedCandidate.evidenceRefs.length > 0 && (
                <div className="mt-1">
                  <span className="font-semibold">Refs:</span>{' '}
                  {selectedCandidate.evidenceRefs.map((ref, idx) => (
                    <span
                      key={`${ref}-${idx}`}
                      className="mr-1 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-white/[0.08] dark:text-slate-200"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(selectedCandidate.sourceRefs) &&
                selectedCandidate.sourceRefs.length > 0 && (
                  <div className="mt-1">
                    <span className="font-semibold">Sources:</span>{' '}
                    {(selectedCandidate.sourceRefs as Array<Record<string, unknown>>).map(
                      (raw, idx) => {
                        const type = typeof raw?.type === 'string' ? raw.type : 'source';
                        const id = typeof raw?.id === 'string' ? raw.id : '';
                        const title = typeof raw?.title === 'string' ? raw.title : '';
                        return (
                          <span
                            key={`${type}-${id}-${idx}`}
                            className="mr-1 inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] text-primary-700 dark:bg-primary-500/10 dark:text-primary-200"
                            title={title}
                          >
                            {type}
                            {id ? `:${id.slice(0, 12)}${id.length > 12 ? '...' : ''}` : ''}
                          </span>
                        );
                      }
                    )}
                  </div>
                )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'accepted_for_shortlist')}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'rejected')}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-rose-500"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'needs_evidence')}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-400/30 dark:bg-navy-900/50 dark:text-amber-200 dark:hover:bg-amber-500/10"
            >
              Needs evidence
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'ready_for_charter')}
              className="rounded-xl border border-primary-300 bg-white px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-400/30 dark:bg-navy-900/50 dark:text-primary-200 dark:hover:bg-primary-500/10"
            >
              Ready
            </button>
          </div>

          {findExistingMatch(selectedCandidate, existingInitiatives) && (
            <button
              type="button"
              onClick={() => {
                const match = findExistingMatch(selectedCandidate, existingInitiatives);
                void triageCandidate(selectedCandidate, 'already_covered', match?.id || null);
              }}
              className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-primary-300 bg-white px-3 py-2 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-400/30 dark:bg-navy-900/50 dark:text-primary-200 dark:hover:bg-primary-500/10"
            >
              <Link2 className="h-3 w-3" />
              Powiąż jako już pokryty
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderGovernance = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-primary-300/60 bg-primary-50 p-3 text-sm text-primary-900 dark:border-primary-400/20 dark:bg-primary-500/10 dark:text-primary-100">
        Proposal preview: system utworzy drafty tylko dla zaakceptowanych kandydatów bez linku do
        istniejącej inicjatywy. Odrzucone i „already covered” nie tworzą trwałych obiektów.
      </div>
      {!shortlistGateOk && (
        <div
          data-testid="initiative-wizard-shortlist-gate-blocked"
          className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Shortlist gate zablokował „Utwórz drafty”
          </div>
          <p className="mt-1 text-xs text-rose-800 dark:text-rose-100/80">
            Zgodnie z kanonem (FINAL_IMPLEMENTATION_PLAN_10) kandydaci z confidence „contradicted”,
            statusem „needs_evidence” lub bez evidenceRefs nie mogą zostać promowani do draftu.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {shortlistGateBlockers.map((blocker) => (
              <li key={blocker.candidateId} className="rounded-xl bg-white/60 px-2.5 py-1.5">
                <span className="font-semibold">{blocker.title}: </span>
                {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1.5">
        {actionableCandidates.map((candidate) => {
          const blocker = shortlistGateBlockers.find((entry) => entry.candidateId === candidate.id);
          return (
            <div
              key={candidate.id}
              className={`rounded-xl border p-2.5 transition-all ${
                blocker
                  ? 'border-rose-300 bg-rose-50/60 dark:border-rose-400/30 dark:bg-rose-500/10'
                  : 'border-slate-200 bg-white dark:border-white/[0.08] dark:bg-navy-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {blocker
                      ? blocker.message
                      : candidate.linkedInitiativeId
                        ? 'Zostanie zlinkowana z istniejącą inicjatywą.'
                        : 'Zostanie utworzony draft inicjatywy.'}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    blocker
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                  }`}
                >
                  {candidate.triageStatus}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="flex min-h-[360px] flex-col">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Kreator zakończył pracę
        </h3>
        <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Utworzone drafty: {createdInitiatives.length}. Kandydaci odrzuceni lub oznaczeni jako
          pokryci nie zostali utworzeni jako nowe inicjatywy.
        </p>
      </div>

      {createdInitiatives.length > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="text-[10px] font-semibold uppercase tracking-wide">
            Nowe drafty inicjatyw
          </div>
          <ul className="mt-2 space-y-1">
            {createdInitiatives.map((initiative) => (
              <li
                key={initiative.id}
                className="flex items-center justify-between rounded-xl bg-white/70 px-2.5 py-1.5 text-xs dark:bg-emerald-500/5"
              >
                <span className="font-medium">{initiative.name || initiative.id}</span>
                <span className="ml-3 truncate font-mono text-[10px] text-emerald-800 dark:text-emerald-200">
                  {initiative.id}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/[0.08] dark:bg-navy-900/50"
        data-testid="initiative-wizard-audit-timeline"
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Audyt sesji – proposal → approval → execution → audit
          </div>
          {auditLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </div>
        {auditError && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            {auditError}
          </div>
        )}
        {!auditLoading && !auditError && auditEvents.length === 0 && (
          <div className="mt-2 text-xs text-slate-500">Brak zdarzeń audytu dla tej sesji.</div>
        )}
        {auditEvents.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {auditEvents.map((event) => {
              const meta = AUDIT_EVENT_LABELS[event.eventType] || {
                label: event.eventType,
                tone: 'info' as const,
              };
              const toneClasses =
                meta.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                  : meta.tone === 'block'
                    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100'
                    : meta.tone === 'warn'
                      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100'
                      : 'border-slate-200 bg-white text-slate-800 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200';
              return (
                <li
                  key={event.id}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs ${toneClasses}`}
                  data-event-type={event.eventType}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{meta.label}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatAuditTimestamp(event.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                    {describeAuditEvent(event)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="min-w-[180px] rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500"
        >
          Zamknij
        </button>
      </div>
    </div>
  );

  const STEP_DEFS: Array<{ id: WizardStep; label: string }> = [
    { id: 'intent', label: 'Intencja' },
    { id: 'candidates', label: 'Kandydaci' },
    { id: 'governance', label: 'Governance' },
    { id: 'result', label: 'Wynik' },
  ];
  const currentStepIndex = STEP_DEFS.findIndex((entry) => entry.id === step);
  const stepReachable: Record<WizardStep, boolean> = {
    intent: true,
    candidates: candidates.length > 0,
    governance: actionableCandidates.length > 0,
    result: createdInitiatives.length > 0,
  };

  const renderStepper = () => (
    <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/[0.08] dark:bg-navy-950/30">
      <div className="grid grid-cols-4 gap-1.5">
        {STEP_DEFS.map((entry, index) => {
          const isActive = entry.id === step;
          const isComplete = index < currentStepIndex;
          const canJump = stepReachable[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                if (canJump) setStep(entry.id);
              }}
              disabled={!canJump}
              className={`rounded-xl border px-2 py-1.5 text-left transition-all hover:border-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive
                  ? 'border-primary-500/40 bg-primary-50 text-primary-700 ring-1 ring-primary-500/20 dark:bg-primary-500/15 dark:text-primary-200'
                  : isComplete
                    ? 'border-slate-200 bg-white text-slate-600 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-300'
                    : 'border-slate-200 bg-slate-100/70 text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${
                    isActive
                      ? 'bg-primary-500 text-white'
                      : isComplete
                        ? 'bg-slate-200 text-slate-700 dark:bg-navy-700 dark:text-slate-200'
                        : 'bg-slate-200/80 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-xs font-semibold leading-none">{entry.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const goToPreviousStep = () => {
    if (step === 'candidates') setStep('intent');
    else if (step === 'governance') setStep('candidates');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
      data-testid="initiative-wizard-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initiative-wizard-title"
    >
      <div className="mx-4 flex h-[640px] w-[1080px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/[0.08] dark:bg-navy-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
          <h2
            id="initiative-wizard-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            <Sparkles size={20} className="text-slate-500 dark:text-slate-400" />
            AI Initiative Wizard
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {renderStepper()}

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-3">
          {step === 'intent' && renderIntent()}
          {step === 'candidates' && renderCandidates()}
          {step === 'governance' && renderGovernance()}
          {step === 'result' && renderResult()}
        </div>

        {/* Footer */}
        {step !== 'result' && (
          <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 p-3 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={isWorking}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              Anuluj
            </button>

            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              {candidates.length > 0
                ? `${actionableCandidates.length} kandydatów w shortlist / ${candidates.length} łącznie`
                : 'Ustaw intencję i wygeneruj kandydatów.'}
              {step === 'governance' && actionableCandidates.length > 0 ? (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    shortlistGateOk
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
                  }`}
                >
                  {shortlistGateOk
                    ? 'Shortlist gate OK'
                    : `Shortlist gate blokuje (${shortlistGateBlockers.length})`}
                </span>
              ) : null}
            </div>

            {step !== 'intent' && (
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={isWorking}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
              >
                Wstecz
              </button>
            )}

            {step === 'intent' && (
              <button
                type="button"
                disabled={isWorking}
                onClick={startWizard}
                className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWorking ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Wygeneruj kandydatów
              </button>
            )}
            {step === 'candidates' && (
              <button
                type="button"
                data-testid="initiative-wizard-governance-preview"
                disabled={actionableCandidates.length === 0}
                onClick={() => setStep('governance')}
                className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Governance preview
                <ArrowRight size={16} />
              </button>
            )}
            {step === 'governance' && (
              <button
                type="button"
                data-testid="initiative-wizard-create-drafts"
                disabled={isWorking || !shortlistGateOk}
                onClick={createDrafts}
                title={
                  !shortlistGateOk
                    ? 'Shortlist gate: rozstrzygnij contradicted / uzupełnij evidence przed Utwórz drafty.'
                    : undefined
                }
                className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWorking ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Utwórz drafty
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
