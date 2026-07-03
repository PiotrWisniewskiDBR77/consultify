import { Calendar, Check, Copy, Lock, Share2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [shared, setShared] = useState(isShared);
  const [token, setToken] = useState(shareToken || '');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

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
        className="w-[440px] bg-white dark:bg-navy-950 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-primary-500" />
            <h3 className="font-semibold text-sm">{isPl ? 'Udostępnij widok' : 'Share View'}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">{viewName}</p>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-slate-50 dark:bg-navy-900">
          <span className="text-sm">{isPl ? 'Udostępnianie włączone' : 'Sharing enabled'}</span>
          <button
            onClick={handleToggleShare}
            disabled={loading}
            className={`w-10 h-5 rounded-full transition-colors ${
              shared ? 'bg-navy-900' : 'bg-slate-300 dark:bg-navy-600'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
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
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900"
              />
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-primary-100 dark:bg-primary-800/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Lock size={12} />
                {isPl ? 'Hasło (opcjonalne)' : 'Password (optional)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isPl ? 'Zostaw puste = bez hasła' : 'Leave empty = no password'}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
              />
            </div>

            {/* Expiration */}
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                <Calendar size={12} />
                {isPl ? 'Wygasa' : 'Expires'}
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareViewDialog;
