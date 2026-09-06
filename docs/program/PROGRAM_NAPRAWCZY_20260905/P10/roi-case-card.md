# Kontrakt karty N — `roi-case-card` (Karta analizy ROI, rejestr `roi_case`)

## §0. Tożsamość

- **Nazwa PL:** Karta analizy ROI · **moduł:** Wyniki (P7K).
- **Archetyp:** C (Rekord) · **klasa:** L (`registry.ts:219-228`: TRZY sekcje, ale pełnostronicowa —
  „SPEC-N §2.1 wiąże klasę ze SPOSOBEM OTWIERANIA, nie tylko z liczbą sekcji", komentarz w rejestrze).
- **Trasa:** `/results/roi/:roiCaseId` (`routeConfig.ts:196`, klucz `RESULTS_ROI.CARD` — „karta jest
  do CZYTANIA analizy, narzędzie do jej edycji", odróżnia od #44 `roi-case-tool`).
- **Jak otworzyć:** Wyniki → ROI → wiersz sprawy (np. „Automatyzacja magazynu WIP") → klik/„Otwórz".
  Zmierzone na żywo 06.09.2026, zrzut `evidence/p10-matryca/14-roi.png`.
- **Komponent:** `src/components/ResultsVNext/roi/card/RoiCaseCardPage.tsx:103` (759 linii).
- **UWAGA — DWA różne kontrakty sekcji w katalogu `roi/`, nie mylić:**
  `RoiCaseCardSections.ts` (166 linii, 5 sekcji/17 podwidoków) jest importowany WYŁĄCZNIE przez
  workspace'y (`RoiCaseDecisionWorkspace.tsx`, `RoiCaseModelWorkspace.tsx`,
  `RoiCaseRealizeValueWorkspace.tsx`, `RoiCaseLearnWorkspace.tsx`, `RoiPirOutcomesTab.tsx`) i przez
  `RoiCaseFullTool.tsx` (= #44, patrz `roi-case-tool.md`) — **NIE przez ten plik**. Ta karta
  (`RoiCaseCardPage.tsx`) buduje WŁASNY, prostszy spec inline: `zalozenia`/`wyliczenia`/`realizacja`
  (`:557-566`). Zweryfikowane grepem: zero importów `RoiCaseCardSections` w `RoiCaseCardPage.tsx`.
- **Powłoka dziś:** `NModeShell` + `ArtifactRightPanel` przez `KartaWynikowChrome`
  (`RoiCaseCardPage.tsx:648-755`, nagłówek pliku l.9-18 uzasadnia bezpośrednie użycie zamiast
  `StandardArtifactShell`, tak samo jak metric).
- **Rejestr:** `roi_case` w `KartaNKey` (`registry.ts:50`), `statusMigracji: 'przed'`.

## §1. Sekcje

Trzy sekcje z inline `zbudujSpecSekcji` (`RoiCaseCardPage.tsx:557-566`):

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Założenia (`zalozenia`) | baseline, polityka liczenia | `roiApi.ts`/`roiCaseDetailApi.ts` (GET case detail) | niezmierzone co do writera w tej rundzie | 1 | L |
| Wyliczenia (`wyliczenia`) | przebiegi kalkulacji, koszty/korzyści | `roiCaseDetailApi.ts` (agregat) | j.w. | 2 | L |
| Realizacja (`realizacja`) | wykonania vs prognoza, PIR | `roiCaseDetailApi.ts` | j.w. | 3 | L |

Karta jest jawnie READ-ONLY: przycisk „Otwórz pełne narzędzie ROI" w sekcji Akcje kieruje na
`ROUTES.RESULTS_ROI.CASE` (#44), z tekstem: „Ta karta jest do czytania analizy. Wprowadzanie pozycji…
robi się w pełnym narzędziu" (`:263-269`). To jest ŚWIADOMA architektura, nie luka.

## §2. Prawy panel — CZTERY sekcje, dwie brakują

| sekcja | obecna? | plik:linia |
|---|---|---|
| Akcje | ✓ | `:246-270` |
| Właściwości (tabela) | ✓ | `:271-282` |
| Powiązania | ✓ | `:283-297` (link do inicjatywy) |
| Źródła i założenia | ✓ | `:306-322` (baseline.source, calculationPolicy.notes) |
| **Komentarze** | **✗ BRAK** | grep zero trafień `id: 'comments'` w tym pliku |
| **Historia** | **✗ BRAK** | grep zero trafień `id: 'history'` w tym pliku |

Ta sama luka co `objective` (K6–K11 4/6, brak Komentarzy i Historii), ale BEZ komentarza-obietnicy
w kodzie tego pliku (w przeciwieństwie do `OkrObjectiveCardSections.ts`, ten plik nie deklaruje,
że te sekcje „mieszkają gdzie indziej" — po prostu ich nie ma).

## §3. Menu 5 i nawigacja

- Menu 5: `sectionsMenu` + `PracujZAI` (`:701-733`).
- Edycja/Podgląd nieobecne, ZGODNIE z K14 — karta jest z definicji tylko do odczytu (§1 wyżej),
  powód wypisany w sekcji Akcje. Matryca #14: „✓ ZGODNIE z K14".
- Klasa L pomimo 3 sekcji — uzasadnienie w rejestrze (`:219-228`): pełnostronicowa, nie drawer.

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Realizacja | rubryka `cardAnalysisRubric.ts:745-770` (4 kryteria: baseline, jawność założeń, rekomendacja z warunkiem, rozliczenie po wdrożeniu) | pola z `roiPolaSekcji(id)` filtrowane przez `SEKCJE_Z_POLAMI_TEKSTOWYMI` | j.w. | wyliczenia, przepływy, realizacja/PIR (deklaracja rubryki) |

Zapis przez wspólny `useZapisPolAI` (`kartaWynikow.tsx`) — propozycja→Zatwierdź. Zmierzone na żywo:
„✓ (read-only)" (matryca #14).

## §5. Czytelność

Niezmierzone osobno w tej rundzie; zrzut istniejący `14-roi.png` czysty wg matrycy (K25 ✓).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✓ | inline `zbudujSpecSekcji` (`:557-566`) |
| K2 kontrakt steruje renderem | ✓ | brak flagi blokującej |
| K3 źródło danych per sekcja | ~ | writer nie zweryfikowany plik:linia w tej rundzie (agregat `roiCaseDetailApi.ts`, bez konkretnej linii) |
| K4 reguła pustki | ~ | `isEmpty` na sekcji Źródła (`:306`); pozostałe niezmierzone |
| **K6–K11 prawy panel** | **~ 4/6** | Komentarze i Historia brakują (patrz §2) |
| K12 Menu 5 trzy elementy | ~ | Sekcje ▾ + Pracuj z AI ▾; Edycja/Podgląd ZGODNIE nieobecne |
| K13–K15, K17, K18, K20, K28, K29 | n/d | brak nowego pomiaru w tej rundzie |
| K14 Edycja/Podgląd wg prawa | ✓ | powód wypisany w sekcji Akcje |
| K16 klasa S/L zgodna | ✓ | L, uzasadnione sposobem otwierania |
| K19 pigułka pasku modułu | ✓ | `KartaWynikowChrome` |
| K21 „Pracuj z AI" 3 pozycje | ✓ | |
| K22 propozycja→Zatwierdź | ✓ | |
| K23 po polsku, wg uprawnień | ✓ | |
| K24 deklaracja per typ | ✓ | tabela K24 SSOT wypełniona dla `roi_case` |
| K25 i18n bez angielskiego | ✓ (zmierzone) | matryca #14 |
| K26 podgląd/Otwórz | ✓ | „Otwórz pełne narzędzie ROI" |
| K27 Teresa tylko Menu 1 | ✓ | komentarz kodu potwierdza usunięcie (`:243-245`, DEC-419) |
| K30 odbiór 1 zrzut 1440 | ✓ | `14-roi.png` |

**Wynik: 12 ✓, 2 częściowe rzeczywiste (K3, K4), 1 luka realna (K6–K11), reszta n/d.**

## §7. Luki → naprawa

1. **PRAWY PANEL — Komentarze i Historia brakują.** Rozmiar M: dopisać dwa bloki wzorem
   `KpiToolPage.tsx:1167-1198` (Komentarze: jawnie pominięte z powodem, jeśli ROI API nie ma
   wątku komentarzy — sprawdzić `roiApi.ts`; Historia: log zdarzeń sprawy, jeśli istnieje, inaczej
   jawny powód). Ta sama naprawa co `roi-case-tool.md` §7 (ten plik JUŻ ma komplet 6/6 w #44 —
   można skopiować wzorzec bezpośrednio stamtąd, patrz `roi-case-tool.md` §2).
2. **K3 — writer bez linii.** Rozmiar S: doprecyzować plik:linia w `roiCaseDetailApi.ts`.

**Rekomendacja:** naprawa (1) jest tania (M) i ma gotowy wzorzec w SIOSTRZANYM pliku tego samego
katalogu (`RoiCaseFullTool.tsx`, patrz `roi-case-tool.md`) — nie wymaga decyzji właściciela.
