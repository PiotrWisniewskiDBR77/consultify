/**
 * LayoutPreferencesSettings - Layout Configuration
 *
 * Features:
 * - Default sidebar state
 * - Panel layout (left/right sidebar)
 * - Header visibility
 * - Breadcrumb visibility
 * - Toolbar customization
 */

import {
  ChevronRight,
  Eye,
  EyeOff,
  Grip,
  LayoutDashboard,
  Loader2,
  Menu,
  PanelLeft,
  PanelRight,
  PanelTop,
  RotateCcw,
  Save,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';

interface LayoutPreferencesSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface LayoutSettings {
  defaultSidebarState: 'expanded' | 'collapsed' | 'auto';
  sidebarPosition: 'left' | 'right';
  showHeader: boolean;
  showBreadcrumbs: boolean;
  showToolbar: boolean;
  stickyHeader: boolean;
  defaultView: string;
  toolbarItems: string[];
  quickAccessItems: string[];
}

const defaultSettings: LayoutSettings = {
  defaultSidebarState: 'expanded',
  sidebarPosition: 'left',
  showHeader: true,
  showBreadcrumbs: true,
  showToolbar: true,
  stickyHeader: true,
  defaultView: 'chat',
  toolbarItems: ['search', 'notifications', 'help', 'profile'],
  quickAccessItems: ['new_task', 'new_project', 'quick_note'],
};

const availableToolbarItems = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'help', label: 'Help', icon: '❓' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'theme_toggle', label: 'Theme Toggle', icon: '🌙' },
  { id: 'fullscreen', label: 'Fullscreen', icon: '🖥️' },
  { id: 'quick_add', label: 'Quick Add', icon: '➕' },
];

const availableQuickAccessItems = [
  { id: 'new_task', label: 'New Task' },
  { id: 'new_project', label: 'New Project' },
  { id: 'quick_note', label: 'Quick Note' },
  { id: 'new_initiative', label: 'New Initiative' },
  { id: 'new_report', label: 'New Report' },
  { id: 'schedule_meeting', label: 'Schedule Meeting' },
  { id: 'start_timer', label: 'Start Timer' },
];

const defaultViews = [
  { id: 'chat', label: 'AI Chat' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'focus', label: 'Focus Mode' },
];

export const LayoutPreferencesSettings: React.FC<LayoutPreferencesSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LayoutSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, [currentUser.id]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await Api.get('/api/user/appearance/layout');
      if (response.success && response.data) {
        setSettings({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Error loading layout settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/appearance/layout', settings);
      toast.success(t('settings.appearance.layoutSaved', 'Layout settings saved'));
    } catch (error) {
      toast.error(t('settings.appearance.layoutError', 'Failed to save layout settings'));
    } finally {
      setSaving(false);
    }
  };

  const toggleToolbarItem = (itemId: string) => {
    const items = settings.toolbarItems.includes(itemId)
      ? settings.toolbarItems.filter((i) => i !== itemId)
      : [...settings.toolbarItems, itemId];
    setSettings({ ...settings, toolbarItems: items });
  };

  const toggleQuickAccessItem = (itemId: string) => {
    const items = settings.quickAccessItems.includes(itemId)
      ? settings.quickAccessItems.filter((i) => i !== itemId)
      : [...settings.quickAccessItems, itemId];
    setSettings({ ...settings, quickAccessItems: items });
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
            <LayoutDashboard size={28} className="text-blue-500" />
            {t('settings.appearance.layout.title', 'Layout Preferences')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">Configure your workspace layout</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* Sidebar Configuration */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-6">
        <h3 className="text-lg font-semibold text-c-text">Sidebar</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sidebar State */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">
              Default State
            </label>
            <div className="space-y-2">
              {[
                { id: 'expanded', label: 'Expanded', desc: 'Always show full sidebar' },
                { id: 'collapsed', label: 'Collapsed', desc: 'Show icons only' },
                { id: 'auto', label: 'Auto', desc: 'Collapse on small screens' },
              ].map((state) => (
                <label
                  key={state.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    settings.defaultSidebarState === state.id
                      ? 'bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-500'
                      : 'bg-c-surface-raised border-2 border-transparent hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="sidebarState"
                    checked={settings.defaultSidebarState === state.id}
                    onChange={() =>
                      setSettings({ ...settings, defaultSidebarState: state.id as any })
                    }
                    className="hidden"
                  />
                  <div>
                    <p className="font-medium text-c-text">{state.label}</p>
                    <p className="text-xs text-c-text-muted">{state.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Sidebar Position */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">Position</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'left', label: 'Left', icon: PanelLeft },
                { id: 'right', label: 'Right', icon: PanelRight },
              ].map((pos) => {
                const Icon = pos.icon;
                return (
                  <button
                    key={pos.id}
                    onClick={() => setSettings({ ...settings, sidebarPosition: pos.id as any })}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      settings.sidebarPosition === pos.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
                    }`}
                  >
                    <Icon
                      size={24}
                      className={
                        settings.sidebarPosition === pos.id
                          ? 'text-blue-600 mx-auto'
                          : 'text-c-text-secondary mx-auto'
                      }
                    />
                    <p className="font-medium text-c-text mt-2">{pos.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* UI Elements */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">UI Elements</h3>

        <div className="space-y-3">
          {[
            {
              key: 'showHeader',
              label: 'Show Header',
              desc: 'Display the top navigation bar',
              icon: PanelTop,
            },
            {
              key: 'stickyHeader',
              label: 'Sticky Header',
              desc: 'Keep header visible when scrolling',
              icon: PanelTop,
            },
            {
              key: 'showBreadcrumbs',
              label: 'Show Breadcrumbs',
              desc: 'Display navigation breadcrumbs',
              icon: ChevronRight,
            },
            {
              key: 'showToolbar',
              label: 'Show Toolbar',
              desc: 'Display quick action toolbar',
              icon: Grip,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className="text-c-text-secondary" />
                  <div>
                    <p className="font-medium text-c-text">{item.label}</p>
                    <p className="text-sm text-c-text-muted">{item.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({ ...settings, [item.key]: !(settings as any)[item.key] })
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    (settings as any)[item.key] ? 'bg-blue-600' : 'bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${
                      (settings as any)[item.key] ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Default View */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">Startup View</h3>
        <p className="text-sm text-c-text-muted">Choose which view to show when you log in</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {defaultViews.map((view) => (
            <button
              key={view.id}
              onClick={() => setSettings({ ...settings, defaultView: view.id })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                settings.defaultView === view.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
              }`}
            >
              <p className="font-medium text-c-text">{view.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar Items */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">Toolbar Items</h3>
        <p className="text-sm text-c-text-muted">Choose which items appear in the header toolbar</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableToolbarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleToolbarItem(item.id)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                settings.toolbarItems.includes(item.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-blue-300'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <p className="text-sm font-medium text-c-text mt-1">{item.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-c-text">Quick Access Menu</h3>
        <p className="text-sm text-c-text-muted">Customize quick actions in the + menu</p>

        <div className="flex flex-wrap gap-2">
          {availableQuickAccessItems.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleQuickAccessItem(item.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                settings.quickAccessItems.includes(item.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayoutPreferencesSettings;
