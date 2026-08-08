/**
 * ShareModal — Share, Collaborate, Export, Embed for a deck.
 */

import {
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Image,
  Link,
  Loader2,
  Mail,
  MessageCircle,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

type ShareTab = 'collaborate' | 'share' | 'export' | 'embed';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string;
  deckTitle: string;
  onExport?: (format: 'pdf' | 'pptx' | 'png') => void;
}

function unwrapApiEnvelope<T>(response: unknown): T | undefined {
  if (!response || (typeof response !== 'object' && typeof response !== 'function')) {
    return undefined;
  }
  const exposedData = (response as { data?: unknown }).data;
  // The shared Api transport returns a Proxy whose `data` getter points back
  // to the whole server payload. Its real `{ success, data: ... }` envelope is
  // still available through the own-property descriptor.
  if (exposedData === response) {
    return Object.getOwnPropertyDescriptor(response, 'data')?.value as T | undefined;
  }
  if (exposedData && typeof exposedData === 'object' && 'data' in exposedData) {
    return (exposedData as { data?: T }).data;
  }
  return exposedData as T | undefined;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  deckId,
  deckTitle,
  onExport,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ShareTab>('share');
  const [linkCopied, setLinkCopied] = useState(false);
  const [publicLink, setPublicLink] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  // P3.3 — invite state (Collaborate tab). Invite now creates a real per-user
  // membership row (presentation_deck_collaborators) with the chosen role, and
  // ALSO mints/hands off a share-link as a fail-open fallback (so the invite
  // still lands even if the membership layer is degraded).
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePermission, setInvitePermission] = useState<'viewer' | 'editor'>('viewer');
  const [inviting, setInviting] = useState(false);

  // Ensures a share token exists, returning it. Reuses the existing
  // POST /decks/:id/share endpoint (org-scoped, audited, rate-limited).
  const ensureShareToken = useCallback(async (): Promise<string | null> => {
    if (shareToken) {
      setPublicLink(true);
      return shareToken;
    }
    setGeneratingLink(true);
    try {
      const res = await Api.post(`/presentations/decks/${deckId}/share`, { expiresInDays: 7 });
      const data = unwrapApiEnvelope<{ shareToken?: string }>(res);
      if (data?.shareToken) {
        setShareToken(data.shareToken);
        setPublicLink(true);
        return data.shareToken as string;
      }
      toast.error('Failed to generate share link');
      return null;
    } catch {
      toast.error('Failed to generate share link');
      return null;
    } finally {
      setGeneratingLink(false);
    }
  }, [deckId, shareToken]);

  const generateShareLink = useCallback(async () => {
    await ensureShareToken();
  }, [ensureShareToken]);

  // P3.3 — real invite handler. Creates a per-user membership row
  // (POST /decks/:id/collaborators with the chosen role), then hands the
  // invitee a share-link via the OS mail client (mailto:) + clipboard so the
  // invite lands immediately. Membership creation is fail-open: if the backend
  // reports `degraded` (table unavailable) we still complete the share-link
  // hand-off rather than blocking the invite.
  const handleInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('presentations.builder.share.invalidEmail', 'Enter a valid email'));
      return;
    }
    setInviting(true);
    try {
      // 1) Create the collaborator membership row (best-effort / fail-open).
      let degraded = false;
      try {
        const res = await Api.post(`/presentations/decks/${deckId}/collaborators`, {
          email,
          role: invitePermission,
        });
        const data = unwrapApiEnvelope<{ degraded?: boolean; collaborator?: unknown }>(res);
        degraded = !!data?.degraded || !data?.collaborator;
      } catch {
        // Membership layer unreachable — fall through to the share-link hand-off.
        degraded = true;
      }

      // 2) Hand off a share-link so the invite works right now.
      const token = await ensureShareToken();
      if (!token) {
        // Even the share-link failed; the membership row (if created) still stands.
        if (!degraded) {
          toast.success(t('presentations.builder.share.inviteAdded', 'Collaborator added'));
          setInviteEmail('');
        }
        return;
      }
      const url = `${window.location.origin}/presentations/shared/${token}`;
      const roleLabel =
        invitePermission === 'editor'
          ? t('presentations.builder.share.permEdit', 'edit')
          : t('presentations.builder.share.permView', 'view');
      const subject = encodeURIComponent(`${deckTitle} — shared with you`);
      const body = encodeURIComponent(
        `You've been invited to ${roleLabel} the deck "${deckTitle}".\n\nOpen it here: ${url}`
      );
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard may be unavailable; mailto still fires */
      }
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      toast.success(
        degraded
          ? t(
              'presentations.builder.share.inviteSent',
              'Invite ready — link copied and email opened'
            )
          : t(
              'presentations.builder.share.inviteAddedAndSent',
              'Collaborator added — link copied and email opened'
            )
      );
      setInviteEmail('');
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, invitePermission, ensureShareToken, deckId, deckTitle, t]);

  if (!isOpen) return null;

  const shareUrl = shareToken ? `${window.location.origin}/presentations/shared/${shareToken}` : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleTogglePublicLink = () => {
    if (!publicLink) {
      generateShareLink();
    } else {
      setPublicLink(false);
    }
  };

  const embedCode = shareToken
    ? `<iframe src="${window.location.origin}/presentations/embed/${shareToken}" width="100%" height="480" frameborder="0" allowfullscreen></iframe>`
    : '';

  // L-01 / DP-5: "Collaborate · Invite by email" has no backend handler in v1.
  // Hide it behind a flag (default OFF) rather than ship a dead control. Re-enable
  // by setting VITE_ENABLE_DECK_COLLABORATE=true once invite handlers exist.
  const collaborateEnabled = import.meta.env.VITE_ENABLE_DECK_COLLABORATE === 'true';

  const tabs: { id: ShareTab; labelKey: string }[] = [
    ...(collaborateEnabled
      ? [{ id: 'collaborate' as const, labelKey: 'presentations.builder.share.collaborate' }]
      : []),
    { id: 'share', labelKey: 'presentations.builder.share.shareLink' },
    { id: 'export', labelKey: 'presentations.builder.share.export' },
    { id: 'embed', labelKey: 'presentations.builder.share.embed' },
  ];

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[480px] bg-c-surface rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h2 className="text-lg font-semibold text-c-text">{deckTitle}</h2>
          <button onClick={onClose} className="text-c-text-secondary hover:text-c-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-c-border-subtle">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-c-accent border-b-2 border-c-accent'
                  : 'text-c-text-secondary hover:text-c-text'
              }`}
            >
              {t(tab.labelKey, tab.id)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 min-h-[240px]">
          {activeTab === 'collaborate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t('presentations.builder.share.inviteByEmail', 'Invite by email')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInvite();
                    }}
                    placeholder="email@example.com"
                    data-testid="deck-invite-email"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm"
                  />
                  <button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    data-testid="deck-invite-submit"
                    className="px-4 py-2 rounded-lg bg-c-surface text-c-text text-sm hover:bg-c-surface-raised disabled:opacity-50"
                  >
                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-c-text-secondary uppercase">
                  {t('presentations.builder.share.permissions', 'Permissions')}
                </p>
                {[
                  {
                    value: 'viewer' as const,
                    icon: Eye,
                    label: t('presentations.builder.share.viewLabel', 'View'),
                    desc: t('presentations.builder.share.viewDesc', 'Can view the deck'),
                  },
                  {
                    value: 'editor' as const,
                    icon: MessageCircle,
                    label: t('presentations.builder.share.editLabel', 'Edit'),
                    desc: t('presentations.builder.share.editDesc', 'Can view and edit'),
                  },
                ].map((perm) => (
                  <button
                    key={perm.value}
                    onClick={() => setInvitePermission(perm.value)}
                    data-testid={`deck-invite-perm-${perm.value}`}
                    aria-pressed={invitePermission === perm.value}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      invitePermission === perm.value
                        ? 'border-c-accent bg-c-accent-soft'
                        : 'border-c-border-subtle hover:border-c-accent'
                    }`}
                  >
                    <perm.icon size={16} className="text-c-text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-c-text">{perm.label}</p>
                      <p className="text-[10px] text-c-text-secondary">{perm.desc}</p>
                    </div>
                    {invitePermission === perm.value && (
                      <Check size={14} className="ml-auto text-c-accent" />
                    )}
                  </button>
                ))}
                <p className="text-[10px] text-c-text-secondary pt-1">
                  {t(
                    'presentations.builder.share.inviteNote',
                    'Invite adds the person as a collaborator with this role and sends them a link.'
                  )}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-c-surface-raised">
                <div className="flex items-center gap-2">
                  <Link size={16} className="text-c-text-secondary" />
                  <span className="text-sm text-c-text">
                    {t('presentations.builder.share.publicLink', 'Public link')}
                  </span>
                </div>
                <button
                  onClick={handleTogglePublicLink}
                  disabled={generatingLink}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    publicLink
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-c-border-subtle text-c-text-secondary'
                  }`}
                >
                  {generatingLink ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : publicLink ? (
                    'ON'
                  ) : (
                    'OFF'
                  )}
                </button>
              </div>

              {publicLink && shareUrl && (
                <>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface-raised text-xs text-c-text-secondary truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 rounded-lg border border-c-border-subtle text-sm hover:bg-c-surface-raised flex items-center gap-1"
                    >
                      {linkCopied ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-c-text-secondary" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-c-text-secondary">
                    {t(
                      'presentations.builder.share.anyoneCanView',
                      'Anyone with the link can view'
                    )}
                  </p>
                </>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-3">
              {[
                {
                  format: 'pdf' as const,
                  label: t('presentations.builder.export.pdf', 'PDF'),
                  icon: FileText,
                  desc: 'Consulting-grade, fonts embedded',
                },
                {
                  format: 'pptx' as const,
                  label: t('presentations.builder.export.pptx', 'PowerPoint (PPTX)'),
                  icon: FileText,
                  desc: 'Native formatting, editable charts',
                },
                {
                  format: 'png' as const,
                  label: t('presentations.builder.export.png', 'PNGs (per slide)'),
                  icon: Image,
                  desc: 'High-res per card (2x retina)',
                },
              ].map((exp) => (
                <button
                  key={exp.format}
                  onClick={() => onExport?.(exp.format)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-c-border-subtle hover:border-c-accent hover:bg-c-accent-soft text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-c-accent-soft0 flex items-center justify-center">
                    <exp.icon size={20} className="text-c-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-c-text">{exp.label}</p>
                    <p className="text-[11px] text-c-text-secondary">{exp.desc}</p>
                  </div>
                  <Download size={16} className="ml-auto text-c-text-secondary" />
                </button>
              ))}
              <p className="text-[10px] text-c-text-secondary mt-2">
                {t(
                  'presentations.builder.export.staticNote',
                  'Animated elements will be static in PDF and PowerPoint'
                )}
              </p>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-3">
              {!shareToken ? (
                <div className="text-center py-6">
                  <p className="text-sm text-c-text-secondary mb-3">
                    {t(
                      'presentations.builder.share.enablePublicFirst',
                      'Enable public link sharing first to get an embed code.'
                    )}
                  </p>
                  <button
                    onClick={generateShareLink}
                    disabled={generatingLink}
                    className="px-4 py-2 rounded-lg bg-c-surface text-c-text text-sm hover:bg-c-surface-raised disabled:opacity-50"
                  >
                    {generatingLink ? (
                      <Loader2 size={14} className="animate-spin inline mr-1" />
                    ) : null}
                    {t('presentations.builder.share.generateLink', 'Generate share link')}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-c-text-secondary">
                    Embed this deck on external websites:
                  </p>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={embedCode}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-c-border-subtle bg-c-surface-raised text-xs text-c-text-secondary font-mono resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      toast.success('Embed code copied');
                    }}
                    className="flex items-center gap-1.5 text-xs text-c-accent hover:text-c-accent"
                  >
                    <Copy size={12} /> Copy embed code
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
