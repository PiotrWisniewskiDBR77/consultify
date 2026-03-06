/**
 * IdeaMapWorkspace — fullscreen workspace for editing an idea.
 *
 * Unified toolbar (Menu 2i) merges canvas tool selector + panel strip.
 * Selection contract drives Tools panel content.
 * Propose→Accept UX for AI patches.
 */
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';

import type { CanvasToolType } from './ideaSelectionTypes';
import { IdeaAISuggestionsPanel } from './IdeaAISuggestionsPanel';
import { IdeaContextPanel } from './IdeaContextPanel';
import { IdeaProcessFlowTool } from './IdeaProcessFlowTool';
import { IdeaProposalReview } from './IdeaProposalReview';
import { IdeaRecommendationMap } from './IdeaRecommendationMap';
import { IdeaTableTool } from './IdeaTableTool';
import { IdeaTemplateGallery } from './IdeaTemplateGallery';
import { IdeaWhiteboardTool } from './IdeaWhiteboardTool';
import { IdeaGhostCards } from './IdeaGhostCards';
import { IdeaNodeDetailDrawer, type ExtendedNodeData } from './IdeaNodeDetailDrawer';
import { IdeaUnifiedSearch } from './IdeaUnifiedSearch';
import { CommandPalette, useCommandPalette } from './CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { IdeaVotingMode } from './IdeaVotingMode';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { IdeaWorkspaceToolbar } from './IdeaWorkspaceToolbar';
import { IdeaWorkspaceTools } from './IdeaWorkspaceTools';
import type { MyIdea } from './MyIdeasListContent';
import { EMPTY_SELECTION, type AIProposal, type AIProposalBatch, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { buildAskAIMessage } from './shared/askAiHelper';

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

function safeTitleFromSeed(seedText: string, isPolish: boolean): string {
  const firstLine = String(seedText || '')
    .trim()
    .split('\n')[0]
    ?.trim();
  return firstLine ? firstLine.slice(0, 120) : isPolish ? 'Nowe wyzwanie' : 'New challenge';
}

export const IdeaMapWorkspace: React.FC<IdeaMapWorkspaceProps> = ({
  ideaId,
  initialOpenMap,
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
  const [drillDownStack, setDrillDownStack] = useState<Array<{ nodeId: string; label: string }>>([]);
  const [votingActive, setVotingActive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const cmdPalette = useCommandPalette();

  const [internalActiveTool, setInternalActiveTool] = useState<CanvasToolType>(initialTool || 'mindmap');
  const [internalActivePanel, setInternalActivePanel] = useState<WorkspacePanelKey>(toolsOpenProp ? 'tools' : null);
  const [mapRefreshToken, setMapRefreshToken] = useState(0);
  const userSelectedToolRef = React.useRef(false);

  const activeTool = externalActiveTool ?? internalActiveTool;
  const activePanel = externalActivePanel ?? internalActivePanel;

  const setActiveTool = useCallback((tool: CanvasToolType) => {
    if (onActiveToolChange) onActiveToolChange(tool);
    else setInternalActiveTool(tool);
  }, [onActiveToolChange]);

  const setActivePanel = useCallback((panel: WorkspacePanelKey) => {
    if (onActivePanelChange) onActivePanelChange(panel);
    else setInternalActivePanel(panel);
  }, [onActivePanelChange]);

  const prevToolRef = React.useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      trackFunnelEvent('ideas_tool_switched', { from: prevToolRef.current, to: activeTool, ideaId: realId });
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
        let extensions: Record<string, unknown> =
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
              nodes.push({ id: n.id, type: n.type || 'idea', data: { label: n.label, ...n.data }, position: n.position || { x: 0, y: 0 } });
            }
          }
          if (patch.addEdges?.length) {
            for (const e of patch.addEdges) {
              edges.push({ id: e.id, source: e.source, target: e.target, type: 'default', data: { label: e.label, ...e.data } });
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
                  ? { ...n, parentNode: mv.parentId, parentId: mv.parentId, position: mv.position || n.position, data: { ...(n.data || {}), parentId: mv.parentId } }
                  : n
              );
            }
          }
          if (patch.extensions && typeof patch.extensions === 'object') {
            for (const [key, val] of Object.entries(patch.extensions)) {
              const existing = extensions[key];
              if (existing && typeof existing === 'object' && typeof val === 'object' && val && !Array.isArray(val)) {
                extensions[key] = { ...(existing as Record<string, unknown>), ...(val as Record<string, unknown>) };
              } else {
                extensions[key] = val;
              }
            }
          }
        }

        await Api.saveMyIdeaMap(realId, { nodes, edges, extensions, fromAI: true });
        setGraphNodes(nodes);
        setGraphEdges(edges);
        if (extensions?.processFlow && typeof extensions.processFlow === 'object' && Array.isArray((extensions.processFlow as any)?.lanes)) {
          setGraphLanes((extensions.processFlow as any).lanes);
        }
        window.dispatchEvent(
          new CustomEvent('idea-workspace-graph-update', { detail: { ideaId: realId, nodes, edges, extensions } })
        );
        setMapRefreshToken((v) => v + 1);
        toast.success(
          isPolish
            ? `Zaakceptowano ${accepted.length} propozycji`
            : `Accepted ${accepted.length} proposal${accepted.length > 1 ? 's' : ''}`
        );
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się zastosować zmian' : 'Failed to apply changes'));
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
      const accepted = updated.proposals.filter((p) => p.id === proposalId && p.status === 'accepted');
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
  const handleQuickAction = useCallback(
    (action: string) => {
      trackFunnelEvent('ideas_quick_tool_used', { tool: activeTool, action });
      externalOnQuickAction?.(action);
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', { detail: { action, ideaId: realId } })
      );
    },
    [activeTool, externalOnQuickAction, realId]
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
  const isAccepted = useMemo(() => {
    const s = String(stage || '').toLowerCase();
    return !(s === '' || s === 'seed' || s === 'spark');
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
          title: isPolish ? 'Nowe wyzwanie' : 'New challenge',
          body: '',
          tags: [],
          sourceType: 'manual',
        });
        const nextId = String(created?.id || ideaId);
        setRealId(nextId);
        setTitle(String(created?.title || (isPolish ? 'Nowe wyzwanie' : 'New challenge')));
        setSeedText(String(created?.seed_text || created?.seedText || created?.body || ''));
        setStage(String(created?.stage || 'seed'));
        setBranch(String(created?.branch || ''));
        setArea(String(created?.area || ''));
        setPriority(Number.isFinite(Number(created?.priority)) ? Number(created.priority) : 50);
        onSaved(created as MyIdea);
        setDirty(true);

        try {
          const res = await Api.getMyIdeaMap(nextId, { language: i18n.language });
          const map = res?.map || {};
          const nodes = Array.isArray(map.nodes) ? map.nodes : [];
          const edges = Array.isArray(map.edges) ? map.edges : [];
          await Api.saveMyIdeaMap(nextId, { nodes, edges });
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
          const mapRes = await Api.getMyIdeaMap(String(idea?.id || ideaId), { language: i18n.language });
          const savedPref = mapRes?.map?.preferredTool ? String(mapRes.map.preferredTool) : null;
          if (
            !initialTool &&
            savedPref &&
            ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(savedPref) &&
            !userSelectedToolRef.current
          ) {
            setActiveTool(savedPref as CanvasToolType);
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
  }, [i18n.language, ideaId, initialTool, isNewInitial, isPolish, onSaved]);

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

  const handleSearchHighlight = useCallback((nodeId: string) => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-highlight-node', { detail: { nodeId, ideaId: realId } })
    );
  }, [realId]);

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
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [realId, mapRefreshToken, i18n.language, loading]);

  // ── Chat ────────────────────────────────────────────────────────────────────
  const openChat = useCallback((prefillText?: string) => {
    setChatKickoffMessage(
      prefillText || buildAskAIMessage({
        type: 'idea',
        title: title || seedText?.slice(0, 80) || (isPolish ? 'Wyzwanie' : 'Challenge'),
        description: seedText || undefined,
      })
    );
    if (isChatCollapsed) toggleChatCollapse();
  }, [isChatCollapsed, isPolish, seedText, setChatKickoffMessage, title, toggleChatCollapse]);

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
        stage: 'incubating',
      });
      setTitle(String((updated as any)?.title || nextTitle));
      setStage(String((updated as any)?.stage || 'incubating'));
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

  // ── Convert ─────────────────────────────────────────────────────────────────
  const handleConvert = useCallback(
    async (target: 'initiative' | 'task_set' | 'decision' | 'team_chat') => {
      if (isDraft) return;
      setSaving(true);
      try {
        trackFunnelEvent('mywork_convert_clicked', { from: 'idea', to: target });
        const result = await Api.convertMyIdea(realId, {
          target,
          options: { language: i18n.language },
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
        toast.success(isPolish ? 'Gotowe' : 'Done');
      } catch (err: any) {
        toast.error(err?.message || (isPolish ? 'Nie udało się' : 'Failed'));
      } finally {
        setSaving(false);
      }
    },
    [i18n.language, isDraft, isPolish, realId]
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
    });
    setNodeDetailOpen(true);
  }, []);

  const handleNodeDataChange = useCallback(async (nodeId: string, patch: Partial<ExtendedNodeData>) => {
    setNodeDetailData((prev) => ({ ...prev, ...patch }));
    try {
      const mapRes = await Api.getMyIdeaMap(realId, { language: i18n.language });
      const map = mapRes?.map || {};
      const nodes: any[] = Array.isArray(map.nodes) ? [...map.nodes] : [];
      const edges: any[] = Array.isArray(map.edges) ? [...map.edges] : [];
      const updatedNodes = nodes.map((n: any) =>
        String(n?.id) === nodeId ? { ...n, data: { ...(n.data || {}), ...patch } } : n
      );
      await Api.saveMyIdeaMap(realId, { nodes: updatedNodes, edges, extensions: map.extensions || {} });
      setGraphNodes(updatedNodes);
      setMapRefreshToken((v) => v + 1);
    } catch { /* best-effort save */ }
  }, [i18n.language, realId]);

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
                    items: [{ text: card.text, position: card.position, branchKey: card.branchKey }],
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
          onExport={() => {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-export', { detail: { ideaId: realId, tool: activeTool } })
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
              onConvert={(target) => handleConvert(target === 'task' ? 'task_set' : target as any)}
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
              drillFocusNodeId={drillDownStack.length > 0 ? drillDownStack[drillDownStack.length - 1].nodeId : null}
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
          window.dispatchEvent(new CustomEvent('idea-workspace-drill-down', { detail: { nodeId: nid, ideaId: realId } }));
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
      />

      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  );
};

export default IdeaMapWorkspace;
