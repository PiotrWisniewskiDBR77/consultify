# 09 — Feature flagi wpływające na Idea Workspace

**Data:** 2026-07-23 · **Metoda:** analiza kodu (grep-first): `src/hooks/useFeatureFlags.tsx`
(rejestr `DEFAULT_FLAGS`), `src/utils/*Flag.ts` (flagi URL/localStorage/env poza rejestrem
`useFeatureFlags`), oraz każde miejsce wywołania `isEnabled(...)`/`isFeatureEnabled(...)` /
`import.meta.env.VITE_*` w `src/components/MyWork/`. Read-only, nie uruchamiałem aplikacji.

## 0. Dwa różne systemy flag w tym samym repo

Consultify ma **dwa niezależne mechanizmy flagowania**, oba obecne w Idea Workspace:

1. **Rejestr `useFeatureFlags.tsx`** (`DEFAULT_FLAGS[]`) — flagi z `id`/`defaultValue`/opisem,
   odczytywane przez `isEnabled(flagId)` / `isFeatureEnabled(flagId)` (alias tej samej funkcji w
   różnych plikach). Rozdzielczość: **local override (jeśli `enableLocalOverrides`) > remote
   (`/feature-flags/runtime`) > rollout % > `defaultValue`**. Trwałość override'u: `localStorage`
   klucz `consultify_feature_flags`.
2. **Osobne pliki `src/utils/<nazwa>Flag.ts`** (wzorzec „EditorShell Wave” / „VF1” / „M06”) — każdy
   plik definiuje własną, samodzielną funkcję `isXEnabled()` z rozdzielczością **URL query
   (`?ff_x=0|1`) > `localStorage["ff.x"]` > `import.meta.env.VITE_X` (build-time) > default
   zaszyty w kodzie**. Te flagi NIE są widoczne w żadnym wspólnym panelu administracyjnym —
   każda żyje we własnym pliku, bez centralnego rejestru. (Poza zakresem tego audytu: panel
   `Flags` z serią `flagsPanel*Flag.ts` w `src/utils/` — to osobny, wewnętrzny mechanizm do
   przeglądania/filtrowania flag w UI administracyjnym, sam w sobie zbudowany z tego samego
   wzorca „osobny plik = osobna flaga”, ale nie dotyczy Idea.)

Konsekwencja dla audytu: **nie ma jednego miejsca, które wylicza „wszystkie flagi Idea”** — trzeba
było przegrepować oba mechanizmy osobno. Poniżej — tylko flagi, które faktycznie rozgałęziają kod
wewnątrz `src/components/MyWork/Idea*.tsx` / `mindmap/` / `whiteboard/` / `processflow/` / `table/`.

---

## 1. Flagi z rejestru `useFeatureFlags.tsx` (`DEFAULT_FLAGS`)

| Flaga (`id`) | Domyślnie | Kategoria | Co gate'uje w Idea | Gdzie w kodzie |
|---|---|---|---|---|
| `tablePlatformMetadataFirst` | **ON** (`true`) | beta | Decyduje, czy Tabela Idei (i osobno: standalone arkusz Excel/Sheet, patrz §4) czyta/zapisuje przez nowe API metadanych-first (`/api/v1/bases`, `/api/v1/tables`) zamiast starego grafu `nodes`/`edges`. To jest **wejściowy przełącznik** dla całego rozdziału legacy↔P15 opisanego w `_KONTEKST_TABELA_2026-07-23.md` / `_MENU3_TABELA_2026-07-23.md` — ale NIE bezpośrednio: patrz `usePlatform` w §2. | `useTablePlatformBridge.ts:163` (`isEnabled('tablePlatformMetadataFirst') && !HARD_DISABLE_METADATA_FIRST`), `MyWorkHub.tsx:1268,2226` (nawigacja do arkusza) |
| `tablePlatformRecordsApi` | ON (`true`) | beta | **Nic — flaga-widmo.** Opisana jako „Enables the new `/api/v1/bases` and `/api/v1/tables` endpoints”, ale `grep` w całym `src/` i `server/` poza samą definicją w `useFeatureFlags.tsx` daje **zero wyników** — żaden kod (front ani back) nigdy nie woła `isEnabled('tablePlatformRecordsApi')`. Endpointy `/api/v1/bases`/`/api/v1/tables` (`server/src/routes/table-platform.routes.ts`) są zamontowane **bezwarunkowo**, niezależnie od tej flagi. | brak jakiegokolwiek callera — potwierdzone `grep -rn "tablePlatformRecordsApi"` poza `useFeatureFlags.tsx` |
| `mindmapHeuristicAiOverlays` | OFF (`false`) | ai | „DP-5 honesty gate”: chowa 4 nakładki Mind Mapy, których wynik to heurystyka po stronie klienta udawana za AI — `AIBranchBalancer`, `AISentimentOverlay`, `AIAutoClustering`, `AIDependencyDetector` (wszystkie 4 realne komponenty React, całkowicie niewidoczne przy OFF) — plus odblokowuje pozycję „Auto-klasteryzacja” w popoverze AI (rail) i „Wykryj zależności” w menu węzła (badge „Wkrótce” znika). | `IdeaRecommendationMap.tsx:3920,5296,5644,5981,6077,6107`; `AIActionsPopover.tsx:34,186` (`HEURISTIC_ACTIONS = Set(['mm_ai_cluster'])`) |
| `mindmapMultiToolbar` | OFF | beta | Gdy ON: zaznaczenie >1 węzła w Mind Map pokazuje wspólny pasek stylu (typ/semantyka/motyw/auto-layout/kolor/czcionka/bold/blokada) zamiast **braku** paska przy multi-select (dzisiejsze zachowanie: pasek pokazuje się TYLKO dla 1 zaznaczonego węzła). | `IdeaRecommendationMap.tsx:5004`; konsument `FloatingNodeToolbar.tsx` |
| `mindmapAlignSnap` | OFF | beta | Gdy ON (wymaga też `mindmapMultiToolbar` ON, bo dokłada się do tego samego paska multi-select): przyciski Wyrównaj (6 kierunków, ≥2 zaznaczone) / Rozłóż (poziomo/pionowo, ≥3 zaznaczone) + snap-to-grid + smart guides. Przy OFF tych przycisków nie ma wcale (nie „disabled” — nieobecne w DOM). | `IdeaRecommendationMap.tsx:5009`; `FloatingNodeToolbar.tsx:87` |
| `mindmapVirtualization` | OFF | beta | Gdy ON: ReactFlow montuje DOM tylko dla węzłów w viewport (`onlyRenderVisibleElements`) — wydajność dla dużych map. OFF = dziś wszystkie węzły zawsze w DOM. Czysto wydajnościowe, brak zmiany funkcjonalnej widocznej dla użytkownika. | `IdeaRecommendationMap.tsx:5017`; `mindmap/virtualization.ts` |
| `ENABLE_TERESA_MINDMAP` | OFF | ai | „Dyskutuj z Teresą” z Mind Mapy: przy OFF (dziś) każdy klik tworzy nową, lokalną wiadomość kickoff bez kontekstu encji. Przy ON: `openChatWithContext({entityType:'idea', entityId, ...})` — czat niesie `pmoContext.ideaId`, drugi klik na tę samą ideę **wznawia** tę samą konwersację zamiast tworzyć nową. **Realna implementacja obu gałęzi istnieje** (nie fantom) — flaga tylko wybiera, którędy. | `IdeaMapWorkspace.tsx:282,1838-1852` |
| `mindmapDrawerUnified` | **ON** (flip 2026-07-16, akcept Piotra) | beta | Który komponent renderuje szczegóły węzła: nowy `UnifiedNodeDetailDrawer` (kanoniczny, superset) vs dwa stare, zdublowane drawery: `NodeDetailDrawer.tsx` (~1042 LOC) i `IdeaNodeDetailDrawer.tsx` (~1383 LOC), używane odpowiednio w `IdeaRecommendationMap.tsx` (M06) i `IdeaMapWorkspace.tsx` (M05). **Skutek uboczny domyślnego ON**: oba stare drawery (~2400 LOC łącznie) są dziś **martwe w runtime domyślnym** — osiągalne tylko przez ręczne wymuszenie `localStorage["ff.mindmap_drawer_unified"]="0"` (nie ma do tego dedykowanego query key — flaga korzysta z generycznego mechanizmu `useFeatureFlags`, nie z pliku `xFlag.ts`, więc **nie ma** `?ff_...=0` w URL dla tej konkretnej flagi). | `IdeaRecommendationMap.tsx:3923,5937-5956`; `IdeaMapWorkspace.tsx:285,3842-3881` |
| ⚠ komentarz nieaktualny | — | — | Komentarze przy obu miejscach użycia (`IdeaMapWorkspace.tsx:284`, `mindmap/UnifiedNodeDetailDrawer.tsx:18`) nadal mówią „OFF (default) = today's ... drawer” / „Rendered behind feature flag ... (OFF by default)” — to jest **nieaktualne** od flipu 07-16; realny `defaultValue` w rejestrze to `true`. Drobna rozbieżność dokumentacja-w-kodzie ↔ rzeczywisty stan. | j.w. |

Poza wąskim zakresem Idea, ale w tym samym rejestrze (nie opisuję szczegółowo — inne moduły):
`myWorkNotebookV2`, `myWorkSignalsV2`, `abTestingFramework`, `landing*`, `assessment*`,
`promptRegistryUi`.

---

## 2. `usePlatform` w Tabeli Idei — nie jest to prosta flaga, to POCHODNA

`IdeaTableTool.tsx:437`:
```ts
const usePlatform = platformActive && !(platformLooksEmpty && legacyLooksPopulated);
```
`platformActive` = `platformIntegration.active`, ustawiane w `useTablePlatformIntegration.ts:289`:
```ts
const isActive = bridge.isNewPlatform && open && !bridge.platformFailed;
```
`bridge.isNewPlatform` pochodzi z `useTablePlatformBridge.ts:163` = `isEnabled('tablePlatformMetadataFirst') && !HARD_DISABLE_METADATA_FIRST` (stały kill-switch `HARD_DISABLE_METADATA_FIRST = false` w kodzie, obecnie nieaktywny).

**Czyli łańcuch to:** flaga `tablePlatformMetadataFirst` (globalna, ON) → `isNewPlatform` → `platformActive`
→ **ochronnik danych** (`!(platformLooksEmpty && legacyLooksPopulated)`, czyli: jeśli platforma jest
pusta a stary graf węzłów już ma dane, ZOSTAJEMY na legacy mimo że flaga globalna jest ON) → dopiero
to jest `usePlatform`, który realnie przełącza który z dwóch kompletnie równoległych toolbarów/menu
kontekstowych/silników renderuje się w danym obiekcie Idea (opisane szczegółowo w
`_KONTEKST_TABELA_2026-07-23.md` i `_MENU3_TABELA_2026-07-23.md`).

**Ryzyko rozjazdu UX (potwierdzone w dokumentach powierzchni):** dwie Idee obok siebie w tym samym
demie mogą renderować **kompletnie różne** menu wiersza (4 vs 8 pozycji), różne menu nagłówka
kolumny (4 pozycje vs brak w ogóle), różny toolbar (płaski rząd ~20 ikon vs zwinięty pod „…” + 5
zakładek modułów Data/Forms/Interfaces/Models/Workflow) — a użytkownik nie ma żadnego widocznego
sygnału, KTÓRY tryb akurat widzi ani dlaczego akurat ten. To nie jest flaga do „włącz i zobacz”
— to zależy od stanu danych konkretnej Idei w momencie renderu.

**Blast radius poza Idea:** `tablePlatformMetadataFirst` steruje TĄ SAMĄ ścieżką kodu, która jest
używana też przez **osobny, niezwiązany z Idea artefakt** — standalone arkusz Excel/Sheet
(`MyWorkHub.tsx:1268,2226`, nawigacja `mywork-open-item` dla `type==='sheet'`). Jedna flaga,
dwa zupełnie różne narzędzia produktu — zmiana `defaultValue` odbije się na obu jednocześnie.

---

## 3. Flagi spoza rejestru `useFeatureFlags` (własny plik `xFlag.ts`), dotyczące Idea

Wzorzec wspólny dla wszystkich poniższych: `?ff_<klucz>=0|1` (URL) > `localStorage["ff.<klucz>"]`
> `import.meta.env.VITE_<KLUCZ>` (build-time) > default zaszyty w kodzie.

| Plik / flaga | Domyślnie | Co gate'uje w Idea | Ryzyko |
|---|---|---|---|
| `src/utils/melsCanvasFlag.ts` (`ff_melsCanvas` / `ff.mels_canvas` / `VITE_MELS_CANVAS`) | **ON** (flip 2026-07-22 w nocy, akcept Piotra) | Największa flaga w tym obszarze: przełącza WSZYSTKIE 4 narzędzia kanwy (Mind Map/Whiteboard/Process Flow/Tabela) między starym „floating chrome” (`IdeaWorkspaceToolbar.tsx` + `IdeaWorkspaceTools` pływające nad płótnem, bez Menu 1/Menu 3 powłoki) a nowym `<IdeaCanvasMelsView>` (EditorShell/ExecutiveModuleShell — Menu 1 + Menu 3 + prawy rail + kebab). **Skutek uboczny domyślnego ON:** cały stary tor `IdeaWorkspaceToolbar.tsx` jest dziś martwy-by-default w runtime, osiągalny tylko przez `?ff_melsCanvas=0` — „furtka ewakuacyjna”, nie ścieżka produkcyjna. | Duże — to jest fundament pod którym żyją WSZYSTKIE menu/paski opisane w `_MENU3_*`/`_RAIL_LEWY_*`/`_PRAWY_PANEL_IDEE` — zmiana defaultu z powrotem na OFF cofnęłaby cały ekran do zupełnie innego layoutu bez ostrzeżenia. |
| `src/utils/vf1CanvasSpecAFlag.ts` (`ff_vf1CanvasSpecA` / `ff.vf1_canvas_speca` / `VITE_VF1_CANVAS_SPECA`) | OFF | Czysto prezentacyjne: podmienia loading/error placeholdery na kanoniczne `SkeletonState variant="canvas"` / `ErrorState` w Mind Map (`IdeaMapWorkspace.tsx:3248`), Whiteboard (`IdeaWhiteboardTool.tsx:3363`) i Process Flow (`IdeaProcessFlowTool.tsx:2379,2677`). **Tabela NIE jest objęta tą flagą** (brak wystąpień w `IdeaTableTool.tsx`) — asymetria: 3 z 4 narzędzi kanwy mają gotowy kanoniczny stan ładowania/błędu za flagą, Tabela nie ma odpowiednika. | Niskie (czysto wizualne), ale warto odnotować lukę Tabeli przy ewentualnym włączaniu. |
| `src/components/MyWork/mindmap/mindmapExportFlags.ts` (`ff_mindmapPptxNative` / `ff.mindmap_pptx_native` / `VITE_MINDMAP_PPTX_NATIVE_ENABLED`) | OFF | Eksport Mind Mapy do „Prezentacja HTML”: OFF = generuje HTML-blob po stronie klienta (dzisiejsze zachowanie); ON = realne wywołanie `POST /api/my-work/my-ideas/:id/map/export/pptx` (prawdziwy `.pptx` przez `PptxPipelineService`). Realna, działająca alternatywna ścieżka za flagą — nie fantom. | Niskie, izolowane do jednej pozycji eksportu. |
| `IdeaExportMenu.tsx` (`IDEA_SERVER_EXPORT_ENABLED = VITE_ENABLE_IDEA_SERVER_EXPORT === 'true'`) | OFF | Świadoma decyzja DP-5: eksport PO STRONIE SERWERA (historycznie czysty stub — zapisywał wiersz, żaden worker nigdy nie produkował pliku) ma dziś REALNY, ale ograniczony generator (`json`/`markdown` przez `finalBatchService.ts`, env `IDEA_SERVER_EXPORT_ENABLED` — **osobna flaga backendowa o tej samej nazwie funkcji, ale to zmienna środowiskowa serwera, nie ten sam mechanizm co klient**). Przy OFF (dziś) żadne żądanie server-side w ogóle nie leci — WSZYSTKIE działające eksporty (PNG/SVG/PDF/Markdown/JSON/pakiet/mapping/share/raport/prezentacja) idą w 100% po stronie klienta. Uwaga: nazwa zmiennej env klienta (`VITE_ENABLE_IDEA_SERVER_EXPORT`) i serwera (`IDEA_SERVER_EXPORT_ENABLED`) są rozdzielne — trzeba by ustawić OBIE, żeby cała ścieżka zadziałała end-to-end; ustawienie tylko jednej z nich nie da spójnego efektu. | Średnie — dwie osobne zmienne env (klient/serwer) o niemal identycznej nazwie i różnym mechanizmie to realne ryzyko pomyłki operacyjnej przy próbie włączenia. |
| `src/components/MyWork/IdeasTableContent.tsx` (`VF1_IDEATABLE_SPECA_ENABLED = VITE_VF1_IDEATABLE_SPECA === 'true'`) | OFF | **Poza wąskim zakresem tego audytu** (dotyczy listy Idei w My Work Hub — kart/wierszy `IdeasTableContent`, NIE narzędzia „Tabela” wewnątrz otwartej Idei opisanego w `_KONTEKST_TABELA`/`_MENU3_TABELA`). Wspominam wyłącznie, żeby nikt nie pomylił tej flagi z `tablePlatformMetadataFirst`/`usePlatform` — nazwa „IdeaTable” w obu jest myląco podobna, ale to dwa zupełnie różne ekrany. | Ryzyko pomyłki nazewniczej przy przyszłej pracy, nie ryzyko funkcjonalne dla Idea Workspace. |

**Flagi nazewniczo podobne, ale POZA Idea (dla jasności, żeby nikt ich nie pomylił z `ff_melsCanvas`):**
`src/utils/melsTabeleFlag.ts` (`VITE_MELS_TABELE`) i `src/utils/melsPrezentacjeFlag.ts`
(`VITE_MELS_PREZENTACJE`) gate'ują `<TabeleView>`/`<PrezentacjeView>` — to standalone narzędzia
Excel („Tabele”) i Prezentacje/Deck, całkowicie inny kod (`KimiWorkspaceShell` /
`useKimiArtifactPipeline`), zero związku z Idea. Oba domyślnie **OFF**.

---

## 4. Kill-switche zaszyte na sztywno w kodzie (nie flagi URL/localStorage — stałe)

| Stała | Wartość | Plik | Co robi |
|---|---|---|---|
| `AI_PROPOSAL_ENABLED` | `true` (eksportowana) | `processflow/ProcessFlowToolbar.tsx:31` | Włącza pozycję „Propozycja AI” w „Więcej” (Process Flow) → realny `POST /api/my-work/my-ideas/:id/ai-generate`. Komentarz w kodzie nazywa to wprost „kill-switch” — awaryjne wyłączenie całej funkcji bez ruszania reszty okablowania. Nie ma odpowiednika URL/localStorage — zmiana wymaga edycji kodu i redeployu. |
| `HARD_DISABLE_METADATA_FIRST` | `false` | `table/useTablePlatformBridge.ts:27` | Twardy override, który (gdyby `true`) wymuszałby legacy Tabelę niezależnie od stanu flagi `tablePlatformMetadataFirst`. Dziś nieaktywny (`false`), ale istnieje jako gotowy „hamulec bezpieczeństwa” — brak UI do jego przełączenia, tylko edycja kodu. |

Poza wąskim zakresem Idea, ale warto znać wzorzec: `RADAR_ENABLED = false` i
`SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP = false` w `MyWorkHub.tsx` to te same twarde kill-switche
(bez żadnej ścieżki URL/localStorage) dla odpowiednio zakładki „Home”/Radar i paska narzędzi
Notatnika — sąsiadują z Idea w tym samym pliku-hubie, ale nie wpływają na Idea Workspace.

---

## 5. Podsumowanie ryzyk rozjazdu UX (dla decyzji właściciela)

1. **`usePlatform` (Tabela)** — dwie kompletnie różne implementacje tego samego ekranu,
   przełączane automatycznie per-obiekt na podstawie stanu danych, bez żadnego widocznego
   wskaźnika dla użytkownika który tryb właśnie widzi. Największe ryzyko z całej listy.
2. **`ff_melsCanvas` ON** — jeśli ktoś kiedyś przywróci flagę OFF (np. do porównania), cały
   ekran wraca do zupełnie innego layoutu (brak Menu 1/Menu 3, floating chrome) — warto
   pamiętać, że to nie jest już „wariant eksperymentalny”, tylko realna, żywa alternatywna
   ścieżka kodu, która może się zdezaktualizować niezauważalnie.
3. **`mindmapDrawerUnified` ON** — dwa duże, wcześniej produkcyjne komponenty
   (`NodeDetailDrawer.tsx`, `IdeaNodeDetailDrawer.tsx`, razem ~2400 LOC) są dziś
   nieosiągalne w domyślnym runtime — kandydat do usunięcia PO potwierdzeniu, że nikt już
   nie polega na override'ie `ff.mindmap_drawer_unified=0` (patrz też `08_DEAD_UI_AND_HIDDEN_CODE.md`).
4. **`tablePlatformRecordsApi`** — martwa definicja flagi (zero callerów) opisująca
   funkcjonalność, która i tak działa bezwarunkowo. Do wyczyszczenia z rejestru albo do
   dopięcia realnego gate'owania endpointów, jeśli intencja była inna.
5. **Dwie zmienne env o niemal identycznej nazwie** (`VITE_ENABLE_IDEA_SERVER_EXPORT` klient
   vs `IDEA_SERVER_EXPORT_ENABLED` serwer) dla eksportu server-side Idei — realne ryzyko, że
   ktoś ustawi tylko jedną i będzie zaskoczony brakiem efektu.
6. **Jedna flaga (`tablePlatformMetadataFirst`), dwa niezwiązane narzędzia** (Tabela Idei +
   standalone arkusz Sheet/Excel) — zmiana `defaultValue` ma podwójny blast radius.
