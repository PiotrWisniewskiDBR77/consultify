/**
 * CookieSettingsManager - Cookie settings management component
 *
 * Features:
 * - "Cookies" section
 * - Configure banner button
 * - Category toggles: Essential/Required, Analytics, Functional, Targeting
 * - Banner preview
 * - Cookie policy link configuration
 *
 * Design: Card-based configuration with live preview
 */

import {
  AlertCircle,
  Check,
  ChevronRight,
  Cookie,
  Eye,
  EyeOff,
  HelpCircle,
  Link,
  Save,
  Settings,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Cookie category
export interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  enabled: boolean;
  cookies: string[];
}

// Cookie settings
export interface CookieSettings {
  enabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  acceptButtonText: string;
  rejectButtonText: string;
  customizeButtonText: string;
  privacyPolicyUrl: string;
  categories: CookieCategory[];
  position: 'bottom' | 'bottom-left' | 'bottom-right' | 'top' | 'center';
  theme: 'light' | 'dark' | 'auto';
}

interface CookieSettingsManagerProps {
  settings: CookieSettings;
  onChange: (settings: CookieSettings) => void;
  onSave?: () => void;
  className?: string;
}

// Default cookie categories
const defaultCategories: CookieCategory[] = [
  {
    id: 'essential',
    name: 'Essential / Required',
    description: 'Necessary for the website to function properly. Cannot be disabled.',
    required: true,
    enabled: true,
    cookies: ['session_id', 'csrf_token', 'auth_token'],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Help us understand how visitors interact with our website.',
    required: false,
    enabled: true,
    cookies: ['_ga', '_gid', 'mixpanel_id'],
  },
  {
    id: 'functional',
    name: 'Functional',
    description: 'Enable enhanced functionality and personalization.',
    required: false,
    enabled: true,
    cookies: ['language', 'timezone', 'preferences'],
  },
  {
    id: 'targeting',
    name: 'Targeting / Advertising',
    description: 'Used to deliver relevant advertisements and track ad campaign performance.',
    required: false,
    enabled: false,
    cookies: ['_fbp', 'ads_id', 'remarketing'],
  },
];

export const CookieSettingsManager: React.FC<CookieSettingsManagerProps> = ({
  settings,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);

  // Use default categories if none provided
  const categories = settings.categories.length > 0 ? settings.categories : defaultCategories;

  // Toggle category
  const toggleCategory = useCallback(
    (categoryId: string) => {
      const updatedCategories = categories.map((cat) =>
        cat.id === categoryId && !cat.required ? { ...cat, enabled: !cat.enabled } : cat
      );
      onChange({ ...settings, categories: updatedCategories });
    },
    [categories, onChange, settings]
  );

  // Update text field
  const updateTextField = useCallback(
    (field: keyof CookieSettings, value: string) => {
      onChange({ ...settings, [field]: value });
    },
    [onChange, settings]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Cookie size={24} className="text-c-text" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                {t('admin.compliance.cookies.title', 'Cookie Settings')}
                <Tooltip
                  content={t(
                    'admin.compliance.cookies.tooltip',
                    'Configure how your site handles cookies'
                  )}
                >
                  <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
                </Tooltip>
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.compliance.cookies.subtitle', 'Manage cookie consent and preferences')}
              </p>
            </div>
          </div>

          {/* Enable Toggle */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-sm font-medium',
                settings.enabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                settings.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-navy-700'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                  settings.enabled ? 'left-8' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* Banner Customization */}
        {settings.enabled && (
          <div className="space-y-4">
            <h4 className="font-medium text-navy-900 dark:text-white">
              {t('admin.compliance.cookies.bannerSettings', 'Banner Settings')}
            </h4>

            {/* Text Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.bannerTitle', 'Banner Title')}
                </label>
                <input
                  type="text"
                  value={settings.bannerTitle}
                  onChange={(e) => updateTextField('bannerTitle', e.target.value)}
                  placeholder="We use cookies"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.privacyPolicyUrl', 'Privacy Policy URL')}
                </label>
                <input
                  type="text"
                  value={settings.privacyPolicyUrl}
                  onChange={(e) => updateTextField('privacyPolicyUrl', e.target.value)}
                  placeholder="https://example.com/privacy"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('admin.compliance.cookies.bannerDescription', 'Banner Description')}
              </label>
              <textarea
                value={settings.bannerDescription}
                onChange={(e) => updateTextField('bannerDescription', e.target.value)}
                placeholder="We use cookies to improve your experience..."
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white resize-none"
              />
            </div>

            {/* Button Text */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.acceptButton', 'Accept Button')}
                </label>
                <input
                  type="text"
                  value={settings.acceptButtonText}
                  onChange={(e) => updateTextField('acceptButtonText', e.target.value)}
                  placeholder="Accept All"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.rejectButton', 'Reject Button')}
                </label>
                <input
                  type="text"
                  value={settings.rejectButtonText}
                  onChange={(e) => updateTextField('rejectButtonText', e.target.value)}
                  placeholder="Reject All"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.customizeButton', 'Customize Button')}
                </label>
                <input
                  type="text"
                  value={settings.customizeButtonText}
                  onChange={(e) => updateTextField('customizeButtonText', e.target.value)}
                  placeholder="Manage Preferences"
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                />
              </div>
            </div>

            {/* Position & Theme */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.position', 'Position')}
                </label>
                <select
                  value={settings.position}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      position: e.target.value as CookieSettings['position'],
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                >
                  <option value="bottom">Bottom</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="top">Top</option>
                  <option value="center">Center (Modal)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.compliance.cookies.theme', 'Theme')}
                </label>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      theme: e.target.value as CookieSettings['theme'],
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (Match System)</option>
                </select>
              </div>
            </div>

            {/* Preview Button */}
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              icon={showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            >
              {showPreview
                ? t('admin.compliance.cookies.hidePreview', 'Hide Preview')
                : t('admin.compliance.cookies.showPreview', 'Show Preview')}
            </Button>
          </div>
        )}
      </div>

      {/* Banner Preview */}
      {showPreview && settings.enabled && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-navy-700">
          {/* Fake page background */}
          <div className="h-64 bg-slate-100 dark:bg-navy-900 flex items-center justify-center">
            <span className="text-slate-400 dark:text-slate-500">
              {t('admin.compliance.cookies.pageContent', 'Your page content')}
            </span>
          </div>

          {/* Cookie Banner Preview */}
          <div
            className={cn(
              'absolute left-0 right-0 p-4',
              settings.theme === 'dark'
                ? 'bg-c-surface-raised text-c-text'
                : 'bg-white text-navy-900',
              settings.position === 'bottom' && 'bottom-0',
              settings.position === 'top' && 'top-0',
              settings.position === 'center' &&
                'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-lg rounded-xl shadow-2xl',
              (settings.position === 'bottom-left' || settings.position === 'bottom-right') &&
                'bottom-4 w-80',
              settings.position === 'bottom-left' && 'left-4 right-auto',
              settings.position === 'bottom-right' && 'right-4 left-auto',
              'shadow-lg border border-slate-200 dark:border-navy-700'
            )}
          >
            <h5 className="font-semibold mb-2">{settings.bannerTitle || 'We use cookies'}</h5>
            <p
              className={cn(
                'text-sm mb-4',
                settings.theme === 'dark' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
              )}
            >
              {settings.bannerDescription || 'We use cookies to improve your experience.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg hover:bg-navy-800">
                {settings.acceptButtonText || 'Accept All'}
              </button>
              <button
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg border',
                  settings.theme === 'dark'
                    ? 'border-slate-600 hover:bg-c-surface-raised'
                    : 'border-slate-300 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800/20'
                )}
              >
                {settings.rejectButtonText || 'Reject All'}
              </button>
              <button
                className={cn(
                  'px-4 py-2 text-sm font-medium',
                  settings.theme === 'dark'
                    ? 'text-primary-400 hover:text-primary-300'
                    : 'text-primary-600 hover:text-primary-700'
                )}
              >
                {settings.customizeButtonText || 'Manage Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Categories */}
      {settings.enabled && (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <h4 className="font-semibold text-navy-900 dark:text-white mb-4">
            {t('admin.compliance.cookies.categories', 'Cookie Categories')}
          </h4>

          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  'p-4 rounded-lg border transition-all',
                  category.enabled
                    ? 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700'
                    : 'bg-slate-100 dark:bg-navy-950 border-slate-200 dark:border-navy-800 opacity-60'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-navy-900 dark:text-white">{category.name}</h5>
                      {category.required && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
                          {t('admin.compliance.cookies.required', 'Required')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      {category.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('admin.compliance.cookies.cookiesIncluded', 'Cookies:')}{' '}
                      {category.cookies.join(', ')}
                    </p>
                  </div>

                  <button
                    onClick={() => toggleCategory(category.id)}
                    disabled={category.required}
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
                      category.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600',
                      category.required && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 w-4 h-4 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                        category.enabled ? 'left-7' : 'left-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      {settings.enabled && onSave && (
        <div className="flex justify-end">
          <Button onClick={onSave} icon={<Save size={16} />}>
            {t('admin.compliance.cookies.saveSettings', 'Save Settings')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CookieSettingsManager;
