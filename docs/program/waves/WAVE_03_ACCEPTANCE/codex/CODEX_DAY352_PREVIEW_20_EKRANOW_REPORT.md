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


## R6 — manifest, testy, korekty i status końcowy

### Pełny manifest 60 zaliczonych PNG

| Kontekst | Faza | Motyw | PNG | SHA-256 | Luma | DOM | Wys. | Empty | Pigułki |
| --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: |
| finance-hub | PRZED | light | `evidence/podglad-relations-20260904/core/finance-hub__PRZED__pl__1440__light.png` | `ffd9bc53482d1bd12b6917fbed35d487626aabae56e7f53c70539702efc26c11` | 247.271 | TAK | 107 | 1 | 0 |
| finance-hub | PRZED | dark | `evidence/podglad-relations-20260904/core/finance-hub__PRZED__pl__1440__dark.png` | `a0c198e5313531bbe7c750f977474c7be15f62a1fa26048b34c09c22e643cd9b` | 25.647 | TAK | 107 | 1 | 0 |
| zwornik-projects | PRZED | light | `evidence/podglad-relations-20260904/core/zwornik-projects__PRZED__pl__1440__light.png` | `3d3dea249732249670f2ada5c8ba66328bbde63de6c2d93394c8e27178cb1000` | 248.656 | TAK | — | 0 | 0 |
| zwornik-projects | PRZED | dark | `evidence/podglad-relations-20260904/core/zwornik-projects__PRZED__pl__1440__dark.png` | `0c5799e5ba1cc71e0c56dff4b2981f1c29c3fa1b3a13e36b4288ec3e018afcfe` | 22.805 | TAK | — | 0 | 0 |
| report-builder-block-types | PRZED | light | `evidence/podglad-relations-20260904/core/report-builder-block-types__PRZED__pl__1440__light.png` | `4f51ca58d5fc1b8717d65df3b25078aba5bb3e0f3235dc68d40255c8f7e1f95f` | 248.061 | TAK | — | 0 | 0 |
| report-builder-block-types | PRZED | dark | `evidence/podglad-relations-20260904/core/report-builder-block-types__PRZED__pl__1440__dark.png` | `dc31e97b9089a8bb2a7d06d8bc8f8642efe10410c3e9c53a662a0746cac8b23f` | 26.709 | TAK | — | 0 | 0 |
| report-builder-templates | PRZED | light | `evidence/podglad-relations-20260904/core/report-builder-templates__PRZED__pl__1440__light.png` | `48933dd4686eb89e79116b975108ff4cbcfcb363449d47a95dd0a5e2ba1009d7` | 247.716 | TAK | — | 0 | 0 |
| report-builder-templates | PRZED | dark | `evidence/podglad-relations-20260904/core/report-builder-templates__PRZED__pl__1440__dark.png` | `4dae3c8aa48cc03c4da5953142c0b25da1e17f353cc01286096405dbf0697be7` | 25.860 | TAK | — | 0 | 0 |
| results-vnext-registry-shell | PRZED | light | `evidence/podglad-relations-20260904/core/results-vnext-registry-shell__PRZED__pl__1440__light.png` | `481c400a565ed09f6cfde18937d786ceb046fecef34346241290b179e23bf049` | 247.981 | TAK | 107 | 1 | 0 |
| results-vnext-registry-shell | PRZED | dark | `evidence/podglad-relations-20260904/core/results-vnext-registry-shell__PRZED__pl__1440__dark.png` | `41fc46f54cfad264e4b4ecd298fe63e59cefb90769ed8fabf1cf61783ecb3a19` | 23.438 | TAK | 107 | 1 | 0 |
| results-vnext-attention | PRZED | light | `evidence/podglad-relations-20260904/core/results-vnext-attention__PRZED__pl__1440__light.png` | `16b3fb6f4d59f3551ecbc971157dd82f580592101822842280ceb63e6c6f8f6e` | 249.702 | TAK | 107 | 1 | 0 |
| results-vnext-attention | PRZED | dark | `evidence/podglad-relations-20260904/core/results-vnext-attention__PRZED__pl__1440__dark.png` | `b50562e45540bb206d83ee96fe6bd0ddb9eacfeaf448d9f21bb0ee7fa6739137` | 20.557 | TAK | 107 | 1 | 0 |
| model-catalog-table | PRZED | light | `evidence/podglad-relations-20260904/core/model-catalog-table__PRZED__pl__1440__light.png` | `7d5db9999b9c862346d9411707f42ccff24227fb250c2eb092a5ff81bf146e1e` | 247.189 | TAK | — | 0 | 0 |
| model-catalog-table | PRZED | dark | `evidence/podglad-relations-20260904/core/model-catalog-table__PRZED__pl__1440__dark.png` | `1fdf0133cb57c83fcf1e45f0f03f37408134405841638ab76cd86b663a3395f6` | 25.186 | TAK | — | 0 | 0 |
| drd-library-entry | PRZED | light | `evidence/podglad-relations-20260904/core/drd-library-entry__PRZED__pl__1440__light.png` | `cefe69e380f1c173fb63ac95aac82def45c3b0f520e9efea41c46a99a10ea344` | 245.139 | TAK | — | 0 | 0 |
| drd-library-entry | PRZED | dark | `evidence/podglad-relations-20260904/core/drd-library-entry__PRZED__pl__1440__dark.png` | `776218c658a42710cbb8fb31d1f969826486bc2eb6a994712ad9bb81bd5aacec` | 29.449 | TAK | — | 0 | 0 |
| prompt-registry-tab | PRZED | light | `evidence/podglad-relations-20260904/core/prompt-registry-tab__PRZED__pl__1440__light.png` | `4e460377924c869bbae427ed1fa6c130ef3c9e4a7acad4b8f58bc02117d873b1` | 248.860 | TAK | — | 0 | 0 |
| prompt-registry-tab | PRZED | dark | `evidence/podglad-relations-20260904/core/prompt-registry-tab__PRZED__pl__1440__dark.png` | `26d6d081a0465083705eb6ad9ce02d60a989a4a895760be3a53fd82191a25c05` | 24.215 | TAK | — | 0 | 0 |
| partner-settlements-view | PRZED | light | `evidence/podglad-relations-20260904/core/partner-settlements-view__PRZED__pl__1440__light.png` | `0208f96aa6748509aac790eba794853892a492283a3eed35b4669bbc9d4f3758` | 245.811 | TAK | — | 0 | 0 |
| partner-settlements-view | PRZED | dark | `evidence/podglad-relations-20260904/core/partner-settlements-view__PRZED__pl__1440__dark.png` | `d18c769995d67d245f509991516fa65381480d5f18d8803728e9a64e97bbb226` | 25.562 | TAK | — | 0 | 0 |
| finance-hub | PO | light | `evidence/podglad-relations-20260904/core/finance-hub__PO__pl__1440__light.png` | `ffd9bc53482d1bd12b6917fbed35d487626aabae56e7f53c70539702efc26c11` | 247.271 | TAK | 107 | 1 | 0 |
| finance-hub | PO | dark | `evidence/podglad-relations-20260904/core/finance-hub__PO__pl__1440__dark.png` | `a0c198e5313531bbe7c750f977474c7be15f62a1fa26048b34c09c22e643cd9b` | 25.647 | TAK | 107 | 1 | 0 |
| zwornik-projects | PO | light | `evidence/podglad-relations-20260904/core/zwornik-projects__PO__pl__1440__light.png` | `6c5f0a6cac0dc7fbf07f2f9960897d42e5ebfe6c16257f0f22e56744cbb1b40e` | 248.648 | TAK | 107 | 1 | 0 |
| zwornik-projects | PO | dark | `evidence/podglad-relations-20260904/core/zwornik-projects__PO__pl__1440__dark.png` | `9e08077606798b4723c676ee18e1446e0d4bcbf39e34dc0312278de1e6d32195` | 22.951 | TAK | 107 | 1 | 0 |
| report-builder-block-types | PO | light | `evidence/podglad-relations-20260904/core/report-builder-block-types__PO__pl__1440__light.png` | `b176597e2cb9630bf2bf7ac41bc48976e61066636ab4e67e93f44d95388c6b68` | 247.886 | TAK | 107 | 1 | 0 |
| report-builder-block-types | PO | dark | `evidence/podglad-relations-20260904/core/report-builder-block-types__PO__pl__1440__dark.png` | `4d8ae067e1e270796e4a499a0ba54f03aa090d8fcba57b8bdc618961bd87f966` | 27.105 | TAK | 107 | 1 | 0 |
| report-builder-templates | PO | light | `evidence/podglad-relations-20260904/core/report-builder-templates__PO__pl__1440__light.png` | `354de0a4ea3ac388e67c95444ca7409f0a6d572122098fa61240e861d65be372` | 247.545 | TAK | 107 | 1 | 0 |
| report-builder-templates | PO | dark | `evidence/podglad-relations-20260904/core/report-builder-templates__PO__pl__1440__dark.png` | `780fb91c65c298b6c5fae5408e17cc016319a4a2de4af63373c317c5282ef691` | 26.252 | TAK | 107 | 1 | 0 |
| results-vnext-registry-shell | PO | light | `evidence/podglad-relations-20260904/core/results-vnext-registry-shell__PO__pl__1440__light.png` | `481c400a565ed09f6cfde18937d786ceb046fecef34346241290b179e23bf049` | 247.981 | TAK | 107 | 1 | 0 |
| results-vnext-registry-shell | PO | dark | `evidence/podglad-relations-20260904/core/results-vnext-registry-shell__PO__pl__1440__dark.png` | `41fc46f54cfad264e4b4ecd298fe63e59cefb90769ed8fabf1cf61783ecb3a19` | 23.438 | TAK | 107 | 1 | 0 |
| results-vnext-attention | PO | light | `evidence/podglad-relations-20260904/core/results-vnext-attention__PO__pl__1440__light.png` | `16b3fb6f4d59f3551ecbc971157dd82f580592101822842280ceb63e6c6f8f6e` | 249.702 | TAK | 107 | 1 | 0 |
| results-vnext-attention | PO | dark | `evidence/podglad-relations-20260904/core/results-vnext-attention__PO__pl__1440__dark.png` | `b50562e45540bb206d83ee96fe6bd0ddb9eacfeaf448d9f21bb0ee7fa6739137` | 20.557 | TAK | 107 | 1 | 0 |
| model-catalog-table | PO | light | `evidence/podglad-relations-20260904/core/model-catalog-table__PO__pl__1440__light.png` | `58b348fce0a267d0bec1bf638c096327e836ae7c6946da77e0d5e6278d2b7410` | 247.197 | TAK | 107 | 1 | 0 |
| model-catalog-table | PO | dark | `evidence/podglad-relations-20260904/core/model-catalog-table__PO__pl__1440__dark.png` | `408120e264a1c3e552684e730d286176d884497d1059157da92182a5eb0cce3e` | 25.158 | TAK | 107 | 1 | 0 |
| drd-library-entry | PO | light | `evidence/podglad-relations-20260904/core/drd-library-entry__PO__pl__1440__light.png` | `735d2cd449a13fd87fa18fe57223e6843e90d732a7abafb046a55c7da6614dbe` | 245.084 | TAK | 107 | 1 | 0 |
| drd-library-entry | PO | dark | `evidence/podglad-relations-20260904/core/drd-library-entry__PO__pl__1440__dark.png` | `c56d74d774e4dada3e95cbd2f852653716c604ef424b4202812294bb17837f48` | 29.723 | TAK | 107 | 1 | 0 |
| prompt-registry-tab | PO | light | `evidence/podglad-relations-20260904/core/prompt-registry-tab__PO__pl__1440__light.png` | `653579de635470f2c79458010b66c2706bdaed7cef4b6ddfdc2f02ac6c0b3f06` | 248.692 | TAK | 107 | 1 | 0 |
| prompt-registry-tab | PO | dark | `evidence/podglad-relations-20260904/core/prompt-registry-tab__PO__pl__1440__dark.png` | `155858f8a1875459bba5ba1436caa73cbd45536507acb23147aad87d9aaa89a9` | 24.446 | TAK | 107 | 1 | 0 |
| partner-settlements-view | PO | light | `evidence/podglad-relations-20260904/core/partner-settlements-view__PO__pl__1440__light.png` | `086c825c1f0f692ea5675f2514eaf55a979048dcf6993533c224eff255ca1b84` | 245.779 | TAK | 107 | 1 | 0 |
| partner-settlements-view | PO | dark | `evidence/podglad-relations-20260904/core/partner-settlements-view__PO__pl__1440__dark.png` | `c477152ffe2c7fb17a5e4326249c8f61fa66e7823213915594108dda78beb953` | 25.944 | TAK | 107 | 1 | 0 |
| audyt-library | PRZED | light | `evidence/podglad-relations-20260904/audyt-library/audyty-piec-powierzchni__PRZED__pl__1440__light.png` | `a22da1817bbee24f7bfbdd536be728ec7a73a8894a402b7c249f62fd8b77c91c` | 245.639 | TAK | — | 0 | 0 |
| audyt-library | PRZED | dark | `evidence/podglad-relations-20260904/audyt-library/audyty-piec-powierzchni__PRZED__pl__1440__dark.png` | `7e860da530a0975b637e6eff2fc77d937a3996145446898cca889702b7c8d5f8` | 27.279 | TAK | — | 0 | 0 |
| audyt-library | PO | light | `evidence/podglad-relations-20260904/audyt-library/audyty-piec-powierzchni__PO__pl__1440__light.png` | `b07739fac169b912f4e2f8887551938ce3b50b9e2474d585a3b11daed29b1734` | 245.656 | TAK | 107 | 1 | 0 |
| audyt-library | PO | dark | `evidence/podglad-relations-20260904/audyt-library/audyty-piec-powierzchni__PO__pl__1440__dark.png` | `37dd13469308658b2e3aa09e77a314bf75b00a048643caf43d71e45a29799172` | 27.323 | TAK | 107 | 1 | 0 |
| audyt-outputs | PRZED | light | `evidence/podglad-relations-20260904/audyt-outputs/audyty-piec-powierzchni__PRZED__pl__1440__light.png` | `7e95d6c466056df3b6de4ba0991f9e2861948b47f1df7a155ce7e72d63b37e6a` | 246.928 | TAK | — | 0 | 0 |
| audyt-outputs | PRZED | dark | `evidence/podglad-relations-20260904/audyt-outputs/audyty-piec-powierzchni__PRZED__pl__1440__dark.png` | `97b94d8bddb2c83f3949e6d6d9e30009cd5ba098fd9d2a30316513001d1616ce` | 22.268 | TAK | — | 0 | 0 |
| audyt-outputs | PO | light | `evidence/podglad-relations-20260904/audyt-outputs/audyty-piec-powierzchni__PO__pl__1440__light.png` | `273f966e3541ff15a4a93984526b3af6f32e34973a3f71f48b90a30d6c9d5d41` | 246.904 | TAK | 107 | 1 | 0 |
| audyt-outputs | PO | dark | `evidence/podglad-relations-20260904/audyt-outputs/audyty-piec-powierzchni__PO__pl__1440__dark.png` | `07e52c656459b8761dd26298810a5a108b5191961d92dbd6a34860ef9bd2c6c4` | 22.879 | TAK | 107 | 1 | 0 |
| audyt-reports | PRZED | light | `evidence/podglad-relations-20260904/audyt-reports/audyty-piec-powierzchni__PRZED__pl__1440__light.png` | `0b7879a7507882b25322ba363794c22ea92517144c3865d04d3caee430c7f038` | 246.945 | TAK | — | 0 | 0 |
| audyt-reports | PRZED | dark | `evidence/podglad-relations-20260904/audyt-reports/audyty-piec-powierzchni__PRZED__pl__1440__dark.png` | `25ddcc746e9ab507f3ee14d3c7cbd6d822cc18d1dee467dc4787cbf66bf1aff0` | 23.437 | TAK | — | 0 | 0 |
| audyt-reports | PO | light | `evidence/podglad-relations-20260904/audyt-reports/audyty-piec-powierzchni__PO__pl__1440__light.png` | `f18236b7b4305e8c52228d7c60fa1d3ecd4d530f75975f429058963b2cb0c6d0` | 246.921 | TAK | 107 | 1 | 0 |
| audyt-reports | PO | dark | `evidence/podglad-relations-20260904/audyt-reports/audyty-piec-powierzchni__PO__pl__1440__dark.png` | `76978afb1bdd99e7f052c431544c325b474561cb562d4ff17976537c128354c4` | 24.048 | TAK | 107 | 1 | 0 |
| audyt-initiatives | PRZED | light | `evidence/podglad-relations-20260904/audyt-initiatives/audyty-piec-powierzchni__PRZED__pl__1440__light.png` | `709d6879734c6dec2cb52e364328c45ed140316016adbb43030a267b3b004d66` | 246.731 | TAK | — | 0 | 0 |
| audyt-initiatives | PRZED | dark | `evidence/podglad-relations-20260904/audyt-initiatives/audyty-piec-powierzchni__PRZED__pl__1440__dark.png` | `49a381efdf99c3ccfc7c357faca29d6ef821780b8b13515f94221807e442a644` | 22.775 | TAK | — | 0 | 0 |
| audyt-initiatives | PO | light | `evidence/podglad-relations-20260904/audyt-initiatives/audyty-piec-powierzchni__PO__pl__1440__light.png` | `eaa5ff26245015f54236874914cb67fb862a4f4b0352148a2b0bcc979c39d1b1` | 246.708 | TAK | 107 | 1 | 0 |
| audyt-initiatives | PO | dark | `evidence/podglad-relations-20260904/audyt-initiatives/audyty-piec-powierzchni__PO__pl__1440__dark.png` | `e93b0fd00c84da51e90ee5d854c7b8eea4f2f72d27312cd2601c58fae98e92e8` | 23.386 | TAK | 107 | 1 | 0 |
| finance-analysis | PRZED | light | `evidence/podglad-relations-20260904/finance-analysis/finance-hub__PRZED__pl__1440__light.png` | `edbfa3f59a29bd0cf24c4dea8a66cbdce734a34c49b9e420d026d664d6957657` | 246.663 | TAK | 107 | 1 | 0 |
| finance-analysis | PRZED | dark | `evidence/podglad-relations-20260904/finance-analysis/finance-hub__PRZED__pl__1440__dark.png` | `a4ae795f689b8a3aa9410e53e6a5abe61e5c4d8aa3ad98581ba75f9a25b5609b` | 25.059 | TAK | 107 | 1 | 0 |
| finance-analysis | PO | light | `evidence/podglad-relations-20260904/finance-analysis/finance-hub__PO__pl__1440__light.png` | `ca56a773e5c08e0f2815714f306a3b187dc869c607b47f945d1cc56839b896fa` | 247.224 | TAK | 107 | 2 | 0 |
| finance-analysis | PO | dark | `evidence/podglad-relations-20260904/finance-analysis/finance-hub__PO__pl__1440__dark.png` | `5972fece693a654c5ef47260443ef6c1fb6eafd6b4e4026440cddcfbbb94e381` | 24.568 | TAK | 107 | 2 | 0 |


Dodatkowe pliki graniczne, niezaliczone jako para ekranu: `evidence/podglad-relations-20260904/audyt-findings/audyty-piec-powierzchni-findings__PRZED__pl__1440__light.png` i odpowiednik `dark`. Nie zawierają otwartego panelu `StandardPreview`, ponieważ domyślnie wybrany program ma 0 ustaleń.

Bilans: 15 kontekstów ma 60 manifestowanych PNG (PRZED/PO × light/dark). Dwanaście kontekstów ma 24 różne bajtowo pary motywowe. Trzy konteksty — `finance-hub`, `results-vnext-registry-shell`, `results-vnext-attention` — mają identyczne PRZED/PO, ponieważ pusty blok był już renderowany przed mutacją. `AuditFindingsTab` pozostaje poza zaliczonymi parami. Sam wymóg „20 ekranów” nie został więc dowiedziony jako 20 praktycznie osiągniętych, niepustych powierzchni.

### Testy i pułapki z §0.2e

Uruchomiono przed i po wyłącznie czysty zestaw jednostkowy:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run \
  src/components/shared/__tests__/standardPreview.r03.test.tsx \
  src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx \
  src/components/standard/__tests__/keyboardAccessCanon.test.tsx \
  --retry=0 --reporter=json
```

Wynik PRZED: 48/48 PASS. Wynik PO: 48/48 PASS. Listy 48 pełnych nazw testów są identyczne (`diff` pusty). Artefakty: `test-przed.json`, `test-po.json`, `przed-nazwy.txt`, `po-nazwy.txt` w katalogu scratch dyżuru.

Pułapki: nie uruchamiano testów DB (`RUN_DB_TESTS=0`, `MOCK_DB=true`), retry był wyłączony, a wybrane pliki nie przechodzą przez `v8FeatureGate`, `resultsInternalBetaVisibility` ani middleware auth. Dowód wizualny jest osobnym pomiarem kanonicznym i nie jest przedstawiany jako dowód ApiGateway/JWT/PostgreSQL.

### Tabela rozbieżności

| Teza / liczba | Pomiar | Status |
| --- | --- | --- |
| 53 użycia w 39 plikach produktu | 53 / 39 | POTWIERDZONE |
| 26 użyć bez `relations` w 18 plikach produktu | 26 / 18 | POTWIERDZONE |
| 3 użycia w 2 plikach dev-render, 2 bez `relations` | 3 / 2, bez: 2 | POTWIERDZONE |
| `SCREENS` | 394 | POTWIERDZONE |
| 15 ekranów R2 w pełni osiągalnych | 14 ocenionych powierzchni; Findings bez niepustej selekcji | CZĘŚCIOWO / NIE DOWIEDZIONO |
| Brak jawnego `relations=` oznacza zmianę runtime | trzy identyczne konteksty PRZED/PO | SFALSYFIKOWANE |
| Parametr audytu `processes` prowadzi do Findings | realny parametr to `findings` | SKORYGOWANE |
| Pusty blok jest zawsze neutralny | Finance dubluje blok do 214 px | SFALSYFIKOWANE |

### Z30 — kanały i działania zewnętrzne

Brak zmiennych SMTP w środowisku dyżuru. Baza 6411 nie została uruchomiona ani skonfigurowana, więc nie wykonano zapytania o rekordy SMTP i nie twierdzę, że ich brak w bazie został dowiedziony. Nie uruchamiano pełnego serwera, drainów, wysyłki e-mail ani operacji kalendarzowych. Nie wykonano żadnej czynności produkcyjnej.

### Status końcowy

**CZĘŚCIOWO / STOP MERYTORYCZNY.** R1, kontrolowane pary R2, oględziny R3, brief R4, rekomendacja R5 i manifest/testy R6 są dostarczone. Nie spełniam literalnie progu pełnej akceptacji: Findings nie ma zaliczonej niepustej pary, trzy ekrany CaseWorkspace nie mają realnego wejścia harnessu, trzy pary falsyfikują zakładaną zmianę runtime, a Finance ujawnia duplikat. Nie zmieniono `StandardPreview.tsx` ani wołaczy produktu.
