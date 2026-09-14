# Q1 P3 Obciążenie — E2–E4 freeze (2026-09-14)

**Werdykt: READY FOR INDEPENDENT EXACT-SHA REVIEW.** Kandydat bazuje na linii `29d1db9f00` z Wpisu 42 i realizuje E2–E4 bez migracji oraz bez zapisu propozycji AI do zadań.

## Zakres

- **E2 — dostępność:** zalogowany użytkownik edytuje własne godziny tygodniowe i procent dostępności przez istniejący profil `users.weekly_capacity_hours` / `users.availability_percent`.
- **E3 — raport obciążenia:** adapter `WORKLOAD_CAPACITY` korzysta ze wspólnego silnika P1 `reportDefinition` / `reportRun`; przebieg dostaje zamrożony snapshot planu zasobów.
- **E4 — propozycje:** odczyt wyłącznie dla kanonicznych etapów planowania `DRAFT`, `PENDING_APPROVAL`, `APPROVED`; odpowiedź ma `planningOnly: true` i `applied: false`. Test RealPG dowodzi, że inicjatywa `IN_EXECUTION` nie trafia do propozycji, a przydział zadania nie zmienia się.
- UI pozostaje za domyślnie wyłączonymi flagami `VITE_INITIATIVES_WORKLOAD`, `ENABLE_INITIATIVES_WORKLOAD`, `VITE_INITIATIVES_WORK_REPORT` i `ENABLE_INITIATIVES_WORK_REPORT`.
- Zachowano zmiany linii: `noCapacityShort`, `cellHintNoCapacity`, wyłączenie capacity w `commandRowContent`, `workReportLabels`, `initiativeStatusLabels` oraz rejestr dev-render.

## Bramka

- Pełna delta testów względem `29d1db9f00`: 4 pliki, **12/12 PASS**, `--retry=0`.
- RealPG na `127.0.0.1:5291`: ApiGateway + JWT + PostgreSQL, **2/2 PASS** w `initiativeWorkload.gateway.pg.test.ts`.
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p server/tsconfig.json --noEmit --pretty false`: **exit 0**.
- Transpilacja esbuild wszystkich 15 zmienionych plików TS/TSX: **15/15 PASS**.
- Detektor zduplikowanych kluczy JSON: EN **0**, PL **0**.
- Produkcyjny build z flagami ON: **PASS**, 10 745 modułów, 43,27 s.
- `git diff --check`: **PASS**; brak znaczników konfliktu w delcie.
- Pełny root `tsc` pozostaje czerwony (`exit 2`) na odziedziczonych błędach poza deltą; nie przedstawiono go jako zielonego dowodu.

## Dowód UI

Harness `dev-render/screens/z30-inicjatywy-obciazenie.tsx` montuje pełny `InitiativesHub`. Po usunięciu kolizji obcego receivera na porcie 4215 wykonano ponowny przejazd na własnym Vite: **7/7 zrzutów, browser errors 0**, łącznie **848 KiB**.

- dostępność i StandardPreview: EN light/dark + PL light;
- propozycje planistyczne: EN light/dark + PL light/dark;
- widoczne: StandardModuleBar, StandardTable, StandardPreview, kebab wiersza, standardowe dropdowny, etykiety EN/PL oraz semantyczny kolor krytyczny tylko dla przeciążenia/braku pojemności.

Pliki są w `evidence/q1-p3-workload/e234-*.jpg`; każdy ma pokwitowanie `.jpg.json` z URL-em, viewportem i pustą listą błędów.

## Luka hooka znaczników konfliktu

Commit `1f0d65f778` zawierał literalne `<<<<<<<`, ponieważ aktywny `core.hooksPath=.husky` uruchamia `.husky/pre-commit`, który **nie wywołuje** detektora z `scripts/git-tools/hooks/pre-commit`. Detektor istnieje w repozytorium, ale leży poza aktywną ścieżką hooków. Odzyskana delta została sprawdzona jawnie przed pierwszym commitem i ponownie przed freeze.

## Łańcuch odzyskania

- zły, historyczny WIP: `1f0d65f778` — nieużywany;
- przeniesiony WIP przed rebase: `c10025ffb744dc82ccdb7b85e82fe8805128241a`;
- immutable backup przed rebase: `backup/codex/obciazenie-inicjatyw-20260914-e234-prerebase-20260914`;
- WIP po rebase: `1d769f39e706bcb0bd86f8db0f0ba5d3ba991cb0`;
- immutable backup WIP po rebase: `backup/codex/obciazenie-inicjatyw-20260914-e234-rebased-wip-20260914`.

Po commicie freeze dokument należy uzupełnić w meldunku o końcowy SHA i immutable ref `backup/codex/obciazenie-inicjatyw-20260914-e234-freeze-20260914`.
