# AUD-POL-001 — Methodology / Rights / Segregation-of-Duties Decision Packet

Status: **factual position established; two fixable gaps identified; no
rights granted, no content approved, no external standard activated by this
packet.**

Companion evidence:
- Rights inventory: `docs/program/evidence/closure/a/AUD-MVP-RIGHTS-001/RIGHTS_INVENTORY.md`
- Negative-control tests (real Postgres): `server/src/services/auditProgramRights/__tests__/auditPackRights.realdb.test.ts`
- Integrator change requests: `docs/program/evidence/closure/a/AUD-MVP-RIGHTS-001/INTEGRATOR_CHANGE_REQUESTS.md`

---

## 1. Decision(s) required

1. **Which named external standards, if any, does Consultify obtain rights
   for, and under what license terms** (owned/licensed/public-reference), so
   `audit_norm_sources.rights_status` can honestly move off `not_verified`?
2. **Whether the legacy ISO 27001 preset** (`src/components/Audit/
   auditPresets.ts`) stays reachable in the default-on Audit Orchestrator
   wizard, gets pulled behind a flag, or gets retired in favor of the
   rights-gated pack kernel. This is a product decision with a one-line code
   fix once made (see Gap 2 below) — the packet does not pre-empt it.
3. **Whether GAP 1** (draft/unpublished packs listable by any org member) is
   accepted as-is for MVP or fixed before the next audit-module surface
   ships to a client who isn't also the pack author.

## 2. Accountable owner

**Product + Methodology/Rights + Legal.** This agent (implementer) may not
grant rights, approve pack content, or flip an external standard on. Nothing
in this packet does that.

## 3. Options and consequences

| Option | Consequence |
|---|---|
| **A — Fail-closed default (recommended, already the de facto state)**: internal, unlicensed transformation pack only; named standards stay `not_verified`/off. | Zero legal exposure from standard-body IP. Consultify can sell an audit *methodology* (own criteria, own procedure) but not a certification-adjacent "ISO 27001 audit" claim. The legacy preset (Gap 2) contradicts this today and should be fixed or explicitly carved out as an accepted exception. |
| **B — License/verify specific standards** (e.g. buy rights or negotiate public-reference use for ISO 27001, IATF 16949, SOC 2). | Unlocks `VERIFIED_NORMATIVE` classification for those packs — the kernel already supports this cleanly (`packValidator.ts` `eligibleClassifications`), it just needs a real `audit_norm_sources` row with `rights_status IN ('licensed','owned_internal','public_reference')`, a `sourceVersion`, and expert approval. This is a legal/commercial track, not an engineering one. |
| **C — Do nothing about Gap 2** | The legacy ISO 27001 preset keeps shipping by default (`MODULE_AUDITS: 'open'`) outside the rights kernel. Low-severity today (domain-name taxonomy, not clause text — see inventory) but the risk grows every time someone adds a second preset by copying the pattern, since there is no gate stopping it. |

## 4. Recommended fail-closed default

**Option A**, exactly as already recorded by the owner: internal pack only,
named standards off without rights. This packet does not change that
decision — it verifies the kernel enforces it (Section 6) and documents the
two places it currently doesn't (Section 7).

## 5. What stays blocked until an owner accepts

- Any pack with `sourceType IN ('LICENSED_STANDARD','REGULATION')` moving to
  `publication_status = 'published'` with `classification = 'VERIFIED_
  NORMATIVE'` — blocked today by `packValidator.assertPublishable` unless a
  verified, rights-cleared `audit_norm_source` exists (proven in Section 6).
- The ISO 27001 preset being marketed to a client as an actual audit — it
  currently CAN be launched (Gap 2) but produces a program whose criteria are
  never traced to any rights-checked source; nobody should present its output
  as "ISO 27001 compliant" until this is either retired or routed through the
  kernel.

## 6. Code that enforces the fail-closed default TODAY (verified)

- **Publish gate**: `server/src/services/audits/packValidator.ts:357-498`
  (`validatePack`/`assertPublishable`). A pack whose title implies a named
  standard without normative coverage is rejected
  (`PACK_TITLE_IMPLIES_NORMATIVE`, line ~446). A pack declared
  `VERIFIED_NORMATIVE` without a verified, rights-cleared, normative-typed
  source is rejected (`SOURCE_MISSING`/`SOURCE_TYPE_NOT_VERIFIED`/`SOURCE_
  RIGHTS_UNVERIFIED`, lines 269-343). **Proven against real Postgres**, not
  just read: see tests 1 and 2 in `auditPackRights.realdb.test.ts` — both
  assert the exact validator error code AND the real end-to-end
  `publishPack` rejection.
- **Usage gate**: `server/src/services/audits/programService.ts:392-397`
  (`createProgramCore`) refuses to create a program from any pack whose
  `publication_status !== 'published'`. **Proven**: test 3 asserts the
  refusal AND does a `SELECT COUNT(*) FROM audit_programs WHERE pack_id = …`
  = 0 — a refusal that still wrote a row would have failed this test.
- **Positive control** (so the above isn't "everything is broken" by
  default): the clean internal `DEMONSTRATION` seed pack
  (`packSeed.ts`) publishes and launches a program successfully — test 4.
- **Schema carries the rights axis**: `audit_norm_sources.rights_status`,
  `.rights_note`, `.license_reference`, `.source_type`, `.verification_state`
  (`server/migrations/20260813_audits_method_core.sql:71-97`, refined in
  `20260813b_audits_source_classification_split.sql:33-67`).

## 7. The two gaps, and their minimal fixes

Full blind-appliable diffs are in `INTEGRATOR_CHANGE_REQUESTS.md`. Summary:

- **GAP 1 — unpublished packs are listable/readable by any org member.**
  `server/src/routes/audits/packs.routes.ts` `GET /` (line 42) and `GET /:id`
  (line 91) call `listPacks`/`getPack` with no `publication_status` filter
  unless the caller opts in with `?status=published`, and no capability check
  at all (only `POST`/`PATCH`/`DELETE` call `requireAdmin`). Minimal fix:
  default the read path to `status='published'` unless the actor is a
  platform admin. Proven current behavior (not a guess): test 5 in
  `auditPackRights.realdb.test.ts`, explicitly named as a KNOWN-GAP
  characterization test.
- **GAP 2 — the legacy ISO 27001 preset bypasses the rights kernel entirely.**
  `src/components/Audit/auditPresets.ts` (`ISO_27001_PRESET`, lines 47-145)
  is static frontend data with no `audit_norm_sources` row, reachable by
  default (`src/components/Audit/AuditsHub.tsx:791,795`, `MODULE_AUDITS:
  'open'`) and merged straight into `audit_programs.config` by the legacy
  writer, never touching `packValidator`. Minimal fix is a product decision
  first (Section 1, item 2), then either (a) delete the preset launcher, or
  (b) gate it behind an explicit, default-off flag until Option B is chosen
  for ISO 27001 specifically.

## 8. Segregation of duties — facts, verified at the call site

All four guards exist in `server/src/services/audits/permissions.ts` and are
**wired into the live write path**, not orphaned:

| Guard | Definition | Call site (verified by reading the code) | Wired? |
|---|---|---|---|
| `assertNotConcludingOwnResponse` | `permissions.ts:331-348` | `criterionService.ts:519`, inside `concludeCriterion` — called right after `requireCapability(actor, ..., 'criterion.conclude')`, before the conformity update. | **Yes** |
| `assertNotClosingOwnFinding` | `permissions.ts:353-368` | `findingService.ts:826`, inside `closeFinding` — called right after `requireCapability(act, ..., 'finding.close')`, before the close write. | **Yes** |
| `assertNotReviewingOwnFinding` | `permissions.ts:399-414` | `findingService.ts:585`, inside `reviewFinding` — called right after `requireCapability(act, ..., 'finding.review')`, before the confirm/send_back/reject write. | **Yes** |
| `assertIndependentVerifier` | `permissions.ts:374-394` | `verificationService.ts:191`, inside `performVerification` — called, when the verification is tied to a corrective action (`row.corrective_action_id`), right after `requireCapability(act, ..., 'verification.perform')`, before the verification write. | **Yes** |

**Verdict: none of the four is unwired.** All sit on the actual write path of
their respective service function, after the capability check and before the
mutating SQL — the ordering that makes them load-bearing rather than
decorative.

### The independence *detector* is a different thing, and it is not run by anything

`server/src/services/audits/auditTrailService.ts` exports
`getIndependenceReport` (`:269`), explicitly documented in its own header
(`:9-15`) as a **detector**, not a preventer: it re-scans live tables to
catch SoD violations that could have entered outside the API (import,
migration, manual DB fix) — i.e., it does not trust that the four guards
above caught everything at write time.

It is wired to exactly one place: `GET /trail/independence`
(`server/src/routes/audits/trail.routes.ts:94-104`), gated by
`program.read`. I searched:

- `src/` for any UI surface calling it (`independence`, case-insensitive) —
  no hit. The only frontend "independence" strings are unrelated (a finding
  review can't-review-own-finding message, an org-chart evidence line in
  assessment content, a narrative-engine copy string).
- `server/src/cron/**`, `server/src/jobs/**`, `server/src/scripts/**` for any
  scheduled or one-off caller — no hit.

**Conclusion: nothing calls it.** It exists as a reachable API endpoint an
authenticated org member with `program.read` could hit manually, but no UI
button, report, or scheduled job surfaces it. A detector nobody runs is not a
control — it's a query someone would have to remember exists and run by
hand. This is not a defect in the four preventive guards (those are real);
it is a gap in operationalizing the *detective* layer that the code comment
itself says is needed precisely because the preventive layer can be
bypassed outside the API.

## 9. What this packet does NOT do

- Does not license, verify, or approve any external standard.
- Does not change `packValidator.ts`, `packService.ts`, `programService.ts`,
  `permissions.ts`, or any file outside this lane's lease.
- Does not fix GAP 1 or GAP 2 — see `INTEGRATOR_CHANGE_REQUESTS.md` for the
  diffs the integrator can apply once an owner accepts them.
