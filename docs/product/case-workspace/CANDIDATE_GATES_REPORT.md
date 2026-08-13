# PAKIET G — Bramki kandydata (build/static + baza)

Data: 2026-08-11
Worktree: `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` (branch `claude/case-workspace-v1-20260809`)
Zakres: `src/components/CaseWorkspace/**`, `server/src/services/caseWorkspace/**`, `server/src/routes/caseWorkspace/**`

Zasada raportu: każdy wynik poniżej pochodzi z realnie uruchomionej komendy w tej sesji, z widocznym exit code. Kod NIE był modyfikowany — wszystko poniżej to STAN ZASTANY.

---

## Tabela zbiorcza: bramka → exit code → wynik

| # | Bramka | Komenda | Exit code | Wynik |
|---|---|---|---|---|
| 1 | Frontend typecheck | `npx tsc -p tsconfig.json --noEmit` (całe repo; `NODE_OPTIONS=--max-old-space-size=8192` — bez tego proces OOM-uje, exit 134, patrz Uwagi) | **2** | **2 błędy TS**, oba w zakresie Case Workspace (patrz niżej) |
| 2 | Server typecheck | z `server/`: `npx tsc --noEmit` (`NODE_OPTIONS=--max-old-space-size=8192`) | **2** | **8 błędów TS**, wszystkie w `server/src/{routes,services}/caseWorkspace/**` |
| 3a | Lint — frontend Case Workspace | `npx eslint 'src/components/CaseWorkspace/**' --quiet` | **1** | **23 problemy** (23 błędy: `prettier/prettier` formatowanie + `simple-import-sort/imports` w 2 plikach) |
| 3b | Lint — server Case Workspace | `npx eslint 'server/src/services/caseWorkspace/**' 'server/src/routes/caseWorkspace/**' --quiet` | **1** | **7331 problemów** (7331 błędów — patrz Uwagi: root eslint prawdopodobnie nigdy nie był uruchamiany na `server/`) |
| 4a | `check-list-canon.sh` | `bash scripts/check-list-canon.sh` (staging pusty → fallback pełny skan repo) | **0** | PASS — 408 naruszeń vs baseline 409, dług nie rośnie (spadł o 1) |
| 4b | `check-artefakt.sh` | `bash scripts/check-artefakt.sh` (pełny skan) | **0** | PASS — crimson w powłoce artefaktów 7 = baseline 7, dług nie rośnie |
| 4c | `check-gestosc.sh` | `bash scripts/check-gestosc.sh <57 plików CaseWorkspace jawnie>` | **0** | PASS — 57 plików sprawdzonych, brak regresji mechanicznych |
| 4d | `check-triada.sh` | `bash scripts/check-triada.sh <57 plików CaseWorkspace jawnie>` | **0** | PASS — 17 plików faktycznie dotyczyło reguł triady, brak nowych naruszeń crimson |
| 4e | `check-focus-canon.sh` | `bash scripts/check-focus-canon.sh` (pełny skan repo, skrypt nie przyjmuje ścieżek) | **0** | Skrypt tylko RAPORTUJE (nie blokuje): 129 plików / 260 wystąpień crimson-jako-focus w CAŁYM repo; Case Workspace nie jest w TOP 10 winowajców (patrz Uwagi) |
| 5 | Skan atrap (fixture/mock/daneProbne/stub) | `grep -rniE "fixture\|mock\|daneProbne\|stub"` w obu ścieżkach, poza `__tests__` i `podglad` | — | **12 trafień**, WSZYSTKIE fałszywe pozytywy (komentarze/nazwy pól domenowych, nie atrapy) — lista niżej |
| 6 | Świeża migracja od zera — przebieg 1 | `DB_TYPE=postgres LC_ALL=C NODE_ENV=test DATABASE_URL=postgresql://.../case_workspace_gates_fresh npm run db:migrate:strict` | **0** | Wszystkie migracje repo (w tym 20 migracji `case_workspace`/`case_core`) zaaplikowane, `✅ Postgres migrations complete` |
| 6 | Świeża migracja od zera — przebieg 2 (idempotencja) | ta sama komenda, druga baza ta sama | **0** | `Applying migrations: 0` — potwierdzone |
| 6 | Liczba tabel `case_workspace_*` | zapytanie do `information_schema.tables` | — | **18** tabel z prefiksem `case_workspace_` + 5 tabel Case Workspace bez tego prefiksu (`case_core`, `case_plan_versions`, `case_plan_view_state`, `process_definitions`, `process_versions`) = **23 tabele domeny Case Workspace**; baza świeża ma **1370** tabel publicznych łącznie |
| 7 | Pełny suite services+routes na ŚWIEŻEJ bazie | z `server/`: `vitest run` na 54 plikach (`src/services/caseWorkspace/__tests__/**/*.pg.test.ts` poza `e2e/`,`performance/` + `src/routes/caseWorkspace/__tests__/**/*.test.ts`) z pełnym env DB (patrz komenda testowa w allowliście) | **0** | **54/54 plików PASS, 466/466 testów PASS** |
| 8 | Determinizm — przebieg 1/3 (services, 38 plików) | jw., ta sama świeża baza, tylko `services/__tests__` | **0** | 38/38 plików, 348/348 testów PASS |
| 8 | Determinizm — przebieg 2/3 | jw. | **0** | 38/38 plików, 348/348 testów PASS — IDENTYCZNIE jak przebieg 1 |
| 8 | Determinizm — przebieg 3/3 | jw. | **0** | 38/38 plików, 348/348 testów PASS — IDENTYCZNIE jak przebiegi 1-2 |

Baza `case_workspace_gates_fresh` usunięta po zakończeniu (gate 7/8) — `DROP DATABASE` potwierdzony.

---

## Szczegóły — Gate 1: frontend `tsc --noEmit`

Bez `NODE_OPTIONS=--max-old-space-size=8192` proces **kończy się OOM (exit 134)** — heap V8 default nie wystarcza na cały projekt (zgodnie z wcześniej znaną pułapką). Z podniesionym limitem: **exit 2**, 2 błędy, oba fizycznie w Case Workspace:

```
src/components/CaseWorkspace/podglad/daneProbne.ts(40,3): error TS2322:
  Type '{ ...; caseName?: string | undefined; ... }' is not assignable to type 'CaseCoreView'.
  Types of property 'caseName' are incompatible.

src/components/CaseWorkspace/RezultatyView.tsx(1179,19): error TS2322:
  Type '"neutral" | "critical" | "success" | "warning" | "danger"' is not assignable to
  type '"neutral" | "success" | "info" | "warning" | "danger" | undefined'.
```

Cały frontend repo (nie tylko Case Workspace) ma dokładnie te 2 błędy — poza zakresem Case Workspace typecheck jest czysty.

## Szczegóły — Gate 2: server `tsc --noEmit`

Exit 2, 8 błędów, wszystkie w `server/src/{routes,services}/caseWorkspace/**`:

1. `routes/caseWorkspace/capabilities.routes.ts:91` — `approvalRecommendation` string union niezgodny z `RegisterCapabilityInput` (`"AUTO"|"NOTIFY_ONLY"|"REQUIRE_APPROVAL"` vs `"requires_human_approval"|"policy_approvable"|"auto_executable"`)
2. `routes/caseWorkspace/casePlanVersions.routes.ts:83` — `semanticGraph.nodes: Record<string,unknown>[]` niezgodne z `GraphNode[]` (brak `nodeId`)
3. `routes/caseWorkspace/casePlanVersions.routes.ts:139` — to samo (drugie miejsce)
4. `routes/caseWorkspace/play.routes.ts:192` — to samo w `processDefinitionId`/`semanticGraph`
5. `routes/caseWorkspace/play.routes.ts:239` — to samo (drugie miejsce)
6. `services/caseWorkspace/__tests__/_helpers/fixtureCleanup.ts:107` — `T` nie spełnia `QueryResultRow`
7. `services/caseWorkspace/caseWorkspaceAuthContext.ts:266` — `instanceof` na typie niepoprawnym
8. `services/caseWorkspace/migrationReadinessService.ts:516` — `result` implicit `any` (self-reference w inicjalizatorze)

## Szczegóły — Gate 3: lint

- **Frontend** (`src/components/CaseWorkspace/**`): 23 błędy, wyłącznie kosmetyczne — `prettier/prettier` (formatowanie) + `simple-import-sort/imports` w `CasesListScreen.tsx` i `podglad/main.tsx`. Zero błędów logicznych/reguł bezpieczeństwa.
- **Server** (`server/src/{services,routes}/caseWorkspace/**`): **7331 błędów**, exit 1. Prawie wszystkie to `prettier/prettier` (formatowanie różniące się od stylu narzuconego przez korzeniowy `eslint.config.js`) + kilka `simple-import-sort/imports`. UWAGA: w `server/` nie ma własnego `eslint.config.js`/`.eslintrc*` ani skryptu `lint` w `server/package.json` — root config prawdopodobnie nigdy nie był uruchamiany na `server/src`, więc ta liczba to CAŁY zastany dług formatowania, nie regresja tej zmiany. Nie potrafię odróżnić bez `git blame`/diffu, ile z tego wprowadził kandydat Case Workspace vs ile jest odziedziczone — zgłaszam surowy wynik, decyzja czy to bramkuje należy do koordynatora.

## Szczegóły — Gate 4: skrypty bramkowe repo

Wszystkie 5 exit 0. `check-gestosc.sh` i `check-triada.sh` normalnie operują na git diff/staging — staging tego worktree był pusty, więc uruchomiłem je z **jawną listą 57 plików** Case Workspace (`find src/components/CaseWorkspace server/src/services/caseWorkspace server/src/routes/caseWorkspace -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*__tests__*"`). `check-list-canon.sh` i `check-artefakt.sh` nie przyjmują plików CaseWorkspace jawnie w trybie ratchet — wykonały pełny skan repo z fallbackiem (odnotowany w ich własnym stdout), dług nie rośnie. `check-focus-canon.sh` to raport bez trybu plikowego — działa na całym repo i tylko informuje (nie blokuje); Case Workspace nie pojawia się w jego TOP 10 najgorszych plików.

## Szczegóły — Gate 5: skan atrap w ścieżce produkcyjnej

Komenda: `grep -rniE "fixture|mock|daneProbne|stub"` w `src/components/CaseWorkspace` i `server/src/{services,routes}/caseWorkspace`, z wykluczeniem `__tests__` i `podglad`.

12 trafień, wszystkie sprawdzone ręcznie — **żadne nie jest atrapą w ścieżce produkcyjnej**:

| Plik:linia | Treść | Ocena |
|---|---|---|
| `src/components/CaseWorkspace/RezultatyView.tsx:489` | komentarz `// fixture'ach ani w pamięci sesji.` | komentarz, nie kod |
| `src/components/CaseWorkspace/types.ts:186` | komentarz odsyłający do `podglad/daneProbne.ts` | odniesienie w dokumentacji typu do pliku podglądowego (już wykluczonego) |
| `server/src/services/caseWorkspace/caseIntakeService.ts:170` | komentarz cytujący nazwę innego, ZEWNĘTRZNEGO pliku: `chatExecutionService.ts:132` ("heuristic stub") | plik `chatExecutionService.ts` leży w `server/src/services/v8/`, **POZA zakresem Case Workspace** — to tylko odniesienie dokumentacyjne, nie atrapa w tym pakiecie |
| `server/src/services/caseWorkspace/capabilityRegistryService.ts:179,214,246,378,509,543` (6×) | pole domenowe `test_fixture_ref`/`testFixtureRef` w schemacie `Capability` | legalne pole biznesowe (referencja do fixture'a testowego DANEGO capability rejestrowanego przez integratora), nie mock w kodzie Case Workspace |
| `server/src/routes/caseWorkspace/capabilities.routes.ts:73` | walidacja zod tego samego pola `testFixtureRef` | jw. |
| `server/src/services/caseWorkspace/caseCoreService.ts:337` | komentarz wzmiankujący `*.pg.test.ts fixture files` | komentarz opisowy, nie kod |

**Wynik: BRAK atrap w ścieżce produkcyjnej Case Workspace.**

## Szczegóły — Gate 6: świeża migracja od zera

Baza `case_workspace_gates_fresh` utworzona przez `CREATE DATABASE ... OWNER case_workspace` na tym samym serwerze Postgres (`127.0.0.1:55432`, `psql` niedostępny w PATH — użyto modułu `pg` przez `node -e`).

- Przebieg 1: `db:migrate:strict` → exit 0, log kończy się `✅ Postgres migrations complete`.
- Przebieg 2 (ta sama baza, ta sama komenda): exit 0, `Applying migrations: 0` — potwierdzona idempotencja.
- Tabele: **18** o prefiksie `case_workspace_*` + **5** tabel domeny Case Workspace bez tego prefiksu (`case_core`, `case_plan_versions`, `case_plan_view_state`, `process_definitions`, `process_versions`) = **23** tabele łącznie. Baza świeża ma **1370** tabel publicznych w sumie (cały monorepo, nie tylko Case Workspace).

## Szczegóły — Gate 7: pełny suite na świeżej bazie (przed usunięciem)

Komenda testowa z allowlistu, z dodatkiem `DATABASE_URL` wskazującym na `case_workspace_gates_fresh` zamiast bazy współdzielonej. Zbiór plików: wszystkie `*.pg.test.ts` pod `server/src/services/caseWorkspace/__tests__/**` **z wyjątkiem** `e2e/**` i `performance/**` (te wymagają osobno uruchomionego procesu serwera na porcie 3001 wskazującego na TĘ konkretną bazę — poza zakresem tej bramki statycznej/bazodanowej; nie zostały pominięte ze względu na oczekiwany fail, tylko dlatego że to inna kategoria testu — live-process HTTP, nie DB-only) + wszystkie testy pod `server/src/routes/caseWorkspace/__tests__/**` (w tym `contract/**`).

**54 pliki, 466 testów — wszystkie PASS, exit 0.** Zgodne co do kierunku z wcześniej potwierdzonym przez koordynatora „372 services + 118 routes/contract" na bazie współdzielonej (tu: 348 services + 118 routes/contract = 466, na bazie CAŁKOWICIE świeżej, bez żadnych resztek).

## Szczegóły — Gate 8: determinizm (3× pod rząd, ta sama świeża baza)

Zbiór: 38 plików `services/__tests__/**/*.pg.test.ts` (bez `e2e/`, `performance/`), na tej samej bazie `case_workspace_gates_fresh`, bez czyszczenia między przebiegami.

| Przebieg | Pliki | Testy | Exit |
|---|---|---|---|
| 1 | 38/38 PASS | 348/348 PASS | 0 |
| 2 | 38/38 PASS | 348/348 PASS | 0 |
| 3 | 38/38 PASS | 348/348 PASS | 0 |

**Wyniki identyczne we wszystkich trzech przebiegach — brak defektu izolacji.**

---

## Literalnie: co jest BLOCKED / PARTIAL / EVIDENCE_MISSING

- **Gate 1 (frontend typecheck): PARTIAL** — 2 błędy TS realnie w kodzie Case Workspace (`podglad/daneProbne.ts`, `RezultatyView.tsx`). Nie BLOCKED w sensie infrastruktury (komenda się uruchamia i kończy), ale kandydat nie jest tsc-czysty.
- **Gate 2 (server typecheck): PARTIAL** — 8 błędów TS, wszystkie w `caseWorkspace` (routes: niezgodność `semanticGraph.nodes`/`GraphNode` w 4 miejscach + `approvalRecommendation` enum; services: 3 błędy typowania pomocnicze/testowe).
- **Gate 3 (lint): PARTIAL/EVIDENCE_MISSING dla server** — frontend 23 błędy kosmetyczne (formatowanie). Server: 7331 błędów, ALE **brak dowodu, że to regresja tej zmiany a nie odziedziczony dług** — `server/` nie ma własnego eslint configu ani `lint` scriptu, więc prawdopodobnie root config nigdy wcześniej nie biegł po `server/src`. Zgłaszam surowy wynik; ocena „czy to bramkuje" wymaga decyzji koordynatora (np. porównania z `git diff` przeciw bazie).
- Gate 4 (skrypty bramkowe repo): **PASS** wszystkie 5, dług nie rośnie.
- Gate 5 (skan atrap): **PASS** — brak realnych atrap.
- Gate 6 (świeża migracja): **PASS** — exit 0 obu przebiegów, idempotencja potwierdzona.
- Gate 7 (suite na świeżej bazie): **PASS** — 466/466.
- Gate 8 (determinizm): **PASS** — 3/3 identyczne.

Żaden wynik powyżej nie jest atrapą, 401 ani danymi próbnymi podstawionymi za PASS — wszystkie komendy uruchomiono realnie na żywym Postgresie (`127.0.0.1:55432`), logi z pełnym stdout/stderr zachowane w scratchpadzie sesji.
