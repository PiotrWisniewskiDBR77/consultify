/**
 * CoThinkerModeSelector — 5 business mode buttons for Co-Thinker (T006)
 *
 * Modes:
 * 1. Multi-Consultant Panel
 * 2. Idea Maker
 * 3. Competitive Analyst
 * 4. Risk Challenger
 * 5. Executive Editor
 */

import { FileText, Lightbulb, ShieldAlert, Target, Users, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

type CoThinkerMode =
  | 'multi_consultant'
  | 'idea_maker'
  | 'competitive_analyst'
  | 'risk_challenger'
  | 'executive_editor';

interface ModeConfig {
  id: CoThinkerMode;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  color: string;
  bgColor: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'multi_consultant',
    icon: Users,
    labelKey: 'chat.coThinker.multiConsultant',
    descKey: 'chat.coThinker.multiConsultantDesc',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  },
  {
    id: 'idea_maker',
    icon: Lightbulb,
    labelKey: 'chat.coThinker.ideaMaker',
    descKey: 'chat.coThinker.ideaMakerDesc',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
  {
    id: 'competitive_analyst',
    icon: Target,
    labelKey: 'chat.coThinker.competitiveAnalyst',
    descKey: 'chat.coThinker.competitiveAnalystDesc',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
  },
  {
    id: 'risk_challenger',
    icon: ShieldAlert,
    labelKey: 'chat.coThinker.riskChallenger',
    descKey: 'chat.coThinker.riskChallengerDesc',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  },
  {
    id: 'executive_editor',
    icon: FileText,
    labelKey: 'chat.coThinker.executiveEditor',
    descKey: 'chat.coThinker.executiveEditorDesc',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  },
];

interface CoThinkerModeSelectorProps {
  className?: string;
}

export const CoThinkerModeSelector: React.FC<CoThinkerModeSelectorProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const activeMode = aiConfig?.coThinkerMode as CoThinkerMode | null;

  const handleSelect = (mode: CoThinkerMode) => {
    if (activeMode === mode) {
      setAIConfig({ coThinkerMode: null } as any);
    } else {
      setAIConfig({ coThinkerMode: mode } as any);
    }
  };

  const handleClear = () => {
    setAIConfig({ coThinkerMode: null } as any);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {activeMode && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('chat.coThinker.activeMode', 'Active Mode')}
          </span>
          <button
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
          >
            <X size={12} />
            {t('chat.coThinker.clear', 'Clear')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => handleSelect(mode.id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
                ${
                  isActive
                    ? `${mode.bgColor} ring-1 ring-offset-1 ring-current ${mode.color}`
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700'
                }
              `}
            >
              <div
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? mode.bgColor : 'bg-slate-100 dark:bg-navy-700'
                }`}
              >
                <Icon
                  size={16}
                  className={isActive ? mode.color : 'text-slate-500 dark:text-slate-400'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${
                    isActive ? mode.color : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t(mode.labelKey, mode.id.replace(/_/g, ' '))}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t(mode.descKey, '')}
                </div>
              </div>
              {isActive && (
                <div
                  className={`shrink-0 w-2 h-2 rounded-full ${mode.color.replace('text-', 'bg-')}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const CoThinkerModeBadge: React.FC<{
  mode: string | null;
  className?: string;
}> = ({ mode, className = '' }) => {
  const { t } = useTranslation();

  if (!mode) return null;

  const config = MODES.find((m) => m.id === mode);
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
    >
      <Icon size={12} />
      {t(config.labelKey, config.id.replace(/_/g, ' '))}
    </span>
  );
};

export default CoThinkerModeSelector;
