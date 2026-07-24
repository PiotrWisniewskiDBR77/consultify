/**
 * useWhiteboardQuickActions — Extracted quick action handler for the Whiteboard.
 *
 * Listens to `idea-workspace-quick-action` events and dispatches wb_* actions.
 */
import { useEffect, useRef } from 'react';

/**
 * AI facilitation generators reachable from whiteboard quick actions.
 * All map to backend generatorTypes served by POST /my-ideas/:id/ai-generate
 * and flow through the Propose→Accept review (whiteboardCanon AC-05 — no silent apply).
 */
export type WhiteboardAIGeneratorType =
  | 'wb_find_themes'
  | 'wb_name_clusters'
  | 'wb_to_map_branches'
  | 'wb_to_table'
  | 'wb_extract_actions';

const AI_ACTION_MAP: Record<string, WhiteboardAIGeneratorType> = {
  wb_ai_find_themes: 'wb_find_themes',
  wb_ai_name_clusters: 'wb_name_clusters',
  wb_ai_to_map: 'wb_to_map_branches',
  wb_ai_to_table: 'wb_to_table',
  wb_ai_extract_actions: 'wb_extract_actions',
};

export interface WhiteboardQuickActionHandlers {
  addElement: (kind: any, extraData?: Record<string, unknown>) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  distributeNodes: (axis: 'horizontal' | 'vertical') => void;
  setMode?: (mode: 'board' | 'draw') => void;
  /**
   * Z1 (rozdz. 06 §3): tryb kursora płótna z lewego raila. Rail wysyła
   * `mm_select_mode` / `mm_pan_mode` (nazwy historyczne — obsługuje je też
   * IdeaMapWorkspace, którego nie ruszamy). Do 2026-07-23 Tablica ich NIE
   * słuchała, więc pstryczek raila zmieniał tylko własną ikonę.
   */
  setCursorMode?: (mode: 'select' | 'pan') => void;
  cycleSessionRole?: () => void;
  toggleSessionTimer?: () => void;
  toggleSessionVoting?: () => void;
  toggleSessionFollow?: () => void;
  toggleSpotlightSelection?: () => void;
  importOutline?: () => void;
  saveSelectionToLibrary?: () => void;
  insertLatestLibraryItem?: () => void;
  restoreLatestHistory?: () => void;
  cycleGovernance?: () => void;
  undo?: () => void;
  redo?: () => void;
  /** Runs an AI generator (preview→apply via IdeaProposalReview; never applies silently). */
  runAIAction?: (generatorType: WhiteboardAIGeneratorType) => void;
}

export interface UseWhiteboardQuickActionsOpts {
  open: boolean;
  handlers: WhiteboardQuickActionHandlers;
}

export function useWhiteboardQuickActions(opts: UseWhiteboardQuickActionsOpts): void {
  const { open, handlers } = opts;

  const quickActionRef = useRef<(action: string) => void>(() => {});

  quickActionRef.current = (action: string) => {
    if (action === 'wb_add_sticky') handlers.addElement('sticky');
    if (action === 'wb_add_text') handlers.addElement('text');
    if (action === 'wb_add_group') handlers.addElement('group');
    if (action === 'wb_add_shape_rectangle') handlers.addElement('shape_rectangle');
    if (action === 'wb_add_shape_circle') handlers.addElement('shape_circle');
    if (action === 'wb_add_shape_diamond') handlers.addElement('shape_diamond');
    if (action === 'wb_add_shape_hexagon') handlers.addElement('shape_hexagon');
    if (action === 'wb_add_frame') handlers.addElement('frame');
    if (action === 'wb_add_area')
      handlers.addElement('frame', {
        semanticType: 'area',
        label: 'Area',
        bgColor: 'rgba(59, 130, 246, 0.08)',
      });
    if (action === 'wb_add_table')
      handlers.addElement('summary', {
        semanticType: 'table',
        label: 'Table block',
        variant: 'table',
      });
    if (action === 'wb_add_icon_star')
      handlers.addElement('text', { semanticType: 'icon', label: '★', fontSize: 36 });
    if (action === 'wb_add_icon_check')
      handlers.addElement('text', { semanticType: 'icon', label: '✓', fontSize: 36 });
    if (action === 'wb_add_icon_alert')
      handlers.addElement('text', { semanticType: 'icon', label: '!', fontSize: 36 });
    if (action === 'wb_add_image') handlers.addElement('image');
    if (action === 'wb_add_link') handlers.addElement('link');
    if (action === 'wb_add_cluster')
      handlers.addElement('frame', {
        semanticType: 'cluster',
        label: 'Cluster',
        bgColor: 'rgba(139, 92, 246, 0.08)',
      });
    if (action === 'wb_add_theme')
      handlers.addElement('summary', { semanticType: 'theme', label: 'Theme' });
    if (action === 'wb_add_outcome')
      handlers.addElement('summary', { semanticType: 'outcome', label: 'Outcome' });
    if (action === 'wb_add_decision')
      handlers.addElement('text', { semanticType: 'decision', label: 'Decision' });
    if (action === 'wb_add_action')
      handlers.addElement('sticky', { semanticType: 'action', label: 'Action' });
    if (action === 'wb_duplicate') handlers.duplicateSelected();
    if (action === 'wb_ungroup') handlers.ungroupSelected();
    if (action === 'wb_delete') handlers.deleteSelected();
    if (action === 'wb_undo') handlers.undo?.();
    if (action === 'wb_redo') handlers.redo?.();
    if (action === 'wb_mode_board') handlers.setMode?.('board');
    if (action === 'wb_mode_draw') handlers.setMode?.('draw');

    // Z1 — tryb kursora z lewego raila (ten sam pstryczek co w Mapie myśli).
    if (action === 'mm_select_mode') handlers.setCursorMode?.('select');
    if (action === 'mm_pan_mode') handlers.setCursorMode?.('pan');
    if (action === 'wb_session_cycle_role') handlers.cycleSessionRole?.();
    if (action === 'wb_session_toggle_timer') handlers.toggleSessionTimer?.();
    if (action === 'wb_session_toggle_voting') handlers.toggleSessionVoting?.();
    if (action === 'wb_session_toggle_follow') handlers.toggleSessionFollow?.();
    if (action === 'wb_session_toggle_spotlight') handlers.toggleSpotlightSelection?.();
    if (action === 'wb_import_outline') handlers.importOutline?.();
    if (action === 'wb_library_save_selection') handlers.saveSelectionToLibrary?.();
    if (action === 'wb_library_insert_last') handlers.insertLatestLibraryItem?.();
    if (action === 'wb_history_restore_latest') handlers.restoreLatestHistory?.();
    if (action === 'wb_governance_cycle') handlers.cycleGovernance?.();

    // AI facilitation quick actions → generate→preview→apply flow
    const aiGeneratorType = AI_ACTION_MAP[action];
    if (aiGeneratorType) handlers.runAIAction?.(aiGeneratorType);

    // Convert actions are forwarded back to the workspace event bus
    // so handleQuickAction's CONVERT_PREFIX_MAP can route them
    if (action === 'wb_convert_decision' || action === 'wb_convert_action') {
      return;
    }
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
