/**
 * P13 Whiteboard Canon
 * Frozen acceptance checklist + rules from §2.3.8
 *
 * Canonical source for whiteboard toolbelt, facilitation flow,
 * export/readback assumptions, collaboration boundary,
 * AI co-building contract, anti-duplicate gate, and degraded posture.
 *
 * Infrastructure consumed:
 *   - toolCollaborationAdapter.ts (ToolName = 'whiteboard')
 *   - multiplayerHardening.ts (Surface = 'whiteboard', FacilitationSession)
 *   - ideaWorkspaceGraph.validators.ts (NodeKindEnum whiteboard kinds)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Minimal toolbelt (frozen P0)
// ────────────────────────────────────────────────────────────────

export const P13_TOOLBELT = [
  'select',
  'pan_zoom_fit',
  'sticky',
  'shape',
  'text',
  'group_ungroup',
  'align_distribute',
  'undo_redo',
  'export',
] as const;

export type WhiteboardTool = (typeof P13_TOOLBELT)[number];

export const P13_TOOLBELT_RULES = {
  select: 'Single-click selects object; shift-click multi-select; drag for marquee selection',
  pan_zoom_fit: 'Pan via middle-click/space+drag; scroll to zoom; fit-all button resets viewport',
  sticky: 'Create sticky note at click position; default color; inline text editing',
  shape: 'Rectangle, ellipse, diamond, arrow; resize handles; snap-to-grid optional',
  text: 'Free text block; font size auto-scales; supports basic formatting (bold/italic)',
  group_ungroup: 'Group selected objects; ungroup restores individual objects; nested groups allowed',
  align_distribute: 'Align left/center/right/top/middle/bottom; distribute horizontal/vertical evenly',
  undo_redo: 'All toolbelt operations are undoable/redoable; AI accept is one undo step',
  export: 'Export as PNG (raster) or JSON (structured); PNG respects current viewport',
} as const;

export const P13_WHITEBOARD_NODE_KINDS = [
  'sticky',
  'text',
  'shape',
  'frame',
  'image',
  'drawing',
] as const;

export type WhiteboardNodeKind = (typeof P13_WHITEBOARD_NODE_KINDS)[number];

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Facilitation flow (cues)
// ────────────────────────────────────────────────────────────────

export const P13_FACILITATION_FLOW = ['start', 'organize', 'converge', 'handoff'] as const;

export type FacilitationPhase = (typeof P13_FACILITATION_FLOW)[number];

export const P13_FACILITATION_RULES: Record<FacilitationPhase, string> = {
  start: 'Open canvas; participants add stickies freely; timer optional; no structure enforced',
  organize: 'Facilitator groups/clusters stickies; participants can still add but grouping is guided',
  converge: 'Voting/dot-voting on clusters; facilitator highlights top themes; editing restricted to facilitator',
  handoff: 'Summary generated; action items extracted; export triggered; session ends with artifact',
};

export const P13_FACILITATION_TRANSITIONS: Record<FacilitationPhase, FacilitationPhase[]> = {
  start: ['organize'],
  organize: ['converge', 'start'],
  converge: ['handoff', 'organize'],
  handoff: [],
};

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Export/readback assumptions (frozen)
// ────────────────────────────────────────────────────────────────

export const P13_EXPORT_ASSUMPTIONS = {
  formats: ['png', 'json'] as const,
  pngRules: 'Raster export of current viewport at 2x resolution; transparent background optional',
  jsonRules: 'Full object graph with positions, styles, groups, and metadata; round-trip safe',
  readbackContract: 'JSON import must produce visually identical canvas; unknown properties preserved',
  noSvgInP0: 'SVG export is non-goal for P0; may be added in future wave',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Collaboration boundary (explicit)
// ────────────────────────────────────────────────────────────────

export const P13_COLLABORATION_BOUNDARY = {
  roomGranularity: 'per_workspace' as const,
  surfaceAware: true,
  lockType: 'advisory_object' as const,
  presenceTypes: ['cursor', 'selection', 'editing'] as const,
  facilitationRequired: false,
  facilitationSupported: true,
  offlinePolicy: 'queue_and_merge' as const,
  maxConcurrentEditors: 8,
  conflictResolution: 'last-write-wins for position; merge for content; facilitator override in facilitated mode',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — AI co-building contract
// ────────────────────────────────────────────────────────────────

export const P13_AI_COBUILDING_RULES = {
  generatePreviewApply: 'AI generates objects → shown as preview overlay → user applies or rejects',
  noSilentApply: 'AI cannot add/modify/delete objects without explicit user confirmation',
  proposalAsPersonalDraft: 'AI proposal starts as personal_draft (W4-7); visible only to requester until shared',
  undoableAsOneStep: 'Applied AI proposal is a single undo step (atomic batch)',
  scopeBounded: 'AI proposals are bounded to the current canvas; no cross-workspace mutations',
  facilitationAware: 'In facilitated mode, AI proposals require facilitator approval before apply',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P13_ANTI_DUPLICATE_RULES = {
  noParallelCanvas: 'Whiteboard is a surface within IdeaWorkspace; no standalone whiteboard entity',
  noParallelObjectModel: 'Whiteboard objects use CanonicalNode from ideaWorkspaceGraph.validators; no shadow model',
  noParallelCollaboration: 'Collaboration uses platform toolCollaborationAdapter; no whiteboard-specific collab layer',
  noExportOnlySync: 'Export does not pretend to be sync; import is explicit user action',
  singleFacilitationSession: 'Only one active facilitation session per room at a time',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Degraded posture (8+ scenarios)
// ────────────────────────────────────────────────────────────────

export const P13_DEGRADED_SCENARIOS: ReadonlyArray<{
  scenario: string;
  posture: string;
  recovery: string;
}> = [
  {
    scenario: 'Canvas data fails to load',
    posture: 'Empty canvas with retry prompt; no stale objects shown',
    recovery: 'Retry with exponential backoff; show last-known snapshot if available',
  },
  {
    scenario: 'Concurrent edit conflict (multiplayer)',
    posture: 'Conflict marker on affected objects; editing paused on conflicting objects',
    recovery: 'Manual merge or accept-theirs/accept-mine per object',
  },
  {
    scenario: 'AI service unavailable',
    posture: 'AI generate button disabled with tooltip; manual editing unaffected',
    recovery: 'Automatic retry on service recovery',
  },
  {
    scenario: 'Facilitator disconnected mid-session',
    posture: 'Session paused (paused_degraded); participants see "facilitator disconnected" banner',
    recovery: 'Facilitator reconnects → session resumes; or another user takes over facilitator role',
  },
  {
    scenario: 'Export fails (rendering error)',
    posture: 'Toast error; partial export not offered',
    recovery: 'Retry; suggest JSON export if PNG rendering fails',
  },
  {
    scenario: 'Permission denied (read-only artifact)',
    posture: 'All mutation tools disabled; view-only mode with badge',
    recovery: 'Request access or wait for lock release',
  },
  {
    scenario: 'Canvas exceeds object limit (>200 objects)',
    posture: 'Warning banner; new object creation blocked; existing operations allowed',
    recovery: 'Archive objects or split into sub-canvases',
  },
  {
    scenario: 'WebSocket disconnected (presence lost)',
    posture: 'Presence indicators stale; local edits queued; "offline" badge shown',
    recovery: 'Reconnect with queue-and-merge per offline policy',
  },
  {
    scenario: 'Facilitation session ended unexpectedly',
    posture: 'Session marked as ended; no further phase transitions; canvas remains editable',
    recovery: 'Start a new facilitation session if needed',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Acceptance checklist (10 items)
// ────────────────────────────────────────────────────────────────

export const P13_ACCEPTANCE_CHECKLIST: ReadonlyArray<{
  id: string;
  requirement: string;
  testable: boolean;
}> = [
  { id: 'P13-AC-01', requirement: 'Minimal toolbelt frozen: select, pan/zoom/fit, sticky, shape, text, group/ungroup, align, undo/redo, export', testable: true },
  { id: 'P13-AC-02', requirement: 'Facilitation cues: Start→Organize→Converge→Handoff with valid transitions', testable: true },
  { id: 'P13-AC-03', requirement: 'Export/readback assumptions frozen: PNG + JSON; round-trip safe', testable: true },
  { id: 'P13-AC-04', requirement: 'Collaboration boundary explicit: room granularity, lock type, presence, offline policy', testable: true },
  { id: 'P13-AC-05', requirement: 'AI co-building: generate→preview→apply/reject; no silent apply', testable: true },
  { id: 'P13-AC-06', requirement: 'Anti-duplicate gate: no parallel canvas/object model/collaboration layer', testable: true },
  { id: 'P13-AC-07', requirement: 'Degraded posture covers 8+ scenarios with explicit recovery', testable: true },
  { id: 'P13-AC-08', requirement: 'Contract status approved(scope)', testable: true },
  { id: 'P13-AC-09', requirement: 'EXECUTION_INDEX updated to reflect P13 status', testable: true },
  { id: 'P13-AC-10', requirement: 'Evidence ledger filled with commit refs and test counts', testable: true },
] as const;

// ────────────────────────────────────────────────────────────────
// Ownership boundary
// ────────────────────────────────────────────────────────────────

export const P13_OWNERSHIP = {
  owner: 'Whiteboard Surface (IdeaWorkspace whiteboard system)',
  consumers: ['IdeaWorkspace SuperCanvas', 'Facilitation Engine', 'AI Co-building Pipeline', 'Export Service'],
  infrastructure: [
    'toolCollaborationAdapter.ts (whiteboard)',
    'multiplayerHardening.ts (whiteboard surface + FacilitationSession)',
    'ideaWorkspaceGraph.validators.ts (whiteboard node kinds)',
    'ideaAIGeneratorService.ts (AI proposals)',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// Helpers — facilitation phase validation
// ────────────────────────────────────────────────────────────────

/**
 * Check if a facilitation phase transition is valid.
 */
export function isValidFacilitationTransition(
  from: FacilitationPhase,
  to: FacilitationPhase
): boolean {
  return P13_FACILITATION_TRANSITIONS[from].includes(to);
}

/**
 * Check if a facilitation phase is terminal (no further transitions).
 */
export function isFacilitationTerminal(phase: FacilitationPhase): boolean {
  return P13_FACILITATION_TRANSITIONS[phase].length === 0;
}

/**
 * Validate that a toolbelt action is in the frozen P0 set.
 */
export function isValidToolbeltAction(action: string): action is WhiteboardTool {
  return (P13_TOOLBELT as readonly string[]).includes(action);
}
