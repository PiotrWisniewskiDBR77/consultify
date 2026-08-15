import { AlertTriangle, Check, Loader2, Sparkles, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Button from '@/components/ui/primitives/Button';

import {
  approveDocumentStudioProposal,
  createDocumentStudioTransformativeProposal,
  rejectDocumentStudioProposal,
} from './api';
import type { DocumentEditorProposal, DocumentSchema } from './types';

export interface DocumentTransformativeEditPanelProps {
  artifactId: string;
  onSchemaUpdated: (schema: DocumentSchema) => void;
}

/**
 * Explicit authority boundary for the broadest Document Studio edit scope.
 * Creating a proposal is still non-mutating, but it grants the model permission
 * to rewrite every section. The request therefore leaves the browser only after
 * the user has reviewed the blast radius and confirmed in the modal below.
 * Applying the proposal remains a separate governed action.
 */
export const DocumentTransformativeEditPanel: React.FC<DocumentTransformativeEditPanelProps> = ({
  artifactId,
  onSchemaUpdated,
}) => {
  const { t } = useTranslation();
  const [instruction, setInstruction] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [proposal, setProposal] = useState<DocumentEditorProposal | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createLock = useRef(false);

  const requestConfirmation = (): void => {
    if (!instruction.trim() || creating || reviewing) return;
    setError(null);
    setConfirmOpen(true);
  };

  const confirmCreate = async (): Promise<void> => {
    // React state updates are asynchronous. The ref closes the sub-frame gap in
    // which two rapid confirm events could otherwise mint two proposals.
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setError(null);
    try {
      const next = await createDocumentStudioTransformativeProposal(
        artifactId,
        { instruction: instruction.trim() },
        { useLlm: true }
      );
      setProposal(next);
      setConfirmOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              'documentStudio.transformative.createFailed',
              'The transformative proposal could not be prepared. The document was not changed.'
            )
      );
      setConfirmOpen(false);
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  };

  const approve = async (): Promise<void> => {
    if (!proposal || reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const result = await approveDocumentStudioProposal(artifactId, proposal.proposalId);
      setProposal(result.proposal);
      onSchemaUpdated(result.schema);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              'documentStudio.transformative.approveFailed',
              'The proposal could not be applied. The document was not changed.'
            )
      );
    } finally {
      setReviewing(false);
    }
  };

  const reject = async (): Promise<void> => {
    if (!proposal || reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const rejected = await rejectDocumentStudioProposal(artifactId, proposal.proposalId);
      setProposal(rejected);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t('documentStudio.transformative.rejectFailed', 'The proposal could not be rejected.')
      );
    } finally {
      setReviewing(false);
    }
  };

  const pendingReview = proposal?.status === 'proposed';

  return (
    <section
      className="space-y-3 rounded-lg border border-c-border bg-c-surface p-3"
      data-testid="document-transformative-edit-panel"
    >
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-c-warning/10 text-c-warning">
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('documentStudio.transformative.title', 'Transformative edit')}
          </h3>
          <p className="text-xs text-c-text-secondary">
            {t(
              'documentStudio.transformative.subtitle',
              'Ask Teresa to rebuild the whole document. Nothing is applied until you review and approve the proposal.'
            )}
          </p>
        </div>
      </div>

      <label className="block text-xs font-medium text-c-text-secondary">
        {t('documentStudio.transformative.instruction', 'What should fundamentally change?')}
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={4}
          disabled={creating || reviewing}
          className="mt-1 w-full resize-y rounded-lg border border-c-border bg-c-bg px-3 py-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-60"
          placeholder={t(
            'documentStudio.transformative.placeholder',
            'For example: rebuild this as a concise board decision memo with a clearer recommendation and risk section.'
          )}
        />
      </label>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={requestConfirmation}
        disabled={!instruction.trim() || creating || reviewing}
        data-testid="document-transformative-request"
      >
        {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        {t('documentStudio.transformative.prepare', 'Prepare full-document proposal')}
      </Button>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-2 text-xs text-danger-700 dark:text-danger-300"
        >
          {error}
        </div>
      ) : null}

      {proposal ? (
        <div
          className="space-y-3 rounded-lg border border-c-border-subtle bg-c-bg p-3"
          data-testid="document-transformative-review"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
              {t('documentStudio.transformative.reviewTitle', 'Review before applying')}
            </h4>
            <span className="rounded-full border border-c-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-c-text-secondary">
              {proposal.status}
            </span>
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold text-c-text-secondary">
                {t('documentStudio.transformative.before', 'Before')}
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-c-border-subtle bg-c-surface p-2 text-xs text-c-text-secondary">
                {proposal.diff.before}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-c-text-secondary">
                {t('documentStudio.transformative.after', 'Proposed')}
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-c-focus/30 bg-c-focus/5 p-2 text-xs text-c-text">
                {proposal.diff.after}
              </pre>
            </div>
          </div>
          {pendingReview ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void reject()}
                disabled={reviewing}
              >
                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t('documentStudio.transformative.reject', 'Reject')}
              </Button>
              <Button type="button" size="sm" onClick={() => void approve()} disabled={reviewing}>
                {reviewing ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t('documentStudio.transformative.apply', 'Approve and apply')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!creating) setConfirmOpen(open);
        }}
      >
        <DialogContent role="alertdialog" className="border-c-border bg-c-surface text-c-text">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-c-text">
              <AlertTriangle className="h-5 w-5 text-c-warning" aria-hidden="true" />
              {t('documentStudio.transformative.confirmTitle', 'Rebuild the whole document?')}
            </DialogTitle>
            <DialogDescription className="text-c-text-secondary">
              {t(
                'documentStudio.transformative.confirmDescription',
                'Teresa may rewrite every section, heading and block. This creates a proposal only. You will review the complete before/after result before a separate approval can change the document.'
              )}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 rounded-lg border border-c-warning/30 bg-c-warning/10 p-3 text-xs text-c-text-secondary">
            <li>
              • {t('documentStudio.transformative.scopeAll', 'The complete document is in scope.')}
            </li>
            <li>
              •{' '}
              {t(
                'documentStudio.transformative.structureMayChange',
                'Structure and wording may change.'
              )}
            </li>
            <li>
              •{' '}
              {t(
                'documentStudio.transformative.reviewRequired',
                'Nothing is applied without your later approval.'
              )}
            </li>
          </ul>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={creating}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void confirmCreate()}
              disabled={creating}
              data-testid="document-transformative-confirm"
            >
              {creating ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {t('documentStudio.transformative.confirm', 'Create proposal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default DocumentTransformativeEditPanel;
