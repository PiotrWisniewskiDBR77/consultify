/**
 * MW-DEC-001 — real, persisted alternatives dossier for one decision.
 *
 * Round-trips through POST/PUT/DELETE /api/decisions/:id/alternatives[/:id]
 * (decisionCollaborationService.ts `decision_alternatives` table) instead of
 * the localStorage-faked `alternatives` array DecisionDetailView.tsx keeps
 * today. Frozen (read-only) once the decision reaches a terminal outcome
 * (APPROVED/REJECTED) — enforced by the server (409 `DECISION_FINALIZED`)
 * and mirrored here so the UI does not even offer a control that will 409.
 */
import { AlertTriangle, Lock, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import decisionWorkspaceApi, {
  type CreateAlternativeInput,
  readDecisionApiError,
} from './decisionWorkspaceApi';
import type { DecisionAlternativeDTO } from './types';

export interface DecisionAlternativesSectionProps {
  decisionId: string;
  alternatives: DecisionAlternativeDTO[];
  onChange: (next: DecisionAlternativeDTO[]) => void;
  isFinalized: boolean;
  canEdit: boolean;
  /** Called when a mutation 409s with DECISION_FINALIZED — the decision was
   * finalized by someone else since this page loaded; parent should refetch
   * the full aggregate so the frozen banner/status reflect reality. */
  onFinalizedRace: () => void;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
  }) => Promise<boolean>;
}

const emptyDraft: CreateAlternativeInput = {
  title: '',
  description: '',
  benefits: '',
  drawbacks: '',
  costOrFeasibility: '',
  isRecommended: false,
};

export const DecisionAlternativesSection: React.FC<DecisionAlternativesSectionProps> = ({
  decisionId,
  alternatives,
  onChange,
  isFinalized,
  canEdit,
  onFinalizedRace,
  confirm,
}) => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CreateAlternativeInput>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CreateAlternativeInput>(emptyDraft);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetAddForm = useCallback(() => {
    setAdding(false);
    setDraft(emptyDraft);
    setFormError(null);
  }, []);

  const handleCreate = useCallback(async () => {
    const title = draft.title.trim();
    if (!title || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await decisionWorkspaceApi.postAlternative(decisionId, {
        ...draft,
        title,
      });
      onChange([...alternatives, created]);
      resetAddForm();
    } catch (err) {
      const apiErr = readDecisionApiError(err);
      if (apiErr.data?.code === 'DECISION_FINALIZED') {
        setFormError(
          t(
            'myWork.decisionWorkspace.alternatives.finalizedRace',
            'This decision was just finalized — alternatives are now frozen.'
          )
        );
        onFinalizedRace();
      } else if (apiErr.status === 403) {
        setFormError(
          t(
            'myWork.decisionWorkspace.alternatives.forbidden',
            'Only the decision preparer, owner, or an admin can add alternatives.'
          )
        );
      } else {
        setFormError(
          t('myWork.decisionWorkspace.alternatives.saveFailed', 'Could not save this alternative.')
        );
      }
      // Draft is intentionally kept so the user can retry / copy it out.
    } finally {
      setSubmitting(false);
    }
  }, [alternatives, decisionId, draft, onChange, onFinalizedRace, resetAddForm, submitting, t]);

  const startEdit = useCallback((alt: DecisionAlternativeDTO) => {
    setEditingId(alt.id);
    setEditDraft({
      title: alt.title,
      description: alt.description || '',
      benefits: alt.benefits || '',
      drawbacks: alt.drawbacks || '',
      costOrFeasibility: alt.costOrFeasibility || '',
      isRecommended: alt.isRecommended,
    });
    setRowError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(emptyDraft);
  }, []);

  const handleUpdate = useCallback(
    async (id: string) => {
      const title = editDraft.title.trim();
      if (!title) return;
      setSubmitting(true);
      setRowError(null);
      try {
        const updated = await decisionWorkspaceApi.updateAlternative(decisionId, id, {
          ...editDraft,
          title,
        });
        onChange(alternatives.map((a) => (a.id === id ? updated : a)));
        cancelEdit();
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.data?.code === 'DECISION_FINALIZED') {
          setRowError({
            id,
            message: t(
              'myWork.decisionWorkspace.alternatives.finalizedRace',
              'This decision was just finalized — alternatives are now frozen.'
            ),
          });
          onFinalizedRace();
        } else {
          setRowError({
            id,
            message: t(
              'myWork.decisionWorkspace.alternatives.updateFailed',
              'Could not save your changes.'
            ),
          });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [alternatives, cancelEdit, decisionId, editDraft, onChange, onFinalizedRace, t]
  );

  const handleDelete = useCallback(
    async (alt: DecisionAlternativeDTO) => {
      const ok = await confirm({
        title: t('myWork.decisionWorkspace.alternatives.deleteTitle', 'Delete this alternative?'),
        description: alt.title,
        confirmLabel: t('myWork.decisionWorkspace.alternatives.deleteConfirm', 'Delete'),
        variant: 'danger',
      });
      if (!ok) return;
      setDeletingId(alt.id);
      setRowError(null);
      try {
        await decisionWorkspaceApi.deleteAlternative(decisionId, alt.id);
        onChange(alternatives.filter((a) => a.id !== alt.id));
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.data?.code === 'DECISION_FINALIZED') {
          setRowError({
            id: alt.id,
            message: t(
              'myWork.decisionWorkspace.alternatives.finalizedRace',
              'This decision was just finalized — alternatives are now frozen.'
            ),
          });
          onFinalizedRace();
        } else {
          setRowError({
            id: alt.id,
            message: t('myWork.decisionWorkspace.alternatives.deleteFailed', 'Could not delete.'),
          });
        }
      } finally {
        setDeletingId(null);
      }
    },
    [alternatives, confirm, decisionId, onChange, onFinalizedRace, t]
  );

  return (
    <div className="space-y-2.5">
      {isFinalized ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-[11px] text-c-text-muted">
          <Lock size={12} />
          {t(
            'myWork.decisionWorkspace.alternatives.frozenBanner',
            'This decision is finalized — alternatives are frozen and can no longer be edited.'
          )}
        </div>
      ) : null}

      {alternatives.length === 0 && !adding ? (
        <div className="text-xs text-c-text-muted italic py-1">
          {t('myWork.decisionWorkspace.alternatives.empty', 'No alternatives recorded yet.')}
        </div>
      ) : (
        <ul className="space-y-2">
          {alternatives.map((alt) => (
            <li
              key={alt.id}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2"
            >
              {editingId === alt.id ? (
                <div className="space-y-1.5">
                  <input
                    value={editDraft.title}
                    onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs font-medium text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  />
                  <textarea
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder={t('myWork.decisionWorkspace.alternatives.description', 'Description')}
                    rows={2}
                    className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleUpdate(alt.id)}
                      disabled={!editDraft.title.trim() || submitting}
                      className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface disabled:opacity-40 transition-colors"
                    >
                      {t('myWork.decisionWorkspace.alternatives.save', 'Save')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="h-7 px-2.5 rounded-md text-[11px] text-c-text-muted hover:text-c-text transition-colors"
                    >
                      {t('myWork.decisionWorkspace.alternatives.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {alt.isRecommended ? (
                        <Star size={12} className="shrink-0 text-amber-500 fill-amber-500" />
                      ) : null}
                      <span className="text-xs font-semibold text-c-text truncate">{alt.title}</span>
                    </div>
                    {canEdit && !isFinalized ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(alt)}
                          aria-label={t('myWork.decisionWorkspace.alternatives.edit', 'Edit')}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => void handleDelete(alt)}
                          disabled={deletingId === alt.id}
                          aria-label={t('myWork.decisionWorkspace.alternatives.delete', 'Delete')}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-c-text-muted hover:text-danger-600 hover:bg-danger-500/10 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {alt.description ? (
                    <p className="mt-1 text-[11px] text-c-text-secondary">{alt.description}</p>
                  ) : null}
                  {alt.benefits || alt.drawbacks || alt.costOrFeasibility ? (
                    <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-3">
                      {alt.benefits ? (
                        <div>
                          <span className="font-medium text-c-text-muted">
                            {t('myWork.decisionWorkspace.alternatives.benefits', 'Benefits')}:{' '}
                          </span>
                          <span className="text-c-text-secondary">{alt.benefits}</span>
                        </div>
                      ) : null}
                      {alt.drawbacks ? (
                        <div>
                          <span className="font-medium text-c-text-muted">
                            {t('myWork.decisionWorkspace.alternatives.drawbacks', 'Drawbacks')}:{' '}
                          </span>
                          <span className="text-c-text-secondary">{alt.drawbacks}</span>
                        </div>
                      ) : null}
                      {alt.costOrFeasibility ? (
                        <div>
                          <span className="font-medium text-c-text-muted">
                            {t('myWork.decisionWorkspace.alternatives.cost', 'Cost/feasibility')}:{' '}
                          </span>
                          <span className="text-c-text-secondary">{alt.costOrFeasibility}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
              {rowError?.id === alt.id ? (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>{rowError.message}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !isFinalized ? (
        adding ? (
          <div className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 space-y-1.5">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder={t('myWork.decisionWorkspace.alternatives.titlePlaceholder', 'Alternative title')}
              className="w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs font-medium text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder={t('myWork.decisionWorkspace.alternatives.description', 'Description')}
              rows={2}
              className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-c-text-secondary">
              <input
                type="checkbox"
                checked={!!draft.isRecommended}
                onChange={(e) => setDraft((d) => ({ ...d, isRecommended: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-c-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
              {t('myWork.decisionWorkspace.alternatives.recommended', 'Recommended option')}
            </label>
            {formError ? (
              <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={() => void handleCreate()}
                disabled={!draft.title.trim() || submitting}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface disabled:opacity-40 transition-colors"
              >
                {submitting
                  ? t('myWork.decisionWorkspace.alternatives.saving', 'Saving…')
                  : t('myWork.decisionWorkspace.alternatives.add', 'Add alternative')}
              </button>
              <button
                onClick={resetAddForm}
                className="h-7 px-2 rounded-md text-[11px] text-c-text-muted hover:text-c-text transition-colors"
              >
                <X size={12} className="inline -mt-0.5 mr-0.5" />
                {t('myWork.decisionWorkspace.alternatives.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised border border-dashed border-c-border-subtle transition-colors"
          >
            <Plus size={12} />
            {t('myWork.decisionWorkspace.alternatives.add', 'Add alternative')}
          </button>
        )
      ) : null}
    </div>
  );
};

export default DecisionAlternativesSection;
