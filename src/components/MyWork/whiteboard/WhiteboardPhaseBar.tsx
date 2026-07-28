import { Check, ChevronRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TRANSITION_COLORS } from '../canvas/motionTokens';
import {
  FACILITATION_PHASES,
  FACILITATION_TRANSITIONS,
  type FacilitationPhase,
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
  /**
   * `true` = pasek faz może zawinąć się do drugiego wiersza. Używane w wersji
   * panelowej (`WhiteboardSessionPanel embedded`), gdzie kolumna jest węższa
   * niż overlay nad płótnem i ostatnia faza („Przekazanie") wychodziła poza
   * kartę. Domyślnie OFF — układ nad płótnem zostaje 1:1 jak dziś.
   */
  wrap?: boolean;
}

export const WhiteboardPhaseBar: React.FC<WhiteboardPhaseBarProps> = ({
  isPl,
  currentPhase,
  locked,
  onPhaseChange,
  wrap,
}) => {
  const { t } = useTranslation();
  const currentIdx = FACILITATION_PHASES.indexOf(currentPhase);
  const validTargets = FACILITATION_TRANSITIONS[currentPhase];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
        {t('myWork.whiteboard.phaseBar.title')}
      </div>
      <div
        className={`flex items-center gap-0.5 ${wrap ? 'flex-wrap' : ''}`}
        role="tablist"
        aria-label={t('myWork.whiteboard.phaseBar.tabsAria')}
      >
        {FACILITATION_PHASES.map((phase, idx) => {
          const isCurrent = phase === currentPhase;
          const isCompleted = idx < currentIdx;
          const isReachable = validTargets.includes(phase);

          return (
            <React.Fragment key={phase}>
              {idx > 0 && (
                <ChevronRight
                  size={10}
                  className={`shrink-0 ${idx <= currentIdx ? 'text-c-text-secondary' : 'text-c-text-secondary'}`}
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
                    ? 'bg-c-surface-raised text-c-text ring-1 ring-c-border-strong'
                    : isCompleted
                      ? 'bg-success-500/10 text-success-600 dark:text-success-400'
                      : 'text-c-text-muted hover:bg-c-surface-raised'
                }`}
              >
                {isCompleted && <Check size={10} />}
                {t(`myWork.whiteboard.facilitation.${phase}`)}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-[9px] text-c-text-secondary italic">
        {t(`myWork.whiteboard.phaseBar.hint_${currentPhase}`, {
          defaultValue: PHASE_HINTS[currentPhase].hintEn,
        })}
      </div>
    </div>
  );
};
