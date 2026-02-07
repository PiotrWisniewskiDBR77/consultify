/**
 * ThemeSettings - Theme/appearance settings with backend persistence
 *
 * Uses unified SettingsSection pattern for consistent UI
 *
 * @version 2.0
 */

import { Check, Monitor, Moon, Palette, Sparkles, Sun } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import Api from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { SettingsDivider, SettingsFormRow, SettingsSection } from './shared';

interface ThemeSettingsProps {
  className?: string;
}

type Theme = 'light' | 'dark' | 'system';

// Accent color presets
const ACCENT_COLORS = [
  { name: 'Violet', value: '#8b5cf6', class: 'bg-violet-500' },
  { name: 'Blue', value: '#3b82f6', class: 'bg-blue-500' },
  { name: 'Emerald', value: '#10b981', class: 'bg-emerald-500' },
  { name: 'Rose', value: '#f43f5e', class: 'bg-rose-500' },
  { name: 'Amber', value: '#f59e0b', class: 'bg-amber-500' },
  { name: 'Cyan', value: '#06b6d4', class: 'bg-cyan-500' },
];

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme) as Theme;
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const [accentColor, setAccentColor] = useState('#8b5cf6');
  const [originalTheme, setOriginalTheme] = useState<Theme>('system');
  const [originalAccent, setOriginalAccent] = useState('#8b5cf6');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = theme !== originalTheme || accentColor !== originalAccent;

  // Load theme from backend on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await Api.getAppearancePreferences();
        const savedTheme = response?.preferences?.theme as Theme;
        const savedAccent = response?.preferences?.accentColor;

        if (savedTheme) {
          toggleTheme(savedTheme);
          setOriginalTheme(savedTheme);
        } else {
          // Use current app theme as baseline if backend didn't return anything.
          setOriginalTheme(useAppStore.getState().theme as Theme);
        }
        if (savedAccent) {
          setAccentColor(savedAccent);
          setOriginalAccent(savedAccent);
        }
      } catch (err) {
        // Fallback to current app theme (single source of truth)
        setOriginalTheme(useAppStore.getState().theme as Theme);
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, [toggleTheme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.saveAppearancePreferences({ theme, accentColor });
      setOriginalTheme(theme);
      setOriginalAccent(accentColor);
      toast.success(t('settings.appearance.saved', 'Appearance settings saved'));
    } catch (err: any) {
      toast.error(t('settings.appearance.error', 'Failed to save settings'));
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

  return (
    <div className={className}>
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
                        ? 'border-violet-500 bg-violet-500/5'
                        : 'border-white/10 hover:border-white/20 bg-navy-800/50'
                    )}
                  >
                    {/* Preview */}
                    <div
                      className={cn('w-full h-16 rounded-lg border mb-3 transition-all', preview)}
                    />

                    {/* Icon & Label */}
                    <div className="flex items-center justify-center gap-2">
                      <Icon
                        size={18}
                        className={cn(
                          'transition-colors',
                          isSelected ? 'text-violet-400' : 'text-slate-500 dark:text-slate-400'
                        )}
                      />
                      <span
                        className={cn(
                          'font-medium transition-colors',
                          isSelected ? 'text-violet-300' : 'text-slate-300'
                        )}
                      >
                        {label}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                      {description}
                    </p>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 p-1 bg-violet-500 rounded-full">
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
                return (
                  <button
                    key={color.value}
                    onClick={() => setAccentColor(color.value)}
                    className={cn(
                      'group relative w-12 h-12 rounded-xl transition-all duration-200',
                      'hover:scale-110 active:scale-95',
                      color.class,
                      isSelected && 'ring-2 ring-white ring-offset-2 ring-offset-navy-900'
                    )}
                    title={color.name}
                  >
                    {isSelected && (
                      <Check size={18} className="text-white absolute inset-0 m-auto" />
                    )}
                    <span className="sr-only">{color.name}</span>
                  </button>
                );
              })}

              {/* Custom color picker */}
              <label
                className="relative w-12 h-12 rounded-xl bg-navy-700 border border-dashed border-white/20 
                                         cursor-pointer hover:border-white/40 transition-all duration-200
                                         flex items-center justify-center"
                title={t('settings.appearance.customColor', 'Custom color')}
              >
                <Sparkles size={18} className="text-slate-400 dark:text-slate-500" />
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Current color preview */}
            <div className="flex items-center gap-3 mt-4 p-3 bg-navy-700/50 rounded-lg">
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: accentColor }} />
              <div>
                <span className="text-sm text-white font-mono">{accentColor.toUpperCase()}</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('settings.appearance.currentAccent', 'Current accent color')}
                </p>
              </div>
            </div>
          </SettingsFormRow>

          {/* Preview Note */}
          <div className="p-4 bg-navy-700/30 rounded-lg text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              <Sparkles size={14} className="inline mr-2 text-violet-400" />
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
