import { Check, ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TRANSITION_COLORS } from '../canvas/motionTokens';
import {
  type FacilitationPhase,
  FACILITATION_PHASES,
  FACILITATION_TRANSITIONS,
} from './whiteboardContracts';

const PHASE_HINTS: Record<FacilitationPhase, { hintEn: string; hintPl: string }> = {
  start: {
    hintEn: 'Capture ideas freely',
    hintPl: 'Swobodnie zbieraj pomysły',
  },
  organize: {
    hintEn: 'Cluster and arrange',
    hintPl: 'Grupuj i porządkuj',
  },
  converge: {
    hintEn: 'Mark top outcomes',
    hintPl: 'Oznacz najlepsze wyniki',
  },
  handoff: {
    hintEn: 'Export and share results',
    hintPl: 'Eksportuj i udostępnij wyniki',
  },
};

export interface WhiteboardPhaseBarProps {
  isPl: boolean;
  currentPhase: FacilitationPhase;
  locked?: boolean;
  onPhaseChange: (phase: FacilitationPhase) => void;
}

export const WhiteboardPhaseBar: React.FC<WhiteboardPhaseBarProps> = ({
  isPl,
  currentPhase,
  locked,
  onPhaseChange,
}) => {
  const { t } = useTranslation();
  const currentIdx = FACILITATION_PHASES.indexOf(currentPhase);
  const validTargets = FACILITATION_TRANSITIONS[currentPhase];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {t('myWork.whiteboard.phaseBar.title')}
      </div>
      <div className="flex items-center gap-0.5" role="tablist" aria-label={t('myWork.whiteboard.phaseBar.tabsAria')}>
        {FACILITATION_PHASES.map((phase, idx) => {
          const isCurrent = phase === currentPhase;
          const isCompleted = idx < currentIdx;
          const isReachable = validTargets.includes(phase);

          return (
            <React.Fragment key={phase}>
              {idx > 0 && (
                <ChevronRight
                  size={10}
                  className={`shrink-0 ${idx <= currentIdx ? 'text-primary-500' : 'text-slate-300 dark:text-slate-600'}`}
                />
              )}
              <button
                type="button"
                role="tab"
                aria-selected={isCurrent}
                disabled={locked || (!isCurrent && !isReachable)}
                title={
                  !isCurrent && isReachable && !locked
                    ? t('myWork.whiteboard.facilitation.advanceTo', {
                        phase: t(`myWork.whiteboard.facilitation.${phase}`),
                      })
                    : undefined
                }
                onClick={() => {
                  if (!isCurrent && isReachable) onPhaseChange(phase);
                }}
                className={`${TRANSITION_COLORS} inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap disabled:opacity-40 ${
                  isCurrent
                    ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/20'
                    : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                }`}
              >
                {isCompleted && <Check size={10} />}
                {t(`myWork.whiteboard.facilitation.${phase}`)}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-[9px] text-slate-400 dark:text-slate-500 italic">
        {t(`myWork.whiteboard.phaseBar.hint_${currentPhase}`, { defaultValue: PHASE_HINTS[currentPhase].hintEn })}
      </div>
    </div>
  );
};
