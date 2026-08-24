# Chat → Tools backlog below 9 — 2026-08-23

Status: `55 ATOMS / STRICT UNION AFTER TARGETED RETEST / NOT OWNER_ACCEPTED`

This is the strict union of the independent UX and consulting atomic reviews.
An atom is included when either controlling review scores it below `9.0`.
The detailed score, evidence, gap and exact closure criterion remain canonical in:

- `CHAT_TO_TOOLS_UX_ATOMIC_REVIEW_2026-08-23.md`
- `CHAT_TO_TOOLS_CONSULTING_ATOMIC_REVIEW_2026-08-23.md`

No item may leave this backlog because a test, screenshot, fixture or build passes.
Removal requires both experts to score the same frozen candidate at least `9.0`,
plus any runtime, owner-decision or persistence evidence named in the row.

## Counts

| Review | Below 9 | At least 9 |
| --- | ---: | ---: |
| UX | 54 | 42 |
| Consulting/business | 55 | 41 |
| Initial strict union | 87 | 9 |
| Current union after targeted retest | 55 | 41 |

Consulting additionally classified `15/96` atoms as truthful enough for a
bounded client demonstration today. This is not production authorization.

## Chat — 6

`CHAT-OWN-001`, `CHAT-OWN-004`,
`CHAT-OWN-014`, `CHAT-OWN-015`, `CHAT-OWN-016`,
`CHAT-OWN-017`.

`CHAT-OWN-013` left the numeric backlog at UX `9.1` and Consulting `9.6`. The
targeted receipt/move/shared-context/UI tests `28/28 PASS`, DnD receipt parity `3/3 PASS` and
focused consent `9/9 PASS`. Private/Organization folders, search, keyboard Move,
scope-bound preferences and durable receipt history are real. The readback UI
truthfully separates loading/empty/error and exposes before→after scope, time,
policy, receipt ID and actor provenance. The receipt endpoint now denies
same-organization unassigned/personal-folder non-owners, private-team
nonmembers/revoked users and foreign tenants before querying audit history;
private members/project owners and open organization access are explicitly
covered. Shared context now exposes owner, provenance/reference, version, hash,
updated time and scoped add/remove history; history-unavailable and legacy states
are explicit. Both reviews qualify this bounded flow for client demonstration.
The follow-up records `hash_basis=content|source_reference`, labels a file's
doc-id digest as `Reference hash`, and leaves legacy version/provenance/hash NULL
rather than manufacturing version 1. Authenticated RealPG cold replay,
concurrent membership/policy change, versioned context correction, retention/recovery and
browser/AT/owner acceptance remain required before production acceptance.

`CHAT-OWN-005` left the numeric backlog after command-boundary qualification: UX `9.2`, Consulting `9.5`, targeted `9/9 PASS`. The visible inventory is explicit, PROMOTE is absent, capability snapshots fail closed at render/handler time on user/tenant mismatch, duplicate submits are synchronously locked, and late success/error cannot contaminate another draft. Authenticated role/tenant policy, durable cold readback, browser/AT and owner acceptance remain open.

`CHAT-OWN-008` left the numeric backlog after bounded proposal-card qualification: UX `9.2`, Consulting `9.5`, rendered `9/9 PASS`. Approved and Ready to create are distinct, all seven states use semantic icon plus text, full Source/Hash/Version is readable, and the established Approve→Create document→Document created sequence remains. Authenticated governance/materialization, cold readback, browser/AT and owner acceptance remain open.

`CHAT-OWN-003` left the numeric backlog after mounted and local-RealPG qualification: UX `9.1`, Consulting `9.5`, UI `6/6 PASS`, RealPG `9/9 PASS` on local `localhost/iris_test`. The persisted-only control now proves create/list/switch, fresh reopen, parent and nested lineage, cutoff-copy and cross-organization denial. Shared dependencies and the local test database are not staging/production evidence; stale/concurrent/idempotency, browser replay and owner acceptance remain open.

`CHAT-OWN-002` left the numeric backlog after mounted save-state and conflict qualification: UX `9.4`, Consulting `9.5`, targeted `11/11 PASS`. This qualifies a bounded demonstration of the fixed-height header and truthful save/retry/conflict model. Real-browser geometry, authenticated persistence, two-session conflict replay, cold readback and owner acceptance remain open.

`CHAT-OWN-012` left the numeric backlog after rendered idle-state and reduced-motion qualification: UX `9.2`, Consulting `9.2`, targeted `9/9 PASS`. Consulting scores its intrinsic business value only `6.5/10`; this micro-polish is not used to inflate full-Chat readiness. Browser contrast/performance and owner visual acceptance remain open.

`CHAT-OWN-006` left the numeric backlog after direct-control rendered qualification: UX `9.3`, Consulting `9.3`, targeted `7/7 PASS`. This proves the bounded Rich/DOC/MD control and canonical content invariance, not complex-format conversion fidelity, autosave/cold readback or owner acceptance.

`CHAT-OWN-009` left the numeric backlog after broad response-state qualification: UX `9.3`, Consulting `9.4`, targeted `15/15 PASS`. The stable action surface is client-demo qualified, but real-browser geometry and durable/authorized backend outcomes remain separate gates.

`CHAT-OWN-007` left the numeric backlog after mounted floating-panel qualification: UX `9.2`, Consulting `9.2`, rendered `1/1 PASS` plus source contract. This does not substitute for real-browser zoom/mobile/AT geometry or owner acceptance.

## Interview — 8

`INT-MENU-OWN-001`,
`INT-CREATOR-OWN-001`, `REC-INT-002`,
`REC-INT-007`, `REC-INT-008`,
`REC-INT-009`, `INT-REC-001`, `INT-REC-002`.

`INT-REC-001` remains `BLOCKED` at UX `5.0` and Consulting `4.0`. The current
browser attempt at `http://127.0.0.1:4391/interview/templates` retained the URL
and showed the public landing without console warnings/errors, but the Vite
proxy reported backend `ECONNREFUSED 127.0.0.1:3001`. It did not render the
authenticated Templates product surface and is explicitly **not** a pass.

`INT-CREATOR-OWN-001` remains `OWNER_DECISION_REQUIRED`: the canonical module
acceptance register places the shared three-creator shell behind a clickable
prototype and explicit owner-approval gate. `REC-INT-007` cannot be treated as
its duplicate because the detailed Interview recommendation register reuses
that ID for typed AI Initiative fill recovery. The collision requires owner
renaming/selection before either interpretation can be closed.

`REC-INT-001`, `INT-APPROVAL-OWN-001`, its duplicate `REC-INT-005`, and
`INT-TPL-ED-OWN-001` are outside the score-based strict backlog. This is not
proof that Interview is accepted; approval runtime, frozen-version, publish
readback and owner gates remain.

`INT-QCARD-OWN-001` and the Owner-Notes interpretation of `REC-INT-004` left the numeric backlog after the shared 10/10 workspace retest: UX `9.2`/`9.2`, Consulting `9.3`/`9.3`. They represent one capability. `REC-INT-004` remains `OWNER_DECISION_REQUIRED` for traceability because the detailed Interview register reuses REC-INT-003/004/005 for different requirements; both possible REC-INT-004 capabilities independently pass the technical score gate.

`INT-PREV-OWN-001` and the Owner-Notes Preview interpretation of `REC-INT-003` left the numeric backlog after the 12/12 Preview retest: UX `9.2`/`9.2`, Consulting `9.2`/`9.2`. They represent one Preview capability. `REC-INT-003` remains `OWNER_DECISION_REQUIRED` for traceability because the detailed register maps that ID to the separately qualified question workspace.

`INT-ASSIGN-OWN-001` and duplicate `REC-INT-006` left the numeric backlog after
the eligibility/recovery correction: UX `9.1`, Consulting `9.2`, targeted
`10/10 PASS`. Every returned unavailable template has an exact reason and an
`Open template` recovery path; load failure is distinct from true empty and has
Retry; the exact pinned `vN` is visible; stale-version and idempotency conflicts
preserve form work. The fresh isolated RealPG replay is `BLOCKED`, not PASS:
the 831-migration run failed with `could not extend file ... wrote only 4096 of
8192 bytes`. Historical canonical RealPG evidence remains qualified as such;
browser/cold-readback and owner acceptance remain open.

`INT-REC-001` remains `BLOCKED` at Consulting `4.2`. A local direct-URL attempt
retained the requested path and the public landing produced no browser console
warning/error, but authentication never reached the Interview module and the
backend proxy failed with literal `ECONNREFUSED 127.0.0.1:3001`. This proves
neither the historical Templates-route crash nor a healthy module. Closure still
requires the exact backend, authenticated persona, rendered Templates UI,
successful API responses, direct-link/tab/refresh replay and clean console/network.

## Tools — 10

`TLS-OUTPUT-OWN-001`, `TLS-REPORT-OWN-001`, `TLS-INIT-OWN-001`,
`TLS-PREV-CONTENT-OWN-001`, `TLS-MENU-OWN-001`,
`TLS-MENU-POLICY-OWN-001`, `TLS-SWOT-OWN-001`, `TLS-REC-OWN-001`,
`TLS-READY-OWN-001`, `TLS-CHAIN-OWN-001`.

`TLS-PREV-CONTENT-OWN-001` is not a locally authorized Tools patch. The
canonical Tools register requires a cross-app Preview Content Contract and
marks the local fork `IMPLEMENTATION_NOT_AUTHORIZED`. It remains
`OWNER_DECISION_REQUIRED`; a typed Tools-only descriptor registry must not be
implemented merely to improve the numeric score.

`TLS-SWOT-OWN-001` remains in backlog after an independent full-denominator
re-review: UX `6.7`, Consulting `7.8`. The current snapshot qualifies only a
bounded TOOL-05 Input and TOOL-06 matrix working segment. It does not qualify
the literal reusable seven-stage method: canonical nine-part Synthesis,
separate Recommendations, Results & Readiness, Review, versioned approval,
durable decision history/reopen and second-tool reuse remain absent. The
register marks the full architecture `IMPLEMENTATION_NOT_AUTHORIZED`; therefore
the score cannot be raised above `9` through inferred local implementation.
The referenced `SWOT-003-finalny-model-pracy-dynamic-swot.md` is not present in
this worktree at the register's stated path, and the ninth synthesis category
also remains an explicit owner confirmation.

## My Work — 29

`MYW-IDEAS-CORE-001`, `MYW-IDEAS-CORE-002`,
`MYW-IDEAS-009`, `MYW-IDEAS-010`,
`MYW-IDEAS-012`, `MYW-IDEAS-013`, `MYW-IDEAS-014`,
`MYW-IDEAS-015`, `MYW-NBK-003`,
`MYW-NBK-004`, `MYW-NBK-005`, `MYW-INB-REC-001`,
`MYW-IDEA-REC-001`, `MYW-IDEA-REC-002`, `MYW-CAL-REC-001`,
`MYW-CAL-REC-002`, `MYW-CAL-REC-003`, `MYW-TASK-REC-001`,
`XMOD-CARD-REC-001`,
`MYW-DEC-REC-002`, `MYW-CV-REC-001`, `MYW-CV-REC-002`,
`MYW-CV-REC-003`, `MYW-CV-REC-004`, `MYW-CV-REC-005`,
`MYW-CV-REC-006`, `MYW-CV-REC-007`,
`MYW-AGT-REC-001`, `MYW-MGR-REC-001`.

`MYW-IDEAS-011` left the numeric backlog after the honesty-boundary retest: UX `9.0`, Consulting `9.2`. Local selection is now a retained `handed_off` state rather than a manufactured durable receipt. Runtime receipt/readback, reconciliation, cross-device audit and owner acceptance remain required.

`MYW-CV-REC-008` left the numeric backlog after the opened-safe toolbar retest:
UX `9.1`, Consulting `9.1`, targeted `8/8 PASS`. Manual Refresh and folder
creation are absent at the wrong hierarchy level; live index polling is silent,
single-flight and stale-response fenced, preserves last-known-good rows, stops
on terminal/unknown states and exposes a retained-data alert with guarded Retry.
Authenticated index cold readback, browser/AT and explicit owner retest remain;
this is not production qualification or `OWNER_ACCEPTED`.

`MYW-NBK-006` left the numeric backlog after the seven-surface product-truth
retest: UX `9.0`, Consulting `9.7`, combined real-component targeted suite
`64/64 PASS`. The canonical audit still counts 104 unique actions across seven
surfaces. Local editor/export actions remain usable; unqualified durable Slash,
Inline AI and rail actions are focusable, `aria-disabled`, visibly explained and
blocked before their handlers. Delete retains scope-bound capability,
idempotency/CAS, transactional receipt and scoped readback. RealPG/cold reopen,
authenticated multi-role replay, browser zoom/touch/AT and owner acceptance
remain separate gates; this is bounded technical acceptance only.

`MYW-NBK-CORE-001` left the numeric backlog after the canonical rail conflict
retest: UX `9.0`, Consulting `9.2`, rail behavior `5/5 PASS`. A conflict says
that local edits remain, exposes distinct `Load theirs` / `Keep mine` actions,
and rail close restores focus to its trigger. Authenticated metadata cold
readback, a real two-session conflict, editor cursor/selection/scroll browser
proof and owner acceptance remain open.

`MYW-IDEAS-007` left the numeric backlog after the inline-tab rename retest:
UX `9.0`, Consulting `9.0`, rendered `6/6 PASS`. The editor replaces rather
than nests inside the tab activator; double-click and F2 enter rename, Enter or
blur commits, Escape cancels, focus returns, and failed/conflicting saves keep
the draft with a persistent alert and Retry. The tab changes only after a
nonempty canonical title returns from `Api.updateMyIdea`. Backend CAS/duplicate
race, authenticated roles/tenant denial, response-loss retry, cold reopen,
browser/AT and owner acceptance remain open.

`MYW-NBK-CORE-002` left the numeric backlog after the native-block and governed
AI retest: UX `9.0`, Consulting `9.3`, relevant targeted `10/10 PASS`. One
discoverable insert/context registry now supports type-specific Callout,
Toggle and Table configuration plus selection-preserving Duplicate/Move/Delete
and Undo; Divider participates through NodeSelection. Teresa changes render
full Before/Proposed/action provenance before exactly-once Approve/Reject, with
fail-closed Retry. Final catalogue approval, versioned autosave/conflict/cold
reopen, provider/permission/browser/AT and owner acceptance remain open.

`MYWORK-DEC-OWN-001` and its recovered-register alias `MYW-DEC-REC-001` left the numeric backlog after the shared Decisions retest: UX `9.2`/`9.0`, Consulting `9.3`/`9.3`. Both IDs remain for traceability but represent one business outcome (`MYW-DEC-REC-001 DUPLICATE_OF MYWORK-DEC-OWN-001`). The 4/4 component run uses mocked API responses; authenticated runtime and owner acceptance remain open.

`MYW-IDEAS-006` left the numeric backlog after the targeted APG retest: UX
scores it `9.0` and consulting `9.2`. It remains `OWNER_RETEST_REQUIRED` and is
not `OWNER_ACCEPTED`. Consulting permits a qualified client demonstration of
the bounded navigation experience, not a claim of backend/cross-device durability.

## Environment gates — 2

`ENV-STAGING-OWN-001`, `ENV-AUTH-OWN-002`.

These are evidence gates, not product-code tasks. They require separate runtime
authority and exact SHA/service/database/persona/organization coordinates.

## Exit policy

For each atom, the implementation owner must attach:

1. exact candidate SHA or dirty-snapshot manifest;
2. code and test evidence;
3. exact runtime/persona/organization when required;
4. success, denied, empty, error, retry and cold-readback evidence where relevant;
5. new independent UX and consulting scores;
6. explicit owner verdict where the canonical row requires an owner decision.
