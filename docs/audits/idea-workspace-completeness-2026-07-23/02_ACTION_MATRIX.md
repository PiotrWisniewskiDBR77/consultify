# 02 — Macierz akcji (Idea Workspace)

**Data:** 2026-07-23 · **Metoda:** synteza 12 dokumentów powierzchni + 6 audytów wymiarowych (03–09) tej sesji. Wyczerpująca enumeracja każdego przycisku jest w dokumentach źródłowych (`_RAIL_LEWY_*`, `_KONTEKST_*`, `_MENU3_*`, `_PRAWY_PANEL_*`); poniżej macierz skonsolidowana — pokrywa wszystkie powierzchnie i WSZYSTKIE akcje problematyczne, plus reprezentatywne działające.

**Legenda Scope:** workspace · current_view · selected_items · single_item · edge · lane/frame · table_row · table_cell · table_column · external_artifact · unknown
**Legenda Status:** ✅ działa · ◑ działa częściowo · ✖ martwe kliknięcie · 🖥 tylko UI · 💾 tylko kod (brak UI) · ⊘ disabled · 🚩 feature flag · ? niepotwierdzone

## A. Powłoka — Menu 1 (top bar)
| ID | Etykieta | Ikona | Lokalizacja | Widok | Scope | Handler | Endpoint/event | Efekt | Status |
|---|---|---|---|---|---|---|---|---|---|
| m1_convert | Konwertuj ▾ | Workflow | Menu 1 | 4 | workspace/selected | `handleConvert`→`IdeaConvertMenu` | `Api.convertMyIdea` | tworzy artefakt, oznacza ideę `promoted` | ✅ (część targetów ⊘ „soon") |
| m1_teresa | Teresa | MessagesSquare | Menu 1 | 4 | workspace | `handleDiscussWithTeresa` | otwiera czat | seeduje rozmowę AI | ✅ |
| m1_export | Eksport | Download | kebab ⋮ | 4 | workspace | `setExportMenuOpen` | `IdeaExportMenu` | patrz sekcja Export | ✅ |
| m1_history | Historia | History | kebab ⋮ | 4 | workspace | `setSnapshotHistoryOpen` | `SnapshotHistory` | wersje (4 narzędzia) | ✅ (korekta — nie disabled) |
| m1_duplicate | Duplikuj | Copy | kebab ⋮ | 4 | workspace | `handleDuplicateIdea` | `POST /my-ideas/:id/duplicate` | klon idei+mapy | ✅ |
| m1_delete | Usuń | Trash2 | kebab ⋮ | 4 | workspace | `handleDeleteIdea` | `DELETE /my-ideas/:id` | usuwa ideę | ✅ |
| m1_search | Szukaj | Search | kebab „Więcej" | 4 | current_view | `setSearchOpen` | `IdeaUnifiedSearch` | szuka w grafie | ✅ |

## B. Powłoka — Menu 3 (second bar) — ★ ognisko defektu root-cause
| ID | Etykieta | Ikona | Lokalizacja | Widok | Scope | Handler | Endpoint/event | Efekt | Status |
|---|---|---|---|---|---|---|---|---|---|
| m3_add_primary | Dodaj węzeł/kształt/karteczkę/wiersz | Plus | Menu 3 | 4 | current_view | `onAddPrimary` (gałęzi po tool) | MM `mm_add_child` ✅; inne `add_node` | dodaje element | ✅ MM · ✖ WB/Process/**Table** |
| m3_autolayout | Auto-układ | LayoutGrid | Menu 3 | 4 | current_view | `onAutoLayout` (NIE gałęzi) | zdarzenie `idea-mindmap-node-quick-action` | układa graf | ✅ MM · ✖ Process/WB |
| m3_ai_expand | AI rozwiń | Sparkles | Menu 3 | 4 | workspace | `onAIExpand` (NIE gałęzi) | `mm_ai_expand` (tylko MM hook) | rozwija AI | ✅ MM · ✖ WB/Process/Table |
| m3_templates | Szablony | LayoutTemplate | Menu 3 | 4 | current_view | `IdeaTemplateGallery` | statyczny `CONSULTING_TEMPLATES` | wstawia szablon (z confirm!) | ✅ |
| m3_create_from | Utwórz z mapy | GitBranch | Menu 3 | 4 | workspace | `handlePanelChange('tools')` | panel renderowany tylko gdy flaga OFF | — | ✖ (martwy pod domyślną flagą) |
| m3_export | Eksport | Download | Menu 3 | 4 | workspace | `IdeaExportMenu` | client-side | patrz Export | ✅ |

## C. Lewy rail (przełączniki + narzędzia)
| ID | Etykieta | Lokalizacja | Widok | Scope | Handler | Endpoint/event | Status |
|---|---|---|---|---|---|---|---|
| rail_tool_* | Mapa/Tablica/Przepływ/Tabela | rail góra | 4 | workspace | `onToolChange` | `?tool=` + realtime | ✅ (⚠ przełączenie może duplikować treść) |
| rail_select | Zaznaczanie/Przesuwanie | rail | 4 | current_view | `mindMapInteractionMode` | — | ✅ MM · ✖ WB/Process (props nieodbierane) |
| rail_ai | AI (popover) | rail | 4 | workspace | `AIActionsPopover` (akcje `mm_*`) | — | ✅ MM · ✖ WB/Process/Table |
| rail_import_export | Import/Eksport (popover) | rail | 4 | workspace | `ImportExportPopover` (`mm_*`) | — | ✅ MM · ✖ pozostałe |
| rail_more | Więcej narzędzi (popover) | rail | 4 | workspace | `MoreToolsPanel` (`mm_*`) | — | ✅ MM · ✖ pozostałe |
| rail_templates | Szablony | rail | 4 | current_view | świadomy `activeTool` | — | ✅ (jedyny wspólny popover działający) |
| rail_wb_add_* | Karteczka/Tekst/Kształt/Rysuj/Ramka | rail | WB | current_view | `wb_add_*`→`useWhiteboardQuickActions` | — | ✅ |
| rail_pf_* | Start/End/Task/Decyzja/Lane | rail | Process | current_view | `pf_*` | — | ✅ |

## D. Prawy rail + panel — ★ zakładki nie przełączają treści
| ID | Etykieta | Ikona | Scope | Handler | Efekt | Status |
|---|---|---|---|---|---|---|
| rp_problem | Problem | HelpCircle | workspace | `renderMelsCanvasRightRailPanel(_id)` — id IGNOROWANY | pokazuje CAŁY `IdeaWorkspaceTools` | ◑ (ikona podświetla, treść ta sama) |
| rp_status | Status | GitBranch | workspace | jw. | jw. | ◑ |
| rp_inspector | Inspektor | Sparkles | single_item | jw. | jw. | ◑ |
| rp_convert | Konwertuj | Workflow | workspace | jw. | jw. | ◑ |
| rp_health | Zdrowie | LayoutTemplate | current_view | jw. | jw. | ◑ |
| rp_relations | (Powiązania) | — | — | — | BRAK sekcji (kanon SPEC-A wymaga) | 💾 dane są (`link-graph`), UI brak |
| rp_comments | (Komentarze) | — | — | — | BRAK sekcji (kanon wymaga) | 💾 `NodeCommentThread` istnieje, panel brak |

## E. Mind Map — pływający pasek + menu kontekstowe
| ID | Etykieta | Lokalizacja | Scope | Handler | Status |
|---|---|---|---|---|---|
| mm_add_child/sibling | Gałąź/Sąsiad | pływający pasek | single_item | `mm_add_child`/`mm_add_sibling` | ✅ |
| mm_more | ⋮ | pływający pasek | single_item | `onOpenContextMenu`→`NodeContextMenu` | ✅ (otwiera menu węzła, nie tło) |
| mm_pane_* | Add topic/Select all/Fit view/Auto layout/Auto-cluster/Show level/Expand/AI Suggest | prawy klik na tle | workspace/current_view | `PaneContextMenu` `pane_*` | ✅ (Auto-cluster za flagą) |
| mm_node_* | Edytuj/Duplikuj/Kopiuj/Wytnij/Wklej/Drill/Połącz/Odłącz | prawy klik/⋮ | single_item | `NodeContextMenu` | ✅ |
| mm_ai_suggest_links | Sugeruj powiązania | prawy klik węzeł | single_item | brak case w `handleContextAction` | ✖ (działa z popovera AI paska) |
| mm_ai_rewrite_node | Przepisz węzeł (AI) | menu węzła | single_item | `window.prompt()` natywny | ◑ (prymitywny dialog) |
| mm_detect_deps | Wykryj zależności | menu węzła | workspace | flaga `mindmapHeuristicAiOverlays` | 🚩 (OFF, „Wkrótce") |

## F. Process Flow — pasek + menu + defekty
| ID | Etykieta | Lokalizacja | Scope | Handler | Status |
|---|---|---|---|---|---|
| pf_add_step | Start/End/Action/Decision | pasek | current_view | `pf_*` | ✅ |
| pf_lane | + Lane | pasek | lane/frame | `pf_add_lane` | ✅ (etykieta „Lane N" nieprzetłumaczona) |
| pf_insert | + Wstaw (między) | pasek/pływający | edge | wymaga zaznaczonej KRAWĘDZI | ✖ (zwykle toast błędu) |
| pf_paste | Wklej | menu tła | current_view | `duplicateSelected()` (brak schowka) | ◑ (myląca nazwa) |
| pf_edge_delete | Usuń krawędź (Delete) | klawisz | edge | `deleteSelected` liczy tylko węzły | ✖ |
| pf_validate | Waliduj | „Więcej" | current_view | `validateFlow.ts` | ✅ (badge „Brak ostrzeżeń" mylący — pusty stan) |
| pf_edit_step_ai | AI przepisz krok | menu/„Więcej" | single_item | `edit_step` z walidacją before/after | ✅ (najlepiej zbudowana ścieżka AI) |
| pf_export | Eksport | pasek | workspace | PNG/SVG/PDF/MD/BPMN/draw.io | ✅ |

## G. Whiteboard — pasek + facilitacja
| ID | Etykieta | Lokalizacja | Scope | Handler | Status |
|---|---|---|---|---|---|
| wb_add_sticky_menu3 | Dodaj karteczkę | Menu 3 | current_view | `add_node` (nierozpoznane) | ✖ |
| wb_ai_expand_menu3 | AI rozwiń | Menu 3/`IdeaAINudgeStrip` | workspace | `mm_ai_expand`/`mm_ai_summarize` | ✖ |
| wb_ai_generators | „AI Generators" (klastry/tematy) | `IdeaAISuggestionsPanel` | current_view | `wb_add_cluster/theme/outcome` (puste wstawki!) | ◑ (mówi „AI", nie woła LLM) |
| wb_ai_find_themes | AI znajdź tematy | (realny generator) | selected/view | `wb_ai_find_themes`→proposal | ✅ (ale nie wpięty w „AI Generators") |
| wb_connectors | Łączniki 4-str | uchwyty węzła | single_item | `onConnect`→persist | ✅ |
| wb_facilitation | Tryb warsztatowy (role/fazy/głos/timer/follow-me) | panel sesji | workspace | `facilitationPhaseMachine.ts` (backend) | ✅ |
| wb_save_view | Zapisz widok (sceny) | pasek | current_view | sceny/viewport | ✅ |
| wb_group/distribute | Grupuj/Rozłóż | (kod) | selected_items | `wb_group`/`wb_distribute_*` | 💾 martwe akcje, brak UI |

## H. Table — dwie implementacje (legacy/P15)
| ID | Etykieta | Lokalizacja | Scope | Handler | Status |
|---|---|---|---|---|---|
| tbl_add_row | Dodaj wiersz (Menu 3) | Menu 3 | current_view | `add_node` (Table zna tylko `tbl_*`) | ✖ (Menu 3) · ✅ (pasek własny) |
| tbl_sort/filter/group | Sort/Filtr/Grupuj | pasek | current_view | silnik `applyLocalFilterSortGroup` | ✅ |
| tbl_paste | Wklej TSV | Ctrl+V | selected_items | addytywnie + undo | ✅ |
| tbl_row_menu | Edytuj/Notatka/Duplikuj/Usuń (legacy) | prawy klik wiersz | table_row | `IdeaTableTool.tsx:1304` | ✅ (P15 bogatsze: +Insert/Copy/Expand) |
| tbl_cell_menu | — | — | table_cell | BRAK (zero onContextMenu) | ✖ (nie istnieje) |
| tbl_col_menu | Rename/Sort/Hide/Delete (legacy) | prawy klik nagłówek | table_column | `IdeaTableTool.tsx:2922` | ✅ legacy · ✖ P15 (brak) |
| tbl_add_relation | Dodaj powiązanie/Powiąż artefakt | `RowDetailPanel` | table_row | `idea-workspace-add-edge`/`link-artifact` | ✖ (event bez listenera) |
| tbl_autofill_ai | (autofill z artefaktu) | — | table_row | `tbl_autofill_from_artifact` | 💾 pełny kod (i18n/undo), brak przycisku |
| tbl_modules | Data/Forms/Interfaces/Models/Workflow + Tools | pasek P15 | current_view | moduły platformowe | ? (tylko P15; obiekt testowy=legacy) |

## Podsumowanie liczbowe (przybliżone, per powierzchnia)
- **Wspólne akcje powłoki reużywające wiring MM:** ~9 pozycji ✖ w 3 nie-mapowych narzędziach (Menu 3 × add/autolayout/ai_expand, rail AI/Import/Więcej popovery).
- **Prawy panel:** 5 zakładek ◑ (nie przełączają), 2 brakujące sekcje kanonu.
- **Martwe eventy:** ≥5 (`idea-workspace-add-edge`, `-link-artifact`, `-votes-update`, `-outcomes-changed`, `-apply-theme`).
- **Kod bez UI:** ≥6 (`tbl_autofill/refresh/link`, `wb_group/ungroup/distribute`, `IdeaCanvasDiscovery` cały rail, `handleGenerateCanvasAI`, typy `kpi_badge/score/progress/summary`, `mm_import_url`).
- **Martwe endpointy REST:** ≥10 (cluster/outcome family, `v8/mindmap/*`, `develop` SSE, `export-csv`, facilitacja end/outcomes, server export).

Szczegóły w plikach 03–09.
