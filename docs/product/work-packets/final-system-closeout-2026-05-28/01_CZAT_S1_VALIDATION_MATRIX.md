# 01 Czat - S1 Validation Matrix

Status: `in_progress`

Module: `01 Czat`

---

## Validation matrix

| Layer | What | Method | Expected evidence |
| --- | --- | --- | --- |
| API Gate | Core chat endpoints | G1 Step A | No `5xx`, valid statuses |
| DB-Compat Gate | Persistence and read-back | G1 Step B | Write/read consistency |
| UI Smoke Gate | Open -> send -> response | G1 Step C | Flow works, no dead action |
| Functional | Refresh resistance | Focused manual + smoke | Sent content survives refresh |
| UX | Honest states and feedback | UI evidence capture | Proper loading/error/degraded |
| Security/Tenant | Access boundaries | Role/tenant checks | No leakage, proper denial |
| Evidence | Gate report completeness | Module gate report | Full evidence pack linked |

---

## Command canon alignment

- `npm run test:quality-check`
- `npm run test:integrity`
- `npm run test:security`
- `npm run test:e2e:readiness`
- `npm run test:e2e:smoke`

Use only commands present in package command canon.

