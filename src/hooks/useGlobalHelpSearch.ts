import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getPopularSearches,
  getSearchSuggestions,
  searchHelp,
  SearchResult,
  SearchResultType,
} from '../services/helpSearchService';

interface UseGlobalHelpSearchOptions {
  language?: 'en' | 'pl';
  onSelect?: (result: SearchResult) => void;
}

export const useGlobalHelpSearch = ({ language = 'en', onSelect }: UseGlobalHelpSearchOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<SearchResultType | 'all'>('all');

  const popularSearches = useMemo(() => getPopularSearches(language), [language]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
      if (!isOpen) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(results.length - 1, 0)));
      }
      if (event.key === 'Enter' && results.length > 0) {
        event.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          onSelect?.(selected);
          setRecentSearches((prev) => {
            const next = [selected.title, ...prev.filter((term) => term !== selected.title)];
            return next.slice(0, 6);
          });
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onSelect]);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const timeout = setTimeout(() => {
      const types = activeFilter === 'all' ? undefined : [activeFilter];
      const nextResults = query.trim() ? searchHelp(query, { language, types }) : [];
      setResults(nextResults);
      setSuggestions(getSearchSuggestions(query, language));
      setSelectedIndex(0);
      setIsLoading(false);
    }, 150);

    return () => clearTimeout(timeout);
  }, [activeFilter, isOpen, language, query]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
  }, []);

  const clearQuery = useCallback(() => {
    setQueryState('');
    setResults([]);
    setSuggestions([]);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setResults([]);
    setSuggestions([]);
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
  }, []);

  const selectResult = useCallback(
    (result: SearchResult) => {
      onSelect?.(result);
      setRecentSearches((prev) => {
        const next = [result.title, ...prev.filter((term) => term !== result.title)];
        return next.slice(0, 6);
      });
      setIsOpen(false);
    },
    [onSelect]
  );

  const setFilter = useCallback((filter: SearchResultType | 'all') => {
    setActiveFilter(filter);
  }, []);

  return {
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
  };
};

export default useGlobalHelpSearch;
