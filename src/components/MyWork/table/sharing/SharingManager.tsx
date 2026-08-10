/**
 * SharingManager — panel for managing view sharing, base collaborators,
 * and API access settings.
 */
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Globe,
  Key,
  Link2,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ─── Types ───────────────────────────────────────────────────────

interface SharedView {
  id: string;
  name: string;
  token: string;
  url: string;
  createdAt: string;
  expiresAt: string | null;
  hasPassword: boolean;
}

interface Collaborator {
  id: string;
  userId: string;
  email: string;
  name?: string;
  role: string;
  addedAt: string;
}

type SharingTab = 'views' | 'collaborators' | 'api';

interface SharingManagerProps {
  baseId: string;
  views?: Array<{ id: string; name: string; shareToken?: string }>;
  onClose: () => void;
}

const ROLES = [
  { value: 'owner', labelEn: 'Owner', labelPl: 'Właściciel' },
  { value: 'editor', labelEn: 'Editor', labelPl: 'Edytor' },
  { value: 'commenter', labelEn: 'Commenter', labelPl: 'Komentujący' },
  { value: 'viewer', labelEn: 'Viewer', labelPl: 'Przeglądający' },
];

function formatDate(iso: string | null | undefined, isPl: boolean): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

// ─── Component ───────────────────────────────────────────────────

export const SharingManager: React.FC<SharingManagerProps> = ({ baseId, views = [], onClose }) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [tab, setTab] = useState<SharingTab>('views');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);

  // Role change
  const [roleMenuOpen, setRoleMenuOpen] = useState<string | null>(null);

  const sharedViews = views.filter((v) => v.shareToken);

  // ── Fetch collaborators ────────────────────────────────────────
  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TablePlatformApi.listBaseCollaborators(baseId);
      setCollaborators(Array.isArray(data) ? data : []);
    } catch {
      // silently fail — collaborators endpoint may not be implemented
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  useEffect(() => {
    if (tab === 'collaborators') {
      fetchCollaborators();
    }
  }, [tab, fetchCollaborators]);

  // ── Actions ────────────────────────────────────────────────────
  const handleCopyLink = (viewId: string, token: string) => {
    const url = `${window.location.origin}/public/views/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(viewId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success(t('ideas.table.linkCopied', 'Link copied'));
  };

  const handleRevokeShare = async (viewId: string) => {
    try {
      await TablePlatformApi.unshareView(viewId);
      toast.success(t('ideas.table.shareRevoked', 'Share revoked'));
    } catch {
      toast.error(t('ideas.table.failedToRevoke', 'Failed to revoke'));
    }
  };

  // Program B (E02) — dwie ścieżki, jedna funkcja rejestru: klik człowieka =
  // `ctx.params.run` (rejestr wykonuje ORYGINALNY callback wprost); Teresa =
  // ta sama funkcja rejestru woła REST bezpośrednio (`runTableSharing*Callback`
  // w `ideaActionRegistry.ts`).
  const runSharingAction = (
    actionId: string,
    run: () => void,
    params?: Record<string, unknown>
  ) => {
    const ctx: ActionContext = {
      ideaId: baseId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: { run, ...(params || {}) },
    };
    void runIdeaAction(actionId, ctx);
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error(t('ideas.table.enterEmailAddress', 'Enter email address'));
      return;
    }
    runSharingAction(
      'table.sharing.invite',
      async () => {
        setInviting(true);
        try {
          const result = await TablePlatformApi.inviteCollaborator(
            baseId,
            inviteEmail.trim(),
            inviteRole
          );
          setCollaborators((prev) => [...prev, result]);
          toast.success(t('ideas.table.invitationSent', 'Invitation sent'));
          setInviteEmail('');
          setShowInvite(false);
        } catch {
          toast.error(t('ideas.table.failedToInvite', 'Failed to invite'));
        } finally {
          setInviting(false);
        }
      },
      { baseId, email: inviteEmail.trim(), role: inviteRole }
    );
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await TablePlatformApi.updateCollaboratorRole(baseId, userId, newRole);
      setCollaborators((prev) =>
        prev.map((c) => (c.userId === userId ? { ...c, role: newRole } : c))
      );
      toast.success(t('ideas.table.roleUpdated', 'Role updated'));
    } catch {
      toast.error(t('ideas.table.failedToUpdateRole', 'Failed to update role'));
    }
    setRoleMenuOpen(null);
  };

  const handleRemoveCollaborator = (userId: string) => {
    runSharingAction(
      'table.sharing.remove_collaborator',
      async () => {
        try {
          await TablePlatformApi.removeCollaborator(baseId, userId);
          setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
          toast.success(t('ideas.table.accessRemoved', 'Access removed'));
        } catch {
          toast.error(t('ideas.table.failedToRemove', 'Failed to remove'));
        }
      },
      { baseId, userId }
    );
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
        >
          <ChevronLeft size={16} className="text-c-text-secondary" />
        </button>
        <Shield size={18} className="text-c-text-secondary" />
        <h3 className="text-sm font-semibold text-c-text">{t('ideas.table.sharing', 'Sharing')}</h3>
      </div>

      {/* Tab bar */}
      <div className="flex items-center rounded-lg bg-c-surface-raised p-0.5 mb-4">
        {[
          { key: 'views' as const, icon: Globe, en: 'Views', pl: 'Widoki' },
          { key: 'collaborators' as const, icon: Users, en: 'People', pl: 'Osoby' },
          { key: 'api' as const, icon: Key, en: 'API', pl: 'API' },
        ].map(({ key, icon: Icon, en, pl }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors flex-1 justify-center ${
              tab === key
                ? 'bg-c-surface text-c-text shadow-sm bg-c-surface-raised text-c-text'
                : 'text-c-text-muted hover:text-c-text-muted'
            }`}
          >
            <Icon size={12} />
            {isPl ? pl : en}
          </button>
        ))}
      </div>

      {/* ── Views tab ─────────────────────────────────────────── */}
      {tab === 'views' && (
        <div className="flex-1 overflow-y-auto">
          {sharedViews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-2xl bg-c-surface-raised p-4 mb-4">
                <Globe size={28} className="text-c-text-muted" />
              </div>
              <p className="text-sm font-medium text-c-text-muted mb-1">
                {t('ideas.table.noSharedViews', 'No shared views')}
              </p>
              <p className="text-xs text-c-text-muted max-w-xs">
                {t(
                  'ideas.table.shareAViewFromTheViewMenuToGenerateAPublicLink',
                  'Share a view from the view menu to generate a public link.'
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sharedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3"
                >
                  <Globe size={14} className="text-c-text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-c-text truncate block">
                      {view.name}
                    </span>
                    <span className="text-[10px] text-c-text-secondary truncate block">
                      {t('ideas.table.publicLink', 'Public link')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyLink(view.id, view.shareToken!)}
                    className="p-1.5 rounded-lg text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                    title={t('ideas.table.copyLink', 'Copy link')}
                  >
                    {copiedId === view.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => handleRevokeShare(view.id)}
                    className="p-1.5 rounded-lg text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)] transition-colors"
                    title={t('ideas.table.revoke', 'Revoke')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Collaborators tab ─────────────────────────────────── */}
      {tab === 'collaborators' && (
        <div className="flex-1 overflow-y-auto">
          {/* Invite button */}
          {!showInvite && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-2 text-xs font-medium text-c-surface hover:bg-c-text/90 transition-colors mb-4"
            >
              <UserPlus size={12} />
              {t('ideas.table.invitePerson', 'Invite person')}
            </button>
          )}

          {/* Invite form */}
          {showInvite && (
            <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-c-text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-info"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-c-text-muted mb-1">
                  {t('ideas.table.role', 'Role')}
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-info"
                >
                  {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                    <option key={r.value} value={r.value}>
                      {isPl ? r.labelPl : r.labelEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-2 text-xs font-medium text-c-surface hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {inviting && <Loader2 size={12} className="animate-spin" />}
                  {t('ideas.table.invite', 'Invite')}
                </button>
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteEmail('');
                  }}
                  className="px-3 py-2 text-xs font-medium text-c-text-muted hover:text-c-text-muted transition-colors"
                >
                  {t('ideas.table.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-c-text-secondary" />
            </div>
          )}

          {/* Collaborators list */}
          {!loading && collaborators.length === 0 && (
            <div className="text-center py-8 text-xs text-c-text-secondary">
              {t('ideas.table.noCollaboratorsYet', 'No collaborators yet')}
            </div>
          )}

          {!loading && collaborators.length > 0 && (
            <div className="space-y-2">
              {collaborators.map((collab) => {
                const roleLabel = ROLES.find((r) => r.value === collab.role);
                const isOwner = collab.role === 'owner';

                return (
                  <div
                    key={collab.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3"
                  >
                    {/* Avatar placeholder */}
                    <div className="w-8 h-8 rounded-full bg-c-surface-raised flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-c-text-secondary">
                        {(collab.name ?? collab.email)?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-c-text truncate block">
                        {collab.name ?? collab.email}
                      </span>
                      {collab.name && (
                        <span className="text-[10px] text-c-text-secondary truncate block">
                          {collab.email}
                        </span>
                      )}
                    </div>

                    {/* Role selector */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          !isOwner && setRoleMenuOpen(roleMenuOpen === collab.id ? null : collab.id)
                        }
                        disabled={isOwner}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                          isOwner
                            ? 'bg-c-warning text-c-warning'
                            : 'bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised'
                        }`}
                      >
                        {isPl ? roleLabel?.labelPl : roleLabel?.labelEn}
                        {!isOwner && <ChevronDown size={10} />}
                      </button>

                      {roleMenuOpen === collab.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setRoleMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1">
                            {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                              <button
                                key={r.value}
                                onClick={() => handleChangeRole(collab.userId, r.value)}
                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                  collab.role === r.value
                                    ? 'text-c-text bg-c-surface-raised'
                                    : 'text-c-text-muted hover:bg-c-surface-raised'
                                }`}
                              >
                                {collab.role === r.value && <Check size={10} />}
                                {isPl ? r.labelPl : r.labelEn}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Remove */}
                    {!isOwner && (
                      <button
                        onClick={() => handleRemoveCollaborator(collab.userId)}
                        className="p-1.5 rounded-lg text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] dark:hover:bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)] transition-colors"
                        title={t('ideas.table.removeAccess', 'Remove access')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── API tab ───────────────────────────────────────────── */}
      {tab === 'api' && (
        <div className="flex-1 overflow-y-auto">
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-c-warning" />
              <h4 className="text-sm font-semibold text-c-text">
                {t('ideas.table.apiAccess', 'API Access')}
              </h4>
            </div>

            <div>
              <label className="block text-xs font-medium text-c-text-muted mb-1">Base ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-c-border-subtle bg-c-bg px-3 py-2 text-xs text-c-text-muted font-mono truncate">
                  {baseId}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(baseId);
                    toast.success(t('ideas.table.copied', 'Copied'));
                  }}
                  className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-c-text-muted mb-1">
                {t('ideas.table.apiEndpoint', 'API Endpoint')}
              </label>
              <code className="block rounded-lg border border-c-border-subtle bg-c-bg px-3 py-2 text-xs text-c-text-muted font-mono break-all">
                {window.location.origin}/api/table-platform/bases/{baseId}
              </code>
            </div>

            <div className="rounded-lg bg-c-warning px-3 py-2">
              <p className="text-[11px] text-c-warning">
                {t(
                  'ideas.table.useYourAuthorizationTokenInTheAuthorizationBearerTokenHeader',
                  'Use your authorization token in the Authorization: Bearer <token> header to authenticate API requests.'
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharingManager;
