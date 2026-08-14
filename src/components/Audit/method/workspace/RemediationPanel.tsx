/**
 * RemediationPanel — Criterion Workspace, ogniwa „korekcja" → „przyczyna
 * źródłowa" → „działanie korygujące" → „właściciel/termin" → „weryfikacja
 * skuteczności" → „zamknięcie" (ostatnie sześć ogniw łańcucha).
 *
 * Renderowany dopiero, gdy jest WYBRANE ustalenie (`finding` != null) — bez
 * ustalenia te ogniwa są nieosiągalne i `CriterionWorkspace` pokazuje
 * wyjaśnienie zamiast montować ten panel (nigdy niema blokada — kanon
 * mandatu W1).
 *
 * SEGREGACJA OBOWIĄZKÓW: właściciel działania nie potwierdza sam jego
 * skuteczności — mirror `assertIndependentVerifier` (permissions.ts):
 * `action.ownerUserId === currentUserId || action.implementedBy ===
 * currentUserId` chowa przycisk „Potwierdź skuteczność" z powodem.
 */
import { CheckCircle2, Hammer, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { PreviewActionButton } from '@/components/shared/PreviewPane/PreviewActionButton';
import { SaveStateIndicator, type SaveStatus } from '@/components/shared/states';
import { StatusChip } from '@/components/ui/primitives/chips';

import * as workspaceApi from './workspaceApi';
import type {
  ActionKind,
  VerificationResult,
  WorkspaceCapability,
  WorkspaceFindingDetail,
} from './workspaceApi';

export interface RemediationPanelProps {
  programId: string;
  isPolish: boolean;
  capabilities: Set<WorkspaceCapability>;
  currentUserId: string | null;
  finding: WorkspaceFindingDetail;
  onChanged: () => void;
}

function actionStatusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'implemented' || status === 'verified') return 'success';
  if (status === 'rejected' || status === 'cancelled') return 'neutral';
  if (status === 'overdue') return 'danger';
  return 'warning';
}

export const RemediationPanel: React.FC<RemediationPanelProps> = ({
  programId,
  isPolish,
  capabilities,
  currentUserId,
  finding,
  onChanged,
}) => {
  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [correctionTitle, setCorrectionTitle] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionKind, setActionKind] = useState<ActionKind>('corrective_action');
  const [rootCause, setRootCause] = useState(finding.rootCause ?? '');
  const [closeNote, setCloseNote] = useState('');

  const canPropose = capabilities.has('action.propose');
  const canApprove = capabilities.has('action.approve');
  const canReportImplementation = capabilities.has('action.report_implementation');
  const canVerify = capabilities.has('verification.perform');
  const canClose = capabilities.has('finding.close');
  const canUpdateFinding = capabilities.has('finding.update');

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setSaveStatus('saving');
      try {
        await fn();
        setSaveStatus('saved');
        onChanged();
      } catch {
        setSaveStatus('error');
      }
    },
    [onChanged]
  );

  const handleProposeCorrection = useCallback(() => {
    if (!correctionTitle.trim()) return;
    run(() =>
      workspaceApi
        .proposeAction(finding.id, { actionKind: 'correction', title: correctionTitle.trim() })
        .then(() => setCorrectionTitle(''))
    );
  }, [correctionTitle, finding.id, run]);

  const handleSaveRootCause = useCallback(() => {
    run(() => workspaceApi.updateFinding(finding.id, { rootCause: rootCause.trim() || null }));
  }, [rootCause, finding.id, run]);

  const handleProposeAction = useCallback(() => {
    if (!actionTitle.trim()) return;
    run(() =>
      workspaceApi
        .proposeAction(finding.id, { actionKind, title: actionTitle.trim() })
        .then(() => setActionTitle(''))
    );
  }, [actionTitle, actionKind, finding.id, run]);

  const handleApprove = useCallback(
    (id: string) => run(() => workspaceApi.approveAction(id)),
    [run]
  );

  const handleReportImplementation = useCallback(
    (id: string) =>
      run(() => workspaceApi.reportImplementation(id, { note: t('Wdrożono', 'Implemented') })),
    [run, t]
  );

  const handlePlanVerification = useCallback(
    (correctiveActionId: string) =>
      run(() =>
        workspaceApi.planVerification({
          findingId: finding.id,
          correctiveActionId,
          verificationKind: 'effectiveness',
        })
      ),
    [finding.id, run]
  );

  const handlePerform = useCallback(
    (verificationId: string, result: VerificationResult) =>
      run(() => workspaceApi.performVerification(verificationId, { result, evidenceId: null })),
    [run]
  );

  const handleClose = useCallback(() => {
    if (!closeNote.trim()) return;
    run(() => workspaceApi.closeFinding(finding.id, closeNote.trim()).then(() => setCloseNote('')));
  }, [closeNote, finding.id, run]);

  const correctionActions = finding.correctiveActions.filter(
    (a) => a.actionKind === 'correction' || a.actionKind === 'containment'
  );
  const systemicActions = finding.correctiveActions.filter(
    (a) => a.actionKind === 'corrective_action' || a.actionKind === 'preventive_action'
  );

  return (
    <div data-testid="remediation-panel" className="space-y-5">
      <SaveStateIndicator status={saveStatus} />

      {/* Ogniwo: korekcja */}
      <section data-testid="chain-link-korekcja" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Korekcja', 'Correction')}
        </h4>
        <p className="text-xs text-c-text-muted">
          {t(
            'Usunięcie bezpośredniego skutku niezgodności — nie zamyka ustalenia samo z siebie.',
            'Removes the direct effect of the nonconformity — does not close the finding by itself.'
          )}
        </p>
        {correctionActions.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-token-sm border border-c-border-subtle px-2 py-1.5 text-xs"
          >
            <span className="text-c-text">{a.title}</span>
            <StatusChip label={a.status} tone={actionStatusTone(a.status)} />
          </div>
        ))}
        {canPropose ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={correctionTitle}
              onChange={(e) => setCorrectionTitle(e.target.value)}
              placeholder={t('Opisz korekcję', 'Describe the correction')}
              aria-label={t('Opisz korekcję', 'Describe the correction')}
              className="flex-1 rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            />
            <PreviewActionButton
              variant="neutral"
              label={t('Dodaj', 'Add')}
              onClick={handleProposeCorrection}
              disabled={!correctionTitle.trim()}
            />
          </div>
        ) : (
          <p className="text-xs text-c-text-muted">
            {t('Wymaga uprawnienia action.propose.', 'Requires the action.propose permission.')}
          </p>
        )}
      </section>

      {/* Ogniwo: przyczyna źródłowa */}
      <section data-testid="chain-link-przyczyna-zrodlowa" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Przyczyna źródłowa', 'Root cause')}
        </h4>
        {canUpdateFinding ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder={t('Ustalona przyczyna źródłowa', 'Established root cause')}
              aria-label={t('Przyczyna źródłowa', 'Root cause')}
              className="flex-1 rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
            />
            <PreviewActionButton
              variant="neutral"
              label={t('Zapisz', 'Save')}
              onClick={handleSaveRootCause}
              disabled={!rootCause.trim()}
            />
          </div>
        ) : (
          <p className="text-xs text-c-text-muted">
            {finding.rootCause ||
              t('Nie ustalono jeszcze przyczyny źródłowej.', 'Root cause not established yet.')}
          </p>
        )}
      </section>

      {/* Ogniwo: działanie korygujące */}
      <section data-testid="chain-link-dzialanie-korygujace" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Działanie korygujące', 'Corrective action')}
        </h4>
        <p className="text-xs text-c-text-muted">
          {t(
            'Usuwa PRZYCZYNĘ — niezgodność nie może zostać zamknięta bez co najmniej jednego takiego działania.',
            'Removes the CAUSE — a nonconformity cannot be closed without at least one such action.'
          )}
        </p>
        {systemicActions.map((a) => (
          <div
            key={a.id}
            className="space-y-1 rounded-token-sm border border-c-border-subtle px-2 py-1.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-c-text">{a.title}</span>
              <StatusChip label={a.status} tone={actionStatusTone(a.status)} />
            </div>
            <div className="flex gap-2">
              {canApprove && a.status === 'proposed' && (
                <PreviewActionButton
                  variant="positive"
                  label={t('Zatwierdź', 'Approve')}
                  icon={CheckCircle2}
                  onClick={() => handleApprove(a.id)}
                />
              )}
              {canReportImplementation &&
                (a.status === 'approved' ||
                  a.status === 'in_progress' ||
                  a.status === 'overdue') && (
                  <PreviewActionButton
                    variant="neutral"
                    label={t('Zgłoś wdrożenie', 'Report implementation')}
                    icon={Wrench}
                    onClick={() => handleReportImplementation(a.id)}
                  />
                )}
            </div>
          </div>
        ))}
        {canPropose ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={actionKind}
                onChange={(e) => setActionKind(e.target.value as ActionKind)}
                aria-label={t('Rodzaj działania', 'Action kind')}
                className="rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
              >
                <option value="corrective_action">corrective_action</option>
                <option value="preventive_action">preventive_action</option>
              </select>
              <input
                type="text"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                placeholder={t('Opisz działanie', 'Describe the action')}
                aria-label={t('Opisz działanie korygujące', 'Describe the corrective action')}
                className="flex-1 rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
              />
              <PreviewActionButton
                variant="neutral"
                label={t('Dodaj', 'Add')}
                onClick={handleProposeAction}
                disabled={!actionTitle.trim()}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-c-text-muted">
            {t('Wymaga uprawnienia action.propose.', 'Requires the action.propose permission.')}
          </p>
        )}
      </section>

      {/* Ogniwo: właściciel/termin */}
      <section data-testid="chain-link-wlasciciel-termin" className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Właściciel / termin', 'Owner / due date')}
        </h4>
        {finding.correctiveActions.length === 0 ? (
          <p className="text-xs text-c-text-muted">
            {t('Brak działań do przypisania.', 'No actions to assign yet.')}
          </p>
        ) : (
          finding.correctiveActions.map((a) => (
            <p key={a.id} className="text-xs text-c-text-muted">
              <span className="font-medium text-c-text">{a.title}:</span>{' '}
              {a.ownerUserId || t('brak właściciela', 'no owner')} ·{' '}
              {a.dueDate || t('brak terminu', 'no due date')}
            </p>
          ))
        )}
      </section>

      {/* Ogniwo: weryfikacja skuteczności */}
      <section data-testid="chain-link-weryfikacja-skutecznosci" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Weryfikacja skuteczności', 'Effectiveness verification')}
        </h4>
        {systemicActions.map((a) => {
          const verification = finding.verifications.find(
            (v) => v.correctiveActionId === a.id && v.verificationKind === 'effectiveness'
          );
          const isOwnAction =
            !!currentUserId &&
            (a.ownerUserId === currentUserId || a.implementedBy === currentUserId);
          return (
            <div
              key={a.id}
              className="space-y-1 rounded-token-sm border border-c-border-subtle px-2 py-1.5 text-xs"
            >
              <span className="text-c-text">{a.title}</span>
              {!verification && a.status === 'implemented' && canVerify && (
                <PreviewActionButton
                  variant="neutral"
                  label={t('Zaplanuj weryfikację', 'Plan verification')}
                  onClick={() => handlePlanVerification(a.id)}
                />
              )}
              {verification && !verification.performedAt && canVerify && !isOwnAction && (
                <div className="flex flex-wrap gap-2">
                  <PreviewActionButton
                    variant="positive"
                    label={t('Potwierdź skuteczność', 'Confirm effectiveness')}
                    icon={ShieldCheck}
                    onClick={() => handlePerform(verification.id, 'effective')}
                  />
                  <PreviewActionButton
                    variant="destructive"
                    label={t('Nieskuteczne', 'Not effective')}
                    icon={XCircle}
                    onClick={() => handlePerform(verification.id, 'not_effective')}
                  />
                </div>
              )}
              {verification && !verification.performedAt && isOwnAction && (
                <p className="text-c-text-muted">
                  {t(
                    'Nie możesz sam potwierdzić skuteczności własnego działania — wymaga niezależnej weryfikacji.',
                    'You cannot confirm the effectiveness of your own action — this requires an independent verifier.'
                  )}
                </p>
              )}
              {verification?.performedAt && (
                <StatusChip
                  label={verification.result || '—'}
                  tone={verification.result === 'effective' ? 'success' : 'danger'}
                />
              )}
            </div>
          );
        })}
        {systemicActions.length === 0 && (
          <p className="text-xs text-c-text-muted">
            {t('Brak działań korygujących do weryfikacji.', 'No corrective actions to verify yet.')}
          </p>
        )}
      </section>

      {/* Ogniwo: zamknięcie */}
      <section data-testid="chain-link-zamkniecie" className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('Zamknięcie', 'Closure')}
        </h4>
        {finding.status === 'closed' ? (
          <StatusChip label={t('Zamknięte', 'Closed')} tone="success" />
        ) : canClose ? (
          <div className="space-y-2">
            <textarea
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder={t('Notatka zamknięcia', 'Closure note')}
              aria-label={t('Notatka zamknięcia', 'Closure note')}
              className="w-full rounded-token-sm border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text"
              rows={2}
            />
            <PreviewActionButton
              variant="positive"
              label={t('Zamknij ustalenie', 'Close finding')}
              icon={Hammer}
              onClick={handleClose}
              disabled={!closeNote.trim()}
            />
          </div>
        ) : (
          <p className="text-xs text-c-text-muted">
            {t(
              'Zamknięcie wymaga roli lead auditor/reviewer i weryfikacji skuteczności działań.',
              'Closing requires the lead auditor/reviewer role and verified effectiveness of actions.'
            )}
          </p>
        )}
      </section>
    </div>
  );
};

export default RemediationPanel;
