/**
 * UI-CANON G4 — real allowed/forbidden action matrix for six Audits personas.
 *
 * Same discipline as `rbacFixture.ts` / `auditSeed.ts`: every call is a real
 * authenticated HTTP request against the live backend (`POST /api/auth/login`
 * for sessions, `POST /api/audits/*` for actions). No SQL writes, no token
 * minting, no `page.route()` interception. Nothing here decides what the
 * policy SHOULD be — every allowed/forbidden pick is read off
 * `server/src/services/audits/permissions.ts` (`ROLE_CAPABILITIES`, the
 * segregation-of-duties assertions) and `server/src/routes/audits/*.routes.ts`
 * (which endpoint actually calls which capability, several layers down through
 * the service functions the routes are thin wrappers over).
 *
 * ACCOUNT -> AUDIT ROLE MAPPING (six fixture personas, six matrix rows):
 *
 *   - `platformAdmin` plays `program_owner` for FREE: `createProgramFromPack`
 *     (called by `seedAuditProgram`) inserts the creator into
 *     `audit_program_members` as `program_owner` as part of the same
 *     transaction (programService.ts, createProgramCore). No addMember call
 *     needed for this row.
 *   - `leadAuditor` is explicitly added as `lead_auditor` by the platform
 *     admin through `POST /api/audits/programs/:id/members` (capability
 *     `program.manage_members`, which the platform admin holds via
 *     `PLATFORM_ADMIN_CAPABILITIES`, not through any audit role).
 *   - `auditee` is explicitly added as `auditee` the same way. The `auditee`
 *     role's capability list already covers what the task calls
 *     "auditee/action owner" — `action.propose` and
 *     `action.report_implementation` are `auditee` capabilities in
 *     `ROLE_CAPABILITIES`, there is no separate `action_owner` account needed
 *     to exercise them.
 *   - `member` is probed TWICE, in order, on the SAME account:
 *       1. First as a plain ACTIVE org member with NO audit-program role at
 *          all (`getProgramRoles` returns `[]`), which is exactly what the
 *          task calls "plain active member". Its capabilities are only
 *          `ORG_MEMBER_CAPABILITIES` (`pack.read`, `program.create`).
 *       2. THEN, after the plain-member probes are recorded, the platform
 *          admin adds this SAME account to the seeded program as `reviewer`
 *          (`POST /api/audits/programs/:id/members`) and it is probed again
 *          under the `reviewer` key. This is the "reviewer can reuse one of
 *          the six accounts" the task allows — reusing `platformAdmin` or
 *          `leadAuditor` for `reviewer` would have muddied their own rows
 *          (both already hold `finding.review`-adjacent capabilities and one
 *          of them is deliberately the SoD-denial row), so `member` is the
 *          only account whose "before" state (no role) and "after" state
 *          (reviewer role) are both independently useful without
 *          contaminating another row's result.
 *   - `revokedMember` logs in ONCE while its `organization_members` row is
 *     still ACTIVE (a token can only be "valid at issuance, revoked
 *     afterwards" if the login genuinely succeeded first), then
 *     `revokeMembership()` flips that row to `REVOKED`, then every probe in
 *     this row reuses the pre-revocation token. `requireOrgAccess()` on the
 *     `/api/audits` mount (`server/src/routes/audits/index.ts`) blocks the
 *     stale token on every route, so this row's "allowed" action is honestly
 *     `ok: false` — there is no capability left that a revoked membership can
 *     exercise, and the file says so rather than picking something that
 *     would have looked green.
 *   - `foreignTenant` is never a row of its own here (it has no role in the
 *     PRIMARY tenant's program to probe) — it supplies the `foreignAttempt`
 *     control shared by all six rows: the exact same seeded program id,
 *     fetched under the foreign tenant's own session.
 *
 * FORBIDDEN ACTIONS — genuine capability denials, not missing routes:
 *
 *   - `platformAdmin` -> `POST /criteria/:id/test` (`criterion.perform_test`)
 *     is in NEITHER `program_owner`'s `ROLE_CAPABILITIES` NOR
 *     `PLATFORM_ADMIN_CAPABILITIES` — a genuine gap, not a missing route.
 *   - `leadAuditor` -> drafts its OWN finding (`finding.draft`, which
 *     `lead_auditor` genuinely has, so the create succeeds), then tries to
 *     `POST /findings/:id/review` that SAME finding. `lead_auditor` also
 *     holds `finding.review` as a bare capability, so `requireCapability`
 *     passes — the 403 comes from `assertNotReviewingOwnFinding` (the
 *     segregation-of-duties rule the task names explicitly), fired inside
 *     `reviewFinding` right after the capability check. This is the one row
 *     that specifically proves an SoD assertion, not just the role matrix.
 *   - `reviewer` (the promoted `member` account) -> `POST /findings`
 *     (`finding.draft`) is absent from `reviewer`'s `ROLE_CAPABILITIES`.
 *   - `auditee` -> `POST /criteria/:id/conclude` (`criterion.conclude`) is
 *     absent from `auditee`'s `ROLE_CAPABILITIES`. A valid
 *     `conformityStatus: 'not_applicable'` is sent so the request reaches
 *     `requireCapability` instead of failing input validation first
 *     (`concludeCriterion` validates the enum BEFORE checking the
 *     capability — sending an invalid value would produce a 400 that has
 *     nothing to do with authorization).
 *   - `member` (plain, pre-promotion) -> `POST /criteria/:id/test`
 *     (`criterion.perform_test`) — the account holds no role at all on the
 *     seeded program, so `getProgramRoles` returns `[]` and only
 *     `ORG_MEMBER_CAPABILITIES` applies.
 *   - `revokedMember` -> the same `POST /criteria/:id/test` attempt is
 *     genuinely denied, but by `requireOrgAccess()` (membership gate) before
 *     the request ever reaches `requireCapability`. The row's `note` says so
 *     explicitly rather than implying it was denied by the capability
 *     matrix.
 *
 * ALLOWED ACTIONS — one real capability each role's `ROLE_CAPABILITIES` list
 * actually grants, exercised as the corresponding endpoint:
 *
 *   - `platformAdmin` -> `POST /programs/:id/members` (`program.manage_members`)
 *     — this call IS the step that grants `leadAuditor` its role, so it is
 *     load-bearing setup, not a throwaway probe.
 *   - `leadAuditor` -> `POST /criteria/:id/test` (`criterion.perform_test`).
 *   - `reviewer` -> `POST /findings/:id/review` (`finding.review`) on the
 *     finding `leadAuditor` drafted — a DIFFERENT author, so
 *     `assertNotReviewingOwnFinding` does not fire and the review succeeds.
 *     This deliberately mirrors the leadAuditor-forbidden row: same
 *     capability, same SoD rule, opposite author — proving the rule denies
 *     the self-case and allows the independent case.
 *   - `auditee` -> `POST /criteria/:id/auditee-response`
 *     (`criterion.respond_as_auditee`).
 *   - `member` -> `POST /programs` (`program.create`) — granted to EVERY
 *     org member regardless of audit role (`ORG_MEMBER_CAPABILITIES`
 *     includes `program.create`; see the long comment above that constant in
 *     `permissions.ts` explaining why creation is deliberately open while
 *     everything costly stays role-gated). Creates a second, throwaway
 *     program under the same org — cleaned up along with everything else
 *     when the fixture's organizations are deleted.
 *   - `revokedMember` -> honestly `ok: false`. The nearest "would have been
 *     allowed" comparator is `GET /programs/:id`, which is open to any
 *     active org member and returns 200 for the `member` persona earlier in
 *     the same run; for the revoked token it returns whatever
 *     `requireOrgAccess()` answers, recorded verbatim.
 */

import { request as apiRequest } from '@playwright/test';

import { loginViaApi, revokeMembership, type RbacFixture } from './rbacFixture';
import type { AuditSeedResult } from './auditSeed';

function apiBase(): string {
  return process.env.E2E_API_URL || 'http://127.0.0.1:3951';
}

function ok(status: number): boolean {
  return status >= 200 && status < 300;
}

interface ProbeOutcome {
  endpoint: string;
  capability: string;
  status: number;
  ok: boolean;
  note?: string;
}

interface ForbiddenOutcome {
  endpoint: string;
  capability: string;
  status: number;
  denied: boolean;
  note?: string;
}

interface ScopedReadOutcome {
  endpoint: string;
  status: number;
  count: number | null;
  note?: string;
}

interface ForeignAttemptOutcome {
  endpoint: string;
  status: number;
}

export interface PersonaMatrixEntry {
  /** Which fixture account this row's requests were signed by. */
  account: string;
  /** The audit-program role (`audit_program_members.member_role`) this row exercises, or `null` for the no-role plain-member row. */
  auditRole: string | null;
  allowed: ProbeOutcome;
  forbidden: ForbiddenOutcome;
  scopedRead: ScopedReadOutcome;
  foreignAttempt: ForeignAttemptOutcome;
}

export type PersonaMatrixKey =
  | 'platformAdmin'
  | 'leadAuditor'
  | 'reviewer'
  | 'auditee'
  | 'member'
  | 'revokedMember';

export type PersonaMatrixResult = Record<PersonaMatrixKey, PersonaMatrixEntry>;

async function ctxFor(token: string) {
  return apiRequest.newContext({
    baseURL: apiBase(),
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

async function loginOrThrow(email: string, password: string): Promise<string> {
  const res = await loginViaApi(email, password);
  if (res.status !== 200 || !res.token) {
    throw new Error(`personaMatrix: login ${email} -> ${res.status} ${res.text}`);
  }
  return res.token;
}

/** `POST /programs/:id/members` — the real add-member writer, used both as setup and as the platformAdmin row's own recorded allowed action. */
async function addProgramMember(
  adminToken: string,
  programId: string,
  userId: string,
  memberRole: string
): Promise<{ status: number; text: string }> {
  const ctx = await ctxFor(adminToken);
  const res = await ctx.post(`/api/audits/programs/${programId}/members`, {
    data: { userId, memberRole, independenceDeclared: true },
  });
  const text = res.ok() ? '' : await res.text();
  await ctx.dispose();
  return { status: res.status(), text };
}

/**
 * Runs the full six-persona allowed/forbidden/scoped-read/foreign-attempt
 * matrix against the REAL Audits API, using the fixture's real accounts and
 * the already-seeded program/criteria.
 *
 * Order matters and is NOT reorderable: `member` must be probed as a
 * plain, role-less account BEFORE it is promoted to `reviewer`, and
 * `revokedMember` must log in BEFORE `revokeMembership()` runs.
 */
export async function runPersonaMatrix(
  fixture: RbacFixture,
  seed: AuditSeedResult
): Promise<PersonaMatrixResult> {
  const criterionId = seed.firstCriterionId;
  if (!criterionId) {
    throw new Error(
      'personaMatrix: seedAuditProgram returned no firstCriterionId — the demo pack snapshot came back empty, the matrix has no criterion to probe'
    );
  }
  const programId = seed.programId;

  // ── Real logins, in the order the row descriptions above require ─────────
  const platformAdmin = fixture.personas.platformAdmin;
  const leadAuditor = fixture.personas.leadAuditor;
  const auditee = fixture.personas.auditee;
  const member = fixture.personas.member;
  const revokedMember = fixture.personas.revokedMember;
  const foreignTenant = fixture.personas.foreignTenant;

  const platformAdminToken = await loginOrThrow(platformAdmin.email, fixture.password);
  const leadAuditorToken = await loginOrThrow(leadAuditor.email, fixture.password);
  const auditeeToken = await loginOrThrow(auditee.email, fixture.password);
  const memberToken = await loginOrThrow(member.email, fixture.password);
  // Must log in WHILE still ACTIVE — a revoked account cannot authenticate at all.
  const revokedMemberToken = await loginOrThrow(revokedMember.email, fixture.password);
  const foreignTenantToken = await loginOrThrow(foreignTenant.email, fixture.password);

  const revokeDetail = await revokeMembership(revokedMember.userId, revokedMember.organizationId);

  // ── One shared control: the foreign tenant fetching the SAME program id ──
  const foreignCtx = await ctxFor(foreignTenantToken);
  const foreignRes = await foreignCtx.get(`/api/audits/programs/${programId}`);
  const foreignAttempt: ForeignAttemptOutcome = {
    endpoint: 'GET /api/audits/programs/:id (session: foreignTenant, different org)',
    status: foreignRes.status(),
  };
  await foreignCtx.dispose();

  async function scopedRead(token: string, note?: string): Promise<ScopedReadOutcome> {
    const ctx = await ctxFor(token);
    const res = await ctx.get(`/api/audits/programs/${programId}`);
    let count: number | null = null;
    if (res.status() === 200) {
      const body = (await res.json()) as { data?: { members?: unknown[] } };
      count = Array.isArray(body.data?.members) ? body.data!.members!.length : null;
    }
    await ctx.dispose();
    return {
      endpoint: 'GET /api/audits/programs/:id',
      status: res.status(),
      count,
      ...(note ? { note } : {}),
    };
  }

  // ── platformAdmin — role: program_owner (auto-assigned at program creation) ──
  // Allowed: grants leadAuditor its role. This IS the setup step for the next row.
  const grantLeadAuditor = await addProgramMember(
    platformAdminToken,
    programId,
    leadAuditor.userId,
    'lead_auditor'
  );
  const platformAdminAllowed: ProbeOutcome = {
    endpoint: 'POST /api/audits/programs/:id/members {memberRole: "lead_auditor"}',
    capability: 'program.manage_members',
    status: grantLeadAuditor.status,
    ok: ok(grantLeadAuditor.status),
  };

  // Also grant auditee its role now, using the same admin session (setup, not recorded).
  const grantAuditee = await addProgramMember(platformAdminToken, programId, auditee.userId, 'auditee');
  if (!ok(grantAuditee.status)) {
    throw new Error(`personaMatrix: could not grant auditee its role -> ${grantAuditee.status}`);
  }

  // Forbidden: program_owner has neither `criterion.perform_test` in
  // ROLE_CAPABILITIES nor in PLATFORM_ADMIN_CAPABILITIES.
  const paCtx = await ctxFor(platformAdminToken);
  const paForbiddenRes = await paCtx.post(`/api/audits/criteria/${criterionId}/test`, { data: {} });
  await paCtx.dispose();
  const platformAdminForbidden: ForbiddenOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/test',
    capability: 'criterion.perform_test',
    status: paForbiddenRes.status(),
    denied: paForbiddenRes.status() === 403,
  };

  const platformAdminEntry: PersonaMatrixEntry = {
    account: platformAdmin.email,
    auditRole: 'program_owner',
    allowed: platformAdminAllowed,
    forbidden: platformAdminForbidden,
    scopedRead: await scopedRead(platformAdminToken),
    foreignAttempt,
  };

  // ── leadAuditor — role: lead_auditor ──────────────────────────────────────
  const laCtx = await ctxFor(leadAuditorToken);
  const testRes = await laCtx.post(`/api/audits/criteria/${criterionId}/test`, {
    data: {
      procedurePerformed: 'G4 persona matrix — automated procedure probe',
      testResult: 'pass',
    },
  });
  const leadAuditorAllowed: ProbeOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/test',
    capability: 'criterion.perform_test',
    status: testRes.status(),
    ok: ok(testRes.status()),
  };

  // Draft a finding as leadAuditor (finding.draft — genuinely held), then try
  // to review its OWN finding — assertNotReviewingOwnFinding must fire.
  const draftRes = await laCtx.post('/api/audits/findings', {
    data: {
      programId,
      statement: 'G4 persona matrix — leadAuditor-authored finding for the SoD probe',
      classification: 'observation',
    },
  });
  let leadAuditorForbidden: ForbiddenOutcome;
  let leadFindingId: string | null = null;
  if (draftRes.status() === 201) {
    const draftBody = (await draftRes.json()) as { data?: { id?: string } };
    leadFindingId = draftBody.data?.id ?? null;
  }
  if (leadFindingId) {
    const reviewOwnRes = await laCtx.post(`/api/audits/findings/${leadFindingId}/review`, {
      data: { decision: 'confirm' },
    });
    leadAuditorForbidden = {
      endpoint: 'POST /api/audits/findings/:id/review (reviewing own drafted finding)',
      capability: 'finding.review (blocked by assertNotReviewingOwnFinding, a segregation-of-duties rule, not a missing capability)',
      status: reviewOwnRes.status(),
      denied: reviewOwnRes.status() === 403,
    };
  } else {
    leadAuditorForbidden = {
      endpoint: 'POST /api/audits/findings/:id/review (reviewing own drafted finding)',
      capability: 'finding.review (assertNotReviewingOwnFinding)',
      status: draftRes.status(),
      denied: false,
      note: `could not draft the setup finding (POST /api/audits/findings -> ${draftRes.status()}), so the self-review SoD probe was never attempted`,
    };
  }
  await laCtx.dispose();

  const leadAuditorEntry: PersonaMatrixEntry = {
    account: leadAuditor.email,
    auditRole: 'lead_auditor',
    allowed: leadAuditorAllowed,
    forbidden: leadAuditorForbidden,
    scopedRead: await scopedRead(leadAuditorToken),
    foreignAttempt,
  };

  // ── auditee — role: auditee ────────────────────────────────────────────
  const auCtx = await ctxFor(auditeeToken);
  const responseRes = await auCtx.post(`/api/audits/criteria/${criterionId}/auditee-response`, {
    data: { text: 'G4 persona matrix — auditee response probe' },
  });
  const auditeeAllowed: ProbeOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/auditee-response',
    capability: 'criterion.respond_as_auditee',
    status: responseRes.status(),
    ok: ok(responseRes.status()),
  };

  // `not_applicable` is a valid ConformityStatus so the request reaches
  // requireCapability instead of failing enum validation first.
  const concludeRes = await auCtx.post(`/api/audits/criteria/${criterionId}/conclude`, {
    data: { conformityStatus: 'not_applicable' },
  });
  const auditeeForbidden: ForbiddenOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/conclude',
    capability: 'criterion.conclude',
    status: concludeRes.status(),
    denied: concludeRes.status() === 403,
  };
  await auCtx.dispose();

  const auditeeEntry: PersonaMatrixEntry = {
    account: auditee.email,
    auditRole: 'auditee',
    allowed: auditeeAllowed,
    forbidden: auditeeForbidden,
    scopedRead: await scopedRead(auditeeToken),
    foreignAttempt,
  };

  // ── member — plain ACTIVE org member, NO audit-program role yet ─────────
  const meCtx = await ctxFor(memberToken);
  const createProgramRes = await meCtx.post('/api/audits/programs', {
    data: { packId: seed.packId, name: `G4 persona matrix — member self-serve probe ${fixture.runId}` },
  });
  const memberAllowed: ProbeOutcome = {
    endpoint: 'POST /api/audits/programs',
    capability: 'program.create (ORG_MEMBER_CAPABILITIES — granted to every org member, no audit role required)',
    status: createProgramRes.status(),
    ok: ok(createProgramRes.status()),
  };

  const memberTestRes = await meCtx.post(`/api/audits/criteria/${criterionId}/test`, { data: {} });
  const memberForbidden: ForbiddenOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/test',
    capability: 'criterion.perform_test',
    status: memberTestRes.status(),
    denied: memberTestRes.status() === 403,
    note: 'member holds no audit_program_members row on the seeded program at all — capabilities are ORG_MEMBER_CAPABILITIES only',
  };
  await meCtx.dispose();

  const memberEntry: PersonaMatrixEntry = {
    account: member.email,
    auditRole: null,
    allowed: memberAllowed,
    forbidden: memberForbidden,
    scopedRead: await scopedRead(memberToken),
    foreignAttempt,
  };

  // ── reviewer — the SAME `member` account, promoted after the row above ──
  const grantReviewer = await addProgramMember(platformAdminToken, programId, member.userId, 'reviewer');
  if (!ok(grantReviewer.status)) {
    throw new Error(`personaMatrix: could not promote member to reviewer -> ${grantReviewer.status}`);
  }

  const revCtx = await ctxFor(memberToken);
  let reviewerAllowed: ProbeOutcome;
  if (leadFindingId) {
    // Reviewing leadAuditor's finding (a DIFFERENT author) — the same
    // capability and rule as leadAuditor's forbidden row, opposite author,
    // must succeed.
    const reviewRes = await revCtx.post(`/api/audits/findings/${leadFindingId}/review`, {
      data: { decision: 'confirm' },
    });
    reviewerAllowed = {
      endpoint: 'POST /api/audits/findings/:id/review (reviewing a DIFFERENT author\'s finding)',
      capability: 'finding.review',
      status: reviewRes.status(),
      ok: ok(reviewRes.status()),
    };
  } else {
    reviewerAllowed = {
      endpoint: 'POST /api/audits/findings/:id/review',
      capability: 'finding.review',
      status: 0,
      ok: false,
      note: 'leadAuditor never produced a finding to review (see leadAuditor.forbidden.note) — nothing to probe',
    };
  }

  const reviewerDraftRes = await revCtx.post('/api/audits/findings', {
    data: {
      programId,
      statement: 'G4 persona matrix — should be rejected, reviewer lacks finding.draft',
      classification: 'observation',
    },
  });
  const reviewerForbidden: ForbiddenOutcome = {
    endpoint: 'POST /api/audits/findings',
    capability: 'finding.draft',
    status: reviewerDraftRes.status(),
    denied: reviewerDraftRes.status() === 403,
  };
  await revCtx.dispose();

  const reviewerEntry: PersonaMatrixEntry = {
    account: member.email,
    auditRole: 'reviewer',
    allowed: reviewerAllowed,
    forbidden: reviewerForbidden,
    scopedRead: await scopedRead(memberToken, 'same account as the `member` row, probed AFTER the reviewer role was granted'),
    foreignAttempt,
  };

  // ── revokedMember — pre-revocation token, membership withdrawn afterwards ─
  const rmCtx = await ctxFor(revokedMemberToken);
  const rmReadRes = await rmCtx.get(`/api/audits/programs/${programId}`);
  const revokedMemberAllowed: ProbeOutcome = {
    endpoint: 'GET /api/audits/programs/:id (the same read that returns 200 for the `member` row above)',
    capability: 'program.read',
    status: rmReadRes.status(),
    ok: false,
    note: `honestly not achievable: requireOrgAccess() on the /api/audits mount blocks every route once membership is revoked (${revokeDetail}), even ones that were open to any active member`,
  };

  const rmTestRes = await rmCtx.post(`/api/audits/criteria/${criterionId}/test`, { data: {} });
  const revokedMemberForbidden: ForbiddenOutcome = {
    endpoint: 'POST /api/audits/criteria/:id/test',
    capability: 'criterion.perform_test',
    status: rmTestRes.status(),
    denied: rmTestRes.status() === 403,
    note: 'denied by requireOrgAccess() (membership gate) before the request reaches requireCapability — a stronger denial than the capability matrix, not a weaker one',
  };
  await rmCtx.dispose();

  const revokedMemberEntry: PersonaMatrixEntry = {
    account: revokedMember.email,
    auditRole: null,
    allowed: revokedMemberAllowed,
    forbidden: revokedMemberForbidden,
    scopedRead: {
      endpoint: 'GET /api/audits/programs/:id',
      status: rmReadRes.status(),
      count: null,
      note: 'membership revoked — nothing is legitimately visible',
    },
    foreignAttempt,
  };

  return {
    platformAdmin: platformAdminEntry,
    leadAuditor: leadAuditorEntry,
    reviewer: reviewerEntry,
    auditee: auditeeEntry,
    member: memberEntry,
    revokedMember: revokedMemberEntry,
  };
}
