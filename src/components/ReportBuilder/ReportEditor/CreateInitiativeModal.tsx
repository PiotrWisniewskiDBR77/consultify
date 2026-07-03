/**
 * CreateInitiativeModal
 *
 * Modal dialog for creating an initiative from a report section block.
 * Pre-fills title from the section title and description from section content.
 */

import { Check, Loader2, Target, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '../../../services/api';

// ==========================================
// TYPES
// ==========================================

interface CreateInitiativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  sectionKey: string;
  sectionTitle: string;
  sectionContent?: string;
  isPl: boolean;
}

// ==========================================
// COMPONENT
// ==========================================

export const CreateInitiativeModal: React.FC<CreateInitiativeModalProps> = ({
  isOpen,
  onClose,
  reportId,
  sectionKey,
  sectionTitle,
  sectionContent,
  isPl,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(sectionTitle || '');
      setDescription(sectionContent ? sectionContent.slice(0, 300) : '');
      setSubmitting(false);
      setSuccess(false);
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen, sectionTitle, sectionContent]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      toast.error(isPl ? 'Tytuł jest wymagany' : 'Title is required');
      return;
    }
    try {
      setSubmitting(true);
      await Api.post(`/report-builder/${reportId}/sections/${sectionKey}/create-initiative`, {
        title: title.trim(),
        description: description.trim(),
      });
      setSuccess(true);
      toast.success(isPl ? 'Inicjatywa utworzona' : 'Initiative created');
      setTimeout(() => onClose(), 800);
    } catch {
      toast.error(isPl ? 'Nie udało się utworzyć inicjatywy' : 'Failed to create initiative');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, reportId, sectionKey, isPl, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-navy-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <div className="p-2 rounded-lg bg-primary-500/10">
            <Target className="h-5 w-5 text-primary-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-100 flex-1">
            {isPl ? 'Utwórz inicjatywę' : 'Create Initiative'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {isPl ? 'Tytuł' : 'Title'}
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPl ? 'Nazwa inicjatywy…' : 'Initiative name…'}
              disabled={submitting || success}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {isPl ? 'Opis' : 'Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isPl ? 'Opis inicjatywy…' : 'Initiative description…'}
              rows={5}
              disabled={submitting || success}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/30 disabled:opacity-50 resize-none transition-colors"
            />
          </div>

          <p className="text-xs text-gray-600">
            {isPl
              ? 'Inicjatywa zostanie powiązana z tym raportem i pojawi się w module Wykonanie.'
              : 'The initiative will be linked to this report and appear in the Execution module.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || success || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50
              bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <Check className="h-4 w-4" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            {success
              ? isPl
                ? 'Utworzono!'
                : 'Created!'
              : isPl
                ? 'Utwórz inicjatywę'
                : 'Create Initiative'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateInitiativeModal;
