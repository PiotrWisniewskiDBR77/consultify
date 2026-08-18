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
| `AMD-ASM-METHOD-CATALOG-002` | `5B` | DRD remains the production-ready method. SIRI, ADMA, CMMI and other named methods may be visible only as explicitly experimental/incomplete catalog entries; they must not claim complete licensed content, certified assessment, production scoring readiness or rights that are not evidenced. | `ASM-UI-CANON-001`, `AUD-MVP-RIGHTS-001`, `UI-CANON-ALL-001` | Provide unmistakable experimental labelling at every entry and execution surface, fail closed before unsupported scoring/report generation, preserve provenance/version/rights status, and prove that no experimental method can be mistaken for a completed certified assessment. Invalidate on catalog visibility, method status, scoring, provenance/rights or report wording change. |
| `AMD-AUD-INTERNAL-PACK-002` | `6A` | The MVP offers only the internal Transformation Audit Pack. ISO, SOC 2, NIST and other named external standards are not offered as ready, certified or rights-complete audits. | `AUD-POL-001`, `AUD-MVP-RIGHTS-001`, `UI-CANON-ALL-001` | Default-OFF and make inaccessible every external-standard preset or bypass; retain provenance and historical audit records where required. Prove the internal pack lifecycle, separation of duties and denial of external-standard activation. Invalidate on audit catalog, rights kernel, preset visibility, approval roles or external-standard wording change. |
| `AMD-SET-OAUTH-APPROVED-OUT-002` | `7A` | External OAuth login is excluded from the MVP. Standard Consultify authentication remains; every external provider stays OFF/APPROVED_OUT and fails closed. | `SET-MVP-OAUTH-001`, `SET-UI-CANON-001`, `SET-BVP-001` | Remove or hide reachable provider activation/login affordances, reject direct provider entry points without state mutation, preserve standard login/revoke/error behaviour, and retain an explicit reopen condition requiring provider registry, scopes, residency and revoke approval. Invalidate on provider registry, OAuth route, login UI, callback or revoke semantics change. |
| `AMD-PERSONA-UAT-REVIEWER-002` | `8A` | Piotr is the accountable reviewer for all seven required personas. Acceptance still requires seven independent, role-specific journey records and verdicts; one blanket sign-off is not sufficient. | `PERSONA-UAT-001`, `UI-CANON-ALL-001`, `REL-001-T01` | Run Owner, Admin, Manager, Consultant, Member, respondent and partner journeys separately on one frozen exact SHA, recording role, tenant, actions, forbidden controls, result and defects for each. Invalidate on product SHA, persona permissions, mounted route, test data or journey definition change. |
| `AMD-SET-DELETE-APPROVED-OUT-002` | `9A` | The MVP may accept and cancel a deletion request and provide a portable export, but automated destructive deletion remains OFF. No erasure executes until retention, legal-hold and release rules are separately approved. | `SET-MVP-DELETE-001`, `SEC-PRIV-001`, `DATA-DR-001` | Keep request/cancel/status and export transparent and tenant-authorized; hide or disable destructive execution, reject direct execution attempts before mutation, preserve immutable request/audit evidence, and retain an explicit reopen condition for approved retention and legal-hold policy. Invalidate on delete/anonymize worker, retention, hold, request state or destructive route change. |
| `AMD-FIN-RECONCILIATION-SOD-002` | `10A` | Results Actual remains immutable. A same-tenant Finance `OWNER` or `ADMIN` may create a reconciliation proposal or dispute, but a different qualified `OWNER` or `ADMIN` must approve, reject or resolve it. Self-approval and self-resolution are forbidden. | `FIN-MVP-RECONCILIATION-001`, `FLOW-TRANSFORM-MVP-001`, `FIN-BVP-001` | Enforce maker-checker identity and current membership/capability at proposal and resolution time, preserve the original Actual, append immutable reconciliation events/receipts, and prove stale/concurrent/foreign/revoked/self cases fail closed. Invalidate on Actual immutability, Finance authority, reconciliation transitions or separation-of-duties change. |
| `AMD-RES-VISIBILITY-MATRIX-002` | `11A` | Full Results and organization roll-ups are visible only to same-tenant `OWNER` and `ADMIN`. Manager, Member and Reader identities see only objects explicitly assigned or shared with them; absence of a grant denies by default. | `RES-UI-CANON-001`, `RES-MVP-LEGACY-CUTOVER-001`, `FLOW-TRANSFORM-MVP-001`, `UI-CANON-ALL-001` | Apply one canonical visibility projection to list, detail, export and cold readback; prove explicit assignment success and unassigned/foreign/revoked/body-spoof denial with no metadata/count leak. Invalidate on role mapping, assignment/share semantics, roll-up, export or Results query change. |
| `AMD-ADM-BACKUP-INTERNAL-BETA-002` | `12A` | Internal beta requires an encrypted backup at least every 15 minutes and a manually verified restore into an isolated database. This does not claim production DR, external KMS, durable S3/R2 storage or an authorized production restore. | `ADM-MVP-BACKUP-001`, `DATA-DR-001`, `REL-001-T01` | Prove encrypted backup, checksum, schedule, fail-closed missing key, isolated restore with tenant/owner readback and corrupt-backup rejection; label external KMS/object-store/deployed schedule/production restore as unverified reopen gates. Invalidate on backup format, encryption/key source, schedule, storage, restore or migration compatibility change. |
| `AMD-NFR-PERFORMANCE-GATE-002` | `13A` | Technical completion requires a 30-minute performance run with 50 concurrent authenticated users. Read p95 must be at most 1.5 s, write p95 at most 2.5 s, request errors below 1%, with zero data loss and zero duplicate writes. Any breach blocks technical `DONE`. | `NFR-PERF-001`, `UI-CANON-ALL-001`, `REL-001-T01` | Exercise representative read/write journeys plus tenant-negative traffic on one frozen SHA; persist latency/error denominators and exact write identities, and include positive controls for loss/duplication detection. This accepted gate supersedes the unaccepted provisional latency/error thresholds below for technical completion. Invalidate on workload mix, concurrency, measurement method, write identity, runtime topology or performance-critical route change. |
| `AMD-TEST-DB-CONCURRENCY-002` | `14A` | Closure work may use at most two concurrent PostgreSQL containers when they are completely isolated. A shared database is forbidden. | All repository tasks requiring PostgreSQL runtime evidence | Every container uses distinct name, port, database, volume/tmpfs and advisory-lock namespace; constrained CPU/RAM; start only with at least 30 GiB free; retain exact ownership and always remove its volume/processes on completion. If isolation, disk or resource limits cannot be proven, fall back to one sequential container. This accelerates testing but does not relax independent evidence, cleanup, residue, trigger or exact-SHA requirements. |
| `AMD-SECURITY-TECHNICAL-DONE-002` | `15A` | Technical `DONE` requires zero reachable Critical or High vulnerabilities, zero authentication bypass, zero tenant escape and zero secret disclosure. A Medium finding may remain only with a named owner, target date and tested compensating control. | `SEC-PRIV-001`, `UI-CANON-ALL-001`, `REL-001-T01` | Run exact-SHA security and authorization controls over every mounted surface in scope; classify reachability and retain negative controls. Any Critical/High or auth/tenant/secret failure blocks technical `DONE`. Invalidate on auth middleware, tenant resolution, secret handling, dependency/security scan baseline or mounted route change. |
| `AMD-OBSERVABILITY-INTERNAL-GATE-002` | `16A` | Internal technical completion requires exercised alerts for write failures, stale queue/outbox work, sustained database saturation and repeated authorization denials. | `OPS-OBS-001`, `ADM-MVP-OPS-001`, `REL-001-T01` | Each alert must have a linked runbook, a positive-control activation and a verified recovery/clear event without secret payloads. External paging and deployed observation remain release gates. Invalidate on metric source, threshold, alert routing, runbook or worker topology change. |
| `AMD-DATA-RECOVERY-TARGET-002` | `17A` | Internal beta targets RPO at most 15 minutes and RTO at most 60 minutes, using an encrypted backup and a manually verified restore into an isolated database. | `DATA-DR-001`, `ADM-MVP-BACKUP-001`, `REL-001-T01` | Prove backup age/checksum/encryption, isolated restore, tenant/owner readback and corrupt-backup rejection. This does not claim production DR, external KMS/object storage or an authorized production restore. Invalidate on backup schedule/format/key source/storage/restore or migration compatibility change. |
| `AMD-PERSONA-UAT-SIGNOFF-003` | `18C` | One accountable blanket sign-off by Piotr may cover the seven required personas. Separate automated signed role journeys and forbidden-action controls are still required for every persona. | `PERSONA-UAT-001`, `UI-CANON-ALL-001`, `REL-001-T01` | This supersedes `AMD-PERSONA-UAT-REVIEWER-002` only as to seven separate human verdicts; it does not merge tenant/role test evidence or permit a role to inherit another role's result. Record the exact product SHA and scope of the blanket sign-off. Invalidate on product SHA, role matrix, mounted routes or journey definitions change. |
| `AMD-UI-MANUAL-ACCEPTANCE-DEFERRED-002` | `19C` | Manual UX and brand acceptance are deferred until the pre-release gate. VoiceOver acceptance is explicitly outside MVP scope and moves to the post-MVP backlog. Automated accessibility, keyboard, responsive, language, theme and state-matrix checks continue now. | `PERSONA-UAT-001`, all `*-UI-CANON-001`, `UI-CANON-ALL-001`, `REL-001-T01` | Do not claim manual acceptance, VoiceOver or brand approval before their respective gates. VoiceOver does not block MVP technical `DONE` or MVP acceptance, but remains `NOT_VERIFIED` and cannot support an accessibility claim. Other human-dependent release verdicts remain `PARTIAL` or `BLOCKED_HUMAN`. Invalidate on UI surface, design system, accessibility semantics, MVP scope or target persona change. |
| `AMD-TECHNICAL-DONE-RELEASE-BOUNDARY-002` | `20A` | Repository technical `DONE` may be established independently of external provider, deployment, telemetry-window and production rollback evidence. Those external facts remain `PARTIAL` and block release, not unrelated repository completion. | All closure tasks; especially `CHAT-NFR-001`, `OPS-OBS-001`, `REL-001-T01` | Every evidence record must state exactly which boundary is technically proven and preserve external/deployed/production blockers. A local mock or synthetic fixture never proves provider or deployment reality. No push, deployment or release follows from technical `DONE`. Invalidate on release scope, provider boundary, environment or deployment candidate SHA change. |

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
