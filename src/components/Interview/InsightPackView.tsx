/**
 * InsightPackView (T016)
 *
 * N-mode insight pack viewer for structured inference results.
 * Left nav with category filters, canvas with expandable insight cards,
 * properties strip with status & actions.
 *
 * P10-aligned: semantic confidence levels, evidence pointers, limits visibility.
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  HelpCircle,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

const API_BASE = '/api/interview';

// ── P10 Confidence Types ──────────────────────────────────────────────────────

export type P10ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';
export type P10ExtendedConfidenceLevel = P10ConfidenceLevel | 'contradicted' | 'unknown';

export const P10_EVIDENCE_POINTER_TYPES = [
  'interview_session',
  'question_answer',
  'transcript_excerpt',
  'survey_linkage',
  'attachment',
  'export_artifact',
  'operator_note',
] as const;

export type P10EvidencePointerType = (typeof P10_EVIDENCE_POINTER_TYPES)[number];

export function mapScoreToP10Level(score: number): P10ConfidenceLevel {
  if (score <= 1) return 'insufficient';
  if (score === 2) return 'low';
  if (score === 3) return 'medium';
  return 'high';
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface EvidencePointer {
  pointerId?: string;
  type?: P10EvidencePointerType;
  sourceRef?: string;
  capturedAt?: string;
  sourceFingerprint?: string;
  sessionId?: string;
  questionId?: string;
  excerpt?: string | null;
  capturedExcerpt?: string | null;
  removalReason?: string | null;
  isTombstone?: boolean;
}

interface StructuredInsight {
  category: string;
  statement: string;
  whyItMatters: string;
  recommendation?: string;
  confidenceScore: number;
  confidenceLevel?: P10ExtendedConfidenceLevel;
  evidence: EvidencePointer[];
  assumptions: string[];
  unknowns: string[];
  counterpoints: string[];
}

interface InsightRow {
  id: string;
  title: string;
  category: string;
  status: string;
  structuredContent: StructuredInsight | null;
  evidenceLinks: EvidencePointer[];
  unknowns: string[];
  counterpoints: string[];
  assumptions: string[];
  confidenceScore: number;
  confidenceLevel?: P10ExtendedConfidenceLevel;
  insightCategory: string;
  inferenceRunId: string;
  createdAt: string;
}

interface InferenceRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  insightsCount: number;
  generationTimeMs: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

interface InsightPackViewProps {
  organizationId: string;
  projectId?: string;
  sessionIds: string[];
  locked?: boolean;
}

const CATEGORIES = ['risk', 'opportunity', 'constraint', 'priority', 'trend', 'gap'] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  risk: <AlertTriangle className="w-4 h-4" />,
  opportunity: <Lightbulb className="w-4 h-4" />,
  constraint: <Shield className="w-4 h-4" />,
  priority: <Target className="w-4 h-4" />,
  trend: <TrendingUp className="w-4 h-4" />,
  gap: <HelpCircle className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  risk: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  constraint: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  priority: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  trend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gap: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const EVIDENCE_TYPE_ICONS: Record<P10EvidencePointerType, React.ReactNode> = {
  interview_session: <Mic className="w-3 h-3" />,
  question_answer: <MessageSquare className="w-3 h-3" />,
  transcript_excerpt: <FileText className="w-3 h-3" />,
  survey_linkage: <Link2 className="w-3 h-3" />,
  attachment: <Paperclip className="w-3 h-3" />,
  export_artifact: <BookOpen className="w-3 h-3" />,
  operator_note: <Star className="w-3 h-3" />,
};

// ── P10 Confidence Badge ──────────────────────────────────────────────────────

const P10_CONFIDENCE_STYLES: Record<P10ConfidenceLevel, { bg: string; label: string }> = {
  high: {
    bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    label: 'High confidence',
  },
  medium: {
    bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    label: 'Medium',
  },
  low: {
    bg: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    label: 'Hypothesis',
  },
  insufficient: {
    bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'Insufficient — draft only',
  },
};

export function resolveConfidenceLevel(row: {
  confidenceLevel?: string;
  confidenceScore?: number;
}): P10ExtendedConfidenceLevel {
  if (row.confidenceLevel === 'contradicted') return 'contradicted';
  if (row.confidenceLevel && row.confidenceLevel !== 'unknown') {
    return row.confidenceLevel as P10ExtendedConfidenceLevel;
  }
  return mapScoreToP10Level(row.confidenceScore ?? 3);
}

export const P10ConfidenceBadge: React.FC<{
  level: P10ExtendedConfidenceLevel;
}> = ({ level }) => {
  if (level === 'contradicted') {
    return (
      <span
        data-testid="confidence-badge"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      >
        <AlertTriangle className="w-3 h-3" />
        Contradicted
      </span>
    );
  }

  const baseLevel: P10ConfidenceLevel =
    level === 'unknown' ? 'insufficient' : (level as P10ConfidenceLevel);
  const style = P10_CONFIDENCE_STYLES[baseLevel];

  return (
    <span
      data-testid="confidence-badge"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${style.bg}`}
    >
      {baseLevel === 'low' && <AlertTriangle className="w-3 h-3" />}
      {baseLevel === 'insufficient' && <AlertTriangle className="w-3 h-3" />}
      {style.label}
    </span>
  );
};

// ── Evidence Pointer Management ───────────────────────────────────────────────

interface AddEvidenceFormProps {
  onAdd: (ptr: EvidencePointer) => void;
  onCancel: () => void;
}

const AddEvidenceForm: React.FC<AddEvidenceFormProps> = ({ onAdd, onCancel }) => {
  const [type, setType] = useState<P10EvidencePointerType>('interview_session');
  const [sourceRef, setSourceRef] = useState('');
  const [excerpt, setExcerpt] = useState('');

  const handleSubmit = () => {
    if (!sourceRef.trim()) {
      toast.error('Source reference is required');
      return;
    }
    onAdd({
      pointerId: `ptr-${Date.now()}`,
      type,
      sourceRef: sourceRef.trim(),
      capturedExcerpt: excerpt.trim() || null,
      capturedAt: new Date().toISOString(),
      sourceFingerprint: '',
      isTombstone: false,
    });
    setSourceRef('');
    setExcerpt('');
  };

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as P10EvidencePointerType)}
          className="text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1"
          aria-label="Evidence type"
        >
          {P10_EVIDENCE_POINTER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        placeholder="Source reference (ID or URL)"
        value={sourceRef}
        onChange={(e) => setSourceRef(e.target.value)}
        className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5"
        aria-label="Source reference"
      />
      <textarea
        placeholder="Excerpt (optional)"
        value={excerpt}
        onChange={(e) => setExcerpt(e.target.value)}
        rows={2}
        className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 resize-none"
        aria-label="Evidence excerpt"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="text-xs px-3 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded-md bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

interface RemovalReasonInputProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const RemovalReasonInput: React.FC<RemovalReasonInputProps> = ({ onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');

  return (
    <div className="flex items-center gap-1 mt-1">
      <input
        type="text"
        placeholder="Removal reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="flex-1 text-xs rounded border border-red-300 dark:border-red-700 px-1.5 py-0.5"
        aria-label="Removal reason"
      />
      <button
        onClick={() => reason.trim() && onConfirm(reason.trim())}
        disabled={!reason.trim()}
        className="text-xs px-2 py-0.5 rounded bg-red-600 text-white disabled:opacity-40"
      >
        Confirm
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

function getEvidenceExcerpt(e: EvidencePointer): string | null {
  return e.capturedExcerpt ?? e.excerpt ?? null;
}

function isEvidenceBroken(e: EvidencePointer): boolean {
  if (e.isTombstone) return false;
  const exc = getEvidenceExcerpt(e);
  return !exc || exc.trim().length === 0;
}

function isEvidenceRedacted(e: EvidencePointer): boolean {
  const exc = getEvidenceExcerpt(e);
  return (
    exc === '[REDACTED]' ||
    exc === '[redacted]' ||
    (e.removalReason?.toLowerCase().includes('redact') ?? false)
  );
}

function isEvidenceDrifted(e: EvidencePointer & { currentFingerprint?: string }): boolean {
  if (!e.sourceFingerprint || !e.currentFingerprint) return false;
  return e.sourceFingerprint !== e.currentFingerprint;
}

function findDuplicateSourceRefs(evidence: EvidencePointer[]): Set<string> {
  const seen = new Map<string, number>();
  for (const e of evidence) {
    if (e.isTombstone || !e.sourceRef) continue;
    const key = `${e.sourceRef}:${e.sourceFingerprint || ''}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, count] of seen) {
    if (count > 1) dupes.add(key);
  }
  return dupes;
}

export const InsightPackView: React.FC<InsightPackViewProps> = ({
  organizationId,
  projectId,
  sessionIds,
  locked = false,
}) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [runs, setRuns] = useState<InferenceRun[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningInference, setRunningInference] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      setLoadingInsights(true);
      const res = await fetch(`${API_BASE}/insights`);
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.insights || data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.insight_category || r.category || 'gap',
        status: r.status || 'completed',
        structuredContent:
          typeof r.structured_content === 'string'
            ? JSON.parse(r.structured_content)
            : r.structured_content || r.structuredContent || null,
        evidenceLinks:
          typeof r.evidence_links === 'string'
            ? JSON.parse(r.evidence_links)
            : r.evidence_links || r.evidenceLinks || [],
        unknowns: typeof r.unknowns === 'string' ? JSON.parse(r.unknowns) : r.unknowns || [],
        counterpoints:
          typeof r.counterpoints === 'string' ? JSON.parse(r.counterpoints) : r.counterpoints || [],
        assumptions:
          typeof r.assumptions === 'string' ? JSON.parse(r.assumptions) : r.assumptions || [],
        confidenceScore: r.confidence_score || r.confidenceScore || 3,
        insightCategory: r.insight_category || r.insightCategory || r.category || 'gap',
        inferenceRunId: r.inference_run_id || r.inferenceRunId || '',
        createdAt: r.created_at || r.createdAt || '',
      }));
      setInsights(rows);
    } catch {
      /* ignore */
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const url = projectId
        ? `${API_BASE}/inference/runs?projectId=${projectId}`
        : `${API_BASE}/inference/runs`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    fetchInsights();
    fetchRuns();
  }, [fetchInsights, fetchRuns]);

  const runInference = useCallback(async () => {
    if (sessionIds.length === 0) {
      toast.error('No sessions selected');
      return;
    }

    setRunningInference(true);
    trackFunnelEvent('inference_run_started', { sessionCount: sessionIds.length });

    try {
      const res = await fetch(`${API_BASE}/inference/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sessionIds }),
      });

      if (!res.ok) throw new Error('Failed to start inference');
      const data = await res.json();
      toast.success(t('interview.inference.running'));

      const pollRun = async (runId: string, attempts = 0) => {
        if (attempts > 30) return;
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_BASE}/inference/runs/${runId}`);
        if (!statusRes.ok) return;
        const runData = await statusRes.json();

        if (runData.status === 'completed') {
          trackFunnelEvent('inference_run_completed', {
            runId,
            insightsCount: runData.insightsCount,
          });
          toast.success(t('interview.inference.completed'));
          fetchInsights();
          fetchRuns();
          setRunningInference(false);
        } else if (runData.status === 'failed') {
          trackFunnelEvent('inference_run_failed', { runId });
          toast.error(t('interview.inference.failed'));
          setRunningInference(false);
        } else {
          pollRun(runId, attempts + 1);
        }
      };

      pollRun(data.runId);
    } catch {
      toast.error(t('interview.inference.failed'));
      setRunningInference(false);
    }
  }, [sessionIds, projectId, t, fetchInsights, fetchRuns]);

  const filteredInsights = useMemo(
    () =>
      selectedCategory ? insights.filter((i) => i.insightCategory === selectedCategory) : insights,
    [insights, selectedCategory]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) counts[cat] = 0;
    for (const i of insights) {
      const cat = i.insightCategory || 'gap';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [insights]);

  const latestRun = runs[0] || null;

  return (
    <div className="flex h-full">
      {/* Left nav: category filters */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
          <Filter className="w-3 h-3 inline mr-1" />
          {t('interview.inference.categories.risk').split(' ')[0] ? 'Categories' : 'Categories'}
        </h3>

        <button
          onClick={() => setSelectedCategory(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
            !selectedCategory
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All ({insights.length})
        </button>

        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 transition-colors ${
              selectedCategory === cat
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {CATEGORY_ICONS[cat]}
            <span className="flex-1">{t(`interview.inference.categories.${cat}`)}</span>
            <span className="text-xs opacity-60">{categoryCounts[cat]}</span>
          </button>
        ))}

        {/* Run status */}
        {latestRun && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="px-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5 mb-1">
                {latestRun.status === 'running' && (
                  <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                )}
                {latestRun.status === 'completed' && <Check className="w-3 h-3 text-green-500" />}
                {latestRun.status === 'failed' && (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                )}
                <span className="capitalize">{latestRun.status}</span>
              </div>
              {latestRun.insightsCount > 0 && <p>{latestRun.insightsCount} insights</p>}
              {latestRun.generationTimeMs > 0 && (
                <p>{(latestRun.generationTimeMs / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Canvas: insights list */}
      <div className="flex-1 overflow-y-auto">
        {/* Header with Run Inference button */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {t('interview.inference.title')}
          </h2>
          {!locked && (
            <button
              onClick={runInference}
              disabled={runningInference || sessionIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {runningInference ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('interview.inference.runInference')}
            </button>
          )}
        </div>

        <div className="p-6 space-y-3">
          {loadingInsights && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          )}

          {!loadingInsights && filteredInsights.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{t('interview.inference.noInsights')}</p>
            </div>
          )}

          {filteredInsights.map((insight) => {
            const expanded = expandedId === insight.id;
            const sc = insight.structuredContent;
            const level = resolveConfidenceLevel({
              confidenceLevel: insight.confidenceLevel ?? sc?.confidenceLevel,
              confidenceScore: insight.confidenceScore,
            });

            return (
              <div
                key={insight.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
              >
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : insight.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      CATEGORY_COLORS[insight.insightCategory] || CATEGORY_COLORS.gap
                    }`}
                  >
                    {CATEGORY_ICONS[insight.insightCategory]}
                    {t(`interview.inference.categories.${insight.insightCategory}`)}
                  </span>

                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {insight.title}
                  </span>

                  <P10ConfidenceBadge level={level} />

                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {(insight.evidenceLinks || []).length} evidence
                  </span>
                </button>

                {/* Expanded detail */}
                {expanded && sc && (
                  <InsightExpandedDetail
                    insight={insight}
                    sc={sc}
                    level={level}
                    locked={locked}
                    t={t}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Expanded detail sub-component ─────────────────────────────────────────────

interface InsightExpandedDetailProps {
  insight: InsightRow;
  sc: StructuredInsight;
  level: P10ExtendedConfidenceLevel;
  locked: boolean;
  t: (key: string) => string;
}

const InsightExpandedDetail: React.FC<InsightExpandedDetailProps> = ({
  insight,
  sc,
  level,
  locked,
  t,
}) => {
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [localEvidence, setLocalEvidence] = useState<EvidencePointer[]>(sc.evidence || []);

  const duplicateKeys = useMemo(() => findDuplicateSourceRefs(localEvidence), [localEvidence]);

  const handleAddEvidence = useCallback((ptr: EvidencePointer) => {
    setLocalEvidence((prev) => [...prev, ptr]);
    setShowAddEvidence(false);
    toast.success('Evidence added');
  }, []);

  const handleRemoveEvidence = useCallback((idx: number, reason: string) => {
    setLocalEvidence((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, isTombstone: true, removalReason: reason } : e))
    );
    setRemovingIdx(null);
    toast.success('Evidence removed (tombstone created)');
  }, []);

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-4">
      {/* Contradicted finding callout */}
      {level === 'contradicted' && (
        <div
          data-testid="contradiction-callout"
          className="bg-orange-50 dark:bg-orange-950/20 rounded-xl p-3 border border-orange-200 dark:border-orange-900/50"
        >
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Contradictory evidence detected
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400/80 mt-1">
            Automatic handoff is blocked. Resolve, split, or keep with warning.
          </p>
        </div>
      )}

      {/* Low confidence warning */}
      {level === 'low' && (
        <div
          data-testid="hypothesis-warning"
          className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Hypothesis — this finding may be inaccurate
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Handoff allowed only as "investigate", not "execute".
          </p>
        </div>
      )}

      {/* Why it matters */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
          {t('interview.inference.whyItMatters')}
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300">{sc.whyItMatters}</p>
      </div>

      {/* Recommendation */}
      {sc.recommendation && (
        <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/50">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            {t('interview.inference.recommendation')}
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-300">{sc.recommendation}</p>
        </div>
      )}

      {/* Evidence with P10 pointer awareness */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('interview.inference.evidence')} (
            {localEvidence.filter((e) => !e.isTombstone).length}
            {localEvidence.some((e) => e.isTombstone) &&
              ` + ${localEvidence.filter((e) => e.isTombstone).length} removed`}
            )
          </h4>
          {!locked && (
            <button
              onClick={() => setShowAddEvidence(true)}
              className="text-xs px-2 py-1 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add evidence
            </button>
          )}
        </div>

        {showAddEvidence && (
          <AddEvidenceForm onAdd={handleAddEvidence} onCancel={() => setShowAddEvidence(false)} />
        )}

        <div className="space-y-1.5">
          {localEvidence.map((e, i) => {
            const exc = getEvidenceExcerpt(e);
            const broken = isEvidenceBroken(e);
            const isDuplicate =
              e.sourceRef && duplicateKeys.has(`${e.sourceRef}:${e.sourceFingerprint || ''}`);

            if (e.isTombstone) {
              return (
                <div
                  key={i}
                  data-testid="tombstone-evidence"
                  className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-2 border border-gray-100 dark:border-gray-700 opacity-60"
                >
                  <span className="line-through">
                    {exc ? `"${exc}"` : e.sourceRef || 'Evidence item'}
                  </span>
                  <span className="ml-2 text-red-500 dark:text-red-400 font-medium not-italic">
                    Removed: {e.removalReason}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={i}
                className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-start gap-2">
                  {e.type && EVIDENCE_TYPE_ICONS[e.type] && (
                    <span
                      className="mt-0.5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                      title={e.type.replace(/_/g, ' ')}
                    >
                      {EVIDENCE_TYPE_ICONS[e.type]}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    {isEvidenceRedacted(e) ? (
                      <span
                        data-testid="redacted-pointer"
                        className="text-orange-500 dark:text-orange-400 flex items-center gap-1"
                      >
                        <Shield className="w-3 h-3" />
                        Redacted — pointer preserved for audit
                      </span>
                    ) : broken ? (
                      <span
                        data-testid="broken-pointer"
                        className="text-red-500 dark:text-red-400 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Source unavailable
                      </span>
                    ) : (
                      <span className="italic">"{exc}"</span>
                    )}
                    {isEvidenceDrifted(e as EvidencePointer & { currentFingerprint?: string }) && (
                      <span
                        data-testid="drift-indicator"
                        className="ml-2 text-orange-500 dark:text-orange-400 text-[10px] font-medium flex items-center gap-0.5"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Source changed since capture
                      </span>
                    )}
                    {isDuplicate && (
                      <span
                        data-testid="duplicate-indicator"
                        className="ml-2 text-amber-500 dark:text-amber-400 text-[10px] font-medium"
                      >
                        (duplicate)
                      </span>
                    )}
                  </div>
                  {!locked && removingIdx !== i && (
                    <button
                      onClick={() => setRemovingIdx(i)}
                      className="flex-shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Remove evidence"
                      aria-label="Remove evidence"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {removingIdx === i && (
                  <RemovalReasonInput
                    onConfirm={(reason) => handleRemoveEvidence(i, reason)}
                    onCancel={() => setRemovingIdx(null)}
                  />
                )}
              </div>
            );
          })}
          {localEvidence.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No evidence pointers</p>
          )}
        </div>
      </div>

      {/* Limits (P10: always visible, not collapsed) */}
      <div data-testid="limits-section">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Limits
        </h4>
        {sc.unknowns && sc.unknowns.length > 0 ? (
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {sc.unknowns.map((u, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-amber-400 mt-0.5">•</span>
                {u}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No limits specified</p>
        )}
      </div>

      {/* Counterpoints + Assumptions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sc.counterpoints && sc.counterpoints.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
              {t('interview.inference.counterpoints')}
            </h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              {sc.counterpoints.map((c, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-red-400 mt-0.5">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(level === 'medium' || sc.assumptions?.length > 0) && sc.assumptions && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
              {t('interview.inference.assumptions')}
            </h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              {sc.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-blue-400 mt-0.5">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Properties strip / actions */}
      {!locked && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span
            className={`text-xs px-2 py-1 rounded-md font-medium ${
              insight.status === 'approved'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : insight.status === 'reviewed'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {t(
              `interview.inference.${insight.status === 'approved' ? 'approved' : insight.status === 'reviewed' ? 'reviewed' : 'draft'}`
            )}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              trackFunnelEvent('insight_approved', { insightId: insight.id });
              toast.success('Approved');
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors"
          >
            {t('interview.inference.approve')}
          </button>
          <button
            onClick={() => {
              trackFunnelEvent('insight_regenerated', { insightId: insight.id });
              toast('Regeneration requested');
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" />
            {t('interview.inference.regenerate')}
          </button>
          <button
            onClick={() => {
              trackFunnelEvent('insight_exported', { insightId: insight.id });
              toast.success('Exported');
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            <Download className="w-3 h-3 inline mr-1" />
            {t('interview.inference.export')}
          </button>
        </div>
      )}
    </div>
  );
};

export default InsightPackView;
