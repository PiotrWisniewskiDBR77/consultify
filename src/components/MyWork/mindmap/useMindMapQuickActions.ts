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

import {
  type EdgeArrowDirection,
  nextArrowDirection,
  resolveArrowDirection,
} from '../canvas/edgeArrowMarkers';
import type { MapStructureType, MindMapInteractionMode } from '../ideaSelectionTypes';
import { findIdeaTemplate } from '../IdeaTemplateGallery';
import { isRelationEdge } from './useMindMapNodes';
import { applyForceLayout } from './ForceDirectedLayout';
import { applyRadialLayout } from './RadialTreeLayout';
import { applyStructureLayout } from './StructureLayouts';

// ── #DEAD-ACTIONS fix: mm_create / mm_expand_branch / mm_apply_framework ──────
// mindmapIntentDetector.ts (AIChat) recognizes these 3 action names from free-text
// chat prompts ("create a mind map about X", "apply SWOT"…) but this handler used
// to have no case for them at all — the chat showed "Working on mind map…" and
// nothing happened. Wired below to real, existing pipelines (no new backend):
//  - mm_expand_branch  → alias of mm_ai_expand_branch (same handler, same endpoint)
//  - mm_apply_framework→ reuses the static framework templates from
//                        IdeaTemplateGallery.ts (findIdeaTemplate) — same data the
//                        Templates popover already applies
//  - mm_create         → seeds the idea's `body` (read by POST .../map/expand as
//                        the LLM context) via Api.updateMyIdea, renames the root
//                        node, then reuses handlers.handleAIExpand() — the exact
//                        same AI call mm_ai_expand_branch already makes.

/** Strip the leading "create a mind map about / stwórz mapę myśli o…" intent
 * phrase (mirrors the regexes in mindmapIntentDetector.ts) to recover the bare
 * topic the user actually asked for. Falls back to the raw text. */
function extractMindMapTopic(rawText: string): string {
  const stripped = rawText
    .replace(
      /\b(create|start|build|make|open)\s+(a\s+)?(mind\s*map|idea\s*map|recommendation\s*map|concept\s*map)\b/gi,
      ''
    )
    .replace(
      /\b(map|visualize|diagram)\s+(the\s+)?(structure|hierarchy|breakdown|dependencies)\b/gi,
      ''
    )
    .replace(
      /\b(stwórz|utwórz|zacznij|zbuduj|otwórz)\s+(mapę\s+(myśli|rekomendacji|pomysłów|koncepcji|idei))\b/gi,
      ''
    )
    .replace(/\b(zmapuj|zwizualizuj)\s+(strukturę|hierarchię|zależności)\b/gi, '')
    .replace(/^\s*(of|for|about|on|dla|o|na temat)\s+/i, '')
    .replace(/^[\s:,\-–—]+|[\s:,\-–—]+$/g, '')
    .trim();
  return stripped || rawText.trim();
}

/** Known static mind-map framework templates (IdeaTemplateGallery) keyed by the
 * keyword mindmapIntentDetector.ts fires mm_apply_framework on. Extend this list
 * as more `/^\b(...)\b/` patterns are added to the detector.
 *
 * NOTE (found while wiring this up): the #10-AB curated catalog (cx-*) retired
 * `mm-swot` and `mm-porter5` and replaced them with `cx-swot`/`cx-porter5` —
 * but those replacements are WHITEBOARD-tool templates (frameNode/stickyNote),
 * not mindmap-tool. There is currently no live mindmap-tool SWOT/Porter5
 * template, so those two intentionally resolve to the honest fallback below
 * (findIdeaTemplate returns null for the retired id) rather than a fake match.
 * `cx-pestel` IS a live mindmap-tool template and covers the detector's
 * "pest/pestle" keyword for real. */
const FRAMEWORK_TEMPLATE_MATCHERS: Array<{ pattern: RegExp; templateId: string; label: string }> = [
  { pattern: /\bswot\b/i, templateId: 'mm-swot', label: 'SWOT' },
  {
    pattern: /\b(porter'?s?\s*5|five\s*forces|5\s*forces)\b/i,
    templateId: 'mm-porter5',
    label: "Porter's 5 Forces",
  },
  { pattern: /\b(pest|pestle|pestel)\b/i, templateId: 'cx-pestel', label: 'PESTEL' },
  { pattern: /\bvalue\s*chain\b/i, templateId: 'mm-value-chain', label: 'Value Chain' },
  {
    pattern: /\b(mckinsey\s*7-?s|7-?s\s*model)\b/i,
    templateId: 'mm-mckinsey7s',
    label: 'McKinsey 7S',
  },
  { pattern: /\bkotter'?s?\s*8\b/i, templateId: 'mm-kotter8', label: "Kotter's 8-Step" },
  { pattern: /\bokr\b/i, templateId: 'mm-okr', label: 'OKR' },
  { pattern: /\b(fishbone|ishikawa)\b/i, templateId: 'mm-fishbone', label: 'Fishbone' },
  { pattern: /\b5\s*whys?\b/i, templateId: 'mm-5whys', label: '5 Whys' },
  { pattern: /\bstakeholder\b/i, templateId: 'mm-stakeholder', label: 'Stakeholder Map' },
];

export interface MindMapQuickActionHandlers {
  addChildNode: (nodeId?: string, label?: string) => void;
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

/** Awaryjne etykiety toastu strzałki, gdy brak tłumaczenia (i18n = SSOT). */
const ARROW_TOAST_FALLBACK: Record<EdgeArrowDirection, string> = {
  none: 'Arrow: none',
  end: 'Arrow: at the end',
  start: 'Arrow: at the start',
  both: 'Arrow: both ends',
};

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
    // Raw chat prompt text (N-13, UnifiedChatPanel) — only present for the
    // mindmapIntentDetector-sourced actions (mm_create/mm_expand_branch/mm_apply_framework).
    const promptText = typeof detail?.text === 'string' ? detail.text.trim() : '';
    // Krok B: `idea.element.add` (rejestr akcji) przekazuje `ctx.params.label`
    // jako `detail.label` — gdy Teresa/formularz poda treść, nowy węzeł
    // dostaje ją jako etykietę zamiast wchodzić w pusty tryb edycji.
    const addLabel =
      typeof detail?.label === 'string' && detail.label.trim() ? detail.label.trim() : undefined;
    if (action === 'mm_add_child') handlers.addChildNode(targetNodeId, addLabel);
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

    // mm_expand_branch is the name mindmapIntentDetector.ts (AIChat) fires from
    // free-text prompts like "expand this idea" / "rozwiń ten pomysł" — it is the
    // same operation as the toolbar's mm_ai_expand_branch, just a different name
    // coming from a different caller. Previously unhandled here → dead "Working on
    // mind map…" with no follow-up. Anchors on the selected node if the user had
    // one selected, otherwise on root (handleAIExpand's own default).
    if (action === 'mm_ai_expand_branch' || action === 'mm_expand_branch')
      handlers.handleAIExpand(targetNodeId);

    // ── #DEAD-ACTIONS: mm_create — "create a mind map about X" from chat ────
    // No dedicated "generate full map" backend exists. Reuses the two real,
    // existing endpoints already wired elsewhere in this file/module:
    //   1) Api.updateMyIdea(ideaId, { body }) — persists the topic as the idea's
    //      `body`, which POST /my-ideas/:id/map/expand reads server-side as the
    //      LLM seed (`idea.seedText || idea.body || idea.title`).
    //   2) handlers.handleAIExpand() — the exact same call mm_ai_expand_branch
    //      makes (Api.expandMyIdeaMap → that same /map/expand endpoint), anchored
    //      on root, so the map actually gets populated with real AI nodes.
    // The root node label is also renamed locally so the canvas reflects the
    // topic immediately instead of waiting for the AI round trip.
    if (action === 'mm_create') {
      if (locked) return;
      if (!promptText) {
        // No prompt text reached us (e.g. detail.text missing) — still run the
        // real AI expand off root rather than doing nothing.
        handlers.handleAIExpand();
        return;
      }
      const topic = extractMindMapTopic(promptText);
      const rootNode = nodes.find((n) => n.id === 'root');
      if (rootNode) {
        handlers.pushUndo();
        setters.setNodes((prev) =>
          prev.map((n) => (n.id === 'root' ? { ...n, data: { ...n.data, label: topic } } : n))
        );
      }
      (async () => {
        try {
          await Api.updateMyIdea(ideaId, { body: promptText });
        } catch {
          // best-effort — the AI expand below still runs off whatever seed
          // the idea already had if this persist call fails.
        }
        handlers.handleAIExpand();
      })();
      toast.success(
        i18n.t('mindmap.quickActions.creatingMapFor', {
          defaultValue: `Creating map: "${topic}"…`,
          topic,
        }),
        { duration: 1500 }
      );
      return;
    }

    // ── #DEAD-ACTIONS: mm_apply_framework — "apply SWOT" from chat ──────────
    // Reuses the static framework templates already shipped in
    // IdeaTemplateGallery.ts (the exact same data the Templates popover applies
    // via onApplyTemplate) — matched from the chat prompt text against the same
    // keywords mindmapIntentDetector.ts fires this action on. Nodes/edges are
    // merged onto the existing canvas (ids remapped) instead of replacing the
    // whole graph, since this handler only owns local canvas state here.
    if (action === 'mm_apply_framework') {
      if (locked) return;
      const match = promptText
        ? FRAMEWORK_TEMPLATE_MATCHERS.find((m) => m.pattern.test(promptText))
        : undefined;
      const matchedTemplate = match ? findIdeaTemplate(match.templateId) : null;
      // Defensive: only ever splice mindmap-tool node/edge shapes (idea/branch)
      // onto this canvas. Some catalog entries (e.g. cx-swot, cx-porter5) are
      // whiteboard-tool (frameNode/stickyNote) — wrong shape for this canvas —
      // so treat those as "no template" and fall through to the honest fallback.
      const template = matchedTemplate?.tool === 'mindmap' ? matchedTemplate : null;
      const rootNode = nodes.find((n) => n.id === 'root');

      if (template) {
        handlers.pushUndo();
        const suffix = Date.now();
        const idMap = new Map<string, string>();
        template.nodes.forEach((n: any) => {
          idMap.set(n.id, n.id === 'root' ? (rootNode?.id ?? 'root') : `${n.id}-${suffix}`);
        });
        const originX = template.nodes.find((n: any) => n.id === 'root')?.position?.x ?? 400;
        const originY = template.nodes.find((n: any) => n.id === 'root')?.position?.y ?? 300;
        const offsetX = (rootNode?.position.x ?? 400) - originX;
        const offsetY = (rootNode?.position.y ?? 300) - originY;
        const newNodes: Node[] = template.nodes
          .filter((n: any) => n.id !== 'root')
          .map((n: any) => ({
            ...n,
            id: idMap.get(n.id)!,
            position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
          }));
        const newEdges: Edge[] = template.edges.map((e: any) => ({
          ...e,
          id: `e-${idMap.get(e.source) || e.source}-${idMap.get(e.target) || e.target}-${suffix}`,
          source: idMap.get(e.source) || e.source,
          target: idMap.get(e.target) || e.target,
        }));
        setters.setNodes((prev) => [...prev, ...newNodes]);
        setters.setEdges((prev) => [...prev, ...newEdges]);
        const templateLabel = isPolish ? template.namePl : template.nameEn;
        toast.success(
          i18n.t('myWorkMindmap.quickActions.appliedTemplate', {
            defaultValue: 'Applied template: {{label}}',
            label: templateLabel,
          }),
          { duration: 1500 }
        );
        setTimeout(() => {
          try {
            handlers.fitView({ padding: 0.3, duration: 400 });
          } catch {
            /* ignore */
          }
        }, 50);
        return;
      }

      // No live mindmap-tool template resolved for this framework (either the
      // keyword isn't in FRAMEWORK_TEMPLATE_MATCHERS, or it matched an id that's
      // retired/wrong-tool, e.g. SWOT/Porter5 today — see the NOTE above).
      // TEMPORARY FALLBACK, not the full feature: add a single labeled branch
      // node off root so the user gets a real, visible starting point instead
      // of a silent dead-end, and say so.
      handlers.pushUndo();
      const fallbackLabel =
        match?.label || (promptText ? extractMindMapTopic(promptText) : 'Framework');
      const newId = `framework-${Date.now()}`;
      setters.setNodes((prev) => [
        ...prev,
        {
          id: newId,
          type: 'branch',
          position: {
            x: (rootNode?.position.x ?? 400) + 240,
            y: rootNode?.position.y ?? 300,
          },
          data: { label: fallbackLabel, branchKey: 'framework' },
        } as Node,
      ]);
      setters.setEdges((prev) => [
        ...prev,
        { id: `e-root-${newId}`, source: rootNode?.id ?? 'root', target: newId } as Edge,
      ]);
      toast(
        i18n.t('myWorkMindmap.quickActions.noReadyTemplate', {
          defaultValue:
            'No ready-made template for "{{label}}" yet — added an empty starter node (temporary fallback).',
          label: fallbackLabel,
        }),
        { icon: '⚠️', duration: 3000 }
      );
      return;
    }
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
      if (sel && sel.type === 'idea') {
        setters.setCommentNodeId(sel.id);
      } else {
        // #6g — this used to no-op silently when nothing was selected; give the
        // user the same "select a node first" hint used by the other node-scoped
        // quick actions instead of a dead click.
        toast(i18n.t('mindmap.quickActions.selectNodeForComments'), { icon: 'ℹ️' });
      }
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
            label: i18n.t(`myWorkMindmap.quickActions.semanticLabel.${action}`, {
              defaultValue: spec.labelEn,
            }),
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
    // J26 (channel 2): direct node rewrite. Hands off to IdeaMapWorkspace's
    // `idea-mindmap-rewrite-node` listener, which prompts for an instruction,
    // asks the LLM for a new label, and surfaces it via the Propose→Accept path.
    if (action === 'mm_ai_rewrite_node') {
      if (locked) return;
      const target = targetNodeId
        ? nodes.find((n) => n.id === targetNodeId)
        : handlers.getSelectedNode();
      if (!target) {
        toast(i18n.t('mindmap.quickActions.selectNodeFirst'), { icon: 'ℹ️' });
        return;
      }
      window.dispatchEvent(
        new CustomEvent('idea-mindmap-rewrite-node', {
          detail: {
            ideaId,
            nodeId: target.id,
            nodeLabel: String(target.data?.label || ''),
          },
        })
      );
      return;
    }
    // RB-011/CB-05: the action registry (idea.ai.expand_map) forwards an explicit
    // `ctx.params.nodeId` for this exact runtime string (RUNTIME_AI_EXPAND =
    // 'mm_ai_expand'), and `targetNodeId` above already parses it from
    // `detail.nodeId`. It must reach handleAIExpand — silently expanding from
    // selection/root when a caller named a specific node is the bug this closes.
    if (action === 'mm_ai_expand') handlers.handleAIExpand(targetNodeId);
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

      const CLUSTER_LABELS: Record<string, string> = {
        risks: 'Risks',
        hypotheses: 'Hypotheses',
        actions: 'Actions',
        evidence: 'Evidence',
        questions: 'Questions',
        uncategorized: 'Other',
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
        const branchLabel = CLUSTER_LABELS[key]
          ? i18n.t(`myWorkMindmap.quickActions.cluster.${key}`, {
              defaultValue: CLUSTER_LABELS[key],
            })
          : key;

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
          ctxSuffix: ctx
            ? i18n.t('mindmap.quickActions.promptChatAboutNodeCtxSuffix', { ctx })
            : '',
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
      toast.success(i18n.t('mindmap.quickActions.layoutChanged', { mode: nextMode }), {
        duration: 1200,
      });
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
        const LABELS: Record<string, string> = {
          mindmap: 'Mind Map',
          org_chart: 'Org Chart',
          tree_right: 'Tree (Right)',
          fishbone: 'Fishbone',
          timeline: 'Timeline',
          semantic: 'Semantic',
        };
        const label = LABELS[newType]
          ? i18n.t(`myWorkMindmap.quickActions.structureLabel.${newType}`, {
              defaultValue: LABELS[newType],
            })
          : undefined;
        toast.success(i18n.t('mindmap.quickActions.structureChanged', { label }), {
          duration: 1200,
        });
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

    // ── Strzałka kierunku przepływu na krawędzi (2026-07-28) ────────────────
    // Zgłoszenie właściciela: „strzałki by się przydały i one mogłyby pokazywać
    // kierunek przepływu linii". Model = `edge.data.arrowDirection`, dokładnie
    // ten sam, którego od #6p używa Przepływ procesu (patrz
    // `canvas/edgeArrowMarkers.tsx`) — nie wprowadzamy drugiej konwencji.
    //
    // Dwa wejścia, JEDNO pole (nie ma ustawienia globalnego mapy, którego nie
    // dałoby się nadpisać per linia):
    //  • `detail.edgeId`  — prawy klik na połączeniu → cykl na tej krawędzi
    //    (none → end → both → start), stan raportuje toast, jak przy „Zmień
    //    styl linii".
    //  • `detail.nodeId` + `detail.direction` — hurtowe ustawienie z menu
    //    „Styl linii" w pasku węzła: WSZYSTKIE połączenia wychodzące z gałęzi
    //    (rekurencyjnie w dół), bo tam właściciel szukał tej opcji.
    if (action === 'mm_edge_arrow') {
      if (locked) return;
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      const nodeId = typeof detail?.nodeId === 'string' ? detail.nodeId : undefined;
      const explicit = resolveArrowDirection(detail?.direction, 'none');

      // Zbiór krawędzi do zmiany: pojedyncza albo całe poddrzewo gałęzi.
      let targetIds: Set<string>;
      if (edgeId) {
        targetIds = new Set([edgeId]);
      } else if (nodeId) {
        const subtree = new Set<string>([nodeId]);
        // BFS w dół po krawędziach — gałąź = węzeł + wszystko, co z niego wisi.
        let grew = true;
        while (grew) {
          grew = false;
          for (const e of edges) {
            if (subtree.has(e.source) && !subtree.has(e.target)) {
              subtree.add(e.target);
              grew = true;
            }
          }
        }
        targetIds = new Set(edges.filter((e) => subtree.has(e.source)).map((e) => e.id));
      } else {
        return;
      }
      if (targetIds.size === 0) {
        toast(i18n.t('mindmap.edgeArrow.noEdges', 'No connections in this branch'), {
          icon: '⚠️',
        });
        return;
      }

      let applied: EdgeArrowDirection = explicit;
      setters.setEdges((prev) =>
        prev.map((e) => {
          if (!targetIds.has(e.id)) return e;
          const current = resolveArrowDirection(e.data?.arrowDirection, 'none');
          const next = edgeId ? nextArrowDirection(current) : explicit;
          applied = next;
          return { ...e, data: { ...(e.data || {}), arrowDirection: next } };
        })
      );
      toast.success(
        i18n.t(`mindmap.edgeArrow.${applied}`, {
          defaultValue: ARROW_TOAST_FALLBACK[applied],
        }),
        { duration: 900 }
      );
    }

    // ── Menu krawędzi, pozostałe 6 pozycji (2026-08-09, rejestr akcji Z1/Z4 —
    // `EdgeContextMenu.tsx`) ─────────────────────────────────────────────────
    // Przed tym dopiskiem TYLKO `mm_edge_arrow` (wyżej) miało odbiornik na tej
    // szynie; pozostałe 6 pozycji menu prawego kliku szły przez `onAction` prop
    // → `handleEdgeContextAction` w `IdeaRecommendationMap.tsx` (zamknięcie nad
    // lokalnym stanem `edgeContextMenu`/`edges`). Logika PRZENIESIONA stąd 1:1
    // (mutacje bez zmian, patrz komentarze przy każdym bloku) — komponent nie ma
    // już własnej implementacji tych 6 akcji, tylko dispatchuje przez rejestr
    // (`getActionsForSurface`/`runIdeaAction`), DOKŁADNIE jak `mm_edge_arrow` już
    // robił od 2026-07-28 — ten sam wzorzec, rozszerzony, nie duplikowany.
    //
    // Etykieta/relacja: `detail.label`/`detail.relation` obecne → Teresa podała
    // treść wprost, pomijamy `window.prompt` (headless caller nie odpowie na
    // natywny prompt) — 1:1 z konwencją `addLabel` przy `mm_add_child` wyżej.
    // Nieobecne → klik człowieka, pytamy jak dawniej.
    //
    // `isRelationEdge` gate: `edge_reverse`/`edge_insert_node`/`edge_edit_relation`/
    // `edge_delete` działały w oryginale TYLKO na krawędziach relacji (nie
    // strukturalnych) — na innych po cichu nic się nie działo (menu samo NIE
    // wyszarzało tych pozycji dla krawędzi strukturalnych, więc ten cichy no-op
    // jest ŚWIADOMIE zachowany 1:1, nie "naprawiany" tutaj).
    //
    // `handlers.pushUndo()`: DOPISANE dla edit_label/cycle_style/edit_relation —
    // oryginał (`handleEdgeContextAction`) NIE wołał tam pushUndo (w
    // przeciwieństwie do reverse/insert_node/delete, które już wołały), więc te
    // 3 akcje nie wspierały Ctrl+Z. Rejestr wymaga uczciwego `undo` dla każdej
    // `mutates: true` akcji (R4) — zamiast fałszywie to zadeklarować, dodajemy tu
    // realny pushUndo() (funkcja już istnieje i jest już używana przez sąsiednie
    // akcje w tej samej funkcji — niskie ryzyko, brak nowej mechaniki).
    if (action === 'mm_edge_edit_label') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const current = String(edge.data?.label || '');
      const providedLabel = typeof detail?.label === 'string' ? detail.label : undefined;
      const next =
        providedLabel !== undefined
          ? providedLabel
          : window.prompt(i18n.t('mindmap.connectionLabel'), current);
      if (next === null || next === undefined) return;
      handlers.pushUndo();
      setters.setEdges((prev) =>
        prev.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, label: next } } : e))
      );
    }

    if (action === 'mm_edge_insert_node') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || !isRelationEdge(edge)) return;
      handlers.pushUndo();
      const newId = `node-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const posX = sourceNode && targetNode ? (sourceNode.position.x + targetNode.position.x) / 2 : 0;
      const posY = sourceNode && targetNode ? (sourceNode.position.y + targetNode.position.y) / 2 : 0;
      const newNode: Node = {
        id: newId,
        type: 'idea',
        position: { x: posX, y: posY },
        data: {
          label: '',
          branchKey: 'uncategorized',
          sourceType: 'manual',
          priority: 50,
          _startEditing: Date.now(),
        },
      } as any;
      setters.setEdges((prev) => {
        const without = prev.filter((e) => e.id !== edgeId);
        return [
          ...without,
          { ...edge, id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, target: newId } as Edge,
          {
            ...edge,
            id: `edge-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            source: newId,
            target: edge.target,
          } as Edge,
        ];
      });
      setters.setNodes((prev) => [
        ...prev.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true },
      ]);
    }

    if (action === 'mm_edge_reverse') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || !isRelationEdge(edge)) return;
      handlers.pushUndo();
      setters.setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle: e.targetHandle,
                targetHandle: e.sourceHandle,
              }
            : e
        )
      );
      toast.success(i18n.t('mindmap.directionReversed'), { duration: 800 });
    }

    if (action === 'mm_edge_cycle_style') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const styles = ['solid', 'dashed', 'dotted'];
      const current = edge.style?.strokeDasharray
        ? edge.style.strokeDasharray === '2 2'
          ? 'dotted'
          : 'dashed'
        : 'solid';
      const nextIdx = (styles.indexOf(current) + 1) % styles.length;
      const nextStyle = styles[nextIdx];
      const dasharray = nextStyle === 'dashed' ? '5 5' : nextStyle === 'dotted' ? '2 2' : undefined;
      handlers.pushUndo();
      setters.setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId ? { ...e, style: { ...e.style, strokeDasharray: dasharray } } : e
        )
      );
      toast.success(
        i18n.t('myWork.ideaMap.toast.styleChanged', 'Style: {{style}}', { style: nextStyle }),
        { duration: 800 }
      );
    }

    if (action === 'mm_edge_edit_relation') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || !isRelationEdge(edge)) return;
      const current = String(edge.data?.relation || '');
      const relations = ['related', 'depends_on', 'blocks', 'supports', 'contradicts'];
      const providedRelation = typeof detail?.relation === 'string' ? detail.relation : undefined;
      const next =
        providedRelation !== undefined
          ? providedRelation
          : window.prompt(
              i18n.t('mindmap.relationTypePrompt', { relations: relations.join(', ') }),
              current
            );
      if (next === null || next === undefined) return;
      handlers.pushUndo();
      setters.setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, relation: next, label: next } } : e
        )
      );
    }

    if (action === 'mm_edge_delete') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (!edgeId || locked) return;
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge || !isRelationEdge(edge)) return;
      handlers.pushUndo();
      setters.setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      toast.success(i18n.t('mindmap.connectionRemoved'), { duration: 800 });
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
