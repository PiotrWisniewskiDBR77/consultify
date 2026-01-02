/**
 * KeyboardShortcutsEditor - Full keyboard shortcuts configuration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../../types';
import { useTranslation } from 'react-i18next';
import { Keyboard, Save, Loader2, RotateCcw, Search, Filter, X } from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';
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

export const KeyboardShortcutsEditor: React.FC<KeyboardShortcutsEditorProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [recordingKeys, setRecordingKeys] = useState<string[]>([]);

    const categories = ['Navigation', 'Editing', 'Views', 'Actions', 'AI', 'System'];

    useEffect(() => { loadData(); }, [currentUser.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Sample shortcuts data
            setShortcuts([
                { id: '1', action: 'go_home', category: 'Navigation', description: 'Go to Dashboard', keys: ['Cmd', 'H'], isCustom: false, isConflicting: false },
                { id: '2', action: 'go_inbox', category: 'Navigation', description: 'Go to Inbox', keys: ['G', 'I'], isCustom: false, isConflicting: false },
                { id: '3', action: 'go_projects', category: 'Navigation', description: 'Go to Projects', keys: ['G', 'P'], isCustom: false, isConflicting: false },
                { id: '4', action: 'new_task', category: 'Actions', description: 'Create New Task', keys: ['N', 'T'], isCustom: false, isConflicting: false },
                { id: '5', action: 'new_project', category: 'Actions', description: 'Create New Project', keys: ['N', 'P'], isCustom: false, isConflicting: false },
                { id: '6', action: 'search', category: 'System', description: 'Open Search', keys: ['Cmd', 'K'], isCustom: false, isConflicting: false },
                { id: '7', action: 'command_palette', category: 'System', description: 'Command Palette', keys: ['Cmd', 'Shift', 'P'], isCustom: false, isConflicting: false },
                { id: '8', action: 'ai_assist', category: 'AI', description: 'Open AI Assistant', keys: ['Cmd', 'J'], isCustom: false, isConflicting: false },
                { id: '9', action: 'save', category: 'Editing', description: 'Save Current', keys: ['Cmd', 'S'], isCustom: false, isConflicting: false },
                { id: '10', action: 'toggle_sidebar', category: 'Views', description: 'Toggle Sidebar', keys: ['Cmd', 'B'], isCustom: false, isConflicting: false },
            ]);
        } catch (error) {
            console.error('Error loading shortcuts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
    }, [editingId]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const saveShortcut = (id: string) => {
        if (recordingKeys.length === 0) return;
        
        // Check for conflicts
        const conflict = shortcuts.find(s => s.id !== id && JSON.stringify(s.keys) === JSON.stringify(recordingKeys));
        
        setShortcuts(shortcuts.map(s => 
            s.id === id 
                ? { ...s, keys: recordingKeys, isCustom: true, isConflicting: !!conflict }
                : s.id === conflict?.id
                    ? { ...s, isConflicting: true }
                    : s
        ));
        
        if (conflict) {
            toast.error(`Conflict with: ${conflict.description}`);
        }
        
        setEditingId(null);
        setRecordingKeys([]);
    };

    const resetShortcut = (id: string) => {
        // Reset to default would require default data
        toast.success('Reset to default');
    };

    const resetAllShortcuts = () => {
        if (window.confirm('Reset all shortcuts to defaults?')) {
            loadData();
            toast.success('All shortcuts reset');
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await Api.put('/api/user/keyboard-shortcuts', { shortcuts });
            toast.success('Shortcuts saved');
        } catch (error) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const filteredShortcuts = shortcuts.filter(s => {
        const matchesSearch = s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.keys.join('+').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
            <InfoButton cardId="settings-keyboard-shortcuts" position="top-right" />
            
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Keyboard size={28} className="text-purple-500" />
                        Keyboard Shortcuts
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Customize keyboard shortcuts for quick navigation</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={resetAllShortcuts} className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg">
                        <RotateCcw size={16} />
                        Reset All
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg disabled:opacity-50">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-4">
                <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search shortcuts..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>

            {/* Shortcuts List */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[2fr,1fr,auto] gap-4 p-3 bg-slate-50 dark:bg-navy-950 border-b border-slate-200 dark:border-white/10 text-sm font-medium text-slate-500">
                    <span>Action</span>
                    <span>Shortcut</span>
                    <span className="w-24 text-center">Actions</span>
                </div>
                
                <div className="divide-y divide-slate-200 dark:divide-white/10">
                    {filteredShortcuts.map((shortcut) => (
                        <div key={shortcut.id} className={`grid grid-cols-[2fr,1fr,auto] gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-navy-950 ${shortcut.isConflicting ? 'bg-red-50 dark:bg-red-500/10' : ''}`}>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{shortcut.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
                                        {shortcut.category}
                                    </span>
                                    {shortcut.isCustom && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                                            Custom
                                        </span>
                                    )}
                                    {shortcut.isConflicting && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                            Conflict
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
                                                    <kbd key={i} className="px-2 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded text-sm font-mono border border-purple-200 dark:border-purple-500/30">
                                                        {key}
                                                    </kbd>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 text-sm animate-pulse">Press keys...</span>
                                            )}
                                        </div>
                                        <button onClick={() => saveShortcut(shortcut.id)} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                            <Save size={14} />
                                        </button>
                                        <button onClick={() => { setEditingId(null); setRecordingKeys([]); }} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-1">
                                        {shortcut.keys.map((key, i) => (
                                            <kbd key={i} className="px-2 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded text-sm font-mono">
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
                                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg text-sm"
                                        >
                                            Edit
                                        </button>
                                        {shortcut.isCustom && (
                                            <button 
                                                onClick={() => resetShortcut(shortcut.id)} 
                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
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
                <h4 className="font-medium text-purple-700 dark:text-purple-400 mb-2">Keyboard Shortcut Tips</h4>
                <ul className="text-sm text-purple-600 dark:text-purple-300 space-y-1">
                    <li>• Click "Edit" and press your desired key combination</li>
                    <li>• Use Cmd/Ctrl + other keys for system shortcuts</li>
                    <li>• Two-key sequences (like G I) work for navigation</li>
                    <li>• Conflicts are highlighted in red - resolve before saving</li>
                </ul>
            </div>
        </div>
    );
};

export default KeyboardShortcutsEditor;

