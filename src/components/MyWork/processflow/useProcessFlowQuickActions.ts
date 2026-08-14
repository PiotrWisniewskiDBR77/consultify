/**
 * useProcessFlowQuickActions — Extracted quick action handler for Process Flow.
 *
 * Listens to `idea-workspace-quick-action` events and dispatches pf_* actions.
 */
import { useEffect, useRef } from 'react';
import type { Node } from 'reactflow';

import { emitQuickActionAck, isQuickActionOutcome, type LaneOpOutcome } from '@/actions/quickActionAck';

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
   * Action Registry — Process Flow TOOLBAR overflow (2026-08-10, N6.4,
   * `idea.ai.pf_process_summary`). DOKŁADNIE ta sama funkcja, którą woła
   * przycisk „Podsumowanie" w menu „Więcej" (`handleProcessSummary` w
   * `IdeaProcessFlowTool.tsx`) — realne AI (`process_summary` generator →
   * `llmService.callStructured`), wynik WYŁĄCZNIE do odczytu (panel), zero
   * mutacji płótna. Jedyny genuinie nowy odbiornik tej fali: analiza
   * (`pf_analyze` → AI Coach) miała już swój od dawna, podsumowanie nie
   * miało ŻADNEGO, mimo że jest tą samą klasą akcji („AI tylko odczyt",
   * rozdz. 09 §6).
   */
  generateSummary?: () => void;
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
   *
   * ★ RISK-30 (S5-TERESA, 2026-08-12) ★ — all six now RETURN a `LaneOpOutcome`
   * instead of `void`. That is the whole fix: previously the handler swallowed
   * its own refusals (`if (locked) return;`, `if (lanes.length <= 1) return;`,
   * unknown `laneId` → silent no-op) and the registry, having no way to see
   * them, answered Teresa `{ ok: true }` for work that never happened. The
   * return value travels back over the ack bus (`src/actions/quickActionAck.ts`).
   *
   * The UI (`LaneSystem.tsx`) passes these same functions as `onRename`/
   * `onDelete`/… props typed `=> void`; TypeScript accepts a value-returning
   * function where `void` is expected, so the component stays UNTOUCHED and
   * the human-visible toast path is unchanged.
   */
  renameLane?: (laneId: string, label: string) => LaneOpOutcome;
  moveLaneUp?: (laneId: string) => LaneOpOutcome;
  moveLaneDown?: (laneId: string) => LaneOpOutcome;
  setLaneColor?: (laneId: string, color: string) => LaneOpOutcome;
  toggleLaneCollapse?: (laneId: string) => LaneOpOutcome;
  deleteLane?: (laneId: string) => LaneOpOutcome;
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

/**
 * RISK-30 (S5-TERESA, 2026-08-12) — jedno miejsce, w którym WSZYSTKIE SZEŚĆ
 * akcji toru wykonuje się i ODPOWIADA na szynie potwierdzeń. Świadomie jedna
 * funkcja, nie sześć kopii: gdyby każdy przypadek miał własne `emitQuickActionAck`,
 * dopisanie siódmej operacji toru bez potwierdzenia byłoby o jedno
 * przeoczenie od powrotu dokładnie tego defektu, który tu zamykamy.
 *
 * Kolejność sprawdzeń jest istotna:
 *   1. brak `laneId` w detalu           → `unknown_lane` (NIGDY milczący sukces),
 *   2. brak wymaganego parametru        → `missing_param`,
 *   3. brak wpiętego handlera           → `no_handler`,
 *   4. handler zwrócił coś, co nie jest `LaneOpOutcome` → `no_handler`
 *      (obrona przed „potwierdzeniem" o nieznanym kształcie — to jest ta sama
 *      klasa błędu co bezwarunkowe `{ ok: true }`, tylko o piętro niżej).
 */
function runLaneOp(
  action: string,
  detail: Record<string, unknown> | undefined,
  handlers: ProcessFlowQuickActionHandlers
): void {
  const ackId = typeof detail?.ackId === 'string' ? detail.ackId : undefined;
  const laneId =
    typeof detail?.laneId === 'string' && detail.laneId ? detail.laneId : undefined;
  if (!laneId) {
    emitQuickActionAck(ackId, { ok: false, reason: 'unknown_lane' });
    return;
  }

  const call = (fn: (() => LaneOpOutcome) | undefined): void => {
    if (!fn) {
      emitQuickActionAck(ackId, { ok: false, reason: 'no_handler' });
      return;
    }
    const outcome = fn();
    emitQuickActionAck(ackId, isQuickActionOutcome(outcome) ? outcome : { ok: false, reason: 'no_handler' });
  };

  if (action === 'pf_lane_rename') {
    const label = typeof detail?.label === 'string' ? detail.label : undefined;
    if (!label) {
      emitQuickActionAck(ackId, { ok: false, reason: 'missing_param' });
      return;
    }
    call(handlers.renameLane && (() => handlers.renameLane!(laneId, label)));
    return;
  }
  if (action === 'pf_lane_color') {
    const color = typeof detail?.color === 'string' ? detail.color : undefined;
    if (!color) {
      emitQuickActionAck(ackId, { ok: false, reason: 'missing_param' });
      return;
    }
    call(handlers.setLaneColor && (() => handlers.setLaneColor!(laneId, color)));
    return;
  }
  if (action === 'pf_lane_move_up') {
    call(handlers.moveLaneUp && (() => handlers.moveLaneUp!(laneId)));
    return;
  }
  if (action === 'pf_lane_move_down') {
    call(handlers.moveLaneDown && (() => handlers.moveLaneDown!(laneId)));
    return;
  }
  if (action === 'pf_lane_toggle_collapse') {
    call(handlers.toggleLaneCollapse && (() => handlers.toggleLaneCollapse!(laneId)));
    return;
  }
  if (action === 'pf_lane_delete') {
    call(handlers.deleteLane && (() => handlers.deleteLane!(laneId)));
  }
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
      if (label) handlers.addNode('action', { label });
      else handlers.addNode('action');
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

    // Action Registry — Process Flow TOOLBAR overflow (2026-08-10, N6.4).
    // `pf_summary` = „Podsumowanie" z menu „Więcej" (realne AI, tylko odczyt —
    // `idea.ai.pf_process_summary` w ideaActionRegistry.ts). Bliźniak
    // `pf_analyze` wyżej, który taki odbiornik miał od dawna.
    if (action === 'pf_summary') {
      handlers.generateSummary?.();
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
    //
    // ★ RISK-30 (S5-TERESA, 2026-08-12): each of the six now ACKS. `runLane`
    // below runs the handler, normalises whatever came back into a
    // `LaneOpOutcome` and answers on the correlated ack bus. `detail.ackId`
    // is absent for any caller that predates this wave — `emitQuickActionAck` is a
    // no-op then, so the old fire-and-forget path is bit-for-bit unchanged.
    if (
      action === 'pf_lane_rename' ||
      action === 'pf_lane_move_up' ||
      action === 'pf_lane_move_down' ||
      action === 'pf_lane_color' ||
      action === 'pf_lane_toggle_collapse' ||
      action === 'pf_lane_delete'
    ) {
      runLaneOp(action, detail, handlers);
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
