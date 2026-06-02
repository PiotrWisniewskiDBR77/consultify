# 02 Moja Praca - S1 Validation Matrix

Status: `in_progress`

Module: `02 Moja Praca`

---

## Validation matrix

| Layer | What | Method | Expected evidence |
| --- | --- | --- | --- |
| API Gate | My Work core endpoints | G1 Step A | No `5xx`, valid statuses |
| DB-Compat Gate | Stateful action persistence | G1 Step B | Write/read consistency |
| UI Smoke Gate | Open -> core action -> feedback | G1 Step C | Flow works, no dead action |
| Functional | Refresh resistance | Focused manual + smoke | State survives refresh |
| UX | Honest states and feedback | UI evidence capture | Proper loading/error/degraded |
| Security/Tenant | Role and access boundaries | Role/tenant checks | No leakage, proper denial |
| Evidence | Gate report completeness | Module gate report | Full evidence pack linked |

---

## Command canon alignment

- `npm run test:quality-check`
- `npm run test:integrity`
- `npm run test:security`
- `npm run test:e2e:readiness`
- `npm run test:e2e:smoke`

Use only commands present in package command canon.

