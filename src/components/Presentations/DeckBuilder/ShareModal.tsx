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

  const generateShareLink = useCallback(async () => {
    if (shareToken) {
      setPublicLink(true);
      return;
    }
    setGeneratingLink(true);
    try {
      const res = await Api.post(`/presentations/decks/${deckId}/share`, { expiresInDays: 7 });
      const payload = res?.data;
      const data =
        payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
      if (data?.shareToken) {
        setShareToken(data.shareToken);
        setPublicLink(true);
      } else {
        toast.error('Failed to generate share link');
      }
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setGeneratingLink(false);
    }
  }, [deckId, shareToken]);

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
                    placeholder="email@example.com"
                    className="flex-1 px-3 py-2 rounded-lg border border-c-border bg-c-surface text-sm"
                  />
                  <button className="px-4 py-2 rounded-lg bg-c-surface text-c-text text-sm hover:bg-c-surface-raised">
                    <Mail size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-c-text-secondary uppercase">Permissions</p>
                {[
                  { icon: Eye, label: 'View', desc: 'Can view the deck' },
                  { icon: MessageCircle, label: 'Comment', desc: 'Can view and comment' },
                ].map((perm) => (
                  <button
                    key={perm.label}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-c-border-subtle hover:border-c-accent text-left"
                  >
                    <perm.icon size={16} className="text-c-text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-c-text">
                        {perm.label}
                      </p>
                      <p className="text-[10px] text-c-text-secondary">{perm.desc}</p>
                    </div>
                  </button>
                ))}
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
                    <p className="text-sm font-semibold text-c-text">
                      {exp.label}
                    </p>
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
