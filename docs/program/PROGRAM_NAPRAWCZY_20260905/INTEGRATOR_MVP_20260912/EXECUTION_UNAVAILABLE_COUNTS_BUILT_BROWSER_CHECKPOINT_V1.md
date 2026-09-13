# Execution unavailable counts — built-browser checkpoint

- Status: `PASS_WITH_REACHABILITY_QUALIFICATION`.
- Integrated source commit: `42e7fc215b30ed285743d2367620361cb7bfb445`.
- Current root HEAD is docs-only beyond source: `3aa0d3b3091a3c2897375be9ebd21c7cb1096049`.
- Built `dist/index.html` SHA-256: `11398cf01198f177425ca96068102b78fbc2042b31a23229130dfaec2f0a9b3f`.
- Runtime: preview `127.0.0.1:5292`, API `127.0.0.1:5293`, PostgreSQL `cx8_e0@127.0.0.1:6459`, container `bd644c57cb4c9f8626855da09a587e2897d5d5a07da97012d8897886aceac02c`.
- Existing MEMBER session and existing fixture were read; no new fixture was created. Browser POST/PUT/PATCH/DELETE requests were aborted by the harness.

## Measured behavior

- Execution Bank: zero `/api/v8/execution-control/manager/lanes/*/problems` requests after settle.
- MEMBER: zero `/api/organizations/:organizationId/members` requests throughout Bank and Manager checks.
- Historical Manager surface: six real Gateway lane requests, six HTTP 403 responses, all six visible totals read `Unavailable`, the `Manager data unavailable` warning was visible, and Playwright observed zero page errors.

## Reachability qualification

`people_change` is absent from canonical Menu 2 and the accepted deep-link resolver. The harness used a narrowly recorded dispatch of the existing `ExecutionHub` state hook in the exact built bundle to mount that existing surface. This proves the built component and real Gateway-denial behavior; it does not prove user reachability or a full Execution flow.

## Evidence

- Runner: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/verify-execution-unavailable-built-v2.mjs`
- Raw result: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/execution-unavailable-built-v2/result.json`
- Raw log: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/execution-unavailable-built-v2.log`
- Bank screenshot: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/execution-unavailable-built-v2/bank.png`
- Manager screenshot: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/ie01-rc2-runtime-20260913/execution-unavailable-built-v2/manager-unavailable.png`
- Exact source and artifact hashes: `/Users/piotrwisniewski/Developer/consultify-handoff-docs/integrator-20260912/EXECUTION_UNAVAILABLE_COUNTS_BUILT_BROWSER_MANIFEST_V1.json`
