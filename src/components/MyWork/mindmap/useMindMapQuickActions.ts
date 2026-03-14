/**
 * useMindMapQuickActions — Extracted quick action handler for the Mind Map.
 *
 * Listens to `idea-workspace-quick-action` events and dispatches 40+ mm_* actions.
 * Conversion actions (convert_initiative, convert_decision, convert_task_set) are
 * owned by the workspace-level handler in IdeaMapWorkspace.
 */
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Edge, Node } from 'reactflow';

import type { MindMapInteractionMode } from '../ideaSelectionTypes';
import { applyForceLayout } from './ForceDirectedLayout';
import { applyRadialLayout } from './RadialTreeLayout';

export interface MindMapQuickActionHandlers {
  addChildNode: (nodeId?: string) => void;
  addSiblingNode: (nodeId?: string) => void;
  addRootTopic: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  getSelectedNode: () => Node | undefined;
  toggleCollapse: (nodeId: string) => void;
  focusSelectedNode: () => void;
  reparentSelectedPromote: () => void;
  reparentSelectedDemote: () => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  handleAIExpand: () => void;
  autoLayout: (n: Node[], e: Edge[]) => Node[];
  fitView: (opts?: any) => void;
  exportAsSVG: (filename: string) => void;
  exportAsPNG: (filename: string) => void;
  exportAsJSON: (n: Node[], e: Edge[], ext: any, filename: string) => void;
  exportAsCSV?: (n: Node[], filename: string) => void;
  onOpenChat?: (prompt?: string) => void;
}

export interface MindMapQuickActionSetters {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setLayoutMode: React.Dispatch<React.SetStateAction<any>>;
  setShowClusterBubbles: React.Dispatch<React.SetStateAction<boolean>>;
  setHeatmapMode: React.Dispatch<React.SetStateAction<boolean>>;
  setParticleFlow: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWhatIf: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBatchConvert: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPresentation: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSnapshots: React.Dispatch<React.SetStateAction<boolean>>;
  setShowVoiceToNode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDocToMap: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInterviewToMap: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDependencyDetector: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPriorityRecommender: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAutoClustering: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSentimentOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setShowActivityFeed: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHealthScore: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFunnelAnalytics: React.Dispatch<React.SetStateAction<boolean>>;
  setShowExportPPTX: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEmbedInReports: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCompetitiveLandscape: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBranchComparison: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTimeHeatmap: React.Dispatch<React.SetStateAction<boolean>>;
  setShowExportDiagramCode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportExternalMap: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMindMap3D: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWebhookSettings: React.Dispatch<React.SetStateAction<boolean>>;
  setCommentNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setExportMenuOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowMiniMap?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCollaboration?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBackgroundSettings?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowGovernancePanel?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTimerPanel?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCrossToolPanel?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowKanbanView?: React.Dispatch<React.SetStateAction<boolean>>;
  setInteractionMode?: (mode: MindMapInteractionMode) => void;
}

export interface UseMindMapQuickActionsOpts {
  ideaId: string;
  ideaTitle: string;
  isPolish: boolean;
  locked: boolean;
  nodes: Node[];
  edges: Edge[];
  layoutMode: string;
  extensions?: Record<string, unknown>;
  handlers: MindMapQuickActionHandlers;
  setters: MindMapQuickActionSetters;
}

export function useMindMapQuickActions(opts: UseMindMapQuickActionsOpts): void {
  const {
    ideaId,
    ideaTitle,
    isPolish,
    locked,
    nodes,
    edges,
    layoutMode,
    extensions,
    handlers,
    setters,
  } = opts;

  const quickActionRef = useRef<(action: string, detail?: Record<string, unknown>) => void>(() => {});

  quickActionRef.current = (action: string, detail?: Record<string, unknown>) => {
    const targetNodeId = typeof detail?.nodeId === 'string' ? detail.nodeId : undefined;
    if (action === 'mm_add_child') handlers.addChildNode(targetNodeId);
    if (action === 'mm_add_sibling') handlers.addSiblingNode(targetNodeId);
    if (action === 'mm_add_root') {
      handlers.addRootTopic();
      return;
    }
    if (action === 'mm_duplicate') handlers.duplicateSelected();
    if (action === 'mm_toggle_collapse') {
      const sel = handlers.getSelectedNode();
      if (sel) handlers.toggleCollapse(sel.id);
    }
    if (action === 'mm_focus_selected') handlers.focusSelectedNode();
    if (action === 'mm_reparent_promote') handlers.reparentSelectedPromote();
    if (action === 'mm_reparent_demote') handlers.reparentSelectedDemote();
    if (action === 'mm_delete') handlers.deleteSelected();
    if (action === 'mm_undo') handlers.undo();
    if (action === 'mm_redo') handlers.redo();

    if (action === 'mm_add_knowledge' || action === 'mm_add_note' || action === 'mm_add_evidence') {
      if (locked) return;
      handlers.pushUndo();
      const typeMap: Record<string, string> = {
        mm_add_knowledge: 'knowledgeCard',
        mm_add_note: 'noteCard',
        mm_add_evidence: 'evidenceCard',
      };
      const labelMap: Record<string, string> = {
        mm_add_knowledge: isPolish ? 'Wiedza' : 'Knowledge',
        mm_add_note: isPolish ? 'Notatka' : 'Note',
        mm_add_evidence: isPolish ? 'Dowód' : 'Evidence',
      };
      const newId = `${typeMap[action]}-${Date.now()}`;
      const sel = handlers.getSelectedNode();
      const baseX = sel ? sel.position.x + 200 : 300;
      const baseY = sel ? sel.position.y : 200;
      setters.setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: typeMap[action],
          position: { x: baseX, y: baseY },
          data: {
            label: labelMap[action],
            kind: typeMap[action],
            system: 'knowledge',
            onLabelChange: (next: string) => {
              setters.setNodes((nds) =>
                nds.map((n) => (n.id === newId ? { ...n, data: { ...n.data, label: next } } : n))
              );
            },
          },
        },
      ]);
      if (sel) {
        setters.setEdges((prev) => [
          ...prev,
          {
            id: `e-${sel.id}-${newId}`,
            source: sel.id,
            target: newId,
            type: 'labeled',
            data: {},
          },
        ]);
      }
    }

    if (action === 'mm_auto_layout') {
      handlers.pushUndo();
      const laid = handlers.autoLayout(nodes, edges);
      setters.setNodes(laid);
      setTimeout(() => {
        try {
          handlers.fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 50);
    }

    if (action === 'mm_ai_expand_branch') handlers.handleAIExpand();
    if (action === 'mm_toggle_bubbles') setters.setShowClusterBubbles((p) => !p);
    if (action === 'mm_toggle_heatmap') setters.setHeatmapMode((p) => !p);
    if (action === 'mm_toggle_particles') setters.setParticleFlow((p) => !p);
    if (action === 'mm_what_if') setters.setShowWhatIf(true);
    if (action === 'mm_batch_convert') setters.setShowBatchConvert(true);
    if (action === 'mm_timeline') setters.setShowTimeline(true);
    if (action === 'mm_presentation') setters.setShowPresentation(true);
    if (action === 'mm_snapshots') setters.setShowSnapshots(true);
    if (action === 'mm_voice') setters.setShowVoiceToNode(true);
    if (action === 'mm_doc_to_map') setters.setShowDocToMap(true);
    if (action === 'mm_interview_to_map') setters.setShowInterviewToMap(true);
    if (action === 'mm_dependency_detect') setters.setShowDependencyDetector(true);
    if (action === 'mm_priority_recommender') setters.setShowPriorityRecommender(true);
    if (action === 'mm_auto_clustering') setters.setShowAutoClustering(true);
    if (action === 'mm_sentiment_analysis') setters.setShowSentimentOverlay(true);
    if (action === 'mm_activity_feed') setters.setShowActivityFeed(true);
    if (action === 'mm_toggle_health') setters.setShowHealthScore((p) => !p);
    if (action === 'mm_funnel_analytics') setters.setShowFunnelAnalytics(true);

    if (action === 'mm_radial_layout') {
      handlers.pushUndo();
      const newMode = layoutMode === 'radial' ? 'tree' : 'radial';
      setters.setLayoutMode(newMode);
      const laid =
        newMode === 'radial' ? applyRadialLayout(nodes, edges) : handlers.autoLayout(nodes, edges);
      setters.setNodes(laid);
      setTimeout(() => {
        try {
          handlers.fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 50);
    }

    if (action === 'mm_comments') {
      const sel = handlers.getSelectedNode();
      if (sel && sel.type === 'idea') setters.setCommentNodeId(sel.id);
    }
    if (action === 'mm_export_pptx') setters.setShowExportPPTX(true);
    if (action === 'mm_embed_report') setters.setShowEmbedInReports(true);
    if (action === 'mm_competitive_landscape') setters.setShowCompetitiveLandscape(true);
    if (action === 'mm_branch_comparison') setters.setShowBranchComparison(true);
    if (action === 'mm_time_heatmap') setters.setShowTimeHeatmap(true);
    if (action === 'mm_export_diagram') setters.setShowExportDiagramCode(true);

    if (action === 'mm_force_layout') {
      handlers.pushUndo();
      const newMode = layoutMode === 'force' ? 'tree' : 'force';
      setters.setLayoutMode(newMode);
      const laid =
        newMode === 'force' ? applyForceLayout(nodes, edges) : handlers.autoLayout(nodes, edges);
      setters.setNodes(laid);
      setTimeout(() => {
        try {
          handlers.fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 50);
    }

    if (action === 'mm_import_external') setters.setShowImportExternalMap(true);
    if (action === 'mm_3d_view') setters.setShowMindMap3D(true);
    if (action === 'mm_webhooks') setters.setShowWebhookSettings(true);

    if (action === 'mm_export') {
      if (setters.setExportMenuOpen) {
        setters.setExportMenuOpen(true);
      } else {
        handlers.exportAsPNG(`${ideaTitle || 'mindmap'}.png`);
      }
    }
    if (action === 'mm_export_png') handlers.exportAsPNG(`${ideaTitle || 'mindmap'}.png`);
    if (action === 'mm_export_svg') handlers.exportAsSVG(`${ideaTitle || 'mindmap'}.svg`);
    if (action === 'mm_export_json')
      handlers.exportAsJSON(nodes, edges, extensions, `${ideaTitle || 'mindmap'}.json`);
    if (action === 'mm_export_csv') {
      if (handlers.exportAsCSV) {
        handlers.exportAsCSV(nodes, `${ideaTitle || 'mindmap'}.csv`);
      } else {
        const header = 'id,label,type,parent';
        const parentMap = new Map<string, string>();
        edges.forEach((e) => parentMap.set(e.target, e.source));
        const rows = nodes.map((n) => {
          const label = String(n.data?.label || '').replace(/"/g, '""');
          return `"${n.id}","${label}","${n.type || 'default'}","${parentMap.get(n.id) || ''}"`;
        });
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ideaTitle || 'mindmap'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(isPolish ? 'CSV wyeksportowany' : 'CSV exported');
      }
    }

    // ── AddNodePopover: Semantic node inserts ──────────────────────────────
    const SEMANTIC_INSERT_MAP: Record<string, { kind: string; labelPl: string; labelEn: string }> = {
      mm_add_root: { kind: 'topic', labelPl: 'Nowy temat', labelEn: 'New topic' },
      mm_insert_topic: { kind: 'topic', labelPl: 'Temat', labelEn: 'Topic' },
      mm_insert_hypothesis: { kind: 'hypothesis', labelPl: 'Hipoteza', labelEn: 'Hypothesis' },
      mm_insert_risk: { kind: 'risk', labelPl: 'Ryzyko', labelEn: 'Risk' },
      mm_insert_action: { kind: 'action_item', labelPl: 'Akcja', labelEn: 'Action' },
      mm_insert_decision: { kind: 'decision_point', labelPl: 'Punkt decyzyjny', labelEn: 'Decision point' },
      mm_insert_option: { kind: 'option', labelPl: 'Opcja', labelEn: 'Option' },
    };
    if (SEMANTIC_INSERT_MAP[action]) {
      if (locked) return;
      handlers.pushUndo();
      const spec = SEMANTIC_INSERT_MAP[action];
      const newId = `${spec.kind}-${Date.now()}`;
      const sel = handlers.getSelectedNode();
      const isRoot = false;
      const baseX = isRoot ? Math.random() * 400 + 100 : (sel ? sel.position.x + 220 : 300);
      const baseY = isRoot ? Math.random() * 300 + 100 : (sel ? sel.position.y + 20 : 200);
      setters.setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: 'idea',
          position: { x: baseX, y: baseY },
          data: {
            label: isPolish ? spec.labelPl : spec.labelEn,
            semanticType: spec.kind,
            _startEditing: true,
            onLabelChange: (next: string) => {
              setters.setNodes((nds) =>
                nds.map((n) => (n.id === newId ? { ...n, data: { ...n.data, label: next } } : n))
              );
            },
          },
        },
      ]);
      if (sel && !isRoot) {
        setters.setEdges((prev) => [
          ...prev,
          { id: `e-${sel.id}-${newId}`, source: sel.id, target: newId, type: 'gradient', data: {} },
        ]);
      }
    }

    // ── CanvasLeftToolbar direct slots ─────────────────────────────────────
    if (action === 'mm_select_mode') setters.setInteractionMode?.('select');
    if (action === 'mm_pan_mode') setters.setInteractionMode?.('pan');
    if (action === 'mm_connect_mode') {
      setters.setInteractionMode?.('connect');
    }
    if (action === 'mm_add_frame') {
      if (locked) return;
      handlers.pushUndo();
      const frameId = `frame-${Date.now()}`;
      const sel = handlers.getSelectedNode();
      setters.setNodes((prev) => [
        ...prev,
        {
          id: frameId,
          type: 'group',
          position: { x: sel ? sel.position.x - 40 : 200, y: sel ? sel.position.y - 40 : 100 },
          data: { label: isPolish ? 'Ramka' : 'Frame' },
          style: { width: 300, height: 200, border: '2px dashed #94a3b8', borderRadius: 16, background: 'rgba(148,163,184,0.04)' },
        },
      ]);
    }

    // ── AI Actions ─────────────────────────────────────────────────────────
    if (action === 'mm_ai_expand') handlers.handleAIExpand();
    if (action === 'mm_ai_expand_node') handlers.handleAIExpand();
    if (action === 'mm_ai_suggest') {
      if (handlers.onOpenChat) {
        const prompt = isPolish
          ? `Zasugeruj nowe gałęzie dla mapy "${ideaTitle}". Podaj 5-7 propozycji z uzasadnieniem.`
          : `Suggest new branches for the map "${ideaTitle}". Provide 5-7 proposals with reasoning.`;
        handlers.onOpenChat(prompt);
      } else {
        handlers.handleAIExpand();
      }
    }
    if (action === 'mm_ai_gap_analysis') {
      if (handlers.onOpenChat) {
        const nodeLabels = nodes.slice(0, 20).map((n) => n.data?.label).filter(Boolean).join(', ');
        const prompt = isPolish
          ? `Przeanalizuj luki w mapie "${ideaTitle}". Obecne węzły: ${nodeLabels}. Czego brakuje?`
          : `Analyze gaps in the map "${ideaTitle}". Current nodes: ${nodeLabels}. What's missing?`;
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_cluster') setters.setShowAutoClustering(true);
    if (action === 'mm_ai_summarize') {
      if (handlers.onOpenChat) {
        const nodeLabels = nodes.slice(0, 30).map((n) => n.data?.label).filter(Boolean).join(', ');
        const prompt = isPolish
          ? `Podsumuj mapę "${ideaTitle}" z ${nodes.length} węzłami: ${nodeLabels}`
          : `Summarize the map "${ideaTitle}" with ${nodes.length} nodes: ${nodeLabels}`;
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_auto_connect') {
      if (handlers.onOpenChat) {
        const prompt = isPolish
          ? `Zaproponuj połączenia między gałęziami w mapie "${ideaTitle}". Jakie cross-linki powinny istnieć?`
          : `Suggest cross-links between branches in the map "${ideaTitle}". What connections should exist?`;
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_deepen') {
      const sel = handlers.getSelectedNode();
      if (sel && handlers.onOpenChat) {
        const tags = Array.isArray(sel.data?.tags) ? sel.data.tags.join(', ') : '';
        const sType = sel.data?.semanticType || '';
        const ctx = [tags ? `Tags: ${tags}` : '', sType ? `Type: ${sType}` : ''].filter(Boolean).join('. ');
        const prompt = isPolish
          ? `Pogłęb temat "${sel.data?.label}" w kontekście mapy "${ideaTitle}".${ctx ? ` Kontekst: ${ctx}.` : ''} Podaj szczegółową analizę.`
          : `Deepen the topic "${sel.data?.label}" in the context of map "${ideaTitle}".${ctx ? ` Context: ${ctx}.` : ''} Provide detailed analysis.`;
        handlers.onOpenChat(prompt);
      } else {
        handlers.handleAIExpand();
      }
    }
    if (action === 'mm_ai_summarize_branch') {
      const sel = handlers.getSelectedNode();
      if (sel && handlers.onOpenChat) {
        const tags = Array.isArray(sel.data?.tags) ? sel.data.tags.join(', ') : '';
        const sType = sel.data?.semanticType || '';
        const ctx = [tags ? `Tags: ${tags}` : '', sType ? `Type: ${sType}` : ''].filter(Boolean).join('. ');
        const prompt = isPolish
          ? `Podsumuj gałąź "${sel.data?.label}" i jej podwęzły w mapie "${ideaTitle}".${ctx ? ` Kontekst: ${ctx}.` : ''}`
          : `Summarize the branch "${sel.data?.label}" and its sub-nodes in map "${ideaTitle}".${ctx ? ` Context: ${ctx}.` : ''}`;
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_chat_about_node') {
      const nodeId = detail?.nodeId as string | undefined;
      const node = nodeId ? nodes.find((n: any) => n.id === nodeId) : handlers.getSelectedNode();
      if (node && handlers.onOpenChat) {
        const label = node.data?.label || nodeId;
        const tags = Array.isArray(node.data?.tags) ? node.data.tags.join(', ') : '';
        const sType = node.data?.semanticType || '';
        const ctx = [
          tags ? `Tags: ${tags}` : '',
          sType ? `Type: ${sType}` : '',
          node.data?.description ? `Description: ${node.data.description}` : '',
        ].filter(Boolean).join('. ');
        const prompt = isPolish
          ? `Porozmawiajmy o węźle "${label}" w mapie "${ideaTitle}".${ctx ? ` Kontekst: ${ctx}` : ''}`
          : `Let's discuss the node "${label}" in map "${ideaTitle}".${ctx ? ` Context: ${ctx}` : ''}`;
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_what_if') setters.setShowWhatIf(true);

    // ── KnowledgePopover: Platform inserts ────────────────────────────────
    if (action === 'mm_insert_from_notebook') {
      window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'open_linked_artifacts', ideaId },
      }));
      toast(isPolish ? 'Otwórz panel Context → Notebook' : 'Open Context panel → Notebook', { icon: '📓', duration: 2500 });
    }
    if (action === 'mm_insert_from_interview') {
      setters.setShowInterviewToMap(true);
    }

    // ── ImportExportPopover: Import actions ────────────────────────────────
    if (action === 'mm_import_device') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.xmind,.mm,.txt,.csv';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const text = ev.target?.result as string;
            const data = JSON.parse(text);
            if (Array.isArray(data.nodes)) {
              handlers.pushUndo();
              setters.setNodes((prev) => [...prev, ...data.nodes]);
              if (Array.isArray(data.edges)) {
                setters.setEdges((prev) => [...prev, ...data.edges]);
              }
              toast.success(isPolish ? `Zaimportowano ${data.nodes.length} węzłów` : `Imported ${data.nodes.length} nodes`);
            } else {
              toast.error(isPolish ? 'Nieobsługiwany format' : 'Unsupported format');
            }
          } catch {
            toast.error(isPolish ? 'Błąd parsowania pliku' : 'File parse error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
    if (action === 'mm_import_url') {
      const url = window.prompt(isPolish ? 'Podaj URL do importu:' : 'Enter URL to import:');
      if (url?.trim()) {
        toast(isPolish ? 'Import z URL w toku…' : 'Importing from URL…', { icon: '🌐', duration: 2000 });
        setters.setShowDocToMap(true);
      }
    }

    // ── MoreToolsPanel actions ─────────────────────────────────────────────
    if (action === 'mm_change_layout') {
      handlers.pushUndo();
      const modes = ['tree', 'radial', 'force'];
      const curIdx = modes.indexOf(layoutMode);
      const nextMode = modes[(curIdx + 1) % modes.length];
      setters.setLayoutMode(nextMode);
      const laid = nextMode === 'radial'
        ? applyRadialLayout(nodes, edges)
        : nextMode === 'force'
          ? applyForceLayout(nodes, edges)
          : handlers.autoLayout(nodes, edges);
      setters.setNodes(laid);
      setTimeout(() => { try { handlers.fitView({ padding: 0.3, duration: 400 }); } catch { /* */ } }, 50);
      toast.success(isPolish ? `Układ: ${nextMode}` : `Layout: ${nextMode}`, { duration: 1200 });
    }
    if (action === 'mm_toggle_minimap') {
      if (setters.setShowMiniMap) setters.setShowMiniMap((p) => !p);
    }
    if (action === 'mm_fit_view') {
      handlers.fitView({ padding: 0.3, duration: 400 });
    }
    if (action === 'mm_background') {
      if (setters.setShowBackgroundSettings) {
        setters.setShowBackgroundSettings(true);
      }
    }
    if (action === 'mm_activity') setters.setShowActivityFeed(true);
    if (action === 'mm_governance') {
      if (setters.setShowGovernancePanel) {
        setters.setShowGovernancePanel(true);
      }
    }
    if (action === 'mm_timers') {
      if (setters.setShowTimerPanel) {
        setters.setShowTimerPanel(true);
      }
    }
    if (action === 'mm_cross_tool') {
      if (setters.setShowCrossToolPanel) {
        setters.setShowCrossToolPanel(true);
      }
    }
    if (action === 'mm_share') {
      const url = `${window.location.origin}${window.location.pathname}?ideaId=${ideaId}`;
      navigator.clipboard?.writeText(url).then(() => {
        toast.success(isPolish ? 'Link skopiowany!' : 'Link copied!');
      }).catch(() => {
        toast(isPolish ? 'Nie udało się skopiować' : 'Copy failed', { icon: '⚠️' });
      });
    }
    if (action === 'mm_collaboration') {
      if (setters.setShowCollaboration) {
        setters.setShowCollaboration(true);
      }
    }
    if (action === 'mm_embed') {
      const embedUrl = `${window.location.origin}/embed/idea/${ideaId}`;
      const embedCode = `<iframe src="${embedUrl}" width="800" height="600" frameborder="0"></iframe>`;
      navigator.clipboard?.writeText(embedCode).then(() => {
        toast.success(isPolish ? 'Kod embed skopiowany!' : 'Embed code copied!');
      }).catch(() => {
        toast(isPolish ? 'Nie udało się skopiować' : 'Copy failed', { icon: '⚠️' });
      });
    }
    if (action === 'mm_branch_analysis') setters.setShowBranchComparison(true);
    if (action === 'mm_kanban_view') {
      if (setters.setShowKanbanView) {
        setters.setShowKanbanView(true);
      }
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;
      console.log(`%c[MM QuickAction] ${detail.action}`, 'color: #f59e0b; font-weight: bold');
      try {
        quickActionRef.current(detail.action, detail);
      } catch (err: any) {
        console.error(`[MM QuickAction] ERROR in "${detail.action}":`, err);
      }
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, []);
}
