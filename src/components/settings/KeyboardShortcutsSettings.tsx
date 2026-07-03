/**
 * KeyboardShortcutsSettings - Keyboard shortcut configuration
 *
 * Uses unified SettingsSection pattern for consistent UI.
 * Sections: Enable/Presets, Shortcut List (grouped by category)
 *
 * @version 3.0
 */

import {
  Check,
  Command,
  Edit2,
  Info,
  Keyboard,
  RotateCcw,
  Search,
  Settings,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import {
  KeyboardShortcuts,
  ShortcutAction,
  ShortcutCategory,
  ShortcutPreset,
  User,
} from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface KeyboardShortcutsSettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

const DEFAULT_SHORTCUTS: ShortcutAction[] = [
  {
    id: 'go_home',
    name: 'Go to Home',
    description: 'Navigate to dashboard',
    category: 'navigation',
    defaultKey: 'g h',
  },
  {
    id: 'go_tasks',
    name: 'Go to Tasks',
    description: 'Navigate to my tasks',
    category: 'navigation',
    defaultKey: 'g t',
  },
  {
    id: 'go_inbox',
    name: 'Go to Inbox',
    description: 'Navigate to inbox',
    category: 'navigation',
    defaultKey: 'g i',
  },
  {
    id: 'go_settings',
    name: 'Go to Settings',
    description: 'Navigate to settings',
    category: 'navigation',
    defaultKey: 'g s',
  },
  {
    id: 'search_global',
    name: 'Global Search',
    description: 'Open global search',
    category: 'search',
    defaultKey: 'Cmd+K',
  },
  {
    id: 'search_tasks',
    name: 'Search Tasks',
    description: 'Search in tasks',
    category: 'search',
    defaultKey: 'Cmd+Shift+T',
  },
  {
    id: 'new_task',
    name: 'New Task',
    description: 'Create a new task',
    category: 'task_management',
    defaultKey: 'n t',
  },
  {
    id: 'complete_task',
    name: 'Complete Task',
    description: 'Mark selected task as done',
    category: 'task_management',
    defaultKey: 'c',
  },
  {
    id: 'edit_task',
    name: 'Edit Task',
    description: 'Edit selected task',
    category: 'task_management',
    defaultKey: 'e',
  },
  {
    id: 'delete_task',
    name: 'Delete Task',
    description: 'Delete selected task',
    category: 'task_management',
    defaultKey: 'Backspace',
  },
  {
    id: 'assign_task',
    name: 'Assign Task',
    description: 'Assign selected task',
    category: 'task_management',
    defaultKey: 'a',
  },
  {
    id: 'save',
    name: 'Save',
    description: 'Save current changes',
    category: 'editing',
    defaultKey: 'Cmd+S',
  },
  {
    id: 'undo',
    name: 'Undo',
    description: 'Undo last action',
    category: 'editing',
    defaultKey: 'Cmd+Z',
  },
  {
    id: 'redo',
    name: 'Redo',
    description: 'Redo last action',
    category: 'editing',
    defaultKey: 'Cmd+Shift+Z',
  },
  {
    id: 'ai_assist',
    name: 'AI Assistant',
    description: 'Open AI assistant',
    category: 'ai',
    defaultKey: 'Cmd+J',
  },
  {
    id: 'ai_summarize',
    name: 'AI Summarize',
    description: 'Summarize selected text',
    category: 'ai',
    defaultKey: 'Cmd+Shift+S',
  },
  {
    id: 'toggle_sidebar',
    name: 'Toggle Sidebar',
    description: 'Show/hide sidebar',
    category: 'general',
    defaultKey: 'Cmd+\\',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Open notifications',
    category: 'general',
    defaultKey: 'n n',
  },
  {
    id: 'help',
    name: 'Help',
    description: 'Show keyboard shortcuts',
    category: 'general',
    defaultKey: '?',
  },
];

const PRESET_OPTIONS: { value: ShortcutPreset; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Consultify default shortcuts' },
  { value: 'vscode', label: 'VS Code', description: 'Visual Studio Code style' },
  { value: 'sublime', label: 'Sublime Text', description: 'Sublime Text style' },
  { value: 'vim', label: 'Vim', description: 'Vim-style navigation' },
  { value: 'custom', label: 'Custom', description: 'Your custom configuration' },
];

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'NAVIGATION',
  editing: 'EDITING',
  task_management: 'TASK MANAGEMENT',
  search: 'SEARCH',
  ai: 'AI FEATURES',
  general: 'GENERAL',
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  'navigation',
  'search',
  'task_management',
  'editing',
  'ai',
  'general',
];

const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  preset: 'default',
  enabled: true,
  showHints: true,
  customShortcuts: {},
  disabledShortcuts: [],
};

const KeyBadge = ({ keys }: { keys: string }) => (
  <div className="flex items-center gap-1">
    {keys.split('+').map((key, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="text-slate-500 text-xs">+</span>}
        <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-navy-900/80 border border-slate-200 dark:border-white/10 rounded text-slate-700 dark:text-slate-300">
          {key === 'Cmd' ? <Command size={12} className="inline" /> : key}
        </kbd>
      </React.Fragment>
    ))}
  </div>
);

export const KeyboardShortcutsSettings: React.FC<KeyboardShortcutsSettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [newKeyBinding, setNewKeyBinding] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>(DEFAULT_KEYBOARD_SHORTCUTS);
  const [original, setOriginal] = useState<KeyboardShortcuts>(shortcuts);

  const isDirty = JSON.stringify(shortcuts) !== JSON.stringify(original);

  const loadShortcuts = useCallback(async () => {
    try {
      setLoadError(null);
      const response = await Api.getShortcuts();
      if (!response?.preferences) {
        throw new Error('Keyboard shortcuts response was missing preferences');
      }
      const merged = { ...DEFAULT_KEYBOARD_SHORTCUTS, ...response.preferences };
      setShortcuts(merged);
      setOriginal(merged);
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load keyboard shortcuts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [currentUser.id, loadShortcuts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Api.saveShortcuts(shortcuts);
      const response = await Api.getShortcuts();
      if (!response?.preferences) {
        throw new Error('Keyboard shortcuts save was not confirmed by the server');
      }
      const next = { ...shortcuts, ...response.preferences };
      if (JSON.stringify(next) !== JSON.stringify(shortcuts)) {
        throw new Error('Keyboard shortcuts save was not confirmed by the server');
      }
      setShortcuts(next);
      setOriginal(next);
      toast.success(t('settings.shortcuts.saved', 'Keyboard shortcuts saved'));
      onUpdate?.();
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.shortcuts.error', 'Failed to save shortcuts')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setShortcuts(DEFAULT_KEYBOARD_SHORTCUTS);
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push('Cmd');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    if (parts.length > 0) setNewKeyBinding(parts.join('+'));
  };

  const saveCustomShortcut = (shortcutId: string) => {
    if (newKeyBinding) {
      setShortcuts((prev) => ({
        ...prev,
        preset: 'custom',
        customShortcuts: { ...(prev.customShortcuts ?? {}), [shortcutId]: newKeyBinding },
      }));
    }
    setEditingShortcut(null);
    setNewKeyBinding('');
  };

  const toggleShortcut = (shortcutId: string) => {
    setShortcuts((prev) => {
      const disabled = prev.disabledShortcuts ?? [];
      const isDisabled = disabled.includes(shortcutId);
      return {
        ...prev,
        disabledShortcuts: isDisabled
          ? disabled.filter((id) => id !== shortcutId)
          : [...disabled, shortcutId],
      };
    });
  };

  const getShortcutKey = (shortcut: ShortcutAction): string =>
    shortcuts.customShortcuts?.[shortcut.id] || shortcut.defaultKey;

  const getShortcutName = (shortcut: ShortcutAction): string =>
    t(`settings.shortcuts.actions.${shortcut.id}.name`, shortcut.name);

  const getShortcutDescription = (shortcut: ShortcutAction): string =>
    t(`settings.shortcuts.actions.${shortcut.id}.description`, shortcut.description);

  const filteredShortcuts = DEFAULT_SHORTCUTS.filter(
    (s) =>
      getShortcutName(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getShortcutDescription(s).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedShortcuts = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items = filteredShortcuts.filter((s) => s.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<ShortcutCategory, ShortcutAction[]>
  );

  const resetAction = (
    <button
      onClick={resetToDefault}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
    >
      <RotateCcw size={13} />
      {t('settings.shortcuts.reset', 'Reset')}
    </button>
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        <DegradedState title="Keyboard shortcuts unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && <Banner variant="danger" title={actionError} />}

      {/* ── Section 1: Enable & Presets ── */}
      <SettingsSection
        icon={Keyboard}
        title={t('settings.shortcuts.title', 'Keyboard Shortcuts')}
        description={t(
          'settings.shortcuts.description',
          'Customize keyboard shortcuts to boost your productivity'
        )}
        cardId="settings-shortcuts"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
        actions={resetAction}
      >
        <div className="space-y-1">
          <SettingsToggle
            checked={shortcuts.enabled}
            onChange={(v) => setShortcuts((prev) => ({ ...prev, enabled: v }))}
            label={t('settings.shortcuts.enable', 'Enable Keyboard Shortcuts')}
            description={t(
              'settings.shortcuts.enableDesc',
              'Use keyboard shortcuts throughout the app'
            )}
          />

          {shortcuts.enabled && (
            <>
              <SettingsDivider />

              <SettingsToggle
                checked={shortcuts.showHints}
                onChange={(v) => setShortcuts((prev) => ({ ...prev, showHints: v }))}
                label={t('settings.shortcuts.showHints', 'Show Shortcut Hints')}
                description={t(
                  'settings.shortcuts.showHintsDesc',
                  'Display keyboard shortcut hints next to actions'
                )}
              />

              <SettingsDivider />

              {/* Preset Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-3">
                  <Settings size={14} className="inline mr-1.5 text-primary-400" />
                  {t('settings.shortcuts.preset', 'Shortcut Preset')}
                </label>
                <div className="grid grid-cols-5 gap-3">
                  {PRESET_OPTIONS.map((preset) => {
                    const isSelected = shortcuts.preset === preset.value;
                    return (
                      <button
                        key={preset.value}
                        onClick={() => setShortcuts((prev) => ({ ...prev, preset: preset.value }))}
                        className={cn(
                          'p-3 rounded-lg border-2 text-left transition-all duration-200',
                          isSelected
                            ? 'border-slate-700 bg-slate-50 dark:border-white/30 dark:bg-white/[0.08]'
                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                        )}
                      >
                        <p
                          className={cn(
                            'text-sm font-medium',
                            isSelected ? 'text-primary-400' : 'text-white'
                          )}
                        >
                          {t(`settings.shortcuts.presets.${preset.value}.label`, preset.label)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t(
                            `settings.shortcuts.presets.${preset.value}.description`,
                            preset.description
                          )}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsSection>

      {shortcuts.enabled && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.shortcuts.search', 'Search shortcuts...')}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-800/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* ── Shortcut Categories ── */}
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div
              key={category}
              className="bg-white dark:bg-navy-800/50 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden"
            >
              <div className="px-6 py-3 border-b border-white/5">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {t(
                    `settings.shortcuts.categories.${category}`,
                    CATEGORY_LABELS[category as ShortcutCategory]
                  )}
                </h4>
              </div>

              <div className="divide-y divide-white/5">
                {categoryShortcuts.map((shortcut) => {
                  const isDisabled = shortcuts.disabledShortcuts?.includes(shortcut.id);
                  const isEditing = editingShortcut === shortcut.id;

                  return (
                    <div
                      key={shortcut.id}
                      className={cn(
                        'flex items-center justify-between px-6 py-3 transition-colors',
                        isDisabled ? 'opacity-40' : 'hover:bg-white/[0.02]'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {getShortcutName(shortcut)}
                        </p>
                        <p className="text-xs text-slate-500">{getShortcutDescription(shortcut)}</p>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={newKeyBinding}
                              onChange={() => {}}
                              onKeyDown={handleKeyCapture}
                              placeholder={t(
                                'settings.shortcuts.pressKeysPlaceholder',
                                'Press keys...'
                              )}
                              className="w-32 px-2 py-1 text-sm bg-white dark:bg-navy-900 border border-primary-400 dark:border-primary-500 rounded text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                            <button
                              onClick={() => saveCustomShortcut(shortcut.id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingShortcut(null);
                                setNewKeyBinding('');
                              }}
                              className="p-1 text-slate-500 hover:bg-white/10 rounded transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <KeyBadge keys={getShortcutKey(shortcut)} />
                            <button
                              onClick={() => setEditingShortcut(shortcut.id)}
                              className="p-1 text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 rounded transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => toggleShortcut(shortcut.id)}
                              className={cn(
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
                                isDisabled ? 'bg-white/10' : 'bg-navy-900'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200',
                                  isDisabled ? 'translate-x-1' : 'translate-x-5'
                                )}
                              />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tip */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl">
            <Info size={16} className="text-[var(--c-info)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {t('settings.shortcuts.tip', 'Tip')}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {t(
                  'settings.shortcuts.tipText',
                  'Press "?" anywhere in the app to see available shortcuts. Sequences like "g h" mean press g, release, then press h.'
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default KeyboardShortcutsSettings;
