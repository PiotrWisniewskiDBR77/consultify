/**
 * InsightViewer — N-mode canonical 2-pane layout
 *
 * Matches TaskDetailView / DecisionDetailView pattern:
 *   NModeHeader → NModePropertiesStrip → ActionBar → NModeLeftNav + NModeCanvas
 */

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  CheckSquare,
  Clock,
  Copy,
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
  Paperclip,
  Plus,
  Quote,
  RefreshCw,
  Send,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import type { Attachment } from '@/components/MyWork/shared/AttachmentsSection';
import type { LinkedItem } from '@/components/MyWork/shared/LinkedItemsSection';
import { NModeCanvas } from '@/components/shared/NModeLayout/NModeCanvas';
import { NModeHeader } from '@/components/shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '@/components/shared/NModeLayout/NModeLeftNav';
import { NModePropertiesStrip } from '@/components/shared/NModeLayout/NModePropertiesStrip';
import type { NModePropertyField, NModeSection } from '@/components/shared/NModeLayout/types';
import {
  ActivityLogCanvas,
  type ActivityLogEntry as NModeActivityLogEntry,
  type ActivityStats,
  type ActivityTypeMeta,
} from '@/components/shared/NModeSections';
import { AttachmentsLinksCanvas } from '@/components/shared/NModeSections';
import {
  type CommentItem,
  type CommentPriority,
  CommentsCanvas,
  type DateFilter,
  type SortOrder,
} from '@/components/shared/NModeSections';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode } from '@/utils/artifactLinks';

// ── Types ────────────────────────────────────────────────────────────────────

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

interface LocalActivityLogEntry {
  id: string;
  type: 'created' | 'regenerated' | 'exported' | 'comment' | 'edit';
  description: string;
  timestamp: string;
  userName?: string;
}

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

interface InsightViewerProps {
  insightId: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onSaved?: (data: any) => void;
}

// ── Type metadata ────────────────────────────────────────────────────────────

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
    icon: <Star size={16} />,
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
    icon: <Sparkles size={16} />,
    color: 'emerald',
    label: 'Opportunity Scan',
    labelPl: 'Skan Szans',
  },
  maturity: {
    icon: <BarChart3 size={16} />,
    color: 'indigo',
    label: 'Maturity Assessment',
    labelPl: 'Ocena Dojrzałości',
  },
  stakeholder_map: {
    icon: <MessageSquare size={16} />,
    color: 'violet',
    label: 'Stakeholder Mapping',
    labelPl: 'Mapa Interesariuszy',
  },
};

const STATUS_CONFIG: Record<
  InsightStatus,
  { label: { en: string; pl: string }; color: string; textColor: string }
> = {
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
  failed: { label: { en: 'Failed', pl: 'Błąd' }, color: 'bg-red-500', textColor: 'text-red-500' },
};

// ── N-mode section definitions (without component — assigned later) ──────────

const INSIGHT_SECTIONS: Omit<NModeSection, 'component'>[] = [
  { id: 'executive-summary', icon: Star, label: { en: 'Executive Summary', pl: 'Podsumowanie' } },
  { id: 'full-analysis', icon: FileText, label: { en: 'Full Analysis', pl: 'Pełna Analiza' } },
  { id: 'key-findings', icon: Target, label: { en: 'Key Findings', pl: 'Kluczowe Ustalenia' } },
  { id: 'quotes-evidence', icon: Quote, label: { en: 'Quotes & Evidence', pl: 'Cytaty i Dowody' } },
  { id: 'patterns', icon: Hash, label: { en: 'Patterns & Themes', pl: 'Wzorce i Tematy' } },
  { id: 'contradictions', icon: Shuffle, label: { en: 'Contradictions', pl: 'Sprzeczności' } },
  {
    id: 'action-items',
    icon: CheckSquare,
    label: { en: 'Action Items', pl: 'Zalecane Działania' },
  },
  { id: 'risk-flags', icon: Flag, label: { en: 'Risk Flags', pl: 'Flagi Ryzyka' } },
  {
    id: 'source-sessions',
    icon: MessageSquare,
    label: { en: 'Source Sessions', pl: 'Sesje Źródłowe' },
  },
  {
    id: 'attachments-links',
    icon: Paperclip,
    label: { en: 'Attachments & Links', pl: 'Załączniki' },
  },
  { id: 'comments', icon: MessageSquare, label: { en: 'Comments', pl: 'Komentarze' } },
  { id: 'activity-log', icon: History, label: { en: 'Activity Log', pl: 'Aktywność' } },
];

// ── Component ────────────────────────────────────────────────────────────────

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

  // N-mode navigation
  const [activeNSection, setActiveNSection] = useState(INSIGHT_SECTIONS[0].id);
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'insight',
  });

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
  const [isGeneratingFindings, setIsGeneratingFindings] = useState(false);

  // Export states
  const [isExportingTools, setIsExportingTools] = useState(false);
  const [isExportingAssessment, setIsExportingAssessment] = useState(false);

  // Related data
  const [sourceSessions, setSourceSessions] = useState<SourceSession[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [activityLog, setActivityLog] = useState<LocalActivityLogEntry[]>([]);

  // Extended report data
  const [keyFindings, setKeyFindings] = useState<KeyFinding[]>([]);
  const [quotes, setQuotes] = useState<QuoteEvidence[]>([]);
  const [patterns, setPatterns] = useState<PatternTheme[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);

  // Quote filter
  const [quoteFilter, setQuoteFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>(
    'all'
  );

  // NMode shared section state — Comments
  const [nComments, setNComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDateFilter, setCommentDateFilter] = useState<DateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<SortOrder>('desc');
  const [draftPriority, setDraftPriority] = useState<CommentPriority>('normal');

  // NMode shared section state — Attachments
  const [nAttachments, setNAttachments] = useState<Attachment[]>([]);
  const [nLinkedItems, setNLinkedItems] = useState<LinkedItem[]>([]);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadInsight = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.get(`/interview/insights/${insightId}`);
        setInsight(data);
        setTitle(data.title || '');

        if (data.content) {
          const firstParagraph = data.content.split('\n\n')[0] || '';
          setExecutiveSummary(
            firstParagraph.length > 200 ? firstParagraph.substring(0, 200) + '...' : firstParagraph
          );
        }

        setActivityLog([
          {
            id: '1',
            type: 'created',
            description: isPolish ? 'Wniosek utworzony' : 'Insight created',
            timestamp: data.createdAt,
            userName: 'System',
          },
        ]);

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
            // sessions are optional
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load insight');
        console.error('[InsightViewer] Failed to load insight:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsight();

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

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addActivityLogEntry = useCallback(
    (type: LocalActivityLogEntry['type'], description: string) => {
      const entry: LocalActivityLogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        description,
        timestamp: new Date().toISOString(),
        userName: 'Current User',
      };
      setActivityLog((prev) => [entry, ...prev]);
    },
    []
  );

  const typeMeta = insight
    ? TYPE_METADATA[insight.promptType] || TYPE_METADATA.summary
    : TYPE_METADATA.summary;
  const statusConfig = insight
    ? STATUS_CONFIG[insight.status] || STATUS_CONFIG.completed
    : STATUS_CONFIG.completed;

  const isDirty = title !== (insight?.title || '');

  const filteredQuotes = useMemo(() => {
    if (quoteFilter === 'all') return quotes;
    return quotes.filter((q) => q.sentiment === quoteFilter);
  }, [quotes, quoteFilter]);

  const riskCounts = useMemo(
    () => ({
      high: riskFlags.filter((r) => r.severity === 'high').length,
      medium: riskFlags.filter((r) => r.severity === 'medium').length,
      low: riskFlags.filter((r) => r.severity === 'low').length,
    }),
    [riskFlags]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

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
    if (isChatCollapsed) toggleChatCollapse();
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
      if (toolId) navigate(`${ROUTES.DISCOVERY_TOOLS.STRATEGIC}?tool=${toolId}`);
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
      if (assessmentId) navigate(`${ROUTES.ASSESSMENT.ROOT}/${assessmentType}/${assessmentId}`);
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
    } finally {
      setIsExportingAssessment(false);
    }
  };

  const handleGenerateFindings = async () => {
    setIsGeneratingFindings(true);
    try {
      toast(
        isPolish
          ? 'Generowanie ustaleń będzie dostępne po integracji z API'
          : 'Findings generation will be available after API integration',
        { icon: 'ℹ️' }
      );
    } finally {
      setIsGeneratingFindings(false);
    }
  };

  const toggleActionItem = (id: string) => {
    setActionItems(
      actionItems.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  // Comments handlers (NMode)
  const handleSubmitComment = useCallback(() => {
    if (!commentDraft.trim()) return;
    const newComment: CommentItem = {
      id: Math.random().toString(36).substr(2, 9),
      content: commentDraft.trim(),
      authorName: 'Current User',
      createdAt: new Date().toISOString(),
      priority: draftPriority,
    };
    setNComments((prev) => [...prev, newComment]);
    setCommentDraft('');
    setDraftPriority('normal');
    addActivityLogEntry('comment', isPolish ? 'Dodano komentarz' : 'Comment added');
  }, [commentDraft, draftPriority, isPolish, addActivityLogEntry]);

  const handleDeleteComment = useCallback((id: string) => {
    setNComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const getPriorityDotClass = useCallback((p: CommentPriority) => {
    if (p === 'high') return 'bg-red-500';
    if (p === 'low') return 'bg-slate-400';
    return 'bg-blue-500';
  }, []);

  const getCommentPriority = useCallback(
    (comment: CommentItem): CommentPriority =>
      ((comment as CommentItem & { priority?: CommentPriority }).priority ||
        'normal') as CommentPriority,
    []
  );

  const getPriorityButtonClass = useCallback((p: CommentPriority, active: boolean) => {
    if (active && p === 'high') {
      return 'border-amber-500/55 text-amber-600 dark:text-amber-300 dark:border-amber-500/35 bg-amber-500/10';
    }
    if (active && p === 'normal') {
      return 'border-blue-500/55 text-blue-600 dark:text-blue-300 dark:border-blue-500/35 bg-blue-500/10';
    }
    if (active && p === 'low') {
      return 'border-slate-400/55 text-slate-600 dark:text-slate-300 dark:border-navy-500/35 bg-slate-500/10';
    }
    return 'border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:border-slate-400/70 hover:text-slate-700 dark:text-slate-300';
  }, []);

  const getCommentPriorityLabel = useCallback(
    (p: CommentPriority) =>
      p === 'high'
        ? isPolish
          ? 'Wysoki'
          : 'High'
        : p === 'low'
          ? isPolish
            ? 'Niski'
            : 'Low'
          : isPolish
            ? 'Normalny'
            : 'Normal',
    [isPolish]
  );

  const getCommentPriorityHint = useCallback(
    (p: CommentPriority) =>
      p === 'high'
        ? isPolish
          ? 'Wymaga szybkiej reakcji / eskalacji'
          : 'Requires quick response / escalation'
        : p === 'low'
          ? isPolish
            ? 'Informacyjne / do rozważenia później'
            : 'Informational / can wait'
          : isPolish
            ? 'Standardowy priorytet'
            : 'Standard priority',
    [isPolish]
  );

  // Attachments handlers (NMode)
  const handleUploadAttachments = useCallback(
    async (files: FileList) => {
      const newAttachments: Attachment[] = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Current User',
      }));
      setNAttachments((prev) => [...prev, ...newAttachments]);
      toast.success(isPolish ? 'Załączniki dodane' : 'Attachments added');
      addActivityLogEntry('edit', isPolish ? 'Dodano załączniki' : 'Attachments added');
    },
    [isPolish, addActivityLogEntry]
  );

  const handleDeleteAttachment = useCallback(
    async (id: string) => {
      setNAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment deleted');
    },
    [isPolish]
  );

  const handleAddLinkedItem = useCallback(async (item: LinkedItem) => {
    setNLinkedItems((prev) => [...prev, item]);
  }, []);

  const handleRemoveLinkedItem = useCallback(async (item: Pick<LinkedItem, 'id' | 'type'>) => {
    setNLinkedItems((prev) => prev.filter((i) => i.id !== item.id));
  }, []);

  const searchLinkedItems = useCallback(async (_query: string): Promise<LinkedItem[]> => {
    return [];
  }, []);

  // ── Properties strip fields ────────────────────────────────────────────────

  const propertyFields = useMemo<NModePropertyField[]>(
    () => [
      {
        id: 'status',
        label: { en: 'Status', pl: 'Status' },
        type: 'select' as const,
        value: insight?.status || 'generating',
        onChange: () => {},
        readOnly: true,
        options: [
          { value: 'generating', label: { en: 'Generating', pl: 'Generowanie' } },
          { value: 'completed', label: { en: 'Completed', pl: 'Ukończone' } },
          { value: 'failed', label: { en: 'Failed', pl: 'Błąd' } },
        ],
      },
      {
        id: 'type',
        label: { en: 'Analysis Type', pl: 'Typ analizy' },
        type: 'text' as const,
        value: isPolish ? typeMeta.labelPl : typeMeta.label,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'created',
        label: { en: 'Created', pl: 'Utworzono' },
        type: 'date' as const,
        value: insight?.createdAt?.split('T')[0] || '',
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'genTime',
        label: { en: 'Gen Time', pl: 'Czas gen.' },
        type: 'text' as const,
        value: insight?.generationTimeMs ? `${(insight.generationTimeMs / 1000).toFixed(1)}s` : '-',
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'sessions',
        label: { en: 'Sessions', pl: 'Sesje' },
        type: 'text' as const,
        value: String(insight?.sourceSessionCount || 0),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'tags',
        label: { en: 'Tags', pl: 'Tagi' },
        type: 'custom' as const,
        value: '',
        onChange: () => {},
        render: () => (
          <div className="flex flex-wrap items-center gap-1">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 text-[10px] font-medium"
              >
                #{tag}
                <button
                  onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                  className="p-0.5 rounded-full hover:bg-pink-500/20"
                >
                  <X size={8} />
                </button>
              </span>
            ))}
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
              placeholder="+"
              className="w-12 h-5 px-1 rounded text-[10px] bg-transparent text-slate-600 dark:text-slate-400 placeholder-slate-400 focus:outline-none"
            />
          </div>
        ),
      },
    ],
    [insight, isPolish, typeMeta, tags, newTag]
  );

  // ── Activity log → NMode format ───────────────────────────────────────────

  const nModeActivityEntries = useMemo<NModeActivityLogEntry[]>(
    () =>
      activityLog.map((e) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        timestamp: e.timestamp,
        userName: e.userName,
      })),
    [activityLog]
  );

  const activityStats = useMemo<ActivityStats>(
    () => ({
      total: activityLog.length,
      edited: activityLog.filter((e) => e.type === 'edit').length,
      escalations: 0,
      collaboration: activityLog.filter((e) => e.type === 'comment').length,
    }),
    [activityLog]
  );

  const activityTypeMeta = useCallback(
    (type: string): ActivityTypeMeta => {
      switch (type) {
        case 'created':
          return {
            icon: <Plus size={12} />,
            label: isPolish ? 'Utworzono' : 'Created',
            style: 'bg-emerald-500 text-white',
          };
        case 'regenerated':
          return {
            icon: <RefreshCw size={12} />,
            label: isPolish ? 'Regeneracja' : 'Regenerated',
            style: 'bg-amber-500 text-white',
          };
        case 'exported':
          return {
            icon: <Send size={12} />,
            label: isPolish ? 'Eksport' : 'Exported',
            style: 'bg-blue-500 text-white',
          };
        case 'comment':
          return {
            icon: <MessageSquare size={12} />,
            label: isPolish ? 'Komentarz' : 'Comment',
            style: 'bg-purple-500 text-white',
          };
        case 'edit':
          return {
            icon: <Sparkles size={12} />,
            label: isPolish ? 'Edycja' : 'Edit',
            style: 'bg-slate-500 text-white',
          };
        default:
          return { icon: <Clock size={12} />, label: type, style: 'bg-slate-400 text-white' };
      }
    },
    [isPolish]
  );

  // ── Section content assignment ─────────────────────────────────────────────

  const nModeSectionsWithContent = useMemo<NModeSection[]>(() => {
    return INSIGHT_SECTIONS.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        case 'executive-summary':
          component = (
            <div className="space-y-4">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
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
          );
          break;

        case 'full-analysis':
          component = (
            <div>
              {insight?.status === 'generating' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Sparkles size={48} className="text-amber-400 animate-pulse mb-6" />
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
                  <p className="text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak treści' : 'No content'}
                  </p>
                </div>
              )}
            </div>
          );
          break;

        case 'key-findings':
          component = (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {keyFindings.length} {isPolish ? 'ustaleń' : 'findings'}
                </span>
                <button
                  onClick={handleGenerateFindings}
                  disabled={isGeneratingFindings}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-all disabled:opacity-50"
                >
                  {isGeneratingFindings ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  <span>{isPolish ? 'Generuj AI' : 'Generate AI'}</span>
                </button>
              </div>
              {keyFindings.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {isPolish
                    ? 'Brak kluczowych ustaleń. Wygeneruj je za pomocą AI.'
                    : 'No key findings yet. Generate them using AI.'}
                </p>
              )}
              {keyFindings.map((finding, index) => (
                <div
                  key={finding.id}
                  className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{finding.content}</p>
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
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {finding.category}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {finding.sourceCount} {isPolish ? 'źródeł' : 'sources'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
          break;

        case 'quotes-evidence':
          component = (
            <div className="space-y-3">
              <div className="flex items-center gap-1 mb-2">
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
                <span className="text-xs text-slate-400 ml-auto">{filteredQuotes.length}</span>
              </div>
              {filteredQuotes.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {isPolish ? 'Brak cytatów z wywiadów.' : 'No interview quotes available.'}
                </p>
              )}
              {filteredQuotes.map((quote) => (
                <div
                  key={quote.id}
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
                </div>
              ))}
            </div>
          );
          break;

        case 'patterns':
          component = (
            <div>
              {patterns.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-4 rounded-xl bg-slate-50 dark:bg-navy-800">
                  {patterns
                    .flatMap((p) => p.relatedKeywords)
                    .map((keyword, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                </div>
              )}
              <div className="space-y-2">
                {patterns.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                    {isPolish ? 'Brak zidentyfikowanych wzorców.' : 'No patterns identified yet.'}
                  </p>
                )}
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
          );
          break;

        case 'contradictions':
          component = (
            <div className="space-y-4">
              {contradictions.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {isPolish
                    ? 'Brak zidentyfikowanych sprzeczności.'
                    : 'No contradictions identified yet.'}
                </p>
              )}
              {contradictions.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {c.topic}
                    </h4>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        c.severity === 'high'
                          ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                          : c.severity === 'medium'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {c.severity}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-blue-500/10 dark:bg-blue-500/20">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                        {c.sourceA}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{c.viewA}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/10 dark:bg-purple-500/20">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
                        {c.sourceB}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{c.viewB}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
          break;

        case 'action-items':
          component = (
            <div>
              {actionItems.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {isPolish ? 'Brak zdefiniowanych działań.' : 'No action items defined yet.'}
                </p>
              )}
              {(['quick_win', 'short_term', 'long_term'] as const).map((actionType) => {
                const items = actionItems.filter((a) => a.type === actionType);
                if (items.length === 0) return null;
                const colorMap = { quick_win: 'emerald', short_term: 'blue', long_term: 'purple' };
                const labelMap = {
                  quick_win: isPolish ? 'Quick Wins' : 'Quick Wins',
                  short_term: isPolish ? 'Krótkoterminowe' : 'Short Term',
                  long_term: isPolish ? 'Długoterminowe' : 'Long Term',
                };
                const color = colorMap[actionType];
                return (
                  <div key={actionType} className="mb-4">
                    <h4
                      className={`text-xs font-semibold text-${color}-600 dark:text-${color}-400 uppercase tracking-wider mb-2`}
                    >
                      {labelMap[actionType]}
                    </h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-3 rounded-xl bg-${color}-500/5 dark:bg-${color}-500/10 border border-${color}-500/20`}
                        >
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              item.completed
                                ? `bg-${color}-500 border-${color}-500 text-white`
                                : `border-${color}-500/50 hover:border-${color}-500`
                            }`}
                          >
                            {item.completed && <CheckCircle size={12} />}
                          </button>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}
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
                );
              })}
            </div>
          );
          break;

        case 'risk-flags':
          component = (
            <div className="space-y-3">
              {riskFlags.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  {riskCounts.high > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                      <AlertCircle size={10} /> {riskCounts.high} high
                    </span>
                  )}
                  {riskCounts.medium > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={10} /> {riskCounts.medium} medium
                    </span>
                  )}
                  {riskCounts.low > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-600 dark:text-slate-400">
                      {riskCounts.low} low
                    </span>
                  )}
                </div>
              )}
              {riskFlags.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  {isPolish ? 'Brak zidentyfikowanych ryzyk.' : 'No risk flags identified yet.'}
                </p>
              )}
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
                      <span className="font-medium">{isPolish ? 'Mitygacja:' : 'Mitigation:'}</span>{' '}
                      {risk.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
          break;

        case 'source-sessions':
          component = (
            <div className="space-y-2">
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
                    <button className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 transition-colors">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
          break;

        case 'attachments-links':
          component = (
            <AttachmentsLinksCanvas
              attachments={nAttachments}
              onUploadAttachments={handleUploadAttachments}
              onDeleteAttachment={handleDeleteAttachment}
              linkedItems={nLinkedItems}
              onAddLinkedItem={handleAddLinkedItem}
              onRemoveLinkedItem={handleRemoveLinkedItem}
              searchLinkedItems={searchLinkedItems}
            />
          );
          break;

        case 'comments':
          component = (
            <CommentsCanvas
              comments={nComments}
              onDeleteComment={handleDeleteComment}
              dateFilter={commentDateFilter}
              onDateFilterChange={setCommentDateFilter}
              sortOrder={commentSortOrder}
              onToggleSort={() => setCommentSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              commentDraft={commentDraft}
              onCommentDraftChange={setCommentDraft}
              onSubmitComment={handleSubmitComment}
              draftPriority={draftPriority}
              onDraftPriorityChange={setDraftPriority}
              getPriorityDotClass={getPriorityDotClass}
              getCommentPriority={getCommentPriority}
              getPriorityButtonClass={getPriorityButtonClass}
              getCommentPriorityLabel={getCommentPriorityLabel}
              getCommentPriorityHint={getCommentPriorityHint}
            />
          );
          break;

        case 'activity-log':
          component = (
            <ActivityLogCanvas
              entries={nModeActivityEntries}
              stats={activityStats}
              typeMeta={activityTypeMeta}
            />
          );
          break;
      }

      return {
        ...section,
        component,
        badge:
          section.id === 'comments'
            ? nComments.length
            : section.id === 'key-findings'
              ? keyFindings.length
              : section.id === 'risk-flags'
                ? riskFlags.length
                : section.id === 'source-sessions'
                  ? sourceSessions.length
                  : section.id === 'activity-log'
                    ? activityLog.length
                    : undefined,
      } as NModeSection;
    });
  }, [
    executiveSummary,
    insight,
    isPolish,
    keyFindings,
    riskCounts,
    filteredQuotes,
    quoteFilter,
    quotes,
    patterns,
    contradictions,
    actionItems,
    riskFlags,
    sourceSessions,
    nAttachments,
    nLinkedItems,
    nComments,
    commentDraft,
    commentDateFilter,
    commentSortOrder,
    draftPriority,
    nModeActivityEntries,
    activityStats,
    activityTypeMeta,
    isGeneratingFindings,
    handleSubmitComment,
    handleDeleteComment,
    getPriorityDotClass,
    handleUploadAttachments,
    handleDeleteAttachment,
    handleAddLinkedItem,
    handleRemoveLinkedItem,
    searchLinkedItems,
    activityLog,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-navy-950 gap-4">
        <AlertCircle size={48} className="text-red-400" />
        <p className="text-red-500">{error}</p>
        <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 underline">
          {isPolish ? 'Wróć' : 'Go back'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-0">
          {/* ── Header ─────────────────────────────────────── */}
          <NModeHeader
            title={title}
            onTitleChange={setTitle}
            titlePlaceholder={{ en: 'Insight title...', pl: 'Tytuł wniosku...' }}
            artifactId={insight?.id}
            artifactType="insight"
            onSave={handleSave}
            saving={saving}
            isDirty={isDirty}
            onChat={handleOpenChat}
            onClose={onClose}
            statusDotColor={statusConfig.color}
            presentationMode={presentationMode}
            onPresentationModeChange={setPresentationMode}
            buildArtifactCode={buildArtifactCode}
          />

          <div className="col-span-full space-y-4 mt-4">
            {/* ── Properties strip ────────────────────────── */}
            <NModePropertiesStrip fields={propertyFields} />

            {/* ── Action bar ──────────────────────────────── */}
            <div className="px-4 py-3 rounded-2xl bg-slate-50/90 dark:bg-navy-900/50 backdrop-blur-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                  {isPolish ? 'Regeneruj' : 'Regenerate'}
                </button>

                <button
                  onClick={handleExportToTools}
                  disabled={isExportingTools || insight?.status !== 'completed'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-all disabled:opacity-50"
                >
                  {isExportingTools ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Target size={14} />
                  )}
                  {isPolish ? 'Do Tools' : 'Export Tools'}
                </button>

                <button
                  onClick={handleExportToAssessment}
                  disabled={isExportingAssessment || insight?.status !== 'completed'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-medium transition-all disabled:opacity-50"
                >
                  {isExportingAssessment ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <BarChart3 size={14} />
                  )}
                  {isPolish ? 'Do Assessment' : 'Export Assessment'}
                </button>

                <button
                  onClick={handleExportMarkdown}
                  disabled={insight?.status !== 'completed'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-xs font-medium transition-all disabled:opacity-50"
                >
                  <Download size={14} />
                  {isPolish ? 'Markdown' : 'Download MD'}
                </button>

                <button
                  onClick={handleCopy}
                  disabled={insight?.status !== 'completed'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-xs font-medium transition-all disabled:opacity-50"
                >
                  <Copy size={14} />
                  {isPolish ? 'Kopiuj' : 'Copy'}
                </button>
              </div>
            </div>

            {/* ── 2-pane layout ───────────────────────────── */}
            <div className="flex gap-0 min-h-[60vh]">
              <NModeLeftNav
                sections={nModeSectionsWithContent}
                activeSection={activeNSection}
                onSectionChange={setActiveNSection}
              />
              <NModeCanvas sections={nModeSectionsWithContent} activeSection={activeNSection} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightViewer;
