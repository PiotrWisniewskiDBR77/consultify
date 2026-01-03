/**
 * CommandPalette - Global quick actions for executives
 * Inspired by Linear/Notion Cmd+K pattern
 * 
 * Features:
 * - Global keyboard shortcut (Cmd/Ctrl + K)
 * - Quick navigation to any view
 * - Quick actions (create, approve, search)
 * - Recent items
 * - Fuzzy search
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Command,
    ArrowRight,
    LayoutDashboard,
    Target,
    Inbox,
    CheckSquare,
    FileQuestion,
    Users,
    Settings,
    Plus,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    History,
    Star,
    TrendingUp,
    Calendar,
    Bell,
    Filter,
    SortAsc
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

interface CommandItem {
    id: string;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    category: 'navigation' | 'action' | 'recent' | 'search';
    shortcut?: string;
    action: () => void | Promise<void>;
    keywords?: string[];
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate?: (path: string) => void;
}

// Fuzzy search function
const fuzzyMatch = (query: string, text: string): boolean => {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    if (textLower.includes(queryLower)) return true;
    
    // Fuzzy matching: all query chars must appear in order
    let queryIndex = 0;
    for (const char of textLower) {
        if (char === queryLower[queryIndex]) {
            queryIndex++;
            if (queryIndex === queryLower.length) return true;
        }
    }
    return false;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    onNavigate
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentItems, setRecentItems] = useState<CommandItem[]>([]);
    const [pendingDecisions, setPendingDecisions] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Navigation items
    const navigationItems: CommandItem[] = useMemo(() => [
        {
            id: 'nav-dashboard',
            title: t('command.nav.dashboard', 'Dashboard'),
            subtitle: t('command.nav.dashboardDesc', 'Executive overview'),
            icon: <LayoutDashboard size={18} />,
            category: 'navigation',
            shortcut: 'G D',
            keywords: ['home', 'overview', 'executive'],
            action: () => {
                onNavigate?.('dashboard');
                onClose();
            }
        },
        {
            id: 'nav-focus',
            title: t('command.nav.focus', 'Focus Board'),
            subtitle: t('command.nav.focusDesc', 'Daily focus tasks'),
            icon: <Target size={18} />,
            category: 'navigation',
            shortcut: 'G F',
            keywords: ['today', 'daily', 'tasks'],
            action: () => {
                onNavigate?.('focus');
                onClose();
            }
        },
        {
            id: 'nav-inbox',
            title: t('command.nav.inbox', 'Inbox'),
            subtitle: t('command.nav.inboxDesc', 'Triage new items'),
            icon: <Inbox size={18} />,
            category: 'navigation',
            shortcut: 'G I',
            keywords: ['triage', 'new', 'incoming'],
            action: () => {
                onNavigate?.('inbox');
                onClose();
            }
        },
        {
            id: 'nav-tasks',
            title: t('command.nav.tasks', 'All Tasks'),
            subtitle: t('command.nav.tasksDesc', 'View all tasks'),
            icon: <CheckSquare size={18} />,
            category: 'navigation',
            shortcut: 'G T',
            keywords: ['list', 'all', 'todo'],
            action: () => {
                onNavigate?.('tasks');
                onClose();
            }
        },
        {
            id: 'nav-decisions',
            title: t('command.nav.decisions', 'Decisions'),
            subtitle: t('command.nav.decisionsDesc', 'Pending decisions'),
            icon: <FileQuestion size={18} />,
            category: 'navigation',
            shortcut: 'G E',
            keywords: ['approve', 'reject', 'pending'],
            action: () => {
                onNavigate?.('decisions');
                onClose();
            }
        },
        {
            id: 'nav-team',
            title: t('command.nav.team', 'Team Performance'),
            subtitle: t('command.nav.teamDesc', 'Team analytics & capacity'),
            icon: <Users size={18} />,
            category: 'navigation',
            shortcut: 'G M',
            keywords: ['workload', 'capacity', 'members'],
            action: () => {
                onNavigate?.('team');
                onClose();
            }
        },
        {
            id: 'nav-settings',
            title: t('command.nav.settings', 'Settings'),
            subtitle: t('command.nav.settingsDesc', 'Preferences & notifications'),
            icon: <Settings size={18} />,
            category: 'navigation',
            shortcut: 'G S',
            keywords: ['preferences', 'config', 'notifications'],
            action: () => {
                onNavigate?.('settings');
                onClose();
            }
        }
    ], [t, onNavigate, onClose]);

    // Action items
    const actionItems: CommandItem[] = useMemo(() => [
        {
            id: 'action-create-task',
            title: t('command.action.createTask', 'Create Task'),
            subtitle: t('command.action.createTaskDesc', 'Add a new task'),
            icon: <Plus size={18} className="text-emerald-500" />,
            category: 'action',
            shortcut: 'C',
            keywords: ['new', 'add', 'todo'],
            action: () => {
                // Trigger task creation modal
                window.dispatchEvent(new CustomEvent('create-task'));
                onClose();
            }
        },
        {
            id: 'action-approve-all',
            title: t('command.action.approveAll', 'Quick Approve'),
            subtitle: t('command.action.approveAllDesc', 'Approve pending decision'),
            icon: <CheckCircle2 size={18} className="text-emerald-500" />,
            category: 'action',
            keywords: ['approve', 'accept', 'decision'],
            action: async () => {
                if (pendingDecisions.length > 0) {
                    try {
                        await Api.put(`/decisions/${pendingDecisions[0].id}/decide`, { 
                            status: 'APPROVED', 
                            outcome: '' 
                        });
                        toast.success(t('command.action.approved', 'Decision approved'));
                    } catch (error) {
                        toast.error(t('command.action.error', 'Failed to approve'));
                    }
                } else {
                    toast.info(t('command.action.noDecisions', 'No pending decisions'));
                }
                onClose();
            }
        },
        {
            id: 'action-mark-done',
            title: t('command.action.markDone', 'Mark Task Done'),
            subtitle: t('command.action.markDoneDesc', 'Complete current task'),
            icon: <CheckCircle2 size={18} className="text-cyan-500" />,
            category: 'action',
            shortcut: 'D',
            keywords: ['complete', 'finish', 'done'],
            action: () => {
                window.dispatchEvent(new CustomEvent('mark-task-done'));
                onClose();
            }
        },
        {
            id: 'action-filter-overdue',
            title: t('command.action.filterOverdue', 'Show Overdue'),
            subtitle: t('command.action.filterOverdueDesc', 'Filter overdue tasks'),
            icon: <Clock size={18} className="text-rose-500" />,
            category: 'action',
            keywords: ['overdue', 'late', 'urgent'],
            action: () => {
                onNavigate?.('tasks');
                window.dispatchEvent(new CustomEvent('filter-tasks', { detail: { filter: 'overdue' } }));
                onClose();
            }
        },
        {
            id: 'action-schedule',
            title: t('command.action.schedule', 'Open Calendar'),
            subtitle: t('command.action.scheduleDesc', 'View scheduled items'),
            icon: <Calendar size={18} className="text-violet-500" />,
            category: 'action',
            keywords: ['calendar', 'schedule', 'timeline'],
            action: () => {
                navigate('/projects');
                onClose();
            }
        }
    ], [t, pendingDecisions, onClose, onNavigate, navigate]);

    // Combined items
    const allItems = useMemo(() => {
        return [...navigationItems, ...actionItems, ...recentItems];
    }, [navigationItems, actionItems, recentItems]);

    // Filtered items based on query
    const filteredItems = useMemo(() => {
        if (!query.trim()) {
            // Show categories when no query
            return allItems.slice(0, 10);
        }
        
        return allItems.filter(item => {
            const searchText = `${item.title} ${item.subtitle || ''} ${item.keywords?.join(' ') || ''}`;
            return fuzzyMatch(query, searchText);
        });
    }, [allItems, query]);

    // Group items by category
    const groupedItems = useMemo(() => {
        const groups: { [key: string]: CommandItem[] } = {
            navigation: [],
            action: [],
            recent: [],
            search: []
        };
        
        filteredItems.forEach(item => {
            groups[item.category].push(item);
        });
        
        return groups;
    }, [filteredItems]);

    // Fetch pending decisions for quick actions
    useEffect(() => {
        if (isOpen) {
            Api.get('/decisions?status=PENDING&limit=5')
                .then(res => {
                    if (Array.isArray(res)) {
                        setPendingDecisions(res);
                    }
                })
                .catch(() => {});
        }
    }, [isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    filteredItems[selectedIndex].action();
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [filteredItems, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
        selectedElement?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const renderGroup = (title: string, items: CommandItem[], categoryKey: string) => {
        if (items.length === 0) return null;
        
        return (
            <div key={categoryKey} className="mb-2">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {title}
                </div>
                {items.map((item, idx) => {
                    const globalIndex = filteredItems.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    
                    return (
                        <motion.button
                            key={item.id}
                            data-index={globalIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            onClick={() => item.action()}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                transition-colors cursor-pointer text-left
                                ${isSelected 
                                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100' 
                                    : 'hover:bg-slate-100 dark:hover:bg-white/5 text-navy-900 dark:text-white'
                                }
                            `}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected 
                                    ? 'bg-violet-200 dark:bg-violet-800/50 text-violet-700 dark:text-violet-300' 
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                            }`}>
                                {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                {item.subtitle && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {item.subtitle}
                                    </p>
                                )}
                            </div>
                            {item.shortcut && (
                                <kbd className={`
                                    hidden sm:flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-mono font-medium
                                    ${isSelected 
                                        ? 'bg-violet-200/50 dark:bg-violet-700/50 text-violet-700 dark:text-violet-300' 
                                        : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                    }
                                `}>
                                    {item.shortcut}
                                </kbd>
                            )}
                            <ArrowRight size={14} className={`shrink-0 ${
                                isSelected ? 'text-violet-500' : 'text-slate-300 dark:text-slate-600'
                            }`} />
                        </motion.button>
                    );
                })}
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    
                    {/* Palette */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.15 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
                    >
                        <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                            {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
                                <Search size={20} className="text-slate-400 shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={t('command.placeholder', 'Search commands, actions, navigation...')}
                                    className="flex-1 bg-transparent text-navy-900 dark:text-white placeholder-slate-400 outline-none text-sm"
                                />
                                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-[10px] font-mono text-slate-500">
                                    <Command size={10} />
                                    K
                                </kbd>
                            </div>

                            {/* Results */}
                            <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
                                {filteredItems.length > 0 ? (
                                    <>
                                        {renderGroup(t('command.category.navigation', 'Navigate'), groupedItems.navigation, 'navigation')}
                                        {renderGroup(t('command.category.actions', 'Actions'), groupedItems.action, 'action')}
                                        {renderGroup(t('command.category.recent', 'Recent'), groupedItems.recent, 'recent')}
                                    </>
                                ) : (
                                    <div className="py-8 text-center">
                                        <Search size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {t('command.noResults', 'No results found')}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                            {t('command.tryDifferent', 'Try a different search term')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">↑↓</kbd>
                                        {t('command.hint.navigate', 'Navigate')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">↵</kbd>
                                        {t('command.hint.select', 'Select')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 rounded">esc</kbd>
                                        {t('command.hint.close', 'Close')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Zap size={10} />
                                    {t('command.hint.powered', 'Quick Actions')}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Hook to use command palette globally
export const useCommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev)
    };
};

export default CommandPalette;








