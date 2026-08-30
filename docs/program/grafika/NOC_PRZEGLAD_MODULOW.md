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

