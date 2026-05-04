/**
 * AI Recommendations Panel
 *
 * Displays AI-generated recommendations for digital maturity improvements.
 * Shows prioritized initiatives with effort/impact analysis.
 */

import {
  ArrowRight,
  Award,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { DigitizationAnalysis } from './types';

interface Recommendation {
  id: string;
  analysisId: string;
  axisId: string;
  axisName: string;
  recommendationType:
    | 'initiative'
    | 'quick_win'
    | 'strategic'
    | 'training'
    | 'process_change'
    | 'technology';
  title: string;
  description: string;
  rationale: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  estimatedImpact: 'low' | 'medium' | 'high';
  priorityScore: number;
  status: 'suggested' | 'accepted' | 'rejected' | 'implemented';
  aiConfidence: number;
  generatedAt: string;
}

interface AIRecommendationsPanelProps {
  analysis: DigitizationAnalysis;
  onCreateInitiative?: (recommendation: Recommendation) => void;
}

const TYPE_CONFIG = {
  technology: { icon: Zap, color: 'blue', label: 'Technologia' },
  process_change: { icon: RefreshCw, color: 'purple', label: 'Zmiana procesu' },
  training: { icon: Award, color: 'amber', label: 'Szkolenie' },
  strategic: { icon: Target, color: 'emerald', label: 'Strategiczna' },
  quick_win: { icon: Lightbulb, color: 'yellow', label: 'Quick Win' },
  initiative: { icon: TrendingUp, color: 'teal', label: 'Initiative' },
};

const EFFORT_CONFIG = {
  low: { label: 'Niski', color: 'emerald' },
  medium: { label: 'Medium', color: 'amber' },
  high: { label: 'Wysoki', color: 'red' },
};

const IMPACT_CONFIG = {
  low: { label: 'Niski', color: 'slate' },
  medium: { label: 'Medium', color: 'blue' },
  high: { label: 'Wysoki', color: 'emerald' },
};

export const AIRecommendationsPanel: React.FC<AIRecommendationsPanelProps> = ({
  analysis,
  onCreateInitiative,
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'quick_wins' | 'strategic'>('all');

  const generateRecommendations = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await (Api as any).generateDigitizationRecommendations(analysis.id);
      setRecommendations(result.recommendations || []);
      toast.success('Recommendations generated');
    } catch (err: any) {
      // Fallback: generate locally based on analysis data
      const localRecs = generateLocalRecommendations(analysis);
      setRecommendations(localRecs);
      toast.success('Recommendations generated locally');
    } finally {
      setIsGenerating(false);
    }
  }, [analysis]);

  useEffect(() => {
    // Auto-generate recommendations on mount if analysis has scores
    if (analysis.axisScores && Object.keys(analysis.axisScores).length > 0) {
      generateRecommendations();
    }
  }, [analysis.id]);

  const handleAccept = async (rec: Recommendation) => {
    try {
      await (Api as any).updateRecommendationStatus(rec.id, 'accepted');
      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: 'accepted' } : r))
      );
      toast.success('Recommendation accepted');
      onCreateInitiative?.(rec);
    } catch (err) {
      // Update locally anyway
      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: 'accepted' } : r))
      );
    }
  };

  const handleReject = async (rec: Recommendation) => {
    try {
      await (Api as any).updateRecommendationStatus(rec.id, 'rejected');
      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: 'rejected' } : r))
      );
    } catch (err) {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: 'rejected' } : r))
      );
    }
  };

  const filteredRecommendations = recommendations.filter((rec) => {
    if (filter === 'quick_wins') {
      return rec.estimatedEffort === 'low' && rec.estimatedImpact !== 'low';
    }
    if (filter === 'strategic') {
      return rec.estimatedImpact === 'high';
    }
    return true;
  });

  const quickWinCount = recommendations.filter(
    (r) => r.estimatedEffort === 'low' && r.estimatedImpact !== 'low'
  ).length;

  const strategicCount = recommendations.filter((r) => r.estimatedImpact === 'high').length;

  if (recommendations.length === 0 && !isGenerating) {
    return (
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-primary-500/10 rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="text-primary-500" size={28} />
          </div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
            Recommendations AI
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md mx-auto">
            Generate intelligent recommendations based on digital maturity gap analysis
          </p>
          <button
            onClick={generateRecommendations}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-indigo-500 hover:from-primary-600 hover:to-indigo-600 text-white rounded-xl font-medium mx-auto"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isGenerating ? 'Generating...' : 'Wygeneruj recommendations'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary-500/10 to-indigo-500/10 border-b border-primary-200 dark:border-primary-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900 dark:text-white">Recommendations AI</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {recommendations.length} sugestii • {quickWinCount} quick wins
              </p>
            </div>
          </div>
          <button
            onClick={generateRecommendations}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-500/10 rounded-lg"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-white dark:bg-navy-700 text-primary-600 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50'
            }`}
          >
            Wszystkie ({recommendations.length})
          </button>
          <button
            onClick={() => setFilter('quick_wins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              filter === 'quick_wins'
                ? 'bg-white dark:bg-navy-700 text-amber-600 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50'
            }`}
          >
            <Lightbulb size={12} />
            Quick Wins ({quickWinCount})
          </button>
          <button
            onClick={() => setFilter('strategic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              filter === 'strategic'
                ? 'bg-white dark:bg-navy-700 text-emerald-600 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50'
            }`}
          >
            <Target size={12} />
            Strategiczne ({strategicCount})
          </button>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {filteredRecommendations.map((rec, index) => {
          const typeConfig = TYPE_CONFIG[rec.recommendationType] || TYPE_CONFIG.initiative;
          const Icon = typeConfig.icon;
          const isExpanded = expandedId === rec.id;

          return (
            <div key={rec.id} className={`p-4 ${rec.status === 'rejected' ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Priority badge */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-lg bg-${typeConfig.color}-500/10 flex items-center justify-center`}
                  >
                    <Icon size={16} className={`text-${typeConfig.color}-500`} />
                  </div>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">
                    #{index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-navy-900 dark:text-white">{rec.title}</h4>
                    {rec.status === 'accepted' && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 text-xs rounded-full">
                        Zaakceptowana
                      </span>
                    )}
                    {rec.status === 'rejected' && (
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400 text-xs rounded-full">
                        Odrzucona
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rec.axisName}</p>

                  {/* Effort/Impact badges */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400 dark:text-slate-500" />
                      <span
                        className={`text-xs font-medium text-${EFFORT_CONFIG[rec.estimatedEffort].color}-600`}
                      >
                        Effort: {EFFORT_CONFIG[rec.estimatedEffort].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={12} className="text-slate-400 dark:text-slate-500" />
                      <span
                        className={`text-xs font-medium text-${IMPACT_CONFIG[rec.estimatedImpact].color}-600`}
                      >
                        Impact: {IMPACT_CONFIG[rec.estimatedImpact].label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {Math.round(rec.aiConfidence * 100)}% pewns
                    </span>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg space-y-3">
                      <div>
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
                          Opis
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {rec.description}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">
                          Uzasadnienie
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {rec.rationale}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 dark:text-slate-500"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {rec.status === 'suggested' && (
                    <>
                      <button
                        onClick={() => handleAccept(rec)}
                        className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-500"
                        title="Zaakceptuj"
                      >
                        <CheckCircle size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(rec)}
                        className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500"
                        title="Reject"
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}

                  {rec.status === 'accepted' && onCreateInitiative && (
                    <button
                      onClick={() => onCreateInitiative(rec)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 rounded-lg"
                    >
                      Create initiative
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Generate recommendations locally (fallback when API not available)
 */
function generateLocalRecommendations(analysis: DigitizationAnalysis): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const axisScores = analysis.axisScores || {};

  // Initiative templates
  const templates: Record<
    string,
    Array<{ title: string; type: string; effort: string; impact: string }>
  > = {
    digital_processes: [
      {
        title: 'Production Process Automation',
        type: 'technology',
        effort: 'high',
        impact: 'high',
      },
      {
        title: 'Digitalizacja dokumentacji',
        type: 'process_change',
        effort: 'low',
        impact: 'medium',
      },
    ],
    digital_products: [
      { title: 'IoT Platform for Products', type: 'technology', effort: 'high', impact: 'high' },
      { title: 'System Track & Trace', type: 'technology', effort: 'medium', impact: 'high' },
    ],
    big_data: [
      { title: 'Dashboard analityczny', type: 'technology', effort: 'medium', impact: 'medium' },
      { title: 'Szkolenie z analysis data', type: 'training', effort: 'low', impact: 'medium' },
    ],
    transformation_culture: [
      {
        title: 'Transformation Ambassadors Program',
        type: 'process_change',
        effort: 'medium',
        impact: 'high',
      },
      { title: 'Hackathon innowacji', type: 'quick_win', effort: 'low', impact: 'medium' },
    ],
    cybersecurity: [
      { title: 'Security Audit', type: 'process_change', effort: 'medium', impact: 'high' },
      { title: 'Cybersecurity Training', type: 'training', effort: 'low', impact: 'high' },
    ],
  };

  // Axis names mapping
  const axisNames: Record<string, string> = {
    digital_processes: 'Process Digitization',
    digital_products: 'Cyfrowe produkty',
    digital_business_models: 'Cyfrowe modele biznesowe',
    big_data: 'Big Data i Analityka',
    transformation_culture: 'Kultura transformacji',
    cybersecurity: 'Cybersecurity',
  };

  // Find axes with gaps
  Object.entries(axisScores).forEach(([axisId, score]: [string, any]) => {
    const gap = (score.targetScore || 0) - (score.currentScore || 0);

    if (gap > 0) {
      const axisTemplates = templates[axisId] || [];

      axisTemplates.forEach((template, idx) => {
        const priorityScore = Math.round(
          gap *
            10 *
            (template.effort === 'low' ? 1.5 : template.effort === 'medium' ? 1 : 0.7) *
            (template.impact === 'high' ? 1.5 : template.impact === 'medium' ? 1 : 0.5)
        );

        recommendations.push({
          id: `local-${axisId}-${idx}`,
          analysisId: analysis.id,
          axisId,
          axisName: axisNames[axisId] || axisId,
          recommendationType: template.type as any,
          title: template.title,
          description: `Initiative "${template.title}" will close the gap in area ${axisNames[axisId] || axisId}.`,
          rationale: `Gap ${gap.toFixed(1)} levels requires actions with ${template.impact === 'high' ? 'high' : 'medium'} impact.`,
          estimatedEffort: template.effort as any,
          estimatedImpact: template.impact as any,
          priorityScore,
          status: 'suggested',
          aiConfidence: 0.8,
          generatedAt: new Date().toISOString(),
        });
      });
    }
  });

  // Sort by priority
  recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

  return recommendations.slice(0, 8);
}

export default AIRecommendationsPanel;
