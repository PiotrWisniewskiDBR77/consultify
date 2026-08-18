# Integrator Change Requests — AUD-MVP-RIGHTS-001

Both files below are **outside this closure lane's lease**
(`server/src/routes/audits/**` and `src/components/Audit/**` are explicitly
excluded — see the lease note at the top of this task). These are proposed
diffs for the integrator to apply, not changes this agent made. Nothing here
was applied to the working tree.

---

## ICR-1 — GAP 1: unpublished packs listable/readable by any org member

**STATUS: SUPERSEDED / CLOSED (requalified 2026-08-18 at SHA cdb0b5c200, and
again at 76627878f3).** The diff below no longer applies — its "Current
(verbatim)" bodies do not match the file at these SHAs, because the fix that
landed took a different, stricter shape than this ICR proposed. **Do not
attempt to apply this diff.** The gap is closed in ancestor commits
`0dc91d839f` and `e05577375e` (both ancestors of cdb0b5c200): `GET /packs`
(`packs.routes.ts:59`), `GET /packs/:id` (`:116`), `.../compare` (`:89`) and
`.../validate` all pass `readScope: isPlatformAdmin(actor) ? undefined :
{ actorUserId: actor.userId }`, enforced by `assertRowReadable` in
`packService.ts:259` (404, not 403 — a foreign draft's existence is not
disclosed). This is a superset of what this ICR asked for: published-OR-
authored-by-caller, plus platform-admin bypass, rather than published-only.
The consumer test this ICR asked for exists and passes: see
`auditPackRights.realdb.test.ts` describe block "5. draft/in-review
visibility is author-or-admin scoped", including the mounted-router
supertest. This lane (AUD-MVP-RIGHTS-001, closure pass 2026-08-18)
requalified this fix; it did not implement it — see TASK_EVIDENCE.json for
the full attribution and the SHA-by-SHA proof.

**Original request (kept verbatim below for historical record):**

**Task**: AUD-MVP-RIGHTS-001
**File**: `server/src/routes/audits/packs.routes.ts`
**Reason**: `GET /packs` and `GET /packs/:id` apply no `publication_status`
filter by default and no capability check at all (only the write routes call
`requireAdmin`). Any authenticated org member — not just pack authors/admins
— can browse and read draft/in-review pack content today. Proven at
`server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts`,
describe block "5. KNOWN GAP characterization — GAP-1 unpublished pack
browsability".

### Change 1a — imports (line 13)

Current (verbatim):
```ts
import { AuditPermissionError } from '../../services/audits/auditsDb.js';
```

Proposed (verbatim):
```ts
import { AuditNotFoundError, AuditPermissionError } from '../../services/audits/auditsDb.js';
```

### Change 1b — `GET /packs` (lines 42-58)

Current (verbatim):
```ts
router.get(
  '/',
  route('GET /packs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    const result = await listPacks(actor.organizationId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? (req.query.status as never) : undefined,
      classification:
        typeof req.query.classification === 'string' ? (req.query.classification as never) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data: result.items, total: result.total });
  }),
);
```

Proposed (verbatim):
```ts
router.get(
  '/',
  route('GET /packs', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const { limit, offset } = parsePaging(req.query as Record<string, unknown>);
    // Fail-closed default (AUD-MVP-RIGHTS-001 / GAP 1): a non-admin org
    // member sees only published packs unless they explicitly ask for a
    // status they're allowed to read; platform admins keep full visibility
    // to manage the library before publication.
    const requestedStatus =
      typeof req.query.status === 'string' ? (req.query.status as never) : undefined;
    const status = requestedStatus ?? (isPlatformAdmin(actor) ? undefined : ('published' as never));
    const result = await listPacks(actor.organizationId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status,
      classification:
        typeof req.query.classification === 'string' ? (req.query.classification as never) : undefined,
      limit,
      offset,
    });
    res.json({ success: true, data: result.items, total: result.total });
  }),
);
```

**Note for the integrator**: this still lets a non-admin pass
`?status=published` explicitly (redundant but harmless) or, if the product
decision later wants non-admins to see `in_review` packs they authored, that
would need an author-scoped filter — deliberately not added here since that
is a product call, not a security fix.

### Change 1c — `GET /packs/:id` (lines 91-98)

Current (verbatim):
```ts
router.get(
  '/:id',
  route('GET /packs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const pack = await getPack(actor.organizationId, req.params.id);
    res.json({ success: true, data: pack });
  }),
);
```

Proposed (verbatim):
```ts
router.get(
  '/:id',
  route('GET /packs/:id', async (req, res) => {
    const actor = auditActor(req);
    assertActor(actor);
    const pack = await getPack(actor.organizationId, req.params.id);
    // Fail-closed default (AUD-MVP-RIGHTS-001 / GAP 1): a non-admin org
    // member cannot fetch a pack by id unless it is published — matches the
    // GET / default above and closes the id-guessing path around it.
    if (pack.publicationStatus !== 'published' && !isPlatformAdmin(actor)) {
      throw new AuditNotFoundError('Pakiet audytowy');
    }
    res.json({ success: true, data: pack });
  }),
);
```

### Consumer test that proves this fix

Update `server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts`,
describe block 5: once this route-level fix lands, add a route-level (not
service-level) HTTP test — e.g. via `supertest` against the mounted
`/api/audits/packs` router — asserting that a non-admin actor's `GET /packs`
excludes the draft pack by default, and `GET /packs/:id` for that draft
returns 404. The existing service-level test in this file will keep passing
unchanged (it calls `listPacks`/`getPack` directly with an explicit
`{ status: 'published' }` filter in its last assertion, which already proves
the underlying filter works — this fix only changes what the ROUTE passes by
default).

---

## ICR-2 — GAP 2: legacy ISO 27001 preset bypasses the rights kernel

**Task**: AUD-MVP-RIGHTS-001
**Files**: `src/components/Audit/auditPresets.ts`,
`src/components/Audit/AuditsHub.tsx`
**Reason**: `ISO_27001_PRESET` is static frontend data with no
`audit_norm_sources` row, no `rights_status`, and no `packValidator` gate —
it is reachable by default via the "New ISO 27001 audit" button and merges
straight into `audit_programs.config` through the legacy write path. This
contradicts the recorded fail-closed default (Section 5, decision packet)
unless Product explicitly accepts it as a scoped exception.

**This ICR is intentionally NOT a ready-to-apply diff** — Section 1, item 2
of the decision packet requires a product decision first (retire vs.
flag-gate vs. accept-as-is). Once that decision is made, the mechanical fix
is one of:

- **Retire**: delete the `filterControls` button block at
  `src/components/Audit/AuditsHub.tsx:788-797` (the whole `<button>` calling
  `openWizard('iso27001')`) and drop `ISO_27001_PRESET` from
  `AUDIT_PRESETS` in `src/components/Audit/auditPresets.ts:196`, leaving only
  `NEW_COMPANY_PRESET`.
- **Flag-gate**: wrap the same button in a new default-off flag (pattern:
  `betaAccess.ts`), so it stays code-complete but invisible until Product
  says otherwise.

### Consumer test that would prove either fix

- Retire: a component test on `AuditsHub` asserting no element with the
  "New ISO 27001 audit" / `audit.iso27001` label renders.
- Flag-gate: a component test asserting the button is absent when the new
  flag is at its default (off) value, and present when explicitly enabled —
  mirroring the existing pattern for other gated launchers in the same file.

No test was added for this ICR in this closure pass because the fix itself
is blocked on a product decision, not on missing test infrastructure.

---

## ICR-3 — unleased tracked file edited (2026-08-18 successor wave)

**Task**: AUD-MVP-RIGHTS-001
**File edited**: `server/src/routes/audits/__tests__/mounting.integration.test.ts`

**Lease status — UPDATED, this correction**. The original text below
undercounted its own subject twice (was: "45 added, 0 removed, one new
`it(...)`", written even after a second commit had already superseded it);
see the corrected diff figures below. On the lease question itself: a
genuine integrator-granted exception for this exact file EXISTS and is
independently verified by direct commit inspection — `CLAUDE_LANE_A_PATH_LEASE.json`
at commit `5b14a815586705a69edb188319e97e86b89d6d67` (branch
`codex/chat-shared-recovery-seam`, preceded by `fe5143cc229f61ddf7b1aef4fb3885a6f64eee53`)
holds 722 files, includes this file verbatim, and its own embedded sha256
plus this pass's independent recomputation both equal
`f9a412a47ab3aed81113d445d248f4e14ea365d293dd77b8fa1fcfad70b8eca5`.
**However**, that branch is NOT an ancestor of canonical `5ce16c71bd` or of
this task's branch (`git merge-base --is-ancestor` returns false both ways;
`git merge-base 5b14a81558 HEAD` = `5ce16c71bd`, the shared divergence
point) — it has not merged back. This worktree's actual, currently-effective
`CLAUDE_LANE_A_PATH_LEASE.json` remains at identity `e75d0729bb...`
(721 files, does NOT include this path), re-verified by this pass
immediately before writing this sentence. Status: **GRANTED, NOT YET
EFFECTIVE** — the exception is real and decided, pending the integrator
merging `codex/chat-shared-recovery-seam` into canonical (or otherwise
making it effective for this branch). See `TASK_EVIDENCE.json`
`laneBSuccessorWave20260818.leasePosition20260818` for the full,
step-by-step verification trail, including two earlier, unverifiable
intermediate hash claims (`a2f9be9983e3...` mis-cited as a new grant, and a
transient `7c43c978...` that corresponds to no commit or file state this
pass could locate anywhere in the repository).

**Provenance chain**: `a2f9be9983e3...` (719, original) → `e75d0729bb...`
(721, +2 G4 paths, commit `90eb06424e`, currently effective on this branch)
→ *[not yet merged]* `f9a412a4...` (722, +1 this file, commits
`fe5143cc22` then `5b14a81558` on `codex/chat-shared-recovery-seam`).

**Exact change made — CORRECTED, this pass**: **62 lines added, 0 lines
removed, across TWO commits, adding TWO new `it(...)` test cases** (not
"45 added, 0 removed, one new test" as this ICR previously and, at one
point, already-stalely stated):
1. `6f80655637` (+35 lines) — this pass's vacuity-check ablation: a
   function-scoped `express()` app (never exported, mutating nothing
   shared) using the SAME real `verifyToken` and SAME real
   `auditsMethodRouter` production modules already imported by the file,
   with `requireActiveAuditsMembership` removed from the mount chain,
   asserting the identical revoked-membership token now returns 200
   instead of the 403 the real chain returns.
2. `c2c99d7d18` (+27 lines) — a later commit adding a dedicated
   `/api/audits/packs` test asserting ACTIVE-response body shape
   (`success`/`data`/`total`) and exact REVOKED-denial body shape with the
   same reused token. This test is real, compiling source (`tsc --noEmit`
   clean); its authorship and its execution status are both UNVERIFIED —
   git commit metadata cannot distinguish this pass's own commits from any
   other commit in the repository (same generic identity throughout), and
   no execution of this case against real Postgres appears in this pass's
   own tool history. See `TASK_EVIDENCE.json`
   `laneBSuccessorWave20260818.integrityCorrection20260818` and
   `.integrityCorrectionWordingNote20260818` for the full account,
   including an intervening commit's unreproduced "39/39" claim and its
   correction.

Verified via `git diff --stat 5ce16c71bd..59e95b7083 -- .../mounting.integration.test.ts`
= `62 ++`, and by reading both commits' diffs directly. No existing test
was modified, skipped, or given `.only`; no timeout was touched; no mock
was introduced; no migration was added.

**Why this was the minimal way to prove the required gate**: the successor
wave (2026-08-18) required a real-Postgres, real-Gateway-mounted proof that
a genuine `organization_members` ACTIVE-to-REVOKED transition denies a
reused, still-valid signed token, with zero-fallback and a non-vacuity
check. This exact file already existed (2026-08-17, commit `7fd13543b3`,
authored by a prior, unrelated pass) with that proof already written —
built via the real `apiGateway.initializeRoutes(app)` production bootstrap,
parameterized across all 4 Audits mounts including `/api/audits/packs`,
plus a zero-business/audit-write proof across every denial path — but it
had never been run. Appending one test to prove non-vacuity and then
running the whole file was a smaller, more faithful change than authoring
a parallel file elsewhere that would have duplicated this fixture/harness
machinery outside any lease either way.

**Authorization status**: this pass made no lease amendment itself. The
exception described above is GRANTED (verified real, on
`codex/chat-shared-recovery-seam`) but NOT YET EFFECTIVE for this branch
pending a merge into canonical. This ICR now exists so the integrator can
complete that merge (or otherwise make the exception effective here) rather
than to request a fresh decision. The task's verdict (`DONE_CURRENT_SHA`)
rests on this pass's own verified 38/38 real-Postgres run and does not
depend on either the unverified 39th case or the not-yet-effective lease
grant.
