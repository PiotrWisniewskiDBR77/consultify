/**
 * P14 Process Flow Canon
 * Frozen acceptance checklist + rules from §2.3.10
 *
 * Canonical source for process flow semantic object types,
 * BPMN interoperability posture, validation layering,
 * minimal toolbelt, AI proposal contract, anti-duplicate gate,
 * and degraded posture scenarios.
 *
 * Infrastructure consumed:
 *   - toolCollaborationAdapter.ts (ToolName = 'process_flow')
 *   - multiplayerHardening.ts (Surface = 'process_flow')
 *   - ideaWorkspaceGraph.validators.ts (NodeKindEnum process_flow kinds)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Semantic object types (BPMN-adjacent, frozen)
// ────────────────────────────────────────────────────────────────

export const P14_SEMANTIC_OBJECTS = [
  'start_event',
  'end_event',
  'task',
  'decision_gateway',
  'parallel_gateway',
  'subprocess',
  'lane',
  'pool',
  'sequence_flow',
  'message_flow',
  'annotation',
] as const;

export type ProcessFlowSemanticObject = (typeof P14_SEMANTIC_OBJECTS)[number];

export const P14_SEMANTIC_OBJECT_RULES: Record<ProcessFlowSemanticObject, string> = {
  start_event: 'Single entry point per process; thin circle; no incoming flows',
  end_event: 'One or more exit points; bold circle; no outgoing flows',
  task: 'Atomic unit of work; rounded rectangle; has assignee and description',
  decision_gateway: 'Exclusive (XOR) branching; diamond shape; exactly one outgoing path taken',
  parallel_gateway: 'Fork/join for concurrent paths; plus-diamond; all outgoing paths taken',
  subprocess: 'Collapsible container for nested process; rectangle with plus marker',
  lane: 'Horizontal partition within a pool; represents a role or department',
  pool: 'Top-level container; represents an organization or participant',
  sequence_flow: 'Directed edge between objects within the same pool; solid arrow',
  message_flow: 'Communication between pools; dashed arrow; cannot connect within same pool',
  annotation: 'Free text note attached to any object; no flow semantics',
};

export const P14_NODE_KINDS_MAPPING: Record<string, ProcessFlowSemanticObject> = {
  step: 'task',
  decision: 'decision_gateway',
  document: 'annotation',
  data: 'annotation',
  system_block: 'subprocess',
  handoff: 'message_flow',
  lane: 'lane',
  vsm_object: 'task',
};

// ────────────────────────────────────────────────────────────────
// §2.3.10 — BPMN interoperability posture
// ────────────────────────────────────────────────────────────────

export const P14_BPMN_INTEROP_POSTURE = {
  supported: [
    'Visual semantics aligned with BPMN 2.0 (shapes, gateways, lanes, pools)',
    'Export to BPMN XML is a future-wave goal (not P0)',
    'Import from BPMN XML is a future-wave goal (not P0)',
    'Object types are BPMN-adjacent: same concepts, simplified naming',
  ] as const,
  nonGoal: [
    'Full BPMN 2.0 compliance (intermediate events, compensation, signals)',
    'BPMN execution engine (process automation)',
    'BPMN collaboration diagrams (multi-pool choreography)',
    'DMN (Decision Model and Notation) integration',
  ] as const,
  posture: 'BPMN-adjacent for visual modeling; not a BPMN runtime or validator' as const,
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Validation layering (frozen)
// ────────────────────────────────────────────────────────────────

export const P14_VALIDATION_LAYERS = ['semantic_first', 'structural_bounded'] as const;

export type ValidationLayer = (typeof P14_VALIDATION_LAYERS)[number];

export const P14_VALIDATION_RULES = {
  semantic_first: {
    description: 'Validate object type semantics before structural constraints',
    rules: [
      'start_event has no incoming sequence_flow',
      'end_event has no outgoing sequence_flow',
      'message_flow cannot connect objects within the same pool',
      'decision_gateway must have at least 2 outgoing sequence_flows',
      'parallel_gateway fork must have matching join (warning, not error)',
      'Every task must be reachable from a start_event (warning)',
    ] as const,
  },
  structural_bounded: {
    description: 'Bounded structural validation (not full graph analysis)',
    rules: [
      'No orphan nodes (every object connected or annotated)',
      'No duplicate IDs within a process',
      'Lane must be inside a pool',
      'Subprocess can contain nested objects but not pools',
      'Maximum nesting depth: 3 levels (subprocess within subprocess)',
      'Maximum objects per process: 200 (warning at 150)',
    ] as const,
  },
} as const;

/**
 * Validate a semantic rule for a process flow object.
 */
export function validateSemanticRule(
  objectType: ProcessFlowSemanticObject,
  incomingFlows: number,
  outgoingFlows: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (objectType === 'start_event' && incomingFlows > 0) {
    errors.push('start_event must not have incoming sequence flows');
  }
  if (objectType === 'end_event' && outgoingFlows > 0) {
    errors.push('end_event must not have outgoing sequence flows');
  }
  if (objectType === 'decision_gateway' && outgoingFlows < 2) {
    errors.push('decision_gateway must have at least 2 outgoing sequence flows');
  }

  return { valid: errors.length === 0, errors };
}

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Minimal toolbelt (frozen)
// ────────────────────────────────────────────────────────────────

export const P14_TOOLBELT = [
  'select',
  'pan_zoom_fit',
  'add_object',
  'connector',
  'label',
  'lane_pool',
  'auto_layout',
  'undo_redo',
  'export',
  'validate',
] as const;

export type ProcessFlowTool = (typeof P14_TOOLBELT)[number];

export const P14_TOOLBELT_RULES = {
  select: 'Click to select; shift-click multi-select; drag for marquee',
  pan_zoom_fit: 'Pan via middle-click/space+drag; scroll to zoom; fit-all button',
  add_object: 'Palette with all P14_SEMANTIC_OBJECTS; drag-to-canvas or click-to-place',
  connector: 'Draw sequence_flow or message_flow between objects; auto-routing',
  label: 'Add/edit labels on objects and connectors; inline editing',
  lane_pool: 'Add/resize lanes and pools; drag objects between lanes',
  auto_layout: 'Automatic left-to-right or top-to-bottom layout; preserves lane assignments',
  undo_redo: 'All operations undoable/redoable; AI accept is one undo step',
  export: 'Export as PNG or JSON; JSON preserves full semantic model',
  validate: 'Run validation layers and show results inline (errors/warnings on objects)',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — AI proposal contract
// ────────────────────────────────────────────────────────────────

export const P14_AI_PROPOSAL_RULES = {
  textOrDslInput: 'User provides text description or DSL; AI generates process flow objects',
  previewBeforeApply: 'AI-generated objects shown as preview overlay; user reviews before applying',
  explicitApplyReject: 'User must explicitly apply or reject; no silent changes to the canvas',
  undoableAsOneStep: 'Applied AI proposal is a single undo step (atomic batch)',
  proposalAsPersonalDraft:
    'AI proposal starts as personal_draft (W4-7); shared only on explicit share',
  noSilentChanges: 'AI cannot modify existing objects without going through preview→apply flow',
  validationOnApply: 'Semantic validation runs automatically when AI proposal is applied',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P14_ANTI_DUPLICATE_RULES = {
  noParallelProcessModel:
    'Process flow uses CanonicalNode from ideaWorkspaceGraph.validators; no shadow model',
  noParallelCollaboration:
    'Collaboration uses platform toolCollaborationAdapter; no process-flow-specific collab layer',
  noParallelValidation:
    'Validation rules are defined here in canon; no duplicate validation in UI layer',
  noBpmnRuntime: 'Process flow is a visual modeling tool; not a BPMN execution engine',
  singleSemanticTruth: 'P14_SEMANTIC_OBJECTS is the single source of truth for object types',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Degraded posture (10+ scenarios)
// ────────────────────────────────────────────────────────────────

export const P14_DEGRADED_SCENARIOS: ReadonlyArray<{
  scenario: string;
  posture: string;
  recovery: string;
}> = [
  {
    scenario: 'Process data fails to load',
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
    scenario: 'Validation service error',
    posture: 'Validation results unavailable; manual validation badge shows "unknown"',
    recovery: 'Retry validation; allow save without validation (with warning)',
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
    scenario: 'Process exceeds object limit (>200 objects)',
    posture: 'Warning banner; new object creation blocked; existing operations allowed',
    recovery: 'Decompose into subprocesses; archive completed sections',
  },
  {
    scenario: 'WebSocket disconnected (presence lost)',
    posture: 'Presence indicators stale; local edits queued; "offline" badge shown',
    recovery: 'Reconnect with queue-and-merge per offline policy',
  },
  {
    scenario: 'Auto-layout fails (complex graph)',
    posture: 'Layout operation cancelled; objects remain in current positions; error toast',
    recovery: 'Manual layout; simplify graph structure; retry with different layout algorithm',
  },
  {
    scenario: 'Invalid BPMN-adjacent structure detected',
    posture: 'Validation errors shown inline on affected objects; save allowed with warnings',
    recovery: 'Fix structural issues using validation hints; re-run validation',
  },
  {
    scenario: 'Subprocess nesting exceeds depth limit',
    posture: 'New subprocess creation blocked; existing structure preserved; warning shown',
    recovery: 'Flatten nesting by extracting subprocesses to top level',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Acceptance checklist (10 items)
// ────────────────────────────────────────────────────────────────

export const P14_ACCEPTANCE_CHECKLIST: ReadonlyArray<{
  id: string;
  requirement: string;
  testable: boolean;
}> = [
  { id: 'P14-AC-01', requirement: 'Contract approved(scope)', testable: true },
  {
    id: 'P14-AC-02',
    requirement: 'Semantic object types frozen: 11 BPMN-adjacent types with rules',
    testable: true,
  },
  {
    id: 'P14-AC-03',
    requirement: 'BPMN interoperability posture explicit: supported vs non-goal',
    testable: true,
  },
  {
    id: 'P14-AC-04',
    requirement: 'Validation layering frozen: semantic_first + structural_bounded',
    testable: true,
  },
  {
    id: 'P14-AC-05',
    requirement: 'Minimal toolbelt frozen: 10 tools including validate',
    testable: true,
  },
  {
    id: 'P14-AC-06',
    requirement: 'AI proposal: text/DSL→preview→apply/reject; no silent changes',
    testable: true,
  },
  {
    id: 'P14-AC-07',
    requirement: 'Anti-duplicate gate: no parallel model/collaboration/validation',
    testable: true,
  },
  {
    id: 'P14-AC-08',
    requirement: 'Degraded posture covers 10+ scenarios with explicit recovery',
    testable: true,
  },
  {
    id: 'P14-AC-09',
    requirement: 'Evidence ledger filled with commit refs and test counts',
    testable: true,
  },
  { id: 'P14-AC-10', requirement: 'EXECUTION_INDEX updated to reflect P14 status', testable: true },
] as const;

// ────────────────────────────────────────────────────────────────
// Ownership boundary
// ────────────────────────────────────────────────────────────────

export const P14_OWNERSHIP = {
  owner: 'Process Flow Surface (IdeaWorkspace process_flow system)',
  consumers: [
    'IdeaWorkspace SuperCanvas',
    'AI Co-building Pipeline',
    'Export Service',
    'Validation Engine',
  ],
  infrastructure: [
    'toolCollaborationAdapter.ts (process_flow)',
    'multiplayerHardening.ts (process_flow surface)',
    'ideaWorkspaceGraph.validators.ts (process_flow node kinds)',
    'ideaAIGeneratorService.ts (AI proposals)',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// Helpers — toolbelt validation
// ────────────────────────────────────────────────────────────────

/**
 * Validate that a toolbelt action is in the frozen P0 set.
 */
export function isValidProcessFlowTool(action: string): action is ProcessFlowTool {
  return (P14_TOOLBELT as readonly string[]).includes(action);
}

/**
 * Check if a semantic object type is valid.
 */
export function isValidSemanticObject(objectType: string): objectType is ProcessFlowSemanticObject {
  return (P14_SEMANTIC_OBJECTS as readonly string[]).includes(objectType);
}

/**
 * Check if a message_flow connection is valid (must be between different pools).
 */
export function isValidMessageFlow(
  sourcePoolId: string | null,
  targetPoolId: string | null
): { valid: boolean; error?: string } {
  if (!sourcePoolId || !targetPoolId) {
    return { valid: false, error: 'message_flow endpoints must be within pools' };
  }
  if (sourcePoolId === targetPoolId) {
    return { valid: false, error: 'message_flow cannot connect objects within the same pool' };
  }
  return { valid: true };
}
