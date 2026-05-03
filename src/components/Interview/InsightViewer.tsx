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
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flame,
  History,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
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

import { ArtifactActionPanel } from '@/components/shared/artifact-actions/ArtifactActionPanel';
import type { InlineTableColumn } from '@/components/shared/NModeBlocks';
import { Callout, EmptyStateInline, InlineTable } from '@/components/shared/NModeBlocks';
import { NModeShell } from '@/components/shared/NModeLayout/NModeShell';
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
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import {
  type V8InsightAnalysis,
  type V8InsightAnalysisMatrixCell,
  type V8InsightCandidate,
  type V8InsightFinding,
  type V8InsightMaterialQuality,
  type V8InsightSourcePack,
  V8InterviewApi,
  type V8InterviewReportPack,
  type V8InterviewReportReadiness,
  type V8InterviewReportWorksheetStatus,
} from '@/services/api/v8/interview';
import { useAppStore } from '@/store/useAppStore';
import { type ArtifactType, buildArtifactCode } from '@/utils/artifactLinks';

import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';

// ── Types ────────────────────────────────────────────────────────────────────

type InsightPromptType =
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

type InsightStatus = 'generating' | 'completed' | 'failed' | 'draft' | 'in_review' | 'published';

type P10ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';

type InsightReviewStatus = 'draft' | 'in_review' | 'published';

interface InsightTheme {
  title: string;
  description: string;
  evidence_refs: string[];
  strength: 'strong' | 'moderate' | 'weak';
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface InsightIssue {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
}

interface InsightOpportunity {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  evidence_refs: string[];
  confidence?: P10ConfidenceLevel;
  limits?: string[];
  crossSessionPattern?: boolean;
  perspective_labels?: string[];
  divergence_note?: string;
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
  evidence_pointers?: string[];
}

type P10ReadbackStatus =
  | 'draft_interpretation'
  | 'shared_for_readback'
  | 'confirmed_by_client'
  | 'partially_confirmed'
  | 'challenged_by_client'
  | 'needs_more_evidence';

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
  materialQuality?: V8InsightMaterialQuality | null;
  status: InsightStatus;
  reviewStatus?: InsightReviewStatus;
  publishedAt?: string;
  reviewedBy?: string;
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
  general_analysis: {
    icon: <Compass size={16} />,
    color: 'slate',
    label: 'General Analysis',
    labelPl: 'Analiza Ogólna',
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
  between_the_lines: {
    icon: <Brain size={16} />,
    color: 'rose',
    label: 'Between the Lines',
    labelPl: 'Czytanie Między Wierszami',
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
  draft: {
    label: { en: 'Draft', pl: 'Szkic' },
    color: 'bg-slate-500',
    textColor: 'text-slate-500',
  },
  completed: {
    label: { en: 'Completed', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  in_review: {
    label: { en: 'In Review', pl: 'W recenzji' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
  published: {
    label: { en: 'Published', pl: 'Opublikowane' },
    color: 'bg-violet-500',
    textColor: 'text-violet-500',
  },
  failed: { label: { en: 'Failed', pl: 'Błąd' }, color: 'bg-red-500', textColor: 'text-red-500' },
};

// ── N-mode section definitions (without component — assigned later) ──────────

const INSIGHT_SECTIONS: Omit<NModeSection, 'component'>[] = [
  { id: 'artifact-actions', icon: Rocket, label: { en: 'Next Actions', pl: 'Dalsze akcje' } },
  {
    id: 'truth-review-summary',
    icon: ShieldAlert,
    label: { en: 'Truth & Review', pl: 'Prawda i review' },
  },
  { id: 'executive-summary', icon: Star, label: { en: 'Executive Summary', pl: 'Podsumowanie' } },
  {
    id: 'consulting-readout',
    icon: Sparkles,
    label: { en: 'Consulting Readout', pl: 'Odczyt konsultingowy' },
  },
  {
    id: 'material-quality',
    icon: AlertCircle,
    label: { en: 'Material Quality', pl: 'Jakość materiału' },
  },
  { id: 'report-pack', icon: FileText, label: { en: 'Report Pack', pl: 'Pakiet raportu' } },
  { id: 'candidate-triage', icon: Eye, label: { en: 'Candidate Triage', pl: 'Triage kandydatów' } },
  { id: 'people', icon: Users, label: { en: 'People', pl: 'Perspektywy' } },
  {
    id: 'source-pack',
    icon: Link2,
    label: { en: 'Source Pack', pl: 'Pakiet źródeł' },
  },
  {
    id: 'analysis-matrix',
    icon: BarChart3,
    label: { en: 'Analysis Matrix', pl: 'Macierz Analizy' },
  },
  { id: 'themes', icon: Layers, label: { en: 'Themes', pl: 'Tematy' } },
  {
    id: 'issues-risks',
    icon: ShieldAlert,
    label: { en: 'Issues & Risks', pl: 'Problemy i ryzyka' },
  },
  { id: 'opportunities', icon: TrendingUp, label: { en: 'Opportunities', pl: 'Szanse' } },
  { id: 'signals', icon: Radio, label: { en: 'Signals', pl: 'Sygnały' } },
  { id: 'evidence-map', icon: MapIcon, label: { en: 'Evidence Map', pl: 'Mapa dowodów' } },
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
  const isPolish = i18n.language?.startsWith('pl');
  const { currentUser, currentOrganization } = useAppStore();
  const openChatWithContext = useOpenChatWithContext();
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
  const [isExportingNotebook, setIsExportingNotebook] = useState(false);

  // Handoff modal state
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [handoffFinding, setHandoffFinding] = useState<{
    findingId?: string;
    title: string;
    description: string;
    confidence?: P10ConfidenceLevel;
    limits?: string[];
    sectionType: 'theme' | 'issue' | 'opportunity';
    index: number;
  } | null>(null);
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);

  // Lifecycle transition state
  const [lifecycleTransitioning, setLifecycleTransitioning] = useState(false);

  // Limits expand state per card
  const [expandedLimits, setExpandedLimits] = useState<Set<string>>(new Set());

  // Related data
  const [sourceSessions, setSourceSessions] = useState<SourceSession[]>([]);
  const [sourceSessionSummaries, setSourceSessionSummaries] = useState<
    Record<string, SourceSessionSummary>
  >({});
  const [activityEntries, setActivityEntries] = useState<NModeActivityLogEntry[]>([]);
  const [findings, setFindings] = useState<V8InsightFinding[]>([]);
  const [candidates, setCandidates] = useState<V8InsightCandidate[]>([]);
  const [analysis, setAnalysis] = useState<V8InsightAnalysis | null>(null);
  const [sourcePack, setSourcePack] = useState<V8InsightSourcePack | null>(null);
  const [reportPack, setReportPack] = useState<V8InterviewReportPack | null>(null);
  const [reportReadiness, setReportReadiness] = useState<V8InterviewReportReadiness | null>(null);
  const [analysisLensMode, setAnalysisLensMode] = useState<'stakeholder' | 'session'>(
    'stakeholder'
  );
  const [analysisRoleFilter, setAnalysisRoleFilter] = useState('all');
  const [analysisDepartmentFilter, setAnalysisDepartmentFilter] = useState('all');
  const [candidateActionLoadingId, setCandidateActionLoadingId] = useState<string | null>(null);
  const [readbackLoadingId, setReadbackLoadingId] = useState<string | null>(null);
  const [worksheetActionLoadingKey, setWorksheetActionLoadingKey] = useState<string | null>(null);
  const [reportReviewSubmitting, setReportReviewSubmitting] = useState(false);
  const [reportPublishing, setReportPublishing] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportRevisionCreating, setReportRevisionCreating] = useState(false);

  // NMode shared section state — Comments
  const [nComments, setNComments] = useState<CommentItem[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentDateFilter, setCommentDateFilter] = useState<DateFilter>('all');
  const [commentSortOrder, setCommentSortOrder] = useState<SortOrder>('desc');
  const [draftPriority, setDraftPriority] = useState<CommentPriority>('normal');

  const loadPersistedFindings = useCallback(async (currentInsightId: string) => {
    try {
      const findingsRes = await V8InterviewApi.listFindings(currentInsightId)
        .then((r) => r.findings)
        .catch(() => []);
      setFindings(Array.isArray(findingsRes) ? findingsRes : []);
    } catch {
      setFindings([]);
    }
  }, []);

  const loadInsightAnalysis = useCallback(async (currentInsightId: string) => {
    try {
      const analysisRes = await V8InterviewApi.getAnalysis(currentInsightId)
        .then((r) => r.analysis)
        .catch(() => null);
      setAnalysis(analysisRes || null);
    } catch {
      setAnalysis(null);
    }
  }, []);

  const loadCandidates = useCallback(async (currentInsightId: string) => {
    try {
      const candidatesRes = await V8InterviewApi.listCandidates(currentInsightId)
        .then((r) => r.candidates)
        .catch(() => []);
      setCandidates(Array.isArray(candidatesRes) ? candidatesRes : []);
    } catch {
      setCandidates([]);
    }
  }, []);

  const loadSourcePack = useCallback(async (currentInsightId: string) => {
    try {
      const sourcePackRes = await V8InterviewApi.getSourcePack(currentInsightId)
        .then((r) => r.sourcePack)
        .catch(() => null);
      setSourcePack(sourcePackRes || null);
    } catch {
      setSourcePack(null);
    }
  }, []);

  const loadReportPack = useCallback(async (currentInsightId: string) => {
    try {
      const reportPackRes = await V8InterviewApi.getInsightReportPack(currentInsightId)
        .then((r) => r.reportPack)
        .catch(() => null);
      setReportPack(reportPackRes || null);
    } catch {
      setReportPack(null);
    }
  }, []);

  const loadReportReadiness = useCallback(async (currentInsightId: string) => {
    try {
      const readinessRes = await V8InterviewApi.getInsightReportReadiness(currentInsightId)
        .then((r) => r.readiness)
        .catch(() => null);
      setReportReadiness(readinessRes || null);
    } catch {
      setReportReadiness(null);
    }
  }, []);

  const handleWorksheetStatusUpdate = useCallback(
    async (
      worksheetKey: string,
      status: V8InterviewReportWorksheetStatus,
      completenessScore: number,
      warnings: string[] = []
    ) => {
      if (!insight?.id) return;
      setWorksheetActionLoadingKey(`${worksheetKey}:${status}`);
      try {
        const response = await V8InterviewApi.updateInsightReportWorksheet(
          insight.id,
          worksheetKey,
          {
            status,
            completenessScore,
            warnings,
          }
        );
        setReportPack(response.reportPack);
        await loadReportReadiness(insight.id);
        toast.success(isPolish ? 'Arkusz raportu zaktualizowany.' : 'Report worksheet updated.');
      } catch (error) {
        console.error('[InsightViewer] Failed to update report worksheet:', error);
        toast.error(
          isPolish ? 'Nie udało się zapisać statusu arkusza.' : 'Failed to save worksheet status.'
        );
      } finally {
        setWorksheetActionLoadingKey(null);
      }
    },
    [insight?.id, isPolish, loadReportReadiness]
  );

  const handleSubmitReportForReview = useCallback(async () => {
    if (!insight?.id) return;
    setReportReviewSubmitting(true);
    try {
      const response = await V8InterviewApi.submitInsightReportForReview(insight.id);
      setReportPack(response.result.reportPack);
      setReportReadiness(response.result.readiness);
      if (response.result.blocked) {
        toast.error(
          isPolish
            ? 'Gate gotowości blokuje wysłanie raportu do review.'
            : 'The readiness gate blocks review submission.'
        );
        return;
      }
      toast.success(
        response.result.alreadyInReview
          ? isPolish
            ? 'Raport jest już w review.'
            : 'Report pack is already in review.'
          : isPolish
            ? 'Raport wysłany do review.'
            : 'Report pack submitted for review.'
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to submit report pack for review:', error);
      toast.error(
        isPolish
          ? 'Nie udało się wysłać raportu do review.'
          : 'Failed to submit report pack for review.'
      );
    } finally {
      setReportReviewSubmitting(false);
    }
  }, [insight?.id, isPolish]);

  const handlePublishReportPack = useCallback(async () => {
    if (!insight?.id) return;
    setReportPublishing(true);
    try {
      const response = await V8InterviewApi.publishInsightReportPack(insight.id);
      setReportPack(response.result.reportPack);
      setReportReadiness(response.result.readiness);
      if (response.result.blocked) {
        toast.error(
          isPolish
            ? 'Gate publikacji blokuje opublikowanie raportu.'
            : 'The publish gate blocks report publication.'
        );
        return;
      }
      toast.success(
        response.result.alreadyPublished
          ? isPolish
            ? 'Raport jest już opublikowany.'
            : 'Report pack is already published.'
          : isPolish
            ? 'Raport opublikowany.'
            : 'Report pack published.'
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to publish report pack:', error);
      toast.error(
        isPolish ? 'Nie udało się opublikować raportu.' : 'Failed to publish report pack.'
      );
    } finally {
      setReportPublishing(false);
    }
  }, [insight?.id, isPolish]);

  const handleExportReportManifest = useCallback(async () => {
    if (!insight?.id) return;
    setReportExporting(true);
    try {
      const response = await V8InterviewApi.getInsightReportExportManifest(insight.id);
      const payload = JSON.stringify(response.exportManifest, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${response.exportManifest.reportPackId}-manifest.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(isPolish ? 'Manifest raportu pobrany.' : 'Report manifest downloaded.');
    } catch (error) {
      console.error('[InsightViewer] Failed to export report manifest:', error);
      toast.error(
        isPolish
          ? 'Nie udało się pobrać manifestu. Raport musi być opublikowany.'
          : 'Failed to download manifest. The report must be published.'
      );
    } finally {
      setReportExporting(false);
    }
  }, [insight?.id, isPolish]);

  const handleCreateReportRevision = useCallback(async () => {
    if (!insight?.id) return;
    setReportRevisionCreating(true);
    try {
      const response = await V8InterviewApi.createInsightReportRevision(insight.id);
      setReportPack(response.result.reportPack);
      await loadReportReadiness(insight.id);
      toast.success(
        isPolish
          ? `Utworzono nowy draft z opublikowanej wersji v${response.result.revision.version}.`
          : `Created a new draft from published version v${response.result.revision.version}.`
      );
    } catch (error) {
      console.error('[InsightViewer] Failed to create report pack revision:', error);
      toast.error(
        isPolish
          ? 'Nie udało się utworzyć nowego draftu. Raport musi być opublikowany.'
          : 'Failed to create a new draft. The report must be published.'
      );
    } finally {
      setReportRevisionCreating(false);
    }
  }, [insight?.id, isPolish, loadReportReadiness]);

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
        setFindings([]);
        setCandidates([]);
        setAnalysis(null);
        setSourcePack(null);
        setReportPack(null);
        return true;
      };

      setIsLoading(true);
      setError(null);
      try {
        if (isInterviewDemoId(insightId) && applyDemoInsight(insightId)) return;

        const data = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`).catch(() => null));
        if (!data) {
          if (applyDemoInsight(insightId)) return;
          throw new Error('Failed to load insight');
        }
        setInsight(data);
        setTitle(data.title || '');
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        await loadSourcePack(insightId);
        await loadReportPack(insightId);
        await loadReportReadiness(insightId);

        if (data.sourceSessionIds?.length > 0) {
          try {
            const sessionsData = await Promise.all(
              data.sourceSessionIds.slice(0, 10).map((id: string) =>
                V8InterviewApi.getSession(id)
                  .then((r) => r.session)
                  .catch(() => Api.get(`/interview/sessions/${id}`).catch(() => null))
              )
            );
            const validSessions = (sessionsData || []).filter(Boolean);
            setSourceSessions(validSessions);

            const summaryEntries = await Promise.all(
              validSessions.map(async (session: SourceSession) => {
                const summary = await V8InterviewApi.getSessionSummary(session.id).catch(() =>
                  Api.get(`/interview/sessions/${session.id}/summary`).catch(() => null)
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
          V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => [])),
          V8InterviewApi.getInsightComments(insightId)
            .then((r) => r.comments)
            .catch(() => Api.get(`/interview/insights/${insightId}/comments`).catch(() => [])),
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
        const data = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`));
        setInsight(data);
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        await loadSourcePack(insightId);
        await loadReportPack(insightId);
        await loadReportReadiness(insightId);
        const nextStatus = data?.status as InsightStatus | undefined;
        if (lastStatus === null) lastStatus = nextStatus ?? null;

        if (lastStatus === 'generating' && nextStatus && nextStatus !== 'generating') {
          clearInterval(interval);
          const activityRes = await V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
          setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        }

        lastStatus = nextStatus ?? null;
      } catch (err) {
        // keep polling best-effort
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    insightId,
    interviewDemoData,
    isPolish,
    loadCandidates,
    loadInsightAnalysis,
    loadSourcePack,
    loadReportPack,
    loadReportReadiness,
    loadPersistedFindings,
  ]);

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
  const materialQuality = useMemo<V8InsightMaterialQuality | null>(() => {
    if (insight?.materialQuality) return insight.materialQuality;
    if (!insight || insight.status === 'generating') return null;
    return {
      overall_material_score: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (insight.sourceSessionIds?.length || 0) * 12 +
              Math.min(v6EvidenceMap.length, 12) * 4 -
              (insight.missingData?.length || 0) * 5
          )
        )
      ),
      answer_quality_posture:
        v6EvidenceMap.length >= 10 ? 'strong' : v6EvidenceMap.length >= 4 ? 'usable' : 'thin',
      coverage_posture:
        (insight.sourceSessionIds?.length || 0) <= 1
          ? 'single_perspective'
          : (insight.sourceSessionIds?.length || 0) >= 4
            ? 'good_coverage'
            : 'partial_coverage',
      approved_session_count: insight.sourceSessionIds?.length || 0,
      respondent_count: insight.sourceSessionIds?.length || 0,
      role_coverage: [],
      department_coverage: [],
      thin_answer_count: 0,
      missing_voices: [],
      evidence_gap_count: insight.missingData?.length || 0,
      contradiction_count: v6Signals.filter((signal) => signal.type === 'contradiction').length,
      limitations: insight.missingData || [],
      recommended_followups: [],
    };
  }, [insight, v6EvidenceMap.length, v6Signals]);
  const sourcePackByAnswerId = useMemo(
    () =>
      (sourcePack?.entries || []).reduce<Record<string, V8InsightSourcePack['entries'][number]>>(
        (acc, entry) => {
          if (entry.answerId) acc[entry.answerId] = entry;
          return acc;
        },
        {}
      ),
    [sourcePack?.entries]
  );
  const v6MissingData = useMemo<string[]>(() => insight?.missingData ?? [], [insight?.missingData]);
  const findingsBySourceKey = useMemo(
    () =>
      findings.reduce<Record<string, V8InsightFinding>>((acc, finding) => {
        if (finding.source_key) acc[finding.source_key] = finding;
        return acc;
      }, {}),
    [findings]
  );
  const findingsSummary = useMemo(
    () => ({
      total: findings.length,
      activeEvidence: findings.reduce(
        (sum, finding) =>
          sum + finding.evidence_pointers.filter((pointer) => !pointer.isTombstone).length,
        0
      ),
      pendingReview: findings.filter((finding) => finding.review_status === 'in_review').length,
      contradicted: findings.filter((finding) => finding.confidence_level === 'contradicted')
        .length,
    }),
    [findings]
  );

  const candidateSummary = useMemo(
    () => ({
      total: candidates.length,
      ready: candidates.filter((candidate) => candidate.triage_status === 'ready_for_review')
        .length,
      needsEvidence: candidates.filter((candidate) => candidate.triage_status === 'needs_evidence')
        .length,
      needsSplit: candidates.filter((candidate) => candidate.triage_status === 'needs_split')
        .length,
      promoted: candidates.filter((candidate) => candidate.triage_status === 'promoted').length,
    }),
    [candidates]
  );

  const readbackSummary = useMemo(
    () => ({
      confirmed: findings.filter((finding) => finding.readback_status === 'confirmed_by_client')
        .length,
      challenged: findings.filter((finding) => finding.readback_status === 'challenged_by_client')
        .length,
      needsMoreEvidence: findings.filter(
        (finding) => finding.readback_status === 'needs_more_evidence'
      ).length,
      unresolved: findings.filter(
        (finding) =>
          finding.readback_status !== 'confirmed_by_client' &&
          finding.readback_status !== 'partially_confirmed'
      ).length,
    }),
    [findings]
  );

  const truthReviewSummary = useMemo(() => {
    const contradictionSignals = v6Signals.filter((signal) => signal.type === 'contradiction');
    const publishBlockers = uniqueNonEmpty([
      ...(findingsSummary.total === 0
        ? [
            isPolish
              ? 'Brak persisted P10 findings do publikacji lub handoffu.'
              : 'No persisted P10 findings are available for publish or handoff.',
          ]
        : []),
      ...(findingsSummary.activeEvidence === 0
        ? [
            isPolish
              ? 'Brak aktywnych evidence pointers przy findingach.'
              : 'No active evidence pointers are attached to findings.',
          ]
        : []),
      ...(candidateSummary.needsEvidence > 0
        ? [
            isPolish
              ? `${candidateSummary.needsEvidence} kandydatów wymaga dowodów.`
              : `${candidateSummary.needsEvidence} candidates need more evidence.`,
          ]
        : []),
      ...(candidateSummary.needsSplit > 0
        ? [
            isPolish
              ? `${candidateSummary.needsSplit} kandydatów wymaga splitu sprzeczności.`
              : `${candidateSummary.needsSplit} candidates need contradiction split.`,
          ]
        : []),
      ...(readbackSummary.unresolved > 0
        ? [
            isPolish
              ? `${readbackSummary.unresolved} findingów nie ma potwierdzonego readbacku.`
              : `${readbackSummary.unresolved} findings do not have confirmed readback.`,
          ]
        : []),
      ...(readbackSummary.challenged > 0
        ? [
            isPolish
              ? `${readbackSummary.challenged} findingów zakwestionowano w readbacku.`
              : `${readbackSummary.challenged} findings were challenged in readback.`,
          ]
        : []),
    ]);

    const safeClaims = findings
      .filter(
        (finding) =>
          finding.confidence_level !== 'contradicted' &&
          finding.evidence_pointers.some((pointer) => !pointer.isTombstone)
      )
      .slice(0, 4);

    const posture: 'ready' | 'review_needed' | 'weak' =
      publishBlockers.length === 0
        ? 'ready'
        : findingsSummary.activeEvidence > 0 || candidateSummary.ready > 0
          ? 'review_needed'
          : 'weak';

    return {
      contradictionSignals,
      publishBlockers,
      safeClaims,
      posture,
    };
  }, [
    candidateSummary.needsEvidence,
    candidateSummary.needsSplit,
    candidateSummary.ready,
    findings,
    findingsSummary.activeEvidence,
    findingsSummary.total,
    isPolish,
    readbackSummary.challenged,
    readbackSummary.unresolved,
    v6Signals,
  ]);

  const analysisTopicsById = useMemo(
    () =>
      (analysis?.topics || []).reduce<Record<string, V8InsightAnalysis['topics'][number]>>(
        (acc, topic) => {
          acc[topic.id] = topic;
          return acc;
        },
        {}
      ),
    [analysis]
  );

  const consensusTopics = useMemo(
    () =>
      (analysis?.synthesis.consensusTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.consensusTopicIds, analysisTopicsById]
  );

  const localOnlyTopics = useMemo(
    () =>
      (analysis?.synthesis.localOnlyTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.localOnlyTopicIds, analysisTopicsById]
  );

  const contradictedTopics = useMemo(
    () =>
      (analysis?.synthesis.contradictedTopicIds || [])
        .map((id) => analysisTopicsById[id])
        .filter(Boolean),
    [analysis?.synthesis.contradictedTopicIds, analysisTopicsById]
  );

  const stakeholderMatrixCellMap = useMemo(
    () =>
      new Map(
        (analysis?.matrix.stakeholderCells || []).map(
          (cell) => [`${cell.topicId}:${cell.lensId}`, cell] as const
        )
      ),
    [analysis?.matrix.stakeholderCells]
  );

  const sessionMatrixCellMap = useMemo(
    () =>
      new Map(
        (analysis?.matrix.sessionCells || []).map(
          (cell) => [`${cell.topicId}:${cell.lensId}`, cell] as const
        )
      ),
    [analysis?.matrix.sessionCells]
  );

  const analysisRoleOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...(analysis?.people.sessionLenses || []).map((lens) => lens.role),
        ...(analysis?.people.stakeholderLenses || []).map((lens) => lens.role),
      ]),
    [analysis]
  );

  const analysisDepartmentOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...(analysis?.people.sessionLenses || []).map((lens) => lens.department),
        ...(analysis?.people.stakeholderLenses || []).map((lens) => lens.department),
      ]),
    [analysis]
  );

  const filteredSessionAnalysisLenses = useMemo(
    () =>
      (analysis?.people.sessionLenses || []).filter((lens) => {
        if (analysisRoleFilter !== 'all' && lens.role !== analysisRoleFilter) return false;
        if (analysisDepartmentFilter !== 'all' && lens.department !== analysisDepartmentFilter)
          return false;
        return true;
      }),
    [analysis?.people.sessionLenses, analysisDepartmentFilter, analysisRoleFilter]
  );

  const filteredStakeholderAnalysisLenses = useMemo(
    () =>
      (analysis?.people.stakeholderLenses || []).filter((lens) => {
        if (analysisRoleFilter !== 'all' && lens.role !== analysisRoleFilter) return false;
        if (analysisDepartmentFilter !== 'all' && lens.department !== analysisDepartmentFilter)
          return false;
        return true;
      }),
    [analysis?.people.stakeholderLenses, analysisDepartmentFilter, analysisRoleFilter]
  );

  const activeAnalysisColumns = useMemo(
    () =>
      analysisLensMode === 'stakeholder'
        ? filteredStakeholderAnalysisLenses.map((lens) => ({ id: lens.id, label: lens.label }))
        : filteredSessionAnalysisLenses.map((lens) => ({ id: lens.id, label: lens.label })),
    [analysisLensMode, filteredSessionAnalysisLenses, filteredStakeholderAnalysisLenses]
  );

  const activeAnalysisCellMap = useMemo(
    () => (analysisLensMode === 'stakeholder' ? stakeholderMatrixCellMap : sessionMatrixCellMap),
    [analysisLensMode, sessionMatrixCellMap, stakeholderMatrixCellMap]
  );

  const visibleAnalysisTopicRows = useMemo(() => {
    const baseRows = analysis?.matrix.rows || [];
    const filtersApplied = analysisRoleFilter !== 'all' || analysisDepartmentFilter !== 'all';
    if (!filtersApplied) return baseRows;
    return baseRows.filter((row) =>
      activeAnalysisColumns.some((column) => {
        const cell = activeAnalysisCellMap.get(`${row.id}:${column.id}`);
        return cell && cell.state !== 'not_observed';
      })
    );
  }, [
    activeAnalysisCellMap,
    activeAnalysisColumns,
    analysis?.matrix.rows,
    analysisDepartmentFilter,
    analysisRoleFilter,
  ]);

  const visiblePeopleLenses = useMemo(
    () =>
      analysisLensMode === 'stakeholder'
        ? filteredStakeholderAnalysisLenses
        : filteredSessionAnalysisLenses,
    [analysisLensMode, filteredSessionAnalysisLenses, filteredStakeholderAnalysisLenses]
  );

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
      await V8InterviewApi.updateInsight(insight.id, { title }).catch(() =>
        Api.patch(`/interview/insights/${insight.id}`, { title })
      );
      toast.success(isPolish ? 'Zapisano' : 'Saved');
      const refreshed = await V8InterviewApi.getInsight(insightId)
        .then((r) => r.insight)
        .catch(() => Api.get(`/interview/insights/${insightId}`).catch(() => null));
      if (refreshed) {
        setInsight(refreshed);
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        onSaved?.(refreshed);
      } else {
        onSaved?.({ ...insight, title });
      }
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
      setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
    } catch {
      toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = () => {
    void openChatWithContext({
      entityType: 'interview insight',
      entityId: insightId,
      entityName: title || insight?.title || insightId,
      contextData: {
        insightId,
        title,
        promptType: insight?.promptType,
        status: insight?.status,
        sourceSessionCount: insight?.sourceSessionCount,
      },
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
      await V8InterviewApi.regenerateInsight(insight.id).catch(() =>
        Api.post(`/interview/insights/${insight.id}/regenerate`, {})
      );
      toast.success(isPolish ? 'Regenerowanie rozpoczęte...' : 'Regeneration started...');
      const data = await V8InterviewApi.getInsight(insightId)
        .then((r) => r.insight)
        .catch(() => Api.get(`/interview/insights/${insightId}`));
      setInsight(data);
      await loadPersistedFindings(insightId);
      await loadCandidates(insightId);
      await loadInsightAnalysis(insightId);
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
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
      const exportRes = await V8InterviewApi.exportInsight(insight.id, { target: 'tools' }).catch(
        () => Api.post(`/interview/insights/${insight.id}/export`, { target: 'tools' })
      );
      toast.success(isPolish ? 'Wyeksportowano do Tools' : 'Exported to Tools');
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
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
      const exportRes = await V8InterviewApi.exportInsight(insight.id, {
        target: 'assessment',
      }).catch(() =>
        Api.post(`/interview/insights/${insight.id}/export`, { target: 'assessment' })
      );
      toast.success(isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment');
      const activityRes = await V8InterviewApi.getInsightActivity(insightId)
        .then((r) => r.activity)
        .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
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

  const handleExportToNotebook = async () => {
    if (!insight) return;
    setIsExportingNotebook(true);
    try {
      await Api.post('/my-work/notebook/pages', {
        title: insight.title,
        content: insight.content || '',
        source: 'interview_insight',
        metadata: { insightId: insight.id },
      });
      toast.success(isPolish ? 'Zapisano w Notatniku' : 'Saved to Notebook');
    } catch {
      toast.error(isPolish ? 'Nie udało się zapisać w Notatniku' : 'Failed to save to Notebook');
    } finally {
      setIsExportingNotebook(false);
    }
  };

  const handleOpenHandoff = useCallback(
    (finding: {
      findingId?: string;
      title: string;
      description: string;
      confidence?: P10ConfidenceLevel;
      limits?: string[];
      sectionType: 'theme' | 'issue' | 'opportunity';
      index: number;
    }) => {
      setHandoffFinding(finding);
      setHandoffModalOpen(true);
    },
    []
  );

  const handleHandoffSubmit = useCallback(
    async (mode: 'link' | 'create') => {
      if (!insight || !handoffFinding) return;
      setHandoffSubmitting(true);

      const MAX_RETRIES = 2;
      const findingId = handoffFinding.findingId;
      if (!findingId) {
        toast.error(
          isPolish
            ? 'Finding nie został jeszcze zapisany w artefakcie P10. Zapisz lub odśwież insight.'
            : 'This finding is not yet persisted in the P10 artifact. Refresh the insight first.'
        );
        setHandoffSubmitting(false);
        return;
      }
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await V8InterviewApi.handoffFinding(
            insight.id,
            findingId,
            mode === 'link' ? { target_initiative_id: 'select' } : undefined
          );
          setHandoffModalOpen(false);
          setHandoffFinding(null);
          const initiativeId = res?.initiative?.id;
          toast.success(
            isPolish
              ? `Inicjatywa ${mode === 'create' ? 'utworzona' : 'powiązana'}${initiativeId ? ` (${initiativeId})` : ''}`
              : `Initiative ${mode === 'create' ? 'created' : 'linked'}${initiativeId ? ` (${initiativeId})` : ''}`
          );
          return;
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);

          if (
            errMsg.includes('403') ||
            errMsg.includes('permission') ||
            errMsg.includes('forbidden')
          ) {
            toast.error(
              isPolish
                ? 'Brak uprawnień do przekazania do Inicjatyw. Dostępny jest eksport lub link.'
                : 'Permission denied for initiative handoff. Export or link-only is available.'
            );
            setHandoffSubmitting(false);
            return;
          }

          if (errMsg.includes('422') || errMsg.includes('HANDOFF_BLOCKED')) {
            toast.error(
              isPolish
                ? 'Handoff zablokowany — sprawdź confidence i evidence findingu.'
                : 'Handoff blocked — check finding confidence and evidence.'
            );
            setHandoffSubmitting(false);
            return;
          }

          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
        }
      }

      const errMsg = lastError instanceof Error ? lastError.message : '';
      if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('timeout')) {
        toast.error(
          isPolish
            ? 'Problem z siecią — payload zachowany. Spróbuj ponownie.'
            : 'Network issue — payload preserved. Please retry.'
        );
      } else {
        toast.error(
          isPolish
            ? 'Nie udało się przekazać finding do inicjatywy'
            : 'Failed to hand off finding to initiative'
        );
      }
      setHandoffSubmitting(false);
    },
    [insight, handoffFinding, isPolish]
  );

  const handleLifecycleTransition = useCallback(
    async (uiAction: 'submit_review' | 'approve' | 'reject' | 'revert_draft') => {
      if (!insight) return;
      const ACTION_MAP: Record<string, string> = {
        submit_review: 'submit_for_review',
        approve: 'approve',
        reject: 'reject',
        revert_draft: 'revert_to_draft',
      };
      const backendAction = ACTION_MAP[uiAction] ?? uiAction;
      setLifecycleTransitioning(true);
      try {
        await V8InterviewApi.lifecycleTransition(insight.id, backendAction);
        const refreshed = await V8InterviewApi.getInsight(insightId)
          .then((r) => r.insight)
          .catch(() => Api.get(`/interview/insights/${insightId}`));
        setInsight(refreshed);
        await loadPersistedFindings(insightId);
        await loadCandidates(insightId);
        await loadInsightAnalysis(insightId);
        await loadSourcePack(insightId);
        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        const labels: Record<string, { en: string; pl: string }> = {
          submit_review: { en: 'Submitted for review', pl: 'Wysłano do recenzji' },
          approve: { en: 'Published', pl: 'Opublikowano' },
          reject: { en: 'Rejected — reverted to draft', pl: 'Odrzucono — powrót do szkicu' },
          revert_draft: { en: 'Reverted to draft', pl: 'Przywrócono do szkicu' },
        };
        toast.success(isPolish ? labels[uiAction].pl : labels[uiAction].en);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        if (
          errMsg.includes('403') ||
          errMsg.includes('permission') ||
          errMsg.includes('forbidden')
        ) {
          toast.error(
            isPolish
              ? 'Brak uprawnień do zmiany statusu. Skontaktuj się z administratorem.'
              : 'Permission denied for lifecycle change. Contact your administrator.'
          );
        } else {
          toast.error(
            isPolish ? 'Nie udało się zmienić statusu' : 'Failed to change lifecycle status'
          );
        }
      } finally {
        setLifecycleTransitioning(false);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const handleCandidateAction = useCallback(
    async (
      candidate: V8InsightCandidate,
      action:
        | 'mark_candidate'
        | 'mark_needs_split'
        | 'mark_needs_evidence'
        | 'mark_ready_for_review'
        | 'reject'
        | 'promote_to_finding'
    ) => {
      if (!insight) return;
      setCandidateActionLoadingId(candidate.id);
      try {
        await V8InterviewApi.triageCandidate(insight.id, candidate.id, {
          action,
          candidate_statement:
            action === 'promote_to_finding' ? candidate.candidate_statement : undefined,
          confidence_level: action === 'promote_to_finding' ? candidate.confidence_hint : undefined,
        });
        await Promise.all([
          loadCandidates(insightId),
          loadPersistedFindings(insightId),
          loadInsightAnalysis(insightId),
          loadSourcePack(insightId),
        ]);
        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
        setActivityEntries(Array.isArray(activityRes) ? activityRes : []);
        const labels: Record<string, { pl: string; en: string }> = {
          mark_candidate: { pl: 'Przywrócono jako kandydat', en: 'Reset to candidate' },
          mark_needs_split: { pl: 'Oznaczono jako do rozbicia', en: 'Marked as needs split' },
          mark_needs_evidence: {
            pl: 'Oznaczono jako wymagające dowodów',
            en: 'Marked as needs evidence',
          },
          mark_ready_for_review: {
            pl: 'Oznaczono jako gotowe do recenzji',
            en: 'Marked as ready for review',
          },
          reject: { pl: 'Kandydat odrzucony', en: 'Candidate rejected' },
          promote_to_finding: {
            pl: 'Kandydat promowany do findingu',
            en: 'Candidate promoted to finding',
          },
        };
        toast.success(isPolish ? labels[action].pl : labels[action].en);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.error ||
            err?.message ||
            (isPolish
              ? 'Nie udało się zaktualizować triage kandydata'
              : 'Failed to update candidate triage')
        );
      } finally {
        setCandidateActionLoadingId(null);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const handleReadbackStatus = useCallback(
    async (finding: V8InsightFinding, status: P10ReadbackStatus) => {
      if (!insight) return;
      setReadbackLoadingId(finding.id);
      try {
        const summaryDefaults: Record<P10ReadbackStatus, string> = {
          draft_interpretation: 'Readback reset to draft interpretation.',
          shared_for_readback: 'Finding shared for client readback.',
          confirmed_by_client: 'Client confirmed the interpretation for governed downstream use.',
          partially_confirmed: 'Client partially confirmed; keep limits visible before publish.',
          challenged_by_client: 'Client challenged the interpretation; return to evidence review.',
          needs_more_evidence: 'Readback requires more evidence before publish or handoff.',
        };
        await V8InterviewApi.updateFindingReadback(insight.id, finding.id, {
          readback_status: status,
          readback_summary: summaryDefaults[status],
        });
        await Promise.all([
          loadPersistedFindings(insightId),
          loadCandidates(insightId),
          loadInsightAnalysis(insightId),
          loadSourcePack(insightId),
        ]);
        toast.success(isPolish ? 'Readback zaktualizowany' : 'Readback updated');
      } catch {
        toast.error(
          isPolish ? 'Nie udało się zaktualizować readback' : 'Failed to update readback'
        );
      } finally {
        setReadbackLoadingId(null);
      }
    },
    [
      insight,
      insightId,
      isPolish,
      loadCandidates,
      loadInsightAnalysis,
      loadPersistedFindings,
      loadSourcePack,
    ]
  );

  const toggleLimitsExpand = useCallback((cardKey: string) => {
    setExpandedLimits((prev) => {
      const next = new Set(prev);
      if (next.has(cardKey)) next.delete(cardKey);
      else next.add(cardKey);
      return next;
    });
  }, []);

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

        const created = await V8InterviewApi.createInsightComment(insightId, {
          content: text,
          priority: draftPriority,
        }).catch(() =>
          Api.post(`/interview/insights/${insightId}/comments`, {
            content: text,
            priority: draftPriority,
          })
        );
        setNComments((prev) => [...prev, created]);
        setCommentDraft('');
        setDraftPriority('normal');

        const activityRes = await V8InterviewApi.getInsightActivity(insightId)
          .then((r) => r.activity)
          .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
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

          await V8InterviewApi.deleteInsightComment(insightId, commentId).catch(() =>
            Api.delete(`/interview/insights/${insightId}/comments/${commentId}`)
          );
          setNComments((prev) => prev.filter((c) => c.id !== commentId));
          const activityRes = await V8InterviewApi.getInsightActivity(insightId)
            .then((r) => r.activity)
            .catch(() => Api.get(`/interview/insights/${insightId}/activity`).catch(() => []));
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
        value:
          insight?.reviewStatus === 'in_review' || insight?.reviewStatus === 'published'
            ? insight.reviewStatus
            : insight?.status || 'generating',
        onChange: () => {},
        readOnly: true,
        options: [
          { value: 'draft', label: { en: 'Draft', pl: 'Szkic' } },
          { value: 'generating', label: { en: 'Generating', pl: 'Generowanie' } },
          { value: 'completed', label: { en: 'Completed', pl: 'Ukończone' } },
          { value: 'in_review', label: { en: 'In Review', pl: 'W recenzji' } },
          { value: 'published', label: { en: 'Published', pl: 'Opublikowano' } },
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
        id: 'reviewStatus',
        label: { en: 'Review', pl: 'Recenzja' },
        type: 'select' as const,
        value: insight?.reviewStatus || 'draft',
        onChange: () => {},
        readOnly: true,
        options: [
          { value: 'draft', label: { en: 'Draft', pl: 'Szkic' } },
          { value: 'in_review', label: { en: 'In Review', pl: 'W recenzji' } },
          { value: 'published', label: { en: 'Published', pl: 'Opublikowano' } },
        ],
      },
      {
        id: 'findings',
        label: { en: 'Findings', pl: 'Findingi' },
        type: 'text' as const,
        value: String(findingsSummary.total),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'candidates',
        label: { en: 'Candidates', pl: 'Kandydaci' },
        type: 'text' as const,
        value: String(candidateSummary.total),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'evidence',
        label: { en: 'Evidence', pl: 'Dowody' },
        type: 'text' as const,
        value: String(findingsSummary.activeEvidence),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'readback',
        label: { en: 'Readback', pl: 'Readback' },
        type: 'text' as const,
        value: `${readbackSummary.confirmed}/${findingsSummary.total}`,
        onChange: () => {},
        readOnly: true,
      },
    ],
    [
      candidateSummary.total,
      findingsSummary.activeEvidence,
      findingsSummary.total,
      insight,
      isPolish,
      readbackSummary.confirmed,
      typeMeta,
    ]
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
        case 'artifact-actions': {
          const primaryConfidence =
            findings[0]?.confidence_level ||
            analysis?.topics?.[0]?.confidenceLevel ||
            (insight as any)?.confidence ||
            null;
          const limits = uniqueNonEmpty(findings.map((finding) => finding.limits)).join('\n');
          component = (
            <ArtifactActionPanel
              isPolish={isPolish}
              source={{
                type: 'interview_insight',
                id: insight?.id || insightId,
                title: insight?.title || title || (isPolish ? 'Insight' : 'Insight'),
                status: insight?.status,
                content: insight?.content || executiveSummary,
                confidence: primaryConfidence,
                limits: limits || null,
                evidenceCount: sourcePack?.activePointerCount ?? findingsSummary.activeEvidence,
                sourceSessionCount:
                  sourcePack?.sourceSessionIds.length || insight?.sourceSessionIds?.length || 0,
                sourcePack: sourcePack ? (sourcePack as unknown as Record<string, unknown>) : null,
              }}
            />
          );
          break;
        }

        case 'truth-review-summary': {
          const postureMeta = {
            ready: {
              label: isPolish ? 'Gotowe do governed publish' : 'Ready for governed publish',
              className:
                'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-200',
            },
            review_needed: {
              label: isPolish ? 'Wymaga review operatora' : 'Operator review needed',
              className:
                'border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-200',
            },
            weak: {
              label: isPolish ? 'Słaby materiał decyzyjny' : 'Weak decision material',
              className: 'border-red-500/20 bg-red-500/[0.08] text-red-700 dark:text-red-200',
            },
          }[truthReviewSummary.posture];

          component = (
            <div className="space-y-5">
              <div className={`rounded-2xl border px-4 py-3 ${postureMeta.className}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      {isPolish ? 'Truth & Review Summary' : 'Truth & Review Summary'}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{postureMeta.label}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      P10 {findingsSummary.total}
                    </span>
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      {isPolish ? 'Dowody' : 'Evidence'} {findingsSummary.activeEvidence}
                    </span>
                    <span className="rounded-full bg-white/60 px-2 py-1 dark:bg-white/[0.08]">
                      Readback {readbackSummary.confirmed}/{findingsSummary.total}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-navy-900/50">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Co można twierdzić' : 'Safe claims'}
                  </div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.safeClaims.length > 0 ? (
                      truthReviewSummary.safeClaims.map((finding) => (
                        <div
                          key={finding.id}
                          className="text-sm text-slate-700 dark:text-slate-300"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {finding.finding_statement}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {finding.confidence_level} ·{' '}
                            {
                              finding.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                                .length
                            }{' '}
                            {isPolish ? 'dow.' : 'ev.'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyStateInline
                        icon={ShieldAlert}
                        message={
                          isPolish
                            ? 'Brak findingów z aktywną evidencją.'
                            : 'No findings with active evidence yet.'
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-navy-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Blokery publish/handoff' : 'Publish/handoff blockers'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNSection('candidate-triage')}
                      className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300"
                    >
                      {isPolish ? 'Triage' : 'Triage'}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.publishBlockers.length > 0 ? (
                      truthReviewSummary.publishBlockers.map((blocker) => (
                        <div
                          key={blocker}
                          className="rounded-xl bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                        >
                          {blocker}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
                        {isPolish
                          ? 'Brak blokad w evidence/readback dla persisted findings.'
                          : 'No evidence/readback blockers for persisted findings.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 dark:border-white/[0.08] dark:bg-navy-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Sprzeczności' : 'Contradictions'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNSection('signals')}
                      className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300"
                    >
                      {isPolish ? 'Sygnały' : 'Signals'}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {truthReviewSummary.contradictionSignals.length > 0 ? (
                      truthReviewSummary.contradictionSignals.slice(0, 4).map((signal) => (
                        <div
                          key={`${signal.title}-${signal.description}`}
                          className="rounded-xl bg-red-500/[0.07] px-3 py-2 text-sm text-red-800 dark:text-red-200"
                        >
                          <div className="font-medium">{signal.title}</div>
                          {signal.description && (
                            <div className="mt-1 text-xs opacity-80">{signal.description}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyStateInline
                        icon={Radio}
                        message={
                          isPolish
                            ? 'Brak jawnych contradiction signals.'
                            : 'No explicit contradiction signals.'
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
          break;
        }

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

        case 'consulting-readout': {
          const contradictionSignals = v6Signals.filter((s) => s.type === 'contradiction');
          component = (
            <div className="space-y-5">
              {contradictionSignals.length > 0 && (
                <Callout
                  variant="critical"
                  title={isPolish ? 'Sprzeczności wykryte' : 'Contradictions detected'}
                >
                  <ul className="list-disc list-inside space-y-1">
                    {contradictionSignals.map((s, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="font-medium">{s.title}</span>
                        {s.description && <> — {s.description}</>}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}
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
        }

        case 'material-quality': {
          const quality = materialQuality;
          const score = quality?.overall_material_score ?? 0;
          const postureColor =
            score >= 80
              ? 'text-emerald-400'
              : score >= 60
                ? 'text-blue-400'
                : score >= 40
                  ? 'text-amber-400'
                  : 'text-red-400';
          component = (
            <div className="space-y-5">
              <Callout
                variant={score >= 60 ? 'info' : 'warning'}
                title={
                  isPolish
                    ? 'Material Quality nie blokuje insightu'
                    : 'Material Quality is not a gate'
                }
              >
                {isPolish
                  ? 'Ta karta mówi, jak daleko można bezpiecznie ufać analizie. Słabszy materiał nie zatrzymuje pracy, ale musi jawnie pokazać ograniczenia.'
                  : 'This card explains how far the analysis can be trusted. Weak material does not stop the work, but it must show its limitations clearly.'}
              </Callout>

              {quality ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Wynik' : 'Score'}
                      </div>
                      <div className={`mt-1 text-2xl font-semibold ${postureColor}`}>
                        {score}/100
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Jakość odpowiedzi' : 'Answer quality'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {quality.answer_quality_posture}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Pokrycie' : 'Coverage'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {quality.coverage_posture}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Sesje / respondenci' : 'Sessions / respondents'}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {quality.approved_session_count} / {quality.respondent_count}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-navy-700 bg-navy-900/40 p-4">
                      <h4 className="text-sm font-semibold text-white">
                        {isPolish ? 'Ograniczenia materiału' : 'Material limitations'}
                      </h4>
                      {quality.limitations.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          {quality.limitations.map((item) => (
                            <li key={item} className="flex gap-2">
                              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          {isPolish
                            ? 'Brak jawnych ograniczeń poza standardową ostrożnością interpretacji.'
                            : 'No explicit limitations beyond normal interpretation caution.'}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-navy-700 bg-navy-900/40 p-4">
                      <h4 className="text-sm font-semibold text-white">
                        {isPolish ? 'Braki i follow-up' : 'Gaps and follow-up'}
                      </h4>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div>
                          {isPolish ? 'Cienkie odpowiedzi' : 'Thin answers'}:{' '}
                          <span className="text-slate-200">{quality.thin_answer_count}</span>
                        </div>
                        <div>
                          {isPolish ? 'Luki dowodowe' : 'Evidence gaps'}:{' '}
                          <span className="text-slate-200">{quality.evidence_gap_count}</span>
                        </div>
                        <div>
                          {isPolish ? 'Sprzeczności' : 'Contradictions'}:{' '}
                          <span className="text-slate-200">{quality.contradiction_count}</span>
                        </div>
                        <div>
                          {isPolish ? 'Brakujące głosy' : 'Missing voices'}:{' '}
                          <span className="text-slate-200">{quality.missing_voices.length}</span>
                        </div>
                      </div>
                      {quality.recommended_followups.length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          {quality.recommended_followups.map((item) => (
                            <li key={item} className="flex gap-2">
                              <MessageSquare size={15} className="mt-0.5 shrink-0 text-blue-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Role w materiale' : 'Roles covered'}
                      </div>
                      <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        {quality.role_coverage.length > 0
                          ? quality.role_coverage.join(', ')
                          : isPolish
                            ? 'Brak metadanych ról'
                            : 'No role metadata'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Działy w materiale' : 'Departments covered'}
                      </div>
                      <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        {quality.department_coverage.length > 0
                          ? quality.department_coverage.join(', ')
                          : isPolish
                            ? 'Brak metadanych działów'
                            : 'No department metadata'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyStateInline
                  icon={AlertCircle}
                  message={
                    isPolish
                      ? 'Jakość materiału pojawi się po zakończeniu generowania insightu.'
                      : 'Material quality will appear after insight generation completes.'
                  }
                />
              )}
            </div>
          );
          break;
        }

        case 'report-pack': {
          const worksheets = reportPack?.worksheets || [];
          const generatedCount = worksheets.filter(
            (worksheet) => worksheet.status === 'generated'
          ).length;
          const degradedCount = worksheets.filter(
            (worksheet) => worksheet.status === 'degraded'
          ).length;
          const partialCount = worksheets.filter(
            (worksheet) => worksheet.status === 'partial'
          ).length;
          const readinessStatus = reportReadiness?.status || 'blocked';
          const readinessLabel =
            readinessStatus === 'ready_for_review'
              ? isPolish
                ? 'PASS: gotowy do review'
                : 'PASS: ready for review'
              : readinessStatus === 'ready_with_warnings'
                ? isPolish
                  ? 'PASS_WITH_P2: wymaga przeglądu'
                  : 'PASS_WITH_P2: review warnings'
                : isPolish
                  ? 'BLOCKED_P1: blokery gotowości'
                  : 'BLOCKED_P1: readiness blockers';
          component = (
            <div className="space-y-5">
              <Callout
                variant={reportPack?.degraded ? 'warning' : 'info'}
                title={isPolish ? 'Pakiet raportu' : 'Report Pack'}
              >
                {isPolish
                  ? 'To jest kontrolowana projekcja insightu do kompletnego pakietu arkuszy raportowych. Arkusze puste lub zdegradowane są pokazane jawnie.'
                  : 'This is the controlled projection from insight into the full report worksheet pack. Empty or degraded worksheets are shown explicitly.'}
              </Callout>

              {reportPack ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Kompletność' : 'Completeness'}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {reportPack.completenessScore}%
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Arkusze' : 'Worksheets'}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {worksheets.length}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Gotowe / częściowe' : 'Generated / partial'}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                        {generatedCount} / {partialCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Zdegradowane' : 'Degraded'}
                      </div>
                      <div
                        className={`mt-1 text-lg font-semibold ${
                          degradedCount > 0
                            ? 'text-amber-600 dark:text-amber-300'
                            : 'text-emerald-600 dark:text-emerald-300'
                        }`}
                      >
                        {degradedCount}
                      </div>
                    </div>
                  </div>

                  <Callout
                    variant={
                      readinessStatus === 'blocked'
                        ? 'warning'
                        : readinessStatus === 'ready_with_warnings'
                          ? 'info'
                          : 'success'
                    }
                    title={isPolish ? 'Gate gotowości raportu' : 'Report readiness gate'}
                    compact
                  >
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">{readinessLabel}</div>
                      <div className="text-sm">
                        {isPolish
                          ? `Kompletność według gate'u: ${reportReadiness?.completenessScore ?? reportPack.completenessScore}%. Blokery: ${
                              reportReadiness?.blockers.length ?? 0
                            }, ostrzeżenia: ${reportReadiness?.warnings.length ?? 0}.`
                          : `Gate completeness: ${reportReadiness?.completenessScore ?? reportPack.completenessScore}%. Blockers: ${
                              reportReadiness?.blockers.length ?? 0
                            }, warnings: ${reportReadiness?.warnings.length ?? 0}.`}
                      </div>
                      {reportReadiness?.blockers.length ? (
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {reportReadiness.blockers.slice(0, 4).map((issue) => (
                            <li key={`${issue.worksheetKey || 'pack'}:${issue.message}`}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSubmitReportForReview}
                          disabled={
                            reportReviewSubmitting ||
                            !reportReadiness ||
                            reportPack.status === 'in_review' ||
                            reportPack.status === 'published'
                          }
                          className="rounded-xl bg-navy-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-navy-900"
                        >
                          {reportReviewSubmitting
                            ? isPolish
                              ? 'Wysyłanie...'
                              : 'Submitting...'
                            : reportPack.status === 'in_review'
                              ? isPolish
                                ? 'W review'
                                : 'In review'
                              : reportPack.status === 'published'
                                ? isPolish
                                  ? 'Opublikowany'
                                  : 'Published'
                                : isPolish
                                  ? 'Wyślij do review'
                                  : 'Submit for review'}
                        </button>
                        <button
                          type="button"
                          onClick={handlePublishReportPack}
                          disabled={
                            reportPublishing ||
                            !reportReadiness ||
                            reportPack.status !== 'in_review' ||
                            reportReadiness.status !== 'ready_for_review'
                          }
                          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                        >
                          {reportPublishing
                            ? isPolish
                              ? 'Publikowanie...'
                              : 'Publishing...'
                            : reportPack.status === 'published'
                              ? isPolish
                                ? 'Opublikowany'
                                : 'Published'
                              : isPolish
                                ? 'Publikuj'
                                : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportReportManifest}
                          disabled={reportExporting || reportPack.status !== 'published'}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-400 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.12] dark:bg-navy-900 dark:text-slate-200"
                        >
                          {reportExporting
                            ? isPolish
                              ? 'Pobieranie...'
                              : 'Downloading...'
                            : isPolish
                              ? 'Pobierz manifest'
                              : 'Download manifest'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateReportRevision}
                          disabled={reportRevisionCreating || reportPack.status !== 'published'}
                          className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
                        >
                          {reportRevisionCreating
                            ? isPolish
                              ? 'Tworzenie draftu...'
                              : 'Creating draft...'
                            : isPolish
                              ? 'Nowy draft z publikacji'
                              : 'New draft from published'}
                        </button>
                        {reportReadiness?.status === 'blocked' && (
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            {isPolish
                              ? 'Backend zablokuje przejście, dopóki blockery nie znikną.'
                              : 'Backend will block the transition until blockers are resolved.'}
                          </span>
                        )}
                        {reportPack.status === 'draft' &&
                          reportReadiness?.status === 'ready_for_review' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {isPolish
                                ? 'Publikacja wymaga najpierw review.'
                                : 'Publish requires review first.'}
                            </span>
                          )}
                        {reportPack.status === 'in_review' &&
                          reportReadiness?.status !== 'ready_for_review' && (
                            <span className="text-xs text-amber-700 dark:text-amber-300">
                              {isPolish
                                ? 'Publikacja wymaga pełnego PASS bez ostrzeżeń.'
                                : 'Publish requires full PASS with no warnings.'}
                            </span>
                          )}
                      </div>
                      {!reportReadiness && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {isPolish
                            ? 'Gate jest chwilowo niedostępny; nie traktuj pakietu jako gotowego bez ponownego odświeżenia.'
                            : 'The gate is temporarily unavailable; do not treat this pack as ready until refreshed.'}
                        </div>
                      )}
                    </div>
                  </Callout>

                  {reportPack.degradedReasons.length > 0 && (
                    <Callout
                      variant="warning"
                      title={isPolish ? 'Ograniczenia raportu' : 'Report limitations'}
                      compact
                    >
                      <ul className="list-disc list-inside space-y-1">
                        {reportPack.degradedReasons.map((reason) => (
                          <li key={reason} className="text-sm">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </Callout>
                  )}

                  {reportPack.status === 'published' && (
                    <Callout
                      variant="success"
                      title={isPolish ? 'Raport opublikowany' : 'Report published'}
                      compact
                    >
                      {isPolish
                        ? 'Pakiet jest opublikowany i zablokowany do edycji. Zmiany wymagają nowej wersji/draftu, aby zachować audytowalność.'
                        : 'This pack is published and locked for editing. Changes require a new version/draft to preserve auditability.'}
                    </Callout>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {worksheets.map((worksheet) => (
                      <div
                        key={worksheet.key}
                        className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-white/[0.08] dark:bg-navy-900/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {worksheet.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {worksheet.rows.length} {isPolish ? 'wierszy' : 'rows'} ·{' '}
                              {worksheet.completenessScore}%
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              worksheet.status === 'generated'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : worksheet.status === 'degraded'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : worksheet.status === 'partial'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {worksheet.status}
                          </span>
                        </div>
                        {worksheet.warnings.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                            {worksheet.warnings.slice(0, 2).map((warning) => (
                              <div key={warning}>{warning}</div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(
                            [
                              {
                                status: 'generated' as const,
                                label: isPolish ? 'Gotowy' : 'Generated',
                                score: 100,
                                warnings: [],
                              },
                              {
                                status: 'partial' as const,
                                label: isPolish ? 'Częściowy' : 'Partial',
                                score: Math.max(worksheet.completenessScore || 70, 70),
                                warnings:
                                  worksheet.warnings.length > 0
                                    ? worksheet.warnings
                                    : [
                                        isPolish
                                          ? 'Arkusz wymaga uzupełnienia operatora.'
                                          : 'Worksheet needs operator completion.',
                                      ],
                              },
                              {
                                status: 'degraded' as const,
                                label: isPolish ? 'Zdegradowany' : 'Degraded',
                                score: Math.min(worksheet.completenessScore || 40, 40),
                                warnings:
                                  worksheet.warnings.length > 0
                                    ? worksheet.warnings
                                    : [
                                        isPolish
                                          ? 'Arkusz oznaczony jako zdegradowany przez operatora.'
                                          : 'Worksheet marked degraded by operator.',
                                      ],
                              },
                            ] satisfies Array<{
                              status: V8InterviewReportWorksheetStatus;
                              label: string;
                              score: number;
                              warnings: string[];
                            }>
                          ).map((action) => {
                            const loading =
                              worksheetActionLoadingKey === `${worksheet.key}:${action.status}`;
                            return (
                              <button
                                key={action.status}
                                type="button"
                                disabled={
                                  loading ||
                                  reportPack.status === 'published' ||
                                  worksheet.status === action.status
                                }
                                onClick={() =>
                                  handleWorksheetStatusUpdate(
                                    worksheet.key,
                                    action.status,
                                    action.score,
                                    action.warnings
                                  )
                                }
                                className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:border-primary-400 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-slate-300"
                              >
                                {loading ? (isPolish ? 'Zapis...' : 'Saving...') : action.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyStateInline
                  icon={FileText}
                  message={
                    isPolish
                      ? 'Pakiet raportu nie jest jeszcze dostępny dla tego insightu.'
                      : 'Report pack is not available for this insight yet.'
                  }
                />
              )}
            </div>
          );
          break;
        }

        case 'source-pack':
          component = (
            <div className="space-y-5">
              <Callout
                variant={sourcePack?.degraded ? 'warning' : 'purple'}
                title={isPolish ? 'Source / Evidence Pack' : 'Source / Evidence Pack'}
              >
                {isPolish
                  ? 'To jest jawny pakiet źródeł dla insightu: sesje, pytania, odpowiedzi, respondent/rola i wskaźniki dowodowe. Brak dowodu jest pokazany jako stan zdegradowany.'
                  : 'This is the explicit source pack for the insight: sessions, questions, answers, respondent/role, and evidence pointers. Missing evidence is shown as degraded state.'}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Sesje' : 'Sessions'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {sourcePack?.sourceSessionIds.length || insight?.sourceSessionIds?.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Fragmenty' : 'Fragments'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {sourcePack?.entries.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Aktywne dowody' : 'Active evidence'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {sourcePack?.activePointerCount ?? findingsSummary.activeEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Stan' : 'State'}
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold ${
                      sourcePack?.degraded
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    {sourcePack?.degraded
                      ? isPolish
                        ? 'Zdegradowany'
                        : 'Degraded'
                      : isPolish
                        ? 'Audytowalny'
                        : 'Auditable'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Readback OK' : 'Readback OK'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                    {readbackSummary.confirmed}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Zakwestionowane' : 'Challenged'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-red-600 dark:text-red-300">
                    {readbackSummary.challenged}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Potrzeba evidence' : 'Needs evidence'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-300">
                    {readbackSummary.needsMoreEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Niepotwierdzone' : 'Unresolved'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {readbackSummary.unresolved}
                  </div>
                </div>
              </div>

              {(sourcePack?.degradedReasons || []).length > 0 && (
                <Callout
                  variant="warning"
                  title={isPolish ? 'Braki źródeł' : 'Source gaps'}
                  compact
                >
                  <ul className="list-disc list-inside space-y-1">
                    {(sourcePack?.degradedReasons || []).map((reason) => (
                      <li key={reason} className="text-sm">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              {sourcePack?.entries.length ? (
                <div className="space-y-3">
                  {sourcePack.entries.map((entry) => (
                    <div
                      key={entry.answerId}
                      className="rounded-2xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 px-4 py-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {entry.questionText || entry.answerId}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {[
                              entry.respondentLabel,
                              entry.respondentRole,
                              entry.department,
                              entry.sourceSessionId,
                            ]
                              .filter(Boolean)
                              .join(' · ') ||
                              (isPolish ? 'Brak metadanych respondenta' : 'No respondent metadata')}
                          </div>
                        </div>
                        {entry.degradedReason ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
                            <AlertTriangle size={10} />
                            {isPolish ? 'Brak wskaźnika' : 'Missing pointer'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium">
                            <CheckCircle2 size={10} />
                            {entry.capturedPointers.length} {isPolish ? 'dow.' : 'ev.'}
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-navy-900/50 px-3 py-2 text-xs italic text-slate-600 dark:text-slate-300">
                        "{entry.answerSnippet}"
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ...entry.linkedThemes,
                          ...entry.linkedIssues,
                          ...entry.linkedOpportunities,
                        ].map((label) => (
                          <span
                            key={label}
                            className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Link2}
                  message={isPolish ? 'Brak pakietu źródeł' : 'No source pack available'}
                  hint={
                    isPolish
                      ? 'Pakiet pojawi się po wygenerowaniu insightu i backfillu findingów.'
                      : 'Source pack appears after insight generation and finding backfill.'
                  }
                />
              )}
            </div>
          );
          break;

        case 'analysis-matrix': {
          const stakeholderLenses = analysis?.people.stakeholderLenses || [];
          const sessionLenses = analysis?.people.sessionLenses || [];
          const cellMeta = (cell?: V8InsightAnalysisMatrixCell) => {
            switch (cell?.state) {
              case 'supported':
                return {
                  label: isPolish ? 'Wspiera' : 'Supports',
                  className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                };
              case 'contradicted':
                return {
                  label: isPolish ? 'Sprzeczne' : 'Contradicted',
                  className: 'bg-red-500/10 text-red-700 dark:text-red-300',
                };
              case 'local_only':
                return {
                  label: isPolish ? 'Lokalny sygnał' : 'Local only',
                  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                };
              default:
                return {
                  label: isPolish ? 'Brak sygnału' : 'Not observed',
                  className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
                };
            }
          };

          component = (
            <div className="space-y-5">
              <Callout
                variant="info"
                title={
                  isPolish
                    ? 'Kanon analizy: osoba x temat x zakres'
                    : 'Analysis canon: person x topic x scope'
                }
              >
                {isPolish
                  ? 'Ta warstwa nie tworzy nowych truth objectów. Pokazuje, jak persisted findings rozkładają się po rolach, osobach i szerokości pokrycia.'
                  : 'This layer does not create new truth objects. It shows how persisted findings distribute across roles, people, and coverage width.'}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Posture' : 'Posture'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {analysis?.scope.posture === 'organization_synthesis'
                      ? isPolish
                        ? 'Szeroka synteza'
                        : 'Organization synthesis'
                      : analysis?.scope.posture === 'cross_perspective'
                        ? isPolish
                          ? 'Wiele perspektyw'
                          : 'Cross perspective'
                        : isPolish
                          ? 'Jedna perspektywa'
                          : 'Single perspective'}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Sesje źródłowe' : 'Source sessions'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {analysis?.scope.sourceSessionCount || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Lenses' : 'Lenses'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {analysis?.scope.distinctStakeholderCount || 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Consensus' : 'Consensus'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {consensusTopics.length}
                  </div>
                </div>
              </div>

              {(analysis?.synthesis.coverageGaps || []).length > 0 && (
                <Callout variant="warning" title={isPolish ? 'Luki pokrycia' : 'Coverage gaps'}>
                  <ul className="list-disc list-inside space-y-1">
                    {(analysis?.synthesis.coverageGaps || []).map((gap) => (
                      <li key={gap} className="text-sm">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              <div className="rounded-2xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 px-4 py-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                  <div className="inline-flex rounded-full bg-slate-100 dark:bg-navy-900/60 p-1">
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('stakeholder')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'stakeholder'
                          ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPolish ? 'Stakeholder lenses' : 'Stakeholder lenses'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('session')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'session'
                          ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPolish ? 'Sesje / osoby' : 'Sessions / people'}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2 xl:ml-auto">
                    <select
                      value={analysisRoleFilter}
                      onChange={(e) => setAnalysisRoleFilter(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white dark:bg-navy-900/50 px-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">{isPolish ? 'Wszystkie role' : 'All roles'}</option>
                      {analysisRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={analysisDepartmentFilter}
                      onChange={(e) => setAnalysisDepartmentFilter(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white dark:bg-navy-900/50 px-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">
                        {isPolish ? 'Wszystkie działy' : 'All departments'}
                      </option>
                      {analysisDepartmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Consensus topics' : 'Consensus topics'}
                  </div>
                  {consensusTopics.length > 0 ? (
                    consensusTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl bg-emerald-500/[0.05] px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {topic.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {topic.supportingStakeholderLabels.join(', ') ||
                            (isPolish ? 'Brak lensów' : 'No lenses')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={CheckCircle2}
                      message={
                        isPolish ? 'Brak potwierdzonego konsensusu' : 'No confirmed consensus yet'
                      }
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Local-only signals' : 'Local-only signals'}
                  </div>
                  {localOnlyTopics.length > 0 ? (
                    localOnlyTopics.slice(0, 6).map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-2xl bg-amber-500/[0.05] px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {topic.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {topic.supportingSessionIds.length === 1
                            ? sessionLenses.find((lens) =>
                                lens.sessionIds.includes(topic.supportingSessionIds[0])
                              )?.label || topic.supportingSessionIds[0]
                            : `${topic.supportingSessionIds.length} ${isPolish ? 'sesje' : 'sessions'}`}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Radio}
                      message={isPolish ? 'Brak lokalnych sygnałów' : 'No local-only signals'}
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {analysisLensMode === 'stakeholder'
                      ? isPolish
                        ? 'Stakeholder lenses'
                        : 'Stakeholder lenses'
                      : isPolish
                        ? 'Sesje / osoby'
                        : 'Sessions / people'}
                  </div>
                  {(analysisLensMode === 'stakeholder'
                    ? filteredStakeholderAnalysisLenses
                    : filteredSessionAnalysisLenses
                  ).length > 0 ? (
                    (analysisLensMode === 'stakeholder'
                      ? filteredStakeholderAnalysisLenses
                      : filteredSessionAnalysisLenses
                    ).map((lens) => (
                      <div
                        key={lens.id}
                        className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {lens.label}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                          {lens.localSummary}
                          {(lens.role || lens.department) && (
                            <div>{[lens.role, lens.department].filter(Boolean).join(' · ')}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyStateInline
                      icon={Users}
                      message={isPolish ? 'Brak zbudowanych lensów' : 'No lenses built yet'}
                    />
                  )}
                </div>
              </div>

              {contradictedTopics.length > 0 && (
                <Callout
                  variant="critical"
                  title={
                    isPolish
                      ? 'Tematy sprzeczne między perspektywami'
                      : 'Topics with cross-perspective contradiction'
                  }
                >
                  <ul className="list-disc list-inside space-y-1">
                    {contradictedTopics.map((topic) => (
                      <li key={topic.id} className="text-sm">
                        <span className="font-medium">{topic.label}</span>
                        {topic.supportingStakeholderLabels.length > 0 && (
                          <> ({topic.supportingStakeholderLabels.join(', ')})</>
                        )}
                      </li>
                    ))}
                  </ul>
                </Callout>
              )}

              {visibleAnalysisTopicRows.length > 0 && activeAnalysisColumns.length > 0 ? (
                <div className="rounded-2xl border border-slate-200/70 dark:border-navy-700/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200/70 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/50">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {analysisLensMode === 'stakeholder'
                        ? isPolish
                          ? 'Macierz temat x stakeholder lens'
                          : 'Topic x stakeholder lens matrix'
                        : isPolish
                          ? 'Macierz temat x sesja/osoba'
                          : 'Topic x session/person matrix'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {isPolish
                        ? 'Komórki pokazują, gdzie finding jest wspierany, lokalny lub sprzeczny.'
                        : 'Cells show where a finding is supported, local-only, or contradicted.'}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-white/70 dark:bg-navy-900/30">
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Temat' : 'Topic'}
                          </th>
                          {activeAnalysisColumns.map((column) => (
                            <th
                              key={column.id}
                              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500"
                            >
                              {column.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAnalysisTopicRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-200/60 dark:border-navy-700/50"
                          >
                            <td className="px-4 py-3 align-top min-w-[220px]">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {row.label}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {analysisTopicsById[row.id]?.kind}
                              </div>
                              {analysisTopicsById[row.id]?.perspectiveLabels?.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {analysisTopicsById[row.id]?.perspectiveLabels.map((label) => (
                                    <span
                                      key={label}
                                      className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {analysisTopicsById[row.id]?.divergenceNote && (
                                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                  {analysisTopicsById[row.id]?.divergenceNote}
                                </div>
                              )}
                            </td>
                            {activeAnalysisColumns.map((column) => {
                              const cell = activeAnalysisCellMap.get(`${row.id}:${column.id}`);
                              const meta = cellMeta(cell);
                              return (
                                <td key={column.id} className="px-3 py-3 align-top">
                                  <div
                                    className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium ${meta.className}`}
                                  >
                                    {meta.label}
                                  </div>
                                  {cell && cell.evidenceCount > 0 && (
                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                      {cell.evidenceCount} {isPolish ? 'dow.' : 'ev.'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <EmptyStateInline
                  icon={BarChart3}
                  message={
                    isPolish
                      ? 'Brak danych po obecnych filtrach albo macierz nie jest jeszcze gotowa.'
                      : 'No data for the current filters or the matrix is not ready yet.'
                  }
                />
              )}
            </div>
          );
          break;
        }

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
                  {v6Themes.map((theme, idx) => {
                    const persistedFinding = findingsBySourceKey[`theme:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      theme.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      theme.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
                    const confidenceBadgeMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `theme-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-slate-50/90 dark:bg-navy-900/50 px-4 py-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {theme.title}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
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
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confidenceBadgeMap[findingConfidence].bg}`}
                              >
                                {isPolish
                                  ? confidenceBadgeMap[findingConfidence].labelPl
                                  : confidenceBadgeMap[findingConfidence].label}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {isPolish
                              ? 'Wykryto sprzeczność w danych — zweryfikuj przed publikacją'
                              : 'Contradiction detected in data — verify before publishing'}
                          </div>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {theme.description}
                        </p>
                        {theme.perspective_labels?.length || theme.divergence_note ? (
                          <div className="space-y-2">
                            {theme.perspective_labels && theme.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {theme.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {theme.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {theme.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-slate-200/60 dark:border-navy-700/50 rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-navy-800/30 transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {isPolish ? 'Limity i założenia' : 'Limits & assumptions'}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li
                                      key={li}
                                      className="text-xs italic text-slate-500 dark:text-slate-400"
                                    >
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Brak określonych limitów' : 'No limits specified'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                              <Target size={10} />
                              {isPolish
                                ? `P10: ${activePointerCount} dow.`
                                : `P10: ${activePointerCount} ev.`}
                            </span>
                          )}
                          {theme.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
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
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: theme.title,
                                description: theme.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'theme',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {isPolish ? 'Inicjatywa' : 'Handoff'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                    const persistedFinding = findingsBySourceKey[`issue:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      issue.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      issue.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
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
                    const confMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `issue-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border-l-4 ${severityStyles} px-4 py-4 space-y-2`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {issue.title}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${severityBadge}`}
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
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confMap[findingConfidence].bg}`}
                              >
                                {isPolish
                                  ? confMap[findingConfidence].labelPl
                                  : confMap[findingConfidence].label}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {isPolish
                              ? 'Wykryto sprzeczność w danych — zweryfikuj przed publikacją'
                              : 'Contradiction detected in data — verify before publishing'}
                          </div>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {issue.description}
                        </p>
                        {issue.perspective_labels?.length || issue.divergence_note ? (
                          <div className="space-y-2">
                            {issue.perspective_labels && issue.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {issue.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {issue.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {issue.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-slate-200/60 dark:border-navy-700/50 rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-navy-800/30 transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {isPolish ? 'Limity i założenia' : 'Limits & assumptions'}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li
                                      key={li}
                                      className="text-xs italic text-slate-500 dark:text-slate-400"
                                    >
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Brak określonych limitów' : 'No limits specified'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                              <Target size={10} />
                              {isPolish
                                ? `P10: ${activePointerCount} dow.`
                                : `P10: ${activePointerCount} ev.`}
                            </span>
                          )}
                          {issue.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
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
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: issue.title,
                                description: issue.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'issue',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {isPolish ? 'Inicjatywa' : 'Handoff'}
                          </button>
                        </div>
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
                    const persistedFinding = findingsBySourceKey[`opportunity:${idx}`];
                    const findingConfidence = (persistedFinding?.confidence_level ||
                      opp.confidence) as P10ConfidenceLevel | undefined;
                    const findingLimits =
                      persistedFinding?.limits
                        ?.split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean) ||
                      opp.limits ||
                      [];
                    const activePointerCount =
                      persistedFinding?.evidence_pointers.filter((pointer) => !pointer.isTombstone)
                        .length || 0;
                    const impactBadge =
                      opp.impact === 'high'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : opp.impact === 'medium'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-500/15 text-slate-500 dark:text-slate-400';
                    const confMap: Record<
                      P10ConfidenceLevel,
                      { bg: string; label: string; labelPl: string }
                    > = {
                      high: {
                        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        label: 'High confidence',
                        labelPl: 'Wysoka pewność',
                      },
                      medium: {
                        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                        label: 'Medium confidence',
                        labelPl: 'Średnia pewność',
                      },
                      low: {
                        bg: 'bg-slate-500/15 text-slate-500 dark:text-slate-400',
                        label: 'Hypothesis',
                        labelPl: 'Hipoteza',
                      },
                      insufficient: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Insufficient data',
                        labelPl: 'Niewystarczające dane',
                      },
                      contradicted: {
                        bg: 'bg-red-500/15 text-red-600 dark:text-red-400',
                        label: 'Contradiction',
                        labelPl: 'Sprzeczność',
                      },
                    };
                    const limitsKey = `opp-${idx}`;
                    const limitsExpanded = expandedLimits.has(limitsKey);
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06] px-4 py-4 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {opp.title}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${impactBadge}`}
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
                            {findingConfidence && (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${confMap[findingConfidence].bg}`}
                              >
                                {isPolish
                                  ? confMap[findingConfidence].labelPl
                                  : confMap[findingConfidence].label}
                              </span>
                            )}
                          </div>
                        </div>
                        {findingConfidence === 'contradicted' && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                            <AlertCircle size={14} />
                            {isPolish
                              ? 'Wykryto sprzeczność w danych — zweryfikuj przed publikacją'
                              : 'Contradiction detected in data — verify before publishing'}
                          </div>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {opp.description}
                        </p>
                        {opp.perspective_labels?.length || opp.divergence_note ? (
                          <div className="space-y-2">
                            {opp.perspective_labels && opp.perspective_labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {opp.perspective_labels.map((label) => (
                                  <span
                                    key={label}
                                    className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {opp.divergence_note && (
                              <div className="text-xs text-amber-700 dark:text-amber-300">
                                {opp.divergence_note}
                              </div>
                            )}
                          </div>
                        ) : null}
                        <div className="border border-slate-200/60 dark:border-navy-700/50 rounded-lg">
                          <button
                            onClick={() => toggleLimitsExpand(limitsKey)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-navy-800/30 transition-colors rounded-lg"
                          >
                            <AlertTriangle size={12} />
                            <span className="font-medium">
                              {isPolish ? 'Limity i założenia' : 'Limits & assumptions'}
                            </span>
                            {limitsExpanded ? (
                              <ChevronUp size={12} className="ml-auto" />
                            ) : (
                              <ChevronDown size={12} className="ml-auto" />
                            )}
                          </button>
                          {limitsExpanded && (
                            <div className="px-3 pb-2">
                              {findingLimits.length > 0 ? (
                                <ul className="space-y-1">
                                  {findingLimits.map((limit, li) => (
                                    <li
                                      key={li}
                                      className="text-xs italic text-slate-500 dark:text-slate-400"
                                    >
                                      {limit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs italic text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Brak określonych limitów' : 'No limits specified'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {persistedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                              <Target size={10} />
                              {isPolish
                                ? `P10: ${activePointerCount} dow.`
                                : `P10: ${activePointerCount} ev.`}
                            </span>
                          )}
                          {opp.evidence_refs?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
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
                          <button
                            onClick={() =>
                              handleOpenHandoff({
                                findingId: persistedFinding?.id,
                                title: opp.title,
                                description: opp.description,
                                confidence: findingConfidence,
                                limits: findingLimits,
                                sectionType: 'opportunity',
                                index: idx,
                              })
                            }
                            disabled={!persistedFinding}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ExternalLink size={10} />
                            {isPolish ? 'Inicjatywa' : 'Handoff'}
                          </button>
                        </div>
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

        case 'evidence-map': {
          const entriesWithNoPointers = v6EvidenceMap.filter(
            (e) =>
              (!e.evidence_pointers || e.evidence_pointers.length === 0) &&
              (sourcePackByAnswerId[e.answer_id]?.capturedPointers.length || 0) === 0
          );
          component = (
            <div className="space-y-4">
              <Callout variant="purple" title={isPolish ? 'Mapa dowodów' : 'Evidence Map'} compact>
                {isPolish
                  ? 'Tabela łączy odpowiedzi źródłowe z tematami i problemami. Kliknij wiersz, aby zobaczyć pełny cytat.'
                  : 'This table links source answers to themes and issues. Click a row to see the full quote.'}
              </Callout>
              {entriesWithNoPointers.length > 0 && (
                <Callout
                  variant="warning"
                  title={isPolish ? 'Brakujące dowody' : 'Missing evidence'}
                  compact
                >
                  {isPolish
                    ? `${entriesWithNoPointers.length} wpisów nie ma wskaźników dowodowych — publikacja zablokowana do uzupełnienia.`
                    : `${entriesWithNoPointers.length} entries have no evidence pointers — publish blocked until resolved.`}
                </Callout>
              )}
              {v6EvidenceMap.some(
                (e) => e.answer_snippet === '[REDACTED]' || e.answer_snippet?.includes('[redacted]')
              ) && (
                <Callout
                  variant="critical"
                  title={isPolish ? 'Zredagowane dane' : 'Redacted data'}
                  compact
                >
                  {isPolish
                    ? 'Niektóre odpowiedzi źródłowe zostały zredagowane. Wskaźniki dowodowe zostają w audycie, ale treść jest niedostępna.'
                    : 'Some source answers have been redacted. Evidence pointers remain for audit but content is unavailable.'}
                </Callout>
              )}
              {v6EvidenceMap.length === 0 ? (
                <EmptyStateInline
                  icon={MapIcon}
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
                        render: (row) => {
                          const hasPointers =
                            (row.evidence_pointers && row.evidence_pointers.length > 0) ||
                            (sourcePackByAnswerId[row.answer_id]?.capturedPointers.length || 0) > 0;
                          return (
                            <div className="space-y-1">
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
                              {!hasPointers && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  <AlertTriangle size={10} />
                                  {isPolish
                                    ? 'Brak dowodu — publikacja zablokowana'
                                    : 'Missing evidence — publish blocked'}
                                </div>
                              )}
                            </div>
                          );
                        },
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
        }

        case 'candidate-triage': {
          const triageBadge = (
            status: V8InsightCandidate['triage_status']
          ): { label: string; className: string } => {
            switch (status) {
              case 'ready_for_review':
                return {
                  label: isPolish ? 'Gotowe do recenzji' : 'Ready for review',
                  className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                };
              case 'needs_evidence':
                return {
                  label: isPolish ? 'Brak dowodów' : 'Needs evidence',
                  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                };
              case 'needs_split':
                return {
                  label: isPolish ? 'Do rozbicia' : 'Needs split',
                  className: 'bg-red-500/10 text-red-700 dark:text-red-300',
                };
              case 'rejected':
                return {
                  label: isPolish ? 'Odrzucony' : 'Rejected',
                  className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
                };
              case 'promoted':
                return {
                  label: isPolish ? 'Promowany' : 'Promoted',
                  className: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
                };
              default:
                return {
                  label: isPolish ? 'Kandydat' : 'Candidate',
                  className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                };
            }
          };

          component = (
            <div className="space-y-5">
              <Callout
                variant="warning"
                title={
                  isPolish
                    ? 'Warstwa robocza przed findingiem P10'
                    : 'Working layer before a P10 finding'
                }
              >
                {isPolish
                  ? 'Kandydaci nie są publishable truth. To przestrzeń operatora do decyzji: dopnij evidence, rozbij sprzeczność, przygotuj do recenzji albo promuj do findingu.'
                  : 'Candidates are not publishable truth. This is the operator layer to add evidence, split contradictions, prepare for review, or promote into a finding.'}
              </Callout>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Kandydaci' : 'Candidates'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {candidateSummary.total}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Ready' : 'Ready'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                    {candidateSummary.ready}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Braki evidence' : 'Needs evidence'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-300">
                    {candidateSummary.needsEvidence}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Do rozbicia' : 'Needs split'}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-red-600 dark:text-red-300">
                    {candidateSummary.needsSplit}
                  </div>
                </div>
              </div>

              {candidates.length > 0 ? (
                <div className="space-y-3">
                  {candidates.map((candidate) => {
                    const statusMeta = triageBadge(candidate.triage_status);
                    const linkedTopic = candidate.source_key
                      ? analysis?.topics.find((topic) => topic.sourceKey === candidate.source_key)
                      : null;
                    const linkedFinding = candidate.linked_finding_id
                      ? findings.find((finding) => finding.id === candidate.linked_finding_id)
                      : null;
                    const isBusy = candidateActionLoadingId === candidate.id;
                    return (
                      <div
                        key={candidate.id}
                        className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {candidate.candidate_statement}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-300">
                                {candidate.confidence_hint}
                              </span>
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-300">
                                {candidate.followup_type}
                              </span>
                              {candidate.source_section_type && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-300">
                                  {candidate.source_section_type}
                                </span>
                              )}
                            </div>
                          </div>
                          {linkedFinding && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-medium">
                              <Target size={10} />
                              {isPolish ? 'Powiązany finding' : 'Linked finding'}
                            </span>
                          )}
                        </div>

                        {candidate.rationale && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                            {candidate.rationale}
                          </div>
                        )}

                        {linkedTopic?.divergenceNote && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            {linkedTopic.divergenceNote}
                          </div>
                        )}

                        <Callout
                          variant={
                            candidate.triage_status === 'needs_split'
                              ? 'critical'
                              : candidate.triage_status === 'needs_evidence'
                                ? 'warning'
                                : 'info'
                          }
                          title={isPolish ? 'Rekomendowany następny krok' : 'Recommended next step'}
                          compact
                        >
                          {candidate.followup_recommendation}
                        </Callout>

                        {linkedTopic?.supportingStakeholderLabels?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedTopic.supportingStakeholderLabels.map((label) => (
                              <span
                                key={label}
                                className="inline-flex px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {linkedFinding && (
                          <div className="rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 px-3 py-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                  {isPolish ? 'Client readback' : 'Client readback'}
                                </div>
                                <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                  {linkedFinding.readback_status}
                                  {linkedFinding.readback_summary
                                    ? ` · ${linkedFinding.readback_summary}`
                                    : ''}
                                </div>
                              </div>
                              {readbackLoadingId === linkedFinding.id && (
                                <Loader2
                                  size={14}
                                  className="animate-spin text-slate-400 flex-shrink-0"
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'shared_for_readback')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <Send size={12} />
                                {isPolish ? 'Wyślij readback' : 'Share readback'}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'confirmed_by_client')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <CheckCircle2 size={12} />
                                {isPolish ? 'Potwierdzone' : 'Confirmed'}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'challenged_by_client')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <AlertCircle size={12} />
                                {isPolish ? 'Zakwestionowane' : 'Challenged'}
                              </button>
                              <button
                                onClick={() =>
                                  handleReadbackStatus(linkedFinding, 'needs_more_evidence')
                                }
                                disabled={readbackLoadingId === linkedFinding.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                <AlertTriangle size={12} />
                                {isPolish ? 'Więcej evidence' : 'Needs evidence'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleCandidateAction(candidate, 'mark_needs_evidence')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <AlertTriangle size={12} />
                            )}
                            {isPolish ? 'Needs evidence' : 'Needs evidence'}
                          </button>
                          <button
                            onClick={() => handleCandidateAction(candidate, 'mark_needs_split')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {isPolish ? 'Do rozbicia' : 'Needs split'}
                          </button>
                          <button
                            onClick={() =>
                              handleCandidateAction(candidate, 'mark_ready_for_review')
                            }
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            {isPolish ? 'Gotowe do recenzji' : 'Ready for review'}
                          </button>
                          <button
                            onClick={() => handleCandidateAction(candidate, 'reject')}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20 text-xs font-medium disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <X size={12} />
                            )}
                            {isPolish ? 'Odrzuć' : 'Reject'}
                          </button>
                          {candidate.triage_status !== 'promoted' &&
                            candidate.triage_status !== 'rejected' && (
                              <button
                                onClick={() =>
                                  handleCandidateAction(candidate, 'promote_to_finding')
                                }
                                disabled={isBusy || candidate.triage_status !== 'ready_for_review'}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 text-xs font-medium disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Target size={12} />
                                )}
                                {candidate.triage_status === 'ready_for_review'
                                  ? isPolish
                                    ? 'Promuj do findingu'
                                    : 'Promote to finding'
                                  : isPolish
                                    ? 'Najpierw recenzja'
                                    : 'Review first'}
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Eye}
                  message={
                    isPolish ? 'Brak kandydatów do triage' : 'No candidates available for triage'
                  }
                />
              )}
            </div>
          );
          break;
        }

        case 'people': {
          component = (
            <div className="space-y-5">
              <Callout
                variant="info"
                title={
                  isPolish
                    ? 'Czytaj insight przez perspektywy ludzi'
                    : 'Read the insight through people perspectives'
                }
              >
                {isPolish
                  ? 'Ta sekcja pokazuje, które tematy wspiera dana osoba lub stakeholder lens i gdzie pojawiają się lokalne albo sprzeczne spojrzenia.'
                  : 'This section shows which topics are supported by each person or stakeholder lens and where local or contradictory views appear.'}
              </Callout>

              <div className="rounded-2xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/30 px-4 py-4">
                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                  <div className="inline-flex rounded-full bg-slate-100 dark:bg-navy-900/60 p-1">
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('stakeholder')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'stakeholder'
                          ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPolish ? 'Stakeholder lenses' : 'Stakeholder lenses'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisLensMode('session')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        analysisLensMode === 'session'
                          ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isPolish ? 'Sesje / osoby' : 'Sessions / people'}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2 xl:ml-auto">
                    <select
                      value={analysisRoleFilter}
                      onChange={(e) => setAnalysisRoleFilter(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white dark:bg-navy-900/50 px-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">{isPolish ? 'Wszystkie role' : 'All roles'}</option>
                      {analysisRoleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={analysisDepartmentFilter}
                      onChange={(e) => setAnalysisDepartmentFilter(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200/70 dark:border-navy-700/60 bg-white dark:bg-navy-900/50 px-3 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <option value="all">
                        {isPolish ? 'Wszystkie działy' : 'All departments'}
                      </option>
                      {analysisDepartmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {visiblePeopleLenses.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {visiblePeopleLenses.map((lens) => {
                    const supportedTopics = lens.supportedTopicIds
                      .map((id) => analysisTopicsById[id])
                      .filter(Boolean);
                    const contradictedSupportedTopics = supportedTopics.filter(
                      (topic) => topic.isContradicted
                    );
                    const localSupportedTopics = supportedTopics.filter(
                      (topic) => !topic.isContradicted && topic.supportingSessionIds.length <= 1
                    );

                    return (
                      <div
                        key={lens.id}
                        className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 px-4 py-4 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {lens.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {[lens.role, lens.department].filter(Boolean).join(' · ') ||
                                (analysisLensMode === 'session'
                                  ? isPolish
                                    ? 'Sesja źródłowa'
                                    : 'Source session'
                                  : isPolish
                                    ? 'Stakeholder lens'
                                    : 'Stakeholder lens')}
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                            <Target size={10} />
                            {supportedTopics.length} {isPolish ? 'tem.' : 'topics'}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {lens.localSummary}
                        </div>

                        {contradictedSupportedTopics.length > 0 && (
                          <Callout
                            variant="critical"
                            title={
                              isPolish
                                ? 'Sprzeczne tematy dla tej perspektywy'
                                : 'Contradicted topics for this perspective'
                            }
                            compact
                          >
                            <ul className="list-disc list-inside space-y-1">
                              {contradictedSupportedTopics.map((topic) => (
                                <li key={topic.id} className="text-sm">
                                  {topic.label}
                                </li>
                              ))}
                            </ul>
                          </Callout>
                        )}

                        <div className="space-y-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Wspierane tematy' : 'Supported topics'}
                          </div>
                          {supportedTopics.length > 0 ? (
                            supportedTopics.map((topic) => (
                              <div
                                key={topic.id}
                                className="rounded-xl bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/50 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {topic.label}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        topic.isContradicted
                                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                          : topic.supportingSessionIds.length <= 1
                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      }`}
                                    >
                                      {topic.isContradicted
                                        ? isPolish
                                          ? 'Sprzeczne'
                                          : 'Contradicted'
                                        : topic.supportingSessionIds.length <= 1
                                          ? isPolish
                                            ? 'Lokalne'
                                            : 'Local'
                                          : isPolish
                                            ? 'Wspólne'
                                            : 'Shared'}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {topic.kind} · {topic.confidenceLevel} · {topic.evidenceCount}{' '}
                                  {isPolish ? 'dow.' : 'ev.'}
                                </div>
                                {topic.divergenceNote && (
                                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                    {topic.divergenceNote}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <EmptyStateInline
                              icon={Users}
                              message={
                                isPolish
                                  ? 'Brak wspieranych tematów dla tej perspektywy'
                                  : 'No supported topics for this perspective'
                              }
                            />
                          )}
                        </div>

                        {localSupportedTopics.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                              {isPolish ? 'Lokalne sygnały' : 'Local signals'}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {localSupportedTopics.map((topic) => (
                                <span
                                  key={topic.id}
                                  className="inline-flex px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium"
                                >
                                  {topic.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyStateInline
                  icon={Users}
                  message={
                    isPolish
                      ? 'Brak perspektyw dla obecnych filtrów'
                      : 'No perspectives for the current filters'
                  }
                />
              )}
            </div>
          );
          break;
        }

        case 'traceability': {
          const loadedSessionIds = new Set(sourceSessions.map((s) => s.id));
          const unavailableSessionIds = (insight?.sourceSessionIds || []).filter(
            (id) => !loadedSessionIds.has(id)
          );
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

              {traceabilityRows.length === 0 && unavailableSessionIds.length === 0 ? (
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
                  {unavailableSessionIds.map((sessionId) => (
                    <div
                      key={sessionId}
                      className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 border border-dashed border-slate-300 dark:border-navy-600 px-4 py-4"
                    >
                      <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                        <Link2 size={16} className="opacity-50" />
                        <div>
                          <div className="text-sm font-medium">
                            {isPolish ? 'Źródło niedostępne' : 'Source unavailable'}
                          </div>
                          <div className="text-xs">
                            {isPolish
                              ? `Sesja ${sessionId.slice(0, 12)}… nie załadowała się`
                              : `Session ${sessionId.slice(0, 12)}… failed to load`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

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
        'truth-review-summary': truthReviewSummary.publishBlockers.length || undefined,
        'report-pack': reportPack?.degraded
          ? reportPack.degradedReasons.length || 1
          : reportPack?.worksheets.length,
        'candidate-triage': candidates.length || undefined,
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
    insightId,
    isPolish,
    title,
    officialAnswers,
    issuesReadout,
    hiddenSignals,
    opportunityReadout,
    evidenceQuotes,
    traceabilityRows,
    sourceSessions,
    sourceSessionSummaries,
    sourcePack,
    reportPack,
    reportReadiness,
    reportExporting,
    reportPublishing,
    reportRevisionCreating,
    reportReviewSubmitting,
    worksheetActionLoadingKey,
    analysis,
    findings,
    findingsSummary.activeEvidence,
    findingsSummary.total,
    candidates,
    candidateSummary,
    candidateActionLoadingId,
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
    truthReviewSummary,
    readbackSummary.confirmed,
    expandedEvidenceRef,
    toggleEvidenceRef,
    findEvidenceForRef,
    expandedLimits,
    toggleLimitsExpand,
    handleOpenHandoff,
    handleCreateReportRevision,
    handleExportReportManifest,
    handlePublishReportPack,
    handleSubmitReportForReview,
    handleWorksheetStatusUpdate,
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
    <NModeShell
      header={{
        title,
        onTitleChange: setTitle,
        titlePlaceholder: { en: 'Insight title...', pl: 'Tytuł wniosku...' },
        artifactId: insight?.id,
        artifactType: 'insight',
        onSave: handleSave,
        saving,
        isDirty,
        onChat: handleOpenChat,
        onClose,
        statusDotColor: statusConfig.color,
      }}
      properties={propertyFields}
      sections={nModeSectionsWithContent}
      activeSection={activeNSection}
      onSectionChange={setActiveNSection}
      presentationMode={presentationMode}
      onPresentationModeChange={setPresentationMode}
      buildArtifactCode={(type, id) => buildArtifactCode(type as ArtifactType, id)}
      renderActionBar={() => (
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
            onClick={handleExportToNotebook}
            disabled={isExportingNotebook || insight?.status !== 'completed'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-xs font-medium transition-all disabled:opacity-50"
          >
            {isExportingNotebook ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <BookOpen size={14} />
            )}
            {isPolish ? 'Do Notatnika' : 'To Notebook'}
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

          <div className="w-px h-5 bg-slate-300/50 dark:bg-navy-600/50 mx-1" />

          {(!insight?.reviewStatus || insight.reviewStatus === 'draft') &&
            (insight?.status === 'completed' || insight?.status === 'failed') && (
              <button
                onClick={() => handleLifecycleTransition('submit_review')}
                disabled={lifecycleTransitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                {lifecycleTransitioning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Eye size={14} />
                )}
                {isPolish ? 'Wyślij do recenzji' : 'Submit for Review'}
              </button>
            )}

          {insight?.reviewStatus === 'in_review' && (
            <>
              <button
                onClick={() => handleLifecycleTransition('approve')}
                disabled={lifecycleTransitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                {lifecycleTransitioning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {isPolish ? 'Zatwierdź i opublikuj' : 'Approve & Publish'}
              </button>
              <button
                onClick={() => handleLifecycleTransition('reject')}
                disabled={lifecycleTransitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all disabled:opacity-50"
              >
                <X size={14} />
                {isPolish ? 'Odrzuć' : 'Reject'}
              </button>
            </>
          )}

          {insight?.reviewStatus === 'published' && (
            <>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <CheckCircle2 size={14} />
                {isPolish ? 'Opublikowano' : 'Published'}
              </span>
              <button
                onClick={() => handleLifecycleTransition('revert_draft')}
                disabled={lifecycleTransitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 text-xs font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} />
                {isPolish ? 'Przywróć do szkicu' : 'Revert to Draft'}
              </button>
            </>
          )}
        </div>
      )}
    >
      {handoffModalOpen && handoffFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setHandoffModalOpen(false);
              setHandoffFinding(null);
            }}
          />
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Utwórz inicjatywę z finding' : 'Create initiative from finding'}
              </h3>
              <button
                onClick={() => {
                  setHandoffModalOpen(false);
                  setHandoffFinding(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isPolish ? 'Stwierdzenie finding' : 'Finding statement'}
                </label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-navy-700">
                  {handoffFinding.title}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Poziom pewności' : 'Confidence level'}
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
                    {handoffFinding.confidence || 'medium'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isPolish ? 'Typ' : 'Type'}
                  </label>
                  <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
                    {handoffFinding.sectionType}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isPolish ? 'Limity i założenia' : 'Limits & assumptions'}
                </label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-700 min-h-[40px]">
                  {handoffFinding.limits && handoffFinding.limits.length > 0 ? (
                    <ul className="list-disc list-inside space-y-0.5">
                      {handoffFinding.limits.map((l, i) => (
                        <li key={i} className="text-xs italic">
                          {l}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs italic text-slate-400">
                      {isPolish ? 'Brak określonych limitów' : 'No limits specified'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/50">
              <button
                onClick={() => handleHandoffSubmit('link')}
                disabled={handoffSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-600 text-sm font-medium transition-all disabled:opacity-50"
              >
                {handoffSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                {isPolish ? 'Połącz z istniejącą' : 'Link to existing'}
              </button>
              <button
                onClick={() => handleHandoffSubmit('create')}
                disabled={handoffSubmitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {handoffSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {isPolish ? 'Utwórz nową inicjatywę' : 'Create new initiative'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NModeShell>
  );
};

export default InsightViewer;
