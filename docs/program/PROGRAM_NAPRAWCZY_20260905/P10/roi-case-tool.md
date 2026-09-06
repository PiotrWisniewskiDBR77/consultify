# Kontrakt karty N — `roi-case-tool` (Narzędzie ROI, pełne — 17 podwidoków)

## §0. Tożsamość

- **Nazwa PL:** Narzędzie ROI (pełne) · **moduł:** Wyniki (P7K). **Osobny byt niż #43
  `roi-case-card`** — karta jest do CZYTANIA, to narzędzie jest do EDYCJI (decyzja P7K,
  cytowana w `RoiCaseCardSections.ts` i `routeConfig.ts:196`).
- **Archetyp:** D (Matryca/workspace wieloetapowy) wg inwentarza — realnie: pełnostronicowy
  Rekord z 5 sekcjami × 17 podwidokami, NIE lista.
- **Klasa:** L (`registry.ts` NIE ma tej karty jako osobnego wpisu — patrz §6 K1 poniżej).
- **Trasa:** `/results/roi/cases/:roiCaseId` (`routeConfig.ts:181`, klucz `RESULTS_ROI.CASE`).
- **Jak otworzyć:** Wyniki → ROI → wiersz sprawy → menu wiersza „Otwórz pełne narzędzie" (albo z
  karty #43, przycisk „Otwórz pełne narzędzie ROI"). NIE zmierzone na żywo w P10-S (brak w
  `evidence/p10-matryca/`); zmierzone TERAZ (partia B1, 06.09.2026 wieczór), zrzut
  `evidence/p10b1-wyniki/44-roi-case-tool.png` — rekord „Automatyzacja magazynu WIP"
  (`caseId=6e003785-1673-56b6-a387-27c5d969beca`), `bledyKonsoli: []`, `url` ≠ `/login`.
- **Komponent:** `src/components/ResultsVNext/roi/RoiCaseFullTool.tsx:139` (456 linii),
  wołany z `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx:47`.
- **Kontrakt sekcji:** `RoiCaseCardSections.ts` (166 linii) — TEN plik, w przeciwieństwie do #43
  (`roi-case-card.md` §0), NAPRAWDĘ go importuje (`RoiCaseFullTool.tsx:99`).
- **Powłoka dziś:** `NModeShell` + `ArtifactRightPanel` bezpośrednio (`:254-283`), **BEZ**
  `KartaWynikowChrome`/`StandardModuleBar` — otwarcie tej karty **ZDEJMUJE pasek modułu**
  (Menu 2 KPI·OKR·ROI, Menu 3 pigułki), dokładnie ten sam pierwotny błąd, który
  `kartaWynikow.tsx` naprawił dla metric/objective/roi_case, ale nie dla tego ekranu.
- **Rejestr:** **BRAK** — `roi-case-tool` NIE jest kluczem `KartaNKey` (`registry.ts:33-51`
  wymienia tylko `roi_case`, nie osobny klucz dla pełnego narzędzia). Skutek: `CardAnalysisArtifactType
  = KartaNKey` (`cardAnalysisTypes.ts:36`) nie ma jak przyjąć tego ekranu — silnik AI jest
  STRUKTURALNIE niewołowalny, nie tylko niepodpięty.

## §1. Sekcje

Pięć sekcji z `ROI_CARD_SECTIONS` (`RoiCaseCardSections.ts:75-127`), każda niosąca 2–5 podwidoków
(17 razem — 2+3+3+5+4, licząc dołożony `pir-outcome`):

| sekcja | podwidoki | po co użytkownikowi | źródło danych → writer | kolejność | S/L |
|---|---|---|---|---|---|
| Założenia (`zalozenia`) | Baseline i polityka · Założenia | punkt odniesienia i reguły liczenia | `roiCaseFullToolApi.ts` (narracja: `RoiCaseAssumptionsNarrative.tsx`) | 1 | L |
| Model (`model`) | Koszty · Korzyści · Scenariusze | linie kosztów/korzyści, warianty | `RoiCaseModelWorkspace.tsx` (CRUD istniejący) | 2 | L |
| Wynik (`wynik`) | Przebiegi kalkulacji · Migawki zatwierdzenia · Porównanie | wynik liczenia i decyzja go/no-go | `RoiCaseDecisionWorkspace.tsx` | 3 | L |
| Wyniki po wdrożeniu (`wyniki-po-wdrozeniu`) | Prognoza · Wykonania · Migawki wykonania · Wariancje · Realizacja korzyści | porównanie prognoza vs rzeczywistość | `RoiCaseRealizeValueWorkspace.tsx` | 4 | L |
| Wnioski (`wnioski`) | PIR · Wynik PIR · Powiązania Finance · Rekoncyliacje | rozliczenie po wdrożeniu, rekomendacja | `RoiCaseLearnWorkspace.tsx` + `RoiPirOutcomesTab.tsx` (org-level endpoint filtrowany po `caseId`, ostrzeżenie w nagłówku pliku — `RoiCaseCardSections.ts:33-38`) | 5 | L |

**Zero nowej mechaniki** — sekcje re-używają istniejące warsztaty (`RoiCaseFullTool.tsx:170-185`),
karta jest wyłącznie nową nawigacją nad nimi (decyzja właściciela 2026-08-30, cytowana w
`RoiCaseCardSections.ts:5-14`).

## §2. Prawy panel — KOMPLET, jedyna karta partii B1 z 6/6

| sekcja | plik:linia | uwaga |
|---|---|---|
| Akcje | `:353-373` | „Zaplanuj przegląd PIR" + powód blokady edycji (`lockReason`) |
| Właściwości (tabela) | `:355-402` | numer sprawy, status, faza, właściciel, waluta, ziarno, okres, następny krok/przegląd |
| Powiązania | `:406-420` | inicjatywa (jeśli jest) |
| Źródła i założenia | `:421-432` | jawnie NIE duplikuje treści — odsyła do sekcji „Założenia" tej samej karty (jedna wersja prawdy) |
| Komentarze | `:433-441` | jawnie pominięta z powodem: „ROI nie ma dziś komentarzy sprawy" (`isEmpty:true`) |
| Historia | `:442-450` | jawnie pominięta z powodem: „ROI nie ma dziś dziennika zdarzeń sprawy" (`isEmpty:true`) |

**K6–K11: ✓ 6/6, wzorcowe potraktowanie K10** (Komentarze/Historia NIE ukryte po cichu — widoczne,
wyłączone, z powodem — dokładnie tak, jak K10 wymaga).

## §3. Menu 5 i nawigacja — BRAK

- **Brak `SectionsManagerMenu`/„Sekcje ▾"** — lewa nawigacja to statyczna lista pięciu `NModeSection`
  (`:210-215`), nie kanoniczny menedżer sekcji.
- **Brak `PracujZAI`/„Pracuj z AI ▾"** — zero importu w pliku (grep zero trafień).
- **Brak Edycja/Podgląd** — nie dotyczy (karta jest edytorem wprost, workspace'y mają własne CRUD).
- Kebab Menu 1 (`extraOverflowItems`, `:227-240`) niesie WŁASNY przełącznik narracja⇄edycja dla
  sekcji Założenia — poprawne miejsce wg standardu n-Type §3.5 (komentarz kodu), ale to nie
  zastępuje braku Menu 5.

## §4. AI — BRAK STRUKTURALNY

Zero `useCardAIAnalysis`, zero `PracujZAI`, zero wpisu w `cardAnalysisRubric.ts` pod kluczem tego
ekranu (bo klucza nie ma — patrz §0). Tabela K24 SSOT nie ma dla niego wiersza. To NIE jest „AI
niepodpięte mimo możliwości" — to jest „AI niemożliwe do podpięcia bez wcześniej dodanego klucza
`KartaNKey`" (ten sam mechanizm blokuje wszystkie 5 kart bez rejestru w partii B1).

## §5. Czytelność

Zrzut `evidence/p10b1-wyniki/44-roi-case-tool.png` (06.09.2026, ta partia): **1 błąd K28** — znaleziony
w tekście zrzutu surowy UUID `6e003785-1673-56b6-a387-27c5d969beca` w wierszu „Numer sprawy"
(`RoiCaseFullTool.tsx:364`, `value: roiCase.caseId, mono: true` — BEZ `shortId()`, w przeciwieństwie
do sąsiednich wierszy tego samego pliku, np. `versionId` gdzie indziej używa `shortId`). Zero błędów
konsoli (`bledyKonsoli: []`). Brak `seed_*`/`known:*` w tekście. Zero wzmianek „Teresa".

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✓ | `RoiCaseCardSections.ts` (realnie importowany tutaj) |
| K2 kontrakt steruje renderem | ✓ | brak flagi blokującej |
| K3 źródło danych per sekcja | ✓ | każda sekcja ma nazwany warsztat-właściciel (§1) |
| K4 reguła pustki | ~ | niezmierzone szczegółowo w tej rundzie (warsztaty mają własne puste stany, niesprawdzone jeden po jednym) |
| K6–K11 prawy panel | ✓ 6/6 | §2 — jedyna karta partii B1 z kompletem |
| **K12 Menu 5 trzy elementy** | **✗** | brak Sekcje ▾ I brak Pracuj z AI ▾ (§3) |
| K13 lewy spis bez ucięć | ✓ (zmierzone) | zrzut `44-roi-case-tool.png`, 5 krótkich etykiet, brak „…" w tekście |
| K14 Edycja/Podgląd wg prawa | n/d | nie dotyczy (nie jest przełącznikiem edycja/podgląd) |
| K15 nagłówki sticky | n/d | nie testowano scrolla w tej rundzie |
| K16 klasa S/L zgodna | ✓ | L, pełnostronicowa, 17 podwidoków |
| K17 zero primary-* | n/d | grep nie wykonany na tym pliku w tej rundzie |
| K18 fokus c-focus | ~ | `PANEL_ACTION_BTN` używa `ring-[color:var(--c-focus)]` (`:296-299`) — token poprawny, forma zapisu inna niż `ring-c-focus` gdzie indziej (do ujednolicenia, kosmetyka) |
| **K19 pigułka pasku modułu** | **✗** | brak `KartaWynikowChrome`/`StandardModuleBar` — otwarcie ZDEJMUJE Menu 2/3 (§0) |
| **K21 „Pracuj z AI" 3 pozycje** | **✗** | brak przycisku w ogóle |
| K22 propozycja→Zatwierdź | n/d | nie dotyczy, brak AI |
| K23 po polsku, wg uprawnień | ✓ (zmierzone) | zrzut czysty, brak angielskiego w tekście |
| **K24 deklaracja per typ** | **✗** | brak wiersza w tabeli K24 SSOT — karta poza `CardAnalysisArtifactType` |
| K25 i18n bez angielskiego | ✓ (zmierzone) | zrzut `44-roi-case-tool.png` |
| K26 podgląd/Otwórz | ✓ | dostęp z menu wiersza rejestru ROI / z karty #43 |
| K27 Teresa tylko Menu 1 | ✓ (zmierzone) | zero wzmianek „Teresa" w tekście zrzutu |
| **K28 zero identyfikatorów technicznych** | **✗** | surowy UUID `caseId` widoczny w tabeli Właściwości (`:364`) — zmierzone na żywo |
| K29 zero błędów konsoli | ✓ (zmierzone) | `bledyKonsoli: []` |
| K30 odbiór 1 zrzut 1440 | ✓ | `evidence/p10b1-wyniki/44-roi-case-tool.png` |

**Wynik: 12 ✓ (w tym 5 zmierzonych na żywo w tej rundzie), 4 ✗ realne (K12, K19, K21, K24, K28 —
pięć, licząc K28), 4 n/d/częściowe.** Prawy panel (K6–K11) jest WZORCOWY — lepszy niż u
metric/objective/roi-case-card — ale karta jest architektonicznie odcięta od paska modułu i od
silnika AI, dokładnie to samo zjawisko, które właściciel zgłosił dla trzech kart Wyników przed
naprawą `kartaWynikow.tsx` (06.09), tylko że TA karta naprawy nie dostała.

## §7. Luki → naprawa

1. **K19 — brak paska modułu.** Rozmiar M: podpiąć `KartaWynikowChrome` (już istnieje, gotowy do
   re-użycia) do `RoiCaseFullTool.tsx`, analogicznie do `RoiCaseCardPage.tsx:648`. Wymaga decyzji:
   czy pigułka Menu 3 pokazuje „ROI · <nazwa sprawy>" (jak karta #43) czy osobny podtytuł
   „Narzędzie"? **1 pytanie do właściciela**, rekomendacja: to samo oznaczenie co karta #43, żeby
   użytkownik nie widział dwóch różnych konwencji dla tej samej sprawy.
2. **K21/K24 — brak AI.** Rozmiar L (dotyka rejestru): dodać `roi_case_tool` (albo re-użyć klucza
   `roi_case`?) do `KartaNKey`, dopisać wiersz w `cardAnalysisRubric.ts`, podpiąć `PracujZAI`.
   **Pytanie do właściciela**: czy pełne narzędzie ROI ma WŁASNY „Pracuj z AI" per sekcja
   (Model/Wynik/itd.), czy AI zostaje wyłącznie na karcie #43 (do czytania), a narzędzie #44 jest
   świadomie „warsztatem ręcznym" bez AI? To jest decyzja produktowa, nie techniczna — flaguję,
   nie zgaduję.
3. **K28 — surowy UUID.** Rozmiar S: zamienić `roiCase.caseId` na `shortId(roiCase.caseId)` w
   `RoiCaseFullTool.tsx:364`. Nie wymaga decyzji właściciela.
4. **K4 — reguła pustki niezweryfikowana per-warsztat.** Rozmiar S: przegląd pustych stanów
   pięciu warsztatów.

**Rekomendacja:** naprawić (3) od razu (S, bez decyzji). Naprawy (1) i (2) czekają na odpowiedź
właściciela — patrz pytania wyżej.
