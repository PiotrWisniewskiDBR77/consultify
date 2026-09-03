# Dyżur "resztki fundamentu" — 2026-09-03

Worktree: `agent/resztki-fundamentu-20260903`, marker `00f8e9dd65`.
Zadanie: domknąć/uczciwie udokumentować siedem pojedynczych braków G00-G05
znalezionych przez `node scripts/wave3/report-acceptance-gates.mjs` (bucket
`owner_gated`/`open`, stan inny niż literalny `PASS`).

## Znalezione siedem (zgodne z zapowiedzianym rozkładem G00×2, G02×1, G03×1, G04×2, G05×1)

| Moduł | Bramka | Stan przed | Rozstrzygnięcie |
|---|---|---|---|
| 11_MATERIALS | G00 | `OWNER_PENDING` | Pozostawione — sam dowód mówi, że to decyzja właściciela (prawa szablonów/fontów/obrazów), nie luka techniczna. |
| 11_MATERIALS | G04 | `OWNER_PENDING` | Pozostawione — ta sama nierozstrzygnięta decyzja polityki co G00. |
| 12_AUDITS | G00 | `OWNER_PENDING` | Pozostawione — nazwane standardy zewnętrzne OFF do decyzji właściciela. |
| 12_AUDITS | G04 | `OWNER_PENDING` | Pozostawione — ta sama decyzja polityki co G00. |
| 13_CHAT | G03 | `OWNER_PENDING` | Pozostawione — czy MEMBER ma prawo Approve/Reject to decyzja produktowa Piotra, nie usterka. |
| 15_SETTINGS | G02 | `NOT_STARTED` | **ZAMKNIĘTE → `PASS`** realnym pomiarem (patrz niżej). |
| 16_PARTNER | G05 | `NOT_STARTED` | **ZAMKNIĘTE → `PASS`** realnym pomiarem (patrz niżej). |

Pięć pierwszych zostało zweryfikowane przez odczyt kolumny dowodu — każdy
wprost stwierdza, że zamknięcie wymaga decyzji Piotra (nie jest to
niedopatrzenie robotnika). Zgodnie z instrukcją dyżuru te pięć NIE zostało
ruszone: stan `OWNER_PENDING` jest już poprawną, końcową etykietą.

## Środowisko pomiaru

- Disposable PostgreSQL `pgvector/pgvector:pg16`, kontener `cx-ag-resztki`,
  `127.0.0.1:6290`, baza `cxresztki`, użytkownik `cx`.
- Migracje: `DATABASE_URL=postgresql://cx:cx@127.0.0.1:6290/cxresztki DB_TYPE=postgres
  RUN_DB_TESTS=1 CI=true npx tsx server/scripts/migrate.postgres.ts` — pełny przebieg,
  drugi przebieg zgłosił `Applying migrations: 0` (idempotencja potwierdzona).
- Harness: `server/src/scripts/resztki-fundamentu-przelot.ts` (kopia z sumą
  kontrolną w tym katalogu: `resztki-fundamentu-przelot.ts.txt`) — wzorowany
  1:1 na `server/src/scripts/g05-przelot.ts`: prawdziwy `ApiGateway` przez
  `npx tsx` (**nigdy `vitest`**, który w `tests/setup.ts:858-896` podmienia
  `global.fetch` na atrapę zwracającą zawsze sukces), port `5302`, `CI=true`
  (otwiera bramkę na `127.0.0.1` zamiast atrapy bazy z `NODE_ENV=test` bez
  `RUN_DB_TESTS=1`), cold read = niezależne połączenie/świeży login, porównanie
  **wartości pole po polu**, nigdy odpowiedzi zapisu (`Database.ts:686` zwraca
  `changes:1` dla każdego UPDATE, także pustego).
- Uruchomienie (obie fazy, identyczny env poza `RESZTKI_PHASE`):
  ```
  RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true \
  ENABLE_TEST_AUTH_BYPASS=false CI=true \
  DATABASE_URL=postgresql://cx:cx@127.0.0.1:6290/cxresztki \
  JWT_SECRET=<local-only> PORT=5302 \
  RESZTKI_PHASE=SETTINGS npx tsx server/src/scripts/resztki-fundamentu-przelot.ts
  ```
  (analogicznie `RESZTKI_PHASE=PARTNER`, plus `PARTNER_OWNER_FIXTURE_PASSWORD`).

## 15_SETTINGS G02 — wynik: PASS

Pełny log: `settings-g02-przelot.output.txt`.

Trasa delegowanego zapisu `POST /api/settings/notifications`
(`server/src/routes/settings.routes.ts:1132-1191`) faktycznie dociąga rolę
aktora i status celu z `organization_members` (nie z tokenu).

- **Pozytyw**: świeżo zarejestrowany OWNER zapisał preferencje powiadomień
  na rzecz ACTIVE MEMBER teammate'a → `200 {"success":true}`. Niezależny
  odczyt SQL (nowe połączenie `pg`) z `user_preferences` (klucz
  `settings:notifications-channel-admin`) zwrócił wartość identyczną **pole
  po polu** z wysłaną. Niezależny odczyt API (świeży login jako target,
  `Connection: close`) `GET /api/settings/notifications` zwrócił tę samą
  wartość — podwójne potwierdzenie (SQL + API).
- **Negatyw 1**: MEMBER (nie owner/admin) próbujący tego samego zapisu na
  rzecz kogoś innego → `403 "Not authorized"`; baza niezmieniona (wciąż
  poprzednia, poprawna wartość).
- **Negatyw 2**: OWNER próbujący zapisu na rzecz REVOKED targetu → `403
  "Target user is outside the active organization"`; zero wierszy w bazie
  dla tego usera.

Wynik reprodukowany dwukrotnie (dwa niezależne uruchomienia, różne nonce),
identyczny za każdym razem.

## 16_PARTNER G05 — wynik: PASS

Pełny log: `partner-g05-przelot.output.txt`. Fixture: seedowany
`server/scripts/seed-wave3-partner-owner-review.ts` (manifest —
`partner-owner-fixture-manifest.json`, `--confirm-db=cxresztki`).

Poprzedni pomiar (`REJESTR_G05_PRZELOT_20260902.md`, `g05-przelot.ts` runR6)
próbował wyłącznie ze świeżo zarejestrowaną, NIEZWIĄZANĄ organizacją i
poprawnie dostał `403 PARTNER_ORG_REQUIRED` — to nie było fałszem, tylko
niepełnym pomiarem (brak próby na organizacji związanej).

- **Pozytyw (organizacja związana)**: OWNER z fixture (`wave3.partner.owner.
  20260821@local.test`, organizacja związana z `partner_organizations` przez
  `owner_organization_id`) wykonał `PUT /api/v8/partner/organization` z
  nowymi `contactPhone`/`website` → `200 {"success":true}`. Niezależny odczyt
  SQL `partner_organizations.contact_phone/website` (nowe połączenie `pg`,
  po zamknięciu połączenia zapisu) zwrócił **dokładnie** wysłane wartości.
  **Osiągalna ścieżka zapisu istnieje** — pod warunkiem uprzedniego
  związania organizacji z partnerem.
- **Negatyw (powtórka poprzedniego pomiaru, dla kompletności w jednym
  rejestrze)**: świeżo zarejestrowana, niezwiązana organizacja → legacy
  `PUT /api/partners/organization` = `410 PARTNER_LEGACY_WRITER_DISABLED`;
  kanoniczny `PUT /api/v8/partner/organization` = `403 PARTNER_ORG_REQUIRED`.

Wynik reprodukowany dwukrotnie, identyczny za każdym razem.

## Sprzątanie

Kontener `cx-ag-resztki` (port 6290) i baza `cxresztki` zostały usunięte po
pomiarze — zero danych testowych po sobie, brak połączenia z demo/staging/
produkcją w trakcie tego dyżuru.
