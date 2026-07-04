/**
 * AttachmentsLinksCanvas
 *
 * N-mode section for Attachments, External Links, and Internal Links.
 * Clean SaaS design — card-based, sentence-case headers, file-type icons,
 * coloured type chips, and graceful empty states.
 *
 * Replaces the old slot-based skeleton with a fully-featured implementation.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Edit3,
  ExternalLink,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { CloudFile, CloudProviderId } from '@/hooks/useCloudIntegrations';
import { useCloudIntegrations } from '@/hooks/useCloudIntegrations';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';

import type { Attachment } from '../../MyWork/shared/AttachmentsSection';
import type { LinkedItem, LinkRelationType } from '../../MyWork/shared/LinkedItemsSection';
import { ArtifactPermalinkButton } from '../ArtifactPermalinkButton';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AttachmentsLinksCanvasProps {
  /* ── Attachments ─────────────────────────────────────── */
  attachments: Attachment[];
  onUploadAttachments: (files: FileList) => Promise<void>;
  onDeleteAttachment: (id: string) => Promise<void>;
  onEditAttachment?: (id: string, patch: Partial<Attachment>) => void;

  /* ── Linked items ────────────────────────────────────── */
  linkedItems: LinkedItem[];
  onAddLinkedItem: (item: LinkedItem) => Promise<void>;
  onRemoveLinkedItem: (item: Pick<LinkedItem, 'id' | 'type'>) => Promise<void>;
  onEditLinkedItem?: (key: string, patch: Partial<LinkedItem>) => void;
  onNavigateLinkedItem?: (item: LinkedItem) => void;
  searchLinkedItems?: (query: string) => Promise<LinkedItem[]>;

  /* ── Control ─────────────────────────────────────────── */
  readOnly?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SVG icons for cloud providers (matching CloudFilePicker) */
const ProviderIcon: React.FC<{ id: string; className?: string }> = ({
  id,
  className = 'w-4 h-4',
}) => {
  if (id === 'google-drive')
    return (
      <svg viewBox="0 0 87.3 78" className={className}>
        <path
          d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"
          fill="#0066DA"
        />
        <path
          d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3L1.2 52.35c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-31.7z"
          fill="#00AC47"
        />
        <path
          d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.95 12.1 7.8 11.7z"
          fill="#EA4335"
        />
        <path
          d="M43.65 25.15L57.4 1.35c-1.35-.8-2.9-1.2-4.5-1.2H34.45c-1.6 0-3.15.45-4.55 1.2l13.75 23.8z"
          fill="#00832D"
        />
        <path
          d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h36.8c1.6 0 3.15-.45 4.55-1.2L59.8 53z"
          fill="#2684FC"
        />
        <path
          d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z"
          fill="#FFBA00"
        />
      </svg>
    );
  if (id === 'onedrive')
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M10.5 18.5h8.25a3.75 3.75 0 001.41-7.23 5.25 5.25 0 00-10.32 0A3.75 3.75 0 0010.5 18.5z" />
        <path
          d="M6.75 18.5h1.5a4.5 4.5 0 018.68-1.66 3 3 0 00-3.18-4.59 6 6 0 00-11.5 1.5A4.5 4.5 0 006.75 18.5z"
          opacity="0.7"
        />
      </svg>
    );
  if (id === 'dropbox')
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z" />
      </svg>
    );
  return null;
};

const CLOUD_PROVIDERS: Array<{ id: CloudProviderId; name: string; color: string }> = [
  { id: 'google-drive', name: 'Google Drive', color: 'text-emerald-400' },
  { id: 'onedrive', name: 'OneDrive', color: 'text-blue-400' },
  { id: 'dropbox', name: 'Dropbox', color: 'text-sky-400' },
];

/** Return a contextual file icon based on extension */
const FileIcon: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext))
    return <FileImage size={15} className={`text-blue-400 ${className}`} />;
  if (['xlsx', 'xls', 'csv', 'numbers'].includes(ext))
    return <FileSpreadsheet size={15} className={`text-emerald-400 ${className}`} />;
  if (['pdf'].includes(ext)) return <FileText size={15} className={`text-danger-400 ${className}`} />;
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext))
    return <FileText size={15} className={`text-blue-500 ${className}`} />;
  return <File size={15} className={`text-slate-600 ${className}`} />;
};

/** Coloured chip config per linked item type */
const TYPE_CHIP: Record<string, { bg: string; text: string; border: string }> = {
  task: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  decision: { bg: 'bg-primary-500/10', text: 'text-primary-400', border: 'border-primary-500/20' },
  risk: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  initiative: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  project: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  assessment: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  report: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  tool: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  insight: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20' },
  external: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/20' },
};

const getChip = (type: string) =>
  TYPE_CHIP[type] ?? {
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    border: 'border-slate-500/20',
  };

/** Relationship type labels for internal links (analogous to DEP_TYPE_LABELS in DependenciesSection) */
const LINK_RELATION_LABELS: Record<
  LinkRelationType,
  { short: string; en: string; pl: string; desc_en: string; desc_pl: string }
> = {
  related: {
    short: 'REL',
    en: 'Related',
    pl: 'Powiązane',
    desc_en: 'General relationship between items',
    desc_pl: 'Ogólne powiązanie między elementami',
  },
  blocks: {
    short: 'BLK',
    en: 'Blocks',
    pl: 'Blokuje',
    desc_en: 'This item blocks progress on the linked item',
    desc_pl: 'Ten element blokuje postęp w powiązanym elemencie',
  },
  depends_on: {
    short: 'DEP',
    en: 'Depends on',
    pl: 'Zależy od',
    desc_en: 'This item requires the linked item to progress',
    desc_pl: 'Ten element wymaga postępu powiązanego elementu',
  },
  parent_of: {
    short: 'PAR',
    en: 'Parent of',
    pl: 'Nadrzędny',
    desc_en: 'This item is a parent or container for the linked item',
    desc_pl: 'Ten element jest nadrzędny wobec powiązanego',
  },
  informs: {
    short: 'INF',
    en: 'Informs',
    pl: 'Informuje',
    desc_en: 'This item provides context or information to the linked item',
    desc_pl: 'Ten element dostarcza kontekst lub informacje powiązanemu',
  },
  duplicates: {
    short: 'DUP',
    en: 'Duplicates',
    pl: 'Duplikuje',
    desc_en: 'These items represent the same work or concept',
    desc_pl: 'Te elementy reprezentują tę samą pracę lub koncept',
  },
};

const ALL_LINK_RELATIONS: LinkRelationType[] = [
  'related',
  'blocks',
  'depends_on',
  'parent_of',
  'informs',
  'duplicates',
];

const getStatusBadge = (status?: string) => {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  if (!s) return 'border-slate-300/50 text-slate-600 bg-slate-100/60 dark:bg-slate-500/10';
  if (['approved', 'completed', 'done', 'closed', 'mitigated', 'resolved'].includes(s))
    return 'border-emerald-400/40 text-emerald-400 bg-emerald-500/10';
  if (['in progress', 'in_progress', 'active', 'open', 'monitoring', 'monitored'].includes(s))
    return 'border-blue-400/40 text-blue-400 bg-blue-500/10';
  if (['pending', 'review', 'deferred', 'draft'].includes(s))
    return 'border-amber-400/40 text-amber-400 bg-amber-500/10';
  if (['blocked', 'rejected', 'critical', 'overdue'].includes(s))
    return 'border-danger-400/40 text-danger-400 bg-danger-500/10';
  return 'border-slate-300/50 text-slate-600 bg-slate-100/60 dark:bg-slate-500/10';
};

const formatSize = (bytes: number) => {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

// ── Shared sub-components ────────────────────────────────────────────────────

/** Card wrapper for each sub-section */
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  count: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, count, actions, children }) => (
  <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/50 bg-white/60 dark:bg-navy-900/40 backdrop-blur-sm overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-navy-800/60 bg-slate-50/50 dark:bg-navy-900/30">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </span>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    <div className="px-4 py-3">{children}</div>
  </div>
);

/** Shared modal shell */
const ModalShell: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, wide, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border border-slate-200/50 dark:border-navy-700/50 bg-white dark:bg-navy-900 shadow-2xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-800/60">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  );
};

/** Shared form input */
const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const inputClass =
  'w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid transition-colors';

/** Shared action button for modals */
const ModalActions: React.FC<{
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  cancelLabel: string;
  disabled?: boolean;
}> = ({ onCancel, onConfirm, confirmLabel, cancelLabel, disabled }) => (
  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-navy-800/60">
    <button
      onClick={onCancel}
      className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
    >
      {cancelLabel}
    </button>
    {onConfirm && (
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="px-4 py-2 rounded-lg text-xs font-medium bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {confirmLabel}
      </button>
    )}
  </div>
);

/** Empty state placeholder */
const EmptyState: React.FC<{
  icon: React.ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, message, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-8 gap-3">
    <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
      {icon}
    </div>
    <p className="text-sm text-slate-600 dark:text-slate-500">{message}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 border border-primary-500/25 hover:bg-primary-500/20 transition-colors"
      >
        <Plus size={13} />
        {actionLabel}
      </button>
    )}
  </div>
);

/** Context menu (three-dot) */
const ContextMenu: React.FC<{
  items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }>;
  isOpen: boolean;
  onToggle: () => void;
  triggerTitle?: string;
}> = ({ items, isOpen, onToggle, triggerTitle }) => (
  <div className="relative" onClick={(e) => e.stopPropagation()}>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="p-1 rounded-md text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/50 transition-colors"
      title={triggerTitle}
    >
      <MoreVertical size={14} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute right-0 top-7 z-30 min-w-[160px] rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-xl p-1.5"
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                item.danger
                  ? 'text-danger-500 hover:bg-danger-500/10'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-navy-800/50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

export const AttachmentsLinksCanvas: React.FC<AttachmentsLinksCanvasProps> = ({
  attachments,
  onUploadAttachments,
  onDeleteAttachment,
  onEditAttachment,
  linkedItems,
  onAddLinkedItem,
  onRemoveLinkedItem,
  onEditLinkedItem,
  onNavigateLinkedItem,
  searchLinkedItems,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // ── Attachment state ──────────────────────────────────────────────────────
  const [attachmentSortOrder, setAttachmentSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentSource, setAttachmentSource] = useState<'device' | 'cloud'>('device');
  const [attachmentDiskFiles, setAttachmentDiskFiles] = useState<File[]>([]);
  const [selectedCloudProvider, setSelectedCloudProvider] =
    useState<CloudProviderId>('google-drive');
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  // ── Linked items state ────────────────────────────────────────────────────
  const [linkedItemsSortOrder, setLinkedItemsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isInternalLinkModalOpen, setIsInternalLinkModalOpen] = useState(false);
  const [isExternalLinkModalOpen, setIsExternalLinkModalOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<LinkedItem[]>([]);
  const [isLinkSearching, setIsLinkSearching] = useState(false);
  const [externalLinkTitle, setExternalLinkTitle] = useState('');
  const [externalLinkUrl, setExternalLinkUrl] = useState('');
  const [externalLinkComment, setExternalLinkComment] = useState('');
  const [editingLinkedItem, setEditingLinkedItem] = useState<LinkedItem | null>(null);

  // ── Internal link configuration state (professional dialog) ───────
  const [selectedLinkRelation, setSelectedLinkRelation] = useState<LinkRelationType>('related');
  const [selectedLinkDirection, setSelectedLinkDirection] = useState<'outgoing' | 'incoming'>(
    'outgoing'
  );
  const [internalLinkComment, setInternalLinkComment] = useState('');
  const [stagedInternalItem, setStagedInternalItem] = useState<LinkedItem | null>(null);
  const [isGeneratingLinkComment, setIsGeneratingLinkComment] = useState(false);

  // ── Cloud integrations ────────────────────────────────────────────────────
  const {
    connectedProviderIds,
    openFilePicker,
    closeFilePicker,
    isPickerOpen,
    activeProvider,
    selectFile,
    isImplemented: isCloudImplemented,
  } = useCloudIntegrations();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredAttachments = useMemo(() => {
    return [...attachments].sort((a, b) => {
      const at = new Date(a.uploadedAt || '').getTime() || 0;
      const bt = new Date(b.uploadedAt || '').getTime() || 0;
      return attachmentSortOrder === 'asc' ? at - bt : bt - at;
    });
  }, [attachments, attachmentSortOrder]);

  const externalItems = useMemo(
    () =>
      [...linkedItems.filter((i) => i.type === 'external')].sort((a, b) => {
        const l = (a.title || '').toLowerCase();
        const r = (b.title || '').toLowerCase();
        return linkedItemsSortOrder === 'asc' ? l.localeCompare(r) : r.localeCompare(l);
      }),
    [linkedItems, linkedItemsSortOrder]
  );

  const internalItems = useMemo(() => {
    const internal = linkedItems.filter((i) => i.type !== 'external');
    return [...internal].sort((a, b) => {
      const l = (a.title || '').toLowerCase();
      const r = (b.title || '').toLowerCase();
      return linkedItemsSortOrder === 'asc' ? l.localeCompare(r) : r.localeCompare(l);
    });
  }, [linkedItems, linkedItemsSortOrder]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const close = () => setOpenMenuKey(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAttachmentModalOpen(false);
        setIsInternalLinkModalOpen(false);
        setIsExternalLinkModalOpen(false);
        setEditingAttachment(null);
        setEditingLinkedItem(null);
        // Reset internal link professional dialog state
        setStagedInternalItem(null);
        setSelectedLinkRelation('related');
        setSelectedLinkDirection('outgoing');
        setInternalLinkComment('');
        setLinkSearchQuery('');
        setLinkSearchResults([]);
        closeFilePicker();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeFilePicker]);

  // ── Link search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    if (!searchLinkedItems) return;
    if (linkSearchQuery.trim().length < 2) {
      setLinkSearchResults([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setIsLinkSearching(true);
      try {
        const results = await searchLinkedItems(linkSearchQuery.trim());
        setLinkSearchResults(results);
      } catch {
        setLinkSearchResults([]);
      } finally {
        setIsLinkSearching(false);
      }
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [linkSearchQuery, searchLinkedItems]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAttachmentModal = () => {
    setAttachmentDiskFiles([]);
    setAttachmentSource('device');
    setSelectedCloudProvider('google-drive');
    setIsAttachmentModalOpen(true);
  };

  const closeAttachmentModal = useCallback(() => {
    setIsAttachmentModalOpen(false);
    setAttachmentDiskFiles([]);
    setAttachmentSource('device');
    closeFilePicker();
  }, [closeFilePicker]);

  const saveAttachmentFromModal = async () => {
    if (attachmentDiskFiles.length === 0) {
      toast.error(isPolish ? 'Wybierz co najmniej jeden plik' : 'Choose at least one file');
      return;
    }
    const dt = new DataTransfer();
    attachmentDiskFiles.forEach((f) => dt.items.add(f));
    await onUploadAttachments(dt.files);
    closeAttachmentModal();
  };

  const handleCloudFileSelect = useCallback(
    async (file: CloudFile) => {
      if (!activeProvider) return;
      const downloaded = await selectFile(file, activeProvider);
      if (downloaded) {
        setAttachmentDiskFiles((prev) => [...prev, downloaded]);
        toast.success(isPolish ? `Dodano: ${downloaded.name}` : `Added: ${downloaded.name}`);
      } else {
        toast.error(isPolish ? 'Nie udało się pobrać pliku' : 'Failed to download file');
      }
      closeFilePicker();
    },
    [activeProvider, closeFilePicker, isPolish, selectFile]
  );

  const openCloudPicker = useCallback(() => {
    if (!connectedProviderIds.includes(selectedCloudProvider)) {
      toast(
        isPolish
          ? 'Podłącz tę chmurę w Ustawieniach → Integracje'
          : 'Connect this provider in Settings → Integrations',
        { icon: '🔗' }
      );
      return;
    }
    if (!isCloudImplemented) {
      toast(
        isPolish ? 'Integracje chmurowe będą dostępne wkrótce.' : 'Cloud integrations coming soon.',
        { icon: '⏳' }
      );
      return;
    }
    openFilePicker(selectedCloudProvider);
  }, [connectedProviderIds, isCloudImplemented, isPolish, openFilePicker, selectedCloudProvider]);

  const handleSaveExternalLink = async () => {
    const url = externalLinkUrl.trim();
    if (!url) {
      toast.error(isPolish ? 'Podaj URL' : 'Provide a URL');
      return;
    }
    await onAddLinkedItem({
      id: `external-${Date.now()}`,
      type: 'external',
      title: externalLinkTitle.trim() || url,
      status: isPolish ? 'Zewnętrzny' : 'External',
      externalUrl: url,
      url,
      comment: externalLinkComment.trim() || undefined,
    });
    setExternalLinkTitle('');
    setExternalLinkUrl('');
    setExternalLinkComment('');
    setIsExternalLinkModalOpen(false);
  };

  /** Stage an internal item for linking (professional dialog) */
  const handleStageInternalItem = (item: LinkedItem) => {
    setStagedInternalItem(item);
    setLinkSearchQuery('');
    setLinkSearchResults([]);
  };

  /** Close and reset the internal link dialog */
  const closeInternalLinkModal = () => {
    setIsInternalLinkModalOpen(false);
    setLinkSearchQuery('');
    setLinkSearchResults([]);
    setStagedInternalItem(null);
    setSelectedLinkRelation('related');
    setSelectedLinkDirection('outgoing');
    setInternalLinkComment('');
  };

  /** Confirm and add the staged internal link */
  const handleConfirmInternalLink = async () => {
    if (!stagedInternalItem) return;
    await onAddLinkedItem({
      ...stagedInternalItem,
      linkRelation: selectedLinkRelation,
      linkDirection: selectedLinkDirection,
      comment: internalLinkComment.trim() || undefined,
    });
    closeInternalLinkModal();
  };

  /** AI-generate a comment that explains the chosen relationship */
  const handleAIGenerateLinkComment = async () => {
    setIsGeneratingLinkComment(true);
    try {
      const relLabel = LINK_RELATION_LABELS[selectedLinkRelation];
      const dirLabel =
        selectedLinkDirection === 'outgoing'
          ? 'Outgoing (This item → Target)'
          : 'Incoming (Target → This item)';
      const targetName =
        stagedInternalItem?.title ||
        (isPolish ? '(element jeszcze nie wybrany)' : '(item not yet selected)');
      const targetType = stagedInternalItem?.type || '';

      const prompt = isPolish
        ? `Opisz krótko (1-2 zdania) powiązanie wewnętrzne między elementami w systemie zarządzania projektami.
Typ relacji: ${relLabel.pl} (${relLabel.short}) — ${relLabel.desc_pl}
Kierunek: ${selectedLinkDirection === 'outgoing' ? 'Wychodzący (ten element → cel)' : 'Przychodzący (cel → ten element)'}
Element docelowy: ${targetName}${targetType ? ` (typ: ${targetType})` : ''}
Napisz czytelny, profesjonalny komentarz wyjaśniający dlaczego to powiązanie istnieje i jakie ma znaczenie. Odpowiedz TYLKO komentarzem, bez nagłówków.`
        : `Write a brief (1-2 sentence) comment describing an internal link between items in a project management system.
Relationship type: ${relLabel.en} (${relLabel.short}) — ${relLabel.desc_en}
Direction: ${dirLabel}
Target item: ${targetName}${targetType ? ` (type: ${targetType})` : ''}
Write a clear, professional comment explaining why this link exists and its significance. Respond ONLY with the comment, no headings.`;

      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: isPolish
          ? 'Jesteś analitykiem projektowym. Piszesz zwięźle i profesjonalnie po polsku.'
          : 'You are a project analyst. Write concisely and professionally.',
        roleName: 'Link Comment Advisor',
      });

      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      if (raw) {
        setInternalLinkComment(raw);
      }
    } catch {
      toast.error(isPolish ? 'Nie udało się wygenerować komentarza' : 'Failed to generate comment');
    } finally {
      setIsGeneratingLinkComment(false);
    }
  };

  const saveEditedAttachment = () => {
    if (!editingAttachment || !onEditAttachment) return;
    onEditAttachment(editingAttachment.id, {
      name: editingAttachment.name,
      url: editingAttachment.url,
    });
    setEditingAttachment(null);
  };

  const saveEditedLinkedItem = () => {
    if (!editingLinkedItem || !onEditLinkedItem) return;
    onEditLinkedItem(`${editingLinkedItem.type}:${editingLinkedItem.id}`, {
      title: editingLinkedItem.title,
      status: editingLinkedItem.status,
      externalUrl: editingLinkedItem.externalUrl,
      url: editingLinkedItem.url,
      comment: editingLinkedItem.comment,
    });
    setEditingLinkedItem(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
        {isPolish
          ? 'Załączniki, linki wewnętrzne i zewnętrzne'
          : 'Attachments, Internal Links & External Links'}
      </h2>

      {/* ━━ ATTACHMENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SectionCard
        icon={<Paperclip size={15} className="text-slate-600" />}
        title={isPolish ? 'Załączniki' : 'Attachments'}
        count={filteredAttachments.length}
        actions={
          <>
            <button
              type="button"
              onClick={() => setAttachmentSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300/50 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:border-primary-400/40 transition-colors"
              title={
                attachmentSortOrder === 'asc'
                  ? isPolish
                    ? 'Najstarsze'
                    : 'Oldest first'
                  : isPolish
                    ? 'Najnowsze'
                    : 'Newest first'
              }
            >
              <ArrowDownUp size={11} />
            </button>
            {!readOnly && (
              <button
                onClick={openAttachmentModal}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Plus size={12} />
                {isPolish ? 'Dodaj' : 'Add file'}
              </button>
            )}
          </>
        }
      >
        {filteredAttachments.length === 0 ? (
          <EmptyState
            icon={<Paperclip size={20} className="text-slate-600 dark:text-slate-400" />}
            message={isPolish ? 'Brak załączników.' : 'No attachments yet.'}
          />
        ) : (
          <div className="space-y-0.5">
            {filteredAttachments.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-3 px-2.5 py-2 -mx-1 rounded-lg hover:bg-slate-50/80 dark:hover:bg-navy-800/40 transition-colors"
              >
                <FileIcon name={a.name} />
                <button
                  onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
                  className="flex-1 min-w-0 text-left text-sm text-slate-700 dark:text-slate-200 truncate hover:text-primary-500 transition-colors"
                  title={a.name}
                >
                  {a.name}
                </button>
                <span className="text-[11px] text-slate-600 dark:text-slate-500 tabular-nums whitespace-nowrap">
                  {formatSize(a.size)}
                </span>
                {!readOnly && (
                  <ContextMenu
                    isOpen={openMenuKey === `att:${a.id}`}
                    onToggle={() =>
                      setOpenMenuKey((p) => (p === `att:${a.id}` ? null : `att:${a.id}`))
                    }
                    triggerTitle={isPolish ? 'Opcje' : 'Options'}
                    items={[
                      {
                        label: isPolish ? 'Podgląd' : 'Preview',
                        icon: <Eye size={13} />,
                        onClick: () => {
                          setOpenMenuKey(null);
                          if (a.url) window.open(a.url, '_blank', 'noopener,noreferrer');
                        },
                      },
                      ...(onEditAttachment
                        ? [
                            {
                              label: isPolish ? 'Edytuj' : 'Edit',
                              icon: <Edit3 size={13} />,
                              onClick: () => {
                                setOpenMenuKey(null);
                                setEditingAttachment({ ...a });
                              },
                            },
                          ]
                        : []),
                      {
                        label: isPolish ? 'Usuń' : 'Delete',
                        icon: <X size={13} />,
                        danger: true,
                        onClick: () => {
                          setOpenMenuKey(null);
                          void onDeleteAttachment(a.id);
                        },
                      },
                    ]}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ━━ EXTERNAL LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SectionCard
        icon={<Globe size={15} className="text-slate-600" />}
        title={isPolish ? 'Linki zewnętrzne' : 'External Links'}
        count={externalItems.length}
        actions={
          <>
            <button
              type="button"
              onClick={() => setLinkedItemsSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300/50 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:border-primary-400/40 transition-colors"
              title={linkedItemsSortOrder === 'asc' ? 'A → Z' : 'Z → A'}
            >
              <ArrowDownUp size={11} />
            </button>
            {!readOnly && (
              <button
                onClick={() => {
                  setExternalLinkTitle('');
                  setExternalLinkUrl('');
                  setExternalLinkComment('');
                  setIsExternalLinkModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Plus size={12} />
                {isPolish ? 'Dodaj' : 'Add link'}
              </button>
            )}
          </>
        }
      >
        {externalItems.length === 0 ? (
          <EmptyState
            icon={<Globe size={20} className="text-slate-600 dark:text-slate-400" />}
            message={isPolish ? 'Brak linków zewnętrznych.' : 'No external links yet.'}
          />
        ) : (
          <div className="space-y-0.5">
            {externalItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 px-2.5 py-2 -mx-1 rounded-lg hover:bg-slate-50/80 dark:hover:bg-navy-800/40 transition-colors"
              >
                <ExternalLink size={14} className="text-slate-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onNavigateLinkedItem?.(item)}
                    className="text-sm text-slate-700 dark:text-slate-200 truncate text-left hover:text-primary-500 transition-colors block w-full"
                    title={item.title}
                  >
                    {item.title}
                  </button>
                  {item.comment && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-500 truncate mt-0.5">
                      {item.comment}
                    </p>
                  )}
                </div>
                <ArtifactPermalinkButton
                  artifactType={item.type}
                  artifactId={item.id}
                  isPolish={isPolish}
                  size={12}
                  className="p-1 text-slate-600/80"
                />
                {!readOnly && (
                  <ContextMenu
                    isOpen={openMenuKey === `ext:${item.id}`}
                    onToggle={() =>
                      setOpenMenuKey((p) => (p === `ext:${item.id}` ? null : `ext:${item.id}`))
                    }
                    triggerTitle={isPolish ? 'Opcje' : 'Options'}
                    items={[
                      {
                        label: isPolish ? 'Otwórz' : 'Open',
                        icon: <Eye size={13} />,
                        onClick: () => {
                          setOpenMenuKey(null);
                          onNavigateLinkedItem?.(item);
                        },
                      },
                      ...(onEditLinkedItem
                        ? [
                            {
                              label: isPolish ? 'Edytuj' : 'Edit',
                              icon: <Edit3 size={13} />,
                              onClick: () => {
                                setOpenMenuKey(null);
                                setEditingLinkedItem({ ...item });
                              },
                            },
                          ]
                        : []),
                      {
                        label: isPolish ? 'Usuń' : 'Remove',
                        icon: <X size={13} />,
                        danger: true,
                        onClick: () => {
                          setOpenMenuKey(null);
                          void onRemoveLinkedItem(item);
                        },
                      },
                    ]}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ━━ INTERNAL LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <SectionCard
        icon={<LinkIcon size={15} className="text-slate-600" />}
        title={isPolish ? 'Linki wewnętrzne' : 'Internal Links'}
        count={internalItems.length}
        actions={
          <>
            <button
              type="button"
              onClick={() => setLinkedItemsSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-300/50 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:text-primary-500 hover:border-primary-400/40 transition-colors"
              title={linkedItemsSortOrder === 'asc' ? 'A → Z' : 'Z → A'}
            >
              <ArrowDownUp size={11} />
            </button>
            {!readOnly && (
              <button
                onClick={() => {
                  setLinkSearchQuery('');
                  setLinkSearchResults([]);
                  setStagedInternalItem(null);
                  setSelectedLinkRelation('related');
                  setSelectedLinkDirection('outgoing');
                  setInternalLinkComment('');
                  setIsInternalLinkModalOpen(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                <Plus size={12} />
                {isPolish ? 'Dodaj' : 'Add link'}
              </button>
            )}
          </>
        }
      >
        {internalItems.length === 0 ? (
          <EmptyState
            icon={<LinkIcon size={20} className="text-slate-600 dark:text-slate-400" />}
            message={isPolish ? 'Brak powiązań wewnętrznych.' : 'No internal links yet.'}
          />
        ) : (
          <div className="space-y-0.5">
            {internalItems.map((item) => {
              const chip = getChip(item.type);
              return (
                <div
                  key={`${item.type}:${item.id}`}
                  className="group flex items-center gap-3 px-2.5 py-2 -mx-1 rounded-lg hover:bg-slate-50/80 dark:hover:bg-navy-800/40 transition-colors"
                >
                  {/* Type chip */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${chip.bg} ${chip.text} ${chip.border} min-w-[56px] justify-center`}
                  >
                    {item.type}
                  </span>

                  {/* Title */}
                  <button
                    onClick={() => onNavigateLinkedItem?.(item)}
                    className="flex-1 min-w-0 text-left text-sm text-slate-700 dark:text-slate-200 truncate hover:text-primary-500 transition-colors"
                    title={item.title}
                  >
                    {item.title}
                  </button>

                  {/* Permalink */}
                  <ArtifactPermalinkButton
                    artifactType={item.type}
                    artifactId={item.id}
                    isPolish={isPolish}
                    size={12}
                    className="p-1 text-slate-600/80"
                  />

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium whitespace-nowrap ${getStatusBadge(
                      item.status
                    )}`}
                  >
                    {item.status || '—'}
                  </span>

                  {/* Actions */}
                  {!readOnly && (
                    <ContextMenu
                      isOpen={openMenuKey === `int:${item.type}:${item.id}`}
                      onToggle={() =>
                        setOpenMenuKey((p) =>
                          p === `int:${item.type}:${item.id}` ? null : `int:${item.type}:${item.id}`
                        )
                      }
                      triggerTitle={isPolish ? 'Opcje' : 'Options'}
                      items={[
                        {
                          label: isPolish ? 'Otwórz' : 'Open',
                          icon: <Eye size={13} />,
                          onClick: () => {
                            setOpenMenuKey(null);
                            onNavigateLinkedItem?.(item);
                          },
                        },
                        ...(onEditLinkedItem
                          ? [
                              {
                                label: isPolish ? 'Edytuj' : 'Edit',
                                icon: <Edit3 size={13} />,
                                onClick: () => {
                                  setOpenMenuKey(null);
                                  setEditingLinkedItem({ ...item });
                                },
                              },
                            ]
                          : []),
                        {
                          label: isPolish ? 'Usuń' : 'Remove',
                          icon: <X size={13} />,
                          danger: true,
                          onClick: () => {
                            setOpenMenuKey(null);
                            void onRemoveLinkedItem(item);
                          },
                        },
                      ]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ━━ MODALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {/* ── Add Attachment Modal ──────────────────────────────────────────── */}
      <ModalShell
        isOpen={isAttachmentModalOpen}
        onClose={closeAttachmentModal}
        title={isPolish ? 'Dodaj załącznik' : 'Add attachment'}
      >
        {/* Source tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 dark:bg-navy-800/60 p-1">
          <button
            onClick={() => setAttachmentSource('device')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              attachmentSource === 'device'
                ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HardDrive size={14} />
            {isPolish ? 'Z komputera' : 'From computer'}
          </button>
          <button
            onClick={() => setAttachmentSource('cloud')}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              attachmentSource === 'cloud'
                ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Cloud size={14} />
            {isPolish ? 'Z chmury' : 'From cloud'}
          </button>
        </div>

        {attachmentSource === 'device' ? (
          <label className="block cursor-pointer">
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) =>
                setAttachmentDiskFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
              }
            />
            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/30 p-6 min-h-[120px] transition-all hover:border-primary-400/60 hover:bg-primary-500/5 flex items-center justify-center">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary-500/10 flex items-center justify-center">
                  <Upload size={18} className="text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Kliknij, aby wybrać pliki' : 'Click to choose files'}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-500 mt-0.5">
                    {isPolish
                      ? 'Możesz wybrać wiele plików jednocześnie'
                      : 'You can select multiple files at once'}
                  </p>
                </div>
              </div>
            </div>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Dostawca chmury' : 'Cloud provider'}
              </span>
              {connectedProviderIds.length === 0 && (
                <button
                  onClick={() => window.location.assign(ROUTES.SETTINGS.INTEGRATIONS)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Settings size={11} />
                  {isPolish ? 'Ustawienia' : 'Settings'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CLOUD_PROVIDERS.map((p) => {
                const connected = connectedProviderIds.includes(p.id);
                const selected = selectedCloudProvider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedCloudProvider(p.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                      selected
                        ? 'border-primary-500/50 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-c-info/20'
                        : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={p.color}>
                        <ProviderIcon id={p.id} className="w-4 h-4" />
                      </span>
                      <span className={`text-xs font-semibold ${p.color}`}>{p.name}</span>
                    </div>
                    <span
                      className={`block mt-1.5 text-[10px] ${
                        connected ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    >
                      {connected
                        ? isPolish
                          ? 'Połączono'
                          : 'Connected'
                        : isPolish
                          ? 'Niepołączono'
                          : 'Not connected'}
                    </span>
                  </button>
                );
              })}
            </div>

            {!connectedProviderIds.includes(selectedCloudProvider) ? (
              <div className="rounded-lg bg-amber-500/10 border border-amber-400/20 px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-amber-400">
                  {isPolish ? 'Chmura niepołączona.' : 'Cloud not connected.'}
                </span>
                <button
                  onClick={() => window.location.assign(ROUTES.SETTINGS.INTEGRATIONS)}
                  className="text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                >
                  {isPolish ? 'Podłącz' : 'Connect'}
                </button>
              </div>
            ) : (
              <button
                onClick={openCloudPicker}
                className="w-full rounded-lg border border-primary-500/30 bg-primary-500/5 px-3 py-2.5 text-xs font-medium text-primary-400 hover:bg-primary-500/10 transition-colors"
              >
                {isPolish ? 'Wybierz plik z chmury' : 'Choose file from cloud'}
              </button>
            )}
          </div>
        )}

        {/* Selected files list */}
        {attachmentDiskFiles.length > 0 && (
          <div className="max-h-44 overflow-y-auto space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500 px-1">
              {isPolish
                ? `Wybrane pliki (${attachmentDiskFiles.length})`
                : `Selected files (${attachmentDiskFiles.length})`}
            </p>
            {attachmentDiskFiles.map((file) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon name={file.name} />
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-slate-600 whitespace-nowrap">
                    {formatSize(file.size)}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setAttachmentDiskFiles((prev) =>
                      prev.filter(
                        (f) =>
                          !(
                            f.name === file.name &&
                            f.size === file.size &&
                            f.lastModified === file.lastModified
                          )
                      )
                    )
                  }
                  className="text-slate-600 hover:text-danger-400 transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <ModalActions
          cancelLabel={isPolish ? 'Anuluj' : 'Cancel'}
          confirmLabel={isPolish ? 'Dodaj' : 'Add'}
          onCancel={closeAttachmentModal}
          onConfirm={() => void saveAttachmentFromModal()}
          disabled={attachmentDiskFiles.length === 0}
        />
      </ModalShell>

      {/* ── Edit Attachment Modal ─────────────────────────────────────────── */}
      <ModalShell
        isOpen={!!editingAttachment}
        onClose={() => setEditingAttachment(null)}
        title={isPolish ? 'Edytuj załącznik' : 'Edit attachment'}
      >
        {editingAttachment && (
          <>
            <FormField label={isPolish ? 'Nazwa' : 'Name'}>
              <input
                value={editingAttachment.name}
                onChange={(e) =>
                  setEditingAttachment({ ...editingAttachment, name: e.target.value })
                }
                className={inputClass}
              />
            </FormField>
            <FormField label="URL">
              <input
                value={editingAttachment.url}
                onChange={(e) =>
                  setEditingAttachment({ ...editingAttachment, url: e.target.value })
                }
                className={inputClass}
              />
            </FormField>
            <ModalActions
              cancelLabel={isPolish ? 'Anuluj' : 'Cancel'}
              confirmLabel={isPolish ? 'Zapisz' : 'Save'}
              onCancel={() => setEditingAttachment(null)}
              onConfirm={saveEditedAttachment}
            />
          </>
        )}
      </ModalShell>

      {/* ── Add Internal Link — Professional Dialog ──────────────────────── */}
      <AnimatePresence>
        {isInternalLinkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={closeInternalLinkModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200/60 dark:border-navy-700/60"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ─────────────────────────────── */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700/70 bg-gradient-to-r from-primary-50/40 via-white to-white dark:from-primary-500/5 dark:via-navy-900 dark:to-navy-900">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary-100 dark:bg-primary-500/15">
                    <LinkIcon size={16} className="text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 dark:text-white">
                      {isPolish ? 'Nowe połączenie wewnętrzne' : 'New Internal Link'}
                    </h3>
                    <p className="text-[11px] text-secondary-600 dark:text-slate-500 mt-0.5">
                      {isPolish
                        ? 'Skonfiguruj relację i wybierz element do powiązania'
                        : 'Configure relationship and select an item to link'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeInternalLinkModal}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-secondary-500 hover:text-secondary-800 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Scrollable body ────────────────────── */}
              <div className="overflow-y-auto max-h-[calc(80vh-140px)]">
                {/* ── Section: Direction ────────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-secondary-800 dark:text-slate-400 mb-2.5 block">
                    {isPolish ? 'Kierunek' : 'Direction'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedLinkDirection('outgoing')}
                      className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center ${
                        selectedLinkDirection === 'outgoing'
                          ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-500/10 shadow-sm shadow-primary-500/10'
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-800/50'
                      }`}
                    >
                      <ArrowRight
                        size={16}
                        className={
                          selectedLinkDirection === 'outgoing'
                            ? 'text-primary-500'
                            : 'text-slate-600'
                        }
                      />
                      <span
                        className={`text-xs font-semibold ${selectedLinkDirection === 'outgoing' ? 'text-primary-700 dark:text-primary-300' : 'text-secondary-700 dark:text-slate-400'}`}
                      >
                        {isPolish ? 'Wychodzące' : 'Outgoing'}
                      </span>
                      <span
                        className={`text-[10px] leading-tight ${selectedLinkDirection === 'outgoing' ? 'text-primary-500/70 dark:text-primary-400/60' : 'text-secondary-500 dark:text-slate-500'}`}
                      >
                        {isPolish ? 'Ten element → Docelowy' : 'This item → Target'}
                      </span>
                    </button>
                    <button
                      onClick={() => setSelectedLinkDirection('incoming')}
                      className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all text-center ${
                        selectedLinkDirection === 'incoming'
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-sm shadow-blue-500/10'
                          : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 bg-white dark:bg-navy-800/50'
                      }`}
                    >
                      <ArrowLeft
                        size={16}
                        className={
                          selectedLinkDirection === 'incoming' ? 'text-blue-500' : 'text-slate-600'
                        }
                      />
                      <span
                        className={`text-xs font-semibold ${selectedLinkDirection === 'incoming' ? 'text-blue-700 dark:text-blue-300' : 'text-secondary-700 dark:text-slate-400'}`}
                      >
                        {isPolish ? 'Przychodzące' : 'Incoming'}
                      </span>
                      <span
                        className={`text-[10px] leading-tight ${selectedLinkDirection === 'incoming' ? 'text-blue-500/70 dark:text-blue-400/60' : 'text-secondary-500 dark:text-slate-500'}`}
                      >
                        {isPolish ? 'Docelowy → Ten element' : 'Target → This item'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* ── Section: Relationship Type ───────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-secondary-800 dark:text-slate-400 mb-2.5 block">
                    {isPolish ? 'Typ relacji' : 'Relationship Type'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_LINK_RELATIONS.map((rel) => (
                      <button
                        key={rel}
                        onClick={() => setSelectedLinkRelation(rel)}
                        className={`group relative px-2 py-2.5 rounded-xl text-center transition-all ${
                          selectedLinkRelation === rel
                            ? 'bg-c-text text-c-bg shadow-md shadow-black/10 ring-1 ring-c-focus'
                            : 'bg-slate-50 dark:bg-navy-800 text-secondary-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-200/50 dark:border-navy-700/50'
                        }`}
                      >
                        <span className="block text-sm font-mono font-bold">
                          {LINK_RELATION_LABELS[rel].short}
                        </span>
                        <span
                          className={`block text-[9px] leading-tight mt-1 ${
                            selectedLinkRelation === rel
                              ? 'text-white/70'
                              : 'text-secondary-500 dark:text-slate-500'
                          }`}
                        >
                          {isPolish ? LINK_RELATION_LABELS[rel].pl : LINK_RELATION_LABELS[rel].en}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Type description */}
                  <p className="mt-2.5 text-[11px] text-secondary-600 dark:text-slate-500 bg-slate-50/50 dark:bg-navy-800/30 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700/30">
                    {isPolish
                      ? LINK_RELATION_LABELS[selectedLinkRelation].desc_pl
                      : LINK_RELATION_LABELS[selectedLinkRelation].desc_en}
                  </p>
                </div>

                {/* ── Section: Notes ────────────────────── */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-600 dark:text-slate-500 flex items-center gap-1.5">
                      <MessageSquare size={11} />
                      {isPolish ? 'Komentarz' : 'Comment'}
                      <span className="text-[9px] font-normal text-slate-600 dark:text-slate-400 ml-1">
                        ({isPolish ? 'opcjonalny' : 'optional'})
                      </span>
                    </label>
                    <button
                      onClick={handleAIGenerateLinkComment}
                      disabled={isGeneratingLinkComment}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gradient-to-r from-primary-500/10 to-crimson-700/10 text-primary-600 dark:text-primary-400 border border-primary-300/40 dark:border-primary-500/30 hover:from-primary-500/20 hover:to-crimson-700/20 hover:border-primary-400/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        isPolish
                          ? 'AI wygeneruje komentarz na podstawie wybranej relacji'
                          : 'AI will generate a comment based on the selected relationship'
                      }
                    >
                      {isGeneratingLinkComment ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {isPolish ? 'AI Opisz' : 'AI Describe'}
                    </button>
                  </div>
                  <textarea
                    value={internalLinkComment}
                    onChange={(e) => setInternalLinkComment(e.target.value)}
                    placeholder={
                      isPolish
                        ? 'Dodaj kontekst, powód lub uwagi do tego połączenia...'
                        : 'Add context, reason, or notes about this link...'
                    }
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid transition-all resize-none"
                  />
                </div>

                {/* ── Section: Staged Item (selected) ──── */}
                {stagedInternalItem && (
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700/50">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-secondary-800 dark:text-slate-400 mb-2 block">
                      {isPolish ? 'Wybrany element' : 'Selected Item'}
                    </label>
                    <div className="flex items-center gap-3 rounded-xl border-2 border-primary-300 dark:border-primary-500/40 bg-primary-50/50 dark:bg-primary-500/5 px-3.5 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${getChip(stagedInternalItem.type).bg} ${getChip(stagedInternalItem.type).text} ${getChip(stagedInternalItem.type).border} min-w-[56px] justify-center`}
                      >
                        {stagedInternalItem.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                          {stagedInternalItem.title}
                        </p>
                        {stagedInternalItem.status && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${getStatusBadge(stagedInternalItem.status)}`}
                          >
                            {stagedInternalItem.status}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setStagedInternalItem(null)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
                        title={isPolish ? 'Usuń wybór' : 'Remove selection'}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Section: Search Item ─────────────── */}
                {!stagedInternalItem && (
                  <div className="px-6 py-4">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-secondary-800 dark:text-slate-400 mb-2.5 block">
                      {isPolish ? 'Wybierz element' : 'Select Item'}
                    </label>

                    {/* Info banner */}
                    <div className="rounded-lg bg-slate-50/80 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/50 px-3 py-2 text-[11px] text-secondary-600 dark:text-slate-500 mb-3">
                      {isPolish
                        ? 'Po podlinkowaniu metadane (status, priorytet) zostaną pobrane automatycznie.'
                        : 'After linking, record metadata (status, priority) will sync automatically.'}
                    </div>

                    <div className="relative">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                      />
                      <input
                        type="text"
                        value={linkSearchQuery}
                        onChange={(e) => setLinkSearchQuery(e.target.value)}
                        placeholder={
                          isPolish
                            ? 'Szukaj task, decision, initiative...'
                            : 'Search tasks, decisions, initiatives...'
                        }
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid transition-all"
                        autoFocus
                      />
                    </div>

                    {/* Search loading */}
                    {isLinkSearching && (
                      <div className="flex items-center justify-center py-6">
                        <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Search results */}
                    {linkSearchResults.length > 0 && (
                      <div className="mt-3 max-h-48 overflow-y-auto space-y-0.5 rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-800/20 p-1.5">
                        {linkSearchResults.slice(0, 16).map((item) => {
                          const chip = getChip(item.type);
                          return (
                            <button
                              key={`${item.type}:${item.id}`}
                              onClick={() => handleStageInternalItem(item)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white dark:hover:bg-navy-800 transition-colors text-left group"
                            >
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${chip.bg} ${chip.text} ${chip.border} min-w-[56px] justify-center`}
                              >
                                {item.type}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                  {item.title}
                                </p>
                              </div>
                              <span className="text-[10px] text-slate-600 whitespace-nowrap">
                                {item.status || '—'}
                              </span>
                              <div className="w-6 h-6 rounded-md bg-primary-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Check size={14} className="text-primary-500" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* No results */}
                    {linkSearchQuery.trim().length >= 2 &&
                      linkSearchResults.length === 0 &&
                      !isLinkSearching && (
                        <div className="mt-4 text-center py-4">
                          <Search
                            size={20}
                            className="mx-auto text-secondary-400 dark:text-slate-400 mb-2"
                          />
                          <p className="text-sm text-secondary-500">
                            {isPolish ? 'Brak wyników.' : 'No results found.'}
                          </p>
                          <p className="text-[11px] text-secondary-400 dark:text-slate-400 mt-0.5">
                            {isPolish ? 'Spróbuj innej frazy' : 'Try a different search term'}
                          </p>
                        </div>
                      )}

                    {/* Empty state */}
                    {linkSearchQuery.trim().length < 2 && !isLinkSearching && (
                      <p className="mt-3 text-center text-xs text-secondary-500 dark:text-slate-500 py-2">
                        {isPolish
                          ? 'Wpisz min. 2 znaki, aby wyszukać element do powiązania'
                          : 'Type at least 2 characters to search for an item to link'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Footer ─────────────────────────────── */}
              <div className="px-6 py-3.5 border-t border-slate-200 dark:border-navy-700/70 bg-slate-50/30 dark:bg-navy-800/20 flex items-center justify-between">
                <p className="text-[11px] text-secondary-600 dark:text-slate-500">
                  {stagedInternalItem
                    ? isPolish
                      ? 'Gotowe do dodania — kliknij Dodaj'
                      : 'Ready to add — click Add Link'
                    : isPolish
                      ? 'Wybierz element, aby kontynuować'
                      : 'Select an item to continue'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={closeInternalLinkModal}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-secondary-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                  >
                    {isPolish ? 'Anuluj' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => void handleConfirmInternalLink()}
                    disabled={!stagedInternalItem}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-black/10 transition-all hover:shadow-md hover:shadow-black/10"
                  >
                    {isPolish ? 'Dodaj połączenie' : 'Add Link'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add External Link Modal ──────────────────────────────────────── */}
      <ModalShell
        isOpen={isExternalLinkModalOpen}
        onClose={() => {
          setIsExternalLinkModalOpen(false);
          setExternalLinkTitle('');
          setExternalLinkUrl('');
          setExternalLinkComment('');
        }}
        title={isPolish ? 'Dodaj link zewnętrzny' : 'Add external link'}
      >
        <FormField label={isPolish ? 'Tytuł linku' : 'Link title'}>
          <input
            value={externalLinkTitle}
            onChange={(e) => setExternalLinkTitle(e.target.value)}
            placeholder={isPolish ? 'Np. Dokumentacja API' : 'e.g. API Documentation'}
            className={inputClass}
          />
        </FormField>
        <FormField label="URL">
          <input
            value={externalLinkUrl}
            onChange={(e) => setExternalLinkUrl(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </FormField>
        <FormField label={isPolish ? 'Komentarz (opcjonalnie)' : 'Comment (optional)'}>
          <textarea
            rows={4}
            value={externalLinkComment}
            onChange={(e) => setExternalLinkComment(e.target.value)}
            placeholder={
              isPolish
                ? 'Np. Finalna wersja dokumentu dla zespołu.'
                : 'e.g. Final document version for the team.'
            }
            className={`${inputClass} resize-none`}
          />
        </FormField>
        <ModalActions
          cancelLabel={isPolish ? 'Anuluj' : 'Cancel'}
          confirmLabel={isPolish ? 'Dodaj link' : 'Add link'}
          onCancel={() => {
            setIsExternalLinkModalOpen(false);
            setExternalLinkTitle('');
            setExternalLinkUrl('');
            setExternalLinkComment('');
          }}
          onConfirm={() => void handleSaveExternalLink()}
        />
      </ModalShell>

      {/* ── Edit Linked Item Modal ───────────────────────────────────────── */}
      <ModalShell
        isOpen={!!editingLinkedItem}
        onClose={() => setEditingLinkedItem(null)}
        title={
          editingLinkedItem?.type === 'external'
            ? isPolish
              ? 'Edytuj link zewnętrzny'
              : 'Edit external link'
            : isPolish
              ? 'Edytuj link wewnętrzny'
              : 'Edit internal link'
        }
      >
        {editingLinkedItem && (
          <>
            <FormField label={isPolish ? 'Tytuł' : 'Title'}>
              <input
                value={editingLinkedItem.title}
                onChange={(e) =>
                  setEditingLinkedItem({ ...editingLinkedItem, title: e.target.value })
                }
                className={inputClass}
              />
            </FormField>
            {editingLinkedItem.type !== 'external' && (
              <FormField label="Status">
                <input
                  value={editingLinkedItem.status || ''}
                  onChange={(e) =>
                    setEditingLinkedItem({ ...editingLinkedItem, status: e.target.value })
                  }
                  className={inputClass}
                />
              </FormField>
            )}
            {editingLinkedItem.type === 'external' && (
              <>
                <FormField label="URL">
                  <input
                    value={editingLinkedItem.externalUrl || editingLinkedItem.url || ''}
                    onChange={(e) =>
                      setEditingLinkedItem({
                        ...editingLinkedItem,
                        externalUrl: e.target.value,
                        url: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </FormField>
                <FormField label={isPolish ? 'Komentarz' : 'Comment'}>
                  <textarea
                    rows={3}
                    value={editingLinkedItem.comment || ''}
                    onChange={(e) =>
                      setEditingLinkedItem({ ...editingLinkedItem, comment: e.target.value })
                    }
                    className={`${inputClass} resize-none`}
                  />
                </FormField>
              </>
            )}
            <ModalActions
              cancelLabel={isPolish ? 'Anuluj' : 'Cancel'}
              confirmLabel={isPolish ? 'Zapisz' : 'Save'}
              onCancel={() => setEditingLinkedItem(null)}
              onConfirm={saveEditedLinkedItem}
            />
          </>
        )}
      </ModalShell>
    </div>
  );
};

export default AttachmentsLinksCanvas;
