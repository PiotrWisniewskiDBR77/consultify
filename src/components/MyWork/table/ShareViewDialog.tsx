import { Calendar, Check, Copy, Lock, Share2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';

interface ShareViewDialogProps {
  viewId: string;
  viewName: string;
  isShared?: boolean;
  shareToken?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export const ShareViewDialog: React.FC<ShareViewDialogProps> = ({
  viewId,
  viewName,
  isShared = false,
  shareToken,
  onClose,
  onUpdated,
}) => {
  const { t } = useTranslation();

  const [shared, setShared] = useState(isShared);
  const [token, setToken] = useState(shareToken || '');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef: dialogRef });

  const shareUrl = token ? `${window.location.origin}/public/views/${token}` : '';

  const handleToggleShare = useCallback(async () => {
    setLoading(true);
    try {
      if (shared) {
        await TablePlatformApi.unshareView(viewId);
        setShared(false);
        setToken('');
      } else {
        const result = await TablePlatformApi.shareView(viewId, {
          password: password || undefined,
          expiresAt: expiresAt || undefined,
        });
        setShared(true);
        setToken(result.token);
      }
      onUpdated();
    } finally {
      setLoading(false);
    }
  }, [shared, viewId, password, expiresAt, onUpdated]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  return (
    <div
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-view-dialog-title"
        tabIndex={-1}
        className="w-[440px] bg-c-surface rounded-2xl border border-slate-200/60 dark:border-white/[0.03] shadow-2xl p-6 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-c-text-secondary" />
            <h3 id="share-view-dialog-title" className="font-semibold text-sm">
              {t('ideas.table.shareView.title', 'Share View')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-c-surface-raised">
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-c-text-muted mb-4">{viewName}</p>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-c-surface-raised">
          <span className="text-sm">
            {t('ideas.table.shareView.sharingEnabled', 'Sharing enabled')}
          </span>
          <button
            onClick={handleToggleShare}
            disabled={loading}
            className={`w-10 h-5 rounded-full transition-colors ${
              shared ? 'bg-c-surface' : 'bg-c-surface'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-c-surface shadow transition-transform ${
                shared ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {shared && shareUrl && (
          <>
            {/* Share URL */}
            <div className="flex items-center gap-2 mb-4">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-c-border-subtle bg-c-surface-raised"
              />
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-c-surface-raised text-c-text hover:bg-c-surface-raised/80 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-xs text-c-text-muted mb-1">
                <Lock size={12} />
                {t('ideas.table.shareView.password', 'Password (optional)')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(
                  'ideas.table.shareView.passwordPlaceholder',
                  'Leave empty = no password'
                )}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface"
              />
            </div>

            {/* Expiration */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-xs text-c-text-muted mb-1">
                <Calendar size={12} />
                {t('ideas.table.shareView.expires', 'Expires')}
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareViewDialog;
