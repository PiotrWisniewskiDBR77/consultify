---
doc_id: plan-napraw-mvp-20260905
status: ZYWY
---

# Plan napraw MVP — 05.09.2026

Zlecenie właściciela 05.09: „przeanalizujesz wszystko i przygotujesz plan napraw, żebym ja nie
musiał tego kolejny raz opisywać. Tam, gdzie mamy opisany standard, liczę, że będzie uzyskany,
zanim go sprawdzę. Ekrany, których wcześniej nie akceptowaliśmy, przygotuj do akceptacji
seryjnej (patrz `ODBIOR_SERYJNY_20260905.md`). Żadnych drobiazgowych dyskusji na ekranach, na
których już byłem.”

**Źródła** (nic tu nie jest z pamięci — każda pozycja ma źródło):
`evidence/odbior-zywo-20260905/*/wyniki.json` + `RAPORT.md` (258 ekranów, przejście na żywo
05.09), `docs/program/MVP_BACKLOG_20260905.md` (lista A, 54 pozycji z korpusu uwag),
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_*_20260905.md` (5 raportów naprawczych
dzisiejszych), `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`
(DEC-2026-09-05-395), `git log` gałęzi `m03` z 05.09, `docs/program/AUDYT_16_MODULOW_20260905/`.

**Legenda kolumny Przyczyna**: FLAGA (przełącznik wizualny domyślnie OFF/rozjazd konfiguracji) ·
DANE (organizacja testowa nie ma zaseedowanych rekordów — różnica danych, nie UI) · DEFEKT (błąd
w kodzie/routingu/API) · PRZYRZĄD (obraz referencyjny sam jest zepsuty/nie z produktu — kłamał
pomiar, nie produkt) · STANDARD (kanon TRIADA/SPEC-A/preview nieosiągnięty) · DECYZJA (temat już
rozstrzygnięty przez właściciela — fala 2 albo „nie”) · ROLA (brak uprawnienia na koncie
testowym).

**Legenda kolumny Stan**: ZROBIONE (SHA/agent, dziś 05.09) · W TOKU (agent pracuje) · DO ZLECENIA
(gotowe do zlecenia robotnikowi) · FALA 2 (świadomie odłożone, DEC w rejestrze) · DANE (nie
proponuję naprawy kodu — potrzebny realny rekord) · NIEZMIERZONE (nie sprawdzone dziś, powód
podany).

## Liczby całościowe (258 ekranów, przelot 05.09)

| Werdykt | Liczba |
|---|---|
| ZGODNY | 112 |
| ROZNI_SIE | 91 |
| NIE_DOTARLEM | 55 |
| **Razem** | **258** |

Plus 54 pozycje z `MVP_BACKLOG_20260905.md` listy A (korpus uwag właściciela + znaleziska
dyżurów), z czego część pokrywa się z ekranami powyżej (scalone w jedną pozycję planu poniżej), a
1 (A54, język konta) już zrobiona przed tym pomiarem.

---

## 01. Czat (15 ekranów: 10 zgodne / 2 różnią się / 3 nie dotarłem)

**Co właściciel zobaczy po naprawach**: dokładnie to, co już widział i słownie zaakceptował
05.09 rano (DEC-395: „dla czata nie mam żadnych uwag do grafik i układu”) — kebaby pionowe
wszędzie, nowe powitanie H1 (5 rotujących wariantów, bez podtytułu), kafle narzędzi bez opisu,
skrócone zakładki kanwy Dok/MD. Zostają dwa drobiazgi do potwierdzenia (sygnały, pasek Tablicy)
i jeden większy temat na później (audyt 449 przycisków Czatu).

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| Kebaby w całej aplikacji (poziome→pionowe, 45 plików) | Właściciel 05.09: ujednolicić kebab. | STANDARD | `MoreHorizontal`→`MoreVertical`, `RowActionsMenu` zawsze pionowy. | **ZROBIONE** SHA `674eb5014e` | TRIADA lista B |
| Powitanie Czatu + kafle narzędzi | Stary nagłówek z podtytułem, kafle z opisem, linia „Tip”. | STANDARD | H1 z 5 rotującymi wariantami bez podtytułu, kafle bez opisu, delikatna ikona przejścia, bez „Tip”. | **ZROBIONE** SHA `6acb5b449f` | — |
| Zakładki kanwy Dokument/Markdown | Pełne etykiety zamiast skróconych. | STANDARD | Skrócono do „Dok”/„MD”. | **ZROBIONE** SHA `36f1eaaec4` (merge `4332ade1c6`) | — |
| `chat-signals-feed` / A51 | Panel „Ważne sygnały” 1:1 zgodny, ale lista pusta: „Producent sygnałów jest wyłączony”. | FLAGA | Producent sygnałów włączony na serwerze 05.09 04:22 wg backlogu — **potwierdzić po restarcie**, że lista pokazuje realne sygnały. | W TOKU (do potwierdzenia) | — |
| `chat-split-teresa-right` | Układ D17 zgodny; różni się zestaw ikon paska kanwy (świeży, niezapisany dokument: duplikuj/globe/szablon/X zamiast share/save/„Main”/sparkle). | DANE | Prawdopodobnie zamierzony wariant paska dla dokumentu roboczego vs zapisanego — **potwierdzić z właścicielem**, czy to zamierzone. | DO ZLECENIA (potwierdzić) | — |
| A02 `whiteboard-canvas` | Właściciel: po zaznaczeniu elementu pasek poziomy funkcji nie mieści się w oknie, ikony wychodzą poza, opisy za długie. | DEFEKT | Skrócić etykiety paska funkcji Tablicy / zawinąć pasek zamiast przepełniać. | DO ZLECENIA | TRIADA lista B |
| A01 `processflow-canvas` | Właściciel nie mógł ocenić prawego panelu na obrazie („tutaj wielkim wyzwaniem jest ten panel boczny”). | PRZYRZĄD | Zrobić nowy, czytelny zrzut prawego panelu Process Flow do oceny. | DO ZLECENIA | preview 6 bloków |
| A53 — limiter AI liczył polling w tle | Czat blokował się na 30 żądań/min, licząc też ciche odpytywanie. | DEFEKT | Czyste odczyty bazy nie zjadają budżetu generatywnego; wyłączony limiter na stagingu do czasu naprawy. | **ZROBIONE** SHA `1fe2af0fcd` (merge `d10930ae74`) | — |
| `mindmap-i18n-smoke` | Modal „Dodaj dowód/źródło” nieosiągnięty automatem — sekcja „DOWODY I ŹRÓDŁA 0” nie reagowała na klik nagłówka. | NIEZMIERZONE | Sprawdzić ręcznie (może inny trigger niż klik, np. najechanie) — nie wiadomo jeszcze czy to defekt. | DO ZLECENIA (ręczna próba) | — |
| `ntype-analizuj-ai`, `teresa-confirm-chip` | Wymagają realnego wywołania AI — zakazane w protokole odbioru. | PRZYRZĄD | Brak — do oceny ręcznej przez właściciela. | NIEZMIERZONE | — |
| Audyt przycisków Czatu (449 elementów, 7 agentów + 2 sceptyków, `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/`) | 7 usterek P1 potwierdzonych: fałszywe etykiety „AI” (K1), martwy przycisk „Akcje biznesowe” (K2), integracje chmurowe bez logowania do dostawcy (K3), „Konwertuj na inicjatywę” zapisuje Decyzję (K4), karta potwierdzenia sprawy nigdy się nie renderuje (K5), „Zapytaj AI teraz” gubi wiadomość (K6), menu pływające edytora milczy przy błędzie (K7, poza „Wyjaśnij”). Plus ~40 miejsc angielskiego w polskim UI. | DEFEKT | Osobny większy temat — nie blokuje odbioru wizualnego (właściciel już zaakceptował układ). Naprawić K1–K7 po kolei, poza MVP. | **FALA 2** (dług odkryty dziś, nie zgłoszenie właściciela) | — |

---

## 02. Moja praca (31/33 ekrany: 15 zgodne / 10 różni się / 6 nie dotarłem)

**Co właściciel zobaczy po naprawach**: podgląd tabeli Pomysłów i karta Decyzji dociągnięte do
kanonu, katalog szablonów i menedżer szablonów rekordu naprawione, zniknie 404 przy historii
decyzji. Prawy panel Idei/Notatnika (duże przeprojektowanie MELS) i katalog 40 szablonów zostają
w fali 2 — to już rozstrzygnięte decyzje właściciela (DEC-354/372/373/374), nie dzisiejsza praca.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `idea-table` + A04 | Tabela zgodna, ale podgląd po kliknięciu wiersza to panel SZCZEGÓŁY/AI/POWIĄZANIA/CO DALEJ, nie kanoniczny akordeon AKCJE/WŁAŚCIWOŚCI/POWIĄZANIA/ŹRÓDŁA/KOMENTARZE/HISTORIA. Właściciel: „Preview ciągle nie jest zgodny z wzorem”. | STANDARD | Przepiąć podgląd tabeli Pomysłów na kanoniczny `PreviewPaneShell`/akordeon artefaktu. | DO ZLECENIA | **preview 6 bloków + TRIADA lista B (obowiązkowo)** |
| Rodzina `idea-table-tool-*` (grouping, sortfilter, empty-filter, kebab, paste, record-templates — 6 ekranów) | Obrazy referencyjne to zrzuty innego silnika (dev-render `PlatformGridView`: wiersz filtrów per kolumna, gęstość wierszy, prawy klik = kebab). Realna tabela Idei to inny komponent — bez tych funkcji, klik w wiersz otwiera edytor komórki. | PRZYRZĄD + STANDARD | Decyzja zakresu: dobudować filtr per kolumna/gęstość/kebab wiersza w realnym silniku tabeli Idei, albo zaakceptować obecny silnik i podmienić referencje. | DO ZLECENIA (decyzja zakresu) | TRIADA lista B (StandardTable) |
| `idea-table-tool-empty-filter` | Pusty wynik filtra (6 wierszy, 0 trafień) pokazuje komunikat „Tabela jest jeszcze pusta” (brak rekordów w ogóle) zamiast „brak wyników filtra”. | DEFEKT | Rozróżnić dwa stany pustki w komponencie tabeli. | DO ZLECENIA | — |
| `idea-templates-catalog` | Katalog 40 szablonów w 7 kategoriach zastąpiony modalem 10 kart bez nagłówków kategorii. Korpus: „to jest moje marzenie aby to wszystko działało dobrze”. | STANDARD | Bez twardego żądania naprawy dziś — właściciel formułuje to jako marzenie, nie zgłoszenie. | **FALA 2** | — |
| `idea-table-record-templates` | Menedżer „Szablony rekordów” (+ Nowa) nieosiągalny — menu „Więcej narzędzi” → „Szablony” otwiera galerię szablonów TABEL, a nie rekordu. | DEFEKT | Podłączyć właściwy komponent „Szablony rekordów” pod pozycję menu. | DO ZLECENIA | — |
| `karta-decision` + `decision-record` (ten sam komponent) + A03 | Układ zgodny, ale 2× HTTP 404 na `/api/decisions/<id>/history` (sekcja HISTORIA bez danych); doszedł przycisk „Wyślij do przeglądu”. Właściciel: obawa, że dane zostają tylko w pamięci przeglądarki, nie na serwerze. | DEFEKT | (1) Naprawić/dograć `GET /api/decisions/:id/history`. (2) Zweryfikować wprost, czy zapis decyzji trafia na serwer, nie tylko do lokalnego stanu — potwierdzić właścicielowi pisemnie wynik testu. | DO ZLECENIA (priorytet: zaufanie do zapisu danych) | SPEC-A Rekord |
| `idea-confidentiality-control` + A05 (`idea-table-timeline-stuck`) | Selektor poufności zniknął; cały prawy panel Idei z obrazu (PROBLEM/STATUS/MODEL DOJRZAŁOŚCI/ISKRA) zastąpiła szyna MELS (6 paneli po lewej). | DECYZJA | Świadoma przebudowa panelu Idei — objęta DEC-2026-09-03-354 (nowy prawy panel Idei/Notatnika). | **FALA 2** (DEC-354) | — |
| `mywork-notebook-rail-speca` + A06 (`ideas-teresa-panel`) + A07 | AKCJE to lista tekstowa zamiast przycisków; WŁAŚCIWOŚCI dużo bogatsze niż wzór. Właściciel: notatnik lepszy niż Idea, chce ujednolicić elementy między nimi; cały prawy panel Idei „do przepracowania”. | DECYZJA | Ten sam temat co wyżej — ujednolicenie prawego panelu Idea/Notatnik to DEC-354. | **FALA 2** (DEC-354) | consultify-artefakty |
| `notatnik-centrum-mysli`, `mywork-idea-inspector-lekki`, `ideas-teresa-panel` | Obrazy zatwierdzone to bitowe duplikaty innych ekranów (md5 identyczny) — porównania nie dało się zrobić. | PRZYRZĄD | Odtworzyć poprawne zrzuty referencyjne (patrz `ODBIOR_SERYJNY_20260905.md` kat. a) — treść panelu i tak idzie do fali 2 (DEC-354). | DO ZLECENIA (nowe zrzuty) | — |
| `exec-summary-onelook` | Brak zakładki „Kokpit” w Menu 1 Realizacji (5 zakładek); deep-link z flagą przekierowuje na listę. Ten sam defekt jak `execution-tab-summary` (moduł 07). | DEFEKT | Dodać zakładkę „Kokpit”/„Summary” do Menu 1 Realizacji i wpisać `'summary'` na whitelistę parametru `tab` w `ExecutionHub.tsx`. Jedna naprawa zamyka oba ekrany. | DO ZLECENIA | TRIADA (Menu 1) |
| Znaleziska poboczne: tabela sejfów (nachodzące napisy NAZWA/ZAKRES), case finansowy tylko za ręczną flagą `?ff_ideaFinancialCase=1`, kalendarz 1× HTTP 501 `/api/integrations`, sporadyczny puste-0-rekordów >10s w tabeli pomysłu, stałe 404/409 w konsoli kanwy idei | Nie są osobnymi ekranami z odbioru, ale realne usterki znalezione po drodze. | DEFEKT | Do zlecenia zbiorczo jako sprzątanie modułu Moja Praca. | DO ZLECENIA | — |

---

## 03. Wywiad (6 ekranów: 2 zgodne / 0 różni się / 4 nie dotarłem)

**Co właściciel zobaczy po naprawach**: dwie nowe powierzchnie (kreator, warsztat DRD HTTP)
pokazane do wstępnego OK przed włączeniem flagi (zasada #7); naprawiony błąd ładowania sesji
wywiadu typu DRD; podłączony wspólny launcher tworzenia.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `interview-creator-shell` + A08 | Flaga `ff.interview_creator_shell` domyślnie OFF — dziś działa starszy formularz. Właściciel ma uwagi do wielkości ścianek/czcionek. | FLAGA | Pokazać czysty zrzut harnessu do wstępnego OK (zasada #7), poprawić wielkość/czcionki wg uwagi, dopiero potem włączyć flagę. | DO ZLECENIA | TRIADA lista B (przed pokazaniem) |
| `unified-create-launcher` | Komponent istnieje z flagą ON, ale zero miejsc go renderuje — „Nowa decyzja”/„New initiative” pomijają go. Przy okazji: mógł powstać pusty rekord-widmo po kliknięciu „Nowa decyzja”. | DEFEKT | Podłączyć `UnifiedCreateLauncher` pod oba przyciski. Sprawdzić bazę pod kątem osieroconych pustych rekordów decyzji z testów. | DO ZLECENIA | — |
| `drd-http-workspace` | Flaga `drdHttpSourceOfTruthV1` domyślnie OFF — działa starszy warsztat DRD. | FLAGA | Pokazać do wstępnego OK, potem włączyć zgodnie z zasadą #7. | DO ZLECENIA | TRIADA lista B |
| `karta-interview` + A09 (`interview-preview-canon`) | Realny błąd „Nie udało się wczytać sesji” (`InterviewHub.tsx:6353`) dla sesji typu DRD; inne sesje otwierają się w uproszczonym trybie bez lewego menu WYWIAD/KONTEKST/PODSUMOWANIE. Właściciel niepewny szerokości wg standardu. | DEFEKT | Naprawić ładowanie szablonu wielosekcyjnego dla sesji DRD; ujednolicić tryb dla wszystkich sesji; sprawdzić szerokość podglądu wg kanonu. | DO ZLECENIA | consultify-preview |

---

## 04. Narzędzia (8 ekranów: 2 zgodne / 4 różni się / 2 nie dotarłem)

**Co właściciel zobaczy po naprawach**: cztery ekrany, które nigdy realnie nie widział (obrazy
referencyjne to strony błędu przyrządu) — pokazane od nowa z prawdziwymi zrzutami; naprawiony
najdotkliwszy defekt modułu (29 sesji SWOT lądujących w awaryjnym angielskim JSON-widoku).

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| Rodzina PRZYRZĄD: `tools-swot-library-detail`, `tools-swot-session-workspace`, `tools-outputs-insights-tab`, `tools-sesja-wyjscie` | Obrazy referencyjne (`evidence/grafika/15-domkniecie/`) to strony błędu harnessu „Unknown ?screen=…” — właściciel nigdy nie widział tych 4 ekranów naprawdę. Na żywo wyglądają w większości dobrze. | PRZYRZĄD | Zastąpić referencje realnymi zrzutami z dzisiejszego odbioru (`ODBIOR_SERYJNY_20260905.md` kat. a) i pokazać do formalnej akceptacji. | DO ZLECENIA (nowe zrzuty) | — |
| `tools-outputs-insights-tab` (w tej samej rodzinie) | Zakładka „Insighty” ma 3 identyczne duplikaty wiersza „Sekcja finansowa — 2025”; kolumna TYP miesza PL/EN. | DEFEKT | Usunąć duplikaty źródłowe, ujednolicić język w kolumnie TYP. | DO ZLECENIA | — |
| `tools-swot-report` + A11 (`tools-swot-session-workspace`) | Zero sesji SWOT ma status „Zakończony” — raport nieosiągalny. NAJWAŻNIEJSZY defekt: wszystkie 29 sesji „Zatwierdzone” (typ SWT) otwierają się w awaryjnym angielskim widoku z surowym JSON: „doesn't have a dedicated UI yet”. | DANE (raport) + DEFEKT (placeholder) | Brak akcji na raport (dane). Priorytet: dobudować dedykowany UI dla typu sesji SWT zamiast placeholdera JSON. | DO ZLECENIA (wysoki priorytet) | consultify-artefakty |
| `prompt-registry-tab` | Konto właściciela nie miało roli SuperAdmin — `/superadmin/*` przekierowywało na `/chat`; dodatkowo flaga `promptRegistryUiEnabled`. | ROLA | Rola SuperAdmin nadana na stagingu 05.09 ~08:20 (DEC-395, `FORCE_SUPERADMIN_EMAILS`). | **ZROBIONE** (rola) — **retest ekranu potrzebny** | — |
| `karta-tool` (ZGODNY) + A10 | Właściciel: karta ostatniego przykładu (po usunięciu dwóch) wygląda źle w postaci jednej wąskiej kolumny. | DEFEKT | Poprawić układ sekcji PRZYKŁAD, gdy zostaje 1 pozycja zamiast 3. | DO ZLECENIA | SPEC-A archetyp |
| Poboczne: chip „Wszystkie 36” zostaje wizualnie aktywny mimo nałożonego filtra podtras; zakładka Sesje ładuje się >20s z ~21 błędami „Failed to fetch”; `docId` gubiony przy wejściu z URL | Nie są osobnymi ekranami odbioru. | DEFEKT | Do zlecenia zbiorczo. | DO ZLECENIA | — |

---

## 05. Ocena (19 ekranów: 1 zgodny / 13 różni się / 3 nie dotarłem) — najwięcej realnych defektów

**Co właściciel zobaczy po naprawach**: macierz DRD właściciela (9×7, treść komórek) już rysuje
się w RAPORCIE i prezentacji/dokumencie (naprawione dziś, piąte zgłoszenie tej samej sprawy);
panel „Zarządzanie” przestaje być niewidoczny; tabele modułu dociągnięte do kanonu; pozostaje
pytanie do właściciela o żywy edytor macierzy sesji DRD.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `assessment-report-contract` / A50 — **macierz DRD w RAPORCIE** | Piąte zgłoszenie: „Ciągle nie wiem dlaczego nie używasz mojej macierzy DRD”. Odrzucona `AreaMatrixTable` rysowała się zamiast `DRDMatrixGrid` właściciela. | DEFEKT | Macierz osi = `DRDMatrixGrid` właściciela we WSZYSTKICH powierzchniach raportowych (raport sesji, prezentacja, dokument); `AreaMatrixTable` usunięta z kodu (−2499 linii, zero wołaczy). Etykiety szyny rozdziałów nadal ucięte do „Pr…”/„Cy…” zamiast „Oś 1…7” (szyna za wąska) — drobiazg do dociągnięcia. | **ZROBIONE** SHA `1b9a0dad6f`,`d67db4f41a`,`eda90642c5`,`7901e966e3`,`38839f0984` (merge `0abfde0b23`) + **DO ZLECENIA** (etykiety szyny) | MACIERZ_TRESC_KOMOREK.md |
| `drd-macierz-oceny` (żywy edytor sesji) | Zakładka „Macierz” w ŻYWEJ sesji DRD nadal pokazuje ubogą tabelkę L1–L7 zamiast tej samej bogatej macierzy, którą właśnie naprawiono w raporcie. Naprawa dzisiejsza świadomie NIE dotknęła `DRDMatrixSession`/`AssessmentSessionEditorView` (ekran zapisu odpowiedzi, inny promień ryzyka). | DEFEKT | Przepiąć żywy edytor DRD na `DRDMatrixGrid` — wymaga decyzji właściciela: czy ruszać ekran z zapisem odpowiedzi. Pytanie zadane wprost w raporcie agenta. | **DO DECYZJI WŁAŚCICIELA**, potem DO ZLECENIA | MACIERZ_TRESC_KOMOREK.md |
| `assessment-output-report`, `assessment-presentation-view`, `assessment-artifacts-restart` + A14 | Zero zamrożonych Outputów w danych (`/api/method/outputs` → total 0) — trasy kończą się „Nie znaleziono”. Właściciel: audyt i ocena to dwie różne historie, oceny mają swój framework. | DANE | Brak naprawy kodu — potrzebny 1 realny zamrożony Output do pełnego retestu; wtedy potwierdzić, że i ta trasa rysuje `DRDMatrixGrid`. | DANE (retest po zaseedowaniu) | — |
| Rodzina „Zarządzanie poza ekranem”: `assessment-reports-panel`, `assessment-initiatives-panel`, `assessment-manage-panel` | Panel jest w DOM, ale górna krawędź zawsze wypada dokładnie na wysokości okna — niewidoczny, nie da się doscrollować. | DEFEKT | Naprawić kontener przewijania panelu „Zarządzanie” (doklejony pod pełnoekranową sekcją). | DO ZLECENIA (wysoki priorytet — funkcja całkowicie niewidoczna) | — |
| `assessment-quality-review-panel` + A16 | Brak 3 kafli i tabeli osi; „Ocena dostępna tylko dla assessmentów DRD” mimo że rekord JEST DRD — panel czyta inny backend (`/api/v8/assessment/:id`, 404) niż lista sesji (`/api/method/sessions`). Właściciel: macierz odpowiedzi jest ważnym narzędziem, nie tylko prezentacją. | DEFEKT | Ujednolicić źródło danych panelu Wnioski z rejestrem sesji. | DO ZLECENIA (wysoki priorytet) | — |
| `assessment-menu3-status-chips` | Chipy Menu 3 na „Bibliotece” to kategorie obszaru, zestaw statusowy (7 chipów) jest dopiero na „Procesach”. | STANDARD | Potwierdzić z właścicielem czy to zamierzone rozdzielenie (metodyki wg obszaru vs sesje wg statusu) albo ujednolicić. | DO ZLECENIA (potwierdzić zamiar) | TRIADA (Menu 3) |
| `assessment-reports-table`, `assessment-list`, `assessment-five-surfaces` + A12, `drd-library-entry` + A17 | Kolumny tabel Oceny nie pasują do zatwierdzonych wzorów: brak KONTEKST/JEDNOSTKA/WYNIK/PEWNOŚĆ, brak kolumny DZIAŁANIA z „Uruchom” w Bibliotece, `drd-library-entry` bez podglądu i z niewystarczającymi kolumnami. Właściciel: „tabela preview nie trzyma się opisanego standardu” / „nie ma żadnego podglądu”. | STANDARD | Dociągnąć kolumny wszystkich czterech tabel do zatwierdzonych wzorów; dodać podgląd i kolumnę DZIAŁANIA. | DO ZLECENIA | **TRIADA_KANON lista B (obowiązkowo)** |
| `assessment-initiatives-table` + A13 | Komponent `InitiativesTable.tsx` usunięty z kodu; zastąpiony inną, 10-kolumnową tabelą. Właściciel chce zwykłą tabelę inicjatyw pełnej szerokości, nie „raport w raporcie” — powiązane z A19 w module Inicjatywy („powinniśmy mieć jedną tabelę inicjatyw”). | DEFEKT/DECYZJA | Potwierdzić zakres: przeprojektować na zwykłą tabelę inicjatyw, spójną z resztą aplikacji (cross-ref moduł 06). | DO ZLECENIA (decyzja zakresu, temat przekrojowy) | TRIADA |
| `siri-workspace` | Otwiera stronę powitalną „V8 SHARED WORKBENCH” zamiast warsztatu pytań z drzewem wymiarów. | DEFEKT/FLAGA | Sprawdzić dedykowany komponent SIRI i podłączyć — właściciel ma niską pewność oceny („nie znam SIRI”), dopytać przed pracą. | DO ZLECENIA (dopytać zakres) | — |
| Językowe: macierz w raporcie miała etykiety osi/poziomów po angielsku (naprawione razem z pkt. 1); wybrany poziom w macierzy obwiedziony czerwienią mimo braku znaczenia krytycznego | — | STANDARD (crimson tylko dla krytycznych) | Zamienić obwódkę na neutralny akcent. | DO ZLECENIA | TRIADA_KANON pkt 3 |

---

## 06. Inicjatywy (5 ekranów: 2 zgodne / 0 różni się / 3 nie dotarłem) — w większości już naprawione dziś

**Co właściciel zobaczy po naprawach**: karta inicjatywy ładuje się z realnych rekordów (status
„W realizacji”, 24 sekcje), EV football-field otwiera się z realnej wyceny. Zostaje pytanie o
jedną wspólną tabelę inicjatyw w całej aplikacji.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `karta-initiative`, `initiative-record` (+ `exe-002-004-ui-audit` w module 07, ten sam błąd) | WSZYSTKIE realne rekordy listy Inicjatyw wskazywały ID z puli `demo-story-*`, których backend stagingu nie znał → 404 na 3 endpointach, „Nie udało się załadować karty inicjatywy”. Sprawdzone na 2 różnych rekordach — błąd systemowy. | DEFEKT | Karta ładuje się dziś z rejestru `runtime-v1` (`initiativeDocumentSource.ts`), gdy v8/legacy zwracają 404; dowód mutacyjny w testach. Zrzut PO: `evidence/inicjatywy-karta-20260905/03-karta-realny-rekord.png`. Otwarte: sekcje treści (Opis rozwiązania, Koszt bezczynności…) puste — to brak DANYCH w rejestrze, nie karty. | **ZROBIONE** SHA `51337e3f65`,`3ca9fe2aa1`,`783151ddd9`,`e67e7565be` (merge `ada375745d`) | consultify-artefakty (Rekord) |
| `ev-football-field` | Flaga `ff.finance_value_panels` domyślnie WYŁĄCZONA mimo `VITE_FINANCE_VALUE_PANELS=true` w `.env.local` (rozjazd config/runtime); po wymuszeniu — surowa galeria 20 paneli deweloperskich zamiast zatwierdzonego obrazu. | FLAGA + DEFEKT | EV football-field osiągalny dziś z realnego rekordu wyceny (archiwum), pasek „Dane z archiwum wyceny”. Zrzut PO: `evidence/inicjatywy-karta-20260905/05-ev-football-field.png`. Otwarte: `NOT_MIGRATED` to stan CAŁEJ rodziny 15 wycen (backfill kanoniczny Finance) — osobna gałąź `agent/finance-bridge-gate-20260905` (patrz moduł 09). | **ZROBIONE** (obejście) SHA `783151ddd9` — **backfill osobno, W TOKU** | — |
| A18 `capacity-advisor-a3` | Właściciel: chce tabelę z przyciskiem „Tworzy raport” w doradcy obciążenia zespołu. | DECYZJA | Funkcja nie istnieje w kodzie — objęta DEC-2026-09-03-355 („Tworzy raport” w doradcy obciążenia — nowa funkcja). | **FALA 2** (DEC-355) | — |
| A19 `initiative-record` | Właściciel: „czemu to jest inna tabela inicjatyw — powinniśmy mieć jedną”. | STANDARD | Ujednolicić na jedną wspólną tabelę inicjatyw w całej aplikacji (cross-ref moduł 05, `assessment-initiatives-table`). | DO ZLECENIA (temat przekrojowy, potencjalnie duży) | TRIADA |
| A20 `karta-initiative` | Brak przycisku AI w górnym pasku do wypełnienia karty. | DEFEKT/brak funkcji | Dodać przycisk AI wypełniający kartę — właściciel zapowiada dalsze przeglądy teraz, gdy karta ma dane. | DO ZLECENIA | SPEC-A Rekord |

---

## 07. Realizacja (8 ekranów: 2 zgodne / 3 różni się / 3 nie dotarłem)

**Co właściciel zobaczy po naprawach**: zakładki Praca i Zasoby przestają wisieć na pustym
ekranie; kolumna Trend w Rollout dostaje realne dane; „trzeci raz ta sama karta do akceptacji”
(A21) to ten sam mechanizm co w Inicjatywach — już naprawiony, tylko dla tego konkretnego
rekordu z obrazu brakuje danych.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `execution-tab-work` | Utyka trwale na „Loading canonical work” (liczniki 0), mimo że WSZYSTKIE zapytania sieciowe zwracają 200 z danymi — błąd w warstwie stanu UI, nie w API. | DEFEKT | Naprawić przejście stanu LOADING→READY mimo poprawnie pobranych danych. | DO ZLECENIA (wysoki priorytet — cała zakładka niedostępna) | — |
| `execution-tab-resources` + A47 (decyzja: poprawka) | Poniżej filtrów pusty biały ekran — tabela i panel podglądu w ogóle się nie renderują. Właściciel: karta podglądu ma być tak wysoka jak tabela, tabela bliżej trasy. | DEFEKT | Naprawić montowanie tabeli/panelu Zasobów; dostosować wysokości wg uwagi właściciela. | DO ZLECENIA | preview 6 bloków |
| `execution-tab-rollout` | Kolumna Trend pokazuje wszędzie „No history yet” (po angielsku) zamiast sparkline z obrazu. | DEFEKT + i18n | Sprawdzić czy to brak danych historycznych (DANE) czy błąd renderowania przy istniejących danych (DEFEKT); przetłumaczyć placeholder niezależnie od wyniku. | DO ZLECENIA | — |
| `execution-tab-summary` (+ `exec-summary-onelook`, moduł 02) | Flaga `summaryOneLook` jest ON, ale deep-link `?tab=summary` przekierowuje na listę — whitelist parametru `tab` w `ExecutionHub.tsx` nie zawiera „summary”, brak przycisku w UI. | DEFEKT | Jedna naprawa (dodać zakładkę „Kokpit” + wpisać `'summary'` na whitelistę) zamyka oba ekrany. | DO ZLECENIA | TRIADA (Menu 1) |
| `execution-report-day11` | Cała powierzchnia (`execReportsIntelligence`) świadomie domyślnie OFF wszędzie („Rule #7 — do akceptu Piotra”). | FLAGA | Zgodne z oczekiwaniem — czeka na akcept właściciela, nie nowa usterka. | FLAGA (czeka na akcept) | TRIADA lista B |
| `exe-002-004-ui-audit` + A21 | Rekord z obrazu („Margin Leakage Recovery Sprint”) nie istnieje w danych środowiska — ten sam systemowy błąd 404 co w module 06 (demo-story ID). Właściciel: „trzeci raz dajesz mi tę kartę do akceptacji”. | DEFEKT (naprawiony) + DANE (konkretny rekord) | Mechanizm ładowania kart już naprawiony (moduł 06). Pokazać właścicielowi INNY realny rekord z danymi (np. „Pełna identyfikowalność partii”) zamiast nieistniejącego z obrazu. | **ZROBIONE** (mechanizm) — **DANE** (ten konkretny rekord) | — |

---

## 08. Wyniki (22 ekrany: 9 zgodne / 2 różni się [obie POZYTYWNE] / 8 nie dotarłem)

**Co właściciel zobaczy po naprawach**: dwie uwagi już naprawione i potwierdzone (przycisk „Nowy
OKR” na górze, program OKR włączony z danymi) — potrzebują tylko nowych zrzutów do formalnej
re-akceptacji. Temat „format N-karty” dla ROI/OKR wymaga decyzji zakresu (czy to część dużego
DEC-381, czy osobna, mniejsza praca).

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `results-vnext-okr-registry` + A24 | Właściciel zgłosił brak przycisku „Nowy OKR” pod zatwierdzonym obrazem — w realnej aplikacji przycisk już jest na górze, „Programy”/„Cykle” zjechały do drugiego rzędu. | STANDARD (naprawione) | Naprawiona uwaga — potrzebny nowy zrzut referencyjny do formalnej re-akceptacji. | **ZROBIONE** (potwierdzone w odbiorze 05.09) | — |
| `results-vnext-okr-admin` | Obraz dokumentował uczciwy stan wyłączenia; dziś funkcja WŁĄCZONA z realnymi danymi (tabela, program „Rezultaty transformacji 2026”). | FLAGA (włączona) | Pozytywna zmiana — potrzebny nowy zrzut referencyjny. | **ZROBIONE** (włączone) | — |
| Prototypy dev-render: `cel-jedna-karta`, `wskaznik-jedna-karta`, `roi-jedna-karta`, `results-zestawienia` | Istnieją WYŁĄCZNIE w harnessie — brak odpowiednika w produkcie, zgodnie z zasadą #7 (Piotr nie jest pierwszym testerem). | DECYZJA | Pokazać jako propozycję do wstępnego OK (patrz `ODBIOR_SERYJNY_20260905.md` kat. d) — brak naprawy dziś. | **FALA 2 / DO DECYZJI** | — |
| `results-vnext-legacy-archive` | Zakładka „Archiwum” nie pojawia się domyślnie — flaga `resultsLegacyArchive` „Default OFF everywhere”; po wymuszeniu działa poprawnie. | FLAGA | Świadomie OFF, nieodebrane — czeka na akcept właściciela. | **FALA 2** | TRIADA lista B (przed pokazaniem) |
| `results-vnext-kpi-scorecards` | „Wołacz bez wywołania”: stan `tab==='scorecards'` ustawialny wyłącznie przez prop, którego żaden route nie przekazuje; zero `onClick` w kodzie. | DEFEKT | Podłączyć nawigację do zakładki „Karty wyników” (przycisk/link + trasa listy, nie tylko trasa pojedynczej karty po ID). | DO ZLECENIA | — |
| `results-vnext-roi-model`, `results-vnext-roi-full-tool` | Rejestr spraw ROI całkowicie pusty (0 spraw) — oba ekrany POZIOM 3 niedostępne bez tworzenia rekordu. | DANE | Brak naprawy kodu — potrzebny 1 realny rekord ROI. | DANE | — |
| A26/A27 (`results-vnext-roi-full-tool`, `results-vnext-roi-model`), A28 (`results-vnext-roi-pir-outcomes`), A25 (`results-vnext-okr-workspace`) | Właściciel: ROI/OKR powinny mieć „formułę N-karty” zamiast układu z menu poziomym — duży temat przeprojektowania. | STANDARD/DECYZJA | Prawdopodobnie pokrywa się z DEC-2026-09-03-381 (jeden wspólny standard kart dla 7 typów obiektów = DUŻE, fala 2). **Do rozstrzygnięcia z właścicielem**: czy to fala 2 razem z DEC-381, czy osobny mniejszy zakres tylko dla Wyników. | **DO DECYZJI WŁAŚCICIELA** przed zleceniem | — |
| A23 `results-vnext-attention` | Ekran był ZGODNY w odbiorze, ale właściciel: „tu są tylko dwa przyciski w menu 2” — Menu 2 ubogie względem reszty modułu. | STANDARD | Dopytać właściciela, jakich dodatkowych przycisków/trybów oczekuje. | DO ZLECENIA (dopytać zakres) | TRIADA (Menu 2) |
| A29 `results-vnext-teresa-kpi-deviation`, A30 `results-vnext-teresa-okr-reflection` | Oba ZGODNE technicznie z obrazem, ale właściciel odrzuca sam wygląd referencji: „stara grafika”, „niespójne z naszą formą UI/UX”. | STANDARD | Nowy prototyp zgodny z aktualnym kanonem → wstępny OK właściciela (zasada #7) → dopiero budowa. | DO ZLECENIA (prototyp → akcept → budowa) | consultify-artefakty |
| `results-three-pairs` / A22 + A48 (decyzja: nie) | Właściciel: „to jest jakiś historyczny ekran, mam nadzieję że już tak nie wygląda” — decyzja „nie” w backlogu. | DECYZJA | Zamknięte decyzją właściciela — nie naprawiać; potwierdzić, że ekran nie jest już używany w produkcie. | **ZAMKNIĘTE** (decyzja „nie”) | — |
| `results-vnext-search-registry` (korpus) | Właściciel: „układ menu i tabele są ok, ale wiele nie ma do akceptacji” (dane niepełne). | DANE | Brak akcji kodowej. | DANE | — |

---

## 09. Finanse (13 ekranów: 2 zgodne / 5 różni się / 6 nie dotarłem) — drugi najgorszy moduł, jedna wspólna przyczyna

**Co właściciel zobaczy po naprawach**: gdy bramka `FinanceLegacyBridgeGate` przestanie zwracać
„unresolved” dla realnych rekordów, cały pakiet Finance v3 (5 warsztatów + 5 mini-narzędzi)
zacznie się renderować zamiast starszego widoku zastępczego. To już zaczęte („Finanse bramka” w
toku).

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| Rodzina bramki ID_BRIDGE (11/13 ekranów): `finance-comments-panel`, `finance-lineage-navigator`, `finance-saved-views-panel`, `finance-export-import-panel`, `finance-compare-panel`, `finance-workspace-bar` (NIE_DOTARLEM) + `finance-analysis-workspace`, `finance-statement-pack-workspace-v2`, `finance-prediction-workspace`, `finance-valuation-workspace`, `finance-baseline-workspace` (ROZNI_SIE) | `FinanceLegacyBridgeGate` zwraca „unresolved” dla WSZYSTKICH realnych rekordów stagingu (0 z ~63 sprawdzonych) — kanoniczny Finance v3 renderuje się TYLKO w dev-render z `?bridge=ok`. `FinanceWorkspaceBar` dodatkowo w ogóle nie jest wpięty do żadnego z 5 warsztatów, niezależnie od bramki. | DEFEKT | Backfill/alias ID_BRIDGE dla realnych rekordów Finance na stagingu (gałąź `agent/finance-bridge-gate-20260905` już dotyka tego obszaru); wpiąć `FinanceWorkspaceBar` do 5 warsztatów. | **W TOKU** (agent równoległy) | SPEC-A Canvas/Matryca (po naprawie bramki) |
| `finance-valuation-workspace` + A32 | Najgorszy z rodziny: pusty stan + toast „Legacy valuation is not mapped” (409). Właściciel: merytorycznie ok, ale przyciski nagłówka są słowami, nie okrągłymi ikonami — poprawić grafikę. | DEFEKT + STANDARD | Po odblokowaniu bramki: zamienić przyciski nagłówka na pigułki/ikony wg kanonu. | W TOKU (bramka) + DO ZLECENIA (grafika) | TRIADA_KANON |
| `finance-baseline-workspace` + A31/A49 (decyzja: poprawka, zdublowane) | Właściciel: „dalej nie mam przycisku dodawania założeń i możliwości usuwania linii”. | DEFEKT | Po odblokowaniu bramki dodać przyciski „+Dodaj założenie” / „Usuń linię” w tabeli prognozy. | W TOKU (bramka) + DO ZLECENIA (funkcja) | — |
| `finance-hub`, `finance-model-workspace` | ZGODNE — ich zatwierdzony obraz to właśnie ten sam widok klasyczny, który dziś się renderuje. | — | Brak akcji. | — | — |

---

## 10. Materiały (36 ekranów: 23 zgodne / 8 różni się / 5 nie dotarłem)

**Co właściciel zobaczy po naprawach**: menu „Plik” w Document Studio (dziś niewidoczne/przycięte)
odblokowuje „Zrób z tego wzorzec”; biblioteka wzorców przestaje blokować dostęp 403 do własnych,
zatwierdzonych wzorców; dwa ekrany błędów już wyśrodkowane i ładniejsze zgodnie z życzeniem.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `document-studio-menu-pliku` + `document-studio-save-as-template` | Menu „Plik” jest kompletne w DOM, ale niewidoczne/nieklikalne — dropdown przycięty przez `overflow:auto` przodka w pasku nagłówka. | DEFEKT | Naprawić overflow/z-index kontenera nagłówka, żeby menu „Plik” (w tym „Zrób z tego wzorzec”) było widoczne i klikalne. | DO ZLECENIA (wysoki priorytet) | — |
| `report-builder-library-template` | „Użyj wzorca” kończy się 403 „Nie masz dostępu” — zarówno dla wzorca systemowego, jak i własnego, ZATWIERDZONEGO wzorca organizacji. | DEFEKT | Naprawić kontrolę dostępu do wzorców raportów. | DO ZLECENIA (wysoki priorytet — funkcja całkowicie zablokowana) | — |
| `document-studio-resume-error` + A34, `document-studio-template-resolve-error` + A35 | Komunikat już wyśrodkowany z ikoną (realizacja życzenia „napisz to ładniej”). Drugi ma dodatkowy defekt: blokada działa TYLKO z parametrem `entry=template`, przy samym nieistniejącym `templateArtifactId` nie działa wcale. | STANDARD (zrobione) + DEFEKT | Zrzut do potwierdzenia; naprawić warunek blokady żeby działał niezależnie od `entry`. | **CZĘŚCIOWO ZROBIONE** (wygląd) + DO ZLECENIA (warunek) | — |
| `sheet-artifact` (POZYTYWNA) + A38 | Pasek formatowania ma dziś ikony ($ % B) zamiast słów — realizacja prośby właściciela z sąsiedniego ekranu. Właściciel dodatkowo chce mini-menu funkcji na samej górze przy starcie arkusza. | STANDARD (zrobione częściowo) | Potwierdzić zrzutem; przenieść pasek funkcji na sam start (cross-ref A36). | **CZĘŚCIOWO ZROBIONE** + DO ZLECENIA | — |
| `excele-prawy-panel-standard`, `excele-edytowalna-siatka` + A37 | Referencje z 30.08 przeterminowane (pokazują nieistniejący już warsztat) i są parami duplikatów. Realny panel to już kanoniczny akordeon. Właściciel chce dalej ograniczyć panel, żeby tabela zajęła całą szerokość. | PRZYRZĄD (referencje) + STANDARD | Podmienić referencje na aktualne (01.09 PO); ocenić dalsze cięcie panelu wg A37 (dopytać szczegóły — zdanie urwane w źródle). | DO ZLECENIA | TRIADA lista B |
| A36 `excele-jeden-widok-recent` | Właściciel: przy otwieraniu arkusza powinno najpierw pytać o szablon, nie pokazywać obecny widok. | STANDARD | Przeprojektować start arkusza na wybór „z szablonu / pusty”. | DO ZLECENIA | — |
| `report-artifact` | Treść uczciwa i po polsku, ale renderuje się w edytorze Document Studio, nie jako gotowa karta raportu (pigułka statusu, pasek KPI, tabela RAG, benchmark). | DANE | Takiego dokumentu z pełnymi danymi jak na obrazie nie ma u właściciela — retest z pełnym rekordem potrzebny, żeby ocenić czy komponent karty w ogóle istnieje. | DANE | — |
| `document-studio-ai-teresa` | Flaga `ff_zai_teresa` domyślnie OFF mimo `VITE_ZAI_TERESA_ENABLED=true` w `.env.local` (rozjazd config/runtime); po wymuszeniu — inny komponent niż obraz (pole „JAKI DOKUMENT MAM NAPISAĆ” zamiast czatu Teresy). | FLAGA + DEFEKT | Włączyć flagę na stagingu (jak pozostałe 30 z DEC-227/394); zweryfikować/dobudować właściwy komponent czatu Teresy. | DO ZLECENIA | — |
| `document-studio-blocks-i18n` | Referencja to wyłącznie dev-render trzech komponentów w stanie pustym — w aplikacji taki ekran nie istnieje. | DECYZJA | Brak akcji dziś — kategoria prototyp/brak w aplikacji. | **FALA 2** | — |
| A33 `deck-artifact` | Układ super wg właściciela, ale prawy panel „do przepracowania” — brak widocznej edycji/narzędzi. | DEFEKT/brak funkcji | Dodać narzędzia edycji do prawego panelu artefaktu Deck. | DO ZLECENIA | SPEC-A archetyp E (Deck) |
| A39 `word-intake-uselm-default` | Drobne poprawki graficzne przycisków wg standardu — sam właściciel: „nie super ważne”. | STANDARD | Dociągnąć przy okazji innych prac nad Word studio. | DO ZLECENIA (niski priorytet) | — |
| Poboczne: martwy przewód „Edytuj” w Bibliotece wzorców (`editWorkbookTemplateId` nieczytany nigdzie), zerowe liczniki statusu w zakładce Dokumenty mimo że każdy wiersz ma status „Szkic”, pierwszy dokument z listy → 404, język PL/EN losowy między wczytaniami | Nie są osobnymi ekranami odbioru. | DEFEKT | Do zlecenia zbiorczo. | DO ZLECENIA | — |
| `document-studio-streaming-honesty-n3`, `b2-template-gallery` | Wymaga uruchomienia generacji AI (zakaz) / sesja wygasła w trakcie. | NIEZMIERZONE | Ponowić próbę. | NIEZMIERZONE | — |

---

## 11. Audyty (4 ekrany: 0 zgodne / 2 różni się / 2 nie dotarłem) — cały moduł pusty w danych

**Co właściciel zobaczy po naprawach**: bez zmiany kodu — skorupa (paski, chipy, kolumny, stany
puste) jest już zgodna z kanonem. Moduł czeka na pierwszy realny cykl audytu (pakiet → sesja →
raport), żeby cokolwiek ocenić naprawdę.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `audyty-piec-powierzchni` | Tabela pusta „Brak pakietów audytowych”, wszystkie liczniki 0. | DANE | Brak akcji kodowej — zaseedować 1 pakiet audytowy do pełnego retestu. | DANE | — |
| `audyty-drd-report` | Trasa raportu za flagą domyślnie OFF; po włączeniu raport pusty z przyciskiem „Wygeneruj pełny raport”. | FLAGA + DANE | Pokazać do akceptu flagę; wygenerować raport testowy po zaseedowaniu danych. | DO ZLECENIA (pokazać flagę) | TRIADA lista B |
| `audyty-warsztat-kryterium`, `audyty-raport-dokument` | Zero audytów/sesji/raportów w danych właściciela. | DANE | Brak akcji kodowej. | DANE | — |

---

## 12. Spotkania (3 ekrany: 3 zgodne / 0 różni się / 0 nie dotarłem)

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `calendar-sync-settings` + A40 | ZGODNY na żywo (3 dostawcy: Google/Outlook/Apple Calendar) — Outlook, o którego prosił właściciel, już JEST. Referencja „PRZED” w pakiecie była uszkodzona (strona nieistniejącej listy tras deweloperskich); do porównania użyto obrazu „PO”. Zostaje: ikona Apple to wciąż „jabłko” zamiast neutralnej ikony. | PRZYRZĄD (referencja) + DEFEKT (ikona) | Podmienić uszkodzoną referencję PRZED (patrz `ODBIOR_SERYJNY_20260905.md` kat. a); zamienić ikonę Apple Calendar na neutralną. | **CZĘŚCIOWO ZROBIONE** (Outlook już jest) + DO ZLECENIA (ikona) | — |

---

## 13. Organizacja (21/22 ekrany: 0 zgodne / 21 różni się / 0 nie dotarłem) — właściwie już domknięte dziś

**Co właściciel zobaczy po naprawach**: to, co widzi już dziś — nową, skonsolidowaną powłokę
Organizacji (21 starych ekranów → 11 nowych), zaakceptowaną wprost jako WZORZEC 05.09 (DEC-395).
Cztery konkretne błędy zgłoszone w odbiorze są już naprawione. Potrzebne są tylko nowe zrzuty
referencyjne (patrz `ODBIOR_SERYJNY_20260905.md` kat. b) — to nie defekt, to przestarzałe zdjęcia.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| 17 z 21 ekranów (cała mapa konsolidacji w `evidence/odbior-zywo-20260905/14-organizacja/RAPORT.md`) | Różnica = wyłącznie nowa powłoka `OrganizationScreenShell` (flaga `orgRedesignV1` domyślnie ON od 03.09, DEC-2026-08-26-78/A3) zamiast starej struktury z obrazów. | DECYZJA | Brak — redesign zaakceptowany jako WZORZEC (DEC-2026-09-05-395: „Organizacja=redesign jako wzorzec”). Potrzebne tylko 11 nowych zrzutów referencyjnych. | **ZAMKNIĘTE DECYZJĄ** (nowe zrzuty do zrobienia) | — |
| `org-operating-model` | Martwa zakładka „Model dostawy” — pigułka podświetlała się, ale treść nigdy się nie renderowała dla organizacji bez ustawionego typu. | DEFEKT (potwierdzony) | Pigułka chowa się dynamicznie zależnie od typu organizacji (tak jak stary ekran chował całą pozycję menu). | **ZROBIONE** SHA `0fa43c4b72` | — |
| `org-stakeholder-expectations` | Treść „zgubiona” — trzy grupy pigułek (Archetyp transformacji/Rola AI/Rytm nadzoru) renderowały się bez ŻADNEGO widocznego tytułu (`OrgChoiceSegment` używał `label` tylko jako `aria-label`). Dane były na miejscu cały czas. | DEFEKT (potwierdzony, inna przyczyna niż zgłoszona) | `OrgChoiceSegment` renderuje teraz widoczny podpis nad grupą pigułek (3 miejsca użycia naprawione naraz). | **ZROBIONE** SHA `c628c7e403` | — |
| `org-technology-culture-constraints` | Zgłoszenie: „uboższa treść” (brak selektora „Obecne systemy”). Po analizie: audytor porównał zakładkę z INNYM ekranem („Model działania”) — kod jest poprawny, pola identyczne ze starym ekranem. | ODRZUCONE (fałszywy alarm) | Brak zmiany kodu — dodano test regresyjny broniący granicy (4 pola „Technologia”, bez „Obecne systemy”). | **ZAMKNIĘTE** (obronione testem) SHA `6046d2e7f6` | — |
| `org-summary` | Sekcja „Co blokuje i kogo zatrzymuje” pokazywała surowy `JSON.stringify()` wartości twierdzenia wprost jako tekst. | DEFEKT (potwierdzony) | Nowe `summarizeClaimValue()`/`claimValueKey()` — nigdy nie zwraca JSON-u, obiekt pokazuje czytelny tytuł/nazwę/etykietę. Dowód mutacyjny wykonany i cofnięty. | **ZROBIONE** SHA `97cd77a4e6`,`68fb43dcd8` | — |
| `org-knowledge-graph` (chip „risk” nieprzetłumaczony), `org-scenarios` (angielskie nazwy scenariuszy) | Dwa drobiazgi świadomie pominięte w dzisiejszym zleceniu (poza zakresem 4 zgłoszonych defektów). | i18n (drobne) | Przetłumaczyć chip typu encji „risk”; potwierdzić czy angielskie nazwy scenariuszy to świadomy żargon (jak w Finansach). | DO ZLECENIA (niski priorytet) | — |

---

## 14. Panel administratora / Administracja (41 ekranów: 26 zgodne / 12 różni się / 3 nie dotarłem)

**Co właściciel zobaczy po naprawach**: 8 tras, które zwracały 500 zwykłemu użytkownikowi, dziś
zwracają 200/404; rola SuperAdmin nadana na koncie właściciela na stagingu — 3 zablokowane ekrany
czekają tylko na retest. Osiem tabel z pustym stanem to kwestia danych testowych, nie kodu.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| A52 — 8 tras z HTTP 500 | Dla zwykłego użytkownika, 3 z surowym SQL w odpowiedzi (service-accounts, knowledge-graph duplicates, report-builder upload_bundle, billing webhook ×2, report-builder definitions, table-platform admin ×2). | DEFEKT | 8 tras 500→200/404; `/admin/*` dostało bramkę roli (nie miało ŻADNEJ); deployed env nigdy nie oddaje stosu/surowego SQL; naprawiony wyciek stosu systemowo w `ErrorHandler`; naprawione kolumny tenanta w `billing webhook-events` i tenant bez UUID na trasach kolumn typu uuid. | **ZROBIONE** (merge `d10930ae74`; SHA `dbb2399016`,`51b54847d7`,`b0ea1abce4`,`36366575bb` i in.) | — |
| `superadmin-platform-operations-day15`, `partner-settlements-view`, `model-catalog-table` | Konto właściciela (Owner DBR77) nie miało roli SuperAdmin — `/superadmin/*` przekierowywał na `/chat`. | ROLA | Rola SuperAdmin nadana na stagingu 05.09 ~08:20 (DEC-395, `FORCE_SUPERADMIN_EMAILS`). | **ZROBIONE** (rola) — **retest tych 3 ekranów potrzebny** | — |
| Rodzina „pusty stan” (8 ekranów): `admin-team-invitations`, `admin-team-roles-permissions`, `admin-team-teams`, `admin-team-guests-external`, `admin-security-sessions`, `admin-security-domains`, `admin-security-service-accounts`, `admin-security-break-glass` | Układ, nagłówki i treść opisowa ZGODNE; tabela pokazuje dobrze zaprojektowany pusty stan zamiast 2–5 przykładowych wierszy z obrazu. | DANE | Organizacja testowa nie ma zaseedowanych rekordów w tych tabelach — brak akcji kodowej. | DANE | — |
| `admin-ai-personas` | Czerwony baner „Failed to fetch system prompts” blokuje wczytanie listy 3 person. | DEFEKT | Naprawić endpoint/wywołanie pobierające system prompts. | DO ZLECENIA | — |
| `admin-billing-seats-licences` + A41 (`admin-command-attention-queue`) | Podsumowanie liczbowo sprzeczne: „Łącznie: 0” przy „Zajęte: 8”, „Wykorzystanie: 0%” (matematycznie niemożliwe). Właściciel osobno: kolejka uwagi „to nie jest szerokość strony”. | DEFEKT | Naprawić kalkulację salda miejsc (Łącznie/Wykorzystanie); naprawić szerokość strony Kolejki uwagi. | DO ZLECENIA | — |
| `admin-health-dependencies`, `admin-health-incident-history` | Podtytuł i breadcrumb „Health” trwale po angielsku mimo że reszta interfejsu jest po polsku. | i18n DEFEKT | Przetłumaczyć stały element „Health” w całej rodzinie ekranów. | DO ZLECENIA | — |
| Pozytywne, potwierdzone: `admin-audit-legal-hold` (tytuł już w pełni PL), `admin-command-attention-queue` kolumna „Źródło” (już czytelne nazwy zamiast surowych adresów API) | Znane wyjątki z wcześniejszych fal wyglądają naprawione. | — | Brak akcji — potwierdzić nowym zrzutem. | **ZROBIONE** (wcześniej, potwierdzone dziś) | — |
| „Ryzyka wymagające przeglądu zawsze 0” w `admin-command-attention-queue` | Znany błąd z fali 174 NADAL WYSTĘPUJE (potwierdzone, nienaprawione). | DEFEKT | Naprawić liczenie ryzyk wymagających przeglądu. | DO ZLECENIA | — |

---

## 15. Ustawienia (8/11 ekranów: 5 zgodne / 2 różni się / 1 nie dotarłem)

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `ustawienia-integracje` — **najważniejsze znalezisko sesji** | 8/8 niezależnych prób nie pokazało realnej treści „Połączone aplikacje”: 3× wylądowano na `/admin/integrations` z zupełnie innym ekranem, 3× na `/admin/security/security-policy`, 2× pusta biała strona pod poprawnym URL. Niedeterministyczne przy identycznym koncie i trasie. | DEFEKT | Zbadać i naprawić prawdopodobny wyścig (race condition) w `RouterSync.tsx`/`AdminSettingsModule`/logice przekierowań. | DO ZLECENIA (**wysoki priorytet** — zgłoszenie inżynierskie) | — |
| `ustawienia-powiadomienia` | Wygląd 1:1 zgodny, ale 1 błąd konsoli 501 (Not Implemented) w tle. | DEFEKT (drobny) | Dograć/naprawić endpoint zwracający 501. | DO ZLECENIA (niski priorytet) | — |
| `ustawienia-zaawansowane` | Brakuje pozycji „Funkcje beta” (Beta) w sidebarze obecnej na obrazie. | DEFEKT/FLAGA | Dodać pozycję „Beta” do sidebaru Ustawień zaawansowanych. | DO ZLECENIA | — |
| A54 — język konta | Konto właściciela było w `en`, produkt jest polski. | DECYZJA | Ustawienia → Język → Polski, zapis w koncie. | **ZROBIONE** 05.09 06:58 (Fable) | — |

---

## 16. Partner / Portal partnerski (poza dzisiejszym pełnym przelotem)

**Stan ogólny**: moduł NIE był częścią pakietu `odbior-zywo-20260905` (259 ekranów objęło pozostałe
15 modułów + aneks) — 12 ekranów Portalu zostało przyjętych na MVP już 02.09 w rozmowie z
właścicielem, warunkowo.

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| 12 ekranów Portalu (Pulpit, Moje linki i kody, Zarobki, Kampanie, Klienci, Dokumentacja i in.) | Przyjęte na MVP 02.09 z JEDNYM warunkiem: usunąć czerwone tła. Właściciel: „Poza tym czerwonym tłem w jasnym tle to nie mam jakoś wiele uwag.” | STANDARD (crimson) | Poprawka kolorów już zrobiona (`evidence/grafika/16-partner-kolory/`) — **czeka na potwierdzenie właściciela na żywym stagingu**, nie było części dzisiejszego przelotu. | CZĘŚCIOWO ZROBIONE (poprawka gotowa) — **DO ZLECENIA: krótki przelot potwierdzający** | TRIADA lista B |
| `partner-settlements-view` | Jedyny ekran Partnera dotknięty dzisiejszym przelotem (zaszyty pod `/superadmin/*`) — NIE_DOTARLEM z braku roli SuperAdmin. | ROLA | Rola nadana 05.09 (patrz moduł 14). | **ZROBIONE** (rola) — retest potrzebny | — |
| 6 drobnych znalezisk backlogu spoza warunku 02.09: brak podglądu w wierszach, € obok PLN, angielskie napisy | — | STANDARD/i18n | Niski priorytet, nie blokują MVP. | DO ZLECENIA (niski priorytet) | — |

---

## Poza 16 modułów menu — dla kompletności (część pakietu 258, nie część menu głównego)

### Kanon i elementy wspólne (13 pozycji: 2 zgodne / 3 różni się / 6 nie dotarłem) + A42–A45

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `standard-kanban-card` | Brak stopki „NASTĘPNA BRAMKA” i cichych pigułek; nazwy kolumn po angielsku (To Do/In Progress/Blocked/Done). Korpus: właściciel „Super, wybierzmy ten standard jeden” (aprobata kierunku). | STANDARD + i18n | Dociągnąć kartę kanban do kanonu i przetłumaczyć nazwy kolumn. | DO ZLECENIA | TRIADA lista B |
| `standard-grid-card` | Brak paska akcentu kategorii, paska postępu, kebaba; pigułki statusu po angielsku. | STANDARD + i18n | Jak wyżej. | DO ZLECENIA | TRIADA lista B |
| `mw-007-calendar-narrow-viewport` | Przełącznik widoku ma 3 pozycje zamiast 4 (brak „Lista”); lista źródeł 3 zamiast 4; brak crimsonowych kolorów kategorii. | DEFEKT/STANDARD | Dodać pozycję „Lista” i czwarte źródło; przywrócić kolory kategorii (uwaga: crimson tylko semantyka — sprawdzić zgodność z regułą #3). | DO ZLECENIA | TRIADA_KANON pkt 3 |
| Rodzina `prawy-pas-jedna-formula-*` (4: idea-teresa, idea-artefakt, notatka-teresa, notatka-artefakt) + A43, A44 | Prototyp — nie istnieje jeszcze w aplikacji. Właściciel: „nie rozumiem, dlaczego Teresa jest w oknie tego narzędzia, skoro jest osobna Teresa” (×2). | DECYZJA | Wątpliwość koncepcyjna właściciela — NIE budować bez wyjaśnienia koncepcji. | **DO WYJAŚNIENIA KONCEPCJI**, nie do budowy | — |
| A42 `prawy-panel-szyna-ikon` | Szyna ikon ZGODNA technicznie, ale właściciel: „nie wiem, czy to jest naprawdę jakaś poprawa”. | DECYZJA | Podobna wątpliwość — potwierdzić z właścicielem sens zmiany zanim rozszerzać wzorzec dalej. | DO POTWIERDZENIA | — |
| `standard-module-bar-children` | Obraz to galeria wariantów komponentu z harnessu — w aplikacji nie ma ekranu z 6 wariantami obok siebie (sam pakiet rekomenduje zdjęcie tej pozycji z odbioru ekran-po-ekranie). | PRZYRZĄD | Zdjąć z listy odbioru ekran-po-ekranie — to nie ekran produktu. | DO ZDJĘCIA Z LISTY | — |
| `rn-g3-class-l-record-shell` | Sesja automatu wygasła w trakcie — nieosiągnięty. | NIEZMIERZONE | Ponowić próbę po odnowieniu sesji. | NIEZMIERZONE | — |
| A45 `preview-4-zakladki` | Właściciel: pokazuje, jak nieporównywalne są podglądy, które powinny być takie same — potwierdza systemowy problem niespójności paneli podglądu (cross-ref moduł 02, `idea-table`). | STANDARD (systemowy) | Ujednolicić WSZYSTKIE panele podglądu wg `consultify-preview` (6 bloków) — duży temat przekrojowy. | DO ZLECENIA (temat przekrojowy) | preview 6 bloków |

### Internal Tools / AI OS (4 ekrany, poza głównym menu — konsola wewnętrzna dbr77.com)

| Ekran/uwaga | Co jest inaczej | Przyczyna | Naprawa | Stan | Kanon |
|---|---|---|---|---|---|
| `aios-memory`, `aios-connectors`, `aios-agents`, `aios-outcomes` | Układ/komponenty identyczne z obrazem; 3 z 4 pokazują baner „Not found” + błędy 404 i puste karty zamiast przykładowych danych — wygląda na wspólne brakujące źródło/zasób referencyjny dla tej organizacji. | DANE + DEFEKT | Zbadać wspólne źródło 404 (prawdopodobnie brakujący zasób referencyjny). Metodyczna uwaga: `canUseInternalTools()` zwraca `true` w trybie dev niezależnie od `VITE_INTERNAL_TOOLS_ENABLED` — do naprawy, żeby przyszłe audyty nie mylić bramki. | DO ZLECENIA (niski priorytet biznesowy, moduł wewnętrzny) | — |

### Agent (3 ekrany, zgodne — bez akcji pilnej)

Domyślny widok modułu to uboższa tabela (Sprawy/akceptacje), a bogata tabela z obrazu żyje w
trybie „Archiwum” — to zapisany, zgodny wyjątek. Klocki przesuwa się strzałkami, nie
drag&drop — zgłoszenie właściciela pozostaje niezrealizowane. Moduł Agent to szerszy temat „do
wypracowania merytorycznie” wg korpusu — **FALA 2**, brak pilnej akcji.

### Logowanie i ekrany przed zalogowaniem (5 ekranów, zgodne — bez akcji)

Akcept zbiorowy właściciela z 02.09 („wszystkie są ok”) potwierdzony ponownie 05.09. Jedna
higieniczna obserwacja bez akcji: `/reset-password` nie waliduje tokenu po stronie klienta (tylko
obecność parametru) — backend waliduje przy wysyłce, to NIE jest luka bezpieczeństwa.

---

## Podsumowanie liczbowe planu

| Kategoria | Liczba pozycji planu |
|---|---|
| ZROBIONE dziś (05.09, z SHA) | 17 |
| W TOKU (agent równoległy) | 4 |
| DO ZLECENIA | 62 |
| FALA 2 / DO DECYZJI właściciela | 16 |
| DANE (brak naprawy kodu) | 13 |
| NIEZMIERZONE / do ponowienia | 5 |
| ZAMKNIĘTE (decyzja „nie” / fałszywy alarm obroniony testem) | 3 |
| **Razem pozycji planu** | **120** |

Pozycje planu ≠ liczba ekranów — rodziny (np. 6 ekranów `idea-table-tool-*`, 11 ekranów bramki
Finance ID_BRIDGE, 17 ekranów powłoki Organizacji, 3 ekrany panelu „Zarządzanie” poza ekranem)
zostały scalone w jedną pozycję zgodnie z zasadą deduplikacji.
