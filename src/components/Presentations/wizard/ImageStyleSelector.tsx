import { BarChart3, Camera, Factory, Hexagon, Palette, Type } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { IMAGE_STYLE_PRESETS, type ImageStylePreset } from './types';

const STYLE_ICONS: Record<string, React.FC<{ className?: string; size?: number }>> = {
  Camera,
  Hexagon,
  Palette,
  BarChart3,
  Factory,
  Type,
};

interface ImageStyleSelectorProps {
  value: ImageStylePreset;
  onChange: (preset: ImageStylePreset) => void;
}

export const ImageStyleSelector: React.FC<ImageStyleSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {t('presentations.wizard.imageStylePreset', 'Image Style')}
      </label>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {IMAGE_STYLE_PRESETS.map((style) => {
          const Icon = STYLE_ICONS[style.icon] || Camera;
          const selected = value === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onChange(style.id)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                selected
                  ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.06]'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <Icon
                className={`w-5 h-5 mx-auto mb-1.5 ${selected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600'}`}
              />
              <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-tight">
                {t(style.labelKey, style.id.replace(/_/g, ' '))}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
