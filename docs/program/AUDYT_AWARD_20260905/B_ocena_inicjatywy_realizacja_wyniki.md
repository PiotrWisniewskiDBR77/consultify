# Audyt „award-winning, CES 2027" — Ocena · Inicjatywy · Realizacja · Wyniki

Data: 2026-09-05. Środowisko: `http://127.0.0.1:3000` → backend/dane stagingu (kod linii m03,
HEAD `1deab43c18d0d6f4c2bc1b339c1a32f79164f427`). Sesja właściciela (auth state), motyw jasny,
szerokość 1440 (flagowe ekrany dodatkowo sprawdzone przy dłuższym oczekiwaniu na dane —
patrz uwaga o czasie ładowania w Realizacji). Metoda: własny skrypt Playwright
(`scripts/dev/tmp-audit-award-runner.mjs`, nie w repo — tymczasowy, do usunięcia), jeden
kontekst przeglądarki na moduł, klik-po-kliku po realnym DOM, przechwyt błędów konsoli,
odpowiedzi ≥400 i zapytań >5 s. Zero rekordów utworzono — wszystkie testy na istniejących
danych stagingu (żadnych zmian w `UTWORZONE_REKORDY.md` nie było potrzeba).

Skala: **A = Stabilność** (błędy konsoli, 4xx/5xx, martwe kontrolki, nieskończone ładowanie,
migotanie, utrata stanu), **B = Spójność grafiki** (skala typu, siatka 8px, tokeny `c-*`,
jeden kształt Menu 1/2/3/prawego panelu, puste stany, chipy, ikony, polski język bez
angielskich etykiet/surowych enumów/obciętego tekstu bez tooltipa, wyrównanie).
0 = nie działa/rażące złamanie kanonu, 1 = działa, ale wyraźne naruszenia, 2 = drobne
naruszenia, 3 = gotowe na scenę CES.

---

## 1. OCENA

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Biblioteka (lista metodyk) | 3 | 3 | Brak odchyleń — pełna triada, chipy z licznikami, kebab, StandardTable. `evidence/audyt-award-20260905/ocena/smoke-assessment.png` |
| DRD → Wywiad (pytania) | 3 | 3 | Czysty layout krok-po-kroku, dobre uzasadnienia „Dlaczego pytamy". `ocena-02-drd-open.png` |
| DRD → Macierz (widok wpisany w panel) | 3 | 2 | Komórki macierzy w wąskim widoku obcinają etykiety („E-comm erce..", "ML Model s") **bez tooltipa przy hover** — potwierdzone testem hover (`ocena-09-drd-raport-hover-trunc.png`: podświetlona komórka, zero dymka). |
| DRD → Macierz → Pełny ekran | 3 | 3 | Bardzo dobry ekran: pełne etykiety, `Esc, aby zamknąć`, `Wróć`, przełącznik AS-IS/TO-BE. **Kandydat na ekran flagowy.** `ocena-08-drd-macierz-fullscreen.png` |
| DRD → Raport (zakładka w workspace) | 2 | 2 | Przyciski „Generuj / Eksportuj PDF / Eksportuj wszystko" oznaczone „Planowane" (martwe na stałe, nie stub testowy). Między blokiem DETAILS a POWIĄZANIA wisi nieopisana fioletowa pigułka „Final" z ikoną kłódki — kolor fioletowy jest wariantem **wycofanym** kanonu (`TRIADA_KANON.md` pkt 32). `ocena-07-drd-raport-tab.png` |
| DRD → Ustawienia (panel zarządzania sesją) | 2 | 1 | Sam panel to 4 kolumny gołego tekstu bez kart/nagłówków (styl niespójny z resztą prawego panelu w aplikacji — porównaj z „AKCJE/WŁAŚCIWOŚCI" gdzie indziej). Przyciski „Wyślij do przeglądu / Odeślij do pracy" wyszarzone **bez podanego powodu** (przeciwieństwo dobrego wzorca z Wyniki/OKR, patrz niżej). `ocena-11-drd-ustawienia.png` |
| Wnioski (lista zamrożonych wersji) | 3 | 3 | Czysta StandardTable, chipy z „N · M ukryte". `ocena-04-wnioski.png` |
| Raporty (lista raportów modułu) | 1 | 1 | **CTA „Nowy raport" jest wizualnie ucięty/nachodzi na panel Teresy** przy 1440 px — 6 pigułek Menu 2 + 2 dodatkowe przyciski + filtr nie mieszczą się nad prawym panelem AI. Dowód przez przycięcie 950–1440 px: `ocena-05-raporty.png`, powiększenie `/tmp/crop-raporty-cta.png` (opisane w toku audytu). |
| Raporty → podgląd wiersza | 2 | 2 | Header/meta/DETAILS/POWIĄZANIA poprawne, ale ta sama nieopisana fioletowa pigułka „Final" jak wyżej; brak bloku AI. `ocena-10-raport-open.png` |
| Raport → „Otwórz" (pełny widok w Kreatorze raportów) | 0 | 2 | **Raport oznaczony w liście jako „Finalne" / 80% otwiera się jako CAŁKOWICIE PUSTY dokument** („Zacznij budować raport — Dodaj pierwszy blok"). `ocena-12-raport-full-otworz.png` |
| Raport → „Podgląd" | 0 | 2 | Potwierdza pustkę: „Podgląd raportu — **0 sekcji**", jedyna treść to stopka „Utworzono w Consultify". `ocena-13-raport-podglad.png` |

**Średnia Ocena: A = 2,0 · B = 2,2** (11 ekranów/przepływów).

**Ekran flagowy Ocena:** DRD → Macierz → Pełny ekran. Kompletny, czytelny, dobrze
wytłumaczony (skrót klawiszowy, przycisk powrotu, przełącznik AS-IS/TO-BE) i wygląda
gotowo na scenę. **Nie** rekomenduję pokazywania ścieżki Raport→Otwórz/Podgląd na żywo,
dopóki pustka nie zostanie naprawiona — to dokładnie ten defekt, którego boi się właściciel
(„nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu").

---

## 2. INICJATYWY

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Tabela (lista) | 2 | 1 | Nagłówek Menu 1 po angielsku „Initiatives" (reszta modułu polska); CTA „Nowa inicjatywy" zawija się na 2 linie i obcina słowo; kolumna „OCZEKIWANY EFEKT" ściska treść w 3 linie bez elipsy/tooltipa (nieczytelne, zob. `/tmp/crop-effect-col.png`); w Menu 3 wisi obcy przycisk „Adopt classic initiative" po angielsku. `inicjatywy-01-tabela.png` |
| Kanban | 2 | 1 | Wymaga ~4 s realnego ładowania danych, zanim faktycznie pokaże kolumny (wcześniej pusty szkielet tabeli — mylące). Nagłówki kolumn **CAŁKOWICIE po angielsku** (DRAFT/PENDING REVIEW/IN REVIEW/PROMOTED); karty priorytetu „HIGH" bez tłumaczenia; brak lewego paska akcentu ~3px wymaganego kanonem dla kart z priorytetem (pkt 34); „NASTĘPNA BRAMKA" (etykieta polska) ma surowe angielskie wartości „Pending Review"/„Promote to Initiatives"; pusta kolumna pisze „Drop initiatives here" po angielsku. `inicjatywy-02b-kanban-retry.png` |
| Siatka (grid) | 2 | 1 | Status karty w 100% po angielsku: Executing/Scheduled/In Review/Approved/Tracking/Draft; priorytet HIGH/MEDIUM też. `inicjatywy-03c-siatka-retry.png` |
| Oś czasu (Plan → widok osi) | 3 | 1 | Dobry, uczciwy pusty stan po polsku („15 z 15 inicjatyw... uzupełnij daty"). **Ale** legenda na dole miesza języki w JEDNYM wierszu: „Ready / In Progress / Blocked / Done" (ang.) obok „Ścieżka krytyczna (szacunek)" i „Dziś" (pol.). `inicjatywy-04b-timeline-retry.png` |
| Plan (tabela zależności) | 2 | 0 | Cały rząd chipów Menu 3 **wyłącznie po angielsku**: Unscheduled / Now / Next / Later / Conflicted / Missing dependencies / Needs capacity / Ready for schedule — jedyny taki przypadek w audycie, gdzie CAŁE Menu 3 ekranu nie ma ani jednego polskiego słowa, mimo że nagłówki tabeli pod spodem są poprawnie polskie. `inicjatywy-05-plan-tab.png` |
| Obciążenie | 2 | 0 | Ten sam wzorzec: Menu 3 w 100% angielski (All constraints/Critical/Unknown supply/Missing demand/Skill gaps/Management load/Budget envelope...); wartości typu „2/2/2 MONTH" (jednostka nieprzetłumaczona) w tabeli zresztą polskiej. `inicjatywy-06-obciazenie-tab.png` |
| Podgląd (single-click, StandardPreview) | 3 | 3 | Wzorcowy: nagłówek+pin+Otwórz+×, meta z rekomendacją, DETAILS z licznikiem słów, tabela właściwości, POWIĄZANIA. **Najlepszy ekran modułu.** `inicjatywy-07-karta-open.png` |
| Pełna karta (24 sekcje, „Otwórz") | 1 | 2 | Dla tego konkretnego rekordu demo **11 z 11 zapytań API zwraca 404** (`/api/v8/planning/initiatives/...`, `/kpis`, `/gate-readiness-check`, `/gate-roles`, `/suggested-changes`, załączniki) — bo identyfikator to slug demo (`demo-story-20260826-initiative-traceability`), nie realny UUID. Mimo to UI degraduje się **elegancko**: sekcje renderują dane z listy, a tryb Podglądu tłumaczy wprost „Liczba 0 opisuje ten widok, nie inicjatywę". Jednocześnie nagłówek pokazuje **sprzeczne** „Zapisywanie..." obok komunikatu, że tryb jest tylko do odczytu. `inicjatywy-09-karta-pelna.png` |
| Pełna karta po odświeżeniu (deep-link) | 0 | — | `/initiatives?mode=doc&open=<id>` wpisany bezpośrednio w pasek adresu **NIE przywraca** widoku dokumentu — cichy powrót do zwykłej listy, bez błędu i bez ostrzeżenia o utraconym stanie. `inicjatywy-09b-karta-pelna-wait.png` |
| Kreator Inicjatyw AI (krok 2, wizard) | 3 | 1 | Ładny 5-krokowy stepper, dobry komunikat ochronny „portfolio przeciążone — utwórz tylko 1-2". **Ale** chipy priorytetów biznesowych tracą polskie znaki: „Marza / EBITDA", „Jakosc", „Terminowosc" (powinno: Marża, Jakość, Terminowość) — to literalny, twardo wpisany tekst w kodzie, nie błąd kodowania w locie: `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx:604-606`. `inicjatywy-08-wizard.png`, powiększenie `/tmp/crop-diacritics.png`. |

**Średnia Inicjatywy: A = 2,0 · B = 1,1** (10 ekranów/przepływów) — najniższa spójność
graficzna z czterech modułów, głównie z powodu systemowego braku tłumaczeń w Menu 3
Plan/Obciążenie i widokach Kanban/Siatka.

**Ekran flagowy Inicjatywy:** panel podglądu (single-click) na liście tabelarycznej —
jedyny ekran modułu w 100% zgodny z kanonem TRIADA. Widok tabeli, Kanban, Siatka i
zakładki Plan/Obciążenie **nie nadają się** na scenę, dopóki angielskie etykiety nie
zostaną zdjęte.

---

## 3. REALIZACJA

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Kokpit menedżera | 3 | 3 | Bardzo dobry ekran zarządczy: 5 kafli KPI, „Co nam grozi"/„Co muszę rozstrzygnąć", uczciwy pusty stan („Brak ryzyk krytycznych — nic nie przekracza progu uwagi menedżera"). **Kandydat na ekran flagowy.** `realizacja-01-kokpit.png` |
| Realizacje (lista) | 2 | 1 | Kolumny STATUS i TERMIN systematycznie obcięte bez elipsy/tooltipa: „W reali...", „Zaplan...", „5.05.2...", „4.06.2..." — ten sam defekt co w Inicjatywach, wspólny komponent `src/components/shared/ModuleHub/FilterableTable.tsx` (domyślny `minWidth: 90` dla kolumn innych niż tytuł, linia 789; komentarz w pliku, linie 907-917, wprost przyznaje że `table-fixed` „niczego nie ratuje" przy nadmiarze). Zimny start ekranu ~6-8 s z angielskim „Loading..." zamiast polskiego stanu ładowania. `exec-wait8s.png` |
| Praca (tabela pracy) | 1 | 1 | **Ekran wisi ~15–20 s** na „Wczytuję kanoniczny rejestr pracy..." bez paska postępu, spinnera ani komunikatu — wygląda na zawieszony. Przyczyna jest UDOKUMENTOWANA w kodzie: jedna realizacja (`a3e05d4a-5397-…-acceptance-execution-case`) ma endpoint pracy, który nie odpowiada; mechanizm `fanOutExecutionCases` (`src/components/Execution/executionCaseFanOut.ts:26`, `EXECUTION_CASE_FANOUT_TIMEOUT_MS = 12_000`) ma to obsłużyć per-realizacja i pokazać честny baner „Niepełne dane". Zmierzony na żywo czas do rozwiązania (15,5–22 s) **przekracza** deklarowany limit 12 s i nie daje żadnej informacji zwrotnej w trakcie — więc mimo istniejącej naprawy w teście (`ExecutionSurfaces.hangingCase.test.tsx`) realne wrażenie użytkownika to „ekran zepsuty", nie „ekran się broni". `realizacja-03b-praca-wait.png` (15s, wciąż zawieszony) → `realizacja-03d-praca-22s.png` (w końcu 15 pozycji + baner „Niepełne dane: 1 realizacja bez odp..."). |
| Zasoby | 1 | 1 | Ten sam mechanizm i ten sam czas oczekiwania; degraduje się poprawnie do banera „Nie udało się pobrać zasobów z 1 realizacji — poniżej zasoby z pozostałych", ale przy pierwszych ~15 s ekran jest pusty bez żadnego komunikatu ładowania (gorzej niż Praca — tam przynajmniej jest tekst). Wartość „MONTH" (jednostka okresu) nieprzetłumaczona w kolumnie OKRES. `realizacja-04-zasoby.png` → `realizacja-04c-zasoby-22s.png` |
| Sterowanie | 2 | 2 | Działa poprawnie i szybko, ale dane właściciela/zatwierdzającego to surowe angielskie nazwy ról („Execution Manager", „Intervention Authority") zamiast polskich odpowiedników; tytuł interwencji też po angielsku. `realizacja-05-sterowanie.png` |
| Raporty | 3 | 3 | Bardzo dobry: podzakładki Raporty/Definicje, czysta tabela, brak naruszeń. `realizacja-06-raporty.png` |
| Podgląd realizacji (case preview) | 3 | 2 | Poprawny header/meta/DETAILS/blok AI z sugerowaną akcją, ale stopka AKCJE ogranicza się do samego „Kopiuj link" — brak siatki akcji 2-kolumnowej wymaganej kanonem. `realizacja-08-case-preview.png` |

**Średnia Realizacja: A = 1,9 · B = 1,9** (7 ekranów) — wynik istotnie zaniżony przez dwa
ekrany (Praca, Zasoby), które mimo posiadania *zaprojektowanej* odporności realnie
prezentują się jako zawieszone przez kilkanaście-dwadzieścia sekund.

**Ekran flagowy Realizacja:** Kokpit menedżera. Gotowy na demo od razu; jedyne ryzyko to
pokazywanie zakładek Praca/Zasoby zaraz po nim bez uprzedniego info że trzeba poczekać.

---

## 4. WYNIKI

> Nagłówek modułu (Menu 1, breadcrumb) na KAŻDYM ekranie tego modułu pokazuje **„Resultaty"**
> — hybrydowe, niepoprawne słowo (ani polskie „Wyniki", ani angielskie „Results"). Widoczne
> od razu na starcie: `wyniki-dom.png`, oraz na każdym kolejnym zrzucie niżej. Traktuję to
> jako JEDNO odchylenie cross-cutting, liczone raz w sekcji Top-10, nie osobno na każdy wiersz.
> Podobnie pole wyszukiwania w Menu 2 pokazuje angielski placeholder „Search" zamiast „Szukaj"
> na każdym ekranie modułu.

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| KPI — rejestr (lista) | 3 | 2 | Poza „Resultaty"/„Search" — czysta tabela, poprawne chipy. `wyniki-01-kpi-lista.png` |
| KPI — podgląd karty | 3 | 2 | Blok „AI" obecny, ale **pusty** (brak choćby jednego chipa akcji, wbrew kanonowi A7.4). `wyniki-02-kpi-karta.png` |
| KPI — pełna karta | 3 | 3 | Bardzo dobry ekran-rekord: nawigacja sekcji z lewej, akordeon z prawej, cytat wyjaśniający metodykę („Wynik i jakość danych to DWA NIEZALEŻNE wymiary"). **Kandydat na ekran flagowy.** `wyniki-03-kpi-pelna.png` |
| KPI → Pomiary (dziecko) | 3 | 2 | Dobry mini-triad, chip „Zweryfikowany" ucięty na prawej krawędzi (bez licznika widocznego). `wyniki-05-kpi-pomiary.png` |
| KPI → Zestawienia (puste) | 3 | 3 | Wzorcowy pusty stan ikona+tekst. `wyniki-06-kpi-zestawienia.png` |
| Karty wyników (lista zestawów) | 3 | 3 | Czysta tabela. `wyniki-04-karty-wynikow.png` |
| Modal „Nowa karta wyników" | 3 | 1 | Pole „WŁAŚCICIEL" pokazuje **surowe id bazy danych w nawiasie**: „Ty (d2b6a316-08c5-47cf-9bf7-4ba50311d5a2)" — techniczny identyfikator widoczny wprost dla użytkownika. `wyniki-07-scorecard-open.png` |
| Karta wyników — podgląd | 2 | 2 | Nagłówek podglądu **nie ma pinezki ani „Otwórz"** (kanon A7.1 wymaga obu w nagłówku) — „Otwórz pełną kartę" jest zamiast tego zwykłym przyciskiem akcji w stopce. Pole „Cel zakresu" pokazuje ucięty surowy UUID „a3e05d4a...". `wyniki-08-scorecard-real.png` |
| Karta wyników — pełny widok (pozycje) | 3 | 3 | Dobry pusty stan „Brak pozycji na karcie wyników". `wyniki-09-scorecard-pelna.png` |
| OKR — rejestr | 3 | 3 | Czysta tabela. `wyniki-10-okr-rejestr.png` |
| OKR — zestaw / Przegląd | 3 | 2 | **Bardzo dobry wzorzec**: każdy przycisk cyklu życia (Złóż do akceptacji/Zaakceptuj/Aktywuj/Anuluj) wyszarzony **z podanym dokładnym powodem** pod spodem („wymaga statusu... obecny status..."). Jedyna skaza: pole „Pewność ogólna" pokazuje **„Srednia" bez polskiego znaku** (powinno „Średnia") — w tym samym module pełna karta celu (patrz niżej) pokazuje to poprawnie, więc to dwa różne słowniki tej samej wartości enum. `wyniki-13-okr-obszar-roboczy.png` |
| Cele i Kluczowe Rezultaty (tabela celów) | 3 | 1 | Ten sam brak znaku: chip „Srednia" w kolumnie PEWNOŚĆ. `wyniki-14-okr-cele-kr.png` |
| Cel — podgląd | 1 | 1 | **Wyciek techniczny do UI**: komunikat blokady edycji brzmi dosłownie „ten zestaw jest w statusie innym (**kod serwera: assertSetEditableForUpdate**)" — nazwa wewnętrznej funkcji backendu (`server/src/services/resultsVnext/okr/okrObjectiveCommands.ts:121`) pokazana użytkownikowi po polsku obok żargonu programistycznego. `wyniki-15-cel-karta.png`, `wyniki-17-kluczowe-rezultaty.png` (ten sam tekst) |
| Cel — pełna karta | 3 | 3 | Identyczna z zatwierdzonym wzorcem referencyjnym właściciela (`evidence/odbior-zywo-20260905/08-wyniki/okr-cel/proof-okr-L2.png`) — łącznie z poprawnym „Średnia" (kontrast z tabelą wyżej). **Ekran flagowy.** `wyniki-16-cel-karta-pelna.png` |
| Kluczowe rezultaty (kafle KR) | 1 | 1 | **Nakładający się, nieczytelny tekst**: „Bieżąca: 58% · Cel: 100%" koliduje wizualnie z „Zaktualizowano: ...sie 2026 · Postęp: 58%" w tym samym wierszu — dwa napisy w jednym miejscu, potwierdzone powiększeniem `/tmp/crop-overlap.png`. `wyniki-18-kr-set-direct.png` |
| KR — pełna karta | 3 | 3 | Bardzo dobra: kontrakt pomiaru czytelny, poprawne „Średnia". `wyniki-19-kr-card.png` |
| ROI — hub | 3 | 3 | Czysta tabela. `wyniki-20-roi-hub.png` |
| ROI — podgląd sprawy | 3 | 3 | NPV/IRR poprawnie sformatowane, dobra treść bloku AI. `wyniki-22-roi-case.png` |
| Strona Uwaga (attention) | 3 | 3 | Ładny, ciepły pusty stan: „Ten zbiornik jest obecnie pusty — dobra wiadomość." `wyniki-21-attention.png` |

**Średnia Wyniki: A = 2,7 · B = 2,3** (19 ekranów/przepływów) — zdecydowanie najsilniejszy
moduł z czterech pod względem stabilności; największy pojedynczy problem to trzykrotnie
powtórzony wzorzec „surowy identyfikator/kod techniczny widoczny dla użytkownika".

**Ekran flagowy Wyniki:** Cel — pełna karta OKR (`/results/okr/:objectiveId`). To dokładnie
ten ekran, który właściciel już raz zaakceptował na obrazie referencyjnym — żywa aplikacja
odtwarza go 1:1, łącznie z poprawnymi polskimi znakami.

---

## Zbiorczo

| Moduł | Ekranów/przepływów | Śr. A | Śr. B |
| --- | :-: | :-: | :-: |
| Ocena | 11 | 2,0 | 2,2 |
| Inicjatywy | 10 | 2,0 | 1,1 |
| Realizacja | 7 | 1,9 | 1,9 |
| Wyniki | 19 | 2,7 | 2,3 |
| **Razem** | **47** | **2,28** | **1,96** |

Odchylenie cross-cutting (niepoliczone osobno w tabelach powyżej, wpływa na A na każdym
ekranie każdego z czterech modułów): powtarzalny błąd konsoli „Failed to fetch
notifications" (poller powiadomień, `src/services/feedbackCollector/NetworkBuffer.ts:43`
przez `api.ts fetchWithRetry`) — pojawia się na niemal każdej nawigacji po ~2 s, nie
blokuje UI, ale to prawdziwy, powtarzalny błąd w konsoli na produkcie mającym stanąć na
scenie bez jednego czerwonego logu.

---

## TOP 10 znalezisk wg wpływu/nakładu

1. **[Ocena] Raport oznaczony „Finalne"/80% jest w rzeczywistości całkowicie pusty (0 sekcji).**
   Otwarcie w Kreatorze raportów pokazuje „Zacznij budować raport"; Podgląd potwierdza
   „0 sekcji". To dokładnie centralny produkt modułu Ocena. Dowód: `ocena-12-raport-full-otworz.png`,
   `ocena-13-raport-podglad.png`. Wpływ: **H** (to jest to, czego boi się właściciel —
   pierwszy naprawdę dobry dokument z szablonu). Nakład: **M** (trzeba prześledzić, dlaczego
   zawartość raportu-oceny nie trafia do bloków Kreatora raportów przy statusie „Final").

2. **[Realizacja] Praca i Zasoby wiszą 15-22 sekundy bez żadnej informacji zwrotnej.**
   Mechanizm odporności istnieje (`executionCaseFanOut.ts`, limit 12 s per-realizacja,
   udokumentowany testem `ExecutionSurfaces.hangingCase.test.tsx`), ale realny,
   zmierzony na żywo czas do pokazania danych PRZEKRACZA zadeklarowany limit i przez
   cały ten czas ekran nie ma spinnera/paska postępu — więc mimo poprawnego mechanizmu
   degradacji widz doświadcza „zepsutego produktu". Dowód: `realizacja-03b-praca-wait.png`
   (15,5 s, dalej zawieszony) → `realizacja-03d-praca-22s.png` (rozwiązanie). Wpływ: **H**
   (dwa z sześciu ekranów Menu 2 Realizacji). Nakład: **S–M** (dodać spinner/skeleton od
   razu + zweryfikować, czemu realny czas przewyższa `EXECUTION_CASE_FANOUT_TIMEOUT_MS`).

3. **[Inicjatywy] Otwarcie pełnej karty inicjatywy (24 sekcje) generuje 11 błędów 404**
   na wszystkich zapytaniach API (kpis, gate-readiness-check, gate-roles, suggested-changes,
   załączniki) dla rekordu demo, którego identyfikator jest slugiem, nie UUID-em; a
   ponowne wejście na ten sam URL po odświeżeniu strony **cicho wraca do zwykłej listy**
   zamiast pokazać dokument (utrata stanu). Dowód: `inicjatywy-09-karta-pelna.png`,
   `inicjatywy-09b-karta-pelna-wait.png`. Wpływ: **H** (flagowy przepływ „otwórz pełny
   rekord" niestabilny + głęboki link nie działa). Nakład: **M**.

4. **[Wyniki] Wewnętrzna nazwa funkcji backendu wyciekła do polskiego komunikatu w UI**:
   „ten zestaw jest w statusie innym (kod serwera: assertSetEditableForUpdate)"
   (`server/src/services/resultsVnext/okr/okrObjectiveCommands.ts:121`). Dowód:
   `wyniki-15-cel-karta.png`. Wpływ: **H** (jeden zrzut ekranu wystarczy, żeby ktoś na
   scenie CES zapytał „co to za komunikat"). Nakład: **S** (zamienić treść komunikatu
   błędu na czysto biznesowy tekst po stronie warstwy prezentacji).

5. **[Cross-module] Polskie znaki diakrytyczne znikają w kilku niezależnych miejscach**:
   Kreator Inicjatyw AI ma na stałe wpisane w kodzie „Marza", „Jakosc", „Terminowosc"
   (`src/components/Initiatives/Wizard/InitiativeWizardModal.tsx:604-606`); niezależnie
   od tego widoki listowe OKR (tabela celów, przegląd zestawu) pokazują „Srednia" zamiast
   „Średnia" w polu Pewność — podczas gdy pełna karta tego samego rekordu pokazuje to
   poprawnie, co dowodzi, że to DWA różne słowniki tej samej wartości enum w jednym
   module. Dowód: `/tmp/crop-diacritics.png` (źródłowy plik i linie zacytowane wyżej),
   `wyniki-13-okr-obszar-roboczy.png`, `wyniki-14-okr-cele-kr.png`. Wpływ: **H**
   (widoczny błąd ortograficzny na scenie w dwóch niezależnych modułach). Nakład: **S**
   (poprawka literałów + ujednolicenie słownika etykiety pewności).

6. **[Wyniki] Surowe identyfikatory bazy danych pokazywane wprost użytkownikowi** — co
   najmniej trzy niezależne miejsca: „WŁAŚCICIEL: Ty (d2b6a316-08c5-47cf-9bf7-4ba50311d5a2)"
   w modalu nowej karty wyników, „Cel zakresu: a3e05d4a..." i „Program:
   e4329f41-d509-4575-a49c-0a2d2e49edf2" w tabelach właściwości OKR/KPI. Dowód:
   `wyniki-07-scorecard-open.png`, `wyniki-08-scorecard-real.png`, `wyniki-12-okr-cel.png`.
   Wpływ: **M–H** (powtarzalny wzorzec, nie pojedynczy przypadek — sugeruje brakujący
   resolver nazwy dla właściwości typu relacja w `ArtifactPropertiesTable`). Nakład: **S–M**.

7. **[Wyniki] Nakładający się, nieczytelny tekst na kafelku Kluczowego Rezultatu** —
   „Bieżąca: 58% · Cel: 100%" wizualnie koliduje z „Zaktualizowano/Postęp: 58%" w tym
   samym wierszu. Dowód: `/tmp/crop-overlap.png` (źródło: `wyniki-18-kr-set-direct.png`).
   Wpływ: **M** (jeden konkretny, łatwo powtarzalny ekran). Nakład: **S** (poprawka CSS
   układu kafla).

8. **[Inicjatywy] Całe Menu 3 w dwóch zakładkach (Plan, Obciążenie) oraz statusy/priorytety
   w widokach Kanban i Siatka są w 100% po angielsku**, mimo że nagłówki tabel pod spodem
   i pozostałe zakładki modułu są poprawnie polskie. Dowód: `inicjatywy-05-plan-tab.png`,
   `inicjatywy-06-obciazenie-tab.png`, `inicjatywy-02b-kanban-retry.png`,
   `inicjatywy-03c-siatka-retry.png`. Wpływ: **H** (skala — połowa widoków modułu, nie
   pojedynczy string). Nakład: **M** (brakująca warstwa i18n dla kilku słowników enumów).

9. **[Ocena] Przycisk „Nowy raport" wizualnie ucięty/zasłonięty przez panel Teresy**
   przy standardowej szerokości 1440 px w zakładce Raporty — 6 pigułek Menu 2 + 2
   dodatkowe przyciski + filtr nie mieszczą się w dostępnej szerokości. Dowód:
   `ocena-05-raporty.png` (powiększenie strefy 950–1440 px). Wpływ: **M** (dotyczy
   jednego ekranu, ale to główny CTA modułu). Nakład: **S** (responsywny wrap/scroll
   paska Menu 2 albo skrócenie etykiet).

10. **[Cross-module] Systemowe, nieczytelne obcinanie kolumn tabel bez elipsy/tooltipa** —
    powtarza się w Inicjatywach („OCZEKIWANY EFEKT" ściśnięty do 3 linii bez sensu) i w
    Realizacji (STATUS/TERMIN typu „W reali...", „5.05.2..."). Wspólny komponent
    `src/components/shared/ModuleHub/FilterableTable.tsx` ma domyślny `minWidth: 90px`
    dla kolumn innych niż tytuł (linia 789), a własny komentarz w pliku (linie 907-917)
    przyznaje, że przy `table-fixed` sam `minWidth` „niczego nie ratuje". Dowód:
    `/tmp/crop-effect-col.png`, `exec-wait8s.png`. Wpływ: **M–H** (łamie explicite
    zakaz kanonu „obcięty tekst bez tooltipa"). Nakład: **M** (dotyka współdzielonego
    komponentu — poprawka odrasta gdzie indziej, jeśli nie naprawiona u źródła, zgodnie
    z wcześniejszym pomiarem „Naprawa per-wywołanie odrasta").

### Pozytywne wzorce warte skopiowania
- **Wyniki → OKR → Przegląd zestawu**: każdy wyszarzony przycisk cyklu życia ma dokładny,
  czytelny powód pod spodem („wymaga statusu X, obecny status Y") — dokładnie to, czego
  brakuje w panelu Ustawienia w Ocenie. Warto ujednolicić na cały produkt.
- Uczciwe, ciepłe puste stany z ikoną+tekstem powtarzają się konsekwentnie (Kokpit
  Realizacji, Zestawienia KPI, strona Uwaga) — to jest już dobrze wystandaryzowane.
- DRD → Macierz → Pełny ekran (Ocena) i Cel → pełna karta (Wyniki) to dwa ekrany w pełni
  gotowe na scenę bez zastrzeżeń.

---

## Rekomendacje „ekran flagowy" — podsumowanie

| Moduł | Rekomendowany ekran na demo |
| --- | --- |
| Ocena | DRD → Macierz → Pełny ekran |
| Inicjatywy | Panel podglądu (single-click) na liście — **NIE** pokazywać Kanban/Siatka/Plan/Obciążenie bez naprawy tłumaczeń |
| Realizacja | Kokpit menedżera |
| Wyniki | Cel — pełna karta OKR (`/results/okr/:objectiveId`) — potwierdzone 1:1 z referencją właściciela |
