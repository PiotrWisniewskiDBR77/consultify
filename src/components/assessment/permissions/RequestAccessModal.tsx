/**
 * RequestAccessModal
 *
 * Modal for requesting edit/manager access to an assessment.
 * Shown when a viewer clicks on the locked Edit button.
 *
 * Features:
 * - Role selection (Editor or Manager)
 * - Justification text area
 * - Priority selection
 * - Submit to admin for approval
 */

import { AlertCircle, Edit3, Loader2, Lock, Send, Settings, X } from 'lucide-react';
import React, { useState } from 'react';

import { CreateAccessRequestParams } from './useAssessmentPermissions';

// ==========================================
// TYPES
// ==========================================

interface RequestAccessModalProps {
  assessmentId: string;
  assessmentName?: string;
  ownerName?: string;
  ownerEmail?: string;
  currentRole: string;
  onClose: () => void;
  onSubmit: (params: CreateAccessRequestParams) => Promise<void>;
}

type RequestedRole = 'editor' | 'manager';
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

// ==========================================
// CONSTANTS
// ==========================================

const ROLE_OPTIONS: {
  value: RequestedRole;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'editor',
    label: 'Editor Access',
    description: 'Can edit assessment content and add comments',
    icon: Edit3,
  },
  {
    value: 'manager',
    label: 'Manager Access',
    description: 'Can manage workflow, team, and generate reports',
    icon: Settings,
  },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'text-slate-500' },
  { value: 'NORMAL', label: 'Normal', color: 'text-blue-500' },
  { value: 'HIGH', label: 'High', color: 'text-amber-500' },
  { value: 'URGENT', label: 'Urgent', color: 'text-danger-500' },
];

// ==========================================
// COMPONENT
// ==========================================

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  assessmentId,
  assessmentName,
  ownerName,
  ownerEmail,
  currentRole,
  onClose,
  onSubmit,
}) => {
  const [requestedRole, setRequestedRole] = useState<RequestedRole>('editor');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!justification.trim()) {
      setError('Please provide a justification for your request');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onSubmit({
        requestedRole,
        justification: justification.trim(),
        priority,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                Request Edit Access
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You don't have permission to edit this assessment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Assessment Info */}
          <div className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-700">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Assessment:</span>
                <span className="font-medium text-navy-900 dark:text-white">
                  {assessmentName || 'Unnamed Assessment'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Your role:</span>
                <span className="font-medium text-navy-900 dark:text-white capitalize">
                  {currentRole}
                </span>
              </div>
              {(ownerName || ownerEmail) && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Owner:</span>
                  <span className="font-medium text-navy-900 dark:text-white">
                    {ownerName || ownerEmail}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Request Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = requestedRole === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRequestedRole(option.value)}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all
                      ${
                        isSelected
                          ? 'border-slate-500 dark:border-c-border bg-slate-100/60 dark:bg-white/[0.07]'
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-400 dark:hover:border-c-border'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected
                            ? 'bg-slate-200 dark:bg-white/10'
                            : 'bg-slate-100 dark:bg-white/10'
                        }`}
                      >
                        <Icon
                          size={18}
                          className={
                            isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                          }
                        />
                      </div>
                      <div>
                        <p
                          className={`font-medium ${
                            isSelected
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {option.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Priority
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${
                      priority === option.value
                        ? `${option.color} bg-current/10 ring-2 ring-current/30`
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Justification */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Justification <span className="text-danger-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why you need access to this assessment..."
              rows={4}
              className="w-full px-3 py-2 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid outline-none resize-none"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your request will be sent to the assessment owner for approval.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-600 dark:text-danger-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !justification.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Request
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="px-6 pb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">What happens next?</p>
                <p className="text-blue-600 dark:text-blue-400">
                  The assessment owner will receive a notification about your request. You'll be
                  notified once they approve or decline your request.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestAccessModal;
