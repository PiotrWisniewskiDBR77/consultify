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
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Flame,
  History,
  Layers,
  Lightbulb,
  Loader2,
  Map,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import type { InlineTableColumn } from '@/components/shared/NModeBlocks';
import { Callout, EmptyStateInline, InlineTable } from '@/components/shared/NModeBlocks';
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

import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';

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

interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
}

interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
}

interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
}

interface InsightSignal {
  title: string;
  description: string;
  type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
}

interface InsightEvidenceMapEntry {
  answer_id: string;
  question_text: string;
  answer_snippet: string;
  linked_themes: string[];
  linked_issues: string[];
}

interface Insight {
  id: string;
  organizationId: string;
  title: string;
  promptType: InsightPromptType;
  sourceSessionIds: string[];
  filters?: Record<string, any>;
  content?: string;
  executiveSummary?: string;
  themes?: InsightTheme[];
  issues?: InsightIssue[];
  opportunities?: InsightOpportunity[];
  signals?: InsightSignal[];
  evidenceMap?: InsightEvidenceMapEntry[];
  missingData?: string[];
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

interface SourceSessionSummary {
  facts: string[];
  gaps: string[];
  constraints: string[];
  painPoints: string[];
}

interface ParsedInsightSection {
  heading: string;
  body: string;
  bullets: string[];
  paragraphs: string[];
}

const DEFAULT_SESSION_SUMMARY: SourceSessionSummary = {
  facts: [],
  gaps: [],
  constraints: [],
  painPoints: [],
};

function uniqueNonEmpty(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const normalized = String(item || '')
      .replace(/^[-*]\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function extractQuotedLines(content?: string): string[] {
  if (!content) return [];
  const blockQuotes = Array.from(content.matchAll(/(^>\s?.+$)/gm)).map((match) =>
    String(match[1] || '')
      .replace(/^>\s?/, '')
      .trim()
  );
  const inlineQuotes = Array.from(content.matchAll(/"([^"\n]{16,220})"/g)).map((match) =>
    String(match[1] || '').trim()
  );
  return uniqueNonEmpty([...blockQuotes, ...inlineQuotes]);
}

function parseInsightContent(content?: string): ParsedInsightSection[] {
  if (!content) return [];

  const chunks = content
    .split(/^#{1,6}\s+/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const [headingLine, ...rest] = chunk.split('\n');
    const body = rest.join('\n').trim();
    const paragraphs = body
      .split(/\n{2,}/)
      .map((part) => part.replace(/^[-*]\s+/gm, '').trim())
      .filter(Boolean);
    const bullets = Array.from(body.matchAll(/^(?:[-*]|\d+\.)\s+(.+)$/gm)).map((match) =>
      String(match[1] || '').trim()
    );

    return {
      heading: String(headingLine || '').trim(),
      body,
      bullets: uniqueNonEmpty(bullets),
      paragraphs: uniqueNonEmpty(paragraphs),
    };
  });
}

interface InsightViewerProps {
  insightId: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onSaved?: (data: Insight) => void;
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
  {
    id: 'consulting-readout',
    icon: Sparkles,
    label: { en: 'Consulting Readout', pl: 'Odczyt konsultingowy' },
  },
  { id: 'themes', icon: Layers, label: { en: 'Themes', pl: 'Tematy' } },
  {
    id: 'issues-risks',
    icon: ShieldAlert,
    label: { en: 'Issues & Risks', pl: 'Problemy i ryzyka' },
  },
  { id: 'opportunities', icon: TrendingUp, label: { en: 'Opportunities', pl: 'Szanse' } },
  { id: 'signals', icon: Radio, label: { en: 'Signals', pl: 'Sygnały' } },
  { id: 'evidence-map', icon: Map, label: { en: 'Evidence Map', pl: 'Mapa dowodów' } },
  { id: 'traceability', icon: Target, label: { en: 'Traceability', pl: 'Traceability' } },
  { id: 'full-analysis', icon: FileText, label: { en: 'Full Analysis', pl: 'Pełna Analiza' } },
  {
    id: 'source-sessions',
    icon: MessageSquare,
    label: { en: 'Source Sessions', pl: 'Sesje Źródłowe' },
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
  const { isChatCollapsed, toggleChatCollapse, currentUser, currentOrganization } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const interviewDemoData = useMemo(
    () =>
      createInterviewDemoDataset({
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.displayName || (currentUser as any)?.name,
        currentUserEmail: currentUser?.email,
        organizationId: currentOrganization?.id,
        organizationName: currentOrganization?.name,
      }),
    [
      currentOrganization?.id,
      currentOrganization?.name,
      currentUser?.displayName,
      currentUser?.email,
      currentUser?.id,
      (currentUser as any)?.name,
    ]
  );

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

  // AI generation states
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Export states
  const [isExportingTools, setIsExportingTools] = useState(false);
  const [isExportingAssessment, setIsExportingAssessment] = useState(false);

  // Related data
  const [sourceSessions, setSourceSessions] = useState<SourceSession[]>([]);
  const [sourceSessionSummaries, setSourceSessionSummaries] = useState<
    Record<string, SourceSessionSummary>
  >({});
  const [activityEntries, setActivityEntries] = useState<NModeActivityLogEntry[]>([]);

  // NMode shared section state — Comments
  const [nComments, setNComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDateFilter, setCommentDateFilter] = useState<DateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<SortOrder>('desc');
  const [draftPriority, setDraftPriority] = useState<CommentPriority>('normal');

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadInsight = async () => {
      const applyDemoInsight = (id: string) => {
        const demoInsight = interviewDemoData.insightDetailsById[id];
        if (!demoInsight) return false;

        setInsight(demoInsight as Insight);
        setTitle(demoInsight.title || '');
        const demoSessions = demoInsight.sourceSessionIds
          .map((sessionId: string) => interviewDemoData.sessionDetailsById[sessionId]?.session)
          .filter(Boolean);
        setSourceSessions(demoSessions as SourceSession[]);
        setSourceSessionSummaries(
          demoInsight.sourceSessionIds.reduce<Record<string, SourceSessionSummary>>(
            (acc, sessionId) => {
              acc[sessionId] =
                (interviewDemoData.sessionDetailsById[sessionId]
                  ?.summary as SourceSessionSummary) || DEFAULT_SESSION_SUMMARY;
              return acc;
            },
            {}
          )
        );
        setActivityEntries(
          (interviewDemoData.insightActivityById[id] || []) as NModeActivityLogEntry[]
        );
        setNComments((interviewDemoData.insightCommentsById[id] || []) as CommentItem[]);
        return true;
      };

      setIsLoading(true);
      setError(null);
      try {
        if (isInterviewDemoId(insightId) && applyDemoInsight(insightId)) return;

        const data = await Api.get(`/interview/insights/${insightId}`).catch(() => null);
        if (!data) {
          if (applyDemoInsight(insightId)) return;
          throw new Error('Failed to load insight');
        }
        setInsight(data);
        setTitle(data.title || '');

        if (data.sourceSessionIds?.length > 0) {
          try {
            const sessionsData = await Promise.all(
              data.sourceSessionIds
                .slice(0, 10)
                .map((id: string) => Api.get(`/interview/sessions/${id}`).catch(() => null))
            );
            const validSessions = (sessionsData || []).filter(Boolean);
            setSourceSessions(validSessions);

            const summaryEntries = await Promise.all(
              validSessions.map(async (session: SourceSession) => {
                const summary = await Api.get(`/interview/sessions/${session.id}/summary`).catch(
                  () => null
                );
                return [session.id, summary] as const;
              })
            );

            setSourceSessionSummaries(
              summaryEntries.reduce<Record<string, SourceSessionSummary>>(
                (acc, [sessionId, summary]) => {
                  acc[sessionId] = summary
                    ? {
                        facts: Array.isArray(summary.facts) ? summary.facts : [],
                        gaps: Array.isArray(summary.gaps) ? summary.gaps : [],
                        constraints: Array.isArray(summary.constraints) ? summary.constraints : [],
                        painPoints: Array.isArray(summary.painPoints) ? summary.painPoints : [],
                      }
                    : DEFAULT_SESSION_SUMMARY;
                  return acc;
                },
                {}
              )
            );
          } catch {
            // sessions are optional
          }
        } else {
          setSourceSessions([]);
          setSourceSessionSummaries({});
        }

        const [activityRes, commentsRes] = await Promise.all([
          Api.get(`/interview/insights/${insightId}/activity`).catch(() => []),
          Api.get(`/interview/insights/${insightId}/comments`).catch(() => []),
        ]);
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        setNComments(Array.isArray(commentsRes) ? commentsRes : []);
      } catch (err: any) {
        if (applyDemoInsight(insightId)) return;
        setError(err?.message || 'Failed to load insight');
        console.error('[InsightViewer] Failed to load insight:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsight();

    let lastStatus: InsightStatus | null = null;
    const interval = setInterval(async () => {
      try {
        if (isInterviewDemoId(insightId)) {
          clearInterval(interval);
          return;
        }
        const data = await Api.get(`/interview/insights/${insightId}`);
        setInsight(data);
        const nextStatus = data?.status as InsightStatus | undefined;
        if (lastStatus === null) lastStatus = nextStatus ?? null;

        if (lastStatus === 'generating' && nextStatus && nextStatus !== 'generating') {
          clearInterval(interval);
          const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
            () => []
          );
          setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        }

        lastStatus = nextStatus ?? null;
      } catch (err) {
        // keep polling best-effort
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [insightId, interviewDemoData, isPolish]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const typeMeta = insight
    ? TYPE_METADATA[insight.promptType] || TYPE_METADATA.summary
    : TYPE_METADATA.summary;
  const statusConfig = insight
    ? STATUS_CONFIG[insight.status] || STATUS_CONFIG.completed
    : STATUS_CONFIG.completed;

  const parsedInsightSections = useMemo(
    () => parseInsightContent(insight?.content),
    [insight?.content]
  );

  const executiveSummary = useMemo(() => {
    if (!insight?.content) return '';
    const firstParagraph = insight.content
      .split('\n\n')
      .map((part) => part.replace(/^#+\s+/, '').trim())
      .find(Boolean);
    return firstParagraph || '';
  }, [insight?.content]);

  const officialAnswers = useMemo(
    () =>
      uniqueNonEmpty(
        sourceSessions.flatMap((session) => sourceSessionSummaries[session.id]?.facts || [])
      ).slice(0, 10),
    [sourceSessionSummaries, sourceSessions]
  );

  const issuesReadout = useMemo(() => {
    const fromSummaries = sourceSessions.flatMap((session) => {
      const summary = sourceSessionSummaries[session.id] || DEFAULT_SESSION_SUMMARY;
      return [...summary.constraints, ...summary.painPoints, ...summary.gaps];
    });
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(issue|problem|risk|gap|constraint|challenge|pain|blocker|critical)/i.test(section.heading)
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty([...fromSummaries, ...fromNarrative]).slice(0, 10);
  }, [parsedInsightSections, sourceSessionSummaries, sourceSessions]);

  const opportunityReadout = useMemo(() => {
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(opportunit|strength|theme|trend|alignment|growth|efficiency|innovation|maturity)/i.test(
          section.heading
        )
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty(fromNarrative).slice(0, 10);
  }, [parsedInsightSections]);

  const hiddenSignals = useMemo(() => {
    const fromNarrative = parsedInsightSections
      .filter((section) =>
        /(observation|between|pattern|divergent|root cause|implication|underlying|signal)/i.test(
          section.heading
        )
      )
      .flatMap((section) => [...section.bullets, ...section.paragraphs]);

    return uniqueNonEmpty(fromNarrative).slice(0, 8);
  }, [parsedInsightSections]);

  const evidenceQuotes = useMemo(
    () => extractQuotedLines(insight?.content).slice(0, 6),
    [insight?.content]
  );

  const traceabilityRows = useMemo(
    () =>
      sourceSessions.map((session) => ({
        session,
        summary: sourceSessionSummaries[session.id] || DEFAULT_SESSION_SUMMARY,
      })),
    [sourceSessionSummaries, sourceSessions]
  );

  // V6 three-layer structured data
  const v6Themes = useMemo<InsightTheme[]>(() => insight?.themes ?? [], [insight?.themes]);
  const v6Issues = useMemo<InsightIssue[]>(() => insight?.issues ?? [], [insight?.issues]);
  const v6Opportunities = useMemo<InsightOpportunity[]>(
    () => insight?.opportunities ?? [],
    [insight?.opportunities]
  );
  const v6Signals = useMemo<InsightSignal[]>(() => insight?.signals ?? [], [insight?.signals]);
  const v6EvidenceMap = useMemo<InsightEvidenceMapEntry[]>(
    () => insight?.evidenceMap ?? [],
    [insight?.evidenceMap]
  );
  const v6MissingData = useMemo<string[]>(() => insight?.missingData ?? [], [insight?.missingData]);

  // Evidence drilldown state
  const [expandedEvidenceRef, setExpandedEvidenceRef] = useState<string | null>(null);

  const toggleEvidenceRef = useCallback((ref: string) => {
    setExpandedEvidenceRef((prev) => (prev === ref ? null : ref));
  }, []);

  const findEvidenceForRef = useCallback(
    (ref: string): InsightEvidenceMapEntry | undefined =>
      v6EvidenceMap.find((entry) => entry.answer_id === ref || entry.question_text === ref),
    [v6EvidenceMap]
  );

  const isDirty = title !== (insight?.title || '');

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!insight) return;
    setSaving(true);
    try {
      await Api.patch(`/interview/insights/${insight.id}`, { title });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
      const refreshed = await Api.get(`/interview/insights/${insightId}`).catch(() => null);
      if (refreshed) {
        setInsight(refreshed);
        onSaved?.(refreshed);
      } else {
        onSaved?.({ ...insight, title });
      }
      const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
        () => []
      );
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
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

  const openSourceSessionInInterviewHub = useCallback(
    (session: SourceSession) => {
      try {
        const raw = window.sessionStorage.getItem('moduleHub.openDocuments.interview');
        const parsed = raw ? JSON.parse(raw) : {};
        const openDocuments = Array.isArray(parsed?.openDocuments) ? parsed.openDocuments : [];
        const activeDocumentId =
          typeof parsed?.activeDocumentId === 'string' ? parsed.activeDocumentId : null;

        const exists = openDocuments.some((d: any) => d?.id === session.id);
        const inferredStatus = session.completedAt ? ('completed' as const) : ('active' as const);
        const nextDocuments = exists
          ? openDocuments
          : [
              ...openDocuments,
              {
                id: session.id,
                type: 'session',
                name: session.name || 'Session',
                status: inferredStatus,
                data: { id: session.id, name: session.name || 'Session', status: inferredStatus },
              },
            ];

        window.sessionStorage.setItem(
          'moduleHub.openDocuments.interview',
          JSON.stringify({
            openDocuments: nextDocuments,
            activeDocumentId: session.id || activeDocumentId,
          })
        );
      } catch {
        // ignore
      }
      navigate(ROUTES.INTERVIEW);
    },
    [navigate]
  );

  const handleRegenerate = async () => {
    if (!insight) return;
    setIsRegenerating(true);
    try {
      await Api.post(`/interview/insights/${insight.id}/regenerate`, {});
      toast.success(isPolish ? 'Regenerowanie rozpoczęte...' : 'Regeneration started...');
      const data = await Api.get(`/interview/insights/${insightId}`);
      setInsight(data);
      const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
        () => []
      );
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
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
  };

  const handleExportToTools = async () => {
    if (!insight) return;
    setIsExportingTools(true);
    try {
      const exportRes = await Api.post(`/interview/insights/${insight.id}/export`, {
        target: 'tools',
      });
      toast.success(isPolish ? 'Wyeksportowano do Tools' : 'Exported to Tools');
      const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
        () => []
      );
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
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
      const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
        () => []
      );
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      const assessmentId = exportRes?.targetId;
      const assessmentType = String(exportRes?.assessmentType || 'DRD').toLowerCase();
      if (assessmentId) navigate(`${ROUTES.ASSESSMENT.ROOT}/${assessmentType}/${assessmentId}`);
    } catch {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
    } finally {
      setIsExportingAssessment(false);
    }
  };

  const handleGenerateFindings = useCallback(() => {
    toast(
      isPolish
        ? 'Ta sekcja jest jeszcze niedostępna dla Insight (brak kontraktu backend).'
        : 'This section is not available for Insight yet (no backend contract).'
    );
  }, [isPolish]);

  // Comments handlers (NMode)
  const handleSubmitComment = useCallback(() => {
    void (async () => {
      const text = commentDraft.trim();
      if (!text) return;

      try {
        if (isInterviewDemoId(insightId)) {
          const created = {
            id: `demo-comment-${Date.now()}`,
            authorName: currentUser?.displayName || (currentUser as any)?.name || 'You',
            content: text,
            createdAt: new Date().toISOString(),
            priority: draftPriority,
          } as CommentItem;
          setNComments((prev) => [...prev, created]);
          setActivityEntries((prev) => [
            {
              id: `demo-activity-${Date.now()}`,
              type: 'comment',
              description: 'Comment added in demo mode.',
              timestamp: new Date().toISOString(),
              userName: created.authorName,
            },
            ...prev,
          ]);
          setCommentDraft('');
          setDraftPriority('normal');
          return;
        }

        const created = await Api.post(`/interview/insights/${insightId}/comments`, {
          content: text,
          priority: draftPriority,
        });
        setNComments((prev) => [...prev, created]);
        setCommentDraft('');
        setDraftPriority('normal');

        const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
          () => []
        );
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
      } catch {
        toast.error(isPolish ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
      }
    })();
  }, [
    commentDraft,
    currentUser?.displayName,
    currentUser?.id,
    draftPriority,
    insightId,
    isPolish,
    (currentUser as any)?.name,
  ]);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      void (async () => {
        try {
          if (isInterviewDemoId(insightId)) {
            setNComments((prev) => prev.filter((c) => c.id !== commentId));
            setActivityEntries((prev) => [
              {
                id: `demo-activity-delete-${Date.now()}`,
                type: 'comment',
                description: 'Comment removed in demo mode.',
                timestamp: new Date().toISOString(),
                userName: currentUser?.displayName || (currentUser as any)?.name || 'You',
              },
              ...prev,
            ]);
            return;
          }

          await Api.delete(`/interview/insights/${insightId}/comments/${commentId}`);
          setNComments((prev) => prev.filter((c) => c.id !== commentId));
          const activityRes = await Api.get(`/interview/insights/${insightId}/activity`).catch(
            () => []
          );
          setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        } catch {
          toast.error(isPolish ? 'Nie udało się usunąć komentarza' : 'Failed to delete comment');
        }
      })();
    },
    [currentUser?.displayName, currentUser?.id, insightId, isPolish, (currentUser as any)?.name]
  );

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

  const filteredComments = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      commentDateFilter === 'today'
        ? 24 * 60 * 60 * 1000
        : commentDateFilter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : commentDateFilter === '30d'
            ? 30 * 24 * 60 * 60 * 1000
            : null;

    const withinRange = (c: CommentItem) => {
      if (!cutoffMs) return true;
      const ts = new Date(c.createdAt).getTime();
      if (!Number.isFinite(ts)) return true;
      return now - ts <= cutoffMs;
    };

    const filtered = nComments.filter(withinRange);
    const sorted = [...filtered].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return commentSortOrder === 'asc' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [nComments, commentDateFilter, commentSortOrder]);

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
    ],
    [insight, isPolish, typeMeta]
  );

  // ── Activity log → NMode format ───────────────────────────────────────────

  const nModeActivityEntries = useMemo<NModeActivityLogEntry[]>(
    () => activityEntries,
    [activityEntries]
  );

  const activityStats = useMemo<ActivityStats>(
    () => ({
      total: activityEntries.length,
      edited: activityEntries.filter((e) => e.type === 'edit').length,
      escalations: 0,
      collaboration: activityEntries.filter((e) => e.type === 'comment').length,
    }),
    [activityEntries]
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
              <Callout
                variant="purple"
                title={
                  isPolish ? 'Czytaj jak brief konsultingowy' : 'Read this as a consulting brief'
                }
              >
                {executiveSummary || (isPolish ? 'Brak podsumowania.' : 'No summary available.')}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Official answers' : 'Official answers'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {officialAnswers.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Issues / Risks' : 'Issues / risks'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {issuesReadout.length}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Signals / Opportunities' : 'Signals / opportunities'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {hiddenSignals.length + opportunityReadout.length}
                  </div>
                </div>
              </div>

              {evidenceQuotes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {evidenceQuotes.slice(0, 2).map((quote) => (
                    <div
                      key={quote}
                      className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3 text-sm italic text-slate-600 dark:text-slate-300"
                    >
                      "{quote}"
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;

        case 'consulting-readout':
          component = (
            <div className="space-y-5">
              <Callout
                variant="info"
                title={isPolish ? 'Zakres interpretacji' : 'Interpretation scope'}
              >
                {isPolish
                  ? 'To jest warstwa konsultingowa: issues, opportunities i sygnały ukryte w odpowiedziach. Bez automatycznych action planów.'
                  : 'This is the consulting layer: issues, opportunities, and hidden signals from the answers. No automatic action plans.'}
              </Callout>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Official Answers' : 'Official Answers'}
                  </div>
                  {officialAnswers.length > 0 ? (
                    officialAnswers.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={FileText}
                      message={
                        isPolish ? 'Brak zebranych faktów źródłowych' : 'No source facts available'
                      }
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Issues / Risks' : 'Issues / Risks'}
                  </div>
                  {issuesReadout.length > 0 ? (
                    issuesReadout.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-red-500/[0.04] dark:bg-red-500/10 px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={AlertTriangle}
                      message={
                        isPolish
                          ? 'Brak wyraźnych issue do pokazania'
                          : 'No clear issues to surface'
                      }
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Signals / Opportunities' : 'Signals / Opportunities'}
                  </div>
                  {uniqueNonEmpty([...hiddenSignals, ...opportunityReadout]).length > 0 ? (
                    uniqueNonEmpty([...hiddenSignals, ...opportunityReadout]).map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-emerald-500/[0.04] dark:bg-emerald-500/10 px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        {item}
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Sparkles}
                      message={
                        isPolish
                          ? 'Brak sygnałów i opportunities do pokazania'
                          : 'No signals or opportunities yet'
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          );
          break;

        case 'themes':
          component = (
            <div className="space-y-4">
              {v6MissingData.length > 0 && (
                <Callout
                  variant="warning"
                  title={isPolish ? 'Brakujące dane' : 'Missing Data'}
                  compact
                >
                  <ul className="list-disc list-inside space-y-0.5">
                    {v6MissingData.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              {v6Themes.length === 0 ? (
                <EmptyStateInline
                  icon={Layers}
                  message={isPolish ? 'Brak zidentyfikowanych tematów' : 'No themes identified yet'}
                  hint={
                    isPolish
                      ? 'Tematy pojawią się po wygenerowaniu analizy V6.'
                      : 'Themes will appear after V6 analysis generation.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Themes.map((theme, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-50/90 dark:bg-navy-900/50 px-4 py-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {theme.title}
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            theme.strength === 'strong'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : theme.strength === 'moderate'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-500/15 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {theme.strength === 'strong'
                            ? isPolish
                              ? 'Silny'
                              : 'Strong'
                            : theme.strength === 'moderate'
                              ? isPolish
                                ? 'Umiarkowany'
                                : 'Moderate'
                              : isPolish
                                ? 'Słaby'
                                : 'Weak'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {theme.description}
                      </p>
                      {theme.evidence_refs?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {theme.evidence_refs.map((ref) => {
                            const evidence = findEvidenceForRef(ref);
                            const isExpanded = expandedEvidenceRef === ref;
                            return (
                              <div key={ref} className="inline-flex flex-col">
                                <button
                                  onClick={() => toggleEvidenceRef(ref)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 transition-colors"
                                >
                                  <Zap size={10} />
                                  {evidence?.question_text
                                    ? evidence.question_text.slice(0, 40) +
                                      (evidence.question_text.length > 40 ? '…' : '')
                                    : ref.slice(0, 20)}
                                  {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                                {isExpanded && evidence && (
                                  <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200/50 dark:border-navy-700/50 text-xs space-y-1.5 max-w-sm">
                                    <div className="font-medium text-slate-700 dark:text-slate-200">
                                      {evidence.question_text}
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400 italic">
                                      "{evidence.answer_snippet}"
                                    </div>
                                    {evidence.linked_themes?.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-0.5">
                                        {evidence.linked_themes.map((t) => (
                                          <span
                                            key={t}
                                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-700 text-[10px] text-slate-500 dark:text-slate-400"
                                          >
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;

        case 'issues-risks':
          component = (
            <div className="space-y-4">
              {v6Issues.length === 0 ? (
                <EmptyStateInline
                  icon={ShieldAlert}
                  message={
                    isPolish ? 'Brak zidentyfikowanych problemów' : 'No issues identified yet'
                  }
                  hint={
                    isPolish
                      ? 'Problemy pojawią się po analizie V6.'
                      : 'Issues will appear after V6 analysis.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Issues.map((issue, idx) => {
                    const severityStyles =
                      issue.severity === 'high'
                        ? 'border-l-red-500 bg-red-500/[0.04] dark:bg-red-500/10'
                        : issue.severity === 'medium'
                          ? 'border-l-amber-500 bg-amber-500/[0.04] dark:bg-amber-500/10'
                          : 'border-l-slate-400 bg-slate-50 dark:bg-navy-900/50';
                    const severityBadge =
                      issue.severity === 'high'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : issue.severity === 'medium'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border-l-4 ${severityStyles} px-4 py-4 space-y-2`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {issue.title}
                          </div>
                          <span
                            className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${severityBadge}`}
                          >
                            {issue.severity === 'high'
                              ? isPolish
                                ? 'Wysoki'
                                : 'High'
                              : issue.severity === 'medium'
                                ? isPolish
                                  ? 'Średni'
                                  : 'Medium'
                                : isPolish
                                  ? 'Niski'
                                  : 'Low'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {issue.description}
                        </p>
                        {issue.evidence_refs?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {issue.evidence_refs.map((ref) => {
                              const evidence = findEvidenceForRef(ref);
                              const isExpanded = expandedEvidenceRef === ref;
                              return (
                                <div key={ref} className="inline-flex flex-col">
                                  <button
                                    onClick={() => toggleEvidenceRef(ref)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 transition-colors"
                                  >
                                    <Zap size={10} />
                                    {evidence?.question_text
                                      ? evidence.question_text.slice(0, 40) +
                                        (evidence.question_text.length > 40 ? '…' : '')
                                      : ref.slice(0, 20)}
                                    {isExpanded ? (
                                      <ChevronUp size={10} />
                                    ) : (
                                      <ChevronDown size={10} />
                                    )}
                                  </button>
                                  {isExpanded && evidence && (
                                    <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200/50 dark:border-navy-700/50 text-xs space-y-1.5 max-w-sm">
                                      <div className="font-medium text-slate-700 dark:text-slate-200">
                                        {evidence.question_text}
                                      </div>
                                      <div className="text-slate-500 dark:text-slate-400 italic">
                                        "{evidence.answer_snippet}"
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'opportunities':
          component = (
            <div className="space-y-4">
              {v6Opportunities.length === 0 ? (
                <EmptyStateInline
                  icon={TrendingUp}
                  message={
                    isPolish ? 'Brak zidentyfikowanych szans' : 'No opportunities identified yet'
                  }
                  hint={
                    isPolish
                      ? 'Szanse pojawią się po analizie V6.'
                      : 'Opportunities will appear after V6 analysis.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Opportunities.map((opp, idx) => {
                    const impactBadge =
                      opp.impact === 'high'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : opp.impact === 'medium'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06] px-4 py-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {opp.title}
                          </div>
                          <span
                            className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${impactBadge}`}
                          >
                            {opp.impact === 'high'
                              ? isPolish
                                ? 'Wysoki wpływ'
                                : 'High impact'
                              : opp.impact === 'medium'
                                ? isPolish
                                  ? 'Średni wpływ'
                                  : 'Medium impact'
                                : isPolish
                                  ? 'Niski wpływ'
                                  : 'Low impact'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {opp.description}
                        </p>
                        {opp.evidence_refs?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {opp.evidence_refs.map((ref) => {
                              const evidence = findEvidenceForRef(ref);
                              const isExpanded = expandedEvidenceRef === ref;
                              return (
                                <div key={ref} className="inline-flex flex-col">
                                  <button
                                    onClick={() => toggleEvidenceRef(ref)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium hover:bg-purple-500/20 transition-colors"
                                  >
                                    <Zap size={10} />
                                    {evidence?.question_text
                                      ? evidence.question_text.slice(0, 40) +
                                        (evidence.question_text.length > 40 ? '…' : '')
                                      : ref.slice(0, 20)}
                                    {isExpanded ? (
                                      <ChevronUp size={10} />
                                    ) : (
                                      <ChevronDown size={10} />
                                    )}
                                  </button>
                                  {isExpanded && evidence && (
                                    <div className="mt-1.5 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200/50 dark:border-navy-700/50 text-xs space-y-1.5 max-w-sm">
                                      <div className="font-medium text-slate-700 dark:text-slate-200">
                                        {evidence.question_text}
                                      </div>
                                      <div className="text-slate-500 dark:text-slate-400 italic">
                                        "{evidence.answer_snippet}"
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'signals':
          component = (
            <div className="space-y-4">
              {v6Signals.length === 0 ? (
                <EmptyStateInline
                  icon={Radio}
                  message={isPolish ? 'Brak wykrytych sygnałów' : 'No signals detected yet'}
                  hint={
                    isPolish
                      ? 'Sygnały pojawią się po analizie V6.'
                      : 'Signals will appear after V6 analysis.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {v6Signals.map((signal, idx) => {
                    const typeConfig: Record<
                      string,
                      { bg: string; label: string; labelPl: string; icon: React.ReactNode }
                    > = {
                      tension: {
                        bg: 'bg-red-500/10 text-red-600 dark:text-red-400',
                        label: 'Tension',
                        labelPl: 'Napięcie',
                        icon: <Flame size={10} />,
                      },
                      gap: {
                        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        label: 'Gap',
                        labelPl: 'Luka',
                        icon: <Target size={10} />,
                      },
                      contradiction: {
                        bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                        icon: <AlertCircle size={10} />,
                      },
                      emerging_pattern: {
                        bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
                        label: 'Emerging Pattern',
                        labelPl: 'Wzorzec',
                        icon: <Sparkles size={10} />,
                      },
                    };
                    const cfg = typeConfig[signal.type] || typeConfig.emerging_pattern;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-slate-50/90 dark:bg-navy-900/50 px-4 py-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {signal.title}
                          </div>
                          <span
                            className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.bg}`}
                          >
                            {cfg.icon}
                            {isPolish ? cfg.labelPl : cfg.label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {signal.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
          break;

        case 'evidence-map':
          component = (
            <div className="space-y-4">
              <Callout variant="purple" title={isPolish ? 'Mapa dowodów' : 'Evidence Map'} compact>
                {isPolish
                  ? 'Tabela łączy odpowiedzi źródłowe z tematami i problemami. Kliknij wiersz, aby zobaczyć pełny cytat.'
                  : 'This table links source answers to themes and issues. Click a row to see the full quote.'}
              </Callout>
              {v6EvidenceMap.length === 0 ? (
                <EmptyStateInline
                  icon={Map}
                  message={isPolish ? 'Brak mapy dowodów' : 'No evidence map available'}
                  hint={
                    isPolish
                      ? 'Mapa pojawi się po analizie V6.'
                      : 'Map will appear after V6 analysis.'
                  }
                />
              ) : (
                <InlineTable<InsightEvidenceMapEntry & Record<string, unknown>>
                  columns={
                    [
                      {
                        key: 'question',
                        header: isPolish ? 'Pytanie' : 'Question',
                        width: 'w-1/3',
                        render: (row) => (
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {row.question_text}
                          </span>
                        ),
                      },
                      {
                        key: 'answer',
                        header: isPolish ? 'Odpowiedź' : 'Answer',
                        width: 'w-1/3',
                        render: (row) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                            {row.answer_snippet?.length > 120
                              ? row.answer_snippet.slice(0, 120) + '…'
                              : row.answer_snippet}
                          </span>
                        ),
                      },
                      {
                        key: 'linked',
                        header: isPolish ? 'Powiązania' : 'Links',
                        render: (row) => (
                          <div className="flex flex-wrap gap-1">
                            {row.linked_themes?.map((t: string) => (
                              <span
                                key={`t-${t}`}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]"
                              >
                                {t}
                              </span>
                            ))}
                            {row.linked_issues?.map((i: string) => (
                              <span
                                key={`i-${i}`}
                                className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px]"
                              >
                                {i}
                              </span>
                            ))}
                          </div>
                        ),
                      },
                    ] as InlineTableColumn<InsightEvidenceMapEntry & Record<string, unknown>>[]
                  }
                  data={v6EvidenceMap as (InsightEvidenceMapEntry & Record<string, unknown>)[]}
                  rowKey={(row, idx) => row.answer_id || String(idx)}
                  emptyMessage={isPolish ? 'Brak danych.' : 'No data.'}
                  striped
                />
              )}
            </div>
          );
          break;

        case 'traceability':
          component = (
            <div className="space-y-4">
              <Callout
                variant="success"
                title={
                  isPolish
                    ? 'Traceability do odpowiedzi źródłowych'
                    : 'Traceability to source answers'
                }
              >
                {isPolish
                  ? 'Każda karta poniżej pokazuje, z których oficjalnych odpowiedzi i luk informacyjnych zbudowano insight.'
                  : 'Each card below shows which official answers and information gaps feed this insight.'}
              </Callout>

              {traceabilityRows.length === 0 ? (
                <EmptyStateInline
                  icon={Target}
                  message={isPolish ? 'Brak sesji źródłowych' : 'No source sessions'}
                  hint={
                    isPolish
                      ? 'Dodaj lub dokończ sesje, aby zbudować evidence trail.'
                      : 'Add or complete sessions to build the evidence trail.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {traceabilityRows.map(({ session, summary }) => (
                    <div
                      key={session.id}
                      className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-4 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {session.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {session.templateName ||
                              (isPolish ? 'Sesja źródłowa' : 'Source session')}
                          </div>
                        </div>
                        <button
                          onClick={() => openSourceSessionInInterviewHub(session)}
                          className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Official answers' : 'Official answers'}
                          </div>
                          {summary.facts.length > 0 ? (
                            summary.facts.slice(0, 4).map((fact) => (
                              <div
                                key={fact}
                                className="text-sm text-slate-700 dark:text-slate-300"
                              >
                                {fact}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-400 dark:text-slate-500">
                              {isPolish ? 'Brak zebranych faktów' : 'No facts captured'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Gaps / constraints' : 'Gaps / constraints'}
                          </div>
                          {uniqueNonEmpty([
                            ...summary.gaps,
                            ...summary.constraints,
                            ...summary.painPoints,
                          ]).length > 0 ? (
                            uniqueNonEmpty([
                              ...summary.gaps,
                              ...summary.constraints,
                              ...summary.painPoints,
                            ])
                              .slice(0, 4)
                              .map((item) => (
                                <div
                                  key={item}
                                  className="text-sm text-slate-700 dark:text-slate-300"
                                >
                                  {item}
                                </div>
                              ))
                          ) : (
                            <div className="text-sm text-slate-400 dark:text-slate-500">
                              {isPolish ? 'Brak luk lub ograniczeń' : 'No gaps or constraints'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;

        case 'full-analysis':
          component = (
            <div className="space-y-4">
              <Callout
                variant="warning"
                title={isPolish ? 'Raw AI narrative' : 'Raw AI narrative'}
                compact
              >
                {isPolish
                  ? 'Ta sekcja pokazuje pełny output AI w markdownzie. Traktuj ją jako warstwę roboczą pod consulting readout.'
                  : 'This section shows the full AI markdown output. Treat it as the working layer behind the consulting readout.'}
              </Callout>
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
                    <button
                      onClick={() => openSourceSessionInInterviewHub(session)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
          break;

        // (removed) attachments-links — no backend contract for insight attachments/links

        case 'comments':
          component = (
            <CommentsCanvas
              comments={filteredComments}
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

      const badgeMap: Record<string, number | undefined> = {
        comments: nComments.length,
        'source-sessions': sourceSessions.length,
        'activity-log': activityEntries.length,
        themes: v6Themes.length || undefined,
        'issues-risks': v6Issues.length || undefined,
        opportunities: v6Opportunities.length || undefined,
        signals: v6Signals.length || undefined,
        'evidence-map': v6EvidenceMap.length || undefined,
      };

      return {
        ...section,
        component,
        badge: badgeMap[section.id],
      } as NModeSection;
    });
  }, [
    executiveSummary,
    insight,
    isPolish,
    officialAnswers,
    issuesReadout,
    hiddenSignals,
    opportunityReadout,
    evidenceQuotes,
    traceabilityRows,
    sourceSessions,
    sourceSessionSummaries,
    nComments,
    commentDraft,
    commentDateFilter,
    commentSortOrder,
    draftPriority,
    nModeActivityEntries,
    activityStats,
    activityTypeMeta,
    handleSubmitComment,
    handleDeleteComment,
    getPriorityDotClass,
    openSourceSessionInInterviewHub,
    activityEntries,
    v6Themes,
    v6Issues,
    v6Opportunities,
    v6Signals,
    v6EvidenceMap,
    v6MissingData,
    expandedEvidenceRef,
    toggleEvidenceRef,
    findEvidenceForRef,
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
