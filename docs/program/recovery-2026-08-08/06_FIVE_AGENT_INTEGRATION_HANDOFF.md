# Five-agent recovery — integration handoff

Date: 2026-08-08  
Owner: Codex / shared-file integrator  
Integration branch: `codex/recovery-integration-20260808`

## Executive status

All five recovery tracks finished their bounded reconstruction and pushed their branches to GitHub. Their work is merged into the integration branch. No deployment, database mutation, or merge to `demo` was performed.

The integration candidate is **READY_FOR_BACKEND_TYPE_REMEDIATION**, not release-ready. The independent cross-track test gate is green, while the full server TypeScript gate remains red and therefore blocks promotion to staging/demo.

## Immutable recovery points

- Pre-recovery snapshot: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-snapshots/2026-08-08_181821_five-agent-stop`
- Snapshot verification: SHA manifest PASS
- Integration branch is pushed to GitHub after every shared-file correction.

## Track results

| Track | Branch | Accepted SHA | Scope/gate | Independent result |
|---|---|---:|---|---|
| Agent V8 | `codex/recovery-agent-v8-20260808` | `fb0146253b465be699079372721fc437edeab066` | clean, remote-equal, ownership PASS | shared Agent Hub dependency restored by integrator; navigation 5/5 PASS |
| Documents | `codex/recovery-documents-20260808` | `0f9f98cfc39fda402345ae7154abdd28ea60bbea` | clean, remote-equal, ownership PASS | presentation integration dependencies resolved |
| Finance | `codex/recovery-finance-20260808` | `93e7d66cc94ccb97332b03bd55311dca2ef42d69` | clean, remote-equal, 13/13 scope PASS | finance targeted tests included in common green gate |
| UX table | `codex/recovery-ux-table-20260808` | `0e17735b3f80ce19b27b25fe532953f38d31fd50` | clean, remote-equal, 107/107 scope PASS | seven shared-dependency files retested: 57/57 PASS |
| UX tools | `codex/recovery-ux-tools-20260808` | `c6878103b4d43563bc1adbf6f885990340dc52e4` | clean, remote-equal, 6/6 scope PASS | 24/24 focused tests PASS |

## Independent integration gate

The final cross-track selection covered Agent navigation and transaction ownership, Documents presentation persistence, Finance units/formatting, UX-table accessibility/read-side parity, and UX-tools assessment surfaces.

Result: **18 test files PASS, 110 tests PASS**.

Additional shared-file corrections accepted by the integrator:

- governed Agent Hub routing and canonical Case/Run URL state;
- shared EN/PL accessibility vocabulary and My Work read-side route;
- durable workbook rehydration and preview action ARIA contract;
- Artifact Registry donated-transaction pinning.

Repository guards passed for every integration commit: diff check, UI canon ratchets and focus-debt ratchet. Existing focus debt did not increase.

## Blocking gate

`npm --prefix server run typecheck` is **FAIL**. The errors span the reconstructed V8/Documents backend, including strict-null contracts, proof scripts, request-file narrowing, missing shared exports, and transformation lifecycle types. This is not waived by the green targeted tests.

Examples from the current gate:

- `server/src/controllers/OrganizationController.ts` — optional string passed as required;
- `server/src/routes/document-studio.routes.ts` — missing `removeTemplateArtifactByOrigin` export;
- `server/src/routes/documents.routes.ts` — `req.file` possibly undefined;
- `server/src/services/v8/transformationCaseService.ts` — repeated null/undefined contract mismatches;
- `server/src/services/v8/transformationProjectTeamService.ts` — nullable identifier mismatch.

Full compiler output from the latest verification was captured locally at `/tmp/consultify-integration-server-typecheck.log` and must be reproduced from the integration SHA before remediation.

## Safe continuation protocol

1. Start new work only from `origin/codex/recovery-integration-20260808`; never from the quarantined worktrees.
2. Assign one backend type-remediation owner and one independent reviewer. Do not reopen all five tracks concurrently.
3. Freeze shared files during remediation; changes to shared files go through the integration owner.
4. Require: server typecheck PASS, root typecheck PASS, the 110-test cross-track gate PASS, then broader affected suites.
5. Only after those gates pass may a separate release owner compare the candidate with current `origin/demo`, resolve drift, and run staging/runtime/realDB verification.
6. No direct push or merge to `demo`; use a reviewed PR from the integration branch or its linear successor.

## Promotion decision

- Recovery and preservation: **GO**
- Five bounded agent tracks: **COMPLETE**
- GitHub backup: **GO**
- Integration test candidate: **GO**
- Backend compile gate: **NO-GO**
- Merge to `demo` / staging deploy: **NO-GO until backend gate and runtime evidence pass**
