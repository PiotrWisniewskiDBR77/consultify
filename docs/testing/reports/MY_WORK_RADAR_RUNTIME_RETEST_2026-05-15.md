# My Work / Radar Runtime Retest - 2026-05-15

Environment: `https://demo.consultify.ai`
Runtime SHA: `9bf354c8841c44b204961944c0da8f5d661b228c`

## Verdict

`PASS_WITH_P2_ROLE_SHELL_RISK`

The historical P1 from `testy_antygravity/reports/2026-04-29_1145_my-work-runtime-gate.md` is no longer reproducible for the owner business gate. `/my-work/start` renders Radar and survives refresh without the infinite spinner.

## Scope

- Owner: `piotr.wisniewski@dbr77.com`.
- Routes:
  - `/my-work/start`
  - `/my-work`
  - `/my-work/notebook`
  - `/my-work/tasks`
  - `/my-work/calendar`
  - `/my-work/inbox`
- Signals:
  - route-level render,
  - refresh on `/my-work/start`,
  - no `Cannot GET`,
  - no app crash text,
  - no blocking `Loading...` state,
  - no API `5xx`.

## Automated Evidence

- Dedicated remote Playwright smoke:
  - `tests/e2e/smoke/my-work-runtime-gate.spec.ts`
  - Result: `1/1 PASS`
- General route smoke:
  - `tests/e2e/smoke/pages-render.spec.ts`
  - Result: `10/10 PASS`

## Diagnostic Evidence

Owner diagnostics on staging:

- `/my-work/start`: `PASS`
- `/my-work`: `PASS`
- `/my-work/notebook`: `PASS`
- `/my-work/tasks`: `PASS`
- `/my-work/calendar`: `PASS`
- `/my-work/inbox`: `PASS`
- API `5xx`: none

Member diagnostics:

- Member account (`jan.kowalski@dbr77.com`) lands inside demo/pilot shell for several My Work routes.
- The shell renders content and did not produce API `5xx`, but it does not provide the same canonical owner module surface for Radar/Notebook/Calendar.
- This is classified as `P2_ROLE_SHELL_RISK`, not the original P1 infinite spinner.

## Decision

`MY_WORK_GATE_PASS_WITH_P2`

The Sprint 2 P1 is closed for the owner business gate. Member role-shell parity should remain tracked as a P2/retest item, but it does not block progression to Sprint 3.
