# P5 — eksport i usunięcie danych organizacji — dowody 2026-09-10

Środowisko: lokalny, izolowany kontener Postgres (`pgvector/pgvector:pg16`,
`consultify-p5-eksport-pg`, port 54533), NIE staging/demo. Organizacja testowa
`org-p5-test-001` zasiana ręcznie (users/projects/initiatives/tasks).

## Pliki

- `organization-export-org-p5-test-001.json` — realny eksport zwrócony przez
  `GET /api/superadmin/organizations/org-p5-test-001/export` (format JSON,
  domyślny). Zawiera pełny wiersz `organizations` + wszystkie dopasowane
  wiersze z tabel `users`, `projects`, `initiatives`, `tasks`.
- `organization-export-org-p5-test-001.csv` — ten sam eksport, `?format=csv`
  (`table,row_index,data_json`).
- `transcript-2026-09-10.log` — pełny transkrypt przebiegu HTTP: eksport JSON,
  eksport CSV, próba usunięcia BEZ nazwy organizacji (428
  `ORG_NAME_CONFIRMATION_REQUIRED`, organizacja nietknięta), usunięcie Z
  poprawną nazwą (200, `deletedCounts` per tabela — dynamicznie odkryte
  WSZYSTKIE tabele ze wskaźnikiem na organizację, nie tylko 5 zaszytych),
  pomiar wiersza wzorcowego `ie_governance_policies('*')` PRZED i PO (bez
  zmian), i pełny przepływ zapisu PO usunięciu (nowa organizacja + nowa
  inicjatywa + nowe zadanie, wszystkie utworzone poprawnie).

## Testy automatyczne (powtarzalne, real Postgres)

- `server/src/services/__tests__/organizationLifecycleService.realpg.test.ts`
  — poziom serwisu.
- `server/src/routes/__tests__/organizationLifecycle-superadmin.http.pg.test.ts`
  — poziom HTTP (realny router, realny podpisany JWT).

Uruchomienie:
```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL="postgresql://<user>:<pass>@<host>:<port>/<baza>" \
npx vitest run server/src/services/__tests__/organizationLifecycleService.realpg.test.ts \
  server/src/routes/__tests__/organizationLifecycle-superadmin.http.pg.test.ts
```
Oba pliki uruchomione i zielone 3× pod rząd przed tym commitem.

## Czego TU BRAK (świadomie, patrz meldunek STOP)

Brak zrzutu ekranu z przyciskiem eksportu w interfejsie — taki przycisk
DZIŚ NIE ISTNIEJE. Backend eksportu jest gotowy i przetestowany
(`GET /api/superadmin/organizations/:id/export`), ale oba naturalne miejsca
na przycisk (`src/views/superadmin/OrganizationsView.tsx` — moduł 14_ADMIN,
`src/components/settings/DataControlsSettings.tsx` — moduł 15_SETTINGS) są
zamrożone jako MVP final, a DEC-457 obejmuje wyłącznie tekst pustego stanu i
podpięcie ISTNIEJĄCEGO handlera — dodanie NOWEGO przycisku wymaga osobnego
numeru odmrożenia. Zamiast fałszywego zrzutu — powyższy plik eksportu i
transkrypt HTTP jako dowód, że mechanizm działa.

Zrzut potwierdzenia usunięcia (`window.prompt` z wpisaniem nazwy organizacji)
też nie jest tu jako obrazek — to natywny dialog przeglądarki, nie komponent
wizualny wymagający odbioru wg `TRIADA_KANON.md`. Dowodem działania jest
transkrypt HTTP powyżej (428 bez nazwy → 200 z poprawną nazwą) plus opis
zmiany w `src/views/superadmin/OrganizationsView.tsx` (commit
`fix(admin): wire the broken organization-delete confirmation flow`).
