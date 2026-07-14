/**
 * BulkEditPopovers - Popover UI for bulk editing priority and due date
 * Replaces browser prompt() calls with Golden Standard controls
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronRight,
  Flag,
  Minus,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';

// ── Priority Picker ──

const PRIORITY_OPTIONS = [
  {
    value: 'critical',
    label: 'Critical',
    labelPl: 'Krytyczny',
    dot: 'bg-danger-500',
    icon: AlertTriangle,
  },
  { value: 'high', label: 'High', labelPl: 'Wysoki', dot: 'bg-amber-500', icon: ArrowUp },
  { value: 'medium', label: 'Medium', labelPl: 'Średni', dot: 'bg-blue-500', icon: Minus },
  { value: 'low', label: 'Low', labelPl: 'Niski', dot: 'bg-slate-400', icon: ArrowDown },
] as const;

interface BulkPriorityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (priority: string) => void;
  selectedCount: number;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const BulkPriorityPicker: React.FC<BulkPriorityPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedCount,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-dropdown" onClick={onClose} />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-overlay w-56 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish
                  ? `Ustaw priorytet (${selectedCount} zad.)`
                  : `Set priority (${selectedCount} tasks)`}
              </p>
            </div>
            <div className="p-1.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onSelect(opt.value);
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                    <Icon size={14} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-slate-700 dark:text-slate-200">
                      {isPolish ? opt.labelPl : opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Date Picker ──

const getDatePresets = (isPolish: boolean) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));

  const nextFriday = new Date(today);
  const daysToFriday = (5 - nextFriday.getDay() + 7) % 7 || 7;
  nextFriday.setDate(nextFriday.getDate() + daysToFriday);

  const inOneWeek = new Date(today);
  inOneWeek.setDate(inOneWeek.getDate() + 7);

  return [
    { label: i18n.t('myWork.bulkEdit.label', 'Today'), date: today },
    { label: i18n.t('myWork.bulkEdit.label2', 'Tomorrow'), date: tomorrow },
    { label: i18n.t('myWork.bulkEdit.label3', 'Next Monday'), date: nextMonday },
    { label: i18n.t('myWork.bulkEdit.label4', 'Next Friday'), date: nextFriday },
    { label: i18n.t('myWork.bulkEdit.label5', 'In 1 week'), date: inOneWeek },
  ];
};

const formatISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatShortDate = (d: Date, isPolish: boolean): string =>
  d.toLocaleDateString(i18n.t('myWork.bulkEdit.dToLocaleDateString', 'en-US'), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

interface BulkDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedCount: number;
}

export const BulkDatePicker: React.FC<BulkDatePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedCount,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const ref = useRef<HTMLDivElement>(null);
  const [customDate, setCustomDate] = useState('');
  const presets = getDatePresets(isPolish);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleCustomSubmit = () => {
    if (customDate && /^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      onSelect(customDate);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-dropdown" onClick={onClose} />
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-overlay w-64 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish
                  ? `Ustaw termin (${selectedCount} zad.)`
                  : `Set due date (${selectedCount} tasks)`}
              </p>
            </div>

            {/* Presets */}
            <div className="p-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    onSelect(formatISODate(preset.date));
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                >
                  <span className="text-slate-700 dark:text-slate-200">{preset.label}</span>
                  <span className="text-xs text-slate-600 dark:text-slate-500">
                    {formatShortDate(preset.date, isPolish)}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom date */}
            <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-600 shrink-0" />
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSubmit();
                  }}
                  className="flex-1 h-8 px-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customDate || !/^\d{4}-\d{2}-\d{2}$/.test(customDate)}
                  className="h-8 px-2.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  OK
                </button>
              </div>
            </div>

            {/* Remove date */}
            <div className="px-1.5 pb-1.5">
              <button
                onClick={() => {
                  onSelect('');
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger-500 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
              >
                <X size={14} />
                {t('myWork.bulkEdit.removeDueDate', 'Remove due date')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
