/**
 * KeyboardShortcutsModal - Help modal for keyboard shortcuts
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ShortcutConfig } from '../../../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts: ShortcutConfig[];
}

/**
 * Render keyboard key
 */
const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">
        {children}
    </span>
);

/**
 * KeyboardShortcutsModal Component
 */
export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
    isOpen,
    onClose,
    shortcuts
}) => {
    const { t } = useTranslation();
    
    // Group shortcuts by category
    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        const category = shortcut.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(shortcut);
        return acc;
    }, {} as Record<string, ShortcutConfig[]>);
    
    // Format key for display
    const formatKey = (shortcut: ShortcutConfig): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        
        // Add modifiers
        shortcut.modifiers?.forEach((mod) => {
            switch (mod) {
                case 'ctrl':
                    parts.push(<Key key="ctrl">Ctrl</Key>);
                    break;
                case 'shift':
                    parts.push(<Key key="shift">⇧</Key>);
                    break;
                case 'alt':
                    parts.push(<Key key="alt">Alt</Key>);
                    break;
                case 'meta':
                    parts.push(<Key key="meta">⌘</Key>);
                    break;
            }
        });
        
        // Add 'g' prefix for navigation shortcuts
        if (shortcut.category === 'Navigation') {
            parts.push(<Key key="g">g</Key>);
            parts.push(<span key="then" className="mx-1 text-slate-400">then</span>);
        }
        
        // Add main key
        let keyDisplay = shortcut.key;
        if (shortcut.key === 'Escape') keyDisplay = 'Esc';
        if (shortcut.key === '/') keyDisplay = '/';
        if (shortcut.key === '?') keyDisplay = '?';
        parts.push(<Key key="main">{keyDisplay}</Key>);
        
        return <div className="flex items-center gap-1">{parts}</div>;
    };
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2">
                                <Keyboard size={20} className="text-brand" />
                                <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                                    {t('myWork.shortcuts.title', 'Keyboard Shortcuts')}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                                <div key={category} className="mb-6 last:mb-0">
                                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                                        {category}
                                    </h3>
                                    <div className="space-y-2">
                                        {categoryShortcuts.map((shortcut, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-white/5 last:border-0"
                                            >
                                                <span className="text-sm text-navy-900 dark:text-white">
                                                    {shortcut.description}
                                                </span>
                                                {formatKey(shortcut)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Footer tip */}
                        <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                            <p className="text-xs text-slate-500 text-center">
                                {t('myWork.shortcuts.tip', 'Press ? to open this help at any time')}
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default KeyboardShortcutsModal;



