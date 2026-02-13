/**
 * InsightViewer - Full-page AI-generated insights view
 * Two-column layout following TaskDetailView Golden Standard
 * Extended with consulting-grade report sections:
 * - Executive Summary, Key Findings, Quotes & Evidence
 * - Patterns & Themes, Contradictions, Action Items
 * - Risk Flags, Data Quality, Stakeholder Sentiment
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Flag,
  Frown,
  Hash,
  History,
  Lightbulb,
  Loader2,
  Meh,
  MessageSquare,
  Minus,
  PieChart,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Send,
  Shuffle,
  Smile,
  Sparkles,
  Square,
  Star,
  Tag,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';

import {
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  type LinkedItem,
  LinkedItemsSection,
} from '../MyWork/shared';

// ==========================================
// TYPES
// ==========================================

type InsightPromptType =
  | 'summary'
  | 'trends'
  | 'problems'
  | 'recommendations'
  | 'comparison'
  | 'gaps'
  | 'risk_assessment'
  | 'opportunity_scan'
  | 'maturity'
  | 'stakeholder_map';

type InsightStatus = 'generating' | 'completed' | 'failed';

interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  status: InsightStatus;
  errorMessage?: string;
  sourceSessionCount: number;
  tokensUsed: number;
  generationTimeMs?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SourceSession {
  id: string;
  name: string;
  templateName?: string;
  completedAt?: string;
  respondentRole?: string;
  department?: string;
}

interface ActivityLogEntry {
  id: string;
  type: 'created' | 'regenerated' | 'exported' | 'comment' | 'edit';
  description: string;
  timestamp: string;
  userName?: string;
}

// New types for extended sections
interface KeyFinding {
  id: string;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  category?: string;
  sourceCount: number;
}

interface QuoteEvidence {
  id: string;
  quote: string;
  source: string;
  department?: string;
  role?: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface PatternTheme {
  id: string;
  theme: string;
  frequency: number;
  relatedKeywords: string[];
}

interface Contradiction {
  id: string;
  topic: string;
  viewA: string;
  viewB: string;
  sourceA: string;
  sourceB: string;
  severity: 'high' | 'medium' | 'low';
}

interface ActionItem {
  id: string;
  action: string;
  priority: 'high' | 'medium' | 'low';
  type: 'quick_win' | 'short_term' | 'long_term';
  owner?: string;
  completed: boolean;
}

interface RiskFlag {
  id: string;
  risk: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  mitigation?: string;
}

interface DataQuality {
  totalInterviews: number;
  departmentsCovered: string[];
  rolesCovered: string[];
  coveragePercentage: number;
  missingAreas: string[];
}

interface StakeholderSentiment {
  positive: number;
  neutral: number;
  negative: number;
  byDepartment: Record<string, { positive: number; neutral: number; negative: number }>;
}

interface InsightViewerProps {
  insightId: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onSaved?: (data: any) => void;
}

// ==========================================
// TYPE METADATA
// ==========================================

const TYPE_METADATA: Record<
  InsightPromptType,
  { icon: React.ReactNode; color: string; label: string; labelPl: string }
> = {
  summary: {
    icon: <FileText size={16} />,
    color: 'blue',
    label: 'Executive Summary',
    labelPl: 'Podsumowanie Wykonawcze',
  },
  trends: {
    icon: <TrendingUp size={16} />,
    color: 'purple',
    label: 'Trend Analysis',
    labelPl: 'Analiza Trendów',
  },
  problems: {
    icon: <AlertTriangle size={16} />,
    color: 'red',
    label: 'Problem Discovery',
    labelPl: 'Odkrywanie Problemów',
  },
  recommendations: {
    icon: <Lightbulb size={16} />,
    color: 'amber',
    label: 'Recommendations',
    labelPl: 'Rekomendacje',
  },
  comparison: {
    icon: <BarChart3 size={16} />,
    color: 'cyan',
    label: 'Cross-Interview Comparison',
    labelPl: 'Porównanie Wywiadów',
  },
  gaps: {
    icon: <Target size={16} />,
    color: 'orange',
    label: 'Gap Analysis',
    labelPl: 'Analiza Luk',
  },
  risk_assessment: {
    icon: <AlertTriangle size={16} />,
    color: 'rose',
    label: 'Risk Assessment',
    labelPl: 'Ocena Ryzyk',
  },
  opportunity_scan: {
    icon: <Zap size={16} />,
    color: 'emerald',
    label: 'Opportunity Scan',
    labelPl: 'Skan Szans',
  },
  maturity: {
    icon: <Brain size={16} />,
    color: 'indigo',
    label: 'Maturity Assessment',
    labelPl: 'Ocena Dojrzałości',
  },
  stakeholder_map: {
    icon: <Users size={16} />,
    color: 'violet',
    label: 'Stakeholder Mapping',
    labelPl: 'Mapa Interesariuszy',
  },
};

const STATUS_CONFIG = {
  generating: {
    label: { en: 'Generating', pl: 'Generowanie' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  completed: {
    label: { en: 'Completed', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  failed: {
    label: { en: 'Failed', pl: 'Błąd' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
};

// ==========================================
// MOCK DATA GENERATORS (for demo)
// ==========================================

const generateMockKeyFindings = (isPolish: boolean): KeyFinding[] => [
  {
    id: '1',
    content: isPolish
      ? 'Brak spójnej strategii cyfrowej między działami - każdy dział działa niezależnie'
      : 'Lack of coherent digital strategy across departments - each department operates independently',
    confidence: 'high',
    category: isPolish ? 'Strategia' : 'Strategy',
    sourceCount: 8,
  },
  {
    id: '2',
    content: isPolish
      ? 'Silne zaangażowanie kadry zarządzającej w transformację, ale słaba komunikacja do niższych szczebli'
      : 'Strong management commitment to transformation, but poor communication to lower levels',
    confidence: 'high',
    category: isPolish ? 'Komunikacja' : 'Communication',
    sourceCount: 6,
  },
  {
    id: '3',
    content: isPolish
      ? 'Systemy IT są przestarzałe i wymagają pilnej modernizacji'
      : 'IT systems are outdated and require urgent modernization',
    confidence: 'medium',
    category: isPolish ? 'Technologia' : 'Technology',
    sourceCount: 5,
  },
  {
    id: '4',
    content: isPolish
      ? 'Pracownicy wyrażają obawy o bezpieczeństwo zatrudnienia w kontekście automatyzacji'
      : 'Employees express concerns about job security in the context of automation',
    confidence: 'medium',
    category: isPolish ? 'Ludzie' : 'People',
    sourceCount: 4,
  },
  {
    id: '5',
    content: isPolish
      ? 'Konkurencja znacząco wyprzedza firmę w zakresie e-commerce'
      : 'Competition significantly ahead in e-commerce capabilities',
    confidence: 'high',
    category: isPolish ? 'Rynek' : 'Market',
    sourceCount: 3,
  },
];

const generateMockQuotes = (isPolish: boolean): QuoteEvidence[] => [
  {
    id: '1',
    quote: isPolish
      ? 'Każdy dział ma własne narzędzia i procesy. Nie ma żadnej koordynacji.'
      : 'Each department has its own tools and processes. There is no coordination.',
    source: 'Interview #3',
    department: isPolish ? 'IT' : 'IT',
    role: 'Director',
    tags: ['silos', 'coordination'],
    sentiment: 'negative',
  },
  {
    id: '2',
    quote: isPolish
      ? 'Zarząd naprawdę wierzy w tę transformację. Widzę ich zaangażowanie na każdym spotkaniu.'
      : 'Management really believes in this transformation. I see their commitment at every meeting.',
    source: 'Interview #5',
    department: isPolish ? 'Operacje' : 'Operations',
    role: 'Manager',
    tags: ['leadership', 'commitment'],
    sentiment: 'positive',
  },
  {
    id: '3',
    quote: isPolish
      ? 'Nikt nie wie, co się dzieje. Informacje docierają do nas z opóźnieniem lub wcale.'
      : 'Nobody knows what is happening. Information reaches us late or not at all.',
    source: 'Interview #7',
    department: isPolish ? 'Sprzedaż' : 'Sales',
    role: 'Team Lead',
    tags: ['communication', 'transparency'],
    sentiment: 'negative',
  },
  {
    id: '4',
    quote: isPolish
      ? 'Nasze systemy mają 15 lat. Codziennie walczymy z ich ograniczeniami.'
      : 'Our systems are 15 years old. We fight with their limitations every day.',
    source: 'Interview #2',
    department: isPolish ? 'IT' : 'IT',
    role: 'Senior Developer',
    tags: ['legacy', 'technology'],
    sentiment: 'negative',
  },
  {
    id: '5',
    quote: isPolish
      ? 'Widzę ogromny potencjał w automatyzacji naszych procesów. To może być game-changer.'
      : 'I see huge potential in automating our processes. This could be a game-changer.',
    source: 'Interview #9',
    department: isPolish ? 'Finanse' : 'Finance',
    role: 'CFO',
    tags: ['automation', 'opportunity'],
    sentiment: 'positive',
  },
];

const generateMockPatterns = (isPolish: boolean): PatternTheme[] => [
  {
    id: '1',
    theme: isPolish ? 'Silosy organizacyjne' : 'Organizational silos',
    frequency: 12,
    relatedKeywords: isPolish
      ? ['brak współpracy', 'izolacja', 'departamenty']
      : ['lack of collaboration', 'isolation', 'departments'],
  },
  {
    id: '2',
    theme: isPolish ? 'Przestarzała technologia' : 'Outdated technology',
    frequency: 9,
    relatedKeywords: isPolish
      ? ['legacy', 'systemy', 'modernizacja']
      : ['legacy', 'systems', 'modernization'],
  },
  {
    id: '3',
    theme: isPolish ? 'Problemy komunikacyjne' : 'Communication issues',
    frequency: 8,
    relatedKeywords: isPolish
      ? ['informacja', 'transparentność', 'feedback']
      : ['information', 'transparency', 'feedback'],
  },
  {
    id: '4',
    theme: isPolish ? 'Obawy pracowników' : 'Employee concerns',
    frequency: 6,
    relatedKeywords: isPolish
      ? ['zatrudnienie', 'szkolenia', 'zmiana']
      : ['employment', 'training', 'change'],
  },
  {
    id: '5',
    theme: isPolish ? 'Presja konkurencyjna' : 'Competitive pressure',
    frequency: 5,
    relatedKeywords: isPolish
      ? ['rynek', 'konkurencja', 'innowacje']
      : ['market', 'competition', 'innovation'],
  },
];

const generateMockContradictions = (isPolish: boolean): Contradiction[] => [
  {
    id: '1',
    topic: isPolish ? 'Tempo transformacji' : 'Transformation pace',
    viewA: isPolish
      ? 'Transformacja przebiega zbyt wolno, tracimy przewagę konkurencyjną'
      : 'Transformation is too slow, we are losing competitive advantage',
    viewB: isPolish
      ? 'Tempo jest odpowiednie, ludzie potrzebują czasu na adaptację'
      : 'The pace is appropriate, people need time to adapt',
    sourceA: isPolish ? 'Zarząd' : 'Management',
    sourceB: isPolish ? 'Pracownicy operacyjni' : 'Operational staff',
    severity: 'high',
  },
  {
    id: '2',
    topic: isPolish ? 'Priorytet inwestycji' : 'Investment priority',
    viewA: isPolish
      ? 'Najpierw ludzie i szkolenia, potem technologia'
      : 'People and training first, then technology',
    viewB: isPolish
      ? 'Bez nowych narzędzi nie możemy być efektywni'
      : 'Without new tools, we cannot be effective',
    sourceA: 'HR',
    sourceB: 'IT',
    severity: 'medium',
  },
  {
    id: '3',
    topic: isPolish ? 'Centralizacja vs autonomia' : 'Centralization vs autonomy',
    viewA: isPolish
      ? 'Potrzebujemy centralnej koordynacji wszystkich inicjatyw'
      : 'We need central coordination of all initiatives',
    viewB: isPolish
      ? 'Działy powinny mieć autonomię w wyborze rozwiązań'
      : 'Departments should have autonomy in choosing solutions',
    sourceA: isPolish ? 'CEO' : 'CEO',
    sourceB: isPolish ? 'Dyrektorzy działów' : 'Department Directors',
    severity: 'medium',
  },
];

const generateMockActionItems = (isPolish: boolean): ActionItem[] => [
  {
    id: '1',
    action: isPolish
      ? 'Utworzenie cross-funkcjonalnego zespołu ds. transformacji cyfrowej'
      : 'Create cross-functional digital transformation team',
    priority: 'high',
    type: 'quick_win',
    owner: 'CEO',
    completed: false,
  },
  {
    id: '2',
    action: isPolish
      ? 'Wdrożenie regularnych spotkań informacyjnych dla wszystkich pracowników'
      : 'Implement regular information meetings for all employees',
    priority: 'high',
    type: 'quick_win',
    owner: 'HR Director',
    completed: false,
  },
  {
    id: '3',
    action: isPolish
      ? 'Przeprowadzenie audytu systemów IT i przygotowanie roadmapy modernizacji'
      : 'Conduct IT systems audit and prepare modernization roadmap',
    priority: 'high',
    type: 'short_term',
    owner: 'CTO',
    completed: false,
  },
  {
    id: '4',
    action: isPolish
      ? 'Opracowanie programu szkoleń z kompetencji cyfrowych'
      : 'Develop digital skills training program',
    priority: 'medium',
    type: 'short_term',
    owner: 'HR',
    completed: false,
  },
  {
    id: '5',
    action: isPolish
      ? 'Stworzenie strategii e-commerce na najbliższe 3 lata'
      : 'Create e-commerce strategy for the next 3 years',
    priority: 'high',
    type: 'long_term',
    owner: 'CMO',
    completed: false,
  },
  {
    id: '6',
    action: isPolish
      ? 'Wdrożenie platformy do zarządzania wiedzą'
      : 'Implement knowledge management platform',
    priority: 'medium',
    type: 'long_term',
    owner: 'IT',
    completed: false,
  },
];

const generateMockRiskFlags = (isPolish: boolean): RiskFlag[] => [
  {
    id: '1',
    risk: isPolish
      ? 'Opór pracowników może spowolnić lub zablokować transformację'
      : 'Employee resistance may slow down or block transformation',
    severity: 'high',
    category: isPolish ? 'Ludzie' : 'People',
    mitigation: isPolish
      ? 'Program change management i regularna komunikacja'
      : 'Change management program and regular communication',
  },
  {
    id: '2',
    risk: isPolish
      ? 'Przestarzałe systemy mogą nie zintegrować się z nowymi rozwiązaniami'
      : 'Legacy systems may not integrate with new solutions',
    severity: 'high',
    category: isPolish ? 'Technologia' : 'Technology',
    mitigation: isPolish
      ? 'Stopniowa migracja z wykorzystaniem middleware'
      : 'Gradual migration using middleware',
  },
  {
    id: '3',
    risk: isPolish
      ? 'Brak jasnej odpowiedzialności za inicjatywy transformacyjne'
      : 'Lack of clear ownership for transformation initiatives',
    severity: 'medium',
    category: isPolish ? 'Governance' : 'Governance',
    mitigation: isPolish
      ? 'Powołanie PMO i jasna struktura RACI'
      : 'Establish PMO and clear RACI structure',
  },
  {
    id: '4',
    risk: isPolish
      ? 'Konkurencja może zwiększyć przewagę podczas naszej transformacji'
      : 'Competition may increase advantage during our transformation',
    severity: 'medium',
    category: isPolish ? 'Rynek' : 'Market',
    mitigation: isPolish
      ? 'Monitoring konkurencji i szybkie piloty'
      : 'Competitor monitoring and fast pilots',
  },
  {
    id: '5',
    risk: isPolish
      ? 'Niewystarczający budżet na pełną transformację'
      : 'Insufficient budget for full transformation',
    severity: 'low',
    category: isPolish ? 'Finanse' : 'Finance',
    mitigation: isPolish
      ? 'Fazowanie inwestycji i ROI-driven prioritization'
      : 'Phased investments and ROI-driven prioritization',
  },
];

const generateMockDataQuality = (isPolish: boolean): DataQuality => ({
  totalInterviews: 12,
  departmentsCovered: isPolish
    ? ['IT', 'Operacje', 'Sprzedaż', 'Finanse', 'HR', 'Marketing']
    : ['IT', 'Operations', 'Sales', 'Finance', 'HR', 'Marketing'],
  rolesCovered: isPolish
    ? ['C-Level', 'Dyrektorzy', 'Managerowie', 'Specjaliści']
    : ['C-Level', 'Directors', 'Managers', 'Specialists'],
  coveragePercentage: 75,
  missingAreas: isPolish ? ['Produkcja', 'Logistyka', 'R&D'] : ['Production', 'Logistics', 'R&D'],
});

const generateMockSentiment = (): StakeholderSentiment => ({
  positive: 35,
  neutral: 40,
  negative: 25,
  byDepartment: {
    IT: { positive: 20, neutral: 30, negative: 50 },
    Operations: { positive: 40, neutral: 45, negative: 15 },
    Sales: { positive: 25, neutral: 35, negative: 40 },
    Finance: { positive: 55, neutral: 35, negative: 10 },
    HR: { positive: 45, neutral: 40, negative: 15 },
  },
});

// ==========================================
// COMPONENT
// ==========================================

export const InsightViewer: React.FC<InsightViewerProps> = ({
  insightId,
  onClose,
  onRegenerate,
  onSaved,
}) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  // Core state
  const [insight, setInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [executiveSummary, setExecutiveSummary] = useState('');

  // AI generation states
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExpandingContent, setIsExpandingContent] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingAIComment, setIsGeneratingAIComment] = useState(false);
  const [isGeneratingFindings, setIsGeneratingFindings] = useState(false);

  // Export states
  const [isExportingTools, setIsExportingTools] = useState(false);
  const [isExportingAssessment, setIsExportingAssessment] = useState(false);

  // UI state - wszystkie sekcje domyślnie zamknięte dla czytelności
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

  // Related data
  const [sourceSessions, setSourceSessions] = useState<SourceSession[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Extended report data
  const [keyFindings, setKeyFindings] = useState<KeyFinding[]>([]);
  const [quotes, setQuotes] = useState<QuoteEvidence[]>([]);
  const [patterns, setPatterns] = useState<PatternTheme[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [sentiment, setSentiment] = useState<StakeholderSentiment | null>(null);

  // Quote filter
  const [quoteFilter, setQuoteFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>(
    'all'
  );

  // ==========================================
  // LOAD DATA
  // ==========================================

  useEffect(() => {
    const loadInsight = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.get(`/interview/insights/${insightId}`);
        setInsight(data);
        setTitle(data.title || '');

        // Generate executive summary from content
        if (data.content) {
          const firstParagraph = data.content.split('\n\n')[0] || '';
          setExecutiveSummary(
            firstParagraph.length > 200 ? firstParagraph.substring(0, 200) + '...' : firstParagraph
          );
        }

        // Initialize activity log
        setActivityLog([
          {
            id: '1',
            type: 'created',
            description: isPolish ? 'Wniosek utworzony' : 'Insight created',
            timestamp: data.createdAt,
            userName: 'System',
          },
        ]);

        // Load source sessions
        if (data.sourceSessionIds?.length > 0) {
          try {
            const sessionsData = await Promise.all(
              data.sourceSessionIds.slice(0, 10).map((id: string) =>
                Api.get(`/interview/sessions/${id}`).catch(() => ({
                  id,
                  name: `Session ${id.slice(0, 8)}`,
                }))
              )
            );
            setSourceSessions(sessionsData);
          } catch {
            // Silently handle - sessions are optional
          }
        }

        // Load mock extended data (in production, these would come from API)
        setKeyFindings(generateMockKeyFindings(isPolish));
        setQuotes(generateMockQuotes(isPolish));
        setPatterns(generateMockPatterns(isPolish));
        setContradictions(generateMockContradictions(isPolish));
        setActionItems(generateMockActionItems(isPolish));
        setRiskFlags(generateMockRiskFlags(isPolish));
        setDataQuality(generateMockDataQuality(isPolish));
        setSentiment(generateMockSentiment());
      } catch (err: any) {
        setError(err?.message || 'Failed to load insight');
        console.error('[InsightViewer] Failed to load insight:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsight();

    // Poll for status if generating
    const interval = setInterval(async () => {
      if (insight?.status === 'generating') {
        try {
          const data = await Api.get(`/interview/insights/${insightId}`);
          setInsight(data);
          if (data.status !== 'generating') {
            clearInterval(interval);
            addActivityLogEntry(
              'regenerated',
              isPolish ? 'Generowanie zakończone' : 'Generation completed'
            );
          }
        } catch (err) {
          console.error('[InsightViewer] Poll error:', err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [insightId]);

  // ==========================================
  // HELPERS
  // ==========================================

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const addActivityLogEntry = (type: ActivityLogEntry['type'], description: string) => {
    const entry: ActivityLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      description,
      timestamp: new Date().toISOString(),
      userName: 'Current User',
    };
    setActivityLog((prev) => [entry, ...prev]);
  };

  const getColorClasses = (color: string, variant: 'bg' | 'border' | 'text') => {
    const colors: Record<string, Record<string, string>> = {
      blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
      purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
      red: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400' },
      amber: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
      cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
      orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
      rose: { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-400' },
      emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
      indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-400' },
      violet: { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-400' },
    };
    return colors[color]?.[variant] || '';
  };

  const typeMeta = insight
    ? TYPE_METADATA[insight.promptType] || TYPE_METADATA.summary
    : TYPE_METADATA.summary;
  const statusConfig = insight
    ? STATUS_CONFIG[insight.status] || STATUS_CONFIG.completed
    : STATUS_CONFIG.completed;

  const filteredQuotes = useMemo(() => {
    if (quoteFilter === 'all') return quotes;
    return quotes.filter((q) => q.sentiment === quoteFilter);
  }, [quotes, quoteFilter]);

  const riskCounts = useMemo(() => {
    return {
      high: riskFlags.filter((r) => r.severity === 'high').length,
      medium: riskFlags.filter((r) => r.severity === 'medium').length,
      low: riskFlags.filter((r) => r.severity === 'low').length,
    };
  }, [riskFlags]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleSave = async () => {
    if (!insight) return;
    setSaving(true);
    try {
      await Api.patch(`/interview/insights/${insight.id}`, { title });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
      addActivityLogEntry('edit', isPolish ? 'Tytuł zaktualizowany' : 'Title updated');
      onSaved?.({ ...insight, title });
    } catch {
      toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    if (isChatCollapsed) {
      toggleChatCollapse();
    }
    updateWorkspaceFromView(AppView.INTERVIEW, insightId, {
      type: 'insight',
      id: insightId,
      title,
      promptType: insight?.promptType,
      status: insight?.status,
      sourceSessionCount: insight?.sourceSessionCount,
    });
  };

  const handleRegenerate = async () => {
    if (!insight) return;
    setIsRegenerating(true);
    try {
      await Api.post(`/interview/insights/${insight.id}/regenerate`, {});
      toast.success(isPolish ? 'Regenerowanie rozpoczęte...' : 'Regeneration started...');
      const data = await Api.get(`/interview/insights/${insightId}`);
      setInsight(data);
      addActivityLogEntry(
        'regenerated',
        isPolish ? 'Regeneracja rozpoczęta' : 'Regeneration started'
      );
      onRegenerate?.();
    } catch {
      toast.error(isPolish ? 'Nie udało się zregenerować' : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!insight?.content) return;
    try {
      await navigator.clipboard.writeText(insight.content);
      toast.success(isPolish ? 'Skopiowano do schowka' : 'Copied to clipboard');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Failed to copy');
    }
  };

  const handleExportMarkdown = () => {
    if (!insight?.content) return;
    const blob = new Blob([insight.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${insight.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isPolish ? 'Pobrano plik Markdown' : 'Downloaded Markdown file');
    addActivityLogEntry(
      'exported',
      isPolish ? 'Wyeksportowano do Markdown' : 'Exported to Markdown'
    );
  };

  const handleExportToTools = async () => {
    if (!insight) return;
    setIsExportingTools(true);
    try {
      const exportRes = await Api.post(`/interview/insights/${insight.id}/export`, {
        target: 'tools',
      });
      toast.success(isPolish ? 'Wyeksportowano do Tools' : 'Exported to Tools');
      addActivityLogEntry('exported', isPolish ? 'Wyeksportowano do Tools' : 'Exported to Tools');

      const toolId = exportRes?.targetId;
      if (toolId) {
        navigate(`${ROUTES.DISCOVERY_TOOLS.STRATEGIC}?tool=${toolId}`);
      }
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
    } finally {
      setIsExportingTools(false);
    }
  };

  const handleExportToAssessment = async () => {
    if (!insight) return;
    setIsExportingAssessment(true);
    try {
      const exportRes = await Api.post(`/interview/insights/${insight.id}/export`, {
        target: 'assessment',
      });
      toast.success(isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment');
      addActivityLogEntry(
        'exported',
        isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment'
      );

      const assessmentId = exportRes?.targetId;
      const assessmentType = String(exportRes?.assessmentType || 'DRD').toLowerCase();
      if (assessmentId) {
        navigate(`${ROUTES.ASSESSMENT.ROOT}/${assessmentType}/${assessmentId}`);
      }
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
    } finally {
      setIsExportingAssessment(false);
    }
  };

  // AI Handlers
  const handleExpandContent = async () => {
    if (!insight?.content) return;
    setIsExpandingContent(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      toast.success(isPolish ? 'Treść rozwinięta przez AI' : 'Content expanded by AI');
      addActivityLogEntry('edit', isPolish ? 'AI rozwinęło treść' : 'AI expanded content');
    } catch {
      toast.error(isPolish ? 'Błąd AI' : 'AI error');
    } finally {
      setIsExpandingContent(false);
    }
  };

  const handleSummarize = async () => {
    if (!insight?.content) return;
    setIsSummarizing(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      toast.success(isPolish ? 'Podsumowanie wygenerowane' : 'Summary generated');
      addActivityLogEntry(
        'edit',
        isPolish ? 'AI wygenerowało podsumowanie' : 'AI generated summary'
      );
    } catch {
      toast.error(isPolish ? 'Błąd AI' : 'AI error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateFindings = async () => {
    setIsGeneratingFindings(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      setKeyFindings(generateMockKeyFindings(isPolish));
      toast.success(isPolish ? 'Wygenerowano kluczowe ustalenia' : 'Generated key findings');
      addActivityLogEntry('edit', isPolish ? 'AI wygenerowało ustalenia' : 'AI generated findings');
    } catch {
      toast.error(isPolish ? 'Błąd AI' : 'AI error');
    } finally {
      setIsGeneratingFindings(false);
    }
  };

  // Comments handlers
  const handleAddComment = async (content: string) => {
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      authorId: 'current-user',
      authorName: 'Current User',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments([...comments, newComment]);
    addActivityLogEntry('comment', isPolish ? 'Dodano komentarz' : 'Comment added');
  };

  const handleDeleteComment = async (id: string) => {
    setComments(comments.filter((c) => c.id !== id));
  };

  const handleLikeComment = async (id: string) => {
    setComments(
      comments.map((c) =>
        c.id === id
          ? { ...c, likes: c.likedByMe ? c.likes - 1 : c.likes + 1, likedByMe: !c.likedByMe }
          : c
      )
    );
  };

  const generateAIComment = async () => {
    setIsGeneratingAIComment(true);
    await new Promise((r) => setTimeout(r, 1500));

    const aiComments = [
      isPolish
        ? `🤖 **Analiza AI**: Na podstawie wniosków "${title || 'bez tytułu'}", kluczowe obszary do działania to: priorytetyzacja rekomendacji, identyfikacja quick wins oraz określenie odpowiedzialnych osób.`
        : `🤖 **AI Analysis**: Based on the insights "${title || 'untitled'}", key action areas are: prioritizing recommendations, identifying quick wins, and assigning owners.`,
    ];

    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content: aiComments[0],
      authorId: 'ai-assistant',
      authorName: 'AI Assistant',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };

    setComments([...comments, newComment]);
    setIsGeneratingAIComment(false);
    addActivityLogEntry('comment', isPolish ? 'AI wygenerowało komentarz' : 'AI generated comment');
    toast.success(isPolish ? 'AI wygenerowało komentarz' : 'AI comment generated');
  };

  // Action items handlers
  const toggleActionItem = (id: string) => {
    setActionItems(
      actionItems.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  // Attachments handlers
  const handleUploadAttachment = async (files: FileList) => {
    // In production, this would upload to server
    const newAttachments: Attachment[] = Array.from(files).map((file, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Current User',
    }));
    setAttachments([...attachments, ...newAttachments]);
    toast.success(isPolish ? 'Załączniki dodane' : 'Attachments added');
    addActivityLogEntry('edit', isPolish ? 'Dodano załączniki' : 'Attachments added');
  };

  const handleDeleteAttachment = async (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
    toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment deleted');
  };

  // Linked items handlers
  const handleAddLinkedItem = async (item: LinkedItem) => {
    setLinkedItems([...linkedItems, item]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    setLinkedItems(linkedItems.filter((i) => i.id !== id));
  };

  const searchLinkedItems = async (query: string) => {
    return [];
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderCollapsibleSection = (
    id: string,
    icon: React.ReactNode,
    title: string,
    iconBgClass: string,
    badge?: React.ReactNode,
    headerActions?: React.ReactNode,
    children?: React.ReactNode
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
    >
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBgClass}`}>{icon}</div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {badge}
          <motion.div
            animate={{ rotate: expandedSections.has(id) ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expandedSections.has(id) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ==========================================
              HEADER - Full Width
              ========================================== */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-3 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 transition-all"
              >
                <ChevronLeft size={20} />
              </motion.button>

              <div className="flex-1 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorClasses(typeMeta.color, 'bg')} ${getColorClasses(typeMeta.color, 'text')}`}
                >
                  {typeMeta.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                      placeholder={isPolish ? 'Tytuł wniosku...' : 'Insight title...'}
                    />
                    <ArtifactPermalinkButton
                      artifactType="insight"
                      artifactId={insight?.id || insightId}
                      isPolish={isPolish}
                      size={13}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className={getColorClasses(typeMeta.color, 'text')}>
                      {isPolish ? typeMeta.labelPl : typeMeta.label}
                    </span>
                    <span>•</span>
                    <span className={`flex items-center gap-1 ${statusConfig.textColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
                      {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{isPolish ? 'Zapisz' : 'Save'}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
                >
                  <MessageSquare size={16} />
                  <span>{isPolish ? 'Czat' : 'Chat'}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ==========================================
              LEFT COLUMN - 2/3 width
              ========================================== */}
          <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">
            {/* Executive Summary Section */}
            {renderCollapsibleSection(
              'executiveSummary',
              <Star size={18} className="text-amber-500 dark:text-amber-400" />,
              isPolish ? 'Podsumowanie Wykonawcze' : 'Executive Summary',
              'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {insight?.sourceSessionCount || 0} {isPolish ? 'wywiadów' : 'interviews'}
                </span>
              </div>,
              undefined,
              <div className="p-5">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                  {executiveSummary || (isPolish ? 'Brak podsumowania' : 'No summary available')}
                </p>
                <div className="flex items-center gap-4 pt-3 border-t border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MessageSquare size={14} />
                    <span>
                      {insight?.sourceSessionCount || 0} {isPolish ? 'wywiadów' : 'interviews'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Lightbulb size={14} />
                    <span>
                      {keyFindings.length} {isPolish ? 'ustaleń' : 'findings'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Flag size={14} />
                    <span>
                      {riskCounts.high} {isPolish ? 'ryzyk wysokich' : 'high risks'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* Key Findings Section */}
            {renderCollapsibleSection(
              'keyFindings',
              <Target size={18} className="text-blue-500 dark:text-blue-400" />,
              isPolish ? 'Kluczowe Ustalenia' : 'Key Findings',
              'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {keyFindings.length}
              </span>,
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateFindings();
                }}
                disabled={isGeneratingFindings}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 text-xs font-medium transition-all disabled:opacity-50"
              >
                {isGeneratingFindings ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>{isPolish ? 'Generuj AI' : 'Generate AI'}</span>
              </motion.button>,
              <div className="p-4 space-y-3">
                {keyFindings.map((finding, index) => (
                  <motion.div
                    key={finding.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {finding.content}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            finding.confidence === 'high'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : finding.confidence === 'medium'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {finding.confidence === 'high'
                            ? isPolish
                              ? 'Wysoka pewność'
                              : 'High confidence'
                            : finding.confidence === 'medium'
                              ? isPolish
                                ? 'Średnia pewność'
                                : 'Medium confidence'
                              : isPolish
                                ? 'Niska pewność'
                                : 'Low confidence'}
                        </span>
                        {finding.category && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{finding.category}</span>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {finding.sourceCount} {isPolish ? 'źródeł' : 'sources'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Insight Content Section */}
            {renderCollapsibleSection(
              'content',
              <Lightbulb size={18} className="text-amber-500 dark:text-amber-400" />,
              isPolish ? 'Pełna Treść Analizy' : 'Full Analysis Content',
              'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
              undefined,
              <>
                {insight?.status === 'completed' && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandContent();
                      }}
                      disabled={isExpandingContent}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 dark:hover:bg-violet-500/30 text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isExpandingContent ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <span>{isPolish ? 'Rozwiń' : 'Expand'}</span>
                    </motion.button>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSummarize();
                      }}
                      disabled={isSummarizing}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isSummarizing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileText size={14} />
                      )}
                      <span>{isPolish ? 'Podsumuj' : 'Summarize'}</span>
                    </motion.button>
                  </>
                )}
              </>,
              <div className="p-5">
                {insight?.status === 'generating' ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative mb-6">
                      <Sparkles size={48} className="text-amber-400 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {isPolish ? 'AI generuje wnioski...' : 'AI is generating insights...'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
                      {isPolish
                        ? 'Analizujemy wybrane sesje wywiadów i przygotowujemy kompleksową analizę.'
                        : 'We are analyzing selected interview sessions and preparing a comprehensive analysis.'}
                    </p>
                  </div>
                ) : insight?.content ? (
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 pb-2 border-b border-slate-200 dark:border-navy-700">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mt-6 mb-3">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mt-4 mb-2">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside space-y-1 mb-4">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-slate-600 dark:text-slate-300">{children}</li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-slate-800 dark:text-white">
                            {children}
                          </strong>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary-500 pl-4 py-2 my-4 bg-slate-50 dark:bg-navy-800/50 rounded-r-lg">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {insight.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">{isPolish ? 'Brak treści' : 'No content'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quotes & Evidence Section */}
            {renderCollapsibleSection(
              'quotes',
              <Quote size={18} className="text-purple-500 dark:text-purple-400" />,
              isPolish ? 'Cytaty i Dowody' : 'Quotes & Evidence',
              'bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {quotes.length}
              </span>,
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {(['all', 'positive', 'neutral', 'negative'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setQuoteFilter(filter)}
                    className={`px-2 py-1 rounded-lg text-xs transition-all ${
                      quoteFilter === filter
                        ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {filter === 'all' && (isPolish ? 'Wszystkie' : 'All')}
                    {filter === 'positive' && <Smile size={14} />}
                    {filter === 'neutral' && <Meh size={14} />}
                    {filter === 'negative' && <Frown size={14} />}
                  </button>
                ))}
              </div>,
              <div className="p-4 space-y-3">
                {filteredQuotes.map((quote) => (
                  <motion.div
                    key={quote.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`p-4 rounded-xl border-l-4 ${
                      quote.sentiment === 'positive'
                        ? 'border-l-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                        : quote.sentiment === 'negative'
                          ? 'border-l-red-500 bg-red-500/5 dark:bg-red-500/10'
                          : 'border-l-slate-400 bg-slate-50 dark:bg-navy-800'
                    }`}
                  >
                    <p className="text-sm text-slate-700 dark:text-slate-300 italic mb-3">
                      "{quote.quote}"
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{quote.source}</span>
                        {quote.department && (
                          <>
                            <span>•</span>
                            <span>{quote.department}</span>
                          </>
                        )}
                        {quote.role && (
                          <>
                            <span>•</span>
                            <span>{quote.role}</span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {quote.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Patterns & Themes Section */}
            {renderCollapsibleSection(
              'patterns',
              <Hash size={18} className="text-cyan-500 dark:text-cyan-400" />,
              isPolish ? 'Wzorce i Tematy' : 'Patterns & Themes',
              'bg-gradient-to-br from-cyan-500/10 to-teal-500/10 dark:from-cyan-500/20 dark:to-teal-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {patterns.length}
              </span>,
              undefined,
              <div className="p-4">
                {/* Word Cloud Simulation */}
                <div className="flex flex-wrap gap-2 mb-4 p-4 rounded-xl bg-slate-50 dark:bg-navy-800">
                  {patterns
                    .flatMap((p) => p.relatedKeywords)
                    .map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-sm"
                        style={{ fontSize: `${Math.random() * 0.4 + 0.8}rem` }}
                      >
                        {keyword}
                      </span>
                    ))}
                </div>
                {/* Themes List */}
                <div className="space-y-2">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {pattern.theme}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(pattern.frequency / 15) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8">{pattern.frequency}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contradictions Section */}
            {renderCollapsibleSection(
              'contradictions',
              <Shuffle size={18} className="text-rose-500 dark:text-rose-400" />,
              isPolish ? 'Sprzeczności i Napięcia' : 'Contradictions & Tensions',
              'bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {contradictions.length}
              </span>,
              undefined,
              <div className="p-4 space-y-4">
                {contradictions.map((contradiction) => (
                  <div
                    key={contradiction.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {contradiction.topic}
                      </h4>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          contradiction.severity === 'high'
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : contradiction.severity === 'medium'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {contradiction.severity}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                          {contradiction.sourceA}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {contradiction.viewA}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                          {contradiction.sourceB}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {contradiction.viewB}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Items Section */}
            {renderCollapsibleSection(
              'actionItems',
              <CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />,
              isPolish ? 'Zalecane Działania' : 'Action Items',
              'bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {actionItems.filter((a) => !a.completed).length}/{actionItems.length}
              </span>,
              undefined,
              <div className="p-4">
                {/* Quick Wins */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                    {isPolish ? 'Quick Wins' : 'Quick Wins'}
                  </h4>
                  <div className="space-y-2">
                    {actionItems
                      .filter((a) => a.type === 'quick_win')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20"
                        >
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              item.completed
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-emerald-500/50 hover:border-emerald-500'
                            }`}
                          >
                            {item.completed && <CheckCircle size={12} />}
                          </button>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                item.completed
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.action}
                            </p>
                            {item.owner && (
                              <p className="text-xs text-slate-500 mt-1">
                                {isPolish ? 'Właściciel:' : 'Owner:'} {item.owner}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              item.priority === 'high'
                                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                : item.priority === 'medium'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-slate-500/20 text-slate-600'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Short Term */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                    {isPolish ? 'Krótkoterminowe' : 'Short Term'}
                  </h4>
                  <div className="space-y-2">
                    {actionItems
                      .filter((a) => a.type === 'short_term')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20"
                        >
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              item.completed
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-blue-500/50 hover:border-blue-500'
                            }`}
                          >
                            {item.completed && <CheckCircle size={12} />}
                          </button>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                item.completed
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.action}
                            </p>
                            {item.owner && (
                              <p className="text-xs text-slate-500 mt-1">
                                {isPolish ? 'Właściciel:' : 'Owner:'} {item.owner}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              item.priority === 'high'
                                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Long Term */}
                <div>
                  <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                    {isPolish ? 'Długoterminowe' : 'Long Term'}
                  </h4>
                  <div className="space-y-2">
                    {actionItems
                      .filter((a) => a.type === 'long_term')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20"
                        >
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              item.completed
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-purple-500/50 hover:border-purple-500'
                            }`}
                          >
                            {item.completed && <CheckCircle size={12} />}
                          </button>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                item.completed
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.action}
                            </p>
                            {item.owner && (
                              <p className="text-xs text-slate-500 mt-1">
                                {isPolish ? 'Właściciel:' : 'Owner:'} {item.owner}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              item.priority === 'high'
                                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Comments Section */}
            <CommentsSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onLikeComment={handleLikeComment}
              onGenerateAIComment={generateAIComment}
              isGeneratingAI={isGeneratingAIComment}
              currentUserId="current-user"
              expanded={expandedSections.has('comments')}
              onToggleExpand={() => toggleSection('comments')}
            />

            {/* Source Sessions Section */}
            {renderCollapsibleSection(
              'sessions',
              <MessageSquare size={18} className="text-blue-500 dark:text-blue-400" />,
              isPolish ? 'Sesje Źródłowe' : 'Source Sessions',
              'bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {insight?.sourceSessionCount || 0}
              </span>,
              undefined,
              <div className="p-4 space-y-2">
                {sourceSessions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{isPolish ? 'Brak sesji' : 'No sessions'}</p>
                  </div>
                ) : (
                  sourceSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <MessageSquare size={14} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {session.name}
                          </p>
                          {session.templateName && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              {session.templateName}
                            </p>
                          )}
                        </div>
                      </div>
                      <button className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Activity Log */}
            {renderCollapsibleSection(
              'activityLog',
              <History size={18} className="text-slate-500 dark:text-slate-400" />,
              isPolish ? 'Historia Zmian' : 'Activity Log',
              'bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {activityLog.length}
              </span>,
              undefined,
              <div className="p-4">
                {activityLog.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                    <History size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{isPolish ? 'Brak wpisów' : 'No entries'}</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-200 dark:bg-navy-700" />
                    <div className="space-y-3">
                      {activityLog.map((entry) => (
                        <div key={entry.id} className="relative flex gap-3 pl-1">
                          <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-slate-400 text-white">
                            {entry.type === 'created' && <Plus size={12} />}
                            {entry.type === 'regenerated' && <RefreshCw size={12} />}
                            {entry.type === 'exported' && <Send size={12} />}
                            {entry.type === 'comment' && <MessageSquare size={12} />}
                            {entry.type === 'edit' && <Sparkles size={12} />}
                          </div>
                          <div className="flex-1 min-w-0 pb-2">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {entry.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {entry.userName && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {entry.userName}
                                </span>
                              )}
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {new Date(entry.timestamp).toLocaleString(
                                  isPolish ? 'pl-PL' : 'en-US',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ==========================================
              RIGHT COLUMN - 1/3 width (sticky)
              ========================================== */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
            {/* 1. Control Panel */}
            {renderCollapsibleSection(
              'control',
              <BarChart3 size={18} className="text-purple-500 dark:text-purple-400" />,
              isPolish ? 'Sterowanie' : 'Control',
              'bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20',
              insight?.id && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                  #{insight.id.slice(0, 8)}
                </span>
              ),
              undefined,
              <div className="p-4 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Typ analizy' : 'Analysis Type'}
                  </label>
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${getColorClasses(typeMeta.color, 'bg')} border ${getColorClasses(typeMeta.color, 'border')}`}
                  >
                    <span className={getColorClasses(typeMeta.color, 'text')}>{typeMeta.icon}</span>
                    <span
                      className={`text-sm font-medium ${getColorClasses(typeMeta.color, 'text')}`}
                    >
                      {isPolish ? typeMeta.labelPl : typeMeta.label}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    Status
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                    </span>
                  </div>
                </div>

                {/* Created */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Utworzono' : 'Created'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {insight?.createdAt
                        ? new Date(insight.createdAt).toLocaleDateString(
                            isPolish ? 'pl-PL' : 'en-US'
                          )
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* Generation Time */}
                {insight?.generationTimeMs && (
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      {isPolish ? 'Czas generacji' : 'Generation Time'}
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                      <Clock size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {(insight.generationTimeMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                )}

                {/* Tokens Used */}
                {insight?.tokensUsed && insight.tokensUsed > 0 && (
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      {isPolish ? 'Użyte tokeny' : 'Tokens Used'}
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                      <Sparkles size={14} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {insight.tokensUsed.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Export Actions */}
            {renderCollapsibleSection(
              'export',
              <Send size={18} className="text-emerald-500 dark:text-emerald-400" />,
              isPolish ? 'Eksport i Akcje' : 'Export & Actions',
              'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20',
              undefined,
              undefined,
              <div className="p-4 space-y-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleExportToTools}
                  disabled={isExportingTools || insight?.status !== 'completed'}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingTools ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Target size={16} />
                  )}
                  <span className="text-sm font-medium">
                    {isPolish ? 'Eksportuj do Tools' : 'Export to Tools'}
                  </span>
                  <ArrowRight size={14} className="ml-auto" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleExportToAssessment}
                  disabled={isExportingAssessment || insight?.status !== 'completed'}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 dark:hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingAssessment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <BarChart3 size={16} />
                  )}
                  <span className="text-sm font-medium">
                    {isPolish ? 'Eksportuj do Assessment' : 'Export to Assessment'}
                  </span>
                  <ArrowRight size={14} className="ml-auto" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleExportMarkdown}
                  disabled={insight?.status !== 'completed'}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Pobierz Markdown' : 'Download Markdown'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCopy}
                  disabled={insight?.status !== 'completed'}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy size={16} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Kopiuj do schowka' : 'Copy to Clipboard'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Regeneruj AI' : 'Regenerate AI'}
                  </span>
                </motion.button>
              </div>
            )}

            {/* 3. Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onUpload={handleUploadAttachment}
              onDelete={handleDeleteAttachment}
              expanded={expandedSections.has('attachments')}
              onToggleExpand={() => toggleSection('attachments')}
            />

            {/* 4. Data Quality Section */}
            {renderCollapsibleSection(
              'dataQuality',
              <Database size={18} className="text-indigo-500 dark:text-indigo-400" />,
              isPolish ? 'Jakość Danych' : 'Data Quality',
              'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20',
              dataQuality && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    dataQuality.coveragePercentage >= 80
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : dataQuality.coveragePercentage >= 50
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}
                >
                  {dataQuality.coveragePercentage}%
                </span>
              ),
              undefined,
              dataQuality && (
                <div className="p-4 space-y-4">
                  {/* Coverage Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">{isPolish ? 'Pokrycie' : 'Coverage'}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {dataQuality.coveragePercentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          dataQuality.coveragePercentage >= 80
                            ? 'bg-emerald-500'
                            : dataQuality.coveragePercentage >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${dataQuality.coveragePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 text-center">
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {dataQuality.totalInterviews}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isPolish ? 'Wywiadów' : 'Interviews'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 text-center">
                      <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                        {dataQuality.departmentsCovered.length}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isPolish ? 'Działów' : 'Departments'}
                      </p>
                    </div>
                  </div>

                  {/* Departments */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">
                      {isPolish ? 'Objęte działy' : 'Covered departments'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dataQuality.departmentsCovered.map((dept) => (
                        <span
                          key={dept}
                          className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
                        >
                          {dept}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Missing Areas */}
                  {dataQuality.missingAreas.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">
                        {isPolish ? 'Brakujące obszary' : 'Missing areas'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {dataQuality.missingAreas.map((area) => (
                          <span
                            key={area}
                            className="px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {/* 5. Risk Flags Section */}
            {renderCollapsibleSection(
              'riskFlags',
              <Flag size={18} className="text-red-500 dark:text-red-400" />,
              isPolish ? 'Flagi Ryzyka' : 'Risk Flags',
              'bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20',
              <div className="flex items-center gap-2">
                {riskCounts.high > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                    <AlertCircle size={10} />
                    {riskCounts.high}
                  </span>
                )}
                {riskCounts.medium > 0 && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={10} />
                    {riskCounts.medium}
                  </span>
                )}
              </div>,
              undefined,
              <div className="p-4 space-y-3">
                {riskFlags.map((risk) => (
                  <div
                    key={risk.id}
                    className={`p-3 rounded-xl border-l-4 ${
                      risk.severity === 'high'
                        ? 'border-l-red-500 bg-red-500/5 dark:bg-red-500/10'
                        : risk.severity === 'medium'
                          ? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
                          : 'border-l-slate-400 bg-slate-50 dark:bg-navy-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{risk.risk}</p>
                      <span
                        className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                          risk.severity === 'high'
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                            : risk.severity === 'medium'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-500/20 text-slate-600'
                        }`}
                      >
                        {risk.severity}
                      </span>
                    </div>
                    {risk.mitigation && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">
                          {isPolish ? 'Mitygacja:' : 'Mitigation:'}
                        </span>{' '}
                        {risk.mitigation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 6. Tags */}
            {renderCollapsibleSection(
              'tags',
              <Tag size={18} className="text-pink-500 dark:text-pink-400" />,
              isPolish ? 'Tagi' : 'Tags',
              'bg-pink-500/10 dark:bg-pink-500/20',
              tags.length > 0 && (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {tags.length}
                </span>
              ),
              undefined,
              <div className="p-4 space-y-3">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <motion.span
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-purple-500/10 dark:from-pink-500/20 dark:to-purple-500/20 text-pink-700 dark:text-pink-300 text-xs font-medium"
                      >
                        #{tag}
                        <button
                          onClick={() => setTags(tags.filter((_, i) => i !== index))}
                          className="p-0.5 rounded-full hover:bg-pink-500/20 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTag.trim()) {
                        if (!tags.includes(newTag.trim().toLowerCase())) {
                          setTags([...tags, newTag.trim().toLowerCase()]);
                        }
                        setNewTag('');
                      }
                    }}
                    placeholder={isPolish ? 'Dodaj tag...' : 'Add tag...'}
                    className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
                        setTags([...tags, newTag.trim().toLowerCase()]);
                        setNewTag('');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 hover:bg-pink-500/20 dark:hover:bg-pink-500/30 text-sm font-medium transition-all"
                  >
                    <Plus size={16} />
                  </motion.button>
                </div>

                {tags.length === 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      isPolish ? 'strategiczne' : 'strategic',
                      isPolish ? 'operacyjne' : 'operational',
                      isPolish ? 'ryzyko' : 'risk',
                      isPolish ? 'szansa' : 'opportunity',
                    ].map((quickTag) => (
                      <button
                        key={quickTag}
                        onClick={() => setTags([...tags, quickTag])}
                        className="px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400 hover:bg-pink-100 dark:hover:bg-pink-500/20 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
                      >
                        #{quickTag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. Stakeholder Sentiment Section */}
            {renderCollapsibleSection(
              'sentiment',
              <PieChart size={18} className="text-violet-500 dark:text-violet-400" />,
              isPolish ? 'Nastroje Interesariuszy' : 'Stakeholder Sentiment',
              'bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20',
              undefined,
              undefined,
              sentiment && (
                <div className="p-4 space-y-4">
                  {/* Overall Sentiment */}
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1">
                        <Smile size={24} className="text-emerald-500" />
                      </div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {sentiment.positive}%
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-500/20 flex items-center justify-center mb-1">
                        <Meh size={24} className="text-slate-500" />
                      </div>
                      <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                        {sentiment.neutral}%
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-1">
                        <Frown size={24} className="text-red-500" />
                      </div>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {sentiment.negative}%
                      </p>
                    </div>
                  </div>

                  {/* By Department */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">
                      {isPolish ? 'Według działów' : 'By department'}
                    </p>
                    <div className="space-y-2">
                      {Object.entries(sentiment.byDepartment).map(([dept, values]) => (
                        <div key={dept} className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400 w-20 truncate">
                            {dept}
                          </span>
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${values.positive}%` }}
                            />
                            <div
                              className="h-full bg-slate-400"
                              style={{ width: `${values.neutral}%` }}
                            />
                            <div
                              className="h-full bg-red-500"
                              style={{ width: `${values.negative}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* 8. Linked Items */}
            <LinkedItemsSection
              items={linkedItems}
              onAdd={handleAddLinkedItem}
              onRemove={handleRemoveLinkedItem}
              searchItems={searchLinkedItems}
              allowedTypes={['task', 'initiative', 'decision', 'risk', 'project', 'external']}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightViewer;
