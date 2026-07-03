/**
 * DelegationModal
 * Modal for delegating decisions and requesting input from others
 * Supports: full delegation, review request, input request, co-decision
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  Loader2,
  MessageSquare,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';

export type DelegationType = 'full' | 'review' | 'input' | 'co_decide';

interface DelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  decisionId: string;
  decisionTitle: string;
  availableUsers: { id: string; name: string; email?: string; avatar?: string }[];
  currentDeciderId?: string;
  onDelegated?: () => void;
}

const DELEGATION_TYPES: {
  type: DelegationType;
  label: { en: string; pl: string };
  description: { en: string; pl: string };
  icon: React.ElementType;
  color: string;
}[] = [
  {
    type: 'full',
    label: { en: 'Full Delegation', pl: 'Pełna delegacja' },
    description: {
      en: 'Transfer decision ownership to another person',
      pl: 'Przekaż decyzję innej osobie',
    },
    icon: ArrowRight,
    color: 'text-primary-500 bg-primary-500/10',
  },
  {
    type: 'review',
    label: { en: 'Request Review', pl: 'Prośba o przegląd' },
    description: {
      en: 'Ask someone to review before you decide',
      pl: 'Poproś o przegląd przed podjęciem decyzji',
    },
    icon: CheckCircle,
    color: 'text-blue-500 bg-blue-500/10',
  },
  {
    type: 'input',
    label: { en: 'Request Input', pl: 'Prośba o opinię' },
    description: {
      en: 'Gather opinions from others',
      pl: 'Zbierz opinie od innych',
    },
    icon: MessageSquare,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  {
    type: 'co_decide',
    label: { en: 'Co-Decision', pl: 'Współdecyzja' },
    description: {
      en: 'Require approval from another person',
      pl: 'Wymagaj zatwierdzenia od innej osoby',
    },
    icon: Users,
    color: 'text-amber-500 bg-amber-500/10',
  },
];

export const DelegationModal: React.FC<DelegationModalProps> = ({
  isOpen,
  onClose,
  decisionId,
  decisionTitle,
  availableUsers,
  currentDeciderId,
  onDelegated,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [delegationType, setDelegationType] = useState<DelegationType>('input');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter out current decider from available users for full delegation
  const filteredUsers = availableUsers.filter((u) => u.id !== currentDeciderId);

  const handleUserToggle = (userId: string) => {
    if (delegationType === 'full' || delegationType === 'co_decide') {
      // Single selection for full delegation and co-decide
      setSelectedUsers([userId]);
    } else {
      // Multi-selection for input and review
      setSelectedUsers((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleSubmit = async () => {
    // Validate required fields before API call
    if (!decisionId) {
      toast.error(isPolish ? 'Brak identyfikatora decyzji' : 'Missing decision ID');
      return;
    }

    if (selectedUsers.length === 0) {
      toast.error(isPolish ? 'Wybierz co najmniej jedną osobę' : 'Select at least one person');
      return;
    }

    // Validate delegatee exists
    const delegateeId = selectedUsers[0];
    if (
      (delegationType === 'full' ||
        delegationType === 'co_decide' ||
        delegationType === 'review') &&
      !delegateeId
    ) {
      toast.error(isPolish ? 'Wybierz osobę do delegacji' : 'Select a person to delegate to');
      return;
    }

    try {
      setSubmitting(true);

      if (delegationType === 'input') {
        // Request input from multiple users
        await Api.post(`/decisions/${decisionId}/request-input`, {
          userIds: selectedUsers,
          comment,
        });
        toast.success(
          isPolish
            ? `Wysłano prośbę o opinię do ${selectedUsers.length} osób`
            : `Input requested from ${selectedUsers.length} people`
        );
      } else {
        // Delegate to single user
        await Api.post(`/decisions/${decisionId}/delegate`, {
          toUserId: delegateeId,
          delegationType,
          reason,
          comment,
        });

        const typeLabels: Record<DelegationType, { en: string; pl: string }> = {
          full: { en: 'Decision delegated', pl: 'Decyzja przekazana' },
          review: { en: 'Review requested', pl: 'Prośba o przegląd wysłana' },
          input: { en: 'Input requested', pl: 'Prośba o opinię wysłana' },
          co_decide: { en: 'Co-decision requested', pl: 'Prośba o współdecyzję wysłana' },
        };

        toast.success(isPolish ? typeLabels[delegationType].pl : typeLabels[delegationType].en);
      }

      onDelegated?.();
      onClose();
    } catch (error: any) {
      console.error('[DelegationModal] Delegation failed:', error);
      const serverMessage = error?.response?.data?.error;
      toast.error(
        serverMessage ||
          (isPolish
            ? 'Nie udało się wysłać żądania delegacji'
            : 'Failed to send delegation request')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDelegationType('input');
    setSelectedUsers([]);
    setComment('');
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-overlay flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-500/10">
                <Share2 size={20} className="text-primary-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {isPolish ? 'Deleguj / Poproś o opinię' : 'Delegate / Request Input'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">
                  {decisionTitle}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Delegation Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Typ akcji' : 'Action Type'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DELEGATION_TYPES.map((dt) => {
                  const Icon = dt.icon;
                  return (
                    <button
                      key={dt.type}
                      onClick={() => {
                        setDelegationType(dt.type);
                        setSelectedUsers([]);
                      }}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        delegationType === dt.type
                          ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500'
                          : 'border-slate-200 dark:border-navy-600 hover:border-slate-300 dark:hover:border-navy-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1.5 rounded-lg ${dt.color}`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {isPolish ? dt.label.pl : dt.label.en}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? dt.description.pl : dt.description.en}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {delegationType === 'input'
                  ? isPolish
                    ? 'Wybierz osoby (można wiele)'
                    : 'Select people (multiple allowed)'
                  : isPolish
                    ? 'Wybierz osobę'
                    : 'Select person'}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserToggle(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      selectedUsers.includes(user.id)
                        ? 'border-primary-500 bg-primary-500/5'
                        : 'border-slate-200 dark:border-navy-600 hover:border-slate-300 dark:hover:border-navy-500'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <span className="text-xs font-medium text-slate-900 dark:text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {user.name}
                      </p>
                      {user.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      )}
                    </div>
                    {selectedUsers.includes(user.id) && (
                      <CheckCircle size={18} className="text-primary-500" />
                    )}
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center py-4">
                    {isPolish ? 'Brak dostępnych użytkowników' : 'No users available'}
                  </p>
                )}
              </div>
            </div>

            {/* Reason (for full delegation) */}
            {delegationType === 'full' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {isPolish ? 'Powód przekazania' : 'Reason for delegation'}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isPolish
                      ? 'np. Nieobecność, brak kompetencji...'
                      : 'e.g., Absence, lack of expertise...'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-primary-500"
                />
              </div>
            )}

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {isPolish ? 'Wiadomość (opcjonalnie)' : 'Message (optional)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  delegationType === 'input'
                    ? isPolish
                      ? 'Co chcesz wiedzieć? Jakie pytania masz?'
                      : 'What do you want to know? What questions do you have?'
                    : isPolish
                      ? 'Dodatkowe informacje dla odbiorcy...'
                      : 'Additional information for the recipient...'
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-primary-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedUsers.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text text-c-bg font-medium hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>
                {delegationType === 'full'
                  ? isPolish
                    ? 'Przekaż'
                    : 'Delegate'
                  : delegationType === 'input'
                    ? isPolish
                      ? 'Wyślij prośbę'
                      : 'Send Request'
                    : isPolish
                      ? 'Wyślij'
                      : 'Send'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DelegationModal;
