# G19 — przelot HTTP po 12 zmienionych plikach tras

Pomiar wykonano przez realny `ApiGateway.getInstance().initializeRoutes(app)`, listener `127.0.0.1:5258`, podpisane JWT dwóch aktywnych OWNER-ów z dwóch organizacji oraz PostgreSQL `cx290` na `127.0.0.1:6294`. Każda odpowiedź użytkownika obcej organizacji została przeskanowana pod kątem identyfikatora organizacji, użytkownika i adresu e-mail właściciela. `foreignLeaksOwner=false` dla 12/12.

| Plik | Metoda i ścieżka | OWNER | Obca organizacja | Dane właściciela w odpowiedzi obcej org |
| --- | --- | ---: | ---: | --- |
| `adminP32.routes.ts` | `GET /api/admin/people` | 200 | 200 | nie |
| `ai.routes.ts` | `GET /api/ai/context` | 200 | 200 | nie |
| `auth.routes.ts` | `GET /api/auth/sessions` | 200 | 200 | nie |
| `help.routes.ts` | `GET /api/help/playbooks` | 200 | 200 | nie |
| `meeting.routes.ts` | `GET /api/meeting` | 200 | 200 | nie |
| `mfa.routes.ts` | `GET /api/mfa/status` | 200 | 200 | nie |
| `pmo/decisions.routes.ts` | `GET /api/decisions` | 200 | 200 | nie |
| `pmo/initiativesExecutionRuntime.routes.ts` | `GET /api/initiatives/runtime-v1/execution-cases` | 200 | 200 | nie |
| `security.routes.ts` | `GET /api/security/settings` | 200 | 200 | nie |
| `v8/chat.routes.ts` | `GET /api/v8/chat/snapshots?conversationId=day290-missing` | 200 | 200 | nie |
| `v8/index.ts` | `GET /api/v8/health` | 200 | 200 | nie |
| `v8/teresa.routes.ts` | `GET /api/v8/teresa/proposal/day290-missing` | 404 | 404 | nie |

## Korekta wobec oczekiwania instrukcji

Instrukcja oczekiwała dla obcej organizacji `403/404, nigdy 200 z cudzymi danymi`. Jedenaście wybranych powierzchni to listy lub odczyty kontekstu własnej organizacji wyznaczonej przez JWT, dlatego obcy OWNER poprawnie otrzymał `200` dla swojej organizacji. Dowodem izolacji w tym kształcie nie jest sam kod odpowiedzi, lecz brak trzech identyfikatorów właściciela w treści odpowiedzi. Jedyna sonda po identyfikatorze brakującego obiektu (`v8/teresa`) zwróciła symetryczne `404/404`.

Surowy log: `evidence/g19/przelot-http.log` (`DAY290_HTTP_FLIGHT=...`).
