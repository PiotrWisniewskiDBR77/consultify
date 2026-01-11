/**
 * RecommendationPanel - Right side panel showing recommendations
 *
 * Displays transformation recommendations, suggested assessments,
 * tools, and initiative ideas generated from discovery.
 */

import {
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Lightbulb,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getFrameworkConfig, FrameworkId } from '@/services/frameworkRegistry';
import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import { DiscoveryRecommendations, InitiativeIdea, TransformationType } from '@/types/discovery';

import { getToolById } from '../../config/transformationTools';

// Transformation type card
const TransformationTypeCard: React.FC<{
  type: TransformationType | null;
  matchScore: number;
  reasoning: string;
}> = ({ type, matchScore, reasoning }) => {
  const { t } = useTranslation('discovery');

  if (!type) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-navy-800 rounded-xl border border-dashed border-slate-200 dark:border-navy-700">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          {t(
            'discovery.recommendations.noRecommendations',
            'Continue the conversation to receive recommendations'
          )}
        </p>
      </div>
    );
  }

  const typeIcons: Record<TransformationType, React.ReactNode> = {
    strategic: <Target className="text-purple-500" size={24} />,
    operational: <Wrench className="text-blue-500" size={24} />,
    digital: <Sparkles className="text-cyan-500" size={24} />,
  };

  const typeColors: Record<TransformationType, string> = {
    strategic: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
    operational: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
    digital: 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${typeColors[type]}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white dark:bg-navy-800 rounded-lg shadow-sm">{typeIcons[type]}</div>
        <div className="flex-1">
          <h4 className="font-semibold text-navy-900 dark:text-white">
            {t(`discovery.transformationType.${type}`, type)}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('discovery.recommendations.matchScore', 'Match')}:
            </span>
            <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${matchScore}%` }}
              />
            </div>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {matchScore}%
            </span>
          </div>
          {reasoning && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{reasoning}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Assessment suggestion item
const AssessmentItem: React.FC<{ frameworkId: string }> = ({ frameworkId }) => {
  // Try to get framework config, handle gracefully if not found
  let framework;
  try {
    framework = getFrameworkConfig(frameworkId as FrameworkId);
  } catch {
    return null;
  }
  if (!framework) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-navy-800 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
      <ClipboardList size={16} className="text-cyan-500" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-navy-900 dark:text-white truncate block">
          {framework.id}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {framework.fullName}
        </span>
      </div>
      <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
    </div>
  );
};

// Tool suggestion item
const ToolItem: React.FC<{ toolId: string }> = ({ toolId }) => {
  const tool = getToolById(toolId);
  if (!tool) return null;

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-navy-800 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
      <Wrench size={16} className="text-purple-500" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-navy-900 dark:text-white truncate block">
          {tool.name}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {tool.category}
        </span>
      </div>
    </div>
  );
};

// Initiative idea item
const InitiativeItem: React.FC<{ initiative: InitiativeIdea }> = ({ initiative }) => {
  return (
    <div className="p-3 bg-white dark:bg-navy-800 rounded-lg border border-slate-100 dark:border-navy-700">
      <div className="flex items-start gap-2">
        <Lightbulb size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <h5 className="text-sm font-medium text-navy-900 dark:text-white">{initiative.title}</h5>
          {initiative.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {initiative.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {initiative.quickWin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-medium">
                ⚡ Quick Win
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Impact: {initiative.impact} | Effort: {initiative.effort}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RecommendationPanel: React.FC = () => {
  const { t } = useTranslation('discovery');
  const { recommendations, painPointsCount, insightsCount, currentPhase } = useDiscoveryStore();

  const hasRecommendations = recommendations.transformationType !== null;
  const showPanel =
    currentPhase === 'recommendations' || currentPhase === 'decision' || hasRecommendations;

  if (!showPanel) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-navy-900 p-4 border-l border-slate-200 dark:border-navy-700">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <CheckCircle size={20} className="text-green-500" />
          <h3 className="font-bold text-navy-900 dark:text-white">
            {t('discovery.recommendations.title', 'Recommendations')}
          </h3>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {painPointsCount}
            </div>
            <div className="text-xs text-red-500 dark:text-red-400">
              {t('discovery.conversion.painPointsCount', { count: painPointsCount })}
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {insightsCount}
            </div>
            <div className="text-xs text-amber-500 dark:text-amber-400">
              {t('discovery.conversion.insightsCount', { count: insightsCount })}
            </div>
          </div>
        </div>

        {/* Transformation Type */}
        <TransformationTypeCard
          type={recommendations.transformationType}
          matchScore={recommendations.matchScore}
          reasoning={recommendations.reasoning}
        />

        {/* Suggested Assessments */}
        {recommendations.frameworks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
              {t('discovery.recommendations.suggestedAssessments', 'Suggested Assessments')}
            </h4>
            <div className="space-y-2">
              {recommendations.frameworks.map((fwId) => (
                <AssessmentItem key={fwId} frameworkId={fwId} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Tools */}
        {recommendations.tools.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
              {t('discovery.recommendations.suggestedTools', 'Recommended Tools')}
            </h4>
            <div className="space-y-2">
              {recommendations.tools.slice(0, 5).map((toolId) => (
                <ToolItem key={toolId} toolId={toolId} />
              ))}
            </div>
          </div>
        )}

        {/* Initiative Ideas */}
        {recommendations.initiatives.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">
              {t('discovery.recommendations.initiativeIdeas', 'Initiative Ideas')}
            </h4>
            <div className="space-y-2">
              {recommendations.initiatives.slice(0, 4).map((init) => (
                <InitiativeItem key={init.id} initiative={init} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationPanel;
