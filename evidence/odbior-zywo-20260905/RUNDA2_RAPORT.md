# ODBIÓR NA ŻYWO — RUNDA 2 (05.09.2026)

Runda 2 domyka **wszystkie 55 pozycji**, które w rundzie 1 zostały z werdyktem `NIE_DOTARLEM`.
Podstawa: trzy zmiany zasad właściciela z 05.09 („nie zakładam, że do czegoś nie dotrzesz") —
(a) wolno jedno wywołanie AI na ekran, (b) wolno tworzyć realistyczne rekordy DBR77 tam, gdzie
ekran jest pusty z braku danych, (c) nowe werdykty `FALA_2` / `BRAK_W_APLIKACJI` / `WYMAGA_SUPERADMINA`.

**Pozostawionych `NIE_DOTARLEM`: 0.**

## Liczby

| Werdykt | Liczba |
|---|---:|
| `ZGODNY` | 17 |
| `ROZNI_SIE` | 24 |
| `FALA_2` | 6 |
| `BRAK_W_APLIKACJI` | 4 |
| `WYMAGA_SUPERADMINA` | 4 |
| **razem** | **55** |

## Tabela: id → stary werdykt → nowy werdykt → jedno zdanie

| Katalog | id | Stary | Nowy | Jedno zdanie |
|---|---|---|---|---|
| 01-czat | `mindmap-i18n-smoke` | NIE_DOTARLEM | **ROZNI_SIE** | Dotarlem: modal "Dodaj dowod / zrodlo" ISTNIEJE i jest w calosci po polsku (Tytul / "Tytul dowodu..." / "URL lub notatka zrodla" / "https://... |
| 01-czat | `ntype-analizuj-ai` | NIE_DOTARLEM | **ZGODNY** | Dotarlem po zmianie zasad (jedno wywolanie AI). |
| 01-czat | `teresa-confirm-chip` | NIE_DOTARLEM | **ROZNI_SIE** | Wywolalem Terese raz (jedno dozwolone wywolanie) w kontekscie otwartej idei: "Zamien zaznaczony wezel „Segment: producenci 200-800 osob, DACH" w inicjatywe." Kontrolka z obrazu (szara dymek + „Potwierdz"/„Anuluj" + ikony pod… |
| 02-moja-praca | `exec-summary-onelook` | NIE_DOTARLEM | **ROZNI_SIE** | Zakladka 'Summary' jest NIEOSIAGALNA — to defekt nawigacji, nie decyzja wlasciciela: flaga summaryOneLook jest w tym srodowisku WLACZONA (fallback D-D: ON wszedzie poza public-prod), a mimo to widok sie nie pokazuje. |
| 02-moja-praca | `idea-table-tool-kebab` | NIE_DOTARLEM | **ROZNI_SIE** | MENU WIERSZA W APLIKACJI ISTNIEJE — sprawdzone wlasnym skryptem Playwright (page.mouse.click z button:'right' na komorce wiersza). |
| 02-moja-praca | `idea-table-tool-paste` | NIE_DOTARLEM | **ROZNI_SIE** | SPRAWDZONE NA WLASNYM REKORDZIE (zero dotkniecia tabel wlasciciela): utworzylem pomysl 'Cyfrowy blizniak linii montazowej — analiza wykonalnosci' (Tabela), id 400d107a-1cdb-4b25-bf49-7d323942f91b, i tam testowalem wklejanie. |
| 02-moja-praca | `ideas-teresa-panel` | NIE_DOTARLEM | **ROZNI_SIE** | WADA MATERIALU ZRODLOWEGO (zweryfikowana md5sum): obraz zatwierdzony jest BITOWYM DUPLIKATEM obrazu mywork-idea-inspector-lekki (oba bb9f9ada46cf8023cf3b34ddc5c45863; para dark tez identyczna, 64f3ea31...). |
| 02-moja-praca | `mywork-idea-inspector-lekki` | NIE_DOTARLEM | **ROZNI_SIE** | WADA MATERIALU ZRODLOWEGO (zweryfikowana md5sum): obraz zatwierdzony jest BITOWYM DUPLIKATEM obrazu ideas-teresa-panel (oba bb9f9ada46cf8023cf3b34ddc5c45863; para dark tez identyczna, 64f3ea31...). |
| 02-moja-praca | `notatnik-centrum-mysli` | NIE_DOTARLEM | **ROZNI_SIE** | WADA MATERIALU ZRODLOWEGO (zweryfikowana samodzielnie md5sum): obraz zatwierdzony jest BITOWYM DUPLIKATEM obrazu mywork-notebook-rail-speca (oba 93144187fc956bcb4640786c66c1409f; para dark tez identyczna, 1d765991...). |
| 03-wywiad | `drd-http-workspace` | NIE_DOTARLEM | **ZGODNY** | SPROSTOWANIE RUNDY 1: nowy warsztat DRD (HTTP source-of-truth) JEST dzis domyslnie widoczny — flaga drdHttpSourceOfTruthV1 wprawdzie ma defaultValue:false (useFeatureFlags.tsx:261), ale na realnej trasie NIE JEST W OGOLE… |
| 03-wywiad | `interview-creator-shell` | NIE_DOTARLEM | **ZGODNY** | SPROSTOWANIE RUNDY 1: flaga NIE jest juz wylaczona. |
| 03-wywiad | `karta-interview` | NIE_DOTARLEM | **ZGODNY** | DOSZEDLEM. |
| 03-wywiad | `unified-create-launcher` | NIE_DOTARLEM | **ROZNI_SIE** | ZBUDOWANE, ALE NIEPODLACZONE — teza rundy 1 potwierdzona swiezym pomiarem rg (nie grep --include). |
| 04-narzedzia | `prompt-registry-tab` | NIE_DOTARLEM | **WYMAGA_SUPERADMINA** | Konto właściciela nie ma roli SuperAdmin: wejście na /superadmin/ai-platform/development/prompt-registry kończy się przekierowaniem na /chat (zrzut pokazuje ekran powitalny czatu „Cześć, Piotr", adres końcowy… |
| 04-narzedzia | `tools-swot-report` | NIE_DOTARLEM | **ROZNI_SIE** | HIPOTEZA O FLADZE OBALONA: raport SWOT NIE stoi za `dynamicSwotSevenStages`. |
| 05-ocena | `assessment-initiatives-table` | NIE_DOTARLEM | **ROZNI_SIE** | Zweryfikowałem sam: pliku src/components/assessment/InitiativesTable.tsx nie ma (ls → No such file), a napisy z obrazu („Strategic Initiatives Board”, kolumny INITIATIVE·STATUS·COMPLETENESS·OWNER·PRIORITY·BUDGET) nie występują… |
| 05-ocena | `assessment-output-report` | NIE_DOTARLEM | **ROZNI_SIE** | Nie da się dojść z powodu bariery w produkcie, nie z braku danych. |
| 05-ocena | `assessment-presentation-view` | NIE_DOTARLEM | **ROZNI_SIE** | Ta sama bariera co przy raporcie: prezentacja czyta ten sam zamrożony Output, a zamrożenia nie da się wykonać jednym kontem. |
| 06-inicjatywy | `ev-football-field` | NIE_DOTARLEM | **ZGODNY** | DOTARŁEM. |
| 06-inicjatywy | `initiative-record` | NIE_DOTARLEM | **ZGODNY** | Ten sam komponent karty sprawdzony na DRUGIM realnym rekordzie („Akademia liderów transformacji”, demo-story-20260826-initiative-skills) — otwiera się poprawnie, regresja 404 z rundy 1 naprawiona. |
| 06-inicjatywy | `karta-initiative` | NIE_DOTARLEM | **ZGODNY** | Karta REALNEGO rekordu „Pełna identyfikowalność partii” otwiera się (regresja 404 z rundy 1 jest naprawiona w linii m03 — src/components/Initiatives/initiativeDocumentSource.ts + bezpiecznik… |
| 07-realizacja | `exe-002-004-ui-audit` | NIE_DOTARLEM | **ZGODNY** | ZWERYFIKOWANE SAMODZIELNIE: teza rundy 1 ('otwarcie DOWOLNEJ realnej inicjatywy konczy sie bledem') jest FALSZYWA — byla oparta na probce wierszy listy, ktore wskazuja na id z puli demo-story (404). |
| 07-realizacja | `execution-report-day11` | NIE_DOTARLEM | **FALA_2** | Powierzchnia execReportsIntelligence jest za flaga wylaczona DECYZJA wlasciciela: w executionFeatureFlags.ts komentarz nad flaga mowi wprost 'Rule #7 — brand-new, not-yet-screenshotted cockpit surface stays OFF everywhere —… |
| 07-realizacja | `execution-tab-summary` | NIE_DOTARLEM | **ROZNI_SIE** | Ten sam ekran co exec-summary-onelook (pakiet 02) — werdykt uzgodniony. |
| 08-wyniki | `cel-jedna-karta` | NIE_DOTARLEM | **BRAK_W_APLIKACJI** | Zweryfikowane w kodzie: karta N celu istnieje WYŁĄCZNIE jako prototyp harnessu — dev-render/screens/cel-jedna-karta.tsx; w src/ nie ma żadnego produkcyjnego komponentu karty N dla celu OKR (N-kartę doczekał się na produkcji… |
| 08-wyniki | `results-vnext-kpi-scorecards` | NIE_DOTARLEM | **ROZNI_SIE** | ZBUDOWANE, ALE NIEPODŁĄCZONE — brak wejścia w nawigacji. |
| 08-wyniki | `results-vnext-legacy-archive` | NIE_DOTARLEM | **FALA_2** | Zakładka 'Archiwum' nie pojawia się w Menu 2, bo flaga resultsLegacyArchive jest domyślnie wyłączona i jest jawnie WYJĘTA z profilu demo (src/components/ResultsVNext/resultsVNextFeatureFlags.ts:110, 201-213) — to jedna z… |
| 08-wyniki | `results-vnext-roi-full-tool` | NIE_DOTARLEM | **ROZNI_SIE** | Ta sama blokada co przy 'Modelu ROI': rejestr spraw ROI jest pusty (0 spraw, stan pusty 'Brak spraw ROI'), a utworzenie rekordu — na które zezwala zmiana zasad z 05.09 — zwraca 403 ROI_CASE_CREATION_NOT_AUTHORIZED (POST… |
| 08-wyniki | `results-vnext-roi-model` | NIE_DOTARLEM | **ROZNI_SIE** | Nie dało się dojść z powodu DEFEKTU ŚRODOWISKA, nie z braku danych: rejestr ROI ma 0 spraw, a próba utworzenia sprawy (Nowa sprawa ROI → formularz wypełniony realną treścią DBR77 → 'Utwórz sprawę') kończy się POST… |
| 08-wyniki | `results-zestawienia` | NIE_DOTARLEM | **BRAK_W_APLIKACJI** | Potwierdzone w kodzie: prototyp POZIOMU 1 'Rejestr zestawień okresowych' istnieje wyłącznie w harnessie — dev-render/screens/results-zestawienia.tsx, którego własny nagłówek mówi wprost 'Ten ekran świadomie NIE mountuje… |
| 08-wyniki | `roi-jedna-karta` | NIE_DOTARLEM | **ROZNI_SIE** | SPROSTOWANIE rundy 1 i mojego własnego założenia: ta karta N NIE jest już wyłącznie prototypem harnessu — formuła z dev-render/screens/roi-jedna-karta.tsx została PRZENIESIONA NA PRODUKCJĘ… |
| 08-wyniki | `wskaznik-jedna-karta` | NIE_DOTARLEM | **ZGODNY** | SPROSTOWANIE rundy 1: ta karta N NIE jest już tylko prototypem — realny ekran /results/kpi/:kpiId to produkcyjny komponent src/components/ResultsVNext/kpiTool/KpiToolPage.tsx zbudowany na NModeShell + ArtifactRightPanel, czyli… |
| 09-finanse | `finance-comments-panel` | NIE_DOTARLEM | **ROZNI_SIE** | Panel JEST osiagalny w aplikacji — teza rundy 1 obalona. |
| 09-finanse | `finance-compare-panel` | NIE_DOTARLEM | **ROZNI_SIE** | Doszedlem do miejsca montazu (te sama trasa kanoniczna), ale FinanceComparePanel sie NIE renderuje: host FinanceWorkspaceUtilities montuje go tylko gdy artefakt ma DRUGA wersje biznesowa (comparisonVersionId = pierwsze… |
| 09-finanse | `finance-export-import-panel` | NIE_DOTARLEM | **ZGODNY** | Panel osiagalny ta sama trasa kanoniczna (rewizja robocza istnieje: sourceWorkingRevisionId d68d10eb-…, wiec host montuje FinanceExportImportPanel, a nie zastepcze zdanie). |
| 09-finanse | `finance-lineage-navigator` | NIE_DOTARLEM | **ZGODNY** | Dotarlem ta sama trasa kanoniczna co pozostale panele. |
| 09-finanse | `finance-saved-views-panel` | NIE_DOTARLEM | **ZGODNY** | Panel osiagalny ta sama trasa kanoniczna. |
| 09-finanse | `finance-workspace-bar` | NIE_DOTARLEM | **ROZNI_SIE** | Teza rundy 1 ('zaden z pieciu warsztatow nie montuje paska') obalona — to STARY komentarz w naglowku src/hooks/useFinanceWorkspacePlatformFlag.ts. |
| 10-materialy | `b2-template-gallery` | NIE_DOTARLEM | **ZGODNY** | Dotarłem: Moja praca → Pomysły → dwuklik na idei z narzędziem „Mapa myśli" → kanwa (/my-work/ideas/<id>/workspace/mindmap) → przycisk „Szablony" na pionowym pasku narzędzi. |
| 10-materialy | `document-studio-blocks-i18n` | NIE_DOTARLEM | **BRAK_W_APLIKACJI** | POTWIERDZONE W KODZIE: obraz zatwierdzony to wyłącznie dev-render harnessu. |
| 10-materialy | `document-studio-save-as-template` | NIE_DOTARLEM | **ROZNI_SIE** | NADAL ZABLOKOWANE — nie naprawione. |
| 10-materialy | `document-studio-streaming-honesty-n3` | NIE_DOTARLEM | **ZGODNY** | Obraz zatwierdzony to dev-render harnessu pokazujący FORMULARZ WEJŚCIOWY „Generuj bez szablonu" (banner u góry opisuje tylko, co ma się stać po kliknięciu). |
| 10-materialy | `report-builder-library-template` | NIE_DOTARLEM | **ROZNI_SIE** | NADAL 403 — nie naprawione. |
| 11-audyty | `audyty-raport-dokument` | NIE_DOTARLEM | **ZGODNY** | Dotarłem i ścieżka wystawienia raportu ISTNIEJE — sprostowanie rundy 1: komunikat pustej zakładki („ścieżka wystawienia raportu nie jest dostępna z ekranu”) jest tekstem stanu WYŁĄCZONEJ flagi ff_auditsReportChain… |
| 11-audyty | `audyty-warsztat-kryterium` | NIE_DOTARLEM | **ROZNI_SIE** | Dotarłem: utworzyłem realny pakiet audytowy DBR77 „Audyt gotowości do robotyzacji — linia spawalnicza” (6 kryteriów po polsku, źródło PW-ROB-01), opublikowałem go, a sesję założyłem przyciskiem „Nowy audyt” z aplikacji. |
| 13-administracja | `model-catalog-table` | NIE_DOTARLEM | **WYMAGA_SUPERADMINA** | Ekran żyje pod SuperAdmin → AI Platform → Model Registry; wejście na /superadmin/ai-platform z konta właściciela przekierowuje na /chat — zrzut potwierdzający przekierowanie w dowodach. |
| 13-administracja | `partner-settlements-view` | NIE_DOTARLEM | **WYMAGA_SUPERADMINA** | Ekran żyje pod SuperAdmin → Revenue; wejście na /superadmin/revenue z konta właściciela przekierowuje na /chat — zrzut potwierdzający przekierowanie w dowodach. |
| 13-administracja | `superadmin-platform-operations-day15` | NIE_DOTARLEM | **WYMAGA_SUPERADMINA** | Konto właściciela (Owner organizacji DBR77) nie ma roli SuperAdmin: wejście na /superadmin/system/platform-operations kończy się natychmiastowym przekierowaniem na /chat — zrzut potwierdzający przekierowanie w dowodach. |
| 16-kanon | `prawy-pas-jedna-formula-idea-artefakt` | NIE_DOTARLEM | **FALA_2** | FLAGA `ideaNotebookRightPanelPrototype` (default OFF, decyzja wlasciciela — nie wlaczam). |
| 16-kanon | `prawy-pas-jedna-formula-idea-teresa` | NIE_DOTARLEM | **FALA_2** | FLAGA `ideaNotebookRightPanelPrototype` (default OFF, decyzja wlasciciela — nie wlaczam). |
| 16-kanon | `prawy-pas-jedna-formula-notatka-artefakt` | NIE_DOTARLEM | **FALA_2** | FLAGA `ideaNotebookRightPanelPrototype` (default OFF, decyzja wlasciciela — nie wlaczam). |
| 16-kanon | `prawy-pas-jedna-formula-notatka-teresa` | NIE_DOTARLEM | **FALA_2** | FLAGA `ideaNotebookRightPanelPrototype` (default OFF, decyzja wlasciciela — nie wlaczam). |
| 16-kanon | `rn-g3-class-l-record-shell` | NIE_DOTARLEM | **ZGODNY** | Sesja swieza, dotarlem normalnie (flaga kpiRegistry jest domyslnie ON na localhost — resultsVNextFeatureFlags.ts, DEC 03.09). |
| 16-kanon | `standard-module-bar-children` | NIE_DOTARLEM | **BRAK_W_APLIKACJI** | BRAK EKRANU W APLIKACJI. |
| 18-ustawienia | `ustawienia-integracje` | NIE_DOTARLEM | **ZGODNY** | Ze swieza sesja i czekaniem 9 s ekran wyrenderowal sie ZA PIERWSZYM RAZEM, zero bledow konsoli, zadnego blakania po /admin/*: /settings/integrations przekierowuje na /settings/connected-apps i pokazuje "Polaczone aplikacje". |
## Rekordy utworzone na stagingu

Pełna lista z identyfikatorami i trasami: **`UTWORZONE_REKORDY.md`** (w tym samym katalogu) — **17 pozycji**.
Skrót wg modułów:

- **Ocena (1)** — sesja DRD dla DBR77 (3 odpowiedzi, stan „Do przeglądu"); miała odblokować zamrożony Output.
- **Audyty (6)** — źródło wymagań PW-ROB-01, opublikowany pakiet „Audyt gotowości do robotyzacji — linia
  spawalnicza" (3 domeny, 6 kryteriów PL), sesja audytowa, członkostwo audytora wiodącego, Output v1, raport v1.
- **Finanse (7)** — dwa artefakty kanoniczne (BASELINE_MODEL i VALUATION_CASE), valuation case + wariant,
  wycena „DBR77 Sp. z o.o. — Q3 2026", komentarze i pozycje list kontrolnych do wypełnienia paneli treścią.
- **Narzędzia (1)** — sesja Dynamic SWOT (baza nie miała ani jednej zatwierdzonej sesji SWOT).
- **Materiały (1)** — dokument w Document Studio z blokami Tabela/KPI/Wykres.
- **Moja praca (1)** — idea „Cyfrowy bliźniak linii montażowej — analiza wykonalności" (narzędzie Tabela),
  żeby testować menu wiersza i wklejanie bez dotykania tabel właściciela.

Żaden istniejący rekord właściciela nie został usunięty ani zmieniony.

## Wywołania AI (5 ekranów, 6 żądań)

| Ekran | Polecenie / akcja | Wynik |
|---|---|---|
| `ntype-analizuj-ai` (01-czat) | przycisk „Analizuj z AI" na realnej karcie zadania (akcja jednoprzyciskowa, bez własnego tekstu) | OK — panel „Analiza AI" z wynikiem KOMPLETNOŚĆ 50/100, szufladami BRAKI (5) i RYZYKA |
| `teresa-confirm-chip` (01-czat) | „Zamień zaznaczony węzeł »Segment: producenci 200–800 osób, DACH« w inicjatywę." | Teresa odpowiedziała kartą „TERESA PROPOSAL", nie chipem potwierdzenia; nic nie potwierdzano |
| `ideas-teresa-panel` (02-moja-praca) | „Zaproponuj trzy mierniki realizacji korzyści dla wdrożeń robotyzacji spawania w DBR77." | **2 żądania** (drugie z instrumentacją, żeby odróżnić defekt produktu od przyrządu) — oba `API Chat Stream Error: Failed to fetch` |
| `tools-swot-report` (04-narzedzia) | przycisk „Szkicuj z AI" w sesji Dynamic SWOT (akcja jednoprzyciskowa) | `POST /api/ai/chat/stream` 200, ale zapis `PUT /api/tools/…` → **502**; interfejs wisiał „AI PRACUJE" >90 s bez komunikatu |
| `document-studio-streaming-honesty-n3` (10-materialy) | „Zaplanuj dokument: raport z audytu gotowości do robotyzacji linii spawalniczej w DBR77 — zakres audytu, ustalenia, luki względem wymagań, ryzyka wdrożeniowe i rekomendacje." | przycisk przeszedł w „Planowanie…", ekranu planu nie uchwycono (nie powtarzano wywołania) |

## Sprostowania tez rundy 1 (rzecz ważniejsza niż same werdykty)

Runda 1 opierała część werdyktów na dokumentacji i komentarzach w kodzie, nie na pomiarze. Runda 2 obaliła
sześć takich tez:

1. **`interview-creator-shell`** — flaga miała być OFF; commit `ba0da208a3` (DEC-2026-09-03-350) przestawił ją
   na domyślnie ON. Ekran jest ZGODNY.
2. **`drd-http-workspace`** — flaga `drdHttpSourceOfTruthV1` nie jest w ogóle odczytywana na realnej trasie.
   Ekran jest ZGODNY.
3. **`audyty-raport-dokument`** — „ścieżka wystawienia raportu nie istnieje" to tekst stanu wyłączonej flagi
   `ff_auditsReportChain`; z flagą cały łańcuch Sesje → Output → Raport działa z ekranu. Ekran jest ZGODNY.
4. **Finanse (6 ekranów)** — teza „bramka `FinanceLegacyBridgeGate` nigdy się nie rozwiązuje" obalona
   dwukrotnie: istnieje druga droga (`CanonicalFinanceDirectWorkspace`, deep-link z pominięciem bramki),
   a prawdziwą przyczyną było **zero artefaktów kanonicznych w bazie**. Po utworzeniu rekordu panele
   pojawiły się wszystkie; trzy z sześciu wyszły ZGODNE.
5. **`wskaznik-jedna-karta`** — miała nie istnieć w aplikacji; karta N wskaźnika JEST na produkcji
   (`ResultsVNext/kpiTool/KpiToolPage.tsx`). ZGODNY.
6. **Inicjatywy** — „otwarcie dowolnej realnej inicjatywy kończy się błędem" powstało z próbki 2 wierszy;
   `/api/initiatives` zwraca 94 realne rekordy i karta otwiera się w całości. Prawdziwy defekt jest węższy:
   wiersze listy wskazują na id `demo-story-*`, których API nie zna (404).

Odwrotnie też: **`tools-swot-report` NIE stoi za flagą `dynamicSwotSevenStages`** (ta dokłada tylko dwie fazy),
a **karta inicjatywy NIE stoi za `ff_initiativeCardContract`** — obie hipotezy „fali 2" ze zlecenia okazały się
nieprawdziwe i werdykty są odpowiednio ROZNI_SIE i ZGODNY.

## Defekty odsłonięte przy okazji (do rozdysponowania, poza odbiorem)

- **Domena ROI wygaszona dla organizacji** — `POST /api/vnext/results/roi/cases` → 403
  `ROI_CASE_CREATION_NOT_AUTHORIZED` (brak opublikowanej polityki widoczności `ROI_GOVERNED`). Blokuje trzy ekrany naraz.
- **Krach kluczowych rezultatów** — `/results/okr` → cel → „Kluczowe Rezultaty" wywraca trasę:
  `ReferenceError: shortOkrId is not defined` (`okrKeyResultPresenters.tsx:142`).
- **Rola `approver` nie ma UI w całej aplikacji** — zamrożenie oceny (a więc raport i prezentacja z oceny)
  jest strukturalnie nieosiągalne bez drugiego konta.
- **`TEMPLATE_FORBIDDEN` na 7/7 wzorców raportów** — przyczyna to jedna linia danych:
  `provenance_status="unknown"` zamiast `approved`, nie dziura w uprawnieniach.
- **Menu „Plik" w Document Studio przycięte** — przodek z `overflow-x:auto` ma `clientHeight=32`,
  `scrollHeight=244`; rozwijka (y=263) jest w DOM, ale poza obszarem widocznym i nieklikalna.
- **`IdeaRightPanel` to kod martwy** — `melsCanvasEnabled = true` przybite na sztywno
  (`IdeaMapWorkspace.tsx:3655`); trzy ikony Menu 1 klikają się, żaden panel się nie pojawia.
- **`undefined kryteriów · undefined zamkniętych`** w warsztacie kryterium — rozjazd kontraktu lista↔detal
  programu audytowego, widoczny dla każdego użytkownika.
- **Karty wyników KPI odcięte od nawigacji** — `tab==='scorecards'` osiągalne wyłącznie propsem `initialTab`,
  którego jedyny mount nie przekazuje.
- **Nowa wycena nie dochodzi do „Wyników"** — workspace V3 blokuje krok Źródło (`NO_VALUATION_SOURCE_EDGE`,
  brak endpointu), a panel EV football-field żyje tylko w widoku klasycznym.

- **Modal „Dodaj dowód / źródło" nieklikalny myszką** — `fixed inset-0` dostaje blok zawierający od szuflady
  węzła (overlay x=1021 w=419), więc modal jest w całości zasłonięty szyną inspektora mapy myśli.
- **Wszystkie 20 kart integracji pokazuje „Już wkrótce"** — backend nie ma skonfigurowanego dostawcy OAuth
  (`ConnectedAppsSettings.tsx:1355-1367`); to stan danych, nie kompozycja.

## Wady materiału odbiorowego (do naprawy przed pokazaniem właścicielowi)

- **Cztery pliki, dwa obrazy (dyżur 302).** Zweryfikowane md5: `notatnik-centrum-mysli` = `mywork-notebook-rail-speca`
  (`93144187…`), `mywork-idea-inspector-lekki` = `ideas-teresa-panel` (`bb9f9ada…`); pary dark identycznie.
  Wszystkie cztery pokazują jedną powłokę prototypu `IdeaNotebookRightPanelPrototype.tsx`, a nie komponenty
  deklarowane w nagłówkach ich własnych plików dev-render. **Trzeba je przerenderować.**
- **`finance-model-workspace.png` = `finance-baseline-workspace.png`** (md5 `e179efa9…`) — dwa różne ekrany
  rundy 1 stoją na jednym zrzucie; jeden z tych werdyktów opiera się na złym dowodzie.
- **`karta-initiative`** — obraz zatwierdzony pochodzi z katalogu `dec387-pomiar-zastany-ON`, czyli ze stanu
  przy WŁĄCZONEJ fladze, gdy kontrakt kasował 20 z 24 sekcji. Realny ekran ma dziś 24 sekcje w 5 grupach,
  zgodnie z DEC-387. Wskazanie `obraz_zatwierdzony_light` warto podmienić, inaczej każdy kolejny odbiorca
  zgłosi fałszywą regresję.
- **`teresa-confirm-chip`** — obraz zatwierdzony jest nieaktualny: uwaga właściciela z 30.08 („bardziej
  delikatna formuła, jak Claude") została wykonana (`MessageRenderer.tsx:910-930`), chip jest dziś subtelną
  kartą, a nie pełnoszerokim blokiem z czarnym CTA.

## Metoda

Osiem równoległych wykonawców, katalog po katalogu, zapis `wyniki.json` po każdym ekranie.
Zrzuty: jasny motyw, viewport 1440×900, zalogowana sesja właściciela, `<id>.png` w katalogu pakietu.
Skrypt zrzutu w repo (`scripts/dev/odbior-zywo/zrzut.mjs`) wskazywał na martwy port 3009 — runda 2
używała kopii poprawionej na 3000 w `/private/tmp/odbior-zywo-skrypty/runda2/zrzut.mjs`
(repo nietknięte poza katalogiem `evidence/odbior-zywo-20260905/`).
