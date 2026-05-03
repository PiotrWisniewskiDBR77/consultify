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
import React, { useEffect, useMemo, useState } from 'react';
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

interface InitiativeWizardModalProps {
  isOpen: boolean;
  projectId?: string | null;
  existingInitiatives: Array<
    Pick<PortfolioInitiative, 'id' | 'name' | 'status'> & { title?: string }
  >;
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

function findExistingMatch(candidate: WizardCandidate, existing: PortfolioInitiative[]) {
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

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) || candidates[0],
    [candidates, selectedCandidateId]
  );

  const actionableCandidates = candidates.filter((candidate) =>
    ['accepted_for_shortlist', 'ready_for_charter'].includes(candidate.triageStatus)
  );

  useEffect(() => {
    if (!isOpen) return;
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
  }, [
    initialBusinessPriorities,
    initialManualNotes,
    initialMode,
    initialRiskAppetite,
    initialTargetCount,
    initialTimeHorizon,
    isOpen,
  ]);

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
      toast.success('Kandydaci inicjatyw sa gotowi do triage.');
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
    } catch (error) {
      console.error('[InitiativeWizardModal] Candidate triage failed:', error);
      toast.error('Nie udalo sie zapisac decyzji dla kandydata.');
    } finally {
      setIsWorking(false);
    }
  };

  const createDrafts = async () => {
    if (!sessionId) return;
    const toCreate = actionableCandidates.filter((candidate) => !candidate.linkedInitiativeId);
    if (toCreate.length === 0) {
      setStep('result');
      return;
    }

    setIsWorking(true);
    const created: PortfolioInitiative[] = [];
    try {
      for (const candidate of toCreate) {
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
          sourceType: creationSourceType,
          sourceId: creationSourceId || sessionId,
          sourcePack: {
            wizardSessionId: sessionId,
            candidateId: candidate.id,
            sourceRefs: candidate.sourceRefs,
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
      setStep('result');
      toast.success(`Utworzono drafty inicjatyw: ${created.length}`);
    } catch (error) {
      console.error('[InitiativeWizardModal] Draft creation failed:', error);
      toast.error('Nie udalo sie utworzyc draftow inicjatyw.');
    } finally {
      setIsWorking(false);
    }
  };

  const renderIntent = () => (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decyzja transformacyjna
        </label>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-navy-900 dark:text-white"
        >
          <option value="create_first_portfolio">Create first portfolio</option>
          <option value="generate_from_evidence">Generate from selected evidence</option>
          <option value="prioritize_by_goal">Prioritize by business goal</option>
          <option value="match_existing">Match against existing initiatives</option>
          <option value="refresh_portfolio">Refresh portfolio with new evidence</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Priorytety biznesowe
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUSINESS_PRIORITIES.map((priority) => {
            const active = businessPriorities.includes(priority.id);
            return (
              <button
                key={priority.id}
                type="button"
                onClick={() => togglePriority(priority.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  active
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/[0.12] dark:text-slate-300 dark:hover:bg-white/[0.04]'
                }`}
              >
                {priority.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs font-medium text-slate-500">
          Liczba
          <input
            type="number"
            min={1}
            max={10}
            value={targetCount}
            onChange={(event) => setTargetCount(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-navy-900 dark:text-white"
          />
        </label>
        <label className="text-xs font-medium text-slate-500">
          Horyzont
          <select
            value={timeHorizon}
            onChange={(event) => setTimeHorizon(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-navy-900 dark:text-white"
          >
            <option value="30_days">30 dni</option>
            <option value="90_days">90 dni</option>
            <option value="6_months">6 miesiecy</option>
            <option value="12_months">12 miesiecy</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Ryzyko
          <select
            value={riskAppetite}
            onChange={(event) => setRiskAppetite(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/[0.12] dark:bg-navy-900 dark:text-white"
          >
            <option value="conservative">Szybkie i pewne</option>
            <option value="balanced">Mieszany portfel</option>
            <option value="bold">Strategic bets</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Notatka konsultanta / kontekst
        <textarea
          value={manualNotes}
          onChange={(event) => setManualNotes(event.target.value)}
          placeholder="Np. po assessment chcemy wybrac 3 inicjatywy o najwiekszym efekcie na marze, terminowosc i jakosc danych..."
          className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-800 dark:border-white/[0.12] dark:bg-navy-900 dark:text-white"
        />
      </label>
    </div>
  );

  const renderCandidates = () => (
    <div className="grid min-h-[440px] grid-cols-[minmax(0,1fr)_340px] gap-4">
      <div className="space-y-2 overflow-auto pr-1">
        {candidates.map((candidate) => {
          const match = findExistingMatch(candidate, existingInitiatives);
          const active = selectedCandidate?.id === candidate.id;
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedCandidateId(candidate.id)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                active
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/[0.1] dark:bg-navy-900 dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {candidate.title}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {candidate.problemStatement}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                  {STATUS_LABELS[candidate.triageStatus]}
                </span>
              </div>
              {match && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Podobna inicjatywa: {match.name || match.title}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCandidate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.1] dark:bg-navy-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Szczegoly kandydata
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
            {selectedCandidate.title}
          </h3>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            {selectedCandidate.opportunityStatement}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2 dark:bg-white/[0.04]">
              Impact: {selectedCandidate.impactScore}/5
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-white/[0.04]">
              Effort: {selectedCandidate.effortScore}/5
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-white/[0.04]">
              Risk: {selectedCandidate.riskScore}/5
            </div>
            <div className="rounded-lg bg-white p-2 dark:bg-white/[0.04]">
              Confidence: {selectedCandidate.confidenceLevel}
            </div>
          </div>

          {selectedCandidate.suggestedKpi && (
            <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-800 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-100">
              KPI: {selectedCandidate.suggestedKpi}
            </div>
          )}

          {selectedCandidate.limits.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
              Limits: {selectedCandidate.limits.join(' ')}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'accepted_for_shortlist')}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
            >
              <Check className="mr-1 inline h-3 w-3" />
              Accept
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'rejected')}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500"
            >
              <X className="mr-1 inline h-3 w-3" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'needs_evidence')}
              className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-500/10"
            >
              Needs evidence
            </button>
            <button
              type="button"
              onClick={() => triageCandidate(selectedCandidate, 'ready_for_charter')}
              className="rounded-lg border border-cyan-300 px-3 py-2 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:border-cyan-400/30 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
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
              className="mt-2 w-full rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/10"
            >
              <Link2 className="mr-1 inline h-3 w-3" />
              Link as already covered
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderGovernance = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-100">
        Proposal preview: system utworzy drafty tylko dla zaakceptowanych kandydatow bez linku do
        istniejacej inicjatywy. Odrzucone i `already covered` nie tworza trwalych obiektow.
      </div>
      <div className="space-y-2">
        {actionableCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/[0.1] dark:bg-navy-900"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {candidate.title}
                </div>
                <div className="text-xs text-slate-500">
                  {candidate.linkedInitiativeId
                    ? 'Zostanie zlinkowana z istniejaca inicjatywa.'
                    : 'Zostanie utworzony draft inicjatywy.'}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
                {candidate.triageStatus}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
        Kreator zakonczyl prace
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Utworzone drafty: {createdInitiatives.length}. Kandydaci odrzuceni lub oznaczeni jako
        pokryci nie zostali utworzeni jako nowe inicjatywy.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
      >
        Zamknij
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.1] dark:bg-navy-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/[0.1]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-300">
              <Sparkles className="h-4 w-4" />
              AI Initiative Wizard
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              Interaktywny kreator inicjatyw transformacyjnych
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-200 px-5 py-3 text-xs dark:border-white/[0.1]">
          {[
            ['intent', 'Intent'],
            ['candidates', 'Candidates'],
            ['governance', 'Governance'],
            ['result', 'Result'],
          ].map(([id, label]) => (
            <span
              key={id}
              className={`rounded-full px-3 py-1 ${
                step === id
                  ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {step === 'intent' && renderIntent()}
          {step === 'candidates' && renderCandidates()}
          {step === 'governance' && renderGovernance()}
          {step === 'result' && renderResult()}
        </div>

        {step !== 'result' && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/[0.1]">
            <div className="text-xs text-slate-500">
              {candidates.length > 0
                ? `${actionableCandidates.length} kandydatow w shortlist / ${candidates.length} lacznie`
                : 'Ustaw intencje i wygeneruj kandydatow.'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/[0.12] dark:text-slate-300 dark:hover:bg-white/[0.05]"
              >
                Anuluj
              </button>
              {step === 'intent' && (
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={startWizard}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  {isWorking ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
                  Wygeneruj kandydatow
                </button>
              )}
              {step === 'candidates' && (
                <button
                  type="button"
                  disabled={actionableCandidates.length === 0}
                  onClick={() => setStep('governance')}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  Governance preview
                  <ArrowRight className="ml-2 inline h-4 w-4" />
                </button>
              )}
              {step === 'governance' && (
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={createDrafts}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {isWorking ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
                  Utworz drafty
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
