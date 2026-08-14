/**
 * M01-P07B — every Teresa handoff target must fail closed (FINDING M01-005).
 *
 * Before this fix, all 6 dispatch targets (`radar`, `initiatives`,
 * `calendar`, `notebook`, `interview`, `excele`) carried the same lie:
 * `const fallbackRef = randomUUID()`, `const ref = realXRef || fallbackRef`,
 * written into `teresa_handoff_results.result_ref` with `{ fallback: true }`.
 * The proposal then transitioned to `completed`, so the caller got a durable
 * receipt and a deep link pointing at an object (signal / initiative /
 * meeting / note / insight / workbook) that was never created.
 * `handleExceleHandoff` was the extreme case — it called no service at all,
 * so EVERY excele handoff fabricated.
 *
 * The contract this file pins, for every target:
 *   1. no owner object  -> no receipt, no `completed`, a typed failure;
 *   2. an id from the writer is a CLAIM — only a tenant-scoped read-back
 *      through the owner module's own read turns it into evidence;
 *   3. a foreign-tenant row reads back as absent, so it produces nothing;
 *   4. a failed receipt insert must NOT be swallowed (`fallback: false`);
 *   5. a target with no write path at all never reaches `completed`;
 *   6. `notebook` additionally forwards the REAL acting `userId` to
 *      `createNote` (FIX for the `owner_user_id='system'` gap: a note
 *      created without it is permanently invisible to the approver, since
 *      `notebookService.ingest` always writes `visibility:'private'` scoped
 *      by `owner_user_id`).
 *
 * This is a controlled-double unit test, not a real-Postgres test: the
 * boundary under test is teresaCopilotService.ts's OWN orchestration logic
 * (fail-closed / read-back / tenant-check / no-swallow), not the internals
 * of the five foreign owner modules (radar/initiatives/calendar/notebook/
 * interview), which belong to other module packets. Real-Postgres coverage
 * for teresaCopilotService.ts's OWN tables (`teresa_proposals`,
 * `teresa_audit_log`, `teresa_handoff_results`) lives in
 * `tests/acceptance/m01-p07b-teresa-handoff.realdb.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Owner-module doubles.
//
// Every owner service is exposed through a mutable control slot so a test can
// make the export DISAPPEAR (`ctl.x.create = null`) — that is the observable
// shape of "the module is not there": `tryImport` returning null and a module
// without the function land on the identical branch in the handler.
// create and read-back are separate slots on purpose: an id handed back by
// the writer is a claim, the read-back is what turns it into evidence.
// ---------------------------------------------------------------------------

type Fn = ((...args: any[]) => any) | null;

const ctl: Record<string, { create: Fn; read: Fn }> = {
  radar: { create: null, read: null },
  initiatives: { create: null, read: null },
  calendar: { create: null, read: null },
  notebook: { create: null, read: null },
  interview: { create: null, read: null },
};

vi.mock('../radarTriageService.js', () => ({
  get createSignal() {
    return ctl.radar.create ?? undefined;
  },
  get getTriageSignal() {
    return ctl.radar.read ?? undefined;
  },
}));

vi.mock('../../initiativeGenerationService.js', () => ({
  get createInitiative() {
    return ctl.initiatives.create ?? undefined;
  },
}));

vi.mock('../planningPortfolioReadService.js', () => ({
  get getInitiativeDetailRead() {
    return ctl.initiatives.read ?? undefined;
  },
}));

vi.mock('../../meetingService.js', () => ({
  get createMeeting() {
    return ctl.calendar.create ?? undefined;
  },
  get getMeeting() {
    return ctl.calendar.read ?? undefined;
  },
}));

// notebook create/read-back double. `createNote` mock records the `userId`
// it was called with so the M01-P07B notebook-owner fix (forwarding the
// REAL acting userId instead of leaving it undefined -> 'system') has a
// direct assertion, not just an indirect "it worked" check.
const notebookCreateCalls: Array<Record<string, unknown>> = [];
vi.mock('../../notebookService.js', () => ({
  get createNote() {
    if (!ctl.notebook.create) return undefined;
    return async (params: Record<string, unknown>) => {
      notebookCreateCalls.push(params);
      return ctl.notebook.create!(params);
    };
  },
  get default() {
    return ctl.notebook.read ? { resolveEmbedChip: ctl.notebook.read } : undefined;
  },
}));

vi.mock('../interviewInsightService.js', () => ({
  get createInsight() {
    return ctl.interview.create ?? undefined;
  },
  get generateInsight() {
    return ctl.interview.create ?? undefined;
  },
  get getById() {
    return ctl.interview.read ?? undefined;
  },
}));

const { executeProposal } = await import('../teresaCopilotService.js');

const ORG = 'org-handoff-1';
const OTHER_ORG = 'org-handoff-other';
const USER = 'user-handoff-1';
const SESSION = 'session-handoff-1';

const UUID_SHAPE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildHandoffContext(module: string) {
  return {
    origin: 'teresa',
    user_intent: `hand off to ${module}`,
    active_surface: 'radar/triage',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [{ ref: 'ref-001', type: 'note' }],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['note:ref-001'],
    proposed_next_action: {
      target_module: module,
      handoff_intent: 'create',
      requires_approval: true,
    },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  } as any;
}

const PAYLOADS: Record<string, () => Record<string, unknown>> = {
  radar: () => ({
    why_now: 'vendor slipped a second milestone',
    time_window: '2026-Q3',
    triggered_rules: ['deadline_proximity'],
    evidence_pointers: ['signal:sig-001'],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    next_action_safe_fallback: 'Capture in notebook',
  }),
  initiatives: () => ({
    initiative_seed: {
      problem_statement: 'Q3 planning gap',
      proposed_outcome: 'Aligned Q3 roadmap',
      assumptions: [],
      risks: [],
      next_steps: [],
      time_window: '2026-Q3',
    },
    proposal_only: true,
  }),
  calendar: () => ({
    calendar_intent: { what: 'Q3 review', when: '2026-08-20T09:00:00.000Z', who: ['owner'] },
    conflict_check: true,
  }),
  notebook: () => ({
    notebook_handoff_context: { title: 'Teresa note', body_preview: 'draft body' },
  }),
  interview: () => ({
    interview_handoff_context: { action: 'generate_insight', session_ids: ['sess-1'] },
  }),
  excele: () => ({ prompt: 'build a risk table', workbook_intent: 'create' }),
};

/** Rows written to the durable handoff-receipt table. */
function receiptInserts(): unknown[][] {
  return mockDbRun.mock.calls.filter(([sql]) =>
    String(sql).includes('INSERT INTO teresa_handoff_results')
  ) as unknown[][];
}

/** State values the proposal was transitioned to. */
function transitionedStates(): string[] {
  return mockDbRun.mock.calls
    .filter(([sql]) => String(sql).includes('UPDATE teresa_proposals'))
    .map(([sql, params]) => {
      const s = String(sql);
      const m = s.match(/state\s*=\s*'([a-z_]+)'/);
      if (m) return m[1];
      return Array.isArray(params) ? String(params[0]) : '';
    });
}

/**
 * Executes an already-approved proposal for `module`. Approval is not what is
 * under test, so the approved row is supplied directly.
 */
async function runExecute(module: string, state: string = 'approved') {
  const proposalId = `proposal-${module}-1`;
  mockDbGet.mockResolvedValue({
    id: proposalId,
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    target_module: module,
    state,
    handoff_context_json: JSON.stringify(buildHandoffContext(module)),
    target_payload_json: JSON.stringify(PAYLOADS[module]()),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return executeProposal({ proposalId, organizationId: ORG, userId: USER });
}

/** Every failure, on every target, must look the same from the outside. */
function expectFailedClosed(result: any) {
  expect(receiptInserts()).toHaveLength(0);
  expect(result.success).toBe(false);
  expect(result.state).not.toBe('completed');
  expect(transitionedStates()).not.toContain('completed');
  expect(result.error).toBeTruthy();
  // The old behaviour surfaced a fresh uuid as the owner reference.
  expect(JSON.stringify(result)).not.toMatch(UUID_SHAPE);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
  notebookCreateCalls.length = 0;
  for (const key of Object.keys(ctl)) {
    ctl[key].create = null;
    ctl[key].read = null;
  }
});

// ---------------------------------------------------------------------------
// Targets that create through an owner service and confirm through its read.
// ---------------------------------------------------------------------------

interface CreateReadTarget {
  module: string;
  refKey: string;
  realId: string;
  ownerRow: (id: string) => unknown;
  expectReadArgs: (id: string) => unknown[];
  foreignRead: (id: string) => unknown;
}

const CREATE_READ_TARGETS: CreateReadTarget[] = [
  {
    module: 'radar',
    refKey: 'signal_id',
    realId: 'signal-real-1',
    ownerRow: (id) => ({ signal_id: id }),
    expectReadArgs: (id) => [id, ORG],
    foreignRead: () => null,
  },
  {
    module: 'initiatives',
    refKey: 'initiative_ref',
    realId: 'initiative-real-1',
    ownerRow: (id) => ({ id, organizationId: ORG }),
    expectReadArgs: (id) => [id, ORG],
    foreignRead: () => null,
  },
  {
    module: 'calendar',
    refKey: 'calendar_ref',
    realId: 'meeting-real-1',
    ownerRow: (id) => ({ id, organizationId: ORG }),
    expectReadArgs: (id) => [{ organizationId: ORG, meetingId: id }],
    foreignRead: () => null,
  },
  {
    module: 'notebook',
    refKey: 'note_ref',
    realId: 'note-real-1',
    ownerRow: (id) => ({ artifactId: id, permissionOk: true }),
    expectReadArgs: (id) => [ORG, USER, 'notebook_page', id],
    // resolveEmbedChip reports permissionOk:false for a page it cannot see.
    foreignRead: (id) => ({ artifactId: id, title: 'Not found', permissionOk: false }),
  },
  {
    module: 'interview',
    refKey: 'insight_ref',
    realId: 'insight-real-1',
    ownerRow: (id) => ({ id, organizationId: ORG }),
    expectReadArgs: (id) => [id],
    // getById is keyed by id ALONE, so the foreign row does come back — the
    // handoff layer has to reject it on the organization stamp.
    foreignRead: (id) => ({ id, organizationId: OTHER_ORG }),
  },
];

for (const target of CREATE_READ_TARGETS) {
  const { module, refKey, realId } = target;

  describe(`M01-005 — ${module} handoff fails closed`, () => {
    beforeEach(() => {
      ctl[module].create = vi.fn(async () => ({ id: realId }));
      ctl[module].read = vi.fn(async () => target.ownerRow(realId));
    });

    it('writes no receipt when the owner service is unavailable', async () => {
      ctl[module].create = null;
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the owner service throws', async () => {
      ctl[module].create = vi.fn(async () => {
        throw new Error(`${module} down`);
      });
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the owner service returns no id', async () => {
      ctl[module].create = vi.fn(async () => ({}));
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the created object cannot be read back', async () => {
      ctl[module].read = vi.fn(async () => null);
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the object belongs to another tenant', async () => {
      ctl[module].read = vi.fn(async () => target.foreignRead(realId));
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the owner read-back itself fails', async () => {
      ctl[module].read = vi.fn(async () => {
        throw new Error(`${module} read failed`);
      });
      expectFailedClosed(await runExecute(module));
    });

    it('writes no receipt when the owner module exposes no read-back', async () => {
      ctl[module].read = null;
      expectFailedClosed(await runExecute(module));
    });

    it('reads back through the owner module, scoped to this organization', async () => {
      await runExecute(module);
      expect(ctl[module].read).toHaveBeenCalledWith(...(target.expectReadArgs(realId) as []));
    });

    it('writes exactly one receipt carrying the real id on success', async () => {
      const result: any = await runExecute(module);

      const inserts = receiptInserts();
      expect(inserts).toHaveLength(1);
      expect(inserts[0][1] as unknown[]).toContain(realId);
      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');
    });

    it('does not swallow a failed receipt write', async () => {
      mockDbRun.mockImplementation(async (sql: string) => {
        if (String(sql).includes('INSERT INTO teresa_handoff_results')) {
          throw new Error('receipt insert failed');
        }
        return { changes: 1 };
      });

      const result: any = await runExecute(module);

      expect(result.success).toBe(false);
      expect(result.state).not.toBe('completed');
      expect(JSON.stringify(result)).not.toMatch(UUID_SHAPE);
    });

    it('retrying a failed handoff still produces nothing', async () => {
      ctl[module].create = vi.fn(async () => {
        throw new Error(`${module} down`);
      });

      await runExecute(module);
      const second = await runExecute(module);

      expectFailedClosed(second);
      expect(ctl[module].create).toHaveBeenCalledTimes(2);
    });

    it('retrying a completed handoff writes no second receipt', async () => {
      const first: any = await runExecute(module);
      expect(first.state).toBe('completed');
      expect(receiptInserts()).toHaveLength(1);

      const second: any = await runExecute(module, 'completed');

      expect(second.success).toBe(true);
      expect(second.state).toBe('completed');
      expect(receiptInserts()).toHaveLength(1);
      expect(ctl[module].create).toHaveBeenCalledTimes(1);
    });

    it('keeps the return-shape key without ever fabricating it', async () => {
      ctl[module].create = vi.fn(async () => {
        throw new Error(`${module} down`);
      });
      const failed: any = await runExecute(module);
      expect(JSON.stringify(failed)).not.toMatch(UUID_SHAPE);

      ctl[module].create = vi.fn(async () => ({ id: realId }));
      await runExecute(module);
      const completedAudit = mockDbRun.mock.calls
        .filter(([sql]) => String(sql).includes('INSERT INTO teresa_audit_log'))
        .map(([, params]) => (Array.isArray(params) ? String(params[7]) : ''))
        .filter((detail) => detail.includes('execution_completed') || detail.includes(refKey));
      expect(completedAudit.join('')).toContain(`"${refKey}":"${realId}"`);
    });
  });
}

// ---------------------------------------------------------------------------
// Notebook — owner_user_id fix: the acting userId must reach createNote.
// ---------------------------------------------------------------------------

describe('M01-P07B — notebook handoff forwards the real acting userId', () => {
  beforeEach(() => {
    ctl.notebook.create = vi.fn(async () => ({ id: 'note-real-1' }));
    ctl.notebook.read = vi.fn(async () => ({ artifactId: 'note-real-1', permissionOk: true }));
  });

  it('passes executeProposal\'s userId through to createNote, not undefined/system', async () => {
    await runExecute('notebook');

    expect(notebookCreateCalls).toHaveLength(1);
    expect(notebookCreateCalls[0].userId).toBe(USER);
  });
});

// ---------------------------------------------------------------------------
// Excele — no owner write path at all.
// ---------------------------------------------------------------------------

describe('M01-005 — excele handoff has no owner object and must fail closed', () => {
  it('never mints a workbook reference', async () => {
    const result: any = await runExecute('excele');

    expectFailedClosed(result);
    expect(result.error).toMatch(/not implemented|unavailable without a real, versioned workbook/i);
  });

  it('leaves the proposal proposal-only with an execution_failed audit', async () => {
    const result: any = await runExecute('excele');

    expect(result.state).toBe('rejected');
    const failureAudits = mockDbRun.mock.calls
      .filter(([sql]) => String(sql).includes('INSERT INTO teresa_audit_log'))
      .filter(([, params]) => Array.isArray(params) && String(params[2]) === 'execution_failed');
    expect(failureAudits).toHaveLength(1);
  });

  it('produces nothing on retry either', async () => {
    await runExecute('excele');
    const second: any = await runExecute('excele');

    expectFailedClosed(second);
  });
});
