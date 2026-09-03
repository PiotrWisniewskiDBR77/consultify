# Idee (Moja Praca) — dwa defekty z DECYZJE_WLASCICIELA_P0P1_20260904.md (wiersze 31, 32) — 2026-09-03

Robotnik. Worktree `/private/tmp/ag-idee`, gałąź `agent/idee-podpowiedz-pasek-20260903`,
harness `dev-render` na porcie 5426 (PID 40163, ubity po zakończeniu pracy).
Zrzuty: `/private/tmp/ag-idee-artefakty/idee-podpowiedz-pasek-20260903/` (poza repo,
zgodnie z parametrem `--wyjscie` ze zlecenia). a11y (axe): **0 naruszeń** na
wszystkich 20 zrobionych kadrów (JSON wyników obok zrzutów, `wynik-*.json`).

## MYW-IDEAS-008 — przycisk „Zapisz" w pasku tożsamości Idei

**Cytat właściciela / audytu** (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:119`):
„Simplify the contextual header: drop 3 legacy icons, add "New idea", remove
duplicate local Teresa and the redundant per-tool Save, audit Spark." Status
w dokumencie: `CZĘŚCIOWE` z notatką „per-tool Save was **moved**, not removed
— it now renders as a Menu 1 portal (`IdeaTableTool.tsx:3771–3786`,
`data-testid="idea-table-save-in-menu1"`)."

**Ustalenie: ten status jest NIEAKTUALNY.** Zweryfikowałem REALNY runtime
(nie dokument), zgodnie ze złotą regułą nr 1:

- Commit `9c5f6ec335` „fix(mywork): remove redundant idea table save control"
  (2026-08-25, **przodek HEAD** tej gałęzi — `git merge-base --is-ancestor
  9c5f6ec335 HEAD` → tak) usunął CAŁY blok opisany w audycie: i przycisk w
  pasku (`data-testid="idea-table-save-in-bar"`), i portal do Menu 1
  (`data-testid="idea-table-save-in-menu1"`, `createPortal(...,
  menu1ToolSlot)`) z `src/components/MyWork/IdeaTableTool.tsx` (było
  liniami ok. 3758–3812 sprzed commitu). Dodał w zamian
  `IdeaTableTool.autosaveOnly.contract.test.ts`.
- Sprawdziłem WSZYSTKIE cztery narzędzia idei, nie tylko Tabelę:
  - **Whiteboard** (`IdeaWhiteboardTool.tsx:4435`,
    `whiteboard/WhiteboardToolbar.tsx:457`) — realny przycisk Save w pasku
    narzędzia istnieje w komponencie, ale jest ukrywany propem
    `hideSaveIndicator={melsCanvasEnabled}` przekazywanym z
    `IdeaMapWorkspace.tsx:5083`. `melsCanvasEnabled` jest hardkodowane na
    `true` (`IdeaMapWorkspace.tsx:3655`), więc przycisk jest zawsze ukryty w
    aktywnej powłoce.
  - **Process Flow** — identyczny mechanizm:
    `processflow/ProcessFlowToolbar.tsx:510` + `hideSaveIndicator` z
    `IdeaMapWorkspace.tsx:5037` (też `melsCanvasEnabled`).
  - **Mind Map** (`IdeaRecommendationMap.tsx:5948–5949`) — komentarz w
    kodzie: „pasek tytuł/Mode/Not-saved USUNIĘTY W CAŁOŚCI (dublet +
    zapis jest ciągły — SaaS nie pokazuje 'not saved')". Nigdy nie miał
    przycisku.
  - **Pasek tożsamości** (`MyWorkHub.tsx`, `data-testid="idea-one-line-identity"`,
    linie ok. 2798–2830) — zawiera wyłącznie: Lista, kontekstowe „Nowy
    pomysł" (gdy otwarty dokument), zakładki dokumentów, kropkę statusu
    („Kształtuje się"), quiet-indicator autosave (`IdeaSaveIndicator`,
    `IdeaCanvasMenu1Bits.tsx:89` — `<span>` bez `onClick`, tylko etykieta typu
    „Zapisano 3s temu"), Teresę, kebab, „Konwertuj". **Zero przycisku Zapisz.**
- Zrzuty realnego ekranu (`?screen=mywork-idea-topbar&tool=…`), 4 warianty ×
  light/dark = 8 kadrów, `idee-podpowiedz-pasek-20260903/topbar-{tool}-PRZED/`:
  potwierdzają wzrokiem brak przycisku Zapisz we wszystkich czterech
  narzędziach (mindmap, whiteboard, process_flow, table), oba motywy.

**Wniosek:** mechanika zapisu jest AUTOSAVE (debounced `scheduleSave` w Mind
Map, `handleSave`/`_save` spięte tylko z Ctrl/Cmd+S jako skrót klawiszowy w
pozostałych trzech), a jedyny widoczny w UI element to bierny wskaźnik stanu.
Nie ma niczego do usunięcia — zadanie „usuń przycisk, upewnij się że autosave
działa" jest już spełnione przez wcześniejsze commity tej samej gałęzi
(`9c5f6ec335` i mechanizm `hideSaveIndicator`/`melsCanvasEnabled`). **Nie
zrobiłem żadnej zmiany kodu dla tego punktu** — nie ma czego commitować.

**Rozbieżność do decyzji nadzorcy:** `MODULE_ACCEPTANCE.md:119` wciąż mówi
`CZĘŚCIOWE` i cytuje linie `IdeaTableTool.tsx:3771–3786`, które od
2026-08-25 nie istnieją w tym kształcie (plik ma dziś inną zawartość w tym
zakresie — bulk-convert dropdown, nie Save). To DWA REJESTRY: dokument
audytu nie został zaktualizowany po commicie, który już zamknął ten punkt.
Proponuję: przestawić `MYW-IDEAS-008` na `ZROBIONE_W_KODZIE` z odnośnikiem do
`9c5f6ec335` + `hideSaveIndicator`/`melsCanvasEnabled`, chyba że nadzorca ma
świeższy zrzut właściciela pokazujący realny przycisk Zapisz gdzieś indziej
(nie znalazłem go po przeszukaniu wszystkich plików `Idea*.tsx` i
`MyWorkHub.tsx`).

## MYW-IDEAS-011 — pasek podpowiedzi AI tylko na Tablicy i Mapie myśli

**Cytat właściciela / audytu** (`MODULE_ACCEPTANCE.md:122`): „Tame or remove
the bottom AI banner: only real, sourced suggestions with explicit
preview/apply/dismiss and durable dismissal." Status: `CZĘŚCIOWE`, „**Still
open:** Process Flow and Table have no nudge strip; each needs its own
tool-appropriate `onActionExpand`/`onActionConvert` wiring (not a
copy-paste — Whiteboard's own mismatch, fixed once already ..., is the
cautionary example)."

**Ustalenie: dokładnie ten sam kształt błędu wystąpił ponownie.** Commit
`ef63b16715` „feat(mywork): add ai nudges to table and process flow"
(2026-08-25, przodek HEAD) zamontował `<IdeaAINudgeStrip>` w obu brakujących
narzędziach — grep-poziom „zamontowane" był PRAWDĄ, ale runtime był martwy:

- `IdeaProcessFlowTool.tsx:4392` i `IdeaTableTool.tsx:5304` przekazywały
  `isAccepted={false}` — literał na sztywno, NIGDY się nie zmienia.
- `IdeaAINudgeStrip.tsx:154` (`if (!isAccepted) return [];`) i `:352`
  (`if (!isAccepted || allNudges.length === 0) return null;`) — przy
  `isAccepted={false}` komponent zawsze zwraca `null`, niezależnie od stanu
  płótna. Pasek istniał w drzewie, ale nigdy się nie renderował —
  „biblioteka bez wywołania" / „wołacz istnieje ≠ renderuje się".
- Whiteboard (`IdeaWhiteboardTool.tsx:4849`) i Mind Map
  (`IdeaRecommendationMap.tsx:7384`) przekazują gołe `isAccepted` (skrót
  JSX dla `isAccepted={true}`) — właśnie ten wzorzec Tabela i Proces miały
  skopiować i nie skopiowały.

**Naprawa (ten dyżur):** zmieniłem `isAccepted={false}` → `isAccepted` w obu
plikach — identycznie jak w Whiteboard/Mind Map, bez zmiany żadnego innego
propa/handlera/miejsca w powłoce. Commit `fffd4947f1` na tej gałęzi.

- `src/components/MyWork/IdeaProcessFlowTool.tsx:4392`
- `src/components/MyWork/IdeaTableTool.tsx:5304`

**Test:** wzmocniłem
`src/components/MyWork/__tests__/IdeaAINudgeStrip.remainingTools.contract.test.ts`
o test źródłowy, który wcześniej NIE ISTNIAŁ i nie łapał tego dokładnego
regresu (stary test sprawdzał tylko że `<IdeaAINudgeStrip` jest w pliku i ma
własny quick-action — nie sprawdzał `isAccepted` wcale). Nowy test:
`expect(source).not.toContain('isAccepted={false}')` +
`expect(source).toMatch(/<IdeaAINudgeStrip[\s\S]*?\bisAccepted\b(?!=)/)`.
`npx vitest run src/components/MyWork/__tests__/IdeaAINudgeStrip.remainingTools.contract.test.ts`
→ **4/4 PASS**. Pomocniczo uruchomiłem też istniejący
`IdeaAINudgeStrip.behavior.test.tsx` (niezmieniony) → **6/6 PASS** — dowód,
że komponent z `isAccepted: true` realnie renderuje/dismissuje/retry'uje.
`npx esbuild` (bez bundlowania) obu zmienionych plików → 0 błędów składni.

**Dowód wzrokiem — PRZED → PO:**

| Ekran (harness) | Węzły/krawędzie fixture'a | PRZED | PO |
|---|---|---|---|
| `mywork-idea-topbar?tool=table` (montuje realny `IdeaTableTool`, duży graf odziedziczony po `mindmap-canvas` — ≥10 węzłów/≥8 krawędzi) | duży | brak paska (`topbar-table-PRZED/…light.png`) | pasek „ANALIZA PŁÓTNA — Tabela wygląda kompletnie — gotowa do konwersji na inicjatywę?" z `Zastosuj`/`X`, light+dark (`topbar-table-PO/…{light,dark}.png`) |
| `mywork-idea-topbar?tool=process_flow` (montuje realny `IdeaProcessFlowTool`, fixture `GRAF_PRZEPLYWU` — dokładnie 5 węzłów / 4 krawędzie) | 5/4 | brak paska | **nadal brak paska** — patrz uwaga niżej |
| `mywork-idea-topbar?tool=whiteboard`, `?tool=mindmap` | — | (niezmienione, referencyjne — już działały przed tym dyżurem) | pasek obecny (jak przed dyżurem) |
| `whiteboard-canvas`, `mindmap-canvas` (kanoniczne ekrany z macierzy) | — | pasek obecny | pasek obecny (bez zmian — te dwa już działały) |
| `processflow-canvas` (kanoniczny ekran z macierzy) | 7 węzłów / 6 krawędzi (`Kroki 7 · Ścieżki 2`, wszystkie połączone) | brak paska | **nadal brak paska** — patrz uwaga niżej |
| `idea-table` (ekran z macierzy) | — | — | **ten identyfikator w `g06-macierz-ekrany.json` montuje `IdeasTableContent` — LISTĘ wszystkich idei (Menu 2), NIE `IdeaTableTool`** (narzędzie-płótno wewnątrz otwartej idei, gdzie mieszka `IdeaAINudgeStrip`). Zły ekran do tego sprawdzenia; użyłem `mywork-idea-topbar?tool=table` jako właściwego odpowiednika — patrz wiersz wyżej. |

**Uwaga o „nadal brak paska" (Process Flow):** to NIE jest niedoróbka naprawy.
`IdeaAINudgeStrip.tsx:153–212` pokazuje podpowiedź TYLKO gdy lokalna heurystyka
znajdzie o czym mówić: `nodeCount<5` (za mało węzłów), `isolatedIds.length>1
&& nodeCount>3` (niepowiązane elementy) albo `nodeCount>=10 &&
edgeCount>=8` (gotowe do konwersji) — plus opcjonalna podpowiedź z serwera
(`Api.getIdeaAISuggestions`, w harnessie bez backendu zawsze cicho pusta).
Kanoniczny fixture Process Flow (`GRAF_PRZEPLYWU` w
`dev-render/screens/mywork-idea-topbar.tsx:102–147`, identycznie
`processflow-canvas.tsx`) ma węzły/krawędzie DOKŁADNIE na granicy — 5 (nie
`<5`) i 6 (nie `>=8`) — i to jest prawdziwe TAKŻE po naprawie: sam prop
`isAccepted` już nie blokuje niczego, ale ten konkretny graf i tak nie
przekracza żadnego progu. Rozważałem edycję fixture'a, żeby to wymusić
wzrokiem — **celowo tego NIE zrobiłem**: `mywork-idea-topbar` jest
zaakceptowanym ekranem z wcześniejszej fali (`docs/program/grafika/`,
16 modułów zatwierdzonych 2026-09-02 wg pamięci sesji), a zmiana treści
fixture'a bez zgody nadzorcy/właściciela zepsułaby ślad tamtej akceptacji.
Dowód dla Process Flow opiera się więc na: identycznej zmianie kodu jak w
Tabeli (ten sam commit, ten sam wzorzec `isAccepted={false}` →
`isAccepted`), na przechodzącym teście źródłowym i na
`IdeaAINudgeStrip.behavior.test.tsx` (dowód komponentowy, że
`isAccepted: true` realnie odblokowuje render). Jeśli nadzorca chce
wzrokowego dowodu na WŁAŚNIE tym ekranie, potrzebny jest osobny fixture z
&lt;5 lub ≥10/≥8 węzłów/krawędzi dla Process Flow — mogę go dorobić na
zlecenie.

**a11y:** wszystkie 20 kadrów (8 topbar-PRZED + 8 topbar-PO + 4 nudge-PRZED
uzupełnione + 8 nudge-PO) — **0 naruszeń axe** (`wynik-*.json` obok
zrzutów). `bash scripts/check-artefakt.sh` → zielony (crimson 9/9 baseline,
bez regresu). `bash scripts/check-list-canon.sh` → zielony (368/368 baseline,
bez regresu). Zero znaczników konfliktu (`git diff --check` czysty).

## Commity tej gałęzi

- `fffd4947f1` — `fix(mywork): unmute AI nudge strip on Process Flow and Table (MYW-IDEAS-011)`
  (3 pliki: `IdeaProcessFlowTool.tsx`, `IdeaTableTool.tsx`,
  `IdeaAINudgeStrip.remainingTools.contract.test.ts`). NIE zpushowane.

## Czego NIE zrobiłem

- MYW-IDEAS-008: zero zmian kodu (defekt już zamknięty wcześniejszymi
  commitami tej gałęzi, patrz wyżej) — poza aktualizacją tego pliku dowodowego
  nie ma nic do zrobienia; **decyzja nadzorcy potrzebna** tylko po to, żeby
  przestawić status w `MODULE_ACCEPTANCE.md`.
- Process Flow: nie dorobiłem osobnego fixture'a z mniejszym/większym grafem,
  żeby wymusić wzrokowy PRZED/PO na `processflow-canvas`/`mywork-idea-topbar
  ?tool=process_flow` — patrz uzasadnienie wyżej (ryzyko dla zaakceptowanego
  ekranu). Jeśli to wymagane do odbioru, potrzebne osobne zlecenie.
- Nie uruchamiałem pełnego `vitest`/`tsc` (zakaz robotnika) — tylko
  `vitest run` na dwóch dotkniętych plikach testowych + `esbuild` per plik.
- Nie pushowałem gałęzi ani nie dotykałem `demo`/`Londyn`.
