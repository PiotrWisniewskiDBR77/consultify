export type WhiteboardControlSurface = 'global' | 'system' | 'selection' | 'tools_panel';

export type WhiteboardSemanticType =
  | 'note'
  | 'cluster'
  | 'theme'
  | 'outcome'
  | 'decision'
  | 'action'
  | 'area'
  | 'table'
  | 'icon'
  | 'image'
  | 'link'
  | 'metric';

export type WhiteboardRole = 'facilitator' | 'participant' | 'observer';
export type WhiteboardMode = 'board' | 'draw';
export type WhiteboardClassification = 'internal' | 'confidential' | 'restricted';

export interface WhiteboardVoteEntry {
  nodeId: string;
  userId: string;
  timestamp: number;
}

export interface WhiteboardPresenceState {
  role: WhiteboardRole;
  followMe: boolean;
  spotlightNodeId: string | null;
}

export type FacilitationPhase = 'start' | 'organize' | 'converge' | 'handoff';

export const FACILITATION_PHASES: readonly FacilitationPhase[] = [
  'start',
  'organize',
  'converge',
  'handoff',
];

export const FACILITATION_TRANSITIONS: Record<FacilitationPhase, FacilitationPhase[]> = {
  start: ['organize'],
  organize: ['converge', 'start'],
  converge: ['handoff', 'organize'],
  handoff: [],
};

export interface WhiteboardSessionState {
  active: boolean;
  role: WhiteboardRole;
  sessionId?: string | null;
  toolSessionId?: string | null;
  timerSeconds: number;
  timerEndsAt: number | null;
  votingOpen: boolean;
  followMe: boolean;
  spotlightNodeId: string | null;
  reactionsEnabled: boolean;
  facilitationPhase: FacilitationPhase;
  updatedAt: number;
}

export interface WhiteboardOutcomeRecord {
  id: string;
  type: Extract<WhiteboardSemanticType, 'cluster' | 'theme' | 'outcome' | 'decision' | 'action'>;
  title: string;
  nodeId: string;
  sourceNodeIds: string[];
  exportedToType?: string;
  exportedToId?: string;
  linkedOutcomeId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WhiteboardLibraryItem {
  id: string;
  name: string;
  createdAt: number;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

export interface WhiteboardActivityEntry {
  id: string;
  type:
    | 'create'
    | 'update'
    | 'delete'
    | 'group'
    | 'ungroup'
    | 'vote'
    | 'session'
    | 'library'
    | 'import'
    | 'history'
    | 'governance'
    | 'ai';
  label: string;
  nodeIds?: string[];
  actorId?: string;
  createdAt: number;
}

export interface WhiteboardHistoryEntry {
  id: string;
  label: string;
  createdAt: number;
}

export interface WhiteboardSharePolicy {
  classification: WhiteboardClassification;
  watermark: string;
  exportAllowed: boolean;
  shareAllowed: boolean;
}

export interface WhiteboardActionDefinition {
  id: string;
  surface: WhiteboardControlSurface;
  label: string;
}

export const WHITEBOARD_ACTIONS: Record<string, WhiteboardActionDefinition> = {
  wb_add_sticky: { id: 'wb_add_sticky', surface: 'tools_panel', label: 'Create sticky' },
  wb_add_text: { id: 'wb_add_text', surface: 'tools_panel', label: 'Create text' },
  wb_add_frame: { id: 'wb_add_frame', surface: 'tools_panel', label: 'Create frame' },
  wb_add_area: { id: 'wb_add_area', surface: 'tools_panel', label: 'Create area' },
  wb_add_table: { id: 'wb_add_table', surface: 'tools_panel', label: 'Create table block' },
  wb_add_icon_star: { id: 'wb_add_icon_star', surface: 'tools_panel', label: 'Create star icon' },
  wb_add_icon_check: {
    id: 'wb_add_icon_check',
    surface: 'tools_panel',
    label: 'Create check icon',
  },
  wb_add_icon_alert: {
    id: 'wb_add_icon_alert',
    surface: 'tools_panel',
    label: 'Create alert icon',
  },
  wb_add_cluster: { id: 'wb_add_cluster', surface: 'tools_panel', label: 'Create cluster' },
  wb_add_theme: { id: 'wb_add_theme', surface: 'tools_panel', label: 'Create theme' },
  wb_add_outcome: { id: 'wb_add_outcome', surface: 'tools_panel', label: 'Create outcome' },
  wb_add_decision: { id: 'wb_add_decision', surface: 'tools_panel', label: 'Create decision' },
  wb_add_action: { id: 'wb_add_action', surface: 'tools_panel', label: 'Create action extract' },
  wb_import_outline: { id: 'wb_import_outline', surface: 'tools_panel', label: 'Import outline' },
  wb_library_save_selection: {
    id: 'wb_library_save_selection',
    surface: 'selection',
    label: 'Save selection to library',
  },
  wb_library_insert_last: {
    id: 'wb_library_insert_last',
    surface: 'tools_panel',
    label: 'Insert latest library item',
  },
  wb_mode_board: { id: 'wb_mode_board', surface: 'system', label: 'Switch to board mode' },
  wb_mode_draw: { id: 'wb_mode_draw', surface: 'system', label: 'Switch to draw mode' },
  wb_session_cycle_role: {
    id: 'wb_session_cycle_role',
    surface: 'system',
    label: 'Cycle session role',
  },
  wb_session_toggle_timer: {
    id: 'wb_session_toggle_timer',
    surface: 'system',
    label: 'Toggle timer',
  },
  wb_session_toggle_voting: {
    id: 'wb_session_toggle_voting',
    surface: 'system',
    label: 'Toggle voting',
  },
  wb_session_toggle_follow: {
    id: 'wb_session_toggle_follow',
    surface: 'system',
    label: 'Toggle follow-me',
  },
  wb_session_toggle_spotlight: {
    id: 'wb_session_toggle_spotlight',
    surface: 'selection',
    label: 'Toggle spotlight',
  },
  wb_history_restore_latest: {
    id: 'wb_history_restore_latest',
    surface: 'system',
    label: 'Restore latest snapshot',
  },
  wb_undo: { id: 'wb_undo', surface: 'system', label: 'Undo whiteboard change' },
  wb_redo: { id: 'wb_redo', surface: 'system', label: 'Redo whiteboard change' },
  wb_convert_decision: {
    id: 'wb_convert_decision',
    surface: 'tools_panel',
    label: 'Convert selection to decision',
  },
  wb_governance_cycle: {
    id: 'wb_governance_cycle',
    surface: 'system',
    label: 'Cycle governance level',
  },
  // V51-05: AI facilitation quick actions (generate→preview→apply, AC-05)
  wb_ai_find_themes: { id: 'wb_ai_find_themes', surface: 'tools_panel', label: 'AI: find themes' },
  wb_ai_name_clusters: {
    id: 'wb_ai_name_clusters',
    surface: 'tools_panel',
    label: 'AI: name clusters',
  },
  wb_ai_extract_actions: {
    id: 'wb_ai_extract_actions',
    surface: 'tools_panel',
    label: 'AI: extract action items',
  },
  wb_ai_to_map: {
    id: 'wb_ai_to_map',
    surface: 'tools_panel',
    label: 'AI: convert board to mind map (cross-tool preview)',
  },
  wb_ai_to_table: {
    id: 'wb_ai_to_table',
    surface: 'tools_panel',
    label: 'AI: convert board to table (cross-tool preview)',
  },
  wb_ai_summarize: {
    id: 'wb_ai_summarize',
    surface: 'tools_panel',
    label: 'AI: summarize stickies',
  },
};

const SEMANTIC_TYPE_LABELS: Record<WhiteboardSemanticType, { en: string; pl: string }> = {
  note: { en: 'Note', pl: 'Notatka' },
  cluster: { en: 'Cluster', pl: 'Klaster' },
  theme: { en: 'Theme', pl: 'Temat' },
  outcome: { en: 'Outcome', pl: 'Wynik' },
  decision: { en: 'Decision', pl: 'Decyzja' },
  action: { en: 'Action', pl: 'Akcja' },
  area: { en: 'Area', pl: 'Obszar' },
  table: { en: 'Table', pl: 'Tabela' },
  icon: { en: 'Icon', pl: 'Ikona' },
  image: { en: 'Image', pl: 'Obraz' },
  link: { en: 'Link', pl: 'Link' },
  metric: { en: 'Metric', pl: 'Metryka' },
};

export function getSemanticTypeLabel(
  semanticType: WhiteboardSemanticType | undefined,
  isPolish: boolean
): string | undefined {
  if (!semanticType) return undefined;
  const labels = SEMANTIC_TYPE_LABELS[semanticType];
  return labels ? (isPolish ? labels.pl : labels.en) : undefined;
}

export function inferWhiteboardSemanticType(node: {
  type?: string;
  data?: { semanticType?: unknown };
}): WhiteboardSemanticType {
  const explicit = node.data?.semanticType;
  if (typeof explicit === 'string' && explicit in SEMANTIC_TYPE_LABELS) {
    return explicit as WhiteboardSemanticType;
  }
  switch (node.type) {
    case 'stickyNote':
      return 'note';
    case 'imageNode':
      return 'image';
    case 'linkNode':
      return 'link';
    case 'summaryCard':
      return 'outcome';
    case 'kpiBadge':
    case 'scoreNode':
    case 'progressNode':
      return 'metric';
    case 'frameNode':
      return 'area';
    default:
      return 'note';
  }
}

export function createWhiteboardActivityEntry(
  type: WhiteboardActivityEntry['type'],
  label: string,
  actorId?: string,
  nodeIds?: string[]
): WhiteboardActivityEntry {
  return {
    id: `wb-activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    label,
    actorId,
    nodeIds,
    createdAt: Date.now(),
  };
}

export function createWhiteboardHistoryEntry(label: string): WhiteboardHistoryEntry {
  return {
    id: `wb-history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    createdAt: Date.now(),
  };
}

export function cycleWhiteboardRole(role: WhiteboardRole): WhiteboardRole {
  if (role === 'facilitator') return 'participant';
  if (role === 'participant') return 'observer';
  return 'facilitator';
}

export function cycleWhiteboardClassification(
  classification: WhiteboardClassification
): WhiteboardClassification {
  if (classification === 'internal') return 'confidential';
  if (classification === 'confidential') return 'restricted';
  return 'internal';
}
