/**
 * Method Workspace — shared shell types (A5, 2026-08-13).
 *
 * The shell is DOMAIN-AGNOSTIC: every type here is either taken verbatim from
 * `src/method-core/contracts/` or is presentational-only (view mode, node
 * layout, cell rendering). DRD/SIRI specifics (axis names, level scales,
 * scoring) never appear — they arrive through these same shapes from the
 * caller (A6/A7), which own the domain wiring.
 *
 * Canon:
 *  - ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md §2, §5.1, §7
 *  - ASSESSMENT_UI_NAVIGATION_AND_MATRIX_STANDARD.md §1.1, §2, §3, §6
 *  - ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §3, §4, §5
 *  - TOOL_SESSION_WORKSPACE_STANDARD.md §6.2-6.4, §8
 *  - TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §4, §5
 */

import type {
  AnswerEventPayload,
  EvidenceStrength,
  MethodLevel,
  MethodQuestion,
  MethodReadiness,
  MethodSaveState,
  MethodSession,
  TeresaPreview,
  TeresaProposedChange,
  TeresaStatement,
} from '@/method-core/contracts';

/** Six honest answer states — kanon §4. Identical to the kernel's `AnswerEventPayload`. */
export type MethodAnswerState = AnswerEventPayload['answerState'];

export const METHOD_ANSWER_STATES: readonly MethodAnswerState[] = [
  'confirmed',
  'partial',
  'no',
  'dont_know',
  'no_evidence',
  'not_applicable',
] as const;

/** Three interchangeable presentations of the same session state (UI-NAV §6). */
export type MethodWorkspaceViewMode = 'interview' | 'split' | 'matrix';

/** Evidence rollup used by both the Navigator and the Matrix — UI-NAV §3. */
export type MethodEvidenceState = 'complete' | 'weak' | 'missing' | 'conflicting';

// ---------------------------------------------------------------------------
// Method Navigator (left rail)
// ---------------------------------------------------------------------------

export interface MethodNavigatorNode {
  readonly unitId: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly order: number;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly evidenceState: MethodEvidenceState;
  /** target - current, when both are known. */
  readonly gap: number | null;
  readonly ownerLabel?: string;
  readonly nextAction?: string;
  readonly openQuestionCount: number;
}

// ---------------------------------------------------------------------------
// Interview Focus
// ---------------------------------------------------------------------------

export interface InterviewFocusQuestion {
  readonly question: MethodQuestion;
  readonly answerState: MethodAnswerState | null;
  readonly answerText: string;
  readonly evidenceState: MethodEvidenceState;
  readonly evidenceCount: number;
}

export interface ResolutionCardData {
  readonly questionId: string;
  /** Czego dokładnie nie wiemy. */
  readonly whatIsUnknown: string;
  /** Kto prawdopodobnie posiada wiedzę. */
  readonly likelyOwnerLabel: string | null;
  /** Jaki artefakt może rozstrzygnąć. */
  readonly resolvingArtifactHint: string | null;
  readonly dueDate: string | null;
  /** Czy nierozstrzygnięcie blokuje freeze sesji. */
  readonly blocksFreeze: boolean;
}

export type ResolutionAction = 'assign_question' | 'request_evidence' | 'ask_teresa' | 'return_later';

// ---------------------------------------------------------------------------
// Question help (four levels — HELP §3)
// ---------------------------------------------------------------------------

export interface QuestionHelpContent {
  readonly questionId: string;
  /** Level help needs the full level descriptor for L-1/L/L+1 comparison. */
  readonly levels?: readonly MethodLevel[];
  /** Method help — purpose/how-to-answer copy for the whole unit. */
  readonly methodHelpText?: string;
}

// ---------------------------------------------------------------------------
// Live Matrix
// ---------------------------------------------------------------------------

export interface MatrixCellState {
  readonly unitId: string;
  readonly level: number;
  /** Part of the cumulative ramp 1..currentLevel. */
  readonly achieved: boolean;
  readonly proposed: boolean;
  readonly target: boolean;
  readonly answerState: MethodAnswerState | 'unresolved';
  readonly evidenceState: MethodEvidenceState;
  readonly aiProposalPending: boolean;
  readonly reviewRequired: boolean;
  readonly blocker: boolean;
}

export interface MatrixRow {
  readonly unitId: string;
  readonly unitName: string;
  readonly levels: readonly MatrixCellState[];
}

export interface MatrixSelection {
  readonly unitId: string;
  readonly level: number;
}

// ---------------------------------------------------------------------------
// Teresa panel — six questions (TOOL-SESSION §8)
// ---------------------------------------------------------------------------

export interface TeresaSixQuestions {
  readonly whereAreWe: string;
  readonly whatMattersNow: string;
  readonly why: string;
  readonly whatIsMissing: string;
  readonly nextSafeAction: string;
}

export interface TeresaProposalQueueItem {
  readonly preview: TeresaPreview;
}

// ---------------------------------------------------------------------------
// Save-state hook contract (TOOL-SESSION §6.3)
// ---------------------------------------------------------------------------

export interface MethodWorkspaceSaveOptions {
  readonly debounceMs?: number;
  readonly save: (reason: 'autosave' | 'manual') => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Called on every leave attempt; return false to block the leave. */
  readonly onDirtyBeforeUnload?: () => void;
}

export interface MethodWorkspaceSaveState {
  readonly state: MethodSaveState;
  readonly lastSavedAt: string | null;
  readonly errorMessage: string | null;
}

// Re-exported for consumers that only need the shell-facing surface.
export type { MethodReadiness, MethodSaveState, MethodSession, TeresaProposedChange, TeresaStatement };
