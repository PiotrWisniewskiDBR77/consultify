/**
 * InsightCreatorModal - Advanced AI Insight Generator
 * BCG Enterprise Level - Multiple analysis types, filters, custom prompts
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Compass,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquare,
  Paperclip,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import { type V8ContextDocument, V8InterviewApi } from '@/services/api/v8/interview';

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
type CreatorStepId = 'goal' | 'people' | 'source' | 'analysis' | 'context';

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

interface InsightCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_CONTEXT_FILES = 5;
const MAX_CONTEXT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const CONTEXT_FILE_ACCEPT =
  '.txt,.md,.markdown,.csv,.json,.log,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';

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
}> = [
  {
    id: 'goal',
    labelPl: 'Cel',
    labelEn: 'Goal',
    hintPl: 'Co chcesz uzyskać?',
    hintEn: 'What should AI produce?',
  },
  {
    id: 'people',
    labelPl: 'Osoby',
    labelEn: 'People',
    hintPl: 'Kto ma wejść do analizy?',
    hintEn: 'Whose answers are in scope?',
  },
  {
    id: 'source',
    labelPl: 'Materiał',
    labelEn: 'Source',
    hintPl: 'Z jakich wywiadów korzystamy?',
    hintEn: 'Which interviews should be used?',
  },
  {
    id: 'analysis',
    labelPl: 'Analiza',
    labelEn: 'Analysis',
    hintPl: 'Jak AI ma czytać materiał?',
    hintEn: 'How should AI interpret it?',
  },
  {
    id: 'context',
    labelPl: 'Uwagi',
    labelEn: 'Context',
    hintPl: 'Dodatkowy kontekst i read-back',
    hintEn: 'Extra context and read-back',
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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

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

  // E7.3 / E7.4: Auto-fill custom prompt for special analysis types
  const applyPromptPreset = (type: InsightPromptType) => {
    if (type === 'between_the_lines') {
      setCustomPrompt(
        isPolish
          ? `Przeanalizuj odpowiedzi respondentów na głębokim poziomie. Szukaj:
1. UKRYTE INTENCJE — co respondent naprawdę chce osiągnąć, ale nie mówi wprost
2. SPRZECZNOŚCI — gdzie odpowiedzi jednej osoby są niespójne lub sprzeczne z innymi
3. UNIKI I OMIJANIE — tematy, których respondenci unikają lub bagatelizują
4. NIEWYPOWIEDZIANE CELE — cele polityczne, osobiste interesy, ukryte agendy
5. EMOCJE I NAPIĘCIA — gdzie widać frustrację, strach, entuzjazm lub opór
6. KŁAMSTWA I PRZESADA — odpowiedzi, które wydają się nieprawdopodobne lub przesadzone

Dla każdego znaleziska podaj: cytat, interpretację, poziom pewności (wysoki/średni/niski) i rekomendację.`
          : `Analyze respondent answers at a deep level. Look for:
1. HIDDEN INTENTIONS — what the respondent really wants to achieve but doesn't say directly
2. CONTRADICTIONS — where one person's answers are inconsistent or contradict others
3. EVASIONS — topics respondents avoid or downplay
4. UNSPOKEN GOALS — political goals, personal interests, hidden agendas
5. EMOTIONS & TENSIONS — where you see frustration, fear, enthusiasm, or resistance
6. LIES & EXAGGERATION — answers that seem implausible or exaggerated

For each finding provide: quote, interpretation, confidence level (high/medium/low), and recommendation.`
      );
    } else if (type === 'summary' && !customPrompt) {
      // E7.4: Precise formula for executive summaries
      setCustomPrompt(
        isPolish
          ? `Użyj precyzyjnej formuły konsultingowej:
1. KONTEKST (2-3 zdania) — cel wywiadów, zakres, liczba respondentów
2. KLUCZOWE WNIOSKI (5-7 punktów) — najważniejsze odkrycia, uszeregowane wg wpływu
3. WZORCE I TRENDY — powtarzające się tematy, wspólne obawy
4. ROZBIEŻNOŚCI — gdzie opinie się różnią i dlaczego
5. RYZYKA I SZANSE — zidentyfikowane zagrożenia i możliwości (tylko na podstawie danych, bez planów działań)`
          : `Use a precise consulting formula:
1. CONTEXT (2-3 sentences) — interview purpose, scope, number of respondents
2. KEY FINDINGS (5-7 points) — most important discoveries, ranked by impact
3. PATTERNS & TRENDS — recurring themes, common concerns
4. DIVERGENCES — where opinions differ and why
5. RISKS & OPPORTUNITIES — identified threats and possibilities (facts-only; no recommendations or next steps)`
      );
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionSelectionTouchedRef = useRef(false);

  // Data
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      toast.error(
        isPolish
          ? 'Nie udało się wczytać dokumentów kontekstowych.'
          : 'Failed to load context documents.'
      );
    } finally {
      setIsLoadingContextDocuments(false);
    }
  }, [isPolish]);

  const handleContextFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = MAX_CONTEXT_FILES;
    const toUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast(
        isPolish
          ? `Dodano tylko ${remainingSlots} plików (limit ${MAX_CONTEXT_FILES})`
          : `Only ${remainingSlots} file(s) added (limit ${MAX_CONTEXT_FILES})`
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
          toast.error(
            isPolish
              ? `Plik ${file.name} jest za duży (max 10 MB)`
              : `File ${file.name} is too large (max 10 MB)`
          );
          continue;
        }
        await V8InterviewApi.uploadContextDocument({
          file,
          scope: uploadScope,
          projectId: uploadProjectId,
        });
      }
      await fetchContextDocuments();
      toast.success(
        isPolish
          ? 'Dokumenty zostały wysłane do przetwarzania.'
          : 'Documents uploaded and sent for processing.'
      );
    } catch (error) {
      console.error('[InsightCreatorModal] Upload context document failed:', error);
      toast.error(
        isPolish
          ? 'Nie udało się wysłać dokumentu kontekstowego.'
          : 'Failed to upload context document.'
      );
    } finally {
      setIsUploadingContextDocument(false);
      event.target.value = '';
    }
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
      .map((type) => (isPolish ? type.namePl : type.name))
      .join(', ');
    const selectedAnalysisModeLabels = ANALYSIS_MODE_OPTIONS.filter((mode) =>
      selectedAnalysisModes.includes(mode.id)
    )
      .map((mode) => (isPolish ? mode.labelPl : mode.labelEn))
      .join(', ');
    const selectionContext =
      selectedTypes.length > 1 || selectedAnalysisModes.length > 1
        ? [
            selectedTypes.length > 1
              ? `${isPolish ? 'Wybrane typy wyniku' : 'Selected output types'}: ${selectedOutputLabels}`
              : '',
            selectedAnalysisModes.length > 1
              ? `${isPolish ? 'Wybrane soczewki analizy' : 'Selected analysis lenses'}: ${selectedAnalysisModeLabels}`
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
        ? `${isPolish ? 'Dodatkowe instrukcje wyboru' : 'Additional selection instructions'}:\n${selectionContext}`
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
          return nextSessions.map((session) => session.id);
        });

        if (sessionsResult.status === 'rejected') {
          const reason = sessionsResult.reason as
            | { status?: number; message?: string }
            | Error
            | undefined;
          const status = (reason as { status?: number } | undefined)?.status;
          if (status === 401 || status === 403) {
            setLoadError(
              isPolish
                ? 'Brak uprawnień do listy zakończonych sesji wywiadów. Poproś admina o capability INTERVIEW_VIEW.'
                : 'No permission to list completed interview sessions. Ask admin for INTERVIEW_VIEW capability.'
            );
          } else {
            setLoadError(
              isPolish
                ? 'Nie udało się wczytać zakończonych sesji wywiadów. Generowanie nadal może nie zadziałać, jeżeli model LLM nie jest dostępny.'
                : 'Failed to load completed interview sessions. Generation may still fail if the LLM model is unavailable.'
            );
          }
        }
        await fetchContextDocuments();
      } catch (error) {
        console.error('[InsightCreatorModal] Failed to load data:', error);
        setLoadError(
          isPolish
            ? 'Nie udało się wczytać zakończonych sesji wywiadów. Generowanie nadal może nie zadziałać, jeżeli model LLM nie jest dostępny.'
            : 'Failed to load completed interview sessions. Generation may still fail if the LLM model is unavailable.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [fetchContextDocuments, isOpen, isPolish]);

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
      setLoadError(null);
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

  const respondentOptions = useMemo(() => {
    const respondents = new Map<
      string,
      { id: string; name: string; role?: string; department?: string; sessionCount: number }
    >();
    completedSessions.forEach((session) => {
      if (!session.respondentId || !session.respondentName) return;
      const existing = respondents.get(session.respondentId);
      respondents.set(session.respondentId, {
        id: session.respondentId,
        name: session.respondentName,
        role: existing?.role || session.respondentRole,
        department: existing?.department || session.department,
        sessionCount: (existing?.sessionCount ?? 0) + 1,
      });
    });
    return Array.from(respondents.values());
  }, [completedSessions]);

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

  useEffect(() => {
    const visibleSessionIds = new Set(filteredSessions.map((session) => session.id));
    setSelectedSessions((prev) => {
      const visibleSelected = prev.filter((sessionId) => visibleSessionIds.has(sessionId));
      if (visibleSelected.length > 0 || sessionSelectionTouchedRef.current) {
        return visibleSelected;
      }
      return filteredSessions.map((session) => session.id);
    });
  }, [filteredSessions]);

  // Modal chrome stays monochromatic; semantic colors belong to data/status badges only.
  const getColorClasses = (color: string, variant: 'bg' | 'border' | 'text' | 'ring') => {
    void color;
    const colors: Record<'bg' | 'border' | 'text' | 'ring', string> = {
      bg: 'bg-slate-100 dark:bg-navy-800/80',
      border: 'border-slate-200 dark:border-white/[0.08]',
      text: 'text-slate-600 dark:text-slate-300',
      ring: 'ring-primary-500/30',
    };
    return colors[variant];
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(isPolish ? 'Podaj tytuł wniosków' : 'Enter insight title');
      return;
    }

    if (selectedSessions.length === 0) {
      toast.error(isPolish ? 'Wybierz przynajmniej jedną sesję' : 'Select at least one session');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(
      isPolish ? 'Generowanie wniosków AI...' : 'Generating AI insights...'
    );
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

      toast.dismiss(toastId);
      toast.success(isPolish ? 'Wnioski wygenerowane!' : 'Insights generated!');
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
        toast.error(
          isPolish
            ? 'Brak uprawnień do generowania wniosków (capability INTERVIEW_INSIGHT_CREATE / AI_LLM_USE).'
            : 'No permission to generate insights (capability INTERVIEW_INSIGHT_CREATE / AI_LLM_USE).',
          { duration: 6000 }
        );
      } else if (looksLikeLlm) {
        toast.error(
          isPolish
            ? 'Nie udało się wygenerować: model LLM jest niedostępny lub klucz API nie jest skonfigurowany. Skontaktuj się z administratorem.'
            : 'Generation failed: the LLM model is unavailable or the API key is not configured. Contact your administrator.',
          { duration: 6000 }
        );
      } else {
        toast.error(
          isPolish
            ? 'Nie udało się wygenerować wniosków. Sprawdź połączenie i spróbuj ponownie.'
            : 'Failed to generate insights. Check the connection and retry.'
        );
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
          if (status === 401 || status === 403) {
            setLoadError(
              isPolish
                ? 'Brak uprawnień do listy zakończonych sesji wywiadów. Poproś admina o capability INTERVIEW_VIEW.'
                : 'No permission to list completed interview sessions. Ask admin for INTERVIEW_VIEW capability.'
            );
          } else {
            setLoadError(
              isPolish
                ? 'Nie udało się wczytać zakończonych sesji wywiadów. Generowanie nadal może nie zadziałać, jeżeli model LLM nie jest dostępny.'
                : 'Failed to load completed interview sessions. Generation may still fail if the LLM model is unavailable.'
            );
          }
        }
        await fetchContextDocuments();
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const canCompleteStep = (stepIndex: number): boolean => {
    const stepId = CREATOR_STEPS[stepIndex]?.id;
    if (stepId === 'goal') return Boolean(title.trim() && selectedTypes.length > 0);
    if (stepId === 'source') return selectedSessions.length > 0;
    return true;
  };

  const getStepBlockerMessage = (stepIndex: number): string | null => {
    const stepId = CREATOR_STEPS[stepIndex]?.id;
    if (stepId === 'goal' && !title.trim()) {
      return isPolish ? 'Podaj tytuł wniosków.' : 'Enter an insight title.';
    }
    if (stepId === 'goal' && selectedTypes.length === 0) {
      return isPolish
        ? 'Wybierz przynajmniej jeden typ wyniku.'
        : 'Select at least one output type.';
    }
    if (stepId === 'source' && selectedSessions.length === 0) {
      return isPolish
        ? 'Wybierz przynajmniej jedną sesję źródłową.'
        : 'Select at least one source session.';
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
      ? isPolish
        ? `${selectedSessions.length} zatwierdzonych sesji`
        : `${selectedSessions.length} approved session(s)`
      : isPolish
        ? 'Nie wybrano sesji'
        : 'No sessions selected';
  const selectedPeopleSummary =
    selectedRespondents.length === 0
      ? isPolish
        ? 'Wszystkie osoby'
        : 'All people'
      : isPolish
        ? `${selectedRespondents.length} wybranych osób`
        : `${selectedRespondents.length} selected people`;

  const isLastStep = currentStep === CREATOR_STEPS.length - 1;
  const canGenerate = !isGenerating;
  const getContextDocStatusMeta = (status: V8ContextDocument['status']) => {
    switch (status) {
      case 'ready':
        return {
          label: isPolish ? 'Gotowe' : 'Ready',
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        };
      case 'processing':
      case 'uploaded':
        return {
          label: isPolish ? 'Przetwarzanie' : 'Processing',
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        };
      case 'ocr_required':
        return {
          label: isPolish ? 'Wymaga OCR' : 'OCR required',
          className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        };
      case 'unreadable':
      case 'failed':
        return {
          label: isPolish ? 'Błąd odczytu' : 'Unreadable',
          className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        };
      default:
        return {
          label: status,
          className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        };
    }
  };

  const renderStepper = () => (
    <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/[0.08] dark:bg-navy-950/30">
      <div className="grid grid-cols-5 gap-1.5">
        {CREATOR_STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep && canCompleteStep(index);
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(index)}
              className={`rounded-xl border px-2 py-1.5 text-left transition-all ${
                isActive
                  ? 'border-primary-500/40 bg-primary-50 text-primary-700 ring-1 ring-primary-500/20 dark:bg-primary-500/15 dark:text-primary-200'
                  : isComplete
                    ? 'border-slate-200 bg-white text-slate-600 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-300'
                    : 'border-slate-200 bg-slate-100/70 text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50 dark:text-slate-400'
              } hover:border-primary-500/50`}
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
                <span className="text-xs font-semibold leading-none">
                  {isPolish ? step.labelPl : step.labelEn}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderGlobalLoadError = () => {
    if (!loadError || CREATOR_STEPS[currentStep]?.id === 'source') return null;
    return (
      <EmptyStateInline
        icon={AlertTriangle}
        dashed={false}
        message={loadError}
        hint={
          isPolish
            ? 'Sprawdź uprawnienia do modułu Wywiad oraz dostępność modelu LLM (capability AI_LLM_USE / klucz API). Po naprawie kliknij Ponów.'
            : 'Check Interview module permissions and LLM model availability (capability AI_LLM_USE / API key). Retry once fixed.'
        }
        action={{
          label: isPolish ? 'Ponów' : 'Retry',
          onClick: retryLoadData,
        }}
        className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900/50"
      />
    );
  };

  const renderGoalStep = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {isPolish ? 'Tytuł wniosków' : 'Insight Title'} *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            isPolish
              ? 'np. Analiza transformacji cyfrowej Q1 2024'
              : 'e.g. Digital Transformation Analysis Q1 2024'
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-500 transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {isPolish ? 'Typ wyniku' : 'Output type'} *
        </label>
        <div className="space-y-1.5">
          <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
            {ANALYSIS_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type.id);
              return (
                <label
                  key={type.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-all ${
                    isSelected
                      ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAnalysisType(type.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 dark:border-white/[0.18] dark:bg-navy-900"
                  />
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-md ${getColorClasses(
                      type.color,
                      'bg'
                    )} ${getColorClasses(type.color, 'text')}`}
                  >
                    {type.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {isPolish ? type.namePl : type.name}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? type.descriptionPl : type.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Typ wyniku kształtuje zawartość tego insightu. Nie tworzy automatycznie raportu, prezentacji ani obiektu w aplikacji.'
              : 'Output type shapes this insight only. It does not automatically create a report, presentation, or app object.'}
          </p>
          <p className="text-xs text-primary-400">
            {isPolish ? `Wybrano: ${selectedTypes.length}` : `Selected: ${selectedTypes.length}`}
          </p>
        </div>
      </div>
    </div>
  );

  const renderPeopleStep = () => (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wybierz osoby' : 'Select people'}
          </label>
          <button
            type="button"
            onClick={selectAllRespondents}
            className="text-xs text-primary-400 transition-colors hover:text-primary-300"
          >
            {isPolish ? 'Wszystkie osoby' : 'All people'}
          </button>
        </div>

        {respondentOptions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {isPolish
                ? 'Brak osób w zatwierdzonych wywiadach'
                : 'No people in approved interviews'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={selectAllRespondents}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                selectedRespondents.length === 0
                  ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedRespondents.length === 0}
                readOnly
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 dark:border-white/[0.18] dark:bg-navy-900"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {isPolish ? 'Wszystkie osoby' : 'All people'}
                </div>
              </div>
            </button>

            <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {respondentOptions.map((respondent) => {
                const isSelected = selectedRespondents.includes(respondent.id);
                return (
                  <label
                    key={respondent.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-all ${
                      isSelected
                        ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRespondent(respondent.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 dark:border-white/[0.18] dark:bg-navy-900"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {respondent.name}
                        {(respondent.role || respondent.department) && (
                          <span className="ml-2 font-normal text-slate-500">
                            {[respondent.role, respondent.department].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-primary-400">{selectedPeopleSummary}</p>
      </div>
    </div>
  );

  const renderSourceStep = () => (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Zakres dat materiału' : 'Material date range'}
          </label>
          {(filterDateFrom || filterDateTo) && (
            <button
              type="button"
              onClick={() => {
                setUseDateFilter(false);
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-xs text-primary-400 transition-colors hover:text-primary-300"
            >
              {isPolish ? 'Cały okres' : 'All dates'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filterDateFrom}
            onChange={(event) => {
              const nextFrom = event.target.value;
              setFilterDateFrom(nextFrom);
              setUseDateFilter(Boolean(nextFrom || filterDateTo));
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
            aria-label={isPolish ? 'Data od' : 'Date from'}
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(event) => {
              const nextTo = event.target.value;
              setFilterDateTo(nextTo);
              setUseDateFilter(Boolean(filterDateFrom || nextTo));
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
            aria-label={isPolish ? 'Data do' : 'Date to'}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {isPolish ? 'Rola respondenta' : 'Respondent role'}
            </label>
            {filterRole && (
              <button
                type="button"
                onClick={() => {
                  setUseRoleFilter(false);
                  setFilterRole('');
                }}
                className="text-xs text-primary-400 transition-colors hover:text-primary-300"
              >
                {isPolish ? 'Wszystkie role' : 'All roles'}
              </button>
            )}
          </div>
          <select
            value={filterRole}
            onChange={(event) => {
              const nextRole = event.target.value;
              setFilterRole(nextRole);
              setUseRoleFilter(Boolean(nextRole));
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
            aria-label={isPolish ? 'Filtr roli respondenta' : 'Respondent role filter'}
          >
            <option value="">{isPolish ? 'Wszystkie role' : 'All roles'}</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {isPolish ? 'Dział respondenta' : 'Respondent department'}
            </label>
            {filterDepartment && (
              <button
                type="button"
                onClick={() => {
                  setUseDepartmentFilter(false);
                  setFilterDepartment('');
                }}
                className="text-xs text-primary-400 transition-colors hover:text-primary-300"
              >
                {isPolish ? 'Wszystkie działy' : 'All departments'}
              </button>
            )}
          </div>
          <select
            value={filterDepartment}
            onChange={(event) => {
              const nextDepartment = event.target.value;
              setFilterDepartment(nextDepartment);
              setUseDepartmentFilter(Boolean(nextDepartment));
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-primary-500 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
            aria-label={isPolish ? 'Filtr działu respondenta' : 'Respondent department filter'}
          >
            <option value="">{isPolish ? 'Wszystkie działy' : 'All departments'}</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wybierz sesje źródłowe' : 'Select source sessions'} *
          </label>
          {filteredSessions.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSessions}
              className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              {filteredSessions.every((session) => selectedSessions.includes(session.id))
                ? isPolish
                  ? 'Odznacz wszystkie'
                  : 'Deselect all'
                : isPolish
                  ? 'Zaznacz wszystkie'
                  : 'Select all'}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary-400" />
          </div>
        ) : loadError ? (
          <EmptyStateInline
            icon={AlertTriangle}
            dashed={false}
            message={loadError}
            hint={
              isPolish
                ? 'Sprawdź uprawnienia do modułu Wywiad oraz dostępność modelu LLM (capability AI_LLM_USE / klucz API). Po naprawie kliknij Ponów.'
                : 'Check Interview module permissions and LLM model availability (capability AI_LLM_USE / API key). Retry once fixed.'
            }
            action={{
              label: isPolish ? 'Ponów' : 'Retry',
              onClick: retryLoadData,
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-navy-900/50"
          />
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-8 text-center text-slate-500 dark:border-white/[0.08] dark:bg-navy-900/50">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {isPolish
                ? 'Brak zatwierdzonych i zakończonych sesji'
                : 'No approved completed sessions'}
            </p>
            {(filterTemplate ||
              filterRespondent ||
              filterRole ||
              filterDepartment ||
              filterDateFrom ||
              filterDateTo) && (
              <p className="text-xs mt-1">
                {isPolish ? 'Spróbuj zmienić filtry' : 'Try changing filters'}
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
            {filteredSessions.map((session) => {
              const isSelected = selectedSessions.includes(session.id);
              return (
                <label
                  key={session.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-all ${
                    isSelected
                      ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSession(session.id)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 dark:border-white/[0.18] dark:bg-navy-900"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {session.name || 'Interview Session'}
                      <span className="ml-2 font-normal text-slate-500">
                        {session.answeredQuestions}/{session.totalQuestions}{' '}
                        {isPolish ? 'pytań' : 'questions'}
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

        <p className="text-xs text-primary-400 mt-2">{selectedSourceSummary}</p>
      </div>
    </div>
  );

  const renderAnalysisStep = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {isPolish ? 'Tryb analizy' : 'Analysis mode'}
        </label>
        <div className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {ANALYSIS_MODE_OPTIONS.map((mode) => {
            const isSelected = selectedAnalysisModes.includes(mode.id);
            return (
              <label
                key={mode.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-all ${
                  isSelected
                    ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.08] dark:bg-navy-900/70 dark:hover:border-white/[0.16]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleAnalysisMode(mode.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 dark:border-white/[0.18] dark:bg-navy-900"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {isPolish ? mode.labelPl : mode.labelEn}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? mode.hintPl : mode.hintEn}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Tryby analizy są soczewkami promptu dla jednego insightu. Nie uruchamiają downstream actions bez osobnego zatwierdzenia.'
            : 'Analysis modes are prompt lenses for one insight. They do not run downstream actions without separate approval.'}
        </p>
        <p className="mt-2 text-xs text-primary-400">
          {isPolish
            ? `Wybrano: ${selectedAnalysisModes.length}`
            : `Selected: ${selectedAnalysisModes.length}`}
        </p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500">
            {isPolish ? 'Zakres tematyczny' : 'Topic focus'}
          </label>
          {selectedTopicFocus.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTopicFocus([])}
              className="text-xs text-primary-400 transition-colors hover:text-primary-300"
            >
              {isPolish ? 'Ogólnie' : 'General'}
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
                className={`truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all ${
                  selected
                    ? 'border-primary-500/50 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary-500/40 dark:border-white/[0.08] dark:bg-navy-900/70 dark:text-slate-200'
                }`}
              >
                {isPolish ? topic.labelPl : topic.labelEn}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-primary-400">
          {selectedTopicFocus.length === 0
            ? isPolish
              ? 'Brak wyboru = ogólna synteza konsultingowa'
              : 'No selection = general consulting synthesis'
            : isPolish
              ? `Wybrano: ${selectedTopicFocus.length}`
              : `Selected: ${selectedTopicFocus.length}`}
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-slate-500">
          {isPolish ? 'Zakres kontekstu AI' : 'AI context boundary'}
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
                className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                  selected
                    ? 'border-primary-500/50 bg-primary-50 ring-1 ring-primary-500/20 dark:bg-primary-500/15'
                    : 'border-slate-200 bg-white hover:border-primary-500/40 dark:border-white/[0.08] dark:bg-navy-900/70'
                }`}
              >
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isPolish ? option.titlePl : option.titleEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderContextStep = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {isPolish ? 'Pytanie prowadzące' : 'Leading question'}
        </label>
        <input
          type="text"
          value={leadingQuestion}
          onChange={(event) => setLeadingQuestion(event.target.value)}
          placeholder={
            isPolish
              ? 'np. Gdzie najczęściej pękają odpowiedzialności między działami?'
              : 'e.g. Where do ownership handoffs most often break?'
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {isPolish ? 'Uwagi' : 'Notes'}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={3}
          placeholder={
            isPolish
              ? 'np. Skup się na różnicach między działem IT a biznesem. Użyj języka polskiego.'
              : 'e.g. Focus on differences between IT and business departments. Use formal language.'
          }
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-500 transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/[0.08] dark:bg-navy-900/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Paperclip size={14} className="text-slate-400" />
            <span>
              {isPolish
                ? 'Dokumenty (TXT/MD/CSV/JSON/PDF/DOC/XLS/PPT, max 5 plików po 10 MB)'
                : 'Documents (TXT/MD/CSV/JSON/PDF/DOC/XLS/PPT, max 5 files, 10 MB each)'}
            </span>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition-colors hover:border-primary-500 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-200">
            <Paperclip size={12} />
            {isUploadingContextDocument
              ? isPolish
                ? 'Wysyłanie...'
                : 'Uploading...'
              : isPolish
                ? 'Dodaj pliki'
                : 'Add files'}
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
        </div>
        {isLoadingContextDocuments ? (
          <div className="mt-3 flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-slate-400" />
          </div>
        ) : contextDocuments.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500 dark:border-white/[0.15] dark:bg-navy-900/60">
            {isPolish
              ? 'Brak dokumentów kontekstowych. Dodaj pliki, aby zbudować kontekst organizacji/projektu.'
              : 'No context documents yet. Upload files to build organization/project context.'}
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
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 transition-all ${
                    selected
                      ? 'border-primary-500/50 bg-primary-50 dark:bg-primary-500/15'
                      : 'border-slate-200 bg-white dark:border-white/[0.08] dark:bg-navy-900/70'
                  } ${disabled ? 'opacity-80' : 'cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.16]'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => toggleContextDocument(doc)}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.18] dark:bg-navy-900"
                  />
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
                      <p className="mt-0.5 text-[11px] text-rose-500">{doc.processingError}</p>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {isPolish
              ? `Wybrane dokumenty: ${selectedContextDocumentIds.length}`
              : `Selected documents: ${selectedContextDocumentIds.length}`}
          </span>
          <button
            type="button"
            onClick={() => void fetchContextDocuments()}
            className="text-primary-500 hover:text-primary-400"
          >
            {isPolish ? 'Odśwież' : 'Refresh'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          {isPolish ? 'Linki do artefaktów wewnętrznych' : 'Internal artifact links'}
        </label>
        <textarea
          value={internalArtifactLinks}
          onChange={(e) => setInternalArtifactLinks(e.target.value)}
          rows={2}
          placeholder={
            isPolish
              ? 'Wklej po jednym linku lub identyfikatorze artefaktu w linii.'
              : 'Paste one link or artifact identifier per line.'
          }
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-500 transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 dark:border-white/[0.1] dark:bg-navy-900/70 dark:text-slate-100"
        />
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    const stepId = CREATOR_STEPS[currentStep]?.id;
    if (stepId === 'goal') return renderGoalStep();
    if (stepId === 'people') return renderPeopleStep();
    if (stepId === 'source') return renderSourceStep();
    if (stepId === 'analysis') return renderAnalysisStep();
    return renderContextStep();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm">
      <div className="mx-4 flex h-[560px] w-[720px] max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/[0.08] dark:bg-navy-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/[0.08]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles size={20} className="text-slate-500 dark:text-slate-400" />
            {isPolish ? 'Kreator Wniosków AI' : 'AI Insight Creator'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {renderStepper()}

        {/* Content */}
        <form onSubmit={handleFormSubmit} className="flex-1 space-y-4 overflow-auto p-3">
          {renderGlobalLoadError()}
          {renderCurrentStep()}
        </form>

        {/* Footer */}
        <div className="flex shrink-0 gap-3 border-t border-slate-200 p-3 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <div className="flex-1" />
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={isGenerating}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.1] dark:bg-navy-900 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              {isPolish ? 'Wstecz' : 'Back'}
            </button>
          )}
          {!isLastStep && (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={isGenerating}
              className="min-w-[150px] rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPolish ? 'Dalej' : 'Next'}
            </button>
          )}
          {isLastStep && (
            <button
              type="button"
              onClick={submitInsight}
              disabled={!canGenerate}
              className="flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isPolish ? 'Wykonywanie...' : 'Running...'}
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {isPolish ? 'Wykonaj' : 'Run'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightCreatorModal;
