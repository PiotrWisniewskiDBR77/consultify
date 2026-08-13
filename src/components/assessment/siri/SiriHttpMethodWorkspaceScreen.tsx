/**
 * SiriHttpMethodWorkspaceScreen — SIRI vertical slice over HTTP (S5, 2026-08-13).
 *
 * Mounts the SAME shared shell as DRD (`MethodWorkspaceShell`,
 * `src/components/method-workspace/`, A5) — no second architecture. The only
 * SIRI-specific code lives in this directory: navigator/matrix wiring reuses
 * `siriWorkspaceView.ts` (buildSiriNavigatorNodes/buildSiriMatrixRows/
 * checkSiriLeapfrog/propose|confirmSiriBand) and `siriHttpSessionRuntime.ts`
 * for the HTTP round trip — server is the only source of truth, exactly like
 * `DrdHttpMethodWorkspaceScreen.tsx`.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN ENFORCES ON TOP OF THE SHELL
 * ---------------------------------------------------------------------------
 *  - Navigator: strict 3 building blocks -> 8 pillars -> 16 dimensions, no
 *    orphans (`buildSiriNavigatorNodes`).
 *  - Matrix: 16 rows x Bands 0..5. Clicking a cell opens `BandActionPanel`
 *    (the Live Matrix's `renderSideSheet`) — the ONE place Band
 *    propose/confirm/evidence happens in this slice.
 *  - No-leapfrog: `checkSiriLeapfrog` renders an explicit, visible refusal
 *    message before any write is attempted (never a silently-disabled
 *    button with no explanation).
 *  - Rationale is a required field for BOTH propose and confirm — the
 *    buttons are disabled and a hint is shown until non-whitespace text is
 *    present; the actual enforcement is `siriHttpSessionRuntime.ts`'s guard,
 *    this is only the UI's honest mirror of it.
 *  - Assessor PROPOSES (`runtime.proposeBand`), a DIFFERENT explicit action
 *    by participant/approver CONFIRMS (`runtime.confirmBand`) — Teresa's
 *    accepted proposal is wired to `proposeBand` only (see `handleCommit`),
 *    never to `confirmBand`.
 *  - The 80:20 coverage rule is shown as visible, static copy next to the
 *    Band buttons (Module 5.pdf §3.7) — a CONDITION the assessor reads, not
 *    a hidden rule enforced invisibly server-side.
 *  - Evidence Items: E0..E4 strength + `factory_observation` as its own
 *    selectable type (`SIRI_EVIDENCE_ITEM_TYPES`).
 *  - TIER (Prioritisation Matrix) is NEVER rendered here — it is a separate
 *    screen (`SiriTierScreen.tsx`), reachable only via an explicit button
 *    that appears once `session.state === 'frozen'`.
 */
import { AlertTriangle, ArrowLeft, CloudOff, FileText, Layers, Lightbulb, Lock, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MethodWorkspaceShell } from '@/components/method-workspace/MethodWorkspaceShell';
import { StandardTable } from '@/components/standard/StandardTable';
import type { InterviewFocusQuestion, MethodWorkspaceViewMode } from '@/components/method-workspace/types';
import { useMethodWorkspaceSave } from '@/components/method-workspace/useMethodWorkspaceSave';
import type { MethodReadiness, TeresaCommitRequest } from '@/method-core/contracts';
import { compileSiriPack } from '@/method-core/methods/siri/compileSiriPack';
import {
  SiriHttpSessionRuntime,
  type SiriHttpRuntimeState,
} from '@/method-core/methods/siri/siriHttpSessionRuntime';
import {
  buildSiriGenericQuestion,
  buildSiriMatrixRows,
  buildSiriNavigatorNodes,
  checkSiriLeapfrog,
  isValidSiriBandConfirmingActor,
  SIRI_BAND_SCALE,
  SIRI_EVIDENCE_ITEM_TYPES,
  siriEvidenceMissingCount,
  type SiriBandConfirmingActor,
  type SiriEvidenceItemType,
} from '@/method-core/methods/siri/siriWorkspaceView';
import { EVIDENCE_STRENGTHS, type EvidenceStrength } from '@/method-core/contracts';

import {
  SIRI_OUTPUT_UNIT_COLUMNS,
  siriEvidenceEventsFor,
  siriProposedLevelFor,
  siriUnitStatesFromEvents,
} from './siriHttpWorkspaceViewModel';
import { SiriSourceIndicator } from './SiriSourceIndicator';
import { SiriTierScreen } from './SiriTierScreen';

const { pack } = compileSiriPack();
export const SIRI_METHOD_PACK_ID = pack.manifest.id;
export const SIRI_METHOD_PACK_VERSION = pack.manifest.version;

export type SiriHttpDebugForcedState = 'offline' | 'conflict' | 'recovery' | 'loading';

export type SiriSeedTo = 'matrix' | 'leapfrog' | 'evidence' | 'frozen' | 'tier';

export interface SiriHttpMethodWorkspaceScreenProps {
  storage?: Storage;
  demoSessionId?: string;
  onExit?: () => void;
  seedTo?: SiriSeedTo;
  initialViewMode?: MethodWorkspaceViewMode;
  forceState?: SiriHttpDebugForcedState;
}

// ---------------------------------------------------------------------------
// Deterministic seeding — dev-render / demo only, real HTTP writes.
// ---------------------------------------------------------------------------

async function seedHttpSession(runtime: SiriHttpSessionRuntime, seedTo: SiriSeedTo | undefined): Promise<void> {
  await runtime.transition('prepared');
  await runtime.transition('active');
  if (!seedTo) return;

  const unitA = 'strategy_governance';
  const unitB = 'vertical_integration';

  // Confirm Band 0 then Band 1 for unit A — a normal, in-order chain.
  await runtime.proposeBand({ unitId: unitA, level: 0, rationale: 'Widoczna intencja strategiczna kierownictwa.' });
  await runtime.confirmBand({
    unitId: unitA,
    level: 0,
    rationale: 'Zespół roboczy potwierdził na sesji.',
    confirmedByActor: 'participant',
    confirmedByUserId: 'demo-participant',
  });
  await runtime.recordEvidence({ unitId: unitA, level: 0, evidenceItemType: 'document', strength: 'E2', note: 'Strategia cyfrowa — dokument zarządu.' });
  await runtime.proposeBand({ unitId: unitA, level: 1, rationale: 'Plan wdrożenia obejmuje >80% wymaganych elementów.' });
  await runtime.confirmBand({
    unitId: unitA,
    level: 1,
    rationale: 'Approver potwierdził zgodność z 80:20.',
    confirmedByActor: 'approver',
    confirmedByUserId: 'demo-approver',
  });
  await runtime.recordEvidence({
    unitId: unitA,
    level: 1,
    evidenceItemType: 'factory_observation',
    strength: 'E3',
    note: 'Obchód hali — plan widoczny na tablicy Shopfloor Management.',
  });

  if (seedTo === 'evidence') return;

  if (seedTo === 'leapfrog') {
    // Deliberately do NOT confirm Band 0/1 for unit B — the harness/tests
    // then attempt Band 4 through the UI to show the explicit refusal.
    return;
  }

  if (seedTo === 'matrix') return;

  if (seedTo === 'frozen' || seedTo === 'tier') {
    // Confirm just enough units so freeze has something real to summarize —
    // every one of the OTHER dimensions stays unscored (visible, honest gap).
    // Covers all 3 Building Blocks (unitA=ORGANIZATION, unitB=PROCESS, unitC=
    // TECHNOLOGY) so TIER (run only for `tier`) can honestly compute >=1
    // focus dimension per block instead of an artificially incomplete input.
    await runtime.proposeBand({ unitId: unitB, level: 0, rationale: 'Integracja pionowa — poziom podstawowy widoczny.' });
    await runtime.confirmBand({ unitId: unitB, level: 0, rationale: 'Potwierdzone przez uczestnika.', confirmedByActor: 'participant', confirmedByUserId: 'demo-participant' });
    await runtime.recordEvidence({ unitId: unitB, level: 0, evidenceItemType: 'system_record', strength: 'E2' });

    const unitC = 'shop_floor_automation';
    await runtime.proposeBand({ unitId: unitC, level: 0, rationale: 'Automatyzacja produkcji — poziom podstawowy widoczny.' });
    await runtime.confirmBand({ unitId: unitC, level: 0, rationale: 'Potwierdzone przez approvera.', confirmedByActor: 'approver', confirmedByUserId: 'demo-approver' });
    await runtime.recordEvidence({ unitId: unitC, level: 0, evidenceItemType: 'factory_observation', strength: 'E2', note: 'Obchód hali produkcyjnej.' });

    // ★ Deliberately does NOT call transition('in_review')/freeze() here.
    // The session creator only holds the auto-granted 'owner' role;
    // `in_review` requires 'lead_assessor'/'assessor' and `frozen` requires
    // 'approver' (TRANSITION_AUTHORITY, server/src/method-core/contracts) —
    // neither role is assignable over HTTP today (same documented gap as
    // DRD's http runtime: no endpoint grants extra process roles after
    // session creation). Reaching frozen therefore requires an
    // out-of-band DB role grant (method_session_roles) followed by REAL
    // clicks on the "Wyślij do przeglądu" / "Zamroź" buttons below — see
    // the dev-render capture script for the exact sequence. Session stays
    // 'active' after this function returns; this is not a stand-in for a
    // 403, it is the honest, reachable end of this seed's own authority.
  }
}

// ---------------------------------------------------------------------------
// Small state-specific views (mirrors DrdHttpMethodWorkspaceScreen)
// ---------------------------------------------------------------------------

const BootstrapLoadingView: React.FC<{ label: string }> = ({ label }) => (
  <div data-testid="siri-http-bootstrap-loading" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-c-text-muted">
    <SiriSourceIndicator source="RECOVERY_DRAFT" title="Jeszcze bez potwierdzonej odpowiedzi serwera." />
    {label}
  </div>
);

const ConflictView: React.FC<{ state: SiriHttpRuntimeState; onLoadServerVersion: () => void; onExit: () => void }> = ({ state, onLoadServerVersion, onExit }) => (
  <div data-testid="siri-http-conflict-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <SiriSourceIndicator source="RECOVERY_DRAFT" title="Konflikt wersji — lokalny widok jest nieaktualny." />
    <AlertTriangle size={28} className="text-c-danger" />
    <h2 className="text-sm font-semibold text-c-text">Sesja zmieniła się na serwerze</h2>
    <p className="max-w-md text-xs text-c-text-secondary">
      Twoja przeglądarka miała wersję {state.session?.version ?? '—'}, serwer ma już wersję {state.serverVersion ?? '—'}. Nic nie zostało
      nadpisane automatycznie.
    </p>
    <div className="flex items-center gap-2">
      <button type="button" data-testid="conflict-load-server" onClick={onLoadServerVersion} className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle">
        <RefreshCw size={13} /> Wczytaj wersję serwera
      </button>
      <button type="button" onClick={onExit} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Wyjdź bez zmian
      </button>
    </div>
  </div>
);

const RecoveryQueueView: React.FC<{ state: SiriHttpRuntimeState; onApplyPending: () => void; onDiscardPending: () => void }> = ({ state, onApplyPending, onDiscardPending }) => (
  <div data-testid="siri-http-recovery-view" role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    <SiriSourceIndicator source="RECOVERY_DRAFT" title="Zmiany zapisane lokalnie, jeszcze nie potwierdzone przez serwer." />
    <CloudOff size={28} className="text-c-warning" />
    <h2 className="text-sm font-semibold text-c-text">Połączenie wróciło — {state.pendingWriteCount} zaległych zmian czeka</h2>
    <div className="flex items-center gap-2">
      <button type="button" data-testid="recovery-apply-pending" onClick={onApplyPending} className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle">
        <RefreshCw size={13} /> Zastosuj zaległe zmiany ({state.pendingWriteCount})
      </button>
      <button type="button" data-testid="recovery-discard-pending" onClick={onDiscardPending} className="rounded-md border border-c-border px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
        Odrzuć lokalne, wgraj serwer
      </button>
    </div>
  </div>
);

const OfflineBanner: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div data-testid="siri-http-offline-banner" role="alert" className="flex items-center gap-3 border-b border-c-warning/30 bg-c-warning/10 px-4 py-1.5 text-[11px] text-c-warning">
    <CloudOff size={13} className="shrink-0" />
    <span>Brak połączenia z serwerem — zapisy są kolejkowane lokalnie i nigdy nie znikają, ale to NIE jest potwierdzony stan serwera.</span>
    <button type="button" onClick={onRetry} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-c-warning/40 px-2 py-0.5 font-semibold hover:bg-c-warning/20">
      <RefreshCw size={11} /> Spróbuj połączyć ponownie
    </button>
  </div>
);

const ErrorRetryView: React.FC<{ message: string; onRetry: () => void; onExit: () => void }> = ({ message, onRetry, onExit }) => (
  <div data-testid="siri-http-error-view" role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
    <SiriSourceIndicator source="RECOVERY_DRAFT" />
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
// Band action side sheet — the ONE place propose/confirm/evidence happens.
// ---------------------------------------------------------------------------

const BandActionPanel: React.FC<{
  runtime: SiriHttpSessionRuntime | null;
  unitId: string;
  level: number;
  events: SiriHttpRuntimeState['events'];
}> = ({ runtime, unitId, level, events }) => {
  const [rationale, setRationale] = useState('');
  const [confirmingActor, setConfirmingActor] = useState<SiriBandConfirmingActor>('participant');
  const [evidenceType, setEvidenceType] = useState<SiriEvidenceItemType>('document');
  const [evidenceStrength, setEvidenceStrength] = useState<EvidenceStrength>('E2');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const states = useMemo(() => siriUnitStatesFromEvents(events), [events]);
  const state = states.get(unitId)!;
  const leapfrog = useMemo(() => checkSiriLeapfrog(state, level), [state, level]);
  const proposed = useMemo(() => siriProposedLevelFor(events, unitId), [events, unitId]);
  const unitEvidence = useMemo(() => siriEvidenceEventsFor(events, unitId), [events, unitId]);

  const rationaleOk = rationale.trim().length > 0;

  const handlePropose = useCallback(async () => {
    if (!runtime) return;
    setBusy(true);
    setRefusal(null);
    const result = await runtime.proposeBand({ unitId, level, rationale });
    if (!result.ok) setRefusal(result.kind === 'guard_refused' ? result.message : result.message);
    else setRationale('');
    setBusy(false);
  }, [runtime, unitId, level, rationale]);

  const handleConfirm = useCallback(async () => {
    if (!runtime) return;
    setBusy(true);
    setRefusal(null);
    const result = await runtime.confirmBand({
      unitId,
      level,
      rationale,
      confirmedByActor: confirmingActor,
      confirmedByUserId: `demo-${confirmingActor}`,
    });
    if (!result.ok) setRefusal(result.kind === 'guard_refused' ? result.message : result.message);
    else setRationale('');
    setBusy(false);
  }, [runtime, unitId, level, rationale, confirmingActor]);

  const handleAddEvidence = useCallback(async () => {
    if (!runtime) return;
    setBusy(true);
    await runtime.recordEvidence({ unitId, level, evidenceItemType: evidenceType, strength: evidenceStrength, note: evidenceNote });
    setEvidenceNote('');
    setBusy(false);
  }, [runtime, unitId, level, evidenceType, evidenceStrength, evidenceNote]);

  return (
    <div className="space-y-3 text-xs text-c-text-secondary" data-testid="siri-band-action-panel">
      <p className="font-medium text-c-text">
        {unitId} · Band {level}
      </p>

      {/* 80:20 condition — visible, not a hidden rule. */}
      <div className="rounded-md border border-c-border-subtle bg-c-surface-raised p-2" data-testid="siri-8020-condition">
        <p className="font-medium text-c-text-secondary">Warunek pokrycia (80:20 — Module 5 §3.7):</p>
        <p>
          {level === 0
            ? 'Band 0: przynajmniej część atrybutów musi być spełniona.'
            : `Band ${level}: wymagane ≥80% potwierdzonych atrybutów ORAZ osiągnięty Band ${level - 1}.`}
        </p>
      </div>

      {proposed && proposed.level === level && (
        <p className="rounded-md border border-c-info/40 bg-c-info/10 p-2 text-c-info" data-testid="siri-band-proposed-pending">
          Propozycja assessora oczekuje potwierdzenia uczestnika/approvera: „{proposed.rationale}”.
        </p>
      )}

      {!leapfrog.allowed && (
        <p role="alert" data-testid="siri-no-leapfrog-message" className="rounded-md border border-c-danger/40 bg-c-danger/10 p-2 text-c-danger">
          {leapfrog.message}
        </p>
      )}

      <div>
        <label className="mb-1 block font-medium text-c-text-secondary" htmlFor={`siri-rationale-${unitId}-${level}`}>
          Uzasadnienie (rationale) — wymagane
        </label>
        <textarea
          id={`siri-rationale-${unitId}-${level}`}
          data-testid="siri-rationale-input"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          placeholder="Dlaczego ten Band jest uzasadniony…"
        />
        {!rationaleOk && <p className="mt-1 text-[10px] text-c-text-muted">Wymagane przed zapisaniem propozycji lub potwierdzenia.</p>}
      </div>

      {refusal && (
        <p role="alert" data-testid="siri-band-refusal" className="rounded-md border border-c-danger/40 bg-c-danger/10 p-2 text-c-danger">
          {refusal}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="siri-propose-band"
          onClick={() => void handlePropose()}
          disabled={busy || !rationaleOk || !leapfrog.allowed}
          className="rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1.5 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
        >
          Zaproponuj Band (Assessor)
        </button>
        <select
          data-testid="siri-confirming-actor"
          value={confirmingActor}
          onChange={(e) => {
            const v = e.target.value;
            if (isValidSiriBandConfirmingActor(v)) setConfirmingActor(v);
          }}
          className="rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text"
        >
          <option value="participant">Uczestnik</option>
          <option value="approver">Approver</option>
        </select>
        <button
          type="button"
          data-testid="siri-confirm-band"
          onClick={() => void handleConfirm()}
          disabled={busy || !rationaleOk || !leapfrog.allowed}
          className="rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1.5 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
        >
          Zatwierdź Band (Uczestnik/Approver)
        </button>
      </div>

      <div className="border-t border-c-border-subtle pt-2">
        <p className="mb-1 font-medium text-c-text-secondary">Dowody dla tego wymiaru ({unitEvidence.length})</p>
        <div className="flex flex-wrap items-center gap-2">
          <select data-testid="siri-evidence-type" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value as SiriEvidenceItemType)} className="rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text">
            {SIRI_EVIDENCE_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select data-testid="siri-evidence-strength" value={evidenceStrength} onChange={(e) => setEvidenceStrength(e.target.value as EvidenceStrength)} className="rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text">
            {EVIDENCE_STRENGTHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            data-testid="siri-evidence-note"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            placeholder="Notatka…"
            className="min-w-[120px] flex-1 rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text"
          />
          <button type="button" data-testid="siri-add-evidence" onClick={() => void handleAddEvidence()} disabled={busy} className="rounded-md border border-c-border px-2 py-1 font-medium text-c-text-secondary hover:bg-c-surface-raised">
            Dodaj dowód
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SiriHttpMethodWorkspaceScreen: React.FC<SiriHttpMethodWorkspaceScreenProps> = ({
  storage: storageProp,
  demoSessionId,
  onExit,
  seedTo,
  initialViewMode,
  forceState,
}) => {
  const storage = storageProp ?? window.localStorage;
  const runtimeRef = useRef<SiriHttpSessionRuntime | null>(null);
  const bootPromiseRef = useRef<Promise<SiriHttpSessionRuntime> | null>(null);
  const seedStartedRef = useRef(false);
  const forceStateAppliedRef = useRef(false);
  // React 18 StrictMode (dev only) double-invokes this effect. Without this
  // guard, resuming via `demoSessionId` would fire TWO concurrent
  // `refresh()` calls on the SAME runtime instance (`bootPromiseRef` already
  // guards session creation/reuse, but not this specific call) — the second
  // call's `setState({status:'loading', ...})` can interleave with the
  // first's completed 'ready' state and leave the UI stuck on
  // RECOVERY_DRAFT even though the server round trip actually succeeded.
  // Confirmed the hard way: the dev-render capture for
  // `07-output-after-restart.png` (reopen via demoSessionId) intermittently
  // never reached SERVER without this guard.
  const resumeRefreshStartedRef = useRef(false);
  const [state, setState] = useState<SiriHttpRuntimeState | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<MethodWorkspaceViewMode>(initialViewMode ?? 'matrix');
  const [mode, setMode] = useState<'guided_manual' | 'teresa_led'>('guided_manual');
  const [matrixSelection, setMatrixSelection] = useState<{ unitId: string; level: number } | null>(null);
  const [showTier, setShowTier] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    async function boot() {
      if (!bootPromiseRef.current) {
        bootPromiseRef.current = demoSessionId
          ? Promise.resolve(new SiriHttpSessionRuntime(demoSessionId, storage))
          : SiriHttpSessionRuntime.create(
              {
                module: 'assessment',
                methodPackId: SIRI_METHOD_PACK_ID,
                methodPackVersion: SIRI_METHOD_PACK_VERSION,
                mode: 'guided_manual',
                demoBypass: true,
              },
              storage
            );
      }
      let runtime: SiriHttpSessionRuntime;
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

      if (demoSessionId && !resumeRefreshStartedRef.current) {
        resumeRefreshStartedRef.current = true;
        await runtime.refresh();
      }
      if (seedTo && !seedStartedRef.current) {
        seedStartedRef.current = true;
        try {
          await seedHttpSession(runtime, seedTo);
        } catch {
          // Honest stop — a real server refusal is shown as-is, never faked.
        }
      }
      if (forceState && runtimeRef.current && !forceStateAppliedRef.current) {
        forceStateAppliedRef.current = true;
        const debugPatch: Partial<SiriHttpRuntimeState> =
          forceState === 'offline'
            ? { status: 'offline', error: 'Brak połączenia z serwerem.' }
            : forceState === 'conflict'
              ? { status: 'conflict', serverVersion: (runtimeRef.current.getState().session?.version ?? 1) + 1, error: 'Sesja zmieniła się na serwerze.' }
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

  const unitStates = useMemo(() => siriUnitStatesFromEvents(events), [events]);
  const navigatorNodes = useMemo(() => buildSiriNavigatorNodes(unitStates), [unitStates]);
  const matrixRows = useMemo(() => buildSiriMatrixRows(unitStates), [unitStates]);

  const activeUnitId = matrixSelection?.unitId ?? navigatorNodes.find((n) => n.parentId?.startsWith('pillar:'))?.unitId ?? 'strategy_governance';
  const activeUnitState = unitStates.get(activeUnitId) ?? unitStates.values().next().value!;
  const focusLevel = matrixSelection?.level ?? Math.max(0, activeUnitState.confirmedLevels.length);
  const focusQuestion = buildSiriGenericQuestion(activeUnitId, focusLevel);
  const evidenceCountForUnit = siriEvidenceEventsFor(events, activeUnitId).length;

  const interviewQuestions: InterviewFocusQuestion[] = [
    {
      question: focusQuestion,
      answerState: activeUnitState.confirmedLevels.includes(focusLevel) ? 'confirmed' : null,
      answerText: '',
      evidenceState: evidenceCountForUnit > 0 ? 'weak' : 'missing',
      evidenceCount: evidenceCountForUnit,
    },
  ];

  const isOnline = state?.status !== 'offline' && state?.status !== 'recovery';

  const { state: saveState, lastSavedAt, errorMessage: saveErrorMessage, saveNow } = useMethodWorkspaceSave({
    isOnline,
    debounceMs: 800,
    save: async () => ({ ok: true }),
  });

  const pendingPreviews = state?.previews ?? [];

  const handleAskTeresa = useCallback(
    async (unitId: string, level: number) => {
      if (!runtime) return;
      const evidence = siriEvidenceEventsFor(events, unitId);
      await runtime.createTeresaPreview({
        capabilityId: 'draft_score_proposal',
        unitId,
        level,
        invokedBy: 'local_action',
        statements: [
          evidence.length > 0
            ? { kind: 'confirmed_fact' as const, text: `Zebrano ${evidence.length} dowód/-ody dla tego wymiaru.`, sourceRefs: evidence.map((e) => e.id) }
            : { kind: 'missing_evidence' as const, text: 'Brak dowodu dla tego wymiaru na tym Bandzie.', sourceRefs: [] },
          { kind: 'proposal' as const, text: `Proponowany Band: ${level}. Wymaga potwierdzenia przez uczestnika/approvera — Teresa nie zatwierdza.`, sourceRefs: [] },
        ],
        proposedChanges: [{ target: 'score_proposal', targetId: unitId, before: null, after: level }],
        quality: { verdict: evidence.length > 0 ? 'valid' : 'needs_human_review', failedChecks: evidence.length > 0 ? [] : ['lists_supporting_evidence'] },
      });
    },
    [runtime, events]
  );

  const handleCommit = useCallback(
    async (request: TeresaCommitRequest) => {
      if (!runtime) return;
      const preview = pendingPreviews.find((p) => p.previewId === request.previewId);
      const outcome = await runtime.commitTeresaPreview({ previewId: request.previewId, decision: request.decision, editedChanges: request.editedChanges });
      // ★ Teresa's accepted proposal becomes an ASSESSOR PROPOSAL only
      // (`proposeBand`) — this screen has NO code path from a Teresa commit
      // to `confirmBand`. Confirmation is always a separate, explicit human
      // action via `BandActionPanel`.
      if (outcome.ok && (request.decision === 'accept' || request.decision === 'accept_with_edits') && preview) {
        const change = preview.proposedChanges.find((c) => c.target === 'score_proposal');
        if (change && typeof change.after === 'number' && preview.intent.unitId) {
          const statement = preview.statements.find((s) => s.kind === 'proposal');
          await runtime.proposeBand({
            unitId: preview.intent.unitId,
            level: change.after,
            rationale: statement?.text ?? 'Propozycja Teresy zaakceptowana przez człowieka (wymaga jeszcze potwierdzenia Band).',
          });
        }
      }
    },
    [runtime, pendingPreviews]
  );

  const readiness: MethodReadiness = useMemo(() => {
    const totalUnits = pack.units.length;
    let answeredUnits = 0;
    let unitsMissingEvidence = 0;
    for (const s of unitStates.values()) {
      if (s.confirmedLevels.length > 0) answeredUnits++;
      if (siriEvidenceEventsFor(events, s.unitId).length === 0) unitsMissingEvidence++;
    }
    const frozenAlready = state?.session?.state === 'frozen' || state?.session?.state === 'closed';
    const freezeBlockers: string[] = [];
    if (answeredUnits === 0) freezeBlockers.push('Brak potwierdzonych wymiarów — sesja nie została jeszcze rozpoczęta.');
    if (pendingPreviews.length > 0) freezeBlockers.push(`${pendingPreviews.length} propozycji Teresy oczekuje decyzji`);
    return {
      answeredUnits,
      totalUnits,
      unitsMissingEvidence,
      openDiscrepancies: 0,
      pendingProposals: pendingPreviews.length,
      freezeBlockers: frozenAlready ? [] : freezeBlockers,
    };
  }, [unitStates, events, pendingPreviews.length, state?.session?.state]);

  const evidenceMissingCoverage = useMemo(() => siriEvidenceMissingCount(), []);

  const teresaSixQuestions = {
    whereAreWe: `Sesja SIRI, wymiar ${activeUnitId}, Band ${focusLevel}. ${readiness.answeredUnits}/${readiness.totalUnits} wymiarów dotkniętych (16D).`,
    whatMattersNow: `Czy wymiar ${activeUnitId} spełnia warunki Band ${focusLevel} (80:20, Module 5 §3.7).`,
    why: 'Assessment Matrix ocenia 16 wymiarów — Pillar/Building Block to wyłącznie grupowanie, nie osobny wynik.',
    whatIsMissing:
      evidenceMissingCoverage.levelsMarkedEvidenceMissing === evidenceMissingCoverage.levelsTotal
        ? `EVIDENCE_MISSING: treść licencjonowana per-Band nie została przepisana (${evidenceMissingCoverage.levelsMarkedEvidenceMissing}/${evidenceMissingCoverage.levelsTotal}).`
        : `${evidenceCountForUnit} dowód/-ody zebrane dla bieżącego wymiaru.`,
    nextSafeAction: pendingPreviews.length > 0 ? 'Zdecyduj o oczekujących propozycjach Teresy.' : 'Wybierz Band w Matrix i uzupełnij uzasadnienie.',
  };

  if (showTier && state?.session) {
    return (
      <SiriTierScreen
        session={state.session}
        output={state.output}
        onExit={() => setShowTier(false)}
      />
    );
  }

  if (bootError) {
    return <ErrorRetryView message={`Nie udało się utworzyć sesji: ${bootError}`} onRetry={() => window.location.reload()} onExit={onExit ?? (() => {})} />;
  }
  if (!state) {
    return <BootstrapLoadingView label="Tworzenie sesji…" />;
  }
  if (state.status === 'loading' && !state.session) {
    return <BootstrapLoadingView label="Wczytywanie sesji z serwera…" />;
  }
  if (state.status === 'conflict') {
    return <ConflictView state={state} onExit={onExit ?? (() => {})} onLoadServerVersion={() => void runtime?.refresh()} />;
  }
  if (state.status === 'recovery') {
    return <RecoveryQueueView state={state} onApplyPending={() => void runtime?.retryPending()} onDiscardPending={() => void runtime?.discardPendingAndReloadServer()} />;
  }
  if (state.status === 'error' && !state.session) {
    return <ErrorRetryView message={state.error ?? 'Nieznany błąd.'} onRetry={() => void runtime?.refresh()} onExit={onExit ?? (() => {})} />;
  }

  const session = state.session;
  if (!session) {
    return <BootstrapLoadingView label="Wczytywanie sesji…" />;
  }

  const sourceKind = state.status === 'ready' ? 'SERVER' : 'RECOVERY_DRAFT';

  if (session.state === 'frozen' || session.state === 'closed') {
    return (
      <FrozenOutputHttpView
        state={state}
        sourceKind={sourceKind}
        onOpenTier={() => setShowTier(true)}
        onGenerateReport={() =>
          runtime?.generateReport({
            title: 'Raport SIRI',
            content: {
              executiveSummary: 'Sesja SIRI — wynik cząstkowy (16 wymiarów, niektóre EVIDENCE_MISSING).',
              participants: ['Assessor', 'Approver'],
            },
          })
        }
        onGenerateInitiative={() =>
          runtime?.generateInitiativeDraft({
            title: 'Podnieś dojrzałość wymiaru SIRI',
            findingIds: (state.output?.findings ?? []).map((f) => f.id),
            rationale: 'Findingi Outputu wskazują lukę current->target.',
            expectedOutcome: 'Podniesienie Band dla wybranego wymiaru.',
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

  return (
    <div className="flex h-full flex-col">
      {state.status === 'offline' && <OfflineBanner onRetry={() => void runtime?.refresh()} />}
      <div className="flex items-center gap-3 border-b border-c-border-subtle bg-c-warning/5 px-4 py-1.5 text-[11px] text-c-text-secondary">
        <AlertTriangle size={12} className="shrink-0 text-c-warning" />
        <span>
          Sesja SIRI przez HTTP — {SIRI_METHOD_PACK_ID}@{SIRI_METHOD_PACK_VERSION} — pack readiness: draft (demo bypass gotowości packa).
        </span>
        <SiriSourceIndicator source={sourceKind} title={sourceKind === 'SERVER' ? 'Świeżo potwierdzone przez serwer.' : 'Nie w pełni zsynchronizowane z serwerem.'} />
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
              ? 'Offline — praca kolejkowana lokalnie, nie potwierdzona przez serwer.'
              : session.state === 'active'
                ? null
                : `Status: ${session.state}`
          }
          navigatorProps={{
            nodes: navigatorNodes,
            activeUnitId,
            onSelect: (unitId) => setMatrixSelection({ unitId, level: 0 }),
          }}
          interviewProps={{
            breadcrumb: ['SIRI 16D', activeUnitId, `Band ${focusLevel}`],
            questions: interviewQuestions,
            questionIndex: 0,
            questionTotal: 1,
            resolutionData: {
              questionId: focusQuestion.questionId,
              whatIsUnknown: `Czy wymiar ${activeUnitId} spełnia kryteria Band ${focusLevel}.`,
              likelyOwnerLabel: 'Head of Department / SME',
              resolvingArtifactHint: 'Dokument, system record lub obchód hali (factory_observation).',
              dueDate: null,
              blocksFreeze: true,
            },
            onAnswerChange: () => {},
            onAnswerStateChange: () => {},
            onResolutionAction: () => {},
            onEvidenceDrop: () => {},
            onBack: () => {},
            onSave: () => void saveNow(),
            onNext: () => {},
            onSkip: () => {},
            onAskTeresa: () => void handleAskTeresa(activeUnitId, focusLevel),
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
            levels: [...SIRI_BAND_SCALE],
            selection: matrixSelection,
            onSelect: (sel) => setMatrixSelection(sel),
            onCloseSideSheet: () => setMatrixSelection(null),
            renderSideSheet: (selection) => <BandActionPanel runtime={runtime} unitId={selection.unitId} level={selection.level} events={events} />,
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-c-border-subtle px-4 py-2 text-xs">
        <button type="button" onClick={() => void runtime?.transition('in_review')} disabled={!canSendToReview} className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
          Wyślij do przeglądu
        </button>
        <button type="button" onClick={() => void runtime?.transition('active')} disabled={!canSendBack} className="rounded-md border border-c-border px-2.5 py-1 font-medium text-c-text-secondary disabled:opacity-40 hover:bg-c-surface-raised">
          Odeślij do pracy (send back)
        </button>
        <button
          type="button"
          onClick={() => void runtime?.freeze()}
          disabled={!canFreeze}
          data-testid="siri-freeze-button"
          className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface-raised px-2.5 py-1 font-semibold text-c-text disabled:opacity-40 hover:bg-c-border-subtle"
        >
          <Lock size={12} />
          Zamroź (tylko approver)
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Post-freeze view
// ---------------------------------------------------------------------------

const FrozenOutputHttpView: React.FC<{
  state: SiriHttpRuntimeState;
  sourceKind: 'SERVER' | 'RECOVERY_DRAFT';
  onOpenTier: () => void;
  onGenerateReport: () => void;
  onGenerateInitiative: () => void;
  onExit: () => void;
}> = ({ state, sourceKind, onOpenTier, onGenerateReport, onGenerateInitiative, onExit }) => {
  const session = state.session!;
  const output = state.output;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-c-bg p-6" data-testid="siri-http-frozen-output-view">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised">
          <ArrowLeft size={13} /> Wyjdź
        </button>
        <h1 className="text-sm font-semibold text-c-text">
          Sesja SIRI {session.id.slice(0, 8)} — {session.state === 'closed' ? 'Zamknięta' : 'Zamrożona'}
        </h1>
        <SiriSourceIndicator source={output ? sourceKind : 'RECOVERY_DRAFT'} title="Frozen Output pochodzi wyłącznie z odpowiedzi serwera." />
        <button type="button" data-testid="siri-open-tier" onClick={onOpenTier} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-border-subtle">
          <Layers size={13} /> Otwórz TIER (Prioritisation Matrix)
        </button>
      </div>

      <section data-testid="siri-output-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lock size={14} className="text-c-text-secondary" />
          <h2 className="text-sm font-semibold text-c-text">AssessmentOutput (immutable, v{output?.outputVersion ?? '—'})</h2>
        </div>
        {!output ? (
          <p className="text-xs text-c-text-muted">
            Sesja jest zamrożona na serwerze, ale ta przeglądarka nie ma lokalnego wskaźnika do jej Outputu — serwer nie udostępnia listy
            Outputów po sesji (znany brak, jak w DRD P0A/P0B).
          </p>
        ) : (
          <div className="space-y-2 text-xs text-c-text-secondary">
            <p>
              contentHash: <code className="text-c-text-muted">{output.contentHash.slice(0, 16)}…</code>
            </p>
            <p>limitations: {output.limitations.join(' · ')}</p>
            <div className="rounded-lg border border-c-border-subtle">
              <StandardTable
                columns={SIRI_OUTPUT_UNIT_COLUMNS}
                data={Object.keys(output.current).map((unitId) => ({
                  id: unitId,
                  unitId,
                  current: output.current[unitId] ?? '—',
                  target: output.target[unitId] ?? '—',
                  gap: output.gap[unitId] ?? '—',
                }))}
              />
            </div>
          </div>
        )}
      </section>

      <section data-testid="siri-report-panel" className="mb-6 rounded-xl border border-c-border bg-c-surface p-4">
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

      <section data-testid="siri-initiative-panel" className="rounded-xl border border-c-border bg-c-surface p-4">
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
                <p className="text-c-text-muted">confidence: {rec.confidence}</p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default SiriHttpMethodWorkspaceScreen;
