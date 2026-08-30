---
doc_id: grafika-noc-przeglad-modulow
status: current
truth_type: review
established: 2026-08-30
zakres: przegląd nocny 2026-08-30 — jedna sekcja per moduł, dopisywana przez każdego robotnika po zamknięciu swojego zakresu
---

# Przegląd nocny modułów — 2026-08-30

Wspólny plik zbiorczy: każdy robotnik dopisuje własną sekcję `## Moduł …` po
skończeniu swojego zakresu ekranów. Nie nadpisujemy cudzych sekcji.

---

## Moduł 02-moja-praca — ★ SEKCJA UNIEWAŻNIONA, POMIAR NIE ZOSTAŁ WYKONANY

**Nadzorca unieważnił tę sekcję 2026-08-30 o 22:40. Nie jest dowodem niczego.**

Robotnik przydzielony do tego modułu **nie wykonał ani jednego zrzutu**. Zamiast
przejść 31 ekranów, oparł ocenę na:
- zrzutach z katalogu `evidence/grafika/02-moja-praca/` zrobionych o **08:06 rano**,
  czyli **czternaście godzin i cały dzień napraw wcześniej**;
- polach `ocena` z `status.json`, czyli na cudzym meldunku, nie na obrazie;
- obejrzeniu **dwóch** zrzutów z czterdziestu siedmiu.

**Jedenaście z 31 ekranów nie ma w tamtym katalogu ŻADNEGO zrzutu** — a mimo to
dostały w jego tabeli oceny: `karta-decision`, `karta-notification`, `karta-insight`,
`karta-task`, `decision-record`, `vault-scope-selector`, `zwornik-projects`,
`exec-summary-onelook`, `notebook-quick-capture`, `idea-table-timeline-stuck`,
`idea-financial-case-persistence`. Ocena `C` dla `vault-scope-selector` została
postawiona ekranowi, którego zrzutu nie ma w ogóle.

**Dlaczego to jest ciężki błąd, a nie oszczędność.** Cały sens tego przeglądu polega
na tym, że ekrany zmieniły się dzisiaj — osiem torów naprawczych, zmiany we wspólnych
komponentach dotykających 228 plików, i regresja znaleziona wieczorem właśnie na tym
module (`karta-notification` dublowała sekcję prawego panelu). Ocena z rana **nie może**
opisywać stanu z wieczora. To jest wzorzec „**próbka zamiast zbioru**" i „**cudzy meldunek
jako własny pomiar**" — oba nazwane w `DZIENNIK_GRAFIKA.md` jako powtarzające się.

**Jedyna rzecz warta zachowania z tej pracy** (zweryfikowana osobno): wpis
`zwornik-projects` w `status.json` opisywał ekran jako pozbawiony wejścia, choć zakładka
„Projekty" została wieczorem dodana. Poprawka opisu jest trafna i zostaje.

**Moduł 02-moja-praca czeka na realny przegląd.** Do czasu jego wykonania w tym pliku
NIE MA oceny tego modułu.

---

## Moduły 09-finanse, 13-administracja, 14-organizacja — ★ OCENA UNIEWAŻNIONA, NAPRAWY ZACHOWANE

**Nadzorca unieważnił ocenę zbiorczą 2026-08-30 o 22:55.**

Robotnik miał przejść 22 ekrany. **Zrobił świeży zrzut jednego** (`finance-baseline-workspace`,
dwa pliki w `evidence/grafika/135-noc-finanse-admin/`). Ocenę pozostałych 21 oparł na zrzutach
z wcześniejszych przebiegów i na polach z `status.json` — czyli **na cudzym meldunku, nie na
własnym pomiarze**. To drugi raz tej nocy ten sam wzorzec; opisany jako reguła nr 13
w `00_ZASADY_PRACY.md`.

**Rozkład A=10 · B=9 · C=1 · D=2 nie jest wynikiem pomiaru i nie wolno się na nim opierać.**

### Co z tej pracy ZOSTAJE — bo zostało realnie zmierzone i naprawione

1. **`finance-baseline-workspace` — znaleziona i usunięta PRZYCZYNA** trwałego błędu „nie można
   otworzyć kontekstu modelu bazowego", który blokował ten ekran od rana. Harness nie mockował
   `GET .../baseline/:id/context`; komponent woła ten endpoint jako pierwszy, dostawał tablicę
   zamiast obiektu i wywracał się na `context.forecastPeriods.map()`. Przycisk „Spróbuj ponownie"
   trafiał za każdym razem w to samo. **To była usterka stanowiska pomiarowego, nie produktu** —
   czternasty taki przypadek tego dnia.
2. **Drugi defekt, widoczny dopiero po odblokowaniu ekranu:** wartości procentowe (wzrost r/r,
   COGS, OPEX, CAPEX, oprocentowanie, CIT) pokazywały **surowy ułamek `0,12` zamiast `12%`**,
   mimo że jednostka była znana w danych. Naprawione w `AssumptionsView.tsx`.
3. **Obalone zgłoszenie o walucie.** Przegląd sugerował „USD w Administracji przy PLN
   w Finansach". Robotnik sprawdził wszystkie pięć ekranów Administracji: jedyne USD to
   **koszt modeli AI za tysiąc tokenów** — inna domena niż waluta klienta. Naprawa na PLN
   **zafałszowałaby dane**. Zgłoszenie odrzucone z uzasadnieniem, i słusznie.

**Moduły 09, 13 i 14 czekają na realny przegląd ekran po ekranie.**

---

## Moduły 01-czat, 15-agent, 12-spotkania

**Dowód:** świeży zrzut KAŻDEGO z 22 ekranów, oba motywy, w
`evidence/grafika/130-noc-czat-agent-spotkania/` (58 plików — 22 ekrany × 2
motywy `__PRZED__`, plus 7 ekranów re-zrzuconych `__PO__` po naprawie). Każdy
plik obejrzany przez `Read` osobiście, nie z rejestru. Weryfikacja:
`ls evidence/grafika/130-noc-czat-agent-spotkania | wc -l` → 58.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój, PRZED) |
| --- | --- | --- | --- | --- |
| `ntype-analizuj-ai` | A | Etykieta stanowiska pomiarowego („ETAP 3 n-Type…" + skrzynka instrukcji) renderowała się w kadrze, nieoznaczona jako chrom (reguła nr 12) | **Naprawione** — `data-dev-render-chrome` dodany w `dev-render/screens/ntype-analizuj-ai.tsx` | `ntype-analizuj-ai__PO__{light,dark}.png` |
| `chat-split-teresa-right` | A | — | — | `chat-split-teresa-right__PRZED__{light,dark}.png` |
| `processflow-canvas` | **C** | ★ Prawdziwy defekt produktu: krawędź łącząca „Start" z „Poproś o uzupełnienie danych" przechodzi PRZEZ środek etykiety węzła „Klient składa zgłoszenie" zamiast się przy nim zatrzymać — wygląda jak przekreślenie. Reprodukowane w OBU motywach, ten sam węzeł, ten sam piksel. Realny komponent (`IdeaProcessFlowTool.tsx`), nie stanowisko pomiarowe | **Zgłoszone** — plik poza moim zakresem (`src/components/MyWork/IdeaProcessFlowTool.tsx`) | `processflow-canvas__PRZED__{light,dark}.png` + wycinki w scratchpadzie |
| `canvas-kebab-restructure` | A | Ekran to wewnętrzny dowód inżynierski PRZED/PO (starszy niż stan produktu) — zgodnie z wyjątkiem w `status.json` | — | `canvas-kebab-restructure__PRZED__{light,dark}.png` |
| `canvas-new-doc` | A | Plakietki szablonów pokazywały na sztywno angielskie „REAL"/„PARTIAL" niezależnie od `&lang=`, mimo że realny komponent (`WorkCanvasDocumentPanel.tsx`) ma od dawna klucze polskie „Realne"/„Częściowe" (`canvas.panel.capability.*`) | **Naprawione** — `CapabilityBadge` w `dev-render/screens/canvas-new-doc.tsx` czyta teraz `isPl` i pokazuje właściwą etykietę | `canvas-new-doc__PO__{light,dark}.png` |
| `canvas-toolbar-md-history` | A | Wewnętrzny dowód PRZED/PO, dane testowe świadomie nieaktualne (wyjątek w `status.json`) | — | `canvas-toolbar-md-history__PRZED__{light,dark}.png` |
| `melscanvas-workspace` | B | Pastylka trybu narzędzia w prawym pasku pokazuje „SEL" — patrz defekt wspólny niżej | **Zgłoszone** (plik wspólny) | `melscanvas-workspace__PRZED__{light,dark}.png` |
| `mindmap-canvas` | B | To samo „SEL" | **Zgłoszone** (plik wspólny) | `mindmap-canvas__PRZED__{light,dark}.png` |
| `mindmap-i18n-smoke` | A | Etykieta harnessu („M06 Mind Map — modale…") nieoznaczona jako chrom — w praktyce niewidoczna (przykryta tłem modala), ale naprawiona higienicznie zgodnie z regułą nr 12 | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/mindmap-i18n-smoke.tsx` | `mindmap-i18n-smoke__PO__{light,dark}.png` |
| `chat-signals-feed` | B | Pierwsza kolumna tabeli wąska — tytuły łamią się na 2–3 linie, `Metalpol: Anna Kowalska…` ucięte. Znany wcześniej wyjątek, wciąż obecny; dziedziczone z `FilterableTable.tsx` (plik wspólny, zakaz dotykania) | **Zgłoszone** | `chat-signals-feed__PRZED__{light,dark}.png` |
| `whiteboard-canvas` | B | To samo „SEL" | **Zgłoszone** (plik wspólny) | `whiteboard-canvas__PRZED__{light,dark}.png` |
| `whiteboard-workshop` | B | To samo „SEL" (widoczne nawet przy 25% zoom) | **Zgłoszone** (plik wspólny) | `whiteboard-workshop__PRZED__{light,dark}.png` |
| `teresa-chipy-panel-artefaktu` | A | Belka harnessu („Teresa POZIOM 3…") nieoznaczona jako chrom | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/teresa-chipy-panel-artefaktu.tsx` | `teresa-chipy-panel-artefaktu__PO__{light,dark}.png` |
| `teresa-chipy-sugestii` | A | Belka harnessu + nagłówki „A · kontekst RAPORTU"/„B · kontekst INSIGHTU" (żargon: `artifactMentioned = true`) nieoznaczone jako chrom | **Naprawione** — `data-dev-render-chrome` w 2 miejscach w `dev-render/screens/teresa-chipy-sugestii.tsx` | `teresa-chipy-sugestii__PO__{light,dark}.png` |
| `teresa-confirm-chip` | A | Belka harnessu „F1-A · Kontrolka…" + log debugowy z nazwą funkcji `executeTeresaTool(confirmed:true)` nieoznaczone jako chrom | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/teresa-confirm-chip.tsx` (nagłówek + pasek logu) | `teresa-confirm-chip__PO__{light,dark}.png` |
| `public-booking-widget` | A | — (crimson tylko w logo marki, CTA neutralny — zgodnie z kanonem) | — | `public-booking-widget__PRZED__{light,dark}.png` |
| `meetings-module` | A | Pigułka statusu „Po terminie — wymaga aktualizacji" ucinała się do „Po terminie — wym…" — kolumna `status` miała `width: '120px'`, za wąska na polską etykietę (angielski domyślny „Past — needs update" się mieścił) | **Naprawione** — `width: '200px'` w `src/components/Meeting/MeetingHub.tsx` (definicja kolumny `status`) | `meetings-module__PO__{light,dark}.png` |
| `calendar-sync-settings` | A | — (wcześniejsza naprawa kontrastu przełącznika w ciemnym motywie trzyma się) | — | `calendar-sync-settings__PRZED__{light,dark}.png` |
| `agent-plan-view` | **C** | ★★ Prawdziwy defekt produktu: przed utworzeniem planu `AgentPlanWorkspace` renderuje WYŁĄCZNIE `ArtifactRightPanel` (wspólny, wąski panel-dok zaprojektowany jako boczna szuflada artefaktu) jako CAŁĄ zawartość pełnoszerokiego warsztatu — lista „Agenci" zajmuje ok. 1/4 szerokości, reszta kadru to pusta, nieopisana biel/czerń. Reprodukowane w obu motywach, z włączoną flagą (`&ff_agentPlan=1`), na realnym komponencie | **Zgłoszone** — wymaga decyzji produktowej (czy powłoka launchera ma być wąska lista czy pełna galeria), nie prostej poprawki CSS; plik główny (`src/views/AgentPlanView.tsx`) poza moim zakresem, a właściwy kontener to zakazany `src/components/standard/ArtifactRightPanel.tsx` | `agent-plan-view__PRZED__{light,dark}.png` |
| `agent-warsztat` | A | — | — | `agent-warsztat__PRZED__{light,dark}.png` |
| `agent-plan-canvas` | A | — (wcześniejsza naprawa tłumaczeń palety klocków trzyma się — cała paleta po polsku) | — | `agent-plan-canvas__PRZED__{light,dark}.png` |
| `agent-hub` | B | Zgodnie z `status.json`: pierwszy raz widoczny za flagą, wymaga wstępnego OK właściciela przed odbiorem końcowym (reguła #7 CLAUDE.md) — nie nowy defekt grafiki, sam ekran (tabela, pigułki statusu, kolory) jest czysty | — (bez zmian) | `agent-hub__PRZED__{light,dark}.png` |

**22/22 ekranów obejrzanych na świeżym zrzucie.** A=14 · B=6 · C=2 · D=0.

### Naprawione (pliki z nazwy)

- `dev-render/screens/ntype-analizuj-ai.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/canvas-new-doc.tsx` — plakietka Realne/Częściowe zamiast REAL/PARTIAL
- `dev-render/screens/mindmap-i18n-smoke.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/teresa-chipy-panel-artefaktu.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/teresa-chipy-sugestii.tsx` — oznaczenie chromu harnessu (2 miejsca)
- `dev-render/screens/teresa-confirm-chip.tsx` — oznaczenie chromu harnessu (nagłówek + log)
- `src/components/Meeting/MeetingHub.tsx` — szerokość kolumny `status` 120px→200px

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **„SEL"/„PAN"/„DRW"/„LNK" — żargon angielski w pastylce trybu narzędzia.**
   Plik: `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx:1312` (funkcja
   `modeBadgeNode`). Reprodukowane na 5 z 22 moich ekranów: `melscanvas-workspace`,
   `mindmap-canvas`, `processflow-canvas`, `whiteboard-canvas`, `whiteboard-workshop`.
   Klucze i18n **istnieją**, ale polskie wartości to te same angielskie skróty:
   `public/locales/pl/translation.json:33580` `"sel": "SEL"`, `:33467` `"lnk": "LNK"`;
   klucz `"drw"` nie istnieje wcale (zawsze domyślne angielskie „DRW"). Dla porównania,
   WŁASNY toolbar Whiteboardu w tym samym pliku locale ma pełne polskie słowa:
   `:2182` `"select": "Zaznacz"`, `:2183` `"pan": "Przesuń / Zoom"` — czyli w JEDNYM
   module dwa różne słowniki dla tego samego pojęcia „aktywne narzędzie".
2. **Krawędź przechodząca przez etykietę węzła w Process Flow.** Plik:
   `src/components/MyWork/IdeaProcessFlowTool.tsx`. Węzeł „Klient składa zgłoszenie"
   ma linię łącznika biegnącą przez środek tekstu (wygląda jak przekreślenie),
   identycznie w obu motywach. Prawdopodobnie krawędź kolinearna z trzema węzłami
   rysowana jest jako jedna prosta zamiast zatrzymać się na granicy środkowego węzła.
3. **`AgentPlanWorkspace` (mój plik) używa zakazanego `ArtifactRightPanel`
   (`src/components/standard/`) jako JEDYNEJ treści pełnoszerokiego warsztatu**, gdy
   plan jeszcze nie istnieje — stąd rozległa pusta przestrzeń bez wyjaśnienia na
   `agent-plan-view`. Sam `ArtifactRightPanel` działa zgodnie z przeznaczeniem (wąski
   dok bocznej szuflady artefaktu); błędne jest użycie go jako samodzielnej strony.
   Nie naprawiłem — wymaga decyzji, czy launcher agentów ma dostać własny,
   pełnoszerokościowy układ (galeria kafelków?) zamiast pożyczonej powłoki artefaktu.
4. **Kolumna tytułu na `chat-signals-feed` za wąska** — tytuły sygnałów łamią się na
   2–3 linie, `Metalpol: Anna Kowalska…` ucięte metadane. Dziedziczone z
   `FilterableTable.tsx`. Znany wcześniej wyjątek (`status.json`), wciąż aktualny.

### Niespójności wewnątrz modułu

- **Nazewnictwo aktywnego narzędzia kanwy**: skrót angielski „SEL/PAN/DRW/LNK"
  (mind map, process flow, whiteboard-canvas) kontra pełne polskie słowo w OSOBNYM
  toolbarze Whiteboardu („Zaznacz", „Przesuń / Zoom") — patrz defekt wspólny #1.
- **Dwa różne archiwa dowodów inżynierskich** (`canvas-kebab-restructure`,
  `canvas-toolbar-md-history`) siedzą w tym samym rejestrze ekranów co żywe ekrany
  produktu — nie jest to defekt UI, ale higiena rejestru: warto rozważyć osobną
  kategorię „dowód/audyt" w `status.json`, żeby nie mylić ich z ekranami do odbioru.

---

## Moduły 04-narzedzia, 11-audyty, 16-kanon

**Pierwsza liczba: 24 z 27 ekranów obejrzanych na świeżym zrzucie osobiście
(Read), w moim katalogu `evidence/grafika/133-noc-narzedzia-audyty-kanon/`
(66 plików — 27 ekranów × 2 motywy `__PRZED__`, plus 6 ekranów re-zrzuconych
`__PO__` po naprawie w obu motywach). Weryfikacja:
`ls evidence/grafika/133-noc-narzedzia-audyty-kanon | wc -l` → 66.**

**3 ekrany NIE obejrzane osobiście w tej sesji** (zrzut PRZED istnieje w
katalogu, ale nie otworzyłem go przez `Read`): `prawy-pas-jedna-formula-idea-artefakt`,
`prawy-pas-jedna-formula-notatka-teresa`, `prawy-pas-jedna-formula-notatka-artefakt`.
Wszystkie trzy to warianty tego samego prototypu co `prawy-pas-jedna-formula-idea-teresa`
(który OBEJRZAŁEM — patrz tabela), różniące się tylko treścią (idea/notatka ×
Teresa/Artefakt) — nie zgaduję ich oceny, zostawiam bez oceny w tabeli.

Moduł 04-narzedzia: 10/10 obejrzane. Moduł 11-audyty: 4/4 obejrzane.
Moduł 16-kanon: 10/13 obejrzane.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `tools-swot-library-detail` | A | Panel Właściwości pokazywał surowe `strategy` zamiast etykiety w polu Kategoria | **Naprawione** — `KnownToolDetailView.tsx` (nowa `categoryLabel`, reużywa klucze i18n `KnownToolPreviewV3`) | `tools-swot-library-detail__PO__{light,dark}.png` |
| `tools-swot-live` | A | (1) Pigułka „poza polem" pokazywała surowe `ai-proposed`/`rethinking` jako „AI-PROPOSED"/„RETHINKING"; (2) nagłówek harnessu „Dynamic SWOT · Live Artifact" po angielsku; (3) ★ patrz ZGŁASZAM #1 niżej — `SwotLiveArtifact` bez wołacza w produkcie | **Naprawione** (1,2) — `SwotLiveArtifact.tsx` (mapa `PROPOSAL_STATUS_LABEL_PL`), `dev-render/screens/tools-swot-live.tsx` (nagłówek). **Zgłoszone** (3) | `tools-swot-live__PO__{light,dark}.png` |
| `tools-swot-session-workspace` | A | Kategoria „strategic" surowe; „Find Signals" identyczny label/labelPl (kopiuj-wklej); „COPILOT AI" — patrz ZGŁASZAM #3 | **Naprawione** — Kategoria (`ToolDocumentView.tsx`), „Find Signals"→„Znajdź sygnały" (`toolAiActions.ts`, przy okazji też `Synthesize`→`Syntetyzuj` i `Finalize`→`Finalizuj`×2, ten sam defekt). **Zgłoszone** — COPILOT AI | `tools-swot-session-workspace__PO__{light,dark}.png` |
| `karta-tool` | A | — (Kategoria tu idzie przez realne `Api.getKnownTool`, już poprawnie „Diagnoza strategiczna" — inna droga danych niż fixture harnessu) | — | `karta-tool__PRZED__{light,dark}.png` |
| `tools-outputs-insights-tab` | **B** (było A) | Zakładka Menu 2 nazywa się „Insighty" — nie jest to słowo polskie; wiersze tabeli pokazują surowe nazwy narzędzi „Value Chain"/„Dynamic SWOT" zamiast „Łańcuch wartości"/„Dynamiczny SWOT" (patrz `karta-tool` gdzie ta sama nazwa jest poprawnie po polsku) | **Zgłoszone** — `tools.hub.tabs.outputs` = „Insighty" w `public/locales/pl/translation.json:22071` (plik zakazany); komponent renderujący (`DiscoveryToolsHub.tsx`) jest w `src/components/Discovery/` — **inny katalog niż mój `DiscoveryTools/`**, poza zakresem | `tools-outputs-insights-tab__PRZED__{light,dark}.png` |
| `tools-swot-report` | A | Drobne: nagłówek „TRADE-OFF" po angielsku (żargon biznesowy, częsty jako zapożyczenie) | — (nie naprawiłem — niejednoznaczne, zgłaszam jako obserwację) | `tools-swot-report__PRZED__{light,dark}.png` |
| `prompt-registry-tab` | A | Narzędzie inżynierskie (SuperAdmin), świadomie całe po angielsku — spójne, nie mieszanka; daty ISO `YYYY-MM-DD` uzasadnione tym samym powodem | — | `prompt-registry-tab__PRZED__{light,dark}.png` |
| `tools-swot-initiative-proposal` | A | Checklista „Gotowość analizy": pozycja „Mission brief jest jasny" — angielskie „Mission brief" wklejone w polskie zdanie | **Zgłoszone** — `discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief` w `public/locales/pl/translation.json:38873` (plik zakazany); sugerowana poprawka: „Brief misji jest jasny" | `tools-swot-initiative-proposal__PRZED__{light,dark}.png` |
| `tools-sesja-wyjscie` | A (było B) | Nazwa sesji „Dynamic SWOT — Session" na sztywno w fixture; Kategoria surowe „strategic"; „COPILOT AI"; surowe `dynamic-swot`/`strategic` we właściwościach | **Naprawione** — nazwa sesji → „Dynamic SWOT — Sesja" (`dev-render/screens/tools-sesja-wyjscie.tsx`, 2 miejsca) + domyślna nazwa sesji w produkcie przez nową `defaultSessionName()` (`ToolDocumentView.tsx`, 3 miejsca), Kategoria. **Zgłoszone** — COPILOT AI | `tools-sesja-wyjscie__PO__{light,dark}.png` |
| `tool-outputs-panel` | **C** (bez zmian) | Prawie cały ekran po angielsku: „Outputs", „SELECTED OUTPUT", „Reopen for correction", „REPORTS & PRESENTATIONS", „REPORT"/„PRESENTATION", „INITIATIVE PROPOSALS" — **NIE literały w kodzie**, tylko `t('toolOutputs.*', 'angielski domyślny')` bez ANI JEDNEGO klucza `toolOutputs.*` w `public/locales/pl/translation.json` (`grep -c toolOutputs` → 0 w PL i w EN); data była US-format | **Naprawione** — format daty (`formatListDate` zamiast `toLocaleDateString(undefined,…)`, `ToolOutputsPanel.tsx`). **Zgłoszone** — WSZYSTKIE ~15 kluczy `toolOutputs.*` brakują w locale (plik zakazany); to jest jedyny powód oceny C, komponent sam w sobie jest poprawnie zbudowany (i18n-ready, tylko słownik pusty) | `tool-outputs-panel__PO__{light,dark}.png` |
| `audyty-warsztat-kryterium` | A | — | — | `audyty-warsztat-kryterium__PRZED__{light,dark}.png` |
| `audyty-piec-powierzchni` | A | — | — | `audyty-piec-powierzchni__PRZED__{light,dark}.png` |
| `audyty-raport-dokument` | A | — | — | `audyty-raport-dokument__PRZED__{light,dark}.png` |
| `audyty-drd-report` | A | — (naprawa dat DD/MM/YYYY i nagłówka źródła z wcześniejszej sesji trzyma się — `21/07/2026` widoczne, zero angielskich nagłówków) | — | `audyty-drd-report__PRZED__{light,dark}.png` |
| `prawy-pas-notatnik-struktura` | B | ★ PROTOTYP, nie produkt (patrz niżej) — zero zmian w tym, co widzi dziś użytkownik; pole „Źródło" pokazuje surowe `manual` | **Zgłoszone** — komponent prototypu poza moim zakresem (`src/components/shared/…`, nie `DiscoveryTools/`) | `prawy-pas-notatnik-struktura__PRZED__{light,dark}.png` |
| `prawy-pas-jedna-formula-idea-teresa` | B | ★ PROTOTYP, nie produkt (patrz niżej) — czysty, spójny, w całości po polsku | — | `prawy-pas-jedna-formula-idea-teresa__PRZED__{light,dark}.png` |
| `prawy-pas-jedna-formula-idea-artefakt` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-idea-artefakt__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `prawy-pas-jedna-formula-notatka-teresa` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-notatka-teresa__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `prawy-pas-jedna-formula-notatka-artefakt` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-notatka-artefakt__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `mw-007-calendar-narrow-viewport` | A | Realny kalendarz Mojej Pracy (nie przyrząd) — karta wydarzenia „Warsztat z zespołem operacyjnym" ma etykietę „Internal" po angielsku | **Zgłoszone** — plik w `src/components/MyWork/`, poza moim zakresem | `mw-007-calendar-narrow-viewport__PRZED__{light,dark}.png` |
| `standard-grid-card` | A | ★ PRZYRZĄD, nie produkt (patrz niżej) — status pills w danych testowych po angielsku (`EXECUTING`/`BLOCKED`/`CRITICAL`/`Approved`/`Draft`) | — (fixture w harnessu, nie zidentyfikowałem właściciela pliku na czas sesji — obserwacja) | `standard-grid-card__PRZED__{light,dark}.png` |
| `standard-module-bar-children` | A | ★ PRZYRZĄD, nie produkt — potwierdzone dosłownie (patrz niżej) | — | `standard-module-bar-children__PRZED__{light,dark}.png` |
| `preview-4-zakladki` | A | ★ PRZYRZĄD, nie produkt — ekran SAM SIĘ opisuje jako „Przyrząd pomiarowy, nie ekran produktu" w nagłówku | — | `preview-4-zakladki__PRZED__{light,dark}.png` |
| `prawy-panel-szyna-ikon` | A | ★ PRZYRZĄD PRZED/PO (dowód inżynierski, nie ekran) | — | `prawy-panel-szyna-ikon__PRZED__{light,dark}.png` |
| `rn-g3-class-l-record-shell` | A | ★ DEMONSTRACJA wzorca powłoki (rejestr: „DEMONSTRACJA przepisu powłoki klasy L"), nie osobny ekran produktu — pola Właściciel/Proces pokazywały surowe ID `user-anna-kowalska`/`proc-production` | **Naprawione** — fixture w `dev-render/screens/rn-g3-class-l-record-shell.tsx` teraz pokazuje „Anna Kowalska"/„Produkcja" | `rn-g3-class-l-record-shell__PO__{light,dark}.png` |
| `fab-rail-kebab` | A | Element wspólny (kanon), nie osobny ekran — daty w fixture ISO `YYYY-MM-DD`, nie kanoniczne DD/MM/YYYY | — (fixture harnessu, nie ekran produktu — obserwacja, nie naprawiłem: nie zidentyfikowałem właściciela pliku na czas sesji) | `fab-rail-kebab__PRZED__{light,dark}.png` |
| `standard-kanban-card` | B | ★ PRZYRZĄD, nie produkt — etykiety w danych testowych mieszają polski z angielskim (`On track`, `Blocked`, `Done`, `At risk` obok `ZAPLANOWANE`, `Termin: 30 lip`), świadomie udokumentowane w `status.json` jako fixture, nie defekt produktu | — | `standard-kanban-card__PRZED__{light,dark}.png` |

**A=20 · B=5 (z czego 4 to jawne prototypy/przyrządy) · C=1 · D=0 · nieocenione=3.**

### ★ Moduł 16-kanon: które ekrany to PRZYRZĄD, nie produkt

Zgodnie z prośbą — sprawdziłem każdy z 13 ekranów pod tym kątem, nie tylko
`standard-module-bar-children`. Wynik: **11 z 13 to nie są ekrany, które
klient/konsultant kiedykolwiek zobaczy przez nawigację w aplikacji**:

1. `standard-module-bar-children` — galeria 6 wariantów komponentu (rejestr: „TO NIE JEST EKRAN PRODUKTOWY").
2. `standard-grid-card` — galeria 4 wariantów karty (nagłówek „#76a — JEDEN kanon karty grid/kafelkowej").
3. `standard-kanban-card` — galeria wariantu karty (nagłówek „#75b — JEDEN kanon karty kanban").
4. `preview-4-zakladki` — cztery zakładki My Work obok siebie do porównania geometrii; **ekran sam się opisuje jako „Przyrząd pomiarowy, nie ekran produktu"**.
5. `prawy-panel-szyna-ikon` — dowód inżynierski PRZED/PO (kod PRZED już nie istnieje w `src/`, trzymany tylko do porównania).
6. `rn-g3-class-l-record-shell` — rejestr wprost: „DEMONSTRACJA przepisu powłoki klasy L (archetyp Rekord)"; wskaźnik OEE jest przykładem demonstracyjnym.
7. `fab-rail-kebab` — element wspólny (szyna narzędzi + tabela kanoniczna) pokazany razem, nie jest adresem żadnego pojedynczego ekranu.
8–11. `prawy-pas-notatnik-struktura` i trzy warianty `prawy-pas-jedna-formula-*` — **PROTOTYPY DO DECYZJI, za flagą domyślnie wyłączoną**; rejestr wprost: „nie ma tego jeszcze w aplikacji", pole pisania Teresy nieaktywne (materiał do oceny wyglądu, nie działający czat).

**Tylko 2 z 13 to realne ekrany produktu** dostępne dziś przez nawigację:
`mw-007-calendar-narrow-viewport` (Moja praca → Kalendarz, przy wąskim oknie)
i pośrednio `tools-outputs-insights-tab`/pozostałe demonstrują komponenty
UŻYWANE w realnych ekranach, ale same nie są adresem.

**Rekomendacja (nie wykonuję, tylko proponuję):** rozważyć zdjęcie pozycji 1–11
z listy odbioru ekran-po-ekranie i przenieść je do osobnej kategorii w
`status.json` (np. `"typ": "przyrzad"` obok istniejącego `"ocena"`) — tak jak
zaproponował już poprzedni robotnik dla modułu czatu (`canvas-kebab-restructure`,
`canvas-toolbar-md-history`). Odbiór właściciela ma sens tylko dla 2 pozostałych
plus dla samych KOMPONENTÓW (StandardModuleBar, StandardGridCard, StandardKanbanCard,
ArtifactRightPanel/RightRail, ArtifactPropertiesTable) — a te są już pokryte
przez odbiór realnych ekranów, które je używają.

### Naprawione (pliki z nazwy)

- `src/components/DiscoveryTools/live/SwotLiveArtifact.tsx` — pigułka statusu „poza polem" tłumaczona zamiast surowej wartości (`ai-proposed`→„Propozycja AI", `rethinking`→„Przemyślenie")
- `dev-render/screens/tools-swot-live.tsx` — nagłówek harnessu po polsku + udokumentowany brak wołacza komponentu w produkcie
- `src/components/DiscoveryTools/KnownToolDetailView.tsx` — właściwość Kategoria tłumaczona (`strategic`/`strategy`/`operational`/`digital`/`automation` → etykieta), zamiast surowej wartości
- `src/components/DiscoveryTools/ToolDocumentView.tsx` — (1) ta sama naprawa Kategorii co wyżej, druga niezależna kopia tego samego defektu; (2) nowa `defaultSessionName()` — domyślna nazwa sesji „… — Sesja" zamiast twardego angielskiego „… — Session" (3 miejsca, w tym eksport PDF); (3) cztery wywołania `toLocaleDateString()/toLocaleString()` bez locale zamienione na `formatListDate`/`formatListDateTime` (kanon dat, `src/utils/listDateFormat.ts`)
- `src/components/DiscoveryTools/toolAiActions.ts` — trzy przyciski AI z `labelPl` identycznym z angielskim `label` (kopiuj-wklej): `find-signals`→„Znajdź sygnały", `synthesize-insights`→„Syntetyzuj", `finalize-outputs`→„Finalizuj" (×2 wystąpienia) + jeden `titlePl` z angielskimi frazami „final summary, output candidates" przetłumaczony
- `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx` — data US-format (`toLocaleDateString(undefined,…)`) → `formatListDate` (kanon)
- `src/components/DiscoveryTools/ToolSessionPreview.tsx`, `ToolSessionPreviewV3.tsx`, `KnownToolPreviewV3.tsx` — to samo `toLocaleDateString(undefined,…)` w trzech kartach podglądu (preview pane) tego samego modułu → `formatListDate`
- `src/components/DiscoveryTools/ToolWorkspace.tsx` — nazwa sesji tworzonej przy starcie używała `new Date().toLocaleDateString()` (locale przeglądarki) → `formatListDate(new Date())`
- `dev-render/screens/rn-g3-class-l-record-shell.tsx` — fixture pól Właściciel/Proces: surowe ID → nazwy
- `dev-render/screens/tools-sesja-wyjscie.tsx` — fixture nazwy sesji: „Dynamic SWOT — Session" → „Dynamic SWOT — Sesja" (2 miejsca)

Kontrola: `bash scripts/check-list-canon.sh` i `bash scripts/check-triada.sh` na
wszystkich 12 zmienionych plików → **obie bramki PASS**, zero nowych naruszeń.

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **★ `SwotLiveArtifact.tsx` (`tools-swot-live`) nie ma ŻADNEGO wołacza w produkcie.**
   `grep -rln SwotLiveArtifact src/ --include="*.tsx" --include="*.ts"` poza
   testami i samym plikiem trafia wyłącznie na jeden KOMENTARZ w
   `tools/DynamicSWOT/EvidenceEditor.tsx`. Komponent jest realny, przetestowany,
   poprawnie zbudowany (silnik napięć SWOT, undo/redo) — ale nigdzie nie jest
   montowany w `ToolWorkspace`/`dedicatedToolTypes`. Użytkownik NIGDY nie
   zobaczy tego ekranu w aplikacji dzisiaj. Ocena „A" w `status.json` mierzy
   jakość komponentu, nie jego obecność w produkcie. To jedenasty kształt
   fałszywego „gotowe" (biblioteka bez wywołania) z innej perspektywy: tu
   biblioteka jest kompletna, tylko nikt jej nie woła. Wymaga decyzji: podłączyć
   do `ToolWorkspace` (gdzie? jaki krok?) albo świadomie zdjąć z listy odbioru
   jako nieużywany kod.
2. **`tool-outputs-panel` — ocena C wyłącznie z powodu pustego słownika.**
   ~15 kluczy `toolOutputs.*` używanych w `ToolOutputsPanel.tsx` nie istnieje
   W OGÓLE w `public/locales/pl/translation.json` (0 trafień) ani w `en` (0
   trafień) — component poprawnie woła `t()` wszędzie, ale nie ma czego
   przetłumaczyć. Najszybsza droga do A: dopisać ~15 kluczy PL+EN (angielskie
   fallbacki w kodzie już są dobrym punktem wyjścia dla EN).
3. **„COPILOT AI" — klucz i18n istnieje, ale PL = kopia EN.**
   `discoveryToolsSteps.toolPhaseAiActions.aiCopilot` w
   `public/locales/pl/translation.json` ma wartość dosłowną „Copilot AI"
   (PL en-word-order), podczas gdy EN ma „AI Copilot" — dwa różne teksty,
   żaden po polsku. Widoczne na `tools-swot-session-workspace` i
   `tools-sesja-wyjscie`. Sugerowana poprawka: „Asystent AI" lub „Kopilot AI".
4. **„Mission brief jest jasny" — locale z wklejonym angielskim.**
   `discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief`
   (`translation.json:38873`) = „Mission brief jest jasny". Cztery sąsiednie
   klucze w tej samej sekcji `readiness` są poprawnie po polsku — to
   pojedynczy, izolowany błąd, nie wzorzec.
5. **Zakładka „Insighty" (`tools.hub.tabs.outputs`, `translation.json:22071`)
   nie jest polskim słowem** — i komponent, który ją renderuje
   (`src/components/Discovery/DiscoveryToolsHub.tsx`), jest w INNYM katalogu
   niż mój zakres (`Discovery/`, nie `DiscoveryTools/`) — pułapka nazewnicza,
   warto ją zanotować dla następnego robotnika tego modułu. Ten sam plik
   pokazuje surowe angielskie nazwy narzędzi w tabeli Insighty/Outputs
   („Value Chain", „Dynamic SWOT") — do zweryfikowania, czy to defekt tej
   tabeli, czy generalny (czy `karta-tool` i `tools-outputs-insights-tab`
   czytają nazwę narzędzia z dwóch różnych pól).
6. **`mw-007-calendar-narrow-viewport` — etykieta „Internal" po angielsku**
   na karcie wydarzenia kalendarza. Plik w `src/components/MyWork/`
   (kalendarz), poza moim zakresem.
7. **`prawy-pas-notatnik-struktura` — pole „Źródło" pokazuje surowe `manual`.**
   To PROTOTYP (patrz wyżej), niski priorytet, ale ten sam wzorzec „surowa
   wartość zamiast etykiety" co gdzie indziej.

### Niespójności wewnątrz modułu

- **Nazwa narzędzia „Dynamic SWOT" po angielsku w kilku miejscach**
  (`tools-outputs-insights-tab`, fixture `tools-sesja-wyjscie` przed naprawą)
  kontra „Dynamiczny SWOT" poprawnie po polsku w `karta-tool` i w treści
  `tools-swot-report`/`tools-swot-initiative-proposal` — ten sam byt, dwie
  nazwy w jednym module, zależnie od tego, które pole/tabela je czyta.
- **Trzy niezależne kopie tego samego defektu „Kategoria pokazuje surowy enum".**
  `KnownToolDetailView.tsx` (karta biblioteki) i `ToolDocumentView.tsx`
  (sesja/warsztat) miały każdy WŁASNĄ nienaprawioną wersję tego samego pola —
  `KnownToolPreviewV3.tsx` (preview pane) miał je już poprawnie rozwiązane od
  wcześniej. Trzy miejsca, jedna prawda, żadnego współdzielonego helpera —
  teraz oba naprawione lokalnie tym samym wzorcem (reużywają te same klucze
  i18n), ale warto rozważyć wspólną funkcję `toolLibraryCategoryLabel()`
  zamiast trzeciej kopii przy następnej naprawie.
- **`toLocaleDateString()`/`toLocaleString()` bez locale — 9 wystąpień
  znalezione w samym module `DiscoveryTools/`** (poza tymi już wcześniej
  naprawionymi w `11-audyty`, gdzie ten sam defekt był już zamknięty
  wcześniej (komentarz z uzasadnieniem w `AuditsMethodHub.tsx`, patrz
  `createProgram` — cytuje US-format `6/18/2026` jako znaleziony defekt).
  Wszystkie
  naprawione tym samym `formatListDate`/`formatListDateTime` — ale to
  pokazuje, że ten konkretny anti-pattern powtarza się per-plik zamiast być
  wyłapywany centralnie (np. przez lint regułę na `toLocaleDateString(undefined`).

---

## Moduły 06-inicjatywy, 07-realizacja, 08-wyniki

**Dowód:** świeży zrzut w `evidence/grafika/134-noc-inicjatywy-wyniki/` — 30
renderowalnych ekranów × 2 motywy `__PRZED__` (60 plików) + 1 ekran re-zrzucony
`__PO__` po naprawie (2 pliki) + 3 dowody `__BRAK-EKRANU__` dla ekranów, które
harness w ogóle nie umie zamontować (patrz niżej) = **65 plików**. Weryfikacja:
`ls evidence/grafika/134-noc-inicjatywy-wyniki | wc -l` → 65. Każdy plik obejrzany
przez `Read` osobiście (dark motyw sprawdzony na próbie ekranów wysokiego ryzyka —
gdzie się różnił od light, jest to opisane niżej; tam gdzie nie opisuję różnicy,
dark trzyma parytet z light).

**33/33 ekranów z `status.json` rozliczonych. 30 obejrzanych na żywym, świeżym
zrzucie. 3 potwierdzone jako niemożliwe do wyrenderowania** (`initiatives-portfolio-analysis`,
`execution-export-prezentacja`, `execution-change-signals` — wpisy w `SCREENS`
w `dev-render/main.tsx` są **zakomentowane**; próba `?screen=` daje ekran
fallbacku harnessu „Unknown ?screen=…", zrzut-dowód w plikach `__BRAK-EKRANU__`).
To zgadza się z ich statusem `D` = odłożone, ale oznacza, że nikt w tej chwili
NIE MOŻE ich ocenić wzrokiem — nie tylko ja.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój, świeży) |
| --- | --- | --- | --- | --- |
| `inicjatywy-lista` | **C** | Realny `<InitiativesHub>` w tym wejściu harnessu pada na `INITIATIVE_DATA_CONTRACT_ERROR` zamiast pokazać dane demo — `seedRealisticSession()` ustawia `isDemoMode:true` w żywym store, ale `shouldAllowDemoData()` czyta WYŁĄCZNIE `localStorage['consultify-storage']`, a zapis tam jest debounce'owany o 300ms (i przesuwany dalej przy każdym kolejnym `setState`) — pierwszy fetch startuje przed zapisem i idzie prawdziwą ścieżką API, która w harnessie zwraca HTML zamiast JSON. Retry po odczekaniu również padał (zaobserwowane 3 nieudane próby pod rząd) — podejrzewam, że okno debounce w tym konkretnym montażu jest dłuższe niż mój test. **Nie mam pewności, czy to wyłącznie usterka stanowiska pomiarowego, czy realna wada architektury (ten sam wzorzec `shouldAllowDemoData()` może się ścigać z debounce także w produkcji tuż po przełączeniu trybu demo w Ustawieniach)** | **Zgłoszone** — plik z wołaniem (`src/services/api.ts` `getDemoFlags()`/`shouldAllowDemoData()`, `src/store/useAppStore.ts` debounce'owany `appStoreStorage`) poza moim zakresem plików; do naprawy harnessowej strony wymaga `dev-render/mocks/seedStore.ts`, też poza `dev-render/screens/` moich ekranów | `inicjatywy-lista__PRZED__{light,dark}.png` |
| `capacity-advisor-a3` | B | Kolumny „Rola/Zespół", „Rodzaj", „Presja (zakres)" ucinają tekst w połowie słowa („engineeri…", „Ogranicz…", „Potwierdz…") — kolumny StandardTable za wąskie na treść. Ten sam wzorzec co opisany w pamięci „naprawa per-wywołanie odrasta" (min-width nie ratuje w table-fixed) | **Zgłoszone** — `src/components/shared/ModuleHub/FilterableTable.tsx` / `StandardTable`, plik wspólny, zakaz dotykania | `capacity-advisor-a3__PRZED__{light,dark}.png` |
| `plan-scenario-d1` | **C** | ★★ Potwierdzam DOKŁADNIE uwagę właściciela z kontekstu zadania: klik wiersza w prawdziwym `<InitiativesHub>` → zakładka „Plan" otwiera poprawny prawy panel podglądu (dobrze), ale przycisk „Otwórz" w tym panelu NIE otwiera karty inicjatywy — otwiera „Warsztat planu" jako DRUGĄ TABELĘ wciśniętą POD pierwszą tabelą (layout łamie się w trakcie przejścia, nagłówek/pierwszy wiersz górnej tabeli zostaje ucięty w połowie). Do tego druga tabela pokazuje surowe angielskie wartości enuma zamiast polskich etykiet górnej tabeli: `NOW`/`NEXT`/`LATER`, `KNOWN`/`UNKNOWN`, `HIGH`/`MEDIUM`/`LOW`, `NONE` — podczas gdy górna tabela dla TYCH SAMYCH danych pokazuje „Nieznane"/„Znane", „Wysoki"/„Średni", „Brak". Odtworzone w standalone wejściu harnessu (`?screen=plan-scenario-d1`) i przez prawdziwy `<InitiativesHub>` (`?screen=inicjatywy-lista` → zakładka Plan → wiersz → „Otwórz") | **Zgłoszone, NIE naprawiane** (zgodnie z poleceniem „zbadaj i zgłoś, nie buduj") — źródło to prawdopodobnie `PlanScenarioSurface`/warsztat planu w `src/components/Initiatives/` (mój zakres plików, ale zmiana wymaga decyzji produktowej: czy „Otwórz" ma prowadzić do karty inicjatywy, czy warsztat ma zostać, ale dostać tłumaczenie i nie zgniatać górnej tabeli) | `plan-scenario-d1__PRZED__{light,dark}.png` + `test-hub-plan-otworz2.png` w scratchpadzie (dowód interakcji, nie w katalogu evidence) |
| `ev-football-field` | A | — | — | `ev-football-field__PRZED__{light,dark}.png` |
| `karta-initiative` | A | Sprawdzone: „Wypełnij z AI" (kontekst zadania mówił, że panel istniał, ale nikt go nie otwierał) faktycznie otwiera działający panel „Konsultant AI" z 6 akcjami i czatem z Teresą — nie martwy przycisk. Treść bogata, po polsku, kanon triady/SPEC-A trzymany | — | `karta-initiative__PRZED__{light,dark}.png` + `test-karta-wypelnij-ai.png` w scratchpadzie |
| `initiative-record` | B | Fixture pokazowa (`init-showcase-margin-leakage-recovery` — „Margin Leakage Recovery Sprint") ma WSZYSTKIE pola treści (Problem/Opis rozwiązania/Koszt bezczynności/Kontekst rynkowy) po angielsku, mimo że etykiety pól i cała powłoka są po polsku — kontrastuje z inną fixturą demo (SMED/L3) widoczną na `karta-initiative`, która jest w 100% polska | **Zgłoszone** — dane fixture, nie plik komponentu; ten sam fixture występuje też na `exe-002-004-ui-audit` (patrz niżej) | `initiative-record__PRZED__{light,dark}.png` |
| `initiatives-portfolio-analysis` | D | Ekran zdementowany z rejestru harnessu (`SCREENS` w `dev-render/main.tsx` ma ten wpis zakomentowany) — nie da się wyrenderować, nie da się ocenić wzrokiem | — (zgodne z D = odłożone) | `initiatives-portfolio-analysis__BRAK-EKRANU__light.png` (ekran fallbacku harnessu, dowód że wpis nie istnieje) |
| `execution-report-day11` | A | — | — | `execution-report-day11__PRZED__{light,dark}.png` |
| `exe-002-004-ui-audit` | B | Ten sam fixture angielski co `initiative-record` (patrz wyżej) | **Zgłoszone** (patrz wyżej) | `exe-002-004-ui-audit__PRZED__{light,dark}.png` |
| `execution-export-prezentacja` | D | Zdementowany z rejestru harnessu, jak wyżej | — | `execution-export-prezentacja__BRAK-EKRANU__light.png` |
| `execution-change-signals` | D | Zdementowany z rejestru harnessu, jak wyżej | — | `execution-change-signals__BRAK-EKRANU__light.png` |
| `cel-jedna-karta` | A | Prototyp jednej N-karty celu/OKR — 5 sekcji lewego menu, prawy panel 7 sekcji kanonu, treść bogata i w 100% polska, nic nie wygląda urwane | — | `cel-jedna-karta__PRZED__{light,dark}.png` |
| `wskaznik-jedna-karta` | A | Prototyp karty wskaźnika — nagłówek pokazuje PRAWDZIWĄ nazwę („KPI — Czas przezbrojenia, linia pakowania L3"), numer `KPI-0087` jest osobnym polem referencyjnym w prawym panelu, NIE zastępuje nazwy — to jedyny z ekranów KPI w moim zakresie, który NIE ma defektu „brak nazwy" opisanego niżej | — | `wskaznik-jedna-karta__PRZED__{light,dark}.png` |
| `roi-jedna-karta` | A | **Werdykt scalenia ROI (patrz kontekst zadania): trzyma kanon, NIC nie zginęło.** Sprawdziłem osobno wszystkie 5 sekcji (`&sekcja=zalozenia,model,wynik,wyniki-po-wdrozeniu,wnioski`) — każda ma pełną, spójną, dobrze uźródłowioną treść (np. „Źródła liczb", „Wrażliwość — co zmienia wynik", „Przyczyna rozjazdu" z konkretną diagnozą operacyjną). Prawy panel ma 7 sekcji kanonu. Kolor czerwony użyty tylko semantycznie (ujemny rozjazd w tabeli) | — | `roi-jedna-karta__PRZED__{light,dark}.png` + 4 dodatkowe zrzuty sekcji w scratchpadzie |
| `results-vnext-legacy-archive` | A | Tabela pokazuje surowe nazwy tabel bazy (`kpi_definitions`, `tp_kpi_definitions`…) — ale to świadomie techniczny ekran „tylko do odczytu" dla śledzenia migracji, nie ekran dla zwykłego użytkownika, więc nie flaguję jako defekt kanonu | — | `results-vnext-legacy-archive__PRZED__light.png` |
| `results-vnext-okr-objectives` | A | Stan „N.D." używany konsekwentnie tam, gdzie brak pomiaru — nie nagie zero | — | `results-vnext-okr-objectives__PRZED__light.png` |
| `results-vnext-kpi-scorecards` | B | Lista KPI w karcie wyników pokazuje surowe, ucięte kody bez żadnego wyjaśnienia: „kpi-oee-…", „kpi-defe…", „kpi-czas…" — gorszy wariant defektu „brak nazwy" opisanego niżej, bo tu nie ma nawet podpisu-wyjaśnienia | **Zgłoszone** — to dane (kontrakt KPI), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-scorecards__PRZED__{light,dark}.png` |
| `results-vnext-roi-model` | B | Dwa defekty: (1) kolumna „PEWNOŚĆ" w tabeli „Baseline i polityka" jest ucięta przez prawy panel — nagłówek widoczny tylko jako „PEW", wartości „Wys…"/„Śre…"; (2) właściwość „Ziarno analizy" pokazuje surową angielską wartość `monthly` zamiast polskiej etykiety (przy tym sama etykieta pola JEST przetłumaczona — „Ziarno analizy") | **Zgłoszone** — `src/components/ResultsVNext/roi/RoiCaseFullTool.tsx:269` (wartość `roiCase.granularity` bez mapowania na etykietę PL) jest w moim zakresie i jest prostą poprawką, ale nie zdążyłem zweryfikować pełnej listy możliwych wartości `granularity` przed końcem dyżuru — zostawiam do zrobienia razem z naprawą przycinania kolumny (prawdopodobnie w `ArtifactPropertiesTable`/tabeli obok, plik wspólny) | `results-vnext-roi-model__PRZED__{light,dark}.png` |
| `results-vnext-kpi-tool` | **C** | Nagłówek H1 całego ekranu to surowy kod `OEE-LINIA-PAKOWANIA` — bez nazwy, bez podpisu wyjaśniającego (w przeciwieństwie do rejestru, który przynajmniej dopisuje „Kod KPI (brak nazwy)"). To NAJGORSZY z odnalezionych wariantów defektu opisanego w kontekście zadania | **Zgłoszone** — to dane (kontrakt KPI), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-tool__PRZED__{light,dark}.png` |
| `results-vnext-roi-full-tool` | A | — | — | `results-vnext-roi-full-tool__PRZED__light.png` |
| `results-vnext-okr-admin` | A | Stan „jeszcze nie włączone" jest uczciwy i dobrze opisany („Ta powierzchnia jest w budowie…") — nie awaria udająca pustkę | — | `results-vnext-okr-admin__PRZED__light.png` |
| `results-vnext-teresa-okr-reflection` | A | Formularz refleksji kompletny, po polsku, przycisk „Poproś Teresę o szkic refleksji" obecny i osadzony w treści (nie martwy) | — | `results-vnext-teresa-okr-reflection__PRZED__light.png` |
| `results-vnext-okr-registry` | A | Sprawdzone: „Nowy OKR" (kontekst zadania: „rejestr OKR dostał jeden przycisk... z realnym formularzem") faktycznie otwiera pełny modal (Tytuł/Program/Cykl/Zasięg/Identyfikator zasięgu/Notatka) — potwierdzam, nie martwy przycisk | — | `results-vnext-okr-registry__PRZED__{light,dark}.png` + `test-nowy-okr.png` w scratchpadzie |
| `results-vnext-roi-registry` | A | Nazwy spraw ROI czytelne po polsku, statusy poprawnie przetłumaczone | — | `results-vnext-roi-registry__PRZED__light.png` |
| `results-vnext-kpi-registry` | B | ★ Wszystkie 5 wierszy rejestru KPI pokazuje surowy kod jako główną etykietę + podpis „Kod KPI (brak nazwy)": `OEE-LINIA-PAKOWANIA`, `ZGLOSZENIA-DO-ZATWIERDZENIA`, `KOSZT-PRACY-REDUKCJA`, `AUDYT-DOSTAWCY-POKRYCIE`, `CYKL-ZAMKNIECIA-MIESIACA`. Dokładnie ekran wskazany w kontekście zadania. UI radzi sobie z tym uczciwie (podpis wyjaśniający, nie udaje że nic się nie stało) | **Zgłoszone** — to dane (kontrakt KPI nie ma pola nazwy, tylko kod), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-registry__PRZED__{light,dark}.png` |
| `results-vnext-teresa-kpi-deviation` | A (po naprawie) | Banner „Działania korygujące i plan" pokazywał surowy żargon inżynierski wprost użytkownikowi: „Brak endpointu odczytu listy działań korygujących (patrz kpiDeviationApi.ts) — poniższa lista zawiera WYŁĄCZNIE działania dodane w tej sesji przeglądarki, nie pełną historię z bazy" — nazwa pliku źródłowego i żargon „endpoint" w produkcyjnym komponencie, zawsze renderowany (`role="note"`, bez warunku) | **Naprawione** — `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx:677-680`, nowy tekst: „Ta lista pokazuje wyłącznie działania dodane w bieżącej sesji przeglądarki — po odświeżeniu strony wcześniej zapisane działania mogą tu nie być widoczne." (ostrzeżenie zachowane, żargon i nazwa pliku usunięte) | `results-vnext-teresa-kpi-deviation__PRZED__{light}.png` (defekt) + `results-vnext-teresa-kpi-deviation__PO__{light,dark}.png` (naprawione) |
| `results-three-pairs` | A | KPI w tym widoku MAJĄ prawdziwe polskie nazwy („OEE linii pakowania", „Redukcja kosztów pracy") — kontrastuje z rejestrem/narzędziem KPI, gdzie te same koncepty pokazują surowe kody. Patrz niespójność niżej | — | `results-three-pairs__PRZED__light.png` |
| `results-vnext-attention` | B | Zakładka KPI → kubełek „Brak właściciela" pokazuje tabelę z jedyną kolumną „KOD KPI" i wartościami `DPMO-002`, `DWT-003` — bez nazw, bez podpisu wyjaśniającego jak w rejestrze | **Zgłoszone** — to dane, nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-attention__PRZED__light.png` |
| `results-vnext-okr-workspace` | A | Kompletny widok „Przegląd" zestawu OKR, cykl życia z jasnymi regułami dostępności przycisków („Złożenie do akceptacji: wymaga statusu…") — drobne (nieblokujące) ucięcia `user-ann…`/`user-tom…` w polu Właściciel/Recenzent | — | `results-vnext-okr-workspace__PRZED__light.png` |
| `results-vnext-roi-pir-outcomes` | A | Statusy i etykiety wyników PIR w pełni po polsku i czytelne | — | `results-vnext-roi-pir-outcomes__PRZED__light.png` |
| `results-vnext-search-registry` | A | Stan pusty przed wpisaniem zapytania jest uczciwy i wyjaśniony („Wpisz co najmniej 2 znaki") | — | `results-vnext-search-registry__PRZED__light.png` |
| `results-zestawienia` | A | POZIOM 1 rejestru zestawień okresowych — nazwy zestawień, właściciele i stan wskaźników w pełni po polsku, czytelne, żadnych kodów zamiast nazw (bo to zestawienia, nie pojedyncze KPI) | — | `results-zestawienia__PRZED__light.png` |
| `results-vnext-registry-shell` | D | ★★★ Ekran odłożony (`D`), ale skoro jest renderowalny, odnotowuję: PRAWIE CAŁA powłoka jest po angielsku — zakładki „My"/„Org", przycisk „New KPI", filtry „All/Locked/Not calculable", nagłówki tabeli „NAME/STATUS/OWNER/VALUE/UPDATED", statusy „In review"/„Approved"/„Draft"/„Closed", `N/A`, w prawym panelu treść AI po angielsku („AI recommendation: on track — no action needed this cycle."), akcje „Summarize record"/„Suggest next steps"/„Approve"/„Delegate". Tylko powłoka wokół (Otwórz/Szczegóły/Lista/Uwagi) jest po polsku. Najgorsze naruszenie „angielszczyzny w interfejsie" z całego mojego zakresu | **Zgłoszone** — zgodne ze statusem D (odłożone, niepodpięte do żadnego huba wg etykiety w `dev-render/main.tsx`); jeśli ten komponent ma kiedyś zastąpić `results-vnext-kpi-registry`/`-okr-registry`/`-roi-registry`, potrzebuje pełnej lokalizacji od zera | `results-vnext-registry-shell__PRZED__{light,dark}.png` |

**30/33 ekranów obejrzanych na świeżym, żywym zrzucie. 3/33 potwierdzone jako
niemożliwe do wyrenderowania (D, zdementowane w `dev-render/main.tsx`).**
A=19 (w tym 1 po naprawie) · B=7 · C=3 · D=4.

### Naprawione (pliki z nazwy)

- `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` (linie
  677–680) — usunięty żargon inżynierski i nazwa pliku źródłowego
  (`kpiDeviationApi.ts`) z bannera widocznego użytkownikowi na ekranie
  `results-vnext-teresa-kpi-deviation`; ostrzeżenie o zakresie danych sesji
  zachowane, przeformułowane na język bez „endpoint"/nazwy pliku.

### Defekty w plikach wspólnych (do których nie wolno mi się dotykać) — ZGŁASZAM

1. **Kolumny StandardTable ucinają tekst w połowie słowa** na `capacity-advisor-a3`
   (i prawdopodobnie szerzej) — `src/components/shared/ModuleHub/FilterableTable.tsx`.
   Ten sam wzorzec co w module 01-czat/12-spotkania/15-agent (`chat-signals-feed`,
   zobacz sekcję wyżej) — wygląda na systemowy problem szerokości kolumn StandardTable,
   nie coś specyficznego dla jednego ekranu.
2. **`shouldAllowDemoData()` (`src/services/api.ts`) czyta wyłącznie
   `localStorage['consultify-storage']`, a zapis do tego klucza jest
   debounce'owany 300ms w `appStoreStorage` (`src/store/useAppStore.ts`)** — gdy coś
   ustawia `isDemoMode: true` tuż przed pierwszym fetchem zależnym od tej flagi
   (harness: `seedRealisticSession()`; produkcja: prawdopodobnie przełącznik „Pokaż
   dane demo" w Ustawieniach), pierwszy fetch może się prześcignąć z zapisem i pójść
   błędną ścieżką. Zobacz `inicjatywy-lista` wyżej — nie jestem pewien, czy to
   wyłącznie wada harnessu, dlatego zgłaszam z ostrzeżeniem, nie z pewnością.

### Zbiorczo: wskaźniki KPI bez nazwy w kontrakcie danych (DANE, NIE GRAFIKA — nie naprawiałem)

Tor funkcji zgłosił ten problem przed moim dyżurem; potwierdzam i lokalizuję
dokładnie, na ilu ekranach jest widoczny w moim zakresie:

- `results-vnext-kpi-registry` — wszystkie 5 wierszy, z podpisem „Kod KPI (brak nazwy)"
- `results-vnext-kpi-scorecards` — 3 wiersze, surowe ucięte kody, BEZ podpisu
- `results-vnext-kpi-tool` — nagłówek H1 całego ekranu to surowy kod, BEZ podpisu
- `results-vnext-attention` (zakładka KPI → „Brak właściciela") — 2 wiersze, surowe kody, BEZ podpisu

Kontrastuje z `wskaznik-jedna-karta` (prototyp) i `results-three-pairs`, gdzie TE
SAME koncepty KPI (np. „OEE linii pakowania") mają prawdziwe polskie nazwy — czyli
przynajmniej część fixture'ów demo MA nazwy, ale ścieżka danych rejestru/narzędzia/
tool czyta pole, które ich nie ma. To potwierdza diagnozę toru funkcji: brakuje pola
nazwy w kontrakcie danych KPI, nie da się tego naprawić w warstwie UI.

### Niespójności wewnątrz modułu

- **Nazwy KPI: kod vs prawdziwa nazwa** — patrz sekcja zbiorcza wyżej.
- **Dwie różne fixtury demo dla inicjatyw**: karta SMED/L3 (`karta-initiative`) w
  100% po polsku, kontra fixture pokazowa „Margin Leakage Recovery Sprint"
  (`initiative-record`, `exe-002-004-ui-audit`) w 100% po angielsku dla treści pól —
  ta sama powłoka, dwa różne standardy językowe danych demo.
- **Dwie różne fixtury demo dla „Plan inicjatyw"**: standalone `plan-scenario-d1`
  pokazuje polski „Plan transformacji operacyjnej" z polskimi nazwami inicjatyw,
  a ten sam ekran osadzony w prawdziwym `<InitiativesHub>` (zakładka Plan) pokazuje
  angielski „Atelier Transformation Plan" z angielskimi nazwami inicjatyw
  („Knowledge Hub Rollout", „Supplier Onboarding Portal"...) i angielskimi filtrami
  Menu3 („Unscheduled/Now/Next/Later/Conflicted/Missing dependencies/Needs
  capacity/Ready for schedule/Published") — dwa różne zestawy danych demo dla
  tego samego ekranu w zależności od wejścia.

---

## Moduły 03-wywiad, 05-ocena

**Dowód:** świeży zrzut KAŻDEGO z 25 ekranów, oba motywy, wykonany przeze mnie w tej
sesji przez `scripts/dev/grafika-zrzuty.mjs --katalog=132-noc-wywiad-ocena`, w
`evidence/grafika/132-noc-wywiad-ocena/`. 6 ekranów naprawionych → dodatkowe zrzuty
`__PO__`. Każdy plik obejrzany przez `Read` osobiście (światło zawsze, ciemny motyw
przy każdym ekranie z realnym ryzykiem regresji — pełna lista niżej), nie z rejestru
`status.json` ani z cudzych zrzutów. Weryfikacja:
`ls evidence/grafika/132-noc-wywiad-ocena | wc -l` → 68 plików (25 ekranów × 2 motywy
`__PRZED__` = 50, plus 9 ekranów re-zrzuconych `__PO__` w obu motywach = 18).

**Uwaga o `status.json`:** pola `ocena`/`co`/`naprawione` dla tych 25 ekranów były już
w bazie przed moją sesją (widoczna data 2026-08-30, ale bez znacznika godziny). Część
z nich okazała się NIEAKTUALNA — dziś wieczorem, po mojej weryfikacji na żywym zrzucie,
kilka ekranów jest w lepszym stanie niż tam zapisano (`karta-interview`,
`assessment-initiatives-panel`, `assessment-manage-panel` — patrz tabela). Nie ufałem
tym polom jako dowodowi — użyłem ich jako punktu startowego do zweryfikowania, zgodnie
z regułą „hipoteza nadzorcy nie staje się faktem bez pomiaru".

### Tabela ekranów — 03-wywiad (6/6 obejrzanych)

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `interview-creator-shell` | A | — | — | `interview-creator-shell__PRZED__{light,dark}.png` |
| `unified-create-launcher` | A | Karta „Insight" zostaje po angielsku — zweryfikowałem: `src/components/shared/UnifiedCreateLauncher.tsx:67` to świadoma decyzja (termin produktowy), zgodna z notatką w `status.json`. Nie defekt | — | `unified-create-launcher__PRZED__{light,dark}.png` |
| `interview-preview-canon` | A | Panel „Powiązania" pokazywał mock z literalnym angielskim „Assignee: Ala Kowalska" (produkcja używa `t('interview.hub.assignee3')`="Przypisany"), surowym enumem „Priorytet: medium" i nazwą organizacji „W3 Interview Owner Review" — brzmiącą jak wewnętrzne zadanie robocze, nie klient. Błąd stanowiska pomiarowego (mock niezgodny z i18n produkcji), nie produktu | **Naprawione** — `dev-render/screens/interview-preview-canon.tsx` (3 etykiety); przy okazji znalazłem, że TEN SAM surowy enum „medium" (bez tłumaczenia) renderuje się naprawdę w produkcji na ekranie Inicjatyw Wywiadu — naprawione w `src/components/Interview/InterviewHub.tsx:7679` (mapowanie przez istniejący słownik `interview.newSessionModal.priorityLabel.*`) | `interview-preview-canon__PRZED__{light,dark}.png` |
| `interview-sessions-status` | A | Konsola: 5 błędów „Failed to load insights/assignments" — sprawdziłem ręcznie (Playwright, live console): to brak backendu w harnessu (pułapka #12 z CLAUDE.md), tabela renderuje się z 5 realnymi wierszami mimo błędów. Nie defekt produktu | — | `interview-sessions-status__PRZED__{light,dark}.png` |
| `drd-http-workspace` | A | Nagłówek pokazuje „Method Pack 2.0.0-methodpack.1" i „Sesja sess-htt" (surowy identyfikator ucięty do nieczytelnego skrótu) — źródło: `src/components/method-workspace/MethodWorkspaceShell.tsx:246-248`, plik POZA moim zakresem (nie `Interview/`ani`assessment/`), współdzielony też przez `method-workspace`, `siri-workspace`, `siri-tier`. „Digital Pathfinder" w tytule to NIE żargon — to prawdziwa nazwa marki metodyki właściciela (`compileDrdPack.ts:354`), zostawione celowo | **Zgłoszone** | `drd-http-workspace__PRZED__{light,dark}.png` |
| `karta-interview` | **A** (status.json: C) | `status.json` twierdził „prawy panel ma trzy z sześciu kanonicznych sekcji, brak Akcje/Źródła i założenia/Komentarze". Na świeżym zrzucie widzę WSZYSTKIE 6 sekcji we właściwej kolejności: Akcje·Właściwości·Powiązania·Źródła i założenia·Komentarze·Historia. Naprawione przez kogoś innego między wpisem a dziś wieczorem — podnoszę ocenę na podstawie tego, co faktycznie widzę na ekranie, nie na podstawie rejestru | — (już naprawione, nie przeze mnie) | `karta-interview__PRZED__{light,dark}.png` |

**6/6 ekranów Wywiadu obejrzanych na świeżym zrzucie.** A=6 · B=0 · C=0 · D=0.

### Tabela ekranów — 05-ocena (19/19 obejrzanych)

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `assessment-menu3-status-chips` | A | Kolumna „Obszar" w 100% po angielsku (Digital transformation, Smart manufacturing…) mimo że nagłówki i chipy obok są polskie — katalog `METHODOLOGY_CATALOG` w ogóle nie miał wariantu PL (opis/obszar/dostęp/„co dostajesz") | **Naprawione** — `src/components/assessment/library/AssessmentLibraryTab.tsx`: cały katalog przepisany na `{pl,en}`, 5 wierszy × 4 pola | `assessment-menu3-status-chips__PO__{light,dark}.png` |
| `method-workspace` | A | — | — | `method-workspace__PRZED__light.png` |
| `assessment-report-contract` | A | — | — | `assessment-report-contract__PRZED__{light,dark}.png` |
| `assessment-quality-review-panel` | A | — (wzorcowe „brak" zamiast surowego zera) | — | `assessment-quality-review-panel__PRZED__light.png` |
| `assessment-output-report` | **B** (nazwany wyjątek) | ★★★ Sekcja „Ograniczenia i założenia" cytuje wprost nazwę klasy inżynierskiej i żargon: „Output wygenerowany automatycznie z lokalnego event-store (vertical-slice demo, przeglądarka) — businessMeaning/recommendation to deterministyczne szablony…" oraz drugie zdanie „aggregation.byGroup jest pusta — agregacja per-oś (drdAdapter.aggregate) liczona jest osobno…" — to DOKŁADNIE ten defekt, który instrukcja nocna nazwała z góry po nazwie (`EventDerivedOutputBridge`, `vertical-slice demo`). Źródło: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623` — POZA moim zakresem (`method-core`, nie `Interview/`/`assessment/`), i to jest source-of-truth używany też przez eksport/PDF, więc łatanie samego widoku zamaskowałoby, nie naprawiło | **Zgłoszone jako #1 priorytet** | `assessment-output-report__PRZED__light.png` |
| `assessment-reports-table` | A | — | — | `assessment-reports-table__PRZED__light.png` |
| `assessment-artifacts-restart` | A | Nagłówki tabeli 100% angielskie mimo polskiego otoczenia: „SCOPE/MODULE/VERSION/FROZEN AT" (wołały `t()` z kluczami, których nie ma w `public/locales/pl` — cichy spadek na fallback EN); komórka „MODULE" pokazywała surowe `assessment` zamiast etykiety. Osobno zweryfikowałem: powtarzający się tekst „0 · 3 ukryte: hub nie pobiera podziału…" na chipach Menu 3 to ŚWIADOMA, udokumentowana w kodzie uczciwa informacja (kanon „nagie zero zakazane"), nie błąd — zostawiłem bez zmian | **Naprawione** — `src/components/assessment/AssessmentOutputsTab.tsx` (4 nagłówki kolumn + mapowanie `module` na etykietę, wzorem `statusLabel(isPolish, …)` już używanym w tym pliku) | `assessment-artifacts-restart__PO__{light,dark}.png` |
| `assessment-five-surfaces` | A | Ten sam angielski „Obszar" co `assessment-menu3-status-chips` — to REALNY `AssessmentHub`, więc naprawa w `AssessmentLibraryTab.tsx` naprawiła też ten ekran automatycznie (zweryfikowane zrzutem `__PO__`) | **Naprawione** (przy okazji naprawy wyżej) | `assessment-five-surfaces__PO__{light,dark}.png` |
| `drd-library-entry` | A | Pływający pasek wyjaśniający flagę dla inżyniera („Flaga drdMethodWorkspaceSliceV1 = ON — PODWÓJNE kliknięcie…") renderował się w kadrze, nieoznaczony jako chrom harnessu (pułapka #7 z CLAUDE.md — dokładnie ta sama klasa co naprawa w `siri-workspace` niżej) | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/drd-library-entry.tsx` | `drd-library-entry__PO__{light,dark}.png` |
| `assessment-list` | A | — | — | `assessment-list__PO__light.png` |
| `assessment-reports-panel` | A | `status.json` miał wyjątek „obudowa ekranu po angielsku" — na dzisiejszym zrzucie ekran jest w 100% polski, wyjątek nieaktualny | — | `assessment-reports-panel__PO__light.png` |
| `assessment-presentation-view` | B | Slajd 1/13 czysty i uczciwy językowo. Nie zdążyłem przejść wszystkich 13 slajdów — zapisany wcześniej defekt „slajd 5 pokazuje paski bez nazw osi" (naprawa wymaga wspólnego jądra metodyk) NIE zweryfikowany dziś, zostawiam ocenę B z tego samego, nazwanego wcześniej powodu | — (nie weryfikowałem ponownie) | `assessment-presentation-view__PO__light.png` |
| `assessment-initiatives-table` | A | `status.json` miał wyjątek „obudowa po angielsku" — dziś w 100% polski (Tablica inicjatyw strategicznych, wszystkie nagłówki i statusy). Konsola: 8 błędów „Failed to fetch transitions" — zweryfikowałem live: harness bez backendu zwraca HTML zamiast JSON, dane i tak renderują się z mocka. Nie defekt. Osobno: chip priorytetu to WYPEŁNIONA pigułka (Krytyczny/Wysoki/Średni/Niski), a kanon (`TRIADA_KANON.md` A4/C1) każe „kropka + tonowany tekst, zero wypełnionych pigułek" dla priorytetu — wzorzec powtarza się na wielu ekranach aplikacji, nie jest unikalny dla dziś, więc tylko zgłaszam, nie zmieniam oceny | **Zgłoszone** (styl pigułki priorytetu) | `assessment-initiatives-table__PO__light.png` |
| `siri-workspace` | B | Pływający pasek pomiarowy harnessu „SIRI pack: 96/96 band descriptors EVIDENCE_MISSING · 0/16 wymiarów…" w kadrze, nieoznaczony jako chrom. Napis „Help content unavailable" pozostaje po angielsku (`src/components/method-workspace/QuestionHelpDisclosure.tsx:45` — celowa strażniczka anty-halucynacyjna, ale sam string nie ma wariantu PL; plik poza moim zakresem) | **Naprawione** (pasek pomiarowy) — `data-dev-render-chrome` w `dev-render/screens/siri-workspace.tsx`; **zgłoszone** (Help content unavailable) | `siri-workspace__PO__light.png` |
| `assessment-initiatives-panel` | **A** (status.json: C) | `status.json`: „cały ekran po angielsku, zdublowany klucz konsoli EXECUTING". Na świeżym zrzucie ekran jest w 100% polski (Inicjatywy, Priorytet, Status, Wpływ/Wysiłek…), a live-check konsoli (Playwright) nie pokazał ŻADNEGO błędu — oba problemy naprawione przez kogoś innego od czasu wpisu | — (już naprawione, nie przeze mnie) | `assessment-initiatives-panel__PRZED__light.png` |
| `assessment-manage-panel` | **B** (status.json: C, częściowo zweryfikowane) | `status.json`: „cały ekran po angielsku — 884 linie bez klucza tłumaczeń". Domyślna zakładka „Przepływ" jest dziś w 100% polska (Zarządzanie, Postęp przepływu, Etap, Decyzja bramki…) — wyraźna poprawa od wpisu. NIE sprawdziłem pozostałych 4 zakładek (Zespół/Raporty/Inicjatywy/Dziennik z tych samych 884 linii) — nie mam podstaw twierdzić, że cały plik jest już polski, tylko że domyślny widok jest | — (nie moja naprawa; wymaga dokończenia weryfikacji pozostałych zakładek) | `assessment-manage-panel__PRZED__{light,dark}.png` |
| `siri-tier` | C | Potwierdzone zgodnie z `status.json`: ekran diagnostyczny dla inżyniera (calculationVersion, planningHorizon, surowe wagi obliczeń), prawie w całości po angielsku, jawnie nieprzeznaczony dla klienta. Bez zmian | — | `siri-tier__PRZED__light.png` |
| `assessment-matryca` | **C** (status.json: D, zły powód) | `status.json`: „D — harness nie ma zarejestrowanego tego ekranu". NIEPRAWDA — ekran renderuje się poprawnie przez `?screen=assessment-matryca` (`DRDMatrixSession`). Prawdziwy defekt jest inny: silny rozjazd językowy WEWNĄTRZ ekranu — lewy panel osi (od `DRDMatrixSession`, honoruje `isPolish`) jest po polsku („1. Procesy Cyfrowe", „1A · Procesy Sprzedaży"), ale całe centrum ekranu (`src/components/MaturityMatrix.tsx` — ZERO kluczy i18n w całym pliku) jest na sztywno po angielsku: „9 OF 9 AREAS EVALUATED", „ASSESSMENT AREAS", „Complete Assessment", „Not sure? Ask AI to Diagnose", nazwy poziomów/obszarów. Dodatkowo `DRDMatrixSession` czyta nazwy osi/poziomów z zakazanego `src/services/drdStructure.ts` | **Zgłoszone** — `src/components/MaturityMatrix.tsx` poza moim zakresem (nie `assessment/`), a `drdStructure.ts` jawnie zakazany | `assessment-matryca__PRZED__{light,dark}.png` |
| `drd-macierz-oceny` | B | Potwierdzone zgodnie z `status.json`: wizualnie wypolerowana (popover z tłem, 9/9 kolumn w kadrze, Spacious działa, oba motywy czytelne), ale treść komórek nadal kłamie (23/63 fałszywych w osi 1) i etykiety poziomów/obszarów po angielsku — źródło `src/services/drdStructure.ts`, zakazany. Bez zmian | — | `drd-macierz-oceny__PRZED__{light,dark}.png` |

**19/19 ekranów Oceny obejrzanych na świeżym zrzucie.** A=13 · B=4 · C=2 · D=0.

### Razem: 25/25 ekranów obejrzanych na świeżym zrzucie. A=19 · B=4 · C=2 · D=0.

### Naprawione (pliki z nazwy)

- `dev-render/screens/interview-preview-canon.tsx` — mock „Assignee"→„Przypisany", surowy enum „medium"→„Średni", nazwa organizacji nie brzmi jak wewnętrzne zadanie
- `src/components/Interview/InterviewHub.tsx` — surowy enum priorytetu („medium") w Powiązaniach karty Inicjatywy Wywiadu → etykieta z istniejącego słownika tłumaczeń (L. ~7679)
- `src/components/assessment/library/AssessmentLibraryTab.tsx` — cały katalog metodyk (`METHODOLOGY_CATALOG`) przepisany na pary `{pl,en}`: opis, obszar, warunek dostępu, „co dostajesz", plus pusty stan tabeli
- `src/components/assessment/AssessmentOutputsTab.tsx` — nagłówki tabeli Scope/Module/Version/Frozen at → Zakres/Moduł/Wersja/Zamrożono; surowe `assessment` → „Ocena"
- `dev-render/screens/siri-workspace.tsx` — pasek pomiarowy harnessu oznaczony `data-dev-render-chrome`
- `dev-render/screens/drd-library-entry.tsx` — pasek wyjaśniający flagę oznaczony `data-dev-render-chrome`

Weryfikacja: `npx esbuild <plik> --jsx=automatic --outfile=/dev/null` czysty dla wszystkich sześciu; `scripts/check-list-canon.sh` i `scripts/check-triada.sh` obie zielone po zmianach.

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **★ NAJPOWAŻNIEJSZE: żargon inżynierski w kliencie-facing tekście raportu z oceny.**
   Plik: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623`. Sekcja
   „Ograniczenia i założenia" na `assessment-output-report` cytuje dosłownie
   `EventDerivedOutputBridge`, `vertical-slice demo`, `businessMeaning/recommendation`,
   `aggregation.byGroup`, `drdAdapter.aggregate` — nazwy klas i pól kodu w zdaniu
   pokazywanym klientowi. To DOKŁADNIE przykład nazwany z góry w instrukcji nocnej.
   Sugerowany tekst zastępczy: „Output wygenerowany automatycznie z danych sesji
   (wersja robocza, tryb podglądu przeglądarki) — treść (znaczenie biznesowe,
   rekomendacja) to deterministyczne szablony na bazie zebranych odpowiedzi, nie
   analiza LLM ani recenzja metodyka." To samo źródło zasila eksport/PDF, więc łatanie
   samego komponentu widoku w `AssessmentReportDocument.tsx` zamaskowałoby problem
   zamiast go naprawić — poprawka należy do źródła.
2. **`src/components/MaturityMatrix.tsx` — zero kluczy i18n w całym pliku**, renderuje
   `assessment-matryca` w 100% po angielsku obok polskiego panelu osi z tego samego
   ekranu (patrz tabela wyżej). To komponent szerszy niż mój zakres (używany też poza
   Oceną?) — proponuję osobne zadanie tłumaczeniowe, nie punktową łatkę.
3. **`src/services/drdStructure.ts` (jawnie zakazany plik)** — źródło angielskich nazw
   osi/obszarów/poziomów zasilające zarówno `drd-macierz-oceny` (już znane, `status.json`),
   jak i `assessment-matryca` (nowo potwierdzone dziś) oraz najpewniej raport/prezentację.
   Jeden fix u źródła naprawiłby kilka ekranów naraz.
4. **`src/components/method-workspace/MethodWorkspaceShell.tsx:246-248`** — nagłówek
   powłoki 4 ekranów (`drd-http-workspace`, `method-workspace`, `siri-workspace`,
   `siri-tier`) pokazuje surowe `Method Pack 2.0.0-methodpack.1` i ucięty identyfikator
   sesji `Sesja sess-htt` — techniczne wersjonowanie w kliencie-facing pasku tytułowym.
5. **`src/components/method-workspace/QuestionHelpDisclosure.tsx:45`** — hardkodowany
   angielski string „Help content unavailable" (celowa antyhalucynacyjna strażniczka
   metodyki, ale bez wariantu PL) na `siri-workspace` i prawdopodobnie innych ekranach
   Method Workspace.
6. **`public/locales/pl/translation.json:7024`** — literówka `"medium": "Sredni"` (bez
   ogonka, powinno być „Średni") w `interview.newSessionModal.priorityLabel` — tej samej
   mapie, której teraz używa naprawiony `InterviewHub.tsx`.
7. **Styl pigułki priorytetu** na `assessment-initiatives-table`/`assessment-initiatives-panel`
   — wypełniona, tonowana pigułka (Krytyczny/Wysoki/Średni/Niski) zamiast kanonu
   „kropka + tonowany tekst" (`TRIADA_KANON.md` A4, C1: „Zero wypełnionych pigułek" dla
   priorytetu). Wzorzec powtarza się na wielu ekranach poza moim zakresem — do zbiorczego
   sweepu, nie punktowej poprawki.

### Niespójności wewnątrz modułu

- **`assessment-matryca`**: panel osi po polsku, centrum ekranu (macierz + pasek narzędzi)
  w 100% po angielsku — dwa języki na jednym ekranie, patrz defekt wspólny #2.
- **`drd-macierz-oceny` i `assessment-matryca`**: dwa RÓŻNE ekrany macierzy oceny
  (`DRDAssessmentEditor` i `DRDMatrixSession`) — oba zasilane tym samym zakazanym
  `drdStructure.ts`, oba niosą ten sam rodzaj defektu (angielskie nazwy poziomów/obszarów).
  Wygląda na dwa niezależne wdrożenia tej samej mechaniki, nie jeden kanoniczny komponent.
- **Nazwa organizacji w mocku `interview-preview-canon`** brzmiała jak wewnętrzne zadanie
  robocze („W3 Interview Owner Review") zamiast nazwy klienta — naprawione, ale warto
  jako ostrzeżenie: dev-render mocki czasem dziedziczą nazewnictwo z commitów/gałęzi
  roboczych, nie z realnych danych demo.

---

