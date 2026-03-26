## V8 Tranche 0 three-agent finisher proof

- Date: `2026-03-26`
- Environment: staging (`https://stage.consultinity.ai`)
- Goal: run the first post-closure tranche to its honest stopping point using the 3-agent operating model

## Agent coverage

### Agent A - Program / acceptance

- Created and committed the tranche authority document:
  - `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`
- Kept `Tranche 0` scoped only to:
  - `Calendar`
  - `Organization / Admin / Superadmin`
  - debt-program orchestration

### Agent B - Runtime / regression

Confirmed local automated support for the bounded slice:

- root:
  - `npx vitest run tests/unit/services/v8-admin-api.test.ts tests/unit/services/api-my-work-calendar-fallback.test.ts --maxWorkers=1 --maxConcurrency=2`
  - `npx vitest run tests/integration/routes/v8.my-work.routes.test.ts --no-file-parallelism`
- server:
  - `npx vitest run src/routes/v8/__tests__/admin.routes.test.ts src/routes/v8/__tests__/my-work-calendar.routes.test.ts`

Result:

- all targeted local tests passed for the bounded `Calendar` and `Admin` route/client slice

### Agent C - Surface / staging proof

Performed live staging browser retests for both `Calendar` and `Admin/Superadmin`.

---

## Calendar retest

Surface:

- `https://stage.consultinity.ai/my-work?tab=calendar&ts=1774611000`

Live UI observations:

- the authenticated `My Work -> Calendar` surface loaded,
- the real `Add to calendar` modal was open on the live surface,
- the modal showed:
  - title,
  - description,
  - date,
  - `Cancel`,
  - `Add`,
- the live fields were populated with:
  - title: `Prepare review deck`
  - description: `Bounded V8 continuity check`
  - date: `2026-03-26`

Observed governed requests in the same staging window:

- `GET /api/v8/my-work/calendar/unified` -> `200`
- `GET /api/v8/my-work/calendar/unified?...` -> `200`
- `GET /api/v8/my-work/calendar/conflicts?date=2026-03-26` -> `503`

Not observed in the same captured window:

- `GET /api/my-work/calendar/unified`
- `GET /api/my-work/calendar/conflicts`
- `POST /api/v8/my-work/calendar/events`

Attempted submit actions:

- direct click on `Add`
- browser resize
- scroll into view
- keyboard path (`Tab`, `Enter`) from focused modal fields

Stopping point:

- the modal remained submit-ready,
- but the automation layer still could not complete the final live `Add` activation cleanly,
- so no `POST /api/v8/my-work/calendar/events` was captured in this retest.

Decision:

- the bounded calendar slice is still **not fully closure-green**,
- but it is narrowed to one remaining ambiguity:
  - final create-submit capture,
  - vs confirmed runtime blocker on governed `conflicts` (`503`)

---

## Admin / Superadmin retest

Surfaces checked:

1. `https://stage.consultinity.ai/superadmin`
2. `https://stage.consultinity.ai/admin?tab=integrations&ts=1774600100`

Observed runtime behavior:

- direct navigation to `/superadmin` did not stay on a superadmin surface,
- the runtime settled on `/chat`,
- the live `Admin Panel -> Integrations` surface rendered normally,
- the session therefore proved authenticated admin access, but not superadmin diagnostics access

Observed operator-facing admin requests:

- `GET /api/v8/admin/flags` -> `200`
- later `GET /api/v8/admin/flags` -> `429`

What was not observed from an operator-facing surface:

- `GET /api/v8/admin/health`
- `GET /api/v8/admin/metrics`
- `GET /api/v8/admin/shadow/stats`
- `GET /api/v8/admin/shadow/comparisons`
- `GET /api/v8/admin/shadow/promotion-readiness`

Additional direct endpoint check:

- direct browser navigation to `https://stage.consultinity.ai/api/v8/admin/health?ts=1774613000` returned main-frame `401`

Interpretation:

- this does **not** prove the route is broken,
- it only confirms that raw endpoint navigation outside the authenticated app runtime is not a valid replacement for operator-surface proof

Decision:

- the bounded admin/superadmin slice is still **not closure-green**,
- the remaining blocker is specifically:
  - superadmin access/routing/session coherence to the intended diagnostics surface

---

## Final tranche decision

`Tranche 0` was executed through its planned 3-agent model and reached an honest stopping point.

What is complete:

- authority program created,
- bounded code slice implemented,
- bounded local regression green,
- live staging retest executed for both residual lanes

What remains open:

- `Calendar`: final live create-submit capture or explicit runtime confirmation that `conflicts 503` is the true blocker
- `Organization / Admin / Superadmin`: a real superadmin-capable staging route/session that reaches the diagnostics surface

This evidence closes the ambiguity around the first tranche execution itself, but it does **not** justify declaring `Tranche 0` complete yet.
