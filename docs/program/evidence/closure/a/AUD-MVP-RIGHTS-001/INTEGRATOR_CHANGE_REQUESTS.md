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
