/**
 * RecommendationNode - Blue card for transformation recommendation
 *
 * Displays the main transformation recommendation with confidence score.
 * Larger than other nodes, placed in recommendations section.
 */

import { CheckCircle, Sparkles, Target } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { RecommendationNodeData, TransformationType } from '@/types/discovery';

// Confidence meter component
const ConfidenceMeter: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{score}%</span>
    </div>
  );
};

// Transformation type badge
const TransformationBadge: React.FC<{ type: TransformationType }> = ({ type }) => {
  const { t } = useTranslation('discovery');

  const config: Record<TransformationType, { color: string; icon: string }> = {
    strategic: {
      color:
        'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700',
      icon: '🎯',
    },
    operational: {
      color:
        'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
      icon: '⚙️',
    },
    digital: {
      color:
        'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
      icon: '💻',
    },
  };

  const { color, icon } = config[type];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-lg">{icon}</span>
      <span className="font-semibold text-sm">
        {t(`discovery.transformationType.${type}`, type)}
      </span>
    </div>
  );
};

export const RecommendationNode: React.FC<NodeProps<RecommendationNodeData>> = memo(
  ({ data, selected }) => {
    const { t } = useTranslation('discovery');
    const { title, type, confidence, reasoning } = data;

    return (
      <div
        className={`
                relative
                bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20
                border-2 ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-300 dark:border-blue-700'}
                rounded-xl p-4
                min-w-[280px] max-w-[340px]
                shadow-lg hover:shadow-xl
                transition-all duration-200
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-navy-900"
        />

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <CheckCircle size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
              <Sparkles size={10} />
              {t('discovery.nodes.recommendation.title', 'Recommendation')}
            </span>
            <h3 className="text-base font-bold text-navy-900 dark:text-white">{title}</h3>
          </div>
        </div>

        {/* Transformation Type */}
        <div className="mb-3">
          <TransformationBadge type={type} />
        </div>

        {/* Confidence Score */}
        <div className="mb-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('discovery.nodes.recommendation.confidence', 'Confidence')}
          </div>
          <ConfidenceMeter score={confidence} />
        </div>

        {/* Reasoning */}
        {reasoning && (
          <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {reasoning}
            </p>
          </div>
        )}

        {/* Decorative icon */}
        <div className="absolute top-3 right-3 opacity-10">
          <Target size={48} className="text-blue-500" />
        </div>

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white dark:!border-navy-900"
        />
      </div>
    );
  }
);

RecommendationNode.displayName = 'RecommendationNode';

export default RecommendationNode;
