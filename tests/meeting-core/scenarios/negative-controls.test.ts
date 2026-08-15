/**
 * negative-controls.test.ts — Task 2: for each of the ten required negative
 * controls, prove TWO things in the SAME (passing) test:
 *   (a) the REAL, unmutated code is safe — the exact behavior the domain/**
 *       and scenarios/*.test.ts suites already assert, re-asserted here
 *       inline so this file is a self-contained gate;
 *   (b) with exactly that ONE protection reversed, the behavior actually
 *       breaks.
 *
 * POLARITY: every control below is written to be GREEN when the real
 * implementation is correct. A control only goes (and stays) RED if the
 * mutation FAILS to break anything — i.e. if the protection it targets is
 * fictional. That is the one case a red control here is the honest signal
 * (see the defects list in the final report) — an always-red suite would be
 * indistinguishable from a real regression and useless as a gate, which is
 * exactly the failure mode this file is designed to avoid.
 *
 * Mechanism (controls 1, 3, 5, 6, 7, 8, 9, 10): `mutantLoader.ts` copies the
 * whole server/src/services/meetingCore/ package verbatim into a fresh temp
 * directory and text-mutates exactly ONE file's exact substring. All sibling
 * files are byte-identical to the real repo, so the mutated file is executed
 * inside an otherwise completely real module graph, against the real
 * scratch-PG database, through the same public functions the domain/**
 * suite already proves are safe when unmutated. `server/src/**` itself is
 * NEVER written to — every mutation lands only in a throwaway
 * `os.tmpdir()` directory, deleted in `finally`.
 *
 * Mechanism (controls 2, 4): these two protections live in
 * server/src/routes/meeting.routes.ts, a file this test suite does not
 * import directly — meeting.routes.ts pulls in auth middleware, betaGate,
 * meetingIntelligenceService and the LEGACY meetingService.js, several of
 * which reach a real, non-scratch database connection at import/call time
 * (exactly the "silent foreign DB contamination" failure mode
 * pgTransaction.ts's own docstring warns about). Booting that file for a
 * unit test would violate "nie łącz się z żadną istniejącą bazą". Instead,
 * each control (a) reads the REAL route file's source text and asserts,
 * with `expect(...).toContain(...)`, that the exact guard snippet under
 * test is still there verbatim — this throws loudly the day the real code
 * drifts, instead of silently testing a stale copy — then (b) exercises a
 * minimal harness built from that verbatim snippet, wired to the REAL
 * (unmutated) meetingCoreService functions, comparing the real guard
 * against a mutated one.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ForbiddenError,
  IllegalTransitionError,
  MeetingNotFoundError,
} from '../../../server/src/services/meetingCore/errors.js';
import {
  addParticipant,
  closeMeeting,
  createMeetingCore,
  getMeetingAggregate,
  listParticipants,
  removeParticipant,
  transitionMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { countTasksBySource, createFakeMaterializer } from '../domain/fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from '../domain/helpers.js';
import { buildMutant } from './mutantLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = resolve(__dirname, '../../../server/src/routes/meeting.routes.ts');

describe('Meeting Core — negative controls (mutate the protection, prove RED)', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  // ------------------------------------------------------------------
  // 1 — usuń predykat organizacji
  // ------------------------------------------------------------------
  it("CONTROL 1: the organization_id predicate in repo.ts getMeetingRow is load-bearing — real code blocks cross-org reads, removing it lets org B read org A's meeting", async () => {
    // (a) REAL, unmutated code: org B cannot see org A's meeting. Same
    // assertion as tenant-isolation.test.ts, re-proven here inline.
    const orgA = makeOrgId('a');
    const orgB = makeOrgId('b');
    const owner = makeUserId('owner');
    const realMeeting = await createMeetingCore(
      {
        organizationId: orgA,
        createdBy: owner,
        title: 'Org A only (real)',
        startAt: '2026-01-01T00:00:00.000Z',
      },
      db.pool
    );
    const realRead = await getMeetingAggregate(
      { organizationId: orgB, meetingId: realMeeting.id },
      db.pool
    );
    expect(realRead).toBeNull();

    // (b) MUTANT: drop the organization_id predicate. If the protection is
    // real, this must break isolation.
    const mutant = buildMutant([
      {
        file: 'repo.ts',
        label: 'drop organization_id predicate in getMeetingRow',
        find: 'SELECT ${MEETING_SELECT_COLUMNS} FROM meetings WHERE id = $1 AND organization_id = $2 LIMIT 1`,\n    [meetingId, organizationId]',
        replace:
          'SELECT ${MEETING_SELECT_COLUMNS} FROM meetings WHERE id = $1 LIMIT 1`,\n    [meetingId]',
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const mutantMeeting = await mod.createMeetingCore(
        {
          organizationId: orgA,
          createdBy: owner,
          title: 'Org A only (mutant)',
          startAt: '2026-01-01T00:00:00.000Z',
        },
        db.pool
      );
      const leaked = await mod.getMeetingAggregate(
        { organizationId: orgB, meetingId: mutantMeeting.id },
        db.pool
      );
      expect(leaked).not.toBeNull(); // protection is real: removing it breaks isolation
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 2 — ufaj aktorowi z body żądania
  // ------------------------------------------------------------------
  it("CONTROL 2: trusting organizationId/userId from the request BODY instead of the JWT-derived req.user lets an attacker impersonate another org's owner", async () => {
    const routesSrc = readFileSync(ROUTES_FILE, 'utf8');
    const realRequireAuthContext = `function requireAuthContext(
  req: AuthRequest,
  res: Response
): { organizationId: string; userId: string } | null {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { organizationId, userId };
}`;
    // Fails loudly (not silently) if the real route file's actor-derivation
    // pattern ever changes out from under this control.
    expect(routesSrc).toContain(realRequireAuthContext);

    const organizationId = makeOrgId('victim-org');
    const owner = makeUserId('victim-owner');
    const attacker = makeUserId('attacker'); // a real, authenticated user — just not a member of this meeting/org
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Victim meeting',
        startAt: '2026-01-02T00:00:00.000Z',
      },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
      db.pool
    );
    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
      db.pool
    );

    // Attacker's genuine JWT identity vs. the org/user they forge in the body.
    const req = {
      user: { organizationId: makeOrgId('attacker-org'), id: attacker },
      body: { organizationId, userId: owner },
    };

    // REAL pattern (verbatim logic from requireAuthContext): derive from req.user only.
    const realCtx = { organizationId: req.user.organizationId, userId: req.user.id };
    await expect(
      closeMeeting(
        {
          organizationId: realCtx.organizationId,
          meetingId: meeting.id,
          actorUserId: realCtx.userId,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(MeetingNotFoundError); // correctly blocked: attacker's real org has no such meeting

    // MUTATED pattern: derive from req.body instead.
    const mutatedCtx = { organizationId: req.body.organizationId, userId: req.body.userId };
    const hijacked = await closeMeeting(
      {
        organizationId: mutatedCtx.organizationId,
        meetingId: meeting.id,
        actorUserId: mutatedCtx.userId,
      },
      db.pool
    );
    expect(hijacked.meeting.lifecycleStatus).toBe('CLOSED'); // protection is real: trusting the body would let the attacker close the victim's meeting by forging org+userId
  });

  // ------------------------------------------------------------------
  // 3 — ufaj roli z body żądania
  // ------------------------------------------------------------------
  it('CONTROL 3: addParticipant\'s DB-verified actingRole lookup is load-bearing — real code blocks self-escalation, trusting "role" from the body instead lets a participant self-promote to owner', async () => {
    // (a) REAL, unmutated code: a plain participant cannot escalate
    // themselves to owner. Same assertion as coverage-gaps.test.ts SCENARIO 3.
    const realOrganizationId = makeOrgId();
    const realOwner = makeUserId('owner');
    const realParticipant = makeUserId('participant');
    const realMeeting = await createMeetingCore(
      {
        organizationId: realOrganizationId,
        createdBy: realOwner,
        title: 'Self-escalation (real)',
        startAt: '2026-01-03T00:00:00.000Z',
      },
      db.pool
    );
    await addParticipant(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        userId: realParticipant,
        role: 'participant',
      },
      db.pool
    );
    await expect(
      addParticipant(
        {
          organizationId: realOrganizationId,
          meetingId: realMeeting.id,
          actorUserId: realParticipant,
          userId: realParticipant,
          role: 'owner',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
    const realRoles = await listParticipants(
      { organizationId: realOrganizationId, meetingId: realMeeting.id },
      db.pool
    );
    expect(realRoles.find((p) => p.userId === realParticipant)?.meetingRole).toBe('participant'); // unchanged

    // (b) MUTANT: trust input.role as the acting-role proof instead of the
    // DB lookup. If the protection is real, this must allow self-escalation.
    const mutant = buildMutant([
      {
        file: 'meetingCoreService.ts',
        label: 'trust actingRole from input.role instead of DB lookup, in addParticipant',
        find: `    const actingRole = await getParticipantRoleRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (
      !actingRole ||
      !PARTICIPANT_MANAGE_ROLES.includes(actingRole as (typeof PARTICIPANT_MANAGE_ROLES)[number])
    ) {
      throw new ForbiddenError(
        \`addParticipant: role '\${actingRole ?? 'none'}' may not manage participants (allowed: \${PARTICIPANT_MANAGE_ROLES.join(', ')}).\`
      );
    }`,
        replace: `    const actingRole = input.role; // MUTATED: trust role from request body instead of DB-verified caller identity
    if (
      !actingRole ||
      !PARTICIPANT_MANAGE_ROLES.includes(actingRole as (typeof PARTICIPANT_MANAGE_ROLES)[number])
    ) {
      throw new ForbiddenError(
        \`addParticipant: role '\${actingRole ?? 'none'}' may not manage participants (allowed: \${PARTICIPANT_MANAGE_ROLES.join(', ')}).\`
      );
    }`,
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const participant = makeUserId('participant');
      const meeting = await mod.createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: 'Self-escalation',
          startAt: '2026-01-03T00:00:00.000Z',
        },
        db.pool
      );
      // Seed the participant directly via SQL rather than mod.addParticipant():
      // this control's mutation makes addParticipant trust input.role AS the
      // acting-role check, so a legitimate owner-granting-'participant'-role
      // call would ALSO (correctly, if confusingly) be rejected by the very
      // same mutated logic — that is a real consequence of the mutation, not
      // a flaw in this control's setup, but it is not what this control is
      // trying to isolate, so setup bypasses it.
      await db.pool.query(
        `INSERT INTO meeting_participants (id, meeting_id, organization_id, user_id, meeting_role, invited_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'participant', $5, now(), now())`,
        [`mp-${participant}`, meeting.id, organizationId, participant, owner]
      );

      const escalated = await mod.addParticipant(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: participant,
          userId: participant,
          role: 'owner',
        },
        db.pool
      );
      expect(escalated.meetingRole).toBe('owner'); // protection is real: removing it allows self-escalation
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 4 — przywróć niezabezpieczone PUT
  // ------------------------------------------------------------------
  it('CONTROL 4: removing the requireMeetingAdmin() gate on PUT /:id (the exact L-04 fix) lets a plain member reach the update handler', () => {
    const routesSrc = readFileSync(ROUTES_FILE, 'utf8');
    const realGuardBlock = `function requireMeetingAdmin(req: AuthRequest, res: Response): boolean {
  const role = getMeetingUserRole(req).toLowerCase();
  if (!PRIVILEGED_MEETING_ROLES.includes(role)) {
    res.status(403).json({ error: 'Admin or owner role required' });
    return false;
  }
  return true;
}`;
    const realPutGuardCall = `    // L-04 asymmetry fix: PUT (full update — title/time/attendees/agenda) was
    // the only mutating route on this resource with NO role gate, while
    // DELETE and PATCH /:id/status both required admin/owner/superadmin.
    // Mirror the same gate here — updating a meeting's core details is at
    // least as sensitive as changing its status.
    if (!requireMeetingAdmin(req, res)) return;`;
    // Fails loudly if the real guard or its real call-site in the PUT
    // handler ever drifts — this control would otherwise silently degrade
    // into testing a stale strawman instead of the shipping code.
    expect(routesSrc).toContain(realGuardBlock);
    expect(routesSrc).toContain(realPutGuardCall);
    expect(routesSrc.split(realPutGuardCall)).toHaveLength(2); // exactly one occurrence

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type FakeReqRes = { role: string; statusCode: number | null };
    const PRIVILEGED_MEETING_ROLES = ['admin', 'owner', 'superadmin'];
    function getMeetingUserRole(fake: FakeReqRes): string {
      return fake.role;
    }
    function requireMeetingAdmin(fake: FakeReqRes): boolean {
      const role = getMeetingUserRole(fake).toLowerCase();
      if (!PRIVILEGED_MEETING_ROLES.includes(role)) {
        fake.statusCode = 403;
        return false;
      }
      return true;
    }

    let downstreamCalls = 0;
    const downstream = () => {
      downstreamCalls += 1;
    };

    function realPutHandler(fake: FakeReqRes): void {
      if (!requireMeetingAdmin(fake)) return; // the exact protection copied above
      downstream();
    }
    function mutatedPutHandler(_fake: FakeReqRes): void {
      // if (!requireMeetingAdmin(fake, res)) return;   <-- L-04 fix reverted
      downstream();
    }

    const plainMemberReq: FakeReqRes = { role: 'member', statusCode: null };
    realPutHandler(plainMemberReq);
    expect(downstreamCalls).toBe(0); // real gate: plain member never reaches the update
    expect(plainMemberReq.statusCode).toBe(403);

    const plainMemberReq2: FakeReqRes = { role: 'member', statusCode: null };
    mutatedPutHandler(plainMemberReq2);
    expect(downstreamCalls).toBe(1); // protection is real: with the gate reverted, a plain member reaches the update handler
  });

  // ------------------------------------------------------------------
  // 5 — pozwól uczestnikowi zamknąć spotkanie
  // ------------------------------------------------------------------
  it('CONTROL 5: CLOSE\'s allowedRoles=[owner,facilitator] in lifecycle.ts is load-bearing — real code blocks a participant from closing, adding "participant" to allowedRoles lets them', async () => {
    async function setUpClosingMeeting(
      create: typeof createMeetingCore,
      addP: typeof addParticipant,
      transition: typeof transitionMeeting,
      suffix: string
    ) {
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const participant = makeUserId('participant');
      const meeting = await create(
        {
          organizationId,
          createdBy: owner,
          title: `Participant closes? (${suffix})`,
          startAt: '2026-01-04T00:00:00.000Z',
        },
        db.pool
      );
      await addP(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          userId: participant,
          role: 'participant',
        },
        db.pool
      );
      await transition(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          transition: 'START_PREPARING',
        },
        db.pool
      );
      await transition(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
        db.pool
      );
      await transition(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      );
      await transition(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
        db.pool
      );
      return { organizationId, meetingId: meeting.id, participant };
    }

    // (a) REAL, unmutated code: a plain participant cannot close. Same
    // assertion as coverage-gaps.test.ts SCENARIO 8.
    const real = await setUpClosingMeeting(
      createMeetingCore,
      addParticipant,
      transitionMeeting,
      'real'
    );
    await expect(
      closeMeeting(
        {
          organizationId: real.organizationId,
          meetingId: real.meetingId,
          actorUserId: real.participant,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(ForbiddenError);

    // (b) MUTANT: add 'participant' to CLOSE's allowedRoles. If the
    // protection is real, this must let a participant close.
    const mutant = buildMutant([
      {
        file: 'lifecycle.ts',
        label: 'allow participant to CLOSE',
        find: `  CLOSE: {
    from: ['CLOSING'],
    to: 'CLOSED',
    allowedRoles: ['owner', 'facilitator'],
  },`,
        replace: `  CLOSE: {
    from: ['CLOSING'],
    to: 'CLOSED',
    allowedRoles: ['owner', 'facilitator', 'participant'],
  },`,
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const mutantSetup = await setUpClosingMeeting(
        mod.createMeetingCore,
        mod.addParticipant,
        mod.transitionMeeting,
        'mutant'
      );
      const closed = await mod.closeMeeting(
        {
          organizationId: mutantSetup.organizationId,
          meetingId: mutantSetup.meetingId,
          actorUserId: mutantSetup.participant,
        },
        db.pool
      );
      expect(closed.meeting.lifecycleStatus).toBe('CLOSED'); // protection is real: removing it lets a participant close
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 6 — pozwól na nielegalny skok lifecycle
  // ------------------------------------------------------------------
  it("CONTROL 6: START_LIVE's `from: ['READY']` in lifecycle.ts is load-bearing — real code rejects DRAFT -> LIVE, widening `from` to include DRAFT lets a meeting skip PREPARING/READY entirely", async () => {
    // (a) REAL, unmutated code: DRAFT -> LIVE directly is illegal. Same
    // assertion as domain/lifecycle.test.ts "rejects an out-of-order transition".
    const realOrganizationId = makeOrgId();
    const realOwner = makeUserId('owner');
    const realMeeting = await createMeetingCore(
      {
        organizationId: realOrganizationId,
        createdBy: realOwner,
        title: 'Illegal jump (real)',
        startAt: '2026-01-05T00:00:00.000Z',
      },
      db.pool
    );
    await expect(
      transitionMeeting(
        {
          organizationId: realOrganizationId,
          meetingId: realMeeting.id,
          actorUserId: realOwner,
          transition: 'START_LIVE',
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);

    // (b) MUTANT: widen START_LIVE's `from` to include DRAFT. If the
    // protection is real, this must let the illegal jump through.
    const mutant = buildMutant([
      {
        file: 'lifecycle.ts',
        label: 'allow DRAFT -> LIVE directly',
        find: `  START_LIVE: {
    from: ['READY'],
    to: 'LIVE',
    allowedRoles: ['owner', 'facilitator'],
  },`,
        replace: `  START_LIVE: {
    from: ['READY', 'DRAFT'],
    to: 'LIVE',
    allowedRoles: ['owner', 'facilitator'],
  },`,
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await mod.createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: 'Illegal jump (mutant)',
          startAt: '2026-01-05T00:00:00.000Z',
        },
        db.pool
      );
      const live = await mod.transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      );
      expect(live.lifecycleStatus).toBe('LIVE'); // protection is real: widening `from` lets DRAFT skip straight to LIVE
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 7 — materializuj propozycję bez zatwierdzenia
  // ------------------------------------------------------------------
  it('CONTROL 7: the APPROVED-status protection in materializeOutput is load-bearing — real code refuses to materialize a PROPOSED output, neutering BOTH the early guard AND the atomic-claim status filter lets it through', async () => {
    // NOTE: as of the concurrency fix (commit e51e57a4be, landed by a
    // parallel session mid-way through writing this control — see
    // markOutputMaterializingRow in repo.ts), this protection is now
    // enforced TWICE: the original early guard in outputs.ts AND the new
    // atomic-claim UPDATE's `WHERE status IN ('APPROVED',
    // 'MATERIALIZATION_FAILED')` in repo.ts (added so concurrent callers
    // can't race past the old single check). Mutating only the FIRST layer
    // no longer breaks materialization — the claim step's WHERE clause
    // independently blocks a PROPOSED output (confirmed empirically: it
    // resolves as a rejected ConflictError, not a bypass). That is DEFENSE
    // IN DEPTH, not a fictional protection, so this control mutates BOTH
    // layers together to prove the underlying invariant is still real once
    // ALL of its current enforcement is removed.
    //
    // (a) REAL, unmutated code: cannot materialize a PROPOSED (never
    // approved) output. Same assertion as domain/outputs-materialization.test.ts.
    const realOrganizationId = makeOrgId();
    const realOwner = makeUserId('owner');
    const realMeeting = await createMeetingCore(
      {
        organizationId: realOrganizationId,
        createdBy: realOwner,
        title: 'Skip approval (real)',
        startAt: '2026-01-06T00:00:00.000Z',
      },
      db.pool
    );
    const realProposed = await proposeOutput(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Never approved (real)' },
      },
      db.pool
    );
    // Deliberately no approveOutput() call.
    await expect(
      materializeOutput(
        {
          organizationId: realOrganizationId,
          meetingId: realMeeting.id,
          outputId: realProposed.id,
          actorUserId: realOwner,
        },
        createFakeMaterializer(db.pool),
        db.pool
      )
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    expect(await countTasksBySource(db.pool, realOrganizationId, realProposed.idempotencyKey)).toBe(
      0
    );

    // (b) MUTANT: neuter the early guard in outputs.ts AND widen the atomic
    // claim's status filter in repo.ts to also accept PROPOSED. If the
    // combined protection is real, this must let an unapproved proposal
    // materialize into a real task row.
    const mutant = buildMutant([
      {
        file: 'outputs.ts',
        label: 'neuter the APPROVED-status guard before materializing',
        find: `  if (output.status !== 'APPROVED' && output.status !== 'MATERIALIZATION_FAILED') {
    throw new IllegalTransitionError(
      \`Cannot materialize output \${output.id}: status is \${output.status}; must be APPROVED (or retry from MATERIALIZATION_FAILED).\`
    );
  }`,
        replace: `  if (false && output.status !== 'APPROVED' && output.status !== 'MATERIALIZATION_FAILED') {
    throw new IllegalTransitionError(
      \`Cannot materialize output \${output.id}: status is \${output.status}; must be APPROVED (or retry from MATERIALIZATION_FAILED).\`
    );
  }`,
      },
      {
        file: 'repo.ts',
        label:
          'widen the atomic-claim status filter in markOutputMaterializingRow to also accept PROPOSED',
        find: `WHERE id = $2 AND status IN ('APPROVED', 'MATERIALIZATION_FAILED')`,
        replace: `WHERE id = $2 AND status IN ('APPROVED', 'MATERIALIZATION_FAILED', 'PROPOSED')`,
      },
    ]);
    try {
      const mod = await mutant.importOutputs();
      const coreMod = await mutant.importMeetingCoreService();
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await coreMod.createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: 'Skip approval (mutant)',
          startAt: '2026-01-06T00:00:00.000Z',
        },
        db.pool
      );
      const proposed = await mod.proposeOutput(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          actorKind: 'human',
          outputKind: 'task',
          payload: { title: 'Never approved (mutant)' },
        },
        db.pool
      );
      // Deliberately no approveOutput() call.
      const materialized = await mod.materializeOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        createFakeMaterializer(db.pool),
        db.pool
      );
      expect(materialized.status).toBe('MATERIALIZED'); // protection is real: neutering the guard materializes an unapproved proposal
      const count = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);
      expect(count).toBe(1); // and a real row exists to prove it, not just a status flip
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 8 — usuń idempotencję
  // ------------------------------------------------------------------
  it('CONTROL 8: the findTaskBySource() recovery lookup in materializeOutput is load-bearing — real code recovers an already-created target instead of duplicating it, removing the lookup creates a DUPLICATE', async () => {
    async function setUpRecoveryScenario(
      create: typeof createMeetingCore,
      propose: typeof proposeOutput,
      approve: typeof approveOutput,
      suffix: string
    ) {
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await create(
        {
          organizationId,
          createdBy: owner,
          title: `Duplicate on retry (${suffix})`,
          startAt: '2026-01-07T00:00:00.000Z',
        },
        db.pool
      );
      const proposed = await propose(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          actorKind: 'human',
          outputKind: 'task',
          payload: { title: `Recovered task, allegedly (${suffix})` },
        },
        db.pool
      );
      await approve(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        db.pool
      );
      // Simulate exactly the domain test's recovery setup: a prior attempt
      // already created the target row (source_id = idempotency_key) but
      // meeting_outputs itself never got confirmed (still APPROVED).
      const preExistingId = `task-recovered-${proposed.id}`;
      await db.pool.query(
        `INSERT INTO tasks (id, organization_id, title, status, created_by, source_type, source_id)
         VALUES ($1, $2, $3, 'todo', $4, 'MEETING_OUTPUT', $5)`,
        [
          preExistingId,
          organizationId,
          `Recovered task, allegedly (${suffix})`,
          owner,
          proposed.idempotencyKey,
        ]
      );
      return {
        organizationId,
        meetingId: meeting.id,
        outputId: proposed.id,
        idempotencyKey: proposed.idempotencyKey,
        preExistingId,
        owner,
      };
    }

    // (a) REAL, unmutated code: materialize RECOVERS the pre-existing target
    // instead of creating a duplicate. Same assertion as the domain test's
    // "recovery" case.
    const real = await setUpRecoveryScenario(
      createMeetingCore,
      proposeOutput,
      approveOutput,
      'real'
    );
    const realMaterialized = await materializeOutput(
      {
        organizationId: real.organizationId,
        meetingId: real.meetingId,
        outputId: real.outputId,
        actorUserId: real.owner,
      },
      createFakeMaterializer(db.pool),
      db.pool
    );
    expect(realMaterialized.canonicalId).toBe(real.preExistingId);
    expect(await countTasksBySource(db.pool, real.organizationId, real.idempotencyKey)).toBe(1);

    // (b) MUTANT: remove the recovery lookup. If the protection is real,
    // this must produce a second, duplicate task row.
    const mutant = buildMutant([
      {
        file: 'outputs.ts',
        label: 'remove idempotent recovery lookup before materializing',
        find: `  const existingTarget =
    output.outputKind === 'task'
      ? await materializer.findTaskBySource(input.organizationId, output.idempotencyKey)
      : await materializer.findDecisionBySource(input.organizationId, output.idempotencyKey);`,
        replace: `  const existingTarget = null; // MUTATED: idempotency recovery lookup removed — always attempts to create a fresh target`,
      },
    ]);
    try {
      const mod = await mutant.importOutputs();
      const coreMod = await mutant.importMeetingCoreService();
      const mutantSetup = await setUpRecoveryScenario(
        coreMod.createMeetingCore,
        mod.proposeOutput,
        mod.approveOutput,
        'mutant'
      );
      await mod.materializeOutput(
        {
          organizationId: mutantSetup.organizationId,
          meetingId: mutantSetup.meetingId,
          outputId: mutantSetup.outputId,
          actorUserId: mutantSetup.owner,
        },
        createFakeMaterializer(db.pool),
        db.pool
      );
      const count = await countTasksBySource(
        db.pool,
        mutantSetup.organizationId,
        mutantSetup.idempotencyKey
      );
      expect(count).toBe(2); // protection is real: removing the recovery lookup creates a duplicate instead of recovering
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 9 — zwróć sukces przed odczytem potwierdzającym
  // ------------------------------------------------------------------
  it('CONTROL 9: the "0 rows affected" confirmation in removeParticipant is load-bearing — real code refuses to report success for a no-op DELETE, skipping the check reports success (and writes a false audit row)', async () => {
    // (a) REAL, unmutated code: removing someone who was never a participant
    // throws MeetingNotFoundError, not a silent success.
    const realOrganizationId = makeOrgId();
    const realOwner = makeUserId('owner');
    const realGhost = makeUserId('ghost'); // never added to this meeting at all
    const realMeeting = await createMeetingCore(
      {
        organizationId: realOrganizationId,
        createdBy: realOwner,
        title: 'False success (real)',
        startAt: '2026-01-08T00:00:00.000Z',
      },
      db.pool
    );
    await expect(
      removeParticipant(
        {
          organizationId: realOrganizationId,
          meetingId: realMeeting.id,
          actorUserId: realOwner,
          targetUserId: realGhost,
        },
        db.pool
      )
    ).rejects.toBeInstanceOf(MeetingNotFoundError);
    const realAuditRows = await db.pool.query(
      `SELECT 1 FROM audit_events WHERE resource_type = 'meeting_participant' AND resource_id = $1 AND action = 'MEETING_PARTICIPANT_REMOVED'`,
      [`${realMeeting.id}:${realGhost}`]
    );
    expect(realAuditRows.rows).toHaveLength(0);

    // (b) MUTANT: skip the "0 rows affected" confirmation. If the
    // protection is real, this must report a false success AND write a
    // false audit row.
    const mutant = buildMutant([
      {
        file: 'meetingCoreService.ts',
        label: 'declare removeParticipant a success without confirming the DELETE matched a row',
        find: `    const removed = await removeParticipantRow(
      client,
      input.organizationId,
      input.meetingId,
      input.targetUserId
    );
    if (!removed) throw new MeetingNotFoundError('Participant not found');`,
        replace: `    const removed = await removeParticipantRow(
      client,
      input.organizationId,
      input.meetingId,
      input.targetUserId
    );
    void removed; // MUTATED: success declared without confirming the DELETE actually matched a row`,
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const neverAParticipant = makeUserId('ghost'); // never added to this meeting at all
      const meeting = await mod.createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: 'False success (mutant)',
          startAt: '2026-01-08T00:00:00.000Z',
        },
        db.pool
      );

      await expect(
        mod.removeParticipant(
          {
            organizationId,
            meetingId: meeting.id,
            actorUserId: owner,
            targetUserId: neverAParticipant,
          },
          db.pool
        )
      ).resolves.toBeUndefined(); // protection is real: removing the check reports success for a removal that never happened

      const auditRows = await db.pool.query(
        `SELECT 1 FROM audit_events WHERE resource_type = 'meeting_participant' AND resource_id = $1 AND action = 'MEETING_PARTICIPANT_REMOVED'`,
        [`${meeting.id}:${neverAParticipant}`]
      );
      expect(auditRows.rows).toHaveLength(1); // and a false audit trail entry exists for a write that never happened
    } finally {
      mutant.cleanup();
    }
  });

  // ------------------------------------------------------------------
  // 10 — rozdziel status i audyt na niezależne klienty z puli
  // ------------------------------------------------------------------
  it("CONTROL 10: closeMeeting's single-pinned-transaction pattern is load-bearing — real code commits status+audit atomically, splitting them across independent pool clients produces a TORN write", async () => {
    // (a) REAL, unmutated code: a normal close commits the status change and
    // its audit row together — same atomic-pairing property proven in
    // coverage-gaps.test.ts SCENARIO 18 and domain/atomicity.test.ts
    // (rollback-on-throw for the shared withPgTransaction pattern).
    const realOrganizationId = makeOrgId();
    const realOwner = makeUserId('owner');
    const realMeeting = await createMeetingCore(
      {
        organizationId: realOrganizationId,
        createdBy: realOwner,
        title: 'Close atomicity (real)',
        startAt: '2026-01-09T00:00:00.000Z',
      },
      db.pool
    );
    await transitionMeeting(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        transition: 'START_PREPARING',
      },
      db.pool
    );
    await transitionMeeting(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        transition: 'MARK_READY',
      },
      db.pool
    );
    await transitionMeeting(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        transition: 'START_LIVE',
      },
      db.pool
    );
    await transitionMeeting(
      {
        organizationId: realOrganizationId,
        meetingId: realMeeting.id,
        actorUserId: realOwner,
        transition: 'START_CLOSING',
      },
      db.pool
    );
    const realResult = await closeMeeting(
      { organizationId: realOrganizationId, meetingId: realMeeting.id, actorUserId: realOwner },
      db.pool
    );
    expect(realResult.meeting.lifecycleStatus).toBe('CLOSED');
    const realAuditRows = await db.pool.query(
      `SELECT 1 FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_CLOSE'`,
      [realMeeting.id]
    );
    expect(realAuditRows.rows).toHaveLength(1); // status and audit always land together

    // (b) MUTANT: move the status write onto an independent pool connection
    // (auto-commits immediately, outside the pinned BEGIN/COMMIT), then
    // force a crash before the audit write. If the pinned-transaction
    // pattern is load-bearing, this must produce a torn write: status
    // commits for real even though the overall call throws and no audit
    // row is ever written.
    const mutant = buildMutant([
      {
        file: 'meetingCoreService.ts',
        label:
          'split status write and audit write across independent pool clients, then crash between them',
        find: `    const closed = await setMeetingClosedRow(
      client,
      input.organizationId,
      input.meetingId,
      input.actorUserId
    );
    if (!closed) throw new MeetingNotFoundError();

    await writeAuditEvent(client, {
      actorId: input.actorUserId,
      action: 'MEETING_TRANSITION_CLOSE',
      resourceType: 'meeting',
      resourceId: input.meetingId,
      organizationId: input.organizationId,
      metadata: { from: current.lifecycleStatus, to: 'CLOSED' },
    });

    return closed;
  }, pool);`,
        replace: `    // MUTATED (control 10): status write moved OFF the pinned transaction
    // client onto an INDEPENDENT pool connection (auto-commits immediately,
    // outside this BEGIN/COMMIT), then a forced crash BEFORE the audit
    // write — simulating "rozdziel status i audyt na niezalezne klienty z puli".
    const independentPool = await resolvePgPool(pool);
    const closed = await setMeetingClosedRow(independentPool, input.organizationId, input.meetingId, input.actorUserId);
    if (!closed) throw new MeetingNotFoundError();
    throw new Error('MUTATED: simulated crash after the independent-connection status write, before the audit write');
  }, pool);`,
      },
    ]);
    try {
      const mod = await mutant.importMeetingCoreService();
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await mod.createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: 'Torn write (mutant)',
          startAt: '2026-01-09T00:00:00.000Z',
        },
        db.pool
      );
      await mod.transitionMeeting(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          transition: 'START_PREPARING',
        },
        db.pool
      );
      await mod.transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
        db.pool
      );
      await mod.transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      );
      await mod.transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
        db.pool
      );

      // The overall call rejects (it throws deliberately, simulating a
      // crash the caller would interpret as "nothing happened")...
      await expect(
        mod.closeMeeting({ organizationId, meetingId: meeting.id, actorUserId: owner }, db.pool)
      ).rejects.toThrow('simulated crash');

      // ...yet reading back through the REAL (unmutated) getMeetingAggregate
      // shows the status change stuck anyway, with no matching audit row —
      // exactly the torn write the pinned-transaction pattern exists to
      // prevent (contrast with the real half above: CLOSED always paired
      // with exactly one audit row).
      const after = await getMeetingAggregate({ organizationId, meetingId: meeting.id }, db.pool);
      const auditRows = await db.pool.query(
        `SELECT 1 FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_CLOSE'`,
        [meeting.id]
      );
      expect(after?.meeting.lifecycleStatus).toBe('CLOSED'); // protection is real: splitting connections lets the status survive a failed call
      expect(auditRows.rows).toHaveLength(0); // ...with no audit row to show for it — a silent, undocumented state change
    } finally {
      mutant.cleanup();
    }
  });
});
