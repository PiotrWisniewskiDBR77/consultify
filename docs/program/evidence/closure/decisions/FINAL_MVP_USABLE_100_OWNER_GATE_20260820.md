# FINAL MVP_USABLE_100 OWNER GATE — 2026-08-20

## Canonical authority

- Product SHA qualified by the final 30-minute gate: `a97750b5d3c9f821f1b2f44b21611734b2876964`.
- Evidence commit: `aed08be71677613fcf9c3f6c8a31945f0974612e`.
- Closure reporter: 82 tasks, 50 `DONE_CURRENT_SHA`, 32 `PARTIAL`, 0 missing or invalid evidence records.
- The remaining `PARTIAL` records are not one homogeneous engineering backlog. They contain owner, provider, human-acceptance, environment and release boundaries described below.

## Proven current technical state

- Final `RELEASE_30M_50U` gate: PASS, 1,800,794 ms, 50 authenticated users.
- 111,400 requests, 0 errors; read p95 114.134 ms; write p95 200.421 ms.
- 8,950 expected command identities, 8,950 reconciled, 0 loss, 0 duplicates, 0 tenant false-successes.
- Five modules participated evenly: Case, My Work, Settings, Initiatives and Finance.
- Cold signed Web Vitals: PASS. Desktop p75 LCP 512 ms / CLS 0.000237 / INP 16 ms. Mobile p75 LCP 476 ms / CLS 0 / INP 16 ms.
- Exact product SHA and mounted SHA matched. Disposable workload database was dropped; private credentials were not retained.

## Decisions required from Piotr

### D1 — Product performance thresholds

Choose one:

- **A — ACCEPT for internal beta (recommended):** desktop LCP p75 <= 2.5 s, mobile LCP p75 <= 4.0 s, CLS <= 0.10, INP <= 200 ms.
- **B — REPLACE:** provide exact alternative thresholds; rerun is required if the acceptance contract changes.
- **C — DEFER:** keep `NFR-PERF-001` and release `PARTIAL`.

The measured candidate is comfortably inside option A. Acceptance records the product contract; it does not authorize deployment.

### D2 — Historical provider credentials

Choose one:

- **A — ROTATE/REVOKE through provider owners (recommended):** confirm each provider credential family is rotated or revoked, then separately decide whether Git history rewrite is authorized.
- **B — FORMAL RISK ACCEPTANCE:** name owner, expiry and compensating controls; current-tree secret scan remains green, but historical exposure remains recorded.
- **C — DEFER:** `SEC-PRIV-001` remains `BLOCKED_ROTATION_REQUIRED`; no release GO.

No credential value is reproduced in repository evidence. The safe inventory stores provider type, historical commit, path and SHA-256 only.

### D3 — Internal-beta product boundaries

Choose one:

- **A — ACCEPT CURRENT BOUNDARIES (recommended):** keep Meeting recording/transcription OFF; Settings external OAuth OFF; destructive account deletion worker OFF while request/cancel/status stays ON; Partner accrual/payout/economics OFF; Results visibility OWNER/ADMIN-only; Materials external providers unavailable without provenance/rights approval.
- **B — REOPEN named boundary:** identify the exact boundary and provide its versioned policy/contract. This creates a new implementation and qualification packet.
- **C — REJECT current beta scope:** release stays stopped.

These are already fail-closed approved-out/restricted decisions. Accepting A does not claim the excluded capabilities exist.

### D4 — Legacy and historical-data disposition

Choose one:

- **A — PRESERVE/QUARANTINE for internal beta (recommended):** keep remaining Results null-successor writers observed, not retired; keep historical Finance reconciliation rows quarantined; require usage/backfill/rollback evidence before any later retirement.
- **B — AUTHORIZE a named retirement/backfill packet:** provide the exact writer IDs/routes, usage window, backfill rule, rollback window and row-disposition rule.
- **C — REQUIRE full retirement before beta:** release remains stopped while missing canonical successors and historical dispositions are built.

No null-successor writer may be retired merely to improve the denominator.

### D5 — Dead/unmounted UI disposition

Choose one:

- **A — KEEP UNMOUNTED for beta (recommended):** retain code behind current flags or unreachable routes; create a post-beta deletion/connect inventory.
- **B — DELETE named surfaces:** provide exact component/route allowlist and rollback expectation.
- **C — CONNECT named surfaces:** provide intended navigation, role and canonical writer/read contract.

This decision covers the recorded Execution and Organization dead/unmounted surfaces. It must not be inferred from automated tests.

### D6 — Human acceptance

Choose one:

- **A — SCHEDULE pre-release owner UAT (recommended):** execute the existing 16-module runbook for named personas, keyboard/VoiceOver and visual/brand acceptance; record signer, date and exact deployed SHA.
- **B — ACCEPT automated evidence as sufficient for internal beta:** explicitly waive the remaining human UI gate for beta only.
- **C — DEFER:** `UI-CANON-ALL-001` and release remain `PARTIAL`.

### D7 — Deployment and rollback authority

This decision is valid only after D1-D6 have an acceptable disposition.

Choose one:

- **A — AUTHORIZE controlled internal-beta deployment:** name environment, exact candidate SHA, deploy owner and rollback owner. Execute migration preflight, deploy, 16 mounted flows, two 60-minute telemetry windows, alert exercise and rollback rehearsal.
- **B — AUTHORIZE staging-only rehearsal:** same exact-SHA gates, with no production traffic or production migration.
- **C — NOT AUTHORIZED (current state):** preserve repository readiness; do not push, deploy, migrate production or claim release.

## Recommended decision set

`D1=A, D2=A, D3=A, D4=A, D5=A, D6=A, then D7=B before D7=A`.

This sequence is reversible until production deployment. It preserves all currently approved-out capabilities, resolves the security owner dependency, obtains the missing human receipt and rehearses the release path before production authority is granted.

## GO / STOP conditions

GO for a staging rehearsal only when D1-D6 are recorded, historical credentials are confirmed rotated/revoked or formally accepted, canonical is clean, and the candidate SHA is frozen.

STOP on any SHA drift, migration-ledger mismatch, missing role/tenant denial, command loss/duplication, false success, unapproved provider dependency, missing rollback owner or unrecorded production authority.

Nothing in this packet itself grants deployment, production migration, history rewrite, provider contact or destructive data action authority.

## Owner decision recorded — 2026-08-20

Piotr accepted the recommended sequence with the instruction `działaj zgodnie z rekomendacjami`:

- `D1=A` — internal-beta Web Vitals thresholds accepted.
- `D2=A` — provider owners are authorized to rotate/revoke every credential family in the safe historical inventory. This records the decision and authorization; completion remains pending until provider-side receipts confirm rotation/revocation. Git history rewrite is not authorized by this decision.
- `D3=A` — the listed internal-beta approved-out/restricted boundaries remain fail-closed.
- `D4=A` — remaining legacy/historical rows and null-successor writers remain preserved or quarantined; no inferred retirement/backfill.
- `D5=A` — dead/unmounted surfaces remain unmounted for beta; no inferred deletion or connection.
- `D6=A` — pre-release owner UAT is authorized and must record named signer, date and exact deployed SHA.
- `D7=B` — a staging-only rehearsal is authorized. Production deployment, production traffic, production migration and production rollback remain `NOT_AUTHORIZED`.

The staging rehearsal may proceed only after provider-side D2 receipts are recorded and the existing GO conditions remain satisfied. A successful staging rehearsal does not automatically promote `D7` to option A.

## Superseding staging qualification — exact candidate `e6ca206c0035f653118d9aadbfddf61d452ab52e`

The authorized `D7=B` staging rehearsal is complete. This section supersedes only
the earlier pre-rehearsal technical counts; it does not change the recorded owner
decisions or grant production authority.

- Provider reconciliation closed the `D2` staging gate: current OpenAI, GCP and
  LinkedIn credentials do not match the historical inventory; the separately
  exposed FizzUp production Google Speech key was rotated, the replacement was
  proven by real STT/TTS, and the previous key was deleted. Optional Git history
  rewrite remains `NOT_AUTHORIZED`.
- Exact staging SHA, health and readiness: PASS for `e6ca206c0035f653118d9aadbfddf61d452ab52e`.
- Fresh managed rehearsal database, migration replay and drift checks: PASS.
- Deployed mounted business journeys: 16/16 before rollback and 16/16 after the
  exact candidate restore.
- `RELEASE_30M_50U`: PASS with 109,118 requests, zero errors, 8,782/8,782 command
  reconciliation, zero loss, zero duplicates and zero tenant false-successes.
- Two consecutive 60-minute staging observation windows: PASS; zero HTTP 5xx.
- Alert exercise: DETECTED, RECOVERED and ACKNOWLEDGED.
- Forward-only schema/application rollback: PASS through recovery SHA
  `3f8156ce0572529226883a85efb88e34f7002f2c`; RTO 352 seconds, observed data
  loss zero, sentinel preserved, recovery 16/16. Final e6ca restore also passed
  readiness, zero migration drift, sentinel readback and 16/16.
- Production was not touched.

### Decisions still required

- `D1=A` remains the accepted internal-beta performance contract. It does not
  need to be reaccepted for each candidate SHA unless the thresholds change.
- `D3=A`, `D4=A` and `D5=A` remain the accepted beta boundaries.
- `D6=B` was explicitly accepted by Piotr after the staging qualification:
  automated exact-candidate evidence is sufficient for internal beta. Manual
  named-persona, VoiceOver and visual/brand acceptance are waived for internal
  beta only and remain recommended before a wider production release.
- `D7=A` has not been granted. Production deploy, production migration, traffic
  switch and production rollback remain `NOT_AUTHORIZED`.

### D6 superseding owner decision — 2026-08-20

Piotr recorded: `Akceptuję automatyczne dowody zamiast human UAT dla internal beta`.

This supersedes the earlier `D6=A` scheduling choice with `D6=B` for the exact
staging candidate `e6ca206c0035f653118d9aadbfddf61d452ab52e`. It closes only the
human UI acceptance gate for internal beta. It does not waive task-specific
technical gaps, create missing Audit authority, authorize production, or change
any approved-out product boundary.
