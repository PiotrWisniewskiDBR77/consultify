/**
 * StatusDropdown
 * Context-aware status filter dropdown for all modules
 *
 * Supports three distinct status families:
 * 1. Assessment statuses: DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED
 * 2. Report statuses: DRAFT → GENERATING → FINAL → APPROVED → UTILIZED
 * 3. Initiative statuses (canonical 13): DRAFT → REVIEW → PROMOTED → ... → TRACKING
 *
 * Each module/tab shows only its relevant statuses.
 *
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 */

import { Check, ChevronDown, Filter } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================

export type InitiativeStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REVIEW'
  | 'PROMOTED'
  | 'PLANNING'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'BLOCKED'
  | 'DONE'
  | 'TRACKING'
  | 'CANCELLED'
  | 'ARCHIVED';

export type AssessmentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

export type ReportStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'FINAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'UTILIZED';

export interface StatusOption {
  id: string;
  label: string;
  labelPL: string;
  color: string;
  bgColor: string;
  order: number;
}

export type ModuleContext =
  | 'tools'
  | 'assessment'
  | 'assessment_list'
  | 'assessment_reports'
  | 'assessment_initiatives'
  | 'initiatives'
  | 'execution'
  | 'benefits'
  | 'reporting';

// ============================================
// STATUS CONFIGURATIONS
// ============================================

// --- Initiative statuses (canonical 13) ---
const ALL_STATUSES: Record<InitiativeStatus, StatusOption> = {
  DRAFT: {
    id: 'DRAFT',
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 1,
  },
  PENDING_REVIEW: {
    id: 'PENDING_REVIEW',
    label: 'Pending Review',
    labelPL: 'Oczekuje na przegląd',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 2,
  },
  REVIEW: {
    id: 'REVIEW',
    label: 'In Review',
    labelPL: 'W przeglądzie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 3,
  },
  PROMOTED: {
    id: 'PROMOTED',
    label: 'Promoted',
    labelPL: 'Promowana',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    order: 4,
  },
  PLANNING: {
    id: 'PLANNING',
    label: 'Planning',
    labelPL: 'Planowanie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 5,
  },
  APPROVED: {
    id: 'APPROVED',
    label: 'Approved',
    labelPL: 'Zatwierdzona',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 6,
  },
  SCHEDULED: {
    id: 'SCHEDULED',
    label: 'Scheduled',
    labelPL: 'Zaplanowana',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    order: 7,
  },
  EXECUTING: {
    id: 'EXECUTING',
    label: 'Executing',
    labelPL: 'W realizacji',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    order: 8,
  },
  BLOCKED: {
    id: 'BLOCKED',
    label: 'Blocked',
    labelPL: 'Zablokowana',
    color: 'text-danger-500',
    bgColor: 'bg-danger-500',
    order: 9,
  },
  DONE: {
    id: 'DONE',
    label: 'Done',
    labelPL: 'Ukończona',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 10,
  },
  TRACKING: {
    id: 'TRACKING',
    label: 'Tracking',
    labelPL: 'Śledzenie',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 11,
  },
  CANCELLED: {
    id: 'CANCELLED',
    label: 'Cancelled',
    labelPL: 'Anulowana',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 12,
  },
  ARCHIVED: {
    id: 'ARCHIVED',
    label: 'Archived',
    labelPL: 'Zarchiwizowana',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 13,
  },
};

// --- Assessment statuses ---
const ASSESSMENT_STATUSES: Record<AssessmentStatus, StatusOption> = {
  DRAFT: {
    id: 'DRAFT',
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 1,
  },
  IN_REVIEW: {
    id: 'IN_REVIEW',
    label: 'In Review',
    labelPL: 'W przeglądzie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 2,
  },
  AWAITING_APPROVAL: {
    id: 'AWAITING_APPROVAL',
    label: 'Awaiting Approval',
    labelPL: 'Oczekuje na zatwierdzenie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 3,
  },
  APPROVED: {
    id: 'APPROVED',
    label: 'Approved',
    labelPL: 'Zatwierdzony',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 4,
  },
  REJECTED: {
    id: 'REJECTED',
    label: 'Rejected',
    labelPL: 'Odrzucony',
    color: 'text-danger-500',
    bgColor: 'bg-danger-500',
    order: 5,
  },
  ARCHIVED: {
    id: 'ARCHIVED',
    label: 'Archived',
    labelPL: 'Zarchiwizowany',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 6,
  },
};

// --- Report statuses ---
const REPORT_STATUSES: Record<ReportStatus, StatusOption> = {
  DRAFT: {
    id: 'DRAFT',
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400',
    order: 1,
  },
  GENERATING: {
    id: 'GENERATING',
    label: 'Generating',
    labelPL: 'Generowanie',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    order: 2,
  },
  FINAL: {
    id: 'FINAL',
    label: 'Final',
    labelPL: 'Finalny',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500',
    order: 3,
  },
  PENDING_APPROVAL: {
    id: 'PENDING_APPROVAL',
    label: 'Pending Approval',
    labelPL: 'Oczekuje na zatwierdzenie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    order: 4,
  },
  APPROVED: {
    id: 'APPROVED',
    label: 'Approved',
    labelPL: 'Zatwierdzony',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 5,
  },
  REJECTED: {
    id: 'REJECTED',
    label: 'Rejected',
    labelPL: 'Odrzucony',
    color: 'text-danger-500',
    bgColor: 'bg-danger-500',
    order: 6,
  },
  UTILIZED: {
    id: 'UTILIZED',
    label: 'Utilized',
    labelPL: 'Wykorzystany',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    order: 7,
  },
};

// "All" option for dropdown
const ALL_OPTION: StatusOption = {
  id: 'all',
  label: 'All',
  labelPL: 'Wszystkie',
  color: 'text-slate-600',
  bgColor: 'bg-slate-500',
  order: 0,
};

// ============================================
// MODULE STATUS MAPPINGS
// ============================================

/**
 * Get statuses visible for each module context
 */
function getStatusesForModule(module: ModuleContext): StatusOption[] {
  switch (module) {
    case 'tools':
      // Source modules — initiative statuses
      return [ALL_OPTION, ALL_STATUSES.DRAFT, ALL_STATUSES.PENDING_REVIEW];

    case 'assessment_initiatives':
      // Assessment is also a source module for initiatives (phase 1 only)
      return [ALL_OPTION, ALL_STATUSES.DRAFT, ALL_STATUSES.PENDING_REVIEW];

    case 'assessment':
    case 'assessment_list':
      // Assessment workflow statuses
      return [ALL_OPTION, ...Object.values(ASSESSMENT_STATUSES)];

    case 'assessment_reports':
      // Report statuses
      return [ALL_OPTION, ...Object.values(REPORT_STATUSES)];

    case 'initiatives':
      // D1.2: Complete initiative lifecycle — all 13 statuses visible for filtering
      return [
        ALL_OPTION,
        ALL_STATUSES.DRAFT,
        ALL_STATUSES.PENDING_REVIEW,
        ALL_STATUSES.REVIEW,
        ALL_STATUSES.PROMOTED,
        ALL_STATUSES.PLANNING,
        ALL_STATUSES.APPROVED,
        ALL_STATUSES.SCHEDULED,
        ALL_STATUSES.EXECUTING,
        ALL_STATUSES.BLOCKED,
        ALL_STATUSES.DONE,
        ALL_STATUSES.TRACKING,
        ALL_STATUSES.CANCELLED,
        ALL_STATUSES.ARCHIVED,
      ];

    case 'execution':
      // Active work statuses
      return [
        ALL_OPTION,
        ALL_STATUSES.SCHEDULED,
        ALL_STATUSES.EXECUTING,
        ALL_STATUSES.BLOCKED,
        ALL_STATUSES.DONE,
      ];

    case 'benefits':
      // Tracking only
      return [ALL_OPTION, ALL_STATUSES.TRACKING];

    case 'reporting':
      // All statuses (legacy)
      return [ALL_OPTION, ...Object.values(ALL_STATUSES)];

    default:
      return [ALL_OPTION];
  }
}

// ============================================
// COMPONENT
// ============================================

interface StatusDropdownProps {
  context: ModuleContext;
  value: string;
  onChange: (status: string) => void;
  counts?: Record<string, number>;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  language?: 'en' | 'pl';
}

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  context,
  value,
  onChange,
  counts,
  className = '',
  showIcon = true,
  size = 'md',
  language = 'en',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get status options based on context
  const rawOptions = getStatusesForModule(context);
  // Defensive: never allow empty/invalid options to crash rendering.
  const options = (Array.isArray(rawOptions) ? rawOptions : [ALL_OPTION]).filter(
    (opt): opt is StatusOption => !!opt && typeof opt.id === 'string'
  );

  // Find current selected option
  const selectedOption = options.find((opt) => opt.id === value) || options[0] || ALL_OPTION;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = useCallback(
    (statusId: string) => {
      onChange(statusId);
      setIsOpen(false);
    },
    [onChange]
  );

  // Size classes
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;

  // Get label based on language
  const getLabel = (option: StatusOption) => (language === 'pl' ? option.labelPL : option.label);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 h-9 rounded-lg font-medium
          text-slate-700 dark:text-slate-300
          hover:bg-slate-100/70 dark:hover:bg-white/[0.05]
          transition-colors duration-150
          ${sizeClasses[size]}
          ${isOpen ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100' : ''}
        `}
      >
        {showIcon && <Filter size={iconSize} className="text-slate-500 dark:text-slate-400" />}
        <span className={`w-2 h-2 rounded-full ${selectedOption?.bgColor || ALL_OPTION.bgColor}`} />
        <span>{getLabel(selectedOption)}</span>
        {counts && counts[value] !== undefined && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
            {counts[value]}
          </span>
        )}
        <ChevronDown
          size={iconSize}
          className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 mt-1 z-overlay
            min-w-[200px] py-1
            bg-white dark:bg-navy-800 rounded-xl
            shadow-hig-xl dark:shadow-hig-dark-xl
          "
        >
          {options.map((option) => {
            const isSelected = value === option.id;
            const count = counts?.[option.id];

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left
                  transition-colors duration-150
                  ${
                    isSelected
                      ? 'bg-primary-500/10 text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                  }
                `}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${option.bgColor}`} />
                <span className="flex-1 text-sm">{getLabel(option)}</span>
                {count !== undefined && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">{count}</span>
                )}
                {isSelected && <Check size={14} className="text-primary-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================
// EXPORTS
// ============================================

export { ALL_OPTION, ALL_STATUSES, ASSESSMENT_STATUSES, getStatusesForModule, REPORT_STATUSES };

export default StatusDropdown;
