/**
 * useDashboardShortcuts - Hook do obsługi skrótów klawiszowych w Dashboard
 * 
 * Skróty:
 * - Cmd/Ctrl + N: Nowe zadanie
 * - Cmd/Ctrl + Shift + R: Oznacz wszystkie jako przeczytane
 * - Escape: Zamknij aktywny modal
 */

import { useEffect, useCallback } from 'react';

interface DashboardShortcutHandlers {
    onNewTask?: () => void;
    onMarkAllRead?: () => void;
    onEscape?: () => void;
}

export const useDashboardShortcuts = (handlers: DashboardShortcutHandlers) => {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignoruj jeśli użytkownik pisze w input/textarea
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // Cmd/Ctrl + N - Nowe zadanie (działa zawsze)
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            handlers.onNewTask?.();
            return;
        }
        
        // Cmd/Ctrl + Shift + R - Oznacz wszystkie jako przeczytane
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r') {
            e.preventDefault();
            handlers.onMarkAllRead?.();
            return;
        }
        
        // Escape - Zamknij modal (działa zawsze)
        if (e.key === 'Escape') {
            handlers.onEscape?.();
            return;
        }
    }, [handlers]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Zwracamy info o dostępnych skrótach dla UI
    return {
        shortcuts: [
            { keys: ['⌘', 'N'], description: 'Nowe zadanie' },
            { keys: ['⌘', '⇧', 'R'], description: 'Oznacz wszystkie jako przeczytane' },
            { keys: ['Esc'], description: 'Zamknij modal' }
        ]
    };
};
