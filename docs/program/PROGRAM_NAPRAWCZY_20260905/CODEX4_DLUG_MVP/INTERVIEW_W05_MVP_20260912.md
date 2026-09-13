# Interview W05 — bounded MVP manager review

Status: AUTHOR ACCEPTANCE PASS for the scope below; independent acceptance pending. This is not a release, deployment, or full Interview/RBAC acceptance.

Base: `1db4da480664276c727e6b7bef905eea1b5086cf`, branch `codex/dlug-mvp-20260912`, clean before intake. Mandate: owner's 12.09 Interview MVP clarification, integrator W05, recorded by integrator as `DEC-2026091201`; marker `[ODMROZENIE 02_INTERVIEW DEC-2026091201]`. Read CLAUDE, SOURCE_OF_TRUTH, current Interview contract/security/behavior, assistance draft, applicable artefact/triada skills. Existing single-question workspace exception and manager process retained.

## Delivered

| Gap | Change | Evidence |
|---|---|---|
| Submitted respondent remained editable | Submitted/completed session and submitted/approved/completed assignment lock content; assignment with unresolved status also locks. Write callbacks respect the lock. | Workspace behavior test, browser submitted read-only, real versioned question PATCH 409 with unchanged answer. |
| Card result did not synchronize assignment lists | Workspace publishes the canonical assignment response for submit/return/approve; Hub merges it into existing my/managed/overdue state. Session callback remains separate. | Mounted Hub row changes to Approved without refetch or session callback; removing callback is RED, restoring GREEN. Browser Sessions counters update without reload, Assigned readback Approved. |
| Successful empty managed list lost respondent feedback | Read own assignment first; absent record or failed own-list read falls back to existing protected detail reader. Failed detail does not manufacture assignment status. Reuse existing manager feedback Callout in default question workspace. | Empty list and own-list 403 unit cases; real respondent sees exact manager reason after return. |
| ownerId was used as reviewer authority | Existing `useInterviewPermissions.canViewManaged` capability gates submitted review, including handler guards. Authorship is no longer authority. | Non-manager other-owner negative, manager same-owner positive unit cases; actual ADMIN review succeeds and actual respondent approve/send-back return 403. |

No backend lifecycle, approval threshold, AI gate, flags, E4 scripts, schema, or new process changed.

## One-record real acceptance

Local API Gateway with real authentication/JWT on `127.0.0.1:4214`; database identity `127.0.0.1:6455/cx4_pilot`; Vite `127.0.0.1:5214`. Existing API was verified and reused, not restarted. Only a new synthetic tenant, ADMIN/MEMBER accounts, template, assignment/session/question were seeded. No new database/full restore, foreign runtime, live system, push, or external mutation.

- Assignment `6cbeffa7-a324-4f32-96c5-f8dde96dee71`.
- Session `86371aec-9cf5-4a7e-8546-8c0c682792f1`.
- Question `b8dd9f10-49b8-44d5-b996-ca4c3e7cd94c`.

The same record followed: respondent answer v1 → browser submit → submitted/read-only reload → manager sends back “Please add the measured transport cost and the observation period.” → in_progress/active → respondent sees reason and writes v2 with August 2026/EUR 4800 → browser resubmit → manager approve → approved/completed → reload by both roles with v2 intact.

PG history contains v1/submission, v1/send_back, v2/submission. Decision memory contains send_back and approve by the manager. No lifecycle reset was used. Negative calls through the real browser Api service: respondent approve 403, send-back 403, closed answer PATCH with current CAS token 409; subsequent readback remains approved/completed with v2.

Evidence: `evidence/interview-mvp-20260912/`. `cycle-evidence.json` retains chronological readbacks, request statuses, final PASS markers and failed harness attempts; it contains no credentials. PNG 02–13 show the actual record, submitted lock, return feedback, lists, approval/reloads and dark theme. Images reviewed at 1440×900: no white/crash/overlap regression; existing compact table truncation remains. Dark confirmation used actual store theme and asserted html.dark. No claim of a complete triada/module audit.

## Tests and boundaries

- Initial Workspace behavior RED 4/4; additional feedback RED 1/4, protected-detail fallback RED 1/7.
- Hub callback mutation RED 1/1; restore → final 23/23 across five test files.
- Per-file esbuild of Workspace and Hub PASS. Full frontend tsc/build was not run (coordinated resource restriction).
- Browser pageerror count 0. This is **not zero HTTP errors**: MEMBER's existing unconditional Insights fetch returns 403 before and after this fix. Negative permission probes intentionally return 403/409.
- Rejected harness attempts: wrong visible/accessibility button names, missing review-screen Submit step, onboarding overlay, CAS token omitted (428), tab locator and theme setter/navigation reset. They did not reset the record; final lifecycle was completed on that record. Original attempts remain in scratch; chronological evidence retains failures rather than hiding them.
- Scoped project-manager authorization is **not proven** by this bounded ADMIN/MEMBER acceptance. Existing hook collapses scoped capability suffixes into canAssign and organization scope; current backend permission policy was not changed. Independent reviewer will record the project A/B finding separately. Do not interpret this patch as scoped RBAC remediation.
- Notifications/provider delivery, multi-question/voice/AI-assistance overhaul, fresh staging behavior, and general Interview backlog are outside this acceptance.

## Independent handoff

Private scratch: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/interview-mvp`. `private-state.json` contains credentials: do not print, commit, or copy to public evidence. Existing record is terminal; use a fresh reviewer-owned assignment/session for an independent full cycle, not an UPDATE resetting this record.

`cycle-final.mjs` is the corrected full-cycle harness assembled from the exercised steps, syntax-checked; it was not rerun from scratch against a new record. It requires `--state=/absolute/private-state.json --out=/absolute/reviewer-evidence` and refuses a non-in_progress assignment. It calls real login and browser UI, preserves PG snapshots, and never bypasses lifecycle. Inspect before execution. `final-inspection.mjs` records readback, negative permissions and theme checks on the existing terminal record. API4214 and Vite5214 remain available for the reviewer; do not restart unknown processes.

Unit command:

```sh
npx vitest run src/components/Interview/__tests__/InterviewHub.assignmentReview.behavior.test.tsx src/components/Interview/__tests__/InterviewWorkspace.managerReview.behavior.test.tsx src/components/Interview/__tests__/InterviewWorkspace.progress.test.ts src/components/Interview/__tests__/InterviewApprovalLifecycle.ownerContract.test.ts src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx --maxWorkers=1 --no-file-parallelism
```
