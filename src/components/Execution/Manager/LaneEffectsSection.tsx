/**
 * LaneEffectsSection
 *
 * Consequences of inaction: blast radius, cost/timeline impact, affected entities.
 */

import { Flame, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import type { EffectItem } from './types';

interface LaneEffectsSectionProps {
  effects: EffectItem[];
  defaultOpen?: boolean;
}

export const LaneEffectsSection: React.FC<LaneEffectsSectionProps> = ({
  effects,
  defaultOpen = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  return (
    <ToggleBlock
      title={isPolish ? 'Skutki' : 'Effects'}
      badge={effects.length}
      defaultOpen={defaultOpen}
      icon={<Zap size={14} />}
    >
      {effects.length === 0 ? (
        <EmptyStateInline
          icon={Zap}
          message={isPolish ? 'Brak zidentyfikowanych skutków.' : 'No effects identified.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-2">
          {effects.map((eff) => (
            <div
              key={eff.id}
              className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-rose-500/[0.04] dark:bg-rose-500/[0.06]"
            >
              <Flame size={13} className="text-rose-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200">{eff.consequence}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Zasięg' : 'Blast radius'}: <span className="font-semibold text-slate-600 dark:text-slate-300">{eff.blastRadius}</span>
                  </span>
                  {eff.timelineImpact && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      ⏱ {eff.timelineImpact}
                    </span>
                  )}
                  {eff.costImpact && (
                    <span className="text-[11px] text-rose-600 dark:text-rose-400">
                      💰 {eff.costImpact}
                    </span>
                  )}
                </div>
                {eff.affectedEntities && eff.affectedEntities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {eff.affectedEntities.slice(0, 5).map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400"
                      >
                        {e.name}
                      </span>
                    ))}
                    {eff.affectedEntities.length > 5 && (
                      <span className="text-[10px] text-slate-400">
                        +{eff.affectedEntities.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneEffectsSection;
