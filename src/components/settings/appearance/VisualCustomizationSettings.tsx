/**
 * VisualCustomizationSettings - Visual Appearance Configuration
 *
 * Features:
 * - Custom color scheme/theme
 * - Accent color picker
 * - Font size adjustment
 * - Font family selection
 * - Compact/Dense/Comfortable view modes
 * - Sidebar width adjustment
 * - Custom CSS (for power users)
 */

import {
  Code,
  Eye,
  Layout,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Sun,
  Type,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface VisualCustomizationSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface VisualSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  density: 'compact' | 'comfortable' | 'spacious';
  sidebarWidth: number;
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  animations: boolean;
  customCSS: string;
}

const accentColors = [
  { id: 'crimson', color: '#A51C30', name: 'Crimson' },
  { id: 'violet', color: '#6366F1', name: 'Violet' },
  { id: 'purple', color: '#A855F7', name: 'Purple' },
  { id: 'indigo', color: '#6366F1', name: 'Indigo' },
  { id: 'blue', color: '#3B82F6', name: 'Blue' },
  { id: 'cyan', color: '#3B82F6', name: 'Cyan' },
  { id: 'teal', color: '#3B82F6', name: 'Teal' },
  { id: 'green', color: '#22C55E', name: 'Green' },
  { id: 'emerald', color: '#10B981', name: 'Emerald' },
  { id: 'amber', color: '#F59E0B', name: 'Amber' },
  { id: 'orange', color: '#F59E0B', name: 'Orange' },
  { id: 'red', color: '#F43F5E', name: 'Red' },
  { id: 'pink', color: '#EC4899', name: 'Pink' },
];

const fontFamilies = [{ id: 'inter', name: 'Inter', value: '"Inter", sans-serif' }];

const defaultSettings: VisualSettings = {
  theme: 'system',
  accentColor: '#A51C30',
  fontSize: 'medium',
  fontFamily: '"Inter", sans-serif',
  density: 'comfortable',
  sidebarWidth: 280,
  borderRadius: 'medium',
  animations: true,
  customCSS: '',
};

export const VisualCustomizationSettings: React.FC<VisualCustomizationSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VisualSettings>(defaultSettings);
  const [previewMode, setPreviewMode] = useState(false);
  const [showCustomCSS, setShowCustomCSS] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/appearance/visual');
      if (response.success && response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading visual settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/appearance/visual', settings);
      const response = await Api.get('/api/user/appearance/visual').catch(() => null);
      const next =
        response?.success && response.data
          ? ({ ...defaultSettings, ...response.data } as VisualSettings)
          : settings;
      setSettings(next);
      applySettings(next);
      toast.success(t('settings.appearance.saved', 'Appearance settings saved'));
    } catch (error) {
      toast.error(t('settings.appearance.error', 'Failed to save appearance settings'));
    } finally {
      setSaving(false);
    }
  };

  const applySettings = (s: VisualSettings) => {
    // Apply theme
    document.documentElement.classList.remove('light', 'dark');
    if (s.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.classList.add(s.theme);
    }

    // Apply CSS variables
    document.documentElement.style.setProperty('--accent-color', s.accentColor);
    document.documentElement.style.setProperty('--font-family', '"Inter", sans-serif');
    document.documentElement.style.setProperty('--sidebar-width', `${s.sidebarWidth}px`);
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    toast.success(t('settings.appearance.visual.resetToast', 'Settings reset to defaults'));
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Palette size={28} className="text-c-accent" />
            {t('settings.appearance.visual.title', 'Visual Customization')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t('settings.appearance.visual.description', 'Personalize how Consultify looks')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
            {t('settings.appearance.visual.reset', 'Reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('common.saveChanges', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Theme Selection */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('settings.appearance.theme', 'Theme')}
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'light', label: t('settings.appearance.light', 'Light'), icon: Sun },
            { id: 'dark', label: t('settings.appearance.dark', 'Dark'), icon: Moon },
            { id: 'system', label: t('settings.appearance.system', 'System'), icon: Monitor },
          ].map((theme) => {
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                onClick={() => setSettings({ ...settings, theme: theme.id as any })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  settings.theme === theme.id
                    ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
                }`}
              >
                <Icon
                  size={24}
                  className={
                    settings.theme === theme.id
                      ? 'text-c-accent mx-auto'
                      : 'text-c-text-secondary mx-auto'
                  }
                />
                <p className="font-medium text-c-text mt-2">{theme.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent Color */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('settings.appearance.accentColor', 'Accent Color')}
        </h3>

        <div className="flex flex-wrap gap-3">
          {accentColors.map((color) => (
            <button
              key={color.id}
              onClick={() => setSettings({ ...settings, accentColor: color.color })}
              className={`w-10 h-10 rounded-full transition-all ${
                settings.accentColor === color.color
                  ? 'ring-2 ring-offset-2 ring-c-border dark:ring-offset-navy-900'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color.color }}
              title={t(`settings.appearance.visual.accent.${color.id}`, color.name)}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
              className="w-10 h-10 rounded-full cursor-pointer"
              title={t('settings.appearance.customColor', 'Custom color')}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-c-surface-raised rounded-lg">
          <div className="w-8 h-8 rounded" style={{ backgroundColor: settings.accentColor }} />
          <span className="font-mono text-sm text-c-text-secondary">{settings.accentColor}</span>
        </div>
      </div>

      {/* Typography */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Type size={20} className="text-blue-500" />
          {t('settings.accessibility.typographyTitle', 'Typography')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.accessibility.fontFamilyTitle', 'Font Family')}
            </label>
            <select
              value={settings.fontFamily}
              onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              {fontFamilies.map((font) => (
                <option key={font.id} value={font.value}>
                  {t(`settings.appearance.visual.font.${font.id}`, font.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.accessibility.fontSizeTitle', 'Font Size')}
            </label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setSettings({ ...settings, fontSize: size })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                    settings.fontSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                  }`}
                >
                  {t(`settings.accessibility.fontSize.${size}`, size)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="p-4 bg-c-surface-raised rounded-lg"
          style={{ fontFamily: settings.fontFamily }}
        >
          <p className="text-c-text">
            {t(
              'settings.appearance.previewSentence',
              'The quick brown fox jumps over the lazy dog.'
            )}
          </p>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.appearance.visual.previewCharacters',
              'ABCDEFGHIJKLMNOPQRSTUVWXYZ - 0123456789'
            )}
          </p>
        </div>
      </div>

      {/* Layout Density */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Layout size={20} className="text-green-500" />
          {t('settings.appearance.visual.displayDensity', 'Display Density')}
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              id: 'compact',
              label: t('settings.appearance.density.compact', 'Compact'),
              desc: t('settings.appearance.visual.densityCompactDesc', 'More content visible'),
              icon: Minimize2,
            },
            {
              id: 'comfortable',
              label: t('settings.appearance.density.comfortable', 'Comfortable'),
              desc: t('settings.appearance.density.comfortableDesc', 'Balanced layout'),
              icon: Layout,
            },
            {
              id: 'spacious',
              label: t('settings.appearance.density.spacious', 'Spacious'),
              desc: t('settings.appearance.visual.densitySpaciousDesc', 'Relaxed spacing'),
              icon: Maximize2,
            },
          ].map((density) => {
            const Icon = density.icon;
            return (
              <button
                key={density.id}
                onClick={() => setSettings({ ...settings, density: density.id as any })}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  settings.density === density.id
                    ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-green-300'
                }`}
              >
                <Icon
                  size={24}
                  className={
                    settings.density === density.id
                      ? 'text-green-600 mx-auto'
                      : 'text-c-text-secondary mx-auto'
                  }
                />
                <p className="font-medium text-c-text mt-2">{density.label}</p>
                <p className="text-xs text-c-text-muted">{density.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Options */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">
          {t('settings.appearance.visual.additionalOptions', 'Additional Options')}
        </h3>

        <div className="space-y-4">
          {/* Sidebar Width */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-c-text-secondary">
                {t('settings.appearance.visual.sidebarWidth', 'Sidebar Width')}
              </label>
              <span className="text-sm text-c-accent">{settings.sidebarWidth}px</span>
            </div>
            <input
              type="range"
              min="200"
              max="400"
              value={settings.sidebarWidth}
              onChange={(e) => setSettings({ ...settings, sidebarWidth: parseInt(e.target.value) })}
              className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-c-accent"
            />
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              {t('settings.appearance.visual.borderRadius', 'Border Radius')}
            </label>
            <div className="flex gap-2">
              {(['none', 'small', 'medium', 'large'] as const).map((radius) => (
                <button
                  key={radius}
                  onClick={() => setSettings({ ...settings, borderRadius: radius })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                    settings.borderRadius === radius
                      ? 'bg-navy-900 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
                  }`}
                >
                  {t(`settings.appearance.visual.radius.${radius}`, radius)}
                </button>
              ))}
            </div>
          </div>

          {/* Animations Toggle */}
          <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
            <div>
              <p className="font-medium text-c-text">
                {t('settings.appearance.visual.enableAnimations', 'Enable Animations')}
              </p>
              <p className="text-sm text-c-text-muted">
                {t(
                  'settings.appearance.visual.enableAnimationsDesc',
                  'Smooth transitions and effects'
                )}
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, animations: !settings.animations })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.animations ? 'bg-navy-900' : 'bg-c-surface-raised'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                  settings.animations ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
            <Code size={20} className="text-amber-500" />
            {t('settings.appearance.visual.customCss', 'Custom CSS')}
          </h3>
          <button
            onClick={() => setShowCustomCSS(!showCustomCSS)}
            className="text-sm text-c-accent hover:underline"
          >
            {showCustomCSS
              ? t('settings.appearance.visual.hideCss', 'Hide')
              : t('settings.appearance.visual.showCss', 'Show')}
          </button>
        </div>

        {showCustomCSS && (
          <>
            <p className="text-sm text-c-text-muted">
              {t(
                'settings.appearance.visual.customCssDesc',
                'Advanced: Add custom CSS rules (use with caution)'
              )}
            </p>
            <textarea
              value={settings.customCSS}
              onChange={(e) => setSettings({ ...settings, customCSS: e.target.value })}
              placeholder={t(
                'settings.appearance.visual.customCssPlaceholder',
                '/* Your custom CSS here */\n.my-class {\n  color: red;\n}'
              )}
              className="w-full h-48 px-4 py-3 font-mono text-sm bg-c-surface text-green-400 rounded-lg border-0 resize-none"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default VisualCustomizationSettings;
