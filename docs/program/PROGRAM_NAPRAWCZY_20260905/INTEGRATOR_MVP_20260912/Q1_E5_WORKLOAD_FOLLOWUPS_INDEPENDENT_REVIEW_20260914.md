# Q1 E5 workload follow-ups — independent exact-SHA review

**Verdict: ACCEPT.** Exact freeze `f05fabae662895762d13c13fa8e558c0eae47d2b` closes the three W44 follow-ups on base `eba9d72ad9c730728b212ee7826164519e4d095c` without a new regression, migration, or scope growth into W48.

## Reviewed identities

- Base: `eba9d72ad9c730728b212ee7826164519e4d095c`
- Implementation: `2ee7647197afd2234a0fab432b2a5b6e5f7d523d`
- Manifest content: `6a8d542515c40723af0825c8afa81d0a6f1b460d`
- Exact freeze: `f05fabae662895762d13c13fa8e558c0eae47d2b`

## Findings

1. `WORKLOAD_CAPACITY` is additionally gated by the strict `VITE_INITIATIVES_WORKLOAD === 'true'` check. The fresh component test proves that Work report ON plus Workload OFF hides the option and that both flags ON expose it.
2. The proposal contract returns the fixed `reasonKey` plus numeric `params`; no server-authored user-visible explanation remains in that contract. The client resolves the key through i18n and fresh tests prove the EN and PL text.
3. The z30 comment no longer contains the static-guard `(import.meta.env)` false-positive. Runtime behavior in that harness was not expanded.

No P1 or P2 finding remains.

## Independent evidence

- Fresh targeted tests: `InitiativeWorkReportView.kanon.test.tsx` **7/7**, `InitiativeWorkloadSurface.test.tsx` **7/7**.
- Fresh PostgreSQL with `MOCK_DB=false`: Gateway/ApiGateway/JWT **2/2**, overdue resource-plan sibling **1/1**; both files were collected and no test was skipped. Database identity was `127.0.0.1:5291/consultify_q1_e5`.
- Fresh server TypeScript with 8 GiB heap: exit **0**. Fresh candidate front TypeScript: **189** diagnostics, **0** in the three changed front files; this matches the recorded exact-base count **189**.
- The author importer inventory covers **26** files and **133 passing tests**. Its six red files were classified with the same outcome on exact base and candidate: three route-v8 import failures caused by the inherited `validateOrgMembership` mock gap, `executionResourcePlan` 6/10 red, INI-005 1/15 red on the inherited canonical-status constraint, and D4b setup red on inherited `is_active='false'`. The named red test files and the fresh overdue sibling are unchanged from base; Q1 E5 adds **0** red files.
- Recorded gates reviewed: production build exit **0** (10,746 modules), canon **349/349**, artifact **8/0/117**, translation-content **5/5**, duplicate keys EN **0** / PL **0**, static Vite flag guard **0/178**, per-file esbuild PASS, clean diff-check, and no added conflict marker.

## Manifest and visual review

The self-excluding manifest contains **25/25** exact Git blobs from content commit `6a8d542515`; every byte count and SHA-256 was independently recomputed. Evidence is exactly **706,681 B**, including the 5,364 B manifest.

The two tracked receipts cover **12/12** full `InitiativesHub` captures at 1440x900 with `errors=0`: OFF, ON, and localized reason states in EN/PL and light/dark. Visual inspection confirms the workload option is absent when OFF, selected when ON, and the proposal reason is rendered in the selected language.

The feature remains default OFF, no SQL or migration was added, and the delta contains no W48 language-package scope.
