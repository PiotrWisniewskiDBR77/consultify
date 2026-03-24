import {
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  Layout,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SourceArtifact } from './types';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Target,
  ClipboardList,
  FileText,
  TrendingUp,
  Zap,
  Layout,
  Shield,
};

const SOURCE_TYPES = [
  { type: 'initiative_portfolio', icon: 'Target', color: 'text-blue-500' },
  { type: 'kpi_roi', icon: 'TrendingUp', color: 'text-amber-500' },
  { type: 'assessment', icon: 'FileText', color: 'text-purple-500' },
  { type: 'raid', icon: 'Shield', color: 'text-red-500' },
  { type: 'execution_status', icon: 'ClipboardList', color: 'text-emerald-500' },
  { type: 'tool_session', icon: 'Zap', color: 'text-cyan-500' },
];

interface SourceStepProps {
  selectedSources: SourceArtifact[];
  onToggleSource: (type: string) => void;
  onNext: () => void;
}

export const SourceStep: React.FC<SourceStepProps> = ({
  selectedSources,
  onToggleSource,
  onNext,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('presentations.sources.title', 'Select Data Sources')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {t(
            'presentations.sources.subtitle',
            'Choose which platform artifacts to include in your deck.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {SOURCE_TYPES.map(({ type, icon, color }) => {
          const Icon = ICON_MAP[icon] || Target;
          const selected = selectedSources.some((s) => s.type === type);
          return (
            <button
              key={type}
              onClick={() => onToggleSource(type)}
              className={`p-5 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-purple-500 bg-purple-500/5 shadow-lg shadow-purple-500/10'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <Icon className={`w-8 h-8 ${color} mb-3`} />
              <p className="font-semibold text-slate-900 dark:text-white">
                {t(`presentations.sources.${type}`, type.replace(/_/g, ' '))}
              </p>
              {selected && (
                <div className="mt-2 flex items-center gap-1 text-xs text-purple-500 font-medium">
                  <Check size={12} /> {t('common.selected', 'Selected')}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={selectedSources.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next', 'Next')} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
