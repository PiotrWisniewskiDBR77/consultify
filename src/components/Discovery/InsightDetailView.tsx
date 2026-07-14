/**
 * InsightDetailView - Professional BCG-quality Insight Display
 *
 * Features:
 * - Rich markdown rendering with tables, code blocks
 * - Metadata display (type, category, impact, confidence)
 * - Source quote highlighting
 * - Action buttons (Export to Tools, Export to Assessment, Approve)
 * - Session linkage
 * - Professional consulting-grade UI
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Quote,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { InitiativeSuggestionBadge } from '@/components/Initiatives/InitiativeSuggestionBadge';
import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface Insight {
  id: string;
  sessionId?: string;
  organizationId?: string;
  category?: string;
  title: string;
  description?: string;
  content?: string;
  sourceQuote?: string;
  insightType?: string;
  promptType?: string;
  impactLevel?: string;
  confidence?: string;
  pmoDomain?: string;
  actionable?: boolean;
  status?: string;
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  sourceSessionCount?: number;
  sourceSessionIds?: string[];
  tokensUsed?: number;
  generationTimeMs?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InsightDetailViewProps {
  insightId: string;
  insight?: Insight;
  onClose?: () => void;
  onRefresh?: () => void;
}

// ==========================================
// CONSTANTS
// ==========================================

const INSIGHT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  summary: {
    label: 'Executive Summary',
    icon: <FileText size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  opportunity: {
    label: 'Opportunity',
    icon: <TrendingUp size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  gap: {
    label: 'Gap Analysis',
    icon: <Target size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  risk: {
    label: 'Risk',
    icon: <AlertTriangle size={16} />,
    color: 'text-danger-400',
    bgColor: 'bg-danger-500/20',
  },
  problem: {
    label: 'Problem',
    icon: <AlertTriangle size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  recommendation: {
    label: 'Recommendation',
    icon: <Sparkles size={16} />,
    color: 'text-primary-400',
    bgColor: 'bg-primary-500/20',
  },
  priority: {
    label: 'Priority',
    icon: <Zap size={16} />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  trends: {
    label: 'Trends',
    icon: <BarChart3 size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  problems: {
    label: 'Problems',
    icon: <AlertTriangle size={16} />,
    color: 'text-danger-400',
    bgColor: 'bg-danger-500/20',
  },
  recommendations: {
    label: 'Recommendations',
    icon: <Sparkles size={16} />,
    color: 'text-primary-400',
    bgColor: 'bg-primary-500/20',
  },
  comparison: {
    label: 'Comparison',
    icon: <Users size={16} />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
  },
  maturity: {
    label: 'Maturity Assessment',
    icon: <BarChart3 size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  stakeholder_map: {
    label: 'Stakeholder Map',
    icon: <Users size={16} />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
  },
  risk_assessment: {
    label: 'Risk Assessment',
    icon: <AlertTriangle size={16} />,
    color: 'text-danger-400',
    bgColor: 'bg-danger-500/20',
  },
  opportunity_scan: {
    label: 'Opportunity Scan',
    icon: <TrendingUp size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  gaps: {
    label: 'Gap Analysis',
    icon: <Target size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  general: {
    label: 'General',
    icon: <Lightbulb size={16} />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-500/20',
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  strategy: { label: 'Strategy', color: 'text-blue-400' },
  operations: { label: 'Operations', color: 'text-emerald-400' },
  digital: { label: 'Digital', color: 'text-primary-400' },
  people: { label: 'People', color: 'text-amber-400' },
  finance: { label: 'Finance', color: 'text-blue-400' },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  critical: { label: 'Critical', color: 'text-danger-400', bgColor: 'bg-danger-500/20' },
  high: { label: 'High', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  medium: { label: 'Medium', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-500/20' },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'High Confidence', color: 'text-emerald-400' },
  medium: { label: 'Medium Confidence', color: 'text-amber-400' },
  low: { label: 'Low Confidence', color: 'text-slate-600' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600', bgColor: 'bg-slate-500/20' },
  approved: { label: 'Approved', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  generating: { label: 'Generating...', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  completed: { label: 'Ready', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  failed: { label: 'Failed', color: 'text-danger-400', bgColor: 'bg-danger-500/20' },
  exported: { label: 'Exported', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
};

// ==========================================
// COMPONENT
// ==========================================

export const InsightDetailView: React.FC<InsightDetailViewProps> = ({
  insightId,
  insight: initialInsight,
  onClose,
  onRefresh,
}) => {
  const [insight, setInsight] = useState<Insight | null>(initialInsight || null);
  const [loading, setLoading] = useState(!initialInsight);
  const [exporting, setExporting] = useState<string | null>(null);

  // Load insight if not provided
  useEffect(() => {
    if (!initialInsight && insightId) {
      setLoading(true);
      Api.get(`/interview/insights/${insightId}`)
        .then((res) => setInsight(res as Insight))
        .catch((err) => {
          console.error('[InsightDetailView] Failed to load insight:', err);
          toast.error('Failed to load insight');
        })
        .finally(() => setLoading(false));
    }
  }, [insightId, initialInsight]);

  // Get type config
  const typeKey = insight?.insightType || insight?.promptType || 'general';
  const typeConfig = INSIGHT_TYPE_CONFIG[typeKey] || INSIGHT_TYPE_CONFIG.general;
  const categoryConfig = CATEGORY_CONFIG[insight?.category || ''] || {
    label: insight?.category || '',
    color: 'text-slate-600',
  };
  const impactConfig = IMPACT_CONFIG[insight?.impactLevel || 'medium'] || IMPACT_CONFIG.medium;
  const confidenceConfig =
    CONFIDENCE_CONFIG[insight?.confidence || 'medium'] || CONFIDENCE_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[insight?.status || 'draft'] || STATUS_CONFIG.draft;

  // Get content (support both description and content fields)
  const content = insight?.description || insight?.content || '';

  // Handlers
  const handleExportToTools = async () => {
    if (!insight) return;
    setExporting('tools');
    try {
      await Api.post(`/interview/insights/${insight.id}/export`, { target: 'tools' });
      toast.success('Exported to Tools module');
      setInsight({ ...insight, exportedToTools: true });
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to export');
    } finally {
      setExporting(null);
    }
  };

  const handleExportToAssessment = async () => {
    if (!insight) return;
    setExporting('assessment');
    try {
      await Api.post(`/interview/insights/${insight.id}/export`, { target: 'assessment' });
      toast.success('Exported to Assessment module');
      setInsight({ ...insight, exportedToAssessment: true });
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to export');
    } finally {
      setExporting(null);
    }
  };

  const handleApprove = async () => {
    if (!insight) return;
    setExporting('approve');
    try {
      await Api.patch(`/interview/insights/${insight.id}`, { status: 'approved' });
      toast.success('Insight approved');
      setInsight({ ...insight, status: 'approved' });
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to approve');
    } finally {
      setExporting(null);
    }
  };

  const handleRegenerate = async () => {
    if (!insight) return;
    setExporting('regenerate');
    try {
      await Api.post(`/interview/insights/${insight.id}/regenerate`, {});
      toast.success('Regeneration started');
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to regenerate');
    } finally {
      setExporting(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-600">
          <Clock size={20} className="animate-spin" />
          <span>Loading insight...</span>
        </div>
      </div>
    );
  }

  // No insight
  if (!insight) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Lightbulb size={48} className="mb-4 opacity-50" />
        <p>Insight not found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header Card */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          {/* Type Banner */}
          <div
            className={`px-6 py-3 ${typeConfig.bgColor} border-b border-slate-200 dark:border-navy-700`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={typeConfig.color}>{typeConfig.icon}</span>
                <span className={`text-sm font-medium ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
                {insight.category && (
                  <>
                    <ChevronRight size={14} className="text-slate-600" />
                    <span className={`text-sm ${categoryConfig.color}`}>
                      {categoryConfig.label}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <InitiativeSuggestionBadge sourceType="interview_insight" sourceId={insightId} />
                <div
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </div>
              </div>
            </div>
          </div>

          {/* Title & Meta */}
          <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              {insight.title}
            </h1>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {/* Impact */}
              {insight.impactLevel && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${impactConfig.bgColor}`}
                >
                  <AlertTriangle size={12} className={impactConfig.color} />
                  <span className={impactConfig.color}>{impactConfig.label} Impact</span>
                </div>
              )}

              {/* Confidence */}
              {insight.confidence && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle size={12} className={confidenceConfig.color} />
                  <span className={confidenceConfig.color}>{confidenceConfig.label}</span>
                </div>
              )}

              {/* Actionable */}
              {insight.actionable && (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Zap size={12} />
                  <span>Actionable</span>
                </div>
              )}

              {/* Sessions */}
              {(insight.sourceSessionCount || 0) > 0 && (
                <div className="flex items-center gap-1.5 text-slate-600">
                  <FileText size={12} />
                  <span>{insight.sourceSessionCount} sessions analyzed</span>
                </div>
              )}

              {/* Date */}
              {insight.createdAt && (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={12} />
                  <span>
                    {new Date(insight.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Source Quote */}
        {insight.sourceQuote && (
          <div className="bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
            <div className="flex gap-4">
              <Quote size={24} className="text-amber-500/60 flex-shrink-0 mt-1" />
              <div>
                <p className="text-slate-600 italic text-lg leading-relaxed">
                  "{insight.sourceQuote}"
                </p>
                <p className="text-slate-500 text-sm mt-2">— Source Interview</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {content ? (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <div
              className="prose prose-invert prose-sm max-w-none
              prose-headings:text-slate-900 dark:prose-headings:text-white prose-headings:font-semibold
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-navy-700
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-h4:text-base prose-h4:mt-4 prose-h4:mb-2
              prose-p:text-slate-300 prose-p:leading-relaxed
              prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
              prose-ul:text-slate-300 prose-ol:text-slate-300
              prose-li:marker:text-slate-500
              prose-table:border-collapse prose-table:w-full
              prose-th:bg-slate-100 dark:prose-th:bg-navy-800 prose-th:text-slate-200 prose-th:font-semibold prose-th:text-left prose-th:px-4 prose-th:py-2 prose-th:border prose-th:border-slate-300 dark:prose-th:border-navy-600
              prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-slate-200 dark:prose-td:border-navy-700 prose-td:text-slate-300
              prose-code:bg-slate-100 dark:prose-code:bg-navy-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-blue-400 prose-code:text-sm
              prose-pre:bg-slate-50 dark:prose-pre:bg-navy-950 prose-pre:border prose-pre:border-navy-700 prose-pre:rounded-lg
              prose-blockquote:border-l-4 prose-blockquote:border-amber-500/50 prose-blockquote:bg-slate-100/50 dark:prose-blockquote:bg-navy-800/50 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
              prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
            "
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-12 text-center">
            <Lightbulb size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400">No content available</p>
            {insight.status === 'generating' && (
              <p className="text-amber-400 text-sm mt-2">Content is being generated...</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Export to Tools */}
            <button
              onClick={handleExportToTools}
              disabled={!!exporting || insight.exportedToTools}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  insight.exportedToTools
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                    : 'bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white'
                }
                disabled:opacity-50`}
            >
              {insight.exportedToTools ? (
                <>
                  <CheckCircle size={16} />
                  Exported to Tools
                </>
              ) : (
                <>
                  <Send size={16} />
                  {exporting === 'tools' ? 'Exporting...' : 'Export to Tools'}
                </>
              )}
            </button>

            {/* Export to Assessment */}
            <button
              onClick={handleExportToAssessment}
              disabled={!!exporting || insight.exportedToAssessment}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  insight.exportedToAssessment
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                    : 'bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white'
                }
                disabled:opacity-50`}
            >
              {insight.exportedToAssessment ? (
                <>
                  <CheckCircle size={16} />
                  Exported to Assessment
                </>
              ) : (
                <>
                  <ExternalLink size={16} />
                  {exporting === 'assessment' ? 'Exporting...' : 'Export to Assessment'}
                </>
              )}
            </button>

            {/* Approve */}
            {insight.status !== 'approved' && (
              <button
                onClick={handleApprove}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} />
                {exporting === 'approve' ? 'Approving...' : 'Approve'}
              </button>
            )}

            {/* Regenerate (for AI insights) */}
            {insight.promptType && (
              <button
                onClick={handleRegenerate}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ml-auto"
              >
                <RefreshCw size={16} />
                {exporting === 'regenerate' ? 'Starting...' : 'Regenerate'}
              </button>
            )}

            {/* Download */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
              onClick={() => {
                // Create markdown download
                const blob = new Blob([`# ${insight.title}\n\n${content}`], {
                  type: 'text/markdown',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${insight.title.replace(/[^a-z0-9]/gi, '_')}.md`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Downloaded as Markdown');
              }}
            >
              <Download size={16} />
              Download
            </button>
          </div>
        </div>

        {/* Generation Info (for AI insights) */}
        {(insight.tokensUsed || insight.generationTimeMs) && (
          <div className="text-xs text-slate-500 text-center">
            {insight.tokensUsed && <span>Tokens used: {insight.tokensUsed}</span>}
            {insight.tokensUsed && insight.generationTimeMs && <span className="mx-2">•</span>}
            {insight.generationTimeMs && (
              <span>Generated in {(insight.generationTimeMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightDetailView;
