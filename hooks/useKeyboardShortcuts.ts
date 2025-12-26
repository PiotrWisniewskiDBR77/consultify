/**
 * useKeyboardShortcuts Hook - Keyboard navigation for My Work module
 * Part of My Work Module PMO Upgrade
 * 
 * Shortcuts:
 * - g + f: Go to Focus
 * - g + i: Go to Inbox
 * - g + t: Go to Tasks
 * - g + d: Go to Dashboard
 * - c: Create new task
 * - /: Focus search
 * - Escape: Close modal
 * - ?: Show shortcuts help
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface ShortcutConfig {
    key: string;
    modifiers?: Array<'ctrl' | 'shift' | 'alt' | 'meta'>;
    action: () => void;
    description: string;
    category?: string;
    disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
    shortcuts?: ShortcutConfig[];
    onCreateTask?: () => void;
    onFocusSearch?: () => void;
    onCloseModal?: () => void;
    onShowHelp?: () => void;
    onNavigate?: (tab: string) => void;
    enabled?: boolean;
}

interface UseKeyboardShortcutsReturn {
    isEnabled: boolean;
    toggleShortcuts: () => void;
    showHelp: boolean;
    setShowHelp: (show: boolean) => void;
    allShortcuts: ShortcutConfig[];
}

// Default shortcuts
const createDefaultShortcuts = (
    onNavigate?: (tab: string) => void,
    onCreateTask?: () => void,
    onFocusSearch?: () => void,
    onCloseModal?: () => void,
    onShowHelp?: () => void
): ShortcutConfig[] => [
    // Navigation (g + key)
    {
        key: 'f',
        action: () => onNavigate?.('focus'),
        description: 'Go to Focus',
        category: 'Navigation'
    },
    {
        key: 'i',
        action: () => onNavigate?.('inbox'),
        description: 'Go to Inbox',
        category: 'Navigation'
    },
    {
        key: 't',
        action: () => onNavigate?.('tasks'),
        description: 'Go to Tasks',
        category: 'Navigation'
    },
    {
        key: 'd',
        action: () => onNavigate?.('dashboard'),
        description: 'Go to Dashboard',
        category: 'Navigation'
    },
    {
        key: 'p',
        action: () => onNavigate?.('preferences'),
        description: 'Go to Preferences',
        category: 'Navigation'
    },
    // Actions
    {
        key: 'c',
        action: () => onCreateTask?.(),
        description: 'Create new task',
        category: 'Actions'
    },
    {
        key: '/',
        action: () => onFocusSearch?.(),
        description: 'Focus search',
        category: 'Actions'
    },
    {
        key: 'Escape',
        action: () => onCloseModal?.(),
        description: 'Close modal',
        category: 'Actions'
    },
    {
        key: '?',
        modifiers: ['shift'],
        action: () => onShowHelp?.(),
        description: 'Show keyboard shortcuts',
        category: 'Help'
    }
];

/**
 * useKeyboardShortcuts Hook
 */
export function useKeyboardShortcuts(
    options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn {
    const {
        shortcuts: customShortcuts = [],
        onCreateTask,
        onFocusSearch,
        onCloseModal,
        onShowHelp,
        onNavigate,
        enabled = true
    } = options;
    
    const [isEnabled, setIsEnabled] = useState(enabled);
    const [showHelp, setShowHelp] = useState(false);
    const [pendingG, setPendingG] = useState(false);
    const pendingGTimeout = useRef<NodeJS.Timeout | null>(null);
    
    // Combine default and custom shortcuts
    const defaultShortcuts = createDefaultShortcuts(
        onNavigate,
        onCreateTask,
        onFocusSearch,
        onCloseModal,
        () => setShowHelp(true)
    );
    
    const allShortcuts = [...defaultShortcuts, ...customShortcuts];
    
    // Handle keydown
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!isEnabled) return;
        
        // Ignore if typing in input/textarea
        const target = event.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // Only allow Escape in inputs
            if (event.key !== 'Escape') return;
        }
        
        // Handle 'g' prefix for navigation
        if (event.key === 'g' && !pendingG && !event.ctrlKey && !event.metaKey) {
            setPendingG(true);
            // Clear pending after 1 second
            pendingGTimeout.current = setTimeout(() => {
                setPendingG(false);
            }, 1000);
            return;
        }
        
        // If 'g' was pressed, handle navigation shortcuts
        if (pendingG) {
            setPendingG(false);
            if (pendingGTimeout.current) {
                clearTimeout(pendingGTimeout.current);
            }
            
            const navShortcut = allShortcuts.find(
                s => s.key === event.key && s.category === 'Navigation'
            );
            
            if (navShortcut && !navShortcut.disabled) {
                event.preventDefault();
                navShortcut.action();
                return;
            }
        }
        
        // Handle other shortcuts
        const shortcut = allShortcuts.find(s => {
            if (s.key !== event.key) return false;
            if (s.category === 'Navigation') return false; // Already handled above
            
            // Check modifiers
            const modifiers = s.modifiers || [];
            const ctrlMatch = modifiers.includes('ctrl') === event.ctrlKey;
            const shiftMatch = modifiers.includes('shift') === event.shiftKey;
            const altMatch = modifiers.includes('alt') === event.altKey;
            const metaMatch = modifiers.includes('meta') === event.metaKey;
            
            return ctrlMatch && shiftMatch && altMatch && metaMatch;
        });
        
        if (shortcut && !shortcut.disabled) {
            event.preventDefault();
            shortcut.action();
        }
    }, [isEnabled, pendingG, allShortcuts]);
    
    // Setup event listener
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (pendingGTimeout.current) {
                clearTimeout(pendingGTimeout.current);
            }
        };
    }, [handleKeyDown]);
    
    // Toggle shortcuts
    const toggleShortcuts = useCallback(() => {
        setIsEnabled(prev => !prev);
    }, []);
    
    return {
        isEnabled,
        toggleShortcuts,
        showHelp,
        setShowHelp,
        allShortcuts
    };
}

export default useKeyboardShortcuts;

