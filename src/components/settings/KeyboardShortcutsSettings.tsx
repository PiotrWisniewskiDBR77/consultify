// @ts-nocheck
import {
    Check,
    CheckCircle,
    Command,
    Edit2,
    Info,
    Keyboard,
    Loader2,
    RotateCcw,
    Save,
    Search,
    Settings,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { KeyboardShortcuts, ShortcutAction, ShortcutCategory, ShortcutPreset, User } from '../../types';

interface KeyboardShortcutsSettingsProps {
    currentUser: User;
    onUpdate?: () => void;
}

// Default keyboard shortcuts
const DEFAULT_SHORTCUTS: ShortcutAction[] = [
    // Navigation
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

    // Search
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

    // Task Management
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

    // Editing
    { id: 'save', name: 'Save', description: 'Save current changes', category: 'editing', defaultKey: 'Cmd+S' },
    { id: 'undo', name: 'Undo', description: 'Undo last action', category: 'editing', defaultKey: 'Cmd+Z' },
    { id: 'redo', name: 'Redo', description: 'Redo last action', category: 'editing', defaultKey: 'Cmd+Shift+Z' },

    // AI
    { id: 'ai_assist', name: 'AI Assistant', description: 'Open AI assistant', category: 'ai', defaultKey: 'Cmd+J' },
    {
        id: 'ai_summarize',
        name: 'AI Summarize',
        description: 'Summarize selected text',
        category: 'ai',
        defaultKey: 'Cmd+Shift+S',
    },

    // General
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
    { id: 'help', name: 'Help', description: 'Show keyboard shortcuts', category: 'general', defaultKey: '?' },
];

const PRESET_OPTIONS: { value: ShortcutPreset; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'Consultinity default shortcuts' },
    { value: 'vscode', label: 'VS Code', description: 'Visual Studio Code style' },
    { value: 'sublime', label: 'Sublime Text', description: 'Sublime Text style' },
    { value: 'vim', label: 'Vim', description: 'Vim-style navigation' },
    { value: 'custom', label: 'Custom', description: 'Your custom configuration' },
];

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
    navigation: 'Navigation',
    editing: 'Editing',
    task_management: 'Task Management',
    search: 'Search',
    ai: 'AI Features',
    general: 'General',
};

export const KeyboardShortcutsSettings: React.FC<KeyboardShortcutsSettingsProps> = ({ currentUser, onUpdate }) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
    const [newKeyBinding, setNewKeyBinding] = useState('');

    const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>({
        preset: 'default',
        enabled: true,
        showHints: true,
        customShortcuts: {},
        disabledShortcuts: [],
    });

    // Load preferences
    useEffect(() => {
        loadShortcuts();
    }, [currentUser.id]);

    const loadShortcuts = async () => {
        try {
            const response = await Api.get('/settings/preferences/shortcuts');
            if (response.preferences) {
                setShortcuts(response.preferences);
            }
        } catch (error) {
            console.error('Failed to load shortcuts:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await Api.put('/settings/preferences/shortcuts', shortcuts);
            setSaveStatus('success');
            onUpdate?.();
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Failed to save shortcuts:', error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const resetToDefault = () => {
        setShortcuts({
            preset: 'default',
            enabled: true,
            showHints: true,
            customShortcuts: {},
            disabledShortcuts: [],
        });
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

        if (parts.length > 0) {
            setNewKeyBinding(parts.join('+'));
        }
    };

    const saveCustomShortcut = (shortcutId: string) => {
        if (newKeyBinding) {
            setShortcuts((prev: any) => ({
                ...prev,
                preset: 'custom',
                customShortcuts: {
                    ...prev.customShortcuts,
                    [shortcutId]: newKeyBinding,
                },
            }));
        }
        setEditingShortcut(null);
        setNewKeyBinding('');
    };

    const toggleShortcut = (shortcutId: string) => {
        setShortcuts((prev: any) => {
            const isDisabled = prev.disabledShortcuts?.includes(shortcutId);
            return {
                ...prev,
                disabledShortcuts: isDisabled
                    ? prev.disabledShortcuts?.filter((id: string) => id !== shortcutId) || []
                    : [...(prev.disabledShortcuts || []), shortcutId],
            };
        });
    };

    const getShortcutKey = (shortcut: ShortcutAction): string => {
        return shortcuts.customShortcuts?.[shortcut.id] || shortcut.defaultKey;
    };

    const filteredShortcuts = DEFAULT_SHORTCUTS.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const groupedShortcuts = filteredShortcuts.reduce(
        (acc, shortcut) => {
            if (!acc[shortcut.category]) acc[shortcut.category] = [];
            acc[shortcut.category].push(shortcut);
            return acc;
        },
        {} as Record<ShortcutCategory, ShortcutAction[]>,
    );

    // Styling
    const cardClass = 'bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg p-6';
    const sectionTitleClass =
        'text-sm font-bold text-navy-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2';
    const toggleClass = (enabled: boolean) =>
        `relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
        }`;
    const toggleKnobClass = (enabled: boolean) =>
        `absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`;

    const KeyBadge = ({ keys }: { keys: string }) => (
        <div className="flex items-center gap-1">
            {keys.split('+').map((key, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <span className="text-slate-400 text-xs">+</span>}
                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded text-slate-600 dark:text-slate-300">
                        {key === 'Cmd' ? <Command size={12} className="inline" /> : key}
                    </kbd>
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                        {t('settings.shortcuts.title', 'Keyboard Shortcuts')}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {t('settings.shortcuts.description', 'Customize keyboard shortcuts to boost your productivity')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetToDefault}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-950 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                    >
                        <RotateCcw size={16} />
                        {t('settings.shortcuts.reset', 'Reset')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                    </button>
                </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className={cardClass}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className={`p-2 rounded-lg ${shortcuts.enabled ? 'bg-purple-100 dark:bg-purple-500/20' : 'bg-slate-100 dark:bg-white/10'}`}
                        >
                            <Keyboard
                                size={20}
                                className={
                                    shortcuts.enabled ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'
                                }
                            />
                        </div>
                        <div>
                            <p className="font-medium text-navy-900 dark:text-white">
                                {t('settings.shortcuts.enable', 'Enable Keyboard Shortcuts')}
                            </p>
                            <p className="text-sm text-slate-500">
                                {t('settings.shortcuts.enableDesc', 'Use keyboard shortcuts throughout the app')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShortcuts((prev: any) => ({ ...prev, enabled: !prev.enabled }))}
                        className={toggleClass(shortcuts.enabled)}
                    >
                        <span className={toggleKnobClass(shortcuts.enabled)} />
                    </button>
                </div>

                {shortcuts.enabled && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-navy-900 dark:text-white">
                                    {t('settings.shortcuts.showHints', 'Show Shortcut Hints')}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {t('settings.shortcuts.showHintsDesc', 'Display keyboard hints next to actions')}
                                </p>
                            </div>
                            <button
                                onClick={() => setShortcuts((prev: any) => ({ ...prev, showHints: !prev.showHints }))}
                                className={toggleClass(shortcuts.showHints)}
                            >
                                <span className={toggleKnobClass(shortcuts.showHints)} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {shortcuts.enabled && (
                <>
                    {/* Preset Selection */}
                    <div className={cardClass}>
                        <h4 className={sectionTitleClass}>
                            <Settings size={16} className="text-purple-500" />
                            {t('settings.shortcuts.preset', 'Shortcut Preset')}
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {PRESET_OPTIONS.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() => setShortcuts((prev: any) => ({ ...prev, preset: preset.value }))}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                                        shortcuts.preset === preset.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300'
                                    }`}
                                >
                                    <p
                                        className={`text-sm font-medium ${
                                            shortcuts.preset === preset.value
                                                ? 'text-purple-700 dark:text-purple-300'
                                                : 'text-navy-900 dark:text-white'
                                        }`}
                                    >
                                        {preset.label}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('settings.shortcuts.search', 'Search shortcuts...')}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                        />
                    </div>

                    {/* Shortcuts List */}
                    {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                        <div key={category} className={cardClass}>
                            <h4 className={sectionTitleClass}>{CATEGORY_LABELS[category as ShortcutCategory]}</h4>

                            <div className="space-y-2">
                                {categoryShortcuts.map((shortcut) => {
                                    const isDisabled = shortcuts.disabledShortcuts?.includes(shortcut.id);
                                    const isEditing = editingShortcut === shortcut.id;

                                    return (
                                        <div
                                            key={shortcut.id}
                                            className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                                                isDisabled
                                                    ? 'bg-slate-50/50 dark:bg-navy-950/25 opacity-50'
                                                    : 'bg-slate-50 dark:bg-navy-950/50 hover:bg-slate-100 dark:hover:bg-navy-950'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-navy-900 dark:text-white">
                                                    {shortcut.name}
                                                </p>
                                                <p className="text-xs text-slate-500">{shortcut.description}</p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            autoFocus
                                                            value={newKeyBinding}
                                                            onChange={() => {}}
                                                            onKeyDown={handleKeyCapture}
                                                            placeholder="Press keys..."
                                                            className="w-32 px-2 py-1 text-sm bg-white dark:bg-navy-800 border border-purple-500 rounded outline-none"
                                                        />
                                                        <button
                                                            onClick={() => saveCustomShortcut(shortcut.id)}
                                                            className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 rounded"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingShortcut(null);
                                                                setNewKeyBinding('');
                                                            }}
                                                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <KeyBadge keys={getShortcutKey(shortcut)} />
                                                        <button
                                                            onClick={() => setEditingShortcut(shortcut.id)}
                                                            className="p-1 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleShortcut(shortcut.id)}
                                                            className={`w-8 h-5 rounded-full transition-colors ${
                                                                isDisabled ? 'bg-slate-300' : 'bg-purple-500'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`block w-3 h-3 rounded-full bg-white shadow transition-all ${
                                                                    isDisabled ? 'ml-1' : 'ml-4'
                                                                }`}
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

                    {/* Help */}
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Info size={18} className="text-blue-500 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                                    {t('settings.shortcuts.tip', 'Tip')}
                                </h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                    {t(
                                        'settings.shortcuts.tipText',
                                        'Press "?" anywhere in the app to see available shortcuts. Sequences like "g h" mean press g, release, then press h.',
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Success Toast */}
            {saveStatus === 'success' && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                    <CheckCircle size={16} />
                    {t('common.saved', 'Saved!')}
                </div>
            )}
        </div>
    );
};

export default KeyboardShortcutsSettings;
