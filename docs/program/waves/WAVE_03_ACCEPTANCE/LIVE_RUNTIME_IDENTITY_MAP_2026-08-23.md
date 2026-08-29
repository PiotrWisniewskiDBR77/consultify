# Live local runtime identity map — 2026-08-23

Status: `READ_ONLY_CHECKPOINT / MULTIPLE_CANDIDATES_ACTIVE / NO_PROCESS_STOPPED`

Captured after the Wave 3 owner-review session to prevent a browser port from
being mistaken for a single canonical local application. No process, database,
Railway service, variable or deployment was changed while producing this map.

## Finding

Four independent Vite frontends were listening at the same time. They came
from four different source trees and three different exact SHAs plus one
unqualified test runtime. Therefore changing the browser port changed the
candidate under review.

| Browser port | Source checkout | Frontend/API pair | Exact identity | Readiness | Disposition |
| --- | --- | --- | --- | --- | --- |
| `4342` | `/private/tmp/consultify-materials-owner-live-src-20260823` | `4342 -> 4341` | source HEAD `54987e405a5cdf13d7c24d5bb5178529a5d55bac`; API reports `buildSha=UNKNOWN` | HTTP 200, but `DB_MANAGED_SCHEMA=off` and both migration ledgers are unevaluated/disabled | `TEST_RUNTIME_ONLY / NOT_A_CANDIDATE` |
| `4364` | `/Users/piotrwisniewski/Developer/Consultify` | `4364 -> 4363` | API and frontend env identify `ca9ef20646584f4b41bd5732eda3eca993ba0b73`; current checkout HEAD has since advanced to `43730f86f8a74943c36a58b9ff07aa680a42aa3e` | health/ready 200; SQL and platform migration ledgers OK | `HEALTHY_STALE_PROCESS / DIRTY_WIP_CHECKOUT` |
| `4370` | `/Users/piotrwisniewski/Developer/Consultify/.worktrees/finaldemo-bcfb` | frontend omitted `VITE_API_TARGET`; backend is healthy on `4371` | backend `bcfb01483a368fb4baa133d35dbc7b56ba6c7857` | direct backend health/ready 200; frontend `/api/*` returns 500 because Vite falls back to `127.0.0.1:3001` | `BROKEN_FRONTEND_API_PAIR / DATA_NOT_PROVEN_MISSING` |
| `4380` | `/private/tmp/consultify-finance-owner-live-src-20260823` | `4380 -> 4381` | `d8561ed5c2b81632c03d8012d633a6bb7dce142d` | health/ready 200; SQL and platform migration ledgers OK | `HEALTHY_EXACT_SHA_FINANCE_RUNTIME` |

The default proxy fallback is defined in `vite.config.ts` as
`http://127.0.0.1:3001`. The 4370 process was launched without
`VITE_API_TARGET`, even though its matching backend was listening on 4371.
This is sufficient to explain the 500 responses observed through 4370; it is
not evidence that the corresponding database or module code disappeared.

## Railway boundary

Read-only CLI context resolves to project `consultify`
(`a6d59e88-263d-45f3-96bc-861f66bf467b`) in workspace
`Piotr Wisniewski's Projects`. It is not a pitchdeck project. This checkpoint
does not treat CLI linkage as proof of the database used by any local process.

## Stabilization gate

Before the next owner replay:

1. freeze one exact-SHA candidate and one preserved database fixture;
2. start exactly one guarded backend/frontend pair with explicit ports and
   `VITE_API_TARGET`;
3. prove health, readiness, both migration ledgers, build marker, tenant and
   fixture marker before opening the browser;
4. label every owner screenshot with the exact SHA and runtime URL;
5. stop obsolete review runtimes only after their source/WIP fingerprints and
   reconstruction commands have been preserved and the owner authorizes the
   cleanup.

