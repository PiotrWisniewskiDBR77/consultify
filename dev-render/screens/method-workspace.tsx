/**
 * Dev-render host for the A5 Method Workspace shell
 * (`src/components/method-workspace/MethodWorkspaceShell.tsx`), mounted with
 * realistic-looking MOCK data — no login, no backend. Required per
 * CLAUDE.md #7: the supervisor renders and screenshots the real component
 * before the owner ever sees it.
 *
 * The shell is domain-agnostic (DRD/SIRI-neutral); this harness uses a
 * generic placeholder method ("Diagnostyka gotowości — DEMO") purely to
 * exercise the UI, not real method content.
 *
 * URL: ?screen=method-workspace
 *   &view=interview|split|matrix        (default interview)
 *   &state=default|resolution|savefailed|teresaRich
 *   &theme=light|dark
 */
import React, { useState } from 'react';

import { MethodWorkspaceShell } from '../../src/components/method-workspace/MethodWorkspaceShell';
import type {
  InterviewFocusQuestion,
  MatrixRow,
  MethodNavigatorNode,
  MethodWorkspaceViewMode,
} from '../../src/components/method-workspace/types';
import type {
  MethodQuestion,
  MethodReadiness,
  MethodSaveState,
  MethodSession,
  TeresaPreview,
} from '../../src/method-core/contracts';

const params = new URLSearchParams(window.location.search);
const view = (params.get('view') || 'interview') as MethodWorkspaceViewMode;
const state = params.get('state') || 'default';

// ── Mock data ────────────────────────────────────────────────────────────

const SESSION: MethodSession = {
  id: 'session-demo-0007',
  organizationId: 'org-demo',
  projectId: 'project-demo',
  module: 'assessment',
  methodPackId: 'demo-pack',
  methodPackVersion: '2.3.0',
  state: 'active',
  domainStage: 'In interview',
  mode: 'guided_manual',
  ownerUserId: 'user-demo',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-13T10:30:00.000Z',
  version: 4,
  frozenSnapshotId: null,
  revisionOfSessionId: null,
};

const READINESS: MethodReadiness = {
  answeredUnits: 14,
  totalUnits: 24,
  unitsMissingEvidence: 3,
  openDiscrepancies: 2,
  pendingProposals: state === 'teresaRich' ? 2 : 1,
  freezeBlockers: state === 'savefailed' ? ['3 obszary bez dowodu', '2 propozycje AI oczekują decyzji'] : [],
};

const NAVIGATOR_NODES: MethodNavigatorNode[] = [
  {
    unitId: 'axis-strategy',
    name: 'Strategia i governance',
    parentId: null,
    order: 1,
    currentLevel: null,
    targetLevel: null,
    evidenceState: 'complete',
    gap: null,
    openQuestionCount: 0,
  },
  {
    unitId: 'unit-strategy-governance',
    name: 'Governance danych',
    parentId: 'axis-strategy',
    order: 1,
    currentLevel: 2,
    targetLevel: 4,
    evidenceState: 'complete',
    gap: 2,
    openQuestionCount: 0,
  },
  {
    unitId: 'unit-strategy-roadmap',
    name: 'Mapa drogowa cyfrowa',
    parentId: 'axis-strategy',
    order: 2,
    currentLevel: 1,
    targetLevel: 3,
    evidenceState: 'weak',
    gap: 2,
    openQuestionCount: 2,
  },
  {
    unitId: 'axis-data',
    name: 'Dane i integracja',
    parentId: null,
    order: 2,
    currentLevel: null,
    targetLevel: null,
    evidenceState: 'missing',
    gap: null,
    openQuestionCount: 0,
  },
  {
    unitId: 'unit-data-quality',
    name: 'Jakość danych',
    parentId: 'axis-data',
    order: 1,
    currentLevel: null,
    targetLevel: 3,
    evidenceState: 'missing',
    gap: null,
    openQuestionCount: 3,
  },
  {
    unitId: 'unit-data-integration',
    name: 'Integracja systemów',
    parentId: 'axis-data',
    order: 2,
    currentLevel: 2,
    targetLevel: 2,
    evidenceState: 'complete',
    gap: 0,
    openQuestionCount: 0,
  },
];

function makeQuestion(overrides: Partial<MethodQuestion> = {}): MethodQuestion {
  return {
    questionId: 'q-roadmap-01',
    unitId: 'unit-strategy-roadmap',
    level: 2,
    canonicalWording: 'Czy organizacja ma udokumentowaną, zatwierdzoną mapę drogową transformacji cyfrowej?',
    intent: 'Sprawdzenie, czy plan działań wykracza poza pojedyncze, niepowiązane inicjatywy.',
    plainLanguageExplanation:
      'Chodzi o realny, spisany dokument z priorytetami i horyzontem czasowym — nie o pojedyncze projekty prowadzone niezależnie od siebie.',
    whyItMatters: 'Bez wspólnej mapy drogowej inicjatywy konkurują o te same zasoby i nie sumują się w wynik.',
    glossaryRefs: ['roadmap', 'governance'],
    positiveAnswerExample: 'Mamy zatwierdzoną przez zarząd mapę drogową na 3 lata, aktualizowaną co kwartał.',
    partialAnswerExample: 'Mamy listę projektów w arkuszu, ale bez formalnej akceptacji ani wspólnych priorytetów.',
    negativeAnswerExample: 'Każdy dział planuje swoje inicjatywy niezależnie.',
    expectedEvidence: ['Dokument mapy drogowej', 'Protokół akceptacji zarządu', 'Harmonogram przeglądów'],
    likelyRespondentRoles: ['cio', 'transformation_lead'],
    followUpQuestionIds: ['q-roadmap-02'],
    commonMisunderstanding: 'Lista projektów IT w Jirze to nie to samo co zatwierdzona mapa drogowa transformacji.',
    allowedTeresaCapabilities: ['explain_question_plainly', 'compare_adjacent_levels'],
    sourceRefs: ['method-pack://demo/roadmap/l2'],
    ...overrides,
  };
}

const QUESTIONS: InterviewFocusQuestion[] = [
  {
    question: makeQuestion(),
    answerState: state === 'resolution' ? 'dont_know' : 'partial',
    answerText:
      state === 'resolution'
        ? ''
        : 'Mamy listę inicjatyw w arkuszu współdzielonym, ale nie przechodziła formalnej akceptacji zarządu.',
    evidenceState: 'weak',
    evidenceCount: 1,
  },
];

const RESOLUTION_DATA = {
  questionId: 'q-roadmap-01',
  whatIsUnknown: 'Czy istniejąca lista inicjatyw była kiedykolwiek formalnie zatwierdzona przez zarząd.',
  likelyOwnerLabel: 'Dyrektor ds. transformacji cyfrowej',
  resolvingArtifactHint: 'Protokół z posiedzenia zarządu lub komitetu sterującego',
  dueDate: null,
  blocksFreeze: true,
};

function makeTeresaPreview(id: string, overrides: Partial<TeresaPreview> = {}): TeresaPreview {
  return {
    previewId: id,
    intent: {
      capabilityId: 'draft_score_proposal',
      sessionId: SESSION.id,
      unitId: 'unit-strategy-roadmap',
      invokedBy: 'local_action',
      actorUserId: 'user-demo',
    },
    statements: [
      { kind: 'respondent_declaration', text: 'Lista inicjatyw istnieje w arkuszu współdzielonym.', sourceRefs: [] },
      { kind: 'missing_evidence', text: 'Brak dowodu formalnej akceptacji przez zarząd.', sourceRefs: [] },
      { kind: 'proposal', text: 'Proponowany poziom: 2 (częściowo sformalizowane planowanie).', sourceRefs: [] },
    ],
    proposedChanges: [{ target: 'score_proposal', targetId: 'unit-strategy-roadmap', before: 1, after: 2 }],
    quality: { verdict: 'needs_human_review', failedChecks: ['lists_missing_evidence'] },
    createdAt: '2026-08-13T10:00:00.000Z',
    expiresAt: '2026-08-14T10:00:00.000Z',
    ...overrides,
  };
}

const PROPOSAL_QUEUE: TeresaPreview[] =
  state === 'teresaRich'
    ? [
        makeTeresaPreview('preview-demo-1'),
        makeTeresaPreview('preview-demo-2', {
          intent: {
            capabilityId: 'draft_finding',
            sessionId: SESSION.id,
            unitId: 'unit-data-quality',
            invokedBy: 'conversation',
            actorUserId: 'user-demo',
          },
          statements: [
            { kind: 'confirmed_fact', text: 'Dane klientów są w dwóch niepołączonych systemach.', sourceRefs: [] },
            { kind: 'interpretation', text: 'To prawdopodobnie źródło rozbieżności w raportach sprzedaży.', sourceRefs: [] },
          ],
          proposedChanges: [{ target: 'finding', targetId: null, before: null, after: 'Fragmentacja danych klienta między CRM a ERP.' }],
          quality: { verdict: 'valid', failedChecks: [] },
        }),
      ]
    : [makeTeresaPreview('preview-demo-1')];

function buildMatrixRow(unitId: string, unitName: string, achievedTo: number, target: number): MatrixRow {
  return {
    unitId,
    unitName,
    levels: [1, 2, 3, 4, 5].map((level) => ({
      unitId,
      level,
      achieved: level <= achievedTo,
      proposed: level === achievedTo + 1,
      target: level === target,
      answerState: level <= achievedTo ? 'confirmed' : level === achievedTo + 1 ? 'partial' : 'unresolved',
      evidenceState: level <= achievedTo ? 'complete' : level === achievedTo + 1 ? 'weak' : 'missing',
      aiProposalPending: level === achievedTo + 1 && unitId === 'unit-strategy-roadmap',
      reviewRequired: level === achievedTo + 1 && unitId === 'unit-data-quality',
      blocker: level === 3 && unitId === 'unit-data-quality',
    })),
  };
}

const MATRIX_ROWS: MatrixRow[] = [
  buildMatrixRow('unit-strategy-governance', 'Governance danych', 2, 4),
  buildMatrixRow('unit-strategy-roadmap', 'Mapa drogowa cyfrowa', 1, 3),
  buildMatrixRow('unit-data-quality', 'Jakość danych', 0, 3),
  buildMatrixRow('unit-data-integration', 'Integracja systemów', 2, 2),
];

function Screen(): React.ReactElement {
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(
    view === 'matrix' ? { unitId: 'unit-strategy-roadmap', level: 2 } : null
  );

  const saveState: MethodSaveState = state === 'savefailed' ? 'SAVE_FAILED' : 'SAVED';

  return (
    <div style={{ height: '100vh' }}>
      <MethodWorkspaceShell
        session={SESSION}
        methodName="Diagnostyka gotowości — DEMO"
        packVersionLabel={SESSION.methodPackVersion}
        readiness={READINESS}
        mode={mode}
        onModeChange={setMode}
        onExit={() => {}}
        saveState={saveState}
        saveLastSavedAt={state === 'savefailed' ? null : '2026-08-13T10:28:00.000Z'}
        saveErrorMessage={state === 'savefailed' ? 'Serwer nie odpowiedział (504)' : null}
        onSaveNow={() => {}}
        onSaveRetry={() => {}}
        onSaveStay={() => {}}
        viewMode={view}
        navigatorProps={{
          nodes: NAVIGATOR_NODES,
          activeUnitId: 'unit-strategy-roadmap',
          onSelect: () => {},
        }}
        interviewProps={{
          breadcrumb: ['Strategia i governance', 'Mapa drogowa cyfrowa', 'Poziom 2'],
          questions: QUESTIONS,
          questionIndex: 3,
          questionTotal: 8,
          resolutionData: RESOLUTION_DATA,
          onAnswerChange: () => {},
          onAnswerStateChange: () => {},
          onResolutionAction: () => {},
          onEvidenceDrop: () => {},
          onBack: () => {},
          onSave: () => {},
          onNext: () => {},
          onSkip: () => {},
          onAskTeresa: () => {},
          canGoBack: true,
          canGoNext: true,
        }}
        teresaProps={{
          sixQuestions: {
            whereAreWe: 'Wywiad dla „Mapa drogowa cyfrowa" — poziom 2 z 5, 3 z 8 pytań pozostało.',
            whatMattersNow: 'Potwierdzenie formalnej akceptacji mapy drogowej przez zarząd.',
            why: 'Bez akceptacji zarządu poziom 2 pozostaje propozycją, nie potwierdzonym wynikiem.',
            whatIsMissing: 'Protokół z posiedzenia zarządu lub komitetu sterującego.',
            nextSafeAction: 'Poproś respondenta o link do protokołu albo przypisz pytanie do CIO.',
          },
          proposalQueue: PROPOSAL_QUEUE,
          onCommit: () => {},
          onTakeLead: () => setMode('teresa_led'),
          onLetMeWorkManually: () => setMode('guided_manual'),
          mode,
        }}
        matrixProps={{
          rows: MATRIX_ROWS,
          levels: [1, 2, 3, 4, 5],
          selection: matrixSelection,
          onSelect: setMatrixSelection,
          onCloseSideSheet: () => setMatrixSelection(null),
          renderSideSheet: (selection) => (
            <div style={{ fontSize: 12 }}>
              <p style={{ color: 'var(--c-text-secondary)' }}>
                3 pytania powiązane z tą komórką — 2 potwierdzone, 1 częściowe.
              </p>
              <p style={{ color: 'var(--c-text-muted)', marginTop: 4 }}>
                Jednostka {selection.unitId}, poziom {selection.level}.
              </p>
            </div>
          ),
        }}
      />
    </div>
  );
}

export default Screen;
