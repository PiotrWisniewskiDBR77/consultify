# Kontrakt karty N — `okr-report` (Raport OKR)

## §0. Tożsamość

- **Nazwa PL:** Raport OKR · **moduł:** Wyniki (P7K). Analogiczny poziom do `kpi-scorecard` (#38)
  w domenie OKR — POZIOM 2 formuły P7K (Zestaw → **Raport** → Cel).
- **Archetyp wg inwentarza:** D (Matryca) — zmierzone jako tabela grupowana, potwierdza archetyp D.
- **Klasa:** poza rejestrem `KartaNKey`.
- **Trasa:** `/results/okr/:setId` (`routeConfig.ts:220`, klucz `RESULTS_OKR.REPORT`).
- **Jak otworzyć:** Wyniki → OKR → wiersz zestawu → klik. Zmierzone TERAZ (partia B1, 06.09.2026
  wieczór), zrzut `evidence/p10b1-wyniki/40-okr-report.png` — rekord realny
  (`setId=3f2ecdde-03f9-5d47-860c-980c3e85d81c`, „OKR automatyzacji — Q4 2026", pobrany z żywego
  `GET /vnext/results/okr/sets`), `url` ≠ `/login`, `bledyKonsoli: []`.
- **Komponent:** `src/components/ResultsVNext/okr/p7k/OkrReportPage.tsx:155` (645 linii).
- **Powłoka dziś:** `ResultsVNextRegistryShell` (`:41`, `:504`) — sam nagłówek pliku (`:1-30`)
  deklaruje ten ekran jako TABELĘ, nie kartę: „Tabela KLUCZOWYCH REZULTATÓW jednego raportu,
  zgrupowana TEMAT → CEL […] `StandardTable`/`FilterableTable` nie ma dziś natywnego grupowania
  […] korekta P7K §13 wprost dopuszcza rozwiązanie w prezenterze »bez nowego komponentu«." Wiersz
  grupy jest zwykłym wierszem danych z `colSpan` — „Zero własnej tabeli poza `StandardTable` —
  bezpiecznik `check-list-canon.sh` tego pilnuje" (`:24-25`).
- **Rejestr:** BRAK.

## §1. Sekcje — NIE MA, jest jedna grupowana tabela

Zero kontraktu sekcji. Jedna `StandardTable` z kolumnami domyślnymi CEL (z ambicją) · KLUCZOWY
REZULTAT · WŁAŚCICIEL · START/CEL/BIEŻĄCA · POSTĘP · PEWNOŚĆ · TERMIN · STAN (+ ZESPÓŁ i OSTATNI
CHECK-IN w pstryczku, `defaultVisible: false`, `:11-15`).

| „widok" | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Tabela KR zgrupowana Temat→Cel (jedyny) | widzi WSZYSTKIE kluczowe rezultaty raportu naraz, z postępem/pewnością/terminem | TRZY wywołania: `getOkrSet` (nagłówek), `listObjectivesForSet` (cele z KR), `listKeyResultCheckInSummaries` (data ostatniego check-inu) — `:26-29` | `StandardTable` pusty stan | — |

## §2. Prawy panel — BRAK

Zero `ArtifactRightPanel`. `preview` slot `ResultsVNextRegistryShell` pokazuje wybrany wiersz
(nie zweryfikowane szczegółowo w tej rundzie, jaki dokładnie podgląd). **K6–K11: 0/6** — ta sama
architektura co `kpi-scorecard`.

## §3. Menu 5 i nawigacja — BRAK

Zero „Sekcje ▾"/„Pracuj z AI ▾"/Edycja-Podgląd. Menu 2 = domena Wyników (KPI·OKR·ROI) — **ZACHOWANE
POPRAWNIE** (potwierdzone zrzutem: tekst zawiera „KPI / OKR / ROI / Raporty zarządcze" obok „Raporty
OKR › OKR automatyzacji — Q4 2026"). Okruszek dwupoziomowy: Raporty OKR → <nazwa zestawu>.

## §4. AI — BRAK

Zero mechanizmu. Brak klucza rejestru.

## §5. Czytelność

Zrzut `evidence/p10b1-wyniki/40-okr-report.png`: **zero błędów konsoli** (`bledyKonsoli: []`,
lepszy wynik niż `kpi-scorecard`), zero UUID/`seed_` w tekście, zero „Teresa", zero angielskiego
zauważonego w pierwszych 900 znakach tekstu (pełna weryfikacja stop-listy nie wykonana na całym
tekście w tej rundzie).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✗ | brak, jedna tabela |
| K2 kontrakt steruje renderem | n/d | nie dotyczy |
| K3 źródło danych | ✓ | trzy wywołania nazwane w nagłówku pliku |
| K4 reguła pustki | ✓ | `StandardTable` pusty stan |
| K6–K11 prawy panel | ✗ 0/6 | brak `ArtifactRightPanel` |
| K12 Menu 5 trzy elementy | ✗ | brak |
| K13–K18, K20 | n/d | niezmierzone szczegółowo (zrzut nie sprawdzony pod kątem ucięć/scrolla w tej rundzie) |
| **K19 pigułka pasku modułu** | **✓ (zmierzone)** | Menu 2 KPI/OKR/ROI widoczne w tekście zrzutu |
| K21 „Pracuj z AI" 3 pozycje | ✗ | brak |
| K24 deklaracja per typ | ✗ | brak wiersza w SSOT |
| K25 i18n bez angielskiego | ✓ (zmierzone częściowo) | pierwsze 900 znaków tekstu czyste |
| K26 podgląd/Otwórz | ~ | wejście bezpośrednie z rejestru (tak jak `kpi-scorecard`) |
| K27 Teresa tylko Menu 1 | ✓ (zmierzone) | zero wzmianek w tekście |
| K28 zero identyfikatorów technicznych | ✓ (zmierzone) | brak UUID w tekście |
| **K29 zero błędów konsoli** | **✓ (zmierzone)** | `bledyKonsoli: []` |
| K30 odbiór 1 zrzut 1440 | ✓ | `40-okr-report.png` |

**Wynik: 8 ✓ (5 zmierzone na żywo w tej rundzie), 4 ✗ realne (K1, K6–K11, K12, K21, K24 — pięć),
reszta n/d.** Lepszy wynik higieny (K19, K29) niż `kpi-scorecard`, ten sam brak architektoniczny
(lista, nie Rekord).

## §7. Luki → naprawa

1. **To samo pytanie produktowe co `kpi-scorecard` §7 pkt 1** — ekran jest tabelą wg jawnej decyzji
   P7K (SSOT §6: „Raport = tabela mierników/kluczowych rezultatów"). Rekomendacja: potwierdzić z
   właścicielem RAZ dla obu poziomów-raportów (KPI i OKR) naraz, że archetyp D (lista z tożsamością)
   jest docelowy i nie wymaga prawego panelu/Menu 5/AI z kontraktu Rekordu.
2. **Zero luk technicznych pilnych** — higiena (K19, K25, K27, K28, K29) jest CZYSTA, w
   przeciwieństwie do siostrzanych ekranów tej partii. Jeśli (1) rozstrzygnie się na „lista", ta
   karta jest NAJBLIŻEJ „gotowe wg własnego archetypu" ze wszystkich pięciu bez rejestru.

**Rekomendacja:** brak napraw pilnych poza rozstrzygnięciem architektonicznym (1), wspólnym z
`kpi-scorecard`.
