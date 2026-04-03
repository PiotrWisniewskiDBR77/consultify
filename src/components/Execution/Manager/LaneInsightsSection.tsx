/**
 * LaneInsightsSection
 *
 * System-generated interpretations from observations.
 * Shows confidence level, whether the issue is systemic, and action-required flag.
 */

import { AlertCircle, Lightbulb, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Callout } from '../../shared/NModeBlocks/Callout';
import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import type { InsightItem } from './types';

const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
};

interface LaneInsightsSectionProps {
  insights: InsightItem[];
  defaultOpen?: boolean;
}

export const LaneInsightsSection: React.FC<LaneInsightsSectionProps> = ({
  insights,
  defaultOpen = true,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const actionRequired = insights.filter((i) => i.requiresAction);
  const informational = insights.filter((i) => !i.requiresAction);

  return (
    <ToggleBlock
      title={isPolish ? 'Wnioski' : 'Insights'}
      badge={insights.length}
      defaultOpen={defaultOpen}
      icon={<Lightbulb size={14} />}
    >
      {insights.length === 0 ? (
        <EmptyStateInline
          icon={Sparkles}
          message={isPolish ? 'Brak wniosków — za mało danych do analizy.' : 'No insights — insufficient data for analysis.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-2">
          {actionRequired.length > 0 && actionRequired.map((ins) => (
            <Callout
              key={ins.id}
              variant={ins.isSystemic ? 'critical' : 'warning'}
              compact
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{ins.interpretation}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[10px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[ins.confidence]}`} />
                      {ins.confidence}
                    </span>
                    {ins.isSystemic && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        {isPolish ? 'Systemowe' : 'Systemic'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Callout>
          ))}
          {informational.map((ins) => (
            <div
              key={ins.id}
              className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-slate-50/30 dark:bg-navy-900/20"
            >
              <Lightbulb size={13} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-300">{ins.interpretation}</p>
                <span className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOT[ins.confidence]}`} />
                  {ins.confidence}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneInsightsSection;
