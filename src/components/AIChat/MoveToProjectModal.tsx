/**
 * MoveToProjectModal
 *
 * Allows moving a conversation to a chat folder ("chat project") or removing it from one.
 * This is used by `ConversationActions` ("Dodaj do projektu"/"Zmień projekt").
 */

import { Folder, Plus, Search, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useChatProjectStore } from '../../store/useChatProjectStore';
import { requiresOrganizationVisibilityConsent } from './chatHistoryVisibility';

interface ConversationLike {
  id: string;
  title?: string;
  chatProjectId?: string | null;
  chatProjectScope?: 'personal' | 'team' | null;
  [key: string]: any;
}

interface MoveToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationLike;
  /** optional callback for analytics / parent state */
  onMove?: (projectId: string | null) => void;
}

export const MoveToProjectModal: React.FC<MoveToProjectModalProps> = ({
  isOpen,
  onClose,
  conversation,
  onMove,
}) => {
  const { t } = useTranslation();
  const {
    projects,
    isLoading,
    fetchProjects,
    createProject,
    updateProject,
    moveConversationToProject,
    getPersonalProjects,
    getTeamProjects,
  } = useChatProjectStore();

  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | 'remove' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<'personal' | 'team'>('personal');
  const [instructions, setInstructions] = useState('');
  const [instructionsBusy, setInstructionsBusy] = useState(false);
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const [visibilityReceipts, setVisibilityReceipts] = useState<
    Array<{
      id: string;
      timestamp: string;
      actorId?: string | null;
      from?: { scope?: string };
      to?: { scope?: string };
      policyVersion?: string | null;
    }>
  >([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setError(null);
    setShowCreate(false);
    setNewName('');
    void fetchProjects();
    setReceiptsLoading(true);
    setReceiptsError(null);
    void Api.getConversationVisibilityReceipts(conversation.id)
      .then((result) => setVisibilityReceipts(result.receipts || []))
      .catch(() => {
        setVisibilityReceipts([]);
        setReceiptsError(
          t('aiChat.visibilityHistoryUnavailable', 'Visibility history could not be loaded.')
        );
      })
      .finally(() => setReceiptsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, conversation.id]);

  const currentProject = useMemo(() => {
    const id = conversation?.chatProjectId;
    if (!id) return null;
    return projects.find((p) => p.id === id) || null;
  }, [conversation?.chatProjectId, projects]);

  // Sync the instructions editor whenever the active project changes.
  useEffect(() => {
    setInstructions(currentProject?.customInstructions || '');
    setInstructionsSaved(false);
  }, [currentProject?.id, currentProject?.customInstructions]);

  const handleSaveInstructions = async () => {
    if (!currentProject) return;
    setInstructionsBusy(true);
    setError(null);
    try {
      await updateProject(currentProject.id, { customInstructions: instructions.trim() });
      setInstructionsSaved(true);
      setTimeout(() => setInstructionsSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || t('aiChat.projectBrief.saveFailed', 'Could not save instructions.'));
    } finally {
      setInstructionsBusy(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPersonal = useMemo(() => {
    const list = getPersonalProjects();
    if (!normalizedQuery) return list;
    return list.filter((p) =>
      String(p.name || '')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [getPersonalProjects, normalizedQuery, projects]);

  const filteredTeam = useMemo(() => {
    const list = getTeamProjects();
    if (!normalizedQuery) return list;
    return list.filter((p) =>
      String(p.name || '')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [getTeamProjects, normalizedQuery, projects]);

  const handleMove = async (projectId: string | null) => {
    const destination = projectId ? projects.find((project) => project.id === projectId) : null;
    const broadensVisibility = requiresOrganizationVisibilityConsent(
      destination?.scope,
      currentProject?.scope
    );
    if (
      broadensVisibility &&
      !window.confirm(
        t(
          'aiChat.confirmMovePrivateToOrganization',
          'Move this private conversation to an organization folder? Organization members with access to the folder will be able to see it.'
        )
      )
    ) {
      return;
    }
    setError(null);
    setBusyId(projectId || 'remove');
    try {
      const result = await moveConversationToProject(conversation.id, projectId, {
        visibilityConsent: broadensVisibility,
      });
      if (result.visibilityReceiptId) {
        toast.success(
          `${t('aiChat.visibilityConsentRecorded', 'Organization visibility recorded. Receipt')}: ${result.visibilityReceiptId}`,
          { duration: 8000 }
        );
      }
      onMove?.(projectId);
      onClose();
    } catch (e: any) {
      setError(
        e?.message ||
          t('aiChat.moveToFolderFailed', 'Nie udało się przenieść rozmowy. Spróbuj ponownie.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    setBusyId('create');
    try {
      const created = await createProject({ name, scope: newScope });
      await handleMove(created.id);
    } catch (e: any) {
      setError(
        e?.message ||
          t('aiChat.createFolderFailed', 'Nie udało się utworzyć folderu. Spróbuj ponownie.')
      );
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  // chat-history fix (feedback #45e50d65, #84f6e58f, #fb2d4e30):
  // Modal was rendered inline inside <ConversationItem>, which has an onClick that
  // selects the conversation. Clicking anywhere in the modal (search input, folder
  // button) bubbled up to that parent and either navigated away or re-rendered the
  // sidebar, tearing down the modal. React Portal moves the modal to document.body
  // so DOM events no longer bubble through ConversationItem / ConversationActions.
  const modal = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('aiChat.moveToFolder', 'Move to folder')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        // Extra defense-in-depth: never let clicks inside this portal bubble
        // through to whatever React parent owns this modal instance.
        e.stopPropagation();
      }}
    >
      <div className="bg-white dark:bg-navy-900 rounded-2xl w-[420px] max-w-[92vw] shadow-2xl border border-slate-200 dark:border-navy-700">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy-900 dark:text-white truncate">
              {t('aiChat.moveToFolder', 'Move to folder')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {conversation?.title || t('aiChat.newConversation', 'New conversation')}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            title={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Current */}
          <div className="mb-4">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
              {t('aiChat.currentFolder', 'Current')}
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {currentProject ? (
                <div className="flex items-center gap-2">
                  <Folder size={14} style={{ color: currentProject.color }} />
                  <span className="truncate">{currentProject.name}</span>
                  <span className="ml-auto text-[10px] text-slate-600 dark:text-slate-500 uppercase">
                    {currentProject.scope === 'team'
                      ? t('aiChat.teamFolder', 'Organization')
                      : t('aiChat.personalFolder', 'Personal')}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 dark:text-slate-400 italic">
                  {t('aiChat.noFolder', 'No folder')}
                </span>
              )}
            </div>
            {conversation?.chatProjectId && (
              <button
                onClick={() => handleMove(null)}
                disabled={busyId !== null}
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
              >
                <X size={14} />
                {t('aiChat.removeFromFolder', 'Remove from folder')}
              </button>
            )}

            {/* Per-project custom instructions (composer #5). Shown only when the
                conversation belongs to a project — this brief is injected into
                Teresa's system prompt for every chat in that project. */}
            {currentProject && (
              <div className="mt-3 rounded-xl border border-slate-200 dark:border-navy-700 p-3 bg-slate-50/60 dark:bg-navy-950/40">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
                    {t('aiChat.projectBrief.title', 'Project instructions')}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-500">
                    {instructions.length}/4000
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {t(
                    'aiChat.projectBrief.hint',
                    'Teresa follows this in every chat in this project (tone, context, goals).'
                  )}
                </p>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value.slice(0, 4000))}
                  rows={3}
                  placeholder={t(
                    'aiChat.projectBrief.placeholder',
                    'e.g. We are a B2B SaaS in fintech. Be concise, cite sources, prefer EU regulations…'
                  )}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  {instructionsSaved && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {t('common.saved', 'Saved')}
                    </span>
                  )}
                  <button
                    onClick={() => void handleSaveInstructions()}
                    disabled={
                      instructionsBusy ||
                      instructions.trim() === (currentProject.customInstructions || '').trim()
                    }
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white transition-colors"
                  >
                    {instructionsBusy ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <section
            className="mb-4 rounded-xl border border-slate-200 dark:border-navy-700 p-3"
            aria-labelledby="visibility-history-heading"
          >
            <div
              id="visibility-history-heading"
              className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
            >
              {t('aiChat.visibilityHistory', 'Visibility history')}
            </div>
            {receiptsLoading ? (
              <p className="mt-2 text-xs text-slate-500" role="status">
                {t('common.loading', 'Loading')}
              </p>
            ) : receiptsError ? (
              <p className="mt-2 text-xs text-danger-600 dark:text-danger-400" role="alert">
                {receiptsError}
              </p>
            ) : visibilityReceipts.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('aiChat.noVisibilityChanges', 'No organization visibility changes recorded.')}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {visibilityReceipts.map((receipt) => (
                  <li key={receipt.id} className="text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      {t('aiChat.visibilityChanged', 'Visibility changed')}:{' '}
                      {receipt.from?.scope || '—'} → {receipt.to?.scope || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(receipt.timestamp).toLocaleString()} ·{' '}
                      {receipt.policyVersion || '—'} · {receipt.id}
                    </div>
                    {receipt.actorId && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t('aiChat.visibilityChangedBy', 'Actor')}: {receipt.actorId}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Search */}
          <div className="relative mb-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('aiChat.searchFoldersPlaceholder', 'Search folders...')}
              className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Create */}
          <div className="mb-4">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-xl border border-dashed border-slate-300 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-navy-600 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                <Plus size={16} />
                {t('aiChat.createFolder', 'Create folder')}
              </button>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700 p-3 bg-white dark:bg-navy-900">
                <div className="flex items-center gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreate();
                      if (e.key === 'Escape') {
                        setShowCreate(false);
                        setNewName('');
                        setNewScope('personal');
                      }
                    }}
                    placeholder={t('aiChat.folderName', 'Folder name...')}
                    className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowCreate(false)}
                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    title={t('common.cancel', 'Cancel')}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewScope('personal')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        newScope === 'personal'
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                          : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <Folder size={12} className="inline mr-1" />
                      {t('aiChat.personalFolder', 'Personal')}
                    </button>
                    <button
                      onClick={() => setNewScope('team')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        newScope === 'team'
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                          : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <Users size={12} className="inline mr-1" />
                      {t('aiChat.teamFolder', 'Organization')}
                    </button>
                  </div>
                  <button
                    onClick={() => void handleCreate()}
                    disabled={!newName.trim() || busyId !== null}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white transition-colors"
                  >
                    {t('common.add', 'Add')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-900/40 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* List */}
          <div className="max-h-72 overflow-y-auto space-y-4">
            {isLoading && projects.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('common.loading', 'Loading')}
              </div>
            ) : (
              <>
                <Section
                  title={t('aiChat.myFolders', 'My Folders')}
                  icon={<Folder size={12} />}
                  items={filteredPersonal}
                  activeId={conversation?.chatProjectId || null}
                  busyId={busyId}
                  onPick={(id) => void handleMove(id)}
                />
                <Section
                  title={t('aiChat.teamFolders', 'Team Folders')}
                  icon={<Users size={12} />}
                  items={filteredTeam}
                  activeId={conversation?.chatProjectId || null}
                  busyId={busyId}
                  onPick={(id) => void handleMove(id)}
                />
                {filteredPersonal.length === 0 && filteredTeam.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('aiChat.noFolders', 'No folders found')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );

  // Render through a portal so clicks never bubble back to the conversation list
  // item that owns this component instance. Fallback to inline rendering if the
  // document body is not available (SSR / tests).
  if (typeof document === 'undefined' || !document.body) return modal;
  return createPortal(modal, document.body);
};

const MAX_VISIBLE_FOLDERS = 4; // C3.5: max 4 per section + scroll

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: Array<{
    id: string;
    name: string;
    color?: string;
    scope?: string;
    conversationCount?: number;
  }>;
  activeId: string | null;
  busyId: string | 'remove' | 'create' | null;
  onPick: (id: string) => void;
}> = ({ title, icon, items, activeId, busyId, onPick }) => {
  const [showAll, setShowAll] = React.useState(false);
  const hasMore = items.length > MAX_VISIBLE_FOLDERS;
  const visibleItems = showAll ? items : items.slice(0, MAX_VISIBLE_FOLDERS);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          {icon}
          {title}
        </div>
        <div className="ml-auto text-[10px] text-slate-600 dark:text-slate-400">{items.length}</div>
      </div>
      <div className="space-y-1">
        {visibleItems.map((p) => {
          const active = activeId === p.id;
          const disabled = busyId !== null;
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors border ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <Folder size={14} style={{ color: p.color || '#6366f1' }} />
              <span className="truncate flex-1">{p.name}</span>
              {typeof p.conversationCount === 'number' && (
                <span className="text-[10px] text-slate-600 dark:text-slate-500">
                  {p.conversationCount}
                </span>
              )}
            </button>
          );
        })}
        {/* C3.5: Show more / less toggle */}
        {hasMore && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full text-center py-1.5 text-[11px] font-medium text-primary-500 hover:text-primary-400 transition-colors"
          >
            {showAll ? `Show less` : `Show ${items.length - MAX_VISIBLE_FOLDERS} more…`}
          </button>
        )}
      </div>
    </div>
  );
};

export default MoveToProjectModal;
