import { FileText, Monitor, Users, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PRESENTATION_MODES, type PresentationMode } from './types';

const MODE_ICONS: Record<string, React.FC<{ className?: string; size?: number }>> = {
  Monitor,
  FileText,
  Zap,
  Users,
};

interface PresentationModeSelectorProps {
  value: PresentationMode;
  onChange: (mode: PresentationMode) => void;
}

export const PresentationModeSelector: React.FC<PresentationModeSelectorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        {t('presentations.wizard.presentationMode', 'Presentation Mode')}
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESENTATION_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode.icon] || Monitor;
          const selected = value === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onChange(mode.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.06] shadow-sm'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <Icon
                className={`w-6 h-6 mb-2 ${selected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600'}`}
              />
              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                {t(mode.labelKey, mode.id)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {t(mode.descriptionKey, '')}
              </p>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>{t('presentations.wizard.wordsPerSlide', 'Words/slide')}</span>
                  <span className="font-mono">{mode.wordsPerSlide}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>{t('presentations.wizard.typicalSlides', 'Slides')}</span>
                  <span className="font-mono">{mode.typicalSlides}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>{t('presentations.wizard.animations', 'Animations')}</span>
                  <span className="font-mono">{mode.animations ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
