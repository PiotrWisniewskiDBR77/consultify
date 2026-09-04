# Dyżur 333 — schemat: domknięcie po 310/319

Stan: W TOKU. Marker `1c3d3da844ae03c87985a8f5dc74846a073c0220`, gałąź `codex/day333-schemat-domkniecie-20260904`.

## R0 — baza od zera i pomiar A

- Pełny strict runner: `Applying migrations: 893`, zakończony `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`.
- A = **1802** tabel w `public`.
- `to_regclass('public.conversations') = conversations`; `to_regclass('public.slack_router_dedupe') = NULL`.

Artefakty: `/private/tmp/cx-day333-schemat-domkniecie-artefakty/migracje-r0-1.txt`, `migracje-r0-2.txt`, `a-tabele.txt`.

## R1 — pomiar B przez realny ApiGateway

Harness zamontował `ApiGateway.getInstance().initializeRoutes(app)` na `127.0.0.1:5499`, z `MOCK_DB=false`, `DB_TYPE=postgres`, `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6359/cx333`, `ENABLE_TEST_AUTH_BYPASS=false` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` w tej samej linii.

| Pomiar | Wynik |
|---|---:|
| A — po migracjach | 1802 |
| B — po ApiGateway, rejestracji i próbie Slack | 1803 |
| B−A | 1 |

`POST /api/auth/register` zwrócił **HTTP 200**. Bezpieczna próba `routeToSlack` przy braku tokenu, kanału i webhooka zwróciła `{ ok: false, transport: "none" }`, ale wcześniej uruchomiła trwały dedupe. Jedyną tabelą B−A jest `slack_router_dedupe`, pochodzącą z `server/src/services/slack/slackRouter.ts:147`.

Artefakty: `/private/tmp/cx-day333-schemat-domkniecie-artefakty/r1-api-gateway.txt`, `b-tabele.txt`, `b-minus-a.txt`.

## Korekty wobec instrukcji

- Instrukcja podaje A/B `1914→1915`; na markerze dyżuru 333 własny pomiar daje **`1802→1803`**. Różnica nazw pozostaje zgodna: wyłącznie `slack_router_dedupe`.
- Krok symlinka zwrócił `File exists`, ponieważ worktree już zawierał poprawny symlink `node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules`; nie wykonano dodatkowej zmiany.

## Z30 — brak wysyłki zewnętrznej

Przed zapisem środowisko zwróciło `BRAK ZMIENNYCH POCZTY`, tabela `settings` miała 0 kluczy `smtp%`, a `Gateway.ts` nie zawiera uruchomienia drenaży. Log rejestracji pokazuje `Using Host: Mock (Console)`. Slack nie miał skonfigurowanego transportu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar zasięgu testów

PRZED zmianami: 2 pełne nazwy w `/private/tmp/cx-day333-schemat-domkniecie-artefakty/przed-nazwy.txt`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano zachowania produkcji, demo, stagingu ani Railway; kontakt z nimi był zakazany.
- Pomiar B obejmuje rejestrację i kontrolowaną ścieżkę Slack, nie wszystkie możliwe ścieżki DDL-w-locie.

