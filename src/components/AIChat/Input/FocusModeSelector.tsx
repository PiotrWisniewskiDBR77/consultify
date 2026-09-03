/**
 * FocusModeSelector - Focus mode dropdown for AI context filtering
 *
 * Redesigned from pills to dropdown for cleaner header UI.
 * Like Perplexity's source filters: All | PMO Docs | Project | Research | Web
 *
 * @version 2.0.0
 */

import { BookOpen, ChevronDown, FolderOpen, Globe, Search, Sparkles } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FocusMode } from '../../../types';

interface FocusModeSelectorProps {
  value: FocusMode;
  onChange: (mode: FocusMode) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  /** Number of active knowledge sources (shown as badge on compact mode) */
  activeSourceCount?: number;
}

interface FocusModeOption {
  value: FocusMode;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

export const FocusModeSelector: React.FC<FocusModeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  compact = false,
  className = '',
  activeSourceCount,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const focusModes: FocusModeOption[] = [
    {
      value: 'all',
      label: t('focusMode.all', 'Wszystko'),
      description: t('focusMode.allDesc', 'Wszystkie dostępne źródła'),
      icon: Sparkles,
      color: 'text-c-text-secondary dark:text-c-text-secondary',
      bgColor: 'bg-c-surface-raised dark:bg-c-surface-raised',
    },
    {
      value: 'pmo-docs',
      label: t('focusMode.pmoDocs', 'PMO'),
      description: t('focusMode.pmoDocsDesc', 'ISO 21500, PMBOK, PRINCE2'),
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      value: 'project-data',
      label: t('focusMode.projectData', 'Projekt'),
      description: t('focusMode.projectDataDesc', 'Kontekst bieżącego projektu'),
      icon: FolderOpen,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      value: 'research',
      label: t('focusMode.research', 'Analiza'),
      description: t('focusMode.researchDesc', 'Tryb głębokiej analizy'),
      icon: Search,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      value: 'web',
      label: t('focusMode.web', 'Web'),
      description: t('focusMode.webDesc', 'Wyszukiwanie w czasie rzeczywistym'),
      icon: Globe,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
  ];

  const selectedMode = focusModes.find((m) => m.value === value) || focusModes[0];
  const Icon = selectedMode.icon;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Compact: icon only with dropdown
  if (compact) {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
                        flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all
                        ${selectedMode.bgColor} border-transparent
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm cursor-pointer'}
                    `}
          title={`${t('focusMode.label', 'Tryb')}: ${selectedMode.label}${activeSourceCount ? ` (${activeSourceCount} sources)` : ''}`}
        >
          <Icon size={14} className={selectedMode.color} />
          {activeSourceCount != null && activeSourceCount > 0 && value !== 'all' && (
            <span className="text-[10px] font-bold text-c-text-secondary dark:text-c-text-secondary">
              {activeSourceCount}
            </span>
          )}
          <ChevronDown size={12} className="text-slate-600 dark:text-slate-500" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 w-48 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl">
            {focusModes.map((mode) => {
              const ModeIcon = mode.icon;
              const isSelected = mode.value === value;

              return (
                <button
                  key={mode.value}
                  onClick={() => {
                    onChange(mode.value);
                    setIsOpen(false);
                  }}
                  className={`
                                        w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm
                                        transition-colors
                                        ${isSelected ? mode.bgColor : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                                    `}
                >
                  <ModeIcon size={14} className={mode.color} />
                  <span
                    className={`font-medium ${isSelected ? mode.color : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {mode.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Full: button with label and dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
                    ${selectedMode.bgColor} border-transparent
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm cursor-pointer'}
                `}
      >
        <Icon size={14} className={selectedMode.color} />
        <span className={`text-xs font-medium ${selectedMode.color}`}>{selectedMode.label}</span>
        <ChevronDown size={12} className="text-slate-600 dark:text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 w-56 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl">
          <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('focusMode.selectSource', 'Wybierz źródła')}
          </div>
          {focusModes.map((mode) => {
            const ModeIcon = mode.icon;
            const isSelected = mode.value === value;

            return (
              <button
                key={mode.value}
                onClick={() => {
                  onChange(mode.value);
                  setIsOpen(false);
                }}
                className={`
                                    w-full flex items-start gap-3 px-3 py-2.5 text-left
                                    transition-colors
                                    ${isSelected ? mode.bgColor : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                                `}
              >
                <div className={`p-1 rounded ${mode.bgColor}`}>
                  <ModeIcon size={14} className={mode.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${isSelected ? mode.color : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {mode.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {mode.description}
                  </div>
                </div>
                {isSelected && (
                  <div
                    className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${mode.color.replace('text-', 'bg-')}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Focus Mode Display Badge - Shows current mode inline
 */
export const FocusModeBadge: React.FC<{
  mode: FocusMode;
  className?: string;
}> = ({ mode, className = '' }) => {
  const { t } = useTranslation();

  const modeConfig: Record<FocusMode, { label: string; icon: React.ReactNode; color: string }> = {
    all: {
      label: t('focusMode.all', 'All'),
      icon: <Sparkles size={12} />,
      color: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-secondary',
    },
    'pmo-docs': {
      label: t('focusMode.pmoDocs', 'PMO'),
      icon: <BookOpen size={12} />,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
    'project-data': {
      label: t('focusMode.projectData', 'Project'),
      icon: <FolderOpen size={12} />,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    research: {
      label: t('focusMode.research', 'Research'),
      icon: <Search size={12} />,
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    web: {
      label: t('focusMode.web', 'Web'),
      icon: <Globe size={12} />,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },
  };

  const config = modeConfig[mode];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

export default FocusModeSelector;
