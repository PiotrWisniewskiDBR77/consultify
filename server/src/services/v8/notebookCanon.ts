/**
 * P07 Final V8 — Notebook canon.
 *
 * §2.3.1 Bounded entry points (capture + open)
 * §2.3.2 Durable identity (note_id) + stable deeplinks
 * §2.3.3 Provenance language (source / user_edit / ai_transform) — no silent loss
 * §2.3.4 Attachment lifecycle (statuses + error taxonomy + retry)
 * §2.3.5 Search baseline (operator-grade, bounded)
 * §2.3.6 Linking + downstream handoff payload (Radar / Inicjatywy / Teresa)
 * §2.3.7 Anti-duplicate gate
 * §2.3.8 Degraded posture (10 scenarios)
 * §2.3.9 Acceptance checklist (11 points)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Bounded entry points (capture + open)
// ────────────────────────────────────────────────────────────────

export const P07_CAPTURE_ENTRIES = {
  create: [
    'my_work_notebook_new',
    'add_to_notebook_from_chat',
    'add_to_notebook_from_inicjatywy',
    'add_to_notebook_from_wdrozenia',
    'add_to_notebook_from_radar',
    'add_to_notebook_from_interview',
    'add_to_notebook_from_tools',
    'web_clipper',
    'email_forward',
    'upload_import',
    'api_import',
  ],
  open: ['notebook_list', 'search_results', 'backlink_context_panel', 'stable_deeplink'],
  forbidden: ['no_top_level_module_outside_my_work', 'no_dead_inbox'],
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Provenance language
// ────────────────────────────────────────────────────────────────

export const P07_PROVENANCE_LANGUAGE = ['source', 'user_edit', 'ai_transform'] as const;
export type P07Provenance = (typeof P07_PROVENANCE_LANGUAGE)[number];

export const P07_PROVENANCE_RULES = {
  no_silent_overwrite: true,
  no_silent_delete: true,
  ai_flow: 'observe -> propose -> review -> accept/reject',
  ai_requires_input_pointers: true,
  ai_requires_audit_trail: true,
  export_preserves_provenance: true,
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Attachment lifecycle
// ────────────────────────────────────────────────────────────────

export const P07_ATTACHMENT_LIFECYCLE_STATES = [
  'queued',
  'uploading',
  'processing',
  'available',
  'failed',
  'blocked_policy',
] as const;
export type P07AttachmentState = (typeof P07_ATTACHMENT_LIFECYCLE_STATES)[number];

export const P07_ATTACHMENT_ERROR_TAXONOMY = {
  network_timeout: { retryable: true, userMessage: 'Network error — retry upload' },
  size_limit: { retryable: false, userMessage: 'File exceeds maximum size limit' },
  quota_exceeded: {
    retryable: false,
    userMessage: 'Storage quota exceeded — free space or upgrade',
  },
  type_unsupported: { retryable: false, userMessage: 'File type not supported' },
  permission_denied: { retryable: false, userMessage: 'Permission denied — contact admin' },
  virus_detected: { retryable: false, userMessage: 'File quarantined — virus detected' },
  storage_unavailable: {
    retryable: true,
    userMessage: 'Storage temporarily unavailable — retry later',
  },
  processing_failed: {
    retryable: true,
    userMessage: 'Processing failed — retry or contact support',
  },
  unknown: { retryable: true, userMessage: 'Unexpected error — retry or contact support' },
} as const;
export type P07AttachmentError = keyof typeof P07_ATTACHMENT_ERROR_TAXONOMY;

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Search baseline
// ────────────────────────────────────────────────────────────────

export const P07_SEARCH_BASELINE = {
  queryParam: 'q',
  declaredFilters: [
    'text',
    'status',
    'maturity',
    'tags',
    'type',
    'owner',
    'visibility',
    'has_attachments',
    'linked_artifact_type',
    'linked_artifact_id',
    'capture_source',
    'date_range',
    'author',
    'attachment_type',
  ],
  operatorHints: [
    'tag:<name>',
    'type:<note_type>',
    'status:<inbox|active|converted|archived>',
    'maturity:<seed|growing|mature|actionable>',
    'owner:<me|user_id>',
    'source:<web_clipper|email_forward|upload|api_import>',
    'has:attachment',
  ],
  resultContract: [
    'note_id',
    'title',
    'snippet',
    'match_kind',
    'updated_at',
    'status',
    'maturity',
    'tags',
    'has_attachments',
    'linked_artifacts_count',
  ],
  antiDuplicate: 'no_search_v2_index',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Handoff targets + required payload
// ────────────────────────────────────────────────────────────────

export const P07_HANDOFF_COMMON_FIELDS = [
  'origin',
  'note_id',
  'note_deeplink',
  'title',
  'summary',
  'tags',
  'status',
  'maturity',
  'note_type',
  'capture_source',
  'capture_metadata',
  'linked_artifacts',
  'attachments',
  'evidence_pointers',
  'uncertainty_boundary',
  'missing_inputs',
  'owner',
  'last_updated_at',
] as const;

export const P07_HANDOFF_TARGETS = {
  radar: {
    module: 'P06',
    requiredFields: [...P07_HANDOFF_COMMON_FIELDS, 'radar_signal_suggestion'],
    signalSuggestionFields: [
      'category',
      'why_now',
      'priority_hint',
      'evidence_pointers',
      'open_questions',
      'missing_inputs',
    ],
  },
  inicjatywy: {
    module: 'P11',
    requiredFields: [...P07_HANDOFF_COMMON_FIELDS, 'initiative_seed'],
    initiativeSeedFields: [
      'problem_statement',
      'proposed_outcome',
      'assumptions',
      'risks',
      'next_steps',
      'time_window',
    ],
  },
  teresa: {
    module: 'P08',
    requiredFields: [...P07_HANDOFF_COMMON_FIELDS, 'assistant_context'],
    assistantContextFields: [
      'user_intent',
      'constraints',
      'do_not_assume',
      'allowed_actions',
      'citations',
    ],
  },
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Anti-duplicate gate
// ────────────────────────────────────────────────────────────────

export const P07_ANTI_DUPLICATE_RULES = {
  no_parallel_attachment_system:
    'Notebook uses one canonical attachment lifecycle — no parallel uploader',
  no_search_v2_index: 'Search uses canonical FTS/embeddings — no parallel index per module',
  no_dead_inbox:
    'No parallel dead inbox — every capture uses status=inbox with immediate next step',
  no_parallel_link_model:
    'No second link representation for note↔artifact — use canonical link_graph_edges',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.8 — Degraded posture (10 scenarios)
// ────────────────────────────────────────────────────────────────

export const P07_DEGRADED_SCENARIOS: ReadonlyArray<{
  id: number;
  scenario: string;
  userVisibleState: string;
  nextAction: string;
}> = [
  {
    id: 1,
    scenario: 'Upload failed: network/timeout',
    userVisibleState: 'failed(network)',
    nextAction: 'CTA "Retry upload" — no loss of file reference',
  },
  {
    id: 2,
    scenario: 'Upload blocked: policy/size/type',
    userVisibleState: 'blocked(policy)',
    nextAction: 'Show reason + "what next" (change file/size/ask admin)',
  },
  {
    id: 3,
    scenario: 'Processing stuck/slow',
    userVisibleState: 'processing',
    nextAction: 'Show progress + "wait / cancel / retry later"',
  },
  {
    id: 4,
    scenario: 'Preview/readback unavailable',
    userVisibleState: 'attachment visible, preview unavailable',
    nextAction: 'Banner "preview unavailable" + download/open externally',
  },
  {
    id: 5,
    scenario: 'Semantic search degraded',
    userVisibleState: 'banner "semantic unavailable"',
    nextAction: 'Fallback to keyword search — no silent "0 results"',
  },
  {
    id: 6,
    scenario: 'Index stale / delayed',
    userVisibleState: 'banner "results may be delayed"',
    nextAction: 'Option to refresh',
  },
  {
    id: 7,
    scenario: 'Deeplink target missing',
    userVisibleState: 'degraded page "note not found / deleted"',
    nextAction: 'Search by id + activity pointers',
  },
  {
    id: 8,
    scenario: 'Link target permission denied',
    userVisibleState: 'link visible, marked degraded(permission)',
    nextAction: 'Instruction "request access / capture context"',
  },
  {
    id: 9,
    scenario: 'Concurrent edit conflict',
    userVisibleState: 'conflict resolution UI (versions)',
    nextAction: 'Explicit conflict resolution — no silent overwrite',
  },
  {
    id: 10,
    scenario: 'AI unavailable',
    userVisibleState: 'AI actions disabled with explanation',
    nextAction: 'User edit and core notebook continue working',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.9 — Acceptance checklist (11 points)
// ────────────────────────────────────────────────────────────────

export const P07_ACCEPTANCE_CHECKLIST = [
  { id: 1, requirement: 'Capture entries bounded and listed (§2.3.1)', section: '§2.3.1' },
  {
    id: 2,
    requirement: 'note_id as durable identity + stable deeplink (§2.3.2)',
    section: '§2.3.2',
  },
  {
    id: 3,
    requirement:
      'Provenance language (source/user_edit/ai_transform) with "no silent loss" (§2.3.3)',
    section: '§2.3.3',
  },
  {
    id: 4,
    requirement: 'Attachment lifecycle with states + error taxonomy + retry (§2.3.4)',
    section: '§2.3.4',
  },
  { id: 5, requirement: 'Search baseline with declared filters (§2.3.5)', section: '§2.3.5' },
  {
    id: 6,
    requirement: 'Linking + handoff payload (Radar/Inicjatywy/Teresa) (§2.3.6)',
    section: '§2.3.6',
  },
  {
    id: 7,
    requirement: 'Anti-duplicate gate (attachments/search/inbox/links) (§2.3.7)',
    section: '§2.3.7',
  },
  { id: 8, requirement: 'Degraded posture (8+ scenarios) (§2.3.8)', section: '§2.3.8' },
  {
    id: 9,
    requirement: 'Non-goals explicit (no Notion DB parity, no new module, no silent AI writing)',
    section: '§2.2',
  },
  { id: 10, requirement: 'No parallel truth vs SSOT', section: '§3' },
  { id: 11, requirement: 'Evidence ledger filled (P07-A commit ref)', section: '§10' },
] as const;

// ────────────────────────────────────────────────────────────────
// Non-goals (explicit)
// ────────────────────────────────────────────────────────────────

export const P07_NON_GOALS = [
  'No Notion "databases-as-product" parity — notebook is durable working memory, not a DB platform',
  'No new top-level module outside My Work — notebook lives under My Work',
  'No silent AI writing — AI must follow observe→propose→review→accept/reject flow',
  'No full Evernote search grammar — bounded operator-grade search with declared filters',
  'No OCR/recognition without explicit scope extension — declared limitation',
] as const;

// ────────────────────────────────────────────────────────────────
// Contract identifier
// ────────────────────────────────────────────────────────────────

export const P07_NOTEBOOK_CANON_CONTRACT = 'notebook_canon_v1';
