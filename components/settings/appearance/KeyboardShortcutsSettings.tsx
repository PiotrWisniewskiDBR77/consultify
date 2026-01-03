/**
 * KeyboardShortcutsSettings - Keyboard Shortcuts Configuration
 * 
 * Features:
 * - Custom keyboard shortcuts
 * - Keyboard shortcuts reference
 * - Vim mode toggle
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTranslation } from 'react-i18next';
import {
    Keyboard,
    Search,
    Save,
    Loader2,
    Edit2,
    X,
    Check,
    Info,
    RotateCcw,
    Command
} from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { InfoButton } from '../../shared/InfoButton';

interface KeyboardShortcutsSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface Shortcut {
    id: string;
    label: string;
    description: string;
    category: string;
    defaultKeys: string;
    customKeys?: string;
}

interface ShortcutSettings {
    enabled: boolean;
    vimMode: boolean;
    customShortcuts: Record<string, string>;
}

const defaultShortcuts: Shortcut[] = [
    // Navigation
    { id: 'go_dashboard', label: 'Go to Dashboard', description: 'Navigate to dashboard', category: 'Navigation', defaultKeys: 'g d' },
    { id: 'go_projects', label: 'Go to Projects', description: 'Navigate to projects', category: 'Navigation', defaultKeys: 'g p' },
    { id: 'go_tasks', label: 'Go to Tasks', description: 'Navigate to tasks', category: 'Navigation', defaultKeys: 'g t' },
    { id: 'go_inbox', label: 'Go to Inbox', description: 'Navigate to inbox', category: 'Navigation', defaultKeys: 'g i' },
    { id: 'go_settings', label: 'Go to Settings', description: 'Navigate to settings', category: 'Navigation', defaultKeys: 'g s' },
    
    // Actions
    { id: 'new_task', label: 'New Task', description: 'Create a new task', category: 'Actions', defaultKeys: 'n t' },
    { id: 'new_project', label: 'New Project', description: 'Create a new project', category: 'Actions', defaultKeys: 'n p' },
    { id: 'quick_add', label: 'Quick Add', description: 'Open quick add menu', category: 'Actions', defaultKeys: 'Cmd+K' },
    { id: 'search', label: 'Search', description: 'Open search', category: 'Actions', defaultKeys: 'Cmd+/' },
    { id: 'save', label: 'Save', description: 'Save current item', category: 'Actions', defaultKeys: 'Cmd+S' },
    
    // View
    { id: 'toggle_sidebar', label: 'Toggle Sidebar', description: 'Show/hide sidebar', category: 'View', defaultKeys: '[' },
    { id: 'toggle_fullscreen', label: 'Toggle Fullscreen', description: 'Enter/exit fullscreen', category: 'View', defaultKeys: 'f' },
    { id: 'toggle_theme', label: 'Toggle Theme', description: 'Switch light/dark mode', category: 'View', defaultKeys: 'Cmd+Shift+L' },
    { id: 'zoom_in', label: 'Zoom In', description: 'Increase UI scale', category: 'View', defaultKeys: 'Cmd+=' },
    { id: 'zoom_out', label: 'Zoom Out', description: 'Decrease UI scale', category: 'View', defaultKeys: 'Cmd+-' },
    
    // Task Management
    { id: 'complete_task', label: 'Complete Task', description: 'Mark task as complete', category: 'Tasks', defaultKeys: 'c' },
    { id: 'delete_task', label: 'Delete Task', description: 'Delete selected task', category: 'Tasks', defaultKeys: 'Backspace' },
    { id: 'edit_task', label: 'Edit Task', description: 'Edit selected task', category: 'Tasks', defaultKeys: 'e' },
    { id: 'priority_high', label: 'High Priority', description: 'Set high priority', category: 'Tasks', defaultKeys: '1' },
    { id: 'priority_medium', label: 'Medium Priority', description: 'Set medium priority', category: 'Tasks', defaultKeys: '2' },
    { id: 'priority_low', label: 'Low Priority', description: 'Set low priority', category: 'Tasks', defaultKeys: '3' }
];

const defaultSettings: ShortcutSettings = {
    enabled: true,
    vimMode: false,
    customShortcuts: {}
};

export const KeyboardShortcutsSettings: React.FC<KeyboardShortcutsSettingsProps> = ({
    currentUser,
    onUpdateUser
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<ShortcutSettings>(defaultSettings);
    const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
    const [recordingKeys, setRecordingKeys] = useState(false);
    const [recordedKeys, setRecordedKeys] = useState('');
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        loadSettings();
    }, [currentUser.id]);

    useEffect(() => {
        if (recordingKeys) {
            const handleKeyDown = (e: KeyboardEvent) => {
                e.preventDefault();
                const keys: string[] = [];
                if (e.metaKey || e.ctrlKey) keys.push('Cmd');
                if (e.altKey) keys.push('Alt');
                if (e.shiftKey) keys.push('Shift');
                if (!['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
                    keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                }
                setRecordedKeys(keys.join('+'));
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [recordingKeys]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await Api.get('/api/user/appearance/shortcuts');
            if (response.success && response.data) {
                setSettings({ ...defaultSettings, ...response.data });
            }
        } catch (error) {
            console.error('Error loading shortcut settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await Api.put('/api/user/appearance/shortcuts', settings);
            toast.success(t('settings.shortcuts.saved', 'Keyboard shortcuts saved'));
        } catch (error) {
            toast.error(t('settings.shortcuts.error', 'Failed to save keyboard shortcuts'));
        } finally {
            setSaving(false);
        }
    };

    const startRecording = (shortcutId: string) => {
        setEditingShortcut(shortcutId);
        setRecordingKeys(true);
        setRecordedKeys('');
    };

    const saveRecordedShortcut = () => {
        if (editingShortcut && recordedKeys) {
            setSettings({
                ...settings,
                customShortcuts: {
                    ...settings.customShortcuts,
                    [editingShortcut]: recordedKeys
                }
            });
        }
        setEditingShortcut(null);
        setRecordingKeys(false);
        setRecordedKeys('');
    };

    const resetShortcut = (shortcutId: string) => {
        const { [shortcutId]: removed, ...rest } = settings.customShortcuts;
        setSettings({ ...settings, customShortcuts: rest });
    };

    const resetAllShortcuts = () => {
        setSettings({ ...settings, customShortcuts: {} });
        toast.success('All shortcuts reset to defaults');
    };

    const getShortcutKeys = (shortcut: Shortcut) => {
        return settings.customShortcuts[shortcut.id] || shortcut.defaultKeys;
    };

    const categories = ['all', ...Array.from(new Set(defaultShortcuts.map(s => s.category)))];

    const filteredShortcuts = defaultShortcuts.filter(s => {
        const matchesSearch = s.label.toLowerCase().includes(search.toLowerCase()) ||
                            s.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) acc[shortcut.category] = [];
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, Shortcut[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-amber-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            <InfoButton cardId="settings-keyboard-shortcuts" position="top-right" />
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Keyboard size={28} className="text-amber-500" />
                        {t('settings.shortcuts.title', 'Keyboard Shortcuts')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Customize keyboard shortcuts for faster navigation
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={resetAllShortcuts}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                    >
                        <RotateCcw size={16} />
                        Reset All
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Global Settings */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h3>
                
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">Enable Keyboard Shortcuts</p>
                            <p className="text-sm text-slate-500">Allow keyboard shortcuts throughout the app</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                settings.enabled ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                settings.enabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">Vim Mode</p>
                            <p className="text-sm text-slate-500">Enable vim-style navigation (h/j/k/l)</p>
                        </div>
                        <button
                            onClick={() => setSettings({ ...settings, vimMode: !settings.vimMode })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                settings.vimMode ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                settings.vimMode ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search shortcuts..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg capitalize"
                >
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                    ))}
                </select>
            </div>

            {/* Shortcuts List */}
            <div className="space-y-6">
                {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                    <div key={category} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                        <div className="px-6 py-3 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-white/10">
                            <h3 className="font-semibold text-slate-900 dark:text-white">{category}</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {shortcuts.map(shortcut => {
                                const isEditing = editingShortcut === shortcut.id;
                                const isCustomized = settings.customShortcuts[shortcut.id];
                                const currentKeys = getShortcutKeys(shortcut);

                                return (
                                    <div
                                        key={shortcut.id}
                                        className={`px-6 py-4 flex items-center justify-between transition-colors ${
                                            isEditing ? 'bg-amber-50 dark:bg-amber-500/10' : ''
                                        }`}
                                    >
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{shortcut.label}</p>
                                            <p className="text-sm text-slate-500">{shortcut.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isEditing ? (
                                                <>
                                                    <div className="px-4 py-2 bg-slate-100 dark:bg-navy-950 rounded-lg font-mono text-sm min-w-[120px] text-center">
                                                        {recordedKeys || 'Press keys...'}
                                                    </div>
                                                    <button
                                                        onClick={saveRecordedShortcut}
                                                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingShortcut(null);
                                                            setRecordingKeys(false);
                                                        }}
                                                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`flex items-center gap-1 ${isCustomized ? 'text-amber-600' : ''}`}>
                                                        {currentKeys.split('+').map((key, i) => (
                                                            <React.Fragment key={i}>
                                                                {i > 0 && <span className="text-slate-300">+</span>}
                                                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-navy-950 rounded text-sm font-mono border border-slate-200 dark:border-white/10">
                                                                    {key === 'Cmd' ? <Command size={12} className="inline" /> : key}
                                                                </kbd>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={() => startRecording(shortcut.id)}
                                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                                        title="Edit shortcut"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    {isCustomized && (
                                                        <button
                                                            onClick={() => resetShortcut(shortcut.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                                            title="Reset to default"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                    <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Tips</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Click the edit button to customize any shortcut</li>
                            <li>Press your desired key combination when recording</li>
                            <li>Use Cmd (Mac) or Ctrl (Windows) for modifier keys</li>
                            <li>Shortcuts marked in amber have been customized</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsSettings;




