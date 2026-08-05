/**
 * AddFilesMenu
 *
 * Grok-inspired file attachment menu:
 * - Upload file
 * - Cloud providers (Google Drive / OneDrive / Dropbox) with link icon
 * - Recent: flyout submenu to the right
 *
 * @version 4.0.0
 */

import { ChevronRight, ExternalLink, Link2, Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { CloudProviderId } from '../../hooks/useCloudIntegrations';
import { Api } from '../../services/api';
import { Button } from '../ui/primitives/Button';
import { Modal } from '../ui/primitives/Modal';
import { SUPPORTED_CHAT_ATTACHMENT_ACCEPT } from './chatAttachmentSupport';
import {
  pushRecentAttachment,
  readRecentAttachments,
  type RecentAttachment,
  removeRecentAttachment,
} from './chatRecentAttachments';

// ─── Brand SVG icons (no background, true colours) ──────────────────────────

const GoogleDriveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true">
    <path
      d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"
      fill="#0066DA"
    />
    <path
      d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-27.55z"
      fill="#00AC47"
    />
    <path
      d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L84.7 60.2c.8-1.4 1.2-2.95 1.2-4.5H58.4l6.5 11.25 8.65 9.85z"
      fill="#EA4335"
    />
    <path
      d="M43.65 25.15L57.4 1.35c-1.35-.8-2.9-1.2-4.5-1.2H34.15c-1.6 0-3.15.45-4.5 1.2l13.75 23.8h.25z"
      fill="#00832D"
    />
    <path
      d="M58.4 52.7H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h49.2c1.6 0 3.15-.45 4.5-1.2L58.4 52.7z"
      fill="#2684FC"
    />
    <path
      d="M73.4 26.5L60.65 4.65c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 58.4 52.7H85.9c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z"
      fill="#FFBA00"
    />
  </svg>
);

const OneDriveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M14.5 15.5h5a3.5 3.5 0 001.3-6.7A5 5 0 0011.5 6c-1.5 0-2.8.6-3.8 1.5A4 4 0 004 11.5a4 4 0 004 4h6.5z"
      fill="#0364B8"
    />
    <path
      d="M9.5 15.5h6c-1-1.8-3-3-5.2-3a6 6 0 00-3.3 1c-.5.3-1 .7-1.3 1.2A3.5 3.5 0 009.5 15.5z"
      fill="#0078D4"
    />
  </svg>
);

const DropboxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.1 1.8L0 6.6l5 3.9 7-4.7-4.9-4zM0 14.3l7.1 4.9L12 15.8l-7-4.8-5 3.3zm12 1.5l4.9 3.4L24 14.3l-5-3.3-7 4.8zm12-8.7L16.9 2.2 12 5.8l7 4.7 5-3.4zm-12 5.7L7.1 17l-2-.9v1.4l6.9 4.1 6.9-4.1V16l-1.8 1L12 12.8z"
      fill="#0061FF"
    />
  </svg>
);

const FileIcon: React.FC<{ name: string }> = ({ name }) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const colorMap: Record<string, string> = {
    pdf: 'text-danger-400',
    docx: 'text-blue-400',
    doc: 'text-blue-400',
    xlsx: 'text-emerald-400',
    xls: 'text-emerald-400',
    csv: 'text-emerald-400',
    png: 'text-primary-400',
    jpg: 'text-primary-400',
    jpeg: 'text-primary-400',
    txt: 'text-slate-600',
    md: 'text-slate-600',
    json: 'text-amber-400',
  };
  const color = colorMap[ext] || 'text-slate-600';

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${color}`}>
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddFilesMenuProps {
  onFileSelect: (files: File[]) => void;
  onUrlAdd?: (url: string) => void;
  onRecentSelect?: (recent: { name: string; docId?: string }) => void;
  onCloudFileSelect?: (provider: CloudProviderId, fileId: string, fileName: string) => void;
  onConnectCloud?: (provider: CloudProviderId) => void;
  connectedProviders?: CloudProviderId[];
  isCloudImplemented?: boolean;
  disabled?: boolean;
}

interface ProviderDef {
  id: CloudProviderId;
  name: string;
  Icon: React.FC;
}

const PROVIDERS: ProviderDef[] = [
  { id: 'google-drive', name: 'Google Drive', Icon: GoogleDriveIcon },
  { id: 'onedrive', name: 'Microsoft OneDrive', Icon: OneDriveIcon },
  { id: 'dropbox', name: 'Dropbox', Icon: DropboxIcon },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const AddFilesMenu: React.FC<AddFilesMenuProps> = ({
  onFileSelect,
  onUrlAdd,
  onRecentSelect,
  onCloudFileSelect,
  onConnectCloud,
  connectedProviders = [],
  isCloudImplemented = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [recentHover, setRecentHover] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentAttachment[]>([]);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', keyHandler);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRecentItems(readRecentAttachments());
    } else {
      setRecentHover(false);
    }
  }, [isOpen]);

  const handleDeleteRecentDoc = async (e: React.MouseEvent, docId: string, name: string) => {
    e.stopPropagation();
    try {
      await Api.deleteKnowledgeDocument(docId);
      const updated = removeRecentAttachment(docId);
      setRecentItems(updated);
      toast.success(t('aiChat.menu.toast.docDeleted', { name, defaultValue: `Deleted: ${name}` }), {
        duration: 2000,
      });
    } catch {
      toast.error(t('aiChat.menu.toast.docDeleteFailed', 'Could not delete the document.'));
    }
  };

  useEffect(() => {
    return () => {
      if (recentTimeoutRef.current) clearTimeout(recentTimeoutRef.current);
    };
  }, []);

  const connectedCloudProviders = PROVIDERS.filter((provider) =>
    connectedProviders.includes(provider.id)
  );

  const handleRecentEnter = () => {
    if (recentTimeoutRef.current) clearTimeout(recentTimeoutRef.current);
    setRecentHover(true);
  };

  const handleRecentLeave = () => {
    recentTimeoutRef.current = setTimeout(() => setRecentHover(false), 200);
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    onFileSelect(files);
    setIsOpen(false);

    toast.success(
      files.length === 1
        ? t('aiChat.menu.toast.filesAddedOne', { name: files[0].name })
        : t('aiChat.menu.toast.filesAddedMany', { count: files.length }),
      { duration: 2000 }
    );

    // Record the file name immediately so it shows in Recent right away. The
    // docId isn't known until the upload completes in UnifiedChatPanel, which
    // upgrades this same entry in place via pushRecentAttachment({name, docId}).
    let merged: RecentAttachment[] = readRecentAttachments();
    for (const f of files) merged = pushRecentAttachment({ name: f.name.trim() });
    setRecentItems(merged);
  };

  const handleCloudClick = (provider: ProviderDef) => {
    onCloudFileSelect?.(provider.id, '', '');
    setIsOpen(false);
  };

  const openIntegrationsSettings = () => {
    // SPA navigation (A3) — a hard reload would discard the chat draft + scroll.
    try {
      navigate('/settings/integrations');
    } catch {
      onConnectCloud?.('google-drive');
    }
    setIsOpen(false);
  };

  const submitUrl = () => {
    const raw = urlValue.trim();
    if (!raw) return;
    // Feedback #acc27ab3 — users were pasting/typing bare hosts like
    // `example.com` or `www.example.com/path` and hitting "Invalid link"
    // because `new URL(raw)` needs a protocol. Auto-prepend `https://`
    // when no scheme is present so the common paste path just works.
    // Strings that already contain an explicit scheme (http:, https:,
    // mailto:, ftp:, javascript:, data:, etc.) are left untouched so the
    // downstream protocol guard still rejects non-http(s) values.
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
    const candidate = hasScheme ? raw : `https://${raw}`;
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        toast.error(t('aiChat.menu.urlUnsupportedProtocol', 'Only http(s) links are supported'));
        return;
      }
      onUrlAdd?.(u.toString());
      toast.success(t('aiChat.menu.toast.urlAdded', 'Link added to attachments'), {
        duration: 1500,
      });
      setUrlValue('');
      setUrlModalOpen(false);
      setIsOpen(false);
    } catch {
      toast.error(t('aiChat.menu.urlInvalid', 'Invalid link'));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        data-testid="add-files-trigger"
        className={`p-2 rounded-lg transition-colors text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        title={t('aiChat.menu.addFiles', 'Add files')}
      >
        <Plus size={20} />
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={SUPPORTED_CHAT_ATTACHMENT_ACCEPT}
        onChange={handleFileChange}
        data-testid="add-files-hidden-input"
      />

      {/* Dropdown */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Add files"
          className="absolute left-0 bottom-full mb-2 z-50 w-[250px] py-1.5
            bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
        >
          {/* Upload file */}
          <MenuItem
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload size={15} className="text-slate-500 dark:text-slate-400" />}
            label={t('aiChat.menu.uploadFile', 'Upload file')}
            testId="add-files-upload-file"
          />

          {/* Add URL */}
          {onUrlAdd && (
            <MenuItem
              onClick={() => {
                setUrlModalOpen(true);
                setIsOpen(false);
              }}
              icon={<Link2 size={15} className="text-slate-500 dark:text-slate-400" />}
              label={t('aiChat.menu.addLink', 'Add link')}
            />
          )}

          {isCloudImplemented && connectedCloudProviders.length > 0 ? (
            <>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />
              {connectedCloudProviders.map((p) => (
                <CloudMenuItem
                  key={p.id}
                  provider={p}
                  connected={true}
                  onClick={() => handleCloudClick(p)}
                />
              ))}
            </>
          ) : (
            <>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />
              <MenuItem
                onClick={openIntegrationsSettings}
                icon={<Link2 size={15} className="text-slate-500 dark:text-slate-400" />}
                label={t('aiChat.menu.manageIntegrations', 'Manage cloud sources')}
                testId="add-files-manage-cloud"
              />
            </>
          )}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />

          {/* Recent — flyout to the right */}
          <div
            className="relative"
            onMouseEnter={handleRecentEnter}
            onMouseLeave={handleRecentLeave}
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] text-slate-500 dark:text-slate-400 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors rounded-lg mx-0"
            >
              <span className="flex-1 text-left">{t('aiChat.menu.recent', 'Recent')}</span>
              <ChevronRight size={13} className="shrink-0 text-slate-600 dark:text-slate-500" />
            </button>

            {/* Flyout submenu */}
            {recentHover && (
              <div
                className="absolute left-full top-0 ml-1 z-50 w-[200px] py-1.5
                  bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
                  border border-slate-200/40 dark:border-white/[0.08]
                  rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                  animate-in fade-in-0 slide-in-from-left-1 duration-100"
                onMouseEnter={handleRecentEnter}
                onMouseLeave={handleRecentLeave}
              >
                {recentItems.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[12px] text-slate-600 dark:text-slate-500">
                    {t('aiChat.menu.recentEmpty', 'No recent attachments')}
                  </p>
                ) : (
                  recentItems.map((r) => (
                    <button
                      key={`${r.docId || r.name}-${r.addedAt}`}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group disabled:opacity-50"
                      disabled={!r.docId}
                      title={
                        r.docId
                          ? r.name
                          : `${r.name} — ${t('aiChat.menu.recentReupload', 're-upload to attach')}`
                      }
                      onClick={() => {
                        if (!r.docId) {
                          // Legacy / pre-docId entry — can't reattach without the
                          // server doc; prompt a fresh upload instead of lying.
                          fileInputRef.current?.click();
                          setIsOpen(false);
                          return;
                        }
                        // Real reattach: hand the existing docId back to the
                        // composer, which includes it in the next message (the
                        // RAG vectors already exist server-side — no re-upload).
                        onRecentSelect?.({ name: r.name, docId: r.docId });
                        toast.success(t('aiChat.menu.toast.recentReattached', { name: r.name }), {
                          duration: 1800,
                        });
                        setIsOpen(false);
                      }}
                    >
                      <FileIcon name={r.name} />
                      <span className="flex-1 text-[12px] text-slate-600 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {r.name}
                      </span>
                      {r.docId && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecentDoc(e, r.docId!, r.name)}
                          className="ml-1 shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          title={t('aiChat.menu.deleteDoc', 'Remove from knowledge base')}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={urlModalOpen}
        onClose={() => {
          setUrlModalOpen(false);
          setUrlValue('');
        }}
        title={t('aiChat.menu.addLink', 'Add link')}
        description={t(
          'aiChat.menu.addLinkModalDesc',
          'We will fetch and attach the page content to this chat.'
        )}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setUrlModalOpen(false);
                setUrlValue('');
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" onClick={submitUrl} disabled={!urlValue.trim()}>
              {t('common.add', 'Add')}
            </Button>
          </div>
        }
      >
        <div className="p-6 pt-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
            {t('aiChat.menu.urlLabel', 'URL')}
          </label>
          <input
            autoFocus
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl();
            }}
            placeholder={t('aiChat.menu.urlPlaceholder', 'https://…')}
            className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
          <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
            {t(
              'aiChat.menu.urlPrivacyHint',
              'Only public http(s) links. Your organization policy may block internet access.'
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
};

// ─── Cloud provider row: icon + name + link icon ─────────────────────────────

const CloudMenuItem: React.FC<{
  provider: ProviderDef;
  connected: boolean;
  onClick: () => void;
}> = ({ provider, connected, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group"
  >
    <span className="w-4 h-4 flex items-center justify-center shrink-0">
      <provider.Icon />
    </span>
    <span className="flex-1 text-left">{provider.name}</span>
    <ExternalLink
      size={12}
      className={`shrink-0 transition-all duration-150 ${
        connected
          ? 'text-emerald-500 dark:text-emerald-400 opacity-100'
          : 'text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100'
      }`}
    />
  </button>
);

// ─── Generic menu item ───────────────────────────────────────────────────────

const MenuItem: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
  testId?: string;
}> = ({ onClick, icon, label, description, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="w-full flex items-start gap-3 px-3.5 py-2 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
  >
    <span className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">{icon}</span>
    <span className="flex-1 text-left">
      <span className="block">{label}</span>
      {description && (
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      )}
    </span>
  </button>
);

export default AddFilesMenu;
