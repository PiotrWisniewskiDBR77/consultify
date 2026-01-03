/**
 * Global Help Search Hook
 * 
 * Provides Cmd+K / Ctrl+K keyboard shortcut and search state management
 * for the global help search modal.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    searchHelp, 
    SearchResult, 
    SearchResultType,
    getRecentSearches,
    saveRecentSearch,
    clearRecentSearches,
    getPopularSearches,
    getSearchSuggestions
} from '../services/helpSearchService';
import { HelpModuleId } from '../config/viewToModuleMapping';

export interface UseGlobalHelpSearchResult {
    // State
    isOpen: boolean;
    query: string;
    results: SearchResult[];
    isLoading: boolean;
    selectedIndex: number;
    recentSearches: string[];
    popularSearches: string[];
    suggestions: string[];
    activeFilter: SearchResultType | 'all';
    
    // Actions
    open: () => void;
    close: () => void;
    toggle: () => void;
    setQuery: (query: string) => void;
    search: (query: string) => void;
    clearQuery: () => void;
    selectResult: (result: SearchResult) => void;
    navigateUp: () => void;
    navigateDown: () => void;
    selectCurrent: () => void;
    clearRecent: () => void;
    setFilter: (filter: SearchResultType | 'all') => void;
}

interface UseGlobalHelpSearchOptions {
    language?: 'en' | 'pl';
    moduleId?: HelpModuleId;
    onSelect?: (result: SearchResult) => void;
    debounceMs?: number;
}

export function useGlobalHelpSearch(
    options: UseGlobalHelpSearchOptions = {}
): UseGlobalHelpSearchResult {
    const {
        language = 'en',
        moduleId,
        onSelect,
        debounceMs = 150
    } = options;
    
    // State
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<SearchResultType | 'all'>('all');
    
    // Refs
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    
    // Get popular searches (static)
    const popularSearches = getPopularSearches(language);
    
    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches());
    }, []);
    
    // Perform search with debounce
    const performSearch = useCallback((searchQuery: string) => {
        if (searchQuery.trim().length < 2) {
            setResults([]);
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        
        const types = activeFilter === 'all' 
            ? undefined 
            : [activeFilter];
        
        const searchResults = searchHelp(searchQuery, {
            limit: 15,
            types,
            moduleId,
            language
        });
        
        setResults(searchResults);
        setSelectedIndex(0);
        setIsLoading(false);
        
        // Get suggestions
        const newSuggestions = getSearchSuggestions(searchQuery, language, 5);
        setSuggestions(newSuggestions);
    }, [activeFilter, moduleId, language]);
    
    // Debounced search
    const search = useCallback((searchQuery: string) => {
        setQuery(searchQuery);
        
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        
        if (searchQuery.trim().length < 2) {
            setResults([]);
            setSuggestions([]);
            return;
        }
        
        setIsLoading(true);
        
        debounceRef.current = setTimeout(() => {
            performSearch(searchQuery);
        }, debounceMs);
    }, [performSearch, debounceMs]);
    
    // Re-search when filter changes
    useEffect(() => {
        if (query.trim().length >= 2) {
            performSearch(query);
        }
    }, [activeFilter, performSearch, query]);
    
    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K / Ctrl+K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                return;
            }
            
            // Only handle other keys when open
            if (!isOpen) return;
            
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    setIsOpen(false);
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => 
                        Math.min(prev + 1, results.length - 1)
                    );
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (results[selectedIndex]) {
                        selectResult(results[selectedIndex]);
                    }
                    break;
                    
                case 'Tab':
                    // Use suggestion
                    if (suggestions.length > 0) {
                        e.preventDefault();
                        setQuery(suggestions[0]);
                        performSearch(suggestions[0]);
                    }
                    break;
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex, suggestions, performSearch]);
    
    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure modal is rendered
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        } else {
            // Clear state when closing
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setSuggestions([]);
        }
    }, [isOpen]);
    
    // Actions
    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    
    const clearQuery = useCallback(() => {
        setQuery('');
        setResults([]);
        setSuggestions([]);
    }, []);
    
    const selectResult = useCallback((result: SearchResult) => {
        // Save to recent searches
        const displayTitle = language === 'pl' && result.titlePl ? result.titlePl : result.title;
        saveRecentSearch(displayTitle);
        setRecentSearches(getRecentSearches());
        
        // Call callback
        onSelect?.(result);
        
        // Close modal
        setIsOpen(false);
    }, [language, onSelect]);
    
    const navigateUp = useCallback(() => {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
    }, []);
    
    const navigateDown = useCallback(() => {
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    }, [results.length]);
    
    const selectCurrent = useCallback(() => {
        if (results[selectedIndex]) {
            selectResult(results[selectedIndex]);
        }
    }, [results, selectedIndex, selectResult]);
    
    const clearRecent = useCallback(() => {
        clearRecentSearches();
        setRecentSearches([]);
    }, []);
    
    const setFilter = useCallback((filter: SearchResultType | 'all') => {
        setActiveFilter(filter);
    }, []);
    
    return {
        // State
        isOpen,
        query,
        results,
        isLoading,
        selectedIndex,
        recentSearches,
        popularSearches,
        suggestions,
        activeFilter,
        
        // Actions
        open,
        close,
        toggle,
        setQuery: search,
        search,
        clearQuery,
        selectResult,
        navigateUp,
        navigateDown,
        selectCurrent,
        clearRecent,
        setFilter
    };
}

export default useGlobalHelpSearch;






