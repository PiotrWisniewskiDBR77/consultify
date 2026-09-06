# Kontrakt karty N — `finance-statement-pack` (Sprawozdanie finansowe — pakiet)

## §0. Tożsamość

- **Nazwa PL:** Sprawozdanie finansowe (pakiet) · **moduł:** Finanse (poza kluczami
  `MVP_FINAL_ZAMROZONE.json` — moduł NIE jest zamrożony, `[ODMROZENIE]` niepotrzebny,
  `F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` §2).
- **Status decyzyjny (DEC-399, 06.09 ~08:00):** ta karta jest **jedyna z siedmiu kart Finansów w
  pojemniku 2 MINIMUM** — pakiet `F‑M4` („Karta N Sprawozdania na powłoce artefaktu"). Pozostałych
  sześć kart (#46 baseline, #47 prediction, #48 analysis, #49 valuation, #50 model, #51 kpi-card)
  jest poza pojemnikiem 2; ta karta ma dodatkowe wzbogacenie w Fali 2 (`F‑P9` — Rodowód/Porównaj/
  Komentarze/Widoki/Excel jako pięć narzędzi warsztatu, zależne od `F‑M4`).
- **Archetyp:** D (Matryca) wg inwentarza; docelowo D per `ARTIFACT_ANATOMY_STANDARD.md` §13.4
  (Menu 3 = Dane/Mapa-Wizualizacja/Raporty). **Klasa:** nierejestrowana (karta nie ma wpisu w
  `REJESTR_KART_N` — patrz §6 K1).
- **Trasa:** `/finance/statements/:id` (`src/routes/AppRoutes.tsx:2437`), `:id` = `businessVersionId`.
- **Jak otworzyć z listy:** Finanse → Sprawozdania → wiersz (np. „Grupa Kapitałowa CD PROJEKT") →
  klik otwiera PODGLĄD boczny (`StandardPreview` embedded, `FinanceHub.tsx:2913-2932`, „SZCZEGÓŁY"
  jako tabela Właściwość|Wartość: Waluta/Dok./Zmapowane linie/Stan pakietu, plus „AI: Podsumuj
  sprawozdanie / Wskaż ryzyka w danych" — DWA przyciski nazwane inaczej niż kanon, nie „Pracuj z
  AI") → przycisk „Otwórz" otwiera pełną kartę. K26 (podgląd na klik, karta przez „Otwórz") **✓
  zmierzone na żywo**.
- **Zmierzone na żywo 06.09.2026 20:4x**, dane CD PROJEKT (seed `finance-cdprojekt-2025`,
  `artifactId=921a3360-7f2a-4e53-ac42-3c58842654cf`, `businessVersionId=4db71c39-eb9a-4379-bb35-
  d6b4c939e8fd`, potwierdzone `GET /api/v8/finance-v2/artifacts?artifactType=STATEMENT_PACK` na
  lokalnym stanowisku 4100 — `count:1`). Zrzuty: `evidence/p10b7-finanse/45-statement-pack-full.png`
  (karta pełna) i `...-detail.png` (podgląd boczny).
- **Komponent:** `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx:223`
  (801 linii) + `CanonicalStatementTableV2.tsx` (243 linii, główna tabela).
- **Powłoka dziś:** WŁASNA, bespoke — `FinanceWorkspaceBar` (`src/components/Finance/shared/
  FinanceWorkspaceBar.tsx:1-30`, kontrakt równoległy do SPEC-A, nie `ArtifactRightPanel`/Menu 5).
  Flaga `financeStatementPackWorkspaceV2` (`useFinanceStatementPackWorkspaceV2Flag.ts:23`,
  `defaultValue: true` — domyślnie ON, `allowLocalOverride: true`).
- **Rejestr:** BRAK. `finance-statement-pack` nie istnieje w `KartaNKey`
  (`src/components/standard/registry.ts:32-52`, 13 kluczy, zero finansowych) ani w
  `CardAnalysisArtifactType` (`src/services/cardAnalysis/cardAnalysisTypes.ts:36` — typ jest
  dosłownie aliasem `KartaNKey`, więc silnik AI **nie może** poznać tej karty bez zmiany typu).

## §1. Sekcje (stan zmierzony, nie kontrakt — kontrakt nie istnieje)

| co widać na ekranie | źródło danych | reguła pustki | uwaga |
|---|---|---|---|
| Nagłówek pakietu (nazwa, wersja „v1 · Wersja robocza", „Odśwież") | `FinanceWorkspaceBar` + `resolveFinanceWorkspace` | n/d | brak Menu 5, brak spisu sekcji z lewej |
| Tabela pozycji (119 linii × 2 okresy: FY2024/FY2025) | `CanonicalStatementTableV2.tsx` — renderuje `<div>`-y, **ZERO `<table>`** (`grep -c "<table" CanonicalStatementTableV2.tsx` = 0, potwierdzone też zrzutem: `dom.table.liczba=0`) | brak — dziś zawsze renderuje, nawet płasko | **F-M4 wymaga TRZY oddzielne tabele RZiS/Bilans/CF z hierarchią i roll-upem**; dziś jest JEDNA płaska lista pozycji mieszająca bilans/CF/RZiS bez podziału |
| „Kliknij komórkę w tabeli, żeby zobaczyć jej dowód źródłowy" | `SourceEvidencePanel.tsx` (drill-down komórki) | n/d | funkcja istnieje, nieotwierana w tej rundzie |
| Rekoncyliacja (`NamedCollapsibleSection`, tytuł string, nie `t()`) | agregat `mappingRow` | „0 przebiegów" gdy pusto | `StatementPackWorkspaceV2.tsx:654-678` |
| Powiązane artefakty (Analiza historyczna/Model bazowy/Scenariusz predykcji/Wycena — każdy z licznikiem i „+ Nowy") | agregat po `businessVersionId` | „Brak jeszcze żadnego artefaktu tego typu z tego sprawozdania" per typ | `:682-698`; zmierzone: Analiza=1, pozostałe=0 |
| Sekcja raportu (3 kroki: Generuj szkic → Otwórz wynik → Opublikuj/Dołącz) | stan lokalny kroków | kroki 2-3 zablokowane tekstem „Najpierw…" | `:702-720` |

**Brak w ogóle:** Rodowód (F-M4 §KROK 4 wymaga `GET .../lineage`, nieobecny na ekranie — tylko
komórkowy drill-down evidence, to nie to samo co sekcja Rodowód w prawym panelu), Historia,
Komentarze, Właściwości jako panel (istnieje TYLKO w podglądzie bocznym listy, nie w karcie).

## §2. Prawy panel

**BRAK w ogóle.** Zmierzone na żywo: `dom.aside.liczba = 0` na pełnej karcie (zrzut
`45-statement-pack-full.png.json`). `ArtifactRightPanel` nie jest zaimportowany w żadnym pliku
`statementPackWorkspaceV2/*` (`grep -rn "ArtifactRightPanel" src/components/Finance/
statementPackWorkspaceV2/` = 0 trafień). Zamiast tego: „Powiązane artefakty" i „Sekcja raportu" są
blokami w głównej kolumnie treści, nie panelem bocznym. K6-K11 (Akcje/Właściwości-tabela/
Powiązania/Źródła i założenia/Komentarze/Historia, jeden panel) = **0/6 na karcie pełnej**
(w podglądzie bocznym listy jest namiastka tabeli Właściwość|Wartość, ale to inny ekran — preview,
nie karta).

## §3. Menu 5 i nawigacja

**BRAK w ogóle.** Zero „Sekcje ▾", zero „Edycja/Podgląd", zero „Pracuj z AI ▾" na pełnej karcie —
zmierzone tekstem zrzutu (`grep -c "Pracuj z AI|Sekcje|Edycja" tekst` = 0 dla wszystkich trzech).
Nawigacja to WYŁĄCZNIE `FinanceWorkspaceBar` (Pakiet C, kontrakt równoległy: LEWO nazwa+wersja+
status, PRAWO „Odśwież"+lifecycle+fullscreen). K12 = 0/3 elementów kanonu (żaden z trzech nie
istnieje pod tą nazwą — pasek ma SWOJE odpowiedniki, nie SPEC-A).

## §4. AI

| źródło | co robi | zgodność z K21 |
|---|---|---|
| Podgląd boczny listy: „Podsumuj sprawozdanie" / „Wskaż ryzyka w danych" (`FinanceHub.tsx`, obok „AI" z ikoną) | dwa OSOBNE, inaczej nazwane przyciski | **NARUSZA K21** wprost — kanon zakazuje „osobnych, inaczej nazwanych przycisków AI"; brak listy Analizuj/Uzupełnij tę sekcję/Uzupełnij cały dokument |
| Lista Sprawozdań: „Analizuj AI" (nagłówek nad tabelą) | nieklikane w tej rundzie | nie zmierzone, prawdopodobnie inny mechanizm (StandardTable bulk-akcja, nie karta) |
| Karta pełna (`StatementPackWorkspaceV2`) | **ŻADEN przycisk AI** | nie dotyczy — AI nieobecne na karcie pełnej |

`finance-statement-pack` nie istnieje w `ARTIFACT_CRITERIA`/`CARD_DESCRIPTORS`
(`cardAnalysisRubric.ts:92`, `:1004`) — typ-level, nie tylko brak danych: silnik AI kart N
**nie może dziś objąć tej karty** bez rozszerzenia `KartaNKey`. Deklaracja K24 = **do rozstrzygnięcia**
(ten sam kubeł co 9 innych kart poza silnikiem, SSOT §5 tabela K24 ostatni wiersz).

## §5. Czytelność

- `grep -c "primary-[0-9]"` na trzech plikach rdzenia karty (`StatementPackWorkspaceV2.tsx`,
  `CanonicalStatementTableV2.tsx`, `NamedCollapsibleSection.tsx`) = **0/0/0**. K17 **✓** dla samej
  karty (Finanse jako całość mają 15 trafień w plikach spoza tej karty — `ExportToOutputDialog.tsx`
  ×12, `ExportButton.tsx` ×2, `StatementExplainPanel.tsx` ×1 — żaden z tych trzech nie jest
  importowany przez `statementPackWorkspaceV2/*`, więc nie dotyczy TEJ karty).
- Zero angielskiego zmierzone na obu zrzutach (tekst 100% polski, poza terminami metodycznymi
  dopuszczonymi kanonem: „P&L / BS / CF" jako skrót typu w liście — akceptowalne per
  `FINANSE_ZALOZENIA_CTO_20260905.md` §2, nazwy metod finansowych zostają).
  Moduł jako całość ma jednak udokumentowane 20 twardych napisów EN dotykających TEJ karty:
  `StatementValidationBadges.tsx:41` „Validation results", pliki `SourceEvidencePanel.tsx`/
  `StatementReportActionsSection.tsx` (importują te same etykiety wg `F1_FINANSE_..._20260905.md`
  §F‑M1 §3) — nie zmierzone bezpośrednio na tym zrzucie (funkcje nieotwierane), ale kod istnieje.
- **Rozjazd statusu (świeże znalezisko, 06.09 20:4x):** lista Sprawozdań pokazuje w kolumnie
  STATUS „Zatwierdzone" dla wiersza CD PROJEKT, a `GET /api/v8/finance-v2/artifacts?artifactType=
  STATEMENT_PACK` (to samo stanowisko, ta sama chwila) zwraca `currentBusinessVersion.status:
  "DRAFT"`. Kod ma już udokumentowany POKREWNY defekt („Audyt FIN 2026-09-06 defekt #6",
  `FinanceHub.tsx:2919-2923` — podgląd pokazywał surowe „APPROVED" obok przetłumaczonego
  „Zatwierdzone", naprawione mostem `statusChip.*`), ale TEN rozjazd (DRAFT w API vs „Zatwierdzone"
  na liście) jest INNY i nieopisany — źródło pola `row.status` na liście nie zostało w tej rundzie
  ustalone (może czytać `pack_readiness_status`, nie `finance_business_versions.status`). Nie
  przypisuję przyczyny — do zbadania, nie fabrykuję pewności.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✗ | brak `KanonicznaKarta`/`StandardSekcjaDef` dla tej karty |
| K2 kontrakt steruje renderem | ✗ (n/d — nie ma czego wyłączać) | — |
| K3 źródło danych per sekcja | ~ | tabela pozycji ma writer (import), Rodowód nie ma sekcji w ogóle |
| K4 reguła pustki | ✓ częściowo | „Brak jeszcze żadnego artefaktu…" per typ powiązania |
| K6-K11 prawy panel | ✗ 0/6 | §2 — `aside.liczba=0` |
| K12 Menu 5 | ✗ 0/3 | §3 |
| K13 lewy spis sekcji | ✗ (nie istnieje) | brak spisu w ogóle |
| K14 Edycja/Podgląd wg prawa | n/d (element nie istnieje) | — |
| K15 nagłówki sticky | ~ (FinanceWorkspaceBar deklaruje to jako wymóg własny, niezmierzone scrollem) | — |
| K16 klasa S/L | n/d — nierejestrowana | — |
| K17 zero primary-* | ✓ w plikach karty | §5 |
| K18 fokus c-focus | ~ (FinanceWorkspaceBar deklaruje `c-focus` w komentarzu nagłówkowym, niezmierzone grepem) | — |
| K19 pigułka pasku modułu | ✗ (FinanceWorkspaceBar ≠ StandardModuleBar, brak pigułki otwartego rekordu w Menu 2/3) | — |
| K20 1280 bez przewijania | n/d (brak zrzutu 1280) | — |
| K21 „Pracuj z AI" 3 pozycje | ✗ | §4 — dwa osobne przyciski w podglądzie, zero na karcie pełnej |
| K22 propozycja→Zatwierdź | n/d (AI nie zapisuje nic na tej karcie) | — |
| K23 po polsku wg uprawnień | ✓ (tekst 100% polski na obu zrzutach) | — |
| K24 deklaracja per typ | ✗ | karta poza `CardAnalysisArtifactType` (§4) |
| K25 i18n bez angielskiego | ~ | zrzut czysty, ale moduł ma 20 udokumentowanych EN literałów dotykających plików tej karty (§5) |
| K26 podgląd/Otwórz | ✓ | zmierzone na żywo (§0) |
| K27 Teresa tylko Menu 1 | ✓ (zero wzmianek na obu zrzutach) | — |
| K28 zero identyfikatorów technicznych | ✓ (brak UUID w widocznym tekście obu zrzutów) | — |
| K29 zero błędów konsoli | ✓ (`bledyKonsoli: []` na obu zrzutach) | — |
| K30 odbiór na 1 zrzucie 1440 jasny z „Pracuj z AI" | ✗ (nie da się — „Pracuj z AI" nie istnieje na tej karcie) | — |

**Wynik: 5/30 ✓ jednoznacznie, 2 ✗ n/d, reszta ✗ lub ~.** Najdalej od kontraktu K1-K30 spośród
zmierzonych dotąd kart razem z resztą Finansów (0 kart z rejestrem/kontraktem/AI w tym module).

## §7. Luki → naprawa

1. **K1/K2 — brak kontraktu sekcji, brak rejestru.** Rozmiar L, wymaga decyzji właściciela: czy
   Finanse wchodzą do `KartaNKey`/rejestru w tej fali, czy dopiero po Fali 2 pełnej. Rekomendacja:
   poczekać na `F‑P9` (Fala 2) — MINIMUM (`F‑M4`) explicite NIE obejmuje migracji do
   `ArtifactRightPanel`/Menu 5 (kanon programu F każe „powłoka wspólna i nietykalna: Menu 1 +
   Menu 3 + kebab + `ArtifactRightPanel`" — TO JEST SPECYFIKACJA F‑M4, jeszcze niescalona; dziś
   karta stoi na starym bespoke chrome sprzed tej paczki).
2. **K7/K11 — trzy tabele zamiast jednej płaskiej listy.** Rozmiar L (Opus, część `F‑M4` §KROK 3,
   już zaprojektowane w programie F, nie wymaga nowej decyzji — czeka na wykonanie).
3. **K21 — dwa osobne przyciski AI zamiast „Pracuj z AI".** Rozmiar M: podłączyć wspólny
   `PracujZAI`/`useCardAIAnalysis`, wymaga NAJPIERW rozszerzenia `KartaNKey`/`CardAnalysisArtifactType`
   o typy finansowe (blokuje na K1/K24 wspólnie) — decyzja właściciela: czy Fala 2 rozszerza silnik
   AI kart N o Finanse, czy Finanse dostają OSOBNY silnik AI (jak dziś).
4. **Rozjazd statusu DRAFT/„Zatwierdzone" (§5).** Rozmiar S: ustalić źródłowe pole `row.status` na
   liście Sprawozdań i porównać z `finance_business_versions.status`; nie wymaga decyzji
   właściciela, to pomiar/debug.
5. **K17 w sąsiednich plikach (`ExportButton.tsx`, `ExportToOutputDialog.tsx`,
   `StatementExplainPanel.tsx`) — 15 wystąpień crimson.** Nie dotyczy TEJ karty bezpośrednio
   (nieimportowane przez `statementPackWorkspaceV2/*`), ale dotyczy `finance-model` (#50, patrz
   kontrakt osobny) i ogólnego F‑M2. Rozmiar S, brak decyzji właściciela.

**STOP-y tej rundy:** nie kliknięto „Podsumuj sprawozdanie"/„Wskaż ryzyka w danych" (uruchomiłoby
prawdziwe wywołanie AI na współdzielonym stanowisku) — pomiar oparty na obecności/nazwie przycisku,
nie na wyniku działania. Nie tworzono nowych rekordów w bazie (używany wyłącznie istniejący seed
CD PROJEKT).
