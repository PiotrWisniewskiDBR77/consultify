/**
 * NotebookRightRail — SPEC-A accordion rail for the Notebook document artifact.
 *
 * DEC-2026-08-25-69 ("prawe menu rozwijane pochodzi z wersji aplikacji sprzed
 * pół roku"): the previous Work/Context tab pair implemented the correct
 * information split (document record vs. living relationships) but never
 * adopted the shared right-panel canon (`ArtifactRightPanel`,
 * Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §9.1a/§11.2) — 360px,
 * accordion sections in a fixed order, hairline dividers, no bespoke tablist.
 * This rewrite keeps every governance control and every Context relation
 * 1:1, but presents them as accordion sections instead of tabs:
 *
 *   Akcje · Właściwości (was "Work") · Powiązania (was "Context")
 *   · Komentarze (new, empty placeholder — no comment system on notes yet)
 *   · Historia i AI (version history + "Open Teresa")
 *
 * State (open/tab) is still owned by the caller for the `open`/`activeTab`
 * props — `activeTab` now means "which section an external caller wants
 * revealed" (properties for 'work', relations for 'context') rather than
 * "which tab is exclusively visible"; both sections can be open together.
 */
import type { Editor } from '@tiptap/react';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  History,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
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

const RAIL_SECTION_ORDER = ['actions', 'properties', 'relations', 'comments', 'history'] as const;
type RailSectionId = (typeof RAIL_SECTION_ORDER)[number];

interface NotebookRightRailProps {
  open: boolean;
  /** 'work' asks the rail to reveal Właściwości; 'context' asks for Powiązania. */
  activeTab: 'work' | 'context';
  onTabChange: (tab: 'work' | 'context') => void;
  onClose: () => void;
  ownerLabel?: string;

  // Active page data
  activePage: NotebookPage | null;
  allPages: NotebookPage[];
  editor: Editor | null;

  // Props forwarded to AIChatInlinePanel (legacy interface — see note below)
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

  /** Akcje section (DEC-69, "same action registry as the kebab" — MYW-NBK-CORE-002). */
  onExport?: () => void;
  onShare?: () => void;
  onToggleVersionHistory?: () => void;
  versionHistoryOpen?: boolean;
}

const SectionHeader: React.FC<{
  id: RailSectionId;
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}> = ({ label, count, open, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={open}
    className="flex h-11 w-full items-center gap-2 px-4 text-left hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
  >
    <span className="flex-1 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
      {label}
    </span>
    {typeof count === 'number' && count > 0 ? (
      <span className="text-[11px] tabular-nums text-c-text-muted">{count}</span>
    ) : null}
    <ChevronDown
      size={16}
      className={`shrink-0 text-c-text-muted transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
      aria-hidden="true"
    />
  </button>
);

const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  hint?: string;
  pressed?: boolean;
  actionId: string;
}> = ({ icon, label, onClick, disabled, title, hint, pressed, actionId }) => (
  <button
    type="button"
    data-notebook-action-id={actionId}
    onClick={onClick}
    disabled={!onClick || disabled}
    title={title}
    aria-pressed={pressed}
    className="-mx-2 flex h-8 w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-c-surface-raised aria-pressed:text-c-text"
  >
    <span className="shrink-0 text-c-text-muted">{icon}</span>
    <span className="flex-1 min-w-0 truncate">{label}</span>
    {hint ? <span className="shrink-0 text-[10px] text-c-text-muted">{hint}</span> : null}
  </button>
);

export const NotebookRightRail: React.FC<NotebookRightRailProps> = ({
  open,
  activeTab,
  onTabChange: _onTabChange,
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
  onExport,
  onShare,
  onToggleVersionHistory,
  versionHistoryOpen,
}) => {
  const { t } = useTranslation();
  const isReceiptCapable = (actionId: string) =>
    receiptCapableActionIds === undefined || receiptCapableActionIds.includes(actionId);

  const [openIds, setOpenIds] = useState<Set<RailSectionId>>(
    () => new Set<RailSectionId>(['actions', 'properties', 'relations'])
  );

  // An external caller asking to reveal 'work' or 'context' (e.g. the kebab
  // menu's "Verification" shortcut) re-opens the matching section without
  // closing any section the user already has open — the accordion allows
  // several sections open at once, unlike the old exclusive tabs.
  useEffect(() => {
    setOpenIds((prev) => {
      const target: RailSectionId = activeTab === 'work' ? 'properties' : 'relations';
      if (prev.has(target)) return prev;
      const next = new Set(prev);
      next.add(target);
      return next;
    });
  }, [activeTab]);

  const toggle = (id: RailSectionId) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!open || !activePage) return null;

  const section = (id: RailSectionId, label: string, count: number | undefined, body: React.ReactNode) => {
    const isOpen = openIds.has(id);
    return (
      <section
        key={id}
        id={`notebook-rail-section-${id}`}
        className="border-b border-c-border-subtle last:border-b-0"
      >
        <SectionHeader id={id} label={label} count={count} open={isOpen} onToggle={() => toggle(id)} />
        {isOpen ? <div className="px-4 pb-4 pt-0.5">{body}</div> : null}
      </section>
    );
  };

  return (
    <aside
      aria-label={t('notebook.rightRail.label', 'Document details and context')}
      className="flex shrink-0 flex-col overflow-hidden bg-c-surface"
      style={{ width: 360, minWidth: 360 }}
    >
      {/* Rail header — title + close, no tabs (DEC-69). */}
      <div className="flex h-11 items-center gap-2 border-b border-c-border-subtle px-4">
        <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold text-c-text">
          {activePage.title || t('notebook.rightRail.untitled', 'Bez tytułu')}
        </span>
        <button
          type="button"
          data-notebook-action-id="rail:close"
          onClick={onClose}
          aria-label={t('notebook.rightRail.closePanel', 'Close panel')}
          className="rounded-md p-1 text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text"
          title={t('notebook.rightRail.closePanel', 'Close panel')}
        >
          <X size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 1 · AKCJE */}
        {section(
          'actions',
          t('notebook.rightRail.actions', 'Akcje'),
          undefined,
          <div className="space-y-0.5">
            <ActionRow
              actionId="rail:export"
              icon={<Download size={15} />}
              label={t('notebook.rightRail.export', 'Eksportuj')}
              onClick={onExport}
              hint="PDF · Word"
            />
            <ActionRow
              actionId="rail:share"
              icon={<Share2 size={15} />}
              label={t('notebook.rightRail.share', 'Udostępnij')}
              onClick={onShare}
            />
            <ActionRow
              actionId="rail:copy-link"
              icon={<Copy size={15} />}
              label={t('notebook.rightRail.copyLink', 'Kopiuj link')}
              disabled
              title={t('notebook.rightRail.copyLinkReason', 'Akcja czeka na definicję zakresu')}
            />
            <ActionRow
              actionId="rail:version-history"
              icon={<History size={15} />}
              label={t('notebook.rightRail.versionHistory', 'Historia wersji')}
              onClick={onToggleVersionHistory}
              pressed={versionHistoryOpen}
            />
          </div>
        )}

        {/* 2 · WŁAŚCIWOŚCI (was "Work") */}
        {section(
          'properties',
          t('notebook.rightRail.properties', 'Właściwości'),
          undefined,
          <div className="space-y-3">
            {receiptCapableActionIds?.length === 0 ? (
              <p
                id="notebook-rail-receipt-unavailable"
                className="text-xs text-c-text-muted"
              >
                {t(
                  'notebook.rightRail.receiptUnavailable',
                  'Editing controls are unavailable until the server can return a durable action receipt.'
                )}
              </p>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-c-text-muted">
                  {t('notebook.rightRail.saveStatus', 'Save status')}
                </span>
                <span data-testid="notebook-save-state" role={saveState === 'error' ? 'alert' : 'status'}>
                  {saveState === 'saving' && (
                    <span className="inline-flex items-center gap-1.5 text-c-text">
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
              </div>
              {saveState === 'error' && onRetrySave && (
                <button
                  type="button"
                  data-notebook-action-id="rail:retry-save"
                  aria-disabled={!isReceiptCapable('retry-save') || undefined}
                  aria-describedby={
                    !isReceiptCapable('retry-save') ? 'notebook-rail-receipt-unavailable' : undefined
                  }
                  onClick={() => {
                    if (isReceiptCapable('retry-save')) onRetrySave();
                  }}
                  className="mt-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                >
                  {t('common.retry', 'Retry')}
                </button>
              )}
              {saveState === 'conflict' && onReloadConflict && onKeepMineConflict && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-notebook-action-id="rail:load-theirs"
                    aria-disabled={!isReceiptCapable('load-theirs') || undefined}
                    aria-describedby={
                      !isReceiptCapable('load-theirs') ? 'notebook-rail-receipt-unavailable' : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('load-theirs')) onReloadConflict();
                    }}
                    className="rounded-md border border-c-border-subtle px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.loadTheirs', 'Load theirs')}
                  </button>
                  <button
                    type="button"
                    data-notebook-action-id="rail:keep-mine"
                    aria-disabled={!isReceiptCapable('keep-mine') || undefined}
                    aria-describedby={
                      !isReceiptCapable('keep-mine') ? 'notebook-rail-receipt-unavailable' : undefined
                    }
                    onClick={() => {
                      if (isReceiptCapable('keep-mine')) onKeepMineConflict();
                    }}
                    className="rounded-md border border-c-border-subtle px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('notebook.rightRail.keepMine', 'Keep mine')}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <UserRound size={13} aria-hidden="true" />
                {t('notebook.rightRail.owner', 'Owner')}
              </span>
              <span data-testid="notebook-owner-state" className="min-w-0 flex-1 text-c-text">
                {ownerLabel ||
                  (activePage.ownerUserId
                    ? t('notebook.rightRail.ownerUnavailable', 'Owner identity unavailable')
                    : t('notebook.rightRail.ownerMissing', 'Owner not assigned'))}
              </span>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <Eye size={13} aria-hidden="true" />
                {t('notebook.rightRail.visibility', 'Visibility')}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
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
                    className="rounded-full border border-c-border-subtle px-2.5 py-1 text-[11.5px] text-c-text-secondary aria-pressed:border-c-border-strong aria-pressed:bg-c-surface-raised aria-pressed:text-c-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {visibility === 'private'
                      ? t('notebook.rightRail.private', 'Private')
                      : t('notebook.rightRail.project', 'Project')}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <ShieldCheck size={13} aria-hidden="true" />
                {t('notebook.rightRail.verification', 'Verification')}
              </span>
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
                className="-mx-1.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-c-text hover:border-c-border-subtle hover:bg-c-surface-raised focus:border-c-border focus:bg-c-surface focus:outline-none"
              >
                <option value="unverified">{t('notebook.rightRail.unverified', 'Unverified')}</option>
                <option value="verified">{t('notebook.rightRail.verified', 'Verified')}</option>
                <option value="disputed">{t('notebook.rightRail.disputed', 'Disputed')}</option>
              </select>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <CalendarClock size={13} aria-hidden="true" />
                {t('notebook.rightRail.review', 'Review')}
              </span>
              <select
                data-notebook-action-id="rail:review-cadence"
                aria-label={t('notebook.rightRail.reviewCadence', 'Review cadence')}
                value={activePage.reviewCadence || 'monthly'}
                aria-disabled={!isReceiptCapable('review-cadence') || undefined}
                aria-describedby={
                  !isReceiptCapable('review-cadence') ? 'notebook-rail-receipt-unavailable' : undefined
                }
                onChange={(event) => {
                  if (isReceiptCapable('review-cadence')) {
                    onSetReviewCadence?.(
                      event.target.value as 'weekly' | 'monthly' | 'quarterly' | 'never'
                    );
                  }
                }}
                disabled={!onSetReviewCadence}
                className="-mx-1.5 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-c-text hover:border-c-border-subtle hover:bg-c-surface-raised focus:border-c-border focus:bg-c-surface focus:outline-none"
              >
                <option value="weekly">{t('notebook.rightRail.weekly', 'Weekly')}</option>
                <option value="monthly">{t('notebook.rightRail.monthly', 'Monthly')}</option>
                <option value="quarterly">{t('notebook.rightRail.quarterly', 'Quarterly')}</option>
                <option value="never">{t('notebook.rightRail.neverCadence', 'Never')}</option>
              </select>
            </div>

            <div className="flex items-start gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-1.5 text-c-text-muted">
                <Tag size={13} aria-hidden="true" />
                {t('notebook.rightRail.tagsAndStatus', 'Tags and status')}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <span className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary">
                  {activePage.status}
                </span>
                <span className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary">
                  {activePage.maturity}
                </span>
                {noteTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </div>

            <div className="space-y-1 border-t border-c-border-subtle pt-3 text-[12.5px] text-c-text-secondary">
              <div>
                {t('notebook.rightRail.modified', 'Modified')}:{' '}
                {getRelativeTime?.(activePage.updatedAt) || activePage.updatedAt}
              </div>
              <div>
                {t('notebook.rightRail.wordCount', 'Words')}:{' '}
                {notePage?.wordCount ?? activePage.wordCount ?? 0}
              </div>
              <div>
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
                    !isReceiptCapable('mark-reviewed') ? 'notebook-rail-receipt-unavailable' : undefined
                  }
                  onClick={() => {
                    if (isReceiptCapable('mark-reviewed')) onMarkReviewed();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  {t('notebook.rightRail.markReviewed', 'Mark reviewed')}
                </button>
              )}
            </div>

            <div className="space-y-1 border-t border-c-border-subtle pt-3 text-[12.5px]">
              <div className="text-c-text">
                {t('notebook.rightRail.source', 'Source')}:{' '}
                {activePage.captureSource ||
                  activePage.captureMetadata?.sourceType ||
                  t('notebook.rightRail.sourceNotRecorded', 'Not recorded')}
              </div>
              <div className="text-c-text">
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
            </div>
          </div>
        )}

        {/* 3 · POWIĄZANIA (was "Context") */}
        {section(
          'relations',
          t('notebook.rightRail.relations', 'Powiązania'),
          undefined,
          <NotebookContextPanel
            embedded
            open={true}
            onClose={onClose}
            editor={editor}
            noteId={activePage.id}
            noteTitle={activePage.title}
            noteTags={noteTags}
            allNotes={allPages}
            noteConvertedTo={activePage.convertedTo || []}
          />
        )}

        {/* 4 · KOMENTARZE (new — no comment system on notes yet) */}
        {section(
          'comments',
          t('notebook.rightRail.comments', 'Komentarze'),
          0,
          <p className="text-xs italic text-c-text-muted">
            {t('notebook.rightRail.noComments', 'Brak komentarzy do tego dokumentu.')}
          </p>
        )}

        {/* 5 · HISTORIA I AI */}
        {section(
          'history',
          t('notebook.rightRail.historyAndAi', 'Historia i AI'),
          undefined,
          <div className="space-y-2">
            {versionHistoryOpen ? (
              <p className="flex items-center gap-1.5 text-[11.5px] text-c-text-secondary">
                <History size={13} aria-hidden="true" />
                {t(
                  'notebook.rightRail.versionHistoryOpenHint',
                  'Historia wersji otwarta poniżej dokumentu — patrz sekcja Akcje.'
                )}
              </p>
            ) : (
              <p className="text-[11.5px] text-c-text-muted">
                {t(
                  'notebook.rightRail.versionHistoryHint',
                  'Otwórz historię wersji w sekcji Akcje, żeby zobaczyć poprzednie zapisy.'
                )}
              </p>
            )}
            {onOpenAIChat ? (
              <button
                type="button"
                data-notebook-action-id="rail:open-teresa"
                onClick={onOpenAIChat}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-c-ai/30 bg-c-ai/[0.06] px-3 py-2 text-sm font-semibold text-c-ai"
              >
                <Sparkles size={14} aria-hidden="true" />
                {t('notebook.rightRail.openTeresa', 'Open Teresa')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
};
