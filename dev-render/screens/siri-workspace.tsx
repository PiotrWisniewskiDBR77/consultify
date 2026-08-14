/**
 * A7 — SIRI vertical slice, dev-render harness screen.
 *
 * Mounts the SHARED, domain-agnostic `MethodWorkspaceShell` (A5,
 * `src/components/method-workspace/`) wired with REAL SIRI data via
 * `src/method-core/methods/siri/siriWorkspaceView.ts` + `siriAdapter.ts` —
 * no fabricated methodology content. Mock only: session/story state kept in
 * `useState` here (no backend, no login), same pattern as
 * `dev-render/screens/method-workspace.tsx` (A5's generic demo harness).
 *
 * URL params:
 *   &view=interview|split|matrix   (default interview)
 *   &case=default|leapfrog         (default default)
 *   &theme=light|dark
 */
import React, { useMemo, useState } from 'react';

import { MethodWorkspaceShell } from '../../src/components/method-workspace/MethodWorkspaceShell';
import type {
  InterviewFocusQuestion,
  MethodWorkspaceViewMode,
} from '../../src/components/method-workspace/types';
import type { EvidenceStrength, MethodReadiness, MethodSaveState, MethodSession, TeresaPreview } from '../../src/method-core/contracts';
import {
  buildSiriGenericQuestion,
  buildSiriMatrixRows,
  buildSiriNavigatorNodes,
  checkSiriLeapfrog,
  confirmSiriBand,
  emptySiriUnitState,
  isSiriFactoryObservation,
  proposeSiriBand,
  SIRI_BAND_SCALE,
  SIRI_EVIDENCE_ITEM_TYPES,
  siriEvidenceMissingCount,
  type SiriEvidenceItemType,
  type SiriUnitAssessmentState,
} from '../../src/method-core/methods/siri/siriWorkspaceView';
import { SIRI_METHOD_PACK_VERSION } from '../../src/method-core/methods/siri/compileSiriPack';
import { SIRI_PRIORITISATION_AREAS } from '../../src/services/siriStructure';

const params = new URLSearchParams(window.location.search);
const view = (params.get('view') || 'interview') as MethodWorkspaceViewMode;
const caseParam = params.get('case') || 'default';

const EVIDENCE_TYPE_LABEL: Record<SiriEvidenceItemType, string> = {
  document: 'Dokument',
  system_record: 'Rekord systemowy',
  metric: 'Metryka',
  demonstration: 'Demonstracja',
  interview_statement: 'Deklaracja z wywiadu',
  media: 'Media (zdjęcie/wideo)',
  external_source: 'Źródło zewnętrzne',
  factory_observation: 'Obserwacja na hali produkcyjnej (factory observation)',
};

function buildDemoStates(): Map<string, SiriUnitAssessmentState> {
  const map = new Map<string, SiriUnitAssessmentState>();
  for (const area of SIRI_PRIORITISATION_AREAS) {
    map.set(area.id, emptySiriUnitState(area.id));
  }

  if (caseParam === 'leapfrog') {
    // Band 2 deliberately skipped -> Band 4 is blocked (no-leapfrog demo).
    map.set('vertical_integration', {
      unitId: 'vertical_integration',
      confirmedLevels: [0, 1],
      evidenceByLevel: { 0: 'E2', 1: 'E2' },
      targetLevel: 4,
    });
  } else {
    map.set('vertical_integration', {
      unitId: 'vertical_integration',
      confirmedLevels: [0, 1, 2],
      evidenceByLevel: { 0: 'E2', 1: 'E3', 2: 'E2' },
      targetLevel: 4,
    });
    map.set('shop_floor_automation', {
      unitId: 'shop_floor_automation',
      confirmedLevels: [0],
      evidenceByLevel: { 0: 'E1' },
      targetLevel: 3,
    });
    map.set('shop_floor_connectivity', {
      unitId: 'shop_floor_connectivity',
      confirmedLevels: [0, 1],
      evidenceByLevel: { 0: 'E2', 1: 'E2' },
      targetLevel: 3,
    });
  }
  return map;
}

const SESSION: MethodSession = {
  id: 'siri-session-demo-0001',
  organizationId: 'org-demo',
  projectId: 'project-demo',
  module: 'assessment',
  methodPackId: 'siri',
  methodPackVersion: SIRI_METHOD_PACK_VERSION,
  state: 'active', // NOT frozen — TIER is intentionally unreachable from here (see siri-tier.html)
  domainStage: 'In interview',
  mode: 'guided_manual',
  ownerUserId: 'user-demo',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-13T10:30:00.000Z',
  version: 3,
  frozenSnapshotId: null,
  revisionOfSessionId: null,
};

interface BandSideSheetProps {
  unitId: string;
  level: number;
  state: SiriUnitAssessmentState;
  onConfirmed: (unitId: string, level: number) => void;
}

const BandSideSheet: React.FC<BandSideSheetProps> = ({ unitId, level, state, onConfirmed }) => {
  const [rationale, setRationale] = useState('');
  const [evidenceType, setEvidenceType] = useState<SiriEvidenceItemType>('factory_observation');
  const [message, setMessage] = useState<{ tone: 'warning' | 'success'; text: string } | null>(null);

  const leapfrog = checkSiriLeapfrog(state, level);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
      <p style={{ color: 'var(--c-text-secondary)' }}>
        {SIRI_PRIORITISATION_AREAS.find((a) => a.id === unitId)?.name ?? unitId} · Band {level}
      </p>

      {!leapfrog.allowed && (
        <div
          role="alert"
          data-testid="siri-leapfrog-blocked"
          style={{
            border: '1px solid var(--c-warning)',
            background: 'color-mix(in srgb, var(--c-warning) 12%, transparent)',
            color: 'var(--c-warning)',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          {leapfrog.message}
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--c-text-secondary)', fontWeight: 600 }}>Uzasadnienie (rationale) — wymagane</span>
        <textarea
          data-testid="siri-band-rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          style={{
            border: '1px solid var(--c-border)',
            borderRadius: 8,
            padding: 6,
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
          }}
          placeholder="Jakie informacje i evidence uzasadniają ten Band?"
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ color: 'var(--c-text-secondary)', fontWeight: 600 }}>Typ evidence</span>
        <select
          data-testid="siri-evidence-type"
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value as SiriEvidenceItemType)}
          style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: 6, background: 'var(--c-surface)', color: 'var(--c-text)' }}
        >
          {SIRI_EVIDENCE_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVIDENCE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {isSiriFactoryObservation({ type: evidenceType }) && (
          <span style={{ color: 'var(--c-text-muted)' }}>
            Osobny typ Evidence Item (ASSESSMENT_KB_SIRI.md §5) — nie jest zlewany z notatką tekstową.
          </span>
        )}
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          data-testid="siri-propose-band"
          onClick={() => {
            const result = proposeSiriBand({ state, level, rationale });
            setMessage(
              result.ok
                ? { tone: 'success', text: `Assessor PROPONUJE Band ${level} — czeka na decyzję uczestnika/approvera.` }
                : { tone: 'warning', text: result.message }
            );
          }}
          style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: '6px 10px', background: 'var(--c-surface-raised)', color: 'var(--c-text)' }}
        >
          Assessor: zaproponuj Band
        </button>
        <button
          type="button"
          data-testid="siri-confirm-band"
          onClick={() => {
            const result = confirmSiriBand({
              state,
              level,
              rationale,
              confirmedByActor: 'participant',
              confirmedByUserId: 'user-participant-demo',
            });
            if (result.ok) {
              setMessage({ tone: 'success', text: `Uczestnik POTWIERDZIŁ Band ${level}.` });
              onConfirmed(unitId, level);
            } else {
              setMessage({ tone: 'warning', text: result.message });
            }
          }}
          style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: '6px 10px', background: 'var(--c-surface-raised)', color: 'var(--c-text)' }}
        >
          Uczestnik: potwierdź Band
        </button>
      </div>

      <p style={{ color: 'var(--c-text-muted)' }}>
        Teresa może wyłącznie zaproponować (panel po prawej) — nie ma tu przycisku „Teresa zatwierdza".
      </p>

      {message && (
        <p style={{ color: message.tone === 'warning' ? 'var(--c-warning)' : 'var(--c-success)' }}>{message.text}</p>
      )}
    </div>
  );
};

function Screen(): React.ReactElement {
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [states, setStates] = useState<Map<string, SiriUnitAssessmentState>>(() => buildDemoStates());
  const [activeUnitId, setActiveUnitId] = useState<string>('vertical_integration');
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(
    caseParam === 'leapfrog' ? { unitId: 'vertical_integration', level: 4 } : null
  );

  const navigatorNodes = useMemo(() => buildSiriNavigatorNodes(states), [states]);
  const matrixRows = useMemo(() => buildSiriMatrixRows(states), [states]);
  const evidenceMissing = useMemo(() => siriEvidenceMissingCount(), []);

  const answeredUnits = Array.from(states.values()).filter((s) => s.confirmedLevels.length > 0).length;

  const readiness: MethodReadiness = {
    answeredUnits,
    totalUnits: SIRI_PRIORITISATION_AREAS.length,
    unitsMissingEvidence: SIRI_PRIORITISATION_AREAS.length - answeredUnits,
    openDiscrepancies: caseParam === 'leapfrog' ? 1 : 0,
    pendingProposals: 1,
    freezeBlockers:
      answeredUnits < SIRI_PRIORITISATION_AREAS.length
        ? [`${SIRI_PRIORITISATION_AREAS.length - answeredUnits}/${SIRI_PRIORITISATION_AREAS.length} wymiarów bez potwierdzonego Bandu`]
        : [],
  };

  const activeQuestion = buildSiriGenericQuestion(activeUnitId, null);
  const questions: InterviewFocusQuestion[] = [
    {
      question: activeQuestion,
      answerState: null,
      answerText: '',
      evidenceState: 'missing',
      evidenceCount: 0,
    },
  ];

  const teresaPreview: TeresaPreview = {
    previewId: 'preview-siri-demo-1',
    intent: {
      capabilityId: 'draft_score_proposal',
      sessionId: SESSION.id,
      unitId: activeUnitId,
      invokedBy: 'local_action',
      actorUserId: 'user-demo',
    },
    statements: [
      { kind: 'missing_evidence', text: 'SIRI QBank v1 nie ma pytania dedykowanego temu wymiarowi (0/16).', sourceRefs: [] },
      { kind: 'proposal', text: 'Propozycja Band 2 — wymaga potwierdzenia przez uczestnika/approvera.', sourceRefs: [] },
    ],
    proposedChanges: [{ target: 'score_proposal', targetId: activeUnitId, before: null, after: 2 }],
    quality: { verdict: 'needs_human_review', failedChecks: ['lists_missing_evidence'] },
    createdAt: '2026-08-13T10:00:00.000Z',
    expiresAt: '2026-08-14T10:00:00.000Z',
  };

  const saveState: MethodSaveState = 'SAVED';

  return (
    <div style={{ height: '100vh' }}>
      <div
        data-testid="siri-evidence-missing-summary"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, fontSize: 11, padding: '2px 8px', color: 'var(--c-text-muted)', background: 'var(--c-bg)' }}
      >
        SIRI pack: {evidenceMissing.levelsMarkedEvidenceMissing}/{evidenceMissing.levelsTotal} band descriptors EVIDENCE_MISSING ·{' '}
        {evidenceMissing.dimensionsWithDedicatedQuestions}/{evidenceMissing.dimensionsTotal} wymiarów z dedykowanymi pytaniami.
      </div>
      <div style={{ height: '100%', paddingTop: 18 }}>
        <MethodWorkspaceShell
          session={SESSION}
          methodName="SIRI — Smart Industry Readiness Index"
          packVersionLabel={SESSION.methodPackVersion}
          readiness={readiness}
          mode={mode}
          onModeChange={setMode}
          onExit={() => {}}
          saveState={saveState}
          saveLastSavedAt="2026-08-13T10:28:00.000Z"
          saveErrorMessage={null}
          onSaveNow={() => {}}
          onSaveRetry={() => {}}
          onSaveStay={() => {}}
          viewMode={view}
          navigatorProps={{
            nodes: navigatorNodes,
            activeUnitId,
            onSelect: (unitId) => {
              // Ignore selection of the 3 building-block/8-pillar grouping
              // nodes — only the 16 dimensions are assessable leaves.
              if (SIRI_PRIORITISATION_AREAS.some((a) => a.id === unitId)) setActiveUnitId(unitId);
            },
          }}
          interviewProps={{
            breadcrumb: [
              'SIRI',
              SIRI_PRIORITISATION_AREAS.find((a) => a.id === activeUnitId)?.name ?? activeUnitId,
            ],
            questions,
            questionIndex: 0,
            questionTotal: 1,
            resolutionData: {
              questionId: activeQuestion.questionId,
              whatIsUnknown: 'Brak dedykowanego pytania SIRI QBank dla tego wymiaru.',
              likelyOwnerLabel: 'Kierownik operacji / SME wymiaru',
              resolvingArtifactHint: 'Obserwacja na hali produkcyjnej lub dokument procesu',
              dueDate: null,
              blocksFreeze: false,
            },
            onAnswerChange: () => {},
            onAnswerStateChange: () => {},
            onResolutionAction: () => {},
            resolutionActions: [],
            onEvidenceDrop: () => {},
            onBack: () => {},
            onSave: () => {},
            onNext: () => {},
            onSkip: () => {},
            onAskTeresa: () => {},
            canGoBack: false,
            canGoNext: false,
          }}
          teresaProps={{
            sixQuestions: {
              whereAreWe: `${answeredUnits}/${SIRI_PRIORITISATION_AREAS.length} z 16 wymiarów ma potwierdzony Band.`,
              whatMattersNow: 'Uzupełnienie evidence dla wymiarów bez potwierdzonego Bandu.',
              why: 'Bez potwierdzenia freeze pozostaje zablokowany (readiness.freezeBlockers).',
              whatIsMissing: 'Rationale + evidence dla otwartych Bandów; SIRI QBank v1 nie ma gotowych pytań (0/16).',
              nextSafeAction: 'Poproś o factory observation lub dokument procesu dla bieżącego wymiaru.',
            },
            proposalQueue: [teresaPreview],
            onCommit: () => {},
            onTakeLead: () => setMode('teresa_led'),
            onLetMeWorkManually: () => setMode('guided_manual'),
            mode,
          }}
          matrixProps={{
            rows: matrixRows,
            levels: [...SIRI_BAND_SCALE],
            selection: matrixSelection,
            onSelect: setMatrixSelection,
            onCloseSideSheet: () => setMatrixSelection(null),
            renderSideSheet: (selection) => (
              <BandSideSheet
                unitId={selection.unitId}
                level={selection.level}
                state={states.get(selection.unitId) ?? emptySiriUnitState(selection.unitId)}
                onConfirmed={(unitId, level) => {
                  setStates((prev) => {
                    const next = new Map(prev);
                    const current = next.get(unitId) ?? emptySiriUnitState(unitId);
                    const confirmedLevels = Array.from(new Set([...current.confirmedLevels, level])).sort((a, b) => a - b);
                    const evidenceByLevel: Record<number, EvidenceStrength> = { ...current.evidenceByLevel, [level]: 'E2' };
                    next.set(unitId, { ...current, confirmedLevels, evidenceByLevel });
                    return next;
                  });
                }}
              />
            ),
          }}
        />
      </div>
    </div>
  );
}

export default Screen;
