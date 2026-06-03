/**
 * ThemeSettings - Theme/appearance settings with backend persistence
 *
 * Uses unified SettingsSection pattern for consistent UI.
 * Includes: Color Theme, Accent Color, UI Density
 *
 * @version 3.0
 */

import { Check, Columns3, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import Api from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsFormRow, SettingsSection } from './shared';

interface ThemeSettingsProps {
  className?: string;
}

type Theme = 'light' | 'dark' | 'system';
type Density = 'compact' | 'comfortable' | 'spacious';

const ACCENT_COLORS = [
  { key: 'violet', name: 'Violet', value: '#6366f1', class: 'bg-primary-500' },
  { key: 'blue', name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
  { key: 'emerald', name: 'Emerald', value: '#10b981', class: 'bg-emerald-500' },
  { key: 'rose', name: 'Rose', value: '#f43f5e', class: 'bg-rose-500' },
  { key: 'amber', name: 'Amber', value: '#f59e0b', class: 'bg-amber-500' },
  { key: 'cyan', name: 'Cyan', value: '#3b82f6', class: 'bg-blue-500' },
];

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme) as Theme;
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [density, setDensity] = useState<Density>('comfortable');
  const [originalTheme, setOriginalTheme] = useState<Theme>('system');
  const [originalAccent, setOriginalAccent] = useState('#6366f1');
  const [originalDensity, setOriginalDensity] = useState<Density>('comfortable');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty =
    theme !== originalTheme || accentColor !== originalAccent || density !== originalDensity;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        setLoadError(null);
        const response = await Api.getAppearancePreferences();
        if (!response?.preferences) {
          throw new Error('Appearance preferences response was missing preferences');
        }
        const savedTheme = response?.preferences?.theme as Theme;
        const savedAccent = response?.preferences?.accentColor;
        const savedDensity = response?.preferences?.density as Density;

        if (savedTheme) {
          toggleTheme(savedTheme);
          setOriginalTheme(savedTheme);
        } else {
          setOriginalTheme(useAppStore.getState().theme as Theme);
        }
        if (savedAccent) {
          setAccentColor(savedAccent);
          setOriginalAccent(savedAccent);
        }
        if (savedDensity) {
          setDensity(savedDensity);
          setOriginalDensity(savedDensity);
          applyDensity(savedDensity);
        }
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load appearance preferences'));
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, [toggleTheme]);

  const applyDensity = (d: Density) => {
    const root = document.documentElement;
    root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
    root.classList.add(`density-${d}`);
  };

  const handleDensityChange = (d: string) => {
    setDensity(d as Density);
    applyDensity(d as Density);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Api.saveAppearancePreferences({ theme, accentColor, density });
      const response = await Api.getAppearancePreferences();
      if (!response?.preferences) {
        throw new Error('Appearance settings save was not confirmed by the server');
      }
      const nextTheme = response.preferences.theme as Theme;
      const nextAccent = response.preferences.accentColor;
      const nextDensity = response.preferences.density as Density;
      if (nextTheme !== theme || nextAccent !== accentColor || nextDensity !== density) {
        throw new Error('Appearance settings save was not confirmed by the server');
      }
      toggleTheme(nextTheme);
      setAccentColor(nextAccent);
      setDensity(nextDensity);
      applyDensity(nextDensity);
      setOriginalTheme(nextTheme);
      setOriginalAccent(nextAccent);
      setOriginalDensity(nextDensity);
      toast.success(t('settings.appearance.saved', 'Appearance settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.appearance.error', 'Failed to save settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const themes = [
    {
      id: 'light' as Theme,
      icon: Sun,
      label: t('settings.appearance.light', 'Light'),
      description: t('settings.appearance.lightDesc', 'Bright theme for daytime'),
      preview: 'bg-white border-slate-200 dark:border-navy-700',
    },
    {
      id: 'dark' as Theme,
      icon: Moon,
      label: t('settings.appearance.dark', 'Dark'),
      description: t('settings.appearance.darkDesc', 'Easy on the eyes'),
      preview: 'bg-slate-900 border-slate-700',
    },
    {
      id: 'system' as Theme,
      icon: Monitor,
      label: t('settings.appearance.system', 'System'),
      description: t('settings.appearance.systemDesc', 'Match your device'),
      preview: 'bg-gradient-to-r from-white to-slate-900 border-slate-300 dark:border-navy-700',
    },
  ];

  if (loadError) {
    return (
      <div className={cn('space-y-6', className)}>
        <DegradedState title="Appearance preferences unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
        >
          {actionError}
        </div>
      )}

      <SettingsSection
        icon={Palette}
        title={t('settings.appearance.title', 'Theme & Appearance')}
        description={t(
          'settings.appearance.description',
          'Customize how the application looks and feels'
        )}
        cardId="settings-appearance"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Theme Selection */}
          <SettingsFormRow
            label={t('settings.appearance.themeLabel', 'Color Theme')}
            description={t('settings.appearance.themeDesc', 'Choose your preferred color scheme')}
          >
            <div className="grid grid-cols-3 gap-4 mt-3">
              {themes.map(({ id, icon: Icon, label, description, preview }) => {
                const isSelected = theme === id;
                return (
                  <button
                    key={id}
                    onClick={() => toggleTheme(id)}
                    className={cn(
                      'relative p-4 rounded-xl border-2 transition-all duration-200',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20 bg-navy-800/50'
                    )}
                  >
                    <div
                      className={cn('w-full h-16 rounded-lg border mb-3 transition-all', preview)}
                    />
                    <div className="flex items-center justify-center gap-2">
                      <Icon
                        size={18}
                        className={cn(
                          'transition-colors',
                          isSelected ? 'text-primary-400' : 'text-slate-600'
                        )}
                      />
                      <span
                        className={cn(
                          'font-medium transition-colors',
                          isSelected ? 'text-primary-300' : 'text-slate-600'
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-center">{description}</p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-primary-500 rounded-full">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </SettingsFormRow>

          <SettingsDivider />

          {/* Accent Color */}
          <SettingsFormRow
            label={t('settings.appearance.accentColor', 'Accent Color')}
            description={t(
              'settings.appearance.accentColorDesc',
              'Choose a color for buttons, links, and highlights'
            )}
          >
            <div className="flex flex-wrap gap-3 mt-3">
              {ACCENT_COLORS.map((color) => {
                const isSelected = accentColor === color.value;
                const colorName = t(`settings.appearance.accent.${color.key}`, color.name);
                return (
                  <button
                    key={color.value}
                    onClick={() => setAccentColor(color.value)}
                    className={cn(
                      'group relative w-12 h-12 rounded-xl transition-all duration-200',
                      'hover:scale-110 active:scale-95',
                      color.class,
                      isSelected && 'ring-2 ring-white/80 ring-offset-2 ring-offset-navy-900'
                    )}
                    title={colorName}
                  >
                    {isSelected && (
                      <Check size={18} className="text-white absolute inset-0 m-auto" />
                    )}
                    <span className="sr-only">{colorName}</span>
                  </button>
                );
              })}

              <label
                className="relative w-12 h-12 rounded-xl bg-navy-700 border border-dashed border-white/20
                           cursor-pointer hover:border-white/40 transition-all duration-200
                           flex items-center justify-center"
                title={t('settings.appearance.customColor', 'Custom color')}
              >
                <Sparkles size={18} className="text-slate-500" />
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center gap-3 mt-4 p-3 bg-navy-700/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: accentColor }} />
              <div>
                <span className="text-sm text-white font-mono">{accentColor.toUpperCase()}</span>
                <p className="text-xs text-slate-500">
                  {t('settings.appearance.currentAccent', 'Current accent color')}
                </p>
              </div>
            </div>
          </SettingsFormRow>

          <SettingsDivider />

          {/* UI Density */}
          <SettingsFormRow
            label={t('settings.appearance.densityLabel', 'UI Density')}
            description={t(
              'settings.appearance.densityDesc',
              'Control the spacing and compactness of the interface'
            )}
          >
            <div className="grid grid-cols-3 gap-4 mt-3">
              {[
                {
                  id: 'compact' as Density,
                  icon: Columns3,
                  label: t('settings.appearance.density.compact', 'Compact'),
                  desc: t('settings.appearance.density.compactDesc', 'More content, less spacing'),
                  lines: 5,
                },
                {
                  id: 'comfortable' as Density,
                  icon: Columns3,
                  label: t('settings.appearance.density.comfortable', 'Comfortable'),
                  desc: t('settings.appearance.density.comfortableDesc', 'Balanced layout'),
                  lines: 4,
                },
                {
                  id: 'spacious' as Density,
                  icon: Columns3,
                  label: t('settings.appearance.density.spacious', 'Spacious'),
                  desc: t('settings.appearance.density.spaciousDesc', 'More breathing room'),
                  lines: 3,
                },
              ].map((opt) => {
                const isSelected = density === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleDensityChange(opt.id)}
                    className={cn(
                      'relative p-4 rounded-xl border-2 transition-all duration-200',
                      'hover:scale-[1.02] active:scale-[0.98]',
                      isSelected
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-white/10 hover:border-white/20 bg-navy-800/50'
                    )}
                  >
                    {/* Mini density preview */}
                    <div className="w-full h-14 rounded-lg bg-navy-900/60 mb-3 flex flex-col justify-center px-2 gap-[3px]">
                      {Array.from({ length: opt.lines }).map((_, i) => {
                        const widths = [85, 70, 90, 65, 78];
                        return (
                          <div
                            key={i}
                            className={cn(
                              'rounded-sm bg-white/10',
                              opt.id === 'compact'
                                ? 'h-1.5'
                                : opt.id === 'comfortable'
                                  ? 'h-2'
                                  : 'h-2.5'
                            )}
                            style={{ width: `${widths[i % widths.length]}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="text-center">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-primary-300' : 'text-slate-600'
                        )}
                      >
                        {opt.label}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-primary-500 rounded-full">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </SettingsFormRow>

          {/* Preview Note */}
          <div className="p-4 bg-navy-700/30 rounded-lg text-center">
            <p className="text-sm text-slate-500">
              <Sparkles size={14} className="inline mr-2 text-primary-400" />
              {t(
                'settings.appearance.previewNote',
                'Changes are previewed instantly and saved to your account'
              )}
            </p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export default ThemeSettings;
