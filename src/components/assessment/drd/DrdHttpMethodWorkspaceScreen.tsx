/**
 * DrdHttpMethodWorkspaceScreen — HTTP-source-of-truth path for the DRD
 * workspace (P0C, 2026-08-13).
 *
 * Rendered by `DrdMethodWorkspaceScreen.tsx` for every DRD session after the
 * J2 cutover. It uses `MethodWorkspaceShell` and the pure event->view-model derivation
 * (`drdWorkspaceViewModel.ts`) — the only thing that changes is where the
 * session/events/Output come from: `DrdHttpSessionRuntime`
 * (src/method-core/methods/drd/drdHttpSessionRuntime.ts) over
 * `/api/method/...`, never `localStorage` as an answer to "what is the
 * current state".
 *
 * ★ localStorage's role here is EXACTLY the two things
 * `DrdHttpSessionRuntime`'s header promises — a read cache and an offline
 * write-recovery queue — never the source of truth. See
 * `DrdSourceIndicator` for the visible proof of which one backed the last
 * paint.
 *
 * ★ Known gaps (server routes are P0A/P0B territory, out of this file's
 * reach — see the `drdHttpSourceOfTruthV1` flag description for the full
 * rationale):
 *  - role assignment is governed by the method-core role endpoints; this
 *    workspace consumes effective process roles but does not administer them.
 *  - no HTTP endpoint reopens a frozen session into a new revision — the
 *    Reopen action is disabled with an explicit message instead of faked.
 *  - persisted Output/Report/Initiative Draft state is rehydrated through
 *    the canonical method-core list endpoints.
 */
import {
  AlertTriangle,
  ArrowLeft,
  CloudOff,
  FileText,
  Lightbulb,
  Lock,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nazwaWJezyku } from './drdNazwa';

import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import { EmptyState } from '@/components/shared/states';
import { LiveMatrix } from '@/components/method-workspace/LiveMatrix';
import { DrdOwnerMatrixPanel } from '@/components/assessment/drd/DrdOwnerMatrixPanel';
import {
  DRD_HELP_JUSTIFICATION_MARKER,
  DrdPostPersistActionError,
  DrdLevelDecisionSaveError,
  DrdLevelInterviewWorkspace,
  drdLevelDecisions,
  persistDrdLevelDecision,
  pickDrdEvidenceOwnerId,
  type DrdLevelDecision,
} from '@/components/assessment/drd/DrdLevelInterviewWorkspace';
import { StandardTable } from '@/components/standard/StandardTable';
import { PracujZAI } from '@/components/standard/PracujZAI';
import type { PoleDoUzupelnienia, ZrodloUzupelnienia } from '@/components/standard/PracujZAI.types';
import type {
  EvidenceListItem,
  InterviewFocusQuestion,
  MethodWorkspaceViewMode,
  ResolutionAction,
} from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import {
  formatSkipJustification,
  type DrdSkipReasonCode,
} from '@/components/method-workspace/skipReasonCodes';
import { useAssessmentSaveIndicator } from '@/hooks/useAssessmentSaveIndicator';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { DRD_METHOD_PACK_ID } from '@/method-core/methods/drd/compileDrdPack';
import {
  isOfflineError,
  MethodCoreApiError,
  newIdempotencyKey,
  recordAssessmentSkipReason,
} from '@/method-core/api/methodCoreApi';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import {
  DrdHttpSessionRuntime,
  type DrdHttpRuntimeState,
} from '@/method-core/methods/drd/drdHttpSessionRuntime';
import type { MethodEvent, MethodReadiness, TeresaCommitRequest } from '@/method-core/contracts';
import { DRD_STRUCTURE } from '@/services/drdStructure';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { isAssessmentReportViewEnabled } from '@/utils/assessmentReportViewFlag';
import { normalizeAppRole } from '@/utils/roleGuards';
import { isDrdInterviewV2Enabled } from '@/utils/drdInterviewV2Flag';

import {
  buildMatrixRowsForAxis,
  buildNavigatorNodes,
  confirmedLevelsFor,
  evidenceEventsFor,
  evidenceItemsFor,
  evidenceStateFor,
  evidenceStrengthFor,
  getOutputUnitColumns,
  questionAnswerState,
  targetLevelFor,
} from './drdWorkspaceViewModel';
import { useDrdPack } from './useDrdPack';
import { AssessmentSaveStateIndicator } from './AssessmentSaveStateIndicator';
import { DrdSourceIndicator } from './DrdSourceIndicator';
import type { DrdMethodWorkspaceScreenProps } from './DrdMethodWorkspaceScreen';

const AssessmentReportContractView = React.lazy(() =>
  import('../report/AssessmentReportContractView').then((module) => ({
    default: module.AssessmentReportContractView,
  }))
);

/**
 * ★ FALA J2 — sesja ZAMROŻONA pokazuje PRODUKT, nie kontrakt.
 *
 * `AssessmentReportView` to KANONICZNY pojemnik dokumentu wyniku (ten sam,
 * który stoi pod trasą `/assessment/outputs/:outputId/report` przez
 * `AssessmentOutputReportRoute`): dostaje `outputId`, sam robi trzy GET-y
 * (`reportApi.ts`) i sam rysuje `AssessmentReportDocument`. Tutaj jest
 * WOŁANY, a nie kopiowany — żadnego drugiego pobierania ani drugiego
 * rysunku raportu w tym pliku.
 */
const AssessmentOutputReportDocumentView = React.lazy(() =>
  import('../report/AssessmentReportView').then((module) => ({
    default: module.AssessmentReportView,
  }))
);

type HttpScreenProps = Omit<
  DrdMethodWorkspaceScreenProps,
  'forceHttpSourceOfTruth' | 'initialActorUserId' | 'forceState'
>;

// ---------------------------------------------------------------------------
// Dev-render / test only — reach offline/conflict/recovery deterministically
// without depending on a genuinely flaky network. See this component's own
// `forceState` prop and `DrdHttpSessionRuntime`'s (absence of a) production
// code path that would ever call this — only the harness/tests do.
// ---------------------------------------------------------------------------
export type DrdHttpDebugForcedState = 'offline' | 'conflict' | 'recovery' | 'loading';

async function seedHttpSession(
  runtime: DrdHttpSessionRuntime,
  seedTo: HttpScreenProps['seedTo']
): Promise<void> {
  await runtime.transition('prepared');
  await runtime.transition('active');
  if (!seedTo) return;

  const area1A = DRD_STRUCTURE[0].areas[0];
  await runtime.recordAnswer({
    unitId: area1A.id,
    level: 1,
    questionId: `${area1A.id}-L1-Q1`,
    answerState: 'confirmed',
    text: 'Mamy podstawowy, spisany proces sprzedaży współdzielony w zespole.',
  });
  await runtime.recordEvidence({
    unitId: area1A.id,
    level: 1,
    evidenceId: 'demo-ev-1a-l1',
    evidenceType: 'document',
    strength: 'E2',
  });
  await runtime.recordAnswer({
    unitId: area1A.id,
    level: 2,
    questionId: `${area1A.id}-L2-Q1`,
    answerState: 'confirmed',
    text: 'Proces jest częściowo zautomatyzowany w CRM.',
  });
  await runtime.recordEvidence({
    unitId: area1A.id,
    level: 2,
    evidenceId: 'demo-ev-1a-l2',
    evidenceType: 'system_record',
    strength: 'E3',
  });
  await runtime.recordTargetDecision({
    unitId: area1A.id,
    level: 4,
    rationale: 'Cel ustalony z zarządem na ten rok.',
  });

  if (seedTo === 'interview') return;

  const area1B = DRD_STRUCTURE[0].areas[1];
  await runtime.recordAnswer({
    unitId: area1B.id,
    level: 4,
    questionId: `${area1B.id}-L4-Q1`,
    answerState: 'confirmed',
    text: 'Zaawansowana praktyka zaobserwowana punktowo (poza kolejnością).',
  });
  await runtime.recordEvidence({
    unitId: area1B.id,
    level: 4,
    evidenceId: 'demo-ev-1b-l4',
    evidenceType: 'observation',
    strength: 'E1',
  });

  if (seedTo === 'matrix') return;

  if (
    seedTo === 'teresa' ||
    seedTo === 'approval' ||
    seedTo === 'frozen' ||
    seedTo === 'reopened'
  ) {
    await runtime.createTeresaPreview({
      capabilityId: 'draft_score_proposal',
      unitId: area1A.id,
      level: 3,
      invokedBy: 'local_action',
      statements: [
        {
          kind: 'respondent_declaration',
          text: 'Proces w CRM istnieje i jest używany przez cały zespół handlowy.',
          sourceRefs: [],
        },
        {
          kind: 'missing_evidence',
          text: 'Brak dowodu na regularny przegląd wskaźników procesu (poziom 3).',
          sourceRefs: [],
        },
        {
          kind: 'proposal',
          text: 'Proponowany poziom: 3 (zdefiniowany, mierzony proces).',
          sourceRefs: [],
        },
      ],
      proposedChanges: [{ target: 'score_proposal', targetId: area1A.id, before: 2, after: 3 }],
      quality: { verdict: 'needs_human_review', failedChecks: ['lists_missing_evidence'] },
    });
  }

  if (seedTo === 'approval' || seedTo === 'frozen' || seedTo === 'reopened') {
    await runtime.transition('in_review');
  }

  if (seedTo === 'frozen' || seedTo === 'reopened') {
    // Requires the 'approver' role — see this file's header on the known
    // role-assignment gap. In a browser where that role was NOT seeded
    // out-of-band this throws (403 missing_permission) and the screen
    // honestly shows the resulting error state rather than a faked freeze.
    await runtime.freeze();
    await runtime.generateReport({
      title: 'Raport demonstracyjny DRD',
      content: {
        executiveSummary: 'Sesja demonstracyjna DRD — wynik cząstkowy dla osi 1 (Procesy Cyfrowe).',
        participants: ['Piotr (Owner)', 'Anna (Approver)'],
        strengths: ['Proces sprzedaży ma podstawową dokumentację i częściową automatyzację w CRM.'],
      },
    });
    await runtime.generateInitiativeDraft({
      title: 'Domknij automatyzację procesu sprzedaży w CRM',
      summary: 'Initiative draft wygenerowany z findingów Outputu.',
      findingIds: (runtime.getState().output?.findings ?? []).map((f) => f.id),
      rationale: 'Znaleziska Outputu wskazują lukę między current a target dla jednostki 1A.',
      expectedOutcome: 'Podniesienie poziomu dojrzałości procesu sprzedaży do targetu.',
      confidence: 'medium',
    });
  }
  // 'reopened' has no HTTP path (see header) — intentionally stops at frozen.
}

// ---------------------------------------------------------------------------
// Small state-specific views
// ---------------------------------------------------------------------------

const BootstrapLoadingView: React.FC<{ label: string }> = ({ label }) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid="drd-http-bootstrap-loading"
      className="flex h-full flex-col items-center justify-center gap-3 text-sm text-c-text-muted"
    >
      <DrdSourceIndicator
        source="RECOVERY_DRAFT"
        title={t('assessment.drd.http.bootstrap.notConfirmedYet', 'No confirmed server response yet.')}
      />
      {label}
    </div>
  );
};

const ConflictView: React.FC<{
  state: DrdHttpRuntimeState;
  onLoadServerVersion: () => void;
  onExit: () => void;
}> = ({ state, onLoadServerVersion, onExit }) => {
  const { t } = useTranslation();
  return (
  <div
    data-testid="drd-http-conflict-view"
    role="alert"
    className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <div className="flex items-center gap-2">
      <DrdSourceIndicator
        source="RECOVERY_DRAFT"
        title={t(
          'assessment.drd.http.conflict.indicatorTitle',
          'Version conflict — your local view is out of date.'
        )}
      />
      {/* CONFLICT requires a human decision but is NOT a failure — kanon UI
          (CLAUDE.md): not crimson, not c-danger. See AssessmentSaveStateIndicator.
          Status here is always 'conflict' by construction (this view only
          renders for `state.status === 'conflict'`), so the label is fixed
          rather than threaded through as another prop. */}
      <AssessmentSaveStateIndicator state="CONFLICT" />
    </div>
    <AlertTriangle size={28} className="text-c-info" />
    <h2 className="text-sm font-semibold text-c-text">
      {t('assessment.drd.http.conflict.title', 'The session changed on the server')}
    </h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      {t(
        'assessment.drd.http.conflict.body',
        'Your browser had version {{local}}, the server is already at version {{server}}. Nothing was overwritten automatically — choose how to continue.',
        { local: state.session?.version ?? '—', server: state.serverVersion ?? '—' }
      )}
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="conflict-load-server"
        onClick={onLoadServerVersion}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} />{' '}
        {t('assessment.drd.http.conflict.loadServer', 'Load the server version')}
      </button>
      <button
        type="button"
        onClick={onExit}
        className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
      >
        {t('assessment.drd.http.conflict.exit', 'Leave without changes')}
      </button>
    </div>
  </div>
  );
};

const RecoveryQueueView: React.FC<{
  state: DrdHttpRuntimeState;
  onApplyPending: () => void;
  onDiscardPending: () => void;
}> = ({ state, onApplyPending, onDiscardPending }) => {
  const { t } = useTranslation();
  return (
  <div
    data-testid="drd-http-recovery-view"
    role="alert"
    className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <div className="flex items-center gap-2">
      <DrdSourceIndicator
        source="RECOVERY_DRAFT"
        title={t(
          'assessment.drd.http.recovery.indicatorTitle',
          'Changes saved locally, not yet confirmed by the server.'
        )}
      />
      {/* Status here is always 'recovery' with pendingWriteCount > 0 by
          construction (this view only renders for `state.status === 'recovery'`),
          so RECOVERY_DRAFT is exactly what `deriveAssessmentSaveIndicator`
          would compute — fixed here rather than re-derived. */}
      <AssessmentSaveStateIndicator state="RECOVERY_DRAFT" />
    </div>
    <CloudOff size={28} className="text-c-warning" />
    <h2 className="text-sm font-semibold text-c-text">
      {t(
        'assessment.drd.http.recovery.title',
        'Connection is back — {{count}} pending change(s) waiting',
        { count: state.pendingWriteCount }
      )}
    </h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      {t(
        'assessment.drd.http.recovery.body',
        'These changes were saved locally while there was no connection to the server. Choose explicitly: apply them on the server, or discard them and load the current server state. Nothing happens automatically.'
      )}
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="recovery-apply-pending"
        onClick={onApplyPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} />{' '}
        {t('assessment.drd.http.recovery.apply', 'Apply pending changes ({{count}})', {
          count: state.pendingWriteCount,
        })}
      </button>
      <button
        type="button"
        data-testid="recovery-discard-pending"
        onClick={onDiscardPending}
        className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
      >
        {t('assessment.drd.http.recovery.discard', 'Discard local, load the server')}
      </button>
    </div>
  </div>
  );
};

const OfflineBanner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation();
  return (
  <div
    data-testid="drd-http-offline-banner"
    role="alert"
    className="flex items-center gap-3 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning"
  >
    <CloudOff size={13} className="shrink-0" />
    <span>
      {t(
        'assessment.drd.http.offline.body',
        'No connection to the server — writes are queued locally and never lost, but this is NOT a confirmed server state.'
      )}
    </span>
    <button
      type="button"
      onClick={onRetry}
      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-warning/40 px-2 py-0.5 font-semibold hover:bg-c-warning/20"
    >
      <RefreshCw size={11} /> {t('assessment.drd.http.offline.retry', 'Try to reconnect')}
    </button>
  </div>
  );
};

const ErrorRetryView: React.FC<{ message: string; onRetry: () => void; onExit: () => void }> = ({
  message,
  onRetry,
  onExit,
}) => {
  const { t } = useTranslation();
  return (
  <div
    data-testid="drd-http-error-view"
    role="alert"
    className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <DrdSourceIndicator source="RECOVERY_DRAFT" />
    <AlertTriangle size={24} className="text-c-danger" />
    <p className="max-w-md text-xs text-c-danger">{message}</p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="error-retry"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} /> {t('assessment.drd.http.error.retry', 'Try again')}
      </button>
      <button
        type="button"
        onClick={onExit}
        className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
      >
        {t('assessment.drd.http.error.exit', 'Leave')}
      </button>
    </div>
  </div>
  );
};

type DrdRecoveredFocus = { axisId: number; unitId: string; level: number };

function drdFocusStorageKey(sessionId: string): string {
  return `drd-method-workspace.focus:${sessionId}`;
}

function normalizeDrdRecoveredFocus(raw: unknown): DrdRecoveredFocus | null {
  const value = raw as Partial<DrdRecoveredFocus> | null | undefined;
  const axisId = Number(value?.axisId);
  const unitId = String(value?.unitId ?? '');
  const level = Number(value?.level);
  const axis = DRD_STRUCTURE.find((item) => item.id === axisId);
  const unit = axis?.areas.find((item) => item.id === unitId);
  if (!axis || !unit) return null;
  const hasLevel = unit.levels.some((item) => item.level === level);
  if (!hasLevel) return null;
  return { axisId: axis.id, unitId: unit.id, level };
}

function readDrdRecoveredFocus(sessionId: string | undefined, storage: Storage): DrdRecoveredFocus | null {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeDrdRecoveredFocus({
      axisId: params.get('axis'),
      unitId: params.get('area') ?? params.get('unit'),
      level: params.get('level'),
    });
    if (fromUrl) return fromUrl;
  }

  if (!sessionId) return null;
  try {
    const raw = storage.getItem(drdFocusStorageKey(sessionId));
    return raw ? normalizeDrdRecoveredFocus(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DrdHttpMethodWorkspaceScreen: React.FC<
  HttpScreenProps & { forceState?: DrdHttpDebugForcedState }
> = ({ storage: storageProp, demoSessionId, onExit, seedTo, initialViewMode, forceState }) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || 'pl').toLowerCase().startsWith('pl');
  // DEC-461: the questionnaire body (area names, question wording, "Why do we
  // ask") follows the viewer's language. Was a module-level Polish const.
  const pack = useDrdPack();
  const drdInterviewV2 = isDrdInterviewV2Enabled();
  // MVP-OWNER-FREEZE (2026-09-05) — czytane NA GÓRZE komponentu, przed
  // jakimkolwiek wczesnym `return` (reguły hooków); używane dopiero przy
  // `canFreeze` niżej.
  const currentUserRole = useAppStore((s) => s.currentUser?.role);
  const isOrganizationOwner = normalizeAppRole(currentUserRole) === 'OWNER';
  const storage = storageProp ?? window.localStorage;
  const runtimeRef = useRef<DrdHttpSessionRuntime | null>(null);
  // React 18 StrictMode (dev only) double-invokes effects: mount -> cleanup
  // -> mount again, on the SAME component instance (hooks/refs persist).
  // Without these guards this effect would call `create()` twice (two real
  // sessions over HTTP) and replay `seedHttpSession`'s writes twice on
  // whichever runtime "won". Refs survive the synthetic remount, so the
  // second invocation reuses the first's in-flight promise / already-applied
  // seeding instead of repeating the side effect.
  const bootPromiseRef = useRef<Promise<DrdHttpSessionRuntime> | null>(null);
  const seedStartedRef = useRef(false);
  const forceStateAppliedRef = useRef(false);
  const [state, setState] = useState<DrdHttpRuntimeState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [skipWriteError, setSkipWriteError] = useState(false);
  const [viewMode, setViewMode] = useState<MethodWorkspaceViewMode>(initialViewMode ?? 'interview');
  /**
   * ★ FALA J2: sesja zamrożona/zamknięta OTWIERA SIĘ na zakładce „Raport".
   * Jednorazowo (ref), więc użytkownik może natychmiast przejść na „Wywiad"
   * albo „Macierz" (tylko-do-odczytu) i ekran go stamtąd nie wyrzuci. Gdy
   * wołający podał `initialViewMode` — jego wola wygrywa.
   */
  const frozenViewModeAppliedRef = useRef(false);
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const initialRecoveredFocusRef = useRef<DrdRecoveredFocus | null>(
    readDrdRecoveredFocus(demoSessionId, storage)
  );
  const [activeAxisId, setActiveAxisId] = useState<number>(
    initialRecoveredFocusRef.current?.axisId ?? DRD_STRUCTURE[0].id
  );
  const [activeUnitId, setActiveUnitId] = useState<string>(
    initialRecoveredFocusRef.current?.unitId ?? DRD_STRUCTURE[0].areas[0].id
  );
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(
    initialRecoveredFocusRef.current
      ? { unitId: initialRecoveredFocusRef.current.unitId, level: initialRecoveredFocusRef.current.level }
      : null
  );
  const [draftAnswerText, setDraftAnswerText] = useState<Record<string, string>>({});
  /**
   * ★ BRAK AUTO-PRZESKOKU PO WYBORZE STANU (DEC-415c, znalezisko 1.1-D1).
   *
   * ZMIERZONA PRZYCZYNA: poziom pytania na ekranie był POCHODNĄ zdarzeń —
   * `drdAdapter.resolveOpenLevels(...).blockedAtLevel` (niżej w tym pliku).
   * Kliknięcie „Potwierdzone" dopisuje `ANSWER_CONFIRMED` z `answerState:
   * 'confirmed'`, `confirmedLevelsFor` widzi nowy poziom, blokada przesuwa się
   * o jeden — i karta w tej samej klatce podmieniała pytanie na następny
   * poziom. Zielonej (potwierdzonej) karty nie dało się zobaczyć ANI RAZU.
   *
   * LEKARSTWO: po zapisie stanu PRZYPINAMY poziom bieżącej jednostki. Ekran
   * zostaje na tym samym pytaniu (w kolorze wybranego stanu), a dalej prowadzi
   * WYŁĄCZNIE „Dalej" (`handleNext`). Logika blokad poziomów nie zmienia się
   * ani o linijkę — `resolveOpenLevels` liczy dokładnie to samo, co dotąd;
   * zmienia się tylko to, KTÓRY poziom pokazujemy człowiekowi.
   */
  const [pinnedFocus, setPinnedFocus] = useState<{ unitId: string; level: number } | null>(
    initialRecoveredFocusRef.current
      ? { unitId: initialRecoveredFocusRef.current.unitId, level: initialRecoveredFocusRef.current.level }
      : null
  );
  const recoveredFocusAppliedRef = useRef(false);
  useEffect(() => {
    if (recoveredFocusAppliedRef.current) return;
    const recovered = readDrdRecoveredFocus(demoSessionId, storage);
    if (!recovered) return;
    recoveredFocusAppliedRef.current = true;
    setActiveAxisId(recovered.axisId);
    setActiveUnitId(recovered.unitId);
    setMatrixSelection({ unitId: recovered.unitId, level: recovered.level });
    setPinnedFocus({ unitId: recovered.unitId, level: recovered.level });
  }, [demoSessionId, storage]);
  /**
   * Stan odpowiedzi wybrany ręcznie w TEJ sesji przeglądarki (P-P04) oraz
   * ostatnia lista zdarzeń — oba jako refy, bo debounce autozapisu trzyma
   * domknięcie z renderu sprzed wyboru (patrz komentarz przy `save`).
   */
  const chosenAnswerStateRef = useRef<Record<string, InterviewFocusQuestion['answerState']>>({});
  const toDrdAnswerState = (state: InterviewFocusQuestion['answerState'] | undefined): 'confirmed' | 'no' | 'dont_know' => {
    if (state === 'confirmed' || state === 'no' || state === 'dont_know') return state;
    return 'dont_know';
  };
  const eventsRef = useRef<readonly MethodEvent[]>([]);
  const answerWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const savedHelpDecisionRef = useRef<Record<string, string>>({});
  const queueAnswerWrite = useCallback((write: () => Promise<void>) => {
    const queued = answerWriteQueueRef.current.catch(() => undefined).then(write);
    answerWriteQueueRef.current = queued.catch(() => undefined);
    return queued;
  }, []);
  /** Panel „Analizuj" z „Pracuj z AI" — ocena gotowości sesji, zero zapisu. */
  const [analizaOtwarta, setAnalizaOtwarta] = useState(false);
  // True for the duration of an explicit reconciliation call (refresh() from
  // the offline banner / ErrorRetryView, or the Conflict/Recovery views'
  // "load server" / "apply pending" / "discard pending" actions) — feeds
  // `useAssessmentSaveIndicator`'s RECONNECTING/RECOVERED transient labels.
  // Never set by anything automatic; only by the explicit handlers below.
  const [isReconciling, setIsReconciling] = useState(false);
  const runReconciliation = useCallback(async (action: () => Promise<unknown>) => {
    setIsReconciling(true);
    try {
      await action();
    } finally {
      setIsReconciling(false);
    }
  }, []);

  // -- bootstrap: resume (demoSessionId) or create --------------------------
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function boot() {
      if (!bootPromiseRef.current) {
        bootPromiseRef.current = demoSessionId
          ? Promise.resolve(new DrdHttpSessionRuntime(demoSessionId, storage))
          : DrdHttpSessionRuntime.create(
              {
                module: 'assessment',
                methodPackId: DRD_METHOD_PACK_ID,
                methodPackVersion: pack.manifest.version,
                mode: 'guided_manual',
                demoBypass: true,
              },
              storage
            );
      }
      let runtime: DrdHttpSessionRuntime;
      try {
        runtime = await bootPromiseRef.current;
      } catch (err) {
        if (!cancelled)
          setBootError(
            err instanceof Error
              ? err.message
              : t('assessment.drd.http.boot.createFailed', 'The session could not be created.')
          );
        return;
      }
      if (cancelled) return;
      runtimeRef.current = runtime;
      unsubscribe = runtime.onChange((next) => {
        if (!cancelled) setState(next);
      });
      setState(runtime.getState());

      if (demoSessionId) await runtime.refresh();
      if (seedTo && !seedStartedRef.current) {
        seedStartedRef.current = true;
        try {
          await seedHttpSession(runtime, seedTo);
        } catch {
          // Honest stop: seeding hit a real server refusal (e.g. missing
          // approver role — see this file's header). The screen shows
          // whatever state the runtime landed in, never a faked one.
        }
      }
      if (forceState && runtimeRef.current && !forceStateAppliedRef.current) {
        forceStateAppliedRef.current = true;
        const debugPatch: Partial<DrdHttpRuntimeState> =
          forceState === 'offline'
            ? {
                status: 'offline',
                error: t('assessment.drd.http.state.offline', 'No connection to the server.'),
              }
            : forceState === 'conflict'
              ? {
                  status: 'conflict',
                  serverVersion: (runtimeRef.current.getState().session?.version ?? 1) + 1,
                  error: t(
                    'assessment.drd.http.state.conflict',
                    'The session changed on the server.'
                  ),
                }
              : forceState === 'recovery'
                ? { status: 'recovery', pendingWriteCount: 2 }
                : { status: 'loading' };
        runtimeRef.current.debugForceState(debugPatch);
      }
    }
    void boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runtime = runtimeRef.current;

  const events = state?.events ?? [];
  eventsRef.current = events;
  const pendingPreviews = state?.previews ?? [];
  const pendingPreviewUnitLevels = useMemo(() => {
    const set = new Set<string>();
    for (const p of pendingPreviews) {
      if (p.intent.unitId && typeof p.intent.level === 'number')
        set.add(`${p.intent.unitId}#${p.intent.level}`);
    }
    return set;
  }, [pendingPreviews]);

  /**
   * ★ FALA J3 (2026-09-14) — PLAKIETKA „3" PRZY KAŻDYM WIERSZU DRZEWA.
   * Zmierzone, czym ona jest: `openQuestionCount` = liczba pytań QBank
   * na POZIOMIE OGNISKOWYM jednostki (`drdWorkspaceViewModel.ts:198`).
   * QBank ma po trzy pytania na parę obszar#poziom, więc w praktyce wychodzi
   * „3" przy każdym wierszu — sensowne w sesji CZYNNEJ („tyle pytań tu
   * czeka"), a nieprawdziwe w sesji ZAMROŻONEJ, gdzie nie czeka już nic.
   * Zamrożona sesja nie ma pytań otwartych, więc licznik idzie do zera i
   * plakietka znika (`MethodNavigator` rysuje ją tylko dla > 0).
   */
  /** Sesja tylko do odczytu (fala J2: domyślna zakładka „Raport"; fala J3:
   *  plakietka pytań i poziom ogniskowy Wywiadu). */
  const sesjaZamrozona = state?.session?.state === 'frozen' || state?.session?.state === 'closed';
  const navigatorNodes = useMemo(() => {
    const nodes = buildNavigatorNodes(events);
    if (!sesjaZamrozona) return nodes;
    return nodes.map((node) => ({ ...node, openQuestionCount: 0 }));
  }, [events, sesjaZamrozona]);
  const activeAxis = DRD_STRUCTURE.find((a) => a.id === activeAxisId) ?? DRD_STRUCTURE[0];
  const matrixRows = useMemo(
    () => buildMatrixRowsForAxis(events, activeAxis, pendingPreviewUnitLevels),
    [events, activeAxis, pendingPreviewUnitLevels]
  );
  const matrixLevels = useMemo(() => {
    const first = activeAxis.areas[0];
    return first ? first.levels.map((l) => l.level).sort((a, b) => a - b) : [];
  }, [activeAxis]);

  const activeArea = activeAxis.areas.find((a) => a.id === activeUnitId) ?? activeAxis.areas[0];
  // Same rule as the legacy runtime: focus the first UNRESOLVED level (the
  // blocker), not always level 1 — otherwise the Interview Focus panel would
  // never advance past level 1 once it's confirmed, while the Matrix (which
  // reads the same events) correctly shows the real blocker level.
  const activeProgression = useMemo(
    () =>
      drdAdapter.resolveOpenLevels({
        unitId: activeArea.id,
        confirmedLevels: confirmedLevelsFor(events, activeArea.id),
        evidenceByLevel: {},
      }),
    [events, activeArea.id]
  );
  /**
   * ★ FALA J3 (2026-09-14) — WYWIAD ZAMROŻONEJ SESJI OTWIERAŁ SIĘ NA PUSTCE.
   * Zmierzone (staging a2b0a0fe32, sesja 381966f5, 39/39 jednostek
   * odpowiedzianych): zakładka „Wywiad" startowała na `blockedAtLevel`,
   * czyli na PIERWSZYM NIEPOTWIERDZONYM poziomie — z pustym polem
   * „Your answer". Czytelnik zamkniętej oceny nie widział tego, co zostało
   * odpowiedziane, tylko puste pytanie, na które i tak nie może odpowiedzieć
   * (sesja jest read-only).
   *
   * Dla sesji zamrożonej/zamkniętej ogniskujemy więc na POTWIERDZONYM
   * poziomie bieżącym — tam stoi zapisana odpowiedź. Gdy nic nie
   * potwierdzono, zostaje dotychczasowe zachowanie (pierwszy poziom osi).
   * Sesja czynna jest NIETKNIĘTA: tam `blockedAtLevel` to dokładnie miejsce,
   * w którym praca ma być kontynuowana.
   *
   * ★ FALA F2 (2026-09-15) — P-P21, ZGŁOSZENIE PAWŁA: „Next" na ostatnim
   * kroku w pełni odpowiedzianej jednostki WRACAŁ na „Question 1 of 7 /
   * Step 1/3" tej samej jednostki.
   * ZMIERZONA PRZYCZYNA: gdy jednostka jest potwierdzona w 100 %,
   * `resolveOpenLevels` zwraca `blockedAtLevel === null` (nic nie jest
   * zablokowane — fikstura `drd-progression-full-ramp-v1`). Wyrażenie
   * `blockedAtLevel ?? Math.min(...)` spadało wtedy na POZIOM 1, a
   * `handleNext` widziało `derivedFocusLevel (1) !== pinnedFocus.level (7)`
   * i brało to za „odpowiedź otworzyła nowy poziom w tej samej jednostce" —
   * odpinało poziom i ZOSTAWAŁO w jednostce, na pytaniu poziomu 1.
   * LEKARSTWO: brak blokady oznacza „jednostka domknięta", więc ogniskujemy
   * na OSTATNIM potwierdzonym poziomie (`currentLevel`) — tam stoi ostatnia
   * odpowiedź. Poziom 1 zostaje wyłącznie dla jednostki bez ani jednego
   * potwierdzenia i bez blokady (jednostka spoza paczki). Logika blokad
   * (`resolveOpenLevels`) nie zmienia się ani o linijkę.
   */
  const derivedFocusLevel = sesjaZamrozona
    ? (activeProgression.currentLevel ??
      activeProgression.blockedAtLevel ??
      Math.min(...activeArea.levels.map((l) => l.level)))
    : (activeProgression.blockedAtLevel ??
      activeProgression.currentLevel ??
      Math.min(...activeArea.levels.map((l) => l.level)));
  // Przypięcie działa tylko dla jednostki, w której padło; zmiana jednostki
  // (drzewo, macierz, „Dalej") automatycznie wraca do poziomu wyliczonego.
  const focusLevelFallback =
    pinnedFocus && pinnedFocus.unitId === activeArea.id ? pinnedFocus.level : derivedFocusLevel;
  const focusQuestions = pack.questions.filter(
    (q) => q.unitId === activeArea.id && q.level === focusLevelFallback
  );
  const evidenceCountForUnit = evidenceEventsFor(events, activeArea.id).length;
  useEffect(() => {
    const sessionId = state?.session?.id ?? demoSessionId;
    if (!sessionId) return;
    const focus = { axisId: activeAxis.id, unitId: activeArea.id, level: focusLevelFallback };
    try {
      storage.setItem(drdFocusStorageKey(sessionId), JSON.stringify(focus));
    } catch {
      // ignore storage failures; URL recovery below still preserves refresh behavior
    }
    if (typeof window === 'undefined') return;
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('axis', String(focus.axisId));
    nextParams.set('area', focus.unitId);
    nextParams.set('level', String(focus.level));
    const nextSearch = nextParams.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (nextSearch !== currentSearch) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${nextSearch}`);
    }
  }, [activeArea.id, activeAxis.id, demoSessionId, focusLevelFallback, state?.session?.id, storage]);

  const evidenceStrengthForUnit = evidenceStrengthFor(events, activeArea.id);
  const evidenceItemsForUnit = evidenceItemsFor(events, activeArea.id);

  const interviewQuestions: InterviewFocusQuestion[] = focusQuestions.map((q) => {
    const { state: answerState, text } = questionAnswerState(events, q.questionId);
    return {
      question: q,
      answerState,
      // ★ Pole „Twoja odpowiedź" jest kontrolowane. Bez `draftAnswerText`
      // pierwszeństwa wpisany (albo podyktowany) tekst znikał do czasu, aż
      // autozapis wróci ze zdarzeniem — wyglądało to jak „mikrofon nie tworzy
      // notatki" (uwaga właściciela 06.09 15:10).
      answerText: draftAnswerText[q.questionId] ?? text,
      evidenceState: evidenceStateFor(events, activeArea.id, activeProgression.blockedAtLevel),
      evidenceCount: evidenceCountForUnit,
      evidenceStrength: evidenceStrengthForUnit,
      evidenceItems: evidenceItemsForUnit,
    };
  });

  const isOnline = state?.status !== 'offline' && state?.status !== 'recovery';
  const canWrite = (state?.roles ?? []).some((role) =>
    ['owner', 'lead_assessor', 'assessor', 'respondent', 'evidence_owner'].includes(role)
  );

  // ★ FALA J2 — patrz `frozenViewModeAppliedRef` wyżej. Sama flaga
  // `sesjaZamrozona` jest od fali J3 zadeklarowana WYŻEJ (przed drzewem
  // nawigatora i przed poziomem ogniskowym, które też jej potrzebują) —
  // jedna deklaracja na ekran, nie dwie.
  useEffect(() => {
    if (frozenViewModeAppliedRef.current) return;
    if (initialViewMode) return;
    if (!sesjaZamrozona) return;
    frozenViewModeAppliedRef.current = true;
    setViewMode('report');
  }, [initialViewMode, sesjaZamrozona]);

  const {
    state: saveState,
    lastSavedAt,
    errorMessage: saveErrorMessage,
    markDirty,
    saveNow,
    cancelPending,
    acknowledgeFailure,
  } = useMethodWorkspaceSave({
    isOnline,
    debounceMs: 800,
    save: async () => {
      if (!runtime || !canWrite) return { ok: false, error: 'Sesja jest tylko do odczytu.' };
      const entry = Object.entries(draftAnswerText).find(([qid]) =>
        focusQuestions.some((q) => q.questionId === qid)
      );
      if (!entry) return { ok: true };
      const [questionId, text] = entry;
      // ★ P-P04 (pilotaż Pawła 14.09: „zmieniam Partially na Confirmed i po
      // sekundzie wraca na Partially").
      //
      // ZMIERZONA PRZYCZYNA: autozapis szkicu wysyłał ZAWSZE
      // `answerState: 'partial'`, a `questionAnswerState()` bierze OSTATNIE
      // zdarzenie odpowiedzi dla pytania. Kliknięcie stanu zapisywało
      // `ANSWER_CONFIRMED(confirmed)`, ale uzbrojony wcześniej debounce (800 ms)
      // dopisywał po nim `ANSWER_DRAFTED(partial)` — pigułka wracała na
      // „Częściowo", mimo że człowiek wybrał co innego.
      //
      // LEKARSTWO: szkic NIE decyduje o stanie odpowiedzi — przenosi stan już
      // wybrany. Czytamy go z refów (`chosenAnswerStateRef` / `eventsRef`), bo
      // `markDirty()` zamraża `save` z renderu sprzed wyboru — odczyt ze stałej
      // domknięcia dawałby znów „partial".
      const currentState = toDrdAnswerState(
        chosenAnswerStateRef.current[questionId] ?? questionAnswerState(eventsRef.current, questionId).state
      );
      try {
        await queueAnswerWrite(() =>
          runtime.recordAnswer({
            unitId: activeArea.id,
            level: focusLevelFallback,
            questionId,
            answerState: currentState,
            text,
            draft: true,
          })
        );
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Zapis nieudany.' };
      }
    },
  });

  // Single user-facing badge across the eight product states — a pure label
  // over `saveState` (kernel `MethodSaveState`, via `useMethodWorkspaceSave`
  // above) and the session runtime's connectivity status/pending-write queue.
  // See `useAssessmentSaveIndicator`'s header for the full mapping table.
  const { state: saveIndicatorState } = useAssessmentSaveIndicator({
    runtimeStatus: state?.status ?? 'loading',
    saveState,
    pendingWriteCount: state?.pendingWriteCount ?? 0,
    isReconciling,
  });

  const handleAnswerChange = useCallback(
    (questionId: string, text: string) => {
      setDraftAnswerText((prev) => ({ ...prev, [questionId]: text }));
      markDirty();
    },
    [markDirty]
  );

  const handleAnswerStateChange = useCallback(
    async (
      questionId: string,
      answerState: InterviewFocusQuestion['answerState'],
      justification?: string
    ) => {
      if (!answerState || !runtime || !canWrite) return;
      // Przypnij poziom ZANIM zdarzenie wróci — inaczej przeliczony
      // `blockedAtLevel` zdążyłby podmienić pytanie pod palcem.
      setPinnedFocus({ unitId: activeArea.id, level: focusLevelFallback });
      // P-P04: zapamiętaj wybór NATYCHMIAST, żeby autozapis szkicu (debounce
      // ze starego domknięcia) go nie cofnął, zanim zdarzenie wróci z serwera.
      chosenAnswerStateRef.current[questionId] = answerState;
      cancelPending();
      await queueAnswerWrite(() =>
        runtime.recordAnswer({
          unitId: activeArea.id,
          level: focusLevelFallback,
          questionId,
          answerState: toDrdAnswerState(answerState),
          text: draftAnswerText[questionId],
          justification,
        })
      );
    },
    [
      runtime,
      canWrite,
      activeArea.id,
      focusLevelFallback,
      draftAnswerText,
      cancelPending,
      queueAnswerWrite,
    ]
  );

  const handleEvidenceDrop = useCallback(
    async (questionId: string, files: FileList) => {
      const file = files[0];
      if (!file || !runtime || !canWrite) return;
      await runtime.recordEvidence({
        unitId: activeArea.id,
        level: focusLevelFallback,
        evidenceId: `${questionId}:${file.name}:${Date.now()}`,
        evidenceType: 'document',
        strength: 'E2',
        linkedQuestionIds: [questionId],
      });
    },
    [runtime, canWrite, activeArea.id, focusLevelFallback]
  );

  const handleEvidenceRemove = useCallback(
    async (_questionId: string, evidence: EvidenceListItem) => {
      if (!runtime || !canWrite) return;
      await runtime.removeEvidence({
        unitId: activeArea.id,
        level: focusLevelFallback,
        evidenceId: evidence.evidenceId,
        removedEventId: evidence.eventId,
      });
    },
    [runtime, canWrite, activeArea.id, focusLevelFallback]
  );

  // ★ „Zapytaj Teresę" (uwaga właściciela 06.09 15:10: „on w ogóle nie jest
  // aktywny"). PRZYCZYNA: wołacz istniał i wołał `runtime.createTeresaPreview`,
  // ale panel, który jako JEDYNY rysował te propozycje, został wyjęty z
  // powłoki hotfixem 30eb0a1140 — wynik nie miał gdzie się pokazać. Zamiast
  // wracać z panelem do nagłówka, kierujemy pytanie tam, gdzie wg DEC-404
  // mieszka wejście do Teresy: globalny dok czatu (Menu 1), z kontekstem
  // pytania. Żadnego drugiego czatu nie budujemy.
  //
  // Brak `canWrite` w warunku jest celowy: pytanie do Teresy to akcja
  // CZYTAJĄCA — sesja tylko do odczytu nie może odbierać prawa do pomocy.
  const openChatWithContext = useOpenChatWithContext();

  const handleAskTeresa = useCallback(
    async (
      questionId: string,
      topic: 'explain' | 'compare_levels' | 'examples' = 'explain'
    ) => {
      const question =
        focusQuestions.find((q) => q.questionId === questionId) ?? focusQuestions[0] ?? null;
      // GRANICE JĘZYKOWE (KANON_Z_ODBIOROW.md): angielskie nazwy obszarów/osi
      // są wiodące w metodyce — namePL tylko gdy UI faktycznie jest po polsku.
      const unitName = isPolish ? activeArea.namePL || activeArea.name : activeArea.name;
      const axisName = isPolish ? activeAxis.namePL || activeAxis.name : activeAxis.name;
      const currentAnswer = (draftAnswerText[questionId] ?? questionAnswerState(events, questionId).text ?? '').trim();
      const wording =
        question?.canonicalWording ?? t('assessment.drd.teresaPrompt.missingWording', '(question text unavailable)');
      const ask =
        topic === 'compare_levels'
          ? t('assessment.drd.teresaPrompt.compareLevels', {
              lower: focusLevelFallback - 1,
              level: focusLevelFallback,
              upper: focusLevelFallback + 1,
              defaultValue:
                'Explain the difference between level {{lower}}, {{level}} and {{upper}} for this unit.',
            })
          : topic === 'examples'
            ? t(
                'assessment.drd.teresaPrompt.askExamples',
                'Give concrete examples and evidence I should look for on this question.'
              )
            : t(
                'assessment.drd.teresaPrompt.askExplain',
                'Explain this question and suggest how to answer it reliably.'
              );

      const teresaPrompt = [
        t('assessment.drd.teresaPrompt.context', {
          axisName,
          defaultValue: 'Method: DRD (Digital Readiness Diagnostic), axis: {{axisName}}.',
        }),
        t('assessment.drd.teresaPrompt.unitLine', {
          unitName,
          unitId: activeArea.id,
          level: focusLevelFallback,
          defaultValue: 'Unit: {{unitName}} ({{unitId}}), level: {{level}}.',
        }),
        t('assessment.drd.teresaPrompt.questionLine', {
          wording,
          defaultValue: 'Question: {{wording}}',
        }),
        currentAnswer
          ? t('assessment.drd.teresaPrompt.currentAnswer', {
              answer: currentAnswer,
              defaultValue: 'My current answer: {{answer}}',
            })
          : t('assessment.drd.teresaPrompt.currentAnswerEmpty', 'My current answer: (still empty)'),
        ask,
      ].join('\n');

      await openChatWithContext({
        entityType: 'assessment',
        entityId: state?.session?.id ?? activeArea.id,
        entityName: `Ocena DRD — ${unitName}`,
        pmoContext: state?.session?.id ? { assessmentId: state.session.id } : undefined,
        reuseActiveConversation: true,
        contextData: {
          methodPackId: DRD_METHOD_PACK_ID,
          methodName: 'DRD — Digital Readiness Diagnostic',
          axisName,
          unitId: activeArea.id,
          unitName,
          level: focusLevelFallback,
          questionId,
          questionWording: wording,
          currentAnswer,
          topic,
          teresaPrompt,
        },
      });
    },
    [
      openChatWithContext,
      focusQuestions,
      activeArea.id,
      activeArea.name,
      activeArea.namePL,
      activeAxis.name,
      activeAxis.namePL,
      focusLevelFallback,
      draftAnswerText,
      events,
      state?.session?.id,
    ]
  );

  /**
   * ★ FALA F2 (2026-09-15) — RODZEŃSTWO P-P21. „Dalej" na OSTATNIEJ jednostce
   * osi nie robiło NIC (ślepy zaułek: `activeAxis.areas[idx + 1]` to
   * `undefined`), więc człowiek musiał sięgnąć po drzewo. Nawigacja idzie
   * teraz po PŁASKIEJ liście jednostek całej struktury: koniec osi przechodzi
   * do pierwszej jednostki osi następnej, a koniec CAŁOŚCI otwiera panel
   * gotowości sesji (jedyne sensowne „co dalej" po ostatnim pytaniu).
   * „Wstecz" z pierwszej jednostki osi wraca na ostatnią jednostkę osi
   * poprzedniej; z pierwszej jednostki całości nie robi nic (jak dotąd).
   */
  const flatUnits = useMemo(
    () =>
      DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => ({ axisId: axis.id, areaId: area.id }))),
    []
  );

  const handleUnitNav = useCallback(
    (direction: 1 | -1) => {
      const idx = flatUnits.findIndex((u) => u.areaId === activeArea.id);
      const target = idx === -1 ? undefined : flatUnits[idx + direction];
      // Zmiana jednostki zawsze zdejmuje przypięcie poziomu — inaczej powrót
      // do tej jednostki otworzyłby stary, już odpowiedziany poziom.
      if (target) {
        setPinnedFocus(null);
        if (target.axisId !== activeAxisId) setActiveAxisId(target.axisId);
        setActiveUnitId(target.areaId);
        return;
      }
      // Ostatnia jednostka całości + „Dalej" = koniec wywiadu.
      if (direction === 1 && idx === flatUnits.length - 1) {
        setPinnedFocus(null);
        setAnalizaOtwarta(true);
      }
    },
    [flatUnits, activeArea.id, activeAxisId]
  );

  const handleBack = useCallback(() => handleUnitNav(-1), [handleUnitNav]);

  /**
   * „Dalej" — JEDYNE wyjście z przypiętego pytania (DEC-415c).
   *
   * Gdy odpowiedź otworzyła w TEJ SAMEJ jednostce kolejny poziom (przypięty
   * poziom ≠ wyliczony), pierwsze „Dalej" odpina i pokazuje ten nowy poziom —
   * czyli robi to, co wcześniej działo się samo, tyle że na żądanie człowieka.
   * Gdy nic się nie otworzyło (odpowiedź „Nie", „Nie wiem", pusty stan),
   * „Dalej" idzie do następnej jednostki dokładnie jak dotąd.
   */
  const handleNext = useCallback(() => {
    const pinnedHere = pinnedFocus && pinnedFocus.unitId === activeArea.id;
    if (pinnedHere && derivedFocusLevel !== pinnedFocus.level) {
      setPinnedFocus(null);
      return;
    }
    setPinnedFocus(null);
    handleUnitNav(1);
  }, [pinnedFocus, activeArea.id, derivedFocusLevel, handleUnitNav]);

  const handleLevelDecision = useCallback(
    async (decision: DrdLevelDecision, text: string) => {
      const questionId = focusQuestions[0]?.questionId;
      if (!questionId || !runtime || !canWrite || !state?.session) return;
      const session = state.session;

      const answerState = decision === 'yes' ? 'confirmed' : decision === 'no' ? 'no' : 'dont_know';
      const helpDecisionSignature = JSON.stringify({ answerState, text });
      chosenAnswerStateRef.current[questionId] = answerState;
      cancelPending();
      const answerAlreadyPersisted =
        decision === 'help' &&
        savedHelpDecisionRef.current[questionId] === helpDecisionSignature;

      try {
        await persistDrdLevelDecision({
          recordAnswer: async () => {
            if (answerAlreadyPersisted) return;
            await queueAnswerWrite(() =>
              runtime.recordAnswer({
                unitId: activeArea.id,
                level: focusLevelFallback,
                questionId,
                answerState,
                text,
                justification:
                  decision === 'help'
                    ? `${DRD_HELP_JUSTIFICATION_MARKER} Evidence owner task requested.`
                    : undefined,
              })
            );
            if (decision === 'help') {
              savedHelpDecisionRef.current[questionId] = helpDecisionSignature;
            } else {
              // A previously persisted Help may still be waiting for its task
              // retry. Once the operator successfully saves a different decision,
              // that retry token is stale and must not suppress a later Help
              // answer for the same question.
              delete savedHelpDecisionRef.current[questionId];
            }
          },
          afterPersist:
            decision === 'help'
              ? async () => {
                  const roleRoster = await Api.get(`/method/sessions/${session.id}/roles`);
                  const evidenceOwnerId = pickDrdEvidenceOwnerId(
                    roleRoster,
                    session.ownerUserId
                  );
                  await Api.post('/tasks', {
                    title: t(
                      'assessment.drd.levelInterview.helpTaskTitle',
                      'Evidence needed: {{area}}, level {{level}}',
                      {
                        area: nazwaWJezyku(activeArea.namePL, activeArea.name, isPolish),
                        level: focusLevelFallback,
                      }
                    ),
                    description: t(
                      'assessment.drd.levelInterview.helpTaskDescription',
                      'Resolve the open evidence question for DRD session {{sessionId}}, area {{area}}, level {{level}}.',
                      { sessionId: session.id, area: activeArea.id, level: focusLevelFallback }
                    ),
                    status: 'todo',
                    priority: 'medium',
                    projectId: session.projectId ?? null,
                    assigneeId: evidenceOwnerId,
                    source: 'assessment',
                    sourceType: 'method_session',
                    sourceId: session.id,
                    idempotencyKey: `drd-help:${session.id}:${activeArea.id}:${focusLevelFallback}`,
                  });
                }
              : undefined,
        });
      } catch (error) {
        if (error instanceof DrdPostPersistActionError) {
          throw new DrdLevelDecisionSaveError(
            `${t('common.saved')}. ${t('documents.taskCreateFailed')}`
          );
        }
        throw error;
      }

      if (decision === 'help') {
        delete savedHelpDecisionRef.current[questionId];
      }

      if (decision === 'yes') {
        const nextLevel = activeArea.levels.find((item) => item.level === focusLevelFallback + 1);
        if (nextLevel) setPinnedFocus({ unitId: activeArea.id, level: nextLevel.level });
        else handleUnitNav(1);
      } else if (decision === 'no') {
        setPinnedFocus(null);
        handleUnitNav(1);
      } else {
        setPinnedFocus({ unitId: activeArea.id, level: focusLevelFallback });
      }
    },
    [
      activeArea,
      canWrite,
      cancelPending,
      focusLevelFallback,
      focusQuestions,
      handleUnitNav,
      isPolish,
      runtime,
      queueAnswerWrite,
      state?.session,
      t,
    ]
  );

  // DEC-2026-08-25-55: skip requires one of the 4 dictionary codes (enforced
  // by InterviewFocusPanel's select) — recorded as a real `recordAnswer` call
  // over the SAME HTTP endpoint as every other answer, then the workspace
  // advances like `onNext`.
  const handleSkip = useCallback(
    async (reasonCode: DrdSkipReasonCode) => {
      const questionId = focusQuestions[0]?.questionId;
      if (questionId && runtime && canWrite) {
        await persistDrdLevelDecision({
          recordAnswer: () => runtime.recordAnswer({
            unitId: activeArea.id,
            level: focusLevelFallback,
            questionId,
            answerState: 'dont_know',
            text: draftAnswerText[questionId],
            justification: formatSkipJustification(reasonCode),
          }),
        });
        const sessionId = state?.session?.id;
        if (sessionId) {
          const idempotencyKey = `skip-code:${sessionId}:${activeArea.id}:${questionId}:${focusLevelFallback}:${newIdempotencyKey()}`;
          const input = {
            unitId: activeArea.id,
            questionId,
            level: focusLevelFallback,
            skipCode: reasonCode,
          } as const;
          setSkipWriteError(false);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await recordAssessmentSkipReason(sessionId, input, idempotencyKey);
              break;
            } catch (error) {
              const retryable =
                isOfflineError(error) ||
                (error instanceof MethodCoreApiError && error.status >= 500);
              if (!retryable || attempt === 1) {
                setSkipWriteError(true);
                break;
              }
            }
          }
        }
      }
      handleUnitNav(1);
    },
    [
      runtime,
      canWrite,
      activeArea.id,
      focusLevelFallback,
      focusQuestions,
      draftAnswerText,
      handleUnitNav,
      state?.session?.id,
    ]
  );

  // Only `ask_teresa` has a real backend today (Teresa preview pipeline,
  // already wired above). `request_evidence`/`return_later` are logged as a
  // real, persisted `recordAnswer` note on the SAME question over the SAME
  // HTTP endpoint (honest audit trail, no new mechanism invented).
  // `assign_question` has no per-question assignee anywhere in the app —
  // ResolutionCard renders it disabled ("Planowane") instead of pretending
  // it does something.
  const handleResolutionAction = useCallback(
    async (questionId: string, action: ResolutionAction) => {
      if (action === 'ask_teresa') {
        await handleAskTeresa(questionId);
        return;
      }
      if (action === 'assign_question') return;
      if (!runtime || !canWrite) return;
      const note =
        action === 'request_evidence'
          ? t(
              'assessment.drd.http.resolution.requestEvidence',
              'Evidence requested from the process owner.'
            )
          : t(
              'assessment.drd.http.resolution.returnLater',
              'Deferred — come back to this question later.'
            );
      await runtime.recordAnswer({
        unitId: activeArea.id,
        level: focusLevelFallback,
        questionId,
        answerState: 'dont_know',
        text: draftAnswerText[questionId],
        justification: note,
        draft: true,
      });
      if (action === 'return_later') handleUnitNav(1);
    },
    [
      runtime,
      canWrite,
      activeArea.id,
      focusLevelFallback,
      draftAnswerText,
      handleAskTeresa,
      handleUnitNav,
    ]
  );

  const handleCommit = useCallback(
    async (request: TeresaCommitRequest) => {
      if (!runtime || !canWrite) return;
      const outcome = await runtime.commitTeresaPreview({
        previewId: request.previewId,
        decision: request.decision,
        editedChanges: request.editedChanges,
      });
      if (
        outcome.ok &&
        (request.decision === 'accept' || request.decision === 'accept_with_edits')
      ) {
        const preview = pendingPreviews.find((p) => p.previewId === request.previewId);
        const change = preview?.proposedChanges.find((c) => c.target === 'score_proposal');
        if (preview && change && typeof change.after === 'number') {
          await runtime.recordAnswer({
            unitId: preview.intent.unitId ?? activeArea.id,
            level: change.after,
            questionId: preview.intent.questionId ?? `${activeArea.id}-L${change.after}-Q1`,
            answerState: 'confirmed',
            text: t(
              'assessment.drd.http.teresa.confirmedAfterAccept',
              'Confirmed after accepting Teresa’s proposal (a human decision).'
            ),
          });
        }
      }
    },
    [runtime, canWrite, pendingPreviews, activeArea.id]
  );

  const readiness: MethodReadiness = useMemo(() => {
    const totalUnits = pack.units.length;
    let answeredUnits = 0;
    let unitsMissingEvidence = 0;
    let answeredUnitsMissingEvidence = 0;
    for (const unit of pack.units) {
      const confirmed = events.filter(
        (e) => e.type === 'ANSWER_CONFIRMED' && e.unitId === unit.unitId
      );
      const hasEvidence = evidenceEventsFor(events, unit.unitId).length > 0;
      if (confirmed.length > 0) answeredUnits++;
      if (!hasEvidence) unitsMissingEvidence++;
      if (confirmed.length > 0 && !hasEvidence) answeredUnitsMissingEvidence++;
    }
    const freezeBlockers: string[] = [];
    if (answeredUnits === 0)
      freezeBlockers.push(
        t(
          'assessment.drd.http.blockers.noConfirmedUnits',
          'No confirmed units — the interview has not started yet.'
        )
      );
    if (answeredUnitsMissingEvidence > 0)
      freezeBlockers.push(
        t('assessment.drd.http.blockers.unitsWithoutEvidence', '{{count}} answered units without evidence', {
          count: answeredUnitsMissingEvidence,
        })
      );
    if (pendingPreviews.length > 0)
      freezeBlockers.push(
        t('assessment.drd.http.blockers.pendingProposals', '{{count}} Teresa proposals awaiting a decision', {
          count: pendingPreviews.length,
        })
      );
    const openHelpCount = pack.units.reduce(
      (count, unit) =>
        count + [...drdLevelDecisions(events, unit.unitId).values()].filter((decision) => decision === 'help').length,
      0
    );
    if (openHelpCount > 0)
      freezeBlockers.push(
        t('assessment.drd.levelInterview.helpBlocker', '{{count}} open evidence help request(s)', {
          count: openHelpCount,
        })
      );
    const frozenAlready = state?.session?.state === 'frozen' || state?.session?.state === 'closed';
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: frozenAlready ? [] : freezeBlockers,
    };
  }, [events, pack.units, pendingPreviews.length, state?.session?.state, t]);

  const activeAreaName = nazwaWJezyku(activeArea.namePL, activeArea.name, isPolish);
  const activeAxisName = nazwaWJezyku(activeAxis.namePL, activeAxis.name, isPolish);
  const teresaSixQuestions = {
    whereAreWe: t(
      'assessment.drd.http.teresa.whereAreWe',
      'DRD session, unit {{unit}}, level {{level}}. {{answered}}/{{total}} units touched.',
      {
        unit: activeAreaName,
        level: focusLevelFallback,
        answered: readiness.answeredUnits,
        total: readiness.totalUnits,
      }
    ),
    whatMattersNow:
      focusQuestions[0]?.canonicalWording ??
      t('assessment.drd.http.teresa.noQuestions', 'No questions at this level.'),
    why: activeAxisName
      ? t(
          'assessment.drd.http.teresa.why',
          'Axis “{{axis}}” needs this unit confirmed to unlock the next levels.',
          { axis: activeAxisName }
        )
      : '',
    whatIsMissing:
      evidenceCountForUnit === 0
        ? t('assessment.drd.http.teresa.noEvidence', 'No evidence for this unit.')
        : t('assessment.drd.http.teresa.evidenceCollected', '{{count}} piece(s) of evidence collected.', {
            count: evidenceCountForUnit,
          }),
    nextSafeAction:
      pendingPreviews.length > 0
        ? t('assessment.drd.http.teresa.decidePending', 'Decide on Teresa’s pending proposals.')
        : t(
            'assessment.drd.http.teresa.answerOrAttach',
            'Answer the current question or attach evidence.'
          ),
  };


  // ── „Pracuj z AI" w nagłówku sesji (DEC-415c, K2) ─────────────────────────
  //
  // Trzy pozycje narzuca współdzielony `PracujZAI` — ten ekran tylko DEKLARUJE,
  // co pod nimi stoi, i oddaje JEDNĄ drogę zapisu. Zero nowych silników AI:
  //
  //  · Analizuj              → panel oceny gotowości sesji zbudowany z JUŻ
  //    liczonych w tym pliku `readiness` (MethodReadiness) i
  //    `teresaSixQuestions`. Czyta, nie zapisuje — jedyna pozycja dostępna bez
  //    prawa edycji (Zasada 2b).
  //  · Uzupełnij tę sekcję   → propozycja treści do pola „Twoja odpowiedź"
  //    BIEŻĄCEGO pytania, z istniejącego generatora `generujTrescPola`
  //    (`POST /ai/refine-text`, tryb generate) — domyślnego dla `PracujZAI`.
  //  · Uzupełnij cały dokument → to samo dla wszystkich pytań BIEŻĄCEJ
  //    jednostki (wszystkie poziomy), jeden podgląd i jedno „Zatwierdź".
  //
  // ★ DLACZEGO NIE `runtime.createTeresaPreview`: zmierzone 06.09 —
  // `POST /api/method/sessions/:id/teresa/preview`
  // (server/src/routes/method-core.routes.ts:1338) NIE generuje treści; zapisuje
  // propozycję, którą klient PRZYSYŁA (statements/proposedChanges w body). Jako
  // „silnik pisania odpowiedzi" byłby atrapą. Generatorem tekstu w tej aplikacji
  // jest `generujTrescPola` i to on tu pracuje.
  //
  // ★ ZAPIS NIE ZMIENIA STANU ODPOWIEDZI: „Zatwierdź" wpisuje tekst do pola
  // (`draftAnswerText` + `markDirty`) — dokładnie tak, jakby człowiek go
  // wpisał. Świadomie NIE wołamy `runtime.recordAnswer`, bo szkic leci tam z
  // `answerState: 'partial'`, co przestawiłoby pigułkę stanu na „Częściowo"
  // za człowieka (`questionAnswerState` czyta `ANSWER_DRAFTED`).
  const unitQuestions = useMemo(
    () => pack.questions.filter((q) => q.unitId === activeArea.id),
    [activeArea.id]
  );

  const poleZPytania = useCallback(
    (q: (typeof pack.questions)[number]): PoleDoUzupelnienia => ({
      id: q.questionId,
      etykieta: t('assessment.drd.http.field.answerTo', 'Answer to the question: “{{question}}”', {
        question: q.canonicalWording,
      }),
      wartosc: draftAnswerText[q.questionId] ?? questionAnswerState(events, q.questionId).text ?? '',
      format: 'paragraph',
      sekcjaId: q.questionId,
      sekcjaEtykieta: t('assessment.drd.http.field.level', 'Level {{level}}', { level: q.level }),
    }),
    [draftAnswerText, events]
  );

  const zastosujPropozycje = useCallback(
    (poleId: string, wartosc: string): boolean => {
      if (!canWrite) return false;
      setDraftAnswerText((prev) => ({ ...prev, [poleId]: wartosc }));
      markDirty();
      return true;
    },
    [canWrite, markDirty]
  );

  const zrodloSekcjaAI: ZrodloUzupelnienia = useMemo(
    () => ({
      rodzaj: 'pola',
      pola: ({ sekcjaId }) => {
        const q = unitQuestions.find((x) => x.questionId === sekcjaId);
        return q ? [poleZPytania(q)] : [];
      },
      zastosuj: zastosujPropozycje,
    }),
    [unitQuestions, poleZPytania, zastosujPropozycje]
  );

  const zrodloDokumentAI: ZrodloUzupelnienia = useMemo(
    () => ({
      rodzaj: 'pola',
      pola: () => unitQuestions.map(poleZPytania),
      zastosuj: zastosujPropozycje,
    }),
    [unitQuestions, poleZPytania, zastosujPropozycje]
  );

  // -- render: bootstrap phases (no runtime state yet, or a hard boot error) --
  if (bootError) {
    return (
      <ErrorRetryView
        message={t('assessment.drd.http.boot.createFailedWithReason', 'The session could not be created: {{reason}}', {
          reason: bootError,
        })}
        onRetry={() => window.location.reload()}
        onExit={onExit ?? (() => {})}
      />
    );
  }
  if (!state) {
    return <BootstrapLoadingView label={t('assessment.drd.http.bootstrap.creatingSession', 'Creating session…')} />;
  }

  // -- render: runtime-level states that pre-empt the shell -------------------
  if (state.status === 'loading' && !state.session) {
    return <BootstrapLoadingView label={t('assessment.drd.http.bootstrap.loadingFromServer', 'Loading session from server…')} />;
  }
  if (state.status === 'conflict') {
    return (
      <ConflictView
        state={state}
        onExit={onExit ?? (() => {})}
        onLoadServerVersion={() =>
          void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())
        }
      />
    );
  }
  if (state.status === 'recovery') {
    return (
      <RecoveryQueueView
        state={state}
        onApplyPending={() =>
          void runReconciliation(() => runtime?.retryPending() ?? Promise.resolve())
        }
        onDiscardPending={() =>
          void runReconciliation(
            () => runtime?.discardPendingAndReloadServer() ?? Promise.resolve()
          )
        }
      />
    );
  }
  // 1.1-Z4 D3 (a/c) — REGRESJA (commit 915cf63a5b, "cut over mounted DRD to
  // method core"): `state.status === 'offline'` tu zwracało pełnoekranowy
  // `ErrorRetryView`, blokując CAŁĄ powłokę (sesja znikała z ekranu). To
  // wprost zaprzecza komentarzowi trzy linijki niżej ("'offline' (queued
  // writes, still show the last known session so work is never blocked)")
  // i scenariuszowi 1 z brief S3 ("utrata API w trakcie pracy: OFFLINE,
  // praca nie ginie") — offline queuing (`useMethodWorkspaceSave`'s
  // OFFLINE_PENDING) istnieje właśnie po to, żeby edycja offline działała i
  // czekała na reconciliation, nie żeby ekran zamieniał się w tryb
  // wyłącznie-do-odczytu. Naprawa: offline NIE jest już wczesnym returnem —
  // spada do głównego renderu niżej, z `OfflineBanner` (patrz poniżej) zamiast
  // blokady całego widoku.
  if (state.status === 'error' && !state.session) {
    return (
      <ErrorRetryView
        message={state.error ?? t('assessment.drd.http.state.unknownError', 'Unknown error.')}
        onRetry={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())}
        onExit={onExit ?? (() => {})}
      />
    );
  }

  const session = state.session;
  const assessmentReportEnabled = isAssessmentReportViewEnabled();
  if (!session) {
    return <BootstrapLoadingView label={t('assessment.drd.http.bootstrap.loadingSession', 'Loading session…')} />;
  }

  // status is 'ready' (with a possibly-error-decorated retry still showing
  // the last known session), 'offline' (queued writes, still show the last
  // known session so work is never blocked), or a transient 'loading' with a
  // session already known (handled by the shell's own `loading` prop below).
  // P-P03: przejściowe `loading` PO ZAPISIE (runWrite -> refresh) to wciąż
  // ostatni potwierdzony przez serwer obraz — plakietka „SZKIC ODZYSKIWANIA"
  // przy każdym naciśnięciu klawisza była nieprawdą i wyglądała jak awaria.
  const sourceKind =
    state.status === 'ready' || (state.status === 'loading' && Boolean(state.session))
      ? 'SERVER'
      : 'RECOVERY_DRAFT';

  /**
   * ★ FALA J2 — „dramat właściciela": do 14.09 ten warunek był WCZESNYM
   * RETURNEM na `FrozenOutputHttpView`, czyli sesja frozen/closed pokazywała
   * surowy zrzut kontraktu (`AssessmentOutput (immutable, v1)`, `contentHash`,
   * `scope`, `limitations`, tabela UNIT/CURRENT/TARGET/GAP) ZAMIAST produktu.
   * To slice A6 z 13.08 (`0a4a0719f7`, „small, token-compliant, additive
   * views") — widok dla programisty, a wychodził PRZED `MethodWorkspaceShell`,
   * więc razem z nim znikały zakładki Wywiad · Macierz · Raport.
   *
   * Teraz sesja zamrożona ZOSTAJE w powłoce (te same zakładki, tylko do
   * odczytu, z jawnym powodem „sesja jest zamrożona"), a domyślną zakładką
   * jest „Raport" z kanonicznym dokumentem wyniku. Surowy widok NIE ZNIKA:
   * mieszka pod „Szczegóły techniczne" w Ustawieniach powłoki, a pełny ekran
   * (dla diagnostyki) wraca wyłącznie przez awaryjne `?ff_drdFrozenRaw=1`.
   */
  /**
   * Czy pokazywać plakietki diagnostyczne („SERVER DATA" / stan zapisu).
   * Domyślnie: TAK w dev (i w harnessie/testach, gdzie `import.meta.env.DEV`
   * jest prawdą), NIE na zbudowanym produkcie. Awaryjnie na żywo:
   * `?ff_debugBadges=1`.
   */
  const plakietkiDiagnostyczne = (() => {
    let zadane: string | null = null;
    try {
      zadane = new URLSearchParams(window.location.search).get('ff_debugBadges');
    } catch {
      zadane = null;
    }
    // Parametr rozstrzyga w OBIE strony: `=1` włącza na zbudowanym produkcie,
    // `=0` wyłącza w dev — bez tego drugiego harness zrzutów (który jest dev)
    // nie potrafiłby pokazać właścicielowi obrazu, jaki zobaczy klient.
    if (zadane === '1') return true;
    if (zadane === '0') return false;
    return Boolean(import.meta.env.DEV);
  })();

  const isFrozen = session.state === 'frozen' || session.state === 'closed';
  const surowyWidokZadany =
    isFrozen &&
    (() => {
      try {
        return new URLSearchParams(window.location.search).get('ff_drdFrozenRaw') === '1';
      } catch {
        return false;
      }
    })();

  const wygenerujRaportZOutputu = () =>
    canWrite
      ? runtime?.generateReport({
          title: t('assessment.drd.http.generated.reportTitle', 'DRD report'),
          content: {
            executiveSummary: t(
              'assessment.drd.http.generated.reportSummary',
              'DRD session — partial result.'
            ),
            participants: ['Piotr (Owner)', 'Anna (Approver)'],
            strengths: [
              t(
                'assessment.drd.http.generated.reportStrength',
                'The sales process has basic documentation.'
              ),
            ],
          },
        })
      : undefined;

  const frozenRawView = (embedded: boolean) => (
      <FrozenOutputHttpView
        state={state}
        sourceKind={sourceKind}
        embedded={embedded}
        onGenerateReport={() => void wygenerujRaportZOutputu()}
        onGenerateInitiative={() =>
          canWrite
            ? runtime?.generateInitiativeDraft({
                title: t(
                  'assessment.drd.http.generated.initiativeTitle',
                  'Complete the sales process automation in the CRM'
                ),
                findingIds: (state.output?.findings ?? []).map((f) => f.id),
                rationale: t(
                  'assessment.drd.http.generated.initiativeRationale',
                  'The Output findings show a gap between current and target.'
                ),
                expectedOutcome: t(
                  'assessment.drd.http.generated.initiativeOutcome',
                  'Raising the maturity level.'
                ),
                confidence: 'medium',
              })
            : undefined
        }
        readOnly={!canWrite}
        onExit={onExit ?? (() => {})}
      />
  );

  if (surowyWidokZadany) return frozenRawView(false);

  /**
   * Zakładka „Raport" dla sesji zamrożonej = KANONICZNY dokument wyniku
   * (`AssessmentReportView` → `AssessmentReportDocument`), ten sam, który
   * otwiera zakładka Outputs przez `/assessment/outputs/:outputId/report`.
   * Bez outputu — kanoniczny stan pusty z uczciwym opisem i akcją, nigdy
   * cisza ani udawany dokument.
   */
  const frozenReportContent = state.output ? (
    <Suspense
      fallback={
        <div
          className="m-6 h-24 animate-pulse rounded-xl border border-c-border-subtle bg-c-surface-raised"
          aria-busy="true"
        />
      }
    >
      <AssessmentOutputReportDocumentView outputId={state.output.id} />
    </Suspense>
  ) : (
    <EmptyState
      variant="new"
      icon={FileText}
      title={t(
        'assessment.drd.http.frozen.reportEmpty.title',
        'There is no frozen result for this session yet'
      )}
      description={t(
        'assessment.drd.http.frozen.reportEmpty.description',
        'The session is frozen on the server, but its Output has not been found — the report is built from the Output, never from a local copy. Refresh the session, or generate the report once the Output is available.'
      )}
      primaryAction={
        canWrite
          ? {
              label: t(
                'assessment.drd.http.frozen.generateReport',
                'Generate a report from the Output'
              ),
              onClick: () => void wygenerujRaportZOutputu(),
              testId: 'drd-frozen-generate-report',
            }
          : undefined
      }
      secondaryAction={{
        label: t('assessment.drd.http.error.retryInline', 'Try again'),
        onClick: () => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve()),
      }}
    />
  );

  const canSendToReview = canWrite && session.state === 'active';
  const canSendBack = canWrite && session.state === 'in_review';
  // MVP-OWNER-FREEZE (2026-09-05). Do 05.09 warunkiem był WYŁĄCZNIE
  // `state.roles.includes('approver')` — a rola `approver` nie ma w tej
  // aplikacji ŻADNEGO ekranu, którym dałoby się ją komukolwiek nadać
  // (`POST /sessions/:id/roles` istnieje, ale nie ma wołacza w src/, a
  // samo-nadanie tej roli jest słusznie odmawiane). W organizacji z jednym
  // kontem przycisk „Zamroź" był więc wyłączony na zawsze, a razem z nim
  // Output, raport z oceny i prezentacja z oceny.
  //
  // Właściciel ORGANIZACJI jest teraz approverem ostatniej instancji —
  // decyzję egzekwuje serwer (`MethodSessionService.transition`, wiersz
  // ACTIVE/OWNER w `organization_members`), nie ten warunek. Tutaj rola z
  // magazynu odblokowuje wyłącznie WIDOK przycisku; gdyby serwer odmówił,
  // trafi to na pasek błędu nad warsztatem, a nie w ciszę.
  const canFreeze =
    session.state === 'in_review' && (state.roles.includes('approver') || isOrganizationOwner);

  return (
    <div className="flex h-full flex-col">
      {/* 1.1-Z4 D3 (a/c): both dropped in commit 915cf63a5b alongside the
          offline fail-closed regression fixed above. `OfflineBanner` was
          defined but never rendered (`OfflineBanner` — 0 call sites) — a
          dead component, exactly the "biblioteka bez wywołania" shape.
          `AssessmentSaveStateIndicator` was only ever mounted inside
          ConflictView/RecoveryQueueView; every other state (ready, offline,
          reconnecting, the SERVER settle after recovery) had no visible
          save-state badge at all. Both restored here, in the session
          header, across every non-conflict/non-recovery state — matching
          the original wiring (commit 150332ed5e) that this file's own
          `sourceKind` comment above still describes. */}
      {state.status === 'offline' && (
        <OfflineBanner
          onRetry={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())}
        />
      )}
      {/*
        ★ FALA J3 (2026-09-14) — PLAKIETKI DIAGNOSTYCZNE TYLKO DLA DIAGNOZY.
        Ta para („SERVER DATA" + „SERVER") stała w LEWYM GÓRNYM ROGU ekranu
        sesji na każdym zrzucie odbioru (zmierzone: staging a2b0a0fe32, sesja
        381966f5) — czytelnik zamrożonej oceny widział słownik wewnętrzny
        zamiast produktu. Sam plik `DrdSourceIndicator` nazywa się w nagłówku
        „dev/telemetry badge"; tu tylko przestajemy pokazywać go klientowi.
        NIE USUWAMY go: w dev jest dalej domyślnie, a na żywo wraca awaryjnie
        przez `?ff_debugBadges=1` — tym samym mechanizmem, co `?ff_drdFrozenRaw=1`
        kilkadziesiąt linii wyżej.
        Zachowanie diagnostyczne bez zmian: `data-testid`/`data-source`
        istnieją dokładnie tak jak dotąd, gdy plakietki są widoczne.
      */}
      {plakietkiDiagnostyczne && (
        <div className="flex items-center gap-2 border-b border-c-border-subtle px-4 py-1">
          <DrdSourceIndicator
            source={sourceKind}
            title={
              sourceKind === 'SERVER'
                ? t('assessment.drd.http.source.server', 'Freshly confirmed by the server.')
                : t(
                    'assessment.drd.http.source.recovery',
                    'Not fully synchronised with the server.'
                  )
            }
          />
          <AssessmentSaveStateIndicator state={saveIndicatorState} />
        </div>
      )}
      {state.status === 'error' && state.error && (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-c-danger/30 bg-c-danger/10 px-4 py-1.5 text-xs text-c-danger"
        >
          <AlertTriangle size={12} />
          {state.error}
          <button
            type="button"
            onClick={() => void runReconciliation(() => runtime?.refresh() ?? Promise.resolve())}
            className="ml-auto rounded border border-c-danger/40 px-2 py-0.5 font-semibold hover:bg-c-danger/20"
          >
            {t('assessment.drd.http.error.retryInline', 'Try again')}
          </button>
        </div>
      )}
      {skipWriteError ? (
        <div
          role="alert"
          className="flex items-center gap-2 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-xs text-c-warning"
        >
          <AlertTriangle size={12} />
          {t('assessment.reportView.skipWriteError')}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <MethodWorkspaceShell
          session={session}
          methodName={pack.manifest.name}
          packVersionLabel={pack.manifest.version}
          readiness={readiness}
          mode={mode}
          onModeChange={setMode}
          onExit={onExit ?? (() => {})}
          saveState={saveState}
          saveLastSavedAt={lastSavedAt}
          saveErrorMessage={saveErrorMessage}
          onSaveNow={() => void saveNow()}
          onSaveRetry={() => void saveNow()}
          onSaveStay={acknowledgeFailure}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          /**
           * ★ P-P03 (pilotaż Pawła 14.09: „wpisanie odpowiedzi przeładowuje
           * sesję i gubi postęp").
           *
           * ZMIERZONA PRZYCZYNA: `DrdHttpSessionRuntime.runWrite()` po KAŻDYM
           * zapisie woła `refresh()`, a ten ustawia `status: 'loading'`. Przy
           * `Boolean(state.session)` powłoka dostawała `loading`, a
           * `MethodWorkspaceShell` zastępuje wtedy CAŁY warsztat napisem
           * „Loading session…". Panel wywiadu jest odmontowywany, więc jego
           * własny `activeSequenceIndex` wraca do zera — ekran „sam" cofa się
           * na Krok 1 w środku pisania (zmierzone: 5 wygaszeń na jedną frazę
           * przy 400 ms opóźnienia sieci).
           *
           * LEKARSTWO: pełnoekranowe „Loading session…" należy WYŁĄCZNIE do
           * bootstrapu (brak sesji — obsłużony wcześniejszym returnem). Gdy
           * sesja jest znana, warsztat zostaje zamontowany, a o trwającym
           * zapisie mówi plakietka zapisu (`saveState`) — nic nie znika.
           */
          loading={state.status === 'loading' && !state.session}
          // ★ FALA J2: zamrożona sesja jest tylko do odczytu NIEZALEŻNIE od
          // ról — serwer i tak odmówi zapisu, a ekran ma to napisać zanim
          // ktoś zacznie pisać w pole, które nic nie przyjmie.
          readOnly={!canWrite || isFrozen}
          readOnlyReason={
            isFrozen
              ? t(
                  'methodWorkspace.readOnly.frozen',
                  'Read only — the session is frozen; the result no longer changes'
                )
              : undefined
          }
          // 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md #5) —
          // see DrdMethodWorkspaceScreen.tsx's sibling comment: this
          // duplicated the header's own status pill, no separate fact left
          // to report.
          degradedMessage={null}
          aiButton={
            <PracujZAI
              onAnalizuj={() => setAnalizaOtwarta((v) => !v)}
              analizaOtwarta={analizaOtwarta}
              uzupelnijSekcje={zrodloSekcjaAI}
              uzupelnijDokument={zrodloDokumentAI}
              aktywnaSekcja={focusQuestions[0]?.questionId ?? null}
              kontekstArtefaktu={{
                type: 'assessment-question',
                title: `DRD · ${nazwaWJezyku(activeAxis.namePL, activeAxis.name, isPolish)} · ${nazwaWJezyku(activeArea.namePL, activeArea.name, isPolish)} — ${t('assessment.drd.level', 'Level').toLowerCase()} ${focusLevelFallback}`,
                status: session.state,
              }}
              moznaEdytowac={canWrite}
              powodTylkoOdczyt="Sesja jest tylko do odczytu — brak roli z prawem zapisu."
              isPolish={isPolish}
            />
          }
          navigatorProps={{
            nodes: navigatorNodes,
            activeUnitId: activeArea.id,
            onSelect: (unitId) => {
              const axis = DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === unitId));
              if (axis) setActiveAxisId(axis.id);
              setPinnedFocus(null);
              setActiveUnitId(unitId);
            },
          }}
          interviewProps={{
            breadcrumb: [
              nazwaWJezyku(activeAxis.namePL, activeAxis.name, isPolish),
              nazwaWJezyku(activeArea.namePL, activeArea.name, isPolish),
              t('assessment.drd.http.field.level', 'Level {{level}}', {
                level: focusLevelFallback,
              }),
            ],
            questions: interviewQuestions,
            questionIndex: focusLevelFallback - 1,
            questionTotal: activeArea.levels.length,
            resolutionData: {
              questionId: focusQuestions[0]?.questionId ?? '',
              whatIsUnknown: t(
                'assessment.drd.http.resolution.whatIsUnknown',
                'Whether unit {{unit}} meets the criteria of level {{level}}.',
                { unit: activeArea.id, level: focusLevelFallback }
              ),
              likelyOwnerLabel: t(
                'assessment.drd.http.resolution.likelyOwner',
                'Process owner'
              ),
              resolvingArtifactHint: t(
                'assessment.drd.http.resolution.artifactHint',
                'A procedure document or a screenshot from the system.'
              ),
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: handleAnswerChange,
            onAnswerStateChange: (qid, s, j) => void handleAnswerStateChange(qid, s, j),
            onResolutionAction: (qid, action) => void handleResolutionAction(qid, action),
            onEvidenceDrop: (qid, files) => void handleEvidenceDrop(qid, files),
            onEvidenceRemove: (qid, evidence) => void handleEvidenceRemove(qid, evidence),
            onBack: handleBack,
            onSave: () => void saveNow(),
            onNext: handleNext,
            onSkip: (reasonCode) => void handleSkip(reasonCode),
            onAskTeresa: (questionId, topic) => void handleAskTeresa(questionId, topic),
            canGoBack: true,
            canGoNext: true,
          }}
          interviewContent={
            drdInterviewV2 ? (
              <DrdLevelInterviewWorkspace
                axis={activeAxis}
                area={activeArea}
                levels={pack.levels
                  .filter((level) => level.unitId === activeArea.id)
                  .sort((a, b) => a.level - b.level)}
                questions={pack.questions.filter((question) => question.unitId === activeArea.id)}
                events={events}
                selectedLevel={focusLevelFallback}
                currentLevel={activeProgression.currentLevel}
                targetLevel={targetLevelFor(events, activeArea.id)}
                answerText={
                  focusQuestions[0]
                    ? draftAnswerText[focusQuestions[0].questionId] ??
                      questionAnswerState(events, focusQuestions[0].questionId).text
                    : ''
                }
                canWrite={canWrite && !isFrozen}
                onAnswerChange={handleAnswerChange}
                onSelectLevel={(level) => setPinnedFocus({ unitId: activeArea.id, level })}
                onSaveDecision={handleLevelDecision}
                onEvidenceDrop={(questionId, files) => void handleEvidenceDrop(questionId, files)}
                onAskTeresa={(questionId) => void handleAskTeresa(questionId)}
              />
            ) : undefined
          }
          teresaProps={{
            sixQuestions: teresaSixQuestions,
            proposalQueue: pendingPreviews,
            onCommit: (r) => void handleCommit(r),
            onTakeLead: () => setMode('teresa_led'),
            onLetMeWorkManually: () => setMode('guided_manual'),
            mode,
          }}
          // ★ MACIERZ WŁAŚCICIELA, NIE `LiveMatrix` (2026-09-05). Powód i dowód
          // pomiarowy w nagłówku `DrdOwnerMatrixPanel`. Selekcja, panel
          // szczegółów i Esc zostają te same — zmienia się rysunek, nie mechanika.
          matrixContent={
            <DrdOwnerMatrixPanel
              axisNumber={activeAxis.id}
              rows={matrixRows}
              selection={matrixSelection}
              onSelect={(sel) => {
                setMatrixSelection(sel);
                setPinnedFocus({ unitId: sel.unitId, level: sel.level });
                setActiveUnitId(sel.unitId);
                if (drdInterviewV2) setViewMode('interview');
              }}
              onCloseSideSheet={() => setMatrixSelection(null)}
              renderSideSheet={(selection, cell) => (
                <div className="text-xs text-c-text-secondary">
                  <p>
                    {t('assessment.drd.http.cell.line', '{{unit}} · level {{level}} — {{state}}', {
                      unit: selection.unitId,
                      level: selection.level,
                      state: cell?.blocker
                        ? t(
                            'assessment.drd.http.cell.blocker',
                            'BLOCKER (first unmet level)'
                          )
                        : cell?.reviewRequired
                          ? t(
                              'assessment.drd.http.cell.reviewRequired',
                              'above-gap: needs review'
                            )
                          : cell?.achieved
                            ? t('assessment.drd.http.cell.achieved', 'achieved')
                            : t('assessment.drd.http.cell.notAchieved', 'not achieved'),
                    })}
                  </p>
                </div>
              )}
            />
          }
          matrixProps={{
            rows: matrixRows,
            levels: matrixLevels,
            selection: matrixSelection,
            onSelect: (sel) => {
              setMatrixSelection(sel);
              setPinnedFocus({ unitId: sel.unitId, level: sel.level });
              setActiveUnitId(sel.unitId);
              if (drdInterviewV2) setViewMode('interview');
            },
            onCloseSideSheet: () => setMatrixSelection(null),
            renderSideSheet: (selection, cell) => (
              <div className="text-xs text-c-text-secondary">
                <p>
                  {t('assessment.drd.http.cell.line', '{{unit}} · level {{level}} — {{state}}', {
                    unit: selection.unitId,
                    level: selection.level,
                    state: cell?.blocker
                      ? t('assessment.drd.http.cell.blocker', 'BLOCKER (first unmet level)')
                      : cell?.reviewRequired
                        ? t('assessment.drd.http.cell.reviewRequired', 'above-gap: needs review')
                        : cell?.achieved
                          ? t('assessment.drd.http.cell.achieved', 'achieved')
                          : t('assessment.drd.http.cell.notAchieved', 'not achieved'),
                  })}
                </p>
              </div>
            ),
          }}
          reportContent={
            isFrozen ? (
              frozenReportContent
            ) : assessmentReportEnabled ? (
              <Suspense
                fallback={
                  <div
                    className="m-6 h-24 animate-pulse rounded-xl border border-c-border-subtle bg-c-surface-raised"
                    aria-busy="true"
                  />
                }
              >
                <AssessmentReportContractView sessionId={session.id} />
              </Suspense>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                    DRD report · axis {activeAxis.id}
                  </p>
                  <h2 className="text-lg font-semibold text-c-text">
                    {nazwaWJezyku(activeAxis.namePL, activeAxis.name, isPolish)}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-c-text-secondary">
                    {t(
                      'assessment.drd.http.report.workingChapter',
                      'A working report chapter based on the current answers, evidence and targets of this same session. It is not an approved report until the session is frozen by an approver.'
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-c-border bg-c-surface p-4">
                  <h3 className="mb-3 text-sm font-semibold text-c-text">
                    {t('assessment.drd.http.report.axisMatrix', 'Axis matrix')}
                  </h3>
                  <LiveMatrix
                    {...{
                      rows: matrixRows,
                      levels: matrixLevels,
                      selection: matrixSelection,
                      onSelect: (selection) => {
                        setMatrixSelection(selection);
                        setPinnedFocus(null);
                        setActiveUnitId(selection.unitId);
                      },
                      onCloseSideSheet: () => setMatrixSelection(null),
                      renderSideSheet: (selection, cell) => (
                        <div className="text-xs text-c-text-secondary">
                          <p>
                            {t(
                              'assessment.drd.http.cell.line',
                              '{{unit}} · level {{level}} — {{state}}',
                              {
                                unit: selection.unitId,
                                level: selection.level,
                                state: cell?.blocker
                                  ? t(
                                      'assessment.drd.http.cell.blocker',
                                      'BLOCKER (first unmet level)'
                                    )
                                  : cell?.reviewRequired
                                    ? t(
                                        'assessment.drd.http.cell.reviewRequired',
                                        'above-gap: needs review'
                                      )
                                    : cell?.achieved
                                      ? t('assessment.drd.http.cell.achieved', 'achieved')
                                      : t(
                                          'assessment.drd.http.cell.notAchieved',
                                          'not achieved'
                                        ),
                              }
                            )}
                          </p>
                        </div>
                      ),
                    }}
                    methodName={pack.manifest.name}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {activeAxis.areas.map((area) => (
                    <article
                      key={area.id}
                      className="rounded-xl border border-c-border bg-c-surface p-4"
                    >
                      <p className="text-[11px] font-semibold text-c-text-muted">{area.id}</p>
                      <h3 className="text-sm font-semibold text-c-text">
                        {nazwaWJezyku(area.namePL, area.name, isPolish)}
                      </h3>
                      <p className="mt-2 text-xs text-c-text-secondary">
                        {confirmedLevelsFor(events, area.id).length > 0
                          ? t(
                              'assessment.drd.http.report.confirmedLevels',
                              'Confirmed levels: {{levels}}. Requires an expert comment before approval.',
                              { levels: confirmedLevelsFor(events, area.id).join(', ') }
                            )
                          : t(
                              'assessment.drd.http.report.noConfirmedLevel',
                              'No confirmed assessment — the report must not pretend to draw a conclusion for this area.'
                            )}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )
          }
          documentSourceLabel={sourceKind}
          /* ★ FALA J2: surowy zrzut kontraktu (Output/contentHash/scope/
             limitations, snapshoty raportu i szkicu inicjatywy, „Otwórz
             ponownie") nie jest usunięty — schodzi tam, gdzie jest jego
             miejsce: pod „Szczegóły techniczne" w Ustawieniach. Nigdy jako
             pierwszy ekran. */
          settingsContent={
            isFrozen ? (
              <details data-testid="drd-frozen-technical-details" className="mt-1">
                <summary className="cursor-pointer font-semibold text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
                  {t(
                    'assessment.drd.http.frozen.technicalDetails',
                    'Technical details — frozen result'
                  )}
                </summary>
                <div className="mt-2">{frozenRawView(true)}</div>
              </details>
            ) : undefined
          }
          // 1.1-Z4 D3: `DrdSourceIndicator` now has a permanent home in this
          // screen's own header (added above, next to
          // `AssessmentSaveStateIndicator` — fix for finding (a)/(b)/(c)) —
          // repeating it here inside Settings would be the exact
          // "biblioteka bez wywołania"-adjacent duplicate-fact noise this
          // file's own DEC-415b-style comments elsewhere warn against, and it
          // broke `getByTestId('drd-source-indicator')` (singular) in
          // DrdHttpMethodWorkspaceScreen.test.tsx by producing two matches.
          governanceActions={
            <>
              <button
                type="button"
                onClick={() => void runtime?.transition('in_review').catch(() => undefined)}
                disabled={!canSendToReview}
                className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
              >
                {t('assessment.drd.http.governance.sendToReview', 'Send for review')}
              </button>
              <button
                type="button"
                onClick={() => void runtime?.transition('active').catch(() => undefined)}
                disabled={!canSendBack}
                className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
              >
                {t('assessment.drd.http.governance.sendBack', 'Send back to work')}
              </button>
              <button
                type="button"
                onClick={() => void runtime?.freeze().catch(() => undefined)}
                disabled={!canFreeze}
                data-testid="freeze-button"
                className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
              >
                <Lock size={12} />
                {t('assessment.drd.http.governance.freeze', 'Freeze')}
              </button>
            </>
          }
        />
      </div>

      {/* ★ „Analizuj" z „Pracuj z AI" — OCENA GOTOWOŚCI SESJI, zero zapisu.
          Wszystkie liczby i zdania pochodzą z już istniejących w tym pliku
          `readiness` (MethodReadiness) i `teresaSixQuestions` — nie liczymy tu
          niczego nowego i nie wołamy modelu. Panel jest jedyną pozycją „Pracuj
          z AI" dostępną bez prawa edycji (Zasada 2b). */}
      {analizaOtwarta && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-label={t('assessment.drd.http.readiness.title', 'Session readiness assessment')}
          data-testid="drd-analiza-gotowosci"
          className="fixed bottom-5 right-5 z-40 max-h-[70vh] w-[min(460px,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-c-border bg-c-surface p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-c-text">
              {t('assessment.drd.http.readiness.title', 'Session readiness assessment')}
            </strong>
            <button
              type="button"
              onClick={() => setAnalizaOtwarta(false)}
              aria-label={t('assessment.drd.http.readiness.close', 'Close')}
              className="rounded-lg px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('assessment.drd.http.readiness.close', 'Close')}
            </button>
          </div>
          <dl className="space-y-2 text-sm text-c-text-secondary">
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.whereAreWe', 'Where we are')}
              </dt>
              <dd>{teresaSixQuestions.whereAreWe}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.whatMattersNow', 'What matters now')}
              </dt>
              <dd>{teresaSixQuestions.whatMattersNow}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.whatIsMissing', 'What is missing')}
              </dt>
              <dd>{teresaSixQuestions.whatIsMissing}</dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.evidence', 'Evidence')}
              </dt>
              <dd>
                {t('assessment.drd.http.readiness.evidenceCount', '{{withEvidence}}/{{total}} units have evidence', {
                  withEvidence: readiness.totalUnits - readiness.unitsMissingEvidence,
                  total: readiness.totalUnits,
                })}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.freezeBlockers', 'Freeze blockers')}
              </dt>
              <dd>
                {readiness.freezeBlockers.length === 0 ? (
                  t('assessment.drd.http.readiness.noFreezeBlockers', 'No freeze blockers.')
                ) : (
                  <ul className="ml-4 list-disc space-y-0.5">
                    {readiness.freezeBlockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-c-text">
                {t('assessment.drd.http.readiness.nextSafeAction', 'Safe next move')}
              </dt>
              <dd>{teresaSixQuestions.nextSafeAction}</dd>
            </div>
          </dl>
        </aside>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Post-freeze view: Output / Report / Initiative — HTTP-shaped records
// ---------------------------------------------------------------------------

const FrozenOutputHttpView: React.FC<{
  state: DrdHttpRuntimeState;
  sourceKind: 'SERVER' | 'RECOVERY_DRAFT';
  onGenerateReport: () => void;
  onGenerateInitiative: () => void;
  onExit: () => void;
  readOnly?: boolean;
  /**
   * ★ FALA J2: ten widok nie jest już PIERWSZYM ekranem sesji zamrożonej —
   * mieszka pod „Szczegóły techniczne" w Ustawieniach powłoki. Osadzony nie
   * bierze całej wysokości i nie dubluje wyjścia z sesji (powłoka ma własne
   * „Wyjdź"); pełnoekranowo wraca wyłącznie przez `?ff_drdFrozenRaw=1`.
   */
  embedded?: boolean;
}> = ({
  state,
  sourceKind,
  onGenerateReport,
  onGenerateInitiative,
  onExit,
  readOnly = false,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const session = state.session!;
  const output = state.output;

  return (
    <div
      className={
        embedded ? 'flex flex-col bg-c-surface' : 'flex h-full flex-col overflow-y-auto bg-c-bg p-6'
      }
      data-testid="drd-http-frozen-output-view"
    >
      <div className="mb-4 flex items-center gap-3">
        {embedded ? null : (
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
          >
            <ArrowLeft size={13} /> {t('assessment.drd.http.frozen.exit', 'Leave')}
          </button>
        )}
        <h1 className="text-sm font-semibold text-c-text">
          {t('assessment.drd.http.frozen.headingNamed', '{{name}} — {{state}}', {
            name:
              session.name?.trim() ||
              t('assessment.drd.http.sessionFallbackName', 'Session {{id}}', {
                id: session.id.slice(0, 8),
              }),
            state:
              session.state === 'closed'
                ? t('assessment.drd.http.frozen.stateClosed', 'Closed')
                : t('assessment.drd.http.frozen.stateFrozen', 'Frozen'),
          })}
        </h1>
        {/* ★ Frozen Output must NEVER be labeled SERVER unless `output` is a
            confirmed server response for THIS session's current freeze —
            `state.output` is only ever set from `freeze()`'s own response or
            a `getOutput()` re-fetch (see drdHttpSessionRuntime.ts refresh()). */}
        <DrdSourceIndicator
          source={output ? sourceKind : 'RECOVERY_DRAFT'}
          title={t(
            'assessment.drd.http.frozen.sourceTitle',
            'A frozen Output always comes from the server response, never from localStorage.'
          )}
        />
      </div>

      {/* Output */}
      <section
        data-testid="output-panel"
        className="mb-6 rounded-xl border border-c-border bg-c-surface p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <Lock size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">
            AssessmentOutput (immutable, v{output?.outputVersion ?? '—'})
          </h2>
        </div>
        {!output ? (
          <p className="text-xs text-c-text-muted">
            {t(
              'assessment.drd.http.frozen.outputMissing',
              'The session is frozen on the server, but its current Output could not be found. Refresh the view; this screen will not rebuild the content from a local cache.'
            )}
          </p>
        ) : (
          <div className="space-y-2 text-xs text-c-text-secondary">
            <p>
              contentHash:{' '}
              <code className="text-c-text-muted">{output.contentHash.slice(0, 16)}…</code>
            </p>
            <p>scope: {output.scope}</p>
            <p>limitations: {output.limitations.join(' · ')}</p>
            <div className="rounded-lg border border-c-border-subtle">
              <StandardTable
                columns={getOutputUnitColumns(t)}
                data={Object.keys(output.current).map((unitId) => ({
                  id: unitId,
                  unitId,
                  current: output.current[unitId] ?? '—',
                  target: output.target[unitId] ?? '—',
                  gap: output.gap[unitId] ?? '—',
                }))}
              />
            </div>
            <p className="pt-1 font-medium text-c-text">
              {t('assessment.drd.http.frozen.findings', 'Findings ({{count}})', {
                count: output.findings.length,
              })}
            </p>
            {output.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-c-border-subtle p-2">
                <p className="text-c-text">{f.businessMeaning}</p>
                <p className="text-c-text-muted">
                  {t('assessment.drd.http.frozen.recommendation', 'Recommendation: {{value}}', {
                    value: f.recommendation,
                  })}
                </p>
                <p className="text-c-text-muted">
                  {t('assessment.drd.http.frozen.unitLine', 'Unit: {{name}}', { name: f.unitName })}{' '}
                  · current {f.currentLevel ?? '—'} · target {f.targetLevel ?? '—'} · gap{' '}
                  {f.gap ?? '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Report */}
      <section
        data-testid="report-panel"
        className="mb-6 rounded-xl border border-c-border bg-c-surface p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Report Snapshot</h2>
          </div>
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={!output || readOnly}
            className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
          >
            {t('assessment.drd.http.frozen.generateReport', 'Generate a report from the Output')}
          </button>
        </div>
        {state.reports.length === 0 ? (
          <p className="text-xs text-c-text-muted">
            {t(
              'assessment.drd.http.frozen.noReport',
              'No report saved for this Output.'
            )}
          </p>
        ) : (
          state.reports.map((r, i) => {
            const rec = r as {
              id?: string;
              title?: string;
              content?: { executiveSummary?: string };
            };
            return (
              <div
                key={rec.id ?? i}
                className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs text-c-text-secondary"
              >
                <p className="text-c-text">{rec.title}</p>
                <p>{rec.content?.executiveSummary}</p>
              </div>
            );
          })
        )}
      </section>

      {/* Initiative Draft */}
      <section
        data-testid="initiative-panel"
        className="mb-6 rounded-xl border border-c-border bg-c-surface p-4"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">
              {t(
                'assessment.drd.http.frozen.initiativeDraftTitle',
                'Initiative Proposal Draft (local, NOT a Registered Initiative)'
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onGenerateInitiative}
            disabled={!output || readOnly}
            className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
          >
            {t('assessment.drd.http.frozen.generateInitiative', 'Generate from findings')}
          </button>
        </div>
        {state.initiatives.length === 0 ? (
          <p className="text-xs text-c-text-muted">
            {t(
              'assessment.drd.http.frozen.noInitiativeDraft',
              'No Initiative Proposal Draft saved for this Output.'
            )}
          </p>
        ) : (
          state.initiatives.map((d, i) => {
            const rec = d as {
              id?: string;
              title?: string;
              summary?: string | null;
              confidence?: string;
            };
            return (
              <div
                key={rec.id ?? i}
                className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs"
              >
                <p className="font-medium text-c-text">{rec.title}</p>
                <p className="text-c-text-secondary">{rec.summary}</p>
                <p className="text-c-text-muted">confidence: {rec.confidence}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-c-warning">
                  {t(
                    'assessment.drd.http.frozen.draftNotice',
                    'Draft — the “Register as Initiative” decision belongs to a human, outside this module.'
                  )}
                </p>
              </div>
            );
          })
        )}
      </section>

      {/* Reopen — no HTTP path yet */}
      <section
        data-testid="reopen-panel"
        className="rounded-xl border border-c-border bg-c-surface p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <RotateCcw size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">
            {t('assessment.drd.http.frozen.reopenTitle', 'Reopen — new revision')}
          </h2>
        </div>
        <p className="mb-2 text-xs text-c-text-muted">
          {t(
            'assessment.drd.http.frozen.reopenUnavailable',
            'There is no HTTP endpoint for reopen (outside the scope of this file — server/src/method-core/*, server/src/routes/method-core.routes.ts). The action is disabled explicitly, not faked.'
          )}
        </p>
        <button
          type="button"
          disabled
          data-testid="reopen-button"
          className="rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary opacity-40"
        >
          {t('assessment.drd.http.frozen.reopenButton', 'Reopen the session (not available over HTTP)')}
        </button>
      </section>
    </div>
  );
};

export default DrdHttpMethodWorkspaceScreen;
