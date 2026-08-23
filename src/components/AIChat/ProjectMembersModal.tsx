/**
 * ProjectMembersModal (F2)
 *
 * Manage a team project's sharing: visibility (org-wide vs invited-only),
 * members and their roles (owner / editor / viewer). Mirrors Claude/ChatGPT
 * team-project sharing. Role gates are enforced server-side; the UI only
 * exposes what the current user (myRole) is allowed to do.
 */
import { Crown, FileText, Loader2, Plus, Shield, Trash2, Upload, UserPlus, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useChatProjectStore } from '../../store/useChatProjectStore';

type Role = 'owner' | 'editor' | 'viewer';
interface Member {
  user_id: string;
  role: Role;
  name?: string;
  email?: string;
}

interface ProjectKnowledgeItem {
  id: string;
  kind: 'text' | 'file';
  title?: string | null;
  content?: string | null;
  added_by?: string | null;
  added_at?: string | null;
  version?: number | null;
  content_hash?: string | null;
  hash_basis?: 'content' | 'source_reference' | null;
  provenance?: { type?: string; reference?: string | null } | null;
}

interface ProjectContextHistoryEvent {
  id: string;
  timestamp?: string;
  actorId?: string | null;
  action?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export const ProjectMembersModal: React.FC<ProjectMembersModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const { t } = useTranslation();
  const { updateProject, fetchProjects, projects } = useChatProjectStore();
  const project = projects.find((p) => p.id === projectId);

  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<'org' | 'private'>(project?.visibility || 'org');

  // F3: project knowledge
  const [knowledge, setKnowledge] = useState<ProjectKnowledgeItem[]>([]);
  const [contextHistory, setContextHistory] = useState<ProjectContextHistoryEvent[]>([]);
  const [contextHistoryStatus, setContextHistoryStatus] = useState<
    'loading' | 'available' | 'unavailable'
  >('loading');
  const [snippet, setSnippet] = useState('');
  const [snippetTitle, setSnippetTitle] = useState('');
  const [knBusy, setKnBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isOwner = myRole === 'owner';
  const canManage = myRole === 'owner' || myRole === 'editor';

  const loadKnowledge = useCallback(async () => {
    setContextHistoryStatus('loading');
    try {
      const res: any = await Api.getProjectKnowledge(projectId);
      setKnowledge(Array.isArray(res?.knowledge) ? res.knowledge : []);
      setContextHistory(Array.isArray(res?.history) ? res.history : []);
      setContextHistoryStatus(res?.historyStatus === 'available' ? 'available' : 'unavailable');
    } catch {
      setKnowledge([]);
      setContextHistory([]);
      setContextHistoryStatus('unavailable');
    }
  }, [projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await Api.getProjectMembers(projectId);
      setMembers(Array.isArray(res?.members) ? res.members : []);
      setMyRole(res?.myRole ?? null);
    } catch {
      /* surfaced via empty state */
    } finally {
      setLoading(false);
    }
    void loadKnowledge();
  }, [projectId, loadKnowledge]);

  const handleAddSnippet = async () => {
    const content = snippet.trim();
    if (!content) return;
    setKnBusy(true);
    try {
      await Api.addProjectKnowledge(projectId, {
        kind: 'text',
        title: snippetTitle.trim() || undefined,
        content,
      });
      setSnippet('');
      setSnippetTitle('');
      await loadKnowledge();
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.knowledge.addFailed', 'Could not add'));
    } finally {
      setKnBusy(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setKnBusy(true);
    try {
      const up: any = await Api.uploadChatAttachment(file);
      const docId = String(up?.docId || '');
      if (!docId) throw new Error('Upload failed');
      await Api.addProjectKnowledge(projectId, { kind: 'file', title: file.name, docId });
      await loadKnowledge();
      toast.success(t('aiChat.knowledge.fileAdded', 'File added to project'));
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.knowledge.uploadFailed', 'Could not upload'));
    } finally {
      setKnBusy(false);
    }
  };

  const handleDeleteKnowledge = async (kid: string) => {
    try {
      await Api.deleteProjectKnowledge(projectId, kid);
      setKnowledge((prev) => prev.filter((k) => k.id !== kid));
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.knowledge.deleteFailed', 'Could not delete'));
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setInviteEmail('');
    setInviteRole('viewer');
    setVisibility(project?.visibility || 'org');
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const handleSetVisibility = async (v: 'org' | 'private') => {
    if (!isOwner || v === visibility) return;
    setVisibility(v);
    try {
      await updateProject(projectId, { visibility: v } as any);
      await fetchProjects();
    } catch (e: any) {
      setVisibility((prev) => (prev === v ? project?.visibility || 'org' : prev));
      toast.error(
        e?.message || t('aiChat.members.visibilityFailed', 'Could not change visibility')
      );
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setBusy(true);
    try {
      await Api.addProjectMember(projectId, { email, role: inviteRole });
      setInviteEmail('');
      await load();
      void fetchProjects();
      toast.success(t('aiChat.members.added', 'Member added'));
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.members.addFailed', 'Could not add member'));
    } finally {
      setBusy(false);
    }
  };

  const handleRole = async (userId: string, role: Role) => {
    try {
      await Api.updateProjectMemberRole(projectId, userId, role);
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role } : m)));
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.members.roleFailed', 'Could not change role'));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await Api.removeProjectMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      void fetchProjects();
    } catch (e: any) {
      toast.error(e?.message || t('aiChat.members.removeFailed', 'Could not remove member'));
    }
  };

  if (!isOpen) return null;

  const roleIcon = (r: Role) =>
    r === 'owner' ? <Crown size={12} /> : r === 'editor' ? <Shield size={12} /> : null;

  const modal = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-navy-900 rounded-2xl w-[460px] max-w-[94vw] shadow-2xl border border-slate-200 dark:border-navy-700">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy-900 dark:text-white truncate">
              {t('aiChat.members.title', 'Share project')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{projectName}</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800"
            title={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Visibility */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-1.5">
              {t('aiChat.members.visibility', 'Visibility')}
            </div>
            <div className="flex gap-2">
              {(['org', 'private'] as const).map((v) => (
                <button
                  key={v}
                  disabled={!isOwner}
                  onClick={() => void handleSetVisibility(v)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    visibility === v
                      ? 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {v === 'org'
                      ? t('aiChat.members.visOrg', 'Whole organization')
                      : t('aiChat.members.visPrivate', 'Invited members only')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {v === 'org'
                      ? t('aiChat.members.visOrgDesc', 'Everyone in your org can see it')
                      : t('aiChat.members.visPrivateDesc', 'Only people you add below')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Invite */}
          {canManage && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-1.5">
                {t('aiChat.members.invite', 'Add member')}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleInvite();
                  }}
                  placeholder={t('aiChat.members.emailPlaceholder', 'name@company.com')}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2 py-2 text-xs"
                >
                  <option value="viewer">{t('aiChat.members.viewer', 'Viewer')}</option>
                  <option value="editor">{t('aiChat.members.editor', 'Editor')}</option>
                  <option value="owner">{t('aiChat.members.owner', 'Owner')}</option>
                </select>
                <button
                  onClick={() => void handleInvite()}
                  disabled={busy || !inviteEmail.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white px-3 py-2 text-xs font-semibold"
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 mb-1.5">
              {t('aiChat.members.list', 'Members')} ({members.length})
            </div>
            {loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 size={18} className="animate-spin text-slate-400" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                {t('aiChat.members.empty', 'No members yet')}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-navy-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-1">
                        {roleIcon(m.role)}
                        {m.name || m.email || m.user_id}
                      </div>
                      {m.email && m.name && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {m.email}
                        </div>
                      )}
                    </div>
                    {isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) => void handleRole(m.user_id, e.target.value as Role)}
                        className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-1.5 py-1 text-[11px]"
                      >
                        <option value="viewer">{t('aiChat.members.viewer', 'Viewer')}</option>
                        <option value="editor">{t('aiChat.members.editor', 'Editor')}</option>
                        <option value="owner">{t('aiChat.members.owner', 'Owner')}</option>
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        {m.role}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => void handleRemove(m.user_id)}
                        className="p-1 rounded text-slate-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                        title={t('aiChat.members.remove', 'Remove')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Project knowledge (F3) — text + files shared with members, fed to Teresa */}
          <div className="border-t border-slate-200 dark:border-navy-700 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {t('aiChat.knowledge.title', 'Project knowledge')}
              </div>
              {canManage && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={knBusy}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-500 disabled:opacity-50"
                >
                  <Upload size={12} />
                  {t('aiChat.knowledge.uploadFile', 'Upload file')}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
              {t(
                'aiChat.knowledge.hint',
                'Teresa uses this in every chat in the project (files are searched, notes are added to context).'
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadFile(f);
                e.target.value = '';
              }}
            />

            {canManage && (
              <div className="mb-2 space-y-1.5">
                <input
                  value={snippetTitle}
                  onChange={(e) => setSnippetTitle(e.target.value)}
                  placeholder={t('aiChat.knowledge.notePlaceholderTitle', 'Note title (optional)')}
                  className="w-full rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
                />
                <div className="flex items-end gap-2">
                  <textarea
                    value={snippet}
                    onChange={(e) => setSnippet(e.target.value)}
                    rows={2}
                    placeholder={t(
                      'aiChat.knowledge.notePlaceholder',
                      'Add a note Teresa should always know in this project…'
                    )}
                    className="flex-1 resize-none rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={() => void handleAddSnippet()}
                    disabled={knBusy || !snippet.trim()}
                    className="rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white p-2"
                    title={t('common.add', 'Add')}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {knowledge.length === 0 ? (
              <div className="py-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                {t('aiChat.knowledge.empty', 'No project knowledge yet')}
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {knowledge.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 bg-slate-50 dark:bg-navy-950/40"
                  >
                    {k.kind === 'file' ? (
                      <FileText size={13} className="shrink-0 mt-0.5 text-primary-500" />
                    ) : (
                      <FileText size={13} className="shrink-0 mt-0.5 text-slate-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-slate-800 dark:text-slate-100 truncate">
                        {k.title || (k.kind === 'file' ? 'File' : 'Note')}
                      </div>
                      {k.kind === 'text' && k.content && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {k.content}
                        </div>
                      )}
                      <div className="mt-1 text-[9px] text-slate-500 dark:text-slate-400 break-all">
                        {t('aiChat.knowledge.owner', 'Owner')}: {k.added_by || '—'} ·{' '}
                        {t('aiChat.knowledge.version', 'Version')}:{' '}
                        {k.provenance && k.content_hash ? (k.version ?? '—') : 'legacy'} ·{' '}
                        {t('aiChat.knowledge.source', 'Source')}: {k.provenance?.type || 'legacy'}
                        {k.content_hash
                          ? ` · ${
                              k.hash_basis === 'source_reference'
                                ? t('aiChat.knowledge.referenceHash', 'Reference hash')
                                : t('aiChat.knowledge.contentHash', 'Content hash')
                            }: ${k.content_hash}`
                          : ''}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => void handleDeleteKnowledge(k.id)}
                        className="p-1 rounded text-slate-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                        title={t('aiChat.knowledge.delete', 'Remove')}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <details className="mt-2 rounded-lg border border-slate-200 dark:border-navy-700 px-2 py-1.5">
              <summary className="cursor-pointer text-[10px] font-medium text-slate-600 dark:text-slate-300">
                {t('aiChat.knowledge.history', 'Context history')} ({contextHistory.length})
              </summary>
              {contextHistoryStatus === 'loading' ? (
                <div className="py-2 text-[10px] text-slate-500" role="status">
                  {t('common.loading', 'Loading')}
                </div>
              ) : contextHistoryStatus === 'unavailable' ? (
                <div className="py-2 text-[10px] text-danger-600" role="alert">
                  {t('aiChat.knowledge.historyUnavailable', 'Context history could not be loaded.')}
                </div>
              ) : contextHistory.length === 0 ? (
                <div className="py-2 text-[10px] text-slate-500">
                  {t('aiChat.knowledge.historyEmpty', 'No context changes recorded.')}
                </div>
              ) : (
                <ul className="mt-1 space-y-1">
                  {contextHistory.map((event) => {
                    const payload = event.after || event.before || {};
                    return (
                      <li key={event.id} className="text-[9px] text-slate-500 break-all">
                        {event.action || '—'} · {event.actorId || '—'} ·{' '}
                        {String(payload.version ?? '—')} · {String(payload.contentHash ?? '—')} ·{' '}
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return modal;
  return createPortal(modal, document.body);
};

export default ProjectMembersModal;
