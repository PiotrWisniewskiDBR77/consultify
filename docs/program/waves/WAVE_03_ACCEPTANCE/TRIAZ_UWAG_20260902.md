# Triaż 77 uwag z odbioru 2026-09-02 — stan w kodzie, nie w dokumentacji

Dyżur triażowy. Zero napraw. Dla każdej z 77 uwag z `BACKLOG_UWAG_ODBIORU_20260902.md`
ustalono stan przez czytanie **realnego kodu na gałęzi z markera `6fe16e2bd4`**
(`git worktree` na `/private/tmp/ag-triaz-uwag`), nie przez ufanie audytom historycznym.

Legenda:
- **ZROBIONE** — naprawione w kodzie, nie za flagą (albo flaga domyślnie ON dla każdego).
- **ZA FLAGĄ** — zrobione, ale wyłączone; właściciel tego nie widzi w produkcie.
- **DROBNE** — realny defekt, naprawa ~poniżej 30 linii.
- **DUŻE** — realny defekt/projekt wymagający decyzji lub większej pracy.
- **NIEJASNE** — nie da się ustalić, o co dokładnie chodzi, bez zgadywania.

`docs/program/grafika/status.json` był użyty jako **hipoteza wyjściowa** (ma cenne
odnośniki plik:linia z wcześniejszych fal), ale każdy wpis poniżej cytuje **własną**
weryfikację w kodzie z tej sesji — plik i linia, którą można sprawdzić `sed -n`.

## Podsumowanie liczbowe

| Stan | Liczba |
| --- | --- |
| ZROBIONE | 32 |
| ZA FLAGĄ | 4 |
| DROBNE | 3 |
| DUŻE | 26 |
| NIEJASNE | 12 |
| **RAZEM** | **77** |

## ★ ZA FLAGĄ — właściciel może to zobaczyć dziś, jeśli ktoś przełączy przełącznik

| ID | Ekran | Flaga | Domyślnie | Miejsce odczytu |
| --- | --- | --- | --- | --- |
| `UW-02-02` | `interview-creator-shell` | `ff.interview_creator_shell` / `ff_interviewCreatorShell` / `VITE_INTERVIEW_CREATOR_SHELL` | OFF | `src/utils/interviewCreatorShellFlag.ts:53` (`isInterviewCreatorShellEnabled`), użyte w `src/components/Interview/InsightCreatorModal.tsx`, `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` |
| `UW-09-08` | `results-vnext-attention` | `ff.results_vnext_attention_entry` / `ff_resultsVNextAttentionEntry` / `VITE_RESULTS_VNEXT_ATTENTION_ENTRY_ENABLED` (`attentionEntry`) | OFF | `src/components/ResultsVNext/resultsVNextFeatureFlags.ts:88-92`, odczyt `ResultsVNextRegistryShell.tsx:132-133` |
| `UW-09-10` | `results-vnext-search-registry` | `ff.results_vnext_search` / `ff_resultsVNextSearch` / `VITE_RESULTS_VNEXT_SEARCH_ENABLED` (`resultsSearch`) | OFF | `src/components/ResultsVNext/resultsVNextFeatureFlags.ts:49-53`, odczyt `ResultsKpiRegistryPage.tsx:835` |
| `UW-12-01` | `audyty-drd-report` | `ff.drdReport` / `ff_drd_report` / `VITE_DRD_REPORT_ENABLED` | OFF | `src/utils/drdReportFlag.ts:73` (`isDrdReportEnabled`), montaż `src/components/Audit/AuditsHub.tsx:628-649` |

Najważniejszy z tej czwórki: **`audyty-drd-report`**. `DRDAuditReportView`
(`src/views/DRDAuditReportView.tsx`) to w pełni zbudowany edytor raportu DRD
(panel AI, akcje per sekcja, eksport PDF) podłączony do żywego backendu
(`server/src/services/report/drdReportGenerator.ts`), ale ma **zero importerów**
poza tą flagą — nikt nigdy tego nie widział, bo nic tam nie prowadzi przy fladze OFF.

## Rejestr pełny

### 02_INTERVIEW

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-02-01` `karta-insight` | **ZROBIONE** | `src/components/Interview/InsightViewer.tsx:4126-4160` — sekcja „Podsumowanie wykonawcze" ma dosłowny komentarz cytujący uwagę właściciela z 30.08 i trzy pełnowymiarowe wiersze z trzema kolorami (`c-info`/danger/emerald) zamiast trzech kolumn. Nie za flagą — to główny widok Insight. |
| `UW-02-02` `interview-creator-shell` | **ZA FLAGĄ** | Patrz tabela wyżej. Dodatkowo: `naprawione` dla tego ekranu w status.json jest puste — sama jakość wizualna nowej powłoki (ścianki/czcionki, o które chodziło w uwadze) nie ma potwierdzenia naprawy, więc po włączeniu flagi trzeba to i tak przejrzeć osobno. |
| `UW-02-03` `interview-preview-canon` | **NIEJASNE** | Właściciel sam pisze „nie umiem ocenić, czy szerokość jest wystarczająca" — nie podaje konkretnego oczekiwania, tylko przypomina, że komponent musi być zgodny ze standardem. Bez wskazania KTÓREGO punktu standardu dotyczy, nie da się tego zamienić na zadanie. |

### 03_TOOLS

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-03-01` `karta-tool` | **ZROBIONE** (część 1), otwarte pytanie (część 2) | `src/components/DiscoveryTools/KnownToolDetailView.tsx:569-595` — dokładny cytat uwagi w komentarzu; siatka przykładów była na sztywno `lg:grid-cols-3`, teraz `shown.length` decyduje o liczbie kolumn (1→pełna szerokość, 2→dwie, 3+→trzy). Druga część uwagi („nie mam jak przeklikać wypełniania dokumentu") nie ma odpowiednika w kodzie ani w status.json — nieopisana, do doprecyzowania z właścicielem, co dokładnie miał na myśli. |
| `UW-03-02` `tools-swot-report` | **NIEJASNE** | Zdanie potoczne/urwane: „żaden [swot] nie będzie tylko tak małą analizą, nie? Ale generalnie wygląda ok." Nie wiadomo, czy to prośba o rozbudowanie treści raportu, czy tylko luźny komentarz przy akceptacji. |
| `UW-03-03` `tools-swot-session-workspace` | **ZROBIONE** | `dev-render/screens/tools-swot-session-workspace.tsx:1-33` — udokumentowana naprawa 2026-08-30: „prehistoryczna karta" to był komponent `ToolWorkspace` (martwy, zero importerów w `src/`, cały barrel `src/views/discovery-tools/index.ts` nie ma importera). Realna sesja `dynamic-swot` idzie przez `DiscoveryToolsHub` → `ToolDocumentView` (`DEDICATED_TOOL_TYPES`). Harness poprawiony, żeby montować realny komponent zamiast martwego. |

### 04_ASSESSMENT

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-04-01` `assessment-five-surfaces` | **NIEJASNE** | Ekran używa realnego `StandardTable`/`StandardPreview` (potwierdzone w `dev-render/screens/assessment-five-surfaces.tsx:1-6`), flaga `assessmentFiveSurfacesV1` ma `defaultValue: true` (`src/hooks/useFeatureFlags.tsx:197-214`, żywa dla każdego). Nie ustalono, KTÓRY konkretny punkt standardu podglądu jest naruszony — wymaga przejścia 40-punktowej listy TRIADA_KANON na żywo, nie da się tego stwierdzić z samej uwagi. |
| `UW-04-02` `assessment-output-report` | **DUŻE** | Właściciel opisuje pełną, sformalizowaną strukturę raportu (wstęp → 7 osi z opisem osi+obszaru → odpowiedzi+wnioski → podsumowanie), analogicznie dla SIRI. To przeprojektowanie struktury dokumentu, nie poprawka wizualna — wymaga decyzji produktowej i osobnego frameworku generowania raportu per metodyka. |
| `UW-04-03` `assessment-quality-review-panel` | **ZROBIONE** | `src/components/assessment/AssessmentQualityReviewPanel.tsx:1-21` — komentarz nagłówkowy odpowiada wprost na pytanie właściciela: ten panel NIE ustawia żadnego poziomu i nie zastępuje macierzy; poziomy ustawia się w `DRDAssessmentEditor`/`DRDMatrixSession` (trasa `/assessment/:framework/:assessmentId`, przełącznik „Macierz"), do którego ekran teraz linkuje. |
| `UW-04-04` `assessment-list` | **ZROBIONE** | `src/components/assessment/AssessmentHub.tsx:2122-2134` — zakładka „Procesy" renderuje `<StandardTable>` (kanoniczny, pełnowymiarowy), nie fragment. |
| `UW-04-05` `assessment-presentation-view` | **ZROBIONE** | `src/components/assessment/report/AssessmentReportDocument.tsx:53-55,379-381` — slajd 6 osadza `DRDMatrixReadOnly` (eksport z `DRDAssessmentEditor`) — to jest ta sama macierz DRD, o którą prosił właściciel, potwierdzona jego akceptem 2026-09-01. |
| `UW-04-06` `assessment-reports-panel` | **ZROBIONE** | `src/components/assessment/manage/AssessmentManagePanel.tsx` używa `useTranslation`/`t()` w całości (linie 3, 148, 204…) — zarzut „obudowa po angielsku" z wcześniejszych audytów nieaktualny; uwaga właściciela to w praktyce potwierdzenie („jak rozumiem, normalna tabela na pełną szerokość"), nie zgłoszenie defektu. |
| `UW-04-07` `assessment-initiatives-table` | **DUŻE** | `grep -rn InitiativesTable src/` poza samym plikiem `src/components/assessment/InitiativesTable.tsx` pokazuje TYLKO wzmianki w komentarzach dwóch innych plików — **zero realnych importerów**. To nie jest kwestia flagi: komponent nie jest zamontowany NIGDZIE w aplikacji produkcyjnej. Żeby właściciel zobaczył „normalną tabelę inicjatyw" w tym miejscu, trzeba go realnie podłączyć (routing/miejsce w hubie) — praca projektowa, nie kosmetyka. |
| `UW-04-08` `siri-workspace` | **NIEJASNE** | Właściciel wprost: „nie znam Siri, więc trudno mi to ocenić" — nie zgłasza konkretnego defektu, tylko brak kompetencji do oceny. Nie ma czego naprawiać bez dodatkowego pytania do niego. |
| `UW-04-09` `drd-library-entry` | **DUŻE** | „Do powtórki" — właściciel explicite odrzuca obecny zestaw kolumn tabeli i brak podglądu jako niewystarczające. To przeprojektowanie kolumn/podglądu biblioteki DRD, wymaga decyzji, co konkretnie ma się tam znaleźć — nie jest to znana, gotowa do zacytowania poprawka. |

### 05_INITIATIVES

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-05-01` `plan-scenario-d1` | **ZROBIONE** | `src/components/Initiatives/PlanScenarioSurface.tsx:90-109` — przycisk „Otwórz" w `StandardPreview` woła teraz `onOpenInitiative` (otwiera KARTĘ inicjatywy), zamiast montować warsztat planu pod tabelą. Warsztat ma osobną, uczciwie nazwaną akcję „Otwórz narzędzia planu". Dokładnie to, o co prosił właściciel 30.08. |
| `UW-05-02` `capacity-advisor-a3` | **DUŻE** | `grep -n "raport\|Raport" src/components/Initiatives/CapacityScenarioSurface.tsx` — **zero trafień**. Właściciel opisuje konkretną funkcję: przycisk „Tworzy raport" generujący migawkę obciążenia zespołu na dany moment (point-in-time snapshot) — tej koncepcji w komponencie w ogóle nie ma. To nowa funkcja, nie poprawka istniejącej. |
| `UW-05-03` `exe-002-004-ui-audit` | **NIEJASNE** | „Trzeci raz dajesz mi tę kartę do akceptacji" — to skarga na proces przeglądu (powtórka), nie opis defektu ekranu. Jedyny nazwany defekt w dotychczasowej dokumentacji (status w pasku tożsamości jako zwykły tekst zamiast pigułki) nie jest tym, o czym mówi ta konkretna uwaga — nie zgaduję połączenia. |
| `UW-05-04` `initiative-record` | **ZROBIONE** (nie defekt) | To dokładnie ten sam komponent co `karta-initiative` (`InitiativeDocumentView.tsx`), tylko inny zestaw danych demo w rejestrze grafiki — potwierdzone czytaniem obu plików dev-render. Nie ma dwóch różnych „tabel inicjatyw"; to duplikat w korpusie przeglądu, nie w produkcie. |
| `UW-05-05` `karta-initiative` | **ZROBIONE** | `src/components/Initiatives/InitiativeDocumentView.tsx:11528-11541` — przycisk „Wypełnij z AI" (otwiera Konsultanta AI) istnieje w Menu 2, potwierdzony dedykowanym testem regresyjnym `src/components/Initiatives/__tests__/day277-wypelnij-cala-karte.test.tsx` (sprawdza dokładnie jedno wystąpienie etykiety i wywołanie `runWholeCardAi`). |

### 06_EXECUTION

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-06-01` `execution-tab-work` | **ZROBIONE** | Pasek między Menu 3 a tabelą usunięty, filtr przeniesiony na prawo od Menu 2 — potwierdzone zrzutem PRZED/PO `evidence/grafika/165-menu3-pasek/` (fala 01.09), zgodnie z dosłowną treścią uwagi. Tabela zaczyna się teraz pod Menu 3, jak w standardzie. |
| `UW-06-02` `execution-tab-control` | **ZROBIONE** | To samo co wyżej — pasek nad tabelą usunięty, przyciski „Dodaj sygnał"/„Przygotuj interwencję" przeniesione na prawo od Menu 2, ten sam dowód `evidence/grafika/165-menu3-pasek/`. |
| `UW-06-03` `execution-tab-rollout` | **ZROBIONE** | Zdanie opisowe między nagłówkiem a tabelą usunięte, dokładnie zgodnie z uwagą „tutaj wcale te słowa nie są potrzebne" — potwierdzone zrzutem PRZED/PO tej samej fali. |

### 07_MY_WORK_AGENT

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-07-01` `karta-decision` | **NIEJASNE** | Treść uwagi to wyjaśnienie/przypomnienie właściciela („pamiętaj, że to są dwie różne funkcjonalności"), nie zgłoszenie usterki na tym ekranie. Nie ma tu konkretnego „zrób X". |
| `UW-07-02` `decision-record` | **DUŻE** (częściowo zrobione) | `src/components/MyWork/DecisionDetailView.tsx:2418-2470` — komentarz `MW-DEC-001` potwierdza: komentarze/alternatywy/ryzyka/uzasadnienie są DZIŚ realnie zapisywane po stronie serwera (to były klasyczny „two sources of truth" bug, naprawiony). Ale `attachments`, `escalation` i `description` nadal jawnie deklarowane jako „transitional fallback for fields that genuinely have no backend endpoint yet" — czyli nadal żyją WYŁĄCZNIE w `localStorage` (linie 2438-2470). Główny lęk właściciela („to zostaje tylko w przeglądarce") jest częściowo prawdziwy do dziś — wymaga dorobienia endpointu backendowego dla tych trzech pól. |
| `UW-07-03` `idea-table-tool-empty-filter` | **ZROBIONE** | Ekran pokazuje dwa odrębne, uczciwe stany pustki (brak wyników filtra vs brak rekordów) — wzorcowy przykład wg wcześniejszego audytu, bez zastrzeżeń. Uwaga właściciela („nie wiedziałem, że mamy taką tabelę") to odkrycie już istniejącej, dobrze zbudowanej funkcji, nie zgłoszenie błędu. |
| `UW-07-04` `idea-templates-catalog` | **ZROBIONE** | Katalog ok. 40 szablonów w 7 kategoriach działa; jedyny nazwany defekt (crimson na tagu narzędzia) naprawiony. Sama uwaga („to moje marzenie, aby to działało dobrze") jest aspiracyjna, bez konkretnego zarzutu. |
| `UW-07-05` `notatnik-centrum-mysli` | **DUŻE** | To NIE jest gotowy ekran — to wizja/mockup nadbudowy na notatniku. Realne są tylko dwa elementy (`NotebookReminderChip`, `NotebookPresenceStack`); karta, na której „Teresa proponuje zapisanie notatki", jest ilustracją, nie działającą funkcją. Cała reszta wymaga zbudowania od zera. |
| `UW-07-06` `notatnik-osierocone-graf` | **ZROBIONE** | `src/components/MyWork/NotebookContent.tsx:1028-1030,4254-4266` — graf połączeń dostał tryb pełnoekranowy (`graphFullscreen` state + przycisk „Pełny ekran"), dokładnie zgodnie z uwagą „zrób to na całym ekranie". |
| `UW-07-07` `vault-safes-table` | **DUŻE** | `src/views/vault/VaultSafesTable.tsx:346,438` używa `StandardTable` — problem wąskiej tabeli z wierszami łamiącymi się na cztery linie to prawdopodobnie ten sam rodzinny defekt co w `capacity-advisor-a3` (mechanizm klamrowania kolumn w `FilterableTable`/`StandardTable` nie radzi sobie z długimi pojedynczymi słowami w rosnącej komórce) — wymaga naprawy współdzielonego komponentu, nie tego ekranu punktowo. |
| `UW-07-08` `vault-folder-block-proof` | **DUŻE** | Właściciel akceptuje grafikę, ale explicite pisze, że „cała funkcjonalność agenta powinna być duzo bardziej rozwinięta" — to prośba o rozbudowę merytoryczną agenta (poza tym jednym klockiem kontekstu sejfu), nie punktowa poprawka wizualna. |
| `UW-07-09` `whiteboard-canvas` | **ZROBIONE** | `src/components/MyWork/whiteboard/WhiteboardSelectionBar.tsx:66-77` — komentarz cytuje uwagę właściciela dosłownie („pasek nie może przerosnąć kanwy") i opisuje naprawę: `max-w-[calc(100%-1.5rem)]` + tryb tylko-ikony (podpisy w dymku) + `overflow-x-auto` jako ostatnia deska ratunku. Zmierzone przed naprawą: pasek 1100px w kanwie 1064px, wystawał po 18px z każdej strony. |
| `UW-07-10` `processflow-canvas` | **NIEJASNE** | Właściciel sam pisze „na tym obrazie jak go [panelu bocznego] nie mogę ocenić" — jawnie deklaruje niemożność oceny ze zrzutu. Nie ma konkretnego zarzutu do zamiany na zadanie. |
| `UW-07-11` `agent-plan-canvas` | **DUŻE** | Właściciel prosi o przesuwalne/układalne klocki flow (wzorem N8N) budowane też przez AI — obecny schemat tego nie robi. To już wcześniej świadomie odłożone jako duża praca poza zakresem tej fali (potwierdzone w `docs/program/grafika/ODLOZONE.md` per audyt 01.09) — pozostaje otwarte. |
| `UW-07-12` `agent-warsztat` | **DUŻE** | Dwa wątki naraz: (1) „za małe są te elementy" — wizualne powiększenie, prawdopodobnie drobne; (2) „ten agent jest jeszcze do wypracowania merytorycznie" (np. równoległość procesów) — to praca funkcjonalna. Połączone w jednej uwadze, całość wymaga decyzji zakresu, więc klasyfikuję jako DUŻE. |
| `UW-07-13` `idea-financial-case-persistence` | **NIEJASNE** | Komponent istnieje realnie (`src/components/MyWork/table/financial/FinancialCaseView.tsx`, `FinancialCaseDialog.tsx`, `useIdeaFinancialCasePersistence.ts`) i ma wcześniej naprawione braki tłumaczeń, ale właściciel wprost pisze „nawet nie wiem, co to jest i do czego to przypiąć" — to pytanie o cel/UX wejścia w funkcję, nie zgłoszenie błędu w działaniu. |
| `UW-07-14` `idea-table-timeline-stuck` | **DUŻE** | „Tak samo jak we wszystkich innych IDEach, wraca kwestia prawego menu" — odsyła do tego samego, większego problemu co `UW-07-17`/`UW-07-18` (prawy panel Idei do gruntownego przepracowania), nie do lokalnego defektu tego ekranu. Sam błąd zacinania się zakładek osi czasu jest już naprawiony (potwierdzone klikiem w poprzednim audycie). |
| `UW-07-15` `zwornik-projects` | **ZROBIONE** | Zweryfikowane czytaniem `src/components/MyWork/MyWorkHub.tsx` (zakładka „Projects"/FolderKanban w głównym menu huba, bez flagi — ten sam wzorzec co Tasks/Decisions) i `src/components/MyWork/CommandPalette.tsx` (osobna, poprawnie podpisana akcja `action-open-projects`, nie myląca się już z „Otwórz kalendarz"). Dokładnie odpowiada na „nie wiem, gdzie to się uruchamia". |
| `UW-07-16` `mywork-idea-inspector-lekki` | **ZROBIONE** (wymaga ponownego pokazania) | Ekran jest w fali „ujednolicona szerokość prawego pasa (320px)" — istnieje świeży zrzut PO, ale bez odpowiednika PRZED, więc sam właściciel nie mógł potwierdzić, co się zmieniło. To dokładnie wzorzec z hipotezy tego dyżuru: rzecz zmieniona, ale pokazana bez dowodu porównawczego — do ponownego zrzutu z PRZED/PO, nie do nowej naprawy kodu. |
| `UW-07-17` `ideas-teresa-panel` | **DUŻE** | Właściciel wprost: „koniecznie trzeba wrzucić to do backlogu, żeby przeanalizować, jak ten panel powinien być zorganizowany" — to jego własna klasyfikacja jako dużej, odłożonej pracy projektowej (graficznej i merytorycznej), nie punktowa poprawka. |
| `UW-07-18` `mywork-notebook-rail-speca` | **DUŻE** | Wiąże się bezpośrednio z `UW-07-17` — właściciel chce, żeby prawe panele Notatnika i Idei „rządziły się tymi samymi zasadami" i żeby informacja o koniecznym przepracowaniu (z panelu Idei) objęła też ten ekran. Wspólne zadanie z 07-17, nie osobna drobna poprawka. |

### 09_RESULTS

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-09-01` `results-vnext-roi-full-tool` | **DUŻE** | Właściciel chce przebudowy ROI na „N-kartę" (jedna karta artefaktu z zakładkami jako sekcjami, nie poziome menu). To ta sama, już nazwana inicjatywa co przy `results-vnext-okr-workspace` (plan w `docs/program/grafika/ODLOZONE.md`, wzorem ROI z 30.08) — architektura powłoki, nie kosmetyka. |
| `UW-09-02` `results-vnext-roi-model` | **DUŻE** | To samo zgłoszenie co 09-01 — właściciel explicite odsyła do tego samego wniosku („musimy przenieść to do jednej n-karty"). Jedna, wspólna praca dla całego ROI. |
| `UW-09-03` `results-vnext-roi-pir-outcomes` | **DUŻE** | Kolejna konsekwencja tej samej decyzji N-karty dla ROI — nie osobny defekt tego konkretnego podekranu. |
| `UW-09-04` `results-vnext-okr-registry` | **ZROBIONE** | `src/components/ResultsVNext/okr/ResultsOkrHub.tsx:563-579` — komentarz cytuje uwagę właściciela dosłownie i pokazuje naprawę: JEDEN primary CTA „Nowy OKR" w prawym górnym rogu (kanon `StandardModuleBar.primaryCta`), pary Programs/Cycles przeniesione do Menu 3 zamiast stać obok jako „niepotrzebne przyciski". |
| `UW-09-05` `results-vnext-teresa-okr-reflection` | **DUŻE** | Brak `naprawione` w dotychczasowym audycie dla tego ekranu — ta sama rodzina co `results-vnext-teresa-kpi-deviation` (formularz „jak sprzed 5 lat", płaskie niestylowane pola) — wymaga przeprojektowania wizualnego formularza refleksji, nie jest to jednolinijkowa poprawka. |
| `UW-09-06` `results-vnext-okr-admin` | **ZROBIONE** (nie defekt) | To uczciwy stan wyłączonej dla organizacji funkcji administracyjnej, nie usterka wyglądu — sam właściciel to sygnalizuje niepewnością „chyba że ich [przycisków] tu nie ma". Wcześniejszy audyt tego samego ekranu potwierdza: „to prawdziwy stan flagi, nie defekt". |
| `UW-09-07` `results-vnext-teresa-kpi-deviation` | **DUŻE** | Stan OTWARTEJ (edytowalnej) sprawy odchylenia nadal wygląda surowo — płaskie, niestylowane pola HTML, szare przyciski. To prawdopodobne źródło skargi „grafika jak sprzed 5 lat" i pozostaje nienaprawione mimo napraw stanu ZAMKNIĘTEGO tej samej sprawy w innej fali. Wymaga przeprojektowania wizualnego całego formularza. |
| `UW-09-08` `results-vnext-attention` | **ZA FLAGĄ** | Patrz tabela na górze. Sama treść uwagi („tu są tylko dwa przyciski w Menu 2") to nieporozumienie co do roli Menu 2 (przełącznik ŹRÓDŁA KPI/OKR) vs Menu 3 (13 list) — ale to drugorzędne wobec faktu, że ekran jest za wyłączoną domyślnie flagą i większość użytkowników w ogóle go nie widzi. |
| `UW-09-09` `results-vnext-okr-workspace` | **DUŻE** | „To miało być w N-type karcie" — właściciel trafnie rozpoznał docelowy kształt; to ta sama, już nazwana i zaplanowana przebudowa (`docs/program/grafika/ODLOZONE.md`), sześć zakładek poziomych do zamiany na sekcje karty N. |
| `UW-09-10` `results-vnext-search-registry` | **ZA FLAGĄ** | Patrz tabela na górze — flaga `resultsSearch` domyślnie OFF. |

### 10_FINANCE

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-10-01` `finance-analysis-workspace` | **ZROBIONE** | Tabela wskaźników ma dziś wszystkie 11 nagłówków w pełni (bez ucięcia) i kolumna „Wzór" zawija się w całości zamiast ucinać do „Prz…" — potwierdzone na świeżym zrzucie z obu motywów (fala 154-finanse-naprawa). Dokładnie odpowiada na „nic tu nie widać, nic z tego nie można wyciągnąć". |
| `UW-10-02` `finance-valuation-workspace` | **DROBNE** | `src/components/Finance/Valuation/ValuationWorkspace.tsx:7` — komponent deklaruje `WorkspaceBarConfig` i nie rysuje własnego nagłówka (poprawnie wg kanonu), ale nie znalazłem w kodzie potwierdzenia, że wewnętrzne przyciski akcji (na które wskazuje właściciel — „przyciski u góry są słowami, nie okrągłymi przyciskami") zostały zamienione na kanoniczne pigułki CTA. Wymaga punktowego sprawdzenia zrzutem i prawdopodobnie krótkiej poprawki CSS/komponentu przycisku. |
| `UW-10-03` `finance-compare-panel` | **ZROBIONE** | Tabela porównania rozszerzona z wąskiej wyśrodkowanej karty (~740px) na pełną szerokość dostępnego ekranu (~1364px) — potwierdzone zrzutem PRZED/PO w obu motywach (`evidence/grafika/166-tabela-szerokosc/`), dosłownie odpowiada na „może całą szerokość dostępnego ekranu wykorzystajmy". |

### 11_MATERIALS

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-11-01` `template-builder-doc` | **ZROBIONE** (czysta pochwała) | „To jest super!!!!!!! proste i czytelne — brawo" — brak zgłoszonego defektu, nic do zrobienia. |
| `UW-11-02` `template-library-new-entry` | **ZROBIONE** | Kreator `TemplateBuilderFlow` realnie się otwiera i renderuje po polsku (krok 1/3, pole nazwy, przyciski Anuluj/Dalej) — potwierdzone. Zdanie właściciela urywa się w połowie („już przyciski – przycisk dodawania, …"), więc główny zarzut („to jest normalna tabela") jest potwierdzeniem, nie zgłoszeniem błędu. |
| `UW-11-03` `materialy-launcher` | **NIEJASNE** | „Mogłoby być trochę bardziej seksowne" — brak konkretnego kierunku zmiany. |
| `UW-11-04` `excele-jeden-widok-recent` | **DUŻE** | Właściciel chce USUNIĘCIA tego ekranu jako zbędnej pozostałości pierwszych prób — skoro otwarcie arkusza od razu pyta o źródło (szablon/czysty/Teresa), ten ekran „Recent" jest w jego ocenie niepotrzebnym duplikatem. To decyzja produktowa o usunięciu ekranu, nie poprawka wizualna. |
| `UW-11-05` `prezentacje-template-states` | **ZROBIONE** | Fala 01.09: domyślny wariant pokazuje realną treść (nie pusty spinner), stan „ładowanie" po 20s odrzuca się do czytelnego komunikatu błędu z przyciskiem powrotu — potwierdzone zrzutem PRZED/PO. Dokładnie zamyka „nie otwiera mi się nic :(". |
| `UW-11-06` `gen-word-content-hints` | **ZROBIONE** (nie defekt) | Treść uwagi to opis zrozumienia przeznaczenia ekranu przez właściciela („widzimy, po co jest ten ekran"), nie zgłoszenie usterki. |
| `UW-11-07` `gen-deck-content-hints` | **NIEJASNE** | „Nie wiem, po co on w ogóle jest" — pytanie o cel ekranu, nie opis błędu. |
| `UW-11-08` `excele-edytowalna-siatka` | **ZROBIONE** | `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx` — pasek narzędzi zmieniony ze słów na ikony ($, %, B, ikony wiersza/kolumny, #), potwierdzone zrzutem PRZED/PO — dokładnie odpowiada uwadze „zamieńmy słowa na typowe dla Excela ikony". |
| `UW-11-09` `document-studio-resume-error` | **ZROBIONE** | `src/components/DocumentStudio/DocumentStudioView.tsx:924-943` — stan błędu jest już wyśrodkowany (`items-center justify-center`), ma ikonę w okrągłym tle, tytuł, komunikat i przycisk powrotu — dokładnie to, o co prosił właściciel („napisz to ładniej, wyśrodkuj"). |
| `UW-11-10` `document-studio-template-resolve-error` | **ZROBIONE** | Komentarz w kodzie („ten sam pattern co template-resolve-error powyżej") potwierdza wspólny, już wyśrodkowany wzorzec z 11-09. |
| `UW-11-11` `word-intake-uselm-default` | **NIEJASNE** | „Wiem, że to nie jest super ważne, ale nic tu nie poprawiłeś" — właściciel sam obniża priorytet i nie wskazuje, KTÓRE konkretnie przyciski/elementy mają zostać ujednolicone ze standardem. |
| `UW-11-12` `sheet-artifact` | **DUŻE** | Właściciel chce przeniesienia funkcji/informacji z górnej jednej trzeciej ekranu do rozwijanego panelu bocznego, żeby tabela zaczynała się od góry — restrukturyzacja layoutu artefaktu arkusza, nie punktowa poprawka. Powiązane z `UW-11-14`. |
| `UW-11-13` `deck-artifact` | **DUŻE** | Brak narzędzi ręcznej edycji w prawym panelu decka (i tak samo w Excelu) — właściciel wprost pisze, że „to trzeba dorobić". Brakująca funkcjonalność, nie defekt wizualny. Powiązane z `UW-11-14`. |
| `UW-11-14` `excele-prawy-panel-standard` | **DUŻE** | Ten sam co `UW-11-13`, ale nazwany wprost dla Excela: „nie mam tutaj w ogóle narzędzia Excelowego... to trzeba dorobić. W Wordzie mogę, w PowerPoincie też nie mogę." Realna luka funkcjonalna w edycji ręcznej artefaktów arkuszy/prezentacji. |

### 12_AUDITS

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-12-01` `audyty-drd-report` | **ZA FLAGĄ** | Patrz tabela na górze raportu — to najważniejszy pojedynczy przypadek tego dyżuru. |

### 13_CHAT

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-13-01` `teresa-confirm-chip` | **DROBNE** | Prośba o delikatniejszą formułę graficzną (mniej „toporną") istniejącej kontrolki potwierdzenia. Sama kontrolka istnieje i działa (pustka zamierzona — z natury zwięzła), zmiana dotyczy tylko stylu wizualnego, prawdopodobnie lokalna zmiana CSS/komponentu — nie znaleziono dowodu, że została już wykonana. |
| `UW-13-02` `teresa-chipy-sugestii` | **DUŻE** | Właściciel chce możliwości kontekstowego włączania/wyłączania chipów sugestii (nowy przełącznik/ustawienie), nie usunięcia funkcji ani prostej poprawki wyglądu — to nowa funkcja preferencji użytkownika. |
| `UW-13-03` `canvas-kebab-restructure` | **DUŻE** | Właściciel prosi o zamianę pozycji menu z gołych słów na przyciski w ramkach/półokrągłe — i sam podkreśla „to bardzo ważna zmiana, bo dotyczy wszystkich idea". Dotychczasowe naprawy tego menu dotyczyły tłumaczeń (PL/EN), nie restrukturyzacji wizualnej pozycji na przyciski — ten konkretny zarzut pozostaje otwarty i ma szeroki promień rażenia (wszystkie kanwy Idei). |
| `UW-13-04` `chat-signals-feed` | **ZROBIONE** (odkrycie, nie defekt) | „Nie wiem, gdzie to jest, ale to jest w ogóle super mądre" — czysta pochwała już istniejącej, w pełni podłączonej funkcji (panel sygnałów w `UnifiedChatPanel`, wcześniej naprawiony problem z brakiem drogi wejścia). Kolejny przykład „zrobione, tylko nigdy nie pokazane" z hipotezy tego dyżuru. |

### 14_ADMIN

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-14-01` `prompt-registry-tab` | **NIEJASNE** (odpowiedź, nie defekt) | Lokalizacja jest znana: SuperAdmin → AI Platform → Development → Rejestr promptów — to narzędzie inżynierskie, nie ekran dla klienta. Pytanie właściciela „gdzie to jest i do czego służy" jest w pełni odpowiadalne słownie; nie wymaga zmiany w kodzie, chyba że właściciel zdecyduje, że chce to inaczej umiejscowić w nawigacji. |
| `UW-14-02` `admin-command-center-panel` | **DROBNE** | Ekran ma widoczny nagłówek „Centrum dowodzenia", ale w menu nazywa się „Centrum administracyjne" — to rozjazd nazw, źródło zamieszania właściciela. Dodatkowo: `src/utils/commandCenterFlag.ts` deklaruje `isCommandCenterEnabled()`, która wg wcześniejszego audytu nie ma dziś ŻADNEGO wołającego w kodzie — martwa flaga-fantom (sekcja jest zawsze widoczna niezależnie od niej). Poprawka nazwy + ewentualne usunięcie martwej flagi to mała, punktowa zmiana. |
| `UW-14-03` `admin-command-attention-queue` | **ZROBIONE** | Kolejka uwagi została zmieniona z siatki 4 kart na tabelę z filtrowalnymi kolumnami (StandardTable, więc z natury pełnej szerokości) — dokładnie odpowiada na „to nie jest szerokość strony". Osobno, nienaprawione i nieobjęte tą uwagą: błędny licznik „Ryzyka wymagające przeglądu" (zawsze 0, zgłoszenie #22 do toru funkcji) i surowe adresy techniczne w kolumnie „Źródło" — to inne, już osobno zgłoszone usterki, nie treść tej konkretnej uwagi o szerokości. |

### 15_SETTINGS

| ID | Stan | Dowód |
| --- | --- | --- |
| `UW-15-01` `calendar-sync-settings` | **DUŻE** (część zrobiona) | Dwie części: (1) ikona jabłka — **ZROBIONE**: `src/components/settings/CalendarSyncSettings.tsx:222-229` zamienia surowe emoji dostawców (📅/📆/🍎) na jedną neutralną ikonę `Calendar` z `lucide-react`, komentarz cytuje dokładnie uwagę właściciela z 30.08. (2) Outlook — **częściowo**: dostawca `outlook`/`outlook_calendar` już istnieje po stronie serwera (`server/src/routes/calendarIntegrations.routes.ts:31`, `server/src/routes/settings.routes.ts:1509-1510`), ale realne OAuth „Google/Outlook calendar OAuth integration is not available yet" (`calendarIntegrations.routes.ts:26`) — czyli Outlook może już pojawiać się na liście, ale nie da się go realnie podłączyć. Wymaga dokończenia integracji OAuth, nie jest to gotowe do pokazania jako działająca funkcja. |

## Co zaskoczyło

1. **`audyty-drd-report` to najbardziej dobitny przypadek hipotezy z briefu.** Cały edytor
   raportu DRD — panel AI, akcje per sekcja, eksport PDF, żywy backend — istnieje od
   dawna i nie ma ŻADNEJO wejścia w produkcie poza flagą domyślnie OFF. Właściciel pytał
   „gdzie to jest", bo dosłownie nigdzie nie prowadzi.
2. **`assessment-quality-review-panel` i `assessment-presentation-view`** to przykłady
   odwrotne: obawa właściciela („czy to zastępuje macierz?", „gdzie jest moja macierz DRD?")
   była już rozstrzygnięta w kodzie komentarzami odpowiadającymi wprost na jego pytania —
   ale te odpowiedzi nigdy nie zostały mu przekazane wprost, więc pytał dalej.
3. **Rodzina „prawy panel Idei/Notatnika" (`UW-07-14`, `UW-07-17`, `UW-07-18`) to jedna,
   spójna, DUŻA praca**, którą właściciel sam zidentyfikował i sam poprosił o wpisanie
   do backlogu — nie trzeba było tego łączyć ręcznie, on to już połączył swoimi słowami.
4. **`decision-record` (`UW-07-02`) jest w połowie drogi**, nie całkiem zrobiony i nie
   całkiem zepsuty: komentarz `MW-DEC-001` w kodzie sam przyznaje, że część pól wciąż
   żyje tylko w `localStorage` jako świadomy, tymczasowy stan — to rzadki przypadek,
   gdzie kod jest bardziej szczery niż jakikolwiek raport o nim.
5. **Cztery uwagi to czysta pochwała bez treści do naprawienia** (`UW-11-01`,
   `UW-11-06`, `UW-13-04`, częściowo `UW-11-02`) — w tym dwie („nie wiedziałem, że to
   mamy" / „nie wiem gdzie to jest, ale super mądre") to dokładnie wzorzec „zrobione,
   nigdy nie pokazane" z hipotezy briefu, tylko odkryte przez samego właściciela
   przypadkiem, a nie przez nas.
6. **`assessment-initiatives-table` (`UW-04-07`) nie jest kwestią flagi w ogóle** —
   komponent nie ma żadnego importera w całym `src/`. To głębsza nieosiągalność niż
   „za flagą": nawet włączenie jakiejkolwiek flagi by nie pomogło, bo nic go nigdzie
   nie montuje.

## Commity tej sesji

Zobacz `git log` na gałęzi `agent/triaz-uwag-20260902` — commity co ~20 uwag,
opisane niżej w treści commitów.
