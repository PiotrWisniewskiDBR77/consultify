# Independent review v2 — W73 K6 Execution labels

**ACCEPT.** Wszystkie trzy blokery z niezależnego review `6d818a12e804df92eef5ea8019a51289bf60a8e9` zostały zamknięte na dokładnym kandydacie `029ca559d27d7503368b1c46ca4ff383e1204d5d` (`origin/backup/codex/d-k6-execution-labels-20260915`).

## Tożsamość i DAG

- baza fali: `f2628a0d36`
- zależność E2b: `3441112167`
- zależność K1: `3dfca08c33`
- poprawka produktu v2: `7a26319c5161f1d9753a24d90771594eb697c4b8`
- dowód powłoki i obrazy: `3ffa899785f8a5f975d681089de9377007b032c8`
- pozostałe logi dowodowe: `937a584b468abba0df6689ab84d774612b856859`
- freeze: `029ca559d27d7503368b1c46ca4ff383e1204d5d`

Łańcuch jest liniowy i zachowuje wymagane zależności. Trzy commity produktowe K6 sprzed v2 mają odpowiednio 5, 2 i 7 plików, a poprawka v2 ma 4 pliki. Limity pakietu są zachowane.

## Zamknięcie trzech blokerów HOLD

1. **Jedenaście fallbackowych tytułów:** wszystkie 11 nazw raportów korzysta teraz z kluczy `execution.reports.catalog.*`. Pomiar na bazie zależności wykazał 11 wystąpień, a na kandydacie 0. Test zachowania potwierdza 11 różnych, niepustych wartości zarówno dla EN, jak i PL.
2. **Dowód wizualny:** oba obrazy pokazują tę samą rzeczywistą trasę `/execution?tab=reports&view=table&documentKind=report&documentId=report%3Aweekly-exec` w pełnym `MainLayout` i `ExecutionHub`. Shell proof potwierdza `expectedTitleCount: 1` oraz `mainLayoutVisible: 1` dla EN i PL. Logi: 0 błędów konsoli i 0 odpowiedzi HTTP 4xx/5xx.
3. **Freeze i manifest:** freeze obejmuje brakujący wcześniej commit `b63dd48`, poprawkę `7a26319`, dowód powłoki `3ffa899` i logi `937a584`. `contentSha` oraz `preFreezeSha` wskazują właściwe elementy łańcucha. Niezależne przeliczenie SHA-256 zakończyło się wynikiem 21/21 zgodnych plików.

## Powtórzone bramki

- test K6: **3/3 PASS** (`--retry=0`)
- focused fingerprint na kandydacie: **25 PASS / 2 FAIL**
- focused fingerprint na dokładnej bazie zależności `3dfca08c33`: **25 PASS / 2 FAIL**; identyczne dwa błędy nazw w `EnterpriseOnboardingWizard`
- `type-check:server`: **PASS**
- `tsc --noEmit --listFilesOnly`: **7427**, RC 0
- pełny frontend `tsc`: dokładny log kandydata zawiera **177** błędów; dwa niezależne powtórzenia zakończyły się limitem 120 s bez wyniku, więc niezależny pomiar liczby pozostaje `NOT_MEASURED`
- build: **PASS**, 10 754 moduły
- language CI: **PASS**
- `check:list-canon`: **349**, bez nowego naruszenia
- `check:artefakt`: **8-0-117**
- esbuild per zmieniony TS/TSX: **2/2 PASS**
- `c-accent`: **16 → 16**
- nowe `as any`: **0**
- migracje: **0**

## Uwagi nieblokujące

- Polski zrzut ma poprawiony tytuł z zakresu K6, lecz sąsiadujące, istniejące wcześniej pola opisu i częstotliwości nadal zawierają angielskie fragmenty. To oddzielny dług językowy poza korektą 11 tytułów.
- `FREEZE.md` podaje `reportPositions` jako `21935 → 21889`, podczas gdy surowy raport CLI kandydata drukuje 21893. Różnica 4 wynika z podkategorii `K1defWID`, która jest wliczona w nagłówek CLI, lecz pominięta w sumie głównych kategorii freeze. Kluczowe wyniki K6 są spójne: `K4obj 4324 → 4287` oraz fallbackowe tytuły `11 → 0`.

Review nie zmienia produktu.
