import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Filter,
  FolderOpen,
  RefreshCw,
  Tag,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentCategory, ContentTag } from '../../types';

export interface ContentFiltersState {
  contentType: 'PLAYBOOK' | 'EMAIL' | 'ALL';
  status: string[];
  categoryIds: string[];
  tagIds: string[];
  createdBy: string[];
  dateRange: {
    from: string;
    to: string;
  };
  language: string;
}

interface ContentFiltersProps {
  filters: ContentFiltersState;
  onChange: (filters: ContentFiltersState) => void;
  categories?: ContentCategory[];
  tags?: ContentTag[];
  users?: Array<{ id: string; firstName: string; lastName: string }>;
  showContentType?: boolean;
  showCategories?: boolean;
  showTags?: boolean;
  showDateRange?: boolean;
  showCreatedBy?: boolean;
  showLanguage?: boolean;
  languages?: Array<{ code: string; name: string }>;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'PUBLISHED', label: 'Published', color: 'bg-emerald-500/20 text-emerald-400' },
  {
    value: 'DEPRECATED',
    label: 'Deprecated',
    color: 'bg-slate-500/20 text-slate-400 dark:text-slate-500',
  },
];

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'pl', name: 'Polish' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
];

export const ContentFilters: React.FC<ContentFiltersProps> = ({
  filters,
  onChange,
  categories = [],
  tags = [],
  users = [],
  showContentType = true,
  showCategories = true,
  showTags = true,
  showDateRange = true,
  showCreatedBy = false,
  showLanguage = true,
  languages = DEFAULT_LANGUAGES,
  compact = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status', 'contentType'])
  );
  const [isExpanded, setIsExpanded] = useState(!compact);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: newStatus });
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = filters.categoryIds.includes(categoryId)
      ? filters.categoryIds.filter((id) => id !== categoryId)
      : [...filters.categoryIds, categoryId];
    onChange({ ...filters, categoryIds: newCategories });
  };

  const handleTagToggle = (tagId: string) => {
    const newTags = filters.tagIds.includes(tagId)
      ? filters.tagIds.filter((id) => id !== tagId)
      : [...filters.tagIds, tagId];
    onChange({ ...filters, tagIds: newTags });
  };

  const handleUserToggle = (userId: string) => {
    const newUsers = filters.createdBy.includes(userId)
      ? filters.createdBy.filter((id) => id !== userId)
      : [...filters.createdBy, userId];
    onChange({ ...filters, createdBy: newUsers });
  };

  const handleClearAll = () => {
    onChange({
      contentType: 'ALL',
      status: [],
      categoryIds: [],
      tagIds: [],
      createdBy: [],
      dateRange: { from: '', to: '' },
      language: '',
    });
  };

  const activeFiltersCount =
    filters.status.length +
    filters.categoryIds.length +
    filters.tagIds.length +
    filters.createdBy.length +
    (filters.contentType !== 'ALL' ? 1 : 0) +
    (filters.dateRange.from || filters.dateRange.to ? 1 : 0) +
    (filters.language ? 1 : 0);

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          activeFiltersCount > 0
            ? 'bg-primary-500/10 border-primary-500/30 text-primary-400'
            : 'bg-c-surface-raised/50 border-c-border-subtle/50 text-slate-400 dark:text-slate-500 hover:text-white'
        }`}
      >
        <Filter size={16} />
        Filters
        {activeFiltersCount > 0 && (
          <span className="px-1.5 py-0.5 bg-navy-900 text-white text-xs rounded-full dark:bg-white dark:text-navy-950">
            {activeFiltersCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-c-surface-raised/50 border border-c-border-subtle/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle/50">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-primary-400" />
          <span className="font-semibold text-c-text">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
              {activeFiltersCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-white flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Clear all
            </button>
          )}
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Content Type */}
        {showContentType && (
          <FilterSection
            title="Content Type"
            icon={<FolderOpen size={14} />}
            expanded={expandedSections.has('contentType')}
            onToggle={() => toggleSection('contentType')}
          >
            <div className="grid grid-cols-3 gap-2">
              {['ALL', 'PLAYBOOK', 'EMAIL'].map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    onChange({
                      ...filters,
                      contentType: type as ContentFiltersState['contentType'],
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.contentType === type
                      ? 'bg-c-text text-c-bg'
                      : 'bg-c-surface text-slate-400 dark:text-slate-500 hover:bg-c-surface-raised hover:text-white'
                  }`}
                >
                  {type === 'ALL' ? 'All' : type === 'PLAYBOOK' ? 'Playbooks' : 'Email'}
                </button>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Status */}
        <FilterSection
          title="Status"
          icon={<Check size={14} />}
          expanded={expandedSections.has('status')}
          onToggle={() => toggleSection('status')}
          count={filters.status.length}
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusToggle(option.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filters.status.includes(option.value)
                    ? option.color + ' ring-2 ring-offset-2 ring-offset-slate-900'
                    : 'bg-c-surface text-slate-400 dark:text-slate-500 hover:bg-c-surface-raised'
                }`}
              >
                {filters.status.includes(option.value) && <Check size={12} />}
                {option.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Categories */}
        {showCategories && categories.length > 0 && (
          <FilterSection
            title="Categories"
            icon={<FolderOpen size={14} />}
            expanded={expandedSections.has('categories')}
            onToggle={() => toggleSection('categories')}
            count={filters.categoryIds.length}
          >
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-c-surface-raised/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.categoryIds.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-c-surface text-primary-500 focus:ring-primary-500/50"
                  />
                  <span className="text-sm text-slate-300">{category.name}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Tags */}
        {showTags && tags.length > 0 && (
          <FilterSection
            title="Tags"
            icon={<Tag size={14} />}
            expanded={expandedSections.has('tags')}
            onToggle={() => toggleSection('tags')}
            count={filters.tagIds.length}
          >
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    filters.tagIds.includes(tag.id)
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                      : ''
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                    borderWidth: '1px',
                  }}
                >
                  <Tag size={10} />
                  {tag.name}
                </button>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Date Range */}
        {showDateRange && (
          <FilterSection
            title="Date Range"
            icon={<Calendar size={14} />}
            expanded={expandedSections.has('dateRange')}
            onToggle={() => toggleSection('dateRange')}
            count={filters.dateRange.from || filters.dateRange.to ? 1 : 0}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateRange.from}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, from: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange.to}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      dateRange: { ...filters.dateRange, to: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
            </div>
          </FilterSection>
        )}

        {/* Created By */}
        {showCreatedBy && users.length > 0 && (
          <FilterSection
            title="Created By"
            icon={<User size={14} />}
            expanded={expandedSections.has('createdBy')}
            onToggle={() => toggleSection('createdBy')}
            count={filters.createdBy.length}
          >
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-c-surface-raised/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.createdBy.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-c-surface text-primary-500 focus:ring-primary-500/50"
                  />
                  <span className="text-sm text-slate-300">
                    {user.firstName} {user.lastName}
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Language */}
        {showLanguage && (
          <FilterSection
            title="Language"
            icon={<FolderOpen size={14} />}
            expanded={expandedSections.has('language')}
            onToggle={() => toggleSection('language')}
            count={filters.language ? 1 : 0}
          >
            <select
              value={filters.language}
              onChange={(e) => onChange({ ...filters, language: e.target.value })}
              className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            >
              <option value="">All languages</option>
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </FilterSection>
        )}
      </div>
    </div>
  );
};

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  count = 0,
  children,
}) => {
  return (
    <div className="border-b border-c-border-subtle/30 last:border-0 pb-4 last:pb-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left mb-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          <span className="text-sm font-medium text-slate-300">{title}</span>
          {count > 0 && (
            <span className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
              {count}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
        )}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
};

export default ContentFilters;
