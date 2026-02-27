import {
  AlarmClockOff,
  Bell,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { DelegationModal } from './shared/DelegationModal';

type PreviewMode = 'my' | 'requests_pending' | 'all';

export interface DecisionPreviewPanelProps {
  decisionId: string | null;
  mode: PreviewMode;
  onClose: () => void;
  onOpenFullDetail: (decisionId: string, decisionData?: any) => void;
  onDidMutate?: () => void;
}

const formatShortDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const defaultRationaleFor = (status: 'approved' | 'rejected') =>
  status === 'approved' ? 'Approved' : 'Rejected';

export const DecisionPreviewPanel: React.FC<DecisionPreviewPanelProps> = ({
  decisionId,
  mode,
  onClose,
  onOpenFullDetail,
  onDidMutate,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<any | null>(null);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email?: string; avatar?: string }>
  >([]);

  const canAct = useMemo(() => {
    if (!decisionId) return false;
    if (mode === 'requests_pending') return false; // requester view: remind/snooze only
    return true;
  }, [decisionId, mode]);

  const canDelegate = canAct;

  const fetchDetails = useCallback(async () => {
    if (!decisionId) return;
    try {
      setLoading(true);
      const d = await Api.getDecision(decisionId);
      setDecision(d);
    } catch (e) {
      setDecision(null);
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await Api.getUsers();
      const mapped = (Array.isArray(users) ? users : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatar: u.avatar_url || u.avatarUrl || undefined,
      }));
      setAvailableUsers(mapped);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  useEffect(() => {
    setDecision(null);
    if (decisionId) fetchDetails();
  }, [decisionId, fetchDetails]);

  const handleApproveReject = async (next: 'approved' | 'rejected') => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, next, defaultRationaleFor(next));
      toast.success(
        next === 'approved'
          ? isPolish
            ? 'Zatwierdzono'
            : 'Approved'
          : isPolish
            ? 'Odrzucono'
            : 'Rejected'
      );
      onDidMutate?.();
      await fetchDetails();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Action failed');
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'deferred', isPolish ? 'Odroczone' : 'Deferred');
      toast.success(isPolish ? 'Odroczono' : 'Deferred');
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(isPolish ? 'Nie udało się odroczyć' : 'Failed to defer');
    }
  };

  const handleRemind = async () => {
    if (!decisionId) return;
    try {
      await Api.remindDecision(decisionId);
      toast.success(isPolish ? 'Wysłano przypomnienie' : 'Reminder sent');
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        msg.includes('recent')
          ? isPolish
            ? 'Przypomnienie było niedawno wysłane'
            : 'Reminder recently sent'
          : isPolish
            ? 'Nie udało się wysłać przypomnienia'
            : 'Failed to send reminder'
      );
    }
  };

  const handleSnooze = async (preset: '1h' | '4h' | 'tomorrow' | 'week') => {
    if (!decisionId) return;
    try {
      await Api.snoozeDecision(decisionId, { preset });
      toast.success(isPolish ? 'Odłożono' : 'Snoozed');
      onDidMutate?.();
      onClose();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się odłożyć' : 'Failed to snooze');
    }
  };

  if (!decisionId) {
    return (
      <aside className="w-[420px] flex-shrink-0 bg-slate-50 dark:bg-navy-950 h-full p-3">
        <PreviewPaneShell
          kicker={isPolish ? 'Podgląd' : 'Preview'}
          title={isPolish ? 'Decyzja' : 'Decision'}
          onClose={onClose}
        >
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Wybierz decyzję z listy, aby zobaczyć podgląd.'
                : 'Select a decision to preview.'}
            </div>
          </div>
        </PreviewPaneShell>
      </aside>
    );
  }

  return (
    <aside className="w-[420px] flex-shrink-0 bg-slate-50 dark:bg-navy-950 h-full p-3 overflow-hidden">
      <PreviewPaneShell
        kicker={
          mode === 'requests_pending'
            ? isPolish
              ? 'Moja prośba'
              : 'My request'
            : isPolish
              ? 'Podgląd'
              : 'Preview'
        }
        title={decision?.title || (isPolish ? 'Decyzja' : 'Decision')}
        onClose={onClose}
        actions={
          <button
            onClick={() => onOpenFullDetail(decisionId, decision)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
            title={isPolish ? 'Otwórz pełny widok' : 'Open full detail'}
          >
            <ExternalLink size={13} />
            {isPolish ? 'Otwórz' : 'Open'}
          </button>
        }
        footer={
          <div className="space-y-2">
            {canAct && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleApproveReject('approved')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check size={16} />
                  {isPolish ? 'Zatwierdź' : 'Approve'}
                </button>
                <button
                  onClick={() => handleApproveReject('rejected')}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
                >
                  <X size={16} />
                  {isPolish ? 'Odrzuć' : 'Reject'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRemind}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-50/70 dark:hover:bg-navy-800/40 text-slate-700 dark:text-slate-200"
              >
                <Bell size={16} />
                {isPolish ? 'Przypomnij' : 'Remind'}
              </button>
              <div className="relative group">
                <button className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-50/70 dark:hover:bg-navy-800/40 text-slate-700 dark:text-slate-200">
                  <AlarmClockOff size={16} />
                  {isPolish ? 'Odłóż' : 'Snooze'}
                </button>
                <div className="hidden group-hover:block absolute right-0 mt-2 w-56 z-20 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl overflow-hidden">
                  <button
                    onClick={() => handleSnooze('1h')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                  >
                    {isPolish ? 'Za 1h' : '1 hour'}
                  </button>
                  <button
                    onClick={() => handleSnooze('4h')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                  >
                    {isPolish ? 'Za 4h' : '4 hours'}
                  </button>
                  <button
                    onClick={() => handleSnooze('tomorrow')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                  >
                    {isPolish ? 'Jutro (9:00)' : 'Tomorrow (9:00)'}
                  </button>
                  <button
                    onClick={() => handleSnooze('week')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-navy-800"
                  >
                    {isPolish ? 'Za tydzień' : 'Next week'}
                  </button>
                </div>
              </div>
            </div>

            {canAct && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDefer}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-50/70 dark:hover:bg-navy-800/40 text-slate-700 dark:text-slate-200"
                >
                  <Clock size={16} />
                  {isPolish ? 'Odrocz' : 'Defer'}
                </button>
                <button
                  onClick={async () => {
                    await fetchUsers();
                    setDelegationOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-navy-700 hover:bg-slate-50/70 dark:hover:bg-navy-800/40 text-slate-700 dark:text-slate-200"
                >
                  <UserPlus size={16} />
                  {isPolish ? 'Deleguj' : 'Delegate'}
                </button>
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
            </div>
          ) : (
            <>
              {decision?.description ? (
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {decision.description}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish ? 'Brak opisu.' : 'No description.'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200/70 dark:border-navy-700/70 p-3 bg-white/50 dark:bg-navy-900/30">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Owner' : 'Owner'}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {decision?.ownerName || decision?.decisionOwnerId || '-'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-navy-700/70 p-3 bg-white/50 dark:bg-navy-900/30">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Requester' : 'Requester'}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {decision?.requestedByName || decision?.requestedById || currentUser?.id || '-'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-navy-700/70 p-3 bg-white/50 dark:bg-navy-900/30">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Due' : 'Due'}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                    <span className="truncate">{formatShortDate(decision?.dueDate) || '-'}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/70 dark:border-navy-700/70 p-3 bg-white/50 dark:bg-navy-900/30">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Waiting' : 'Waiting'}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={14} className="text-slate-500 dark:text-slate-400" />
                    <span className="truncate">
                      {typeof decision?.daysWaiting === 'number'
                        ? `${decision.daysWaiting}d`
                        : decision?.createdAt
                          ? `${Math.max(
                              0,
                              Math.floor(
                                (Date.now() - new Date(decision.createdAt).getTime()) /
                                  (1000 * 60 * 60 * 24)
                              )
                            )}d`
                          : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </PreviewPaneShell>

      {decisionId && decision && (
        <DelegationModal
          isOpen={delegationOpen}
          onClose={() => setDelegationOpen(false)}
          decisionId={decisionId}
          decisionTitle={String(decision?.title || '')}
          availableUsers={availableUsers}
          currentDeciderId={String(
            decision?.deciderId ||
              decision?.decider_id ||
              decision?.decisionOwnerId ||
              decision?.decisionOwnerId ||
              decision?.decision_maker_id ||
              ''
          )}
          onDelegated={() => {
            onDidMutate?.();
            fetchDetails();
          }}
        />
      )}
    </aside>
  );
};

export default DecisionPreviewPanel;
