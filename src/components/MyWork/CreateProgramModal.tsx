/**
 * CreateProgramModal — Zwornik D3 minimal program CRUD (create/rename).
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md §D3. Backend
 * already live (V4-INIT-02 CRUD at /api/initiatives/programs, see
 * `pmo/initiatives.routes.ts`) — this is only the missing UI to reach it.
 * Modal shell copied 1:1 from `Interview/NewSessionModal.tsx` (backdrop +
 * centered card + header/footer) — zero new chrome, same neutral CTA
 * (bg-c-text, never crimson) per the UI standard.
 */

import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

export interface ProgramSummary {
  id: string;
  name: string;
  description?: string | null;
  parentProgramId?: string | null;
  status?: string;
}

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (program: any) => void;
  /** All programs — used to populate the "parent program" select and to exclude self when editing. */
  programs: ProgramSummary[];
  /** When set, the modal edits this program instead of creating a new one. */
  editing?: ProgramSummary | null;
}

const STATUS_OPTIONS = ['active', 'on_hold', 'completed', 'cancelled'] as const;

export const CreateProgramModal: React.FC<CreateProgramModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  programs,
  editing = null,
}) => {
  const isPolish = !!(typeof navigator !== 'undefined' && navigator.language?.startsWith('pl'));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentProgramId, setParentProgramId] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name || '');
    setDescription(editing?.description || '');
    setParentProgramId(editing?.parentProgramId || '');
    setStatus(editing?.status || 'active');
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const isEdit = !!editing;
  const selectableParents = programs.filter((p) => p.id !== editing?.id);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(isPolish ? 'Podaj nazwę programu' : 'Program name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        parentProgramId: parentProgramId || null,
        status,
      };
      const saved = isEdit
        ? await Api.updateProgram(editing!.id, payload)
        : await Api.createProgram(payload);
      toast.success(
        isEdit
          ? isPolish
            ? 'Program zaktualizowany'
            : 'Program updated'
          : isPolish
            ? 'Program utworzony'
            : 'Program created'
      );
      onSaved(saved);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message || (isPolish ? 'Nie udało się zapisać programu' : 'Failed to save program')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">
                {isEdit
                  ? isPolish
                    ? 'Edytuj program'
                    : 'Edit program'
                  : isPolish
                    ? 'Nowy program'
                    : 'New program'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isPolish
                  ? 'Program grupuje wiele projektów pod wspólnym rollupem.'
                  : 'A program groups multiple projects under a shared rollup.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'Nazwa' : 'Name'} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isPolish ? 'np. Transformacja Cyfrowa 2026' : 'e.g. Digital Transformation 2026'
                }
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm placeholder-slate-500"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'Opis (opcjonalnie)' : 'Description (optional)'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm placeholder-slate-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Status' : 'Status'}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Program nadrzędny' : 'Parent program'}
                </label>
                <select
                  value={parentProgramId}
                  onChange={(e) => setParentProgramId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="">{isPolish ? '— Brak —' : '— None —'}</option>
                  {selectableParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isEdit ? (isPolish ? 'Zapisz' : 'Save') : isPolish ? 'Utwórz' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateProgramModal;
