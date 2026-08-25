/**
 * CommandPalette Component - Apple HIG Design System
 *
 * A keyboard-driven navigation component inspired by Spotlight and VS Code.
 * Activated with Cmd+K (Mac) / Ctrl+K (Windows).
 *
 * @example
 * <CommandPaletteProvider>
 *   <App />
 * </CommandPaletteProvider>
 *
 * // Anywhere in the app:
 * const { open } = useCommandPalette();
 * open(); // Opens the palette programmatically
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Command,
  CreditCard,
  FileText,
  GitBranch,
  Layout,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquare,
  Palette,
  Rocket,
  Search,
  Settings,
  Shield,
  StickyNote,
  Users,
  Zap,
} from 'lucide-react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { AppView } from '../../../types';
import { isStudioEnabled } from '../../../utils/studioFlag';

// ============================================
// TYPES
// ============================================

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  category: 'navigation' | 'action' | 'settings' | 'recent' | 'search';
  keywords?: string[];
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommands: (commands: CommandItem[]) => void;
  unregisterCommands: (ids: string[]) => void;
}

// ============================================
// GLOBAL SEARCH (HARVARD H6.12)
// ============================================

/** Entity types returned by GET /api/search. Mirrors backend globalSearchService. */
type SearchEntityType =
  | 'initiative'
  | 'task'
  | 'decision'
  | 'idea'
  | 'note'
  | 'artifact'
  | 'assessment';

interface SearchHit {
  type: SearchEntityType;
  id: string;
  title: string;
  updatedAt: string | null;
}

interface SearchResponse {
  query: string;
  total: number;
  groups: Partial<Record<SearchEntityType, SearchHit[]>>;
}

/**
 * Per-entity presentation + destination. v1 navigates to the entity's module
 * view (list); deep per-id linking is left to the modules that already own it.
 */
const SEARCH_ENTITY_META: Record<
  SearchEntityType,
  { view: AppView; icon: React.ReactNode; labelKey: string; labelDefault: string }
> = {
  initiative: {
    view: AppView.PORTFOLIO_ROADMAP,
    icon: <Lightbulb size={18} />,
    labelKey: 'commandPalette.entity.initiative',
    labelDefault: 'Initiative',
  },
  task: {
    view: AppView.MY_WORK,
    icon: <ListChecks size={18} />,
    labelKey: 'commandPalette.entity.task',
    labelDefault: 'Task',
  },
  decision: {
    view: AppView.MY_WORK,
    icon: <CheckCircle size={18} />,
    labelKey: 'commandPalette.entity.decision',
    labelDefault: 'Decision',
  },
  idea: {
    view: AppView.MY_WORK,
    icon: <GitBranch size={18} />,
    labelKey: 'commandPalette.entity.idea',
    labelDefault: 'Idea',
  },
  note: {
    view: AppView.MY_WORK,
    icon: <StickyNote size={18} />,
    labelKey: 'commandPalette.entity.note',
    labelDefault: 'Note',
  },
  artifact: {
    view: AppView.PRESENTATIONS,
    icon: <FileText size={18} />,
    labelKey: 'commandPalette.entity.artifact',
    labelDefault: 'Output',
  },
  assessment: {
    view: AppView.ASSESSMENT_DRD,
    icon: <ClipboardCheck size={18} />,
    labelKey: 'commandPalette.entity.assessment',
    labelDefault: 'Assessment',
  },
};

/** Order in which entity groups are rendered. */
const SEARCH_ENTITY_ORDER: SearchEntityType[] = [
  'initiative',
  'task',
  'decision',
  'idea',
  'note',
  'artifact',
  'assessment',
];

// ============================================
// CONTEXT
// ============================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export const useCommandPalette = () => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  }
  return context;
};

// ============================================
// DEFAULT COMMANDS
// ============================================

const getDefaultCommands = (onNavigate: (view: AppView) => void): CommandItem[] => {
  const allCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-ai-chat',
      label: 'AI Chat',
      description: 'Open AI conversation',
      icon: <MessageSquare size={18} />,
      category: 'navigation',
      keywords: ['chat', 'ai', 'assistant', 'conversation'],
      onSelect: () => onNavigate(AppView.AI_CHAT),
    },
    {
      id: 'nav-my-work',
      label: 'My Work',
      description: 'Tasks, inbox, and focus mode',
      icon: <Briefcase size={18} />,
      category: 'navigation',
      keywords: ['work', 'tasks', 'inbox', 'todo'],
      onSelect: () => onNavigate(AppView.MY_WORK),
    },
    {
      // DEC-2026-08-24-01: /project-intelligence is now a legacy alias that
      // redirects to /interview (AppRoutes.tsx); this entry keeps the old
      // search terms working as an alias into the canonical Interview view
      // instead of navigating to a route that immediately bounces away.
      id: 'nav-project-intelligence',
      label: 'Interview',
      description: 'AI-powered project insights (formerly Project Intelligence)',
      icon: <Brain size={18} />,
      category: 'navigation',
      keywords: ['project', 'intelligence', 'insights', 'ai', 'interview'],
      onSelect: () => onNavigate(AppView.INTERVIEW),
    },
    {
      id: 'nav-assessment',
      label: 'Assessment',
      description: 'Digital readiness assessments',
      icon: <CheckCircle size={18} />,
      category: 'navigation',
      keywords: ['assessment', 'drd', 'maturity', 'audit'],
      onSelect: () => onNavigate(AppView.ASSESSMENT_DRD),
    },
    {
      id: 'nav-initiatives',
      label: 'Initiatives',
      description: 'Portfolio and roadmap',
      icon: <Lightbulb size={18} />,
      category: 'navigation',
      keywords: ['initiatives', 'portfolio', 'roadmap', 'projects'],
      onSelect: () => onNavigate(AppView.PORTFOLIO_ROADMAP),
    },
    {
      id: 'nav-implementation',
      label: 'Implementation',
      description: 'Project execution tracking',
      icon: <Rocket size={18} />,
      category: 'navigation',
      keywords: ['implementation', 'execution', 'deploy'],
      onSelect: () => onNavigate(AppView.IMPLEMENTATION),
    },
    {
      id: 'nav-reports',
      label: 'Reports',
      description: 'Reports & presentations hub',
      icon: <BarChart3 size={18} />,
      category: 'navigation',
      keywords: ['reports', 'analytics', 'dashboard', 'metrics'],
      onSelect: () => {
        // The Reports library surface is hosted under /presentations?tab=documents.
        // We keep AppView navigation as a fallback for SSR.
        if (typeof window !== 'undefined') {
          window.location.assign('/presentations?tab=documents');
          return;
        }
        onNavigate(AppView.PRESENTATIONS);
      },
    },
    {
      id: 'nav-prezentacje',
      label: 'Prezentacje',
      description: 'AI presentation generator (Gamma-style)',
      icon: <Layout size={18} />,
      category: 'navigation',
      keywords: ['prezentacje', 'presentation', 'deck', 'slides', 'pptx', 'gamma'],
      onSelect: () => onNavigate(AppView.PREZENTACJE_GEN),
    },
    {
      id: 'nav-outputs',
      label: 'Outputs Library',
      description: 'Presentations, documents, and spreadsheets',
      icon: <FileText size={18} />,
      category: 'navigation',
      keywords: ['outputs', 'library', 'presentations', 'documents', 'exports'],
      onSelect: () => onNavigate(AppView.PRESENTATIONS),
    },
    {
      id: 'nav-studio',
      label: 'Studio',
      description: 'Visual AI workspace',
      icon: <Palette size={18} />,
      category: 'navigation',
      keywords: ['studio', 'visual', 'design', 'workspace'],
      onSelect: () => onNavigate(AppView.STUDIO),
    },
    {
      id: 'nav-finance',
      label: 'Finance',
      description: 'Financial statements, models, analysis & valuations',
      icon: <Calculator size={18} />,
      category: 'navigation',
      keywords: [
        'finance',
        'finanse',
        'economics',
        'ekonomia',
        'statements',
        'model',
        'valuation',
        'wycena',
        'budget',
        'prediction',
        'analysis',
        'lane',
      ],
      onSelect: () => onNavigate(AppView.ECONOMICS),
    },
    // Settings
    {
      id: 'settings-profile',
      label: 'Profile Settings',
      description: 'Manage your profile',
      icon: <Users size={18} />,
      category: 'settings',
      keywords: ['profile', 'account', 'user'],
      onSelect: () => onNavigate(AppView.SETTINGS_PROFILE),
    },
    {
      id: 'settings-ai',
      label: 'AI Preferences',
      description: 'Configure AI behavior',
      icon: <Brain size={18} />,
      category: 'settings',
      keywords: ['ai', 'preferences', 'model', 'assistant'],
      onSelect: () => onNavigate(AppView.SETTINGS_AI),
    },
    {
      id: 'settings-notifications',
      label: 'Notifications',
      description: 'Notification preferences',
      icon: <Bell size={18} />,
      category: 'settings',
      keywords: ['notifications', 'alerts', 'email'],
      onSelect: () => onNavigate(AppView.SETTINGS_NOTIFICATIONS),
    },
    {
      id: 'settings-billing',
      label: 'Billing',
      description: 'Subscription and payments',
      icon: <CreditCard size={18} />,
      category: 'settings',
      keywords: ['billing', 'payment', 'subscription', 'invoice'],
      onSelect: () => onNavigate(AppView.SETTINGS_BILLING),
    },
    {
      id: 'settings-security',
      label: 'Security',
      description: 'Security settings',
      icon: <Shield size={18} />,
      category: 'settings',
      keywords: ['security', 'password', 'mfa', '2fa'],
      onSelect: () => onNavigate(AppView.SETTINGS_MFA),
    },
  ];

  // Studio's AI chat backend (/api/studio/ai/*) was never implemented
  // server-side (studioFlag.ts, default OFF) — hide the palette entry so
  // users don't land on the broken chat via search.
  return isStudioEnabled() ? allCommands : allCommands.filter((cmd) => cmd.id !== 'nav-studio');
};

// ============================================
// ANIMATIONS
// ============================================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;

const paletteVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.15 },
  },
} as const;

// ============================================
// COMMAND PALETTE DIALOG
// ============================================

interface CommandPaletteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  recentCommands: string[];
  onCommandSelect: (command: CommandItem) => void;
  onNavigate: (view: AppView) => void;
}

const SEARCH_DEBOUNCE_MS = 220;
const MIN_SEARCH_LEN = 2;

const CommandPaletteDialog: React.FC<CommandPaletteDialogProps> = ({
  isOpen,
  onClose,
  commands,
  recentCommands,
  onCommandSelect,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced global (cross-module) entity search against GET /api/search.
  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LEN) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await Api.get(`/search?q=${encodeURIComponent(term)}`);
        const data = (res?.data ?? res) as SearchResponse;
        if (cancelled) return;
        const hits: SearchHit[] = [];
        for (const type of SEARCH_ENTITY_ORDER) {
          for (const hit of data?.groups?.[type] ?? []) hits.push({ ...hit, type });
        }
        setSearchHits(hits);
      } catch {
        if (!cancelled) setSearchHits([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Turn raw search hits into selectable command items (grouped after commands).
  const searchItems = useMemo<CommandItem[]>(() => {
    return searchHits.map((hit) => {
      const meta = SEARCH_ENTITY_META[hit.type];
      return {
        id: `search-${hit.type}-${hit.id}`,
        label: hit.title,
        description: t(meta.labelKey, meta.labelDefault),
        icon: meta.icon,
        category: 'search',
        onSelect: () => onNavigate(meta.view),
      };
    });
  }, [searchHits, onNavigate, t]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then others
      const recent = commands.filter((c) => recentCommands.includes(c.id));
      const others = commands.filter((c) => !recentCommands.includes(c.id));
      return [...recent.map((c) => ({ ...c, category: 'recent' as const })), ...others];
    }

    const lowerQuery = query.toLowerCase();
    const matchedCommands = commands.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchDesc = cmd.description?.toLowerCase().includes(lowerQuery);
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
      return matchLabel || matchDesc || matchKeywords;
    });
    // Live entity search results render first, then static commands.
    return [...searchItems, ...matchedCommands];
  }, [commands, query, recentCommands, searchItems]);

  // Group commands by category (search first).
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      search: [],
      recent: [],
      navigation: [],
      action: [],
      settings: [],
    };

    filteredCommands.forEach((cmd) => {
      groups[cmd.category]?.push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onCommandSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onCommandSelect, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    search: t('commandPalette.category.search', 'Search results'),
    recent: t('commandPalette.category.recent', 'Recent'),
    navigation: t('commandPalette.category.navigation', 'Navigation'),
    action: t('commandPalette.category.action', 'Actions'),
    settings: t('commandPalette.category.settings', 'Settings'),
  };

  const categoryIcons: Record<string, React.ReactNode> = {
    search: <Search size={14} />,
    recent: <Clock size={14} />,
    navigation: <Layout size={14} />,
    action: <Zap size={14} />,
    settings: <Settings size={14} />,
  };

  if (typeof window === 'undefined') return null;

  let flatIndex = -1;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-modal flex items-start justify-center pt-[15vh]"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={overlayVariants}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            variants={overlayVariants}
          />

          {/* Palette */}
          <motion.div
            className="relative w-full max-w-xl mx-4 bg-white dark:bg-navy-900 rounded-xl shadow-2xl overflow-hidden"
            variants={paletteVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 dark:border-navy-700">
              <Search size={20} className="text-slate-600 dark:text-slate-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t(
                  'commandPalette.placeholder',
                  'Search commands, initiatives, tasks, notes…'
                )}
                className="flex-1 bg-transparent text-navy-900 dark:text-white placeholder-slate-400 outline-none text-base"
              />
              {searchLoading && (
                <Loader2
                  size={16}
                  className="animate-spin text-slate-400 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-white/5 rounded-lg">
                <Command size={12} />K
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-600 dark:text-slate-500">
                  {searchLoading
                    ? t('commandPalette.searching', 'Searching…')
                    : t('commandPalette.noResults', 'No results found for "{{query}}"', { query })}
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => {
                  if (items.length === 0) return null;

                  return (
                    <div key={category} className="mb-2">
                      {/* Category Header */}
                      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
                        {categoryIcons[category]}
                        {categoryLabels[category]}
                      </div>

                      {/* Category Items */}
                      {items.map((cmd) => {
                        flatIndex++;
                        const isSelected = flatIndex === selectedIndex;

                        return (
                          <button
                            key={cmd.id}
                            data-index={flatIndex}
                            onClick={() => onCommandSelect(cmd)}
                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                            className={`
                              w-full flex items-center gap-3 px-4 py-2.5
                              text-left transition-colors duration-75
                              ${
                                isSelected
                                  ? 'bg-slate-100 dark:bg-white/[0.07] text-slate-900 dark:text-white'
                                  : 'text-navy-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                              }
                            `}
                          >
                            <span
                              className={`flex-shrink-0 ${isSelected ? '' : 'text-slate-600 dark:text-slate-500'}`}
                            >
                              {cmd.icon || <FileText size={18} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{cmd.label}</div>
                              {cmd.description && (
                                <div className="text-sm text-slate-600 dark:text-slate-500 truncate">
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {cmd.shortcut && (
                              <kbd className="flex-shrink-0 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-white/5 rounded">
                                {cmd.shortcut}
                              </kbd>
                            )}
                            <ArrowRight
                              size={14}
                              className={`flex-shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-navy-700 text-xs text-slate-600 dark:text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded">Esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ============================================
// PROVIDER
// ============================================

export interface CommandPaletteProviderProps {
  children: React.ReactNode;
  onNavigate: (view: AppView) => void;
}

export const CommandPaletteProvider: React.FC<CommandPaletteProviderProps> = ({
  children,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customCommands, setCustomCommands] = useState<CommandItem[]>([]);
  const [recentCommands, setRecentCommands] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('commandPalette_recent');
    return stored ? JSON.parse(stored) : [];
  });

  // Combine default and custom commands
  const allCommands = useMemo(() => {
    const defaults = getDefaultCommands(onNavigate);
    return [...defaults, ...customCommands];
  }, [onNavigate, customCommands]);

  // Global keyboard shortcut (Cmd/Ctrl+K).
  // Yields to a local, more-specific palette (e.g. the Idea Map palette) when
  // one is mounted, so the two never open at once on the same view.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (
          typeof document !== 'undefined' &&
          document.querySelector('[data-local-command-palette]')
        ) {
          return; // a scoped palette owns Cmd+K here
        }
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerCommands = useCallback((commands: CommandItem[]) => {
    setCustomCommands((prev) => [...prev, ...commands]);
  }, []);

  const unregisterCommands = useCallback((ids: string[]) => {
    setCustomCommands((prev) => prev.filter((c) => !ids.includes(c.id)));
  }, []);

  const handleCommandSelect = useCallback(
    (command: CommandItem) => {
      // Add to recent commands
      setRecentCommands((prev) => {
        const updated = [command.id, ...prev.filter((id) => id !== command.id)].slice(0, 5);
        localStorage.setItem('commandPalette_recent', JSON.stringify(updated));
        return updated;
      });

      // Execute command
      command.onSelect();
      close();
    },
    [close]
  );

  const value: CommandPaletteContextValue = {
    isOpen,
    open,
    close,
    toggle,
    registerCommands,
    unregisterCommands,
  };

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteDialog
        isOpen={isOpen}
        onClose={close}
        commands={allCommands}
        recentCommands={recentCommands}
        onCommandSelect={handleCommandSelect}
        onNavigate={(view) => {
          onNavigate(view);
          close();
        }}
      />
    </CommandPaletteContext.Provider>
  );
};

export default CommandPaletteProvider;
