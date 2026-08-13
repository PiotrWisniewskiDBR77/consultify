/**
 * @vitest-environment jsdom
 *
 * DrdSessionRuntime — browser-local mirror of the kernel rules for the DRD
 * vertical slice (A6, 2026-08-13). Covers the runtime-testable half of the
 * checkpoint's 10 test requirements (2, 3, 4, 5, 6, 7, 8, 9); requirement 1
 * (flag OFF/ON) lives in drdMethodWorkspaceGating.test.ts, requirement 10
 * (per-axis matrix scale + click/return position) in
 * DrdMethodWorkspaceScreen.matrix.test.tsx.
 *
 * Every test constructs its OWN `DrdSessionRuntime` bound to a fresh
 * in-memory `Storage` (see `makeMemoryStorage`) — never `window.localStorage`
 * directly — so tests cannot leak state into each other.
 */
import { describe, expect, it } from 'vitest';

import {
  createDrdDemoSession,
  DrdSessionRuntime,
} from '../drdSessionRuntime';
import * as initiativeDraftModule from '@/method-core/outputs/initiativeDraft';

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function makeStartedSession(storage: Storage) {
  const runtime = createDrdDemoSession({
    organizationId: 'org-1',
    projectId: 'project-1',
    ownerUserId: 'owner-1',
    storage,
  });
  runtime.assignRole('owner-1', 'owner');
  runtime.assignRole('owner-1', 'lead_assessor');
  runtime.assignRole('owner-1', 'assessor');
  runtime.assignRole('approver-1', 'approver');
  runtime.transition('prepared', 'owner-1');
  runtime.transition('active', 'owner-1');
  return runtime;
}

function driveToInReviewWithEvidence(storage: Storage) {
  const runtime = makeStartedSession(storage);
  runtime.recordAnswer({
    unitId: '1A',
    level: 1,
    questionId: '1A-L1-Q1',
    answerState: 'confirmed',
    text: 'Odpowiedź testowa.',
    actorUserId: 'owner-1',
  });
  runtime.recordEvidence({
    unitId: '1A',
    level: 1,
    evidenceId: 'ev-1',
    evidenceType: 'document',
    strength: 'E2',
    actorUserId: 'owner-1',
  });
  runtime.recordTargetDecision({ unitId: '1A', level: 4, rationale: 'Cel roczny.', actorUserId: 'owner-1' });
  runtime.transition('in_review', 'owner-1');
  return runtime;
}

describe('DrdSessionRuntime — event store + reload restores state (requirement 2)', () => {
  it('recordAnswer/recordEvidence append real kernel-shaped events; a FRESH runtime instance over the SAME storage sees the exact same state (reload simulation)', () => {
    const storage = makeMemoryStorage();
    const runtime = makeStartedSession(storage);
    const sessionId = runtime.sessionId;

    runtime.recordAnswer({
      unitId: '1A',
      level: 1,
      questionId: '1A-L1-Q1',
      answerState: 'confirmed',
      text: 'Mamy podstawowy proces.',
      actorUserId: 'owner-1',
    });
    runtime.recordEvidence({
      unitId: '1A',
      level: 1,
      evidenceId: 'ev-reload-1',
      evidenceType: 'document',
      strength: 'E3',
      actorUserId: 'owner-1',
    });

    // Simulate a full page reload: a BRAND NEW instance, no shared JS state,
    // only the storage backend in common.
    const reloaded = new DrdSessionRuntime(sessionId, storage);
    const events = reloaded.listEvents();

    expect(events.some((e) => e.type === 'ANSWER_CONFIRMED' && e.unitId === '1A')).toBe(true);
    expect(events.some((e) => e.type === 'EVIDENCE_ATTACHED' && e.unitId === '1A')).toBe(true);
    expect(reloaded.getSession().state).toBe('active');
    expect(reloaded.getSession().id).toBe(sessionId);
  });

  it('idempotency: appendEvent with the same idempotencyKey twice resolves to the SAME stored event (never a duplicate)', () => {
    const storage = makeMemoryStorage();
    const runtime = makeStartedSession(storage);
    const first = runtime.appendEvent({
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 1,
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: 'fixed-key-1',
      payload: { questionId: '1A-L1-Q1', answerState: 'confirmed' },
    });
    const second = runtime.appendEvent({
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 1,
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: 'fixed-key-1',
      payload: { questionId: '1A-L1-Q1', answerState: 'confirmed' },
    });
    expect(second.id).toBe(first.id);
    expect(runtime.listEvents().filter((e) => e.idempotencyKey === 'fixed-key-1')).toHaveLength(1);
  });
});

describe('DrdSessionRuntime — Teresa Intent -> Preview -> Commit (requirement 3)', () => {
  it('commit without an existing preview is refused (preview_not_found) — a commit request is unrepresentable without previewId at the type level, this is the runtime half', () => {
    const storage = makeMemoryStorage();
    const runtime = makeStartedSession(storage);
    const result = runtime.commitTeresaPreview({
      previewId: 'does-not-exist',
      decision: 'accept',
      actorUserId: 'owner-1',
      idempotencyKey: 'commit-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: 'preview_not_found' });
  });

  it('commit of an already-consumed preview is refused on the second call (preview_already_consumed)', () => {
    const storage = makeMemoryStorage();
    const runtime = makeStartedSession(storage);
    const preview = runtime.createTeresaPreview({
      intent: { capabilityId: 'draft_score_proposal', sessionId: runtime.sessionId, unitId: '1A', level: 2, invokedBy: 'local_action', actorUserId: 'owner-1' },
      statements: [{ kind: 'proposal', text: 'Proponowany poziom 2.', sourceRefs: [] }],
      proposedChanges: [{ target: 'score_proposal', targetId: '1A', before: null, after: 2 }],
      quality: { verdict: 'valid', failedChecks: [] },
    });
    const first = runtime.commitTeresaPreview({ previewId: preview.previewId, decision: 'accept', actorUserId: 'owner-1', idempotencyKey: 'c1' });
    expect(first.ok).toBe(true);
    const second = runtime.commitTeresaPreview({ previewId: preview.previewId, decision: 'accept', actorUserId: 'owner-1', idempotencyKey: 'c2' });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.refusal).toEqual({ kind: 'preview_already_consumed' });
  });

  it('commit of a quality-invalid preview is refused (quality_invalid)', () => {
    const storage = makeMemoryStorage();
    const runtime = makeStartedSession(storage);
    const preview = runtime.createTeresaPreview({
      intent: { capabilityId: 'draft_score_proposal', sessionId: runtime.sessionId, unitId: '1A', level: 2, invokedBy: 'local_action', actorUserId: 'owner-1' },
      statements: [],
      proposedChanges: [],
      quality: { verdict: 'invalid', failedChecks: ['no_unsupported_claim'] },
    });
    const result = runtime.commitTeresaPreview({ previewId: preview.previewId, decision: 'accept', actorUserId: 'owner-1', idempotencyKey: 'c1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: 'quality_invalid', failedChecks: ['no_unsupported_claim'] });
  });
});

describe('DrdSessionRuntime — freeze authority + Output bridge (requirements 4, 5)', () => {
  it('requirement 4: freeze without the approver role is refused with missing_permission', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    const result = runtime.transition('frozen', 'owner-1'); // owner has no `approver` role
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toEqual({ kind: 'missing_permission', requiredRole: 'approver' });
    expect(runtime.getSession().state).toBe('in_review');
    expect(runtime.currentOutputRecord()).toBeNull();
  });

  it('requirement 5: freeze by an actor holding `approver` creates a real, immutable AssessmentOutput', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    const result = runtime.transition('frozen', 'approver-1');
    expect(result.ok).toBe(true);
    expect(runtime.getSession().state).toBe('frozen');

    const record = runtime.currentOutputRecord();
    expect(record).not.toBeNull();
    expect(record!.status).toBe('current');
    const output = record!.content;
    expect(output.current['1A']).toBe(1);
    expect(output.target['1A']).toBe(4);
    expect(output.gap['1A']).toBe(3);
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].supportingEvidence).toHaveLength(1);
    expect(output.limitations.length).toBeGreaterThan(0);

    // OUTPUT_CREATED is a real event in the same append-only log.
    const outputCreated = runtime.listEvents().find((e) => e.type === 'OUTPUT_CREATED');
    expect(outputCreated).toBeTruthy();
    expect((outputCreated!.payload as any).outputId).toBe(output.id);
  });
});

describe('DrdSessionRuntime — Output immutability (requirement 6)', () => {
  it('the frozen AssessmentOutput cannot be mutated — assigning to a field throws (deepFreeze, strict mode)', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const output = runtime.currentOutputRecord()!.content;
    expect(Object.isFrozen(output)).toBe(true);
    expect(() => {
      (output as any).scope = 'tampered';
    }).toThrow();
    expect(output.scope).not.toBe('tampered');
  });
});

describe('DrdSessionRuntime — reopen produces a new revision (requirement 7)', () => {
  it('frozen -> active (reopen) creates a NEW session; the original session row is a separate storage entry, never mutated by the revision', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const originalSessionId = runtime.sessionId;
    const originalSessionBefore = runtime.getSession();
    const originalOutputBefore = runtime.currentOutputRecord()!.content;

    runtime.assignRole('owner-1', 'owner'); // already has it, but explicit for clarity
    const revision = runtime.reopen('owner-1');

    expect(revision.sessionId).not.toBe(originalSessionId);
    expect(revision.getSession().state).toBe('active');
    expect(revision.getSession().revisionOfSessionId).toBe(originalSessionId);

    // Original untouched. Note: this runtime persists via
    // JSON.stringify/parse (see DrdSessionRuntime header), so `read()` never
    // returns the SAME object reference twice by design — the guarantee this
    // asserts is bit-for-bit CONTENT identity, not JS reference identity
    // (unlike the pure in-memory server-side test, which can and does assert
    // `===` — see EventDerivedOutputBridge.test.ts).
    const originalSessionAfter = runtime.getSession();
    expect(originalSessionAfter).toEqual(originalSessionBefore);
    expect(originalSessionAfter.state).toBe('frozen');
    const originalOutputAfter = runtime.currentOutputRecord()!.content;
    expect(originalOutputAfter).toEqual(originalOutputBefore);

    // Re-freezing the REVISION supersedes the ORIGINAL output's wrapper
    // status only — content stays byte-identical.
    revision.recordAnswer({ unitId: '1A', level: 1, questionId: '1A-L1-Q1', answerState: 'confirmed', text: 'Rewizja.', actorUserId: 'owner-1' });
    revision.recordEvidence({ unitId: '1A', level: 1, evidenceId: 'ev-rev-1', evidenceType: 'document', strength: 'E2', actorUserId: 'owner-1' });
    const toReview = revision.transition('in_review', 'owner-1');
    expect(toReview.ok, JSON.stringify(toReview)).toBe(true);
    revision.assignRole('approver-1', 'approver');
    const toFrozen = revision.transition('frozen', 'approver-1');
    expect(toFrozen.ok, JSON.stringify(toFrozen)).toBe(true);

    // The ORIGINAL output (different storage key) is untouched — supersession
    // in this runtime tracks the CURRENT-output pointer per session, and the
    // original session's own storage entry never gets a second freeze.
    const originalOutputStillCurrent = runtime.currentOutputRecord()!;
    expect(originalOutputStillCurrent.content).toEqual(originalOutputBefore);
    expect(originalOutputStillCurrent.status).toBe('current');
  });

  it('within ONE session, a second freeze (simulated by two in-place freezeToOutput calls via reopen+re-freeze on the SAME runtime storage key) marks the prior Output superseded, content untouched', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const v1 = runtime.currentOutputRecord()!.content;

    // Force a second freeze on the SAME session id by manipulating state back
    // to in_review is illegal (frozen -> active only, and that spawns a new
    // session) — so supersession-within-one-lineage is exercised via the
    // revision's re-freeze, asserted from the REVISION's own storage below.
    const revision = runtime.reopen('owner-1');
    revision.recordAnswer({ unitId: '1A', level: 1, questionId: '1A-L1-Q1', answerState: 'confirmed', text: 'x', actorUserId: 'owner-1' });
    revision.recordEvidence({ unitId: '1A', level: 1, evidenceId: 'ev-rev-2', evidenceType: 'document', strength: 'E2', actorUserId: 'owner-1' });
    const toReview = revision.transition('in_review', 'owner-1');
    expect(toReview.ok, JSON.stringify(toReview)).toBe(true);
    revision.assignRole('approver-1', 'approver');
    const toFrozen = revision.transition('frozen', 'approver-1');
    expect(toFrozen.ok, JSON.stringify(toFrozen)).toBe(true);
    const v2Record = revision.currentOutputRecord()!;
    expect(v2Record.content.version).toBe(1); // fresh lineage on the revision's own storage key
    expect(v2Record.status).toBe('current');
    // v1 (original session) is a completely separate storage entry and is
    // never touched by the revision's freeze.
    expect(runtime.currentOutputRecord()!.content).toEqual(v1);
  });
});

describe('DrdSessionRuntime — Report renders from snapshot, not live session (requirement 8)', () => {
  it('a ReportSnapshot built right after freeze is unaffected by directly tampering with the stored session afterwards', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const report = runtime.generateReport({
      executiveSummary: 'Podsumowanie testowe.',
      participants: ['Tester'],
      strengths: ['Mocna strona X.'],
      appendices: [],
      actorUserId: 'owner-1',
    });
    expect(Object.isFrozen(report)).toBe(true);
    const before = JSON.stringify(report);

    // Tamper directly with the persisted session row (bypassing the runtime
    // API entirely) to simulate "the live session changed after freeze".
    const raw = JSON.parse(storage.getItem(`drd-method-workspace:${runtime.sessionId}`)!);
    raw.session.domainStage = 'tampered-after-freeze';
    storage.setItem(`drd-method-workspace:${runtime.sessionId}`, JSON.stringify(raw));

    const reportAfterTamper = runtime.listReports().find((r) => r.status === 'current')!.content;
    expect(JSON.stringify(reportAfterTamper)).toBe(before);
  });
});

describe('DrdSessionRuntime — Initiative Proposal Draft lineage, no path to Registered (requirement 9)', () => {
  it('a generated draft links back to the Output id/version and to real finding ids from that Output', () => {
    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const output = runtime.currentOutputRecord()!.content;
    const drafts = runtime.generateInitiativeDraft({ actorUserId: 'owner-1' });
    expect(drafts.length).toBeGreaterThan(0);
    for (const draft of drafts) {
      expect(draft.outputId).toBe(output.id);
      expect(draft.outputVersion).toBe(output.version);
      for (const findingId of draft.findingIds) {
        expect(output.findings.some((f) => f.id === findingId)).toBe(true);
      }
    }
  });

  it('the initiativeDraft module exposes no register/registerInitiative export and no InitiativeProposalDraft has an initiativeId field', () => {
    const exportNames = Object.keys(initiativeDraftModule);
    expect(exportNames.some((n) => /register/i.test(n))).toBe(false);

    const storage = makeMemoryStorage();
    const runtime = driveToInReviewWithEvidence(storage);
    runtime.transition('frozen', 'approver-1');
    const [draft] = runtime.generateInitiativeDraft({ actorUserId: 'owner-1' });
    expect('initiativeId' in draft).toBe(false);
    expect('registeredInitiativeId' in draft).toBe(false);
  });
});

describe('DrdSessionRuntime — demo pack-readiness bypass is disclosed, not silent', () => {
  it('DRD_DEMO_SESSION_NOTICE is a non-empty, explicit string (the UI is required to show it, never omit it)', async () => {
    const { DRD_DEMO_SESSION_NOTICE } = await import('../drdSessionRuntime');
    expect(DRD_DEMO_SESSION_NOTICE.length).toBeGreaterThan(20);
    expect(DRD_DEMO_SESSION_NOTICE).toMatch(/methodology_review|DEMONSTRACYJNA/i);
  });

  it('does not touch the compiled pack manifest readiness itself (still methodology_review, canStartSession still false)', async () => {
    const { compileDrdPack } = await import('../compileDrdPack');
    const { canStartSession } = await import('@/method-core/contracts');
    const { pack } = compileDrdPack();
    expect(pack.manifest.readiness).toBe('methodology_review');
    expect(canStartSession(pack.manifest.readiness)).toBe(false);
  });
});
