/**
 * InsightCreatorModal - Advanced AI Insight Generator
 * BCG Enterprise Level - Multiple analysis types, filters, custom prompts
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  ExternalLink,
  FileText,
  Info,
  Lightbulb,
  Loader2,
  MessageSquare,
  Package,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DatePicker, Select } from '@/components/shared/forms';
import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { TeresaMark } from '@/components/shared/TeresaMark';
import {
  CREATOR_SHELL_GEOMETRY,
  type WizardStep,
  WizardModal,
  WizardStepper,
} from '@/components/shared/WizardModal';
import { Button, LoadingState } from '@/components/ui/primitives';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import { Api } from '@/services/api';
import { type V8ContextDocument, V8InterviewApi } from '@/services/api/v8/interview';
import { isInterviewCreatorShellEnabled } from '@/utils/interviewCreatorShellFlag';

// ==========================================
// TYPES
// ==========================================

export type InsightPromptType =
  | 'summary'
  | 'general_analysis'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map'
  | 'between_the_lines';

type InsightAnalysisMode =
  | 'general_consulting_synthesis'
  | 'focused_topic_synthesis'
  | 'contradiction_scan'
  | 'initiative_opportunity_scan'
  | 'material_quality_scan'
  | 'hypothesis_validation'
  | 'between_the_lines';

type InsightContextMode =
  | 'selected_interview_material_only'
  | 'selected_material_plus_approved_org_knowledge';
type CreatorStepId = 'define' | 'material' | 'refine';

interface CompletedSession {
  id: string;
  name: string;
  projectId?: string;
  templateId?: string;
  templateName?: string;
  templateCategory?: string;
  status: string;
  approvalStatus?: string;
  sourceScopeStatus?: 'approved_only';
  completedAt?: string;
  respondentId?: string;
  respondentName?: string;
  respondentRole?: string;
  department?: string;
  answeredQuestions: number;
  totalQuestions: number;
}

/**
 * Source Basket — a reusable saved set of source sessions (+ optional people
 * filter) so the consultant builds the selection once and reuses it across many
 * insights/lenses ("z jednych źródeł różne insighty pod różnym kątem").
 * Backed by /interview/insight-baskets (insightSourceBasketService).
 */
interface InsightSourceBasket {
  id: string;
  name: string;
  description?: string | null;
  sessionIds: string[];
  projectId?: string | null;
  peopleFilter?: { respondentIds?: string[] } | null;
  filterCriteria?: Record<string, unknown> | null;
  usageCount: number;
  lastUsedAt?: string | null;
}

/**
 * #28e — Duplicate/similarity hit for the new insight. The primary source is now
 * the server-backed semantic check (POST /interview/insights/similarity-check,
 * mirroring POST /initiatives/similarity-check — embeddings cosine with a token
 * Jaccard fallback). If that endpoint errors we gracefully fall back to a
 * lightweight client-side title check (token overlap + substring).
 */
interface SimilarInsightHit {
  id: string;
  title: string;
  score: number; // 0..1 — semantic/token similarity to an existing insight
}

interface InsightCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// #28 — App-styled checkbox: a custom navy/rounded box replacing the default
// browser checkbox, consistent with the modal's dark palette. Render it inside a
// <label> next to the visible content (label handles the click/keyboard).
const StyledCheck: React.FC<{
  checked: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ checked, disabled, className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition ${
      checked
        ? 'border-c-text bg-c-text text-c-bg shadow-sm shadow-black/10'
        : 'border-slate-300 bg-white text-transparent dark:border-white/[0.18] dark:bg-navy-900'
    } ${disabled ? 'opacity-50' : ''} ${className}`}
  >
    <Check size={12} strokeWidth={3} className={checked ? 'opacity-100' : 'opacity-0'} />
  </span>
);

// #28 — Small info tooltip trigger for controls that need explanation. Uses the
// native title attribute (no portal dependency) plus a subtle hover ring.
const InfoHint: React.FC<{ text: string }> = ({ text }) => (
  <span
    title={text}
    className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-slate-400 transition-colors hover:text-c-info"
    aria-label={text}
  >
    <Info size={13} />
  </span>
);

// Collapsible disclosure section — used for the optional "Filter" and "Advanced"
// groups so the long tail of refinement controls stays hidden until requested.
// An active-count badge keeps hidden choices honest (never a silent surprise).
const Disclosure: React.FC<{
  icon: React.ElementType;
  title: string;
  hint?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, title, hint, count, open, onToggle, children }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-navy-700/60 dark:bg-navy-950/30">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
    >
      <Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-navy-900 px-1.5 text-[11px] font-semibold text-white">
          {count}
        </span>
      )}
      {hint && <span className="hidden truncate text-xs text-slate-400 sm:inline">{hint}</span>}
      <ChevronDown
        size={16}
        className={`ml-auto shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
    {open && (
      <div className="space-y-4 border-t border-slate-200/70 px-3.5 py-3.5 dark:border-navy-700/50">
        {children}
      </div>
    )}
  </div>
);

// #28e — Normalize a title into significant tokens for the client-side check.
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'for',
  'to',
  'in',
  'on',
  'with',
  'analysis',
  'insight',
  'report',
  'i',
  'oraz',
  'dla',
  'na',
  'w',
  'z',
  'do',
  'analiza',
  'analizy',
  'raport',
  'wnioski',
  'wniosek',
]);
const tokenizeTitle = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const MAX_CONTEXT_FILES = 5;
const MAX_CONTEXT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const CONTEXT_FILE_ACCEPT =
  '.txt,.md,.markdown,.csv,.json,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
const INSIGHT_LOAD_ERROR_COPY = {
  pl: 'Generator insightów jest tymczasowo niedostępny.',
  en: 'Insight generator is temporarily unavailable.',
} as const;
const INSIGHT_LOAD_ERROR_HINT = {
  pl: 'To nie oznacza, że nie ma zakończonych sesji. Ponów wczytywanie danych.',
  en: 'This does not mean there are no completed sessions. Retry loading the data.',
} as const;

// ==========================================
// ANALYSIS TYPE DEFINITIONS
// ==========================================

interface AnalysisType {
  id: InsightPromptType;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  icon: React.ReactNode;
  color: string;
  category: 'basic' | 'advanced' | 'bcg';
}

const ANALYSIS_TYPES: AnalysisType[] = [
  // Basic
  {
    id: 'summary',
    name: 'Executive Summary',
    namePl: 'Podsumowanie Wykonawcze',
    description: 'Comprehensive overview of key findings for leadership',
    descriptionPl: 'Kompleksowy przegląd kluczowych wniosków dla zarządu',
    icon: <FileText size={18} />,
    color: 'blue',
    category: 'basic',
  },
  {
    id: 'general_analysis',
    name: 'General Analysis',
    namePl: 'Analiza Ogólna',
    description: 'Broad, non-targeted review of the full interview material',
    descriptionPl: 'Szeroki, niecelowany przegląd całego materiału wywiadowego',
    icon: <Compass size={18} />,
    color: 'slate',
    category: 'basic',
  },
  {
    id: 'trends',
    name: 'Trend Analysis',
    namePl: 'Analiza Trendów',
    description: 'Identify patterns and emerging themes across interviews',
    descriptionPl: 'Identyfikacja wzorców i pojawiających się tematów',
    icon: <TrendingUp size={18} />,
    color: 'purple',
    category: 'basic',
  },
  {
    id: 'problems',
    name: 'Problem Discovery',
    namePl: 'Odkrywanie Problemów',
    description: 'Surface pain points, challenges, and blockers',
    descriptionPl: 'Wydobycie problemów, wyzwań i blokad',
    icon: <AlertTriangle size={18} />,
    color: 'red',
    category: 'basic',
  },
  {
    id: 'recommendations',
    name: 'Recommendations',
    namePl: 'Rekomendacje',
    description: 'Actionable suggestions based on interview findings',
    descriptionPl: 'Konkretne sugestie działań na podstawie wywiadów',
    icon: <Lightbulb size={18} />,
    color: 'amber',
    category: 'basic',
  },
  // Advanced
  {
    id: 'comparison',
    name: 'Cross-Interview Comparison',
    namePl: 'Porównanie Wywiadów',
    description: 'Compare perspectives between different respondents',
    descriptionPl: 'Porównaj perspektywy różnych respondentów',
    icon: <BarChart3 size={18} />,
    color: 'cyan',
    category: 'advanced',
  },
  {
    id: 'gaps',
    name: 'Gap Analysis',
    namePl: 'Analiza Luk',
    description: 'Identify missing information and unanswered questions',
    descriptionPl: 'Identyfikacja brakujących informacji i pytań bez odpowiedzi',
    icon: <Target size={18} />,
    color: 'orange',
    category: 'advanced',
  },
  {
    id: 'risk_assessment',
    name: 'Risk Assessment',
    namePl: 'Ocena Ryzyk',
    description: 'Extract and categorize risks mentioned in interviews',
    descriptionPl: 'Wydobycie i kategoryzacja ryzyk z wywiadów',
    icon: <AlertTriangle size={18} />,
    color: 'rose',
    category: 'advanced',
  },
  {
    id: 'opportunity_scan',
    name: 'Opportunity Scan',
    namePl: 'Skan Szans',
    description: 'Identify quick wins and growth opportunities',
    descriptionPl: 'Identyfikacja quick wins i szans rozwoju',
    icon: <Zap size={18} />,
    color: 'emerald',
    category: 'advanced',
  },
  // BCG Frameworks
  {
    id: 'maturity',
    name: 'Maturity Assessment',
    namePl: 'Ocena Dojrzałości',
    description: 'Evaluate organizational maturity level (1-5 scale)',
    descriptionPl: 'Ocena poziomu dojrzałości organizacji (skala 1-5)',
    icon: <Brain size={18} />,
    color: 'indigo',
    category: 'bcg',
  },
  {
    id: 'stakeholder_map',
    name: 'Stakeholder Mapping',
    namePl: 'Mapa Interesariuszy',
    description: 'Identify key players, their influence and positions',
    descriptionPl: 'Identyfikacja kluczowych graczy, ich wpływu i stanowisk',
    icon: <Users size={18} />,
    color: 'violet',
    category: 'bcg',
  },
  // E7.3: Between the Lines — advanced NLP analysis
  {
    id: 'between_the_lines',
    name: 'Between the Lines',
    namePl: 'Czytanie Między Wierszami',
    description:
      'Detect hidden intentions, contradictions, evasions, and unspoken goals. Analyze what respondents really mean vs. what they say.',
    descriptionPl:
      'Wykryj ukryte intencje, sprzeczności, uniki i niewypowiedziane cele. Analiza co respondenci naprawdę mają na myśli vs. co mówią.',
    icon: <Brain size={18} />,
    color: 'rose',
    category: 'bcg',
  },
];

const ANALYSIS_MODE_OPTIONS: Array<{
  id: InsightAnalysisMode;
  labelPl: string;
  labelEn: string;
  hintPl: string;
  hintEn: string;
}> = [
  {
    id: 'general_consulting_synthesis',
    labelPl: 'Ogólna synteza konsultingowa',
    labelEn: 'General consulting synthesis',
    hintPl: 'AI wybiera najważniejsze obserwacje z całego koszyka.',
    hintEn: 'AI selects the highest-value observations from the full source basket.',
  },
  {
    id: 'focused_topic_synthesis',
    labelPl: 'Synteza ukierunkowana',
    labelEn: 'Focused topic synthesis',
    hintPl: 'Analiza koncentruje się na wybranych wątkach.',
    hintEn: 'Analysis focuses on selected topic groups.',
  },
  {
    id: 'contradiction_scan',
    labelPl: 'Skan sprzeczności',
    labelEn: 'Contradiction scan',
    hintPl: 'Szukamy napięć, rozbieżności i niespójnych perspektyw.',
    hintEn: 'Find tensions, divergent views, and inconsistent perspectives.',
  },
  {
    id: 'initiative_opportunity_scan',
    labelPl: 'Skan inicjatyw i szans',
    labelEn: 'Initiative opportunity scan',
    hintPl: 'Wydobywa materiał, który może przejść do inicjatyw.',
    hintEn: 'Surfaces material that can become initiatives.',
  },
  {
    id: 'material_quality_scan',
    labelPl: 'Ocena jakości materiału',
    labelEn: 'Material quality scan',
    hintPl: 'Skupia się na sile, brakach i wiarygodności materiału.',
    hintEn: 'Focuses on evidence strength, gaps, and reliability.',
  },
  {
    id: 'hypothesis_validation',
    labelPl: 'Walidacja hipotezy',
    labelEn: 'Hypothesis validation',
    hintPl: 'Sprawdza pytanie przewodnie lub hipotezę konsultanta.',
    hintEn: 'Tests a consultant question or hypothesis.',
  },
  {
    id: 'between_the_lines',
    labelPl: 'Między wierszami',
    labelEn: 'Between the lines',
    hintPl: 'Analizuje sygnały ukryte, uniki i niewypowiedziane napięcia.',
    hintEn: 'Analyzes hidden signals, evasions, and unspoken tensions.',
  },
];

const TOPIC_FOCUS_OPTIONS: Array<{ id: string; labelPl: string; labelEn: string }> = [
  { id: 'strategy_and_goals', labelPl: 'Strategia i cele', labelEn: 'Strategy and goals' },
  {
    id: 'process_and_operations',
    labelPl: 'Procesy i operacje',
    labelEn: 'Process and operations',
  },
  {
    id: 'technology_and_systems',
    labelPl: 'Technologia i systemy',
    labelEn: 'Technology and systems',
  },
  { id: 'data_and_reporting', labelPl: 'Dane i raportowanie', labelEn: 'Data and reporting' },
  { id: 'people_and_roles', labelPl: 'Ludzie i role', labelEn: 'People and roles' },
  {
    id: 'ownership_and_decision_rights',
    labelPl: 'Własność i decyzje',
    labelEn: 'Ownership and decision rights',
  },
  { id: 'risks_and_blockers', labelPl: 'Ryzyka i blokery', labelEn: 'Risks and blockers' },
  {
    id: 'opportunities_and_improvements',
    labelPl: 'Szanse i usprawnienia',
    labelEn: 'Opportunities and improvements',
  },
  {
    id: 'customer_user_impact',
    labelPl: 'Wpływ na klienta/użytkownika',
    labelEn: 'Customer/user impact',
  },
  {
    id: 'compliance_governance',
    labelPl: 'Compliance i governance',
    labelEn: 'Compliance/governance',
  },
  { id: 'change_readiness', labelPl: 'Gotowość do zmiany', labelEn: 'Change readiness' },
  {
    id: 'hidden_signals_and_contradictions',
    labelPl: 'Ukryte sygnały i sprzeczności',
    labelEn: 'Hidden signals and contradictions',
  },
];

const CREATOR_STEPS: Array<{
  id: CreatorStepId;
  labelPl: string;
  labelEn: string;
  hintPl: string;
  hintEn: string;
  optional?: boolean;
}> = [
  {
    id: 'define',
    labelPl: 'Definicja',
    labelEn: 'Define',
    hintPl: 'Co chcesz uzyskać?',
    hintEn: 'What should AI produce?',
  },
  {
    id: 'material',
    labelPl: 'Materiał',
    labelEn: 'Source',
    hintPl: 'Z jakich wywiadów korzystamy?',
    hintEn: 'Which interviews should be used?',
  },
  {
    id: 'refine',
    labelPl: 'Dostrojenie',
    labelEn: 'Refine',
    hintPl: 'Opcjonalne nastrojenie analizy',
    hintEn: 'Optional analysis fine-tuning',
    optional: true,
  },
];

// ==========================================
// COMPONENT
// ==========================================

export const InsightCreatorModal: React.FC<InsightCreatorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const creatorShellEnabled = isInterviewCreatorShellEnabled();
  const creatorGeometryClassName = creatorShellEnabled
    ? CREATOR_SHELL_GEOMETRY.stepped.panelClassName
    : CREATOR_SHELL_GEOMETRY.legacy.panelClassName;
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({
    open: isOpen && !creatorShellEnabled,
    onClose,
    containerRef: dialogContainerRef,
    initialFocusRef: titleInputRef,
  });

  // State
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<InsightPromptType>('summary');
  const [selectedTypes, setSelectedTypes] = useState<InsightPromptType[]>(['summary']);
  const [analysisMode, setAnalysisMode] = useState<InsightAnalysisMode>(
    'general_consulting_synthesis'
  );
  const [selectedAnalysisModes, setSelectedAnalysisModes] = useState<InsightAnalysisMode[]>([
    'general_consulting_synthesis',
  ]);
  const [selectedTopicFocus, setSelectedTopicFocus] = useState<string[]>([]);
  const [leadingQuestion, setLeadingQuestion] = useState('');
  const [contextMode, setContextMode] = useState<InsightContextMode>(
    'selected_material_plus_approved_org_knowledge'
  );
  const [selectedRespondents, setSelectedRespondents] = useState<string[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [internalArtifactLinks, setInternalArtifactLinks] = useState('');
  // Collapsible groups for the consolidated 3-step layout.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // E7.3 / E7.4: Auto-fill custom prompt for special analysis types
  const applyPromptPreset = (type: InsightPromptType) => {
    if (type === 'between_the_lines') {
      setCustomPrompt(t('interview.insightCreatorModal.analyzeRespondentAnswersAtA'));
    } else if (type === 'summary' && !customPrompt) {
      // E7.4: Precise formula for executive summaries
      setCustomPrompt(t('interview.insightCreatorModal.useAPreciseConsultingFormula'));
    }
  };

  const toggleAnalysisType = (type: InsightPromptType) => {
    setSelectedTypes((prev) => {
      const isSelected = prev.includes(type);
      const next = isSelected ? prev.filter((item) => item !== type) : [...prev, type];
      const normalized = next.length > 0 ? next : [type];
      setSelectedType(normalized[0]);
      if (!isSelected) applyPromptPreset(type);
      return normalized;
    });
  };

  const toggleAnalysisMode = (mode: InsightAnalysisMode) => {
    setSelectedAnalysisModes((prev) => {
      const isSelected = prev.includes(mode);
      const next = isSelected ? prev.filter((item) => item !== mode) : [...prev, mode];
      const normalized = next.length > 0 ? next : [mode];
      setAnalysisMode(isSelected ? normalized[0] : mode);
      return normalized;
    });
  };

  const toggleTopicFocus = (topicId: string) => {
    setSelectedTopicFocus((prev) =>
      prev.includes(topicId) ? prev.filter((item) => item !== topicId) : [...prev, topicId]
    );
  };
  const [filterTemplate, setFilterTemplate] = useState<string>('');
  const [filterRespondent, setFilterRespondent] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [useTemplateFilter, setUseTemplateFilter] = useState(false);
  const [useRespondentFilter, setUseRespondentFilter] = useState(false);
  const [useRoleFilter, setUseRoleFilter] = useState(false);
  const [useDepartmentFilter, setUseDepartmentFilter] = useState(false);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contextDocuments, setContextDocuments] = useState<V8ContextDocument[]>([]);
  const [selectedContextDocumentIds, setSelectedContextDocumentIds] = useState<string[]>([]);
  const [isLoadingContextDocuments, setIsLoadingContextDocuments] = useState(false);
  const [isUploadingContextDocument, setIsUploadingContextDocument] = useState(false);
  const [isContextDragActive, setIsContextDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionSelectionTouchedRef = useRef(false);

  // Data
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // #28e — Existing insights loaded in scope, used for client-side duplicate
  // detection before Run. Non-fatal if the list cannot be loaded.
  const [existingInsights, setExistingInsights] = useState<Array<{ id: string; title: string }>>(
    []
  );
  const [similarHits, setSimilarHits] = useState<SimilarInsightHit[]>([]);
  const [similarDismissed, setSimilarDismissed] = useState(false);

  // Source baskets — reusable saved source selections
  const [baskets, setBaskets] = useState<InsightSourceBasket[]>([]);
  const [activeBasketId, setActiveBasketId] = useState<string>('');
  const [isSavingBasket, setIsSavingBasket] = useState(false);
  const [showSaveBasket, setShowSaveBasket] = useState(false);
  const [basketNameDraft, setBasketNameDraft] = useState('');

  const fetchContextDocuments = useCallback(async () => {
    setIsLoadingContextDocuments(true);
    try {
      const response = await V8InterviewApi.listContextDocuments({ scope: 'all' });
      const documents = response?.documents || [];
      setContextDocuments(documents);
      setSelectedContextDocumentIds((prev) =>
        prev.filter((id) => documents.some((doc) => doc.id === id && doc.status === 'ready'))
      );
    } catch (error) {
      console.error('[InsightCreatorModal] Failed to load context documents:', error);
      toast.error(t('interview.insightCreatorModal.failedToLoadContextDocuments'));
    } finally {
      setIsLoadingContextDocuments(false);
    }
  }, [isPolish]);

  // --- Source baskets ---------------------------------------------------------
  const fetchBaskets = useCallback(async () => {
    try {
      const res = await Api.get('/interview/insight-baskets');
      // Api.get returns a payload proxy; the route responds { baskets: [...] }.
      const payload = (res as { data?: { baskets?: InsightSourceBasket[] } })?.data ?? res;
      const list = Array.isArray((payload as { baskets?: InsightSourceBasket[] })?.baskets)
        ? (payload as { baskets: InsightSourceBasket[] }).baskets
        : [];
      setBaskets(list);
    } catch (error) {
      // Non-fatal: the wizard still works without saved baskets.
      console.error('[InsightCreatorModal] Failed to load source baskets:', error);
    }
  }, []);

  // #28e — Load existing insights (titles only) so we can warn about duplicates
  // before generating. Best-effort: the wizard works without this list.
  const fetchExistingInsights = useCallback(async () => {
    try {
      const res = await V8InterviewApi.listInsights({ limit: 200 });
      const list = Array.isArray(res?.insights) ? res.insights : [];
      setExistingInsights(
        list
          .filter((insight) => insight?.id && insight?.title)
          .map((insight) => ({ id: insight.id, title: insight.title }))
      );
    } catch (error) {
      // Non-fatal: duplicate detection is an optional safety net.
      console.error('[InsightCreatorModal] Failed to load existing insights:', error);
    }
  }, []);

  // Apply an existing basket: pre-fill the source sessions (and people filter
  // when present) into the wizard's existing state. Additive — the user can
  // still tweak the selection afterwards.
  const applyBasket = (basketId: string) => {
    setActiveBasketId(basketId);
    if (!basketId) return;
    const basket = baskets.find((b) => b.id === basketId);
    if (!basket) return;
    sessionSelectionTouchedRef.current = true;
    const validIds = new Set(completedSessions.map((s) => s.id));
    const nextSessions = basket.sessionIds.filter((id) => validIds.has(id));
    setSelectedSessions(nextSessions);
    const respondentIds = basket.peopleFilter?.respondentIds;
    if (Array.isArray(respondentIds)) {
      const validRespondents = new Set(
        completedSessions.map((s) => s.respondentId).filter(Boolean) as string[]
      );
      setSelectedRespondents(respondentIds.filter((id) => validRespondents.has(id)));
    }
    if (nextSessions.length < basket.sessionIds.length) {
      toast(t('interview.insightCreatorModal.someSessionsFromTheBasket'));
    }
    return nextSessions;
  };

  // #28d — 1-click "new lens from this basket": reuse a saved basket's source
  // selection, then jump the user straight to the Analysis step so they only pick
  // a fresh angle + generate ("z jednych źródeł różne insighty pod różnym kątem").
  // Non-destructive to the basket; it only re-applies the stored selection and
  // resets the angle pickers so the consultant consciously chooses a new lens.
  const startNewLensFromBasket = (basketId: string) => {
    const basket = baskets.find((b) => b.id === basketId);
    if (!basket) return;
    const appliedSessions = applyBasket(basketId);
    if (!appliedSessions || appliedSessions.length === 0) {
      toast.error(t('interview.insightCreatorModal.thisBasketHasNoAvailable'));
      return;
    }
    // Pre-clear the previous angle so the user consciously picks a new lens.
    setAnalysisMode('general_consulting_synthesis');
    setSelectedAnalysisModes(['general_consulting_synthesis']);
    setSelectedTopicFocus([]);
    setLeadingQuestion('');
    // Jump straight to the Refine step (sources reused) and open Advanced so the
    // analysis lens is immediately visible.
    const refineIndex = CREATOR_STEPS.findIndex((step) => step.id === 'refine');
    setCurrentStep(refineIndex >= 0 ? refineIndex : currentStep);
    setAdvancedOpen(true);
    toast.success(t('interview.insightCreatorModal.newLensPickAnAngle'));
  };

  // Save the current source selection as a reusable basket.
  const handleSaveBasket = async () => {
    const name = basketNameDraft.trim();
    if (!name) {
      toast.error(t('interview.insightCreatorModal.enterABasketName'));
      return;
    }
    if (selectedSessions.length === 0) {
      toast.error(t('interview.insightCreatorModal.selectAtLeastOneSession'));
      return;
    }
    setIsSavingBasket(true);
    try {
      const projectIds = Array.from(
        new Set(
          completedSessions
            .filter((s) => selectedSessions.includes(s.id) && s.projectId)
            .map((s) => String(s.projectId))
        )
      );
      const res = await Api.post('/interview/insight-baskets', {
        name,
        sessionIds: selectedSessions,
        projectId: projectIds.length === 1 ? projectIds[0] : null,
        peopleFilter:
          selectedRespondents.length > 0 ? { respondentIds: selectedRespondents } : null,
      });
      const payload = (res as { data?: { basket?: InsightSourceBasket } })?.data ?? res;
      const created = (payload as { basket?: InsightSourceBasket })?.basket;
      await fetchBaskets();
      if (created?.id) setActiveBasketId(created.id);
      setShowSaveBasket(false);
      setBasketNameDraft('');
      toast.success(t('interview.insightCreatorModal.basketSaved'));
    } catch (error) {
      console.error('[InsightCreatorModal] Failed to save source basket:', error);
      toast.error(t('interview.insightCreatorModal.failedToSaveBasket'));
    } finally {
      setIsSavingBasket(false);
    }
  };

  const handleDeleteBasket = async (basketId: string) => {
    try {
      await Api.delete(`/interview/insight-baskets/${basketId}`);
      if (activeBasketId === basketId) setActiveBasketId('');
      await fetchBaskets();
      toast.success(t('interview.insightCreatorModal.basketDeleted'));
    } catch (error) {
      console.error('[InsightCreatorModal] Failed to delete source basket:', error);
      toast.error(t('interview.insightCreatorModal.failedToDeleteBasket'));
    }
  };

  const defaultBasketName = (): string => {
    const projectName = completedSessions.find(
      (s) => selectedSessions.includes(s.id) && s.projectId
    )?.projectId;
    const base = projectName ? String(projectName) : t('interview.insightCreatorModal.selected');
    return t('interview.insightCreatorModal.baseSessionsSuffix', { base });
  };

  const openSaveBasket = () => {
    if (selectedSessions.length === 0) {
      toast.error(t('interview.insightCreatorModal.selectSourceSessionsFirst'));
      return;
    }
    setBasketNameDraft(defaultBasketName());
    setShowSaveBasket(true);
  };

  const uploadContextFiles = async (fileList: File[]) => {
    const files = fileList;
    if (files.length === 0) return;
    const remainingSlots = MAX_CONTEXT_FILES;
    const toUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast(
        t('interview.insightCreatorModal.onlyNFilesAdded', {
          remaining: remainingSlots,
          max: MAX_CONTEXT_FILES,
        })
      );
    }

    setIsUploadingContextDocument(true);
    try {
      const selectedProjects = Array.from(
        new Set(
          completedSessions
            .filter((session) => selectedSessions.includes(session.id) && session.projectId)
            .map((session) => String(session.projectId))
        )
      );
      const uploadScope: 'project' | 'user' = selectedProjects.length === 1 ? 'project' : 'user';
      const uploadProjectId = selectedProjects.length === 1 ? selectedProjects[0] : undefined;
      for (const file of toUpload) {
        if (file.size > MAX_CONTEXT_FILE_SIZE_BYTES) {
          toast.error(t('interview.insightCreatorModal.fileTooLarge', { name: file.name }));
          continue;
        }
        await V8InterviewApi.uploadContextDocument({
          file,
          scope: uploadScope,
          projectId: uploadProjectId,
        });
      }
      await fetchContextDocuments();
      toast.success(t('interview.insightCreatorModal.documentsUploadedAndSentFor'));
    } catch (error) {
      console.error('[InsightCreatorModal] Upload context document failed:', error);
      toast.error(t('interview.insightCreatorModal.failedToUploadContextDocument'));
    } finally {
      setIsUploadingContextDocument(false);
    }
  };

  const handleContextFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await uploadContextFiles(files);
    event.target.value = '';
  };

  // #28 — Drag/drop support for the context-document dropzone.
  const handleContextDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsContextDragActive(false);
    if (isUploadingContextDocument) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) await uploadContextFiles(files);
  };

  const toggleContextDocument = (doc: V8ContextDocument) => {
    if (doc.status !== 'ready') return;
    setSelectedContextDocumentIds((prev) =>
      prev.includes(doc.id) ? prev.filter((id) => id !== doc.id) : [...prev, doc.id]
    );
  };

  const getInternalArtifactLinks = (): string[] =>
    internalArtifactLinks
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const buildPromptWithAttachmentContext = (): string | undefined => {
    const manualPrompt = customPrompt.trim();
    const artifactLinks = getInternalArtifactLinks();
    const selectedOutputLabels = ANALYSIS_TYPES.filter((type) => selectedTypes.includes(type.id))
      .map((type) => t(`interview.insightCreatorModal.analysisTypeName.${type.id}`, type.name))
      .join(', ');
    const selectedAnalysisModeLabels = ANALYSIS_MODE_OPTIONS.filter((mode) =>
      selectedAnalysisModes.includes(mode.id)
    )
      .map((mode) => t(`interview.insightCreatorModal.analysisModeLabel.${mode.id}`, mode.labelEn))
      .join(', ');
    const selectionContext =
      selectedTypes.length > 1 || selectedAnalysisModes.length > 1
        ? [
            selectedTypes.length > 1
              ? `${t('interview.insightCreatorModal.selectedOutputTypes')}: ${selectedOutputLabels}`
              : '',
            selectedAnalysisModes.length > 1
              ? `${t('interview.insightCreatorModal.selectedAnalysisLenses')}: ${selectedAnalysisModeLabels}`
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';

    if (artifactLinks.length === 0 && !selectionContext) {
      return manualPrompt || undefined;
    }
    const artifactLinkContext =
      artifactLinks.length > 0
        ? `Internal artifact links / workspace references:\n${artifactLinks
            .map((link, index) => `${index + 1}. ${link}`)
            .join('\n')}`
        : '';

    const composed = [
      manualPrompt,
      selectionContext
        ? `${t('interview.insightCreatorModal.additionalSelectionInstructions')}:\n${selectionContext}`
        : '',
      artifactLinkContext,
    ]
      .filter(Boolean)
      .join('\n\n');

    return composed.trim() || undefined;
  };

  // Load data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const sessionsRes = await Promise.allSettled([Api.get('/interview/sessions/completed')]);
        const sessionsResult = sessionsRes[0];

        const nextSessions =
          sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value)
            ? sessionsResult.value
            : [];

        setCompletedSessions(nextSessions);
        setSelectedSessions((prev) => {
          const validSessionIds = new Set(nextSessions.map((session) => session.id));
          const stillValid = prev.filter((sessionId) => validSessionIds.has(sessionId));
          if (stillValid.length > 0 || sessionSelectionTouchedRef.current) {
            return stillValid;
          }
          return [];
        });

        if (sessionsResult.status === 'rejected') {
          const reason = sessionsResult.reason as
            | { status?: number; message?: string }
            | Error
            | undefined;
          const status = (reason as { status?: number } | undefined)?.status;
          setLoadError(t('interview.insightCreatorModal.insightGeneratorUnavailable'));
        }
        await fetchContextDocuments();
        await fetchBaskets();
        await fetchExistingInsights();
      } catch (error) {
        console.error('[InsightCreatorModal] Failed to load data:', error);
        setLoadError(t('interview.insightCreatorModal.insightGeneratorUnavailable'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fetchBaskets, fetchContextDocuments, fetchExistingInsights, isOpen, isPolish]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSelectedType('summary');
      setSelectedTypes(['summary']);
      setAnalysisMode('general_consulting_synthesis');
      setSelectedAnalysisModes(['general_consulting_synthesis']);
      setSelectedTopicFocus([]);
      setLeadingQuestion('');
      setContextMode('selected_material_plus_approved_org_knowledge');
      setSelectedRespondents([]);
      setSelectedSessions([]);
      sessionSelectionTouchedRef.current = false;
      setCustomPrompt('');
      setCurrentStep(0);
      setInternalArtifactLinks('');
      setFilterTemplate('');
      setFilterRespondent('');
      setFilterRole('');
      setFilterDepartment('');
      setFilterDateFrom('');
      setFilterDateTo('');
      setUseTemplateFilter(false);
      setUseRespondentFilter(false);
      setUseRoleFilter(false);
      setUseDepartmentFilter(false);
      setUseDateFilter(false);
      setContextDocuments([]);
      setSelectedContextDocumentIds([]);
      setIsContextDragActive(false);
      setLoadError(null);
      setExistingInsights([]);
      setSimilarHits([]);
      setSimilarDismissed(false);
      setBaskets([]);
      setActiveBasketId('');
      setShowSaveBasket(false);
      setBasketNameDraft('');
      setIsSavingBasket(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let sessions = completedSessions;

    if (selectedRespondents.length > 0) {
      sessions = sessions.filter(
        (session) => session.respondentId && selectedRespondents.includes(session.respondentId)
      );
    }

    if (useTemplateFilter && filterTemplate) {
      sessions = sessions.filter((s) => s.templateId === filterTemplate);
    }

    if (useRespondentFilter && filterRespondent) {
      sessions = sessions.filter((s) => s.respondentId === filterRespondent);
    }

    if (useRoleFilter && filterRole) {
      sessions = sessions.filter((s) => s.respondentRole === filterRole);
    }

    if (useDepartmentFilter && filterDepartment) {
      sessions = sessions.filter((s) => s.department === filterDepartment);
    }

    if (useDateFilter && filterDateFrom) {
      const from = new Date(filterDateFrom);
      sessions = sessions.filter((s) => s.completedAt && new Date(s.completedAt) >= from);
    }

    if (useDateFilter && filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      sessions = sessions.filter((s) => s.completedAt && new Date(s.completedAt) <= to);
    }

    return sessions;
  }, [
    completedSessions,
    filterTemplate,
    filterRespondent,
    filterRole,
    filterDepartment,
    filterDateFrom,
    filterDateTo,
    selectedRespondents,
    useDateFilter,
    useDepartmentFilter,
    useRespondentFilter,
    useRoleFilter,
    useTemplateFilter,
  ]);

  // #28b — Build the respondent list for the People step. Previously a session
  // was dropped whenever respondentName was empty/whitespace, which (combined
  // with truthy-only filtering) could surface as blank checkbox slots once the
  // label tried to render an empty string. We now require a real respondentId
  // and fall back to a clear "Unnamed respondent" label so every row shows text
  // next to its checkbox rather than an empty slot.
  const respondentOptions = useMemo(() => {
    const respondents = new Map<
      string,
      { id: string; name: string; role?: string; department?: string; sessionCount: number }
    >();
    completedSessions.forEach((session) => {
      if (!session.respondentId) return;
      const trimmedName = session.respondentName?.trim();
      const existing = respondents.get(session.respondentId);
      respondents.set(session.respondentId, {
        id: session.respondentId,
        name: existing?.name || trimmedName || t('interview.insightCreatorModal.unnamedRespondent'),
        role: existing?.role || session.respondentRole?.trim() || undefined,
        department: existing?.department || session.department?.trim() || undefined,
        sessionCount: (existing?.sessionCount ?? 0) + 1,
      });
    });
    return Array.from(respondents.values());
  }, [completedSessions, isPolish]);

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          completedSessions
            .map((session) => session.respondentRole)
            .filter((role): role is string => Boolean(role))
        )
      ).sort(),
    [completedSessions]
  );

  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          completedSessions
            .map((session) => session.department)
            .filter((department): department is string => Boolean(department))
        )
      ).sort(),
    [completedSessions]
  );

  // #28e — Client-side fallback duplicate check (token overlap + substring),
  // used only when the server similarity endpoint is unavailable.
  const computeClientSideHits = useCallback(
    (rawTitle: string): SimilarInsightHit[] => {
      const trimmed = rawTitle.trim();
      if (trimmed.length < 4 || existingInsights.length === 0) return [];
      const candidateTokens = tokenizeTitle(trimmed);
      const candidateLower = trimmed.toLowerCase();
      const hits: SimilarInsightHit[] = [];
      for (const insight of existingInsights) {
        const existingLower = insight.title.trim().toLowerCase();
        if (!existingLower) continue;
        const existingTokens = tokenizeTitle(insight.title);
        let score = 0;
        // Exact / substring containment is a strong signal.
        if (existingLower === candidateLower) {
          score = 1;
        } else if (
          existingLower.includes(candidateLower) ||
          candidateLower.includes(existingLower)
        ) {
          score = 0.85;
        } else if (candidateTokens.length > 0 && existingTokens.length > 0) {
          const existingSet = new Set(existingTokens);
          const shared = candidateTokens.filter((token) => existingSet.has(token)).length;
          const union = new Set([...candidateTokens, ...existingTokens]).size;
          score = union > 0 ? shared / union : 0;
        }
        if (score >= 0.5) hits.push({ id: insight.id, title: insight.title, score });
      }
      hits.sort((a, b) => b.score - a.score);
      return hits.slice(0, 3);
    },
    [existingInsights]
  );

  // #28e — Recompute the duplicate/similarity warning whenever the title changes.
  // Primary: server-backed semantic check (POST /interview/insights/
  // similarity-check, mirroring POST /initiatives/similarity-check). Debounced,
  // and gracefully falls back to the client-side heuristic on any error. The
  // warning is non-blocking — generation always remains available.
  useEffect(() => {
    const trimmed = title.trim();
    setSimilarDismissed(false);
    if (trimmed.length < 4) {
      setSimilarHits([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await V8InterviewApi.checkInsightSimilarity({ title: trimmed });
        if (cancelled) return;
        // Surface only matches at/above the "similar" band so the chip stays
        // meaningful (related-only matches are too weak to warn on).
        const hits = (result?.matches || [])
          .filter((match) => match.score >= 0.5)
          .slice(0, 3)
          .map((match) => ({ id: match.id, title: match.title, score: match.score }));
        setSimilarHits(hits);
      } catch (error) {
        // Graceful fallback: server check unavailable → client-side heuristic.
        if (cancelled) return;
        console.error(
          '[InsightCreatorModal] Server similarity check failed, using fallback:',
          error
        );
        setSimilarHits(computeClientSideHits(trimmed));
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [title, computeClientSideHits]);

  useEffect(() => {
    const visibleSessionIds = new Set(filteredSessions.map((session) => session.id));
    setSelectedSessions((prev) => {
      const visibleSelected = prev.filter((sessionId) => visibleSessionIds.has(sessionId));
      if (visibleSelected.length > 0 || sessionSelectionTouchedRef.current) {
        return visibleSelected;
      }
      return [];
    });
  }, [filteredSessions]);

  // Modal chrome stays monochromatic; semantic colors belong to data/status badges only.
  const getColorClasses = (color: string, variant: 'bg' | 'border' | 'text' | 'ring') => {
    void color;
    const colors: Record<'bg' | 'border' | 'text' | 'ring', string> = {
      bg: 'bg-slate-100 dark:bg-navy-800/80',
      border: 'border-slate-200 dark:border-white/[0.08]',
      text: 'text-slate-600 dark:text-slate-300',
      ring: 'ring-c-focus',
    };
    return colors[variant];
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t('interview.insightCreatorModal.enterInsightTitle'));
      return;
    }

    if (selectedSessions.length === 0) {
      toast.error(t('interview.insightCreatorModal.selectAtLeastOneSession'));
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(t('interview.insightCreatorModal.generatingAiInsights'));
    const customPromptWithAttachments = buildPromptWithAttachmentContext();
    const artifactLinks = getInternalArtifactLinks();
    const normalizedLeadingQuestion = leadingQuestion.trim();
    const normalizedConsultantNote = customPrompt.trim();

    try {
      await V8InterviewApi.createInsight({
        title: title.trim(),
        sessionIds: selectedSessions,
        promptType: selectedType,
        filters: {
          templateId: useTemplateFilter ? filterTemplate || undefined : undefined,
          respondentId:
            selectedRespondents.length === 1
              ? selectedRespondents[0]
              : useRespondentFilter
                ? filterRespondent || undefined
                : undefined,
          respondentIds: selectedRespondents.length > 0 ? selectedRespondents : undefined,
          roles: useRoleFilter && filterRole ? [filterRole] : undefined,
          departments: useDepartmentFilter && filterDepartment ? [filterDepartment] : undefined,
          dateFrom: useDateFilter ? filterDateFrom || undefined : undefined,
          dateTo: useDateFilter ? filterDateTo || undefined : undefined,
          topicFocus: selectedTopicFocus.length > 0 ? selectedTopicFocus : undefined,
          internalArtifactLinks: artifactLinks.length > 0 ? artifactLinks : undefined,
          outputTypes: selectedTypes,
          analysisModes: selectedAnalysisModes,
        },
        analysisScope: {
          source_session_ids: selectedSessions,
          source_scope_status: 'approved_only',
          respondent_filters:
            selectedRespondents.length > 0
              ? selectedRespondents
              : useRespondentFilter && filterRespondent
                ? [filterRespondent]
                : [],
          role_filters: useRoleFilter && filterRole ? [filterRole] : [],
          department_filters: useDepartmentFilter && filterDepartment ? [filterDepartment] : [],
          template_filters: useTemplateFilter && filterTemplate ? [filterTemplate] : [],
          date_range:
            useDateFilter && (filterDateFrom || filterDateTo)
              ? { from: filterDateFrom || undefined, to: filterDateTo || undefined }
              : undefined,
          topic_focus: selectedTopicFocus,
          analysis_mode: analysisMode,
          context_mode: contextMode,
          consultant_note: normalizedConsultantNote || null,
          leading_question: normalizedLeadingQuestion || null,
        },
        analysisMode,
        contextMode,
        topicFocus: selectedTopicFocus,
        consultantNote: normalizedConsultantNote || undefined,
        leadingQuestion: normalizedLeadingQuestion || undefined,
        customPrompt: customPromptWithAttachments,
        selectedContextDocumentIds,
      }).catch(() =>
        Api.post('/interview/insights', {
          title: title.trim(),
          sessionIds: selectedSessions,
          promptType: selectedType,
          filters: {
            templateId: useTemplateFilter ? filterTemplate || undefined : undefined,
            respondentId:
              selectedRespondents.length === 1
                ? selectedRespondents[0]
                : useRespondentFilter
                  ? filterRespondent || undefined
                  : undefined,
            respondentIds: selectedRespondents.length > 0 ? selectedRespondents : undefined,
            roles: useRoleFilter && filterRole ? [filterRole] : undefined,
            departments: useDepartmentFilter && filterDepartment ? [filterDepartment] : undefined,
            dateFrom: useDateFilter ? filterDateFrom || undefined : undefined,
            dateTo: useDateFilter ? filterDateTo || undefined : undefined,
            topicFocus: selectedTopicFocus.length > 0 ? selectedTopicFocus : undefined,
            internalArtifactLinks: artifactLinks.length > 0 ? artifactLinks : undefined,
            outputTypes: selectedTypes,
            analysisModes: selectedAnalysisModes,
          },
          analysisScope: {
            source_session_ids: selectedSessions,
            source_scope_status: 'approved_only',
            respondent_filters:
              selectedRespondents.length > 0
                ? selectedRespondents
                : useRespondentFilter && filterRespondent
                  ? [filterRespondent]
                  : [],
            role_filters: useRoleFilter && filterRole ? [filterRole] : [],
            department_filters: useDepartmentFilter && filterDepartment ? [filterDepartment] : [],
            template_filters: useTemplateFilter && filterTemplate ? [filterTemplate] : [],
            date_range:
              useDateFilter && (filterDateFrom || filterDateTo)
                ? { from: filterDateFrom || undefined, to: filterDateTo || undefined }
                : undefined,
            topic_focus: selectedTopicFocus,
            analysis_mode: analysisMode,
            context_mode: contextMode,
            consultant_note: normalizedConsultantNote || null,
            leading_question: normalizedLeadingQuestion || null,
          },
          analysisMode,
          contextMode,
          topicFocus: selectedTopicFocus,
          consultantNote: normalizedConsultantNote || undefined,
          leadingQuestion: normalizedLeadingQuestion || undefined,
          customPrompt: customPromptWithAttachments,
          selectedContextDocumentIds,
        })
      );

      // Bump usage on the basket this insight was generated from (best-effort).
      if (activeBasketId) {
        await Api.post(`/interview/insight-baskets/${activeBasketId}/touch`, {}).catch(() => {});
      }

      toast.dismiss(toastId);
      toast.success(t('interview.insightCreatorModal.insightsGenerated'));
      onSuccess();
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      const err = error as { status?: number; message?: string } | undefined;
      const status = err?.status;
      const message = String(err?.message || '').toLowerCase();
      const looksLikeLlm =
        status === 502 ||
        status === 503 ||
        status === 504 ||
        message.includes('llm') ||
        message.includes('openai') ||
        message.includes('anthropic') ||
        message.includes('model') ||
        message.includes('timeout') ||
        message.includes('econnrefused');
      if (status === 401 || status === 403) {
        toast.error(t('interview.insightCreatorModal.noPermissionToGenerateInsights'), {
          duration: 6000,
        });
      } else if (looksLikeLlm) {
        toast.error(t('interview.insightCreatorModal.generationFailedTheLlmModel'), {
          duration: 6000,
        });
      } else {
        toast.error(t('interview.insightCreatorModal.failedToGenerateInsightsCheck'));
      }
      console.error('[InsightCreatorModal] Failed to generate insight:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle session selection
  const toggleRespondent = (respondentId: string) => {
    setSelectedRespondents((prev) =>
      prev.includes(respondentId)
        ? prev.filter((id) => id !== respondentId)
        : [...prev, respondentId]
    );
  };

  const selectAllRespondents = () => {
    setSelectedRespondents([]);
  };

  const toggleSession = (sessionId: string) => {
    sessionSelectionTouchedRef.current = true;
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  // Select all / deselect all
  const toggleAllSessions = () => {
    sessionSelectionTouchedRef.current = true;
    const allVisibleSelected =
      filteredSessions.length > 0 &&
      filteredSessions.every((session) => selectedSessions.includes(session.id));

    if (allVisibleSelected) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(filteredSessions.map((s) => s.id));
    }
  };

  const retryLoadData = () => {
    setIsLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const sessionsRes = await Promise.allSettled([Api.get('/interview/sessions/completed')]);
        const sessionsResult = sessionsRes[0];

        const nextSessions =
          sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value)
            ? sessionsResult.value
            : [];

        setCompletedSessions(nextSessions);

        if (sessionsResult.status === 'rejected') {
          const reason = sessionsResult.reason as { status?: number } | undefined;
          const status = reason?.status;
          setLoadError(t('interview.insightCreatorModal.insightGeneratorUnavailable'));
        }
        await fetchContextDocuments();
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const canCompleteStep = (stepIndex: number): boolean => {
    const stepId = CREATOR_STEPS[stepIndex]?.id;
    if (stepId === 'define') return Boolean(title.trim() && selectedTypes.length > 0);
    if (stepId === 'material') return selectedSessions.length > 0;
    return true;
  };

  const getStepBlockerMessage = (stepIndex: number): string | null => {
    const stepId = CREATOR_STEPS[stepIndex]?.id;
    if (stepId === 'define' && !title.trim()) {
      return t('interview.insightCreatorModal.enterAnInsightTitle');
    }
    if (stepId === 'define' && selectedTypes.length === 0) {
      return t('interview.insightCreatorModal.selectAtLeastOneOutput');
    }
    if (stepId === 'material' && selectedSessions.length === 0) {
      return t('interview.insightCreatorModal.selectAtLeastOneSource');
    }
    return null;
  };

  const goToNextStep = () => {
    const blocker = getStepBlockerMessage(currentStep);
    if (blocker) {
      toast.error(blocker);
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, CREATOR_STEPS.length - 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  // §5 — Pill navigation for the shared stepper. Backward/same jumps are free;
  // a forward jump runs the same blocker guard as goToNextStep so users can't
  // skip past an unsatisfied gating step. The stepper already disables pills
  // beyond maxReachableIndex, so this only fires for reachable targets.
  const handleStepChange = (index: number) => {
    if (index > currentStep) {
      const blocker = getStepBlockerMessage(currentStep);
      if (blocker) {
        toast.error(blocker);
        return;
      }
    }
    setCurrentStep(Math.min(Math.max(index, 0), CREATOR_STEPS.length - 1));
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    if (currentStep !== CREATOR_STEPS.length - 1) {
      event.preventDefault();
      goToNextStep();
      return;
    }
    void handleSubmit(event);
  };

  const submitInsight = () => {
    void handleSubmit({ preventDefault: () => undefined } as React.FormEvent);
  };

  const selectedSourceSummary =
    selectedSessions.length > 0
      ? t('interview.insightCreatorModal.approvedSessionsCount', { count: selectedSessions.length })
      : t('interview.insightCreatorModal.noSessionsSelected');
  const selectedPeopleSummary =
    selectedRespondents.length === 0
      ? t('interview.insightCreatorModal.allPeople')
      : t('interview.insightCreatorModal.selectedPeopleCount', {
          count: selectedRespondents.length,
        });

  const isLastStep = currentStep === CREATOR_STEPS.length - 1;
  const canGenerate = !isGenerating;
  const getContextDocStatusMeta = (status: V8ContextDocument['status']) => {
    switch (status) {
      case 'ready':
        return {
          label: t('interview.insightCreatorModal.ready'),
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        };
      case 'processing':
      case 'uploaded':
        return {
          label: t('interview.insightCreatorModal.processing'),
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        };
      case 'ocr_required':
        return {
          label: t('interview.insightCreatorModal.ocrRequired'),
          className: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
        };
      case 'unreadable':
      case 'failed':
        return {
          label: t('interview.insightCreatorModal.unreadable'),
          className: 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
        };
      default:
        return {
          label: status,
          className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        };
    }
  };

  // §5 — Map the bespoke CREATOR_STEPS to the shared <WizardStepper> contract.
  // Per-step status mirrors the old pill logic: the active step is 'ready', any
  // earlier step that satisfies canCompleteStep is 'complete', everything else is
  // 'empty'. Labels/hints carry over their EN/PL pairs verbatim.
  const wizardSteps: WizardStep[] = CREATOR_STEPS.map((step, index) => {
    let status: WizardStep['status'] = 'empty';
    if (index < currentStep && canCompleteStep(index)) {
      status = 'complete';
    } else if (index === currentStep) {
      status = 'ready';
    }
    return {
      id: step.id,
      label: { en: step.labelEn, pl: step.labelPl },
      hint: { en: step.hintEn, pl: step.hintPl },
      status,
      optional: step.optional,
    };
  });

  // §5 — Reachability gate for the shared stepper: the user may jump to any
  // already-visited step, plus exactly one step ahead — and only when every
  // gating step up to the current one is satisfied (mirrors goToNextStep's
  // getStepBlockerMessage/canCompleteStep guard, so users can't skip ahead).
  const maxReachableIndex = (() => {
    const ahead = Math.min(currentStep + 1, CREATOR_STEPS.length - 1);
    for (let index = 0; index <= currentStep; index += 1) {
      if (!canCompleteStep(index)) return currentStep;
    }
    return ahead;
  })();

  const renderGlobalLoadError = () => {
    if (!loadError || CREATOR_STEPS[currentStep]?.id === 'material') return null;
    return (
      <EmptyStateInline
        icon={AlertTriangle}
        dashed={false}
        message={loadError}
        hint={t('interview.insightCreatorModal.retryLoadingHint')}
        action={{
          label: t('interview.insightCreatorModal.retry'),
          onClick: retryLoadData,
        }}
        className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900/50"
      />
    );
  };

  // #28e — Non-blocking warning chip/banner when a similar insight already
  // exists. The user can ignore it (Run still works) or open the existing one.
  const renderSimilarWarning = () => {
    if (similarDismissed || similarHits.length === 0) return null;
    const top = similarHits[0];
    return (
      <div className="rounded-xl border-l-4 border-l-amber-500 border border-amber-300/50 bg-amber-100 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              {t('interview.insightCreatorModal.aSimilarInsightMayAlready')}
            </p>
            <ul className="mt-1 space-y-1">
              {similarHits.map((hit) => (
                <li key={hit.id} className="flex items-center gap-1.5">
                  <a
                    href={`/interview?tab=insights&insightId=${encodeURIComponent(hit.id)}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 truncate text-xs font-medium text-amber-800 underline decoration-amber-400/60 underline-offset-2 transition-colors hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
                    title={t('interview.insightCreatorModal.openTheExistingInsight')}
                  >
                    <span className="truncate">{hit.title}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                  <span className="shrink-0 text-[10px] text-amber-600/80 dark:text-amber-300/70">
                    {Math.round(hit.score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSimilarDismissed(true)}
                className="text-[11px] font-medium text-amber-700 transition-colors hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              >
                {t('interview.insightCreatorModal.proceedAnyway')}
              </button>
              <a
                href={`/interview?tab=insights&insightId=${encodeURIComponent(top.id)}`}
                onClick={onClose}
                className="text-[11px] font-medium text-amber-700 underline underline-offset-2 transition-colors hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
              >
                {t('interview.insightCreatorModal.openClosestMatch')}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTypeRow = (type: AnalysisType) => {
    const isSelected = selectedTypes.includes(type.id);
    const inputId = `insight-creator-output-type-${type.id}`;
    return (
      <label
        key={type.id}
        htmlFor={inputId}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
          isSelected
            ? 'border-c-info/60 bg-c-info/10 dark:border-c-info/40 dark:bg-c-info/15'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-navy-700/60 dark:bg-navy-800/40 dark:hover:border-white/[0.16]'
        }`}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleAnalysisType(type.id)}
          className="sr-only"
        />
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getColorClasses(
            type.color,
            'bg'
          )} ${getColorClasses(type.color, 'text')}`}
        >
          {type.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(`interview.insightCreatorModal.analysisTypeName.${type.id}`, type.name)}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {t(
              `interview.insightCreatorModal.analysisTypeDescription.${type.id}`,
              type.description
            )}
          </p>
        </div>
        <StyledCheck checked={isSelected} />
      </label>
    );
  };

  const renderDefineStep = () => {
    const categories: Array<{ key: AnalysisType['category']; labelPl: string; labelEn: string }> = [
      { key: 'basic', labelPl: 'Podstawowe', labelEn: 'Basic' },
      { key: 'advanced', labelPl: 'Zaawansowane', labelEn: 'Advanced' },
      { key: 'bcg', labelPl: 'Frameworki BCG', labelEn: 'BCG frameworks' },
    ];
    return (
      <div className="space-y-5">
        <div>
          <label
            htmlFor="insight-creator-title"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {t('interview.insightCreatorModal.insightTitle')} *
          </label>
          <input
            id="insight-creator-title"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('interview.insightCreatorModal.eGDigitalTransformationAnalysis')}
            required
            aria-required="true"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 dark:placeholder-slate-500"
          />
          {renderSimilarWarning()}
          {title.trim().length >= 4 &&
            existingInsights.length > 0 &&
            similarHits.length === 0 &&
            !similarDismissed && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                {t('interview.insightCreatorModal.noSimilarInsightsWithThis')}
              </p>
            )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('interview.insightCreatorModal.outputType')} *
            </label>
            <span className="text-xs text-c-info">
              {t('interview.insightCreatorModal.selectedCountColon', {
                count: selectedTypes.length,
              })}
            </span>
          </div>
          <div className="max-h-[280px] space-y-3 overflow-auto pr-1">
            {categories.map((cat) => {
              const items = ANALYSIS_TYPES.filter((t) => t.category === cat.key);
              if (items.length === 0) return null;
              return (
                <div key={cat.key} className="space-y-1.5">
                  <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t(
                      `interview.insightCreatorModal.analysisCategoryLabel.${cat.key}`,
                      cat.labelEn
                    )}
                  </p>
                  {items.map(renderTypeRow)}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('interview.insightCreatorModal.outputTypeShapesThisInsight')}
          </p>
        </div>
      </div>
    );
  };

  const renderPeopleBlock = () => (
    <div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('interview.insightCreatorModal.selectPeople')}
            <InfoHint text={t('interview.insightCreatorModal.narrowTheAnalysisToSelected')} />
          </label>
          <button
            type="button"
            onClick={selectAllRespondents}
            className="text-xs text-c-info transition-colors hover:text-c-info"
          >
            {t('interview.insightCreatorModal.allPeople')}
          </button>
        </div>

        {respondentOptions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t('interview.insightCreatorModal.noRespondentsFoundForThis')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('interview.insightCreatorModal.theSelectedSessionsHaveNo')}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={selectAllRespondents}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                selectedRespondents.length === 0
                  ? 'border-c-info/50 bg-c-info/10 dark:bg-c-info/15'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
              }`}
            >
              <StyledCheck checked={selectedRespondents.length === 0} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t('interview.insightCreatorModal.allPeople')}
                </div>
              </div>
            </button>

            <div className="max-h-44 space-y-1.5 overflow-auto pr-1">
              {respondentOptions.map((respondent) => {
                const isSelected = selectedRespondents.includes(respondent.id);
                return (
                  <label
                    key={respondent.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                      isSelected
                        ? 'border-c-info/50 bg-c-info/10 dark:bg-c-info/15'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRespondent(respondent.id)}
                      className="sr-only"
                    />
                    <StyledCheck checked={isSelected} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {respondent.name}
                        {(respondent.role || respondent.department) && (
                          <span className="ml-2 font-normal text-slate-500">
                            {[respondent.role, respondent.department].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {respondent.sessionCount}{' '}
                        {respondent.sessionCount === 1
                          ? t('interview.insightCreatorModal.sessionUnitOne')
                          : t('interview.insightCreatorModal.sessionUnitOther')}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-c-info">{selectedPeopleSummary}</p>
      </div>
    </div>
  );

  const renderSourceBasketControl = () => {
    const activeBasket = baskets.find((b) => b.id === activeBasketId);
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-white/[0.08] dark:bg-navy-950/30">
        <div className="mb-1.5 flex items-center gap-2">
          <Package size={15} className="text-c-info" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('interview.insightCreatorModal.sourceBasket')}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('interview.insightCreatorModal.saveOnceReuseAcrossInsights')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <Select
              value={activeBasketId}
              onChange={(value) => applyBasket(value)}
              aria-label={t('interview.insightCreatorModal.selectSourceBasket')}
              options={[
                {
                  value: '',
                  label: t('interview.insightCreatorModal.buildNewNoBasket'),
                },
                ...baskets.map((basket) => ({
                  value: basket.id,
                  label: `${basket.name} · ${basket.sessionIds.length} ${t(
                    'interview.insightCreatorModal.sessions'
                  )} · ${t('interview.insightCreatorModal.usedNTimes', { count: basket.usageCount })}`,
                })),
              ]}
            />
          </div>
          {activeBasket && (
            <button
              type="button"
              onClick={() => startNewLensFromBasket(activeBasket.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-2 text-sm font-medium text-c-bg shadow-sm shadow-black/10 transition-colors hover:bg-c-text-secondary"
              title={t('interview.insightCreatorModal.reuseTheseSourcesAndJump')}
            >
              <Sparkles size={14} />
              {t('interview.insightCreatorModal.newLens')}
            </button>
          )}
          <button
            type="button"
            onClick={openSaveBasket}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            <Save size={14} />
            {t('interview.insightCreatorModal.saveAsBasket')}
          </button>
          {activeBasket && (
            <button
              type="button"
              onClick={() => handleDeleteBasket(activeBasket.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-danger-600 transition-colors hover:bg-danger-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-danger-300 dark:hover:bg-danger-500/10"
              aria-label={t('interview.insightCreatorModal.deleteBasket')}
              title={t('interview.insightCreatorModal.deleteBasket')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {showSaveBasket && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/[0.08] dark:bg-navy-900/70">
            <input
              type="text"
              value={basketNameDraft}
              onChange={(event) => setBasketNameDraft(event.target.value)}
              placeholder={t('interview.insightCreatorModal.basketName')}
              className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-500 focus:border-c-focus-solid dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleSaveBasket}
              disabled={isSavingBasket}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-50"
            >
              {isSavingBasket ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('interview.insightCreatorModal.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveBasket(false);
                setBasketNameDraft('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              {t('interview.insightCreatorModal.cancel')}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Date / role / department filters — live inside the "Filter" disclosure on the
  // Material step (merged from the old standalone Source step).
  const renderSourceFiltersBlock = () => (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('interview.insightCreatorModal.materialDateRange')}
          </label>
          {(filterDateFrom || filterDateTo) && (
            <button
              type="button"
              onClick={() => {
                setUseDateFilter(false);
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-xs text-c-info transition-colors hover:text-c-info"
            >
              {t('interview.insightCreatorModal.allDates')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker
            value={filterDateFrom}
            isPolish={isPolish}
            placeholder={t('interview.insightCreatorModal.dateFrom')}
            onChange={(nextFrom) => {
              setFilterDateFrom(nextFrom);
              setUseDateFilter(Boolean(nextFrom || filterDateTo));
            }}
            aria-label={t('interview.insightCreatorModal.dateFrom')}
          />
          <DatePicker
            value={filterDateTo}
            isPolish={isPolish}
            placeholder={t('interview.insightCreatorModal.dateTo')}
            onChange={(nextTo) => {
              setFilterDateTo(nextTo);
              setUseDateFilter(Boolean(filterDateFrom || nextTo));
            }}
            aria-label={t('interview.insightCreatorModal.dateTo')}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('interview.insightCreatorModal.respondentRole')}
            </label>
            {filterRole && (
              <button
                type="button"
                onClick={() => {
                  setUseRoleFilter(false);
                  setFilterRole('');
                }}
                className="text-xs text-c-info transition-colors hover:text-c-info"
              >
                {t('interview.insightCreatorModal.allRoles')}
              </button>
            )}
          </div>
          <Select
            value={filterRole}
            onChange={(nextRole) => {
              setFilterRole(nextRole);
              setUseRoleFilter(Boolean(nextRole));
            }}
            aria-label={t('interview.insightCreatorModal.respondentRoleFilter')}
            options={[
              { value: '', label: t('interview.insightCreatorModal.allRoles') },
              ...roleOptions.map((role) => ({ value: role, label: role })),
            ]}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('interview.insightCreatorModal.respondentDepartment')}
            </label>
            {filterDepartment && (
              <button
                type="button"
                onClick={() => {
                  setUseDepartmentFilter(false);
                  setFilterDepartment('');
                }}
                className="text-xs text-c-info transition-colors hover:text-c-info"
              >
                {t('interview.insightCreatorModal.allDepartments')}
              </button>
            )}
          </div>
          <Select
            value={filterDepartment}
            onChange={(nextDepartment) => {
              setFilterDepartment(nextDepartment);
              setUseDepartmentFilter(Boolean(nextDepartment));
            }}
            aria-label={t('interview.insightCreatorModal.respondentDepartmentFilter')}
            options={[
              { value: '', label: t('interview.insightCreatorModal.allDepartments') },
              ...departmentOptions.map((department) => ({
                value: department,
                label: department,
              })),
            ]}
          />
        </div>
      </div>
    </div>
  );

  const renderSessionsBlock = () => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t('interview.insightCreatorModal.selectSourceSessions')} *
        </label>
        {filteredSessions.length > 0 && (
          <button
            type="button"
            onClick={toggleAllSessions}
            className="text-xs text-c-info hover:text-c-info transition-colors"
          >
            {filteredSessions.every((session) => selectedSessions.includes(session.id))
              ? t('interview.insightCreatorModal.deselectAll')
              : t('interview.insightCreatorModal.selectAll')}
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState variant="spinner" className="py-8" />
      ) : loadError ? (
        <EmptyStateInline
          icon={AlertTriangle}
          dashed={false}
          message={loadError}
          hint={t('interview.insightCreatorModal.retryLoadingHint')}
          action={{
            label: t('interview.insightCreatorModal.retry'),
            onClick: retryLoadData,
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900/50"
        />
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50">
          <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t('interview.insightCreatorModal.noApprovedCompletedSessions')}
          </p>
          {(filterTemplate ||
            filterRespondent ||
            filterRole ||
            filterDepartment ||
            filterDateFrom ||
            filterDateTo) && (
            <p className="text-xs mt-1">{t('interview.insightCreatorModal.tryChangingFilters')}</p>
          )}
        </div>
      ) : (
        <div className="max-h-[220px] space-y-1.5 overflow-auto pr-1">
          {filteredSessions.map((session) => {
            const isSelected = selectedSessions.includes(session.id);
            return (
              <label
                key={session.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                  isSelected
                    ? 'border-c-info/50 bg-c-info/10 dark:bg-c-info/15'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSession(session.id)}
                  className="sr-only"
                />
                <StyledCheck checked={isSelected} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {session.name || t('interview.defaultSessionName', 'Interview Session')}
                    <span className="ml-2 font-normal text-slate-500">
                      {session.answeredQuestions}/{session.totalQuestions}{' '}
                      {t('interview.insightCreatorModal.questions')}
                    </span>
                    {session.templateName && (
                      <span className="ml-2 font-normal text-slate-500">
                        • {session.templateName}
                      </span>
                    )}
                    {session.completedAt && (
                      <span className="ml-2 font-normal text-slate-500">
                        • {new Date(session.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <p className="text-xs text-c-info mt-2">{selectedSourceSummary}</p>
    </div>
  );

  // Active-filter count for the "Filter" disclosure badge — keeps hidden scoping
  // choices visible so nothing silently narrows the analysis.
  const activeFilterCount =
    selectedRespondents.length +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0) +
    (filterRole ? 1 : 0) +
    (filterDepartment ? 1 : 0);

  const renderMaterialStep = () => (
    <div className="space-y-5">
      {renderSourceBasketControl()}
      {renderSessionsBlock()}
      <Disclosure
        icon={SlidersHorizontal}
        title={t('interview.insightCreatorModal.filter')}
        hint={t('interview.insightCreatorModal.peopleDatesRoleDepartment')}
        count={activeFilterCount}
        open={filtersOpen}
        onToggle={() => setFiltersOpen((v) => !v)}
      >
        {renderPeopleBlock()}
        {renderSourceFiltersBlock()}
      </Disclosure>
    </div>
  );

  const renderAnalysisBlock = () => (
    <div className="space-y-4">
      <div>
        <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t('interview.insightCreatorModal.analysisMode')}
          <InfoHint text={t('interview.insightCreatorModal.promptLensControlsHowThe')} />
        </label>
        <div className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {ANALYSIS_MODE_OPTIONS.map((mode) => {
            const isSelected = selectedAnalysisModes.includes(mode.id);
            return (
              <label
                key={mode.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition ${
                  isSelected
                    ? 'border-c-info/50 bg-c-info/10 dark:bg-c-info/15'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleAnalysisMode(mode.id)}
                  className="sr-only"
                />
                <StyledCheck checked={isSelected} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t(`interview.insightCreatorModal.analysisModeLabel.${mode.id}`, mode.labelEn)}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {t(`interview.insightCreatorModal.analysisModeHint.${mode.id}`, mode.hintEn)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('interview.insightCreatorModal.analysisModesArePromptLenses')}
        </p>
        <p className="mt-2 text-xs text-c-info">
          {t('interview.insightCreatorModal.selectedCountColon', {
            count: selectedAnalysisModes.length,
          })}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('interview.insightCreatorModal.topicFocus')}
          </label>
          {selectedTopicFocus.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTopicFocus([])}
              className="text-xs text-c-info transition-colors hover:text-c-info"
            >
              {t('interview.insightCreatorModal.general')}
            </button>
          )}
        </div>
        <div className="grid max-h-28 grid-cols-2 gap-1.5 overflow-auto pr-1">
          {TOPIC_FOCUS_OPTIONS.map((topic) => {
            const selected = selectedTopicFocus.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopicFocus(topic.id)}
                className={`truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                  selected
                    ? 'border-c-info/50 bg-c-info/10 text-c-info dark:bg-c-info/15 dark:text-c-info'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-c-info/40 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-200'
                }`}
              >
                {t(`interview.insightCreatorModal.topicFocusLabel.${topic.id}`, topic.labelEn)}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-c-info">
          {selectedTopicFocus.length === 0
            ? t('interview.insightCreatorModal.noSelectionGeneralConsultingSynthesis')
            : t('interview.insightCreatorModal.selectedCountColon', {
                count: selectedTopicFocus.length,
              })}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t('interview.insightCreatorModal.aiContextBoundary')}
          <InfoHint text={t('interview.insightCreatorModal.decidesWhetherTheAiMay')} />
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[
            {
              value: 'selected_interview_material_only' as InsightContextMode,
              titlePl: 'Tylko wybrane wywiady',
              titleEn: 'Selected interviews only',
              hintPl: 'Najbezpieczniej: AI opiera się wyłącznie na zaznaczonych sesjach.',
              hintEn: 'Strictest mode: AI uses only the selected sessions.',
            },
            {
              value: 'selected_material_plus_approved_org_knowledge' as InsightContextMode,
              titlePl: 'Wywiady + wiedza organizacji',
              titleEn: 'Interviews + organization knowledge',
              hintPl: 'AI może użyć zaakceptowanych informacji o organizacji jako kontekstu.',
              hintEn: 'AI may use approved organization knowledge as extra context.',
            },
          ].map((option) => {
            const selected = contextMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setContextMode(option.value)}
                className={`rounded-lg border px-2.5 py-2 text-left transition ${
                  selected
                    ? 'border-c-info/50 bg-c-info/10 ring-1 ring-c-focus dark:bg-c-info/15'
                    : 'border-slate-200 bg-white hover:border-c-info/40 dark:border-white/[0.08] dark:bg-navy-900/70'
                }`}
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t(
                    `interview.insightCreatorModal.contextModeTitle.${option.value}`,
                    option.titleEn
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  {t(
                    `interview.insightCreatorModal.contextModeHint.${option.value}`,
                    option.hintEn
                  )}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderContextDetailsBlock = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t('interview.insightCreatorModal.notes')}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={3}
          placeholder={t('interview.insightCreatorModal.eGFocusOnDifferences')}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-navy-900/50">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {t('interview.insightCreatorModal.contextDocuments')}
          <InfoHint text={t('interview.insightCreatorModal.filesAddOrganizationProjectContext')} />
        </div>
        {/* #28 — Proper drag-and-drop zone */}
        <label
          onDragOver={(event) => {
            event.preventDefault();
            if (!isUploadingContextDocument) setIsContextDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsContextDragActive(false);
          }}
          onDrop={(event) => void handleContextDrop(event)}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            isContextDragActive
              ? 'border-c-info bg-c-info/10 ring-2 ring-c-focus dark:bg-c-info/10'
              : 'border-slate-300 bg-white hover:border-c-info/60 hover:bg-c-info/40 dark:border-white/[0.15] dark:bg-navy-900/60 dark:hover:border-c-info/40'
          } ${isUploadingContextDocument ? 'pointer-events-none opacity-70' : ''}`}
        >
          {isUploadingContextDocument ? (
            <Loader2 size={20} className="animate-spin text-c-info" />
          ) : (
            <UploadCloud
              size={22}
              className={isContextDragActive ? 'text-c-info' : 'text-slate-400'}
            />
          )}
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {isUploadingContextDocument
              ? t('interview.insightCreatorModal.uploading')
              : isContextDragActive
                ? t('interview.insightCreatorModal.dropFilesHere')
                : t('interview.insightCreatorModal.dragFilesHereOrClick')}
          </span>
          <span className="text-[11px] text-slate-400">
            {t('interview.insightCreatorModal.txtMdCsvJsonPdf')}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={CONTEXT_FILE_ACCEPT}
            onChange={handleContextFileUpload}
            className="hidden"
            disabled={isUploadingContextDocument}
          />
        </label>
        {isLoadingContextDocuments ? (
          <div className="mt-3 flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-slate-600" />
          </div>
        ) : contextDocuments.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500 dark:border-white/[0.15] dark:bg-navy-900/60">
            {t('interview.insightCreatorModal.noContextDocumentsYetUpload')}
          </div>
        ) : (
          <div className="mt-3 max-h-44 space-y-1.5 overflow-auto pr-1">
            {contextDocuments.map((doc) => {
              const selected = selectedContextDocumentIds.includes(doc.id);
              const statusMeta = getContextDocStatusMeta(doc.status);
              const disabled = doc.status !== 'ready';
              return (
                <label
                  key={doc.id}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
                    selected
                      ? 'border-c-info/50 bg-c-info/10 dark:bg-c-info/15'
                      : 'border-slate-200 bg-white dark:border-white/[0.08] dark:bg-navy-900/70'
                  } ${disabled ? 'opacity-80' : 'cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.16]'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggleContextDocument(doc)}
                    className="sr-only"
                  />
                  <StyledCheck checked={selected} disabled={disabled} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                      {doc.filename}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                      {doc.chunkCount ? <span>{doc.chunkCount} chunks</span> : null}
                    </div>
                    {doc.processingError ? (
                      <p className="mt-0.5 text-[11px] text-danger-500">{doc.processingError}</p>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {t('interview.insightCreatorModal.selectedDocumentsCountColon', {
              count: selectedContextDocumentIds.length,
            })}
          </span>
          <button
            type="button"
            onClick={() => void fetchContextDocuments()}
            className="text-c-info hover:text-c-info"
          >
            {t('interview.insightCreatorModal.refresh')}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          {t('interview.insightCreatorModal.internalArtifactLinks')}
        </label>
        <textarea
          value={internalArtifactLinks}
          onChange={(e) => setInternalArtifactLinks(e.target.value)}
          rows={2}
          placeholder={t('interview.insightCreatorModal.pasteOneLinkOrArtifact')}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 placeholder-slate-400 transition focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-600 dark:bg-navy-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>
    </div>
  );

  // Active-choice count for the "Advanced" disclosure badge.
  const advancedCount =
    selectedTopicFocus.length +
    selectedContextDocumentIds.length +
    (customPrompt.trim() ? 1 : 0) +
    (internalArtifactLinks.trim() ? 1 : 0) +
    (selectedAnalysisModes.length > 1 ? selectedAnalysisModes.length - 1 : 0);

  const renderRefineStep = () => (
    <div className="space-y-5">
      {renderSimilarWarning()}
      <div className="rounded-xl border border-c-info/60 bg-c-info/50 p-3.5 dark:border-c-info/20 dark:bg-c-info/[0.07]">
        <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t('interview.insightCreatorModal.leadingQuestionHypothesis')}
          <InfoHint text={t('interview.insightCreatorModal.optionalPointTheAnalysisAt')} />
        </label>
        <input
          type="text"
          value={leadingQuestion}
          onChange={(event) => setLeadingQuestion(event.target.value)}
          placeholder={t('interview.insightCreatorModal.eGWhereDoOwnership')}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-navy-600 dark:bg-navy-900 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t('interview.insightCreatorModal.thisIsUsuallyTheOnly')}
        </p>
      </div>

      <Disclosure
        icon={SlidersHorizontal}
        title={t('interview.insightCreatorModal.advanced')}
        hint={t('interview.insightCreatorModal.lensTopicsAiContextDocuments')}
        count={advancedCount}
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((v) => !v)}
      >
        {renderAnalysisBlock()}
        {renderContextDetailsBlock()}
      </Disclosure>
    </div>
  );

  const renderCurrentStep = () => {
    const stepId = CREATOR_STEPS[currentStep]?.id;
    if (stepId === 'define') return renderDefineStep();
    if (stepId === 'material') return renderMaterialStep();
    return renderRefineStep();
  };

  const scopeTitle = title || t('interview.creator.shell.untitled');
  const creatorScopeText =
    currentStep === 0
      ? t('interview.creator.shell.scopeDefine', {
          title: scopeTitle,
          types: selectedTypes.length,
        })
      : currentStep === 1
        ? t('interview.creator.shell.scopeMaterial', {
            title: scopeTitle,
            types: selectedTypes.length,
            sessions: selectedSessions.length,
            people: selectedRespondents.length,
          })
        : t('interview.creator.shell.scopeRefine', {
            title: scopeTitle,
            types: selectedTypes.length,
            sessions: selectedSessions.length,
            documents: selectedContextDocumentIds.length,
            modes: selectedAnalysisModes.length,
            topics: selectedTopicFocus.length,
          });
  const creatorFooterNote =
    currentStep === 0
      ? t('interview.creator.footer.defineNote')
      : currentStep === 1
        ? t('interview.creator.footer.materialNote')
        : t('interview.creator.footer.refineNote');

  if (!isOpen) return null;

  if (creatorShellEnabled) {
    return (
      <WizardModal
        open={isOpen}
        onClose={onClose}
        title={{
          en: t('interview.insightCreatorModal.aiInsightCreator'),
          pl: t('interview.insightCreatorModal.aiInsightCreator'),
        }}
        steps={wizardSteps}
        activeStepIndex={currentStep}
        onStepChange={handleStepChange}
        onComplete={submitInsight}
        completing={isGenerating}
        geometry="creator"
        isPolish={isPolish}
        creatorSubtitle={t('interview.creator.shell.subtitle')}
        creatorScopeSummary={
          <>
            <span className="font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {t('interview.creator.shell.scopeLabel')}
            </span>
            <span className="truncate text-c-text-secondary">{creatorScopeText}</span>
          </>
        }
        creatorScopeDetails={t('interview.creator.shell.scopeDetails')}
        creatorScopeExpandLabel={t('interview.creator.shell.expand')}
        creatorScopeCollapseLabel={t('interview.creator.shell.collapse')}
        footer={
          <div
            data-creator-band="footer"
            className="creator-glass-band flex h-[70px] shrink-0 items-center gap-3 border-t px-6"
          >
            <p className="max-w-[360px] text-[11.5px] leading-4 text-c-text-muted">
              {creatorFooterNote}
            </p>
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={onClose} disabled={isGenerating}>
              {t('interview.insightCreatorModal.cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 0 || isGenerating}
            >
              {t('interview.insightCreatorModal.back')}
            </Button>
            {currentStep === 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={submitInsight}
                disabled={!canGenerate}
              >
                {t('interview.creator.footer.runNow')}
              </Button>
            ) : null}
            {!isLastStep ? (
              <Button
                type="button"
                variant="primary"
                onClick={goToNextStep}
                disabled={isGenerating}
                className="min-w-[180px] bg-c-cta-bg text-c-cta-text"
              >
                {currentStep === 0
                  ? t('interview.creator.footer.nextMaterial')
                  : t('interview.creator.footer.nextRefine')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={submitInsight}
                disabled={!canGenerate}
                loading={isGenerating}
                icon={isGenerating ? undefined : <Sparkles size={16} />}
                className="min-w-[180px] bg-c-cta-bg text-c-cta-text"
              >
                {isGenerating
                  ? t('interview.insightCreatorModal.running')
                  : t('interview.creator.footer.runSessions', {
                      count: selectedSessions.length,
                    })}
              </Button>
            )}
          </div>
        }
      >
        <form
          onSubmit={handleFormSubmit}
          className="mx-auto h-full w-full max-w-[880px] overflow-y-auto overflow-x-hidden px-6 py-6 pb-[84px]"
        >
          {renderGlobalLoadError()}
          {renderCurrentStep()}
        </form>
      </WizardModal>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
      <div
        ref={dialogContainerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-creator-heading"
        data-creator-shell={creatorShellEnabled ? 'enabled' : undefined}
        tabIndex={-1}
        className={`mx-4 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 outline-none dark:border-white/[0.08] dark:bg-navy-900 ${creatorGeometryClassName}`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
          <h2
            id="insight-creator-heading"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300">
              <TeresaMark size={16} />
            </span>
            {t('interview.insightCreatorModal.aiInsightCreator')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('interview.insightCreatorModal.close', 'Close')}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <WizardStepper
          steps={wizardSteps}
          activeStepIndex={currentStep}
          maxReachableIndex={maxReachableIndex}
          onStepChange={handleStepChange}
          isPolish={isPolish}
          accentColor="#3b82f6"
        />

        {/* Content */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-auto px-6 py-5">
          {renderGlobalLoadError()}
          {renderCurrentStep()}
        </form>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/[0.08] dark:bg-navy-900/50">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isGenerating}>
            {t('interview.insightCreatorModal.cancel')}
          </Button>
          <div className="flex-1" />
          {currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={isGenerating}
            >
              {t('interview.insightCreatorModal.back')}
            </Button>
          )}
          {!isLastStep && (
            <Button
              type="button"
              variant="primary"
              onClick={goToNextStep}
              disabled={isGenerating}
              className="min-w-[180px]"
            >
              {t('interview.insightCreatorModal.next')}
            </Button>
          )}
          {isLastStep && (
            <Button
              type="button"
              variant="primary"
              onClick={submitInsight}
              disabled={!canGenerate}
              loading={isGenerating}
              icon={isGenerating ? undefined : <Sparkles size={16} />}
              className="min-w-[180px]"
            >
              {isGenerating
                ? t('interview.insightCreatorModal.running')
                : t('interview.insightCreatorModal.run')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightCreatorModal;
