/**
 * BlockCard v2
 *
 * Advanced block editing component with:
 * - Mode Switcher (Preview / Edit / Configure)
 * - Smart Configure panel (grouped by context)
 * - Contextual AI Actions per block type
 * - Quick Actions Bar at bottom
 * - Diff view after AI regeneration
 */

import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  ClipboardCopy,
  Eye,
  FileText,
  Filter,
  Grip,
  Image,
  Languages,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Send,
  Settings,
  Sliders,
  Sparkles,
  Table,
  Target,
  Trash2,
  Type,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { SmartBlockRenderer } from '../blocks/SmartBlockRenderer';
import { BlockSettingsPanel } from './BlockSettingsPanel';
import { getBlockSettings } from './BlockSettingsRegistry';
import type { BlockConfig } from './ReportEditor';

// ==========================================
// TYPES
// ==========================================

type BlockMode = 'configure' | 'ai' | 'preview' | 'comments';

type CommentType = 'FEEDBACK' | 'SUGGESTION' | 'QUESTION' | 'CHANGE_REQUEST';
type CommentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'WONT_FIX';

interface BlockComment {
  id: string;
  content: string;
  commentType: CommentType;
  status: CommentStatus;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  parentCommentId?: string;
}

interface BlockCardProps {
  block: BlockConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BlockConfig>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onRegenerate?: (instruction: string) => Promise<void>;
  /** Generate block content using its settings (no custom instruction) */
  onGenerateBlock?: () => Promise<void>;
  onSaveContent?: (newContent: string) => Promise<void>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  previousBlockSummary?: string;
  nextBlockSummary?: string;
  isPl: boolean;
  /** Report ID for API calls (comments, etc.) */
  reportId?: string;
  /** Comment handlers */
  onLoadComments?: (sectionKey: string) => Promise<BlockComment[]>;
  onAddComment?: (
    sectionKey: string,
    content: string,
    commentType: CommentType
  ) => Promise<BlockComment | null>;
  onResolveComment?: (commentId: string, notes?: string) => Promise<void>;
  onDismissComment?: (commentId: string) => Promise<void>;
  onBulkResolve?: (commentIds: string[]) => Promise<void>;
}

// ==========================================
// BLOCK ICON & COLOR HELPERS
// ==========================================

const getBlockIcon = (type: string) => {
  const icons: Record<string, React.ReactNode> = {
    cover: <FileText className="w-4 h-4" />,
    summary: <FileText className="w-4 h-4" />,
    matrix: <LayoutGrid className="w-4 h-4" />,
    analysis: <BarChart3 className="w-4 h-4" />,
    axis_analysis: <BarChart3 className="w-4 h-4" />,
    recommendations: <List className="w-4 h-4" />,
    action_plan: <List className="w-4 h-4" />,
    table: <Table className="w-4 h-4" />,
    chart_bar: <BarChart3 className="w-4 h-4" />,
    chart_pie: <BarChart3 className="w-4 h-4" />,
    image: <Image className="w-4 h-4" />,
    initiatives: <Zap className="w-4 h-4" />,
    dashboard: <LayoutGrid className="w-4 h-4" />,
    scorecard: <Table className="w-4 h-4" />,
    kpis: <Target className="w-4 h-4" />,
    risk: <Zap className="w-4 h-4" />,
    prioritization: <LayoutGrid className="w-4 h-4" />,
    roadmap: <List className="w-4 h-4" />,
    findings: <FileText className="w-4 h-4" />,
    gap_analysis: <BarChart3 className="w-4 h-4" />,
  };
  return icons[type] || <Type className="w-4 h-4" />;
};

const getBlockColor = (type: string) => {
  const colors: Record<string, string> = {
    cover: 'from-c-tag-1 to-c-tag-1',
    summary: 'from-c-tag-2 to-c-tag-2',
    matrix: 'from-c-tag-3 to-c-tag-3',
    analysis: 'from-c-tag-4 to-c-tag-4',
    axis_analysis: 'from-c-tag-5 to-c-tag-5',
    recommendations: 'from-c-tag-6 to-c-tag-6',
    action_plan: 'from-c-tag-7 to-c-tag-7',
    table: 'from-c-tag-8 to-c-tag-8',
    chart_bar: 'from-c-tag-9 to-c-tag-9',
    chart_pie: 'from-c-tag-10 to-c-tag-10',
    initiatives: 'from-c-tag-11 to-c-tag-11',
    dashboard: 'from-c-tag-12 to-c-tag-12',
    scorecard: 'from-c-tag-1 to-c-tag-1',
    kpis: 'from-c-tag-2 to-c-tag-2',
    risk: 'from-c-tag-3 to-c-tag-3',
    prioritization: 'from-c-tag-4 to-c-tag-4',
    roadmap: 'from-c-tag-5 to-c-tag-5',
    findings: 'from-c-tag-6 to-c-tag-6',
    gap_analysis: 'from-c-tag-7 to-c-tag-7',
    methodology: 'from-c-tag-8 to-c-tag-8',
    context: 'from-c-tag-9 to-c-tag-9',
    appendix: 'from-c-tag-10 to-c-tag-10',
    custom: 'from-c-tag-11 to-c-tag-11',
    quote: 'from-c-tag-12 to-c-tag-12',
  };
  return colors[type] || 'from-c-tag-1 to-c-tag-1';
};

const getBlockCategory = (type: string): 'content' | 'data' | 'visual' | 'consulting' => {
  const data = [
    'matrix',
    'table',
    'findings',
    'dashboard',
    'scorecard',
    'gap_analysis',
    'root_cause',
    'comparison',
  ];
  const visual = [
    'chart_bar',
    'chart_pie',
    'image',
    'roadmap',
    'kpis',
    'risk',
    'prioritization',
    'initiatives',
  ];
  const consulting = [
    'consulting_takeaway',
    'consulting_implications',
    'consulting_decisions',
    'consulting_risks_register',
    'consulting_2x2',
    'consulting_benchmark_bar',
    'consulting_roadmap',
  ];
  if (data.includes(type)) return 'data';
  if (visual.includes(type)) return 'visual';
  if (consulting.includes(type)) return 'consulting';
  return 'content';
};

// ==========================================
// CONTEXTUAL AI ACTIONS per block type
// ==========================================

interface ContextualAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  labelPl: string;
  instruction: string;
  instructionPl: string;
}

const CONTEXTUAL_ACTIONS: Record<string, ContextualAction[]> = {
  // --- Content blocks ---
  cover: [
    {
      id: 'update_subtitle',
      icon: <Pencil className="w-3.5 h-3.5" />,
      label: 'Update subtitle',
      labelPl: 'Zaktualizuj podtytuł',
      instruction:
        'Generate a compelling subtitle that captures the report essence. Include date range.',
      instructionPl: 'Wygeneruj atrakcyjny podtytuł oddający istotę raportu. Dodaj zakres dat.',
    },
    {
      id: 'corporate_tone',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Corporate tone',
      labelPl: 'Ton korporacyjny',
      instruction: 'Rewrite in a formal corporate style suitable for board presentation.',
      instructionPl: 'Przepisz w formalnym stylu korporacyjnym na prezentację zarządczą.',
    },
    {
      id: 'modern_tone',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      label: 'Modern & concise',
      labelPl: 'Nowoczesny i zwięzły',
      instruction: 'Rewrite in modern, clean style. Short impactful title. Minimal text.',
      instructionPl: 'Przepisz w nowoczesnym, czystym stylu. Krótki, mocny tytuł.',
    },
  ],
  summary: [
    {
      id: 'exec_3sent',
      icon: <Minimize2 className="w-3.5 h-3.5" />,
      label: 'Board summary (3 sentences)',
      labelPl: 'Podsumowanie zarządcze (3 zdania)',
      instruction:
        'Rewrite as a 3-sentence executive summary for the board. Focus on key findings, main risk, and recommended action.',
      instructionPl:
        'Przepisz jako 3-zdaniowe podsumowanie zarządcze. Skup się na kluczowych wnioskach, głównym ryzyku i zalecanym działaniu.',
    },
    {
      id: 'add_kpis',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add key metrics',
      labelPl: 'Dodaj kluczowe metryki',
      instruction: 'Add specific KPIs, scores, and percentage changes to support each statement.',
      instructionPl: 'Dodaj konkretne KPI, oceny i zmiany procentowe do każdego stwierdzenia.',
    },
    {
      id: 'swot_style',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'SWOT-style format',
      labelPl: 'Format SWOT',
      instruction: 'Restructure into Strengths, Weaknesses, Opportunities, Threats format.',
      instructionPl: 'Przebuduj w format Mocne strony, Słabe strony, Szanse, Zagrożenia.',
    },
  ],
  analysis: [
    {
      id: 'deeper_evidence',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Add evidence & data',
      labelPl: 'Dodaj dowody i dane',
      instruction: 'Add more specific evidence, data points, and references for each finding.',
      instructionPl: 'Dodaj więcej dowodów, danych i odniesień do każdego wniosku.',
    },
    {
      id: 'focus_risks',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Focus on risks',
      labelPl: 'Skup się na ryzykach',
      instruction: 'Emphasize risks, threats, and areas of concern in the analysis.',
      instructionPl: 'Podkreśl ryzyka, zagrożenia i obszary wymagające uwagi.',
    },
    {
      id: 'comparative',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Add comparisons',
      labelPl: 'Dodaj porównania',
      instruction: 'Add industry benchmarks and peer comparisons where applicable.',
      instructionPl: 'Dodaj benchmarki branżowe i porównania z podobnymi organizacjami.',
    },
  ],
  recommendations: [
    {
      id: 'quick_wins',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Quick wins only',
      labelPl: 'Tylko szybkie wygrane',
      instruction:
        'Filter to show only quick wins: high impact, low effort recommendations achievable in 1-3 months.',
      instructionPl:
        'Pokaż tylko szybkie wygrane: wysokie oddziaływanie, małe nakłady, 1-3 miesiące.',
    },
    {
      id: 'add_owners',
      icon: <Type className="w-3.5 h-3.5" />,
      label: 'Add owners & timeline',
      labelPl: 'Dodaj właścicieli i harmonogram',
      instruction: 'Add suggested owner role and realistic timeline for each recommendation.',
      instructionPl: 'Dodaj sugerowaną rolę odpowiedzialną i realistyczny harmonogram.',
    },
    {
      id: 'prioritize_roi',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Prioritize by ROI',
      labelPl: 'Priorytetyzuj wg ROI',
      instruction:
        'Reorder recommendations by estimated ROI. Add ROI indicators (High/Medium/Low).',
      instructionPl: 'Uporządkuj rekomendacje wg szacowanego ROI. Dodaj wskaźniki ROI.',
    },
    {
      id: 'top5',
      icon: <Filter className="w-3.5 h-3.5" />,
      label: 'Top 5 most critical',
      labelPl: 'Top 5 najważniejszych',
      instruction: 'Reduce to the 5 most critical recommendations. Explain why each is essential.',
      instructionPl:
        'Ogranicz do 5 najważniejszych rekomendacji. Wyjaśnij dlaczego każda jest kluczowa.',
    },
  ],
  methodology: [
    {
      id: 'add_sources',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Add data sources',
      labelPl: 'Dodaj źródła danych',
      instruction: 'List all data sources, survey types, and inputs used in the assessment.',
      instructionPl: 'Wymień wszystkie źródła danych, typy ankiet i dane wejściowe użyte w ocenie.',
    },
    {
      id: 'framework_detail',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Describe framework',
      labelPl: 'Opisz framework',
      instruction:
        'Add detailed description of the assessment framework: its origin, structure, and scoring methodology.',
      instructionPl:
        'Dodaj szczegółowy opis frameworka: jego pochodzenie, strukturę i metodologię oceny.',
    },
    {
      id: 'simplify_nontechnical',
      icon: <Type className="w-3.5 h-3.5" />,
      label: 'Simplify for non-technical',
      labelPl: 'Uprość dla nietechnicznych',
      instruction:
        'Rewrite so a non-technical executive can understand the methodology. Remove jargon.',
      instructionPl: 'Przepisz tak, aby nietechniczny decydent zrozumiał metodologię. Usuń żargon.',
    },
  ],
  context: [
    {
      id: 'add_benchmarks',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add industry benchmarks',
      labelPl: 'Dodaj benchmarki branżowe',
      instruction: 'Add relevant industry benchmarks and comparisons to provide context.',
      instructionPl: 'Dodaj odpowiednie benchmarki branżowe i porównania.',
    },
    {
      id: 'digital_maturity',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Focus on digital maturity',
      labelPl: 'Skup się na dojrzałości cyfrowej',
      instruction:
        'Emphasize digital maturity context: current digital capabilities, tech stack, digital culture.',
      instructionPl:
        'Podkreśl kontekst dojrzałości cyfrowej: obecne zdolności, stack technologiczny, kulturę cyfrową.',
    },
    {
      id: 'company_profile',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Expand company profile',
      labelPl: 'Rozwiń profil firmy',
      instruction:
        'Add more details about the company: size, industry, key challenges, strategic goals.',
      instructionPl:
        'Dodaj więcej szczegółów o firmie: wielkość, branża, kluczowe wyzwania, cele strategiczne.',
    },
  ],
  axis_analysis: [
    {
      id: 'deeper_evidence',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'More evidence',
      labelPl: 'Więcej dowodów',
      instruction: 'Include more data-driven evidence and specific scores for each area.',
      instructionPl: 'Dodaj więcej dowodów opartych na danych i konkretne wyniki.',
    },
    {
      id: 'add_actions',
      icon: <ArrowDownRight className="w-3.5 h-3.5" />,
      label: 'Add actions per area',
      labelPl: 'Dodaj działania',
      instruction: 'Add 1-2 concrete actions per area/topic analyzed.',
      instructionPl: 'Dodaj 1-2 konkretne działania na każdy analizowany obszar.',
    },
    {
      id: 'compare_axes',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Cross-axis comparison',
      labelPl: 'Porównanie międzyosiowe',
      instruction: 'Add comparison between axes, highlighting which ones are most/least mature.',
      instructionPl: 'Dodaj porównanie osi, podkreślając najbardziej i najmniej dojrzałe.',
    },
  ],
  action_plan: [
    {
      id: 'add_milestones',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add milestones',
      labelPl: 'Dodaj kamienie milowe',
      instruction: 'Add clear milestones with deadlines for each action item.',
      instructionPl: 'Dodaj kamienie milowe z terminami dla każdego zadania.',
    },
    {
      id: 'add_resources',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add resource estimates',
      labelPl: 'Dodaj szacunki zasobów',
      instruction: 'Add estimated FTE, budget range, and tool requirements for each action.',
      instructionPl: 'Dodaj szacowane FTE, zakres budżetu i wymagania narzędziowe.',
    },
    {
      id: 'sort_priority',
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      label: 'Sort by priority',
      labelPl: 'Sortuj wg priorytetów',
      instruction: 'Reorder by priority. Quick wins first, then high-impact strategic items.',
      instructionPl: 'Uporządkuj wg priorytetów. Szybkie wygrane najpierw, potem strategiczne.',
    },
  ],
  appendix: [
    {
      id: 'add_glossary',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Add glossary',
      labelPl: 'Dodaj słownik',
      instruction:
        'Add a glossary of key terms, abbreviations, and framework-specific terminology.',
      instructionPl: 'Dodaj słownik kluczowych terminów, skrótów i pojęć z frameworka.',
    },
    {
      id: 'add_data_sources',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Add data sources table',
      labelPl: 'Dodaj tabelę źródeł',
      instruction: 'Add a table listing all data sources with dates, types, and sample sizes.',
      instructionPl: 'Dodaj tabelę źródeł danych z datami, typami i wielkościami prób.',
    },
    {
      id: 'compact',
      icon: <Minimize2 className="w-3.5 h-3.5" />,
      label: 'Compact format',
      labelPl: 'Format kompaktowy',
      instruction: 'Make more compact: reduce whitespace, use abbreviated format, keep it dense.',
      instructionPl: 'Skompresuj: zredukuj odstępy, użyj skrótów, zachowaj zwięzłość.',
    },
  ],
  quote: [
    {
      id: 'stronger_quote',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      label: 'Find stronger quote',
      labelPl: 'Znajdź mocniejszy cytat',
      instruction:
        'Generate a more impactful, memorable quote from the data that resonates with decision-makers.',
      instructionPl: 'Wygeneruj bardziej wpływowy cytat z danych, który przemówi do decydentów.',
    },
    {
      id: 'add_context',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Add context paragraph',
      labelPl: 'Dodaj akapit kontekstu',
      instruction:
        'Add a brief context paragraph before or after the quote explaining its significance.',
      instructionPl: 'Dodaj krótki akapit kontekstu wyjaśniający znaczenie cytatu.',
    },
    {
      id: 'make_impactful',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Make more impactful',
      labelPl: 'Zwiększ oddziaływanie',
      instruction:
        'Rewrite to be more punchy and memorable. Use stronger language and clearer insight.',
      instructionPl:
        'Przepisz na bardziej uderzający i pamiętny. Mocniejszy język, jaśniejszy przekaz.',
    },
  ],
  custom: [
    {
      id: 'structure_sections',
      icon: <List className="w-3.5 h-3.5" />,
      label: 'Structure into sections',
      labelPl: 'Podziel na sekcje',
      instruction: 'Organize content into clear sections with headers and logical flow.',
      instructionPl: 'Podziel treść na czytelne sekcje z nagłówkami i logicznym przepływem.',
    },
    {
      id: 'add_references',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Add data references',
      labelPl: 'Dodaj odniesienia do danych',
      instruction: 'Add specific data references, scores, and evidence to support each statement.',
      instructionPl: 'Dodaj konkretne odniesienia do danych, wyników i dowodów.',
    },
    {
      id: 'professional_tone',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Professional tone',
      labelPl: 'Ton profesjonalny',
      instruction: 'Rewrite in professional consulting tone. Clear, authoritative, evidence-based.',
      instructionPl:
        'Przepisz w profesjonalnym tonie doradczym. Jasny, autorytatywny, oparty na danych.',
    },
  ],
  // --- Data blocks ---
  matrix: [
    {
      id: 'highlight_gaps',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Highlight biggest gaps',
      labelPl: 'Podświetl największe luki',
      instruction: 'Emphasize the areas with the largest gap between current and target scores.',
      instructionPl: 'Podkreśl obszary z największą luką między aktualnym a docelowym wynikiem.',
    },
    {
      id: 'add_trend',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      label: 'Add trend column',
      labelPl: 'Dodaj kolumnę trendu',
      instruction: 'Add a trend indicator column showing improvement direction for each area.',
      instructionPl: 'Dodaj kolumnę trendu pokazującą kierunek poprawy.',
    },
  ],
  table: [
    {
      id: 'sort_score',
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      label: 'Sort by score',
      labelPl: 'Sortuj wg wyniku',
      instruction: 'Sort table rows by score or primary metric, descending.',
      instructionPl: 'Posortuj wiersze wg wyniku lub głównej metryki, malejąco.',
    },
    {
      id: 'add_trend_col',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      label: 'Add trend column',
      labelPl: 'Dodaj kolumnę trendu',
      instruction: 'Add a trend/change column showing improvement direction.',
      instructionPl: 'Dodaj kolumnę trendu pokazującą kierunek zmian.',
    },
    {
      id: 'highlight_outliers',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Highlight outliers',
      labelPl: 'Podświetl odchylenia',
      instruction: 'Highlight rows with unusually high or low values compared to average.',
      instructionPl: 'Podświetl wiersze z wartościami znacząco powyżej lub poniżej średniej.',
    },
  ],
  findings: [
    {
      id: 'prioritize_impact',
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      label: 'Prioritize by impact',
      labelPl: 'Priorytetyzuj wg wpływu',
      instruction: 'Reorder findings by business impact. Most critical first.',
      instructionPl: 'Uporządkuj wnioski wg wpływu biznesowego. Najważniejsze najpierw.',
    },
    {
      id: 'add_evidence',
      icon: <BookOpen className="w-3.5 h-3.5" />,
      label: 'Add evidence',
      labelPl: 'Dodaj dowody',
      instruction: 'Add specific data points, scores, and evidence supporting each finding.',
      instructionPl: 'Dodaj konkretne dane, wyniki i dowody do każdego wniosku.',
    },
    {
      id: 'executive_format',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Executive format',
      labelPl: 'Format zarządczy',
      instruction: 'Reformat for executive audience: short, impact-focused, with clear "so what".',
      instructionPl: 'Przeformatuj dla kadry zarządzającej: krótko, z naciskiem na wpływ.',
    },
  ],
  dashboard: [
    {
      id: 'add_targets',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add targets',
      labelPl: 'Dodaj cele',
      instruction: 'Add target values and goal indicators for each KPI.',
      instructionPl: 'Dodaj wartości docelowe i wskaźniki celu.',
    },
    {
      id: 'highlight_alerts',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Highlight alerts',
      labelPl: 'Podświetl alerty',
      instruction: 'Add red/amber/green status indicators based on performance.',
      instructionPl: 'Dodaj wskaźniki RAG na podstawie wyników.',
    },
    {
      id: 'add_sparklines',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add trend data',
      labelPl: 'Dodaj dane trendu',
      instruction: 'Add trend information and historical context for each metric.',
      instructionPl: 'Dodaj informacje o trendach i kontekst historyczny.',
    },
  ],
  scorecard: [
    {
      id: 'add_targets',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add targets',
      labelPl: 'Dodaj cele',
      instruction: 'Add target scores and gap indicators for each dimension.',
      instructionPl: 'Dodaj wyniki docelowe i wskaźniki luk.',
    },
    {
      id: 'traffic_light',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Traffic light colors',
      labelPl: 'Kolory RAG',
      instruction: 'Add RAG (Red/Amber/Green) status indicators based on score vs target.',
      instructionPl: 'Dodaj wskaźniki RAG (Czerwony/Bursztynowy/Zielony) vs cele.',
    },
    {
      id: 'add_trends',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      label: 'Add trend arrows',
      labelPl: 'Dodaj strzałki trendu',
      instruction: 'Add trend direction indicators showing improvement or decline.',
      instructionPl: 'Dodaj wskaźniki kierunku trendu: poprawa lub spadek.',
    },
  ],
  gap_analysis: [
    {
      id: 'focus_critical',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Focus on critical gaps',
      labelPl: 'Skup się na krytycznych lukach',
      instruction:
        'Highlight only the most critical gaps (>1.5 points) and explain business impact.',
      instructionPl: 'Podkreśl tylko krytyczne luki (>1,5 pkt) i wyjaśnij wpływ biznesowy.',
    },
    {
      id: 'add_remediation',
      icon: <List className="w-3.5 h-3.5" />,
      label: 'Add remediation steps',
      labelPl: 'Dodaj kroki naprawcze',
      instruction: 'Add 1-2 concrete remediation steps for each identified gap.',
      instructionPl: 'Dodaj 1-2 konkretne kroki naprawcze dla każdej zidentyfikowanej luki.',
    },
    {
      id: 'rank_severity',
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      label: 'Rank by severity',
      labelPl: 'Rankuj wg krytyczności',
      instruction: 'Sort gaps by severity. Largest gaps first, with impact assessment.',
      instructionPl: 'Posortuj luki wg krytyczności. Największe najpierw, z oceną wpływu.',
    },
  ],
  // --- Visual blocks ---
  chart_bar: [
    {
      id: 'sort_desc',
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      label: 'Sort descending',
      labelPl: 'Sortuj malejąco',
      instruction: 'Sort data descending by value.',
      instructionPl: 'Posortuj dane malejąco.',
    },
    {
      id: 'add_trend',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      label: 'Add trend line',
      labelPl: 'Dodaj linię trendu',
      instruction: 'Add a trend/average line to the chart data.',
      instructionPl: 'Dodaj linię trendu/średniej.',
    },
  ],
  chart_pie: [
    {
      id: 'merge_small',
      icon: <Minimize2 className="w-3.5 h-3.5" />,
      label: 'Merge small segments',
      labelPl: 'Połącz małe segmenty',
      instruction: 'Merge segments below 5% into an "Other" category for clarity.',
      instructionPl: 'Połącz segmenty poniżej 5% w kategorię "Inne".',
    },
    {
      id: 'add_percentages',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add percentages',
      labelPl: 'Dodaj procenty',
      instruction: 'Add percentage labels to each segment.',
      instructionPl: 'Dodaj etykiety procentowe do każdego segmentu.',
    },
    {
      id: 'top_n',
      icon: <Filter className="w-3.5 h-3.5" />,
      label: 'Top N only',
      labelPl: 'Tylko Top N',
      instruction: 'Show only the top 5-7 segments, group the rest into "Other".',
      instructionPl: 'Pokaż tylko 5-7 największych segmentów, resztę zgrupuj.',
    },
  ],
  image: [
    {
      id: 'generate_alt',
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'Generate alt text',
      labelPl: 'Generuj tekst alt',
      instruction: 'Generate descriptive alt text for accessibility.',
      instructionPl: 'Wygeneruj opisowy tekst alt dla dostępności.',
    },
    {
      id: 'suggest_diagram',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Suggest diagram type',
      labelPl: 'Zaproponuj typ diagramu',
      instruction:
        'Suggest the best diagram type (flowchart, process map, org chart, etc.) for this content.',
      instructionPl:
        'Zaproponuj najlepszy typ diagramu (flowchart, mapa procesu, schemat org.) dla tej treści.',
    },
    {
      id: 'add_caption',
      icon: <Pencil className="w-3.5 h-3.5" />,
      label: 'Add caption',
      labelPl: 'Dodaj podpis',
      instruction: 'Add a descriptive caption explaining what the image shows and key takeaways.',
      instructionPl: 'Dodaj podpis wyjaśniający co obraz przedstawia i kluczowe wnioski.',
    },
  ],
  roadmap: [
    {
      id: 'add_milestones',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add milestones',
      labelPl: 'Dodaj kamienie milowe',
      instruction: 'Add clear milestones with dates for each phase.',
      instructionPl: 'Dodaj kamienie milowe z datami.',
    },
    {
      id: 'add_dependencies',
      icon: <List className="w-3.5 h-3.5" />,
      label: 'Show dependencies',
      labelPl: 'Pokaż zależności',
      instruction: 'Add dependencies between phases and highlight critical path.',
      instructionPl: 'Dodaj zależności między fazami i podkreśl ścieżkę krytyczną.',
    },
    {
      id: 'add_resources',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add resource needs',
      labelPl: 'Dodaj potrzeby zasobowe',
      instruction: 'Add estimated resources, team size, and budget for each phase.',
      instructionPl: 'Dodaj szacowane zasoby, wielkość zespołu i budżet na każdą fazę.',
    },
  ],
  kpis: [
    {
      id: 'add_targets',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add targets',
      labelPl: 'Dodaj cele',
      instruction: 'Add target values and achievement thresholds for each KPI.',
      instructionPl: 'Dodaj wartości docelowe i progi osiągnięcia.',
    },
    {
      id: 'vs_benchmark',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Show vs benchmark',
      labelPl: 'Pokaż vs benchmark',
      instruction: 'Add industry benchmark comparison for each KPI.',
      instructionPl: 'Dodaj porównanie z benchmarkiem branżowym.',
    },
    {
      id: 'compact_cards',
      icon: <Minimize2 className="w-3.5 h-3.5" />,
      label: 'Compact cards',
      labelPl: 'Kompaktowe karty',
      instruction: 'Make KPI cards more compact: smaller, denser, with key numbers prominent.',
      instructionPl: 'Zrób kompaktowe karty KPI: mniejsze, gęstsze, z wyraźnymi liczbami.',
    },
  ],
  risk: [
    {
      id: 'add_mitigations',
      icon: <List className="w-3.5 h-3.5" />,
      label: 'Add mitigations',
      labelPl: 'Dodaj mitygacje',
      instruction: 'Add mitigation strategies and contingency plans for each risk.',
      instructionPl: 'Dodaj strategie mitygacji i plany awaryjne.',
    },
    {
      id: 'priority_sort',
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      label: 'Sort by severity',
      labelPl: 'Sortuj wg krytyczności',
      instruction: 'Sort risks by severity (probability x impact). Highlight critical ones.',
      instructionPl: 'Posortuj ryzyka wg krytyczności. Podświetl krytyczne.',
    },
    {
      id: 'probability_matrix',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Add probability matrix',
      labelPl: 'Dodaj macierz prawdopodobieństwa',
      instruction: 'Add a probability vs impact matrix categorizing each risk.',
      instructionPl: 'Dodaj macierz prawdopodobieństwo vs wpływ.',
    },
    {
      id: 'categorize',
      icon: <Filter className="w-3.5 h-3.5" />,
      label: 'Categorize by type',
      labelPl: 'Kategoryzuj wg typu',
      instruction: 'Group risks by type: operational, strategic, technical, financial, compliance.',
      instructionPl: 'Pogrupuj ryzyka wg typu: operacyjne, strategiczne, techniczne, finansowe.',
    },
  ],
  prioritization: [
    {
      id: 'rebalance',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Rebalance quadrants',
      labelPl: 'Zrównoważ kwadranty',
      instruction:
        'Redistribute items across quadrants for better balance. Reassess classifications.',
      instructionPl: 'Rozłóż elementy bardziej równomiernie między kwadranty.',
    },
    {
      id: 'add_effort',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add effort estimates',
      labelPl: 'Dodaj szacunki nakładów',
      instruction: 'Add effort estimates (T-shirt: S/M/L/XL) and timeline for each item.',
      instructionPl: 'Dodaj szacunki nakładów (S/M/L/XL) i harmonogram.',
    },
    {
      id: 'highlight_qw',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Highlight quick wins',
      labelPl: 'Podświetl szybkie wygrane',
      instruction: 'Highlight the quick wins quadrant (high impact, low effort) items.',
      instructionPl: 'Podświetl szybkie wygrane (wysoki wpływ, niski nakład).',
    },
  ],
  initiatives: [
    {
      id: 'add_effort',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      label: 'Add effort estimates',
      labelPl: 'Dodaj szacunki nakładów',
      instruction: 'Add effort estimates (T-shirt sizing: S/M/L/XL) and budget ranges.',
      instructionPl: 'Dodaj szacunki nakładów (S/M/L/XL) i zakresy budżetowe.',
    },
    {
      id: 'group_by_axis',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      label: 'Group by axis',
      labelPl: 'Grupuj wg osi',
      instruction: 'Group initiatives by transformation axis/topic.',
      instructionPl: 'Pogrupuj inicjatywy wg osi transformacji.',
    },
    {
      id: 'add_roi',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Add ROI estimates',
      labelPl: 'Dodaj szacunki ROI',
      instruction: 'Add estimated ROI and payback period for each initiative.',
      instructionPl: 'Dodaj szacowane ROI i okres zwrotu dla każdej inicjatywy.',
    },
    {
      id: 'compare_baseline',
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      label: 'Compare to baseline',
      labelPl: 'Porównaj z baseline',
      instruction: 'Add baseline comparison showing expected improvement from current state.',
      instructionPl: 'Dodaj porównanie z baseline pokazujące oczekiwaną poprawę.',
    },
  ],
};

// Universal AI actions (for all blocks)
const UNIVERSAL_ACTIONS: ContextualAction[] = [
  {
    id: 'shorten',
    icon: <Minimize2 className="w-3.5 h-3.5" />,
    label: 'Shorten',
    labelPl: 'Skróć',
    instruction: 'Make significantly shorter. Keep only critical points.',
    instructionPl: 'Znacząco skróć. Zachowaj tylko kluczowe punkty.',
  },
  {
    id: 'expand',
    icon: <ArrowUpRight className="w-3.5 h-3.5" />,
    label: 'Expand',
    labelPl: 'Rozwiń',
    instruction: 'Expand with more detail, examples, and evidence.',
    instructionPl: 'Rozwiń z detalami, przykładami i dowodami.',
  },
  {
    id: 'executive',
    icon: <Target className="w-3.5 h-3.5" />,
    label: 'Executive tone',
    labelPl: 'Ton zarządczy',
    instruction: 'Rewrite in executive style: concise, action-oriented, business impact.',
    instructionPl: 'Przepisz w stylu zarządczym: zwięźle, na działanie, wpływ biznesowy.',
  },
  {
    id: 'simplify',
    icon: <Type className="w-3.5 h-3.5" />,
    label: 'Simplify',
    labelPl: 'Uprość',
    instruction: 'Simplify language. Remove jargon. Make accessible.',
    instructionPl: 'Uprość język. Usuń żargon.',
  },
  {
    id: 'bullets',
    icon: <List className="w-3.5 h-3.5" />,
    label: 'To bullets',
    labelPl: 'Na punkty',
    instruction: 'Convert to clear bullet points.',
    instructionPl: 'Zamień na przejrzyste punkty.',
  },
  {
    id: 'prose',
    icon: <MessageCircle className="w-3.5 h-3.5" />,
    label: 'To prose',
    labelPl: 'Na tekst ciągły',
    instruction: 'Rewrite as flowing prose paragraphs.',
    instructionPl: 'Przepisz jako płynne akapity.',
  },
  {
    id: 'add_data_refs',
    icon: <BookOpen className="w-3.5 h-3.5" />,
    label: 'Add data references',
    labelPl: 'Dodaj odniesienia do danych',
    instruction: 'Add specific data references, scores, and citations to back up each claim.',
    instructionPl: 'Dodaj odniesienia do danych, wyniki i cytaty wspierające każde stwierdzenie.',
  },
  {
    id: 'translate',
    icon: <Languages className="w-3.5 h-3.5" />,
    label: 'Translate',
    labelPl: 'Przetłumacz',
    instruction:
      'Translate the content to the report language. Preserve formatting, structure, and meaning.',
    instructionPl:
      'Przetłumacz treść na język raportu. Zachowaj formatowanie, strukturę i znaczenie.',
  },
  {
    id: 'fix_formatting',
    icon: <Sliders className="w-3.5 h-3.5" />,
    label: 'Fix formatting',
    labelPl: 'Napraw formatowanie',
    instruction:
      'Fix markdown formatting: proper headers, consistent lists, clean tables, correct hierarchy.',
    instructionPl: 'Napraw formatowanie markdown: poprawne nagłówki, spójne listy, czyste tabele.',
  },
];

// ==========================================
// SMART PROMPT PLACEHOLDERS per block type
// ==========================================

const PROMPT_PLACEHOLDERS: Record<string, { en: string; pl: string }> = {
  cover: {
    en: 'E.g., "Modern style, subtitle: Digital Maturity Report Q1 2026"',
    pl: 'Np. "Nowoczesny styl, podtytuł: Raport Dojrzałości Cyfrowej Q1 2026"',
  },
  summary: {
    en: 'E.g., "Start with 3 key findings, include metrics, 3-sentence board summary"',
    pl: 'Np. "Zacznij od 3 kluczowych wniosków, dodaj metryki, 3-zdaniowe podsumowanie"',
  },
  analysis: {
    en: 'E.g., "Focus on gaps >1.5 points, include evidence and benchmarks"',
    pl: 'Np. "Skup się na lukach >1,5 pkt, dodaj dowody i benchmarki"',
  },
  recommendations: {
    en: 'E.g., "Max 5 recommendations with timeline and owner for each"',
    pl: 'Np. "Max 5 rekomendacji z harmonogramem i właścicielem"',
  },
  methodology: {
    en: 'E.g., "Explain framework simply for non-technical audience"',
    pl: 'Np. "Wyjaśnij framework prosto dla nietechnicznej publiczności"',
  },
  context: {
    en: 'E.g., "Focus on digital capabilities, add industry benchmarks"',
    pl: 'Np. "Skup się na zdolnościach cyfrowych, dodaj benchmarki branżowe"',
  },
  axis_analysis: {
    en: 'E.g., "Deep dive per axis, include scores and 2 actions per area"',
    pl: 'Np. "Pogłębiona analiza per oś, z wynikami i 2 akcjami na obszar"',
  },
  action_plan: {
    en: 'E.g., "Include milestones, owners, and resource estimates"',
    pl: 'Np. "Dodaj kamienie milowe, właścicieli i szacunki zasobów"',
  },
  appendix: {
    en: 'E.g., "Include glossary, data sources table, compact format"',
    pl: 'Np. "Dodaj słownik, tabelę źródeł, kompaktowy format"',
  },
  quote: {
    en: 'E.g., "Strong, memorable insight for executive audience"',
    pl: 'Np. "Mocny, pamiętny cytat dla kadry zarządzającej"',
  },
  custom: {
    en: 'Describe what AI should generate in this block...',
    pl: 'Opisz co AI ma wygenerować w tym bloku...',
  },
  matrix: {
    en: 'E.g., "Highlight gaps >1.5 points, add trend indicators"',
    pl: 'Np. "Podświetl luki >1,5 pkt, dodaj wskaźniki trendu"',
  },
  table: {
    en: 'E.g., "Sort by score descending, highlight top 5 and bottom 5"',
    pl: 'Np. "Sortuj wg wyników malejąco, podświetl top 5 i bottom 5"',
  },
  findings: {
    en: 'E.g., "Top 8 findings with evidence, prioritized by impact"',
    pl: 'Np. "Top 8 wniosków z dowodami, priorytetyzowane wg wpływu"',
  },
  dashboard: {
    en: 'E.g., "6 key KPIs with targets and RAG status indicators"',
    pl: 'Np. "6 kluczowych KPI z celami i wskaźnikami RAG"',
  },
  scorecard: {
    en: 'E.g., "Add targets, traffic light status, trend arrows"',
    pl: 'Np. "Dodaj cele, status RAG, strzałki trendu"',
  },
  gap_analysis: {
    en: 'E.g., "Focus on critical gaps, add remediation steps"',
    pl: 'Np. "Skup się na krytycznych lukach, dodaj kroki naprawcze"',
  },
  chart: {
    en: 'E.g., "Bar chart sorted descending with average line"',
    pl: 'Np. "Wykres słupkowy malejąco z linią średniej"',
  },
  chart_bar: {
    en: 'E.g., "Sort bars descending, add trend line"',
    pl: 'Np. "Sortuj słupki malejąco, dodaj linię trendu"',
  },
  chart_pie: {
    en: 'E.g., "Top 7 segments, merge rest into Other, show percentages"',
    pl: 'Np. "Top 7 segmentów, resztę połącz w Inne, pokaż procenty"',
  },
  image: {
    en: 'E.g., "Process flowchart showing assessment methodology"',
    pl: 'Np. "Flowchart procesu pokazujący metodologię oceny"',
  },
  roadmap: {
    en: 'E.g., "3 phases over 12 months with milestones and dependencies"',
    pl: 'Np. "3 fazy w 12 miesięcy z kamieniami milowymi i zależnościami"',
  },
  kpis: {
    en: 'E.g., "6 KPIs in 3-column grid with targets and benchmarks"',
    pl: 'Np. "6 KPI w siatce 3-kolumnowej z celami i benchmarkami"',
  },
  risk: {
    en: 'E.g., "Risk register with mitigations, sorted by severity"',
    pl: 'Np. "Rejestr ryzyk z mitygacjami, sortowany wg krytyczności"',
  },
  prioritization: {
    en: 'E.g., "2x2 matrix: impact vs effort, highlight quick wins"',
    pl: 'Np. "Macierz 2x2: wpływ vs nakład, podświetl szybkie wygrane"',
  },
  initiatives: {
    en: 'E.g., "Initiative cards with ROI, effort sizing, grouped by axis"',
    pl: 'Np. "Karty inicjatyw z ROI, sizing nakładów, grupowane wg osi"',
  },
};

// ==========================================
// COVER PREVIEW
// ==========================================

const CoverPreview: React.FC<{ content: string }> = ({ content }) => {
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      const p = JSON.parse(trimmed);
      return (
        <div className="text-center py-6 px-4">
          <h3 className="text-xl font-bold text-c-text mb-1">{p.title || 'Report'}</h3>
          {p.subtitle && <p className="text-sm text-c-text-secondary mb-3">{p.subtitle}</p>}
          <div className="flex items-center justify-center gap-2 text-xs text-c-text-secondary">
            {p.companyName || p.company ? <span>{p.companyName || p.company}</span> : null}
            {(p.companyName || p.company) && p.date ? <span>·</span> : null}
            {p.date ? <span>{p.date}</span> : null}
          </div>
        </div>
      );
    }
  } catch {
    /* fallthrough */
  }
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

// ==========================================
// UNDO/REDO HOOK
// ==========================================

function useUndoRedo(initialValue: string) {
  const [history, setHistory] = useState<string[]>([initialValue]);
  const [index, setIndex] = useState(0);
  const current = history[index];

  const push = useCallback(
    (value: string) => {
      if (value === history[index]) return;
      const h = history.slice(0, index + 1);
      h.push(value);
      if (h.length > 50) h.shift();
      setHistory(h);
      setIndex(h.length - 1);
    },
    [history, index]
  );

  const undo = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);
  const redo = useCallback(() => {
    if (index < history.length - 1) setIndex(index + 1);
  }, [index, history.length]);

  return { current, push, undo, redo, canUndo: index > 0, canRedo: index < history.length - 1 };
}

// ==========================================
// COMPONENT
// ==========================================

export const BlockCard: React.FC<BlockCardProps> = ({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  onRegenerate,
  onGenerateBlock,
  onSaveContent,
  canMoveUp,
  canMoveDown,
  isPl,
  previousBlockSummary,
  nextBlockSummary,
  reportId,
  onLoadComments,
  onAddComment,
  onResolveComment,
  onDismissComment,
  onBulkResolve,
}) => {
  const { t } = useTranslation();
  const hasContent = Boolean(block.content);
  const [mode, setMode] = useState<BlockMode>(hasContent ? 'preview' : 'configure');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  // Edit mode state (inline editing in Preview tab)
  const [isEditing, setIsEditing] = useState(false);
  const {
    current: editContent,
    push: pushEdit,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo(block.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI action state
  const [isProcessing, setIsProcessing] = useState(false);
  // Queued quick-actions (toggled on/off, applied on Regenerate)
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Diff state (after AI regeneration)
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Preview content collapse
  const [contentExpanded, setContentExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const PREVIEW_MAX_HEIGHT = 200;
  const [contentOverflows, setContentOverflows] = useState(false);

  // Comments state (backend-connected)
  const [blockComments, setBlockComments] = useState<BlockComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('FEEDBACK');

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 500)}px`;
    }
  }, [isEditing]);

  // Sync edit content when block content changes externally
  useEffect(() => {
    if (block.content && !isEditing) {
      pushEdit(block.content);
    }
  }, [block.content]);

  // Load comments from backend when comments tab is opened
  useEffect(() => {
    if (
      mode === 'comments' &&
      !commentsLoaded &&
      onLoadComments &&
      block.id &&
      !block.id.startsWith('tmp_')
    ) {
      setIsLoadingComments(true);
      onLoadComments(block.id)
        .then((comments) => {
          setBlockComments(comments);
          setCommentsLoaded(true);
        })
        .catch(() => {
          setCommentsLoaded(true);
        })
        .finally(() => setIsLoadingComments(false));
    }
  }, [mode, commentsLoaded, onLoadComments, block.id]);

  // Check content overflow for show more/less
  useEffect(() => {
    if (mode === 'preview' && contentRef.current && !isEditing) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          setContentOverflows(contentRef.current.scrollHeight > PREVIEW_MAX_HEIGHT + 20);
        }
      });
    }
  }, [mode, block.content, isEditing]);

  // Generate/regenerate this block
  const handleGenerateBlock = async () => {
    if (!onGenerateBlock || block.id.startsWith('tmp_')) return;
    if (block.content) setPreviousContent(block.content);
    try {
      await onGenerateBlock();
      setMode('preview');
      if (block.content) setShowDiff(true);
    } catch (err) {
      console.error('Generate block failed:', err);
    }
  };

  const handleSaveEdit = () => {
    onUpdate({ content: editContent });
    onSaveContent?.(editContent);
    setIsEditing(false);
    toast.success(t('reportBuilder.blockCard.saved', 'Saved'));
  };

  // Keyboard shortcuts in edit mode
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') setIsEditing(false);
  };

  // Comment handlers (backend-connected)
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (onAddComment && block.id && !block.id.startsWith('tmp_')) {
      const comment = await onAddComment(block.id, newComment.trim(), commentType);
      if (comment) {
        setBlockComments((prev) => [comment, ...prev]);
        setNewComment('');
        toast.success(t('reportBuilder.blockCard.commentAdded', 'Comment added'));
      }
    } else {
      // Fallback local-only
      setBlockComments((prev) => [
        {
          id: `local_${Date.now()}`,
          content: newComment.trim(),
          commentType,
          status: 'OPEN',
          userName: 'You',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewComment('');
    }
  };

  const handleResolveComment = async (commentId: string) => {
    const comment = blockComments.find((c) => c.id === commentId);
    if (!comment) return;

    // Resolve via backend
    if (onResolveComment) {
      await onResolveComment(commentId);
    }
    setBlockComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status: 'RESOLVED' as const } : c))
    );

    // If it's a suggestion/change_request, also trigger AI regeneration
    if (
      (comment.commentType === 'SUGGESTION' || comment.commentType === 'CHANGE_REQUEST') &&
      onRegenerate &&
      block.content
    ) {
      setPreviousContent(block.content);
      const instruction = `Apply this feedback to the content: "${comment.content}"`;
      onRegenerate(instruction).then(() => {
        setShowDiff(true);
        setMode('preview');
      });
      toast.success(
        t(
          'reportBuilder.blockCard.commentResolvedAiUpdatingContent',
          'Comment resolved — AI updating content'
        )
      );
    } else {
      toast.success(t('reportBuilder.blockCard.commentResolved', 'Comment resolved'));
    }
  };

  const handleDismissComment = async (commentId: string) => {
    if (onDismissComment) {
      await onDismissComment(commentId);
    }
    setBlockComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status: 'DISMISSED' as const } : c))
    );
  };

  const handleBulkResolve = async () => {
    const openIds = blockComments.filter((c) => c.status === 'OPEN').map((c) => c.id);
    if (openIds.length === 0) return;
    if (onBulkResolve) {
      await onBulkResolve(openIds);
    }
    setBlockComments((prev) =>
      prev.map((c) => (openIds.includes(c.id) ? { ...c, status: 'RESOLVED' as const } : c))
    );
    toast.success(
      t('reportBuilder.blockCard.nCommentsResolved', {
        defaultValue: `${openIds.length} comments resolved`,
        count: openIds.length,
      })
    );
  };

  // Get contextual actions for this block type
  const contextActions = CONTEXTUAL_ACTIONS[block.type] || [];
  const category = getBlockCategory(block.type);

  const editHasChanges = editContent !== (block.content || '');

  return (
    <div
      className={`
        group relative bg-c-surface rounded-xl border-2 transition-all
        ${
          isSelected
            ? 'border-blue-500 shadow-lg shadow-blue-500/10'
            : 'border-c-border-subtle hover:border-c-border-subtle'
        }
        ${!block.enabled ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
    >
      {/* ===== HEADER ===== */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-c-border-subtle">
        {/* Drag */}
        <div className="cursor-grab text-c-text-secondary hover:text-c-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
          <Grip className="w-4 h-4" />
        </div>

        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getBlockColor(block.type)} flex items-center justify-center text-c-text flex-shrink-0`}
        >
          {getBlockIcon(block.type)}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full font-semibold text-sm text-c-text bg-transparent border-none outline-none focus:ring-0"
            placeholder={t('reportBuilder.blockCard.blockTitle', 'Block title...')}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-c-text-secondary capitalize">
              {block.type.replace(/_/g, ' ')}
            </span>
            {block.isGenerating && (
              <span className="text-[9px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center gap-1 font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {t('reportBuilder.blockCard.generating', 'Generating...')}
              </span>
            )}
            {!block.isGenerating && block.isGenerated && !block.needsRegeneration && (
              <span className="text-[9px] px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded font-medium">
                {t('reportBuilder.blockCard.generated', 'Generated')}
              </span>
            )}
            {!block.isGenerating && block.needsRegeneration && (
              <span className="text-[9px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded flex items-center gap-1 font-medium">
                <RefreshCw className="w-2.5 h-2.5" />
                {t('reportBuilder.blockCard.modified', 'Modified')}
              </span>
            )}
            {!block.isGenerating && !block.isGenerated && !block.needsRegeneration && (
              <span className="text-[9px] px-1 py-0.5 bg-c-surface-raised text-c-text-secondary rounded font-medium">
                {t('reportBuilder.blockCard.new', 'New')}
              </span>
            )}
          </div>
        </div>

        {/* Generate button */}
        {onGenerateBlock && !block.id.startsWith('tmp_') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateBlock();
            }}
            disabled={block.isGenerating}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
              block.isGenerating
                ? 'opacity-50 cursor-not-allowed bg-c-surface-raised text-c-text-secondary'
                : !block.isGenerated
                  ? 'bg-c-info text-c-bg hover:opacity-90 shadow-sm'
                  : block.needsRegeneration
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                    : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle opacity-0 group-hover:opacity-100'
            }`}
            title={
              block.isGenerating
                ? t('reportBuilder.blockCard.generating', 'Generating...')
                : !block.isGenerated
                  ? t('reportBuilder.blockCard.generateThisBlock', 'Generate this block')
                  : block.needsRegeneration
                    ? t(
                        'reportBuilder.blockCard.regenerateSettingsChanged',
                        'Regenerate (settings changed)'
                      )
                    : t('reportBuilder.blockCard.regenerate', 'Regenerate')
            }
          >
            {block.isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : !block.isGenerated ? (
              <Play className="w-3 h-3" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {block.isGenerating
              ? t('reportBuilder.blockCard.generating', 'Generating...')
              : !block.isGenerated
                ? t('reportBuilder.blockCard.generate', 'Generate')
                : block.needsRegeneration
                  ? t('reportBuilder.blockCard.regenerate', 'Regenerate')
                  : t('reportBuilder.blockCard.regenerate', 'Regenerate')}
          </button>
        )}

        {/* Reorder buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded disabled:opacity-30"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded disabled:opacity-30"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-c-surface rounded-lg shadow-lg border border-slate-200/60 dark:border-white/[0.03] py-1 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBelow();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-c-text hover:bg-c-surface-raised"
              >
                <Plus className="w-3.5 h-3.5" />{' '}
                {t('reportBuilder.blockCard.addBelow', 'Add below')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ enabled: !block.enabled });
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-c-text hover:bg-c-surface-raised"
              >
                {block.enabled
                  ? t('reportBuilder.blockCard.disable', 'Disable')
                  : t('reportBuilder.blockCard.enable', 'Enable')}
              </button>
              {block.content && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(block.content || '');
                    toast.success('Copied');
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-c-text hover:bg-c-surface-raised"
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />{' '}
                  {t('reportBuilder.blockCard.copy', 'Copy')}
                </button>
              )}
              <hr className="my-1 border-c-border-subtle" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('reportBuilder.blockCard.remove', 'Remove')}
              </button>
            </div>
          )}
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1 text-c-text-secondary hover:text-c-text-secondary"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* ===== MODE TABS ===== */}
      {isExpanded && (
        <div className="flex items-center border-b border-c-border-subtle bg-c-surface-raised">
          {[
            {
              key: 'configure' as BlockMode,
              icon: <Sliders className="w-3 h-3" />,
              label: t('reportBuilder.blockCard.configure', 'Configure'),
            },
            { key: 'ai' as BlockMode, icon: <Sparkles className="w-3 h-3" />, label: 'AI' },
            {
              key: 'preview' as BlockMode,
              icon: <Eye className="w-3 h-3" />,
              label: t('reportBuilder.blockCard.preview', 'Preview'),
              badge: hasContent ? undefined : t('reportBuilder.blockCard.empty', 'empty'),
            },
            {
              key: 'comments' as BlockMode,
              icon: <MessageCircle className="w-3 h-3" />,
              label: t('reportBuilder.blockCard.comments', 'Comments'),
              badge: blockComments.filter((c) => c.status === 'OPEN').length || undefined,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={(e) => {
                e.stopPropagation();
                setMode(tab.key);
                if (tab.key === 'preview') setIsEditing(false);
              }}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-all border-b-2 ${
                mode === tab.key
                  ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'text-c-text-secondary border-transparent hover:text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge && (
                <span
                  className={`ml-1 px-1 py-0 text-[8px] font-bold rounded-full ${
                    typeof tab.badge === 'number'
                      ? 'bg-amber-500 text-c-text min-w-[14px] text-center'
                      : 'bg-c-border-subtle text-c-text-secondary'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ===== CONTENT AREA ===== */}
      {isExpanded && (
        <div className="relative">
          {/* --- CONFIGURE TAB --- */}
          {mode === 'configure' && (
            <div className="p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Core settings row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1.5">
                    {t('reportBuilder.blockCard.length', 'Length')}
                  </label>
                  <div className="flex gap-1">
                    {(['short', 'medium', 'long'] as const).map((len) => (
                      <button
                        key={len}
                        onClick={() => onUpdate({ length: len })}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-medium rounded transition-all ${
                          block.length === len
                            ? 'bg-blue-600 text-c-text shadow-sm'
                            : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                        }`}
                      >
                        {len === 'short'
                          ? t('reportBuilder.blockCard.short', 'Short')
                          : len === 'medium'
                            ? t('reportBuilder.blockCard.medium', 'Medium')
                            : t('reportBuilder.blockCard.long', 'Long')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1.5">
                    {t('reportBuilder.blockCard.visuals', 'Visuals')}
                  </label>
                  <button
                    onClick={() => onUpdate({ includeVisuals: !block.includeVisuals })}
                    className={`w-full py-1.5 px-3 text-[10px] font-medium rounded flex items-center justify-center gap-1.5 transition-all ${
                      block.includeVisuals
                        ? 'bg-c-surface text-c-text shadow-sm'
                        : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                    }`}
                  >
                    <Image className="w-3 h-3" />
                    {block.includeVisuals
                      ? t('reportBuilder.blockCard.enabled', 'Enabled')
                      : t('reportBuilder.blockCard.disabled', 'Disabled')}
                  </button>
                </div>
              </div>

              {/* Dynamic block settings (all groups) */}
              {getBlockSettings(block.type, block.blockTypeId) && (
                <div className="pt-3 border-t border-c-border-subtle">
                  <BlockSettingsPanel
                    blockType={block.type}
                    blockTypeId={block.blockTypeId}
                    blockSettings={block.blockSettings || {}}
                    onSettingsChange={(settings) => onUpdate({ blockSettings: settings })}
                    isPl={isPl}
                  />
                </div>
              )}
            </div>
          )}

          {/* --- AI TAB --- */}
          {mode === 'ai' && (
            <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* ── Section 1: Main Prompt (persistent) ── */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1">
                  <Wand2 className="w-3 h-3 text-c-accent" />
                  {t('reportBuilder.blockCard.mainPrompt', 'Main prompt')}
                </label>
                <textarea
                  value={block.customPrompt || ''}
                  onChange={(e) => onUpdate({ customPrompt: e.target.value })}
                  placeholder={
                    isPl
                      ? PROMPT_PLACEHOLDERS[block.type]?.pl || PROMPT_PLACEHOLDERS.custom.pl
                      : PROMPT_PLACEHOLDERS[block.type]?.en || PROMPT_PLACEHOLDERS.custom.en
                  }
                  className="w-full px-3 py-2 text-[11px] bg-c-surface-raised border border-c-border-subtle rounded-lg resize-none h-16 focus:ring-2 focus:ring-c-focus focus:border-c-accent leading-relaxed placeholder:text-c-text-muted"
                />
              </div>

              {/* ── Section 2: Additional Instructions (one-off) ── */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1">
                  <MessageSquarePlus className="w-3 h-3 text-blue-500" />
                  {t('reportBuilder.blockCard.additionalInstructions', 'Additional instructions')}
                </label>
                <textarea
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                  placeholder={t(
                    'reportBuilder.blockCard.eGShortenTo3Paragraphs',
                    'E.g., "Shorten to 3 paragraphs, add metrics, formal tone..."'
                  )}
                  className="w-full px-3 py-2 text-[11px] bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-800/40 rounded-lg resize-none h-12 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 leading-relaxed placeholder:text-c-text-muted"
                />
              </div>

              {/* ── Section 3: Quick Modifiers (toggle chips) ── */}
              <div>
                {/* Contextual actions for this block type */}
                {contextActions.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] font-semibold text-c-accent uppercase tracking-wider mb-1">
                      {t('reportBuilder.blockCard.forBlockType', {
                        defaultValue: `For ${block.type.replace(/_/g, ' ')}`,
                        type: block.type.replace(/_/g, ' '),
                      })}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {contextActions.map((action) => {
                        const isSelected = selectedActions.has(action.id);
                        return (
                          <button
                            key={action.id}
                            onClick={() => {
                              setSelectedActions((prev) => {
                                const next = new Set(prev);
                                if (next.has(action.id)) next.delete(action.id);
                                else next.add(action.id);
                                return next;
                              });
                            }}
                            className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all border ${
                              isSelected
                                ? 'bg-c-surface text-c-text border-c-border-subtle shadow-sm'
                                : 'bg-c-surface text-c-text border-c-border-subtle hover:bg-c-surface-raised'
                            }`}
                          >
                            {isSelected ? <Check className="w-3 h-3" /> : action.icon}
                            {isPl ? action.labelPl : action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Universal modifiers */}
                <div>
                  {contextActions.length > 0 && (
                    <div className="text-[9px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1">
                      {t('reportBuilder.blockCard.modifiers', 'Modifiers')}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {UNIVERSAL_ACTIONS.map((action) => {
                      const isSelected = selectedActions.has(action.id);
                      return (
                        <button
                          key={action.id}
                          onClick={() => {
                            setSelectedActions((prev) => {
                              const next = new Set(prev);
                              if (next.has(action.id)) next.delete(action.id);
                              else next.add(action.id);
                              return next;
                            });
                          }}
                          disabled={!block.content && !block.isGenerated}
                          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all border ${
                            isSelected
                              ? 'bg-c-surface-raised text-c-text border-c-border-subtle shadow-sm'
                              : 'bg-c-surface text-c-text-secondary border-c-border-subtle hover:bg-c-surface-raised'
                          } ${!block.content && !block.isGenerated ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          {isSelected ? <Check className="w-3 h-3" /> : action.icon}
                          {isPl ? action.labelPl : action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Section 4: Source/Context (collapsible) ── */}
              <details className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer select-none py-1 text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider hover:text-c-text transition-colors">
                  <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                  <FileText className="w-3 h-3 text-emerald-500" />
                  {t('reportBuilder.blockCard.sourceContext', 'Source / Context')}
                  {block.sourceContext && (
                    <span className="text-[8px] text-emerald-500 ml-1 normal-case">●</span>
                  )}
                </summary>
                <div className="mt-1.5">
                  <textarea
                    value={block.sourceContext || ''}
                    onChange={(e) => onUpdate({ sourceContext: e.target.value })}
                    placeholder={t(
                      'reportBuilder.blockCard.pasteSourceDataContextBusinessRequirements',
                      'Paste source data, context, business requirements...'
                    )}
                    className="w-full px-3 py-2 text-[11px] bg-c-surface-raised border border-c-border-subtle rounded-lg resize-none h-14 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 leading-relaxed placeholder:text-c-text-muted"
                  />
                </div>
              </details>

              {/* ── Section 5: Action Bar ── */}
              <div className="pt-2 border-t border-c-border-subtle">
                {/* Summary of pending changes */}
                {(selectedActions.size > 0 || additionalPrompt.trim()) && (
                  <div className="mb-2 p-2 bg-blue-50/80 dark:bg-blue-900/15 border border-blue-200/50 dark:border-blue-800/30 rounded-lg">
                    <div className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      {t('reportBuilder.blockCard.pendingChanges', 'Pending changes:')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedActions).map((id) => {
                        const action = [...contextActions, ...UNIVERSAL_ACTIONS].find(
                          (a) => a.id === id
                        );
                        if (!action) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                          >
                            {isPl ? action.labelPl : action.label}
                            <button
                              onClick={() =>
                                setSelectedActions((prev) => {
                                  const next = new Set(prev);
                                  next.delete(id);
                                  return next;
                                })
                              }
                              className="ml-0.5 hover:text-danger-500"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                      {additionalPrompt.trim() && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          + {t('reportBuilder.blockCard.instructions', 'instructions')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {/* Primary: Regenerate with all instructions */}
                  {onGenerateBlock && !block.id.startsWith('tmp_') && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Build combined instruction from selected actions + additional prompt
                        const allActions = [...contextActions, ...UNIVERSAL_ACTIONS];
                        const actionInstructions = Array.from(selectedActions)
                          .map((id) => allActions.find((a) => a.id === id))
                          .filter(Boolean)
                          .map((a) => (isPl ? a!.instructionPl : a!.instruction));
                        let combinedExtra = [...actionInstructions, additionalPrompt.trim()]
                          .filter(Boolean)
                          .join('\n');
                        if (previousBlockSummary)
                          combinedExtra += `\n\nContext: Previous section: ${previousBlockSummary}`;
                        if (nextBlockSummary)
                          combinedExtra += `\nNext section: ${nextBlockSummary}`;

                        if (combinedExtra && onRegenerate && block.content) {
                          // Has modifiers → use onRegenerate with combined instructions
                          setIsProcessing(true);
                          if (block.content) setPreviousContent(block.content);
                          try {
                            await onRegenerate(combinedExtra);
                            setSelectedActions(new Set());
                            setAdditionalPrompt('');
                            setShowDiff(true);
                            setMode('preview');
                          } catch (err) {
                            console.error('Regenerate failed:', err);
                          } finally {
                            setIsProcessing(false);
                          }
                        } else {
                          // No modifiers → standard generate/regenerate
                          if (block.content) setPreviousContent(block.content);
                          try {
                            await onGenerateBlock();
                            setSelectedActions(new Set());
                            setAdditionalPrompt('');
                            setMode('preview');
                            if (block.content) setShowDiff(true);
                          } catch (err) {
                            console.error('Generate failed:', err);
                          }
                        }
                      }}
                      disabled={block.isGenerating || isProcessing}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-semibold rounded-lg transition-all ${
                        selectedActions.size > 0 || additionalPrompt.trim()
                          ? 'bg-c-info text-c-bg hover:opacity-90 shadow-md ring-2 ring-c-focus'
                          : !block.isGenerated
                            ? 'bg-c-info text-c-bg hover:opacity-90 shadow-sm'
                            : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle'
                      } disabled:opacity-40`}
                    >
                      {block.isGenerating || isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : block.isGenerated ? (
                        <RefreshCw className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {block.isGenerating || isProcessing
                        ? t('reportBuilder.blockCard.generating', 'Generating...')
                        : selectedActions.size > 0 || additionalPrompt.trim()
                          ? t('reportBuilder.blockCard.regenerateWithCount', {
                              defaultValue: `Regenerate (${selectedActions.size + (additionalPrompt.trim() ? 1 : 0)})`,
                              count: selectedActions.size + (additionalPrompt.trim() ? 1 : 0),
                            })
                          : block.isGenerated
                            ? t('reportBuilder.blockCard.regenerate', 'Regenerate')
                            : t('reportBuilder.blockCard.generate', 'Generate')}
                    </button>
                  )}

                  {/* Clear selections */}
                  {(selectedActions.size > 0 || additionalPrompt.trim()) && (
                    <button
                      onClick={() => {
                        setSelectedActions(new Set());
                        setAdditionalPrompt('');
                      }}
                      className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised rounded-lg transition-colors"
                      title={t('reportBuilder.blockCard.clear', 'Clear')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- PREVIEW TAB --- */}
          {mode === 'preview' && (
            <div>
              {/* Inline editing */}
              {isEditing ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Pencil className="w-2.5 h-2.5" />
                        {t('reportBuilder.blockCard.editing', 'Editing')}
                      </span>
                      <span className="text-[9px] text-blue-500">
                        {
                          editContent
                            .replace(/[#*_\-|>]+/g, '')
                            .split(/\s+/)
                            .filter(Boolean).length
                        }{' '}
                        {t('reportBuilder.blockCard.words', 'words')}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30"
                        title="Undo"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded disabled:opacity-30"
                        title="Redo"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <div className="w-px h-3 bg-blue-200 dark:bg-blue-700 mx-0.5" />
                      <button
                        onClick={() => setIsEditing(false)}
                        className="p-1 text-c-text-secondary hover:bg-c-border-subtle rounded"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editHasChanges}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded ml-0.5 ${
                          editHasChanges
                            ? 'bg-blue-600 text-c-text hover:bg-blue-700'
                            : 'bg-c-border-subtle text-c-text-secondary cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5" />{' '}
                        {t('reportBuilder.blockCard.save', 'Save')}
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => pushEdit(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="w-full px-4 py-3 text-sm font-mono bg-c-surface focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[120px] leading-relaxed border-none outline-none"
                    style={{ maxHeight: '500px' }}
                  />
                  <div className="flex items-center gap-3 px-3 py-1 bg-c-surface-raised border-t border-c-border-subtle">
                    <span className="text-[9px] text-c-text-secondary">
                      <kbd className="px-0.5 bg-c-border-subtle rounded text-[8px]">⌘S</kbd>{' '}
                      {t('reportBuilder.blockCard.save2', 'save')}
                    </span>
                    <span className="text-[9px] text-c-text-secondary">
                      <kbd className="px-0.5 bg-c-border-subtle rounded text-[8px]">⌘Z</kbd>{' '}
                      {t('reportBuilder.blockCard.undo', 'undo')}
                    </span>
                    <span className="text-[9px] text-c-text-secondary">
                      <kbd className="px-0.5 bg-c-border-subtle rounded text-[8px]">Esc</kbd>{' '}
                      {t('reportBuilder.blockCard.close', 'close')}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (hasContent) setIsEditing(true);
                  }}
                >
                  {block.content ? (
                    block.type === 'cover' || block.type === 'cover_page' ? (
                      <CoverPreview content={block.content} />
                    ) : (
                      <>
                        {/* Diff banner */}
                        {showDiff && previousContent && previousContent !== block.content && (
                          <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {t(
                                  'reportBuilder.blockCard.contentUpdatedByAi',
                                  'Content updated by AI'
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate({ content: previousContent });
                                    onSaveContent?.(previousContent);
                                    setPreviousContent(null);
                                    setShowDiff(false);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded font-medium"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  {t('reportBuilder.blockCard.revert', 'Revert')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviousContent(null);
                                    setShowDiff(false);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded font-medium"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  {t('reportBuilder.blockCard.accept', 'Accept')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Content with show more/less */}
                        <div className="relative">
                          <div
                            ref={contentRef}
                            className="transition-all duration-300 overflow-hidden"
                            style={{
                              maxHeight: contentExpanded ? 'none' : `${PREVIEW_MAX_HEIGHT}px`,
                            }}
                          >
                            <SmartBlockRenderer
                              content={block.content}
                              blockType={block.type}
                              renderKind={block.renderKind}
                              blockSettings={block.blockSettings}
                            />
                          </div>

                          {/* Gradient fade + show more/less button */}
                          {contentOverflows && (
                            <div className={`${contentExpanded ? '' : 'relative'}`}>
                              {!contentExpanded && (
                                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-c-surface to-transparent pointer-events-none" />
                              )}
                              <div
                                className={`flex justify-center ${contentExpanded ? 'pt-2' : 'relative z-10 -mt-2'}`}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setContentExpanded(!contentExpanded);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full border border-blue-200 dark:border-blue-800 transition-all shadow-sm"
                                >
                                  {contentExpanded ? (
                                    <>
                                      <ChevronsUp className="w-3 h-3" />
                                      {t('reportBuilder.blockCard.showLess', 'Show less')}
                                    </>
                                  ) : (
                                    <>
                                      <ChevronsDown className="w-3 h-3" />
                                      {t('reportBuilder.blockCard.showMore', 'Show more')}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  ) : (
                    <div className="flex items-center justify-center py-10 text-c-text-secondary">
                      <div className="text-center space-y-3">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-c-accent-soft flex items-center justify-center">
                          <Sparkles className="w-7 h-7 text-blue-500 opacity-70" />
                        </div>
                        <p className="text-sm text-c-text-secondary">
                          {t(
                            'reportBuilder.blockCard.contentWillBeGeneratedByAi',
                            'Content will be generated by AI'
                          )}
                        </p>
                        <div className="flex items-center gap-2 justify-center">
                          {onGenerateBlock && !block.id.startsWith('tmp_') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateBlock();
                              }}
                              disabled={block.isGenerating}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-c-info text-c-bg rounded-lg hover:opacity-90 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {block.isGenerating ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
                                  {t('reportBuilder.blockCard.generating', 'Generating...')}
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />{' '}
                                  {t('reportBuilder.blockCard.generate', 'Generate')}
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMode('ai');
                            }}
                            className="flex items-center gap-1 px-3 py-2 text-xs text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft rounded-lg transition-colors"
                          >
                            <Settings className="w-3 h-3" />{' '}
                            {t('reportBuilder.blockCard.aiSettings', 'AI Settings')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick actions bar inside preview */}
                  {hasContent &&
                    !isEditing &&
                    (() => {
                      const wordCount = (block.content || '')
                        .replace(/[#*_\-|>]+/g, '')
                        .split(/\s+/)
                        .filter(Boolean).length;
                      const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
                      const isAiGenerated = block.isGenerated;
                      return (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-c-border-subtle">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] text-c-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors font-medium"
                            >
                              <Pencil className="w-3 h-3" />{' '}
                              {t('reportBuilder.blockCard.edit', 'Edit')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(block.content || '');
                                toast.success(t('reportBuilder.blockCard.copied', 'Copied'));
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded transition-colors font-medium"
                            >
                              <ClipboardCopy className="w-3 h-3" />{' '}
                              {t('reportBuilder.blockCard.copy', 'Copy')}
                            </button>
                            {onGenerateBlock && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateBlock();
                                }}
                                disabled={block.isGenerating}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors font-medium ${
                                  block.needsRegeneration
                                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                    : 'text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft'
                                }`}
                              >
                                <RefreshCw className="w-3 h-3" />{' '}
                                {t('reportBuilder.blockCard.regenerate', 'Regenerate')}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* AI/Manual badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium ${
                                isAiGenerated
                                  ? 'bg-c-accent-soft text-c-accent'
                                  : 'bg-c-surface-raised text-c-text-secondary'
                              }`}
                            >
                              {isAiGenerated ? (
                                <>
                                  <Sparkles className="w-2.5 h-2.5" />
                                  {t('reportBuilder.blockCard.ai', 'AI')}
                                </>
                              ) : (
                                <>
                                  <Pencil className="w-2.5 h-2.5" />
                                  {t('reportBuilder.blockCard.manual', 'Manual')}
                                </>
                              )}
                            </span>
                            {/* Reading time + word count */}
                            <span className="text-[9px] text-c-text-secondary">
                              {wordCount} {t('reportBuilder.blockCard.words', 'words')} · ~
                              {readingMinutes} min
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              )}
            </div>
          )}

          {/* --- COMMENTS TAB --- */}
          {mode === 'comments' && (
            <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* Comment type selector */}
              <div>
                <label className="block text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MessageSquarePlus className="w-3 h-3 text-amber-500" />
                  {t('reportBuilder.blockCard.newComment', 'New comment')}
                </label>
                {/* Quick type buttons */}
                <div className="flex gap-1 mb-2">
                  {[
                    {
                      type: 'FEEDBACK' as CommentType,
                      label: t('reportBuilder.blockCard.feedback', 'Feedback'),
                      color: 'orange',
                    },
                    {
                      type: 'SUGGESTION' as CommentType,
                      label: t('reportBuilder.blockCard.suggestion', 'Suggestion'),
                      color: 'blue',
                    },
                    {
                      type: 'CHANGE_REQUEST' as CommentType,
                      label: t('reportBuilder.blockCard.change', 'Change'),
                      color: 'purple',
                    },
                    {
                      type: 'QUESTION' as CommentType,
                      label: t('reportBuilder.blockCard.question', 'Question'),
                      color: 'emerald',
                    },
                  ].map((ct) => (
                    <button
                      key={ct.type}
                      onClick={() => setCommentType(ct.type)}
                      className={`px-2 py-0.5 text-[9px] font-medium rounded-full transition-all ${
                        commentType === ct.type
                          ? `bg-${ct.color}-500 text-c-text`
                          : `bg-c-surface-raised text-c-text-secondary hover:bg-c-border-subtle`
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
                {/* Quick templates */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    'reportBuilder.blockCard.quickTemplateTooLongShorten',
                    'reportBuilder.blockCard.quickTemplateAddMoreData',
                    'reportBuilder.blockCard.quickTemplateChangeToneFormal',
                    'reportBuilder.blockCard.quickTemplateNeedsEvidence',
                    'reportBuilder.blockCard.quickTemplateMissingConclusions',
                  ].map((tmplKey, i) => (
                    <button
                      key={i}
                      onClick={() => setNewComment(t(tmplKey))}
                      className="px-2 py-0.5 text-[9px] text-c-text-secondary bg-c-surface-raised hover:bg-c-border-subtle rounded-full transition-colors"
                    >
                      {t(tmplKey)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                    }}
                    placeholder={t(
                      'reportBuilder.blockCard.describeWhatShouldBeChanged',
                      'Describe what should be changed...'
                    )}
                    className="flex-1 px-3 py-2 text-[11px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg resize-none h-14 focus:ring-1 focus:ring-amber-500 leading-relaxed"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="self-end p-2 bg-amber-500 text-c-text rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[9px] text-c-text-secondary mt-1">
                  {t(
                    'reportBuilder.blockCard.enterToAddResolvingSuggestionsChanges',
                    '⌘+Enter to add. Resolving suggestions/changes will instruct AI to update content.'
                  )}
                </p>
              </div>

              {/* Comments list */}
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-c-text-secondary" />
                </div>
              ) : blockComments.length === 0 ? (
                <div className="text-center py-6 text-c-text-secondary">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-[11px]">
                    {t('reportBuilder.blockCard.noCommentsYet', 'No comments yet')}
                  </p>
                  <p className="text-[9px] mt-0.5">
                    {t(
                      'reportBuilder.blockCard.addACommentToSuggestChanges',
                      'Add a comment to suggest changes'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header with count + batch actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-c-text-secondary uppercase tracking-wider">
                      {t('reportBuilder.blockCard.comments', 'Comments')} ({blockComments.length})
                      {blockComments.filter((c) => c.status === 'OPEN').length > 0 && (
                        <span className="ml-1.5 text-[9px] font-normal text-amber-500">
                          {blockComments.filter((c) => c.status === 'OPEN').length}{' '}
                          {t('reportBuilder.blockCard.open', 'open')}
                        </span>
                      )}
                    </div>
                    {blockComments.filter((c) => c.status === 'OPEN').length > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleBulkResolve}
                          className="text-[9px] px-1.5 py-0.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded font-medium transition-colors"
                        >
                          {t('reportBuilder.blockCard.resolveAll', 'Resolve all')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comment cards */}
                  {blockComments.map((comment) => {
                    const isOpen = comment.status === 'OPEN';
                    const isResolved = comment.status === 'RESOLVED';
                    const isDismissed =
                      comment.status === 'DISMISSED' || comment.status === 'WONT_FIX';
                    const typeColors: Record<string, string> = {
                      FEEDBACK:
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      SUGGESTION:
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      CHANGE_REQUEST: 'bg-c-accent-soft text-c-accent',
                      QUESTION:
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                    };
                    return (
                      <div
                        key={comment.id}
                        className={`p-2.5 rounded-lg border transition-all ${
                          isResolved
                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                            : isDismissed
                              ? 'bg-c-surface-raised border-c-border-subtle opacity-50'
                              : 'bg-c-surface border-c-border-subtle'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <div className="w-4 h-4 rounded-full bg-c-border flex items-center justify-center text-[8px] font-bold text-c-text flex-shrink-0">
                                {(comment.userName || 'U')[0].toUpperCase()}
                              </div>
                              <span className="text-[10px] font-semibold text-c-text">
                                {comment.userName || t('reportBuilder.blockCard.user', 'User')}
                              </span>
                              <span
                                className={`text-[8px] px-1 py-0.5 rounded font-medium ${typeColors[comment.commentType] || typeColors.FEEDBACK}`}
                              >
                                {comment.commentType === 'CHANGE_REQUEST'
                                  ? t('reportBuilder.blockCard.change', 'Change')
                                  : comment.commentType}
                              </span>
                              <span className="text-[8px] text-c-text-secondary">
                                {new Date(comment.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {!isOpen && (
                                <span
                                  className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                                    isResolved
                                      ? 'bg-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                                      : 'bg-c-border-subtle text-c-text-secondary'
                                  }`}
                                >
                                  {isResolved
                                    ? t('reportBuilder.blockCard.resolved', 'Resolved')
                                    : t('reportBuilder.blockCard.dismissed', 'Dismissed')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-c-text-secondary leading-relaxed">
                              {comment.content}
                            </p>
                          </div>

                          {/* Action buttons for open comments */}
                          {isOpen && (
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => handleResolveComment(comment.id)}
                                title={
                                  comment.commentType === 'SUGGESTION' ||
                                  comment.commentType === 'CHANGE_REQUEST'
                                    ? t(
                                        'reportBuilder.blockCard.resolveAiWillUpdate',
                                        'Resolve — AI will update content'
                                      )
                                    : t('reportBuilder.blockCard.resolveAction', 'Resolve')
                                }
                                className="p-1 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDismissComment(comment.id)}
                                title={t('reportBuilder.blockCard.dismiss', 'Dismiss')}
                                className="p-1 text-c-text-secondary hover:bg-c-surface-raised rounded transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick actions bar removed - integrated into each tab */}

      {/* ===== ADD BELOW BUTTON ===== */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddBelow();
          }}
          className="w-6 h-6 bg-blue-600 text-c-text rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BlockCard;
