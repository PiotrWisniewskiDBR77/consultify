/**
 * UnifiedNodeDetailDrawer — M06 Fala 4.1b canonical node-detail drawer.
 *
 * Single drawer covering the SUPERSET of the two legacy duplicates:
 *   - NodeDetailDrawer (M06 mindmap, IdeaRecommendationMap): 5-status flow with
 *     icons, Company Context (getMyIdeaAISuggestions), inline AI expand into map,
 *     Convert footer, Related Nodes (edge-derived), Drill down.
 *   - IdeaNodeDetailDrawer (M05 canvas, IdeaMapWorkspace): 4-status enum, editable
 *     title/description(markdown)/owner/priority, real AI Context panel, comments,
 *     attachments, OCC artifact detach, evidence links, linked-node list.
 *
 * Behaviour is driven by `variant`:
 *   - 'mindmap' → renders the M06 capability set + shared core.
 *   - 'idea'    → renders the M05 capability set + shared core.
 * The shared core (status, semantic type, notes/context/goal/rationale/risk depth
 * fields, tags, evidence links) renders in both.
 *
 * Rendered behind feature flag `mindmapDrawerUnified` (OFF by default). OFF path
 * keeps the two legacy drawers untouched.
 *
 * TRIADA: uses c-* tokens only. `primary` (crimson) is NOT used for CTA / active
 * states; focus rings use c-focus. No `/alpha` on c-* hex tokens.
 */
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Bot,
  ChevronRight,
  ExternalLink,
  FileText,
  GitBranch,
  Hash,
  Image as ImageIcon,
  Info,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Rocket,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Target,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout, EmptyStateInline, ToggleBlock } from '@/components/shared/NModeBlocks';
import { Api, getMapVersionFromPayload } from '@/services/api';
import { generateAIProposal } from '@/services/ideaAIGenerator';
import type { ArtifactLink } from '@/utils/artifactLinks';
import { getArtifactLabel } from '@/utils/artifactLinks';
import {
  IDEA_ELEMENT_DETAILS_SLOT_ID,
  isIdeaDetailsInPanelEnabled,
} from '@/utils/ideaDetailsInPanelFlag';

import TeresaMark from '../../shared/TeresaMark';
import type { AIProposalBatch, CanvasToolType } from '../ideaSelectionTypes';
import {
  insertMentionIntoText,
  renderMentionText,
  useMentionAutocomplete,
} from '../mentionAutocomplete';
import { AddEvidenceModal } from './AddEvidenceModal';

// ── Types (superset) ───────────────────────────────────────────────────────────

/**
 * Superset status enum: union of mindmap (idea/exploring/validated/
 * ready_to_convert/converted) and idea (idea/exploring/ready/rejected).
 */
export type UnifiedNodeStatus =
  | 'idea'
  | 'exploring'
  | 'validated'
  | 'ready_to_convert'
  | 'converted'
  | 'ready'
  | 'rejected';

export interface UnifiedNodeEvidenceLink {
  id: string;
  type: 'url' | 'artifact' | 'note';
  title: string;
  url?: string;
  artifactId?: string;
  addedAt?: string;
}

export interface UnifiedAIExpansionEntry {
  timestamp: string;
  prompt: string;
  resultSummary: string;
}

export interface UnifiedNodeAttachment {
  id: string;
  type: 'link' | 'image' | 'file';
  url: string;
  title?: string;
  thumbnailUrl?: string;
  addedAt?: string;
}

export interface UnifiedNodeComment {
  id: string;
  userId?: string;
  userName?: string;
  text: string;
  createdAt: string;
}

/**
 * Superset node data. Both legacy shapes (NodeDetailData / ExtendedNodeData) map
 * cleanly into this; `nodeId` is always carried here (mindmap kept it inside
 * nodeData, idea passed it as a separate prop — the idea adapter merges it in).
 */
export interface UnifiedNodeData {
  nodeId: string;
  label: string;
  branchKey?: string;
  sourceType?: string;
  nodeType?: string;
  priority?: number;
  owner?: string;
  description?: string;
  notes?: string;
  status?: UnifiedNodeStatus;
  tags?: string[];
  attachments?: UnifiedNodeAttachment[];
  comments?: UnifiedNodeComment[];
  linkedNodes?: string[];
  aiContext?: string;

  // V5-IDEA-18: node depth model
  context?: string;
  goal?: string;
  rationale?: string;
  riskNote?: string;
  evidenceLinks?: UnifiedNodeEvidenceLink[];
  semanticType?: string;
  aiExpansionHistory?: UnifiedAIExpansionEntry[];
  artifactLinks?: ArtifactLink[];
}

interface CompanyContextItem {
  id: string;
  type: 'assessment' | 'interview' | 'kpi' | 'initiative' | 'similar_idea';
  title: string;
  detail?: string;
  source?: string;
  confidence?: number;
}

interface AIContextResult {
  relatedInitiatives: Array<{ id: string; title: string; relevance: string }>;
  relatedRisks: Array<{ text: string; severity: string }>;
  relatedKPIs: Array<{ name: string; value: string; status: string }>;
  suggestions: Array<{ text: string; type: string }>;
  summary: string;
}

export interface UnifiedNodeDetailDrawerProps {
  variant: 'mindmap' | 'idea';
  open: boolean;
  onClose: () => void;
  nodeData: UnifiedNodeData | null;
  ideaId: string;
  locked?: boolean;
  allNodes?: Array<{ id: string; data?: any }>;
  onUpdateNode: (nodeId: string, patch: Partial<UnifiedNodeData>) => void;
  onDrillDown?: (nodeId: string) => void;

  // ── mindmap-only ──
  ideaTitle?: string;
  allEdges?: Array<{ id: string; source: string; target: string }>;
  onConvertNode?: (nodeId: string, target: 'initiative' | 'decision') => void;
  onNavigateToNode?: (nodeId: string) => void;

  // ── idea-only ──
  activeTool?: CanvasToolType;
  mapVersion?: number;
  onMapConflictRefresh?: () => Promise<void> | void;
  onGenerateProposal?: (batch: AIProposalBatch) => void;
}

// ── Status config (superset, c-* tokens) ───────────────────────────────────────

const STATUS_CONFIG: Record<
  UnifiedNodeStatus,
  { tkey: string; labelEn: string; color: string; icon: React.ComponentType<any> }
> = {
  idea: {
    tkey: 'myWorkMindmap.nodeStatus.idea',
    labelEn: 'Idea',
    color: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface dark:text-c-text-muted',
    icon: Lightbulb,
  },
  exploring: {
    tkey: 'myWorkMindmap.nodeStatus.exploring',
    labelEn: 'Exploring',
    color: 'bg-c-surface-raised text-c-info dark:bg-c-surface dark:text-c-info',
    icon: Target,
  },
  validated: {
    tkey: 'myWorkMindmap.nodeStatus.validated',
    labelEn: 'Validated',
    color: 'bg-c-surface-raised text-c-success dark:bg-c-surface dark:text-c-success',
    icon: Star,
  },
  ready_to_convert: {
    tkey: 'myWorkMindmap.nodeStatus.readyToConvert',
    labelEn: 'Ready to Convert',
    color: 'bg-c-surface-raised text-c-warning dark:bg-c-surface dark:text-c-warning',
    icon: Rocket,
  },
  converted: {
    tkey: 'myWorkMindmap.nodeStatus.converted',
    labelEn: 'Converted',
    color: 'bg-c-surface-raised text-c-tag-2 dark:bg-c-surface dark:text-c-tag-2',
    icon: ArrowRight,
  },
  ready: {
    tkey: 'myWorkMindmap.nodeStatus.ready',
    labelEn: 'Ready',
    color: 'bg-c-surface-raised text-c-success dark:bg-c-surface dark:text-c-success',
    icon: Star,
  },
  rejected: {
    tkey: 'myWorkMindmap.nodeStatus.rejected',
    labelEn: 'Rejected',
    color: 'bg-c-surface-raised text-c-danger dark:bg-c-surface dark:text-c-danger',
    icon: X,
  },
};

// Ordered status flow per variant.
const MINDMAP_STATUS_ORDER: UnifiedNodeStatus[] = [
  'idea',
  'exploring',
  'validated',
  'ready_to_convert',
  'converted',
];
const IDEA_STATUS_ORDER: UnifiedNodeStatus[] = ['idea', 'exploring', 'ready', 'rejected'];

// mindmap variant (NodeDetailDrawer parity) — 10 options, myWorkMindmap.semanticOption.* keys.
const SEMANTIC_TYPE_OPTIONS = [
  { value: '', labelEn: '— none —' },
  { value: 'topic', labelEn: 'Topic' },
  { value: 'subtopic', labelEn: 'Subtopic' },
  { value: 'hypothesis', labelEn: 'Hypothesis' },
  { value: 'option', labelEn: 'Option' },
  { value: 'risk', labelEn: 'Risk' },
  { value: 'action', labelEn: 'Action' },
  { value: 'decision_point', labelEn: 'Decision Point' },
  { value: 'insight', labelEn: 'Insight' },
  { value: 'question', labelEn: 'Question' },
  { value: 'evidence', labelEn: 'Evidence' },
] as const;

// idea variant (IdeaNodeDetailDrawer parity) — distinct 9-option set,
// myWorkMindmap.ideaSemanticOption.* keys. NOT interchangeable with the
// mindmap set above — the two legacy drawers used genuinely different
// vocabularies, so re-using SEMANTIC_TYPE_OPTIONS here would silently drop
// 'decision' / 'opportunity' / 'customer' / 'blocker' node data.
const IDEA_SEMANTIC_TYPE_OPTIONS = [
  { value: 'hypothesis', labelEn: 'Hypothesis' },
  { value: 'decision', labelEn: 'Decision' },
  { value: 'risk', labelEn: 'Risk' },
  { value: 'opportunity', labelEn: 'Opportunity' },
  { value: 'action', labelEn: 'Action' },
  { value: 'evidence', labelEn: 'Evidence' },
  { value: 'insight', labelEn: 'Insight' },
  { value: 'customer', labelEn: 'Customer' },
  { value: 'blocker', labelEn: 'Blocker' },
] as const;

// Categorical tag chips — c-tag-* identity ramp (neutral surface + hue border/icon).
const TAG_COLORS: { chip: string; icon: string }[] = [
  { chip: 'bg-c-surface-raised border border-c-tag-1 text-c-text', icon: 'text-c-tag-1' },
  { chip: 'bg-c-surface-raised border border-c-tag-2 text-c-text', icon: 'text-c-tag-2' },
  { chip: 'bg-c-surface-raised border border-c-tag-3 text-c-text', icon: 'text-c-tag-3' },
  { chip: 'bg-c-surface-raised border border-c-tag-4 text-c-text', icon: 'text-c-tag-4' },
  { chip: 'bg-c-surface-raised border border-c-tag-5 text-c-text', icon: 'text-c-tag-5' },
  { chip: 'bg-c-surface-raised border border-c-tag-6 text-c-text', icon: 'text-c-tag-6' },
];

// ── Simple markdown renderer (idea variant description) ─────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

/**
 * IDE-025 — reaktywne wyszukiwanie slotu „Właściwości" w prawym panelu.
 * Wzorzec 1:1 z `useObjectEditBarSlot`: `MutationObserver` na `document.body`,
 * bo slot pojawia się i znika razem z przełączaniem sekcji panelu, a React nie
 * zgłasza tego w żaden inny sposób komponentowi spoza tego poddrzewa.
 */
function useSlotSzczegolow(aktywne: boolean): HTMLElement | null {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!aktywne || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      setNode(null);
      return;
    }
    const check = () => {
      const found = document.getElementById(IDEA_ELEMENT_DETAILS_SLOT_ID);
      setNode((prev) => (prev === found ? prev : found));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [aktywne]);
  return node;
}

export const UnifiedNodeDetailDrawer: React.FC<UnifiedNodeDetailDrawerProps> = ({
  variant,
  open,
  onClose,
  nodeData,
  ideaId,
  locked = false,
  allNodes = [],
  onUpdateNode,
  onDrillDown,
  ideaTitle,
  allEdges = [],
  onConvertNode,
  onNavigateToNode,
  activeTool,
  mapVersion,
  onMapConflictRefresh,
  onGenerateProposal,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const isIdea = variant === 'idea';
  const nodeId = nodeData?.nodeId || '';

  // Shared editable state.
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<UnifiedNodeStatus>('idea');
  const [tagInput, setTagInput] = useState('');
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

  // mindmap-only state.
  const [companyContext, setCompanyContext] = useState<CompanyContextItem[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [aiExpanding, setAiExpanding] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // idea-only state.
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(nodeData?.label || '');
  const [descValue, setDescValue] = useState(nodeData?.description || '');
  const [ownerValue, setOwnerValue] = useState(nodeData?.owner || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [aiContext, setAiContext] = useState<AIContextResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [artifactLinksState, setArtifactLinksState] = useState<any[]>([]);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);

  // idea: @mention org-member autocomplete (parity with IdeaNodeDetailDrawer /
  // NodeCommentThread — B2b). Inactive (no member fetch) outside the idea
  // variant since mindmap comments don't exist.
  const {
    mentionPool,
    mentionQuery,
    mentionSuggestions,
    resolveMentionIds,
    handleMentionInput,
    closeMentionMenu,
  } = useMentionAutocomplete(isIdea && open);
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');

  const statusOrder = isIdea ? IDEA_STATUS_ORDER : MINDMAP_STATUS_ORDER;

  // Sync local state on node change.
  useEffect(() => {
    if (nodeData) {
      setNotes(nodeData.notes || '');
      setStatus((nodeData.status as UnifiedNodeStatus) || 'idea');
      setTitleValue(nodeData.label || '');
      setDescValue(nodeData.description || '');
      setOwnerValue(nodeData.owner || '');
      setAiSuggestions([]);
      setTagInput('');
    }
  }, [nodeData?.nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── mindmap: company context ──
  useEffect(() => {
    if (isIdea || !open || !nodeData || !ideaId) return;
    let cancelled = false;
    setLoadingContext(true);
    (async () => {
      try {
        const res = await Api.getMyIdeaAISuggestions(ideaId, {
          seedText: `${ideaTitle || ''}: ${nodeData.label}`,
          mapNodes: allNodes.map((n) => ({
            id: n.id,
            type: 'idea',
            data: { label: n.data?.label, branchKey: n.data?.branchKey },
          })),
          activeTool: 'mindmap',
          language: i18n.language,
        });
        if (!cancelled && res?.suggestions) {
          setCompanyContext(
            res.suggestions.slice(0, 6).map((s: any, idx: number) => ({
              id: s.id || `ctx-${idx}`,
              type:
                s.category === 'risk_flags'
                  ? 'assessment'
                  : s.category === 'findings'
                    ? 'interview'
                    : 'similar_idea',
              title: s.text,
              detail: s.detail,
              source: s.source,
              confidence: s.confidence,
            }))
          );
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, nodeData?.nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── idea: server-side artifact links (OCC-aware) ──
  useEffect(() => {
    if (!isIdea) return;
    let cancelled = false;
    if (!open || !ideaId || !nodeId) return;
    setArtifactLoading(true);
    Api.getObjectArtifacts(ideaId, nodeId)
      .then((result) => {
        if (cancelled) return;
        setArtifactLinksState(Array.isArray(result?.artifactLinks) ? result.artifactLinks : []);
      })
      .catch(() => {
        if (!cancelled) setArtifactLinksState([]);
      })
      .finally(() => {
        if (!cancelled) setArtifactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaId, nodeId, open, isIdea]);

  // ── idea: Esc closes ──
  useEffect(() => {
    if (!isIdea || !open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, open, isIdea]);

  // ── idea: AI context ──
  const fetchAIContext = useCallback(async () => {
    if (!nodeData?.label) return;
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
  }, [activeTool, allNodes, i18n.language, ideaId, nodeData?.description, nodeData?.label, nodeId]);

  useEffect(() => {
    if (isIdea && open && nodeData?.label) {
      fetchAIContext();
    }
  }, [open, nodeId, isIdea]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared handlers ──
  const handleNotesBlur = useCallback(() => {
    if (!nodeData || locked) return;
    onUpdateNode(nodeData.nodeId, { notes });
  }, [locked, nodeData, notes, onUpdateNode]);

  const handleStatusChange = useCallback(
    (newStatus: UnifiedNodeStatus) => {
      if (locked || !nodeData) return;
      setStatus(newStatus);
      onUpdateNode(nodeData.nodeId, { status: newStatus });
    },
    [locked, nodeData, onUpdateNode]
  );

  const handleAddTag = useCallback(() => {
    if (!nodeData || locked) return;
    const next = tagInput.trim();
    if (!next) return;
    const merged = Array.from(new Set([...(nodeData.tags || []), next]));
    onUpdateNode(nodeData.nodeId, { tags: merged });
    setTagInput('');
  }, [locked, nodeData, onUpdateNode, tagInput]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!nodeData || locked) return;
      onUpdateNode(nodeData.nodeId, { tags: (nodeData.tags || []).filter((item) => item !== tag) });
    },
    [locked, nodeData, onUpdateNode]
  );

  const handleAddEvidenceLink = useCallback(
    (title: string, url?: string) => {
      if (!nodeData || locked) return;
      const nextEvidence = [
        ...(nodeData.evidenceLinks || []),
        {
          id: `evidence-${Date.now()}`,
          type: url?.startsWith('http') ? 'url' : 'note',
          title,
          ...(url ? { url } : {}),
          addedAt: new Date().toISOString(),
        } as UnifiedNodeEvidenceLink,
      ];
      onUpdateNode(nodeData.nodeId, { evidenceLinks: nextEvidence });
    },
    [locked, nodeData, onUpdateNode]
  );

  // ── mindmap-specific handlers ──
  const handleAIExpandMindmap = useCallback(async () => {
    if (!nodeData || locked) return;
    setAiExpanding(true);
    try {
      const res = await Api.expandMyIdeaMap(ideaId, {
        anchorNodeId: nodeData.nodeId,
        branchKey: nodeData.branchKey,
        count: 5,
        language: i18n.language,
        proposeOnly: true,
      });
      const proposed = res?.proposal?.add?.nodes || res?.proposal?.add || [];
      if (Array.isArray(proposed) && proposed.length > 0) {
        setAiSuggestions(
          proposed.map((n: any) => String(n?.data?.label || n?.title || '')).filter(Boolean)
        );
      } else {
        toast(t('ideas.mindmap.noNewSuggestions', 'No new suggestions'));
      }
    } catch (err: any) {
      toast.error(err?.message || 'AI failed');
    } finally {
      setAiExpanding(false);
    }
  }, [i18n.language, ideaId, isPl, locked, nodeData]);

  const handleApplyAISuggestion = useCallback(
    (text: string) => {
      if (!nodeData) return;
      window.dispatchEvent(
        new CustomEvent('idea-workspace-insert', {
          detail: {
            items: [{ text, type: 'topics' }],
            ideaId,
            anchorNodeId: nodeData.nodeId,
            parentId: nodeData.nodeId,
          },
        })
      );
      toast.success(t('ideas.mindmap.addedMap', 'Added to map'), { duration: 800 });
    },
    [ideaId, isPl, nodeData]
  );

  const relatedNodes = useMemo(() => {
    if (isIdea || !nodeData) return [];
    const childIds = allEdges.filter((e) => e.source === nodeData.nodeId).map((e) => e.target);
    const parentIds = allEdges.filter((e) => e.target === nodeData.nodeId).map((e) => e.source);
    const relatedIds = new Set([...childIds, ...parentIds]);
    return allNodes
      .filter((n) => relatedIds.has(n.id) && n.id !== 'root')
      .map((n) => ({ id: n.id, label: n.data?.label || n.id, branchKey: n.data?.branchKey }));
  }, [allEdges, allNodes, isIdea, nodeData]);

  // ── idea-specific handlers ──
  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    if (nodeData && titleValue.trim() !== nodeData.label) {
      onUpdateNode(nodeData.nodeId, { label: titleValue.trim() });
    }
  }, [nodeData, onUpdateNode, titleValue]);

  const commitDescription = useCallback(() => {
    setEditingDesc(false);
    if (nodeData && descValue !== (nodeData.description || '')) {
      onUpdateNode(nodeData.nodeId, { description: descValue });
    }
  }, [descValue, nodeData, onUpdateNode]);

  const handlePriorityChange = useCallback(
    (priority: number) => {
      if (locked || !nodeData) return;
      onUpdateNode(nodeData.nodeId, { priority });
    },
    [locked, nodeData, onUpdateNode]
  );

  const handleAddAttachment = useCallback(() => {
    if (locked || !nodeData || !newAttachmentUrl.trim()) return;
    const att: UnifiedNodeAttachment = {
      id: `att-${Date.now()}`,
      type: newAttachmentUrl.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) ? 'image' : 'link',
      url: newAttachmentUrl.trim(),
      title: newAttachmentUrl.trim().split('/').pop() || 'Link',
      addedAt: new Date().toISOString(),
    };
    onUpdateNode(nodeData.nodeId, { attachments: [...(nodeData.attachments || []), att] });
    setNewAttachmentUrl('');
  }, [locked, newAttachmentUrl, nodeData, onUpdateNode]);

  const handleRemoveAttachment = useCallback(
    (attId: string) => {
      if (locked || !nodeData) return;
      onUpdateNode(nodeData.nodeId, {
        attachments: (nodeData.attachments || []).filter((a) => a.id !== attId),
      });
    },
    [locked, nodeData, onUpdateNode]
  );

  const handleDetachArtifact = useCallback(
    async (artifactType: string, artifactId: string) => {
      if (locked) return;
      try {
        await Api.detachArtifactFromObject(ideaId, nodeId, artifactType, artifactId, {
          baseVersion: mapVersion,
        });
        setArtifactLinksState((prev) =>
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
      }
    },
    [ideaId, locked, mapVersion, nodeId, onMapConflictRefresh]
  );

  const handleAddEvidenceForm = useCallback(() => {
    if (locked || !nodeData || !newEvidenceTitle.trim()) return;
    const evidenceLink: UnifiedNodeEvidenceLink = {
      id: `ev-${Date.now()}`,
      type: newEvidenceUrl.trim().startsWith('http') ? 'url' : 'note',
      title: newEvidenceTitle.trim(),
      url: newEvidenceUrl.trim() || undefined,
      addedAt: new Date().toISOString(),
    };
    onUpdateNode(nodeData.nodeId, {
      evidenceLinks: [...(nodeData.evidenceLinks || []), evidenceLink],
    });
    setNewEvidenceTitle('');
    setNewEvidenceUrl('');
    setShowEvidenceForm(false);
  }, [locked, newEvidenceTitle, newEvidenceUrl, nodeData, onUpdateNode]);

  const handleEvidenceLinkClick = useCallback((item: UnifiedNodeEvidenceLink) => {
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

  // idea: server-persisted comment (parity with IdeaNodeDetailDrawer). Resolves
  // @mentions to org-member user ids and calls the real node-comments endpoint
  // so authorship/mentions/notifications match the legacy drawer — a purely
  // local onUpdateNode patch (no Api.addNodeComment call) would silently drop
  // mention notifications and stamp a fake "Me" author instead of the server's.
  const handleAddComment = useCallback(async () => {
    if (!nodeData) return;
    const trimmed = newComment.trim();
    if (!trimmed || commentSubmitting) return;

    const mentions = resolveMentionIds(trimmed);
    closeMentionMenu();
    setCommentSubmitting(true);

    try {
      const res = await Api.addNodeComment(ideaId, nodeData.nodeId, trimmed, mentions);
      if (res?.comment) {
        const comment: UnifiedNodeComment = {
          id: res.comment.id,
          userName: res.comment.author,
          text: res.comment.text,
          createdAt: res.comment.createdAt,
        };
        onUpdateNode(nodeData.nodeId, { comments: [...(nodeData.comments || []), comment] });
        setNewComment('');
        commentInputRef.current?.focus();
        return;
      }
    } catch {
      toast.error(t('myWorkIdeas.nodeDetailDrawer.failedAddComment', 'Failed to add comment'));
    } finally {
      setCommentSubmitting(false);
    }
  }, [
    closeMentionMenu,
    commentSubmitting,
    ideaId,
    newComment,
    nodeData,
    onUpdateNode,
    resolveMentionIds,
    t,
  ]);

  const handleAIExpandIdea = useCallback(async () => {
    if (!onGenerateProposal || !nodeData) return;
    setAiLoading(true);
    try {
      const batch = await generateAIProposal({
        ideaId,
        generatorType: 'mindmap_expand',
        tool: activeTool as CanvasToolType,
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
  }, [activeTool, allNodes, i18n.language, ideaId, nodeData, onGenerateProposal]);

  const linkedNodeLabels = useMemo(() => {
    if (!isIdea || !nodeData?.linkedNodes?.length) return [];
    return nodeData.linkedNodes
      .map((lid) => allNodes.find((n) => n.id === lid))
      .filter(Boolean)
      .map((n) => ({ id: n!.id, label: n!.data?.label || n!.id }));
  }, [allNodes, isIdea, nodeData?.linkedNodes]);

  // IDE-025: czy szczegóły mają zamieszkać w prawym panelu zamiast w nakładce.
  // Hook MUSI stać przed warunkowym `return null` poniżej — inaczej łamiemy
  // reguły hooków (liczba wywołań zmienia się między renderami).
  const detaleWPanelu = isIdeaDetailsInPanelEnabled();
  const slotPanelu = useSlotSzczegolow(detaleWPanelu && open && Boolean(nodeData));
  const zadokowany = detaleWPanelu && Boolean(slotPanelu);

  if (!open || !nodeData) return null;

  const isProtected = nodeData.nodeId === 'root' || nodeData.nodeId.startsWith('branch-');
  const isAI =
    nodeData.sourceType === 'ai_chat' ||
    nodeData.sourceType === 'ai_hint' ||
    nodeData.sourceType === 'ai_suggestion';
  const priority = nodeData.priority ?? 50;

  const tresc = (
    <div
      className={
        zadokowany
          ? // W panelu: karta o szerokości sekcji, bez cienia i bez pełnej
            // wysokości ekranu — przewijaniem rządzi panel, nie drawer.
            'w-full rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface flex flex-col overflow-hidden'
          : // Zapas: dotychczasowa nakładka (brak slotu = powłoka wyłączona).
            'fixed top-0 right-0 bottom-0 z-modal w-[420px] max-w-[90vw] bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border-l border-c-border-subtle dark:border-c-border-subtle shadow-2xl flex flex-col overflow-hidden'
      }
      data-zadokowany={zadokowany ? '1' : '0'}
      data-testid="unified-node-detail-drawer"
      data-variant={variant}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isAI ? (
              <TeresaMark size={14} className="text-c-info shrink-0" />
            ) : (
              <Lightbulb size={14} className="text-c-warning shrink-0" />
            )}
            {isIdea && editingTitle && !locked ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="flex-1 text-sm font-bold text-c-text bg-transparent border-b-2 border-c-focus outline-none pb-0.5"
              />
            ) : (
              <h3
                className={`text-sm font-bold text-c-text dark:text-c-text truncate ${isIdea && !locked ? 'cursor-pointer hover:text-c-text-secondary' : ''}`}
                onClick={() => isIdea && !locked && setEditingTitle(true)}
              >
                {nodeData.label || (isIdea ? t('ideas.mindmap.untitled', 'Untitled') : '...')}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-c-text-secondary dark:text-c-text-muted">
            {/* idea: current-status pill in the header (NodeDetailDrawer parity —
                mindmap shows status only via the Basic Info flow below; idea
                additionally surfaces it here as a quick-glance chip). */}
            {isIdea && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CONFIG[status].color}`}
              >
                {t(STATUS_CONFIG[status].tkey, STATUS_CONFIG[status].labelEn)}
              </span>
            )}
            {nodeData.branchKey && (
              <span className="inline-flex items-center gap-1">
                <GitBranch size={10} />
                {nodeData.branchKey}
              </span>
            )}
            {nodeData.nodeType && (
              <span className="uppercase tracking-wide">
                {String(nodeData.nodeType).replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Idea variant quick actions */}
      {isIdea && (
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-c-border-subtle dark:border-c-border-subtle">
          {onDrillDown && (
            <button
              onClick={() => onDrillDown(nodeData.nodeId)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
            >
              <GitBranch size={12} />
              {t('ideas.mindmap.drillDown', 'Drill down')}
            </button>
          )}
          {onGenerateProposal && (
            <button
              onClick={handleAIExpandIdea}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-c-text-secondary bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors disabled:opacity-40"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {t('ideas.mindmap.aiExpand', 'AI Expand')}
            </button>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Basic Info: Status + Semantic Type ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.basicInfo', 'Basic Info')}
            icon={<Info size={14} />}
            defaultOpen
          >
            <div className="space-y-3 mt-2">
              {/* Status flow */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                  Status
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {statusOrder.map((s, idx) => {
                    const cfg = STATUS_CONFIG[s];
                    const isActive = s === status;
                    const isPast = statusOrder.indexOf(status) > idx;
                    return (
                      <React.Fragment key={s}>
                        {!isIdea && idx > 0 && (
                          <div
                            className={`w-3 h-0.5 rounded-full ${isPast || isActive ? 'bg-c-success' : 'bg-c-surface-raised dark:bg-c-surface'}`}
                          />
                        )}
                        <button
                          onClick={() => handleStatusChange(s)}
                          disabled={locked || (!isIdea && isProtected)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            isActive
                              ? cfg.color + ' ring-1 ring-current/20 shadow-sm'
                              : !isIdea && isPast
                                ? 'bg-c-surface-raised text-c-success dark:bg-c-surface dark:text-c-success'
                                : 'text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface'
                          } disabled:opacity-40`}
                          title={t(cfg.tkey, cfg.labelEn)}
                        >
                          {t(cfg.tkey, cfg.labelEn)}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* idea: priority + owner */}
              {isIdea && (
                <>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                      {t('ideas.mindmap.priority', 'Priority')}: {priority}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={priority}
                      onChange={(e) => handlePriorityChange(Number(e.target.value))}
                      disabled={locked}
                      className="w-full h-1.5 rounded-full appearance-none bg-c-surface-raised dark:bg-c-surface accent-c-focus"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5 flex items-center gap-1">
                      <User size={10} />
                      {t('ideas.mindmap.owner', 'Owner')}
                    </div>
                    <input
                      value={ownerValue}
                      onChange={(e) => setOwnerValue(e.target.value)}
                      onBlur={() => {
                        if (ownerValue !== (nodeData.owner || '')) {
                          onUpdateNode(nodeData.nodeId, { owner: ownerValue });
                        }
                      }}
                      disabled={locked}
                      placeholder={t('ideas.mindmap.assignOwner', 'Assign owner...')}
                      className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus transition-all disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {/* Semantic type */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                  {t('ideas.mindmap.semanticType', 'Semantic Type')}
                </div>
                <select
                  value={nodeData.semanticType || ''}
                  onChange={(e) => onUpdateNode(nodeData.nodeId, { semanticType: e.target.value })}
                  disabled={locked || (!isIdea && isProtected)}
                  className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus transition-all disabled:opacity-50"
                >
                  {isIdea ? (
                    <>
                      <option value="">{t('myWorkIdeas.nodeDetailDrawer.none', 'None')}</option>
                      {IDEA_SEMANTIC_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(`myWorkMindmap.ideaSemanticOption.${opt.value}`, opt.labelEn)}
                        </option>
                      ))}
                    </>
                  ) : (
                    SEMANTIC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(`myWorkMindmap.semanticOption.${opt.value || 'none'}`, opt.labelEn)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </ToggleBlock>
        </div>

        {/* ── idea: Description (markdown) ── */}
        {isIdea && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.description', 'Description')}
              icon={<FileText size={14} />}
              defaultOpen
            >
              {editingDesc && !locked ? (
                <textarea
                  autoFocus
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={commitDescription}
                  placeholder={t(
                    'ideas.mindmap.addDescriptionSupportsMarkdown',
                    'Add description (supports **markdown**)...'
                  )}
                  className="w-full min-h-[100px] text-xs text-c-text bg-c-surface-raised dark:bg-c-surface rounded-xl p-3 border border-c-border-subtle dark:border-c-border-subtle outline-none resize-y placeholder:text-c-text-muted font-mono mt-2"
                  rows={4}
                />
              ) : (
                <div
                  onClick={() => !locked && setEditingDesc(true)}
                  className="mt-2 text-xs leading-relaxed rounded-xl p-3 cursor-pointer transition-colors text-c-text-secondary dark:text-c-text bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised"
                >
                  {descValue ? (
                    <div
                      className="max-w-none [&_strong]:font-bold [&_em]:italic [&_code]:bg-c-surface [&_code]:px-1 [&_code]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-c-info"
                      dangerouslySetInnerHTML={{ __html: simpleMarkdown(descValue) }}
                    />
                  ) : (
                    <span className="text-c-text-muted italic">
                      {t('ideas.mindmap.clickAddDescription', 'Click to add description...')}
                    </span>
                  )}
                </div>
              )}
            </ToggleBlock>
          </div>
        )}

        {/* ── Notes & Context depth fields ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.notesContext', 'Notes & Context')}
            icon={<StickyNote size={14} />}
            // mindmap-only badge (NodeDetailDrawer parity) — idea variant never
            // had a combined-section counter for these depth fields.
            badge={
              !isIdea
                ? (() => {
                    const filled = [
                      notes,
                      nodeData.context,
                      nodeData.goal,
                      nodeData.rationale,
                      nodeData.riskNote,
                    ].filter(Boolean).length;
                    return filled > 0 ? String(filled) : undefined;
                  })()
                : undefined
            }
            defaultOpen
          >
            <div className="space-y-2 mt-2">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                  {t('ideas.mindmap.notes', 'Notes')}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                  disabled={locked || (!isIdea && isProtected)}
                  rows={3}
                  placeholder={t('ideas.mindmap.addNotesDetails', 'Add notes, details...')}
                  className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus resize-none transition-all disabled:opacity-50"
                />
              </div>
              <DepthField
                label={t('ideas.mindmap.context', 'Context')}
                value={nodeData.context || ''}
                placeholder={t('ideas.mindmap.whatContext', 'What is the context?')}
                disabled={locked || (!isIdea && isProtected)}
                onChange={(val) => onUpdateNode(nodeData.nodeId, { context: val })}
              />
              <DepthField
                label={t('ideas.mindmap.goal', 'Goal')}
                value={nodeData.goal || ''}
                placeholder={t('ideas.mindmap.whatGoal', 'What is the goal?')}
                disabled={locked || (!isIdea && isProtected)}
                onChange={(val) => onUpdateNode(nodeData.nodeId, { goal: val })}
              />
              <DepthField
                label={t('ideas.mindmap.rationale', 'Rationale')}
                value={nodeData.rationale || ''}
                placeholder={t('ideas.mindmap.whyThisImportant', 'Why is this important?')}
                disabled={locked || (!isIdea && isProtected)}
                onChange={(val) => onUpdateNode(nodeData.nodeId, { rationale: val })}
              />
              <DepthField
                label={t('ideas.mindmap.risk', 'Risk')}
                value={nodeData.riskNote || ''}
                placeholder={t('ideas.mindmap.whatRisks', 'What are the risks?')}
                disabled={locked || (!isIdea && isProtected)}
                onChange={(val) => onUpdateNode(nodeData.nodeId, { riskNote: val })}
              />
            </div>
          </ToggleBlock>
        </div>

        {/* ── Tags ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.tagsClassification', 'Tags & Classification')}
            icon={<Tag size={14} />}
            badge={(nodeData.tags?.length || 0) > 0 ? String(nodeData.tags!.length) : undefined}
            defaultOpen={(nodeData.tags?.length || 0) > 0}
          >
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(nodeData.tags || []).map((tag, i) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${TAG_COLORS[i % TAG_COLORS.length].chip}`}
                  >
                    <Hash
                      size={9}
                      className={`${TAG_COLORS[i % TAG_COLORS.length].icon} shrink-0`}
                    />
                    <span>{tag}</span>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-0.5 text-c-text-secondary hover:text-c-danger"
                      >
                        <X size={9} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={locked || (!isIdea && isProtected)}
                  placeholder={t('ideas.mindmap.addTag', 'Add tag...')}
                  className="flex-1 px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={locked || (!isIdea && isProtected) || !tagInput.trim()}
                  className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text disabled:opacity-40 hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </ToggleBlock>
        </div>

        {/* ── idea: AI Context (real LLM) ── */}
        {isIdea && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.aiContext', 'AI Context')}
              icon={<Sparkles size={14} />}
              defaultOpen
            >
              <div className="mt-2">
                {aiLoading ? (
                  <div className="flex items-center gap-2 py-4 justify-center text-c-text-secondary">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-[11px]">
                      {t('ideas.mindmap.analyzingContext', 'Analyzing context...')}
                    </span>
                  </div>
                ) : aiContext ? (
                  <div className="space-y-3">
                    {aiContext.summary && (
                      <div className="text-[11px] text-c-text-secondary dark:text-c-text leading-relaxed bg-c-surface-raised dark:bg-c-surface rounded-lg p-2.5">
                        {aiContext.summary}
                      </div>
                    )}
                    {aiContext.relatedInitiatives.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                          {t('ideas.mindmap.relatedInitiatives', 'Related Initiatives')}
                        </div>
                        {aiContext.relatedInitiatives.map((ini, i) => (
                          <div key={i} className="flex items-start gap-1.5 py-1">
                            <Target size={10} className="text-c-success mt-0.5 shrink-0" />
                            <div>
                              <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text">
                                {ini.title}
                              </div>
                              {ini.relevance && (
                                <div className="text-[9px] text-c-text-secondary">
                                  {ini.relevance}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiContext.relatedRisks.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                          {t('ideas.mindmap.risks', 'Risks')}
                        </div>
                        {aiContext.relatedRisks.map((risk, i) => (
                          <div key={i} className="flex items-start gap-1.5 py-1">
                            <AlertTriangle
                              size={10}
                              className={`mt-0.5 shrink-0 ${risk.severity === 'high' ? 'text-c-danger' : 'text-c-warning'}`}
                            />
                            <div className="text-[10px] text-c-text-secondary dark:text-c-text">
                              {risk.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiContext.suggestions.length > 0 && (
                      <div>
                        <div className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider mb-1">
                          {t('ideas.mindmap.aiSuggestions', 'AI Suggestions')}
                        </div>
                        {aiContext.suggestions.map((sug, i) => (
                          <div key={i} className="flex items-start gap-1.5 py-1">
                            <Lightbulb size={10} className="text-c-warning mt-0.5 shrink-0" />
                            <div className="text-[10px] text-c-text-secondary dark:text-c-text">
                              {sug.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={fetchAIContext}
                      className="text-[10px] text-c-text-secondary hover:text-c-text font-medium"
                    >
                      {t('ideas.mindmap.refreshContext', '↻ Refresh context')}
                    </button>
                  </div>
                ) : (
                  <EmptyStateInline
                    icon={Sparkles}
                    message={t('ideas.mindmap.noContextDataAvailable', 'No context data available')}
                    dashed={false}
                    className="py-4"
                  />
                )}
              </div>
            </ToggleBlock>
          </div>
        )}

        {/* ── Evidence & Sources ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.evidenceSources', 'Evidence & Sources')}
            badge={String(nodeData.evidenceLinks?.length || 0)}
            defaultOpen={(nodeData.evidenceLinks?.length || 0) > 0}
            icon={<Link2 size={14} />}
          >
            <div className="space-y-2 mt-1">
              {(nodeData.evidenceLinks || []).map((item) => {
                const isUrl = item.type === 'url' && item.url;
                const isArtifact = item.type === 'artifact' && item.artifactId;
                const isClickable = isUrl || isArtifact;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-c-border-subtle dark:border-c-border-subtle px-3 py-2 bg-c-surface-raised dark:bg-c-surface flex items-center gap-2 ${isClickable ? 'cursor-pointer hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors' : ''}`}
                    onClick={() => handleEvidenceLinkClick(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text">
                        {item.title}
                      </div>
                      {(item.url || item.artifactId) && (
                        <div className="mt-0.5 text-[10px] text-c-text-secondary dark:text-c-text-muted break-all truncate">
                          {item.url || item.artifactId}
                        </div>
                      )}
                    </div>
                    {isClickable && (
                      <ExternalLink size={11} className="text-c-text-secondary shrink-0" />
                    )}
                    {/* idea: per-item type tag (IdeaNodeDetailDrawer parity) */}
                    {isIdea && (
                      <span className="text-[8px] font-bold uppercase text-c-text-secondary shrink-0">
                        {item.type}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* mindmap: modal-based add; idea: inline form (preserve both) */}
              {!isIdea ? (
                <button
                  type="button"
                  onClick={() => setShowEvidenceModal(true)}
                  disabled={locked || isProtected}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text disabled:opacity-40 hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
                >
                  <Plus size={12} />
                  {t('ideas.mindmap.addEvidence', 'Add evidence')}
                </button>
              ) : !showEvidenceForm ? (
                <button
                  type="button"
                  onClick={() => setShowEvidenceForm(true)}
                  disabled={locked}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-c-text-secondary bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors disabled:opacity-40"
                >
                  <Plus size={12} />
                  {t('ideas.mindmap.addEvidenceSource', 'Add evidence / source')}
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-c-surface-raised dark:bg-c-surface space-y-2">
                  <input
                    autoFocus
                    value={newEvidenceTitle}
                    onChange={(e) => setNewEvidenceTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEvidenceForm();
                      if (e.key === 'Escape') setShowEvidenceForm(false);
                    }}
                    placeholder={t('ideas.mindmap.evidenceTitle', 'Evidence title...')}
                    className="w-full text-[10px] bg-c-surface dark:bg-c-surface-raised rounded-lg px-2.5 py-1.5 border border-c-border-subtle dark:border-c-border-subtle outline-none text-c-text-secondary placeholder:text-c-text-muted"
                  />
                  <input
                    value={newEvidenceUrl}
                    onChange={(e) => setNewEvidenceUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddEvidenceForm();
                      if (e.key === 'Escape') setShowEvidenceForm(false);
                    }}
                    placeholder={t('ideas.mindmap.urlOptional', 'URL (optional)')}
                    className="w-full text-[10px] bg-c-surface dark:bg-c-surface-raised rounded-lg px-2.5 py-1.5 border border-c-border-subtle dark:border-c-border-subtle outline-none text-c-text-secondary placeholder:text-c-text-muted"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddEvidenceForm}
                      disabled={!newEvidenceTitle.trim()}
                      className="flex-1 h-7 rounded-lg text-[10px] font-semibold bg-c-surface dark:bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-40"
                    >
                      {t('ideas.mindmap.add', 'Add')}
                    </button>
                    <button
                      onClick={() => {
                        setShowEvidenceForm(false);
                        setNewEvidenceTitle('');
                        setNewEvidenceUrl('');
                      }}
                      className="h-7 px-3 rounded-lg text-[10px] text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                    >
                      {t('ideas.mindmap.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
              {/* idea: empty-state hint (IdeaNodeDetailDrawer parity) */}
              {isIdea && (nodeData.evidenceLinks || []).length === 0 && !showEvidenceForm && (
                <div className="text-[10px] text-c-text-secondary py-1">
                  {t('ideas.mindmap.noEvidenceYet', 'No evidence yet')}
                </div>
              )}
            </div>
          </ToggleBlock>
        </div>

        {/* ── Linked artifacts ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.linkedArtifacts', 'Linked artifacts')}
            badge={String(isIdea ? artifactLinksState.length : nodeData.artifactLinks?.length || 0)}
            defaultOpen={
              (isIdea ? artifactLinksState.length : nodeData.artifactLinks?.length || 0) > 0
            }
            icon={<Paperclip size={14} />}
          >
            {isIdea ? (
              <div className="space-y-1.5 mt-1">
                {artifactLoading && (
                  <div className="text-[10px] text-c-text-secondary">
                    {t('ideas.mindmap.loadingLinks', 'Loading links...')}
                  </div>
                )}
                {!artifactLoading && artifactLinksState.length === 0 && (
                  <div className="text-[10px] text-c-text-secondary">
                    {t('ideas.mindmap.noLinkedArtifacts', 'No linked artifacts')}
                  </div>
                )}
                {!locked && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('idea-mindmap-node-quick-action', {
                          detail: { action: 'attach_artifact', nodeId },
                        })
                      )
                    }
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-c-text-secondary bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors mb-1.5"
                  >
                    <Plus size={12} />
                    {t('ideas.mindmap.attachArtifact', 'Attach artifact')}
                  </button>
                )}
                {artifactLinksState.map((link) => {
                  const artifactType = String(link?.artifactRef?.type || '');
                  const artifactId = String(link?.artifactRef?.id || '');
                  const label =
                    link?.label || getArtifactLabel(artifactType as any, isPl ? 'pl' : 'en');
                  return (
                    <div
                      key={`${artifactType}:${artifactId}`}
                      className="flex items-center gap-2 rounded-lg bg-c-surface-raised p-2 dark:bg-c-surface cursor-pointer hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
                      onClick={() =>
                        artifactType &&
                        artifactId &&
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: { type: artifactType, id: artifactId, name: label },
                          })
                        )
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text truncate">
                          {label}
                        </div>
                        <div className="text-[9px] text-c-text-secondary truncate">
                          {link?.artifactIndex || `${artifactType}:${artifactId}`}
                          {link?.linkRole ? ` • ${link.linkRole}` : ''}
                        </div>
                      </div>
                      {artifactType && artifactId && (
                        <ExternalLink size={12} className="text-c-text-secondary shrink-0" />
                      )}
                      {!locked && artifactType && artifactId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetachArtifact(artifactType, artifactId);
                          }}
                          className="text-c-text-secondary hover:text-c-danger shrink-0"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : nodeData.artifactLinks?.length ? (
              <div className="space-y-1.5 mt-1">
                {nodeData.artifactLinks.map((link, idx) => {
                  const artifactType = link.artifactRef?.type;
                  const artifactId = link.artifactRef?.id;
                  return (
                    <button
                      key={`${artifactType || 'artifact'}-${artifactId || idx}`}
                      type="button"
                      onClick={() =>
                        artifactType &&
                        artifactId &&
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: {
                              type: artifactType,
                              id: artifactId,
                              name: link.label || `${artifactType}:${artifactId}`,
                            },
                          })
                        )
                      }
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                    >
                      <Paperclip size={11} className="text-c-text-secondary shrink-0" />
                      <span className="text-[11px] font-medium text-c-text-secondary dark:text-c-text flex-1 truncate">
                        {link.label || `${artifactType}:${artifactId}`}
                      </span>
                      <ExternalLink size={10} className="text-c-text-secondary shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyStateInline
                icon={Paperclip}
                message={t('ideas.mindmap.noLinkedArtifactsYet', 'No linked artifacts yet')}
                dashed={false}
                className="py-4"
              />
            )}
          </ToggleBlock>
        </div>

        {/* ── idea: Attachments (URL list) ── */}
        {isIdea && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.attachments', 'Attachments')}
              icon={<Paperclip size={14} />}
              badge={
                (nodeData.attachments?.length || 0) > 0
                  ? String(nodeData.attachments!.length)
                  : undefined
              }
              defaultOpen={(nodeData.attachments?.length || 0) > 0}
            >
              <div className="space-y-1.5 mt-1">
                {(nodeData.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-c-surface-raised dark:bg-c-surface group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-c-surface dark:bg-c-surface-raised flex items-center justify-center shrink-0">
                      {att.type === 'image' ? (
                        <ImageIcon size={12} className="text-c-text-secondary" />
                      ) : att.type === 'link' ? (
                        <Link2 size={12} className="text-c-text-secondary" />
                      ) : (
                        <FileText size={12} className="text-c-text-secondary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-c-text-secondary dark:text-c-text truncate">
                        {att.title || att.url}
                      </div>
                      <div className="text-[9px] text-c-text-secondary truncate">{att.url}</div>
                    </div>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-c-text-secondary hover:text-c-info shrink-0"
                    >
                      <ExternalLink size={12} />
                    </a>
                    {!locked && (
                      <button
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-c-text-secondary hover:text-c-danger opacity-0 group-hover:opacity-100 shrink-0"
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
                      placeholder={t('ideas.mindmap.pasteUrl', 'Paste URL...')}
                      className="flex-1 text-[10px] bg-c-surface-raised dark:bg-c-surface rounded-lg px-2.5 py-1.5 border border-c-border-subtle dark:border-c-border-subtle outline-none text-c-text-secondary placeholder:text-c-text-muted"
                    />
                    <button
                      onClick={handleAddAttachment}
                      className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-info hover:bg-c-surface-raised dark:hover:bg-c-surface"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            </ToggleBlock>
          </div>
        )}

        {/* ── idea: Comments ── */}
        {isIdea && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.comments', 'Comments')}
              icon={<MessageSquare size={14} />}
              badge={
                (nodeData.comments?.length || 0) > 0 ? String(nodeData.comments!.length) : undefined
              }
              defaultOpen={(nodeData.comments?.length || 0) > 0}
            >
              <div className="space-y-2 mt-1">
                {(nodeData.comments || []).map((cmt) => (
                  <div
                    key={cmt.id}
                    className="p-2.5 rounded-lg bg-c-surface-raised dark:bg-c-surface"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full bg-c-surface dark:bg-c-surface-raised flex items-center justify-center">
                        <span className="text-[8px] font-bold text-c-text-secondary">
                          {(cmt.userName || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-c-text-secondary dark:text-c-text">
                        {cmt.userName || 'User'}
                      </span>
                      <span className="text-[9px] text-c-text-secondary">
                        {new Date(cmt.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-c-text-secondary dark:text-c-text leading-relaxed whitespace-pre-wrap">
                      {renderMentionText(cmt.text, mentionPool)}
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-1.5">
                  <div className="flex-1 relative">
                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                      <div
                        role="listbox"
                        aria-label={t(
                          'myWorkIdeas.nodeDetailDrawer.mentionTeammate',
                          'Mention a teammate'
                        )}
                        className="absolute bottom-full left-0 mb-1 w-64 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface shadow-lg max-h-40 overflow-y-auto z-overlay"
                      >
                        {mentionSuggestions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            role="option"
                            className="w-full text-left px-3 py-2 text-[11px] hover:bg-c-surface dark:hover:bg-c-surface-raised flex items-center gap-2"
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
                            <div className="h-6 w-6 rounded-full bg-c-surface dark:bg-c-surface-raised text-c-text-secondary flex items-center justify-center text-[9px] font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-c-text-secondary dark:text-c-text truncate">
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
                      placeholder={t('ideas.mindmap.addComment', 'Add comment... (@mention)')}
                      className="w-full text-[11px] bg-c-surface-raised dark:bg-c-surface rounded-lg pl-2.5 pr-6 py-2 border border-c-border-subtle dark:border-c-border-subtle outline-none text-c-text-secondary placeholder:text-c-text-muted resize-none"
                      rows={2}
                    />
                    <AtSign
                      size={10}
                      className="absolute right-2 bottom-2.5 text-c-text-secondary"
                    />
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || commentSubmitting}
                    className="p-2 rounded-lg text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-30"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </ToggleBlock>
          </div>
        )}

        {/* ── mindmap: AI expand into map ── */}
        {!isIdea && !isProtected && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-2">
              {t('ideas.mindmap.aiExpandTopic', 'AI: Expand Topic')}
            </div>
            <button
              onClick={handleAIExpandMindmap}
              disabled={locked || aiExpanding}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface dark:hover:bg-c-surface-raised transition-all disabled:opacity-40"
            >
              {aiExpanding ? (
                <Loader2 size={14} className="animate-spin text-c-text-secondary" />
              ) : (
                <Sparkles size={14} className="text-c-text-secondary" />
              )}
              <span className="text-[11px] font-bold text-c-text-secondary dark:text-c-text">
                {aiExpanding
                  ? t('ideas.mindmap.generatingIdeas', 'Generating ideas...')
                  : t(
                      'ideas.mindmap.generateSubIdeasThisTopic',
                      'Generate sub-ideas for this topic'
                    )}
              </span>
            </button>
            {aiSuggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                {aiSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-xl bg-c-surface dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
                  >
                    <Zap size={10} className="text-c-text-secondary shrink-0" />
                    <span className="text-[11px] text-c-text-secondary dark:text-c-text flex-1">
                      {s}
                    </span>
                    <button
                      onClick={() => handleApplyAISuggestion(s)}
                      className="text-[9px] font-bold text-c-text-secondary dark:text-c-text-muted hover:underline shrink-0"
                    >
                      {t('ideas.mindmap.add', 'Add')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── mindmap: Company Context ── */}
        {!isIdea && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.companyContext', 'Company Context')}
              badge={loadingContext ? '...' : String(companyContext.length)}
              defaultOpen={companyContext.length > 0}
              icon={<FileText size={14} />}
            >
              {loadingContext ? (
                <div className="flex items-center gap-2 py-4 justify-center text-[11px] text-c-text-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  {t('ideas.mindmap.findingConnections', 'Finding connections...')}
                </div>
              ) : companyContext.length === 0 ? (
                <EmptyStateInline
                  icon={FileText}
                  message={t(
                    'ideas.mindmap.noCompanyDataConnectionsFound',
                    'No company data connections found'
                  )}
                  dashed={false}
                  className="py-4"
                />
              ) : (
                <div className="space-y-1.5 mt-1">
                  {companyContext.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle"
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          {item.type === 'assessment' && (
                            <Target size={11} className="text-c-danger" />
                          )}
                          {item.type === 'interview' && (
                            <MessageSquare size={11} className="text-c-info" />
                          )}
                          {item.type === 'kpi' && <Zap size={11} className="text-c-success" />}
                          {item.type === 'initiative' && (
                            <Rocket size={11} className="text-c-warning" />
                          )}
                          {item.type === 'similar_idea' && (
                            <Lightbulb size={11} className="text-c-tag-3" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text leading-relaxed">
                            {item.title}
                          </div>
                          {item.detail && (
                            <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-0.5 leading-relaxed">
                              {item.detail}
                            </div>
                          )}
                          {item.confidence != null && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-8 h-1 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${item.confidence >= 0.7 ? 'bg-c-success' : item.confidence >= 0.4 ? 'bg-c-warning' : 'bg-c-danger'}`}
                                  style={{ width: `${Math.round(item.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-[8px] text-c-text-secondary">
                                {Math.round(item.confidence * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ToggleBlock>
          </div>
        )}

        {/* ── Related / Linked nodes ── */}
        {!isIdea && relatedNodes.length > 0 && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.relatedNodes', 'Related Nodes')}
              badge={String(relatedNodes.length)}
              defaultOpen
              icon={<Link2 size={14} />}
            >
              <div className="space-y-1 mt-1">
                {relatedNodes.map((rn) => (
                  <button
                    key={rn.id}
                    onClick={() => onNavigateToNode?.(rn.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                  >
                    <GitBranch size={10} className="text-c-text-secondary shrink-0" />
                    <span className="text-[11px] font-medium text-c-text-secondary dark:text-c-text truncate flex-1">
                      {rn.label}
                    </span>
                    <span className="text-[9px] text-c-text-secondary">{rn.branchKey}</span>
                    <ExternalLink size={10} className="text-c-text-secondary" />
                  </button>
                ))}
              </div>
            </ToggleBlock>
          </div>
        )}
        {isIdea && linkedNodeLabels.length > 0 && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <ToggleBlock
              title={t('ideas.mindmap.links', 'Links')}
              badge={String(linkedNodeLabels.length)}
              defaultOpen
              icon={<Link2 size={14} />}
            >
              <div className="space-y-1 mt-1">
                {linkedNodeLabels.map((ln) => (
                  <div
                    key={ln.id}
                    className="flex items-center gap-2 py-1 text-[10px] text-c-text-secondary dark:text-c-text"
                  >
                    <GitBranch size={10} className="text-c-text-secondary shrink-0" />
                    <span className="truncate">{ln.label}</span>
                  </div>
                ))}
              </div>
            </ToggleBlock>
          </div>
        )}

        {/* ── mindmap: Drill down ── */}
        {!isIdea && onDrillDown && !isProtected && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <button
              onClick={() => onDrillDown(nodeData.nodeId)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised transition-all"
            >
              <ChevronRight size={14} className="text-c-warning" />
              <span className="text-[11px] font-bold text-c-warning dark:text-c-warning">
                {t('ideas.mindmap.drillDownOpenSubMap', 'Drill down — open sub-map')}
              </span>
            </button>
          </div>
        )}

        {/* ── mindmap: Maturity callout ── */}
        {!isIdea && !isProtected && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <Callout
              variant={
                status === 'validated' || status === 'ready_to_convert'
                  ? 'success'
                  : status === 'exploring'
                    ? 'info'
                    : 'warning'
              }
              compact
              className="rounded-xl"
              title={t('ideas.mindmap.ideaMaturity', 'Idea Maturity')}
            >
              <div className="text-[10px] leading-relaxed">
                {status === 'idea' &&
                  t(
                    'ideas.mindmap.thisIdeaAtSparkStageAdd',
                    'This idea is at spark stage. Add notes and expand with AI.'
                  )}
                {status === 'exploring' &&
                  t(
                    'ideas.mindmap.explorationProgressLookEvidenceCompanyData',
                    'Exploration in progress. Look for evidence and company data connections.'
                  )}
                {status === 'validated' &&
                  t(
                    'ideas.mindmap.ideaValidatedConsiderConvertingInitiative',
                    'Idea validated. Consider converting to an initiative.'
                  )}
                {status === 'ready_to_convert' &&
                  t(
                    'ideas.mindmap.readyConvertClickButtonBelow',
                    'Ready to convert! Click the button below.'
                  )}
                {status === 'converted' &&
                  t(
                    'ideas.mindmap.thisIdeaHasAlreadyBeenConverted',
                    'This idea has already been converted.'
                  )}
              </div>
            </Callout>
          </div>
        )}

        {/* ── AI history ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.aiHistory', 'AI history')}
            badge={String(nodeData.aiExpansionHistory?.length || 0)}
            defaultOpen={(nodeData.aiExpansionHistory?.length || 0) > 0}
            icon={<TeresaMark size={14} />}
          >
            {nodeData.aiExpansionHistory?.length ? (
              <div className="space-y-2 mt-1">
                {nodeData.aiExpansionHistory.map((entry) => (
                  <div
                    key={`${entry.timestamp}-${entry.prompt}`}
                    className="rounded-xl border border-c-border-subtle dark:border-c-border-subtle px-3 py-2 bg-c-surface-raised dark:bg-c-surface"
                  >
                    <div className="text-[10px] text-c-text-secondary mb-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text">
                      {entry.resultSummary}
                    </div>
                    <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-1">
                      {entry.prompt}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStateInline
                icon={Bot}
                message={t('ideas.mindmap.noAppliedAiChangesYet', 'No applied AI changes yet')}
                dashed={false}
                className="py-4"
              />
            )}
          </ToggleBlock>
        </div>
      </div>

      {/* ── mindmap: Convert footer ── */}
      {!isIdea && !isProtected && status !== 'converted' && (
        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={() => onConvertNode?.(nodeData.nodeId, 'initiative')}
            disabled={locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-c-surface-raised text-c-warning dark:text-c-warning border border-c-warning transition-all disabled:opacity-40"
          >
            <Rocket size={12} />
            {t('ideas.mindmap.convertInitiative', 'Convert → Initiative')}
          </button>
          <button
            onClick={() => onConvertNode?.(nodeData.nodeId, 'decision')}
            disabled={locked}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-c-surface-raised text-c-info dark:text-c-info border border-c-info transition-all disabled:opacity-40"
          >
            <Star size={12} />
            {t('ideas.mindmap.decision', 'Decision')}
          </button>
        </div>
      )}

      <AddEvidenceModal
        open={showEvidenceModal}
        onClose={() => setShowEvidenceModal(false)}
        onAdd={handleAddEvidenceLink}
      />
    </div>
  );

  // IDE-025: ta sama treść, inne miejsce. Gdy slot panelu istnieje — portalujemy
  // tam; gdy go nie ma — zostaje dotychczasowa nakładka, więc treść nigdy nie
  // znika przez brak celu portalu.
  return zadokowany && slotPanelu ? createPortal(tresc, slotPanelu) : tresc;
};

// ── Depth field (mindmap collapse-when-empty style) ─────────────────────────────

const DepthField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (val: string) => void;
}> = ({ label, value, placeholder, disabled, onChange }) => {
  const [localVal, setLocalVal] = useState(value);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  if (!expanded && !localVal) {
    return (
      <div className="py-0.5">
        <button
          onClick={() => setExpanded(true)}
          className="text-[10px] font-semibold text-c-text-secondary hover:text-c-text dark:hover:text-c-text transition-colors"
        >
          + {label}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
        {label}
      </div>
      <textarea
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          if (localVal !== value) onChange(localVal);
        }}
        disabled={disabled}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus resize-none transition-all disabled:opacity-50"
      />
    </div>
  );
};

export default UnifiedNodeDetailDrawer;
