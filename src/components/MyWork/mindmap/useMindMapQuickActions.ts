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

import i18n from '@/i18n';
import { Api } from '@/services/api';

import type { MapStructureType, MindMapInteractionMode } from '../ideaSelectionTypes';
import { applyForceLayout } from './ForceDirectedLayout';
import { applyRadialLayout } from './RadialTreeLayout';
import { applyStructureLayout } from './StructureLayouts';

export interface MindMapQuickActionHandlers {
  addChildNode: (nodeId?: string) => void;
  addSiblingNode: (nodeId?: string) => void;
  addRootTopic: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  getSelectedNode: () => Node | undefined;
  toggleCollapse: (nodeId: string) => void;
  setFoldLevel?: (maxLevel: number) => void;
  focusSelectedNode: () => void;
  reparentSelectedPromote: () => void;
  reparentSelectedDemote: () => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  handleAIExpand: (targetNodeId?: string) => void;
  autoLayout: (n: Node[], e: Edge[]) => Node[];
  fitView: (opts?: any) => void;
  exportAsSVG: (filename: string) => void;
  exportAsPNG: (filename: string) => void;
  exportAsJSON: (n: Node[], e: Edge[], ext: any, filename: string) => void;
  exportAsCSV?: (n: Node[], filename: string) => void;
  exportAsMarkdown?: (
    n: Node[],
    e: Edge[],
    opts?: { includeMetadata?: boolean },
    filename?: string
  ) => string;
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
  setStructureType?: React.Dispatch<React.SetStateAction<MapStructureType>>;
  setShowStructurePicker?: React.Dispatch<React.SetStateAction<boolean>>;
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
  structureType?: MapStructureType;
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
    structureType = 'mindmap',
    extensions,
    handlers,
    setters,
  } = opts;

  const quickActionRef = useRef<(action: string, detail?: Record<string, unknown>) => void>(
    () => {}
  );

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
    if (
      action === 'mm_fold_0' ||
      action === 'mm_fold_1' ||
      action === 'mm_fold_2' ||
      action === 'mm_fold_3'
    ) {
      const level = Number(action.split('_').pop());
      handlers.setFoldLevel?.(level);
      toast.success(i18n.t('mindmap.quickActions.viewLevel', { level }), {
        duration: 1200,
      });
    }
    if (action === 'mm_expand_all') {
      handlers.setFoldLevel?.(Infinity);
      toast.success(i18n.t('mindmap.quickActions.allExpanded'), { duration: 1200 });
    }
    if (action === 'mm_focus_selected') handlers.focusSelectedNode();
    if (action === 'mm_reparent_promote') handlers.reparentSelectedPromote();
    if (action === 'mm_reparent_demote') handlers.reparentSelectedDemote();
    if (action === 'mm_delete') handlers.deleteSelected();
    if (action === 'mm_undo') handlers.undo();
    if (action === 'mm_redo') handlers.redo();

    if (action === 'mm_add_knowledge' || action === 'mm_add_note' || action === 'mm_add_evidence') {
      if (locked) return;
      const sel = handlers.getSelectedNode();
      if (!sel) {
        toast(i18n.t('mindmap.quickActions.selectNodeToAttach'), {
          icon: 'ℹ️',
        });
        return;
      }
      handlers.pushUndo();
      const typeMap: Record<string, string> = {
        mm_add_knowledge: 'knowledgeCard',
        mm_add_note: 'noteCard',
        mm_add_evidence: 'evidenceCard',
      };
      const labelMap: Record<string, string> = {
        mm_add_knowledge: i18n.t('mindmap.quickActions.labelKnowledge'),
        mm_add_note: i18n.t('mindmap.quickActions.labelNote'),
        mm_add_evidence: i18n.t('mindmap.quickActions.labelEvidence'),
      };
      const newId = `${typeMap[action]}-${Date.now()}`;
      setters.setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: typeMap[action],
          position: { x: sel.position.x + 200, y: sel.position.y },
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
    if (action === 'mm_snapshot_history') setters.setShowSnapshots((prev: boolean) => !prev);
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
    if (action === 'mm_export') {
      if (setters.setExportMenuOpen) {
        setters.setExportMenuOpen(true);
      } else {
        try {
          handlers.exportAsPNG(`${ideaTitle || 'mindmap'}.png`);
        } catch {
          toast.error(i18n.t('mindmap.quickActions.exportFailedPng'));
        }
      }
    }
    if (action === 'mm_export_png') {
      try {
        handlers.exportAsPNG(`${ideaTitle || 'mindmap'}.png`);
      } catch {
        toast.error(i18n.t('mindmap.quickActions.exportFailedPng'));
      }
    }
    if (action === 'mm_export_svg') {
      try {
        handlers.exportAsSVG(`${ideaTitle || 'mindmap'}.svg`);
      } catch {
        toast.error(i18n.t('mindmap.quickActions.exportFailedSvg'));
      }
    }
    if (action === 'mm_export_json') {
      try {
        handlers.exportAsJSON(nodes, edges, extensions, `${ideaTitle || 'mindmap'}.json`);
      } catch {
        toast.error(i18n.t('mindmap.quickActions.exportFailedJson'));
      }
    }
    if (action === 'mm_export_csv') {
      try {
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
          toast.success(i18n.t('mindmap.quickActions.csvExported'));
        }
      } catch {
        toast.error(i18n.t('mindmap.quickActions.exportFailedCsv'));
      }
    }

    if (action === 'mm_export_markdown') {
      try {
        if (handlers.exportAsMarkdown) {
          handlers.exportAsMarkdown(
            nodes,
            edges,
            { includeMetadata: true },
            `${ideaTitle || 'mindmap'}.md`
          );
          toast.success(i18n.t('mindmap.quickActions.markdownCopied'));
        }
      } catch {
        toast.error(i18n.t('mindmap.quickActions.exportFailedMarkdown'));
      }
    }

    if (action === 'mm_export_pdf') {
      window.dispatchEvent(
        new CustomEvent('idea-mindmap-export-pdf', { detail: { title: ideaTitle } })
      );
      return;
    }

    // ── AddNodePopover: Semantic node inserts ──────────────────────────────
    const SEMANTIC_INSERT_MAP: Record<string, { kind: string; labelPl: string; labelEn: string }> =
      {
        mm_insert_topic: { kind: 'topic', labelPl: 'Temat', labelEn: 'Topic' },
        mm_insert_hypothesis: { kind: 'hypothesis', labelPl: 'Hipoteza', labelEn: 'Hypothesis' },
        mm_insert_risk: { kind: 'risk', labelPl: 'Ryzyko', labelEn: 'Risk' },
        mm_insert_action: { kind: 'action_item', labelPl: 'Akcja', labelEn: 'Action' },
        mm_insert_decision: {
          kind: 'decision_point',
          labelPl: 'Punkt decyzyjny',
          labelEn: 'Decision point',
        },
        mm_insert_option: { kind: 'option', labelPl: 'Opcja', labelEn: 'Option' },
      };
    if (SEMANTIC_INSERT_MAP[action]) {
      if (locked) return;
      const sel = handlers.getSelectedNode();
      const parentId = sel?.id || 'root';
      const parentNode = sel || nodes.find((n) => n.id === 'root');
      if (!parentNode) {
        toast.error(i18n.t('mindmap.quickActions.mapRootMissing'));
        return;
      }
      handlers.pushUndo();
      const spec = SEMANTIC_INSERT_MAP[action];
      const newId = `${spec.kind}-${Date.now()}`;
      const baseX = parentNode.position.x + 220;
      const baseY = parentNode.position.y + 20;
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
      setters.setEdges((prev) => [
        ...prev,
        {
          id: `e-${parentId}-${newId}`,
          source: parentId,
          target: newId,
          type: 'gradient',
          data: { userCreated: true, edgeRole: 'structural' },
        },
      ]);
    }

    // ── Group selected nodes (Ctrl+G) ────────────────────────────────────
    if (action === 'group' || action === 'mm_group') {
      if (locked) return;
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
      if (selectedIds.length < 2) {
        toast(i18n.t('mindmap.quickActions.selectAtLeast2Nodes'), { icon: 'ℹ️' });
        return;
      }
      handlers.pushUndo();
      const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
      const minX = Math.min(...selectedNodes.map((n) => n.position.x));
      const minY = Math.min(...selectedNodes.map((n) => n.position.y));
      const maxX = Math.max(...selectedNodes.map((n) => n.position.x + (n.width || 160)));
      const maxY = Math.max(...selectedNodes.map((n) => n.position.y + (n.height || 60)));
      const pad = 40;
      const frameId = `frame-group-${Date.now()}`;
      setters.setNodes((prev) => [
        ...prev,
        {
          id: frameId,
          type: 'group',
          position: { x: minX - pad, y: minY - pad },
          data: { label: i18n.t('mindmap.quickActions.labelGroup') },
          style: {
            width: maxX - minX + pad * 2,
            height: maxY - minY + pad * 2,
            border: '2px dashed var(--c-tag-8)',
            borderRadius: 16,
            background: 'rgba(148,163,184,0.04)',
          },
        } as Node,
      ]);
      toast.success(i18n.t('mindmap.quickActions.groupedCount', { count: selectedIds.length }));
      return;
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
          data: { label: i18n.t('mindmap.quickActions.labelFrame') },
          style: {
            width: 300,
            height: 200,
            border: '2px dashed var(--c-tag-8)',
            borderRadius: 16,
            background: 'rgba(148,163,184,0.04)',
          },
        },
      ]);
    }

    // ── AI Actions ─────────────────────────────────────────────────────────
    if (action === 'mm_ai_expand') handlers.handleAIExpand();
    if (action === 'mm_ai_expand_node')
      handlers.handleAIExpand(detail?.nodeId as string | undefined);
    if (action === 'mm_ai_suggest') {
      if (handlers.onOpenChat) {
        const prompt = i18n.t('mindmap.quickActions.promptSuggestBranches', { ideaTitle });
        handlers.onOpenChat(prompt);
      } else {
        handlers.handleAIExpand();
      }
    }
    if (action === 'mm_ai_gap_analysis') {
      if (handlers.onOpenChat) {
        const nodeLabels = nodes
          .slice(0, 20)
          .map((n) => n.data?.label)
          .filter(Boolean)
          .join(', ');
        const prompt = i18n.t('mindmap.quickActions.promptGapAnalysis', { ideaTitle, nodeLabels });
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_cluster') setters.setShowAutoClustering(true);

    if (action === 'mm_auto_cluster') {
      if (locked) return;
      const rootChildren = edges
        .filter((e) => e.source === 'root' && e.data?.edgeRole !== 'relation')
        .map((e) => e.target);

      const orphanIdeas = nodes.filter((n) => rootChildren.includes(n.id) && n.type === 'idea');

      if (orphanIdeas.length < 2) {
        toast(i18n.t('mindmap.quickActions.notEnoughUngroupedNodes'));
        return;
      }

      const clusters = new Map<string, Node[]>();
      for (const node of orphanIdeas) {
        const label = String(node.data?.label || '').toLowerCase();
        const tags: string[] = Array.isArray(node.data?.tags) ? node.data.tags : [];
        const semType: string = node.data?.semanticType || '';

        let clusterKey = 'uncategorized';
        if (
          semType === 'risk' ||
          semType === 'threat' ||
          label.includes('risk') ||
          label.includes('ryzyko')
        ) {
          clusterKey = 'risks';
        } else if (
          semType === 'hypothesis' ||
          label.includes('hypothesis') ||
          label.includes('hipoteza')
        ) {
          clusterKey = 'hypotheses';
        } else if (
          semType === 'action' ||
          semType === 'task' ||
          label.includes('action') ||
          label.includes('zadanie')
        ) {
          clusterKey = 'actions';
        } else if (
          semType === 'evidence' ||
          label.includes('evidence') ||
          label.includes('dowód')
        ) {
          clusterKey = 'evidence';
        } else if (semType === 'question' || label.includes('?') || label.includes('question')) {
          clusterKey = 'questions';
        } else if (tags.length > 0) {
          clusterKey = tags[0];
        }

        if (!clusters.has(clusterKey)) clusters.set(clusterKey, []);
        clusters.get(clusterKey)!.push(node);
      }

      if (clusters.size < 2) {
        toast(i18n.t('mindmap.quickActions.allNodesFitOneGroup'));
        return;
      }

      handlers.pushUndo();

      const CLUSTER_LABELS: Record<string, { en: string; pl: string }> = {
        risks: { en: 'Risks', pl: 'Ryzyka' },
        hypotheses: { en: 'Hypotheses', pl: 'Hipotezy' },
        actions: { en: 'Actions', pl: 'Działania' },
        evidence: { en: 'Evidence', pl: 'Dowody' },
        questions: { en: 'Questions', pl: 'Pytania' },
        uncategorized: { en: 'Other', pl: 'Inne' },
      };

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const edgesToRemove = new Set<string>();
      let branchIndex = 0;

      for (const [key, clusterNodes] of clusters) {
        const angle = (branchIndex / clusters.size) * 2 * Math.PI - Math.PI / 2;
        const radius = 350;
        const bx = Math.cos(angle) * radius;
        const by = Math.sin(angle) * radius;

        const branchId = `branch-auto-${key}-${Date.now()}`;
        const branchLabel = CLUSTER_LABELS[key]?.[isPolish ? 'pl' : 'en'] || key;

        newNodes.push({
          id: branchId,
          type: 'branch',
          position: { x: bx, y: by },
          data: {
            label: branchLabel,
            branchKey: key,
            hint: i18n.t('mindmap.quickActions.autoClusteredHint'),
          },
        } as Node);

        newEdges.push({
          id: `edge-root-${branchId}`,
          source: 'root',
          target: branchId,
          type: 'gradient',
          animated: true,
          data: { edgeRole: 'structural' },
        } as Edge);

        for (const node of clusterNodes) {
          const oldEdge = edges.find((e) => e.target === node.id && e.source === 'root');
          if (oldEdge) edgesToRemove.add(oldEdge.id);

          newEdges.push({
            id: `edge-${branchId}-${node.id}`,
            source: branchId,
            target: node.id,
            type: 'gradient',
            animated: true,
            data: { edgeRole: 'structural' },
          } as Edge);
        }

        branchIndex++;
      }

      setters.setNodes((prev) => [...prev, ...newNodes]);
      setters.setEdges((prev) => [...prev.filter((e) => !edgesToRemove.has(e.id)), ...newEdges]);

      toast.success(
        i18n.t('mindmap.quickActions.createdClusters', {
          clusterCount: clusters.size,
          nodeCount: orphanIdeas.length,
        })
      );

      setTimeout(() => {
        try {
          handlers.fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 100);
      return;
    }
    if (action === 'mm_ai_summarize') {
      if (handlers.onOpenChat) {
        const nodeLabels = nodes
          .slice(0, 30)
          .map((n) => n.data?.label)
          .filter(Boolean)
          .join(', ');
        const prompt = i18n.t('mindmap.quickActions.promptSummarizeMap', {
          ideaTitle,
          nodeCount: nodes.length,
          nodeLabels,
        });
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_auto_connect') {
      if (handlers.onOpenChat) {
        const prompt = i18n.t('mindmap.quickActions.promptAutoConnect', { ideaTitle });
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_deepen') {
      const sel = handlers.getSelectedNode();
      if (sel && handlers.onOpenChat) {
        const tags = Array.isArray(sel.data?.tags) ? sel.data.tags.join(', ') : '';
        const sType = sel.data?.semanticType || '';
        const ctx = [tags ? `Tags: ${tags}` : '', sType ? `Type: ${sType}` : '']
          .filter(Boolean)
          .join('. ');
        const prompt = i18n.t('mindmap.quickActions.promptDeepen', {
          nodeLabel: sel.data?.label,
          ideaTitle,
          ctxSuffix: ctx ? i18n.t('mindmap.quickActions.promptDeepenCtxSuffix', { ctx }) : '',
        });
        handlers.onOpenChat(prompt);
      } else {
        handlers.handleAIExpand();
      }
    }
    if (action === 'mm_ai_summarize_branch') {
      const sel = handlers.getSelectedNode();
      if (!sel) {
        toast(i18n.t('mindmap.quickActions.selectBranchFirst'), { icon: 'ℹ️' });
        return;
      }
      window.dispatchEvent(
        new CustomEvent('idea-mindmap-summarize-branch', {
          detail: {
            ideaId,
            nodeId: sel.id,
            nodeLabel: sel.data?.label || '',
          },
        })
      );
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
        ]
          .filter(Boolean)
          .join('. ');
        const prompt = i18n.t('mindmap.quickActions.promptChatAboutNode', {
          nodeLabel: label,
          ideaTitle,
          ctxSuffix: ctx ? i18n.t('mindmap.quickActions.promptChatAboutNodeCtxSuffix', { ctx }) : '',
        });
        handlers.onOpenChat(prompt);
      }
    }
    if (action === 'mm_ai_what_if') setters.setShowWhatIf(true);

    if (action === 'ai_suggest_links' || action === 'mm_ai_suggest_links') {
      if (locked) return;
      const sel = handlers.getSelectedNode();
      if (!sel) {
        toast(i18n.t('mindmap.quickActions.selectNodeFirst'), { icon: 'ℹ️' });
        return;
      }
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', {
          detail: {
            action: 'mm_ai_suggest_links_execute',
            ideaId,
            nodeId: sel.id,
            nodeLabel: sel.data?.label || '',
            nodeTags: sel.data?.tags || [],
            nodeSemanticType: sel.data?.semanticType || '',
          },
        })
      );
      return;
    }

    // ── KnowledgePopover: Platform inserts ────────────────────────────────
    if (action === 'mm_insert_from_notebook') {
      (async () => {
        try {
          const pages = await Api.getNotebookPages({ limit: 10, sort: 'updated_at' });
          if (!Array.isArray(pages) || pages.length === 0) {
            toast(i18n.t('mindmap.quickActions.noNotebookPages'), { icon: '📓' });
            return;
          }
          const sel = handlers.getSelectedNode();
          const parentId = sel?.id || 'root';
          const parentNode = nodes.find((n) => n.id === parentId);
          const baseX = (parentNode?.position?.x ?? 0) + 250;
          const baseY = (parentNode?.position?.y ?? 0) - (pages.length - 1) * 40;

          const newNodes: Node[] = pages.slice(0, 8).map((page: any, i: number) => ({
            id: `kb-${Date.now()}-${i}`,
            type: 'idea',
            position: { x: baseX, y: baseY + i * 80 },
            data: {
              label: page.title || page.name || i18n.t('mindmap.quickActions.labelNoteFallback'),
              semanticType: 'knowledge',
              sourceType: 'notebook',
              sourceId: page.id,
              description: page.summary || page.preview || '',
              _isNew: true,
            },
          }));
          const newEdges = newNodes.map((n) => ({
            id: `e-${parentId}-${n.id}`,
            source: parentId,
            target: n.id,
            type: 'smoothstep',
          }));

          setters.setNodes((prev) => [...prev, ...newNodes]);
          setters.setEdges((prev) => [...prev, ...newEdges]);
          toast.success(
            i18n.t('mindmap.quickActions.insertedNotebookPages', { count: newNodes.length })
          );
        } catch {
          toast.error(i18n.t('mindmap.quickActions.failedToFetchNotebook'));
        }
      })();
    }
    if (action === 'mm_insert_from_interview') {
      setters.setShowInterviewToMap(true);
    }

    // ── ImportExportPopover: Import actions ────────────────────────────────
    if (action === 'mm_import_device') {
      const input = document.createElement('input');
      input.type = 'file';
      // Keep this action narrow: external mind-map formats use the dedicated importer.
      input.accept = '.json';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const text = ev.target?.result as string;
            const data = JSON.parse(text);
            if (Array.isArray(data?.nodes)) {
              handlers.pushUndo();
              setters.setNodes((prev) => [...prev, ...data.nodes]);
              if (Array.isArray(data.edges)) {
                setters.setEdges((prev) => [...prev, ...data.edges]);
              }
              toast.success(
                i18n.t('mindmap.quickActions.importedNodes', { count: data.nodes.length })
              );
            } else {
              toast.error(i18n.t('mindmap.quickActions.unsupportedImportFile'));
            }
          } catch {
            toast.error(i18n.t('mindmap.quickActions.couldNotReadJsonFile'));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
    if (action === 'mm_import_url') {
      toast(i18n.t('mindmap.quickActions.urlImportNotAvailable'), { icon: 'ℹ️', duration: 2500 });
      return;
    }
    if (
      [
        'mm_background',
        'mm_governance',
        'mm_timers',
        'mm_cross_tool',
        'mm_collaboration',
        'mm_kanban_view',
      ].includes(action)
    ) {
      toast(i18n.t('mindmap.quickActions.featureUnderDevelopment'), {
        icon: '🚧',
        duration: 2200,
      });
      return;
    }

    // ── MoreToolsPanel actions ─────────────────────────────────────────────
    if (action === 'mm_change_layout') {
      handlers.pushUndo();
      const modes = ['tree', 'radial', 'force'];
      const curIdx = modes.indexOf(layoutMode);
      const nextMode = modes[(curIdx + 1) % modes.length];
      setters.setLayoutMode(nextMode);
      if (setters.setStructureType) setters.setStructureType('mindmap');
      const laid =
        nextMode === 'radial'
          ? applyRadialLayout(nodes, edges)
          : nextMode === 'force'
            ? applyForceLayout(nodes, edges)
            : handlers.autoLayout(nodes, edges);
      setters.setNodes(laid);
      setTimeout(() => {
        try {
          handlers.fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* */
        }
      }, 50);
      toast.success(i18n.t('mindmap.quickActions.layoutChanged', { mode: nextMode }), { duration: 1200 });
    }
    if (action === 'mm_structure_picker') {
      if (setters.setShowStructurePicker) setters.setShowStructurePicker(true);
    }
    if (action === 'mm_set_structure') {
      const newType = detail?.structureType as MapStructureType | undefined;
      if (newType && setters.setStructureType) {
        handlers.pushUndo();
        setters.setStructureType(newType);
        const laid = applyStructureLayout(newType, nodes, edges, handlers.autoLayout);
        setters.setNodes(laid);
        setTimeout(() => {
          try {
            handlers.fitView({ padding: 0.3, duration: 400 });
          } catch {
            /* */
          }
        }, 50);
        const LABELS: Record<string, { pl: string; en: string }> = {
          mindmap: { pl: 'Mapa myśli', en: 'Mind Map' },
          org_chart: { pl: 'Schemat organizacyjny', en: 'Org Chart' },
          tree_right: { pl: 'Drzewo (w prawo)', en: 'Tree (Right)' },
          fishbone: { pl: 'Ishikawa (rybka)', en: 'Fishbone' },
          timeline: { pl: 'Oś czasu', en: 'Timeline' },
          semantic: { pl: 'Semantyczny', en: 'Semantic' },
        };
        const label = isPolish ? LABELS[newType]?.pl : LABELS[newType]?.en;
        toast.success(i18n.t('mindmap.quickActions.structureChanged', { label }), { duration: 1200 });
      }
    }
    if (action === 'mm_toggle_minimap') {
      if (setters.setShowMiniMap) setters.setShowMiniMap((p) => !p);
    }
    if (action === 'mm_fit_view') {
      handlers.fitView({ padding: 0.3, duration: 400 });
    }
    if (action === 'mm_activity') setters.setShowActivityFeed(true);
    if (action === 'mm_share') {
      const url = `${window.location.origin}${window.location.pathname}?ideaId=${ideaId}`;
      navigator.clipboard
        ?.writeText(url)
        .then(() => {
          toast.success(i18n.t('mindmap.quickActions.linkCopied'));
        })
        .catch(() => {
          toast(i18n.t('mindmap.quickActions.copyFailed'), { icon: '⚠️' });
        });
    }
    if (action === 'mm_embed') {
      const embedUrl = `${window.location.origin}/embed/idea/${ideaId}`;
      const embedCode = `<iframe src="${embedUrl}" width="800" height="600" frameborder="0"></iframe>`;
      navigator.clipboard
        ?.writeText(embedCode)
        .then(() => {
          toast.success(i18n.t('mindmap.quickActions.embedCodeCopied'));
        })
        .catch(() => {
          toast(i18n.t('mindmap.quickActions.copyFailed'), { icon: '⚠️' });
        });
    }
    if (action === 'mm_branch_analysis') setters.setShowBranchComparison(true);
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
