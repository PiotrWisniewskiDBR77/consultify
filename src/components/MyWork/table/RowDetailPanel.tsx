/**
 * RowDetailPanel V2 — Full Idea Card Page.
 *
 * Every row is a living workspace: rich body, properties, sub-items,
 * attachments, comments, AI insights, activity log, related items, convert actions.
 * Notion-level depth with Consultify's company-context AI.
 */
import {
  ArrowRight,
  Bold,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Code,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  Heading1,
  Image,
  Italic,
  Link2,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  Paperclip,
  Pencil,
  PenTool,
  Plus,
  Rocket,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { OrganizationApi } from '@/services/api/organizations.api';
import type { ValidationStatus } from '@/services/api/recordProvenance.api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { useAppStore } from '@/store/useAppStore';
import type { TablePlatformField } from '@/types/tablePlatform';

import { CellRenderer } from './CellRenderer';
import { MiniCanvas } from './MiniCanvas';
import { ProvenanceCell } from './provenance/ProvenanceCell';
import { PROVENANCE_DATA_KEYS } from './tablePlatformMappers';
import type {
  ColumnDef,
  NodeActivity,
  NodeAttachment,
  NodeComment,
  TableEdge,
  TableNode,
} from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

function extractLinkedIds(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === 'string') {
    const t = val.trim();
    return t ? [t] : [];
  }
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      if (typeof v === 'string') {
        const s = v.trim();
        return s ? [s] : [];
      }
      if (
        v &&
        typeof v === 'object' &&
        'id' in v &&
        typeof (v as { id: unknown }).id === 'string'
      ) {
        return [(v as { id: string }).id];
      }
      return [];
    });
  }
  if (typeof val === 'object' && 'id' in val && typeof (val as { id: unknown }).id === 'string') {
    return [(val as { id: string }).id];
  }
  return [];
}

interface RowDetailPanelProps {
  open: boolean;
  onClose: () => void;
  node: TableNode | null;
  columns: ColumnDef[];
  edges: TableEdge[];
  allNodes: TableNode[];
  locked?: boolean;
  mode?: 'preview' | 'full';
  onExpand?: () => void;
  onFieldChange: (nodeId: string, field: string, value: any) => void;
  onConvert?: (target: 'initiative' | 'task' | 'decision') => void;
  onAddSubItem?: (parentId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onAddRelation?: (sourceId: string, targetId: string) => void;
  onLinkArtifact?: (nodeId: string) => void;
  ideaId?: string;
  /** Platform table fields — when present, enables platform sheet UX (tabs, related records). */
  fields?: TablePlatformField[];
  /** `tp_tables.id` for platform API calls (watch, comments). Falls back to `fields[0].tableId`. */
  platformTableId?: string | null;
  /** Tab to land on when the panel (re)opens — e.g. "Add note" deep-links straight to Comments. Defaults to Properties/Fields. */
  initialTab?: 'properties' | 'comments';
}

type TabId = 'properties' | 'comments' | 'attachments' | 'activity' | 'ai' | 'drawing';

type PlatformSheetTabId = 'fields' | 'activity' | 'audit' | 'comments' | 'attachments';

/** Fallback grouping key for record attachments uploaded from the generic Row
 * Detail panel when the table has no dedicated `attachment`-type field. The
 * backend (`tp_attachments.field_id`) has no FK constraint on this value — it
 * is used only to group/filter attachments, so a stable synthetic id is safe. */
const GENERIC_ATTACHMENTS_FIELD_ID = '__row_detail_attachments__';

export const RowDetailPanel: React.FC<RowDetailPanelProps> = ({
  open,
  onClose,
  node,
  columns,
  edges,
  allNodes,
  locked = false,
  mode = 'full',
  onExpand,
  onFieldChange,
  onConvert,
  onAddSubItem,
  onNodeClick,
  onAddRelation,
  onLinkArtifact,
  ideaId,
  fields,
  platformTableId,
  initialTab,
}) => {
  const { t, i18n } = useTranslation();

  const isPlatform = fields?.some((f) => 'fieldType' in f) ?? false;

  const resolvedPlatformTableId = useMemo(() => {
    if (!isPlatform) return null;
    return platformTableId ?? fields?.[0]?.tableId ?? null;
  }, [isPlatform, platformTableId, fields]);

  /** Prefer a real `attachment`-type field if the table declares one; otherwise
   * fall back to a stable synthetic grouping key (see GENERIC_ATTACHMENTS_FIELD_ID). */
  const resolvedAttachmentFieldId = useMemo(() => {
    if (!isPlatform) return null;
    const attachmentField = fields?.find((f) => 'fieldType' in f && f.fieldType === 'attachment');
    return attachmentField?.id ?? GENERIC_ATTACHMENTS_FIELD_ID;
  }, [isPlatform, fields]);

  const currentUser = useAppStore((s) => s.currentUser);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentUserId = String(currentUser?.id ?? '');
  const authorDisplayName = useMemo(
    () =>
      [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ||
      currentUser?.email ||
      'You',
    [currentUser?.email, currentUser?.firstName, currentUser?.lastName]
  );

  const [activeTab, setActiveTab] = useState<TabId>(
    initialTab === 'comments' ? 'comments' : 'properties'
  );
  const [platformSheetTab, setPlatformSheetTab] = useState<PlatformSheetTabId>(
    initialTab === 'comments' ? 'comments' : 'fields'
  );

  // The panel stays mounted between opens (only `open` toggles), so the useState
  // initializers above only apply on first mount. Re-apply `initialTab` on every
  // fresh open so callers like "Add note" (→ Comments tab) land where they promise,
  // even on the 2nd+ open. Does not fight a manual tab click made while the panel
  // was already open (e.g. clicking through to a linked record via onNodeClick).
  useEffect(() => {
    if (!open || !initialTab) return;
    if (initialTab === 'comments') {
      setActiveTab('comments');
      setPlatformSheetTab('comments');
    } else {
      setActiveTab('properties');
      setPlatformSheetTab('fields');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab, node?.id]);
  const [newComment, setNewComment] = useState('');
  const [isWatching, setIsWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPool, setMentionPool] = useState<Array<{ id: string; name: string }>>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [subItemsExpanded, setSubItemsExpanded] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [bodyEditMode, setBodyEditMode] = useState<'edit' | 'preview'>('edit');
  const [relationDropdownOpen, setRelationDropdownOpen] = useState(false);
  const [relationSearch, setRelationSearch] = useState('');
  const [artifactDropdownOpen, setArtifactDropdownOpen] = useState(false);
  const [artifactSearch, setArtifactSearch] = useState('');
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const relationDropdownRef = useRef<HTMLDivElement>(null);
  const artifactDropdownRef = useRef<HTMLDivElement>(null);
  const commentComposerRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPlatformSheetTab('fields');
  }, [node?.id]);

  useEffect(() => {
    if (!open || !node?.id || !isPlatform) return;
    TablePlatformApi.getRecordWatchers(node.id)
      .then((watchers: any[]) => {
        setIsWatching(
          (watchers || []).some(
            (w: any) =>
              String(w.user_id ?? w.userId ?? '') === currentUserId && currentUserId !== ''
          )
        );
      })
      .catch(() => {});
  }, [open, node?.id, isPlatform, currentUserId]);

  useEffect(() => {
    if (!open || !node?.id || !isPlatform) return;
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError(null);
    TablePlatformApi.listRecordComments(node.id, { limit: 100 })
      .then((result: any) => {
        if (cancelled) return;
        const rows: any[] = result?.comments ?? result ?? [];
        const mapped: NodeComment[] = rows.map((r) => ({
          id: String(r.id),
          text: String(r.content ?? r.text ?? ''),
          author: String(r.author_name ?? r.authorName ?? r.author_id ?? r.authorId ?? 'User'),
          authorId: String(r.author_id ?? r.authorId ?? ''),
          createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
          editedAt:
            r.updated_at && r.updated_at !== r.created_at
              ? String(r.updated_at)
              : r.updatedAt && r.updatedAt !== r.createdAt
                ? String(r.updatedAt)
                : undefined,
          mentions: Array.isArray(r.mentions) ? r.mentions : undefined,
        }));
        onFieldChange(node.id, 'comments', mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setCommentsError(t('ideas.table.failedToLoadComments', 'Failed to load comments'));
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id, isPlatform]);

  useEffect(() => {
    if (!open || !node?.id || !isPlatform) return;
    let cancelled = false;
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    TablePlatformApi.getAttachments(node.id)
      .then((rows: any[]) => {
        if (cancelled) return;
        const mapped: NodeAttachment[] = (rows || []).map((r) => {
          const mimeType = String(r.mime_type ?? r.mimeType ?? '');
          return {
            id: String(r.id),
            type: mimeType.startsWith('image/') ? 'image' : 'file',
            name: String(r.file_name ?? r.fileName ?? 'file'),
            url: r.download_url ?? r.downloadUrl ?? undefined,
            mimeType,
            size: Number(r.size_bytes ?? r.sizeBytes ?? 0),
            createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
          };
        });
        onFieldChange(node.id, 'attachments', mapped);
      })
      .catch(() => {
        if (cancelled) return;
        setAttachmentsError(t('ideas.table.failedToLoadAttachments', 'Failed to load attachments'));
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id, isPlatform]);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    let cancelled = false;
    OrganizationApi.getOrganizationMembers(currentOrganization.id)
      .then((rows) => {
        if (cancelled) return;
        setMentionPool(
          rows.map((r) => ({
            id: r.userId,
            name: (r.name && r.name.trim()) || r.email || r.userId,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setMentionPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentOrganization?.id]);

  useEffect(() => {
    const closeOnClickOutside = (e: MouseEvent) => {
      if (
        relationDropdownOpen &&
        relationDropdownRef.current &&
        !relationDropdownRef.current.contains(e.target as Node)
      ) {
        setRelationDropdownOpen(false);
      }
      if (
        artifactDropdownOpen &&
        artifactDropdownRef.current &&
        !artifactDropdownRef.current.contains(e.target as Node)
      ) {
        setArtifactDropdownOpen(false);
      }
      if (
        mentionQuery !== null &&
        commentComposerRef.current &&
        !commentComposerRef.current.contains(e.target as Node)
      ) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', closeOnClickOutside);
    return () => document.removeEventListener('mousedown', closeOnClickOutside);
  }, [relationDropdownOpen, artifactDropdownOpen, mentionQuery]);

  const connectedEdges = useMemo(() => {
    if (!node) return [];
    return edges.filter((e) => e.source === node.id || e.target === node.id);
  }, [edges, node]);

  const childNodes = useMemo(() => {
    if (!node) return [];
    const childIds: string[] = node.data?.children || [];
    return childIds.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean) as TableNode[];
  }, [allNodes, node]);

  const relatedNodes = useMemo(() => {
    if (!node) return [];
    const relatedIds = new Set<string>();
    connectedEdges.forEach((e) => {
      if (e.source === node.id) relatedIds.add(e.target);
      else relatedIds.add(e.source);
    });
    return Array.from(relatedIds)
      .map((id) => allNodes.find((n) => n.id === id))
      .filter(Boolean) as TableNode[];
  }, [allNodes, connectedEdges, node]);

  const relationCandidates = useMemo(() => {
    if (!node) return [];
    const relatedIds = new Set(relatedNodes.map((n) => n.id));
    const q = relationSearch.trim().toLowerCase();
    return allNodes.filter(
      (n) =>
        n.id !== node.id &&
        !relatedIds.has(n.id) &&
        (!q || (n.data?.label || n.id).toLowerCase().includes(q))
    );
  }, [allNodes, node, relatedNodes, relationSearch]);

  const comments: NodeComment[] = useMemo(() => node?.data?.comments || [], [node]);
  const attachments: NodeAttachment[] = useMemo(() => node?.data?.attachments || [], [node]);
  const activities: NodeActivity[] = useMemo(() => node?.data?.activity || [], [node]);

  const linkedColumnKeys = useMemo(() => {
    if (isPlatform && fields?.length) {
      return fields
        .filter((f) => 'fieldType' in f && f.fieldType === 'linkedRecord')
        .map((f) => f.id)
        .filter(Boolean);
    }
    return columns.filter((c) => c.type === 'relation').map((c) => c.key);
  }, [isPlatform, fields, columns]);

  const relatedRecordChips = useMemo(() => {
    if (!node) return [] as { id: string; label: string }[];
    const chips: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const key of linkedColumnKeys) {
      for (const id of extractLinkedIds(node.data?.[key])) {
        if (seen.has(id)) continue;
        seen.add(id);
        chips.push({
          id,
          label: allNodes.find((x) => x.id === id)?.data?.label || id,
        });
      }
    }
    return chips;
  }, [node, linkedColumnKeys, allNodes]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionPool
      .filter(
        (u) => !q || u.name.toLowerCase().includes(q) || String(u.id).toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [mentionQuery, mentionPool]);

  const auditActivities = useMemo(
    () =>
      activities.filter((a) => ['edited', 'status_change', 'created'].includes(String(a.action))),
    [activities]
  );

  const accentColor = node?.data?.color || ROW_ACCENT_COLORS[0];

  const handleAddComment = useCallback(async () => {
    if (!node || !newComment.trim() || locked) return;
    const text = newComment.trim();
    const mentions = text.match(/@(\S+)/g)?.map((m) => m.slice(1)) || [];
    const tableId = resolvedPlatformTableId;

    if (isPlatform && tableId) {
      try {
        const created = await TablePlatformApi.addRecordComment(
          node.id,
          tableId,
          text,
          authorDisplayName,
          undefined,
          mentions.length ? mentions : undefined
        );
        const comment: NodeComment = {
          id: String(created?.id ?? `cmt-${Date.now()}`),
          text,
          author: authorDisplayName,
          authorId: String(created?.author_id ?? currentUserId ?? ''),
          createdAt: String(created?.created_at ?? new Date().toISOString()),
          mentions: mentions.length ? mentions : undefined,
        };
        const prev = node.data?.comments || [];
        onFieldChange(node.id, 'comments', [...prev, comment]);
        const activity: NodeActivity = {
          id: `act-${Date.now()}`,
          action: 'comment',
          author: authorDisplayName,
          newValue: text,
          createdAt: new Date().toISOString(),
        };
        const prevAct = node.data?.activity || [];
        onFieldChange(node.id, 'activity', [...prevAct, activity]);
      } catch {
        toast.error(t('ideas.table.failedToAddComment', 'Failed to add comment'));
        return;
      }
    } else {
      const comment: NodeComment = {
        id: `cmt-${Date.now()}`,
        text,
        author: authorDisplayName,
        createdAt: new Date().toISOString(),
        mentions: mentions.length ? mentions : undefined,
      };
      const prev = node.data?.comments || [];
      onFieldChange(node.id, 'comments', [...prev, comment]);
      const activity: NodeActivity = {
        id: `act-${Date.now()}`,
        action: 'comment',
        author: authorDisplayName,
        newValue: text,
        createdAt: new Date().toISOString(),
      };
      const prevAct = node.data?.activity || [];
      onFieldChange(node.id, 'activity', [...prevAct, activity]);
    }
    setNewComment('');
    setMentionQuery(null);
  }, [
    authorDisplayName,
    currentUserId,
    isPlatform,
    locked,
    newComment,
    node,
    onFieldChange,
    resolvedPlatformTableId,
  ]);

  const handleCommentInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);
    const caret = e.target.selectionStart ?? val.length;
    const beforeCaret = val.slice(0, caret);
    const lastAtIdx = beforeCaret.lastIndexOf('@');
    if (lastAtIdx < 0) {
      setMentionQuery(null);
      return;
    }
    const afterAt = beforeCaret.slice(lastAtIdx + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(afterAt);
  }, []);

  const handleStartEditComment = useCallback((comment: NodeComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  }, []);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setEditingCommentText('');
  }, []);

  const handleSaveEditComment = useCallback(async () => {
    if (!node || !editingCommentId || !editingCommentText.trim() || locked) return;
    const commentId = editingCommentId;
    const text = editingCommentText.trim();
    try {
      const updated = await TablePlatformApi.updateRecordComment(commentId, text);
      const prev: NodeComment[] = node.data?.comments || [];
      onFieldChange(
        node.id,
        'comments',
        prev.map((c) =>
          c.id === commentId
            ? { ...c, text, editedAt: String(updated?.updated_at ?? new Date().toISOString()) }
            : c
        )
      );
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch {
      toast.error(t('ideas.table.failedToUpdateComment', 'Failed to update comment'));
    }
  }, [editingCommentId, editingCommentText, locked, node, onFieldChange]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!node) return;
      try {
        await TablePlatformApi.deleteRecordComment(commentId);
        const prev: NodeComment[] = node.data?.comments || [];
        onFieldChange(
          node.id,
          'comments',
          prev.filter((c) => c.id !== commentId)
        );
      } catch {
        toast.error(t('ideas.table.failedToDeleteComment', 'Failed to delete comment'));
      }
    },
    [node, onFieldChange]
  );

  const toggleWatch = useCallback(async () => {
    if (!node?.id || watchLoading || !resolvedPlatformTableId) return;
    setWatchLoading(true);
    try {
      const { watching } = await TablePlatformApi.toggleRecordWatch(
        node.id,
        resolvedPlatformTableId
      );
      setIsWatching(watching);
    } catch {
      toast.error(t('ideas.table.failedToUpdateWatchStatus', 'Failed to update watch status'));
    } finally {
      setWatchLoading(false);
    }
  }, [node?.id, resolvedPlatformTableId, watchLoading]);

  const handleAddAttachmentLink = useCallback(() => {
    if (!node || locked) return;
    const url = prompt(t('ideas.table.pasteUrl', 'Paste URL:'));
    if (!url?.trim()) return;
    const att: NodeAttachment = {
      id: `att-${Date.now()}`,
      type: 'link',
      name: url.trim(),
      url: url.trim(),
      createdAt: new Date().toISOString(),
    };
    const prev = node.data?.attachments || [];
    onFieldChange(node.id, 'attachments', [...prev, att]);
  }, [locked, node, onFieldChange]);

  const handleRemoveAttachment = useCallback(
    (attId: string) => {
      if (!node || locked) return;
      const prev: NodeAttachment[] = node.data?.attachments || [];
      onFieldChange(
        node.id,
        'attachments',
        prev.filter((a) => a.id !== attId)
      );
    },
    [locked, node, onFieldChange]
  );

  /** Platform mode: real file upload via POST /records/:id/fields/:fieldId/attachments. */
  const handleUploadPlatformAttachment = useCallback(
    async (file: File) => {
      if (!node?.id || locked || !resolvedAttachmentFieldId) return;
      setAttachmentUploading(true);
      try {
        const created = await TablePlatformApi.uploadAttachment(
          node.id,
          resolvedAttachmentFieldId,
          file
        );
        const att: NodeAttachment = {
          id: String(created?.id ?? `att-${Date.now()}`),
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: String(created?.file_name ?? created?.fileName ?? file.name),
          url: created?.download_url ?? created?.downloadUrl ?? undefined,
          mimeType: String(created?.mime_type ?? created?.mimeType ?? file.type),
          size: Number(created?.size_bytes ?? created?.sizeBytes ?? file.size),
          createdAt: String(created?.created_at ?? created?.createdAt ?? new Date().toISOString()),
        };
        const prev: NodeAttachment[] = node.data?.attachments || [];
        onFieldChange(node.id, 'attachments', [att, ...prev]);
      } catch (e: any) {
        toast.error(e?.message || t('ideas.table.failedToUploadFile', 'Failed to upload file'));
      } finally {
        setAttachmentUploading(false);
      }
    },
    [locked, node, onFieldChange, resolvedAttachmentFieldId]
  );

  const handlePlatformAttachmentFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void handleUploadPlatformAttachment(file);
    },
    [handleUploadPlatformAttachment]
  );

  /** Platform mode: real delete via DELETE /attachments/:id, then drop from local cache. */
  const handleRemovePlatformAttachment = useCallback(
    async (attId: string) => {
      if (!node?.id || locked) return;
      try {
        await TablePlatformApi.deleteAttachment(attId);
        const prev: NodeAttachment[] = node.data?.attachments || [];
        onFieldChange(
          node.id,
          'attachments',
          prev.filter((a) => a.id !== attId)
        );
      } catch {
        toast.error(t('ideas.table.failedToDeleteAttachment', 'Failed to delete attachment'));
      }
    },
    [locked, node, onFieldChange]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!node || locked) return;
      onFieldChange(node.id, 'color', color);
      setShowColorPicker(false);
    },
    [locked, node, onFieldChange]
  );

  const handleGenerateAI = useCallback(async () => {
    if (!node) return;
    setAiLoading(true);
    setActiveTab('ai');
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId || '', {
        context: {
          title: node.data?.label || '',
          seedText: node.data?.description || node.data?.bodyMarkdown || '',
          currentNodes: [{ id: node.id, type: node.type, label: node.data?.label }],
          currentEdges: connectedEdges.map((e) => ({ source: e.source, target: e.target })),
          activeTool: 'table',
        },
        mode: 'on_demand',
        prompt: `Provide 4-5 specific insights and next steps for this idea: "${node.data?.label}"`,
        language: i18n.language,
      });
      setAiInsights((result?.suggestions || []).map((s: any) => s.text || s.detail || ''));
    } catch {
      setAiInsights([
        t('ideas.table.failedToGenerateSuggestions', 'Failed to generate suggestions'),
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [connectedEdges, i18n.language, ideaId, node]);

  const getNodeLabel = (id: string) => allNodes.find((x) => x.id === id)?.data?.label || id;

  const insertMarkdown = useCallback(
    (before: string, after: string = '', placeholder?: string) => {
      const textarea = bodyTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = String(node?.data?.bodyMarkdown || node?.data?.description || '');
      const selected = text.slice(start, end) || placeholder || '';
      const newText = text.slice(0, start) + before + selected + after + text.slice(end);
      onFieldChange(node!.id, 'bodyMarkdown', newText);
      onFieldChange(node!.id, 'description', newText);
      requestAnimationFrame(() => {
        const pos = start + before.length + selected.length;
        textarea.setSelectionRange(pos, pos);
        textarea.focus();
      });
    },
    [node, onFieldChange]
  );

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  if (!open || !node) return null;

  // Nazwa rekordu do etykiet dostępności (aria-label) komórek edycji — a11y.
  const rowA11yLabel =
    String(node.data?.label || '').trim() || t('ideas.table.a11y.untitledRecord', 'Untitled');

  const TABS: {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    count?: number;
  }[] = [
    { id: 'properties', label: t('ideas.table.tabProperties', 'Properties'), icon: FileText },
    {
      id: 'comments',
      label: t('ideas.table.tabComments', 'Comments'),
      icon: MessageSquare,
      count: comments.length,
    },
    {
      id: 'attachments',
      label: t('ideas.table.tabAttachments', 'Attachments'),
      icon: Paperclip,
      count:
        attachments.length +
        (Array.isArray(node?.data?.artifactLinks) ? node.data.artifactLinks.length : 0),
    },
    {
      id: 'activity',
      label: t('ideas.table.tabActivity', 'Activity'),
      icon: Clock,
      count: activities.length,
    },
    { id: 'ai', label: t('ideas.table.tabAiInsights', 'AI Insights'), icon: Sparkles },
    { id: 'drawing', label: t('ideas.table.tabDrawing', 'Drawing'), icon: PenTool },
  ];

  return (
    <div
      className="fixed inset-0 z-context-menu flex items-stretch justify-end bg-[color-mix(in_srgb,var(--c-text)_20%,transparent)] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[90vw] h-full bg-c-surface shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Color accent bar ── */}
        <div
          className="h-1.5 flex-shrink-0"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
        />

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-c-border-subtle flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {/* Color picker dot */}
                <div className="relative">
                  <button
                    onClick={() => !locked && setShowColorPicker(!showColorPicker)}
                    className="w-4 h-4 rounded-full border-2 border-c-border-subtle shadow-sm flex-shrink-0 transition-transform hover:scale-110"
                    style={{ backgroundColor: accentColor }}
                  />
                  {showColorPicker && (
                    <div className="absolute left-0 top-6 z-overlay p-2 rounded-xl bg-c-surface shadow-xl border border-slate-200/60 dark:border-white/[0.03] flex flex-wrap gap-1 w-[140px]">
                      {ROW_ACCENT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => handleColorChange(c)}
                          className="w-5 h-5 rounded-full border-2 border-c-border-subtle hover:scale-110 transition-transform"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  {node.type || 'idea'}
                </span>
                {node.data?.status && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-c-text-muted bg-c-surface-raised px-1.5 py-0.5 rounded">
                    {String(node.data.status)}
                  </span>
                )}
              </div>
              {/* Editable title */}
              <input
                value={String(node.data?.label || '')}
                onChange={(e) => onFieldChange(node.id, 'label', e.target.value)}
                disabled={locked}
                className="w-full text-base font-bold text-c-text bg-transparent border-0 outline-none focus:ring-0 p-0"
                placeholder={t('ideas.table.title', 'Title...')}
              />
              {/* Icon / emoji */}
              {node.data?.icon && <span className="text-lg mr-1">{node.data.icon}</span>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isPlatform && node?.id && resolvedPlatformTableId && (
                <button
                  type="button"
                  onClick={() => void toggleWatch()}
                  disabled={watchLoading}
                  className={`rounded-lg p-1.5 transition ${
                    isWatching
                      ? 'text-c-text bg-c-surface-raised'
                      : 'text-c-text-muted hover:text-c-text-secondary'
                  }`}
                  title={
                    isWatching
                      ? t('ideas.table.stopWatching', 'Stop watching')
                      : t('ideas.table.watchForChanges', 'Watch for changes')
                  }
                >
                  {isWatching ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
              {mode === 'preview' && onExpand && (
                <button
                  onClick={onExpand}
                  className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
                  title={t('ideas.table.expand', 'Expand')}
                >
                  <Maximize2 size={14} className="text-c-text-muted" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
              >
                <X size={18} className="text-c-text-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Rich body editor (full mode only) ── */}
        {mode === 'full' && (
          <div className="px-5 py-3 border-b border-c-border-subtle flex-shrink-0">
            <div className="flex items-center gap-1 mb-2">
              {[
                { Icon: Bold, before: '**', after: '**', titleKey: 'Bold' },
                { Icon: Italic, before: '_', after: '_', titleKey: 'Italic' },
                { Icon: Heading1, before: '## ', after: '', titleKey: 'Heading' },
                { Icon: List, before: '\n- ', after: '', titleKey: 'List' },
                {
                  Icon: Link2,
                  before: '[',
                  after: '](url)',
                  placeholder: 'text',
                  titleKey: 'Link',
                },
                { Icon: Code, before: '`', after: '`', placeholder: 'code', titleKey: 'Code' },
              ].map(({ Icon, before, after, placeholder, titleKey }) => (
                <button
                  key={titleKey}
                  type="button"
                  onClick={() => insertMarkdown(before, after, placeholder)}
                  disabled={locked}
                  className="p-1.5 rounded-md hover:bg-c-surface-raised text-c-text-muted hover:text-c-text-secondary transition-colors disabled:opacity-40"
                  title={titleKey}
                >
                  <Icon size={12} />
                </button>
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setBodyEditMode(bodyEditMode === 'edit' ? 'preview' : 'edit')}
                className="text-[10px] font-semibold px-2 py-1 rounded-md bg-c-surface-raised text-c-text-muted hover:bg-c-surface-raised transition-colors"
              >
                {bodyEditMode === 'edit'
                  ? t('ideas.table.preview', 'Preview')
                  : t('ideas.table.edit', 'Edit')}
              </button>
            </div>
            {bodyEditMode === 'edit' ? (
              <textarea
                ref={bodyTextareaRef}
                value={String(node.data?.bodyMarkdown || node.data?.description || '')}
                onChange={(e) => {
                  onFieldChange(node.id, 'bodyMarkdown', e.target.value);
                  onFieldChange(node.id, 'description', e.target.value);
                }}
                disabled={locked}
                rows={6}
                placeholder={t('ideas.table.notesContextDetails', 'Notes, context, details...')}
                className="w-full bg-transparent border-0 outline-none text-xs text-c-text-secondary placeholder-c-text-muted resize-none leading-relaxed focus:ring-0"
              />
            ) : (
              <div className="min-h-[120px] max-h-[180px] overflow-auto rounded-lg bg-c-surface-raised px-3 py-2">
                {React.createElement(ReactMarkdown as any, {
                  remarkPlugins: [remarkGfm],
                  className:
                    'prose prose-sm dark:prose-invert max-w-none text-xs text-c-text-secondary',
                  children:
                    node.data?.bodyMarkdown ||
                    node.data?.description ||
                    t('ideas.table.noContent', 'No content'),
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Notion-style property strip (hidden in platform full mode — fields live in the Fields tab) ── */}
        {!(isPlatform && mode === 'full') && (
          <div className="px-5 py-2.5 border-b border-c-border-subtle flex-shrink-0">
            <div className="space-y-1.5">
              {columns
                .filter((col) => col.key !== 'label' && col.key !== 'type' && col.visible)
                .slice(0, 8)
                .map((col) => {
                  return (
                    <div key={col.key} className="flex items-center gap-2 min-h-[28px]">
                      <span className="text-[10px] font-medium text-c-text-muted w-24 flex-shrink-0 truncate">
                        {col.header}
                      </span>
                      <div className="flex-1 min-w-0 rounded-md hover:bg-c-surface-raised px-1.5 py-0.5 -mx-1.5 transition-colors">
                        <CellRenderer
                          column={col}
                          value={node.data?.[col.key]}
                          rowData={node.data || {}}
                          onChange={(val) => onFieldChange(node.id, col.key, val)}
                          locked={locked}
                          allNodes={allNodes.map((n) => ({ id: n.id, label: n.data?.label }))}
                          rowLabel={rowA11yLabel}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── Sub-items (full mode only) ── */}
        {mode === 'full' && (childNodes.length > 0 || !locked) && (
          <div className="px-5 py-2 border-b border-c-border-subtle flex-shrink-0">
            <button
              onClick={() => setSubItemsExpanded(!subItemsExpanded)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-1"
            >
              {subItemsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {t('ideas.table.subItems', 'Sub-items')} ({childNodes.length})
            </button>
            {subItemsExpanded && (
              <div className="space-y-1 ml-3">
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNodeClick?.(child.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-c-surface-raised transition-colors"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: child.data?.color || accentColor }}
                    />
                    <span className="text-[11px] text-c-text-secondary truncate flex-1">
                      {child.data?.label || child.id}
                    </span>
                    {child.data?.status && (
                      <span className="text-[9px] text-c-text-muted">
                        {String(child.data.status)}
                      </span>
                    )}
                  </button>
                ))}
                {!locked && (
                  <button
                    onClick={() => onAddSubItem?.(node.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors"
                  >
                    <Plus size={10} />
                    {t('ideas.table.addSubItem', 'Add sub-item')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Provenance banner (Block B / B-S5): only when feature flag is ON ── */}
        {mode === 'full' &&
          isPlatform &&
          node?.id &&
          (() => {
            const rawConfidence = node.data?.[PROVENANCE_DATA_KEYS.confidenceScore];
            const confidence =
              typeof rawConfidence === 'number'
                ? rawConfidence
                : rawConfidence == null
                  ? null
                  : Number(rawConfidence);
            const rawStatus = node.data?.[PROVENANCE_DATA_KEYS.validationStatus];
            const status =
              rawStatus === 'verified' || rawStatus === 'flagged' || rawStatus === 'unverified'
                ? (rawStatus as ValidationStatus)
                : 'unverified';
            return (
              <div className="px-5 py-2 border-b border-c-border-subtle flex-shrink-0">
                <ProvenanceCell
                  recordId={node.id}
                  confidenceScore={Number.isFinite(confidence) ? confidence : null}
                  validationStatus={status}
                  variant="full"
                  isSuperAdmin={Boolean((currentUser as { isSuperAdmin?: boolean })?.isSuperAdmin)}
                  readOnly={locked}
                />
              </div>
            );
          })()}

        {/* ── Tabs (full mode): platform = HIG pill strip ── */}
        {mode === 'full' && isPlatform && (
          <div className="flex items-center gap-1.5 px-5 py-2 border-b border-c-border-subtle flex-shrink-0 overflow-x-auto">
            {[
              {
                id: 'fields' as const,
                label: t('ideas.table.tabFields', 'Fields'),
                Icon: FileText,
              },
              {
                id: 'activity' as const,
                label: t('ideas.table.tabActivity', 'Activity'),
                Icon: Clock,
                count: activities.length,
              },
              {
                id: 'audit' as const,
                label: t('ideas.table.tabAudit', 'Audit'),
                Icon: ClipboardList,
                count: auditActivities.length,
              },
              {
                id: 'comments' as const,
                label: t('ideas.table.tabComments', 'Comments'),
                Icon: MessageSquare,
                count: comments.length,
              },
              {
                id: 'attachments' as const,
                label: t('ideas.table.tabAttachments', 'Attachments'),
                Icon: Paperclip,
                count: attachments.length,
              },
            ].map((tab) => {
              const Icon = tab.Icon;
              const isActive = platformSheetTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlatformSheetTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-c-text text-c-surface shadow-sm'
                      : 'text-c-text-muted hover:bg-c-surface-raised'
                  }`}
                >
                  <Icon size={12} className="opacity-90" />
                  {tab.label}
                  {'count' in tab && tab.count != null && tab.count > 0 && (
                    <span
                      className={`min-w-[1.1rem] px-1 py-0 text-[9px] font-bold rounded-full tabular-nums ${
                        isActive
                          ? 'bg-[color-mix(in_srgb,var(--c-surface)_25%,transparent)] text-c-surface'
                          : 'bg-c-surface-raised text-c-text-muted'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {mode === 'full' && !isPlatform && (
          <div className="flex items-center gap-0.5 px-5 py-1.5 border-b border-c-border-subtle flex-shrink-0 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-c-surface-raised text-c-text'
                      : 'text-c-text-muted hover:text-c-text-secondary'
                  }`}
                >
                  <Icon size={11} />
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="ml-0.5 text-[8px] bg-c-surface-raised text-c-text-muted px-1 py-0 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tab content (full mode only) ── */}
        {mode === 'full' && (
          <div className="flex-1 overflow-auto px-5 py-4">
            {/* Properties / platform Fields */}
            {((isPlatform && platformSheetTab === 'fields') ||
              (!isPlatform && activeTab === 'properties')) && (
              <div className="space-y-3">
                {columns.map((col) => (
                  <div key={col.key}>
                    <label className="block text-[10px] font-semibold text-c-text-muted mb-1">
                      {col.header}
                    </label>
                    <div className="rounded-xl border border-c-border-subtle px-2.5 py-2">
                      <CellRenderer
                        column={col}
                        value={node.data?.[col.key]}
                        rowData={node.data || {}}
                        onChange={(val) => onFieldChange(node.id, col.key, val)}
                        locked={locked}
                        allNodes={allNodes.map((n) => ({ id: n.id, label: n.data?.label }))}
                        rowLabel={rowA11yLabel}
                      />
                    </div>
                  </div>
                ))}

                {/* Connections */}
                <div className="pt-3 border-t border-c-border-subtle">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-2">
                    <GitBranch size={10} className="inline mr-1" />
                    {t('ideas.table.relatedItems', 'Related items')} ({relatedNodes.length})
                  </label>
                  <div className="space-y-1">
                    {relatedNodes.map((rn) => (
                      <button
                        key={rn.id}
                        onClick={() => onNodeClick?.(rn.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl bg-c-surface-raised hover:bg-c-surface-raised text-left transition-colors"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: rn.data?.color || 'var(--c-tag-2)' }}
                        />
                        <span className="text-[11px] font-medium text-c-text-secondary truncate flex-1">
                          {rn.data?.label || rn.id}
                        </span>
                        <ArrowRight size={10} className="text-c-text-muted" />
                      </button>
                    ))}
                  </div>
                  {!locked && (
                    <div ref={relationDropdownRef} className="relative mt-2">
                      <button
                        onClick={() => setRelationDropdownOpen(!relationDropdownOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                      >
                        <Plus size={12} />
                        {t('ideas.table.addRelation', 'Add relation')}
                      </button>
                      {relationDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 z-overlay w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl overflow-hidden">
                          <div className="p-2 border-b border-c-border-subtle">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-c-surface-raised">
                              <Search size={12} className="text-c-text-muted flex-shrink-0" />
                              <input
                                value={relationSearch}
                                onChange={(e) => setRelationSearch(e.target.value)}
                                placeholder={t('ideas.table.search', 'Search...')}
                                className="flex-1 bg-transparent text-xs text-c-text-secondary outline-none placeholder-c-text-muted"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-auto p-1">
                            {relationCandidates.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => {
                                  // P1-3 (Z3): zdarzenie `idea-workspace-add-edge` bylo nadawane
                                  // w prozne — NIKT go nie nasluchiwal w calym `src/`. Realnym
                                  // odbiorca jest prop `onAddRelation` ponizej: IdeaTableTool
                                  // dopisuje krawedz przez `setEdges`, a ta plynie w gore przez
                                  // `onGraphChange` do zapisu grafu. Przycisk zostaje (dziala),
                                  // usuniety jest wylacznie martwy dispatch.
                                  const prev =
                                    (node.data?._relations as {
                                      source: string;
                                      target: string;
                                    }[]) || [];
                                  onFieldChange(node.id, '_relations', [
                                    ...prev,
                                    { source: node.id, target: n.id },
                                  ]);
                                  onAddRelation?.(node.id, n.id);
                                  setRelationDropdownOpen(false);
                                  setRelationSearch('');
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-c-surface-raised text-[11px] transition-colors"
                              >
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: n.data?.color || 'var(--c-tag-2)' }}
                                />
                                <span className="text-c-text-secondary truncate flex-1">
                                  {n.data?.label || n.id}
                                </span>
                              </button>
                            ))}
                            {relationCandidates.length === 0 && (
                              <p className="px-3 py-4 text-[11px] text-c-text-muted text-center">
                                {t('ideas.table.noMatchingItems', 'No matching items')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            {((isPlatform && platformSheetTab === 'comments') ||
              (!isPlatform && activeTab === 'comments')) && (
              <div className="space-y-3" data-testid="comments-section">
                {commentsLoading && comments.length === 0 && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.loadingComments', 'Loading comments...')}
                  </p>
                )}
                {commentsError && (
                  <p
                    className="text-[11px] text-c-danger text-center py-2"
                    data-testid="comments-error"
                  >
                    {commentsError}
                  </p>
                )}
                {!commentsLoading && !commentsError && comments.length === 0 && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.noCommentsYet', 'No comments yet')}
                  </p>
                )}
                {comments.map((cmt) => {
                  const isOwnComment = !!cmt.authorId && cmt.authorId === currentUserId;
                  const isEditingThis = editingCommentId === cmt.id;
                  return (
                    <div
                      key={cmt.id}
                      className="rounded-xl bg-c-surface-raised p-3 group"
                      data-testid="comment-item"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-c-text-secondary flex items-center justify-center text-[8px] font-bold text-c-surface flex-shrink-0">
                          {cmt.author.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold text-c-text-secondary">
                          {cmt.author}
                        </span>
                        <span className="text-[9px] text-c-text-muted ml-auto">
                          {formatTime(cmt.createdAt)}
                          {cmt.editedAt ? ` · ${t('ideas.table.edited', 'edited')}` : ''}
                        </span>
                        {isOwnComment && !locked && !isEditingThis && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleStartEditComment(cmt)}
                              className="p-1 rounded text-c-text-muted hover:text-c-text-secondary"
                              title={t('ideas.table.edit2', 'Edit')}
                              data-testid="comment-edit-btn"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteComment(cmt.id)}
                              className="p-1 rounded text-c-text-muted hover:text-c-danger"
                              title={t('ideas.table.delete', 'Delete')}
                              data-testid="comment-delete-btn"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditingThis ? (
                        <div className="pl-7 space-y-1.5">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEditComment();
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void handleSaveEditComment();
                              }
                            }}
                            rows={2}
                            autoFocus
                            className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-c-focus resize-y"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSaveEditComment()}
                              disabled={!editingCommentText.trim()}
                              className="text-[10px] font-semibold text-c-text disabled:opacity-40"
                            >
                              {t('ideas.table.save', 'Save')}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditComment}
                              className="text-[10px] font-semibold text-c-text-muted"
                            >
                              {t('ideas.table.cancel', 'Cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-c-text-muted leading-relaxed pl-7">
                          {cmt.text}
                        </p>
                      )}
                    </div>
                  );
                })}
                {!locked && (
                  <div ref={commentComposerRef} className="relative flex items-end gap-2 pt-2">
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg max-h-40 overflow-y-auto z-overlay">
                        {mentionSuggestions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-c-surface-raised flex items-center gap-2"
                            onClick={() => {
                              const ta = commentTextareaRef.current;
                              const text = newComment || '';
                              const caretPos = ta?.selectionStart ?? text.length;
                              const beforeCaret = text.slice(0, caretPos);
                              const lastAt = beforeCaret.lastIndexOf('@');
                              if (lastAt < 0) return;
                              const newText =
                                text.slice(0, lastAt) + `@${user.name} ` + text.slice(caretPos);
                              setNewComment(newText);
                              setMentionQuery(null);
                              requestAnimationFrame(() => {
                                if (ta) {
                                  const pos = lastAt + user.name.length + 2;
                                  ta.focus();
                                  ta.setSelectionRange(pos, pos);
                                }
                              });
                            }}
                          >
                            <div className="h-6 w-6 rounded-full bg-c-surface-raised flex items-center justify-center text-xs font-medium text-c-text-secondary">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-c-text-secondary">{user.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={commentTextareaRef}
                      value={newComment}
                      onChange={handleCommentInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape' && mentionQuery !== null) {
                          e.preventDefault();
                          setMentionQuery(null);
                          return;
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleAddComment();
                        }
                      }}
                      rows={2}
                      placeholder={t(
                        'ideas.table.addACommentToMention',
                        'Add a comment... (@ to mention)'
                      )}
                      className="flex-1 min-h-[40px] rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-c-focus resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={!newComment.trim()}
                      className="p-2 rounded-xl bg-c-surface-raised text-c-text hover:bg-c-surface-raised/80 disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachments (legacy workspace) */}
            {!isPlatform && activeTab === 'attachments' && (
              <div className="space-y-2">
                {/* Linked Artifacts (from artifact linking API) */}
                <div className="mb-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-2">
                    <Link2 size={10} className="inline mr-1" />
                    {t('ideas.table.linkedArtifacts', 'Linked artifacts')} (
                    {Array.isArray(node.data?.artifactLinks) ? node.data.artifactLinks.length : 0})
                  </label>
                  {Array.isArray(node.data?.artifactLinks) &&
                    node.data.artifactLinks.length > 0 && (
                      <div className="space-y-1">
                        {node.data.artifactLinks.map((link: any, idx: number) => {
                          const artType =
                            link.artifactRef?.type || link.artifactType || link.type || 'unknown';
                          const artId = link.artifactRef?.id || link.artifactId || link.id || '';
                          const artLabel = link.label || link.title || `${artType}:${artId}`;
                          return (
                            <button
                              key={`art-${idx}`}
                              onClick={() => {
                                if (artType && artId) {
                                  window.dispatchEvent(
                                    new CustomEvent('mywork-open-item', {
                                      detail: { type: artType, id: artId, name: artLabel },
                                    })
                                  );
                                }
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-info)_16%,transparent)] transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)] flex items-center justify-center flex-shrink-0">
                                <Paperclip size={14} className="text-c-info" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-medium text-c-info truncate block">
                                  {artLabel}
                                </span>
                                <span className="text-[9px] text-c-text-muted uppercase">
                                  {artType}
                                </span>
                              </div>
                              <ArrowRight size={10} className="text-c-info flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  {!locked && (
                    <div ref={artifactDropdownRef} className="relative mt-2">
                      <button
                        onClick={() => setArtifactDropdownOpen(!artifactDropdownOpen)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                      >
                        <Paperclip size={12} />
                        {t('ideas.table.attachArtifact', 'Attach artifact')}
                      </button>
                      {artifactDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1 z-overlay w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl overflow-hidden">
                          <div className="p-2 border-b border-c-border-subtle">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-c-surface-raised">
                              <Search size={12} className="text-c-text-muted flex-shrink-0" />
                              <input
                                value={artifactSearch}
                                onChange={(e) => setArtifactSearch(e.target.value)}
                                placeholder={t(
                                  'ideas.table.searchArtifacts',
                                  'Search artifacts...'
                                )}
                                className="flex-1 bg-transparent text-xs text-c-text-secondary outline-none placeholder-c-text-muted"
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-1">
                            {allNodes
                              .filter((n) => {
                                if (n.id === node.id) return false;
                                const existing = (node.data?.artifactLinks as string[]) || [];
                                if (existing.includes(n.id)) return false;
                                const q = artifactSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (n.data?.label || n.id).toLowerCase().includes(q);
                              })
                              .slice(0, 20)
                              .map((n) => (
                                <button
                                  key={n.id}
                                  onClick={() => {
                                    // P1-3 (Z3): zdarzenie `idea-workspace-link-artifact` nie
                                    // mialo zadnego odbiorcy w `src/`. Realny skutek daje
                                    // `onFieldChange(..., 'artifactLinks', ...)` powyzej (link
                                    // laduje w danych wiersza i renderuje sie na liscie
                                    // powiazanych artefaktow) plus prop `onLinkArtifact`
                                    // (telemetria w IdeaTableTool). Usuniety jest wylacznie
                                    // martwy dispatch — przycisk dziala i zostaje.
                                    const prev = (node.data?.artifactLinks as string[]) || [];
                                    onFieldChange(node.id, 'artifactLinks', [...prev, n.id]);
                                    onLinkArtifact?.(node.id);
                                    setArtifactDropdownOpen(false);
                                    setArtifactSearch('');
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-c-surface-raised text-[11px] text-c-text-secondary transition-colors"
                                >
                                  <StickyNote
                                    size={12}
                                    className="text-c-text-muted flex-shrink-0"
                                  />
                                  <span className="truncate">{n.data?.label || n.id}</span>
                                </button>
                              ))}
                            {allNodes.filter((n) => {
                              if (n.id === node.id) return false;
                              const q = artifactSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (n.data?.label || n.id).toLowerCase().includes(q);
                            }).length === 0 && (
                              <p className="text-center text-[10px] text-c-text-muted py-3">
                                {t('ideas.table.noResults', 'No results')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {attachments.length === 0 &&
                  !(
                    Array.isArray(node.data?.artifactLinks) && node.data.artifactLinks.length > 0
                  ) && (
                    <p className="text-[11px] text-c-text-muted text-center py-6">
                      {t('ideas.table.noAttachments', 'No attachments')}
                    </p>
                  )}
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised"
                  >
                    <div className="w-8 h-8 rounded-lg bg-c-surface-raised flex items-center justify-center flex-shrink-0">
                      {att.type === 'image' ? (
                        <Image size={14} className="text-c-text-muted" />
                      ) : att.type === 'link' ? (
                        <Link2 size={14} className="text-c-info" />
                      ) : (
                        <FileText size={14} className="text-c-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-medium text-c-info hover:underline truncate block"
                        >
                          {att.name}
                        </a>
                      ) : (
                        <span className="text-[11px] font-medium text-c-text-secondary truncate block">
                          {att.name}
                        </span>
                      )}
                      <span className="text-[9px] text-c-text-muted">
                        {formatTime(att.createdAt)}
                      </span>
                    </div>
                    {!locked && (
                      <button
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 rounded text-c-text-muted hover:text-danger-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleAddAttachmentLink}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors"
                    >
                      <Link2 size={12} />
                      {t('ideas.table.addLink', 'Add link')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachments (Platform mode — real upload/list/delete via table-platform API) */}
            {isPlatform && platformSheetTab === 'attachments' && (
              <div className="space-y-2">
                {attachmentsLoading && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.loading', 'Loading…')}
                  </p>
                )}
                {!attachmentsLoading && attachmentsError && (
                  <p className="text-[11px] text-c-danger text-center py-4">{attachmentsError}</p>
                )}
                {!attachmentsLoading && !attachmentsError && attachments.length === 0 && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.noAttachments', 'No attachments')}
                  </p>
                )}
                {!attachmentsLoading &&
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised"
                    >
                      <div className="w-8 h-8 rounded-lg bg-c-surface-raised flex items-center justify-center flex-shrink-0">
                        {att.type === 'image' ? (
                          <Image size={14} className="text-c-text-muted" />
                        ) : (
                          <FileText size={14} className="text-c-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {att.url ? (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-c-info hover:underline truncate block"
                          >
                            {att.name}
                          </a>
                        ) : (
                          <span className="text-[11px] font-medium text-c-text-secondary truncate block">
                            {att.name}
                          </span>
                        )}
                        <span className="text-[9px] text-c-text-muted">
                          {formatTime(att.createdAt)}
                          {att.size ? ` · ${(att.size / 1024).toFixed(0)} KB` : ''}
                        </span>
                      </div>
                      {!locked && (
                        <button
                          onClick={() => void handleRemovePlatformAttachment(att.id)}
                          className="p-1 rounded text-c-text-muted hover:text-danger-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                {!locked && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      ref={attachmentFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handlePlatformAttachmentFileChange}
                    />
                    <button
                      onClick={() => attachmentFileInputRef.current?.click()}
                      disabled={attachmentUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised hover:bg-c-surface-raised/80 transition-colors disabled:opacity-50"
                    >
                      {attachmentUploading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Paperclip size={12} />
                      )}
                      {attachmentUploading
                        ? t('ideas.table.uploading', 'Uploading…')
                        : t('ideas.table.uploadFile', 'Upload file')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Activity */}
            {((isPlatform && platformSheetTab === 'activity') ||
              (!isPlatform && activeTab === 'activity')) && (
              <div className="space-y-2">
                {activities.length === 0 && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.noActivity', 'No activity')}
                  </p>
                )}
                {[...activities].reverse().map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-c-border-strong mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-c-text-secondary">
                        <strong>{act.author}</strong>{' '}
                        {act.action === 'comment'
                          ? t('ideas.table.commented', 'commented')
                          : act.action === 'edited'
                            ? t('ideas.table.editedField', 'edited {{field}}', { field: act.field })
                            : act.action === 'attachment'
                              ? t('ideas.table.addedAttachment', 'added attachment')
                              : act.action === 'status_change'
                                ? t(
                                    'ideas.table.changedStatus',
                                    'changed status: {{oldValue}} → {{newValue}}',
                                    {
                                      oldValue: act.oldValue,
                                      newValue: act.newValue,
                                    }
                                  )
                                : act.action === 'ai_suggestion'
                                  ? t('ideas.table.aiSuggested', 'AI suggested')
                                  : t('ideas.table.created', 'created')}
                      </span>
                      {act.newValue && act.action === 'comment' && (
                        <p className="text-[10px] text-c-text-muted mt-0.5 truncate">
                          &ldquo;{act.newValue}&rdquo;
                        </p>
                      )}
                      <span className="text-[9px] text-c-text-muted block mt-0.5">
                        {formatTime(act.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Audit (platform sheet) */}
            {isPlatform && platformSheetTab === 'audit' && (
              <div className="space-y-2">
                {auditActivities.length === 0 && (
                  <p className="text-[11px] text-c-text-muted text-center py-6">
                    {t('ideas.table.noAuditEntries', 'No audit entries')}
                  </p>
                )}
                {[...auditActivities].reverse().map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-c-warning mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-c-text-secondary">
                        <strong>{act.author}</strong>{' '}
                        {act.action === 'edited'
                          ? t('ideas.table.editedField', 'edited {{field}}', {
                              field: act.field ?? '',
                            })
                          : act.action === 'status_change'
                            ? t(
                                'ideas.table.changedStatus',
                                'changed status: {{oldValue}} → {{newValue}}',
                                {
                                  oldValue: act.oldValue,
                                  newValue: act.newValue,
                                }
                              )
                            : act.action === 'created'
                              ? t('ideas.table.createdRecord', 'created record')
                              : String(act.action)}
                      </span>
                      <span className="text-[9px] text-c-text-muted block mt-0.5">
                        {formatTime(act.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* AI Insights tab */}
            {!isPlatform && activeTab === 'ai' && (
              <div className="space-y-3">
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-c-text text-c-surface text-xs font-bold hover:bg-c-text/90 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {aiLoading
                    ? t('ideas.table.generating', 'Generating...')
                    : t('ideas.table.generateAiInsights', 'Generate AI insights')}
                </button>
                {aiInsights.length > 0 && (
                  <div className="space-y-2">
                    {aiInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-c-border bg-c-surface-raised p-3"
                      >
                        <div className="flex items-start gap-2">
                          <Sparkles
                            size={12}
                            className="text-c-text-secondary mt-0.5 flex-shrink-0"
                          />
                          <p className="text-[11px] text-c-text-secondary leading-relaxed">
                            {insight}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {aiInsights.length === 0 && !aiLoading && (
                  <p className="text-[11px] text-c-text-muted text-center py-4">
                    {t(
                      'ideas.table.clickToGenerateInsightsBasedOnCompanyContext',
                      'Click to generate insights based on company context'
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Drawing tab */}
            {!isPlatform && activeTab === 'drawing' && (
              <div>
                <MiniCanvas
                  value={node.data?.drawing || []}
                  onChange={(elements) => onFieldChange(node.id, 'drawing', elements)}
                  locked={locked}
                  width={460}
                  height={300}
                />
                <p className="text-[9px] text-c-text-muted mt-2 text-center">
                  {t(
                    'ideas.table.drawAddShapesAndArrowsToThisIdea',
                    'Draw, add shapes and arrows to this idea'
                  )}
                </p>
              </div>
            )}

            {/* Related Records — linkedRecord (platform) or relation columns */}
            {linkedColumnKeys.length > 0 && (
              <div className="mt-6 pt-4 border-t border-c-border-subtle">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-2">
                  <Link2 size={10} />
                  {t('ideas.table.relatedRecords', 'Related Records')}
                </label>
                {relatedRecordChips.length === 0 ? (
                  <p className="text-[11px] text-c-text-muted py-1">
                    {t('ideas.table.noLinkedRecords', 'No linked records')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {relatedRecordChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => onNodeClick?.(chip.id)}
                        className="inline-flex items-center gap-1 max-w-full px-2.5 py-1 rounded-full text-[11px] font-medium bg-c-surface-raised text-c-text-secondary border border-slate-200/60 dark:border-white/[0.03] hover:bg-c-surface-raised/80 hover:border-c-border hover:text-c-text transition-colors truncate"
                      >
                        <span className="truncate">{chip.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Preview mode: expand hint ── */}
        {mode === 'preview' && (
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={onExpand}
              className="text-[11px] text-c-text-muted hover:text-c-text transition-colors"
            >
              {t(
                'ideas.table.doubleClickOrExpandToSeeFullDetails',
                'Double-click or expand to see full details'
              )}
            </button>
          </div>
        )}

        {/* ── Trust signals ── */}
        {node && (node.data?.sourceType || node.data?.convertedTo || node.data?.aiGenerated) && (
          <div className="px-5 py-2 border-t border-c-border-subtle flex-shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {node.data?.aiGenerated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold bg-c-accent-soft text-c-accent">
                  <Sparkles size={8} />
                  {t('ideas.table.aiGenerated', 'AI Generated')}
                </span>
              )}
              {node.data?.sourceType && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold bg-[color-mix(in_srgb,var(--c-info)_16%,transparent)] text-c-info">
                  <Link2 size={8} />
                  {t('ideas.table.source', 'Source')}: {node.data.sourceType}
                </span>
              )}
              {node.data?.convertedTo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold bg-[color-mix(in_srgb,var(--c-success)_16%,transparent)] text-c-success">
                  <ArrowRight size={8} />
                  {t('ideas.table.convertedTo', 'Converted to')}: {node.data.convertedTo}
                </span>
              )}
              {node.data?.needsReview && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold bg-[color-mix(in_srgb,var(--c-warning)_16%,transparent)] text-c-warning">
                  {t('ideas.table.pendingReview', 'Pending review')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {!locked && onConvert && (
          <div className="px-5 py-3 border-t border-c-border-subtle flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Rocket size={11} className="text-c-text-muted mr-1" />
              {(['initiative', 'task', 'decision'] as const).map((target) => (
                <button
                  key={target}
                  onClick={() => {
                    onFieldChange(node.id, 'convertedTo', target);
                    onConvert(target);
                  }}
                  className="flex-1 px-2 py-1.5 rounded-xl text-[10px] font-semibold text-c-text-muted bg-c-surface-raised hover:bg-c-surface-raised transition-colors"
                >
                  {target === 'initiative'
                    ? t('ideas.table.initiative', 'Initiative')
                    : target === 'task'
                      ? t('ideas.table.task', 'Task')
                      : t('ideas.table.decision', 'Decision')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RowDetailPanel;
