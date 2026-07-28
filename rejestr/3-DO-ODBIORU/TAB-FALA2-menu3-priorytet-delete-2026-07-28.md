# TAB-FALA2 — Fala tabel: Menu 3, priorytet, Delete, nagłówki, Sejf (2026-07-28)

**Stan:** do odbioru Piotra
**Gałąź:** `fix/tabele-fala2-2026-07-28` (worktree `/private/tmp/tabele-fala2`), baza `origin/demo` `b951f7cf81`
**Ekran odbioru:** `?screen=tabele-fala2-przed-po` na porcie **3450** (`/loop` niepotrzebny — serwer stoi)
**NIE wypchnięte na demo** — czeka na akcept.

---

## Co zostało naprawione (6 commitów)

| # | Znalezisko z przeglądu | Skala | Jak naprawione |
|---|---|---|---|
| 1 | **P-10 / P-20 / P-22 / P-27** — po prawej stronie Menu 3 stały przyciski nie-AI | 4 moduły, ~10 ekranów | Zostaje wyłącznie przycisk AI (kanon A3). `Generate Report` i `Initiative Pack` wołały DOKŁADNIE te same handlery co CTA Menu 2 — łamały też D-01 |
| 2 | **PILNE-10 / N-83** — `Delete` jako pierwszy przycisk stopki podglądu | 5 ekranów | Reguła wymuszona w `StandardPreview`, nie łatana per ekran. 16 plików podaje `resolutions` z wariantem `destructive` — żaden nie ma już jak jej złamać |
| 3 | **N-24 / N-29 / N-79** — priorytet jako wypełniona pigułka | 9 tabel | Nowy SSOT `standard/PriorityCell`; `PriorityChip` (karmi 6 tabel) przestał opakowywać treść w `ChipBase`. Zapis `MEDIUM`/`medium`/`Medium` znormalizowany |
| 4 | **Nagłówki po polsku wśród angielskich** (`TYP`, `TRYB`) | 3 zakładki Documents | Przyczyną były DWIE wartości w angielskim pliku i18n, nie kod ekranu |
| 5 | **PILNE-6** — Menu 3 Sejfu i Run agent pokazywało liczniki cudzych modułów | 2 ekrany | Oba spadały na wspólny fallback „alerty z innych zakładek". Pasek się nie renderuje, dopóki te tabele nie mają własnych filtrów |
| 6 | **P-17 / D-06** — czwarta warstwa nagłówkowa Sejfu | 1 ekran | `ClientDocumentsVault` renderował własny `StandardModuleBar` wewnątrz zakładki, która ma już Menu 1/2/3 → drugi breadcrumb i DRUGA wyszukiwarka. Fraza idzie teraz z lupy Menu 2 hosta |

## Bramki

- `tsc --noEmit` z 8 GB po każdej zmianie: **3697 plików z `src/`, 0 błędów, zero FATAL**
  (sprawdzane `--listFiles`, żeby nie powtórzyć pomyłki z 07-27, gdy wysypany tsc udawał czysty wynik)
- 3 nowe testy-strażniki: `standardPreviewActionOrder` (6/6), `priorityCellCanon` (5/5),
  `naglowkiKolumnJezyk` (5/5)
- `check-list-canon`, `check-triada`, `check-artefakt`, `check-gestosc` — bez nowych naruszeń
- **Render-verify mój, przed Piotrem** (reguła #7): light + dark, zrzuty zrobione

## Do przeklikania / obejrzenia

1. Ekran PRZED/PO na `:3450` — trzy sekcje, w tym kontrola regresji Approve/Reject
2. `My Work → Inbox` — Menu 3 ma po prawej sam `AI Triage`, a `Done` zszedł na lewo jako filtr
3. `My Work → Sejf klienta` — jedna wyszukiwarka zamiast dwóch, bez chipów z cudzych modułów
4. `Tools → Assessment/Reports/Initiatives` — Menu 3 bez trzech nadmiarowych przycisków

## Świadomie NIE zrobione (i dlaczego)

- **Finance `Analyze ⌄`** — zawiera unikalne funkcje (Modelowanie, Budżetowanie, Finance Lane).
  Jego miejsce rozstrzyga **D-05** (narzędzia do karty pozycji), nie mechaniczne cięcie.
- **Run agent — czwarta warstwa** — jej pasek niesie realną treść (przełącznik `Moje procesy |
  Szablony` + CTA + tryb masowy). Przeniesienie do paska hosta to przebudowa przepływu; osobny krok.
- **Documents → Sheets `Sheets | Data sources`** (D-06) — jak wyżej.
- **Jeden format daty** (N-7/N-13/N-78/N-94, 6 formatów) — nie zaczęte.
- **641 nagłówków `<th>` bez `uppercase`** — to tabele wewnątrz artefaktów (SPEC-A), nie listy (C6).

## Cofnięcie

Nic nie poszło na demo. Gałąź `fix/tabele-fala2-2026-07-28`; demo stoi na `b951f7cf81`.
