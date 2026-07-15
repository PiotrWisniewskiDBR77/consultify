/**
 * IdeaNodeDetailDrawer — Slide-out detail panel for any canvas node.
 *
 * Opens on double-click / Enter. Shows rich content: description, tags,
 * attachments, comments, AI context, linked nodes, priority, status.
 * Supports inline editing and AI-powered context enrichment.
 */
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileText,
  GitBranch,
  Hash,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Tag,
  Target,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api, getMapVersionFromPayload } from '@/services/api';
import { generateAIProposal } from '@/services/ideaAIGenerator';
import { getArtifactLabel } from '@/utils/artifactLinks';

import type { AIProposalBatch, CanvasToolType } from './ideaSelectionTypes';
import {
  insertMentionIntoText,
  renderMentionText,
  useMentionAutocomplete,
} from './mentionAutocomplete';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NodeAttachment {
  id: string;
  type: 'link' | 'image' | 'file';
  url: string;
  title?: string;
  thumbnailUrl?: string;
  addedAt?: string;
}

export interface NodeComment {
  id: string;
  userId?: string;
  userName?: string;
  text: string;
  createdAt: string;
}

export type NodeStatus = 'idea' | 'exploring' | 'ready' | 'rejected';

export interface NodeEvidenceLink {
  id: string;
  type: 'url' | 'artifact' | 'note';
  title: string;
  url?: string;
  artifactId?: string;
  addedAt?: string;
}

export interface AIExpansionEntry {
  timestamp: string;
  prompt: string;
  resultSummary: string;
}

export interface ExtendedNodeData {
  label: string;
  description?: string;
  owner?: string;
  attachments?: NodeAttachment[];
  comments?: NodeComment[];
  tags?: string[];
  status?: NodeStatus;
  priority?: number;
  aiContext?: string;
  linkedNodes?: string[];
  branchKey?: string;
  colorIndex?: number;
  createdAt?: string;
  updatedAt?: string;

  // V5-IDEA-18: Node depth model
  notes?: string;
  context?: string;
  goal?: string;
  rationale?: string;
  riskNote?: string;
  evidenceLinks?: NodeEvidenceLink[];
  semanticType?: string;
  aiExpansionHistory?: AIExpansionEntry[];
  smartObjectType?: string;
  artifactLinks?: Array<{
    artifactRef: { type: string; id: string };
    artifactIndex?: string;
    label?: string;
    linkRole?: string;
  }>;
}

interface AIContextResult {
  relatedInitiatives: Array<{ id: string; title: string; relevance: string }>;
  relatedRisks: Array<{ text: string; severity: string }>;
  relatedKPIs: Array<{ name: string; value: string; status: string }>;
  suggestions: Array<{ text: string; type: string }>;
  summary: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface IdeaNodeDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeData: ExtendedNodeData;
  ideaId: string;
  activeTool: CanvasToolType;
  locked?: boolean;
  allNodes?: Array<{ id: string; data?: { label?: string; branchKey?: string } }>;
  onNodeDataChange: (nodeId: string, data: Partial<ExtendedNodeData>) => void;
  onGenerateProposal?: (batch: AIProposalBatch) => void;
  onDrillDown?: (nodeId: string) => void;
  mapVersion?: number;
  onMapConflictRefresh?: () => Promise<void> | void;
}

// ── Simple markdown renderer (no external deps) ─────────────────────────────

function simpleMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br/>');
  html = html.replace(
    /(<li>.*?<\/li>(?:<br\/>)?)+/g,
    (m) => `<ul>${m.replace(/<br\/>/g, '')}</ul>`
  );
  return html;
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  NodeStatus,
  { labelPl: string; labelEn: string; color: string; bg: string }
> = {
  idea: {
    labelPl: 'Pomysł',
    labelEn: 'Idea',
    color: 'text-slate-600',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
  exploring: {
    labelPl: 'Eksploracja',
    labelEn: 'Exploring',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
  },
  ready: {
    labelPl: 'Gotowe',
    labelEn: 'Ready',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  rejected: {
    labelPl: 'Odrzucone',
    labelEn: 'Rejected',
    color: 'text-danger-600',
    bg: 'bg-danger-50 dark:bg-danger-900/20',
  },
};

// Categorical tag chips — cycled by index (VA1 data-palette tokens).
// Was crimson (bg-primary-*) + alarm-red (bg-danger-*) mixed in as if categories.
// Now the semantic identity ramp (c-tag-*) as the CANONICAL category chip:
// neutral raised surface + a hue-colored left border + the hue on the Hash icon
// (both graphic markers, ≥3:1), LABEL stays neutral --c-text (guaranteed AA body).
// NOTE: these --c-tag-* tokens are plain hex, so Tailwind's `/alpha` opacity
// modifier (e.g. bg-c-tag-1/15) does NOT compile — use solid neutral surface +
// hue border/icon instead. Tag hues are mid-tone: hue-as-text or white-on-fill
// would fail AA body text — this border+icon pattern is the reference for chips.
const TAG_COLORS: { chip: string; icon: string }[] = [
  { chip: 'bg-c-surface-raised border border-c-tag-1 text-c-text', icon: 'text-c-tag-1' },
  { chip: 'bg-c-surface-raised border border-c-tag-2 text-c-text', icon: 'text-c-tag-2' },
  { chip: 'bg-c-surface-raised border border-c-tag-3 text-c-text', icon: 'text-c-tag-3' },
  { chip: 'bg-c-surface-raised border border-c-tag-4 text-c-text', icon: 'text-c-tag-4' },
  { chip: 'bg-c-surface-raised border border-c-tag-5 text-c-text', icon: 'text-c-tag-5' },
  { chip: 'bg-c-surface-raised border border-c-tag-6 text-c-text', icon: 'text-c-tag-6' },
];

// ── Component ────────────────────────────────────────────────────────────────

export const IdeaNodeDetailDrawer: React.FC<IdeaNodeDetailDrawerProps> = ({
  open,
  onClose,
  nodeId,
  nodeData,
  ideaId,
  activeTool,
  locked = false,
  allNodes = [],
  onNodeDataChange,
  onGenerateProposal,
  onDrillDown,
  mapVersion,
  onMapConflictRefresh,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const drawerRef = useRef<HTMLDivElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(nodeData.label || '');
  const [descValue, setDescValue] = useState(nodeData.description || '');
  const [ownerValue, setOwnerValue] = useState(nodeData.owner || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [aiContext, setAiContext] = useState<AIContextResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [artifactLinks, setArtifactLinks] = useState<any[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);

  // @mention org-member autocomplete (shared with NodeCommentThread, B2b).
  const {
    mentionPool,
    mentionQuery,
    mentionSuggestions,
    resolveMentionIds,
    handleMentionInput,
    closeMentionMenu,
  } = useMentionAutocomplete(open);

  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([
      'description',
      'tags',
      'ai_context',
      'attachments',
      'artifact_links',
      'evidence_links',
      'comments',
      'links',
    ])
  );

  useEffect(() => {
    setTitleValue(nodeData.label || '');
    setDescValue(nodeData.description || '');
    setOwnerValue(nodeData.owner || '');
  }, [nodeData.label, nodeData.description, nodeData.owner, nodeId]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !ideaId || !nodeId) return;
    setArtifactLoading(true);
    Api.getObjectArtifacts(ideaId, nodeId)
      .then((result) => {
        if (cancelled) return;
        setArtifactLinks(Array.isArray(result?.artifactLinks) ? result.artifactLinks : []);
      })
      .catch(() => {
        if (!cancelled) setArtifactLinks([]);
      })
      .finally(() => {
        if (!cancelled) setArtifactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, nodeId, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, open]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    if (titleValue.trim() !== nodeData.label) {
      onNodeDataChange(nodeId, { label: titleValue.trim() });
    }
  }, [nodeData.label, nodeId, onNodeDataChange, titleValue]);

  const commitDescription = useCallback(() => {
    setEditingDesc(false);
    if (descValue !== (nodeData.description || '')) {
      onNodeDataChange(nodeId, { description: descValue });
    }
  }, [descValue, nodeData.description, nodeId, onNodeDataChange]);

  const handleStatusChange = useCallback(
    (status: NodeStatus) => {
      if (locked) return;
      onNodeDataChange(nodeId, { status });
    },
    [locked, nodeId, onNodeDataChange]
  );

  const handlePriorityChange = useCallback(
    (priority: number) => {
      if (locked) return;
      onNodeDataChange(nodeId, { priority });
    },
    [locked, nodeId, onNodeDataChange]
  );

  const handleAddTag = useCallback(() => {
    if (locked || !newTag.trim()) return;
    const tags = [...(nodeData.tags || []), newTag.trim()];
    onNodeDataChange(nodeId, { tags });
    setNewTag('');
  }, [locked, newTag, nodeData.tags, nodeId, onNodeDataChange]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (locked) return;
      const tags = (nodeData.tags || []).filter((t) => t !== tag);
      onNodeDataChange(nodeId, { tags });
    },
    [locked, nodeData.tags, nodeId, onNodeDataChange]
  );

  const handleAddAttachment = useCallback(() => {
    if (locked || !newAttachmentUrl.trim()) return;
    const att: NodeAttachment = {
      id: `att-${Date.now()}`,
      type: newAttachmentUrl.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) ? 'image' : 'link',
      url: newAttachmentUrl.trim(),
      title: newAttachmentUrl.trim().split('/').pop() || 'Link',
      addedAt: new Date().toISOString(),
    };
    const attachments = [...(nodeData.attachments || []), att];
    onNodeDataChange(nodeId, { attachments });
    setNewAttachmentUrl('');
  }, [locked, newAttachmentUrl, nodeData.attachments, nodeId, onNodeDataChange]);

  const handleRemoveAttachment = useCallback(
    (attId: string) => {
      if (locked) return;
      const attachments = (nodeData.attachments || []).filter((a) => a.id !== attId);
      onNodeDataChange(nodeId, { attachments });
    },
    [locked, nodeData.attachments, nodeId, onNodeDataChange]
  );

  const handleDetachArtifact = useCallback(
    async (artifactType: string, artifactId: string) => {
      if (locked) return;
      try {
        await Api.detachArtifactFromObject(ideaId, nodeId, artifactType, artifactId, {
          baseVersion: mapVersion,
        });
        setArtifactLinks((prev) =>
          prev.filter(
            (link) =>
              !(link?.artifactRef?.type === artifactType && link?.artifactRef?.id === artifactId)
          )
        );
      } catch (err: any) {
        const conflictVersion = getMapVersionFromPayload(err?.data);
        if (conflictVersion) {
          await onMapConflictRefresh?.();
        }
        // keep drawer responsive; attachment list will refresh on reopen
      }
    },
    [ideaId, locked, mapVersion, nodeId, onMapConflictRefresh]
  );

  const handleAddEvidence = useCallback(() => {
    if (locked || !newEvidenceTitle.trim()) return;
    const evidenceLink: NodeEvidenceLink = {
      id: `ev-${Date.now()}`,
      type: newEvidenceUrl.trim().startsWith('http') ? 'url' : 'note',
      title: newEvidenceTitle.trim(),
      url: newEvidenceUrl.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    const evidenceLinks = [...(nodeData.evidenceLinks || []), evidenceLink];
    onNodeDataChange(nodeId, { evidenceLinks });
    setNewEvidenceTitle('');
    setNewEvidenceUrl('');
    setShowEvidenceForm(false);
  }, [locked, newEvidenceTitle, newEvidenceUrl, nodeData.evidenceLinks, nodeId, onNodeDataChange]);

  const handleEvidenceLinkClick = useCallback((item: NodeEvidenceLink) => {
    if (item.type === 'url' && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else if (item.type === 'artifact' && item.artifactId) {
      window.dispatchEvent(
        new CustomEvent('mywork-open-item', {
          detail: { type: 'artifact', id: item.artifactId, name: item.title },
        })
      );
    }
  }, []);

  const handleAddComment = useCallback(async () => {
    const trimmed = newComment.trim();
    if (!trimmed || commentSubmitting) return;

    // Prefer resolved org-member user ids; fall back to bare name tokens.
    // The server also re-resolves mentions from the raw text itself, so this
    // is belt-and-suspenders — but sending them keeps the two paths consistent.
    const mentions = resolveMentionIds(trimmed);
    closeMentionMenu();
    setCommentSubmitting(true);

    try {
      const res = await Api.addNodeComment(ideaId, nodeId, trimmed, mentions);
      if (res?.comment) {
        const comment: NodeComment = {
          id: res.comment.id,
          userName: res.comment.author,
          text: res.comment.text,
          createdAt: res.comment.createdAt,
        };
        const comments = [...(nodeData.comments || []), comment];
        onNodeDataChange(nodeId, { comments });
        setNewComment('');
        commentInputRef.current?.focus();
        return;
      }
    } catch {
      toast.error(t('myWorkIdeas.nodeDetailDrawer.failedAddComment'));
    } finally {
      setCommentSubmitting(false);
    }
  }, [
    closeMentionMenu,
    commentSubmitting,
    ideaId,
    isPl,
    newComment,
    nodeData.comments,
    nodeId,
    onNodeDataChange,
    resolveMentionIds,
  ]);

  const fetchAIContext = useCallback(async () => {
    if (!nodeData.label) return;
    setAiLoading(true);
    try {
      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: nodeData.label,
          seedText: `${nodeData.label}${nodeData.description ? `\n${nodeData.description}` : ''}. Focus node: ${nodeId}`,
          currentNodes: allNodes.map((n) => ({ id: n.id, label: n.data?.label })),
          currentEdges: [],
          activeTool: activeTool || 'mindmap',
        },
        mode: 'passive' as any,
        language: i18n.language,
      });

      const suggestions = result?.suggestions || [];
      setAiContext({
        relatedInitiatives: suggestions
          .filter(
            (s: any) => s.category === 'branch_suggestions' || s.source?.includes('initiative')
          )
          .slice(0, 3)
          .map((s: any) => ({ id: s.id, title: s.text, relevance: s.detail || '' })),
        relatedRisks: suggestions
          .filter((s: any) => s.category === 'risk_flags')
          .slice(0, 3)
          .map((s: any) => ({ text: s.text, severity: s.confidence > 0.7 ? 'high' : 'medium' })),
        relatedKPIs: suggestions
          .filter((s: any) => s.source?.includes('kpi'))
          .slice(0, 3)
          .map((s: any) => ({ name: s.text, value: s.detail || '', status: 'info' })),
        suggestions: suggestions
          .filter((s: any) => s.category === 'next_steps' || s.actionType === 'add_node')
          .slice(0, 4)
          .map((s: any) => ({ text: s.text, type: s.actionType || 'info' })),
        summary: suggestions.find((s: any) => s.category === 'findings')?.text || '',
      });
    } catch {
      setAiContext(null);
    } finally {
      setAiLoading(false);
    }
  }, [activeTool, allNodes, i18n.language, ideaId, nodeData.description, nodeData.label, nodeId]);

  useEffect(() => {
    if (open && nodeData.label) {
      fetchAIContext();
    }
  }, [open, nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAIExpand = useCallback(async () => {
    if (!onGenerateProposal) return;
    setAiLoading(true);
    try {
      const batch = await generateAIProposal({
        ideaId,
        generatorType: 'mindmap_expand',
        tool: activeTool,
        context: {
          seedText: `Focus on expanding: "${nodeData.label}"${nodeData.description ? `\nContext: ${nodeData.description}` : ''}`,
          title: nodeData.label,
          branch: nodeData.branchKey || '',
          area: '',
          existingNodes: allNodes,
          existingEdges: [],
          language: i18n.language || 'en',
        },
      });
      onGenerateProposal(batch);
    } catch {
      /* handled by toast */
    } finally {
      setAiLoading(false);
    }
  }, [
    activeTool,
    allNodes,
    i18n.language,
    ideaId,
    nodeData.branchKey,
    nodeData.description,
    nodeData.label,
    onGenerateProposal,
  ]);

  const status = nodeData.status || 'idea';
  const statusCfg = STATUS_CONFIG[status];
  const priority = nodeData.priority ?? 50;

  const linkedNodeLabels = useMemo(() => {
    if (!nodeData.linkedNodes?.length) return [];
    return nodeData.linkedNodes
      .map((lid) => allNodes.find((n) => n.id === lid))
      .filter(Boolean)
      .map((n) => ({ id: n!.id, label: n!.data?.label || n!.id }));
  }, [allNodes, nodeData.linkedNodes]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex justify-end">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div
        ref={drawerRef}
        className="relative w-[420px] max-w-[90vw] h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200/60 dark:border-navy-700/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editingTitle && !locked ? (
                <input
                  autoFocus
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  className="w-full text-base font-bold text-slate-900 dark:text-white bg-transparent border-b-2 border-c-info outline-none pb-0.5"
                />
              ) : (
                <h2
                  className="text-base font-bold text-slate-900 dark:text-white cursor-pointer hover:text-c-info transition-colors line-clamp-2"
                  onClick={() => !locked && setEditingTitle(true)}
                >
                  {nodeData.label || t('myWorkIdeas.nodeDetailDrawer.untitled')}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.bg} ${statusCfg.color}`}
                >
                  {isPl ? statusCfg.labelPl : statusCfg.labelEn}
                </span>
                {nodeData.branchKey && (
                  <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase tracking-wider">
                    {nodeData.branchKey}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-1.5 mt-3">
            {onDrillDown && (
              <button
                onClick={() => onDrillDown(nodeId)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors"
              >
                <GitBranch size={12} />
                {t('myWorkIdeas.nodeDetailDrawer.drillDown')}
              </button>
            )}
            <button
              onClick={handleAIExpand}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors disabled:opacity-40"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t('myWorkIdeas.nodeDetailDrawer.aiExpand')}
            </button>
          </div>
        </div>

        {/* Content sections */}
        <div className="px-5 py-4 space-y-4">
          {/* Status & Priority */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </div>
              <div className="flex gap-1">
                {(Object.keys(STATUS_CONFIG) as NodeStatus[]).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={locked}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                        status === s
                          ? `${cfg.bg} ${cfg.color} ring-1 ring-current/20`
                          : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      } disabled:opacity-40`}
                    >
                      {isPl ? cfg.labelPl : cfg.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Priority slider */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {t('myWorkIdeas.nodeDetailDrawer.priority')}: {priority}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => handlePriorityChange(Number(e.target.value))}
              disabled={locked}
              className="w-full h-1.5 rounded-full appearance-none bg-slate-200 dark:bg-navy-700 accent-c-info"
            />
            <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
              <span>{t('myWorkIdeas.nodeDetailDrawer.low')}</span>
              <span>{t('myWorkIdeas.nodeDetailDrawer.high')}</span>
            </div>
          </div>

          {/* Owner */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <User size={10} />
              {t('myWorkIdeas.nodeDetailDrawer.owner')}
            </div>
            <input
              value={ownerValue}
              onChange={(e) => setOwnerValue(e.target.value)}
              onBlur={() => {
                if (ownerValue !== (nodeData.owner || '')) {
                  onNodeDataChange(nodeId, { owner: ownerValue });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (ownerValue !== (nodeData.owner || '')) {
                    onNodeDataChange(nodeId, { owner: ownerValue });
                  }
                  (e.target as HTMLInputElement).blur();
                }
              }}
              disabled={locked}
              placeholder={t('myWorkIdeas.nodeDetailDrawer.assignOwner')}
              className="w-full text-xs bg-slate-50 dark:bg-navy-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-navy-700 outline-none text-slate-700 dark:text-slate-300 placeholder:text-slate-400 disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.description')}
            icon={FileText}
            expanded={expandedSections.has('description')}
            onToggle={() => toggleSection('description')}
          >
            {editingDesc && !locked ? (
              <textarea
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={commitDescription}
                placeholder={t('myWorkIdeas.nodeDetailDrawer.addDescriptionSupportsMarkdown')}
                className="w-full min-h-[100px] text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-navy-800 rounded-xl p-3 border border-slate-200 dark:border-navy-700 outline-none resize-y placeholder:text-slate-400 font-mono"
                rows={4}
              />
            ) : (
              <div
                onClick={() => !locked && setEditingDesc(true)}
                className={`text-xs leading-relaxed rounded-xl p-3 cursor-pointer transition-colors ${
                  descValue
                    ? 'text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-navy-800/50 hover:bg-slate-50 dark:hover:bg-navy-800'
                    : 'text-slate-600 italic bg-slate-50/30 dark:bg-navy-800/30 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
              >
                {descValue ? (
                  <div
                    className="prose prose-xs dark:prose-invert max-w-none [&_strong]:font-bold [&_em]:italic [&_code]:bg-slate-200 [&_code]:dark:bg-navy-700 [&_code]:px-1 [&_code]:rounded [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-c-info [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(descValue) }}
                  />
                ) : (
                  <span>{t('myWorkIdeas.nodeDetailDrawer.clickAddDescription')}</span>
                )}
              </div>
            )}
          </SectionToggle>

          {/* V5-IDEA-18: Node depth model fields */}
          <DepthFieldSection
            fieldKey="notes"
            title={t('myWorkIdeas.nodeDetailDrawer.notes')}
            icon={FileText}
            value={nodeData.notes}
            placeholder={t('myWorkIdeas.nodeDetailDrawer.addNotes')}
            locked={locked}
            expanded={expandedSections.has('notes')}
            onToggle={() => toggleSection('notes')}
            onChange={(val) => onNodeDataChange(nodeId, { notes: val })}
          />
          <DepthFieldSection
            fieldKey="context"
            title={t('myWorkIdeas.nodeDetailDrawer.context')}
            icon={Lightbulb}
            value={nodeData.context}
            placeholder={t('myWorkIdeas.nodeDetailDrawer.whatContext')}
            locked={locked}
            expanded={expandedSections.has('context')}
            onToggle={() => toggleSection('context')}
            onChange={(val) => onNodeDataChange(nodeId, { context: val })}
          />
          <DepthFieldSection
            fieldKey="goal"
            title={t('myWorkIdeas.nodeDetailDrawer.goal')}
            icon={Target}
            value={nodeData.goal}
            placeholder={t('myWorkIdeas.nodeDetailDrawer.whatGoal')}
            locked={locked}
            expanded={expandedSections.has('goal')}
            onToggle={() => toggleSection('goal')}
            onChange={(val) => onNodeDataChange(nodeId, { goal: val })}
          />
          <DepthFieldSection
            fieldKey="rationale"
            title={t('myWorkIdeas.nodeDetailDrawer.rationale')}
            icon={GitBranch}
            value={nodeData.rationale}
            placeholder={t('myWorkIdeas.nodeDetailDrawer.whyImportant')}
            locked={locked}
            expanded={expandedSections.has('rationale')}
            onToggle={() => toggleSection('rationale')}
            onChange={(val) => onNodeDataChange(nodeId, { rationale: val })}
          />
          <DepthFieldSection
            fieldKey="riskNote"
            title={t('myWorkIdeas.nodeDetailDrawer.risk')}
            icon={AlertTriangle}
            value={nodeData.riskNote}
            placeholder={t('myWorkIdeas.nodeDetailDrawer.whatRisks')}
            locked={locked}
            expanded={expandedSections.has('riskNote')}
            onToggle={() => toggleSection('riskNote')}
            onChange={(val) => onNodeDataChange(nodeId, { riskNote: val })}
          />

          {/* Semantic Type */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.semanticType')}
            icon={CircleDot}
            expanded={expandedSections.has('semantic_type')}
            onToggle={() => toggleSection('semantic_type')}
          >
            <select
              value={nodeData.semanticType || ''}
              onChange={(e) =>
                onNodeDataChange(nodeId, { semanticType: e.target.value || undefined })
              }
              disabled={locked}
              className="w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-c-info transition-colors"
            >
              <option value="">{t('myWorkIdeas.nodeDetailDrawer.none')}</option>
              {[
                { value: 'hypothesis', pl: 'Hipoteza', en: 'Hypothesis' },
                { value: 'decision', pl: 'Decyzja', en: 'Decision' },
                { value: 'risk', pl: 'Ryzyko', en: 'Risk' },
                { value: 'opportunity', pl: 'Szansa', en: 'Opportunity' },
                { value: 'action', pl: 'Akcja', en: 'Action' },
                { value: 'evidence', pl: 'Dowód', en: 'Evidence' },
                { value: 'insight', pl: 'Wniosek', en: 'Insight' },
                { value: 'customer', pl: 'Klient', en: 'Customer' },
                { value: 'blocker', pl: 'Blocker', en: 'Blocker' },
              ].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isPl ? opt.pl : opt.en}
                </option>
              ))}
            </select>
          </SectionToggle>

          {/* Tags */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.tags')}
            icon={Tag}
            expanded={expandedSections.has('tags')}
            onToggle={() => toggleSection('tags')}
            count={nodeData.tags?.length}
          >
            <div className="flex flex-wrap gap-1.5">
              {(nodeData.tags || []).map((tag, i) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TAG_COLORS[i % TAG_COLORS.length].chip}`}
                >
                  <Hash size={9} className={TAG_COLORS[i % TAG_COLORS.length].icon} />
                  {tag}
                  {!locked && (
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X size={9} />
                    </button>
                  )}
                </span>
              ))}
              {!locked && (
                <div className="flex items-center gap-1">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                    }}
                    placeholder={t('myWorkIdeas.nodeDetailDrawer.newTag')}
                    className="w-20 text-[10px] bg-transparent border-b border-dashed border-slate-300 dark:border-navy-600 outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400"
                  />
                  <button onClick={handleAddTag} className="text-slate-600 hover:text-c-info">
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
          </SectionToggle>

          {/* AI Context */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.aiContext')}
            icon={Sparkles}
            expanded={expandedSections.has('ai_context')}
            onToggle={() => toggleSection('ai_context')}
            accent
          >
            {aiLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center text-c-info">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[11px]">
                  {t('myWorkIdeas.nodeDetailDrawer.analyzingContext')}
                </span>
              </div>
            ) : aiContext ? (
              <div className="space-y-3">
                {aiContext.summary && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed bg-c-info/5 rounded-lg p-2.5">
                    {aiContext.summary}
                  </div>
                )}
                {aiContext.relatedInitiatives.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('myWorkIdeas.nodeDetailDrawer.relatedInitiatives')}
                    </div>
                    {aiContext.relatedInitiatives.map((ini, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-1">
                        <Target size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                            {ini.title}
                          </div>
                          {ini.relevance && (
                            <div className="text-[9px] text-slate-600">{ini.relevance}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {aiContext.relatedRisks.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('myWorkIdeas.nodeDetailDrawer.risks')}
                    </div>
                    {aiContext.relatedRisks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-1">
                        <AlertTriangle
                          size={10}
                          className={`mt-0.5 shrink-0 ${risk.severity === 'high' ? 'text-danger-500' : 'text-amber-500'}`}
                        />
                        <div className="text-[10px] text-slate-700 dark:text-slate-300">
                          {risk.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {aiContext.suggestions.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('myWorkIdeas.nodeDetailDrawer.aiSuggestions')}
                    </div>
                    {aiContext.suggestions.map((sug, i) => (
                      <div key={i} className="flex items-start gap-1.5 py-1">
                        <Lightbulb size={10} className="text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-[10px] text-slate-700 dark:text-slate-300">
                          {sug.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={fetchAIContext}
                  className="text-[10px] text-c-info hover:text-c-info font-medium"
                >
                  {t('myWorkIdeas.nodeDetailDrawer.refreshContext')}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 py-2 text-center">
                {t('myWorkIdeas.nodeDetailDrawer.noContextDataAvailable')}
              </div>
            )}
          </SectionToggle>

          {/* Attachments */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.attachments')}
            icon={Paperclip}
            expanded={expandedSections.has('attachments')}
            onToggle={() => toggleSection('attachments')}
            count={nodeData.attachments?.length}
          >
            <div className="space-y-1.5">
              {(nodeData.attachments || []).map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-navy-800 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-navy-700 flex items-center justify-center shrink-0">
                    {att.type === 'image' ? (
                      <ImageIcon size={12} className="text-slate-500" />
                    ) : att.type === 'link' ? (
                      <Link2 size={12} className="text-slate-500" />
                    ) : (
                      <FileText size={12} className="text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                      {att.title || att.url}
                    </div>
                    <div className="text-[9px] text-slate-600 truncate">{att.url}</div>
                  </div>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:text-c-info shrink-0"
                  >
                    <ExternalLink size={12} />
                  </a>
                  {!locked && (
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-slate-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!locked && (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddAttachment();
                    }}
                    placeholder={t('myWorkIdeas.nodeDetailDrawer.pasteUrl')}
                    className="flex-1 text-[10px] bg-slate-50 dark:bg-navy-800 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-navy-700 outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleAddAttachment}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-c-info hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </SectionToggle>

          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.linkedArtifacts')}
            icon={Link2}
            expanded={expandedSections.has('artifact_links')}
            onToggle={() => toggleSection('artifact_links')}
            count={artifactLinks.length}
          >
            <div className="space-y-1.5">
              {artifactLoading && (
                <div className="text-[10px] text-slate-600">
                  {t('myWorkIdeas.nodeDetailDrawer.loadingLinks')}
                </div>
              )}
              {!artifactLoading && artifactLinks.length === 0 && (
                <div className="text-[10px] text-slate-600">
                  {t('myWorkIdeas.nodeDetailDrawer.noLinkedArtifacts')}
                </div>
              )}
              {!locked && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('idea-mindmap-node-quick-action', {
                        detail: { action: 'attach_artifact', nodeId },
                      })
                    );
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-c-info bg-c-info/5 hover:bg-c-info/10 transition-colors mb-1.5"
                >
                  <Plus size={12} />
                  {t('myWorkIdeas.nodeDetailDrawer.attachArtifact')}
                </button>
              )}
              {artifactLinks.map((link) => {
                const artifactType = String(link?.artifactRef?.type || '');
                const artifactId = String(link?.artifactRef?.id || '');
                const label =
                  link?.label || getArtifactLabel(artifactType as any, isPl ? 'pl' : 'en');
                return (
                  <div
                    key={`${artifactType}:${artifactId}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-navy-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    onClick={() => {
                      if (artifactType && artifactId) {
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: { type: artifactType, id: artifactId, name: label },
                          })
                        );
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">
                        {label}
                      </div>
                      <div className="text-[9px] text-slate-600 truncate">
                        {link?.artifactIndex || `${artifactType}:${artifactId}`}
                        {link?.linkRole ? ` • ${link.linkRole}` : ''}
                      </div>
                    </div>
                    {artifactType && artifactId && (
                      <ExternalLink size={12} className="text-slate-600 shrink-0" />
                    )}
                    {!locked && artifactType && artifactId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDetachArtifact(artifactType, artifactId);
                        }}
                        className="text-slate-600 hover:text-danger-500 shrink-0"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionToggle>

          {/* Evidence Links */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.evidenceSources')}
            icon={ExternalLink}
            expanded={expandedSections.has('evidence_links')}
            onToggle={() => toggleSection('evidence_links')}
            count={nodeData.evidenceLinks?.length}
          >
            <div className="space-y-1.5">
              {(nodeData.evidenceLinks || []).map((item) => {
                const isClickable =
                  (item.type === 'url' && item.url) ||
                  (item.type === 'artifact' && item.artifactId);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-navy-800 ${isClickable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors' : ''}`}
                    onClick={() => handleEvidenceLinkClick(item)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-navy-700 flex items-center justify-center shrink-0">
                      {item.type === 'url' ? (
                        <ExternalLink size={12} className="text-slate-500" />
                      ) : (
                        <FileText size={12} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                        {item.title}
                      </div>
                      {item.url && (
                        <div className="text-[9px] text-slate-600 truncate">{item.url}</div>
                      )}
                    </div>
                    <span className="text-[8px] font-bold uppercase text-slate-600 shrink-0">
                      {item.type}
                    </span>
                  </div>
                );
              })}
              {!locked && !showEvidenceForm && (
                <button
                  type="button"
                  onClick={() => setShowEvidenceForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                >
                  <Plus size={12} />
                  {t('myWorkIdeas.nodeDetailDrawer.addEvidenceSource')}
                </button>
              )}
              {!locked && showEvidenceForm && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 space-y-2">
                  <input
                    autoFocus
                    value={newEvidenceTitle}
                    onChange={(e) => setNewEvidenceTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEvidence();
                      if (e.key === 'Escape') setShowEvidenceForm(false);
                    }}
                    placeholder={t('myWorkIdeas.nodeDetailDrawer.evidenceTitle')}
                    className="w-full text-[10px] bg-white dark:bg-navy-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-navy-700 outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400"
                  />
                  <input
                    value={newEvidenceUrl}
                    onChange={(e) => setNewEvidenceUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEvidence();
                      if (e.key === 'Escape') setShowEvidenceForm(false);
                    }}
                    placeholder={t('myWorkIdeas.nodeDetailDrawer.urlOptional')}
                    className="w-full text-[10px] bg-white dark:bg-navy-900 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-navy-700 outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddEvidence}
                      disabled={!newEvidenceTitle.trim()}
                      className="flex-1 h-7 rounded-lg text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                    >
                      {t('myWorkIdeas.nodeDetailDrawer.add')}
                    </button>
                    <button
                      onClick={() => {
                        setShowEvidenceForm(false);
                        setNewEvidenceTitle('');
                        setNewEvidenceUrl('');
                      }}
                      className="h-7 px-3 rounded-lg text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                      {t('myWorkIdeas.nodeDetailDrawer.cancel')}
                    </button>
                  </div>
                </div>
              )}
              {(nodeData.evidenceLinks || []).length === 0 && !showEvidenceForm && (
                <div className="text-[10px] text-slate-600 py-1">
                  {t('myWorkIdeas.nodeDetailDrawer.noEvidenceYet')}
                </div>
              )}
            </div>
          </SectionToggle>

          {/* Comments */}
          <SectionToggle
            title={t('myWorkIdeas.nodeDetailDrawer.comments')}
            icon={MessageSquare}
            expanded={expandedSections.has('comments')}
            onToggle={() => toggleSection('comments')}
            count={nodeData.comments?.length}
          >
            <div className="space-y-2">
              {(nodeData.comments || []).map((cmt) => (
                <div key={cmt.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-5 h-5 rounded-full bg-c-info/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-c-info">
                        {(cmt.userName || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      {cmt.userName || 'User'}
                    </span>
                    <span className="text-[9px] text-slate-600">
                      {new Date(cmt.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {renderMentionText(cmt.text, mentionPool)}
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-1.5">
                <div className="flex-1 relative">
                  {mentionQuery !== null && mentionSuggestions.length > 0 && (
                    <div
                      role="listbox"
                      aria-label={t('myWorkIdeas.nodeDetailDrawer.mentionTeammate')}
                      className="absolute bottom-full left-0 mb-1 w-64 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg max-h-40 overflow-y-auto z-overlay"
                    >
                      {mentionSuggestions.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          role="option"
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-slate-50 dark:hover:bg-navy-700 flex items-center gap-2"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const ta = commentInputRef.current;
                            const body = newComment || '';
                            const caretPos = ta?.selectionStart ?? body.length;
                            const result = insertMentionIntoText(body, caretPos, user);
                            if (!result) return;
                            setNewComment(result.text);
                            closeMentionMenu();
                            requestAnimationFrame(() => {
                              if (ta) {
                                ta.focus();
                                ta.setSelectionRange(result.caret, result.caret);
                              }
                            });
                          }}
                        >
                          <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[9px] font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 truncate">
                            {user.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewComment(val);
                      const caret = e.target.selectionStart ?? val.length;
                      handleMentionInput(val, caret);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && mentionQuery !== null) {
                        e.preventDefault();
                        closeMentionMenu();
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder={t('myWorkIdeas.nodeDetailDrawer.addCommentMention')}
                    className="w-full text-[11px] bg-slate-50 dark:bg-navy-800 rounded-lg pl-2.5 pr-6 py-2 border border-slate-200 dark:border-navy-700 outline-none text-slate-600 dark:text-slate-400 placeholder:text-slate-400 resize-none"
                    rows={2}
                  />
                  <AtSign size={10} className="absolute right-2 bottom-2.5 text-slate-500" />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || commentSubmitting}
                  className="p-2 rounded-lg text-c-info hover:bg-c-info/10 transition-colors disabled:opacity-30"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </SectionToggle>

          {/* Linked Nodes */}
          {linkedNodeLabels.length > 0 && (
            <SectionToggle
              title={t('myWorkIdeas.nodeDetailDrawer.links')}
              icon={Link2}
              expanded={expandedSections.has('links')}
              onToggle={() => toggleSection('links')}
              count={linkedNodeLabels.length}
            >
              <div className="space-y-1">
                {linkedNodeLabels.map((ln) => (
                  <div
                    key={ln.id}
                    className="flex items-center gap-2 py-1 text-[10px] text-slate-600 dark:text-slate-400"
                  >
                    <GitBranch size={10} className="text-slate-600 shrink-0" />
                    <span className="truncate">{ln.label}</span>
                  </div>
                ))}
              </div>
            </SectionToggle>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Section toggle helper ────────────────────────────────────────────────────

const SectionToggle: React.FC<{
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  accent?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, expanded, onToggle, count, accent, children }) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-2 py-1.5 text-left group ${
        accent ? 'text-c-info' : 'text-slate-600 dark:text-slate-400'
      }`}
    >
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <Icon size={12} className={accent ? 'text-c-info' : 'text-slate-600'} />
      <span className="text-[10px] font-bold uppercase tracking-wider flex-1">{title}</span>
      {count != null && count > 0 && (
        <span className="text-[9px] font-semibold bg-slate-100 dark:bg-navy-800 text-slate-500 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
    {expanded && <div className="mt-1.5 pl-0.5">{children}</div>}
  </div>
);

// ── V5-IDEA-18: Depth field section ─────────────────────────────────────────

const DepthFieldSection: React.FC<{
  fieldKey: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value?: string;
  placeholder: string;
  locked: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}> = ({ title, icon: Icon, value, placeholder, locked, expanded, onToggle, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (localValue !== (value || '')) {
      onChange(localValue);
    }
  };

  return (
    <SectionToggle title={title} icon={Icon} expanded={expanded} onToggle={onToggle}>
      {editing && !locked ? (
        <textarea
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className="w-full min-h-[60px] text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-navy-800 rounded-xl p-3 border border-slate-200 dark:border-navy-700 outline-none resize-y placeholder:text-slate-400"
          rows={3}
        />
      ) : (
        <div
          onClick={() => !locked && setEditing(true)}
          className={`text-xs leading-relaxed rounded-xl p-3 cursor-pointer transition-colors ${
            localValue
              ? 'text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-navy-800/50 hover:bg-slate-50 dark:hover:bg-navy-800'
              : 'text-slate-600 italic bg-slate-50/30 dark:bg-navy-800/30 hover:bg-slate-50 dark:hover:bg-navy-800'
          }`}
        >
          {localValue || placeholder}
        </div>
      )}
    </SectionToggle>
  );
};

export default IdeaNodeDetailDrawer;
