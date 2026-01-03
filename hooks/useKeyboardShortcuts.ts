/**
 * useKeyboardShortcuts Hook
 * 
 * React hook for managing keyboard shortcuts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Api } from '../services/api';
import { KeyboardShortcuts, ShortcutPreset, ShortcutAction } from '../types';

// Default keyboard shortcuts
const DEFAULT_SHORTCUTS: ShortcutAction[] = [
    // Navigation
    { id: 'go_home', name: 'Go to Home', description: 'Navigate to dashboard', category: 'navigation', defaultKey: 'g h' },
    { id: 'go_tasks', name: 'Go to Tasks', description: 'Navigate to my tasks', category: 'navigation', defaultKey: 'g t' },
    { id: 'go_inbox', name: 'Go to Inbox', description: 'Navigate to inbox', category: 'navigation', defaultKey: 'g i' },
    { id: 'go_settings', name: 'Go to Settings', description: 'Navigate to settings', category: 'navigation', defaultKey: 'g s' },
    
    // Search
    { id: 'search_global', name: 'Global Search', description: 'Open global search', category: 'search', defaultKey: 'Cmd+K' },
    
    // Task Management
    { id: 'new_task', name: 'New Task', description: 'Create a new task', category: 'task_management', defaultKey: 'n t' },
    { id: 'complete_task', name: 'Complete Task', description: 'Mark selected task as done', category: 'task_management', defaultKey: 'c' },
    
    // AI
    { id: 'ai_assist', name: 'AI Assistant', description: 'Open AI assistant', category: 'ai', defaultKey: 'Cmd+J' },
    
    // General
    { id: 'toggle_sidebar', name: 'Toggle Sidebar', description: 'Show/hide sidebar', category: 'general', defaultKey: 'Cmd+\\' },
    { id: 'help', name: 'Help', description: 'Show keyboard shortcuts', category: 'general', defaultKey: '?' },
];

interface UseKeyboardShortcutsOptions {
    onShortcutTriggered?: (action: string) => void;
}

interface UseKeyboardShortcutsReturn {
    shortcuts: KeyboardShortcuts;
    allShortcuts: ShortcutAction[];
    loading: boolean;
    saving: boolean;
    
    // Actions
    setEnabled: (enabled: boolean) => Promise<void>;
    setPreset: (preset: ShortcutPreset) => Promise<void>;
    setCustomShortcut: (actionId: string, key: string) => Promise<void>;
    resetShortcut: (actionId: string) => Promise<void>;
    toggleShortcut: (actionId: string) => Promise<void>;
    resetAll: () => Promise<void>;
    
    // Query
    getShortcutKey: (actionId: string) => string;
    isShortcutEnabled: (actionId: string) => boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}): UseKeyboardShortcutsReturn {
    const { onShortcutTriggered } = options;
    
    const [shortcuts, setShortcuts] = useState<KeyboardShortcuts>({
        preset: 'default',
        enabled: true,
        showHints: true,
        customShortcuts: {},
        disabledShortcuts: []
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const sequenceBuffer = useRef<string[]>([]);
    const sequenceTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

    // Load shortcuts from API
    useEffect(() => {
        loadShortcuts();
    }, []);

    // Set up keyboard listener
    useEffect(() => {
        if (!shortcuts.enabled) return;
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!shortcuts.enabled) return;
            
            // Ignore if typing in input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            
            // Build key string
            const parts: string[] = [];
            if (e.metaKey || e.ctrlKey) parts.push('Cmd');
            if (e.shiftKey) parts.push('Shift');
            if (e.altKey) parts.push('Alt');
            if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
            }
            
            const keyCombo = parts.join('+');
            
            // Handle sequence shortcuts (like 'g h')
            if (parts.length === 1 && parts[0].length === 1) {
                sequenceBuffer.current.push(parts[0]);
                
                // Clear sequence after timeout
                if (sequenceTimeout.current) {
                    clearTimeout(sequenceTimeout.current);
                }
                sequenceTimeout.current = setTimeout(() => {
                    sequenceBuffer.current = [];
                }, 500);
                
                // Check for sequence match
                const sequence = sequenceBuffer.current.join(' ');
                const matchedAction = findMatchingAction(sequence);
                if (matchedAction) {
                    e.preventDefault();
                    sequenceBuffer.current = [];
                    onShortcutTriggered?.(matchedAction.id);
                }
            } else {
                // Check for direct shortcut match
                const matchedAction = findMatchingAction(keyCombo);
                if (matchedAction) {
                    e.preventDefault();
                    onShortcutTriggered?.(matchedAction.id);
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts.enabled, shortcuts.customShortcuts, shortcuts.disabledShortcuts, onShortcutTriggered]);

    const loadShortcuts = async () => {
        setLoading(true);
        try {
            const response = await Api.get('/settings/preferences/shortcuts');
            if (response.preferences) {
                setShortcuts(response.preferences);
            }
        } catch (error) {
            console.error('Failed to load shortcuts:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveShortcuts = async (newShortcuts: KeyboardShortcuts) => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/shortcuts', newShortcuts);
            setShortcuts(newShortcuts);
        } catch (error) {
            console.error('Failed to save shortcuts:', error);
            throw error;
        } finally {
            setSaving(false);
        }
    };

    const findMatchingAction = (key: string): ShortcutAction | null => {
        for (const action of DEFAULT_SHORTCUTS) {
            if (shortcuts.disabledShortcuts?.includes(action.id)) continue;
            
            const currentKey = shortcuts.customShortcuts?.[action.id] || action.defaultKey;
            if (currentKey.toLowerCase() === key.toLowerCase()) {
                return action;
            }
        }
        return null;
    };

    const setEnabled = async (enabled: boolean) => {
        await saveShortcuts({ ...shortcuts, enabled });
    };

    const setPreset = async (preset: ShortcutPreset) => {
        await saveShortcuts({ 
            ...shortcuts, 
            preset,
            // Clear custom shortcuts when switching to non-custom preset
            customShortcuts: preset === 'custom' ? shortcuts.customShortcuts : {}
        });
    };

    const setCustomShortcut = async (actionId: string, key: string) => {
        await saveShortcuts({
            ...shortcuts,
            preset: 'custom',
            customShortcuts: {
                ...shortcuts.customShortcuts,
                [actionId]: key
            }
        });
    };

    const resetShortcut = async (actionId: string) => {
        const { [actionId]: _, ...rest } = shortcuts.customShortcuts || {};
        await saveShortcuts({
            ...shortcuts,
            customShortcuts: rest
        });
    };

    const toggleShortcut = async (actionId: string) => {
        const isDisabled = shortcuts.disabledShortcuts?.includes(actionId);
        await saveShortcuts({
            ...shortcuts,
            disabledShortcuts: isDisabled
                ? shortcuts.disabledShortcuts?.filter(id => id !== actionId) || []
                : [...(shortcuts.disabledShortcuts || []), actionId]
        });
    };

    const resetAll = async () => {
        await saveShortcuts({
            preset: 'default',
            enabled: true,
            showHints: true,
            customShortcuts: {},
            disabledShortcuts: []
        });
    };

    const getShortcutKey = (actionId: string): string => {
        const action = DEFAULT_SHORTCUTS.find(a => a.id === actionId);
        return shortcuts.customShortcuts?.[actionId] || action?.defaultKey || '';
    };

    const isShortcutEnabled = (actionId: string): boolean => {
        return shortcuts.enabled && !shortcuts.disabledShortcuts?.includes(actionId);
    };

    return {
        shortcuts,
        allShortcuts: DEFAULT_SHORTCUTS,
        loading,
        saving,
        
        setEnabled,
        setPreset,
        setCustomShortcut,
        resetShortcut,
        toggleShortcut,
        resetAll,
        
        getShortcutKey,
        isShortcutEnabled,
    };
}

export default useKeyboardShortcuts;
