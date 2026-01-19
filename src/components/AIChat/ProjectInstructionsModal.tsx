/**
 * ProjectInstructionsModal Component
 *
 * Modal for editing project-specific AI instructions.
 * Allows users to customize how AI responds within a specific project context.
 */

import { Info, Loader2, Save, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatProject, useChatProjectStore } from '../../store/useChatProjectStore';

interface ProjectInstructionsModalProps {
  project: ChatProject;
  isOpen: boolean;
  onClose: () => void;
}

const MAX_INSTRUCTIONS_LENGTH = 4000;

export const ProjectInstructionsModal: React.FC<ProjectInstructionsModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { updateProjectInstructions } = useChatProjectStore();

  const [instructions, setInstructions] = useState(project.instructions || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when project changes
  useEffect(() => {
    setInstructions(project.instructions || '');
    setError(null);
  }, [project.id, project.instructions]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateProjectInstructions(project.id, instructions || null);
      onClose();
    } catch (err: any) {
      console.error('[ProjectInstructionsModal] Save error:', err);
      setError(err.message || t('aiChat.instructions.saveError', 'Failed to save instructions'));
    } finally {
      setIsSaving(false);
    }
  }, [project.id, instructions, updateProjectInstructions, onClose, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Cmd/Ctrl + Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSave();
      }
    },
    [onClose, handleSave]
  );

  if (!isOpen) return null;

  const charsRemaining = MAX_INSTRUCTIONS_LENGTH - instructions.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-navy-900 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
              {t('aiChat.instructions.title', 'Instrukcje projektu')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {project.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Help text */}
          <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t(
                'aiChat.instructions.help',
                'Instrukcje projektu pozwalają dostosować zachowanie AI w kontekście tego projektu. AI będzie uwzględniać te instrukcje we wszystkich rozmowach w tym projekcie.'
              )}
            </p>
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t(
                'aiChat.instructions.placeholder',
                'Np. "Odpowiadaj zawsze po polsku. Skup się na aspektach technicznych. Używaj formalnego tonu."'
              )}
              className={`
                w-full h-48 px-4 py-3 text-sm
                bg-slate-50 dark:bg-navy-800
                border rounded-xl resize-none
                text-slate-900 dark:text-white
                placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-purple-500
                ${
                  isOverLimit
                    ? 'border-red-300 dark:border-red-700'
                    : 'border-slate-200 dark:border-navy-700'
                }
              `}
              autoFocus
            />

            {/* Character counter */}
            <div
              className={`
                absolute bottom-3 right-3 text-xs
                ${
                  isOverLimit
                    ? 'text-red-500'
                    : charsRemaining < 500
                      ? 'text-amber-500'
                      : 'text-slate-400 dark:text-slate-500'
                }
              `}
            >
              {instructions.length} / {MAX_INSTRUCTIONS_LENGTH}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            {t('common.cancel', 'Anuluj')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isOverLimit}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t('common.save', 'Zapisz')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInstructionsModal;
