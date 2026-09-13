# Interview per-answer approval — backend freeze evidence (2026-09-13)

## Scope and status

This packet is the backend follow-up to commit
`5592994734f85cbfc3ddced317a55c0ad7741e73`. It closes the review findings for
per-question submission identity, frozen policy, stage/actor authority, AI
provenance and retry, selective resubmission, answer/evidence serialization,
mounted V8 routes, signed JWT access and cleanup. The organization policy UI
and respondent/manager per-answer UI remain a separate C-UI packet and are not
claimed here.

The first backend freeze was placed on HOLD by independent source review. This
candidate also addresses all four findings from that review: AI phase-two
results become visible only after transaction commit; provider question IDs
must exactly and uniquely cover the answered denominator; answer, evidence and
decision mutations share assignment → session → question → evidence lock order;
and governed mutations fail closed for null, broken or ambiguous canonical
assignment links.

The only migration is the explicitly authorized
`server/migrations/20262170_interview_answer_decisions.sql` (SHA256
`b5ce36cd849ba031f8123f061aecf0b52eeb0ef3a83efd8a682c37f552b67457`).
It contains only additive/idempotent statement families. No staging or demo
runtime was contacted.

The V4 commit attempt was stopped by the repository language ratchet before a
commit was created. V5 replaces the four new user-facing raw-English API
messages with stable error codes and `messageKey` values, keeps the required
answer message on the existing workspace key, and adds the AI-unavailable key
to both shipped EN and PL catalogs. The internal provider-coverage exception is
also a stable diagnostic code. No approval, lifecycle or persistence behavior
changed.

## Preserved RED and repair

`REALPG_RACE_HARNESS_HOLD_V3.json` is the earlier 3/4 harness synchronization
failure (SHA256 `3722e48eea71260ca103610161201fd91694ed25baf9f3a1125784f88c58365d`);
it is not classified as a product failure.

The second-review race iterations are retained as
`P1_RACE_HARNESS_HOLD_V2.json`, `P1_RACE_HARNESS_HOLD_V3.json` and
`P1_RACE_HARNESS_HOLD_V4.json` (SHA256 `21ec34c13a3923c7398c983807ba2f9c2b85872df6d956c08385df90768598e8`,
`1ec5da90dcf6e72c5d4e3aa04ac3ddff452a634ee80c3bfa6679e920433974e7`
and `aec8bb4ce41eda4f89d16f8f0d773b1eefc8ef5cff36a1add2e5589e9da37f90`).
They contain stale expectations and incomplete waiter instrumentation, so they
are classified as harness HOLD rather than product failures. The final race
denominator records both lock acquisition orders and exact HTTP/SQL outcomes.

The V2 source repairs were accepted on re-review, with one remaining evidence
gap for the reverse answer → manager acquisition order. The added RealPG test
starts a permitted returned-answer PATCH as the first actual assignment-lock
waiter and a manager decision as the second. After release, PATCH returns 200,
the late manager command returns the single controlled 409
`ASSIGNMENT_STATE_INVALID`, and SQL readback proves the corrected answer,
unchanged sent-back lifecycle, one existing send-back receipt, zero approval
receipts and zero late command rows. No product change was required for this
evidence closure.

V3 was then held on evidence quality only: its `late_commands` count joined
commands through decision rows and could therefore hide an orphan late command.
That full raw run is retained as `V3_REALPG_SERVICE_RACE_EVIDENCE_HOLD.json`
(SHA256 `3a1a2441ff8f9d37f50b4394e1b72f04503c33c5b967e475a36655b194e16bf2`).
V4 replaces the count with a direct scalar read of
`interview_answer_decision_commands`, scoped by exact organization, assignment
and late manager `client_request_id`. The selected 1/9 behavior run is retained
as `V4_RETURNED_ANSWER_MANAGER_EXACT_GREEN.json` (SHA256
`62d62c689f6cd6346f589e985c9f88ab690f92e11a3c7ab57025aaee38bbefe4`);
the other eight tests are explicitly pending in that selected-run artifact and
all nine run in the full RealPG denominator below.

A subsequent run of the exact submit-versus-PATCH behavior reached the actual
controller and PostgreSQL and returned HTTP 500 / PostgreSQL `0A000`:
`FOR UPDATE cannot be applied to the nullable side of an outer join`. The
qualified checkpoint is `REALPG_LEFT_JOIN_LOCK_QUALIFIED_RED_V3.json` (SHA256
`d4bc8168f66f3aec36314d0e60edbf7daa2f0c337b435efd5239bd35e88a67ac`).
The verbose output was observed and reported contemporaneously but was not
redirected, which the checkpoint states explicitly. The repair changes all
three affected assignment locks to `FOR UPDATE OF a`; the regression test
asserts that exact lock target.

## Migration proofs

The source schema artifact was
`/Users/piotrwisniewski/Developer/cto-codex/staging-schema-20260913.sql`,
SHA256 `bf580feb5a9edd7960a2b38708fa31e5d8b16c7014ec82870f700882aa4aba78`.
It was restored only into a new isolated `pgvector:pg18` container.

- Empty database, strict migrator from zero: 915 migrations including 20262170,
  then a second strict run applied 0. Raw SHA256:
  `e2db35aeff050feacc81a0153550c1854122f49973593841f905bdfcb0384e00`,
  `947b793f3c91f8d185998d7a584aa81c87b391ec8f27d76e11cadbe2154f7847`.
- Restored schema: 1,809 public tables before; the authorized migration added
  exactly two tables; 1,811 after. First `--only` run applied 1, second applied 0. Catalog readback proves both tables, `assignment_sequence integer`, and
  migration status `success`. Raw SHA256:
  `cb9dc357d07010e0969e76ffe696cae0451109fc2d71e6c6e16fe6e94ab55513`,
  `2bc5e5665794c6909cbed3e9dcb8a219725666d10aa70b1a92f71200e9379ef9`,
  `1a14545aef8c2b5aac65c45373098db1569cfa4e22598b4f9fc96c0c0625b8a3`.
- Actual cascade check removes organization, users, session, questions,
  commands and decisions with zero readback; raw SHA256
  `29575212f18aa27a57847f39839c542805ca9f15d4925ddd230717daee96056d`.

## Behavioral GREEN

### Focused unit and mounted routes

Command:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx vitest run \
  server/src/services/interview/__tests__/interviewAnswerApprovalPolicy.test.ts \
  server/src/services/interview/__tests__/interviewAnswerDecisionMigration.test.ts \
  server/src/services/interview/__tests__/interviewAnswerDecisionService.test.ts \
  server/src/routes/v8/__tests__/interview.routes.test.ts \
  tests/unit/backend/controllers/InterviewAssignmentsController.test.ts \
  tests/unit/services/v8-interview-api.test.ts \
  --reporter=json --outputFile=FOCUSED_GREEN.json
```

Result: 18/18 suites, 151/151 tests PASS, exit 0. Raw SHA256
`86e00961df7387efc48933dab67bdb74076598a2eabcccc6d77bf933d1a46533`.
An earlier same-denominator run had one unrelated `socket hang up` in the report
pack export test and is intentionally not included as GREEN.

### Real PostgreSQL service and race denominator

With `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, against the isolated
restored PG18 database:

```sh
npx vitest run \
  server/src/services/interview/__tests__/interviewAnswerDecisionService.realpg.test.ts \
  server/src/services/interview/__tests__/interviewAnswerDecisionEvidenceRace.realpg.test.ts \
  --reporter=json --outputFile=REALPG_SERVICE_RACE_GREEN.json
```

Result: 4/4 suites, 15/15 tests PASS, exit 0. Raw SHA256
`236fe5bc44a0d5dc4e80335abe032cf6190325d7453dfea632e6160af147d152`.
This proves server-derived required/optional denominator, frozen policy,
per-question isolation, actor/provenance refusal, selective resubmission,
concurrent replay, cascade deletion, evidence create/delete serialization,
actual submit-before-PATCH lock ordering, and approved-sibling answer/evidence
mutation refusal. It additionally proves both evidence/decision acquisition
orders without deadlock, manager-decision/answer and returned-answer/manager
serialization in both directions, null/broken/multi-assignment fail-closed
behavior, and a real PostgreSQL rollback where a late lifecycle failure leaves
zero AI decision receipts and the HTTP result pending. Every fixture tenant is
read back as zero after cleanup.

### Signed JWT, real ApiGateway and PostgreSQL

```sh
npx vitest run \
  server/src/routes/v8/__tests__/interviewAnswerApproval.gateway.pg.test.ts \
  --reporter=json --outputFile=SIGNED_GATEWAY_PG_GREEN.json
```

Result: 2/2 suites, 3/3 tests PASS, exit 0. Raw SHA256
`c0b8c79d22db6c747d4510d077655fb68064d56c6a47f9cec6f07303f2f73a76`.
The test disables auth bypass, signs manager/respondent JWTs using the runtime
configuration, initializes actual ApiGateway routes and the global error
handler, then proves respondent-redacted GET, named 409 and zero mutation for
legacy blanket send-back, manager decision persistence and cold read. Cleanup readback is zero for commands, decisions, assignments and users.

### Language and locale contract

- The staged J0 language ratchet passes. The full measurement is Interview
  K5en 50 against baseline 51 and repository K5en 1821 against baseline 1822.
  Raw SHA256:
  `84bc82461aa93ad87a9a1004810d484e8aca73c5bccf26b27c7e2881ccdf68f3`.
- The shipped EN/PL content guard passes 3/3 tests and both catalogs resolve
  `interview.workspace.aiAnswerReviewUnavailable`. Raw SHA256:
  `2b95b0bbe9d576edcfc9b802acf7ac2749079bf98eecf441f9fa6716934cc2d4`.
- The affected controller is part of the 151/151 focused denominator; its
  tests assert the exact `messageKey` for required-missing and AI-unavailable
  responses.

## Static gates

- Server TypeScript: exit 0, npm command log SHA256
  `965c1762debc8c5a9482570ec9a9a0d6506d4b361f279ce4cb715810e8c3708d`.
- Scoped Prettier: exit 0, raw SHA256
  `17aa973d3f004560237d9a95171210b0671deff23d61628eecf7322ff5938f20`.
- Scoped ESLint: exit 0; existing warnings remain in large inherited files, no
  errors. Raw SHA256
  `d66db90bced5d53d0e6e18c742eb0dd5705bcdc6b511753ec928027b543b1a91`.
- `git diff --check`: exit 0, empty log SHA256
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Limits

This is a backend freeze for independent review. It does not claim the C-UI
policy selector, respondent status UI, manager per-answer controls, deployment,
staging execution or release acceptance. AI provider availability is explicit:
a missing provider/provenance leaves exact answer stages pending and the
retry route is the recovery path; it never creates an approval receipt.
