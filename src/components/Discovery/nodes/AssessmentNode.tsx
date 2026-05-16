/**
 * AssessmentNode - Cyan card for recommended assessments
 *
 * Displays assessment frameworks recommended from discovery.
 */

import { ClipboardCheck } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { AssessmentNodeData } from '@/types/discovery';

// Framework colors mapping
const frameworkColors: Record<string, { bg: string; text: string; border: string }> = {
  DRD: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-600 dark:text-primary-400',
    border: 'border-primary-300 dark:border-primary-700',
  },
  SIRI: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
  ADMA: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-300 dark:border-green-700',
  },
  CMMI: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
  },
  LEAN: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
  },
};

export const AssessmentNode: React.FC<NodeProps<AssessmentNodeData>> = memo(
  ({ data, selected }) => {
    const { t } = useTranslation('discovery');
    const { frameworkId, name, description, relevanceScore } = data;

    const colors = frameworkColors[frameworkId] || frameworkColors.DRD;

    return (
      <div
        className={`
                group relative
                ${colors.bg}
                border-2 ${selected ? `${colors.border} ring-2 ring-blue-500/30` : colors.border}
                rounded-xl p-3
                min-w-[170px] max-w-[210px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-navy-900"
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className={colors.text} />
            <span className={`text-xs font-bold ${colors.text}`}>{frameworkId}</span>
          </div>
          {relevanceScore && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20 text-slate-600 dark:text-slate-300">
              {relevanceScore}%
            </span>
          )}
        </div>

        {/* Name */}
        <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">{name}</h4>

        {/* Description */}
        {description && (
          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
            {description}
          </p>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-white dark:!border-navy-900"
        />
      </div>
    );
  }
);

AssessmentNode.displayName = 'AssessmentNode';

export default AssessmentNode;
