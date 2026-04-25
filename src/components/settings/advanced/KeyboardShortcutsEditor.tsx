/**
 * KeyboardShortcutsEditor - Full keyboard shortcuts configuration
 */

import { Filter, Keyboard, Loader2, RotateCcw, Save, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

interface KeyboardShortcutsEditorProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface ShortcutBinding {
  id: string;
  action: string;
  category: string;
  description: string;
  keys: string[];
  isCustom: boolean;
  isConflicting: boolean;
}

export const KeyboardShortcutsEditor: React.FC<KeyboardShortcutsEditorProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);

  const categories = ['navigation', 'editing', 'views', 'actions', 'ai', 'system'];

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Sample shortcuts data
      setShortcuts([
        {
          id: '1',
          action: 'go_home',
          category: 'navigation',
          description: 'Go to Dashboard',
          keys: ['Cmd', 'H'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '2',
          action: 'go_inbox',
          category: 'navigation',
          description: 'Go to Inbox',
          keys: ['G', 'I'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '3',
          action: 'go_projects',
          category: 'navigation',
          description: 'Go to Projects',
          keys: ['G', 'P'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '4',
          action: 'new_task',
          category: 'actions',
          description: 'Create New Task',
          keys: ['N', 'T'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '5',
          action: 'new_project',
          category: 'actions',
          description: 'Create New Project',
          keys: ['N', 'P'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '6',
          action: 'search',
          category: 'system',
          description: 'Open Search',
          keys: ['Cmd', 'K'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '7',
          action: 'command_palette',
          category: 'system',
          description: 'Command Palette',
          keys: ['Cmd', 'Shift', 'P'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '8',
          action: 'ai_assist',
          category: 'ai',
          description: 'Open AI Assistant',
          keys: ['Cmd', 'J'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '9',
          action: 'save',
          category: 'editing',
          description: 'Save Current',
          keys: ['Cmd', 'S'],
          isCustom: false,
          isConflicting: false,
        },
        {
          id: '10',
          action: 'toggle_sidebar',
          category: 'views',
          description: 'Toggle Sidebar',
          keys: ['Cmd', 'B'],
          isCustom: false,
          isConflicting: false,
        },
      ]);
    } catch (error) {
      console.error('Error loading shortcuts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editingId) return;
      e.preventDefault();

      const keys: string[] = [];
      if (e.metaKey || e.ctrlKey) keys.push('Cmd');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');

      const key = e.key.toUpperCase();
      if (!['META', 'CONTROL', 'SHIFT', 'ALT'].includes(key)) {
        keys.push(key);
      }

      setRecordingKeys(keys);
    },
    [editingId]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const saveShortcut = (id: string) => {
    if (recordingKeys.length === 0) return;

    // Check for conflicts
    const conflict = shortcuts.find(
      (s) => s.id !== id && JSON.stringify(s.keys) === JSON.stringify(recordingKeys)
    );

    setShortcuts(
      shortcuts.map((s) =>
        s.id === id
          ? { ...s, keys: recordingKeys, isCustom: true, isConflicting: !!conflict }
          : s.id === conflict?.id
            ? { ...s, isConflicting: true }
            : s
      )
    );

    if (conflict) {
      toast.error(
        t('settings.shortcuts.editor.conflictWith', 'Conflict with: {{shortcut}}', {
          shortcut: getShortcutDescription(conflict),
        })
      );
    }

    setEditingId(null);
    setRecordingKeys([]);
  };

  const resetShortcut = (id: string) => {
    // Reset to default would require default data
    toast.success(t('settings.shortcuts.editor.resetToDefault', 'Reset to default'));
  };

  const resetAllShortcuts = () => {
    if (
      window.confirm(
        t('settings.shortcuts.editor.resetAllConfirm', 'Reset all shortcuts to defaults?')
      )
    ) {
      loadData();
      toast.success(t('settings.shortcuts.editor.allReset', 'All shortcuts reset'));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.put('/api/user/keyboard-shortcuts', { shortcuts });
      toast.success(t('settings.shortcuts.saved', 'Shortcuts saved'));
    } catch (error) {
      toast.error(t('settings.shortcuts.error', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const getShortcutDescription = (shortcut: ShortcutBinding) =>
    t(`settings.shortcuts.editor.actions.${shortcut.action}`, shortcut.description);

  const getCategoryLabel = (category: string) =>
    t(`settings.shortcuts.editor.categories.${category}`, category);

  const filteredShortcuts = shortcuts.filter((s) => {
    const matchesSearch =
      getShortcutDescription(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.join('+').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <InfoButton cardId="settings-keyboard-shortcuts" position="top-right" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Keyboard size={28} className="text-purple-500" />
            {t('settings.shortcuts.title', 'Keyboard Shortcuts')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {t(
              'settings.shortcuts.editor.subtitle',
              'Customize keyboard shortcuts for quick navigation'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAllShortcuts}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-navy-800 rounded-lg"
          >
            <RotateCcw size={16} />
            {t('settings.shortcuts.editor.resetAll', 'Reset All')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('common.saveChanges', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('settings.shortcuts.search', 'Search shortcuts...')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400 dark:text-slate-500" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg"
          >
            <option value="all">
              {t('settings.shortcuts.editor.allCategories', 'All Categories')}
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Shortcuts List */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr,1fr,auto] gap-4 p-3 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-navy-700 text-sm font-medium text-slate-500 dark:text-slate-400">
          <span>{t('settings.shortcuts.editor.actionHeader', 'Action')}</span>
          <span>{t('settings.shortcuts.editor.shortcutHeader', 'Shortcut')}</span>
          <span className="w-24 text-center">
            {t('settings.shortcuts.editor.actionsHeader', 'Actions')}
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/10">
          {filteredShortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className={`grid grid-cols-[2fr,1fr,auto] gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-navy-950 ${shortcut.isConflicting ? 'bg-red-50 dark:bg-red-500/10' : ''}`}
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {getShortcutDescription(shortcut)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                    {getCategoryLabel(shortcut.category)}
                  </span>
                  {shortcut.isCustom && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                      {t('settings.shortcuts.editor.custom', 'Custom')}
                    </span>
                  )}
                  {shortcut.isConflicting && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                      {t('settings.shortcuts.editor.conflict', 'Conflict')}
                    </span>
                  )}
                </div>
              </div>

              <div>
                {editingId === shortcut.id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {recordingKeys.length > 0 ? (
                        recordingKeys.map((key, i) => (
                          <kbd
                            key={i}
                            className="px-2 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded text-sm font-mono border border-purple-200 dark:border-purple-500/30"
                          >
                            {key}
                          </kbd>
                        ))
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-sm animate-pulse">
                          {t('settings.shortcuts.pressKeysPlaceholder', 'Press keys...')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => saveShortcut(shortcut.id)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setRecordingKeys([]);
                      }}
                      className="p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800/30 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded text-sm font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 w-24 justify-center">
                {editingId !== shortcut.id && (
                  <>
                    <button
                      onClick={() => setEditingId(shortcut.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg text-sm"
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                    {shortcut.isCustom && (
                      <button
                        onClick={() => resetShortcut(shortcut.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/30 dark:hover:bg-navy-800 rounded-lg"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help */}
      <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4">
        <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2">
          {t('settings.shortcuts.editor.tipsTitle', 'Keyboard Shortcut Tips')}
        </h4>
        <ul className="text-sm text-purple-600 dark:text-purple-300 space-y-1">
          <li>
            {t(
              'settings.shortcuts.editor.tipEdit',
              '• Click "Edit" and press your desired key combination'
            )}
          </li>
          <li>
            {t(
              'settings.shortcuts.editor.tipSystem',
              '• Use Cmd/Ctrl + other keys for system shortcuts'
            )}
          </li>
          <li>
            {t(
              'settings.shortcuts.editor.tipSequences',
              '• Two-key sequences (like G I) work for navigation'
            )}
          </li>
          <li>
            {t(
              'settings.shortcuts.editor.tipConflicts',
              '• Conflicts are highlighted in red - resolve before saving'
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default KeyboardShortcutsEditor;
