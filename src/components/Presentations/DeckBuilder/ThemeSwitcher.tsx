/**
 * ThemeSwitcher — panel that opens from the "Theme" button in the top bar.
 * Shows Brand Kit (if available) first, then curated color sets grid.
 * Live preview: changing theme instantly re-renders all blocks.
 */

import { Check, Crown, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CURATED_COLOR_SETS, type CuratedColorSet } from '../wizard/types';
import { useDeckTheme } from './DeckThemeContext';

interface ThemeSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { colorSetId, setColorSetId, brandKit, theme } = useDeckTheme();

  if (!isOpen) return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[420px] bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-white">
          {t('presentations.builder.topBar.theme', 'Theme')}
        </h3>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {/* Current theme preview */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800">
        <p className="text-[10px] text-slate-600 uppercase mb-2">Aktywny motyw</p>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 h-8 w-24 rounded-lg overflow-hidden">
            <div className="flex-1" style={{ backgroundColor: theme.colors.primary }} />
            <div className="flex-1" style={{ backgroundColor: theme.colors.secondary }} />
            <div className="flex-1" style={{ backgroundColor: theme.colors.accent }} />
            <div className="flex-1" style={{ backgroundColor: theme.colors.background }} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-white">{theme.name}</p>
            <p className="text-[10px] text-slate-600">{theme.styleTags.join(' / ')}</p>
          </div>
        </div>
        {/* Font preview */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
          <span>
            Heading:{' '}
            <strong style={{ fontFamily: theme.fonts.headingFamily }}>
              {theme.fonts.headingFamily}
            </strong>
          </span>
          <span>
            Body:{' '}
            <span style={{ fontFamily: theme.fonts.bodyFamily }}>{theme.fonts.bodyFamily}</span>
          </span>
        </div>
      </div>

      {/* Palette grid */}
      <div className="p-4 max-h-[300px] overflow-y-auto">
        {/* Brand Kit first */}
        {brandKit && (
          <div className="mb-3">
            <p className="text-[10px] text-slate-600 uppercase mb-2">Identyfikacja marki</p>
            <ThemeCard
              colorSet={{
                id: 'brand_kit',
                name: 'Brand Kit',
                colors: {
                  primary: brandKit.primaryColor.startsWith('#')
                    ? brandKit.primaryColor
                    : `#${brandKit.primaryColor}`,
                  secondary: brandKit.secondaryColor.startsWith('#')
                    ? brandKit.secondaryColor
                    : `#${brandKit.secondaryColor}`,
                  accent: brandKit.accentColor.startsWith('#')
                    ? brandKit.accentColor
                    : `#${brandKit.accentColor}`,
                  background: '#FAFBFC',
                  surface: '#FFFFFF',
                  textPrimary: '#0F172A',
                  textSecondary: '#64748B',
                  heading: brandKit.primaryColor.startsWith('#')
                    ? brandKit.primaryColor
                    : `#${brandKit.primaryColor}`,
                },
                chartPalette: [],
                styleTags: ['branded'],
              }}
              isSelected={colorSetId === 'brand_kit'}
              isBrandKit
              onSelect={() => setColorSetId('brand_kit')}
            />
          </div>
        )}

        <p className="text-[10px] text-slate-600 uppercase mb-2">Gotowe palety</p>
        <div className="grid grid-cols-3 gap-2">
          {CURATED_COLOR_SETS.map((set) => (
            <ThemeCard
              key={set.id}
              colorSet={set}
              isSelected={colorSetId === set.id}
              onSelect={() => setColorSetId(set.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const ThemeCard: React.FC<{
  colorSet: CuratedColorSet;
  isSelected: boolean;
  isBrandKit?: boolean;
  onSelect: () => void;
}> = ({ colorSet, isSelected, isBrandKit, onSelect }) => (
  <button
    onClick={onSelect}
    className={`relative p-2 rounded-lg border-2 text-left transition-all w-full ${
      isSelected
        ? 'border-c-info shadow-md shadow-c-info/10'
        : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
    }`}
  >
    <div className="flex gap-0.5 h-5 rounded overflow-hidden mb-1.5">
      <div className="flex-1" style={{ backgroundColor: colorSet.colors.primary }} />
      <div className="flex-1" style={{ backgroundColor: colorSet.colors.secondary }} />
      <div className="flex-1" style={{ backgroundColor: colorSet.colors.accent }} />
      <div className="flex-1" style={{ backgroundColor: colorSet.colors.background }} />
    </div>
    <div className="flex items-center gap-1">
      {isBrandKit && <Crown size={10} className="text-amber-500" />}
      <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{colorSet.name}</p>
    </div>
    {isSelected && (
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-navy-900 flex items-center justify-center">
        <Check size={10} className="text-white" />
      </div>
    )}
  </button>
);
