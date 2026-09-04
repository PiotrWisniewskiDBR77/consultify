# 08. Wyniki — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

22 ekrany, 12 z Twoją uwagą, 9 realnych defektów — NAJWIĘCEJ w całej aplikacji. Do 03.09 cały nowy moduł Wyników był na stagingu wyłączony (na demo widoczny przez profil). Trzy pary (results-three-pairs) odrzuciłeś — stary hub usunięty. ROI jako jedna karta N zrobione częściowo.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| 5 domen Wyników: KPI, ROI, OKR, wyszukiwarka, Uwaga (A1) | `—` | ON od 03.09 (DEC-347) |
| Wejście do raportów zarządczych z Wyników | `VITE_RESULTS_VNEXT_MANAGEMENT_REPORT_ENTRY_ENABLED` | ON od dziś |
| Zakładka Archiwum (stare Wyniki) | `resultsLegacyArchive` | OFF — czeka na odrębny odbiór na zrzutach |

## A. Zatwierdzone obrazy — 22 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `cel-jedna-karta` | Cel (OKR) jako JEDNA karta N | A | ok |  | `evidence/grafika/26-wyniki-karty-n/cel-jedna-karta__PO__light__refleksja.png` |
| `results-vnext-legacy-archive` | Archiwum wskaznikow | A | ok |  | `evidence/grafika/grafika-tor-audit-20260830/results-vnext-legacy-archive__PRZED__light.png` |
| `results-vnext-okr-admin` | Programy OKR | A | ok | Brak przycisków w dolnym pasku Preview - no chyba ze ich nie ma tutaj | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-okr-admin__PRZED__light.png` |
| `results-vnext-okr-objectives` | Cele | A | ok |  | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-okr-objectives__PRZED__light.png` |
| `results-vnext-okr-registry` | Rejestr OKR | A | ok | Dobrze, tutaj zgłaszałem, ja już to się zapisało. W prawym, głównym rogu powinien być przycisk „Nowe dodawanie OKR”, a teraz są jakieś inne niepotrzebne przyciski. | `evidence/grafika/92-ostatnia-kolumna/results-vnext-okr-registry__PO__light.png` |
| `results-vnext-okr-workspace` | Warsztat zestawu OKR | A | ok | To miało być w N-type karcie | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-okr-workspace__PRZED__light.png` |
| `results-vnext-roi-full-tool` | Pełne narzędzie ROI | A | ok | Wiesz co, wydaje mi się, że mamy do poprawki, bo ROI to jedna analiza i powinna mieć formułę N‑karty. Tak jak teraz, gdy tworzysz to w menu poziomym, nie mamy możliwości ułożenia tego w strukturze dokumentu. To musi być n‑karta, gdzie będziemy mieli z nowej strony te zakładki, które teraz masz w men | `evidence/grafika/16-dane-demo/results-vnext-roi-full-tool__PO__light.png` |
| `results-vnext-roi-pir-outcomes` | Wyniki po wdrozeniu | A | ok | I to jest, jak rozumiem, konsekwencja poprzednich, czyli to jest kolejna N‑karta w jednym ROI‑u. | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-roi-pir-outcomes__PRZED__light.png` |
| `results-vnext-roi-registry` | Rejestr ROI | A | ok | Super ok | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-roi-registry__PRZED__light.png` |
| `results-vnext-search-registry` | Wyszukiwarka | A | ok | generalnie układ menu i tabele sa ok ale tutaj wiele nie ma do akcpetacji | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-search-registry__PRZED__light.png` |
| `results-vnext-teresa-okr-reflection` | Refleksja nad celami | A | ok | Grafika tego jest fatalna, po prostu stara. | `evidence/grafika/grafika-tor-audit-20260830/results-vnext-teresa-okr-reflection__PRZED__light.png` |
| `results-zestawienia` | POZIOM 1 — Rejestr zestawien okresowych | A | ok |  | `evidence/grafika/18-wyniki-trzy-poziomy/results-zestawienia__PO__light.png` |
| `roi-jedna-karta` | ROI jako JEDNA karta N | A | ok |  | `evidence/grafika/25-roi-jedna-karta/roi-jedna-karta__PO__light__zalozenia.png` |
| `wskaznik-jedna-karta` | Wskaznik jako JEDNA karta N | A | ok |  | `evidence/grafika/26-wyniki-karty-n/wskaznik-jedna-karta__PO__light__rodowod.png` |
| `results-vnext-attention` | Uwaga | B | ok | tu sa tylko dwa przyciski w menu 2 | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-attention__PRZED__light.png` |
| `results-vnext-kpi-registry` | Rejestr wskaznikow | B | ok |  | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-kpi-registry__PRZED__light.png` |
| `results-vnext-kpi-scorecards` | Karty wynikow | B | ok |  | `evidence/grafika/18-wyniki-trzy-poziomy/results-vnext-kpi-scorecards__PO__light.png` |
| `results-vnext-roi-model` | Model ROI | B | ok | Tutaj muszę to odrzucić, bo wniosek jest dokładnie taki, jak wcześniej opisałem. Musimy przenieść to do jednej n‑karty. | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-roi-model__PRZED__light.png` |
| `results-vnext-teresa-kpi-deviation` | Sprawa odchylenia | B | ok | Tutaj zrobiłęś grafikę jak z przez 5 lat. zoabcz to nie jest spójne z naszyą formą UI/UX | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-teresa-kpi-deviation__PRZED__light.png` |
| `results-vnext-kpi-tool` | Narzędzie wskaźnika | C | ok |  | `evidence/grafika/18-wyniki-trzy-poziomy/results-vnext-kpi-tool__PO__light.png` |
| `results-three-pairs` | Trzy pary cel-wynik | D | nie | To jest jakis hisotryczny ekran. chyba juz tem dawno nie wyglada. - mam nadzieje | `evidence/grafika/134-noc-inicjatywy-wyniki/results-three-pairs__PRZED__light.png` |
| `results-vnext-registry-shell` | Powloka rejestru | D | — |  | `evidence/grafika/134-noc-inicjatywy-wyniki/results-vnext-registry-shell__PRZED__light.png` |

Bez Twojej decyzji (1): `results-vnext-registry-shell`.

Decyzje „nie” / „poprawka”: `results-three-pairs` = nie — To jest jakis hisotryczny ekran. chyba juz tem dawno nie wyglada. - mam nadzieje

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `results-vnext-attention` | WARUNKOWY | Flaga `attentionEntry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-kpi-registry` | WARUNKOWY | Flaga `kpiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-kpi-scorecards` | WARUNKOWY | Flaga `kpiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-legacy-archive` | WARUNKOWY | ResultsKpiRegistryPage.tsx:841-844: `legacyArchiveMode = isResultsVNextFlagEnabled('resultsLegacyArchive') && ...&resultsView=legacy`. Flaga `resultsLegacyArchive` ma `defaultValue: false` I jest jawnie WYJĘTA spod profilu demo (resultsVNextFeatureFlags.ts:199 | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-okr-admin` | WARUNKOWY | Flaga `okrRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-okr-objectives` | WARUNKOWY | Flaga `okrRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-okr-registry` | WARUNKOWY | Flaga `okrRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-okr-workspace` | WARUNKOWY | Flaga `okrRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-roi-full-tool` | WARUNKOWY | Flaga `roiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-roi-model` | WARUNKOWY | Flaga `roiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-roi-pir-outcomes` | WARUNKOWY | Flaga `roiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-roi-registry` | WARUNKOWY | Flaga `roiRegistry` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true` —  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-search-registry` | WARUNKOWY | Flaga `resultsSearch` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(...)) return true`  | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-teresa-kpi-deviation` | WARUNKOWY | Flaga `okrRegistry/roiRegistry (rodzic rejestru)` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfil | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |
| `results-vnext-teresa-okr-reflection` | WARUNKOWY | Flaga `okrRegistry (rodzic rejestru)` — src/components/ResultsVNext/resultsVNextFeatureFlags.ts:190-233 `isResultsVNextFlagEnabled()`: wczesny `if (isResultsOwnerReviewModeEnabled()) return true` i `if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(... | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `cel-jedna-karta`: PROTOTYP do Twojej decyzji — zero zmian w tym, co widzi dzis uzytkownik.
- `wskaznik-jedna-karta`: PROTOTYP do Twojej decyzji — zero zmian w tym, co widzi dzis uzytkownik.
- `roi-jedna-karta`: PROTOTYP do Twojej decyzji — zero zmian w tym, co widzi dzis uzytkownik.
- `results-vnext-okr-objectives`: Ten sam defekt wystepuje jeszcze w ok. 85 miejscach poza tym ekranem — osobne zadanie
- `results-vnext-okr-objectives`: Jak wyżej — „KLUCZ/REZUL" i znikająca kolumna „Zaktualizowano" to zasłonięcie przez przypiętą kolumnę akcji przy 9-10 kolumnach i otwartym podglądzie, nie ucięcie tekstu (2026-09-02)
- `results-vnext-roi-full-tool`: Glebokie podwidoki (baseline, wykonanie, powiazania finansowe) nieprzejrzane
- `results-vnext-okr-admin`: To prawdziwy stan flagi, nie defekt
- `results-vnext-okr-registry`: Nagłówek „PEW" NIE jest uciętym tekstem — zmierzone na żywym DOM: pełne słowo „Pewność" mieści się w swoim boksie, zasłania je przypięta kolumna akcji (sticky). Naprawa wymaga mechanizmu chowania kolumn, czyli decyzji o priorytecie kolumn — poza wyglądem (2026-09-02)
- `results-vnext-teresa-kpi-deviation`: Stan OTWARTEJ sprawy (w trakcie analizy/działań) nadal wygląda surowo — płaskie niestylowane pola formularza, szare przyciski — prawdopodobne źródło skargi właściciela „jak sprzed 5 lat”, wciąż nienaprawione dyżurem 174 (evidence/grafika/171-pojedyncze/).
- `results-three-pairs`: Zdjete z odbioru 2026-09-01 (docs/program/grafika/ANALIZA_ODRZUCONE_20260901.md §2) — nie duplikuj wiecej
- `results-three-pairs`: UWAGA: razem z martwym ResultsHub przestala byc osiagalna diagnostyka odchylen (anomalie/prognoza/podpowiedzi RCA) — sprawa otwarta do decyzji wlasciciela, patrz ODLOZONE.md
- `results-vnext-attention`: Jednokolumnowa tabela w kubelku „Brak wlasciciela" — sprawdzone, model serwera naprawde ma jedno pole
- `results-vnext-attention`: Ekran nie ma naglowka — zaczyna sie od golych pigulek Menu 2/3, wiec nie widac, na co sie patrzy (do naprawy osobno)
- `results-vnext-attention`: Kubelek startowy to zawsze „Brak wlasciciela", czyli najubozszy z trzynastu — powinien otwierac sie na tym z najwieksza liczba pozycji (do naprawy osobno)
- `results-vnext-attention`: Surowe pola: kolumna KOD KPI bez nazwy wskaznika, SET ID i data w formacie 2026-08-01T00:00:00Z (do naprawy osobno)
- `results-vnext-okr-workspace`: ADNOTACJA 2026-09-01: powloka do przebudowy — szesc zakladek w poziomie zamiast sekcji karty N, brak prawego panelu kanonu. Tresc i mechanika bez zmian. Plan: ODLOZONE.md
- `results-vnext-okr-workspace`: Pola „Wlasciciel" i „Recenzent" pokazuja uciete user-ann… / user-tom… zamiast nazwisk — rozwiazanie gotowe w ekranie „Uwaga" (OrganizationApi.getOrganizationMembers), do przeniesienia 1:1
- `results-vnext-roi-pir-outcomes`: Brak kebaba i filtrow — udokumentowany celowy, minimalny zakres widoku
- `results-vnext-search-registry`: PUSTKA ZAMIERZONA: Wyszukiwarka przed zapytaniem — uczciwie pusta. Z zapytaniem pokazuje trzy trafienia.
- `results-zestawienia`: To PROTOTYP nowego poziomu, nie realny komponent produkcyjny — czeka na Twoj wstepny OK, zanim tor funkcji go zbuduje
- `results-zestawienia`: Domyslnie podswietlony jest pierwszy wiersz; watek trzech poziomow widac na drugim (KPI jakosci — Q3 2026)
- `results-zestawienia`: Ekran istnieje WYŁĄCZNIE w harnessie (dev-render), nie ma odpowiednika w produkcie — to prototyp. Łamane „wskaźnik/i" jest realne, ale naprawa w harnessie byłaby naprawą przyrządu, nie produktu (2026-09-02)
- `results-vnext-registry-shell`: Sprawdzone: to fixtura testujaca mechanike wspolnej powloki, nie ekran produktowy. Nie pokazuje sie wlascicielowi.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 10 w tym module (9 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `results-three-pairs` | „To jest jakis hisotryczny ekran. chyba juz tem dawno nie wyglada. - mam nadzieje" | 2026-09-01 | DO_NAPRAWY | — |
| `results-vnext-attention` | „tu sa tylko dwa przyciski w menu 2" | 2026-09-01 | DO_NAPRAWY | — |
| `results-vnext-okr-registry` | „Dobrze, tutaj zgłaszałem, ja już to się zapisało. W prawym, głównym rogu powinien być przycisk „Nowe dodawanie OKR”, a teraz są jakieś inne niepotrzebne przyciski." | 2026-08-30 | DO_NAPRAWY | Ostatnia kolumna przestala byc ucinana (bylo 226 px nadmiaru). Uwaga o przycisku Nowe OKR w prawym rogu — osobno, jeszcze nie zrobione. |
| `results-vnext-okr-workspace` | „To miało być w N-type karcie" | 2026-09-01 | DO_NAPRAWY | — |
| `results-vnext-roi-full-tool` | „Wiesz co, wydaje mi się, że mamy do poprawki, bo ROI to jedna analiza i powinna mieć formułę N‑karty. Tak jak teraz, gdy tworzysz to w menu poziomym, nie mamy możliwości ułożenia tego w strukturze dokumentu. To musi być n‑karta, gdzie będziemy mieli z nowej s | 2026-08-30 | DO_NAPRAWY | ROI jest teraz JEDNA karta N: jedno menu i pasek tozsamosci zamiast trzech menu. Piec sekcji Twojej narracji, wszystkie 17 podwidokow zachow // Polskie nazwy kolumn i wartości zamiast angielskich resztek — między innymi „Linia" i „Okres" w tabeli porównania scenariuszy oraz surowe wa |
| `results-vnext-roi-model` | „Tutaj muszę to odrzucić, bo wniosek jest dokładnie taki, jak wcześniej opisałem. Musimy przenieść to do jednej n‑karty." | 2026-08-30 | DO_NAPRAWY | Wchlonieta do jednej karty ROI jako sekcja Model. Trzy paski menu (okruszki + szesc pigulek podwidokow + cztery pigulki faz), ktore odrzucil // Polskie nazwy kolumn i wartości zamiast angielskich resztek — między innymi „Linia" i „Okres" w tabeli porównania scenariuszy oraz surowe wa |
| `results-vnext-roi-pir-outcomes` | „I to jest, jak rozumiem, konsekwencja poprzednich, czyli to jest kolejna N‑karta w jednym ROI‑u." | 2026-08-30 | DO_NAPRAWY | Wchlonieta do jednej karty ROI jako podwidok Wynik PIR w sekcji Wnioski — dokladnie jako kolejna czesc jednego ROI, jak napisales. // Polskie nazwy kolumn i wartości zamiast angielskich resztek — między innymi „Linia" i „Okres" w tabeli porównania scenariuszy oraz surowe wa |
| `results-vnext-teresa-kpi-deviation` | „Tutaj zrobiłęś grafikę jak z przez 5 lat. zoabcz to nie jest spójne z naszyą formą UI/UX" | 2026-09-01 | DO_NAPRAWY | — |
| `results-vnext-teresa-okr-reflection` | „Grafika tego jest fatalna, po prostu stara." | 2026-08-30 | DO_NAPRAWY | Przyciski przeszly na kanon Menu 1 — ten sam rozmiar i kolor co reszta aplikacji. Reszta ekranu bez zmian: kolory byly juz na tokenach, ukla |
| `results-vnext-search-registry` | „generalnie układ menu i tabele sa ok ale tutaj wiele nie ma do akcpetacji" | 2026-09-01 | BACKLOG | Polskie nazwy kolumn i wartości zamiast angielskich resztek — między innymi „Linia" i „Okres" w tabeli porównania scenariuszy oraz surowe wa |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / SERVER_NOT_MEASURED`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence/grafika/g06-macierz-final-20260903/AGREGAT.md`, `doc
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `4d402fcfc8` (02.09 18
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-09_RESULTS.md`.
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Wyniki → sprawdź czy widzisz zakładki KPI/OKR/ROI → otwórz realny KPI z listy
→ sprawdź kartę szczegółów.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem 14 ekranów tej rodziny (KPI, OKR,
ROI, wyszukiwarka, uwaga) — robotnik jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE
zgłaszaj” na górze dokumentu); wcześniejsza korekta z 1.09: OKR i ROI SĄ już widoczne w profilu
odbiorowym niezależnie od tego przełącznika.

**Czego NIE zgłaszaj**: zakładka „Archiwum” (`resultsLegacyArchive`) zostaje wyłączona na stałe,
także dla Ciebie — to celowe, nie błąd.

**Pytania (TAK/NIE)**:
- Widzisz zakładki KPI/OKR/ROI z realnymi danymi (nie pustym ekranem)?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/09_RESULTS/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
