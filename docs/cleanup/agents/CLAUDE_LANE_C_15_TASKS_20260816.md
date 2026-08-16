# Claude C — Ideas and Documents closure plan (15 work packets)

Branch: `codex/closure-claude-c-ideas-documents`

Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-c`

Product/code baseline: `0f5652690b59f5ebe3f465131bd591a2c4340d2e`

Authority packet commit: `aca1b7a126`

Read the canonical 82-task plan and
`FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md` in full before work.

## Mission

Pracuj do skutku nad all 15 work packets. Close the path from governed Idea and
Organization context through Chat-assisted proposal to editable/exportable
Documents/Materials. Idea lifecycle tables remain under the My Work contract;
this lane owns bounded Idea workspace surfaces and the versioned Idea→Document
handoff. Do not edit Agent/Initiatives/Execution, shared routing/flags or
infrastructure; express needs as contracts.

## Owned tasks — exact top-level denominator 15

Ideas is mandatory scope in this lane through the following two bounded checks,
but these checks are not additional top-level tasks in the 82-task denominator:

- `IDEA-WORKSPACE-SUBPACKET-001` — table/mindmap/process-flow/whiteboard,
   collaboration/locks/snapshots, confidentiality, decision/scoring governance,
   business/financial case and cold reopen. Own `Idea*` surfaces/services/tests;
   do not edit decision/task/Agent lifecycle code.
- `IDEA-DOCUMENT-HANDOFF-SUBPACKET-001` — versioned Idea→Document/PPT/XLSX
   proposal with stable source ID/hash, human approval, idempotency key,
   exactly-one artifact receipt and retry/reopen negatives.

Codex closes the My Work parent only after Claude B and C handoffs integrate.

### Materials / Documents (7)

1. `MAT-POL-001` — prepare provider, DPA/residency/SLA/cost and asset rights/
   provenance decision packet; continue all provider-independent work.
2. `MAT-BVP-001` — real DOC/PPT/XLSX open→edit/version/export→reopen; leases,
   CAS, four-eyes, tenant/concurrency and provider fail-closed.
3. `MAT-MVP-DOC-001` — create/edit/checkpoint/restore/share/revoke/rotate DOC
   and immutable lineage.
4. `MAT-MVP-PPT-001` — template/edit/history/restore/PPTX+PDF/share/revoke,
   notes and accessibility.
5. `MAT-MVP-XLSX-001` — structural operations/formulas/version/concurrency/
   share/archive and cold readback.
6. `MAT-MVP-EXPORT-001` — immutable source artifact/version/hash, provider job,
   output hash and idempotent retry receipt.
7. `MAT-UI-CANON-001` — three editors, shell/context menus, responsive,
   light/dark, keyboard/VoiceOver/axe and human-ready visual evidence.

### Chat (3)

8. `CHAT-BVP-001` — message+attachment+URL→citation→proposal→human approval→
    exactly one receipt→cold reopen; tenant/retry/reject/concurrency and
    provider/empty-stream fail-closed. Chat proposes but never owns Idea or
    artifact lifecycle.
9. `CHAT-NFR-001` — cancellation, latency/retry budget, provider recovery,
    restart durability, telemetry and runbook.
10. `CHAT-UI-CANON-001` — mounted states, 1440/768/390, light/dark, PL/EN,
    keyboard/focus/axe and visual evidence.

### Organization (3)

11. `ORG-BVP-001` — document→claim proposal→human approve→immutable context
    snapshot→Chat/Idea with exact refs→reopen; conflict/source deletion/
    confidentiality/tenant negatives.
12. `ORG-OPS-001` — snapshot lifecycle, provenance/retention, monitoring,
    repair/rebuild, restart and operator runbook.
13. `ORG-UI-CANON-001` — context/claims/sources/snapshots, permission/
   confidentiality/error states and responsive/a11y/visual evidence.

### Meeting document boundary (2)

14. `MTG-BVP-001` — create→agenda/materials→notes→proposal→human approval→
    exactly one task/decision/material→reopen; tenant/role/replay/concurrency.
    Recording stays OFF and retention policy remains owned by Codex/owner.
15. `MTG-UI-CANON-001` — minutes/proposals/materials/consent/retention/error
    states and complete responsive/a11y/visual evidence.

## Domain allowlist

Allowed after inventory: `Idea*` components/services/routes/tests and idea
collaboration/snapshot/business/financial-case code; Materials/Artifact/
DocumentStudio/Presentations/Workbook domain code/tests; Chat/AIChat domain;
Organization context/claims/snapshot domain; Meeting minutes/proposal/material
surfaces excluding policy; lane-C fixtures/evidence and reserved migrations.
My Work decision/task/Agent lifecycle, Initiatives,
Execution, Results, Finance, shared files, infrastructure and release code are
forbidden.

## Required order

1. Freeze Organization snapshot→Chat→Idea source identity.
2. Close Idea workspace persistence/collaboration/governance and emit stable
   Idea receipt contract to Claude B without editing its code.
3. Close Idea→Document handoff and artifact identity.
4. Close DOC, PPT and XLSX persistence/version/export workflows.
5. Resolve provider-independent Materials gates; prepare owner packet for the
   provider/rights remainder.
6. Close Chat/Organization and Meeting document boundary/UI canon tasks.
7. Complete lane fresh+upgrade realDB/browser/regression handoff.

## Lane acceptance

- exactly 15 top-level task verdicts plus both mandatory Idea sub-packets;
- Idea lifecycle ownership remains compatible with Claude B's My Work parent;
- Chat proposes, Organization supplies immutable context, and Materials owns
  exactly-one artifact/version receipt;
- DOC/PPT/XLSX remain editable after export/reopen with stable lineage;
- fresh+upgrade PG, retry/restart/idempotency, tenant/RBAC and browser evidence;
- provider/human-blocked items have executable decision packets, not defaults;
- clean worktree and ordered independently cherry-pickable commits.
