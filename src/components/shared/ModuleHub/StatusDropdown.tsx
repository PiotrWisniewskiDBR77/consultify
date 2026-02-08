/**
 * StatusDropdown
 * Context-aware status filter dropdown for all modules
 *
 * Uses canonical 11-status initiative lifecycle:
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *
 * Each module shows only relevant statuses:
 * - Tools/Assessment: DRAFT (own)
 * - Initiatives: REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED, CANCELLED
 * - Execution: SCHEDULED, EXECUTING, BLOCKED, DONE
 * - Benefits: TRACKING
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
  | 'initiatives'
  | 'execution'
  | 'benefits'
  | 'reporting';

// ============================================
// STATUS CONFIGURATIONS (Canonical)
// ============================================

const ALL_STATUSES: Record<InitiativeStatus, StatusOption> = {
  DRAFT: {
    id: 'DRAFT',
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500',
    order: 1,
  },
  PENDING_REVIEW: {
    id: 'PENDING_REVIEW',
    label: 'Pending Review',
    labelPL: 'Oczekuje na przegląd',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500',
    order: 2,
  },
  REVIEW: {
    id: 'REVIEW',
    label: 'In Review',
    labelPL: 'W przeglądzie',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500',
    order: 3,
  },
  PROMOTED: {
    id: 'PROMOTED',
    label: 'Promoted',
    labelPL: 'Promowana',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500',
    order: 4,
  },
  PLANNING: {
    id: 'PLANNING',
    label: 'Planning',
    labelPL: 'Planowanie',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500',
    order: 5,
  },
  APPROVED: {
    id: 'APPROVED',
    label: 'Approved',
    labelPL: 'Zatwierdzona',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500',
    order: 6,
  },
  SCHEDULED: {
    id: 'SCHEDULED',
    label: 'Scheduled',
    labelPL: 'Zaplanowana',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500',
    order: 7,
  },
  EXECUTING: {
    id: 'EXECUTING',
    label: 'Executing',
    labelPL: 'W realizacji',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500',
    order: 8,
  },
  BLOCKED: {
    id: 'BLOCKED',
    label: 'Blocked',
    labelPL: 'Zablokowana',
    color: 'text-red-400',
    bgColor: 'bg-red-500',
    order: 9,
  },
  DONE: {
    id: 'DONE',
    label: 'Done',
    labelPL: 'Ukończona',
    color: 'text-green-400',
    bgColor: 'bg-green-500',
    order: 10,
  },
  TRACKING: {
    id: 'TRACKING',
    label: 'Tracking',
    labelPL: 'Śledzenie',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500',
    order: 11,
  },
  CANCELLED: {
    id: 'CANCELLED',
    label: 'Cancelled',
    labelPL: 'Anulowana',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500',
    order: 12,
  },
  ARCHIVED: {
    id: 'ARCHIVED',
    label: 'Archived',
    labelPL: 'Zarchiwizowana',
    color: 'text-slate-300',
    bgColor: 'bg-slate-600',
    order: 13,
  },
};

// "All" option for dropdown
const ALL_OPTION: StatusOption = {
  id: 'all',
  label: 'All',
  labelPL: 'Wszystkie',
  color: 'text-slate-400',
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
  const statuses: InitiativeStatus[] = [];

  switch (module) {
    case 'tools':
    case 'assessment':
      // Source modules
      statuses.push('DRAFT', 'PENDING_REVIEW');
      break;

    case 'initiatives':
      // Full planning lifecycle
      statuses.push(
        'REVIEW',
        'PROMOTED',
        'PLANNING',
        'APPROVED',
        'SCHEDULED',
        'CANCELLED',
        'ARCHIVED'
      );
      break;

    case 'execution':
      // Active work statuses
      statuses.push('SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE');
      break;

    case 'benefits':
      // Tracking only
      statuses.push('TRACKING');
      break;

    case 'reporting':
      // All statuses
      return [ALL_OPTION, ...Object.values(ALL_STATUSES)];

    default:
      return [ALL_OPTION];
  }

  return [ALL_OPTION, ...statuses.map((s) => ALL_STATUSES[s])];
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
  const options = getStatusesForModule(context);

  // Find current selected option
  const selectedOption = options.find((opt) => opt.id === value) || options[0];

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
          flex items-center gap-2 rounded-lg font-medium
          bg-navy-800 border border-navy-600 text-slate-300
          hover:bg-navy-700 hover:border-slate-500 hover:text-white
          transition-all duration-200
          ${sizeClasses[size]}
          ${isOpen ? 'border-primary-500 bg-navy-700' : ''}
        `}
      >
        {showIcon && <Filter size={iconSize} className="text-slate-400" />}
        <span className={`w-2 h-2 rounded-full ${selectedOption.bgColor}`} />
        <span>{getLabel(selectedOption)}</span>
        {counts && counts[value] !== undefined && (
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-navy-700 text-slate-400">
            {counts[value]}
          </span>
        )}
        <ChevronDown
          size={iconSize}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute top-full left-0 mt-1 z-50
            min-w-[200px] py-1
            bg-navy-800 border border-navy-600 rounded-lg
            shadow-xl shadow-black/30
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
                  ${isSelected ? 'bg-primary-500/15 text-white' : 'text-slate-300 hover:bg-navy-700 hover:text-white'}
                `}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${option.bgColor}`} />
                <span className="flex-1 text-sm">{getLabel(option)}</span>
                {count !== undefined && <span className="text-xs text-slate-500">{count}</span>}
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

export { ALL_OPTION, ALL_STATUSES, getStatusesForModule };

export default StatusDropdown;
