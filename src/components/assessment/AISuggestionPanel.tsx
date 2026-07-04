/**
 * AI Suggestion Panel
 *
 * Component for displaying AI-powered maturity level and technology suggestions
 * within assessment editors.
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

export type SupportedFramework = 'DRD' | 'SIRI' | 'ADMA';

export interface OrganizationContext {
  industry: string;
  size: 'small' | 'medium' | 'large' | 'enterprise';
  region?: string;
  currentMaturity?: number;
  budget?: 'low' | 'medium' | 'high';
  priorities?: string[];
  existingTechnologies?: string[];
}

export interface LevelSuggestion {
  id: string;
  dimensionId: string;
  dimensionName: string;
  currentLevel: number;
  suggestedLevel: number;
  confidence: number;
  reasoning: string;
  benchmarkComparison?: {
    industryAverage: number;
    topPerformers: number;
  };
  timeToAchieve?: string;
  requiredInvestment?: 'low' | 'medium' | 'high';
}

export interface TechnologySuggestion {
  id: string;
  category: string;
  name: string;
  description: string;
  relevantDimensions: string[];
  maturityImpact: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedCost: 'low' | 'medium' | 'high';
  timeToValue: string;
  alternatives?: string[];
  prerequisites?: string[];
  vendors?: string[];
}

export interface GapAnalysis {
  dimension: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
  quickWins: string[];
  longTermActions: string[];
}

export interface RoadmapPhase {
  phase: number;
  name: string;
  duration: string;
  focus: string[];
  technologies: string[];
  expectedOutcome: string;
  kpis: string[];
}

export interface SuggestionData {
  id: string;
  timestamp: string;
  framework: SupportedFramework;
  levelSuggestions: LevelSuggestion[];
  technologySuggestions: TechnologySuggestion[];
  gapAnalysis: GapAnalysis[];
  overallRecommendation: string;
  prioritizedRoadmap: RoadmapPhase[];
}

interface Props {
  framework: SupportedFramework;
  currentScores: Record<string, number>;
  targetScores?: Record<string, number>;
  organizationContext?: OrganizationContext;
  onApplySuggestion?: (dimensionId: string, level: number) => void;
  onSelectTechnology?: (technology: TechnologySuggestion) => void;
  compact?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const PRIORITY_COLORS = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'green',
};

const COMPLEXITY_LABELS = {
  low: { en: 'Low', pl: 'Niska' },
  medium: { en: 'Medium', pl: 'Średnia' },
  high: { en: 'High', pl: 'Wysoka' },
};

const COST_LABELS = {
  low: { en: 'Low', pl: 'Niski' },
  medium: { en: 'Medium', pl: 'Średni' },
  high: { en: 'High', pl: 'Wysoki' },
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Level Suggestion Card
 */
const LevelSuggestionCard: React.FC<{
  suggestion: LevelSuggestion;
  onApply?: () => void;
  isPolish: boolean;
}> = ({ suggestion, onApply, isPolish }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h4 className="font-medium text-navy-900 dark:text-white">
              {suggestion.dimensionName}
            </h4>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{suggestion.currentLevel}</span>
              <ArrowRight size={14} />
              <span className="text-green-600 dark:text-green-400 font-medium">
                {suggestion.suggestedLevel}
              </span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                {suggestion.confidence}% {isPolish ? 'pewności' : 'confidence'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={onApply}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              {isPolish ? 'Zastosuj' : 'Apply'}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">{suggestion.reasoning}</p>

          {suggestion.benchmarkComparison && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Średnia branżowa:' : 'Industry avg:'}
                </span>
                <span className="ml-1 font-medium text-navy-900 dark:text-white">
                  {suggestion.benchmarkComparison.industryAverage}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Top performers:' : 'Top performers:'}
                </span>
                <span className="ml-1 font-medium text-navy-900 dark:text-white">
                  {suggestion.benchmarkComparison.topPerformers}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-4 text-sm">
            {suggestion.timeToAchieve && (
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Clock size={14} />
                {suggestion.timeToAchieve}
              </div>
            )}
            {suggestion.requiredInvestment && (
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <DollarSign size={14} />
                {isPolish
                  ? COST_LABELS[suggestion.requiredInvestment].pl
                  : COST_LABELS[suggestion.requiredInvestment].en}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Technology Suggestion Card
 */
const TechnologyCard: React.FC<{
  technology: TechnologySuggestion;
  onSelect?: () => void;
  isPolish: boolean;
}> = ({ technology, onSelect, isPolish }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h4 className="font-medium text-navy-900 dark:text-white">{technology.name}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">{technology.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
            +{technology.maturityImpact} {isPolish ? 'dojrzałości' : 'maturity'}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{technology.description}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            technology.implementationComplexity === 'low'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : technology.implementationComplexity === 'medium'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {isPolish ? 'Złożoność:' : 'Complexity:'}{' '}
          {isPolish
            ? COMPLEXITY_LABELS[technology.implementationComplexity].pl
            : COMPLEXITY_LABELS[technology.implementationComplexity].en}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
          {isPolish ? 'Koszt:' : 'Cost:'}{' '}
          {isPolish
            ? COST_LABELS[technology.estimatedCost].pl
            : COST_LABELS[technology.estimatedCost].en}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
          {technology.timeToValue}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 space-y-3">
          {technology.alternatives && technology.alternatives.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                {isPolish ? 'Alternatywy' : 'Alternatives'}
              </h5>
              <div className="flex flex-wrap gap-1">
                {technology.alternatives.map((alt, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded"
                  >
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {technology.prerequisites && technology.prerequisites.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">
                {isPolish ? 'Wymagania' : 'Prerequisites'}
              </h5>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                {technology.prerequisites.map((prereq, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <ChevronRight size={12} />
                    {prereq}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onSelect && (
            <button
              onClick={onSelect}
              className="w-full mt-2 px-3 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 text-sm rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors"
            >
              {isPolish ? 'Dodaj do planu' : 'Add to plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Gap Analysis Card
 */
const GapAnalysisCard: React.FC<{
  gap: GapAnalysis;
  isPolish: boolean;
}> = ({ gap, isPolish }) => {
  const [expanded, setExpanded] = useState(false);
  const priorityColor = PRIORITY_COLORS[gap.priority];

  return (
    <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-8 rounded-full bg-${priorityColor}-500`} title={gap.priority} />
          <div>
            <h4 className="font-medium text-navy-900 dark:text-white">{gap.dimension}</h4>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>{gap.currentLevel}</span>
              <ArrowRight size={14} />
              <span>{gap.targetLevel}</span>
              <span
                className={`text-${priorityColor}-600 dark:text-${priorityColor}-400 font-medium`}
              >
                ({isPolish ? 'luka' : 'gap'}: {gap.gap})
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <ChevronDown
            size={18}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 space-y-4">
          {gap.quickWins.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-green-600 dark:text-green-400 uppercase mb-2 flex items-center gap-1">
                <Zap size={12} />
                {isPolish ? 'Quick Wins' : 'Quick Wins'}
              </h5>
              <ul className="space-y-1">
                {gap.quickWins.map((win, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                  >
                    <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" />
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gap.recommendations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-2 flex items-center gap-1">
                <Lightbulb size={12} />
                {isPolish ? 'Rekomendacje' : 'Recommendations'}
              </h5>
              <ul className="space-y-1">
                {gap.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                  >
                    <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gap.longTermActions.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase mb-2 flex items-center gap-1">
                <Target size={12} />
                {isPolish ? 'Działania długoterminowe' : 'Long-term Actions'}
              </h5>
              <ul className="space-y-1">
                {gap.longTermActions.map((action, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"
                  >
                    <ChevronRight size={14} className="text-primary-500 mt-0.5 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Roadmap Phase Card
 */
const RoadmapPhaseCard: React.FC<{
  phase: RoadmapPhase;
  isPolish: boolean;
}> = ({ phase, isPolish }) => {
  return (
    <div className="bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
          {phase.phase}
        </div>
        <div>
          <h4 className="font-medium text-navy-900 dark:text-white">{phase.name}</h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">{phase.duration}</span>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{phase.expectedOutcome}</p>

      <div className="space-y-2">
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            {isPolish ? 'Obszary fokusowe' : 'Focus Areas'}
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {phase.focus.map((f, i) => (
              <span
                key={i}
                className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
            {isPolish ? 'Technologie' : 'Technologies'}
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {phase.technologies.map((t, i) => (
              <span
                key={i}
                className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AISuggestionPanel: React.FC<Props> = ({
  framework,
  currentScores,
  targetScores,
  organizationContext,
  onApplySuggestion,
  onSelectTechnology,
  compact = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [activeTab, setActiveTab] = useState<'levels' | 'technologies' | 'gaps' | 'roadmap'>(
    'levels'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await Api.post('/ai-suggestions/generate', {
        framework,
        organizationContext: organizationContext || {
          industry: 'manufacturing',
          size: 'medium',
        },
        currentScores,
        targetScores,
      });
      setSuggestions((data as any)?.data ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [framework, currentScores, targetScores, organizationContext]);

  // Auto-fetch on mount if scores are provided
  React.useEffect(() => {
    if (Object.keys(currentScores).length > 0 && !suggestions) {
      fetchSuggestions();
    }
  }, [currentScores, suggestions, fetchSuggestions]);

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-primary-50 dark:from-blue-900/20 dark:to-primary-900/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-navy-900 dark:text-white">
              {isPolish ? 'Sugestie AI' : 'AI Suggestions'}
            </span>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={isLoading}
            className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {suggestions && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {suggestions.overallRecommendation.slice(0, 150)}...
            </p>
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                {suggestions.levelSuggestions.length} {isPolish ? 'sugestii' : 'suggestions'}
              </span>
              <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded">
                {suggestions.technologySuggestions.length}{' '}
                {isPolish ? 'technologii' : 'technologies'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-primary-500 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {isPolish ? 'Sugestie AI' : 'AI Suggestions'}
              </h3>
              <p className="text-sm text-white/80">
                {isPolish
                  ? 'Rekomendacje oparte na benchmarkach branżowych'
                  : 'Recommendations based on industry benchmarks'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={isLoading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            {isPolish ? 'Odśwież' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-navy-700">
        {[
          { id: 'levels', label: isPolish ? 'Poziomy' : 'Levels', icon: Target },
          { id: 'technologies', label: isPolish ? 'Technologie' : 'Technologies', icon: Cpu },
          { id: 'gaps', label: isPolish ? 'Analiza luk' : 'Gap Analysis', icon: BarChart3 },
          { id: 'roadmap', label: isPolish ? 'Roadmapa' : 'Roadmap', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                {isPolish ? 'Generowanie sugestii...' : 'Generating suggestions...'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {!isLoading && !error && suggestions && (
          <>
            {/* Overall Recommendation */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {suggestions.overallRecommendation}
                </p>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'levels' && (
              <div className="space-y-3">
                {suggestions.levelSuggestions.map((suggestion) => (
                  <LevelSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={
                      onApplySuggestion
                        ? () => onApplySuggestion(suggestion.dimensionId, suggestion.suggestedLevel)
                        : undefined
                    }
                    isPolish={isPolish}
                  />
                ))}
                {suggestions.levelSuggestions.length === 0 && (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {isPolish
                      ? 'Brak sugestii poziomów do wyświetlenia'
                      : 'No level suggestions to display'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'technologies' && (
              <div className="space-y-3">
                {suggestions.technologySuggestions.map((tech) => (
                  <TechnologyCard
                    key={tech.id}
                    technology={tech}
                    onSelect={onSelectTechnology ? () => onSelectTechnology(tech) : undefined}
                    isPolish={isPolish}
                  />
                ))}
                {suggestions.technologySuggestions.length === 0 && (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {isPolish
                      ? 'Brak sugestii technologii do wyświetlenia'
                      : 'No technology suggestions to display'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'gaps' && (
              <div className="space-y-3">
                {suggestions.gapAnalysis.map((gap, index) => (
                  <GapAnalysisCard key={index} gap={gap} isPolish={isPolish} />
                ))}
                {suggestions.gapAnalysis.length === 0 && (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                    {isPolish ? 'Brak luk do wyświetlenia' : 'No gaps to display'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'roadmap' && (
              <div className="space-y-3">
                {suggestions.prioritizedRoadmap.map((phase) => (
                  <RoadmapPhaseCard key={phase.phase} phase={phase} isPolish={isPolish} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AISuggestionPanel;
