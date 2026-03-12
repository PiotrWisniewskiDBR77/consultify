/**
 * useProcessFlowQuickActions — Extracted quick action handler for Process Flow.
 *
 * Listens to `idea-workspace-quick-action` events and dispatches pf_* actions.
 */
import { useEffect, useRef } from 'react';
import type { Node } from 'reactflow';

export interface ProcessFlowQuickActionHandlers {
  addNode: (shape: any) => void;
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

  const quickActionRef = useRef<(action: string) => void>(() => {});

  quickActionRef.current = (action: string) => {
    if (action === 'pf_add_action') handlers.addNode('action');
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

    if (action === 'pf_undo') handlers.undo();
    if (action === 'pf_redo') handlers.redo();
    if (action === 'pf_delete') handlers.deleteSelected();
    if (action === 'pf_duplicate') handlers.duplicateSelected();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) quickActionRef.current(detail.action);
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [open]);
}
