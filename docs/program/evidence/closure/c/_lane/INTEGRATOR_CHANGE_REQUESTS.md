# Lane C — integrator change requests

Lane: Claude C · Branch: `codex/closure-claude-c-ideas-documents`
Baseline: `64f507859c717494ffa5e83fae550173c9382230`
Lease SHA-256: `7e9a27454b28907a1a5879fcb45051c3de4b0cb5be8092c3a8ed0c55b2fd756c`

Each item below is a defect Lane C reproduced but may NOT fix, because the file
is outside the lane lease and reserved for the Codex integrator. Per the
four-branch contract the worker continues other safe work and expresses the
need as a request rather than modifying the shared file.

---

## ICR-C-001 — server-side `betaGate` is a no-op while `MODULE_MEETING` is `closed`

**Task ID:** `MTG-BVP-001`
**Severity:** security / access-control. Reproduced, not theoretical.

**Exact files (both outside Lane C lease):**
- `server/src/middleware/betaGate.middleware.ts`
- `src/utils/betaAccess.ts` (SSOT, read-only reference)

**Reproduction / evidence:**
`src/utils/betaAccess.ts:53` declares `MODULE_MEETING: 'closed'`.
`server/src/middleware/betaGate.middleware.ts:15-17` is literally:

```ts
export function betaGate(req: Request, res: Response, next: NextFunction): void {
  next();
}
```

Its own docstring asserts *"All beta modules are currently 'open' in the
client-side betaAccess.ts SSOT"* — which is false of the current SSOT. It does
not import `betaAccess.ts`, never reads `MODULE_MEETING`, and cannot return
403. The comment at `server/src/routes/meeting.routes.ts:49-51` claiming the
gate "flips to 403 BETA_LOCKED when MODULE_MEETING is set 'closed'" is
therefore also false of the running code.

The repository's own realDB suite already encodes the true behaviour:
`tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts:160-169`
(GF-06) asserts `GET /api/meeting` returns **200** while `MODULE_MEETING` is
`'closed'`.

**Impact:** the Meeting HTTP API is reachable by any authenticated member of
any organization regardless of beta status. Only the *frontend* route enforces
closure (`src/routes/AppRoutes.tsx:2495`), and only for non-admins
(`BETA_ADMINS_EXEMPT = true`). This is the "flag with zero implementing code"
class the program doctrine calls out explicitly.

**Requested minimal change:** make `betaGate` read the module state from the
SSOT and return `403 BETA_LOCKED` for modules marked `closed`, preserving
`createBetaGate(skipPaths)` for public sub-paths (presentation share links)
which must stay reachable.

**Consumer tests that must be updated in the same change:** GF-06 above
currently asserts the *defective* behaviour (200) and will legitimately fail
once the gate works; it must be inverted to assert 403, or the Meeting module
flipped to `open` by an explicit owner decision. **Do not "fix" the gate
without deciding which of the two is intended** — that decision is the owner's,
not the integrator's.

**Ordering:** independent of Lane C's Meeting work. Lane C's Meeting changes
neither depend on nor conflict with it.

**Why Lane C did not compensate locally:** returning 403 from
`meeting.routes.ts` (which *is* leased) would have silently changed a
cross-cutting access policy from inside one module, diverging the server's real
behaviour from the shared SSOT and breaking other lanes' fixtures. That is a
policy decision expressed in a shared file, so it is filed here instead.

---

## ICR-C-002 — mandated G1 gate command dirties a file outside every lane lease

**Task ID:** lane-wide (affects A, B and C identically)
**Severity:** process defect. Reproduced.

**Exact file:** `docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json`
(outside all three Claude lane leases; generator
`scripts/testing/generate-test-inventory.ts`).

**Reproduction:** `EXECUTION_GATE_CATALOG_20260816.md` §G1 mandates
`npm run test:inventory:generate`. Running it rewrites the tracked file above.
The only delta is the timestamp — content is byte-identical:

```diff
-  "generatedAt": "2026-08-16T17:07:44.763Z",
+  "generatedAt": "2026-08-16T19:03:06.566Z",
   "totalDiscovered": 4997,
```

`node scripts/cleanup/verify-closure-lane.mjs c <baseline>` then reports:

```
lane C lease violation (1):
- docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json
```

So G0 (lease clean) and G1 (run the generator) are, as written, mutually
unsatisfiable for every lane.

**Lane C's handling:** ran the gate, captured the denominators
(4997 discovered / 4997 manifest / 4698 executed, `Discovery gate: PASS`),
then restored the single generated file with `git restore` to keep the lease
clean. No information was lost because the counts were identical.

**Requested change (integrator's choice):** either add this path to all three
lane leases as a permitted generated artifact, or make the generator
timestamp-stable / write outside the tracked tree, or state in the gate catalog
that this file is exempt from the lease check.

---

## ICR-C-003 — `verify-closure-lane.mjs` fails any NEW source/test file the moment it is staged or committed

**Task ID:** lane-wide (affects A, B and C identically)
**Severity:** blocking contract contradiction. Reproduced.

**Exact file:** `scripts/cleanup/verify-closure-lane.mjs` (outside all lane leases).

**The contradiction.** The four-branch contract simultaneously requires:
- new implementation/test files below the domain roots the verifier enforces;
- bounded commits with task IDs, independently cherry-pickable;
- a clean worktree at handoff;
- zero lease violations at G0.

Under the current verifier these cannot all hold. At `verify-closure-lane.mjs:63-67`:

```js
const violations = [...changed].filter((file) => {
  if (leased.has(file) || reservedMigration.test(file) || reservedEvidence.test(file)) return false;
  const isNew = !isTracked(file);
  return !(isNew && allowedNewRoots[lane].some((rootPattern) => rootPattern.test(file)));
});
```

`isTracked()` shells out to `git ls-files --error-unmatch`, which succeeds for a
**staged** path as well as a committed one. So the `allowedNewRoots` exemption
only applies while a file is untracked. Staging it — the unavoidable first step
of committing it — flips `isNew` to `false` and turns a permitted new file into
a violation. `changed` also includes `git diff --name-only <baseline>...HEAD`,
so the violation persists permanently after commit.

**Reproduction (verbatim, this lane):**

```
# with the two new spine files staged:
lane C lease violation (2):
- server/src/services/artifactHandoff/__tests__/handoffSpine.pg.test.ts
- server/src/services/artifactHandoff/handoffSpineService.ts

# identical tree, after `git restore --staged` on exactly those paths:
lane C lease PASS: 25 changed paths; manifest 7e9a27454b28907a1a5879fcb45051c3de4b0cb5be8092c3a8ed0c55b2fd756c
```

Nothing about the files changed between those two runs except their index state.

Note the asymmetry that confirms this is an oversight rather than intent:
`reservedMigration` and `reservedEvidence` are checked BEFORE the `isNew` test,
so new migrations and new evidence files stay legal once committed. Only new
source/test files — which the contract explicitly permits — do not.

**Second-order effect.** `scripts/testing/generate-test-inventory.ts` discovers
tests via `git ls-files`, so a new test is invisible to the G1 discovery gate
until it is staged. The two gates therefore pull in opposite directions: G1
counts the test only when staged, G0 passes only when it is not.

**Requested minimal change:** treat a path as exempt when it matches
`allowedNewRoots` regardless of index state — i.e. compare against the baseline
tree rather than the index, e.g. `const isNew = !isTrackedAt(baseline, file)`
(`git cat-file -e <baseline>:<file>`), so "new" means "new relative to the
sealed baseline" rather than "not yet staged". That preserves the real intent
(no edits to pre-existing non-leased files) while allowing lanes to commit.

**How Lane C handled it meanwhile:** work is committed as the contract
requires, and the G0 result is reported in BOTH states with the reason, rather
than leaving files uncommitted to manufacture a green gate. No file outside the
lane's domain roots was created.
