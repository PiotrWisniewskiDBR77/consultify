/**
 * IdeaMapWorkspace — fullscreen workspace for editing an idea.
 *
 * Unified toolbar (Menu 2i) merges canvas tool selector + panel strip.
 * Selection contract drives Tools panel content.
 * Propose→Accept UX for AI patches.
 */
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import { CommandPalette, useCommandPalette } from './CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import { IdeaContextPanel } from './IdeaContextPanel';
import {
  composeIdeaBodyFromSeedIntent,
  deriveIdeaTitleFromSeedIntent,
  type IdeaWorkspaceCreationPayload,
  type IdeaWorkspaceSeedIntent,
  IDEA_STAGE_LABELS,
  normalizePreferredSystem,
  normalizeStageToV5,
} from './ideaEntryTypes';
import { IdeaGhostCards } from './IdeaGhostCards';
import { type ExtendedNodeData, IdeaNodeDetailDrawer } from './IdeaNodeDetailDrawer';
import { IdeaPinnedCard, type IdeaPinnedCardData } from './IdeaPinnedCard';
import { IdeaProcessFlowTool } from './IdeaProcessFlowTool';
import { IdeaProposalReview } from './IdeaProposalReview';
import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import type { CanvasToolType } from './ideaSelectionTypes';
import {
  type AIProposal,
  type AIProposalBatch,
  EMPTY_SELECTION,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { IdeaTableTool } from './IdeaTableTool';
import { IdeaTemplateGallery } from './IdeaTemplateGallery';
import { IdeaUnifiedSearch } from './IdeaUnifiedSearch';
import { IdeaVotingMode } from './IdeaVotingMode';
import { IdeaWhiteboardTool } from './IdeaWhiteboardTool';
import { IdeaWorkspaceToolbar } from './IdeaWorkspaceToolbar';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
import type { MyIdea } from './MyIdeasListContent';
import { ArtifactAttachPopover } from '../shared/NModeBlocks/ArtifactAttachPopover';
import type { ArtifactLinkRole, ArtifactType } from '../../utils/artifactLinks';
import { buildAskAIMessage } from './shared/askAiHelper';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { countNodesByFamily, type ObjectFamily } from './superCanvasTypes';

class CanvasToolErrorBoundary extends React.Component<
  { children: React.ReactNode; toolName: string; onRetry?: () => void },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[CanvasToolErrorBoundary] ${this.props.toolName} crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-navy-950 p-8">
          <div className="p-3 rounded-2xl bg-red-500/10">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {this.props.toolName} failed to load
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
          </div>
          {this.props.onRetry && (
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry?.();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

type IdeaMapWorkspaceProps = {
  ideaId: string;
  initialOpenMap?: boolean;
  creationPayload?: IdeaWorkspaceCreationPayload;
  seedIntent?: IdeaWorkspaceSeedIntent;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
  toolsOpen?: boolean;
  onToolsOpenChange?: (open: boolean) => void;
  initialTool?: CanvasToolType;
  initialFocusNode?: string;
  activeTool?: CanvasToolType;
  onActiveToolChange?: (tool: CanvasToolType) => void;
  activePanel?: WorkspacePanelKey;
  onActivePanelChange?: (panel: WorkspacePanelKey) => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onQuickAction?: (action: string) => void;
  onLockedChange?: (locked: boolean) => void;
};

type IdeaConvertTarget =
  | 'initiative'
  | 'task_set'
  | 'decision'
  | 'team_chat'
  | 'report'
  | 'presentation'
  | 'action_plan'
  | 'raid_log'
  | 'financial_model'
  | 'budget'
  | 'valuation'
  | 'analysis';

function safeTitleFromSeed(seedText: string, isPolish: boolean): string {
  const firstLine = String(seedText || '')
    .trim()
    .split('\n')[0]
    ?.trim();
  return firstLine ? firstLine.slice(0, 120) : isPolish ? 'Nowe wyzwanie' : 'New challenge';
}

function buildStartupExtensions(
  seedIntent?: IdeaWorkspaceSeedIntent,
  creationPayload?: IdeaWorkspaceCreationPayload
) {
  if (!seedIntent && !creationPayload) return {};

  return {
    startup: {
      source: seedIntent?.source || creationPayload?.sourceType || 'manual',
      startMode: seedIntent?.startMode || null,
      preferredSystem: normalizePreferredSystem(seedIntent?.preferredSystem) || null,
      templateId: seedIntent?.templateId || null,
      popularStartId: seedIntent?.popularStartId || null,
      popularStartLabel: seedIntent?.popularStartLabel || null,
      structuredBrief: seedIntent?.structuredBrief || null,
      sourceConversationId: creationPayload?.sourceConversationId || null,
      sourceMessageId: creationPayload?.sourceMessageId || null,
    },
  };
}

export const IdeaMapWorkspace: React.FC<IdeaMapWorkspaceProps> = ({
  ideaId,
  initialOpenMap,
  creationPayload,
  seedIntent,
  onClose,
  onSaved,
  toolsOpen: toolsOpenProp,
  onToolsOpenChange,
  initialTool,
  initialFocusNode,
  activeTool: externalActiveTool,
  onActiveToolChange,
  activePanel: externalActivePanel,
  onActivePanelChange,
  onSelectionChange: externalOnSelectionChange,
  onQuickAction: externalOnQuickAction,
  onLockedChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isNewInitial = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [realId, setRealId] = useState(ideaId);
  const [title, setTitle] = useState('');
  const [seedText, setSeedText] = useState('');
  const [stage, setStage] = useState<string>('seed');
  const [branch, setBranch] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [priority, setPriority] = useState<number>(50);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [mapOpen, setMapOpen] = useState(Boolean(initialOpenMap));
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [graphLanes, setGraphLanes] = useState<any[]>([]);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [nodeDetailOpen, setNodeDetailOpen] = useState(false);
  const [nodeDetailId, setNodeDetailId] = useState<string>('');
  const [nodeDetailData, setNodeDetailData] = useState<ExtendedNodeData>({ label: '' });
  const [drillDownStack, setDrillDownStack] = useState<Array<{ nodeId: string; label: string }>>(
    []
  );
  const [votingActive, setVotingActive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinnedCardVisible, setPinnedCardVisible] = useState(true);
  const [pinnedCardData, setPinnedCardData] = useState<IdeaPinnedCardData>({ title: '' });

  // V5-IDEA-15: Focus modes
  type FocusMode = 'full' | 'system' | 'object';
  const [focusMode, setFocusMode] = useState<FocusMode>('full');
  const [focusObjectId, setFocusObjectId] = useState<string | null>(null);
  const toolFocusMode = focusMode === 'full' ? null : focusMode;

  const cmdPalette = useCommandPalette();

  // V51-30: Artifact attach popover state
  const [artifactPopoverOpen, setArtifactPopoverOpen] = useState(false);
  const [artifactSearchResults, setArtifactSearchResults] = useState<
    Array<{ type: ArtifactType; id: string; title: string; status?: string; owner?: string }>
  >([]);

  const [internalActiveTool, setInternalActiveTool] = useState<CanvasToolType>(
    initialTool || 'mindmap'
  );
  const [internalActivePanel, setInternalActivePanel] = useState<WorkspacePanelKey>(
    toolsOpenProp ? 'tools' : null
  );
  const [mapRefreshToken, setMapRefreshToken] = useState(0);
  const userSelectedToolRef = React.useRef(false);
  const aiKickoffTriggeredRef = React.useRef(false);

  const activeTool = externalActiveTool ?? internalActiveTool;
  const activePanel = externalActivePanel ?? internalActivePanel;

  const setActiveTool = useCallback(
    (tool: CanvasToolType) => {
      if (onActiveToolChange) onActiveToolChange(tool);
      else setInternalActiveTool(tool);
    },
    [onActiveToolChange]
  );

  const setActivePanel = useCallback(
    (panel: WorkspacePanelKey) => {
      if (onActivePanelChange) onActivePanelChange(panel);
      else setInternalActivePanel(panel);
    },
    [onActivePanelChange]
  );

  const prevToolRef = React.useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      trackFunnelEvent('ideas_tool_switched', {
        from: prevToolRef.current,
        to: activeTool,
        ideaId: realId,
      });
      userSelectedToolRef.current = true;
      prevToolRef.current = activeTool;
    }
  }, [activeTool, realId]);

  // ── Selection contract ──────────────────────────────────────────────────────
  const [selection, setSelection] = useState<IdeaWorkspaceSelection>(EMPTY_SELECTION);

  const handleSelectionChange = useCallback(
    (next: IdeaWorkspaceSelection) => {
      setSelection(next);
      externalOnSelectionChange?.(next);
      if (next.type !== 'none') {
        trackFunnelEvent('ideas_selection_changed', {
          tool: activeTool,
          selectionType: next.type,
          count: next.count,
        });
      }
    },
    [activeTool, externalOnSelectionChange]
  );

  // ── AI Proposals (Propose→Accept) ──────────────────────────────────────────
  const [proposalBatch, setProposalBatch] = useState<AIProposalBatch | null>(null);

  const applyProposalPatches = useCallback(
    async (proposals: AIProposal[]) => {
      const accepted = proposals.filter((p) => p.status === 'accepted');
      if (accepted.length === 0) return;
      try {
        const mapRes = await Api.getMyIdeaMap(realId, { language: i18n.language });
        const map = mapRes?.map || {};
        let nodes: any[] = Array.isArray(map.nodes) ? [...map.nodes] : [];
        let edges: any[] = Array.isArray(map.edges) ? [...map.edges] : [];
        const extensions: Record<string, unknown> =
          map?.extensions && typeof map.extensions === 'object' && !Array.isArray(map.extensions)
            ? { ...map.extensions }
            : {};

        for (const proposal of accepted) {
          const patch = proposal.patch;
          if (!patch) continue;

          if (patch.removeNodeIds?.length) {
            const removeSet = new Set(patch.removeNodeIds);
            nodes = nodes.filter((n: any) => !removeSet.has(String(n?.id)));
          }
          if (patch.removeEdgeIds?.length) {
            const removeSet = new Set(patch.removeEdgeIds);
            edges = edges.filter((e: any) => !removeSet.has(String(e?.id)));
          }
          if (patch.addNodes?.length) {
            for (const n of patch.addNodes) {
              nodes.push({
                id: n.id,
                type: n.type || 'idea',
                data: { label: n.label, ...n.data },
                position: n.position || { x: 0, y: 0 },
              });
            }
          }
          if (patch.addEdges?.length) {
            for (const e of patch.addEdges) {
              edges.push({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'default',
                data: { label: e.label, ...e.data },
              });
            }
          }
          if (patch.updateNodes?.length) {
            for (const upd of patch.updateNodes) {
              nodes = nodes.map((n: any) =>
                String(n?.id) === upd.id ? { ...n, data: { ...(n.data || {}), ...upd.data } } : n
              );
            }
          }
          if (patch.moveNodes?.length) {
            for (const mv of patch.moveNodes) {
              nodes = nodes.map((n: any) =>
                String(n?.id) === mv.nodeId
                  ? {
                      ...n,
                      parentNode: mv.parentId,
                      parentId: mv.parentId,
                      position: mv.position || n.position,
                      data: { ...(n.data || {}), parentId: mv.parentId },
                    }
                  : n
              );
            }
          }
          if (patch.extensions && typeof patch.extensions === 'object') {
            for (const [key, val] of Object.entries(patch.extensions)) {
              const existing = extensions[key];
              if (
                existing &&
                typeof existing === 'object' &&
                typeof val === 'object' &&
                val &&
                !Array.isArray(val)
              ) {
                extensions[key] = {
                  ...(existing as Record<string, unknown>),
                  ...(val as Record<string, unknown>),
                };
              } else {
                extensions[key] = val;
              }
            }
          }
        }

        await Api.saveMyIdeaMap(realId, { nodes, edges, extensions, fromAI: true });
        setGraphNodes(nodes);
        setGraphEdges(edges);
        if (
          extensions?.processFlow &&
          typeof extensions.processFlow === 'object' &&
          Array.isArray((extensions.processFlow as any)?.lanes)
        ) {
          setGraphLanes((extensions.processFlow as any).lanes);
        }
        window.dispatchEvent(
          new CustomEvent('idea-workspace-graph-update', {
            detail: { ideaId: realId, nodes, edges, extensions },
          })
        );
        setMapRefreshToken((v) => v + 1);
        toast.success(
          isPolish
            ? `Zaakceptowano ${accepted.length} propozycji`
            : `Accepted ${accepted.length} proposal${accepted.length > 1 ? 's' : ''}`
        );
      } catch (err: any) {
        toast.error(
          err?.message || (isPolish ? 'Nie udało się zastosować zmian' : 'Failed to apply changes')
        );
      }
    },
    [i18n.language, isPolish, realId]
  );

  const handleAcceptProposal = useCallback(
    (proposalId: string) => {
      if (!proposalBatch) return;
      const updated = {
        ...proposalBatch,
        proposals: proposalBatch.proposals.map((p) =>
          p.id === proposalId ? { ...p, status: 'accepted' as const } : p
        ),
      };
      setProposalBatch(updated);
      const accepted = updated.proposals.filter(
        (p) => p.id === proposalId && p.status === 'accepted'
      );
      applyProposalPatches(accepted);
    },
    [proposalBatch, applyProposalPatches]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      if (!proposalBatch) return;
      setProposalBatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          proposals: prev.proposals.map((p) =>
            p.id === proposalId ? { ...p, status: 'rejected' as const } : p
          ),
        };
      });
    },
    [proposalBatch]
  );

  const handleAcceptAllProposals = useCallback(() => {
    if (!proposalBatch) return;
    const updated = {
      ...proposalBatch,
      proposals: proposalBatch.proposals.map((p) =>
        p.status === 'pending' ? { ...p, status: 'accepted' as const } : p
      ),
    };
    setProposalBatch(updated);
    applyProposalPatches(updated.proposals);
  }, [proposalBatch, applyProposalPatches]);

  const handleRejectAllProposals = useCallback(() => {
    setProposalBatch((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        proposals: prev.proposals.map((p) =>
          p.status === 'pending' ? { ...p, status: 'rejected' as const } : p
        ),
      };
    });
  }, []);

  // ── Quick tool actions ──────────────────────────────────────────────────────
  const handleConvertRef = useRef<(target: IdeaConvertTarget) => void>(() => {});

  const handleQuickAction = useCallback(
    (action: string) => {
      // V5-IDEA-26: Cross-system transforms
      const XFORM_MAP: Record<string, CanvasToolType> = {
        xform_to_mindmap: 'mindmap',
        xform_to_whiteboard: 'whiteboard',
        xform_to_flow: 'process_flow',
        xform_to_table: 'table',
      };
      if (XFORM_MAP[action]) {
        const targetTool = XFORM_MAP[action];
        trackFunnelEvent('ideas_cross_system_transform', {
          from: activeTool,
          to: targetTool,
          action,
        });
        toast.success(
          isPolish
            ? `Przekształcanie zaznaczenia do: ${targetTool}`
            : `Transforming selection to: ${targetTool}`,
          { duration: 1200 }
        );
        setActiveTool(targetTool);
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: { action: `${action}_execute`, ideaId: realId, sourceTool: activeTool },
            })
          );
        }, 300);
        return;
      }

      // V51-30: Attach artifact — open real popover
      if (action === 'attach_artifact') {
        trackFunnelEvent('ideas_attach_artifact', { tool: activeTool });
        if (selection.type === 'none' || !selection.ids?.length) {
          toast(
            isPolish
              ? 'Najpierw zaznacz obiekt na canvasie'
              : 'Select an object on the canvas first',
            { icon: '🔗', duration: 2000 }
          );
          return;
        }
        setArtifactPopoverOpen(true);
        return;
      }
      // V51-30: Open linked artifacts — switch to context panel
      if (action === 'open_linked_artifacts') {
        trackFunnelEvent('ideas_open_linked', { tool: activeTool });
        setActivePanel('context');
        return;
      }

      // V5-IDEA-38: Convert selection from any system
      const CONVERT_PREFIX_MAP: Record<string, IdeaConvertTarget> = {
        convert_initiative: 'initiative',
        convert_task_set: 'task_set',
        convert_decision: 'decision',
        convert_report: 'report',
        convert_presentation: 'presentation',
        wb_convert_initiative: 'initiative',
        wb_convert_task_set: 'task_set',
        wb_convert_report: 'report',
        pf_convert_initiative: 'initiative',
        pf_convert_task_set: 'task_set',
        pf_convert_report: 'report',
        pf_convert_analysis: 'analysis',
        tbl_convert_initiative: 'initiative',
        tbl_convert_task_set: 'task_set',
        tbl_convert_presentation: 'presentation',
      };
      if (CONVERT_PREFIX_MAP[action]) {
        const target = CONVERT_PREFIX_MAP[action];
        trackFunnelEvent('ideas_convert_selection', { tool: activeTool, target, action });
        handleConvertRef.current(target);
        return;
      }

      trackFunnelEvent('ideas_quick_tool_used', { tool: activeTool, action });
      externalOnQuickAction?.(action);
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', { detail: { action, ideaId: realId } })
      );
    },
    [activeTool, externalOnQuickAction, isPolish, realId, setActiveTool]
  );

  // ── Panel management ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof toolsOpenProp !== 'boolean') return;
    if (toolsOpenProp) {
      setActivePanel('tools');
      return;
    }
    if (activePanel === 'tools') {
      setActivePanel(null);
    }
    // activePanel intentionally excluded to avoid infinite loop
  }, [toolsOpenProp, setActivePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePanelChange = useCallback(
    (next: WorkspacePanelKey) => {
      setActivePanel(next);
      onToolsOpenChange?.(next === 'tools');
    },
    [onToolsOpenChange]
  );

  const toolsPanelOpen = activePanel === 'tools';
  const contextPanelOpen = activePanel === 'context';
  const aiPanelOpen = activePanel === 'ai_suggestions';

  const isDraft = useMemo(() => isNewInitial && realId === ideaId, [ideaId, isNewInitial, realId]);
  const preferredSeedSystem = useMemo(
    () => normalizePreferredSystem(seedIntent?.preferredSystem),
    [seedIntent?.preferredSystem]
  );
  const initialIdeaBody = useMemo(
    () =>
      typeof creationPayload?.body === 'string'
        ? creationPayload.body
        : composeIdeaBodyFromSeedIntent(seedIntent),
    [creationPayload?.body, seedIntent]
  );
  const initialIdeaTitle = useMemo(
    () =>
      String(
        creationPayload?.title ||
          deriveIdeaTitleFromSeedIntent(seedIntent, isPolish ? 'Nowe wyzwanie' : 'New challenge')
      ).trim(),
    [creationPayload?.title, isPolish, seedIntent]
  );
  const isAccepted = useMemo(() => {
    const v5 = normalizeStageToV5(stage);
    return v5 !== 'spark';
  }, [stage]);

  useEffect(() => {
    onLockedChange?.(!isAccepted);
  }, [isAccepted, onLockedChange]);

  // ── Hydrate ─────────────────────────────────────────────────────────────────
  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      if (isNewInitial) {
        const created = await Api.createMyIdea({
          title: initialIdeaTitle || (isPolish ? 'Nowe wyzwanie' : 'New challenge'),
          body: initialIdeaBody,
          tags: creationPayload?.tags || [],
          sourceType: creationPayload?.sourceType || 'manual',
          sourceConversationId: creationPayload?.sourceConversationId || null,
          sourceMessageId: creationPayload?.sourceMessageId || null,
        });
        const nextId = String(created?.id || ideaId);
        setRealId(nextId);
        setTitle(
          String(
            created?.title || initialIdeaTitle || (isPolish ? 'Nowe wyzwanie' : 'New challenge')
          )
        );
        setSeedText(
          String(created?.seed_text || created?.seedText || created?.body || initialIdeaBody || '')
        );
        setStage(String(created?.stage || 'seed'));
        setBranch(String(created?.branch || ''));
        setArea(String(created?.area || ''));
        setPriority(Number.isFinite(Number(created?.priority)) ? Number(created.priority) : 50);
        onSaved(created as MyIdea);
        setDirty(true);

        if (preferredSeedSystem && !initialTool && !userSelectedToolRef.current) {
          setActiveTool(preferredSeedSystem);
        }

        try {
          const res = await Api.getMyIdeaMap(nextId, { language: i18n.language });
          const map = res?.map || {};
          const nodes = Array.isArray(map.nodes) ? map.nodes : [];
          const edges = Array.isArray(map.edges) ? map.edges : [];
          await Api.saveMyIdeaMap(nextId, {
            nodes,
            edges,
            preferredTool: preferredSeedSystem || undefined,
            extensions: buildStartupExtensions(seedIntent, creationPayload),
          });
        } catch {
          /* best-effort */
        }
      } else {
        const idea = (await Api.getMyIdea(ideaId)) as any;
        setRealId(String(idea?.id || ideaId));
        setTitle(String(idea?.title || ''));
        setSeedText(String(idea?.seed_text || idea?.seedText || idea?.body || ''));
        setStage(String(idea?.stage || 'seed'));
        setBranch(String(idea?.branch || ''));
        setArea(String(idea?.area || ''));
        setPriority(Number.isFinite(Number(idea?.priority)) ? Number(idea.priority) : 50);
        setDirty(false);
        setLastSavedAt(idea?.updatedAt ? new Date(idea.updatedAt).getTime() : null);

        try {
          const mapRes = await Api.getMyIdeaMap(String(idea?.id || ideaId), {
            language: i18n.language,
          });
          const savedPref = mapRes?.map?.preferredTool ? String(mapRes.map.preferredTool) : null;
          if (
            !initialTool &&
            savedPref &&
            ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(savedPref) &&
            !userSelectedToolRef.current
          ) {
            setActiveTool(savedPref as CanvasToolType);
          }

          // V5-IDEA-16: Restore surface state
          const ss = mapRes?.map?.extensions?.surfaceState;
          if (ss && typeof ss === 'object') {
            const ssObj = ss as Record<string, unknown>;
            if (
              ssObj.activeTool &&
              typeof ssObj.activeTool === 'string' &&
              ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(ssObj.activeTool) &&
              !initialTool &&
              !userSelectedToolRef.current
            ) {
              setActiveTool(ssObj.activeTool as CanvasToolType);
            }
            if (ssObj.focusMode === 'system' || ssObj.focusMode === 'object') {
              setFocusMode(ssObj.focusMode as 'system' | 'object');
            }
            if (typeof ssObj.focusObjectId === 'string') {
              setFocusObjectId(ssObj.focusObjectId);
            }
            if (ssObj.viewport && typeof ssObj.viewport === 'object') {
              lastViewportRef.current = ssObj.viewport as {
                x: number;
                y: number;
                zoom: number;
              };
            }
          }
        } catch {
          /* best-effort — default to mindmap */
        }
      }
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się wczytać' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [
    creationPayload,
    i18n.language,
    ideaId,
    initialIdeaBody,
    initialIdeaTitle,
    initialTool,
    isNewInitial,
    isPolish,
    onSaved,
    preferredSeedSystem,
    seedIntent,
    setActiveTool,
  ]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ── URL deep link support ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    if (toolParam && ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(toolParam)) {
      setActiveTool(toolParam as CanvasToolType);
      userSelectedToolRef.current = true;
    }
  }, [setActiveTool]);

  // ── V4-IDEA-07: Keyboard shortcuts ─────────────────────────────────────────
  const { showHelp: shortcutsHelpOpen, setShowHelp: setShortcutsHelpOpen } = useKeyboardShortcuts({
    enabled: !loading,
    onCancel: () => {
      if (nodeDetailOpen) setNodeDetailOpen(false);
      else if (templateGalleryOpen) setTemplateGalleryOpen(false);
      else if (searchOpen) setSearchOpen(false);
      else if (votingActive) setVotingActive(false);
      else if (focusMode !== 'full') handleExitFocus();
    },
    onSlashCommand: () => setSearchOpen(true),
    onAddChild: () => handleQuickAction('mm_add_child'),
    onAddSibling: () => handleQuickAction('mm_add_sibling'),
    onGroup: () => handleQuickAction('group'),
    onAIExpand: () => handleQuickAction('mm_ai_expand_branch'),
    onToggleCollapse: () => handleQuickAction('mm_toggle_collapse'),
    onFocusSelection: () => handleQuickAction('mm_focus_selected'),
    onReparentPromote: () => handleQuickAction('mm_reparent_promote'),
    onReparentDemote: () => handleQuickAction('mm_reparent_demote'),
    onSelectAll: () => handleQuickAction('selectAll'),
    onClearSelection: () => handleQuickAction('clearSelection'),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchHighlight = useCallback(
    (nodeId: string) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-highlight-node', { detail: { nodeId, ideaId: realId } })
      );
    },
    [realId]
  );

  // ── Graph data sync (for AI panels) ────────────────────────────────────────
  useEffect(() => {
    if (!realId || loading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await Api.getMyIdeaMap(realId, { language: i18n.language });
        if (cancelled) return;
        const map = res?.map || {};
        setGraphNodes(Array.isArray(map.nodes) ? map.nodes : []);
        setGraphEdges(Array.isArray(map.edges) ? map.edges : []);
        const ext = map?.extensions?.processFlow;
        if (ext && Array.isArray((ext as any)?.lanes)) {
          setGraphLanes((ext as any).lanes);
        }
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [realId, mapRefreshToken, i18n.language, loading]);

  // ── V5-IDEA-14: Object-family coexistence tracking ─────────────────────────
  const familyCounts = useMemo(() => countNodesByFamily(graphNodes), [graphNodes]);
  const activeFamilies = useMemo(() => {
    const families: ObjectFamily[] = [];
    for (const [family, count] of Object.entries(familyCounts)) {
      if (count > 0) families.push(family as ObjectFamily);
    }
    return families;
  }, [familyCounts]);
  const isMultiFamily = activeFamilies.length > 1;

  // ── V5-IDEA-16: Persist surface state on unmount ───────────────────────────
  const lastViewportRef = React.useRef<{ x: number; y: number; zoom: number } | null>(null);
  const handleViewportReport = useCallback((vp: { x: number; y: number; zoom: number }) => {
    lastViewportRef.current = vp;
  }, []);

  useEffect(() => {
    return () => {
      if (!realId || isDraft) return;
      const surfaceState: Record<string, unknown> = {
        focusMode,
        focusObjectId: focusObjectId || null,
        activeTool,
        selectedNodeIds: selection.ids || [],
      };
      if (lastViewportRef.current) {
        surfaceState.viewport = lastViewportRef.current;
      }
      try {
        Api.saveMyIdeaMap(realId, {
          extensions: { surfaceState },
        }).catch(() => {});
      } catch {
        /* best-effort */
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chat ────────────────────────────────────────────────────────────────────
  const openChat = useCallback(
    (prefillText?: string) => {
      setChatKickoffMessage(
        prefillText ||
          buildAskAIMessage({
            type: 'idea',
            title: title || seedText?.slice(0, 80) || (isPolish ? 'Wyzwanie' : 'Challenge'),
            description: seedText || undefined,
          })
      );
      if (isChatCollapsed) toggleChatCollapse();
    },
    [isChatCollapsed, isPolish, seedText, setChatKickoffMessage, title, toggleChatCollapse]
  );

  useEffect(() => {
    if (loading || aiKickoffTriggeredRef.current) return;
    if (!realId || !isNewInitial) return;
    if (!(seedIntent?.source === 'chat_handoff' || seedIntent?.startMode === 'describe_with_ai'))
      return;

    aiKickoffTriggeredRef.current = true;
    const requestedSystem = preferredSeedSystem || activeTool;
    const promptSeed = initialIdeaBody || seedText;
    const prompt = isPolish
      ? `Zacznij budowę workspace dla pomysłu "${initialIdeaTitle || title}". Preferowany system startowy: ${requestedSystem}. Przygotuj pierwszą propozycję struktury na bazie:\n\n${promptSeed}`
      : `Start building the workspace for "${initialIdeaTitle || title}". Preferred initial system: ${requestedSystem}. Prepare the first proposed structure based on:\n\n${promptSeed}`;
    openChat(prompt);
  }, [
    activeTool,
    initialIdeaBody,
    initialIdeaTitle,
    isNewInitial,
    isPolish,
    loading,
    openChat,
    preferredSeedSystem,
    realId,
    seedIntent,
    seedText,
    title,
  ]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (isDraft) return;
    setSaving(true);
    try {
      const payload: any = {
        title: (title || safeTitleFromSeed(seedText, isPolish)).trim().slice(0, 255),
        body: seedText,
        branch: branch || null,
        area: area || null,
        priority: Number.isFinite(priority) ? priority : 50,
      };
      const updated = await Api.updateMyIdea(realId, payload);
      onSaved(updated as MyIdea);
      setStage(String((updated as any)?.stage || stage || 'seed'));
      setDirty(false);
      setLastSavedAt(Date.now());
      toast.success(isPolish ? 'Zapisano' : 'Saved', { duration: 900 });
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [area, branch, isDraft, isPolish, onSaved, priority, realId, seedText, stage, title]);

  // ── Accept challenge ────────────────────────────────────────────────────────
  const handleAcceptChallenge = useCallback(async () => {
    if (isDraft) return;
    const nextTitle = (title || safeTitleFromSeed(seedText, isPolish)).trim().slice(0, 255);
    if (!seedText.trim()) {
      toast(isPolish ? 'Najpierw opisz wyzwanie.' : 'Describe the challenge first.');
      return;
    }
    setSaving(true);
    try {
      const updated = await Api.updateMyIdea(realId, {
        title: nextTitle,
        body: seedText,
        stage: 'framing',
      });
      setTitle(String((updated as any)?.title || nextTitle));
      setStage(String((updated as any)?.stage || 'framing'));
      onSaved(updated as MyIdea);
      setDirty(false);
      setLastSavedAt(Date.now());
      toast.success(isPolish ? 'Wyzwanie zaakceptowane' : 'Challenge accepted', { duration: 1100 });
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
    } finally {
      setSaving(false);
    }
  }, [isDraft, isPolish, onSaved, realId, seedText, title]);

  // ── V5-IDEA-15: Focus mode handlers ─────────────────────────────────────────
  const handleEnterFocusSystem = useCallback(() => {
    setFocusMode('system');
    trackFunnelEvent('ideas_focus_mode', { mode: 'system', tool: activeTool, ideaId: realId });
  }, [activeTool, realId]);

  const handleEnterFocusObject = useCallback(
    (objectId: string) => {
      setFocusMode('object');
      setFocusObjectId(objectId);
      trackFunnelEvent('ideas_focus_mode', { mode: 'object', objectId, ideaId: realId });
    },
    [realId]
  );

  const handleExitFocus = useCallback(() => {
    setFocusMode('full');
    setFocusObjectId(null);
    trackFunnelEvent('ideas_focus_mode', { mode: 'full', ideaId: realId });
  }, [realId]);

  // ── Stage change (V5) ─────────────────────────────────────────────────────
  const handleStageChange = useCallback(
    async (nextStage: string) => {
      if (isDraft) return;
      setStage(nextStage);
      setDirty(true);
      try {
        await Api.updateMyIdea(realId, { stage: nextStage });
      } catch {
        /* best-effort — local state already updated */
      }
    },
    [isDraft, realId]
  );

  // ── Convert ─────────────────────────────────────────────────────────────────
  const SUPPORTED_CONVERT_TARGETS: IdeaConvertTarget[] = [
    'initiative',
    'task_set',
    'decision',
    'team_chat',
    'report',
    'presentation',
    'action_plan',
    'raid_log',
    'financial_model',
    'budget',
    'valuation',
    'analysis',
  ];

  const handleConvert = useCallback(
    async (target: IdeaConvertTarget) => {
      if (isDraft) return;
      if (!SUPPORTED_CONVERT_TARGETS.includes(target)) {
        toast.error(
          isPolish
            ? 'Ten typ konwersji nie jest jeszcze wspierany'
            : 'This conversion target is not yet supported'
        );
        return;
      }
      setSaving(true);
      try {
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const result = await Api.convertMyIdea(realId, {
          target: target as any,
          options: {
            language: i18n.language,
            ...(selection.ids?.length ? { nodeIds: selection.ids } : {}),
          },
        });
        trackFunnelEvent('mywork_convert_completed', {
          from: 'idea',
          toType: target,
          has_source: Boolean(result?.sourceSessionId),
        });
        if (result?.sourceSessionId) {
          trackFunnelEvent('mywork_session_materialized', {
            source: 'idea_convert',
            sourceEntityId: realId,
            target,
            sessionId: result.sourceSessionId,
          });
        }

        const outputId = result?.outputId || result?.sourceSessionId;
        if (outputId) {
          Api.createLinkGraphEdge({
            source: { type: 'idea', id: realId },
            target: { type: target === 'task_set' ? 'task' : target, id: outputId },
            relation: 'ref',
            context: { containerType: 'idea_workspace', containerId: realId },
          }).catch(() => {});

          try {
            const currentMap = await Api.getMyIdeaMap(realId);
            const existingOutputLinks = currentMap?.extensions?.outputLinks || [];
            const newOutputLink = {
              type: target === 'task_set' ? 'task' : target,
              id: outputId,
              label: `Converted to ${target}`,
              linkRole: 'output' as const,
            };
            await Api.saveMyIdeaMap(realId, {
              ...currentMap,
              extensions: {
                ...(currentMap?.extensions || {}),
                outputLinks: [...(existingOutputLinks as any[]), newOutputLink],
              },
            });
          } catch {
            /* best-effort persistence */
          }
        }

        toast.success(
          isPolish
            ? 'Gotowe — wynik dostępny w module docelowym'
            : 'Done — output available in target module'
        );
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
      } finally {
        setSaving(false);
      }
    },
    [i18n.language, isDraft, isPolish, realId, selection.ids]
  );

  handleConvertRef.current = handleConvert;

  // ── V51-30: Artifact attach handlers ──────────────────────────────────────
  const artifactCacheRef = useRef<Array<{ type: ArtifactType; id: string; title: string; status?: string }> | null>(null);

  const handleArtifactSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setArtifactSearchResults([]);
        return;
      }
      let cache = artifactCacheRef.current;
      if (!cache) {
        try {
          const all: Array<{ type: ArtifactType; id: string; title: string; status?: string }> = [];
          const [initiatives, tasks, decisions] = await Promise.allSettled([
            Api.getInitiatives?.(),
            Api.getMyTasks?.(),
            Api.getDecisions?.(),
          ]);
          if (initiatives.status === 'fulfilled' && Array.isArray(initiatives.value)) {
            initiatives.value.forEach((i: any) =>
              all.push({ type: 'initiative' as ArtifactType, id: i.id, title: i.title || i.name || '', status: i.status })
            );
          }
          if (tasks.status === 'fulfilled') {
            const arr = Array.isArray(tasks.value) ? tasks.value : (tasks.value as any)?.tasks || [];
            arr.forEach((t: any) =>
              all.push({ type: 'task' as ArtifactType, id: t.id, title: t.title || t.name || '', status: t.status })
            );
          }
          if (decisions.status === 'fulfilled' && Array.isArray(decisions.value)) {
            decisions.value.forEach((d: any) =>
              all.push({ type: 'decision' as ArtifactType, id: d.id, title: d.title || d.name || '', status: d.status })
            );
          }
          cache = all;
          artifactCacheRef.current = all;
        } catch {
          setArtifactSearchResults([]);
          return;
        }
      }
      const q = query.toLowerCase();
      setArtifactSearchResults(
        cache.filter((a) => a.title.toLowerCase().includes(q) || a.type.includes(q)).slice(0, 15)
      );
    },
    []
  );

  const handleArtifactAttach = useCallback(
    async (
      ref: { type: ArtifactType; id: string; title: string },
      role: ArtifactLinkRole
    ) => {
      const objectId = selection.ids?.[0];
      if (!objectId || isDraft) return;
      try {
        await Api.attachArtifactToObject(realId, objectId, {
          artifactRef: { type: ref.type, id: ref.id },
          label: ref.title,
          linkRole: role,
        });
        setMapRefreshToken((v) => v + 1);
        toast.success(
          isPolish
            ? `Dołączono: ${ref.title}`
            : `Attached: ${ref.title}`
        );
        trackFunnelEvent('ideas_artifact_attached', {
          ideaId: realId,
          objectId,
          artifactType: ref.type,
          role,
        });
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się dołączyć' : 'Failed to attach'));
      }
    },
    [isDraft, isPolish, realId, selection.ids]
  );

  // ── Node detail drawer ──────────────────────────────────────────────────────
  const handleOpenNodeDetail = useCallback((nodeId: string, data: any) => {
    setNodeDetailId(nodeId);
    setNodeDetailData({
      label: data?.label || '',
      description: data?.description || '',
      owner: data?.owner || '',
      attachments: data?.attachments || [],
      comments: data?.comments || [],
      tags: data?.tags || [],
      status: data?.status || 'idea',
      priority: data?.priority ?? 50,
      aiContext: data?.aiContext || '',
      linkedNodes: data?.linkedNodes || [],
      branchKey: data?.branchKey || '',
      colorIndex: data?.colorIndex,
      notes: data?.notes || '',
      context: data?.context || '',
      goal: data?.goal || '',
      rationale: data?.rationale || '',
      riskNote: data?.riskNote || '',
      evidenceLinks: data?.evidenceLinks || [],
      semanticType: data?.semanticType || '',
      aiExpansionHistory: data?.aiExpansionHistory || [],
    });
    setNodeDetailOpen(true);
  }, []);

  const handleNodeDataChange = useCallback(
    async (nodeId: string, patch: Partial<ExtendedNodeData>) => {
      setNodeDetailData((prev) => ({ ...prev, ...patch }));
      try {
        const mapRes = await Api.getMyIdeaMap(realId, { language: i18n.language });
        const map = mapRes?.map || {};
        const nodes: any[] = Array.isArray(map.nodes) ? [...map.nodes] : [];
        const edges: any[] = Array.isArray(map.edges) ? [...map.edges] : [];
        const updatedNodes = nodes.map((n: any) =>
          String(n?.id) === nodeId ? { ...n, data: { ...(n.data || {}), ...patch } } : n
        );
        await Api.saveMyIdeaMap(realId, {
          nodes: updatedNodes,
          edges,
          extensions: map.extensions || {},
        });
        setGraphNodes(updatedNodes);
        setMapRefreshToken((v) => v + 1);
      } catch {
        /* best-effort save */
      }
    },
    [i18n.language, realId]
  );

  // ── Drill-down (sub-idea navigation) ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.nodeId) return;
      const node = graphNodes.find((n: any) => String(n?.id) === detail.nodeId);
      const label = node?.data?.label || node?.label || detail.nodeId;
      setDrillDownStack((prev) => [...prev, { nodeId: detail.nodeId, label }]);
    };
    window.addEventListener('idea-workspace-drill-down', handler);

    const detailHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.nodeId) return;
      const node = graphNodes.find((n: any) => n.id === detail.nodeId);
      if (node) handleOpenNodeDetail(node.id, node.data || {});
    };
    window.addEventListener('idea-node-open-detail', detailHandler);

    return () => {
      window.removeEventListener('idea-workspace-drill-down', handler);
      window.removeEventListener('idea-node-open-detail', detailHandler);
    };
  }, [graphNodes, handleOpenNodeDetail]);

  // V51-26: Wire AI proposal event from template gallery / AI suggestions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.batch) setProposalBatch(detail.batch);
    };
    window.addEventListener('idea-workspace-ai-proposal', handler);
    return () => window.removeEventListener('idea-workspace-ai-proposal', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.nodeId && detail?.ideaId === realId) {
        setSelection({ type: 'node', count: 1, ids: [detail.nodeId], primaryId: detail.nodeId });
        setArtifactPopoverOpen(true);
      }
    };
    window.addEventListener('idea-workspace-attach-knowledge', handler);
    return () => window.removeEventListener('idea-workspace-attach-knowledge', handler);
  }, [realId]);

  const handleDrillUp = useCallback((toIndex: number) => {
    setDrillDownStack((prev) => prev.slice(0, toIndex));
    setMapRefreshToken((v) => v + 1);
  }, []);

  // ── Pinned card data sync ───────────────────────────────────────────────────
  useEffect(() => {
    setPinnedCardData((prev) => ({
      ...prev,
      title: title || safeTitleFromSeed(seedText, isPolish),
      summary: seedText?.split('\n')[0]?.slice(0, 200) || '',
    }));
  }, [title, seedText, isPolish]);

  // ── Draft saved label ───────────────────────────────────────────────────────
  const draftSavedLabel = useMemo(() => {
    if (saving) return isPolish ? 'Zapisuję…' : 'Saving…';
    if (!lastSavedAt) return 'Draft';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
  }, [isPolish, lastSavedAt, saving]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-navy-950">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex overflow-hidden bg-white dark:bg-navy-950"
      role="region"
      aria-label={isPolish ? 'Obszar roboczy mapy idei' : 'Idea map workspace'}
    >
      {/* Canvas area */}
      <div
        className="flex-1 min-w-0 h-full relative"
        role="group"
        aria-label={isPolish ? 'Płótno idei i narzędzia mapy' : 'Idea canvas and map tools'}
      >
        {/* Breadcrumb for drill-down navigation */}
        {drillDownStack.length > 0 && (
          <div className="absolute top-2 left-4 z-[60] flex items-center gap-1 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-slate-200/60 dark:border-navy-700/60 shadow-sm">
            <button
              onClick={() => handleDrillUp(0)}
              className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              {isPolish ? 'Główna mapa' : 'Root map'}
            </button>
            {drillDownStack.map((item, i) => (
              <React.Fragment key={item.nodeId}>
                <span className="text-[10px] text-slate-400 mx-0.5">/</span>
                <button
                  onClick={() => handleDrillUp(i + 1)}
                  className={`text-[10px] font-medium truncate max-w-[120px] ${
                    i === drillDownStack.length - 1
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-primary-600 dark:text-primary-400 hover:underline'
                  }`}
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* V5-IDEA-15: Focus mode indicator */}
        {focusMode !== 'full' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[58] flex items-center gap-2 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-slate-200/60 dark:border-navy-700/60 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400">
              {focusMode === 'system'
                ? isPolish
                  ? `Tryb skupiony: ${activeTool}`
                  : `Focused: ${activeTool}`
                : isPolish
                  ? 'Tryb obiektu'
                  : 'Object focus'}
            </span>
            <button
              onClick={handleExitFocus}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              {isPolish ? '← Pełny canvas' : '← Full canvas'}
            </button>
          </div>
        )}

        {/* V5-IDEA-13: Pinned Idea Card summary */}
        {pinnedCardVisible && isAccepted && (
          <div className="absolute top-3 right-3 z-[55]">
            <IdeaPinnedCard
              stage={stage}
              data={pinnedCardData}
              evidenceCount={
                graphNodes.filter(
                  (n: any) =>
                    n?.kind === 'evidence_card' ||
                    n?.kind === 'knowledge_card' ||
                    n?.kind === 'artifact_ref'
                ).length
              }
              nodeCount={graphNodes.length}
              onEdit={() => handlePanelChange('tools')}
              onAISummarize={() => {
                const prompt = isPolish
                  ? `Podsumuj kartę pomysłu "${title}" — problem, szanse, ryzyka, następne kroki.`
                  : `Summarize the idea card for "${title}" — problem, opportunities, risks, next steps.`;
                openChat(prompt);
              }}
              onStageChange={async (newStage) => {
                try {
                  await Api.updateMyIdea(realId, { stage: newStage });
                  setStage(newStage);
                  toast.success(
                    isPolish
                      ? `Etap: ${IDEA_STAGE_LABELS[newStage].pl}`
                      : `Stage: ${IDEA_STAGE_LABELS[newStage].en}`
                  );
                } catch {
                  toast.error(isPolish ? 'Nie udało się zmienić etapu' : 'Failed to change stage');
                }
              }}
            />
          </div>
        )}

        {/* Ghost cards — AI gap suggestions */}
        {isAccepted && (activeTool === 'whiteboard' || activeTool === 'mindmap') && (
          <IdeaGhostCards
            ideaId={realId}
            activeTool={activeTool}
            title={title || safeTitleFromSeed(seedText, isPolish)}
            seedText={seedText}
            isAccepted={isAccepted}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            onMaterialize={(card) => {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: {
                    items: [
                      { text: card.text, position: card.position, branchKey: card.branchKey },
                    ],
                    ideaId: realId,
                  },
                })
              );
            }}
          />
        )}

        {/* Voting mode overlay */}
        <IdeaVotingMode
          active={votingActive}
          onClose={() => setVotingActive(false)}
          maxVotes={5}
          timerSeconds={120}
          nodes={graphNodes}
          onVotesChange={(votes) => {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-votes-update', { detail: { votes, ideaId: realId } })
            );
          }}
        />

        {/* Workspace bottom toolbar */}
        <IdeaWorkspaceToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          isAccepted={isAccepted}
          onToggleVoting={() => setVotingActive((v) => !v)}
          votingActive={votingActive}
          onToggleAI={() => handlePanelChange('ai_suggestions')}
          onToggleContext={() => handlePanelChange('context')}
          onToggleFocus={() => {
            if (focusMode === 'system') handleExitFocus();
            else handleEnterFocusSystem();
          }}
          focusMode={focusMode}
          familyCounts={familyCounts}
          onExport={() => {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-export', {
                detail: { ideaId: realId, tool: activeTool },
              })
            );
          }}
        />

        {/* Proposal review overlay */}
        {proposalBatch && (
          <div className="absolute bottom-4 left-4 right-4 z-[90] max-w-lg mx-auto">
            <IdeaProposalReview
              batch={proposalBatch}
              onAccept={handleAcceptProposal}
              onReject={handleRejectProposal}
              onAcceptAll={handleAcceptAllProposals}
              onRejectAll={handleRejectAllProposals}
              onDismiss={() => setProposalBatch(null)}
            />
          </div>
        )}

        {/* Canvas tools — each wrapped in error boundary for resilience */}
        {activeTool === 'mindmap' && (
          <CanvasToolErrorBoundary
            key={`eb-mindmap-${realId}`}
            toolName="Mind Map"
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaRecommendationMap
              key={`${realId}:${mapRefreshToken}`}
              ideaId={realId}
              ideaTitle={title || safeTitleFromSeed(seedText, isPolish)}
              onClose={() => setMapOpen(false)}
              onCenterEdit={() => handlePanelChange('tools')}
              preferredTool={activeTool}
              extensions={{}}
              onPreferredToolLoaded={(tool) => {
                if (!tool) return;
                if (userSelectedToolRef.current) return;
                if (tool === activeTool) return;
                setTimeout(() => setActiveTool(tool), 0);
              }}
              variant={mapOpen ? 'overlay' : 'embedded'}
              showClose={mapOpen}
              className={mapOpen ? '' : 'rounded-none'}
              locked={!isAccepted}
              onSelectionChange={handleSelectionChange}
              onViewportReport={handleViewportReport}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
            />
          </CanvasToolErrorBoundary>
        )}
        {activeTool === 'table' && (
          <CanvasToolErrorBoundary
            key={`eb-table-${realId}`}
            toolName="Table"
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaTableTool
              open
              ideaId={realId}
              locked={!isAccepted}
              refreshToken={mapRefreshToken}
              onSaved={() => setMapRefreshToken((v) => v + 1)}
              onSelectionChange={handleSelectionChange}
              onConvert={(target) =>
                handleConvert(target === 'task' ? 'task_set' : (target as any))
              }
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
            />
          </CanvasToolErrorBoundary>
        )}
        {activeTool === 'process_flow' && (
          <CanvasToolErrorBoundary
            key={`eb-flow-${realId}`}
            toolName="Process Flow"
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaProcessFlowTool
              open
              ideaId={realId}
              locked={!isAccepted}
              refreshToken={mapRefreshToken}
              onSaved={() => setMapRefreshToken((v) => v + 1)}
              onSelectionChange={handleSelectionChange}
              onNodeDetail={handleOpenNodeDetail}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
            />
          </CanvasToolErrorBoundary>
        )}
        {activeTool === 'whiteboard' && (
          <CanvasToolErrorBoundary
            key={`eb-whiteboard-${realId}`}
            toolName="Whiteboard"
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaWhiteboardTool
              open
              ideaId={realId}
              locked={!isAccepted}
              refreshToken={mapRefreshToken}
              onSaved={() => setMapRefreshToken((v) => v + 1)}
              onSelectionChange={handleSelectionChange}
              onNodeDetail={handleOpenNodeDetail}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
              drillFocusNodeId={
                drillDownStack.length > 0 ? drillDownStack[drillDownStack.length - 1].nodeId : null
              }
            />
          </CanvasToolErrorBoundary>
        )}
      </div>

      {/* Tools panel sidebar */}
      <IdeaWorkspaceTools
        open={toolsPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title}
        seedText={seedText}
        stage={stage}
        branch={branch}
        area={area}
        priority={priority}
        isDraft={isDraft}
        isAccepted={isAccepted}
        saving={saving}
        draftSavedLabel={draftSavedLabel}
        activeTool={activeTool}
        selection={selection}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        onSeedTextChange={(v) => {
          setSeedText(v);
          setDirty(true);
        }}
        onBranchChange={(v) => {
          setBranch(v);
          setDirty(true);
        }}
        onAreaChange={(v) => {
          setArea(v);
          setDirty(true);
        }}
        onPriorityChange={(v) => {
          setPriority(v);
          setDirty(true);
        }}
        onSave={handleSave}
        onAcceptChallenge={handleAcceptChallenge}
        onStageChange={handleStageChange}
        onConvert={handleConvert}
        onOpenChat={openChat}
        onGenerateProposal={(batch) => {
          setProposalBatch(batch);
          trackFunnelEvent('ideas_generator_proposal_created', {
            tool: batch.tool,
            generatorType: batch.generatorType,
            count: batch.proposals.length,
          });
        }}
        graphNodes={graphNodes}
        graphEdges={graphEdges}
        graphLanes={graphLanes}
        onOpenTemplates={() => setTemplateGalleryOpen(true)}
      />

      <IdeaContextPanel
        open={contextPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title || safeTitleFromSeed(seedText, isPolish)}
        selectedNodeId={selection.ids?.[0] || null}
        refreshToken={mapRefreshToken}
        onInsertToCanvas={(item) => {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-insert', { detail: { items: [item], ideaId: realId } })
          );
        }}
      />

      <IdeaAISuggestionsPanel
        open={aiPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title || safeTitleFromSeed(seedText, isPolish)}
        seedText={seedText}
        activeTool={activeTool}
        isAccepted={isAccepted}
        onSendToChat={openChat}
        onInsertToWorkspace={(items) => {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-insert', { detail: { items, ideaId: realId } })
          );
        }}
        graphNodes={graphNodes}
        graphEdges={graphEdges}
      />

      <IdeaTemplateGallery
        open={templateGalleryOpen}
        onClose={() => setTemplateGalleryOpen(false)}
        ideaId={realId}
        activeTool={activeTool}
        onApplied={() => setMapRefreshToken((v) => v + 1)}
      />

      <IdeaNodeDetailDrawer
        open={nodeDetailOpen}
        onClose={() => setNodeDetailOpen(false)}
        nodeId={nodeDetailId}
        nodeData={nodeDetailData}
        ideaId={realId}
        activeTool={activeTool}
        locked={!isAccepted}
        allNodes={graphNodes}
        onNodeDataChange={handleNodeDataChange}
        onGenerateProposal={(batch) => {
          setProposalBatch(batch);
          setNodeDetailOpen(false);
        }}
        onDrillDown={(nid) => {
          setNodeDetailOpen(false);
          window.dispatchEvent(
            new CustomEvent('idea-workspace-drill-down', {
              detail: { nodeId: nid, ideaId: realId },
            })
          );
        }}
      />

      <IdeaUnifiedSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        nodes={graphNodes}
        onHighlightNode={handleSearchHighlight}
        isPl={isPolish ?? false}
      />

      <CommandPalette isOpen={cmdPalette.isOpen} onClose={cmdPalette.close} />

      {/* V51-30: Artifact attach popover */}
      <ArtifactAttachPopover
        open={artifactPopoverOpen}
        onClose={() => setArtifactPopoverOpen(false)}
        onAttach={handleArtifactAttach}
        searchResults={artifactSearchResults}
        onSearch={handleArtifactSearch}
        isPl={isPolish ?? false}
      />

      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
};

export default IdeaMapWorkspace;
