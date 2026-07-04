/**
 * ManagerSelector - Manager assignment component
 *
 * Features:
 * - User search/select dropdown
 * - Show current manager
 * - Validation for circular references
 * - Quick search with autocomplete
 *
 * Design: Dropdown selector with avatar, HubSpot pattern
 */

import { AlertCircle, Check, ChevronDown, Search, User, UserCheck, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Avatar } from '../../ui/primitives/Avatar';

export interface UserOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
}

interface ManagerSelectorProps {
  userId?: string;
  currentManagerId?: string;
  availableUsers: UserOption[];
  onChange: (managerId: string | null) => void;
  disabled?: boolean;
  excludeIds?: string[];
  className?: string;
}

export const ManagerSelector: React.FC<ManagerSelectorProps> = ({
  userId,
  currentManagerId,
  availableUsers,
  onChange,
  disabled = false,
  excludeIds = [],
  className,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out the user themselves and any excluded IDs
  const filteredUsers = useMemo(() => {
    const idsToExclude = new Set([...(userId ? [userId] : []), ...excludeIds]);

    return availableUsers
      .filter((user) => !idsToExclude.has(user.id))
      .filter((user) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query)
        );
      });
  }, [availableUsers, userId, excludeIds, searchQuery]);

  // Get current manager
  const currentManager = useMemo(() => {
    return availableUsers.find((u) => u.id === currentManagerId);
  }, [availableUsers, currentManagerId]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  }, []);

  // Handle selection
  const handleSelect = useCallback(
    (user: UserOption) => {
      onChange(user.id);
      setIsOpen(false);
      setSearchQuery('');
    },
    [onChange]
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-navy-800 border rounded-lg transition-all',
          isOpen
            ? 'border-primary-500 ring-2 ring-primary-500/20'
            : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {currentManager ? (
          <div className="flex items-center gap-3">
            <Avatar
              name={`${currentManager.firstName} ${currentManager.lastName}`}
              src={currentManager.avatarUrl}
              size="sm"
            />
            <div className="text-left">
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {currentManager.firstName} {currentManager.lastName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentManager.jobTitle || currentManager.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <User size={18} />
            <span className="text-sm">
              {t('admin.team.manager.selectManager', 'Select manager...')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {currentManager && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={cn(
              'text-slate-400 dark:text-slate-500 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-lg overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-200 dark:border-navy-700">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(
                  'admin.team.manager.searchPlaceholder',
                  'Search by name or email...'
                )}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-navy-900 border-0 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-c-focus"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                <Users size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery
                    ? t('admin.team.manager.noResults', 'No users found')
                    : t('admin.team.manager.noAvailable', 'No available users')}
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = user.id === currentManagerId;

                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-navy-700'
                    )}
                  >
                    <Avatar
                      name={`${user.firstName} ${user.lastName}`}
                      src={user.avatarUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isSelected
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-navy-900 dark:text-white'
                        )}
                      >
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.jobTitle || user.email}
                      </p>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-primary-600 dark:text-primary-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {currentManagerId && (
            <div className="p-2 border-t border-slate-200 dark:border-navy-700">
              <button
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
              >
                {t('admin.team.manager.removeManager', 'Remove manager')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManagerSelector;
