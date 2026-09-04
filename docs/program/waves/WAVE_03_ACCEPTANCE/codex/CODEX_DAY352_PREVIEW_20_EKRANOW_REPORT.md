# CODEX DAY 352 — podglądy bez `relations`

Stan: **R1 ZROBIONE; R2–R6 w toku**.

## Stan wejściowy

Marker:

```text
MARKER OK
c0f690bae36a386de27f1a349fbb9674ec03c693
```

Sanity worktree (`git status --short | head -3`) dało pusty wynik.

Tip `github-backup/grafika/m03-20260902` był przed markerem o osiem commitów. Zgodnie z DEC-2026-08-26-95 praca zaczęła się dokładnie z markera; scalenie nowszego tipa pozostaje po stronie nadzorcy.

Zasoby przed startem: 39 GiB wolne; porty 6411 i 5551 puste; kontenerów `cx-day352*`: 0. Baza nie została uruchomiona, ponieważ pomiar R1 i harness nie wymagają backendu.

## R1 — własny pomiar

Licznik z `/private/tmp/cx-day352-preview-20-ekranow-scratch/count-standard-preview.mjs` usuwa komentarze `/* */` i `//`, rozpoznaje tag niepoprzedzony znakiem słowa, a blok atrybutów czyta do `>` przy zerowej głębokości klamer.

| Zbiór | Użycia | Pliki | z `relations` | bez `relations` |
| --- | ---: | ---: | ---: | ---: |
| `src/` | 53 | 39 | 27 | 26 w 18 plikach |
| `dev-render/` | 3 | 2 | 1 | 2 w 1 pliku |

Rejestr `SCREENS`: 394 wpisy. Próg `DEFAULT_LUMA_DIFF_THRESHOLD`: 150. `StandardPreview.tsx`: 548 linii. Słowniki: pl 35199, en 33066. Bramki: focus=0, list=0, artefakt=0, reach=0.

### Inwentarz 26 użyć bez `relations`

Klasyfikację `app` odczytano z `scripts/dev/reachability-from-root.mjs`. Wpis harnessu oznacza realny komponent produktu montowany przez wskazany ekran; pięć zakładek audytowych będzie mierzone osobno parametrem `tab`.

| Plik:linia | `relations` | Reach | Wpis `SCREENS` |
| --- | --- | --- | --- |
| `src/components/Audit/method/tabs/AuditFindingsTab.tsx:666` | NIE | app | `audyty-piec-powierzchni&tab=findings` |
| `src/components/Audit/method/tabs/AuditInitiativesTab.tsx:301` | NIE | app | `audyty-piec-powierzchni&tab=initiatives` |
| `src/components/Audit/method/tabs/AuditLibraryTab.tsx:332` | NIE | app | `audyty-piec-powierzchni&tab=library` |
| `src/components/Audit/method/tabs/AuditOutputsTab.tsx:337` | NIE | app | `audyty-piec-powierzchni&tab=outputs` |
| `src/components/Audit/method/tabs/AuditReportsTab.tsx:484` | NIE | app | `audyty-piec-powierzchni&tab=reports` |
| `src/components/CaseWorkspace/CasesListScreen.tsx:1061` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RealizacjaView.tsx:1531` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RealizacjaView.tsx:1620` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RealizacjaView.tsx:1679` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RezultatyView.tsx:1527` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RezultatyView.tsx:1626` | NIE | app | BRAK |
| `src/components/CaseWorkspace/RezultatyView.tsx:1777` | NIE | app | BRAK |
| `src/components/Economics/FinanceHub.tsx:3272` | NIE | app | `finance-hub` |
| `src/components/MyWork/MyProjects.tsx:886` | NIE | app | `zwornik-projects` |
| `src/components/MyWork/MyProjects.tsx:1115` | NIE | app | `zwornik-projects` |
| `src/components/ReportBuilder/BlockTypesManager.tsx:565` | NIE | app | `report-builder-block-types` |
| `src/components/ReportBuilder/TemplatesManager.tsx:692` | NIE | app | `report-builder-templates` |
| `src/components/ResultsVNext/ResultsVNextRegistryShell.tsx:246` | NIE | app | `results-vnext-registry-shell` |
| `src/components/ResultsVNext/attention/ResultsAttentionPage.tsx:287` | NIE | app | `results-vnext-attention` |
| `src/components/SuperAdmin/ModelRegistry/ModelCatalogTable.tsx:851` | NIE | app | `model-catalog-table` |
| `src/components/assessment/library/AssessmentLibraryTab.tsx:583` | NIE | app | `drd-library-entry` |
| `src/views/superadmin/AIPlatformModule/Development/PromptRegistryTab.tsx:315` | NIE | app | `prompt-registry-tab` |
| `src/views/superadmin/revenue/PartnerSettlementsView.tsx:947` | NIE | app | `partner-settlements-view` |
| `src/views/superadmin/revenue/PartnerSettlementsView.tsx:1080` | NIE | app | `partner-settlements-view` |
| `src/views/superadmin/revenue/PartnerSettlementsView.tsx:1155` | NIE | app | `partner-settlements-view` |
| `src/views/superadmin/revenue/PartnerSettlementsView.tsx:1227` | NIE | app | `partner-settlements-view` |

### Grupy pokrycia

1. Własny wpis: `finance-hub`, `report-builder-block-types`, `report-builder-templates`, `results-vnext-registry-shell`, `results-vnext-attention`, `model-catalog-table`, `drd-library-entry`, `prompt-registry-tab`, `partner-settlements-view`.
2. Wspólny wpis: `audyty-piec-powierzchni` jako pięć osobnych ekranów `library`, `findings`, `outputs`, `reports`, `initiatives`; `zwornik-projects` montuje realny `MyProjects` i obejmuje oba użycia w tym komponencie.
3. Bez wejścia: `CasesListScreen`, `RealizacjaView`, `RezultatyView` — 7 użyć. Wynik R4 pozostaje otwarty.

Łącznie R2 obejmie 15 odrębnych ekranów harnessu; brak wejścia dotyczy trzech plików CaseWorkspace.

### Korekty wobec instrukcji

Liczby autora potwierdzone. Skorygowano natomiast listę parametrów wspólnego wpisu audytów: instrukcja podaje `library|processes|outputs|reports|initiatives`, lecz `AuditsMethodHub.tsx:536-537` montuje `AuditFindingsTab` wyłącznie dla `tab=findings`; `tab=processes` montuje `AuditProcessesTab`, który przekazuje `relations`. Dlatego właściwy piąty ekran R2 to `findings`, nie `processes`. Naiwne grepy dały 49 plików z tekstem `<StandardPreview` i 42 wiersze z `relations=`, ale nie są mianownikiem JSX.

## TWIERDZENIA NIEZWERYFIKOWANE

- Wygląd karty w realnej aplikacji na realnych danych; R1 dowodzi osiągalności statycznej, nie zachowania runtime.
- Zachowanie na wąskim ekranie.
- Wygląd trzech ekranów CaseWorkspace bez wejścia harnessu.
- Orzeczenia wizualne i dowody DOM dla 15 ekranów pokrytych harnessem — należą do R2/R3.
