# Karta biblioteki narzędzia (`tool`) — kontrakt karty N

> Pozycja **#14** inwentarza (`INWENTARZ_KART_N_PELNY.md` §2 „03_TOOLS”).
> Kontrakt **bazowy dla 31 egzemplarzy** — rozstrzygnięcie CTO w §8.
> Pomiar na żywo 06.09.2026, stanowisko lokalne API `127.0.0.1:4100`, własny vite `3131`,
> organizacja DBR77, użytkownik `audyt@dbr77.local`. Zrzut: `evidence/p10b2/14-tool-analizuj.png`
> (1440 · jasny · „Analizuj” otwarte i **zakończone wynikiem**, `bledyKonsoli` = 0).
> Zrzut z partii P10-S: `evidence/p10-matryca/16-tool.png`.

---

## §0. Tożsamość

| pole | wartość (zmierzona) |
|---|---|
| nazwa PL | **Narzędzie (wpis biblioteczny)** |
| moduł | `03_TOOLS` — Narzędzia |
| archetyp | **C — Rekord** (read-only katalog metody), klasa **S** (`registry.ts:128-137`) |
| trasa | `/discovery-tools?docId=known:<toolType>` |
| jak otworzyć z listy | Narzędzia → zakładka **Biblioteka** → wiersz narzędzia (podgląd boczny) → **„Otwórz”** |
| komponent | `src/components/DiscoveryTools/KnownToolDetailView.tsx:155` (2649 linii) |
| dyspozytor | `src/components/Discovery/DiscoveryToolsHub.tsx:3946` (`doc.id` z prefiksem `known:`) |
| powłoka dziś | `NModeShell` (`KnownToolDetailView.tsx:2498`) + `ArtifactRightPanel` (`:2623`) |
| kontrakt sekcji | `src/components/DiscoveryTools/toolCards.contract.ts:63` (`TOOL_CARDS`, 4 sekcje) |
| rejestr | `src/components/standard/registry.ts:128` — `klasa: 'S'`, `statusMigracji: 'przed'` |
| API | `GET /api/known-tools` (lista) · `GET /api/known-tools/:toolType` (szczegół) — **wyłącznie GET**, `server/src/routes/knownTools.routes.ts` |

**Karta jest read-only z powodu, nie z niedoróbki.** Backend nie ma ani jednego zapisu dla tego
zasobu, więc `readMode` jest STAŁĄ (`KnownToolDetailView.tsx:200-208`), a przełącznik
„Edycja | Podgląd” świadomie zdjęto jako atrapę.

---

## §1. SEKCJE (kontrakt treści)

Katalog: `toolCards.contract.ts` — 4 karty kanoniczne, wszystkie `rolaAI: 'dane'` z jawnym
`BrakAiPrompt`. Klasa S = limit 4 sekcji lewej kolumny → **4/4, limit wyczerpany**.

| # | sekcja (id) | po co użytkownikowi | źródło danych | reguła pustki | kol. | S/L |
|---|---|---|---|---|---|---|
| 1 | Cel (`goal`) | czym narzędzie jest i jakiej decyzji służy | **i18n**: `discoveryToolsMain.knownToolDetail.<tool>.goal.*` (`KnownToolDetailView.tsx:669`) — writer = plik tłumaczeń, nie serwer | brak klucza → surowy klucz (defekt L-3) | 0 | S |
| 2 | Proces (`process`) | jak metoda przebiega krok po kroku | **i18n** `…<tool>.process.*` + `<ToolProcessDiagram toolType="dynamic-swot">` (`:862-864`) | jw. | 1 | S |
| 3 | Rezultat (`outcomes`) | co powstaje i w jakiej formie | **i18n** `…<tool>.outcomes.*` (`:1065`); prawy panel „Rezultaty” bierze `tool.outputs` → `KnownToolsService.ts:868` (`tools.library_content_translations`) | lista pusta → fallback `whatYouGet` (`:496-501`) | 2 | S |
| 4 | Przykład (`example`) | ilustracja zastosowania | **i18n** `…<tool>.example.*` (`:1146`) | 1 poz. → pełna szerokość (`exampleCaseGridCols`, `:151`) | 3 | S |

**★ ZMIERZONY ROZJAZD (najważniejszy w całej partii).** Nagłówek `toolCards.contract.ts`
twierdzi, że treść 4 sekcji pochodzi „z `Api.getKnownTool`”. **To nieprawda.** Treść centrum
pochodzi z i18n i istnieje dla **5 z 31 narzędzi**:
`discoveryToolsMain.knownToolDetail.{dynamicSwot, marketForces, growthPaths, portfolioPriority,
riskUncertainty}` — po 4 klucze każde (`public/locales/pl/translation.json`, potwierdzone też w `en`).
Gałęzie: `KnownToolDetailView.tsx:1757, :1786, :1815, :1844, :1873`.
**Gałąź domyślna (`:1902`) dla pozostałych 26 narzędzi zwraca `goalSection`/`processSection`/
`outcomesSection`/`exampleSection`, czyli komponenty DYNAMIC SWOT** — z tekstem pozycjonowania
SWOT-a i diagramem przybitym na sztywno do `toolType="dynamic-swot"` (`:864`).
Skutek: gdyby dziś ktoś zdjął bramkę MVP z dowolnego z tych 26 narzędzi, karta „SOP Builder”
opowiedziałaby użytkownikowi o Dynamicznym SWOT pod cudzą nazwą. Dziś niewidoczne wyłącznie
dlatego, że szczegół 30 narzędzi zwraca **404** (§6, L-1). To dług ukryty za bramką, nie jego brak.

**Prawdziwy writer treści bibliotecznej** (poprawka wobec `tool.md` z r1, który pisał
„MARTWE: brak writera”): kolumna `tools.library_content_translations`, zapisywana przez
migracje `server/migrations/559_tools_known_tools_library.sql` i
`server/migrations/733_dynamic_swot_foundation_content.sql`, czytana przez
`KnownToolsService.ts:868` (`pickLibraryContent`, `:75`). Do tego dwutypowy fallback w kodzie
(`getFallbackLibraryContent`, `:86`). Pomiar: **31/31 wierszy ma niepuste `whatYouGet`**
(`GET /api/known-tools?limit=100`). Writer więc **istnieje**, ale jest migracją SQL, nie
zarządzanym katalogiem — i **nie zasila 4 sekcji centrum**, tylko prawy panel i podgląd.

---

## §2. PRAWY PANEL (`ArtifactRightPanel`, `KnownToolDetailView.tsx:2187-2455`)

Zmierzone na żywym zrzucie — **7 sekcji, komplet kanonu, w kanonicznej kolejności**
(to koryguje wpis matrycy P10-S „panel skrócony (Akcje+Właściwości)”, który opisywał
sekcje ZWINIĘTE, nie nieobecne):

| # | sekcja | stan | uzasadnienie / źródło |
|---|---|---|---|
| ① | **Akcje** | obowiązkowa · obecna, licznik 0, **rozwinięta** (`:2204-2226`) | karta nie ma niezdublowanej akcji — CTA „Rozpocznij sesję” mieszka w nagłówku (SPEC-N §2.6); zdanie wyjaśniające licznik jest widoczne (naprawa dyżuru 164) |
| ② | **Właściwości = TABELA** | obowiązkowa · `ArtifactPropertiesTable` (`:2227-2252`) | nagłówek „Właściwość \| Wartość” potwierdzony na zrzucie; 13 wierszy |
| ③ | Powiązania | obowiązkowa · sesje tego narzędzia, klikalne (`:2253`) | `Api.listToolSessions({toolType})`; na pomiarze **5** |
| ④ | Źródła i założenia | obowiązkowa (karta ma AI) · (`:2293`) | `tool.inputs` + `tool.commonMistakes` z `Api.getKnownTool` (`:506-513`) |
| ⑤ | Rezultaty | warunkowa · obecna (`:2376`) | `tool.outputs` → fallback `whatYouGet` |
| ⑥ | Komentarze | warunkowa · obecna, 0, powód wypisany (`:2413`) | katalog globalny, wspólny dla organizacji — brak encji komentarza |
| ⑦ | Historia | obowiązkowa · obecna, 0, powód wypisany (`:2425`) | katalog globalny bez logu per-organizacja |

**Kolejność wierszy tabeli Właściwości — kontrakt (zmierzony: `:320-450`, zrzut):**
Status · Kategoria · Typ narzędzia · Dostęp · Tagi · Wejścia · Kroki procesu · Rezultaty ·
Liczba użyć (sesje) · Sesje ukończone · Ostatnie użycie · Dodane do biblioteki · Źródło.
Wiersz **„Typ narzędzia: `dynamic-swot`”** pokazuje surowy slug — **naruszenie K28**, do naprawy
(ma pokazywać `display_name`).
Metryka użycia ma uczciwy stan „nie wiem”: przy błędzie zapytania `available: false` i „—”,
nie „0” (`:210-216`) — wzorzec do przepisania na inne karty.

---

## §3. MENU 5 I NAWIGACJA

**Zmierzony stan: Menu 5 NIE ISTNIEJE.** Trzy kontrolki, które kanon umieszcza w Menu 5, siedzą
w `header.inlineActions` Menu 4 (`KnownToolDetailView.tsx:2530-2557`):
`SectionsManagerMenu` („Sekcje”) · „Baza wiedzy” · **„Analizuj”** · „Rozpocznij sesję”.

| element kanonu | dziś | kontrakt |
|---|---|---|
| „Sekcje ▾” (lewa) | jest, ale w Menu 4 | przenieść do Menu 5, pozycja lewa |
| „Edycja / Podgląd” (środek) | **nie renderuje się** | **ZGODNE z K14** — brak prawa zapisu (API wyłącznie GET); powód musi być wypisany w karcie („Wpis biblioteczny — tylko do odczytu”), dziś powodu NIE MA nigdzie na ekranie → luka L-5 |
| „Pracuj z AI ▾” (prawa) | **nie ma** — jest stary przycisk „Analizuj” | zamienić na `PracujZAI` (§4) |
| sticky (K15) | ✓ `header.sticky: true` (`:2504`) | bez zmian |
| pigułka modułu (K19) | ✓ „Lista · dynamic-swot · Dynamic SWOT” | poprawić drugi człon: `display_name`, nie slug (K28) |
| drabina S/L (K16) | ~ klasa **S** w rejestrze, ale karta otwiera się jako **pełna strona** huba, nie szuflada | rozstrzygnąć: albo klasa L w rejestrze, albo otwieranie w szufladzie |

**„Otwórz” z podglądu (K26):** działa — podgląd boczny wiersza ma stopkę
`Start sesji (S) · Otwórz (O) · Czat (C)` (zmierzone na zrzucie listy).
**Głęboki link jest zepsuty (K29):** wejście zimne pod
`/discovery-tools?docId=known%3Adynamic-swot` odpala `GET /api/tools/known:dynamic-swot`
i `GET /api/initiatives/known:dynamic-swot` → **2× 404**, po czym hub gubi `docId` i pokazuje
listę. Ta sama trasa osiągnięta klikami działa i ma `bledyKonsoli = 0`. Dowód:
pierwszy przebieg zrzutu (`odpowiedziHttp` w `.json`) vs przebieg klikany.

---

## §4. AI (K21–K24)

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Cel | ✔ rubryka `cardAnalysisRubric.ts:459` (`goal-alignment`, `:461`) | **nie** — treść referencyjna, wspólna dla wszystkich organizacji | **nie** | całość |
| Proces | ✔ `process-clarity` (`:487`), `session-readiness` (`:526`) | nie | nie | całość |
| Rezultat | ✔ `outcome-quality` (`:500`) | nie | nie | całość |
| Przykład | ✔ `limitations` (`:513`), `inputs-completeness` (`:474`) | nie | nie | całość |

**Kontrakt AI dla tej karty (rozstrzygnięcie CTO):** karta biblioteczna dostaje `PracujZAI`
z **jedną czynną pozycją — „Analizuj”**; „Uzupełnij tę sekcję” i „Uzupełnij cały dokument”
zostają **wyszarzone z powodem** („Wpis biblioteczny jest wspólny dla wszystkich organizacji —
AI go nie zmienia”). To jest dokładnie ten sam wzorzec, który właściciel już zaakceptował
w kartach Wyników (`12-metric.png`, `14-roi.png`: sam „Analizuj” + wypisany powód).
Zakaz osobnego przycisku „Analizuj” poza listą — dziś jest osobny (§3).

**Silnik działa — zmierzone, nie założone.** Przycisk „Analizuj” wołany na żywo zwrócił
5 znalezisk w szufladzie „BRAKI”, każde z nazwą kryterium rubryki (`inputs-completeness`,
`process-clarity`, `outcome-quality`, `limitations`, `session-readiness`), oraz puste
„RYZYKA / SUGESTIE / PROPONOWANE ZMIANY”. Zrzut: `evidence/p10b2/14-tool-analizuj.png`.
`applyChange` zwraca twarde `false` (`:2117`) — karta nie udaje, że da się zapisać.
Wpis do tabeli K24 SSOT (`KARTA_N_KONTRAKT.md` §5) jest już poprawny i nie wymaga zmiany.

---

## §5. CZYTELNOŚĆ (K17–K20, K25, K28)

* **K17 `primary-*`: 0 trafień** w `KnownToolDetailView.tsx` — czysto.
* **K18 fokus:** `focus-visible:ring-c-focus` (`:2551`) — czysto.
* **K25 — literały poza `t()`:** `isPolish ? 'Analizuj' : 'Analyze'` (`:2545`),
  `isPolish ? 'Rozpocznij sesję' : 'Start session'` (`:2555`),
  `isPolish ? 'Kiedy używać' : 'When to use'` (`:2062`), `'Wejścia'/'Inputs'` (`:2068`),
  `'Kroki procesu'/'Process steps'` (`:2069`), `'Rezultaty'/'Outputs'` (`:2074`),
  `'Następne kroki'/'Next steps'` (`:2076`), `'Przykład'/'Example'` (`:2081`).
  Tekst jest po polsku, więc użytkownik defektu nie widzi — ale klucza w `translation.json`
  nie ma, więc tłumaczenie nie jest zarządzane. Rozmiar S.
* **K28 — identyfikator techniczny w DOM:** wiersz „Typ narzędzia: `dynamic-swot`” oraz drugi
  człon pigułki modułu (`dynamic-swot`). Dwa miejsca, jedna naprawa: podstawić `tool.name`.
* **K20 1440/1280:** brak poziomego przewijania na 1440 (zmierzone); 1280 **niezmierzone** — do
  domknięcia przy naprawie.
* **K29:** 0 błędów konsoli na trasie klikanej; 2× 404 na zimnym głębokim linku (§3).

---

## §6. STAN ZASTANY vs KONTRAKT — matryca K1–K30

| K | wymóg | stan | dowód (plik:linia / zrzut) |
|---|---|:--:|---|
| K1 | katalog sekcji istnieje | ✓ | `toolCards.contract.ts:63` — `TOOL_CARDS`, 4 karty |
| K2 | katalog steruje renderem | ✗ | `TOOL_CARD_SPEC` bez konsumenta; render z tablicy statycznej `:1902`; flaga `VITE_VF1_TOOL_CARD_CONTRACT` (`:109`) domyślnie `false`, pusta w `server.env` |
| K3 | każda sekcja ma źródło | ~ | źródłem są klucze i18n, nie serwer; 5/31 narzędzi ma własne, 26/31 dziedziczy treść SWOT-a (§1) |
| K4 | reguła pustki | ~ | `bullets()` (`:1909`) pokazuje stan pusty zamiast chować nagłówek |
| K5 | etykiety i kolejność wg katalogu | ✓ | Cel · Proces · Rezultat · Przykład = kolejność 0-3 katalogu; zrzut zgodny |
| K6 | Akcje pierwsze | ✓ | `:2204` |
| K7 | Właściwości = tabela | ✓ | `ArtifactPropertiesTable` `:2232`; nagłówek „Właściwość \| Wartość” na zrzucie |
| K8 | Powiązania | ✓ | `:2253`, licznik 5, klikalne |
| K9 | Źródła i założenia | ✓ | `:2293` |
| K10 | Komentarze / Historia | ✓ | `:2413` / `:2425`, obie z jawnym powodem pustki |
| K11 | jeden panel po prawej | ✓ | `:2623`, jedno `ArtifactRightPanel` |
| K12 | Menu 5 z trzema elementami | ✗ | brak paska; kontrolki w `header.inlineActions` `:2530` |
| K13 | lewy spis sekcji z grupami | ✓ | PRZEGLĄD / JAK TO DZIAŁA / PRZYKŁAD, bez ucięć na 1440 |
| K14 | Edycja/Podgląd wg prawa | ~ | przełącznika słusznie nie ma (`:200-208`), ale **powód nie jest wypisany na ekranie** |
| K15 | nagłówki sticky | ✓ | `header.sticky: true` `:2504` |
| K16 | drabina S/L | ~ | rejestr: `S`; realnie otwiera się jako pełna strona |
| K17 | zero `primary-*` | ✓ | `grep -c 'primary-[0-9]'` = **0** |
| K18 | fokus `c-focus` | ✓ | `:2551` |
| K19 | pigułka w pasku modułu | ~ | jest, ale z surowym slugiem |
| K20 | 1440 / 1280 | ~ | 1440 ✓; 1280 niezmierzone |
| K21 | „Pracuj z AI” z 3 pozycjami | ✗ | stary przycisk „Analizuj” `:2545` |
| K22 | propozycja → Zatwierdź | ✓ (przez brak zapisu) | `applyToolAnalysisChange` → `false` `:2117` |
| K23 | po polsku i wg uprawnień | ~ | treść PL, ale etykiety poza `t()` (§5) |
| K24 | deklaracja AI per typ | ✓ | rubryka `:459` (6 kryteriów), katalog `TOOL_CARDS` (`cardAnalysisRubric.ts:1013`) |
| K25 | i18n bez angielskiego | ~ | 8 literałów poza `t()` (§5); polskie UI mówi po polsku |
| K26 | podgląd na klik, karta przez „Otwórz” | ✓ | stopka podglądu `Start sesji · Otwórz · Czat` |
| K27 | Teresa tylko w Menu 1 | ✓ | `grep -c Teresa` = **0** |
| K28 | brak identyfikatorów technicznych | ✗ | `dynamic-swot` w tabeli i w pigułce |
| K29 | zero błędów konsoli | ~ | 0 na trasie klikanej; **2× 404** na zimnym głębokim linku |
| K30 | odbiór na zrzucie 1440 z otwartym AI | ✓ | `evidence/p10b2/14-tool-analizuj.png` (wynik analizy widoczny) |

**Wynik: ✓ 14 · ~ 10 · ✗ 6 (z 30).**

---

## §7. LUKI → NAPRAWA

| # | luka | rozmiar | decyzja właściciela? |
|---|---|:--:|---|
| L-1 | **Karta otwiera się dla 1 z 31 narzędzi.** `GET /api/known-tools/:toolType` zwraca 404 dla 30 (bramka `APPROVED_MVP_TOOL_TYPES = {'dynamic-swot'}`, `server/src/services/toolCatalog/approvedMvpToolTypes.ts:21` → `ACTIVE_KNOWN_TOOL_TYPES`, `KnownToolsService.ts:208,785,913`) | — | **NIE — to zamrożona decyzja właściciela**, opisana w pliku jako „Tools MVP is Dynamic SWOT”. Kontrakt ją respektuje; §8 mówi, co z tego wynika dla planu |
| L-2 | **26 z 31 narzędzi dziedziczy treść Dynamic SWOT** w 4 sekcjach centrum (`:1902` + `:864`) | **L** | nie — defekt |
| L-3 | Treść centrum żyje w `translation.json`, nie w serwerowym katalogu; nie da się jej wydać ani wersjonować bez deployu frontendu | **L** | **TAK — pytanie w §9** |
| L-4 | K21: „Analizuj” → `PracujZAI` z jedną czynną pozycją i wypisanym powodem dla dwóch pozostałych | S | nie |
| L-5 | K14: brak wypisanego powodu „tylko do odczytu” na ekranie | S | nie |
| L-6 | K12: wydzielić Menu 5 z `header.inlineActions` | M | nie |
| L-7 | K28: `display_name` zamiast slugu w tabeli Właściwości i w pigułce | S | nie |
| L-8 | K29: zimny głęboki link `docId=known:*` → 2× 404 i utrata `docId` | M | nie |
| L-9 | K25: 8 literałów poza `t()` | S | nie |
| L-10 | K2: `TOOL_CARD_SPEC` bez konsumenta (kontrakt nie steruje renderem) | M | nie |
| L-11 | K16: rejestr mówi klasa S (szuflada), karta otwiera pełną stronę | S | **TAK — patrz §9 (jedno pytanie łączone)** |

---

## §8. ★ ROZSTRZYGNIĘCIE CTO — jeden kontrakt na 31 narzędzi

**Decyzja (właściciel może odwołać):** 31 narzędzi **nie dostaje 31 kontraktów**.
Dostaje **jeden kontrakt bazowy na typ karty** (ten plik dla `tool`, `tool-document.md` dla
dokumentu sesji) + **jeden wzorzec na archetyp dedykowany**
(`_wzorzec-narzedzie-archetyp-A.md` — Canvas, `_wzorzec-narzedzie-archetyp-D.md` — Matryca),
a różnice per narzędzie są **parametrem**, nie osobnym dokumentem.

**Podstawa pomiarowa, nie preferencja:**
1. Wszystkie 31 narzędzi renderuje **ten sam komponent** (`KnownToolDetailView.tsx`) —
   `DEDICATED_TOOL_TYPES` liczy 31/31 (`dedicatedToolTypes.ts:8-38`).
2. Sekcje dokumentu sesji są już sparametryzowane tablicą
   `TOOL_STEP_DEFINITIONS: Record<ToolType, StepDefinition[]>` (`src/store/useToolStore.ts:2744`)
   — 31 kluczy mapuje się na **21 tablic**, bo 11 narzędzi dzieli dwie wspólne
   (`TOOLSET_OPERATIONAL_STEPS`, `TOOLSET_DIGITAL_STEPS`).
3. Realnie otwieralne jest **1 z 31** (L-1). Pisanie 31 dokumentów dla 30 ekranów, których
   nie da się otworzyć, byłoby dokumentowaniem nieistniejącego produktu.

**Miejsce na różnice per narzędzie = tabela w §8.1** (i tabela sekcji w `tool-document.md` §1.1).
Nowe narzędzie = **nowy wiersz w tabeli**, nie nowy plik.

### §8.1. Tabela 31 narzędzi

Kolumny zmierzone: **archetyp sygnaturowy** = `signatureArchetype` z `src/toolPacks/registry.ts:79-121` i `packs/dynamicSwot.pack.ts:232` (8 wartości, `contract.ts:52`); **/ SPEC-A** = proponowane odwzorowanie na archetypy SPEC-A (§8.2 — propozycja CTO, nie pomiar) ·
**kroki** = tablica z `TOOL_STEP_DEFINITIONS` (liczba sekcji) ·
**własny ekran biblioteki** = czy `KnownToolDetailView` ma własną gałąź treści
(inaczej: dziedziczy treść Dynamic SWOT — L-2) ·
**otwieralne** = czy `GET /api/known-tools/:toolType` zwraca 200 (pomiar 06.09, lokalna baza) ·
**silnik** = katalog metody w `src/config/` (`toolAvailability.ts:16`) ·
**pack** = pack spisany w `src/toolPacks/registry.ts`.

| # | narzędzie | `toolType` | archetyp sygnaturowy / SPEC-A | kroki (n) | własny ekran biblioteki | otwieralne | silnik | pack |
|---:|---|---|:--:|---|:--:|:--:|:--:|:--:|
| 1 | Dynamic SWOT | `dynamic-swot` | `quadrant-strategic-field` / D | `SWOT_STEPS` (5) | **tak** | **TAK** | ✓ | ✓ |
| 2 | Market Forces (Porter) | `market-forces` | `force-radial` / A | `PORTER_STEPS` (5) | **tak** | nie (404) | ✓ | ✓ |
| 3 | Growth Paths (Ansoff) | `growth-paths` | `quadrant-strategic-field` / D | `GROWTH_PATHS_STEPS` (5) | **tak** | nie (404) | ✓ | ✓ |
| 4 | Value Chain Analysis | `value-chain` | `flow-value-stream` / A | `VALUE_CHAIN_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 5 | Portfolio Prioritization | `portfolio-priority` | `decision-matrix-portfolio` / D | `PORTFOLIO_PRIORITY_STEPS` (5) | **tak** | nie (404) | ✓ | ✓ |
| 6 | Risk & Uncertainty | `risk-uncertainty` | `decision-matrix-portfolio` / D | `RISK_UNCERTAINTY_STEPS` (5) | **tak** | nie (404) | ✓ | ✓ |
| 7 | Capability Mapper | `capability-mapper` | `architecture-capability` / A | `CAPABILITY_MAPPER_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 8 | Ambition Decomposer | `ambition-decomposer` | `architecture-capability` / A | `AMBITION_DECOMPOSER_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 9 | Focus & Trade-offs | `focus-tradeoff` | `decision-matrix-portfolio` / D | `FOCUS_TRADEOFF_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 10 | Narrative & Alignment | `narrative-engine` | `architecture-capability` / A | `NARRATIVE_ENGINE_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 11 | A3 Problem Solving | `a3-problem-solving` | `causal-problem-solving` / A | `A3_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 12 | VSM Builder | `vsm-builder` | `flow-value-stream` / A | `TOOLSET_OPERATIONAL_STEPS` (8) | nie → SWOT | nie (404) | ✗ | ✗ |
| 13 | SOP Builder | `sop-builder` | `operating-model-standard` / B | `SOP_STEPS` (4) | nie → SWOT | nie (404) | ✓ | ✓ |
| 14 | Constraint Control (TOC) | `constraint-control` | `flow-value-stream` / A | `TOOLSET_OPERATIONAL_STEPS` (8) | nie → SWOT | nie (404) | ✗ | ✗ |
| 15 | Decision Engine | `decision-engine` | `decision-matrix-portfolio` / D | `TOOLSET_OPERATIONAL_STEPS` (8) | nie → SWOT | nie (404) | ✗ | ✗ |
| 16 | Control Tower | `control-tower` | `operating-model-standard` / B | `TOOLSET_OPERATIONAL_STEPS` (8) | nie → SWOT | nie (404) | ✗ | ✗ |
| 17 | Automation Pipeline | `automation-pipeline` | `discovery-candidate-funnel` / D | `TOOLSET_OPERATIONAL_STEPS` (8) | nie → SWOT | nie (404) | ✗ | ✗ |
| 18 | SMED Planner | `smed-planner` | `flow-value-stream` / A | `SMED_STEPS` (4) | nie → SWOT | nie (404) | ✓ | ✓ |
| 19 | Daily Management System | `dms-builder` | `operating-model-standard` / B | `DMS_STEPS` (4) | nie → SWOT | nie (404) | ✓ | ✓ |
| 20 | Inventory Autopilot | `inventory-autopilot` | `decision-matrix-portfolio` / D | `INVENTORY_STEPS` (4) | nie → SWOT | nie (404) | ✓ | ✓ |
| 21 | Robotics Feasibility | `robotics-feasibility` | `discovery-candidate-funnel` / D | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 22 | Logistics Automation | `logistics-automation` | `flow-value-stream` / A | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 23 | RPA Scanner | `rpa-scanner` | `discovery-candidate-funnel` / D | `RPA_SCANNER_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 24 | AI Discovery | `ai-discovery` | `discovery-candidate-funnel` / D | `AI_DISCOVERY_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 25 | Integration Diagnostic | `integration-diagnostic` | `architecture-capability` / A | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 26 | Digital Value Pool | `digital-value-pool` | `decision-matrix-portfolio` / D | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 27 | Legacy Analyzer | `legacy-analyzer` | `architecture-capability` / A | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 28 | Data Inventory | `data-inventory` | `architecture-capability` / A | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 29 | Pain-to-Solution Mapper | `pain-to-solution` | `causal-problem-solving` / A | `TOOLSET_DIGITAL_STEPS` (**2**) | nie → SWOT | nie (404) | ✗ | ✗ |
| 30 | Pain Explorer | `pain-explorer` | `causal-problem-solving` / A | `PAIN_EXPLORER_STEPS` (5) | nie → SWOT | nie (404) | ✓ | ✓ |
| 31 | Process Automation | `process-automation` | `flow-value-stream` / A | `PROCESS_AUTOMATION_STEPS` (8) | nie → SWOT | nie (404) | ✓ | ✓ |

**Sumy (zmierzone, nie przepisane):**
* otwieralne dziś: **1 / 31** (`dynamic-swot`); pozostałe 30 = „Już wkrótce” + status „Nieaktywny”;
* własna treść biblioteki: **5 / 31**; treść odziedziczona po SWOT: **26 / 31** (L-2);
* silnik metody w `src/config/`: **19 / 31**; pack spisany: **19 / 31**;
* `RUNTIME_ACTIVE` (manifest z kompletem bramek dla bieżącego SHA): **0 / 31** —
  `reportImplemented: 'FAIL'` i `manualAcceptancePassed: 'NOT_RUN'` dla wszystkich
  (`src/toolPacks/readiness/manifests.ts:445-453`);
* tablice kroków: **21 różnych** na 31 narzędzi; 7 narzędzi ma tylko **2 sekcje**
  (`TOOLSET_DIGITAL_STEPS`) — to najcieńszy dokument sesji w produkcie.

**Sprostowanie liczby z ekranu Biblioteki.** Zmierzony tekst zrzutu listy: **36 wierszy**,
z czego **32** mają plakietkę „Już wkrótce” i **30** status „Nieaktywny”.
Rozbicie: 31 narzędzi (30 „Już wkrótce”) + 5 szablonów metodyk Oceny (2 „Już wkrótce”:
CMMI, Lean 4.0). Zapis „35/36 już wkrótce” z pomiaru A3 jest **o 3 za wysoki** — poprawna
liczba dla samych Narzędzi to **30 z 31**.

**Sekcje specyficzne dla narzędzia — gdzie mieszkają:**
karta biblioteki → klucze `discoveryToolsMain.knownToolDetail.<toolCamel>.{goal,process,outcomes,example}`
(dziś 5 narzędzi); dokument sesji → `TOOL_STEP_DEFINITIONS[toolType]` (`useToolStore.ts:2744`).
**AI per narzędzie:** rubryka jest wspólna dla całego typu `tool`
(`cardAnalysisRubric.ts:459`, 6 kryteriów) — nie różnicuje się per narzędzie i **nie musi**;
różnicuje się kontekst wejściowy (`buildToolAnalysisInput`, `KnownToolDetailView.tsx:2095`),
który wkłada nazwę, opis, „Kiedy używać”, liczbę wejść/kroków/rezultatów tego konkretnego wpisu.

### §8.2. Odwzorowanie archetypu sygnaturowego na SPEC-A (propozycja CTO)

`signatureArchetype` (8 wartości, zmierzone) opisuje KSZTAŁT MERYTORYKI metody.
SPEC-A (A Canvas · B Dokument · C Rekord · D Matryca · E Deck) opisuje KSZTAŁT EKRANU.
To dwie różne osie i dziś nikt ich nie związał — poniżej propozycja, żeby wzorzec archetypu
dało się przypisać do narzędzia bez zgadywania. **To jest propozycja, nie pomiar.**

| `signatureArchetype` | ile narzędzi | SPEC-A | uzasadnienie kształtu centrum | wzorzec |
|---|---:|:--:|---|---|
| `quadrant-strategic-field` | 2 | **D Matryca** | pola/ćwiartki wypełniane pozycjami, każda z oceną | `_wzorzec-narzedzie-archetyp-D.md` |
| `decision-matrix-portfolio` | 6 | **D Matryca** | wiersze scoringowe z osiami wartość × wykonalność | `_wzorzec-narzedzie-archetyp-D.md` |
| `discovery-candidate-funnel` | 4 | **D Matryca** | lejek kandydatów: lista + kwalifikacja | `_wzorzec-narzedzie-archetyp-D.md` |
| `force-radial` | 1 | **A Canvas** | pięć sił wokół środka — układ przestrzenny, nie tabela | `_wzorzec-narzedzie-archetyp-A.md` |
| `flow-value-stream` | 6 | **A Canvas** | łańcuch kroków z przepływem i czasami | `_wzorzec-narzedzie-archetyp-A.md` |
| `causal-problem-solving` | 3 | **A Canvas** | drzewo przyczyn (rybia ość / 5×dlaczego) | `_wzorzec-narzedzie-archetyp-A.md` |
| `architecture-capability` | 6 | **A Canvas** | warstwowa mapa zdolności/architektury | `_wzorzec-narzedzie-archetyp-A.md` |
| `operating-model-standard` | 3 | **B Dokument** | standard operacyjny czytany jak dokument | ten plik + `tool-document.md` |

Sumy policzone z `registry.ts:79-121` (30 wpisów) + `dynamicSwot.pack.ts:232` (1) = **31**.
**Rozkład SPEC-A: D — 12 narzędzi · A — 16 · B — 3 · C/E — 0.**

---

## §9. PYTANIE DO WŁAŚCICIELA (jedno)

**Gdzie ma mieszkać treść 4 sekcji karty biblioteki (Cel · Proces · Rezultat · Przykład)?**

* **(A) Serwerowy katalog treści — rekomendacja.** Rozszerzyć istniejącą kolumnę
  `tools.library_content_translations` o blok `card.{goal,process,outcomes,example}` (pl+en),
  wydawany migracją tak jak dziś opis (`559`, `733`), i czytać go w `KnownToolDetailView`
  zamiast kluczy i18n. Zalety: jedno źródło z resztą wpisu bibliotecznego, treść wydawalna
  bez deployu frontendu, natychmiast rozwiązuje L-2 (26 narzędzi przestaje udawać SWOT-a —
  brak treści = uczciwy stan pusty, nie cudza treść). Koszt: L.
* **(B) Zostawić w `translation.json`** i dopisać 26 brakujących zestawów kluczy.
  Tańsze o migrację, ale każda zmiana treści metodycznej wymaga deployu frontendu, a treść
  merytoryczna rozjeżdża się z bazą narzędzi.

Rekomendacja CTO: **(A)**. Do czasu decyzji naprawiamy L-2 minimalnie: gałąź domyślna
przestaje zwracać komponenty Dynamic SWOT i pokazuje stan „Opis metody w przygotowaniu”
zbudowany z pól `Api.getKnownTool` (`whenToUse`, `inputs`, `steps`, `outputs`,
`commonMistakes`, `example`), które **istnieją dla 31/31**.
