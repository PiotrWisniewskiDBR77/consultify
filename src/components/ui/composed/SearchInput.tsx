/**
 * SearchInput Component - Apple HIG Design System
 *
 * A search input with suggestions, recent searches, and loading states.
 *
 * @example
 * <SearchInput
 *   placeholder="Search..."
 *   suggestions={['React', 'TypeScript', 'Tailwind']}
 *   onSearch={(query) => console.log(query)}
 * />
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Loader2, Search, X } from 'lucide-react';
import React, { forwardRef, useEffect, useRef, useState } from 'react';

export interface SearchInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Initial value */
  defaultValue?: string;
  /** Controlled value */
  value?: string;
  /** On value change */
  onValueChange?: (value: string) => void;
  /** On search submit */
  onSearch?: (query: string) => void;
  /** Suggestions to show */
  suggestions?: string[];
  /** Recent searches */
  recentSearches?: string[];
  /** Loading state */
  loading?: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Full width */
  fullWidth?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

const sizeStyles = {
  sm: { input: 'px-3 py-2 text-sm', icon: 16 },
  md: { input: 'px-4 py-3 text-sm', icon: 18 },
  lg: { input: 'px-5 py-4 text-base', icon: 20 },
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      placeholder = 'Search...',
      defaultValue = '',
      value: controlledValue,
      onValueChange,
      onSearch,
      suggestions = [],
      recentSearches = [],
      loading = false,
      debounceMs = 300,
      fullWidth = true,
      size = 'md',
      className = '',
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState(defaultValue);
    const [isFocused, setIsFocused] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;

    const { input: inputSize, icon: iconSize } = sizeStyles[size];

    // Filter suggestions based on input
    const filteredSuggestions = value
      ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
      : [];

    // Combine recent searches and suggestions
    const showRecent = !value && recentSearches.length > 0;
    const hasDropdownContent = showRecent || filteredSuggestions.length > 0;

    // Handle value change with debounce
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (!isControlled) {
        setInternalValue(newValue);
      }

      onValueChange?.(newValue);

      // Debounced search callback
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearch?.(newValue);
      }, debounceMs);
    };

    // Handle selection from dropdown
    const handleSelect = (selected: string) => {
      if (!isControlled) {
        setInternalValue(selected);
      }
      onValueChange?.(selected);
      onSearch?.(selected);
      setShowDropdown(false);
      inputRef.current?.blur();
    };

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSearch?.(value);
      setShowDropdown(false);
    };

    // Clear input
    const handleClear = () => {
      if (!isControlled) {
        setInternalValue('');
      }
      onValueChange?.('');
      inputRef.current?.focus();
    };

    // Handle click outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };

    return (
      <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            {/* Search icon */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 pointer-events-none">
              {loading ? (
                <Loader2 size={iconSize} className="animate-spin" />
              ) : (
                <Search size={iconSize} />
              )}
            </div>

            {/* Input */}
            <input
              ref={(node) => {
                inputRef.current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) ref.current = node;
              }}
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => {
                setIsFocused(true);
                setShowDropdown(true);
              }}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`
                w-full
                pl-10 pr-10
                ${inputSize}
                bg-slate-50 dark:bg-navy-900
                text-navy-900 dark:text-white
                placeholder-slate-400 dark:placeholder-slate-500
                rounded-xl
                border border-transparent
                transition-all duration-150 ease-out
                outline-none
                ${
                  isFocused
                    ? 'bg-white dark:bg-navy-900 border-primary-500 ring-2 ring-primary-500/20'
                    : 'hover:bg-slate-100 dark:hover:bg-navy-800'
                }
              `}
            />

            {/* Clear button */}
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
              >
                <X size={iconSize - 2} />
              </button>
            )}
          </div>
        </form>

        {/* Dropdown */}
        <AnimatePresence>
          {showDropdown && hasDropdownContent && (
            <motion.div
              className="absolute top-full left-0 right-0 mt-2 py-2 bg-white dark:bg-navy-900 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-slate-200/50 dark:border-navy-700 overflow-hidden z-dropdown"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Recent searches */}
              {showRecent && (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Recent
                  </div>
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelect(search)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-navy-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Clock size={14} className="text-slate-600 dark:text-slate-500" />
                      <span className="flex-1 text-left truncate">{search}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Suggestions */}
              {filteredSuggestions.length > 0 && (
                <>
                  {showRecent && <div className="my-1 h-px bg-slate-200 dark:bg-white/10" />}
                  {!showRecent && value && (
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Suggestions
                    </div>
                  )}
                  {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSelect(suggestion)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-navy-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <Search size={14} className="text-slate-600 dark:text-slate-500" />
                      <span className="flex-1 text-left truncate">{suggestion}</span>
                      <ArrowRight size={14} className="text-slate-600 dark:text-slate-500" />
                    </button>
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
