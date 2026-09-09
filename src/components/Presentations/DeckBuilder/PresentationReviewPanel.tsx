import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { OrganizationApi, type OrganizationMember } from '../../../services/api/organizations.api';
import { PresentationApprovalsApi, type PresentationApprovalState } from '../../../services/api/presentationApprovals.api';
import { useTranslation } from 'react-i18next';

interface Props {
  deckId: string;
  version: number;
  organizationId?: string;
  currentUserId?: string;
  qualityPanel: React.ReactNode;
}

export const PresentationReviewPanel: React.FC<Props> = ({ deckId, version, organizationId, currentUserId, qualityPanel }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'qa' | 'approval'>('qa');
  const [state, setState] = useState<PresentationApprovalState | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewers = useMemo(() => members.filter((member) => member.status === 'active' && member.userId !== currentUserId), [members, currentUserId]);

  const load = useCallback(async () => {
    if (!deckId) return;
    setLoading(true); setError(null);
    try {
      const [approval, organizationMembers] = await Promise.all([
        PresentationApprovalsApi.getState(deckId),
        organizationId ? OrganizationApi.getOrganizationMembers(organizationId) : Promise.resolve([]),
      ]);
      setState(approval); setMembers(organizationMembers);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nie udało się pobrać przeglądu');
    } finally { setLoading(false); }
  }, [deckId, organizationId]);

  useEffect(() => { if (tab === 'approval') void load(); }, [load, tab, version]);

  const execute = async (operation: () => Promise<unknown>) => {
    setActing(true); setError(null);
    try { await operation(); setReason(''); await load(); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Operacja nie powiodła się'); }
    finally { setActing(false); }
  };

  return <div className="flex h-full min-h-0 flex-col" data-testid="presentation-review-panel">
    <div className="flex shrink-0 gap-1 border-b border-c-border-subtle p-2" role="tablist">
      {/* axe color-contrast: text-c-focus-solid on bg-c-focus/10 measures 4.31:1
          (< 4.5) — text-c-focus-solid-on-tint is the scoped fix. */}
      {(['qa', 'approval'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-9 rounded-md px-3 text-xs font-medium ${tab === item ? 'bg-c-focus/10 text-c-focus-solid-on-tint' : 'text-c-text-secondary hover:bg-c-surface-hover'}`}>{item === 'qa' ? 'QA' : 'Zatwierdzenie'}</button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-auto">{tab === 'qa' ? qualityPanel : <div className="space-y-4 p-4 text-sm text-c-text">
      <div><h3 className="font-semibold">{t('presentations.builder.presentationReviewPanel.presentationApproval', 'Presentation approval')}</h3><p className="mt-1 text-xs text-c-text-secondary">Wersja {version}. Autor nie może sam zatwierdzić własnej wersji.</p></div>
      {loading ? <p>{t('presentations.builder.presentationReviewPanel.loading', 'Loading…')}</p> : null}
      {error ? <div className="rounded-md border border-danger-500/30 bg-danger-500/10 p-3"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-2 underline">{t('presentations.builder.presentationReviewPanel.tryAgain', 'Try again')}</button></div> : null}
      {!loading && state?.state === 'approved' ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">{t('presentations.builder.presentationReviewPanel.thisVersionIsApproved', 'This version is approved.')}</div> : null}
      {!loading && state?.state === 'review' ? <div className="space-y-3"><p>{t('presentations.builder.presentationReviewPanel.thePresentationIsAwaitingThe', "The presentation is awaiting the assigned reviewer's decision.")}</p>{state.assignment?.assigned_to_user_id === currentUserId ? <><button disabled={acting} onClick={() => void execute(() => PresentationApprovalsApi.approve(deckId))} className="min-h-10 w-full rounded-md bg-emerald-600 px-3 font-medium text-white disabled:opacity-50">{t('presentations.builder.presentationReviewPanel.approve', 'Approve')}</button><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('presentations.builder.presentationReviewPanel.requiredChangesReason', 'Reason for requested changes')} className="min-h-24 w-full rounded-md border border-c-border bg-c-surface px-3 py-2"/><button disabled={acting || !reason.trim()} onClick={() => void execute(() => PresentationApprovalsApi.reject(deckId, reason.trim()))} className="min-h-10 w-full rounded-md border border-amber-500 px-3 font-medium disabled:opacity-50">{t('presentations.builder.presentationReviewPanel.requestChanges', 'Request changes')}</button></> : null}</div> : null}
      {!loading && (!state || state.state === 'draft' || state.state === 'rejected') ? <div className="space-y-3">{state?.state === 'rejected' ? <p>{t('presentations.builder.presentationReviewPanel.sendThePresentationAgainOnce', 'Send the presentation again once it is fixed.')}</p> : null}<label className="block text-xs font-medium" htmlFor="presentation-reviewer">{t('presentations.builder.presentationReviewPanel.reviewerLabel', 'Reviewer')}</label><select id="presentation-reviewer" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="min-h-10 w-full rounded-md border border-c-border bg-c-surface px-3"><option value="">{t('presentations.builder.presentationReviewPanel.chooseAPerson', 'Choose a person')}</option>{reviewers.map((member) => <option key={member.userId} value={member.userId}>{member.name || member.email}</option>)}</select><button disabled={acting || !reviewerId} onClick={() => void execute(() => PresentationApprovalsApi.submit(deckId, reviewerId))} className="min-h-10 w-full rounded-md bg-c-text px-3 font-medium text-c-surface disabled:opacity-50">{t('presentations.builder.presentationReviewPanel.sendForApproval', 'Send for approval')}</button></div> : null}
    </div>}</div>
  </div>;
};
