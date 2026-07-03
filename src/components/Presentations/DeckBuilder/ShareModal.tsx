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

      <div className="relative w-[480px] bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{deckTitle}</h2>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-navy-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-slate-500 hover:text-slate-700'
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('presentations.builder.share.inviteByEmail', 'Invite by email')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm"
                  />
                  <button className="px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 text-sm hover:bg-navy-800">
                    <Mail size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase">Permissions</p>
                {[
                  { icon: Eye, label: 'View', desc: 'Can view the deck' },
                  { icon: MessageCircle, label: 'Comment', desc: 'Can view and comment' },
                ].map((perm) => (
                  <button
                    key={perm.label}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-400 text-left"
                  >
                    <perm.icon size={16} className="text-slate-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {perm.label}
                      </p>
                      <p className="text-[10px] text-slate-600">{perm.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-navy-800">
                <div className="flex items-center gap-2">
                  <Link size={16} className="text-slate-600" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {t('presentations.builder.share.publicLink', 'Public link')}
                  </span>
                </div>
                <button
                  onClick={handleTogglePublicLink}
                  disabled={generatingLink}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    publicLink
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500'
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
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-xs text-slate-500 truncate"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-sm hover:bg-slate-50 dark:hover:bg-navy-800 flex items-center gap-1"
                    >
                      {linkCopied ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-slate-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">
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
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-navy-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <exp.icon size={20} className="text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {exp.label}
                    </p>
                    <p className="text-[11px] text-slate-600">{exp.desc}</p>
                  </div>
                  <Download size={16} className="ml-auto text-slate-600" />
                </button>
              ))}
              <p className="text-[10px] text-slate-600 mt-2">
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
                  <p className="text-sm text-slate-500 mb-3">
                    {t(
                      'presentations.builder.share.enablePublicFirst',
                      'Enable public link sharing first to get an embed code.'
                    )}
                  </p>
                  <button
                    onClick={generateShareLink}
                    disabled={generatingLink}
                    className="px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 text-sm hover:bg-navy-800 disabled:opacity-50"
                  >
                    {generatingLink ? (
                      <Loader2 size={14} className="animate-spin inline mr-1" />
                    ) : null}
                    {t('presentations.builder.share.generateLink', 'Generate share link')}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Embed this deck on external websites:
                  </p>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={embedCode}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 text-xs text-slate-500 font-mono resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode);
                      toast.success('Embed code copied');
                    }}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-500"
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
