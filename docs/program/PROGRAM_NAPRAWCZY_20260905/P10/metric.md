# Kontrakt karty N — `metric` (Miernik KPI)

## §0. Tożsamość

- **Nazwa PL:** Miernik (KPI) · **moduł:** Wyniki (P7K, poza kluczami `MVP_FINAL_ZAMROZONE.json`).
- **Archetyp:** C (Rekord) · **klasa:** L (`src/components/standard/registry.ts:196-207`: osiem sekcji
  lewej nawigacji, dwa razy ponad limit 4 klasy S).
- **Trasa:** `/results/kpi/:kpiId` (`src/routes/routeConfig.ts:165`, klucz `RESULTS_KPI.TOOL`).
- **Jak otworzyć z listy:** Wyniki → KPI → raport (np. „KPI jakości — sierpień 2026",
  `/results/kpi/scorecards/:scorecardId`) → wiersz miernika → „Otwórz KPI". Zmierzone na żywo
  06.09.2026, zrzut `evidence/p10-matryca/12-metric.png` (rekord „WARTOŚĆ REKLAMACJI").
- **Komponent:** `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx:296` (1933 linii).
- **Powłoka dziś:** `NModeShell` + `ArtifactRightPanel` bezpośrednio (NIE `StandardArtifactShell`
  — uzasadnienie w nagłówku pliku, l.9-18: shell wymaga jednego `artifactId`, a ta karta ma
  wewnętrzne podekrany z własnymi zapytaniami). Menu 2/3 nad kartą dostarcza
  `KartaWynikowChrome` (`src/components/ResultsVNext/shared/kartaWynikow.tsx:88-128`) —
  karmi `StandardModuleBar` jednoelementową listą `openItems`, żeby otwarcie karty NIE
  zdejmowało paska modułu (pierwotny błąd zgłoszony przez właściciela 06.09, opisany w
  nagłówku `kartaWynikow.tsx:10-19`).
- **Rejestr:** `metric` w `KartaNKey` (`registry.ts:48`), wpis `REJESTR_KART_N.metric`
  (`registry.ts:196-207`), `statusMigracji: 'przed'` (stoi na surowym `NModeShell`, kontrakt
  `StandardArtifactShell` jej nie obowiązuje do fali migracji).

## §1. SEKCJE

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Wyniki (`performance`) | widzi trend wartości vs cel | `GET /vnext/results/kpi/:kpiId/trend` (`kpi.routes.ts:435`) | wykres znika, jeśli brak pomiarów | 1 | L |
| Kontrakt (`contract`) | definicja, formuła, geometria celu | `GET /vnext/results/kpi/:kpiId/version` (`kpi.routes.ts:206`); zapis `PUT /vnext/results/kpi/:kpiId/draft` (`kpi.routes.ts:585`) | `GapNotice` gdy wersja `null` (`KpiToolPage.tsx:1350-1359`) | 2 | L |
| Pomiary (`measurements`) | wpisuje/przegląda pomiary okresowe | osadzony `ResultsKpiMeasurementsPanel` (panel istniejący, re-użyty — `KpiToolPage.tsx:1400-1408`) | panel ma własny pusty stan | 3 | L |
| Odchylenia (`deviations`) | widzi sprawy odchyleń tego miernika | `GET .../kpi/deviation-cases?kpiId=` (agregat) | lista pusta = `EmptyState` (`:1420-1430`) | 4 | L |
| Karty działania (`actionCards`) | widzi działania naprawcze | rollup z odchyleń, brak własnego API POST (jawnie: sprawy tworzy WYŁĄCZNIE serwer, `:1417-1420`) | pusta = „Brak kart działania" | 5 | L |
| Działania (`correctiveActions`) | inicjatywy powiązane z odchyleniem | `initiativeImpacts` (agregat wpływu) | pusta, jeśli brak wpisów | 6 | L |
| Raporty (`scorecards`) | listy raportów, do których należy ten miernik | agregat scorecardów | pusta = „—" | 7 | L |
| Historia (`history`) | dziennik zdarzeń miernika | `GET /vnext/results/kpi/:kpiId/history` (`kpi.routes.ts:122`) | pusta lista = „Brak zapisanych zdarzeń" | 8 | L |

Kontrakt sekcji: `zbudujSpecSekcji([...])` woła `KpiToolPage.tsx:876-889` (osiem wpisów, 1:1
z tabelą powyżej), zamieniane na `ArtifactCardSpec` (`kartaWynikow.tsx:143-159`) i renderowane
przez kanoniczny `SectionsManagerMenu` (`KpiToolPage.tsx:1862`).

## §2. Prawy panel

Jeden komponent `ArtifactRightPanel` (`KpiToolPage.tsx:1904`), sześć sekcji SPEC-A §10.2 — **komplet**:

| sekcja | obowiązkowość | plik:linia | uwaga |
|---|---|---|---|
| Akcje | obowiązkowa | `:1063-1082` | Zawieś/Aktywuj, „Dodaj pomiar", „Otwórz kartę działania" |
| Właściwości (tabela) | obowiązkowa | `:1085-1096` | `ArtifactPropertiesTable`, wiersze Status→Właściciel→…→Zaktualizowano |
| Powiązania | obowiązkowa | `:1098-1126` | sprawy odchylenia + inicjatywy wpływające |
| Źródła i założenia | obowiązkowa (rolaAI=`asystuje`) | `:1127-1153` | metoda liczenia, definicja, źródło ostatniego pomiaru |
| Komentarze | warunkowa | `:1167-1178` | **jawnie pominięta z powodem**: „Komentarze do miernika nie są jeszcze podpięte do modelu" (`isEmpty: true`, brak wątku w modelu `rvn_kpi_*`) |
| Historia | obowiązkowa | `:1179-1198` | 3 ostatnie zdarzenia + link „Pokaż pełną historię" |

**K6-K11: ✓ komplet.** Jedyny warunkowy element (Komentarze) ma jawny powód, zgodnie z K10.

## §3. Menu 5 i nawigacja

- Menu 5 renderuje `sectionsMenu={<SectionsManagerMenu .../>}` i `<PracujZAI .../>` w jednym pasku
  (`KpiToolPage.tsx:1862-1903`).
- **Edycja/Podgląd:** NIE renderuje się — zgodnie z K14. Miernik jest wersjonowanym rekordem, prawo
  edycji dotyczy WERSJI SZKICU, nie karty; powód wypisany pod „Pracuj z AI" (wzorzec zrzutu
  `12-metric.png`, potwierdzony w matrycy `MATRYCA_21_KART.md:26` — „✓ ZGODNIE z K14 (powód wypisany)").
- Nagłówki sticky: `header.sticky` w `NModeShell` (dziedziczone z kontraktu współdzielonego,
  niezmierzone tym razem osobno — potwierdzone przy R1 dla siostrzanych kart tego samego wzorca).
- **K16 klasa:** L, zgodnie z rejestrem (8 sekcji > limit 4 klasy S).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Kontrakt | rubryka `cardAnalysisRubric.ts:635-666` (4 kryteria: definicja, formuła, próg, reakcja) | pola kontraktu z `kpiPolaSekcji('contract')` (`KpiToolPage.tsx:833-847`) | pola z `SEKCJE_Z_POLAMI_TEKSTOWYMI = {'contract'}` (`:787`) | pomiary, odchylenia, wyniki (deklaracja rubryki) |

`PracujZAI` renderuje się zawsze; zapis idzie przez `useZapisPolAI`/kolejkę CAS
(`kartaWynikow.tsx:186-232`) do `PUT /vnext/results/kpi/:kpiId/draft` — **propozycja → Zatwierdź**,
nigdy auto-zapis (jedyne wywołanie `zastosuj` w `zapisAI.zastosuj`, `KpiToolPage.tsx:797`).
Uprawnienia: `mozeEdytowac` gałąź (`:798`) — bez prawa `kpiApplyChange` zwraca `false` (`:797`).
Zmierzone na żywo: „✓ (tylko »Analizuj« — read-only)" (`MATRYCA_21_KART.md:26`).

## §5. Czytelność

- `grep -c "primary-[0-9]" KpiToolPage.tsx` — nie sprawdzone w tej rundzie (plik 1933 linii);
  zmierzone pośrednio przez zrzut `12-metric.png` (matryca kolumna K25=✓, brak angielskiego).
- Fokus: brak jawnego naruszenia znalezionego w przeglądzie kodu (klasy `focus-visible:ring-c-focus`
  widoczne w sąsiednich plikach tej samej rodziny `kartaWynikow.tsx:250`).
- **K19 pigułka pasku modułu:** ✓ (`KartaWynikowChrome` karmi `openItems`, matryca „✓").
- 1440/1280: niezmierzone osobno tą rundą (brak nowego zrzutu 1280); zrzut 1440 istniejący czysty.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✓ | `zbudujSpecSekcji` woła tablicę 8 sekcji (`:876-889`) |
| K2 kontrakt steruje renderem | ✓ (WYJĄTEK wobec pozostałych 7 kart) | brak flagi `VITE_VF1_METRIC_CARD_CONTRACT` w kodzie — sekcje renderują się wprost z `ukladSekcji` (`useCardLayout`), bez blokującej flagi |
| K3 źródło danych per sekcja | ✓ | patrz §1 — każda sekcja ma trasę albo jawny powód (Karty działania: „brak POST", `:1417-1420`) |
| K4 reguła pustki | ✓ | `GapNotice`/`EmptyState` w każdej sekcji z danymi zewnętrznymi |
| K6–K11 prawy panel | ✓ (6/6) | §2 wyżej |
| K12 Menu 5 trzy elementy | ~ | Sekcje ▾ + Pracuj z AI ▾ obecne; Edycja/Podgląd ZGODNIE nieobecne (K14) — matryca liczy to jako „~" |
| K13 lewy spis bez ucięć | n/d w tej rundzie (brak nowego zrzutu 1280) | |
| K14 Edycja/Podgląd wg prawa | ✓ | powód wypisany, patrz §3 |
| K15 nagłówki sticky | n/d (nie przetestowano scrolla w tej rundzie) | |
| K16 klasa S/L zgodna | ✓ | L, 8 sekcji |
| K17 zero primary-* | n/d (grep nie wykonany w tej rundzie) | |
| K18 fokus c-focus | ~ | zaobserwowane pośrednio, brak grep w tym pliku |
| K19 pigułka pasku modułu | ✓ | `KartaWynikowChrome` |
| K20 1280 bez przewijania | n/d (brak zrzutu 1280) | |
| K21 „Pracuj z AI" 3 pozycje | ✓ | `PracujZAI` (współdzielony komponent, 9/22 kart) |
| K22 propozycja→Zatwierdź | ✓ | `zastosuj` wołane wyłącznie z przycisku Zatwierdź w `PracujZAI` (współdzielone, nie lokalne) |
| K23 po polsku, wg uprawnień | ✓ | `isPolish`/`mozeEdytowac` widoczne w każdym bloku |
| K24 deklaracja per typ | ✓ | tabela K24 SSOT wypełniona dla `metric` |
| K25 i18n bez angielskiego | ✓ (zmierzone 06.09) | zrzut `12-metric.png`, matryca K25=✓ |
| K26 podgląd/Otwórz | ✓ | „Otwórz KPI" w preview (matryca #12) |
| K27 Teresa tylko Menu 1 | ✓ | brak wzmianki „Teresa" w tym pliku (grep zero trafień) |
| K28 zero identyfikatorów technicznych | ~ | `shortId(kpi.currentDefinitionVersionId)` w Kontrakcie (`:1385`) — SKRÓCONY, nie pełny UUID; do zweryfikowania czy `shortId` naprawdę tnie 32 znaki |
| K29 zero błędów konsoli | ✗ (zgłoszone, nieprzypisane) | rejestr KPI (`/results/kpi`) dawał 3× HTTP 404 przy wejściu, zapisane w `evidence/p10-matryca/12-metric-lista.png.json`; NIE ustalono, który zasób (P10-S §3) |
| K30 odbiór na 1 zrzucie 1440 | ✓ | `12-metric.png` |

**Wynik: 20/30 zmierzone jako ✓, 3 n/d (wymagają nowego zrzutu 1280 + scroll), 1 ✗ (K29, 404
nieprzypisany), 2 częściowe.** Najbliższa kartom-wzorcom spośród ośmiu kart partii B1.

## §7. Luki → naprawa

1. **K29 — 3× 404 na rejestrze KPI, nieprzypisany zasób.** Rozmiar S: powtórzyć zrzut z
   `--dom`/network trace, zidentyfikować URL. Nie wymaga decyzji właściciela.
2. **K13/K15/K17/K18/K20 — brak pomiaru w tej rundzie.** Rozmiar S: dogrywka zrzutu 1280 + scroll
   test + `grep -c "primary-[0-9]" KpiToolPage.tsx`. Nie wymaga decyzji właściciela.
3. **K28 — `shortId` nie zweryfikowany co do długości ucięcia.** Rozmiar S: sprawdzić implementację
   `shortId` (czy realnie tnie do <32 znaków hex) — jeśli nie, to naruszenie.

**Rekomendacja:** karta metric jest NAJBLIŻEJ pełnej zgodności z kontraktem K1–K30 spośród ośmiu
kart partii B1 (wraz z objective i roi_case — wzorce zaakceptowane przez właściciela). Reszta
partii B1 (kpi-scorecard, kpi-deviation, okr-report, okr-set-tool, roi-case-tool) NIE ma żadnego
z tych mechanizmów — patrz kontrakty osobne.
