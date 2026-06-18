/**
 * PainPointNode - Red/Orange sticky note for pain points
 *
 * Displays identified problems/challenges from discovery conversation.
 * Visual severity indicator with dots (●●●○○).
 */

import { AlertCircle, Trash2 } from 'lucide-react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, NodeProps, Position } from 'reactflow';

import { PainArea, PainPointNodeData } from '@/types/discovery';

// Severity dot component
const SeverityDots: React.FC<{ level: 1 | 2 | 3 | 4 | 5 }> = ({ level }) => {
  return (
    <div className="flex items-center gap-0.5" title={`Severity: ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i <= level ? 'bg-danger-400 dark:bg-danger-400' : 'bg-slate-300 dark:bg-danger-800'
          }`}
        />
      ))}
    </div>
  );
};

// Area badge component
const AreaBadge: React.FC<{ area: PainArea }> = ({ area }) => {
  const { t } = useTranslation('discovery');

  const areaConfig: Record<PainArea, { color: string; icon: string }> = {
    process: {
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: '⚙️',
    },
    technology: {
      color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
      icon: '💻',
    },
    people: {
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: '👥',
    },
    data: {
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      icon: '📊',
    },
  };

  const config = areaConfig[area] || {
    color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    icon: '⚠️',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}
    >
      <span>{config.icon}</span>
      {t(`discovery.areas.${area}`, area)}
    </span>
  );
};

export const PainPointNode: React.FC<NodeProps<PainPointNodeData>> = memo(
  ({ data, selected, id }) => {
    const { t } = useTranslation('discovery');
    const { text, severity, area, impact, source } = data;

    return (
      <div
        className={`
                group relative
                bg-danger-50 dark:bg-danger-900/20
                border-2 ${selected ? 'border-danger-500 ring-2 ring-danger-500/30' : 'border-danger-300 dark:border-danger-700'}
                rounded-xl p-3
                min-w-[180px] max-w-[220px]
                shadow-md hover:shadow-lg
                transition-all duration-200
                cursor-move
            `}
      >
        {/* Input Handle (left) */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-danger-400 !border-2 !border-white dark:!border-navy-900"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🔴</span>
            <span className="text-[10px] font-semibold text-danger-600 dark:text-danger-400 uppercase tracking-wide">
              {t('discovery.nodes.painPoint.title', 'Pain Point')}
            </span>
          </div>
          <SeverityDots level={severity} />
        </div>

        {/* Content */}
        <p className="text-sm font-medium text-danger-900 dark:text-danger-100 line-clamp-3 mb-2">
          {text}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between gap-2">
          <AreaBadge area={area} />
          {source === 'ai' && (
            <span className="text-[9px] text-danger-400 dark:text-danger-500 flex items-center gap-0.5">
              <AlertCircle size={10} />
              AI
            </span>
          )}
        </div>

        {/* Impact (if provided) */}
        {impact && (
          <div className="mt-2 pt-2 border-t border-danger-200 dark:border-danger-800">
            <span className="text-xs text-danger-600 dark:text-danger-400">
              <strong>{t('discovery.nodes.painPoint.impact', 'Impact')}:</strong> {impact}
            </span>
          </div>
        )}

        {/* Delete button (on hover) */}
        <button
          className="
                    absolute -top-2 -right-2
                    w-5 h-5 rounded-full
                    bg-danger-500 text-white
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100
                    hover:bg-danger-600
                    transition-all duration-200
                    shadow-md
                "
          onClick={(e) => {
            e.stopPropagation();
            // Delete will be handled by parent via onNodeDelete
          }}
          title={t('discovery.tooltips.deleteNode', 'Delete')}
        >
          <Trash2 size={10} />
        </button>

        {/* Output Handle (right) */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-danger-400 !border-2 !border-white dark:!border-navy-900"
        />
      </div>
    );
  }
);

PainPointNode.displayName = 'PainPointNode';

export default PainPointNode;
