# 05 Inicjatywy - S1 Validation Matrix

Status: `in_progress`

Module: `05 Inicjatywy`

---

## Validation matrix

| Layer | What | Method | Expected evidence |
| --- | --- | --- | --- |
| API Gate | Initiative core endpoints | G1 Step A | No `5xx`, valid statuses |
| DB-Compat Gate | Initiative persistence paths | G1 Step B | Write/read consistency |
| UI Smoke Gate | Open -> core update -> feedback | G1 Step C | Flow works, no dead action |
| Functional | Read-back and refresh continuity | Focused manual + smoke | Updated state survives refresh |
| UX | Honest loading/error/degraded states | UI evidence capture | No fake success behavior |
| Security/Tenant | Role/tenant access boundaries | Role/tenant checks | No leakage, valid denials |
| Evidence | Gate report completeness | Module gate report | Full linked evidence pack |

---

## Command canon alignment

- `npm run test:quality-check`
- `npm run test:integrity`
- `npm run test:security`
- `npm run test:e2e:readiness`
- `npm run test:e2e:smoke`

Use only commands present in package command canon.

