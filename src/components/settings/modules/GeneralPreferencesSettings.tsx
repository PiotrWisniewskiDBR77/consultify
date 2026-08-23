/**
 * GeneralPreferencesSettings - General Application Preferences
 *
 * Features:
 * - Startup view (what to show on login)
 * - Auto-save interval
 * - Confirmation dialogs preferences
 * - Tooltips enabled/disabled
 * - Onboarding completed status
 */

import {
  Calendar,
  CheckCircle,
  Clock,
  Globe,
  HelpCircle,
  Home,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Settings,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface GeneralPreferencesSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface GeneralSettings {
  // Startup
  startupView: string;
  showWelcomeOnStartup: boolean;

  // Auto-save
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // seconds

  // Dialogs
  confirmOnDelete: boolean;
  confirmOnArchive: boolean;
  confirmOnStatusChange: boolean;
  confirmOnLeaveUnsaved: boolean;

  // Tooltips & Hints
  showTooltips: boolean;
  showKeyboardHints: boolean;
  showFeatureTips: boolean;

  // Onboarding
  onboardingCompleted: boolean;
  showTutorialPrompts: boolean;

  // Regional
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: 'sunday' | 'monday';
  firstDayOfWeek: number;
}

const defaultSettings: GeneralSettings = {
  startupView: 'chat',
  showWelcomeOnStartup: true,
  autoSaveEnabled: true,
  autoSaveInterval: 30,
  confirmOnDelete: true,
  confirmOnArchive: true,
  confirmOnStatusChange: false,
  confirmOnLeaveUnsaved: true,
  showTooltips: true,
  showKeyboardHints: true,
  showFeatureTips: true,
  onboardingCompleted: false,
  showTutorialPrompts: true,
  dateFormat: 'MMM DD, YYYY',
  timeFormat: '24h',
  weekStartsOn: 'monday',
  firstDayOfWeek: 1,
};

const startupViews = [
  { id: 'chat', label: 'AI Chat', desc: 'Start with AI assistant' },
  { id: 'inbox', label: 'Inbox', desc: 'Your notifications and tasks' },
  { id: 'mywork', label: 'My Work', desc: 'Personal task list' },
  { id: 'projects', label: 'Projects', desc: 'Project list view' },
  { id: 'calendar', label: 'Calendar', desc: 'Calendar view' },
  { id: 'focus', label: 'Focus Mode', desc: 'Distraction-free mode' },
  { id: 'last_visited', label: 'Last Visited', desc: 'Continue where you left off' },
];

const dateFormats = [
  { value: 'MMM DD, YYYY', label: 'Jan 01, 2026' },
  { value: 'DD/MM/YYYY', label: '01/01/2026' },
  { value: 'MM/DD/YYYY', label: '01/01/2026' },
  { value: 'YYYY-MM-DD', label: '2026-01-01' },
  { value: 'DD.MM.YYYY', label: '01.01.2026' },
];

export const GeneralPreferencesSettings: React.FC<GeneralPreferencesSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/preferences/general');
      if (response.success && response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading general preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/preferences/general', settings);
      toast.success(t('settings.preferences.saved', 'Preferences saved'));
    } catch (error) {
      toast.error(t('settings.preferences.error', 'Failed to save preferences'));
    } finally {
      setSaving(false);
    }
  };

  const resetOnboarding = async () => {
    try {
      await Api.post('/api/user/preferences/reset-onboarding', {});
      setSettings({ ...settings, onboardingCompleted: false });
      toast.success('Onboarding reset. You will see the tutorial on next login.');
    } catch (error) {
      toast.error('Failed to reset onboarding');
    }
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
            <Settings size={28} className="text-c-text-muted" />
            {t('settings.preferences.general.title', 'General Preferences')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">Configure application behavior</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* Startup View */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Home size={20} className="text-blue-500" />
          Startup Preferences
        </h3>

        <div>
          <label className="block text-sm font-medium text-c-text-secondary mb-3">
            Default Startup View
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {startupViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setSettings({ ...settings, startupView: view.id })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  settings.startupView === view.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
                }`}
              >
                <p className="font-medium text-c-text text-sm">{view.label}</p>
                <p className="text-xs text-c-text-muted">{view.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
          <div>
            <p className="font-medium text-c-text">Show Welcome Message</p>
            <p className="text-sm text-c-text-muted">Display welcome screen on startup</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, showWelcomeOnStartup: !settings.showWelcomeOnStartup })
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.showWelcomeOnStartup ? 'bg-blue-600' : 'bg-c-surface-raised'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                settings.showWelcomeOnStartup ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Auto-Save */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <RefreshCw size={20} className="text-green-500" />
          Auto-Save
        </h3>

        <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
          <div>
            <p className="font-medium text-c-text">Enable Auto-Save</p>
            <p className="text-sm text-c-text-muted">Automatically save changes periodically</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, autoSaveEnabled: !settings.autoSaveEnabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.autoSaveEnabled ? 'bg-green-600' : 'bg-c-surface-raised'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                settings.autoSaveEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {settings.autoSaveEnabled && (
          <div className="p-4 bg-c-surface-raised rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-c-text-secondary">Save Interval</label>
              <span className="text-sm text-green-600">{settings.autoSaveInterval} seconds</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              step="10"
              value={settings.autoSaveInterval}
              onChange={(e) =>
                setSettings({ ...settings, autoSaveInterval: parseInt(e.target.value) })
              }
              className="w-full h-2 bg-c-surface-raised rounded-lg appearance-none cursor-pointer accent-green-600"
            />
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <MessageSquare size={20} className="text-amber-500" />
          Confirmation Dialogs
        </h3>

        <div className="space-y-3">
          {[
            {
              key: 'confirmOnDelete',
              label: 'Confirm on Delete',
              desc: 'Ask before deleting items',
            },
            {
              key: 'confirmOnArchive',
              label: 'Confirm on Archive',
              desc: 'Ask before archiving items',
            },
            {
              key: 'confirmOnStatusChange',
              label: 'Confirm Status Changes',
              desc: 'Ask before changing task status',
            },
            {
              key: 'confirmOnLeaveUnsaved',
              label: 'Warn on Unsaved Changes',
              desc: 'Alert when leaving with unsaved changes',
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
            >
              <div>
                <p className="font-medium text-c-text">{item.label}</p>
                <p className="text-sm text-c-text-muted">{item.desc}</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, [item.key]: !(settings as any)[item.key] })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (settings as any)[item.key] ? 'bg-amber-600' : 'bg-c-surface-raised'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                    (settings as any)[item.key] ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltips & Hints */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <HelpCircle size={20} className="text-c-accent" />
          Tooltips & Hints
        </h3>

        <div className="space-y-3">
          {[
            {
              key: 'showTooltips',
              label: 'Show Tooltips',
              desc: 'Display helpful tooltips on hover',
            },
            {
              key: 'showKeyboardHints',
              label: 'Show Keyboard Hints',
              desc: 'Display keyboard shortcut hints',
            },
            {
              key: 'showFeatureTips',
              label: 'Show Feature Tips',
              desc: 'Show tips for new features',
            },
            {
              key: 'showTutorialPrompts',
              label: 'Tutorial Prompts',
              desc: 'Show helpful tutorial prompts',
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
            >
              <div>
                <p className="font-medium text-c-text">{item.label}</p>
                <p className="text-sm text-c-text-muted">{item.desc}</p>
              </div>
              <button
                onClick={() =>
                  setSettings({ ...settings, [item.key]: !(settings as any)[item.key] })
                }
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  (settings as any)[item.key] ? 'bg-navy-900' : 'bg-c-surface-raised'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                    (settings as any)[item.key] ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={resetOnboarding}
          className="w-full p-3 text-center text-c-accent hover:bg-c-accent-soft dark:hover:bg-c-accent-soft rounded-lg transition-colors"
        >
          Reset Onboarding Tutorial
        </button>
      </div>

      {/* Regional Settings */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Globe size={20} className="text-indigo-500" />
          Regional Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              Date Format
            </label>
            <select
              value={settings.dateFormat}
              onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
            >
              {dateFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              Time Format
            </label>
            <div className="flex gap-2">
              {(['12h', '24h'] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => setSettings({ ...settings, timeFormat: format })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    settings.timeFormat === format
                      ? 'bg-indigo-600 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {format === '12h' ? '12-hour' : '24-hour'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              Week Starts On
            </label>
            <div className="flex gap-2">
              {(['sunday', 'monday'] as const).map((day) => (
                <button
                  key={day}
                  onClick={() => setSettings({ ...settings, weekStartsOn: day })}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all ${
                    settings.weekStartsOn === day
                      ? 'bg-indigo-600 text-white'
                      : 'bg-c-surface-raised text-c-text-secondary'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralPreferencesSettings;
