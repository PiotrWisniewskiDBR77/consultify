# M4 — dług testów linii — freeze E1

**Werdykt: READY FOR INDEPENDENT REVIEW, bez ACCEPT przed niezależnym przeglądem.**

- Baza CTO: `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`.
- Produkt i naprawy testów: `4290c7721e`.
- Gałąź: `codex/a-m4-line-test-debt-20260915`.
- Kopia: `origin/backup/codex/a-m4-line-test-debt-20260915`.
- Zakres: 13 plików w trzech commitach, bez migracji, wdrożenia i zmian środowiska.

## Decyzje per obszar

- Interview i Prompt Registry: naprawiono stare atrapy zależności, brak Routera oraz asercje sprzed aktualnych kontraktów autoryzacji, źródła metadanych i układu podglądu. Kod produktu nie wymagał zmiany.
- Execution Reports: kod produktu miał rację co do bezpiecznej obsługi pustych lub wadliwych kopert; dodano osłony `definitions/items`. Test odtworzył aktualny host Menu 2/Menu 3 oraz aktualne etykiety i receipt.
- Execution Work/Resources: test był stary względem hostowanych kontrolek, niezależnego planu zasobów i podglądu osoba → przydział. Dodano host testowy, deterministyczny plan i oczekiwanie na realną opcję przed wyborem.
- Excel: test korzystał ze starej atrapy store i starej powłoki `kimi-shell`; dostosowano go do kanonicznego `spreadsheet-artifact-studio`.
- Idea Process Flow: kod produktu odwoływał się do niezdefiniowanej flagi; podłączono istniejący resolver.
- Organization governed context: usunięto surowy bajt NUL ze źródła przy zachowaniu tego samego klucza runtime.
- Daty list: kod produktu przesuwał datę kalendarzową o dzień w strefie Chicago; prefiks ISO `YYYY-MM-DD` zachowuje dzień kalendarzowy.

## Dowody

- Pakiet skupiony: 11 plików testowych, **74/74 PASS**, `--retry=0`.
- `executionReportsSurface`: **8/8 PASS**.
- `executionWorkResources`: **6/6 PASS**.
- `ExceleView.blankCreation`: **3/3 PASS**.
- `IdeaProcessFlowTool.error-state`: **2/2 PASS**.
- `organizationGovernedContextApi.ingest`: **4/4 PASS**.
- Interview: rubric **7/7**, hub **14/14**, preview footer **10/10**, three states **7/7**.
- Prompt Registry: **6/6 PASS**.
- Surowe bajty NUL w `organizationGovernedContextApi.ts`: **0**.
- `tsc -p server/tsconfig.json --noEmit`: **RED, zastane** — 27 błędów w plikach serwera niezmienionych przez M4; M4 nie zmienia `server/src/**`.
- Szerszy, niewiążący przebieg 20 plików Execution: 85 PASS / 14 RED. Czerwienie są w `MitigationPanel.test.tsx`, `ExecutionManagementTable.t35.test.tsx`, `ExecutionErrorStateExclusivity.test.tsx` i `ExecutionHub.k5Naprawy.behavior.test.tsx`; nie odpowiadają wskazanym w Wpisie 76 przyczynom M4 i pozostają jawne, bez `skip`.

## Bramka

Niezależny review nie został wykonany: wszystkie dostępne sub-agenty zwracają limit użycia konta do 2026-09-21 06:24. Pakiet zatrzymuje się na E1 zgodnie z kanałem CTO.
