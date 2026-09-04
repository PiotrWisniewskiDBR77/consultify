import {
  Clock,
  FileText,
  Filter,
  FolderOpen,
  Hash,
  Mail,
  Play,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ContentSearchProps {
  onSearch: (query: string, filters?: SearchFilters) => void;
  placeholder?: string;
  contentTypes?: ('PLAYBOOK' | 'EMAIL')[];
  showFilters?: boolean;
  showSuggestions?: boolean;
  initialQuery?: string;
  debounceMs?: number;
}

interface SearchFilters {
  contentType?: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  status?: string[];
  categoryIds?: string[];
  tagIds?: string[];
  dateRange?: {
    from?: string;
    to?: string;
  };
  sortBy?: 'relevance' | 'date' | 'popularity' | 'name';
  sortOrder?: 'asc' | 'desc';
}

interface RecentSearch {
  query: string;
  timestamp: number;
  contentType?: string;
}

const RECENT_SEARCHES_KEY = 'content_recent_searches';
const MAX_RECENT_SEARCHES = 5;

export const ContentSearch: React.FC<ContentSearchProps> = ({
  onSearch,
  placeholder = 'Search content...',
  contentTypes = ['PLAYBOOK', 'EMAIL'],
  showFilters = true,
  showSuggestions = true,
  initialQuery = '',
  debounceMs = 300,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    contentType: 'ALL',
    status: [],
    categoryIds: [],
    tagIds: [],
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load recent searches:', err);
    }
  }, []);

  // Save to recent searches
  const saveRecentSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) return;

      const newSearch: RecentSearch = {
        query: searchQuery,
        timestamp: Date.now(),
        contentType: filters.contentType,
      };

      setRecentSearches((prev) => {
        const filtered = prev.filter((s) => s.query !== searchQuery);
        const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [filters.contentType]
  );

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch(value, filters);
      }, debounceMs);
    },
    [onSearch, filters, debounceMs]
  );

  // Immediate search (for pressing Enter)
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      onSearch(query, filters);
      saveRecentSearch(query);
      setIsFocused(false);
    },
    [query, filters, onSearch, saveRecentSearch]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (key: keyof SearchFilters, value: unknown) => {
      setFilters((prev) => {
        const updated = { ...prev, [key]: value };
        onSearch(query, updated);
        return updated;
      });
    },
    [query, onSearch]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('', filters);
    inputRef.current?.focus();
  }, [filters, onSearch]);

  // Select recent search
  const handleSelectRecent = useCallback(
    (search: RecentSearch) => {
      setQuery(search.query);
      onSearch(search.query, filters);
      setIsFocused(false);
    },
    [filters, onSearch]
  );

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  const hasActiveFilters =
    filters.status?.length ||
    filters.categoryIds?.length ||
    filters.tagIds?.length ||
    (filters.contentType && filters.contentType !== 'ALL');

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={`flex items-center bg-slate-800/80 border rounded-xl transition-all ${
            isFocused
              ? 'border-primary-500/50 ring-2 ring-primary-500/20'
              : 'border-c-border-subtle/50 hover:border-slate-600'
          }`}
        >
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 ml-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="flex-1 px-3 py-3 bg-transparent text-c-text placeholder-slate-500 focus:outline-none"
          />

          {/* Quick content type filter badges */}
          {contentTypes.length > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={() =>
                  handleFilterChange(
                    'contentType',
                    filters.contentType === 'ALL' ? 'PLAYBOOK' : 'ALL'
                  )
                }
                className={`p-1.5 rounded-lg transition-colors ${
                  filters.contentType === 'PLAYBOOK'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
                title="Playbooks only"
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange('contentType', filters.contentType === 'ALL' ? 'EMAIL' : 'ALL')
                }
                className={`p-1.5 rounded-lg transition-colors ${
                  filters.contentType === 'EMAIL'
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'
                }`}
                title="Email templates only"
              >
                <Mail size={14} />
              </button>
            </div>
          )}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-white mr-1"
            >
              <X size={16} />
            </button>
          )}

          {showFilters && (
            <button
              type="button"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`p-2 mr-2 rounded-lg transition-colors ${
                hasActiveFilters || showFiltersPanel
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-white hover:bg-c-surface-raised/50'
              }`}
            >
              <Filter size={16} />
              {hasActiveFilters && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-navy-900 rounded-full dark:bg-white" />
              )}
            </button>
          )}
        </div>
      </form>

      {/* Dropdown Panel (suggestions/recent) */}
      {isFocused && showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-c-surface-raised border border-c-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Recent Searches */}
          {recentSearches.length > 0 && !query && (
            <div className="p-3 border-b border-c-border-subtle/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                  <Clock size={14} />
                  Recent searches
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectRecent(search)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-slate-300 hover:bg-c-surface-raised/50 rounded-lg"
                  >
                    <Search size={12} className="text-slate-500 dark:text-slate-400" />
                    <span className="flex-1 truncate">{search.query}</span>
                    {search.contentType && search.contentType !== 'ALL' && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {search.contentType}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions based on query */}
          {query && suggestions.length > 0 && (
            <div className="p-3">
              <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 mb-2">
                <Sparkles size={14} />
                Suggestions
              </div>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(suggestion);
                    onSearch(suggestion, filters);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-left text-slate-300 hover:bg-c-surface-raised/50 rounded-lg"
                >
                  <FileText size={12} className="text-slate-500 dark:text-slate-400" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Quick Tips */}
          {!query && recentSearches.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Search for playbook templates, email templates, categories, or tags
              </p>
              <div className="flex justify-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <Hash size={12} /> Use #tag
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <FolderOpen size={12} /> Use :category
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFiltersPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-c-surface-raised border border-c-border-subtle rounded-xl shadow-2xl z-40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-c-text">Filters</h4>
            <button
              onClick={() =>
                setFilters({
                  contentType: 'ALL',
                  status: [],
                  categoryIds: [],
                  tagIds: [],
                  sortBy: 'relevance',
                  sortOrder: 'desc',
                })
              }
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Reset all
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-2">
                Content Type
              </label>
              <select
                value={filters.contentType}
                onChange={(e) => handleFilterChange('contentType', e.target.value)}
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="ALL">All Types</option>
                <option value="PLAYBOOK">Playbooks</option>
                <option value="EMAIL">Email Templates</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-2">
                Status
              </label>
              <select
                value={filters.status?.[0] || ''}
                onChange={(e) =>
                  handleFilterChange('status', e.target.value ? [e.target.value] : [])
                }
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="DEPRECATED">Deprecated</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  handleFilterChange('sortBy', e.target.value as SearchFilters['sortBy'])
                }
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="relevance">Relevance</option>
                <option value="date">Date</option>
                <option value="popularity">Popularity</option>
                <option value="name">Name</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-sm font-medium text-slate-400 dark:text-slate-500 mb-2">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) =>
                  handleFilterChange('sortOrder', e.target.value as SearchFilters['sortOrder'])
                }
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          {/* Active filters badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-c-border-subtle">
              {filters.contentType && filters.contentType !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                  {filters.contentType === 'PLAYBOOK' ? <Play size={10} /> : <Mail size={10} />}
                  {filters.contentType}
                  <button
                    onClick={() => handleFilterChange('contentType', 'ALL')}
                    className="ml-1 hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {filters.status?.map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full"
                >
                  {status}
                  <button
                    onClick={() =>
                      handleFilterChange(
                        'status',
                        filters.status?.filter((s) => s !== status) || []
                      )
                    }
                    className="ml-1 hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showFiltersPanel && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowFiltersPanel(false);
          }}
        />
      )}
    </div>
  );
};

export default ContentSearch;
