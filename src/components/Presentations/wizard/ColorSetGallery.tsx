import { Check, Crown } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CURATED_COLOR_SETS, type CuratedColorSet } from './types';

interface ColorSetGalleryProps {
  value: string;
  onChange: (colorSetId: string) => void;
  brandKitColors?: { primary: string; secondary: string; accent: string } | null;
}

export const ColorSetGallery: React.FC<ColorSetGalleryProps> = ({
  value,
  onChange,
  brandKitColors,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {t('presentations.wizard.colorSet', 'Color Palette')}
      </label>
      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
        {brandKitColors && (
          <button
            onClick={() => onChange('brand_kit')}
            className={`relative p-2 rounded-lg border-2 text-center transition-all ${
              value === 'brand_kit'
                ? 'border-c-info shadow-md shadow-c-info/10'
                : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
            }`}
          >
            <div className="flex gap-0.5 h-6 rounded overflow-hidden mb-1.5">
              <div className="flex-1" style={{ backgroundColor: brandKitColors.primary }} />
              <div className="flex-1" style={{ backgroundColor: brandKitColors.secondary }} />
              <div className="flex-1" style={{ backgroundColor: brandKitColors.accent }} />
            </div>
            <div className="flex items-center justify-center gap-1">
              <Crown size={10} className="text-amber-500" />
              <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                {t('presentations.wizard.brandKit', 'Brand Kit')}
              </p>
            </div>
            {value === 'brand_kit' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-navy-900 flex items-center justify-center">
                <Check size={10} className="text-white" />
              </div>
            )}
          </button>
        )}

        {CURATED_COLOR_SETS.map((set: CuratedColorSet) => {
          const selected = value === set.id;
          return (
            <button
              key={set.id}
              onClick={() => onChange(set.id)}
              className={`relative p-2 rounded-lg border-2 text-center transition-all ${
                selected
                  ? 'border-c-info shadow-md shadow-c-info/10'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
              }`}
            >
              <div className="flex gap-0.5 h-6 rounded overflow-hidden mb-1.5">
                <div className="flex-1" style={{ backgroundColor: set.colors.primary }} />
                <div className="flex-1" style={{ backgroundColor: set.colors.secondary }} />
                <div className="flex-1" style={{ backgroundColor: set.colors.accent }} />
                <div className="flex-1" style={{ backgroundColor: set.colors.background }} />
              </div>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                {set.name}
              </p>
              {selected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-navy-900 flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
