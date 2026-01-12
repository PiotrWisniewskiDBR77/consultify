/**
 * Global Help Search Component
 *
 * Cmd+K / Ctrl+K activated modal for searching all help content.
 * Enterprise-grade search with real-time results, keyboard navigation,
 * and category filtering.
 */

import DOMPurify from 'dompurify';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    Clock,
    Command,
    FileText,
    Hash,
    HelpCircle,
    Layout,
    Loader2,
    Search,
    TrendingUp,
    Video,
    X,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { HelpModuleId, MODULE_HELP_CONTENT } from '../../config/moduleHelpContent';
import { useGlobalHelpSearch } from '../../hooks/useGlobalHelpSearch';
import { SearchResult, SearchResultType } from '../../services/helpSearchService';
import { highlightQuery } from '../../services/helpSearchService';
import DynamicIcon from '../shared/DynamicIcon';

interface GlobalHelpSearchProps {
    onNavigate?: (view: string, params?: Record<string, string>) => void;
}

// Type icons
const TYPE_ICONS: Record<SearchResultType, React.ComponentType<{ size?: number; className?: string }>> = {
    module: Layout,
    card: FileText,
    faq: HelpCircle,
    video: Video,
};

export const GlobalHelpSearch: React.FC<GlobalHelpSearchProps> = ({ onNavigate }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'pl' ? 'pl' : 'en';

    // Derived values from translations
    const typeLabels: Record<SearchResultType, string> = {
        module: t('help.search.types.module'),
        card: t('help.search.types.card'),
        faq: t('help.search.types.faq'),
        video: t('help.search.types.video'),
    };

    const filterTabs: { id: SearchResultType | 'all'; label: string }[] = [
        { id: 'all', label: t('help.search.filters.all') },
        { id: 'module', label: t('help.search.filters.module') },
        { id: 'card', label: t('help.search.filters.card') },
        { id: 'faq', label: t('help.search.filters.faq') },
        { id: 'video', label: t('help.search.filters.video') },
    ];

    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const {
        isOpen,
        query,
        results,
        isLoading,
        selectedIndex,
        recentSearches,
        popularSearches,
        suggestions,
        activeFilter,
        close,
        setQuery,
        clearQuery,
        selectResult,
        clearRecent,
        setFilter,
    } = useGlobalHelpSearch({
        language: lang,
        onSelect: (result) => {
            // Navigate based on result type
            if (result.url) {
                window.open(result.url, '_blank');
            } else if (onNavigate) {
                // Navigate to appropriate view based on module
                const module = MODULE_HELP_CONTENT[result.moduleId as HelpModuleId];
                if (module) {
                    // This would navigate to the module view
                    console.log('Navigate to:', result.moduleId, result.id);
                }
            }
        },
    });

    // Focus input when open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Scroll selected result into view
    useEffect(() => {
        if (results.length > 0 && resultsRef.current) {
            const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex, results.length]);

    // Handle result click
    const handleResultClick = (result: SearchResult) => {
        selectResult(result);
    };

    // Handle recent/popular click
    const handleQuickSearch = (term: string) => {
        setQuery(term);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]"
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={close}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                        <Search size={20} className="text-slate-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t('help.search.placeholder')}
                            className="flex-1 bg-transparent text-lg text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {query && (
                            <button
                                onClick={clearQuery}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={18} />
                            </button>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-500">
                            <Command size={12} />
                            <span>K</span>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                    activeFilter === tab.id
                                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
                        {/* Loading State */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="animate-spin text-purple-500" />
                            </div>
                        )}

                        {/* Results */}
                        {!isLoading && results.length > 0 && (
                            <div className="py-2">
                                {results.map((result, index) => {
                                    const TypeIcon = TYPE_ICONS[result.type];
                                    const isSelected = index === selectedIndex;

                                    return (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            data-index={index}
                                            onClick={() => handleResultClick(result)}
                                            className={`w-full flex items-start gap-3 px-5 py-3 text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-purple-50 dark:bg-purple-900/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                            }`}
                                        >
                                            {/* Icon */}
                                            <div
                                                className={`p-2 rounded-lg flex-shrink-0 ${
                                                    isSelected
                                                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                }`}
                                            >
                                                {result.icon ? (
                                                    <DynamicIcon name={result.icon} size={18} />
                                                ) : (
                                                    <TypeIcon size={18} />
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="font-medium text-slate-900 dark:text-white truncate"
                                                        dangerouslySetInnerHTML={{
                                                            __html: DOMPurify.sanitize(
                                                                highlightQuery(result.title, query),
                                                                { ALLOWED_TAGS: ['mark'] },
                                                            ),
                                                        }}
                                                    />
                                                    <span className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                                                        {typeLabels[result.type]}
                                                    </span>
                                                </div>
                                                <p
                                                    className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5"
                                                    dangerouslySetInnerHTML={{
                                                        __html: DOMPurify.sanitize(
                                                            highlightQuery(result.excerpt, query),
                                                            { ALLOWED_TAGS: ['mark'] },
                                                        ),
                                                    }}
                                                />
                                            </div>

                                            {/* Arrow */}
                                            {isSelected && (
                                                <ArrowRight size={16} className="text-purple-500 flex-shrink-0 mt-1" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* No Results */}
                        {!isLoading && query.length >= 2 && results.length === 0 && (
                            <div className="py-12 text-center">
                                <Search size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    {t('help.search.noResults')} <strong>"{query}"</strong>
                                </p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                    {t('help.search.tryDifferentKeywords')}
                                </p>
                            </div>
                        )}

                        {/* Empty State - Show Recent & Popular */}
                        {!isLoading && query.length < 2 && (
                            <div className="py-4">
                                {/* Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            {t('help.search.suggestions')}
                                        </h4>
                                        {suggestions.map((suggestion, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickSearch(suggestion)}
                                                className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            >
                                                <Hash size={14} className="text-slate-400" />
                                                <span className="text-slate-700 dark:text-slate-300">{suggestion}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Recent Searches */}
                                {recentSearches.length > 0 && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between px-5 py-2">
                                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                {t('help.search.recentSearches')}
                                            </h4>
                                            <button
                                                onClick={clearRecent}
                                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                {t('help.search.clear')}
                                            </button>
                                        </div>
                                        {recentSearches.slice(0, 5).map((term, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickSearch(term)}
                                                className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            >
                                                <Clock size={14} className="text-slate-400" />
                                                <span className="text-slate-700 dark:text-slate-300">{term}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Popular Searches */}
                                <div>
                                    <h4 className="px-5 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        {t('help.search.popular')}
                                    </h4>
                                    {popularSearches.slice(0, 5).map((term, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleQuickSearch(term)}
                                            className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        >
                                            <TrendingUp size={14} className="text-slate-400" />
                                            <span className="text-slate-700 dark:text-slate-300">{term}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑↓</kbd>
                                {t('help.search.footer.navigate')}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↵</kbd>
                                {t('help.search.footer.select')}
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">esc</kbd>
                                {t('help.search.footer.close')}
                            </span>
                        </div>
                        <span className="text-slate-400">
                            {results.length > 0 && (
                                <>
                                    {results.length} {t('help.search.footer.results')}
                                </>
                            )}
                        </span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default GlobalHelpSearch;

