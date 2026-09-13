# E1a integrated built navigation review

Integration: `8991ceb703dc0d466eb3a96e096f053a5eeb14f1`. Full staged integration hooks passed. Integrated targeted tests: 30/30. Frontend tsc remains 192 diagnostics, unchanged file/code counts; not a clean typecheck. Build passed with 8 GiB Node heap.

Actual built preview 5292 and actual ApiGateway 5293: Reports → browser Back to Work/resources → Forward to Reports → Reports after loading, four checkpoints passed. Four Menu2 entries unique. Filters, selection, return context and hash preserved. Domain surfaces were not mocked. Final screenshot inspected.

No page errors. Seven HTTP403 responses remain (organization members and six manager lanes); these are unresolved access responses, not acceptance of those functions. Two voice-event telemetry POSTs occurred; no business mutation was exercised. This proves navigation only, not full Reports functionality or E1b-d. No deployment.

Raw: `codex4-scratch/ie01-rc2-runtime-20260913/e1a-built-navigation-v3/result.json`; screenshot `reports-after-forward.png`. Earlier v1 locator ambiguity and v2 loading screenshot retained.

Served and local dist/index.html SHA256: `2d17b133a2d11819aa690eb3d22dbfff11cc29f3c48bf4e1bfef696ed28c1427`.
