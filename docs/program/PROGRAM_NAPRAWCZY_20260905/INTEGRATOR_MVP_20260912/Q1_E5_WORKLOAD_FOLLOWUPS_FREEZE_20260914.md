# Q1 E5 workload follow-ups — freeze receipt

**Verdict: READY_FOR_INDEPENDENT_REVIEW.** The three W44 follow-ups are implemented on exact base `eba9d72ad9c730728b212ee7826164519e4d095c`; there are no new red sibling tests, no migration, and review has not started.

## Scope delivered

1. `WORKLOAD_CAPACITY` is offered by the Work report creator only when `VITE_INITIATIVES_WORKLOAD=true`; `WORK_REPORT=true` + `WORKLOAD=false` preserves the rest of the creator while hiding that option.
2. Workload proposals carry `reasonKey` and numeric `params` only. The client renders the reason through EN-first i18n with a separate PL translation; the API no longer returns the English explanation as server text.
3. The z30 comment describes Vite variables without the static-guard false-positive pattern. Runtime code is unchanged.

## Tests and runtime proof

- Changed tests: Work report canon **7/7**, Workload surface **7/7**, ApiGateway/JWT/RealPG workload **2/2** with `MOCK_DB=false`.
- Flag sibling: InitiativesHub Work report flag **4/4**.
- W47 importer inventory: **24** sibling files, plus the changed Gateway file and the flag sibling. Candidate total: **133 passing tests** across 26 files; 6 red files were rerun at exact base and were byte-for-byte equivalent in outcome, so **0 new reds**.
- Base-equal reds: three v8 route suites fail during import on a missing `validateOrgMembership` mock; `executionResourcePlan.test.ts` is 6 failed / 4 passed; INI-005 RealPG is 1 failed / 14 passed on the canonical status constraint; D4b RealPG fails setup on its legacy `is_active='false'` fixture. No assertion or production code in those families was changed by Q1 E5.
- RealPG used only `cx-q1-e5-pg` on `127.0.0.1:5291/consultify_q1_e5`; strict migrations completed **916/916**. The changed Gateway suite collected and passed **2/2** with no skip. The overdue resource-plan sibling collected and passed **1/1** with no skip.

## Static and build gates

- Server TypeScript, heap 8 GiB: exit **0**.
- Front TypeScript, heap 8 GiB: base **189**, candidate **189**; no changed-file errors.
- Production build, heap 8 GiB, no pipe: exit **0**, 10,746 modules.
- List canon: **349**, baseline 349, exit 0.
- Artifact gate: crimson **8**, card-N **0**, danger **117**, exit 0.
- Language baseline: no growth. Translation-content gate **5/5**, duplicate keys **EN 0 / PL 0**.
- Static Vite flag guard: **0** violations in 178 files.
- Per-file esbuild: all changed TS/TSX files passed (the Gateway test used transform mode because the repository's `Gateway.js` compatibility shim is not bundle-compatible).
- `git diff --check`: clean. Added conflict markers: 0.

## Visual evidence

`evidence/q1-e5-workload-followups/ui/` contains 12 full `InitiativesHub` screenshots and machine-readable receipts, **708 KiB** total:

- flag OFF: EN/PL, light/dark, option absent (4);
- flag ON: EN/PL, light/dark, `WORKLOAD_CAPACITY` selected (4);
- localized proposal reason: EN/PL, light/dark (4).

Both receipts report `errors=0`. Screens were captured from locally built Vite harnesses on ports 4216/4217; no staging or demo runtime was used.

## Freeze identities

- Exact base: `eba9d72ad9c730728b212ee7826164519e4d095c`
- Content commit: `2ee7647197afd2234a0fab432b2a5b6e5f7d523d`
- Backup ref: `backup/codex/q1-e5-workload-followups-20260914`
- Freeze manifest: `evidence/q1-e5-workload-followups/freeze-manifest.json` (self-excluding; generated after this receipt commit)

STOP before independent review as required by W46/W47.
