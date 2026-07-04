import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

import {
  approveDocumentStudioProposal,
  createDocumentStudioGlobalProposal,
  createDocumentStudioLocalProposal,
  createDocumentStudioMethodologyProposal,
  createDocumentStudioSectionProposal,
  createDocumentStudioSourceProposal,
  createDocumentStudioTransformativeProposal,
  getDocumentStudioAuditTrail,
  rejectDocumentStudioProposal,
} from './api';
import { TransformativeConfirmDialog } from './TransformativeConfirmDialog';
import type {
  DocumentAuditEntry,
  DocumentEditorProposal,
  DocumentEditorScope,
  DocumentSchema,
} from './types';

interface DocumentStudioEditorPanelProps {
  artifactId: string;
  schema: DocumentSchema;
  onSchemaUpdated: (nextSchema: DocumentSchema) => void;
}

interface EditableTarget {
  sectionId: string;
  blockId: string;
  label: string;
}

function formatAuditAction(
  action: DocumentAuditEntry['action'],
  t: (key: string, fallback: string) => string
): string {
  switch (action) {
    case 'proposal_created':
      return t('docs.auditAction.proposalCreated', 'proposal_created');
    case 'proposal_approved':
      return t('docs.auditAction.proposalApproved', 'proposal_approved');
    case 'proposal_rejected':
      return t('docs.auditAction.proposalRejected', 'proposal_rejected');
    case 'proposal_executed':
      return t('docs.auditAction.proposalExecuted', 'proposal_executed');
    default:
      return action;
  }
}

export const DocumentStudioEditorPanel: React.FC<DocumentStudioEditorPanelProps> = ({
  artifactId,
  schema,
  onSchemaUpdated,
}) => {
  const { t } = useTranslation();
  const [instruction, setInstruction] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [scope, setScope] = useState<DocumentEditorScope>('local');
  const [sectionTargetId, setSectionTargetId] = useState('');
  const [useLlm, setUseLlm] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<DocumentEditorProposal | null>(null);
  const [auditTrail, setAuditTrail] = useState<DocumentAuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showTransformativeConfirm, setShowTransformativeConfirm] = useState(false);

  const editableTargets = useMemo<EditableTarget[]>(() => {
    const targets: EditableTarget[] = [];
    schema.sections.forEach((section, sectionIndex) => {
      section.blocks.forEach((block, blockIndex) => {
        const type = String(block.type || '').toLowerCase();
        if (type === 'paragraph' || type === 'heading' || type === 'list') {
          targets.push({
            sectionId: section.sectionId,
            blockId: block.blockId,
            label: `${sectionIndex + 1}.${blockIndex + 1} ${section.title}`,
          });
        }
      });
    });
    return targets;
  }, [schema.sections]);

  const selectedTarget = useMemo(() => {
    if (!targetKey) return null;
    const [sectionId, blockId] = targetKey.split('::');
    if (!sectionId || !blockId) return null;
    return { sectionId, blockId };
  }, [targetKey]);

  const refreshAuditTrail = async (): Promise<void> => {
    setLoadingAudit(true);
    try {
      const entries = await getDocumentStudioAuditTrail(artifactId);
      setAuditTrail(entries);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.editor.auditLoadFailed', 'Failed to load audit trail')
      );
    } finally {
      setLoadingAudit(false);
    }
  };

  const submitProposal = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    setNote(null);
    try {
      let proposal: DocumentEditorProposal;
      if (scope === 'local' && selectedTarget) {
        proposal = await createDocumentStudioLocalProposal(
          artifactId,
          {
            sectionId: selectedTarget.sectionId,
            blockId: selectedTarget.blockId,
            instruction: instruction.trim(),
            scope: 'local',
          },
          { useLlm }
        );
      } else if (scope === 'section') {
        proposal = await createDocumentStudioSectionProposal(
          artifactId,
          {
            sectionId: sectionTargetId,
            instruction: instruction.trim(),
          },
          { useLlm }
        );
      } else if (scope === 'global') {
        proposal = await createDocumentStudioGlobalProposal(
          artifactId,
          {
            instruction: instruction.trim(),
          },
          { useLlm }
        );
      } else if (scope === 'methodology') {
        proposal = await createDocumentStudioMethodologyProposal(
          artifactId,
          { instruction: instruction.trim() },
          { useLlm }
        );
      } else if (scope === 'source') {
        proposal = await createDocumentStudioSourceProposal(
          artifactId,
          { instruction: instruction.trim() },
          { useLlm }
        );
      } else if (scope === 'transformative') {
        proposal = await createDocumentStudioTransformativeProposal(
          artifactId,
          { instruction: instruction.trim() },
          { useLlm }
        );
      } else {
        throw new Error(t('documentStudio.editor.unsupportedScope', 'Unsupported editor scope.'));
      }
      setPendingProposal(proposal);
      const refinedNote =
        useLlm && proposal.llmRefined
          ? t(
              'documentStudio.editor.proposalReadyRefined',
              'Proposal ready (AI rewrite applied). Review the diff and approve or reject.'
            )
          : useLlm
            ? t(
                'documentStudio.editor.proposalReadyFallback',
                'Proposal ready (AI rewrite unavailable; deterministic edit shown). Review and approve or reject.'
              )
            : t(
                'documentStudio.editor.proposalReady',
                'Proposal ready. Review the diff and choose approve or reject.'
              );
      setNote(refinedNote);
      await refreshAuditTrail();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.editor.createFailed', 'Failed to create proposal')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateProposal = async (): Promise<void> => {
    if (!instruction.trim()) {
      setError(
        t('documentStudio.editor.validation', 'Select a target block and provide an instruction.')
      );
      return;
    }
    if (scope === 'local' && !selectedTarget) {
      setError(
        t('documentStudio.editor.validation', 'Select a target block and provide an instruction.')
      );
      return;
    }
    if (scope === 'section' && !sectionTargetId) {
      setError(
        t(
          'documentStudio.editor.sectionValidation',
          'Pick the section the instruction should apply to.'
        )
      );
      return;
    }
    // B1 — transformative scope is destructive (may rewrite every section),
    // so it always requires an explicit confirmation modal before the
    // request is sent. The actual submission happens in
    // handleConfirmTransformative once the user opts in.
    if (scope === 'transformative') {
      setError(null);
      setShowTransformativeConfirm(true);
      return;
    }
    await submitProposal();
  };

  const handleConfirmTransformative = async (): Promise<void> => {
    setShowTransformativeConfirm(false);
    await submitProposal();
  };

  const handleCancelTransformative = (): void => {
    setShowTransformativeConfirm(false);
  };

  const handleApprove = async (): Promise<void> => {
    if (!pendingProposal) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await approveDocumentStudioProposal(artifactId, pendingProposal.proposalId);
      setPendingProposal(result.proposal);
      onSchemaUpdated(result.schema);
      setNote(t('documentStudio.editor.executed', 'Proposal approved and executed.'));
      await refreshAuditTrail();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.editor.approveFailed', 'Failed to approve proposal')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (): Promise<void> => {
    if (!pendingProposal) return;
    setSubmitting(true);
    setError(null);
    try {
      const rejected = await rejectDocumentStudioProposal(artifactId, pendingProposal.proposalId);
      setPendingProposal(rejected);
      setNote(t('documentStudio.editor.rejected', 'Proposal rejected.'));
      await refreshAuditTrail();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('documentStudio.editor.rejectFailed', 'Failed to reject proposal')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-4 dark:border-sky-400/20 dark:bg-sky-500/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
          {t('documentStudio.editor.title', 'AI Editor')}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={refreshAuditTrail}
          disabled={loadingAudit}
        >
          {loadingAudit
            ? t('documentStudio.editor.auditLoading', 'Loading audit…')
            : t('documentStudio.editor.auditRefresh', 'Refresh audit')}
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {(
          [
            'local',
            'section',
            'global',
            'methodology',
            'source',
            'transformative',
          ] as DocumentEditorScope[]
        ).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              scope === s
                ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                : 'border-c-border text-c-text-secondary hover:border-sky-300'
            }`}
          >
            {s === 'local'
              ? t('documentStudio.editor.scopeLocal', 'Local block')
              : s === 'section'
                ? t('documentStudio.editor.scopeSection', 'Section')
                : s === 'global'
                  ? t('documentStudio.editor.scopeGlobal', 'Whole document')
                  : s === 'methodology'
                    ? t('documentStudio.editor.scopeMethodology', 'Methodology')
                    : s === 'source'
                      ? t('documentStudio.editor.scopeSource', 'Source')
                      : t('documentStudio.editor.scopeTransformative', 'Transformative')}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scope === 'local' ? (
          <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
            <span>{t('documentStudio.editor.target', 'Target block')}</span>
            <select
              className="h-9 rounded-lg border border-c-border bg-c-surface px-2 text-sm text-c-text"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              <option value="">
                {t('documentStudio.editor.targetPlaceholder', 'Select block')}
              </option>
              {editableTargets.map((target) => (
                <option
                  key={`${target.sectionId}:${target.blockId}`}
                  value={`${target.sectionId}::${target.blockId}`}
                >
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        ) : scope === 'section' ? (
          <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
            <span>{t('documentStudio.editor.sectionTarget', 'Target section')}</span>
            <select
              className="h-9 rounded-lg border border-c-border bg-c-surface px-2 text-sm text-c-text"
              value={sectionTargetId}
              onChange={(event) => setSectionTargetId(event.target.value)}
            >
              <option value="">
                {t('documentStudio.editor.sectionPlaceholder', 'Select section')}
              </option>
              {schema.sections.map((section, idx) => (
                <option key={section.sectionId} value={section.sectionId}>
                  {idx + 1}. {section.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1 text-xs text-c-text-secondary">
            <span>{t('documentStudio.editor.globalScopeLabel', 'Scope')}</span>
            <span className="rounded-lg border border-c-border bg-c-surface-raised px-2 py-1 text-c-text">
              {t('documentStudio.editor.globalScopeNote', 'Edits every block of every section.')}
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          <span>{t('documentStudio.editor.instruction', 'Edit instruction')}</span>
          <textarea
            className="min-h-[72px] rounded-lg border border-c-border bg-c-surface px-2 py-2 text-sm text-c-text"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={t(
              'documentStudio.editor.instructionPlaceholder',
              'Example: tighten this paragraph and add one measurable KPI.'
            )}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-c-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-c-border text-c-focus-solid focus:ring-c-focus"
            checked={useLlm}
            onChange={(e) => setUseLlm(e.target.checked)}
            disabled={submitting}
          />
          <span>
            {t(
              'documentStudio.editor.useLlm',
              'Refine with AI (optional, falls back to deterministic edit on any failure)'
            )}
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={handleCreateProposal} disabled={submitting}>
          {t('documentStudio.editor.propose', 'Create proposal')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleApprove}
          disabled={!pendingProposal || pendingProposal.status !== 'proposed' || submitting}
        >
          {t('documentStudio.editor.approve', 'Approve + execute')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleReject}
          disabled={!pendingProposal || pendingProposal.status !== 'proposed' || submitting}
        >
          {t('documentStudio.editor.reject', 'Reject')}
        </Button>
      </div>

      {pendingProposal ? (
        <div className="mt-3 rounded-lg border border-sky-300/60 bg-c-surface p-3 dark:border-sky-400/30">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-c-text-muted">
            <span>
              {t('documentStudio.editor.diff', 'Diff preview')} · {pendingProposal.status}
            </span>
            {pendingProposal.llmRefined ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {t('documentStudio.editor.llmBadge', 'AI rewrite')}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border border-c-border p-2 text-xs">
              <div className="mb-1 font-semibold text-c-text-muted">
                {t('documentStudio.editor.before', 'Before')}
              </div>
              <pre className="whitespace-pre-wrap text-c-text">{pendingProposal.diff.before}</pre>
            </div>
            <div className="rounded-md border border-sky-300/60 bg-sky-50 p-2 text-xs dark:border-sky-400/30 dark:bg-sky-500/10">
              <div className="mb-1 font-semibold text-sky-700 dark:text-sky-300">
                {t('documentStudio.editor.after', 'After')}
              </div>
              <pre className="whitespace-pre-wrap text-c-text">{pendingProposal.diff.after}</pre>
            </div>
          </div>
          {pendingProposal.proposedChanges && pendingProposal.proposedChanges.length > 0 ? (
            <div className="mt-3 rounded-md border border-c-border bg-c-surface-raised p-2 text-xs">
              <div className="mb-2 font-semibold text-c-text-secondary">
                {t('documentStudio.editor.structuredChanges', 'Structured changes')}
              </div>
              <ul className="space-y-2">
                {pendingProposal.proposedChanges.map((change, index) => (
                  <li
                    key={`${change.targetSectionId}:${change.targetBlockId ?? 'section'}:${index}`}
                    className="rounded border border-c-border bg-c-surface p-2"
                  >
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                      {change.targetSectionId}
                      {change.targetBlockId ? ` · ${change.targetBlockId}` : ''} ·{' '}
                      {change.editType ?? 'rewrite'}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <pre className="whitespace-pre-wrap rounded bg-c-surface-raised p-2 text-c-text">
                        {change.before}
                      </pre>
                      <pre className="whitespace-pre-wrap rounded bg-sky-50 p-2 text-c-text dark:bg-sky-500/10">
                        {change.after}
                      </pre>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pendingProposal.versionBeforeId || pendingProposal.versionAfterId ? (
            <div className="mt-2 text-[11px] text-c-text-muted">
              {pendingProposal.versionBeforeId
                ? `${t('documentStudio.editor.beforeSnapshot', 'Before snapshot')}: ${pendingProposal.versionBeforeId}`
                : null}
              {pendingProposal.versionBeforeId && pendingProposal.versionAfterId ? ' · ' : ''}
              {pendingProposal.versionAfterId
                ? `${t('documentStudio.editor.afterSnapshot', 'After snapshot')}: ${pendingProposal.versionAfterId}`
                : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {note ? (
        <div className="mt-3 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {note}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-md border border-danger-400/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-700 dark:text-danger-300">
          {error}
        </div>
      ) : null}

      {auditTrail.length > 0 ? (
        <div className="mt-3 rounded-lg border border-c-border bg-c-surface p-3 text-xs">
          <div className="mb-2 font-semibold text-c-text-secondary">
            {t('documentStudio.editor.auditTrail', 'Audit trail')}
          </div>
          <ul className="space-y-1 text-c-text-secondary">
            {auditTrail
              .slice(-6)
              .reverse()
              .map((entry) => (
                <li key={entry.auditId}>
                  {new Date(entry.occurredAt).toLocaleString()} ·{' '}
                  {formatAuditAction(entry.action, t)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <TransformativeConfirmDialog
        open={showTransformativeConfirm}
        onCancel={handleCancelTransformative}
        onConfirm={handleConfirmTransformative}
        submitting={submitting}
      />
    </section>
  );
};

export default DocumentStudioEditorPanel;
