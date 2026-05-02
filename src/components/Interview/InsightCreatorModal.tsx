/**
 * InsightCreatorModal - Advanced AI Insight Generator
 * BCG Enterprise Level - Multiple analysis types, filters, custom prompts
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Calendar,
  ChevronDown,
  FileText,
  Filter,
  Lightbulb,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import { V8InterviewApi } from '@/services/api/v8/interview';

// ==========================================
// TYPES
// ==========================================

export type InsightPromptType =
  | 'summary'
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

interface CompletedSession {
  id: string;
  name: string;
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

const TOPIC_FOCUS_OPTIONS = [
  { id: 'risks', labelPl: 'Ryzyka', labelEn: 'Risks' },
  { id: 'opportunities', labelPl: 'Szanse', labelEn: 'Opportunities' },
  { id: 'contradictions', labelPl: 'Sprzeczności', labelEn: 'Contradictions' },
  { id: 'process', labelPl: 'Procesy', labelEn: 'Process' },
  { id: 'people', labelPl: 'Ludzie i role', labelEn: 'People and roles' },
  { id: 'technology', labelPl: 'Technologia', labelEn: 'Technology' },
  { id: 'governance', labelPl: 'Decyzyjność i governance', labelEn: 'Governance' },
  { id: 'customer_value', labelPl: 'Wartość dla klienta', labelEn: 'Customer value' },
  { id: 'operating_model', labelPl: 'Model operacyjny', labelEn: 'Operating model' },
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
  const [analysisMode, setAnalysisMode] = useState<InsightAnalysisMode>(
    'general_consulting_synthesis'
  );
  const [contextMode, setContextMode] = useState<InsightContextMode>(
    'selected_interview_material_only'
  );
  const [topicFocus, setTopicFocus] = useState<string[]>([]);
  const [consultantNote, setConsultantNote] = useState('');
  const [leadingQuestion, setLeadingQuestion] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  // E7.3 / E7.4: Auto-fill custom prompt for special analysis types
  const handleTypeChange = (type: InsightPromptType) => {
    setSelectedType(type);
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterTemplate, setFilterTemplate] = useState<string>('');
  const [filterRespondent, setFilterRespondent] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Data
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [sessionsRes, templatesRes] = await Promise.allSettled([
          Api.get('/interview/sessions/completed'),
          Api.get('/interview/templates'),
        ]);

        const nextSessions =
          sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)
            ? sessionsRes.value
            : [];
        const nextTemplates =
          templatesRes.status === 'fulfilled' && Array.isArray(templatesRes.value)
            ? templatesRes.value
            : [];

        setCompletedSessions(nextSessions);
        setTemplates(nextTemplates);

        if (sessionsRes.status === 'rejected' || templatesRes.status === 'rejected') {
          setLoadError(
            isPolish
              ? 'Nie udało się wczytać danych do generatora wniosków.'
              : 'Failed to load insight generator data.'
          );
        }
      } catch (error) {
        console.error('[InsightCreatorModal] Failed to load data:', error);
        setLoadError(
          isPolish
            ? 'Nie udało się wczytać danych do generatora wniosków.'
            : 'Failed to load insight generator data.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSelectedType('summary');
      setAnalysisMode('general_consulting_synthesis');
      setContextMode('selected_interview_material_only');
      setTopicFocus([]);
      setConsultantNote('');
      setLeadingQuestion('');
      setSelectedSessions([]);
      setCustomPrompt('');
      setShowFilters(false);
      setFilterTemplate('');
      setFilterRespondent('');
      setFilterRole('');
      setFilterDepartment('');
      setFilterDateFrom('');
      setFilterDateTo('');
      setLoadError(null);
    }
  }, [isOpen]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let sessions = completedSessions;

    if (filterTemplate) {
      sessions = sessions.filter((s) => s.templateId === filterTemplate);
    }

    if (filterRespondent) {
      sessions = sessions.filter((s) => s.respondentId === filterRespondent);
    }

    if (filterRole) {
      sessions = sessions.filter((s) => s.respondentRole === filterRole);
    }

    if (filterDepartment) {
      sessions = sessions.filter((s) => s.department === filterDepartment);
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      sessions = sessions.filter((s) => s.completedAt && new Date(s.completedAt) >= from);
    }

    if (filterDateTo) {
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
  ]);

  const respondentOptions = useMemo(
    () =>
      Array.from(
        new Map(
          completedSessions
            .filter((s) => s.respondentId && s.respondentName)
            .map((s) => [s.respondentId as string, s.respondentName as string])
        ).entries()
      ),
    [completedSessions]
  );

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(completedSessions.map((s) => s.respondentRole).filter(Boolean) as string[])
      ),
    [completedSessions]
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(completedSessions.map((s) => s.department).filter(Boolean) as string[])),
    [completedSessions]
  );

  // Get selected analysis type
  const selectedAnalysisType = ANALYSIS_TYPES.find((t) => t.id === selectedType);
  const selectedAnalysisMode = ANALYSIS_MODE_OPTIONS.find((mode) => mode.id === analysisMode);

  // Color classes helper
  const getColorClasses = (color: string, variant: 'bg' | 'border' | 'text' | 'ring') => {
    const colors: Record<string, Record<string, string>> = {
      blue: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500',
        text: 'text-blue-400',
        ring: 'ring-blue-500/30',
      },
      purple: {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500',
        text: 'text-purple-400',
        ring: 'ring-purple-500/30',
      },
      red: {
        bg: 'bg-red-500/20',
        border: 'border-red-500',
        text: 'text-red-400',
        ring: 'ring-red-500/30',
      },
      amber: {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500',
        text: 'text-amber-400',
        ring: 'ring-amber-500/30',
      },
      cyan: {
        bg: 'bg-cyan-500/20',
        border: 'border-cyan-500',
        text: 'text-cyan-400',
        ring: 'ring-cyan-500/30',
      },
      orange: {
        bg: 'bg-orange-500/20',
        border: 'border-orange-500',
        text: 'text-orange-400',
        ring: 'ring-orange-500/30',
      },
      rose: {
        bg: 'bg-rose-500/20',
        border: 'border-rose-500',
        text: 'text-rose-400',
        ring: 'ring-rose-500/30',
      },
      emerald: {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        ring: 'ring-emerald-500/30',
      },
      indigo: {
        bg: 'bg-indigo-500/20',
        border: 'border-indigo-500',
        text: 'text-indigo-400',
        ring: 'ring-indigo-500/30',
      },
      violet: {
        bg: 'bg-violet-500/20',
        border: 'border-violet-500',
        text: 'text-violet-400',
        ring: 'ring-violet-500/30',
      },
    };
    return colors[color]?.[variant] || '';
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

    try {
      await V8InterviewApi.createInsight({
        title: title.trim(),
        sessionIds: selectedSessions,
        promptType: selectedType,
        filters: {
          templateId: filterTemplate || undefined,
          respondentId: filterRespondent || undefined,
          roles: filterRole ? [filterRole] : undefined,
          departments: filterDepartment ? [filterDepartment] : undefined,
          dateFrom: filterDateFrom || undefined,
          dateTo: filterDateTo || undefined,
          topicFocus,
        },
        analysisScope: {
          source_session_ids: selectedSessions,
          source_scope_status: 'approved_only',
          respondent_filters: filterRespondent ? [filterRespondent] : [],
          role_filters: filterRole ? [filterRole] : [],
          department_filters: filterDepartment ? [filterDepartment] : [],
          template_filters: filterTemplate ? [filterTemplate] : [],
          date_range:
            filterDateFrom || filterDateTo
              ? { from: filterDateFrom || undefined, to: filterDateTo || undefined }
              : undefined,
          topic_focus: topicFocus,
          analysis_mode: analysisMode,
          context_mode: contextMode,
          consultant_note: consultantNote.trim() || null,
          leading_question: leadingQuestion.trim() || null,
        },
        analysisMode,
        contextMode,
        topicFocus,
        consultantNote: consultantNote.trim() || undefined,
        leadingQuestion: leadingQuestion.trim() || undefined,
        customPrompt: customPrompt.trim() || undefined,
      }).catch(() =>
        Api.post('/interview/insights', {
          title: title.trim(),
          sessionIds: selectedSessions,
          promptType: selectedType,
          filters: {
            templateId: filterTemplate || undefined,
            respondentId: filterRespondent || undefined,
            roles: filterRole ? [filterRole] : undefined,
            departments: filterDepartment ? [filterDepartment] : undefined,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
            topicFocus,
          },
          analysisScope: {
            source_session_ids: selectedSessions,
            source_scope_status: 'approved_only',
            respondent_filters: filterRespondent ? [filterRespondent] : [],
            role_filters: filterRole ? [filterRole] : [],
            department_filters: filterDepartment ? [filterDepartment] : [],
            template_filters: filterTemplate ? [filterTemplate] : [],
            date_range:
              filterDateFrom || filterDateTo
                ? { from: filterDateFrom || undefined, to: filterDateTo || undefined }
                : undefined,
            topic_focus: topicFocus,
            analysis_mode: analysisMode,
            context_mode: contextMode,
            consultant_note: consultantNote.trim() || null,
            leading_question: leadingQuestion.trim() || null,
          },
          analysisMode,
          contextMode,
          topicFocus,
          consultantNote: consultantNote.trim() || undefined,
          leadingQuestion: leadingQuestion.trim() || undefined,
          customPrompt: customPrompt.trim() || undefined,
        })
      );

      toast.dismiss(toastId);
      toast.success(isPolish ? 'Wnioski wygenerowane!' : 'Insights generated!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(isPolish ? 'Nie udało się wygenerować wniosków' : 'Failed to generate insights');
      console.error('[InsightCreatorModal] Failed to generate insight:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle session selection
  const toggleSession = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const toggleTopicFocus = (topicId: string) => {
    setTopicFocus((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  // Select all / deselect all
  const toggleAllSessions = () => {
    if (selectedSessions.length === filteredSessions.length) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(filteredSessions.map((s) => s.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles size={20} className="text-amber-400" />
            {isPolish ? 'Kreator Wniosków AI' : 'AI Insight Creator'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-5">
          {/* Title */}
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
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
          </div>

          {/* Analysis Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish ? 'Typ analizy' : 'Analysis Type'} *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-navy-800 border text-left transition-all ${
                  showTypeDropdown
                    ? 'border-primary-500 ring-1 ring-primary-500/30'
                    : 'border-navy-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  {selectedAnalysisType && (
                    <>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          selectedAnalysisType.color,
                          'bg'
                        )} ${getColorClasses(selectedAnalysisType.color, 'text')}`}
                      >
                        {selectedAnalysisType.icon}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {isPolish ? selectedAnalysisType.namePl : selectedAnalysisType.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish
                            ? selectedAnalysisType.descriptionPl
                            : selectedAnalysisType.description}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <ChevronDown
                  size={18}
                  className={`text-slate-500 dark:text-slate-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown */}
              {showTypeDropdown && (
                <div className="absolute z-10 mt-2 w-full bg-navy-800 border border-navy-600 rounded-lg shadow-xl max-h-80 overflow-auto">
                  {/* Basic */}
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {isPolish ? 'Podstawowe' : 'Basic'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'basic').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        handleTypeChange(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-slate-100 dark:bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Advanced */}
                  <div className="px-3 py-2 border-b border-t border-navy-700">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {isPolish ? 'Zaawansowane' : 'Advanced'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'advanced').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        handleTypeChange(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-slate-100 dark:bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* BCG Frameworks */}
                  <div className="px-3 py-2 border-b border-t border-navy-700">
                    <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                      {isPolish ? 'BCG Frameworks' : 'BCG Frameworks'}
                    </span>
                  </div>
                  {ANALYSIS_TYPES.filter((t) => t.category === 'bcg').map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        handleTypeChange(type.id);
                        setShowTypeDropdown(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors ${
                        selectedType === type.id ? 'bg-slate-100 dark:bg-navy-700' : ''
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClasses(
                          type.color,
                          'bg'
                        )} ${getColorClasses(type.color, 'text')}`}
                      >
                        {type.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">
                          {isPolish ? type.namePl : type.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {isPolish ? type.descriptionPl : type.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scope Builder */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Target size={16} />
                {isPolish ? 'Zakres insightu' : 'Insight scope'}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {isPolish
                  ? 'Insight powstaje wyłącznie z zatwierdzonych, zakończonych wywiadów. Nie wybieramy pojedynczych odpowiedzi, tylko koszyk materiału i kierunek analizy.'
                  : 'Insights are generated only from approved completed interviews. Select a source basket and analysis direction, not individual answers.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {isPolish ? 'Tryb analizy' : 'Analysis mode'}
              </label>
              <select
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value as InsightAnalysisMode)}
                className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
              >
                {ANALYSIS_MODE_OPTIONS.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {isPolish ? mode.labelPl : mode.labelEn}
                  </option>
                ))}
              </select>
              {selectedAnalysisMode && (
                <p className="mt-1 text-xs text-slate-500">
                  {isPolish ? selectedAnalysisMode.hintPl : selectedAnalysisMode.hintEn}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                {isPolish ? 'Wątki tematyczne' : 'Topic focus'}
              </label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_FOCUS_OPTIONS.map((topic) => {
                  const selected = topicFocus.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => toggleTopicFocus(topic.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-navy-600 bg-navy-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isPolish ? topic.labelPl : topic.labelEn}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {isPolish
                  ? 'Brak wyboru oznacza analizę ogólną, w której AI samo wskaże najważniejsze obserwacje.'
                  : 'No selection means a general synthesis where AI identifies the highest-value observations.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                {isPolish ? 'Kontekst AI' : 'AI context'}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  {
                    id: 'selected_interview_material_only' as InsightContextMode,
                    titlePl: 'Tylko wybrany materiał',
                    titleEn: 'Selected material only',
                    hintPl: 'Najbezpieczniejsze do audytu źródłowego.',
                    hintEn: 'Best for strict source audit.',
                  },
                  {
                    id: 'selected_material_plus_approved_org_knowledge' as InsightContextMode,
                    titlePl: 'Materiał + wiedza organizacji',
                    titleEn: 'Material + org knowledge',
                    hintPl: 'Dobre dla szerszej syntezy i inicjatyw.',
                    hintEn: 'Better for broader synthesis and initiatives.',
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setContextMode(option.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      contextMode === option.id
                        ? 'border-primary-400 bg-primary-500/15'
                        : 'border-navy-700 bg-navy-800/70 hover:border-navy-500'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">
                      {isPolish ? option.titlePl : option.titleEn}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {isPolish ? option.hintPl : option.hintEn}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {isPolish ? 'Pytanie przewodnie (opcjonalnie)' : 'Leading question (optional)'}
                </label>
                <input
                  value={leadingQuestion}
                  onChange={(e) => setLeadingQuestion(e.target.value)}
                  placeholder={
                    isPolish
                      ? 'np. Czy problemem jest governance czy kompetencje?'
                      : 'e.g. Is the problem governance or capabilities?'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-sm text-white placeholder-slate-500 focus:border-primary-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  {isPolish ? 'Notatka konsultanta (opcjonalnie)' : 'Consultant note (optional)'}
                </label>
                <input
                  value={consultantNote}
                  onChange={(e) => setConsultantNote(e.target.value)}
                  placeholder={
                    isPolish
                      ? 'Co może być ciekawe w tej analizie?'
                      : 'What may be interesting in this analysis?'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-sm text-white placeholder-slate-500 focus:border-primary-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Filters Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Filter size={16} />
              <span>{isPolish ? 'Filtry' : 'Filters'}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilters && (
              <div className="mt-3 p-3 bg-navy-800/50 border border-navy-700 rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Template filter */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Szablon' : 'Template'}
                    </label>
                    <select
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    >
                      <option value="">{isPolish ? 'Wszystkie' : 'All'}</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Osoba' : 'Person'}
                    </label>
                    <select
                      value={filterRespondent}
                      onChange={(e) => setFilterRespondent(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    >
                      <option value="">{isPolish ? 'Wszystkie' : 'All'}</option>
                      {respondentOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Rola' : 'Role'}
                    </label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    >
                      <option value="">{isPolish ? 'Wszystkie' : 'All'}</option>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Dział' : 'Department'}
                    </label>
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    >
                      <option value="">{isPolish ? 'Wszystkie' : 'All'}</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date from */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Data od' : 'Date from'}
                    </label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    />
                  </div>

                  {/* Date to */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {isPolish ? 'Data do' : 'Date to'}
                    </label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 rounded bg-navy-800 border border-navy-600 text-sm text-white focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session Selection */}
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
                  {selectedSessions.length === filteredSessions.length
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
                message={
                  isPolish
                    ? 'Generator wniosków jest chwilowo niedostępny.'
                    : 'Insight generator is temporarily unavailable.'
                }
                hint={
                  isPolish
                ? 'To nie oznacza, że nie ma zakończonych sesji. Spróbuj ponownie wczytać dane.'
                : 'This does not mean there are no completed sessions. Retry loading the data.'
                }
                action={{
                  label: isPolish ? 'Ponów' : 'Retry',
                  onClick: () => {
                    setIsLoading(true);
                    setLoadError(null);
                    void (async () => {
                      try {
                        const [sessionsRes, templatesRes] = await Promise.allSettled([
                          Api.get('/interview/sessions/completed'),
                          Api.get('/interview/templates'),
                        ]);

                        const nextSessions =
                          sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)
                            ? sessionsRes.value
                            : [];
                        const nextTemplates =
                          templatesRes.status === 'fulfilled' && Array.isArray(templatesRes.value)
                            ? templatesRes.value
                            : [];

                        setCompletedSessions(nextSessions);
                        setTemplates(nextTemplates);

                        if (
                          sessionsRes.status === 'rejected' ||
                          templatesRes.status === 'rejected'
                        ) {
                          setLoadError(
                            isPolish
                              ? 'Nie udało się wczytać danych do generatora wniosków.'
                              : 'Failed to load insight generator data.'
                          );
                        }
                      } finally {
                        setIsLoading(false);
                      }
                    })();
                  },
                }}
                className="bg-navy-800/50 rounded-lg border border-navy-700"
              />
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-navy-800/50 rounded-lg border border-navy-700">
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
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {filteredSessions.map((session) => {
                  const isSelected = selectedSessions.includes(session.id);
                  return (
                    <label
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary-500/15 border-primary-500'
                          : 'bg-navy-800 border-navy-700 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSession(session.id)}
                        className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-primary-500 focus:ring-primary-500/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate">
                          {session.name || 'Interview Session'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>
                            {session.answeredQuestions}/{session.totalQuestions}{' '}
                            {isPolish ? 'pytań' : 'questions'}
                          </span>
                          {session.templateName && (
                            <>
                              <span>•</span>
                              <span>{session.templateName}</span>
                            </>
                          )}
                          {session.respondentRole && (
                            <>
                              <span>•</span>
                              <span>{session.respondentRole}</span>
                            </>
                          )}
                          {session.department && (
                            <>
                              <span>•</span>
                              <span>{session.department}</span>
                            </>
                          )}
                          {session.completedAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(session.completedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="text-xs text-emerald-400">
                          {isPolish ? 'Zatwierdzona' : 'Approved'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedSessions.length > 0 && (
              <p className="text-xs text-primary-400 mt-2">
                {isPolish
                  ? `Wybrano ${selectedSessions.length} sesji`
                  : `${selectedSessions.length} session(s) selected`}
              </p>
            )}
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {isPolish
                ? 'Dodatkowe instrukcje (opcjonalnie)'
                : 'Additional instructions (optional)'}
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
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {isPolish
                ? 'Te instrukcje zostaną dodane do promptu AI'
                : 'These instructions will be added to the AI prompt'}
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-navy-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 rounded-lg bg-navy-800 border border-navy-600 text-slate-300 hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedSessions.length === 0 || !title.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-medium hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {isPolish ? 'Generowanie...' : 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {isPolish ? 'Generuj wnioski' : 'Generate Insights'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightCreatorModal;
