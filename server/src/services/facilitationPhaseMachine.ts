/**
 * Facilitation phase state machine (server-side SSOT).
 *
 * T9-1. Mirrors the frontend contract in
 * `src/components/MyWork/whiteboard/whiteboardContracts.ts`:
 *
 *   Lifecycle phases:  start → organize → converge → handoff
 *   Transitions:       start→organize · organize→{converge,start} ·
 *                      converge→{handoff,organize} · handoff→∅
 *
 * IMPORTANT — the `current_phase` column is an OVERLOADED signal bus. Besides the
 * four lifecycle phases above, the live whiteboard client writes transient UI
 * signals through the SAME field via facilitationUpdatePhase():
 *   - 'voting' / 'board'  (toggleSessionVoting)
 *   - 'follow_me' / 'board' (toggleSessionFollow)
 * These are NOT lifecycle steps; they are ephemeral overlays. Enforcing a strict
 * lifecycle transition on every write would therefore break the live board (e.g.
 * organize → voting → converge). So the machine enforces the transition table ONLY
 * when BOTH endpoints are lifecycle phases; any hop touching a signal phase (or a
 * no-op) is allowed. Truly unknown strings are rejected — that is the robustness win.
 *
 * The terminal "closed" state is modelled by the session row's status='ended'
 * (see endFacilitationSession), not by a current_phase value.
 */

export type FacilitationLifecyclePhase = 'start' | 'organize' | 'converge' | 'handoff';
export type FacilitationSignalPhase = 'board' | 'voting' | 'follow_me';
export type FacilitationPhase = FacilitationLifecyclePhase | FacilitationSignalPhase;

export const LIFECYCLE_PHASES: readonly FacilitationLifecyclePhase[] = [
  'start',
  'organize',
  'converge',
  'handoff',
];

export const SIGNAL_PHASES: readonly FacilitationSignalPhase[] = ['board', 'voting', 'follow_me'];

export const ALL_PHASES: readonly FacilitationPhase[] = [...LIFECYCLE_PHASES, ...SIGNAL_PHASES];

export const PHASE_TRANSITIONS: Record<FacilitationLifecyclePhase, FacilitationLifecyclePhase[]> = {
  start: ['organize'],
  organize: ['converge', 'start'],
  converge: ['handoff', 'organize'],
  handoff: [],
};

export function isKnownPhase(phase: unknown): phase is FacilitationPhase {
  return typeof phase === 'string' && (ALL_PHASES as readonly string[]).includes(phase);
}

export function isLifecyclePhase(phase: unknown): phase is FacilitationLifecyclePhase {
  return typeof phase === 'string' && (LIFECYCLE_PHASES as readonly string[]).includes(phase);
}

/**
 * Whether a phase change from `from` to `to` is allowed.
 *
 *  - `to` must be a known phase (unknown → false; caller returns 400).
 *  - No-op (from === to) is always allowed.
 *  - If either endpoint is a signal phase, allow (overlay semantics).
 *  - Initial write (from null/undefined/empty): allow any known phase.
 *  - Otherwise (both lifecycle): `to` must be in PHASE_TRANSITIONS[from].
 */
export function canTransition(from: unknown, to: unknown): boolean {
  if (!isKnownPhase(to)) return false;
  const fromStr = typeof from === 'string' ? from : '';
  if (fromStr === to) return true;
  if (!fromStr) return true; // first assignment on a freshly-created session
  if (!isLifecyclePhase(fromStr) || !isLifecyclePhase(to)) return true; // signal overlay hop
  return PHASE_TRANSITIONS[fromStr].includes(to);
}

/** Thrown by updatePhase when a lifecycle transition is illegal — mapped to HTTP 409. */
export class InvalidPhaseTransitionError extends Error {
  readonly code = 'REALTIME_FACILITATION_PHASE_TRANSITION_INVALID';
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(`Invalid facilitation phase transition: ${from || '(initial)'} → ${to}`);
    this.name = 'InvalidPhaseTransitionError';
    this.from = from;
    this.to = to;
  }
}

/** Thrown by updatePhase when the target phase is not a recognised value — mapped to HTTP 400. */
export class UnknownPhaseError extends Error {
  readonly code = 'REALTIME_FACILITATION_PHASE_UNKNOWN';
  readonly phase: string;
  constructor(phase: string) {
    super(`Unknown facilitation phase: ${phase}`);
    this.name = 'UnknownPhaseError';
    this.phase = phase;
  }
}
