/**
 * DrdHttpMethodWorkspaceScreen — HTTP-source-of-truth path for the DRD
 * workspace (P0C, 2026-08-13).
 *
 * Rendered by `DrdMethodWorkspaceScreen.tsx` ONLY when `drdHttpSourceOfTruthV1`
 * is ON (default OFF). Mirrors `DrdMethodWorkspaceScreenLegacy`'s use of
 * `MethodWorkspaceShell`, reusing the SAME pure event->view-model derivation
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
 *  - no HTTP endpoint assigns extra process roles after session creation
 *    (only `owner`, auto-granted to the creator) — so `in_review -> frozen`
 *    (approver-only) will 403 for a lone demo user unless roles were seeded
 *    directly in the database out-of-band (dev/test only, never this file's
 *    job to fake).
 *  - ~~no HTTP endpoint reopens a frozen session into a new revision~~ —
 *    CLOSED (agent S8, 2026-08-13): `POST /api/method/sessions/:id/reopen`
 *    (`server/src/routes/method-core.routes.ts`) + `reopen()`
 *    (`src/method-core/api/methodCoreApi.ts`). The "Reopen — nowa rewizja"
 *    panel below calls it directly (bypassing `DrdHttpSessionRuntime` — a
 *    reopen mints a BRAND NEW session id, which does not fit that runtime's
 *    single-session write/offline-queue model; see the panel's own comment).
 *  - no HTTP endpoint lists Reports/Initiative Drafts by session — this
 *    screen only knows about ones created in the CURRENT browser session
 *    (see `DrdHttpRuntimeState.reports`/`.initiatives`'s own comment).
 */
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, FileText, Layers, Lightbulb, Loader2, Lock, RefreshCw, RotateCcw, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import { StandardTable } from '@/components/standard/StandardTable';
import type { InterviewFocusQuestion, MethodWorkspaceViewMode } from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import { DrdArtifactsPanel } from './DrdArtifactsPanel';
import { DrdRolesPanel } from './DrdRolesPanel';
import { DRD_METHOD_PACK_ID } from '@/method-core/methods/drd/compileDrdPack';
import {
  deriveDrdSourceKind,
  DrdHttpSessionRuntime,
  type DrdHttpRuntimeState,
  type DrdVisibleSourceState,
} from '@/method-core/methods/drd/drdHttpSessionRuntime';
import type { MethodReadiness, TeresaCommitRequest } from '@/method-core/contracts';
import { MethodCoreApiError, newIdempotencyKey, reopen as apiReopen } from '@/method-core/api/methodCoreApi';
import { DRD_STRUCTURE } from '@/services/drdStructure';

import {
  buildMatrixRowsForAxis,
  buildNavigatorNodes,
  evidenceEventsFor,
  OUTPUT_UNIT_COLUMNS,
  pack,
  questionAnswerState,
} from './drdWorkspaceViewModel';
import { DrdSourceIndicator } from './DrdSourceIndicator';
import type { DrdMethodWorkspaceScreenProps } from './DrdMethodWorkspaceScreen';

type HttpScreenProps = Omit<DrdMethodWorkspaceScreenProps, 'forceHttpSourceOfTruth' | 'initialActorUserId' | 'forceState'>;

// ---------------------------------------------------------------------------
// Dev-render / test only — reach any of the eight visible states (CEL 4)
// deterministically without depending on a genuinely flaky network. See this
// component's own `forceState` prop and `DrdHttpSessionRuntime`'s (absence
// of a) production code path that would ever call this — only the
// harness/tests do.
//
// ★ 'offline' / 'conflict' / 'recovery' / 'loading' are the ORIGINAL four
// values (P0C) — kept byte-for-byte so `DrdMethodWorkspaceScreen.tsx`'s own
// (narrower, out-of-this-agent's-scope) `forceState` prop type stays
// assignable into this one without editing that file. Everything after is
// additive (CEL 4, S3): 'recovery_draft' forces the STILL-OFFLINE-with-a-
// queued-draft moment (scenario 2) distinct from 'recovery' (back online,
// explicit reconciliation UI, scenario 3's third act).
// ---------------------------------------------------------------------------
export type DrdHttpDebugForcedState =
  | 'loading'
  | 'server'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'recovery_draft'
  | 'recovery'
  | 'reconnecting'
  | 'conflict'
  | 'recovered';

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
  await runtime.recordTargetDecision({ unitId: area1A.id, level: 4, rationale: 'Cel ustalony z zarządem na ten rok.' });

  if (seedTo === 'interview') return;

  const area1B = DRD_STRUCTURE[0].areas[1];
  await runtime.recordAnswer({
    unitId: area1B.id,
    level: 4,
    questionId: `${area1B.id}-L4-Q1`,
    answerState: 'confirmed',
    text: 'Zaawansowana praktyka zaobserwowana punktowo (poza kolejnością).',
  });
  await runtime.recordEvidence({ unitId: area1B.id, level: 4, evidenceId: 'demo-ev-1b-l4', evidenceType: 'observation', strength: 'E1' });

  if (seedTo === 'matrix') return;

  if (seedTo === 'teresa' || seedTo === 'approval' || seedTo === 'frozen' || seedTo === 'reopened') {
    await runtime.createTeresaPreview({
      capabilityId: 'draft_score_proposal',
      unitId: area1A.id,
      level: 3,
      invokedBy: 'local_action',
      statements: [
        { kind: 'respondent_declaration', text: 'Proces w CRM istnieje i jest używany przez cały zespół handlowy.', sourceRefs: [] },
        { kind: 'missing_evidence', text: 'Brak dowodu na regularny przegląd wskaźników procesu (poziom 3).', sourceRefs: [] },
        { kind: 'proposal', text: 'Proponowany poziom: 3 (zdefiniowany, mierzony proces).', sourceRefs: [] },
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

const BootstrapLoadingView: React.FC<{ label: string }> = ({ label }) => (
  <div data-testid="drd-http-bootstrap-loading" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-c-text-muted">
    {/* No badge here: before the FIRST server response, there is nothing to
        badge yet — not confirmed data (SERVER), not an unsaved draft
        (RECOVERY_DRAFT would misleadingly imply something was edited). */}
    <Loader2 size={20} className="animate-spin text-c-text-muted" />
    {label}
  </div>
);

const ConflictView: React.FC<{
  state: DrdHttpRuntimeState;
  onLoadServerVersion: () => void;
  onExit: () => void;
}> = ({ state, onLoadServerVersion, onExit }) => (
  <div data-testid="drd-http-conflict-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <DrdSourceIndicator source="CONFLICT" title="Konflikt wersji — nic nie zostało nadpisane." />
    <AlertTriangle size={28} className="text-c-danger" />
    <h2 className="text-sm font-semibold text-c-text">Sesja zmieniła się na serwerze</h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      Twoja przeglądarka miała wersję {state.conflictDetail?.localBaseVersion ?? state.session?.version ?? '—'}, serwer ma już wersję{' '}
      {state.serverVersion ?? '—'}. Nic nie zostało nadpisane automatycznie — wybierz, jak kontynuować.
    </p>
    {state.conflictDetail && (
      <div data-testid="conflict-diff" className="max-w-md rounded-lg border border-c-danger/30 bg-c-danger/5 p-3 text-left text-[11px] text-c-text-secondary">
        <p className="font-semibold text-c-danger">Różnica (diff)</p>
        <p>
          <span className="text-c-text-muted">Twoja niezapisana zmiana:</span> {state.conflictDetail.localSummary}
        </p>
        <p>
          <span className="text-c-text-muted">Serwer:</span> {state.conflictDetail.serverSummary ?? `wersja ${state.conflictDetail.serverVersion} (treść nieznana bez wczytania)`}
        </p>
      </div>
    )}
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="conflict-load-server"
        onClick={onLoadServerVersion}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} /> Wczytaj wersję serwera
      </button>
      <button type="button" onClick={onExit} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Wyjdź bez zmian
      </button>
    </div>
  </div>
);

const RecoveryQueueView: React.FC<{
  state: DrdHttpRuntimeState;
  onApplyPending: () => void;
  onDiscardPending: () => void;
}> = ({ state, onApplyPending, onDiscardPending }) => (
  <div data-testid="drd-http-recovery-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <DrdSourceIndicator source="RECOVERY_DRAFT" title="Zmiany zapisane lokalnie, jeszcze nie potwierdzone przez serwer." />
    <CloudOff size={28} className="text-c-warning" />
    <h2 className="text-sm font-semibold text-c-text">Połączenie wróciło — {state.pendingWriteCount} zaległych zmian czeka</h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      Te zmiany zostały zapisane lokalnie, kiedy nie było połączenia z serwerem. Wybierz jawnie: zastosować je na serwerze, czy je odrzucić
      i wczytać bieżący stan serwera. Nic nie dzieje się automatycznie.
    </p>
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="recovery-apply-pending"
        onClick={onApplyPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle"
      >
        <RefreshCw size={13} /> Zastosuj zaległe zmiany ({state.pendingWriteCount})
      </button>
      <button
        type="button"
        data-testid="recovery-discard-pending"
        onClick={onDiscardPending}
        className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised"
      >
        Odrzuć lokalne, wgraj serwer
      </button>
    </div>
  </div>
);

/** RECONNECTING — transient, shown while the runtime re-checks the server
 * right after connectivity returns, BEFORE offering the explicit
 * reconciliation choice (RecoveryQueueView above). Never auto-resolves
 * anything by itself — see `DrdHttpSessionRuntime.reconnect()`. */
const ReconnectingView: React.FC<{ pendingWriteCount: number }> = ({ pendingWriteCount }) => (
  <div data-testid="drd-http-reconnecting-view" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-c-text-muted">
    <DrdSourceIndicator source="RECONNECTING" title="Połączenie wróciło — sprawdzam bieżący stan serwera przed rekoncyliacją." />
    <Loader2 size={24} className="animate-spin text-c-info" />
    <p>Połączenie wróciło — sprawdzam serwer{pendingWriteCount > 0 ? ` (${pendingWriteCount} zmian czeka na rekoncyliację)` : ''}…</p>
  </div>
);

/** RECOVERED — transient success banner shown on top of the normal
 * workspace right after an explicit reconciliation (`retryPending()`)
 * finished with nothing left queued. The workspace underneath is already
 * usable — this is a confirmation, not a blocking screen. */
const RecoveredBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <div data-testid="drd-http-recovered-banner" role="status" className="flex items-center gap-3 border-b border-c-success/30 bg-c-success/10 px-4 py-1.5 text-[11px] text-c-success">
    <CheckCircle2 size={13} className="shrink-0" />
    <span>Zaległe zmiany zastosowane i potwierdzone przez serwer — dane na ekranie są znowu w pełni zsynchronizowane.</span>
    <button type="button" onClick={onDismiss} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-success/40 px-2 py-0.5 font-semibold hover:bg-c-success/20">
      OK
    </button>
  </div>
);

const StaleDraftNoticeBanner: React.FC<{ notices: readonly string[]; onDismiss: () => void }> = ({ notices, onDismiss }) => (
  <div data-testid="drd-http-stale-draft-notice" role="status" className="flex items-start gap-3 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning">
    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
    <ul className="list-disc pl-4">
      {notices.map((n, i) => (
        <li key={i}>{n}</li>
      ))}
    </ul>
    <button type="button" onClick={onDismiss} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-warning/40 px-2 py-0.5 font-semibold hover:bg-c-warning/20">
      OK
    </button>
  </div>
);

const OfflineBanner: React.FC<{ pendingWriteCount: number; onRetry: () => void }> = ({ pendingWriteCount, onRetry }) => (
  <div data-testid="drd-http-offline-banner" role="alert" className="flex items-center gap-3 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning">
    <CloudOff size={13} className="shrink-0" />
    <span>
      Brak połączenia z serwerem
      {pendingWriteCount > 0
        ? ` — masz ${pendingWriteCount} niezapisaną zmianę (RECOVERY_DRAFT) kolejkowaną lokalnie, nigdy nie zniknie sama.`
        : ' — na razie nic nie zostało zmienione lokalnie.'}{' '}
      To NIE jest potwierdzony stan serwera.
    </span>
    <button type="button" onClick={onRetry} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-warning/40 px-2 py-0.5 font-semibold hover:bg-c-warning/20">
      <RefreshCw size={11} /> Spróbuj połączyć ponownie
    </button>
  </div>
);

const ErrorRetryView: React.FC<{ message: string; onRetry: () => void; onExit: () => void }> = ({ message, onRetry, onExit }) => (
  <div data-testid="drd-http-error-view" role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
    <AlertTriangle size={24} className="text-c-danger" />
    <p className="max-w-md text-xs text-c-danger">{message}</p>
    <div className="flex items-center gap-2">
      <button type="button" data-testid="error-retry" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle">
        <RefreshCw size={13} /> Spróbuj ponownie
      </button>
      <button type="button" onClick={onExit} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Wyjdź
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Utilities layer (S3, 2026-08-13) — ASSESSMENT_UI_NAVIGATION_AND_MATRIX_
// STANDARD.md §2 level 5: "utilities: Comments, Activity, History,
// Relations, Used In." Session artefacts (Output/Report/Presentation/
// Initiative Draft lineage — `DrdArtifactsPanel`, S1) and role/approval
// history (`DrdRolesPanel`, S2) are exactly that layer — NOT a sixth
// primary tab next to Interview/Split/Matrix. Reached via two small,
// on-demand buttons (consultify-gestosc §13: governance panels hidden by
// default, opened on demand) that open the SAME drawer overlay from either
// the active-session view or the frozen-Output view — one implementation,
// two call sites, never two different panels for the same data.
// ---------------------------------------------------------------------------

type DrdUtilityPanelKind = 'artifacts' | 'roles' | null;

const UtilityLauncherButtons: React.FC<{
  onOpenArtifacts: () => void;
  onOpenRoles: () => void;
}> = ({ onOpenArtifacts, onOpenRoles }) => (
  <div className="ml-auto flex shrink-0 items-center gap-1.5">
    <button
      type="button"
      data-testid="drd-open-artifacts"
      onClick={onOpenArtifacts}
      className="inline-flex items-center gap-1.5 rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus:ring-1 focus:ring-c-focus"
    >
      <Layers size={12} /> Artefakty
    </button>
    <button
      type="button"
      data-testid="drd-open-roles"
      onClick={onOpenRoles}
      className="inline-flex items-center gap-1.5 rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus:ring-1 focus:ring-c-focus"
    >
      <Users size={12} /> Role
    </button>
  </div>
);

/**
 * ★ Never touches `DrdHttpSessionRuntime` — `DrdArtifactsPanel`/`DrdRolesPanel`
 * each make their OWN real HTTP calls (`getSessionLineage`/`listRoles`/…),
 * entirely independent of the workspace runtime's `status`. Opening this
 * drawer cannot, structurally, change `deriveDrdSourceKind`'s result — see
 * `__tests__/DrdHttpMethodWorkspaceScreen.test.tsx`'s "opening the artifacts
 * panel never changes the SERVER badge" for the regression guard.
 */
const UtilityDrawer: React.FC<{
  panel: DrdUtilityPanelKind;
  sessionId: string;
  currentUserId: string;
  onClose: () => void;
}> = ({ panel, sessionId, currentUserId, onClose }) => {
  if (!panel) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={panel === 'artifacts' ? 'Artefakty sesji' : 'Role sesji'}>
      <button type="button" aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-black/30 focus:outline-none" />
      {/* w-3xl (not w-lg): the artefact/role StandardTables have 4-5 columns
          each — a narrower drawer clipped their rightmost column against the
          viewport edge instead of wrapping (caught in the S3 screenshot
          review, not by any automated check). */}
      <div data-testid="drd-utility-drawer" data-panel={panel} className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-c-border bg-c-bg p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-c-text">{panel === 'artifacts' ? 'Artefakty sesji (linia rewizji)' : 'Role i zatwierdzenia'}</h2>
          <button
            type="button"
            data-testid="drd-utility-drawer-close"
            onClick={onClose}
            className="rounded-md border border-c-border p-1 text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus:ring-1 focus:ring-c-focus"
          >
            <X size={14} />
          </button>
        </div>
        {panel === 'artifacts' ? (
          <DrdArtifactsPanel sessionId={sessionId} />
        ) : (
          <DrdRolesPanel sessionId={sessionId} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DrdHttpMethodWorkspaceScreen: React.FC<HttpScreenProps & { forceState?: DrdHttpDebugForcedState }> = ({
  storage: storageProp,
  demoSessionId,
  onExit,
  seedTo,
  initialViewMode,
  forceState,
}) => {
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
  const [viewMode, setViewMode] = useState<MethodWorkspaceViewMode>(initialViewMode ?? 'interview');
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [activeAxisId, setActiveAxisId] = useState<number>(DRD_STRUCTURE[0].id);
  const [activeUnitId, setActiveUnitId] = useState<string>(DRD_STRUCTURE[0].areas[0].id);
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(null);
  const [draftAnswerText, setDraftAnswerText] = useState<Record<string, string>>({});
  // Utilities layer (Artefakty / Role) — see the components' own header
  // comment above. Lifted here (not local to either return branch) so the
  // SAME drawer state survives the active-session <-> frozen-Output branch
  // switch without losing the user's open panel.
  const [utilityPanel, setUtilityPanel] = useState<DrdUtilityPanelKind>(null);

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
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Nie udało się utworzyć sesji.');
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
        const currentVersion = runtimeRef.current.getState().session?.version ?? 1;
        const debugPatch: Partial<DrdHttpRuntimeState> =
          forceState === 'server'
            ? { status: 'ready', pendingWriteCount: 0 }
            : forceState === 'saving'
              ? { status: 'saving' }
              : forceState === 'saved'
                ? { status: 'saved' }
                : forceState === 'offline'
                  ? { status: 'offline', pendingWriteCount: 0, error: 'Brak połączenia z serwerem.' }
                  : forceState === 'recovery_draft'
                    ? { status: 'offline', pendingWriteCount: 2, error: 'Zapis w kolejce — offline.' }
                    : forceState === 'recovery'
                      ? { status: 'recovery', pendingWriteCount: 2 }
                      : forceState === 'reconnecting'
                        ? { status: 'reconnecting', pendingWriteCount: 2 }
                        : forceState === 'conflict'
                          ? {
                              status: 'conflict',
                              serverVersion: currentVersion + 1,
                              error: 'Sesja zmieniła się na serwerze.',
                              conflictDetail: {
                                localBaseVersion: currentVersion,
                                serverVersion: currentVersion + 1,
                                localSummary: 'Odpowiedź 1A-L1-Q1 (confirmed) — zapisana lokalnie, jeszcze nie wysłana.',
                                serverSummary: null,
                              },
                            }
                          : forceState === 'recovered'
                            ? { status: 'recovered', pendingWriteCount: 0 }
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
  const pendingPreviews = state?.previews ?? [];
  const pendingPreviewUnitLevels = useMemo(() => {
    const set = new Set<string>();
    for (const p of pendingPreviews) {
      if (p.intent.unitId && typeof p.intent.level === 'number') set.add(`${p.intent.unitId}#${p.intent.level}`);
    }
    return set;
  }, [pendingPreviews]);

  const navigatorNodes = useMemo(() => buildNavigatorNodes(events), [events]);
  const activeAxis = DRD_STRUCTURE.find((a) => a.id === activeAxisId) ?? DRD_STRUCTURE[0];
  const matrixRows = useMemo(() => buildMatrixRowsForAxis(events, activeAxis, pendingPreviewUnitLevels), [events, activeAxis, pendingPreviewUnitLevels]);
  const matrixLevels = useMemo(() => {
    const first = activeAxis.areas[0];
    return first ? first.levels.map((l) => l.level).sort((a, b) => a - b) : [];
  }, [activeAxis]);

  const activeArea = activeAxis.areas.find((a) => a.id === activeUnitId) ?? activeAxis.areas[0];
  const focusLevelFallback = Math.min(...activeArea.levels.map((l) => l.level));
  const focusQuestions = pack.questions.filter((q) => q.unitId === activeArea.id && q.level === focusLevelFallback);
  const evidenceCountForUnit = evidenceEventsFor(events, activeArea.id).length;

  const interviewQuestions: InterviewFocusQuestion[] = focusQuestions.map((q) => {
    const { state: answerState, text } = questionAnswerState(events, q.questionId);
    return {
      question: q,
      answerState,
      answerText: text,
      evidenceState: 'missing',
      evidenceCount: evidenceCountForUnit,
    };
  });

  // Allowlist, not a denylist — a NEW status added later must prove itself
  // "safe to write through" rather than silently being treated as online by
  // default (the opposite of `!== 'offline' && !== 'recovery'`, which would
  // have quietly counted 'reconnecting'/'conflict' as online too).
  const isOnline = state
    ? state.status === 'ready' || state.status === 'saving' || state.status === 'saved' || state.status === 'recovered'
    : false;

  const { state: saveState, lastSavedAt, errorMessage: saveErrorMessage, markDirty, saveNow } = useMethodWorkspaceSave({
    isOnline,
    debounceMs: 800,
    save: async () => {
      if (!runtime) return { ok: false, error: 'Sesja jeszcze nie gotowa.' };
      const entry = Object.entries(draftAnswerText).find(([qid]) => focusQuestions.some((q) => q.questionId === qid));
      if (!entry) return { ok: true };
      const [questionId, text] = entry;
      try {
        await runtime.recordAnswer({ unitId: activeArea.id, level: focusLevelFallback, questionId, answerState: 'partial', text, draft: true });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Zapis nieudany.' };
      }
    },
  });

  const handleAnswerChange = useCallback((questionId: string, text: string) => {
    setDraftAnswerText((prev) => ({ ...prev, [questionId]: text }));
    markDirty();
  }, [markDirty]);

  const handleAnswerStateChange = useCallback(
    async (questionId: string, answerState: InterviewFocusQuestion['answerState'], justification?: string) => {
      if (!answerState || !runtime) return;
      await runtime.recordAnswer({
        unitId: activeArea.id,
        level: focusLevelFallback,
        questionId,
        answerState,
        text: draftAnswerText[questionId],
        justification,
      });
    },
    [runtime, activeArea.id, focusLevelFallback, draftAnswerText]
  );

  const handleEvidenceDrop = useCallback(
    async (questionId: string, files: FileList) => {
      const file = files[0];
      if (!file || !runtime) return;
      await runtime.recordEvidence({
        unitId: activeArea.id,
        level: focusLevelFallback,
        evidenceId: `${questionId}:${file.name}:${Date.now()}`,
        evidenceType: 'document',
        strength: 'E2',
        linkedQuestionIds: [questionId],
      });
    },
    [runtime, activeArea.id, focusLevelFallback]
  );

  const handleAskTeresa = useCallback(
    async (questionId: string) => {
      if (!runtime) return;
      const evidence = evidenceEventsFor(events, activeArea.id);
      await runtime.createTeresaPreview({
        capabilityId: 'draft_score_proposal',
        unitId: activeArea.id,
        level: focusLevelFallback,
        questionId,
        invokedBy: 'local_action',
        statements: [
          evidence.length > 0
            ? { kind: 'confirmed_fact' as const, text: `Zebrano ${evidence.length} dowód/-ody dla tej jednostki.`, sourceRefs: evidence.map((e) => e.id) }
            : { kind: 'missing_evidence' as const, text: 'Brak dowodu dla tej jednostki na tym poziomie.', sourceRefs: [] },
          { kind: 'proposal' as const, text: `Proponowany poziom: ${focusLevelFallback} na podstawie odpowiedzi respondenta.`, sourceRefs: [] },
        ],
        proposedChanges: [{ target: 'score_proposal', targetId: activeArea.id, before: null, after: focusLevelFallback }],
        quality: { verdict: evidence.length > 0 ? 'valid' : 'needs_human_review', failedChecks: evidence.length > 0 ? [] : ['lists_supporting_evidence'] },
      });
    },
    [runtime, events, activeArea.id, focusLevelFallback]
  );

  const handleCommit = useCallback(
    async (request: TeresaCommitRequest) => {
      if (!runtime) return;
      const outcome = await runtime.commitTeresaPreview({ previewId: request.previewId, decision: request.decision, editedChanges: request.editedChanges });
      if (outcome.ok && (request.decision === 'accept' || request.decision === 'accept_with_edits')) {
        const preview = pendingPreviews.find((p) => p.previewId === request.previewId);
        const change = preview?.proposedChanges.find((c) => c.target === 'score_proposal');
        if (preview && change && typeof change.after === 'number') {
          await runtime.recordAnswer({
            unitId: preview.intent.unitId ?? activeArea.id,
            level: change.after,
            questionId: preview.intent.questionId ?? `${activeArea.id}-L${change.after}-Q1`,
            answerState: 'confirmed',
            text: 'Potwierdzone po akceptacji propozycji Teresy (decyzja człowieka).',
          });
        }
      }
    },
    [runtime, pendingPreviews, activeArea.id]
  );

  const readiness: MethodReadiness = useMemo(() => {
    const totalUnits = pack.units.length;
    let answeredUnits = 0;
    let unitsMissingEvidence = 0;
    let answeredUnitsMissingEvidence = 0;
    for (const unit of pack.units) {
      const confirmed = events.filter((e) => e.type === 'ANSWER_CONFIRMED' && e.unitId === unit.unitId);
      const hasEvidence = evidenceEventsFor(events, unit.unitId).length > 0;
      if (confirmed.length > 0) answeredUnits++;
      if (!hasEvidence) unitsMissingEvidence++;
      if (confirmed.length > 0 && !hasEvidence) answeredUnitsMissingEvidence++;
    }
    const freezeBlockers: string[] = [];
    if (answeredUnits === 0) freezeBlockers.push('Brak potwierdzonych jednostek — wywiad nie został jeszcze rozpoczęty.');
    if (answeredUnitsMissingEvidence > 0) freezeBlockers.push(`${answeredUnitsMissingEvidence} odpowiedzianych jednostek bez dowodu`);
    if (pendingPreviews.length > 0) freezeBlockers.push(`${pendingPreviews.length} propozycji Teresy oczekuje decyzji`);
    const frozenAlready = state?.session?.state === 'frozen' || state?.session?.state === 'closed';
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: frozenAlready ? [] : freezeBlockers,
    };
  }, [events, pendingPreviews.length, state?.session?.state]);

  const teresaSixQuestions = {
    whereAreWe: `Sesja DRD, jednostka ${activeArea.namePL || activeArea.name}, poziom ${focusLevelFallback}. ${readiness.answeredUnits}/${readiness.totalUnits} jednostek dotkniętych.`,
    whatMattersNow: focusQuestions[0]?.canonicalWording ?? 'Brak pytań na tym poziomie.',
    why: activeAxis.namePL ? `Oś „${activeAxis.namePL}" wymaga potwierdzenia tej jednostki, by odblokować dalsze poziomy.` : '',
    whatIsMissing: evidenceCountForUnit === 0 ? 'Brak dowodu dla tej jednostki.' : `${evidenceCountForUnit} dowód/-ody zebrane.`,
    nextSafeAction: pendingPreviews.length > 0 ? 'Zdecyduj o oczekujących propozycjach Teresy.' : 'Odpowiedz na bieżące pytanie lub dołącz dowód.',
  };

  // -- render: bootstrap phases (no runtime state yet, or a hard boot error) --
  if (bootError) {
    return (
      <ErrorRetryView
        message={`Nie udało się utworzyć sesji: ${bootError}`}
        onRetry={() => window.location.reload()}
        onExit={onExit ?? (() => {})}
      />
    );
  }
  if (!state) {
    return <BootstrapLoadingView label="Tworzenie sesji…" />;
  }

  // -- render: runtime-level states that pre-empt the shell -------------------
  if (state.status === 'loading' && !state.session) {
    return <BootstrapLoadingView label="Wczytywanie sesji z serwera…" />;
  }
  if (state.status === 'conflict') {
    return (
      <ConflictView
        state={state}
        onExit={onExit ?? (() => {})}
        onLoadServerVersion={() => void runtime?.refresh()}
      />
    );
  }
  if (state.status === 'recovery') {
    return (
      <RecoveryQueueView
        state={state}
        onApplyPending={() => void runtime?.retryPending()}
        onDiscardPending={() => void runtime?.discardPendingAndReloadServer()}
      />
    );
  }
  if (state.status === 'reconnecting') {
    return <ReconnectingView pendingWriteCount={state.pendingWriteCount} />;
  }
  if (state.status === 'error' && !state.session) {
    return <ErrorRetryView message={state.error ?? 'Nieznany błąd.'} onRetry={() => void runtime?.refresh()} onExit={onExit ?? (() => {})} />;
  }

  const session = state.session;
  if (!session) {
    return <BootstrapLoadingView label="Wczytywanie sesji…" />;
  }

  // ★ Single source of truth for the badge — see `deriveDrdSourceKind`'s own
  // header for exactly why every branch (including the frozen-Output view
  // below) MUST go through this instead of re-deriving it ad hoc.
  const sourceKind: DrdVisibleSourceState = deriveDrdSourceKind(state);

  if (session.state === 'frozen' || session.state === 'closed') {
    return (
      <FrozenOutputHttpView
        state={state}
        sourceKind={sourceKind}
        utilityPanel={utilityPanel}
        onOpenArtifacts={() => setUtilityPanel('artifacts')}
        onOpenRoles={() => setUtilityPanel('roles')}
        onCloseUtility={() => setUtilityPanel(null)}
        onGenerateReport={() =>
          runtime?.generateReport({
            title: 'Raport DRD',
            content: {
              executiveSummary: 'Sesja DRD — wynik cząstkowy.',
              participants: ['Piotr (Owner)', 'Anna (Approver)'],
              strengths: ['Proces sprzedaży ma podstawową dokumentację.'],
            },
          })
        }
        onGenerateInitiative={() =>
          runtime?.generateInitiativeDraft({
            title: 'Domknij automatyzację procesu sprzedaży w CRM',
            findingIds: (state.output?.findings ?? []).map((f) => f.id),
            rationale: 'Znaleziska Outputu wskazują lukę między current a target.',
            expectedOutcome: 'Podniesienie poziomu dojrzałości.',
            confidence: 'medium',
          })
        }
        onExit={onExit ?? (() => {})}
      />
    );
  }

  const canSendToReview = session.state === 'active';
  const canSendBack = session.state === 'in_review';
  const canFreeze = session.state === 'in_review';

  const sourceKindTitle: Record<DrdVisibleSourceState, string> = {
    SERVER: 'Świeżo potwierdzone przez serwer.',
    SAVING: 'Zapis w toku…',
    SAVED: 'Zapis właśnie potwierdzony przez serwer.',
    OFFLINE: 'Brak połączenia — nic lokalnie nie czeka na wysłanie.',
    RECOVERY_DRAFT: 'Zawiera niezapisaną lokalną zmianę — serwer jej jeszcze nie widział.',
    CONFLICT: 'Konflikt wersji — wymaga decyzji człowieka, nic nie nadpisano.',
    RECONNECTING: 'Połączenie wróciło — sprawdzam serwer przed rekoncyliacją.',
    RECOVERED: 'Rekoncyliacja zakończona — potwierdzone przez serwer.',
  };

  return (
    <div className="flex h-full flex-col">
      {state.status === 'offline' && <OfflineBanner pendingWriteCount={state.pendingWriteCount} onRetry={() => void runtime?.reconnect()} />}
      {state.status === 'recovered' && <RecoveredBanner onDismiss={() => runtime?.acknowledgeRecovered()} />}
      {state.staleDraftNotices.length > 0 && (
        <StaleDraftNoticeBanner notices={state.staleDraftNotices} onDismiss={() => runtime?.acknowledgeStaleDraftNotices()} />
      )}
      <div className="flex items-center gap-3 border-b border-c-border-subtle bg-c-warning/5 px-4 py-1.5 text-[11px] text-c-text-secondary">
        <AlertTriangle size={12} className="shrink-0 text-c-warning" />
        <span>Sesja DRD przez HTTP — {DRD_METHOD_PACK_ID} — demo bypass gotowości packa (methodology_review), jak w legacy runtime.</span>
        <DrdSourceIndicator source={sourceKind} title={sourceKindTitle[sourceKind]} />
      </div>
      {state.status === 'error' && state.error && (
        <div role="alert" className="flex items-center gap-2 border-b border-c-danger/30 bg-c-danger/10 px-4 py-1.5 text-xs text-c-danger">
          <AlertTriangle size={12} />
          {state.error}
          <button type="button" onClick={() => void runtime?.refresh()} className="ml-auto rounded border border-c-danger/40 px-2 py-0.5 font-semibold hover:bg-c-danger/20">
            Spróbuj ponownie
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-c-border-subtle px-4 py-1.5 text-[11px]">
        <span className="font-medium text-c-text-secondary">Oś:</span>
        {DRD_STRUCTURE.map((axis) => (
          <button
            key={axis.id}
            type="button"
            data-testid={`axis-tab-${axis.id}`}
            onClick={() => {
              setActiveAxisId(axis.id);
              setActiveUnitId(axis.areas[0].id);
            }}
            className={`rounded-md px-2 py-1 font-medium ${axis.id === activeAxisId ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted hover:text-c-text'}`}
          >
            {axis.id}. {axis.namePL || axis.name} ({axis.levelCount}L)
          </button>
        ))}
        <UtilityLauncherButtons onOpenArtifacts={() => setUtilityPanel('artifacts')} onOpenRoles={() => setUtilityPanel('roles')} />
      </div>
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
          onSaveStay={() => {}}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          loading={state.status === 'loading' && Boolean(state.session)}
          degradedMessage={
            state.status === 'offline'
              ? state.pendingWriteCount > 0
                ? `Offline — ${state.pendingWriteCount} zmian kolejkowanych lokalnie (RECOVERY_DRAFT), nie potwierdzonych przez serwer.`
                : 'Offline — brak połączenia z serwerem.'
              : session.state === 'active'
                ? null
                : `Status: ${session.state}`
          }
          navigatorProps={{
            nodes: navigatorNodes,
            activeUnitId: activeArea.id,
            onSelect: (unitId) => {
              const axis = DRD_STRUCTURE.find((a) => a.areas.some((ar) => ar.id === unitId));
              if (axis) setActiveAxisId(axis.id);
              setActiveUnitId(unitId);
            },
          }}
          interviewProps={{
            breadcrumb: [activeAxis.namePL || activeAxis.name, activeArea.namePL || activeArea.name, `Poziom ${focusLevelFallback}`],
            questions: interviewQuestions,
            questionIndex: focusLevelFallback - 1,
            questionTotal: activeArea.levels.length,
            resolutionData: {
              questionId: focusQuestions[0]?.questionId ?? '',
              whatIsUnknown: `Czy jednostka ${activeArea.id} spełnia kryteria poziomu ${focusLevelFallback}.`,
              likelyOwnerLabel: 'Właściciel procesu',
              resolvingArtifactHint: 'Dokument procedury lub zrzut z systemu.',
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: handleAnswerChange,
            onAnswerStateChange: (qid, s, j) => void handleAnswerStateChange(qid, s, j),
            onResolutionAction: () => {},
            onEvidenceDrop: (qid, files) => void handleEvidenceDrop(qid, files),
            onBack: () => {},
            onSave: () => void saveNow(),
            onNext: () => {
              const idx = activeAxis.areas.findIndex((a) => a.id === activeArea.id);
              const next = activeAxis.areas[idx + 1];
              if (next) setActiveUnitId(next.id);
            },
            onSkip: () => {},
            onAskTeresa: (questionId) => void handleAskTeresa(questionId),
            canGoBack: true,
            canGoNext: true,
          }}
          teresaProps={{
            sixQuestions: teresaSixQuestions,
            proposalQueue: pendingPreviews,
            onCommit: (r) => void handleCommit(r),
            onTakeLead: () => setMode('teresa_led'),
            onLetMeWorkManually: () => setMode('guided_manual'),
            mode,
          }}
          matrixProps={{
            rows: matrixRows,
            levels: matrixLevels,
            selection: matrixSelection,
            onSelect: (sel) => {
              setMatrixSelection(sel);
              setActiveUnitId(sel.unitId);
            },
            onCloseSideSheet: () => setMatrixSelection(null),
            renderSideSheet: (selection, cell) => (
              <div className="text-xs text-c-text-secondary">
                <p>
                  {selection.unitId} · poziom {selection.level} —{' '}
                  {cell?.blocker ? 'BLOKER (pierwszy niespełniony poziom)' : cell?.reviewRequired ? 'above-gap: wymaga przeglądu' : cell?.achieved ? 'osiągnięty' : 'nieosiągnięty'}
                </p>
              </div>
            ),
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-c-border-subtle px-4 py-2 text-xs">
        <button
          type="button"
          onClick={() => void runtime?.transition('in_review')}
          disabled={!canSendToReview}
          className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
        >
          Wyślij do przeglądu
        </button>
        <button
          type="button"
          onClick={() => void runtime?.transition('active')}
          disabled={!canSendBack}
          className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised"
        >
          Odeślij do pracy (send back)
        </button>
        <button
          type="button"
          onClick={() => void runtime?.freeze()}
          disabled={!canFreeze}
          data-testid="freeze-button"
          className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
        >
          <Lock size={12} />
          Zamroź (tylko approver)
        </button>
      </div>
      <UtilityDrawer panel={utilityPanel} sessionId={session.id} currentUserId={session.ownerUserId} onClose={() => setUtilityPanel(null)} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Post-freeze view: Output / Report / Initiative — HTTP-shaped records
// ---------------------------------------------------------------------------

const FrozenOutputHttpView: React.FC<{
  state: DrdHttpRuntimeState;
  sourceKind: DrdVisibleSourceState;
  utilityPanel: DrdUtilityPanelKind;
  onOpenArtifacts: () => void;
  onOpenRoles: () => void;
  onCloseUtility: () => void;
  onGenerateReport: () => void;
  onGenerateInitiative: () => void;
  onExit: () => void;
}> = ({ state, sourceKind, utilityPanel, onOpenArtifacts, onOpenRoles, onCloseUtility, onGenerateReport, onGenerateInitiative, onExit }) => {
  const session = state.session!;
  const output = state.output;

  // -- Reopen (agent S8, 2026-08-13) -----------------------------------------
  // Calls `POST /sessions/:id/reopen` directly through the thin
  // `methodCoreApi` client, NOT through `DrdHttpSessionRuntime` — that
  // runtime's whole model (dedupedWrite/offline queue/output cache) is
  // scoped to ONE session id for its lifetime, but a reopen mints a BRAND
  // NEW session id (`frozen -> active`, new revision — the original frozen
  // row and its Output are never touched). Confirmation-only UX, same shape
  // as `DrdRolesPanel`'s send-back result text: shows the new revision id
  // rather than silently navigating into it (this card has no session-id
  // navigation prop to do so, and shouldn't invent one just for this).
  const [reopenBusy, setReopenBusy] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopenResult, setReopenResult] = useState<string | null>(null);

  const handleReopen = useCallback(async () => {
    setReopenBusy(true);
    setReopenError(null);
    try {
      const res = await apiReopen(session.id, newIdempotencyKey());
      setReopenResult(
        `${res.idempotentReplay ? 'Powtórka tego samego żądania — ' : ''}Nowa rewizja: ${res.session.id.slice(0, 8)} (stan: ${res.session.state}).`
      );
    } catch (err) {
      if (err instanceof MethodCoreApiError) {
        if (err.status === 403) {
          setReopenError('Brak uprawnień — reopen wymaga roli owner lub lead_assessor.');
        } else if (err.status === 409) {
          setReopenError('Sesja nie jest już zamrożona (reopen dotyczy tylko frozen -> active).');
        } else {
          setReopenError(err.message);
        }
      } else {
        setReopenError('Nieznany błąd reopen.');
      }
    } finally {
      setReopenBusy(false);
    }
  }, [session.id]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="drd-http-frozen-output-view">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> Wyjdź
        </button>
        <h1 className="text-sm font-semibold text-c-text">
          Sesja {session.id.slice(0, 8)} — {session.state === 'closed' ? 'Zamknięta' : 'Zamrożona'}
        </h1>
        {/* ★ Hard rule #1: the SESSION itself (frozen, on the server) is what
            this badge describes — `deriveDrdSourceKind` already encodes
            "the server has data" -> never RECOVERY_DRAFT (see that
            function's own header). A missing LOCAL Output pointer is a
            separate, honestly-labeled gap explained in prose below, not a
            reason to mislabel confirmed server data as an unsaved draft. */}
        <DrdSourceIndicator
          source={sourceKind}
          title={
            output
              ? 'Frozen Output pochodzi wyłącznie z odpowiedzi serwera, nigdy z localStorage.'
              : 'Sesja potwierdzona przez serwer — tylko lokalny wskaźnik do treści Outputu jest nieznany w tej karcie.'
          }
        />
        <UtilityLauncherButtons onOpenArtifacts={onOpenArtifacts} onOpenRoles={onOpenRoles} />
      </div>

      {/* Output */}
      <section data-testid="output-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lock size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">AssessmentOutput (immutable, v{output?.outputVersion ?? '—'})</h2>
        </div>
        {!output ? (
          <p className="text-xs text-c-text-muted">
            Sesja jest zamrożona na serwerze, ale ten przeglądarka nie ma lokalnego wskaźnika do jej Outputu (żaden `freeze()`
            nie wykonał się w tej karcie) — serwer nie udostępnia listy Outputów po sesji. Znany, udokumentowany brak (P0A/P0B).
          </p>
        ) : (
          <div className="space-y-2 text-xs text-c-text-secondary">
            <p>contentHash: <code className="text-c-text-muted">{output.contentHash.slice(0, 16)}…</code></p>
            <p>scope: {output.scope}</p>
            <p>limitations: {output.limitations.join(' · ')}</p>
            <div className="rounded-lg border border-c-border-subtle">
              <StandardTable
                columns={OUTPUT_UNIT_COLUMNS}
                data={Object.keys(output.current).map((unitId) => ({
                  id: unitId,
                  unitId,
                  current: output.current[unitId] ?? '—',
                  target: output.target[unitId] ?? '—',
                  gap: output.gap[unitId] ?? '—',
                }))}
              />
            </div>
            <p className="pt-1 font-medium text-c-text">Findings ({output.findings.length})</p>
            {output.findings.map((f) => (
              <div key={f.id} className="rounded-lg border border-c-border-subtle p-2">
                <p className="text-c-text">{f.businessMeaning}</p>
                <p className="text-c-text-muted">Rekomendacja: {f.recommendation}</p>
                <p className="text-c-text-muted">Jednostka: {f.unitName} · current {f.currentLevel ?? '—'} · target {f.targetLevel ?? '—'} · gap {f.gap ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Report */}
      <section data-testid="report-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Report Snapshot</h2>
          </div>
          <button type="button" onClick={onGenerateReport} disabled={!output} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
            Generuj raport z Outputu
          </button>
        </div>
        {state.reports.length === 0 ? (
          <p className="text-xs text-c-text-muted">Brak wygenerowanego raportu w tej sesji przeglądarki.</p>
        ) : (
          state.reports.map((r, i) => {
            const rec = r as { id?: string; title?: string; content?: { executiveSummary?: string } };
            return (
              <div key={rec.id ?? i} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs text-c-text-secondary">
                <p className="text-c-text">{rec.title}</p>
                <p>{rec.content?.executiveSummary}</p>
              </div>
            );
          })
        )}
      </section>

      {/* Initiative Draft */}
      <section data-testid="initiative-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-c-text-secondary" />
            <h2 className="text-sm font-semibold text-c-text">Initiative Proposal Draft (lokalny, NIE Registered Initiative)</h2>
          </div>
          <button type="button" onClick={onGenerateInitiative} disabled={!output} className="rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
            Wygeneruj z findingów
          </button>
        </div>
        {state.initiatives.length === 0 ? (
          <p className="text-xs text-c-text-muted">Brak draftów w tej sesji przeglądarki.</p>
        ) : (
          state.initiatives.map((d, i) => {
            const rec = d as { id?: string; title?: string; summary?: string | null; confidence?: string };
            return (
              <div key={rec.id ?? i} className="mb-2 rounded-lg border border-c-border-subtle p-2 text-xs">
                <p className="font-medium text-c-text">{rec.title}</p>
                <p className="text-c-text-secondary">{rec.summary}</p>
                <p className="text-c-text-muted">confidence: {rec.confidence}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-c-warning">Draft — decyzja „Register as Initiative" należy do człowieka, poza tym modułem.</p>
              </div>
            );
          })
        )}
      </section>

      {/* Reopen — POST /sessions/:id/reopen (agent S8, 2026-08-13) */}
      <section data-testid="reopen-panel" className="rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <RotateCcw size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">Reopen — nowa rewizja</h2>
        </div>
        <p className="mb-2 text-xs text-c-text-muted">
          Tworzy nową rewizję (frozen → active) — ta zamrożona sesja i jej Output pozostają nietknięte. Wymaga roli owner lub lead_assessor.
        </p>
        <button
          type="button"
          onClick={() => void handleReopen()}
          disabled={reopenBusy}
          data-testid="reopen-button"
          className="rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40"
        >
          {reopenBusy ? 'Reopen…' : 'Reopen sesji'}
        </button>
        {reopenError ? (
          <p className="mt-2 text-[11px] text-c-danger" data-testid="reopen-error">
            {reopenError}
          </p>
        ) : null}
        {reopenResult ? (
          <p className="mt-2 text-[11px] text-c-text-secondary" data-testid="reopen-result">
            {reopenResult}
          </p>
        ) : null}
      </section>
      <UtilityDrawer panel={utilityPanel} sessionId={session.id} currentUserId={session.ownerUserId} onClose={onCloseUtility} />
    </div>
  );
};

export default DrdHttpMethodWorkspaceScreen;
