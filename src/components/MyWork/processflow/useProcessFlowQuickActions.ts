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

    if (action === 'pf_undo') handlers.undo();
    if (action === 'pf_redo') handlers.redo();
    if (action === 'pf_delete') handlers.deleteSelected();
    if (action === 'pf_duplicate') handlers.duplicateSelected();
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
