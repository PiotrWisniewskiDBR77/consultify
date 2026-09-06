# RUBRYKA — samoocena dwóch plików z oceny DBR77

Pliki oceniane (wygenerowane 2026-09-06 przez trasy produktu, nie skryptem obok):

| Plik | Rozmiar | Objętość |
|---|---:|---|
| `DBR77_Raport_z_oceny_DRD.docx` | 258 728 B | 26 stron (LibreOffice), 19 tabel, 210 akapitów |
| `DBR77_Prezentacja_z_oceny.pptx` | 563 138 B | 14 slajdów |
| `DBR77_Prezentacja_z_oceny.pdf` | 57 603 B | 14 stron, Lato osadzone |

Źródło treści: ocena `assess-drd-manufacturing-01` (org DBR77), 39 z 39 obszarów
z zapisanym poziomem, 6 obszarów z notatką oceniającego. Magazyn ZASTANY
(`assessments.answers_json`) — jądro metodyczne na tym stanowisku ma zero sesji.

---

## Oceny 1–10

| # | Kryterium | Ocena | Uzasadnienie |
|---:|---|:---:|---|
| 1 | Typografia | **8** | Jedna rodzina Office-native (Calibri/Calibri Light) w DOCX i PPTX, więc plik wygląda tak samo u klienta jak u nas (BRAND_EXPORT_CANON §11 D1). Skala respektowana: tytuł slajdu 24 pt, treść 15 pt, tabela 12 pt, stopka 9 pt — nigdzie poniżej 9 pt. PDF ma osadzone Lato (nie zależy od systemu odbiorcy). Minus: w DOCX kroje deklaruje `formattingSchema` jako napis („Calibri 11"), a nie token ze wspólnej skali L1–Q — kanon §9 wskazuje to jako dług, którego ta praca nie zamyka. |
| 2 | Hierarchia | **8** | DOCX: nagłówki to STYLE Worda (Heading 1/2/3, `Kicker`, `Sygnatura`, `Caption`), nie pogrubiony tekst — spis treści jest polem natywnym i sam się zbuduje. PPTX: kicker → tytuł → jedna treść → jedno zdanie wniosku, konsekwentnie na 13 slajdach. Minus: strona 3 DOCX niesie jeden akapit i zostaje w 70% pusta (łamanie wynika z bloku radaru wyżej), a to widać. |
| 3 | Spójność z kanonem | **8** | Paleta wyłącznie `executive` (navy `#0C447C`, teal `#1D9E75`, `#5F5E5A`, `#2C2C2A`); crimson `#85182F` NIE występuje ani razu (§3 pkt 1). Tabele hairline, zebra wyłączona, nagłówek na tle `dominant` (§6). Wykres bez gradientu, bez 3D, legenda pod wykresem (§7). Stopka lewo-nazwa / prawo-numer, linia włoskowa (§4). Metadane pliku: `creator = Consultify`, `company = DBR77` (§4, D5). Minus: kanon każe serie wykresów brać z sekwencji `--c-tag-1..12`; tu są dwie serie w kolorach motywu — zgodne z wyjątkiem dla wykresu jedno/dwuseriowego, ale nie z literą §3. |
| 4 | Poprawność polszczyzny | **6** | Cała warstwa autorska jest po polsku i poprawna (odmiana, spójniki, brak kalek). ALE w dokumencie są **4 angielskie etykiety poziomów DRD**: „Expert", „Advanced", „Data from Physical…", „Autonomous Data Intelligence" — korpus metodyki dla osi 3–7 jest po angielsku i silnik cytuje go wiernie (udokumentowane w raporcie dyżuru 32). W prezentacji usunąłem ten problem (kolumna pokazuje samą liczbę poziomu), w raporcie etykieta została, bo tam niesie treść. Dodatkowo notatki oceniającego z bazy zawierają angielskie wtrącenia („Change management program", „digital literacy") — to cytat z bazy, nie nasz tekst, ale klient tego nie odróżni. |
| 5 | Zgodność treści z bazą | **9** | Każda liczba ma źródło w `assessments.answers_json`; sprawdzone zapytaniem SQL (10 wartości w raporcie nadzorcy). Zero halucynacji: obszar bez poziomu NIE dostaje findingu i jest opisany jako nieoceniony, a nie jako zero. Pola, których magazyn nie ma (profil działalności, zatrudnienie, sponsor), mówią „Do uzupełnienia / Brak danych w ocenie". Dokument jawnie deklaruje, że wynik pochodzi z warsztatu, a nie z zamrożonego Outputu — i że poziomy są zadeklarowane bez dowodów. Minus: pole „Oceniający" bierze autora rekordu (`created_by`), co jest najlepszym dostępnym przybliżeniem, ale nie jest tym samym co osoba prowadząca ocenę. |
| 6 | Czytelność tabel i wykresów | **8** | Wykres w PPTX jest NATYWNYM wykresem OOXML (klient może kliknąć słupek i zobaczyć liczbę), nie obrazkiem; oś 0–100% co 20, legenda pod wykresem, etykiety osi 9 pt. Radar w DOCX to PNG z podpisem i tabelą tych samych liczb obok — czytelnik nie musi odczytywać wartości z rysunku. Liczba wierszy tabeli jest ograniczana do wysokości ramki (poprawka po zmierzonym nachodzeniu na slajdzie 12). Minus: radar w DOCX ma drobne etykiety (rysowany rasterowo) i przy druku 1:1 jest na granicy czytelności. |
| 7 | Brak pustych/sztucznych treści | **7** | Zero placeholderów szablonu: `TODO`, `Lorem`, `{{`, `undefined`, `null`, `NaN`, `[object`, `U+FFFD` — 0 wystąpień w DOCX, PPTX i PDF. Usunięta została instrukcja redakcyjna „Sekcja do uzupełnienia — limit X–Y słów", która wcześniej trafiała do pliku klienta 8 razy. ALE: komentarz obszaru powtarza zdanie „Brak treści wymaganej do pełnego komentarza: znaczenie dla przedsiębiorstwa oraz najbliższy krok." **39 razy** — po jednym na obszar. To jest uczciwe (magazyn zastany naprawdę nie ma rekomendacji), ale czytelnik odbiera 39 identycznych zdań jako maszynowy szum. To największa pojedyncza wada tego raportu. |
| 8 | Gotowość do wysłania klientowi | **6** | Plik można wysłać i nie będzie wstydu: marka spójna, poufność, numeracja, stopka, spis treści, załącznik metodyczny. ALE trzy rzeczy zatrzymują mnie przed „tak, wyślij": (a) 39 powtórzonych zdań o braku treści (poz. 7), (b) angielskie etykiety poziomów (poz. 4), (c) spis treści w Wordzie jest polem — zbuduje się dopiero po otwarciu w Wordzie i akceptacji „aktualizuj pola"; w podglądzie LibreOffice jest pusty, a klient otwierający w podglądzie poczty zobaczy pustą stronę spisu. Prezentacja jest bliżej gotowości niż raport — jej wysłałbym bez zastrzeżeń. |

**Średnia: 7,5 / 10.**

---

## Co konkretnie obniża ocenę (lista do naprawy, w kolejności wagi)

1. **39 identycznych zdań „Brak treści wymaganej do pełnego komentarza"** w rozdziałach osi.
   Naprawa: powiedzieć to RAZ (w nocie metodycznej i we wstępie osi), a w komentarzu obszaru
   zostawić same fakty. Wymaga zmiany `composeAreaNarrative` z zachowaniem zachowania dla
   magazynu jądra, gdzie te pola bywają wypełnione.
2. **Angielskie etykiety poziomów DRD dla osi 3–7** w raporcie („Expert", „Advanced",
   „Data from Physical…", „Autonomous Data Intelligence"). Naprawa jest poza kodem — to
   tłumaczenie korpusu metodyki, decyzja właściciela metodyki (granica licencyjna).
3. **Spis treści jako pole Worda.** Podgląd (LibreOffice, podgląd poczty, Google Docs) pokaże
   pustą stronę. Rozważyć wygenerowanie statycznego spisu z numerami stron obok pola.
4. **Strona 3 raportu prawie pusta** — łamanie po bloku radaru. Kosmetyka, ale widoczna.
5. **Wykres w DOCX jest rastrem (PNG)**, nie natywnym wykresem Worda — nie da się kliknąć
   w wartość i nie skaluje się bez utraty jakości, w odróżnieniu od wykresu w PPTX.
6. **Serie wykresu nie idą z sekwencji `--c-tag-1..12`** (kanon §3) — dziś kolory motywu.

## Czego ta rubryka NIE mierzy

- Jak plik wygląda otwarty w prawdziwym Wordzie i PowerPoincie na Windows — wszystkie
  podglądy powstały przez LibreOffice, który podstawia własne kroje pod Calibri.
- Druku (papier, CMYK) — oceniane wyłącznie na ekranie.
- Odbioru merytorycznego przez konsultanta: czy TE wnioski są tym, co powiedziałby człowiek.
  Rubryka ocenia rzemiosło dokumentu, nie trafność doradczą.
