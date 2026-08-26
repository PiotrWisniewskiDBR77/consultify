# RowDetailPanel ↔ IdeaElementInspector parity (P0) — dowody 2026-08-26

Runtime widziany na tych zrzutach (złota reguła #1 CLAUDE.md):

| Pole | Wartość |
| --- | --- |
| Worktree | `/private/tmp/consultify-rowdetail-parity` |
| Branch | `codex/mywork-rowdetail-parity-20260826` |
| SHA rodzica | `6dd4db1cd6` (`codex/m03-admin-20260824`) |
| Commit tej partii | `c4481e3885` (kod) + ten commit (dowody/harness) |
| Serwer | `dev-render` harness, `npx vite --config dev-render/vite.config.ts --port 4552`, bez logowania/backendu/bazy |
| Flaga | `ff_ideaInspectorRightRail` **OFF domyślnie** w kodzie produkcyjnym, niezmieniona przez tę partię — zrzuty montują `IdeaElementInspector` bezpośrednio (jak w evidence-log `panels-build-20260826`) |
| Motywy | light + dark (`&theme=`) |
| Język | `&lang=pl` |

## 0 · Zadanie i STOP źródłowy

P0 blokujący flip flagi (`f864a060f0`, dzień 3, potwierdzone dziś w
`MYWORK_PANELS_VAULT_SPEC_2026-08-25.md:131`): stary `RowDetailPanel`
(Tabela, `src/components/MyWork/table/RowDetailPanel.tsx`) ma 6 zakładek;
nowy wspólny rail `IdeaElementInspector` nie ma z nimi pełnego parytetu.
Ten wsad ustala stan faktyczny, buduje tabelę parytetu z dowodami, i
zamyka tyle luk, ile da się zamknąć **uczciwie** (bez atrapy) w ramach
zaakceptowanego prototypu (`mywork-inspektor-prototyp.html`, commit
`a64f52285b`, DEC-76).

## 1 · Stan faktyczny — stary panel

`RowDetailPanel.tsx` (2026 linii), montowany WYŁĄCZNIE w
`src/components/MyWork/IdeaTableTool.tsx:4698` (`open={!!detailNodeId &&
!isIdeaInspectorRightRailEnabled()}` — FIX-8, gwarantuje wzajemną
wyłączność z railem, zweryfikowane niezmienione przez
`ideaInspectorRailPanelGuard.contract.test.ts`, PASS bez modyfikacji).

6 zakładek („classic Idea" — `isPlatform` false), `RowDetailPanel.tsx:776-805`:

| Zakładka | Zawartość | Dowód plik:linia |
| --- | --- | --- |
| Properties | Wszystkie kolumny tabeli edytowalne przez `CellRenderer` + „Related items" (lista + dropdown wyszukiwania „Add relation") | `RowDetailPanel.tsx:1187-1303` |
| Comments | Pełny wątek komentarzy: dodaj/edytuj/usuń, @mention z podpowiedziami | `RowDetailPanel.tsx:1305-1485` |
| Attachments | „Linked artifacts" (lista + dropdown „Attach artifact") + generyczne załączniki (nazwa/URL, „Add link", usuń) | `RowDetailPanel.tsx:1487-1678` |
| Activity | Log aktywności (`node.data.activity`) | `RowDetailPanel.tsx:1767-1812` |
| AI Insights | Przycisk „Generate AI insights" → `Api.getIdeaAISuggestions` (realne wywołanie), lista sugestii | `RowDetailPanel.tsx:708-734`, `1854-1899` |
| Drawing | `MiniCanvas` — rysowanie kształtów/strzałek na tej idei | `RowDetailPanel.tsx:1903-1917` |

Źródła danych dla klasycznej (nie-platformowej) ścieżki: `comments`,
`attachments`, `activity` czytane wprost z `node.data.*`
(`RowDetailPanel.tsx:392-394`) — dane trzymane w pamięci grafu, nie osobne
zapytanie API. `relatedNodes` (Related items) liczone z realnych krawędzi
grafu (`RowDetailPanel.tsx:376-386`).

## 2 · Stan faktyczny — nowy rail

`IdeaElementInspector.tsx`, montowany w `IdeaMapWorkspace.tsx:4394` (slot
`elementInspectorRail`, aktywny gdy `isIdeaInspectorRightRailEnabled()`).
Wspólny dla 4 narzędzi (mindmap/process/whiteboard/table); dla Tabeli dane
selekcji dostarcza `IdeaTableTool.tsx` przez `onSelectionChange`
(`IdeaTableTool.tsx:2094-2137`, efekt uruchamiany przy otwarciu wiersza —
**ten sam wiersz** co `RowDetailPanel`, ten sam `detailNode`).

Przed tym wsadem: 7 sekcji accordion (Podstawowe · Treść i głębia ·
Klasyfikacja · Dowody i źródła · Powiązania · Artefakty wyjściowe ·
[narzędzie]). Zaakceptowany prototyp (`mywork-inspektor-prototyp.html`,
pytanie 1, wariant wybrany) specyfikuje **8. sekcję „Historia i AI"**,
zwiniętą domyślnie — nieobecną w kodzie przed tym wsadem.

## 3 · Tabela parytetu — 6 zakładek RowDetailPanel → rail (STAN PRZED / PO tym wsadzie)

| # | Zakładka RowDetailPanel | Odpowiednik w railu | Stan PRZED | Stan PO | Dowód (kod dodany/zmieniony) |
| --- | --- | --- | --- | --- | --- |
| 1 | Properties — kolumny edytowalne | Sekcja „[narzędzie]" (`toolSection`, Tabela: „Kolumna") | **CZĘŚCIOWE** — kolumny wyświetlane, ale tylko jako tekst (nieedytowalne); `Priorytet`/`Typ semantyczny` w Podstawowych zawsze puste (nie raportowane) | **CZĘŚCIOWE → LEPSZE, nie pełne** — kolumny edytowalne inline (input tekstowy, zapis przez `handleNodeDataChange`); `Priorytet`/`Typ semantyczny` teraz realne. Kolumny typu select/relation/formula/rollup ZOSTAJĄ tekstem (potrzebują pełnego typowanego `CellRenderer`, którego kontrakt selekcji nie niesie) | `IdeaMapWorkspace.tsx` sekcja `inspectorToolSection` (branch `activeTool==='table'`); `IdeaTableTool.tsx:2105-2136` (`priority`, `semanticType` w meta) |
| 1b | Properties — „Related items" + „Add relation" | Sekcja „Powiązania" | **BRAK** — `element.relations` nigdy nie było wypełniane, sekcja zawsze pusta (0) dla WSZYSTKICH narzędzi, nie tylko Tabeli | **CZĘŚCIOWE** — realne połączone węzły z krawędzi grafu teraz widoczne (odczyt, jak stary panel). „Add relation" (tworzenie nowego powiązania z poziomu rail) BRAK — prototyp nie rysuje przycisku dodawania w tej sekcji, więc dodanie go byłoby wyjściem poza akceptowany wygląd, nie naprawą luki z niego wynikającej | `IdeaMapWorkspace.tsx` `inspectorRelations` (nowy `useMemo`), `relations: inspectorRelations` w `element` |
| 2 | Comments | — (brak sekcji) | **BRAK** | **BRAK — bez zmian, świadomie** | Patrz §5 „STOP" |
| 3 | Attachments | Częściowo „Artefakty wyjściowe" (inny model danych: outputs=konwersje, nie generyczne linki/pliki) | **BRAK** (generyczne linki/pliki nie mają odpowiednika) | **BRAK — bez zmian, świadomie** | Patrz §5 „STOP" |
| 4 | Activity | Nowa sekcja „Historia i AI" (8.) | **BRAK** (sekcja nie istniała) | **JEST** — realny log z `node.data.activity`, tylko dla Tabeli (jedyne narzędzie, które miało tę zakładkę) | `IdeaElementInspector.tsx:557-622` (render), `IdeaTableTool.tsx:2126-2136` (dane), `IdeaMapWorkspace.tsx` `activity={...}` prop |
| 5 | AI Insights | Sekcja „Historia i AI" (8.) | **BRAK** | **JEST** — ten sam `Api.getIdeaAISuggestions`, realny, dla wszystkich 4 narzędzi | `IdeaElementInspector.tsx:591-621`, `IdeaMapWorkspace.tsx` `handleGenerateInspectorInsights` |
| 6 | Drawing (MiniCanvas) | — (brak sekcji) | **BRAK** | **BRAK — bez zmian, świadomie** | Patrz §5 „STOP" |

**Wynik: 6 zakładek → 2 zamknięte (Activity, AI Insights), 2 wzmocnione
bez pełnego zamknięcia (Properties/kolumny, Related items), 2 pozostają
całkowicie zamknięte (Comments, Drawing) + Attachments częściowo pokryte
innym modelem danych (Artefakty wyjściowe).**

## 4 · Dlaczego to NIE jest cała reszta „6/6" — i dlaczego to nie jest unik

`MYW-IDEAS-CORE-002` — atom właściciela, którego `IdeaElementInspector`
formalnie implementuje (`MYWORK_PANELS_VAULT_SPEC_2026-08-25.md:130`) —
żąda dosłownie: „Reorganize Basic Info, Description, Notes & Context,
Tags & Classification, AI Context, Evidence & Sources and Linked
Artifacts." **Nie wymienia Comments, generycznych Attachments ani
Drawing.** Zaakceptowany prototyp (`mywork-inspektor-prototyp.html`,
pytanie 1) wylicza dokładnie 8 sekcji i żadna z nich nie jest
„Komentarze"/„Załączniki"/„Rysunek" — mimo że kanon SPEC-A dla innych
prawych paneli (np. szyna Notatnika, `MYWORK_PANELS_VAULT_SPEC_2026-08-25.md:151`)
ma osobną sekcję „Komentarze". To rozjście jest w źródle (atom + prototyp),
nie w tej implementacji.

## 5 · STOP — 3 pozycje pozostają otwarte (uczciwie, nie atrapa)

1. **Comments.** Dane są dostępne (`node.data.comments`, ten sam sposób co
   stary panel), ale UI to pełny wątek z @mention, edycją i usuwaniem —
   znacząca powierzchnia. Nie jest częścią `MYW-IDEAS-CORE-002` ani
   8-sekcyjnego prototypu DEC-76. **Decyzja właściciela wymagana**: czy
   komentarze do elementu Idea w ogóle mają żyć w tym railu (i jak — nowa
   9. sekcja? rozszerzenie „Historia i AI"?), zanim ktokolwiek to zbuduje.
2. **Attachments (generyczne).** „Artefakty wyjściowe" pokrywa TYLKO
   konwersje (inicjatywa/zadanie/decyzja), nie dowolne pliki/linki, jakie
   stary panel obsługiwał. Też poza `MYW-IDEAS-CORE-002` i prototypem.
3. **Drawing.** Zero wzmianki w atomie właściciela i w prototypie. Najbardziej
   prawdopodobny kandydat na świadome porzucenie funkcji (nie regresja z
   perspektywy produktu), ale to też wymaga jawnego potwierdzenia
   właściciela, nie mojego domysłu.

**Wniosek:** flaga `ff_ideaInspectorRightRail` NIE powinna wejść default ON
dla Tabeli, dopóki właściciel nie zdecyduje o punktach 1-3 powyżej (albo
świadomie zaakceptuje ich utratę). Mindmap/Whiteboard/Process Flow nigdy
nie miały tych 3 funkcji (brak starego panelu z Comments/Attachments/
Drawing dla tych narzędzi) — dla nich P0 nie dotyczy w tym samym zakresie.

## 6 · Zrzuty (light + dark, harness `mywork-idea-inspector-lekki`)

Dev-render: `dev-render/screens/mywork-idea-inspector-lekki.tsx`
(`?screen=mywork-idea-inspector-lekki`) — rozszerzony o mock `activity` +
`onGenerateInsights` (realny handler w harnessie: loading → wynik, nie
statyczna lista) do zweryfikowania nowej 8. sekcji.

| Zrzut | Opis |
| --- | --- |
| `01-inspector-historyai-collapsed-light.png` | Stan spoczynkowy, motyw jasny — „HISTORIA I AI 3" zwinięta domyślnie (chevron w prawo), zgodnie z prototypem. Widać też realny „Priorytet — 70" i „Typ semantyczny: Ryzyko" (dowód, że te pola już nie są puste dla Tabeli) i wypełnioną sekcję „Powiązania 2" (dowód realnych relacji). |
| `02-inspector-historyai-expanded-light.png` | Po kliknięciu nagłówka „Historia i AI" i „Wygeneruj podpowiedzi AI" — 3 wpisy aktywności (najnowszy pierwszy: komentarz → zmiana priorytetu → zmiana stanu) + 2 wygenerowane podpowiedzi AI, licznik „5" (3+2). |
| `03-inspector-historyai-expanded-dark.png` | Ten sam stan, motyw ciemny — tokeny `c-*`, zero crimson. |
| `04-inspector-historyai-collapsed-dark.png` | Stan spoczynkowy, motyw ciemny. |

### Kontrola wzrokowa (wykonana przeze mnie, przed odbiorem właściciela — CLAUDE.md #7)

Obejrzane wszystkie 4 zrzuty w pełnej rozdzielczości. Potwierdzam: żadnej
czerwieni poza semantyką (Usuń/błąd), fokus/kontrolki spójne z tokenami
`c-*` w obu motywach, sekcja „Historia i AI" renderuje się dokładnie jak
w prototypie (zwinięta, nagłówek 44px, dywider włoskowaty), dane
aktywności i podpowiedzi AI są rzeczywiste (pochodzą z mocka/handlera
harnessu, nie z hardkodowanego JSX wewnątrz komponentu produkcyjnego —
`IdeaElementInspector.tsx` samo nie generuje żadnej treści, tylko renderuje
to, co dostanie przez propsy). Brak przepełnienia poziomego, brak błędów
konsoli/sieci w żadnym z 4 przebiegów `shot.mjs`.

### Czego te zrzuty NIE dowodzą

Harness montuje `IdeaElementInspector` w izolacji (bez `IdeaMapWorkspace`/
`IdeaTableTool` dookoła) — dokładnie jak `panels-build-20260826`. Sekcja
„Kolumna" (`toolSection`) pokazuje „0" bo ten konkretny mock nie przekazuje
kolumn — edytowalność kolumn (zmiana z tekstu na `<input>`) zweryfikowana
kodem (`IdeaMapWorkspace.tsx`, patrz test kontraktowy §7) i esbuild-em, NIE
zrzutem — pełne zamontowanie `IdeaTableTool` w dev-render jest zbyt
kosztowne (ten sam powód co w `ideaInspectorRailPanelGuard.contract.test.ts`).
Nie sprawdzono na żywo w pełnej aplikacji (logowanie/baza) czy wszystkie
widoki Tabeli (Grid/Kanban/Timeline/…) pozostają dostępne przy fladze ON —
zweryfikowano tylko GREP-em, że `TableTabStrip`/`usePlatform` (mechanizm
odpowiedzialny za widoki Tabeli) nie ma żadnej zależności od
`ff_ideaInspectorRightRail` w obecnym kodzie i że ten wsad nie dodał
takiej zależności. Pełny smoke/E2E z fladze ON to zadanie nadzorcy sesji
przed decyzją o flipie, nie tego wsadu (dev-render = bez logowania/bazy).

## 7 · Testy punktowe (per plik, nie pełny `vitest`)

| Plik | Wynik |
| --- | --- |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.behavior.test.tsx` (zaktualizowany — 8. sekcja w asercji kolejności) | 5/5 PASS |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.toolStates.test.tsx` | 4/4 PASS (bez regresji) |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.ownerAndPriority.test.tsx` | 7/7 PASS (bez regresji) |
| `src/components/MyWork/panel/__tests__/IdeaElementInspector.historyAi.test.tsx` (NOWY) | 5/5 PASS |
| `src/components/MyWork/__tests__/ideaInspectorRowDetailParity.contract.test.ts` (NOWY) | 6/6 PASS |
| `src/components/MyWork/__tests__/ideaInspectorRailPanelGuard.contract.test.ts` (istniejący guard — RowDetailPanel/rail wzajemna wyłączność) | 3/3 PASS (bez regresji, string niezmieniony) |

Razem: **30/30 PASS** w plikach dotkniętych tym wsadem. Uruchamiane per
plik (`npx vitest run <plik>`), zgodnie z zakazem pełnego `vitest` u
robotników. Sanity typów: `npx esbuild <plik> --bundle=false --format=esm`
na wszystkich 4 zmienionych plikach źródłowych — bez błędów składni/importu
(esbuild nie robi pełnej weryfikacji typów — zakaz pełnego `tsc` u
robotników, CLAUDE.md §HIGIENA WYKONANIA).

## 8 · SHA / port / flaga widziane na tych zrzutach

| Pole | Wartość |
| --- | --- |
| Data | 2026-08-26 |
| Worktree | `/private/tmp/consultify-rowdetail-parity` |
| Branch | `codex/mywork-rowdetail-parity-20260826` |
| SHA (rodzic) | `6dd4db1cd6` |
| Port dev-render | `4552` |
| Flaga `ff_ideaInspectorRightRail` w kodzie produkcyjnym | **OFF domyślnie** (niezmienione tym wsadem) |
| Widziane przez | zrzuty automatyczne (`dev-render/shot.mjs`, Playwright headless) + weryfikacja wzrokowa opisana w §6 |
