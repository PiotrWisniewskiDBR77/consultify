# Consultify closure — owner decisions and measurable gates

Status: `ACTIVE / FAIL_CLOSED_DEFAULTS`

Agents do not wait idly for a decision. They complete all provider/policy-
independent work, create the negative-control evidence and return the decision
packet. Until the named owner accepts or changes the recommendation, the listed
feature stays OFF/unavailable and the release task remains blocked.

## Decision register

| Decision/task | Accountable owner | Decision to record | Recommended/default state | Blocks |
| --- | --- | --- | --- | --- |
| `ASM-METHOD-CATALOG-001` | Product + Methodology/Rights | Approved method names, content, scoring and versions | DRD only; SIRI/ADMA/others hidden and fail-closed | non-DRD activation |
| `AUD-POL-001`, `AUD-MVP-RIGHTS-001` | Product + Methodology/Rights + Legal | Internal pack content/provenance and SoD roles | Internal transformation pack only; named external standards OFF; no self-approval | Audit full lifecycle release |
| `MAT-POL-001` | Product + Legal/Privacy + Procurement | One provider per DOCX/PPTX/XLSX, DPA, residency, SLA/cost and asset rights | Provider-independent editing ON; external export `UNAVAILABLE` until approved | provider export and production claim |
| `RES-MVP-VISIBILITY-001` | Product owner | Owner/Admin/Manager/Reader visibility and roll-up | OWNER/ADMIN only; Manager/Reader denied until matrix accepted | Results rollout |
| `FIN-MVP-RECONCILIATION-001` | Finance domain owner + Product | Dispute owner and allowed reconciliation transitions | Results Actual immutable; Finance creates proposal/dispute only | Finance↔Results closure |
| `MTG-POL-001` | Legal/Privacy + Product | Recording, consent, transcript retention, legal hold and regions | Recording OFF; no transcript persistence without opt-in; minutes remain | recording/transcript production |
| `SET-MVP-OAUTH-001` | Security/Privacy + Product | Approved providers, scopes, residency and revoke semantics | No provider enabled without registry approval | OAuth activation |
| `SET-MVP-DELETE-001` | Legal/Privacy | Retention minima/maxima, anonymize/delete, hold approval/release | Request/cancel allowed; destructive execution OFF | deletion production |
| `PRT-POL-001`, `PRT-MVP-ACCRUAL-001` | Commercial + Finance + Legal | Currency, rule, eligibility, attribution window, reversal/dispute/tax | One base currency; versioned accrual; manual payout request; no auto payout/KYC/tax | accrual/payout release |
| `REL-001-T01` | Piotr / release owner | Exact environment, release SHA and push/deploy authorization | No push/deploy/release | any production mutation |
| Human UI/VoiceOver | UX owner + named target-role reviewer | Visual/brand/accessibility acceptance | Automated proof may pass; status remains `BLOCKED_HUMAN` | `UI-CANON-ALL-001` |

Every accepted decision records: decision ID, selected option, owner, timestamp,
rationale, affected tasks, effective SHA and evidence invalidation. Silence never
changes a fail-closed default.

## Owner amendments accepted 2026-08-18

The following decisions were explicitly selected by Piotr, Product and release
owner, during the closure session on 2026-08-18. They authorize repository
implementation and exact-SHA verification only. They do not authorize push,
deployment or release.

| Decision ID | Selected option | Binding product decision | Affected tasks | Implementation and invalidation gate |
| --- | --- | --- | --- | --- |
| `AMD-FIN-VALUATION-V3-001` | `1A` | `financeValuationWorkspaceV1` becomes the default valuation workspace. | `FIN-MVP-CANDIDATE-001`, `FIN-UI-CANON-001`, `FIN-BVP-001` | Enable V3 by default, retain a fail-safe rollback flag, and prove the signed valuation preview → explicit confirm → cold candidate/receipt readback. Invalidate on route, flag default, valuation identity or candidate-handoff contract change. |
| `AMD-PRT-ECONOMICS-002` | `2A` | Partner commission, discount, accrual and payout operations excluded by policy are unavailable and hidden; attempts fail closed. | `PRT-POL-001`, `PRT-MVP-ACCRUAL-001`, `PRT-MVP-LEGACY-CUTOVER-001`, `PRT-UI-CANON-001` | Remove reachable excluded writers and UI affordances, preserve only explicitly governed non-economic Partner journeys and historical records required for audit. Prove zero writes and no fallback. Invalidate on any Partner economics route, flag or UI reactivation. |
| `AMD-MAT-PROVENANCE-WRITER-002` | `3B` | An authenticated same-tenant `OWNER` or `ADMIN` may approve template provenance only when source, license/rights basis, actor, version and durable evidence are all present. Unknown/incomplete provenance remains quarantined. | `MAT-POL-001`, `MAT-UI-CANON-001` | Implement a governed, audited, immutable approval command with tenant isolation, maker identity and complete evidence. This decision does not fabricate or attest rights for any existing template. Invalidate on approval roles, required provenance fields, rights semantics or audit immutability change. |
| `AMD-FLOW-ROI-VISIBILITY-002` | `4C` | ROI visibility is restricted to same-tenant `OWNER`, `ADMIN` and users holding the canonical Finance authority/grant; general `OPEN_ORG` is not an approved production policy. | `FLOW-TRANSFORM-MVP-001`, `FIN-MVP-RECONCILIATION-001`, `RES-UI-CANON-001` | Replace the synthetic `OPEN_ORG` prerequisite in release qualification with a governed role/capability policy, including foreign/revoked/ordinary-member denial and cold readback. Invalidate on visibility domains, role/capability mapping or Finance-grant semantics change. |

The effective implementation SHA for each amendment is recorded only after its
product and runtime gates pass on the integrated candidate. Until then, the
decision is `APPROVED_IMPLEMENTATION_REQUIRED`, not evidence of completion.

## Quantified proposed default gates

These values are testable recommendations, not a silently inferred business
decision. Agents use them for provisional engineering evidence, but every
release-facing claim remains `BLOCKED_OWNER` until the accountable owner
accepts them. An accepted or changed value is recorded in the decision
register before release qualification; agents may never tune a threshold to
observed results.

### Performance — `NFR-PERF-001`

- 30-minute steady test with 50 concurrent authenticated users in one tenant
  plus a concurrent second-tenant negative stream;
- non-AI API p95 ≤ 750 ms, p99 ≤ 1500 ms; write p95 ≤ 1200 ms;
- request error rate < 0.5%, zero cross-tenant response and zero false success;
- browser LCP p75 ≤ 2.5 s desktop and ≤ 4.0 s mobile, CLS ≤ 0.10,
  interaction p75 ≤ 200 ms for non-provider actions;
- process heap growth after warm-up < 20% and no monotonic last-10-minute trend;
- positive controls must breach and be detected.

Provider/LLM latency is reported separately and must have a bounded timeout,
cancel/retry state and no blocked local mutation.

### Observability — `OPS-OBS-001`

- 100% of cross-module writes carry correlation ID, tenant, actor, task/source
  ID and terminal result without secret payloads;
- alerts for write failure rate ≥ 1% over 5 minutes, queue/outbox oldest age ≥
  5 minutes, DB saturation ≥ 80% for 10 minutes and repeated auth denials;
- every alert links to an exercised runbook; one positive-control alert and one
  recovery acknowledgment are captured;
- internal-beta availability target 99.5%; no production claim until a later
  owner-approved SLO exists.

### Security/privacy — `SEC-PRIV-001`

- zero unaccepted reachable critical/high vulnerability;
- zero auth bypass, tenant escape, secret readback or executable unsandboxed
  user code in negative controls;
- SAML fails closed without a registered real verifier/certificate;
- provider/residency/retention decisions match the registry and logs redact
  secrets/content according to policy;
- every exception has owner, expiry, compensating control and regression test.

### Data recovery — `DATA-DR-001`

- internal-beta default RPO ≤ 15 minutes and RTO ≤ 60 minutes;
- encrypted backup, checksum, restore into isolated environment and tenant/
  owner readback;
- migration/backfill replay is idempotent and old code reads additive schema;
- one corrupted/incomplete backup positive control is rejected;
- destructive production restore remains separately authorized.

### Persona UAT — `PERSONA-UAT-001`

- Owner, Admin, Manager, Consultant, Member, respondent and partner each run
  named job stories with positive and forbidden actions;
- zero P0/P1 defect; P2 requires named owner disposition and target date;
- no technical UUID/enum, fake success, inaccessible control or cross-tenant
  visibility;
- evidence includes reviewer, role, tenant, product SHA, journey and result.

### UI aggregate — `UI-CANON-ALL-001`

- all 16 module inventories cover every mounted route/modal/drawer and
  default/loading/empty/error/permission/conflict/success state;
- 1440×900, 768×1024 and 390×844; light/dark; PL/EN;
- axe critical/serious = 0; full keyboard flow, visible focus and focus return;
- automated screenshot diff plus named human UX and manual VoiceOver verdict;
- no local design system/token fork.

### Demo/release — `REL-001-T01`

- server/client SHA, migration ledger, flags and governed data all match the
  frozen release SHA;
- 16 module golden flows and `FLOW-TRANSFORM-MVP-001` pass deployed desktop and
  mobile with cold reopen;
- two consecutive 60-minute telemetry windows meet the gates above;
- rollback to previous verified SHA/flags passes while additive schema remains
  readable;
- explicit release authorization is recorded after, not before, the evidence.
