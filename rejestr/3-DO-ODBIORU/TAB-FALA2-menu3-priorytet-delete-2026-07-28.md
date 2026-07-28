# TAB-FALA2 — Fala tabel: Menu 3, priorytet, Delete, nagłówki, Sejf (2026-07-28)

**Stan:** do odbioru Piotra
**Gałąź:** `fix/tabele-fala2-2026-07-28` (worktree `/private/tmp/tabele-fala2`), baza `origin/demo` `b951f7cf81`
**Ekran odbioru:** `?screen=tabele-fala2-przed-po` na porcie **3450** (`/loop` niepotrzebny — serwer stoi)
**NIE wypchnięte na demo** — czeka na akcept.

---

## Co zostało naprawione (8 commitów)

| # | Znalezisko z przeglądu | Skala | Jak naprawione |
|---|---|---|---|
| 1 | **P-10 / P-20 / P-22 / P-27** — po prawej stronie Menu 3 stały przyciski nie-AI | 4 moduły, ~10 ekranów | Zostaje wyłącznie przycisk AI (kanon A3). `Generate Report` i `Initiative Pack` wołały DOKŁADNIE te same handlery co CTA Menu 2 — łamały też D-01 |
| 2 | **PILNE-10 / N-83** — `Delete` jako pierwszy przycisk stopki podglądu | 5 ekranów | Reguła wymuszona w `StandardPreview`, nie łatana per ekran. 16 plików podaje `resolutions` z wariantem `destructive` — żaden nie ma już jak jej złamać |
| 3 | **N-24 / N-29 / N-79** — priorytet jako wypełniona pigułka | 9 tabel | Nowy SSOT `standard/PriorityCell`; `PriorityChip` (karmi 6 tabel) przestał opakowywać treść w `ChipBase`. Zapis `MEDIUM`/`medium`/`Medium` znormalizowany |
| 4 | **Nagłówki po polsku wśród angielskich** (`TYP`, `TRYB`) | 3 zakładki Documents | Przyczyną były DWIE wartości w angielskim pliku i18n, nie kod ekranu |
| 5 | **PILNE-6** — Menu 3 Sejfu i Run agent pokazywało liczniki cudzych modułów | 2 ekrany | Oba spadały na wspólny fallback „alerty z innych zakładek". Pasek się nie renderuje, dopóki te tabele nie mają własnych filtrów |
| 6 | **P-17 / D-06** — czwarta warstwa nagłówkowa Sejfu | 1 ekran | `ClientDocumentsVault` renderował własny `StandardModuleBar` wewnątrz zakładki, która ma już Menu 1/2/3 → drugi breadcrumb i DRUGA wyszukiwarka. Fraza idzie teraz z lupy Menu 2 hosta |
| 7 | **N-7 / N-13 / N-54 / N-78 / N-94** — sześć formatów daty | globalne | Przyczyna: **270 wywołań `toLocaleDateString()` bez locale** — format brał się z przeglądarki, nie z konta. Nowy SSOT `utils/listDateFormat.ts`, jeden wzorzec `DD/MM/YYYY`. Źródłem `7/21/2026` z Sessions była generowana nazwa sesji |
| 8 | **P-28 / D-06** — czwarta warstwa w Sheets | 1 ekran | Przełącznik `Sheets \| Data sources` przeniesiony do Menu 2 (prawa strona), zgodnie z dosłowną prośbą Piotra. Tabela podnosi się o ~44px |

## Bramki

- `tsc --noEmit` z 8 GB po każdej zmianie: **3697 plików z `src/`, 0 błędów, zero FATAL**
  (sprawdzane `--listFiles`, żeby nie powtórzyć pomyłki z 07-27, gdy wysypany tsc udawał czysty
  wynik). Bramka zarobiła na siebie: złapała usunięte `t` w `SheetsTabContent`, którego esbuild
  nie widzi.
- 5 nowych plików-strażników, **26/26 zielone**: `standardPreviewActionOrder` (6),
  `priorityCellCanon` (5), `naglowkiKolumnJezyk` (5), `listDateFormat` (6),
  `sheetsSubviewWarstwa` (4)
- `check-list-canon`, `check-triada`, `check-artefakt`, `check-gestosc` — bez nowych naruszeń
- **Render-verify mój, przed Piotrem** (reguła #7): light + dark, zrzuty zrobione

## Do przeklikania / obejrzenia

1. Ekran PRZED/PO na `:3450` — trzy sekcje, w tym kontrola regresji Approve/Reject
2. `My Work → Inbox` — Menu 3 ma po prawej sam `AI Triage`, a `Done` zszedł na lewo jako filtr
3. `My Work → Sejf klienta` — jedna wyszukiwarka zamiast dwóch, bez chipów z cudzych modułów
4. `Tools → Assessment/Reports/Initiatives` — Menu 3 bez trzech nadmiarowych przycisków

---

## ★★★ ZNALEZISKO DO DECYZJI: `MyWorkHub` ma własne menu, nie kanoniczne

Bramka `check-list-canon` (reguła R2b) wskazuje **1 hub z 12** renderujący listy
bez `StandardModuleBar` — i jest to **`MyWorkHub.tsx`, 4152 linie, 10 zakładek**
(Ideas · Notebook · Inbox · Calendar · Tasks · Decisions · Sejf · Run agent · Manager · Home).
Czyli moduł, w którym spędzasz najwięcej czasu, ma **bespoke pasek Menu 2** zamiast fasady.

**To wyjaśnia część uwag z przeglądu jednym powodem, nie ośmioma:**
- dublet CTA „New Idea" + „+ New" (P-1) — bespoke pasek nie miał kontraktu „jeden CTA"
- `Priority` niższy od sąsiednich przycisków (P-15) — brak wymuszonego `h-9`
- brak segmentu widoków w Notebook, inny w Ideas, inny w Tasks (N-5)
- czwarta warstwa Run agent — jego kontrolki nie mają gdzie wsiąść w legacy pasku

**Dlaczego NIE zrobiłem tego dzisiaj:** to migracja pliku na 4152 linie, a dokładnie
taka migracja 15 hubów z 07-26 dała **trzy regresje propów** (React po cichu ignoruje
nieznane propy — zniknął przełącznik widoków w 11 hubach i karty Menu 3 w 13).
Koszt tamtej pomyłki: dzień. To praca na osobną, etapową falę z render-verify
per zakładka — nie doklejka do fali kosmetycznej.

**Rekomendacja:** następny duży krok po Twoim akcepcie tej fali.

---

## Dług zastany, NIE moja regresja (zweryfikowane)

Testy `tests/components/ReportsAndPresentations/` — **24 czerwone / 59 zielonych**.
Sprawdzone w osobnym worktree na czystym `origin/demo`: **identyczny wynik**
(24/59). Czyli moduł Documents ma ten dług na demo od wcześniej. Do zbadania osobno.

---

## Świadomie NIE zrobione (i dlaczego)

- **Finance `Analyze ⌄`** — zawiera unikalne funkcje (Modelowanie, Budżetowanie, Finance Lane).
  Jego miejsce rozstrzyga **D-05** (narzędzia do karty pozycji), nie mechaniczne cięcie.
- **Run agent — czwarta warstwa** — jego pasek niesie realną treść (przełącznik `Moje procesy |
  Szablony` + CTA + tryb masowy). Przeniesienie go do **legacy** paska `MyWorkHub` znaczyłoby
  napisać segment drugi raz, w kodzie, który i tak ma zniknąć. Wchodzi w migrację `MyWorkHub`
  na `StandardModuleBar` (znalezisko wyżej) — tam kontrolki wsiądą w `filterControls` fasady
  bez reimplementacji.
- **`Show drafts` w Menu 2 Documents** (P-27) — na zrzucie wygląda jak duplikat chipa `Draft`
  z Menu 3, ale steruje **pobieraniem danych z serwera** (`fetchReports(showDrafts)` + trzy
  siostrzane wywołania), a chipy filtrują lokalnie. To nie duplikat — zostaje.
- **Finance `Analyze ⌄`** — j.w., rozstrzyga D-05.
- **641 nagłówków `<th>` bez `uppercase`** — to tabele wewnątrz artefaktów (SPEC-A), nie listy (C6).
- **248 pozostałych `toLocaleDateString()`** poza ekranami listowymi — przepięte 22 tam, gdzie
  przegląd wskazał rozjazd. Reszta (artefakty, raporty, panele admina) osobno, żeby nie mieszać
  fal.

## Cofnięcie

Nic nie poszło na demo. Gałąź `fix/tabele-fala2-2026-07-28`; demo stoi na `b951f7cf81`.
