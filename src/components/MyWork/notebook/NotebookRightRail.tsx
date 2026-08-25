/**
 * NotebookRightRail — consolidated right side panel for Notebook.
 * L-03: Combines 4 separate panels (AIChatInlinePanel, AITopicsPanel,
 * ActionItemsPanel, NotebookContextPanel) into a single tabbed rail.
 *
 * Tab A "Praca"   — AI tools: AI chat panel + topics + action items
 * Tab B "Kontekst" — Context panel (Ideas, Initiatives, Tasks, etc.)
 *
 * State (open/tab) is owned by the caller (uiSlice in L-02).
 */
import type { Editor } from '@tiptap/react';
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { NotebookPage } from '@/types/myWork';

import type { ConvertTarget } from './AIChatInlinePanel';
import { NotebookContextPanel } from './NotebookContextPanel';

interface NotebookRailPage {
  id: string;
  maturity: 'seed' | 'growing' | 'mature' | 'actionable';
  summary?: string | null;
  updatedAt?: string | null;
  visibility?: 'private' | 'project' | null;
  projectId?: string | null;
  wordCount: number;
}

interface NotebookRightRailProps {
  open: boolean;
  activeTab: 'work' | 'context';
  onTabChange: (tab: 'work' | 'context') => void;
  onClose: () => void;
  ownerLabel?: string;

  // Active page data
  activePage: NotebookPage | null;
  allPages: NotebookPage[];
  editor: Editor | null;

  // Props forwarded to AIChatInlinePanel
  noteTitle: string;
  noteContent: string;
  noteTags: string[];
  notePage: NotebookRailPage | undefined;
  onAskAI?: () => void;
  onDeletePage?: () => void;
  onSetVisibility?: (next: 'private' | 'project') => void;
  saveState?: 'saving' | 'saved' | 'error' | 'conflict' | 'offline' | null;
  onRetrySave?: () => void;
  onReloadConflict?: () => void;
  onKeepMineConflict?: () => void;
  onSetVerificationStatus?: (next: 'unverified' | 'verified' | 'disputed') => void;
  onSetReviewCadence?: (next: 'weekly' | 'monthly' | 'quarterly' | 'never') => void;
  onMarkReviewed?: () => void;
  getRelativeTime?: (iso: string) => string;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
  onConvert?: (target: ConvertTarget) => void;
  canConvertDeliverable?: boolean;
  convertBlockedReason?: string;
  /** Undefined preserves legacy integrators; production passes its proven receipt capabilities. */
  receiptCapableActionIds?: string[];
}

export const NotebookRightRail: React.FC<NotebookRightRailProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  ownerLabel,
  activePage,
  allPages,
  editor,
  noteTags,
  notePage,
  onSetVisibility,
  saveState,
  onRetrySave,
  onReloadConflict,
  onKeepMineConflict,
  onSetVerificationStatus,
  onSetReviewCadence,
  onMarkReviewed,
  getRelativeTime,
  onOpenAIChat,
  receiptCapableActionIds,
}) => {
  const { t } = useTranslation();
  const workTabRef = useRef<HTMLButtonElement>(null);
  const contextTabRef = useRef<HTMLButtonElement>(null);
  const isReceiptCapable = (actionId: string) =>
    receiptCapableActionIds === undefined || receiptCapableActionIds.includes(actionId);

  if (!open || !activePage) return null;

  const tabBtn = (tab: 'work' | 'context', icon: React.ReactNode, label: string) => (
    <button
      type="button"
      data-notebook-action-id={`rail:tab-${tab}`}
      role="tab"
      id={`notebook-rail-tab-${tab}`}
      aria-selected={activeTab === tab}
      aria-controls={`notebook-rail-panel-${tab}`}
      tabIndex={activeTab === tab ? 0 : -1}
      ref={tab === 'work' ? workTabRef : contextTabRef}
      onClick={() => onTabChange(tab)}
      onKeyDown={(event) => {
        let nextTab: 'work' | 'context' | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          nextTab = tab === 'work' ? 'context' : 'work';
        } else if (event.key === 'Home') {
          nextTab = 'work';
        } else if (event.key === 'End') {
          nextTab = 'context';
        }
        if (!nextTab) return;
        event.preventDefault();
        onTabChange(nextTab);
        (nextTab === 'work' ? workTabRef : contextTabRef).current?.focus();
      }}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        activeTab === tab
          ? 'bg-c-text text-c-surface dark:bg-c-surface-raised dark:text-c-text'
          : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised dark:text-c-text-muted dark:hover:text-c-text dark:hover:bg-white/[0.06]'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <aside
      aria-label={t('notebook.rightRail.label', 'Document details and context')}
      className="flex w-[min(22rem,calc(100vw-2rem))] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-c-surface dark:border-white/[0.06] dark:bg-navy-950"
    >
      {/* Rail header with tabs */}
      <div
        role="tablist"
        aria-label={t('notebook.rightRail.views', 'Document rail views')}
        className="flex items-center gap-1 border-b border-c-border-subtle/60 px-2 py-1.5 dark:border-white/[0.06]"
      >
        {tabBtn('work', <Wrench size={11} />, t('notebook.rightRail.work', 'Work'))}
        {tabBtn('context', <Layers size={11} />, t('notebook.rightRail.context', 'Context'))}
        <button
          type="button"
          data-notebook-action-id="rail:close"
          onClick={onClose}
          aria-label={t('notebook.rightRail.closePanel', 'Close panel')}
          className="ml-auto rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text dark:hover:bg-white/[0.06] dark:hover:text-c-text"
          title={t('notebook.rightRail.closePanel', 'Close panel')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab A: Work — document record and governance */}
      <div
        id="notebook-rail-panel-work"
        role="tabpanel"
        aria-labelledby="notebook-rail-tab-work"
        aria-hidden={activeTab !== 'work'}
        className={`flex flex-1 flex-col overflow-hidden ${activeTab === 'work' ? '' : 'hidden'}`}
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <h3 className="text-sm font-semibold text-c-text">
              {t('notebook.rightRail.documentRecord', 'Document record')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-c-text-muted">
              {t(
                'notebook.rightRail.documentRecordDescription',
                'Ownership, governance and review information for this note.'
              )}
            </p>
          </div>

          {receiptCapableActionIds?.length === 0 ? (
            <p
              id="notebook-rail-receipt-unavailable"
              className="rounded-lg border border-c-border-subtle p-2 text-xs text-c-text-muted"
            >
              {t(
                'notebook.rightRail.receiptUnavailable',
                'Editing controls are unavailable until the server can return a durable action receipt.'
              )}
            </p>
          ) : null}

          <dl className="space-y-3 text-xs">
            <div className="rounded-xl border border-c-border-subtle p-3">
              <dt className="font-semibold text-c-text-secondary">
                {t('notebook.rightRail.saveStatus', 'Save status')}
              </dt>
              <dd className="mt-2 flex items-center justify-between gap-3 text-c-text">
                <span data-testid="notebook-save-state" role={saveState === 'error' ? 'alert' : 'status'}>
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                      {t('notebook.rightRail.saving', 'Saving…')}
                    </span>
                  )}
                  {saveState === 'saved' && (
                    <span className="inline-flex items-center gap-1.5 text-c-success">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      {t('notebook.rightRail.saved', 'Saved')}
                    </span>
                  )}
                  {saveState === 'offline' &&
                    t('notebook.rightRail.offlineQueued', 'Offline — changes are queued')}
                  {saveState === 'conflict' &&
                    t('notebook.rightRail.conflict', 'Changed elsewhere — your edits remain local')}
                  {saveState === 'error' &&
                    t('notebook.rightRail.saveFailed', 'Save failed — changes remain local')}
                  {saveState == null &&
                    t('notebook.rightRail.noPendingChanges', 'No pending changes')}
                </span>
                {saveState === 'error' && onRetrySave && (
                  <button
                    type="button"
                    data-notebook-action-id="rail:retry-save"
                    aria-disabled={!isReceiptCapable('retry-save') || undefined}
                    aria-describedby={
                      !isReceiptCapable('retry-save')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('retry-save')) onRetrySave();
                    }}
                    className="rounded-lg border border-c-border-subtle px-2 py-1 font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('common.retry', 'Retry')}
                  </button>
                )}
              </dd>
              {saveState === 'conflict' && onReloadConflict && onKeepMineConflict && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-notebook-action-id="rail:load-theirs"
                    aria-disabled={!isReceiptCapable('load-theirs') || undefined}
                    aria-describedby={
                      !isReceiptCapable('load-theirs')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('load-theirs')) onReloadConflict();
                    }}
                    className="rounded-lg border border-c-border-subtle px-2 py-1 font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.loadTheirs', 'Load theirs')}
                  </button>
                  <button
                    type="button"
                    data-notebook-action-id="rail:keep-mine"
                    aria-disabled={!isReceiptCapable('keep-mine') || undefined}
                    aria-describedby={
                      !isReceiptCapable('keep-mine')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('keep-mine')) onKeepMineConflict();
                    }}
                    className="rounded-lg border border-c-border-subtle px-2 py-1 font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.keepMine', 'Keep mine')}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-c-border-subtle p-3">
              <dt className="flex items-center gap-2 font-semibold text-c-text-secondary">
                <UserRound size={13} aria-hidden="true" />
                {t('notebook.rightRail.owner', 'Owner')}
              </dt>
              <dd data-testid="notebook-owner-state" className="mt-1 text-c-text">
                {ownerLabel ||
                  (activePage.ownerUserId
                    ? t('notebook.rightRail.ownerUnavailable', 'Owner identity unavailable')
                    : t('notebook.rightRail.ownerMissing', 'Owner not assigned'))}
              </dd>
            </div>

            <div className="rounded-xl border border-c-border-subtle p-3">
              <dt className="flex items-center gap-2 font-semibold text-c-text-secondary">
                <Eye size={13} aria-hidden="true" />
                {t('notebook.rightRail.visibility', 'Visibility')}
              </dt>
              <dd className="mt-2 grid grid-cols-2 gap-2">
                {(['private', 'project'] as const).map((visibility) => (
                  <button
                    key={visibility}
                    type="button"
                    data-notebook-action-id={`rail:visibility-${visibility}`}
                    aria-pressed={activePage.visibility === visibility}
                    aria-disabled={
                      !isReceiptCapable(`visibility-${visibility}`) ||
                      (visibility === 'project' && !activePage.projectId) ||
                      undefined
                    }
                    aria-describedby={
                      !isReceiptCapable(`visibility-${visibility}`)
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onClick={() => {
                      if (
                        isReceiptCapable(`visibility-${visibility}`) &&
                        !(visibility === 'project' && !activePage.projectId)
                      ) {
                        onSetVisibility?.(visibility);
                      }
                    }}
                    className="rounded-lg border border-c-border-subtle px-2 py-1.5 text-c-text-secondary aria-pressed:border-c-focus aria-pressed:bg-c-surface-raised aria-pressed:text-c-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {visibility === 'private'
                      ? t('notebook.rightRail.private', 'Private')
                      : t('notebook.rightRail.project', 'Project')}
                  </button>
                ))}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-c-border-subtle p-3">
                <dt className="flex items-center gap-2 font-semibold text-c-text-secondary">
                  <ShieldCheck size={13} aria-hidden="true" />
                  {t('notebook.rightRail.verification', 'Verification')}
                </dt>
                <dd className="mt-2 text-c-text">
                  <select
                    data-notebook-action-id="rail:verification-status"
                    aria-label={t('notebook.rightRail.verification', 'Verification')}
                    value={activePage.verificationStatus || 'unverified'}
                    aria-disabled={!isReceiptCapable('verification-status') || undefined}
                    aria-describedby={
                      !isReceiptCapable('verification-status')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onChange={(event) => {
                      if (isReceiptCapable('verification-status')) {
                        onSetVerificationStatus?.(
                          event.target.value as 'unverified' | 'verified' | 'disputed'
                        );
                      }
                    }}
                    disabled={!onSetVerificationStatus}
                    className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5"
                  >
                    <option value="unverified">
                      {t('notebook.rightRail.unverified', 'Unverified')}
                    </option>
                    <option value="verified">{t('notebook.rightRail.verified', 'Verified')}</option>
                    <option value="disputed">{t('notebook.rightRail.disputed', 'Disputed')}</option>
                  </select>
                </dd>
              </div>
              <div className="rounded-xl border border-c-border-subtle p-3">
                <dt className="flex items-center gap-2 font-semibold text-c-text-secondary">
                  <CalendarClock size={13} aria-hidden="true" />
                  {t('notebook.rightRail.review', 'Review')}
                </dt>
                <dd className="mt-2 text-c-text">
                  <select
                    data-notebook-action-id="rail:review-cadence"
                    aria-label={t('notebook.rightRail.reviewCadence', 'Review cadence')}
                    value={activePage.reviewCadence || 'monthly'}
                    aria-disabled={!isReceiptCapable('review-cadence') || undefined}
                    aria-describedby={
                      !isReceiptCapable('review-cadence')
                        ? 'notebook-rail-receipt-unavailable'
                        : undefined
                    }
                    onChange={(event) => {
                      if (isReceiptCapable('review-cadence')) {
                        onSetReviewCadence?.(
                          event.target.value as 'weekly' | 'monthly' | 'quarterly' | 'never'
                        );
                      }
                    }}
                    disabled={!onSetReviewCadence}
                    className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2 py-1.5"
                  >
                    <option value="weekly">{t('notebook.rightRail.weekly', 'Weekly')}</option>
                    <option value="monthly">{t('notebook.rightRail.monthly', 'Monthly')}</option>
                    <option value="quarterly">
                      {t('notebook.rightRail.quarterly', 'Quarterly')}
                    </option>
                    <option value="never">{t('notebook.rightRail.neverCadence', 'Never')}</option>
                  </select>
                </dd>
              </div>
            </div>

            <div className="rounded-xl border border-c-border-subtle p-3">
              <dt className="flex items-center gap-2 font-semibold text-c-text-secondary">
                <Tag size={13} aria-hidden="true" />
                {t('notebook.rightRail.tagsAndStatus', 'Tags and status')}
              </dt>
              <dd className="mt-2 flex flex-wrap gap-1.5 text-c-text">
                <span className="rounded-full bg-c-surface-raised px-2 py-1">
                  {activePage.status}
                </span>
                <span className="rounded-full bg-c-surface-raised px-2 py-1">
                  {activePage.maturity}
                </span>
                {noteTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-c-surface-raised px-2 py-1">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>

            <div className="rounded-xl border border-c-border-subtle p-3 text-c-text-secondary">
              <div>
                {t('notebook.rightRail.modified', 'Modified')}:{' '}
                {getRelativeTime?.(activePage.updatedAt) || activePage.updatedAt}
              </div>
              <div className="mt-1">
                {t('notebook.rightRail.wordCount', 'Words')}:{' '}
                {notePage?.wordCount ?? activePage.wordCount ?? 0}
              </div>
              <div className="mt-1">
                {t('notebook.rightRail.lastReviewed', 'Last reviewed')}:{' '}
                {activePage.lastReviewedAt
                  ? getRelativeTime?.(activePage.lastReviewedAt) || activePage.lastReviewedAt
                  : t('notebook.rightRail.never', 'Never')}
              </div>
              {onMarkReviewed && (
                <button
                  type="button"
                  data-notebook-action-id="rail:mark-reviewed"
                  aria-disabled={!isReceiptCapable('mark-reviewed') || undefined}
                  aria-describedby={
                    !isReceiptCapable('mark-reviewed')
                      ? 'notebook-rail-receipt-unavailable'
                      : undefined
                  }
                  onClick={() => {
                    if (isReceiptCapable('mark-reviewed')) onMarkReviewed();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle px-2 py-1 font-semibold hover:bg-c-surface-raised"
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  {t('notebook.rightRail.markReviewed', 'Mark reviewed')}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-c-border-subtle p-3">
              <dt className="font-semibold text-c-text-secondary">
                {t('notebook.rightRail.sourceAndNextAction', 'Source and next action')}
              </dt>
              <dd className="mt-2 space-y-1 text-c-text">
                <div>
                  {t('notebook.rightRail.source', 'Source')}:{' '}
                  {activePage.captureSource ||
                    activePage.captureMetadata?.sourceType ||
                    t('notebook.rightRail.sourceNotRecorded', 'Not recorded')}
                </div>
                <div>
                  {t('notebook.rightRail.nextAction', 'Next action')}:{' '}
                  {activePage.verificationStatus !== 'verified'
                    ? t('notebook.rightRail.verifyDocument', 'Verify document evidence')
                    : activePage.staleAt
                      ? t('notebook.rightRail.reviewStaleDocument', 'Review stale document')
                      : t('notebook.rightRail.keepCurrent', 'Keep current through the next review')}
                </div>
                {activePage.captureMetadata?.sourceId ? (
                  <details className="pt-1 text-c-text-muted">
                    <summary className="cursor-pointer">
                      {t('notebook.rightRail.technicalLineage', 'Technical lineage')}
                    </summary>
                    <code className="mt-1 block break-all text-[10px]">
                      {activePage.captureMetadata.sourceType || 'source'}:
                      {activePage.captureMetadata.sourceId}
                    </code>
                  </details>
                ) : null}
              </dd>
            </div>
          </dl>

          {onOpenAIChat ? (
            <button
              type="button"
              data-notebook-action-id="rail:open-teresa"
              onClick={onOpenAIChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-c-ai/30 bg-c-ai/[0.06] px-3 py-2 text-sm font-semibold text-c-ai"
            >
              <Sparkles size={14} aria-hidden="true" />
              {t('notebook.rightRail.openTeresa', 'Open Teresa')}
            </button>
          ) : null}
        </div>
      </div>

      {/* Tab B: Context — linked workspace items */}
      <div
        id="notebook-rail-panel-context"
        role="tabpanel"
        aria-labelledby="notebook-rail-tab-context"
        aria-hidden={activeTab !== 'context'}
        className={`flex flex-1 flex-col overflow-hidden ${activeTab === 'context' ? '' : 'hidden'}`}
      >
        <NotebookContextPanel
          open={true}
          onClose={onClose}
          editor={editor}
          noteId={activePage.id}
          noteTitle={activePage.title}
          noteTags={noteTags}
          allNotes={allPages}
          noteConvertedTo={activePage.convertedTo || []}
        />
      </div>
    </aside>
  );
};
