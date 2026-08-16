# ASM-METHOD-CATALOG-001 — Assessment Method Catalog: Decision Packet

Status: **implemented (server fail-closed), owner decision still open for
any expansion beyond DRD.**

## 1. The decision to be made

Which assessment methodologies (DRD, SIRI, ADMA, CMMI, LEAN, and any future
addition) are the organization allowed to offer customers as a selectable,
creatable assessment type in Consultify V8?

This is a **content/rights/methodology** decision, not an engineering one:
SIRI, ADMA and CMMI are third-party frameworks with named external owners
(Singapore EDB/TÜV SÜD for SIRI, European Commission Digital Innovation Hubs
for ADMA, ISACA for CMMI — see `src/services/frameworkRegistry.ts` disclaimer
strings at lines 99, 137, 166). Whether Consultify's implementation of each
has cleared provenance/usage-rights review, and whether it is
methodologically complete enough to sell against, is outside engineering's
authority to decide.

## 2. Accountable owner

**Product owner + Methodology/Rights owner, jointly.** Engineering
(this closure task) enforces whatever the owner decides; it does not decide
which methods are approved.

## 3. Options

| Option | Description | Consequence |
|---|---|---|
| A — DRD only (recorded default) | Only DRD is selectable/creatable anywhere in the product. SIRI/ADMA/CMMI/LEAN code stays in the repo (routes, editors, `frameworkRegistry.ts` entries) but is unreachable. | Zero rights/provenance exposure. No product capability lost vs. today's *actual* state (SIRI/ADMA were only ever gated by a disabled client button, not a real engine — see §5). |
| B — Expand catalog to N methods | Owner explicitly reviews and approves specific non-DRD methods (e.g. SIRI first, since it already has full `frameworkRegistry.ts` content + a disclaimer). | Requires a rights/provenance sign-off per method before any code change; each approved method must be added to `GOVERNED_ASSESSMENT_TYPES` (see §6) individually, not as a batch. |
| C — Remove SIRI/ADMA/CMMI/LEAN code entirely | Delete the unreachable code paths instead of just gating them. | Explicitly out of scope for this task per the owner's framing ("Removal is a different, larger decision") — not implemented here. |

## 4. Recommended default (implemented)

**Option A — DRD only, fail-closed.** This is what ships with this task.
Nothing else is auto-approved. SIRI/ADMA/CMMI/LEAN remain **BLOCKED** until
the owner explicitly moves a specific method to Option B.

## 5. What was true before this task (verified in code, not assumed)

- The server (`POST /api/v8/assessment`) accepted `SIRI`/`ADMA`/`CMMI`/`LEAN`
  with **no fail-closed check at all** — only the client's
  `AssessmentLibraryTab.tsx` `METHODOLOGY_CATALOG` (`supported: false` for
  everything but DRD) prevented a normal user from picking one, and that is
  a disabled button, not an authorization boundary. Any direct API call
  (curl, a different client, a future UI regression) could create a live
  SIRI/ADMA/CMMI/LEAN assessment today.
- `src/services/frameworkRegistry.ts` independently disagrees with the
  client Library catalog: it marks **CMMI and LEAN** `coming_soon`
  (blocked in that surface's own picker) but leaves **SIRI and ADMA**
  defaulting to `available` (`FrameworkStatus` default when `status` is
  omitted — see `frameworkRegistry.ts:261`). So two client surfaces already
  disagreed with each other about which non-DRD methods are "available"
  before this task touched anything.
- There is no seed/migration that ever populates `assessment_definitions`
  for SIRI/ADMA/CMMI/LEAN, and `method_packs` (the other, unrelated catalog
  table — being bootstrapped by a different concurrent closure task, not
  this one) is only ever written by test fixtures. Neither backing store
  currently has real non-DRD content in any deployed environment.

## 6. What now enforces the DRD-only default (exact code locations)

Single governed constant, one file, one definition:

- `server/src/routes/v8/assessment.routes.ts:95` —
  `const GOVERNED_ASSESSMENT_TYPES = new Set(['DRD']);`
  (comment at lines ~86–95 names this file as the governed owner and points
  back to this decision packet). No second hardcoded type list exists
  anywhere else in this file.

Enforcement points, all keyed off that one constant:

- `server/src/routes/v8/assessment.routes.ts` — `POST /` (assessment
  create): denies any `assessmentType` not in `GOVERNED_ASSESSMENT_TYPES`
  with `403 ASSESSMENT_METHOD_NOT_ENABLED`, **before** any DB write.
- `server/src/routes/v8/assessment.routes.ts` — `GET /definitions/:methodologyId`
  (definitions catalog read): denies the same way for a non-governed
  `methodologyId`, so the read path cannot show a catalog the write path
  would refuse to create against.
- `server/src/routes/v8/assessment.routes.ts` — `POST /definitions/:methodologyId/draft`
  (admin-only definition authoring): denies drafting a definition for a
  non-governed methodology, so a SIRI/ADMA/CMMI/LEAN definition can never
  be authored in the first place.
- `server/src/routes/v8/assessment.routes.ts` — `POST /definitions/:definitionId/publish`
  (admin-only publish): defense in depth — refuses to publish ANY existing
  definition whose `methodologyId` is not governed, even one that predates
  this fix (e.g. seeded directly into the DB).

Denial response shape (all four points, via the shared
`buildMethodNotEnabledDenied()` helper):

```json
{
  "error": "Assessment methodology is not enabled",
  "code": "ASSESSMENT_METHOD_NOT_ENABLED",
  "assessmentType": "SIRI",
  "allowedTypes": ["DRD"],
  "whatNext": ["...", "..."]
}
```

Fail-closed property: the check is `if (!GOVERNED_ASSESSMENT_TYPES.has(type))`
— there is exactly one branch, so a disabled-but-recognized type (SIRI) and
an unrecognized/garbage type are refused by the identical code path. There
is no separate "unknown type" fallthrough that could default to allow.

## 7. What stays blocked until an owner accepts

SIRI, ADMA, CMMI, LEAN — and any future methodology — stay unreachable on
create, definitions-read, draft, and publish until a named Product +
Methodology/Rights owner records an explicit decision (per §3, Option B) to
add that specific method's identifier to `GOVERNED_ASSESSMENT_TYPES`. The
existing SIRI/ADMA/CMMI/LEAN editors, `frameworkRegistry.ts` entries, and
route branches for reading *already-persisted* non-DRD assessments (there
are none in any real environment today — see §5) are left in place;
removing that code is explicitly out of scope (§3, Option C).

## 8. Evidence the denial is real (not just code review)

Real PostgreSQL integration test suite:
`server/src/routes/v8/__tests__/assessmentMethodCatalog.pg.test.ts`
(7 tests, run against `postgresql://consultinity:consultinity@127.0.0.1:34913/consultinity`
with `RUN_DB_TESTS=1 MOCK_DB=false CI=true`):

1. Positive control — DRD create still returns `201` and a real row is
   persisted (`SELECT` by id confirms `assessment_type = 'DRD'`).
2. SIRI create → `403 ASSESSMENT_METHOD_NOT_ENABLED` (not `404`, ruling out
   a V8-feature-gate false negative).
3. ADMA create → `403 ASSESSMENT_METHOD_NOT_ENABLED`.
4. Garbage type (`TOTALLY_MADE_UP_METHOD_XYZ`) → `403
   ASSESSMENT_METHOD_NOT_ENABLED` via the same branch as SIRI/ADMA — proves
   fail-closed, not an allowlist-of-known-bad-types.
5. CMMI and LEAN refusals leave `SELECT count(*) FROM assessments` for the
   org unchanged — a refusal that still wrote a row would fail this test.
6. Tenant negative — two distinct organizations both get the identical
   denial on create and on `GET /definitions/SIRI`; a DRD assessment
   created under org A returns `404 ASSESSMENT_NOT_FOUND` when read under
   org B's context.
7. Cold readback — after a successful DRD create, a fresh, independent
   `SELECT` (not reusing the response body) still returns exactly one row
   of the expected type.

Full command and literal results are in the implementing agent's closure
report for ASM-METHOD-CATALOG-001.
