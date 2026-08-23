# Assessment — consolidated expert decision and implementation contract

**Date:** 2026-08-23  
**Candidate:** `43730f86f8a74943c36a58b9ff07aa680a42aa3e`  
**Runtime reviewed:** client `127.0.0.1:4390`, server `127.0.0.1:4391`, reconstructible local review DB  
**Decision:** `NO-GO / NOT OWNER ACCEPTED / RELEASE BLOCKED`  
**Production/Railway:** not changed  

## 1. Evidence and denominator

This document consolidates, but does not replace:

- `ASSESSMENT_CURRENT_GATE_PACKET_2026-08-23.md` — current G00–G20 evidence and 9 current-state defects;
- `ASSESSMENT_EXPERT_UX_REVIEW_2026-08-23.md` — 13 UX findings;
- `ASSESSMENT_EXPERT_METHOD_REVIEW_2026-08-23.md` — 20 method/business findings;
- `ASSESSMENT_EXPERT_TECH_REVIEW_2026-08-23.md` — 12 technical/integration findings;
- ten exact-candidate PNG files `ASM-G04` through `ASM-G10`.

Atomic denominator: **45 expert findings + 9 observed current-state defects**. Findings remain addressable under their original IDs. Consolidation below links overlaps; it does not delete observations or claim closure.

## 2. Superseding owner decision

The later explicit owner decision supersedes the older four-mode workshop proposal:

- work modes are exactly **Interview / Matrix / Report**;
- **Settings** is a separate control surface;
- **Split is removed as a top-level mode**;
- the useful Split capability survives as an Interview answer register/review subview;
- the permanent tool-local Teresa panel is removed; the global assistant remains;
- the user-facing downstream trio is exactly **Insights / Reports / Initiatives**; immutable `AssessmentOutput` may remain internal provenance only.

This decision is the navigation and domain baseline for implementation and acceptance.

## 3. Target end-to-end contract

`Library → Process → Interview/current evidence → current approval → Matrix/current-target-gap → target approval → Report/review/publication/PDF → Insights/Reports/Initiatives with lineage`

Every transition must persist and read back on the same candidate, user, organization, method version and database. Screenshots alone cannot prove persistence, authorization, scoring, lineage, quota or PDF reproducibility.

## 4. Closed implementation backlog

| Work package | Required result | Source findings | Closure evidence |
|---|---|---|---|
| `ASM-WP-01 Canonical shell` | Header with name and Exit; second menu Interview/Matrix/Report plus separate Settings; contextual third menu; one left navigator; no Split and no local Teresa | ASM-CUR-004/005, ASM-UX-001/002/003/005/006, ASM-METH-001/003/004/020 | Desktop and responsive route replay; deep link and refresh preserve mode, axis, area and unit |
| `ASM-WP-02 Library truth` | Pure method catalogue; no session table or process-state filters; readable method preview with purpose, areas/axes, levels, effort, evidence/participants, price/entitlement and availability; Start creates Process | ASM-CUR-001/002, ASM-UX-007/008/009, ASM-METH-012/013 | Preview and created Process use identical method/version; axis count contract test (DRD=7) |
| `ASM-WP-03 Method adapter` | Schema expresses arbitrary axes, areas, levels, response/evidence/scoring/progression/report/approval/downstream rules; no DRD hard-coding | ASM-METH-011, ASM-TECH-43730-001/010 | DRD plus a synthetic non-DRD method render through the same shell without product-specific branches |
| `ASM-WP-04 Governed Process` | Durable process identity, method/version, revision, owner/team, progress, evidence gaps, active gate, entitlement and exactly one next valid action | ASM-METH-002/014/019, ASM-TECH-43730-002/009/011 | Create/read/reload/reopen/freeze/revision test with immutable prior snapshot |
| `ASM-WP-05 Interview` | One manageable unit at a time; concise cards; progressive detail; current-state response, rationale, evidence, attachments/links, save/resume, counts and next/previous | ASM-CUR-003, ASM-UX-001/002/005/006, ASM-METH-003 | At 1440×900 primary task is visible; response+rationale+evidence survive reload and resume at exact unit |
| `ASM-WP-06 Answer register` | Interview-internal review list for unanswered, missing evidence, needs review and approved; row deep-links to exact unit | ASM-UX-003, ASM-METH-004 | Filters return seeded expected counts; route returns to source response |
| `ASM-WP-07 Evidence security` | Attachment metadata, access control, validation, storage reference, audit and safe download; evidence status is not inferred from filename alone | ASM-METH-002/009, ASM-TECH-43730-008/009 | Authorized upload/read succeeds; cross-tenant and unauthorized read/write fail; audit persists |
| `ASM-WP-08 Matrix truth` | Current derived from approved Interview; target separate and human-governed; gap deterministic; current/target colors; comments, drill-down and prerequisite-gap handling | ASM-CUR-006, ASM-UX-004/012, ASM-METH-005/006 | Seeded answers generate expected current; target cannot mutate current; source drill-down and discontinuity resolve/waive are proven |
| `ASM-WP-09 Approval graph` | Separate approvals for current answers, targets and report; configured responder/reviewer/approvers; active gate/blocker/next action visible | ASM-METH-009/010, ASM-TECH-43730-003 | Role-negative and role-positive tests; three audit timestamps; reopen creates revision |
| `ASM-WP-10 AI proposal safety` | Analyze AI produces source-backed proposed changes with rationale/confidence; no mutation until per-item Apply; Reject is no-op | ASM-METH-017 | Before/after DB readback proves proposals are non-destructive and applied items are audited |
| `ASM-WP-11 Report workspace` | Seven DRD axis chapters; each has intro, approved matrix image, every area commentary, current/target/gap, limitations and conclusions; human comments and AI review | ASM-CUR-004/007, ASM-METH-007, ASM-TECH-43730-005 | Generated report has 7 ordered chapters and exact configured area denominator; review/publish gate passes |
| `ASM-WP-12 PDF and quota` | Export axis and Export all; reproducible approved snapshot; async job/failure state; authorization; quota decremented once only on success | ASM-METH-010/018, ASM-TECH-43730-005/006/011 | Byte-identifiable source/version; retry/idempotency; success, failure, zero-quota and unauthorized tests |
| `ASM-WP-13 Settings` | Document info, subscription/report credits, team/roles, three approval policies and complete version history | ASM-METH-009/010/019, ASM-TECH-43730-003/006 | Licensed/unlicensed/zero-quota fixtures and role matrix visible and enforced server-side |
| `ASM-WP-14 Downstream lifecycle` | Insights/Reports/Initiatives registries use shared patterns; no Outputs UI; eligibility-aware empty states; human-governed Initiative registration | ASM-CUR-007/008/009, ASM-UX-010/011, ASM-METH-008/015/016, ASM-TECH-43730-004/007 | At least one populated artifact each; exact source process/snapshot/method version; draft processes show “exists but ineligible” |
| `ASM-WP-15 Preview/menu standards` | Full-height preview, no clipping, standard row menu, destructive action de-emphasized and confirmed, consistent status semantics | ASM-UX-008/009/010/012 | Screenshot comparison at supported widths and interaction test for menu/preview/destructive confirmation |
| `ASM-WP-16 Accessibility/responsive` | Keyboard, focus, labels, dialogs, contrast, reduced width and no hidden critical action | ASM-UX-013 | Automated axe plus manual keyboard/focus replay at desktop and narrow viewport |
| `ASM-WP-17 Exact-candidate proof` | Current source/runtime/DB/auth packet and G00–G20 replay after implementation; no stale donor evidence | ASM-TECH-43730-012 | SHA, dirty fingerprint, process cwd/ports, DB identity, auth/org and browser screenshots recorded together |

## 5. Implementation order and stop gates

1. **Domain truth first:** WP-01–04. Stop if the adapter, process identity or owner navigation decision is ambiguous.
2. **One persisted vertical slice:** WP-05–10 for one axis/area through both approvals. Stop if reload, authorization or lineage fails.
3. **Paid deliverable:** WP-11–13. Stop if published report/PDF cannot be reproduced from an immutable snapshot or quota is not server-enforced.
4. **Downstream integration:** WP-14. Stop if any artifact lacks source lineage or Initiative registration bypasses human approval.
5. **System quality and replay:** WP-15–17, then full DRD denominator and second-method adapter fixture.

No broad visual polish or all-axis expansion should precede a passing persisted vertical slice. This is sequencing, not scope reduction: all 17 work packages remain required.

## 6. Re-acceptance matrix G00–G20

- `G00–G03`: exact candidate, route/auth/org, server/DB identity, entitlement/roles/approval policy.
- `G04–G07`: pure Library, method truth, Start transition, preview/menu standards.
- `G08`: Processes populated, state/readiness/next action truthful.
- `G09`: Interview, answer register, Matrix, Report, Settings; persistence, authorization and revision evidence.
- `G10`: populated Insights/Reports/Initiatives with lineage and eligibility-aware empty states.
- `G11–G13`: create/update/negative-path/readback, reload and deep-link continuity.
- `G14–G16`: permissions, tenant isolation, evidence security, subscription and quota.
- `G17–G18`: accessibility, responsive layout, PDF generation and failure recovery.
- `G19`: exact-candidate automated checks plus targeted browser replay.
- `G20`: three independent re-reviews followed by explicit owner acceptance only.

## 7. Current status

The packet is complete enough to begin controlled implementation. It is not evidence that implementation has occurred. All 17 work packages are `OPEN`; Assessment remains `NO-GO` until the re-acceptance matrix passes on one frozen exact candidate.
