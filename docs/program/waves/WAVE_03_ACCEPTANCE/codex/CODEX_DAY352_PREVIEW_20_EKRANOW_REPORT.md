# CODEX DAY 352 — podglądy bez `relations`

Stan: **R1–R3 ZROBIONE z nazwaną granicą; R4–R6 w toku**.

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
- Orzeczenie `AuditFindingsTab`, którego istniejący runner nie doprowadził do niepustego programu.

## R2 — pary PRZED/PO i granica dowodu

Kanoniczny runner pracował na `http://127.0.0.1:5551`, w obu motywach, z `--rozwin-sekcje=1`, `--klik-po-rozwinieciu=1`, `--osiad-po-rozwinieciu=800`. Marker `[data-preview-block="details"]` był obecny w obu motywach każdej zaliczonej pary. Pomiar DOM po zmianie: karta 107 px, pusty stan 1, pigułki 0. Pełne JSON-y kontroli i PNG są w `evidence/podglad-relations-20260904/`.

Zaliczone różne bajtowo pary PRZED/PO: 24/28 par motywowych dla 12 ekranów. Cztery identyczne pliki dotyczą `results-vnext-registry-shell` i `results-vnext-attention`: oba ekrany już PRZED miały pustą kartę przez dane przekazane w spreadzie, więc zmiana `StandardPreview` nie zmieniła ich runtime. To obala założenie, że brak jawnego atrybutu `relations=` oznacza brak wartości propa.

`finance-hub&tab=analysis` zmienił liczbę pustych bloków z 1 na 2: własna stopka Finance miała już blok, a domyślny blok `StandardPreview` dodał drugi.

`AuditFindingsTab` nie uzyskał pary: wpis `tab=findings` działa, lecz domyślnie wybiera pierwszy program z zerem ustaleń. Właściwa fixture `prog-metalpol-zakupy` istnieje, ale komponent nie czyta `programId` z URL, a runner nie ma opcji `selectOption`. Dodanie drugiej nowej opcji naruszałoby licencję „jedna opcja opt-in”; zachowano dwa zrzuty pustej tabeli jako dowód granicy.

Po cofnięciu tymczasowej mutacji:

```text
$ git diff -- src/components/standard/StandardPreview.tsx
<pusty wynik>
```

## R3 — orzeczenie po obejrzeniu własnych zrzutów

- `audyty-piec-powierzchni&tab=library` — **WYGLĄDA DOBRZE**: na pliku PO-light karta zachowuje szerokość panelu i pojawia się dopiero pod długą tabelą szczegółów, bez przykrywania treści.
- `audyty-piec-powierzchni&tab=outputs` — **WYGLĄDA DOBRZE**: PO-light pokazuje czytelną pojedynczą kartę pod właściwościami, z zachowanym oddechem.
- `audyty-piec-powierzchni&tab=reports` — **WYGLĄDA DOBRZE**: PO-light ma pojedynczy blok w logicznym miejscu po szczegółach raportu.
- `audyty-piec-powierzchni&tab=initiatives` — **WYGLĄDA DOBRZE**: PO-light zachowuje krótką, uporządkowaną stopkę bez kolizji z tabelą.
- `zwornik-projects` — **WYGLĄDA DOBRZE**: PO-light dodaje blok nad przyciskiem „Odśwież”, zachowując pełną szerokość i czytelność.
- `report-builder-block-types` — **WYGLĄDA DOBRZE**: PO-light ma pojedynczą kartę pod szczegółami, a pusty obszar panelu pozostaje uporządkowany.
- `report-builder-templates` — **WYGLĄDA DOBRZE**: PO-light zachowuje hierarchię Details → Relations → akcja, bez przycięcia.
- `model-catalog-table` — **WYGLĄDA DOBRZE**: PO-light umieszcza kartę przed trzema akcjami, bez wypchnięcia ich poza kadr.
- `drd-library-entry` — **WYGLĄDA DOBRZE**: PO-light pokazuje blok na dole przewijalnego panelu; treść szczegółów nie została przykryta.
- `prompt-registry-tab` — **WYGLĄDA DOBRZE**: PO-light dodaje jeden spokojny blok pod krótkimi szczegółami, bez konkurencji z inną stopką.
- `partner-settlements-view` — **WYGLĄDA DOBRZE**: PO-light zachowuje blok w granicach panelu i nie odbiera miejsca tabeli głównej.
- `results-vnext-registry-shell` — **BEZ ZMIANY RUNTIME**: obrazy PRZED/PO są identyczne bajtowo; widoczny pojedynczy blok pochodził już z obiektu `preview`.
- `results-vnext-attention` — **BEZ ZMIANY RUNTIME**: obrazy PRZED/PO są identyczne bajtowo; statyczny licznik dał fałszywy sygnał zmiany.
- `finance-hub&tab=analysis` — **WYGLĄDA ŹLE**: PO-light pokazuje dwie sąsiadujące, identyczne karty „Powiązania / Brak powiązań”, które dublują komunikat i zajmują łącznie 214 px.

Miejsce potrzebne treści zabiera `finance-hub&tab=analysis` (drugi, redundantny blok 107 px). Na pozostałych obejrzanych ekranach pojedynczy blok zajmuje 107 px, ale nie przykrywa ani nie usuwa treści; jest kosztem przewijania, nie utratą informacji. Ocena dotyczy hosta harnessu 1440×900, nie realnej trasy produkcyjnej.

## R4 — STOP MERYTORYCZNY dla CaseWorkspace

Rodzaj: **MERYTORYCZNY**. `grep -rn 'CasesListScreen\|RealizacjaView\|RezultatyView' dev-render/` zwrócił 0 trafień. Licencja B.1 pozwala dodać nowe wpisy i ekrany tylko wtedy, gdy montują realne komponenty produktu.

Brakuje kompletnej fixture `CaseCoreView`, kontekstu routera i stubów Case API dla `CasesListScreen`; dla `RealizacjaView` i `RezultatyView` dodatkowo danych kroków, oczekiwań, propozycji, uruchomień, artefaktów, pomiarów i ich stanów async. Szacuję 2–4 godziny na trzy realne hosty wraz z kontrolą, że nie są replikami. Wpisy miałyby postać `case-workspace-list`, `case-workspace-realizacja`, `case-workspace-rezultaty`, każdy importujący komponent z `src/components/CaseWorkspace/` i korzystający ze wspólnej fixture Case.

Co dostarczyłem zamiast zmiany: własny pomiar 7 użyć bez `relations`, klasyfikację `app`, listę wymaganych zależności i projekt trzech wpisów. Nie dosypałem `relations` do wołaczy. Pozostałe pozycje kontynuuję.

## R5 — rekomendacja i decyzja właściciela

Rekomendacja: **zostawić pojedynczą pustą kartę jako jawny stan „Brak powiązań”, ale osobno usunąć dublowanie w Finance po decyzji właściciela**. Podstawa: 13 obejrzanych powierzchni jest spójnych wizualnie, 1 wygląda źle wyłącznie dlatego, że pokazuje dwie karty, a 2 wpisy Results nie zmieniły runtime. Pojedyncza karta nie usunęła treści; realny koszt 107 px stał się defektem dopiero przy duplikacie 214 px.

SSOT jest sprzeczny: `docs/ui-standards/TRIADA_KANON.md:70` i checklista `:132` wymagają Relations albo „No relations”, czyli bloku zawsze; `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337` mówi „Relations … jeśli są”, czyli blok tylko przy danych.

**DO DECYZJI WŁAŚCICIELA.** Czy pojedyncza karta „Brak powiązań” ma pozostać na ekranach, które nie deklarują powiązań — **tak/nie**? Do samodzielnego rozstrzygnięcia zabrakło mi wskazania, który z dwóch sprzecznych zapisów SSOT ma pierwszeństwo; oględziny rozstrzygają jakość kompozycji, lecz nie intencję produktową.
