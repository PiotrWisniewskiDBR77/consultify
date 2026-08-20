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
