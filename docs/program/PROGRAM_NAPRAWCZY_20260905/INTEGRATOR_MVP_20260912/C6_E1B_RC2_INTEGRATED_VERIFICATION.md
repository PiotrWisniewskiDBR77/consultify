# C6 and E1b integrated verification — 2026-09-13

Current source HEAD:27da10f07d15c78f0eabea8754da4d7d69e9d0bd. C6 receipt packet integratedf07849ec5a; actual Gateway timestamp repair31084b34d1be3b12bb174e623155bca45511572b. E1b integratedfee4f8eaec73156fdec1b9945d435265613b6883, calendar type repaira743a96c6302b6e81d030168e0c3cc687eaa1fee, final physical axis repair27da10f07d15c78f0eabea8754da4d7d69e9d0bd. All source commits used normal hooks; final root tree clean before this report.

## Integrated source and checks

- C6 integrated eight-file suite103/103 PASS; E1b integrated nine-file suite44/44 PASS. These are separate scoped denominators, not whole MVP acceptance.
- Initial frontend check194vs192 found two new TS18047 diagnostics. Independent source review accepted capture of KNOWN date before callback; affected renderer3/3PASS. Final8GBfrontendcheck192vs192, no added or removed file/code diagnostics. This remains an existing failing typecheck, not a clean frontend.
- Fullservertsc passed before and after the actual C6 pointer timestamp repair. Final log C6_E1B_RC2_SERVER_TSC_TIMESTAMP_FIX.log exit0.
- Full8GBfrontendbuild V2 exit0. Served indexSHA256:1a21270ca74dfa8735483e69f7bfe6d56a89527863c52499f52121beb63ecddb. Build occurred before final metadata-only commit creation on the tested source files; index identity and source blobs are authoritative.

## Actual built Bank verification

Existing local API5293/cx8 and preview5292,1440×900 dark. Two real CLOSED Initiative rows without Execution Cases. Actual table selection has aria-selected=true, same typed native selection persists through Kanban, Calendar, Gantt and reload; five checkpoints PASS. All four renderers preserve the same two native identities and no Case ID is fabricated. No browser page errors.

Built V1 exposed physical Gantt offset missed by jsdom structural checks. V2 instrumented readback showed headerSVG x434,width620 versus all tracks x446,width620. Root added the missing outer gap-3 to match rows; independent source review accepted. Built V3 shows header and every track x446,width620. Original failure/screenshots/geometry retained.

Actual proof: codex4-scratch/ie01-rc2-runtime-20260913/ui-e1b-built-v3/result.json and PNGs; root inspected table and Gantt screenshots. Fourteen GET403 responses remain (organization members and manager-lane reads across initial load/reload); five background telemetry POSTs were observed (voice-event/web-vitals), no business mutation in captured requests. This does not accept those403s, light mode, active Case behavior, rich forecast data or full visual quality. Small Gantt axis text/truncated labels remain a visual-polish follow-up; source/data completeness and whole E1b remain open.

## Actual C6 writer → handoff → export

The first integrated actualGateway/JWT/PostgreSQL attempt failed legitimately: raw naive pointer timestamp became a local Date string, shifting timezone and dropping milliseconds. Repair projects both pointer reads toUTC and serializes finite Dates withtoISOString. Independent actual same-record test passes in bothUTC andChicago: generated Finding+receipt → clientreadback(no invalidation) → Decision handoff(kinddecision) → JSON/CSVbodyALLOW → semanticedit/exactrestore → one permanent invalidation → JSON/CSVbodyDENY. Timestampshift0 withmillisecondsretained. All12freshfixture scopes cleanupzero, catalog/9backendhashesunchanged. Existing4216HTTPportclosedafterruns. See C6_INTEGRATED_POINTER_TIMESTAMP_ACCEPTANCE_20260913.md.

## Next work and runtime identity

Forecast/progress source feed now assigned to Sol in fresh clean codex-execution-bank-evidence-20260913, basea743a96c. Existing Initiative value owner, per-field audit evidence, explicitUNKNOWN, no new schema; reviewer owns adversarialtests. ExportSol audits remainingfullC6/deletiongates. Full16moduleMVP/twocontainers/operational/pilot/deployment requirements remain unchanged and open.

Final API reloaded on same5293 with exact originalcx8/config, PID10375, launcher49441; wrapper run-api-c6-e1b-final.py/logapi-c6-e1b-timestamp-final.log, previouslogsretained. Preview5292PID36259 remains same and serves newdist. No live/push/deploy/defaultflag/schema change.
