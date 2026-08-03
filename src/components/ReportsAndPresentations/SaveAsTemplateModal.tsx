/**
 * SaveAsTemplateModal — #83b real "save as template" creator.
 *
 * Replaces the bare window.prompt()/window.confirm() sequence that used to
 * live inline in OutputsAggregateTabContent's row menu (name → prompt,
 * description → prompt, org-scope → confirm). Modal shell copied 1:1 from
 * `MyWork/CreateProgramModal.tsx` (itself copied from
 * `Interview/NewSessionModal.tsx`) — zero new chrome, same neutral CTA
 * (bg-c-text, never crimson) per the UI standard.
 *
 * Visibility model reused as-is (TemplateScope, ReportsAndPresentations/types.ts):
 * 'personal' | 'organization' are settable at creation (POST
 * /api/artifacts/:id/save-as-template body.scope = user|org). 'application'
 * (system-wide) is NOT a creation-time choice in the live backend contract —
 * it is reached later via the submit-for-review → publish pipeline (see
 * POST /api/artifacts/:id/publish-template in artifacts.routes.ts), so the
 * option is shown for context but disabled with an explanatory note instead
 * of silently sending an unsupported scope.
 */

import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { API_URL, getHeaders } from '../../services/api';

export interface SaveAsTemplateSource {
  artifactId: string;
  title: string;
  kind: 'document' | 'sheet' | 'presentation';
}

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: SaveAsTemplateSource | null;
  onSaved: (templateArtifactId: string | null) => void;
}

type VisibilityChoice = 'personal' | 'organization';

export const SaveAsTemplateModal: React.FC<SaveAsTemplateModalProps> = ({
  isOpen,
  onClose,
  source,
  onSaved,
}) => {
  const isPolish = !!(typeof navigator !== 'undefined' && navigator.language?.startsWith('pl'));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityChoice>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(source ? `${source.title} Template` : '');
    setDescription('');
    setVisibility('personal');
  }, [isOpen, source]);

  if (!isOpen || !source) return null;

  const typeLabel =
    source.kind === 'presentation'
      ? isPolish
        ? 'Prezentacja'
        : 'Presentation'
      : source.kind === 'sheet'
        ? isPolish
          ? 'Arkusz'
          : 'Sheet'
        : isPolish
          ? 'Dokument'
          : 'Document';

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(isPolish ? 'Podaj nazwę wzorca' : 'Template name is required');
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading(isPolish ? 'Tworzenie wzorca…' : 'Creating template…');
    try {
      const res = await fetch(`${API_URL}/artifacts/${source.artifactId}/save-as-template`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          scope: visibility === 'organization' ? 'org' : 'user',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          String(
            err?.error || (isPolish ? 'Nie udało się zapisać wzorca' : 'Failed to save template')
          )
        );
      }
      const payload = (await res.json().catch(() => ({}))) as { data?: { artifactId?: string } };
      const templateArtifactId =
        typeof payload?.data?.artifactId === 'string' ? payload.data.artifactId : null;
      toast.success(isPolish ? 'Zapisano jako wzorzec' : 'Saved as template', { id: toastId });
      onSaved(templateArtifactId);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message || (isPolish ? 'Nie udało się zapisać wzorca' : 'Failed to save template'),
        { id: toastId }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div>
              <h2 className="text-slate-900 dark:text-white font-semibold text-lg">
                {isPolish ? 'Zapisz jako wzorzec' : 'Save as template'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {isPolish ? `Na podstawie: ${source.title}` : `Based on: ${source.title}`}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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
                  isPolish ? 'np. Raport tygodniowy — wzorzec' : 'e.g. Weekly report — template'
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

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'Typ' : 'Type'}
              </label>
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300">
                {typeLabel}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'Dostępność' : 'Availability'}
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-navy-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800">
                  <input
                    type="radio"
                    name="template-visibility"
                    checked={visibility === 'personal'}
                    onChange={() => setVisibility('personal')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">
                      {isPolish ? 'Prywatny' : 'Private'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Widoczny tylko dla Ciebie' : 'Visible only to you'}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-navy-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800">
                  <input
                    type="radio"
                    name="template-visibility"
                    checked={visibility === 'organization'}
                    onChange={() => setVisibility('organization')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">
                      {isPolish ? 'Organizacyjny' : 'Organization'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {isPolish
                        ? 'Widoczny dla całej organizacji (jako szkic — do zatwierdzenia)'
                        : 'Visible to the whole organization (as a draft — pending review)'}
                    </span>
                  </span>
                </label>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200/60 dark:border-navy-700/60 opacity-60">
                  <input type="radio" name="template-visibility" disabled className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? 'Systemowy' : 'System'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {isPolish
                        ? 'Dostępny po zatwierdzeniu (Wyślij do przeglądu → Publikuj)'
                        : 'Reached after approval (Submit for review → Publish)'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-c-text hover:bg-c-text-secondary text-c-bg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isPolish ? 'Utwórz' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SaveAsTemplateModal;
