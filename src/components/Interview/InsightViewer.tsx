/**
 * InsightViewer - Display AI-generated insights with markdown rendering
 * BCG Enterprise Level - Professional presentation of analysis results
 */

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Api } from '@/services/api';

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

interface InsightViewerProps {
  insightId: string;
  onClose: () => void;
  onRegenerate?: () => void;
}

// ==========================================
// TYPE METADATA
// ==========================================

const TYPE_METADATA: Record<InsightPromptType, { icon: React.ReactNode; color: string; label: string; labelPl: string }> = {
  summary: { icon: <FileText size={16} />, color: 'blue', label: 'Executive Summary', labelPl: 'Podsumowanie Wykonawcze' },
  trends: { icon: <TrendingUp size={16} />, color: 'purple', label: 'Trend Analysis', labelPl: 'Analiza Trendów' },
  problems: { icon: <AlertTriangle size={16} />, color: 'red', label: 'Problem Discovery', labelPl: 'Odkrywanie Problemów' },
  recommendations: { icon: <Lightbulb size={16} />, color: 'amber', label: 'Recommendations', labelPl: 'Rekomendacje' },
  comparison: { icon: <BarChart3 size={16} />, color: 'cyan', label: 'Cross-Interview Comparison', labelPl: 'Porównanie Wywiadów' },
  gaps: { icon: <Target size={16} />, color: 'orange', label: 'Gap Analysis', labelPl: 'Analiza Luk' },
  risk_assessment: { icon: <AlertTriangle size={16} />, color: 'rose', label: 'Risk Assessment', labelPl: 'Ocena Ryzyk' },
  opportunity_scan: { icon: <Zap size={16} />, color: 'emerald', label: 'Opportunity Scan', labelPl: 'Skan Szans' },
  maturity: { icon: <Brain size={16} />, color: 'indigo', label: 'Maturity Assessment', labelPl: 'Ocena Dojrzałości' },
  stakeholder_map: { icon: <Users size={16} />, color: 'violet', label: 'Stakeholder Mapping', labelPl: 'Mapa Interesariuszy' },
};

// ==========================================
// COMPONENT
// ==========================================

export const InsightViewer: React.FC<InsightViewerProps> = ({
  insightId,
  onClose,
  onRegenerate,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [insight, setInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load insight
  useEffect(() => {
    const loadInsight = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await Api.get(`/interview/insights/${insightId}`);
        setInsight(data);
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
          }
        } catch (err) {
          console.error('[InsightViewer] Poll error:', err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [insightId]);

  // Handle regenerate
  const handleRegenerate = async () => {
    if (!insight) return;
    setIsRegenerating(true);
    try {
      await Api.post(`/interview/insights/${insight.id}/regenerate`, {});
      toast.success(isPolish ? 'Regenerowanie rozpoczęte...' : 'Regeneration started...');
      // Reload insight
      const data = await Api.get(`/interview/insights/${insightId}`);
      setInsight(data);
      onRegenerate?.();
    } catch (err: any) {
      toast.error(isPolish ? 'Nie udało się zregenerować' : 'Failed to regenerate');
      console.error('[InsightViewer] Regenerate error:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!insight?.content) return;
    try {
      await navigator.clipboard.writeText(insight.content);
      toast.success(isPolish ? 'Skopiowano do schowka' : 'Copied to clipboard');
    } catch (err) {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Failed to copy');
    }
  };

  // Handle export
  const handleExport = (format: 'pdf' | 'markdown') => {
    if (!insight?.content) return;

    if (format === 'markdown') {
      const blob = new Blob([insight.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${insight.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isPolish ? 'Pobrano plik Markdown' : 'Downloaded Markdown file');
    } else {
      // PDF export would require a library like jsPDF or server-side generation
      toast(isPolish ? 'Eksport PDF w przygotowaniu...' : 'PDF export coming soon...', { icon: '📄' });
    }
  };

  // Get type metadata
  const typeMeta = insight ? TYPE_METADATA[insight.promptType] || TYPE_METADATA.summary : TYPE_METADATA.summary;

  // Color classes helper
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getColorClasses(typeMeta.color, 'bg')} ${getColorClasses(typeMeta.color, 'text')}`}>
              {typeMeta.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {insight?.title || (isPolish ? 'Ładowanie...' : 'Loading...')}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={getColorClasses(typeMeta.color, 'text')}>
                  {isPolish ? typeMeta.labelPl : typeMeta.label}
                </span>
                {insight && (
                  <>
                    <span>•</span>
                    <span>{insight.sourceSessionCount} {isPolish ? 'sesji' : 'sessions'}</span>
                    <span>•</span>
                    <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Actions */}
            {insight?.status === 'completed' && (
              <>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                  title={isPolish ? 'Kopiuj' : 'Copy'}
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
                  title={isPolish ? 'Pobierz' : 'Download'}
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  title={isPolish ? 'Regeneruj' : 'Regenerate'}
                >
                  <RefreshCw size={18} className={isRegenerating ? 'animate-spin' : ''} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-primary-400 mb-4" />
              <p className="text-slate-400">{isPolish ? 'Ładowanie wniosków...' : 'Loading insights...'}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle size={32} className="text-red-400 mb-4" />
              <p className="text-red-400 mb-2">{isPolish ? 'Błąd ładowania' : 'Loading error'}</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : insight?.status === 'generating' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <Sparkles size={48} className="text-amber-400 animate-pulse" />
                <div className="absolute inset-0 animate-ping">
                  <Sparkles size={48} className="text-amber-400/30" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {isPolish ? 'AI generuje wnioski...' : 'AI is generating insights...'}
              </h3>
              <p className="text-sm text-slate-400 text-center max-w-md">
                {isPolish
                  ? 'Analizujemy wybrane sesje wywiadów i przygotowujemy kompleksową analizę. To może potrwać kilka minut.'
                  : 'We are analyzing selected interview sessions and preparing a comprehensive analysis. This may take a few minutes.'}
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                <Clock size={14} />
                <span>{isPolish ? 'Oczekiwanie na wyniki...' : 'Waiting for results...'}</span>
              </div>
            </div>
          ) : insight?.status === 'failed' ? (
            <div className="flex flex-col items-center justify-center py-16">
              <AlertTriangle size={48} className="text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {isPolish ? 'Generowanie nie powiodło się' : 'Generation failed'}
              </h3>
              <p className="text-sm text-slate-400 text-center max-w-md mb-4">
                {insight.errorMessage || (isPolish ? 'Wystąpił nieoczekiwany błąd' : 'An unexpected error occurred')}
              </p>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
                {isPolish ? 'Spróbuj ponownie' : 'Try again'}
              </button>
            </div>
          ) : insight?.content ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom styling for markdown elements
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-navy-700">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => <p className="text-slate-300 mb-3 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="text-slate-300">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-slate-400">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary-500 pl-4 py-2 my-4 bg-navy-800/50 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1.5 py-0.5 rounded bg-navy-800 text-primary-400 text-sm font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="block p-4 rounded-lg bg-navy-800 text-slate-300 text-sm font-mono overflow-x-auto">
                        {children}
                      </code>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-navy-800">{children}</thead>,
                  th: ({ children }) => (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-navy-600">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2 text-sm text-slate-300 border-b border-navy-700">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="my-6 border-navy-700" />,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {insight.content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={48} className="text-slate-600 mb-4" />
              <p className="text-slate-400">{isPolish ? 'Brak treści' : 'No content'}</p>
            </div>
          )}
        </div>

        {/* Footer with metadata */}
        {insight?.status === 'completed' && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-navy-700 bg-navy-800/50 text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <CheckCircle size={12} className="text-emerald-400" />
                {isPolish ? 'Wygenerowano' : 'Generated'}
              </span>
              {insight.generationTimeMs && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {(insight.generationTimeMs / 1000).toFixed(1)}s
                </span>
              )}
              {insight.tokensUsed > 0 && (
                <span className="flex items-center gap-1">
                  <Sparkles size={12} />
                  {insight.tokensUsed.toLocaleString()} tokens
                </span>
              )}
            </div>
            <span>
              {isPolish ? 'Ostatnia aktualizacja:' : 'Last updated:'}{' '}
              {new Date(insight.updatedAt).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightViewer;
