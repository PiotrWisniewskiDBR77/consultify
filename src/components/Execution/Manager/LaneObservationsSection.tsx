/**
 * LaneObservationsSection
 *
 * Renders raw observation data within a ToggleBlock.
 * Each observation shows metric, scope, trend, and severity.
 */

import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Eye } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import { AiManageButton } from './AiManageButton';
import type { ObservationItem } from './types';

const TREND_ICON: Record<string, React.ElementType> = {
  rising: ArrowUpRight,
  stable: ArrowRight,
  improving: ArrowDownRight,
};

const SEVERITY_STYLE: Record<string, string> = {
  info: 'bg-slate-400/10 text-slate-500 dark:text-slate-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

interface LaneObservationsSectionProps {
  observations: ObservationItem[];
  defaultOpen?: boolean;
  onObservationClick?: (id: string) => void;
  onAiManage?: (signalId: string) => void;
  aiManageLoading?: string | null;
}

export const LaneObservationsSection: React.FC<LaneObservationsSectionProps> = ({
  observations,
  defaultOpen = true,
  onObservationClick,
  onAiManage,
  aiManageLoading,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <ToggleBlock
      title={isPolish ? 'Obserwacje' : 'Observations'}
      badge={observations.length}
      defaultOpen={defaultOpen}
      icon={<Eye size={14} />}
    >
      {observations.length === 0 ? (
        <EmptyStateInline
          icon={Activity}
          message={isPolish ? 'Brak obserwacji — dane w normie.' : 'No observations — data within normal range.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-2">
          {observations.map((obs) => {
            const TrendIcon = TREND_ICON[obs.trend] || ArrowRight;
            return (
              <div
                key={obs.id}
                className="w-full flex items-start gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50/50 dark:hover:bg-navy-800/30 transition-colors text-left group"
              >
                <button
                  type="button"
                  onClick={() => onObservationClick?.(obs.id)}
                  className="flex items-start gap-2.5 flex-1 min-w-0 text-left"
                >
                  <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md ${SEVERITY_STYLE[obs.severity]}`}>
                    <TrendIcon size={12} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-200">{obs.metric}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {obs.entityName || obs.scope}
                      {obs.since && ` · ${isPolish ? 'od' : 'since'} ${new Date(obs.since).toLocaleDateString()}`}
                    </p>
                  </div>
                </button>
                {onAiManage && (
                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AiManageButton
                      onClick={() => onAiManage(obs.id)}
                      loading={aiManageLoading === obs.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneObservationsSection;
