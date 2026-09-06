# Wzorzec: narzędzie archetypu **A — Canvas** (kontrakt centrum)

> Wzorzec, nie karta. Powłoka, prawy panel i Menu 5 biorą się z kontraktu bazowego
> (`tool-document.md` §0–§3). Ten plik opisuje **wyłącznie CENTRUM** (SPEC-A §13).
> Obejmuje **16 z 31 narzędzi** (`tool.md` §8.2) oraz pozycję **#18 `tool-workspace`**.
> Pomiar 06.09.2026, stanowisko lokalne. **Ani jedno narzędzie archetypu A nie jest dziś
> otwieralne** — jedyne aktywne narzędzie (`dynamic-swot`) jest archetypu D.

---

## §0. Granica wobec partii B6 — nie dubluję

Cztery tryby warsztatu pomysłu (**#5 mapa myśli · #6 proces · #7 tablica · #8 tabela**)
dostają kontrakt w **partii B6** (`P10/idea.md`), na powłoce `ExecutiveModuleShell`
(`src/components/MyWork/IdeaMapWorkspace.tsx:357`). To są **inne ekrany, inny moduł**
(`07_MY_WORK_AGENT`) i inna encja (pomysł, nie sesja narzędzia).

**Co z B6 obowiązuje także tutaj (odwołanie, nie kopia):**
kanon płótna — przybliżanie/dopasowanie, siatka, zaznaczenie, cofanie, eksport —
opisuje `P10/idea.md`; wzorzec A dla Narzędzi **przejmuje go bez zmian** i dokłada wyłącznie
to, czego pomysł nie ma: powiązanie płótna z **krokiem metody** i z **wyjściem sesji**.
Jeśli oba kontrakty się rozjadą, rozstrzyga `P10/idea.md`.

**Czego NIE przejmujemy z B6:** `IdeaMapWorkspace.tsx:5507` osadza `<IdeaTeresaSection>` —
własne wejście do Teresy w karcie, naruszenie DEC-404/419. Narzędzia **nie powtarzają tego
błędu**: jedynym wejściem AI w sesji narzędzia jest `PracujZAI` w Menu 5
(`tool-document.md` §4).

---

## §1. Kiedy narzędzie jest A

`signatureArchetype` ∈ { `force-radial`, `flow-value-stream`, `causal-problem-solving`,
`architecture-capability` } — źródło: `src/toolPacks/registry.ts:79-121`.

**16 narzędzi:** market-forces · value-chain · smed-planner · vsm-builder ·
constraint-control · logistics-automation · process-automation · a3-problem-solving ·
pain-to-solution · pain-explorer · capability-mapper · ambition-decomposer ·
narrative-engine · integration-diagnostic · legacy-analyzer · data-inventory.

Rozpoznanie po kształcie: centrum jest **układem przestrzennym z relacjami** (przepływ,
drzewo przyczyn, warstwy, promienie), a nie siatką komórek. Jeśli pozycja ma współrzędne
albo krawędź do innej pozycji — to A, nie D.

---

## §2. Kontrakt CENTRUM (A)

| element | wymóg |
|---|---|
| A-1 | Centrum to **jedno płótno na krok metody**, nie kilka równoległych. Krok = `StepDefinition.id` z `TOOL_STEP_DEFINITIONS[toolType]` (`src/store/useToolStore.ts:2744`) |
| A-2 | Każdy węzeł ma **etykietę, typ i pochodzenie** (człowiek / propozycja AI z akceptem); krawędź ma kierunek i sens (przepływ / przyczyna / zależność) |
| A-3 | Płótno ma **stan pusty ze zdaniem, co narysować** — nie samą pustą kratkę |
| A-4 | Płótno przewija i skaluje się **we własnym kontenerze**; strona nigdy nie przewija się w poziomie (K20) |
| A-5 | Zapis idzie do `session.inputData` przez `PATCH /api/tools/:id` z `expectedVersion` (CAS — serwer odrzuca nieaktualną wersję 409, `ToolController.updateToolSession`); płótno **musi** obsłużyć 409 komunikatem, nie cichą utratą pracy |
| A-6 | Wyjście z płótna nazwane rzeczownikowo: „Utwórz inicjatywę z ruchu”, „Zapisz jako proces” |
| A-7 | **Zero `primary-*`** — zaznaczenie węzła, znacznik AI i aktywna krawędź to stany neutralne |
| A-8 | Etykiety kroków i węzłów przez `t()`, po polsku (dziś ✗ dla `market-forces` — `PORTER_STEPS` ma `namePl` po angielsku, `useToolStore.ts:1417`) |

**AI w archetypie A:**
* **Analizuj** — ocenia płótno: czy przepływ ma początek i koniec, czy drzewo przyczyn schodzi
  do przyczyny źródłowej, czy warstwy nie mieszają poziomów. Rubryka do dopisania
  (`tool-document.md` §4, K24).
* **Uzupełnij tę sekcję** — propozycje **węzłów dla bieżącego kroku**, każdy z osobnym
  „Zaakceptuj / Odrzuć”. Dziś zaimplementowane **dla zera narzędzi A** — mechanizm propozycji
  istnieje tylko dla SWOT-a (`TeresaSwotProposals`), więc w narzędziach A obie pozycje
  „Uzupełnij…” renderują się **wyszarzone** (`swotProposalsDostepne`, `ToolDocumentView.tsx:2563`).
  To jest stan uczciwy i **nie wolno go maskować** przed zbudowaniem generatora.
* **Uzupełnij cały dokument** — jw., dla całego płótna.

**Gdzie dziś mieszka kod płótna:** `src/components/DiscoveryTools/tools/<Narzędzie>/`
(12 katalogów) + `visualizations/PorterRadar.tsx`. Wszystkie montuje `ToolCanvas.tsx`
przez 16 gałęzi `if (toolType === '…')` (`:162`–`:1002`).

---

## §3. #18 `tool-workspace` — martwy ekran, kontraktu nie piszę

| pole | wartość (zmierzona) |
|---|---|
| komponent | `src/components/DiscoveryTools/ToolWorkspace.tsx:156` (953 linie) |
| jedyny wołacz | `src/views/discovery-tools/OperationalToolsView.tsx:223` |
| trasa dla tego wołacza | **żadna.** `ROUTES.DISCOVERY_TOOLS.OPERATIONAL` (`routes/routeConfig.ts:51`) montuje `DiscoveryToolsHub initialTab="library" initialCategory="operational"` (`AppRoutes.tsx:2124-2136`), nie `OperationalToolsView` |
| importerzy katalogu `src/views/discovery-tools/` | **zero poza własnym barrelem** `index.ts` — pięć widoków (`DigitalToolsView`, `DiscoveryToolsView`, `OperationalToolsView`, `ProcessAutomationView`, `StrategicToolsView`) nie jest wołanych znikąd |
| import w hubie | `DiscoveryToolsHub.tsx:88` importuje `ToolWorkspace`, ale **nigdzie go nie renderuje** (dwa pozostałe trafienia, `:2517` i `:3941`, to komentarze) |
| `primary-*` | 0 |

**Wniosek:** #18 to **martwe poddrzewo**, nie ekran do standaryzacji. Metoda „plik bez
importera” by go nie złapała, bo `OperationalToolsView` go importuje — dopiero pytanie
„czy ten importer jest zamontowany na trasie” pokazuje prawdę.

**Zamiast kontraktu — wniosek do wykonania (rozmiar M, bez decyzji właściciela):**
usunąć `src/views/discovery-tools/` (5 widoków + barrel) oraz `ToolWorkspace.tsx`,
zdjąć nieużywany import z `DiscoveryToolsHub.tsx:88`. Sprawdzić wcześniej, czy `ToolCanvas`
i `ToolHeader` (`ToolWorkspace.tsx:27-28`) mają innych, żywych konsumentów — `ToolCanvas`
ma (`ToolDocumentView`), `ToolHeader` do sprawdzenia przy usuwaniu.
**To nie jest praca tej partii** — partia jest dokumentacyjna, zero zmian w kodzie produktu.

---

## §4. Stan zastany archetypu A w jednej liczbie

| wymiar | stan |
|---|---|
| narzędzia archetypu A | **16 / 31** |
| otwieralne dziś (`GET /api/known-tools/:toolType` = 200) | **0 / 16** — bramka MVP dopuszcza wyłącznie `dynamic-swot` (archetyp D) |
| z silnikiem metody w `src/config/` | **9 / 16** (brakuje 7: vsm-builder, constraint-control, logistics-automation, integration-diagnostic, legacy-analyzer, data-inventory, pain-to-solution — patrz `toolAvailability.ts:16`) |
| z własną gałęzią płótna w `ToolCanvas.tsx` | **8 / 16** (z 16 gałęzi `if (toolType === …)` osiem dotyczy narzędzi A) |
| na `TOOLSET_DIGITAL_STEPS` (2 sekcje na całą metodę) | **5 / 16** — logistics-automation, integration-diagnostic, legacy-analyzer, data-inventory, pain-to-solution |
| z generatorem propozycji AI („Uzupełnij…”) | **0 / 16** |
| z własną treścią wpisu bibliotecznego | **1 / 16** (`market-forces`); 15 dziedziczy treść Dynamic SWOT (`tool.md` §1, L-2) |

**Czego ten wzorzec NIE udowadnia.** Ani jednego ekranu archetypu A nie dało się otworzyć
na stanowisku, więc **żadne twierdzenie o wyglądzie nie ma tu zrzutu**. Wszystko powyżej jest
czytane z kodu i z odpowiedzi API. Odbiór wzrokiem jest niemożliwy, dopóki właściciel nie
zdejmie bramki MVP z choćby jednego narzędzia A — i to jest jedyny sensowny pierwszy krok
dla tego archetypu (rekomendacja: `market-forces`, bo ma silnik, pack, płótno `PorterRadar`
i **jedyną własną treść biblioteki** spośród szesnastu).
