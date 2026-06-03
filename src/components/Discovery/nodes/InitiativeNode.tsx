/**
 * InitiativeNode - Blue/Indigo card for initiative ideas
 *
 * Displays initiative ideas generated from discovery.
 */

import { Rocket, Sparkles, Zap } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { InitiativeNodeData } from '@/types/discovery';

const ImpactEffortBadge: React.FC<{ impact: string; effort: string }> = ({ impact, effort }) => {
  const impactColors = {
    low: 'text-slate-500 dark:text-slate-400',
    medium: 'text-amber-500',
    high: 'text-green-500',
  };
  const effortColors = {
    low: 'text-green-500',
    medium: 'text-amber-500',
    high: 'text-rose-500',
  };

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className={impactColors[impact as keyof typeof impactColors]}>Impact: {impact}</span>
      <span className="text-slate-600">|</span>
      <span className={effortColors[effort as keyof typeof effortColors]}>Effort: {effort}</span>
    </div>
  );
};

export const InitiativeNode: React.FC<NodeProps<InitiativeNodeData>> = memo(
  ({ data, selected }) => {
    const { t } = useTranslation('discovery');
    const { title, description, impact, effort, quickWin } = data;

    return (
      <div
        className={`
                group relative
                bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20
                border-2 ${selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-indigo-300 dark:border-indigo-700'}
                rounded-xl p-3
                min-w-[190px] max-w-[240px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-white dark:!border-navy-900"
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <Rocket size={14} className="text-indigo-500" />
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
              {t('discovery.nodes.initiative.title', 'Initiative')}
            </span>
          </div>
          {quickWin && (
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
              <Zap size={10} />
              Quick Win
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">{title}</h4>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
            {description}
          </p>
        )}

        {/* Impact/Effort */}
        <ImpactEffortBadge impact={impact} effort={effort} />

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-indigo-400 !border-2 !border-white dark:!border-navy-900"
        />
      </div>
    );
  }
);

InitiativeNode.displayName = 'InitiativeNode';

export default InitiativeNode;
