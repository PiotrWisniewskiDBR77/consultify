# Chat → Tools final three-person panel — 2026-08-23

Status: `UNANIMOUS NO-GO / TARGETED WIP WALKTHROUGH ONLY`

Scope: current working snapshot after the 96-atom UX/consulting reviews and the
targeted Canvas radiogroup and My Work APG tab corrections. This panel does not
assert deployment, exact-runtime qualification or owner acceptance.

## Scores

| Module | UX | Software architecture | Consulting | Average | Gate |
| --- | ---: | ---: | ---: | ---: | --- |
| Chat | 7.9 | 6.9 | 7.0 | 7.3 | `NO-GO` |
| My Work | 7.4 | 7.8 | 6.6 | 7.3 | `NO-GO` |
| Interview | 8.6 | 8.4 max | 8.3 | 8.4 | `NO-GO` |
| Tools | 7.5 | 7.4 | 6.9 | 7.3 | `NO-GO` |

All three reviewers reject full owner acceptance and a client demonstration
presented as a working integrated product. UX and consulting permit only a
moderated, explicitly labelled WIP/design walkthrough of accepted baselines and
bounded deltas.

## McKinsey-style client question

The consulting reviewer would not take the four modules to a client as an
integrated product today. A bounded walkthrough may show Tools Library/Detail
and accepted Preview graphics, the Interview table/navigation baseline and
selected current-HEAD improvements with an explicit persistence/provider/
permission/downstream disclaimer.

The four modules do not yet close the business chain:

`source/evidence → finding → insight → options → recommendation → approval or return → decision → governed action → durable result → cold reopen`.

## Software scalability question

The current records and patterns are insufficient for safe automatic rollout
across the remaining Tools. Safe reusable foundations exist (Preview shells,
Canvas autosave/CAS/conflict, Interview pinned-PG unit of work, accepted versus
pending SWOT separation, shared block/action presentation and evidence-ledger
governance), but platform contracts are missing:

1. canonical versioned Tool result/output/recommendation schema;
2. resolved four-result-class versus five-navigation-stage taxonomy;
3. typed action descriptors with capability, state, command, idempotency,
   confirmation, receipt, readback and audit event;
4. one UI/API role-state-tenant permission evaluator;
5. legal lifecycle state machines and concurrency rules;
6. immutable lineage/version/source hash and duplicate prevention;
7. explicit ephemeral/draft/canonical persistence taxonomy;
8. standard error, partial-success and retry receipts;
9. real-PG/auth-persona executable conformance tests.

Until those contracts exist, automation may generate inventory, scaffolding and
tests only. It must not generate product behavior or lifecycle mutations.

## Targeted retest result

- `CHAT-OWN-006`: UX `9.0`, consulting `8.9`; remains in backlog because real
  content/selection/caret/scroll fidelity and browser/AT replay are absent.
- `MYW-IDEAS-006`: UX `9.0`, consulting `9.2`; leaves the numeric below-9
  backlog. It remains owner/runtime retest required and is not client-ready.
- Targeted tests: `14/14 PASS`; technical evidence only.

## Stop conditions

- unknown exact SHA/runtime/API/database/persona/organization;
- unresolved P0/P1, owner decision or prototype gate;
- any mutation without backend permission denial, idempotency and durable
  receipt/cold readback;
- local/session persistence used for domain truth;
- ambiguous Tools taxonomy or unsupported legacy coercion;
- multi-table mutation without fail-closed transaction behavior;
- source-string tests substituted for rendered/API/DB negative paths;
- any change to Assessment or inherited `DiscoveryToolsHub.tsx` WIP.

## Frontend-only browser qualification attempt

A local Vite frontend was started at `http://127.0.0.1:4197` with the API target
deliberately pointed at the unused local address `127.0.0.1:39999`. The public
shell rendered with the `LOCAL` environment badge and no browser console error.
The canonical `/demo` route rendered its access-setup screen, but `Try demo`
could not establish a session without the backend. The module routes were
therefore not reachable without bypassing authentication or creating an
account, neither of which was authorized.

Literal server evidence: repeated Vite proxy failures were
`Error: connect ECONNREFUSED 127.0.0.1:39999`. The earlier full-stack start also
failed closed with `Missing required env file: .../.env.staging.local`; no env
file was created and no staging/Railway/database mutation was attempted.

Disposition: `PUBLIC_LOCAL_SHELL_RENDERED / AUTHENTICATED_MODULE_REPLAY_NOT_REACHABLE`.
This does not change expert scores or owner acceptance. The temporary browser
tab, Vite process and shared-runtime symlink were closed/removed after the test.
