/**
 * MW-DEC-001 — real, persisted risk register for one decision.
 *
 * Round-trips through POST/PUT/DELETE /api/decisions/:id/risks[/:id]
 * (decisionCollaborationService.ts `decision_risks` table) instead of the
 * localStorage-faked `risks` array DecisionDetailView.tsx keeps today.
 * Frozen (read-only) once the decision reaches a terminal outcome
 * (APPROVED/REJECTED) — same freeze rule as alternatives.
 */
import { AlertTriangle, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import decisionWorkspaceApi, {
  type CreateRiskInput,
  readDecisionApiError,
} from './decisionWorkspaceApi';
import type { DecisionRiskDTO, WorkspaceUserRef } from './types';
import { resolveUserName } from './workspaceHelpers';

export interface DecisionRisksSectionProps {
  decisionId: string;
  risks: DecisionRiskDTO[];
  onChange: (next: DecisionRiskDTO[]) => void;
  isFinalized: boolean;
  canEdit: boolean;
  onFinalizedRace: () => void;
  usersById: Map<string, WorkspaceUserRef>;
  users: WorkspaceUserRef[];
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
  }) => Promise<boolean>;
}

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const LIKELIHOODS = ['LOW', 'MEDIUM', 'HIGH'] as const;

const emptyDraft: CreateRiskInput = {
  description: '',
  severity: 'MEDIUM',
  likelihood: 'MEDIUM',
  mitigation: '',
  ownerId: null,
};

const severityTone: Record<string, string> = {
  LOW: 'text-c-text-secondary',
  MEDIUM: 'text-amber-600 dark:text-amber-400',
  HIGH: 'text-orange-600 dark:text-orange-400',
  CRITICAL: 'text-danger-600 dark:text-danger-400',
};

export const DecisionRisksSection: React.FC<DecisionRisksSectionProps> = ({
  decisionId,
  risks,
  onChange,
  isFinalized,
  canEdit,
  onFinalizedRace,
  usersById,
  users,
  confirm,
}) => {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CreateRiskInput>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CreateRiskInput>(emptyDraft);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetAddForm = useCallback(() => {
    setAdding(false);
    setDraft(emptyDraft);
    setFormError(null);
  }, []);

  const handleCreate = useCallback(async () => {
    const description = draft.description.trim();
    if (!description || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await decisionWorkspaceApi.postRisk(decisionId, { ...draft, description });
      onChange([...risks, created]);
      resetAddForm();
    } catch (err) {
      const apiErr = readDecisionApiError(err);
      if (apiErr.data?.code === 'DECISION_FINALIZED') {
        setFormError(
          t(
            'myWork.decisionWorkspace.risks.finalizedRace',
            'This decision was just finalized — risks are now frozen.'
          )
        );
        onFinalizedRace();
      } else if (apiErr.status === 403) {
        setFormError(
          t(
            'myWork.decisionWorkspace.risks.forbidden',
            'Only the decision preparer, owner, or an admin can add risks.'
          )
        );
      } else {
        setFormError(t('myWork.decisionWorkspace.risks.saveFailed', 'Could not save this risk.'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [decisionId, draft, onChange, onFinalizedRace, resetAddForm, risks, submitting, t]);

  const startEdit = useCallback((risk: DecisionRiskDTO) => {
    setEditingId(risk.id);
    setEditDraft({
      description: risk.description,
      severity: risk.severity,
      likelihood: risk.likelihood,
      mitigation: risk.mitigation || '',
      ownerId: risk.ownerId,
    });
    setRowError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(emptyDraft);
  }, []);

  const handleUpdate = useCallback(
    async (id: string) => {
      const description = editDraft.description.trim();
      if (!description) return;
      setSubmitting(true);
      setRowError(null);
      try {
        const updated = await decisionWorkspaceApi.updateRisk(decisionId, id, {
          ...editDraft,
          description,
        });
        onChange(risks.map((r) => (r.id === id ? updated : r)));
        cancelEdit();
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.data?.code === 'DECISION_FINALIZED') {
          setRowError({
            id,
            message: t(
              'myWork.decisionWorkspace.risks.finalizedRace',
              'This decision was just finalized — risks are now frozen.'
            ),
          });
          onFinalizedRace();
        } else {
          setRowError({
            id,
            message: t(
              'myWork.decisionWorkspace.risks.updateFailed',
              'Could not save your changes.'
            ),
          });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [cancelEdit, decisionId, editDraft, onChange, onFinalizedRace, risks, t]
  );

  const handleDelete = useCallback(
    async (risk: DecisionRiskDTO) => {
      const ok = await confirm({
        title: t('myWork.decisionWorkspace.risks.deleteTitle', 'Delete this risk?'),
        description: risk.description,
        confirmLabel: t('myWork.decisionWorkspace.risks.deleteConfirm', 'Delete'),
        variant: 'danger',
      });
      if (!ok) return;
      setDeletingId(risk.id);
      setRowError(null);
      try {
        await decisionWorkspaceApi.deleteRisk(decisionId, risk.id);
        onChange(risks.filter((r) => r.id !== risk.id));
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.data?.code === 'DECISION_FINALIZED') {
          setRowError({
            id: risk.id,
            message: t(
              'myWork.decisionWorkspace.risks.finalizedRace',
              'This decision was just finalized — risks are now frozen.'
            ),
          });
          onFinalizedRace();
        } else {
          setRowError({
            id: risk.id,
            message: t('myWork.decisionWorkspace.risks.deleteFailed', 'Could not delete.'),
          });
        }
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, decisionId, onChange, onFinalizedRace, risks, t]
  );

  return (
    <div className="space-y-2.5">
      {isFinalized ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 py-1.5 text-[11px] text-c-text-muted">
          <Lock size={12} />
          {t(
            'myWork.decisionWorkspace.risks.frozenBanner',
            'This decision is finalized — risks are frozen and can no longer be edited.'
          )}
        </div>
      ) : null}

      {risks.length === 0 && !adding ? (
        <div className="text-xs text-c-text-muted italic py-1">
          {t('myWork.decisionWorkspace.risks.empty', 'No risks recorded yet.')}
        </div>
      ) : (
        <ul className="space-y-2">
          {risks.map((risk) => (
            <li
              key={risk.id}
              className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2"
            >
              {editingId === risk.id ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editDraft.severity}
                      onChange={(e) => setEditDraft((d) => ({ ...d, severity: e.target.value }))}
                      className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.likelihood}
                      onChange={(e) => setEditDraft((d) => ({ ...d, likelihood: e.target.value }))}
                      className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      {LIKELIHOODS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={editDraft.mitigation}
                    onChange={(e) => setEditDraft((d) => ({ ...d, mitigation: e.target.value }))}
                    placeholder={t('myWork.decisionWorkspace.risks.mitigation', 'Mitigation')}
                    rows={2}
                    className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleUpdate(risk.id)}
                      disabled={!editDraft.description.trim() || submitting}
                      className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface disabled:opacity-40 transition-colors"
                    >
                      {t('myWork.decisionWorkspace.risks.save', 'Save')}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="h-7 px-2.5 rounded-md text-[11px] text-c-text-muted hover:text-c-text transition-colors"
                    >
                      {t('myWork.decisionWorkspace.risks.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-c-text flex-1 min-w-0">{risk.description}</p>
                    {canEdit && !isFinalized ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(risk)}
                          aria-label={t('myWork.decisionWorkspace.risks.edit', 'Edit')}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => void handleDelete(risk)}
                          disabled={deletingId === risk.id}
                          aria-label={t('myWork.decisionWorkspace.risks.delete', 'Delete')}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-c-text-muted hover:text-danger-600 hover:bg-danger-500/10 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    <span className={severityTone[risk.severity] || 'text-c-text-secondary'}>
                      {t('myWork.decisionWorkspace.risks.severityLabel', 'Severity')}:{' '}
                      {risk.severity}
                    </span>
                    <span className="text-c-text-secondary">
                      {t('myWork.decisionWorkspace.risks.likelihoodLabel', 'Likelihood')}:{' '}
                      {risk.likelihood}
                    </span>
                    {risk.ownerId ? (
                      <span className="text-c-text-secondary">
                        {t('myWork.decisionWorkspace.risks.ownerLabel', 'Owner')}:{' '}
                        {resolveUserName(
                          usersById,
                          risk.ownerId,
                          t('myWork.decisionWorkspace.risks.unknownOwner', 'Unknown')
                        )}
                      </span>
                    ) : null}
                  </div>
                  {risk.mitigation ? (
                    <p className="mt-1 text-[11px] text-c-text-secondary">
                      <span className="font-medium text-c-text-muted">
                        {t('myWork.decisionWorkspace.risks.mitigation', 'Mitigation')}:{' '}
                      </span>
                      {risk.mitigation}
                    </p>
                  ) : null}
                </>
              )}
              {rowError?.id === risk.id ? (
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
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder={t(
                'myWork.decisionWorkspace.risks.descriptionPlaceholder',
                'Risk description'
              )}
              rows={2}
              className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
            <div className="flex gap-2">
              <select
                value={draft.severity}
                onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
                className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={draft.likelihood}
                onChange={(e) => setDraft((d) => ({ ...d, likelihood: e.target.value }))}
                className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {LIKELIHOODS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {users.length > 0 ? (
                <select
                  value={draft.ownerId || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value || null }))}
                  className="flex-1 rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-[11px] text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <option value="">
                    {t('myWork.decisionWorkspace.risks.noOwner', 'No owner')}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <textarea
              value={draft.mitigation}
              onChange={(e) => setDraft((d) => ({ ...d, mitigation: e.target.value }))}
              placeholder={t('myWork.decisionWorkspace.risks.mitigation', 'Mitigation')}
              rows={2}
              className="w-full resize-none rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
            {formError ? (
              <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                onClick={() => void handleCreate()}
                disabled={!draft.description.trim() || submitting}
                className="h-7 px-2.5 rounded-md text-[11px] font-medium bg-c-surface-raised border border-c-border-subtle text-c-text hover:bg-c-surface disabled:opacity-40 transition-colors"
              >
                {submitting
                  ? t('myWork.decisionWorkspace.risks.saving', 'Saving…')
                  : t('myWork.decisionWorkspace.risks.add', 'Add risk')}
              </button>
              <button
                onClick={resetAddForm}
                className="h-7 px-2 rounded-md text-[11px] text-c-text-muted hover:text-c-text transition-colors"
              >
                <X size={12} className="inline -mt-0.5 mr-0.5" />
                {t('myWork.decisionWorkspace.risks.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised border border-dashed border-c-border-subtle transition-colors"
          >
            <Plus size={12} />
            {t('myWork.decisionWorkspace.risks.add', 'Add risk')}
          </button>
        )
      ) : null}
    </div>
  );
};

export default DecisionRisksSection;
