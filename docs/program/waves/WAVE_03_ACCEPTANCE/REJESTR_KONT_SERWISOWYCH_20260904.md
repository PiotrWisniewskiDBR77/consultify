# Rejestr kont serwisowych — 2026-09-04

Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`
Baza pomiarowa: lokalny jednorazowy PostgreSQL `cx326`, port `6352`.

## R1 — macierz przed naprawą

Każda komórka zawiera parę: żądanie obcego tenantu z `orgId` celu oraz żądanie właściciela celu.

| Metoda | Kształt organizacji | Obcy nie widzi | Właściciel | Stan danych |
| --- | --- | --- | --- | --- |
| GET | UUID | `403 ADMIN_BOUNDARY_VIOLATION` | `200`, odpowiedź zawiera realny wiersz `day326-get-uuid` | wiersz obecny przed i po |
| GET | spoza UUID (`system`) | `403 ADMIN_BOUNDARY_VIOLATION` | `200`, `data: []` | brak możliwego wiersza: kolumna `tp_service_accounts.organization_id` ma typ `uuid` |
| POST | UUID | `403 ADMIN_BOUNDARY_VIOLATION` | `201`, wydany token i realny wiersz `day326-post-uuid` | liczba wierszy rośnie |
| POST | spoza UUID (`system`) | `403 ADMIN_BOUNDARY_VIOLATION` | `500`, parser Supertest pokazuje `{}`, surowe ciało jest HTML z błędem PostgreSQL `invalid input syntax for type uuid` | bez zmian |
| DELETE | UUID | `403 ADMIN_BOUNDARY_VIOLATION` | `204` | realny wiersz istnieje przed i znika po |
| DELETE | spoza UUID (`system`) | `403 ADMIN_BOUNDARY_VIOLATION` | `500`, parser Supertest pokazuje `{}`, surowe ciało jest HTML z błędem PostgreSQL `invalid input syntax for type uuid` | chroniony wiersz UUID bez zmian |

Artefakt pełnych odpowiedzi i readbacków: `/private/tmp/cx-day326-konta-serwisowe-artefakty/service-accounts-r1-matrix.json`.

### Producent pustego ciała

`ApiGateway.initializeRoutes(app)` montuje router, lecz nie montuje `errorHandlerMiddleware`; ten jest dodawany dopiero w `server/src/index.ts`. `asyncHandler` przekazuje wyjątek przez `next(error)`, więc w wymaganym harnessie odpowiada domyślny handler błędów Express/finalhandler. Wysyła HTML, a `supertest` wystawia `response.body` jako `{}`. Globalny `ErrorHandler.ts` nie odpowiada w tym pomiarze.

### Ograniczenie DoD

Wymaganie realnego wiersza dla właściciela organizacji `system` jest niewykonalne na świeżym schemacie: `organizations.id` jest `text`, natomiast `tp_service_accounts.organization_id` jest `uuid`. Próba wstawienia `system` jest właśnie źródłem mierzonego błędu. Nie zastąpiono tego atrapą ani innym identyfikatorem.

## R2 — bramki i koperty błędów

Stan: **PARTIAL / STOP MERYTORYCZNY dla pełnego progu „każda odpowiedź błędu”**.

- `POST` i `DELETE` odrzucają organizację spoza UUID jako `400 INVALID_IDENTIFIER`, przed zapytaniem do PostgreSQL.
- Odpowiedzi błędów powstające wewnątrz routera dostają `errorCode` i `correlationId`; zmierzone realnie: `403`, `400`, `404` oraz lokalny awaryjny `500`.
- Zachowanie UUID pozostaje: GET `200` z realnym wierszem, POST `201` z realnym wierszem, DELETE `204` z readbackiem braku wiersza.
- Pełny próg nie jest osiągnięty: niezalogowane żądanie do `/api/admin/service-accounts` zatrzymuje wcześniejszy szeroki mount `/api/admin` i zwraca `401 {"error":"No token provided"}` zanim wejdzie do licencjonowanego routera. Czerwony kontrakt pozostaje w teście. Naprawa wymagałaby zmiany `Gateway.ts` albo wcześniejszego routera, oba poza licencją dyżuru.

Dowód mutacyjny bramki POST: po usunięciu bramki test `R2 rejects non-UUID POST and DELETE before PostgreSQL with stable envelopes` jest czerwony (`expected 500 to be 400`); po przywróceniu przez `cp` jest zielony.
