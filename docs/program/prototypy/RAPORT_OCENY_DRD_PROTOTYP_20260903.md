# Prototyp B1 — raport końcowy Oceny (DRD) jako PLIK

Decyzja właściciela: `DEC-2026-09-03-352` (rejestr
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`).
Struktura: **wstęp → 7 osi → odpowiedzi i wnioski → podsumowanie**, TERAZ, osobnym torem,
**prototyp jako PLIK do akceptu PRZED budową silnika**.

Ten plik jest notatką do prototypu. Do oceny idą dwa dokumenty, nie ta notatka.

## Co powstało

| Plik | Co to jest | Objętość |
| --- | --- | --- |
| `RAPORT_OCENY_DRD_PROTOTYP_20260903.docx` | prototyp raportu z pełną narracją na realistycznych danych klienta | **21 stron A4** |
| `RAPORT_OCENY_DRD_PROTOTYP_20260903.pdf` | ten sam dokument po konwersji (do oglądania) | 21 stron |
| `RAPORT_OCENY_SIRI_SZKIELET_20260903.docx` / `.pdf` | ten sam szkielet dla SIRI — **tylko struktura**, bez danych | **2 strony** |
| `evidence/prototypy/raport-oceny-20260903/strona-01..21.png` | zrzut każdej strony raportu DRD | 21 obrazów |
| `evidence/prototypy/raport-oceny-20260903/siri-strona-1..2.png` | zrzut szkieletu SIRI | 2 obrazy |
| `scripts/prototypes/build-raport-oceny-prototyp.mjs` + `raport-oceny-tresc.mjs` | generator prototypu (treść oddzielona od składu) | — |
| `scripts/prototypes/build-raport-siri-szkielet.mjs` | generator szkieletu SIRI | — |

Odtworzenie: `node scripts/prototypes/build-raport-oceny-prototyp.mjs`, potem
`soffice --headless --convert-to pdf`.

## Co jest w prototypie

**Klient pokazowy** — TechProd Manufacturing Sp. z o.o., producent podzespołów elektronicznych,
468 osób, 3 zakłady, 312 mln PLN przychodu. Ta sama firma, która występuje w
`data/sample-reports/drd-full-diagnostic-report.md`, żeby dane pokazowe się nie rozjeżdżały.

**Liczby** — nie wymyślone: pochodzą z `src/services/report/drdReportSampleData.ts`
(`SAMPLE_DRD_SCORES`, 39 obszarów) i ze struktury `src/services/drdStructure.ts`
(natywne skale osi 7/5/5/7/6/6/5). Wynik ogólny 54,6% skali policzony jako średnia
z procentów skali siedmiu osi.

**Budowa dokumentu**

1. Strona tytułowa (klient, metryka badania, wynik ogólny, klauzula poufności).
2. Wstęp: cel oceny · zakres i sposób badania z kalendarzem · metodyka DRD z tabelą 7 osi ·
   **jak czytać poziomy** (dlaczego skale są różne i dlaczego porównujemy procentem skali) ·
   ramka „wyższy poziom nie jest automatycznie lepszy" · skład obu zespołów.
3. Siedem rozdziałów osi w **stałym szablonie**, każdy dokładnie 2 strony:
   werdykt (≤ 25 słów) → wskaźnik poziomu na natywnej skali osi → zakres oceny →
   *co zbadano* obok *odpowiedzi klienta w skrócie* (dwie kolumny) → tabela dowodów ze
   stanem → tabela wszystkich obszarów osi (AS-IS / TO-BE / luka / stan dowodu) →
   wnioski → rekomendacje z priorytetem, horyzontem i właścicielem →
   akapit **sufit rekomendowany** (dlaczego NIE maksimum) → linia decyzyjna
   `kierunek | priorytet | horyzont | warunek powodzenia`.
4. Odpowiedzi i wnioski zbiorcze: macierz 7 osi × poziom, najsilniejsze i najsłabsze osie,
   pięć wniosków przekrojowych (W1–W5).
5. Podsumowanie: mapa drogowa 14 przedsięwzięć w trzech falach (wpływ × nakład × właściciel),
   kolejny krok z czterema terminami, granice wnioskowania.

**Wygląd** — paleta wyłącznie z `src/index.css` (slate/neutral). Crimson `--c-accent #85182F`
występuje w **dwóch** miejscach i tylko jako semantyka krytyczna: ramka RYZYKO w osi 6
i słowo „Krytyczny" w tabelach priorytetów. Zero ozdób, zero gwiazdek, zero ikon.
Wskaźnik poziomu czytelny bez koloru — pola mają wpisane numery poziomów, a legenda
opisuje ich znaczenie słowami.

**Odbiór wizualny** — każda z 21 stron obejrzana po konwersji do PNG. Poprawione w trakcie:
osierocona strona z samą linią decyzyjną, pusty wiersz nagłówka na okładce, tabela obszarów
rwąca się po dwóch wierszach, trzy komórki linii decyzyjnej łamiące się na cztery wiersze.

## Siedem pytań do właściciela

Każde z rekomendacją. Bez odpowiedzi na P1 i P2 nie ma sensu zaczynać silnika.

| # | Pytanie | Rekomendacja CTO |
| --- | --- | --- |
| **P1** | Komentarz ekspercki **per obszar** (39 bloków po 110–170 słów, zgodnie z `ASM-OWN-025`) czy **per oś** (jak w prototypie: tabela wszystkich obszarów + wnioski osi)? Wersja per obszar to +12–14 stron i ~5 500 słów narracji. | **Per oś**, jak w prototypie. Komentarz per obszar udostępnić w widoku interaktywnym i jako opcję „eksport pełny". Powód: 39 wygenerowanych bloków to najkrótsza droga do lania wody, którego się obawiasz. |
| **P2** | Objętość: 21 stron (rytm 2 strony na oś) czy krótszy dokument? Zejście do 14 stron wymaga usunięcia bloku „co zbadano / odpowiedzi klienta" albo tabeli obszarów. | **Zostawić 21 stron** jako raport pełny i dorobić z tego samego modelu **wyciąg dla zarządu na 4 strony** (okładka + zbiorcze + mapa drogowa). Dwa eksporty, jedno źródło. |
| **P3** | Słownik stanu dowodu. Prototyp używa czterech etykiet: Potwierdzony / Deklarowany / Niepełny / Brak dowodu. Jądro ma drabinę **E0–E4** (`src/method-core/contracts/events.ts`). | Etykiety zostają cztery, ale **wyprowadzane jednoznacznie z E0–E4** (E0 → Brak dowodu, E1 → Deklarowany, E2 → Niepełny, E3–E4 → Potwierdzony). Jedna reguła w kodzie, zero ręcznej oceny konsultanta. |
| **P4** | Tytuły poziomów są w jądrze **po angielsku** dla osi 1, 2, 3, 4 i 7 („Basic Data Registration", „MES", „ERP", „Expert"); po polsku tylko osie 5 i 6. Prototyp ich nie cytuje i dlatego wygląda po polsku — silnik będzie musiał je cytować przy opisie luki. | **Przetłumaczyć tytuły i opisy poziomów na polski przed budową silnika** — osobne, tanie zadanie (39 obszarów × 5–7 poziomów, jeden robotnik). Inaczej polski raport wypluje angielskie nazwy poziomów. |
| **P5** | Kto pisze narrację: model językowy z bramkami czy generator deterministyczny? | **Model z twardymi bramkami** (`drdLlmNarrator.ts` już to przewiduje): liczby wyłącznie z silnika, limit słów, obowiązkowa referencja do zatwierdzonej odpowiedzi lub dowodu, przy niepowodzeniu — cichy powrót do wersji deterministycznej. Sam generator deterministyczny da raport poprawny, ale nie taki jak ten prototyp. |
| **P6** | Czy raport ma **wprost** pisać, że nie rekomendujemy maksimum skali (akapit „sufit rekomendowany" w każdej osi + wniosek W5)? | **Zostawić.** To jest wprost wymóg `ASM-OWN-024` pkt 5 i największa różnica wobec raportów, w których każdy obszar „powinien być na 5". |
| **P7** | Skład zespołu, kalendarz badania, zakres i wyłączenia (zakłady nieodwiedzone) — **tych danych nie ma dziś nigdzie w systemie**. | Dodać do sesji jedną kartę **„Metryka badania"** wypełnianą przez konsultanta (zespół po obu stronach, terminy, zakres, wyłączenia). Bez niej generator albo zostawi puste miejsca, albo je zmyśli — a to drugie jest gorsze. |

## Mapa: sekcja raportu → źródło danych

„Jest" = da się przeczytać z dzisiejszego jądra. „Brak" = trzeba dołożyć.

| Sekcja raportu | Źródło | Stan |
| --- | --- | --- |
| Nazwa i opis klienta, branża | profil organizacji + `DrdReportMeta.industry`, `drdIndustryProfiles.ts` | jest |
| Data raportu, wersja, status | metadane sesji / rewizji raportu | jest |
| Skład zespołu, kalendarz badania, wyłączenia | — | **brak (P7)** |
| Nazwy osi i obszarów, natywne skale | `src/services/drdStructure.ts` (+ `server/src/data/drdStructure.ts`) | jest |
| Tytuły i opisy poziomów **po polsku** | `drdStructure.ts` — PL tylko dla osi 5 i 6 | **częściowo (P4)** |
| AS-IS / TO-BE per obszar, luka | `drdSessionRuntime` / `drdHttpSessionRuntime`, `calculateAxisScoreV2` | jest |
| Wynik osi i wynik ogólny, procent skali | `calculateAxisScore(V2)`, `calculateOverallScore(V2)` | jest |
| Pytania „co zbadano" | `drdKnowledgeOverridesAxis*.ts` + `knowledge/tool-kb/drd/qbank/v2/*` | jest |
| Odpowiedzi klienta (surowe) | zdarzenia `answer` sesji (`text`, `justification`, `answerState`) | jest |
| „Odpowiedzi klienta w skrócie" (3–5 zdań na oś) | — synteza z odpowiedzi | narrator |
| Dowody: opis, źródło, stan | `EvidenceEventPayload` (`evidenceType`, `strength` E0–E4) | jest, mapowanie do etykiet **do ustalenia (P3)** |
| Pominięcia i ich kody | słownik kodów Pomiń (`DEC-2026-08-26-115/122`), `skips[]` w kontrakcie raportu | jest |
| Werdykt osi, wnioski, wnioski przekrojowe, sufit | `drdConclusionContract.ts` (szkielet) + `drdLlmNarrator.ts` | jest jako szkielet, treść = **narrator (P5)** |
| Rekomendacje: priorytet, horyzont, właściciel | — pola nie istnieją w modelu sesji | **brak** — dołożyć do kontraktu raportu |
| Uzasadnienie sufitu (dlaczego nie maksimum) | — | **brak** — pole per oś, wymóg `ASM-REPORT-AC-003` |
| Benchmark branżowy | `drdIndustryBenchmark.ts`, `drdIndustryProfiles.ts` (`expert-hypothesis-v1`) | jest, **musi być oznaczony jako hipoteza, nie pomiar** |
| Mapa drogowa (fale, wpływ × nakład) | `DrdRoadmapItem` w `drdReportModel.ts` | jest, do rozszerzenia o właściciela i termin |
| Granice wnioskowania | składane z `answerState`, siły dowodu i metryki badania | częściowo — reszta z P7 |

## Szacunek budowy silnika

Przy założeniu, że pytania P1–P7 są rozstrzygnięte przed startem.

| Krok | Dni |
| --- | --- |
| Kontrakt raportu w nowej strukturze (4 części, 7 rozdziałów, etykiety dowodu z E0–E4) | 1 |
| Renderer DOCX/PDF przeniesiony z tego prototypu na dane z kontraktu | 1 |
| Narrator z bramkami (werdykt ≤ 25 słów, wnioski, sufit, referencje do dowodów, fail-safe) | 1,5 |
| Podłączenie do trasy eksportu i zakładki Raport + odbiór na realnej sesji | 1 |
| Wariant SIRI (8 rozdziałów + jawnie oznaczona reguła agregacji 16D → 8D) | 1 |
| **Razem** | **5,5 dnia roboczego** |

Zakres minimalny — sam DRD, narracja deterministyczna, bez zmian w zbieraniu dowodów —
zamyka się w **3 dniach** i to jest liczba zgodna z Twoim szacunkiem „2–3 dni" z rozmowy 03.09.
Różnica to narrator i SIRI. Do tego dochodzą dwa zadania poza tym rachunkiem: tłumaczenie
poziomów (P4) i karta „Metryka badania" (P7).

## Rozbieżności znalezione przy okazji (do sprostowania osobno)

1. `data/sample-reports/drd-full-diagnostic-report.md` opisuje osie 5 i 6 jako skalę 1–5.
   W kodzie (`drdStructure.ts`) obie mają **6 poziomów** i tyle samo poziomów mają wszystkie
   ich obszary. Przykładowy raport w repo jest w tym punkcie nieprawdziwy.
2. `src/services/siriStructure.ts` nazywa **8 filarów** stałą `SIRI_DIMENSIONS`, a **16 wymiarów**
   trzyma w `SIRI_PRIORITISATION_AREAS` — odwrotnie do słownictwa metodyki. Silnik SIRI
   (`siriAdapter.ts`) operuje na 16D i sam to sprostowanie odnotowuje.
3. Kanon SIRI nie definiuje formuły agregacji 16D → 8D. Jeżeli raport ma pokazywać wynik
   filaru, reguła musi być oznaczona w dokumencie jako reguła Consultify, nie jako wynik metodyki.
