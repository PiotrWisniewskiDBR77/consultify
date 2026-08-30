---
doc_id: grafika-mapa-uwag
status: canonical
truth_type: worklist
established: 2026-08-30
zrodlo: odbior.sqlite, tabela decyzje (63 pozycje: 48 "poprawka" + 15 "nie")
---

# Mapa 63 uwag właściciela — klastry i przyczyny

Lista robocza numer jeden toru grafiki. **Kolejność pracy idzie klastrami, nie
alfabetem** — jedna przyczyna potrafi zdjąć siedem uwag naraz.

Legenda stanu: `ZMIERZONE` (znam przyczynę) · `W NAPRAWIE` · `DO ZRZUTU`
(naprawione, czeka na dowód) · `ODEBRANE` (właściciel kliknął ponownie).

---

## K1 · „Tabela nie jest na pełną szerokość" — 8 uwag · ZMIERZONE, w większości NIEAKTUALNE

**Przyczyna: stanowisko pomiarowe, nie produkt.** Dziesięć ekranów harnessu miało
wpisane `maxWidth: 1180`. Właściciel widział wąską tabelę i miał rację co do obrazu —
ale usterki w produkcie nie było. Usunięte commitem `54f450efb8` o **14:15**,
czyli **2,5–4 godziny PO tym, jak właściciel te uwagi zgłosił** (10:01–11:44).
Nikt mu nie pokazał nowych zrzutów, więc dla niego sprawa wygląda na otwartą.

Zweryfikowane zrzutem własnymi oczami (`evidence/grafika/90-szerokosc-tabel/`):

| ekran | stan po zrzucie |
| --- | --- |
| `vault-safes-table` | **CZYSTE** — pełna szerokość, każdy wiersz w jednej linii (dokładnie o to prosił) |
| `audyty-drd-report` | **CZYSTE** — pełna szerokość, całość po polsku |
| `assessment-reports-panel` | szerokość OK, ale **CAŁY EKRAN PO ANGIELSKU** → K2 |
| `assessment-initiatives-table` | szerokość OK, ale **CAŁY EKRAN PO ANGIELSKU** → K2 |
| `plan-scenario-d1` | szerokość OK, ale **ostatnia kolumna ucięta** → K3 |
| `template-library-new-entry` | harness pokazuje pustą planszę z instrukcją, nie tabelę — właściciel nie miał czego oceniać |
| `assessment-five-surfaces` | do obejrzenia |
| `assessment-list` | zrzut padł na przekroczeniu czasu — do powtórki |

**Zostaje do zrobienia w harnessie:** `dev-render/screens/assessment-initiatives-table.tsx:125`
sztywne `height: 640`; `dev-render/screens/standard-module-bar-children.tsx:26`
`maxWidth: 1180` — jedyne, które przetrwało czystkę.

---

## K2 · Ekrany po angielsku — 2 uwagi (+ 2 panele oceny z wcześniejszego rejestru) · W NAPRAWIE

`assessment-reports-panel`, `assessment-initiatives-table` — pełny interfejs po
angielsku mimo `lang=pl`. Sprawdzane jest najpierw, czy to defekt produktu, czy
brak wymuszenia języka w harnessie (znana pułapka §5 pkt 5).

---

## K3 · Ostatnia kolumna tabeli ucięta — 2 ekrany, podejrzenie defektu wspólnego jądra · W NAPRAWIE

`finance-analysis-workspace` („JAKOŚĆ DOSTĘPU" → „JAK… DOSTĘ", wartości „C") oraz
`plan-scenario-d1` („KOSZT OPÓŹNIENIA" → „KOS OPÓŹN", wartości „Niezna").
Dwa niezależne moduły, ten sam objaw → podejrzenie `StandardTable`.
**Uwaga historyczna:** ten defekt raz już załatano per-wywołanie i odrósł po ośmiu
tygodniach w 12 plikach. Naprawa idzie do wspólnego jądra albo nie idzie wcale.

---

## K4 · Finanse — 10 uwag, z tego 7 bez ani jednego słowa komentarza · ZMIERZONE

**Przyczyna: właściciel oglądał puste warianty.** Wszystkie ekrany Finansów wymagają
parametrów adresu (`&scene=`, `&mode=`, `&step=`, `&state=`) udokumentowanych
**wyłącznie w komentarzu nagłówkowym własnego pliku** — rejestr harnessu ich nie
wymienia. Zrzuty robiono bez nich, więc dziewięć ekranów pokazało stan pusty albo
kartę `max-w-md` na 85% białego kadru. Uwaga „nic tu nie widać, nic z tego nie można
wyciągnąć" była **trafna wobec tego, co dostał**, i niesprawiedliwa wobec produktu.

Zrzuty z właściwymi parametrami: `evidence/grafika/91-finanse-parametry/`.
Adresy z kompletem parametrów zapisane tam, gdzie ich brakowało.

**Jedyny realny defekt graficzny w tym klastrze** — `finance-valuation-workspace`:
rząd siedmiu kroków renderuje się jako goły tekst zamiast pigułek. Uwaga właściciela
trafiona co do joty. → W NAPRAWIE

---

## K5 · Macierz oceny — 2 uwagi · ZMIERZONE, właściciel miał rację

Powiedział: *„Nigdzie nie znalazłem macierzy. (…) Poszukaj tego dokładnie. To w kodzie
istnieje."* **Istnieje w PIĘCIU niezależnych implementacjach.** Jedna żywa, cztery
odcięte. To piąty przypadek tego samego wzorca w tym repo: rzecz zbudowana i pozbawiona
wejścia.

| implementacja | linie | stan |
| --- | --- | --- |
| `LiveMatrix` (`src/components/method-workspace/LiveMatrix.tsx`) | 296 | **ŻYWA** — ale sesja startuje na zakładce „Wywiad", macierz to jedno kliknięcie dalej; **po zamrożeniu sesji znika całkiem** |
| `DRDMatrixSession` (widok wszystkich 7 osi naraz) | 313 | MARTWA — `shouldMountDrdMethodWorkspace` ignoruje flagę i zawsze wchodzi w inną gałąź (commit `28cc3d65ac`) |
| `EmbeddedMatrix` (7 osi ze **zmienną** liczbą poziomów — najbliższe opisowi właściciela) | 543 | ZA FLAGĄ `isDrdReportEnabled`, domyślnie **wyłączoną**, zmienna nigdzie nieustawiona |
| `HeatmapMatrix` | 432 | MARTWA — zero wołaczy |
| `GapHeatmap` + radar 7 osi do raportu | 589 | MARTWA — `ReportEditor.tsx` ma zero importerów |

**Najgroźniejsze:** ekran harnessu `assessment-matryca` pokazuje macierz, której
w aplikacji nie da się otworzyć. A `FrozenOutputHttpView` usuwa macierz z ekranu
dokładnie w momencie, w którym miała „wejść do raportu i wizualizować poziomy oraz
następne kroki".

**Do rozstrzygnięcia (decyzja produktowa, nie graficzna):** którą z pięciu macierzy
robimy tą jedyną. Rekomendacja: `EmbeddedMatrix` — zmienne osie to dokładnie to,
co właściciel opisał — i wpięcie jej w raport oraz w widok po zamrożeniu sesji.

**Sprostowanie dokumentacji:** `PRZEKAZANIE_GRAFIKA.md:188` i `status.json` twierdzą,
że `assessment-matryca` nie jest zarejestrowana w harnessie. **Jest** — od 11:08,
`dev-render/main.tsx:1327`. Dokument przepisał nieaktualną notatkę sześć godzin po fakcie.

---

## K6 · Arkusz i prezentacja — brak narzędzi edycji · 6 uwag · DO ZAPLANOWANIA

`sheet-artifact`, `excele-prawy-panel-standard`, `excele-edytowalna-siatka`,
`deck-artifact`, `excele-jeden-widok-recent`, `excele-engine-reveal`.
Powtarzana trzy razy uwaga: górna jedna trzecia ekranu ma iść do prawego panelu,
u góry ma być pasek narzędzi tabelarycznych, tabela od samej góry — jak w Excelu.
Plus: *„nie mam tutaj w ogóle narzędzia Excelowego (…) w Wordzie mogę, w PowerPoincie
też nie mogę"*.

---

## K7 · ROI jako jedna karta N · 3 uwagi · CZĘŚCIOWO ZROBIONE

`results-vnext-roi-full-tool` scalony w jedną kartę o 13:24. Zostają
`results-vnext-roi-model` i `results-vnext-roi-pir-outcomes` — właściciel mówi wprost,
że to konsekwencja tej samej decyzji: każda analiza ROI, łącznie z modelem, to jedna karta.

---

## K8 · Generatory szablonów — „nie wiem, po co on jest" · 4 uwagi · DO ROZSTRZYGNIĘCIA

`gen-word-content-hints`, `gen-deck-content-hints`, `gen-excel-templates-tab`,
`prezentacje-template-states`. Właściciel opisał docelowy przepływ: generator →
„generuj szablon" → szablon ląduje na liście szablonów. Ekrany pośrednie uznaje
za pozostałość pierwszych prób.

---

## K9 · „Nie wiem, co to jest / gdzie to się uruchamia" · 4 uwagi · WYMAGA WERYFIKACJI KLIKIEM

`admin-command-center-panel`, `standard-module-bar-children`, `zwornik-projects`,
`audyty-drd-report`. To nie są uwagi o wyglądzie — to brak opisu drogi dojścia.
Opisy `gdzie` w rejestrze powstały z czytania kodu, nie z klikania. Do weryfikacji klikiem.

---

## K10 · Podglądy niezgodne ze standardem · 4 uwagi · DO NAPRAWY

`assessment-five-surfaces`, `idea-table`, `interview-preview-canon`, `preview-4-zakladki`.
Właściciel: *„to jest wartościowy obrazek, bo pokazuje, jak nieporównywalne są podglądy,
które powinny być takie same"*. Kanon: `docs/ui-standards/` + skill `consultify-preview`.

---

## K11 · Pojedyncze poprawki graficzne · 12 uwag · DO NAPRAWY, tanie

`calendar-sync-settings` (dodać Outlooka, zmienić ikonę jabłka) · `results-vnext-okr-registry`
(przycisk „Nowe OKR" w prawym górnym rogu zamiast innych) · `word-intake-uselm-default`
(przyciski wg standardu) · `teresa-confirm-chip` (okno delikatniejsze, mniej toporne) ·
`teresa-chipy-sugestii` (kontekstowe włączanie/wyłączanie) · `materialy-launcher`
(„mogłoby być bardziej seksowne") · `results-vnext-teresa-okr-reflection` (stara grafika) ·
`agent-plan-canvas` (sekcje mają startować zwinięte) · `karta-initiative` (brak przycisku AI
w górnym pasku) · `karta-tool` (jeden przykład w jednej kolumnie wygląda bez sensu) ·
`interview-creator-shell` (wielkość ścianek, czcionki) · `prawy-panel-szyna-ikon`.

---

## K12 · Do przemyślenia produktowo, nie graficznie · 8 uwag

`assessment-output-report` (raport z oceny ma mieć sformalizowaną strukturę: wstęp →
7 osi, każda z obszarem → odpowiedzi i wnioski → podsumowanie) · `assessment-presentation-view`
(raport bez macierzy i opisów) · `capacity-advisor-a3` (ma być tabela + przycisk „Twórz raport",
raport na konkretną chwilę) · `plan-scenario-d1` (wybrany wiersz otwiera tabelę pod tabelą
zamiast karty) · `drd-library-entry` (brak podglądu, złe kolumny) · `idea-confidentiality-control`,
`idea-table-record-templates`, `tools-swot-session-workspace` (prehistoryczna karta).

---

## Rachunek

| klaster | uwag | stan |
| --- | --- | --- |
| K1 szerokość tabel | 8 | przyczyna była w stanowisku pomiarowym, naprawione — brak dowodu dla właściciela |
| K2 angielski | 2 | w naprawie |
| K3 ucięta kolumna | 2 | w naprawie |
| K4 Finanse | 10 | 9 z pustego wariantu, 1 realny defekt w naprawie |
| K5 macierz | 2 | zmierzone, czeka decyzja którą z pięciu |
| K6 arkusz/prezentacja | 6 | do zaplanowania |
| K7 ROI | 3 | 1 z 3 zrobione |
| K8 generatory | 4 | do rozstrzygnięcia |
| K9 „nie wiem gdzie to jest" | 4 | weryfikacja klikiem |
| K10 podglądy | 4 | do naprawy |
| K11 drobne graficzne | 12 | do naprawy, tanie |
| K12 produktowe | 8 | poza torem grafiki |

Suma pozycji w klastrach jest większa niż 63 — kilka uwag należy do dwóch klastrów naraz
(np. `plan-scenario-d1` do K1, K3 i K12).

## Wniosek najważniejszy

**Z 63 uwag właściciela znaczna część nie jest defektem produktu, tylko skutkiem tego,
że pokazano mu zły obraz** — wąską ramkę harnessu (K1, 8 uwag) albo pusty wariant bez
parametrów (K4, 9 uwag). To siedemnaście z sześćdziesięciu trzech. Nie znaczy to, że
uwagi były błędne — znaczy, że **wina leży po stronie stanowiska pomiarowego i to ono
wymaga naprawy w pierwszej kolejności**, inaczej następna partia zrzutów skłamie tak samo.

---

# DECYZJE WŁAŚCICIELA PODJĘTE PODCZAS TEJ SESJI

## D-1 · Macierz oceny = SIEDEM OSI (2026-08-30, wieczór)

Pytanie: którą z pięciu istniejących w kodzie macierzy robimy tą jedyną.
**Odpowiedź właściciela: „Tak, 7 osi."**

Wybrany kierunek: `src/components/Reports/EmbeddedMatrix.tsx` (543 linie) — siedem osi
DRD ze **zmienną liczbą poziomów per oś** (7 dla Procesów i Danych, 5 dla pozostałych).
To jedyna implementacja odpowiadająca opisowi właściciela („przedstawienie graficzne
na wszystkich osiach ze zmiennymi osiami").

Co z tego wynika do zrobienia:
1. Flaga `isDrdReportEnabled` (`src/utils/drdReportFlag.ts:69`) jest domyślnie **wyłączona**,
   a zmienna `VITE_DRD_REPORT_ENABLED` nigdzie nie ma przypisanej wartości → macierz
   jest dziś nieosiągalna. Zrzut przed jakąkolwiek decyzją o włączeniu.
2. `FrozenOutputHttpView` (`DrdHttpMethodWorkspaceScreen.tsx:977`) usuwa macierz z ekranu
   po zamrożeniu sesji — czyli dokładnie wtedy, gdy ma wejść do raportu.
3. Cztery pozostałe implementacje (`DRDMatrixSession`, `HeatmapMatrix`, `GapHeatmap`,
   `AreaMatrixTable` — razem ~1900 linii) idą do `ODLOZONE.md` zgodnie z regułą nr 5:
   **kod zostaje na miejscu**, zapisujemy dlaczego martwy, co niósł wartościowego,
   jak przywrócić.

**Właściciel wskazał źródło merytoryczne:** *„znajdziesz w repozytorium, gdzieś
w dokumentach moją książkę, która dokładnie tę metodologię opisuje"*. Ten dokument
jest nadrzędny wobec tego, co dziś jest w kodzie — nazwy osi, obszary analityczne
i poziomy bierzemy z niego, nie z implementacji.
