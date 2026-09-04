# Dyżur 360 — R3: 08_MEETINGS

Data: `2026-09-04`. Marker: `2a7273e087cbd3e44344725b524f6ddd79d5badc`.

## Korekta trasy z instrukcji

Instrukcja nazywa trasę `GET /api/meetings/:id`, ale realny mount w `server/src/Gateway.ts:761` to `/api/meeting`, a router ma `GET /:id`. Zmierzona produkcyjna ścieżka to `GET /api/meeting/:id`.

## Para

Pełna nazwa: `Day 360 G19 08 Meetings cross-org record isolation through ApiGateway denies a foreign organization while the owner reads the same seeded meeting`.

Istniejący `meetingId=day360-meeting-owner`, zasiany w `day307-org-owner`. Realny ApiGateway, podpisane JWT, PostgreSQL `127.0.0.1:6431/cx360`, `--retry=0`.

| Aktor | Kod | Bajty JSON | Treść |
| --- | ---: | ---: | --- |
| obca organizacja | 404 | 29 | `Meeting not found` |
| właściciel | 200 | 640 | niepuste `{ meeting }`, właściwe `id` i `organizationId` |

Ważny przebieg: `numTotalTests=1`, `numPassedTests=1`, `numFailedTests=0`.

## Dwie mutacje

1. `server/src/services/meetingService.ts:285`: usunięto `AND organization_id = ?` i parametr organizacji. RED 0/1: obcy dostał 200, komunikat `expected 200 to be 404`. To jest mutacja izolacji.
2. `server/src/routes/meeting.routes.ts:150`: dodano w `canAccessMeeting` bezwarunkowe `return true`. RED 0/1: obcy dostał 200, komunikat `expected 200 to be 404`. To jest mutacja izolacji.

Po każdej mutacji plik przywrócono przez `cp`; `git diff -- server/src/routes/meeting.routes.ts server/src/services/meetingService.ts` był pusty. Końcowy przebieg po przywróceniu: 1/1 GREEN.

Zabezpieczeniem trasy `GET /api/meeting/:id` są oba punkty: filtr `organization_id` w `server/src/services/meetingService.ts:285` odcina obcą organizację przy odczycie, a `canAccessMeeting` w `server/src/routes/meeting.routes.ts:150` fail-closed odrzuca brak rekordu oraz sprawdza dostęp do rekordu zwróconego przez serwis.

Brak zmiennych SMTP, zero wierszy `smtp%`, brak drenaży i brak startu `server/src/index.ts`; niczego nie wysłano na zewnątrz.
