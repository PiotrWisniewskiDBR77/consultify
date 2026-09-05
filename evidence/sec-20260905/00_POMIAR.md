# Dyżur bezpieczeństwa 2026-09-05 — KROK 0: POMIAR

Gałąź: `sec/cross-org-admin-20260905` z `origin/staging`.
HEAD w chwili pomiaru: `888e8a52b9f55005b35e7f7d3956127c81c5ca32`
("docs(program-naprawczy): rejestr odbioru — P4 scalone...").

Metoda: dla każdej pozycji z rejestrów (`docs/program/*.md`) czytam kod na HEAD
(plik:linia trasy → handler → serwis → zapytanie), a potem WERYFIKUJĘ realnym
żądaniem HTTP przez pełny `ApiGateway` na izolowanym, jednorazowym kontenerze
Postgres (`pgvector/pgvector:pg16`, port `54339`, baza `sectest`, migracje
przepuszczone `server/scripts/migrate.postgres.ts` z `NODE_ENV=test` — 1803
tabele). NIE demo, NIE staging, NIE produkcja. Test:
`server/src/routes/__tests__/sec20260905.a52-and-cross-org.pg.test.ts`.

## Źródła

- `docs/program/SCIEZKA_WYJSCIA_V2.md` §A (pozycja "242 Uprawnienia") — stan
  "starych trzech dziur cross-org" na 09-03/09-04.
- `docs/program/KOLEJKA_CODEX_INTEGRACJA.md` (287 · Trzy dziury cross-org —
  weryfikacja, czy naprawdę zamknięte).
- `docs/program/MVP_BACKLOG_20260905.md` (A52 — 8 tras admina 500, A53 czat,
  A54 język).
- `docs/program/PRZEKAZANIE_20260904.md`, `docs/program/REJESTR_ZNALEZISK_20260903.md`
  (dyżur 307 — macierz cross-org 2725 tras, tylko 3,9% rozstrzygniętych).

## Tabela pomiaru

| # | Dziura | Plik:linia | Nadal istnieje? | Dowód |
|---|---|---|---|---|
| 1 | Wnioski o uprawnienia — cross-org approve/reject | `server/src/routes/permissionRequests.routes.ts:19-28,78-97,99-119` (`permissionRequestBelongsToOrg`) | **NIE** — zamknięte kodowo | Test „A” w pliku pg.test.ts: PUT `/api/permission-requests/:id/approve` obcego org zwraca 404. Mutacja: `if (false && !(await permissionRequestBelongsToOrg(...)))` → RED (200 zamiast 404), przywrócone → GREEN. |
| 2 | Kontekst AI — cross-org PUT/DELETE (2 trasy: PUT, DELETE) | `server/src/routes/context.routes.ts:18-29,79-130,132-143` (`contextBelongsToOrg`) | **NIE** — zamknięte kodowo | Test „B”: PUT i DELETE obcego org → 404. Mutacja obu wywołań `contextBelongsToOrg` → RED, przywrócone → GREEN. |
| 3 | Wideo — cross-org / dane w tabeli `videos` | `server/src/routes/videos.routes.ts:16-25,27-47` | **CZĘŚCIOWO INNE** — nie jest to dziura cross-org. Tabela `videos` **NIE ISTNIEJE** w żadnej migracji (`grep -rln "CREATE TABLE.*videos" server/migrations` = pusto, `to_regclass('public.videos')` na żywej testowej bazie = NULL). Zapytanie SELECT jest poprawnie filtrowane `WHERE organization_id = ?`, ale trafia w gałąź „relacja nie istnieje" w `server/src/utils/DbPromise.ts` (`isSilenceableMissingRelationError`), która dla `all()` z domyślnym `fallback:true` cicho zwraca `[]` zamiast rzucić błąd. Efekt: **200 z pustą listą dla każdego użytkownika**, nie 500, nie wyciek. Zgodne z klasyfikacją `SCIEZKA_WYJSCIA_V2.md` §A: "rodzina schemat mieszka poza migracjami", wymaga decyzji produktowej (migracja albo odmontowanie trasy) — POZA zakresem tego dyżuru (nie jest to defekt bezpieczeństwa). | Test „C": GET `/api/videos` → 200, `[]`. `docker exec ... psql -c "SELECT to_regclass('public.videos')"` → pusty wynik (tabela nie istnieje). |
| 4 (A52) | `/api/admin/service-accounts` — 500 dla zwykłego usera | `server/src/routes/admin/service-accounts.routes.ts:42-68` (role/status gate), `126-155` (DELETE z `WHERE ... AND organization_id = ?`) | **NIE** — zamknięte kodowo (widać komentarz w pliku: naprawione po odbiorze 04.09) | Test „D": MEMBER → 403 `ADMIN_ACCESS_REQUIRED` (nie 500); OWNER → 200; DELETE cudzego konta serwisowego → 404. Mutacja usuwająca `AND organization_id = ?` z WHERE → RED (204 zamiast 404 — usunięcie by przeszło), przywrócone → GREEN. |
| 5 (A52) | `/api/table-platform/admin/service-accounts` ×2 (GET/POST) + `/admin/sso/saml` | `server/src/routes/table-platform.routes.ts:4426-4434` (`requireTenantAdmin`, komentarz „Day 314"), zastosowane w liniach `4551,4583,4608,4620` | **NIE** — zamknięte w dyżurze 314 (widoczne w komentarzu kodu), potwierdzone dziś realnym testem | Test „E": MEMBER → 403 na GET service-accounts i POST sso/saml. Mutacja `if (true \|\| ...)` w `requireTenantAdmin` → RED (200 zamiast 403) na obu trasach, przywrócone → GREEN. |
| 6 (A52) | `/api/knowledge-graph/freshness/duplicates` — rzekomo 500 (surowy SQL) | `server/src/routes/knowledge-graph.routes.ts:358-369`, `server/src/services/knowledgeGraph/unifiedKGService.ts:757-779` (`GROUP_CONCAT`) | **NIE, ale z zastrzeżeniem** — `GROUP_CONCAT` to składnia SQLite, nieprawidłowa na gołym Postgresie (`docker exec psql` bezpośrednio z tym zapytaniem: `ERROR: function group_concat(text) does not exist`). JEDNAK `server/src/database/PostgresDatabase.ts:880-916` (`adaptQuery`) ma dedykowaną regułę tłumaczącą `GROUP_CONCAT(...)` → `STRING_AGG(...)` PRZED wysłaniem do drivera, i cała warstwa `all()/get()/run()` przechodzi przez `adaptQuery`. Sprawdzone `npx tsx` bezpośrednio na tym dokładnym zapytaniu — tłumaczy się poprawnie z `?`→`$1`. | Test „F": GET jako zwykły authenticated user → 200, `duplicates: []` (tablica). Weryfikacja bezpośrednia: `npx tsx` z `adaptQuery(sql)` na dokładnym zapytaniu z `findDuplicates()` → poprawny `STRING_AGG`. |
| 7 (A52) | `/api/report-builder/sources/upload_bundle` (+`/:sourceId`) i `/definitions` | `server/src/routes/report-builder.routes.ts:1008-1052,1057-1114` (upload_bundle), `332-341` (definitions) | **NIE** — trasy używają parametryzowanego SQL z `organization_id = ?` w WHERE, mount pod `highRiskSurfaceGuard` nie blokuje GET (tylko WRITE_METHODS) | Test „G": oba GET → 200 dla zwykłego użytkownika. |
| 8 (A52) | Billing webhook ×2: `/api/billing/admin/webhook-events/failed` (GET), `/api/billing/admin/webhook-events/:id/retry` (POST) | `server/src/routes/billing.routes.ts:1424-1474` (`requireSuperAdmin`) | **NIE** — zamknięte kodowo (`requireSuperAdmin`, `server/src/middleware/auth.middleware.ts:1774-1789`, zwraca czysto 401/403, bez ścieżki crashu) | Test „H": MEMBER → 403 na obu trasach (nie 500). Mutacja `requireSuperAdmin` (`if (!isSuperAdmin && false)`) → RED na obu (200/404 zamiast 403), przywrócone → GREEN. |

## Wniosek KROK 0

Na dzisiejszym HEAD (`888e8a52b9`) **żadna z ośmiu tras A52 ani żadna z trzech
„starych" dziur cross-org NIE JEST OTWARTA w sposób, który udało się
odtworzyć na realnym Postgresie**. To NIE znaczy, że A52 była fałszywym
alarmem w chwili powstania (05.09 rano) — commity dnia (m.in. Day 314 dla
table-platform, naprawa `service-accounts.routes.ts` po odbiorze 04.09)
zamknęły je PRZED tym pomiarem. Zgodnie z regułą „audyty starzeją się w 3
dni" — potwierdzone jeszcze szybciej, w tym samym dniu.

Jedyne odkrycie tego kroku: trasa `/api/videos` NIE jest dziurą cross-org, ale
JEST martwą funkcją (tabela `videos` nigdy nie powstała żadną migracją) —
zgłoszone osobno jako defekt produktowy, nie bezpieczeństwa (patrz RAPORT.md,
sekcja „nienaprawione").

KROK 1 i KROK 2 (test-przed-naprawą + naprawa) w tej sytuacji **nie mają
czego naprawiać** — więc wykonane jako: test regresyjny (RED-by-mutation,
nie RED-by-defect) + dowód mutacyjny na każdym z sześciu realnych strażników,
żeby udowodnić, że to nie są testy fasadowe. Patrz `01_CROSS_ORG.md` i
`02_ADMIN_500.md`.
