/**
 * InitiativeWizardModal — the CANONICAL initiative-creation surface (#29).
 *
 * This modal consolidates the four prior, divergent entry points for creating
 * initiatives (ad-hoc "+ New initiative" buttons, the assessment → initiative
 * generator, the portfolio-hygiene generator, and the standalone evidence
 * importer) into a single, governed flow:
 *
 *   Insights → Intent → Candidates (triage + similarity) → Governance → Result
 *
 * All new initiative creation should route through here so the lineage
 * (source → initiative), capacity signal, similarity/duplicate gate, and
 * shortlist evidence gate are applied uniformly.
 *
 * NOTE: a shared <WizardModal> shell (header / stepper / footer extracted for
 * reuse across modules) is a SEPARATE future task (§5) and is intentionally NOT
 * built here. This file keeps its header / stepper / footer structure clean and
 * self-contained so that extraction stays mechanical when §5 happens.
 */
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Select } from '@/components/shared/forms';
import { RequiredProjectPicker } from '@/components/shared/RequiredProjectPicker';
import {
  type WizardStep as SharedWizardStep,
  WizardStepper,
} from '@/components/shared/WizardModal';
import { Button } from '@/components/ui/primitives';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { Api } from '@/services/api';
import { V8InterviewApi, type V8InterviewInsight } from '@/services/api/v8/interview';
import { createInitiativeWriteTruth } from '@/services/initiativeWriteTruth';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';

import { InitiativeStatus, type PortfolioInitiative } from '../../../types';

type WizardStep = 'insights' | 'intent' | 'candidates' | 'governance' | 'result';

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
  { label: Record<WizardLanguage, string>; tone: 'info' | 'success' | 'warn' | 'block' }
> = {
  wizard_session_created: {
    label: { pl: 'Sesja kreatora utworzona', en: 'Wizard session created' },
    tone: 'info',
  },
  wizard_candidates_generated: {
    label: { pl: 'Wygenerowano kandydatow', en: 'Candidates generated' },
    tone: 'info',
  },
  wizard_candidate_triaged: {
    label: { pl: 'Decyzja triage', en: 'Triage decision' },
    tone: 'info',
  },
  wizard_shortlist_gate_blocked: {
    label: { pl: 'Shortlist gate zablokowal promote', en: 'Shortlist gate blocked promote' },
    tone: 'block',
  },
  wizard_drafts_created: {
    label: { pl: 'Utworzono drafty inicjatyw', en: 'Initiative drafts created' },
    tone: 'success',
  },
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

function describeAuditEvent(event: WizardAuditEvent, language: WizardLanguage): string {
  const payload = event.eventPayload || {};
  const pl = language === 'pl';
  switch (event.eventType) {
    case 'wizard_candidates_generated': {
      const total = Number(payload.candidateCount ?? 0);
      const evidence = Number(payload.evidenceCount ?? 0);
      const hygiene = Number(payload.hygieneCount ?? 0);
      const mode = String(payload.generationMode ?? 'unknown');
      return pl
        ? `Lacznie ${total} kandydatow (${evidence} z evidence, ${hygiene} hygieny). Tryb: ${mode}.`
        : `${total} candidates total (${evidence} from evidence, ${hygiene} hygiene). Mode: ${mode}.`;
    }
    case 'wizard_candidate_triaged': {
      const status = String(payload.triageStatus ?? '');
      const reason = String(payload.triageReason ?? '');
      if (pl) return reason ? `Status: ${status}. Powod: ${reason}` : `Status: ${status}.`;
      return reason ? `Status: ${status}. Reason: ${reason}` : `Status: ${status}.`;
    }
    case 'wizard_shortlist_gate_blocked': {
      const blocked = Number(payload.blockedCount ?? 0);
      const total = Number(payload.shortlistCount ?? 0);
      return pl
        ? `Blokada: ${blocked} z ${total} kandydatow nie przeszlo gate evidence.`
        : `Blocked: ${blocked} of ${total} candidates did not pass the evidence gate.`;
    }
    case 'wizard_drafts_created': {
      const drafts = Number(payload.draftCount ?? 0);
      return pl
        ? `Utworzono ${drafts} draftow inicjatyw na podstawie zaakceptowanych kandydatow.`
        : `Created ${drafts} initiative drafts from the accepted candidates.`;
    }
    case 'wizard_session_created': {
      const mode = String(payload.mode ?? '');
      const sources = Number(payload.sourceCount ?? 0);
      return pl
        ? `Tryb: ${mode}. Zrodel w basket: ${sources}.`
        : `Mode: ${mode}. Sources in basket: ${sources}.`;
    }
    default:
      return JSON.stringify(payload);
  }
}

type ExistingInitiativeMatch = Pick<PortfolioInitiative, 'id' | 'name' | 'status'> & {
  title?: string;
};

// ---- Initiative similarity / duplicate check (audit #29d) -------------------
// Backend POST /initiatives/similarity-check verdict + top match per candidate.
type SimilarityVerdict = 'duplicate' | 'similar' | 'related' | 'new';

interface SimilarityMatch {
  id: string;
  title: string;
  status: string;
  owner?: string | null;
  score: number;
}

interface SimilarityCandidateResult {
  candidateIndex: number;
  matches: SimilarityMatch[];
  topScore: number;
  verdict: SimilarityVerdict;
}

interface SimilarityCheckResponse {
  results: SimilarityCandidateResult[];
  method?: 'embeddings' | 'token-overlap';
  comparedCount?: number;
  truncated?: boolean;
}

type WizardLanguage = 'pl' | 'en';

// ---- #29e similar-candidate resolution choice -------------------------------
// When a candidate is flagged SIMILAR / DUPLICATE against an existing
// initiative, the user picks how to resolve the overlap. "create_anyway" wires
// to the existing create path; "merge" / "extend" are real and POST to the
// backend endpoints `/initiatives/:id/merge-from-insight` and
// `/initiatives/:id/extend-from-insight` respectively.
type SimilarResolution = 'merge' | 'extend' | 'create_anyway';

// ---- #29h progressive fill: the four CORE fields (rdzeń) ---------------------
// Pre-filled from the selected insight; the rest is left to AI-assist / manual.
// sectionKey maps to a server-side initiative section type with a configured AI
// prompt (migrations 529/530), so "Fill with AI" hits POST
// /initiatives/generate-section honestly (degrades when AI is unconfigured).
type CoreFieldKey = 'problem' | 'solution' | 'scope' | 'kpi';

const CORE_FIELD_DEFS: Array<{
  key: CoreFieldKey;
  labelKey: string;
  sectionKey: string;
  rows: number;
}> = [
  { key: 'problem', labelKey: 'fieldProblem', sectionKey: 'problem_definition', rows: 3 },
  { key: 'solution', labelKey: 'fieldSolution', sectionKey: 'target_state', rows: 3 },
  { key: 'scope', labelKey: 'fieldScope', sectionKey: 'scope', rows: 3 },
  { key: 'kpi', labelKey: 'fieldKpi', sectionKey: 'kpis', rows: 2 },
];

type CoreFields = Record<CoreFieldKey, string>;
type CorePrefilled = Record<CoreFieldKey, boolean>;

const EMPTY_CORE: CoreFields = { problem: '', solution: '', scope: '', kpi: '' };

const SIMILARITY_CHIP_CONFIG: Record<
  Exclude<SimilarityVerdict, 'new'> | 'new',
  { className: string; label: Record<WizardLanguage, string> }
> = {
  new: {
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    label: { pl: 'NOWA', en: 'NEW' },
  },
  related: {
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    label: { pl: 'POWIĄZANA', en: 'RELATED' },
  },
  similar: {
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    label: { pl: 'PODOBNA', en: 'SIMILAR' },
  },
  duplicate: {
    className: 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
    label: { pl: 'DUPLIKAT', en: 'DUPLICATE' },
  },
};

const SIMILARITY_HINT: Record<WizardLanguage, string> = {
  pl: 'podobna inicjatywa już istnieje',
  en: 'a similar initiative already exists',
};

const SIMILARITY_TOP_MATCH_LABEL: Record<WizardLanguage, string> = {
  pl: 'Najbliższa',
  en: 'Closest',
};

// ---- #29c capacity (overload) signal -----------------------------------------
interface CapacitySignal {
  activeCount: number;
  suggestedCount: number;
  overload: 'green' | 'amber' | 'red';
}

// ---- Localized copy for the additive steps (#29b, #29c, #29f) ----------------
const WIZARD_COPY: Record<WizardLanguage, Record<string, string>> = {
  pl: {
    wizardTitle: 'Kreator Inicjatyw AI',
    stepInsights: 'Wnioski',
    selectInsightsTitle: 'Wybierz wnioski do analizy',
    selectInsightsHint:
      'Zaznacz 1 lub więcej wniosków z wywiadów. Inicjatywy zostaną wygenerowane na ich podstawie, a lineage (źródło → inicjatywa) będzie zapisany.',
    insightsLoading: 'Ładowanie wniosków…',
    insightsEmpty: 'Brak dostępnych wniosków z wywiadów.',
    insightsError: 'Nie udało się pobrać wniosków. Spróbuj ponownie.',
    findings: 'obserwacji',
    selectedSummary: 'Wybrano',
    none: 'Brak wyboru — przejdź dalej, aby skorzystać z hygieny portfolio.',
    capacityPrefix: 'zespół ma',
    capacityActive: 'aktywnych inicjatyw',
    capacitySuggested: 'sugerowane',
    capacityOverloadAmber: 'Portfolio zaczyna być obciążone — rozważ mniejszą liczbę.',
    capacityOverloadRed: 'Portfolio jest przeciążone — utwórz tylko 1–2 nowe inicjatywy.',
    bulkSelectTitle: 'Wybierz inicjatywy do utworzenia',
    bulkSelectHint: 'Komfortowo twórz 1–3 inicjatywy naraz. Każda to ciężki obiekt.',
    bulkSoftLimit: 'Tworzysz {n} inicjatyw — rozważ mniej; każda to ciężki obiekt.',
    bulkProgress: 'Tworzenie inicjatyw…',
    next: 'Dalej',
    back: 'Wstecz',
    // #29e — merge / extend / create-anyway for similar candidates
    similarChoiceTitle: 'Ten kandydat przypomina istniejącą inicjatywę',
    similarChoiceHint: 'Wybierz, jak rozwiązać podobieństwo przed utworzeniem draftu.',
    mergeOption: 'Scal z istniejącą',
    extendOption: 'Rozszerz istniejącą (dodaj zakres)',
    createAnywayOption: 'Utwórz mimo to',
    openExisting: 'Otwórz istniejącą',
    mergeWorking: 'Scalanie z istniejącą inicjatywą…',
    extendWorking: 'Rozszerzanie zakresu istniejącej inicjatywy…',
    mergeDone: 'Scalono z istniejącą inicjatywą (lineage + notatka zapisane).',
    extendDone: 'Rozszerzono zakres istniejącej inicjatywy (lineage + notatka zapisane).',
    mergeExtendFailed: 'Nie udało się scalić/rozszerzyć istniejącej inicjatywy.',
    mergedBadge: 'Scalono z istniejącą',
    extendedBadge: 'Rozszerzono istniejącą',
    createAnywayPicked: 'Utworzysz osobną inicjatywę mimo podobieństwa.',
    // #29h — progressive fill / AI assist
    coreTitle: 'Rdzeń inicjatywy (auto-uzupełniony z wniosku)',
    coreHint:
      'Pola rdzenia uzupełniliśmy z wybranego wniosku. Przejrzyj je, a puste sekcje uzupełnij z pomocą AI.',
    fieldProblem: 'Problem',
    fieldSolution: 'Rozwiązanie',
    fieldScope: 'Zakres',
    fieldKpi: 'KPI',
    fillWithAi: 'Uzupełnij z AI',
    aiFilling: 'AI uzupełnia…',
    aiFilled: 'Uzupełniono z AI.',
    aiUnavailable: 'Asystent AI nie jest skonfigurowany dla tej sekcji.',
    aiFailed: 'Nie udało się uzupełnić sekcji z AI.',
    prefilledFromInsight: 'z wniosku',
    // footer
    cancel: 'Anuluj',
    setIntentHint: 'Ustaw intencję i wygeneruj kandydatów.',
    shortlistGateOk: 'Shortlist gate OK',
    generateCandidates: 'Wygeneruj kandydatów',
    governancePreview: 'Governance preview',
    shortlistGateTitle:
      'Shortlist gate: rozstrzygnij contradicted / uzupełnij evidence przed Utwórz drafty.',
    // intent step
    transformDecision: 'Decyzja transformacyjna',
    modeCreateFirstPortfolio: 'Stwórz pierwsze portfolio',
    modeGenerateFromEvidence: 'Wygeneruj z wybranych evidence',
    modePrioritizeByGoal: 'Priorytetyzuj wg celu biznesowego',
    modeMatchExisting: 'Dopasuj do istniejących inicjatyw',
    modeRefreshPortfolio: 'Odśwież portfolio nowymi evidence',
    modeBuildWaves: 'Buduj fale (sekwencja w roadmapę)',
    modeImprovePortfolio: 'Popraw istniejące portfolio (gap closure)',
    businessPriorities: 'Priorytety biznesowe',
    countLabel: 'Liczba',
    horizonLabel: 'Horyzont',
    horizon30Days: '30 dni',
    horizon90Days: '90 dni',
    horizon6Months: '6 miesięcy',
    horizon12Months: '12 miesięcy',
    riskLabel: 'Ryzyko',
    riskConservative: 'Szybkie i pewne',
    riskBalanced: 'Mieszany portfel',
    riskBold: 'Strategic bets',
    consultantNote: 'Notatka konsultanta / kontekst',
    consultantNotePlaceholder:
      'Np. po assessment chcemy wybrać 3 inicjatywy o największym efekcie na marżę, terminowość i jakość danych...',
    // candidates step
    noCandidatesTitle: 'Brak kandydatów do triage',
    noCandidatesHint:
      'Wróć do kroku Intencja i wygeneruj kandydatów. Jeżeli sourceBasket jest pusty, system zaproponuje kandydatów z portfolio hygieny (oznaczonych niższym confidence).',
    similarInitiative: 'Podobna inicjatywa',
    candidateDetails: 'Szczegóły kandydata',
    needsEvidence: 'Brak evidence',
    ready: 'Gotowy',
    linkAlreadyCovered: 'Powiąż jako już pokryty',
    // governance step
    shortlistGateBlockedTitle: 'Shortlist gate zablokował „Utwórz drafty”',
    shortlistGateBlockedBody:
      'Zgodnie z kanonem (FINAL_IMPLEMENTATION_PLAN_10) kandydaci z confidence „contradicted”, statusem „needs_evidence” lub bez evidenceRefs nie mogą zostać promowani do draftu.',
    willLinkExisting: 'Zostanie zlinkowana z istniejącą inicjatywą.',
    willCreateDraft: 'Zostanie utworzony draft inicjatywy (DRAFT).',
    willBeSkipped: 'Pominięta — nie zostanie utworzona.',
    // result step
    wizardDone: 'Kreator zakończył pracę',
    newDraftsLabel: 'Nowe drafty inicjatyw',
    auditTimelineLabel: 'Audyt sesji – proposal → approval → execution → audit',
    noAuditEvents: 'Brak zdarzeń audytu dla tej sesji.',
    close: 'Zamknij',
  },
  en: {
    wizardTitle: 'AI Initiative Wizard',
    stepInsights: 'Insights',
    selectInsightsTitle: 'Select insights to analyze',
    selectInsightsHint:
      'Pick 1 or more interview insights. Initiatives will be generated from them, and the lineage (source → initiative) will be recorded.',
    insightsLoading: 'Loading insights…',
    insightsEmpty: 'No interview insights available.',
    insightsError: 'Failed to load insights. Try again.',
    findings: 'findings',
    selectedSummary: 'Selected',
    none: 'Nothing selected — continue to use portfolio hygiene instead.',
    capacityPrefix: 'the team has',
    capacityActive: 'active initiatives',
    capacitySuggested: 'suggested',
    capacityOverloadAmber: 'Portfolio is getting loaded — consider fewer.',
    capacityOverloadRed: 'Portfolio is overloaded — create only 1–2 new initiatives.',
    bulkSelectTitle: 'Select initiatives to create',
    bulkSelectHint: 'Comfortably create 1–3 initiatives at a time. Each is a heavy object.',
    bulkSoftLimit: 'You are creating {n} initiatives — consider fewer; each is a heavy object.',
    bulkProgress: 'Creating initiatives…',
    next: 'Next',
    back: 'Back',
    // #29e — merge / extend / create-anyway for similar candidates
    similarChoiceTitle: 'This candidate resembles an existing initiative',
    similarChoiceHint: 'Choose how to resolve the overlap before creating a draft.',
    mergeOption: 'Merge into existing',
    extendOption: 'Extend existing (add scope)',
    createAnywayOption: 'Create anyway',
    openExisting: 'Open existing',
    mergeWorking: 'Merging into the existing initiative…',
    extendWorking: 'Extending the scope of the existing initiative…',
    mergeDone: 'Merged into the existing initiative (lineage + note recorded).',
    extendDone: 'Extended the existing initiative scope (lineage + note recorded).',
    mergeExtendFailed: 'Failed to merge/extend the existing initiative.',
    mergedBadge: 'Merged into existing',
    extendedBadge: 'Extended existing',
    createAnywayPicked: 'You will create a separate initiative despite the overlap.',
    // #29h — progressive fill / AI assist
    coreTitle: 'Initiative core (auto-filled from the insight)',
    coreHint:
      'We pre-filled the core fields from the selected insight. Review them and use AI to fill the empty sections.',
    fieldProblem: 'Problem',
    fieldSolution: 'Solution',
    fieldScope: 'Scope',
    fieldKpi: 'KPI',
    fillWithAi: 'Fill with AI',
    aiFilling: 'AI filling…',
    aiFilled: 'Filled with AI.',
    aiUnavailable: 'AI assist is not configured for this section.',
    aiFailed: 'Failed to fill the section with AI.',
    prefilledFromInsight: 'from insight',
    // footer
    cancel: 'Cancel',
    setIntentHint: 'Set the intent and generate candidates.',
    shortlistGateOk: 'Shortlist gate OK',
    generateCandidates: 'Generate candidates',
    governancePreview: 'Governance preview',
    shortlistGateTitle: 'Shortlist gate: resolve contradicted / add evidence before Create drafts.',
    // intent step
    transformDecision: 'Transformation decision',
    modeCreateFirstPortfolio: 'Create the first portfolio',
    modeGenerateFromEvidence: 'Generate from selected evidence',
    modePrioritizeByGoal: 'Prioritize by business goal',
    modeMatchExisting: 'Match to existing initiatives',
    modeRefreshPortfolio: 'Refresh portfolio with new evidence',
    modeBuildWaves: 'Build waves (sequence into a roadmap)',
    modeImprovePortfolio: 'Improve existing portfolio (gap closure)',
    businessPriorities: 'Business priorities',
    countLabel: 'Count',
    horizonLabel: 'Horizon',
    horizon30Days: '30 days',
    horizon90Days: '90 days',
    horizon6Months: '6 months',
    horizon12Months: '12 months',
    riskLabel: 'Risk',
    riskConservative: 'Fast and safe',
    riskBalanced: 'Balanced portfolio',
    riskBold: 'Strategic bets',
    consultantNote: 'Consultant note / context',
    consultantNotePlaceholder:
      'E.g. after the assessment we want to pick 3 initiatives with the biggest impact on margin, on-time delivery and data quality...',
    // candidates step
    noCandidatesTitle: 'No candidates to triage',
    noCandidatesHint:
      'Go back to the Intent step and generate candidates. If the sourceBasket is empty, the system will propose candidates from portfolio hygiene (flagged with lower confidence).',
    similarInitiative: 'Similar initiative',
    candidateDetails: 'Candidate details',
    needsEvidence: 'Needs evidence',
    ready: 'Ready',
    linkAlreadyCovered: 'Link as already covered',
    // governance step
    shortlistGateBlockedTitle: 'Shortlist gate blocked “Create drafts”',
    shortlistGateBlockedBody:
      'Per canon (FINAL_IMPLEMENTATION_PLAN_10) candidates with “contradicted” confidence, “needs_evidence” status or without evidenceRefs cannot be promoted to a draft.',
    willLinkExisting: 'Will be linked to an existing initiative.',
    willCreateDraft: 'An initiative draft (DRAFT) will be created.',
    willBeSkipped: 'Skipped — will not be created.',
    // result step
    wizardDone: 'The wizard has finished',
    newDraftsLabel: 'New initiative drafts',
    auditTimelineLabel: 'Session audit – proposal → approval → execution → audit',
    noAuditEvents: 'No audit events for this session.',
    close: 'Close',
  },
};

// #29h — derive the CORE fields (Problem / Solution / Scope / KPI) from an
// interview insight already loaded in the wizard (Step 0). Best-effort: only
// fills what the insight actually carries, leaving the rest empty for AI-assist.
function deriveCoreFromInsight(insight: V8InterviewInsight | undefined): {
  fields: CoreFields;
  prefilled: CorePrefilled;
} {
  const fields: CoreFields = { ...EMPTY_CORE };
  const prefilled: CorePrefilled = {
    problem: false,
    solution: false,
    scope: false,
    kpi: false,
  };
  if (!insight) return { fields, prefilled };

  const joinItems = (
    items: Array<{ title?: string; description?: string }> | undefined,
    max: number
  ): string =>
    (Array.isArray(items) ? items : [])
      .slice(0, max)
      .map((item) => {
        const title = (item?.title || '').trim();
        const description = (item?.description || '').trim();
        if (title && description) return `${title} — ${description}`;
        return title || description;
      })
      .filter(Boolean)
      .join('\n');

  // Problem ← issues (or executive summary as a fallback).
  const problem = joinItems(insight.issues, 3) || (insight.executiveSummary || '').trim();
  if (problem) {
    fields.problem = problem;
    prefilled.problem = true;
  }

  // Solution ← opportunities.
  const solution = joinItems(insight.opportunities, 3);
  if (solution) {
    fields.solution = solution;
    prefilled.solution = true;
  }

  // Scope ← themes + topic focus.
  const themeScope = joinItems(insight.themes, 3);
  const topicScope = Array.isArray(insight.topicFocus) ? insight.topicFocus.join(', ') : '';
  const scope = [themeScope, topicScope ? `Focus: ${topicScope}` : ''].filter(Boolean).join('\n');
  if (scope) {
    fields.scope = scope;
    prefilled.scope = true;
  }

  // KPI is intentionally left empty — insights rarely carry a measurable KPI,
  // so this is the canonical "AI-assist fills the rest" affordance.
  return { fields, prefilled };
}

function countInsightFindings(insight: V8InterviewInsight): number {
  const themes = Array.isArray(insight.themes) ? insight.themes.length : 0;
  const issues = Array.isArray(insight.issues) ? insight.issues.length : 0;
  const opportunities = Array.isArray(insight.opportunities) ? insight.opportunities.length : 0;
  return themes + issues + opportunities;
}

function formatInsightDate(value: string | undefined, language: WizardLanguage): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

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
  language?: WizardLanguage;
  onClose: () => void;
  onCreated: (created: PortfolioInitiative[]) => void;
}

const BUSINESS_PRIORITIES: Array<{ id: string; label: Record<WizardLanguage, string> }> = [
  { id: 'margin', label: { pl: 'Marza / EBITDA', en: 'Margin / EBITDA' } },
  { id: 'quality', label: { pl: 'Jakosc', en: 'Quality' } },
  { id: 'speed', label: { pl: 'Terminowosc', en: 'On-time delivery' } },
  { id: 'automation', label: { pl: 'Automatyzacja', en: 'Automation' } },
  { id: 'governance', label: { pl: 'Governance', en: 'Governance' } },
  { id: 'risk', label: { pl: 'Redukcja ryzyka', en: 'Risk reduction' } },
];

const STATUS_LABELS: Record<CandidateStatus, Record<WizardLanguage, string>> = {
  new_candidate: { pl: 'Nowy', en: 'New' },
  accepted_for_shortlist: { pl: 'Zaakceptowany', en: 'Accepted' },
  rejected: { pl: 'Odrzucony', en: 'Rejected' },
  needs_evidence: { pl: 'Brak evidence', en: 'Needs evidence' },
  needs_split: { pl: 'Do podzialu', en: 'Needs split' },
  needs_merge: { pl: 'Do scalenia', en: 'Needs merge' },
  needs_rewrite: { pl: 'Do przepisania', en: 'Needs rewrite' },
  already_covered: { pl: 'Juz pokryty', en: 'Already covered' },
  ready_for_charter: { pl: 'Gotowy do charteru', en: 'Ready for charter' },
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
  language = 'pl',
  onClose,
  onCreated,
}) => {
  const wizardDialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: isOpen, onClose, containerRef: wizardDialogRef });
  const [step, setStep] = useState<WizardStep>('insights');
  const [mode, setMode] = useState(initialMode);
  const [targetCount, setTargetCount] = useState(initialTargetCount);
  // #29b — Step 0: insight selection. The user picks 1-N interview insights the
  // initiatives are generated from; selection carries into the generation
  // request and tags created initiatives (1:N lineage).
  const [insights, setInsights] = useState<V8InterviewInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [selectedInsightIds, setSelectedInsightIds] = useState<string[]>([]);
  // #29c — capacity / overload signal fetched in the Intent step.
  const [capacity, setCapacity] = useState<CapacitySignal | null>(null);
  // #29f — which actionable candidates the user wants to actually create.
  const [selectedCreateIds, setSelectedCreateIds] = useState<string[]>([]);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [timeHorizon, setTimeHorizon] = useState(initialTimeHorizon);
  const [riskAppetite, setRiskAppetite] = useState(initialRiskAppetite);
  const [businessPriorities, setBusinessPriorities] = useState<string[]>(initialBusinessPriorities);
  const [manualNotes, setManualNotes] = useState(initialManualNotes);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId?.trim() || '');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionProjectId, setSessionProjectId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<WizardCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  // Audit #29d: per-candidate duplicate/similarity verdict from the backend,
  // keyed by candidate id. Informational only — never blocks selection.
  const [similarityByCandidate, setSimilarityByCandidate] = useState<
    Record<string, SimilarityCandidateResult>
  >({});
  const [createdInitiatives, setCreatedInitiatives] = useState<PortfolioInitiative[]>([]);
  // #29h — progressive-fill CORE fields (rdzeń) auto-derived from the selected
  // insight; user reviews + AI fills the empty sections.
  const [coreFields, setCoreFields] = useState<CoreFields>({ ...EMPTY_CORE });
  const [corePrefilled, setCorePrefilled] = useState<CorePrefilled>({
    problem: false,
    solution: false,
    scope: false,
    kpi: false,
  });
  const [coreTouched, setCoreTouched] = useState(false);
  const [aiFillingField, setAiFillingField] = useState<CoreFieldKey | null>(null);
  // #29e — per-candidate resolution choice for SIMILAR / DUPLICATE candidates.
  const [similarResolutions, setSimilarResolutions] = useState<Record<string, SimilarResolution>>(
    {}
  );
  // #29e — candidates that have been REALLY merged/extended into an existing
  // initiative (not newly created). Keyed by candidate id; drives the success
  // badge, the "open existing" link, and removal from the create-shortlist.
  const [resolvedExisting, setResolvedExisting] = useState<
    Record<string, { mode: 'merge' | 'extend'; initiativeId: string; title: string }>
  >({});
  const [resolvingCandidateId, setResolvingCandidateId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [auditEvents, setAuditEvents] = useState<WizardAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  // #75 — the "insights" step is a source-anchored picker (values in
  // ANCHORED_SOURCE_TYPES). When the wizard is opened without any seeded
  // source (scratch / hub context, e.g. Initiatives §Menu 3 "AI Initiative
  // Wizard") AND the org genuinely has zero interview insights to pick from,
  // showing that step first is a dead end ("No interview insights
  // available."). Auto-advance past it once, the first time we learn there's
  // nothing to pick — never again after that, so an explicit "Back" to
  // Insights later is respected. Source-anchored opens (Interview hub with a
  // real seeded basket, or any org that actually has insights) are
  // unaffected — the step still shows normally.
  const autoSkippedEmptyInsightsRef = useRef(false);

  const t = useMemo(() => WIZARD_COPY[language] ?? WIZARD_COPY.pl, [language]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedProjectId(projectId?.trim() || '');
  }, [isOpen, language, projectId]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) || candidates[0],
    [candidates, selectedCandidateId]
  );

  const actionableCandidates = candidates.filter((candidate) =>
    ['accepted_for_shortlist', 'ready_for_charter'].includes(candidate.triageStatus)
  );

  // #29b — aggregate selection summary for Step 0.
  const selectedInsightSummary = useMemo(() => {
    const chosen = insights.filter((insight) => selectedInsightIds.includes(insight.id));
    const findings = chosen.reduce((sum, insight) => sum + countInsightFindings(insight), 0);
    return { count: chosen.length, findings };
  }, [insights, selectedInsightIds]);

  // #29f — candidates the user has chosen to materialize (defaults to all
  // actionable candidates the first time the governance step is reached).
  const candidatesToCreate = useMemo(
    () =>
      actionableCandidates.filter(
        (candidate) =>
          !candidate.linkedInitiativeId &&
          !resolvedExisting[candidate.id] &&
          selectedCreateIds.includes(candidate.id)
      ),
    [actionableCandidates, selectedCreateIds, resolvedExisting]
  );
  const overSoftLimit = candidatesToCreate.length > 3;

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
            language === 'pl'
              ? 'Confidence ze zrodla "contradicted" - rozstrzygnij sprzeczne obserwacje przed promote.'
              : 'Source confidence is "contradicted" - resolve conflicting findings before promote.',
        });
        continue;
      }
      if (candidate.triageStatus === 'needs_evidence') {
        blockers.push({
          candidateId: candidate.id,
          title: candidate.title,
          reason: 'needs_evidence_status',
          message:
            language === 'pl'
              ? 'Kandydat oznaczony jako "Brak evidence" - uzupelnij evidence przed utworzeniem draftu.'
              : 'Candidate flagged "Needs evidence" - add evidence before creating a draft.',
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
          message:
            language === 'pl'
              ? 'Kandydat ma sourceRefs ale brak evidenceRefs - zlamana lineage do zrodla.'
              : 'Candidate has sourceRefs but no evidenceRefs - broken lineage to the source.',
        });
      }
    }
    return blockers;
  }, [actionableCandidates, language]);

  const shortlistGateOk = shortlistGateBlockers.length === 0;

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      autoSkippedEmptyInsightsRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setStep('insights');
    setMode(initialMode);
    setTargetCount(initialTargetCount);
    setTimeHorizon(initialTimeHorizon);
    setRiskAppetite(initialRiskAppetite);
    setBusinessPriorities(initialBusinessPriorities);
    setManualNotes(initialManualNotes);
    setSessionId(null);
    setSessionProjectId(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setSimilarityByCandidate({});
    setCreatedInitiatives([]);
    setAuditEvents([]);
    setAuditError(null);
    setAuditLoading(false);
    setSelectedInsightIds([]);
    setCapacity(null);
    setSelectedCreateIds([]);
    setCreateProgress(null);
    setCoreFields({ ...EMPTY_CORE });
    setCorePrefilled({ problem: false, solution: false, scope: false, kpi: false });
    setCoreTouched(false);
    setAiFillingField(null);
    setSimilarResolutions({});
    setResolvedExisting({});
    setResolvingCandidateId(null);
  }, [
    initialBusinessPriorities,
    initialManualNotes,
    initialMode,
    initialRiskAppetite,
    initialTargetCount,
    initialTimeHorizon,
    isOpen,
  ]);

  // #29b — load interview insights for Step 0 when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadInsights = async () => {
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        const response = await V8InterviewApi.listInsights().catch(() =>
          Api.get('/interview/insights')
        );
        const list = Array.isArray(response?.insights)
          ? (response.insights as V8InterviewInsight[])
          : Array.isArray(response)
            ? (response as V8InterviewInsight[])
            : [];
        if (!cancelled) setInsights(list);
      } catch (error) {
        console.error('[InitiativeWizardModal] Failed to load insights:', error);
        if (!cancelled) {
          setInsights([]);
          setInsightsError(t.insightsError);
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    };
    void loadInsights();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // #75 — once insight loading settles, skip the (optional) insights step
  // when there's genuinely nothing to pick and no source was seeded. See
  // autoSkippedEmptyInsightsRef comment above for the full rationale. This
  // never fires twice per open, and never fires once insights/basket exist.
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'insights') return;
    if (insightsLoading) return;
    if (autoSkippedEmptyInsightsRef.current) return;
    if (insights.length > 0) return;
    if (selectedInsightIds.length > 0) return;
    if (initialSourceBasket.length > 0) return;
    autoSkippedEmptyInsightsRef.current = true;
    setStep('intent');
  }, [isOpen, step, insightsLoading, insights, selectedInsightIds, initialSourceBasket]);

  // #29c — fetch the capacity / overload signal when entering the Intent step.
  // Defaults the count field to the suggested number unless the user has
  // already touched it (we only apply on the first successful fetch).
  const capacityFetchedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      capacityFetchedRef.current = false;
      return;
    }
    if (step !== 'intent' || capacityFetchedRef.current) return;
    capacityFetchedRef.current = true;
    let cancelled = false;
    const loadCapacity = async () => {
      try {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
        const response = await Api.get(`/initiatives/capacity${query}`);
        if (cancelled || !response) return;
        const signal: CapacitySignal = {
          activeCount: Number(response.activeCount ?? 0),
          suggestedCount: Number(response.suggestedCount ?? initialTargetCount),
          overload: (response.overload as CapacitySignal['overload']) ?? 'green',
        };
        setCapacity(signal);
        if (Number.isFinite(signal.suggestedCount) && signal.suggestedCount > 0) {
          setTargetCount(signal.suggestedCount);
        }
      } catch (error) {
        console.warn('[InitiativeWizardModal] Failed to load capacity signal:', error);
      }
    };
    void loadCapacity();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, projectId]);

  // #29f — default the bulk-create selection to every actionable, non-linked
  // candidate, but keep it in sync as candidates are (re)triaged. We only ever
  // narrow to currently-actionable ids so stale selections can't leak through.
  useEffect(() => {
    const actionableIds = candidates
      .filter(
        (candidate) =>
          ['accepted_for_shortlist', 'ready_for_charter'].includes(candidate.triageStatus) &&
          !candidate.linkedInitiativeId
      )
      .map((candidate) => candidate.id);
    setSelectedCreateIds((prev) => {
      const kept = prev.filter((id) => actionableIds.includes(id));
      // Newly-actionable candidates default to selected.
      const additions = actionableIds.filter((id) => !prev.includes(id));
      // If nothing was ever selected, select all actionable by default.
      if (prev.length === 0) return actionableIds;
      return [...kept, ...additions];
    });
  }, [candidates]);

  // #29h — progressively fill the CORE fields from the first selected insight.
  // We only auto-fill until the user manually edits a field (coreTouched), so we
  // never clobber human edits. Re-runs as the insight selection changes.
  const firstSelectedInsight = useMemo(
    () => insights.find((insight) => insight.id === selectedInsightIds[0]),
    [insights, selectedInsightIds]
  );
  useEffect(() => {
    if (coreTouched) return;
    const { fields, prefilled } = deriveCoreFromInsight(firstSelectedInsight);
    setCoreFields(fields);
    setCorePrefilled(prefilled);
  }, [firstSelectedInsight, coreTouched]);

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
            language === 'pl'
              ? 'Nie udalo sie pobrac sladu audytu sesji. Inicjatywy zostaly utworzone, ale timeline jest niedostepny.'
              : 'Failed to load the session audit trail. The initiatives were created, but the timeline is unavailable.'
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
  }, [step, sessionId, language]);

  if (!isOpen) return null;

  const togglePriority = (priority: string) => {
    setBusinessPriorities((prev) =>
      prev.includes(priority) ? prev.filter((item) => item !== priority) : [...prev, priority]
    );
  };

  // Audit #29d: after candidates are generated, ask the backend whether any
  // already-existing active initiative duplicates / closely resembles each one.
  // Best-effort and non-blocking — failures leave the wizard fully usable.
  const runSimilarityCheck = async (generated: WizardCandidate[]) => {
    const payloadCandidates = generated.map((candidate) => ({
      title: candidate.title || '',
      description: [candidate.problemStatement, candidate.opportunityStatement]
        .filter(Boolean)
        .join(' '),
    }));
    if (payloadCandidates.length === 0) {
      setSimilarityByCandidate({});
      return;
    }
    try {
      const response: SimilarityCheckResponse = await Api.post('/initiatives/similarity-check', {
        projectId: sessionProjectId || selectedProjectId,
        candidates: payloadCandidates,
      });
      const results = Array.isArray(response?.results) ? response.results : [];
      const mapped: Record<string, SimilarityCandidateResult> = {};
      for (const result of results) {
        const candidate = generated[result.candidateIndex];
        if (candidate) mapped[candidate.id] = result;
      }
      setSimilarityByCandidate(mapped);
    } catch (error) {
      console.error('[InitiativeWizardModal] Similarity check failed:', error);
      setSimilarityByCandidate({});
    }
  };

  const startWizard = async () => {
    if (!selectedProjectId) {
      toast.error(
        language === 'pl'
          ? 'Wybierz projekt przed wygenerowaniem kandydatów.'
          : 'Select a project before generating candidates.'
      );
      return;
    }
    setIsWorking(true);
    try {
      // #29b — selected insights become the evidence sourceBasket so the backend
      // generates candidates from them (1:N lineage carried through).
      const insightSources = selectedInsightIds.map((id) => {
        const insight = insights.find((item) => item.id === id);
        return {
          type: 'interview_insight',
          id,
          label: insight?.title || 'Interview insight',
        };
      });
      const sourceBasket =
        insightSources.length > 0
          ? insightSources
          : initialSourceBasket.length > 0
            ? initialSourceBasket
            : [{ type: 'manual_note', label: 'Consultant wizard input' }];
      const sessionResponse = await Api.post('/initiatives/wizard/sessions', {
        projectId: selectedProjectId,
        mode,
        businessPriorities,
        targetCount,
        timeHorizon,
        riskAppetite,
        manualNotes,
        sourceBasket,
      });
      const nextSessionId = sessionResponse?.session?.id;
      if (!nextSessionId) throw new Error('Wizard session was not created');
      setSessionId(nextSessionId);
      setSessionProjectId(selectedProjectId);

      const candidateResponse = await Api.post(
        `/initiatives/wizard/sessions/${nextSessionId}/candidates/generate`,
        {}
      );
      const nextCandidates = candidateResponse?.candidates || [];
      setCandidates(nextCandidates);
      setSelectedCandidateId(nextCandidates[0]?.id || null);
      setStep('candidates');
      toast.success(
        language === 'pl'
          ? 'Kandydaci inicjatyw sa gotowi do triage.'
          : 'Initiative candidates are ready to triage.',
        { duration: 1800 }
      );
      void runSimilarityCheck(nextCandidates);
    } catch (error) {
      console.error('[InitiativeWizardModal] Failed to start wizard:', error);
      toast.error(
        language === 'pl'
          ? 'Nie udalo sie uruchomic kreatora inicjatyw.'
          : 'Failed to start the initiative wizard.'
      );
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
      const label = STATUS_LABELS[triageStatus]?.[language] || triageStatus;
      toast.success(
        language === 'pl' ? `Decyzja zapisana: ${label}.` : `Decision saved: ${label}.`,
        { duration: 1500 }
      );
    } catch (error) {
      console.error('[InitiativeWizardModal] Candidate triage failed:', error);
      toast.error(
        language === 'pl'
          ? 'Nie udalo sie zapisac decyzji dla kandydata.'
          : 'Failed to save the candidate decision.'
      );
    } finally {
      setIsWorking(false);
    }
  };

  const createDrafts = async () => {
    if (!sessionId) return;
    if (!sessionProjectId) {
      toast.error(
        language === 'pl'
          ? 'Wybierz projekt przed utworzeniem draftów.'
          : 'Select a project before creating drafts.'
      );
      return;
    }
    if (!shortlistGateOk) {
      const firstBlocker = shortlistGateBlockers[0];
      toast.error(
        language === 'pl'
          ? `Nie mozna utworzyc draftow: ${firstBlocker?.message || 'wymagane evidence'}.`
          : `Cannot create drafts: ${firstBlocker?.message || 'evidence required'}.`,
        { duration: 4000 }
      );
      return;
    }
    // #29f — only materialize the candidates the user explicitly selected
    // (soft limit of 1-3 is a warning, never a hard block).
    const toCreate = candidatesToCreate;
    if (toCreate.length === 0) {
      setStep('result');
      return;
    }

    setIsWorking(true);
    setCreateProgress({ done: 0, total: toCreate.length });
    const created: PortfolioInitiative[] = [];
    // #29h — the reviewed CORE fields (rdzeń) represent the user's edited /
    // AI-assisted core for the initiative built from the first selected insight.
    // Apply them to the candidate anchored to that insight, or — when a single
    // candidate is being created — to that candidate. Other candidates keep
    // their own generated fields.
    const firstInsightId = selectedInsightIds[0] || null;
    const coreTargetId =
      toCreate.find((candidate) => extractCandidateAnchoredSource(candidate)?.id === firstInsightId)
        ?.id || (toCreate.length === 1 ? toCreate[0]?.id : null);
    const hasCoreOverrides =
      coreFields.problem.trim() !== '' ||
      coreFields.solution.trim() !== '' ||
      coreFields.scope.trim() !== '' ||
      coreFields.kpi.trim() !== '';
    try {
      for (const candidate of toCreate) {
        const applyCore = hasCoreOverrides && candidate.id === coreTargetId;
        const anchored = extractCandidateAnchoredSource(candidate);
        // #29b — 1:N insight → initiative lineage: prefer a candidate-anchored
        // source, then the first selected insight, then the wizard fallbacks.
        const firstSelectedInsightId = selectedInsightIds[0] || null;
        const candidateSourceType =
          anchored?.type || (firstSelectedInsightId ? 'interview_insight' : creationSourceType);
        const candidateSourceId =
          anchored?.id || firstSelectedInsightId || creationSourceId || sessionId;
        // All selected insight ids ride along as evidence refs (1:N), merged
        // with whatever evidence the candidate already carries.
        const insightEvidenceRefs = selectedInsightIds.map((id) => `interview_insight:${id}`);
        const mergedEvidenceRefs = Array.from(
          new Set([...(candidate.evidenceRefs || []), ...insightEvidenceRefs])
        );
        const result = await createInitiativeWriteTruth({
          projectId: sessionProjectId,
          title: candidate.title,
          summary:
            applyCore && coreFields.solution.trim()
              ? coreFields.solution.trim()
              : candidate.opportunityStatement,
          description:
            applyCore && coreFields.scope.trim()
              ? [candidate.rationale, `Scope: ${coreFields.scope.trim()}`]
                  .filter(Boolean)
                  .join('\n\n')
              : candidate.rationale,
          problemStatement:
            applyCore && coreFields.problem.trim()
              ? coreFields.problem.trim()
              : candidate.problemStatement,
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
            selectedInsightIds,
            limits: candidate.limits,
          },
          actionContract: {
            target: 'initiative',
            mode,
            proposalOnly: true,
            approvedCandidateStatus: candidate.triageStatus,
          },
          evidenceRefs: mergedEvidenceRefs,
          tags: ['initiative-wizard', candidate.initiativeLevel],
          successCriteria:
            applyCore && coreFields.kpi.trim()
              ? [coreFields.kpi.trim()]
              : candidate.suggestedKpi
                ? [candidate.suggestedKpi]
                : [],
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
        setCreateProgress((prev) =>
          prev ? { done: prev.done + 1, total: prev.total } : { done: 1, total: toCreate.length }
        );
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
      const names = created
        .map((initiative) => initiative.name || initiative.id)
        .slice(0, 3)
        .join(', ');
      const suffix = created.length > 3 ? '…' : '';
      toast.success(
        language === 'pl'
          ? `Utworzono ${created.length} inicjatyw (DRAFT): ${names}${suffix}`
          : `Created ${created.length} initiatives (DRAFT): ${names}${suffix}`,
        { duration: 2600 }
      );
    } catch (error) {
      console.error('[InitiativeWizardModal] Draft creation failed:', error);
      toast.error(
        language === 'pl'
          ? 'Nie udalo sie utworzyc draftow inicjatyw.'
          : 'Failed to create the initiative drafts.'
      );
    } finally {
      setIsWorking(false);
      setCreateProgress(null);
    }
  };

  const toggleInsight = (id: string) => {
    setSelectedInsightIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // #29h — manual edit of a CORE field. Marks the section as user-authored so
  // the auto-fill effect stops overwriting it.
  const setCoreField = (key: CoreFieldKey, value: string) => {
    setCoreTouched(true);
    setCoreFields((prev) => ({ ...prev, [key]: value }));
    setCorePrefilled((prev) => ({ ...prev, [key]: false }));
  };

  // #29h — "Fill with AI" for a single CORE section. Wires the existing
  // POST /initiatives/generate-section endpoint (initiativeId optional, so it
  // works pre-creation). Honest degrade: a 503 / FEATURE_UNAVAILABLE surfaces an
  // "AI not configured" toast and leaves the field untouched.
  const fillFieldWithAi = async (key: CoreFieldKey) => {
    const def = CORE_FIELD_DEFS.find((entry) => entry.key === key);
    if (!def || aiFillingField) return;
    setAiFillingField(key);
    try {
      const initiativeName =
        coreFields.problem.split('\n')[0]?.slice(0, 120) ||
        firstSelectedInsight?.title ||
        manualNotes.slice(0, 120) ||
        'Initiative';
      const response = await Api.post('/initiatives/generate-section', {
        sectionKey: def.sectionKey,
        initiativeName,
        summary: coreFields.solution || firstSelectedInsight?.executiveSummary || manualNotes,
        problemStatement: coreFields.problem,
        scope: coreFields.scope,
        kpis: coreFields.kpi,
        language,
      });
      const content =
        typeof response?.content === 'string'
          ? response.content.trim()
          : typeof response?.parsedContent === 'string'
            ? String(response.parsedContent).trim()
            : '';
      // The backend returns a clearly-marked placeholder string when the LLM is
      // not configured — treat that as "unavailable" instead of pasting it.
      const isPlaceholder = /placeholder/i.test(content) || content.length === 0;
      if (isPlaceholder) {
        toast(t.aiUnavailable, { duration: 3200, icon: 'ℹ️' });
        return;
      }
      setCoreFields((prev) => ({ ...prev, [key]: content }));
      setCorePrefilled((prev) => ({ ...prev, [key]: false }));
      setCoreTouched(true);
      toast.success(t.aiFilled, { duration: 1600 });
    } catch (error) {
      const status = Number(
        (error as { status?: number; statusCode?: number })?.status ??
          (error as { statusCode?: number })?.statusCode ??
          0
      );
      if (status === 503) {
        toast(t.aiUnavailable, { duration: 3200, icon: 'ℹ️' });
      } else {
        console.error('[InitiativeWizardModal] Fill-with-AI failed:', error);
        toast.error(t.aiFailed);
      }
    } finally {
      setAiFillingField(null);
    }
  };

  // #29e — collect the source insight ids that should be attached to the
  // existing initiative when merging/extending. Prefer the candidate's anchored
  // interview insight; fall back to the insights selected in Step 0.
  const collectCandidateInsightIds = (candidate: WizardCandidate): string[] => {
    const ids: string[] = [];
    const anchored = extractCandidateAnchoredSource(candidate);
    if (anchored && anchored.type === 'interview_insight' && anchored.id) {
      ids.push(anchored.id);
    }
    for (const id of selectedInsightIds) {
      if (id) ids.push(id);
    }
    return Array.from(new Set(ids));
  };

  // #29e — record the user's resolution choice for a SIMILAR / DUPLICATE
  // candidate. "create_anyway" keeps the candidate in the create-shortlist;
  // "merge" / "extend" call the REAL backend endpoint to additively fold the
  // candidate's insight(s) + scope into the existing top-matched initiative,
  // then drop the candidate from the shortlist (it is no longer newly created).
  const setSimilarResolution = async (
    candidateId: string,
    resolution: SimilarResolution
  ): Promise<void> => {
    setSimilarResolutions((prev) => ({ ...prev, [candidateId]: resolution }));

    if (resolution === 'create_anyway') {
      toast(t.createAnywayPicked, { duration: 1800 });
      return;
    }

    const candidate = candidates.find((item) => item.id === candidateId);
    const topMatch = candidate ? similarTopMatch(candidate) : null;
    if (!candidate || !topMatch) {
      toast.error(t.mergeExtendFailed, { duration: 3200 });
      return;
    }

    const insightIds = collectCandidateInsightIds(candidate);
    const summary = [
      candidate.problemStatement,
      candidate.opportunityStatement,
      candidate.rationale,
    ]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join('\n');
    const scopeText =
      resolution === 'extend'
        ? [candidate.opportunityStatement, candidate.rationale]
            .map((part) => (part || '').trim())
            .filter(Boolean)
            .join('\n')
        : undefined;

    const endpoint =
      resolution === 'merge'
        ? `/initiatives/${topMatch.id}/merge-from-insight`
        : `/initiatives/${topMatch.id}/extend-from-insight`;

    setResolvingCandidateId(candidateId);
    const loadingId = toast.loading(resolution === 'merge' ? t.mergeWorking : t.extendWorking);
    try {
      await Api.post(endpoint, {
        mode: resolution,
        sourceInsightIds: insightIds,
        summary: summary || candidate.title,
        scopeText,
      });
      toast.dismiss(loadingId);
      toast.success(resolution === 'merge' ? t.mergeDone : t.extendDone, { duration: 2600 });
      setResolvedExisting((prev) => ({
        ...prev,
        [candidateId]: { mode: resolution, initiativeId: topMatch.id, title: topMatch.title },
      }));
      // Drop the candidate from the create-shortlist — it has been folded into
      // an existing initiative, not newly created.
      setSelectedCreateIds((prev) => prev.filter((id) => id !== candidateId));
    } catch (error) {
      toast.dismiss(loadingId);
      console.error('[InitiativeWizardModal] merge/extend failed:', error);
      toast.error(t.mergeExtendFailed, { duration: 3200 });
    } finally {
      setResolvingCandidateId(null);
    }
  };

  // #29e — the existing top match (in the live portfolio) for a candidate, used
  // to surface a deep link to the existing initiative.
  const similarTopMatch = (candidate: WizardCandidate): SimilarityMatch | null => {
    const similarity = similarityByCandidate[candidate.id];
    if (
      similarity &&
      (similarity.verdict === 'similar' || similarity.verdict === 'duplicate') &&
      similarity.matches[0]
    ) {
      return similarity.matches[0];
    }
    return null;
  };

  // #29b — Step 0: multi-select interview insights the initiatives derive from.
  const renderInsights = () => (
    <div className="flex min-h-[440px] flex-col space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t.selectInsightsTitle}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.selectInsightsHint}</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-c-info/30 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-c-info/20 dark:bg-white/[0.05] dark:text-slate-200">
        <span className="font-medium">
          {t.selectedSummary}: {selectedInsightSummary.count} · {selectedInsightSummary.findings}{' '}
          {t.findings}
        </span>
        {selectedInsightSummary.count === 0 && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.none}</span>
        )}
      </div>

      <div className="flex-1 space-y-1.5 overflow-auto pr-1">
        {insightsLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.insightsLoading}
          </div>
        )}
        {!insightsLoading && insightsError && (
          <div className="rounded-xl border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-800 dark:border-danger-400/30 dark:bg-danger-500/10 dark:text-danger-100">
            {insightsError}
          </div>
        )}
        {!insightsLoading && !insightsError && insights.length === 0 && (
          <div
            data-testid="initiative-wizard-empty-insights"
            className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/[0.1] dark:bg-navy-900/50"
          >
            <Sparkles className="h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.insightsEmpty}
            </p>
          </div>
        )}
        {!insightsLoading &&
          !insightsError &&
          insights.map((insight) => {
            const checked = selectedInsightIds.includes(insight.id);
            const findings = countInsightFindings(insight);
            return (
              <button
                key={insight.id}
                type="button"
                onClick={() => toggleInsight(insight.id)}
                aria-pressed={checked}
                className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                  checked
                    ? 'border-c-info/50 bg-slate-100 dark:bg-white/[0.08]'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-[var(--c-info)] bg-[var(--c-info)] text-white'
                      : 'border-slate-300 bg-white dark:border-white/[0.2] dark:bg-navy-900'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {insight.title}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 dark:bg-white/[0.08]">
                      {insight.promptType || insight.analysisMode || 'insight'}
                    </span>
                    <span>·</span>
                    <span>
                      {findings} {t.findings}
                    </span>
                    {insight.createdAt && (
                      <>
                        <span>·</span>
                        <span>{formatInsightDate(insight.createdAt, language)}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );

  // #29h — progressive-fill CORE panel. Shown in the Intent step once at least
  // one insight is selected, so the user reviews the auto-filled rdzeń and can
  // fill empty sections with AI before generating candidates.
  const renderCorePanel = () => {
    if (selectedInsightIds.length === 0) return null;
    return (
      <div
        data-testid="initiative-wizard-core-panel"
        className="rounded-2xl border border-c-info/30 bg-slate-50 p-3 dark:border-c-info/20 dark:bg-white/[0.05]"
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--c-info)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t.coreTitle}
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t.coreHint}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {CORE_FIELD_DEFS.map((def) => {
            const value = coreFields[def.key];
            const isEmpty = value.trim().length === 0;
            const isPrefilled = corePrefilled[def.key];
            const isFilling = aiFillingField === def.key;
            return (
              <div key={def.key} className="flex flex-col">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t[def.labelKey]}
                    {isPrefilled && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        {t.prefilledFromInsight}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    data-testid={`initiative-wizard-ai-fill-${def.key}`}
                    onClick={() => void fillFieldWithAi(def.key)}
                    disabled={aiFillingField !== null}
                    title={t.fillWithAi}
                    className="inline-flex items-center gap-1 rounded-lg border border-c-info/40 bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--c-info)] transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-c-info/30 dark:bg-navy-900/60 dark:hover:bg-white/[0.08]"
                  >
                    {isFilling ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    {isFilling ? t.aiFilling : t.fillWithAi}
                  </button>
                </div>
                <textarea
                  value={value}
                  onChange={(event) => setCoreField(def.key, event.target.value)}
                  rows={def.rows}
                  placeholder={isEmpty ? `${t[def.labelKey]}…` : undefined}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 transition-all focus:border-[var(--c-info)] focus:ring-1 focus:ring-c-info/30 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderIntent = () => (
    <div className="space-y-3">
      {renderCorePanel()}
      <RequiredProjectPicker
        value={selectedProjectId}
        onChange={setSelectedProjectId}
        disabled={Boolean(sessionId)}
        language={language}
      />
      {/* #29c — capacity / overload signal */}
      {capacity && (
        <div
          data-testid="initiative-wizard-capacity"
          className={`rounded-xl border px-3 py-2 text-xs ${
            capacity.overload === 'red'
              ? 'border-danger-300 bg-danger-50 text-danger-900 dark:border-danger-400/30 dark:bg-danger-500/10 dark:text-danger-100'
              : capacity.overload === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100'
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {capacity.overload !== 'green' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            {t.capacityPrefix} {capacity.activeCount} {t.capacityActive} — {t.capacitySuggested}:{' '}
            {capacity.suggestedCount}
          </div>
          {capacity.overload === 'amber' && (
            <div className="mt-1 text-[11px]">{t.capacityOverloadAmber}</div>
          )}
          {capacity.overload === 'red' && (
            <div className="mt-1 text-[11px]">{t.capacityOverloadRed}</div>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {t.transformDecision}
        </label>
        <Select
          value={mode}
          onChange={setMode}
          aria-label={t.transformDecision}
          options={[
            { value: 'create_first_portfolio', label: t.modeCreateFirstPortfolio },
            { value: 'generate_from_evidence', label: t.modeGenerateFromEvidence },
            { value: 'prioritize_by_goal', label: t.modePrioritizeByGoal },
            { value: 'match_existing', label: t.modeMatchExisting },
            { value: 'refresh_portfolio', label: t.modeRefreshPortfolio },
            { value: 'build_waves', label: t.modeBuildWaves },
            { value: 'improve_portfolio', label: t.modeImprovePortfolio },
          ]}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {t.businessPriorities}
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
                    ? 'border-c-info/50 bg-slate-100 text-[var(--c-info)] dark:bg-white/[0.08] dark:text-[var(--c-info)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-c-info/40 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-300'
                }`}
              >
                {priority.label[language]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t.countLabel}
          <input
            type="number"
            min={1}
            max={10}
            value={targetCount}
            onChange={(event) => setTargetCount(Number(event.target.value))}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-[var(--c-info)] focus:ring-1 focus:ring-c-info/30 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
          />
        </label>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t.horizonLabel}
          <div className="mt-1.5">
            <Select
              value={timeHorizon}
              onChange={setTimeHorizon}
              aria-label={t.horizonLabel}
              options={[
                { value: '30_days', label: t.horizon30Days },
                { value: '90_days', label: t.horizon90Days },
                { value: '6_months', label: t.horizon6Months },
                { value: '12_months', label: t.horizon12Months },
              ]}
            />
          </div>
        </div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t.riskLabel}
          <div className="mt-1.5">
            <Select
              value={riskAppetite}
              onChange={setRiskAppetite}
              aria-label={t.riskLabel}
              options={[
                { value: 'conservative', label: t.riskConservative },
                { value: 'balanced', label: t.riskBalanced },
                { value: 'bold', label: t.riskBold },
              ]}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {t.consultantNote}
        </label>
        <textarea
          value={manualNotes}
          onChange={(event) => setManualNotes(event.target.value)}
          rows={4}
          placeholder={t.consultantNotePlaceholder}
          className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 transition-all focus:border-[var(--c-info)] focus:ring-1 focus:ring-c-info/30 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>
    </div>
  );

  // Audit #29d: render the duplicate/similarity verdict chip for a candidate.
  const renderSimilarityChip = (candidate: WizardCandidate) => {
    const similarity = similarityByCandidate[candidate.id];
    if (!similarity) return null;
    const config = SIMILARITY_CHIP_CONFIG[similarity.verdict];
    const topMatch = similarity.matches[0];
    const showTopMatch =
      (similarity.verdict === 'similar' || similarity.verdict === 'duplicate') && topMatch;
    return (
      <div className="mt-1.5 space-y-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}
        >
          {config.label[language]}
        </span>
        {showTopMatch && (
          <div className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-300">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
            <span className="min-w-0">
              {SIMILARITY_HINT[language]} — {SIMILARITY_TOP_MATCH_LABEL[language]}:{' '}
              <span className="font-medium">{topMatch.title}</span>
              {topMatch.status ? ` (${topMatch.status})` : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  // #29e — Merge / Extend / Create-anyway choice for a SIMILAR / DUPLICATE
  // candidate. Surfaces a deep link to the existing initiative so the user can
  // open it. merge / extend call the real backend endpoints (additive, non-
  // destructive) and drop the candidate from the create-shortlist; create-anyway
  // wires to the existing create path (the candidate stays in the shortlist).
  const renderSimilarResolution = (candidate: WizardCandidate) => {
    const topMatch = similarTopMatch(candidate);
    if (!topMatch) return null;
    const chosen = similarResolutions[candidate.id];
    const resolved = resolvedExisting[candidate.id];
    const resolving = resolvingCandidateId === candidate.id;
    const options: Array<{ value: SimilarResolution; label: string; icon: typeof GitMerge }> = [
      { value: 'merge', label: t.mergeOption, icon: GitMerge },
      { value: 'extend', label: t.extendOption, icon: Plus },
      { value: 'create_anyway', label: t.createAnywayOption, icon: Check },
    ];
    return (
      <div
        data-testid="initiative-wizard-similar-resolution"
        className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-400/30 dark:bg-amber-500/10"
      >
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
              {t.similarChoiceTitle}
            </div>
            <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-100/70">
              {t.similarChoiceHint}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          <span className="truncate font-medium">{topMatch.title}</span>
          {topMatch.status ? (
            <span className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] dark:bg-amber-500/20">
              {topMatch.status}
            </span>
          ) : null}
          <a
            href={`/initiatives/${topMatch.id}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="initiative-wizard-open-existing"
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-400 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-400/40 dark:bg-navy-900/60 dark:text-amber-200 dark:hover:bg-amber-500/10"
          >
            <ExternalLink className="h-3 w-3" />
            {t.openExisting}
          </a>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          {options.map((option) => {
            const Icon = option.icon;
            const active = chosen === option.value;
            const disabled = resolving || Boolean(resolved);
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                data-testid={`initiative-wizard-resolution-${option.value}`}
                onClick={() => {
                  void setSimilarResolution(candidate.id, option.value);
                }}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-[var(--c-info)] bg-slate-100 text-[var(--c-info)] dark:border-c-info/40 dark:bg-white/[0.08] dark:text-[var(--c-info)]'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-c-info/50 dark:border-white/[0.12] dark:bg-navy-900/60 dark:text-slate-200'
                }`}
              >
                {resolving && active ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
        {resolved && (
          <div
            data-testid="initiative-wizard-resolution-success"
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {resolved.mode === 'merge' ? t.mergedBadge : t.extendedBadge}: {resolved.title}
            </span>
            <a
              href={`/initiatives/${resolved.initiativeId}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="initiative-wizard-open-resolved"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-400 bg-white px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-navy-900/60 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
            >
              <ExternalLink className="h-3 w-3" />
              {t.openExisting}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderCandidates = () => (
    <div className="grid min-h-[440px] grid-cols-[minmax(0,1fr)_360px] gap-3">
      <div className="space-y-1.5 overflow-auto pr-1">
        {candidates.length === 0 && (
          <div
            data-testid="initiative-wizard-empty-candidates"
            className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/[0.1] dark:bg-navy-900/50"
          >
            <Sparkles className="h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.noCandidatesTitle}
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">{t.noCandidatesHint}</p>
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
                  ? 'border-c-info/50 bg-slate-100 dark:bg-white/[0.08]'
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
                  {STATUS_LABELS[candidate.triageStatus]?.[language] ?? candidate.triageStatus}
                </span>
              </div>
              {renderSimilarityChip(candidate)}
              {!similarityByCandidate[candidate.id] && match && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  {t.similarInitiative}: {match.name || match.title}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCandidate && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-navy-900/50">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t.candidateDetails}
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
            <div className="mt-2.5 rounded-xl border border-c-info/30 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:border-c-info/20 dark:bg-white/[0.05] dark:text-slate-200">
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
                            className="mr-1 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"
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
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-danger-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-danger-500"
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
              className="rounded-xl border border-c-info/40 bg-white px-3 py-2 text-xs font-medium text-[var(--c-info)] transition-colors hover:bg-slate-50 dark:border-c-info/30 dark:bg-navy-900/50 dark:hover:bg-white/[0.05]"
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
              className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-c-info/40 bg-white px-3 py-2 text-xs font-medium text-[var(--c-info)] transition-colors hover:bg-slate-50 dark:border-c-info/30 dark:bg-navy-900/50 dark:hover:bg-white/[0.05]"
            >
              <Link2 className="h-3 w-3" />
              {t.linkAlreadyCovered}
            </button>
          )}

          {/* #29e — merge / extend / create-anyway for SIMILAR / DUPLICATE */}
          {renderSimilarResolution(selectedCandidate)}
        </div>
      )}
    </div>
  );

  const toggleCreate = (id: string) => {
    setSelectedCreateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderGovernance = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-c-info/30 bg-slate-50 p-3 text-sm text-slate-800 dark:border-c-info/20 dark:bg-white/[0.05] dark:text-slate-100">
        <div className="font-medium">{t.bulkSelectTitle}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.bulkSelectHint}</div>
      </div>
      {/* #29f — soft 1-3 limit (warning only, never a hard block) */}
      {overSoftLimit && (
        <div
          data-testid="initiative-wizard-soft-limit"
          className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t.bulkSoftLimit.replace('{n}', String(candidatesToCreate.length))}</span>
        </div>
      )}
      {!shortlistGateOk && (
        <div
          data-testid="initiative-wizard-shortlist-gate-blocked"
          className="rounded-2xl border border-danger-300 bg-danger-50 p-3 text-sm text-danger-900 dark:border-danger-400/30 dark:bg-danger-500/10 dark:text-danger-100"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t.shortlistGateBlockedTitle}
          </div>
          <p className="mt-1 text-xs text-danger-800 dark:text-danger-100/80">
            {t.shortlistGateBlockedBody}
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
          const resolved = resolvedExisting[candidate.id];
          // #29f — only non-linked, non-blocked, non-merged/extended candidates are
          // creatable and get a selection checkbox. Linked / blocked / resolved
          // rows stay informational.
          const creatable = !candidate.linkedInitiativeId && !blocker && !resolved;
          const checked = selectedCreateIds.includes(candidate.id);
          return (
            <div
              key={candidate.id}
              className={`rounded-xl border p-2.5 transition-all ${
                blocker
                  ? 'border-danger-300 bg-danger-50/60 dark:border-danger-400/30 dark:bg-danger-500/10'
                  : 'border-slate-200 bg-white dark:border-white/[0.08] dark:bg-navy-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                {creatable && (
                  <button
                    type="button"
                    onClick={() => toggleCreate(candidate.id)}
                    aria-pressed={checked}
                    data-testid="initiative-wizard-create-toggle"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? 'border-[var(--c-info)] bg-[var(--c-info)] text-white'
                        : 'border-slate-300 bg-white dark:border-white/[0.2] dark:bg-navy-900'
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {candidate.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {blocker
                      ? blocker.message
                      : resolved
                        ? resolved.mode === 'merge'
                          ? t.mergeDone
                          : t.extendDone
                        : candidate.linkedInitiativeId
                          ? t.willLinkExisting
                          : checked
                            ? t.willCreateDraft
                            : t.willBeSkipped}
                  </div>
                  {/* #29e — surface a resolved (merged/extended) badge with deep link */}
                  {resolved && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        <Check className="h-2.5 w-2.5" />
                        {resolved.mode === 'merge' ? t.mergedBadge : t.extendedBadge}
                      </span>
                      <a
                        href={`/initiatives/${resolved.initiativeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-1.5 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {t.openExisting}
                      </a>
                    </div>
                  )}
                  {/* #29e — show the chosen similar-resolution for context */}
                  {!resolved && similarTopMatch(candidate) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {similarResolutions[candidate.id] === 'create_anyway' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-white/[0.08] dark:text-slate-200">
                          <Check className="h-2.5 w-2.5" />
                          {t.createAnywayOption}
                        </span>
                      ) : similarResolutions[candidate.id] === 'merge' ||
                        similarResolutions[candidate.id] === 'extend' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          <GitMerge className="h-2.5 w-2.5" />
                          {similarResolutions[candidate.id] === 'merge'
                            ? t.mergeOption
                            : t.extendOption}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {t.similarChoiceTitle}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    blocker
                      ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-100'
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
          {t.wizardDone}
        </h3>
        <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          {language === 'pl'
            ? `Utworzone drafty: ${createdInitiatives.length}. Kandydaci odrzuceni lub oznaczeni jako pokryci nie zostali utworzeni jako nowe inicjatywy.`
            : `Drafts created: ${createdInitiatives.length}. Rejected or already-covered candidates were not created as new initiatives.`}
        </p>
      </div>

      {createdInitiatives.length > 0 && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100">
          <div className="text-[10px] font-semibold uppercase tracking-wide">
            {t.newDraftsLabel}
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
            {t.auditTimelineLabel}
          </div>
          {auditLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-600" />}
        </div>
        {auditError && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            {auditError}
          </div>
        )}
        {!auditLoading && !auditError && auditEvents.length === 0 && (
          <div className="mt-2 text-xs text-slate-500">{t.noAuditEvents}</div>
        )}
        {auditEvents.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {auditEvents.map((event) => {
              const meta = AUDIT_EVENT_LABELS[event.eventType] || {
                label: { pl: event.eventType, en: event.eventType },
                tone: 'info' as const,
              };
              const toneClasses =
                meta.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                  : meta.tone === 'block'
                    ? 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-400/30 dark:bg-danger-500/10 dark:text-danger-100'
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
                    <span className="font-semibold">{meta.label[language] ?? event.eventType}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatAuditTimestamp(event.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                    {describeAuditEvent(event, language)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <Button type="button" variant="primary" onClick={onClose} className="min-w-[180px]">
          {t.close}
        </Button>
      </div>
    </div>
  );

  // §5 wizard harmonization — map the bespoke step model onto the shared
  // <WizardStepper>. The ordered step ids drive index↔id translation; per-step
  // status mirrors the prior completed/active logic, and reachability (so users
  // can't skip ahead) is carried from the old stepReachable gate.
  const STEP_ORDER: WizardStep[] = ['insights', 'intent', 'candidates', 'governance', 'result'];
  const currentStepIndex = STEP_ORDER.indexOf(step);
  // Reachability gate (unchanged semantics): a step is reachable when its
  // prerequisite content exists. We collapse this to a single maxReachableIndex
  // (the highest contiguously-reachable step) so the shared stepper can gate
  // forward jumps while still allowing the user to step back freely.
  const stepReachable: Record<WizardStep, boolean> = {
    insights: true,
    intent: true,
    candidates: candidates.length > 0,
    governance: actionableCandidates.length > 0,
    result: createdInitiatives.length > 0,
  };
  const maxReachableIndex = (() => {
    let reach = currentStepIndex; // already-visited steps stay reachable
    for (let i = 0; i < STEP_ORDER.length; i += 1) {
      if (stepReachable[STEP_ORDER[i]]) reach = Math.max(reach, i);
      else break;
    }
    return reach;
  })();

  // Per-step status: a step before the active one (or whose downstream content
  // already exists) is 'complete'; the active/next reachable step is 'ready';
  // everything else is 'empty'. Mirrors the old isComplete/active styling.
  const stepStatusFor = (id: WizardStep, index: number): SharedWizardStep['status'] => {
    if (index < currentStepIndex) return 'complete';
    if (id === 'result' && createdInitiatives.length > 0) return 'complete';
    if (index === currentStepIndex) return 'ready';
    return index <= maxReachableIndex ? 'ready' : 'empty';
  };

  const stepperSteps: SharedWizardStep[] = [
    {
      id: 'insights',
      label: { pl: t.stepInsights, en: WIZARD_COPY.en.stepInsights },
      hint: {
        pl: 'Wybierz wnioski z wywiadów',
        en: 'Pick interview insights',
      },
      status: stepStatusFor('insights', 0),
      optional: true,
    },
    {
      id: 'intent',
      label: { pl: 'Intencja', en: 'Intent' },
      hint: { pl: 'Cel, priorytety, rdzeń', en: 'Goal, priorities, core' },
      status: stepStatusFor('intent', 1),
    },
    {
      id: 'candidates',
      label: { pl: 'Kandydaci', en: 'Candidates' },
      hint: { pl: 'Triage i podobieństwa', en: 'Triage & similarity' },
      status: stepStatusFor('candidates', 2),
    },
    {
      id: 'governance',
      label: { pl: 'Governance', en: 'Governance' },
      hint: { pl: 'Wybór i shortlist gate', en: 'Selection & shortlist gate' },
      status: stepStatusFor('governance', 3),
    },
    {
      id: 'result',
      label: { pl: 'Wynik', en: 'Result' },
      hint: { pl: 'Drafty i ślad audytu', en: 'Drafts & audit trail' },
      status: stepStatusFor('result', 4),
    },
  ];

  const handleStepperChange = (index: number) => {
    const target = STEP_ORDER[index];
    if (target && index <= maxReachableIndex) setStep(target);
  };

  const goToPreviousStep = () => {
    if (step === 'intent') setStep('insights');
    else if (step === 'candidates') setStep('intent');
    else if (step === 'governance') setStep('candidates');
  };

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
      data-testid="initiative-wizard-modal"
    >
      <div
        ref={wizardDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="initiative-wizard-title"
        tabIndex={-1}
        className="mx-4 flex h-[640px] w-[1080px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/[0.08] dark:bg-navy-900 outline-none"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
          <h2
            id="initiative-wizard-title"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            <Sparkles size={20} className="text-slate-500 dark:text-slate-400" />
            {t.wizardTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'pl' ? 'Zamknij' : 'Close'}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* §5 — shared stepper (managed violet accent) replaces the bespoke header */}
        <WizardStepper
          steps={stepperSteps}
          activeStepIndex={currentStepIndex}
          maxReachableIndex={maxReachableIndex}
          onStepChange={handleStepperChange}
          isPolish={language === 'pl'}
          // Managed accent for the INITIATIVE wizard (violet) — distinct from
          // insight (blue) and survey (emerald), same family. The hex is a
          // managed design token passed to the shared stepper's inline style.
          // eslint-disable-next-line no-restricted-syntax
          accentColor="#8b5cf6"
        />

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-3">
          {step === 'insights' && renderInsights()}
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
              {t.cancel}
            </button>

            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              {candidates.length > 0
                ? language === 'pl'
                  ? `${actionableCandidates.length} kandydatów w shortlist / ${candidates.length} łącznie`
                  : `${actionableCandidates.length} shortlisted / ${candidates.length} total`
                : t.setIntentHint}
              {step === 'governance' && actionableCandidates.length > 0 ? (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    shortlistGateOk
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-200'
                  }`}
                >
                  {shortlistGateOk
                    ? t.shortlistGateOk
                    : language === 'pl'
                      ? `Shortlist gate blokuje (${shortlistGateBlockers.length})`
                      : `Shortlist gate blocks (${shortlistGateBlockers.length})`}
                </span>
              ) : null}
            </div>

            {step !== 'insights' && (
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousStep}
                disabled={isWorking}
              >
                {t.back}
              </Button>
            )}

            {step === 'insights' && (
              <Button
                type="button"
                variant="primary"
                data-testid="initiative-wizard-insights-next"
                disabled={isWorking}
                onClick={() => setStep('intent')}
                className="min-w-[180px]"
              >
                {t.next}
                <ArrowRight size={16} />
              </Button>
            )}

            {step === 'intent' && (
              <Button
                type="button"
                variant="primary"
                disabled={isWorking || !selectedProjectId}
                onClick={startWizard}
                loading={isWorking}
                icon={isWorking ? undefined : <Sparkles size={16} />}
                className="min-w-[180px]"
              >
                {t.generateCandidates}
              </Button>
            )}
            {step === 'candidates' && (
              <Button
                type="button"
                variant="primary"
                data-testid="initiative-wizard-governance-preview"
                disabled={actionableCandidates.length === 0}
                onClick={() => setStep('governance')}
                className="min-w-[180px]"
              >
                {t.governancePreview}
                <ArrowRight size={16} />
              </Button>
            )}
            {step === 'governance' && (
              <Button
                type="button"
                variant="primary"
                data-testid="initiative-wizard-create-drafts"
                disabled={isWorking || !shortlistGateOk || candidatesToCreate.length === 0}
                onClick={createDrafts}
                title={!shortlistGateOk ? t.shortlistGateTitle : undefined}
                loading={isWorking}
                icon={isWorking ? undefined : <Check size={16} />}
                className="min-w-[180px]"
              >
                {createProgress
                  ? `${t.bulkProgress} ${createProgress.done}/${createProgress.total}`
                  : language === 'pl'
                    ? `Utwórz drafty (${candidatesToCreate.length})`
                    : `Create drafts (${candidatesToCreate.length})`}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
