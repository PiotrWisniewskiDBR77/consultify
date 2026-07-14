/**
 * QuickActions
 * Hover actions component for quick task/decision management
 * ClickUp-style inline actions
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Flag,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Priority configuration
const PRIORITIES = [
  {
    value: 'low',
    label: { en: 'Low', pl: 'Niski' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
  },
  {
    value: 'medium',
    label: { en: 'Medium', pl: 'Średni' },
    color: 'bg-blue-400',
    textColor: 'text-blue-500',
  },
  {
    value: 'high',
    label: { en: 'High', pl: 'Wysoki' },
    color: 'bg-amber-400',
    textColor: 'text-amber-500',
  },
  {
    value: 'critical',
    label: { en: 'Critical', pl: 'Krytyczny' },
    color: 'bg-danger-500',
    textColor: 'text-danger-500',
  },
];

// Status configuration
const STATUSES = [
  { value: 'todo', label: { en: 'To Do', pl: 'Do zrobienia' }, color: 'bg-slate-400' },
  { value: 'in_progress', label: { en: 'In Progress', pl: 'W trakcie' }, color: 'bg-blue-500' },
  { value: 'review', label: { en: 'Review', pl: 'Przegląd' }, color: 'bg-sky-500' },
  { value: 'done', label: { en: 'Done', pl: 'Ukończone' }, color: 'bg-emerald-500' },
  { value: 'blocked', label: { en: 'Blocked', pl: 'Zablokowane' }, color: 'bg-danger-500' },
];

interface QuickActionsProps {
  // Current values
  status?: string;
  priority?: string;
  assigneeId?: string;
  dueDate?: string;

  // Available options
  users?: { id: string; name: string; avatar?: string }[];

  // Callbacks
  onStatusChange?: (status: string) => void;
  onPriorityChange?: (priority: string) => void;
  onAssigneeChange?: (assigneeId: string | null) => void;
  onDueDateChange?: (date: string | null) => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onStartTimer?: () => void;
  onMarkComplete?: () => void;

  // Display options
  compact?: boolean;
  showTimer?: boolean;
  showComplete?: boolean;
  className?: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  status,
  priority,
  assigneeId,
  dueDate,
  users = [],
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onEdit,
  onDuplicate,
  onDelete,
  onStartTimer,
  onMarkComplete,
  compact = false,
  showTimer = false,
  showComplete = true,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpenDropdown(null);
      setShowMoreMenu(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentPriority = PRIORITIES.find((p) => p.value === priority) || PRIORITIES[1];
  const currentStatus = STATUSES.find((s) => s.value === status) || STATUSES[0];
  const currentAssignee = users.find((u) => u.id === assigneeId);
  const isComplete = status === 'done';

  const DropdownButton: React.FC<{
    id: string;
    icon: React.ReactNode;
    label?: string;
    color?: string;
    children: React.ReactNode;
  }> = ({ id, icon, label, color, children }) => (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdown(openDropdown === id ? null : id);
        }}
        className={`
          flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium
          transition-all hover:bg-slate-100 dark:hover:bg-navy-700
          ${openDropdown === id ? 'bg-slate-100 dark:bg-navy-700' : ''}
          ${color || 'text-slate-600 dark:text-slate-400'}
        `}
        title={label}
      >
        {icon}
        {!compact && label && <span className="hidden sm:inline">{label}</span>}
        <ChevronDown size={12} className="opacity-50" />
      </button>

      <AnimatePresence>
        {openDropdown === id && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 mt-1 min-w-[160px] bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Complete Button */}
      {showComplete && onMarkComplete && (
        <button
          onClick={onMarkComplete}
          className={`
            p-1.5 rounded-lg transition-all
            ${
              isComplete
                ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                : 'text-slate-600 hover:text-emerald-500 hover:bg-emerald-500/10'
            }
          `}
          title={
            isPolish
              ? isComplete
                ? 'Oznacz jako nieukończone'
                : 'Oznacz jako ukończone'
              : isComplete
                ? 'Mark incomplete'
                : 'Mark complete'
          }
        >
          {isComplete ? <CheckCircle2 size={16} /> : <Check size={16} />}
        </button>
      )}

      {/* Status Dropdown */}
      {onStatusChange && (
        <DropdownButton
          id="status"
          icon={<div className={`w-2.5 h-2.5 rounded-full ${currentStatus.color}`} />}
          label={isPolish ? currentStatus.label.pl : currentStatus.label.en}
        >
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                onStatusChange(s.value);
                setOpenDropdown(null);
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700
                ${status === s.value ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
              `}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <span className="text-slate-700 dark:text-slate-300">
                {isPolish ? s.label.pl : s.label.en}
              </span>
            </button>
          ))}
        </DropdownButton>
      )}

      {/* Priority Dropdown */}
      {onPriorityChange && (
        <DropdownButton
          id="priority"
          icon={<Flag size={14} />}
          label={isPolish ? currentPriority.label.pl : currentPriority.label.en}
          color={currentPriority.textColor}
        >
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                onPriorityChange(p.value);
                setOpenDropdown(null);
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700
                ${priority === p.value ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
              `}
            >
              <Flag size={14} className={p.textColor} />
              <span className="text-slate-700 dark:text-slate-300">
                {isPolish ? p.label.pl : p.label.en}
              </span>
            </button>
          ))}
        </DropdownButton>
      )}

      {/* Assignee Dropdown */}
      {onAssigneeChange && users.length > 0 && (
        <DropdownButton
          id="assignee"
          icon={
            currentAssignee ? (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-[10px] font-medium text-white">
                  {currentAssignee.name.charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <User size={14} />
            )
          }
          label={currentAssignee?.name || t('myWork.quickActions.unassigned', 'Unassigned')}
        >
          <button
            onClick={() => {
              onAssigneeChange(null);
              setOpenDropdown(null);
            }}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700
              ${!assigneeId ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
            `}
          >
            <User size={14} className="text-slate-600" />
            <span className="text-slate-700 dark:text-slate-300">
              {t('myWork.quickActions.unassigned2', 'Unassigned')}
            </span>
          </button>
          <div className="border-t border-slate-200 dark:border-navy-600 my-1" />
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                onAssigneeChange(user.id);
                setOpenDropdown(null);
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700
                ${assigneeId === user.id ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
              `}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-slate-700 dark:text-slate-300">{user.name}</span>
            </button>
          ))}
        </DropdownButton>
      )}

      {/* Due Date */}
      {onDueDateChange && (
        <div className="relative">
          <input
            type="date"
            value={dueDate || ''}
            onChange={(e) => onDueDateChange(e.target.value || null)}
            className="
              w-8 h-8 opacity-0 absolute cursor-pointer
            "
          />
          <button
            className={`
              flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium
              transition-all hover:bg-slate-100 dark:hover:bg-navy-700
              ${dueDate ? 'text-slate-700 dark:text-slate-300' : 'text-slate-600 dark:text-slate-500'}
            `}
            title={t('myWork.quickActions.title', 'Set due date')}
          >
            <Calendar size={14} />
            {!compact && dueDate && (
              <span className="hidden sm:inline">
                {new Date(dueDate).toLocaleDateString(
                  t('myWork.quickActions.toLocaleDateString', 'en-US'),
                  {
                    month: 'short',
                    day: 'numeric',
                  }
                )}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Timer Button */}
      {showTimer && onStartTimer && (
        <button
          onClick={onStartTimer}
          className="p-1.5 rounded-lg text-slate-600 hover:text-primary-500 hover:bg-primary-500/10 transition-all"
          title={t('myWork.quickActions.title2', 'Start timer')}
        >
          <Play size={14} />
        </button>
      )}

      {/* More Actions Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-all"
          title={t('myWork.quickActions.title3', 'More actions')}
        >
          <MoreHorizontal size={16} />
        </button>

        <AnimatePresence>
          {showMoreMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full right-0 mt-1 min-w-[140px] bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                >
                  <Pencil size={14} />
                  <span>{t('myWork.quickActions.edit', 'Edit')}</span>
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={() => {
                    onDuplicate();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                >
                  <Copy size={14} />
                  <span>{t('myWork.quickActions.duplicate', 'Duplicate')}</span>
                </button>
              )}
              {onDelete && (
                <>
                  <div className="border-t border-slate-200 dark:border-navy-600 my-1" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                  >
                    <Trash2 size={14} />
                    <span>{t('myWork.quickActions.delete', 'Delete')}</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuickActions;
