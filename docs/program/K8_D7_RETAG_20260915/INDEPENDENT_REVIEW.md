# W73 K8 — independent skeptical review

**ACCEPT.** Commit `a858a3950e7a9d9c6a177d61b21a51e0e56da83f` implements the D7 decision without inventing data and leaves S1.11 as a non-destructive CTO-only tag proposal.

## Reviewed identity

- Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Product commit: `c970168a9c` (three files).
- Freeze candidate: `a858a3950e7a9d9c6a177d61b21a51e0e56da83f`.
- Candidate backup reviewed: `origin/backup/codex/d-k8-d7-retag-20260915` at the exact freeze SHA.
- Scope delta contains three product/test files, three K8 documents and evidence only. It contains zero migrations and zero forbidden files (`DrdHttpMethodWorkspaceScreen.tsx`, `languagePolicy.ts`, `Dockerfile.api`). No added line contains `as any`.

## D7 data-source audit

- `GET /api/method/sessions` is built from `MethodSessionService.listForOrganization()` and adds only `hasFrozenOutput`. `MethodSessionListItem` is correspondingly `MethodSession + hasFrozenOutput`; it has no business unit, aggregate score or aggregate confidence.
- `MethodOutputSummary` contains `scope`, current/target/gap maps, limitations and findings. Its finding summary exposes per-unit levels and gaps, but neither the summary nor a session-list row exposes the three requested aggregate list values. The server's richer finding record has a per-finding categorical confidence; that is not an aggregate session confidence and cannot honestly populate the removed column.
- Before K8, `methodSessionToAssessment()` copied `business_unit`, `overall_score` and `confidence_avg` from a legacy assessment joined only on `projectId`. That compatibility mapping still serves preview/name behavior, but the Processes table no longer presents those values as Method Core Output facts.
- `AssessmentLibraryTab` uses its own `StandardTable`. Its column set is Methodology, Area, hidden Description/Questions/Duration, Status, hidden Last used and Actions. BUSINESS UNIT / SCORE / CONFIDENCE were never present there, so K8 correctly makes no Library product edit.
- The Processes column set is now Assessment name, Status, Owner and Updated, with Type and Progress available but hidden by default. The removed trio is absent for both locales and there is no replacement placeholder column.

## Behavior and browser proof

- Independent focused rerun: **8/8 PASS** across `AssessmentHub.columnsFromApprovedImage.test.tsx` and `AssessmentHub.method-core-cutover.test.tsx`, `--retry=0`.
- Recorded importer comparison is internally consistent: candidate **45 PASS / 8 FAIL**, exact-base source plus candidate tests **43 PASS / 10 FAIL**. A failure-name comparison shows exactly the two D7 assertions move RED to GREEN; the remaining eight failure names are identical existing five-surface/smoke debt.
- Both screenshots were visually inspected. They mount the shipped `AssessmentHub initialTab="processes"` through the existing `assessment-list` product harness, use the same six-row screen in EN and PL light, and show only the four supported headers. The harness substitutes API responses but does not use a showcase branch inside `AssessmentHub`.
- The EN/PL header JSON matches the images; both runtime logs report zero console errors and zero HTTP responses at or above 400. The images are 77,105 and 79,267 bytes, below 2 MB.

## Gates and manifest

- `sha256sum -c MANIFEST.sha256`: **21/21 OK**, including product sources, screenshots, logs and S1.11 proposal.
- Independently repeated: server TSC RC 0; language ratchet GREEN (K4en -68, K7 -1); list canon GREEN at 349/349; artifact gate GREEN at 8 / 0 / 117.
- Candidate evidence records front TSC **177**, exact-base source **177**, and `--listFilesOnly` RC 0 with 7,427 files. An independent front TSC rerun was resource-contended: the first attempt exited 134 and a later attempt was stopped after more than 90 seconds on the parent integrator's instruction. This does not replace or contradict the hash-verified candidate/base logs; it is not represented as an additional passing run.
- Candidate build RC 0 (10,754 transformed modules), focused esbuild RC 0, server TSC RC 0. Each candidate commit changes at most six files, within the seven-file limit.

## S1.11 tag safety

- All listed evidence images exist in the CTO evidence directories: five W70 images, four F4 images and three E2b images.
- Git objects `bb6735d713cdda8ed42e643a6b22ec38cdaa78df`, `652e3c458c83539b48f8b080defaa24ba888374e` and `8767bbdd58f9f76d66e3556c4af249a3c2a70d8e` resolve. Both earlier SHAs are ancestors of `8767bbdd58...`.
- The proposal uses an annotated tag at full SHA `8767bbdd58f9f76d66e3556c4af249a3c2a70d8e`, followed by a normal `git push origin refs/tags/demo-safe-20260915`; it has no force or overwrite operation.
- `demo-safe-20260915` is absent locally and on origin at review time. No candidate code or script executes `git tag` or a tag push; the commands occur only in the proposal document. CTO remains the executor.

## Residual limits

- K8 deliberately does not implement Z-63 / DEC-513 session naming because that dependency is absent from the requested exact base. This does not invalidate the independent D7 column decision, but integration must preserve the later accepted Z-63 implementation when K8 is moved to the current line.
- The browser proof is real component render with deterministic mocked network data, not a RealPG or staging readback. W73 K8 requested a real AssessmentHub screenshot and focused behavior/importer evidence; it did not require RealPG for this presentation-only deletion.
