# Wzorzec: narzędzie archetypu **D — Matryca** (kontrakt centrum)

> Wzorzec, nie karta. Powłoka i prawy panel biorą się z kontraktu bazowego
> (`tool-document.md` §0–§3 dla dokumentu sesji, `tool.md` dla wpisu bibliotecznego).
> Ten plik opisuje **wyłącznie CENTRUM** — to jedyna rzecz, którą archetyp zmienia (SPEC-A §13).
> Obejmuje **12 z 31 narzędzi** (`tool.md` §8.2) oraz pozycje **#19 megatrendy** i **#20 karta trendu**.
> Pomiar 06.09.2026: `evidence/p10b2/15-tooldoc-pracujzai.png` (SWOT — jedyna żywa matryca),
> `evidence/p10b2/19-megatrends.png`, `evidence/p10b2/20-trend.png`.

---

## §1. Kiedy narzędzie jest D

`signatureArchetype` ∈ { `quadrant-strategic-field`, `decision-matrix-portfolio`,
`discovery-candidate-funnel` } — źródło: `src/toolPacks/registry.ts:79-121`,
`src/toolPacks/packs/dynamicSwot.pack.ts:232`.

**12 narzędzi:** dynamic-swot · growth-paths · portfolio-priority · risk-uncertainty ·
focus-tradeoff · inventory-autopilot · decision-engine · digital-value-pool ·
automation-pipeline · robotics-feasibility · rpa-scanner · ai-discovery.
**Osiągalne dziś: 1** (`dynamic-swot`) — reszta za bramką MVP (`tool.md` §7 L-1).

Rozpoznanie po kształcie treści, nie po nazwie: centrum jest **siatką pozycji ocenianych
wzdłuż dwóch osi** (ćwiartki SWOT, wartość × wykonalność portfela, kwalifikacja kandydata).

---

## §2. Kontrakt CENTRUM (D)

| element | wymóg | dowód, że da się spełnić |
|---|---|---|
| D-1 | Centrum to **jedna siatka**, nie N osobnych list. Pozycja należy do dokładnie jednej komórki i widać, do której | `SWOTMatrix.tsx` (149 linii), `PortfolioMatrixStep.tsx` (75) |
| D-2 | Każda komórka ma **licznik pozycji** i stan pusty ze zdaniem, co tu wstawić — nie samo „0” | wzorzec z prawego panelu `tool` (`KnownToolDetailView.tsx:2204-2226`) |
| D-3 | Pozycja niesie **ocenę i pochodzenie**: kto/co ją wstawiło (człowiek / propozycja AI) i na jakim dowodzie | `swot_proposals` + znacznik akceptu (`ToolDocumentView.tsx:2565-2586`) |
| D-4 | Pozycja z AI wchodzi do siatki **wyłącznie przez „Zaakceptuj”** — nigdy auto-zapisem | mechanizm już istnieje i jest jedyną drogą (`:2571`) |
| D-5 | Siatka ma **własny kontener przewijania** — nigdy nie przewija strony w poziomie (K20) | do zrobienia |
| D-6 | Wyjście z matrycy jest **nazwane rzeczownikowo**: „Utwórz inicjatywę z ruchu”, nie „Generuj” | `shared/createInitiativeFromMove.tsx` |
| D-7 | **Zero `primary-*`** w komórkach — zaznaczenie i „AI” to stany neutralne, nie awaria | dziś ✗, patrz §4 |
| D-8 | Etykiety osi i ćwiartek z `t()`, po polsku | dziś ✗ dla 4 narzędzi (`tool-document.md` §1.2) |

**Sekcje specyficzne dla narzędzia** = `TOOL_STEP_DEFINITIONS[toolType]` (`useToolStore.ts:2744`).
Dla D krok siatki to ten, którego `id` odpowiada wpisowi w `analysisStepIds`
(`toolAiActions.ts:154-165`): `swot`, `options`, `items`, `assumptions`, `priorities`.

**AI w archetypie D** (co „Pracuj z AI” robi w tym kształcie):
* **Analizuj** — ocenia siatkę: czy ćwiartki są zbalansowane, czy pozycje mają dowody,
  czy nie ma dubletów. Rubryka: do dopisania (`tool-document.md` §4, K24).
* **Uzupełnij tę sekcję** — propozycje do **komórki, na którą użytkownik patrzy**
  (dziś zaimplementowane wyłącznie dla `dynamic-swot`: `TeresaSwotProposals`).
* **Uzupełnij cały dokument** — propozycje do wszystkich komórek naraz, każda z osobnym akceptem.

---

## §3. #19 Megatrendy — matryca bez powłoki (pomiar)

| pole | wartość |
|---|---|
| trasa | `/discovery-tools/strategic/megatrends` (`routes/routeConfig.ts:50`, mount `AppRoutes.tsx:2100-2120`) |
| komponent | `src/components/Megatrend/MegatrendsWorkspace.tsx:33` (208 linii) |
| powłoka | **brak** — zwykły `<div className="space-y-6">` (`:111`) |
| prawy panel | **brak** |
| Menu 5 | **brak**; zamiast tego własny pasek zakładek (`:136`): Baseline branżowy · Mapa radaru trendów · Szczegóły trendu · Własne trendy · Wnioski AI |
| AI | **brak** `PracujZAI`; zakładka „Wnioski AI” to osobny komponent `AIInsightsCard` |
| dane | `GET /api/megatrends/baseline?industry=…` → **503 `not_configured`** na stanowisku; UI pokazuje uczciwy stan „Nie udało się wczytać megatrendów” + „Spróbuj ponownie” |
| K25 | **✗ zmierzone**: „Industry Standard Trends: Automotive” (`IndustryBaselineCard.tsx:42`) i „Below are the top megatrends affecting your industry globally. AI has prioritized these…” (`:45`) — angielskie zdania w polskim UI, widoczne na zrzucie |
| K29 | **✗** 2× 503 w konsoli |
| dane pokazowe w kodzie | `customTrends` startuje z zaszytym rekordem „Local Competitor Pricing / Aggressive undercutting in Q3” (`MegatrendsWorkspace.tsx:60-67`) — angielska atrapa w stanie początkowym |

**Kontrakt dla #19:** megatrendy mają wejść na powłokę `NModeShell` + `ArtifactRightPanel`
jak `tool-document`, zakładki mają stać się sekcjami lewego spisu (K13), a „Wnioski AI”
ma zniknąć jako osobna zakładka i wejść pod „Pracuj z AI → Analizuj” (K21).
Rozmiar **L**.

---

## §4. #20 Karta trendu — rekord otwierany z matrycy (pomiar)

| pole | wartość |
|---|---|
| komponent | `src/components/Megatrend/TrendDetailCard.tsx:45` (313 linii) |
| archetyp | **C — Rekord** (nie D) — kontrakt powłoki jak `tool.md`, treść jak niżej |
| wołacze | `MegatrendsWorkspace.tsx:176` (zakładka „Szczegóły trendu”) i `views/ContextBuilder/modules/MegatrendScannerModule.tsx:139` — **dwa wołacze, jedna karta** |
| dane | `fetch('/api/megatrends/:id')` **bez nagłówka `Authorization`** (`:60`) — inaczej niż `megatrendStore.ts:25-31`, które token dokłada; to niespójność do sprawdzenia przy naprawie |
| i18n | **`grep -c "t('"` = 0** — cały komponent bez `t()`, literały zaszyte |
| powłoka / prawy panel / Menu 5 / AI | **brak wszystkiego** |
| osiągalność | **NIE DA SIĘ ODEBRAĆ WZROKIEM**: bez danych megatrendów zakładka pokazuje „Wybierz trend z Baseline lub Mapy radaru, aby zobaczyć szczegóły.” (`evidence/p10b2/20-trend.png`) |

**STOP:** kontrakt #20 opisany z kodu. Odbiór wzrokiem wymaga skonfigurowania źródła
megatrendów (503 `not_configured`) — to zmiana środowiska, nie kodu, więc poza zakresem
tej partii. Nie twierdzę, że karta działa.

---

## §5. Czytelność — dług `primary-*` w archetypie D

Zmierzone: **26 plików** w `src/components/DiscoveryTools/` używa `primary-[0-9]`,
łącznie **73 trafienia**; **21 z nich siedzi w `tools/DynamicSWOT/`** — czyli w jedynym
narzędziu, które klient dziś może otworzyć.

Punktowo, w centrum matrycy:
* `visualizations/SWOTMatrix.tsx:116` — `text-primary-500` na znaczniku „AI” przy pozycji;
* `visualizations/PorterRadar.tsx:114` — `text-primary-600 dark:text-primary-400` na wyniku siły;
* `tools/ValueChain/ValueChainPhases.tsx:344` — `text-primary-500` na etykiecie kroku.

`primary-*` w Tailwindzie = crimson #85182F, zarezerwowany dla semantyki krytycznej
(CLAUDE.md, pułapka nr 1). Znacznik „AI” i wynik oceny nie są awarią.
**Kontrakt: `c-ai` dla akcentu AI, `c-focus` dla fokusu, `c-text-*` dla reszty.**
Rozmiar naprawy całej rodziny: **L** (73 trafienia); rodzina `DynamicSWOT` sama: **M** (21).

**Uwaga metodyczna:** to jest dokładnie „naprawa per-wywołanie odrasta” — łatanie jednego
pliku nie ruszy pozostałych 25. Naprawa ma iść jedną falą po całym katalogu
`src/components/DiscoveryTools/`, z bezpiecznikiem `scripts/check-artefakt.sh`.
