# Claude C — Ideas and Documents closure plan (15 work packets)

Branch: `codex/closure-claude-c-ideas-documents`

Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-c`

Product/code baseline: `0f5652690b59f5ebe3f465131bd591a2c4340d2e`

Scope packet commit: `aca1b7a126`

Execution-readiness packet commit: `59d572fb83`

Execution baseline: `refs/tags/closure-execution-baseline-20260816`

Read the canonical 82-task plan and
`FOUR_BRANCH_EXECUTION_CONTRACT_20260816.md`,
`EXECUTION_GATE_CATALOG_20260816.md` and
`OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md` in full before work.

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

## Atomic execution matrix

| Task/packet | Required predecessors | Canonical owner records | Required gates | External disposition |
| --- | --- | --- | --- | --- |
| `IDEA-WORKSPACE-SUBPACKET-001` | Organization source contract | `ideas`, idea comments/business/financial cases/exports, collaboration snapshots/locks | G0–G6; collaboration race; confidentiality; cold reopen | Codex closes parent with lane B |
| `IDEA-DOCUMENT-HANDOFF-SUBPACKET-001` | Idea workspace+Materials registry | versioned proposal plus artifact receipt; never direct foreign write | G0–G6; exactly-one artifact receipt; retry | Codex closes parent with lane B |
| `MAT-POL-001` | none | decision/evidence only | G0, G6 | provider/legal/procurement owner |
| `MAT-BVP-001` | provider-independent editors+registry | artifact registry/versions/lineage/approval/export receipts | G0–G6; DOC/PPT/XLSX edit/export/reopen | provider export may remain OFF |
| `MAT-MVP-DOC-001` | artifact identity | document blocks/versions/approvals/share/audit | G0–G6; restore/share/revoke/rotate | none |
| `MAT-MVP-PPT-001` | artifact identity | presentation decks/versions/templates/export records | G0–G6; notes/a11y/PPTX+PDF readback | approved provider for external export |
| `MAT-MVP-XLSX-001` | artifact identity | workbook versions/commands/leases/export receipts | G0–G6; formulas/structure/CAS/reopen | none |
| `MAT-MVP-EXPORT-001` | DOC/PPT/XLSX stable | immutable source/output/provider job receipt | G0–G3, G5–G6; hash/readback/retry | approved provider |
| `MAT-UI-CANON-001` | three editors stable | mounted artifact shell/editors only | G0–G2, G4, G6 | manual UX/VoiceOver |
| `CHAT-BVP-001` | Organization snapshot+Idea proposal contracts | conversations/messages/attachments/proposals/receipts | G0–G6; no foreign owner write; cold reopen | real provider call remains external if unavailable |
| `CHAT-NFR-001` | Chat BVP | stream/provider telemetry and durable conversation | G0–G3, G5–G6; cancellation/timeout/restart | provider stability window |
| `CHAT-UI-CANON-001` | Chat runtime stable | mounted Chat views only | G0–G2, G4, G6 | manual UX/VoiceOver |
| `ORG-BVP-001` | none | organization context/claims/sources/snapshots/versions | G0–G6; immutable exact refs; confidentiality | none |
| `ORG-OPS-001` | Organization owner | context events/worker state/retention/provenance | G0–G3, G5–G6; rebuild/restart/runbook | legal retention decision where destructive |
| `ORG-UI-CANON-001` | Organization BVP | mounted Organization views only | G0–G2, G4, G6 | manual UX/VoiceOver |
| `MTG-BVP-001` | Meeting policy defaults + downstream proposal contracts | meetings/minutes/participants/notes/outputs/idempotency/audit | G0–G6; exactly-one task/decision/material receipt | recording/transcript remains OFF |
| `MTG-UI-CANON-001` | Meeting BVP | mounted Meeting views only | G0–G2, G4, G6 | manual UX/VoiceOver |

The matrix has 17 rows because the two Ideas sub-packets are mandatory checks
inside the 15 top-level task denominator; they do not create new program tasks.

## Domain allowlist

Exact tracked allowlist:
`generated/CLAUDE_LANE_C_PATH_LEASE.json`, SHA-256
`889f5a1cbe953d76149b5ac876c2ce0e6ce3b12e2775a4fa6d84cfa099688d28`.
It contains Idea-owned paths, Materials/Artifact/DocumentStudio/Presentations/
Workbook, Chat/AIChat, Organization context/snapshots and Meeting document
boundary code/tests. No tracked path outside the manifest may be edited. My
Work decision/task/Agent lifecycle, Initiatives, Execution, Results, Finance,
shared files, infrastructure and release code are forbidden.

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
