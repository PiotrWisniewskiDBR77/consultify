# Kontrakt karty N — `finance-analysis` (Analiza finansowa)

## §0. Tożsamość

- **Nazwa PL:** Analiza finansowa (zakładka: „Analiza") · **moduł:** Finanse (nie zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM.** Program F: `F‑P4` (producent
  definicji analizy + wiersze selekcji KPI) i `F‑P5` (krawędź z kreatora, flaga ON) są Fala 2.
  Ta karta jest jednak — po statement-pack — **najbardziej realnie działająca karta Finansów w
  tej rundzie pomiaru**: ma prawdziwe dane, prawdziwy silnik wskaźników i jest wymieniona wprost
  w ścieżce odbioru zlecenia B7 (Sprawozdania → CD PROJEKT → Otwórz → pakiet → Analiza).
- **Archetyp:** D (Matryca) — tabela wskaźników z drill-down kartą boczną (patrz `finance-kpi-card.md`,
  #51, otwierana STĄD).
- **Trasa:** `/finance/analyses/:id` (`AppRoutes.tsx:2471`), `:id` = `businessVersionId`.
- **Jak otworzyć z listy:** Finanse → Analiza → wiersz „Analiza wskaźnikowa 2024–2025 — CD PROJEKT"
  → klik na wiersz **NIE** otwiera podgląd/kartę bezpośrednio z listy prostym klikiem — trzeba
  kliknąć wiersz, potem „Otwórz" (ten sam wzorzec K26 co statement-pack). **Zmierzone na żywo
  06.09.2026 20:4x**: `GET /api/v8/finance-v2/artifacts?artifactType=HISTORICAL_ANALYSIS` →
  `count:1`, rekord „Analiza wskaźnikowa 2024–2025 — CD PROJEKT"
  (`artifactId=fbc655e9-724c-4d20-8fd6-008f7776d5ec`,
  `businessVersionId=d7b0b5de-d43a-42db-9f8f-1edc57bef25f`, `status: DRAFT`, `freshness: CURRENT`).
  Zrzut karty pełnej: `evidence/p10b7-finanse/48-analysis-full.png` — **18 wskaźników realnie
  policzonych** z prawdziwymi wartościami CD PROJEKT (Cykl konwersji gotówki, Wskaźnik gotówkowy,
  płynność bieżąca/szybka, dług/EBITDA, DIO/DPO/DSO, marże EBITDA/FCF/brutto/netto/operacyjna,
  pokrycie odsetek, dynamika przychodów, ROA, ROE) — dokładnie te 18 wskaźników, o których mówi
  zlecenie B7 („analiza 18 wskaźników").
- **Komponent:** `src/components/Finance/Analysis/AnalysisWorkspace.tsx:128` (626 linii) +
  `AnalysisKpiTable.tsx` (140 linii, `StandardTable`-based per inwentarz) +
  `AnalysisKpiDetailCard.tsx` (drill-down, patrz #51).
- **Powłoka dziś:** `FinanceWorkspaceBar` (bespoke). Flaga `financeAnalysisWorkspaceV1`
  (`useFinanceAnalysisWorkspaceFlag.ts:24`, `defaultValue: true` — **domyślnie ON od F‑P5,
  05.09.2026**). **Komentarz nagłówkowy pliku jest STARY**: `AnalysisWorkspace.tsx:26-28` twierdzi
  „UI za flagą `financeAnalysisWorkspaceV1`, domyślnie OFF" — to jest NIEAKTUALNE od F‑P5 (ten sam
  kształt „komentarz w kodzie nie zaktualizowany po zmianie flagi" jak w #46 Baseline).
- **Rejestr:** BRAK (jak pozostałe 6 kart Finansów).

## §1. Sekcje (zmierzone na żywo)

| co widać | źródło danych (API) | reguła pustki | uwaga |
|---|---|---|---|
| Nagłówek („Analiza wskaźnikowa 2024–2025 — CD PROJEKT", „v1 · Wersja robocza", „Przekaż do przeglądu") | `FinanceWorkspaceBar` + `getFinanceBusinessVersion` | n/d | brak Menu 5, brak spisu sekcji |
| Tabela 18 wskaźników — kolumny WSKAŹNIK / KATEGORIA / WZÓR / INTERPRETACJA / FY2024 / FY2025 / ZMIANA R/R / BENCHMARK / KOMENTARZ / JAKOŚĆ·DOSTĘPNOŚĆ / PRZEZNACZENIE | `GET /analysis/:id/kpi-values` (komentarz nagłówkowy `:15-17`) | wartości brakujące pokazane jako „—" z powodem w kolumnie KOMENTARZ (np. „Nie policzono: ten wskaźnik wymaga danych kwartalnych…") — **HONEST**, nie zera | `dom.table.liczba=1` (JEDNA duża tabela, 3145px wysokości, semantyczny `<table>` — w przeciwieństwie do #45, tu jest prawdziwy `<table>`!) |
| „ZMIANA R/R" | `yoyDelta.percentDelta.toFixed(1)` (klient) | „—" gdy nie policzono | **BUG zmierzony**: `toFixed(1)` używa kropki dziesiętnej („+2.1%") mimo że reszta tabeli (wartości FY2024/FY2025) używa polskiego przecinka („62,206%") — niespójność formatowania liczb w jednym wierszu tej samej tabeli, zmierzone na `51-kpi-detail.png.json` |
| „Kliknij wiersz → aside z detalem" | patrz `finance-kpi-card.md` | n/d | K26-podobny wzorzec wewnątrz karty (drugi poziom drill-down) |

`includedInReportByKpiCode`/`markedAsModelInputByKpiCode` — **stan WYŁĄCZNIE w pamięci komponentu**,
przyznane wprost w komentarzu nagłówkowym (`:12-15`): `analysis.routes.ts` nie ma endpointu zapisu
tych flag, odświeżenie strony je resetuje. Nie udawane jako trwałe — uczciwy stan, ale realna luka
funkcjonalna (użytkownik zaznacza wiersze „do raportu", a strona traci to po F5).

## §2. Prawy panel

Brak `ArtifactRightPanel` na poziomie KARTY (`dom.aside.liczba=0` na zrzucie tabeli głównej —
`48-analysis-full.png.json`). Jest natomiast `<aside>` na poziomie DRILL-DOWN wiersza (KPI detail
card, patrz #51) — czyli panel boczny istnieje, ale jako WEWNĘTRZNY mechanizm tabeli, nie jako
SPEC-A `ArtifactRightPanel` karty. K6-K11 = 0/6 dla karty jako całości.

## §3. Menu 5 i nawigacja

Brak. Zero „Pracuj z AI"/„Sekcje"/„Edycja-Podgląd" na zrzucie karty pełnej (`grep` na tekście
zrzutu = 0 dla wszystkich trzech, zmierzone `python3` w tej rundzie). K12 = 0/3.

## §4. AI

Brak na poziomie karty i na poziomie drill-down (#51 też nie ma). `AnalysisWorkspace.tsx`/
`AnalysisKpiTable.tsx`/`AnalysisKpiDetailCard.tsx` — zero importów `PracujZAI`/`useCardAIAnalysis`.
Karta poza `CardAnalysisArtifactType` (ten sam typ-level wyjątek, §0 finance-statement-pack).
Lista Analiz ma nagłówek „Analizuj AI" (jak lista Sprawozdań) — nieklikane w tej rundzie, prawdopo-
dobnie bulk-akcja `StandardTable`, nie mechanizm karty N.

## §5. Czytelność

- `grep -c "primary-[0-9]"` na `AnalysisWorkspace.tsx`/`AnalysisKpiTable.tsx`/
  `AnalysisKpiDetailCard.tsx` = **0/0/0**. K17 ✓.
- `grep -in teresa` na tych trzech plikach = 0. K27 ✓.
- Zrzut karty pełnej (18 wskaźników) w 100% polski — zero angielskich literałów w tekście
  zmierzonym, poza terminami metodycznymi dopuszczonymi kanonem (CCC, ROA, ROE, FCF, DIO/DPO/DSO —
  akronimy finansowe, nie angielszczyzna produktowa). `bledyKonsoli: []` na obu zrzutach
  (tabela + drill-down).
- **Bug formatowania liczby zmierzony (§1): `+2.1%` zamiast `+2,1%`.** Rozmiar S, konkretny plik:
  linia — komponent `AnalysisKpiDetailCard.tsx` liczy `yoyDelta.percentDelta.toFixed(1)` wprost
  w JSX (funkcja `AnalysisKpiDetailCard`, sekcja „WARTOŚĆ BIEŻĄCA"), `toFixed()` w JS zawsze zwraca
  kropkę, niezależnie od locale — wymaga formatowania przez `Intl.NumberFormat('pl-PL')` albo
  współdzielony `formatAnalysisKpiValueForDisplay` (już użyty gdzie indziej w tym samym pliku).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta` |
| K3 źródło danych per sekcja | ✓ (jedyna karta Finansów z pełnym, realnym, żywym GET danych — `GET /analysis/:id/kpi-values`) | §1 |
| K4 reguła pustki | ✓ (komunikaty „Nie policzono: …" per wskaźnik, nie zera) | §1 |
| K6-K11 prawy panel (karta) | ✗ 0/6 | §2 |
| K7 „tabela" Właściwość\|Wartość | n/d — nie ten typ tabeli (tabela wskaźników, nie panel właściwości) | — |
| K12 Menu 5 | ✗ 0/3 | §3 |
| K17 zero primary-* | ✓ | §5 |
| K21-K24 AI | ✗ / n/d (poza silnikiem) | §4 |
| K25 i18n | ✓ zmierzone na żywo, poza bugiem formatu liczby (§5, nie jest to i18n literału, to formatowanie liczbowe) | — |
| K26 podgląd/Otwórz | ✓ (ten sam wzorzec listy co #45) | — |
| K27 Teresa tylko Menu 1 | ✓ | — |
| K28 zero identyfikatorów technicznych | ✓ (brak UUID w tekście obu zrzutów) | — |
| K29 zero błędów konsoli | ✓ (`bledyKonsoli: []` na obu zrzutach) | — |
| K30 odbiór na 1 zrzucie z „Pracuj z AI" | ✗ („Pracuj z AI" nie istnieje) | — |

**Wynik: najlepiej zmierzona karta Finansów pod kątem REALNYCH DANYCH (K3/K4/K25/K29 ✓), ale
identycznie zero pod kątem powłoki SPEC-A (K1/K6-K11/K12/K21-K24 ✗) jak pozostałych 6 kart.**

## §7. Luki → naprawa

1. **Bug formatu liczby „+2.1%" vs „+2,1%" (§5).** Rozmiar S, plik:linia
   `AnalysisKpiDetailCard.tsx` (funkcja komponentu, blok „Zmiana r/r"). Nie wymaga decyzji
   właściciela — czysty bug.
2. **`includedInReportByKpiCode` ginie po odświeżeniu (§1).** Rozmiar M — brak endpointu zapisu w
   `analysis.routes.ts`; do rozstrzygnięcia, czy to wchodzi do Fali 2 razem z `F‑P4`/`F‑P5`, czy
   jest osobnym zgłoszeniem. Wymaga decyzji właściciela o priorytecie (funkcja działa, ale nie
   pamięta wyboru użytkownika — realna frustracja przy dłuższej sesji).
3. **K1/K6-K11/K12/K21-K24 — brak kontraktu/panelu/Menu 5/AI.** Wspólna decyzja właściciela z
   pozostałymi kartami Finansów (patrz finance-statement-pack.md §7 pkt 1).
4. **Komentarz nagłówkowy nieaktualny o stanie flagi (§0).** Rozmiar S, kosmetyka.

**STOP-y tej rundy:** brak. Ta karta była w pełni otwieralna na realnym rekordzie CD PROJEKT bez
żadnych ograniczeń ze zlecenia — jedyna karta Finansów zmierzona bez zastrzeżeń.
