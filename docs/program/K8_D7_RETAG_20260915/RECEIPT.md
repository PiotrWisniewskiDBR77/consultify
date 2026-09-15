# K8 D7 + S1.11 — E1 receipt

**E1 READY FOR INDEPENDENT REVIEW.** D7 removes three columns that have no canonical Method Core Output source; S1.11 contains only a verified re-tag proposal and no tag operation.

## Identity and scope

- Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Product commit: `c970168a9c` (3 files, within the seven-file package limit).
- S1.11 proposal commit: `65cc4792bd`.
- UI evidence commit: `9e7c494f43` (6 files).
- Static evidence commit: `e391adb349` (6 files).
- Comparison evidence commit: `83ecb571e4` (5 files).
- Branch: `codex/d-k8-d7-retag-20260915`.
- Exact backup target: `origin/backup/codex/d-k8-d7-retag-20260915`.

Z-63 / DEC-513 implementation is not present on the requested exact base. The base contains only the earlier STOP project. K8 does not invent or duplicate that migration: this package changes only the independent D7 list decision and the S1.11 proposal.

## D7 behavior decision

Measured sources:

- `GET /api/method/sessions` returns each Method Session plus `hasFrozenOutput`.
- `MethodOutputSummary` carries scope, current/target/gap maps, limitations and findings. It has no business unit, aggregate score or confidence field.
- The pre-change Processes projection borrowed `business_unit`, `overall_score` and `confidence_avg` from a legacy assessment matched only by `projectId`; canonical sessions without such a twin displayed em dashes.
- The separate methodology Library table never had BUSINESS UNIT / SCORE / CONFIDENCE columns.

Result: the Processes list no longer exposes BUSINESS UNIT / SCORE / CONFIDENCE. It keeps Assessment name, Status, Owner and Updated. Compatibility fields remain available to non-list preview code, but the list does not present them as canonical Output facts.

## Behavior and importer evidence

- Focused candidate: **8/8 PASS** across `AssessmentHub.columnsFromApprovedImage` and `AssessmentHub.method-core-cutover`.
- Importer set, candidate: **45 PASS / 8 FAIL**, 14 files.
- The same candidate tests with exact-base `AssessmentHub.tsx`: **43 PASS / 10 FAIL**.
- Delta: exactly two D7 assertions move RED to GREEN. The other eight failing test names are identical and are pre-existing five-surfaces/smoke debt.
- Raw logs: `evidence/k8-d7-retag-w73/importers-candidate.log` and `importers-base-with-candidate-tests.log`.

## UI evidence

The same real `AssessmentHub initialTab="processes"` was mounted through its existing product harness:

- EN light: `processes-en-light.png`; headers are Assessment name / Status / Owner / Updated.
- PL light: `processes-pl-light.png`; headers are Nazwa oceny / Status / Właściciel / Aktualizacja.
- Both captures: forbidden trio absent, console errors 0, HTTP responses >=400 = 0.
- Screenshots are 77,105 and 79,267 bytes, below the 2 MB package limit.

## Full gate

- Front TSC: candidate **177**, exact-base source **177**; W73 threshold `<=177` preserved.
- `tsc --listFilesOnly`: RC 0, **7427** files.
- Server TSC: RC 0, no output.
- Build: RC 0, 10,754 transformed modules.
- Focused esbuild: RC 0.
- Language ratchet: GREEN; K4en -68, K7 -1.
- List canon: GREEN, **349**, baseline 349.
- Artifact gate: GREEN, **8 / 0 / 117** unchanged.
- New `as any`: 0.
- Migrations: 0.
- Forbidden files (`DrdHttpMethodWorkspaceScreen.tsx`, `languagePolicy.ts`, `Dockerfile.api`): 0.
- Product UI uses the existing StandardTable path; no custom table and no new crimson/primary semantic styling.
- Nested `.k8-base`: removed before freeze and confirmed absent. Vite process stopped.

## S1.11

`S1_11_RETAG_PROPOSAL.md` lists the five W70 images at `bb6735d713`, F4 at `652e3c458c`, and E2b at `8767bbdd58`. Git ancestry confirms `8767bbdd58` contains the two earlier accepted line SHAs. The proposed command targets full SHA `8767bbdd58f9f76d66e3556c4af249a3c2a70d8e`.

No local or remote `demo-safe-20260915` tag existed at measurement time. Codex did not create or push a tag.

## Review boundary

This is an E1 freeze candidate. Integration and tag execution remain with CTO. Independent review must verify the data-source conclusion, the absence of the three columns in both locales, the candidate/base failure-name delta, exact manifest hashes and the non-existence of a tag operation in this branch.
