/**
 * Shared test fixtures for the Method Workspace shell. Deliberately generic
 * (no DRD/SIRI naming) — the shell is method-agnostic and its tests must stay
 * that way too.
 */
import type {
  MethodQuestion,
  MethodReadiness,
  MethodSession,
  TeresaPreview,
} from '@/method-core/contracts';

import type { InterviewFocusQuestion, MatrixRow, ResolutionCardData } from '../types';

export function makeQuestion(overrides: Partial<MethodQuestion> = {}): MethodQuestion {
  return {
    questionId: 'q-1',
    unitId: 'unit-1',
    level: 2,
    canonicalWording: 'Czy proces jest udokumentowany?',
    intent: 'Sprawdzenie formalizacji procesu.',
    plainLanguageExplanation: 'Chodzi o to, czy istnieje spisany opis kroków procesu.',
    whyItMatters: 'Bez dokumentacji wiedza zależy od jednej osoby.',
    glossaryRefs: [],
    positiveAnswerExample: 'Mamy spisaną procedurę w repozytorium.',
    partialAnswerExample: 'Część kroków jest opisana w mailach.',
    negativeAnswerExample: 'Nikt tego nie spisał.',
    expectedEvidence: ['Dokument procedury', 'Link do repozytorium'],
    likelyRespondentRoles: ['process_owner'],
    followUpQuestionIds: [],
    commonMisunderstanding: 'Dokumentacja techniczna narzędzia to nie to samo co opis procesu.',
    allowedTeresaCapabilities: ['explain_question_plainly'],
    sourceRefs: [],
    ...overrides,
  };
}

export function makeSession(overrides: Partial<MethodSession> = {}): MethodSession {
  return {
    id: 'session-0001',
    organizationId: 'org-1',
    projectId: 'project-1',
    module: 'assessment',
    methodPackId: 'method-pack-x',
    methodPackVersion: '1.0.0',
    state: 'active',
    domainStage: 'In interview',
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

export function makeReadiness(overrides: Partial<MethodReadiness> = {}): MethodReadiness {
  return {
    answeredUnits: 12,
    totalUnits: 39,
    unitsMissingEvidence: 3,
    openDiscrepancies: 1,
    pendingProposals: 2,
    freezeBlockers: [],
    ...overrides,
  };
}

export function makeResolutionData(overrides: Partial<ResolutionCardData> = {}): ResolutionCardData {
  return {
    questionId: 'q-1',
    whatIsUnknown: 'Czy proces ma właściciela.',
    likelyOwnerLabel: 'Kierownik operacji',
    resolvingArtifactHint: 'Schemat organizacyjny',
    dueDate: null,
    blocksFreeze: false,
    ...overrides,
  };
}

export function makeInterviewFocusQuestion(
  overrides: Partial<InterviewFocusQuestion> = {}
): InterviewFocusQuestion {
  return {
    question: makeQuestion(),
    answerState: null,
    answerText: '',
    evidenceState: 'missing',
    evidenceCount: 0,
    ...overrides,
  };
}

export function makeTeresaPreview(overrides: Partial<TeresaPreview> = {}): TeresaPreview {
  return {
    previewId: 'preview-1',
    intent: {
      capabilityId: 'draft_score_proposal',
      sessionId: 'session-0001',
      unitId: 'unit-1',
      invokedBy: 'local_action',
      actorUserId: 'user-1',
    },
    statements: [
      { kind: 'confirmed_fact', text: 'Proces jest opisany w repozytorium.', sourceRefs: [] },
      { kind: 'missing_evidence', text: 'Brak dowodu na regularne przeglądy.', sourceRefs: [] },
    ],
    proposedChanges: [{ target: 'score_proposal', targetId: 'unit-1', before: null, after: 2 }],
    quality: { verdict: 'valid', failedChecks: [] },
    createdAt: '2026-08-13T09:00:00.000Z',
    expiresAt: '2026-08-13T11:00:00.000Z',
    ...overrides,
  };
}

export function makeMatrixRow(overrides: Partial<MatrixRow> = {}): MatrixRow {
  return {
    unitId: 'unit-1',
    unitName: 'Strategia i governance',
    levels: [1, 2, 3, 4].map((level) => ({
      unitId: 'unit-1',
      level,
      achieved: level <= 2,
      proposed: level === 3,
      target: level === 4,
      answerState: level <= 2 ? 'confirmed' : 'unresolved',
      evidenceState: level <= 2 ? 'complete' : 'missing',
      aiProposalPending: level === 3,
      reviewRequired: false,
      blocker: false,
    })),
    ...overrides,
  };
}
