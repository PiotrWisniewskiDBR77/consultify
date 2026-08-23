/**
 * KeyboardShortcutsEditor - Full keyboard shortcuts configuration
 */

import { Filter, Keyboard, Loader2, RotateCcw, Save, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { DegradedState } from '../../Admin/AdminState';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  const categories = ['navigation', 'editing', 'views', 'actions', 'ai', 'system'];

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.get('/api/user/keyboard-shortcuts');
      const loadedShortcuts = data?.shortcuts;
      if (!Array.isArray(loadedShortcuts)) {
        throw new Error('Keyboard shortcut response was invalid');
      }
      setShortcuts(loadedShortcuts);
    } catch (error) {
      console.error('Error loading shortcuts:', error);
      setShortcuts([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load keyboard shortcuts');
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
    toast.error(
      t(
        'settings.shortcuts.editor.resetUnavailable',
        'Shortcut reset is unavailable until default bindings are loaded from the server'
      )
    );
  };

  const resetAllShortcuts = () => {
    if (
      window.confirm(
        t('settings.shortcuts.editor.resetAllConfirm', 'Reset all shortcuts to defaults?')
      )
    ) {
      loadData();
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
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <Keyboard size={28} className="text-c-accent" />
            {t('settings.shortcuts.title', 'Keyboard Shortcuts')}
          </h2>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.shortcuts.editor.subtitle',
              'Customize keyboard shortcuts for quick navigation'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAllShortcuts}
            disabled={!!loadError}
            className="flex items-center gap-2 px-3 py-2 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800/30 dark:hover:bg-navy-800 rounded-lg"
          >
            <RotateCcw size={16} />
            {t('settings.shortcuts.editor.resetAll', 'Reset All')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !!loadError}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t('common.saveChanges', 'Save Changes')}
          </button>
        </div>
      </div>

      {loadError && (
        <DegradedState title="Keyboard shortcuts unavailable" description={loadError} />
      )}

      {/* Search & Filter */}
      {!loadError && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-secondary"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('settings.shortcuts.search', 'Search shortcuts...')}
              className="w-full pl-10 pr-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg focus:ring-2 focus:ring-[color:var(--c-focus)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-c-text-secondary" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
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
      )}

      {/* Shortcuts List */}
      {!loadError && (
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr,1fr,auto] gap-4 p-3 bg-c-surface-raised border-b border-c-border-subtle dark:border-navy-700 text-sm font-medium text-c-text-muted">
            <span>{t('settings.shortcuts.editor.actionHeader', 'Action')}</span>
            <span>{t('settings.shortcuts.editor.shortcutHeader', 'Shortcut')}</span>
            <span className="w-24 text-center">
              {t('settings.shortcuts.editor.actionsHeader', 'Actions')}
            </span>
          </div>

          <div className="divide-y divide-c-border-subtle dark:divide-white/10">
            {filteredShortcuts.map((shortcut) => (
              <div
                key={shortcut.id}
                className={`grid grid-cols-[2fr,1fr,auto] gap-4 p-4 items-center hover:bg-c-surface-raised dark:hover:bg-navy-950 ${shortcut.isConflicting ? 'bg-danger-50 dark:bg-danger-500/10' : ''}`}
              >
                <div>
                  <p className="font-medium text-c-text">{getShortcutDescription(shortcut)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-c-surface-raised text-c-text-secondary">
                      {getCategoryLabel(shortcut.category)}
                    </span>
                    {shortcut.isCustom && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-c-accent-soft dark:bg-c-accent-soft text-c-accent">
                        {t('settings.shortcuts.editor.custom', 'Custom')}
                      </span>
                    )}
                    {shortcut.isConflicting && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-danger-100 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400">
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
                              className="px-2 py-1 bg-c-accent-soft dark:bg-c-accent-soft text-c-accent rounded text-sm font-mono border border-c-accent dark:border-c-accent"
                            >
                              {key}
                            </kbd>
                          ))
                        ) : (
                          <span className="text-c-text-secondary text-sm animate-pulse">
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
                        className="p-1 text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800/30 rounded"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="px-2 py-1 bg-c-surface-raised text-c-text-secondary rounded text-sm font-mono"
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
                        className="p-2 text-c-text-secondary hover:text-c-accent hover:bg-c-accent-soft dark:hover:bg-c-accent-soft rounded-lg text-sm"
                      >
                        {t('common.edit', 'Edit')}
                      </button>
                      {shortcut.isCustom && (
                        <button
                          onClick={() => resetShortcut(shortcut.id)}
                          className="p-2 text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-navy-800/30 dark:hover:bg-navy-800 rounded-lg"
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
      )}

      {/* Help */}
      <div className="bg-c-accent-soft dark:bg-c-accent-soft border border-c-accent dark:border-c-accent rounded-xl p-4">
        <h4 className="font-medium text-c-accent mb-2">
          {t('settings.shortcuts.editor.tipsTitle', 'Keyboard Shortcut Tips')}
        </h4>
        <ul className="text-sm text-c-accent space-y-1">
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
