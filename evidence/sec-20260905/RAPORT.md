# RAPORT KOŃCOWY — dyżur bezpieczeństwa 2026-09-05

Gałąź: `sec/cross-org-admin-20260905` (z `origin/staging`).
HEAD wyjściowy: `888e8a52b9f55005b35e7f7d3956127c81c5ca32`.

## Co było do zrobienia i co się okazało

Zlecenie: 3 "stare" dziury cross-org (wnioski o uprawnienia, kontekst AI,
wideo) + 8 tras admina z A52 (`docs/program/MVP_BACKLOG_20260905.md`) —
napisać test-przed-naprawą, naprawić, udowodnić mutacyjnie.

**Pomiar na realnym Postgresie (izolowany kontener, NIE demo/staging/prod)
pokazał, że wszystkie 11 pozycji są już zamknięte kodowo na HEAD.** Commity
wcześniejsze tego samego dnia (Day 314 dla `table-platform.routes.ts`,
naprawa po odbiorze 04.09 dla `admin/service-accounts.routes.ts`) zdążyły
zamknąć A52 zanim ten dyżur wystartował. To NIE jest "nic nie zrobiono" —
to jest wynik uczciwego pomiaru zamiast przyjęcia audytu na wiarę (zasada
"audyty starzeją się w 3 dni", potwierdzona tu w mniej niż jeden dzień).

## Tabela naprawionych / potwierdzonych

| Pozycja | Plik | Test | Mutacja RED→GREEN |
|---|---|---|---|
| Wnioski o uprawnienia (cross-org approve/reject) | `permissionRequests.routes.ts` | sekcja A, `sec20260905...pg.test.ts` | TAK — usunięcie `permissionRequestBelongsToOrg` → 200 zamiast 404 → przywrócone → GREEN |
| Kontekst AI (cross-org PUT/DELETE) | `context.routes.ts` | sekcja B | TAK — usunięcie `contextBelongsToOrg` (×2) → 200 zamiast 404 → GREEN |
| `/api/admin/service-accounts` (rola + cross-org delete) | `admin/service-accounts.routes.ts` | sekcja D | TAK — usunięcie `AND organization_id=?` z WHERE → 204 zamiast 404 → GREEN |
| `/api/table-platform/admin/service-accounts` + `/admin/sso/saml` | `table-platform.routes.ts` | sekcja E | TAK — `requireTenantAdmin` obejście → 200 zamiast 403 (×2 trasy) → GREEN |
| `/api/billing/admin/webhook-events/failed` + `/:id/retry` | `billing.routes.ts` (gate w `auth.middleware.ts`) | sekcja H | TAK — `requireSuperAdmin` obejście → 200/404 zamiast 403 (×2 trasy) → GREEN |
| `/api/knowledge-graph/freshness/duplicates` | `knowledge-graph.routes.ts` | sekcja F | Nie dotyczy (nie jest to trasa admin-only z założenia; zweryfikowano że `GROUP_CONCAT`→`STRING_AGG` tłumaczy się poprawnie) |
| `/api/report-builder/sources/upload_bundle`, `/definitions` | `report-builder.routes.ts` | sekcja G | Nie dotyczy (parametryzowane, GET nieblokowany przez `highRiskSurfaceGuard`) |

**6 z 9 realnych strażników potwierdzone dowodem mutacyjnym RED→GREEN.**
Pozostałe 2 trasy (F, G) nie mają strażnika roli do zmutowania z założenia —
weryfikacja ograniczona do potwierdzenia braku 500 i poprawnego
parametryzowania zapytań.

## Niezmierzone / nienaprawione — z powodem

1. **`/api/videos` — martwa funkcja, NIE dziura bezpieczeństwa.** Tabela
   `videos` nie istnieje w ŻADNEJ migracji (potwierdzone `to_regclass` na
   żywej testowej bazie = NULL). Zapytanie SELECT jest poprawnie
   org-scoped, ale `utils/DbPromise.ts` degraduje brakującą relację do `200
   []` zamiast 500 — funkcja jest cicho pusta dla każdego, nie da się z niej
   nic wyciec. Wymaga decyzji produktowej (migracja albo odmontowanie trasy)
   zgodnie z `docs/program/SCIEZKA_WYJSCIA_V2.md` §A — POZA zakresem
   bezpieczeństwa, nie naprawiane w tym dyżurze.
2. **Szeroka macierz cross-org (dyżur 307, 2725 tras, tylko 3,9%
   rozstrzygniętych wg `docs/program/REJESTR_ZNALEZISK_20260903.md`).**
   Ten dyżur objął TYLKO pozycje wymienione w instrukcji (3 stare dziury +
   A52). Reszta macierzy (~96%) pozostaje `NIEZWERYFIKOWANA` — nie
   twierdzę, że jest bezpieczna, tylko że nie była w zakresie dzisiejszego
   zlecenia i nie została dziś zmierzona.
3. **CSRF i MFA — tylko pomiar, zero zmian kodu** (zgodnie z instrukcją).
   Patrz `03_CSRF_MFA_PROPOZYCJA.md`: `csrfValidationMiddleware` istnieje,
   ale nie jest zamontowana NIGDZIE (nawet na produkcji) — walidacja CSRF
   jest dziś w 100% nieaktywna w całej aplikacji. Frontend nie wysyła
   nagłówka `x-csrf-token` (potwierdzone grep). MFA grace period jest
   naprawiony i realnie podłączony (`MFAService.ts:76`), ale nie
   sprawdzono, czy jakakolwiek żywa organizacja ma dziś `mfa_required=true`
   (zakaz dotykania demo/staging/prod nawet do odczytu).

## Wynik tsc

```
cd server && npx tsc --build tsconfig.build.json
EXIT_CODE=0
```

## Inne bramki

- `bash scripts/check-list-canon.sh` → exit 0, "brak NOWYCH naruszeń kanonu
  tabel" (dług 361 vs baseline 364 — nawet spadł, niezwiązane z tym
  dyżurem — nie dotknięto UI).
- `bash scripts/mvp-final/check-freeze.sh` → exit 0, brak naruszeń zamrożenia
  (żaden zmieniony plik nie należy do modułu z `MVP_FINAL_ZAMROZONE.json`;
  jedyne zmiany to nowy plik testowy i katalog `evidence/`).

## Środowisko testowe (dowód, że to realny Postgres, nie atrapa)

Kontener jednorazowy `sec-org-test-pg` (`pgvector/pgvector:pg16`,
`127.0.0.1:54339/sectest`), migracje przepuszczone `NODE_ENV=test tsx
server/scripts/migrate.postgres.ts` (bez `--safe`, bez `--only`) — 1803
tabele po migracji. Testy uruchamiane z `RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres DATABASE_URL=postgresql://postgres:test@127.0.0.1:54339/sectest`,
przechodzą przez `assertRealPostgresTestEnvironment()` (dowód `SELECT
version()`, odrzuca `localhost`/`127.0.0.1` bez `NODE_ENV=test`/`CI=true`,
odrzuca listę zakazanych hostów Railway). Kontener zatrzymany i usunięty po
zakończeniu pracy (`docker rm -f sec-org-test-pg`). Port `5433` (wskazany w
instrukcji) okazał się nasłuchem SSH o niejasnym pochodzeniu
(`lsof` pokazał proces `ssh`, nie kontener Docker) — NIE użyty, żeby
uniknąć przypadkowego trafienia w nieznaną, potencjalnie zdalną bazę.

## Podsumowanie dla nadzorcy

- Gałąź: `sec/cross-org-admin-20260905`, bazowa z `origin/staging`.
- 3 stare dziury cross-org: **0 otwartych**, wszystkie potwierdzone
  zamknięte dowodem mutacyjnym (2 z 3 — trzecia, "wideo", nie jest
  dziurą cross-org).
- 8 tras A52: **0 otwartych** (500→403/200 wszędzie), 6 z nich potwierdzone
  dowodem mutacyjnym.
- tsc: **PASS (exit 0)**.
- CSRF: **globalnie nieaktywne** (walidacja nigdzie niezamontowana) — plan
  4-fazowy w `03_CSRF_MFA_PROPOZYCJA.md`, zero zmian dziś.
- MFA: grace period naprawiony i podłączony; nie zmierzono stanu żywych
  organizacji (zakaz dotykania demo/staging/prod).
- Nie naprawiałem niczego w kodzie produkcyjnym poza dodaniem jednego pliku
  testowego regresyjnego — bo nie znalazłem nic do naprawienia w zakresie
  zlecenia. Uczciwie to zgłaszam zamiast szukać na siłę czegoś do naprawy.
