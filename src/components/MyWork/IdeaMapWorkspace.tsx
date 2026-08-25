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

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { LoadingState, SkeletonState } from '@/components/shared/states';
import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';
import { IdeaRightPanel } from '@/components/standard/IdeaRightPanel';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import i18n from '@/i18n';
import { Api, getMapVersionFromPayload } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { generateAIProposal } from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { buildIdeaWorkspacePath } from '@/routes/ideaWorkspaceNavigation';
import { isEvidencePanelEnabled } from '@/utils/evidencePanelFlag';
import { isIdeaDetailsInPanelEnabled } from '@/utils/ideaDetailsInPanelFlag';
import { isIdeaInspectorRightRailEnabled } from '@/utils/ideaInspectorRightRailFlag';
import { IDEA_TOP_BAR_SLOT_ID, isIdeaTopBarOneLineEnabled } from '@/utils/ideaTopBarOneLineFlag';
import { isVf1CanvasSpecAEnabled } from '@/utils/vf1CanvasSpecAFlag';

import {
  ARTIFACT_IDENTITY,
  type ArtifactLinkRole,
  type ArtifactType,
  buildArtifactCode,
  buildArtifactRef,
  getArtifactLabel,
  getArtifactPath,
} from '../../utils/artifactLinks';
import { ArtifactAttachPopover } from '../shared/NModeBlocks/ArtifactAttachPopover';
import { applyAIProposalRuntime } from './aiProposalRuntime';
import type { ProcessFlowSemanticKit } from './canvas/canvasOsContract';
import { useIdeasTeresaBridge } from './canvas/useIdeasTeresaBridge';
import { mergeWorkspaceExtensions, useWorkspaceGraphRuntime } from './canvas/workspaceGraphRuntime';
import { type CommandItem, CommandPalette, useCommandPalette } from './CommandPalette';
import { type ShortcutHelp, useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import {
  buildIdeaCanvasRightRailTools,
  buildIdeaMenu1Chips,
  buildIdeaMenu3Actions,
} from './ideaCanvasMelsChips';
import { IdeaCanvasMelsView } from './IdeaCanvasMelsView';
import { IdeaSaveIndicator, IdeaStageChip, IdeaToolIcon } from './IdeaCanvasMenu1Bits';
import { IdeaCanvasSecondBar } from './IdeaCanvasSecondBar';
import { IdeaContextPanel } from './IdeaContextPanel';
import {
  IdeaElementInspector,
  type IdeaInspectorItem,
  type IdeaInspectorTool,
} from './panel/IdeaElementInspector';
import { ConversionPreviewDialog, type ConversionPreviewData } from './ConversionPreviewDialog';
import { IdeaConvertMenu } from './IdeaConvertMenu';
import {
  getConvertTargetMeta,
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
import { IdeaTeresaSection } from './IdeaTeresaSection';
import { subscribeIdeaUndoState } from './ideaUndoStateBus';
import { IdeaUnifiedSearch } from './IdeaUnifiedSearch';
import { IdeaVotingMode } from './IdeaVotingMode';
import { IdeaWhiteboardTool } from './IdeaWhiteboardTool';
import { getIdeaWorkspaceToolLabel, IdeaWorkspaceToolbar } from './IdeaWorkspaceToolbar';
import {
  IDEA_PANEL_SECTIONS,
  type IdeaPanelSection,
  IdeaWorkspaceTools,
} from './IdeaWorkspaceTools';
import { AIGovernanceBadge, AIGovernancePanel } from './mindmap/AIGovernancePanel';
import { CanvasLeftToolbar } from './mindmap/CanvasLeftToolbar';
import { IdeaViewSwitcher } from './mindmap/IdeaViewSwitcher';
import { stabilizeMindmapInteractionMode } from './mindmap/mindmapInteractionGrammar';
import { SnapshotHistory } from './mindmap/SnapshotHistory';
import { type UnifiedNodeData, UnifiedNodeDetailDrawer } from './mindmap/UnifiedNodeDetailDrawer';
import type { MyIdea } from './myIdeasTypes';
import { buildIdeaPanel6RailTools } from './panel/ideaPanel6Sections';
import { isIdeaPanel6SectionsEnabled } from './panel/ideaPanel6SectionsFlag';
import { buildAskAIMessage } from './shared/askAiHelper';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { countNodesByFamily, type ObjectFamily } from './superCanvasTypes';
import { type TransformInput, transformSelection } from './transforms/crossToolTransform';
import { useIdeaConfidentialityGate } from './useIdeaConfidentialityGate';

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
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-c-surface-raised dark:bg-c-surface p-8">
          <div className="p-3 rounded-2xl bg-c-surface border border-c-danger">
            <AlertTriangle size={32} className="text-c-danger" />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-c-text dark:text-c-text mb-1">
              {this.props.toolName} {i18n.t('myWorkIdeas.mapWorkspace.failedLoad')}
            </div>
            <div className="text-xs text-c-text-secondary dark:text-c-text-muted max-w-sm">
              {this.state.error?.message ||
                i18n.t('myWorkIdeas.mapWorkspace.anUnexpectedErrorOccurred')}
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
              {i18n.t('myWorkIdeas.mapWorkspace.retry')}
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

// P0-5 (docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md): the active
// representation (Mind Map / Whiteboard / Process Flow / Table) is a LOCAL
// view preference — per user, per browser — never a global property of the
// Idea. `my_idea_maps.preferred_tool` / `extensions.surfaceState.activeTool`
// live on the ONE shared canonical map row per idea (server reads it
// "regardless of who last edited it" — see GET /my-ideas/:id/map) and get
// re-stamped with whichever tool is active on every autosave, so adopting
// them as "the tool to open with" silently hands one teammate's view to
// everyone else. We persist the real preference here instead, scoped to this
// idea + this browser, and never write it back to the server.
const IDEA_TOOL_PREF_ALLOWED = ['mindmap', 'process_flow', 'table', 'whiteboard'] as const;

function ideaToolPrefStorageKey(ideaId: string) {
  return `consultify.idea-active-tool.${ideaId}`;
}

function readLocalToolPreference(ideaId: string): CanvasToolType | null {
  if (typeof window === 'undefined' || !ideaId) return null;
  try {
    const raw = window.localStorage.getItem(ideaToolPrefStorageKey(ideaId));
    if (raw && (IDEA_TOOL_PREF_ALLOWED as readonly string[]).includes(raw)) {
      return raw as CanvasToolType;
    }
  } catch {
    /* private mode / storage disabled — fall through to default */
  }
  return null;
}

function writeLocalToolPreference(ideaId: string, tool: CanvasToolType) {
  if (typeof window === 'undefined' || !ideaId) return;
  try {
    window.localStorage.setItem(ideaToolPrefStorageKey(ideaId), tool);
  } catch {
    /* ignore — quota / private mode */
  }
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

function safeTitleFromSeed(
  seedText: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-site compatibility
  isPolish: boolean
): string {
  const firstLine = String(seedText || '')
    .trim()
    .split('\n')[0]
    ?.trim();
  return firstLine
    ? firstLine.slice(0, 120)
    : i18n.t('myWorkMindmap.workspace.newChallenge', 'New challenge');
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

// P1-1 (martwe kliknięcia powłoki): mapa „dodaj" per reprezentacja przeniesiona
// do rejestru akcji jako `RUNTIME_ADD_ELEMENT` (src/actions/ideaActionRegistry.ts).
// Menu 3 renderuje się teraz z rejestru, więc host nie potrzebuje własnej kopii.

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
  const { t, i18n } = useTranslation();
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
  // D2: przelacznik reprezentacji w prawym dolnym rogu (flaga OFF do akceptu).
  const switcherBottomRight = isEnabled('ideaSwitcherBottomRight');
  // M06 Fala 4.1b: canonical unified node-detail drawer (idea variant). OFF
  // (default) keeps today's IdeaNodeDetailDrawer, no change.
  const drawerUnifiedEnabled = isEnabled('mindmapDrawerUnified');
  const openChatWithContext = useOpenChatWithContext();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = String(currentUser?.id || 'current-user');

  const [loading, setLoading] = useState(true);
  const [realId, setRealId] = useState(ideaId);
  // Stable read of the current idea id for callbacks that must not churn their
  // identity every time realId changes (e.g. new-idea temp id → real id).
  const realIdRef = useRef(realId);
  useEffect(() => {
    realIdRef.current = realId;
  }, [realId]);
  const [title, setTitle] = useState('');
  const [seedText, setSeedText] = useState('');
  const [stage, setStage] = useState<string>('seed');
  const [branch, setBranch] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [priority, setPriority] = useState<number>(50);

  // E12 (RISK-22) — confidentiality gate. Extracted to useIdeaConfidentialityGate
  // (src/components/MyWork/useIdeaConfidentialityGate.ts) so the confirm/save/
  // revert logic is one directly-testable unit instead of inline state here.
  const {
    confidentiality,
    confidentialitySupported,
    confidentialitySaving,
    hydrateFromIdea: hydrateConfidentiality,
    handleConfidentialityChange: handleConfidentialityChangeForId,
    confidentialityDowngradeDialog,
  } = useIdeaConfidentialityGate({ t, isPolish, title });

  // E08 (idea maturity model) — real signals for ideaMaturityModel.ts, read
  // straight off the same `idea`/`created` objects already fetched below
  // (no extra network calls). See IdeaWorkspaceTools.tsx's `maturityReport`.
  const [ideaSourceType, setIdeaSourceType] = useState<string | null>(null);
  const [ideaPromotedTo, setIdeaPromotedTo] = useState<string | null>(null);
  const [ideaEvidenceRefsCount, setIdeaEvidenceRefsCount] = useState(0);
  const [maturityGates, setMaturityGates] = useState<Record<string, any>>({});
  const [maturityGatesSupported, setMaturityGatesSupported] = useState(false);

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
  const [candidateHandoff, setCandidateHandoff] = useState<any>(null);
  const [candidatePreview, setCandidatePreview] = useState<any>(null);
  const [candidateHandoffBusy, setCandidateHandoffBusy] = useState(false);
  // Stan Cofnij/Ponów lewego paska — JEDEN kanał dla wszystkich 4 narzędzi
  // (`ideaUndoStateBus`). Wcześniej workspace słuchał tylko Mapy i Tabeli, więc
  // na Tablicy i Przepływie przyciski były trwale wygaszone.
  const [railCanUndo, setRailCanUndo] = useState(false);
  const [railCanRedo, setRailCanRedo] = useState(false);
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
  // Z-menu1-history: Menu 1 kebab "Historia" — mindmap-only (SnapshotHistory
  // operates on mindmap nodes/edges; other tools stay honest-disabled).
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState(false);

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
  /**
   * Narzedzie ZALADOWANE z serwera dla tej Idei (jej wlasna natura).
   * Sluzy jako tarcza przed korupcja: autozapis nie moze nadpisac typu Idei
   * wartoscia, ktora wziela sie z fallbacku, a nie ze swiadomego wyboru.
   */
  const zaladowaneNarzedzieRef = React.useRef<CanvasToolType | null>(null);
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
    (tool: CanvasToolType, options: { persistPreference?: boolean } = {}) => {
      if (onActiveToolChange) onActiveToolChange(tool);
      else setInternalActiveTool(tool);
      // P0-5: persist the view preference LOCALLY (this browser only) so it
      // survives reloads/reopens for THIS user without ever touching the
      // shared idea map row other org members read.
      if (options.persistPreference !== false) {
        writeLocalToolPreference(realIdRef.current || ideaId, tool);
      }
      const currentIdeaId = realIdRef.current || ideaId;
      if (!currentIdeaId.startsWith('new-idea-')) {
        const nextSearch = new URLSearchParams(window.location.search);
        nextSearch.delete('tool');
        const query = nextSearch.toString();
        navigate(`${buildIdeaWorkspacePath(currentIdeaId, tool)}${query ? `?${query}` : ''}`);
      }
    },
    [ideaId, navigate, onActiveToolChange]
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

  // Z20 (fala4-z20-intercept): broadcast the currently mounted canvas tool so
  // UnifiedChatPanel's chat interceptors (mm/pf/wb — mindmapIntentDetector,
  // processFlowIntentDetector, whiteboardIntentDetector) know whether a
  // matching tool is actually open before hijacking a "create mind
  // map/process/whiteboard" prompt. Without this signal the chat had no way
  // to tell IdeaMapWorkspace wasn't mounted at all (or was showing a
  // different tool) and the intercepted phrase turned into a silent no-op —
  // window.dispatchEvent('idea-workspace-quick-action') has no listener in
  // that case, and the prompt never reached the LLM either. Clear it on
  // unmount so the chat falls back to sending the prompt to the LLM once the
  // workspace closes.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-active-tool', { detail: { tool: activeTool } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-active-tool', { detail: { tool: null } })
      );
      // E10 (2026-08-10): also clear the selection broadcast on unmount/tool
      // switch — same reasoning as clearing the active-tool signal above, so
      // a listener (UnifiedChatPanel's Teresa selection context) can't act on
      // a selection that belonged to a workspace/tool that just closed.
      window.dispatchEvent(
        new CustomEvent('idea-workspace-active-selection', {
          detail: { ideaId: realId, tool: activeTool, selection: EMPTY_SELECTION },
        })
      );
    };
  }, [activeTool, realId]);

  // Cofnij/Ponów lewego paska: jeden autobus (`idea-undo-state` + most dla starych
  // kanałów Mapy/Tabeli). Przyjmujemy TYLKO stan aktywnego narzędzia, a przy
  // przełączeniu narzędzia gasimy przyciski do czasu, aż nowe narzędzie nada swój
  // stan — inaczej pasek pokazywałby cudzy, nieaktualny stos.
  useEffect(() => {
    setRailCanUndo(false);
    setRailCanRedo(false);
    return subscribeIdeaUndoState((state) => {
      if (state.tool !== activeTool) return;
      setRailCanUndo(state.canUndo);
      setRailCanRedo(state.canRedo);
    });
  }, [activeTool]);

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
      // E10 (2026-08-10, doc09 §9 Z4 "Teresa controls everything"): broadcast
      // the SAME selection this shell already lifts from the active tool for
      // its own Tools panel — same event-broadcast shape as
      // 'idea-workspace-active-tool' above. Verified BEFORE adding this: this
      // was the missing link, not a duplicate — grep of
      // `UnifiedChatPanel.tsx` before this change showed `executeTeresaTool`
      // always sent `selection: EMPTY_SELECTION`, so Teresa's `ctx.selection`
      // was dead for real chat calls (the LLM had to supply an element id
      // directly as a tool argument instead). Includes `ideaId`/`tool` so a
      // listener can discard a stale broadcast from a just-closed/just-
      // switched workspace instead of trusting selection blindly.
      window.dispatchEvent(
        new CustomEvent('idea-workspace-active-selection', {
          detail: { ideaId: realId, tool: activeTool, selection: next },
        })
      );
      if (next.type !== 'none') {
        trackFunnelEvent('ideas_selection_changed', {
          tool: activeTool,
          selectionType: next.type,
          count: next.count,
        });
      }
    },
    [activeTool, externalOnSelectionChange, realId]
  );

  // FIX-3 (Day 3 acceptance): IdeaElementInspector's empty state can offer real
  // recently-selected elements instead of nothing. Tracks the last distinct primary
  // selections across all 4 tools — genuine selection history, not fabricated data.
  const [recentInspectorItems, setRecentInspectorItems] = useState<IdeaInspectorItem[]>([]);
  useEffect(() => {
    if (selection.type === 'none' || !selection.primaryId) return;
    const id = selection.primaryId;
    const title = selection.meta?.label || id;
    const type = selection.meta?.semanticType || selection.meta?.nodeType || activeTool;
    const date = new Date().toLocaleTimeString(isPolish ? 'pl' : 'en', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setRecentInspectorItems((prev) => {
      const withoutDupe = prev.filter((item) => item.id !== id);
      return [{ id, title, type, date }, ...withoutDupe].slice(0, 5);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.primaryId]);

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
        // CB-05/RV-006: useIdeaMapSync's self-heal retries this flush up to twice
        // more on a repeated 409 (conflictRetryRef < 2) — without a stable id,
        // each retry's onConflict call opened a NEW stacked toast, so a single
        // representation switch could show the same sentence three times at
        // once. A per-idea id makes react-hot-toast update the one toast in
        // place instead of stacking duplicates; the server reconcile below is
        // unaffected either way.
        toast(t('mindmap.changeConflictDetectedRefreshingMapFrom'), {
          icon: '⚠️',
          id: `graph-conflict-${ideaId}`,
        });
      }
      // Always reconcile from the server, toast or not.
      conflictRefreshRef.current?.();
    },
    [ideaId, isPolish]
  );

  const graphRuntime = useWorkspaceGraphRuntime({
    ideaId: realId,
    open: Boolean(realId && (!isNewInitial || realId !== ideaId)),
    locked: canvasLocked,
    // ★ TARCZA PRZED KORUPCJA (2026-07-24): autozapis pisze `preferred_tool`
    // przy KAZDYM zapisie. Gdy widok wynikl z fallbacku (a nie z wyboru
    // uzytkownika) i fallback byl zly, ten zapis NADPISYWAL prawdziwy typ Idei
    // w bazie — tak Proces ofertowania stal sie „mapa rekomendacji", a mapa
    // zdarla `type:'flowNode'` z 12 krokow. Odtad typ nadpisujemy WYLACZNIE gdy
    // uzytkownik swiadomie przelaczyl narzedzie; inaczej oddajemy to, co
    // przyszlo z serwera.
    preferredTool: userSelectedToolRef.current
      ? activeTool
      : zaladowaneNarzedzieRef.current || activeTool,
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
        toast.success(t('mindmap.acceptedProposalsCount', { count: accepted.length }));
      } catch (err: any) {
        toast.error(err?.message || t('mindmap.failedToApplyChanges'));
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
  const handleConvertRef = useRef<
    (target: IdeaConvertTarget, nodeIds?: string[], scope?: string) => void
  >(() => {});
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
      // H2.3 fix: the mind-map "→ Process Flow (branch)" context-menu action
      // (convertBranch → 'convert_process_flow') carries explicit branch
      // nodeIds instead of a live canvas selection. Route it through the same
      // transform pipeline as xform_to_flow so the branch is actually
      // converted, not just a bare tool switch with nothing carried over.
      const explicitNodeIds = Array.isArray(eventDetail?.nodeIds)
        ? (eventDetail!.nodeIds as string[])
        : undefined;
      if (XFORM_MAP[action] || (action === 'convert_process_flow' && explicitNodeIds)) {
        const targetTool = XFORM_MAP[action] || 'process_flow';
        trackFunnelEvent('ideas_cross_system_transform', {
          from: activeTool,
          to: targetTool,
          action,
        });

        const sel = selectionRef.current;
        const selectedIds = explicitNodeIds || sel.ids || [];
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

        toast.success(t('mindmap.transformingSelectionTo', { targetTool }), { duration: 1200 });
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
          toast(t('mindmap.selectAnObjectOnTheCanvas'), { icon: '🔗', duration: 2000 });
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
      // Odbiornik dla akcji rejestru `idea.template.apply` gdy woła ją Teresa
      // (`ideaActionRegistry.ts`, closure 2026-08-10). Świadomie REUŻYWA
      // `handleApplyTemplate` (ten sam, który `onApplyTemplate` niżej daje
      // lewemu railowi) zamiast wołać `applyIdeaTemplate` bezpośrednio z
      // rejestru — `handleApplyTemplate` niesie poprawny `baseVersion`
      // (`graphRuntime.graph.version`) i `handleTemplateApplied()` (refresh
      // + bump `mapRefreshToken`), którego brak historycznie gubił treść w
      // Przepływie/Mapie po zastosowaniu szablonu (patrz komentarz przy
      // `handleTemplateApplied` wyżej) — rejestr NIE duplikuje tej naprawy.
      if (action === 'apply_idea_template') {
        const templateId = eventDetail?.templateId;
        if (typeof templateId === 'string' && templateId) {
          void handleApplyTemplate(templateId);
        }
        return;
      }
      // Odbiornik dla akcji rejestru `idea.templates.open` (Menu 3 „Szablony").
      // Rejestr nadaje ten string na szynę, bo otwarcie modala żyje w stanie
      // React hosta — analogicznie do `open_export_menu` wyżej.
      if (action === 'open_template_gallery') {
        setTemplateGalleryOpen(true);
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
        // E11 (2026-08-10): forward the caller's real scope (convertBranch/
        // convertSingleNode in IdeaRecommendationMap.tsx now attach one —
        // 'single_item' / 'single_item_cascade') so the preview shows the
        // TRUE scope instead of handleConvert's coarser nodeIds-based guess.
        const explicitScope =
          typeof eventDetail?.scope === 'string' ? eventDetail.scope : undefined;
        handleConvertRef.current(target, explicitNodeIds, explicitScope);
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
              t('mindmap.linkSuggestionsFoundCount', { count: batch.proposals.length })
            );
          } else {
            toast(t('mindmap.noMatchingArtifactsFound'), { icon: '🔍' });
          }
        } catch (err: any) {
          toast.error(err?.message || t('mindmap.failedToFindLinks'));
        }
        return;
      }

      trackFunnelEvent('ideas_quick_tool_used', { tool: activeTool, action });
      if (action === 'mm_select_mode') handleMindMapInteractionModeChange('select');
      if (action === 'mm_pan_mode') handleMindMapInteractionModeChange('pan');
      if (action === 'mm_connect_mode') handleMindMapInteractionModeChange('connect');
      if (action === 'switch_to_process_flow') {
        setActiveTool('process_flow');
        toast.success(t('mindmap.switchedToProcessFlow'));
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
        action === 'open_template_gallery' ||
        // `idea.template.apply` (ideaActionRegistry.ts, closure 2026-08-10) —
        // Teresa path dispatches this after `findIdeaTemplate` validation;
        // without this line the event was silently dropped by this allowlist
        // before ever reaching `handleQuickAction`/`handleApplyTemplate`.
        action === 'apply_idea_template' ||
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

  // ── Most Teresa ⇄ Ideas (kierunek Ideas → Teresa). D16/D17: panel idei = panel
  // Teresy. Kierunek Chat → Ideas jest już obsłużony przez dedykowany listener
  // powyżej (z precyzyjnym filtrowaniem, aby uniknąć podwójnego wykonania), więc
  // NIE przekazujemy `onQuickAction` — hook rejestruje wtedy 0 nasłuchów i służy
  // wyłącznie do emisji statusów (potwierdzenia) z powrotem do Teresy.
  const { emitStatus: emitTeresaStatus } = useIdeasTeresaBridge({
    ideaId: realId,
    toolType: activeTool === 'process_flow' ? 'processflow' : activeTool,
  });

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
      toast.success(t('mindmap.appliedThemeName', { themeId }), {
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
      toast.success(t('mindmap.activeKitName', { semantic }), {
        duration: 1200,
      });
    },
    [isPolish, realId]
  );

  /**
   * B2 (2026-07-27) — JEDYNA poprawna reakcja na „szablon zastosowany".
   *
   * Bug: „Użyj szablonu"/„AI wypełni" zapisywały szablon na serwerze, ale
   * kanwa zostawała stara — z perspektywy użytkownika „nic się nie dzieje".
   * Przyczyna: samo `setMapRefreshToken` NIE wystarcza dla narzędzi pracujących
   * w trybie `externalRuntime` (Mind Map, Process Flow). Ich `hydrate()` czyta
   * NIE z API, tylko z współdzielonego `graphRuntime` („the parent's refresh()
   * primes it" — IdeaProcessFlowTool.hydrate). Bez `refresh()` runtime nadal
   * trzyma graf sprzed szablonu, więc:
   *   • Process Flow re-hydratował się do STAREJ zawartości, a jego autosave
   *     zapisywał ją z powrotem NA szablon (obserwowane: mapa wracała do
   *     3 węzłów przy `templateGovernance.templateId` już ustawionym),
   *   • Mind Map w ogóle nie dostawał `refreshToken`.
   * Whiteboard/Tabela działały, bo idą legacy-ścieżką per-tool `getMyIdeaMap`.
   *
   * Kolejność jest istotna: NAJPIERW `refresh()` (runtime dostaje kanoniczny
   * graf), DOPIERO POTEM bump tokenu (narzędzia re-hydratują się z już
   * świeżego runtime).
   */
  const handleTemplateApplied = useCallback(async () => {
    try {
      await refreshRuntimeGraph();
    } catch {
      // best-effort — bump tokenu i tak wymusi ponowną hydratację narzędzia
    }
    setMapRefreshToken((v) => v + 1);
  }, [refreshRuntimeGraph]);

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      if (!realId) return;
      const template = findIdeaTemplate(templateId);
      if (!template) {
        toast.error(t('mindmap.templateNotFound'));
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
        await handleTemplateApplied();
        toast.success(t('mindmap.templateApplied'), { duration: 1200 });
      } catch (error: any) {
        if (error?.status === 409) {
          toast(t('mindmap.changeConflictDetectedRefreshingMapFrom'), { icon: '⚠️' });
          void handleTemplateApplied();
        } else {
          toast.error(error?.message || t('mindmap.failedToApplyTemplate'));
        }
      }
    },
    [
      activeTool,
      graphRuntime.graph.version,
      handleTemplateApplied,
      isPolish,
      realId,
      seedText,
      title,
    ]
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
          toast(t('mindmap.aiReturnedNoProposalsToReview'), {
            icon: '🤖',
          });
        }
      } catch (error: any) {
        toast.error(error?.message || t('mindmap.failedToRunAi'));
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
        toast.success(t('mindmap.savedReviewStatusName', { nextStatus }));
      } catch (err: any) {
        toast.error(err?.message || t('mindmap.failedToSaveReview'));
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
        toast.success(t('mindmap.importedDiagramFormat', { sourceFormat: payload.sourceFormat }));
      } catch (err: any) {
        toast.error(err?.message || t('mindmap.importFailed'));
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
          deriveIdeaTitleFromSeedIntent(seedIntent, t('mindmap.newChallenge'))
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
            title: initialIdeaTitle || t('mindmap.newChallenge'),
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
        setTitle(String(created?.title || initialIdeaTitle || t('mindmap.newChallenge')));
        setSeedText(
          String(created?.seed_text || created?.seedText || created?.body || initialIdeaBody || '')
        );
        setStage(String(created?.stage || 'seed'));
        setBranch(String(created?.branch || ''));
        setArea(String(created?.area || ''));
        setPriority(Number.isFinite(Number(created?.priority)) ? Number(created.priority) : 50);
        setIdeaSourceType((created as any)?.sourceType ?? null);
        setIdeaPromotedTo((created as any)?.promotedTo ?? null);
        setIdeaEvidenceRefsCount(
          Array.isArray((created as any)?.evidenceRefs) ? (created as any).evidenceRefs.length : 0
        );
        setMaturityGates((created as any)?.maturityGates ?? {});
        setMaturityGatesSupported(Boolean((created as any)?.maturityGatesSupported));
        hydrateConfidentiality(created as any);
        onSaved(created as MyIdea);
        setDirty(true);

        if (preferredSeedSystem && !initialTool && !userSelectedToolRef.current) {
          setActiveTool(preferredSeedSystem, { persistPreference: false });
        }

        try {
          const res = await Api.getMyIdeaMap(nextId, { language: i18n.language });
          const map = res?.map || {};
          // Teresa chat handoff (generate_deliverable) may hand off a
          // backend-built skeleton graph (mindmapSkeleton.ts /
          // canvasToolSkeletons.ts) via seedIntent.seedGraph. When present,
          // hydrate THAT graph as the new idea's initial map instead of the
          // freshly-created (empty) one — this is what makes the skeleton the
          // workspace actually opens with, instead of discarding it and
          // re-deriving a map from scratch via the AI-kickoff effect below.
          const seedGraph = seedIntent?.seedGraph;
          const hasSeedGraph = Boolean(seedGraph?.nodes && seedGraph.nodes.length > 0);
          const nodes = hasSeedGraph
            ? (seedGraph!.nodes as any[])
            : Array.isArray(map.nodes)
              ? map.nodes
              : [];
          const edges = hasSeedGraph
            ? (seedGraph!.edges as any[])
            : Array.isArray(map.edges)
              ? map.edges
              : [];
          // Merge any canvas extensions the backend skeleton carried (e.g.
          // Ideas-Table custom columns ROI/Budżet/Ryzyko under `table.columns`)
          // over the startup metadata so those columns persist + render.
          const seedExt = (seedGraph as { extensions?: Record<string, unknown> } | null)
            ?.extensions;
          const startupExt = buildStartupExtensions(seedIntent, creationPayload) as Record<
            string,
            unknown
          >;
          const mergedExtensions =
            seedExt && typeof seedExt === 'object' ? { ...startupExt, ...seedExt } : startupExt;
          await Api.syncMyIdeaMap(nextId, {
            nodes,
            edges,
            baseVersion: Number(map.version || 1),
            preferredTool: preferredSeedSystem || undefined,
            extensions: mergedExtensions,
            reason: hasSeedGraph ? 'ai' : 'manual',
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
        setIdeaSourceType(idea?.sourceType ?? null);
        setIdeaPromotedTo(idea?.promotedTo ?? null);
        setIdeaEvidenceRefsCount(Array.isArray(idea?.evidenceRefs) ? idea.evidenceRefs.length : 0);
        setMaturityGates(idea?.maturityGates ?? {});
        setMaturityGatesSupported(Boolean(idea?.maturityGatesSupported));
        hydrateConfidentiality(idea);

        try {
          const mapRes = await Api.getMyIdeaMap(String(idea?.id || ideaId), {
            language: i18n.language,
          });
          // P0-5: the tool to open with is resolved LOCALLY, never from the
          // shared map row (`preferredTool` / `surfaceState.activeTool` — see
          // the module-level note above `readLocalToolPreference`). A deep
          // link always wins; otherwise fall back to this browser's own
          // remembered choice for this idea, defaulting to Mind Map when
          // neither is present — never to whatever another org member last
          // had open.
          if (!initialTool && !userSelectedToolRef.current) {
            const localPref = readLocalToolPreference(String(idea?.id || ideaId));
            if (localPref) {
              setActiveTool(localPref);
            } else {
              // ★ REGRESJA P0-5 (naprawiona 2026-07-24): tu wczesniej nie bylo
              // NICZEGO — brak lokalnej preferencji zostawial `internalActiveTool`
              // na domyslnym 'mindmap', wiec Idea zapisana jako Przeplyw/Tablica/
              // Tabela otwierala sie JAKO MAPA MYSLI przy pierwszym wejsciu z listy
              // (deep-link maskowal blad, bo ustawia initialTool).
              //
              // `preferredTool` Idei to JEJ WLASNA natura, nie cudzy stan sesji —
              // i jako fallback nalezy go uszanowac. Wyciek, przed ktorym bronilo
              // P0-5, polegal na tym, ze cudzy wybor PRZESTAWIAL ekran; tutaj
              // uzywamy go wylacznie gdy TEN uzytkownik nie ma wlasnego zdania
              // o tej Idei, wiec nikomu nic sie nie przelacza.
              const wlasnaNatura = mapRes?.map?.preferredTool;
              if (wlasnaNatura) zaladowaneNarzedzieRef.current = wlasnaNatura as CanvasToolType;
              if (
                wlasnaNatura === 'mindmap' ||
                wlasnaNatura === 'whiteboard' ||
                wlasnaNatura === 'process_flow' ||
                wlasnaNatura === 'table'
              ) {
                // This is the Idea's structural fallback, not a user choice.
                // Route to the canonical representation without manufacturing
                // a per-browser preference that would mask later fallbacks.
                setActiveTool(wlasnaNatura, { persistPreference: false });
              }
            }
          }

          // V5-IDEA-16: Restore surface state (focus mode / viewport only —
          // the active TOOL is deliberately excluded, see above).
          const ss = mapRes?.map?.extensions?.surfaceState;
          if (ss && typeof ss === 'object') {
            const ssObj = ss as Record<string, unknown>;
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
      toast.error(err?.message || t('mindmap.failedToLoad'));
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
  // H2.3 (M06 "Mind Map opens Process Flow"): the `?tool=` query param is NOT a
  // real deep-link entry point for ideas — genuine deep links arrive via the
  // route PATH (`/my-work/.../workspace/<tool>` → parseIdeaTool → `initialTool`
  // prop). `?tool=` is only ever WRITTEN by `setActiveTool` as a cosmetic URL
  // mirror (via history.replaceState). Because this workspace REMOUNTS per idea
  // (`key={idea-workspace-<id>}`) while the SPA URL persists, reading `?tool=` on
  // mount pulled the PREVIOUSLY-opened idea's tool into the newly-opened idea AND
  // set `userSelectedToolRef=true`, which then SUPPRESSED the idea's real,
  // locally-saved tool preference restore in `hydrate()`. Net effect: open a
  // Process-Flow idea, then open a Mind-Map idea → the Mind-Map idea wrongly
  // opened in Process Flow. Tool selection is fully governed by `initialTool`
  // (deep-link) + this browser's own `readLocalToolPreference` (P0-5 — per
  // idea, per user, restored on hydrate; NEVER the shared server map) +
  // genuine in-session user clicks, so this stale cross-idea param read is
  // pure liability and is removed. The `setActiveTool` write keeps `?tool=`
  // in the address bar for shareability.

  // ── V4-IDEA-07: Keyboard shortcuts ─────────────────────────────────────────
  //
  // Reconciliacja z Rejestrem Akcji (2026-08-10, E02 DoD "toolbar, rail,
  // inspector, PPM, keyboard i Teresa wołają ten sam kontrakt"): każdy
  // callback poniżej, dla którego istnieje wpis w `ideaActionRegistry.ts`,
  // idzie teraz przez `runIdeaAction` z `ctx.params.run` ustawionym na
  // DOKŁADNIE ten sam `handleQuickAction(...)`, który wołał przed tym
  // wpisem — każdy z wywoływanych helperów (`runMindmapNodeBusAction`,
  // `runToolbarBusAction`) wykonuje `run()` wprost dla `ctx.source==='ui'`,
  // więc zachowanie klawisza jest bajtowo identyczne, zyskuje tylko wpis w
  // rejestrze (shortcut recorded) i drugie, realne wejście dla Teresy przez
  // ten sam string runtime. `onCancel`/`onSlashCommand`/`onFocusSelection`
  // ŚWIADOMIE NIE przechodzą przez rejestr — czysta nawigacja/stan UI (jak
  // `onFocusSelection`: `focusSelectedNode()` tylko przesuwa kamerę, zero
  // mutacji), nie akcje w sensie rozdz. 02.
  const runMindmapKeyboardAction = useCallback(
    (actionId: string, run: () => void) => {
      const ctx: ActionContext = {
        ideaId: realId,
        tool: 'mindmap',
        selection,
        surface: 'context',
        source: 'ui',
        language: isPolish ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(actionId, ctx);
    },
    [isPolish, realId, selection]
  );

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
    onAddChild: () =>
      runMindmapKeyboardAction('idea.node.mm_add_child', () => handleQuickAction('mm_add_child')),
    onAddSibling: () =>
      runMindmapKeyboardAction('idea.node.mm_add_sibling', () =>
        handleQuickAction('mm_add_sibling')
      ),
    onGroup: () =>
      runMindmapKeyboardAction('idea.node.mm_group_selected', () => handleQuickAction('group')),
    onAIExpand: () =>
      runMindmapKeyboardAction('idea.node.mm_ai_expand_node', () =>
        handleQuickAction('mm_ai_expand_branch')
      ),
    onToggleCollapse: () =>
      runMindmapKeyboardAction('idea.node.mm_toggle_collapse', () =>
        handleQuickAction('mm_toggle_collapse')
      ),
    // Nawigacja kamery (fitView na zaznaczonym węźle), zero mutacji danych —
    // NIE jest akcją Rejestru (analogicznie do "focus movement" z ustaleń
    // programu). Bez menu/przycisku gdziekolwiek w kodzie — czysto
    // klawiaturowe, ale bez żadnego skutku poza kamerą, więc bez wpisu.
    onFocusSelection: () => handleQuickAction('mm_focus_selected'),
    onReparentPromote: () =>
      runMindmapKeyboardAction('idea.node.mm_reparent_promote', () =>
        handleQuickAction('mm_reparent_promote')
      ),
    onReparentDemote: () =>
      runMindmapKeyboardAction('idea.node.mm_reparent_demote', () =>
        handleQuickAction('mm_reparent_demote')
      ),
    // ZASTRZEŻENIE (odkryte przy tej reconciliacji, NIE naprawiane tu):
    // `handleQuickAction('selectAll')` dispatchuje string BEZ ŻADNEGO
    // odbiornika (sprawdzone grepem: `useMindMapQuickActions.ts` nie ma
    // gałęzi `'selectAll'`/`'clearSelection'`) — te dwa skróty są dziś
    // wizualnie martwe TU, ale realny Ctrl+A/Ctrl+D na Mapie myśli i tak
    // DZIAŁA dzięki NIEZALEŻNEMU, osobnemu listenerowi w
    // `IdeaRecommendationMap.tsx` (~L3635-3682, `setNodes` wprost) — poza
    // trzema hookami tego zadania, nietknięty. `onSelectAll` i tak dostaje
    // wpis rejestru (istniejący `idea.view.select_all`, shortcut ⌘A) przez
    // `ctx.params.run`, bez zmiany zachowania (`run()` wciąż woła martwy
    // string — Teresa może wywołać TĘ SAMĄ akcję realnie, bo jej ścieżka
    // idzie przez `mm_select_all`, nie przez ten skrót). `onClearSelection`
    // NIE dostaje wpisu — nie ma nawet istniejącego rejestrowego id do
    // podpięcia (żaden "clear selection" nie jest dziś zarejestrowany), a
    // rejestrowanie akcji bez JAKIEGOKOLWIEK żywego odbiornika łamałoby Z3.
    onSelectAll: () =>
      runMindmapKeyboardAction('idea.view.select_all', () => handleQuickAction('selectAll')),
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
        description: t('mindmap.switchToolMindMapWhiteboardProcess'),
        category: 'navigation',
      },
      {
        key: isMacPlatform ? '⌘F' : 'Ctrl+F',
        description: t('mindmap.searchThisIdea'),
        category: 'navigation',
      },
      {
        key: `Shift+1 / ${isMacPlatform ? '⌘0' : 'Ctrl+0'}`,
        description: t('mindmap.zoomToFit'),
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
      title: t('myWorkMindmap.workspace.switchTo', 'Switch to {{tool}}', {
        tool: t(`myWorkMindmap.workspace.tool.${id}`, labelEn),
      }),
      subtitle: t('mindmap.workspaceTool'),
      icon,
      category: 'workspace',
      action: closeAnd(() => setActiveTool(id)),
      keywords: [labelPl, labelEn, 'tool', 'narzędzie', id],
    });
    return [
      // SZOSTA kopia etykiet narzedzi — czytamy z SSOT (`getIdeaWorkspaceToolLabel`),
      // zeby paleta polecen nie byla ostatnim miejscem z „Mapa rekomendacji".
      toolCmd(
        'mindmap',
        getIdeaWorkspaceToolLabel('mindmap', true),
        getIdeaWorkspaceToolLabel('mindmap', false),
        <GitBranch size={18} />
      ),
      toolCmd(
        'whiteboard',
        getIdeaWorkspaceToolLabel('whiteboard', true),
        getIdeaWorkspaceToolLabel('whiteboard', false),
        <StickyNote size={18} />
      ),
      toolCmd(
        'process_flow',
        getIdeaWorkspaceToolLabel('process_flow', true),
        getIdeaWorkspaceToolLabel('process_flow', false),
        <Workflow size={18} />
      ),
      toolCmd(
        'table',
        getIdeaWorkspaceToolLabel('table', true),
        getIdeaWorkspaceToolLabel('table', false),
        <Table2 size={18} />
      ),
      {
        id: 'ws-search',
        title: t('mindmap.searchThisIdea'),
        icon: <Search size={18} />,
        category: 'workspace',
        shortcut: '⌘F',
        action: closeAnd(() => setSearchOpen(true)),
        keywords: ['search', 'szukaj', 'find', 'znajdź'],
      },
      {
        id: 'ws-templates',
        title: t('mindmap.openTemplateGallery'),
        icon: <LayoutTemplate size={18} />,
        category: 'workspace',
        action: closeAnd(() => setTemplateGalleryOpen(true)),
        keywords: ['template', 'szablon', 'gallery', 'galeria'],
      },
      {
        id: 'ws-export',
        title: t('mindmap.export'),
        icon: <Download size={18} />,
        category: 'workspace',
        action: closeAnd(() => setExportMenuOpen(true)),
        keywords: ['export', 'eksport', 'pdf', 'png', 'csv'],
      },
      {
        id: 'ws-help',
        title: t('mindmap.keyboardShortcuts'),
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

  // P0-5: `activeTool` is deliberately EXCLUDED from `surfaceState` — that
  // field lives on the ONE shared canonical map row per idea (read by every
  // org member, see the note above `readLocalToolPreference`), so writing the
  // active tool there on every switch was broadcasting this user's view to
  // everyone else. focusMode/focusObjectId/viewport are unrelated to which
  // representation is open and keep syncing as before.
  useEffect(() => {
    latestSurfaceStateRef.current = {
      focusMode,
      focusObjectId: focusObjectId || null,
    };
  }, [focusMode, focusObjectId]);

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
  }, [applyRuntimeExtensionsPatch, focusMode, focusObjectId, isDraft, realId]);

  // ── Chat ────────────────────────────────────────────────────────────────────
  const openChat = useCallback(
    (prefillText?: string) => {
      setChatKickoffMessage(
        prefillText ||
          buildAskAIMessage({
            type: 'idea',
            title: title || seedText?.slice(0, 80) || t('mindmap.challenge'),
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
      toast(t('mindmap.theMapIsEmpty'), { icon: '🗺️' });
      return;
    }
    const mapTitle = title || seedText?.slice(0, 80) || t('mindmap.mindMap');
    const outline = ideaMapToMarkdown(
      { nodes: liveNodes, edges: liveEdges },
      { title: mapTitle, isPolish: Boolean(isPolish) }
    );
    const kickoff = t('mindmap.discussMindMapKickoff', { mapTitle, outline });
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
    // A backend-built skeleton graph (Teresa generate_deliverable) was already
    // hydrated as this idea's initial map in `hydrate()` above — re-kicking off
    // an AI chat prompt here would discard/duplicate that work and could
    // produce a map inconsistent with what the chat message described. Skip
    // the kickoff entirely; the workspace opens directly on the real skeleton.
    if (seedIntent?.seedGraph?.nodes && seedIntent.seedGraph.nodes.length > 0) {
      aiKickoffTriggeredRef.current = true;
      return;
    }

    aiKickoffTriggeredRef.current = true;
    const requestedSystem = preferredSeedSystem || activeTool;
    const promptSeed = initialIdeaBody || seedText;
    const prompt = t('mindmap.startWorkspaceKickoffPrompt', {
      ideaTitle: initialIdeaTitle || title,
      requestedSystem,
      promptSeed,
    });
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
      toast.success(t('mindmap.saved'), { duration: 900 });
    } catch (err: any) {
      toast.error(err?.message || t('mindmap.failedToSave'));
    } finally {
      setSaving(false);
    }
  }, [area, branch, isDraft, isPolish, onSaved, priority, realId, seedText, stage, title]);

  // ── Accept challenge ────────────────────────────────────────────────────────
  const handleAcceptChallenge = useCallback(async () => {
    if (isDraft) return;
    const nextTitle = (title || safeTitleFromSeed(seedText, isPolish)).trim().slice(0, 255);
    if (!seedText.trim()) {
      toast(t('mindmap.describeTheChallengeFirst'));
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
      toast.success(t('mindmap.challengeAccepted'), { duration: 1100 });
    } catch (err: any) {
      toast.error(err?.message || t('mindmap.failed'));
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

  // E08 (idea maturity model) — persists ONE attested stage-gate criterion.
  // Optimistic local update + real server confirmation of `applied`; if the
  // additive migration hasn't run, the server honestly reports
  // `applied:false` and we revert rather than pretend it saved (house rule:
  // no silent no-op behind a success state).
  const handleAttestMaturity = useCallback(
    async (criterionId: string, met: boolean, note: string) => {
      const previous = maturityGates;
      setMaturityGates((prev) => ({
        ...prev,
        [criterionId]: { met, note, at: new Date().toISOString() },
      }));
      try {
        const res = await Api.setIdeaMaturityAttestation(realId, criterionId, met, note);
        if (res?.applied) {
          setMaturityGates(res.maturityGates || {});
          setMaturityGatesSupported(true);
        } else {
          setMaturityGates(previous);
          setMaturityGatesSupported(false);
        }
      } catch {
        setMaturityGates(previous);
      }
    },
    [realId, maturityGates]
  );

  // ── Convert ─────────────────────────────────────────────────────────────────
  // Targets known to the SSOT registry (ideaConvertTargets.ts). Only `live` ones
  // have a server handler — `soon` ones must never be sent (CANON §4, no raw 400).
  //
  // E11 (2026-08-10, docs/standards/idea-workspace/10_*, §2.2): a mandatory
  // preview now gates every convert call from EVERY entry point (Menu 1
  // dropdown, right-panel Convert section, Mind Map node menu via the quick-
  // action bus, Table bulk convert, Process Flow node convert) — they all
  // call this same `handleConvert`, which used to go straight to
  // `Api.convertMyIdea` with only a toast AFTER the fact (E02-N5-CONVERT
  // honesty finding, confirmed true before this change). It now only BUILDS
  // and shows a preview; the actual server call moved to `performConvert`,
  // invoked solely from the dialog's confirm button.
  const [conversionPreviewOpen, setConversionPreviewOpen] = useState(false);
  const [conversionPreviewData, setConversionPreviewData] = useState<ConversionPreviewData | null>(
    null
  );
  const [conversionSubmitting, setConversionSubmitting] = useState(false);
  const conversionPendingRef = useRef<{
    target: IdeaConvertTarget;
    nodeIds: string[];
    scopeKind: string;
  } | null>(null);

  const performConvert = useCallback(
    async (target: IdeaConvertTarget, nodeIds: string[], scopeKind: string) => {
      setSaving(true);
      setConversionSubmitting(true);
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
            // E11: explicit scope, shown in the preview the user just
            // confirmed — the backend now records it verbatim into
            // my_idea_conversions.scope instead of collapsing every non-
            // workspace conversion into one bucket (see promote() in
            // my-work.routes.ts).
            scope: scopeKind,
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

        toast.success(t('mindmap.doneOutputAvailableInTargetModule'));
        return true;
      } catch (err: any) {
        toast.error(err?.message || t('mindmap.failed'));
        return false;
      } finally {
        setSaving(false);
        setConversionSubmitting(false);
      }
    },
    [activeTool, i18n.language, realId, whiteboardOutcomes, whiteboardSession]
  );

  // Builds the real preview content — real Idea title/body/AI-expansion (a
  // fresh GET, not stale local state) + real node labels for the included
  // scope + real prior-conversion count from the append-only lineage table.
  // Best-effort on the two network calls: if either fails, the preview still
  // opens with what IS known locally and an honest warning, never silently
  // skips the gate.
  const buildConversionPreview = useCallback(
    async (
      target: IdeaConvertTarget,
      nodeIds: string[],
      scopeKind: string
    ): Promise<ConversionPreviewData> => {
      const meta = getConvertTargetMeta(target);
      const liveNodes = graphNodesRef.current || [];
      const nodeIdSet = new Set(nodeIds);
      const elementLabels = liveNodes
        .filter((n: any) => nodeIdSet.has(String(n?.id)))
        .map((n: any) => String(n?.data?.label || n?.data?.text || '').trim())
        .filter(Boolean);

      const warnings: ConversionPreviewData['warnings'] = [];
      let ideaBody = '';
      let ideaExpansion = '';
      let priorConversionCount = 0;

      const [ideaResult, conversionsResult] = await Promise.allSettled([
        Api.getMyIdea(realId),
        Api.getMyIdeaConversions(realId),
      ]);
      if (ideaResult.status === 'fulfilled') {
        ideaBody = String(ideaResult.value?.body || '').trim();
        ideaExpansion = String(ideaResult.value?.aiExpansion || '').trim();
      } else {
        warnings.push({
          pl: 'Nie udało się pobrać pełnej treści Idei — podgląd może być niepełny.',
          en: "Couldn't load the Idea's full content — this preview may be incomplete.",
        });
      }
      if (conversionsResult.status === 'fulfilled') {
        priorConversionCount = conversionsResult.value?.conversions?.length || 0;
      }

      const hasContent = Boolean(ideaBody || ideaExpansion || elementLabels.length);
      if (!hasContent) {
        warnings.push({
          pl: 'Idea nie ma jeszcze treści (pusty tytuł/opis/mapa) — nowy artefakt też będzie prawie pusty.',
          en: 'This Idea has no content yet (empty body/map) — the new artifact will be nearly empty too.',
        });
      }

      const mappedFields: ConversionPreviewData['mappedFields'] = [
        {
          sourcePl: 'Tytuł Idei',
          sourceEn: 'Idea title',
          targetPl: `Nazwa (${meta ? meta.labelPl : target})`,
          targetEn: `Name (${meta ? meta.labelEn : target})`,
        },
      ];
      if (target === 'task_set') {
        mappedFields.push({
          sourcePl:
            elementLabels.length > 0
              ? `Uwzględnione elementy (${elementLabels.length})`
              : 'Kolejne kroki (next steps)',
          sourceEn:
            elementLabels.length > 0 ? `Included elements (${elementLabels.length})` : 'Next steps',
          targetPl: 'Po jednym zadaniu na element',
          targetEn: 'One task per element',
        });
      }
      if (ideaBody || ideaExpansion) {
        mappedFields.push({
          sourcePl: 'Treść / rozwinięcie AI',
          sourceEn: 'Body / AI expansion',
          targetPl: target === 'task_set' ? 'Opis każdego zadania' : 'Opis',
          targetEn: target === 'task_set' ? "Each task's description" : 'Description',
        });
      }

      const scopeLabelByKind: Record<string, { pl: string; en: string }> = {
        workspace: { pl: 'Cała Idea', en: 'Whole Idea' },
        selected_items: {
          pl: `Zaznaczenie (${nodeIds.length})`,
          en: `Selection (${nodeIds.length})`,
        },
        single_item: { pl: 'Węzeł', en: 'Single node' },
        single_item_cascade: {
          pl: `Gałąź (${nodeIds.length} elem.)`,
          en: `Branch (${nodeIds.length} elements)`,
        },
        selection: {
          pl: `Zaznaczenie (${nodeIds.length})`,
          en: `Selection (${nodeIds.length})`,
        },
      };
      const scopeLabel = scopeLabelByKind[scopeKind] || {
        pl: `Zaznaczenie (${nodeIds.length})`,
        en: `Selection (${nodeIds.length})`,
      };

      const willPromoteStage = scopeKind === 'workspace';
      if (willPromoteStage && stage === 'promoted') {
        warnings.push({
          pl: 'Ta Idea jest już oznaczona jako Promowana.',
          en: 'This Idea is already marked as Promoted.',
        });
      }

      return {
        targetLabelPl: meta ? meta.labelPl : target,
        targetLabelEn: meta ? meta.labelEn : target,
        targetArtifactName: title || safeTitleFromSeed(seedText, isPolish) || t('mindmap.untitled'),
        scope: {
          kind:
            scopeKind === 'workspace'
              ? 'workspace'
              : scopeKind === 'single_item'
                ? 'single_item'
                : scopeKind === 'single_item_cascade'
                  ? 'branch'
                  : 'selection',
          labelPl: scopeLabel.pl,
          labelEn: scopeLabel.en,
          elementLabels,
          elementCount: nodeIds.length,
        },
        mappedFields,
        warnings,
        willPromoteStage,
        priorConversionCount,
      };
    },
    [isPolish, realId, seedText, stage, t, title]
  );

  const handleConvert = useCallback(
    async (target: IdeaConvertTarget, explicitNodeIds?: string[], explicitScope?: string) => {
      if (isDraft) return;
      if (!IDEA_CONVERT_TARGETS.some((t) => t.id === target)) {
        toast.error(t('mindmap.thisConversionTargetIsNotYet'));
        return;
      }
      if (!isLiveConvertTarget(target)) {
        toast(t('mindmap.thisConversionIsComingSoon'), {
          icon: '🔜',
        });
        return;
      }
      const nodeIds = explicitNodeIds?.length ? explicitNodeIds : selection.ids || [];
      const scopeKind = explicitScope || (nodeIds.length > 0 ? 'selected_items' : 'workspace');
      conversionPendingRef.current = { target, nodeIds, scopeKind };
      setConversionPreviewData(null);
      setConversionPreviewOpen(true);
      try {
        const preview = await buildConversionPreview(target, nodeIds, scopeKind);
        // Guard against a stale response landing after the user already
        // cancelled or a newer request superseded this one.
        if (conversionPendingRef.current?.target === target) {
          setConversionPreviewData(preview);
        }
      } catch {
        // Never silently skip the gate — fall back to a minimal, honest
        // preview built from data already in memory.
        if (conversionPendingRef.current?.target === target) {
          setConversionPreviewData({
            targetLabelPl: getConvertTargetMeta(target)?.labelPl || target,
            targetLabelEn: getConvertTargetMeta(target)?.labelEn || target,
            targetArtifactName: title || t('mindmap.untitled'),
            scope: {
              kind: nodeIds.length > 0 ? 'selection' : 'workspace',
              labelPl: nodeIds.length > 0 ? `Zaznaczenie (${nodeIds.length})` : 'Cała Idea',
              labelEn: nodeIds.length > 0 ? `Selection (${nodeIds.length})` : 'Whole Idea',
              elementLabels: [],
              elementCount: nodeIds.length,
            },
            mappedFields: [],
            warnings: [
              {
                pl: 'Nie udało się przygotować pełnego podglądu — dostępne są tylko podstawowe informacje.',
                en: 'Could not build a full preview — only basic information is available.',
              },
            ],
            willPromoteStage: nodeIds.length === 0,
            priorConversionCount: 0,
          } as ConversionPreviewData);
        }
      }
    },
    [buildConversionPreview, isDraft, selection.ids, t, title]
  );

  const handleConversionPreviewConfirm = useCallback(async () => {
    const pending = conversionPendingRef.current;
    if (!pending) return;
    const ok = await performConvert(pending.target, pending.nodeIds, pending.scopeKind);
    if (ok) {
      setConversionPreviewOpen(false);
      setConversionPreviewData(null);
      conversionPendingRef.current = null;
    }
    // On failure the error toast already fired (performConvert) — keep the
    // preview closed either way rather than leaving a stale one open; the
    // user can reopen Convert to try again with a fresh preview.
    else {
      setConversionPreviewOpen(false);
      setConversionPreviewData(null);
      conversionPendingRef.current = null;
    }
  }, [performConvert]);

  const handleConversionPreviewCancel = useCallback(() => {
    setConversionPreviewOpen(false);
    setConversionPreviewData(null);
    conversionPendingRef.current = null;
  }, []);

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
        toast.success(t('mindmap.attachedRefTitle', { title: ref.title }));
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
        toast.error(err?.message || t('mindmap.failedToAttach'));
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

  // FIX-3 (Day 3 acceptance): per-tool section of the shared IdeaElementInspector rail.
  // Reads REAL state each tool already tracks (node color/shape, process lane, live
  // whiteboard facilitation session, table column values) — no fabricated content, and
  // no duplicate editor for state that already has a proper editor on the canvas itself.
  const inspectorToolSection = useMemo(() => {
    if (!selection.primaryId) return undefined;
    const meta = selection.meta;
    if (activeTool === 'mindmap') {
      return (
        <div className="space-y-2 text-sm">
          <label className="flex items-center justify-between gap-2">
            <span>{t('myWork.ideaInspector.nodeColor', 'Kolor gałęzi')}</span>
            <input
              type="color"
              aria-label={t('myWork.ideaInspector.nodeColor', 'Kolor gałęzi')}
              value={meta?.color || '#94a3b8'}
              onChange={(e) => {
                const nodeId = selection.primaryId;
                if (nodeId) void handleNodeDataChange(nodeId, { color: e.target.value } as any);
              }}
              className="h-6 w-10 rounded border border-c-border bg-transparent"
            />
          </label>
          <p className="text-c-text-secondary">
            {t('myWork.ideaInspector.nodeShape', 'Kształt')}:{' '}
            {meta?.shape || t('myWork.ideaInspector.nodeShapeDefault', 'domyślny')}
          </p>
        </div>
      );
    }
    if (activeTool === 'process_flow') {
      return (
        <div className="space-y-1 text-sm">
          <p>
            {t('myWork.ideaInspector.lane', 'Tor')}:{' '}
            {meta?.laneName || meta?.laneId || t('myWork.ideaInspector.laneNone', 'Brak toru')}
          </p>
          <p className="text-c-text-secondary">
            {t(
              'myWork.ideaInspector.edgeHint',
              'Kierunek i styl krawędzi edytujesz na kanwie po kliknięciu strzałki.'
            )}
          </p>
        </div>
      );
    }
    if (activeTool === 'whiteboard') {
      if (!whiteboardSession) {
        return (
          <p className="text-sm text-c-text-secondary">
            {t('myWork.ideaInspector.noSession', 'Brak aktywnej sesji warsztatu')}
          </p>
        );
      }
      return (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-secondary">
              {t('myWork.ideaInspector.sessionRole', 'Rola')}
            </dt>
            <dd>{whiteboardSession.role || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-secondary">
              {t('myWork.ideaInspector.sessionPhase', 'Faza')}
            </dt>
            <dd>{whiteboardSession.phase || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-secondary">
              {t('myWork.ideaInspector.sessionParticipants', 'Uczestnicy')}
            </dt>
            <dd>{whiteboardSession.participantCount ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-c-text-secondary">
              {t('myWork.ideaInspector.sessionTimer', 'Stoper')}
            </dt>
            <dd>
              {whiteboardSession.timerActive
                ? t('myWork.ideaInspector.sessionActive', 'aktywny')
                : t('myWork.ideaInspector.sessionInactive', 'nieaktywny')}
            </dd>
          </div>
        </dl>
      );
    }
    if (activeTool === 'table') {
      const cols = meta?.columns || [];
      if (!cols.length) return undefined;
      return (
        <ul className="space-y-1 text-sm">
          {cols.map((col) => (
            <li key={col.key} className="flex justify-between gap-2">
              <span className="text-c-text-secondary">{col.label}</span>
              <span className="truncate">
                {col.value == null || col.value === '' ? '—' : String(col.value)}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    return undefined;
  }, [activeTool, selection.meta, selection.primaryId, whiteboardSession, handleNodeDataChange, t]);

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
          toast(t('mindmap.aiProposedChangesToTheMap'), {
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

  // J26 (two-channel doctrine): direct "AI: rewrite this node" action.
  // Triggered from the node context menu / floating AI popover (not free chat).
  // Reuses the exact Propose→Accept path the chat `renameNodes` block uses:
  // an LLM produces a new label, we build an `updateNodes` proposal and surface
  // it for explicit review — never silently overwriting the node.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== realId) return;
      const nodeId = String(detail.nodeId || '');
      const nodeLabel = String(detail.nodeLabel || '');
      if (!nodeId) return;

      const instruction = window.prompt(
        isPolish
          ? 'Jak AI ma przeredagować ten węzeł? (np. „skróć”, „bardziej formalnie”, „ujmij jako pytanie”)'
          : 'How should the AI rewrite this node? (e.g. "shorten", "more formal", "phrase as a question")',
        ''
      );
      if (instruction === null) return; // cancelled
      const trimmed = instruction.trim();
      if (!trimmed) return;

      const systemPrompt = isPolish
        ? 'Przeredaguj etykietę węzła mapy myśli zgodnie z poleceniem. Zwróć TYLKO nową, zwięzłą etykietę — bez cudzysłowów, bez komentarza, bez nagłówków.'
        : 'Rewrite the mind-map node label per the instruction. Return ONLY the new, concise label — no quotes, no commentary, no headings.';
      const userMessage = isPolish
        ? `Polecenie: ${trimmed}\n\nObecna etykieta węzła:\n${nodeLabel}`
        : `Instruction: ${trimmed}\n\nCurrent node label:\n${nodeLabel}`;

      const loadingId = toast.loading(
        isPolish ? 'Teresa redaguje węzeł…' : 'Teresa is rewriting the node…'
      );
      let result = '';
      void (async () => {
        try {
          await Api.chatWithAIStream(
            userMessage,
            [],
            (chunk) => {
              result += chunk;
            },
            () => {
              toast.dismiss(loadingId);
              const newLabel = result.trim().replace(/^["'\s]+|["'\s]+$/g, '');
              if (!newLabel || newLabel === nodeLabel) {
                toast(isPolish ? 'Brak zmiany do zaproponowania.' : 'No change to propose.', {
                  icon: 'ℹ️',
                });
                return;
              }
              const batch: AIProposalBatch = {
                id: `rewrite-batch-${Date.now()}`,
                tool: 'mindmap',
                generatorType: 'node_rewrite',
                proposals: [
                  {
                    id: `rewrite-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: 'graph_patch',
                    rationale: isPolish
                      ? `Przeredaguj „${nodeLabel}” → „${newLabel}”`
                      : `Rewrite "${nodeLabel}" → "${newLabel}"`,
                    confidence: 0.8,
                    patch: { updateNodes: [{ id: nodeId, data: { label: newLabel } }] },
                    status: 'pending',
                  },
                ],
                createdAt: Date.now(),
              };
              setProposalBatch(batch);
              toast(
                isPolish
                  ? 'AI zaproponowało zmianę węzła — sprawdź i zatwierdź.'
                  : 'AI proposed a node change — review and accept.',
                { icon: '🤖' }
              );
            },
            systemPrompt,
            undefined,
            undefined,
            isPolish ? 'pl' : 'en',
            undefined,
            { responseStyle: 'concise', selectedTier: 'STANDARD' }
          );
        } catch (err: any) {
          toast.dismiss(loadingId);
          if (err?.name !== 'AbortError') {
            toast.error(
              isPolish ? 'Nie udało się przeredagować węzła.' : 'Failed to rewrite the node.'
            );
          }
        }
      })();
    };
    window.addEventListener('idea-mindmap-rewrite-node', handler);
    return () => window.removeEventListener('idea-mindmap-rewrite-node', handler);
  }, [realId, isPolish]);

  // Quick task creation from mindmap node
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action !== 'create_task' || !detail?.taskTitle) return;
      if (!currentProjectId) {
        toast.error(t('mindmap.noProjectContext'));
        return;
      }
      try {
        const result = await Api.createTask({
          projectId: currentProjectId,
          title: detail.taskTitle,
          description: t('mindmap.taskCreatedFromMindmapNode', {
            nodeId: detail.nodeId || t('myWorkMindmap.workspace.unknownNode', 'unknown'),
          }),
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
        toast.error(t('mindmap.failedToCreateTask'));
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
        toast.success(t('mindmap.interviewEvidenceAttached'));
      } catch (err: any) {
        const conflictVersion = getMapVersionFromPayload(err?.data);
        if (conflictVersion) {
          await graphRuntime.refresh().catch(() => {});
        }
        toast.error(t('mindmap.failedToAttach'));
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
      const prompt = t('mindmap.startWorkspaceIntentPrompt', {
        label: detail.label || '',
        preferredSystem: detail.preferredSystem || activeTool,
        seedText: detail.seedText,
      });
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
    if (saving) return t('mindmap.saving');
    if (!lastSavedAt) return 'Draft';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return t('mindmap.savedSecondsAgo', { count: sec });
    // `t` MUSI byc w zaleznosciach: tlumaczenia doladowuja sie asynchronicznie
    // (HttpBackend), wiec memo policzone przy pierwszym renderze zwracalo SUROWY
    // KLUCZ („mindmap.savedSecondsAgo") i bez `t` nigdy sie nie przeliczalo.
  }, [t, isPolish, lastSavedAt, saving]);

  // MYW-IDEAS-010: the candidate→initiative path used to be gated to
  // activeTool === 'process_flow'. The candidate endpoints
  // (getIdeaProcessFlowCandidate/preview/approve) operate on the idea's
  // canonical map (`/my-work/my-ideas/:id/map/candidate*`) — the same
  // shared graph all four tools (Mind Map/Whiteboard/Process Flow/Table)
  // read and write, not something scoped to the Process Flow renderer.
  // Gating this to one tool meant the exact same idea showed "candidate
  // ready" only when the owner happened to have Process Flow open.
  useEffect(() => {
    if (!realId) {
      setCandidateHandoff(null);
      return;
    }
    let live = true;
    Api.getIdeaProcessFlowCandidate(realId)
      .then((value) => live && setCandidateHandoff(value))
      .catch(() => live && setCandidateHandoff(null));
    return () => {
      live = false;
    };
  }, [realId]);

  const handlePreviewProcessFlowCandidate = useCallback(async () => {
    if (!realId || candidateHandoffBusy) return;
    if (['offline', 'conflict'].includes(graphRuntime.syncState)) {
      toast.error(
        isPolish ? 'Najpierw zapisz bieżący Process Flow' : 'Save the current Process Flow first'
      );
      return;
    }
    setCandidateHandoffBusy(true);
    try {
      graphRuntime.captureToolGraph(
        {
          nodes: graphRuntime.graph.nodes,
          edges: graphRuntime.graph.edges,
          extensions: graphRuntime.graph.extensions,
        },
        { reason: 'manual', immediate: true }
      );
      await graphRuntime.flushGraph({ reason: 'manual' });
      const preview = await Api.previewIdeaProcessFlowCandidate(realId);
      setCandidatePreview(preview);
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isPolish ? 'Nie udało się przygotować podglądu' : 'Failed to prepare preview')
      );
    } finally {
      setCandidateHandoffBusy(false);
    }
  }, [candidateHandoffBusy, graphRuntime, isPolish, realId]);

  const handleApproveProcessFlowCandidate = useCallback(async () => {
    if (!realId || !candidatePreview || candidateHandoffBusy) return;
    setCandidateHandoffBusy(true);
    try {
      const result = await Api.approveIdeaProcessFlowCandidate(realId, {
        mapVersion: Number(candidatePreview.mapVersion),
        projectionHash: String(candidatePreview.projectionHash),
      });
      setCandidateHandoff(result);
      setCandidatePreview(null);
      toast.success(
        result?.created
          ? isPolish
            ? 'Kandydat inicjatywy został utworzony'
            : 'Initiative candidate created'
          : isPolish
            ? 'Kandydat inicjatywy już istnieje'
            : 'Initiative candidate already exists'
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isPolish ? 'Nie udało się utworzyć kandydata' : 'Failed to create candidate')
      );
    } finally {
      setCandidateHandoffBusy(false);
    }
  }, [candidateHandoffBusy, candidatePreview, isPolish, realId]);
  const activeToolLabel = useMemo(
    () => getIdeaWorkspaceToolLabel(activeTool, Boolean(isPolish)),
    [activeTool, isPolish]
  );
  // ── Canonical EditorShell for all four Ideas tools ──────────────────────
  // Chip descriptors are memoised here after all handlers/hooks (TDZ-safe).
  // The canonical Ideas shell is no longer feature-gated. Keeping two runtime
  // anatomies made navigation fixes non-deterministic and allowed URL flags to
  // bring the overlapping legacy drawers back.
  const melsCanvasEnabled = true;
  // ── Górny pasek w JEDNEJ LINII (flaga, domyślnie OFF) ───────────────────
  // ON: Menu 3 (Dodaj · Auto-układ · AI rozwiń · Szablony · Eksport) znika w
  // całości — te same wejścia są w lewym pasku narzędzi (CanvasLeftToolbar),
  // a „Eksport" ma już pozycję w kebabie Menu 1 (ten sam `setExportMenuOpen`).
  // Klaster poleceń Menu 1 przenosi się portalem do rzędu pilli MyWorkHub.
  const ideaTopBarOneLine = isIdeaTopBarOneLineEnabled();
  /**
   * Prawy panel w układzie SZEŚCIU sekcji zależnych od przedmiotu
   * (`ff_ideaPanel6Sections`, default OFF — patrz
   * `panel/ideaPanel6SectionsFlag.ts`). Steruje trzema rzeczami naraz, bo to
   * jeden układ: (1) pasek ikon = 6 pozycji z własnego buildera, (2) panel
   * dostaje id sekcji wprost jako `onlySection`, (3) pasek ikon przestaje się
   * zwijać do 16-pikselowego słupka. Flaga OFF → wszystkie trzy jak dziś.
   */
  const panel6Enabled = isIdeaPanel6SectionsEnabled();

  /**
   * IDE-025 — prawy pasek powłoki w TRYBIE STEROWANYM.
   *
   * Po co: gdy właściciel otwiera szczegóły elementu (dwuklik / „Właściwości"
   * z menu), treść ma wjechać do sekcji „Właściwości" prawego panelu. Bez
   * sterowania panel zostawał na sekcji, którą użytkownik oglądał wcześniej,
   * slot się nie renderował i drawer spadał do starej NAKŁADKI — czyli do
   * dokładnie tego „wielkiego okna", które likwidujemy.
   *
   * `null` = zwinięty panel (kontrakt powłoki), więc stan startowy zachowuje
   * dotychczasowe zachowanie: nic nie otwiera się samo.
   */
  const ideaInspectorRightRail = isIdeaInspectorRightRailEnabled();
  // DEC-27 guard: the new right inspector wins, so the legacy left portal is
  // never active at the same time even when both operator flags are ON.
  const detaleWPanelu = isIdeaDetailsInPanelEnabled() && !ideaInspectorRightRail;
  const [inspectorOutputs, setInspectorOutputs] = useState<
    Array<{ title: string; type: string; status?: string; targetId?: string }>
  >([]);

  // FIX-6 (Day 3 acceptance): resolves the REAL name/status of a conversion
  // target instead of fabricating one. The conversions API only returns
  // {targetType, targetId, scope} — no title, and `scope` (draft/final,
  // an idea-side concept) is not the target's lifecycle status. Best-effort:
  // on fetch failure or an unmapped type, falls back to the honest
  // type+date label the code already used, never a fabricated status.
  const resolveConversionTargetName = useCallback(
    async (targetType: string, targetId: string): Promise<{ title?: string; status?: string }> => {
      try {
        if (targetType === 'initiative') {
          const initiative = await Api.getInitiativeById(targetId);
          return { title: initiative?.title || initiative?.name, status: initiative?.status };
        }
        if (targetType === 'task') {
          const task = await Api.getTask(targetId);
          return { title: task?.title, status: task?.status };
        }
        if (targetType === 'decision') {
          const decision = await Api.getDecision(targetId);
          return { title: decision?.title || decision?.question, status: decision?.status };
        }
      } catch {
        /* best-effort — falls back to the type+date label below */
      }
      return {};
    },
    []
  );

  useEffect(() => {
    if (!ideaInspectorRightRail || !realId) {
      setInspectorOutputs([]);
      return;
    }
    let cancelled = false;
    Api.getMyIdeaConversions(realId)
      .then(async (result) => {
        if (cancelled) return;
        const conversions = result.conversions || [];
        const resolved = await Promise.all(
          conversions.map(async (conversion) => {
            const fallbackTitle = `${conversion.targetType} · ${new Date(conversion.createdAt).toLocaleDateString()}`;
            const real = conversion.targetId
              ? await resolveConversionTargetName(conversion.targetType, conversion.targetId)
              : {};
            return {
              title: real.title || fallbackTitle,
              type: conversion.targetType,
              status: real.status,
              targetId: conversion.targetId || undefined,
            };
          })
        );
        if (!cancelled) setInspectorOutputs(resolved);
      })
      .catch(() => {
        if (!cancelled) setInspectorOutputs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ideaInspectorRightRail, realId, resolveConversionTargetName]);
  const [sekcjaPrawegoPaska, setSekcjaPrawegoPaska] = useState<string | null>(null);

  useEffect(() => {
    if (!detaleWPanelu || !panel6Enabled) return;
    if (nodeDetailOpen) setSekcjaPrawegoPaska('properties');
  }, [detaleWPanelu, panel6Enabled, nodeDetailOpen]);
  // VF1 SPEC-A canvas states (loading/error) — default OFF, gated per rule #7.
  const vf1CanvasSpecAEnabled = isVf1CanvasSpecAEnabled();
  // Z-menu1-delete: "Usuń" kebab entry — wires the same `Api.deleteMyIdea`
  // used by the ideas list (MyIdeasListContent) + the same confirm-dialog
  // pattern. "Duplikuj" (Api.duplicateMyIdea → deep-link into the new copy)
  // and "Historia" (SnapshotHistory) are wired below too — no kebab entry is
  // permanently disabled anymore. Historia works for every canvas tool: all
  // four share one per-idea graph and snapshots now capture extensions.
  const { dialog: deleteIdeaDialog, confirm: confirmDeleteIdea } = useConfirmDialog();
  const handleDeleteIdea = useCallback(async () => {
    if (!realId) return;
    const ok = await confirmDeleteIdea({
      title: isPolish ? 'Usunąć pomysł?' : 'Delete idea?',
      description: isPolish
        ? `„${title || 'Bez tytułu'}" zostanie trwale usunięty.`
        : `"${title || 'Untitled'}" will be permanently deleted.`,
      confirmLabel: isPolish ? 'Usuń' : 'Delete',
      cancelLabel: isPolish ? 'Anuluj' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Api.deleteMyIdea(realId);
      toast.success(isPolish ? 'Usunięto' : 'Deleted');
      navigate('/my-work/ideas');
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się usunąć' : 'Failed to delete'));
    }
  }, [realId, confirmDeleteIdea, isPolish, title, navigate]);

  /**
   * E12 (RISK-22) — sets `my_ideas.confidentiality` via `PUT /my-ideas/:id`
   * (server/src/routes/my-work.routes.ts ~3217-3230; validated + audited
   * there — before/after confidentiality lands in the IDEA_UPDATE audit
   * event). The confirm/save/revert logic lives in useIdeaConfidentialityGate
   * (src/components/MyWork/useIdeaConfidentialityGate.ts) — this is just the
   * `realId` binding, so the pill in IdeaWorkspaceTools.tsx doesn't need to
   * know the idea id itself.
   */
  const handleConfidentialityChange = useCallback(
    (next: 'standard' | 'confidential' | 'restricted') =>
      handleConfidentialityChangeForId(realId, next),
    [handleConfidentialityChangeForId, realId]
  );

  // Duplicate: clone the idea + its map on the server, then deep-link into the
  // NEW copy's workspace on the same tool the user is currently in (backend drops
  // promotion state and suffixes the title with (kopia)/(copy)).
  const handleDuplicateIdea = useCallback(async () => {
    if (!realId) return;
    try {
      const dup = await Api.duplicateMyIdea(realId, { language: isPolish ? 'pl' : 'en' });
      const newId = dup?.id ? String(dup.id) : null;
      if (!newId) throw new Error(isPolish ? 'Brak id kopii' : 'No copy id returned');
      toast.success(isPolish ? 'Zduplikowano' : 'Duplicated');
      const toolSlug = activeTool === 'process_flow' ? 'process-flow' : activeTool;
      navigate(`/my-work/ideas/${encodeURIComponent(newId)}/workspace/${toolSlug}`);
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się zduplikować' : 'Failed to duplicate'));
    }
  }, [realId, isPolish, activeTool, navigate]);
  // Z-menu1-history: "Historia" kebab entry — opens SnapshotHistory over the
  // live mindmap graph. Restore replays the same captureToolGraph+flushGraph
  // pattern as `handleImportGraph` (import), so it lands through the normal
  // autosave/versioning pipeline instead of a side-channel state set.
  const handleRestoreSnapshot = useCallback(
    async (
      restoredNodes: any[],
      restoredEdges: any[],
      restoredExtensions?: Record<string, unknown>
    ) => {
      // New snapshots carry the full tool-specific state (processFlow.lanes,
      // whiteboard.drawingPaths/scenes/mode, table config), so restore rolls
      // the WHOLE tool back — not just the shared nodes/edges. captureToolGraph
      // deep-merges into the live extensions, and arrays (lanes, drawingPaths)
      // are atomic so they replace the current value → a real rollback.
      // Pre-extension snapshots have no extensions → fall back to re-asserting
      // the live lanes (previous mindmap behaviour), which is non-destructive.
      const hasExt =
        restoredExtensions &&
        typeof restoredExtensions === 'object' &&
        Object.keys(restoredExtensions).length > 0;
      const extensions = hasExt
        ? restoredExtensions
        : mergeWorkspaceExtensions({ processFlow: { lanes: graphLanes } }, {});
      graphRuntime.captureToolGraph(
        {
          nodes: restoredNodes as any[],
          edges: restoredEdges as any[],
          extensions,
        },
        { reason: 'semantic', immediate: true }
      );
      await graphRuntime.flushGraph({
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: 'restore',
      });
      setMapRefreshToken((v) => v + 1);
    },
    [graphRuntime, graphLanes]
  );
  // ── Menu 1 (top bar) chips — Z7 anatomy ─────────────────────────────────
  // Clean identity row: ghost Teresa (secondary) + kebab `⋯`. Real: Eksport +
  // Historia (all canvas tools) + Duplikuj + Usuń. Snapshots capture the shared
  // graph + extensions, so restore is a full rollback on every tool.
  // The sole primary "Konwertuj ▾" is `melsPrimaryActionSlot` below; the
  // per-tool VIEW actions moved to Menu 3 (`melsSecondBarNode`).
  const melsCanvasChips = useMemo(
    () =>
      melsCanvasEnabled
        ? buildIdeaMenu1Chips({
            isPolish: Boolean(isPolish),
            handlers: {
              onDiscuss: handleDiscussWithTeresa,
              onExport: () => setExportMenuOpen(true),
              // Historia: enabled for every canvas tool. All four tools
              // (mindmap/whiteboard/process_flow/table) share ONE per-idea graph
              // (nodes/edges/extensions), and snapshots now capture extensions
              // too — so restore rolls back the whole tool uniformly.
              onHistory: () => setSnapshotHistoryOpen(true),
              onDuplicate: handleDuplicateIdea,
              onDelete: handleDeleteIdea,
              onSearch: () => setSearchOpen(true),
              onShowHelp: () => setShortcutsHelpOpen(true),
            },
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      melsCanvasEnabled,
      isPolish,
      handleDiscussWithTeresa,
      handleDuplicateIdea,
      handleDeleteIdea,
      activeTool,
    ]
  );
  // ── Menu 3 (second bar) view actions — Z7 anatomy ───────────────────────
  // PRZEPIĘTE NA RENDER Z REJESTRU AKCJI (pierwsza powierzchnia, wzorzec dla
  // kolejnych). Host NIE trzyma już własnej listy pozycji ani ich handlerów —
  // `buildIdeaMenu3Actions` pobiera zestaw z `getActionsForSurface('menu3', …)`
  // (filtr surfaces⊇menu3 + tools⊇aktywne narzędzie, kolejność wg rozdz. 05), a
  // każdy klik wykonuje `runIdeaAction(id, …)` — ten sam tor, którego użyje
  // Teresa (Z4). Rozjazdy „dodaj/auto-układ/AI rozwiń" (P1-1) są teraz zaszyte
  // w samych deklaracjach rejestru (`RUNTIME_*`, handler `idea.view.auto_layout`),
  // więc nie ma już potrzeby rozgałęziać ich tutaj po `activeTool`.
  const melsMenu3Actions = useMemo(
    () =>
      melsCanvasEnabled
        ? buildIdeaMenu3Actions({
            tool: activeTool,
            hasContent: mapHasNodes,
            isPolish: Boolean(isPolish),
            ideaId: realId,
            selection,
          })
        : { left: [], right: [] },
    [melsCanvasEnabled, activeTool, mapHasNodes, isPolish, realId, selection]
  );
  // P0-4 / Z3: Inspektor i Kondycja mają treść tylko dla części reprezentacji.
  // Zakładka bez treści nie może być klikalna — wyłączamy ją z podanym powodem,
  // zamiast otwierać pusty panel. Źródło prawdy to warunki `activeTool` w
  // <IdeaWorkspaceTools> (sekcje inspector/health): jeśli tam dojdzie kolejna
  // reprezentacja, dopisz ją tutaj — inaczej wróci martwy klik.
  const melsCanvasRightRailTools = useMemo(() => {
    if (!melsCanvasEnabled) return [];
    // Układ SZEŚCIU sekcji (flaga `ff_ideaPanel6Sections`, default OFF) ma
    // własny, niezależny budowniczy paska — patrz `panel/ideaPanel6Sections.ts`.
    // Przy fladze OFF nie zmienia się nic: leci stary builder pięciu ikon.
    if (panel6Enabled) return buildIdeaPanel6RailTools({ isPolish: Boolean(isPolish), activeTool });
    const inspektorJest =
      activeTool === 'mindmap' || activeTool === 'whiteboard' || activeTool === 'process_flow';
    const kondycjaJest = activeTool === 'mindmap' || activeTool === 'process_flow';
    return buildIdeaCanvasRightRailTools({
      ...(isPolish
        ? {
            labels: {
              problem: 'Problem',
              status: 'Status',
              inspector: 'Inspektor',
              convert: 'Konwersja',
              health: 'Kondycja',
            },
          }
        : {}),
      disabled: { inspector: !inspektorJest, health: !kondycjaJest },
      disabledReasons: {
        inspector: isPolish
          ? 'w Tabeli właściwości edytujesz w menu kolumny i wiersza'
          : 'in Table, properties are edited from the column and row menus',
        health: isPolish
          ? 'liczona dla Mapy myśli i Przepływu'
          : 'computed for Mind Map and Process Flow',
      },
    });
  }, [melsCanvasEnabled, panel6Enabled, isPolish, activeTool]);

  // ── Shared IdeaWorkspaceTools props (single source) ─────────────────────
  // The workspace inspector (5 sections: Problem · Status · Inspector · Convert
  // · Health) is rendered in exactly one place per path: the legacy sliding
  // drawer (`renderWorkspaceSiblings`) OR — under the EditorShell flag — the
  // shell right-rail panel (`renderMelsCanvasRightRailPanel`). Both consume this
  // one prop bundle so their content never drifts. Declared after every handler
  // it references (all defined above), so it is TDZ-safe.
  const ideaWorkspaceToolsSharedProps = useMemo(
    () => ({
      ideaId: realId,
      title,
      seedText,
      stage,
      branch,
      area,
      priority,
      confidentiality,
      confidentialitySupported,
      confidentialitySaving,
      onConfidentialityChange: handleConfidentialityChange,
      isDraft,
      isAccepted,
      saving,
      draftSavedLabel,
      activeTool,
      selection,
      onTitleChange: (v: string) => {
        setTitle(v);
        setDirty(true);
      },
      onSeedTextChange: (v: string) => {
        setSeedText(v);
        setDirty(true);
      },
      onBranchChange: (v: string) => {
        setBranch(v);
        setDirty(true);
      },
      onAreaChange: (v: string) => {
        setArea(v);
        setDirty(true);
      },
      onPriorityChange: (v: number) => {
        setPriority(v);
        setDirty(true);
      },
      onSave: handleSave,
      onAcceptChallenge: handleAcceptChallenge,
      onStageChange: handleStageChange,
      onConvert: handleConvert,
      onOpenChat: openChat,
      graphNodes,
      graphEdges,
      evidenceCount: graphNodes.filter((n: any) => n?.data?.evidenceLinks?.length > 0).length,
      // E08 (idea maturity model) — real signals + attestation handler, see
      // ideaMaturityModel.ts and IdeaWorkspaceTools.tsx's `maturityReport`.
      sourceType: ideaSourceType,
      evidenceRefsCount: ideaEvidenceRefsCount,
      promotedTo: ideaPromotedTo,
      maturityGates,
      maturityGatesSupported,
      onAttestMaturity: handleAttestMaturity,
      // P1-1 (Z3): wiersz „Podsumuj AI / Rozwiń AI" w sekcji Status prawego
      // panelu wysyła mm_ai_summarize / mm_ai_expand — obsługuje je wyłącznie
      // useMindMapQuickActions (zamontowany tylko w Mapie myśli). Poza Mapą
      // przyciski były klikalne i nie robiły NIC. IdeaWorkspaceTools rysuje je
      // tylko wtedy, gdy handler istnieje, więc `undefined` = brak przycisku.
      onAISummarize:
        activeTool === 'mindmap' ? () => handleQuickAction('mm_ai_summarize') : undefined,
      onAIExpand: activeTool === 'mindmap' ? () => handleQuickAction('mm_ai_expand') : undefined,
      /**
       * Sekcja „AI" w kontekście ELEMENTU (układ 6 sekcji). Ta sama trasa,
       * którą wysyła pigułka AI pod zaznaczonym węzłem mapy
       * (`IdeaRecommendationMap` → `idea-mindmap-node-quick-action`), obsługiwana
       * przez `useMindMapQuickActions`. Ten hook jest zamontowany WYŁĄCZNIE w
       * Mapie myśli, więc poza nią nie podajemy handlera — panel narysuje
       * uczciwy pusty stan zamiast czterech martwych przycisków (Z3).
       */
      onAINodeAction:
        activeTool === 'mindmap'
          ? (action: string, nodeId: string) => {
              window.dispatchEvent(
                new CustomEvent('idea-mindmap-node-quick-action', {
                  detail: { action, nodeId },
                })
              );
            }
          : undefined,
      onLayoutChange: (mode: string) => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'set_layout_mode', layoutMode: mode },
          })
        );
      },
      onThemeChange: (theme: string) => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'set_map_theme', theme },
          })
        );
      },
      onStyleChange: (patch: Record<string, any>) => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'apply_style', ...patch },
          })
        );
      },
      onFitView: () => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'pane_fit_view' },
          })
        );
      },
      onAutoLayout: () => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'pane_auto_layout' },
          })
        );
      },
      whiteboardSession,
      whiteboardOutcomes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      realId,
      title,
      seedText,
      stage,
      branch,
      area,
      priority,
      confidentiality,
      confidentialitySupported,
      confidentialitySaving,
      handleConfidentialityChange,
      isDraft,
      isAccepted,
      saving,
      draftSavedLabel,
      activeTool,
      selection,
      graphNodes,
      graphEdges,
      handleSave,
      handleAcceptChallenge,
      handleStageChange,
      handleConvert,
      openChat,
      handleQuickAction,
      whiteboardSession,
      whiteboardOutcomes,
      setTitle,
      setSeedText,
      setBranch,
      setArea,
      setPriority,
      setDirty,
    ]
  );

  // ── Shared context / AI-suggestions panel prop bundles ──────────────────
  // Single source for the two remaining right-side panels so the legacy drawers
  // (renderWorkspaceSiblings) and the Oś-P consolidated panel never drift. The
  // `open`/`onClose` framing props are supplied at each render site.
  const ideaContextPanelSharedProps = useMemo(
    () => ({
      ideaId: realId,
      title: title || safeTitleFromSeed(seedText, isPolish),
      selectedNodeId: selection.ids?.[0] || null,
      selectionMeta: selection.type === 'node' && selection.count === 1 ? selection.meta : null,
      refreshToken: mapRefreshToken,
      liveGraphNodes: graphNodes,
      liveGraphEdges: graphEdges,
      mapExtensions,
      activeTool,
      stage,
      seedText,
      onInsertToCanvas: (item: { text: string; type: string; detail?: string }) => {
        window.dispatchEvent(
          new CustomEvent('idea-workspace-insert', { detail: { items: [item], ideaId: realId } })
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      realId,
      title,
      seedText,
      isPolish,
      selection,
      mapRefreshToken,
      graphNodes,
      graphEdges,
      mapExtensions,
      activeTool,
      stage,
    ]
  );

  const ideaAISuggestionsPanelSharedProps = useMemo(
    () => ({
      ideaId: realId,
      title: title || safeTitleFromSeed(seedText, isPolish),
      seedText,
      activeTool,
      isAccepted,
      selectedNodeId: selection.ids?.[0] || null,
      onSendToChat: openChat,
      onInsertToWorkspace: (items: Array<{ text: string; type: string }>) => {
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
      },
      graphNodes,
      graphEdges,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      realId,
      title,
      seedText,
      isPolish,
      activeTool,
      isAccepted,
      selection,
      openChat,
      graphNodes,
      graphEdges,
      setProposalBatch,
      setActivePanel,
    ]
  );

  // EditorShell right-rail panel body. P0-4: each of the five rail icons
  // (problem · status · inspector · convert · health) is a TAB — it must render
  // only its own section. The ids from `buildIdeaCanvasRightRailTools` match the
  // `IdeaPanelSection` union 1:1, so the id is passed straight through as
  // `onlySection`. Rendered `embedded` so it drops its own drawer chrome and
  // fills the shell's rail column. The matching legacy drawer is suppressed
  // below when the flag is ON (no dupes).
  const renderMelsCanvasRightRailPanel = useCallback(
    (activeToolId: string | null): React.ReactNode => {
      // Układ 6 sekcji: id z paska idzie WPROST (panel sam je normalizuje przez
      // `normalizujDoSzesciu`). Bez tego nowe id `ai`/`activity`/`tool` wpadałyby
      // w fallback `problem` i trzy ikony pokazywałyby Przegląd.
      const section = panel6Enabled
        ? ((activeToolId ?? 'overview') as IdeaPanelSection)
        : IDEA_PANEL_SECTIONS.includes(activeToolId as IdeaPanelSection)
          ? (activeToolId as IdeaPanelSection)
          : 'problem';
      return (
        <IdeaWorkspaceTools
          {...ideaWorkspaceToolsSharedProps}
          open
          embedded
          onlySection={section}
          onClose={() => handlePanelChange(null)}
        />
      );
    },
    [ideaWorkspaceToolsSharedProps, handlePanelChange, panel6Enabled]
  );

  if (loading) {
    return (
      <div className="h-full w-full bg-[var(--c-surface)] p-6">
        {/* VF1 SPEC-A (flag OFF default): A·Canvas artifacts load into the
            canonical canvas skeleton; legacy panel skeleton stays default. */}
        {vf1CanvasSpecAEnabled ? (
          <SkeletonState variant="canvas" />
        ) : (
          <LoadingState template="panel" />
        )}
      </div>
    );
  }

  // Shared subtrees — identical in the legacy floating-chrome path and the
  // EditorShell path, so neither drifts. `renderCanvasToolsNode` /
  // `renderFloatingLeftRail` / `renderWorkspaceSiblings` are hoisted function
  // declarations defined at the end of the component.
  const canvasToolsNode = renderCanvasToolsNode();
  const floatingLeftRailNode = renderFloatingLeftRail();
  // D2: przelacznik w prawym dolnym rogu — portal do body, wiec jeden wezel
  // dziala w obu sciezkach renderu (mels i legacy). OFF => null.
  // MELS always exposes the four representations in the canonical bottom bar.
  // The legacy path still honours its reversible feature flag.
  const viewSwitcherNode =
    melsCanvasEnabled || switcherBottomRight ? (
      <IdeaViewSwitcher
        activeTool={activeTool}
        onToolChange={setActiveTool}
        isPl={isPolish}
        familyCounts={familyCounts}
      />
    ) : null;
  const workspaceSiblingsNode = renderWorkspaceSiblings();

  if (melsCanvasEnabled) {
    return (
      <div
        ref={workspaceRootRef}
        className="w-full h-full flex flex-col overflow-hidden bg-c-surface-raised dark:bg-c-surface"
        style={{ touchAction: 'none' }}
        role="region"
        aria-label={t('mindmap.ideaMapWorkspace')}
        data-local-command-palette="idea-map"
      >
        <div ref={canvasContainerRef} className="flex-1 min-w-0 min-h-0 relative">
          <IdeaCanvasMelsView
            title={title || safeTitleFromSeed(seedText, isPolish) || t('mindmap.untitled')}
            onBack={() => navigate('/my-work/ideas')}
            backLabel={t('mindmap.ideas')}
            moduleLabel={t('mindmap.ideas')}
            topBarChips={melsCanvasChips}
            titleIconSlot={<IdeaToolIcon tool={activeTool} label={activeToolLabel} />}
            titleTrailingSlot={
              <>
                <IdeaStageChip stage={stage} isPolish={Boolean(isPolish)} />
                <IdeaSaveIndicator state={graphRuntime.syncState} label={graphRuntime.syncLabel} />
              </>
            }
            primaryActionSlot={
              <IdeaConvertMenu
                onConvert={(target) => handleConvert(target)}
                isPolish={Boolean(isPolish)}
                disabled={!mapHasNodes}
              />
            }
            secondBar={
              ideaTopBarOneLine ? undefined : (
                <IdeaCanvasSecondBar
                  left={melsMenu3Actions.left}
                  right={melsMenu3Actions.right}
                  ariaLabel={t('mindmap.ideaCanvasAndMapTools')}
                />
              )
            }
            mergeTopBarSlotId={ideaTopBarOneLine ? IDEA_TOP_BAR_SLOT_ID : undefined}
            rightRailTools={melsCanvasRightRailTools}
            // Sterujemy sekcją TYLKO gdy IDE-025 jest włączone — inaczej
            // `undefined` zostawia powłokę w jej dotychczasowym trybie
            // niesterowanym (zero zmiany zachowania przy fladze OFF).
            activeRightRailToolId={detaleWPanelu && panel6Enabled ? sekcjaPrawegoPaska : undefined}
            onActiveRightRailToolChange={setSekcjaPrawegoPaska}
            renderRightRailPanel={renderMelsCanvasRightRailPanel}
            elementInspectorRail={
              ideaInspectorRightRail ? (
                <IdeaElementInspector
                  element={
                    selection.type === 'none' || !selection.primaryId
                      ? null
                      : {
                          id: selection.primaryId,
                          label: selection.meta?.label || selection.primaryId,
                          state: selection.meta?.status,
                          owner: selection.meta?.owner,
                          semanticType: selection.meta?.semanticType || selection.meta?.nodeType,
                          description: selection.meta?.description,
                          tags: selection.meta?.tags,
                          outputs: inspectorOutputs,
                          branch: activeToolLabel,
                          lineage: `${isPolish ? 'Rodowód' : 'Lineage'}: ${activeToolLabel} · v${graphRuntime.graph.version}`,
                          savedAt: graphRuntime.lastSavedAt,
                        }
                  }
                  tool={
                    (activeTool === 'process_flow' ? 'process' : activeTool) as IdeaInspectorTool
                  }
                  toolSection={inspectorToolSection}
                  recentItems={recentInspectorItems}
                  onOpenRecent={(id) => {
                    window.dispatchEvent(
                      new CustomEvent('idea-node-open-detail', { detail: { nodeId: id } })
                    );
                  }}
                  nativeStates={
                    activeTool === 'table'
                      ? ['todo', 'in_progress', 'done', 'blocked']
                      : activeTool === 'process_flow'
                        ? []
                        : [
                            'idea',
                            'exploring',
                            'validated',
                            'ready_to_convert',
                            'converted',
                            'ready',
                            'rejected',
                          ]
                  }
                  language={isPolish ? 'pl' : 'en'}
                  onOpenOutput={(targetId) => {
                    // FIX-6 (Day 3 acceptance): "Otwórz" used to only handle
                    // targetType 'initiative'/'task' — any other conversion
                    // target (decision, report, …) had a dead button. Route
                    // through the shared artifactLinks deep-link map for
                    // every recognized ArtifactType instead of a 2-case
                    // switch; 'task_set' is a convert-menu concept, not an
                    // ArtifactType, so it keeps its own explicit route.
                    const output = inspectorOutputs.find((item) => item.targetId === targetId);
                    if (!output) return;
                    if (output.type === 'task_set') {
                      navigate(`/my-work/tasks?taskId=${encodeURIComponent(targetId)}`);
                      return;
                    }
                    if (output.type in ARTIFACT_IDENTITY) {
                      navigate(getArtifactPath(output.type as ArtifactType, targetId));
                    }
                  }}
                  onSave={async (patch) => {
                    if (!selection.primaryId) throw new Error('NO_SELECTION');
                    const nativePatch: Partial<ExtendedNodeData> = {
                      ...(patch.label !== undefined ? { label: patch.label } : {}),
                      ...(patch.state !== undefined ? { status: patch.state } : {}),
                      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
                      ...(patch.description !== undefined
                        ? { description: patch.description }
                        : {}),
                    };
                    await handleNodeDataChange(selection.primaryId, nativePatch);
                    const readback = await Api.getMyIdeaMap(realId, { language: i18n.language });
                    const node = (readback?.map?.nodes || []).find(
                      (candidate: any) => String(candidate?.id) === selection.primaryId
                    );
                    if (!node) throw new Error('READBACK_MISSING');
                    for (const [key, value] of Object.entries(nativePatch)) {
                      if (node.data?.[key] !== value) throw new Error('READBACK_MISMATCH');
                    }
                    return {
                      id: selection.primaryId,
                      label: node.data?.label || '',
                      state: node.data?.status,
                      priority: node.data?.priority,
                      owner: node.data?.owner,
                      semanticType: node.data?.semanticType || node.data?.nodeType,
                      description: node.data?.description,
                      tags: node.data?.tags,
                      outputs: inspectorOutputs,
                      branch: activeToolLabel,
                      lineage: `${isPolish ? 'Rodowód' : 'Lineage'}: ${activeToolLabel} · v${readback.map?.version || graphRuntime.graph.version}`,
                      savedAt: new Date(),
                    };
                  }}
                  onReturnToCanvas={() => canvasContainerRef.current?.focus()}
                />
              ) : undefined
            }
            // Układ 6 sekcji: pasek ikon zawsze widoczny (decyzja właściciela).
            rightRailCollapsible={!panel6Enabled}
            canvas={
              <>
                {canvasToolsNode}
                {/* #6a: the tool switcher now lives solely in the left rail
                    (floatingLeftRail below, CanvasLeftToolbar); the per-tool
                    actions (search / help / discuss) live in the shell
                    command-row (melsCanvasChips). Nothing left to float here. */}
              </>
            }
            floatingLeftRail={
              <>
                {floatingLeftRailNode}
                {viewSwitcherNode}
              </>
            }
            siblings={workspaceSiblingsNode}
            onRunPrimary={() => handleQuickAction('mm_add_child')}
            onOpenCommandPalette={cmdPalette.open}
            onOpenShortcutHelp={() => {
              setShortcutsHelpOpen(true);
              return false;
            }}
          />
        </div>

        {/* E11 (2026-08-10) — same mandatory-preview gate as the legacy shell
            below. Without this, the mels shell's `IdeaConvertMenu` above sets
            `conversionPreviewOpen` with nothing to render it — a dead click
            (the mels branch returns early and skips the legacy branch's
            modal block entirely, confirmed by reading both return paths
            before adding this). */}
        <ConversionPreviewDialog
          open={conversionPreviewOpen}
          isPolish={Boolean(isPolish)}
          data={conversionPreviewData}
          submitting={conversionSubmitting}
          onConfirm={handleConversionPreviewConfirm}
          onCancel={handleConversionPreviewCancel}
        />
        {/* MYW-IDEAS-010: previously gated to activeTool === 'process_flow'
            only — the candidate is idea-level (see the fetch effect above),
            so the affordance is now available from every tool, not just
            whichever one happened to be open when the candidate was created. */}
        {Boolean(realId) && (
          <div className="absolute bottom-4 right-4 z-sticky flex items-center gap-2 rounded-xl border border-c-border bg-c-surface-raised p-2 shadow-lg">
            {candidateHandoff?.candidate?.id || candidateHandoff?.candidate_id ? (
              <button
                type="button"
                data-testid="process-flow-candidate-readback"
                onClick={() =>
                  navigate(
                    `/initiatives?tab=candidates&candidateInbox=discovery&candidateId=${encodeURIComponent(
                      String(candidateHandoff?.candidate?.id || candidateHandoff?.candidate_id)
                    )}`
                  )
                }
                className="text-xs text-c-text-secondary underline"
              >
                {isPolish ? 'Kandydat gotowy' : 'Candidate ready'}
              </button>
            ) : null}
            {candidatePreview ? (
              <div
                data-testid="process-flow-candidate-preview"
                className="max-w-xs text-xs text-c-text-secondary"
              >
                <div>
                  {candidatePreview.nodeCount} nodes · {candidatePreview.edgeCount} edges · v
                  {candidatePreview.mapVersion}
                </div>
                <div>
                  {((candidatePreview.projection?.nodes || []) as any[])
                    .slice(0, 3)
                    .map((node) => String(node?.data?.label || node?.id || ''))
                    .filter(Boolean)
                    .join(' → ')}
                </div>
                <div>
                  {((candidatePreview.projection?.processFlow?.lanes || []) as any[])
                    .slice(0, 3)
                    .map((lane) => String(lane?.name || lane?.label || lane?.id || ''))
                    .filter(Boolean)
                    .join(', ')}
                </div>
                <code>{String(candidatePreview.projectionHash).slice(0, 12)}…</code>
                <button
                  type="button"
                  onClick={() => setCandidatePreview(null)}
                  className="ml-2 underline"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              data-testid={
                candidatePreview
                  ? 'confirm-process-flow-candidate'
                  : 'approve-process-flow-candidate'
              }
              disabled={candidateHandoffBusy || graphRuntime.saving}
              onClick={
                candidatePreview
                  ? handleApproveProcessFlowCandidate
                  : handlePreviewProcessFlowCandidate
              }
              className="rounded-lg bg-c-brand-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {candidateHandoffBusy
                ? isPolish
                  ? 'Zatwierdzanie…'
                  : 'Approving…'
                : isPolish
                  ? candidatePreview
                    ? 'Potwierdź kandydaturę'
                    : 'Przejrzyj kandydaturę'
                  : candidatePreview
                    ? 'Confirm candidate'
                    : 'Review candidate'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={workspaceRootRef}
      className="w-full h-full flex overflow-hidden bg-c-surface-raised dark:bg-c-surface"
      style={{ touchAction: 'none' }}
      role="region"
      aria-label={t('mindmap.ideaMapWorkspace')}
      // Signals the global command palette to yield Cmd+K to this scoped palette.
      data-local-command-palette="idea-map"
    >
      {/* Canvas area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 min-w-0 h-full relative"
        role="group"
        aria-label={t('mindmap.ideaCanvasAndMapTools')}
      >
        {/* #6e: fullscreen = 100% płótna, zero górnych pasków — cała góra
            (breadcrumb drill-down, focus indicator, tool-switcher/Discuss)
            znika; Esc wychodzi z fullscreen (natywne browser Fullscreen API,
            już obsłużone przez toggleWorkspaceFullscreen/fullscreenchange). */}
        {!isFullscreen && (
          <>
            {/* Breadcrumb for drill-down navigation */}
            {drillDownStack.length > 0 && (
              <div className="absolute top-2 left-4 z-sticky flex items-center gap-1 bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm rounded-xl px-3 py-1.5 border border-c-border-subtle dark:border-c-border-subtle shadow-sm">
                <button
                  onClick={() => handleDrillUp(0)}
                  className="text-[10px] font-semibold text-c-text-secondary dark:text-c-text-muted hover:underline"
                >
                  {t('mindmap.rootMap')}
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
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-sticky flex items-center gap-2 bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm rounded-xl px-3 py-1.5 border border-c-border-subtle dark:border-c-border-subtle shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-c-text-secondary dark:text-c-text">
                  {focusMode === 'system'
                    ? t('mindmap.focusedOnTool', { activeToolLabel })
                    : t('mindmap.objectFocus')}
                </span>
                <button
                  onClick={handleExitFocus}
                  className="text-[10px] font-semibold text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text transition-colors"
                >
                  {t('mindmap.fullCanvas')}
                </button>
              </div>
            )}
          </>
        )}

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
        {canvasToolsNode}

        {/* UI overlays rendered AFTER canvas tools so they appear on top */}
        {floatingLeftRailNode}
        {viewSwitcherNode}

        {/* #6a/#6e: top chrome (governance badge + global actions: search/
            help/Discuss with Teresa) hides in fullscreen — cała góra znika.
            The tool switcher moved to the left rail (floatingLeftRailNode,
            CanvasLeftToolbar) — this widget is now search+help+Discuss only. */}
        {!isFullscreen && (
          <>
            {/* MM-12: AI Governance badge — opens governance panel */}
            <div className="absolute left-[4.5rem] top-4 z-sticky">
              <AIGovernanceBadge
                mapExtensions={mapExtensions}
                onClick={() => setGovernancePanelOpen(true)}
              />
            </div>

            <IdeaWorkspaceToolbar
              onSearch={() => setSearchOpen(true)}
              onShowHelp={() => setShortcutsHelpOpen(true)}
              onDiscuss={handleDiscussWithTeresa}
              discussDisabled={!mapHasNodes}
            />
          </>
        )}

        {proposalBatch && (
          <div className="absolute bottom-4 left-4 right-4 z-dropdown max-w-lg mx-auto">
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

      {/* Tools panel sidebar + inspectors + all modals/drawers/popovers */}
      {workspaceSiblingsNode}
    </div>
  );

  // ── Hoisted shared subtrees (function declarations — hoisted, so callable
  // above their definition; identical output in the legacy and EditorShell
  // paths). They close over the component's state/handlers directly. ────────
  function renderCanvasToolsNode(): React.ReactNode {
    return (
      <>
        {activeTool === 'mindmap' && (
          <CanvasToolErrorBoundary
            key={`eb-mindmap-${realId}`}
            toolName={t('mindmap.recommendationMap')}
            onRetry={() => setMapRefreshToken((v) => v + 1)}
          >
            <IdeaRecommendationMap
              ideaId={realId}
              ideaTitle={title || safeTitleFromSeed(seedText, isPolish)}
              // B2: parytet z Tabelą/Process Flow/Whiteboard — bez tego Mind Map
              // był JEDYNYM narzędziem bez sygnału „graf podmieniony z zewnątrz"
              // (szablon, retry po błędzie), więc kanwa zostawała stara.
              refreshToken={mapRefreshToken}
              onClose={() => setMapOpen(false)}
              onCenterEdit={() => handlePanelChange('tools')}
              preferredTool={activeTool}
              extensions={mapExtensions}
              onPreferredToolLoaded={(tool) => {
                if (!tool) return;
                // Deep link always wins — never self-heal away from it.
                if (initialTool) return;
                if (userSelectedToolRef.current) return;
                if (tool === activeTool) return;
                // P0-5: `tool` here is read by the mind-map canvas's OWN map
                // fetch from the SHARED canonical map row (`preferredTool` —
                // see the module note above `readLocalToolPreference`). Only
                // self-heal toward THIS browser's own remembered choice for
                // this idea — never toward whatever another org member
                // happened to have active when they last saved.
                if (tool !== readLocalToolPreference(realId)) return;
                setTimeout(() => setActiveTool(tool), 0);
              }}
              variant={mapOpen && !melsCanvasEnabled ? 'overlay' : 'embedded'}
              showClose={mapOpen && !melsCanvasEnabled}
              className={mapOpen && !melsCanvasEnabled ? '' : 'rounded-none'}
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
                const prompt = t('mindmap.summarizeIdeaCardPrompt', { title });
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
                  toast.error(t('mindmap.failedToChangeStage'));
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
                loadError: graphRuntime.loadError,
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
              // Z9: mels canvas shell → Menu 1 (IdeaSaveIndicator) owns the save
              // state, so the per-tool toolbar hides its own Save button (zero
              // dubli). Legacy (flag OFF) → false → unchanged.
              hideSaveIndicator={melsCanvasEnabled}
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
              // Z9: mels canvas shell → Menu 1 owns the save indicator; toolbar
              // hides its own Save button (zero dubli). Legacy → false.
              hideSaveIndicator={melsCanvasEnabled}
              refreshToken={mapRefreshToken}
              onSelectionChange={handleSelectionChange}
              // NO onGraphChange here (unlike Table/Whiteboard): those tools own
              // persistence via the legacy per-tool useIdeaMapSync fallback, so
              // mirroring their local state into the shared runtime via
              // replaceGraph() is a harmless side-channel. Process Flow instead
              // persists THROUGH the shared runtime itself (externalRuntime.
              // captureGraph = graphRuntime.captureToolGraph below). Wiring
              // onGraphChange=replaceRuntimeGraph here raced captureToolGraph's
              // own setGraph on every node-add: replaceGraph's effect (declared
              // earlier in IdeaProcessFlowTool, runs first) synced the runtime's
              // `prev` graph to already match the new nodes BEFORE captureToolGraph's
              // dedup check ran, so that check saw prev === merged and skipped
              // queueSync — the new node was applied to local ReactFlow state and
              // to graphRuntime.graph, but NEVER queued to POST /map/sync. Toolbar
              // "add shape" clicks were silently dropped on reload. (P0 fix)
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
              // Z9: mels canvas shell → Menu 1 owns the save indicator; toolbar
              // hides its own Save button (zero dubli). Legacy → false.
              hideSaveIndicator={melsCanvasEnabled}
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
      </>
    );
  }

  function renderFloatingLeftRail(): React.ReactNode {
    return (
      <CanvasLeftToolbar
        side={melsCanvasEnabled ? 'right' : 'left'}
        activeTool={activeTool}
        interactionMode={mindMapInteractionMode}
        selection={selection}
        isAccepted={isAccepted}
        ideaId={realId}
        canvasContainerRef={canvasContainerRef}
        canUndo={railCanUndo}
        canRedo={railCanRedo}
        heuristicAiEnabled={heuristicAiOverlaysEnabled}
        onAction={(action) => handleQuickAction(action)}
        onOpenChat={() => {
          setChatKickoffMessage('');
          if (isChatCollapsed) toggleChatCollapse();
        }}
        onApplyTemplate={handleApplyTemplate}
        onOpenTemplateGallery={() => setTemplateGalleryOpen(true)}
        // D2: gdy przelacznik jest w prawym dolnym rogu, zdejmujemy go z railа.
        onToolChange={melsCanvasEnabled || switcherBottomRight ? undefined : setActiveTool}
        familyCounts={familyCounts}
      />
    );
  }

  function renderWorkspaceSiblings(): React.ReactNode {
    return (
      <>
        {/*
        ★ D16/D17/Z8 — JEDEN prawy panel idei (dok Teresy) = `<IdeaRightPanel>`
        (accordion ArtifactRightPanel), przebudowany (2026-07-22) na 5 sekcji
        kanonu SPEC-A: Akcje · Właściwości · Powiązania · Komentarze ·
        Historia (ARTIFACT_ANATOMY_STANDARD §10.2/§11.2). Zastępuje
        archaiczny przełącznik 3 OSOBNYCH szuflad (#6q) dla WSZYSTKICH 4 narzędzi
        — bez flagi (default). Montuje się gdy pasek otworzy dowolną sekcję
        (parytet z self-hide szuflad: canvas rozszerza się po zamknięciu).
        Reużywa te same panele co legacy (IdeaWorkspaceTools/IdeaContextPanel/
        IdeaAISuggestionsPanel) jako `embedded` sekcje — ZERO bespoke; Akcje =
        eksport/konwertuj realnymi handlerami workspace (te same co Menu 1/3
        kebab), Komentarze = pusta (brak kanału na poziomie idei — per-node
        wątki to inny zakres). Ścieżka mels-canvas (eksperymentalna, default
        OFF) zostaje na starych szufladach — nietknięta.
      */}
        {!melsCanvasEnabled && (toolsPanelOpen || contextPanelOpen || aiPanelOpen) && (
          <IdeaRightPanel
            isPolish={isPolish}
            activeSection={
              toolsPanelOpen ? 'properties' : contextPanelOpen ? 'relations' : 'teresa'
            }
            onExport={() => setExportMenuOpen(true)}
            onConvert={() => handlePanelChange('tools')}
            // HP-17: `EvidencePanelSection` („Źródła i założenia") tylko za flagą
            // ff_evidencePanel (default OFF, patrz src/utils/evidencePanelFlag.ts).
            // OFF → prop `undefined` → nic się nie dokłada pod Powiązania → zero
            // zmian DOM wobec stanu sprzed HP-17/Z8.
            evidenceArtifactId={isEvidencePanelEnabled() && realId ? realId : undefined}
            propertiesContent={
              <IdeaWorkspaceTools
                {...ideaWorkspaceToolsSharedProps}
                open
                embedded
                onClose={() => handlePanelChange(null)}
              />
            }
            relationsContent={
              <IdeaContextPanel
                {...ideaContextPanelSharedProps}
                open
                embedded
                onClose={() => handlePanelChange(null)}
              />
            }
            teresaContent={
              <IdeaTeresaSection
                isPolish={isPolish}
                aiSuggestionsProps={ideaAISuggestionsPanelSharedProps}
                onDiscuss={() => {
                  emitTeresaStatus('discuss', 'started');
                  handleDiscussWithTeresa();
                }}
              />
            }
          />
        )}

        {/* MELS owns exactly one semantic information panel. Legacy Context and
            AI Suggestions drawers remain available only on ff_melsCanvas=0;
            mounting them here created a second panel over the canvas. */}

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
          onApplied={handleTemplateApplied}
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
            // A3: pass through the full graph extensions so whiteboard JSON export is
            // round-trip safe (drawingPaths/scenes/bgPattern/sessionState survive) and
            // IdeaExportMenu can enforce extensions.whiteboard.sharePolicy.exportAllowed.
            ...mapExtensions,
            processFlow: { lanes: graphLanes },
            activeTool,
          }}
          canvasContainerRef={canvasContainerRef}
          onImportGraph={handleImportGraph}
        />

        {/* E11 (2026-08-10) — the single mandatory-preview gate shared by every
            Convert entry point (Menu 1, right-panel Convert section, Mind Map
            node menu, Table bulk convert, Process Flow node convert). See
            handleConvert/performConvert above. */}
        <ConversionPreviewDialog
          open={conversionPreviewOpen}
          isPolish={Boolean(isPolish)}
          data={conversionPreviewData}
          submitting={conversionSubmitting}
          onConfirm={handleConversionPreviewConfirm}
          onCancel={handleConversionPreviewCancel}
        />

        {drawerUnifiedEnabled ? (
          // M06 Fala 4.1b: canonical unified drawer (idea variant). ExtendedNodeData
          // carries nodeId separately, so merge it into UnifiedNodeData here. The
          // unified onUpdateNode maps 1:1 to the legacy onNodeDataChange contract.
          <UnifiedNodeDetailDrawer
            variant="idea"
            open={nodeDetailOpen}
            onClose={() => setNodeDetailOpen(false)}
            nodeData={
              nodeDetailOpen
                ? ({
                    ...(nodeDetailData as UnifiedNodeData),
                    nodeId: nodeDetailId,
                  } as UnifiedNodeData)
                : null
            }
            ideaId={realId}
            activeTool={activeTool}
            locked={canvasLocked}
            allNodes={graphNodes}
            mapVersion={graphRuntime.graph.version}
            onMapConflictRefresh={graphRuntime.refresh}
            onUpdateNode={(nid, patch) =>
              handleNodeDataChange(nid, patch as Partial<ExtendedNodeData>)
            }
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
        ) : (
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
        )}

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

        {/* Z-menu1-delete: Menu 1 kebab "Usuń" confirm dialog */}
        {deleteIdeaDialog}

        {/* E12 (RISK-22): confidentiality downgrade confirm dialog */}
        {confidentialityDowngradeDialog}

        {/* Z-menu1-history: Menu 1 kebab "Historia" — all canvas tools */}
        <SnapshotHistory
          open={snapshotHistoryOpen}
          onClose={() => setSnapshotHistoryOpen(false)}
          ideaId={realId || ''}
          currentNodes={graphNodes}
          currentEdges={graphEdges}
          currentExtensions={graphRuntime.graph.extensions as Record<string, unknown>}
          onRestore={handleRestoreSnapshot}
        />
      </>
    );
  }
};

export default IdeaMapWorkspace;
