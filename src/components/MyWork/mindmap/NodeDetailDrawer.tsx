/**
 * NodeDetailDrawer — Slideout panel for deep-diving into a mind map node.
 *
 * Sections: Basic Info, Notes & Context, Tags & Classification,
 * Evidence & Artifacts, AI Expand, Company Context, Related Nodes.
 */
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  GitBranch,
  Hash,
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
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { Callout, EmptyStateInline, ToggleBlock } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import type { ArtifactLink } from '@/utils/artifactLinks';

import TeresaMark from '../../shared/TeresaMark';
import { EMPTY_SELECTION } from '../ideaSelectionTypes';
import { AddEvidenceModal } from './AddEvidenceModal';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeStatus = 'idea' | 'exploring' | 'validated' | 'ready_to_convert' | 'converted';

export interface NodeEvidenceLinkV5 {
  id: string;
  type: 'url' | 'artifact' | 'note';
  title: string;
  url?: string;
  artifactId?: string;
  addedAt?: string;
}

export interface AIExpansionEntryV5 {
  timestamp: string;
  prompt: string;
  resultSummary: string;
}

export interface NodeDetailData {
  nodeId: string;
  label: string;
  branchKey: string;
  sourceType?: string;
  nodeType?: string;
  priority?: number;
  notes?: string;
  status?: NodeStatus;
  votes?: number;
  assignee?: string;
  attachments?: Array<{ id: string; name: string; url?: string; type?: string }>;
  comments?: Array<{ id: string; author: string; text: string; createdAt: string }>;
  evidence?: Array<{
    id: string;
    type: string;
    title: string;
    detail?: string;
    source?: string;
    confidence?: number;
  }>;
  childNodeIds?: string[];
  parentNodeId?: string;

  // V5-IDEA-18: Node depth model
  context?: string;
  goal?: string;
  rationale?: string;
  riskNote?: string;
  tags?: string[];
  evidenceLinks?: NodeEvidenceLinkV5[];
  semanticType?: string;
  artifactLinks?: ArtifactLink[];
  aiExpansionHistory?: AIExpansionEntryV5[];
}

interface CompanyContextItem {
  id: string;
  type: 'assessment' | 'interview' | 'kpi' | 'initiative' | 'similar_idea';
  title: string;
  detail?: string;
  source?: string;
  confidence?: number;
}

interface NodeDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  nodeData: NodeDetailData | null;
  ideaId: string;
  ideaTitle: string;
  locked?: boolean;
  allNodes?: Array<{ id: string; data: any }>;
  allEdges?: Array<{ id: string; source: string; target: string }>;
  onUpdateNode: (nodeId: string, patch: Partial<NodeDetailData>) => void;
  onAIExpandNode: (nodeId: string) => void;
  onConvertNode: (nodeId: string, target: 'initiative' | 'decision') => void;
  onNavigateToNode: (nodeId: string) => void;
  onDrillDown?: (nodeId: string) => void;
}

const STATUS_CONFIG: Record<
  NodeStatus,
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
};

const STATUS_ORDER: NodeStatus[] = [
  'idea',
  'exploring',
  'validated',
  'ready_to_convert',
  'converted',
];

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

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  open,
  onClose,
  nodeData,
  ideaId,
  ideaTitle,
  locked = false,
  allNodes = [],
  allEdges = [],
  onUpdateNode,
  onAIExpandNode,
  onConvertNode,
  onNavigateToNode,
  onDrillDown,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<NodeStatus>('idea');
  const [companyContext, setCompanyContext] = useState<CompanyContextItem[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [aiExpanding, setAiExpanding] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Sync local state when node changes
  useEffect(() => {
    if (nodeData) {
      setNotes(nodeData.notes || '');
      setStatus(nodeData.status || 'idea');
      setAiSuggestions([]);
      setTagInput('');
    }
  }, [nodeData?.nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch company context for this node
  useEffect(() => {
    if (!open || !nodeData || !ideaId) return;
    let cancelled = false;
    setLoadingContext(true);
    (async () => {
      try {
        const res = await Api.getMyIdeaAISuggestions(ideaId, {
          seedText: `${ideaTitle}: ${nodeData.label}`,
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

  const handleNotesBlur = useCallback(() => {
    if (!nodeData || locked) return;
    onUpdateNode(nodeData.nodeId, { notes });
  }, [locked, nodeData, notes, onUpdateNode]);

  const handleStatusChange = useCallback(
    (newStatus: NodeStatus) => {
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

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);

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
        } as NodeEvidenceLinkV5,
      ];
      onUpdateNode(nodeData.nodeId, { evidenceLinks: nextEvidence });
    },
    [locked, nodeData, onUpdateNode]
  );

  const handleAIExpand = useCallback(async () => {
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

  // Related nodes
  const relatedNodes = useMemo(() => {
    if (!nodeData) return [];
    const childIds = allEdges.filter((e) => e.source === nodeData.nodeId).map((e) => e.target);
    const parentIds = allEdges.filter((e) => e.target === nodeData.nodeId).map((e) => e.source);
    const relatedIds = new Set([...childIds, ...parentIds]);
    return allNodes
      .filter((n) => relatedIds.has(n.id) && n.id !== 'root')
      .map((n) => ({ id: n.id, label: n.data?.label || n.id, branchKey: n.data?.branchKey }));
  }, [allEdges, allNodes, nodeData]);

  if (!open || !nodeData) return null;

  const isProtected = nodeData.nodeId === 'root' || nodeData.nodeId.startsWith('branch-');
  const isAI =
    nodeData.sourceType === 'ai_chat' ||
    nodeData.sourceType === 'ai_hint' ||
    nodeData.sourceType === 'ai_suggestion';

  return (
    <div className="fixed top-0 right-0 bottom-0 z-modal w-[420px] max-w-[90vw] bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border-l border-c-border-subtle dark:border-c-border-subtle shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isAI ? (
              <TeresaMark size={14} className="text-c-info shrink-0" />
            ) : (
              <Lightbulb size={14} className="text-c-warning shrink-0" />
            )}
            <h3 className="text-sm font-bold text-c-text dark:text-c-text truncate">
              {nodeData.label || '...'}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-c-text-secondary dark:text-c-text-muted">
            <span className="inline-flex items-center gap-1">
              <GitBranch size={10} />
              {nodeData.branchKey}
            </span>
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Section 1: Basic Info (Status + Semantic Type) ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.basicInfo', 'Basic Info')}
            icon={<Info size={14} />}
            defaultOpen
          >
            <div className="space-y-3 mt-2">
              {/* Status Flow */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                  Status
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {STATUS_ORDER.map((s, idx) => {
                    const cfg = STATUS_CONFIG[s];
                    const isActive = s === status;
                    const isPast = STATUS_ORDER.indexOf(status) > idx;
                    return (
                      <React.Fragment key={s}>
                        {idx > 0 && (
                          <div
                            className={`w-3 h-0.5 rounded-full ${isPast || isActive ? 'bg-c-success' : 'bg-c-surface-raised dark:bg-c-surface'}`}
                          />
                        )}
                        <button
                          onClick={() => handleStatusChange(s)}
                          disabled={locked || isProtected}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                            isActive
                              ? cfg.color + ' ring-1 ring-current/20 shadow-sm'
                              : isPast
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

              {/* Semantic Type — dropdown */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-1.5">
                  {t('ideas.mindmap.semanticType', 'Semantic Type')}
                </div>
                <select
                  value={nodeData?.semanticType || ''}
                  onChange={(e) =>
                    nodeData && onUpdateNode(nodeData.nodeId, { semanticType: e.target.value })
                  }
                  disabled={locked || isProtected}
                  className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text focus:outline-none focus:ring-2 focus:ring-c-warning transition-all disabled:opacity-50"
                >
                  {SEMANTIC_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(`myWorkMindmap.semanticOption.${opt.value || 'none'}`, opt.labelEn)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ToggleBlock>
        </div>

        {/* ── Section 2: Notes & Context ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.notesContext', 'Notes & Context')}
            icon={<StickyNote size={14} />}
            badge={
              [
                notes,
                nodeData?.context,
                nodeData?.goal,
                nodeData?.rationale,
                nodeData?.riskNote,
              ].filter(Boolean).length > 0
                ? String(
                    [
                      notes,
                      nodeData?.context,
                      nodeData?.goal,
                      nodeData?.rationale,
                      nodeData?.riskNote,
                    ].filter(Boolean).length
                  )
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
                  disabled={locked || isProtected}
                  rows={3}
                  placeholder={t('ideas.mindmap.addNotesDetails', 'Add notes, details...')}
                  className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-warning resize-none transition-all disabled:opacity-50"
                />
              </div>
              <DepthField
                label={t('ideas.mindmap.context', 'Context')}
                value={nodeData?.context || ''}
                placeholder={t('ideas.mindmap.whatContext', 'What is the context?')}
                disabled={locked || isProtected}
                onChange={(val) => nodeData && onUpdateNode(nodeData.nodeId, { context: val })}
              />
              <DepthField
                label={t('ideas.mindmap.goal', 'Goal')}
                value={nodeData?.goal || ''}
                placeholder={t('ideas.mindmap.whatGoal', 'What is the goal?')}
                disabled={locked || isProtected}
                onChange={(val) => nodeData && onUpdateNode(nodeData.nodeId, { goal: val })}
              />
              <DepthField
                label={t('ideas.mindmap.rationale', 'Rationale')}
                value={nodeData?.rationale || ''}
                placeholder={t('ideas.mindmap.whyThisImportant', 'Why is this important?')}
                disabled={locked || isProtected}
                onChange={(val) => nodeData && onUpdateNode(nodeData.nodeId, { rationale: val })}
              />
              <DepthField
                label={t('ideas.mindmap.risk', 'Risk')}
                value={nodeData?.riskNote || ''}
                placeholder={t('ideas.mindmap.whatRisks', 'What are the risks?')}
                disabled={locked || isProtected}
                onChange={(val) => nodeData && onUpdateNode(nodeData.nodeId, { riskNote: val })}
              />
            </div>
          </ToggleBlock>
        </div>

        {/* ── Section 3: Tags & Classification ── */}
        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.tagsClassification', 'Tags & Classification')}
            icon={<Tag size={14} />}
            badge={(nodeData.tags?.length || 0) > 0 ? String(nodeData.tags!.length) : undefined}
            defaultOpen={(nodeData.tags?.length || 0) > 0}
          >
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(nodeData.tags || []).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={locked || isProtected}
                    onClick={() => handleRemoveTag(tag)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised hover:text-c-danger dark:hover:bg-c-surface dark:hover:text-c-danger transition-colors disabled:opacity-50"
                  >
                    <Hash size={9} className="shrink-0" />
                    <span>{tag}</span>
                    <X size={9} className="text-c-text-secondary shrink-0" />
                  </button>
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
                  disabled={locked || isProtected}
                  placeholder={t('ideas.mindmap.addTag', 'Add tag...')}
                  className="flex-1 px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-warning"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={locked || isProtected || !tagInput.trim()}
                  className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text disabled:opacity-40 hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </ToggleBlock>
        </div>

        {/* ── Section 4: Evidence & Artifacts ── */}
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
                    className={`rounded-xl border border-c-border-subtle dark:border-c-border-subtle px-3 py-2 bg-c-surface-raised dark:bg-c-surface flex items-center gap-2 ${isClickable ? 'cursor-pointer hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors' : ''}`}
                    onClick={() => {
                      if (isUrl) {
                        window.open(item.url!, '_blank', 'noopener,noreferrer');
                      } else if (isArtifact) {
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: { type: 'artifact', id: item.artifactId, name: item.title },
                          })
                        );
                      }
                    }}
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
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setShowEvidenceModal(true)}
                disabled={locked || isProtected}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text disabled:opacity-40 hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
              >
                <Plus size={12} />
                {t('ideas.mindmap.addEvidence', 'Add evidence')}
              </button>
            </div>
          </ToggleBlock>
        </div>

        <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
          <ToggleBlock
            title={t('ideas.mindmap.linkedArtifacts', 'Linked artifacts')}
            badge={String(nodeData.artifactLinks?.length || 0)}
            defaultOpen={(nodeData.artifactLinks?.length || 0) > 0}
            icon={<Paperclip size={14} />}
          >
            {nodeData.artifactLinks?.length ? (
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

        {/* AI: Expand this topic */}
        {!isProtected && (
          <div className="px-5 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-2">
              {t('ideas.mindmap.aiExpandTopic', 'AI: Expand Topic')}
            </div>
            <button
              onClick={handleAIExpand}
              disabled={locked || aiExpanding}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface hover:bg-c-surface-raised dark:hover:bg-c-surface transition-all disabled:opacity-40"
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
                      onClick={() => {
                        // `idea.node.mm_apply_ai_suggestion` (ideaActionRegistry.ts,
                        // closure 2026-08-10) — routes the SAME closure through
                        // the registry so the id is a real, connected entry
                        // point, not a documented-but-orphaned one.
                        const actionCtx: ActionContext = {
                          ideaId,
                          tool: 'mindmap',
                          selection: EMPTY_SELECTION,
                          surface: 'panel',
                          source: 'ui',
                          params: { run: () => handleApplyAISuggestion(s) },
                        };
                        void runIdeaAction('idea.node.mm_apply_ai_suggestion', actionCtx);
                      }}
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

        {/* Company Context */}
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

        {/* Related Nodes */}
        {relatedNodes.length > 0 && (
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
                    onClick={() => onNavigateToNode(rn.id)}
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

        {/* Drill Down */}
        {onDrillDown && !isProtected && (
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

        {/* Evidence / Maturity hint */}
        {!isProtected && (
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

      {/* Footer: Convert */}
      {!isProtected && status !== 'converted' && (
        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={() => onConvertNode(nodeData.nodeId, 'initiative')}
            disabled={locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-c-surface-raised text-c-warning dark:text-c-warning border border-c-warning transition-all disabled:opacity-40"
          >
            <Rocket size={12} />
            {t('ideas.mindmap.convertInitiative', 'Convert → Initiative')}
          </button>
          <button
            onClick={() => onConvertNode(nodeData.nodeId, 'decision')}
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
};

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
        className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-xs text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-warning resize-none transition-all disabled:opacity-50"
      />
    </div>
  );
};

export default NodeDetailDrawer;
