/**
 * UI-CANON G4 — the four Audits API mounts against five kinds of caller.
 *
 * The revoke check is deliberately **immediate**. The Audits mounts run
 * `requireActiveAuditsMembership`, which reads `organization_members` on every
 * request and consults no cache, so the sequence here is: prime the general
 * middleware's positive cache with a real successful request, revoke, then send
 * the *very next* request with the same token and require 403. There is no
 * sleep: waiting out a cache would prove the delay exists, not that it is gone.
 *
 * The write probe uses a genuinely valid `packId`, so a permitted caller would
 * get a 201. A 403 therefore means refused, never "the route 404'd anyway".
 *
 * Real HTTP only — no interception, no minted tokens, no SQL writes.
 */

import { request as apiRequest } from '@playwright/test';

export interface MountProbe {
  mount: string;
  method: 'GET' | 'POST';
  path: string;
  status: number;
}

export interface MountMatrixRow {
  caller: string;
  probes: MountProbe[];
  allDenied: boolean;
}

export interface MountMatrixResult {
  rows: MountMatrixRow[];
  revokedSideEffects: {
    auditProgramsBefore: number;
    auditProgramsAfter: number;
    mutated: boolean;
    telemetryRowsForRevokedUser: number;
    telemetryRowsTotalIncludingRefusals: number;
    telemetryNote: string;
  };
  immediateRevoke: {
    primedWith: number[];
    firstRequestAfterRevoke: number[];
    sleptSeconds: 0;
    note: string;
  };
}

/**
 * One representative endpoint per production Audits mount. The write carries a
 * real published pack id so that a permitted caller would actually create a
 * program — which is what makes the denial meaningful.
 */
function mountsFor(validPackId: string) {
  return [
    { mount: '/api/audits (method kernel)', method: 'GET' as const, path: '/api/audits/programs' },
    {
      mount: '/api/audits (write)',
      method: 'POST' as const,
      path: '/api/audits/programs',
      body: { packId: validPackId, name: 'g4-mount-matrix-denial-probe' },
    },
    { mount: '/api/audit (orchestrator)', method: 'GET' as const, path: '/api/audit/programs' },
    { mount: '/api/audit (events)', method: 'GET' as const, path: '/api/audit/events' },
  ];
}

async function probeAll(
  token: string | null,
  apiBase: string,
  MOUNTS: ReturnType<typeof mountsFor>
): Promise<MountProbe[]> {
  const ctx = await apiRequest.newContext({
    baseURL: apiBase,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const out: MountProbe[] = [];
  for (const m of MOUNTS) {
    const res =
      m.method === 'GET' ? await ctx.get(m.path) : await ctx.post(m.path, { data: m.body });
    out.push({ mount: m.mount, method: m.method, path: m.path, status: res.status() });
  }
  await ctx.dispose();
  return out;
}

export async function runMountMatrix(opts: {
  apiBase: string;
  supportKey: string;
  activeToken: string;
  foreignToken: string;
  /** Obtained while the persona was still ACTIVE. */
  staleToken: string;
  revokedUserId: string;
  revokedOrganizationId: string;
  primaryOrganizationId: string;
  /** A real published pack, so the write probe is a genuine create attempt. */
  validPackId: string;
}): Promise<MountMatrixResult> {
  const MOUNTS = mountsFor(opts.validPackId);
  const support = await apiRequest.newContext({
    baseURL: opts.apiBase,
    extraHTTPHeaders: { 'x-test-support-key': opts.supportKey },
  });

  const countPrograms = async () => {
    const res = await support.post('/api/test-support/fixture-residue', {
      data: { organizationIds: [opts.primaryOrganizationId] },
    });
    const body = (await res.json()) as { counts?: Record<string, number> };
    return body.counts?.audit_programs ?? -1;
  };

  // 1. Prime the general middleware's positive membership cache with real
  //    successful requests made while the persona is still ACTIVE. The write
  //    probe carries a valid pack, so this step legitimately creates a program —
  //    which is exactly what proves the same call would have succeeded if the
  //    caller had still been a member.
  const primedWith = (await probeAll(opts.staleToken, opts.apiBase, MOUNTS)).map((p) => p.status);

  // Count AFTER priming: the baseline for "did the refused caller change
  // anything" must exclude the deliberate, permitted write above.
  const auditProgramsBefore = await countPrograms();

  // 2. Revoke. The marker comes back from the database's own clock, because
  //    api_logs.created_at is a local-time column and a client UTC timestamp
  //    would be offset by the timezone.
  const revokeRes = await support.post('/api/test-support/revoke-membership', {
    data: {
      userId: opts.revokedUserId,
      organizationId: opts.revokedOrganizationId,
      status: 'REVOKED',
    },
  });
  const revokedAt = ((await revokeRes.json()) as { marker?: string }).marker ?? null;

  // 3. The very next request — no sleep, cache deliberately still warm.
  const rows: MountMatrixRow[] = [];
  const revokedProbes = await probeAll(opts.staleToken, opts.apiBase, MOUNTS);
  const firstRequestAfterRevoke = revokedProbes.map((p) => p.status);

  // Measured here, before any other caller runs: the permitted callers below
  // legitimately create programs, so counting after them would attribute their
  // writes to the refused one.
  const auditProgramsAfter = await countPrograms();

  const activeProbes = await probeAll(opts.activeToken, opts.apiBase, MOUNTS);
  const foreignProbes = await probeAll(opts.foreignToken, opts.apiBase, MOUNTS);
  const anonymousProbes = await probeAll(null, opts.apiBase, MOUNTS);
  const invalidProbes = await probeAll('not-a-real-token.at.all', opts.apiBase, MOUNTS);

  const denied = (ps: MountProbe[]) => ps.every((p) => p.status === 401 || p.status === 403);
  // A foreign tenant is NOT denied and must not be: it is a legitimate active
  // member of its own organization, so a list read correctly succeeds and simply
  // returns its own (empty) scope. The contract it has to satisfy is isolation —
  // zero rows belonging to the primary tenant, and 404 when addressing the
  // primary tenant's program directly — which the persona matrix asserts.
  // Treating its 200 as a failure was a bad expectation, not a product defect.
  rows.push({ caller: 'activeMember', probes: activeProbes, allDenied: false });
  rows.push({
    caller: 'cachedActiveThenRevoked',
    probes: revokedProbes,
    allDenied: denied(revokedProbes),
  });
  rows.push({ caller: 'foreignTenant', probes: foreignProbes, allDenied: false });
  rows.push({ caller: 'anonymous', probes: anonymousProbes, allDenied: denied(anonymousProbes) });
  rows.push({ caller: 'invalidToken', probes: invalidProbes, allDenied: denied(invalidProbes) });

  // Did the refused write leave any trace attributable to the revoked user?
  const telemetry = await support.post('/api/test-support/telemetry-count', {
    data: { userId: opts.revokedUserId, pathPrefix: '/api/audit', since: revokedAt },
  });
  // `succeeded` is the number that must be zero: access logging deliberately
  // records the refused requests too, and that is correct security logging.
  const telemetryBody = telemetry.ok()
    ? ((await telemetry.json()) as { count?: number; total?: number; succeeded?: number })
    : { count: -1, total: -1, succeeded: -1 };
  await support.dispose();

  return {
    rows,
    revokedSideEffects: {
      auditProgramsBefore,
      auditProgramsAfter,
      mutated: auditProgramsAfter !== auditProgramsBefore,
      telemetryRowsForRevokedUser: telemetryBody.succeeded ?? -1,
      telemetryRowsTotalIncludingRefusals: telemetryBody.total ?? -1,
      telemetryNote:
        'counted only from the revoke instant onwards; succeeded must be 0, while the total is non-zero on purpose because access logging runs before authentication and records the refusals themselves',
    },
    immediateRevoke: {
      primedWith,
      firstRequestAfterRevoke,
      sleptSeconds: 0,
      note: 'the positive membership cache was primed by the successful requests above and deliberately left warm; requireActiveAuditsMembership re-reads organization_members per request, so the very next call is refused',
    },
  };
}
