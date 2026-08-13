/**
 * Document Studio — Document Lifecycle service tests (Epic E5, Slice 5.1).
 *
 * Covers:
 *   - initializeDocumentLifecycle defaults to draft and is idempotent.
 *   - transitionDocumentStatus enforces ALLOWED_TRANSITIONS and is
 *     idempotent on same-state requests.
 *   - DocumentLifecycleTransitionError carries a stable code and
 *     from/to context so the route layer can map it to actionable
 *     HTTP statuses.
 *   - History grows append-only; statusChangedAt / statusChangedBy /
 *     statusReason reflect the latest transition.
 *   - getDocumentStatusOrDefault returns 'draft' for artifacts that
 *     have never been initialized (historical data path).
 *   - Cross-tenant isolation: lifecycle state for `${orgA}::artifact`
 *     is not visible to `orgB`.
 *   - Audit pump receives one entry per real transition (never on
 *     no-op same-state requests).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  __resetDocumentLifecycleForTests,
  ALLOWED_TRANSITIONS,
  canTransition,
  DocumentLifecycleTransitionError,
  getDocumentLifecycleState,
  getDocumentStatusOrDefault,
  initializeDocumentLifecycle,
  isValidDocumentStatus,
  registerDocumentLifecycleAuditPump,
  transitionDocumentStatus,
} from '../documentLifecycleService.js';
import type { DocumentAuditEntry, DocumentStatus } from '../documentStudioTypes.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';
const ARTIFACT = 'artifact-1';

let auditPumpSpy: Mock<(entry: DocumentAuditEntry) => void>;

beforeEach(async () => {
  await __resetDocumentLifecycleForTests();
  auditPumpSpy = vi.fn();
  registerDocumentLifecycleAuditPump((entry: DocumentAuditEntry) => {
    auditPumpSpy(entry);
  });
});

afterEach(async () => {
  await __resetDocumentLifecycleForTests();
});

describe('Document Lifecycle — predicates', () => {
  it('isValidDocumentStatus accepts the five known states and rejects everything else', () => {
    const valid: DocumentStatus[] = ['draft', 'in_review', 'approved', 'published', 'archived'];
    for (const v of valid) {
      expect(isValidDocumentStatus(v)).toBe(true);
    }
    expect(isValidDocumentStatus('unknown')).toBe(false);
    expect(isValidDocumentStatus('')).toBe(false);
    expect(isValidDocumentStatus(undefined)).toBe(false);
    expect(isValidDocumentStatus(null)).toBe(false);
    expect(isValidDocumentStatus(42)).toBe(false);
  });

  it('canTransition mirrors ALLOWED_TRANSITIONS', () => {
    for (const [from, allowed] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of allowed) {
        expect(canTransition(from as DocumentStatus, to)).toBe(true);
      }
    }
    // Sanity checks on a few hand-picked rejections.
    expect(canTransition('draft', 'approved')).toBe(false);
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('archived', 'in_review')).toBe(false);
  });
});

describe('Document Lifecycle — initialize', () => {
  it('seeds draft state with statusChangedBy=system when no actor is provided', () => {
    const state = initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
    });
    expect(state.status).toBe('draft');
    expect(state.statusChangedBy).toBe('system');
    expect(state.history).toEqual([]);
  });

  it('honors initialStatus and actorId when supplied', () => {
    const state = initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      initialStatus: 'in_review',
      actorId: USER,
    });
    expect(state.status).toBe('in_review');
    expect(state.statusChangedBy).toBe(USER);
  });

  it('is idempotent: a second call after a transition returns the post-transition state', () => {
    initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
    });
    const second = initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    // Idempotent re-init must NOT reset state to draft.
    expect(second.status).toBe('in_review');
    expect(second.history).toHaveLength(1);
    expect(second.history[0]!.to).toBe('in_review');
  });
});

describe('Document Lifecycle — transitions', () => {
  beforeEach(() => {
    initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
  });

  it('walks the happy-path draft → in_review → approved → published → archived', () => {
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
      reason: 'submit for review',
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'approved',
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'published',
    });
    const state = transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'archived',
    });
    expect(state.status).toBe('archived');
    expect(state.history.map((h) => h.to)).toEqual([
      'in_review',
      'approved',
      'published',
      'archived',
    ]);
  });

  it('rejects invalid transitions with code=invalid_transition + from/to context', () => {
    let caught: unknown;
    try {
      transitionDocumentStatus({
        organizationId: ORG_A,
        artifactId: ARTIFACT,
        userId: USER,
        to: 'published',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentLifecycleTransitionError);
    expect((caught as DocumentLifecycleTransitionError).code).toBe('invalid_transition');
    expect((caught as DocumentLifecycleTransitionError).from).toBe('draft');
    expect((caught as DocumentLifecycleTransitionError).to).toBe('published');
  });

  it('rejects unknown statuses with code=unknown_status', () => {
    expect(() =>
      transitionDocumentStatus({
        organizationId: ORG_A,
        artifactId: ARTIFACT,
        userId: USER,
        to: 'totally_made_up' as unknown as DocumentStatus,
      })
    ).toThrowError(/unknown DocumentStatus/);
  });

  it('rejects transitions on artifacts with no lifecycle state', () => {
    let caught: unknown;
    try {
      transitionDocumentStatus({
        organizationId: ORG_A,
        artifactId: 'never-initialized',
        userId: USER,
        to: 'in_review',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DocumentLifecycleTransitionError);
    expect((caught as DocumentLifecycleTransitionError).code).toBe('unknown_artifact');
  });

  it('is idempotent: same-state transitions are a no-op (no history, no audit)', () => {
    auditPumpSpy.mockClear();
    const before = getDocumentLifecycleState(ARTIFACT, ORG_A);
    const after = transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'draft', // same as current
    });
    expect(after.status).toBe(before!.status);
    expect(after.history).toEqual(before!.history);
    expect(auditPumpSpy).not.toHaveBeenCalled();
  });

  it('records statusReason on the latest transition', () => {
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
      reason: 'sent to PMO for review',
    });
    const state = getDocumentLifecycleState(ARTIFACT, ORG_A);
    expect(state!.statusReason).toBe('sent to PMO for review');
    expect(state!.history[0]!.reason).toBe('sent to PMO for review');
  });

  it('archived artifact can be restored to draft', () => {
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'archived',
    });
    const restored = transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'draft',
      reason: 'restored from archive',
    });
    expect(restored.status).toBe('draft');
    expect(restored.history.at(-1)!.from).toBe('archived');
  });
});

describe('Document Lifecycle — audit emissions', () => {
  it('emits one audit entry per real transition with from/to/reason in details', () => {
    initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
      reason: 'r1',
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'approved',
    });
    expect(auditPumpSpy).toHaveBeenCalledTimes(2);
    const firstCall = auditPumpSpy.mock.calls[0]![0] as DocumentAuditEntry;
    expect(firstCall.action).toBe('document_status_changed');
    expect((firstCall.details as { from?: string; to?: string; reason?: string }).from).toBe(
      'draft'
    );
    expect((firstCall.details as { from?: string; to?: string; reason?: string }).to).toBe(
      'in_review'
    );
    expect((firstCall.details as { from?: string; to?: string; reason?: string }).reason).toBe(
      'r1'
    );
  });
});

describe('Document Lifecycle — tenancy + defaults', () => {
  it('cross-tenant reads return null deny-by-default', () => {
    initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    expect(getDocumentLifecycleState(ARTIFACT, ORG_A)).not.toBeNull();
    expect(getDocumentLifecycleState(ARTIFACT, ORG_B)).toBeNull();
  });

  it('getDocumentStatusOrDefault returns draft when no state exists', () => {
    const out = getDocumentStatusOrDefault('artifact-never-touched', ORG_A);
    expect(out.status).toBe('draft');
    expect(out.statusChangedAt).toBeUndefined();
  });

  it('getDocumentStatusOrDefault returns the live state when present', () => {
    initializeDocumentLifecycle({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    transitionDocumentStatus({
      organizationId: ORG_A,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
    });
    const out = getDocumentStatusOrDefault(ARTIFACT, ORG_A);
    expect(out.status).toBe('in_review');
    expect(out.statusChangedAt).toBeDefined();
  });
});
