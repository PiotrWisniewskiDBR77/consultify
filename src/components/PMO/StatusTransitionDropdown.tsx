/**
 * StatusTransitionDropdown
 *
 * Reusable component for initiative status transitions.
 * Shows only valid transitions based on StatusMachine rules.
 * Handles confirmation dialogs and reason input for specific transitions.
 */

import {
  AlertTriangle,
  Archive,
  Ban,
  Check,
  ChevronDown,
  Clock,
  FileCheck,
  Pause,
  Play,
  Rocket,
  Send,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { getLocalizedStatusLabel } from '../../services/initiativeLifecycle';
import { InitiativeStatus, StatusTransition } from '../../types';

// Status colors and icons mapping
const STATUS_CONFIG: Partial<
  Record<
    InitiativeStatus,
    {
      color: string;
      bgColor: string;
      darkBgColor: string;
      icon: React.ReactNode;
      label: string;
    }
  >
> = {
  [InitiativeStatus.DRAFT]: {
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100',
    darkBgColor: 'dark:bg-slate-800',
    icon: <Clock size={14} />,
    label: 'Draft',
  },
  [InitiativeStatus.PENDING_APPROVAL]: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100',
    darkBgColor: 'dark:bg-blue-900/30',
    icon: <FileCheck size={14} />,
    label: 'Planning',
  },
  [InitiativeStatus.PENDING_APPROVAL]: {
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100',
    darkBgColor: 'dark:bg-amber-900/30',
    icon: <Send size={14} />,
    label: 'In Review',
  },
  [InitiativeStatus.APPROVED]: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100',
    darkBgColor: 'dark:bg-emerald-900/30',
    icon: <Check size={14} />,
    label: 'Approved',
  },
  [InitiativeStatus.IN_EXECUTION]: {
    color: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100',
    darkBgColor: 'dark:bg-primary-900/30',
    icon: <Rocket size={14} />,
    label: 'Executing',
  },
  [InitiativeStatus.IN_EXECUTION]: {
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-100',
    darkBgColor: 'dark:bg-danger-900/30',
    icon: <Pause size={14} />,
    label: 'Blocked',
  },
  [InitiativeStatus.CLOSED]: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100',
    darkBgColor: 'dark:bg-green-900/30',
    icon: <Check size={14} />,
    label: 'Done',
  },
  [InitiativeStatus.REJECTED]: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-navy-800',
    darkBgColor: 'dark:bg-gray-800',
    icon: <Ban size={14} />,
    label: 'Cancelled',
  },
  [InitiativeStatus.CLOSED]: {
    color: 'text-gray-500 dark:text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-navy-800',
    darkBgColor: 'dark:bg-gray-900',
    icon: <Archive size={14} />,
    label: 'Archived',
  },
};

interface StatusTransitionDropdownProps {
  initiativeId: string;
  currentStatus: InitiativeStatus;
  charterCompleteness?: number;
  onStatusChange?: (
    newStatus: InitiativeStatus,
    moduleTransition?: { crossesModule: boolean; fromModule: string; toModule: string }
  ) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const StatusTransitionDropdown: React.FC<StatusTransitionDropdownProps> = ({
  initiativeId,
  currentStatus,
  charterCompleteness,
  onStatusChange,
  disabled = false,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allowedTransitions, setAllowedTransitions] = useState<StatusTransition[]>([]);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<InitiativeStatus | null>(null);
  const [reason, setReason] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = STATUS_CONFIG[currentStatus] ||
    STATUS_CONFIG[InitiativeStatus.DRAFT] || {
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100',
      darkBgColor: 'dark:bg-slate-800',
      icon: <Clock size={14} />,
      label: 'Draft',
    };

  // Fetch allowed transitions
  useEffect(() => {
    const fetchTransitions = async () => {
      try {
        const response = await Api.get(`/initiatives/${initiativeId}/transitions`);
        setAllowedTransitions(response.allowedTransitions || []);
      } catch (error) {
        console.error('Failed to fetch transitions:', error);
        setAllowedTransitions([]);
      }
    };

    if (initiativeId) {
      fetchTransitions();
    }
  }, [initiativeId, currentStatus]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTransitionClick = (transition: StatusTransition) => {
    setPendingStatus(transition.status);
    setIsOpen(false);

    if (transition.requiresReason) {
      setShowReasonModal(true);
    } else if (transition.requiresConfirmation) {
      setShowConfirmModal(true);
    } else {
      executeTransition(transition.status);
    }
  };

  const executeTransition = async (newStatus: InitiativeStatus, transitionReason?: string) => {
    setIsLoading(true);
    try {
      const response = await Api.patch(`/initiatives/${initiativeId}/status`, {
        status: newStatus,
        reason: transitionReason,
      });

      if (response.success) {
        toast.success(
          t('initiatives.toast.statusChangedTo', {
            status: getLocalizedStatusLabel(newStatus, t),
            defaultValue: `Status changed to ${getLocalizedStatusLabel(newStatus, t)}`,
          })
        );
        onStatusChange?.(newStatus, response.initiative?.moduleTransition);
      } else {
        toast.error(response.error || 'Failed to change status');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to change status';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setShowReasonModal(false);
      setShowConfirmModal(false);
      setPendingStatus(null);
      setReason('');
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  return (
    <>
      <div ref={dropdownRef} className={`relative inline-block ${className}`}>
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled || isLoading}
          className={`
                        flex items-center gap-1.5 rounded-lg font-medium transition-all
                        ${sizeClasses[size]}
                        ${config.bgColor} ${config.darkBgColor} ${config.color}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}
                        ${isLoading ? 'animate-pulse' : ''}
                    `}
        >
          {React.cloneElement(config.icon as any, { size: iconSize })}
          {showLabel && <span>{getLocalizedStatusLabel(currentStatus, t)}</span>}
          {!disabled && allowedTransitions.length > 0 && (
            <ChevronDown
              size={iconSize}
              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {/* Dropdown Menu */}
        {isOpen && allowedTransitions.length > 0 && (
          <div className="absolute z-overlay mt-1 w-48 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 shadow-lg overflow-hidden">
            <div className="py-1">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500 font-semibold">
                Change Status To
              </div>
              {allowedTransitions.map((transition) => {
                const transitionConfig = STATUS_CONFIG[transition.status];
                return (
                  <button
                    key={transition.status}
                    onClick={() => handleTransitionClick(transition)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span
                      className={`${transitionConfig?.color || 'text-slate-600 dark:text-slate-400'}`}
                    >
                      {transitionConfig?.icon}
                    </span>
                    <span className="flex-1 text-navy-900 dark:text-white">{transition.label}</span>
                    {transition.requiresReason && (
                      <AlertTriangle size={12} className="text-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Charter completeness warning */}
            {charterCompleteness !== undefined && charterCompleteness < 60 && (
              <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} />
                  <span>Charter {charterCompleteness}% - min 60% for Review</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reason Modal */}
      {showReasonModal && pendingStatus && (
        <div className="fixed inset-0 z-toast flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2">
              {pendingStatus === InitiativeStatus.IN_EXECUTION
                ? 'Block Initiative'
                : pendingStatus === InitiativeStatus.REJECTED
                  ? 'Cancel Initiative'
                  : 'Provide Reason'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {pendingStatus === InitiativeStatus.IN_EXECUTION
                ? 'Please provide a reason for blocking this initiative.'
                : pendingStatus === InitiativeStatus.REJECTED
                  ? 'Please provide a reason for cancelling this initiative.'
                  : 'Please provide additional information for this status change.'}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setPendingStatus(null);
                  setReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeTransition(pendingStatus, reason)}
                disabled={!reason.trim() || isLoading}
                className="px-4 py-2 bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && pendingStatus && (
        <div className="fixed inset-0 z-toast flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              {pendingStatus === InitiativeStatus.CLOSED ? (
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="text-green-600 dark:text-green-400" size={24} />
                </div>
              ) : pendingStatus === InitiativeStatus.CLOSED ? (
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Archive className="text-gray-600 dark:text-gray-400" size={24} />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                  {pendingStatus === InitiativeStatus.CLOSED
                    ? 'Complete Initiative'
                    : pendingStatus === InitiativeStatus.CLOSED
                      ? 'Archive Initiative'
                      : 'Confirm Status Change'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {pendingStatus === InitiativeStatus.CLOSED
                    ? 'Mark this initiative as completed?'
                    : pendingStatus === InitiativeStatus.CLOSED
                      ? 'Move this initiative to archive?'
                      : t('initiatives.confirmStatusChangeTo', {
                          status: getLocalizedStatusLabel(pendingStatus, t),
                          defaultValue: `Change status to ${getLocalizedStatusLabel(pendingStatus, t)}?`,
                        })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingStatus(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => executeTransition(pendingStatus)}
                disabled={isLoading}
                className={`px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${
                  pendingStatus === InitiativeStatus.CLOSED
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                }`}
              >
                {isLoading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatusTransitionDropdown;
