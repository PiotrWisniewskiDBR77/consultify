/**
 * IdeaMapWorkspace — fullscreen workspace for editing an idea.
 *
 * Keeps workspace navigation explicit:
 * - 4 native systems stay in the floating workspace switcher
 * - Tools / Context / AI Suggestions stay in the fixed right strip
 * - Selection contract drives Tools panel content
 */
import {
  AlertTriangle,
  Download,
  GitBranch,
  Keyboard,
  LayoutTemplate,
  RefreshCw,
  Search,
  StickyNote,
  Table2,
  Workflow,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingState } from '@/components/shared/states';
import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api, getMapVersionFromPayload } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { generateAIProposal } from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';

import {
  type ArtifactLinkRole,
  type ArtifactType,
  buildArtifactCode,
  buildArtifactRef,
  getArtifactLabel,
} from '../../utils/artifactLinks';
import { ArtifactAttachPopover } from '../shared/NModeBlocks/ArtifactAttachPopover';
import { applyAIProposalRuntime } from './aiProposalRuntime';
import type { ProcessFlowSemanticKit } from './canvas/canvasOsContract';
import { mergeWorkspaceExtensions, useWorkspaceGraphRuntime } from './canvas/workspaceGraphRuntime';
import { type CommandItem, CommandPalette, useCommandPalette } from './CommandPalette';
import { type ShortcutHelp, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import { IdeaContextPanel } from './IdeaContextPanel';
import {
  IDEA_CONVERT_TARGETS,
  type IdeaConvertTarget,
  isLiveConvertTarget,
} from './ideaConvertTargets';
import {
  composeIdeaBodyFromSeedIntent,
  deriveIdeaTitleFromSeedIntent,
  IDEA_STAGE_LABELS,
  type IdeaStageV5,
  type IdeaWorkspaceCreationPayload,
  type IdeaWorkspaceSeedIntent,
  normalizePreferredSystem,
  normalizeStageToV5,
} from './ideaEntryTypes';
import { IdeaExportMenu } from './IdeaExportMenu';
import { IdeaGhostCards } from './IdeaGhostCards';
import { ideaMapToMarkdown } from './ideaMapToMarkdown';
import { type ExtendedNodeData, IdeaNodeDetailDrawer } from './IdeaNodeDetailDrawer';
import { IdeaProcessFlowTool } from './IdeaProcessFlowTool';
import { IdeaProposalReview } from './IdeaProposalReview';
import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import type { CanvasToolType, MindMapInteractionMode } from './ideaSelectionTypes';
import {
  type AIProposal,
  type AIProposalBatch,
  type CanvasAIReplayEntry,
  type CanvasGovernanceStatus,
  EMPTY_SELECTION,
  IDEA_WORKSPACE_IMPORT_EVENT,
  type IdeaWorkspaceImportPayload,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { IdeaTableTool } from './IdeaTableTool';
import { applyIdeaTemplate, findIdeaTemplate, IdeaTemplateGallery } from './IdeaTemplateGallery';
import { IdeaUnifiedSearch } from './IdeaUnifiedSearch';
import { IdeaVotingMode } from './IdeaVotingMode';
import { IdeaWhiteboardTool } from './IdeaWhiteboardTool';
import { getIdeaWorkspaceToolLabel, IdeaWorkspaceToolbar } from './IdeaWorkspaceToolbar';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
import { AIGovernanceBadge, AIGovernancePanel } from './mindmap/AIGovernancePanel';
import { CanvasLeftToolbar } from './mindmap/CanvasLeftToolbar';
import { stabilizeMindmapInteractionMode } from './mindmap/mindmapInteractionGrammar';
import type { MyIdea } from './myIdeasTypes';
import { buildAskAIMessage } from './shared/askAiHelper';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { countNodesByFamily, type ObjectFamily } from './superCanvasTypes';
import { type TransformInput, transformSelection } from './transforms/crossToolTransform';

// React StrictMode can remount brand-new workspaces in development.
// Keep one creation request per temporary draft id to avoid duplicate ideas.
const draftIdeaBootstrapPromises = new Map<string, Promise<MyIdea>>();

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
    console.error(`[CanvasToolErrorBoundary] Stack:`, error?.stack);
    console.error(`[CanvasToolErrorBoundary] Component stack:`, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isPl = typeof window !== 'undefined' && (navigator.language || '').startsWith('pl');
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-c-surface-raised dark:bg-c-surface p-8">
          <div className="p-3 rounded-2xl bg-c-surface border border-c-danger">
            <AlertTriangle size={32} className="text-c-danger" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-c-text dark:text-c-text mb-1">
              {this.props.toolName} {isPl ? 'nie załadował się' : 'failed to load'}
            </div>
            <div className="text-xs text-c-text-secondary dark:text-c-text-muted max-w-sm">
              {this.state.error?.message ||
                (isPl ? 'Wystąpił nieoczekiwany błąd' : 'An unexpected error occurred')}
            </div>
          </div>
          {this.props.onRetry && (
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onRetry?.();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-c-surface dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
            >
              <RefreshCw size={14} />
              {isPl ? 'Ponów' : 'Retry'}
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

function isSameSelection(left: IdeaWorkspaceSelection, right: IdeaWorkspaceSelection) {
  if (left.type !== right.type) return false;
  if (left.count !== right.count) return false;
  if ((left.primaryId || null) !== (right.primaryId || null)) return false;

  const leftIds = Array.isArray(left.ids) ? left.ids : [];
  const rightIds = Array.isArray(right.ids) ? right.ids : [];
  if (leftIds.length !== rightIds.length) return false;
  for (let i = 0; i < leftIds.length; i += 1) {
    if (leftIds[i] !== rightIds[i]) return false;
  }

  const leftMeta = left.meta || {};
  const rightMeta = right.meta || {};
  return (
    (leftMeta.nodeType || null) === (rightMeta.nodeType || null) &&
    (leftMeta.label || null) === (rightMeta.label || null)
  );
}

type IdeaMapWorkspaceProps = {
  ideaId: string;
  initialOpenMap?: boolean;
  creationPayload?: IdeaWorkspaceCreationPayload;
  seedIntent?: IdeaWorkspaceSeedIntent;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
  initialTool?: CanvasToolType;
  initialFocusNode?: string;
  activeTool?: CanvasToolType;
  onActiveToolChange?: (tool: CanvasToolType) => void;
  activePanel?: WorkspacePanelKey;
  onActivePanelChange?: (panel: WorkspacePanelKey) => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onQuickAction?: (action: string) => void;
  onLockedChange?: (locked: boolean) => void;
  onGraphSummaryChange?: (summary: string | null) => void;
  onTableContextChange?: (ctx: Record<string, unknown> | null) => void;
};

// IdeaConvertTarget union is owned by the SSOT registry (ideaConvertTargets.ts).

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
  initialTool,
  initialFocusNode,
  activeTool: externalActiveTool,
  onActiveToolChange,
  activePanel: externalActivePanel,
  onActivePanelChange,
  onSelectionChange: externalOnSelectionChange,
  onQuickAction: externalOnQuickAction,
  onLockedChange,
  onGraphSummaryChange,
  onTableContextChange,
}) => {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // DP-5: heuristic AI overlays (see DEFAULT_FLAGS in useFeatureFlags)
  const { isEnabled: isFeatureEnabled } = useFeatureFlagsContext();
  const heuristicAiOverlaysEnabled = isFeatureEnabled('mindmapHeuristicAiOverlays');
  const deepLinkedTableId = searchParams.get('tpTable');
  const deepLinkedViewId = searchParams.get('tpView');
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isNewInitial = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { isEnabled } = useFeatureFlagsContext();
  const mindmapTeresaBridgeEnabled = isEnabled('ENABLE_TERESA_MINDMAP');
  const openChatWithContext = useOpenChatWithContext();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = String(currentUser?.id || 'current-user');

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

  const [tableContext, setTableContext] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    onTableContextChange?.(tableContext);
  }, [tableContext, onTableContextChange]);

  const [mapOpen, setMapOpen] = useState(Boolean(initialOpenMap));
  // MM-01: Read-only mirrors for non-reactive access (AI generation, cross-tool transforms).
  // Canonical graph owner is ReactFlow state inside IdeaRecommendationMap.
  const graphNodesRef = useRef<any[]>([]);
  const graphEdgesRef = useRef<any[]>([]);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [mmCanUndo, setMmCanUndo] = useState(false);
  const [mmCanRedo, setMmCanRedo] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const { canUndo, canRedo } = (e as CustomEvent).detail || {};
      setMmCanUndo(Boolean(canUndo));
      setMmCanRedo(Boolean(canRedo));
    };
    window.addEventListener('mm-undo-state', handler);
    // Table tool reports its own undo/redo availability on a dedicated channel.
    window.addEventListener('tbl-undo-state', handler);
    return () => {
      window.removeEventListener('mm-undo-state', handler);
      window.removeEventListener('tbl-undo-state', handler);
    };
  }, []);
  // discoveryPanel removed — replaced by CanvasLeftToolbar
  const [whiteboardFacilitation, setWhiteboardFacilitation] = useState<{
    timerEndsAt?: number | null;
    voteSummary?: Record<string, number>;
    myVoteCounts?: Record<string, number>;
  }>({});
  const [nodeDetailOpen, setNodeDetailOpen] = useState(false);
  const [nodeDetailId, setNodeDetailId] = useState<string>('');
  const [nodeDetailData, setNodeDetailData] = useState<ExtendedNodeData>({ label: '' });
  const [drillDownStack, setDrillDownStack] = useState<Array<{ nodeId: string; label: string }>>(
    []
  );
  const [votingActive, setVotingActive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [governancePanelOpen, setGovernancePanelOpen] = useState(false);

  // V5-IDEA-15: Focus modes
  type FocusMode = 'full' | 'system' | 'object';
  const [focusMode, setFocusMode] = useState<FocusMode>('full');
  const [focusObjectId, setFocusObjectId] = useState<string | null>(null);
  const toolFocusMode = focusMode === 'full' ? null : focusMode;

  // V51-30: Artifact attach popover state
  const [artifactPopoverOpen, setArtifactPopoverOpen] = useState(false);
  const [artifactSearchResults, setArtifactSearchResults] = useState<
    Array<{
      type: ArtifactType;
      id: string;
      title: string;
      status?: string;
      owner?: string;
      artifactIndex?: string;
      ref?: string;
    }>
  >([]);

  const [internalActiveTool, setInternalActiveTool] = useState<CanvasToolType>(
    initialTool || 'mindmap'
  );
  const [internalActivePanel, setInternalActivePanel] = useState<WorkspacePanelKey>(null);
  const [mapRefreshToken, setMapRefreshToken] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const userSelectedToolRef = React.useRef(false);
  const aiKickoffTriggeredRef = React.useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const workspaceRootRef = useRef<HTMLDivElement>(null);

  const toggleWorkspaceFullscreen = useCallback(() => {
    if (!workspaceRootRef.current) return;
    if (!document.fullscreenElement) {
      workspaceRootRef.current
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const activeTool = externalActiveTool ?? internalActiveTool;
  const activePanel = externalActivePanel ?? internalActivePanel;
  // Command palette enabled in ALL tools (Cmd+K). Mind Map's keyboard layer
  // does not bind Cmd+K, so there is no double-trigger.
  const cmdPalette = useCommandPalette();
  // The canvas must stay editable even before formal acceptance.
  // Acceptance still gates downstream actions like AI/convert, but not node manipulation.
  const canvasLocked = false;
  const autoCollapsedTablePanelRef = useRef(false);

  const setActiveTool = useCallback(
    (tool: CanvasToolType) => {
      if (onActiveToolChange) onActiveToolChange(tool);
      else setInternalActiveTool(tool);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tool', tool);
        window.history.replaceState(null, '', url.toString());
      } catch {
        /* ignore */
      }
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
  const selectionRef = useRef<IdeaWorkspaceSelection>(EMPTY_SELECTION);
  const [mindMapInteractionMode, setMindMapInteractionMode] =
    useState<MindMapInteractionMode>('select');
  const handleMindMapInteractionModeChange = useCallback(
    (requestedMode: MindMapInteractionMode) => {
      setMindMapInteractionMode((previousMode) =>
        stabilizeMindmapInteractionMode(previousMode, requestedMode)
      );
    },
    []
  );

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const handleSelectionChange = useCallback(
    (next: IdeaWorkspaceSelection) => {
      if (isSameSelection(selectionRef.current, next)) return;
      selectionRef.current = next;
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

  const conflictRefreshRef = useRef<(() => Promise<void>) | null>(null);
  // A brand-new board auto-seeds its first node (mindmap root / whiteboard sticky) into
  // the shared my_idea_maps doc; that first write can race the tool's own save and 409.
  // It auto-recovers — but firing an alarming "conflict" toast on an empty board the user
  // just opened reads like something broke. Suppress the toast during the initial settle
  // window; only surface genuine conflicts (real concurrent editing after the board loaded).
  const workspaceMountedAtRef = useRef(Date.now());
  const CONFLICT_TOAST_SETTLE_MS = 7000;

  const handleGraphConflict = useCallback(
    (_serverVersion: number, _serverMap?: any) => {
      const settled = Date.now() - workspaceMountedAtRef.current > CONFLICT_TOAST_SETTLE_MS;
      if (settled) {
        toast(
          isPolish
            ? 'Wykryto konflikt zmian. Odświeżam mapę z serwera.'
            : 'Change conflict detected. Refreshing map from server.',
          { icon: '⚠️' }
        );
      }
      // Always reconcile from the server, toast or not.
      conflictRefreshRef.current?.();
    },
    [isPolish]
  );

  const graphRuntime = useWorkspaceGraphRuntime({
    ideaId: realId,
    open: Boolean(realId && (!isNewInitial || realId !== ideaId)),
    locked: canvasLocked,
    preferredTool: activeTool,
    language: i18n.language || 'en',
    onConflict: handleGraphConflict,
  });
  // Wire refresh ref so handleGraphConflict can call it (ref avoids circular dep)
  conflictRefreshRef.current = graphRuntime.refresh;

  // MM-01: These are READ-ONLY derived state from the workspace graph runtime.
  // The canonical graph owner is ReactFlow state inside IdeaRecommendationMap.
  const graphNodes = graphRuntime.graph.nodes as any[];
  const graphEdges = graphRuntime.graph.edges as any[];
  const mapExtensions = graphRuntime.graph.extensions;
  const applyRuntimeExtensionsPatch = graphRuntime.applyExtensionsPatch;
  const captureRuntimeGraph = graphRuntime.captureToolGraph;
  const flushRuntimeGraph = graphRuntime.flushGraph;
  const refreshRuntimeGraph = graphRuntime.refresh;
  const replaceRuntimeGraph = graphRuntime.replaceGraph;
  const setRuntimeViewport = graphRuntime.setViewport;
  const graphLanes = useMemo(() => {
    const ext =
      mapExtensions?.processFlow &&
      typeof mapExtensions.processFlow === 'object' &&
      !Array.isArray(mapExtensions.processFlow)
        ? (mapExtensions.processFlow as Record<string, unknown>)
        : null;
    return Array.isArray(ext?.lanes) ? (ext.lanes as any[]) : [];
  }, [mapExtensions]);

  const whiteboardSession = useMemo(() => {
    const wb =
      mapExtensions?.whiteboard &&
      typeof mapExtensions.whiteboard === 'object' &&
      !Array.isArray(mapExtensions.whiteboard)
        ? (mapExtensions.whiteboard as Record<string, unknown>)
        : null;
    if (!wb) return undefined;
    return {
      role: (wb.sessionRole as string) || undefined,
      phase: (wb.facilitationPhase as string) || undefined,
      timerActive: !!wb.timerActive,
      followActive: !!wb.followMeActive,
      participantCount: typeof wb.participantCount === 'number' ? wb.participantCount : undefined,
    };
  }, [mapExtensions]);

  const whiteboardOutcomes = useMemo(() => {
    const wb =
      mapExtensions?.whiteboard &&
      typeof mapExtensions.whiteboard === 'object' &&
      !Array.isArray(mapExtensions.whiteboard)
        ? (mapExtensions.whiteboard as Record<string, unknown>)
        : null;
    const registry = Array.isArray(wb?.outcomeRegistry)
      ? (wb.outcomeRegistry as Array<{ type?: string; label?: string }>)
      : [];
    return registry.map((o) => ({
      type: o.type || 'outcome',
      label: o.label || '',
    }));
  }, [mapExtensions]);

  // Report compact graph summary to parent (for chat system prompt enrichment)
  useEffect(() => {
    if (!onGraphSummaryChange) return;
    if (!graphNodes || graphNodes.length === 0) {
      onGraphSummaryChange(null);
      return;
    }
    const parentMap = new Map<string, string>();
    const childrenMap = new Map<string, string[]>();
    for (const e of graphEdges) {
      const src = e.source || e.sourceId;
      const tgt = e.target || e.targetId;
      if (src && tgt) {
        parentMap.set(tgt, src);
        const ch = childrenMap.get(src) || [];
        ch.push(tgt);
        childrenMap.set(src, ch);
      }
    }
    const nodeMap = new Map(graphNodes.map((n: any) => [n.id, n]));
    const rootNodes = graphNodes.filter((n: any) => !parentMap.has(n.id));
    const rootLabel = rootNodes[0]?.data?.label || rootNodes[0]?.data?.text || title || 'Root';
    const topBranches = (childrenMap.get(rootNodes[0]?.id) || []).slice(0, 8).map((id) => {
      const n = nodeMap.get(id);
      return n?.data?.label || n?.data?.text || id;
    });

    const selectedNode = graphNodes.find((n: any) => n.selected);
    const parts = [
      `Total nodes: ${graphNodes.length}`,
      `Root: "${rootLabel}"`,
      topBranches.length > 0
        ? `Top branches: ${topBranches.map((b: string) => `"${b}"`).join(', ')}`
        : null,
      selectedNode
        ? `Selected: "${selectedNode.data?.label || selectedNode.data?.text || selectedNode.id}"`
        : null,
    ].filter(Boolean);
    onGraphSummaryChange(parts.join('; '));
  }, [graphNodes, graphEdges, title, onGraphSummaryChange]);

  // ── AI Proposals (Propose→Accept) ──────────────────────────────────────────
  const [proposalBatch, setProposalBatch] = useState<AIProposalBatch | null>(null);

  const applyProposalPatches = useCallback(
    async (proposals: AIProposal[]) => {
      const accepted = proposals.filter((p) => p.status === 'accepted');
      if (accepted.length === 0) return;
      try {
        const runtimeResult = applyAIProposalRuntime({
          proposals: accepted,
          nodes: [...graphNodes],
          edges: [...graphEdges],
          extensions: { ...mapExtensions },
          activeTool,
        });
        const { nodes, edges } = runtimeResult;
        const extensions = { ...runtimeResult.extensions };

        const governance =
          extensions.canvasGovernance &&
          typeof extensions.canvasGovernance === 'object' &&
          !Array.isArray(extensions.canvasGovernance)
            ? { ...(extensions.canvasGovernance as Record<string, unknown>) }
            : {};
        const aiReplayLog = Array.isArray(governance.aiReplayLog)
          ? (governance.aiReplayLog as CanvasAIReplayEntry[])
          : [];
        const replayEntry: CanvasAIReplayEntry = {
          id: `ai-replay-${Date.now()}`,
          tool: proposalBatch?.tool || activeTool,
          generatorType: proposalBatch?.generatorType || 'unknown',
          proposalIds: accepted.map((p) => p.id),
          rationale: accepted.map((p) => p.rationale),
          citations: accepted.flatMap((p) => p.citations || []),
          acceptedAt: new Date().toISOString(),
        };
        extensions.canvasGovernance = {
          ...governance,
          status: governance.status || 'draft',
          aiReplayLog: [...aiReplayLog, replayEntry].slice(-40),
          lastAiApplyAt: replayEntry.acceptedAt,
        };
        graphRuntime.captureToolGraph(
          {
            nodes: nodes as any[],
            edges: edges as any[],
            extensions,
          },
          { reason: 'ai', immediate: true }
        );
        await graphRuntime.flushGraph({ reason: 'ai' });
        window.dispatchEvent(
          new CustomEvent('idea-workspace-graph-update', {
            detail: { ideaId: realId, nodes, edges, extensions },
          })
        );
        if (runtimeResult.nextTool) {
          setFocusMode('full');
          setFocusObjectId(runtimeResult.focusObjectId || null);
          setActiveTool(runtimeResult.nextTool);
        }
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
    [
      activeTool,
      graphEdges,
      graphNodes,
      graphRuntime,
      isPolish,
      mapExtensions,
      proposalBatch?.generatorType,
      proposalBatch?.tool,
      realId,
    ]
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
  const handleConvertRef = useRef<(target: IdeaConvertTarget, nodeIds?: string[]) => void>(
    () => {}
  );
  const handleAcceptChallengeRef = useRef<() => void>(() => {});

  const handleQuickAction = useCallback(
    async (action: string, eventDetail?: Record<string, any>) => {
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

        const sel = selectionRef.current;
        const selectedIds = sel.ids || [];
        const liveNodes = graphNodesRef.current || [];
        const liveEdges = graphEdgesRef.current || [];
        const selectedSet = new Set(selectedIds);
        const realNodes = selectedIds.map((id, i) => {
          const live = liveNodes.find((n: any) => n.id === id);
          if (live) return live;
          return {
            id,
            type: sel.meta?.nodeType || 'default',
            position: { x: 0, y: 0 },
            data: {
              label: i === 0 && sel.meta?.label ? sel.meta.label : `Item ${i + 1}`,
              status: sel.meta?.status,
            },
          };
        });
        const relevantEdges = liveEdges.filter(
          (e: any) => selectedSet.has(e.source) && selectedSet.has(e.target)
        );
        const transformInput: TransformInput = {
          sourceTool: activeTool,
          nodes: realNodes,
          edges: relevantEdges,
          selectedIds,
        };

        const result = transformSelection(transformInput, targetTool);

        toast.success(
          isPolish
            ? `Przekształcanie zaznaczenia do: ${targetTool}`
            : `Transforming selection to: ${targetTool}`,
          { duration: 1200 }
        );
        setActiveTool(targetTool);

        if (result) {
          setTimeout(() => {
            if (result.type === 'mindmap' || result.type === 'whiteboard') {
              const items = result.data.nodes.map((n: any) => ({
                id: n.id,
                label: n.data?.label || '',
                nodeType: n.type,
                position: n.position,
                color: n.data?.color,
              }));
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items, ideaId: realId },
                })
              );
            } else if (result.type === 'table') {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: {
                    items: result.data.rows.map((r) => ({
                      id: r.id,
                      label: r.label,
                      nodeType: 'row',
                    })),
                    ideaId: realId,
                  },
                })
              );
            } else if (result.type === 'process_flow') {
              const items = result.data.nodes.map((n: any) => ({
                id: n.id,
                label: n.data?.label || '',
                nodeType: n.type,
                position: n.position,
                data: n.data,
              }));
              const insertEdges =
                (result.data as any).edges?.map((e: any) => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  label: e.data?.label || e.label,
                  data: e.data,
                })) ?? [];
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items, edges: insertEdges, ideaId: realId },
                })
              );
            }
          }, 400);
        }
        return;
      }

      // V51-30: Attach artifact — open real popover
      if (action === 'attach_artifact') {
        trackFunnelEvent('ideas_attach_artifact', { tool: activeTool });
        const sel2 = selectionRef.current;
        if (sel2.type === 'none' || !sel2.ids?.length) {
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
      if (action === 'open_export_menu') {
        setExportMenuOpen(true);
        return;
      }
      if (action === 'accept_challenge') {
        handleAcceptChallengeRef.current();
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
        wb_convert_decision: 'decision',
        wb_convert_action: 'task_set',
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
        const explicitNodeIds = Array.isArray(eventDetail?.nodeIds)
          ? eventDetail.nodeIds
          : undefined;
        handleConvertRef.current(target, explicitNodeIds);
        return;
      }

      if (action === 'mm_ai_suggest_links_execute') {
        const nodeId = eventDetail?.nodeId as string;
        const nodeLabel = eventDetail?.nodeLabel as string;
        if (!nodeId || !realId) return;

        try {
          const batch = await generateAIProposal({
            ideaId: realId,
            generatorType: 'ai_propose_attachments' as any,
            tool: activeTool,
            context: {
              seedText: seedText || '',
              title: title || '',
              existingNodes: graphNodesRef.current,
              existingEdges: graphEdgesRef.current,
              language: i18n.language || 'en',
              selection: {
                type: 'node',
                count: 1,
                ids: [nodeId],
                primaryId: nodeId,
              },
              targetNodeLabel: nodeLabel,
              targetNodeTags: eventDetail?.nodeTags || [],
              targetNodeSemanticType: eventDetail?.nodeSemanticType || '',
            },
          });
          if (batch?.proposals?.length) {
            setProposalBatch(batch);
            setActivePanel('tools');
            toast.success(
              isPolish
                ? `Znaleziono ${batch.proposals.length} propozycji powiązań`
                : `Found ${batch.proposals.length} link suggestions`
            );
          } else {
            toast(
              isPolish ? 'Nie znaleziono pasujących artefaktów' : 'No matching artifacts found',
              { icon: '🔍' }
            );
          }
        } catch (err: any) {
          toast.error(
            err?.message || (isPolish ? 'Nie udało się wyszukać powiązań' : 'Failed to find links')
          );
        }
        return;
      }

      trackFunnelEvent('ideas_quick_tool_used', { tool: activeTool, action });
      if (action === 'mm_select_mode') handleMindMapInteractionModeChange('select');
      if (action === 'mm_pan_mode') handleMindMapInteractionModeChange('pan');
      if (action === 'mm_connect_mode') handleMindMapInteractionModeChange('connect');
      if (action === 'switch_to_process_flow') {
        setActiveTool('process_flow');
        toast.success(isPolish ? 'Przełączono na przepływ procesu' : 'Switched to Process Flow');
        return;
      }
      externalOnQuickAction?.(action);
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', { detail: { action, ideaId: realId } })
      );
    },
    [
      activeTool,
      externalOnQuickAction,
      handleMindMapInteractionModeChange,
      isPolish,
      realId,
      setActiveTool,
    ]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const action = typeof detail.action === 'string' ? detail.action : '';
      if (!action) return;
      if (detail.ideaId && detail.ideaId !== realId) return;
      if (action === 'mm_ai_suggest_links_execute') {
        handleQuickAction(action, detail);
        return;
      }
      if (
        action.endsWith('_execute') ||
        action.startsWith('mm_') ||
        (action.startsWith('wb_') && !action.startsWith('wb_convert_')) ||
        (action.startsWith('pf_') && !action.startsWith('pf_convert_')) ||
        (action.startsWith('tbl_') && !action.startsWith('tbl_convert_')) ||
        action.startsWith('ctx_')
      ) {
        return;
      }
      if (
        action.startsWith('xform_to_') ||
        action === 'attach_artifact' ||
        action === 'open_linked_artifacts' ||
        action === 'accept_challenge' ||
        action === 'open_export_menu' ||
        action.startsWith('convert_') ||
        action.startsWith('wb_convert_') ||
        action.startsWith('pf_convert_') ||
        action.startsWith('tbl_convert_') ||
        action === 'switch_to_process_flow'
      ) {
        handleQuickAction(action, detail);
      }
    };

    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [handleQuickAction, realId]);

  const dispatchWorkspaceInsert = useCallback(
    (
      items: Array<{ label?: string; text?: string; type?: string; data?: Record<string, unknown> }>
    ) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-insert', {
          detail: { items, ideaId: realId },
        })
      );
    },
    [realId]
  );

  const handleApplyCanvasTheme = useCallback(
    (themeId: string) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-theme', {
          detail: { ideaId: realId, tool: activeTool, themeId },
        })
      );
      toast.success(isPolish ? `Zastosowano motyw: ${themeId}` : `Applied theme: ${themeId}`, {
        duration: 1200,
      });
    },
    [activeTool, isPolish, realId]
  );

  const handleApplyFlowSemantic = useCallback(
    (semantic: ProcessFlowSemanticKit) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-flow-semantic', {
          detail: { ideaId: realId, semantic },
        })
      );
      toast.success(isPolish ? `Aktywny kit: ${semantic}` : `Active kit: ${semantic}`, {
        duration: 1200,
      });
    },
    [isPolish, realId]
  );

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!realId) return;
      const template = findIdeaTemplate(templateId);
      if (!template) {
        toast.error(isPolish ? 'Nie znaleziono szablonu' : 'Template not found');
        return;
      }
      try {
        await applyIdeaTemplate({
          ideaId: realId,
          template,
          isPl: isPolish,
          activeTool,
          baseVersion: graphRuntime.graph.version,
          ideaTitle: title,
          seedText: seedText,
        });
        setMapRefreshToken((v) => v + 1);
        toast.success(isPolish ? 'Szablon zastosowany' : 'Template applied', { duration: 1200 });
      } catch (error: any) {
        if (error?.status === 409) {
          toast(
            isPolish
              ? 'Wykryto konflikt zmian. Odświeżam mapę z serwera.'
              : 'Change conflict detected. Refreshing map from server.',
            { icon: '⚠️' }
          );
          setMapRefreshToken((v) => v + 1);
        } else {
          toast.error(
            error?.message ||
              (isPolish ? 'Nie udało się zastosować szablonu' : 'Failed to apply template')
          );
        }
      }
    },
    [activeTool, graphRuntime.graph.version, isPolish, realId, seedText, title]
  );

  const orgContextRef = useRef<string | null>(null);
  const orgContextFetchedRef = useRef(false);

  const handleGenerateCanvasAI = useCallback(
    async (generatorType: string) => {
      if (!realId) return;
      // Fetch org context summary once for AI proposal enrichment
      if (!orgContextFetchedRef.current) {
        orgContextFetchedRef.current = true;
        try {
          const orgData = await Api.organizationContextGet();
          const parts: string[] = [];
          if (orgData?.summary) parts.push(orgData.summary);
          if (orgData?.claims?.length) {
            parts.push(
              `Key claims: ${orgData.claims
                .slice(0, 5)
                .map((c: any) => c.text || c.claim || c)
                .join('; ')}`
            );
          }
          if (orgData?.strategy) parts.push(`Strategy: ${orgData.strategy}`);
          orgContextRef.current = parts.join('\n') || null;
        } catch {
          orgContextRef.current = null;
        }
      }
      try {
        const batch = await generateAIProposal({
          ideaId: realId,
          generatorType: generatorType as any,
          tool: activeTool,
          context: {
            seedText: seedText || '',
            title: title || '',
            existingNodes: graphNodesRef.current,
            existingEdges: graphEdgesRef.current,
            existingLanes: graphLanes,
            language: i18n.language || 'en',
            organizationContext: orgContextRef.current || undefined,
            selection: {
              type: selection.type,
              count: selection.count,
              ids: selection.ids,
              primaryId: selection.primaryId,
            },
          } as any,
        });
        if (batch?.proposals?.length) {
          setProposalBatch(batch);
          setActivePanel('tools');
        } else {
          toast(
            isPolish
              ? 'AI nie zwróciło propozycji do review'
              : 'AI returned no proposals to review',
            {
              icon: '🤖',
            }
          );
        }
      } catch (error: any) {
        toast.error(
          error?.message || (isPolish ? 'Nie udało się uruchomić AI' : 'Failed to run AI')
        );
      }
    },
    [
      activeTool,
      graphLanes,
      i18n.language,
      isPolish,
      realId,
      seedText,
      selection.count,
      selection.ids,
      selection.primaryId,
      selection.type,
      setActivePanel,
      title,
    ]
  );

  // ── Panel management ────────────────────────────────────────────────────────
  const handlePanelChange = useCallback(
    (next: WorkspacePanelKey) => {
      setActivePanel(next);
    },
    [setActivePanel]
  );

  const toolsPanelOpen = activePanel === 'tools';
  const contextPanelOpen = activePanel === 'context';
  const aiPanelOpen = activePanel === 'ai_suggestions';

  useEffect(() => {
    if (activeTool !== 'table') {
      autoCollapsedTablePanelRef.current = false;
      return;
    }
    if (activePanel !== 'tools') return;
    if (autoCollapsedTablePanelRef.current) return;
    autoCollapsedTablePanelRef.current = true;
    setActivePanel(null);
  }, [activePanel, activeTool, setActivePanel]);

  const persistWorkspaceExtensions = useCallback(
    async (patch: Record<string, unknown>) => {
      if (isNewInitial && realId === ideaId) return;
      graphRuntime.applyExtensionsPatch(
        mergeWorkspaceExtensions(
          {
            processFlow: { lanes: graphLanes },
          },
          patch
        ),
        { reason: 'semantic', immediate: true }
      );
      await graphRuntime.flushGraph({ reason: 'manual' });
      setMapRefreshToken((v) => v + 1);
    },
    [graphLanes, graphRuntime, ideaId, isNewInitial, realId]
  );

  const handleGovernanceUpdate = useCallback(
    async (update: { status: string; note?: string; actor?: string }) => {
      const nextStatus = update.status as CanvasGovernanceStatus;
      const timestamp = new Date().toISOString();
      const entry = {
        id: `gov-${Date.now()}`,
        status: nextStatus,
        note: update.note,
        actor: update.actor || 'Canvas OS',
        createdAt: timestamp,
      };
      try {
        const governance =
          mapExtensions.canvasGovernance && typeof mapExtensions.canvasGovernance === 'object'
            ? (mapExtensions.canvasGovernance as Record<string, unknown>)
            : {};
        const reviewLog = Array.isArray(governance.reviewLog) ? governance.reviewLog : [];
        graphRuntime.applyExtensionsPatch(
          {
            processFlow: { lanes: graphLanes },
            canvasGovernance: {
              ...governance,
              status: nextStatus,
              lastReviewedAt: timestamp,
              reviewedBy: update.actor || 'Canvas OS',
              reviewedAt: timestamp,
              reviewNote: update.note || null,
              activeTool,
              reviewLog: [...reviewLog, entry].slice(-40),
            },
          },
          { reason: 'semantic', immediate: true }
        );
        await graphRuntime.flushGraph({ reason: 'manual' });
        setMapRefreshToken((v) => v + 1);
        toast.success(
          isPolish ? `Zapisano status review: ${nextStatus}` : `Saved review status: ${nextStatus}`
        );
      } catch (err: any) {
        toast.error(
          err?.message || (isPolish ? 'Nie udało się zapisać review' : 'Failed to save review')
        );
      }
    },
    [activeTool, graphLanes, graphRuntime, isPolish, mapExtensions.canvasGovernance, realId]
  );

  const handleImportGraph = useCallback(
    async (payload: IdeaWorkspaceImportPayload) => {
      if (!payload?.nodes || !payload?.edges) return;
      try {
        const extensionPatch = {
          interop: {
            lastImportAt: new Date().toISOString(),
            lastImportFormat: payload.sourceFormat,
            lastImportTitle: payload.title || null,
            mappingReport: payload.mappingReport || [],
          },
          ...(payload.extensions || {}),
        };
        graphRuntime.captureToolGraph(
          {
            nodes: payload.nodes as any[],
            edges: payload.edges as any[],
            extensions: mergeWorkspaceExtensions(
              {
                processFlow: { lanes: graphLanes },
              },
              extensionPatch
            ),
          },
          { reason: 'semantic', immediate: true }
        );
        await graphRuntime.flushGraph({
          reason: 'manual',
          createSnapshot: true,
          snapshotLabel: `import-${payload.sourceFormat}`,
        });
        setMapRefreshToken((v) => v + 1);
        toast.success(
          isPolish
            ? `Zaimportowano diagram (${payload.sourceFormat})`
            : `Imported diagram (${payload.sourceFormat})`
        );
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Import nie powiódł się' : 'Import failed'));
      }
    },
    [graphLanes, graphRuntime, isPolish]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as IdeaWorkspaceImportPayload;
      if (detail.ideaId && detail.ideaId !== realId) return;
      handleImportGraph(detail);
    };
    window.addEventListener(IDEA_WORKSPACE_IMPORT_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_IMPORT_EVENT, handler);
  }, [handleImportGraph, realId]);

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
        let createdRequest = draftIdeaBootstrapPromises.get(ideaId);
        if (!createdRequest) {
          createdRequest = Api.createMyIdea({
            title: initialIdeaTitle || (isPolish ? 'Nowe wyzwanie' : 'New challenge'),
            body: initialIdeaBody,
            tags: creationPayload?.tags || [],
            sourceType: creationPayload?.sourceType || 'manual',
            sourceConversationId: creationPayload?.sourceConversationId || null,
            sourceMessageId: creationPayload?.sourceMessageId || null,
          }).catch((error) => {
            draftIdeaBootstrapPromises.delete(ideaId);
            throw error;
          });
          draftIdeaBootstrapPromises.set(ideaId, createdRequest);
        }
        const created = await createdRequest;
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
          await Api.syncMyIdeaMap(nextId, {
            nodes,
            edges,
            baseVersion: Number(map.version || 1),
            preferredTool: preferredSeedSystem || undefined,
            extensions: buildStartupExtensions(seedIntent, creationPayload),
            reason: 'manual',
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

  // Run the (re)load only when the idea or language actually changes — NOT every
  // time `hydrate`'s identity changes. `hydrate` depends on parent-supplied props
  // (onSaved, creationPayload, seedIntent…) that get a fresh identity on every
  // MyWorkHub re-render; binding the effect to `hydrate` made it re-run after each
  // graph mutation (mutation → sync → parent re-render → new hydrate), which calls
  // setLoading(true) and REMOUNTS the whole workspace + canvas — wiping node
  // selection, the lastActive anchor and the undo stack on every single edit.
  // That remount cascade was the core "can't actually use it" bug. See M06 live
  // 2026-06-20. We keep a ref to the latest hydrate and only trigger on ideaId /
  // language so a normal edit never reloads.
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    hydrateRef.current();
  }, [ideaId, i18n.language]);

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
  const {
    showHelp: shortcutsHelpOpen,
    setShowHelp: setShortcutsHelpOpen,
    shortcuts,
  } = useKeyboardShortcuts({
    enabled: !loading && activeTool === 'mindmap',
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

  // Workspace-global shortcuts (active in every tool) — prepended to the
  // mindmap-only `shortcuts` so the help modal is accurate regardless of tool.
  const helpShortcuts = useMemo<ShortcutHelp[]>(() => {
    const isMacPlatform =
      typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    const globals: ShortcutHelp[] = [
      {
        key: 'Alt+1 / 2 / 3 / 4',
        description: isPolish
          ? 'Przełącz narzędzie (Mapa / Tablica / Przepływ / Tabela)'
          : 'Switch tool (Mind Map / Whiteboard / Process Flow / Table)',
        category: 'navigation',
      },
      {
        key: isMacPlatform ? '⌘F' : 'Ctrl+F',
        description: isPolish ? 'Szukaj w tej idei' : 'Search this idea',
        category: 'navigation',
      },
      {
        key: `Shift+1 / ${isMacPlatform ? '⌘0' : 'Ctrl+0'}`,
        description: isPolish ? 'Dopasuj widok (zoom to fit)' : 'Zoom to fit',
        category: 'navigation',
      },
    ];
    // `shortcuts` already starts with the '?' help row injected by the hook.
    return [...globals, ...shortcuts];
  }, [shortcuts, isPolish]);

  // Workspace-scoped commands injected into the command palette (⌘K).
  const workspaceCommands = useMemo<CommandItem[]>(() => {
    const closeAnd = (fn: () => void) => () => {
      fn();
      cmdPalette.close();
    };
    const toolCmd = (
      id: CanvasToolType,
      labelPl: string,
      labelEn: string,
      icon: React.ReactNode
    ): CommandItem => ({
      id: `ws-tool-${id}`,
      title: isPolish ? `Przełącz: ${labelPl}` : `Switch to ${labelEn}`,
      subtitle: isPolish ? 'Narzędzie workspace' : 'Workspace tool',
      icon,
      category: 'workspace',
      action: closeAnd(() => setActiveTool(id)),
      keywords: [labelPl, labelEn, 'tool', 'narzędzie', id],
    });
    return [
      toolCmd('mindmap', 'Mapa rekomendacji', 'Mind Map', <GitBranch size={18} />),
      toolCmd('whiteboard', 'Tablica', 'Whiteboard', <StickyNote size={18} />),
      toolCmd('process_flow', 'Przepływ', 'Process Flow', <Workflow size={18} />),
      toolCmd('table', 'Tabela', 'Table', <Table2 size={18} />),
      {
        id: 'ws-search',
        title: isPolish ? 'Szukaj w tej idei' : 'Search this idea',
        icon: <Search size={18} />,
        category: 'workspace',
        shortcut: '⌘F',
        action: closeAnd(() => setSearchOpen(true)),
        keywords: ['search', 'szukaj', 'find', 'znajdź'],
      },
      {
        id: 'ws-templates',
        title: isPolish ? 'Otwórz galerię szablonów' : 'Open template gallery',
        icon: <LayoutTemplate size={18} />,
        category: 'workspace',
        action: closeAnd(() => setTemplateGalleryOpen(true)),
        keywords: ['template', 'szablon', 'gallery', 'galeria'],
      },
      {
        id: 'ws-export',
        title: isPolish ? 'Eksportuj…' : 'Export…',
        icon: <Download size={18} />,
        category: 'workspace',
        action: closeAnd(() => setExportMenuOpen(true)),
        keywords: ['export', 'eksport', 'pdf', 'png', 'csv'],
      },
      {
        id: 'ws-help',
        title: isPolish ? 'Skróty klawiszowe' : 'Keyboard shortcuts',
        icon: <Keyboard size={18} />,
        category: 'workspace',
        shortcut: '?',
        action: closeAnd(() => setShortcutsHelpOpen(true)),
        keywords: ['help', 'pomoc', 'shortcuts', 'skróty', 'keyboard'],
      },
    ];
  }, [
    isPolish,
    cmdPalette,
    setActiveTool,
    setSearchOpen,
    setTemplateGalleryOpen,
    setExportMenuOpen,
    setShortcutsHelpOpen,
  ]);

  // Workspace-global keyboard: search (⌘F) + tool switch (Alt+1..4).
  // Active in EVERY tool (the useKeyboardShortcuts hook above is mindmap-only).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      // Alt+1..4 → switch tool. Use e.code (layout-independent: Option+1 on
      // macOS yields a special char, not "1"). Skip while typing.
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement | null;
        const typing =
          !!target &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
        if (typing) return;
        const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
        if (idx >= 0) {
          e.preventDefault();
          setActiveTool((['mindmap', 'whiteboard', 'process_flow', 'table'] as const)[idx]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setActiveTool]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== realId) return;
      if (typeof detail.open === 'boolean') {
        setVotingActive(detail.open);
      } else {
        setVotingActive((prev) => !prev);
      }
    };
    window.addEventListener('idea-whiteboard-toggle-voting-overlay', handler);
    return () => window.removeEventListener('idea-whiteboard-toggle-voting-overlay', handler);
  }, [realId]);

  const handleSearchHighlight = useCallback(
    (nodeId: string) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-highlight-node', { detail: { nodeId, ideaId: realId } })
      );
    },
    [realId]
  );

  // ── Graph data sync (for AI panels) ────────────────────────────────────────
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
  const latestSurfaceStateRef = useRef<Record<string, unknown>>({});
  const handleViewportReport = useCallback(
    (vp: { x: number; y: number; zoom: number }) => {
      const prev = lastViewportRef.current;
      if (prev && prev.x === vp.x && prev.y === vp.y && prev.zoom === vp.zoom) {
        return;
      }
      lastViewportRef.current = vp;
      setRuntimeViewport(vp);
    },
    [setRuntimeViewport]
  );

  useEffect(() => {
    graphNodesRef.current = graphNodes;
  }, [graphNodes]);

  useEffect(() => {
    graphEdgesRef.current = graphEdges;
  }, [graphEdges]);

  useEffect(() => {
    latestSurfaceStateRef.current = {
      focusMode,
      focusObjectId: focusObjectId || null,
      activeTool,
    };
  }, [activeTool, focusMode, focusObjectId]);

  useEffect(() => {
    if (!realId || isDraft) return;
    applyRuntimeExtensionsPatch(
      {
        surfaceState: {
          ...latestSurfaceStateRef.current,
          ...(lastViewportRef.current ? { viewport: lastViewportRef.current } : {}),
        },
      },
      { reason: 'draft' }
    );
  }, [activeTool, applyRuntimeExtensionsPatch, focusMode, focusObjectId, isDraft, realId]);

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

  // C5: Ideas → chat — serialize the current map into a markdown outline and
  // seed a Teresa conversation, so the user can then say "zrób z tego dokument".
  const mapHasNodes = (graphNodes?.length ?? 0) > 0;
  const handleDiscussWithTeresa = useCallback(() => {
    const liveNodes = graphNodesRef.current?.length ? graphNodesRef.current : graphNodes;
    const liveEdges = graphEdgesRef.current?.length ? graphEdgesRef.current : graphEdges;
    if (!liveNodes?.length) {
      toast(isPolish ? 'Mapa jest pusta' : 'The map is empty', { icon: '🗺️' });
      return;
    }
    const mapTitle = title || seedText?.slice(0, 80) || (isPolish ? 'Mapa myśli' : 'Mind map');
    const outline = ideaMapToMarkdown(
      { nodes: liveNodes, edges: liveEdges },
      { title: mapTitle, isPolish: Boolean(isPolish) }
    );
    const kickoff = isPolish
      ? `Oto mapa myśli „${mapTitle}". Omówmy ją i zaproponuj następne kroki:\n\n${outline}`
      : `Here is the mind map "${mapTitle}". Let's discuss it and propose next steps:\n\n${outline}`;
    trackFunnelEvent('ideas_discuss_with_teresa', {
      ideaId: realId,
      tool: activeTool,
      nodeCount: liveNodes.length,
    });

    // M06 Fala 2 §2.1 (flag ENABLE_TERESA_MINDMAP): route through the shared
    // entity-context hook so the conversation carries pmoContext.ideaId — a
    // second click on the same idea reuses the conversation (alreadyHasContext)
    // instead of always creating a new one. OFF preserves today's exact
    // behavior: local kickoff message with no entity-context.
    if (mindmapTeresaBridgeEnabled && realId) {
      openChatWithContext({
        entityType: 'idea',
        entityId: realId,
        entityName: mapTitle,
        contextData: { teresaPrompt: kickoff },
      });
      return;
    }
    openChat(kickoff);
  }, [
    activeTool,
    graphEdges,
    graphNodes,
    isPolish,
    mindmapTeresaBridgeEnabled,
    openChat,
    openChatWithContext,
    realId,
    seedText,
    title,
  ]);

  // Subscribe to idea-workspace-chat-prompt so any tool can send text to the chat panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const msg = detail?.message || detail?.prompt;
      if (typeof msg === 'string' && msg) {
        openChat(msg);
      } else {
        openChat();
      }
    };
    window.addEventListener('idea-workspace-chat-prompt', handler);
    return () => window.removeEventListener('idea-workspace-chat-prompt', handler);
  }, [openChat]);

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
  // Targets known to the SSOT registry (ideaConvertTargets.ts). Only `live` ones
  // have a server handler — `soon` ones must never be sent (CANON §4, no raw 400).
  const handleConvert = useCallback(
    async (target: IdeaConvertTarget, explicitNodeIds?: string[]) => {
      if (isDraft) return;
      if (!IDEA_CONVERT_TARGETS.some((t) => t.id === target)) {
        toast.error(
          isPolish
            ? 'Ten typ konwersji nie jest jeszcze wspierany'
            : 'This conversion target is not yet supported'
        );
        return;
      }
      if (!isLiveConvertTarget(target)) {
        toast(isPolish ? 'Ta konwersja będzie wkrótce' : 'This conversion is coming soon', {
          icon: '🔜',
        });
        return;
      }
      const nodeIds = explicitNodeIds?.length ? explicitNodeIds : selection.ids;
      setSaving(true);
      try {
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const wbContext =
          activeTool === 'whiteboard'
            ? {
                sourceTool: 'whiteboard' as const,
                facilitationPhase: whiteboardSession?.phase,
                outcomeCount: whiteboardOutcomes?.length || 0,
                outcomeSummary: (whiteboardOutcomes || [])
                  .slice(0, 10)
                  .map((o) => `[${o.type}] ${o.label}`)
                  .join('; '),
              }
            : undefined;
        const result = await Api.convertMyIdea(realId, {
          target: target as any,
          options: {
            language: i18n.language,
            ...(nodeIds?.length ? { nodeIds } : {}),
            ...(wbContext ? { whiteboardContext: wbContext } : {}),
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
            graphRuntime.applyExtensionsPatch(
              {
                outputLinks: [...(existingOutputLinks as any[]), newOutputLink],
              },
              { reason: 'semantic', immediate: true }
            );
            await graphRuntime.flushGraph({ reason: 'manual' });
          } catch {
            /* best-effort persistence */
          }

          window.dispatchEvent(
            new CustomEvent('idea-whiteboard-register-output', {
              detail: {
                ideaId: realId,
                target,
                outputId,
                nodeIds,
              },
            })
          );
        }

        // MM-15: Mark converted nodes with visual indicator
        if (nodeIds?.length) {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-mark-converted', {
              detail: { ideaId: realId, nodeIds, target },
            })
          );
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
    [
      activeTool,
      i18n.language,
      isDraft,
      isPolish,
      realId,
      selection.ids,
      whiteboardOutcomes,
      whiteboardSession,
    ]
  );

  handleConvertRef.current = handleConvert;
  handleAcceptChallengeRef.current = handleAcceptChallenge;

  // ── V51-30: Artifact attach handlers ──────────────────────────────────────
  const artifactCacheRef = useRef<Array<{
    type: ArtifactType;
    id: string;
    title: string;
    status?: string;
    owner?: string;
    artifactIndex?: string;
    ref?: string;
  }> | null>(null);

  const handleArtifactSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setArtifactSearchResults([]);
        return;
      }
      let cache = artifactCacheRef.current;
      if (!cache) {
        try {
          const all: Array<{
            type: ArtifactType;
            id: string;
            title: string;
            status?: string;
            owner?: string;
            artifactIndex?: string;
            ref?: string;
          }> = [];
          const [initiatives, tasks, decisions, notebookPages, analyses, meetings, tools] =
            await Promise.allSettled([
              Api.getInitiatives?.(),
              Api.getTasks?.(),
              Api.getDecisions?.(),
              Api.getNotebookPages?.({ limit: 100 }),
              Api.getDigitizationAnalyses?.({ pageSize: 100 }),
              Api.getMeetings?.(),
              Api.listToolSessions?.({ limit: 100 }),
            ]);
          const pushArtifact = (
            type: ArtifactType,
            id: unknown,
            title: unknown,
            extra?: { status?: unknown; owner?: unknown }
          ) => {
            const safeId = String(id || '').trim();
            const safeTitle = String(title || '').trim();
            if (!safeId || !safeTitle) return;
            all.push({
              type,
              id: safeId,
              title: safeTitle,
              status: extra?.status ? String(extra.status) : undefined,
              owner: extra?.owner ? String(extra.owner) : undefined,
              artifactIndex: buildArtifactCode(type, safeId),
              ref: buildArtifactRef(type, safeId),
            });
          };
          if (initiatives.status === 'fulfilled' && Array.isArray(initiatives.value)) {
            initiatives.value.forEach((i: any) =>
              pushArtifact('initiative', i.id, i.title || i.name, {
                status: i.status,
                owner: i.ownerName || i.owner,
              })
            );
          }
          if (tasks.status === 'fulfilled') {
            const arr = Array.isArray(tasks.value)
              ? tasks.value
              : (tasks.value as any)?.tasks || [];
            arr.forEach((t: any) =>
              pushArtifact('task', t.id, t.title || t.name, {
                status: t.status,
                owner: t.ownerName || t.assigneeName || t.owner,
              })
            );
          }
          if (decisions.status === 'fulfilled' && Array.isArray(decisions.value)) {
            decisions.value.forEach((d: any) =>
              pushArtifact('decision', d.id, d.title || d.name, {
                status: d.status,
                owner: d.ownerName || d.owner,
              })
            );
          }
          if (notebookPages.status === 'fulfilled' && Array.isArray(notebookPages.value)) {
            notebookPages.value.forEach((page: any) =>
              pushArtifact('notebook', page.id, page.title || page.name, {
                status: page.status,
                owner: page.ownerName || page.authorName,
              })
            );
          }
          if (analyses.status === 'fulfilled') {
            const arr = Array.isArray(analyses.value)
              ? analyses.value
              : (analyses.value as any)?.items || [];
            arr.forEach((analysis: any) =>
              pushArtifact('analysis', analysis.id, analysis.name || analysis.title, {
                status: analysis.status,
                owner: analysis.ownerName || analysis.owner,
              })
            );
          }
          if (meetings.status === 'fulfilled') {
            const arr = Array.isArray(meetings.value)
              ? meetings.value
              : (meetings.value as any)?.meetings || [];
            arr.forEach((meeting: any) =>
              pushArtifact(
                'meeting',
                meeting.id,
                meeting.title || meeting.name || meeting.subject,
                {
                  status: meeting.status,
                  owner: meeting.ownerName || meeting.organizerName || meeting.owner,
                }
              )
            );
          }
          if (tools.status === 'fulfilled') {
            const arr = Array.isArray((tools.value as any)?.items)
              ? (tools.value as any).items
              : [];
            arr.forEach((tool: any) =>
              pushArtifact('tool_session', tool.id, tool.name || tool.title || tool.toolType, {
                status: tool.status,
                owner: tool.createdBy,
              })
            );
          }
          graphNodesRef.current.forEach((node: any) => {
            const label = String(node?.data?.label || '').trim();
            if (!label) return;
            const semanticType = String(
              node?.data?.semanticType || node?.data?.type || node?.data?.shape || ''
            ).toLowerCase();
            if (semanticType.includes('role') || semanticType.includes('owner')) {
              pushArtifact('role', node.id, label, { status: node?.data?.status });
            } else if (semanticType.includes('system') || semanticType.includes('api')) {
              pushArtifact('system', node.id, label, { status: node?.data?.status });
            } else if (semanticType.includes('kpi') || semanticType.includes('metric')) {
              pushArtifact('kpi', node.id, label, { status: node?.data?.status });
            } else if (
              semanticType.includes('process') ||
              semanticType.includes('flow') ||
              semanticType.includes('task')
            ) {
              pushArtifact('process', node.id, label, { status: node?.data?.status });
            }
          });
          cache = all;
          artifactCacheRef.current = all;
        } catch {
          setArtifactSearchResults([]);
          return;
        }
      }
      const q = query.toLowerCase();
      setArtifactSearchResults(
        cache
          .filter((a) => {
            const code = a.artifactIndex || buildArtifactCode(a.type, a.id);
            const ref = a.ref || buildArtifactRef(a.type, a.id);
            const typeLabel = getArtifactLabel(a.type, i18n.language);
            const haystack = [a.title, a.type, typeLabel, code, ref, a.status || '', a.owner || '']
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          })
          .slice(0, 15)
      );
    },
    [i18n.language]
  );

  const handleArtifactAttach = useCallback(
    async (ref: { type: ArtifactType; id: string; title: string }, role: ArtifactLinkRole) => {
      const objectId = selection.ids?.[0];
      if (!objectId || isDraft) return;
      try {
        await Api.attachArtifactToObject(realId, objectId, {
          artifactRef: { type: ref.type, id: ref.id },
          artifactIndex: buildArtifactCode(ref.type, ref.id),
          label: ref.title,
          linkRole: role,
          baseVersion: graphRuntime.graph.version,
        });
        await graphRuntime.refresh();
        toast.success(isPolish ? `Dołączono: ${ref.title}` : `Attached: ${ref.title}`);
        trackFunnelEvent('ideas_artifact_attached', {
          ideaId: realId,
          objectId,
          artifactType: ref.type,
          role,
        });
      } catch (err: any) {
        const conflictVersion = getMapVersionFromPayload(err?.data);
        if (conflictVersion) {
          await graphRuntime.refresh().catch(() => {});
        }
        toast.error(err?.message || (isPolish ? 'Nie udało się dołączyć' : 'Failed to attach'));
      }
    },
    [graphRuntime, isDraft, isPolish, realId, selection.ids]
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
      smartObjectType: data?.smartObjectType || '',
      artifactLinks: data?.artifactLinks || [],
    });
    setNodeDetailOpen(true);
  }, []);

  const handleNodeDataChange = useCallback(
    async (nodeId: string, patch: Partial<ExtendedNodeData>) => {
      setNodeDetailData((prev) => ({ ...prev, ...patch }));
      // Save the node patch by writing the full map back through the SHARED
      // document — but on the AUTHORITATIVE version we read here, NOT
      // graphRuntime's internal counter. graphRuntime tracks its own
      // server version, which drifts out of date in tools (e.g. the
      // whiteboard) that own their node state and persist through a separate
      // sync owner. Routing the drawer's save through graphRuntime therefore
      // 409'd against the tool's newer version and the edit was silently lost.
      // Read fresh → patch → sync with that exact baseVersion, retrying once on
      // a 409 (the tool may have autosaved between our read and write).
      const applyOnce = async () => {
        const mapRes = await Api.getMyIdeaMap(realId, { language: i18n.language });
        const map = mapRes?.map || {};
        const nodes: any[] = Array.isArray(map.nodes) ? [...map.nodes] : [];
        const edges: any[] = Array.isArray(map.edges) ? [...map.edges] : [];
        const updatedNodes = nodes.map((n: any) =>
          String(n?.id) === nodeId ? { ...n, data: { ...(n.data || {}), ...patch } } : n
        );
        const extensions =
          map?.extensions && typeof map.extensions === 'object' && !Array.isArray(map.extensions)
            ? (map.extensions as Record<string, unknown>)
            : {};
        return Api.syncMyIdeaMap(realId, {
          nodes: updatedNodes,
          edges,
          baseVersion: Number(map?.version || 1),
          preferredTool: (map?.preferredTool as any) || activeTool,
          extensions,
          reason: 'semantic',
        });
      };
      try {
        try {
          await applyOnce();
        } catch (err: any) {
          if (err?.status === 409) {
            await applyOnce();
          } else {
            throw err;
          }
        }
        // Pull the freshly persisted map back into graphRuntime + the active
        // tool view so the edit is reflected without a manual reload.
        void graphRuntime.refresh();
        setMapRefreshToken((v) => v + 1);
      } catch {
        /* best-effort save */
      }
    },
    [activeTool, graphRuntime, i18n.language, realId]
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

  // Chat-triggered AI proposals: watch conversation store for mindmap-proposal blocks
  useEffect(() => {
    const seenIds = new Set<string>();
    const unsubscribe = useConversationStore.subscribe((state) => {
      if (activeTool !== 'mindmap') return;
      const msgs = state.activeMessages;
      if (!msgs?.length) return;
      const last = msgs[msgs.length - 1];
      if (!last || last.role === 'user' || seenIds.has(last.id)) return;
      const content = typeof last.content === 'string' ? last.content : '';
      const match = content.match(/```mindmap-proposal\s*\n([\s\S]*?)\n```/);
      if (!match?.[1]) return;
      seenIds.add(last.id);
      try {
        const parsed = JSON.parse(match[1]);
        const proposals: AIProposal[] = [];
        if (Array.isArray(parsed.addNodes)) {
          for (const n of parsed.addNodes) {
            proposals.push({
              id: `chat-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'graph_patch',
              rationale: `Add "${n.label}"`,
              confidence: 0.7,
              patch: {
                addNodes: [
                  {
                    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    label: n.label,
                    data: n.parentId ? { parentId: n.parentId } : undefined,
                  },
                ],
              },
              status: 'pending',
            });
          }
        }
        if (Array.isArray(parsed.renameNodes)) {
          for (const r of parsed.renameNodes) {
            proposals.push({
              id: `chat-rename-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: 'graph_patch',
              rationale: `Rename "${r.id}" to "${r.label}"`,
              confidence: 0.7,
              patch: { updateNodes: [{ id: r.id, data: { label: r.label } }] },
              status: 'pending',
            });
          }
        }
        if (proposals.length > 0) {
          const batch: AIProposalBatch = {
            id: `chat-batch-${Date.now()}`,
            tool: 'mindmap',
            generatorType: 'chat',
            proposals,
            createdAt: Date.now(),
          };
          setProposalBatch(batch);
          toast(isPolish ? 'AI zaproponowało zmiany w mapie' : 'AI proposed changes to the map', {
            icon: '🤖',
          });
        }
      } catch {
        // Invalid JSON — ignore
      }
    });
    return unsubscribe;
  }, [activeTool, isPolish]);

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

  // Quick task creation from mindmap node
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action !== 'create_task' || !detail?.taskTitle) return;
      if (!currentProjectId) {
        toast.error(isPolish ? 'Brak kontekstu projektu' : 'No project context');
        return;
      }
      try {
        const result = await Api.createTask({
          projectId: currentProjectId,
          title: detail.taskTitle,
          description: isPolish
            ? `Zadanie utworzone z mapy myśli (węzeł: ${detail.nodeId || 'nieznany'})`
            : `Task created from mindmap (node: ${detail.nodeId || 'unknown'})`,
          status: 'todo',
        });
        if (result?.id && detail.nodeId) {
          const node = graphNodes.find((n: any) => n.id === detail.nodeId);
          if (node) {
            const existing = Array.isArray(node.data?.artifactLinks) ? node.data.artifactLinks : [];
            const newLink = {
              type: 'task' as ArtifactType,
              id: result.id,
              code: buildArtifactCode('task', result.id),
              ref: buildArtifactRef('task', result.id),
              label: getArtifactLabel('task', isPolish ? 'pl' : 'en'),
              name: detail.taskTitle,
              role: 'output' as ArtifactLinkRole,
              createdAt: new Date().toISOString(),
            };
            const updatedNodes = graphNodes.map((n: any) =>
              n.id === detail.nodeId
                ? { ...n, data: { ...n.data, artifactLinks: [...existing, newLink] } }
                : n
            );
            replaceRuntimeGraph({ nodes: updatedNodes });
          }
        }
      } catch {
        toast.error(isPolish ? 'Nie udało się utworzyć zadania' : 'Failed to create task');
      }
    };
    window.addEventListener('idea-mindmap-node-quick-action', handler);
    return () => window.removeEventListener('idea-mindmap-node-quick-action', handler);
  }, [currentProjectId, graphNodes, graphRuntime, isPolish]);

  // V51-19: Interview insight -> Idea evidence listener
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id || !detail?.type || isDraft || !realId) return;
      const objectId = selection.ids?.[0] || graphNodes?.[0]?.id;
      if (!objectId) return;
      try {
        await Api.attachArtifactToObject(realId, objectId, {
          artifactRef: {
            type: detail.type === 'insight' ? 'interview' : detail.type,
            id: detail.id,
          },
          artifactIndex: `INT-${detail.id}`,
          label: detail.title || 'Interview insight',
          linkRole: 'evidence',
          baseVersion: graphRuntime.graph.version,
        });
        await graphRuntime.refresh();
        toast.success(isPolish ? 'Dodano dowód z wywiadu' : 'Interview evidence attached');
      } catch (err: any) {
        const conflictVersion = getMapVersionFromPayload(err?.data);
        if (conflictVersion) {
          await graphRuntime.refresh().catch(() => {});
        }
        toast.error(isPolish ? 'Nie udało się dołączyć' : 'Failed to attach');
      }
    };
    window.addEventListener('interview-attach-to-idea', handler);
    return () => window.removeEventListener('interview-attach-to-idea', handler);
  }, [graphNodes, graphRuntime, isDraft, isPolish, realId, selection.ids]);

  // Intent-led starting point applied from TemplatesPopover
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.seedText) return;
      setSeedText(detail.seedText);
      setDirty(true);
      if (
        detail.preferredSystem &&
        ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(detail.preferredSystem) &&
        detail.preferredSystem !== activeTool
      ) {
        setActiveTool(detail.preferredSystem as CanvasToolType);
      }
      const prompt = isPolish
        ? `Zacznij budowę workspace na bazie intencji: "${detail.label || ''}". Preferowany system: ${detail.preferredSystem || activeTool}.\n\n${detail.seedText}`
        : `Start building the workspace based on the intent: "${detail.label || ''}". Preferred system: ${detail.preferredSystem || activeTool}.\n\n${detail.seedText}`;
      openChat(prompt);
    };
    window.addEventListener('idea-workspace-apply-intent', handler);
    return () => window.removeEventListener('idea-workspace-apply-intent', handler);
  }, [activeTool, isPolish, openChat, setActiveTool]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== realId) return;
      setExportMenuOpen(true);
    };
    window.addEventListener('idea-workspace-open-export-menu', handler);
    return () => window.removeEventListener('idea-workspace-open-export-menu', handler);
  }, [realId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== realId) return;
      setWhiteboardFacilitation({
        timerEndsAt:
          typeof detail?.sessionState?.timerEndsAt === 'number'
            ? detail.sessionState.timerEndsAt
            : null,
        voteSummary:
          detail.voteSummary && typeof detail.voteSummary === 'object' ? detail.voteSummary : {},
        myVoteCounts:
          detail.myVoteCounts && typeof detail.myVoteCounts === 'object' ? detail.myVoteCounts : {},
      });
    };
    window.addEventListener('idea-whiteboard-facilitation-state', handler);
    return () => window.removeEventListener('idea-whiteboard-facilitation-state', handler);
  }, [realId]);

  const handleDrillUp = useCallback((toIndex: number) => {
    setDrillDownStack((prev) => prev.slice(0, toIndex));
    setMapRefreshToken((v) => v + 1);
  }, []);

  // ── Draft saved label ───────────────────────────────────────────────────────
  const draftSavedLabel = useMemo(() => {
    if (saving) return isPolish ? 'Zapisuję…' : 'Saving…';
    if (!lastSavedAt) return 'Draft';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
  }, [isPolish, lastSavedAt, saving]);
  const activeToolLabel = useMemo(
    () => getIdeaWorkspaceToolLabel(activeTool, Boolean(isPolish)),
    [activeTool, isPolish]
  );
  const workspaceNextStepLabel = useMemo(() => {
    if (selection.type !== 'none') {
      return isPolish
        ? 'Dopracuj zaznaczenie w panelu Tools albo rozwiń je na aktywnym canvasie.'
        : 'Refine the current selection in Tools or expand it on the active canvas.';
    }
    if (activePanel !== 'tools') {
      return isPolish
        ? 'Otwórz panel Tools, aby nadać temu pomysłowi następny konkretny ruch.'
        : 'Open the Tools panel to give this idea a concrete next move.';
    }
    switch (activeTool) {
      case 'mindmap':
        return isPolish
          ? 'Zacznij od głównego problemu i dołóż pierwszą gałąź rekomendacji.'
          : 'Start with the core problem and add the first recommendation branch.';
      case 'whiteboard':
        return isPolish
          ? 'Naszkicuj warianty i zgrupuj najmocniejszy kierunek.'
          : 'Sketch options and cluster the strongest direction.';
      case 'process_flow':
        return isPolish
          ? 'Rozpisz główne kroki, właścicieli i blokery przepływu.'
          : 'Map the main steps, owners, and blockers in the flow.';
      case 'table':
        return isPolish
          ? 'Przełóż pomysł na uporządkowane wiersze, żeby przygotować dalsze decyzje.'
          : 'Translate the idea into structured rows to prepare the next decisions.';
      default:
        return isPolish
          ? 'Nadaj tej idei kolejny konkretny ruch.'
          : 'Give this idea the next concrete move.';
    }
  }, [activePanel, activeTool, isPolish, selection.type]);
  // top-14 (56px) keeps the breadcrumb/header card BELOW the tool's top toolbar (~44px) so it
  // never covers the left toolbar buttons (Create / Draw / Undo / Voting). Previously top-4
  // overlapped the toolbar, making Create hard to reach on the whiteboard/mindmap canvas.
  const workspaceHeaderOffsetClass =
    drillDownStack.length > 0 || focusMode !== 'full' ? 'top-20' : 'top-14';

  if (loading) {
    return (
      <div className="h-full w-full bg-[var(--c-surface)] p-6">
        <LoadingState template="panel" />
      </div>
    );
  }

  return (
    <div
      ref={workspaceRootRef}
      className="w-full h-full flex overflow-hidden bg-c-surface-raised dark:bg-c-surface"
      style={{ touchAction: 'none' }}
      role="region"
      aria-label={isPolish ? 'Obszar roboczy mapy idei' : 'Idea map workspace'}
      // Signals the global command palette to yield Cmd+K to this scoped palette.
      data-local-command-palette="idea-map"
    >
      {/* Canvas area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 min-w-0 h-full relative"
        role="group"
        aria-label={isPolish ? 'Płótno idei i narzędzia mapy' : 'Idea canvas and map tools'}
      >
        {/* Breadcrumb for drill-down navigation */}
        {drillDownStack.length > 0 && (
          <div className="absolute top-2 left-4 z-[60] flex items-center gap-1 bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm rounded-xl px-3 py-1.5 border border-c-border-subtle dark:border-c-border shadow-sm">
            <button
              onClick={() => handleDrillUp(0)}
              className="text-[10px] font-semibold text-c-text-secondary dark:text-c-text-muted hover:underline"
            >
              {isPolish ? 'Główna mapa' : 'Root map'}
            </button>
            {drillDownStack.map((item, i) => (
              <React.Fragment key={item.nodeId}>
                <span className="text-[10px] text-c-text-secondary mx-0.5">/</span>
                <button
                  onClick={() => handleDrillUp(i + 1)}
                  className={`text-[10px] font-medium truncate max-w-[120px] ${
                    i === drillDownStack.length - 1
                      ? 'text-c-text-secondary dark:text-c-text'
                      : 'text-c-text-secondary dark:text-c-text-muted hover:underline'
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
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[58] flex items-center gap-2 bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm rounded-xl px-3 py-1.5 border border-c-border-subtle dark:border-c-border shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wide text-c-text-secondary dark:text-c-text">
              {focusMode === 'system'
                ? isPolish
                  ? `Tryb skupiony: ${activeToolLabel}`
                  : `Focused: ${activeToolLabel}`
                : isPolish
                  ? 'Tryb obiektu'
                  : 'Object focus'}
            </span>
            <button
              onClick={handleExitFocus}
              className="text-[10px] font-semibold text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text transition-colors"
            >
              {isPolish ? '← Pełny canvas' : '← Full canvas'}
            </button>
          </div>
        )}

        <div
          className={`absolute ${workspaceHeaderOffsetClass} left-20 z-[57] max-w-[28rem] rounded-2xl border border-c-border-subtle bg-c-surface-raised px-4 py-3 shadow-sm backdrop-blur-sm dark:border-c-border dark:bg-c-surface`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {/* A4: breadcrumb — Ideas › {idea title} › {tool} */}
            <button
              type="button"
              onClick={() => navigate('/my-work')}
              className="text-[11px] font-semibold text-c-text-secondary hover:underline dark:text-c-text-muted"
            >
              {isPolish ? 'Idee' : 'Ideas'}
            </button>
            <span className="text-[10px] text-c-text-secondary" aria-hidden="true">
              ›
            </span>
            <span
              className="max-w-[14rem] truncate text-[11px] font-semibold text-c-text-secondary dark:text-c-text"
              title={title || (isPolish ? 'Bez tytułu' : 'Untitled')}
            >
              {title ||
                safeTitleFromSeed(seedText, isPolish) ||
                (isPolish ? 'Bez tytułu' : 'Untitled')}
            </span>
            <span className="text-[10px] text-c-text-secondary" aria-hidden="true">
              ›
            </span>
            <span className="rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] font-medium text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-muted">
              {activeToolLabel}
            </span>
            {(() => {
              const rootNode = graphNodes.find(
                (n: any) =>
                  n.id === 'root' || !graphEdges.some((e: any) => (e.target || e.targetId) === n.id)
              );
              const ps = rootNode?.data?.pipelineStage;
              if (!ps || ps === 'draft') return null;
              return (
                <span className="rounded-full bg-c-surface dark:bg-c-surface-raised px-2 py-0.5 text-[10px] font-medium text-c-text-secondary dark:text-c-text border border-c-border-subtle dark:border-c-border">
                  {ps}
                </span>
              );
            })()}
            <span className="text-[10px] text-c-text-secondary dark:text-c-text-secondary">
              {draftSavedLabel}
            </span>
          </div>
          {/*
           * UI-L14 (Editor Shell Canon §2 GÓRNA): the title already lives in the
           * breadcrumb above, so we no longer repeat it as a heading. The next-step
           * hint is an empty-state affordance — it only helps before there's a graph,
           * so we hide it once the canvas has content instead of hovering over the work.
           */}
          {!mapHasNodes && (
            <div className="mt-2 text-[11px] leading-5 text-c-text-secondary dark:text-c-text-muted">
              {workspaceNextStepLabel}
            </div>
          )}
        </div>

        {/* V5-IDEA-13: Pinned card info now merged into IdeaRecommendationMap top-left header */}

        {/* Ghost cards — AI gap suggestions */}
        {isAccepted &&
          (activeTool === 'whiteboard' ||
            activeTool === 'mindmap' ||
            activeTool === 'process_flow') && (
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
          timerSeconds={activeTool === 'whiteboard' ? undefined : 120}
          timerEndsAt={activeTool === 'whiteboard' ? whiteboardFacilitation.timerEndsAt : null}
          ideaId={realId}
          currentUserId={currentUserId}
          nodes={graphNodes}
          voteCounts={activeTool === 'whiteboard' ? whiteboardFacilitation.voteSummary : undefined}
          myVoteCounts={
            activeTool === 'whiteboard' ? whiteboardFacilitation.myVoteCounts : undefined
          }
          persistent={activeTool === 'whiteboard'}
          onVotesChange={(votes) => {
            if (activeTool !== 'whiteboard') {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-votes-update', {
                  detail: { votes, ideaId: realId },
                })
              );
            }
          }}
        />

        {/* Canvas tools — each wrapped in error boundary for resilience */}
        {activeTool === 'mindmap' && (
          <CanvasToolErrorBoundary
            key={`eb-mindmap-${realId}`}
            toolName={isPolish ? 'Mapa rekomendacji' : 'Recommendation map'}
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaRecommendationMap
              ideaId={realId}
              ideaTitle={title || safeTitleFromSeed(seedText, isPolish)}
              onClose={() => setMapOpen(false)}
              onCenterEdit={() => handlePanelChange('tools')}
              preferredTool={activeTool}
              extensions={mapExtensions}
              onPreferredToolLoaded={(tool) => {
                if (!tool) return;
                if (userSelectedToolRef.current) return;
                if (tool === activeTool) return;
                setTimeout(() => setActiveTool(tool), 0);
              }}
              variant={mapOpen ? 'overlay' : 'embedded'}
              showClose={mapOpen}
              className={mapOpen ? '' : 'rounded-none'}
              locked={canvasLocked}
              onSelectionChange={handleSelectionChange}
              onViewportReport={handleViewportReport}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
              onFullscreenToggle={toggleWorkspaceFullscreen}
              isFullscreen={isFullscreen}
              stage={stage}
              seedText={seedText}
              onEditCard={() => handlePanelChange('tools')}
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
              graphNodeCount={graphNodes.length}
              evidenceCount={
                graphNodes.filter(
                  (n: any) =>
                    n?.kind === 'evidence_card' ||
                    n?.kind === 'knowledge_card' ||
                    n?.kind === 'artifact_ref'
                ).length
              }
              onOpenChat={openChat}
              interactionMode={mindMapInteractionMode}
              onInteractionModeChange={handleMindMapInteractionModeChange}
              externalRuntime={{
                version: graphRuntime.graph.version,
                loading: graphRuntime.loading,
                saving: graphRuntime.saving,
                lastSavedAt: graphRuntime.lastSavedAt,
                syncState: graphRuntime.syncState,
                nodes: graphNodes as any,
                edges: graphEdges as any,
                extensions: mapExtensions,
                captureGraph: graphRuntime.captureToolGraph,
                flushGraph: graphRuntime.flushGraph,
                refresh: graphRuntime.refresh,
              }}
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
              preferredPlatformTableId={activeTool === 'table' ? deepLinkedTableId : null}
              preferredViewId={activeTool === 'table' ? deepLinkedViewId : null}
              locked={canvasLocked}
              refreshToken={mapRefreshToken}
              onSelectionChange={handleSelectionChange}
              onGraphChange={replaceRuntimeGraph}
              onConvert={(target) =>
                handleConvert(target === 'task' ? 'task_set' : (target as any))
              }
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
              onTableContextChange={setTableContext}
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
              locked={canvasLocked}
              refreshToken={mapRefreshToken}
              onSelectionChange={handleSelectionChange}
              onGraphChange={replaceRuntimeGraph}
              onNodeDetail={handleOpenNodeDetail}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
              onFullscreenToggle={toggleWorkspaceFullscreen}
              isFullscreen={isFullscreen}
              onOpenChat={openChat}
              onQuickAction={handleQuickAction}
              externalRuntime={{
                version: graphRuntime.graph.version,
                loading: graphRuntime.loading,
                saving: graphRuntime.saving,
                lastSavedAt: graphRuntime.lastSavedAt,
                syncState: graphRuntime.syncState,
                nodes: graphNodes as any,
                edges: graphEdges as any,
                extensions: mapExtensions,
                captureGraph: graphRuntime.captureToolGraph,
                flushGraph: graphRuntime.flushGraph,
                refresh: graphRuntime.refresh,
              }}
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
              locked={canvasLocked}
              title={title}
              seedText={seedText}
              refreshToken={mapRefreshToken}
              onSelectionChange={handleSelectionChange}
              onGraphChange={replaceRuntimeGraph}
              onNodeDetail={handleOpenNodeDetail}
              focusMode={toolFocusMode}
              focusObjectId={focusObjectId}
              drillFocusNodeId={
                drillDownStack.length > 0 ? drillDownStack[drillDownStack.length - 1].nodeId : null
              }
              onFullscreenToggle={toggleWorkspaceFullscreen}
              isFullscreen={isFullscreen}
            />
          </CanvasToolErrorBoundary>
        )}

        {/* UI overlays rendered AFTER canvas tools so they appear on top */}
        <CanvasLeftToolbar
          activeTool={activeTool}
          interactionMode={mindMapInteractionMode}
          selection={selection}
          isAccepted={isAccepted}
          ideaId={realId}
          canvasContainerRef={canvasContainerRef}
          canUndo={mmCanUndo}
          canRedo={mmCanRedo}
          heuristicAiEnabled={heuristicAiOverlaysEnabled}
          onAction={(action) => handleQuickAction(action)}
          onOpenChat={() => {
            setChatKickoffMessage('');
            if (isChatCollapsed) toggleChatCollapse();
          }}
          onApplyTemplate={handleApplyTemplate}
          onOpenTemplateGallery={() => setTemplateGalleryOpen(true)}
        />

        {/* MM-12: AI Governance badge — opens governance panel */}
        <div className="absolute left-[4.5rem] top-4 z-[56]">
          <AIGovernanceBadge
            mapExtensions={mapExtensions}
            onClick={() => setGovernancePanelOpen(true)}
          />
        </div>

        <IdeaWorkspaceToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          familyCounts={familyCounts}
          onSearch={() => setSearchOpen(true)}
          onShowHelp={() => setShortcutsHelpOpen(true)}
          onDiscuss={handleDiscussWithTeresa}
          discussDisabled={!mapHasNodes}
        />

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
        graphNodes={graphNodes}
        graphEdges={graphEdges}
        evidenceCount={graphNodes.filter((n: any) => n?.data?.evidenceLinks?.length > 0).length}
        onAISummarize={() => handleQuickAction('mm_ai_summarize')}
        onAIExpand={() => handleQuickAction('mm_ai_expand')}
        onLayoutChange={(mode) => {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-node-quick-action', {
              detail: { action: 'set_layout_mode', layoutMode: mode },
            })
          );
        }}
        onThemeChange={(theme) => {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-node-quick-action', {
              detail: { action: 'set_map_theme', theme },
            })
          );
        }}
        onStyleChange={(patch) => {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-node-quick-action', {
              detail: { action: 'apply_style', ...patch },
            })
          );
        }}
        onFitView={() => {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-node-quick-action', {
              detail: { action: 'pane_fit_view' },
            })
          );
        }}
        onAutoLayout={() => {
          window.dispatchEvent(
            new CustomEvent('idea-mindmap-node-quick-action', {
              detail: { action: 'pane_auto_layout' },
            })
          );
        }}
        whiteboardSession={whiteboardSession}
        whiteboardOutcomes={whiteboardOutcomes}
      />

      <IdeaContextPanel
        open={contextPanelOpen}
        onClose={() => handlePanelChange(null)}
        ideaId={realId}
        title={title || safeTitleFromSeed(seedText, isPolish)}
        selectedNodeId={selection.ids?.[0] || null}
        selectionMeta={selection.type === 'node' && selection.count === 1 ? selection.meta : null}
        refreshToken={mapRefreshToken}
        liveGraphNodes={graphNodes}
        liveGraphEdges={graphEdges}
        mapExtensions={mapExtensions}
        activeTool={activeTool}
        stage={stage}
        seedText={seedText}
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
        selectedNodeId={selection.ids?.[0] || null}
        onSendToChat={openChat}
        onInsertToWorkspace={(items) => {
          const anchorNodeId = selection.ids?.[0] || null;
          const batch: AIProposalBatch = {
            id: `ai-suggestions-${Date.now()}`,
            tool: activeTool,
            generatorType: 'ai_suggestions_panel',
            createdAt: Date.now(),
            proposals: items.map((item, index) => {
              const nodeId = `ai-suggestion-${Date.now()}-${index}`;
              const anchorNode = anchorNodeId
                ? graphNodes.find((node: any) => String(node?.id) === String(anchorNodeId))
                : null;
              return {
                id: `proposal-${nodeId}`,
                type: 'graph_patch' as const,
                rationale: item.text,
                confidence: 0.74,
                targetTool: activeTool,
                focusNodeId: anchorNodeId || undefined,
                resultSummary: item.text,
                status: 'pending' as const,
                patch: {
                  addNodes: [
                    {
                      id: nodeId,
                      label: item.text,
                      type: 'idea',
                      position: anchorNode
                        ? {
                            x: Number(anchorNode?.position?.x || 0) + 220,
                            y: Number(anchorNode?.position?.y || 0) + index * 80,
                          }
                        : { x: 240 + index * 40, y: 180 + index * 70 },
                      data: {
                        label: item.text,
                        semanticType: item.type,
                        sourceType: 'ai',
                      },
                    },
                  ],
                  ...(anchorNodeId && activeTool === 'mindmap'
                    ? {
                        addEdges: [
                          {
                            id: `edge-${nodeId}`,
                            source: anchorNodeId,
                            target: nodeId,
                            data: { edgeRole: 'structural', sourceType: 'ai' },
                          },
                        ],
                      }
                    : {}),
                },
              };
            }),
          };
          setProposalBatch(batch);
          setActivePanel('tools');
        }}
        graphNodes={graphNodes}
        graphEdges={graphEdges}
      />

      {/* MM-12: AI Governance Panel */}
      <AIGovernancePanel
        open={governancePanelOpen}
        onClose={() => setGovernancePanelOpen(false)}
        mapExtensions={mapExtensions}
        graphNodes={graphNodes}
        currentUserName={String(
          [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') ||
            currentUser?.email ||
            'User'
        )}
        onGovernanceUpdate={handleGovernanceUpdate}
      />

      <IdeaTemplateGallery
        open={templateGalleryOpen}
        onClose={() => setTemplateGalleryOpen(false)}
        ideaId={realId}
        activeTool={activeTool}
        onApplied={() => setMapRefreshToken((v) => v + 1)}
        baseVersion={graphRuntime.graph.version}
        existingNodeCount={graphNodes.length}
      />

      <IdeaExportMenu
        open={exportMenuOpen}
        onClose={() => setExportMenuOpen(false)}
        ideaId={realId}
        title={title || safeTitleFromSeed(seedText, isPolish)}
        graphNodes={graphNodes}
        graphEdges={graphEdges}
        extensions={{
          processFlow: { lanes: graphLanes },
          activeTool,
        }}
        canvasContainerRef={canvasContainerRef}
        onImportGraph={handleImportGraph}
      />

      <IdeaNodeDetailDrawer
        open={nodeDetailOpen}
        onClose={() => setNodeDetailOpen(false)}
        nodeId={nodeDetailId}
        nodeData={nodeDetailData}
        ideaId={realId}
        activeTool={activeTool}
        locked={canvasLocked}
        allNodes={graphNodes}
        mapVersion={graphRuntime.graph.version}
        onMapConflictRefresh={graphRuntime.refresh}
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

      <CommandPalette
        isOpen={cmdPalette.isOpen}
        onClose={cmdPalette.close}
        extraCommands={workspaceCommands}
      />

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
        shortcuts={helpShortcuts}
      />
    </div>
  );
};

export default IdeaMapWorkspace;
