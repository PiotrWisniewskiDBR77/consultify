# NFR-PERF-001 — current-source reconciliation

Date: 2026-08-23
Branch: `codex/wave3-16-module-acceptance-20260821`
Qualified product SHA: `bcfb01483a368fb4baa133d35dbc7b56ba6c7857`
Production / Railway mutation: `NOT_AUTHORIZED`

## Final-candidate result

The final repository-owned release denominator was rerun on the exact product
SHA above and passed:

- `RELEASE_30M_50U`, 50 authenticated users, requested `1,800,000 ms`, actual
  `1,800,792 ms`;
- `111,400` requests, `0` errors;
- read p95 `103.897959 ms`, write p95 `98.506333 ms`;
- `8,950/8,950` expected/reconciled writes, `0` loss, `0` duplicates and `0`
  tenant false-successes;
- signed desktop Web Vitals p75: LCP `552 ms`, CLS `0.000236686`, INP `16 ms`;
- signed mobile Web Vitals p75: LCP `436 ms`, CLS `0`, INP `16 ms`;
- generated manifest confirms `credentialsPersisted=false`; independent SHA-256
  readback matched both the report and Web Vitals input hashes.

The disposable PostgreSQL database was removed by the harness; catalog
readback retained only `postgres`. The isolated native cluster was stopped and
moved recoverably to the Trash. Production and Railway were untouched.

Artifacts are preserved under `/private/tmp/nfr-perf-bcfb-final/`. Piotr owner
acceptance and release authorization remain separate gates.

## Earlier reconciliation basis

The complete NFR-owned allowlist is byte-for-byte identical between the last
qualified product SHA `0115b8bb8534b72ac4aa1d7411b60ecff3c30b56` and the
current WIP:

- `steadyLoadGate.ts`;
- `steadyAuthenticatedLoad.ts`;
- `steadyLoadGate.test.ts`;
- `MainLayout.tsx` lazy global-chat loading seam;
- signed desktop/mobile Web Vitals specification.

The current WIP also passed the focused gate evaluator: `1/1` test, including
the deliberate positive-control threshold breach.

## Preserved qualified denominator

The last exact-SHA release qualification recorded:

- 30 minutes and 50 authenticated users;
- 111,422 requests and 0 errors;
- read p95 102.23 ms and write p95 239.83 ms;
- 8,950 expected and 8,950 reconciled write identities;
- 0 lost writes, 0 duplicates and 0 tenant false-successes;
- signed desktop/mobile Web Vitals PASS;
- two deployed 60-minute stability windows PASS;
- production untouched.

Because all NFR-owned production and harness paths remain identical, there is
no evidence of harness or owned-performance-code regression in the current
WIP. This does **not** turn an old exact-SHA load result into a new final-SHA
qualification: unrelated application changes can still affect performance.

## Final-candidate action

After one clean candidate SHA is frozen, rerun exactly once:

1. fresh/repeat/dry migrations on an isolated disposable PostgreSQL database;
2. the literal 30-minute / 50-user mounted signed workload;
3. exact reconciliation of expected writes, duplicates and tenant negatives;
4. cold signed desktop/mobile Web Vitals;
5. hash and independently verify the report, profile, Web Vitals input and
   manifest;
6. remove only the named disposable database/runtime after residue checks.

Do not substitute a short smoke for this denominator and do not run it against
the protected owner-fixture database.
