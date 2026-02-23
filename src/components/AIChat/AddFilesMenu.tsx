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

import { ChevronRight, ExternalLink, Plus, Upload } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { CloudProviderId } from '../../hooks/useCloudIntegrations';

// ─── Recent attachments (localStorage) ───────────────────────────────────────

type RecentAttachment = { name: string; addedAt: number };

const RECENT_KEY = 'consultinity-recent-attachments';

function readRecent(): RecentAttachment[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({ name: String(x?.name || '').trim(), addedAt: Number(x?.addedAt || 0) }))
      .filter((x: RecentAttachment) => x.name && Number.isFinite(x.addedAt) && x.addedAt > 0)
      .sort((a: RecentAttachment, b: RecentAttachment) => b.addedAt - a.addedAt)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function writeRecent(items: RecentAttachment[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 5)));
  } catch {
    // ignore
  }
}

// ─── Brand SVG icons (no background, true colours) ──────────────────────────

const GoogleDriveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 87.3 78" aria-hidden="true">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
    <path d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-27.55z" fill="#00AC47" />
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L84.7 60.2c.8-1.4 1.2-2.95 1.2-4.5H58.4l6.5 11.25 8.65 9.85z" fill="#EA4335" />
    <path d="M43.65 25.15L57.4 1.35c-1.35-.8-2.9-1.2-4.5-1.2H34.15c-1.6 0-3.15.45-4.5 1.2l13.75 23.8h.25z" fill="#00832D" />
    <path d="M58.4 52.7H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h49.2c1.6 0 3.15-.45 4.5-1.2L58.4 52.7z" fill="#2684FC" />
    <path d="M73.4 26.5L60.65 4.65c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 58.4 52.7H85.9c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00" />
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
    pdf: 'text-red-400',
    docx: 'text-blue-400',
    doc: 'text-blue-400',
    xlsx: 'text-emerald-400',
    xls: 'text-emerald-400',
    csv: 'text-emerald-400',
    png: 'text-violet-400',
    jpg: 'text-violet-400',
    jpeg: 'text-violet-400',
    txt: 'text-slate-400',
    md: 'text-slate-400',
    json: 'text-amber-400',
  };
  const color = colorMap[ext] || 'text-slate-400';

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
  onCloudFileSelect,
  onConnectCloud,
  connectedProviders = [],
  isCloudImplemented = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [recentHover, setRecentHover] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentAttachment[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRecentItems(readRecent());
    } else {
      setRecentHover(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recentTimeoutRef.current) clearTimeout(recentTimeoutRef.current);
    };
  }, []);

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

    const now = Date.now();
    const existing = readRecent();
    const added = files.map((f) => ({ name: f.name.trim(), addedAt: now }));
    const merged = [...added, ...existing]
      .filter((x) => x.name)
      .reduce<RecentAttachment[]>((acc, item) => {
        if (acc.some((a) => a.name === item.name)) return acc;
        acc.push(item);
        return acc;
      }, [])
      .slice(0, 5);
    writeRecent(merged);
    setRecentItems(merged);
  };

  const handleCloudClick = (provider: ProviderDef) => {
    const connected = connectedProviders.includes(provider.id);

    if (!isCloudImplemented) {
      toast(t('aiChat.menu.toast.cloudComingSoon', 'Cloud integrations coming soon'), {
        icon: '\u23F3',
        duration: 3000,
        style: { borderRadius: '10px', background: '#334155', color: '#fff' },
      });
      setIsOpen(false);
      return;
    }

    if (connected) {
      onCloudFileSelect?.(provider.id, '', '');
    } else {
      onConnectCloud?.(provider.id);
    }
    setIsOpen(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        className={`p-2 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
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
        accept=".pdf,.txt,.md,.json,.csv,.docx,.xlsx,.doc,.xls,.pptx"
        onChange={handleFileChange}
      />

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute left-0 bottom-full mb-2 z-50 w-[250px] py-1.5
            bg-white/95 dark:bg-[#1a1d2e]/95 backdrop-blur-xl
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
        >
          {/* Upload file */}
          <MenuItem
            onClick={() => fileInputRef.current?.click()}
            icon={<Upload size={15} className="text-slate-500 dark:text-slate-400" />}
            label={t('aiChat.menu.uploadFile', 'Upload file')}
          />

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-slate-100 dark:border-white/[0.06]" />

          {/* Cloud providers — just name + link icon */}
          {PROVIDERS.map((p) => (
            <CloudMenuItem
              key={p.id}
              provider={p}
              connected={connectedProviders.includes(p.id)}
              onClick={() => handleCloudClick(p)}
            />
          ))}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-slate-100 dark:border-white/[0.06]" />

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
              <ChevronRight
                size={13}
                className="shrink-0 text-slate-400 dark:text-slate-500"
              />
            </button>

            {/* Flyout submenu */}
            {recentHover && (
              <div
                className="absolute left-full top-0 ml-1 z-50 w-[200px] py-1.5
                  bg-white/95 dark:bg-[#1a1d2e]/95 backdrop-blur-xl
                  border border-slate-200/40 dark:border-white/[0.08]
                  rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                  animate-in fade-in-0 slide-in-from-left-1 duration-100"
                onMouseEnter={handleRecentEnter}
                onMouseLeave={handleRecentLeave}
              >
                {recentItems.length === 0 ? (
                  <p className="px-3.5 py-2.5 text-[12px] text-slate-400 dark:text-slate-500">
                    {t('aiChat.menu.recentEmpty', 'No recent attachments')}
                  </p>
                ) : (
                  recentItems.map((r) => (
                    <button
                      key={`${r.name}-${r.addedAt}`}
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3.5 py-1.5 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors group"
                      title={r.name}
                      onClick={() => {
                        setIsOpen(false);
                      }}
                    >
                      <FileIcon name={r.name} />
                      <span className="flex-1 text-[12px] text-slate-600 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                        {r.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
          : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100'
      }`}
    />
  </button>
);

// ─── Generic menu item ───────────────────────────────────────────────────────

const MenuItem: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3.5 py-2 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
  >
    <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

export default AddFilesMenu;
