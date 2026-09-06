# Arkusz — dwie rodziny: Excele (`sheet-excele`) i Tabele (`sheet-tabele`)

**Status:** PROPOZYCJA — do słowa właściciela. Karty #53/#54 inwentarza, moduł `11_MATERIALS`.
Inwentarz §3 nazywa to „do rozstrzygnięcia" — **rozstrzygnięte tu kodem**: to NIE jest jeden byt
z aliasem (jak „Wniosek audytu"), tylko **dwie równoległe, ŻYWE rodziny arkusza**, obie
domyślnie włączone. Jeden plik kontraktu, bo dzielą temat („arkusz"), ale opisane osobno w §0–§2,
bo różnią się powłoką prawego panelu.

## §0. Tożsamość

- **Excele** (`sheet-excele`, #53): silnik realnych `.xlsx` z formułami (`WorkbookGeneratorService`
  po stronie serwera). Trasa `/excele?artifactId=` (`ExceleView.tsx:555`), bramkowana
  `isExceleEngineEnabled()` — **domyślnie ON** od commita `fb119cefe8` (komentarz w
  `AppRoutes.tsx:1906-1913`: silnik był „osierocony z UI", audyt `_AUDYT_DOKUMENTY_2026-07-22`
  go odsłonił). OFF → redirect na `/tabele` (`reason="excele_merged_into_table_studio"`) — ALE
  dziś flaga jest ON, więc redirect się NIE dzieje na żywo. Komponent:
  `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx:1` (2570 linii).
- **Tabele** (`sheet-tabele`, #54): „Table Studio" kanoniczny, trasa `/tabele?artifactId=`
  (`TabeleView.tsx:55`). Komponent renderujący: `TabeleMelsView.tsx:1` (315 linii, adapter
  `ExecutiveModuleShell`) montowany gdy `isMelsTabeleEnabled()`.
- Moduł: `11_MATERIALS`. Archetyp: **D — Matryca** (obie). Powłoka: **`ExecutiveModuleShell`**
  (obie rodziny, spójnie z Dokument/Prezentacja).
- Otwarcie: Materiały → Arkusze → wiersz → oba prowadzą do odpowiedniej trasy zależnie od
  `artifactType` rekordu (nie zmierzone tu, które pole o tym decyduje — poza zakresem tej
  partii).

## §1. Sekcje

Obie rodziny renderują arkusz jako siatkę komórek (nie sekcje tekstowe jak Dokument) —
`SpreadsheetGrid`/`TabelePreviewLayout` (KPI/Schema/Records/Relations/Rationale, wg komentarza
nagłówkowego `TabeleMelsView.tsx:13-14`). Brak katalogu `KanonicznaKarta` w obu (K1 ✗). Reguła
pustki nie dotyczy w tym samym sensie co dokumentu tekstowego — pusty arkusz pokazuje pusty stan
(`„Nie udało się wczytać komórek skoroszytu."`, `SpreadsheetArtifactStudio.tsx:2007-2009`).

## §2. Prawy panel — DWIE RÓŻNE powłoki

### Excele: `ArtifactRightPanel` (standard!) — ale z wyciekiem Teresy

`SpreadsheetArtifactStudio.tsx:2050-2131` montuje **prawdziwy** `ArtifactRightPanel`
(import `:34`) z trzema sekcjami:

| sekcja | obecna? | treść |
|---|---|---|
| Akcje | ✓ (`:2050-2071`) | „Kopiuj link wewnętrzny" + **„Zapytaj Teresę"** (`:2068`, ikona `Sparkles`, wywołuje `openTeresa()`) |
| Właściwości | ✓ (`:2072-2111`), **BEZ tabeli** | własny `<dl>` (Nazwa pliku/Format/Arkusze/Klasyfikacja/Status/Wersja) — brak nagłówka „Właściwość \| Wartość" (K7 ✗, ten sam wzorzec co `idea`/`presentation`/`audit-criterion` w matrycy P10-S) |
| Źródła i założenia | ✓ (`:2112-2130`), z pustym stanem jawnym | „Ten skoroszyt nie ma jeszcze podpiętych źródeł." |
| Powiązania | ✗ brak | — |
| Komentarze | ✗ brak | — |
| Historia | ✗ brak | — |

**K27 złamane wprost w Akcjach**: „Zapytaj Teresę" to przycisk NA KARCIE (nie most niewidoczny),
identyczny wzorzec językowy jak `DeckBuilder`/`audit-criterion` w matrycy P10-S. `openTeresa()`
(`:1286`) — **do zmierzenia, czy otwiera globalne okno Teresy (Menu 1) czy panel wewnętrzny**;
niezależnie od celu, sam PRZYCISK w karcie łamie literalne brzmienie K27 („żadnego przycisku
Teresa/Zapytaj Teresę w karcie").

Zero `PracujZAI`, zero wpisu w `cardAnalysisRubric.ts`/`registry.ts` dla `sheet-excele` (K21 ✗,
K24 ✗ — pusty wiersz).

### Tabele: własny `TabeleRightRail` — NIE `ArtifactRightPanel`

`TabeleMelsView.tsx` nie importuje `ArtifactRightPanel` w ogóle; prawy rail buduje
`buildTabeleRightRailTools`/`TabeleArtifactPanel`/`TabeleRightRailPanel`
(`tabeleShell/TabeleRightRail.tsx:1`, 334 linii), z komentarzem wprost: „All AI buttons (AI
Editor, QA Report) are surfaced ONLY via the right rail per `.cursor/rules/ai-actions-menu3.mdc`"
— osobna, autorska konwencja AI, nie `PracujZAI`.

**Znalezisko „zbudowane, ale niepodłączone":** ten sam plik eksportuje
`buildTabeleArtifactSections()` (`:240-334`) zwracającą `ArtifactRightPanelSection[]`
(Właściwości/Powiązania — „z czym to sąsiaduje"/Komentarze, z jawnym `isEmpty`+`emptyLabel` po
polsku i angielsku) — **gotowy kontrakt sekcji kanonu, GOTOWY DO WPIĘCIA w `ArtifactRightPanel`,
ale nigdzie realnie zamontowany**. Flaga, która włącza wspólną powłokę
(`ff_artifact_right_rail`, `src/utils/artifactRightRailFlag.ts`) jest **domyślnie OFF i dziś
zadeklarowana wyłącznie dla jednej powierzchni: prawej szyny Notatnika** (komentarz w pliku flagi
wprost to mówi — „Pozostałe dziesięć szyn NIE jest ruszane"). Czyli: kod na K7/K8/K10 dla Tabel
JUŻ ISTNIEJE, poprawny kształt (nagłówek tabeli przez `PropertyRow`, jawne puste stany), ale jest
martwy dla tej karty do czasu osobnego kroku rozwożenia.

## §3. Menu 5 i nawigacja

Brak Menu 5 kanonu w obu (zamiast tego `TopBar`/chip motywu — `buildTabeleTopBarChips`). Brak
przełącznika Edycja/Podgląd jawnego (arkusz jest edytowalny wprost jak dokument). Sticky nagłówki
— dziedziczone z `ExecutiveModuleShell`, nie zmierzone bezpośrednio na żywo w tej partii.

## §4. AI

- Excele: „Zapytaj Teresę" jako jedyne wejście AI (§2), brak `PracujZAI`, brak wpisu w rubryce.
- Tabele: „AI Editor" + „QA Report" w prawym railu (`.cursor/rules/ai-actions-menu3.mdc`),
  osiem poziomów wg komentarza nagłówkowy pliku — osobna konwencja, brak `PracujZAI`, brak wpisu
  w `cardAnalysisRubric.ts`/`registry.ts` dla `sheet-tabele`.
- **K24**: oba typy poza `CardAnalysisArtifactType` — rubryka „nie zna" żadnej z dwóch rodzin
  arkusza.

## §5. Czytelność

- Excele: `grep -c "primary-[0-9]"` w `SpreadsheetArtifactStudio.tsx` = 0 w przeglądzie kodu
  (nie potwierdzone osobnym pełnym grepem — do dopilnowania).
- i18n: sekcje panelu Excele są PISANE NA SZTYWNO po polsku w JSX (`'Akcje'`, `'Właściwości'`,
  `'Zapytaj Teresę'`, `'Kopiuj link wewnętrzny'` — brak `t()` w ogóle, `:2050-2071`) — to
  oznacza, że przy zmianie języka UI na EN te etykiety **zostaną po polsku** (odwrotność
  „klucz istnieje ≠ przetłumaczony" — tu klucza W OGÓLE nie ma, i18n jednokierunkowe). Tabele
  (`TabeleRightRail.tsx`) używa ręcznego `isPl` boola zamiast `t()` (`:246` i dalej) — ten sam
  wzorzec, działa, ale nie przez system i18n standardowy.
- K19 pigułka modułu — nie zmierzone na żywo w tej partii dla żadnej z dwóch rodzin.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | Excele | Tabele |
|---|---|---|
| K1 kontrakt sekcji | ✗ | ✗ |
| K7 tabela Właściwości | ✗ (`<dl>` własny) | ✗ dziś (kod poprawny istnieje w `buildTabeleArtifactSections`, ale niepodłączony) |
| K8 Powiązania | ✗ | ✗ dziś (jw., kod istnieje niepodłączony) |
| K9 Źródła i założenia | ✓ | n/d nie sprawdzone |
| K10 Komentarze/Historia | ✗ | ✗ dziś (Komentarze: kod istnieje niepodłączony) |
| K12 Menu 5 | ✗ | ✗ |
| K17 zero primary | ✓ (przegląd) | nie sprawdzone |
| K21 Pracuj z AI | ✗ | ✗ (własna konwencja „AI Editor"/„QA Report") |
| K24 AI per typ | ✗ brak wpisu | ✗ brak wpisu |
| K25 i18n | ✗ (etykiety panelu bez `t()` w ogóle) | ~ (ręczny `isPl`, działa, nie przez `t()`) |
| K27 Teresa tylko Menu 1 | **✗** „Zapytaj Teresę" w Akcjach | ✓ brak wzmianek Teresy |
| K30 zrzut żywy | brak w tej partii | brak w tej partii |

## §7. Luki → naprawa

1. **Odłączyć „Zapytaj Teresę" z Akcji Excele (K27)** — zamienić na wejście do globalnego okna
   Teresy poza kartą (wzorem `openGlobalTeresa()` w `DeckBuilder`), albo usunąć całkiem jeśli
   most nie jest gotowy. Rozmiar S, Sonnet.
2. **Podłączyć `buildTabeleArtifactSections()` pod prawdziwy `ArtifactRightPanel` dla Tabel**
   (K7/K8/K10) — kod JUŻ ISTNIEJE i jest poprawny kształtem; brakuje decyzji, czy to robić przez
   flagę `ff_artifact_right_rail` (dziś zarezerwowaną dla Notatnika) czy nowym, dedykowanym
   przełącznikiem dla Tabel. **Do decyzji właściciela** (rozjazd z zasadą „jedna flaga na
   surowieć" vs „nie ruszać istniejącej rezerwacji Notatnika"). Rozmiar M, Sonnet po decyzji.
3. **Właściwości Excele → `ArtifactPropertiesTable`** (K7) — analogiczne do `document.md` pkt 1.
   Rozmiar S, Sonnet.
4. **i18n Excele — brak `t()` w panelu w ogóle** (K25) — dodać klucze zamiast literałów na
   sztywno; dziś działa TYLKO po polsku niezależnie od języka UI. Rozmiar S, Sonnet.
5. **„Pracuj z AI" (K21) dla obu rodzin** — wymaga decyzji, czy arkusz w ogóle dostaje ten sam
   trzy-pozycyjny wzorzec (analiza komórek/formuł to inna natura niż tekst dokumentu) — **do
   decyzji właściciela**, podobnie jak w `document.md` pkt 3. Rozmiar L, Opus.

**STOP:** żadna z dwóch rodzin nie miała zrzutu w `evidence/p10-matryca/` ani w tej partii — K30
niezmierzone na żywo dla obu. Przepis: otworzyć realny arkusz DBR77 (`/excele?artifactId=<id>` i
`/tabele?artifactId=<id>`) i zrzucić 1440 jasny z rozwiniętym prawym panelem dla obu tras.
