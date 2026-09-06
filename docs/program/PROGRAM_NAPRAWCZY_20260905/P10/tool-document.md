# Dokument sesji narzędzia (`tool-document`) — kontrakt karty N

> Pozycja **#15** inwentarza, z aliasami **#16** (`tool-document-generic`), **#17** (`tool-trace`)
> i **#18** (`tool-workspace`) — jedna encja „sesja narzędzia”, cztery renderery.
> Kontrakt **bazowy dla 31 egzemplarzy** (rozstrzygnięcie CTO: `tool.md` §8).
> Pomiar na żywo 06.09.2026, API `127.0.0.1:4100`, vite `3131`, org DBR77.
> Zrzut: `evidence/p10b2/15-tooldoc-pracujzai.png` (1440 · jasny · **„Pracuj z AI” rozwinięte**,
> `bledyKonsoli` = 0). Zrzut z P10-S: `evidence/p10-matryca/17-tooldoc.png`.

---

## §0. Tożsamość

| pole | wartość (zmierzona) |
|---|---|
| nazwa PL | **Sesja narzędzia (dokument roboczy)** |
| moduł | `03_TOOLS` — Narzędzia |
| archetyp | **B — Dokument** (powłoka) z centrum wymiennym per archetyp sygnaturowy (`tool.md` §8.2) |
| trasa | `/discovery-tools?tab=sessions&docId=<sessionId>` |
| jak otworzyć z listy | Narzędzia → **Sesje** → wiersz (podgląd) → **„Otwórz”** |
| komponent | `src/components/DiscoveryTools/ToolDocumentView.tsx:261` (2740 linii) |
| dyspozytor | `src/components/Discovery/DiscoveryToolsHub.tsx:3968-4045` |
| powłoka dziś | `NModeShell` (`:2523`) + `ArtifactRightPanel` (`:2525`) + `NModeMenu2` jako Menu 5 (`:2542`) |
| kontrakt sekcji | **brak katalogu `KanonicznaKarta`**; sekcje z `TOOL_STEP_DEFINITIONS` (`src/store/useToolStore.ts:2744`) przez `resolveToolStepDefinitions` (`:2780`) → `getStepDefinitions()` (`ToolDocumentView.tsx:320`) |
| rejestr | **poza rejestrem** — jawny wyjątek w `registry.kompletnosc.test.ts` |
| API | `GET/PATCH /api/tools/:id`, lista `GET /api/tools` |

### §0.1. Cztery renderery jednej encji — stan zmierzony

| poz. | renderer | kiedy się odpala | stan |
|---|---|---|---|
| **#15** | `ToolDocumentView.tsx:261` | `hasDedicatedToolDocumentView(toolType)` — **31/31 typów** (`dedicatedToolTypes.ts:8-38`) **ORAZ** narzędzie aktywne w katalogu (`DiscoveryToolsHub.tsx:3995-4011`) | ŻYWY; realnie dla **1 z 31** (§6 L-1) |
| **#16** | `GenericToolDocumentView.tsx:27` | `tool_type` spoza `DEDICATED_TOOL_TYPES` (`DiscoveryToolsHub.tsx:4065`) | osiągalny tylko przy skażonych danych; **na stanowisku 0 takich sesji** |
| **#17** | `MyWorkTraceDocumentView.tsx:72` | `tool_type === 'MYWORK'` (`DiscoveryToolsHub.tsx:4054`) | jw.; **na stanowisku 0 sesji `MYWORK`** |
| **#18** | `ToolWorkspace.tsx:156` (953 linie) | **NIGDZIE** — jedyny wołacz to `OperationalToolsView.tsx:223`, a ten nie jest zamontowany na żadnej trasie | **MARTWY** — patrz L-6 |

**Pomiar sesji (żywe API, `GET /api/tools?limit=200`):** `total = 5`, wszystkie
`toolType = 'dynamic-swot'` (`DRAFT` 1 · `REVIEW` 1 · `APPROVED` 3).
Zero sesji dla pozostałych 30 narzędzi, zero sesji `MYWORK` → **#16 i #17 są dziś nieosiągalne**
na tym stanowisku i nie da się ich odebrać wzrokiem. To STOP, nie „ok” (§7).

---

## §1. SEKCJE (kontrakt treści)

Sekcje **nie są stałe** — to jest cecha, nie brak: dokument sesji odwzorowuje kroki metody.
Katalog: `TOOL_STEP_DEFINITIONS: Record<ToolType, StepDefinition[]>` (`useToolStore.ts:2744`),
31 kluczy → **21 różnych tablic**. Powłoka dokłada sekcje wspólne.

### §1.1. Sekcje wspólne (każda sesja, niezależnie od narzędzia)

| sekcja (id) | po co użytkownikowi | źródło danych | reguła pustki | kol. |
|---|---|---|---|---|
| kroki metody (`step.id` × n) | prowadzenie pracy krok po kroku | `TOOL_STEP_DEFINITIONS[toolType]` + `session.inputData` → writer `PATCH /api/tools/:id` (`updateInputData`) | krok bez danych zostaje z licznikiem luk | 0…n-1 |
| Wyniki i działania (`outputs`/`report`/`initiatives`) | co z sesji wychodzi dalej | `generatedInitiatives` + `swotData.outputCandidates` → `tool_sessions.output_json` | licznik 0, sekcja zostaje (ostatni krok metody) | n |
| Komentarze (`comments`) | rozmowa o sesji | `nModeComments` | „Brak komentarzy.” | n+1 |
| Aktywność (`activity`) | co się w sesji działo | log sesji | — | n+2 |
| „Used in” (`used-in`) | gdzie wynik został użyty | backlinki | — | n+3 |
| Panel współpracy AI (`ai-collaboration`) | tylko dla narzędzi **innych niż** `dynamic-swot` (`:1980-1985`, `:2021-2026`) | — | — | warunkowa |

**★ Trzy etykiety łamią K25 wprost — `pl` = `en`:**
`label: { en: 'Review', pl: 'Review' }` (`ToolDocumentView.tsx:2002`),
`{ en: 'AI Collaboration Panel', pl: 'AI Collaboration Panel' }` (`:1983` i `:2024`),
`{ en: 'Used in', pl: 'Used in' }` (`:2076`). Polskie UI pokazuje angielskie nagłówki
lewej szyny obok „Praca” i „Komentarze”. Rozmiar S.

**★ Id sekcji zapisane jako `['comments'].join('')` (`:2028`)** — obfuskacja literału.
Jedyny sens takiego zapisu to ominięcie skanera treści; do wyprostowania przy naprawie K25.

### §1.2. Sekcje specyficzne dla narzędzia (parametr, nie 31 plików)

Pełna tabela 31 narzędzi z nazwą tablicy kroków i liczbą sekcji: **`tool.md` §8.1**.
Rozkład zmierzony:

| tablica kroków | narzędzia | n sekcji | uwaga |
|---|---|---:|---|
| `SWOT_STEPS` | dynamic-swot | 5 | jedyna dziś osiągalna; PL kompletne |
| `PORTER_/GROWTH_PATHS_/PORTFOLIO_PRIORITY_/RISK_UNCERTAINTY_STEPS` | 4 narzędzia | 5 | **`namePl` = angielski** dla wszystkich kroków (`useToolStore.ts:1417, 1709, 1758, 1807`) — K25 |
| `VALUE_CHAIN_/CAPABILITY_MAPPER_/AMBITION_DECOMPOSER_/FOCUS_TRADEOFF_/NARRATIVE_ENGINE_STEPS` | 5 | 5 | PL kompletne |
| `SOP_/SMED_/DMS_/INVENTORY_STEPS` | 4 | 4 | PL kompletne |
| `A3_/RPA_SCANNER_/AI_DISCOVERY_/PAIN_EXPLORER_STEPS` | 4 | 5 | PL kompletne |
| `TOOLSET_OPERATIONAL_STEPS` | 5 narzędzi | 8 | wspólna |
| `PROCESS_AUTOMATION_STEPS` | process-automation | 8 | — |
| `TOOLSET_DIGITAL_STEPS` | **7 narzędzi** | **2** (`context`, `fill`) | **najcieńszy dokument w produkcie** — dwie sekcje na całą metodę |

**Kontrakt:** liczba sekcji dokumentu sesji = `TOOL_STEP_DEFINITIONS[toolType].length` + 5 sekcji
wspólnych. Zmiana kroków metody = zmiana kontraktu, nie refaktor. Narzędzie na
`TOOLSET_DIGITAL_STEPS` **nie spełnia kontraktu** — 2 sekcje nie opisują metody (luka L-5).

---

## §2. PRAWY PANEL (`ToolDocumentView.tsx:2305-2385`)

| # | sekcja | stan | uwaga |
|---|---|---|---|
| ① | **Akcje** | ✓ zadeklarowana, rozwinięta | `lifecycleControls`: „Szkic · Poproś o przegląd” (zrzut) |
| ② | **Właściwości = TABELA** | ✓ `ArtifactPropertiesTable` (`:2320`) | 6 wierszy: Typ narzędzia · Kategoria · Status · Etap konsultingowy · Aktualny krok · Postęp |
| ③ | Powiązania | ✓ (`:2332`) | `toolBacklinks`, na pomiarze 0 |
| ④ | Źródła i założenia | ✓ (`:2349`) | |
| ⑤ | Rezultaty | ✓ (`:2362`) | licznik inicjatyw + kandydatów wyjścia |
| ⑥ | Komentarze | ✓ (`:2374`) | |
| ⑦ | **Historia** | **niezadeklarowana w karcie** — dokłada ją powłoka | `ArtifactRightPanel` domyka komplet obowiązkowych sekcji (`ArtifactRightPanel.tsx:65-75, 376-380`), dlatego „HISTORIA” widać na zrzucie. Karta ma ją zadeklarować jawnie z treścią (dziennik zmian sesji) albo z powodem pominięcia — milczenie jest błędem (K10) |

**Kolejność wierszy tabeli Właściwości — kontrakt:** Status → Właściciel → Etap → Aktualny krok →
Postęp → Typ narzędzia → Kategoria → Utworzono → Zaktualizowano.
Dziś: Typ narzędzia jest **pierwszy** i pokazuje surowy slug `dynamic-swot` (K7 kolejność + K28);
**brak wierszy Właściciel, Utworzono, Zaktualizowano**, mimo że API je zwraca
(`createdBy`, `createdAt`, `updatedAt` — potwierdzone w odpowiedzi `GET /api/tools`).
Etykiety poza `t()` (`isPolish ? 'Akcje' : 'Actions'` itd., `:2308-2380`) — K25, rozmiar S.

---

## §3. MENU 5 I NAWIGACJA

Zmierzone (zrzut): pasek Menu 5 **istnieje od 06.09.2026** (`renderActionBar`, `:2541-2589`)
i zawiera **wyłącznie „Pracuj z AI”**.

| element kanonu | dziś | kontrakt |
|---|---|---|
| „Sekcje ▾” (lewa) | **brak** | dodać — dokument ma 5–13 sekcji, spis bez filtra jest nieużywalny przy 8 krokach |
| „Edycja / Podgląd” (środek) | **brak**; komentarz w kodzie mówi wprost „sesja narzędzia nie zna trybu podglądu… dokładanie atrapy byłoby obietnicą bez pokrycia” (`:2536-2540`) | **ZGODNE z K14 tymczasowo**, ale powód ma być **wypisany na ekranie**, nie tylko w komentarzu |
| „Pracuj z AI ▾” (prawa) | ✓ `PracujZAI` z **dokładnie trzema** pozycjami — potwierdzone na zrzucie: „Analizuj · Uzupełnij tę sekcję · Uzupełnij cały dokument” | bez zmian |
| sticky (K15) | ✓ | |
| pigułka modułu (K19) | ✓ „Lista · dynamic-swot · SWOT — marża…” | drugi człon → `display_name` (K28) |

**K26:** z listy Sesje: klik → podgląd, „Otwórz” → karta. ✓ (zmierzone dwoma klikami).

---

## §4. AI (K21–K24)

**Zmierzony stan: „Pracuj z AI” jest poprawne, ale NIE JEST JEDYNE.**

| pozycja | co robi | z czego | stan |
|---|---|---|---|
| **Analizuj** | ocenia bieżącą sekcję wobec rubryki | `buildToolAnalysisInput` (`:2409`) → `artifactType: 'tool'`, rubryka `cardAnalysisRubric.ts:459` (6 kryteriów) | ✓ działa (dowód: analiza karty `tool` w `evidence/p10b2/14-tool-analizuj.png`) |
| **Uzupełnij tę sekcję** | propozycje pozycji do ćwiartki, na którą patrzysz | `TeresaSwotProposals` → tabela `swot_proposals`, akcept/odrzut po stronie serwera (`:2565-2574`) | ✓ dla `dynamic-swot`; **wyszarzone dla 30 pozostałych** (`swotProposalsDostepne`) — zgodnie z K23 |
| **Uzupełnij cały dokument** | propozycje we wszystkich czterech ćwiartkach | jw. (`:2576-2586`) | jw. |

**K22 propozycja → Zatwierdź: ✓ udowodnione mechanizmem, nie deklaracją** — każda propozycja ma
„Zaakceptuj”/„Odrzuć”, do macierzy trafia wyłącznie zaakceptowana (`:2571`).

**★ NARUSZENIE K21 — drugie, inaczej nazwane wejście AI.** W treści dokumentu, obok Menu 5,
renderuje się pasek `ToolPhaseAiActions` (`ToolDocumentView.tsx:2265`) z nagłówkiem
**„COPILOT AI”** (`shared/ToolPhaseAiActions.tsx:49`, klucz
`discoveryToolsSteps.toolPhaseAiActions.aiCopilot`) i przyciskami **„Wyostrz z AI”** oraz
**„Szkicuj z AI”** (`toolAiActions.ts:177, 185`). Potwierdzone na zrzucie
(`evidence/p10b2/15-tooldoc-pracujzai.png`, tekst: „COPILOT AI / Wyostrz z AI / Szkicuj z AI”).
K21 zakazuje tego wprost, wymieniając te trzy nazwy z imienia.
**Uwaga:** to nie jest zwykły duplikat — te akcje są **per krok metody** (`getToolPhaseAiActions`),
czyli niosą funkcję, której `PracujZAI` dziś nie ma. Naprawa nie może być kasowaniem: akcje
kroku mają wejść **pod „Uzupełnij tę sekcję”** jako `wlasnaPropozycja` zależna od kroku.
Rozmiar M.

**K24 — luka rejestrowa.** `tool-document` **nie jest typem** `CardAnalysisArtifactType`
(= `KartaNKey`, `registry.ts:32-52`); karta pożycza rubrykę typu `tool`
(`buildToolAnalysisInput` ustawia `artifactType: 'tool'`, `:2409`). Rubryka `tool` ocenia
**wpis biblioteczny** (cel/proces/rezultat/przykład metody), nie **sesję** (kompletność wejść
klienta, jakość dowodów, gotowość do wyjścia). To znaczy, że „Analizuj” w sesji ocenia
niewłaściwym miernikiem. Propozycja wpisu do tabeli K24 SSOT:

| karta | kryteria oceny w rubryce | katalog kart | co AI może uzupełnić | tylko do odczytu |
|---|---|---|---|---|
| `tool-document` | **do dopisania**: kompletność wejść sesji · jakość dowodów · spójność kroku z metodą · gotowość do wyjścia (Inicjatywa/Raport/Deck) | `TOOL_STEP_DEFINITIONS[toolType]` jako katalog sekcji | pozycje ćwiartek/wierszy kroku (przez propozycję), podsumowanie kroku | status sesji, postęp, dowody wgrane przez człowieka, wygenerowane inicjatywy |

---

## §5. CZYTELNOŚĆ (K17–K20, K25, K28)

* **K17 `primary-*`: 2 trafienia — do usunięcia.**
  `ToolDocumentView.tsx:140` — `statusDot: 'bg-primary-400'` w `TOOL_META['growth-paths']`;
  `ToolDocumentView.tsx:1282` — pigułka aktywnego kroku
  `bg-primary-500/15 text-primary-700 dark:text-primary-300`.
  `primary-*` = crimson #85182F; aktywny krok to stan neutralny, nie awaria. Rozmiar S.
* **K25:** 4 etykiety `pl` = `en` (§1.1); `namePl` po angielsku w 4 tablicach kroków (§1.2);
  etykiety prawego panelu poza `t()` (§2).
* **K28:** „Typ narzędzia: `dynamic-swot`” w tabeli Właściwości i w pigułce modułu.
* **K27 Teresa:** 15 wystąpień słowa „Teresa” w pliku, wszystkie **w opisach pozycji
  `PracujZAI`** i w nagłówku szuflady „Propozycje Teresy” (`:2612-2632`). To **nie** jest drugi
  czat — to nazwana mechanika propozycji z akceptem, wołana z kanonicznego Menu 5.
  Wpis matrycy P10-S „Teresa poza Menu 1” dotyczył **poprzedniego** kształtu („Zapytaj Teresę”
  w Menu 1 + wyskakujące okno) i został naprawiony 06.09 (`:2398-2404`).
  **Do rozstrzygnięcia w §7 L-7:** czy nazwa własna „Teresa” może zostać w opisie pozycji
  Menu 5, czy ma zniknąć na rzecz „AI”.
* **K20:** 1440 ✓ (zmierzone); 1280 niezmierzone.
* **K29:** `bledyKonsoli` = 0 na trasie klikanej.

---

## §6. STAN ZASTANY vs KONTRAKT — matryca K1–K30

| K | wymóg | stan | dowód |
|---|---|:--:|---|
| K1 | katalog sekcji istnieje | ~ | `TOOL_STEP_DEFINITIONS` (`useToolStore.ts:2744`) daje się policzyć, ale to `StepDefinition`, nie `KanonicznaKarta` — brak roli AI, grupy, klasy |
| K2 | katalog steruje renderem | ✓ | sekcje powstają z `stepDefs.map` (`:1955`) — bez flagi |
| K3 | każda sekcja ma źródło | ✓ | `session.inputData` → `PATCH /api/tools/:id` |
| K4 | reguła pustki | ~ | krok bez danych zostaje z licznikiem luk (świadome — to lista pracy, nie raport) |
| K5 | etykiety i kolejność wg katalogu | ~ | kolejność ✓; 4 etykiety `pl`=`en`, 4 tablice kroków z angielskim `namePl` |
| K6 | Akcje pierwsze | ✓ | `:2308` |
| K7 | Właściwości = tabela | ~ | tabela ✓; kolejność niekanoniczna, brak Właściciel/Utworzono/Zaktualizowano |
| K8 | Powiązania | ✓ | `:2332` |
| K9 | Źródła i założenia | ✓ | `:2349` |
| K10 | Komentarze / Historia | ~ | Komentarze ✓; **Historia niezadeklarowana** — dokłada ją powłoka |
| K11 | jeden panel po prawej | ✓ | `:2525` |
| K12 | Menu 5 z trzema elementami | ~ | pasek jest, ale ma **1 z 3** elementów (`:2541`) |
| K13 | lewy spis sekcji z grupami | ✓ | SESJA / ANALIZA / REZULTATY (zrzut), bez ucięć |
| K14 | Edycja/Podgląd wg prawa | ~ | brak przełącznika z powodem **w komentarzu kodu**, nie na ekranie |
| K15 | nagłówki sticky | ✓ | |
| K16 | drabina S/L | ~ | poza rejestrem → brak deklaracji klasy; realnie L (5–13 sekcji) |
| K17 | zero `primary-*` | ✗ | `:140`, `:1282` |
| K18 | fokus `c-focus` | ✓ | `c-focus` na kaflach faz (`:1170`) |
| K19 | pigułka w pasku modułu | ~ | jest; drugi człon = slug |
| K20 | 1440 / 1280 | ~ | 1440 ✓; 1280 niezmierzone |
| K21 | „Pracuj z AI” z 3 pozycjami | ~ | trzy pozycje ✓ (zrzut), ale **drugie wejście „COPILOT AI / Wyostrz z AI / Szkicuj z AI”** łamie zakaz |
| K22 | propozycja → Zatwierdź | ✓ | `swot_proposals` + Zaakceptuj/Odrzuć (`:2571`) |
| K23 | po polsku i wg uprawnień | ✓ | `moznaEdytowac: toolStatus !== 'APPROVED'`, powód „sesja zatwierdzona” (`:2557`) |
| K24 | deklaracja AI per typ | ✗ | `tool-document` poza `CardAnalysisArtifactType`; pożycza rubrykę `tool` (§4) |
| K25 | i18n bez angielskiego | ✗ | 4 etykiety `pl`=`en` + 4 tablice kroków z angielskim `namePl` |
| K26 | podgląd na klik, karta przez „Otwórz” | ✓ | zmierzone |
| K27 | Teresa tylko w Menu 1 | ~ | brak drugiego czatu; nazwa własna w opisach Menu 5 — do rozstrzygnięcia |
| K28 | brak identyfikatorów technicznych | ✗ | slug w tabeli i pigułce |
| K29 | zero błędów konsoli | ✓ | `bledyKonsoli = 0` |
| K30 | odbiór na zrzucie 1440 z otwartym AI | ✓ | `evidence/p10b2/15-tooldoc-pracujzai.png` |

**Wynik: ✓ 13 · ~ 12 · ✗ 5 (z 30).**

---

## §7. LUKI → NAPRAWA

| # | luka | rozmiar | decyzja właściciela? |
|---|---|:--:|---|
| L-1 | **Dokument otwiera się dla 1 z 31 narzędzi.** Bramka MVP powtórzona na froncie: sesja nieaktywnego narzędzia pokazuje `SharedEmptyState variant="forbidden"` „Narzędzie jest nieaktywne” zamiast dokumentu (`DiscoveryToolsHub.tsx:3995-4011`) | — | **NIE — zamrożona decyzja właściciela** (`approvedMvpToolTypes.ts:21`) |
| L-2 | K21: drugie wejście AI „COPILOT AI / Wyostrz z AI / Szkicuj z AI”; akcje kroku wciągnąć pod „Uzupełnij tę sekcję” | **M** | nie |
| L-3 | K24: własna rubryka `tool-document` + wpis do `KartaNKey`/`CardAnalysisArtifactType` | **M** | nie |
| L-4 | K25: 4 etykiety `pl`=`en` (`:1983, :2002, :2024, :2076`) + `namePl` po angielsku w `PORTER_/GROWTH_PATHS_/PORTFOLIO_PRIORITY_/RISK_UNCERTAINTY_STEPS` | S | nie |
| L-5 | 7 narzędzi na `TOOLSET_DIGITAL_STEPS` ma **2 sekcje** na całą metodę (robotics-feasibility, logistics-automation, integration-diagnostic, digital-value-pool, legacy-analyzer, data-inventory, pain-to-solution) | **L** | **TAK — §8** |
| L-6 | **#18 `ToolWorkspace.tsx` (953 linie) jest martwy** — jedyny wołacz `OperationalToolsView.tsx:223` nie jest zamontowany na żadnej trasie; cały katalog `src/views/discovery-tools/` (5 widoków) nie ma ani jednego importera poza własnym barrelem. Import w `DiscoveryToolsHub.tsx:88` jest nieużywany | M | nie — usunięcie |
| L-7 | K27: nazwa własna „Teresa” w opisach pozycji Menu 5 | S | **TAK — §8** |
| L-8 | K17: 2× `primary-*` (`:140`, `:1282`) | S | nie |
| L-9 | K7: kolejność wierszy Właściwości + brakujące Właściciel/Utworzono/Zaktualizowano | S | nie |
| L-10 | K10: Historia niezadeklarowana (dokłada powłoka) | S | nie |
| L-11 | K12: brak „Sekcje ▾” w Menu 5 | M | nie |
| L-12 | K28: slug zamiast `display_name` | S | nie |
| L-13 | `['comments'].join('')` zamiast literału (`:2028`) | S | nie |

---

## §8. PYTANIE DO WŁAŚCICIELA (jedno, łączone)

**Czy „Teresa” zostaje nazwą własną w opisach pozycji „Pracuj z AI” w sesji narzędzia?**

* **(A) ZOSTAJE — rekomendacja.** DEC-404/419 zabrania drugiego CZATU w karcie, a nie
  wymieniania asystentki z imienia. Dziś opis brzmi „Teresa zaproponuje pozycje do ćwiartki…
  Każda propozycja ma «Zaakceptuj» i «Odrzuć»”. To jest uczciwe: mówi, kto proponuje i że nic
  nie wchodzi bez akceptu. Koszt: bramka „zrzut karty nie zawiera słowa Teresa poza Menu 1”
  (K27 SSOT) trzeba doprecyzować, bo dziś ta karta ją oblewa mechanicznie.
* **(B) ZNIKA** — opisy mówią „AI”, szuflada nazywa się „Propozycje AI”. Bramka K27 zostaje
  dosłowna. Koszt: produkt traci jedyne miejsce, gdzie asystentka ma imię przy realnej pracy.

Rekomendacja CTO: **(A) + doprecyzowanie K27** na: „zakaz drugiego CZATU i osobnego przycisku
wejścia do Teresy; nazwa własna w opisie pozycji kanonicznego Menu 5 jest dozwolona”.

**Poboczne (bez pytania, decyzja CTO):** 7 narzędzi na `TOOLSET_DIGITAL_STEPS` (L-5) **nie
dostaje kontraktu na 2 sekcje** — dopóki nie mają kroków metody, ich dokument sesji ma
pozostać niedostępny (dziś i tak jest, przez bramkę MVP). Kontrakt nie legalizuje
dwusekcyjnej metody.

---

## §9. STOP-y

1. **#16 `GenericToolDocumentView` i #17 `MyWorkTraceDocumentView` — nie da się odebrać wzrokiem.**
   Na stanowisku 0 sesji spoza `dynamic-swot` i 0 sesji `MYWORK` (pomiar `GET /api/tools`).
   Kontrakt opisany z kodu; **nie zgaduję wyglądu i nie twierdzę, że działa**.
   Przepis do domknięcia: wstawić na bazie testowej jedną sesję o `tool_type='MYWORK'` i jedną
   o typie spoza rosteru, zrobić dwa zrzuty, usunąć rekordy i policzyć 0.
   Nie robię tego tutaj — zlecenie zabrania rekordów testowych bez sprzątania w tej samej sesji,
   a oba renderery są poza ścieżką MVP.
2. **#18 `ToolWorkspace` — martwy, kontraktu nie piszę.** Zamiast kontraktu: wniosek o usunięcie
   (L-6). Pisanie kontraktu na ekran bez trasy to dokumentowanie nieistniejącego produktu.
