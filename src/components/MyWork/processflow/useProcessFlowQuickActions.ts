/**
 * useProcessFlowQuickActions — Extracted quick action handler for Process Flow.
 *
 * Listens to `idea-workspace-quick-action` events and dispatches pf_* actions.
 */
import { useEffect, useRef } from 'react';
import type { Node } from 'reactflow';

export interface ProcessFlowQuickActionHandlers {
  addNode: (shape: any, overrides?: { label?: string }) => void;
  insertAutomationTrigger: () => void;
  addLane: () => void;
  insertBetween: () => void;
  splitPath: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  undo: () => void;
  redo: () => void;
  openMetricsEditor: () => void;
  runSavingsAnalysis: () => void;
  /**
   * F-processflow-dead-actions: generates a whole process from a free-text
   * prompt (chat "stwórz proces X" / pf_create). Wired to the real
   * `flow_generator` AI pipeline (useProcessFlowAIProposal.createProposal) —
   * NOT a stub. Opens the AI proposal panel with the result for review.
   */
  createFromPrompt: (prompt: string) => void;
  /**
   * F-processflow-dead-actions: bottleneck/optimization analysis for
   * pf_analyze. Wired to the real `process_coach` AI pipeline (handleAICoach
   * / runProcessCoach) — the same handler already used by the toolbar's AI
   * Coach button.
   */
  runProcessCoach: () => void;
  /**
   * P1-1 (martwe kliknięcia powłoki): „Auto-układ" z Menu 3 wysyłał zdarzenie
   * Mapy myśli (`idea-mindmap-node-quick-action` / `pane_auto_layout`), którego
   * w Przepływie nikt nie słucha — przycisk nie robił NIC. Przepływ ma własny
   * silnik układu (`handleAutoLayout` w IdeaProcessFlowTool: autoLayout + undo +
   * broadcast do kolaboracji); tu go tylko udostępniamy pod `pf_auto_layout`.
   */
  autoLayout?: () => void;
  /**
   * Z1 (rozdz. 06 §3): tryb kursora płótna z lewego raila. Rail wysyła
   * `mm_select_mode` / `mm_pan_mode` (nazwy historyczne — obsługuje je też
   * IdeaMapWorkspace, którego nie ruszamy). Do 2026-07-23 Przepływ ich NIE
   * słuchał, więc pstryczek raila był czysto kosmetyczny.
   */
  setCursorMode?: (mode: 'select' | 'pan') => void;
  /**
   * D2 (2026-07-28): pokazywanie kratki na płótnie. Do tej pory sterowała tym
   * bezpodpisowa nakładka `absolute top-2 left-2` nad płótnem — właściciel nie
   * wiedział, co ta ikona robi, a przy okazji zasłaniała pstryczek zwijania
   * pierwszego toru (58/225 punktów klikalnych). Funkcja przeniesiona do
   * wspólnego lewego raila, tu jest jej jedyne wejście.
   */
  toggleGrid?: () => void;
  /** D2: przyciąganie kroków do siatki (ReactFlow `snapToGrid`), jak wyżej. */
  toggleSnap?: () => void;
  /**
   * Action Registry — Process Flow edge menu (2026-08-09,
   * `ProcessFlowContextMenu.tsx`'s `getEdgeContextActions`). UI right-click
   * already opens `EdgeStylePopover` directly via a local `setEdgeStylePopover`
   * closure in `IdeaProcessFlowTool.tsx` (unchanged) — this is the bus path
   * for Teresa/non-UI callers (`idea.edge.pf_edit_props` in
   * `ideaActionRegistry.ts`). No click position exists off the UI thread, so
   * the popover opens at a fixed default anchor.
   */
  openEdgeStylePopover?: (edgeId: string) => void;
  /**
   * Action Registry — edge-reverse (`idea.edge.reverse`, extended to
   * `process_flow` 2026-08-09). `handleEdgeReverse(edgeId)` in
   * `IdeaProcessFlowTool.tsx` already takes an explicit id, so this is a
   * real, id-addressable bus path (unlike insert/delete below, which stay
   * selection-based).
   */
  reverseEdge?: (edgeId: string) => void;
  /**
   * Action Registry — the 5 `idea.edge.pf_condition_*` actions
   * (`edge-cond-none/yes/no/default/exception` in
   * `getEdgeContextActions`/`EDGE_CONDITIONS`) all dispatch here with the
   * condition value baked in per registry id. Forwards to
   * `handleEdgeConditionChange(edgeId, condition)` in `IdeaProcessFlowTool.tsx`,
   * which already calls `pushUndo()`.
   */
  setEdgeCondition?: (edgeId: string, condition: string) => void;
  /**
   * Action Registry — Process Flow NODE menu (2026-08-09,
   * `ProcessFlowContextMenu.tsx`'s `getNodeContextActions`,
   * `idea.node.pf_ai_rewrite_step`). UI click (`onAIRewriteStep` in
   * `IdeaProcessFlowTool.tsx`) still calls `openStepRewrite(nodeId)` ALONE —
   * that only opens the AI panel and waits for a human to type + submit
   * their own instruction (`handleAIPanelGenerate` → `createStepRewriteProposal`).
   * Teresa supplies the instruction up front (no browser to type into), so
   * this receiver does both steps in one call: opens the panel (still
   * required for the doc09 §3 accept/reject step — Teresa does not skip
   * proposal review) AND immediately generates with her instruction.
   */
  startAIRewriteStep?: (nodeId: string, instruction: string) => void;
  /**
   * Action Registry — Process Flow LANE (tor) controls (2026-08-10,
   * `LaneSystem.tsx` header buttons, `idea.lane.pf_*`, `scope: 'lane_frame'`).
   * All six forward to the EXACT SAME handler functions the UI buttons
   * already call (`handleLaneRename`/`handleLaneMoveUp`/`handleLaneMoveDown`/
   * `handleLaneColorChange`/`handleLaneDelete` in `useProcessFlowNodes.ts`,
   * `handleLaneToggleCollapse` in `IdeaProcessFlowTool.tsx`) — component
   * (`LaneSystem.tsx`) untouched, same pattern as the node/edge menu passes.
   */
  renameLane?: (laneId: string, label: string) => void;
  moveLaneUp?: (laneId: string) => void;
  moveLaneDown?: (laneId: string) => void;
  setLaneColor?: (laneId: string, color: string) => void;
  toggleLaneCollapse?: (laneId: string) => void;
  deleteLane?: (laneId: string) => void;
}

export interface ProcessFlowQuickActionSetters {
  setFlowMode: React.Dispatch<React.SetStateAction<any>>;
  setSemanticKit: React.Dispatch<React.SetStateAction<any>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export interface UseProcessFlowQuickActionsOpts {
  open: boolean;
  ideaId: string;
  isPl: boolean;
  nodes: Node[];
  handlers: ProcessFlowQuickActionHandlers;
  setters: ProcessFlowQuickActionSetters;
}

export function useProcessFlowQuickActions(opts: UseProcessFlowQuickActionsOpts): void {
  const { open, ideaId, isPl, nodes, handlers, setters } = opts;

  const quickActionRef = useRef<(action: string, detail?: Record<string, unknown>) => void>(
    () => {}
  );

  quickActionRef.current = (action: string, detail?: Record<string, unknown>) => {
    if (action === 'pf_add_action') handlers.addNode('action');
    // pf_add_step: chat-detector alias for "add a step" — same shape as
    // pf_add_action (an actionable process step). See processFlowIntentDetector.ts.
    // Krok B: `idea.element.add` przekazuje `ctx.params.label` jako
    // `detail.label` — `addNode` już przyjmuje `overrides.label` (patrz
    // IdeaProcessFlowTool.addNode), więc tu tylko przekazujemy dalej.
    if (action === 'pf_add_step') {
      const label =
        typeof detail?.label === 'string' && detail.label.trim() ? detail.label.trim() : undefined;
      handlers.addNode('action', label ? { label } : undefined);
    }
    if (action === 'pf_add_decision') handlers.addNode('decision');
    if (action === 'pf_add_start') handlers.addNode('start');
    if (action === 'pf_add_end') handlers.addNode('end');
    if (action === 'pf_add_lane') handlers.addLane();
    if (action === 'pf_insert_between') handlers.insertBetween();
    if (action === 'pf_split_path') handlers.splitPath();
    if (action === 'pf_mode_classic') setters.setFlowMode('classic');
    if (action === 'pf_mode_automation') setters.setFlowMode('automation');
    if (action === 'pf_insert_automation_trigger') handlers.insertAutomationTrigger();
    if (action === 'pf_mode_vsm') setters.setFlowMode('vsm');
    if (action === 'pf_semantic_bpmn') {
      setters.setFlowMode('classic');
      setters.setSemanticKit('bpmn');
    }
    if (action === 'pf_semantic_system') {
      setters.setFlowMode('classic');
      setters.setSemanticKit('system');
    }
    if (action === 'pf_semantic_org') {
      setters.setFlowMode('classic');
      setters.setSemanticKit('org');
    }

    if (action === 'pf_add_vsm_process') handlers.addNode('vsm_process');
    if (action === 'pf_add_vsm_inventory') handlers.addNode('vsm_inventory');
    if (action === 'pf_add_vsm_supplier') handlers.addNode('vsm_supplier');
    if (action === 'pf_add_vsm_customer') handlers.addNode('vsm_customer');
    if (action === 'pf_add_vsm_kaizen') handlers.addNode('vsm_kaizen');
    if (action === 'pf_add_bpmn_event') handlers.addNode('bpmn_event');
    if (action === 'pf_add_bpmn_task') handlers.addNode('bpmn_task');
    if (action === 'pf_add_bpmn_gateway') handlers.addNode('bpmn_gateway');
    if (action === 'pf_add_system_actor') handlers.addNode('system_actor');
    if (action === 'pf_add_system_service') handlers.addNode('system_service');
    if (action === 'pf_add_system_db') handlers.addNode('system_db');
    if (action === 'pf_add_org_role') handlers.addNode('org_role');
    if (action === 'pf_add_org_team') handlers.addNode('org_team');
    if (action === 'pf_add_org_handoff') handlers.addNode('org_handoff');

    if (action === 'pf_mark_automation') {
      setters.setNodes((nds: Node[]) =>
        nds.map((n: Node) =>
          n.selected
            ? {
                ...n,
                data: {
                  ...n.data,
                  automationCandidate: !n.data?.automationCandidate,
                  automationPotential: n.data?.automationCandidate ? undefined : 'medium',
                },
              }
            : n
        )
      );
    }

    if (action === 'pf_add_metrics') {
      handlers.openMetricsEditor();
    }

    if (action === 'pf_savings_analysis') {
      handlers.runSavingsAnalysis();
    }

    // pf_create: chat "stwórz proces X" — generate a whole flow from the
    // prompt text carried in the event detail (real flow_generator pipeline).
    if (action === 'pf_create') {
      const prompt = typeof detail?.prompt === 'string' ? detail.prompt : '';
      handlers.createFromPrompt(prompt);
    }

    // pf_analyze: chat "analizuj/optymalizuj proces" — real bottleneck/
    // optimization analysis (same pipeline as the toolbar's AI Coach button).
    if (action === 'pf_analyze') {
      handlers.runProcessCoach();
    }

    // P1-1: „Auto-układ" (Menu 3) w reprezentacji Przepływ.
    if (action === 'pf_auto_layout') handlers.autoLayout?.();

    // Z1 — tryb kursora z lewego raila (ten sam pstryczek co w Mapie myśli).
    if (action === 'mm_select_mode') handlers.setCursorMode?.('select');
    if (action === 'mm_pan_mode') handlers.setCursorMode?.('pan');

    // D2 — siatka i przyciąganie z lewego raila (dawna nakładka nad płótnem).
    if (action === 'pf_toggle_grid') handlers.toggleGrid?.();
    if (action === 'pf_toggle_snap') handlers.toggleSnap?.();

    if (action === 'pf_undo') handlers.undo();
    if (action === 'pf_redo') handlers.redo();
    if (action === 'pf_delete') handlers.deleteSelected();
    if (action === 'pf_duplicate') handlers.duplicateSelected();

    // Action Registry — Process Flow edge menu (2026-08-09). edge-insert
    // (`idea.edge.pf_insert_node`) and edge-delete (`idea.edge.pf_delete`)
    // reuse `pf_insert_between`/`pf_delete` ABOVE — same underlying
    // insertBetween()/deleteSelected(), selection-based, no new case needed
    // here. The three below are the actions that had NO runtime string at
    // all before this pass.
    if (action === 'pf_edge_edit_props') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (edgeId) handlers.openEdgeStylePopover?.(edgeId);
    }
    if (action === 'pf_edge_reverse') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      if (edgeId) handlers.reverseEdge?.(edgeId);
    }
    if (action === 'pf_edge_set_condition') {
      const edgeId = typeof detail?.edgeId === 'string' ? detail.edgeId : undefined;
      const condition = typeof detail?.condition === 'string' ? detail.condition : undefined;
      if (edgeId && condition !== undefined) handlers.setEdgeCondition?.(edgeId, condition);
    }

    // Action Registry — Process Flow NODE menu (2026-08-09). `pf_duplicate`/
    // `pf_delete` above (already existed) cover `idea.node.duplicate`/
    // `idea.node.delete` (extended cross-tool from Whiteboard) and
    // `pf_auto_layout` above covers the node menu's "Auto-layout" item
    // (same whole-view action as the canvas menu's own entry) — no new
    // cases needed for those. `pf_ai_rewrite_step` is the one genuinely new
    // receiver this pass adds.
    if (action === 'pf_ai_rewrite_step') {
      const nodeId = typeof detail?.nodeId === 'string' ? detail.nodeId : undefined;
      const instruction = typeof detail?.instruction === 'string' ? detail.instruction : undefined;
      if (nodeId && instruction) handlers.startAIRewriteStep?.(nodeId, instruction);
    }

    // Action Registry — Process Flow CANVAS (background) menu (2026-08-10,
    // `ProcessFlowContextMenu.tsx`'s `getCanvasContextActions`). "Add action"
    // (`idea.element.add`, runtime `pf_add_step` above, existing/reused) and
    // "Auto-layout" (`idea.view.auto_layout`, runtime `pf_auto_layout` above,
    // existing/reused) already covered — `pf_add_decision`
    // is the one canvas-menu item with NO prior runtime string at all
    // (`idea.view.pf_add_decision`, new this pass). "Paste" stays UI-only
    // (`idea.view.pf_paste_at_point`, local tool clipboard — no bus receiver,
    // same reasoning as Mind Map's `idea.view.paste_at_point`).
    if (action === 'pf_add_decision') handlers.addNode('decision');

    // Action Registry — Process Flow LANE (tor) controls (2026-08-10,
    // `LaneSystem.tsx` header buttons — inline, always-visible, no menu to
    // intercept; `idea.lane.pf_*`, scope `lane_frame`). All six forward
    // `detail.laneId` (+ the one extra field each op needs) to the SAME
    // handler functions the UI buttons already call directly
    // (`handleLaneRename`/etc. in `IdeaProcessFlowTool.tsx` /
    // `useProcessFlowNodes.ts`, all already `pushUndo()`'d — see
    // `idea.lane.pf_*` registry entries for the per-action evidence).
    if (action === 'pf_lane_rename') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      const label = typeof detail?.label === 'string' ? detail.label : undefined;
      if (laneId && label) handlers.renameLane?.(laneId, label);
    }
    if (action === 'pf_lane_move_up') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      if (laneId) handlers.moveLaneUp?.(laneId);
    }
    if (action === 'pf_lane_move_down') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      if (laneId) handlers.moveLaneDown?.(laneId);
    }
    if (action === 'pf_lane_color') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      const color = typeof detail?.color === 'string' ? detail.color : undefined;
      if (laneId && color) handlers.setLaneColor?.(laneId, color);
    }
    if (action === 'pf_lane_toggle_collapse') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      if (laneId) handlers.toggleLaneCollapse?.(laneId);
    }
    if (action === 'pf_lane_delete') {
      const laneId = typeof detail?.laneId === 'string' ? detail.laneId : undefined;
      if (laneId) handlers.deleteLane?.(laneId);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) quickActionRef.current(detail.action, detail);
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [open]);
}
