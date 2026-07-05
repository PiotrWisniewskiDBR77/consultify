# ★★★ EDITOR SHELL — WZORZEC MIND MAP (plan budowy, 2026-07-05)
> Mind Map = wzorzec referencyjny powłoki edytora (editor-shell-canon §5). Po akcepcie Piotra → rozjazd 1:1 na Process Flow · Whiteboard · Tabela + 3 dokumenty + Notatka (8 narzędzi TIER-1).
> SSOT: `docs/ui-standards/02-components/editor-shell-canon.md` + `_ARTEFAKTY_MENU_SPEC.md` (T0-T4). Baza kodu: `triada-standard` (/private/tmp/triada = demo).

## STAN WYJŚCIOWY (zwiad 2026-07-05) — co JUŻ dobre, co zmienić
Żywy plik: `src/components/MyWork/IdeaMapWorkspace.tsx` (3365 linii) + satelity.
**JUŻ zgodne z kanonem (nie ruszać):**
- Paleta narzędzi `CanvasLeftToolbar.tsx` — PŁYWA na canvasie (portal, dynamic left), NIE w sidebarze ✓ (UI-L1 spełnione).
- Context-menu `NodeContextMenu`/`PaneContextMenu` — portaled do body ✓ (UI-L15 spełnione).
- Drawer węzła `IdeaNodeDetailDrawer` — z-modal, portal ✓.
- Prawy panel szer. w-80 (320px) ✓.

## ⚠ ODKRYCIE KLUCZOWE — prawy obszar to TRZY panele, nie jeden
Render `IdeaMapWorkspace.tsx:3047-3170`: trzy OSOBNE, przełączane panele (mutual-exclusive przez `handlePanelChange`, jeden otwarty na raz):
1. `IdeaWorkspaceTools` (817 linii) — właściwości (title/stage/branch/area/priority) + Convert + AI-summarize/expand + layout/theme/style.
2. `IdeaContextPanel` (1282 linie) — backlinki/related/network + insert-to-canvas.
3. `IdeaAISuggestionsPanel` (635 linii) — sugestie AI + insert-to-workspace.
**To JEST UI-L16/L9** (24 sekcje rozproszone, kategorie zmieszane). Docelowo → JEDEN `ArtifactRightPanel` (≤5 sekcji accordion): Akcje(Convert/Eksport) · Właściwości(z Tools) · Powiązania(z ContextPanel) · Komentarze · Historia/AI(z SuggestionsPanel). Konsolidacja 3 paneli = największy + najbardziej widoczny + najbardziej ryzykowny krok.

## PLAN 6 FAZ (kolejność: ryzyko rosnące)
| Faza | Zakres | Pliki:linia | Ryzyko | Status |
|---|---|---|---|---|
| **1 z-index** | surowe z-[NN] → tokeny (z-sticky/dropdown/toast) | IdeaMapWorkspace 2672/2699/2715/3015/3033 · Toolbar 74 · CanvasLeftToolbar 377/431 | niskie | ✅ **DONE** (61ebfc66e2) — naprawia UI-L5/L15 |
| **2 prawy panel** | 3 panele → 1 ArtifactRightPanel (≤5 sekcji accordion) + kolory c-* | IdeaMapWorkspace 3047-3170 · IdeaWorkspaceTools · IdeaContextPanel · IdeaAISuggestionsPanel | **wysokie** (konsolidacja 3 żywych paneli) | TODO — najbardziej widoczny |
| **3 kolory** | slate/navy/primary/gradient → c-* w chrome (crimson-leak IdeaWorkspaceTools:89/304) | pliki powłoki | średnie | TODO (część robi się w fazie 2) |
| **4 command-row** | płaskie 3 warstwy → hierarchia primary(1-4)/secondary-ghost/`⋯` + usunąć duplikaty AI (UI-L12) + 1 segmented-tryb (UI-L13) | IdeaWorkspaceToolbar 73-161 | **wysokie** | TODO |
| **5 L1 PRIMARY** | wynieść „Konwertuj→inicjatywa" z panelu do L1 tożsamości | IdeaMapWorkspace 2715 + handleConvert | wysokie | TODO |
| **6 audyt+motyw** | całościowy sweep tokenów + dark/light + niezmienniki §15.3 | — | średnie | TODO |

## DECYZJE DO PIOTRA (editor-shell-canon §6, default=rekomendacja)
- **D-I-1 (command-row primary 1-4):** rekom. Konwertuj · Dodaj węzeł · Auto-układ · Dyskutuj z Teresą.
- **D-I-2 (panel ≤5 sekcji, które otwarte):** rekom. Właściwości + Powiązania otwarte; Akcje/Komentarze/Historia-AI zwinięte.
- **D-I-3 (tryby):** scalić w 1 segmented z opisami czy usunąć nieużywane?

## KRYTERIUM „SHELL ✅" (editor-shell-canon §5, odbiór wzorca oczami)
3 strefy wg kanonu · z-index tokeny ✅ · jeden motyw (zero crimson-leak) · command-row z hierarchią · panel ≤5 sekcji accordion · context-menu portal+bogate ✅ · zero raila-w-sidebarze ✅ · klasa wizualna 2026. Odbiór: zrzuty Mind Map dark+light → akcept Piotra → rozjazd na 7.

## REKOMENDACJA WYKONANIA
Faza 2 (konsolidacja 3 paneli w 1 accordion) = najbardziej widoczny efekt wzorca ORAZ najwyższe ryzyko (3 żywe panele z realtime/insert-to-canvas). To robota dedykowana z audytem wizualnym każdego kroku — bo wzorzec replikujemy ×8, zły wzorzec = zły ×8. NIE robić pospiesznie. Faza 1 (fundament) położona.
